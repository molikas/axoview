# Axoview UX Principles

**Last updated:** 2026-06-10 (v1.1 close-out)
**Status:** Living reference. Update when principles evolve.
**Audience:** Anyone (or any agent) building UI surfaces, fixing bugs, or reviewing PRs that touch the canvas, side panels, file explorer, or layers.

This is the design language that governs Axoview's UI. It's not opinion — it's the consolidated set of choices already shipped, expressed as principles so new work doesn't drift.

When in doubt, **mirror what already exists** in the reference implementations listed at the bottom.

---

## 1. Layout

> **Surface vocabulary (2026-05-20):** the canonical Modal / Dialog / Popover / Panel / Banner / Screen vocabulary is locked in [ADR 0008 — Naming Convention](adr/0008-naming-convention.md) Decision 2. When naming a new overlay or full-area surface, pick the term whose visual contract matches yours — do not invent a sixth.

### 1.1 Section is the layout primitive

Every titled control group in the right sidebar uses [`Section`](../packages/axoview-lib/src/components/ItemControls/components/Section.tsx). Never inline a header:

```tsx
// ✅ Correct
<Section title={t('color')}>
  <ColorSelector ... />
</Section>

// ❌ Wrong — inline caption header
<Box>
  <Typography variant="caption">Color</Typography>
  <ColorSelector ... />
</Box>
```

Reason: `Section` enforces consistent spacing (`pt: 1.5, px: 2`), title typography (caption + semibold + secondary color), and bottom margin. Any deviation creates a panel that looks like it was built by a different team.

### 1.2 No ALL CAPS section headers

`Section` deliberately does NOT use `textTransform: uppercase`. Modern property panels (Figma, Linear, Notion, VS Code) use sentence case. Research confirms lowercase is faster to scan. ALL CAPS is a 2014–2018 Material Design legacy.

This applies everywhere: section titles, button labels, dropdown values, switch labels.

```ts
// ✅ Correct
'Line style'
'Use custom color'
'Show arrow'
'Single line'

// ❌ Wrong
'Line Style'
'Use Custom Color'
'Show Arrow'
'Single Line'
'LINE STYLE'
```

The "More icons" caption in the Elements panel was previously `textTransform: 'uppercase'`. Removed in the 2026-05 shake-out — sentence case matches every other section header. Same goes for the panel-region labels (Diagrams, Layers, Common, etc.) which now render in sentence case via the `overline` typography variant (see §1.5).

### 1.3 Field labels are explicit; placeholders are hints

Every input field has a `Section` title above it. Placeholder text is a *hint* about what to type, not a label substitute.

```tsx
// ✅ Correct
<Section title={t('name')}>
  <TextField placeholder="Edge label…" ... />
</Section>

// ❌ Wrong — placeholder doing label's job
<TextField label="Connector name" ... />
<TextField placeholder="Connector name" ... />
```

Reason: placeholders disappear on focus, so a placeholder-only field has no persistent label — bad for accessibility and re-scanning. Explicit Section titles persist.

### 1.4 Tabbed scroll containers must clip horizontally

Any container with `overflowY: 'auto'` must also set `overflowX: 'hidden'`. Per CSS spec, mixing `overflow-y: auto` with the default `overflow-x: visible` resolves *both* axes to `auto`, turning the container into a horizontal scroll container as well.

This bites with MUI `Slider`: the thumb's `::after` pseudo-element is a 42 × 42 invisible hit-area centred on the thumb. At `left: 100 %` it extends ~21 px past the slider edge — enough to trigger a horizontal scrollbar in any tabbed property panel.

```tsx
// ✅ Correct — explicit on both axes
<Box sx={{ overflowY: 'auto', overflowX: 'hidden', flex: 1 }}>

// ❌ Wrong — browser silently promotes overflowX to 'auto'
<Box sx={{ overflowY: 'auto', flex: 1 }}>
```

Reference: [`ConnectorControls.tsx`](../packages/axoview-lib/src/components/ItemControls/ConnectorControls/ConnectorControls.tsx) and [`NodePanel.tsx`](../packages/axoview-lib/src/components/ItemControls/NodeControls/NodePanel/NodePanel.tsx) `TabPanel`.

### 1.5 Typography is theme-driven — six tiers, picked by role

