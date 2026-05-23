# POM + data-axoview-id pending register

Per ADR 0008 Decision 5, `data-axoview-id` attributes are added the moment a
POM declares them AND a spec exercises that path. This file tracks the
declared-but-deferred work so Sessions 3–6 know what to author next.

Last updated: Session 3 (2026-05-22).

## POMs not yet authored

| POM | Owning session | Surfaces / methods needed | data-axoview-id retrofits required |
|---|---|---|---|
| ~~`EmptyStateScreenPOM`~~ | ~~3 (J20)~~ | ~~`clickCreate()`, `clickImport()`~~ | ~~`screen-empty-create` + `screen-empty-import`~~ — **✅ authored Session 3 (J20 smoke green) as `pom/EmptyStateScreenPOM.ts`; `screen-empty-import` landed alongside.** |
| `LeftDockPOM` | 5 (layers / elements) | `openElementsPanel()`, `openLayersPanel()`, `closeWorkingPanel()` | `dock-elements-toggle` (✅ landed Session 2 — used inline in smoke spec), `dock-layers-toggle` (✅ landed Session 2 alongside, paired with Session-5 spec) |
| `CanvasPOM` | 5 | `placeIcon(x, y)`, `selectAt(x, y)`, `placeRectangle(x, y)`, `countNodes()`, `dragNode(from, to)`, `drawConnector(a, b)` | `canvas-root` (replace lib `data-testid="axoview-canvas"`), `canvas-icon-grid-item` (✅ landed Session 2), `canvas-tool-select`, `canvas-tool-connector`, `canvas-tool-lasso`, `canvas-tool-undo`, `canvas-tool-redo` |
| `FileExplorerPOM` | 5 (rename) + 4 (import/export) | `selectDiagram(name)`, `pressF2Rename(name)`, `contextMenu(name)`, `expectVisible(name)` | `panel-file-explorer-row`, `panel-file-explorer-rename-input` |
| `NodeInfoTabPOM` | 6 (multi-diagram) | `setLinkedDiagram(name)`, `clickOpenLinkedDiagram()`, `setNodeName(text)` | `panel-node-info-link-picker`, `panel-node-info-open-linked` |
| `LayersPanelPOM` | 5 (layers) | `addLayer(name)`, `toggleVisibility(name)`, `toggleLock(name)`, `assignSelection(name)` | `panel-layers-row`, `panel-layers-visibility`, `panel-layers-lock` |
| `SettingsDialogPOM` | 6 (dialogs) | `open()`, `selectTab(name)`, `close()` | `dialog-settings`, `dialog-settings-tab-{about,diagnostics}` |
| `HelpDialogPOM` | 6 (dialogs) | `open()`, `expectShortcutListed(label)`, `close()` | `dialog-help`, `dialog-help-shortcut-row` |
| `DialogsPOM` | 6 (dialogs / share) | confirm + ADR 0011 error dialogs (`LocalModeShareErrorDialog`, `ReadonlyLoadErrorDialog`, `PublicShareLoadErrorDialog`) | `dialog-confirm-{accept,reject}`, `dialog-local-mode-share-error`, `dialog-readonly-load-error`, `dialog-public-share-load-error` |

## AppToolbarPOM stubs (declared in Session 2, bodies pending)

| Method | Owning session | Attribute |
|---|---|---|
| `clickExport()` | 4 | `toolbar-export` |
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
