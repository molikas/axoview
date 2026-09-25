#!/usr/bin/env node
/**
 * E2E against the built Docker image — the one runner CI and local runs share
 * (ADR 0048 §6; the rules are in docs/guidelines/testing.md, "Testing against
 * the Docker image").
 *
 *   npm run test:e2e:docker                 the smoke (the `Docker Gate` check)
 *   npm run test:e2e:docker:full            the full regression, storage OFF
 *   node scripts/e2e-docker.js --help       every flag
 *
 * It does build → run → wait → Playwright → teardown, and it enforces the
 * resource contract written after the 2026-09-24 incident (four Playwright
 * streams, ~8 containers and two image builds froze the dev machine, and 33
 * child processes outlived the "stopped" tasks). The operator doesn't have to
 * remember any of it:
 *
 *   1. One heavy stream at a time. The ETA and the resource plan print first.
 *   2. Single instance: `.e2e-docker.lock` (pid + run id). A live lock, or any
 *      container labelled `axoview.regress`, refuses the start and prints the
 *      cleanup command; it never runs it.
 *   3. Everything created is labelled (`axoview.regress=<run-id>` on containers
 *      and volumes, `axoview:regress-<run-id>` on the image it builds) and
 *      removed on exit, SIGINT, SIGTERM and uncaught errors. An `--image` it was
 *      given is never removed.
 *   4. Process TREES are killed, never lone PIDs: `taskkill /T /F` on win32;
 *      a detached process group and `process.kill(-pid)` on POSIX. Playwright
 *      runs as `process.execPath` + its CLI file, no .cmd/npx wrapper, so the
 *      PID killed is Playwright's own.
 *   5. A watchdog polls `docker inspect` every 5 s. A stopped container (or one
 *      unhealthy for 15 s) kills the Playwright tree and exits 3.
 *   6. Capped cost: `--cpus=2 --memory=2g`, Playwright `workers: 1`, video off,
 *      traces on failure only, output under `test-results/docker-<run-id>/`.
 *   7. A leak audit ends every run, pass, fail or abort: no chrome-headless-shell,
 *      ffmpeg or Playwright node from THIS run (matched by command line, and by
 *      the process tree recorded while Playwright ran), no container or volume
 *      labelled with this run, no `axoview:regress-<run-id>` image.
 *
 * Exit codes (testing.md's table):
 *   0 pass · 1 test failures · 2 harness or setup error (Docker not running,
 *   refused start, build failure, interrupted, nothing ran) · 3 aborted: the
 *   container died · 4 leak audit failed. A failed audit always wins: exit 4
 *   means "clean up this machine" whatever else happened.
 *
 * Output: test-results/docker-<run-id>/
 *   summary.json                   the verdict (read this, not the list output)
 *   <phase>/results.json           Playwright's JSON report
 *   <phase>/html/                  Playwright's HTML report
 *   <phase>/blob/                  blob report (CI only, for merge-reports)
 *   <phase>/artifacts/             traces/screenshots of failed tests
 *   <phase>/container.log          `docker logs`, saved before teardown
 * Phases: smoke = storage-on (smoke-secure + smoke-insecure) then storage-off
 * (smoke-storage-off); full = one storage-OFF container running `regression` +
 * `regression-touch`. Each phase has its own directory because Playwright
 * empties its output directory at startup.
 *
 * `--aggregate=<dir>` is a separate, Docker-free mode for CI: it merges every
 * summary.json under <dir> (one per shard) and writes the step summary.
 */

