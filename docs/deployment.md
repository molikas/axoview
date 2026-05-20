# Axoview — Deployment Guide

Axoview runs on three targets from a single codebase:

| Target | Runtime | Storage | Auth options |
|---|---|---|---|
| **Local dev** | `npm run dev` (rsbuild on :3000 + Express on :3001) | Filesystem if `ENABLE_SERVER_STORAGE=true`, else session | `none`, `shared-token` |
| **Docker** | nginx + Express on Node | Filesystem volume | `none`, `shared-token` |
| **Cloudflare Pages** | Pages Functions (Hono) | **None — session/localStorage only** | `none`, `shared-token`, `cf-access` |

The frontend bundle is identical across all three. The Cloudflare deployment is currently storage-less — `/api/config` returns `serverStorage: false` and the client falls back to session storage. A persistent backend on Cloudflare (Drive integration) is tracked on a separate branch.

Both backends share a single `/api/*` HTTP contract. Three routes are public on every target:

- `GET /api/config`
- `GET /api/storage/status`
- `GET /api/public/diagrams/:uuid`

Everything else is gated by `AUTH_MODE`.

---

## A. Local development

```bash
npm install
npm run dev              # SPA on http://localhost:3000
npm run dev:backend      # Express on http://localhost:3001 (separate terminal)
```

The SPA's `apiBaseUrl()` ([packages/axoview-app/src/utils/apiBaseUrl.ts](packages/axoview-app/src/utils/apiBaseUrl.ts)) auto-redirects `/api/*` to `:3001` when the host is `localhost:3000`. In every other context it uses same-origin relative paths.

To exercise the filesystem path, run the backend with:

```bash
ENABLE_SERVER_STORAGE=true STORAGE_PATH=./diagrams npm run dev:backend
```

Otherwise the app falls back to `sessionStorage`.

---

## B. Docker

```bash
docker compose up --build
```

Defaults to `AUTH_MODE=none`, `ENABLE_SERVER_STORAGE=true`, `STORAGE_PATH=/data/diagrams`.

### Enable shared-token auth

```yaml
environment:
  AUTH_MODE: shared-token
  AUTH_SHARED_SECRET: ${AUTH_SHARED_SECRET}    # set in .env
  ENABLE_SERVER_STORAGE: "true"
  STORAGE_PATH: /data/diagrams
  GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}        # optional, surfaced via /api/config
```

`AUTH_MODE=cf-access` is rejected by Express at request time — that mode only makes sense behind Cloudflare Access.

### Smoke test

```bash
BASE=http://localhost:3001
curl "$BASE/api/config"
curl -H "Authorization: Bearer $AUTH_SHARED_SECRET" "$BASE/api/diagrams"
```

---

## C. Cloudflare Pages

### C1. Prerequisites

- Cloudflare account (free plan).
- `npx wrangler login` once before the first deploy.

### C2. Configure auth (pick one)

**`none`** — public, no token. The default for the storage-less PoC. Fine for read-only demos.

**`shared-token`** — single bearer token shared with every editor.

```bash
npx wrangler pages secret put AUTH_SHARED_SECRET
# paste the token when prompted
```

In [packages/axoview-worker/wrangler.toml](packages/axoview-worker/wrangler.toml) keep `AUTH_MODE = "shared-token"` (the default).

**`cf-access`** — Cloudflare Access JWT (zero-trust). Set up an Access application that fronts your `*.pages.dev` (or custom) domain, then:

```toml
# packages/axoview-worker/wrangler.toml
[vars]
AUTH_MODE = "cf-access"
CF_ACCESS_TEAM_DOMAIN = "your-team"     # the subdomain in <team>.cloudflareaccess.com
CF_ACCESS_AUD         = "<application-aud>"
```

### C3. (Optional) Google Drive client ID

The Drive provider is implemented on a separate branch. Once that lands, configure:

```bash
npx wrangler pages secret put GOOGLE_CLIENT_ID
```

The frontend reads this at runtime via `GET /api/config` — no rebuild needed when it changes.

### C4. Deploy

```bash
npm install
npm run build
npx wrangler pages deploy packages/axoview-app/build --project-name axoview
```

The first deploy creates the Pages project. Subsequent deploys reuse it.

### C5. Smoke test

```bash
BASE=https://axoview.pages.dev
curl "$BASE/api/config"             # always public, returns serverStorage: false
curl "$BASE/api/storage/status"     # always public, returns enabled: false
curl -i "$BASE/api/diagrams"        # 503 — storage disabled
```

With `AUTH_MODE=shared-token`, both `/api/config` and `/api/storage/status` remain unauthenticated so the SPA can boot. Every other `/api/*` route requires the bearer token.

### C6. One-click "Deploy to Cloudflare"

The repo-root [wrangler.toml](wrangler.toml) is set up so the deploy button works against a fork:

```markdown
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/<your-fork>/Axoview)
```

---

## D. What's the same on every target

- HTTP contract for every `/api/*` endpoint the frontend calls.
- Public routes that bypass auth: `GET /api/config`, `GET /api/storage/status`, `GET /api/public/diagrams/:uuid`.
- Body limit: 10 MB per request.
- ID validation: `^[a-zA-Z0-9_-]{1,64}$` — anything else is `400 Invalid id` (Docker only; Cloudflare 503s before reaching the validator).
- Drive OAuth scope is locked to `drive.file` (per-file consent only) once the Drive branch lands.
- Runtime config (`GET /api/config`) replaces build-time env injection — the frontend bundle never embeds secrets.

## E. What differs

| Concern | Cloudflare | Docker |
|---|---|---|
| Storage | None — session/localStorage on the client | `STORAGE_PATH` on disk |
| `cf-access` auth | Supported (JWKS RS256 verify) | Rejected (500) |
| Static delivery | CF CDN + `_headers` | nginx (compose stack) |
| Body limit enforcement | Hono `bodyLimit({ maxSize: 10MB })` | `express.json({ limit: '10mb' })` |
| CSP delivery | `_headers` file | nginx config |

---

## F. Troubleshooting

**`401 Unauthorized` on every API call** — `AUTH_MODE=shared-token` is set but the client isn't sending `Authorization: Bearer …`. The SPA does not currently inject the header itself; front the deployment with a reverse proxy that injects it, or use `AUTH_MODE=cf-access`, or run with `AUTH_MODE=none`.

**Cloudflare deploy returns `503 Server storage is disabled` on `/api/diagrams`** — expected. The current Cloudflare runtime is storage-less. Use the Docker target for persistent storage, or wait for the Drive branch to merge.

**Path-traversal `400 Invalid id`** (Docker) — expected. IDs are strict NanoID-like alphanum; do not relax `assertId`.

**Build succeeds locally but `wrangler pages deploy` 404s on `/api/*`** — check that [packages/axoview-app/public/_routes.json](packages/axoview-app/public/_routes.json) was copied into `build/`. Rsbuild copies the `public/` tree by default.
