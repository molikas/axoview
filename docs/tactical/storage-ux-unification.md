# Tactical — Storage & Sign-in UX Unification ("places, not modes")

**Status:** Code complete 2026-07-06 (single push on `integration`) — jest 19/19 suites (188 tests), tsc clean, prod build green. Awaiting owner live-test (Google consent test-user remains the gating step). ADR 0037 records the model.
**Owner decisions locked:** 2026-07-06 session (supersedes two ADR 0036 §6 calls from 2026-07-05)
**Baseline:** the 8e08933 / 3aa2b48 / bf50f80 Drive integration (ADR 0035 / 0036)

## Why

Owner UX review (2026-07-06) of the shipped Google sign-in + Drive storage surfaced six issues:

1. Sign-in is not remembered — every reload starts signed out. (Root cause: ADR 0035's boot
   reconnect and ADR 0036's persisted provider choice were specified but never implemented;
   `authStore` boots `UNAUTHENTICATED`, `activeProviderId` resets to `'local'`.)
2. The standalone "Sign in with Google" toolbar button belongs under a profile/avatar control
   (Lucid / VS Code pattern).
3. The explicit session ⇄ Drive mode switch (`StorageProviderPicker`) is confusing — it resets
   the canvas and clears the tree, and the same place has three names ("Local storage" /
   "Diagrams" / "Session").
4. After sign-in, the app should offer to move existing session diagrams to Drive (bulk dialog).
5. The file tree must show both places at once — location visible per item, per-item move, no
   extra switch control.
6. Drive listing has no loading state — the tree renders empty, then content "magically appears".

## Locked design (owner picks 2026-07-06)

**Organizing idea: storage is a property of each diagram (its *place*), not a global mode.**

- **A. One account control** (toolbar right): person icon signed-out → avatar signed-in; MUI Menu
  with name/email header, "Move session diagrams to Drive…" (when any exist), "Open Drive
  folder", "Sign out". Google-branded button lives inside the menu + empty-state card. The
  "Session expired" chip is replaced by an amber badge dot on the avatar.
- **B. Remember me**: persist a **profile hint** (name/email/avatar/hasConnectedDrive) in
  localStorage — never the token (ADR 0035 rule 1 unchanged). On boot with a hint: silent
  `prompt:''` token attempt (`RECONNECTING` state, avatar dimmed); failure degrades to amber dot
  + fully usable session place. Ops: consent screen must leave testing mode (7-day grant expiry).
- **C. One tree, two place sections** — "Google Drive" + "This session" as collapsible sections
  in one FileExplorer; no provider toggle (component deleted). Open/save/rename/delete route to
  the diagram's own provider; autosave vs manual-save + Session chip key off the **open
  diagram's** place. Per-section states: sign-in row (never signed in), skeleton rows (loading /
  reconnecting), reconnect row (silent failed), error + retry, "No diagrams in Drive yet."
  Session section rendered only when it has content (or when it is the only place). Single-place
  deployments (no client id) keep today's flat tree. Self-host: server-backed place is the
  durable section; Drive optional add-on.
- **D. First-run = nudge, no gate** (owner pick — revises the earlier blocking-screen idea):
  `EmptyStateScreen` gains a third "Sign in with Google" card, gated
  `!serverStorageAvailable && googleClientId && !authenticated`. No welcome screen.
- **E. Migration Dialog** on every successful sign-in while session diagrams exist (+ on demand
  from avatar menu and session-section header): checkbox list (default all), "Move N to Drive" /
  "Not now". **Move semantics** (owner pick): create on Drive → verify → delete from session,
  folder path recreated. Partial failure keeps items in session (ADR 0011 error contract).
- **F. Loading first-class**: per-place `loading | ready | error` status; skeleton rows on first
  load; stale rows + thin progress on refresh; global "No diagrams yet" only when every visible
  place is `ready`.
- **New-diagram default place**: Drive when signed in, else session; per-section "New diagram
  here" overrides. Rollout: **all in one push** (owner pick), one branch, one commit.

## Supersessions / ADR deltas (do in docs batch)

- ADR 0035 §3/§5 amendment: profile hint + boot reconnect + avatar-only control (button + chip
  retired). Token custody rules unchanged.
- ADR 0036 §6 superseded (dated owner revision 2026-07-06): picker deleted; per-diagram
  copy-only "Save to Drive" → **move**; bulk migration dialog now IN scope; provider-choice
  persistence replaced by per-diagram routing + default place.