const { execFile, spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const resolveVersion = require('./resolve-version');
const ROOT_PACKAGE = require('../package.json');

const ROOT = path.resolve(__dirname, '..');
const LOCK_PATH = path.join(ROOT, '.e2e-docker.lock');
const CONFIG = path.join(ROOT, 'packages', 'axoview-e2e', 'playwright.docker.config.ts');
const LABEL = 'axoview.regress';
const IS_WIN = process.platform === 'win32';

const EXIT = { PASS: 0, TESTS: 1, HARNESS: 2, CONTAINER: 3, LEAK: 4 };

const WAIT_TIMEOUT_MS = 90_000;
const WATCHDOG_MS = 5_000;
const UNHEALTHY_TICKS_TO_ABORT = 3; // 3 × 5 s
// Recording Playwright's process tree while it runs. `ps` is cheap; on win32 a
// Get-CimInstance query costs about a second of CPU, so it runs less often.
const TRACK_MS = IS_WIN ? 30_000 : 5_000;
const KILL_GRACE_MS = 5_000;

// Measured 2026-09-24: the full suite (~289 tests) took ~80 min locally at 1
// worker (42 min at 2 workers). The smoke is an estimate until A5's first run.
const FULL_MINUTES_LOCAL = 80;
const FULL_TESTS = 289;

const PHASES = {
  smoke: [
    { name: 'storage-on', storage: true, projects: ['smoke-secure', 'smoke-insecure'] },
    { name: 'storage-off', storage: false, projects: ['smoke-storage-off'] }
  ],
  full: [{ name: 'full', storage: false, projects: ['regression', 'regression-touch'] }]
};

class HarnessError extends Error {}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const USAGE = `Usage: node scripts/e2e-docker.js [options] [-- <extra Playwright args>]

  --suite=smoke|full   smoke (default): storage ON journeys + storage OFF probe.
                       full: the whole ./tests suite, storage OFF.
  --image=<tag>        test this image instead of building one (never removed).
  --port=<n>           host port for nginx (default 8081; never 80 or 3000).
  --shard=<i>/<N>      run one Playwright shard.
  --files=<a,b,...>    only these spec files (Playwright file filters).
  --no-volume          storage ON without a volume (smoke only).
  --run-id=<id>        fix the run id (lowercase letters, digits, dashes);
                       default: a timestamp. Output: test-results/docker-<id>/.

  --aggregate=<dir>    CI: merge every summary.json under <dir>; no Docker.
    --out=<file>       where the merged JSON goes (default
                       ./docker-regression-summary.json).
    --expect-shards=<N>  report shards that never produced a summary.

Exit: 0 pass · 1 test failures · 2 harness/setup error · 3 container died · 4 leak audit failed`;

function usageError(msg) {
  console.error(`e2e-docker: ${msg}\n\n${USAGE}`);
  process.exit(EXIT.HARNESS);
}

function parseArgs(argv) {
  const opts = {
    suite: 'smoke',
    image: null,
    port: 8081,
    shard: null,
    files: [],
    volume: true,
    runId: null,
    aggregate: null,
    out: null,
    expectShards: null,
    passthrough: []
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') {
      opts.passthrough = argv.slice(i + 1);
      break;
    }
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!m) usageError(`unexpected argument "${arg}"`);
    const [, key, value] = m;
    const need = () => {
      if (value === undefined || value === '') usageError(`--${key} needs a value (--${key}=...)`);
      return value;
    };
    switch (key) {
      case 'help':
        console.log(USAGE);
        process.exit(EXIT.PASS);
        break;
      case 'suite':
        opts.suite = need();
        if (!PHASES[opts.suite]) usageError(`--suite must be smoke or full, got "${opts.suite}"`);
        break;
      case 'image':
        opts.image = need();
        break;
      case 'port': {
        const port = Number(need());
        if (!Number.isInteger(port) || port < 1024 || port > 65535) usageError(`--port must be 1024-65535, got "${value}"`);
        // ADR 0048 §2: 80 hides the port half of the Origin gate, 3000 equals
        // the backend's default ALLOWED_ORIGINS (and the dev server).
        if (port === 3000) usageError('--port=3000 is the one port the Origin gate always passes on; pick another');
        opts.port = port;
        break;
      }
      case 'shard': {
        const s = /^(\d+)\/(\d+)$/.exec(need());
        if (!s || +s[1] < 1 || +s[1] > +s[2]) usageError(`--shard must be i/N with 1 <= i <= N, got "${value}"`);
        opts.shard = `${+s[1]}/${+s[2]}`;
        break;
      }
      case 'files':
        opts.files = need()
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
        break;
      case 'no-volume':
        opts.volume = false;
        break;
      case 'run-id':
        opts.runId = need();
        if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(opts.runId)) usageError('--run-id: lowercase letters, digits and dashes, 1-40 chars');
        break;
      case 'aggregate':
        opts.aggregate = path.resolve(need());
        break;
      case 'out':
        opts.out = path.resolve(need());
        break;
      case 'expect-shards': {
        const n = Number(need());
        if (!Number.isInteger(n) || n < 1) usageError('--expect-shards must be a positive integer');
        opts.expectShards = n;
        break;
      }
      default:
        usageError(`unknown option --${key}`);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const log = (msg) => console.log(`[e2e-docker] ${msg}`);
const warn = (msg) => console.warn(`[e2e-docker] WARNING: ${msg}`);
const fail = (msg) => console.error(`[e2e-docker] ${msg}`);

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function docker(args, opts = {}) {
  const r = spawnSync('docker', args, {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 256 * 1024 * 1024,
    timeout: opts.timeout || 120_000
  });
  return {
    ok: !r.error && r.status === 0,
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || (r.error ? String(r.error.message) : ''),
    error: r.error
  };
}

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

function stripAnsi(s) {
  return String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
}

function firstLines(s, max = 600) {
  const text = stripAnsi(s).trim();
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function makeRunId() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
  return `${stamp}-${crypto.randomBytes(2).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Run state (one per process)
// ---------------------------------------------------------------------------

const state = {
  opts: null,
  runId: null,
  runDir: null,
  image: null,
  builtImage: false,
  volume: null,
  port: null,
  containers: new Set(),
  logsSaved: new Set(),
  children: new Map(), // pid -> label (every process tree this run spawned)
  playwright: null, // { pid } while Playwright runs
  tracked: new Map(), // pid -> { cmd, name } seen under this run's Playwright
  timers: new Set(),
  phases: [],
  abort: null, // { code, reason }
  harnessError: null,
  swept: [],
  lockOwned: false,
  cleanedUp: false,
  finalizing: false,
  startedAt: new Date()
};

// ---------------------------------------------------------------------------
// Processes: listing, tracking, tree kills
// ---------------------------------------------------------------------------

const PS_WIN =
  "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Get-CimInstance Win32_Process | " +
  'Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress';

function parseWinProcesses(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return [];
  let rows = JSON.parse(text);
  if (!Array.isArray(rows)) rows = [rows];
  return rows.map((p) => ({
    pid: Number(p.ProcessId),
    ppid: Number(p.ParentProcessId),
    pgid: null,
    name: String(p.Name || ''),
    cmd: String(p.CommandLine || '')
  }));
}

function parsePsProcesses(stdout) {
  const out = [];
  for (const line of String(stdout || '').split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const cmd = m[4].trim();
    out.push({
      pid: Number(m[1]),
      ppid: Number(m[2]),
      pgid: Number(m[3]),
      name: path.basename(cmd.split(/\s+/)[0] || ''),
      cmd
    });
  }
  return out;
}

const PS_ARGS = ['-ww', '-eo', 'pid=,ppid=,pgid=,args='];
const WIN_PS_ARGS = ['-NoProfile', '-NonInteractive', '-Command', PS_WIN];

/** Every process on the machine, or null when the listing itself failed. */
function listProcessesSync() {
  const r = IS_WIN
    ? spawnSync('powershell.exe', WIN_PS_ARGS, { encoding: 'utf8', windowsHide: true, maxBuffer: 256 * 1024 * 1024, timeout: 60_000 })
    : spawnSync('ps', PS_ARGS, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 30_000 });
  if (r.error || r.status !== 0) return null;
  try {
    return IS_WIN ? parseWinProcesses(r.stdout) : parsePsProcesses(r.stdout);
  } catch {
    return null;
  }
}

function listProcessesAsync() {
  return new Promise((resolve) => {
    const cb = (err, stdout) => {
      if (err) return resolve(null);
      try {
        resolve(IS_WIN ? parseWinProcesses(stdout) : parsePsProcesses(stdout));
      } catch {
        resolve(null);
      }
    };
    if (IS_WIN) execFile('powershell.exe', WIN_PS_ARGS, { windowsHide: true, maxBuffer: 256 * 1024 * 1024, timeout: 60_000 }, cb);
    else execFile('ps', PS_ARGS, { maxBuffer: 256 * 1024 * 1024, timeout: 30_000 }, cb);
  });
}

function descendantsOf(rootPid, procs) {
  const byParent = new Map();
  for (const p of procs) {
    if (!byParent.has(p.ppid)) byParent.set(p.ppid, []);
    byParent.get(p.ppid).push(p);
  }
  const found = [];
  const root = procs.find((p) => p.pid === rootPid);
  if (root) found.push(root);
  const queue = [rootPid];
  const seen = new Set(queue);
  while (queue.length) {
    for (const child of byParent.get(queue.shift()) || []) {
      if (seen.has(child.pid)) continue;
      seen.add(child.pid);
      found.push(child);
      queue.push(child.pid);
    }
  }
  return found;
}

/** Remember everything currently under Playwright, so orphans can be found later. */
function recordTree(rootPid, procs) {
  if (!procs) return;
  for (const p of descendantsOf(rootPid, procs)) {
    if (p.pid !== process.pid) state.tracked.set(p.pid, { cmd: p.cmd, name: p.name });
  }
}

let trackInFlight = false;
async function trackTick() {
  if (trackInFlight || !state.playwright) return;
  trackInFlight = true;
  try {
    const root = state.playwright && state.playwright.pid;
    const procs = await listProcessesAsync();
    if (root) recordTree(root, procs);
  } finally {
    trackInFlight = false;
  }
}

/**
 * The processes that belong to this run: Chromium carrying this run's marker
 * switch (playwright.docker.config.ts), Playwright's main process (its
 * `--output` path carries the run id), anything recorded under Playwright's
 * tree while it ran (same pid AND same command line, so a reused pid doesn't
 * match), and every child of those (win32 keeps a dead parent's pid as
 * ParentProcessId; on POSIX, Chromium runs in its own process group).
 */
function findRunProcesses(procs) {
  const marker = `--axoview-regress-run=${state.runId}`;
  const outMarker = `docker-${state.runId}`;
  const hits = new Map();
  const add = (p, why) => {
    if (p.pid !== process.pid && !hits.has(p.pid)) hits.set(p.pid, { ...p, why });
  };
  for (const p of procs) {
    if (p.cmd.includes(marker)) add(p, "Chromium launched by this run's Playwright");
    else if (p.cmd.includes(outMarker) && /playwright/i.test(p.cmd)) add(p, "this run's Playwright");
    else {
      const seen = state.tracked.get(p.pid);
      if (seen && seen.cmd === p.cmd) add(p, `recorded under this run's Playwright (${seen.name || 'process'})`);
    }
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of procs) {
      if (hits.has(p.pid) || p.pid === process.pid) continue;
      const parent = hits.get(p.ppid);
      const leader = !IS_WIN && p.pgid ? hits.get(p.pgid) : null;
      if (parent || (leader && leader.pgid === leader.pid)) {
        add(p, parent ? `child of leaked ${p.ppid}` : `in leaked process group ${p.pgid}`);
        grew = true;
      }
    }
  }
  return [...hits.values()];
}

