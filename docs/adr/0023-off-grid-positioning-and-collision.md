# ADR 0023 — Off-Grid Positioning & Per-Item Collision

**Status:** Proposed
**Date:** 2026-06-18
**Supersedes:** none
**Superseded by:** none

## Context

Two requests need positions that are not locked to the integer tile grid:

- **#12** — Enable/disable snap-to-grid.
- **#20** — Per-element "unsnap" via context menu, then move the item freely between tiles "to save space."

Today **every** position is an integer tile coordinate: items/textboxes carry `tile: Coords`, rectangles `from`/`to: Coords`, and the mouse→tile conversion rounds (`getMouse`). Snap, the derived `TileIndex` collision/occupancy ([ADR 0021](0021-paste-algorithmic-perf-and-spatial-index.md)), connector routing (pathfinding on tiles), and the spatial index all assume integers. "Free movement" is therefore a data-model question, not a UI toggle.

The user's resolved design (2026-06-18): **per-item pixel offset** (not fractional tile coords across the whole engine), and an unsnapped item should **skip collision entirely** — collision becomes a per-object opt-out, the primary use being to cherry-pick a few items and nudge them between tiles without being pushed.

## Decision

### 1. Additive data model — the integer tile stays the base

Add optional, backward-compatible fields (absent = today's behavior, byte-for-byte):

```ts
// view item / rectangle / textbox
offset?: { x: number; y: number };  // unprojected px relative to the tile anchor
snap?: boolean;                      // default true; false = drag commits the px offset, not a rounded tile
collides?: boolean;                  // default true; false = excluded from TileIndex (neither obstacle nor mover)
```

- An **unsnapped** item (`snap: false`) implies `collides: false` unless the user re-enables collision (the "nudge between tiles to save space" case).
- Stored offset is **unprojected px** so it is projection-independent (iso ↔ 2D). The renderer applies it as a final translate after projection.
- Zod `modelItem` schema extends with these optionals; lean-save omits defaults.

### 2. One snap chokepoint

All drag/paste/placement position resolution goes through a single helper, `resolvePlacement(tile, offset, snap, globalSnap)`. The rest of the engine — routing, `TileIndex`, spatial queries, the canvas render base — keeps reading the **integer tile**; only the renderer and this chokepoint read `offset`. This bounds the blast radius.

### 3. Global toggle + per-item override

- A persisted `uiState.snapToGrid` global toggle (default on) sets the default for new placements/drags (#12).
- Per-item overrides — **"Unsnap from grid" / "Snap to grid"** and **"Disable collision" / "Enable collision"** (#20) — live in the **canvas context menu** ([ADR 0027](0027-canvas-context-menu.md)). That menu is a new surface built for this purpose: there is **no** context-menu component today, so #20 has no home until ADR 0027 ships. The global toggle also surfaces in the empty-canvas context menu.

### 4. Collision is per-item

When `collides === false`, paste/drag/rigid-stamp skip the tile-hash occupancy test for that item and the `TileIndex` does not index it (neither pushes others nor is pushed). Colliding items behave exactly as today.

## Consequences

**Positive:** minimal blast radius — the integer-tile invariant the whole engine relies on is preserved; per-item granularity matches the cherry-pick workflow; offset in unprojected px works in both projections.

**Negative / risks:** a second positioning source (tile + offset) — the single chokepoint is load-bearing or the two desync. A connector anchored to an offset/unsnapped node must resolve to the **rendered (offset)** endpoint, not the bare tile (routing subtlety). Export (PNG/SVG) and both projections must apply the offset.

## Implementation notes (non-binding)

- Renderer applies `offset` after the `CoordinateTransformStrategy` projection.
- Context-menu entries via the existing `ContextMenu` component; global toggle in `uiStateStore` persisted settings (mirror `canvasMode`).
- Connector endpoint resolution reads the node's rendered position (tile + offset).

## Acceptance criteria

- **Unit:** `resolvePlacement` snaps when `snap`/`globalSnap` true, preserves px when false; save→load round-trips `offset`/`snap`/`collides`; lean-save omits defaults.
- **e2e (new `snap-grid.spec`):** global snap off → drag lands off-grid; context-menu unsnap one item → it moves freely between tiles while neighbours still snap; an unsnapped item overlaps another without pushing it; state persists across reload.
- **Perf (ADR 0020):** dragging an offset item stays within the drag noise band (offset read is O(1)); `TileIndex` build cost for colliding items unchanged.
