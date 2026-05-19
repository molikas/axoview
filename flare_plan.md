# Axoview — Cloudflare + Docker Dual-Target Deployment Plan

> **Living document.** Sister to `PLAN.md` (which tracks feature work). This file tracks the multi-runtime deployment effort (Phase 5*).
> Last updated: 2026-04-29

> **2026-04-29 update — Cloudflare runtime is now storage-less.** R2 was dropped to keep the free-tier deploy zero-config. The Worker reports `serverStorage: false` and 503s every storage route; the SPA falls back to session/localStorage. Persistent storage on Cloudflare will return via the Drive provider on a separate branch. Phase rows below reflect this revert: 5B and parts of 5F that were R2-specific are no longer wired up.

---

## Goal

Run the same Axoview app on:

1. **Cloudflare Pages free tier** — static + Pages Functions (Hono) + R2. Near-zero-config "Deploy to Cloudflare" flow.
2. **Docker** — existing nginx + Express + filesystem. Self-hosters keep what they have.

A single `/api/*` HTTP contract. Two runtime adapters underneath. The frontend is unchanged at the network boundary.

---

## How to use this document

Tell Claude: *"Read flare_plan.md and continue Phase 5X."* Claude should:

1. Read this file fully.
2. Run the **Session Startup Checklist** for the target sub-phase.
3. Use `TodoWrite` to track sub-tasks.
4. Mark checkboxes `[x]` as work completes.
5. Update **Phase Status** before ending.

Conventions match `PLAN.md`: `[ ]` not started · `[~]` in progress · `[x]` done · `[!]` blocked.

---

## Phase Status Dashboard

| Phase | Name | Status | Notes |
|---|---|---|---|
| **5A** | Backend refactor: key-based adapter + path-traversal fix | `[x]` | Docker-only, behavior-preserving. Unblocks all of 5. |
| **5B** | Cloudflare Worker package + R2 adapter + diagrams-index + share routes | `[~]` | **Reverted to storage-less.** Worker package + Hono + auth shipped; R2 adapter and share routes live only on the Docker (fs) backend. R2 will return via the Drive branch in a different shape. |
| **5C** | Build & deploy pipeline (`wrangler.toml`, `_routes.json`, `_headers`, deploy button) | `[x]` | Depends on 5B. |
| **5D** | Auth modes (`none` / `shared-token` / `cf-access`) + public-namespace bypass | `[x]` | Public bypass extended to `/api/config` and `/api/storage/status` so the SPA can boot under `shared-token`. |
| **5E** | Frontend `/api/config` runtime config + share rewire + delete legacy `storageService.ts` | `[x]` | Depends on 5A. Can run parallel with 5D. |
| **5F** | Hardening pass (CSP, helmet, body limits, scope lockdown) | `[~]` | Helmet + body limits + CSP + secure-headers shipped. R2-specific items (bucket privacy, etag retries) deferred with 5B. |
| **5G** | `DEPLOY.md` + Drive-credentials onboarding stub | `[x]` | See [DEPLOY.md](DEPLOY.md). Rewritten 2026-04-29 to match the storage-less reality. |

---

## Architectural decisions (locked)

### 1. One HTTP contract, two backends

Both targets serve the routes the frontend already calls in
[LocalStorageProvider.ts](packages/axoview-app/src/services/storage/providers/LocalStorageProvider.ts):

```
GET    /api/storage/status
GET    /api/config                  (NEW)
GET    /api/diagrams
GET    /api/diagrams/:id
POST   /api/diagrams
PUT    /api/diagrams/:id
PATCH  /api/diagrams/:id
PATCH  /api/diagrams/:id/move
DELETE /api/diagrams/:id
GET    /api/folders
POST   /api/folders
PUT    /api/folders/:id
PATCH  /api/folders/:id/move
DELETE /api/folders/:id
GET    /api/tree-manifest
PUT    /api/tree-manifest
POST   /api/diagrams/:id/share      (NEW — publish snapshot, returns { uuid, url })
DELETE /api/diagrams/:id/share      (NEW — unpublish snapshot)
GET    /api/public/diagrams/:uuid   (NEW — unauth snapshot read)
```

