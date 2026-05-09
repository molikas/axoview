# FossFLOW UX Principles

**Status:** Living reference. Update when principles evolve.
**Audience:** Anyone (or any agent) building UI surfaces, fixing bugs, or reviewing PRs that touch the canvas, side panels, file explorer, or layers.

This is the design language that governs FossFLOW's UI. It's not opinion — it's the consolidated set of choices already shipped, expressed as principles so new work doesn't drift.

When in doubt, **mirror what already exists** in the reference implementations listed at the bottom.

---

## 1. Layout

### 1.1 Section is the layout primitive

Every titled control group in the right sidebar uses [`Section`](../packages/fossflow-lib/src/components/ItemControls/components/Section.tsx). Never inline a header:

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

Reference: [`ConnectorControls.tsx`](../packages/fossflow-lib/src/components/ItemControls/ConnectorControls/ConnectorControls.tsx) and [`NodePanel.tsx`](../packages/fossflow-lib/src/components/ItemControls/NodeControls/NodePanel/NodePanel.tsx) `TabPanel`.

---

## 2. Affordances

### 2.1 In-row actions are visible at `opacity: 0.5`

Action buttons inside dense lists (layer rows, file tree rows) default to half opacity. Full opacity on hover or when active. **Never `opacity: 0`** — undiscoverable affordances are bugs.

```tsx
// ✅ Correct — discoverable
sx={{ opacity: item.showLabel === false ? 1 : 0.5, '&:hover': { opacity: 1 } }}

// ❌ Wrong — hidden until hover
sx={{ opacity: 0, '&:hover': { opacity: 1 } }}
```

### 2.2 Distinct icons for distinct concepts

Don't reuse icons across semantically different operations:

| Concept | Icon |
|---|---|
| Layer-level entity visibility | `Visibility` / `VisibilityOff` |
| Item name-label visibility | `LabelOutlined` / `LabelOffOutlined` |
| External URL | `OpenInNew` |
| Inline rename trigger | F2 keyboard (no icon needed) |

If a user sees the same icon in two places and it does different things, the icon's semantics are broken.

---

## 3. Keyboard

### 3.1 F2 = rename, universally

Inline rename via F2 on the canvas, in the layer panel, and in the file explorer. Matches OS conventions (Windows Explorer, Finder rename hotkey is also F2 on Windows). Don't introduce alternatives.

When implementing F2:
- Make the row focusable (`tabIndex={0}`)
- Focus the row on click (`ref.focus()`)
- `e.stopPropagation()` in the row's `onKeyDown` to prevent canvas-level F2 from also firing

Reference: [`LayerItemRow.tsx`](../packages/fossflow-lib/src/components/LayersPanel/LayerItemRow.tsx).

### 3.2 Enter confirms, Escape cancels — in every dialog

Built into [`ConfirmDialog`](../packages/fossflow-app/src/components/ConfirmDialog.tsx) at the dialog level. New dialogs should reuse `ConfirmDialog` rather than rolling their own. If a custom dialog is unavoidable, copy the keyboard handler.

---

## 4. Selection model

### 4.1 Two-way panel ↔ canvas sync

Clicking a layer item also selects it on canvas. Selecting on canvas highlights the matching layer row. The two views are mirrors of the same selection state, not independent.

This is implemented via `useUiStateStore.itemControls` as the single source of truth. Don't introduce a separate "layer selection" state.

### 4.2 File tree selection is independent

The file tree's selection has different semantics — it's "which diagram is open," not "which canvas object is selected." Don't try to sync the two; they belong to different mental models. Use distinct visual treatments:

- Canvas/layer selection: `bgcolor: 'primary.main'` (saturated blue)
- File tree selection: `bgcolor: 'action.selected'` (subtle grey)

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

---

## 7. Localization

### 7.1 All UI strings go through locales

14 locale files in `packages/fossflow-lib/src/i18n/`. Type definition in `packages/fossflow-lib/src/types/isoflowProps.ts`. When adding strings:

1. Add the key to the type definition
2. Add an English translation in `en-US.ts`
3. Add translations to ALL 13 other locales — no English fallbacks in non-English files

### 7.2 Translation tone

Sentence case in all languages where it applies. No ALL CAPS even if the source value used to be ALL CAPS.

---

## 8. Reference implementations

When building parallel surfaces, **read these first**:

| Pattern | Reference file |
|---|---|
| Layout primitive | [`Section.tsx`](../packages/fossflow-lib/src/components/ItemControls/components/Section.tsx) |
| Tabbed item panel | [`NodePanel.tsx`](../packages/fossflow-lib/src/components/ItemControls/NodeControls/NodePanel/NodePanel.tsx) |
| Name field + inline action buttons | [`NodeInfoTab.tsx`](../packages/fossflow-lib/src/components/ItemControls/NodeControls/NodeInfoTab/NodeInfoTab.tsx) |
| Connector parity with node | [`ConnectorControls.tsx`](../packages/fossflow-lib/src/components/ItemControls/ConnectorControls/ConnectorControls.tsx) |
| Layer row with rename + action toggle | [`LayerItemRow.tsx`](../packages/fossflow-lib/src/components/LayersPanel/LayerItemRow.tsx) |
| Keyboard-first dialog | [`ConfirmDialog.tsx`](../packages/fossflow-app/src/components/ConfirmDialog.tsx) |
| Inline canvas rename | [`Node.tsx`](../packages/fossflow-lib/src/components/SceneLayers/Nodes/Node/Node.tsx) (search `inlineEditNodeName`) |

---

## When this document is wrong

It's a snapshot of decisions, not laws. If you find a principle here that contradicts something the user just said in the current session — the user wins. Update this doc afterwards as part of wrap-up so the contradiction doesn't repeat.

Don't silently deviate. If you decide to break a principle for a good reason, write a short note in the relevant ADR explaining why.
