An "experimental" community fork of [FossFLOW](https://github.com/stan-smith/FossFLOW) with expanded editing features, file management, full internationalisation, project-zip workspace bundles, multi-target deployment (Docker / Cloudflare Pages), and large performance improvements.

**[Try the live demo →](https://demo-fce.pages.dev/)** — deployed from `master`, always reflects the latest shipped version.

Source and issue tracker: [github.com/molikas/FossFLOW_V2](https://github.com/molikas/FossFLOW_V2).

**Performance highlight:** On a real 85-node / 54-connector diagram, idle FPS improved from 5–18 to a consistent 60 fps after fixing two root-cause render bugs. See the [Performance section](#performance) below.

---

## What this fork adds vs upstream

### Editing

- **Cut, copy and paste** — `Ctrl+C` copies, `Ctrl+X` cuts, `Ctrl+V` pastes at cursor. Works on any combination of nodes, connectors, rectangles, and text boxes. Connectors between pasted nodes are included automatically. Full undo/redo support.
- **Freehand lasso selection** — Draw a freehand polygon to select items, in addition to the standard rectangular lasso.
- **Drag precision** — Dragging responds instantly, tracks the grab point, and stops cleanly at the last valid position when blocked.
- **Delete key** — `Delete` or `Backspace` removes selected items.
- **Undo/redo** — Full multi-step history for all canvas changes.
- **Multi-view diagrams** — Multiple named views (tabs) within a single file, each an independent canvas.
- **Inline rename on canvas** — `F2` with a node or text-box selected, or double-click on its label, enters inline-edit on the canvas itself (not the side-panel input). Auto-grows rightward and wraps at maxWidth. Enter / blur commits, Escape cancels.

### Nodes and text

- **Node panel — Details / Style / Notes tabs** — Selecting a node opens the right Properties panel with three tabs. *Details*: name, caption (short text shown on the canvas below the node name), and optional link. *Style*: icon picker, icon size, label font/color/height. *Notes*: full-height rich-text editor for private documentation — never shown on the canvas itself.
- **Caption vs Notes** — "Caption" is canvas-visible text (subtitle under the node name). "Notes" is hidden documentation only accessible in the panel. Both fields are rich-text (Quill), stored separately in the model.
- **Floating action bar** — When a node is selected in edit mode a compact pill bar appears above the node on the canvas with seven icon buttons: Style, Edit name, Edit/Add link, Edit/Add notes, **Start connector** (draws a new connector from this node and returns to cursor after connecting), Delete. The bar is polymorphic — connectors, text boxes, and rectangles get the same affordance (Style / Edit name / Notes / Delete) anchored above the click point.
- **Connector parity with nodes** — Connectors are first-class peers: `name`, `notes`, optional `headerLink`, and a synthetic name label drawn at the midpoint of the line. F2 inline-renames the connector on the canvas; the name label becomes a clickable link when a URL is set. Connector controls panel mirrors the node panel exactly — Details / Style / Notes tabs.
- **Name field for text boxes and rectangles** — Both gain an optional name shown in the layers panel and rename-able via F2 in the layers tree.
- **Note indicator dot** — Nodes with non-empty Notes show a small blue dot at the top-right of their icon on the canvas.
- **Read-only node panel** — In `EXPLORABLE_READONLY` mode, clicking a node opens a single-scroll panel showing **Caption** and **Notes** sections (only when non-empty). Header shows the node icon, name, and optional link button. Nodes with no caption and no notes are not clickable at all — the panel stays closed.
- **Double-click to place node or rectangle** — Double-clicking empty canvas opens a compact "Add" popover at the cursor. A **Rectangle** button at the top creates a background rectangle for visually grouping nodes. Below it, an icon picker lets you place a node — selecting an icon places it and immediately opens its Details tab for naming. Single left-click on empty canvas just deselects; no context menu.
- **Clickable node links** — Attach a URL to any node; its label becomes a clickable link in the diagram.
- **Cross-diagram links** — A node can link to another diagram in this workspace. In `EXPLORABLE_READONLY`, clicking the node opens the target diagram in a new tab; a blue badge on the icon indicates the link, and the tooltip reads *"Opens "X" in a new tab"* using the linked diagram's name. Header URL and diagram link coexist without showing two tooltips.
- **Node label font size and color** — Adjust font size and text color from the Style tab.
- **Text box rich text and color** — Text boxes support bold, italic, bullet lists, headers, and more. Text color is adjustable. The box auto-expands to fit its content.
- **Connector label styling** — Per-label font size (8–24 px), text color, and position control. The color section is clearly labelled "Line Color" to distinguish it from label color.
- **Connector anchor handles** — Selecting a connector shows glass-morphism anchor circles at each endpoint and waypoint (source = filled dot, target = hollow ring). Click any handle to enter reconnect mode; move the mouse to live-preview the new route, then click to finalize. Endpoint handles are always visible above node icons.

### Canvas and navigation

- **Right-click to pan** — Right-click drag pans the canvas; release to resume the active tool.
- **Default zoom 65%** — Opens with breathing room. (Reduced from 75%.)
- **2D canvas mode** — Toggle between isometric and flat 2D from the ToolMenu. Each mode uses the same node/connector model; switching auto-fits the diagram to the viewport. Backed by a `CoordinateTransformStrategy` pattern (ISO and Cartesian2D strategies, each implementing `toScreen` / `fromScreen` / `gridTileUrl`) so the rest of the renderer is mode-agnostic.
  - **2D fidelity fixes** — In 2D mode, rectangle resize handles align to the actual square corners, transform anchors render upright, and flat (non-isometric) icons render upright at the tile center instead of being projected through the iso CSS matrix. AWS / GCP / Azure / K8s / MUI artwork now reads correctly in 2D.
- **Layers** — Each view has an independent layer stack. Layers control visibility and lock state for all element types (nodes, connectors, rectangles, text boxes). Elements can be assigned to layers; unassigned elements are always visible and interactive. Layer order is draggable.

### File management

- **File explorer** — VS Code-style collapsible left panel (280 px, `react-arborist`) listing all diagrams and folders. Inline create and rename via a `__pending__` node, drag-and-drop with collision detection, duplicate, hard delete with a confirmation dialog. Auto-sorted (folders alphabetically, then diagrams alphabetically) at every depth. Dirty indicators on individual nodes and on ancestor folders. Right-click for context actions including **Copy share link** (server mode only) and per-diagram **Export as image / Export as JSON / Export as compact JSON**. Opens by default on first server-mode session. Overlays the canvas (does not resize it) so toggling panels never jolts the diagram. See [ADR 0005](docs/adr/0005-toolbar-and-dock-layout-contract.md).
- **Empty state screen** — Full canvas replacement (ISO grid background + welcome card) shown when server storage is available and no diagram is open. Drives users to create or open from the file explorer instead of dropping them on a blank canvas.
- **Pluggable storage** — All diagram and folder operations go through a `StorageManager` that delegates to the active `StorageProvider`. The shipped local provider uses the backend when reachable and falls back to `sessionStorage`. Google Drive provider is wired in as a stub for future client-side implementation.
- **Save / Save As** — Save directly to a named file. Save As always prompts for a new name and creates a new file.
- **Diagrams panel** — Browse, load, and delete all saved diagrams from a single panel. Share any diagram as a read-only link (server mode).
- **Save status indicator** — Shows when the diagram was last saved and whether there are unsaved changes. Displayed in the toolbar right section as `Saved at HH:MM`, `Saved yesterday at HH:MM`, or `Saved Mon DD at HH:MM` for older diagrams. A `•` dot appears when there are pending changes. No auto-save in server mode — only explicit Save updates the timestamp.
- **Save confirmation toast** — A brief `✓ [Name] saved` notification slides up from the bottom on every explicit save.
- **Share link** — Generates a read-only URL for the current diagram (requires server storage; hidden in session mode).
- **New diagram with unsaved-changes guard** — File explorer "New diagram" clears the canvas. Pending edits trigger a three-button dialog: *Save & continue* (autosaves to `localStorage`, falls back to a JSON download), *Discard changes*, or *Cancel*. Tab-close also shows a native browser warning when there are unsaved edits (in session mode, the prompt is gated by `sessionWorkUnexported`).
- **Diagram name always in sync** — The toolbar name tracks the active diagram correctly across all flows: Save, Save As, Load (session and server), New Diagram, and file Open via the library's own menu.
- **Compact diagram format** — Diagrams exported in ultra-compact LLM-friendly format (`{"t":…,"i":…,"v":…,"_":{"f":"compact","v":"1.0"}}`) are fully supported when loading via the Diagrams panel or file Open. The format is auto-detected and expanded before rendering; names come from the storage listing or the embedded `t` field — never lost on round-trip.

### Workspace bundles & session storage

- **Project zip — Import / Export** — Export the entire workspace (or a single folder, or a single diagram) as a `.zip` containing a manifest, one JSON per diagram, and the tree-manifest. Re-import anywhere — the importer rewrites all IDs, updates cross-diagram link refs, and offers three destinations: *At the top — keep the original folder layout*, *Inside a new folder*, or *Replace all existing folders and diagrams* (typed-confirm gated). Format is human-inspectable: unzip and read. See [ADR 0001](docs/adr/0001-project-zip-format.md).
- **Lean icon save** — Default-catalog icons are stripped from every save (session, server, exports) and rehydrated on load. Custom icons and overrides are preserved verbatim. Diagrams are now materially smaller — the bundled icon catalog can be larger than a small diagram itself. See [ADR 0003](docs/adr/0003-session-storage-lean-icon-save.md).
- **`requiredPacks` field** — Lean saves persist the list of icon packs (AWS / GCP / Azure / K8s / Material) the diagram references. Importers auto-load the right packs before merging the catalog, so AWS icons render on first paint after a re-import.
- **Session storage gauge** — File-explorer header shows a chip leading with `%` (e.g. `<1% · 3.6 KB`); click for a per-diagram size table. Color thresholds at 60 / 90 %. Tooltip carries the full `X% used (size of ~limit)`.
- **Session-mode banner** — Persistent dismissable warning when storage resolves to session and the workspace has content.
- **Session-mode autosave** — Session work is auto-saved within the tab and survives reloads; the toolbar Save button is a manual flush for peace of mind. The browser-native dirty prompt fires only when there's session work that has not been exported to a file.

### Performance

**Idle / editing (85-node / 54-connector diagram):**

| Metric | Before | After |
|--------|--------|-------|
| Idle FPS | 5–18 fps | 60 fps |
| FPS during editing | 5–18 fps | 48–60 fps |
| Long tasks at session start | ~195 | ~6 |
| Long task rate (idle) | 6.4 / sec | ~0 / sec |
| Long task rate (editing) | 6–10 / sec | ~1.6 / sec |
| Diagram load recovery | Permanently degraded | Recovers to 60 fps within 1 s |

**Paste performance (measured with DiagnosticsOverlay):**

| Scenario | Before (sync paste) | After (async paste) |
|----------|--------------------|--------------------|
| ~113 nodes / 441 connectors | FPS drops to 5, hard freeze | 60 fps maintained, no freeze |
| ~280 nodes / 1132 connectors | Short hard freeze, instant 60 fps recovery | Negligible initial delay, 9 s background routing |
| ~560 nodes / 2264 connectors | 30+ s main-thread block ("page unresponsive") | rAF yields prevent tab kill; routing completes in ~90 batches |

*How it works:* The async path dequeues A* pathfinding out of the paste transaction into `requestAnimationFrame` batches of 25 connectors each. Each connector appears routed as its batch completes. The browser stays responsive between batches, eliminating the main-thread block that triggered Chrome's "page is unresponsive" dialog. A* results are cached (LRU, 2 000 entries) so repeated paste of the same topology is instant. For the "1k node" edge case the routing window is still noticeable (~9 s), but the tab stays alive and a progress toast counts completion percentage.

### Internationalisation (i18n)

- **13 languages** — English (default), Chinese Simplified, German, French, Spanish, Italian, Portuguese (Brazil), Polish, Turkish, Russian, Hindi, Indonesian, Bengali.
- Language selector in the toolbar shows the active language name and switches instantly without reload.
- All UI text localised: toolbar buttons, save-status timestamps, Save As dialog, Share popover, Diagrams Manager, tool tooltips, icon selector search, QuickIconSelector help text, node panel tabs, zoom controls, export image dialog, settings panels, connector/lasso hint tooltips, and all alert/confirmation strings.

### Panels

- **Left strip + panels (File Explorer / Elements / Layers / Settings)** — 40 px icon strip on the left edge with three regions: Navigation (📁 File Explorer), Working (⊞ Elements / ≣ Layers — mutex pair), and a System anchor at the bottom (⚙ Settings). Clicking 📁 opens the 280 px File Explorer to its right; clicking ⊞ opens the 240 px Elements panel (icon search and drag-to-canvas, Rectangle shape, Connector tool, "More icons" loaders, Import Icons); clicking ≣ opens Layers. All left-side panels overlay the canvas (do not resize it) and snap in/out without animation. File Explorer + one working panel can be open simultaneously. Click the active icon again to close. See [ADR 0005](docs/adr/0005-toolbar-and-dock-layout-contract.md).
- **Right panel (Properties)** — 300 px panel on the right edge, toggled by a button in the top-right corner. Shows the Details / Style / Notes tabs for the selected item. Slides in/out without resizing the canvas.
- **Icon drag-to-canvas** — Dragging an icon from the Elements panel shows a ghost icon following the cursor across the isometric grid until you drop it at the target tile.

### Quality-of-life

- **Notification system** — Native `alert()` calls replaced with a stack of dismissible MUI snackbars (max 3 visible, FIFO queue). A `ConfirmDialog` returns a promise from a destructive-action confirmation.
- **Material Icons pack** — ~2,179 Material Design icons available as a loadable pack alongside AWS, GCP, Azure, and Kubernetes. Generated at prebuild time. Large packs (>100 icons) render a 60-icon preview to keep section expansion fast; the full set is searchable.
- **On-demand icon packs** — AWS, GCP, Azure, Kubernetes, and Material packs are not loaded at startup. The Elements panel shows a "More icons" section listing each unloaded pack; clicking one loads it on the spot. Opening a diagram that references a pack triggers auto-loading silently via `requiredPacks`.
- **Help dialog (`F1` / `?`)** documents all keyboard shortcuts.
- **Burger menu removed** from the app chrome. Open / Export / Clear actions live in the file explorer; **Settings** moved to the left strip ⚙; GitHub link + version moved into Settings → **About** tab; **Diagnostics** tab in Settings exposes the debug-overlay toggle and model / session JSON dumps. See [ADR 0005](docs/adr/0005-toolbar-and-dock-layout-contract.md).
- **Default new-view name** — `"Page 1"` (was `"Untitled view"`).
- **Sentence case across all property panels** — Section primitive enforces caption + semibold + secondary-color titles; ALL CAPS legacy retired. See [docs/ux-principles.md](docs/ux-principles.md) for the design language driving this and other panel-consistency rules.
- **Enter-to-confirm on dialogs** — `ConfirmDialog` returns on Enter, cancels on Escape, in every destructive-action prompt.

---

## Deployment targets

FossFLOW runs from a single codebase on three targets, sharing one `/api/*` HTTP contract:

| Target | Runtime | Storage | Auth options |
|---|---|---|---|
| **Local dev** | `npm run dev` (rsbuild on :3000 + Express on :3001) | Filesystem if `ENABLE_SERVER_STORAGE=true`, else session | `none`, `shared-token` |
| **Docker** | nginx + Express on Node | Filesystem volume | `none`, `shared-token` |
| **Cloudflare Pages** | Pages Functions (Hono) | **None — session/localStorage only (PoC)** | `none`, `shared-token`, `cf-access` |

The frontend bundle is identical across all three. Runtime config (`GET /api/config`) replaces build-time env injection. The Cloudflare deployment is currently storage-less; persistent storage on Cloudflare will return via the Drive provider on a separate branch.

For the from-scratch deploy walkthrough, see [docs/deployment.md](docs/deployment.md). For the architectural decisions behind the multi-target design, see [flare_plan.md](flare_plan.md).

---

## Quick start (Docker)

Requires [Docker Desktop](https://www.docker.com/get-started/) and [Git](https://git-scm.com/downloads). No Node.js needed.

```bash
git clone https://github.com/molikas/FossFLOW_V2.git
cd FossFLOW_V2
docker compose -f compose.dev.yml up --build   # first run — takes 3–5 min
```

Open **http://localhost:3000**. Subsequent starts omit `--build`.

To stop: `Ctrl+C`, or `docker compose -f compose.dev.yml down` from another terminal. Diagrams are saved to a `diagrams/` folder in the project directory.

For local development without Docker, or for Cloudflare deploys, see [docs/deployment.md](docs/deployment.md).

---

## Architecture & docs

- [docs/architecture.md](docs/architecture.md) — feature inventory, store/reducer/mode architecture, test audit, gap analysis.
- [docs/deployment.md](docs/deployment.md) — local / Docker / Cloudflare deploy walkthroughs.
- [docs/testing.md](docs/testing.md) — regression suite reference (~729 tests, 72 suites).
- [docs/adr/](docs/adr/) — architectural decision records (project zip format, icon catalog merge, lean save).
- [PLAN.md](PLAN.md) — strategic phased roadmap (Phases 0A → 4A).
- [flare_plan.md](flare_plan.md) — Cloudflare + Docker deployment plan (Phase 5*).
- [CHANGELOG.md](CHANGELOG.md) — fork-only changelog (Keep a Changelog format).
- [docs/upstream-changelog.md](docs/upstream-changelog.md) — pre-fork upstream history (preserved for traceability).

---

## Code coverage

```bash
npm test --workspace=packages/fossflow-lib -- --coverage
```

HTML report: `packages/fossflow-lib/coverage/lcov-report/index.html`. Current global statement coverage ~32%. Thresholds set at 10% global minimum — intentionally low while the suite grows. Additional static analysis tools (ESLint, Knip, `npm audit`) output to `reports/`.

---

## Issues and feedback

Bug reports and feature requests are welcome at [github.com/molikas/FossFLOW_V2/issues](https://github.com/molikas/FossFLOW_V2/issues). Use the **Bug report** or **Feature request** templates.

**Code pull requests are not accepted** — this is a personal fork. If you want to build on top, fork it.

---

## License

See [LICENSE](LICENSE).
