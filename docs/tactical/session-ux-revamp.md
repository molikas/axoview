# Tactical — Session-Mode UX Revamp

> **Read first:**
> - [ADR 0001 — Project Zip Format](../adr/0001-project-zip-format.md)
> - [ADR 0002 — Icon Catalog Merge on Load](../adr/0002-icon-catalog-merge-on-load.md)
> - [ADR 0003 — Lean Icon Save](../adr/0003-session-storage-lean-icon-save.md)
>
> **Status:** Implementation complete; manual smoke + a few bug-fix passes done · **Owner:** Igor · **Last updated:** 2026-05-01
>
> This is a **short-lived working doc.** Delete it after the work merges; ADRs are the durable record. PLAN.md gets a one-line entry referencing the ADRs once shipped — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read each linked ADR.
3. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
4. Use `TodoWrite` to track sub-tasks below.
5. Mark `[x]` as work completes.
6. On completion, follow the "Wrap-up" section to update PLAN.md with a single line.

## Goal

Make session-storage mode feel like a first-class workspace, not a degraded fallback. Specifically:

- Session work is auto-saved and visibly persistent within the tab.
- The user can see how much storage they have left and which diagrams are using it.
- The user can export the entire workspace as one file and re-import it anywhere.
- The burger menu stops competing with the file explorer for "open / export / clear" — those move into the explorer where they belong.

This is a UX consistency pass, not a new feature surface. Server-mode behavior is unchanged except where explicitly noted.

## Scope

### In scope

- Burger menu (`MainMenu.tsx`) trim to **Settings · GitHub · Version** only.
- Toolbar (`AppToolbar.tsx`) — remove the [Ctrl+O] folder icon (duplicate of file-explorer toggle).
- File-explorer toolbar — add **Import** and **Export project** buttons.
- Per-diagram and per-folder context-menu **Export…** entries (`ContextMenuItems.tsx`).
- New unified **`ExportDialog`** (scope × format).
- New **`ImportDialog`** (single JSON or project zip with destination picker).
- New **session-mode badge + storage gauge** in the file-explorer header.
- New session-mode persistent banner (first time entering session with content).
- Browser-native dirty prompt (`beforeunload`) wired with session-mode dirty semantics.
- Lean icon save (ADR 0003) + load-time merge (ADR 0002) in `useInitialDataManager` and a new `utils/leanSave.ts`.
- Image export available in session mode (drop the server-required gate).
- Unit tests for ADR 0002 and ADR 0003 acceptance criteria.

### Out of scope

- Anything in `PLAN.md` Phases 3A / 3B / 3C / 4A (Google Auth, Drive, S3, Registry).
- Anything in `flare_plan.md` (Cloudflare deployment).
- Share-link / preview routes — untouched.
- Modifying `PLAN.md` phase content (only the one-line wrap-up entry at the end).
- E2E tests — deferred per `project_implementation_plan` memory.
- Streaming export, paginated import, multi-tab session sync — explicitly deferred.

## Locked decisions (from design discussion 2026-04-30)

| # | Decision |
|---|---|
| 1 | Session-mode `dirty` = "session has work that has not been exported to a file." Clears only on successful project-zip export. Server-mode `dirty` is unchanged ("model differs from server"). |
| 2 | Custom icons in project zip are embedded as base64 inside `diagrams/<id>.json`. No separate `images/` folder at v1. |
| 3 | Lean icon save applies to **all** write paths (session, server, exports). See ADR 0003. |
| 4 | Session-mode keeps the toolbar **Save** button. Auto-save still runs; the button is a manual flush for user peace of mind. |
| 5 | Project zip import **always** generates fresh IDs and rewrites intra-zip references. Destination picker: Merge into root / New folder / Replace all. "Replace all" requires typed confirmation (`replace`). |
| 6 | Image export works in session mode — drop the `serverStorageAvailable` gate from the export-image path. |
| 7 | Storage gauge in file-explorer header. Click → popover with per-diagram size table (name, size, last modified, quick-delete), sorted by size desc. |
| 8 | "Clear the canvas" burger-menu item is **deleted** entirely. No replacement. |
| 9 | Tree manifest (`tree-manifest.json`) is **included** in project zips. |
| 10 | Session-mode banner appears when storage resolves to session AND ≥1 diagram exists. Dismissable per session only (not persistently — the warning is the point). |

