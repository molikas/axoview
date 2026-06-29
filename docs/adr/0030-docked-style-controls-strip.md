# ADR 0030 — Docked Style-Controls Strip as the Canonical Styling Surface

**Status:** Proposed
**Date:** 2026-06-29
**Supersedes:** none (amends [ux-principles](../ux-principles.md) §2.4 / §2.5 / §5.1 / §5.2; supersedes the connector **Style** tab decision in [ADR 0004](0004-connector-name-and-details-panel.md) §"Right-sidebar panel"; fills the [ADR 0005](0005-toolbar-and-dock-layout-contract.md) Group 1 "Format" reserved slot)
**Superseded by:** none

## Context

An exploratory UX session (commits `92b853d1` → `894cb3b2` → `ae090ddc`, branch `integration`, unpushed) introduced a Google-Docs/Figma-style **docked style strip** — [`TopBarStyleControls.tsx`](../../packages/axoview-lib/src/components/TopBarStyleControls/TopBarStyleControls.tsx), portaled into the [ADR 0005](0005-toolbar-and-dock-layout-contract.md) Group 1 "Format" slot — and **deleted the per-type Style tab from all four item panels** ([`NodeStyleTab.tsx`](../../packages/axoview-lib/src/components/ItemControls/NodeControls/NodeStyleTab/NodeStyleTab.tsx) removed entirely; `ConnectorControls`/`RectangleControls`/`TextBoxControls` trimmed to two tabs). Styling is now reached **only** through the strip.

This shipped a coherence break (workflow.md Principle 7 / ux §11) that this ADR exists to close:

- **The design language now lies.** [ux-principles §5.1](../ux-principles.md) (lines 293, 295) and [§5.2](../ux-principles.md) (line 300) still mandate a **Details / Style / Notes** three-tab panel with a Style-tab Delete button. That tab no longer exists for any item type. §5 is the normative spec future item types build against — a live false rule.
- **The exemption is unratified.** [§2.4](../ux-principles.md)'s body forbids selection-triggered editing toolbars; the strip's exemption lives only in a §2.4 blockquote (line 191) + a new §2.5, added in the same spike with no ADR. The blockquote also claims the strip "mirrors a side panel" — false, the side-panel styling it references was deleted.
- **The slot was reserved, not specified.** [ADR 0005](0005-toolbar-and-dock-layout-contract.md) §1 reserved the Group 1 "Format" position but explicitly left "what control goes there" to a future feature ADR. This is that ADR.

The strip itself is sound: single 1113-line component, internally componentized, reads `uiState.itemControls` (the [ADR 0006](0006-canvas-selection-contract.md) single source of truth), writes via `useScene()`. The decision below ratifies the **surface model**, not the implementation.

## Decision

**The docked style strip is the single canonical surface for visual styling of every item type.** Per-type Style tabs are retired; item panels are **Details / Notes** only.

### 1. Surface division of labor (the coherence contract)

| Surface | Trigger | Owns |
|---|---|---|
| **Docked style strip** | always present, selection-gated | **all visual styling** — text color/size, B/I/S, background/fill, rectangle border, connector line color/style/type/width/arrow, icon size |
| Context menu ([ADR 0027](0027-canvas-context-menu.md)) | right-click / long-press | per-item **commands** — incl. **Delete** (relocated from the dead Style tab) |
| Details panel | double-click | **Details** (name, link, show-name, type-specific) + **Notes** |

No styling control lives in two surfaces. The strip is the styling path; the panel is identity + notes; the menu is commands.

### 2. Selection gating (inherits ADR 0006)

The strip acts only when `itemControls` targets **exactly one** item (`selectedIds.length === 1`). With `0` or `>1` selected, every control is **disabled** (not hidden) per §2.5 — the user still learns the full command surface. **Exception:** when a creation tool is armed with nothing selected (e.g. the connector tool), the connection-color + line-options controls edit the session-scoped *pre-draw defaults* (`uiState.connectorDefaults`), which the next-drawn item inherits.

### 3. Mode + portal contract

The strip renders **only in `EDITABLE` mode**, via `createPortal` into an app-supplied DOM slot (`styleControlsPortalTarget`, a callback-ref target the app provides through `DiagramLifecycleProvider`). This is the same lib→app bridge pattern as the sidebar-toggle portal. View/present modes never mount it (consistent with §8.10 ephemeral presentation chrome).

### 4. Doc amendments this ADR carries (implemented in the productization slice)

- **§5.1** — canonical panel becomes **Details / Notes**; the "Style tab: visual properties + Delete button" bullet is removed; Delete is relocated to the §2.4 context-menu surface; a cross-reference points styling to the strip (§2.4/§2.5).
- **§5.2** — connector tab enumeration drops "Style" (Details/Notes); connectors remain full peers.
- **§2.4** — the blockquote is reworded: the strip **is the canonical styling surface** (not "mirrors a side panel"); the stale "side-panel styling fallback" framing is removed. The matching false header comment in `TopBarStyleControls.tsx` is corrected.
- **§2.5** — retained as-is (the enabled/disabled contrast standard); this ADR ratifies it.

> **Open refinement (2026-06-29):** whether the Details tab keeps the **Name** field or delegates rename to Layers/F2 (leaving Notes + type-specific) is an open UX decision tracked in [ADR 0032](0032-node-name-caption-label-model.md) + tactical Slice 0. It further thins the panel and must reconcile the home of the **inline link button** + **show/hide-name toggle** that the Name row currently co-hosts. Settle it before finalizing the §5.1 amendment.

## Consequences

**Positive:**
- One styling surface, globally consistent across item types — the de-dup the spike performed becomes the sanctioned model, not an accident.
- The design language stops contradicting the shipped UI; future item types get an unambiguous rule ("styling goes in the strip; the panel is Details/Notes").
- Fills ADR 0005's reserved slot with a specified contract.

**Negative / risks:**
- The strip becomes a single point of failure for styling — it **must never be clipped/unreachable** (the narrow-viewport overflow gap is a must-fix, tracked in the tactical plan).
- Power users lose an at-a-glance "all properties of this item" panel view; styling now requires the toolbar.
- Two-way reconciliation debt: every doc/comment that named a Style tab must be swept (grep gate below).

## Implementation notes (non-binding)

- The amendment is doc + comment edits only; the code already matches the decision.
- Keep the strip's per-type write logic the single writer; do not re-add styling to any panel.
- i18n: the strip currently has ~30 hardcoded English strings and no `useTranslation` — ratifying it as a primary surface makes localization a release blocker (separate slice).

## Acceptance criteria

- **Doc grep:** `grep -rn "Details / Style / Notes\|Style tab" docs/` returns zero stale hits after the amendment.
- **Parity test:** a render test pins the **Details / Notes** two-tab shape for node + connector panels (no Style tab).
- **Manual:** select one item of each type → the correct strip controls enable; select zero or two → all disabled with "why" tooltips; arm the connector tool with nothing selected → color/line controls edit pre-draw defaults and the next connector inherits them.
- **Manual:** Delete is reachable for every item type via the context menu (no Style-tab dependency).
- **Build + lib/app typecheck clean.**
