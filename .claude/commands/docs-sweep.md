# /docs-sweep — Axoview Docs Corpus Verification & Consolidation

Keep the docs corpus **true to the code** and **consolidated**. Distinct from [`/audit`](audit.md), which reviews the *code* (static analysis, security, architecture, UX consistency) — this skill's subject is the **docs themselves**.

> **Where things live** — do not mix these tiers:
> - **Helpers:** `.claude/scripts/docs-sweep/*.js` — agent-only tooling. Never referenced by CI.
> - **Output:** `reports/docs-sweep/` — **gitignored** (`.gitignore` `reports/`), same tier as `playwright-report/`. Regenerable in ~1s. **Never commit it.**
> - **The CI gate is NOT this skill:** `scripts/lint-docs.js` (`npm run lint:docs`) runs in [test.yml](../../.github/workflows/test.yml). It lives in `scripts/` because CI owns it, and CI must never reach into `.claude/`.

| Mode | Use when |
|---|---|
| `lint` | Quick check — is the governance metadata sound right now? |
| `consolidate` | Docs feel stale/duplicated; a wave just shipped; things drifted. |
| `gate` | Discharge the ADR⇄code conformance register (long-running, resumable). |
| `defossilize` | Superseded-design residue (dead code, fossil names, orphaned i18n, stale comments, misleading types) is misleading rewrites. **Edits code — run the regression.** |

---

## The one lesson that governs every mode

**Every defect the 2026-07-15 conformance audit actually found was *metadata about* a decision** — a `Status` header, a supersession field, a currency line — **never a wrong decision.** Decision text has a feedback loop (agents read it beside the code, so mismatches surface). Metadata has none. That is where drift concentrates, and it is exactly what is mechanically checkable.

**So: lint the metadata, leave the prose alone.** The audit cost three multi-agent runs and **refuted 35% of its own gated findings**. `scripts/lint-docs.js` is ~150 lines and found a one-way supersession edge (0018→0027) that 458 traced rows and three adversarial lenses missed. Prefer the mechanical check every time it can answer the question.

---

## Mode: `lint`

```bash
npm run lint:docs
```

Covers permanently, in CI: `Status` enum · the `Supersedes: none (…prose…)` trap · supersession **reciprocity** · released-version claims vs `package.json` · ADR-tier link integrity (baselined in `scripts/docs-lint-baseline.json`).

If it reports baselined links now resolving, **drop those entries** — the baseline is a backlog and only shrinks. Never add to it to make a failure go away; that is the ratchet running backwards.

---

## Mode: `consolidate`

The recurring failure is **not drift — it is duplication.** One commit (`987eaaf`) falsified **four** ADRs at once because ADR 0030's panel shape had been *copy-pasted* into 0004/0012/0027/0031 instead of linked. Docs don't rot independently; they rot together, because one fact had four homes.

Sweep for, in order of value:

1. **Restated facts.** A fact stated in two docs will disagree within a wave. Find the one that *owns* it; everywhere else links. If you catch yourself writing "the panel is X" in an ADR that isn't about the panel — link instead.
2. **Calcified tacticals.** A tactical describes a moment (*"before the rewrite"*). When its work ships, **wrap it**: durable knowledge becomes a **guideline** (how-we-build) or an **ADR** (a decision) — never a permanent tactical. `docs/tactical/` empty is the healthy state.
3. **Currency/version claims.** The lint covers `released line is vX.Y.Z`. Prose that *implies* a release state ("pending v3.7.0", "awaiting the merge") is not lintable — read it against `git tag` + `CHANGELOG.md`.
4. **Hardcoded enumerations in skills.** `/notes` twice went stale by listing ADR numbers — the second time inside a sentence *warning against hardcoded enumerations*. Replace lists with the grep that answers them.
5. **Dead links.** `node .claude/scripts/docs-sweep/prefilter.js` precomputes; the lint covers `docs/adr/`.

**Measure, don't copy.** Test totals, ADR counts, and statuses in docs are frequently stale — re-derive each (`npm test`, `grep -rh '^\*\*Status:\*\*' docs/adr/ | sort | uniq -c`) rather than carrying a number forward.

