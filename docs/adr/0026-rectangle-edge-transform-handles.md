# ADR 0026 — Rectangle Edge-Midpoint Transform Handles

**Status:** Accepted
**Date:** 2026-06-18
**Supersedes:** none
**Superseded by:** none

## Context

**#11** — Rectangles can only be resized from their corners. [`TransformRectangle.ts`](../../packages/axoview-lib/src/interaction/modes/Rectangle/TransformRectangle.ts) handles four corner anchors (`TOP_LEFT` / `TOP_RIGHT` / `BOTTOM_LEFT` / `BOTTOM_RIGHT`) only. The user wants **edge-midpoint** handles (top / right / bottom / left) to resize a single dimension, and they must **look correct in both isometric and 2D** views.

## Decision

1. Add four **edge-midpoint anchors** (`TOP`, `RIGHT`, `BOTTOM`, `LEFT`) to the transform-controls anchor set and to `TransformRectangle`. An edge handle resizes **one axis** (the opposite edge stays fixed); corner handles are unchanged.
2. **Projection:** handle positions are computed in tile space and projected through the active `CoordinateTransformStrategy`, so midpoints land on the true edge centers in **iso** (diamond) and **2D** (square). Counter-scale handles to screen px per [ux-principles §8.8](../ux-principles.md#88-canvas-anchored-chrome-is-screen-pixel-stable) so they don't shrink with zoom.
3. Commit the resize as **one** history entry (the existing corner-resize `beginDragTransaction` / `commitDragTransaction` pattern).

## Consequences

**Positive:** one-axis resize matches mainstream editors; faster than corner-only.

**Negative / risks:** eight handles to render and hit-test — keep targets distinct and large enough; the iso projection of edge midpoints must be exact, or handles drift off the visible edge.

## Acceptance criteria

- **Unit:** dragging `TOP` changes height only; `RIGHT` changes width only; corners unchanged.
- **e2e (extend `rectangle-ops`):** edge handle resizes one dimension in iso **and** 2D; corner handles still work.
- **Build clean.**
