# Known Issues

**Last pruned:** 2026-06-10 (v1.1 close-out). Open items below cross-checked against [technical-review-2026-06.md §11](docs/technical-review-2026-06.md); resolved entries removed (durable records live in the relevant ADR / perf-troubleshooting.md / git history).

## Storage/auth surface: pre-existing strings still hardcoded English (i18n debt)

**Symptom:** The 8e08933 Drive integration shipped with its entire UI hardcoded in English. The 2026-07-06 storage-ux-unification push i18n'd every string it **introduced or rewrote** (avatar menu, place sections, migration dialog, empty-state sign-in card, banner actions, Move-to-Drive — 37 keys × 13 locales), and the 2026-07-07 PR-59 review fixes swept in the delete-confirmation dialog + `DriveRootFolderDialog` (19 more keys × 13 locales). Still literal: most `ContextMenuItems` labels (Open/Rename/Duplicate/Delete/…), the name-collision dialog body, the FileExplorer/App toast messages, `ExportProjectZipDialog`, and the `authStore` expired/cancelled toasts (that store can't import the i18n singleton without dragging http-backend init into unit suites — needs a small notification-key indirection).

**Workaround:** None at the locale level; affected strings render in English in all locales.

**Status:** Open, deferred. Sweep them into `i18n/*.json` as those surfaces are next touched; the authStore case needs the notification store to accept keys instead of literals.

## Partial-coverage i18n locales (de-DE + id-ID)

**Symptom:** German (de-DE) and Indonesian (id-ID) have stub translations covering only the initial pre-rename string set. Newer strings (added since 2026-04) fall through to English. Users selecting these locales see mixed German/English or Indonesian/English UI.

**Workaround:** None at the locale level. Switch back to English (en-US) for a fully translated experience, or to one of the fully-covered locales (zh-CN, es-ES, pt-BR, fr-FR, hi-IN, bn-BD, ru-RU, it-IT, tr-TR).

**Status:** Open, deferred. Resolve when translators refresh those locales. Not a productization-blocker — locale switching itself works correctly; the stubs were preserved (rather than dropped from `supportedLanguages`) so the existing user choice keeps working. Filed alongside B-13 closure (productization audit Section 5).

## MUI menu close logs "Blocked aria-hidden on an element because its descendant retained focus"

**Symptom:** Closing the account menu (and occasionally the file-tree context menu) logs Chrome's aria-hidden warning: MUI's Modal marks the closing Popover/root `aria-hidden` while focus is still inside the menu list or on the trigger IconButton. Console noise + a real (minor) a11y nit; no functional impact. Surfaced during the 2026-07-06 storage-ux live test.

**Workaround:** None needed — purely console/AT noise.

**Status:** Open, deferred. Likely fix: blur the active element before closing (or move to the `inert` attribute pattern Chrome suggests) in the shared menu-close paths; sweep AuthControl + FileExplorer context menu together.

## DevTools flags a blocked `eval` CSP issue on the deployed app (benign)

**Symptom:** Chrome's Issues panel reports "Content Security Policy of your site blocks the use of 'eval' in JavaScript" attributed to a bundle chunk (seen as `426.*.js` on the 2026-07-06 integration deploy). Audited the full production build: the app bundle contains **no functional `eval`** — every occurrence is a guarded feature probe (lodash/webpack-runtime `Function("return this")` globalThis shims, short-circuited in any browser that has `globalThis`; core-js's `Function('return require(...)')` probe behind an is-node gate; all in try/catch). The block has zero runtime impact — each probe falls back cleanly. Unrelated to the Drive 403s seen the same day (those are server-side responses).

**Workaround:** None needed. Do NOT add `'unsafe-eval'` to `script-src` — the strict CSP is deliberate (2026-07-05 hardening).

**Status:** Open, deferred as console noise. Revisit only if a feature visibly breaks with a matching CSP error in the Console (not Issues) tab.

## Google Drive place is online-only — no offline write queue

**Symptom:** Drive writes (autosave, create, move) require a live connection and a valid token. Offline, a Drive-place save fails after the retry/backoff run (500/1000/2000 ms) and surfaces the ADR 0011 failure dialog; there is no queue that replays the write when connectivity returns.

**Workaround:** Keep working — the in-memory scene is intact; retry the save (or export a zip) once back online. Session-place work is unaffected.

**Status:** Open, deferred (owner 2026-07-05, re-affirmed at the 2026-07-06 Drive wrap). Design sketch lives in ADR 0036's deferred list: an IndexedDB-backed write queue with replay + conflict detection. Referenced from PLAN.md Phase 3B.

## Move-to-Drive is one-way — no reverse move (Drive → session)

**Symptom:** The file tree offers "Move to Google Drive" for session diagrams, but no counterpart that moves a Drive diagram back into the browser session; the context menu on Drive rows has no such action.

**Workaround:** Open the Drive diagram, then Export → JSON and re-import into the session place (loses folder placement).

