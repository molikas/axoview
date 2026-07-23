# Axoview MCP Agent — Consolidated Laundry List for the Next Testing Session

**Date:** 2026-07-21
**Purpose:** one prioritized, self-contained backlog to work through before/at the next
MCP testing session. Merges three inputs:
1. The live DevX/modeling field report — [agent-mcp-modeling-devx-findings-2026-07-21.md](agent-mcp-modeling-devx-findings-2026-07-21.md) (an external agent modeling a Scrum lifecycle over the live bridge).
2. Security review of the pairing/session model (this session).
3. Deployment-wiring review (this session).

Plus the **owner's headline requirement (2026-07-21):** *when a user is connected via
MCP and signed into Google, the agent should create new diagrams, read existing ones,
and the connection should carry a **read-only vs read-write** scope that protects users
from malicious or unintentional edit/delete.* That is **Feature A** below and is the
single biggest new piece of work.

ADRs in play: [0045](../adr/0045-agent-control-contract.md) (contract),
[0046](../adr/0046-mcp-session-bridge-topology.md) (transport/identity),
[0047](../adr/0047-agent-interaction-eval-harness.md) (eval). Current state: Tracks A–F
implemented + unit-tested; first live test done; ADRs still **Proposed**.

---

## THE LAUNDRY LIST (master priority table)

| # | Item | Theme | Size | Source |
|---|------|-------|------|--------|
| **A** | **Identity-scoped sessions: read-only/read-write scope + diagram-library CRUD (create/list/open) + destructive-op confirm** | **Owner ask / security** | **Large** | owner |
| S1 | Rate-limit `/pair/new` + `/mcp/:code` (KV counter / CF rule) | security | Small | sec review (ADR 0046 §8) |
| S2 | Higher-entropy pairing code (8+ chars / opaque token) | security | Small | sec review |
| S3 | Destructive-op confirm gate (delete/prune/bulk) — folds into A | security | Small–Med | ADR 0045 §6 |
| D1 | **Verify/close prod Pages-Functions + DO deploy wiring** (blocks everything in prod) | deploy | Med | deploy review |
| D2 | `docs/deployment.md` MCP section + self-host "no bridge" note + `/ship` DO-migration awareness | deploy | Small | deploy review |
| C1 | Ship `create_rect` (+ z-order/behind) & `create_text` / `create_label` verbs (lockstep: schema+skill+evals) | contract | Med | field report §1 |
| C2 | Region/background/grouping styling (swimlanes, backdrops) | contract | Med | field report §2 |
| C3 | Domain-agnostic icon set + `resolveKind` match-confidence signal | contract | Med | field report §3 |
| X1 | Discovery breadcrumb: `serverInfo.instructions` + tool descriptions point to skill prompt + resource | discoverability | Small | field report §5 |
| E1 | Trim/strip the base64 icon catalog from diagram reads + add projection ("nodes+connectors only") + cheap "list kinds" | efficiency | Small–Med | field report §6 |
| E2 | One canonical error shape across `tools/call` / `resources/read` / `get_diagram` | efficiency | Small | field report §4/§6 |
| E3 | Full Streamable-HTTP: `Mcp-Session-Id`, `GET` SSE stream, `Accept` negotiation | transport | Med | sec/field (§6) |
| E4 | Honest `changed` count on pure creates — **root-cause first (see Revisions)** | efficiency | Small | field report §6 |
| V1 | Connection persistence: don't unregister on panel-close; keep-alive on focus-loss; reuse code on reconnect | DevX | Med | field report §4 |
| V2 | Unsaved-diagram loss: autosave or explicit "will be lost" warning | DevX | Small–Med | field report §4 |
| L1 | Radial/cyclic layout hint + edge-label collision avoidance | layout | Med | field report §7 |

**Suggested order for the next session:** D1 (is it even deployable?) → A (owner ask,
also delivers S3) → S1/S2 (make the endpoint safe) → X1/E1/E2 (cheap, high-leverage DevX)
→ C1 (biggest expressiveness gap) → the rest.

---

## Feature A — Identity-scoped MCP sessions (owner ask, designed)

**Goal.** A connection declares a **scope** and (when signed in) a **user identity**;
the agent can work across the user's diagram library, and edits are gated so a
malicious/careless agent can't silently mutate or delete.

