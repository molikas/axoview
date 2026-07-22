# Axoview — Deployment Guide

**Last updated:** 2026-07-15 (docs housekeeping — repaired 4 code links that were missing their `../` prefix. Content last changed 2026-07-14: §C3 rewritten for the Drive **server read-proxy** + `GOOGLE_API_KEY` as a Cloudflare secret — [ADR 0042](adr/0042-drive-native-sharing-and-readonly-preview.md) §8 / [0043](adr/0043-deferred-backend-for-google-api-hardening.md) #3. Prior: 2026-07-07 Google Drive storage shipped.)

Axoview runs on three targets from a single codebase:

| Target | Runtime | Storage | Auth options |
|---|---|---|---|
| **Local dev** | `npm run dev` (rsbuild on :3000 + Express on :3001) | Filesystem if `ENABLE_SERVER_STORAGE=true`, else session (+ Google Drive when configured) | `none`, `shared-token` |
| **Docker** | nginx + Express on Node | Filesystem volume | `none`, `shared-token` |
| **Cloudflare Pages** | Advanced-mode `_worker.js` (Hono) + `AGENT_SESSION` Durable Object | **Session/localStorage + Google Drive** (per-user, client-side) | `none`, `shared-token`, `cf-access` |

The frontend bundle is identical across all three. The Cloudflare deployment has no server-side storage — `/api/config` returns `serverStorage: false` — but ships the **Google Drive place** ([ADR 0036](adr/0036-google-drive-storage-provider.md), [ADR 0037](adr/0037-storage-places-model.md)): a signed-in user's diagrams persist in their own Drive, entirely client-side.

> ⚠️ **Single-tenant per deploy.** Axoview's storage layer assumes **one user per deployment** (see [ADR 0010 §D4](adr/0010-session-backend-contract.md)). Multi-user self-host requires operator-managed isolation — one container per user, a Cloudflare Access policy, or a network ACL. **`AUTH_MODE=shared-token` is not a team password — it is a single bearer token.** A team using one Docker deploy + `shared-token` will share every diagram across every user. If you need per-user isolation, deploy one instance per user — or use the Drive place, which is per-Google-account by construction.

Both backends share a single `/api/*` HTTP contract. Two routes are public on every target:

- `GET /api/config`
- `GET /api/public/diagrams/:uuid`

Everything else is gated by `AUTH_MODE`.

---

## A. Local development

```bash
npm install
npm run dev              # SPA on http://localhost:3000
npm run dev:backend      # Express on http://localhost:3001 (separate terminal)
```

The SPA's `apiBaseUrl()` ([packages/axoview-app/src/utils/apiBaseUrl.ts](../packages/axoview-app/src/utils/apiBaseUrl.ts)) auto-redirects `/api/*` to `:3001` when the host is `localhost:3000`. In every other context it uses same-origin relative paths.

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

`GOOGLE_CLIENT_ID` (public identifier) enables Google sign-in + the user's own
Drive as storage. **Anonymous read-only preview is NOT available on Docker** —
the read proxy (`/api/public/drive/:id`) lives only in the Cloudflare worker
([ADR 0042 §8](adr/0042-drive-native-sharing-and-readonly-preview.md)), so the
Express backend emits `drivePublicPreview: false` and does not use `GOOGLE_API_KEY`.
Drive sharing itself (share dialog, copy-link, owner preview) still works.

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

In [packages/axoview-worker/wrangler.toml](../packages/axoview-worker/wrangler.toml) keep `AUTH_MODE = "shared-token"` (the default).

**`cf-access`** — Cloudflare Access JWT (zero-trust). Set up an Access application that fronts your `*.pages.dev` (or custom) domain, then:

```toml
# packages/axoview-worker/wrangler.toml
[vars]
AUTH_MODE = "cf-access"
CF_ACCESS_TEAM_DOMAIN = "your-team"     # the subdomain in <team>.cloudflareaccess.com
CF_ACCESS_AUD         = "<application-aud>"
```

### C3. (Optional) Google Drive client ID & sharing key

Enables the Google Drive place (sign-in, Drive storage, move-to-Drive). The
client ID is a **public OAuth identifier, not a secret** — it is committed as a
`[vars]` entry in [packages/axoview-worker/wrangler.toml](../packages/axoview-worker/wrangler.toml)
(kept in lockstep with the repo-root `wrangler.toml` per ADR 0009 Decision 5):

```toml
# packages/axoview-worker/wrangler.toml
[vars]
GOOGLE_CLIENT_ID = "<your-client-id>.apps.googleusercontent.com"
```

The frontend reads it at runtime via `GET /api/config` — no rebuild needed when
it changes. Without it, the app runs session-only (no sign-in affordances).

Two further optional values ([ADR 0042 §8](adr/0042-drive-native-sharing-and-readonly-preview.md) /
[ADR 0043 #3](adr/0043-deferred-backend-for-google-api-hardening.md)):

- `GOOGLE_API_KEY` powers the **anonymous read proxy** `GET /api/public/drive/<fileId>`,
  which serves "anyone with the link" Drive diagrams at `/app/display/drive/<fileId>`
  with **no sign-in**. Since 2026-07-14 the key stays **server-side and is never
  shipped to the browser**, so set it as a **secret**, not a `[vars]` entry:

  ```bash
  npx wrangler pages secret put GOOGLE_API_KEY --project-name axoview
  # or: Cloudflare dashboard → Pages → axoview → Settings → Variables and Secrets,
  #     set it under BOTH the Production and Preview environments.
  ```

  Create it in the same Cloud project as the OAuth client, **API-restricted to
  the Google Drive API**. Because it is only ever called server-side (from the
  Worker), it needs **no HTTP-referrer restriction** — that whole allowlist goes
  away. `/api/config` exposes only a `drivePublicPreview` boolean (`!!GOOGLE_API_KEY`),
  never the key. With it set, the owner flips **"Anyone with the link → can view"**
  in the share dialog and the recipient's link renders with no login.
- `GOOGLE_PROJECT_NUMBER` (`/api/config` → `googleProjectNumber`; a plain `[vars]`
  entry — not secret) is the Cloud project **NUMBER** the Google Picker's
  `setAppId` needs for the **private-file grant flow (Option B)**. Its own value —
  do NOT derive it from the client-id prefix; a wrong value makes the grant fail
  silently. The Picker also needs a *browser* API key (`setDeveloperKey`), which
  is **not** wired now (the server key is server-only), so Option B stays dormant
  until a separate referrer-restricted browser key is added. Option A (public
  links) needs none of this.

If `GOOGLE_API_KEY` is unset, Drive sharing still works (share dialog, copy-link,
owner preview) but anonymous preview degrades to the sign-in path.

### C4. Deploy

```bash
npm install
npm run build
npx wrangler pages deploy packages/axoview-app/build --project-name axoview
```

The first deploy creates the Pages project. Subsequent deploys reuse it.

### C5. Smoke test

```bash
BASE=https://axoview.app
curl "$BASE/api/config"             # always public, returns serverStorage: false
curl -i "$BASE/api/diagrams"        # 503 — storage disabled
```

With `AUTH_MODE=shared-token`, `/api/config` remains unauthenticated so the SPA can boot. Every other `/api/*` route requires the bearer token (`GET /api/public/diagrams/:uuid` is also public, but is the read-only share-snapshot route, not a boot probe).

### C6. One-click "Deploy to Cloudflare"

The repo-root [wrangler.toml](../wrangler.toml) is set up so the deploy button works against a fork:

```markdown
[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/<your-fork>/Axoview)
```

### C7. Remote MCP bridge — Cloudflare only ([ADR 0046](adr/0046-mcp-session-bridge-topology.md))

The pluggable-AI-agent MCP bridge (`/mcp/*`, `/pair/*`) is **Cloudflare-only** —
**not available on Docker / self-host** (no Durable Objects), a documented gap
([ADR 0046 §1](adr/0046-mcp-session-bridge-topology.md)), mirroring the Drive
read-proxy asymmetry.

**Topology (2026-07-22): the whole bridge is a SEPARATE Worker.** Cloudflare **Pages
cannot host a Durable Object** — it rejects `[[migrations]]` and DO definitions. So
the MCP bridge (`/mcp`, `/pair`) + the `AgentSessionDO` run entirely as a standalone
Worker named **`axoview-mcp`** ([wrangler.mcp.toml](../packages/axoview-worker/wrangler.mcp.toml),
entry [mcpWorker.ts](../packages/axoview-worker/src/mcpWorker.ts)), on its own
`workers.dev` URL. **Pages carries no DO binding** and serves only the app + Drive
proxy — so the two deploys are fully independent (the Pages build never waits on the
Worker).

**Deploying the bridge is now CI-automated** ([deploy-mcp.yml](../.github/workflows/deploy-mcp.yml)).
Cloudflare's git integration deploys **only** the Pages project — it never touches a
Worker — so before this workflow existed, a merge updated the UI but left the
`axoview-mcp` worker running the old bundle (contract plumbing shipped to the repo
but not to production, invisibly). The workflow closes that gap:

- **On merge to master** (gated on **Run Tests** passing) it runs
  `npm run -w axoview-worker deploy:mcp` and then **smoke-checks** the live endpoint:
  mint a pairing code → `initialize` → assert `serverInfo.version` equals what was
  just deployed. A stale bundle fails the job.
- **On PRs** touching `packages/axoview-worker/**` or `packages/axoview-lib/src/agent/**`
  it uploads a **preview version** (`wrangler versions upload`) and prints the preview
  URL to the job summary — paste it into **✨ Connect your AI** to test before merge.

> **Scope of the smoke check.** It proves *which worker bundle is live*, not that a
> given op works. The worker is a pure protocol **router** — the op vocabulary
> (`create_node.headerLink`, connector waypoints, `radial` layout, node kinds,
> `create_text` orientation) lives in **axoview-lib** and reaches the agent through
> the **browser tab**, i.e. via the **Pages** deploy, not this worker. An op
> round-trip needs a live tab and so can't run headlessly. Keep the op-vocab
> lockstep on the Pages side: `opSchemas.ts` ↔ `modelingSkill.ts` ↔ the eval suite.

**`serverInfo.version` is the "what's live" signal.** CI injects a moving value at
deploy time — `wrangler deploy --var AGENT_SERVER_VERSION:1.0.0-track-a+<git-sha>` —
so a client's `initialize` reveals the exact commit serving. The `AGENT_SERVER_VERSION`
constant in `app.ts` is only the local-`wrangler dev` fallback (no `--var` there).

**Two Cloudflare projects, one CI target.** The Pages project is named **`axoview`**
(root `wrangler.toml`, `pages_build_output_dir`) and deploys via CF git integration —
**not** from Actions; the package's `deploy` script is a local-dev relic, not a
production path. The **only** worker CI deploys is **`axoview-mcp`**. Don't add
`axoview` to CI — you'd race Cloudflare's own Pages build.

**Manual deploy (fork / break-glass), independent of Pages, whenever:**

```bash
cd packages/axoview-worker && npx wrangler deploy --config wrangler.mcp.toml
# → https://axoview-mcp.<your-subdomain>.workers.dev  (serves /api + /mcp + /pair + the DO)
```

Then in the app's **✨ Connect your AI** panel, paste that Worker URL into the
"Axoview MCP server" field. (CORS is already handled for the cross-origin call.)

- **Two CI secrets** (repo → Settings → Secrets → Actions): `CLOUDFLARE_API_TOKEN`
  (a token with **Workers Scripts:Edit** scope) and `CLOUDFLARE_ACCOUNT_ID`. Absent,
  the deploy job fails with a clear message and nothing ships. These are the *only*
  new secrets — pairing itself needs none.
- **Pairing needs no secrets.** v1 uses an ephemeral, high-entropy code (no accounts,
  no credential custody). OAuth v2 (ADR 0046 §3) is deferred.
- **Rate limiting.** A per-session cap runs in the DO. For IP-level DoS on
  `/pair/new` + `/mcp/*`, add a Cloudflare rate-limit rule (dashboard → Security →
  Rate limiting) — the ADR 0046 §8 "cheap hedge".
- **Local testing.** The `script_name` binding does **not** resolve under
  `wrangler pages dev` (no external Worker locally), so test the bridge with the
  self-contained standalone Worker, which serves `/api` + `/mcp` + `/pair` + the DO
  in one process:

  ```bash
  npm run build:lib
  npm run dev:mcp --workspace=packages/axoview-worker   # :8787, DO under Miniflare
  npm run dev                                           # app on :3000
  ```

  Use `127.0.0.1`, **not** `localhost` — wrangler binds IPv4 and Node-based MCP
  clients resolve `localhost` to IPv6 `::1` first (`fetch failed: AggregateError`).
  End users connect via the in-app **✨ Connect your AI** panel (default **read-only**;
  toggle "Allow edits" to grant write access).

**Fallback.** `axoview-mcp` also serves `/mcp` + `/pair` on its own `workers.dev`
URL, so if the Pages `script_name` binding ever misbehaves, point the panel's
"Axoview MCP server" field at that URL — zero Pages change.

---

## D. What's the same on every target

- HTTP contract for every `/api/*` endpoint the frontend calls.
- Public routes that bypass auth: `GET /api/config`, `GET /api/public/diagrams/:uuid`.
- Body limit: 10 MB per request.
- ID validation: `^[a-zA-Z0-9_-]{1,64}$` — anything else is `400 Invalid id` (Docker only; Cloudflare 503s before reaching the validator).
- Drive OAuth scope is locked to `drive.file` (per-file consent only) — the app sees only files it created ([ADR 0035](adr/0035-google-identity-and-drive-authorization.md)).
- Runtime config (`GET /api/config`) replaces build-time env injection — the frontend bundle never embeds secrets.

## E. What differs

| Concern | Cloudflare | Docker |
|---|---|---|
| Storage | Session/localStorage + Google Drive place (client-side) | `STORAGE_PATH` on disk |
| `cf-access` auth | Supported (JWKS RS256 verify) | Rejected (500) |
| Static delivery | CF CDN + `_headers` | nginx (compose stack) |
| Body limit enforcement | Hono `bodyLimit({ maxSize: 10MB })` | `express.json({ limit: '10mb' })` |
| CSP delivery | `_headers` file | nginx config |

---

## E.1 Observability (Cloudflare)

The Worker registers a Hono `app.onError` handler ([packages/axoview-worker/src/app.ts](../packages/axoview-worker/src/app.ts)) that emits a single structured `console.error` — `[worker:500] <method> <path> <errorName>` — on any uncaught 500. It surfaces in `wrangler tail` / the Pages real-time logs so an edge fault is named without a redeploy. This is the only edge-hardening piece shipped (v1.1 PR #11, A.1). Further edge hardening — Bot Fight Mode, WAF, scanner-path block, rate-limit — is **deferred** and only revisited if production 5xx persist; deployment-hygiene items (B / housekeeping) are deferred indefinitely. See the catalogued-workstreams list in [PLAN.md](../PLAN.md).

---

## F. Troubleshooting

**`401 Unauthorized` on every API call** — `AUTH_MODE=shared-token` is set but the client isn't sending `Authorization: Bearer …`. The SPA does not currently inject the header itself; front the deployment with a reverse proxy that injects it, or use `AUTH_MODE=cf-access`, or run with `AUTH_MODE=none`.

**Cloudflare deploy returns `503 Server storage is disabled` on `/api/diagrams`** — expected. The Cloudflare runtime has no server-side storage; persistence there is the client-side Google Drive place (§C3). Use the Docker target for server-side storage.

**Path-traversal `400 Invalid id`** (Docker) — expected. IDs are strict NanoID-like alphanum; do not relax `assertId`.

**Build succeeds locally but `wrangler pages deploy` 404s on `/api/*`** — check that [packages/axoview-app/public/_routes.json](../packages/axoview-app/public/_routes.json) was copied into `build/`. Rsbuild copies the `public/` tree by default.