The theme owns every font size and weight. Components pick a `<Typography variant="…">` based on the **role** of the text, never on how big or bold the author wishes it looked. Role-based variants survive design adjustments without code changes; ad-hoc inline `fontSize` / `fontWeight` accumulate into per-component drift.

| Variant | px @ 14 base | Role | Examples |
|---|---|---|---|
| `h6` | 17.5 | Dialog & popover titles | `ConfirmDialog`, `SaveDialog`, `LoadDialog`, `ExportDialog` titles |
| `body1` | 14 | Dialog/form body | `DialogContent`, descriptive paragraphs |
| `body2` | 12.25 | **Primary readable** lists, trees, forms | Layer item names, file-tree names, tab labels, panel form fields, tooltips |
| `caption` | 10.5 | Sub-labels / helper text | "Name", "Icon", "Link" mini-labels above an input; helper hints |
| `overline` | 10.5 + tracked | Region wayfinding (**sentence case** per §1.2/§7.2) | `Layers`, `Diagrams`, `Elements`, `Unassigned`, dock-section headers |
| `micro` | 9.6 | Glanceable status / badges (NOT prose) | `SESSION` chip, storage gauge, layer item-count badge, hotkey hints |

**Rules:**

1. **Pick by role, not size.** "Looks too small" means the role is wrong, not the size. If a layer-item label feels small, the question is "is this primary readable text?" → if yes, it's `body2`, full stop.
2. **Never pass `fontSize` to `<Typography>`.** Same for `fontWeight`. Both belong to the variant.
3. **Component-level overrides live in `theme.ts`.** `MuiTab`, `MuiChip`, `MuiButton` — set there once. Don't sprinkle `'& .MuiTab-root': { fontSize: ... }` inside random components.
4. **Need a size that doesn't fit a tier?** Propose a new variant in `theme.ts`. Don't inline it. Drift starts with one inline override.

**Permitted exceptions (documented):**

- `TextField` `slotProps.input` — that's input rendering, not Typography. Match `body2` for input text.
- Monospace contexts — explicit `fontFamily: 'monospace'` is a semantic choice (keyboard shortcuts, code blocks).
- Content emphasis — bolding the value of a single labeled field (e.g. an "Active" badge inside a row) is content-driven and may use `fontWeight={…}` locally. Section labels and panel headers may **not** — that's the drift this rule blocks.

```tsx
// ✅ Correct — role-driven, sentence case
<Typography variant="body2">{layer.name}</Typography>
<Typography variant="overline">Layers</Typography>
<Chip label={<Typography variant="micro">Session</Typography>} size="small" />

// ❌ Wrong — sized by feel
<Typography variant="caption" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
  {layer.name}
</Typography>

// ❌ Wrong — manual ALL CAPS, or overline re-imposing uppercase (both violate §1.2 / §7.2)
<Typography variant="caption" sx={{ textTransform: 'uppercase', ... }}>AWS</Typography>
<Typography variant="overline" sx={{ textTransform: 'uppercase' }}>Layers</Typography>
```