This is a **capability-scope + interim-identity** layer. It is *not* full OAuth (ADR
0046 §3 v2) — it rides the existing pairing registration, so it ships now. It needs an
**ADR addendum** (0045 for the scope/verb model, 0046 for identity-via-pairing).

**A.1 — Scope at connect (UI + wire).** The "Connect your AI" panel gains a scope toggle,
**defaulting to read-only**: `Read-only` vs `Allow edits`, with an optional `confirm
deletes` sub-flag. The chosen scope + the signed-in Google identity (id/email already
available via `AppStorageContext` / `@react-oauth/google`) are included in the DO
`register` message (`bridgeClient.registerMessage()` → add `{ scope, user }`).

**A.2 — Enforcement is tab-side and authoritative.** `createAgentSurface` /
`createBridgeClient` take the scope. In read-only mode every mutating verb (`apply_ops`,
`set_diagram`, `delete_node`, `disconnect`, `set_style`, `set_layer`, plus the new CRUD
verbs) returns a typed `{ error: "connection is read-only" }`; only reads pass
(`get_diagram`, `list_*`, `open_diagram`). Because the **tab** decides, a forged
`tools/list` on the worker can never bypass it (the verb layer is the boundary — ADR 0045
§6). Belt-and-suspenders: the worker also drops mutating tools from `tools/list` when the
manifest says read-only.

**A.3 — Advertise scope.** Reflect scope in the manifest + `serverInfo.instructions`
("this connection is read-only") so the agent doesn't waste turns attempting edits.

**A.4 — Diagram-library verbs (app-side, storage-aware).** The lib surface is
canvas-only; the **app** injects storage handlers (it owns `DiagramLifecycleProvider` /
`AppStorageContext` / Drive). Wire the currently-**stubbed** `open_diagram` (nav.loadDiagram
is `undefined` in `Axoview.tsx`) and add:
- `list_diagrams` → the user's stored diagrams (session + **Drive** files for Google users).
- `open_diagram(id)` → `AxoviewRef.load`.
- `create_diagram(name?, spec?)` → new blank (or seeded) diagram.
- `save_diagram` → persist (Drive for signed-in users).
Note `list_canvases` today lists **views/pages within a tab**, not stored diagrams — keep
both, name them clearly.

**A.5 — Destructive-op confirm (= item S3).** Even in write mode, `delete_node`, `prune:
true`, and bulk `set_style`/`set_layer` over a threshold trigger an **app-side confirm**
(ADR 0045 §6, currently unbuilt). Read-only default + confirm-on-destructive is the core
of "protect from malicious/unintentional edit/delete."

**Google linkage.** Interim: identity rides registration (log/display "connected as X";
a code can only drive that user's tab). Full binding (DO keyed by Google `sub`, no
copy-paste code) = OAuth v2, still deferred — but the **read-only scope is independent of
OAuth and should ship now**.

---

## Revisions to the field report (corrected root causes)

The field report is accurate on symptoms; two of its *root-cause guesses* don't match the
code and should be re-diagnosed before fixing:

- **`changed: 9` on a pure create (report §6).** The report attributes it to "auto-layout
  repositioning." **That's not what the code does** — `applyOps` pushes created nodes to
  `created_ids` only and never re-updates them, so pure `create_node` ops cannot produce
  `changed`. Real candidates: the canvas was **not empty** (a prior un-pruned
  `set_diagram` left nodes that then matched by id → `update_node`), or a diff-accounting
  bug. **Reproduce on a verified-empty canvas first;** fix the real source (E4).
- **base64 icon catalog on every read (report §3/§6).** `get_diagram` already runs
  `stripDefaultIcons` (compares `name/url/collection/isIsometric` vs bundled fixtures), so
  default icons *should* be stripped to `[]`. If base64 still comes back, the runtime icon
  **`url` differs from the fixture** (the bundler rewrites asset URLs / hashes them), so
  the field-compare misses. **Fix is likely strip-by-id, not by-url** — and/or a real
  projection (E1). Verify which before adding an endpoint.

Everything else in the report is confirmed against code (see per-item file refs there).

---

## Security (S1–S3) — current posture is dev-grade, not production

