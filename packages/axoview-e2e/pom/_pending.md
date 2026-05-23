# POM + data-axoview-id pending register

Per ADR 0008 Decision 5, `data-axoview-id` attributes are added the moment a
POM declares them AND a spec exercises that path. This file tracks the
declared-but-deferred work so Sessions 3–6 know what to author next.

Last updated: Session 4 (2026-05-22).

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

Lib rebuild cycles to date: 3 (one in Session 2 for the first lib-side
retrofit, one in Session 3 for `canvas-interactions`, one in Session 4
for the four icons-spec retrofits — `dock-elements-import-icons`,
`dialog-import-icons-confirm`, `dialog-delete-icon-confirm`, and
`canvas-icon-grid-delete` — all batched into one rebuild).

## POMs not yet authored

| POM | Owning session | Surfaces / methods needed | data-axoview-id retrofits required |
|---|---|---|---|
| ~~`EmptyStateScreenPOM`~~ | ~~3 (J20)~~ | ~~`clickCreate()`, `clickImport()`~~ | ~~`screen-empty-create` + `screen-empty-import`~~ — **✅ authored Session 3 (J20 smoke green) as `pom/EmptyStateScreenPOM.ts`; `screen-empty-import` landed alongside.** |
| ~~`DialogsPOM`~~ | ~~6 (dialogs / share)~~ | confirm + ADR 0011 error dialogs (`LocalModeShareErrorDialog`, `ReadonlyLoadErrorDialog`, `PublicShareLoadErrorDialog`) | **✅ initial body authored Session 4 (J10 + J11 + J12) as `pom/DialogsPOM.ts`** — covers `confirmExportProjectZip()`, `confirmImportIcons()`, `confirmDeleteIcon()`. Share / ADR-0011 error-dialog methods remain pending for Session 6 (attributes still to land: `dialog-confirm-{accept,reject}`, `dialog-local-mode-share-error`, `dialog-readonly-load-error`, `dialog-public-share-load-error`). |
| `LeftDockPOM` | 5 (layers / elements) | `openElementsPanel()`, `openLayersPanel()`, `closeWorkingPanel()` | `dock-elements-toggle` (✅ landed Session 2 — used inline in smoke spec), `dock-layers-toggle` (✅ landed Session 2 alongside, paired with Session-5 spec), `dock-elements-import-icons` (✅ landed Session 4 alongside icons spec — used inline by icons.spec.ts#importTestIcon helper; LeftDockPOM authoring still pending Session 5) |
| `CanvasPOM` | 5 | `placeIcon(x, y)`, `selectAt(x, y)`, `placeRectangle(x, y)`, `countNodes()`, `dragNode(from, to)`, `drawConnector(a, b)` | `canvas-root` (replace lib `data-testid="axoview-canvas"`), `canvas-icon-grid-item` (✅ landed Session 2), `canvas-interactions` (✅ landed Session 3 on Renderer's interactionsRef Box — needed so specs can dispatch synthetic MouseEvents directly at the rendererRef ID, since `isRendererInteraction` gates on `e.target === rendererRef.current`), `canvas-icon-grid-delete` (✅ landed Session 4 on Icon.tsx's × badge — used inline by icons.spec.ts), `canvas-tool-select`, `canvas-tool-connector`, `canvas-tool-lasso`, `canvas-tool-undo`, `canvas-tool-redo` |
| `FileExplorerPOM` | 5 (rename) + 4 (import/export) | `selectDiagram(name)`, `pressF2Rename(name)`, `contextMenu(name)`, `expectVisible(name)` | `panel-file-explorer-row`, `panel-file-explorer-rename-input` |
| `NodeInfoTabPOM` | 6 (multi-diagram) | `setLinkedDiagram(name)`, `clickOpenLinkedDiagram()`, `setNodeName(text)` | `panel-node-info-link-picker`, `panel-node-info-open-linked` |
| `LayersPanelPOM` | 5 (layers) | `addLayer(name)`, `toggleVisibility(name)`, `toggleLock(name)`, `assignSelection(name)` | `panel-layers-row`, `panel-layers-visibility`, `panel-layers-lock` |
| `SettingsDialogPOM` | 6 (dialogs) | `open()`, `selectTab(name)`, `close()` | `dialog-settings`, `dialog-settings-tab-{about,diagnostics}` |
| `HelpDialogPOM` | 6 (dialogs) | `open()`, `expectShortcutListed(label)`, `close()` | `dialog-help`, `dialog-help-shortcut-row` |

## AppToolbarPOM stubs (declared in Session 2, bodies pending)

| Method | Owning session | Attribute |
|---|---|---|
| ~~`clickExport()`~~ | ~~4~~ | ~~`toolbar-export`~~ — **✅ shipped Session 4 (commit `4014e59`)** |
| `clickShare()` | 6 | `toolbar-share` |
| `clickPreview()` | 6 | `toolbar-preview` |
| `getSaveButtonDisabledReason()` | 6 candidate | (reads the wrapping Tooltip's `title` prop — no new attribute) |

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
