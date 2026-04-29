# FossFLOW — Deployment Guide

FossFLOW runs on two targets from a single codebase:

| Target | Runtime | Storage | Auth options |
|---|---|---|---|
| **Cloudflare Pages** | Pages Functions (Hono) | R2 | `none`, `shared-token`, `cf-access` |
| **Docker** | Express on Node | Filesystem | `none`, `shared-token` |

Both share a single `/api/*` HTTP contract. The frontend bundle is identical.

---

## A. Cloudflare Pages (from scratch)

### A1. Prerequisites

- Cloudflare account (free plan is fine).
- Node 18+ locally.
- `npx wrangler login` once, in this checkout, before the first deploy.

### A2. Create the R2 bucket

```bash
npx wrangler r2 bucket create fossflow-diagrams
```

The bucket name in [wrangler.toml](wrangler.toml) and [packages/fossflow-worker/wrangler.toml](packages/fossflow-worker/wrangler.toml) must match — leave both at `fossflow-diagrams` unless you change them in lockstep.

### A3. Configure auth (pick one)

**`none`** — public, no token. Fine for personal use behind a non-discoverable URL but not recommended.

**`shared-token`** — single bearer token shared with every editor.

```bash
npx wrangler pages secret put SHARED_TOKEN
# paste the token when prompted
```

In [packages/fossflow-worker/wrangler.toml](packages/fossflow-worker/wrangler.toml) keep `AUTH_MODE = "shared-token"` (the default).

**`cf-access`** — Cloudflare Access JWT (zero-trust). Set up an Access application that fronts your `*.pages.dev` (or custom) domain, then:

```toml
# packages/fossflow-worker/wrangler.toml
[vars]
AUTH_MODE = "cf-access"
CF_ACCESS_TEAM = "your-team"          # the subdomain in <team>.cloudflareaccess.com
CF_ACCESS_AUD  = "<application-aud>"  # from the Access app config
```

### A4. (Optional) Google Drive credentials

To enable the Drive provider, add the OAuth client ID:

```bash
npx wrangler pages secret put GOOGLE_CLIENT_ID
```

The frontend reads this at runtime via `GET /api/config` — no rebuild needed when it changes.

### A5. Deploy

```bash
npm install
npm run build --workspace=packages/fossflow-app
npx wrangler pages deploy packages/fossflow-app/build --project-name fossflow
```

The first deploy creates the Pages project. Subsequent deploys reuse it.

### A6. Smoke test

```bash
# Replace with the URL Wrangler printed
BASE=https://fossflow.pages.dev
TOKEN=<your shared token, or omit -H for AUTH_MODE=none>

curl "$BASE/api/config"
curl "$BASE/api/storage/status"
curl -H "Authorization: Bearer $TOKEN" "$BASE/api/diagrams"
```

Open `$BASE` in a browser. With `shared-token`, the app will fail to list until you set the token in the browser — for now, the simplest way is `AUTH_MODE=none` in front of Cloudflare Access, or use Access alone.

### A7. Path-traversal sanity check

```bash
curl -i "$BASE/api/diagrams/..%2F..%2Fetc%2Fpasswd"
# expect: HTTP/2 400  {"error":"Invalid id"}
```

### A8. One-click "Deploy to Cloudflare"

The repo-root [wrangler.toml](wrangler.toml) is set up so the Cloudflare deploy button works end-to-end. Add this to the README (or anywhere) once published:

```markdown
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/<your-fork>/FossFLOW)
```

The user will be prompted to create the R2 binding and any secrets at install time.

---

## B. Docker

The existing Docker flow is preserved. The same backend now uses the new `routes.js` + `fs` adapter so it serves the same contract Cloudflare does, including the new `/api/config` and share endpoints.

### B1. Build & run

```bash
docker compose up --build
```

Defaults to `AUTH_MODE=none`, `STORAGE_PATH=/data/diagrams`.

### B2. Enable shared-token auth

In `docker-compose.yml` (or the env you pass `docker run`):

```yaml
environment:
  AUTH_MODE: shared-token
  SHARED_TOKEN: ${SHARED_TOKEN}     # set in .env
  ENABLE_SERVER_STORAGE: "true"
  STORAGE_PATH: /data/diagrams
  GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}  # optional, Drive provider
```

`AUTH_MODE=cf-access` is rejected by the Express server at request time — that mode only makes sense behind Cloudflare Access. Use `shared-token` (or front Docker with your own reverse proxy doing auth).

### B3. Smoke test

```bash
BASE=http://localhost:3001
curl "$BASE/api/config"
curl -H "Authorization: Bearer $SHARED_TOKEN" "$BASE/api/diagrams"
```

---

## C. What's the same on both targets

- HTTP contract (every `/api/*` endpoint).
- Public-snapshot share model: `POST /api/diagrams/:id/share` → `{ uuid, url }`. Public reads via `GET /api/public/diagrams/:uuid` are always unauth (these are the only routes that bypass `AUTH_MODE`).
- Body limit: 10 MB per request.
- ID validation: `^[a-zA-Z0-9_-]{1,64}$` — anything else is `400 Invalid id`.
- Drive OAuth scope is locked to `drive.file` (per-file consent only).
- Runtime config (`GET /api/config`) replaces build-time env injection — the frontend bundle never embeds secrets.

## D. What differs

| Concern | Cloudflare | Docker |
|---|---|---|
| Storage | R2 bucket `fossflow-diagrams` | `STORAGE_PATH` on disk |
| Concurrency | R2 etag retry on `diagrams-index.json` | OS filesystem semantics |
| `cf-access` auth | Supported (JWKS RS256 verify) | Rejected (502) |
| Static delivery | CF CDN + `_headers` | nginx (compose stack) |
| Body limit enforcement | Hono `bodyLimit({ maxSize: 10MB })` | `express.json({ limit: '10mb' })` |
| CSP delivery | `_headers` file | nginx config |

---

## E. Troubleshooting

**`401 Unauthorized` on every API call** — `AUTH_MODE=shared-token` is set but the client isn't sending `Authorization: Bearer …`. The frontend currently expects auth to be transparent (CF Access cookie or none). For shared-token, front the deployment with a reverse proxy that injects the header, or use `AUTH_MODE=cf-access` instead.

**R2 writes failing with `412 Precondition Failed`** — concurrent writes to `diagrams-index.json` raced past 3 retries. Re-issue the request; the worker's index-rewrite loop tolerates contention but not unbounded.

**Path-traversal `400 Invalid id`** — expected. IDs are strict NanoID-like alphanum; do not change `assertId` to relax this.

**Build succeeds locally but `wrangler pages deploy` 404s on `/api/*`** — check `packages/fossflow-app/public/_routes.json` was copied into `build/`. Rsbuild copies the `public/` tree by default; if you customize the output, ensure `_routes.json` lands at the build root.