**Prove the reorg was safe.** Moving files silently breaks relative links. Baseline first, compare after:
```bash
git worktree add -f --detach /tmp/base HEAD     # pre-change baseline
# ...run the same link check in both, diff the SETS, not the counts
```
Counts alone lie: a rename changes every path string, so a naive diff reports the same dead link as both "fixed" and "introduced."

---

## Mode: `gate`

Discharge the ungated rows of `docs/tactical/adr-code-audit.md`. **DISCOVERY ONLY: do not fix, do not flip any `Status`, do not edit any ADR.**

### Why the two prior runs died

Session limits — **not logic**. The register records it: *"the session limit killed 288 of 335 refuters."* The design was **3 refuter agents per row** (127 × 3 = 381), each re-reading the ADR and code from scratch, many carrying the **419KB** register in context. A bigger budget just fails more expensively. **Do less agent work.**

| Lever | Before | Now |
|---|---|---|
| Input | agents read the 419KB register | `worklist.jsonl` — an agent gets **only its ADR's slice** (median **3.5KB**, max 9KB) |
| Unit | 1 agent per row (381) | **1 agent per ADR** (38) — reads ADR + code **once**, judges all its rows |
| Mechanical work | agents ran `test -f`/`grep` by hand | `prefilter.json` precomputes it; **11 rows resolved with zero agents** |

Projected **~98 agents instead of 381**.

### Phase 0 — ground truth + resume (no agents)

1. `git fetch --tags && git log --oneline -3 && git status --porcelain` — audit the **working tree**. `git tag` lies until you fetch.
2. `npm run lint:docs` — must be green.
3. **Resume:** if `reports/docs-sweep/results.jsonl` exists, skip every ADR already in it.
4. Regenerate inputs (cheap, idempotent):
   ```bash
   node .claude/scripts/docs-sweep/extract-worklist.js
   node .claude/scripts/docs-sweep/prefilter.js
   ```
