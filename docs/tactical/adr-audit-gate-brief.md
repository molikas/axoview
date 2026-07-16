# Cold-start brief — gate the 116 ungated ADR-audit rows

> **Read first (in this order, and nothing else):**
> - This file, fully.
> - [adr-code-audit.md](adr-code-audit.md) — **only** the "Disposition — remediation pass, 2026-07-15" block at the top (~60 lines). **Do NOT read the rest: it is 419KB and reading it is a direct cause of the two prior failures.**
> - [.claude/commands/feature.md](../../.claude/commands/feature.md) — the ADR template + `extend`/`supersede` discipline. Any *proposed* fix must flow through it.
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-07-16
> **Mode:** DISCOVERY ONLY. Do not fix. Do not flip any `Status`. Do not edit any ADR.

## Why the last two runs died, and what changed

Both prior gate runs were killed by session limits — **not by logic**. The register records the cause precisely: *"the session limit killed 288 of 335 refuters."*

The design was **3 refuter agents per row**. 127 rows × 3 = 381 agents, each re-reading the ADR and the code from scratch, many with the 419KB register in context. That shape cannot finish. Running it again with a bigger budget just fails more expensively.

**The fix is to do less agent work, not to buy more.** Three levers, all already applied:

| Lever | Before | Now |
|---|---|---|
| Input size | agents read the 419KB register | `gate-worklist.jsonl` — 127 rows, one JSON line each; an agent sees **only its own ADR's rows** |
| Unit of work | 1 agent per row (381) | **1 agent per ADR** (38) — reads the ADR + code **once**, judges all its rows |
| Mechanical work | agents ran `test -f` / `grep` by hand | `gate-prefilter.json` **precomputes** it; 11 rows are already resolved with zero agents |

Projected: **~98 agents instead of 381**, each with a small context. Plus disk checkpointing so a session death costs one ADR, not the run.

## The artifacts (already built — do not regenerate unless stale)

| File | What it is |
|---|---|
| [`gate-worklist.jsonl`](gate-worklist.jsonl) | The **127 ungated rows**, one JSON object per line: `{row, adr, section, class, claim, evidence, proposedFix, verdict}`. 145KB total; per-ADR slices are 1–9 rows. Regenerate: `node scripts/extract-audit-worklist.js` |
| [`gate-prefilter.json`](gate-prefilter.json) | Per-row **precomputed facts** (which cited paths exist, what the `#L` anchors point at today, test-name grep counts) + 11 rows already resolved. Regenerate: `node scripts/gate-prefilter.js` |
| `gate-results.jsonl` | **You create and append to this.** One line per judged row. This is the resume point. |

The extractor is validated: it reproduces the register's own counts exactly (27 `CONFIRMED` / 16 `REFUTED` / 3 `PLAUSIBLE` / 127 `UNVERIFIED`).

## Ground truth (re-derive; do not trust this file)

- Repo `c:\mytemp\axoview`, branch `integration`. Date **2026-07-16**.
- **Released line = v3.7.0.** `git tag` reports v3.6.0 until you `git fetch --tags`. ADRs 0042/0043 **are released**.
- 41 ADRs; **0016/0017 unused by design**; highest = 0043. **Zero `Proposed`** — 40 `Accepted`, 1 `Superseded in part` (0019).
- **PR #70 is open/merged** (docs housekeeping + audit remediation + `scripts/lint-docs.js`). It **already fixed** several things the register still lists as open. Check `git log` before filing anything as a live defect.
- `.claude/commands/feature.md` ~line 179: *"Leave Status as `Accepted` — addendums don't supersede."* A missing header edge whose ADR carries a dated **body** addendum is **sanctioned, not a defect.**

## What is already covered — do NOT gate these

`scripts/lint-docs.js` now runs in CI and permanently covers: `Status` enum, the `Supersedes: none (…prose…)` trap, **supersession reciprocity**, released-version claims, and ADR-tier link integrity (from `scripts/docs-lint-baseline.json`). **All A1 rows were already gated.** If a row's substance is one of those classes, mark it `SUPERSEDED_BY_LINT` and move on — do not spend an agent.