function killHint(pid) {
  return IS_WIN ? `taskkill /pid ${pid} /T /F` : `kill -9 ${pid}`;
}

function groupAlive(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

/** Kill a whole process tree. Synchronous, safe to call twice. */
function killTreeSync(pid) {
  if (!pid) return;
  if (IS_WIN) {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 30_000 });
    return;
  }
  // POSIX: our children were spawned detached, so each leads its own group.
  // SIGINT first, as a terminal Ctrl+C would: Playwright stops, its launcher
  // closes the browsers it started (they run in process groups of their own)
  // and the reporters still write what ran. SIGKILL after a short grace.
  try {
    process.kill(-pid, 'SIGINT');
  } catch {
    return; // group already gone
  }
  const deadline = Date.now() + KILL_GRACE_MS;
  while (Date.now() < deadline && groupAlive(pid)) sleepSync(200);
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    /* gone */
  }
}

function killOne(p) {
  if (IS_WIN) {
    spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 30_000 });
    return;
  }
  try {
    if (p.pgid && p.pgid === p.pid) process.kill(-p.pid, 'SIGKILL');
  } catch {
    /* gone */
  }
  try {
    process.kill(p.pid, 'SIGKILL');
  } catch {
    /* gone */
  }
}

// ---------------------------------------------------------------------------
// Child processes (spawned as trees we can kill)
// ---------------------------------------------------------------------------

function spawnTracked(command, args, { label, env, cwd = ROOT }) {
  const child = spawn(command, args, {
    cwd,
    env: env || process.env,
    stdio: 'inherit',
    detached: !IS_WIN,
    windowsHide: true
  });
  if (child.pid) state.children.set(child.pid, label);
  const done = new Promise((resolve) => {
    child.on('error', (err) => {
      fail(`${label}: ${err.message}`);
      resolve(-1);
    });
    child.on('exit', (code, signal) => {
      resolve(code === null ? (signal ? 128 : 1) : code);
    });
  });
  done.then(() => state.children.delete(child.pid));
  return { child, done };
}

// ---------------------------------------------------------------------------
// Docker
// ---------------------------------------------------------------------------

function inspectState(name) {
  const r = docker(['inspect', '-f', '{{json .State}}', name], { timeout: 30_000 });
  if (!r.ok) return null;
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
}

function describeState(s) {
  if (!s) return 'gone';
  const health = s.Health && s.Health.Status ? `, health ${s.Health.Status}` : '';
  const oom = s.OOMKilled ? ', OOM-killed' : '';
  return `${s.Status}${health}, exit ${s.ExitCode}${oom}`;
}

function listLabelled(kind) {
  if (kind === 'containers') {
    const r = docker(['ps', '-a', '--filter', `label=${LABEL}`, '--format', `{{.Names}}\t{{.Label "${LABEL}"}}\t{{.Status}}`]);
    if (!r.ok) return null;
    return r.stdout.split('\n').filter(Boolean).map((l) => {
      const [name, run, status] = l.split('\t');
      return { name, run, status };
    });
  }
  if (kind === 'volumes') {
    const r = docker(['volume', 'ls', '--filter', `label=${LABEL}`, '--format', `{{.Name}}\t{{.Label "${LABEL}"}}`]);
    if (!r.ok) return null;
    return r.stdout.split('\n').filter(Boolean).map((l) => {
      const [name, run] = l.split('\t');
      return { name, run };
    });
  }
  const r = docker(['images', '--filter', 'reference=axoview:regress-*', '--format', '{{.Repository}}:{{.Tag}}']);
  if (!r.ok) return null;
  return [...new Set(r.stdout.split('\n').filter(Boolean))].map((name) => ({
    name,
    run: name.replace(/^axoview:regress-/, '')
  }));
}

function saveContainerLogs(name, dir) {
  if (state.logsSaved.has(name) || !dir) return;
  state.logsSaved.add(name);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const logs = docker(['logs', '--timestamps', name], { timeout: 60_000 });
    const body =
      `# docker logs --timestamps ${name}\n# saved by scripts/e2e-docker.js before teardown\n\n` +
      `## stdout\n${logs.stdout}\n## stderr\n${logs.stderr}\n`;
    fs.writeFileSync(path.join(dir, 'container.log'), body);
    const inspect = docker(['inspect', name], { timeout: 30_000 });
    if (inspect.ok) fs.writeFileSync(path.join(dir, 'container-inspect.json'), inspect.stdout);
  } catch (e) {
    warn(`could not save logs for ${name}: ${e.message}`);
  }
}

function removeContainer(name) {
  docker(['rm', '-f', '-v', name], { timeout: 60_000 });
  state.containers.delete(name);
}

function httpStatus(url, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.get(url, { agent: false, timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (e) => resolve(e.code || e.message));
  });
}

