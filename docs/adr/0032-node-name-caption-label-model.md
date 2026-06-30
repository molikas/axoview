# ADR 0032 — Node Name / Caption / Label Model (Option A)

**Status:** Accepted
**Date:** 2026-06-29
**Supersedes:** none (retires the on-canvas rich **caption**; relates to [ADR 0029](0029-sanitize-user-authored-html.md) since the description is user-authored HTML)
**Superseded by:** none

> **Correction of record:** a project note claimed this model "amends [ADR 0004](0004-connector-name-and-details-panel.md)." That is **false** — ADR 0004 is connector-only (connector `name`/`notes` parity). The node name/caption model has had **no ADR**; this is it.

## Context

The spike (commit `894cb3b2`) shipped the "Option A" (Figma derive-then-override) name/caption model for **nodes**, but with no decision of record. Before it, a node could carry a rich on-canvas **caption/description** in addition to its `name`. Option A collapses identity to a single on-canvas string (the `name`) and relocates the rich text into the node's **Notes**.

This is a **data-model + load-migration + UX** decision, and unlike the new Label/border/B-I-S fields it touches **pre-existing user data**: real saved diagrams already contain node `description` content. The "no installed base" zero-migration carve-out (see [ADR 0031](0031-floating-label-entity-model.md)) **does not apply here** — the fold relocates data users already have, so the behavior must be explicit and documented.

## Decision

1. **`name` is the sole on-canvas identifier** (unchanged): non-empty renders the label, empty hides it, F2 renames it.
2. **The rich `description` folds into `notes` at load** — idempotent (re-loading a folded diagram is a no-op), with a **block separator** between any prior notes and the folded description. (The earlier `${notes}${description}` concatenation had **no separator** — **fixed**: [`src/utils/foldNodeDescription.ts`](../../packages/axoview-lib/src/utils/foldNodeDescription.ts) now inserts a `<hr />` block separator, exported as `NOTES_FOLD_SEPARATOR`, between prior notes and the folded description. The fold is idempotent and unit-tested.)
3. **`description` is retained in the schema** for external/round-trip fidelity but **deleted from the working model** after the fold, so the canvas never re-derives an on-canvas caption.

### On-canvas caption disposition — RESOLVED

**Resolved (2026-06-30): (a) full retire (pure Option A).** The canvas draws `name` only; the rich caption folds into Notes; extra near-node annotation is served by the floating **Label** ([ADR 0031](0031-floating-label-entity-model.md)). Paths (b) limited plain subtitle and (c) present-mode-only were considered and **DECLINED** — identity clarity + the Canvas2D perf budget (rich on-canvas text is the expensive path the engine work avoids) outweighed the attachment benefit (a floating Label is independent, not bound to the node). This RATIFIES the shipped status quo, so points 2–3 (the `description`→`notes` fold) are **final/unconditional**.

For the record, the three candidate paths considered — **(a) chosen**:

- **(a) Full retire (the spike / pure Option A) — CHOSEN.** Caption→Notes; canvas shows `name` only. Cleanest identity model; best for Canvas2D perf (no rich HTML on the canvas hot path — pairs with the [ADR 0020](0020-engine-perf-harness-and-measurement-protocol.md) perf gate). Extra annotation is served by the new **floating Label** ([ADR 0031](0031-floating-label-entity-model.md)) — *"need text near a node? drop a Label."* Accepted tension: a Label is **independent**, not bound to the node (doesn't move with it).
- **(b) Keep a limited caption, aligned to the new model — DECLINED.** A single **secondary line** under the name, **plain text** (not rich), styled via the strip — consistent with the B/I/S model and cheap to render. The *rich* part still folds into Notes, but a lightweight on-canvas subtitle survives. Needs a schema field + a placement rule.
- **(c) Caption in view/present mode only — DECLINED.** Edit-mode canvas shows `name` only; the info popover / presentation surface ([ADR 0012](0012-view-mode-node-info-popover.md)) renders the rich caption. Keeps the editing canvas clean while preserving rich content for presentation.

Deciding tensions: **identity clarity** (one on-canvas string vs two), **Canvas2D perf** (rich on-canvas text is the expensive path the engine work avoids), and **attachment** (does the use-case need text *bound* to the node, which a floating Label is not). The `PLAN.md` L904 "render rich caption on Canvas2D" line is retired by this decision.

**Resolved (2026-06-30): Name-field location — KEEP NAME IN DETAILS.** The Details tab **retains the Name field**, which co-hosts the **inline link button** (edits `ModelItem.headerLink`) and the **show/hide-name toggle** (edits `ViewItem.showLabel`). Rename is also available via **Layers (F2) + canvas (F2)**, but nothing is re-homed and the right panel stays the two-tab **Details / Notes** shape. This is consistent with [ADR 0030](0030-docked-style-controls-strip.md) (panel = Details/Notes) and the §5.1 amendment.

> Resolved (2026-06-30): (1) caption disposition → **(a) full retire**; (2) Name-field location → **keep in Details**.

## Consequences

**Positive:**
- One identity model for nodes (name on canvas; rich text in Notes) — consistent with the connector model and the §5 parity story.
- Eliminates the two-string on-canvas ambiguity (name vs caption).

**Negative / risks:**
- Pre-existing `description` content is **relocated** (to Notes) on first load — visible change for users who relied on on-canvas captions. Mitigated by lossless preservation + the (optional) notice.
- The fold must be idempotent and separator-correct or it corrupts/concatenates notes — covered by the acceptance tests.

## Implementation notes (non-binding)

- **Done:** the missing block separator between `notes` and the folded `description` is fixed — [`src/utils/foldNodeDescription.ts`](../../packages/axoview-lib/src/utils/foldNodeDescription.ts) inserts `<hr />` (`NOTES_FOLD_SEPARATOR`), idempotently.
- **Done:** fold unit tests cover idempotency on re-load, both-present concatenation (with separator), empty-skip, and `description`-deleted-from-working-model ([`src/utils/__tests__/foldNodeDescription.test.ts`](../../packages/axoview-lib/src/utils/__tests__/foldNodeDescription.test.ts)).
- Retire the stale `PLAN.md` line referencing on-canvas rich caption (project memory `naming_model_decision` flags it as L904) as part of the wrap.

## Acceptance criteria

- **Unit:** the fold is idempotent (load → save → load yields identical notes); prior notes + description are joined by a separating block; an empty description is skipped; `description` is absent from the working model post-fold but preserved on export round-trip.
- **Manual:** a legacy diagram with a node description opens with that text in Notes (popover in view mode), and the canvas shows only the `name`.
- **Doc:** this ADR does **not** claim to amend ADR 0004; the project memory note is corrected.
