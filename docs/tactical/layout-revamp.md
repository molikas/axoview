# Tactical — Toolbar & Dock Layout Revamp

> **Read first:**
> - [ADR 0005 — Toolbar and Dock Layout Contract](../adr/0005-toolbar-and-dock-layout-contract.md)
> - [docs/ux-principles.md](../ux-principles.md) — Section layout primitive, sentence case, affordance opacity, item-type parity
>
> **Status:** Not started · **Owner:** Igor · **Last updated:** 2026-05-09
>
> This is a **short-lived working doc.** Delete it after the work merges; ADR 0005 is the durable record. PLAN.md gets a one-line entry referencing the ADR once shipped — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read [ADR 0005](../adr/0005-toolbar-and-dock-layout-contract.md) end-to-end — especially the four-group Top toolbar contract and the two-region Left strip contract.
3. Skim `PLAN.md` Phase 2D entry **for context only** — do not modify it during this work.
4. Read [`packages/fossflow-app/src/components/AppToolbar.tsx`](../../packages/fossflow-app/src/components/AppToolbar.tsx) and [`packages/fossflow-lib/src/components/LeftDock/LeftDock.tsx`](../../packages/fossflow-lib/src/components/LeftDock/LeftDock.tsx) fully before touching either.
5. Use `TodoWrite` to track sub-tasks below.
6. Mark `[x]` as work completes.
7. On completion, follow the "Wrap-up" section to update PLAN.md with a single line.

## Goal

Reorganize the application chrome into the regions defined by ADR 0005:
- Top toolbar — RIGHT zone only, four groups (View modes / Save group / Document actions / Sidebar toggle).
- Left strip — two regions (Navigation / Working panels) plus a system anchor (Settings).
- Burger menu deleted from the app; items redistributed.
- Settings dialog absorbs `About` + `Diagnostics` tabs.

**Not a goal:**
- Implementing Format or View buttons. Their *positions* are locked by ADR 0005; the *controls* are deferred to future ADRs.
- Touching per-panel internals (file-tree controls, layers row UI, elements catalog). Stay at the shell layer.
- Touching `flare_plan.md`, [`PLAN.md`](../../PLAN.md) phase content, the floating ToolMenu, or the BottomDock.

## Scope

### In scope
- [`packages/fossflow-app/src/components/AppToolbar.tsx`](../../packages/fossflow-app/src/components/AppToolbar.tsx) — full restructure.
- [`packages/fossflow-app/src/providers/DiagramLifecycleProvider.tsx`](../../packages/fossflow-app/src/providers/DiagramLifecycleProvider.tsx) — file-explorer state may need to be exposed to the lib via a different surface (or kept where it is and the strip reaches in via context).
- [`packages/fossflow-lib/src/components/LeftDock/LeftDock.tsx`](../../packages/fossflow-lib/src/components/LeftDock/LeftDock.tsx) — add navigation region (📁) at top, separator, system anchor (⚙) at bottom.
- [`packages/fossflow-lib/src/components/SettingsDialog/SettingsDialog.tsx`](../../packages/fossflow-lib/src/components/SettingsDialog/SettingsDialog.tsx) — add About + Diagnostics tabs.
- New small components in `fossflow-app`: `StatusCluster.tsx`, `ExportPopover.tsx`.
- New small component in `fossflow-lib`: `AboutTab.tsx`, `DiagnosticsTab.tsx` (settings tabs).
- Locale files (14 languages) for any new strings.
- Component-level tests for `SettingsDialog` (new tabs) and `AppToolbar` (four-group structure).

### Out of scope
- Format / View / annotation / focus-mode features (future ADRs).
- File tree / layers / elements panel internals.
- Floating ToolMenu, BottomDock.
- Read-only URL mode (already short-circuits).
- Removing `MainMenu` from the lib (kept for other consumers; app simply stops portaling).

## Locked decisions (from design discussion 2026-05-09)

