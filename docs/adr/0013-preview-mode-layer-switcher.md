# ADR 0013 — Preview-Mode Layer Switcher (Presentation Chrome)

**Status:** Proposed
**Date:** 2026-06-11
**Supersedes:** none
**Superseded by:** none

## Context

Layers are defined per view: `currentView.layers[]`, each a `Layer` with `id` / `name` /
`visible` / `locked` (see [`useLayerContext.ts`](../../packages/axoview-lib/src/hooks/useLayerContext.ts) —
`visibleIds` is derived from `layer.visible`). They are toggled today through the
[`LayersPanel`](../../packages/axoview-lib/src/components/LayersPanel/LayersPanel.tsx) in the left dock.

In view-only mode (`EXPLORABLE_READONLY`) the left dock is **editing chrome** — it steals space
and is mostly used while authoring. But the primary use case for the preview screen is
**presenting** a diagram, and presentations often want to switch which layer(s) are shown
(e.g. reveal a "network" overlay on top of a "base" diagram). Forcing the user into the full
left-dock LayersPanel to do that is heavy and off-purpose.

This is the view-mode counterpart to [ADR 0012](0012-view-mode-node-info-popover.md): together
they define what view mode shows instead of the editing docks.

## Decision

A compact, semi-transparent **layer control overlay**, shown only in `EXPLORABLE_READONLY` and
only when `currentView.layers.length > 0`.

- **Position:** bottom-left corner — clear of `ViewTabs` (bottom-center) and `ZoomControls`
  (bottom-right).
- **Behavior:** per-layer **visibility toggles** (matching the existing additive model — multiple
  layers can be on at once) plus a per-layer **"solo"** action (show only this layer).
- **Affordance:** semi-transparent at rest, full opacity on hover (presentation-friendly, per
  [ux-principles §2](../ux-principles.md)). Typography and sentence-case per
  [ux-principles §1.5 / §7.2](../ux-principles.md).

**Ephemeral semantics (load-bearing):** preview toggles do **not** mutate the model's
`layer.visible`, which is persisted diagram content. They apply a **UI-only override** so that
presenting a diagram never dirties or saves it. The override is merged into
`LayerContext.visibleIds`; leaving preview clears it.

> Precedence rule: in `EXPLORABLE_READONLY`, the preview override wins over `layer.visible`.
> In `EDITABLE`, the override is absent/ignored and `layer.visible` is authoritative as today.

## Consequences

**Positive:**
- Clean presentation surface — no left dock, no wasted space.
- Switching layers while presenting can never accidentally save a changed visibility state.

**Negative / risks:**
- Introduces a second visibility source-of-truth (model `layer.visible` vs preview override).
  The merge in `LayerContext` must be unambiguous and documented (precedence rule above), or the
  two can desync.

## Implementation notes (non-binding)

- Add a uiState slice (e.g. `previewLayerOverrides: { hiddenLayerIds: Set<string>, soloLayerId: string | null }`).
- Extend [`useLayerContext.ts`](../../packages/axoview-lib/src/hooks/useLayerContext.ts) so that,
  when `editorMode === EXPLORABLE_READONLY`, `visibleIds` is computed from the override (solo wins;
  else `layer.visible` minus `hiddenLayerIds`). Edit mode keeps the current derivation untouched.
- Render the overlay as an absolute sibling of the canvas (per [ux-principles §8.1](../ux-principles.md)),
  gated on editor mode + layer count. Reuse layer name/visibility iconography from
  [`LayerRow.tsx`](../../packages/axoview-lib/src/components/LayersPanel/LayerRow.tsx) for consistency.

> TODO (resolve at design review): should this control also appear in `NON_INTERACTIVE` (export
> preview)? Default proposed: no — it's an interactive presentation control.

## Acceptance criteria

- **Manual:** In view mode with ≥2 layers, the corner control toggles each layer live; "solo"
  isolates one layer.
- **Manual:** Toggling layers in preview does **not** mark the diagram dirty and is not written on
  save (override is UI-only).
- **Manual:** Edit mode is unaffected — LayersPanel and `layer.visible` behave exactly as before.
- **Manual:** With 0 or 1 layer, the control does not render.
