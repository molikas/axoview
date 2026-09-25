#!/usr/bin/env node
/**
 * Dependency-advisory gate.
 *
 * `npm audit` on its own is not a gate — it always exits non-zero while any
 * known-and-accepted advisory is open, so teams stop running it. This turns it
 * into a tripwire: every advisory must be either FIXED or explicitly accepted in
 * scripts/audit-allowlist.json with a written reason. CI then goes red only on
 * something NEW, which is the signal worth interrupting a human for.
 *
 * Added by the 2026-07-29 review, which found 12 advisories, verified each
 * against real usage, and concluded none were exploitable — a conclusion that
 * previously lived only in a markdown file and enforced nothing.
 *
 * Two trees are audited, each against the allowlist entries scoped to it:
 *   - `root`: the workspace lockfile — what CI installs and builds from.
 *   - `backend`: packages/axoview-backend/package-lock.json, production deps
 *     only. It is the tree the Docker image actually installs (the Dockerfile
 *     runs `npm ci --omit=dev --workspaces=false` in that directory), and it
 *     resolves versions independently of the root lockfile, so a clean root
 *     audit says nothing about it.
 *
 * Exit 0 = pass. Exit 1 = an unreviewed advisory. Exit 2 = the gate is broken.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ALLOWLIST_PATH = path.join(__dirname, 'audit-allowlist.json');
const ROOT = path.resolve(__dirname, '..');

// A single fixed command string per pass, not (command, args[]): `npm` is
// `npm.cmd` on Windows and cannot be spawned without a shell, while passing an
// args ARRAY through a shell is what DEP0190 deprecates. Nothing here is
// interpolated, so there is no quoting or injection surface.
const PASSES = [
  { scope: 'root', cwd: ROOT, cmd: 'npm audit --json --workspaces' },
  {
    scope: 'backend',
    cwd: path.join(ROOT, 'packages', 'axoview-backend'),
    // --workspaces=false stops npm from walking up to the root workspace, which
    // would audit the root lockfile a second time instead of this one.
    cmd: 'npm audit --json --omit=dev --workspaces=false'
  }
];
const SCOPES = new Set(PASSES.map((p) => p.scope));
// Entries written before the backend pass existed were all reviewed against
// the root tree, so an entry without `scope` covers the root tree only.
const DEFAULT_SCOPE = 'root';

function die(code, msg) {
  console.error(msg);
  process.exit(code);
}

function runAudit(pass) {
  let raw;
  try {
    // npm audit exits non-zero whenever anything is found; that is expected
    // here, so read stdout regardless and let JSON.parse be the real validity
    // check.
    raw = execSync(pass.cmd, {
      cwd: pass.cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch (err) {
    raw = (err && err.stdout) || '';
  }

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    die(2, `check-audit [${pass.scope}]: could not parse \`${pass.cmd}\` output. Is the lockfile intact?`);
  }
  if (!report || typeof report.vulnerabilities !== 'object') {
    die(2, `check-audit [${pass.scope}]: unexpected \`npm audit --json\` shape — refusing to report a green.`);
  }
  return report;
}

// Collect concrete advisories. `via` entries that are plain strings are just
// pointers to a parent package and carry no advisory of their own — the parent's
// entry already covers them.
function collectAdvisories(report) {
  const found = new Map();
  for (const [pkg, v] of Object.entries(report.vulnerabilities)) {
    for (const via of v.via || []) {
      if (typeof via === 'string' || !via.url) continue;
      const id = via.url.split('/').pop();
      if (!found.has(id)) {
        found.set(id, { id, packages: new Set(), title: via.title, severity: via.severity });
      }
      found.get(id).packages.add(pkg);
    }
  }
  return found;
}

// How many dependencies npm audited — printed so a pass that silently read the
// wrong tree (e.g. the root lockfile again) is visible at a glance.
function describeDeps(report) {
  const d = report.metadata && report.metadata.dependencies;
  if (d && typeof d === 'object') return `${d.prod} prod / ${d.total} total deps`;
  if (typeof d === 'number') return `${d} deps`;
  return 'dependency count unknown';
}

const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));

// Normalise `scope` (absent, a string, or an array of strings). An unknown
// scope is a broken gate, not a no-op: a typo would make the entry silently
// match nothing while looking like an accepted risk.
const scopesOf = new Map();
for (const a of allowlist.allow) {
  const scopes = a.scope === undefined ? [DEFAULT_SCOPE] : [].concat(a.scope);
  const bad = scopes.filter((s) => !SCOPES.has(s));
  if (!scopes.length || bad.length) {
    die(
      2,
      `check-audit: allowlist entry ${a.id} has an invalid scope ${JSON.stringify(a.scope)}. ` +
        `Use one of ${[...SCOPES].map((s) => `"${s}"`).join(', ')}, or an array of them.`
    );
  }
  scopesOf.set(a, scopes);
}
const coversScope = (a, scope) => scopesOf.get(a).includes(scope);

const foundByScope = new Map();
for (const pass of PASSES) {
  const report = runAudit(pass);
  const found = collectAdvisories(report);
  foundByScope.set(pass.scope, found);

  const allowedHere = allowlist.allow.filter((a) => coversScope(a, pass.scope));
  const unreviewedHere = [...found.values()].filter(
    (adv) => !allowedHere.some((a) => a.id === adv.id)
  ).length;
  console.log(
    `check-audit [${pass.scope}]: ${found.size} advisor${found.size === 1 ? 'y' : 'ies'} present ` +
      `(${describeDeps(report)}), ${allowedHere.length} allowlisted, ${unreviewedHere} unreviewed`
  );
}

const unreviewed = [];
for (const [scope, found] of foundByScope) {
  for (const adv of found.values()) {
    const allowed = allowlist.allow.some((a) => a.id === adv.id && coversScope(a, scope));
    if (!allowed) unreviewed.push({ ...adv, scope });
  }
}

// Stale per (entry, scope): an entry scoped to both trees whose advisory was
// fixed in one of them should drop that scope, not linger as if it still
// protected something there.
const stale = [];
for (const a of allowlist.allow) {
  for (const scope of scopesOf.get(a)) {
    if (!foundByScope.get(scope).has(a.id)) stale.push({ ...a, scope });
  }
}

const today = new Date().toISOString().slice(0, 10);
const overdue = allowlist.allow.filter(
  (a) =>
    a.reviewBy &&
    a.reviewBy < today &&
    scopesOf.get(a).some((scope) => foundByScope.get(scope).has(a.id))
);

if (stale.length) {
  console.log(
    '\ncheck-audit: allowlist entries that no longer match any advisory in their tree —\n' +
      'these are FIXED there; delete the entry (or that scope) so the list keeps meaning something:'
  );
  for (const s of stale) console.log(`  - ${s.id} (${s.package}) [${s.scope}] — ${s.title}`);
}

if (overdue.length) {
  console.log('\ncheck-audit: WARNING — accepted risks past their reviewBy date:');
  for (const o of overdue) {
    console.log(`  - ${o.id} (${o.package}) accepted ${o.acceptedOn}, review was due ${o.reviewBy}`);
    console.log(`      tripwire: ${o.tripwire}`);
  }
  console.log('  Re-verify these against current usage and re-date, or fix them.');
}

if (unreviewed.length) {
  const lines = unreviewed
    .map(
      (a) =>
        `  - ${a.id}  [${a.severity || 'unknown'}]  ${a.title || ''}\n` +
        `      tree: ${a.scope}    packages: ${[...a.packages].join(', ')}\n` +
        `      https://github.com/advisories/${a.id}`
    )
    .join('\n');
  die(
    1,
    `\ncheck-audit FAILED — ${unreviewed.length} advisory(ies) not fixed and not reviewed:\n\n${lines}\n\n` +
      'Either upgrade to clear it, or — if it genuinely cannot bite this codebase —\n' +
      'add an entry to scripts/audit-allowlist.json stating WHY (verified against\n' +
      'actual usage, not the advisory text) and what the tripwire is. Set its\n' +
      '`scope` to the tree it was found in ("root" is the default; the backend\n' +
      'tree needs "backend", or ["root", "backend"] when it is in both).\n'
  );
}

console.log('check-audit: OK');