**Status:** Open, deferred at the 2026-07-06 Drive wrap (owner call: no demonstrated need — the session place is the downgrade path, not a destination). Revisit if users ask for it; the transfer machinery ([driveTransfer.ts](packages/axoview-app/src/services/storage/driveTransfer.ts)) is direction-agnostic in shape.

## No Google Picker integration — Drive files created outside the app's folder are invisible

**Symptom:** With the `drive.file` scope, the app sees only files it created. A diagram JSON placed in Drive by other means (manual upload, another app) never appears in the tree; there is no Picker flow to grant the app access to it.

**Workaround:** Download the file and use Import — the imported copy lands in the app's Drive folder and is visible thereafter.

**Status:** Open, deferred at the 2026-07-06 Drive wrap. The fix is the Google Picker API (its grant extends `drive.file` visibility per-file); revisit with the worker code-flow slice since both touch the OAuth surface.

## Deleting the Drive root folder mid-session is not detected

**Symptom:** The provider caches the discovered root folder id in memory (and localStorage) and never revalidates it during a session. If the user trashes the root folder in Drive's own UI while the app is open, `isAvailable()` still reports true (it only checks auth) and autosaves keep patching files that now sit in the trash; the loss surfaces only on the next full listing or reload (ADR 0036 §2 promises detection that is not yet implemented).

**Workaround:** Restore the folder from Drive's trash — the marker travels with it, and the next reload re-discovers it. Don't delete the root while the app is open.

**Status:** Open, catalogued 2026-07-07 (PR-59 review). Cheap fix direction: on a listing that returns zero files OR any 404 against the cached root, invalidate the cache and re-run marker discovery before concluding the place is empty.

## Boot silent reconnect needs a popup (gesture-retry stopgap; worker code-flow is the real fix)

**Symptom:** GIS's implicit-flow token client mints every token through a self-closing popup, and a boot-time silent reconnect carries no user activation — default popup blockers refuse it (`popup_failed_to_open`, confirmed live 2026-07-06). Remembered users therefore land signed-out on reload until their first gesture.

**Workaround (shipped, ADR 0035 §3 Amendment 2):** one-shot gesture-armed retry — the first pointer/key gesture re-runs the silent attempt inside user activation; the popup opens and self-closes in a blink. Allowing popups for the site removes even the blink.

**Status:** Open, catalogued pre-master-quality slice (owner pick 2026-07-06: "gesture retry now, code-flow later"). Definitive fix: **worker authorization-code flow** — `GOOGLE_CLIENT_SECRET` as a wrangler secret (server-side only), `/api/google/oauth/callback` + `/api/google/token` routes, refresh token in an HttpOnly encrypted cookie, Express parity per ADR 0009 §5, SPA off the implicit flow. Kills the popup entirely and survives reloads for months; worker stays storage-less.

## PWA install card is plain (cosmetic; install still works)

**Symptom:** Chrome's richer install card requires `form_factor: "wide"` + mobile screenshots in [manifest.json](packages/axoview-app/public/manifest.json); safe-zone-padded maskable icons (192×192 + 512×512) would also polish the installed app's home-screen presence. All three are cosmetic — install still works with the current manifest, and the deprecated combined `"any maskable"` purpose flag was already cleaned up in B-8 commit `f38d0b4`.

**Workaround:** None needed. PWA install proceeds normally; just shows a plain card.

**Status:** Open, deferred. Resolve when there's a marketing push for PWA installs. Filed alongside B-8 closure (productization audit Section 5).

## Preview-mode passive badge does not cover all clickable nodes

**Symptom:** In `EXPLORABLE_READONLY`, a node is clickable (opens the readOnly details panel) when it has any of: `link`, `headerLink`, `description`, or `notes`. But the passive visual indicators currently only cover two of these:

- Bottom-right OpenInNew badge → only when `link` is set
- Top-right blue dot → only when `notes` has visible content
- Nothing for `headerLink`-only or `description`-only nodes

The pointing-finger cursor on hover (added 2026-05-15) does cover all four cases, so the affordance is discoverable on hover — but at-a-glance scanning misses headerLink/description nodes.

**Workaround:** None. Users can still hover and click to discover the panel.

**Status:** Open. Decide on a unified badge story — either extend the existing badges to cover the missing cases, or replace both with one consolidated "more info" indicator that fires for any of the four content types.

## Canvas node renderer: notes/link badges + connectors not drawn for unselected nodes (ADR 0019)

**Symptom:** With the Canvas2D node layer now the default renderer (ADR 0019), two visuals
are not yet painted on the canvas for nodes at rest:

- **Notes/link badges** (the top-right blue dot for `notes`, the bottom-right OpenInNew
  badge for `link` in preview mode). They reappear as soon as a node is **selected or
  dragged** (it renders via the DOM `<Node>` overlay), so the affordance is not lost on
  interaction — only on at-a-glance scanning of unselected nodes. (Compounds the existing
  "Preview-mode passive badge does not cover all clickable nodes" entry above.)
