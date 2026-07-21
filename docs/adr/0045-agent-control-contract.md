# ADR 0045 — Agent Control Contract (Declarative Canvas Verb Layer, Reconcile + Auto-Layout, Modeling Skill)

**Status:** Proposed
**Date:** 2026-07-21
**Supersedes:** none
**Superseded by:** none

## Context

We want to let a user's own AI (running in Claude.ai / ChatGPT / Cursor, or an embedded BYOK loop) read a diagram's context and manipulate the canvas. The transport for that is decided in [ADR 0046](0046-mcp-session-bridge-topology.md); this ADR locks the **transport-agnostic contract** — *what the agent can do to the canvas and in what shape* — so both the MCP bridge (0046 primary) and the embedded BYOK loop (0046 alternate) sit on one surface.

The load-bearing product constraint (owner, 2026-07-21): **do not emulate the UI over the wire.** An agent that moves one node one tile per round-trip is unusable — it burns the user's model tokens and their MCP round-trip budget ([ADR 0046](0046-mcp-session-bridge-topology.md) free-tier ceiling), and produces a slow, twitchy result. The heavy lifting must shift to the user's AI: it should express *topology and intent in one shot*, and Axoview should reconcile + lay out.

Two facts about the current codebase shape this decision (both grep-confirmed 2026-07-21):

- **The curated agent surface does not exist yet.** [Axoview.tsx:136-192](../../packages/axoview-lib/src/Axoview.tsx) attaches `window.__axoview__` = `{ui, model, scene, changeView}` — raw Zustand `StoreApi` handles, gated behind `exposeStoreBridge` ([axoviewProps.ts:662](../../packages/axoview-lib/src/types/axoviewProps.ts)). That is a debug bridge, not an action API. The transaction-correct mutation façade is the React hook [useSceneActions.ts](../../packages/axoview-lib/src/hooks/useSceneActions.ts) (`createViewItem`, `updateViewItem`, `createConnector`, `placeIcon`, `deleteSelectedItems`, and `transaction(ops)` which collapses N ops into **one undo entry**). This ADR's verb layer wraps that hook; it is net-new code.
- **No auto-layout engine exists.** Placement is manual today — off-grid + per-item collision per [ADR 0023](0023-off-grid-positioning-and-collision.md), tile geometry per [ADR 0038](0038-webgl-instanced-render-substrate.md)'s substrate. "Axoview does the layout so the AI never computes a tile" requires a placement engine that must be built. It is the single largest build item under this ADR.

## Decision

### 1. One curated agent surface, three layers of abstraction

Publish `window.__axoview__.agent` — a curated action façade over `useSceneActions`, **separate from** the raw-store debug bridge (which stays as-is for e2e/diagnostics). Every mutating call runs inside one `transaction()` → **one call = one undo entry**. The surface exposes exactly three mutation verbs plus cheap reads, ordered cheapest-intent to highest-intent:

| Verb | Layer | Shape | When the agent uses it |
|---|---|---|---|
| `apply_ops(ops[])` | **Floor** | A typed array of edit ops, applied atomically in one transaction | Targeted edits — "add a cache between api and db", "rename these three", "restyle all db nodes". One call, N edits. |
| `set_diagram(spec)` | **Power** | A whole desired `Model` (or a named view subtree) declaratively | Wholesale generation / redesign — "build a 3-tier web app". Axoview **diffs** against current state, applies the minimal patch, and auto-lays-out anything without explicit coordinates. |
| `apply_intent(intent)` | **Sugar** (deferred to v1.1) | A high-level intent string + params, expanded server-side via templates | "scaffold a microservices topology with 5 services". Fewest tokens, most app-side smarts. Not built in v1 — reserved so the contract has a growth path. |

`apply_intent` is **declared but not implemented in v1**. Locking its slot now keeps `apply_ops` / `set_diagram` from absorbing template concerns later.

### 2. The six round-trip-minimizing invariants (the heart of this ADR)

These are the rules that make the difference between "declarative" and "UI emulation." They are **normative** on both verbs.

