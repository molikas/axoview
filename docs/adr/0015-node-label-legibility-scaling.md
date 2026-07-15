# ADR 0015 — Node Label Legibility Scaling

**Status:** Accepted
**Date:** 2026-06-11
**Supersedes:** none
**Superseded by:** none

## Context

Node and item name labels render **inside the zoom-scaled `SceneLayer`** (via
[`ExpandableLabel`](../../packages/axoview-lib/src/components/Label/ExpandableLabel.tsx) →
[`Label`](../../packages/axoview-lib/src/components/Label/Label.tsx)). Because the whole scene is
`transform: scale(zoom)`, labels shrink with the canvas — at low zoom (e.g. 46% on a large
diagram) the text becomes **too small to read**.

This is a **legibility** problem, confirmed with the user 2026-06-11 (the original report said
"slow," which was a typo for "small" — there is no measured performance issue here, and none is
being designed for). The node's interactive chrome already solves the analogous problem by
**counter-scaling** to stay pixel-stable ([ux-principles §8.8](../guidelines/ux-principles.md), e.g.
[`ViewModeInfoPopover`](../../packages/axoview-lib/src/components/ViewModeInfoPopover/ViewModeInfoPopover.tsx)); the
name labels do not.

## Decision

Add an optional **"keep labels readable" toggle** to the [`ZoomControls`](../../packages/axoview-lib/src/components/ZoomControls/ZoomControls.tsx)
cluster.

- **Off (default):** labels scale with the canvas, exactly as today.
- **On:** below a zoom threshold, name labels **counter-scale up to a legible minimum size** so
  text stays readable when zoomed out. Only the label scales — node geometry is untouched.

The toggle state persists in uiState alongside the existing label flags (`expandLabels`,
`labelSettings`).

Behavior sketch: above the threshold, no counter-scale. Below it, scale the label by
`max(1, minReadablePx / (baseFontPx * zoom))`, bounded, pinned to the node's anchor point.

This is **opt-in** deliberately: counter-scaled labels can overlap on dense diagrams, so forcing
it on everyone would trade one problem for another. The user turns it on when they need to read a
zoomed-out overview.

## Consequences

**Positive:**
- Labels stay readable when zoomed out, on demand.
- Opt-in keeps dense diagrams clean by default; no forced overlap.

**Negative / risks:**
- When on at very low zoom, labels can overlap. Acceptable — it is an explicit user choice, and
  the alternative (unreadable text) is worse for the case they enabled it for.
- One new persisted UI flag and one new affordance in the zoom cluster.

## Implementation notes (non-binding)

- Reuse the zoom-subscription / counter-scale pattern from
  [`ViewModeInfoPopover`](../../packages/axoview-lib/src/components/ViewModeInfoPopover/ViewModeInfoPopover.tsx)
  (per [ux-principles §8.8](../guidelines/ux-principles.md)): direct DOM ref subscribed to `uiState.zoom`,
  bypassing React render, applying `transform: scale(...)` to the label only.
- Add the toggle (e.g. an "Aa" icon) to [`ZoomControls`](../../packages/axoview-lib/src/components/ZoomControls/ZoomControls.tsx),
  beside the fit-to-view button. New flag (e.g. `uiState.readableLabels` or
  `labelSettings.keepReadable`).
- Leave `expandLabels` (the export force-expand path in `ExpandableLabel`) semantics unchanged —
  this is a separate concern (size, not expansion).
- Threshold + `minReadablePx` belong in [`labelSettings`](../../packages/axoview-lib/src/config/labelSettings.ts)
  so they are tunable without code edits.

## Acceptance criteria

- **Manual:** With the toggle on, zooming to ~46% holds labels at a readable size; with it off,
  labels shrink with the canvas as before.
- **Manual:** The toggle state survives a page reload.
- **Manual:** Toggling has no effect on node body / geometry size — labels only.