`overline` intentionally renders **sentence case** here (against MUI's default) — the "region header" signal comes from weight 600 + tracking + smaller size, not uppercase (satisfies §1.2/§7.2). The custom `micro` variant is registered via TS module augmentation in [`theme.ts`](../packages/axoview-lib/src/styles/theme.ts).

---

## 2. Affordances

### 2.1 In-row actions are visible at `opacity: 0.5`

Action buttons inside **dense lists** (layer rows, file tree rows, scene-item rows) default to half opacity. Full opacity on hover or when active. **Inside rows, never `opacity: 0`** — undiscoverable affordances are bugs when the row is just one of many similar siblings the user is scanning.

```tsx
// ✅ Correct — discoverable
sx={{ opacity: item.showLabel === false ? 1 : 0.5, '&:hover': { opacity: 1 } }}

// ❌ Wrong inside rows — hidden until hover
sx={{ opacity: 0, '&:hover': { opacity: 1 } }}
```

This rule is scoped to **in-row** affordances. Panel-header action clusters (see §2.3) are a different surface and follow a different pattern.

### 2.2 Distinct icons for distinct concepts

Don't reuse icons across semantically different operations:

| Concept | Icon |
|---|---|
| Layer-level entity visibility | `Visibility` / `VisibilityOff` |
| Item name-label visibility | `LabelOutlined` / `LabelOffOutlined` |
| External URL | `OpenInNew` |
| Inline rename trigger | F2 keyboard (no icon needed) |

If a user sees the same icon in two places and it does different things, the icon's semantics are broken.

### 2.3 Panel-header action clusters are hover-revealed

Action clusters on **panel-chrome headers** (file explorer toolbar: new file/folder/import/export/refresh/collapse; Layers panel header: add-layer/delete-layer) render at `opacity: 0` and fade in (`120ms ease`) on the panel container's `:hover` or `:focus-within`. They keep their DOM space — invisible, not removed — so layout doesn't reflow on reveal. VS Code, Figma, and Linear behave the same way.

```tsx
// Panel container declares the reveal selector
sx={{ '&:hover .ff-toolbar-actions, &:focus-within .ff-toolbar-actions': { opacity: 1 } }}

// Action cluster sets base opacity + transition
sx={{ opacity: 0, transition: 'opacity 120ms ease', '&:focus-within': { opacity: 1 } }}
```

This differs from §2.1 because:

- Panel headers are **chrome**, not content. The list of rows is what the user is scanning; the chrome stays out of the way until needed.
- Cluster has 5+ icons; always-visible would crowd the header and compete with the panel title.
- The interaction is bound to the panel as a whole — entering the panel reveals all its secondary actions at once.

`:focus-within` is required so keyboard navigation through the icons still reveals them. Reference: ADR-0005 §5b.

---

## 3. Keyboard

### 3.1 F2 = rename, universally

Inline rename via F2 on the canvas, in the layer panel, and in the file explorer. Matches OS conventions (Windows Explorer, Finder rename hotkey is also F2 on Windows). Don't introduce alternatives.

When implementing F2:
- Make the row focusable (`tabIndex={0}`)
- Focus the row on click (`ref.focus()`)
- `e.stopPropagation()` in the row's `onKeyDown` to prevent canvas-level F2 from also firing

Reference: [`LayerItemRow.tsx`](../packages/axoview-lib/src/components/LayersPanel/LayerItemRow.tsx).

### 3.2 Enter confirms, Escape cancels — in every dialog

Built into [`ConfirmDialog`](../packages/axoview-app/src/components/ConfirmDialog.tsx) at the dialog level. New dialogs should reuse `ConfirmDialog` rather than rolling their own. If a custom dialog is unavoidable, copy the keyboard handler.

---

## 4. Selection model

### 4.1 Two-way panel ↔ canvas sync

Clicking a layer item also selects it on canvas. Selecting on canvas highlights the matching layer row. The two views are mirrors of the same selection state, not independent.

This is implemented via `useUiStateStore.itemControls` as the single source of truth. Don't introduce a separate "layer selection" state.

### 4.2 File tree selection is independent

The file tree's selection has different semantics — it's "which diagram is open," not "which canvas object is selected." Don't try to sync the two; they belong to different mental models. Use distinct visual treatments:

- Canvas/layer selection: `bgcolor: 'primary.main'` (saturated blue)
- File tree selection: `bgcolor: 'action.selected'` (subtle grey)

### 4.3 Locked / hidden layer items are non-interactive — across every selection path

When a layer is locked or hidden, its items must be **non-selectable, non-draggable, non-context-menu-able** from the canvas — regardless of which gesture the user employs. Locked = visible-but-protected; hidden = invisible. Both states are absolute from the canvas perspective. The Layers panel rows remain the user's escape hatch — they always let the user select an item back so they can un-lock or un-hide.

The enforcement lives in a single helper, `isItemInteractable`, built in [`useInteractionManager`](../packages/axoview-lib/src/interaction/useInteractionManager.ts) from `layerContext.lockedIds` + `layerContext.visibleIds` and injected into every mode's `State`. **Every selection path must consult it.** Today that means:

- `Cursor.mousedown` — direct left-click selection
- `Lasso.getItemsInBounds` — marquee selection
- `FreehandLasso.getItemsInFreehandBounds` — freehand selection
- `useInteractionManager.onContextMenu` — right-click selection

If a future feature adds a new selection mechanism (keyboard arrow nav, "select all of type X", paste-into-selection, etc.), it **must** route through `isItemInteractable` too. A new selection path that doesn't consult it is the bug, not an oversight to be fixed later — it silently bypasses the lock/hide contract.

Visual indicator for locked rows lives in [`LayerRow.tsx`](../packages/axoview-lib/src/components/LayersPanel/LayerRow.tsx): left accent stripe + tinted background + saturated lock icon, so the state is unmistakable next to a row of similar outlines.

### 4.4 Multi-select gesture matrix

Persistent canvas multi-selection lives in `uiState.selectedIds: ItemReference[]`. The right Properties panel is per-item — so `selectedIds.length === 1` keeps `itemControls` in sync and the panel opens; `0` or `> 1` closes it. Bulk editing isn't part of this contract.

| Gesture | Outcome |
|---|---|
| Left-click an item | replaces selection with `[item]` |
| Ctrl/⌘+click an item | toggles `item` in/out (Figma/Sketch standard) |
| Ctrl/⌘+click a **connector** | toggles connector **plus its tile-bound waypoint anchors** as one group |
| Ctrl/⌘+A | selects every visible + unlocked item in the active view (respects §4.3) |
| Left-click empty canvas | clears selection |
| Esc (no panel / connector mid-flight) | clears selection |
| Lasso / freehand-lasso (mouseup) | mirrors `mode.selection.items` into `selectedIds` so it survives leaving lasso mode |
| Drag any item already in `selectedIds` (len > 1) | drags the whole group |
| Delete / Backspace (selection len > 1) | deletes every selected item; CONNECTOR_ANCHOR refs are spliced from their parent connector |
| Alt+click a waypoint (connector selected) | removes the waypoint without removing the connector |

**The design rule:** any selection path that includes a connector MUST also include its tile-bound waypoints — they carry `ref.tile` (absolute position) and don't auto-follow the connector, so omitting them pinches the path on multi-drag and orphans them on bulk-delete. The single source of truth is `getConnectorWaypointRefs(connector)` ([`utils/connectorSelection.ts`](../packages/axoview-lib/src/utils/connectorSelection.ts)); a new connector-including selection path must call it, same discipline as §4.3's `isItemInteractable`. User-facing badges count via `countUserFacingRefs` (excludes CONNECTOR_ANCHOR — implementation detail, not user-perceived selection).

Full contract, call-site list, and rationale: [ADR 0006](adr/0006-canvas-selection-contract.md).

---

## 5. Item type parity

Every selectable item type (Node, Connector, TextBox, Rectangle) is a **first-class peer**. New item types (or extensions to existing ones) mirror what node already does.

### 5.1 Item controls panel structure

Every item type's control panel has the same shape:

- **Header**: tabs (Details / Style / Notes) + close button
- **Details tab**: Name field with inline link button + show/hide name toggle, plus type-specific extras
- **Style tab**: visual properties + Delete button
- **Notes tab**: `RichTextEditor` bound to `notes` field, with non-empty marker on the tab

### 5.2 Connector mirrors node

Connectors have everything nodes have: `name`, `notes`, `headerLink`, `showLabel`, F2 inline rename, canvas name label, Details/Style/Notes tabs. They are not "lesser" items — they're peers.

### 5.3 No icon overloading across item types

When designing new affordances, check that the icon doesn't already mean something else for a different item type.

---

## 6. State persistence reassurance

### 6.1 Long or destructive ops show progress AND confirmation

After import, autosave, or any operation a user might worry about:

- Open the file explorer if applicable (so they can see what landed)
- Push a `notificationStore.push({ severity: 'success', message: ... })` with concrete info ("Imported 3 diagrams across 2 folders")
- Refresh affected views (file tree, layers, canvas)

### 6.2 Empty states surface affordances

The `EmptyStateScreen` shows BOTH "New diagram" AND "Import" cards. Empty doesn't mean "you can only do one thing here" — it means "tell us what you want to do."

### 6.3 Validation failures surface to the user, not just the console

A failed schema parse, a malformed import, or a rejected save must call `uiStateActions.setNotification({ severity: 'error', message })` with at least the first 1–2 violations summarised in plain English. `console.error` alone is not enough — users don't open devtools.

```ts
// ✅ Correct — user sees the error
if (!validationResult.success) {
  console.error('[X] validation failed:', validationResult.error.issues);
  const summary = validationResult.error.issues
    .slice(0, 2)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  uiStateActions.setNotification({
    severity: 'error',
    message: `Could not load diagram: ${summary}`
  });
  return;
}

// ❌ Wrong — silent failure
if (!validationResult.success) {
  console.error('validation failed:', validationResult.error);
  return;
}
```

Reference: [`useInitialDataManager.ts`](../packages/axoview-lib/src/hooks/useInitialDataManager.ts) surfaces zod issues this way.

### 6.3.1 Failure-of-intent gets a Dialog, not just a toast

A *failure of intent* — the user asked for something and it could not happen (a save rejected by storage quota, a malformed import, a share-POST that 5xx'd) — surfaces as a **blocking Dialog with a clear next action (retry / cancel)**, not a passive notification that can be missed. A toast is right for *"this happened"*; a Dialog is right for *"this didn't happen and you need to decide what to do."*

The contract — and the standardized dialog shape (soft shadow, X close button, `h6` 600 title, `body2` body, padded `DialogActions`; Enter confirms / Escape cancels per §3.2) — is [ADR 0011 — Error-UX Contract](adr/0011-error-ux-contract.md), shipped in full at the v1.1 close-out. New blocking dialogs reuse [`ConfirmDialog`](../packages/axoview-app/src/components/ConfirmDialog.tsx) or mirror its shape.

### 6.4 Cover the cold-start gap with a branded splash

The browser paints first at ~500 ms; the JS bundle parses + the editor mounts somewhere between 1 s (docker, prod) and 4 s (dev / session mode). Don't let the user stare at a white page during that gap.

`public/index.html` carries an inline `<div id="ff-splash">` rendered before the React tree exists — wordmark + a CSS-only spinner on a white background. `App.tsx` adds `.ff-splash-hidden` after `isInitialized` and two RAFs (the editor's first paint has flushed), then removes the node from the DOM 250 ms later (CSS fade).

**Why inline, not a React component:** the splash must paint without waiting for the JS bundle to parse. A `<Splash />` component shows up at T+2 s — that's the same problem with extra steps.

**Why no fake progress bar:** we don't have a real progress signal. A spinner says "working" honestly; a percent indicator we made up would lie.

**Don't add a splash to:** modal opens, tab switches, sub-views, or any in-app navigation. Those are sub-second and a spinner becomes flicker. Splashes are for *first paint after page reload* only.

Reference: [docs/perf-troubleshooting.md → Startup cold-start gap (2026-05-19)](perf-troubleshooting.md#case-study--startup-cold-start-gap-2026-05-19) for the diagnostic walk-through and measured impact.

---

## 7. Localization

### 7.1 All UI strings go through locales

14 locale files in `packages/axoview-lib/src/i18n/`. Type definition in `packages/axoview-lib/src/types/axoviewProps.ts`. When adding strings:

1. Add the key to the type definition
2. Add an English translation in `en-US.ts`
3. Add translations to ALL 13 other locales — no English fallbacks in non-English files

### 7.2 Translation tone

Sentence case in all languages where it applies. No ALL CAPS even if the source value used to be ALL CAPS.

---

## 8. Layout regions and overlays

The application chrome has named regions with stable ownership rules. The authoritative contract is [ADR 0005](adr/0005-toolbar-and-dock-layout-contract.md); this section captures the rules-of-thumb that follow from it.

### 8.1 Left-side panels overlay the canvas — never push it

File Explorer, Elements, and Layers all render as absolute overlays on top of the canvas. Opening or closing any of them does not change the canvas's bounding box.

```tsx
// ✅ Correct — absolute overlay sibling of the canvas
<div style={{ position: 'absolute', top: 0, bottom: 40, left: 40, width: 280, zIndex: 15 }}>
  <FileExplorer />
</div>

// ❌ Wrong — flex child that pushes the canvas right
<Box sx={{ display: 'flex' }}>
  <Box sx={{ width: 280 }}><FileExplorer /></Box>
  <Box sx={{ flex: 1 }}>{canvas}</Box>
</Box>
```

Reason: panels open and close frequently; resizing the canvas on every toggle reflows the diagram and disrupts spatial memory. The right Properties panel already followed this rule — left-side panels now match it.

When File Explorer (280 px) and Elements/Layers (240 px) are both open, the working panel offsets to `left: 320` (40 + 280) so they sit side-by-side with each panel's `borderRight` providing the seam.

### 8.2 No slide animations on left-side panels

Left-side panels appear and disappear instantly. No `transform`/`transition` slide.

**Why:** earlier behavior was inconsistent — File Explorer had no animation, Elements/Layers slid via `transform`. Switching between them produced a layout-jump that read like a bug. Snapping is consistent across all three. Animation is also a bug surface — every transition is a mid-flight state where pointer-events, focus, and z-stacking can desync.

### 8.3 Disabled panel triggers when their content is meaningless

When opening a panel would land the user on nothing useful, disable the trigger rather than letting the panel open empty.

Example: when no diagram is loaded, Elements and Layers icons are disabled with a tooltip *"Open or create a diagram first"*. File Explorer stays enabled — it's the way to *exit* the empty state. (See `disableLeftDockWorkingTabs` prop on `<Axoview>`.)

Don't introduce dead-end clicks: the user's first interaction with an empty app should land somewhere productive.

### 8.4 EmptyStateScreen is confined to the canvas region

The empty-state overlay must not cover the chrome (left strip, bottom dock). It owns the canvas-sized rectangle and nothing else:

```tsx
// ✅ Correct — confined to canvas
<div style={{ position: 'absolute', top: 0, left: 40, right: 0, bottom: 40, zIndex: 5 }}>
  <EmptyStateScreen ... />
</div>

// ❌ Wrong — covers the whole container including the chrome
<div style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
  <EmptyStateScreen ... />
</div>
```

**Why this is geometric, not z-index:** `Axoview`'s outer Box uses `transform: translateZ(0)`, which creates a stacking context that traps inner-chrome z-indexes — so geometric exclusion, not z-index, is the fix. Full mechanism in [architecture.md §4 — Lessons Learned](architecture.md#4-lessons-learned) (lesson 14).

Apply the same rule to any future full-canvas overlay (modal-backdrop variants, tutorial spotlight, etc.): if the chrome must remain visible, position the overlay to leave the chrome's pixels uncovered. Don't reach for z-index across the `Axoview` boundary.

### 8.5 Status cluster — chip carries the mode signal, not the wrapper

A single mode badge (here: the orange `SESSION` chip) is enough to communicate the mode. Don't double up with a tinted background around the cluster — the redundancy reduces contrast for the actual content (save state text, storage gauge) without adding information.

```tsx
// ✅ Correct — chip alone signals the mode
<Box sx={{ display: 'flex', gap: 0.5, px: 0.5 }}>
  {saveText && <Typography>{saveText}</Typography>}
  <Chip label="SESSION" sx={{ bgcolor: 'warning.dark', color: 'warning.contrastText' }} />
  <SessionStorageGauge />
</Box>

// ❌ Wrong — orange tint on the wrapper duplicates the chip's signal
<Box sx={{ bgcolor: 'warning.main', opacity: 0.85, ... }}>
  <Typography sx={{ color: 'warning.contrastText' }}>{saveText}</Typography>
  <Chip label="SESSION" ... />
</Box>
```

`opacity` is also a trap on cluster wrappers — it cascades to all children, killing contrast on the very text you wanted to draw attention to.

Conditional content should render conditionally. Don't reserve space with an empty `<Typography>` — render nothing when there is nothing to say.

The same principle applies to mode banners outside the cluster (e.g. [`SessionModeBanner`](../packages/axoview-app/src/components/SessionModeBanner.tsx)). The badge in the cluster is the load-bearing signal; a banner that reinforces it should be quiet — accent stripe, caption typography, outlined or no button — not a tinted bar that competes with the chip.

### 8.6 Save action sits flush against StatusCluster — they are one group

In session mode, the Save button (`💾`) is followed immediately by the StatusCluster with no divider between them. They read as a single unit: *"this is what state we're in, and this is what to do about it."* Visually adjacent, not visually separated.

This applies more broadly: when an action and its state are mutually relevant, group them with `gap` not `divider`. Save them as a pair.

### 8.7 CSS rules that target absolutely-positioned siblings should be scoped narrowly

Beware broad descendant rules like `.parent > div { height: 100% }`. They look harmless when the parent has one child but become destructive when overlay siblings are added — `height: 100%` overrides implicit height-from-top+bottom on `position: absolute` children, defeating any `bottom` inset.

If you need to set a child's height generically, target a class or component selector, not every `<div>`. Or trust the child's own inline/sx height (most MUI components set `height` via sx anyway).

### 8.8 Canvas-anchored chrome is screen-pixel-stable

Floating chrome positioned in canvas-tile coordinates ([`NodeActionBar`](../packages/axoview-lib/src/components/NodeActionBar/NodeActionBar.tsx), future right-click menus) must counter-scale the `SceneLayer`'s `transform: scale(zoom)` so it stays at natural pixel size at every zoom level.

Pattern:

- Subscribe to `useUiStateStoreApi` zoom the same way [`SceneLayer`](../packages/axoview-lib/src/components/SceneLayer/SceneLayer.tsx) does — direct DOM ref, bypassing React render.
- Apply `transform: ... scale(${1 / zoom})` unconditionally so the bar is screen-pixel-stable at all zoom levels.
- Set `transformOrigin` to the corner that should stay visually anchored to the node (typically `center bottom` for top-anchored bars).

```tsx
// ✅ Correct — screen-pixel-stable at every zoom
useEffect(() => {
  const apply = (zoom: number) => {
    if (!ref.current) return;
    ref.current.style.transform = `translateX(-50%) scale(${1 / zoom})`;
  };
  apply(uiStoreApi.getState().zoom);
  return uiStoreApi.subscribe((state, prev) => {
    if (state.zoom === prev.zoom) return;
    apply(state.zoom);
  });
}, [uiStoreApi]);

// ❌ Wrong — Math.min(1, 1/zoom) leaves the bar shrunken at zoom < 1
const counter = Math.min(1, 1 / zoom);  // shrinks with scene at low zoom
```

MUI `<Menu>` spawned from such chrome renders via Portal at the document root — already screen-stable; no counter-scale needed there.

---

## 9. Reference implementations

When building parallel surfaces, **read these first**:

| Pattern | Reference file |
|---|---|
| Layout primitive | [`Section.tsx`](../packages/axoview-lib/src/components/ItemControls/components/Section.tsx) |
| Tabbed item panel | [`NodePanel.tsx`](../packages/axoview-lib/src/components/ItemControls/NodeControls/NodePanel/NodePanel.tsx) |
| Name field + inline action buttons | [`NodeInfoTab.tsx`](../packages/axoview-lib/src/components/ItemControls/NodeControls/NodeInfoTab/NodeInfoTab.tsx) |
| Connector parity with node | [`ConnectorControls.tsx`](../packages/axoview-lib/src/components/ItemControls/ConnectorControls/ConnectorControls.tsx) |
| Layer row with rename + action toggle | [`LayerItemRow.tsx`](../packages/axoview-lib/src/components/LayersPanel/LayerItemRow.tsx) |
| Keyboard-first dialog | [`ConfirmDialog.tsx`](../packages/axoview-app/src/components/ConfirmDialog.tsx) |
| Inline canvas rename | [`Node.tsx`](../packages/axoview-lib/src/components/SceneLayers/Nodes/Node/Node.tsx) (search `inlineEditNodeName`) |
| Theme-driven typography contract | [`theme.ts`](../packages/axoview-lib/src/styles/theme.ts) — see §1.5 |
| Standard search input (panel-level) | [`Searchbox.tsx`](../packages/axoview-lib/src/components/ItemControls/IconSelectionControls/Searchbox.tsx) |
| Counter-scaled canvas-anchored chrome | [`NodeActionBar.tsx`](../packages/axoview-lib/src/components/NodeActionBar/NodeActionBar.tsx) — see §8.8 |
| Quiet mode banner | [`SessionModeBanner.tsx`](../packages/axoview-app/src/components/SessionModeBanner.tsx) — see §8.5 |
| Validation surfacing | [`useInitialDataManager.ts`](../packages/axoview-lib/src/hooks/useInitialDataManager.ts) — see §6.3 |

---

## When this document is wrong

It's a snapshot of decisions, not laws. If you find a principle here that contradicts something the user just said in the current session — the user wins. Update this doc afterwards as part of wrap-up so the contradiction doesn't repeat.

Don't silently deviate. If you decide to break a principle for a good reason, write a short note in the relevant ADR explaining why.