1. **Coordinates are optional.** A node/element supplied without a `tile` is placed by the auto-layout engine (§4). The agent expresses *topology and grouping*, never tile math, unless it deliberately wants an exact position. This is the primary "no moving tiles one at a time" lock.
2. **Agent-local IDs are first-class and forward-referenceable within a single call.** The agent may assign its own string ids (`"web"`, `"db"`) and reference them in the *same* batch — `create_node id:"web"` then `connect from:"web" to:"db"` in one `apply_ops`. Axoview maps agent-local ids → real `generateId()` ids atomically and returns the mapping. **No round-trip is ever required to learn a server-assigned id before referencing it.**
3. **One call = one transaction = one undo entry.** Implemented via `useSceneActions.transaction()`. A user can undo an entire agent action with one Ctrl+Z.
4. **Reads are a resource, not a round-trip.** The current diagram is exposed as a *pullable context resource* (`get_diagram`, compact JSON via `exportAsJSON` in [exportOptions.ts:69](../../packages/axoview-lib/src/utils/exportOptions.ts)), so the agent reads state as free context rather than spending a tool call. A `get_diagram` *tool* also exists for explicit mid-task refresh. (MCP exposes this as an actual `resource`; see [ADR 0046 §5](0046-mcp-session-bridge-topology.md).)
5. **Results are diffs, not dumps.** Every mutation returns only `{created_ids, id_map, changed, errors[], counts}` — never the full model. Keeps the response cheap and the agent's context lean.
6. **Partial success is explicit, never silent.** An op that fails (invalid ref, collision it can't resolve, unknown kind) returns a per-op error in `errors[]`; the rest of the batch still applies. The agent gets a precise, actionable failure list in one response instead of an all-or-nothing rejection that forces a retry round-trip.

### 3. The op vocabulary (`apply_ops`)

A closed, versioned set of typed ops, each mapping to one or more `useSceneActions` calls. v1 set (extensible — adding an op is a minor contract version bump):

```
create_node   { id, kind, name?, label?, notes?, tile?, layerId?, style? }
update_node   { id, name?, label?, notes?, tile?, style?, iconScale? }
delete_node   { id }
connect       { id?, from, to, style?, lineType?, label?, showArrow? }   // from/to = node id | anchor
disconnect    { id }
create_rect   { id, from|tile+size, color?, border?, fillOpacity?, layerId? }
create_text   { id, tile, content, ... }
create_label  { id, tile|attachTo, text, ... }
set_style     { targets[], style }                    // bulk restyle in one op
set_layer     { targets[], layerId }                  // bulk layer assignment
create_view / switch_view / create_layer / set_layer_visibility / set_layer_locked
```

`kind` resolves against the icon catalog ([ADR 0002](0002-icon-catalog-merge-on-load.md)); an unresolved kind is a per-op error, not a crash. `from`/`to` accept a node id (auto-anchored) or an explicit `{item, anchor}` / `{tile}` ref, mirroring the `Connector.anchors` schema. Style objects use the element-text-style field convention ([ADR 0033](0033-element-text-style-field-convention.md)) and the unified palette ([ADR 0039](0039-unified-color-picker-and-standard-palette.md)).

### 4. The auto-layout engine (build dependency, owned by this ADR)

`set_diagram` and any coordinate-less `create_node` invoke a **deterministic tile-placement pass**:

- **Connected graphs** → a **layered / hierarchical** layout (topological rank → left-to-right lanes), snapped to the iso tile grid, honoring per-item collision ([ADR 0023](0023-off-grid-positioning-and-collision.md)). The agent may steer with declarative hints — `layout: 'layered-lr' | 'layered-tb' | 'grid' | 'freeform'` and `group`/`cluster` tags — never coordinates.
- **Disconnected sets** → a grid pack.
- **Existing positioned elements are respected**: a reconcile (`set_diagram`) only lays out nodes that lack a tile *and* aren't already placed on the canvas — it never reflows what the user hand-placed unless asked (`relayout: true`).
- **Determinism is required** so the eval harness ([ADR 0047](0047-agent-interaction-eval-harness.md)) can assert a golden output. No `Math.random()` in placement (also a hard constraint of the workflow environment).

Implementation may adapt an existing graph-layout core (e.g. an ELK/dagre-style layered algorithm) to tile coordinates rather than hand-rolling; the **non-binding** choice is in the tactical. The binding decision is: *the engine exists, it is deterministic, and the agent never needs to compute a tile.*

### 5. The modeling skill (MCP prompt / resource; system-prompt block for BYOK)

A single authored artifact — surfaced as an **MCP prompt** for the bridge and inlined into the **system prompt** for BYOK — that teaches the model to use this contract *efficiently*. It is versioned alongside the op vocabulary. It teaches:

- The data model: a node is a `ModelItem` (identity: name/label/notes/icon) + a `ViewItem` (placement/style) **sharing one `id`** ([schemas](../../packages/axoview-lib/src/schemas/)); connectors carry `anchors` with `{item|anchor|tile}` refs; layers have `visible`/`locked` ([ADR 0013](0013-preview-mode-layer-switcher.md)); the iso tile coordinate system exists **but is optional**.
- The efficiency patterns, stated as rules the model should follow: *prefer one `apply_ops` carrying every node and connector; assign your own ids and forward-reference them; omit `tile` unless you need an exact spot; use `set_diagram` for wholesale redesign, not a hundred `apply_ops`; read via the diagram resource, don't call `get_diagram` each turn.*
- The failure protocol: read `errors[]`, fix only the failed ops, resend just those — never blind-retry the whole batch.

The skill's effectiveness is a **measured quantity** ([ADR 0047](0047-agent-interaction-eval-harness.md) runs the task suite with and without it loaded); it is tuned against that harness, not by intuition.

### 6. Safety boundary

The typed verb set **is** the security boundary — the agent can only ever call these verbs, never arbitrary code. Destructive verbs (`delete_node`, `disconnect`, `delete_view`, bulk `set_style`/`set_layer` over large target sets) are **gated**: in the MCP transport via the client's tool-confirmation prompt where available and an app-side confirm for large-blast-radius ops; in the BYOK transport via an app-side confirm. Diagram content the agent reads back (labels, notes) is untrusted input (prompt-injection surface) — but it can only ever cause more *typed verb calls*, which are already bounded. Cross-reference [ADR 0029](0029-sanitize-user-authored-html.md) for the HTML-sink sanitization that still applies to any agent-authored text/label content.

## Consequences

**Positive:**
- The round-trip-minimizing invariants (§2) make "build a 12-node diagram" a **one-call** operation, not a 30-round-trip crawl — directly serving the owner's optimization mandate and 0046's free-tier ceiling.
- One contract, two transports: the MCP bridge and the BYOK loop are pure transports over this surface. Neither is redundant; the contract is the shared foundation.
- Determinism (§4) makes the whole thing testable — [ADR 0047](0047-agent-interaction-eval-harness.md) can assert golden Models and fail CI on a round-trip regression.
- `transaction()` reuse means every agent action is one clean undo — no special-casing agent edits in history.

**Negative / risks:**
- **The auto-layout engine is real, non-trivial work** and has no prior art in the repo. A weak layout makes the agent's output look bad even when topology is correct. This is the highest-risk build item; it earns explicit sub-tasks and its own eval cases.
- **Contract versioning debt.** The op vocabulary + modeling skill must stay in lockstep; a skill that describes a verb the code doesn't ship (or vice versa) mis-steers the model silently. The eval harness is the guard, but drift is a standing cost.
- **`apply_intent` reserved-but-empty** risks looking like a live feature to a model that reads the surface. The modeling skill must not describe it until it ships.
- **Layout non-determinism would break the harness** — a subtle `Set`-iteration or timestamp dependency in placement would make golden tests flaky. Guarded by the determinism lock, but easy to violate.

## Implementation notes (non-binding)

- The verb layer lives in `axoview-lib` (a new `src/agent/` module) so both transports import it; it is exported alongside the existing `standaloneExports.ts` surface where a Node-side (worker) consumer needs the op schemas.
- Op schemas are Zod (mirroring `src/schemas/`) so `apply_ops` validates at the boundary and the same schema feeds the MCP tool `input_schema` and the BYOK tool definition — one source of truth.
- Auto-layout: evaluate adapting `elkjs` (layered algorithm, pure-JS, deterministic) to tile coords vs a hand-rolled rank-and-pack. Bundle cost matters on the worker side ([ADR 0046 §](0046-mcp-session-bridge-topology.md) / [ADR 0009 §8](0009-deployment-topology.md) <1 MB) — but layout runs **in the tab**, not the worker, so the worker bundle is unaffected; the app bundle absorbs it.
- `get_diagram` compact form reuses `stripDefaultIcons` / `exportAsJSON` from [leanSave.ts](../../packages/axoview-lib/src/utils/leanSave.ts) / [exportOptions.ts](../../packages/axoview-lib/src/utils/exportOptions.ts).

## Acceptance criteria

- **Unit test:** `apply_ops` with a forward-referenced id (`create_node id:"web"` + `connect from:"web" to:"db"` in one call) produces a connected pair in one transaction / one undo entry; the returned `id_map` resolves both agent-local ids.
- **Unit test:** a coordinate-less `set_diagram` of a 6-node connected graph places all six non-overlapping on the tile grid, deterministically (same input → byte-identical tiles across runs).
- **Unit test:** a batch with one invalid op returns that op in `errors[]` while the valid ops still apply (partial-success invariant).
- **Manual verification:** with the modeling skill loaded, a single natural-language request ("3-tier web app with labelled connectors") yields a correct diagram in **one** `set_diagram` call (verified via the 0047 harness round-trip counter).
- **Contract/skill lockstep:** the modeling skill describes exactly the verbs the code ships — no verb in the skill that isn't implemented, and `apply_intent` is absent from the skill until it ships.
