# ADR 0046 — Release-Notes Generation: Body-Level Detail and Reference Integrity

**Status:** Accepted
**Date:** 2026-07-23
**Accepted on:** 2026-07-23
**Supersedes:** none
**Superseded by:** none

> Sibling: [ADR 0045 — Release Version Provenance](0045-release-version-provenance-and-in-app-surfacing.md). This ADR governs *what a release says and how it links*; 0045 governs *which version shipped and how the build learns it*. It refines the commit-message convention documented in [workflow.md](../workflow.md) and the one-commit-per-bundle output of the [`/shake-out`](../../.claude/commands/shake-out.md) loop.

## Context

Two defects make the GitHub Releases page and [CHANGELOG.md](../../CHANGELOG.md) look unprofessional.

**1. Notes are too terse to say what shipped.** The [`/shake-out`](../../.claude/commands/shake-out.md) loop deliberately lands **one coherent commit per bundle** (workflow.md), so a release that fixed nine distinct things collapses to a single conventional-commit subject:

> canvas/layers: shake-out — layer visibility, off-grid frame+render, lasso/drag for labels, connector greyscale (#81)

The `conventionalcommits` preset in [.releaserc.json](../../.releaserc.json)'s `@semantic-release/release-notes-generator` renders only the commit **subject** as the bullet — never the body. So the per-fix detail (hide-layer sentinel, off-grid transform frame, freehand-lasso label capture, greyscale connector tint, 2D rectangle bottom border, group-drag seeding, hover-gate on visibility, live drag preview, WebGL offset render) has **no home** in the released notes. There is a genuine tension to reconcile: shake-out *wants* one commit; users *want* per-fix detail.

**2. Issue links are systematically broken.** `conventional-changelog` scrapes **every** `#token` and `word/word#token` from commit subjects, bodies, and footers into an issue link. The release that prompted this ADR rendered `closes #999999 #88606c #78` — none resolve. This is not a one-off; [CHANGELOG.md](../../CHANGELOG.md) history shows the parser fabricating links from hex colours (`#1f2937`, `#2563eb`, `#a5b8f3`), test identifiers (`connector.spec#clickCanvasAt`, `CanvasPOM#dispatchAt`), SHA-like tokens (`#88606c`), invented numbers (`#999999`), and a giant `closes #54 #2 #2 #4 …` footer re-emitted verbatim in every release since `3.1.0`.

**The decisive constraint:** this project has **no issue tracker in use** — issues are reported and triaged in chat, not filed as GitHub issues. So *every* `closes #N` / issue-style reference the parser emits is, by definition, a link to something that does not exist. The robust fix is therefore not "link only real issues" (there are none) but "**stop emitting issue-reference links entirely**," while preserving the links that *are* real: the merged **PR** reference (`#81` resolves to the pull request) and the **commit hash**.

## Decision

### 1. Carry per-fix detail via the commit body, rendered into the notes

Keep `/shake-out`'s one-commit-per-bundle output. Add two coupled rules:

- **Authoring:** a bundle commit's **body** MUST contain a user-facing, per-fix bullet list (one line per fix, plain-language — the same granularity a reader needs to know what changed). This is the durable home for the detail; it lives in git regardless of tooling.
- **Rendering:** configure `@semantic-release/release-notes-generator` (via `writerOpts`) so the commit **body** is rendered beneath the subject bullet in both the GitHub Release and `CHANGELOG.md`.

This reconciles the contradiction: the commit stays bundled, and the notes gain the detail.

### 2. Suppress issue-reference links; keep PR and commit-hash links

Because there is no issue tracker, configure the notes generator to **not** turn issue-style references into links:

- **Drop** action-bearing references (`Closes`/`Fixes`/`Resolves #…` and bare stray `#token`s) so `#999999`, `#88606c`, `#1f2937`, `connector.spec#clickCanvasAt`, etc. never render as links.
- **Keep** the merged-PR reference (the trailing `(#81)`) and the commit-hash link — both resolve correctly.

Implement via a `writerOpts.transform` (or equivalent preset lever) that filters `commit.references` down to the bare PR mention and clears the rest. See Implementation notes.

### 3. Commit-message hygiene (no CI lint gate)

Document in [workflow.md](../workflow.md)'s commit convention that, **while no issue tracker is in use**, commits do not carry `Closes #N` / issue footers — there is nothing to close. No CI lint gate is added: Decision 2 makes stray references harmless at render time, so a gate would be maintenance cost for a tracker that does not exist. **If an issue tracker is ever adopted, Decisions 2 and 3 must be revisited** (re-enable real-issue linking).

## Consequences

**Positive:**
- Release notes describe what actually shipped, at per-fix granularity, without abandoning shake-out bundling.
- No more dead links — output is robust even when an author pastes a hex colour, SHA, or code identifier containing `#`.
- Zero dependence on an issue tracker the project does not use.

**Negative / risks:**
- Rendering the commit body means the body must stay **user-facing** — internal chatter or scratch notes would leak into the changelog. `/shake-out` must author a clean, release-ready body (add to its checklist).
- `writerOpts` customization adds a small maintenance surface to `.releaserc.json`; the transform must be kept in step with any `conventional-changelog` major bump.
- Suppressing issue references is correct *only while there is no tracker* — this is a conditional decision, flagged in Decision 3.

## Implementation notes (non-binding)

- Implemented as a custom conventional-changelog `config` module, [scripts/release-changelog-preset.mjs](../../scripts/release-changelog-preset.mjs), wired via `.releaserc.json` → release-notes-generator `{ "config": "./scripts/release-changelog-preset.mjs" }`. It wraps the `conventionalcommits` preset (keeping its type→section map): the wrapped `transform` (a) carries `commit.body` through — the preset strips it — indented so it nests under the bullet, and (b) clears `commit.references` so the `, closes …` list disappears. The real PR link survives because the preset linkifies the `(#N)` **in the subject** *before* references are cleared. The `commitPartial` is extended to render the body beneath the standard line.
- Clearing references in the transform was chosen over `parserOpts.issuePrefixes: []` (an empty prefix list makes the reference regex match every token) and over an action-based filter (a `#hex` or a fabricated-but-numeric `#999999` is indistinguishable from a real issue when there is no tracker).
- Keep the changelog title/preamble already configured in `@semantic-release/changelog`.

## Acceptance criteria

- **Offline validation (detail):** running `generateNotes` (the exact function semantic-release calls) with the custom config against a shake-out bundle-commit fixture whose body lists the nine fixes renders those nine lines nested under the release entry. *(Validated — see the PR description.)*
- **Offline validation (links):** the same run shows **no** dead issue links — a body containing `#999999`, `#88606c`, and `#1f2937` produces zero issue links, while the PR reference `(#81)` and the commit hash still link correctly. *(Validated.)*
- **Doc:** [workflow.md](../workflow.md)'s commit convention states the "no issue-footer while no tracker" rule and the revisit-if-adopted caveat.
