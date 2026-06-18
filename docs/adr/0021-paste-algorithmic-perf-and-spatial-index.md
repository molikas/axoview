# ADR 0021 — Paste Algorithmic Performance & the Derived Tile Index

**Status:** Accepted
**Date:** 2026-06-16
**Supersedes:** none
**Superseded by:** none

## Context

Selecting ~150 nodes → Ctrl+C → Ctrl+V (paste on top) **froze the app**. The
drag hot path had already been rewritten to avoid this class of cost
(`batchUpdateViewItemTiles` — one structural copy, no per-item immer, no per-item
validation); paste never got that treatment.

Traced root cause in `useSceneActions.pasteItems` (a synchronous per-item create
loop inside one `transaction`):

1. **O(N³) validation.** Every `createViewItem` ended in
   `updateViewItem → validateView(entireView)`, and `validateView` did a linear
   `getItemByIdOrThrow` (a `findIndex`) per view item against `model.items`. So
   insert *i* cost ~O((N+i)·M); summed over N inserts = **O(N³)**.
2. **O(N²) immer churn.** ~2 full-state `produce()` clones per pasted node, each
   copying and deep-freezing the growing `items`/`views` arrays.

A secondary defect: paste placement used a per-node spiral capped at Chebyshev
distance 10; when any node couldn't be placed it returned `null` and the caller
dropped the **entire** paste onto the source tiles — every pasted node silently
stacked.

This is the durable record of the fix (executed across phases 0–4 of the
since-retired `docs/tactical/paste-algo-perf-plan.md`); see also
[ADR 0019](0019-canvas2d-node-render-layer.md) (canvas node layer) and
[ADR 0020](0020-engine-perf-harness-and-measurement-protocol.md) (perf harness).

## Decision

**1. Batched, atomic paste (O(N³)+O(N²) → O(N+C)).** `pasteItems` assembles the
N-scale arrays in **one** structural pass (`concat`/`slice`/spread — no immer, no
per-item reducer) and calls `validateView` **once**. It stays inside the existing
`transaction()`, so a paste is still exactly one undo entry (one `model.set` + one
`scene.set` at commit). Paste is **all-or-nothing**: if the assembled view fails
validation (not expected for an internally-consistent remapped payload), the whole
paste is aborted — no items, connectors, rectangles, text boxes, or connector path
routing are applied.

**2. `validateView` ref-existence via Sets.** The per-item / per-anchor linear
scans (`getItemByIdOrThrow`, `Array.includes`) are replaced by Sets built once per
call (`modelItemIds`, `viewItemIds`, `anchorIds`, `colorIds`). Which issues are
reported — types, params, messages — is **identical**; only the cost changes
(O(N·M)/O(C·A·N) → O(N+M)/O(C·A)).

**3. `TileIndex` — a derived, not store-maintained, spatial index.**
[`utils/spatialIndex.ts`](../../packages/axoview-lib/src/utils/spatialIndex.ts) is a
uniform grid hash (O(1) `at`/`isOccupied`/`insert`/`move`/`remove`, plus a `range`
bbox query). It is **built from the current items array** (`buildTileIndex`) and
recomputed when that array changes — deliberately **not** mutated incrementally
from the create/move/delete reducers. Rationale: undo/redo apply immer patches
**directly to the store, bypassing the reducers** (`modelStore.tsx`), so a
store-resident index poked only from reducers would silently desync on undo. A
derived index is correct by construction. Hit-testing keeps its existing per-array
WeakMap cache (last-wins single-id semantics); occupancy/placement use `TileIndex`.

**4. Rigid-stamp paste placement (behavior change — see Consequences).** The
pasted block searches integer offsets outward (O(d) perimeter ring walk, bounded at
Chebyshev 64) for the first offset where the **whole block** clears existing items,
then shifts every node by that single offset — preserving the block's internal
layout and never collapsing onto one tile.

**5. Canvas render-order sort cache.** `NodesCanvas.draw()` ran on every pan/zoom
frame and re-sorted all visible nodes with a linear `findLayer` per comparison. The
sort is now cached, keyed on the `(nodes, layers, visibleIds, skipIds)` reference
identities (each changes only on a real edit, never on pan/zoom), with an O(1)
`layerId→order` map. Ordering semantics are preserved.

