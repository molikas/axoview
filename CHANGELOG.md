# Changelog

All notable changes to this fork are documented here.
For upstream FossFLOW history (pre-fork), see [docs/upstream-changelog.md](docs/upstream-changelog.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning uses a date-based scheme: `YYYY.M.D` — the version always reflects the date the release was cut from `master`. The live demo at [demo-fce.pages.dev](https://demo-fce.pages.dev/) always runs the latest version.

---

## [Unreleased]

### Added

- **Icon import: AI-prompt affordance in the Elements panel.** Sparkles ([`AutoAwesomeOutlined`](https://mui.com/material-ui/material-icons/?query=auto+awesome)) icon next to "Import Icons" opens a popover with a literal isometric-icon LLM prompt and a Copy-to-clipboard button. Prompt body intentionally not i18n'd (it's content the user pastes verbatim into an external tool); affordance text exists in all 12 locales. mqa-results.md #28.

### Changed

- **Floating action bar opens on right-click only.** Left-clicking a node / connector / rectangle / text-box now only sets selection — the floating `NodeActionBar` no longer appears unless the user right-clicks the item. Adds `itemActionBarOpen` to `uiStateStore`; `setItemControls` resets it on selection change so re-selecting another item doesn't carry the bar over. mqa-results.md #1.
- **Lock + hide layers now enforce non-interaction across every selection path.** `isItemInteractable` (built in `useInteractionManager` from `lockedIds` + `visibleIds`) gates direct-click selection (`Cursor.mousedown`), marquee selection (`Lasso.getItemsInBounds`), freehand selection (`FreehandLasso.getItemsInFreehandBounds`), and right-click context-menu. Previously only `lockedIds` was checked and only at direct-click — lasso freely scooped up locked and hidden items. Locked rows now also get a warning-colored left accent stripe + tinted background + saturated lock icon so the state is unmistakable. Layers panel rows remain the escape hatch for selecting hidden/locked items. mqa-results.md #2.
- **F2 renames the selected layer in the Layers panel.** Mirrors the file-explorer F2 pattern via a document-level `keydown` listener gated on focus being inside the panel or on `body` (so the file-explorer's own F2 stays authoritative when its container is focused). Edit state is lifted out of `LayerRow` so it can be triggered externally. mqa-results.md #3 / #15.
- **Layers panel always shows the "Unassigned" section.** Previously hidden when no unassigned items existed — left users with no drop target to pull items back out of a layer. Empty state shows a dashed-outline drop hint; dragging onto the section unassigns the item. mqa-results.md #4.
- **Folder explorer + Layers panel toolbar icons are hover-revealed (VS Code style).** Icons sit at `opacity: 0` and fade in (`120ms ease`) on container `:hover` / `:focus-within`. Keep their DOM space so layout doesn't reflow. Applies to file-explorer (new diagram/folder, import, export, refresh, collapse) and Layers (add layer, delete selected). mqa-results.md #27.
- **Storage-gauge label drops to `0.75em`.** Documented inline as a typography-contract exception so future sweeps don't normalise it back. mqa-results.md #6.
- **Share-link popover Copy button is sentence-case.** Explicit `textTransform: 'none'` override — the `AppToolbar` lives outside the lib's `ThemeProvider` scope so it would otherwise inherit MUI's default uppercase Buttons. mqa-results.md #23.
- **Page (view) count hard-capped at 5.** Interim guard until the tab-overflow UX is rebuilt — the "+" button disables with an "Page limit reached (5)" tooltip beyond the cap. See [known_issues.md](known_issues.md). Page-overflow scroll/redesign deferred. mqa-results.md follow-up 2026-05-15.
- **Preview-mode interaction redesigned (MQA #22 + #25).** In `EXPLORABLE_READONLY`: default cursor is `default` (right-drag pans, matching the canvas); left-click on a node with clickable content opens the readOnly `NodePanel` via `Pan.mouseup` and the cursor flips to `pointer` on hover. Panel header is the node name itself rendered as a clickable link when `headerLink` is set (URL surfaces via tooltip); body adds a new "Linked diagram" section showing the resolved diagram name as a clickable link, or an explicit `Cannot resolve linked diagram with id: <id>` error when the target is missing. Removed the prior icon-based header affordances. mqa-results.md #22 / #25.
- **Diagram rename now mirrors into the per-diagram blob (session mode).** `LocalStorageProvider.renameDiagram` updates both the diagrams listing and `blob.title` / `blob.name` so project export captures the new name even for diagrams that weren't reopened post-rename. mqa-results.md #14.
- **F2 inline-rename in the file explorer ignores keystrokes outside the renderer.** Lib's window-level keydown handler now scopes the F2 → `inlineEditNodeName` dispatch to events originating inside the renderer, so a canvas-selected item no longer steals focus from the file-explorer's edit input. mqa-results.md #13.
- **Delete-diagram resets the canvas (MQA #18).** New `notifyDiagramDeletedFromTree(id)` on `DiagramLifecycleProvider` cancels pending autosave, drops the scratch buffer, clears the active diagram ref, and reloads a blank scene. Wired into both `FileExplorer` and `DiagramManager` delete flows so the autosave can't recreate the just-deleted diagram.
- **Delete-folder now sweeps orphan diagrams (backend).** `deleteFolder` (Express adapter) removes every `diagrams/<id>.json` whose `folderId` pointed at any deleted folder, plus any associated `public/<shareUuid>` snapshots. Closes the gap that left orphaned diagrams visible in `listDiagrams` after a folder delete.

### Fixed

- **MQA #5 — connector redo now restores the connection.** The scene-store undo was recomputing the future-stack entry via `produceWithPatches(currentScene, draft => Object.assign(draft, applyPatches(currentScene, entry.inversePatches)))`, which yielded patches in the **wrong direction** (B → A, an undo). On redo, those undo-direction patches applied to an already-undone state were a no-op — model.redo correctly restored `views[].connectors` but `scene.connectors[id]` stayed empty (no path → invisible connector), and the future entry was still consumed (redo button disabled). Scene store now mirrors model store: push the **original** entry to future on undo; pop and re-apply forward on redo. Load-bearing invariant — see [docs/architecture.md §7](docs/architecture.md).
- **MQA #5 (secondary) — right-click "Add connection" undo collapses to one step.** `NodeActionBar.handleStartConnector` now wraps `createConnector` with `beginDragTransaction` / `commitDragTransaction` so the entire create + drag + commit lifecycle lands as a single history entry (matched the palette-tool drag path which was already correct).
- **MQA #5 (defensive) — no-op `set()` no longer clobbers the redo stack.** Both `modelStore.set` and `sceneStore.set` short-circuit when the computed patches array is empty: state still applies but the past/future arrays are left untouched. Originally fixed the "no-op selection write between two redos drops the trailing entry" class.
- **MQA #12 — `1. <space>` at the start of an empty rich-edit line no longer erases the input.** Override Quill's `list autofill` keyboard binding with a noop handler that returns true (literal space inserted, autofill never replaces the line with an empty `<ol>`). Toolbar buttons remain the canonical way to start a list.
- **MQA #14 — diagram rename now persists into project export.** See Changed entry above (session-mode blob mirror).
- **MQA #14 (follow-up) — import after folder delete no longer 409s.** `importProject` strips the original `id` from each model blob before calling `createDiagram`, so the server allocates a fresh id and orphaned-id collisions can't abort the import. Pairs with the backend orphan sweep above.
- **MQA #16 — node-edit deck stays open when text drag-select crosses its edge.** `Cursor.mouseup` ignores mouseups whose drag started outside the renderer (no canvas-side mousedown registered + `mode.mousedownHandled === false`). Panel only dismisses on a genuine canvas click.
- **MQA #18 — autosave can no longer resurrect a deleted current diagram.** See Changed entry above.
- **MQA #21 — Docker folder create + project import no longer fail.** Three cooperating fixes in `packages/fossflow-backend/src/routes.js`: (1) `createFolder` / `createDiagram` use random-suffix ids (`folder_${Date.now().toString(36)}_${rand}`) with a collision retry, so back-to-back sequential creates from the SPA can't collide on `Date.now()`. (2) `readFolders` coerces legacy `{ folders: [...] }` payloads (and other unexpected shapes) into a flat array so the fs adapter survives an out-of-shape `folders.json` from an earlier code version. (3) Both adapters log unexpected shapes once so legacy files surface in production logs.
- **MQA #22 — duplicate "Open in new tab" tooltip in preview mode.** Removed the inner badge-level `<Tooltip>`; the outer node-body tooltip covers the badge area. Superseded by the broader #22 / #25 redesign above (passive badge now non-interactive; click goes to the panel).
- **MQA #24 — share-link no longer leaks the backend port.** New `shareUrlFromUuid(uuid)` helper builds the URL from `window.location.origin` instead of trusting the server's `req.get('host')` (which returned `:3001` when the SPA was on `:3000`). Used by `AppToolbar`, `DiagramManager`, and the file-explorer share action.
- **DiagnosticsOverlay scene counts (`ni` / `nc` / `ntb`) now report real values.** Two cooperating fixes: `Isoflow.tsx` exposes `window.__fossflow__` whenever `NODE_ENV !== 'production'` (in addition to the existing `enableDebugTools` opt-in) — previously absent in normal dev builds because the app never passes the prop, so the overlay's store reads always returned zero. And `getSceneCounts` in `DiagnosticsOverlay.tsx` now reads the active view's `items.length` and `connectors.length` (via `ui.view`) instead of the model item catalog (which is the icon library, not placed nodes). Companion fix to MQA #7 — without these, post-fix perf profiles couldn't correlate FPS with scene complexity.

### Performance

- **MQA #7 — multi-element drag FPS cliff eliminated.** Drag of 6+ selected nodes used to drop from 60 fps to 9–13 fps for 12–19 seconds at a time, recovering only after a major GC. Three-stage architectural fix: (1) `bba712c` wrapped `DragItems` in `beginDragTransaction` / `commitDragTransaction` matching the connector-drag pattern from `7164b3b`, collapsing per-tick history pushes and skipping `produceWithPatches` while pendingPre is frozen; (2) `728b229` split `Node` into a thin position shell + memoized `NodeContent`, replaced inline `sx={{left, top}}` with module-level sx constants + inline `style`, and switched `useScene()` → `useSceneActions()` inside `NodeContent` to break a shallow `views` subscription that was firing every drag frame; (3) `7e09fba` (Path 4-true) introduced CSS-only drag preview — items and free-floating waypoint anchors no longer write to the model per frame; visual updates are pure DOM CSS-variable mutations on `data-drag-id` elements, connector geometry is recomputed via a new `scene.previewConnectorPaths(itemPreview, anchorPreview)` action that writes straight to `scene.connectors[].path`, and `flushSync` keeps Connector subscribers in lockstep with the CSS mutations. Final tile values commit to the model on mouseup via `batchUpdateViewItemTiles` + per-connector `scene.updateConnector`; the drag transaction collapses everything into one history entry. **Result:** sub-13fps cliff eliminated entirely; sustained 24–44 fps throughout the drag. Trade-off: `view.items[].tile` and `view.connectors[].anchors[].ref.tile` are stale during a drag — see [docs/architecture.md §1 Drag Items](docs/architecture.md#1-feature-inventory) and [docs/perf-troubleshooting.md](docs/perf-troubleshooting.md) for the full invariant. Also fixes a long-standing Lasso bug where waypoint anchors weren't pushed into the selection when both endpoint items were in lasso bounds.
- **Render-probe diagnostic harness (`useRenderProbe`).** Gated behind `?perfprobe=1`; zero cost when off. Already wired into `Nodes` / `Node` / `NodeContent` / `Connectors` / `Connector`. Console API: `window.__fossflowRenderProbe.start() / stop() / dump()`. Built for the MQA #7 investigation and kept as durable infrastructure for the next perf round.

### Removed

- **Export Compact JSON, entirely (MQA #17).** Compact serialiser, `transformToCompactFormat` / `transformFromCompactFormat` / `exportAsCompactJSON`, public re-exports (`packages/fossflow-lib/src/index.ts`), MainMenu entry, ExportPopover entry, file-explorer context-menu entry, `DiagramManager` load-side back-compat path, jest mock, `isoflowProps` type field, and the `exportCompactJson` i18n key across all 12 locales. The compact format was lossy (rectangles, text, connector labels, color, style, notes were all dropped) and never worth keeping alongside the full JSON export.

### Tests

- **`connector.createUndoRedo`** — real-store regression exercising the full begin/createConnector/updateConnector×N/commit/undo path; asserts both stores' `canRedo()` return true and that the connector reappears after redo. Pins the MQA #5 root-cause fix.
- **`Pan.modes`** — adds EXPLORABLE_READONLY cursor (default vs grab), mousedown-no-grabbing-in-preview, and body-click-opens-panel-for-any-content-bearing-node assertions.
- **`node.linkTooltipDedup`** — repinned for the final design: header name-as-link testid, LINKED DIAGRAM body section testids (resolved link + unresolved error), absence of the old icon-based header affordances, no `OpenInNewIcon` import.
- **`f2.rendererScope`** — pins the F2 → `inlineEditNodeName` renderer-scope guard (#13).
- **Lib-side `RichTextEditor.formats`** — extended to pin the `list autofill` noop-handler override (#12).
- **App-side regressions** — new `shareUrl.test.ts` (origin-anchored share URL), `LocalStorageProvider.test.ts` rename-mirrors-blob, `delete.contract.test.ts` (Provider + FileExplorer + DiagramManager call order for #18), `backendRoutes.contract.test.ts` (random-suffix id pattern + collision-retry loop for #21).
- **`DragItems.modes` (MQA #7 Path 4-true)** — 6 new assertions pinning the CSS-preview contract: entry/exit/mouseup open and commit `beginDragTransaction`; mousemove does NOT call `scene.transaction` or `scene.updateConnector` for node-only or waypoint drags (route is `previewConnectorPaths` with both item and anchor preview maps); mouseup commits items via `batchUpdateViewItemTiles` and waypoints via per-connector `scene.updateConnector`; rare anchor RECONNECT path (no `initialTiles[anchorId]`) still flows through `scene.transaction`.

---

## [2026.5.11] — 2026-05-10

### Added

- **Typography contract — six tiers, theme-driven.** [`theme.ts`](packages/fossflow-lib/src/styles/theme.ts) now defines `h6 / body1 / body2 / caption / overline / micro` with explicit roles (dialog title / dialog body / primary readable lists / sub-labels / region wayfinding / glanceable status). Custom `micro` variant registered via TypeScript module augmentation. Component-level overrides (`MuiTab`, `MuiChip`, `MuiInputBase`, `MuiFormControlLabel`) live in the theme — no per-component `fontSize`/`fontWeight`. `overline` is sentence case + tracked (NOT uppercase) to honor §1.2 / §7.2. See [docs/ux-principles.md §1.5](docs/ux-principles.md).
- **"Add more icons" accordion in the Elements panel.** Pack-loader buttons + Import Icons collapsed into a single accordion (closed by default) — gives the icon grid back its full vertical real estate without losing the affordances. Sentence-case title; uppercase removed.
- **Layers panel: Shift-click range / Ctrl-click toggle multi-select.** Routes through canvas LASSO mode so the existing floating action bar and canvas highlights work for free. Bounding tiles computed from scene data so the action bar positions correctly above panel-driven selections. Anchor row is the last plain-clicked item; ephemeral panel state, not stored.
- **Import validation surfaces to the user.** Schema-failed diagram loads now push a `severity: 'error'` notification with the first 1–2 zod issues summarised, alongside the existing `console.error`. New UX principle §6.3 codifies this for any future user-triggered failure path.
- **`Export Project (.zip)` in the Export popover.** Folded into the toolbar Export menu alongside Export JSON / Compact JSON / Image. `setShowProjectExport` hoisted into `useDiagramLifecycle` so the trigger lives next to the other export actions.

### Changed

- **NodeActionBar stays at natural pixel size at every zoom.** Counter-scales the SceneLayer transform via direct DOM ref with `1 / zoom` (was `Math.min(1, 1/zoom)` — bar shrunk on zoom-out). Pattern documented in new UX principle §8.8 for any future canvas-anchored chrome.
- **QuickIconSelector — parity with Elements panel.** Replaced the bespoke `TextField` with the shared `Searchbox` component, routed filtering through `useIconFiltering`, dropped the `helpBrowse` / `helpSearch` footer and the `searchPlaceholder` key. Recently-Used and keyboard navigation (Arrow / Enter / Escape) preserved.
- **Save / Load / Export / Confirm dialogs — MUI body, sentence case.** Rewrote `SaveDialog` / `LoadDialog` / `ExportDialog` from the legacy `<div className="dialog">` HTML to MUI `Dialog + DialogTitle + DialogContent`. Deleted dead `SaveAsDialog.tsx` and the matching CSS. Dropped `fontWeight={600}` on `h6` titles — theme owns typography weight now.
- **SessionModeBanner — quieter, dismiss-only.** `background.paper` background + 4 px `warning.main` accent stripe + caption typography (was a full warning-tinted bar). Export button removed (now in the toolbar Export popover); only the dismiss × remains. Dismissal persists in `localStorage['fossflow-session-banner-dismissed']`.
- **`Session` chip + storage gauge — less prominent.** Chip height reverted from 18 → 16, padding tightened to 0.5, `micro` variant `fontWeight` 600 → 500. The literal `"SESSION"` is now `"Session"` (sentence case per §1.2). Gauge chip same shrink — keeps its dynamic warning/error filled state.
- **Layers panel rows — match file explorer styling.** Item row text color flipped from `text.secondary` to `text.primary`; icon thumbnail no longer dimmed at `opacity: 0.7`. Selected state still uses `primary.contrastText`. Both panels now read as the same family.
- **Connector additional-label "Text" input.** Replaced the floating MUI `label="Text"` with an external `caption` Typography label + `size="small"` TextField — matches the Position / Height offset / Font size pattern in the same card.
- **Region/dock headers — sentence case.** `Diagrams` (was `DIAGRAMS`), `Layers`, `Common`, `Unassigned`, icon-pack collection names, etc. all render via the `overline` variant in sentence case. Uppercase styling came from a per-component CSS transform; removed in favour of role-driven typography. Honors UX §1.2 / §7.2.

### Tests

- **`quickIconSelector.i18n.test.ts`** — refreshed contract: search input is the shared `Searchbox`, help footer dropped, `searchPlaceholder` / `helpSearch` / `helpBrowse` keys removed from `quickIconSelector` namespace.
- **DebugUtils snapshots** — re-baselined after theme changes (only emotion-generated CSS class hashes shifted; visual content identical).

### Known issues

- **i18n: "Add more icons" accordion title / orphan keys not translated outside en-US.** Two new entries in [`known_issues.md`](known_issues.md). Backfill the `iconSelectionControls.addMoreIcons` key in 13 non-English locales; strip the obsolete `quickIconSelector.searchPlaceholder` / `helpSearch` / `helpBrowse` keys from those same files. Functionally harmless (English fallback renders the key); cosmetic cleanup.
- **`leanSave.test.ts` — 1 pre-existing failing assertion.** `mergeBundledFixtures (ADR 0002) › overridden default wins…` reads `bundledFixtures[0].id` but the fixtures source is empty (predates the 2026-05 shake-out). Recorded in `known_issues.md`. Runtime path is unaffected (`iconPackManager` supplies real packs).

---

## [2026.5.10] — 2026-05-10

### Performance

- **Connector drag — collapsed history entries.** Each tile crossed during a connector drag (or anchor reconnect) used to push a separate history entry, computing patches across the entire model per tick. Now wrapped in a `beginDragTransaction` / `commitDragTransaction` pair on the scene store — one entry per drag. Implementation: `pendingPreFrozen` flag on both `modelStore` and `sceneStore` keeps the pre-drag snapshot alive across intermediate `set()` calls; commit triggers a single patch computation. Side benefit — `Ctrl+Z` after a drag rewinds the whole drag, not one tile at a time.
- **Closed-form connector router.** Replaced A\* over an always-empty `PF.Grid` (in [`utils/pathfinder.ts`](packages/fossflow-lib/src/utils/pathfinder.ts)) with a deterministic diagonal-then-orthogonal walker. The grid had no obstacles, so A\* was searching for an answer geometry already determines. Removes the per-tick `Grid` + `Node` object allocation churn that produced a constant 100→200 MB GC sawtooth during sustained interaction. Original symptom (FPS dropping to 2–10 fps within seconds of drag start) is gone; first ~50 s of drag now holds 60 fps on the perf-stress fixture.

### Tests

- **`connector.dragPerf.test.tsx`** — 4 perf-regression tests against the real provider stack: drag transaction collapses N tile updates into 1 history entry; baseline (no transaction) still pushes N entries; `pendingPre` stays alive across intermediate ticks; 40-tick drag completes under 1500 ms (currently ~37 ms). The fixture is loaded from disk and `modelSchema.safeParse`d on test setup so the manual import file can't drift out of schema.
- **`packages/fossflow-e2e/fixtures/perf-stress-diagram.json`** — heavy importable scene (80 nodes, 120 connectors, two named anchors at opposite ends of the canvas). Compact single-line JSON, schema-valid, regenerated from [`perf-stress-diagram.generator.mjs`](packages/fossflow-e2e/fixtures/perf-stress-diagram.generator.mjs). Shared between manual stress tests and the automated perf regression — single source of truth.

### Known issues

- **Sustained connector drag (≳50 s) still hits a GC cliff.** Per-tile model immer clones (~12 MB/sec on the stress fixture) accumulate to ~336 MB before V8 fires a stop-the-world collection, producing a 5-second 4-fps stall. Doesn't affect typical use (drag from A to B = 5–10 s). Refactor design context — including the two-reader invariant, files in the hot path, and the deferred `previewAnchors` approach — captured in [`known_issues.md`](known_issues.md) for a future session.

### Added

- **Toolbar and dock layout contract (ADR 0005).** Top toolbar collapses to a single RIGHT zone with four named groups separated by dividers, ordered left → right: View modes (reserved slot — buttons land here in future ADRs), Save group (Save button in session mode + StatusCluster), Document actions (Export / Share / Preview), Sidebar toggle (Properties panel portal). LEFT and CENTER zones are intentionally empty — diagram name continues to live on the canvas. See [ADR 0005](docs/adr/0005-toolbar-and-dock-layout-contract.md).
- **Left strip absorbs File Explorer and Settings.** Two regions (Navigation `📁` / Working `⊞ ≣`) plus a system anchor (`⚙ Settings`) at the bottom. The 📁 toggle moved out of the top toolbar; ⚙ replaces the deleted burger Settings item. Elements / Layers stay mutex; `📁 + ⊞` (or `📁 + ≣`) co-occur as before.
- **Settings dialog gains About and Diagnostics tabs.** *About:* GitHub link + version. *Diagnostics:* debug-overlay toggle (drives `useUiStateStore.actions.setEnableDebugTools`), Download model JSON, Download session dump (re-homed from the SessionStorageGauge popover — gauge keeps its per-diagram breakdown).
- **`ExportPopover` in toolbar Group 3** — single ⬇ button with a popover offering Export JSON / Export Compact JSON / Export Image. Replaces the three burger entries.
- **`StatusCluster` in toolbar Group 2** — bundles save state + (in session mode) the SESSION chip and storage gauge. Save button sits flush against it so the action and state read as one visual unit.
- **`MainMenuOptions` re-exported** from the lib's standalone exports so callers can type their `mainMenuOptions` prop without dipping into internal paths.
- **`disableLeftDockWorkingTabs` prop** on `<Isoflow>` — when no diagram is loaded, Elements and Layers icons are disabled with a "open or create a diagram first" tooltip. Avoids dead-end clicks on the empty state.

### Changed

- **Left-side panels overlay the canvas instead of pushing it.** File Explorer is now an absolute overlay sibling of `Isoflow` at `left: 40px`; Elements / Layers panel offsets to `left: 320px` when File Explorer is open so both can coexist with each panel's `borderRight` providing the visual seam. Canvas dimensions stay constant regardless of which panels are open. Aligns with the existing rule for the right Properties panel.
- **No slide animation on left-side panels.** All left-side panels (File Explorer, Elements, Layers) appear and disappear instantly. The previous behaviour was inconsistent — File Explorer never animated; Elements / Layers slid via `transform`/`transition`. Snapping removes the inconsistency and the layout-jump that switching between panel types produced.
- **`StatusCluster` simplified — no orange wrapper.** The SESSION chip alone signals the mode; the tinted box around the cluster was redundant. Saved-text only renders when there is something to say (no more empty `<span>` placeholder).
- **`EmptyStateScreen` confined to the canvas region.** Now positioned at `top: 0, left: 40, right: 0, bottom: 40` instead of `inset: 0`. The left strip (40 px) and BottomDock (40 px) stay visually uncovered, so the chrome is visible on first load even before a diagram exists. Removed the legacy `.fossflow-container > div { height: 100% }` rule that was overriding inline `bottom` positioning on overlay siblings.
- **BottomDock + LeftDock strip raised to `zIndex: 20`.** Belt-and-suspenders against future overlay collisions; the geometric exclusion above is the load-bearing fix.

### Fixed

- **Empty state no longer hides the toolbars.** Root cause: `Isoflow`'s outer `Box` uses `transform: translateZ(0)` which creates a new stacking context, trapping the strip's `zIndex: 20` inside it; externally `Isoflow` ranked at `auto` and lost to `EmptyStateScreen`'s `zIndex: 5`. Geometric fix (above) is robust against this without depending on z-index across the boundary.
- **`ExportPopover`** dropped the inner `<Paper>` wrap (`Popover` already wraps via `PaperProps`).
- **`DiagnosticsTab`** stray `exportAsJSON(model as any)` cast removed — `modelFromModelStore` already returns `Model`.
- **`AboutTab`** GitHub link opens with `noopener,noreferrer`.
- **`AppToolbar`** dead `dirtyDiagramIds` / `multiDirtyCount` removed; Save tooltip simplified.
- **`MAIN_MENU_OPTIONS` typed correctly.** `never[]` (semantically the impossible array) → `MainMenuOptions`.

### Removed

- **Burger menu in the app chrome.** Lib's `MainMenu` is still exported for other consumers; the app simply stops portaling it. Items redistributed per ADR 0005: New / Open / Clear → file explorer; Export* → toolbar Export popover; Settings → strip ⚙; GitHub + Version → Settings → About.

---

## [2026.5.9] — 2026-05-09

### Added

- **Connector as a first-class peer of nodes.** `name`, `notes`, `headerLink`, `showLabel` fields added to `connectorSchema`. Synthetic name label rendered at the connector midpoint on the canvas; F2 inline rename reuses `inlineEditNodeName`. Name label becomes a clickable link when `headerLink` is set (`OpenInNew` overlay). `ConnectorControls` restructured into Details / Style / Notes tabs matching `NodePanel` shape. See [ADR 0004](docs/adr/0004-connector-name-and-details-panel.md).
- **`name` field on TextBox and Rectangle.** Both schemas gain `name: z.string().max(200).optional()`. `RectangleControls` and `TextBoxControls` add a Name section (sentence-case label, `Element name…` placeholder). Layer-tree shows the name when set, falling back to `content` (text box) or `'Rectangle'`.
- **Layers-panel F2 rename for `TEXTBOX` and `RECTANGLE`** (was `ITEM`/`CONNECTOR` only). `LayerItemRow` `RENAMEABLE` set extended; `handleItemRename` wires `updateTextBox` / `updateRectangle`.
- **Polymorphic floating action bar.** `NodeActionBar` now handles all four item types: `ITEM`, `CONNECTOR`, `TEXTBOX`, `RECTANGLE`. Per-type delete (`deleteViewItem` / `deleteConnector` / `deleteTextBox` / `deleteRectangle`) and per-type panel events (`nodePanel` / `connectorPanel` / `textBoxPanel` / `rectanglePanel`). Connector tile threaded through `ItemControls` (`Cursor.ts`) so the bar positions above the click point — connectors have no intrinsic tile.
- **Connector width slider — 5 stops** (10 / 15 / 20 / 25 / 30) instead of 3 (10 / 20 / 30). Same range, finer resolution; existing diagrams unchanged because all previous values still align to marks.
- **`ConfirmDialog` Enter-to-confirm** keyboard shortcut at the dialog level.
- **`LayerItemRow` icon thumbnails for ITEM rows.** Other types use 16 px glyphs.
- **Layer name-label toggle.** Eye icon swaps `LabelOutlined` / `LabelOffOutlined` (semantically *item name visibility*, not layer visibility — see [docs/ux-principles.md §2.2](docs/ux-principles.md)). Opacity 0.5 at rest, 1 on hover; wired on both the layer-group and unassigned render sites.
- **`EmptyStateScreen` Import card.** Direct import path for empty trees; `ImportDialog` opens for non-empty trees so existing diagrams aren't silently overwritten. Post-import auto-opens the file explorer with a success notification. `onCreate` / `onImport` cards rendered side-by-side.
- **`refreshFileTree`** exposed from `DiagramLifecycleProvider`.
- **Locale namespace expansion** across all 14 locales: `connectorControls` (name, color, width, lineStyle, lineType, useCustomColor, showArrow, solid/dotted/dashed, singleLine/doubleLine/doubleLineWithCircle, addLabel, noLabels, showName/hideName); `nodePanel` showName/hideName; `textBoxControls` and `rectangleControls` `name` + `namePlaceholder`.
- **`docs/ux-principles.md`** — living design language reference covering Section as the layout primitive, sentence-case-everywhere, half-opacity affordances, F2 rename universally, two-way panel/canvas sync, item-type parity, icon semantics, and localisation rules. Referenced by `/feature`, `/shake-out`, `/audit`, `/notes`.
- **ADR 0004** — connector name and details panel.

### Changed

- **Sentence-case sweep across all property panels.** `Section` component dropped `textTransform: uppercase`; now `caption` + semibold + secondary color, sentence case throughout (Node / Connector / TextBox / Rectangle). Material-Design-2014 ALL CAPS legacy retired.
- **`ConnectorLabels` filter** fixed to include name-only connectors (was the root cause of missing canvas labels for connectors with `name` but no legacy `description`).
- **Default zoom 75 % → 65 %** for more breathing room on initial load.

### Fixed

- **Connector Style: width slider at max no longer triggers a horizontal scrollbar.** Root cause: MUI Slider thumb's invisible 42 × 42 `::after` hit-area pseudo-element extends ~21 px past the slider's right edge at `left: 100 %`; combined with `TabPanel`'s `overflowY: 'auto'` (which CSS-spec-converts `overflow-x: visible` → `auto`), this triggered a horizontal scrollbar. Fix: `overflowX: 'hidden'` on `TabPanel` in both `ConnectorControls` and `NodePanel`. The hit-area is invisible — clipping it has no visual or interaction cost.
- **Layer eye toggle** — `onToggleLabel` handler was missing on the unassigned render site; now wired alongside the layer-group site.

### Tests

- No new test files this release. Test count and suite count unchanged.

---

## [2026.5.3] — 2026-05-03

### Added

- **Phase 5* — Cloudflare + Docker dual-target deployment.** Single `/api/*` HTTP contract served by Express+filesystem (Docker) and Hono+R2 (Cloudflare Pages Functions). New `packages/fossflow-worker/` package and `functions/api/[[path]].ts` bridge. Frontend is byte-identical at the network boundary across targets.
- **Runtime config endpoint** — `GET /api/config` replaces build-time env injection. New `useRuntimeConfig` hook + `apiBaseUrl()` helper consolidate three inline copies.
- **Public-snapshot share model** — `POST /api/diagrams/:id/share` publishes an immutable snapshot at `/api/public/diagrams/:uuid` (read bypasses auth); `DELETE` unpublishes.
- **Project zip workspace bundle** (ADR 0001) — import/export the full workspace as a single `.zip` (manifest + `diagrams/<id>.json` + tree-manifest). New `projectZip.ts`, `ExportDialog`, `ImportDialog` components. Destination picker on import (Merge into root / New folder / Replace all with typed-confirm).
- **Lean icon save** (ADR 0003) — every write path strips default-catalog icons; load-time merge in `useInitialDataManager` rehydrates them (ADR 0002). New `leanSave.ts` helper.
- **`requiredPacks: string[]`** persisted alongside lean icons so importers know which icon packs to lazy-load. `loadPacksForDiagram` now reads `data.requiredPacks` (with an items × icons fallback for non-lean payloads).
- **Session storage gauge** in the file-explorer header — chip leads with `%` (e.g. `<1% · 3.6 KB`); click for per-diagram breakdown popover. Color thresholds at 60% / 90%.
- **Session-mode banner** appears when storage resolves to session and ≥1 diagram exists; dismissable per session.
- **File-explorer Import / Export-project toolbar buttons.**
- **Per-diagram and per-folder Export…** entries in the tree context menu.
- **Per-diagram export split** into three flat actions — *Export as image…* (delegates to lib's rich `ExportImageDialog`, auto-opens the diagram if needed), *Export as JSON*, *Export as compact JSON* (both download directly, no dialog).
- **Inline rename on canvas** — F2 with a node or text-box selected, or double-click on its label, enters inline-edit on the canvas via a contentEditable Typography that auto-grows rightward.
- **File-tree rename via F2 + context menu** (double-click rename tracked in [known_issues.md](known_issues.md) with workaround).
- **`sessionWorkUnexported` flag** drives the `beforeunload` prompt without overloading `hasUnsavedChanges`; clears only on successful project-zip export.
- **Image export available in session mode** (server-storage gate dropped).
- **Public lib exports** — `exportAsJSON`, `exportAsCompactJSON`, `DialogTypeEnum`, `IsoflowRef.openExportImageDialog()` so callers outside the Isoflow provider tree can trigger the dialog.
- **Default new-view name `"Page 1"`** (was `"Untitled view"`).
- **ADRs 0001-0003** — durable architectural decisions for project zip format, icon catalog merge contract, and lean icon save.
- **Tactical doc convention** — `docs/tactical/<topic>.md` for short-lived implementation plans, deleted after work merges.
- **`/feature` skill** — bootstraps new features against the ADR + tactical convention.

### Changed

- **Burger menu trimmed** to Settings · GitHub · Version. "Clear the canvas" item deleted.
- **Toolbar [Ctrl+O] folder icon removed** (duplicate of file-explorer toggle); Save in session mode now wires through `flushAutoSave()`.
- **Import dialog wording** rewritten in user vocabulary: "At the top — keep the original folder layout" / "Inside a new folder" / "Replace all existing folders and diagrams". Lead row now shows the contents summary instead of the raw filename.
- **Cloudflare runtime is storage-less** — R2 dropped from the Worker and both `wrangler.toml` files. `/api/config` reports `serverStorage: false`; SPA falls back to session/localStorage. Persistent storage on Cloudflare will return via the Drive provider on a separate branch.
- **Env names standardized** to `AUTH_SHARED_SECRET` / `CF_ACCESS_TEAM_DOMAIN`.
- **Auth bypass** for `/api/config` and `/api/storage/status` so the SPA can boot under `shared-token` mode.
- **Node 20 baseline** (`.nvmrc` bumped from 16); npm-only (`packageManager: npm@10.9.2`); `yarn.lock` removed (Cloudflare Pages was auto-detecting yarn 4 from a stale lockfile).
- **`fossflow-app` prebuild** chains the lib build so Cloudflare Pages' `--workspace=packages/fossflow-app` invocation still resolves the workspace dependency.

### Removed

- `S3Provider` storage stub and `@aws-sdk/*` + `minio` dependencies (Phase 3C dropped).
- Legacy `storageService.ts` and dead `r2Adapter` shim.
- Phantom `Icon1` / `Icon2` fixture stubs from `packages/fossflow-lib/src/fixtures/icons.ts` (real catalog comes from `@isoflow/isopacks`).
- `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md` — fork doesn't accept code PRs.
- `FOSSFLOW_ENCYCLOPEDIA.md` — superseded by [docs/architecture.md](docs/architecture.md).
- `docs/SEMANTIC_RELEASE.md` — upstream's auto-release pipeline is no longer used.
- 9 localized README mirrors under `docs/README.*.md` — were upstream translations only.

### Fixed

- **2D mode: rectangle resize handles** align to the actual square corners (was hitting iso-diamond outer points via `BOTTOM/RIGHT/TOP/LEFT` `TileOrigin` offsets).
- **2D mode: `TransformAnchor`** renders as an upright rounded square (was rotated to iso diamond by the unconditional iso CSS matrix).
- **2D mode: `NonIsometricIcon`** renders flat at the tile center (was hardcoded to the iso projection wrapper, leaving AWS/GCP/Azure/K8s/MUI icons visually tilted in 2D).
- **Icon-pack auto-load on diagram import** — `loadPacksForDiagram` was a silent no-op because it tried `item.icon?.collection` on a string id; now reads `data.requiredPacks` with an items × icons fallback.
- **Session-mode autosave preserves `folderId`** — the autosave model from `handleModelUpdated` strips `folderId`, so `LocalStorageProvider.sessionSaveDiagram` now falls back to the existing meta's value instead of relocating the diagram to root on every autosave.
- **Inline rename commits empty string** — clearing the canvas label now propagates to the store and hides it (was silently discarded).
- **JSON export filename uses the diagram title** (slugified, with a short `YYYYMMDD-HHmm` suffix). `ImportDialog` reads the suggested name from `data.title` / `data.name` / `data.t` (compact format), falling back to the filename only when no embedded title exists. JSON round-trip now preserves the diagram name.
- **Share-link context-menu entry hidden in session mode** — was a guaranteed failure path because the backend share endpoint isn't reachable.
- **Storage ID collisions** — `LocalStorageProvider` now appends a random suffix to ids (was `${prefix}_${Date.now()}`). Same-millisecond mints during project import caused folders to receive their own id as `parentId`, which the recursive `buildTree` walked forever (`Maximum call stack size exceeded`).
- **`leanIfModel` dictionary lookup** — switched to object-dictionary lookups instead of `Set` so target=es5 transpilation under ts-jest doesn't silently drop members.

### Security

- **Path-traversal blocked** via ID regex `^[a-zA-Z0-9_-]{1,64}$`.
- **CSP + Helmet + 10 MB body limit.**
- **Auth modes** — `none` / `shared-token` (constant-time compare) / `cf-access` (full JWKS RS256 verify on Worker; rejected on Express).
- **Drive API scope locked down** to `drive.file` (deferred until the Drive provider lands).

### Tests

- New: `leanSave.test.ts` (round-trip strip + preservation contract for already-lean inputs); `services/project/__tests__/projectZip.test.ts` (round-trip, replace-all confirmation, malformed zip, unknown version); 3 regression tests for `requiredPacks` derivation/preservation; `LocalStorageProvider` cases for unique-id minting and session-save folderId preservation.

---

## [2026-04-27] — Phase refactor (0A → 2C)

Seven-commit structural expansion covering provider decomposition, a notification system, 2D canvas mode, the Material icon pack, a pluggable storage interface, a VS Code-style file explorer, and cross-diagram links. All 353 regression tests pass.

### Added

- **Phase 0A — App.tsx decomposition into providers.** `AppStorageContext` (storage init, `isServerStorage`, `isInitialized`) and `DiagramLifecycleProvider` (all diagram state, save/load/delete, keyboard shortcuts, `beforeunload` guard, icon-pack manager, dialog wiring) extracted. `App.tsx` slimmed from 744 → 103 lines (pure provider composition). `AppToolbar` drops every prop in favour of `useAppStorage` / `useDiagramLifecycle` hooks.
- **Phase 0B — Notification system.** `notificationStore` (Zustand, not persisted) with `push` / `dismiss` / `dismissAll` replaces every `alert()` call. `NotificationStack` (MUI Snackbar+Alert, max 3 visible, FIFO queue). `ConfirmDialog` — promise-returning dialog for destructive-action confirmation.
- **Phase 1A — 2D canvas mode.** `CoordinateTransformStrategy` pattern: ISO and Cartesian2D strategies each encapsulate `toScreen`, `fromScreen`, and `gridTileUrl`. `CanvasModeContext` provides the active strategy plus bound helper functions. `canvasMode` (`'ISOMETRIC' | '2D'`) added to persisted `uiStateStore` settings. New `grid-tile-2d.svg` square grid asset. `Grid.tsx`, `useIsoProjection`, `Node.tsx`, and `getMouse` are mode-aware. 2D / ISO toggle in ToolMenu; auto fit-to-view on switch.
- **Phase 1B — Material Icons pack.** `scripts/generateMaterialIconPack.js` (prebuild) generates a `material-icons-pack.json` with ~2,179 icons from `@mui/icons-material`. Registered as `'material'` alongside aws/gcp/azure/k8s. Large packs (>100 icons) render a 60-icon preview. `iconCategoriesState` preserved across pack reloads; newly loaded packs auto-expand. DiagnosticsOverlay moved into `BottomDock` `endSlot` via `bottomDockEnd` prop. Default zoom 85% → 75%. `preserveViewport` flag on `IsoflowRef.load()`.
- **Phase 2A — Pluggable storage interface (local provider).** `StorageManager` provider registry. `LocalStorageProvider`: server-backed when reachable, falls back to `sessionStorage`. Full folder CRUD + tree-manifest support. `GoogleDriveProvider` `NotImplementedError` stub. Backend folder CRUD, move, soft-delete patch, and tree-manifest endpoints.
- **Phase 2B + 2B-R — VS Code-style file explorer.** Collapsible 280 px left panel using `react-arborist`. Pushes the canvas rather than overlaying it. Full CRUD with `__pending__` node pattern, drag-and-drop with collision detection, duplicate, hard delete. Auto-sort folders → diagrams alphabetically. Dirty indicators on nodes and ancestor folders. `EmptyStateScreen` — full canvas replacement when server storage is available and no diagram is open. `checkUnsavedBeforeNavigate` guard for session-mode dirty state. Dialog standardization (elevation-8, `borderRadius: 2`, X close button).
- **Phase 2C — Diagram-to-diagram links + welcome popup on empty state.** A node can link to another diagram. In `EXPLORABLE_READONLY`, clicking opens the target in a new tab with a tooltip *"Opens 'X' in a new tab"*. Blue badge on the icon indicates the link. "Copy share link" item in the file-tree right-click menu. `LazyLoadingWelcomeNotification` uses `createPortal(document.body)` to escape the CSS transform stacking context.

### Removed

- Auto-draft creation, `DraftsSection`, `TrashSection`, `AppToolbar` "New diagram" button.
- All contextual tip overlays from `UiOverlay` (`ConnectorHintTooltip`, `ConnectorEmptySpaceTooltip`, `ConnectorRerouteTooltip`, `LassoHintTooltip`, `ImportHintTooltip`).

### Fixed

- Inline rename loses focus — MUI Menu `disableRestoreFocus` + 150 ms delay.
- Duplicate diagram 409 — copied data strips `id` before POST.
- First-load hint blink — `isInitialized` guard before canvas render.
- Connector drawing regression — `MAIN_MENU_OPTIONS` lifted to module-level constant so `setEditorMode` no longer resets tool mode on every context re-render.
- 2D mode cursor off by 3.5 tiles — root cause was the ISO formula running in 2D `getMouse`; fixed by threading `screenToTile` from `CanvasModeContext`.
- TDZ crash on init — keyboard-shortcut effect ordered after `handleSaveClick` / `handleOpenClick` declarations.

### Tests

- New: `coordinateTransforms.test.ts` (22 cases, 1 skipped); `notificationStore.test.ts` (10); `LocalStorageProvider` (9); generator-script (5).
- Updated: `saveTracking.isAfterLoad` rebased onto `DiagramLifecycleProvider`; `SizeIndicator.test` wrapped in `CanvasModeProvider`. SVG file mock added.

---

## [2026-04-10] — UX & Editor

### Added

- **New diagram** — Hamburger menu gains a "New diagram" item. Pending edits show a three-button guard dialog: *Save & continue* (autosaves to `localStorage`, falls back to JSON download), *Discard changes*, *Cancel*. Tab-close fires a native browser warning when edits are unsaved.
- **Connector — single-shot from Elements panel.** Connector card draws one connection then returns to the cursor tool. Toolbar Connector button keeps its persistent mode.
- **Import Icons dialog** — Isometric toggle moved from a persistent checkbox into a per-import confirm dialog (default: flat).

### Changed

- **Rectangle renamed from Group** — Double-click popover and Elements panel card now say "Rectangle". All 13 locale files updated. Internal mode types unchanged.
- **ToolMenu cleanup** — Rectangle and Text removed from the top toolbar (both accessible from the Elements panel).

### Fixed

- **Flat icon elevation** — Non-isometric icons were rendered ~41 px too high. `NonIsometricIcon` was applying a negative `top` offset before the iso matrix transform. Fixed by anchoring at `top: 0`.

---

## [2026-04-08] — Default zoom 85%

### Changed

- Default zoom reduced from 90% → 85% for slightly more breathing room on load.

---

## [2026-04-07] — Architecture refactoring

Six-phase structural cleanup — no feature changes, no library changes. 392 tests pass; zero production TypeScript errors. Architecture health score: **4.9 → 7.4 / 10**.

### Changed

- **`renderer.ts` split** (866 → ~210 lines): `utils/isoMath.ts` (coordinate math), `utils/hitDetection.ts` (spatial index), `utils/renderer.ts` (screen-space helpers + barrel re-exports).
- **`useScene.ts` split** (697 → 13 lines): `useSceneData.ts` (read selectors), `useSceneActions.ts` (write ops + transaction machinery), `useScene.ts` (combiner, external API unchanged).
- **Clipboard context:** `ClipboardProvider` replaces the module-level singleton — each `<Isoflow>` instance gets its own clipboard with no cross-instance bleed.
- **Settings persistence:** user preferences (`hotkeyProfile`, pan/zoom/label settings, connector mode) now survive page reload via `localStorage`.
- **Types:** `types/settings.ts` is the canonical home for all settings types; config files re-export from there.

### Security

- `window.__fossflow__` gated behind `enableDebugTools` prop.
- Unroutable connectors now show a dashed-red canvas indicator + `console.warn` instead of being silent ghost elements.

---

## [2026-04-06] — Internationalisation complete + ExportImageDialog fix

### Added

- **Full UI localisation** in both packages.
  - `fossflow-app` (react-i18next, `app` namespace): toolbar buttons (Save / Load / Diagrams / Share), Preview tooltip (3 states), Share popover, Save As dialog, Save-status label (`formatSavedAt()` with interpolation), Diagrams Manager (title, badges, "Last modified", empty state, share/delete tooltips, error messages).
  - `fossflow-lib` (localeStore, TS locale files): ToolMenu tooltips (`toolMenu` namespace, all 13 locales) and QuickIconSelector (`quickIconSelector` namespace) wired through `t()`. Lib's `t()` does not support object params — `.replace()` used for interpolation.
- **Language selector** shows the active language's display name (e.g. "中文 (简体)") instead of the generic "A/文" glyph.
- **All 11 non-English JSON files** updated with the new keys.

### Fixed

- **`zh-CN.ts viewTabs`** — `addPage`, `deletePage`, `renameDiagram` were English placeholders; corrected to Chinese.
- **ExportImageDialog blank preview on first open** — `exportImage()` was called after a fixed 100 ms timeout + double `requestAnimationFrame`, which fired before the hidden Isoflow had populated its model store. The hidden Isoflow now receives `onModelUpdated={handleHiddenIsoflowReady}`; on the first call, `isoflowReadySignal` is incremented and a dedicated effect fires a single `requestAnimationFrame` to export. A separate options-change effect is guarded by `isoflowLoadedRef.current`. Both call `exportImage` through a stable `exportImageRef`.

### Tests

- New: `exportImageDialog.initialLoad.test.ts` (8); `i18n.localeCompleteness.test.ts` (asserts every top-level namespace from `en-US.ts` is present in all 13 locale files); `toolMenu.i18n.test.ts` (11); `quickIconSelector.i18n.test.ts` (12).
- Test count: 683 → 729; 68 → 72 suites; all passing.

---

## [2026-03-31] — Performance (9 optimizations + paste async)

Nine targeted optimizations, all measured with the in-app DiagnosticsOverlay.

### Performance

- **History (Fix 5)** — `modelStore` and `sceneStore` history switched from full-snapshot arrays to Immer `produceWithPatches` patch pairs. Memory for a 50-entry undo stack drops from O(N × 50 × model_size) to O(50 × diff_size). Undo/redo apply/invert the stored diff.
- **Async A* pathfinding (Fix 6)** — Connector routing dequeued out of the paste transaction into `requestAnimationFrame` batches of 25. Eliminates the main-thread block that triggered Chrome's "page is unresponsive" dialog at ~1 000+ connectors. Progress toast for pastes ≥ 500 connectors.
- **Per-connector sceneStore subscription (Fix A)** — Each `<Connector>` subscribes only to its own path slice with reference equality. Async path writes re-render only the one connector that received its route.
- **A\* LRU cache (Fix B)** — Path results cached in a 2 000-entry `Map` keyed by `from,to,gridSize`.
- **`startTransition` on paste (Fix C)** — Wraps `scene.pasteItems` in React's `startTransition` so the resulting render is deprioritised.
- **WeakMap item index (Fix 1)** — `useModelItem` and `getItemAtTile` build a `Map<id, item>` once per unique array reference via a module-level `WeakMap` — O(1) lookup, GC'd automatically.
- **`findNearestUnoccupiedTile` rewrite (Fix 2)** — Builds a `Set<"x,y">` of occupied tiles once; eliminates the O(N) `getItemAtTile` call inside every ring step.
- **Zustand transaction batching (Fix 3)** — `scene.transaction()` buffers intermediate states in a `pendingStateRef`, flushes as two `setState` calls at the end instead of 2 × N writes.
- **Viewport culling (Fix 4)** — `Renderer.tsx` computes tile-space bounds via `storeApi.subscribe()` (no React re-renders on pan/zoom unless the visible tile range actually changes). Items and connectors outside the viewport are filtered before render.

**Outcome.** On an ~113-node / 441-connector paste, FPS stays at 60 (previously froze to 5). On ~280-node / 1 132-connector paste, routing completes in ~9 s in background with no freeze (previously a hard main-thread block).

### Tests

- Fixed 4 test failures introduced by the perf refactors: `renderer.test.ts` mock updated for `hitConnectors`; `useHistory.realStore.test.tsx` redo round-trip; `useScene.listShape.test.tsx` and `useScene.referenceStability.test.tsx` updated to reflect that DEFAULTS merging moved from the list into `<Connector>`.

---

## [2026-03-30] — Code quality & security

### Added

- **Static analysis pipeline** — ESLint (flat config, v10), Knip (dead code / unused exports), and `npm audit` configured at root. Reports output to `reports/`.
- **Code coverage infrastructure** — Jest with Istanbul (via `ts-jest`); thresholds at 10% global minimums; HTML report in `packages/fossflow-lib/coverage/`.

### Removed

- **14 dead files** identified by Knip: `EditorPage.tsx`, `minimalIcons.ts`, `usePersistedDiagram.ts`, `NodeControls.tsx`, `NodeSettings.tsx`, `Header.tsx`, `useWindowUtils.ts`, `RichTextEditor/index.ts`, `index-docker.tsx`, `service-worker.js`, and 4 stale docs-config files.
- Unused imports: `Slider`, `Typography`, `Divider`, `FormControlLabel`, `CoordsUtils`, `IconPackName`, `mergeDiagramData`, `extractSavableData`.

### Fixed

- **Conditional hooks bug (Connector.tsx)** — `useIsoProjection` and 7 `useMemo` calls were invoked after an early `if (!color) return null` guard — a Rules of Hooks violation. All hooks now called unconditionally.
- **Stale closure (useCopyPaste)** — `showNotification` was a plain function re-created each render, so `handleCopy` / `handleCut` / `handlePaste` closed over a stale reference. Wrapped in `useCallback([uiStateApi])`.
- **Locale type completeness** — `addNodeGroupAction` / `Shortcut` / `Description` added to `LocaleProps` and all 11 non-English locale files.
- **Operational `console.log`** stripped from `useInitialDataManager`.

### Security

- **CVE patches** — `npm audit fix` resolved a path-to-regexp ReDoS (high) and a yaml stack-overflow (moderate).
- **Quill XSS** (high) documented as accepted risk — fixing requires a breaking downgrade of `react-quill-new`.

---

## [2026-03-29] — Node panel 3-tab redesign + MUI toolbar

### Added

- **Node panel — Details / Style / Notes tabs** — Replaced single-scroll accordion with a clean tab layout. *Details*: Name, Caption (rich-text shown on canvas), optional link. *Style*: Icon picker (inline), icon size, label font/color/height. *Notes*: full-height rich-text editor (~14 lines).
- **Caption vs Notes** — Former "Description" renamed to **Caption** (canvas-visible). **Notes** is private documentation. Both HTML rich-text, stored separately on `ModelItem`.
- **`notes` field on nodes** — `ModelItem` carries an optional `notes` rich-text field (HTML, no max length); Zod-validated. Backwards-compatible.
- **Floating action bar** — When a node is selected in editable mode, a compact pill bar appears above the node with five icon buttons: Style, Edit name, Link, Notes, Delete. Tracks the node as it scrolls and zooms.
- **Note indicator dot** — 14 px blue dot at icon top-right when `notes` is non-empty.
- **Read-only node panel** — In `EXPLORABLE_READONLY`, single-scroll panel with header (icon + name + optional link button) and **Caption** / **Notes** sections only when non-empty. Nodes with neither are not clickable.
- **Save & Preview button** — Eye icon in toolbar (edit mode). Silently saves first if dirty, then opens `/display/{id}` in a new tab. Tooltip adapts.
- **Double-click to add node or rectangle** — Double-clicking empty canvas opens a compact "Add" popover at the cursor with a **Rectangle** button at the top and an icon picker below.
- **MUI toolbar** — `fossflow-app` toolbar fully rewritten with MUI components. Custom Bootstrap-era CSS removed.

### Changed

- **Theme density** — `spacing: 6`, `fontSize: 14`, `borderRadius: 6`, global `size: 'small'` defaults.
- **Toolbar button hierarchy** — Save is `variant="contained"`; Diagrams and Share are `variant="outlined"`.
- **Help dialog** — "Add Node / Group — Double-click (empty area)" entry added.

### Fixed

- **Single left-click on empty canvas now just deselects** — context menu removed entirely (timer-based disambiguation with double-click was unreliable).
- **Lasso tool reverted to pointer on first click** — `mousedown` with no existing selection is now a no-op; `mousemove` builds the selection box.
- **Sporadic canvas drag — ghost image bug** — Browser `dragstart` on SVG/`<img>` was hijacking `mousemove`. Fixed by `preventDefault()` on `dragstart` on the renderer container.
- **aria-hidden focus warnings** in `MainMenu` and `QuickAddNodePopover` — focus restored/blurred before modal hides.
- **Build error (TAB_READONLY_NOTES)** — stale constant from read-only tab removal.
- **Pan.ts model not destructured** — `mouseup` referenced `model.items` without destructuring.

### Tests

- New: `dragStart.prevention.test.ts`, `quickAdd.groupButton.test.ts` (10).
- Updated: `Cursor.modes.test.ts`, `Lasso.modes.test.ts`, `toolMenu.propagation.test.tsx`, `saveTracking.isAfterLoad.test.ts`.
- Test count: 572 → 585; 59 → 61 suites.

---

## [2026-03-27] — Toolbar UX overhaul + save tracking

### Added

- **Toolbar UX overhaul** — 3-section layout: actions left, spacer center, language right. Three focused buttons: **Save** (direct save if associated, Save As for new diagrams), **Diagrams** (opens server or session dialog automatically), **Share** (copies read-only URL; disabled when no server storage or no saved diagram).
- **Save status tracking** — Save button disabled when no unsaved changes and a file is associated. Auto-save removed entirely; only explicit Save updates the last-saved timestamp.
- **Save status label** — Toolbar shows `Saved at HH:MM` / `Saved yesterday at HH:MM` / `Saved Mon DD at HH:MM` / `Saved Mon DD, YYYY at HH:MM`. A `•` dot appends when unsaved changes exist.
- **Save confirmation toast** — Brief `✓ [Name] saved` notification slides up from bottom-center, auto-dismisses after 2.5 s.
- **Diagrams manager** — Merged Load + Storage Manager into a single "Diagrams" button. Per-row share button copies a read-only URL.
- **Dismissible session warning banner** — Amber banner below the toolbar when running in session-only storage. Dismissed per tab via `sessionStorage`.
- **Community edition splash screen** — Welcome notification with community edition branding, fork repo link, GitHub issues prompt.

### Changed

- **Diagram title rename from canvas disabled** — ViewTabs title card is read-only. Page (view tab) names remain renameable inline.

### Fixed

- **Duplicate diagram title removed** — Title was shown in toolbar center and in ViewTabs; toolbar center title removed.
- **Multi-view save tracking** — Changes to any view (including creating a new view, adding nodes to view 2+) now correctly enable Save. Root cause: `isoflowRef.current.load()` triggered `onModelUpdated` → `hasUnsavedChanges=true`, then auto-save reset it 5 s later. Fixed with `isAfterLoadRef` pattern + removing `setHasUnsavedChanges(false)` from auto-save.
- **Undo/redo icon colors** — Were inverted. Fixed to industry norm: enabled=`grey.700`, disabled=`grey.400`, active=`grey.200`.
- **Language dropdown off-screen** — Was anchored `left:0`; fixed to `right:0`.
- **Old-format icon migration** — Diagrams saved before the full-icon-set format was introduced are silently re-saved on first load.
- **aria-hidden focus warning** — MUI context menu was setting `aria-hidden` on its modal root while a descendant still held focus. Focus moved back to the anchor before menu close.
- **Verbose logging** stripped from `storageService` and `App` — only errors remain.

### Tests

- New: `IconButton.color.test.tsx`, `viewTabs.titleReadonly.test.ts`, `splashScreen.communityEdition.test.ts`, `languageDropdown.positioning.test.ts`, `saveTracking.isAfterLoad.test.ts`.
- Test count: 545 → 572; 54 → 59 suites.

---

## [2026-03-25] — Cut + lasso bug fixes

### Added

- **Cut (`Ctrl+X`)** — Cuts selection to clipboard and removes it from the canvas. Supports full undo/redo: `Ctrl+Z` restores the deleted items while the clipboard retains the payload.

### Fixed

- **Node header link** — Clicking a node URL opens it in a new tab; bare URLs (e.g. `www.google.com`) normalised to `https://`.
- **Rectangle z-order after paste** — Pasting a stack of rectangles preserves the original visual layering.
- **Stacked rectangle hit-testing** — Clicking at a tile covered by multiple rectangles selects the visually topmost one.
- **Save as creates a new file** — Saving under a different name creates a new file instead of overwriting.
- **Connector waypoints move with lasso drag** — Tile-based mid-connector anchors now move with the selection during lasso/freehand-lasso drags.
- **Lasso drag when clicking on a node within selection** — Clicking on a node element inside a lasso selection correctly starts a group drag instead of redrawing the lasso.

### Tests

- `useCopyPaste.test.ts` 11 → 18; `keyboard.dispatch.test.tsx` 25 → 28; `shortcuts.test.ts` 6 → 7; `renderer.test.ts` +4; `Lasso.modes.test.ts` +3.
- Test count: 537 → 545. **Note:** E2E tests not currently passing — addressed separately.

---

## [2026-03-24] — Performance + connector label styling

### Added

- **Connector label font size** — Per-label slider (8–24 px) with companion position slider.
- **Connector label color** — Per-label text color picker with palette presets and custom input.
- **TextBox rich text editing** — Same Quill-based editor as node descriptions. Max content length 1000.
- **TextBox auto-height** — Text boxes expand downward to fit content.
- **TextBox text color** — Picker with palette presets, custom, and reset.
- **Node label color** — Canvas labels have a text color picker in the settings panel.
- **DiagnosticsOverlay** — Collapsible performance overlay (bottom-right). Live FPS, JS heap, long task count, item counts. Downloadable JSON. Always-on in dev; off by default in prod with `localStorage` toggle.

### Changed

- **Consistent color picker UI** — All label/text color pickers match the connector line color section.

### Performance

- **`onModelUpdated` double-fire fix** — Shallow equality on the model selector in `Isoflow.tsx`. Without it, every user action fired `onModelUpdated` twice → 6.4 long tasks/sec at idle. After: ~0/sec idle, consistent 60 fps.
- **`iconPackManager` prop churn fix** — Memoized in `App.tsx`. The inline object literal was recreated each render, causing a Zustand store write feedback loop.

### Tests

- `connector.test.ts` +6; `views.test.ts` +2; `textBox.test.ts` +2.
- Test count: 517 → 527.

---

## [2026-03-22] — Right-click pan + default zoom 90%

### Added

- **Right-click pan** — Single right-click deselects and dismisses item controls; right-click drag pans; releasing restores the previous tool. Gated by the existing `rightClickPan` setting.

### Changed

- **Default zoom 90%** — Canvas loads at 90% zoom for better initial framing. *(Later changed to 85% on 2026-04-08.)*

### Fixed

- **Node description empty-state** — Clearing all text from a node description correctly collapses the canvas label.
- **Service worker stale-build loop** — Replaced the legacy CRA service worker with a self-unregistering cleanup SW. FossFLOW is not a PWA.
- **StrictMode double-load** — Initial data effect fires only once per genuine prop change, not on React 18 StrictMode's double-mount.
- **Storage dev bypass** — Failed JSON parse + 5-second timeout on every dev reload caused by an env variable that was not statically inlined.

### Performance

- **Subscription tightening** — Zustand equality functions on mouse-state selectors; reactive subscription removed from `usePanHandlers`.
- **Grid off Zustand** — `Grid.tsx` reads scroll position via `useRef` + resize observer instead of Zustand.

### Tests

- `usePanHandlers.test.ts` 13 → 20.

---

## [2026-03-20] — Copy/paste toasts + settings consolidation

### Added

- **Copy/paste toasts** — Snackbar notifications for copy, paste, and empty-clipboard paste.
- **Connector mode indicator** — Toolbar shows a "Click" / "Drag" chip next to the Connector button.

### Changed

- **Settings consolidation** — Pan, Zoom, and Labels merged into a single "Canvas" tab — settings reduced from 6 tabs to 4.

### Fixed

- **Pan settings toggles inverted** — All 4 mouse-button pan toggles displayed inverted state.
- **Right-click context menu removed** — Right-click is reserved for pan.
- **Toolbar click triggering canvas actions** — Toolbar clicks could propagate to the interaction manager.
- **"Add Node" menu appearing on mode transitions** — Switching from Pan → Select incorrectly triggered the empty-canvas context menu.
- **Copy/paste centroid bug** — Centroid calculation now includes rectangles and text boxes.
- **Orphaned connector anchors on paste** — Connectors pasted without their anchored items have orphaned references cleanly detached.
- **Fixed shortcuts deduplicated** — `Ctrl+C/V/Z/Y` strings are a single source of truth in `src/config/shortcuts.ts`.
- **Zustand deprecated API warning** — Replaced `useStore(store, selector, equalityFn)` with `useStoreWithEqualityFn`.
- **Quill "bullet" format warning** — Removed unregistered `'bullet'` alias from RichTextEditor formats.
- **i18n short-code locale 404** — Added `load: 'currentOnly'` to i18next config.
- **`createModelItem` double-write** — Removed redundant `updateModelItem` call.

### Tests

- New: `toolMenu.propagation`, `Lasso.modes`, `Cursor.modes`, `connector`, `shortcuts.test`, `settings.defaults`, `uiOverlay.editorModes`, `modelItem`, `RichTextEditor.formats`, `zustand.deprecation`, `i18n.config`, `usePanHandlers`, `useCopyPaste`, `useHistory.realStore`, `connector schema`, `renderer`.
- Test count: 402 → 507; 54 suites.

---

## [2026-03-19] — Quill XSS pin + SVG export trim

### Security

- Pinned `react-quill-new` to avoid the Quill XSS vulnerability (GHSA-v3m3-f69x-jf25). The affected method (`getSemanticHTML()`) is not used by FossFLOW.

### Performance

- **SVG Export Optimizer** — Exported SVG size reduced ~20% (~940 kB → ~750 kB) by stripping irrelevant CSS, rounding float coordinates, and pruning `display:none` subtrees.

### Removed

- Unused dependencies from `fossflow-lib` (`auto-bind`, `paper`, `dom-to-image`, `react-hook-form`, `react-router-dom`, `recharts`, `css-loader`, `style-loader`).
- Bundle size: 3,438 kB → 3,403 kB (−35 kB).

---

## [2026-03-18] — Initial fork features baseline

### Added

- **Node header links** — Set a URL on any node to make its name a clickable link.
- **Diagram management** — Imperative diagram loading, multi-view management, diagram/view renaming.
- **Interaction controls** — Right-click pan, delete key, lasso selection, context menu restore.
- **Help dialog** — Updated to reflect all new interaction controls.

### Performance

- **Render cycle elimination** — Pan/zoom no longer triggers component re-renders. `memo` added to scene layer components.
- **Hotspot fixes** — Dependency stability, resize observer, RAF throttle CPU hotspots addressed.
- **Render isolation** — N-1 through N-5, H-3, M-1 hotspots eliminated.

### Tests

- Performance-refactoring regression baseline: 381 tests across 42 suites covering render isolation, dependency stability, RAF throttle, resize observer, and more.
