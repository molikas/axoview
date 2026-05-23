# POM + data-axoview-id pending register

Per ADR 0008 Decision 5, `data-axoview-id` attributes are added the moment a
POM declares them AND a spec exercises that path. This file tracks the
declared-but-deferred work so Sessions 3–6 know what to author next.

Last updated: Session 6 (2026-05-23).

## data-axoview-id retrofit inventory (running total)

Each retrofit cites the session it landed in and the spec method that
motivated it. Source files all live under `packages/axoview-app/` or
`packages/axoview-lib/` — app-side retrofits hot-reload; lib-side
retrofits require a `npm run build:lib` + dev-server restart before the
spec can see them.

| # | Attribute | Source | Session | Motivating spec |
|---|---|---|---|---|
| 1 | `toolbar-save`                          | `axoview-app/.../AppToolbar.tsx`                            | 2 | J1 (smoke.spec) — AppToolbarPOM.clickSave |
| 2 | `screen-empty-create`                   | `axoview-app/.../EmptyStateScreen.tsx`                      | 2 | J1 + J20 (smoke.spec) — EmptyStateScreenPOM.clickCreate |
| 3 | `dock-elements-toggle`                  | `axoview-lib/.../LeftDock/LeftDock.tsx`                     | 2 | J1 (smoke.spec) — openElementsPanel helper |
| 4 | `dock-layers-toggle`                    | `axoview-lib/.../LeftDock/LeftDock.tsx`                     | 2 | Session 5 LayersPanelPOM (declared alongside dock-elements-toggle) |
| 5 | `canvas-icon-grid-item`                 | `axoview-lib/.../IconSelectionControls/Icon.tsx`            | 2 | J1 (smoke.spec) — placeIcon helper |
| 6 | `screen-empty-import`                   | `axoview-app/.../EmptyStateScreen.tsx`                      | 3 | J20 (smoke.spec) — EmptyStateScreenPOM.clickImport |
| 7 | `canvas-interactions`                   | `axoview-lib/.../Renderer/Renderer.tsx`                     | 3 | J2 (connector.spec) — synthetic MouseEvent dispatch at rendererRef |
| 8 | `toolbar-export`                        | `axoview-app/.../ExportPopover.tsx`                         | 4 | J8 (import-export-json.spec) — AppToolbarPOM.clickExport |
| 9 | `toolbar-export-json`                   | `axoview-app/.../ExportPopover.tsx`                         | 4 | J8 (import-export-json.spec) — AppToolbarPOM.clickExportJson |
| 10 | `toolbar-export-project-zip`           | `axoview-app/.../ExportPopover.tsx`                         | 4 | J10 (import-export-zip.spec) — AppToolbarPOM.clickExportProjectZip |
| 11 | `dialog-export-project-zip-confirm`    | `axoview-app/.../fileExplorer/ExportProjectZipDialog.tsx`   | 4 | J10 (import-export-zip.spec) — DialogsPOM.confirmExportProjectZip |
| 12 | `dock-elements-import-icons`           | `axoview-lib/.../LeftDock/ElementsPanel.tsx`                | 4 | J11 + J12 (icons.spec) — importTestIcon helper |
| 13 | `dialog-import-icons-confirm`          | `axoview-lib/.../LeftDock/ImportIconsDialog.tsx`            | 4 | J11 + J12 (icons.spec) — DialogsPOM.confirmImportIcons |
| 14 | `dialog-delete-icon-confirm`           | `axoview-lib/.../LeftDock/DeleteIconConfirmDialog.tsx`      | 4 | J12 (icons.spec) — DialogsPOM.confirmDeleteIcon |
| 15 | `canvas-icon-grid-delete`              | `axoview-lib/.../IconSelectionControls/Icon.tsx`            | 4 | J12 (icons.spec) — hover-revealed × badge click |
| 16 | `dock-file-explorer-toggle`            | `axoview-lib/.../LeftDock/LeftDock.tsx`                     | 5 | J4 (rename.spec) — FileExplorerPOM.open() |
| 17 | `file-explorer-row` + `data-diagram-name` + `data-diagram-type` | `axoview-app/.../fileExplorer/FileTreeNode.tsx` | 5 | J4 (rename.spec) — FileExplorerPOM.getRowByName |
| 18 | `file-explorer-rename-input`           | `axoview-app/.../fileExplorer/FileTreeNode.tsx`             | 5 | J4 (rename.spec) — FileExplorerPOM.renameDiagram |
| 19 | `layers-panel-add`                     | `axoview-lib/.../LayersPanel/LayersPanel.tsx`               | 5 | J6 (layers.spec) — LayersPanelPOM.addLayer |
| 20 | `layer-row` + `data-layer-name`        | `axoview-lib/.../LayersPanel/LayerRow.tsx`                  | 5 | J6 (layers.spec) — LayersPanelPOM.getLayerRow |
| 21 | `layer-toggle-visibility`              | `axoview-lib/.../LayersPanel/LayerRow.tsx`                  | 5 | J6 (layers.spec) — LayersPanelPOM.toggleVisibility |
| 22 | `layer-toggle-lock`                    | `axoview-lib/.../LayersPanel/LayerRow.tsx`                  | 5 | J6 (layers.spec) — LayersPanelPOM.toggleLock |
| 23 | `layer-item-row` + `data-layer-item-id` + `data-layer-item-type` | `axoview-lib/.../LayersPanel/LayerItemRow.tsx` | 5 | J6 (layers.spec) — LayersPanelPOM.getItemRow |
| 24 | `node-info-tab-link-picker` + `node-info-tab-link-picker-listbox` | `axoview-lib/.../ItemControls/NodeControls/NodeInfoTab/NodeInfoTab.tsx` | 6 | J5 (multi-diagram.spec) — NodeInfoTabPOM.openPicker |
| 25 | `node-info-tab-open-linked` | `axoview-lib/.../ItemControls/NodeControls/NodeInfoTab/NodeInfoTab.tsx` | 6 | J5 (multi-diagram.spec) — NodeInfoTabPOM.clickOpenLinkedDiagram |
| 26 | `toolbar-preview` | `axoview-app/.../AppToolbar.tsx` | 6 | J5 (multi-diagram.spec) — AppToolbarPOM.clickPreview |
| 27 | `toolbar-back-to-editing` | `axoview-app/.../AppToolbar.tsx` | 6 | J5 (multi-diagram.spec) — AppToolbarPOM.clickBackToEditing |
| 28 | `dock-settings` | `axoview-lib/.../LeftDock/LeftDock.tsx` | 6 | J16 (dialogs.spec) — SettingsDialogPOM.open |
| 29 | `dialog-settings` + `dialog-settings-close` + `dialog-settings-tab-<id>` | `axoview-lib/.../SettingsDialog/SettingsDialog.tsx` | 6 | J16 (dialogs.spec) — SettingsDialogPOM |
| 30 | `dock-help` | `axoview-lib/.../BottomDock/BottomDock.tsx` | 6 | J17 (dialogs.spec) — HelpDialogPOM.open |
| 31 | `dialog-help` + `dialog-help-close` | `axoview-lib/.../HelpDialog/HelpDialog.tsx` | 6 | J17 (dialogs.spec) — HelpDialogPOM |
| 32 | `diagnostics-toggle` | `axoview-app/.../DiagnosticsToggleButton.tsx` | 6 | J18 (dialogs.spec) |
| 33 | `diagnostics-overlay` + `diagnostics-overlay-close` | `axoview-app/.../DiagnosticsOverlay.tsx` | 6 | J18 (dialogs.spec) |
| 34 | `toolbar-share` + `share-popover` + `share-popover-close` + `share-url-input` + `share-copy-button` | `axoview-app/.../AppToolbar.tsx` | 6 | J14 (share.spec) — AppToolbarPOM share-* methods |
| 35 | `dialog-local-mode-share-error` + `dialog-local-mode-share-error-dismiss` | `axoview-app/.../LocalModeShareErrorDialog.tsx` | 6 | J13 (share.spec) — DialogsPOM.localModeShareError |
| 36 | `canvas-mode-toggle` | `axoview-lib/.../ToolMenu/ToolMenu.tsx` | 6 | J19 (canvas-modes.spec) — CanvasPOM.canvasModeToggleButton |