- **Connectors** still render on the existing DOM/SVG layer, not the canvas. This is
  correct and intentional (Iter-7 proved connectors carry no spawn-cost prize and are
  rAF-batched on paste); listed here only so the canvas-vs-DOM split is documented.

**Workaround:** None needed for connectors. For badges: select/hover the node to see them.

**Status:** Open, deferred (T2 productization follow-ups). Badges need a screenshot-driven
placement pass to anchor them accurately on the iso-skewed canvas icon; folding connectors
onto the canvas would first need the perf harness to route connectors on spawn. Neither
blocks the T2 render-substrate win. Tracked in
[ADR 0019 implementation addendum](docs/adr/0019-canvas2d-node-render-layer.md).

## MQA diag exporter: element counts always read 0 — FIXED

**Symptom (historical):** The perf-diag JSON exporter recorded `ni: 0, nc: 0, ntb: 0` on every snapshot regardless of scene size, breaking the FPS-vs-complexity correlation it was meant to enable.

**Status:** **FIXED 2026-06-24.** Root cause: `DiagnosticsOverlay.getSceneCounts()` reads the lib store bridge `window.__axoview__`, which `Axoview.tsx` gated behind `enableDebugTools || NODE_ENV !== 'production'` — so in the production Docker build (where the overlay actually runs for users) the bridge was absent and the counts short-circuited to `{0,0,0}`. Fix: a dedicated `exposeStoreBridge` prop on `<Axoview>` (separate from `enableDebugTools`, so it does NOT surface the in-canvas SizeIndicator), wired in the app to the perf-monitoring toggle (`diagnosticsStore`). Enabling monitoring now also exposes the read-only bridge and the counts populate (verified in a Docker capture: `54/37/20`). Dev builds expose it unconditionally as before.

## Page tabs: hard cap of 5, no overflow-scroll UX

**Symptom:** The ViewTabs strip ([`ViewTabs.tsx`](packages/axoview-lib/src/components/ViewTabs/ViewTabs.tsx)) renders all pages inline with no horizontal scroll, overflow indicator, or dropdown. Beyond ~15 pages the tabs grow past the viewport and the right-most ones become unreachable.

**Workaround:** Hard cap installed at `MAX_PAGES = 5`. The "+" button disables with a "Page limit reached (5)" tooltip beyond the cap. Sufficient for current usage; lifts trivially once a proper overflow UX exists.

**Status:** Open. Proper redesign deferred — needs a real overflow story (horizontal scroll + chevrons, dropdown-with-search, or pinned + drawer) before raising the cap. Filed for a future ViewTabs refresh.

## leanSave test: `bundledFixtures[0]` undefined — STALE ENTRY, suite green

**Status:** **Closed as stale 2026-07-05** (technical-review-2026-07 audit). The lib suite is fully green (145 suites / 1,481 passing) with [`leanSave.test.ts`](packages/axoview-lib/src/utils/__tests__/leanSave.test.ts) running — its assertions tolerate the (still deliberately empty) [`fixtures/icons.ts`](packages/axoview-lib/src/fixtures/icons.ts). No skip or failure matching this entry exists anymore. The suite's **single standing skip** is a different, environment-shaped one: [`coordinateTransforms.test.ts:361`](packages/axoview-lib/src/utils/__tests__/coordinateTransforms.test.ts#L361) ("strategies have different gridTileUrls") is skipped because SVG imports are string-mocked under jsdom, so the two strategies' URLs are indistinguishable in the test env — deliberate, not debt.


## File tree: double-click on a diagram does not enter rename mode

**Symptom:** Double-clicking a diagram row in the file tree does not enter inline rename mode.

**Workaround:** Select the diagram and press `F2`, or use the right-click context menu → Rename.

**Status:** Open. Rename via F2 and the context menu both work; only the double-click affordance is missing.

## Imported icons are scoped per-diagram, not per-project

**Symptom:** An icon imported while diagram A is open is not visible in the Elements panel when diagram B is open. Each diagram persists its own copy of every imported icon it places, so the same SVG can end up duplicated across N diagram blobs in storage. Deleting an imported icon removes it from the current diagram only — other diagrams that reference it keep their independent copies and continue rendering it (no tombstone there) until they're separately edited.

**Workaround:** Re-import the icon into each diagram that needs it. Or, on rare occasion, export → re-import a project zip; the round-trip carries icons across.

**Status:** Open, deferred. The MQA #26 delete + tombstone work (shipped 2026-05-18) is layered on top of the existing per-diagram `model.icons` contract — fixing the scope is a separate, larger piece of work than the delete UX. Considered and explicitly deferred during the MQA #26 session in favour of shipping the user-visible delete affordance first.

### Why this is not a one-day fix

The icon catalog conflates two concerns (see [ADR-0002](docs/adr/0002-icon-catalog-merge-on-load.md)): the side-dock catalog and the per-diagram persistence shape. Moving imports to project scope requires changes across:

