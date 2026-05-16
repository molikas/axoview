# Tactical — MQA Bundle B: Medium-Complexity Bugs

> **Read first:**
> - [docs/tactical/mqa-results.md](mqa-results.md) — full manual QA issue list (source of truth)
> - [docs/tactical/mqa-bundle-a.md](mqa-bundle-a.md) — fast-fix bundle (ship first; some fixes here build on it)
> - [docs/architecture.md](../architecture.md) — interaction modes, autosave path, history stack
> - [docs/ux-principles.md](../ux-principles.md) — motion / feedback budgets relevant to #16, #18
>
> **Status:** Ready · **Owner:** Igor · **Last updated:** 2026-05-15
>
> Short-lived working doc. Delete after the work merges; ADRs and commit history are the durable record.

## Session startup checklist

1. Read this file fully.
2. Read [mqa-results.md](mqa-results.md) entries for the bugs in scope so you have user wording handy.
3. Confirm Bundle A is already shipped — don't start B until A is verified.
4. Use `TodoWrite` — one todo per issue.
5. For each issue: **diagnose first** (one-sentence hypothesis), edit, build if needed, hand off for verification. Don't move on until confirmed.
6. On completion, follow the "Wrap-up" section below.

## Goal

Land the 9 medium-complexity bug fixes from the 2026-05-15 manual QA pass. Each has a single root cause but needs verification — some require diagnostics on attempt #2 per the `/shake-out` loop.

