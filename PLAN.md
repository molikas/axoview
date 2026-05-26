# Axoview — Implementation Plan
> **Living document.** Point Claude to this file at the start of any session: "read PLAN.md and implement the next incomplete phase."
> Last updated: 2026-04-29

---

## How to Use This Document

### Starting a new session
Tell Claude: *"Read PLAN.md and [implement Phase X / continue the current phase]"*

Claude should then:
1. Read this file fully
2. Run the **Session Startup Checklist** for the target phase
3. Use `TodoWrite` to track sub-tasks for that session
4. Mark checkboxes `[x]` in this file as tasks complete
5. Update the **Phase Status** table before ending the session

### Conventions
- `[ ]` = not started
- `[~]` = in progress
- `[x]` = complete
- `[!]` = blocked — see note
- ⚠️ **TOKEN-HEAVY** = read the guardrail before starting
- 🚫 **OUT OF SCOPE** = E2E tests — deferred to post-UX phase (see bottom)

---

## Phase Status Dashboard

| Phase | Name | Status | Token Load | Notes |
|---|---|---|---|---|
| **0A** | App.tsx Decomposition | `[x]` | ⚠️ Very High | Prerequisite for all phases |
| **0B** | Notification System (E7) | `[x]` | Medium | Prerequisite for all phases |
| **1A** | 2D Canvas Mode (E1) | `[x]` | Medium | Self-contained |
| **1B** | Material Icons (E2) | `[x]` | Low | Self-contained |
| **2A** | Storage Interface Refactor (E4-local) | `[x]` | High | Depends on 0A |
| **2B** | File Explorer UI (E3) | `[x]` | ⚠️ Very High | Depends on 2A |
| **2B-R** | File Explorer UX Revision | `[x]` | High | Revises 2B — do before 2C |
| **2C** | Diagram-to-Diagram Links | `[x]` | Low | Depends on 2A, 2B-R |
| **2D** | Toolbar & Dock Layout Revamp | `[x]` | Medium | Depends on 2B-R |
| **3A** | Google Auth — authStore (E5) | `[ ]` | Medium | Depends on 0B |
| **3B** | Google Drive Provider (E4) | `[ ]` | High | Depends on 3A |
| **3C** | ~~S3 Provider + Backend (E4)~~ | 🚫 DROPPED (2026-04-29) | — | S3 support dropped — see Phase 3C section |
| **4A** | External Diagram Registry (E6) | `[ ]` | Low | Depends on 3A |
| **5***  | Cloudflare + Docker dual-target deploy | `[x]` | High | See [docs/deployment.md](docs/deployment.md) |
| **POST** | E2E Test Suite | 🚫 OUT OF SCOPE | — | Pick up after full UX ships |

---

## Codebase Snapshot (read-only reference — do not modify this section)

### Monorepo structure
```
c:\myTemp\Axoview\
├── packages/
│   ├── axoview-lib/          # Core React library (published as "axoview")
│   │   └── src/
│   │       ├── Axoview.tsx            # Main library export (forwardRef, ~200 lines)
│   │       ├── stores/
│   │       │   ├── modelStore.tsx     # Diagram data + undo/redo (Immer patches)
│   │       │   ├── sceneStore.tsx     # Computed scene data
│   │       │   ├── uiStateStore.tsx   # UI mode, zoom, scroll, dialogs, settings
│   │       │   └── localeStore.tsx    # i18n
│   │       ├── components/
│   │       │   ├── Renderer/          # Main canvas SVG renderer
│   │       │   ├── SceneLayers/       # Nodes, Connectors, TextBoxes, Rectangles
│   │       │   ├── Grid/              # Isometric grid background (SVG tile)
│   │       │   ├── LeftDock/          # Elements + Layers tabs (library-owned)
│   │       │   ├── RightSidebar/      # Item property controls
│   │       │   ├── ToolMenu/          # Floating toolbar (select/pan/lasso + undo/redo)
│   │       │   ├── MainMenu/          # File/Edit/View menus (portal-injected)
│   │       │   └── ContextMenu/       # Right-click menu
│   │       ├── types/
│   │       │   ├── model.ts           # Model, Icon, Connector, Item types
│   │       │   ├── axoviewProps.ts    # Library component props
│   │       │   └── ui.ts              # UI state types
│   │       └── config.ts              # Constants (tile size, zoom limits, etc.)
│   │
│   ├── axoview-app/          # Web application consuming the library
│   │   └── src/
│   │       ├── App.tsx                # ⚠️ 745 lines — decompose in Phase 0A
│   │       ├── index.tsx              # Entry: ErrorBoundary > I18n > App
│   │       ├── components/
│   │       │   ├── AppToolbar.tsx     # Top bar: name, save, open, export, share
│   │       │   ├── DiagramManager.tsx # Server diagram list modal
│   │       │   ├── SaveDialog.tsx     # Save prompt
│   │       │   ├── LoadDialog.tsx     # Load diagram picker
│   │       │   ├── ExportDialog.tsx   # Export options
│   │       │   └── ErrorBoundary.tsx  # Crash fallback UI
│   │       └── services/
│   │           ├── storage/             # StorageManager + provider registry (replaces legacy storageService.ts, deleted 2026-04-29)
│   │           └── iconPackManager.ts # Lazy icon pack loader
│   │
│   ├── axoview-backend/      # Express server
│   │   └── server.js          # /api/diagrams/*, /api/storage/status
│   │
│   └── axoview-e2e/          # Playwright tests (OUT OF SCOPE this phase)
│       └── tests/             # smoke, connector, node, pan, undo-redo, visual
│
├── new_features.md            # Original feature spec
├── PLAN.md                    # This file
└── package.json               # Monorepo root (Yarn workspaces)
```

### Key existing patterns (Claude must follow these)
- **State**: Zustand stores. Add new stores in `axoview-app/src/stores/` (app-level) or `axoview-lib/src/stores/` (library-level). Never add app-level state to lib stores.
- **UI**: MUI v7. Use MUI components exclusively — no raw HTML divs for layout.
- **Error handling**: After Phase 0B, always use `notificationStore.push()` — never `alert()` or custom toasts.
- **Icons**: Only modify `axoview-app/src/services/iconPackManager.ts` to register new packs.
- **Storage**: Only interact with storage via `StorageManager` — never import `ServerStorage` or `SessionStorage` directly in components.
- **Async**: All async storage calls need try/catch. Re-throw to caller. Caller shows notification.
- **Testing (unit)**: Jest + ts-jest + jsdom. Place tests in `__tests__/` adjacent to the file under test.
- **E2E**: 🚫 Out of scope this phase.

### Critical config values
- Tile size (iso): width multiplier 1.415, height multiplier 0.819
- Tile size (unprojected): 100×100
- Zoom range: MIN_ZOOM (0.1) to MAX_ZOOM (1.0)
- Storage server check timeout: 5s availability, 10s load, 15s save
- History limit: 50 entries (Immer patches)
- localStorage key prefix: `axoview-`

---

## Phase 0A — App.tsx Decomposition
**Status:** `[x]` | **Token load:** ⚠️ Very High | **Prerequisite for:** All phases

### Why this must go first
`App.tsx` is 745 lines handling: diagram lifecycle, storage initialization, dialog state, keyboard shortcuts, URL routing, unsaved-changes guard, and icon pack management. Every subsequent phase adds code here. Decompose first or every feature becomes a coupling hazard.

### Token guardrail
> ⚠️ **Do not attempt this in one pass.**
> Session 1: Read App.tsx fully. Extract only `DiagramLifecycleProvider`.
> Session 2: Extract `AppStorageContext`. Verify nothing is broken.
> Session 3: Extract `FileExplorerLayout` shell (empty — wired up in Phase 2B).
> Run `yarn build` after each extraction before proceeding.

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-app/src/App.tsx                (full)
  packages/axoview-app/src/index.tsx              (full)
  packages/axoview-app/src/services/storageService.ts  (full)
  packages/axoview-app/src/components/AppToolbar.tsx   (full)
```

### Target file structure after this phase
```
packages/axoview-app/src/
├── App.tsx                          # Slim shell: ~100 lines, composes providers
├── providers/
│   ├── DiagramLifecycleProvider.tsx # save/load/delete/create + unsaved-changes guard
│   └── AppStorageContext.tsx        # storage init, isServerStorage, isInitialized
├── layout/
│   └── FileExplorerLayout.tsx       # Shell for left panel (empty for now, wired in 2B)
└── components/
    └── AppToolbar.tsx               # Unchanged, but now reads from context not App state
```

### Sub-tasks
- [x] Read App.tsx fully and identify all state variables + their owners
- [x] Create `providers/AppStorageContext.tsx` — extract storage init logic
- [x] Create `providers/DiagramLifecycleProvider.tsx` — extract: currentDiagram, hasUnsavedChanges, handleSave, handleLoad, handleDelete, handleNew, beforeUnload guard
- [x] Create `layout/FileExplorerLayout.tsx` — empty shell with a left-panel placeholder div
- [x] Rewrite `App.tsx` to compose the above providers
- [x] Update `AppToolbar.tsx` to consume `DiagramLifecycleProvider` context instead of prop-drilling
- [x] Verify `yarn build` passes in `axoview-app`
- [x] Verify `yarn build` passes in root

### Done criteria
- [x] App.tsx is ≤ 150 lines (103 lines)
- [x] No logic in App.tsx — only provider composition and route rendering
- [x] All existing functionality works identically (manual smoke: save, load, export, share, read-only URL)
- [x] `yarn build` clean

---

## Phase 0B — Notification System (E7)
**Status:** `[x]` | **Token load:** Medium | **Prerequisite for:** All phases that show user feedback

### Why this must go before features
Current code has ~6 `alert()` calls and a custom inline toast. Every new feature (save failure, auth expiry, Drive errors) needs notifications. Build once, use everywhere.

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-app/src/App.tsx                          (relevant sections: alert() calls)
  packages/axoview-app/src/components/AppToolbar.tsx        (current save toast implementation)
  packages/axoview-app/src/components/DiagramManager.tsx    (current error display)
```

