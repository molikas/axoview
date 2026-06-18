# ADR 0027 — Canvas Context Menu (the per-item command surface)

**Status:** Proposed
**Date:** 2026-06-18
**Supersedes:** none (spawned from [ADR 0022](0022-canvas-pointer-interaction-model.md) §1; home for [ADR 0023](0023-off-grid-positioning-and-collision.md) commands; touch reconciliation with [ADR 0018](0018-touch-pen-gesture-contract.md))
**Superseded by:** none

## Context

The canvas-UX overhaul revealed a coherence gap (workflow.md Principle 7): **there is no context-menu component in the codebase.** The PLAN.md snapshot lists `components/ContextMenu/  # Right-click menu`, but it does not exist — `glob packages/axoview-lib/src/components/ContextMenu/**` returns nothing. Right-click today either opens the details panel + `NodeActionBar` (`onContextMenu`, [useInteractionManager.ts:960](../../packages/axoview-lib/src/interaction/useInteractionManager.ts#L960)) or pans (`panSettings.rightClickPan`).

This stranded two decisions:
- [ADR 0022](0022-canvas-pointer-interaction-model.md) reassigns right-click → **pan**, removing the only right-click affordance.
- [ADR 0023](0023-off-grid-positioning-and-collision.md) (#20) routes "unsnap / disable collision" into "the context menu" — a surface that doesn't exist.

Several other per-item commands (z-order, assign-to-layer, line style, link, duplicate) likewise lack a reliable home now that single-click is select-only and right-click is pan. **A per-item command surface must exist**, with a clear division of labor against the `NodeActionBar` (quick actions) and the details panel (full editing).

## Decision

### 1. Build a canvas context menu (MUI `Menu`, portal-rendered)

A right-click menu component, rendered via MUI `Menu` (portals to the document root → screen-pixel-stable, no §8.8 counter-scale needed).

### 2. Invocation — tap vs drag split (reconciles with ADR 0022)

| Gesture | Result |
|---|---|
| Right-click **drag** (past tap-slop) | **Pan** (ADR 0022) |
| Right-click **tap** on an item | **Item** context menu |
| Right-click **tap** on empty canvas | **Canvas** context menu (Add item · Paste · Select all · Snap-to-grid toggle) |
| Touch **long-press** on an item | Item context menu (replaces the old long-press→action-bar; the bar now opens on tap-select) |

The tap-vs-drag split reuses the existing `rightDownRef` + `RIGHT_DRAG_THRESHOLD` machinery in [`usePanHandlers`](../../packages/axoview-lib/src/interaction/usePanHandlers.ts) — below threshold on release = menu, beyond = pan.

### 3. Command catalogue (item-type parity per ux-principles §5)

- **Item menu:** Details… (opens the panel — same as double-click) · Rename (F2) · Cut / Copy / Paste · Duplicate · Delete · Bring forward / Send backward · Assign to layer ▸ · **Snap to grid / Unsnap from grid** · **Enable / Disable collision** (ADR 0023) · type-specific (node: Link…; connector: Add waypoint / line style; etc.).
- **Canvas (empty) menu:** Add item · Paste · Select all · Snap-to-grid toggle.

### 4. Division of labor (the coherence contract — no duplication, no orphans)

| Surface | Trigger | Contents |
|---|---|---|
| `NodeActionBar` | selection (single-click / tap) | the 3–4 most-frequent quick actions (edit name, style, notes, delete) |
| **Context menu** | right-tap / long-press | the **full** command list, including the rare ones (unsnap, collision, z-order, layer assign) |
| Details panel | double-click | full editing (tabs: Details / Style / Notes) |

**Invariant:** no command is reachable *only* via a removed gesture. The context menu is the catch-all home; the action bar is a curated shortcut subset; the panel is for editing. A command that lives in the bar must also live in the menu.

## Consequences

**Positive:** every per-item command has a reliable home; right-drag is freed for pan without losing discoverability; matches OS expectation; gives ADR 0023's commands a real surface.

**Negative / risks:** a new component + a command catalogue to keep in sync with the bar; touch long-press is **reassigned** from the action bar to the menu (reconcile with ADR 0018 — verify on a device); must police bar/menu/panel against duplication drift.

## Acceptance criteria

- **e2e:** right-tap an item → menu with the expected commands; right-drag → pan, no menu; right-tap empty → canvas menu; "Unsnap" + "Disable collision" present (ties ADR 0023); "Details…" opens the same panel as double-click; long-press opens the menu on touch.
- **Manual:** the same command in the action bar and the menu does the same thing; no command is orphaned by the ADR 0022 gesture changes.
- **Build clean.**