Note: `/api/storage/status` is consumed by [LocalStorageProvider.ts:64](packages/axoview-app/src/services/storage/providers/LocalStorageProvider.ts#L64) and must be answered by both adapters (Worker always returns `{ enabled: true }` since R2 is always present).

### 2. Key-based StorageAdapter (no paths in the interface)

The adapter never sees a filesystem path. It only knows opaque keys:

```ts
// packages/axoview-backend/src/adapters/types.ts
export interface StorageAdapter {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;          // returns keys, not paths
  listDiagramMeta(): Promise<DiagramMeta[]>;        // adapter-specific impl
}
```

- `fsAdapter` converts `diagrams/abc123` → `path.join(STORAGE_PATH, 'diagrams', 'abc123.json')`. The route layer cannot construct a path.
- `r2Adapter` uses keys verbatim against the R2 binding.
- `listDiagramMeta` is a method, not a derived list, because the two adapters implement it very differently (fs walks the directory; R2 reads a denormalized index — see point 5).

### 3. Cloudflare runtime: Hono on Pages Functions

Express does not run cleanly on Workers even with `nodejs_compat`. Hono is ~14 kB, edge-native, and maps 1:1 to the existing routes. The bridge:

```ts
// functions/api/[[path]].ts
import { handle } from 'hono/cloudflare-pages';
import app from '../../packages/axoview-worker/src/app';
export const onRequest = handle(app);
```

`_routes.json` scopes the Function to `/api/*` only, so static asset requests bypass the Worker (zero CPU cost, served by Cloudflare CDN).

### 4. Storage on free tier: R2 only

- R2: 10 GB free, S3-compatible, perfect for one-JSON-per-diagram.
- Skip KV (1 k writes/day cap kills tree-manifest saves).
- Skip D1 unless we add multi-user (deferred).

### 5. R2 must denormalize a diagrams index — core, not optional

`listDiagrams` over R2 cannot fetch every object (N round-trips, CPU limit, egress cost). The `R2Adapter` maintains:

```
R2:
  diagrams/<id>.json          one per diagram
  folders.json                folder tree
  tree-manifest.json          UI state (open/close, ordering)
  diagrams-index.json         denormalized [{id,name,lastModified,folderId,deletedAt}, ...]
  public/<uuid>.json          shareable snapshots (see #8); unauth-readable
```

`diagrams-index.json` is updated on every `put`/`delete`/`patch` of a diagram. The fsAdapter does **not** need this index (cheap directory walk), so the index is internal to `R2Adapter` — it does not appear in `StorageAdapter`.

**Write-contention caveat:** R2 has no transactions; concurrent writers can clobber the index. Mitigations, in order of preference:

1. Single-user app (current assumption) → no contention possible.
2. Conditional writes: R2 supports `If-Match: <etag>`. On conflict, re-read, re-merge, retry (max 3 attempts).
3. Future: move index to Durable Objects (paid path).

Implement (1) for v1, (2) before any "share with team" feature ships.

### 6. Runtime config, not build-time

New `GET /api/config` returns:

```json
{
  "googleClientId": "<from env>",
  "driveScopes": ["https://www.googleapis.com/auth/drive.file"],
  "authMode": "none" | "shared-token" | "cf-access",
  "serverStorage": true
}
```

The frontend boots, calls `/api/config` first, then constructs `GoogleDriveProvider` with the values. **Swapping client ID requires no rebuild** — that's the autoconfig piece. Client ID is public by design (browser-embedded). API keys with elevated scopes never leave the server.

### 7. No `axoview-core` package — colocate, don't extract

Routing logic lives in `packages/axoview-backend/src/routes.js` with **zero Node-specific imports**. Express stays in `server.js`; fs stays in `adapters/fs.js`. The Worker imports `../axoview-backend/src/routes.js` directly. Tree-shaking is a non-issue because `routes.js` doesn't import Express or fs at all.

If shared surface grows beyond one file, promote to `axoview-core` then. Not now.

### 8. Sharing model: snapshot to a public namespace

`/display/<diagramId>` reads the live diagram and is gated by `AUTH_MODE`. To share with someone outside the auth boundary (no Basic Auth password, not in the Cloudflare Access policy, doesn't own the source Drive), the app **publishes an immutable snapshot** to a public namespace.

Why a snapshot, not a live cross-user read:

- Drive provider stores files under `drive.file` scope — invisible to any user other than the owner. A live read across users isn't possible without escalating to broader Drive scopes (which we won't do per #5F).
- Snapshot is source-agnostic: same UX whether the diagram lives on local fs, R2, or Drive.
- Free Cloudflare tier has no shared metadata layer (no D1) — R2-as-public-blob is the simplest fit.
- Viewers don't see in-progress edits; re-share is explicit.

Endpoints:

- `POST /api/diagrams/:id/share` → `{ uuid, url }`. Reads the current diagram, writes `public/<uuid>.json`, persists `shareUuid` on the source diagram. Idempotent — re-share refreshes the snapshot, uuid stays stable.
- `DELETE /api/diagrams/:id/share` → deletes `public/<uuid>.json`, clears `shareUuid`.
- `GET /api/public/diagrams/:uuid` → unauth read. The **only** route the auth middleware skips (see #5D).

Frontend:

- Share link becomes `/display/p/<uuid>` (not `/display/<id>`). New readonly route fetches `/api/public/diagrams/:uuid`. The existing `/display/<id>` stays — it's the authed "open in new tab" path for the owner.
- `handleCopyShareLink` in [FileExplorer.tsx:299](packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx#L299) calls `POST /api/diagrams/:id/share` first, then copies the returned `url`.

Validation and storage:

- `uuid` matches `/^[a-zA-Z0-9_-]{21,64}$/` (NanoID-compatible). Validated identically in routes and adapters per #2.
- Snapshots are not listed by `diagrams-index.json` — they're addressable only by uuid, never enumerated.
- R2 free tier (10 GB) holds ~100 k snapshots at 100 KB each. Cost is not a constraint.

---

## Folder layout (target)

```
packages/
  axoview-app/                     # unchanged at the boundary
  axoview-backend/
    server.js                       # Express bootstrap
    src/
      routes.js                     # framework-agnostic, zero Node imports
      adapters/
        types.ts                    # StorageAdapter interface
        fs.js                       # Node fs adapter (Docker)
  axoview-worker/                  # NEW
    src/
      app.ts                        # Hono app
      r2Adapter.ts                  # R2 binding adapter
      auth.ts                       # CF-Access JWT verifier + shared-token check
    wrangler.toml
    package.json
functions/
  api/[[path]].ts                   # Pages Functions bridge → Hono
public/                             # served by Pages
_headers                            # CSP, security headers
_routes.json                        # scope Functions to /api/*
wrangler.toml                       # repo-root, used by "Deploy to Cloudflare"
```

---

## Phase details

### Phase 5A — Backend refactor (Docker-only, behavior-preserving)

**Why first:** unblocks everything; also fixes a real path-traversal bug.

- [ ] Define `StorageAdapter` interface in `packages/axoview-backend/src/adapters/types.ts`.
- [ ] Move all logic from `server.js` into `routes.js` taking `(adapter, req, res)`. No Express types in `routes.js`.
- [ ] Implement `fsAdapter.js` from existing fs code in `server.js`.
- [ ] **Security: validate every `:id` and `parentId`** with `/^[a-zA-Z0-9_-]{1,64}$/` before passing to the adapter. Currently [server.js:118](packages/axoview-backend/server.js#L118), [server.js:174](packages/axoview-backend/server.js#L174), and several other handlers feed user input straight to `path.join`. Combined with the key abstraction in (2), this gives defense in depth.
- [ ] Add `GET /api/config` endpoint reading `GOOGLE_CLIENT_ID`, `DRIVE_SCOPES`, `AUTH_MODE`, `SERVER_STORAGE` from env.
- [ ] Add `GET /api/storage/status` to the route table (already served by `server.js` — keep behavior identical via the adapter).
- [ ] Add share endpoints (`POST`/`DELETE /api/diagrams/:id/share`, `GET /api/public/diagrams/:uuid`) backed by `fsAdapter` writing to `STORAGE_PATH/public/<uuid>.json`. Validate `uuid` per #8.
- [ ] Wire `helmet` (already in root `package.json`) into `server.js`.
- [ ] Re-run Docker build; confirm `compose.dev.yml` still works.
- [ ] Existing unit tests pass without changes.

**Done when:** Docker behavior is identical, `id` traversal attempts return 400, `helmet` headers visible, `/api/config` returns expected shape.

### Phase 5B — Cloudflare Worker package + R2 adapter

- [ ] New `packages/axoview-worker` with `hono`, `@hono/zod-validator`, `wrangler`.
- [ ] `app.ts`: Hono router that imports `routes.js` and dispatches per route. Use `bodyLimit` middleware (10 MB).
- [ ] `r2Adapter.ts` implementing `StorageAdapter`:
  - `diagrams/<id>` → R2 object key.
  - `folders.json`, `tree-manifest.json`, `diagrams-index.json` at root.
  - `public/<uuid>` → snapshot key (per #8). Snapshots never appear in `diagrams-index.json`.
  - `listDiagramMeta` reads `diagrams-index.json` only.
  - Every diagram `put`/`patch`/`delete` updates `diagrams-index.json`.
- [ ] Implement share routes in `routes.js` (shared with Docker per 5A): `POST /api/diagrams/:id/share` writes `public/<uuid>.json` and persists `shareUuid` on the source diagram; `DELETE` cleans both; `GET /api/public/diagrams/:uuid` is the only unauth route.
- [ ] `wrangler.toml` bindings: `R2_BUCKET`, `GOOGLE_CLIENT_ID`, `AUTH_MODE`, optionally `AUTH_SHARED_SECRET`, `CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`.
- [ ] Local dev: `wrangler pages dev` against `packages/axoview-app/build`.
- [ ] Stub deploy and confirm bundle size < 1 MB.

**Done when:** Worker can list/read/write/delete a diagram in R2; index stays consistent across CRUD; `wrangler pages dev` serves the SPA + API end to end.

### Phase 5C — Build & deploy pipeline

- [ ] Repo-root `wrangler.toml` so the [Deploy to Cloudflare button](https://developers.cloudflare.com/workers/platform/deploy-buttons/) works against the GitHub repo.
- [ ] Build command (Cloudflare Pages dashboard): `npm install && npm run build`. Output: `packages/axoview-app/build`.
- [ ] `functions/api/[[path]].ts` exporting the Hono app via `hono/cloudflare-pages`.
- [ ] `_routes.json`: include `/api/*`, exclude everything else (so static is served by CDN, Worker isn't invoked for assets).
- [ ] `_headers` file:
  ```
  /*
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: geolocation=(), microphone=(), camera=()
    Content-Security-Policy: default-src 'self'; script-src 'self' https://accounts.google.com https://apis.google.com; connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; frame-src https://accounts.google.com
  ```
  *(`'unsafe-inline'` for styles only — verify whether MUI/Tailwind needs it; aim to remove later.)*
- [ ] README "Deploy to Cloudflare" button + 5-step guide: fork → click → name R2 bucket → set `AUTH_MODE` → done. Drive credentials added later via dashboard.

**Done when:** Pushing to `master` deploys; static assets serve from CDN (verified via response headers); `/api/*` hits the Worker.

### Phase 5D — Auth (security, configurable)

Three modes selected by `AUTH_MODE` env var, evaluated in `app.ts` middleware before route handlers:

1. **`none`** — local dev only. Worker logs a warning at startup.
2. **`shared-token`** — header `Authorization: Bearer <secret>`. Secret stored via `wrangler secret put AUTH_SHARED_SECRET` (Cloudflare) or env var (Docker). Frontend sends header from a value the user types into a "Connect" dialog (kept in `localStorage`, never in source).
3. **`cf-access`** — verify `Cf-Access-Jwt-Assertion` against Cloudflare's JWKS at `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, with audience match. **Fail closed if the JWT is missing, invalid, or expired.** Do not skip auth on mere header presence — anyone hitting the Worker URL directly (e.g., `*.pages.dev` if not locked down) can spoof headers. Lock down the deploy with a Cloudflare Access policy on the production hostname.
4. **HTTP Basic via nginx** continues to exist for Docker — it sits in front of Express and is orthogonal to `AUTH_MODE`. **Exception for shares:** nginx must allow unauth `GET /api/public/diagrams/*` and `GET /display/p/*`, otherwise share links are unusable. Document the snippet in `DEPLOY.md`.

**Public-namespace bypass:** auth middleware (in `app.ts` for the Worker; nginx config for Docker) lets `GET /api/public/diagrams/:uuid` through unconditionally. This is the single hole in the auth wall and is intentional per #8. No other route — including `POST /api/diagrams/:id/share` — bypasses auth: only the *owner* can publish or unpublish.

When Phase 3B (Drive provider) lands, Drive sign-in is *identity*, not access control; one of the four above must still gate the deployment.

**Done when:** All three modes pass a curl-based smoke test; `cf-access` rejects a forged header; secrets are not present in `wrangler.toml`.

### Phase 5E — Frontend wiring

- [ ] New `useRuntimeConfig()` hook. Fetches `/api/config` once, caches in `AppStorageContext`, exposes `googleClientId`, `authMode`.
- [ ] `AppStorageContext` waits for `useRuntimeConfig()` before initializing providers; pass `googleClientId` into `GoogleDriveProvider` constructor (consumed when Phase 3B lands).
- [ ] **Delete legacy** [storageService.ts](packages/axoview-app/src/services/storageService.ts). Already superseded by [storage/StorageManager.ts](packages/axoview-app/src/services/storage/StorageManager.ts). Keeping it doubles risk surface and is a known source of drift.
- [ ] Rewire share UX per #8:
  - [FileExplorer.tsx:299](packages/axoview-app/src/components/fileExplorer/FileExplorer.tsx#L299) calls `POST /api/diagrams/:id/share`, copies the returned `url`. Same change in [AppToolbar.tsx:65](packages/axoview-app/src/components/AppToolbar.tsx#L65) and [DiagramManager.tsx:87](packages/axoview-app/src/components/DiagramManager.tsx#L87).
  - Add `/display/p/:shareUuid` route in [App.tsx:45](packages/axoview-app/src/App.tsx#L45). The readonly path in [DiagramLifecycleProvider.tsx:135](packages/axoview-app/src/providers/DiagramLifecycleProvider.tsx#L135) loads via `GET /api/public/diagrams/:uuid` and **must skip** the diagram-list/folder/tree-manifest fetches (otherwise unauth viewers trigger 401s and 3 wasted Worker invocations per share view).
  - Existing `/display/:id` stays for owner-side "open in new tab"; no change.
- [ ] Confirm relative `/api/*` paths work everywhere — `devBaseUrl()` only redirects on `localhost:3000`, so production builds already use relative paths.

**Done when:** `/api/config` is the single source of OAuth config; legacy file is gone; build still passes.

### Phase 5F — Hardening pass

- [ ] Key validation in **both** adapters (defense in depth) — even though `routes.js` already validates, adapters re-check.
- [ ] Hono `bodyLimit` middleware: 10 MB to match Express limit.
- [ ] Express `helmet` enabled (Phase 5A item, re-verified here).
- [ ] CSP audit: identify which inline styles are required, document or remove.
- [ ] Drive scope locked to `drive.file` (per-app file access). Never `drive` (full Drive). Document this in `flare_plan.md` and in Phase 3B plan.
- [ ] R2 bucket must be private (no public dev URL). Document in deploy guide.
- [ ] Add `X-Content-Type-Options: nosniff` to Worker responses (covered by `_headers` for static; ensure Worker echoes it for JSON responses too).

### Phase 5G — Docs

- [ ] `DEPLOY.md`: Docker section (existing) + Cloudflare section (new) + decision matrix.
- [ ] One-paragraph "How auth works on each target."
- [ ] Drive setup stub: env vars to set; deferred to Phase 3B for the actual flow.
- [ ] Cross-link from `PLAN.md` Phase Status Dashboard ("Deployment work tracked in `flare_plan.md`").

---

## Open risks / things to verify before starting

- **Worker bundle size.** Hono + R2 adapter + JWT verifier should stay under 1 MB. Confirm with a stub deploy in 5B before porting all routes.
- **R2 list pagination.** `listDiagrams` against the index is fine; raw `list(prefix)` calls must page (`cursor`) once we cross 1000 objects. Implement once, ignore until needed.
- **Index write contention.** v1 = single user, no problem. Document the limitation; revisit before any team-shared deploy.
- **MUI inline styles vs strict CSP.** Loose `'unsafe-inline'` for styles is the start; tighten in 5F if MUI doesn't require it.
- **`*.pages.dev` exposure.** A Cloudflare Pages deploy is reachable at the project's `*.pages.dev` subdomain even with a custom domain. CF-Access policies must cover both, or `AUTH_MODE` must default-deny.
- **Share-snapshot staleness.** Per #8, snapshots are immutable until re-shared. Surface this in the Share UI (e.g., show "Last shared: 2h ago — re-share to update"). Without that affordance, owners will assume edits propagate and won't.
- **Share secrecy model.** `public/<uuid>` is unguessable but not ACL'd — anyone with the link reads the snapshot. This is the same posture as Drive's "anyone with link" and Google Docs' default share. Document explicitly in `DEPLOY.md`.
- **R2 bucket privacy.** The bucket itself must remain private (no public dev URL per #5F). Snapshots reach the public via the Worker's unauth route, never via direct R2 URLs. If the bucket is ever flipped to public-read, every diagram becomes enumerable.

---

## Order of operations

```
5A ──┬── 5B ── 5C ──┬── 5F ── 5G
     └── 5E ────────┘
                 │
                 └── 5D
```

5A is the unlock. 5D and 5E are independent of each other once 5C is up. 5F gates the docs in 5G.