Lib rebuild cycles to date: 8 (Sessions 2 / 3 / 4 / 5J4 / 5J6 / 6J5 / 6dialogs / 6J19).
Session 5 used **two** rebuilds because the file-explorer-toggle landed in
the rename commit and the five layers-panel retrofits batched into the
layers commit. Within each commit the lib-side retrofits are batched.
Session 6 used **three** rebuilds — one per commit that touched lib source
(multi-diagram NodeInfoTab; dialogs Settings/Help/LeftDock/BottomDock;
canvas-modes ToolMenu via the new IconButton.dataAxoviewId pass-through).

## POMs not yet authored

| POM | Owning session | Surfaces / methods needed | data-axoview-id retrofits required |
|---|---|---|---|
| ~~`EmptyStateScreenPOM`~~ | ~~3 (J20)~~ | ~~`clickCreate()`, `clickImport()`~~ | ~~`screen-empty-create` + `screen-empty-import`~~ — **✅ authored Session 3 (J20 smoke green) as `pom/EmptyStateScreenPOM.ts`; `screen-empty-import` landed alongside.** |
| ~~`DialogsPOM`~~ | ~~6 (dialogs / share)~~ | confirm + ADR 0011 error dialogs (`LocalModeShareErrorDialog`, `ReadonlyLoadErrorDialog`, `PublicShareLoadErrorDialog`) | **✅ Session 4 body + Session 6 extensions** — Session 4 added `confirmExportProjectZip()`, `confirmImportIcons()`, `confirmDeleteIcon()`. Session 6 added `localModeShareError()` + `dismissLocalModeShareError()` (J13 / share.spec). The remaining ADR-0011 error dialogs (`ReadonlyLoadErrorDialog`, `PublicShareLoadErrorDialog`) are not driven by any T1 spec yet; defer per ADR 0008 D5. |
| `LeftDockPOM` | 5 (layers / elements) | `openElementsPanel()`, `openLayersPanel()`, `closeWorkingPanel()` | `dock-elements-toggle` (✅ landed Session 2 — used inline in smoke spec), `dock-layers-toggle` (✅ landed Session 2 alongside, paired with Session-5 spec), `dock-elements-import-icons` (✅ landed Session 4 alongside icons spec — used inline by icons.spec.ts#importTestIcon helper; LeftDockPOM authoring still pending Session 5) |
| ~~`CanvasPOM`~~ | ~~5~~ | ~~`placeIcon(x, y)`, `selectAt(x, y)`, `placeRectangle(x, y)`, `countNodes()`, `dragNode(from, to)`, `drawConnector(a, b)`~~ | **✅ initial body authored Session 5 (J3) as `pom/CanvasPOM.ts`** — covers `interactionsLayer()`, `dispatchAt(events, point)`, `clickAt(point)`, `dragFromTo(from, to)`, `switchToRectangleMode()`, `pressTextBoxHotkey()`, `placeTextBoxAt(point)`. Pending for future sessions: `placeIcon` (helper currently inlined in smoke/connector/hotkeys/icons specs — extracts cleanly once a button-driven spec needs the elements-panel mode buttons), `dragNode`/`drawConnector` (Session 6 candidates), `canvas-tool-*` button retrofits + `canvas-root` rename of `data-testid="axoview-canvas"`. |
| ~~`FileExplorerPOM`~~ | ~~5 (rename) + 4 (import/export)~~ | ~~`selectDiagram(name)`, `pressF2Rename(name)`, `contextMenu(name)`, `expectVisible(name)`~~ | **✅ initial body authored Session 5 (J4) as `pom/FileExplorerPOM.ts`** — covers `toggleButton()`, `panelRoot()`, `getRowByName(name, type)`, `renameInput()`, `open()`, `selectRow(name, type)`, `pressF2()`, `renameDiagram(oldName, newName)`. Pending for future sessions: `contextMenu(name)` (Session 6 candidate alongside the share-link / export-image flows from the row context menu — `panel-file-explorer-context-menu*` attributes deferred). |
| ~~`NodeInfoTabPOM`~~ | ~~6 (multi-diagram)~~ | ~~`setLinkedDiagram(name)`, `clickOpenLinkedDiagram()`, `setNodeName(text)`~~ | **✅ authored Session 6 (J5) as `pom/NodeInfoTabPOM.ts`** — covers `linkPickerInput()`, `linkPickerListbox()`, `openLinkedDiagramButton()`, `expectVisible()`, `openPicker()`, `getOptionNames()`, `selectLinkedDiagram(name)`, `clickOpenLinkedDiagram()`. `setNodeName(text)` deferred (no J5 sub-test needs it; lazy retrofit on the name TextField waits for a consuming spec). |
| ~~`LayersPanelPOM`~~ | ~~5 (layers)~~ | ~~`addLayer(name)`, `toggleVisibility(name)`, `toggleLock(name)`, `assignSelection(name)`~~ | **✅ initial body authored Session 5 (J6) as `pom/LayersPanelPOM.ts`** — covers `toggleButton()`, `addLayerButton()`, `getLayerRow(name)`, `getItemRow(id)`, `renameInput()`-free flow, `open()`, `addLayer()`, `dragItemToLayer(itemId, layerName)`, `toggleVisibility(name)`, `toggleLock(name)`. Pending: layer drag-reorder coverage, item-rename / item-label-toggle via the panel's hover-revealed surfaces (Session 6+ candidates). |
| ~~`SettingsDialogPOM`~~ | ~~6 (dialogs)~~ | ~~`open()`, `selectTab(name)`, `close()`~~ | **✅ authored Session 6 (J16) as `pom/SettingsDialogPOM.ts`** — covers `triggerButton()`, `root()`, `closeButton()`, `tab(id)`, `open()`, `closeViaButton()`, `closeViaEscape()`. Tab list shape (no Diagnostics post-B-5) verified by J16. |
| ~~`HelpDialogPOM`~~ | ~~6 (dialogs)~~ | ~~`open()`, `expectShortcutListed(label)`, `close()`~~ | **✅ authored Session 6 (J17) as `pom/HelpDialogPOM.ts`** — covers `triggerButton()`, `root()`, `closeButton()`, `open()`, `openViaF1()`, `shortcutRowByAction(action)`, `closeViaButton()`, `closeViaEscape()`. |

## AppToolbarPOM stubs (declared in Session 2, bodies pending)

| Method | Owning session | Attribute |
|---|---|---|
| ~~`clickExport()`~~ | ~~4~~ | ~~`toolbar-export`~~ — **✅ shipped Session 4 (commit `4014e59`)** |
| ~~`clickShare()`~~ | ~~6~~ | ~~`toolbar-share`~~ — **✅ shipped Session 6 (share.spec) as `openShareDialog()` + ancillary methods (`closeShareDialog()`, `getShareUrl()`, `copyShareUrl()`).** |
| ~~`clickPreview()`~~ | ~~6~~ | ~~`toolbar-preview`~~ — **✅ shipped Session 6 (multi-diagram.spec). Companion `clickBackToEditing()` (`toolbar-back-to-editing`) also shipped.** |
| `getSaveButtonDisabledReason()` | future | (reads the wrapping Tooltip's `title` prop — no new attribute) — deferred; no T1 spec asserts the disabled-state copy. |

## Cross-cutting transitional uses of `data-testid` (axoview-lib only)

These exist for the lib's Jest unit tests and are queried by the new E2E
suite via `byLibTestId` until the consuming POM (above) is authored:

- `[data-testid="axoview-canvas"]` — Renderer canvas (CanvasPOM Session 5 closes; will become `canvas-root`).
- `[data-testid="connector-path"]`, `[data-testid="node-label"]`, `[data-testid="node-header-link"]`, `[data-testid="lasso-selection"]`, `[data-testid="item-controls-panel"]`, `[data-testid="context-menu"]`, `[data-testid="export-svg-button"]`, `[data-testid="node-info-tab-open-linked-diagram"]`, `[data-testid="node-panel-*"]` — sub-canvas / panel affordances; each gets a POM-owned `data-axoview-id` in the session that introduces the consuming spec.

Note: the previously-assumed `[data-testid="icon-grid-item"]` attribute did not
exist in lib code as of Session 2. The lazy retrofit `canvas-icon-grid-item`
went directly onto `IconSelectionControls/Icon.tsx`, skipping the data-testid
intermediate.

When a POM declares a new attribute, this register loses the corresponding
row. When the register is empty, ADR 0008 D5's E2E coverage gate is met.
