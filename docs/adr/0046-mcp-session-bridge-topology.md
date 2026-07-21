# ADR 0046 — MCP Session-Bridge Topology (Remote MCP Server, Per-User Durable Object, Pairing → OAuth)

**Status:** Proposed
**Date:** 2026-07-21
**Supersedes:** none
**Superseded by:** none

## Context

[ADR 0045](0045-agent-control-contract.md) defines *what* an agent can do to the canvas (the transport-agnostic verb surface). This ADR locks *how the user's AI reaches that surface* — the deployment topology, the session bridge, the identity model, and the free-tier constraints.

The chosen primary experience (owner, 2026-07-21): **the user points their existing AI app at Axoview.** They add Axoview as a **remote MCP connector** in Claude.ai (Pro/Max/Team), ChatGPT, Cursor, etc. Inference then runs on the subscription they already pay for — which is the *only* path where a subscription (as opposed to a pay-per-token API key) works, because a claude.ai / ChatGPT subscription grants no API key and using its OAuth token in a third-party product is a ToS violation (verified 2026-07-21).

The hard problem this ADR solves: the agent runs **inside the user's AI app**, but the canvas is a live WebGL/DOM scene **in the user's browser tab**. A remote MCP server has no inherent way to reach one specific tab. That routing is the session bridge.

This lands against three existing decisions that must be reconciled (ripple pass, 2026-07-21):