| # | Decision |
|---|---|
| 1 | Burger removed from app chrome. Lib's `MainMenu` stays exported. App passes empty `mainMenuOptions` (or omits the prop) so it short-circuits. |
| 2 | Top toolbar LEFT and CENTER zones empty. Diagram name not in toolbar (canvas owns it). All controls live in RIGHT zone. |
| 3 | RIGHT zone has four groups separated by `tb-divider`, ordered left → right: View modes / Save group / Document actions / Sidebar toggle. |
| 4 | View modes group renders no buttons in this phase. Position reserved per ADR 0005; future ADRs add the controls. |
| 5 | Save action (💾) is rendered only in session mode. It sits flush against the status cluster — they are one visual group. Save action is primary-tinted. |
| 6 | Status cluster contents: server mode = `saved 14:32` / `⟳ saving…` / `⚠ failed [Retry]`; session mode = `state · SESSION · gauge` with warning tint. |
| 7 | Storage gauge keeps its existing per-diagram breakdown popover. The Dump button moves out of the popover into Settings → Diagnostics. |
| 8 | Document actions group: ⬇ Export (popover with JSON / Compact JSON / Image) + 🔗 Share + 👁 Preview. Existing Share popover behavior preserved. |
| 9 | Sidebar toggle (≡ Properties panel) keeps its current location — last group on the right. |
| 10 | Left strip = 📁 (top, navigation) → 1px region separator → ⊞ ≣ (mutex pair, working) → `mt: auto` spacer → ⚙ (system anchor). |
| 11 | 📁 Explorer + one working panel can be open simultaneously (preserved behavior). Elements ↔ Layers stay mutex. |
| 12 | Settings dialog gains `About` (GitHub link, version) and `Diagnostics` (debug overlay toggle, model dump, session dump) tabs. Existing tabs (Hotkeys/Pan/Zoom/Label/Connector/Icon Packs/Language) remain in their current order; new tabs append at the end. |
| 13 | Debug overlay toggle wires through `useUiStateStore.actions.setEnableDebugTools` (already exists). |
| 14 | Floating ToolMenu and BottomDock unchanged. |
| 15 | Read-only URL mode unchanged. |

## Sub-tasks

### A. Left strip restructure

