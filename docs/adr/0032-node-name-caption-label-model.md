# ADR 0032 — Node Name / Caption / Label Model (Option A)

**Status:** Proposed
**Date:** 2026-06-29
**Supersedes:** none (retires the on-canvas rich **caption**; relates to [ADR 0029](0029-sanitize-user-authored-html.md) since the description is user-authored HTML)
**Superseded by:** none

> **Correction of record:** a project note claimed this model "amends [ADR 0004](0004-connector-name-and-details-panel.md)." That is **false** — ADR 0004 is connector-only (connector `name`/`notes` parity). The node name/caption model has had **no ADR**; this is it.

## Context

The spike (commit `894cb3b2`) shipped the "Option A" (Figma derive-then-override) name/caption model for **nodes**, but with no decision of record. Before it, a node could carry a rich on-canvas **caption/description** in addition to its `name`. Option A collapses identity to a single on-canvas string (the `name`) and relocates the rich text into the node's **Notes**.

This is a **data-model + load-migration + UX** decision, and unlike the new Label/border/B-I-S fields it touches **pre-existing user data**: real saved diagrams already contain node `description` content. The "no installed base" zero-migration carve-out (see [ADR 0031](0031-floating-label-entity-model.md)) **does not apply here** — the fold relocates data users already have, so the behavior must be explicit and documented.

## Decision

1. **`name` is the sole on-canvas identifier** (unchanged): non-empty renders the label, empty hides it, F2 renames it.
2. **The rich `description` folds into `notes` at load** — idempotent (re-loading a folded diagram is a no-op), with a **block separator** between any prior notes and the folded description. (The current implementation concatenates `${notes}${description}` with **no separator** — this is a defect to fix as part of ratification.)
3. **`description` is retained in the schema** for external/round-trip fidelity but **deleted from the working model** after the fold, so the canvas never re-derives an on-canvas caption.
**Open decision — on-canvas caption disposition (reopened 2026-06-29).** The spike fully retired the on-canvas rich caption (canvas draws only `name`). The user has **reopened** this: there may be limited use-cases where on-canvas secondary text is wanted ("keep it, but unsure how to align it to the overall UX"). Three candidate paths, to be resolved **before** slices A3/C1 land (tactical Slice 0):

- **(a) Full retire (the spike / pure Option A).** Caption→Notes; canvas shows `name` only. Cleanest identity model; best for Canvas2D perf (no rich HTML on the canvas hot path — pairs with the [ADR 0020](0020-engine-perf-harness-and-measurement-protocol.md) perf gate). Extra annotation is served by the new **floating Label** ([ADR 0031](0031-floating-label-entity-model.md)) — *"need text near a node? drop a Label."* Tension: a Label is **independent**, not bound to the node (doesn't move with it).
- **(b) Keep a limited caption, aligned to the new model.** A single **secondary line** under the name, **plain text** (not rich), styled via the strip — consistent with the B/I/S model and cheap to render. The *rich* part still folds into Notes, but a lightweight on-canvas subtitle survives. Needs a schema field + a placement rule.
- **(c) Caption in view/present mode only.** Edit-mode canvas shows `name` only; the info popover / presentation surface ([ADR 0012](0012-view-mode-node-info-popover.md)) renders the rich caption. Keeps the editing canvas clean while preserving rich content for presentation.

Deciding tensions: **identity clarity** (one on-canvas string vs two), **Canvas2D perf** (rich on-canvas text is the expensive path the engine work avoids), **attachment** (does the use-case need text *bound* to the node, which a floating Label is not), and the unretired `PLAN.md` L904 ("render rich caption on Canvas2D"). If a path other than (a) is chosen, the `description`→`notes` fold (points 2–3) is replaced or scoped to that path.

**Related open decision — Name-field location (raised 2026-06-29).** Whether to **remove the Name field from the Details panel** and rename only via **Layers (F2) + canvas (F2)**, leaving the right panel as **Notes (+ type-specific)**. Ripple to resolve before committing: the Name row today co-hosts the **inline link button** and the **show/hide-name toggle** — removing Name strands those, so they need a home (keep a minimal name row? move link/show-hide to the strip or the context menu?). This interacts with [ADR 0030](0030-docked-style-controls-strip.md) (panel = Details/Notes) and the §5.1 amendment, so it is settled **alongside A1**.

> TODO (resolve in tactical Slice 0, before A1/A3/C1): (1) caption disposition — (a) retire / (b) limited plain subtitle / (c) present-only; (2) Name-field location — keep in Details vs Layers/F2-only.

## Consequences

**Positive:**
- One identity model for nodes (name on canvas; rich text in Notes) — consistent with the connector model and the §5 parity story.
- Eliminates the two-string on-canvas ambiguity (name vs caption).

**Negative / risks:**
- Pre-existing `description` content is **relocated** (to Notes) on first load — visible change for users who relied on on-canvas captions. Mitigated by lossless preservation + the (optional) notice.
- The fold must be idempotent and separator-correct or it corrupts/concatenates notes — covered by the acceptance tests.

## Implementation notes (non-binding)

- Fix the missing block separator between `notes` and the folded `description`.
- Add fold unit tests: idempotency on re-load, both-present concatenation (with separator), empty-skip, `description`-deleted-from-working-model.
- Retire the stale `PLAN.md` line referencing on-canvas rich caption (project memory `naming_model_decision` flags it as L904) as part of the wrap.

## Acceptance criteria

- **Unit:** the fold is idempotent (load → save → load yields identical notes); prior notes + description are joined by a separating block; an empty description is skipped; `description` is absent from the working model post-fold but preserved on export round-trip.
- **Manual:** a legacy diagram with a node description opens with that text in Notes (popover in view mode), and the canvas shows only the `name`.
- **Doc:** this ADR does **not** claim to amend ADR 0004; the project memory note is corrected.
