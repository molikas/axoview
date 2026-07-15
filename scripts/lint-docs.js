#!/usr/bin/env node
/**
 * Docs governance lint.
 *
 * Every defect the 2026-07-15 ADR-vs-code conformance audit actually found was
 * *metadata about* a decision -- a Status header, a supersession field, a
 * currency line -- never a wrong decision. Decision text has a feedback loop
 * (agents read it next to the code and mismatches surface); the fields below
 * have none, so drift concentrates here. That makes them worth linting and the
 * prose worth leaving alone.
 *
 * The audit cost three multi-agent runs and refuted 35% of its own gated
 * findings. These checks are the durable half of its yield, for free, in CI.
 *
 * Run: npm run lint:docs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ADR_DIR = path.join(ROOT, 'docs', 'adr');
const BASELINE_FILE = path.join(__dirname, 'docs-lint-baseline.json');
const errors = [];
const err = (file, msg) => errors.push({ file: path.relative(ROOT, file).split(path.sep).join('/'), msg });

// Known-dead links, recorded on adoption so the lint starts green and ratchets
// down. Governance checks (1-4) are NOT baselined -- they are clean today and
// any new violation is a hard failure. `--update-baseline` rewrites this file.
const baselineRaw = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : { brokenLinks: [] };
const baseline = new Set((baselineRaw.brokenLinks || []).map((e) => (typeof e === 'string' ? e : e.link)));
const seenBaselined = new Set();

const adrFiles = fs
  .readdirSync(ADR_DIR)
  .filter((f) => /^\d{4}-.*\.md$/.test(f))
  .map((f) => path.join(ADR_DIR, f));

const field = (src, name) => {
  const m = src.match(new RegExp(`^\\*\\*${name}:\\*\\*[ \\t]*(.*)$`, 'm'));
  return m ? m[1].trim() : null;
};
const adrNum = (file) => path.basename(file).slice(0, 4);
// Only count explicit "ADR NNNN" references. Bare 4-digit numbers appear in
// prose (dates, commit counts) and would produce false edges.
const refs = (s) => [...s.matchAll(/ADR\s+(\d{4})/g)].map((m) => m[1]);

const supersedes = new Map(); // NNNN -> Set(targets it claims to supersede)
const supersededBy = new Map(); // NNNN -> Set(successors it names)

for (const file of adrFiles) {
  const src = fs.readFileSync(file, 'utf8');
  const n = adrNum(file);

  // --- 1. Status enum -------------------------------------------------------
  // A trailing prose qualifier is idiomatic here ("Accepted (shipped 2026-06-14)")
  // and carries real information -- only the leading token is constrained.
  const status = field(src, 'Status');
  if (status === null) {
    err(file, 'missing **Status:** header');
  } else if (!/^(Proposed|Accepted|Superseded in part|Superseded)\b/.test(status)) {
    err(file, `Status must start with Proposed|Accepted|Superseded|Superseded in part -- got "${status.slice(0, 60)}"`);
  }

  // --- 2. The `none (...prose...)` trap ------------------------------------
  // ADR 0030 said "Supersedes: none (... supersedes the connector Style tab
  // decision in ADR 0004 ...)". A relationship written as prose after the word
  // "none" is invisible to check 3, so the other side never gets updated. This
  // was the mechanical cause of every one-way edge in the corpus.
  for (const f of ['Supersedes', 'Superseded by']) {
    const v = field(src, f);
    if (v && /^none\b/i.test(v) && /supersed/i.test(v.replace(/^none/i, ''))) {
      err(file, `**${f}:** says "none" but its prose describes a supersession. Put the edge in the field (see feature.md, "Partial supersession").`);
    }
  }

  // --- 3. Build the supersession graph -------------------------------------
  const sup = field(src, 'Supersedes');
  const supBy = field(src, 'Superseded by');
  supersedes.set(n, new Set(sup && !/^none\b/i.test(sup) ? refs(sup) : []));
  supersededBy.set(n, new Set(supBy && !/^none\b/i.test(supBy) ? refs(supBy) : []));

  // --- 5. ADR-tier link integrity ------------------------------------------
  // Scoped to docs/adr/ deliberately -- the governance tier. The wider docs
  // tree carries ~124 pre-existing dead links (mostly citations to correctly-
  // retired tacticals inside frozen reviews); baselining those is separate work.
  //
  // This starts from a baseline rather than zero: the ADR tier had 51 dead
  // links on adoption. See docs-lint-baseline.json -- it is the backlog, and
  // it should only ever shrink.
  for (const m of src.matchAll(/\]\(([^)]+)\)/g)) {
    const link = m[1].split('#')[0].trim();
    if (!link || /^(https?:|mailto:)/.test(link)) continue;
    if (link.includes('NNNN') || link.includes('<')) continue; // template placeholders
    if (!fs.existsSync(path.resolve(path.dirname(file), link))) {
      const key = `${path.relative(ROOT, file).split(path.sep).join('/')} -> ${link}`;
      if (baseline.has(key)) seenBaselined.add(key);
      else err(file, `broken link -> ${link}`);
    }
  }
}

// --- 3 (cont). Reciprocity ---------------------------------------------------
// "A supersedes B" and "B superseded by A" must both be recorded. One-way edges
// are how a reader lands on a retired decision with nothing telling them so.
for (const [n, targets] of supersedes) {
  for (const t of targets) {
    if (!supersededBy.has(t)) {
      err(path.join(ADR_DIR, `${n}-*.md`), `claims to supersede ADR ${t}, which does not exist`);
    } else if (!supersededBy.get(t).has(n)) {
      err(path.join(ADR_DIR, `${n}-*.md`), `supersedes ADR ${t}, but ADR ${t}'s **Superseded by:** does not name ${n} (one-way edge)`);
    }
  }
}
for (const [n, successors] of supersededBy) {
  for (const s of successors) {
    if (!supersedes.has(s)) {
      err(path.join(ADR_DIR, `${n}-*.md`), `names ADR ${s} as successor, which does not exist`);
    } else if (!supersedes.get(s).has(n)) {
      err(path.join(ADR_DIR, `${n}-*.md`), `is superseded by ADR ${s}, but ADR ${s}'s **Supersedes:** does not name ${n} (one-way edge)`);
    }
  }
}

// --- 4. Released-version claims vs package.json ------------------------------
// The 2026-07-15 sweep *authored* "the released line is v3.6.0" the day AFTER
// v3.7.0 shipped, in the index every session is told to read first. semantic-release
// bumps package.json on every release, so it is the cheapest available oracle --
// and unlike `git tag`, it needs no fetch in CI.
const released = require(path.join(ROOT, 'package.json')).version;
const CURRENCY_DOCS = ['docs/README.md', 'docs/guidelines/architecture.md', 'docs/features.md', 'PLAN.md'];
for (const rel of CURRENCY_DOCS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/released line is\s+\**v?(\d+\.\d+\.\d+)\**/gi)) {
    if (m[1] !== released) {
      err(file, `claims the released line is v${m[1]}, but package.json says v${released}`);
    }
  }
}