## Sub-tasks

### A. Foundation — lean save / load merge (ADRs 0002, 0003)

- [x] Create `packages/fossflow-lib/src/utils/leanSave.ts` exporting `stripDefaultIcons(model)` per ADR 0003 strip rule.
- [x] Memoize `bundledFixtures.byId` from `packages/fossflow-lib/src/fixtures/icons.ts`.
- [x] In `useInitialDataManager.load`, merge `bundledFixtures` into `modelData.icons` before writing to the store (ADR 0002).
- [x] Wire `stripDefaultIcons` into:
  - [x] `LocalStorageProvider.sessionSaveDiagram`
  - [x] Server `PUT /api/diagrams/:id` callers in the app (strip client-side before send)
  - [x] `exportAsJSON` and `exportAsCompactJSON` in `packages/fossflow-lib/src/utils/exportOptions.ts`
- [x] Unit tests:
  - [x] ADR 0002 — load with empty `icons[]` → store has full catalog.
  - [x] ADR 0002 — custom icon survives, override beats fixture.
  - [x] ADR 0003 — strip drops pure duplicates, preserves custom + overrides.
  - [x] Round-trip — strip-then-merge equals identity for any model.

### B. Project zip — read/write (ADR 0001)

- [x] Add `jszip` to `packages/fossflow-app/package.json`.
- [x] Create `packages/fossflow-app/src/services/project/projectZip.ts` with:
  - [x] `exportProject(opts: { scope: 'project'|'folder'|'diagram', folderId?, diagramId? }): Promise<Blob>`
  - [x] `parseProject(file: File): Promise<ParsedProject>` — validates manifest, returns folders/diagrams in normalized form, **before** any state mutation.
  - [x] `importProject(parsed: ParsedProject, opts: { destination: 'root'|'newFolder'|'replaceAll', newFolderName?: string }): Promise<void>` — performs ID rewrite + cross-reference update + storage writes.
- [x] Helper `rewriteIds(parsed) -> { parsed', idMap }` that handles folders, diagrams, and any cross-diagram link refs in the model.
- [x] Unit tests under `packages/fossflow-app/src/services/project/__tests__/` cover round-trip, replace-all confirmation, malformed zip, and unknown version.

### C. UI — file explorer surface

- [x] `FileTreeToolbar.tsx`: Import + Export-project buttons added.
- [x] `FileExplorer.tsx` header: session chip + clickable storage gauge.
- [x] New component `SessionStorageGauge.tsx` with breakdown popover.
- [x] `ContextMenuItems.tsx`: per-diagram and per-folder `Export…` entries.

### D. UI — dialogs

- [x] `ExportDialog.tsx`: scope × format with invalid-combo gating.
- [x] `ImportDialog.tsx`: `.json` + `.zip`, destination picker, typed-confirm replace-all, single Confirm gate.

### E. UI — toolbar / burger menu / banner

- [x] `AppToolbar.tsx`: folder icon removed; Save wired through `flushAutoSave()` in session mode.
- [x] `MainMenu.tsx`: trimmed to Settings · GitHub · Version.
- [x] New component `SessionModeBanner.tsx` with dismiss-per-session behaviour.

### F. Dirty semantics + unload prompt

> **Implementation note:** the existing `hasUnsavedChanges` is consumed by 11 call sites across `DiagramLifecycleProvider.tsx`, `AppToolbar.tsx`, and `useFileTree.ts`. Every one of them asks "is the current model out of sync with its save target?" — that meaning is correct in both modes and **must not change**. Do **not** rename, split, or repurpose `hasUnsavedChanges`. Add a new, independent flag for the unload-prompt concern instead.

