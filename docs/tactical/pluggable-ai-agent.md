# Tactical — Pluggable AI Agent (MCP bridge + declarative contract + eval harness)

> **Read first:**
> - [ADR 0045 — Agent Control Contract](../adr/0045-agent-control-contract.md) (the verb layer, reconcile + auto-layout, modeling skill)
> - [ADR 0046 — MCP Session-Bridge Topology](../adr/0046-mcp-session-bridge-topology.md) (Cloudflare remote MCP + per-user DO + pairing→OAuth; BYOK alternate transport)
> - [ADR 0047 — Agent Interaction Eval Harness](../adr/0047-agent-interaction-eval-harness.md) (round-trips / efficiency / skill / correctness)
> - Reconciled against: [ADR 0009](../adr/0009-deployment-topology.md) §1/§5/§8, [ADR 0010](../adr/0010-session-backend-contract.md) §4, [ADR 0043](../adr/0043-deferred-backend-for-google-api-hardening.md) #1
> - [docs/workflow.md](../workflow.md)
>
> **Status:** Tracks A–F implemented + unit-tested (2026-07-21); pending live/browser verification + owner ADR acceptance · **Owner:** molikas · **Last updated:** 2026-07-21
>
> This is a **short-lived working doc.** Delete it after the work merges; the ADRs are the durable record. PLAN.md gets a one-line entry once shipped (see "Wrap-up").

## Session startup checklist

1. Read this file fully.
2. Read each linked ADR (0045/0046/0047 in full; 0009/0010/0043 for the reconciliation points).
3. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
4. `TodoWrite` the sub-tasks below.
5. Mark `[x]` as work completes.
6. On completion, follow "Wrap-up".

## Goal

Let a user point their **own** AI (Claude.ai / ChatGPT / Cursor, on their existing subscription) at Axoview as an MCP connector and have it read + manipulate the canvas through a **coarse-grained, declarative** contract — one call builds a whole diagram, the AI never moves tiles one at a time, and Axoview owns layout. A secondary embedded BYOK tier reuses the same contract for users without a connector-capable app. An eval harness measures and CI-gates round-trip efficiency + correctness.

**Not goals:** persistent multi-user accounts (v1 uses ephemeral pairing codes); self-host MCP bridge (Cloudflare-only in v1); `apply_intent` template sugar (reserved for v1.1); OAuth (v2).

## Scope

### In scope
- The `window.__axoview__.agent` verb layer over `useSceneActions.transaction()` (ADR 0045 §1/§3).
- The deterministic auto-layout engine (ADR 0045 §4) — **the highest-risk build item**.
- The modeling skill artifact (ADR 0045 §5), shared by both transports.
- Remote MCP server + SQLite-backed hibernatable-WS Durable Object on `axoview-worker` (ADR 0046 §1/§2), pairing-code identity (§3 v1).
- Embedded BYOK agent: browser-direct, session-only keys, Vercel AI SDK (ADR 0046 §7).
- Eval harness: scripted MEASURE client + golden-replay GATE + periodic live REALISM (ADR 0047).

