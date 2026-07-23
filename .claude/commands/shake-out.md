# /shake-out — Iterative Bug-Fix & Polish Loop

A workflow for sessions where the goal is **smoothing what's already shipped**, not building new features. Use this when handed a list of UI bugs, paper-cuts, or rough edges to clean up before a release.

> **Read first when fixing UI:** [`docs/guidelines/ux-principles.md`](../../docs/guidelines/ux-principles.md) — the Axoview design language. A "polish" fix that violates the principles is a regression, not a polish.
>
> **Surface vocabulary is locked:** when a polish fix introduces or renames an overlay or full-area surface, the canonical Modal / Dialog / Popover / Panel / Banner / Screen vocabulary lives in [ADR 0008 Decision 2](../../docs/adr/0008-naming-convention.md). Pick the term whose visual contract matches yours — do not invent a sixth.

The `$ARGUMENTS` text (if any) should be the issue list. If none is given, scan recent commits and `known_issues.md` for candidate issues and ask the user to pick.

## Posture

- **Reversible bias.** Edits are local and recoverable. Don't ask permission for each file edit. Do ask before destructive actions (force push, branch delete, dependency removal).
- **One issue at a time — unless the user batches.** Default is per-issue verification: each fix gets confirmed before you move on. If the user explicitly bundles ("fix all three", "do them together"), you may verify them as a group and ship one commit covering the bundle.
- **Honest about what didn't work.** If attempt #1 fails, say so. Don't paper over it with a second guess.
- **No proactive refactoring.** This is polish, not architecture. If a fix tempts you to rename a file or extract a helper, resist unless the user asks.

## The loop

### 1. Triage (do this first, before any code reads)

Restate each issue back to the user as a one-line bullet, in your own words, and ask:

- Have they already attempted a fix? (Avoid redoing failed work.)
- Is each one in scope for this session, or should some be deferred to `known_issues.md`?
- Any priority order, or just go top-down?

Write the agreed list as TodoWrite items. One todo per issue.

If the session crosses a context-summary boundary, **resume from the existing TodoWrite list and the most recent commit** — don't re-triage. The user already decided priorities; the boundary doesn't reset them.

### 2. Scope-narrow before reading code

Default search scope is **uncommitted local changes**, not full git history:

```bash
git status --short
git diff
git diff --staged
```

Only widen to recent commits (`git log --oneline -10`) or full repo if the symptom predates the local diff. State this scope choice out loud before reading.

**Pre-existing failures are out of scope.** Test failures present on the base SHA before any session work (run `git stash && npm test … && git stash pop` to confirm if unsure) do not belong in the shake-out loop. File them in `known_issues.md` if not already there. Don't try to fix them unless the user explicitly asks — they'd derail the loop and the green-baseline rule.

### 3. Diagnose-then-fix per issue

For each issue, in order:

1. **Read** the relevant files. Don't grep blindly — use file paths the user gave you, or trace from the symptom (event handler → store action → reducer).
2. **Hypothesize or propose** before editing — pick the right one for the issue:
   - **Diagnosis (single root cause):** one sentence — *"I think X is happening because Y."* Then go.
   - **Design choice (multiple reasonable answers — UX wording, API shape, which-of-several-approaches):** write a brief proposal and **wait for the user's nod** before coding. Cheaper to course-correct in prose than after a build. **If the user rejects the first design, the second attempt is also a design choice — write another proposal before coding, don't just iterate.** Three rejected designs in a row = stop and ask the user to describe their target UX in concrete steps (cursor shape, click target, panel anchor, trigger event, etc.) before proposing again. Iterating on code after a rejected design is how a "polish fix" turns into a four-pass redesign.
3. **Edit.** Make the fix.
4. **Build if necessary.** This monorepo's app consumes built artifacts of `axoview-lib`. After editing anything under `packages/axoview-lib/src/`, run `npm run build:lib` so the app picks up the change. Skip the build only when the edit is purely under `packages/axoview-app/src/` (rsbuild HMR handles those).
5. **Hand off to user** for verification. Don't move on until they confirm "fixed" or "still broken."

### 4. Add diagnostics on attempt #2

If the first fix didn't land, **don't throw a second guess at it**. Add console.log diagnostics to the relevant code path:

- Log entry to the handler with key state (`isEditing`, `selectedId`, etc.)
- Log inside async callbacks / `requestAnimationFrame` to catch state-after-yield
- Wrap suspect calls in try/catch and log the result

Ask the user to reproduce and paste the console output. Use that to drive attempt #3.

**When verification fails, treat your diagnosis as a hypothesis, not a fact.** Diagnostics on attempt #2 should focus on *falsifying* the original diagnosis, not confirming it. If the output exposes a different shape of bug than you guessed, write a new diagnosis sentence before you write more code — even if the new one feels like a refinement.

**The green-test trap:** if your unit test for the bug passes but the user still reports the bug in the live app, **your test is wrong** — it doesn't reproduce the live condition. Don't use the green test as a falsifier ("can't repro, must be elsewhere"). Instead: write a test that *fails first* against the user's symptom, then fix. A passing test that exercises the same buggy code path without asserting the user-visible failure is worse than no test — it gives false confidence and delays the round-trip with the user.

If attempt #3 still doesn't fix it, propose moving the bug to `known_issues.md` rather than spinning further.

### 5. Document the trail at the end

**Default to skipping this step.** Bug fixes alone live in the commit message — that's enough. Only touch the artifacts below if a fix changed an invariant an ADR documents, relates to an in-flight tactical plan, or you're parking a bug as known/unresolved. Don't ceremonially update docs for the sake of it.

If artifacts do need updating, **do it in one batch at the end of the session, not after every fix.**

| Artifact | When to touch |
|---|---|
| [docs/tactical/`<plan>`.md](../../docs/tactical/) | If the fix relates to an in-flight tactical plan: mark sub-tasks `[x]`, update the Status header, add a "Polish on top of scope" section for fixes that landed outside original scope. |
| [docs/adr/`<n>`-*.md](../../docs/adr/) | Only if a fix changed an invariant the ADR documents. Add a dated note inside the existing decision section — don't write a new ADR for a bug fix. |
| [known_issues.md](../../known_issues.md) | Append any unresolved bug with: symptom, workaround, status. Create the file if it doesn't exist. |
| `MEMORY.md` (auto-memory) | Add a feedback memory only if the user gave durable preference guidance (e.g. "always strip secrets before commit", "never amend"). Skip for one-off task context. |

Project doc conventions (see [docs/workflow.md](../../docs/workflow.md); the `project_docs_convention.md` memory, if present, is an optional cache): ADRs in `docs/adr/`, tactical plans in `docs/tactical/`, both lifecycle-aware (tactical doc gets deleted at merge time per its own wrap-up section).

### 6. Commit and push

Single coherent commit covering all fixes from the session.

- Stage explicit paths, not `git add -A`.
- Message style matches recent `git log` here: lowercase prefix (`feat:` / `fix:` / `chore:` / `docs:`), short title. The **body** must carry a user-facing, per-fix bullet list (one plain-language line per fix): the release-notes generator renders the commit body into the GitHub Release and `CHANGELOG.md` ([ADR 0046](../../docs/adr/0046-release-notes-generation-and-reference-integrity.md) §1), so keep it release-ready — no internal scratch notes.
- Co-author trailer per repo `CLAUDE.md` instructions. No `Closes #N` / issue-reference footers — the project uses no issue tracker (issues are triaged in chat), so there is nothing to close ([ADR 0046](../../docs/adr/0046-release-notes-generation-and-reference-integrity.md) §3).
- Push to the current branch. Don't open a PR unless the user asks.

If multiple unrelated bug-classes were fixed, ask the user whether to split into multiple commits.

## What's deliberately not in this loop

- **Tests** — unless the bug class warrants one (e.g. an ADR invariant slipped). Tactical fixes don't always need tests; over-testing slows the loop.
- **Refactors / cleanup** — this is polish, not architecture. If you spot a god-file or circular dep, mention it once and move on. Use `/audit` for that work.
- **PR / release prep** — ship to branch; release flow is a separate concern.

## Reference

- Slash command lives at `.claude/commands/shake-out.md` — **tracked in git** (`.claude/commands/` is exempted from the `.claude` `.gitignore` rule), so edits are versioned and shared with collaborators.
- Sibling: [`/audit`](audit.md) — the heavy quality/architecture sweep. Use that one when you need depth, not the shake-out loop.
