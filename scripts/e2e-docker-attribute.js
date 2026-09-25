#!/usr/bin/env node
/**
 * Attribute the Docker regression's failures (ADR 0048 §5; docs/tactical/
 * docker-regression-gate.md B3). CI's `attribute` job runs it only when a shard
 * failed. It ANNOTATES; it never changes a conclusion: it always exits 0, and
 * the `Docker Regression Gate` job doesn't depend on it.
 *
 *   node scripts/e2e-docker-attribute.js --summaries=<dir> \
 *     --candidate=axoview:ci --baseline=axoview:master [--base-ref=origin/master] \
 *     [--max-files=8] [--out=attribution.json]
 *
 * The rule (tactical, "Reference facts"), applied per failing spec file:
 *   1. Re-run the file alone against the baseline (master) image, same mode.
 *      A test that fails there too is `pre-existing` (or environmental).
 *   2. For the rest, re-run the file alone against the candidate image. Still
 *      failing: `regression`. Passing now: `flake`.
 * A re-run that couldn't produce a verdict (harness error, container died,
 * leak) leaves its tests `unattributed`, with the reason.
 *
 * The re-runs go through scripts/e2e-docker.js one after another, so each one
 * takes the lock, labels what it creates and ends in its own leak audit — the
 * runner contract holds inside one CI job too.
 *
 * Caveat printed next to the label: the specs are the PR's. When the PR itself
 * changed a failing spec file, the master image may fail it for a legitimate
 * reason (a new test for a new feature), so "pre-existing" is flagged as not
 * comparable there.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { findSummaries } = require('./e2e-docker');

const ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(__dirname, 'e2e-docker.js');
const E2E_DIR = 'packages/axoview-e2e';

function parseArgs(argv) {
  const opts = { summaries: null, candidate: null, baseline: null, baseRef: 'origin/master', maxFiles: 8, out: null };
  for (const arg of argv) {
    const m = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'summaries') opts.summaries = path.resolve(value);
    else if (key === 'candidate') opts.candidate = value;
    else if (key === 'baseline') opts.baseline = value;
    else if (key === 'base-ref') opts.baseRef = value;
    else if (key === 'max-files') opts.maxFiles = Math.max(1, Number(value) || 8);
    else if (key === 'out') opts.out = path.resolve(value);
  }
  return opts;
}

const log = (msg) => console.log(`[attribute] ${msg}`);

const keyOf = (f) => `${f.project} :: ${f.title}`;

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** One isolated re-run of `file` against `image`. Returns its summary.json, or a reason. */
function rerun(image, file, runId) {
  log(`re-running ${file} against ${image} (run ${runId})`);
  const r = spawnSync(
    process.execPath,
    [RUNNER, '--suite=full', `--image=${image}`, `--files=${file}`, `--run-id=${runId}`],
    { cwd: ROOT, stdio: 'inherit', env: process.env }
  );
  const summary = readJson(path.join(ROOT, 'test-results', `docker-${runId}`, 'summary.json'));
  if (!summary) return { ok: false, reason: `the re-run wrote no summary (exit ${r.status})` };
  // 0 and 1 are verdicts about the tests; 2/3/4 mean the re-run itself broke.
  if (summary.exitCode !== 0 && summary.exitCode !== 1) {
    const why = (summary.abort && summary.abort.reason) || summary.harnessError || `exit ${summary.exitCode}`;
    return { ok: false, reason: `re-run against ${image} broke: ${String(why).split('\n')[0]}` };
  }
  return { ok: true, failed: new Set((summary.failures || []).map(keyOf)), summary };
}

