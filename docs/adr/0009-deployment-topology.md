# ADR 0009 — Deployment Topology

**Status:** Accepted
**Date:** 2026-05-20
**Supersedes:** the durable deployment decisions previously held in `flare_plan.md` (deleted in commit `926e66f`; classified in [productization-audit.md A.6.1](../tactical/productization-audit.md#a61-flare_planmd-section-classification))
**Superseded by:** none

## Context

Axoview ships to two real deployment targets and a third in-browser fallback:

1. **Self-host (Docker / nginx / Express + fs adapter).** Full storage; the "session backend" path. Documented in [docs/deployment.md](../deployment.md) and exercised by `compose.yml` / `compose.dev.yml`.
2. **Cloudflare Pages (Worker + Pages Functions).** Static SPA served from the CDN; `/api/*` handled by a Hono Worker bridged via `functions/api/[[path]].ts`. **Storage-less today** — the Worker short-circuits storage routes with `503` (verified at [app.ts:43-45](../../packages/axoview-worker/src/app.ts#L43)). Persistent storage on Cloudflare is tracked on a separate Google Drive branch (Phase 3B).
3. **Local mode.** Browser-only, SPA boots from any static host and persists to `localStorage`. Not a separate deployment artifact — it's the same `axoview-app` bundle, behaviour selected at runtime by the mode-detection probe.

Three audit findings forced a written-down topology now rather than later:

- **Theme 7 of the Phase A synthesis** ([productization-audit.md theme 7](../tactical/productization-audit.md#theme-7)): the `flare_plan.md` framing of "one HTTP contract, two adapters" is **aspirational**, not real. The live shape is **one HTTP contract, one adapter, one Worker short-circuit.** Writing this down prevents future contributors (and Phase 3B) from designing against the wrong contract.
- **The dual-probe + dead `RuntimeConfig.serverStorage` field** (A.4 #C1 + #C4, A.6 #D1 + #D2): mode detection asks `/api/config` *and* `/api/storage/status` in parallel on every SPA boot. The second request is redundant with the first. On Cloudflare cold starts that's ~100–200 ms of avoidable latency on every boot. The choice between "keep both endpoints" and "collapse to one" is a deployment-contract decision, not a UI refactor.
- **The Local-mode share-link bug** (A.4 #C5): pasting a `?share=<uuid>` URL while the SPA is in Local mode silently renders an empty diagram. The right fix is a clear error — but the contract that decides "share is session-mode only" lives at the deployment layer, not the UI.

This ADR locks the runtime asymmetry, the mode-detection contract, the auth posture, the env-var contract per target, and the observability boundary.

## Decision

### 1. Two deployment targets, one HTTP contract, asymmetric storage — name the asymmetry

The HTTP contract is **single-source** ([packages/axoview-backend/src/routes.js](../../packages/axoview-backend/src/routes.js)). Both runtimes expose the same `/api/*` surface; they differ only in **which routes carry storage**:

| Route | Express (self-host) | Worker (Cloudflare) |
|---|---|---|
| `GET /api/config` | full payload | full payload |
| `GET /api/storage/status` | reports `enabled: true` when `ENABLE_SERVER_STORAGE=true` | reports `enabled: false` (storage-less) — **see decision 2 for removal** |
| `GET/PUT/DELETE /api/diagrams/*` | live | `503` short-circuit at [app.ts:43-45](../../packages/axoview-worker/src/app.ts#L43) |
| `GET/PUT /api/folders` | live | `503` |
| `GET /api/tree-manifest` | live | `503` |
| `POST /api/diagrams/:id/share`, `DELETE …/share` | live | `503` |
| `GET /api/public/diagrams/:uuid` | live (no auth — public namespace) | `503` |

**Framing:** the contract is **"one HTTP contract, one adapter, one Worker short-circuit."** The Worker is a *storage-less* deployment of the same SPA, not a second backend implementation. If/when Cloudflare gains real storage (Drive on Phase 3B, or R2/D1 later), it will land as a new `StorageAdapter` implementation per ADR 0010, not as a second route layer.

This explicitly retires flare 5A's "one HTTP contract, two adapters" framing.

### 2. Mode detection collapses to a single probe; `RuntimeConfig.serverStorage` is removed

Today the frontend makes two parallel probes on boot:

```ts
// AppStorageContext.tsx:43-46 (current)
const [config, status] = await Promise.all([
  fetch('/api/config'),
  fetch('/api/storage/status')
]);
```

`/api/config` already returns `serverStorage` (Express) or an equivalent flag (Worker). The second probe is redundant.

**Lock:**

- The boot path issues **one** `GET /api/config` request. Mode is derived from the `serverStorage` boolean in that response.
- `/api/storage/status` is **deleted** from both runtimes after Phase C cleanup. The decision treats it as a legacy synonym that has no remaining consumer once the dual probe is collapsed.
- The `RuntimeConfig.serverStorage` *frontend* field (the dead one flagged in A.4 #C1, not the server-emitted flag) is **deleted** along with the redundant probe. Boot derives mode from `/api/config` and writes it into the canonical `AppStorageContext` only.
- The boot sequence falls back to **Local mode** if `/api/config` itself fails (network error, no backend). The current empty-error swallow path is replaced with an explicit fallback that logs a console warning.

Closes A.4 #C1 + #C4, A.6 #D1 + #D2. The cleanup itself is a C.2 row (single file edit + endpoint deletion in `routes.js` and `app.ts`).

### 3. Readonly / share-link is a session-mode-only overlay; Local mode must error explicitly

The current Local-mode share behaviour (A.4 #C5) is a silent failure: the SPA reads `?share=<uuid>` from the URL, tries to resolve it through the (non-existent on Local) `/api/public/diagrams/:uuid`, gets nothing, and shows an empty diagram with no error.

**Lock:**

- Share routes (`/api/public/diagrams/:uuid` read, `/api/diagrams/:id/share` write) are **session-mode only**. Local mode never serves or consumes them.
- The frontend share-link consumer detects "Local mode + `?share=<uuid>`" at boot and renders an explicit error UI:
  - Headline: "This share link needs a session backend."
  - Body: a one-line explanation that share links require Self-host or Cloudflare deployment.
  - No silent empty state.
- The dialog has a single dismiss action; closing it strips `?share=<uuid>` from the URL and boots the app normally in Local mode.

The exact dialog component is the cleanup row's choice; the contract is that **no share-uuid deeplink may render as an empty diagram.**

### 4. Env-var contract — one section per target

#### 4a. Self-host (Docker / compose)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `BACKEND_PORT` | no | `3001` | Express listen port. Container exposes 3001 to the network. |
| `STORAGE_PATH` | no | `/data/diagrams` | Filesystem root used by `fs.js`. **Container volume must back this path** for persistence across restarts; `compose.yml` mounts `/data/diagrams` as a named volume. |
| `ENABLE_SERVER_STORAGE` | yes | `false` | `"true"` switches `/api/config` to report `serverStorage: true` and gates all storage routes. **The implicit-off default is intentional** — a fresh container without this flag set behaves as if it were a static-only deploy and the SPA falls back to Local mode. |
| `ENABLE_GIT_BACKUP` | no | `false` | Reserved for a future git-backed snapshot path; today no-op. |
| `GOOGLE_CLIENT_ID` | no | empty | Echoed in `/api/config` for Phase 3B Drive auth. Empty value means "Drive provider is unavailable" (frontend hides the Drive UI). |
| `AUTH_MODE` | no | `'none'` | One of `none` / `shared-token` / `cf-access`. The Express implementation supports all three; only the first two are exercised on self-host. |
| `AUTH_SHARED_SECRET` | required when `AUTH_MODE=shared-token` | — | Compared against `Authorization: Bearer <token>`. Public routes (the share-namespace) are excluded. |

#### 4b. Cloudflare (Worker + Pages Functions)

| Variable | Source | Notes |
|---|---|---|
| `AUTH_MODE` | `[vars]` in `wrangler.toml` (default `shared-token`) | Same set as self-host. |
| `AUTH_SHARED_SECRET` | secret via `wrangler pages secret put` | When `AUTH_MODE=shared-token`. |
| `CF_ACCESS_TEAM_DOMAIN` | secret | When `AUTH_MODE=cf-access`; team subdomain (e.g. `myteam` → `myteam.cloudflareaccess.com`). |
| `CF_ACCESS_AUD` | secret | When `AUTH_MODE=cf-access`; the application AUD tag. |
| `GOOGLE_CLIENT_ID` | secret (or var if non-sensitive) | Echoed in `/api/config`; same semantics as self-host. |

`STORAGE_PATH` and `ENABLE_SERVER_STORAGE` have **no Worker equivalent today** — storage is short-circuited at decision 1's contract. A future Drive (or R2/D1) deployment introduces a binding via `wrangler.toml` *and* a new `StorageAdapter` per ADR 0010; the env-var contract for that path is owned by the Phase 3B ADR, not this one.

#### 4c. Local dev (browser-only / `npm run dev`)

| Variable | Required | Notes |
|---|---|---|
| (none) | — | Local mode requires no environment configuration. The SPA boots, fails the `/api/config` probe (no backend running, or it returns `serverStorage: false`), and falls back to `localStorage`. |

The `npm run dev:server` script invokes the Express backend with `ENABLE_SERVER_STORAGE=true` for end-to-end testing of the session path; this is a dev convenience, not a deployment target.

### 5. Authoritative wrangler.toml, mandatory `_routes.json`, and the asset pipeline

- The repo-root [wrangler.toml](../../wrangler.toml) is **authoritative for deploy** — it is what the "Deploy to Cloudflare" button consumes and what `wrangler pages deploy` from the repo root uses. The worker-package copy ([packages/axoview-worker/wrangler.toml](../../packages/axoview-worker/wrangler.toml)) is **retained for local dev workflows**: the `npm run dev` script in [packages/axoview-worker/package.json:10](../../packages/axoview-worker/package.json#L10) invokes `wrangler pages dev ../axoview-app/build --binding-from-toml`, which reads bindings from the `wrangler.toml` in cwd. Killing the worker-package file would break that workflow, and [docs/deployment.md:92,97](../deployment.md) currently documents it as a real surface. Drift between the two files is the operational risk this decision acknowledges: any change to `[vars]` or `compatibility_date` MUST be applied to both. A future cleanup may consolidate via symlink or a `wrangler.toml` generator script; that's a follow-up, not part of this ADR.
- [`_routes.json`](../../packages/axoview-app/public/_routes.json) is **mandatory** and committed to source (verified present at audit 2026-05-20). It scopes Pages Functions to `/api/*`; static asset requests bypass the Worker entirely. Removing or weakening this file causes Worker invocation on every static GET — a measurable cold-start tax.
- [`_headers`](../../packages/axoview-app/public/_headers) ships CSP + the canonical security-header set for CDN-served static. The Worker echoes the same set via `secureHeaders()`; nginx (self-host) ships the equivalent in `nginx.conf`. The canonical set lives in `_headers` — divergence between layers is a bug.
- The build pipeline emits both `_routes.json` and `_headers` into `packages/axoview-app/build/` (verified). CI should fail if either is missing post-build (tracked under C.8).

### 6. Observability boundary — per runtime

| Concern | Express (self-host) | Worker (Cloudflare) |
|---|---|---|
| Request logging | `morgan` or equivalent in `server.js` (not present today — gap tracked in C.2) | Cloudflare automatically captures invocation metrics; per-request structured logs require `console.log` calls. |
| Async work outliving the response | Standard Node async — caller awaits in-flight promises before `res.end()`. | **Must use `c.executionCtx.waitUntil(promise)`** — work scheduled outside `waitUntil` is killed at response time. Document expectation in every route handler that triggers a non-blocking side effect (none today; reserved for future Drive snapshot or audit-log handlers). |
| Tail / streaming logs | `docker logs <container>` | `wrangler tail` |
| Metrics | external (Prometheus exporter not present today; deferrable) | Cloudflare dashboard (built-in) |
| Crash → process restart | container restart policy `unless-stopped` (compose.yml) | Worker re-cold-starts on next request; no persistent process state assumed |

The observability **contract** is: every storage-touching handler is logged at info-level on entry + warn-level on failure; the runtime ships the logs to its native sink. Standardising the log format (JSON line vs. text) is deferred to a follow-up.

### 7. TLS termination

- **Self-host:** nginx terminates HTTP only; TLS is the deploy operator's responsibility (a sidecar like `caddy`, or `cloudflared tunnel`, or platform TLS).
- **Cloudflare:** TLS is handled by Cloudflare for the deployed hostname. `*.pages.dev` preview deploys inherit the same TLS posture.

### 8. Bundle-size budget for the Worker

The Worker bundle's deployed size is part of this contract. Target: **< 1 MB** uncompressed (CF's free-tier limit is 1 MB *compressed* for free accounts; we keep ourselves at < 1 MB uncompressed to leave margin). Enforcement lands in a CI bundle-size step under C.8.

## Consequences

### Positive

- A future contributor reading one file sees the entire deployment topology — no more split-brain across `flare_plan.md` + `docs/deployment.md` + scattered comments.
- The dual-probe collapse + dead-field removal is a measurable cold-start improvement on Cloudflare and a real code simplification on the boot path.
- Local-mode share-link error is a real bug fix, not a doc note.
- The env-var contract is the deploy operator's single reference.
- ADR 0010 inherits the storage-adapter contract cleanly; Phase 3B (Drive) extends without touching this ADR.

### Negative / open

- Decision 6's observability table acknowledges a gap (no structured request logging on Express today) without fixing it here. That's intentional — observability deserves its own decision once we have a real user complaint to ground it in.
- Decision 7 explicitly punts TLS to the operator. A user trying to self-host without a TLS sidecar may be surprised. The next deployment-docs pass should call this out.
- The `*.pages.dev` preview-deploy exposure (mentioned in A.6 #D5's security-headers thread but not solved here) is currently mitigated by `AUTH_MODE=shared-token` being the default in `wrangler.toml`. If a deployer switches to `AUTH_MODE=none` they expose every preview deploy. This is documented behaviour; a follow-up could add a deploy-time warning.
- The single-tenant assumption is implicit here and **explicit in ADR 0010 decision 4.** This ADR doesn't restate it.

## Files affected by adopting this ADR

- [packages/axoview-app/src/providers/AppStorageContext.tsx](../../packages/axoview-app/src/providers/AppStorageContext.tsx#L43) — single probe, dead-field removal.
- [packages/axoview-backend/src/routes.js](../../packages/axoview-backend/src/routes.js) — delete `/api/storage/status` route.
- [packages/axoview-worker/src/app.ts](../../packages/axoview-worker/src/app.ts#L29) — delete `/api/storage/status` handler.
- Frontend share-link consumer (path to be confirmed in cleanup) — Local-mode share-uuid error UI.
- [packages/axoview-worker/wrangler.toml](../../packages/axoview-worker/wrangler.toml) — retained for local dev (`wrangler pages dev --binding-from-toml`). Drift-risk callout added to the file header; no structural change.
- [docs/deployment.md](../deployment.md) — refresh env-var sections to match the locked table above.

The actual edits land in the C.2 cleanup tactical (single-file rows) and the C.8 git-automation tactical (CI bundle-size + `_routes.json` presence check).

## See also

- [productization-audit.md A.6.1](../tactical/productization-audit.md#a61-flare_planmd-section-classification) — flare_plan.md classification table (the historical source for every decision above).
- [productization-audit.md A.6.8](../tactical/productization-audit.md) — outline this ADR expands.
- [productization-audit.md Theme 7](../tactical/productization-audit.md) — names the runtime asymmetry that decision 1 locks.
- ADR 0010 — Session backend contract (the adapter-side counterpart to this ADR).