| Layer | What changes |
|---|---|
| `StorageProvider` ([`types.ts`](packages/axoview-app/src/services/storage/types.ts)) | New `getProjectIcons()` / `saveProjectIcons()` API. `LocalStorageProvider` gets a new key; `GoogleDriveProvider` stays stubbed. |
| Migration | One-shot scan across every existing diagram to hoist `collection === 'imported'` icons into the project store. Idempotent + versioned flag. |
| Lib injection ([`Axoview.tsx`](packages/axoview-lib/src/Axoview.tsx), [`uiStateStore.tsx`](packages/axoview-lib/src/stores/uiStateStore.tsx)) | New `projectIcons` + `onProjectIconsChange` props mirroring the `iconPackManager` pattern. |
| [`ElementsPanel.tsx`](packages/axoview-lib/src/components/LeftDock/ElementsPanel.tsx) | Import + delete reroute from `modelActions.set` to the new callback. |
| [`DiagramLifecycleProvider.tsx`](packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx) | ~9 call sites currently filter `data.icons` for `collection === 'imported'` and concat into the diagram's model. All become `[...packIcons, ...projectIcons]` instead. |
| Lean-save ([`leanSave.ts`](packages/axoview-lib/src/utils/leanSave.ts)) | Strip imported icons from per-diagram saves, but **not** from single-diagram JSON exports (which must stay self-contained for the recipient). Needs an explicit `stripProjectIcons` param so each call site is unambiguous. |
| Project zip ([`projectZip.ts`](packages/axoview-app/src/services/project/projectZip.ts)) | Add `project.json` at the zip root carrying the project icon store. Older clients fall back to scanning per-diagram icons during the transition window. |
| ADRs | ADR-0002 lifecycle section + ADR-0003 strip-rule both extend. |

### Behavioural decisions a future implementer must take

1. **Undo for project ops.** Imports + deletes either become non-undoable (project ops are committed immediately — simplest), or get their own project-state history stack (significantly bigger). The MQA #26 delete dialog has a confirm step, so "irreversible after confirm" is defensible; but the contract change must be approved.
2. **`project.json` location in the zip** — root or under `meta/`. Either works; root is simpler.
3. **Single-PR vs phased rollout** — Phase 1 (storage + migration, no strip) is fully reversible and could ship ahead of Phase 2 (ElementsPanel rewire) to validate the migration in production before behavioral changes land. Phase 3 (strip + export adjustments) needs the export paths audited to make sure none accidentally strip on the wrong side.
4. **Public name in the API** — `projectIcons` (clearer scope) vs `importedIcons` (matches the existing `collection: 'imported'` tag).

### Risks

- **Migration partial failure** — mitigated by deferring the per-diagram strip until each diagram is independently saved post-migration (so original blobs stay intact until verified).
- **Race on import-then-switch** — `projectIcons` state propagates async; mitigated by recomputing `model.icons` on every `projectIcons` change via `useEffect` in `DiagramLifecycleProvider`.
- **Lean-save stripping on the wrong path** — exports must keep icons inline. The explicit `stripProjectIcons` boolean per call site is the safety net.
- **Older client reads newer save** — same as the existing ADR-0003 "catalog version drift": items reference ids that are no longer in the diagram's local icons → tombstones. Recoverable, not destructive. Single-user app for the foreseeable future, so rollback hazard is low.

## Undo desync: dual history stacks skew on interleaved model-only + both-store ops (D-7) — FIXED