function portInUse(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

// ---------------------------------------------------------------------------
// Preflight: Docker, lock, single instance
// ---------------------------------------------------------------------------

const CLEANUP_COMMANDS = [
  'git-bash:',
  `  docker rm -f $(docker ps -aq --filter label=${LABEL})`,
  `  docker volume rm $(docker volume ls -q --filter label=${LABEL})`,
  "  docker rmi $(docker images -q 'axoview:regress-*')",
  'PowerShell:',
  `  docker ps -aq --filter label=${LABEL} | ForEach-Object { docker rm -f $_ }`,
  `  docker volume ls -q --filter label=${LABEL} | ForEach-Object { docker volume rm $_ }`,
  "  docker images -q 'axoview:regress-*' | ForEach-Object { docker rmi -f $_ }"
].join('\n');

function refuse(msg, extra) {
  fail(`refusing to start: ${msg}`);
  if (extra) console.error(extra);
  releaseLock();
  process.exit(EXIT.HARNESS);
}

function checkDocker() {
  const r = docker(['info', '--format', '{{.ServerVersion}}'], { timeout: 60_000 });
  if (r.error && r.error.code === 'ENOENT') {
    fail('the docker CLI is not on PATH. Install Docker (Desktop) and retry.');
    process.exit(EXIT.HARNESS);
  }
  if (!r.ok || !r.stdout.trim()) {
    fail(`Docker is not running (docker info failed: ${firstLines(r.stderr, 300) || 'no output'}). Start Docker and retry.`);
    process.exit(EXIT.HARNESS);
  }
  return r.stdout.trim();
}

function acquireLock() {
  const payload = JSON.stringify(
    { pid: process.pid, runId: state.runId, suite: state.opts.suite, startedAt: state.startedAt.toISOString() },
    null,
    2
  );
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      fs.writeFileSync(LOCK_PATH, payload, { flag: 'wx' });
      state.lockOwned = true;
      return;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      let held = null;
      try {
        held = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
      } catch {
        /* unreadable: treat as stale */
      }
      if (held && pidAlive(Number(held.pid))) {
        refuse(
          `another Docker E2E run holds ${rel(LOCK_PATH)} (pid ${held.pid}, run ${held.runId}, started ${held.startedAt}).`,
          `One heavy stream at a time. Wait for it, or stop it (${killHint(held.pid)}) and let it clean up.\n` +
            `If that pid is not an e2e-docker run, delete ${rel(LOCK_PATH)} by hand.`
        );
      }
      warn(`removing a stale lock from pid ${held ? held.pid : '?'} (not running)`);
      fs.rmSync(LOCK_PATH, { force: true });
    }
  }
  refuse(`could not create ${rel(LOCK_PATH)}`);
}

function releaseLock() {
  if (!state.lockOwned) return;
  try {
    const held = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
    if (held.runId === state.runId) fs.rmSync(LOCK_PATH, { force: true });
  } catch {
    /* already gone */
  }
  state.lockOwned = false;
}

function preflightSingleInstance() {
  const containers = listLabelled('containers');
  if (containers === null) refuse('could not list containers (docker ps failed)');
  if (containers.length) {
    refuse(
      `${containers.length} container(s) labelled ${LABEL} exist:\n` +
        containers.map((c) => `  ${c.name} (run ${c.run}, ${c.status})`).join('\n'),
      `Another run is active, or one died without cleaning up. Remove them first:\n${CLEANUP_COMMANDS}`
    );
  }
  // A browser still carrying any run's marker is a heavy stream still running
  // (or a leak): either way, starting another one is what froze the machine.
  const procs = listProcessesSync();
  if (procs) {
    const marked = procs.filter((p) => p.pid !== process.pid && /--axoview-regress-run=/.test(p.cmd));
    if (marked.length) {
      refuse(
        `${marked.length} Chromium process(es) from an earlier Docker E2E run are still alive.`,
        marked.map((p) => `  ${p.pid} ${p.name} → ${killHint(p.pid)}`).join('\n')
      );
    }
  } else {
    warn('could not list processes; skipping the stray-browser check');
  }
  const volumes = listLabelled('volumes') || [];
  const images = listLabelled('images') || [];
  if (volumes.length || images.length) {
    warn(
      `left over from earlier runs (not from this one; this run's audit ignores them): ` +
        [...volumes.map((v) => `volume ${v.name}`), ...images.map((i) => `image ${i.name}`)].join(', ') +
        `\n${CLEANUP_COMMANDS}`
    );
  }
}

// ---------------------------------------------------------------------------
// Plan + ETA
// ---------------------------------------------------------------------------

function printPlan(phases, dockerVersion) {
  const o = state.opts;
  const shardN = o.shard ? Number(o.shard.split('/')[1]) : 1;
  const build = o.image ? 'none (--image)' : '~3-6 min image build (estimate; the build cache makes repeats faster)';
  let tests;
  if (o.suite === 'full') {
    const minutes = Math.round(FULL_MINUTES_LOCAL / shardN);
    tests = o.files.length
      ? `${o.files.length} spec file(s): budget ~${Math.round((FULL_MINUTES_LOCAL * 60) / FULL_TESTS)} s per test (measured average) + ~30 s container boot`
      : `~${minutes} min for ${o.shard ? `shard ${o.shard} (~${Math.round(FULL_TESTS / shardN)} of ~${FULL_TESTS} tests)` : `~${FULL_TESTS} tests`} at 1 worker (measured locally 2026-09-24: ~${FULL_MINUTES_LOCAL} min for the whole suite)`;
  } else {
    tests = '~2-4 min: 2 container boots (~15 s each) + ~8 smoke tests at 1 worker (estimate, not yet measured)';
  }
  log(`run ${state.runId} · suite=${o.suite}${o.shard ? ` · shard ${o.shard}` : ''}${o.files.length ? ` · files ${o.files.join(',')}` : ''} · Docker ${dockerVersion}`);
  log(`image: ${o.image ? `${o.image} (given; never removed)` : `axoview:regress-${state.runId} (built here, removed at the end)`}`);
  log(`ETA: build ${build}; tests ${tests}.`);
  log('resource plan (one heavy stream at a time: do not start another Playwright run or image build until this exits):');
  for (const p of phases) {
    log(
      `  phase ${p.name}: 1 container (--cpus=2 --memory=2g, storage ${p.storage ? `ON${o.volume ? ', labelled volume' : ', no volume'}` : 'OFF'}) ` +
        `on http://localhost:${state.port} → projects ${p.projects.join(' + ')}, workers=1, video off, traces on failure`
    );
  }
  log(`output: ${rel(state.runDir)}/ (summary.json is the verdict) · lock: ${rel(LOCK_PATH)}`);
}

// ---------------------------------------------------------------------------
// Build, run, wait, Playwright
// ---------------------------------------------------------------------------

async function buildImage() {
  let version;
  try {
    // Same call as the workflows' `node -p "require('./scripts/resolve-version')(...)"`.
    version = resolveVersion(ROOT_PACKAGE.version);
  } catch (e) {
    throw new HarnessError(`could not resolve the version for AXOVIEW_VERSION: ${e.message}`);
  }
  const tag = `axoview:regress-${state.runId}`;
  state.image = tag;
  state.builtImage = true; // before the build: cleanup must remove a half-finished tag too
  log(`building ${tag} with AXOVIEW_VERSION=${version} (docker build .) ...`);
  const t0 = Date.now();
  const { done } = spawnTracked('docker', ['build', '-t', tag, '--build-arg', `AXOVIEW_VERSION=${version}`, '.'], {
    label: 'docker build'
  });
  const code = await done;
  if (state.abort) return;
  if (code !== 0) throw new HarnessError(`docker build failed (exit ${code})`);
  log(`built ${tag} in ${Math.round((Date.now() - t0) / 1000)} s`);
}

function ensureVolume() {
  if (state.volume) return state.volume;
  const name = `axoview-regress-${state.runId}`;
  state.volume = name; // before create: cleanup removes it either way
  const r = docker(['volume', 'create', '--label', `${LABEL}=${state.runId}`, name]);
  if (!r.ok) throw new HarnessError(`docker volume create failed: ${firstLines(r.stderr)}`);
  return name;
}