- **[ADR 0010 §4](0010-session-backend-contract.md) locks single-tenant per deploy** for *storage*. This ADR introduces per-**user** identity on the worker for the first time — but it routes *ephemeral tool calls to a live tab*, it does **not** persist diagrams per user. Diagrams still live wherever [ADR 0010](0010-session-backend-contract.md) / [ADR 0037](0037-storage-places-model.md) already put them (localStorage / Drive / self-host fs). The Durable Object holds only routing state. **Identity here is orthogonal to storage tenancy — 0010 §4 is not superseded.**
- **[ADR 0009 §1](0009-deployment-topology.md)** frames the runtime as "one HTTP contract, one adapter, one Worker short-circuit," with the anonymous Drive read-proxy as a sanctioned **Worker-only carve-out** (a Cloudflare-only capability with no self-host equivalent). The MCP endpoint + Durable Object is a **second such carve-out** — same precedent, same reasoning. It also lives under the **[ADR 0009 §8](0009-deployment-topology.md) <1 MB worker-bundle budget**.
- **[ADR 0043 #1](0043-deferred-backend-for-google-api-hardening.md)** anticipates per-user credential custody (KV/D1, encrypted) when the deferred Google PKCE auth-broker fires. The MCP OAuth surface (v2 below) needs the **same substrate for a different purpose** (MCP-client→Axoview identity, not Axoview→Google). They co-locate; this ADR does not build 0043's broker, and 0043 does not build this.

## Decision

### 1. Topology — a Worker-only remote MCP carve-out on `axoview-worker`

The remote MCP server is served by the existing [axoview-worker](../../packages/axoview-worker) (Cloudflare), as **new routes + a Durable Object binding**, not a new deployment. It is a **Worker-only capability** — the sanctioned second carve-out after the Drive proxy ([ADR 0009 §1](0009-deployment-topology.md)):

- Transport: **MCP over Streamable HTTP** (the 2026 remote-MCP standard). One endpoint, e.g. `POST /mcp` on the worker.
- Tool calls do **not** execute on the worker — the worker is a **router**. Each MCP tool call is forwarded over a WebSocket to the user's live browser tab, which executes it against `window.__axoview__.agent` ([ADR 0045](0045-agent-control-contract.md)) and returns the result.
- Self-host has no Durable Object. **v1: the MCP bridge is Cloudflare-only**; self-host either runs the bridge on the Express process as a long-lived WebSocket host (a documented follow-up fork) or does without. This mirrors the Drive-proxy asymmetry — a documented gap, not a hidden one.

### 2. The session bridge — one SQLite-backed Durable Object per user session

- **A Durable Object per user (v2) / per pairing session (v1)** holds the routing state and the **hibernatable WebSocket** to the tab.
- The DO **must use the SQLite storage backend** (`new_sqlite_classes` in the wrangler migration — **not** `new_classes`). This is the hard free-tier requirement: only SQLite-backed DOs are available on the Workers Free plan.
- The DO **must use the WebSocket Hibernation API**. A plain WS keeps the DO pinned in memory (billed up to ~15 min of idle duration per connection); a user with Axoview open but not prompting is the common case, so hibernation is the difference between "free" and "over budget." **Non-negotiable.**
- Flow: tab loads → opens WS to its DO → registers. An incoming MCP tool call for that user is routed over the WS → tab executes → result returns over the same MCP response.

### 3. Identity — pairing code (v1), OAuth 2.1 (v2), staged

**v1 — ephemeral pairing code** (ships first; no account layer):

- The tab displays a short-lived code (e.g. `AXV-7Q2K`, ~10 min TTL). The user pastes it into their MCP client's connector configuration (or a first-turn "connect" prompt).
- The worker binds `code ⇄ tab-WS` in a DO keyed by the ephemeral session. Tool calls carrying that session reach that tab. Re-pairing on expiry is a code re-display.
- No accounts, no persistent credential custody → **free-tier-trivial and reconciles cleanly with [ADR 0010 §4](0010-session-backend-contract.md)** (no durable per-user identity introduced).

**v2 — OAuth 2.1** (Axoview as MCP OAuth provider):

- Persistent "it just works across reloads" identity; DO keyed by the authenticated user.
- Introduces durable per-user identity + credential custody → **co-locates with [ADR 0043 #1](0043-deferred-backend-for-google-api-hardening.md)'s KV/D1 substrate** and inherits its "worker takes on credential custody" consequence. When v2 is built it gets its own design pass (or an addendum here) citing that shared substrate.

### 4. Multi-tab and tab-not-open semantics

- **No active tab:** a tool call returns an explicit result — `"No active Axoview canvas — open your diagram and retry"` — never a hang. The DO round-trip carries a timeout.
- **Multiple tabs:** v1 targets the **most-recently-focused** tab. `list_canvases` / `select_canvas` verbs (declared in [ADR 0045](0045-agent-control-contract.md)'s surface) let the agent disambiguate explicitly. `open_diagram(id)` maps onto the existing `AxoviewRef.load` ([axoviewProps.ts:702](../../packages/axoview-lib/src/types/axoviewProps.ts)) so the agent can navigate to a specific diagram.

### 5. MCP surface exposed

- **Tools:** the [ADR 0045](0045-agent-control-contract.md) verbs — `apply_ops`, `set_diagram`, `get_diagram`, `list_canvases` / `select_canvas` / `open_diagram`. (`apply_intent` reserved, not exposed in v1.)
- **Resource:** the current diagram JSON (`get_diagram` as a pullable MCP *resource*), so the agent reads state as free context, not a tool round-trip ([ADR 0045 §2](0045-agent-control-contract.md) invariant 4).
- **Prompt:** the modeling skill ([ADR 0045 §5](0045-agent-control-contract.md)) as an MCP prompt.

### 6. Free-tier budget (the operating envelope)

| Constraint | Value | Consequence |
|---|---|---|
| Workers Free requests/day | 100,000 (hard cap, not overage-billed) | Each tool call ≈ a few requests (inbound MCP + WS message + reply). The §2 round-trip minimization ([ADR 0045](0045-agent-control-contract.md)) is what keeps real usage well under this. Graduation = Workers Paid ($5/mo), which removes the cap — a pricing toggle, not a re-architecture. |
| DO storage (Free) | 1 GB SQLite | Routing state only; effectively unused. |
| WS idle duration | Hibernation → ~0 when idle | Mandatory hibernation (§2). |
| DO CPU / invocation | 30 s default | A router uses a rounding error of this. |
| Worker bundle | < 1 MB ([ADR 0009 §8](0009-deployment-topology.md)) | MCP server + DO code adds weight — a **measured CI item**. Auto-layout ([ADR 0045 §4](0045-agent-control-contract.md)) runs in the **tab**, not the worker, so it does not count against this budget. |

### 7. The alternate transport — embedded BYOK agent

The **secondary** tier (owner-selected 2026-07-21) is an in-app agent for users without a connector-capable subscription app (and self-hosters):

- A chat panel inside Axoview; the user picks **provider + model + pastes an API key**. This path needs an **API key, not a subscription** — the UI must say so plainly (the #1 anticipated support question).
- **Browser-direct, session-only keys** (owner-selected): the key stays in the tab, is **never persisted** by default and **never sent to axoview-worker**, and the provider is called directly from the browser (`anthropic-dangerous-direct-browser-access` / `dangerouslyAllowBrowser` / Gemini browser SDK). Zero server-side custodial liability. An explicit opt-in "remember" (localStorage, with an XSS warning) is a possible later affordance, not the default.
- Provider abstraction via the **Vercel AI SDK** (unified tool-calling across `@ai-sdk/anthropic` / `@ai-sdk/openai` / `@ai-sdk/google`); tools are the **same [ADR 0045](0045-agent-control-contract.md) verb layer**, so this transport adds no new contract.
- No worker, no DO, no bridge — the loop runs entirely in the tab.

### 8. Data-flow / trust note

In the MCP transport, diagram content (tool args, the `get_diagram` resource) passes **through `axoview-worker`** and then out to the user's model provider. For private / Drive-native diagrams ([ADR 0042](0042-drive-native-sharing-and-readonly-preview.md)) this is a data path the user should understand — inherent to "give the AI context," but the worker is in the loop. The MCP endpoint is authenticated (pairing/OAuth), rate-limited (a Cloudflare rate-limit rule or KV counter, per [ADR 0043 §4 open-follow-up](0043-deferred-backend-for-google-api-hardening.md) pattern), and relays only; it does not persist diagram content. The BYOK transport (§7) keeps everything in the tab and touches no server.

## Consequences

**Positive:**
- The subscription question resolves the way the owner wants: because inference stays inside the user's subscribed app, the **primary path works on a subscription** with no API key.
- Reuses `axoview-worker` (a route + DO binding), not a new deployment — consistent with [ADR 0009](0009-deployment-topology.md)'s carve-out precedent.
- Free-tier viable end to end **iff** SQLite-backed DOs + hibernatable WS are used; the upgrade to paid is a toggle.
- Pairing-first (v1) ships fast, needs no account layer, and keeps [ADR 0010 §4](0010-session-backend-contract.md) intact; OAuth (v2) has a clean home and a known shared substrate with [ADR 0043](0043-deferred-backend-for-google-api-hardening.md).
- One verb contract, two transports — the BYOK tier is additive, not a fork.

**Negative / risks:**
- **The session bridge is genuinely novel work** — the DO + hibernatable-WS + tab-targeting router is the hardest build item on the transport side. Multi-tab routing and tab-not-open handling *are* the design, not edge cases.
- **Free-tier `new_sqlite_classes` / hibernation are easy to get wrong** — the wrong migration class silently demands a paid plan; a non-hibernating WS silently burns the budget. Both are one-line traps.
- **v2 OAuth introduces credential custody** the app doesn't have today — deferred, but a known forward cost shared with [ADR 0043 #1](0043-deferred-backend-for-google-api-hardening.md).
- **Worker bundle pressure** — MCP server + DO must fit under [ADR 0009 §8](0009-deployment-topology.md)'s 1 MB; a heavy MCP SDK could blow it. Measured in CI.
- **Self-host has no bridge in v1** — a documented gap, mirroring the Drive-proxy asymmetry.

## Implementation notes (non-binding)

- Cloudflare's Agents / remote-MCP guide is the reference shape; the DO + hibernatable-WS pattern is standard. Evaluate the MCP-server bundle weight early against [ADR 0009 §8](0009-deployment-topology.md).
- Wrangler: DO under `[[durable_objects.bindings]]` + a migration with **`new_sqlite_classes`**; both the repo-root [wrangler.toml](../../wrangler.toml) and the worker-package copy must stay in sync per [ADR 0009 §5](0009-deployment-topology.md)'s drift rule.
- Rate-limit the `/mcp` endpoint from day one (KV counter or CF rate-limit rule) — the same cheap hedge [ADR 0043 §4](0043-deferred-backend-for-google-api-hardening.md) leaves open for the Drive proxy.
- BYOK: `@ai-sdk/*` providers + the shared verb layer; keys in a React ref / sessionStorage, never a store that persists.

## Acceptance criteria

- **Unit test (worker):** the router forwards an MCP `apply_ops` call to a mock tab-WS and returns the tab's result; a call with no registered tab returns the explicit "no active canvas" error within the timeout, not a hang.
- **Unit test (worker):** the DO is declared with the SQLite backend (migration asserts `new_sqlite_classes`) and the WS handler uses the Hibernation API (asserted via the handler shape).
- **Manual verification (free tier):** a real Claude.ai / ChatGPT connector pointed at a preview `/mcp` endpoint, paired via code, drives a `set_diagram` that renders in the live tab — end to end, on a free Cloudflare plan, without exceeding the request budget for a normal session.
- **Bundle gate:** the worker build stays < 1 MB with the MCP server + DO included ([ADR 0009 §8](0009-deployment-topology.md) CI check).
- **BYOK path:** the embedded agent completes the same `set_diagram` task with a browser-direct key that never appears in a worker request log.

## See also

- [ADR 0045](0045-agent-control-contract.md) — the verb contract this transport carries.
- [ADR 0047](0047-agent-interaction-eval-harness.md) — how round-trips over this bridge are measured and optimized.
- [ADR 0009](0009-deployment-topology.md) §1 (Worker-only carve-out precedent), §5 (wrangler drift), §8 (bundle budget).
- [ADR 0010](0010-session-backend-contract.md) §4 — single-tenant storage; this ADR's identity is orthogonal to it.
- [ADR 0043](0043-deferred-backend-for-google-api-hardening.md) #1 — the shared per-user credential-custody substrate that v2 OAuth co-locates with.