**Symptom (historical):** Undo/redo are two independent patch stacks (model + scene). A model-only op (place icon, lone-node drag) pushes a model entry but no scene entry, so the stacks skew to different depths. After `draw connector → place icon → Ctrl+Z`, the single undo popped the top of *each* stack — which then belonged to different actions — leaving the connector in `model.views[].connectors` with no `scene.connectors[id]` path = an invisible connector (the MQA #5 symptom, different mechanism).

**Status:** **FIXED 2026-06-14** (commit 1 of the ADR 0018 Pointer-Events branch). Logical-action sequence-stamping ([historySequence.ts](packages/axoview-lib/src/stores/historySequence.ts)): every history entry both stores push is stamped with a shared monotonic sequence allocated once at each logical-action boundary (standalone `set`, `transaction`, `beginDragTransaction`). `useHistory.undo/redo` reverts only the stack(s) whose top carries the most-recent (undo) / least-future (redo) sequence, so one keystroke reverts exactly one logical action across whichever store(s) participated. Guarded by the now-unskipped coherence spec in [undo.dualStackSkew.test.tsx](packages/axoview-lib/src/__perf_refactor_regression__/undo.dualStackSkew.test.tsx) (the skew-source characterization stays green too). The `MAX_HISTORY_SIZE=50` trim-skew sub-case (behavior-map §4.5(a)) is resolved by the same fix.

### Residual follow-ups (NOT covered by the D-7 sequence-stamping fix)

These are distinct mechanisms, not stack-skew, so the sequence-stamping work does not address them. Filed explicitly so they are not lost:

- **D-8 — paste→undo→redo restored empty connector paths — FIXED 2026-06-16 (PR #49, [ADR 0021](docs/adr/0021-paste-algorithmic-perf-and-spatial-index.md) item 7).** Paste records a provisional empty path in the scene history entry (`createConnector(..., skipPathfinding=true)`), and `computePathsAsync` fills the real paths *outside* history (`skipHistory=true`). So paste → `Ctrl+Z` → `Ctrl+Y` re-applied the recorded patch with empty paths → pasted connectors rendered pathless until a later edit touched them. **Fix:** `useHistory.undo/redo` calls a scoped `resyncScene()` that re-routes the active view (`SYNC_SCENE`, written `skipHistory` so it never perturbs either undo/redo stack) — but **only when** an active-view connector actually has a missing/empty (non-`unroutable`) path, so the common model-only undo (e.g. a rename) pays just an O(C) `tiles.length` scan, never a synchronous full re-route at 700+ connectors. Guarded by the `useHistory` unit suites ([useHistory.test.tsx](packages/axoview-lib/src/hooks/__tests__/useHistory.test.tsx) + [useHistory.realStore.test.tsx](packages/axoview-lib/src/hooks/__tests__/useHistory.realStore.test.tsx)).
- **D-9 — cross-view (page-switch) undo applies scene patches to the wrong view.** The scene store holds only the current view but its history stack is global and unscoped; `changeView` rebuilds the scene with `skipHistory=true` and does not clear/scope history. Undoing after a page switch applies the previous view's scene patches to the current view (phantom/stale `scene.connectors[id]`) while the model undo reverts an off-screen view. **Fix sketch:** scope scene history per-view, or clear/snapshot on `changeView`. Larger change; deferred. Code-traced, e2e repro to be added.

## Touch per-item actions (delete / z-order) — RESOLVED via direct manipulation (Option A)

**Resolved 2026-06-14 (B).** Originally D-6 routed touch actions through the Properties panel and kept the NodeActionBar desktop-only, leaving delete + z-order unreachable on a pure touchscreen. The Option A revision (direct manipulation — see ADR 0018) makes **move a drag**, so long-press is no longer overloaded: a long-press on a node fires the OS `contextmenu`, which opens the **NodeActionBar** for the pressed node (delete / z-order / layer / start-connector). It targets the pressed node reliably because the touch pointerdown seeds `uiState.mouse.position`. So all per-item actions are reachable on touch via long-press; name/style/notes/link also remain in the Properties panel (auto-opens on selection), and layers via the LayersPanel.

## Rectangle / textbox drag perf (move + draw + resize) — FIXED (D-3 resolved)

**Fixed 2026-06-14.** Manipulating a rectangle/textbox dropped to ~7 fps with a GC sawtooth (perf-diag capture). `DragItems` moved nodes via the CSS-preview path but routed textbox/rectangle **moves** through `updateRectangle`/`updateTextBox`, and the rectangle **DRAW**/**TRANSFORM** modes did the same per tile — each a full-state immer `produce` **every frame** (and, for draw/resize, no drag transaction → one undo entry per tile).

- **Move:** routed through immer-free `batchUpdateRectangles`/`batchUpdateTextBoxTiles` (one structural array copy, model-only) inside the existing drag transaction → one undo entry.
- **Draw / Resize (D-3, supersedes the earlier deferral):** `DrawRectangle`/`TransformRectangle` now open a `beginDragTransaction` (draw: before `createRectangle`; resize: on entry) and write per-frame via `batchUpdateRectangles`, committing on mouseup (+ exit safety-net). Result: smooth, immer-free, and one undo entry per draw/resize.

Guarded by `DragItems.modes.test.ts` + `rectangleTextbox.dragPerf.test.tsx` (move) and `DrawRectangle.test.ts` / `TransformRectangle.test.ts` / `rectangleDrawTransform.modes.test.ts` (draw/resize routing + begin/commit). Note: textbox *create* (the `t`-hotkey one-shot) still uses the reducer once — not a hot path.

The connector-drag GC cliff below is a separate, still-open item (per-frame model write through the reducer; needs a connector preview path).

## Connector drag still mutates the model on every tile

**Symptom:** A long sustained connector drag (or anchor reconnect) holds 60 fps for ~50 seconds on the perf-stress fixture (80 nodes / 120 connectors), then degrades over a few seconds and stalls at ~4 fps for ~5 seconds before recovering. The shipped fix (drag-transaction + closed-form router) eliminated the original symptom — sub-10fps within seconds of drag start. What remains is a sustained-drag GC cliff, not a per-tile slowdown.

**Workaround:** None needed for typical use. A drag from A to B on a real diagram lasts a few seconds and stays at 60 fps end-to-end. Only marathon drags (cursor circling, no commit, ≳50 s) trip the cliff.

**Status:** Open, deferred. Filed for a future refactor session.

### Empirical findings (2026-05-10)

Captured from the perf overlay using [packages/axoview-lib/src/__perf_refactor_regression__/fixtures/perf-stress-diagram.json](packages/axoview-lib/src/__perf_refactor_regression__/fixtures/perf-stress-diagram.json):

| Window | FPS | Heap pattern |
|---|---|---|
| 0–50 s of drag | steady 60 | flat ~80–110 MB, no GC |
| 50–55 s | 60 → 41 → 35 → 16 → 4 | climbs 175 → 211 → 253 → 294 → **336 MB**, no GC |
| 55–56 s | 4 → 4 → 4 (5 s sustained) | held at 336 MB |
| 56 s | 26 → 19 → 25 → 14 → 59 | one big GC drops 336 → 104 MB |
| `lt` (cumulative long tasks) | grows from 9 → 85 across the cliff | 12, 9, 8, 8 long-task bursts in successive 1 s windows |

Pattern: **allocation-rate-limited GC pressure**, not a CPU bottleneck. V8 holds off on full GC during sustained synchronous work; allocations accumulate to ~336 MB; one stop-the-world collection then recovers.

### Why the shipped fix doesn't cover this

- `beginDragTransaction` / `commitDragTransaction` (in [useSceneActions.ts](packages/axoview-lib/src/hooks/useSceneActions.ts)) freezes `pendingPre` so per-tick `set()` calls skip `produceWithPatches`. That eliminated the patch-generation cost.
- The closed-form router in [pathfinder.ts](packages/axoview-lib/src/utils/pathfinder.ts) eliminated A\* + `PF.Grid` allocation per tick.
- **What still happens per tick:** the anchor is mutated on the model. [`reducers/connector.updateConnector`](packages/axoview-lib/src/stores/reducers/connector.ts#L62) runs `produce(state, ...)` over the entire `state` (model + scene), and a nested `produce` inside `syncConnector`. Each clone is ~100–200 KB on the stress fixture. At 60 fps that's ~12 MB/sec of fresh state objects. V8 catches up eventually, but on a long enough drag the heap outpaces it.

### Refactor design context (for a future session)

**Approach (deferred #3):** keep the in-progress connector preview in `scene.connectors[id].path` only. Don't touch `view.connectors[].anchors` until mouseup / second-click commit. The per-tick model clone goes away; only the small `scene.connectors[id]` slice needs updating per tick.

**Files in the hot path that the refactor would touch:**

| File | Role | What changes |
|---|---|---|
| [`interaction/modes/Connector.ts`](packages/axoview-lib/src/interaction/modes/Connector.ts) | Drives the drag | mousemove must update only the preview path, not call `scene.updateConnector` (which writes the model). On commit: write final anchors once. |
| [`interaction/modes/ReconnectAnchor.ts`](packages/axoview-lib/src/interaction/modes/ReconnectAnchor.ts) | Anchor reconnect | Same pattern. |
| [`stores/reducers/connector.ts`](packages/axoview-lib/src/stores/reducers/connector.ts) | `updateConnector` reducer | Currently does both: writes anchors AND runs `syncConnector`. Needs a sibling reducer that updates `scene.connectors[id].path` only (no model clone). |
| [`hooks/useSceneActions.ts`](packages/axoview-lib/src/hooks/useSceneActions.ts) | Action API | Add `previewConnectorPath(id, anchors)` that bypasses the reducer's model write. |
| [`components/SceneLayers/Connectors/Connector.tsx`](packages/axoview-lib/src/components/SceneLayers/Connectors/Connector.tsx) | Renders the connector | Already reads `scenePath` from sceneStore — likely no change needed if preview lands there. |
| [`components/ConnectorAnchorOverlay/ConnectorAnchorOverlay.tsx`](packages/axoview-lib/src/components/ConnectorAnchorOverlay/ConnectorAnchorOverlay.tsx) | Endpoint hit-targets | Reads anchor refs from model. During drag the model anchors are stale until commit — the overlay needs a "preview anchor" override or to hide during drag. |
| [`components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx`](packages/axoview-lib/src/components/SceneLayers/ConnectorLabels/ConnectorLabel.tsx) | Label positioning | Same concern: reads anchor positions from model. |

**Invariant change.** Today: `view.connectors[].anchors` is the source of truth, scene path is derived. After the refactor: during a drag, model anchors are *committed-state-as-of-mousedown*; scene path is *current preview*. Two readers (overlay, label) need to know which to consult while a drag is open.

**Test before/after.** The perf-stress fixture is wired into [`connector.dragPerf.test.tsx`](packages/axoview-lib/src/__perf_refactor_regression__/connector.dragPerf.test.tsx) and validated against `modelSchema` on load. Use the same fixture for manual before/after comparison; the fix should hold 60 fps for an arbitrarily long drag (no GC cliff). Add an explicit perf assertion (e.g. 500-tick drag under N ms) once the refactor lands so this can't regress silently.

**Risk register.** The hardest part is the two-reader invariant. Anchor refs on the model can be `{ item }` or `{ tile }`; the preview must produce the same shape so downstream code (label positioning, anchor hit-testing, item-control panel) doesn't branch on "is a drag in progress". One option: extend `scene.connectors[id]` with `previewAnchors?: ConnectorAnchor[]`; readers fall back to model anchors when absent. That keeps the contract local to the scene store rather than leaking into UI state.

## Touch/touchpad node placement — SHIPPED (ADR 0018)

**Resolved 2026-06-14.** The press-drag-release-only model is replaced by the touch/pen gesture contract ([ADR 0018](docs/adr/0018-touch-pen-gesture-contract.md), Accepted): one Pointer Events layer branches on `pointerType` — mouse/trackpad keep press-drag-release (with a px-based tap-vs-pan threshold that fixes the precision-trackpad sub-tile drag), and the `window` mouse + touch-synthesis path (and the `(0,0)` drop bug) are gone.

**Touch model = direct manipulation (Option A, 2026-06-14 (B), after device testing).** The initial tap-to-place (SELECT→GRAB→PLACE) was replaced — it fought muscle memory and overloaded long-press. Now: tap a node selects it; **drag a node moves it** (down-on-node → forwarded to the desktop `DRAG_ITEMS` path); drag empty canvas pans; two-finger pinch-zooms; **drag a connector endpoint handle reconnects it**; long-press opens the per-item action bar (move is a drag now, so no overload). Matches Figma/Miro/Lucidchart. No `CARRY_ITEM` mode.

### §5.1 e2e coverage follow-ups (P1, deferred — not introduced by this work)

Closed in the ADR 0018 e2e revision: touch tap-select/place/pan/pinch/abort, the D-7 dual-stack undo repro, and the CSS-preview-mid-drag P0 invariant. Still open as P1 (pre-existing canvas-interaction gaps): a per-mode Escape-abort matrix e2e, a RAF-throttle-under-load unit assertion, and a pan/zoom zero-scene-re-render render-probe. (The former "NodeActionBar invocation/dismissal e2e" gap is moot — the action bar was removed in the 2026-06-25 shake-out.) Filed so they aren't lost; lower priority than the shipped touch coverage.

## Track P (canvas-ux-overhaul) — perf-gate follow-ups

The program-end perf gate ([ADR 0020](docs/adr/0020-engine-perf-harness-and-measurement-protocol.md); full evidence in [perf-results/decision-log.md](perf-results/decision-log.md) "Track P") proved the canvas-ux-overhaul held the engine budget (spawn neutral tip-vs-pre, KR1 7.8%, KR3 idle pass, anti-cheat zero program regressions). It left these open, lower-priority items:

- **`NodeLabelHitLayer` emits one DOM div per visible labelled node at zoom ≥ 0.4** (ADR 0024). The T6 per-frame-write stall is fixed (label-drag 103 → 17.5 ms/frame), but at high zoom on a large diagram the hit layer still adds ~N invisible divs (e.g. 1000 at N=1000). A cursor-proximity cap (mount only the few divs near the pointer) would cut that DOM. Functional today; deferred.
- **O(N) `scene.items.find` in the drag hot path** (`computeNodeUpdates` + `applyNodePreview`, ADR 0023). Negligible for the common single/few-item drag, but O(M·N) for an M-item multi-drag (the SPATIAL anti-pattern). Cache the dragged items' `collides`/`snap` at drag entry (like `externalOccupiedCache`). Needs a multi-drag harness scenario to validate a fix.
- **Connectors are the DOM-volume driver at scale.** The HTML-bloat stress (`perf-results/bloat-1000.md`) showed the canvas node layer emits 0 per-node DOM, so ~11.5k DOM elements at 1000 nodes come almost entirely from the 968 DOM/SVG connectors. Folding connectors onto the canvas is the remaining DOM headroom — Iter-7 deferred it (0 spawn prize, but it IS the DOM driver); needs the harness to route connectors on spawn before re-measuring.
- **Collision-drag @N=500 +14% (accepted).** The off-grid drag-preview machinery (ADR 0023 snap/offset lockstep) adds ~3.6 ms/frame to the 500-node collision-drag — small, irreducible, on a path already over budget pre-program (~26 ms / 33 fps). Documented + accepted in the decision-log, not a re-render regression (renderProbe identical).

## Large-diagram pan: per-frame canvas repaint floor (R1) — OPEN, follow-up to the 2026-06-24 pan fix

**Symptom:** Panning a large diagram (~54 nodes / 37 connectors / 20 textboxes at ~65% zoom, whole scene on-screen) holds only ~24–55 fps on AC power and collapses to ~6–8 fps with a long-task storm when the laptop runs on battery (CPU throttled). Crucially, on AC power there is **no rubber-band and zero long-task accumulation during pans** — those were the R2/R3 + Grid-reflow causes fixed 2026-06-24.

**Root cause (verified, adversarial RCA 2026-06-24):** `NodesCanvas.drawNow()` repaints the full O(visible) node set synchronously on every scroll write — the deliberate #54 design (commit b62dec79) that keeps the canvas in lockstep with the DOM SceneLayers to kill cross-surface skew. At ~54 visible nodes that per-frame repaint (per node: drawImage + dotted stalk stroke + chip roundRect + fillText) is the steady frame-time floor; it does **not** require a tile-boundary crossing. Under CPU throttling the same repaint overruns the throttled budget and produces the >50 ms long-task storm — which is why the battery window in the capture cratered while the on-power windows held flat.

**What WAS fixed 2026-06-24 (the bursts, not this floor):** coarse-bounds culling decoupled from the per-frame pan path (gesture-agnostic throttle + settle), `visibleItems`/`visibleConnectors` array identity stabilised so connector layers + the NodesCanvas `[nodes]` effect bail on membership-stable crossings, and the Grid's per-frame `getBoundingClientRect()` reflow removed. ([Renderer.tsx](packages/axoview-lib/src/components/Renderer/Renderer.tsx), [Grid.tsx](packages/axoview-lib/src/components/Grid/Grid.tsx).)

**Workaround:** Edit large diagrams on AC power (on-power pan has no freezes); lower zoom / fewer on-screen nodes reduces the per-frame cost.

**Status:** Open, deferred — explicitly parked 2026-06-24 in favour of shipping the verified burst fix. The cheap lever (caching per-node string normalisation) will **not** move it: the committed drag CPU profiles ([perf-results/dragprofile-*.md](perf-results/)) show ~0 self-time there. The real cost is the canvas draw calls themselves, so a genuine fix means one of: **(a)** a dirty-region / layered-canvas redraw (only repaint the changed region), or **(b)** a sync-on-small / async-on-large hybrid — which directly risks reintroducing the #54 trailing rubber-band on exactly the large scenes that exhibit the symptom. Two guards must land **before** attempting (a)/(b): the existing #54 guard ([NodesCanvas.scrollSync.test.tsx](packages/axoview-lib/src/components/SceneLayers/Nodes/__tests__/NodesCanvas.scrollSync.test.tsx)) renders `nodes={[]}`, so a node-count gate would keep it green while silently regressing real scenes (a false-safe — add a large-N variant); and a pan scenario in the perf harness. *(Prereq update 2026-07-05, technical-review-2026-07 audit: the second guard **landed** — `measurePan` is in the harness ([engine-perf.spec.ts](packages/axoview-e2e/perf/engine-perf.spec.ts), E-slice per [pan-r1-design.md](perf-results/pan-r1-design.md) / ADR 0020 addendum), so the floor is now measured. The large-N `scrollSync` guard variant remains the one outstanding prerequisite before attempting (a)/(b).)*
## Image export drops connectors in ISOMETRIC view (2D export is fine)

**Symptom:** Exporting a diagram as an image (PNG/SVG) omits all **connectors** when the
view is **isometric**. The same diagram exported from **2D view** includes connectors
correctly. Nodes, text boxes, and labels export fine in both projections; only
connectors are missing, and only in iso.

**Root cause (confirmed by the iso-vs-2D split):** connectors are the only scene
elements rendered as a nested inline `<svg>` (nodes are Canvas2D; text boxes/labels are
HTML). In iso, `useIsoProjection` puts the projection's CSS `matrix()` skew on the
connector's wrapper `<Box>` ([`getProjectionCss`](packages/axoview-lib/src/contexts/CanvasModeContext.tsx) returns the matrix in ISO, an empty
string in 2D — [`useIsoProjection.ts`](packages/axoview-lib/src/hooks/useIsoProjection.ts)), and the inner
[`<Svg>`](packages/axoview-lib/src/components/SceneLayers/Connectors/Connector.tsx) additionally carries `transform: scale(-1, 1)`. The image export
([`exportOptions.ts`](packages/axoview-lib/src/utils/exportOptions.ts) → `dom-to-image-more`) serializes the DOM into a
`<foreignObject>` and rasterizes it; a nested inline `<svg>` (with its own transform)
under a `matrix()`-skewed ancestor is exactly the case `dom-to-image-more` mishandles.
In 2D the wrapper has no transform, so the same `<svg>` rasterizes fine. Related: ADR 0025
(image-export robustness).

**Next diagnostic step (was in-flight, instrumentation since removed):** temporary
`[export-diag]` logging was added to `exportImage` to split the two possible fixes but
the run's console output was never captured. Re-add a probe (or read the captured
serialized SVG) to determine:
- serialized SVG **lacks** `<polyline>` -> `dom-to-image` drops it during clone/serialize
  -> fix lives in the export path (restructure what is cloned), no live-render change.
- serialized SVG **has** `<polyline>` but PNG is blank -> browser won't rasterize the
  `<svg>` under the iso `matrix()` -> fix means flattening the connector's transform
  (move the iso matrix off the wrapper / combine onto the svg), which touches the shared
  live connector renderer and must be visually verified in both iso live + iso export.

**Workaround:** export from **2D view**, or (until fixed) screenshot the iso canvas.

**Status:** Open, deferred. Diagnosed to the iso `matrix()` + nested `<svg>` interaction
in `dom-to-image-more`; the remaining fork (serialization vs rasterization) needs one
console capture before a fix is chosen. Filed from the 2026-06-25 shake-out (item #5).
