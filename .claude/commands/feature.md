# /feature — Axoview Feature Bootstrap & ADR/Tactical Maintainer

Bootstrap a new feature against the Axoview docs convention (ADRs in `docs/adr/`, short-lived tactical plans in `docs/tactical/`, strategic phases in `PLAN.md`). Also handles ADR addendums, supersession, and tactical wrap-up.

> **Read first when the feature touches UI:** [`docs/ux-principles.md`](../../docs/ux-principles.md) — the consolidated design language for Axoview (layout, affordances, keyboard, item-type parity). Mirror existing patterns rather than introducing new ones.

## Modes

The argument selects a mode. If no argument is given, ask the user which one.

| Mode | Trigger | What it does |
|---|---|---|
| `start <short feature description>` | Default starting point for a brand-new feature. | Reads the docs landscape, asks scoping questions, scaffolds new ADR(s) and (optionally) a tactical doc. |
| `extend <ADR-number> <what to add>` | An in-flight feature reveals a new constraint that fits inside an existing ADR. | Drafts a dated addendum block in the ADR (mirrors ADR 0003's `2026-05-02:` paragraph) — does **not** spawn a new ADR. |
| `supersede <old-ADR-number>` | A new decision replaces an old one. | Creates a new ADR with proper Supersedes/Superseded-by cross-links and flips the old ADR's `Status` to `Superseded`. |
| `wrap <tactical-topic>` | Tactical work is shipped + smoke-tested. | Adds the one-line entry to `PLAN.md`, deletes the tactical doc, refreshes memory pointers. |

## Phase 0 — Read the docs landscape (every mode)

Before doing anything else, in parallel:

1. Read `docs/adr/` (`ls` + `Read` each ADR's header — Status, Date, Supersedes/Superseded-by lines are enough; full body only when the mode targets a specific ADR).
2. Read `docs/tactical/` index (`ls` + skim the `Status:` line of each).
3. Read `PLAN.md` headings (Phase Status Dashboard) to know which phase a new feature lands under.
4. Read the convention memory: `C:\Users\isidenica\.claude\projects\c--myTemp-FossFLOW\memory\project_docs_convention.md`.
5. If any related decision-pointer memories exist (e.g. `project_2br_decisions.md`), read those too.

Use this snapshot to pick the next ADR number, detect naming collisions, and answer "does this feature already have a tactical doc?" without asking the user.

## Mode: `start`

### Phase 1 — Scope the feature (ask before scaffolding)

Ask the user **at most 4 short questions**, batched into one prompt. Skip any question whose answer is obvious from the description.

1. **ADR-worthiness** — Is there a durable architectural decision here, or is it pure UI/wiring? (No ADR for "rename the button to X." Yes ADR for "switch persistence layer from localStorage to IndexedDB.")
2. **Number of ADRs** — One concern per file. If the feature mixes a storage decision and a UI contract, that's two ADRs.
3. **Tactical doc?** — Does the implementation span >1 session, >1 package, or coordinate ≥3 sub-tasks across files? If yes, scaffold a tactical doc; if no, skip it.
4. **PLAN.md phase** — Which phase does this land under? (Default: the most recent active one.)

If the user says "you decide," apply these defaults:
- Spans `axoview-lib` + `axoview-app` → tactical doc.
- Touches a persistence/format/contract surface → at least one ADR.
- Single-file UI tweak → no ADR, no tactical, just do the work.

### Phase 1.5 — Ripple / consequences pass (mandatory before scaffolding)

A per-issue study is coherence-blind by construction. Before scaffolding, run an **experience-level** pass over the proposed changes together (workflow.md Principle 7). For each change, name and resolve:

- **Redundant** — what control / settings section / affordance does this make pointless? (Plan its removal — a dead toggle is debt.)
- **Contradicts** — does it collide with another proposed change or an existing affordance? (Reconcile; don't scaffold both sides of a contradiction.)
- **Orphaned** — does it leave related functionality drifting, or **lean on a surface that doesn't exist?** **Grep to confirm** every surface a plan references ("put it in the X menu / panel / dock") is real — if not, that's a build dependency to call out, not an assumption.

Reconcile against mirroring surfaces: selection two-way sync ([ux-principles §4.1](../../docs/ux-principles.md)), item-type parity (§5), the edit/view/present split (§11). Surface these findings to the user **unprompted** as part of the study — "if we do X, then Y no longer makes sense / Z has no home" is the expected move. A scaffolded plan that contains an internal contradiction or a phantom surface has failed this phase.

### Phase 2 — Scaffold ADR(s)

Pick the next sequential number (zero-padded to 4). Create `docs/adr/NNNN-kebab-title.md` using this template. Required sections in **bold** — others may be omitted if genuinely N/A.

```markdown
# ADR NNNN — Title Case Decision

**Status:** Proposed       <!-- Proposed | Accepted | Superseded -->
**Date:** YYYY-MM-DD
**Supersedes:** none       <!-- or: ADR NNNN -->
**Superseded by:** none

## Context

<Why this decision is needed now. What's broken, missing, or about to change. Reference concrete code paths with [text](relative/path.ts) links — the existing ADRs do this.>

## Decision

<The actual decision, stated declaratively. Include code blocks, JSON shapes, file layouts as needed (see ADR 0001's manifest example).>

## Consequences

**Positive:**
- ...

**Negative / risks:**
- ...

## Implementation notes (non-binding)

<Library choices, file locations, helpers. Marked non-binding so they can drift without invalidating the decision.>

## Acceptance criteria

- **Unit test:** ...
- **Manual verification:** ...
```

After writing, update the **Existing ADRs** list in `project_docs_convention.md` memory (one new bullet, sorted by number). Bump the date in that memory's heading.

### Phase 3 — Scaffold tactical doc (if Phase 1 said yes)

Create `docs/tactical/<topic>.md` (kebab-case topic). Use this template — copy the structure of [docs/tactical/layout-revamp.md](../../docs/tactical/layout-revamp.md) verbatim where in doubt. Every new tactical's "Read first" block links [docs/workflow.md](../../docs/workflow.md) as a baseline.

```markdown
# Tactical — <Title>

> **Read first:**
> - [ADR NNNN — Title](../adr/NNNN-title.md)
> - <one bullet per related ADR>
>
> **Status:** Not started · **Owner:** <user> · **Last updated:** YYYY-MM-DD
>
> This is a **short-lived working doc.** Delete it after the work merges; ADRs are the durable record. PLAN.md gets a one-line entry referencing the ADRs once shipped — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read each linked ADR.
3. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
4. Use `TodoWrite` to track sub-tasks below.
5. Mark `[x]` as work completes.
6. On completion, follow the "Wrap-up" section to update PLAN.md with a single line.

## Goal

<2-4 sentences. What changes for the user / system. What is explicitly *not* a goal.>

## Scope

### In scope
- ...

### Out of scope
- ...

## Locked decisions (from design discussion YYYY-MM-DD)

| # | Decision |
|---|---|
| 1 | ... |

## Sub-tasks

### A. <First logical group>
- [ ] ...

### B. <Second>
- [ ] ...

## Wrap-up

When all sub-tasks are complete and the smoke checklist passes:

1. Add a single line under `PLAN.md` Phase <X> section:
   ```
   - <Feature> shipped — see docs/adr/NNNN..NNNN and (this file's git history).
   ```
2. Delete this file. The ADRs are the durable record; this checklist's job is done.
3. Update memory pointer `<relevant memory>` if any decisions here supersede or extend it.

## Notes for Claude

- <Surface-specific traps. E.g. "this touches two packages, build after every section."> 
- <Anything load-bearing about ordering, coupling, or things-that-look-wrong-but-aren't.>
```

After writing, add a `**Active tactical docs:**` bullet to `project_docs_convention.md` memory.

### Phase 4 — Hand off

Print a short summary listing exactly what was created/edited and what the user should do next (review the locked-decisions table, fill in sub-tasks, etc.). Do **not** start implementing the feature in the same turn.

## Mode: `extend`

When a small new constraint or follow-up belongs *inside* an existing ADR rather than as a new one (e.g. ADR 0003's `requiredPacks` addendum on 2026-05-02):

1. Read the target ADR fully.
2. Append a dated paragraph to the **Decision** section in this exact shape:
   ```
   **YYYY-MM-DD:** <new constraint, why it was needed, how it interacts with the original decision.>
   ```
3. If the addition introduces new acceptance criteria, append them to the bottom of the existing **Acceptance criteria** list (don't rewrite the originals).
4. Leave Status as `Accepted` — addendums don't supersede.
5. Do **not** touch the convention memory unless the addendum changes the ADR's one-line summary there.

## Mode: `supersede`

1. Read the old ADR.
2. Create a new ADR via the `start` template, with `**Supersedes:** ADR NNNN` filled in.
3. Edit the old ADR: `**Status:** Superseded` and `**Superseded by:** ADR MMMM`. Leave the rest of the body intact for historical record.
4. Update the convention memory's ADR list — the new ADR's bullet replaces the old one's purpose, but keep the old number listed (with `(superseded)` suffix) so cross-references in git history still resolve.

## Mode: `wrap`

1. Read the tactical doc fully and confirm with the user that all sub-tasks are checked off.
2. Identify the relevant `PLAN.md` phase from the doc's "Wrap-up" section. Append the single-line entry under that phase — do not edit anything else in `PLAN.md`.
3. Delete the tactical doc file.
4. Refresh memory:
   - Remove the `**Active tactical docs:**` bullet for this topic from `project_docs_convention.md`.
   - If the doc had a paired decision-pointer memory (e.g. `project_2br_decisions.md`), check whether any of its content needs to be moved/superseded now that the tactical scaffolding is gone.
5. Print a one-line confirmation with the deleted path and the PLAN.md line that was added.

## Hard rules (every mode)

- **Never edit `PLAN.md` phase content** outside the `wrap` mode's one-line append. PLAN.md is a strategic dashboard, not a feature log.
- **Never edit a retired tactical doc without confirmation.** Check the file's wrap-up status first (deleted tacticals are retired; ADRs are the durable record). The Cloudflare track's durable decisions now live in [ADR 0009](../../docs/adr/0009-deployment-topology.md) + [ADR 0010](../../docs/adr/0010-session-backend-contract.md).
- **One concern per ADR.** If a feature naturally splits, scaffold two ADRs and link them mutually in the **Context** sections.
- **Date everything in absolute form** (`YYYY-MM-DD`), never "today" or "this week" — these docs outlive the conversation.
- **Don't invent decisions.** If the user hasn't decided on something the template asks for (e.g. backward-compat behavior), leave a `> TODO: <question>` block in the section instead of guessing.
- **Don't begin implementation** in the same turn as scaffolding. The point of the skill is to get the docs right *first* so implementation is grounded.
- **Trace the ripple (Phase 1.5 is not optional).** No ADR or tactical ships with an internal contradiction, a redundant-but-unremoved control, or a reference to a surface that doesn't exist. Grep before asserting a home for any command/affordance. Whole-experience coherence is the skill's job, not the user's review. See workflow.md Principle 7 + [[feedback_whole_experience_coherence]].
