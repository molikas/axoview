# ADR 0024 — Node Label Positioning & Sizing

**Status:** Accepted (shipped — on-canvas label drag/height via `NodeLabelHitLayer`; the shared 18px base is recorded in the [ADR 0030](0030-docked-style-controls-strip.md) 2026-07-02 sizing amendment)
**Date:** 2026-06-18
**Supersedes:** none (interacts with [ADR 0015](0015-node-label-legibility-scaling.md))
**Superseded by:** none

## Context

**#3** — The node name label can today only sit **above** the node. [`Label.tsx`](../../packages/axoview-lib/src/components/Label/Label.tsx) positions the chip with `top: -labelHeight` and an `expandDirection` of `CENTER | BOTTOM`; `labelHeight` is the stalk length above the node. The user wants to **drag the label vertically — up, down, and below the node — and resize its height — directly on the canvas, without opening the details panel.**

## Decision

1. **Model:** the label's vertical placement is a **signed** offset so it can sit above *or* below the node (allow negative `labelHeight`, or add a dedicated `labelOffset`). Height is the existing label box `maxHeight`. Both live on the view item.
2. **Direct-manipulation affordance:** when a node is selected, a **drag handle on the label** repositions it vertically (including below the node), and a **resize affordance** adjusts the label box height — no details panel. Commit on drop as **one** history entry (mirror the rectangle-transform transaction model in [TransformRectangle.ts](../../packages/axoview-lib/src/interaction/modes/Rectangle/TransformRectangle.ts)).
3. **Stalk geometry:** the connector dot-line re-renders to attach node ↔ label correctly at any offset; `transformOrigin` / the stalk anchor flips when the label is below the node.
4. **Touch:** the drag/resize handles work through the ADR 0018 gesture machine.

## Consequences

**Positive:** fast, direct label placement; parity with how users expect canvas labels to behave.

**Negative / risks:** a new on-canvas handle must be a **distinct hit target** so it doesn't compete with node-drag; below-node placement changes stalk geometry; must compose cleanly with the ADR 0015 counter-scale (`--axoview-label-scale`).

## Implementation notes (non-binding)

- Reuse the canvas-anchored counter-scale pattern (UX §8.8) so the handle is screen-pixel-stable.
- Keep label position math pure and unit-testable (`labelScale.ts` is the precedent).

## Acceptance criteria

- **Unit:** label-position math — above / below / offset-clamp resolve correctly for a signed offset.
- **e2e (new `label-drag.spec`):** drag a label below its node and reload → persists; the drag is one undo entry; stalk connects in both directions.
- **Build clean;** counter-scale (ADR 0015) still holds the label legible at low zoom.

## 2026-06-20 addendum — the label IS the handle (build-feedback revision)

The first build added two on-canvas grips (move + resize). Field feedback (owner,
2026-06-20) rejected that: the move grip sat under the selection action bar (ADR
0022/0027) — so a fresh node, whose label starts above it, couldn't be dragged
below at all — and two grips plus the Style panel's height slider read as three
overlapping controls. Revised decision:

1. **The label chip itself is the drag handle** — press the label and drag it
   above/below the node. No separate grip, so nothing competes with the per-item
   selection chrome (the label is a large target; the press starts the drag via `window`
   pointer listeners, robust once the pointer leaves the chip). A press under the
   drag slop still selects / double-clicks-to-rename. The label of an **unselected**
   node — drawn on the canvas (ADR 0019), so it has no DOM element — is grabbed via
   an invisible per-node hit layer (`NodeLabelHitLayer`) that drives the same
   reposition inside one drag transaction; grabbing a label never changes the
   current selection.
2. **Repositioning is on-canvas only.** The separate on-canvas box-height resize
   and its `labelMaxHeight` field are dropped (the label box keeps the standard
   height with scroll, as before). *(As-built, v3.7.0: the Style-panel "Label
   height" slider this line originally pointed at **no longer exists** — it was
   removed with `NodeStyleTab` during the ADR 0030 style-strip rework. `labelHeight`
   is written **only** by on-canvas drag today — `Node.tsx` and `NodeLabelHitLayer`;
   there is no numeric/slider control for it.)*
3. **Offset is clamped** to `[-200, 280]` (canvas px) so a drag can't fling the
   label off into empty canvas.

`labelHeight` remains the single signed-offset field; the stalk re-anchor +
transform-origin flip + `NodesCanvas` below-node rendering are unchanged.
