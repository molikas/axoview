#!/usr/bin/env node
/**
 * Mechanical pre-filter for the ADR-audit gate.
 *
 * The two prior gate runs died on session limits: the design was 3 refuter
 * agents PER ROW (127 x 3 = 381), and "the session limit killed 288 of 335
 * refuters". The fix is not a bigger budget -- it is doing less agent work.
 *
 * ~40% of the worklist needs no judgment at all:
 *   A3a (17) dead links               -> a file either exists or it does not
 *   A3c (11) tests that do not exist  -> grep the name
 *   A3b (22) drifted file:line        -> needs judgment, but the greps a human
 *                                        or agent would run can be precomputed
 * Only A2* (77) genuinely requires reading a decision against the code.
 *
 * This script decides what it can and PRECOMPUTES evidence for the rest, so an
 * agent spends its turns judging rather than running `test -f` and `grep`.
 *
 * Agent-only helper for `/docs-sweep gate`. Not referenced by CI -- the CI-owned
 * docs gate is scripts/lint-docs.js (`npm run lint:docs`).
 *
 * Usage: node .claude/scripts/docs-sweep/prefilter.js [--out <path>]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const WORKLIST = path.join(ROOT, 'reports', 'docs-sweep', 'worklist.jsonl');
const outArg = process.argv.indexOf('--out');
const OUT = outArg !== -1 ? process.argv[outArg + 1] : path.join(ROOT, 'reports', 'docs-sweep', 'prefilter.json');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

if (!fs.existsSync(WORKLIST)) {
  console.error(`missing ${path.relative(ROOT, WORKLIST)} -- run: node .claude/scripts/docs-sweep/extract-worklist.js`);
  process.exit(1);
}
const rows = fs.readFileSync(WORKLIST, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

const adrPath = (n) => {
  const hit = fs.readdirSync(path.join(ROOT, 'docs', 'adr')).find((f) => f.startsWith(n + '-'));
  return hit ? path.join(ROOT, 'docs', 'adr', hit) : null;
};

// Repo-relative source paths mentioned anywhere in the row's prose.
const PATH_RE = /(?:packages|scripts|docs|perf-results)\/[\w./-]+\.(?:tsx?|jsx?|md|json|ya?ml)/g;
const exists = (p) => fs.existsSync(path.join(ROOT, p));

function grepCount(pattern, dir) {
  try {
    const out = execFileSync('git', ['grep', '-c', '-F', pattern, '--', dir], { cwd: ROOT, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean).length;
  } catch {
    return 0; // git grep exits 1 on no match
  }
}

const results = [];
for (const r of rows) {
  const prose = `${r.claim} ${r.evidence}`;
  const cited = [...new Set(prose.match(PATH_RE) || [])];
  const facts = {};
  let verdict = 'NEEDS_AGENT';
  let rationale = '';

  // --- paths cited by the row -----------------------------------------------
  if (cited.length) {
    facts.citedPaths = cited.map((p) => ({ path: p, exists: exists(p) }));
  }

  // --- A3a: dead links ------------------------------------------------------
  // The FIRST version of this block auto-refuted a row whenever every markdown
  // link in its ADR resolved. That was unsound three ways, and it produced five
  // confident-wrong verdicts on the first run:
  //   1. It conflated "resolves today" with "the row was wrong". Rows 135/136/139
  //      only resolve because the 2026-07-15 remediation de-linked them -- those
  //      findings were RIGHT. ALREADY_FIXED and REFUTED are not the same claim,
  //      and recording the first as the second blames the audit for being correct.
  //   2. A3a rows often concern PLAIN-TEXT path citations, not markdown links
  //      (row 137's "docs/testing.md", row 124's "mqa-results.md #27"). A link
  //      check answers a different question than the one the row asked.
  //   3. Some A3a rows are not about links at all (row 140 is about an `I-21`
  //      catalog identifier). Link logic cannot speak to them.
  //
  // Only one A3a verdict is mechanically SOUND: an ADR that still *links* a path
  // that is *gone* has a dead link, full stop. Everything else gets facts and a
  // human/agent judgment. Precompute; do not conclude.
  if (r.class === 'A3a') {
    const p = adrPath(r.adr);
    const src = p ? fs.readFileSync(p, 'utf8') : '';
    const links = [...src.matchAll(/\]\(([^)]+)\)/g)]
      .map((m) => m[1].split('#')[0].trim())
      .filter((l) => l && !/^(https?:|mailto:)/.test(l) && !l.includes('NNNN'));
    const dead = [...new Set(links.filter((l) => !fs.existsSync(path.resolve(path.dirname(p), l))))];
    facts.adrDeadLinks = dead;
    facts.adrLinkCount = links.length;

    // Does the ADR still LINK any path this row cites as gone?
    const goneCited = (facts.citedPaths || []).filter((c) => !c.exists).map((c) => c.path);
    const stillLinked = dead.filter((d) => goneCited.some((g) => d.endsWith(path.basename(g))));
    facts.rowCitedGonePaths = goneCited;

    if (stillLinked.length) {
      verdict = 'AUTO_CONFIRMED';
      rationale = `ADR ${r.adr} still contains a markdown link to a path that does not exist (${stillLinked.join(', ')}). A live link to a missing file is a defect by construction -- no judgment required.`;
    } else if (goneCited.length && dead.length === 0) {
      verdict = 'LIKELY_ALREADY_FIXED';
      rationale = `The row cites path(s) that are gone (${goneCited.join(', ')}), but ADR ${r.adr} no longer LINKS them and has zero dead links (${links.length} checked) -- consistent with the 2026-07-15 remediation de-linking them. CONFIRM WITH GIT before recording: this means the finding was RIGHT and is now fixed. It does NOT mean the finding was wrong.`;
    } else {
      rationale = `Link facts precomputed (${links.length} links, ${dead.length} dead). The row's claim may concern a PLAIN-TEXT citation or a non-link identifier, which link-checking cannot settle. Judge it.`;
    }
  }

  // --- A3b: drifted file:line. Precompute what the cited lines say NOW. -----
  // Only 8/127 rows carry an explicit file:line, so read the anchors out of the
  // ADR itself rather than the row prose.
  if (r.class === 'A3b') {
    const p = adrPath(r.adr);
    const src = p ? fs.readFileSync(p, 'utf8') : '';
    const anchors = [...src.matchAll(/\]\(([^)#]+)#L(\d+)\)/g)].map((m) => ({ file: m[1], line: parseInt(m[2], 10) }));
    facts.anchors = anchors.slice(0, 24).map((a) => {
      const abs = path.resolve(path.dirname(p), a.file);
      if (!fs.existsSync(abs)) return { ...a, status: 'FILE_MISSING' };
      const lines = fs.readFileSync(abs, 'utf8').split('\n');
      if (a.line > lines.length) return { ...a, status: 'LINE_PAST_EOF', fileLines: lines.length };
      return { ...a, status: 'OK', currentText: (lines[a.line - 1] || '').trim().slice(0, 120) };
    });
    rationale = 'Anchors precomputed: judge whether currentText still supports the ADR\'s claim. Do not re-grep.';
  }

  // --- A3c: acceptance criteria naming tests that do not exist -------------
  if (r.class === 'A3c') {
    const testFiles = cited.filter((p) => /\.(test|spec)\.[jt]sx?$/.test(p));
    facts.testFiles = testFiles.map((p) => ({ path: p, exists: exists(p) }));
    // Quoted strings in the row are usually the describe/it names.
    const quoted = [...new Set([...prose.matchAll(/[`'"]([^`'"]{8,80})[`'"]/g)].map((m) => m[1]))].slice(0, 6);
    facts.quotedNames = quoted.map((q) => ({ name: q, hitsInTests: grepCount(q, 'packages') }));
    rationale = 'Test-file existence + name greps precomputed. Do not re-grep.';
  }

  results.push({ row: r.row, adr: r.adr, class: r.class, verdict, rationale, facts });
}

const byVerdict = results.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] || 0) + 1), a), {});
const needAgent = results.filter((r) => r.verdict === 'NEEDS_AGENT');
const byAdr = {};
for (const r of needAgent) (byAdr[r.adr] = byAdr[r.adr] || []).push(r.row);

fs.writeFileSync(OUT, JSON.stringify({ generated: 'gate-prefilter', counts: byVerdict, results }, null, 2) + '\n');

console.log('pre-filter verdicts:', byVerdict);
console.log(`\nauto-resolved with ZERO agents: ${results.length - needAgent.length}/${results.length}`);
console.log(`still needing an agent:          ${needAgent.length} rows across ${Object.keys(byAdr).length} ADRs`);
console.log(`\n-> ${path.relative(ROOT, OUT)}`);
console.log('\nagent batches (one per ADR, judging all its rows in one context):');
for (const [adr, rs] of Object.entries(byAdr).sort()) console.log(`  ADR ${adr}: ${rs.length} row(s)  [${rs.join(', ')}]`);
