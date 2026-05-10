# Tactical — UX Shake-Out 2026-05

> **Read first:**
> - [docs/ux-principles.md](../ux-principles.md) — design language; this plan extends it (see §UX-principle updates at the bottom)
> - [ADR 0005](../adr/0005-toolbar-and-dock-layout-contract.md) — toolbar / dock contract; relevant for issue 7 (banner) and issue 6 (chrome scaling)
>
> **Status:** Approved — ready for implementation · **Owner:** Igor · **Last updated:** 2026-05-09
>
> Short-lived working doc. Delete after the work merges; commit history and the UX-principles updates below are the durable record.

## Session startup checklist

1. Read this file fully.
2. Skim [docs/ux-principles.md](../ux-principles.md) — sections referenced inline below.
3. Use `TodoWrite` to track sub-tasks.
4. Mark `[x]` as items complete.
5. On wrap-up, fold the UX-principle additions in §"UX-principle updates" into [docs/ux-principles.md](../ux-principles.md).

## Goal

Polish-layer fixes from the 2026-05-09 shake-out review. Seven issues, grouped into three bundles, ordered by risk.

**Out of scope:** new features, refactors beyond what each fix needs, test additions beyond ADR-invariant guards.

---

## Decisions (locked)

| # | Decision |
|---|---|
| 1 | **Issue 1 — accordion grouping:** one combined "Add more icons" accordion (collapses both pack-loader buttons and Import Icons), closed by default. |
| 2 | **Issue 2 — multi-select scope:** Shift-click for range select, Ctrl/Cmd-click for toggle. Routes through canvas LASSO selection state — single source of truth per UX §4.1. |
| 3 | **Issue 3 — QuickIconSelector parity:** replace bespoke TextField with shared [`Searchbox`](../../packages/fossflow-lib/src/components/ItemControls/IconSelectionControls/Searchbox.tsx). Drop `helpBrowse`/`helpSearch` footer. Drop truncated `searchPlaceholder`. **Keep** the Recently Used section. |
| 4 | **Issue 4 — surfacing import errors:** push `notificationStore` error with the first 1–2 zod issues summarised; same string mirrored into the ImportDialog `error` slot when invoked from the dialog. |
| 5 | **Issue 5 — font consistency:** (a) rewrite Save/Load/Export legacy dialogs in MUI; (b) delete dead `SaveAsDialog.tsx`; (c) drop ConfirmDialog title weight from 600 → 500 to match the seven other dialogs; (d) reconcile `ContextMenu.tsx` to theme default font; (e) **add explicit `fontFamily` to the MUI theme** (hygiene — codifies the cascade). |
| 6 | **Issue 6 — NodeActionBar zoom-stable:** counter-scale `1/zoom` clamped at `1.0` (only grows back to natural pixel size on zoom-out; never larger than natural at high zoom). |
| 7 | **Issue 7 — SessionModeBanner toned down:** subtle banner — `background.paper` background, 4px `warning.main` left accent stripe, `Typography variant="caption"`, `Button variant="outlined"` size small. **Persist dismissal** in `localStorage['fossflow-session-banner-dismissed']`. |

---

## Implementation bundles

### Bundle A — left-panel polish *(low risk, mostly visual)*

#### A.1 — Issue 1 · "Add more icons" accordion

**File:** [`packages/fossflow-lib/src/components/LeftDock/ElementsPanel.tsx`](../../packages/fossflow-lib/src/components/LeftDock/ElementsPanel.tsx)

- Replace the two trailing blocks (lines 198–296) with a single `Accordion`:
  - Title: "Add more icons" (sentence case, per UX §1.2 — drop the existing `textTransform: 'uppercase'` on "More icons")
  - `defaultExpanded={false}`
  - Inside: pack-loader buttons first, divider, Import Icons button + hidden file input
