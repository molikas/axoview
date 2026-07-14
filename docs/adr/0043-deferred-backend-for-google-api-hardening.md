# ADR 0043 — Deferred Backend for Google-API Hardening (Auth Broker, Read Proxy, Snapshot Store)

**Status:** Accepted
**Date:** 2026-07-14
**Supersedes:** none
**Superseded by:** none

## Context

The Google-API integration shipped as a **pure client-side SPA** by deliberate
choice: [ADR 0035](0035-google-identity-and-drive-authorization.md) established
"no server holds your Google credentials", [ADR 0036](0036-google-drive-storage-provider.md)
made the user's own Drive the storage backend, and
[ADR 0042](0042-drive-native-sharing-and-readonly-preview.md) added Drive-native
sharing + anonymous read-only preview — all with no first-party backend.

On **2026-07-14** an external review (Gemini) of that integration returned. The
full brief and the review outcome live in
[docs/google-drive-api-review-request.md](../google-drive-api-review-request.md)
(§10). Verdict: the V1 choices are "smart, pragmatic" for a client-side app, and
dropping the deprecated `ShareClient` widget for a custom Drive-REST permissions
UI was the right call. Its four recommendations, however, **all require a server
component** the current architecture deliberately lacks:

1. **Auth** → migrate from the implicit GIS token flow (~1h token, no refresh) to
   **auth-code + PKCE with a minimal token broker** (refresh tokens held
   server-side) to unlock long sessions / offline / background sync.
2. **Sharing** → keep `drive.file` + Picker now, but roadmap a **first-party
   publish-snapshot store** so recipients get a clean link instead of Google's
   raw-JSON notification email.
3. **Anonymous reads** → replace the public referrer-restricted API key with a
   **signed short-lived proxy** to remove the quota/abuse surface.
4. **Picker** → keep it, add aggressive failure fallbacks + cookie/pop-up copy.

This ADR exists because that outcome needs a **durable** home. The review-request
doc is short-lived (it dies at the drive-native-sharing tactical wrap) and
[known_issues.md](../../known_issues.md) is a log, not a decision record. We must
capture, permanently: **(a)** the decision to defer the backend, **(b)** the
specific, observable **triggers** that would flip that decision, and **(c)** the
shape of the minimal backend, so a future build is grounded rather than
re-litigated.

**Accuracy note on rec #1:** we use Google Identity Services' *token client*
(`initTokenClient`) — a currently-supported browser library, not a raw deprecated
endpoint — but it *is* the implicit grant under the hood (`response_type=token`),
which is why sessions are ~1h with no refresh token. The review's direction
(auth-code + PKCE + broker) is correct; its "dead flow" framing overstates a
mechanism Google still ships for exactly this short-lived in-browser use case.

## Decision

**Axoview stays serverless for the Google-API integration in v1.** No auth
broker, no read proxy, no snapshot store is built now; [ADR 0035](0035-google-identity-and-drive-authorization.md)'s
posture stands. The review's four recommendations are recorded as a
**trigger-gated roadmap**, not immediate work.

### 1. What ships now (no backend required)

Two code mitigations (this PR) and one ops mitigation partially close the two
lowest-cost gaps without a server:

- **Recipient-email UX (partial mitigation of #2):** `addPersonPermission` now
  passes an `emailMessage` pointing the recipient at OUR `/display/drive/<id>`
  viewer, and the **Manage-access dialog surfaces the copyable preview link**, so
  the owner shares the viewer URL rather than the raw Drive file. This is a
  *mitigation*, not a cure — Google's notification still shows the raw-file CTA;
  the full fix is item #2 below.
- **Picker resilience copy (the code half of #4):** the display gate's
  `pickerError` now names the third-party-cookie / pop-up cause instead of a bare
  "try again".
- **Ops (interim for #3):** the public `GOOGLE_API_KEY` is created
  **referrer-restricted + API-restricted** (Drive + Picker only) at the P1
  prototype gate — the cheapest hedge against key abuse, no code.

### 2. Deferred backend items + activation triggers

Each item stays deferred until one of its triggers is observed. A trigger is a
*forcing function*, not a preference — the point is that the activation moment is
mostly **external** (browser / Google / abuse), so these are watch items.

| # | Deferred item | Activation trigger(s) — build when any fires |
|---|---|---|
| **#1** | **Auth: auth-code + PKCE + token broker** (server-held refresh tokens; long sessions / offline / background sync) | Chrome's 3rd-party-cookie phase-out **actually ships** → GIS silent re-auth degrades → users hit frequent reconnect prompts; **OR** the product wants a real "stay signed in" / offline-write story; **OR** traffic grows past hobby scale (the ~1h re-auth friction scales with active users). |
| **#3** | **Anonymous reads: signed short-lived proxy** (Drive creds held server-side; removes the public key from the client) | **Any evidence of API-key abuse** in the Cloud console (unexplained Drive API usage, quota nearing the limit, 429s in the wild); **OR** Google's announced **2026 quota-overage billing** lands and the key cannot be capped comfortably; **OR** a shared diagram goes viral and exhausts the quota. |
| **#2** | **Sharing: first-party publish-snapshot store** (clean recipient link, custom notification, true snapshots, no per-file visibility gap) | Recipient confusion from the raw-JSON notification email becomes a **validated support burden**; **OR** the product needs share-to-a-non-Drive-user, frozen snapshots, or share analytics. |
| **#4** | **Picker resilience** (non-backend) | The code half shipped in §1; **finalize the cookie/pop-up copy at the P2 prototype gate** when the Picker is exercised with two real Google accounts. Not backend-gated. |

### 3. Sequencing when a trigger fires

- **#1 and #3 are built together** in the same small serverless surface — they
  share infrastructure and, between them, close both of the review's "biggest
  risk" items (deprecated no-refresh auth; public-key quota/abuse). Do not build
  them piecemeal.
- The home is the **existing** [`axoview-worker`](../../packages/axoview-worker)
  (Cloudflare) — new **routes**, not a new deployment. This does **not** reverse
  ADR 0035's serverless topology; it is a small extension of the surface that
  already serves `/api/config`.
- **#2 (snapshot store)** is a larger, product-driven follow-up (needs a DB +
  object store); defer until the raw-JSON-email friction is a validated blocker.
- When a trigger fires, the specific backend item gets its **own design ADR**
  before implementation. This ADR is the deferral + trigger record, not the build
  spec.

### 4. 2026-07-14 addendum — trigger #3 (read proxy) activated early

**#3 is now built** (in its lightweight form), ahead of any external trigger, and the deferral of §2 stands only for **#1 and #2**. Rationale: the P1/P2 prototype gate required creating and configuring `GOOGLE_API_KEY` on the deploy regardless. Shipping the *client-side* key (§1's ops mitigation) meant paying an ongoing tax — the key exposed in the browser, a fragile HTTP-referrer allowlist to maintain, and every viewer hitting Drive uncached (the quota/abuse surface #3 is about). The incremental cost of doing #3 properly was **one route on the existing worker** that already serves `/api/config`. At that point the deferral was net-negative, so we activated it. It stays serverless-topology-preserving (a route, not a new deployment), exactly as §3 anticipated.

- **What shipped:** an unauthenticated, server-side **API-key read proxy** — `GET /api/public/drive/:fileId` — holding `GOOGLE_API_KEY` server-side and relaying public-file reads back to the browser (buffered via `.text()`; `Cache-Control: 60s` is **browser-side dedupe only** — Cloudflare does not edge-cache Function responses without a Cache Rule). This is the *lightweight* variant of #3: the server key + `fileId`-format + 10 MB cap close most of the quota/abuse surface without the review's heavier "signed short-lived URL" mechanism; a per-caller rate limit (below) is the real remaining hedge.
- **Design record:** [ADR 0042 §8](0042-drive-native-sharing-and-readonly-preview.md) (2026-07-14 addendum) — the proxy *is* rung 1 of that ADR's read ladder, not a separable concern, so it lives there rather than in a standalone design ADR (a deliberate exception to §3's "own design ADR" rule, justified by that coupling).
- **Supersedes §1's #3 ops mitigation:** `GOOGLE_API_KEY` is no longer a *public referrer-restricted* key but a **server secret** (`wrangler pages secret put`), API-restricted to the Drive API — no referrer allowlist. `/api/config` exposes only a `drivePublicPreview` boolean, never the key.
- **Still deferred:** **#1 (auth broker)** and **#2 (snapshot store)** — triggers unchanged; they remain the "when it fires, its own design ADR" items. The Google **Picker** (Option B private-grant) still needs a *client-side* key, so it stays dormant until a separate browser Picker key is added — orthogonal to this proxy.
- **Open follow-up (not blocking):** the public proxy is currently protected by `fileId`-format + a 10 MB cap + a browser-side `Cache-Control` (no *edge* cache), but has **no per-caller rate limit**; if the Cloud console shows abuse, add a Cloudflare rate-limit rule or a KV counter (cheap, no new ADR).

## Consequences

**Positive:**

- The serverless trust story ("no server holds your Google credentials") is
  preserved for v1 — the correct, deliberate trade-off for a browser-first app.
- The deferral is now **durable and owner-legible**: a trigger firing produces a
  deliberate, ADR-grounded build rather than a scramble.
- Because #1 and #3 share one Worker surface, a single backend spike closes both
  biggest-risk items — the roadmap has a natural, cheap first step.
- Nothing here blocks the ADR 0042 prototype gates or the drive-native-sharing PR.

**Negative / risks:**

- The triggers are **externally driven** (Chrome cookie timeline, Google billing,
  abuse discovery), so the activation moment is not ours to schedule — we accept
  possibly building under mild time pressure. **Mitigated** by graceful
  degradation already in place: token expiry → reconnect prompt (not data loss),
  429 → `transient` retry, missing grant → sign-in/Picker ladder. The blast radius
  of waiting is bounded.
- When #1/#3 land, Axoview takes on **credential custody** it does not have today:
  a client secret (Worker secret binding) and, for #1, **per-user refresh tokens**
  (KV/D1, encrypted at rest). This is a security responsibility, not a billing one
  — the free tier covers the scale.

## Implementation notes (non-binding)

- **Cost:** Cloudflare Workers free tier covers this scale (~100k req/day; **no
  egress fees**, which is what makes the #3 read-proxy stream viable). Secrets via
  `wrangler secret put` are free; KV/D1 (for #1's refresh-token store) have free
  tiers.
- **#1 mechanics:** the browser runs the PKCE dance and hands the Worker a
  one-time `code` + `code_verifier`; the Worker adds `client_id` +
  **`client_secret`** (encrypted secret binding, `env.GOOGLE_CLIENT_SECRET`, never
  bundled) and POSTs to `oauth2.googleapis.com/token`. Google's *"Web application"*
  OAuth client is confidential — it **requires** the secret even with PKCE. The
  returned **refresh token** is persisted per-user (KV/D1). **Gotcha:** the OAuth
  consent screen must be **"In production"**, not "Testing" — Testing issues
  refresh tokens that **expire in 7 days**. (`drive.file` is non-sensitive, so
  going to production triggers no Google verification/CASA review.) Reuse+store
  refresh tokens per user — Google caps them at 100 per user per client and
  revokes any unused for 6 months.
- **#3 mechanics:** the Worker holds the Drive API key server-side, relays
  `files.get?alt=media` back to the browser (buffered), with a size cap; the
  public API key is then removed from the client bundle. (As built 2026-07-14 —
  see §4; a browser-side `Cache-Control` only, and a per-caller rate limit is the
  open hedge.)
- **#2 mechanics:** a DB + object store publishing a frozen diagram snapshot
  behind a first-party short link with a custom notification — the largest of the
  three; likely its own multi-ADR effort.

## Acceptance criteria

- **This ADR is a decision record.** Its acceptance = the deferral + triggers are
  captured here, and the two no-backend mitigations (§1) shipped in the
  drive-native-sharing PR.
- **When any trigger in §2 fires:** open a design ADR for that specific backend
  item *before* building it, citing the fired trigger.
- **Ops watch items (owner):** (a) Chrome's 3rd-party-cookie rollout, (b) the
  Cloud-console Drive API quota usage / abuse signals, (c) Google's announced 2026
  Drive API quota-overage billing. Any of these maturing is a §2 trigger.