// --- baseline bookkeeping ----------------------------------------------------
// A baselined link that now resolves is progress -- surface it so the entry gets
// removed and the ratchet actually tightens. Not a failure: it would fire on an
// unrelated PR that happened to restore a file.
const fixed = [...baseline].filter((k) => !seenBaselined.has(k));

// --- report ------------------------------------------------------------------
if (errors.length === 0) {
  console.log(`docs lint: OK (${adrFiles.length} ADRs, released line v${released})`);
  if (baseline.size) {
    console.log(`  ${seenBaselined.size} known-dead link(s) still baselined -- see ${path.relative(ROOT, BASELINE_FILE).split(path.sep).join('/')}`);
  }
  if (fixed.length) {
    console.log(`  ${fixed.length} baselined link(s) now resolve -- drop them from the baseline:`);
    fixed.forEach((k) => console.log(`    - ${k}`));
  }
  process.exit(0);
}
console.error(`docs lint: ${errors.length} problem(s)\n`);
const byFile = new Map();
for (const e of errors) {
  if (!byFile.has(e.file)) byFile.set(e.file, []);
  byFile.get(e.file).push(e.msg);
}
for (const [f, msgs] of byFile) {
  console.error(`  ${f}`);
  for (const m of msgs) console.error(`    - ${m}`);
}
console.error('');
process.exit(1);