- Use MUI `Accordion` / `AccordionSummary` / `AccordionDetails` with no top border (the panel already has dividers).
- The accordion sits **outside** the scroll area so the icon grid keeps its full vertical real estate. (Today both blocks are `flexShrink: 0` siblings of the scroll area — keep that, but collapse them into one element so collapsed footprint is minimal.)
- Remove the inline uppercase caption header for "More icons" — inside the accordion the section header *is* the accordion title.

**i18n:** add `addMoreIcons` key to the `iconSelectionControls` namespace; remove orphan strings if any.

#### A.2 — Issue 3 · QuickIconSelector parity

**File:** [`packages/fossflow-lib/src/components/ItemControls/NodeControls/QuickIconSelector.tsx`](../../packages/fossflow-lib/src/components/ItemControls/NodeControls/QuickIconSelector.tsx)

- Replace the inline `TextField` (lines 168–188) with `<Searchbox value={searchTerm} onChange={(v) => { setSearchTerm(v); setHoveredIndex(0); }} />`.
- Delete the help-text footer Section (lines 250–254).
- **Keep** the Recently Used block (lines 191–203) — confirmed by user.
- **Keep** keyboard nav (Arrow / Enter / Escape) — that's the value-add over the elements panel; user did not flag it.
- **Re-route filtering through `useIconFiltering`** so behaviour matches Elements (instead of the local regex on lines 80–95). Drop `escapeRegex` helper.

**i18n:** delete keys `searchPlaceholder`, `helpSearch`, `helpBrowse` from `quickIconSelector` namespace in all 14 locale files (English + 13 translations). Keep `recentlyUsed`, `searchResults`, `noIconsFound`.

#### A.3 — Issue 7 · SessionModeBanner toned down

**File:** [`packages/fossflow-app/src/components/SessionModeBanner.tsx`](../../packages/fossflow-app/src/components/SessionModeBanner.tsx)

- Wrapper sx → `bgcolor: 'background.paper'`, `borderLeft: '4px solid'`, `borderColor: 'warning.main'`, `borderBottom: 1`, `borderBottomColor: 'divider'` (replace the warning tint and the warning-bordered bottom).
- `Typography variant="caption"` for the message; remove `flex: 1` styling that pushed the message to fill the bar.
- `Button variant="outlined" size="small"` instead of `contained`.
- Persist dismissal: read `localStorage['fossflow-session-banner-dismissed']` on mount; on dismiss, write `'1'`. Reset key on session-mode entry/exit boundary if applicable (TBD — confirm whether banner should re-show in a fresh session).

**Test guard:** add a `__perf_refactor_regression__` test asserting localStorage round-trip — unit test, not E2E.

---

### Bundle B — selection & zoom mechanics *(higher risk, behavior change)*

#### B.1 — Issue 2 · Layers shift/ctrl multi-select

**Files:**
- [`packages/fossflow-lib/src/components/LayersPanel/LayersPanel.tsx`](../../packages/fossflow-lib/src/components/LayersPanel/LayersPanel.tsx) — selection logic
- [`packages/fossflow-lib/src/components/LayersPanel/LayerItemRow.tsx`](../../packages/fossflow-lib/src/components/LayersPanel/LayerItemRow.tsx) — pass modifier keys through `onClick`

**Selection model:**
- The single source of truth is `LassoMode.selection.items: ItemReference[]` (per UX §4.1).
- A plain click on a layer row → `setItemControls({type, id})`, no LASSO.
- Shift-click → switch mode to `{type: 'LASSO', selection: {items: [...currentRange]}, isDragging: false, showCursor: true}` where `currentRange` spans the last single-clicked anchor and the shift-clicked row.
- Ctrl/Cmd-click → toggle the row in/out of the LASSO selection (initialise from current `itemControls` if no LASSO yet).
- "Last single-clicked anchor" — store as a ref inside `LayersPanel` (not in the store; ephemeral panel state).
- ItemReference shape must match canvas selection (`{type: 'ITEM', id}` etc.) — see `types/ui.ts`.
- Selection visual on rows: extend `isSelected` to be `LASSO.selection.items.some(...)` OR matches `itemControls.id`.