function startContainer(phase) {
  const name = `axoview-regress-${state.runId}-${phase.name}`;
  state.containers.add(name); // before run: a failed run can leave a Created container
  const args = [
    'run', '-d',
    '--name', name,
    '--label', `${LABEL}=${state.runId}`,
    '--cpus=2', '--memory=2g',
    // Only the probe cadence is overridden, never the image (ADR 0048 §2).
    '--health-interval=2s',
    // Loopback only: storage ON with AUTH_MODE=none must not face the LAN.
    '-p', `127.0.0.1:${state.port}:80`
  ];
  // Storage ON is the image's default; OFF is the one runtime switch. No
  // ALLOWED_ORIGINS override: the own-origin rule must pass on its own.
  if (!phase.storage) args.push('-e', 'ENABLE_SERVER_STORAGE=false');
  if (phase.storage && state.opts.volume) args.push('-v', `${ensureVolume()}:/data/diagrams`);
  args.push(state.image);
  const r = docker(args);
  if (!r.ok) throw new HarnessError(`docker run failed: ${firstLines(r.stderr)}`);
  return name;
}

async function waitReady(container) {
  const t0 = Date.now();
  const url = `http://127.0.0.1:${state.port}/api/config`;
  let lastApi = 'no answer yet';
  let lastHealth = 'unknown';
  let lastReport = 0;
  while (Date.now() - t0 < WAIT_TIMEOUT_MS) {
    if (state.abort) return { ok: false, died: false, reason: state.abort.reason };
    const s = inspectState(container);
    if (!s || !s.Running) {
      return { ok: false, died: true, reason: `container ${container} stopped while starting (${describeState(s)})` };
    }
    lastHealth = (s.Health && s.Health.Status) || 'no healthcheck';
    // Through nginx: this also rides out nginx's startup `no live upstreams`
    // 502s while the backend binds.
    lastApi = await httpStatus(url, 2_000);
    if (lastApi === 200 && lastHealth === 'healthy') return { ok: true, ms: Date.now() - t0 };
    if (Date.now() - lastReport > 10_000) {
      lastReport = Date.now();
      log(`  waiting for ${container}: /api/config → ${lastApi}, health → ${lastHealth}`);
    }
    await sleep(1_000);
  }
  return {
    ok: false,
    died: false,
    reason: `${container} not ready after ${WAIT_TIMEOUT_MS / 1000} s: /api/config → ${lastApi}, health → ${lastHealth}`
  };
}

function abortRun(code, reason) {
  if (state.abort) return;
  state.abort = { code, reason };
  fail(`ABORT: ${reason}`);
  if (state.playwright) {
    fail('stopping the Playwright process tree');
    const procs = listProcessesSync();
    recordTree(state.playwright.pid, procs);
    killTreeSync(state.playwright.pid);
  }
}

function startTimer(fn, ms) {
  const t = setInterval(() => {
    Promise.resolve()
      .then(fn)
      .catch((e) => warn(`timer: ${e.message}`));
  }, ms);
  state.timers.add(t);
  return t;
}

function stopTimer(t) {
  clearInterval(t);
  state.timers.delete(t);
}

/**
 * The Playwright CLI file of the e2e workspace's @playwright/test, by path —
 * the same way the root `test:e2e` scripts call `node_modules/.bin/playwright`
 * (the dependency belongs to packages/axoview-e2e; npm hoists it to the root).
 */
function playwrightCli() {
  const candidates = [
    path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js'),
    path.join(ROOT, 'packages', 'axoview-e2e', 'node_modules', '@playwright', 'test', 'cli.js')
  ];
  const cli = candidates.find((p) => fs.existsSync(p));
  if (!cli) throw new HarnessError('@playwright/test is not installed (no cli.js found). Run `npm ci` first.');
  return cli;
}

async function runPlaywright(phase, phaseDir, container) {
  const cli = playwrightCli();
  const args = [cli, 'test', '--config', CONFIG, '--output', path.join(phaseDir, 'artifacts')];
  for (const p of phase.projects) args.push('--project', p);
  if (state.opts.shard) args.push(`--shard=${state.opts.shard}`);
  args.push(...state.opts.passthrough, ...phase.files);

  const env = {
    ...process.env,
    AXOVIEW_BASE_URL: `http://localhost:${state.port}`,
    AXOVIEW_E2E_OUT: phaseDir,
    AXOVIEW_REGRESS_RUN: state.runId
  };
  log(`phase ${phase.name}: playwright test --project ${phase.projects.join(' --project ')}${state.opts.shard ? ` --shard=${state.opts.shard}` : ''}${phase.files.length ? ` ${phase.files.join(' ')}` : ''}`);
  const { child, done } = spawnTracked(process.execPath, args, { label: 'playwright', env });
  state.playwright = { pid: child.pid };

  let unhealthy = 0;
  const watchdog = startTimer(() => {
    if (state.abort) return;
    const s = inspectState(container);
    if (!s || !s.Running) {
      abortRun(EXIT.CONTAINER, `container ${container} died during the tests (${describeState(s)})`);
      return;
    }
    if (s.Health && s.Health.Status === 'unhealthy') {
      unhealthy += 1;
      warn(`${container} is unhealthy (${unhealthy}/${UNHEALTHY_TICKS_TO_ABORT})`);
      if (unhealthy >= UNHEALTHY_TICKS_TO_ABORT) {
        abortRun(EXIT.CONTAINER, `container ${container} unhealthy for ${(UNHEALTHY_TICKS_TO_ABORT * WATCHDOG_MS) / 1000} s`);
      }
    } else {
      unhealthy = 0;
    }
  }, WATCHDOG_MS);
  const tracker = startTimer(trackTick, TRACK_MS);
  setTimeout(() => {
    trackTick().catch(() => {});
  }, 3_000).unref();

  const code = await done;
  stopTimer(watchdog);
  stopTimer(tracker);
  state.playwright = null;
  return code;
}

async function runPhase(phase) {
  const dir = path.join(state.runDir, phase.name);
  const rec = {
    name: phase.name,
    storage: phase.storage ? 'on' : 'off',
    volume: phase.storage ? state.opts.volume : false,
    projects: phase.projects,
    files: phase.files,
    dir,
    container: null,
    readySeconds: null,
    playwrightExit: null,
    startedAt: new Date().toISOString(),
    finishedAt: null
  };
  state.phases.push(rec);
  fs.mkdirSync(dir, { recursive: true });

  log(`phase ${phase.name}: starting a storage-${rec.storage.toUpperCase()} container`);
  const container = startContainer(phase);
  rec.container = container;
  const ready = await waitReady(container);
  if (!ready.ok) {
    saveContainerLogs(container, dir);
    if (ready.died) abortRun(EXIT.CONTAINER, ready.reason);
    else if (!state.abort) throw new HarnessError(ready.reason);
    return;
  }
  rec.readySeconds = Math.round(ready.ms / 100) / 10;
  log(`phase ${phase.name}: ${container} ready in ${rec.readySeconds} s (/api/config 200, healthy)`);

  rec.playwrightExit = await runPlaywright(phase, dir, container);
  rec.finishedAt = new Date().toISOString();
  saveContainerLogs(container, dir);
  removeContainer(container);
}

// ---------------------------------------------------------------------------
// Results: Playwright JSON → summary
// ---------------------------------------------------------------------------