### Target file structure
```
packages/axoview-app/src/
├── stores/
│   └── notificationStore.ts         # New Zustand store
└── components/
    └── NotificationStack.tsx        # MUI Snackbar stack (max 3 visible)
```

### TypeScript interface (implement exactly)
```typescript
// stores/notificationStore.ts
type NotificationSeverity = 'success' | 'error' | 'warning' | 'info'

interface NotificationAction {
  label: string
  onClick: () => void
}

interface Notification {
  id: string                    // crypto.randomUUID()
  severity: NotificationSeverity
  message: string
  action?: NotificationAction   // e.g., "Try again", "Sign in"
  autoDismiss?: number          // ms. Omit = sticky (warning/error are sticky by default)
  persistent?: boolean          // survives route changes (e.g., session-expired banner)
}

// Auto-dismiss defaults:
// success → 3000ms
// info    → 4000ms
// warning → sticky
// error   → sticky
// Max visible: 3. Additional notifications queue and appear as older ones dismiss.

interface NotificationStore {
  queue: Notification[]
  push(n: Omit<Notification, 'id'>): void
  dismiss(id: string): void
  dismissAll(): void
}
```

### Sub-tasks
- [x] Create `stores/notificationStore.ts` with Zustand (not persisted)
- [x] Create `components/NotificationStack.tsx` using MUI `Snackbar` + `Alert` (max 3 visible, queue)
- [x] Mount `NotificationStack` in `App.tsx` at root level
- [x] Replace all `alert()` calls in App.tsx / AppToolbar.tsx with `notificationStore.push()`
- [x] Replace existing inline `saveToast` in AppToolbar with `notificationStore.push({ severity: 'success', ... })`
- [x] Replace existing MUI `Alert` session-storage warning with `notificationStore.push({ severity: 'warning', persistent: true, ... })`
- [x] Write unit tests: `stores/__tests__/notificationStore.test.ts`

### Unit tests (must write — not E2E)
```
notificationStore.test.ts:
  ✓ push() adds notification with generated id
  ✓ success notification has autoDismiss = 3000
  ✓ error notification has no autoDismiss (sticky)
  ✓ dismiss() removes by id
  ✓ max 3 visible: 4th notification is in queue, not visible
  ✓ queue drains: after dismiss, next queued item becomes visible
```

