# ADR 0037 — Storage Places Model (one tree, per-diagram provider routing)

**Status:** Accepted (shipped with the storage-ux-unification push)
**Date:** 2026-07-06
**Supersedes:** ADR 0036 §6 (provider picker, copy-only Save-to-Drive, no bulk migration)
**Related:** ADR 0035 (auth, amended same day), ADR 0036 (Drive provider, unchanged §1–§5)

## Context

The shipped Drive integration modeled storage as a **global mode**: a
`StorageProviderPicker` toggled `activeProviderId` between `local` and
`google-drive`, the switch reset the canvas and cleared the tree, and the same
place had three user-facing names ("Local storage" / "Diagrams" / "Session").
The owner's UX review (2026-07-06) found the mode switch confusing, wanted both
storages visible in ONE file tree with per-item location and move actions, a
bulk migration offer after sign-in, and honest loading states.

## Decision

**Storage is a property of each diagram — its *place* — not a global mode.**

1. **Places.** Two places exist: `local` (browser session on the storage-less
   deploy; the server backend on self-host) and `google-drive`. `FileNode`
   carries a `placeId`; the explorer composes one tree with two **place
   sections** (`Google Drive` first, then `This session` / `This server`).
2. **The active provider follows the open diagram.** `openDiagramById` and
   `handleCreateBlankDiagram` take a `placeId` and set the manager's active
   provider before loading/creating (flushing the pending autosave to the old
   place first). Every existing mode branch — `remoteStorageActive`, autosave
   vs manual save, the Session chip, unsaved-changes guards — thereby keys off
   the OPEN diagram with no per-branch rewrite. *(As-built exception: the
   **delete-dialog copy** was mis-listed here — it keys off the deleted **item's**
   place, not the open diagram: `FileExplorer.tsx` builds `deleteBody${shape}${place}`
   from `deleteConfirm.placeId`, a per-branch rewrite.)* The
   picker and the user-facing `switchStorageProvider` are deleted; the only
   surviving whole-canvas reset is the Google sign-out fallback
   (`handleGoogleSignedOut`), which closes a Drive-side diagram (flushing
   while the token is still valid) before the revoke.
3. **Default place for new work:** Drive when signed in on the storage-less
   deploy, otherwise `local`; per-section create actions override. With
   nothing open, a fresh sign-in flips the active place to Drive silently (no
   canvas reset); a restored session diagram keeps the session place.
4. **Per-section states, loading first-class.** `useFileTree` gains an
   `enabled` gate and a `status` (`disabled | loading | ready | error`) plus
   `isRefreshing`. The Drive section renders: a sign-in row (never signed in),
   skeleton rows (boot reconnect / first listing), a reconnect row (silent
   auth failed), an error row with Retry, a "finish setup" row (root folder
   not configured), or its data / an empty hint. "No diagrams yet" may render
   only when every visible place is `ready` — the empty-then-content flash is
   gone. Refreshes keep stale rows under a thin progress bar.
5. **Cross-place move (session → Drive), move semantics.**
   `moveDiagramsToDrive` (services/storage/driveTransfer.ts): create on Drive
   → verify the returned id → only then delete from the source; folder paths
   are recreated (existing Drive folders reused by name), collisions get the
   `copySuffix`. Exposed as the context-menu **"Move to Google Drive"**, drag
   of a session diagram onto the Drive section/folder, the session section's
   move-all affordance, and the **`MigrateSessionDialog`** (checkbox list,
   default all) that auto-offers once per fresh sign-in when session diagrams
   exist — gated on the Drive root being configured so it can never race the
   first-connect chooser into duplicating the root. A failed item stays in
   session and is reported (ADR 0011). Moving the OPEN diagram reopens it
   from its new Drive id. Drive → session moves are deliberately absent in v1
   (export covers it).
6. **Vocabulary.** The browser place is **session** everywhere ("This
   session" section, Session chip, banner); "Local storage" died with the
   picker. "Google Drive" stays verbatim across locales (proper noun).

## Consequences

**Positive:** no mode flip, no canvas reset on storage decisions; location is
visible per item; the sweep cost collapsed (active-follows-open-diagram reuses
every `remoteStorageActive` branch); loading/error/empty are explicit states.

**Negative / accepted:**
- The manager still has a single "active" provider under the hood — it is an
  implementation detail now, but code that reads `activeProviderId` must
  understand it means "the open diagram's place".
- Tree-item operations route to their own place's provider directly (two
  `useFileTree` instances), so a Drive hiccup can't block session CRUD — at
  the cost of both trees refreshing on one shared token.
- Cross-place drag is one-directional (session → Drive, diagrams only).
- The `diagrams`/`SaveDialog`/`LoadDialog` legacy session list inside
  DiagramLifecycleProvider predates the provider model and is untouched.

## Test anchors

`driveTransfer.test.ts` (move-verify-delete order, failure keeps source,
path recreation/reuse, collision suffix, id stripping); `authStore.test.ts`
(profile hint, quiet reconnect, request piggybacking).