function emptyTotals() {
  return { tests: 0, passed: 0, failed: 0, flaky: 0, expectedFail: 0, skipped: 0, didNotRun: 0, interrupted: 0, globalErrors: 0 };
}

function addTotals(into, from) {
  for (const k of Object.keys(into)) into[k] += from[k] || 0;
  return into;
}

/**
 * Playwright's JSON reporter gives each test `expectedStatus` (what the spec
 * declares: `test.fail()` makes it 'failed') and `status`, the outcome:
 * 'expected' | 'unexpected' | 'flaky' | 'skipped'. So a `test.fail()` repro that
 * fails as declared is `status: 'expected'` — an expected-fail, NOT a failure,
 * even though the list reporter prints it with an `x`. A `test.fail()` that
 * starts passing is 'unexpected', which is a failure, as it should be.
 * 'skipped' mixes three cases: a declared skip (expectedStatus 'skipped'), a
 * test that never ran, and an interrupted one; only the first is benign.
 */
function summarizeReport(report) {
  const totals = emptyTotals();
  const failures = [];
  const flaky = [];
  const expectedFail = [];
  const notRun = [];
  const visit = (suite, titles) => {
    for (const spec of suite.specs || []) {
      for (const t of spec.tests || []) {
        totals.tests += 1;
        const results = t.results || [];
        const last = results[results.length - 1];
        const entry = {
          project: t.projectName,
          file: spec.file,
          line: spec.line,
          title: [...titles, spec.title].filter(Boolean).join(' › ')
        };
        if (t.status === 'expected') {
          if (t.expectedStatus === 'failed') {
            totals.expectedFail += 1;
            expectedFail.push(entry);
          } else {
            totals.passed += 1;
          }
        } else if (t.status === 'flaky') {
          totals.flaky += 1;
          flaky.push(entry);
        } else if (t.status === 'unexpected') {
          totals.failed += 1;
          failures.push({
            ...entry,
            status: last ? last.status : 'unknown',
            expectedStatus: t.expectedStatus,
            error: last && last.error ? firstLines(last.error.message || last.error.value) : ''
          });
        } else if (t.expectedStatus === 'skipped') {
          totals.skipped += 1;
        } else if (results.some((r) => r.status === 'interrupted')) {
          totals.interrupted += 1;
          notRun.push({ ...entry, reason: 'interrupted' });
        } else {
          totals.didNotRun += 1;
          notRun.push({ ...entry, reason: 'did not run' });
        }
      }
    }
    for (const child of suite.suites || []) visit(child, [...titles, child.title]);
  };
  // Top-level suites are files; their title is the file path, not a describe.
  for (const fileSuite of report.suites || []) visit(fileSuite, []);
  const errors = (report.errors || []).map((e) => firstLines(e.message || e.value || JSON.stringify(e)));
  totals.globalErrors = errors.length;
  return { totals, failures, flaky, expectedFail, notRun, errors };
}

function summarizePhase(rec) {
  const file = path.join(rec.dir, 'results.json');
  const out = {
    name: rec.name,
    storage: rec.storage,
    volume: rec.volume,
    projects: rec.projects,
    files: rec.files,
    container: rec.container,
    readySeconds: rec.readySeconds,
    playwrightExit: rec.playwrightExit,
    results: fs.existsSync(file) ? rel(file) : null,
    ok: false,
    totals: null,
    failures: [],
    flaky: [],
    expectedFail: [],
    notRun: [],
    errors: []
  };
  if (!out.results) {
    out.errors.push(
      rec.playwrightExit === null ? 'Playwright never ran in this phase' : `no results.json (Playwright exit ${rec.playwrightExit})`
    );
    return out;
  }
  try {
    Object.assign(out, summarizeReport(JSON.parse(fs.readFileSync(file, 'utf8'))));
  } catch (e) {
    out.errors.push(`could not read results.json: ${e.message}`);
    out.totals = null;
    return out;
  }
  const t = out.totals;
  out.ok =
    rec.playwrightExit === 0 && t.tests > 0 && t.failed === 0 && t.globalErrors === 0 && t.didNotRun === 0 && t.interrupted === 0;
  return out;
}

function computeExit(phaseSummaries, totals) {
  if (state.abort) return state.abort.code;
  if (state.harnessError) return EXIT.HARNESS;
  if (!phaseSummaries.length || phaseSummaries.some((p) => !p.totals)) return EXIT.HARNESS;
  if (totals.tests === 0) return EXIT.HARNESS;
  return phaseSummaries.every((p) => p.ok) ? EXIT.PASS : EXIT.TESTS;
}

// ---------------------------------------------------------------------------
// Cleanup, leak audit, finish
// ---------------------------------------------------------------------------

/** Tear down everything this run made. Synchronous and idempotent. */
function cleanupSync() {
  if (state.cleanedUp) return;
  state.cleanedUp = true;
  // Each step runs even if an earlier one threw; the audit reports what's left.
  const step = (what, fn) => {
    try {
      fn();
    } catch (e) {
      warn(`cleanup: ${what} failed: ${e && e.message ? e.message : e}`);
    }
  };

  step('timers', () => {
    for (const t of state.timers) clearInterval(t);
    state.timers.clear();
  });

  step('process trees', () => {
    if (!state.children.size) return;
    const procs = listProcessesSync();
    for (const [pid, label] of [...state.children]) {
      if (label === 'playwright') recordTree(pid, procs);
      log(`cleanup: killing the ${label} process tree (pid ${pid})`);
      killTreeSync(pid);
      state.children.delete(pid);
    }
  });

  // Orphans (a worker or browser whose parent died first) are in no tree the
  // kills above reached. Find them by marker and by the recorded tree.
  step('orphan sweep', () => {
    const procs = listProcessesSync();
    if (!procs) return;
    const survivors = findRunProcesses(procs);
    for (const p of survivors) {
      log(`cleanup: killing orphaned ${p.name || 'process'} ${p.pid} (${p.why})`);
      killOne(p);
    }
    state.swept = survivors.map((p) => ({ pid: p.pid, name: p.name, why: p.why }));
  });

  for (const name of [...state.containers]) {
    step(`container ${name}`, () => {
      const phase = state.phases.find((p) => p.container === name);
      saveContainerLogs(name, phase ? phase.dir : state.runDir);
      log(`cleanup: removing container ${name}`);
      removeContainer(name);
    });
  }
  step('volume', () => {
    if (!state.volume) return;
    log(`cleanup: removing volume ${state.volume}`);
    docker(['volume', 'rm', '-f', state.volume], { timeout: 60_000 });
  });
  // Only an image this run built. An --image it was given is never touched.
  step('image', () => {
    if (!state.builtImage || !state.image) return;
    log(`cleanup: removing image ${state.image}`);
    docker(['rmi', '-f', state.image], { timeout: 120_000 });
  });
}