### Done criteria
- [x] Zero `alert()` or `window.confirm()` calls remain in axoview-app (except browser beforeunload which can't be replaced)
- [x] All save/load error feedback uses `notificationStore`
- [x] Unit tests pass (10/10)
- [x] `yarn build` clean

---

## Phase 1A — 2D Canvas Mode (E1)
**Status:** `[x]` | **Token load:** Medium | **Depends on:** 0A, 0B

### Behavior
User toggles between isometric view (current) and standard 2D cartesian grid. Toggle lives in the floating `ToolMenu`. State persisted to localStorage. Export works in both modes.

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-lib/src/components/Grid/Grid.tsx        (full)
  packages/axoview-lib/src/stores/uiStateStore.tsx         (full — note persisted settings)
  packages/axoview-lib/src/components/ToolMenu/ToolMenu.tsx (full)
  packages/axoview-lib/src/config.ts                       (tile size constants)
  packages/axoview-lib/src/utils/isoMath.ts                (or wherever isoToScreen/screenToIso live)
```

### Key insight (do not miss this)
Node positions are stored as abstract tile coordinates `(tileX, tileY)`. Only the *projection* changes. No data migration needed. The fix is entirely in the transform functions and grid tile SVG.

### Target file structure (changes only)
```
packages/axoview-lib/src/
├── utils/
│   └── coordinateTransforms.ts      # NEW: strategy pattern for ISO vs 2D
├── contexts/
│   └── CanvasModeContext.tsx         # NEW: provides active transform strategy
├── components/
│   ├── Grid/Grid.tsx                 # MODIFY: switch tile background by mode
│   └── ToolMenu/ToolMenu.tsx         # MODIFY: add 2D/ISO toggle button
└── stores/
    └── uiStateStore.tsx              # MODIFY: add canvasMode to persisted settings
```

### TypeScript interface (implement exactly)
```typescript
// utils/coordinateTransforms.ts
export interface CoordinateTransformStrategy {
  toScreen(tileX: number, tileY: number, tileSize: number, zoom: number): { x: number; y: number }
  fromScreen(screenX: number, screenY: number, tileSize: number, zoom: number): { tileX: number; tileY: number }
  gridTileUrl: string   // path to the SVG tile asset
  projectionName: 'ISOMETRIC' | '2D'
}

export const isometricStrategy: CoordinateTransformStrategy = { ... }
export const cartesian2DStrategy: CoordinateTransformStrategy = { ... }

// uiStateStore.tsx additions
canvasMode: 'ISOMETRIC' | '2D'   // add to persisted settings
setCanvasMode(mode: 'ISOMETRIC' | '2D'): void
```

### Sub-tasks
- [x] Add `canvasMode: 'ISOMETRIC' | '2D'` to `uiStateStore` persisted settings (default: `'ISOMETRIC'`)
- [x] Create `utils/coordinateTransforms.ts` with both strategies
- [x] Create `contexts/CanvasModeContext.tsx` — provides active strategy based on `canvasMode`
- [x] Wrap renderer root in `CanvasModeContext.Provider` (in `Axoview.tsx` or `Renderer.tsx`)
- [x] Update all `isoToScreen` / `screenToIso` call sites to read from context
- [x] Update `Grid.tsx` to switch SVG tile background when mode changes
- [x] Create `assets/grid-tile-2d.svg` (standard square grid tile, matching existing tile dimensions)
- [x] Add 2D/ISO toggle icon button to `ToolMenu.tsx`
- [x] Verify connector routing (`pathfinding` library tile dimensions) is mode-aware
- [x] Verify `dom-to-image-more` export works in both modes
- [x] Write unit tests: `utils/__tests__/coordinateTransforms.test.ts`

### Unit tests (must write — not E2E)
```
coordinateTransforms.test.ts:
  ✓ isometricStrategy.toScreen: known tile → expected pixel position
  ✓ isometricStrategy.fromScreen: known pixel → expected tile
  ✓ cartesian2DStrategy.toScreen: known tile → expected pixel (90° cartesian)
  ✓ cartesian2DStrategy.fromScreen: known pixel → expected tile
  ✓ round-trip: toScreen → fromScreen returns original tile coords (both modes)
```

### Done criteria
- [x] Toggle button in ToolMenu switches grid rendering visually
- [x] Node/connector positions are consistent after mode switch (same diagram, different view)
- [x] `canvasMode` persists across page reload
- [x] Export produces valid image in both modes
- [x] Unit tests pass
- [x] `yarn build` clean

---

## Phase 1B — Material Design Icons (E2)
**Status:** `[x]` | **Token load:** Low | **Depends on:** Nothing (standalone)

### Behavior
A "Material Icons" category appears in the left dock `ElementsPanel`. Icons are searchable, browsable, and draggable to the canvas identically to AWS/GCP packs.

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-app/src/services/iconPackManager.ts    (full)
  packages/axoview-lib/src/components/LeftDock/           (understand ElementsPanel structure)
  packages/axoview-lib/src/types/model.ts                 (Icon type definition)
  node_modules/@mui/icons-material/index.js                (first 50 lines — understand export shape)
```

### Key decision
MUI icons ship as React components. The canvas needs SVG path data. **Build a static JSON pack at build time** via a prebuild script — not runtime dynamic imports. The JSON format must match the `@isoflow/isopacks` structure that the icon manager already understands.

### Target file structure
```
packages/axoview-app/
├── scripts/
│   └── generateMaterialIconPack.ts  # NEW: runs at prebuild
└── src/
    └── assets/
        └── material-icons-pack.json # GENERATED: ~2000 icons, gitignored
```

```
packages/axoview-app/package.json:
  "prebuild": "ts-node scripts/generateMaterialIconPack.ts"
```

### Sub-tasks
- [x] Inspect `@mui/icons-material` export shape to understand SVG path extraction approach
- [x] Write `scripts/generateMaterialIconPack.js` — outputs `material-icons-pack.json` in isopack format (plain JS, ts-node unavailable)
- [x] Add `material-icons-pack.json` to `.gitignore` (generated artifact)
- [x] Register Material pack in `iconPackManager.ts` as a toggleable pack (same as aws/gcp/azure/k8s)
- [x] Verify icons appear in `ElementsPanel` under "Material" category
- [x] Verify icons are draggable to canvas
- [x] `collection` is already an optional string in iconSchema — no type change needed
- [x] Write unit test: `scripts/__tests__/generateMaterialIconPack.test.ts`

### Unit tests (must write — not E2E)
```
generateMaterialIconPack.test.ts:
  ✓ Output JSON has > 1000 icons (2179 generated)
  ✓ Each icon has: id, collection: 'material', name, url fields
  ✓ No icon has an empty url
  ✓ No duplicate ids
  ✓ All urls are valid data:image/svg+xml data URLs
```

### Done criteria
- [x] Pack generates at prebuild without errors
- [x] Material icons visible and searchable in ElementsPanel
- [x] Drag-to-canvas works
- [x] Unit tests pass (5/5)
- [x] `yarn build` clean

---

## Phase 2A — Pluggable Storage Interface (E4 — Local Only)
**Status:** `[x]` | **Token load:** High | **Depends on:** 0A, 0B

### Token guardrail
> ⚠️ **Do not implement all providers in one session.**
> Session 1: Define the interface + refactor existing server/session into `LocalStorageProvider`.
> Session 2 (Phase 3B): Google Drive provider.
> Session 3 (Phase 3C): S3 provider + backend signed URLs.

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-app/src/services/storageService.ts      (full)
  packages/axoview-app/src/providers/AppStorageContext.tsx (from Phase 0A)
  packages/axoview-backend/server.js                       (full — understand existing endpoints)
```

### Target file structure
```
packages/axoview-app/src/services/storage/
├── types.ts                         # StorageProvider interface + shared types
├── StorageManager.ts                # Refactored: provider registry + active provider delegation
├── providers/
│   ├── LocalStorageProvider.ts      # Merges existing ServerStorage + SessionStorage
│   └── GoogleDriveProvider.ts       # STUB only in this phase — implemented on a separate branch
└── index.ts                         # Re-exports
```

### TypeScript interface (implement exactly — all providers must implement this)
```typescript
// services/storage/types.ts

export interface DiagramMeta {
  id: string
  name: string
  lastModified: string     // ISO 8601
  folderId: string | null  // null = root
  isDirty?: boolean        // client-side only
  thumbnail?: string       // base64 PNG, generated on save
  lockedBy?: string        // reserved for P3 collaboration — leave undefined for now
  deletedAt?: string       // ISO 8601 — soft delete, null = not deleted
}

export interface FolderMeta {
  id: string
  name: string
  parentId: string | null
  isExpanded?: boolean     // tree UI state
}

export interface TreeManifest {
  folders: FolderMeta[]
  // diagram folderId is stored on DiagramMeta, not here
}

export interface StorageProvider {
  id: 'local' | 'google-drive' | 's3'
  displayName: string
  requiresAuth: boolean

  isAvailable(): Promise<boolean>

  // Diagrams
  listDiagrams(folderId?: string | null): Promise<DiagramMeta[]>
  loadDiagram(id: string): Promise<unknown>          // returns raw diagram JSON
  saveDiagram(id: string, data: unknown): Promise<void>
  createDiagram(data: unknown, folderId?: string | null): Promise<string>  // returns new id
  deleteDiagram(id: string, soft?: boolean): Promise<void>

  // Folders
  listFolders(parentId?: string | null): Promise<FolderMeta[]>
  createFolder(name: string, parentId?: string | null): Promise<string>
  deleteFolder(id: string, recursive: boolean): Promise<void>
  renameFolder(id: string, name: string): Promise<void>
  moveItem(id: string, type: 'diagram' | 'folder', targetFolderId: string | null): Promise<void>

  // Tree manifest (open/close state, ordering)
  getTreeManifest(): Promise<TreeManifest>
  saveTreeManifest(manifest: TreeManifest): Promise<void>

  // Reserved for P3 — no-op stubs for now
  subscribe?(diagramId: string, callback: () => void): () => void  // returns unsubscribe fn
}
```

### Sub-tasks
- [x] Create `services/storage/types.ts` with all interfaces above
- [x] Create `services/storage/providers/LocalStorageProvider.ts` — merge existing `ServerStorage` + `SessionStorage` logic into one provider implementing `StorageProvider`
- [x] Add folder support to `LocalStorageProvider`: folders stored as `axoview_folders` JSON in localStorage (key: `axoview-folders`), folder membership stored as `folderId` on diagram metadata
- [x] Create stub `services/storage/providers/GoogleDriveProvider.ts` — throws `NotImplementedError` on all methods
- [~] ~~Create stub `services/storage/providers/S3Provider.ts`~~ — created in Phase 2A, deleted 2026-04-29 with Phase 3C drop
- [x] Refactor `services/storage/StorageManager.ts` — provider registry pattern, `registerProvider()`, `setActiveProvider()`, delegates all calls to active provider
- [x] Update `providers/AppStorageContext.tsx` to initialize `StorageManager` with `LocalStorageProvider` as default
- [x] Update `axoview-backend/server.js` — add folder endpoints:
  - `GET /api/folders` → list folders
  - `POST /api/folders` → create folder
  - `PUT /api/folders/:id` → rename folder
  - `DELETE /api/folders/:id` → delete folder (with `?recursive=true` support)
  - `PATCH /api/diagrams/:id/move` → move diagram to folder (`{ targetFolderId }`)
  - `GET /api/tree-manifest` → get manifest
  - `PUT /api/tree-manifest` → save manifest
- [x] Write unit tests: `services/storage/__tests__/LocalStorageProvider.test.ts`

### Unit tests (must write — not E2E)
```
LocalStorageProvider.test.ts (use MSW to mock fetch):
  ✓ listDiagrams() returns parsed list from server
  ✓ listDiagrams() falls back to sessionStorage when server unavailable
  ✓ saveDiagram() sends correct PUT body
  ✓ createDiagram() returns new id
  ✓ deleteDiagram(id, soft=true) sets deletedAt timestamp, does not remove
  ✓ deleteDiagram(id, soft=false) removes permanently
  ✓ createFolder() creates and returns id
  ✓ moveItem() sends correct PATCH body
  ✓ server timeout (>5s) falls back to sessionStorage
```

### Done criteria
- [x] All existing save/load/delete flows work via `LocalStorageProvider`
- [x] Folder CRUD works against the dev server
- [x] Stub providers exist (return `NotImplementedError`) — no broken imports
- [x] Unit tests pass (9/9 — jest.fn fetch mock, MSW skipped: ESM conflict with Jest CJS config)
- [x] `yarn build` clean

---

## Phase 2B — File Explorer UI (E3)
**Status:** `[x]` | **Token load:** ⚠️ Very High | **Depends on:** 0A, 2A

### Token guardrail
> ⚠️ **Break this into 3 sessions minimum.**
> Session 1: Install react-arborist. Implement basic tree with folder/diagram nodes (read-only, no interactions). Wire into FileExplorerLayout shell from Phase 0A.
> Session 2: Implement CRUD — create, rename (inline), delete (with confirmation), soft delete/trash.
> Session 3: Implement drag-and-drop, context menu, search/filter, dirty indicators, thumbnail previews.

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-app/src/layout/FileExplorerLayout.tsx   (from Phase 0A — shell to fill)
  packages/axoview-app/src/services/storage/types.ts       (from Phase 2A — data model)
  packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx  (from Phase 0A)
  packages/axoview-app/src/stores/notificationStore.ts     (from Phase 0B)
  https://github.com/jameskerr/react-arborist               (README — understand API)
```

### Target file structure
```
packages/axoview-app/src/
├── layout/
│   └── FileExplorerLayout.tsx        # MODIFY: fill shell with actual panel + toggle
├── components/fileExplorer/
│   ├── FileExplorer.tsx              # Root component: arborist tree + toolbar
│   ├── FileTreeNode.tsx              # Custom arborist node renderer
│   ├── FileTreeToolbar.tsx           # New folder, search input
│   ├── TrashSection.tsx              # Soft-deleted items (30 day)
│   ├── ContextMenuItems.tsx          # Right-click menu content
│   └── useThumbnail.ts              # Hook: generate/cache diagram thumbnails
├── hooks/
│   └── useFileTree.ts               # Tree state management (open/close, selection)
└── utils/
    └── fileOperations.ts             # Naming, collision, sanitization pure functions
```

### Key UX rules to implement
| Behavior | Implementation |
|---|---|
| Infinite nesting | react-arborist handles |
| Expansion memory | `TreeManifest.folders[].isExpanded` persisted via storage provider |
| Inline rename | Double-click or F2 → arborist's built-in `Input` rename mode |
| Spring-loading DnD | react-arborist `openDelay={500}` prop |
| Selection persistence after move | react-arborist selection state — re-select by id after move |
| Long name truncation | CSS `text-overflow: ellipsis` on node; full name in MUI `Tooltip` |
| Dirty indicator | `DiagramMeta.isDirty` → render a dot (·) suffix on node label |
| Dirty propagation | If any child `isDirty`, parent folder node also shows indicator |
| Soft delete (trash) | Set `deletedAt`. Show "Trash" section at bottom of tree. Auto-purge after 30 days. |
| Delete confirmation | MUI Dialog: "Delete '[name]' and [n] items inside?" + item count |
| Thumbnail on hover | MUI `Tooltip` with `<img src={thumbnail}>`, generated on save |
| Name collision on move | MUI Dialog: "Keep Both / Replace / Cancel" |

### fileOperations.ts pure functions (all unit-testable)
```typescript
sequentialName(baseName: string, existingNames: string[]): string
// "Untitled" → "Untitled-1" → "Untitled-2"

copySuffix(name: string, existingNames: string[]): string
// "MyDiagram" → "MyDiagram - Copy" → "MyDiagram - Copy (1)"

sanitizeName(name: string): string
// Remove: / \ : * ? " < > |   Replace with _

detectCollision(name: string, targetFolderNames: string[]): boolean

countDescendants(folderId: string, tree: TreeManifest): number
// For delete confirmation dialog

propagateDirty(tree: TreeManifest, diagrams: DiagramMeta[]): Map<string, boolean>
// Returns folderId → hasDirtyDescendant
```

### Sub-tasks (Session 1 — basic tree)
- [x] `yarn add react-arborist` in axoview-app
- [x] Implement `useFileTree.ts` — loads tree manifest + diagram list, builds arborist-compatible node array
- [x] Implement `FileTreeNode.tsx` — renders folder (ChevronRight icon) and diagram (ArticleOutlined icon) nodes
- [x] Wire `FileExplorer.tsx` with `<Tree>` from react-arborist
- [x] Mount in `FileExplorerLayout.tsx` — collapsible left panel, 280px wide, pushes canvas right
- [x] Add toggle button in `AppToolbar.tsx` to open/close the panel

### Sub-tasks (Session 2 — CRUD)
- [x] Inline create folder: toolbar button → new node with `sequentialName()` → arborist rename mode
- [x] Inline rename: F2 / double-click → arborist rename mode → `renameFolder()` or update diagram name
- [x] Delete (single diagram): context menu → `notificationStore` undo toast (5s) → soft delete after 5s
- [x] Delete (folder with children): dialog with count → soft delete all descendants
- [x] Trash section: filtered list of `deletedAt !== null` items
- [x] Restore from trash: context menu "Restore" → clears `deletedAt`
- [x] Permanent delete from trash: "Delete permanently" → `deleteDiagram(id, soft=false)`

### Sub-tasks (Session 3 — interactions)
- [x] Drag-and-drop: arborist `onMove` → `moveItem()` → optimistic update → rollback on failure
- [x] Name collision on DnD: check before confirming move → show merge/replace/keep-both dialog
- [x] Context menu: right-click → MUI Menu with: Open, Rename, Duplicate, Move to Trash, Copy Path
- [x] Search/filter: text input in `FileTreeToolbar` → filter arborist nodes by name (real-time)
- [x] Dirty indicators: subscribe to `DiagramLifecycleProvider.hasUnsavedChanges`
- [x] Dirty propagation: compute `propagateDirty()` on each tree render
- [x] Thumbnail: `useThumbnail.ts` — reads `DiagramMeta.thumbnail` base64; generates on save via `dom-to-image-more`

### Unit tests (must write — not E2E)
```
fileOperations.test.ts:
  ✓ sequentialName: no conflict → returns baseName unchanged
  ✓ sequentialName: conflict → appends -1, -2, etc.
  ✓ copySuffix: no conflict → appends " - Copy"
  ✓ copySuffix: Copy exists → appends " - Copy (1)"
  ✓ sanitizeName: removes all illegal characters
  ✓ sanitizeName: empty string after sanitize → returns "Untitled"
  ✓ countDescendants: returns correct count including nested folders
  ✓ propagateDirty: returns true for folder with dirty child
  ✓ propagateDirty: returns false when all children clean
```

### Done criteria
- [x] File tree visible as collapsible left panel
- [x] Full CRUD (create folder, rename, soft delete, restore, permanent delete)
- [x] Drag-and-drop with spring-loading
- [x] Context menu with all actions
- [x] Search/filter
- [x] Dirty indicators + propagation
- [x] Thumbnail on hover (after first save)
- [x] Trash section
- [x] Unit tests pass (21/21)
- [x] `yarn build` clean

---

## Phase 2B-R — File Explorer UX Revision
**Status:** `[x]` | **Token load:** High | **Depends on:** 2B | **Must complete before:** 2C

### Why this revision exists
Phase 2B shipped a "draft auto-creation" model where editing an unsaved canvas automatically created a timestamped Draft entry in storage. After UX review this was replaced with a VS Code-style approach: explicit inline creation from the file tree, a "Blank diagram" canvas card for the empty-state, and no auto-draft behavior. Several supporting pieces (DraftsSection, search box, pre-creation-then-rename flow) were also revised.

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx   (full)
  packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx  (full)
  packages/axoview-app/src/components/fileExplorer/FileTreeToolbar.tsx
  packages/axoview-app/src/components/fileExplorer/FileTreeNode.tsx
  packages/axoview-app/src/hooks/useFileTree.ts
  packages/axoview-app/src/App.tsx
  packages/axoview-app/src/components/AppToolbar.tsx
```

### Decisions & constraints (do not revisit)
| Decision | Rule |
|---|---|
| Search | Removed entirely — no search in file tree |
| Auto-sort | Folders first (alpha), then diagrams (alpha) — implemented in `buildTree`; always wins |
| DnD | Cross-folder move only — same-parent reorder silently rejected (`currentParentId === parentId` guard) |
| Draft auto-creation | Removed entirely — no auto-draft, no DraftsSection |
| Explorer header label | Dynamic from `storage.id`: `local` → "DIAGRAMS", `google-drive` → "GOOGLE DRIVE", `s3` → "S3" |
| Explorer default open | First server-mode session only (localStorage `axoview-explorer-initialized` flag); persisted after |
| Session mode | Explorer defaults closed; no "Blank diagram" canvas card — old canvas behavior |
| Canvas "Blank diagram" card | Shown when `serverStorageAvailable && currentDiagram === null && !isReadonlyUrl` |
| AppToolbar "New diagram" button | Removed |
| Inline creation | `__pending__` node injected into `treeDataWithPending`; empty name or Escape = cancel; non-empty + Enter/blur = create in storage |
| New Diagram from tree | Flush auto-save (server) or show unsaved-changes dialog (session) → create → load blank canvas |
| Canvas card creation location | Always root |
| File tree button creation location | Selected folder, or root if nothing selected |
| Unsaved changes guard (session mode) | ConfirmDialog with Save / Discard / Cancel (3 buttons) |

### Target file structure changes
```
DELETED:
  packages/axoview-app/src/components/fileExplorer/DraftsSection.tsx

REWRITTEN:
  packages/axoview-app/src/components/fileExplorer/FileTreeToolbar.tsx
    — VS Code-style: [PROVIDER LABEL] + [New Diagram] [New Folder] [Refresh] [Collapse All]
    — Props: { providerLabel, onNewDiagram, onNewFolder, onRefresh, onCollapseAll }

NEW:
  packages/axoview-app/src/components/EmptyStateScreen.tsx
    — Full canvas replacement (not overlay) when serverStorageAvailable && !currentDiagram
    — ISO grid CSS background + centered Paper card with AddCircleOutline icon + "New diagram" button
    — Props: { onCreate: () => void }
    — A/B test: GRID_VARIANT constant at top ('iso' | '2d') — flip to compare, delete unused branch

MODIFIED:
  DiagramLifecycleProvider.tsx  — remove draft logic; add handleCreateBlankDiagram, checkUnsavedBeforeNavigate
  FileExplorer.tsx              — pendingNew state, treeDataWithPending, inline creation handlers; TrashSection removed; context menu simplified to Open/Rename/Duplicate/Delete (hard delete with confirmation, no undo toast)
  FileTreeNode.tsx              — Escape/blur cancellation for __pending__ node
  useFileTree.ts                — remove draftsData; auto-sort in buildTree
  AppToolbar.tsx                — remove "New diagram" button
  App.tsx (EditorShell)         — render EmptyStateScreen when no diagram open (replaces canvas entirely)
  ConfirmDialog.tsx             — add optional onDiscard prop for 3-button variant; standardized dialog style (soft shadow, X button, h6 600 title, body2 body)

DELETED:
  packages/axoview-app/src/components/fileExplorer/TrashSection.tsx
    — Removed: no trash UX; delete is immediate (hard delete) with confirmation dialog
```

### DiagramLifecycleProvider changes (precise)
- **Remove:** `formatDraftName()`, `draftsFolderId` state+ref, `isCreatingDraftRef`, `ensureDraftsFolder()`,
  its pre-fetch `useEffect`, auto-draft block in `handleModelUpdated` (the `else if (!isCreatingDraftRef.current)` branch),
  `draftsFolderId` from context interface + value
- **Change `handleModelUpdated` server-mode block:** when `currentDiagram === null`, do nothing (no draft, no save)
- **Change `fileExplorerOpen` init:** first server session → `true`; subsequent → read `axoview-explorer-open` from localStorage; session mode → always `false`
- **Add `useEffect`** persisting `fileExplorerOpen` to `axoview-explorer-open` in localStorage
- **Add `handleCreateBlankDiagram(folderId: string | null)`:** sequential-named "Untitled", creates in storage, calls `handleDiagramManagerLoad`, opens explorer, fires refresh token
- **Add `checkUnsavedBeforeNavigate(onProceed: () => void)`:** no-op in server mode; in session mode with `hasUnsavedChanges` → ConfirmDialog (Save / Discard / Cancel)
- **Expose** `handleCreateBlankDiagram` and `checkUnsavedBeforeNavigate` in context interface + value

### useFileTree changes (precise)
- Remove `draftsFolderId` param; remove `draftsData` from result type and return
- In `buildTree`: sort `childFolders` and `folderDiagrams` alphabetically before pushing to `nodes`

### FileExplorer changes (precise)
- Remove: `DraftsSection` import + render, `draftsFolderId` destructure, `searchTerm` state
- Add: `selectedNode` state; `pendingNew` state; `selectedFolderId` memo; `treeDataWithPending` memo
- Add: `injectPendingNode()` helper (inline or in fileOperations.ts)
- Add: `useEffect` calling `treeRef.current?.edit('__pending__')` when `pendingNew` is set
- Replace `handleNewFolder`: set `pendingNew = { type: 'folder', parentId: selectedFolderId }`
- Add `handleNewDiagramInline`: set `pendingNew = { type: 'diagram', parentId: selectedFolderId }`
- Rewrite `handleRenameSubmit`: intercepts `id === '__pending__'` — empty → cancel; non-empty folder → `createFolder`; non-empty diagram → `checkUnsavedBeforeNavigate` → `createDiagram` → `openDiagramById`
- Remove `handleCreate` (arborist `onCreate` handler) entirely; remove `onCreate` prop from `<Tree>`
- Update `handleMove`: add `if (currentParentId === parentId) return;` guard at top of loop
- Add `handleCollapseAll`: `treeRef.current?.closeAll()`
- Update `<Tree>`: remove `searchTerm`, `searchMatch`, `onCreate`; add `onSelect`; use `treeDataWithPending`
- Update `<FileTreeToolbar>`: new prop signature

### FileTreeNode changes (precise)
- In edit input `onBlur`: if `node.data.id === '__pending__' && !value.trim()` → `node.submit('')` instead of `node.submit(value)` (routes to cancel path in handleRenameSubmit)
- In edit input `onKeyDown` for Escape: if `node.data.id === '__pending__'` → `node.submit('')`; else → `node.reset()`
- Skip tooltip when `node.data.id === '__pending__'` (name is empty)

### BlankDiagramCard spec
- Absolute overlay: `position: absolute; inset: 0; z-index: 10`
- Background: semi-transparent `background.default` (blocks canvas interaction while showing it dimly)
- Centered content: MUI `Paper elevation=0` with dashed border, ~200×160px, fully clickable (`ButtonBase`)
- Contents: `AddCircleOutlineIcon` 64px + `Typography` "Blank diagram" (body1, text.secondary)
- Hover: border → `primary.main`, icon → `primary.main`

### Sub-tasks
- [x] Delete `DraftsSection.tsx`
- [x] Remove all draft logic from `DiagramLifecycleProvider.tsx`; add `handleCreateBlankDiagram` + `checkUnsavedBeforeNavigate`
- [x] Update `fileExplorerOpen` initialization (first-session logic + localStorage persistence)
- [x] Remove `draftsFolderId` from context interface and all consumers
- [x] Update `useFileTree.ts`: remove `draftsData`, add auto-sort in `buildTree`
- [x] Rewrite `FileTreeToolbar.tsx` to VS Code header layout
- [x] Update `FileExplorer.tsx`: `pendingNew` inline creation, `treeDataWithPending`, updated handlers
- [x] Update `FileTreeNode.tsx`: `__pending__` Escape/blur cancellation
- [x] Add `EmptyStateScreen.tsx` (implemented as full canvas replacement, not overlay — see target structure note)
- [x] Wire `EmptyStateScreen` into `App.tsx` EditorShell
- [x] Remove "New diagram" button from `AppToolbar.tsx`
- [x] Add `onDiscard` prop to `ConfirmDialog.tsx`
- [x] Update `PLAN.md` Phase 2B sub-tasks 2B (Session 2 "Inline create folder") and (Session 3 "Search/filter") to note they are revised
- [x] `yarn build` clean

### Done criteria
- [x] `DraftsSection.tsx` deleted; no draft folder auto-created on app start
- [x] File explorer header: dynamic label + 4 icon buttons; no search box
- [x] "New Diagram" inline: placeholder appears → empty/Escape cancels → name confirms → blank diagram opens in canvas
- [x] "New Folder" inline: same placeholder flow; folder appears in tree sorted
- [x] Auto-sort: folders before diagrams, alphabetical, at every level
- [x] DnD: cross-folder move works; same-folder reorder is silently ignored
- [x] EmptyStateScreen appears on server-mode empty state (ISO grid bg + card); clicking creates "Untitled" at root
- [x] File explorer open by default on first server-mode session; closed by default on session mode
- [x] AppToolbar "New diagram" button gone
- [x] Unsaved-changes guard works before inline diagram creation in session mode
- [x] TrashSection removed; context menu = Open / Rename / Duplicate / Delete (hard delete, confirmation dialog)
- [x] Dialogs standardized: soft shadow, X close button, h6 600 title, body2 text.secondary body, proper DialogActions padding
- [x] `yarn build` clean
- [x] Details panel + UX polish (connector name/notes/F2, layer thumbnails, Enter-to-confirm, Empty-state Import) shipped — see docs/adr/0004 and docs/tactical/details-panel-and-ux-polish.md (git history).
- [x] Session-mode UX revamp (storage gauge, project zip, lean save) shipped — see docs/adr/0001..0003 (git history).

---

## Phase 2C — Diagram-to-Diagram Links
**Status:** `[x]` | **Token load:** Low | **Depends on:** 2A, 2B-R

### Behavior
In the right sidebar, a node can be assigned a link to another diagram. In read-only preview mode (`/display/:id`), clicking a linked node opens the target diagram in a new tab.

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-lib/src/types/model.ts            (Item/Node type)
  packages/axoview-lib/src/components/RightSidebar/  (node controls panel)
  packages/axoview-app/src/App.tsx                   (read-only route handler)
```

### Sub-tasks
- [x] Add `link?: string` (diagramId) to `modelItemSchema` Zod schema in `axoview-lib/src/schemas/modelItems.ts`
- [x] Update UI types: add `linkedDiagrams` to `UiState` + `UiStateActions` in `types/ui.ts`
- [x] Add `linkedDiagrams` state + `setLinkedDiagrams` action to `uiStateStore.tsx`
- [x] Add `linkedDiagrams` prop to `AxoviewProps` (axoviewProps.ts) and wire via useEffect in Axoview.tsx
- [x] Add "Link to diagram" dropdown in `NodeInfoTab.tsx` (edit mode, only shown when linkedDiagrams non-empty)
- [x] Add locale strings: `diagramLink`, `diagramLinkPlaceholder`, `diagramLinkHint`, `openDiagramLink` to all locales
- [x] In `Node.tsx`: in `EXPLORABLE_READONLY` mode, nodes with `modelItem.link` are clickable → opens `/display/{link}` in `_blank`; show small primary-colored badge with ExternalLink icon
- [x] In `App.tsx` EditorShell: load `linkedDiagrams` from `storage.listDiagrams()`, refresh on `fileTreeRefreshToken`, pass as prop to `<Axoview>`

### Done criteria
- [x] Node can be linked to another diagram via right sidebar (Details tab dropdown)
- [x] Clicking linked node in read-only mode opens correct diagram in new tab
- [x] Diagram IDs remain stable across renames
- [x] `yarn build` clean

---

## Phase 2D — Toolbar & Dock Layout Revamp
**Status:** `[x]` | **Token load:** Medium | **Depends on:** 2B-R

- Toolbar & dock layout revamp shipped 2026-05-09 — see [docs/adr/0005-toolbar-and-dock-layout-contract.md](docs/adr/0005-toolbar-and-dock-layout-contract.md). Left-side panels overlay the canvas (no push, no slide); empty state confined to the canvas region; SettingsDialog gained About + Diagnostics tabs; burger removed and items redistributed; UX principles §8 captures the durable rules.
- 2026-05 — UX shake-out polish (7 issues, 3 bundles) + typography contract (UX §1.5 — six theme-driven tiers; no inline `fontSize`/`fontWeight`). Counter-scale fix on `NodeActionBar` (UX §8.8). `Export Project (.zip)` folded into the toolbar Export popover; `SessionModeBanner` quieted to dismiss-only. Region/dock headers now sentence case via `overline` variant (UX §1.2 / §7.2). See [CHANGELOG `[Unreleased]`](CHANGELOG.md#unreleased) for the full list.
- 2026-05-19 — MQA design shake-out discharged. All seven items shipped (#8/#9 multi-select + Ctrl+A, #10 newly-loaded category auto-expand + pulse, #11 canvas rich-text typography + 2D-Y rotation, #19 shortcut + tooltip hints, #20 Settings left-rail redesign, #25 preview-mode notes vs link interaction, #26 imported-icon delete + workspace-wide usage warning). Tactical doc deleted; outcomes live in [ADR-0006](docs/adr/0006-canvas-selection-contract.md), `CHANGELOG.md`, and the dated `[2026.5.18]` / `[2026.5.19]` releases.
- Productization audit (2026-03 → 2026-05) complete — see ADRs 0008–0011 + [docs/technical-review-2026-05.md](docs/technical-review-2026-05.md) for the durable record. v1.0.0 shipped 2026-05-23; M0–M10 milestone arc closed via 17 locked decisions across cleanup execution, ADR-implementation, deployment hardening, CI/automation hardening, and E2E rewrite. Sibling tacticals `e2e-suite-rewrite.md` + `git-automation-hardening.md` retained as session telemetry; `flare_plan.md` retired pre-audit (decisions absorbed into ADRs 0009 + 0010).

### Behavior
The application chrome is reorganized to give every class of control a single owning region. The burger menu is removed and its items distributed; the file-explorer toggle moves into the left strip alongside Elements + Layers; the top toolbar collapses to a four-group RIGHT zone (View modes / Save group / Document actions / Sidebar toggle); SettingsDialog gains About + Diagnostics tabs.

The shape is locked by [docs/adr/0005-toolbar-and-dock-layout-contract.md](docs/adr/0005-toolbar-and-dock-layout-contract.md). The execution checklist lives in [docs/tactical/layout-revamp.md](docs/tactical/layout-revamp.md).

### Why this lands here
After 2B-R + 2C, the file explorer + diagram-link UX is settled but the surrounding chrome still carries debt from the upstream layout (junk-drawer burger, file-explorer toggle in the wrong region, no place to add future controls). 2D fixes the shell so future phases (formatting, presentation, annotation) have a home.

### Session startup checklist
```
Before coding, read these files:
  docs/adr/0005-toolbar-and-dock-layout-contract.md       (full)
  docs/tactical/layout-revamp.md                          (full — sub-tasks live here)
  docs/ux-principles.md                                   (full — design language)
  packages/axoview-app/src/components/AppToolbar.tsx     (full)
  packages/axoview-lib/src/components/LeftDock/LeftDock.tsx        (full)
  packages/axoview-lib/src/components/SettingsDialog/SettingsDialog.tsx  (full)
  packages/axoview-lib/src/components/MainMenu/MainMenu.tsx        (skim — for burger items being redistributed)
```

### Sub-tasks (high-level)
Detailed sub-tasks live in [docs/tactical/layout-revamp.md](docs/tactical/layout-revamp.md). Top-level groups:
- [ ] **A.** Left strip restructure — Navigation region (📁), separator, Working region (⊞ ≣), System anchor (⚙).
- [ ] **B.** Top toolbar restructure — RIGHT zone with four groups; new `StatusCluster` and `ExportPopover` components.
- [ ] **C.** Burger removal — stop passing `mainMenuOptions`; lib's `MainMenu` stays exported but unused in app.
- [ ] **D.** SettingsDialog tabs — append `About` (GitHub, version) and `Diagnostics` (debug overlay toggle, model dump, session dump).
- [ ] **E.** Tests — `SettingsDialog`, `AppToolbar`, `StatusCluster`, `ExportPopover`.
- [ ] **F.** Smoke checklist — server mode, session mode, settings tabs, export, read-only, save error path.
- [ ] **G.** Wrap-up — flip dashboard to `[x]`, append wrap-up line below, delete tactical doc.

### Done criteria
- [ ] Top toolbar matches ADR 0005 four-group RIGHT zone in both server and session modes
- [ ] Save action and status cluster are visually adjacent in session mode (one group)
- [ ] Burger menu is no longer rendered in the app
- [ ] Left strip has 📁 → separator → ⊞ ≣ → spacer → ⚙ from top to bottom
- [ ] 📁 + Elements (or 📁 + Layers) can be open simultaneously; Elements ↔ Layers stay mutex
- [ ] Settings dialog has new About + Diagnostics tabs; debug overlay toggle works; session dump and model dump download
- [ ] Storage gauge popover keeps per-diagram breakdown; Dump action moved to Diagnostics
- [ ] Export popover (top toolbar) offers JSON / Compact JSON / Image
- [ ] Read-only URL mode unchanged (chip only)
- [ ] All new strings localized in 14 languages
- [ ] `yarn build` clean

**Completed alongside 2D (tacticals retired 2026-05-19):**
- **Rename FossFLOW → Axoview** — Phases 0–9 shipped on `rename/axoview` (merged `72fa120`). Phase 10 (npm publish, Docker Hub, Cloudflare Pages deploy, cwd rename) absorbed into `docs/tactical/productization-audit.md` milestones M7/M8/M10.
  — Phase 10 "npm publish" item closed 2026-05-20 with decision not to publish; `axoview-lib` stays monorepo-only per productization-audit Locked Decision #11.
- **Manual QA bundle (28 items)** — Bundles A + B (2026-05-15) plus follow-ups through 2026-05-19; all items closed. Five late-flagged items (#8, #9, #19, #20, #26) confirmed resolved.
- **v1.1 test-coverage** — shipped 2026-05-26 → 2026-05-27 across PRs #8 (5a backend + worker contract tests) + #9 (KR1+KR2+KR3 bundled E2E expansion) + this PR (KR1 iso tile→screen helper unlock + Findings #4–#7 deferred specs + Finding #8 partial — delete-with-confirmation). Closes the §11 HIGH-severity test gaps named in the post-v1.0.0 review for backend + worker (5a) and canvas cross-interaction (5e). Two narrow residuals remain catalogued in this PLAN: (a) `ADR 0011 Dialogs` (deferred-features register row 1 below — net-new product work, not test debt); (b) file-explorer `drag-into-folder` E2E coverage blocked on the well-known Playwright + react-dnd HTML5 backend testing limitation, deferred to a future session that either swaps to react-dnd's test backend in tests or exposes the tree API through the debug bridge; the multi-select-tree sub-row of Finding #8 was scope-corrected (app uses single-select; arborist hooks support multi-select but app-side wiring is needed first). Tactical `docs/tactical/v1.1-test-coverage.md` retired per convention; durable record lives in the commit history of those three PRs plus the deferred-features register row.
- **v1.1 tech-debt cleanup** — shipped 2026-05-23 → 2026-05-25 across PRs #3–#7. Track 0 (dead-code wave, ~9.4k LOC removed across 8 clusters), Track 1 (audit-truth fixes — nginx security headers, `isPublicRoute` alignment, ADR 0005 amendment, web-vitals dep removal, i18n `mainMenu` cascade), Track 2 (productization decisions — backend `npm ci` at build time + committed lockfile, drop `NPM_TOKEN` from `release.yml`, drop Node 20 from CI matrix, compose `name: axoview` + service rename `axoview` → `app`), Track 3 (`docs/technical-review-2026-05.md` §12 corrections appendix — B2 / B5 / M6 / M7 / anomaly #31 / published-posture / version notes), Track 4 (CodeQL toggle + master branch protection + single-tenant deployment callout). Mid-cleanup discovery: lasso connector-delete regression + path-hit selection semantics fixed in PR #6 (`2ed5f79`). Tracks 5 (test coverage incl. canvas cross-interaction E2E), 6 (refactor candidates for files > 300 LOC — **superseded 2026-05-26 by Sonar-driven refactor priorities; see catalogued workstream below**), and 7 (new audit workstreams incl. `no-explicit-any` baseline cleanup) catalogued; each spawns its own tactical when authorized. Durable corrections record lives in [`docs/technical-review-2026-05.md`](docs/technical-review-2026-05.md) §12. Tactical `docs/tactical/v1.1-tech-debt.md` retired per convention.

**Deferred features (product decisions needed before any work can start):**

This register exists because some gaps surface during test/audit/cleanup work that are **net-new product functionality**, not test debt or refactor debt. They need a product decision (which feature to build, what shape, what UX) BEFORE engineering work can start. Distinct from catalogued workstreams (which are AUTHORIZED engineering waiting for a tactical spawn).

Triage rule for this register (per user 2026-05-26):
- **Bug** → fix immediately (own commit / opportunistic / next PR).
- **Minor improvement** → fix (catalogued workstream).
- **New functionality** → this register; product decision first, engineering later.

| # | Feature gap | Source | Status |
|---|---|---|---|
| 1 | **Failure-of-intent Dialogs for `ADR 0011` contract gaps** — ADR 0011 says "every failure-of-intent surfaces an explicit Dialog," but no Dialog exists for: (a) save failure (e.g., localStorage quota exceeded); (b) malformed-import (corrupted JSON / corrupted ZIP / unsupported file); (c) share-POST 500 (Worker / backend returns 5xx during share-link generation). Each scenario needs: which Dialog component, copy, dismiss UX, retry affordance if any. Once built, the Track 5e bundle's KR4 specs can land. | PR #9 / v1.1-test-coverage Finding #3 (2026-05-26) | Awaits product decision |

---

**Catalogued next-workstreams (each spawns its own tactical when authorized — see `feedback_okr_prompt_header.md` discipline):**

- **v1.1 Sonar-driven refactor priorities** *(authorized 2026-05-26; supersedes Track 6 from retired `v1.1-tech-debt.md`; tactical pending spawn)* — Source: local Sonar scan 2026-05-26 (499 issues triaged; ~40 actionable). The S3776 rule (cognitive complexity > 15) fired on ~40 functions repo-wide — gives a real priority signal for refactor work that ESLint doesn't enforce. Replaces Track 6's pure-LOC heuristic (pre-Sonar guess); the original 10 LOC-300+ files almost certainly dominate the Sonar list, but Sonar will surface smaller-LOC-but-truly-complex functions the LOC heuristic missed AND will deprioritize LOC files where complexity is actually reasonable. Initiative shape: Tier 1 = the ~40 S3776 hits in priority order (highest complexity × highest LOC first); Tier 2 = the ~100 "worth scanning" findings (S1874 deprecated APIs, S2486 empty catches, S6479 array-index React keys, S1854 dead stores, S7924 a11y contrast); Tier 3 = noise cleanup (clone Sonar Way profile, disable ~330 S77xx modernization nags). **Two real bugs from the Sonar scan handled separately**: (a) `axoview-e2e/pom/CanvasPOM.ts:88` async Promise executor — fold into the bundled E2E PR opportunistically since the agent touches CanvasPOM heavily; (b) `axoview-app/.../FileExplorer.tsx:63` a11y keyboard listener — already in scope under Track 7 M8a, add file:line when that track spawns; (c) `axoview-e2e/fixtures/app.fixture.ts:42` Sonar pattern-match false positive (Playwright `use()` ≠ React hook), disregard. **Operational**: Sonar config file + CSV/JSON exports are throwaway — verify `.gitignore` covers them before next commit; delete after this catalogue entry is preserved. **Sequencing**: defer until at least 5e (canvas E2E) lands — refactoring untested surfaces is the worst combination.
- **v1.1 `cf-access` JWT-verify testability** *(authorized 2026-05-26; tactical pending spawn — likely small)* — Source: 5a Finding #2. `auth.ts`'s `cf-access` mode RS256 happy + invalid-signature paths were deferred during 5a because mocking `crypto.subtle.verify` + JWKS fetch cleanly took more than the orchestrator's ~20-line boilerplate budget. Structural-validation paths (header.alg, missing kid, expired exp, aud/iss mismatch) ARE covered. Initiative shape: likely needs `auth.ts` extraction of a thin verifier function to unit-test cleanly, OR a fixture-keypair harness. ADR-worthy if the extraction surfaces structural questions about the auth contract. **Not blocking v1.1.**
- **v1.1 `no-explicit-any` baseline elimination** *(authorized 2026-05-25; per-workspace phasing locked 2026-05-25)* — Source: full `npx eslint .` inventory taken 2026-05-25 surfaced **144 sites across 30 files** — substantially larger than the ~20-site framing in the original catalogue entry, which only counted the CI annotations from PRs #5 / #6. Largest concentrations: `axoview-app/src/providers/DiagramLifecycleProvider.tsx` (49), `axoview-lib/src/global.d.ts` (11), `axoview-lib/src/hooks/useInitialDataManager.ts` (10), `axoview-app/src/services/storage/providers/LocalStorageProvider.ts` (8), `axoview-lib/src/clipboard/useCopyPaste.ts` (8), `axoview-lib/src/hooks/useLayerContext.ts` (7), `axoview-app/src/services/iconPackManager.ts` (7), `axoview-app/src/components/DiagnosticsOverlay.tsx` (6). Per-workspace totals: axoview-app **78**, axoview-lib **66**. **Suppression is the wrong fix** — each site needs proper typing (concrete types where shape is known; narrow `unknown` + type-guards where dynamic). Promotion candidate: enable `@typescript-eslint/no-explicit-any: error` once baseline hits zero. **Do NOT bundle as Tier 3 polish** — proper typing requires per-site investigation; `DiagramLifecycleProvider.tsx`'s 49 sites alone likely indicate a typing gap in the storage / model contracts that may warrant an ADR. Initiative shape (revised 2026-05-25): **per-workspace + per-cluster sweep — one PR per ≤ 15-20 sites**. Suggested phasing: (1) axoview-app top-level surfaces (App.tsx ×3, AppToolbar.tsx ×1, DiagnosticsOverlay.tsx ×6, smaller residue) — ~15 sites; (2) `DiagramLifecycleProvider.tsx` standalone (49 sites — may require ADR for storage/model typing); (3) axoview-app storage layer (StorageManager + LocalStorageProvider ×9, ImportDialog ×3, useThumbnail ×1) — ~13 sites; (4) axoview-app icon/file-explorer (iconPackManager ×7, FileExplorer ×2, diagramUtils ×4, misc dialogs) — ~16 sites; (5) axoview-lib hooks (useInitialDataManager ×10, useLayerContext ×7, useCopyPaste ×8) — ~25 sites; (6) axoview-lib components + types (global.d.ts ×11, NodeActionBar ×4, Axoview.tsx ×3, residue) — ~27 sites. Re-promote rule to `error` only after **all** phases land + baseline hits zero. This row originally lived in the retired `v1.1-tech-debt.md` Track 7 catalogue; lost in the PR #7 / PR #8 merge-conflict resolution; restored here as the durable home; scope corrected 2026-05-25 after a v1.1-closure session inventoried the true site count.
- **v1.1 Cloudflare hardening** — *shipped 2026-05-27 across PR #11 (Workstream A.1 — Worker probe-input diagnosis + onError handler).* A.2 (`wrangler tail` + bundle-size cross-reference) + Workstream B (CF edge configuration: Bot Fight Mode + WAF Managed Rules + scanner-path block + rate-limit) + Hygiene (P4 exposure-verification checklist) **DEFERRED INDEFINITELY** per the retired tactical's LD #6 and the A.1 verdict (500 non-reproducible from current `integration` bundle; production 5xx signal likely a deployed-bundle staleness or a non-`/api/*` SPA boot path, neither of which Workstream B would address). Recommended user follow-up post-deploy: 30-second deployed-SHA check via CF Pages dashboard or `wrangler deployments list`; if SHA matches `master` AND 5xx noise persists ≥ 3 days, revisit as a new narrow workstream targeting the SPA boot path. Tactical `docs/tactical/v1.1-cloudflare-hardening.md` retired per docs convention; durable record lives in PR #11 commit history (`d6a4ce3`).

---

## Phase 3A — Google Authentication (E5)
**Status:** `[ ]` | **Token load:** Medium | **Depends on:** 0A, 0B

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-app/src/providers/AppStorageContext.tsx  (from Phase 0A)
  packages/axoview-app/src/components/AppToolbar.tsx        (where avatar goes)
  packages/axoview-app/src/stores/notificationStore.ts      (from Phase 0B)
  https://www.npmjs.com/package/@react-oauth/google          (README — GoogleOAuthProvider setup)
```

### Target file structure
```
packages/axoview-app/src/
├── stores/
│   └── authStore.ts                  # NEW Zustand store (NOT persisted)
├── providers/
│   └── AuthProvider.tsx              # NEW: wraps GoogleOAuthProvider, initializes authStore
└── components/
    ├── AppToolbar.tsx                 # MODIFY: add avatar/sign-in button
    └── StorageProviderPicker.tsx     # NEW: local / Drive / S3 selector (Drive gated by auth)
```

### Auth state machine (implement exactly)
```
UNAUTHENTICATED  →(signIn())→     AUTHENTICATING
AUTHENTICATING   →(success)→     AUTHENTICATED
AUTHENTICATING   →(denied)→      UNAUTHENTICATED  + push info toast "Sign-in cancelled"
AUTHENTICATING   →(popup blocked)→ UNAUTHENTICATED + show tooltip near button
AUTHENTICATED    →(token near expiry)→ REFRESHING (background)
REFRESHING       →(success)→     AUTHENTICATED
REFRESHING       →(fail)→        SESSION_EXPIRED
SESSION_EXPIRED  →(signIn())→    AUTHENTICATING
AUTHENTICATED    →(signOut())→   UNAUTHENTICATED  + switch storage to local
```

### TypeScript interface (implement exactly)
```typescript
// stores/authStore.ts
type AuthStatus =
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATING'
  | 'AUTHENTICATED'
  | 'REFRESHING'
  | 'SESSION_EXPIRED'

interface AuthUser {
  name: string
  email: string
  avatarUrl: string
}

interface AuthStore {
  status: AuthStatus
  user: AuthUser | null
  accessToken: string | null    // in-memory ONLY — never persisted to localStorage
  expiresAt: number | null      // epoch ms
  signIn(): Promise<void>
  signOut(): void
  refreshToken(): Promise<boolean>
  getValidToken(): Promise<string | null>  // refreshes if <5min to expiry; null if unauth
}
```

### Security rules (enforce in code)
1. `authStore` must NOT use `zustand/middleware/persist` — token must never hit localStorage
2. `getValidToken()` is the ONLY way any other module gets the access token — no direct `accessToken` reads
3. Scopes: request ONLY `profile email https://www.googleapis.com/auth/drive.file`
4. On sign-out: call `authStore.signOut()` which nulls the token, then switch storage to local

### Sub-tasks
- [ ] `yarn add @react-oauth/google` in axoview-app
- [ ] Create `stores/authStore.ts` with Zustand (no persist middleware)
- [ ] Create `providers/AuthProvider.tsx` — wraps `<GoogleOAuthProvider clientId={...}>`, attempts silent token refresh on mount
- [ ] Mount `AuthProvider` in `App.tsx` (above `AppStorageContext`)
- [ ] Add to `AppToolbar.tsx`:
  - Unauthenticated: "Sign in with Google" button (top-right)
  - Authenticating: CircularProgress spinner
  - Authenticated: MUI Avatar (photo) + name chip
  - Session expired: amber chip "Session expired" → click re-opens sign-in
- [ ] Create `StorageProviderPicker.tsx` — icon row in AppToolbar or Settings: Local | Google Drive (disabled if unauth, tooltip: "Sign in to use Google Drive") | S3 (disabled if backend not configured)
- [ ] Handle popup-blocked: catch error in `signIn()`, show tooltip, offer redirect fallback
- [ ] `SESSION_EXPIRED`: push persistent warning notification with "Sign in again" action
- [ ] Write unit tests: `stores/__tests__/authStore.test.ts`

### Unit tests (must write — not E2E)
```
authStore.test.ts (mock @react-oauth/google):
  ✓ initial status is UNAUTHENTICATED
  ✓ signIn() moves to AUTHENTICATING then AUTHENTICATED on success
  ✓ signIn() moves back to UNAUTHENTICATED on denial, pushes info notification
  ✓ accessToken never written to localStorage (spy on localStorage.setItem)
  ✓ getValidToken() returns token when AUTHENTICATED and not near expiry
  ✓ getValidToken() calls refreshToken() when within 5min of expiry
  ✓ getValidToken() returns null when UNAUTHENTICATED
  ✓ signOut() sets status UNAUTHENTICATED and nulls token
  ✓ SESSION_EXPIRED: push notification with 'Sign in again' action
```

### Done criteria
- [ ] Sign-in flow works end-to-end with Google popup
- [ ] Silent refresh works on page reload for returning user
- [ ] Token not present in localStorage at any point (manual DevTools check + unit test)
- [ ] Google Drive option in storage picker gated by auth
- [ ] Unit tests pass
- [ ] `yarn build` clean

---

## Phase 3B — Google Drive Provider (E4)
**Status:** `[ ]` | **Token load:** High | **Depends on:** 2A, 3A

### Token guardrail
> ⚠️ **Do not attempt Drive integration without first mocking it.**
> Session 1: Implement full `GoogleDriveProvider` with MSW mocking Drive API responses. All unit tests pass.
> Session 2: Wire to real Drive API. Manual test only (OAuth required — no automated E2E).

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-app/src/services/storage/types.ts          (StorageProvider interface)
  packages/axoview-app/src/services/storage/providers/GoogleDriveProvider.ts  (current stub)
  packages/axoview-app/src/stores/authStore.ts                (getValidToken())
  packages/axoview-app/src/stores/notificationStore.ts
```

### Drive API mapping
| StorageProvider method | Drive API call |
|---|---|
| `listDiagrams(folderId)` | `GET /drive/v3/files?q=mimeType='application/json' and '{folderId}' in parents` |
| `loadDiagram(id)` | `GET /drive/v3/files/{id}?alt=media` |
| `saveDiagram(id, data)` | `PATCH /upload/drive/v3/files/{id}?uploadType=media` |
| `createDiagram(data, folderId)` | `POST /upload/drive/v3/files?uploadType=multipart` (with metadata) |
| `deleteDiagram(id, soft)` | soft: update `appProperties.deletedAt`. hard: `DELETE /drive/v3/files/{id}` |
| `listFolders(parentId)` | `GET /drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and '{parentId}' in parents` |
| `createFolder(name, parentId)` | `POST /drive/v3/files` (mimeType: vnd.google-apps.folder) |
| `getTreeManifest()` | `GET /drive/v3/files?q=name='axoview-manifest.json'` then `GET .../alt=media` |
| `saveTreeManifest(m)` | `PATCH /upload/drive/v3/files/{manifestId}` |

**Root folder:** All Axoview files live under a `Axoview/` folder in the user's Drive, created on first use.

### Sub-tasks
- [ ] Set up MSW Drive API handlers in `src/mocks/handlers/driveHandlers.ts`
- [ ] Implement `GoogleDriveProvider.ts` — all `StorageProvider` methods using Drive API v3
- [ ] All Drive API calls use `authStore.getValidToken()` — never raw `accessToken`
- [ ] Implement exponential backoff retry (3×: 500ms, 1s, 2s) for transient errors (5xx, timeout)
- [ ] Handle `401`: trigger `authStore` → `SESSION_EXPIRED` state
- [ ] Handle `403 userRateLimitExceeded`: back-off, push warning toast (not error)
- [ ] Implement offline write queue: failed writes buffered to IndexedDB, replayed on reconnect
- [ ] Register `GoogleDriveProvider` with `StorageManager` in `AppStorageContext`
- [ ] Migration flow: when user switches to Drive, offer "Migrate local diagrams?" → progress dialog
- [ ] Write unit tests: `services/storage/__tests__/GoogleDriveProvider.test.ts`

### Unit tests (must write — not E2E)
```
GoogleDriveProvider.test.ts (MSW mocking googleapis.com):
  ✓ listDiagrams() maps Drive file list to DiagramMeta[]
  ✓ loadDiagram() fetches file content and returns parsed JSON
  ✓ saveDiagram() sends PATCH with correct Content-Type
  ✓ createDiagram() creates file in correct folder
  ✓ 401 response → authStore SESSION_EXPIRED state
  ✓ 503 → retries 3× with backoff → success on 3rd attempt
  ✓ 503 × 3 → pushes error notification with "Try again" action
  ✓ offline → queues write to IndexedDB
  ✓ reconnect → replays queued writes in order
```

### Done criteria
- [ ] Drive provider implements full `StorageProvider` interface
- [ ] Retry + backoff working
- [ ] Auth error handling triggers correct auth state
- [ ] Offline queue works
- [ ] Unit tests pass (with MSW)
- [ ] Manual test: create diagram → save to Drive → reload page → diagram loads from Drive
- [ ] `yarn build` clean

---

## Phase 3C — ~~S3 Provider + Backend (E4)~~ 🚫 DROPPED (2026-04-29)

**Status:** 🚫 DROPPED. The S3 provider stub was deleted along with the AWS SDK / MinIO dependencies on 2026-04-29 ([cloudflare_poc] cleanup). The persistent-storage path on Cloudflare is being addressed via Google Drive on a separate branch instead. If S3 support is ever needed again, restore from git history (commit predating the drop).

---

## Phase 4A — External Diagram Registry (E6)
**Status:** `[ ]` | **Token load:** Low | **Depends on:** 3A

### Behavior
Users can add external diagram URLs (draw.io, Lucidchart, Miro) to the file tree as reference entries. Clicking opens in a new tab. draw.io files in Google Drive can be browsed using the existing auth token.

### Session startup checklist
```
Before coding, read these files:
  packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx  (from Phase 2B)
  packages/axoview-app/src/services/storage/types.ts                  (extend with ExternalDiagramNode)
```

### Sub-tasks
- [ ] Add `ExternalDiagramNode` type: `{ id, name, sourceType: 'drawio' | 'lucidchart' | 'miro' | 'other', url, thumbnailUrl? }`
- [ ] External nodes stored in tree manifest (not in storage provider)
- [ ] "Add external diagram" in file tree context menu → paste URL dialog
- [ ] For draw.io: if user is signed in with Google, offer Google Picker to browse Drive files
- [ ] External nodes render with a distinct icon (OpenInNew) and no dirty indicator
- [ ] Click opens `url` in `_blank` tab
- [ ] No preview panel — `_blank` navigation only (as specified)

### Done criteria
- [ ] External entries appear in file tree
- [ ] Clicking opens in new tab
- [ ] draw.io files browsable via Google Picker (if signed in)
- [ ] `yarn build` clean

---

## E2E Test Suite — POST-UX PHASE (Out of Scope Now)
🚫 **Do not implement during the above phases.**

**Playwright migration shipped 2026-05 (tactical retired 2026-05-19):** Playwright suite operational at `packages/axoview-e2e/`; legacy Selenium suite at `e2e-tests/` retained interim. **Superseded by productization-audit decision #4** — both suites will be deleted and the E2E suite rewritten from zero against the locked naming convention (ADR 0008) once the productization audit reaches milestone M9.

When the new UX ships, pick up this section. The Playwright infrastructure already exists at `packages/axoview-e2e/`. All existing tests continue to run. New test files to add:

```
packages/axoview-e2e/tests/
├── file-explorer.spec.ts       # Create folder, rename, DnD, delete, trash, search
├── 2d-canvas-mode.spec.ts      # Toggle, visual regression, export in 2D mode
├── material-icons.spec.ts      # Search, drag to canvas
├── diagram-links.spec.ts       # Link node, click in read-only, new tab
├── auth-google.spec.ts         # Mocked GIS: sign in, sign out, session expired
├── storage-drive.spec.ts       # Mocked Drive API: save, load, switch provider
├── storage-s3.spec.ts          # Mocked S3: save, load, switch provider
└── notifications.spec.ts       # Error toasts, undo toasts, persistent banners
```

Playwright mock approach:
- `page.route()` to intercept and mock Google auth endpoints + Drive API
- `page.route()` to mock backend S3 signed URL endpoint
- `storageState` injection for pre-authenticated test scenarios

---

## Dependency Graph (visual reference)

```
0A (App decompose) ──┬──▶ 2A (Storage interface) ──┬──▶ 2B (File Explorer)
                     │                              ├──▶ 2C (Diagram links)
                     │                              └──▶ 3C (S3 provider)
                     │
0B (Notifications) ──┴──▶ 3A (Google Auth) ──────────▶ 3B (Drive provider)
                                                         │
                                          3A ────────────▶ 4A (External diagrams)

1A (2D canvas) ── standalone (can run parallel to 0A/0B)
1B (Material icons) ── standalone (can run parallel to 0A/0B)
```

---

## Token Budget & Guardrails Summary

| Phase | Estimated token load | Guardrail |
|---|---|---|
| 0A | ⚠️ Very High | Split into 3 sessions: extract one provider per session |
| 0B | Medium | Single session |
| 1A | Medium | Single session. Read only Grid.tsx + uiStateStore + isoMath |
| 1B | Low | Single session |
| 2A | High | Session 1: interface + LocalProvider only. Stubs for others. |
| 2B | ⚠️ Very High | 3 sessions: basic tree → CRUD → interactions |
| 2B-R | High | Single session. Read Phase 2B-R session checklist first. |
| 2C | Low | Single session |
| 3A | Medium | Single session |
| 3B | High | Session 1: MSW mocks + unit tests. Session 2: real Drive API wiring |
| 3C | High | Session 1: unit tests (MSW). Session 2: integration (MinIO) |
| 4A | Low | Single session |

**General rules for every session:**
1. Start by reading `PLAN.md` + only the files listed in the phase's **Session startup checklist**
2. Use `TodoWrite` at session start to create sub-task list
3. Mark checkboxes `[x]` in this file as tasks complete
4. Run `yarn build` before ending a session — never leave a broken build
5. If a session runs long: stop at a stable checkpoint (build passes, tests pass), update status in dashboard, end

---

## New Libraries Introduced (total)

| Library | Package | Phase | Install in |
|---|---|---|---|
| `react-arborist` | `react-arborist` | 2B | axoview-app |
| `@react-oauth/google` | `@react-oauth/google` | 3A | axoview-app |
| `gapi-script` or raw GIS | `gapi-script` | 3B | axoview-app |
| ~~`@aws-sdk/client-s3`~~ | — | 🚫 3C dropped (2026-04-29) | — |
| ~~`@aws-sdk/s3-request-presigner`~~ | — | 🚫 3C dropped (2026-04-29) | — |
| ~~`express-rate-limit`~~ | — | 🚫 3C dropped (2026-04-29) | — |
| `msw` | `msw@^2` | 2A | axoview-app (devDep) |
| ~~`helmet`~~ | — | 🚫 3C dropped (2026-04-29) | — |

---

## Security Checklist (verify before each P2/P3 ship)

- [ ] Access token absent from localStorage (unit test + manual DevTools check)
- [ ] CORS `allowed-origins` env var set (not `*`) on backend
- [ ] Drive scope is `drive.file` not `drive` (check OAuth consent screen)
- [ ] No `console.log(token)` or similar in auth code (grep before ship)
