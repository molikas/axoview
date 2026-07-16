#!/usr/bin/env node
/**
 * Extract the ungated rows of the ADR-audit register into a compact worklist.
 *
 * The register is ~419KB of prose tables. No gating agent should ever read it:
 * the two prior gate runs died on session limits, and feeding 419KB of context
 * to hundreds of agents is a large part of why. This turns Part 2 into one
 * JSONL line per row so an agent's prompt carries only the rows it must judge.
 *
 * Cells contain escaped pipes (`git tag \| head -1`), so a naive split on "|"
 * shifts every column right and yields garbage ADR numbers. Split on unescaped
 * pipes only.
 *
 * Agent-only helper for `/docs-sweep gate`. Not referenced by CI -- the CI-owned
 * docs gate is scripts/lint-docs.js (`npm run lint:docs`).
 *
 * Usage: node .claude/scripts/docs-sweep/extract-worklist.js [--out <path>]
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTER = path.join(ROOT, 'docs', 'tactical', 'adr-code-audit.md');
const outArg = process.argv.indexOf('--out');
// Generated output goes to reports/ -- gitignored (.gitignore "reports/"), same
// tier as playwright-report/ and the /audit skill's output. It is derived from
// the register in ~1s; committing it would be committing a build artifact.
const OUT = outArg !== -1 ? process.argv[outArg + 1] : path.join(ROOT, 'reports', 'docs-sweep', 'worklist.jsonl');
fs.mkdirSync(path.dirname(OUT), { recursive: true });

const HEADER_RE = /^\|\s*#\s*\|\s*ADR\s*\|/;

// Split a markdown table row on UNESCAPED pipes only.
function cells(line) {
  const out = [];
  let cur = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\' && line[i + 1] === '|') { cur += '|'; i++; continue; }
    if (c === '|') { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  // leading/trailing pipe produce empty first/last cells
  return out.slice(1, -1).map((s) => s.trim());
}

const lines = fs.readFileSync(REGISTER, 'utf8').split('\n');

// Find every register table (header + separator), then take rows until a blank
// or non-row line. Part 1 (gated) and Part 2 (ungated) share a header shape, so
// classify by the Verdict column rather than by line number -- line numbers move
// every time the file is edited.
const rows = [];
for (let i = 0; i < lines.length; i++) {
  if (!HEADER_RE.test(lines[i])) continue;
  const cols = cells(lines[i]);
  const idx = (name) => cols.findIndex((c) => c.toLowerCase().startsWith(name));
  const I = {
    n: idx('#'), adr: idx('adr'), sec: idx('§'), cls: idx('class'),
    claim: idx('claim'), ev: idx('evidence'), verdict: idx('verdict'), fix: idx('proposed')
  };
  for (let j = i + 2; j < lines.length; j++) {
    const L = lines[j];
    if (!/^\|\s*\d+\s*\|/.test(L)) break;
    const c = cells(L);
    const verdict = (c[I.verdict] || '').replace(/`/g, '').trim();
    rows.push({
      row: parseInt(c[I.n], 10),
      adr: (c[I.adr] || '').trim(),
      section: c[I.sec] || '',
      class: (c[I.cls] || '').trim(),
      claim: c[I.claim] || '',
      evidence: c[I.ev] || '',
      proposedFix: c[I.fix] || '',
      verdict: verdict || 'UNVERIFIED'
    });
    i = j;
  }
}

const ungated = rows.filter((r) => r.verdict === 'UNVERIFIED');
const byVerdict = rows.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] || 0) + 1), a), {});

// An ADR column that is not exactly 4 digits means the parser lost alignment.
const bad = ungated.filter((r) => !/^\d{4}$/.test(r.adr));
if (bad.length) {
  console.error(`PARSE ERROR: ${bad.length} row(s) have a non-4-digit ADR column -- column alignment lost.`);
  bad.slice(0, 5).forEach((r) => console.error(`  row ${r.row}: adr="${r.adr}"`));
  process.exit(1);
}

fs.writeFileSync(OUT, ungated.map((r) => JSON.stringify(r)).join('\n') + '\n');

const byAdr = {};
for (const r of ungated) (byAdr[r.adr] = byAdr[r.adr] || []).push(r.row);
const byClass = ungated.reduce((a, r) => ((a[r.class] = (a[r.class] || 0) + 1), a), {});

console.log(`parsed ${rows.length} register rows:`, byVerdict);
console.log(`\nungated worklist: ${ungated.length} rows across ${Object.keys(byAdr).length} ADRs -> ${path.relative(ROOT, OUT)}`);
console.log(`row # span: ${Math.min(...ungated.map((r) => r.row))}-${Math.max(...ungated.map((r) => r.row))}`);
console.log('\nby class:', byClass);
console.log('\nbatches (one agent per ADR):');
for (const [adr, rs] of Object.entries(byAdr).sort()) {
  console.log(`  ADR ${adr}: ${rs.length} row(s)  [${rs.join(', ')}]`);
}