**6. Lower-tax cleanups.** `getAllAnchors` is a single flat pass (O(A²)→O(A));
`updateViewTimestamp` is a shallow spread+map instead of a second full-state
`produce`; the lasso connector branch resolves anchors through an `id→tile` Map
built once per frame (O(C·A·N)→O(C·A)).

**7. Post-undo/redo connector re-sync (D-8), scoped.** Connector paths are derived
from the model but cached in the scene store *and its history*. Paste records
**provisional empty** connector paths in its single history entry, then
`computePathsAsync` writes the real paths `skipHistory` — so the real paths never
enter history, and redoing a paste would otherwise restore the empty provisional
paths (invisible connectors). `useHistory` therefore re-routes the active view
(`SYNC_SCENE`, written `skipHistory` so it never perturbs either undo/redo stack)
after an undo/redo — but **only when** an active-view connector actually has a
missing/empty (non-`unroutable`) path. The common case (every model-only undo, e.g.
a rename, at 700+ connectors) pays just an O(C) `tiles.length` scan, never a
synchronous full-view re-route. (Review follow-up: the cost is scoped to the actual
D-8 symptom rather than charged to every undo/redo.)

## Consequences

**Behavior changes to confirm with product (intentional):**

- **Layout-preserving paste.** A pasted fragment keeps its shape (the whole block
  shifts by one offset) instead of scattering each node into the nearest free tile.
  This is the standard/expected paste behavior.
- **No gap-filling.** Pasting into a partially-occupied region no longer slots
  individual nodes into individual holes.
- **Degenerate dense case.** If no fully-clear offset exists within Chebyshev 64
  (a huge/dense scene), the block is stamped at the target offset — it keeps its
  internal shape but may overlap existing nodes. This is strictly better than the
  prior failure mode (the whole paste stacking onto a single tile), but it is a
  different outcome.

**Engineering trade-offs:** the derived `TileIndex` rebuilds in O(N) when `items`
changes (not O(1)/mutation), which is correct and cheap for user-paced edits;
Renderer item/connector culling is left as the existing `useMemo`-gated filter
(already not per-frame).

**Guards (CI unit suite):** `paste.bulkPerf` (validateView called once, under
budget, 2N nodes with no stacking, one undo entry), `spatialIndex` (incl. a
brute-force occupancy invariant), the updated placement tests (incl. the exact
reported scenario — "a row pasted on itself shifts to clear space"), the
`useHistory` undo/redo suites (the scoped D-8 re-sync early-returns when no path is
empty; the D-7 dual-stack coordination is unchanged), and the `engine-perf`
paste-on-top scenario (real Ctrl+C/Ctrl+V, asserts the paste adds exactly
N → 2N nodes).

## Related pre-T3 render/interaction fixes (PR #49)

Shipped in the same pre-T3 hardening wave; not paste-algorithmic, so kept out of the
Decision list above, but recorded here as the wave's index (durable detail is in the
commit history + the named test guards):

- **Rectangle / text-box compositor drag.** Both now drag via a CSS variable
  (`--ff-drag-dx/dy`) with a single `batchUpdate*` commit on drop — matching the node
  drag path — instead of a per-frame store write. Guards:
  `rectangleTextbox.dragPerf.test.tsx`, the `DragItems.modes` test, and
  `css-preview-mid-drag.spec.ts`.
- **Canvas label stalk + LOD + text-layout cache.** `NodesCanvas` centres sprites on
  their tile, draws the label connector stalk, drops labels below an LOD zoom
  threshold, and caches per-node text layout keyed by `(fontSize, name, description)`
  so wrapping isn't re-measured every frame. Guard: `canvas-node-render.spec.ts` plus
  the canvas-pixel guard.
- **Honest connector-paint harness anti-cheat + `perf-smoke` CI.** The harness asserts
  the canvas node layer's per-frame `data-draw-count == N` at fit-to-view (no
  off-screen cull shrinking the benchmark); `perf-smoke.yml` runs a small-N
  `npm run perf` on PRs so a regression in the measured path trips CI. See
  [ADR 0020](0020-engine-perf-harness-and-measurement-protocol.md).