**Out of scope:** design-shaped items (see [`mqa-design-shakeout.md`](mqa-design-shakeout.md)), and anything that would expand scope beyond the named issue (e.g. fixing #18 doesn't mean redesigning the empty-state screen).

## Quality bar

- **Tests:** each bug here gets at least one regression test (reducer test, store test, or component test — whichever matches the surface). The bug exists because it slipped past existing coverage; close that gap.
- **No spaghetti:** when a fix lands, audit the *immediate* surrounding code for dead branches, unused state, or recently-orphaned helpers introduced by past patches. Delete what's dead. Do not refactor anything you didn't touch — `/audit` covers that.
- **No silent regressions:** after each fix, run the existing test suite (`npm test` in both workspaces). Failures are blockers, not noise.

---

## Issues

### #5 — Redo doesn't restore last action after undo+undo+redo+redo

**Symptom:** Draw connection A → draw connection B → undo, undo, redo, redo → connection B does not appear.

**Hypothesis:** the history-stack future pointer is being cleared on an unrelated state mutation between redo cycles, or the redo handler pops without re-applying. Confirm by logging history-stack length before/after each undo/redo.

**Approach:**
1. Add `console.log` to undo/redo dispatch with `pastLen`, `futureLen`, `presentSummary`.
2. Reproduce → paste output → identify which transition drops the future.
3. Fix at root — likely a state-write outside `withHistory(...)` wrapper that pushes a new "present" and silently clears future.

**Test:** reducer test — apply 2 actions, undo×2, redo×2 → final state == after the 2nd action.

---

### #12 — `1. <space>` at start of empty line is erased

**Symptom:** In rich-edit boxes, typing `1.` then space at the start of an empty line erases the input. Works correctly when text precedes the marker.

**Hypothesis:** the input rule (Prosemirror / Lexical / whichever rich-text lib is in use) for converting `1. ` → ordered list misfires when the node is empty — converts and then somehow discards the typed marker. Confirm by inspecting the input-rule definition.

**Approach:**
- Locate the rich text editor and its input rules.
- For ordered-list rule: ensure the rule consumes only the `1. ` marker but **does not delete** subsequent typed content. If the rule replaces the entire paragraph, change it to wrap rather than replace.

**Test:** rich-text editor unit test asserting that after typing `1. ` on an empty line, the editor is in an ordered list with the cursor at the first item.

---

### #13 — F2 rename in file explorer fails when a canvas node is selected

**Symptom:** Inline edit appears then disappears immediately. Only when a canvas node is selected. Smells like autosave-triggered refresh.

**Hypothesis:** when the diagram-rename action dispatches, an autosave or "diagrams list refreshed" effect re-renders the folder explorer and unmounts the inline-edit input. The canvas-node-selected state only matters because *that* state change is what makes autosave fire on this path.

**Approach:**
1. Add diagnostics to: autosave dispatch, folder explorer re-render, inline-edit unmount.
2. Reproduce → identify the unmount cause.
3. Fix root: either (a) make the inline-edit component preserve its open state across re-renders (key stability + uncontrolled input + ref-based focus restoration), or (b) prevent the autosave/refresh from re-mounting the tree when only an unrelated selection changed (memoization fix).

**Decision point:** if both fixes are reasonable, prefer (b) — fewer re-renders is a perf win too. Confirm with user before coding if unclear.

**Test:** integration test — select node, F2 on diagram, type, Enter → diagram is renamed and inline edit closed gracefully.

---

### #14 — Diagram rename doesn't persist unless diagram was opened post-rename

**Symptom:** Rename 5 diagrams from explorer → export → import to clean session → only the diagrams that were opened after rename have the new name.

**Hypothesis:** rename mutates the in-memory diagrams list but the per-diagram serialized blob (stored separately) still carries the old name. Export reads from the per-diagram blob, not the list. Opening a diagram triggers a re-serialize that picks up the new name.

**Approach:**
1. Confirm hypothesis: log the export payload to see which name is wrong.
2. Fix at the rename action: when renaming, update **both** the diagrams list **and** the persisted blob for that diagram.
3. Consider whether the list-name and blob-name should even be duplicated. If not, this is an architectural smell to flag (but don't refactor here — note in known issues if applicable).

**Test:** integration test — rename diagram, export, parse export, assert renamed diagram has new name.

---

### #16 — Node edit deck auto-closes when text drag-select crosses its edge

**Symptom:** User opens node edit panel, drag-selects text in an input, drags past the panel edge, the panel closes on mouse-up.

**Hypothesis:** outside-click handler fires on `mousedown` *or* `mouseup` outside the panel without checking whether the drag *started* inside the panel.

**Approach:**
- Outside-click handler: track `mousedown` target. If mousedown was inside the panel, ignore the subsequent mouseup regardless of where it ended.
- Standard pattern. No design question.

**Test:** component test — simulate mousedown inside panel + mouseup outside → panel remains open.

---

### #17 — Remove Export Compact entirely (and any dead code)

**Symptom:** Export Compact omits rectangle, text, connector labels, color, style, notes. Export JSON works fine. User wants the feature removed.

**Approach:**
1. Remove the menu entry / button.
2. Trace and delete: the compact serializer, its types, any test fixtures, i18n keys, route handlers, README mentions.
3. After deletion, run `npm run typecheck` in both workspaces — orphaned imports will surface.
4. If any helper was shared with the JSON export, leave the shared helper but remove the compact-only entry point.

**Test:** existing JSON export test still passes; no test referencing compact remains.

**i18n:** remove any orphaned keys; the recent i18n hygiene pass (commit `215f1f3`) is the bar — don't regress it.

---

### #18 — Deleted diagram still visible on canvas; autosave resurrects it

**Symptom:** User deletes the currently-open diagram → canvas still shows it → autosave fires → diagram is recreated.

**Hypothesis:** delete action removes the diagram from the list but does not clear the canvas's "active diagram ID" or reset the scene. Autosave reads the scene and writes a new diagram with the same (or new) ID.

**Approach:**
- Delete action should: (a) remove from list, (b) clear active diagram ID, (c) reset scene to empty / initial state, (d) cancel any pending autosave for that ID.
- Show the initial-load screen (Create new / Import) when no diagram is active. This screen already exists — make sure the empty-state condition routes to it.

**Test:** integration test — open diagram → delete → assert canvas is on initial screen → wait for autosave interval → no new diagram appears.

---

### #21 — Docker mode: folder import + manual folder creation fails

**Symptom:** Importing a project with folders throws "failed to create a folder." Creating a folder manually via folder explorer also fails. Only in Docker mode.

**Hypothesis:** the Docker runtime adapter for the filesystem-like persistence layer doesn't implement folder creation, or implements it but with a broken path (e.g. doesn't ensure parent dirs, or expects a different API shape than the browser runtime).

**Approach:**
1. Reproduce in Docker mode locally. Capture the exact error from server logs.
2. Inspect the Docker runtime's storage adapter — compare against the browser runtime's interface contract.
3. Fix the adapter to honor the contract; do not paper over by silently skipping folder creation.

**Test:** Docker runtime integration test for folder create + nested folder import. If this test infra doesn't exist, add a minimal one (Docker mode is the target deployment per `flare_plan.md`).

**Architecture touchpoint:** if folder ops aren't part of the documented storage-adapter contract, add them. Possibly worth a one-line ADR note (defer the call to wrap-up — don't pre-emptively write one).

---

### #22 — Preview mode shows 2 "Open <diagram> in new tab" tooltips

**Symptom:** Node linked to another diagram shows two identical tooltips on hover. Hovering the *name label* shows only one (the correct count).

