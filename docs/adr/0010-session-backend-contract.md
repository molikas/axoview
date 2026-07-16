# ADR 0010 — Session Backend Contract

**Status:** Accepted
**Date:** 2026-05-20
**Supersedes:** the durable adapter / atomicity / concurrency decisions previously held in `flare_plan.md` (deleted in commit `926e66f`; classified in productization-audit.md A.6.1)
**Superseded by:** none

## Context

The session backend ([packages/axoview-backend](../../packages/axoview-backend/)) is the Node/Express + filesystem-adapter path that ships diagrams to a server-persisted store. It is the **live** session implementation today; the Cloudflare Worker is storage-less (per ADR 0009 decision 1), and Google Drive (Phase 3B) and any future R2/D1 path are *next* implementations of the same contract.

The adapter shape was drafted in `flare_plan.md` (Architectural #2 — Key-based StorageAdapter; Architectural #5 — `diagrams-index.json` + `If-Match` conditional writes) and implemented in [fs.js](../../packages/axoview-backend/src/adapters/fs.js), but was never written down as a decision record. Several recent findings forced one:

- **The atomicity gap.** [fs.js:45](../../packages/axoview-backend/src/adapters/fs.js#L45) uses `fs.writeFile` directly. A crash or power loss mid-write leaves a 5 MB diagram truncated. Real failure mode for self-host operators.
- **The session-isolation question.** Express's current shape gives every diagram a global namespace within a tenant. Multi-user separation is not in scope today, but every new contributor asks "can two users share a deploy?" The answer needs to live in writing.
- **The concurrent-write semantics.** Today writes are last-writer-wins. Drive's API supports etag-based conditional writes; R2's API does too. If the contract doesn't specify a pattern, every new adapter will reinvent one.
- **The health-endpoint gap.** [Dockerfile](../../Dockerfile) has no `HEALTHCHECK` (A.6.2 gap). compose.yml has no `healthcheck:` block. The shape of "/healthz" doesn't exist yet — it should be part of the adapter contract, not an Express afterthought.
- **The Drive return path.** Phase 3B is the next consumer of this contract. The cheaper the contract makes Drive integration, the less Phase 3B re-litigates settled questions.

## Decision

### 1. Adapter interface

A storage adapter implements exactly five methods, no more, no less. The current TypeScript declaration in [adapters/types.ts](../../packages/axoview-backend/src/adapters/types.ts) is the canonical reference:

```ts
export interface StorageAdapter {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  listDiagramMeta(): Promise<DiagramMeta[]>;
}
```

**Locks:**

- New adapters (Drive, R2, D1, in-memory test double) implement exactly these five. Provider-specific helpers may exist alongside but never leak into the route layer.
- `get` returns `null` for a missing key — never throws. Other failures (I/O, network) propagate as exceptions.
- `put` is **atomic** (decision 3). `value` is opaque bytes; the adapter does not interpret the payload.
- `delete` is idempotent — deleting a non-existent key is a no-op, not an error.
- `list(prefix)` returns the full opaque keys (e.g. `diagrams/<id>`, not bare IDs); callers compose paths from prefix knowledge if they need to.
- `listDiagramMeta()` is the cheap-walk variant used by the manifest endpoints. It enumerates only `diagrams/*` keys and excludes the **reserved-key list** (decision 5).

### 2. Keys are opaque; `KEY_PATTERN` is the runtime invariant

The route layer never sees a filesystem path. Keys look like `diagrams/<id>`, `folders`, `tree-manifest`, `public/<uuid>` — the adapter maps these to its storage primitive.

**Lock:** every adapter enforces the regex `KEY_PATTERN` defined at [fs.js:4](../../packages/axoview-backend/src/adapters/fs.js#L4) as defense in depth, even when the underlying storage primitive doesn't strictly require it. Path-traversal characters (`..`, leading `/`, control characters) MUST be rejected at the adapter boundary, not at the route layer alone.

This is the single most important runtime invariant in this contract — the route layer trusts the adapter to refuse malformed keys, and the adapter trusts the route layer to use opaque keys exclusively.

### 3. Atomicity — every `put` is all-or-nothing

The fs adapter today uses `fs.writeFile` directly. That leaves a truncated file on crash.

**Lock:** `put` is atomic. The current direct-write pattern is replaced with a **tmp-file + rename** sequence:

```js
// adapter contract — fs.js implementation
const tmp = path.join(dir, `.${name}.${process.pid}.tmp`);
await fs.writeFile(tmp, value);
await fs.rename(tmp, target);
```

For other adapters:
- **Drive:** the resumable-upload API is atomic on success.
- **R2:** PUT is atomic by API contract.
- **D1:** writes are transactional.

The contract is the *behaviour* (all-or-nothing observable change), not the mechanism. Adapters whose underlying primitive is non-atomic must implement an atomicity shim at the adapter boundary.

### 4. Session isolation — single-tenant per deploy (v1)

Express's current implementation puts every diagram in one global namespace. There is no `userId` in any key, no per-user prefix, no auth-derived path scoping.

**Lock for v1:**

- A deploy is **single-tenant**. The operator's responsibility — not the adapter's — is to ensure only the intended user(s) reach the storage. Mechanisms: one container per user, CF Access policy, network ACL.
- Within a tenant, all diagrams are visible to anyone with `AUTH_MODE` clearance. The share-namespace (`public/<uuid>`) is the *only* exception: it is intentionally world-readable (no auth middleware applies — see [server.js:46-79](../../packages/axoview-backend/server.js#L46)), and exists only to support unauthenticated share-link viewers.
- Multi-user isolation **within** a deploy (per-user namespaces, per-user auth, ACLs) is **out of scope for v1**. A future ADR may introduce it; this one explicitly defers.

The decision shapes everything downstream:
- Share links work because they're a *public-namespace cutout*, not a cross-user share.
- Self-host auth covers everything that isn't the public-namespace cutout — enforced **in-process** by the Express `AUTH_MODE` middleware (`none` / `shared-token` / `cf-access`) in [server.js](../../packages/axoview-backend/server.js), which lets `isPublicRoute` requests through *before* applying the mode check. nginx Basic Auth was fully removed (ADR 0009): there is no `auth_basic` directive and no `/api/public` `location` block — the cutout is application-level, not nginx-level.
- Drive (Phase 3B) will need its own tenancy story — likely "one Drive account = one tenant" — and that's the Phase 3B ADR's problem, not this one.

### 5. Reserved-key list

Some keys are infrastructure, not user data, and must be excluded from `listDiagramMeta()`:

| Key | Purpose |
|---|---|
| `folders` | Folder tree (single JSON document). |
| `tree-manifest` | Materialised tree for fast SPA boot. |
| `metadata` (pre-5A residue) | Legacy diagram metadata key. Reserved defensively; not written by current code. Preserved so a future adapter that adopts it can't collide with a user's diagram named `metadata`. |
| `diagrams-index` (R2 precedent) | Denormalised diagrams index. Dead today; reserved against future adapter use. |
| `public/<uuid>` | Share-namespace snapshots. Enumerated only by share-list routes, never by diagrams listing. |

**Lock:** every adapter excludes these from `listDiagramMeta` ([fs.js:80-84](../../packages/axoview-backend/src/adapters/fs.js#L80) is the reference). Adding a new reserved key requires updating both the adapter and the route layer in the same commit.

### 6. Snapshots and share namespace

- Snapshots live under the `public/<uuid>` prefix and are **never** enumerated by `listDiagramMeta` or returned to a logged-in user's diagram list.
- Deletion of a parent diagram (`DELETE /api/diagrams/:id`) cascades to its snapshots; the route layer is responsible for the cascade ([routes.js](../../packages/axoview-backend/src/routes.js)), the adapter doesn't infer relationships.
- Public-namespace **snapshot** reads (`public/<uuid>`) bypass the auth middleware on both runtimes via the `isPublicRoute` check. On the **Worker**, `isPublicRoute` additionally allows `GET /api/public/drive/:fileId` — the anonymous Drive read-proxy for "anyone with the link" sharing (ADR 0042 / ADR 0043 #3; read-only, and its server-side API key can only fetch already-public files). That Drive proxy is **Worker-only** — Express has no counterpart. So the contract has **two** auth exceptions: the `public/<uuid>` snapshot namespace (both runtimes) and the Drive read-proxy (Worker only). *(Amended by ADR 0042; §6's original "the only auth exception" predates Drive sharing.)*

### 7. Concurrent-write semantics

The current fs adapter is last-writer-wins: two simultaneous `put`s on the same key result in whichever rename finishes last winning. This is acceptable for a single-tenant deploy where realistic concurrency is "the user has two tabs open."

**Lock:**

- v1 contract is **last-writer-wins.** Adapters do not promise transactional integrity across keys.
- The **conditional-write retry pattern** (etag-based; 3-attempt cap) is the prescribed shape for any adapter whose underlying storage exposes an If-Match primitive. Drive supports this natively; R2 supports it natively. fs adapter does NOT implement it today — and does not need to, because the file system's own write barrier (decision 3) is sufficient for a single-tenant local case.
- The conditional-write pattern is **dormant in this ADR.** It is the precedent — preserved from flare's Architectural #5 — for the Drive branch and any future remote adapter. It will become normative when Phase 3B (Drive) ships and a follow-up ADR amends this one.

This is deliberately conservative. The MQA #21 folders-collision class of bugs is real but rare today; if a multi-tab user reports a regression, that's the trigger to amend the contract, not this audit.

### 8. Health endpoint shape

Today there is no `/healthz` or `/health` endpoint on Express, no `HEALTHCHECK` in the Dockerfile, no `healthcheck:` block in compose.yml. Adopting orchestration (compose, Kubernetes, Cloudflare's container probes) without a health endpoint fails open.

**Lock:**

- Self-host runtime exposes **`GET /healthz`** on the same port as the API.
- Response: `200 OK` with body `{ "ok": true, "adapter": "fs", "storage_writable": true }` when:
  - the adapter's underlying storage primitive is reachable (`fs`: `STORAGE_PATH` exists and is writable; verify with a tmp-file create-and-delete on first call, cache for 10 seconds);
  - `ENABLE_SERVER_STORAGE=true` OR the adapter is the static-mode adapter.
- Response: `503 Service Unavailable` with `{ "ok": false, "reason": "<short string>" }` when the adapter probe fails.
- **No auth on `/healthz`** — orchestrators must be able to probe it.
- The Worker runtime does not need an explicit `/healthz` — Cloudflare's invocation infrastructure handles liveness. Storage-less Worker deploys are healthy by construction.

The Dockerfile + compose.yml additions to wire `/healthz` have **landed**: [server.js](../../packages/axoview-backend/server.js) exposes `GET /healthz` (with the 10s-cached tmp-file writability probe), the [Dockerfile](../../Dockerfile) has a `HEALTHCHECK` invoking it, and [compose.yml](../../compose.yml) has a `healthcheck:` block.

### 9. GDrive (Phase 3B) extension contract

Phase 3B is the next consumer of this ADR. The contract above is intentionally designed to make Drive cheap:

- **The five-method interface (decision 1) is preserved**, though `list(prefix)` requires Drive's folder model rather than a literal prefix query. Drive's `q` operator supports `name contains 'X'` (substring) — not strict prefix — so the Drive implementation organises keys into a tenant root folder with `diagrams/` and `public/` sub-folders, and `list('diagrams/')` translates to a `files.list` call against the `diagrams/` sub-folder. The Phase 3B ADR will lock the folder layout (parent ID resolution, sub-folder creation order, orphan handling); this ADR commits only that the adapter contract is preserved across the translation. The other four methods map more directly: `get` ↔ `files.get`, `put` ↔ resumable upload, `delete` ↔ `files.delete`, `listDiagramMeta` ↔ `files.list` against the `diagrams/` sub-folder with a metadata projection.
- **Opaque keys (decision 2)** map to Drive file names within a per-tenant folder; Drive's own naming constraints are a strict subset of `KEY_PATTERN`.
- **Atomicity (decision 3)** is API-given.
- **Single-tenant (decision 4)** maps to one Drive account per deploy — exactly the Drive permission model.
- **Reserved keys (decision 5)** are stored as ordinary Drive files with the same names; no schema change required.
- **Snapshots (decision 6)** live in a `public/` subfolder; Drive's sharing model can make this subfolder world-readable independently of the parent tenant folder.
- **Conditional writes (decision 7)** activate in the Drive implementation via `If-Match` headers + 3-attempt retry; this is where the dormant pattern goes live.
- **Health (decision 8)** has no Drive-side analogue — Drive's API is the health probe.

Phase 3B's ADR will amend decision 7 (conditional writes go normative for Drive) and **may** introduce a multi-tenant story (amending decision 4); both amendments live in the Phase 3B ADR, not this one.

## Consequences

### Positive

- Drive implementation has a clear template — Phase 3B reads decision 9 and stops re-litigating decisions 1–8.
- Future bugs around concurrent writes (folders.json racing, MQA #21 collision class) have an architectural reference: decisions 3 + 7 explain why fs adapter is fine today and what changes when Drive ships.
- The health-endpoint shape (decision 8) unblocks the Dockerfile HEALTHCHECK + compose healthcheck additions tracked in C.2.
- The reserved-key list (decision 5) makes it impossible for a future adapter author to silently leak infrastructure into the user-visible diagrams list.

### Negative / open

- **The single-tenant lock (decision 4)** will surprise a user who self-hosts intending to invite collaborators. The deployment docs need a clear "single-tenant per deploy" callout (action item for the next docs pass).
- **Last-writer-wins (decision 7)** is correct for v1 but will need amendment as soon as a real multi-tab regression appears. That's a known forward cost.
- **The conditional-write pattern is dormant** — preserved as precedent but not exercised. A reader of this ADR could assume it's normative; the language tries to make "dormant" explicit, but if it's missed the contract degrades.
- **The atomicity contract (decision 3)** has **landed**: [fs.js](../../packages/axoview-backend/src/adapters/fs.js) `put` now performs the tmp-file + rename sequence (the `// Atomicity contract (ADR 0010 Decision 3)` block). This item is no longer open.

## Files affected by adopting this ADR (all landed)

- [packages/axoview-backend/src/adapters/fs.js](../../packages/axoview-backend/src/adapters/fs.js) — tmp-file + rename for `put` (decision 3). ✅
- [packages/axoview-backend/server.js](../../packages/axoview-backend/server.js) — `/healthz` route (decision 8). ✅
- [Dockerfile](../../Dockerfile) — `HEALTHCHECK` invoking `/healthz`. ✅
- [compose.yml](../../compose.yml) + [compose.dev.yml](../../compose.dev.yml) — `healthcheck:` block. ✅
- ~~nginx.conf — nested `location` for `/api/public/*`~~ — **not applicable**: the `/api/public/*` carve-out was rolled back together with nginx Basic Auth (ADR 0009). The public-namespace cutout is enforced in-process by `isPublicRoute` (decision 6), not by an nginx location block.

All edits have landed (originally tracked by the C.2 cleanup tactical).

## See also

- productization-audit.md A.6.1 — flare_plan.md classification table; rows for Architectural #2 / #5 are this ADR's historical source.
- productization-audit.md A.6.8 — outline this ADR expands.
- productization-audit.md A.6.6 — session backend baseline checklist (16 rows; 4 gaps + 1 risk).
- ADR 0009 — Deployment topology (the cross-runtime counterpart). Decision 1 of ADR 0009 names the runtime asymmetry that this ADR's decision 4 single-tenancy assumes.