### Out of scope (this pass)
- OAuth 2.1 (ADR 0046 §3 v2), `apply_intent` (ADR 0045 §1 sugar), self-host bridge, per-user credential custody / KV-D1 (co-locates with ADR 0043 #1 when it fires).

## Locked decisions (from design discussion 2026-07-21)

| # | Decision |
|---|---|
| 1 | Primary UX = **Axoview-as-MCP** (subscription works because inference stays in the user's app); BYOK is the secondary tier. |
| 2 | Identity = **pairing code v1**, OAuth v2 (staged). Keeps ADR 0010 §4 storage-tenancy intact in v1. |
| 3 | Contract = **layered**: `apply_ops` (batch floor) + `set_diagram` (full-spec reconcile power path); `apply_intent` reserved. |
| 4 | **Coordinates optional; AI never computes a tile; Axoview auto-lays-out** (ADR 0045 §2 invariant 1 + §4). |
| 5 | **Agent-local ids forward-referenceable within one call**; one call = one transaction = one undo (ADR 0045 §2 invariants 2–3). |
| 6 | Reads via **resource**, results as **diffs**, partial success **explicit** (ADR 0045 §2 invariants 4–6). |
| 7 | DO **must** be SQLite-backed (`new_sqlite_classes`) + **must** use WebSocket Hibernation — free-tier hard requirements (ADR 0046 §2). |
| 8 | BYOK keys = **browser-direct, session-only, never sent to the worker** (ADR 0046 §7). |
| 9 | Eval driver = **scripted API-key MEASURE + free golden-replay GATE + periodic live REALISM** (ADR 0047 §3). |
| 10 | Worker bundle stays **< 1 MB** with MCP+DO (ADR 0009 §8); auto-layout runs in the tab, not the worker. |

## Sub-tasks

### A. Verb layer + contract (ADR 0045 — foundation, do first; both transports depend on it)
- [ ] New `axoview-lib/src/agent/` module: `apply_ops`, `set_diagram`, `get_diagram` + `list_canvases`/`select_canvas`/`open_diagram`.
- [ ] Zod op schemas (mirror `src/schemas/`); one source of truth feeding MCP `input_schema` + BYOK tool defs.
- [ ] Agent-local id map + forward-reference resolution within one `transaction()`.
- [ ] Diff-shaped results (`{created_ids, id_map, changed, errors[], counts}`); partial-success (`errors[]`, valid ops still apply).
- [ ] Publish curated `window.__axoview__.agent` **separate from** the raw-store debug bridge (Axoview.tsx:136); wire an `AxoviewRef` method surface too.
- [ ] Unit tests: forward-ref pair in one call; partial-success; diff-result shape.

### B. Auto-layout engine (ADR 0045 §4 — highest risk)
- [ ] Deterministic layered (topological LR/TB) layout for connected graphs, snapped to iso tile grid, honoring ADR 0023 collision.
- [ ] Grid pack for disconnected sets; respect already-placed elements (no reflow unless `relayout:true`).
- [ ] Declarative hints: `layout` mode + `group`/`cluster` tags; **no `Math.random`** (determinism for ADR 0047 goldens).
- [ ] Decide: adapt `elkjs` vs hand-rolled rank-and-pack (bundle cost is app-side, not worker).
- [ ] Unit test: 6-node connected graph → non-overlapping, byte-identical tiles across runs.

### C. Modeling skill (ADR 0045 §5)
- [ ] Author the skill (data model, optional-coords, efficiency patterns, failure protocol) as MCP prompt + BYOK system-prompt block.
- [ ] Lockstep guard: skill describes exactly the shipped verbs; `apply_intent` absent until it ships.

### D. MCP server + session bridge (ADR 0046 — Cloudflare, free-tier)
- [ ] `POST /mcp` Streamable-HTTP server on `axoview-worker` (Worker-only carve-out, ADR 0009 §1).
- [ ] SQLite-backed Durable Object (`new_sqlite_classes` migration) + **hibernatable** WebSocket; tab registers on load.
- [ ] Router: MCP tool call → WS → tab verb layer → result; timeout + explicit "no active canvas"; multi-tab = most-recent-focus + `select_canvas`.
- [ ] Pairing-code flow (tab shows code, ~10min TTL, DO binds code⇄WS); rate-limit `/mcp`.
- [ ] MCP resource (diagram JSON) + MCP prompt (modeling skill).
- [ ] wrangler.toml (root + worker copy, kept in sync per ADR 0009 §5); CI bundle-size gate < 1 MB.
- [ ] Worker unit tests: forward-to-mock-tab; no-tab timeout; SQLite/hibernation asserts.

### E. Embedded BYOK transport (ADR 0046 §7 — secondary)
- [ ] In-app chat panel; provider+model+key entry; **UI copy: "API key, not a subscription."**
- [ ] Vercel AI SDK provider abstraction (`@ai-sdk/anthropic|openai|google`); browser-direct headers/flags; **session-only key (ref/sessionStorage), never to the worker**.
- [ ] Same verb layer as tools (no new contract).

### F. Eval harness (ADR 0047)
- [ ] `packages/axoview-agent-eval/` (or lib `__agent_eval__/`): task suite + golden Models + per-task round-trip budgets.
- [ ] Scripted MEASURE client (API key) → round-trips, response sizes, structural correctness diff.
- [ ] Golden-transcript GATE (no model) → CI regression gate on round-trip count + correctness.
- [ ] Skill A/B (with vs without modeling skill); periodic live REALISM driver (ADR 0028 method) + verification gate.
- [ ] Structural-diff normalizer (placement-equivalence class; reuse leanSave normalization).

## Wrap-up

When all sub-tasks are complete and the smoke checklist passes:

1. Add a single line under a **new PLAN.md phase** (proposed name: *Phase AI — Pluggable Agent*):
   ```
   - Pluggable AI agent (MCP bridge + declarative contract + eval harness) shipped — see docs/adr/0045..0047 and (this file's git history).
   ```
2. Delete this file. The ADRs are the durable record.
3. Update memory pointer: add a `pluggable-ai-agent` memory (feature shipped, decisions, gotchas) and cross-link the release-automation / integration-test-env memories if the ship path touches them.

## Notes for Claude

- **Order matters:** A (verb layer) is the foundation for D and E — build and unit-test it first against the existing `__axoview__` bridge and e2e helpers before any worker/DO exists. B (layout) can proceed in parallel with A but gates the impressive `set_diagram` demos.
- **Two-package build discipline:** the verb layer + layout are `axoview-lib`; the MCP server + DO are `axoview-worker`; BYOK panel is `axoview-app`. Build after every cross-package section (see the integration-test-env memory: integration PRs get NO auto-CI — dispatch the workflows manually).
- **The two free-tier traps are one line each and silent:** wrong DO migration class (`new_classes` vs `new_sqlite_classes`) → demands paid plan; non-hibernating WS → burns the request budget. Assert both in tests (ADR 0046 acceptance).
- **Determinism is load-bearing across ADRs:** any `Set`-iteration-order or timestamp dependency in the layout engine makes ADR 0047's goldens flaky. No `Math.random`, sorted iteration.
- **Contract ⇄ skill ⇄ eval-suite lockstep:** adding/removing a verb touches the op schema (A), the modeling skill (C), and the task suite (F) in the same commit. The GATE (F) is the guard, but the discipline is manual.
- **Reconciliation cross-links to preserve in code comments:** identity ≠ storage tenancy (ADR 0010 §4); Worker-only carve-out precedent + bundle budget (ADR 0009 §1/§8); shared future credential substrate (ADR 0043 #1). Don't let a reviewer re-litigate these — the ADRs settled them.