function leakAuditSync() {
  const leaks = [];
  const warnings = [];
  let processes = [];
  let listed = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const procs = listProcessesSync();
    if (!procs) break;
    listed = true;
    processes = findRunProcesses(procs);
    if (!processes.length) break;
    sleepSync(2_000); // a killed tree can take a moment to disappear
  }
  if (!listed) {
    leaks.push(`processes: could not list them (${IS_WIN ? 'Get-CimInstance Win32_Process' : 'ps'} failed), so none can be ruled out`);
  }
  for (const p of processes) {
    leaks.push(`process ${p.pid} ${p.name}: ${firstLines(p.cmd, 160)} [${p.why}] → ${killHint(p.pid)}`);
  }

  const check = (kind, isOurs, describe) => {
    const items = listLabelled(kind);
    if (items === null) {
      leaks.push(`${kind}: could not list them (is Docker still running?)`);
      return;
    }
    for (const item of items) {
      if (isOurs(item)) leaks.push(`${kind.slice(0, -1)} ${describe(item)} → ${removeHint(kind, item.name)}`);
      else warnings.push(`${kind.slice(0, -1)} ${describe(item)} belongs to run ${item.run}, not this one`);
    }
  };
  const removeHint = (kind, name) =>
    kind === 'containers' ? `docker rm -f ${name}` : kind === 'volumes' ? `docker volume rm ${name}` : `docker rmi -f ${name}`;
  check('containers', (c) => c.run === state.runId, (c) => `${c.name} (${c.status})`);
  check('volumes', (v) => v.run === state.runId, (v) => v.name);
  check('images', (i) => i.name === `axoview:regress-${state.runId}`, (i) => i.name);

  return { clean: leaks.length === 0, leaks, warnings, swept: state.swept };
}

function printAudit(audit) {
  log(`── leak audit (run ${state.runId}) ──`);
  if (audit.swept.length) {
    log(`  cleanup killed ${audit.swept.length} orphaned process(es): ${audit.swept.map((p) => `${p.pid} ${p.name}`).join(', ')}`);
  }
  if (audit.clean) {
    log('  processes: none from this run · containers: none · volumes: none · images: none');
  } else {
    for (const l of audit.leaks) fail(`  LEAK ${l}`);
  }
  for (const w of audit.warnings) warn(`  ${w}`);
  log(`leak audit: ${audit.clean ? 'CLEAN' : `FAILED (${audit.leaks.length} leak(s); exit ${EXIT.LEAK})`}`);
}

function writeSummary(exitCode, audit, phaseSummaries, totals) {
  const collect = (key) => phaseSummaries.flatMap((p) => p[key].map((x) => ({ phase: p.name, ...x })));
  const summary = {
    schema: 1,
    runId: state.runId,
    suite: state.opts.suite,
    shard: state.opts.shard,
    files: state.opts.files,
    image: state.image,
    imageBuiltByRunner: state.builtImage,
    port: state.port,
    platform: process.platform,
    ci: !!process.env.CI,
    startedAt: state.startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - state.startedAt.getTime()) / 1000),
    verdict: exitCode === EXIT.PASS ? 'pass' : 'fail',
    exitCode,
    // The headline number: tests whose outcome was 'unexpected'. test.fail()
    // repros that failed as declared are in expectedFail, not here.
    unexpectedFailures: totals.failed,
    totals,
    abort: state.abort,
    harnessError: state.harnessError,
    failures: collect('failures'),
    flaky: collect('flaky'),
    expectedFail: collect('expectedFail'),
    notRun: collect('notRun'),
    errors: phaseSummaries.flatMap((p) => p.errors.map((message) => ({ phase: p.name, message }))),
    phases: phaseSummaries.map((p) => ({
      name: p.name,
      storage: p.storage,
      volume: p.volume,
      projects: p.projects,
      files: p.files,
      container: p.container,
      readySeconds: p.readySeconds,
      playwrightExit: p.playwrightExit,
      results: p.results,
      ok: p.ok,
      totals: p.totals
    })),
    leakAudit: audit
  };
  try {
    fs.mkdirSync(state.runDir, { recursive: true });
    fs.writeFileSync(path.join(state.runDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  } catch (e) {
    warn(`could not write summary.json: ${e.message}`);
  }
  return summary;
}

function printResult(summary) {
  const t = summary.totals;
  for (const f of summary.failures.slice(0, 40)) {
    fail(`  FAILED [${f.project}] ${f.file}:${f.line} ${f.title}${f.error ? `\n         ${f.error.split('\n')[0]}` : ''}`);
  }
  if (summary.failures.length > 40) fail(`  ... and ${summary.failures.length - 40} more (summary.json)`);
  for (const e of summary.errors) fail(`  ERROR [${e.phase}] ${e.message.split('\n')[0]}`);
  if (summary.abort) fail(`  ABORTED: ${summary.abort.reason}`);
  if (summary.harnessError) fail(`  HARNESS: ${firstLines(summary.harnessError, 300)}`);
  const line =
    `RESULT ${summary.verdict.toUpperCase()} · ${summary.unexpectedFailures} unexpected failure(s) · ` +
    `${t.passed} passed · ${t.flaky} flaky · ${t.expectedFail} expected-fail · ${t.skipped} skipped · ` +
    `${t.didNotRun + t.interrupted} did not run · exit ${summary.exitCode} · ${rel(path.join(state.runDir, 'summary.json'))}`;
  (summary.verdict === 'pass' ? log : fail)(line);
}

/** The single way out once the lock is held. Synchronous, runs once. */
function finalize() {
  if (state.finalizing) return;
  state.finalizing = true;
  // If teardown itself breaks, nothing vouches for a clean machine: exit 4.
  let exitCode = EXIT.LEAK;
  try {
    cleanupSync();
    const audit = leakAuditSync();
    printAudit(audit);
    const phaseSummaries = state.phases.map(summarizePhase);
    const totals = phaseSummaries.reduce((acc, p) => (p.totals ? addTotals(acc, p.totals) : acc), emptyTotals());
    exitCode = audit.clean ? computeExit(phaseSummaries, totals) : EXIT.LEAK;
    printResult(writeSummary(exitCode, audit, phaseSummaries, totals));
  } catch (e) {
    fail(`teardown failed, so the leak audit cannot vouch for this machine: ${e && e.stack ? e.stack : e}`);
    fail(`check by hand:\n${CLEANUP_COMMANDS}`);
  } finally {
    releaseLock();
    process.exit(exitCode);
  }
}

function installHandlers() {
  const onSignal = (sig) => {
    if (state.finalizing) return;
    fail(`${sig} received: cleaning up and auditing (don't interrupt again; it takes a few seconds)`);
    if (!state.abort) state.abort = { code: EXIT.HARNESS, reason: `interrupted (${sig})` };
    finalize();
  };
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', ...(IS_WIN ? ['SIGBREAK'] : [])]) {
    process.on(sig, () => onSignal(sig));
  }
  process.on('uncaughtException', (err) => {
    fail(`uncaught error: ${err && err.stack ? err.stack : err}`);
    if (!state.harnessError) state.harnessError = `uncaught: ${err && err.message ? err.message : err}`;
    finalize();
  });
  process.on('unhandledRejection', (err) => {
    fail(`unhandled rejection: ${err && err.stack ? err.stack : err}`);
    if (!state.harnessError) state.harnessError = `unhandled rejection: ${err && err.message ? err.message : err}`;
    finalize();
  });
  // Last resort for a process.exit() that bypassed finalize(): still tear down.
  process.on('exit', () => {
    if (state.finalizing) return;
    cleanupSync();
    releaseLock();
  });
}