- [ ] In [`LeftDock.tsx`](../../packages/fossflow-lib/src/components/LeftDock/LeftDock.tsx), introduce three slots: top (Navigation), middle (Working), bottom (System anchor). Render a 1px horizontal separator between top and middle. Use `mt: auto` to push the System anchor.
- [ ] Add a `📁 File Explorer` button to the Navigation slot. Wire its on/off state to the existing `fileExplorerOpen` flag in [`DiagramLifecycleProvider.tsx`](../../packages/fossflow-app/src/providers/DiagramLifecycleProvider.tsx). Since the strip lives in the lib and the state lives in the app, expose the toggle via a new `<Isoflow>` prop pair (`fileExplorerOpen`, `onFileExplorerToggle`) — or via an existing context bridge if simpler.
- [ ] Add a `⚙ Settings` button to the System anchor slot. Click → `uiStateActions.setDialog(DialogTypeEnum.SETTINGS)` (same as today's burger Settings item).
- [ ] Confirm Elements ↔ Layers mutex still works (`activeLeftTab` toggle pattern unchanged).
- [ ] Confirm Navigation + Working panels still co-occur as today (they already do, just via different toggle locations).
- [ ] Verify strip matches mock visually (icon sizes, separator weight, settings at bottom).

### B. Top toolbar restructure

- [ ] In [`AppToolbar.tsx`](../../packages/fossflow-app/src/components/AppToolbar.tsx), empty the LEFT zone (drop burger portal target, drop file-explorer toggle, drop save button from here, drop SESSION pill from here, drop SessionStorageGauge from here).
- [ ] Empty the CENTER zone.
- [ ] Restructure the RIGHT zone into four groups separated by `<Divider orientation="vertical" flexItem />`:
  - **Group 1 — View modes:** Empty container. Add a comment marking the reserved slot per ADR 0005 so future PRs land in the right place.
  - **Group 2 — Save group:** Save IconButton (session mode only, primary-tinted) followed flush by `<StatusCluster>`. No divider between Save and StatusCluster — they are one visual unit.
  - **Group 3 — Document actions:** `<ExportPopover>` button + existing Share button + existing Preview button.
  - **Group 4 — Sidebar toggle:** existing `sidebarTogglePortalTarget` ref-box (Properties panel toggle portal).
- [ ] Build new component `packages/fossflow-app/src/components/StatusCluster.tsx`:
  - Reads `serverStorageAvailable`, `saveStatus`, `lastSaved`, `hasUnsavedChanges` from `DiagramLifecycleProvider`.
  - Server mode: renders the existing `renderAutoSaveStatus()` content (saved-at / saving spinner / save-failed retry) inside a soft-bg cluster `<Box>`.
  - Session mode: renders save state text + `<Chip label="SESSION">` (preserving existing styling) + `<SessionStorageGauge>`. Background gets warning tint; cluster acts as a single group.
- [ ] Build new component `packages/fossflow-app/src/components/ExportPopover.tsx`:
  - IconButton with `<DownloadOutlined>` icon.
  - Popover with three options: Export JSON, Export Compact JSON, Export Image.
  - Wires to existing `exportAsJSON`, `exportAsCompactJSON`, and `setDialog(EXPORT_IMAGE)` handlers (currently inside [`MainMenu.tsx`](../../packages/fossflow-lib/src/components/MainMenu/MainMenu.tsx)).
- [ ] Stop calling `setToolbarPortalTarget(...)` from AppToolbar — there's no portal target anymore. The portal ref-box can be removed (or kept as a hidden no-op; prefer removing).
- [ ] Verify read-only URL branch in AppToolbar still renders the read-only chip with no other interactions.

### C. Burger removal & Isoflow wiring

- [ ] In [`packages/fossflow-app/src/App.tsx`](../../packages/fossflow-app/src/App.tsx), stop passing `mainMenuOptions` to `<Isoflow>` (or pass `[]`). MainMenu's existing guard `if (mainMenuOptions.length === 0) return null;` short-circuits cleanly.
- [ ] If `toolbarPortalTarget` was the only consumer of the old portal pattern, simplify the prop wiring; the lib's `Isoflow` API stays as-is for backward compatibility.
- [ ] Confirm no app-level test references the burger or its menu items. Update any that do.

### D. SettingsDialog new tabs

- [ ] Add `Diagnostics` tab to [`SettingsDialog.tsx`](../../packages/fossflow-lib/src/components/SettingsDialog/SettingsDialog.tsx) (new file: `packages/fossflow-lib/src/components/SettingsDialog/DiagnosticsTab.tsx`):
  - Toggle switch for "Enable debug overlay" → `useUiStateStore.actions.setEnableDebugTools(...)`.
  - Button "Download model JSON" → uses existing `exportAsJSON()` utility (or a new dump that includes more state).
  - Button "Download session storage dump" → reuses the `downloadDump()` helper from [`SessionStorageGauge.tsx`](../../packages/fossflow-app/src/components/fileExplorer/SessionStorageGauge.tsx). Extract that helper into a shared util if cleanest.
- [ ] Add `About` tab (new file: `packages/fossflow-lib/src/components/SettingsDialog/AboutTab.tsx`):
  - GitHub link (use existing `REPOSITORY_URL` constant).
  - Version display (use existing `PACKAGE_VERSION` constant).
- [ ] Append both tabs to the existing tab list. Order: existing tabs first, then About, then Diagnostics (so "geeky" stuff is last).
- [ ] Remove the Dump button from `SessionStorageGauge.tsx`'s popover (keeping the per-diagram breakdown). The dump action exists only in Diagnostics.
- [ ] Add locale strings for new tab titles + control labels in **all 14 languages** per [docs/ux-principles.md §7](../ux-principles.md#7-localization).

### E. Tests & verification

- [ ] Component test: `SettingsDialog.test.tsx` asserts About + Diagnostics tabs render and have expected primary controls.
- [ ] Component test: `AppToolbar.test.tsx` (new) — snapshot/structure test for both server and session mode, asserting the four groups exist and Save appears only in session mode.
- [ ] Component test: `StatusCluster.test.tsx` (new) — renders correctly in server mode (`saved at`, `saving`, `failed`) and session mode (state + SESSION + gauge).
- [ ] Component test: `ExportPopover.test.tsx` (new) — popover opens with three options; each invokes the right handler.
- [ ] Verify existing `SessionStorageGauge` tests still pass (Dump button removal may need test update).
- [ ] `yarn build` clean in `fossflow-app`, `fossflow-lib`, and root.

### F. Smoke checklist

- [ ] **Server mode.** Top toolbar: empty LEFT/CENTER, status cluster shows `saved HH:MM`, Export/Share/Preview/Properties visible. Strip: 📁 (active by default per existing first-session logic), ⊞/≣ togglable, ⚙ at bottom. Click 📁 + ⊞ — both panels open. Click ≣ — Elements closes, Layers opens; 📁 stays open.
- [ ] **Session mode.** Top toolbar: 💾 Save adjacent to warning-tinted status cluster (`unsaved · SESSION · 12% 0.6/5MB`). Click gauge → existing breakdown popover. Make a change → cluster updates to `unsaved`. Save → cluster updates to `saved HH:MM`.
- [ ] **Settings → About.** GitHub link opens repo in new tab; version visible.
- [ ] **Settings → Diagnostics.** Toggle debug overlay on → `DebugUtils` panel appears at canvas bottom-left. Toggle off → disappears. Click "Download session dump" → file downloads.
- [ ] **Export popover.** All three options work; downloaded files match pre-revamp behavior.
- [ ] **Read-only URL.** Visiting `/display/{id}` shows only canvas + read-only chip; no save/share/export/properties controls.
- [ ] **Save error path.** Force a save failure (kill backend or throw in handler); status cluster shows `⚠ save failed [Retry]`; clicking Retry attempts save again.
- [ ] **Multi-tab session.** Close and reopen browser tab in session mode; SESSION pill + gauge appear correctly on reload; state persists per existing localStorage flags.

## Wrap-up

When all sub-tasks are checked off and the smoke checklist passes:

1. Add a single line under PLAN.md Phase 2D section:
   ```
   - Toolbar & dock layout revamp shipped — see docs/adr/0005 and (this file's git history).
   ```
2. Flip `Phase 2D` status in the dashboard table from `[ ]` to `[x]`.
3. Delete this file. ADR 0005 is the durable record; this checklist's job is done.
4. Update memory pointer `project_docs_convention.md`:
   - Move ADR 0005 from "Existing ADRs" to remain there (no change — it stays).
   - Remove the `Active tactical docs:` bullet for `layout-revamp.md`.
5. Optionally extend [`docs/ux-principles.md`](../ux-principles.md) with a new section referencing ADR 0005 — "Layout regions" — so the principle is discoverable from both the principles doc and the ADR. Keep it short; ADR holds the authoritative contract.

## Notes for Claude

- This work spans `fossflow-app` (toolbar, status cluster, export popover, app wiring) and `fossflow-lib` (left strip, settings tabs). Build both packages after each sub-section.
- The 📁 File Explorer toggle moves *out* of the app and *into* the lib's strip. The `fileExplorerOpen` state still belongs to the app's `DiagramLifecycleProvider`. Bridge via a new `<Isoflow>` prop pair rather than dragging state into the lib — keeps the lib clean.
- The lib's `MainMenu` is not deleted. Just the app stops using it. Lib API surface stays stable.
- When extracting `downloadDump()` from `SessionStorageGauge.tsx`, keep its signature simple — it's pure side-effect (creates a Blob, triggers download). Move to `packages/fossflow-app/src/utils/sessionDump.ts` or similar.
- Save action and status cluster are visually adjacent: no `<Divider>` between them, just `gap: 0.5` or `gap: 0`. The Save button has primary tint; the cluster has either neutral or warning background. Together they read as one group.
- Format/View are *not* implemented in this phase. Leave a comment in AppToolbar like `{/* Group 1: View modes — reserved per ADR 0005, future ADRs add controls here */}` so the next person doesn't think the slot is unintentionally empty.
- Per [UX principles §1.2](../ux-principles.md#12-no-all-caps-section-headers), all new tab labels are sentence case ("About", "Diagnostics") — not ALL CAPS.
- Per [UX principles §3.1](../ux-principles.md#31-f2--rename-universally), no F2 binding affected here. Keyboard handlers in StatusCluster (if any) should use `e.stopPropagation()` to avoid canvas-level bindings.