**Hypothesis:** the link tooltip wrapper is applied at both the node-body level AND the node-name level, with the body version also covering the name area. The intent was probably one tooltip on the body and a *different* tooltip on the name (for external links — see #25 for the broader design issue).

**Approach (scoped to this bug only — design conflict goes to #25):**
- Find where the link tooltip is mounted. Pick one mount point (the node body). Remove the duplicate.
- Verify hover-on-label still shows the appropriate tooltip — if the label needs its own tooltip for external links, leave the label tooltip alone; just deduplicate the body tooltip.

**Test:** rendering test — node with diagram link → exactly one `[role="tooltip"]` visible on hover.

**Note:** #25 (preview interaction redesign) lives in the design plan — fixing the duplicate here doesn't preclude that redesign.

---

### #24 — Share link uses wrong port (3001 vs host 3000)

**Symptom:** App on `localhost:3000` generates share link to `localhost:3001/...`. The "Preview" button generates the correct `:3000` link.

**Hypothesis:** share-link builder uses a hardcoded port or an env var that diverges from `window.location.port`. Preview button uses `window.location.origin` (correct).

**Approach:**
- Find the share-link builder. Replace hardcoded port / env with `window.location.origin`.
- Look for similar bugs in any other link builders (rare-mode preview, embed code, etc.) — fix in the same pass.

**Test:** unit test — share-link builder returns a URL whose origin matches `window.location.origin`.

---

### #7 — FPS drop dragging 6 elements (perf diagnosis)

**Symptom:** FPS crashes 60→18 during drag-with-6-elements. Diag file `ff-diag-ai-2026-05-11T14-31-30-029Z.json` shows:

- Heap grew 115.5MB → 130.6MB over 5s of dragging
- Major GC at t=6173ms freed 42MB → FPS crashed 60→18 for ~4 seconds
- Long-task burst (200ms cumulative) hit in the first second
- Element counts (`ni/nc/ntb`) read 0 throughout — the diag exporter is not capturing them (separate bug — note in known issues)

**Hypothesis:** drag hot path is allocating per frame — most likely culprits:
1. Connector geometry recomputed for *all* connectors touched by the drag, allocating new path objects each frame.
2. New state slices created per frame (immutable update creating fresh arrays for selection list).
3. Event objects or transforms created in the move handler without reuse.

**Approach:**
1. Profile with Chrome DevTools Performance + Memory tabs: record the drag, look at the Allocation Sampling profile.
2. Identify the top allocator(s).
3. Targeted fix: reuse objects (mutate-in-place where the state model allows), or coalesce per-frame work via `requestAnimationFrame` if it's a tick-rate issue (the recent connector-drag transaction work in `7164b3b` already does this for connector routes — check that it actually covers multi-element drag).
4. Fix the diag exporter's `ni/nc/ntb` counts as a separate small fix in this bundle — the metric is meant to correlate FPS with scene complexity.

**Test:** add a perf-regression test if the suite supports it (timed drag, assert frame budget). If not, document the measured before/after numbers in the commit message.

**Scope guard:** this is an investigation, not an open-ended refactor. If the fix exceeds ~200 LOC or starts touching the rendering pipeline architecture, stop and write a separate tactical plan.

---

## Order of work

Recommended ordering — group by surface to keep mental context warm:

1. **Easy wins** to ship momentum: #24 (port), #22 (dedupe tooltip), #16 (drag-select guard).
2. **History / autosave cluster** (touch the same area): #18 (delete resets canvas), #13 (rename racing autosave), #14 (rename persistence), #5 (redo).
3. **Editor / formatting:** #12 (input rule fix).
4. **Feature removal:** #17 (Export Compact removal — discrete, mostly delete).
5. **Runtime-specific:** #21 (Docker folders) — needs Docker reproducer.
6. **Perf:** #7 (last — open-ended investigation; if it grows, defer the rest to a follow-up).

## Wrap-up

When all items are verified:

1. **Tests:** ensure each issue has a regression test and the full suite passes (`npm test` in both workspaces).
2. **Build:** `npm run build:lib` if any lib code changed.
3. **i18n:** verify orphaned compact-export keys are removed and no new keys missing in any locale.
4. **Commit:** one commit per cluster is OK if the bundle is large — discuss with user at wrap-up. Otherwise one commit referencing each issue number.
5. **Update artifacts:**
   - [ ] Mark each `[x]` in this file.
   - [ ] Strike through completed items in `mqa-results.md` or annotate with commit hash.
   - [ ] If #21 surfaced storage-adapter contract gaps, add a dated note to the relevant ADR (don't write a new one).
   - [ ] Create `known_issues.md` entry for any item that couldn't be fully fixed (diag exporter element counts, anything moved out of scope).
6. **Delete this file** when the bundle merges.

## Status checklist

- [x] #5 — Redo last-action bug
- [x] #7 — FPS drop on multi-drag (perf) — fixed 2026-05-16. Three-stage fix: (1) `bba712c` wrapped DragItems in drag transaction, (2) `728b229` split Node into shell + memoized NodeContent, (3) Path 4-true introduced CSS-only drag preview with model commit deferred to mouseup. Sub-13fps cliff eliminated (19s → 0s); sustained 24-44 fps throughout multi-element drag. See known_issues.md for full measurement table and trade-offs.
- [x] #12 — `1. ` autoformat erases line
- [x] #13 — F2 rename racing with autosave
- [x] #14 — Rename persistence on export
- [x] #16 — Node-edit deck drag-select close
- [x] #17 — Remove Export Compact (and dead code)
- [x] #18 — Delete diagram resets canvas
- [x] #21 — Docker folder import / create
- [x] #22 — Duplicate preview tooltip
- [x] #24 — Share-link port