5. Fold in the 11 pre-resolved rows: 8 `AUTO_CONFIRMED` (the ADR still *links* a path that doesn't exist — sound by construction) + 3 `LIKELY_ALREADY_FIXED` (**must** be confirmed with `git log` before recording).

**Never read `adr-code-audit.md` beyond its top "Disposition" block (~60 lines).** Reading it whole is a direct cause of both prior failures.

### Phase 1 — batched judgment: ONE agent per ADR

For each unprocessed ADR (38 total, 1–9 rows each), spawn **one** agent with, inline in its prompt: its rows from `worklist.jsonl`, its `facts` from `prefilter.json` (tell it **not to re-run those greps**), and the ADR path. It reads the ADR once, the cited code once, returns a verdict per row. Force `schema` output.

Tell it to **default to `REFUTED` when unsure** — that is what produced the honest 35% rate.

**Append to `reports/docs-sweep/results.jsonl` as each ADR completes** — not at the end. `resumeFromRunId` is **same-session only**, so disk is the only thing that survives the failure mode that killed both prior runs.

### Phase 2 — adversarial refutation of SURVIVORS ONLY

The cost lever, resting on an asymmetry:

> A false `CONFIRMED` puts a **wrong fix in the repo** — acting on the audit's "0004↔0032 missing edge" would have linked two decisions ADR 0032 explicitly records as unrelated. A false `REFUTED` merely **misses a finding**, which the lint now catches for every mechanical class anyway.
>
> **Budget goes on rows that SURVIVE, never on rows that died.**

For each ADR with ≥1 `CONFIRMED` row, spawn **2** refuters (not 3 — the third lens changed no outcome in the prior run's headline set), each judging all that ADR's confirmed rows in one context:
- **Lens A — premise:** *is the claim's stated fact true in the tree today?*
- **Lens B — sanction:** *does a convention permit this?* (`feature.md`'s addendum rule, ADR 0020's retention policy, a deliberate historical citation, the tactical-wrap lifecycle.)

Both default to refuted. A row survives only if **both** fail to refute; otherwise `REFUTED`/`PLAUSIBLE`.

### Verdicts (use exactly these)

| Verdict | Meaning |
|---|---|
| `CONFIRMED` | Real, present **today**, refutation attempted and failed. |
| `ALREADY_FIXED` | Was real; a commit fixed it. **Cite the commit.** |
| `REFUTED` | The finding is **wrong** — premise false, or a convention sanctions it. |
| `SUPERSEDED_BY_LINT` | Substance is a class `lint-docs.js` now enforces. Don't spend an agent. |
| `NEEDS_OWNER` | Real, but the remedy is a product/architecture decision. |

**`ALREADY_FIXED` is not `REFUTED`.** Collapsing them blames the audit for being *correct* and corrupts the refutation rate every future cost decision depends on. This is not hypothetical: `prefilter.js`'s first version auto-refuted rows 135/136/139 because their links resolved — they resolve *because the remediation de-linked them*. Those findings were right. When the tree looks clean, run `git log -S'<thing>' -- <file>` before concluding the finding was wrong.

### Budget + session discipline

- **Stop at ~10 ADRs per session**, or when `budget.remaining() < 80k`. Checkpoint and stop cleanly; re-running resumes. **A clean stop with 12 ADRs banked beats a session death with 30 unbanked.**
- Don't re-read the register. Don't re-run precomputed greps. Don't spawn a third lens.
- An agent returning `null` → record `UNVERIFIED` and continue. **Never infer a verdict from a dead agent.**

### Report (Phase 3)

Write `reports/docs-sweep/report.md` (≤150 lines) and post its summary: counts by verdict + **the measured refutation rate**; `CONFIRMED` rows most-severe first with file + **symbol** (line numbers drift within a month); split lenses → `PLAUSIBLE`, never `CONFIRMED`; and **what you did not reach** — silence reads as "covered everything."

Then **stop**. The owner decides what to remediate and `/feature wrap`s the register.

---

## Mode: `defossilize`

A **fossil** is residue of a superseded design that is still *readable* — so a from-scratch rewrite reads it and rebuilds the design the code already abandoned. This mode was born from exactly that: asked to "rewrite the app," an agent reproduced the retired **monolithic node panel** (color / font / icon / link / **delete** stacked in one right-deck) because the split into *deck = identity* + *top-bar strip = styling* (ADR 0030 / 0034) survived in the running app but **not** in the names, strings, comments, types, git history, and frozen docs the agent actually read.

**A fossil is not dead code.** `knip` was green the entire time. Fossils hide where static analysis cannot look: string-keyed i18n, component / folder / POM **names**, code **comments**, the **shape** of a persisted type, and **git history**. Rank every candidate on one axis only: **how strongly would it lead a from-scratch rewrite back to the retired design?** Tidiness is not the axis.

### Where fossils hide (descending pull), and the check for each

| Class | Why it misleads | Find it |
|---|---|---|
| **Git-retrievable deleted components** | `git log -p <live-file>` / `git show <old>:<deleted>` returns a complete working old UI to copy-paste | `git log --diff-filter=D --all -- '<dir>/**'`; on a *surviving* file, `git log --follow -p` reaches its tabbed/monolithic past |
| **Frozen reviews / dated CHANGELOG** | `docs/reviews/*` file-inventories list deleted components as *present source*, hundreds of lines below the one "frozen" banner | grep the corpus for the deleted symbol; forward-pointer, **never rewrite the artifact** |
| **Fossil names on live code** | a `*Tab` / `*Panel` / `*Sidebar` / `*POM` named for a deleted sibling implies that sibling still exists (e.g. `NodeInfoTab` with no tab, ex-sibling `NodeStyleTab` deleted) | grep component / folder / POM names against the deleted set; rename to what the code *does now*; move a file to its real owner's folder |
| **Orphaned i18n namespaces / keys** | a `deleteButton` / `nodeInfoTab` namespace with zero consumers tells a reader that surface exists | for each key prove **zero** non-i18n refs — mind substring traps (`openLink` ⊂ `openLinkedDiagram`) |
| **Misleading type shape** | a model hanging color / font / icon / link on a node with no marker that styling moved invites a type-driven panel that rebuilds the monolith | read the schema against the *actual edit locus*; add an ADR-cited comment naming where each field is edited |
| **Present-tense stale comments** | a live comment "mirrors NodeStyleTab" points at a deleted file as a peer | `grep <deleted-symbol> src` — any hit outside a **past-tense** migration note is a fossil |

### The protocol

1. **Establish the current design from ACCEPTED ADRs + the running render path** — not from docs. That is ground truth; everything else is measured against it.
2. **Fan out one finder per class above.** The `/audit` harness fits: parallel finders → adversarial verify, **default `REFUTED`**. Seed the static lane with `knip` + `madge --circular --extensions ts,tsx` — but they are the floor, not the ceiling.
3. **Rank by pull, not tidiness.** A git-retrievable monolith and an orphaned i18n namespace outrank a duplicated helper (the helper won't rebuild the old UI).
4. **Neutralize per class — deletion is only one tool:**
   - dead code / orphaned keys / unreachable branches → **delete** (prove zero consumers first).
   - fossil names → **rename** to current behaviour; relocate the file to its real owner.
   - stale comments → **reword to past tense.** A past-tense migration note ("moved to the strip", "replaces the former LabelColorPicker") is an **asset** — it tells a rewriter where a control went. Never scrub those; only present-tense peer references mislead.
   - frozen docs (`docs/reviews/*`, dated `CHANGELOG`) → **forward-pointer only** (same immutability rule as `consolidate`).
   - misleading types → **ADR-cited comment at the declaration**, not a deletion (the field still round-trips).
5. **Regression is mandatory** — unlike the other modes, this one edits code. The i18n **locale-completeness** test guards the 13-locale surgery; `tsc --noEmit` per workspace guards renames/moves; then full unit + `build:lib`. e2e renames: the strict-tsc noise is pre-existing (stash-and-compare to prove your files are clean) — Playwright transpiles per file.

### Traps (`defossilize`)

- **`knip` green ≠ fossil-free.** It cannot see i18n keys, names, comments, type *intent*, or git history — where every fossil in the founding case lived. Don't quote a clean `knip` as an all-clear.
- **Substring false-positives.** `grep openLink` matches the live `openLinkedDiagram`; add the trailing `:` (or `-w`) before declaring a key dead.
- **Past-tense migration comments are the cure, not the disease.** Deleting "Replaces the former X" re-opens the gap it closes.
- **You cannot de-fossilize git history.** The rewrite *brief* — not a repo edit — must forbid reconstructing UX from deleted components and name the current ADRs as the sole source of truth. That is the only fix for the top-pull class.
- **Boundary vs `/audit`:** this mode overlaps `/audit`'s dead-code lane, but it is organized around **rewrite-misleading residue**, not correctness/security. If a finding is a *bug*, it's `/audit`'s; if it's *a true statement about a design that no longer exists*, it's this mode's.

---

## Traps (all observed, all real)

1. **The register is stale on itself.** Its Priors said ADRs 0042/0043 were unreleased; v3.7.0 shipped 2026-07-14. Re-derive.
2. **Row duplication inflates counts.** Rows 20/21/22/24 were four `CONFIRMED` badges for **one** defect. Count defects, not rows.
3. **"One fact, three verdicts."** The 0012→0030 edge was gated three times under different framings → `CONFIRMED`, `PLAUSIBLE` **and** `REFUTED`. Dedupe by (file, claim) before believing a count.
4. **Frozen `docs/reviews/*`, `PLAN.md`, and memory are NOT evidence of current behaviour.** Code is.
5. **Two spellings minimum before claiming absence.** ADR 0007 was nearly filed a placeholder because `DiagnosticsOverlay.tsx` lives in `app`, not `lib`.
6. **A moved symbol is not a defect** unless the ADR's *claim* is now false.
7. **Pattern count ≠ defect count.** The audit filed the `Supersedes: none (…prose…)` anti-pattern against 10 ADRs; only **one** (0030) had a parenthetical contradicting its field. The rest read "interacts with"/"relates to"/"amends" — sanctioned.

## Verified negatives — do NOT re-raise

- The four 2026-07-15 status flips (0022/0023/0025/0028) were **RIGHT**.
- Supersession graph is a clean DAG.
- **ADR 0020 does NOT contradict its retention policy** — `decision-log.md` + `baseline.md` are DURABLE and present; `perf-results/raw/` is gitignored exactly as specified. The deletions **were the policy working.**
- **0004↔0032 is not a missing edge** — ADR 0032 explicitly records the claim it amends 0004 *"is false."*
- **ADR 0029 is clean** · **ADR 0007 is genuinely Accepted** · **ADR 0043's `BUILD_TIME_API_KEY`** is a build-time-only Picker fallback, `null` on Cloudflare.
- **0036↔0037/0042 is the corpus's best-formed supersession** — copy its shape. (An earlier brief said "0035/0036": wrong, **0035 has no supersession edges at all.**)