// ---------------------------------------------------------------------------
// Aggregate mode (CI summary job): merge per-shard summary.json files
// ---------------------------------------------------------------------------

function findSummaries(dir) {
  const found = [];
  const walk = (d) => {
    let entries = [];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'summary.json') found.push(p);
    }
  };
  walk(dir);
  return found.sort();
}

function aggregate(opts) {
  const files = findSummaries(opts.aggregate);
  const shards = [];
  for (const f of files) {
    try {
      shards.push(JSON.parse(fs.readFileSync(f, 'utf8')));
    } catch (e) {
      fail(`skipping unreadable ${f}: ${e.message}`);
    }
  }
  shards.sort((a, b) => String(a.shard || '').localeCompare(String(b.shard || ''), undefined, { numeric: true }));
  const totals = emptyTotals();
  for (const s of shards) addTotals(totals, s.totals || {});
  const tag = (s) => s.shard || s.runId;
  const pick = (key) => shards.flatMap((s) => (s[key] || []).map((x) => ({ shard: tag(s), ...x })));
  const missing = opts.expectShards ? Math.max(0, opts.expectShards - shards.length) : 0;
  const verdict = shards.length > 0 && missing === 0 && shards.every((s) => s.verdict === 'pass') ? 'pass' : 'fail';
  const merged = {
    schema: 1,
    kind: 'aggregate',
    verdict,
    unexpectedFailures: totals.failed,
    totals,
    shardsReported: shards.length,
    shardsExpected: opts.expectShards,
    shards: shards.map((s) => ({
      shard: s.shard,
      runId: s.runId,
      verdict: s.verdict,
      exitCode: s.exitCode,
      durationSeconds: s.durationSeconds,
      unexpectedFailures: s.unexpectedFailures,
      totals: s.totals,
      abort: s.abort,
      harnessError: s.harnessError,
      leakAuditClean: s.leakAudit ? s.leakAudit.clean : null
    })),
    failures: pick('failures'),
    flaky: pick('flaky'),
    expectedFail: pick('expectedFail'),
    notRun: pick('notRun'),
    errors: pick('errors')
  };
  const out = opts.out || path.resolve('docker-regression-summary.json');
  fs.writeFileSync(out, `${JSON.stringify(merged, null, 2)}\n`);

  // Backslashes first, so an input `\|` can't turn the added escape into a
  // literal backslash followed by a live column separator.
  const cell = (s) => String(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const md = [];
  md.push(`## Docker regression — ${verdict.toUpperCase()}`);
  md.push('');
  md.push(
    `**${totals.failed} unexpected failure(s)** · ${totals.passed} passed · ${totals.flaky} flaky · ` +
      `${totals.expectedFail} expected-fail (\`test.fail()\`) · ${totals.skipped} skipped · ` +
      `${totals.didNotRun + totals.interrupted} did not run · ${shards.length}${opts.expectShards ? `/${opts.expectShards}` : ''} shard(s) reported`
  );
  if (missing) md.push('', `**${missing} shard(s) produced no summary** (the shard job failed before the runner wrote one).`);
  md.push('', '| Shard | Verdict | Exit | Passed | Failed | Flaky | Expected-fail | Did not run | Minutes | Leak audit |');
  md.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const s of merged.shards) {
    const t = s.totals || emptyTotals();
    md.push(
      `| ${cell(s.shard || s.runId)} | ${s.verdict} | ${s.exitCode} | ${t.passed} | ${t.failed} | ${t.flaky} | ${t.expectedFail} | ` +
        `${(t.didNotRun || 0) + (t.interrupted || 0)} | ${Math.round((s.durationSeconds || 0) / 6) / 10} | ${s.leakAuditClean === false ? 'LEAK' : 'clean'} |`
    );
  }
  if (merged.failures.length) {
    md.push('', '### Unexpected failures', '', '| File | Test | Project | Shard | Error |', '|---|---|---|---|---|');
    for (const f of merged.failures) {
      md.push(`| ${cell(`${f.file}:${f.line}`)} | ${cell(f.title)} | ${cell(f.project)} | ${cell(f.shard)} | ${cell((f.error || '').split('\n')[0].slice(0, 160))} |`);
    }
  }
  const problems = shards.filter((s) => s.abort || s.harnessError);
  if (problems.length) {
    md.push('', '### Aborted or harness errors', '');
    for (const s of problems) md.push(`- shard ${cell(tag(s))}: ${cell((s.abort && s.abort.reason) || s.harnessError)}`);
  }
  if (merged.errors.length) {
    md.push('', '### Run errors', '');
    for (const e of merged.errors) md.push(`- shard ${cell(e.shard)} (${cell(e.phase)}): ${cell(String(e.message).split('\n')[0])}`);
  }
  md.push('', `Merged JSON: \`${path.basename(out)}\`. Read it, not the list output: the list reporter prints \`test.fail()\` repros as \`x\` even when they fail as expected.`);
  const text = `${md.join('\n')}\n`;
  process.stdout.write(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  process.exit(EXIT.PASS);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function planPhases(opts) {
  const files = opts.files;
  const touchesOff = (f) => /boot-storage-off/.test(f);
  return PHASES[opts.suite]
    .filter((p) => {
      if (opts.suite !== 'smoke' || !files.length) return true;
      // --files on the smoke: skip a phase none of the files can land in.
      return p.storage ? files.some((f) => !touchesOff(f)) : files.some(touchesOff);
    })
    .map((p) => ({ ...p, files }));
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.aggregate) return aggregate(opts);

  state.opts = opts;
  state.runId = opts.runId || makeRunId();
  state.port = opts.port;
  state.runDir = path.join(ROOT, 'test-results', `docker-${state.runId}`);
  if (opts.suite === 'full' && !opts.volume) usageError('--no-volume applies to the smoke (storage ON) only');

  const dockerVersion = checkDocker();
  acquireLock();
  installHandlers();
  preflightSingleInstance();
  if (await portInUse(state.port)) {
    refuse(`something already listens on 127.0.0.1:${state.port}. Pick another --port (never 80 or 3000).`);
  }
  if (opts.image) {
    if (!docker(['image', 'inspect', opts.image]).ok) refuse(`image ${opts.image} does not exist locally`);
    state.image = opts.image;
  }

  const phases = planPhases(opts);
  if (!phases.length) usageError('--files matched no phase of this suite');
  fs.mkdirSync(state.runDir, { recursive: true });
  printPlan(phases, dockerVersion);

  try {
    if (!opts.image) await buildImage();
    for (const phase of phases) {
      if (state.abort) break;
      await runPhase(phase);
    }
  } catch (err) {
    if (!state.abort) {
      state.harnessError = err instanceof HarnessError ? err.message : err && err.stack ? err.stack : String(err);
      fail(`harness error: ${state.harnessError}`);
    }
  }
  finalize();
}

if (require.main === module) {
  main();
}

// For scripts/e2e-docker-attribute.js and for exercising the parsers without Docker.
module.exports = { summarizeReport, findSummaries, parsePsProcesses, parseWinProcesses, EXIT };