The lint found a **fourth one-way edge (0018→0027)** that 458 traced rows and three gate lenses missed. Mechanical checks beat agents on mechanical classes. Prefer them.

## The one distinction that matters most

**`ALREADY_FIXED` is not `REFUTED`.**

- `REFUTED` = the finding was **wrong**.
- `ALREADY_FIXED` = the finding was **right**, and the 2026-07-15 remediation (or PR #70) has since addressed it.

Collapsing these blames the audit for being correct, and corrupts the refutation rate that every future cost decision depends on. **This is not hypothetical:** the first version of `gate-prefilter.js` auto-refuted rows 135/136/139 because their links resolved — they resolve *because the remediation de-linked them*. Those findings were right. The script was corrected; you must not reintroduce the error by hand. When a row looks refuted because the current tree is clean, **run `git log -S'<the thing>' -- <file>` and find out whether it was ever broken.**

## Verdict vocabulary (use exactly these)

| Verdict | Meaning |
|---|---|
| `CONFIRMED` | Real, present in the tree **today**, refutation attempted and failed. |
| `ALREADY_FIXED` | Was real; a commit fixed it. **Cite the commit.** |
| `REFUTED` | The finding is **wrong** — the premise is false, or the ADR/convention sanctions it. |
| `SUPERSEDED_BY_LINT` | Substance is a class `lint-docs.js` now enforces. |
| `NEEDS_OWNER` | Real but the remedy is a product/architecture decision, not a doc edit. |

## Protocol

### Phase 0 — ground truth + resume (no agents)

1. `git fetch --tags && git log --oneline -3 && git status --porcelain` — audit the **working tree**.
2. `npm run lint:docs` — must be green. If not, that is a live defect; report it and stop.
3. If `gate-results.jsonl` exists, read it and **skip every ADR already present.** This is the resume.
4. `node scripts/extract-audit-worklist.js && node scripts/gate-prefilter.js` **only if** the artifacts are missing or the register changed.
5. Fold in the 11 pre-resolved rows: the 8 `AUTO_CONFIRMED` (an ADR still *links* a path that does not exist — sound by construction) and the 3 `LIKELY_ALREADY_FIXED` (**must** be confirmed with `git log` before recording).

### Phase 1 — batched judgment: ONE agent per ADR

For each unprocessed ADR (38 total, 1–9 rows each), spawn **one** agent. Give it, inline in the prompt:
- its ADR's rows from `gate-worklist.jsonl` (a handful of lines — **never the register**),
- its rows' `facts` from `gate-prefilter.json` (already-run greps; tell it **not to re-run them**),
- the ADR path.

Its job: read the ADR **once**, read the cited code **once**, and return a verdict per row with evidence. Force structured output (`schema`) so no parsing is needed.

**It must be told to default to `REFUTED` when unsure** — that is what produced the honest 35% refutation rate. And it must be told **`ALREADY_FIXED` is a distinct verdict requiring a commit hash.**

Append every result to `gate-results.jsonl` **as each ADR completes** — not at the end. `resumeFromRunId` is **same-session only**, so disk is the only thing that survives the failure mode that killed both prior runs.

### Phase 2 — adversarial refutation of SURVIVORS ONLY

This is the main cost lever, and it rests on an asymmetry:

> A false `CONFIRMED` gets a **wrong fix applied to the repo** — the 2026-07-15 pass showed exactly this: acting on the "0004↔0032 missing edge" finding would have linked two decisions that ADR 0032 explicitly records as unrelated. A false `REFUTED` merely **misses a finding** — which the lint now catches for every mechanical class anyway.
>
> **So verification budget goes on rows that SURVIVE, never on rows that died.**

For each ADR with ≥1 `CONFIRMED` row, spawn **2** refuters (not 3 — the third lens changed no outcome in the prior run's headline set), each judging **all** that ADR's confirmed rows in one context:
- **Lens A — premise:** *is the claim's stated fact actually true in the tree today?* (This is what would have killed the 0020-retention and 0004↔0032 false positives.)
- **Lens B — sanction:** *is this sanctioned by a convention?* (`feature.md` addendum rule, ADR 0020's retention policy, a deliberate historical citation, the tactical-wrap lifecycle.)

Both told: **default to refuted.** A row survives only if **both** fail to refute. Anything else → `REFUTED` or `PLAUSIBLE`.

### Phase 3 — report (no fixes)

Append to `gate-results.jsonl`, then write a **≤150-line** summary at the bottom of this file:
- counts by verdict + **the measured refutation rate** (the number every future cost decision uses),
- the `CONFIRMED` rows, most-severe first, each with file + **symbol** (line numbers drift within a month),
- any row where the two lenses **split** → `PLAUSIBLE`, never `CONFIRMED`,
- **what you did not reach.** Silence reads as "covered everything."

## Budget + session discipline

- **Stop at ~10 ADRs per session**, or when `budget.remaining() < 80k`. Checkpoint and stop cleanly. Re-running this brief resumes. **A clean stop with 12 ADRs banked beats a session death with 30 unbanked.**
- Cap concurrency at the default. The prior runs died partly from fanning out further than the session could carry.
- Do **not** re-read the register. Do **not** re-run precomputed greps. Do **not** spawn a third lens.
- If an agent returns `null` (skipped/died), record the row as `UNVERIFIED` and continue. **Never** infer a verdict from a dead agent.

## Traps (all observed, all real)

1. **The register is stale on itself.** Its Priors said 0042/0043 were unreleased; v3.7.0 shipped 2026-07-14. Re-derive.
2. **Row duplication inflates counts.** Rows 20/21/22/24 were four `CONFIRMED` badges for **one** defect. Count defects, not rows.
3. **"One fact, three verdicts."** The 0012→0030 edge was gated three times under different framings and came back `CONFIRMED`, `PLAUSIBLE` **and** `REFUTED`. Badges are artifacts of row duplication — dedupe by (file, claim) before believing a count.
4. **Frozen `docs/reviews/*`, `PLAN.md`, and memory are NOT evidence of current behaviour.** Code is.
5. **Two spellings minimum before claiming absence.** ADR 0007 was nearly filed as a placeholder because `DiagnosticsOverlay.tsx` lives in `app`, not `lib` — a grep trap.
6. **A cited symbol that moved is not a defect** unless the ADR's *claim* is now false. Line numbers drift; claims are what matter.
7. **The tree is clean because it was fixed.** See the `ALREADY_FIXED` section. Check `git log` before concluding a finding was wrong.

## Verified negatives — do NOT re-raise

- The four 2026-07-15 status flips (0022/0023/0025/0028) were **RIGHT**.
- Supersession graph is a clean DAG — no cycles, no orphan successors.
- **ADR 0020 does NOT contradict its retention policy** — `decision-log.md` + `baseline.md` are DURABLE and present; `perf-results/raw/` is gitignored exactly as specified. The deletions **were the policy working.**
- **0004↔0032 is not a missing edge** — ADR 0032 explicitly records that the claim it amends 0004 *"is false."* There is no edge.
- **ADR 0029 is clean** (one guarded `dangerouslySetInnerHTML`). **ADR 0007 is genuinely Accepted.** **ADR 0043's `BUILD_TIME_API_KEY`** is a build-time-only Picker fallback, `null` on Cloudflare — not a browser-shipped key.
- **0036↔0037/0042 is the corpus's best-formed supersession.** (The prior brief said "0035/0036" — wrong: **0035 has no supersession edges at all.**)

## Wrap-up

When `gate-results.jsonl` covers all 38 ADRs: post the Phase 3 summary, then **stop**. Do not fix. The owner reviews, decides what to remediate, and `/feature wrap`s both this brief and `adr-code-audit.md` — deleting them. Their durable output is already extracted: the convention in `feature.md` and the lint in `scripts/lint-docs.js`.