- New ADR 0037 — storage places model (per-diagram provider routing; retires global
  `activeProviderId` mode; `remoteStorageActive` → derived from the open diagram's place).
- LocalModeBanner: kept, copy gains a sign-in path when Drive is configured (not retired —
  it warns about existing work; the card is onboarding).
- i18n: the entire 8e08933 surface is hardcoded English — every string touched here gets keys in
  ALL app locales (ux-principles §7.1).

## Work breakdown

- [x] Tactical doc (this file)
- [x] authStore: profile hint persist/load/clear + `RECONNECTING` + `attemptSilentReconnect()`
      (once, after GIS script ready); token-never-persisted invariant kept + 6 new tests
      (+ `getValidToken` now piggybacks on any in-flight request — fixed a latent double-request)
- [x] AuthProvider: silent reconnect gated on `onScriptLoadSuccess`, one attempt per load
- [x] AuthControl: 4 visual states + menu (sign-in item w/ Google G, move-session entry,
      Open Drive folder via `getCachedRootId()`, sign out closes Drive diagram BEFORE revoke)
- [x] Per-diagram routing: active provider follows the open diagram (`openDiagramById` /
      `handleCreateBlankDiagram` take `placeId`) — every `remoteStorageActive` branch keys off
      the open diagram with no per-branch rewrite; `StorageProviderPicker` deleted;
      `switchStorageProvider` → `handleGoogleSignedOut(afterClose)`; sign-in w/ nothing open
      flips active place to Drive silently; `defaultPlaceId` in AppStorageContext
- [x] FileExplorer: synthetic place-root composition (ONE arborist tree), per-section state
      rows (signin/reconnect/skeleton/error+retry/setup/empty), header = "Diagrams", session
      section auto-hides when signed-in+empty, cross-place DnD (session diagram → Drive only),
      move-all affordance on the session place row, refresh keeps stale rows + thin progress
- [x] Move machinery: `driveTransfer.moveDiagramsToDrive` (create→verify→delete, folder-path
      recreation w/ reuse, copySuffix), context-menu "Move to Google Drive", MigrateSessionDialog
      (auto-offer once per FRESH grant, root-ready gated via 'axoview-drive-root-ready';
      on-demand via 'axoview-open-migrate'); open-diagram move reopens from its Drive id
- [x] DriveSetupGate: trigger = fresh grant w/o root marker; cancel postpones (setup row
      re-opens via 'axoview-drive-setup') — no forced sign-out
- [x] EmptyStateScreen sign-in card (nudge, gated storage-less+signed-out); LocalModeBanner
      quiet action (sign in / move); MigrateSessionDialog mounted in EditorShell
- [x] i18n: 37 new keys × 13 locales (merge script; `{{n}}` not `{{count}}` to dodge plural
      suffix resolution); pre-existing hardcoded strings filed as known_issues i18n debt
- [x] Tests: jest 19/19 suites, 188 tests (authStore +6, driveTransfer +6 new suite)
- [x] Docs batch: ADR 0035 amendments (§2/§3/§5), ADR 0036 §6 supersession, ADR 0037 (new),
      known_issues i18n-debt entry
- [x] tsc clean; prod build green; single commit + push to `integration`
- [ ] Owner live-test on integration deploy (consent test-user gate): sign in → remember-me
      across reload → migration offer → move/DnD → loading skeletons → sign-out fallback

## Polish on top of scope (owner live-test feedback, 2026-07-06)

- [x] `5acb68d` fix(auth): silent requests now carry **login_hint** (multi-account browsers
      failed hint-less prompt:'' with "interaction required" → read as "signs me out every
      reload"); console.debug diagnostics on silent start/failure disambiguate the remaining
      failure mode (popup_failed_to_open = blocker vs OAuth interaction errors)
- [x] `86f2480` fix(ux): toolbar declutter — Session chip + storage gauge moved into the
      avatar menu (both variants); StatusCluster keeps save-state text only (renders nothing
      when silent); **format strip left-aligned** after the brand (Lucid pattern; amends
      ADR 0005 empty-center — strip stays the one compressible F1 group)
- [x] empty-state rework (owner pick: hierarchy strip over two-step choice): the sign-in
      peer-card is gone; New/Import stay the only cards, with a quiet "[G] Sign in with
      Google / …or continue in this session" strip beneath (+1 i18n key × 13 locales)
- [x] `ad7bc8b` fix(ux): empty-state sign-in card → identity strip (owner pick: hierarchy
      strip over two-step choice)
- [x] `3a35327` fix(ux): move-to-drive in-flight feedback — row spinner + dim + inert row,
      panel thin bar, per-id re-entry guard (indeterminate by design, §6.4; determinate
      "Moving X of Y" stays in the bulk migration dialog)
- [x] gesture-armed reconnect retry (owner pick after console verdict `popup_failed_to_open`):
      boot attempt popup-blocked → one-shot retry on the next gesture (user activation lets
      the popup open/self-close); ADR 0035 §3 amendment 2
- **Catalogued — definitive reconnect fix (pre-master slice):** worker auth-code flow with
  the refresh token in an HttpOnly encrypted cookie (`GOOGLE_CLIENT_SECRET` wrangler secret,
  `/api/google/oauth/callback` + `/api/google/token` routes, Express parity per ADR 0009 §5,
  SPA off the implicit flow). Kills the popup entirely; worker stays storage-less.
- Doc follow-up at wrap-up: ux-principles §8.5 (chip-in-cluster example) + ADR 0005 layout
  contract need dated notes reflecting the two owner overrides above. aria-hidden menu
  warnings filed in known_issues.

## Known constraints / gotchas

- GIS ceiling: no refresh tokens browser-side; ~1 h silent renewals (already built via
  `getValidToken`), occasional one-click reconfirm unavoidable. Honest UX, not a bug (ADR 0035).
- Session place asymmetry: diagrams in sessionStorage, folders + manifest in localStorage —
  orphan folders after tab close. Out of scope here; noted for a future alignment.
- `authStore.test.ts` spies on `localStorage.setItem` to assert the token never persists — the
  profile-hint write must be scoped so the test can still assert no token-shaped writes.
- Playwright e2e does NOT run on integration pushes (PR-only); local loop needs lib dist rebuilt
  only if lib files change (none expected — whole surface is axoview-app).

## Wrap-up (delete this file at master-merge time)

At merge: fold outcomes into ADR 0035/0036/0037 statuses, delete this tactical doc, prune any
parked known_issues entries that shipped.