- **S1 rate-limit.** `/pair/new` + `/mcp/:code` are wide open (ADR 0046 §8 mandates a
  rate limit "from day one" — deferred). KV counter or CF rule. Blocks brute-force + DoS.
- **S2 code entropy.** Alphabet is 31 chars × 4 = **~923k** combinations — brute-forceable
  within the 10-min TTL, especially with no S1. The code is *copy-pasted*, not typed, so
  make it long (opaque token / 8+ chars) at near-zero UX cost. (`pairing.ts`.)
- **S3 destructive-op confirm.** ADR 0045 §6 spec'd it; unbuilt. Delivered as part of A.5.
- **Data-path note.** MCP diagram content flows *through* `axoview-worker` to the model
  provider (ADR 0046 §8) — relayed, never persisted, but worth a one-line user disclosure
  for private/Drive diagrams (the removed BYOK path avoided this; MCP doesn't).

## Deployment (D1–D2)

- **D1 (blocker).** No `functions/` dir or `_worker.js` exists in-repo; CI builds Functions
  via `wrangler pages functions build`. **Unverified whether a Pages deploy actually ships
  `app.ts` as a Function with the `AGENT_SESSION` DO binding + `new_sqlite_classes`
  migration applied.** The Drive proxy shares this dependency. Until confirmed, **the DO
  won't exist in prod** and none of the MCP work is reachable there. Investigate first.
- **D2.** `docs/deployment.md` needs an MCP section (DO binding, migration, no pairing-v1
  secrets, rate-limit setup) + the explicit **self-host has no bridge** note (Cloudflare-
  only, ADR 0046 §1). Local: Docker/self-host = no MCP; local CF = `npm run dev:mcp`
  (`wrangler dev`, IPv4 `127.0.0.1:8787` — `localhost` fails Node fetch with
  `AggregateError`). `/ship` should gain DO-migration awareness.

## Contract expressiveness (C1–C3)

- **C1** `create_rect` (z-order/behind) + `create_text`/`create_label` — the deferred
  verbs (`opSchemas.ts:16-20`); the *first* user ask ("add a background") was impossible.
  Lockstep: schema + `modelingSkill.ts` + eval tasks in one commit.
- **C2** region/background/grouping styling (swimlanes, backdrops) — `nodeStyleSchema` is
  label-only today.
- **C3** domain-agnostic icons (roles/process/events/decisions/plain shapes — the catalog
  is 37 infra icons) + `resolveKind` returns a match-confidence signal so the agent can
  flag weak metaphors instead of silently substituting.

## Discoverability (X1)

- Skill (MCP **prompt**) + diagram (MCP **resource**) are invisible to a tools-only agent.
  Add a breadcrumb *in the tool surface*: put "read the `modeling-skill` prompt first;
  prefer the `axoview://diagram/current` resource over `get_diagram`" into
  `serverInfo.instructions` (more clients surface it than prompts) and each mutating tool's
  description. Content is good; **delivery** is the gap (ADR 0045 §5 effectiveness).

## Efficiency / transport (E1–E4)

- **E1** projection + strip base64 (see Revisions) + a cheap "list icon kinds" call.
- **E2** one canonical error shape — today "no active canvas" appears as a JSON-RPC error
  (`resources/read`), an `isError:true` tool result (`tools/call`), and a *silent empty
  diagram* (`get_diagram`). Pick one.
- **E3** full Streamable-HTTP (`Mcp-Session-Id`, `GET` SSE, `Accept` negotiation) — current
  worker is POST-JSON only; this is why clients need the dual `Accept` header and why some
  reject the connection.
- **E4** honest `changed` — after root-causing (Revisions).

## Layout (L1)

- Radial/cyclic layout hint (lifecycles are rings; `layered-lr/tb/grid` flatten them into
  diagonal ribbons with feedback edges cutting across) + edge-label collision avoidance
  (labels overlap icons at default zoom, forcing 1–2-word labels).

---

## Keep (validated as good — don't regress)

`set_diagram` one-shot declarative generation; self-assigned forward-referenced ids in one
batch; `prune:true` redesign; diff-shaped results; per-connector palette colors; the
modeling-skill *content*. (Field report "What worked well.")