**Canvas mirror:** because LASSO selection already drives canvas highlighting and the floating action bar's "multi-item" branch, canvas updates come for free — no extra wiring.

**Risk register:**
- F2-rename should still target a single row (the focused one), not the multi-selection. Keep the existing `RENAMEABLE.has(item.type)` branch on the focused row's `onKeyDown`.
- Drag-from-row is currently `onMouseDown → onDragStart(item)`. With multi-select, drag should carry the whole selection. **Defer** unless user reports — initial scope: shift/ctrl select, drag stays single-row.

**Test guards:** unit tests for the modifier-key branches in `LayersPanel.handleItemClick`.

#### B.2 — Issue 6 · NodeActionBar counter-scale

**File:** [`packages/fossflow-lib/src/components/NodeActionBar/NodeActionBar.tsx`](../../packages/fossflow-lib/src/components/NodeActionBar/NodeActionBar.tsx)

**Approach:** subscribe to `useUiStateStoreApi` zoom (same pattern as [`SceneLayer.tsx:27`](../../packages/fossflow-lib/src/components/SceneLayer/SceneLayer.tsx#L27)) and apply an inverse transform to the bar's outer Box.

```tsx
const counterScale = Math.min(1, 1 / zoom);
sx={{
  position: 'absolute',
  left: pos.x,
  top: pos.y - 40,
  transform: `translateX(-50%) scale(${counterScale})`,
  transformOrigin: 'center bottom',
  ...
}}
```

**Why clamp at 1:** at zoom=2 the inverse is 0.5 — that would shrink the bar. We only want to *prevent* shrinkage at low zoom, never make the bar smaller than its natural size at high zoom.

**Anchor preservation:** `transformOrigin: 'center bottom'` keeps the bar visually anchored to the same node corner as it grows back to natural size on zoom-out.

**Spawned `<Menu>`s:** the layer-assignment Menu (anchorEl-positioned) renders outside SceneLayer's scaling — already screen-pixel-stable by virtue of MUI Portal. **Verify**: open a diagram, zoom to 50%, click the layers icon on the action bar — confirm the menu opens at natural pixel size.

**Test guards:** add a perf-regression test that asserts the bar's bounding-box height stays approximately constant across 25%/100%/200% zoom (using a JSDOM stub for `getComputedStyle`). Keep the test minimal — a regression here would re-introduce the original bug.

---

### Bundle C — error surfacing & font consistency *(orthogonal to A/B)*

#### C.1 — Issue 4 · Surface import validation errors

**File:** [`packages/fossflow-lib/src/hooks/useInitialDataManager.ts`](../../packages/fossflow-lib/src/hooks/useInitialDataManager.ts)

**Current behaviour (lines 91–101):**
```ts
if (!validationResult.success) {
  console.error('[useInitialDataManager] Model validation failed:', ...);
  setIsReady(false);
  return;
}
```

**New behaviour:**
- Build a human summary from `validationResult.error.issues.slice(0, 2)` — format: `"<path>: <message>"`, e.g. `"views[0].items[3]: Required (tile)"`.
- `notificationStore.push({ severity: 'error', message: \`Could not load diagram: \${summary}\` })`.
- Keep the `console.error` for developer triage.
- **Open question for implementer:** should we *also* set a global "broken diagram" state and render an inline error UI on the canvas? Recommend NO for v1 — the toast is sufficient and avoids new UI surface. Re-evaluate if users still ask "where did my diagram go?"

**Mirror in ImportDialog:** when `onImportSingleJson` rejects, the existing `try/catch` in [`ImportDialog.tsx:154-168`](../../packages/fossflow-app/src/components/fileExplorer/ImportDialog.tsx#L154-L168) already surfaces `err.message`. **No change needed there** *if* the toast carries the same wording. Verify with manual test.

**Test guards:** add a test that loads an intentionally-malformed diagram and asserts a `notificationStore` message was pushed. Existing schema tests in `validation.test.ts` cover the parser side.

#### C.2 — Issue 5 · Font consistency

Five sub-tasks, all small:

**C.2.a — Rewrite legacy dialogs in MUI**

Files (rewrite):
- [`packages/fossflow-app/src/components/SaveDialog.tsx`](../../packages/fossflow-app/src/components/SaveDialog.tsx) — Dialog + DialogTitle + TextField + 2 buttons. Mirror `ConfirmDialog`'s shape.
- [`packages/fossflow-app/src/components/LoadDialog.tsx`](../../packages/fossflow-app/src/components/LoadDialog.tsx) — Dialog + DialogTitle + List of diagrams + close button. Each row: `ListItem` with `ListItemText` (primary = name, secondary = updated date) + Load/Delete IconButtons.
- [`packages/fossflow-app/src/components/ExportDialog.tsx`](../../packages/fossflow-app/src/components/ExportDialog.tsx) — Dialog + DialogTitle + Alert (info severity) + 2 buttons. Drop the inline `style={{ backgroundColor: '#d4edda', ... }}` — MUI `Alert severity="success"` carries the same semantic.

Files (delete):
- [`packages/fossflow-app/src/components/SaveAsDialog.tsx`](../../packages/fossflow-app/src/components/SaveAsDialog.tsx) — dead code, no imports.

CSS to delete from [`packages/fossflow-app/src/App.css`](../../packages/fossflow-app/src/App.css) (lines 32–155 approximately — the `.dialog-overlay`, `.dialog`, `.dialog-buttons`, `.diagram-list`, `.diagram-item`, `.diagram-actions` rule blocks). Verify no stragglers via `grep` after deletion.

**C.2.b — ConfirmDialog title weight**

[`packages/fossflow-app/src/components/ConfirmDialog.tsx:56`](../../packages/fossflow-app/src/components/ConfirmDialog.tsx#L56) — drop `fontWeight={600}`. The default `h6` weight (500) matches the seven other dialogs.

**C.2.c — ContextMenu font**

[`packages/fossflow-lib/src/components/ContextMenu/ContextMenu.tsx:33`](../../packages/fossflow-lib/src/components/ContextMenu/ContextMenu.tsx#L33) — drop the explicit `fontSize: 12` and `minHeight: 32`. Keep `py: 0.5` (matches the file-explorer ContextMenuItems' density). Result: 14px from theme, ~32px row height from theme defaults — matches MainMenu.

**C.2.d — Explicit fontFamily in MUI theme**

[`packages/fossflow-lib/src/styles/theme.ts:70`](../../packages/fossflow-lib/src/styles/theme.ts#L70) — add `fontFamily` to the typography block:

```ts
typography: {
  fontFamily: [
    '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', '"Fira Sans"', '"Droid Sans"', '"Helvetica Neue"',
    'sans-serif',
  ].join(','),
  fontSize: 14,
  // ...existing h2/h5/body1/body2
}
```

This codifies what's already cascading from `index.css`. Hygiene only — no visible change.

**C.2.e — Verify**

Manual sweep after the rewrites: open every dialog and menu listed in the audit table (review section), confirm uniform title weight, body text size, button typography. Hand-off to user for confirmation before commit.

---

## Verification policy

Per-bundle. Three commits expected (one per bundle), or one combined commit if the user prefers.

**Bundle A** sign-off questions:
- Accordion expanded/collapsed states work, scroll area regains the vertical space?
- QuickIconSelector visually matches Elements panel (modulo Recently Used)?
- SessionModeBanner reads as informative, not alarming?

**Bundle B** sign-off questions:
- Shift-click range, Ctrl/Cmd-click toggle, plain click single-select all work?
- Action bar legible at 25% / 50% zoom, not oversized at 200%?
- Multi-selected items visible on canvas as well as panel?

**Bundle C** sign-off questions:
- Save/Load/Export dialogs visually indistinguishable in family from ConfirmDialog/ImportDialog?
- ContextMenu font matches MainMenu?
- Banner of any dialog title still feels right (no regression from C.2.b)?

---

## UX-principle updates

These updates fold into [docs/ux-principles.md](../ux-principles.md) at session wrap-up. Listed here so they ship with the work, not as a separate documentation cycle.

### Add to §1 (Layout) — new sub-principle

**§1.5 Use MUI defaults for typography unless there's a documented reason to deviate**

```
fontWeight, fontSize, and fontFamily on Typography components are set by the
theme. Don't pass `fontWeight={600}` on a DialogTitle to "make it stand out"
— that creates per-dialog drift. If a heavier weight is genuinely needed app-wide,
update the theme's `h6` block once.

Exception: monospace contexts (keyboard shortcuts, code blocks) use
`fontFamily: 'monospace'` explicitly — that's a semantic choice, not styling drift.
```

### Add to §8 (Layout regions and overlays) — new sub-principle

**§8.8 Canvas-anchored chrome is screen-pixel-stable**

```
Floating chrome positioned in canvas tile coordinates (NodeActionBar, future
right-click menus) must counter-scale the SceneLayer's `transform: scale(zoom)`
so it stays at natural pixel size at low zoom.

Pattern:
- Subscribe to `useUiStateStoreApi` zoom the same way SceneLayer does.
- Apply `transform: ... scale(${Math.min(1, 1/zoom)})`
- Set `transformOrigin` to the corner that should stay visually anchored to
  the node (typically `center bottom` for top-anchored bars).
- Clamp the inverse at 1.0 — chrome should never grow *larger* than its natural
  pixel size when the user zooms in.

MUI `<Menu>` spawned from such chrome renders via Portal at the document root —
already screen-stable; no counter-scale needed there.
```

### Update §1.2 (No ALL CAPS section headers)

Add an example:

```
The "More icons" caption in the Elements panel was previously
`textTransform: 'uppercase'`. Removed in the 2026-05 shake-out — sentence case
matches every other section header.
```

### Update §6 (State persistence reassurance) — new sub-principle

**§6.3 Validation failures surface to the user, not just the console**

```
A failed schema parse, a malformed import, or a rejected save must call
`notificationStore.push({ severity: 'error', message })` with at least the
first 1–2 violations summarised in plain English. `console.error` alone is
not enough — users don't open devtools.

Reference: useInitialDataManager.ts surfaces zod issues this way.
```

### Update §8.5 (Status cluster — chip carries the mode signal)

Append:

```
The same principle applies to mode banners that sit outside the status cluster
(e.g. SessionModeBanner). The mode badge in the status cluster is the load-
bearing signal; a banner that reinforces it should be quiet — accent stripe,
caption typography, outlined button — not a tinted bar that competes with the
chip for attention.
```

### Update §9 (Reference implementations) — add rows

| Pattern | Reference file |
|---|---|
| Standard search input (panel-level) | [`Searchbox.tsx`](../../packages/fossflow-lib/src/components/ItemControls/IconSelectionControls/Searchbox.tsx) |
| Counter-scaled canvas-anchored chrome | [`NodeActionBar.tsx`](../../packages/fossflow-lib/src/components/NodeActionBar/NodeActionBar.tsx) (after this work lands) |
| Quiet mode banner pattern | [`SessionModeBanner.tsx`](../../packages/fossflow-app/src/components/SessionModeBanner.tsx) (after this work lands) |

---

## Wrap-up

When all three bundles ship and verify:

1. Fold the §"UX-principle updates" section into [docs/ux-principles.md](../ux-principles.md). Stop writing them in this doc.
2. Add a one-liner to `PLAN.md` POST phase: *"2026-05 — UX shake-out polish (7 issues, 3 bundles)."*
3. **Delete this file.** Commit history and the updated UX principles are the durable record.
4. If any issue gets deferred, move it to [`known_issues.md`](../../known_issues.md) with symptom + workaround + status.