- [x] In `DiagramLifecycleProvider`, `hasUnsavedChanges` is untouched. New `sessionWorkUnexported` flag added with the rules above.
- [x] `beforeunload` listener wired with mode-specific gating.
- [x] All existing `hasUnsavedChanges` consumers behave unchanged.

### G. Image export — drop server gate

- [x] Image export available with `serverStorageAvailable=false`. No server endpoint dependency in the export-image path.

### H. Tests

- [x] Unit tests from sections A and B pass (`leanSave.test.ts`, `services/project/__tests__/`).
- [x] Manual smoke checks completed for the items above.

### I. Polish on top of scope (added during shake-out, 2026-05-01)

These small fixes shipped together with the revamp branch. They were not in the original locked decisions but were caught during smoke-test sessions; documenting here so the commit is self-explanatory.

- [x] **Default view name** — `VIEW_DEFAULTS.name` in [packages/fossflow-lib/src/config.ts](../../packages/fossflow-lib/src/config.ts) changed from `"Untitled view"` to `"Page 1"`. New diagrams now read more naturally on first open.
- [x] **Phantom catalog stubs removed** — [packages/fossflow-lib/src/fixtures/icons.ts](../../packages/fossflow-lib/src/fixtures/icons.ts) shipped two leftover `Icon1`/`Icon2` URL stubs pointing at `isoflow.io`. Set the array to `[]`. The real catalog comes from `@isoflow/isopacks` injected at app level — see ADR 0002 update for why this remains contract-compliant.
- [x] **Inline rename on canvas** — F2 with a node or text-box selected, or double-click on its label, enters inline-edit on the canvas itself (not focusing the side-panel input).
  - [packages/fossflow-lib/src/interaction/useInteractionManager.ts](../../packages/fossflow-lib/src/interaction/useInteractionManager.ts) handles F2 for `ITEM` and `TEXTBOX` selections, dispatching a `inlineEditNodeName` `CustomEvent` with the id.
  - [packages/fossflow-lib/src/components/SceneLayers/Nodes/Node/Node.tsx](../../packages/fossflow-lib/src/components/SceneLayers/Nodes/Node/Node.tsx) and [.../TextBoxes/TextBox.tsx](../../packages/fossflow-lib/src/components/SceneLayers/TextBoxes/TextBox.tsx) listen for the event by id and render a contentEditable Typography (auto-grows rightward, wraps at maxWidth — matches the smooth UX of typing into the side-panel input).
  - Commit on Enter / blur via `useScene().updateModelItem` / `updateTextBox`. Escape cancels.
- [x] **File-tree rename via F2 + context menu** — works against `treeRef.current.edit(id)`. Double-click rename in the tree does **not** work; tracked in [known_issues.md](../../known_issues.md) with workaround.

## Wrap-up

When all sub-tasks are complete and the smoke checklist passes:

1. Add a single line under `PLAN.md` Phase 2B-R section (or wherever the index lives):
   ```
   - Session-mode UX revamp (storage gauge, project zip, lean save) shipped — see docs/adr/0001..0003 and (this file's git history).
   ```
2. Delete this file. The ADRs are the durable record; this checklist's job is done.
3. Update memory pointer `project_2br_decisions.md` if any decisions here supersede or extend it.

## Notes for Claude

- This work touches **two packages** (`fossflow-app` and `fossflow-lib`) and both must build. After every section, run a build to catch type drift early.
- The merge contract in ADR 0002 is the load-bearing piece. If you have to make a tradeoff, prioritize ADR 0002's tests passing — they are what prevent the side-dock regression returning.
- Session storage events: there is no native "storage changed for sessionStorage in same tab" event. Dispatch a custom `Event('fossflow-session-changed')` from `LocalStorageProvider` after each session mutation; subscribe in the gauge component.
- Do **not** edit `PLAN.md` phase content during this work. Only the one-line wrap-up entry at the end. PLAN.md is strategic; this is tactical.
- Do **not** edit `flare_plan.md`. Cloudflare is its own track.