function specChangedInPr(file, baseRef) {
  const r = spawnSync('git', ['diff', '--name-only', `${baseRef}...HEAD`, '--', `${E2E_DIR}/${file}`], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  if (r.status !== 0) return null; // unknown (no base ref fetched)
  return r.stdout.trim().length > 0;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const out = { schema: 1, kind: 'attribution', candidate: opts.candidate, baseline: opts.baseline, files: [], labels: [] };
  const lines = ['## Docker regression — failure attribution (advisory)', ''];

  if (!opts.summaries || !opts.candidate || !opts.baseline) {
    lines.push('Attribution skipped: missing --summaries, --candidate or --baseline.');
    return finish(opts, out, lines);
  }

  const shards = findSummaries(opts.summaries).map(readJson).filter(Boolean);
  const failures = shards.flatMap((s) => s.failures || []);
  const broken = shards.filter((s) => s.exitCode !== 0 && s.exitCode !== 1);
  if (!failures.length) {
    lines.push('No test failures to attribute.');
    for (const s of broken) {
      lines.push(`- shard ${s.shard || s.runId}: exit ${s.exitCode} — ${(s.abort && s.abort.reason) || s.harnessError || 'see the shard log'} (not a test failure; nothing to attribute)`);
    }
    return finish(opts, out, lines);
  }

  const byFile = new Map();
  for (const f of failures) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  const files = [...byFile.keys()].sort();
  log(`${failures.length} failure(s) in ${files.length} file(s); attributing up to ${opts.maxFiles} file(s), one re-run at a time`);

  files.forEach((file, i) => {
    const tests = byFile.get(file);
    const changed = specChangedInPr(file, opts.baseRef);
    const fileRec = { file, specChangedInPr: changed, baseline: null, candidate: null };
    out.files.push(fileRec);
    const label = (f, verdict, note) => out.labels.push({ ...f, label: verdict, note: note || '' });

    if (i >= opts.maxFiles) {
      for (const f of tests) label(f, 'unattributed', `over the --max-files=${opts.maxFiles} cap`);
      return;
    }
    const base = rerun(opts.baseline, file, `attr-${i + 1}-base`);
    fileRec.baseline = base.ok ? { failed: [...base.failed] } : { error: base.reason };
    if (!base.ok) {
      for (const f of tests) label(f, 'unattributed', base.reason);
      return;
    }
    const rest = [];
    for (const f of tests) {
      if (base.failed.has(keyOf(f))) {
        label(f, 'pre-existing', changed ? 'spec changed in this PR: the master result is not comparable' : 'fails on the master image too');
      } else {
        rest.push(f);
      }
    }
    if (!rest.length) return;
    const cand = rerun(opts.candidate, file, `attr-${i + 1}-cand`);
    fileRec.candidate = cand.ok ? { failed: [...cand.failed] } : { error: cand.reason };
    for (const f of rest) {
      if (!cand.ok) label(f, 'unattributed', `passes on master; ${cand.reason}`);
      else if (cand.failed.has(keyOf(f))) label(f, 'regression', 'passes on master, fails again alone on this image');
      else label(f, 'flake', 'passes on master, passes alone on this image');
    }
  });

  const count = (l) => out.labels.filter((x) => x.label === l).length;
  lines.push(
    `**${count('regression')} regression(s)** · ${count('pre-existing')} pre-existing · ${count('flake')} flake(s) · ${count('unattributed')} unattributed`,
    '',
    'Rule: re-run each failing spec file alone against a master image in the same mode (storage OFF). Fails there too → pre-existing. Passes there → re-run it alone on this image: still failing → regression, passing → flake. This annotates; it never changes the `Docker Regression Gate` conclusion.',
    '',
    '| Label | File | Test | Project | Note |',
    '|---|---|---|---|---|'
  );
  // Backslashes first (see e2e-docker.js `aggregate`).
  const cell = (s) =>
    String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const order = { regression: 0, unattributed: 1, flake: 2, 'pre-existing': 3 };
  for (const l of [...out.labels].sort((a, b) => order[a.label] - order[b.label])) {
    lines.push(`| **${l.label}** | ${cell(`${l.file}:${l.line}`)} | ${cell(l.title)} | ${cell(l.project)} | ${cell(l.note)} |`);
  }
  return finish(opts, out, lines);
}

function finish(opts, out, lines) {
  const text = `${lines.join('\n')}\n`;
  process.stdout.write(text);
  try {
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
    fs.writeFileSync(opts.out || path.resolve('docker-regression-attribution.json'), `${JSON.stringify(out, null, 2)}\n`);
  } catch (e) {
    console.error(`[attribute] could not write the report: ${e.message}`);
  }
  // Advisory by construction (ADR 0048 §5): never a non-zero exit.
  process.exit(0);
}

try {
  main();
} catch (e) {
  console.error(`[attribute] failed: ${e && e.stack ? e.stack : e}`);
  process.exit(0);
}
