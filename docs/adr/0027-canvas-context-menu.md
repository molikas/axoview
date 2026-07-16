# ADR 0027 — Canvas Context Menu (the per-item command surface)

**Status:** Accepted
**Date:** 2026-06-18
**Supersedes:** [ADR 0004](0004-connector-name-and-details-panel.md) §"Right-sidebar panel" in part — the panel's **Delete** button; this context menu owns Delete for every item type. 0004's name/notes parity substance stands. · [ADR 0018](0018-touch-pen-gesture-contract.md) in part (2026-06-25 addendum) — **long-press opens this context menu**, not the NodeActionBar; 0018's gesture *mechanics* (timer-based, opens during the hold, tap-slop cancel, `pointerType` branch) stand.
*(Non-supersession context: spawned from [ADR 0022](0022-canvas-pointer-interaction-model.md) §1; home for [ADR 0023](0023-off-grid-positioning-and-collision.md) commands.)*
**Superseded by:** [ADR 0030](0030-docked-style-controls-strip.md) in part — the item panel no longer has a Style tab and **Delete** is owned by this context menu; visual styling lives in the docked style strip. The "Style tab" / "Details / Style / Notes" references below are historical (pre-0030). **For the panel's current shape, see [ADR 0030](0030-docked-style-controls-strip.md) — do not restate it here.** (This line previously said "the item panel is now **Details / Notes**", which commit `987eaaf` had already falsified.)

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
- **Multi menu** (right-tap / long-press on an item that is part of a multi-selection — 2026-06-20 addendum): a **bulk** command set over the whole selection — `N items selected` header · Cut / Copy / Duplicate · Assign to layer ▸ (bulk) · Delete N items · Unsnap / collision placeholders (T8). No Details/Rename (single-item only). The selection is read from `selectedIds` (Ctrl+click / Ctrl+A / a canvas lasso, mirrored on mouseup) or an active lasso's `mode.selection` (panel-driven), mirrored into `selectedIds` + settled to CURSOR so one source of truth drives it. **This supersedes the floating `LassoLayerBar`** ("N items / Assign layer") — assign-to-layer for a multi-selection now lives in this menu (and the LayersPanel row drag), so the redundant floating control was removed. `useCopyPaste` was made multi-aware so bulk Cut/Copy/Duplicate (and Ctrl+C/X) operate on a CURSOR-mode `selectedIds` selection.
- **Canvas (empty) menu:** Add item · Paste · Select all · Snap-to-grid toggle.

### 4. Division of labor (the coherence contract — no duplication, no orphans)

| Surface | Trigger | Contents |
|---|---|---|
| ~~`NodeActionBar`~~ | ~~selection (single-click / tap)~~ | ~~the 3–4 most-frequent quick actions~~ — **removed 2026-06-25 (see addendum below); no bar tier** |
| **Context menu** | right-tap / long-press | the **full** command list, including the rare ones (unsnap, collision, z-order, layer assign) — now the **sole** per-item command surface |
| Details panel | double-click | full editing (tabs: Details / Style / Notes) |

**Invariant:** no command is reachable *only* via a removed gesture. The context menu is the catch-all home; the panel is for editing. *(Pre-shake-out this also read "the action bar is a curated shortcut subset; a command that lives in the bar must also live in the menu" — the bar tier was removed 2026-06-25, so that clause no longer applies; see the addendum below.)*

## Consequences

**Positive:** every per-item command has a reliable home; right-drag is freed for pan without losing discoverability; matches OS expectation; gives ADR 0023's commands a real surface.

**Negative / risks:** a new component + a command catalogue to keep in sync with the bar; touch long-press is **reassigned** from the action bar to the menu (reconcile with ADR 0018 — verify on a device); must police bar/menu/panel against duplication drift.

## Acceptance criteria

- **e2e:** right-tap an item → menu with the expected commands; right-drag → pan, no menu; right-tap empty → canvas menu; "Unsnap" + "Disable collision" present (ties ADR 0023); "Details…" opens the same panel as double-click; long-press opens the menu on touch. *(As-built: only "Unsnap from grid" is exercised in e2e (`snap-grid.spec.ts`); the "Disable collision"-present and "Details…"-parity assertions were not added, and there is no unit test for `CanvasContextMenu` — open test gaps.)*
- **Manual:** the same command in the action bar and the menu does the same thing; no command is orphaned by the ADR 0022 gesture changes.
- **Build clean.**

## Addendum — 2026-06-25 (NodeActionBar removed; menu is the sole per-item surface)

The floating `NodeActionBar` was **removed** (shake-out item #3). It duplicated the
right-click menu for every command that mattered, and the dual-surface "keep in
sync / police duplication drift" cost flagged in the risks above was not paying for
itself. The division of labor is now **menu = per-item commands · panel = editing**
(no bar tier).

Reconciling the §4 "no command reachable only via a removed gesture" invariant after
the bar's removal:

- **Notes** was the only bar affordance with no other home → added as **"Add note"**
  in the `item` menu variant (nodes + connectors only — the two types with a `notes`
  field). It opens the details panel on the Notes tab (reuses the existing
  `focusNotes` panel-event). **Update (2026-07-02):** `notes` fields were later added
  to rectangle / text box / floating Label (commit `1560daa`), and "Add note" now opens
  Notes for **every** element type via the unified collapsible-section deck (commit
  `987eaaf`) — no longer nodes + connectors only.
- **Style** and **Edit link** stay reachable via **Details…** → the panel's Style tab
  / link field.
- **Start connector** stays reachable via the connector tool in the ToolMenu.
- **z-order / layer / delete / rename** were already in the menu.

Store/dead-code cleanup: the `itemActionBarOpen` slice + `setItemActionBarOpen`
action were deleted from the UI store; single-click/tap is now purely select-only
(derives the panel TARGET, mounts no surface). The panel-event dispatch helper
(`NodeActionBar.helpers.ts`) survives — it is still the channel "Add note" and the
per-type ItemControls listeners use.
