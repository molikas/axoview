# ADR 0032 — Node Name / Caption / Label Model (Option A)

**Status:** Accepted (Decision §1 superseded by the 2026-06-30 amendment below)
**Date:** 2026-06-29
**Supersedes:** none (retires the on-canvas rich **caption**; relates to [ADR 0029](0029-sanitize-user-authored-html.md) since the description is user-authored HTML)
**Superseded by:** none

---

## Amendment (2026-06-30) — decouple the on-canvas `label` from the identity `name`

> **What this changes:** Decision **§1** ("`name` is the sole on-canvas identifier") is **superseded**. The `description`→`notes` fold (§2–§3) is **unchanged** — this amendment only changes *which field draws on the canvas* and *where each field is edited*. Driven by owner UX-sweep item #4 (the **#1 cross-persona confusion**: three testers typed in "Name" and nothing appeared on the shape — Devin D1/D11, Tomás T3).
>
> This is a **zero-migration addition** on the unpushed `integration` branch (a new optional field, seeded at load — see ADR 0031's carve-out reasoning). It does **not** create a migration converter.

### New decision

1. **`label` is the on-canvas text** — a new optional field on `modelItem` (it is *content*, peer to `name`/`notes`, not view geometry, so it lives on the model item, not the view item). Non-empty draws the chip; empty (explicit `''`) hides it; the existing `viewItem.showLabel` gate is unchanged and now gates the `label`.
2. **`name` is the identity string only** — shown and renamed in the **Layers** panel; **hidden from the canvas**. It remains on `modelItem` (and remains the Layers/identity/search string).
3. **Render source = `label ?? name`.** Every on-canvas label site (Canvas2D `NodesCanvas`, the DOM `Node` overlay, the `NodeLabelHitLayer` chip-measure) reads `label`, falling back to `name` when `label` is absent. The fallback means a node that never had a `label` set still shows its `name` — so nothing visibly changes before the seed runs and brand-new nodes (created with `name:'Untitled'`, no `label`) still show text.
4. **Seed `label = name` at load** (critical — installed base). `seedNodeLabel` runs in the load normalization chokepoint (`useInitialDataManager`, right after `foldNodeDescription`), pure + idempotent: it copies `name`→`label` only when `name` is non-empty and `label` is absent. After load every saved node carries an explicit `label`, so renaming the identity `name` in Layers no longer moves the canvas text — the decouple is immediate for existing diagrams, with **no diagram visibly changing**.
5. **Edit entry points:**
   - **Canvas** F2 / double-click inline-rename → edits **`label`** (the on-canvas text).
   - **Details (right deck)** primary text field → renamed **"Label"**, edits **`label`** (owner decision 2026-06-30: the field the user types into is the one that shows on the shape — directly resolving the #1 confusion). The link button + show/hide toggle still co-host this field.
   - **Layers** row rename → edits **`name`** (identity), unchanged.

### Scope

**NODE only.** RECTANGLE and TEXTBOX are already decoupled (their `name` is Layers-only and never drew on canvas). CONNECTOR name-as-label is **out of scope** (left as-is). The `description`→`notes` fold and the "keep Name in Details" resolution of the original ADR are **superseded only for nodes** to the extent above; the Details panel for a node now hosts **Label** (not Name), with identity rename in Layers.

### Why on `modelItem` not `viewItem`

`label` is the node's *content* — the same in every view, like `name`/`notes`/`icon` — not view-local geometry (which is what `viewItem` carries: tile, `labelHeight`, `showLabel`, off-grid). Putting it on `modelItem` keeps the one-identity-per-node model and means a node's label is consistent across views, matching `name`.

> **Correction of record:** a project note claimed this model "amends [ADR 0004](0004-connector-name-and-details-panel.md)." That is **false** — ADR 0004 is connector-only (connector `name`/`notes` parity). The node name/caption model has had **no ADR**; this is it.

## Amendment (2026-07-02) — connector name↔label decouple (parity with the node amendment)

> **What this changes:** the 2026-06-30 amendment (§ Scope) left **CONNECTOR** name-as-label out of scope. This brings connectors to the same decoupled model, driven by owner request ("decouple connection name and label the same way we did with nodes"). Same **zero-migration addition** posture on the unpushed `integration` branch — a new optional marker field, seeded at load.

### New decision (connector)

1. **On-canvas text = the connector's `labels[]`.** The synthetic `__name__` label (previously assembled in `ConnectorLabel.tsx` from `name` + `nameLabel*` and prepended to `getConnectorLabels`) is **no longer rendered**. `name` no longer draws.
2. **`name` is identity only** — renamed in the **Layers** panel (unchanged row machinery), **hidden from the canvas**. The `nameLabel*` presentation fields stay in the schema for round-trip but are inert (the seed reads them once).
3. **F2 on a selected connector = add a new `labels[]` entry at the midpoint (position 50) and immediately inline-edit it** (owner pick — a connector has no single on-canvas name to rename, so F2 *grows* the label set). If a specific label is already selected, F2 edits that one.
4. **Seed `name`→`labels[]` at load.** [`src/utils/seedConnectorLabel.ts`](../../packages/axoview-lib/src/utils/seedConnectorLabel.ts) (mirrors `seedNodeLabel`) folds each existing connector's `name` into a midpoint label carrying its `nameLabel*` placement/style, then stamps **`nameSeeded: true`**. Pure + idempotent via the marker, which is set on **every** connector the pass touches (name present or not) — so a name later typed in Layers is pure identity and never re-seeded into a canvas label.
5. **`showLabel` now gates all of a connector's labels** (mirroring a node's `showLabel` gating its label), replacing its old role of gating only the synthetic name. The now-meaningless "show/hide name" toggle is removed from connector **Details**; label visibility remains available from the **Layers** eye toggle.
6. **Connector labels get an external link** (`connectorLabelSchema.headerLink`, parity with node-label links). A label with a link renders as a clickable `<a>`-style chip + `OpenInNewIcon` in view/read-only mode; the top-bar **Link** control targets the selected label's `headerLink` (whole-connector `headerLink` still applies when the connector itself, no label, is selected).

### Scope (connector)

Connector only. The `__name__` synthetic-render path and the name-edit-on-F2 path are retired; `ConnectorNameLabel` is folded into `ConnectorTextLabel` (which now also renders the view-mode link). Unit-tested: seed idempotency + legacy-fold + never-re-seed ([`seedConnectorLabel.test.ts`](../../packages/axoview-lib/src/utils/__tests__/seedConnectorLabel.test.ts)).

## Amendment (2026-07-02) — identity `name` moves to a shared "Metadata" section (all item types)

> **What this changes:** the 2026-06-30 resolution "KEEP NAME IN DETAILS" (an inline Name field in the Details tab) is **refined**. Identity `name` is no longer a bare inline field — it now lives in a **collapsed "Metadata" disclosure** ([`MetadataSection`](../../packages/axoview-lib/src/components/ItemControls/components/MetadataSection.tsx), collapsed by default) used uniformly by **node, connector, rectangle, and textbox** panels.

- The Details tab's primary content is the type's own field (node = **Label**, the on-canvas text); identity `name` is tucked into the collapsed Metadata section for de-emphasis and cross-type parity — identity is edited primarily in **Layers**. Notes moved to the shared `NotesSection` for the stacked types.
- The node Details tab still co-hosts the **inline link button** (`headerLink`) + **show/hide-label toggle** (`showLabel`) on the Label field. The connector Details drops both (a connector has no single on-canvas name — visibility is the Layers eye toggle; the whole-connector link is the strip's Link control). This is a deliberate, documented parity divergence.
- **Panel shape:** node/connector render Details + Notes as **tabs**; rectangle/textbox/label stack the sections inline. Unifying these behind the shared `NotesSection`/`MetadataSection` layout for all five types is a tracked coherence nit (not a data-model concern).

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
