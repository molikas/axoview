# Axoview Agent-MCP Modeling — Findings, Constraints & DevX/UX Report

**Date:** 2026-07-21
**Context:** First real end-to-end use of the running Axoview MCP connection to model a
diagram (an Agile Scrum lifecycle) by an external AI agent, over the local
`wrangler dev` HTTP bridge. Everything below was observed live during that session,
not inferred from code alone.
**Audience:** a follow-up agent tasked with fixing/triaging these. Self-contained —
no prior session context required.
**Transport used:** raw JSON-RPC 2.0 over `POST http://127.0.0.1:8787/mcp/AXV-<code>`
(the MCP tools were **not** auto-loaded as native tools in the client, so the agent
hand-rolled `tools/call`, `prompts/get`, `resources/read`).

---

## TL;DR (highest-leverage fixes first)

1. **Missing `create_rect` / `create_text` / `create_label` verbs** — the *first*
   user request ("add a background") was impossible. Backgrounds, containers,
   swimlanes, and free text cannot be expressed by the agent contract at all.
2. **Skill & state are undiscoverable to a tools-only agent** — the modeling skill
   is an MCP *prompt* and the diagram is an MCP *resource*; an agent that enumerates
   only *tools* never sees either, and nothing in the tool descriptions points to them.
3. **Reading the diagram is grossly token-expensive** — every diagram read returns
   the entire icon catalog inline, including base64-encoded SVGs for all 37 icons.
4. **Connection DevX is fragile** — the pairing code rotates on every reconnect
   (3 codes in one session), the bridge dies when the browser tab loses focus, and
   un-saved diagrams are silently wiped on reconnect.
5. **Cyclic processes render badly** — only 3 linear layout hints exist; a lifecycle
   (inherently a loop) is flattened into a diagonal line with feedback edges cutting
   across. No radial/cyclic layout.

---

## 1. Contract gaps — verbs that don't exist yet

**Evidence:** `packages/axoview-lib/src/agent/opSchemas.ts:16-20` explicitly defers a
set of verbs out of the shipped union:

> The remaining ADR 0045 §3 verbs (`create_rect` / `create_text` / `create_label` /
> `create_view` / `switch_view` / `create_layer` / `set_layer_visibility` /
> `set_layer_locked`) are intentionally NOT in the union yet.

Shipped verbs (Track A): `create_node`, `update_node`, `delete_node`, `connect`,
`disconnect`, `set_style`, `set_layer`. Plus `set_diagram` (declarative whole-diagram)
and read/navigation tools.

**Impact observed:**
- User asked to "add a background." **Impossible via the contract** — no rectangle,
  no container, no canvas fill. `set_diagram` would fail validation on any such op.
- No way to draw **swimlanes**, **section headers**, **grouping backdrops**, or
  **free-standing text/annotations** — all table-stakes for real diagrams.
- The workaround used was **color-coding connectors** to delineate logical groups.
  It works but is a poor substitute for a visual region.
- The app (Axoview editor) *does* support rectangle "shape blocks" — so this is a
  **contract/UI capability mismatch**: the human UI can do it, the agent cannot.

**Recommendation:** prioritize `create_rect` (with z-order/behind support) and
`create_text`/`create_label`. These are the single biggest expressiveness gap. The
lockstep rule (opSchemas ↔ modeling skill ↔ eval suite) means shipping the verb also
requires updating `modelingSkill.ts` and the eval tasks in the same commit.

## 2. No background / region / canvas styling of any kind

`nodeStyleSchema` (opSchemas.ts:45-56) covers **label styling only**: `labelColor`,
`labelFontSize`, `labelBold`, `labelItalic`, `labelUnderline`, `labelStrikethrough`,
`showLabel`, `iconScale`. Connectors support `color`, `style`, `lineType`,
`showArrow`, `label`. **There is no canvas background, no fill region, no grouping
container.** Combined with §1, the agent has zero tools for spatial/visual grouping.

## 3. Icon catalog is infrastructure-only — wrong metaphors for non-infra domains

**The full catalog (37 icons):**
`block, cache, cardterminal, cloud, cronjob, cube, desktop, diamond, dns, document,
firewall, function-module, image, laptop, loadbalancer, lock, mail, mailmultiple,
mobiledevice, office, package-module, paymentcard, plane, printer, pyramid, queue,
router, server, speech, sphere, storage, switch-module, tower, truck-2, truck, user, vm`

Every icon is infra/devops. Modeling a **business/process domain** (Scrum) forced
semantic mismatches: `speech` for every meeting/event, `cronjob` for "Sprint",
`queue` for "Sprint Backlog", `pyramid` for "Product Goal", `cloud` for "Release",
`cube`/`package-module` for work/increment. No people/role, process-step, event,
decision, start/end, or generic-shape icons.

**Silent-substitution hazard:** `resolveKind` (resolveKind.ts) does exact-id →
exact-name → **substring-name** matching and returns the lexicographically-first hit.
A poor-but-close match is chosen with **no confidence signal** back to the agent — the
agent cannot distinguish "exact metaphor" from "desperate substring." No "did you
mean", no alternatives list, no per-match score.

**Recommendation:** ship a domain-agnostic shape set (roles, process steps, events,
decisions, start/stop, plain shapes) and/or return match-quality metadata from
resolution so the agent can flag weak metaphors to the user.

## 4. Connection / session DevX is fragile (biggest live-friction area)

Observed failure modes, in order, during one ~30-minute session:

- **Pairing code rotates on every reconnect.** Codes seen: `AXV-779Y` → `AXV-JJR8`
  → `AXV-95DC`. Each rotation invalidated the previously-working endpoint and
  required a **manual edit of `.vscode/mcp.json`** (or re-pasting the connector URL).
  **3 manual re-syncs in one session.**
- **Bridge dies when the browser tab loses focus.** Switching to the IDE to view
  `mcp.json` idled out the websocket → subsequent calls returned "No active Axoview
  canvas." The user must keep the Axoview tab in the foreground.
- **Closing the "Connect your AI" sidebar fully unregisters the tab** — not just
  idle, the code is dead and a brand-new one is minted on reopen.
- **Un-saved diagrams are silently wiped on reconnect.** The first fully-generated
  diagram (9 nodes/10 connectors, confirmed applied + screenshotted by the user) was
  **lost** when the tab reconnected under a new code — the canvas came back empty
  (`title: "Untitled", nodes: 0`) with no warning, no autosave, no restore.

**Inconsistent error encoding for the *same* underlying state ("no active canvas"):**
- `resources/read` → JSON-RPC **error object**: `{"error":{"code":-32002,"message":
  "No active Axoview canvas — open your diagram in a browser tab and retry."}}`
- `tools/call` (e.g. `set_diagram`) → **successful** RPC envelope with
  `"isError": true` and a stringified `{"error":"No active Axoview canvas…"}` inside
  `result.content[0].text`. (Two different shapes; an agent parsing `counts`/`errors`
  from the diff must special-case this.)
- `get_diagram` → **no error at all**; silently returns an empty diagram
  (`title: "Untitled"`, `nodes: []`) when the bridge is down. Divergent behavior for
  the identical condition across three call sites.

**Recommendations:** stable/reusable pairing code (or a short grace-period + auto-
reattach on refocus); keep-alive so focus loss doesn't drop the socket; autosave or
an explicit "unsaved — will be lost on reload" warning; **one** canonical error shape
across `tools/call` / `resources/read` / `get_diagram`.

## 5. Skill & resource discoverability for modeling (the core "how does an agent
know how to drive this?" problem)

- The **modeling skill** ships as an MCP **prompt** named `modeling-skill`
  (`prompts/list` → `prompts/get`). The **current diagram** ships as an MCP
  **resource** `axoview://diagram/current`. Both are excellent and well-authored
  (`packages/axoview-lib/src/agent/modelingSkill.ts`, `MODELING_SKILL`).
- **But a tools-only agent never sees them.** Most agents enumerate and call *tools*;
  MCP prompts and resources are separate namespaces that many clients don't surface
  and many agents never query. Nothing in any **tool description** says "fetch the
  `modeling-skill` prompt first" or "prefer reading the `axoview://diagram/current`
  resource over calling `get_diagram`."
- **Consequence seen this session:** on the first pass the agent modeled *without*
  the skill, having instead read the skill text out of the repo source
  (`modelingSkill.ts`). **An agent without repo access could not do that** and would
  model blind. The skill was only used "properly" (`prompts/get modeling-skill` +
  `resources/read`) after the user explicitly asked whether the skill had been used.
- **MCP has no push mechanism for prompts** — a carefully-authored skill that the
  client doesn't inject simply never reaches the model. Its whole purpose
  (ADR 0045 §5 / 0047 measured effectiveness) is defeated by delivery, not content.
- **`get_diagram` competes with the resource and is more discoverable**, so agents
  will over-call the expensive tool (see §6) despite the skill saying "prefer the
  resource."

**Recommendations:** add a discovery breadcrumb *inside the tool surface* — e.g. a
`tools/list` entry or every mutating tool's description pointing to the skill prompt
and the resource; or fold a one-paragraph "read the `modeling-skill` prompt first"
into the server's `initialize` instructions field (MCP `serverInfo.instructions`),
which more clients surface than prompts.

## 6. Inefficiencies / token & protocol cost

- **Diagram reads return the entire icon catalog inline, every time** — including
  **base64-encoded SVG `data:` URIs for all 37 icons**. Reading "what nodes are on the
  canvas?" forces receipt of kilobytes of base64 per icon. Extremely token-expensive
  for an LLM, and there is **no projection** ("nodes+connectors only") and **no
  separate lightweight catalog endpoint**. This is the same payload for both
  `get_diagram` and the `axoview://diagram/current` resource.
- **To learn valid `kind` values you must pull the full base64 catalog** — there's no
  cheap "list icon kinds" call.
- **Misleading `counts` feedback:** a create-only `set_diagram` on an empty canvas
  returned `counts: { applied: 33, created: 24, changed: 9 }`. The `changed: 9` is the
  auto-layout **repositioning** the freshly-created nodes — but to the caller it reads
  like it mutated 9 pre-existing things. Pure creation should not report `changed`.
- **Undocumented transport gotcha:** the endpoint requires the `Accept` header to
  include **both** `application/json` **and** `text/event-stream`. A plain JSON POST
  without the SSE type can fail. Not stated anywhere the agent can see.

## 7. Layout is too coarse for cyclic processes (and labels collide)

- Only three layout hints exist: `layered-lr`, `layered-tb`, `grid`
  (`set_diagram.layout`). **No radial / circular / cyclic layout.**
- A lifecycle is **inherently a loop**; with `layered-lr` the whole diagram flattened
  into one long diagonal ribbon, and the crucial **feedback edges** (`retro→backlog`,
  `release→productGoal`, the `daily⇄dev` inner loop) cut backwards across the flow
  instead of closing a visible ring. `layered-tb` is marginally better but the same
  problem. The single most natural shape for a lifecycle — a ring — is unreachable.
- **Edge-label collisions:** at default zoom, connector labels render on top of node
  icons; longer labels ("Sprint Goal + commitment", "refined & prioritized")
  overlapped adjacent nodes. No label-collision avoidance in auto-layout → the agent
  is forced to keep labels artificially short (1–2 words), losing information.

---

## What worked well (keep these)

- **`set_diagram` one-shot declarative generation** — expressing 11 nodes + 13
  connectors + layout hint in a single call, with the engine diffing + auto-laying-out,
  is the right primitive and felt good.
- **Self-assigned agent-local ids with forward references** in one batch — no
  round-trip to learn server ids. Clean.
- **`prune: true`** for full redesign; **diff-shaped result** (`created_ids`, `id_map`,
  `changed`, `errors`, `counts`) instead of echoing the whole model.
- **Per-connector color via palette ids** (`"blue"`, `"green"`, `"purple"`) worked and
  was the salvage for the missing background — three cadence loops rendered distinctly.
- The **modeling skill content itself** is genuinely good — the problem is delivery
  (§5), not the writing.

---

## Priority stack for the next agent

| # | Fix | Why | Rough size |
|---|-----|-----|-----------|
| P0 | `create_rect` (+ z-order/behind) & `create_text` | Unblocks backgrounds/containers/annotations; the first user ask | Medium (lockstep: schema+skill+evals) |
| P0 | Server `instructions` / tool-description breadcrumb → modeling skill + resource | Makes the skill actually reach tools-only agents | Small |
| P1 | Projection / trim base64 catalog from diagram reads | Big token savings on every read | Small–Med |
| P1 | Stable pairing code + focus-loss keep-alive + unsaved-loss warning | Kills the top live-friction items | Medium |
| P1 | One canonical error shape across tools/resource/get_diagram | Removes special-casing; predictable failure | Small |
| P2 | Radial/cyclic layout hint + label-collision avoidance | Lifecycles finally look like loops | Medium |
| P2 | Domain-agnostic icon set + resolveKind match-confidence | Non-infra domains stop getting wrong metaphors | Medium |
| P2 | `changed` should exclude auto-layout repositioning on pure creates | Honest feedback | Small |

## Reproduction notes

- Server: `wrangler dev` on `127.0.0.1:8787`; endpoint `/mcp/AXV-<code>` where
  `<code>` is the rotating pairing code from the in-app "Connect your AI" sidebar.
- Every call: `POST` with headers `Content-Type: application/json` **and**
  `Accept: application/json, text/event-stream`; body is JSON-RPC 2.0.
- Methods exercised: `tools/list`, `tools/call` (`set_diagram`, `get_diagram`),
  `prompts/list`, `prompts/get` (`modeling-skill`), `resources/list`, `resources/read`
  (`axoview://diagram/current`).
- Relevant source: `packages/axoview-lib/src/agent/` (opSchemas.ts, applyOps.ts,
  resolveKind.ts, modelingSkill.ts, setDiagram.ts, mcpManifest.ts) and
  `packages/axoview-worker/src/agent/` (mcpProtocol.ts, agentSession.ts, routes.ts).
- ADRs in play: 0045 (agent control contract), 0046 (MCP session bridge topology),
  0047 (agent interaction eval harness).

---

# Round 2 — real-diagram replication (2026-07-22, deployed edit connection)

**What changed since Round 1:** the deployed bridge (`axoview-mcp.molikas.workers.dev`)
shipped a large chunk of the Round-1 asks — verified live:
- ✅ `create_rect` / `create_text` / `create_label` now in the `apply_ops` op enum.
- ✅ `create_diagram` + `save_diagram` tools (fixes unsaved-loss).
- ✅ Modeling skill injected into `initialize.instructions` (not just a prompt) — reaches tools-only agents.
- ✅ Icon catalog base64 stripped from diagram reads (`icon.url:""`) — reads are ~3.8 KB.
- ✅ Read-only vs edit **consent model**: read-only connections hide write verbs and return `-32010`.
- ✅ Tool descriptions steer to the resource over `get_diagram`.

**The test:** take a real production diagram exported from Axoview (`SDLC V2`, an
insurance-platform SDLC map: ~96 placed nodes, ~60 connectors, 28 rectangles, 24 text
boxes, 3 imported PNG icons, a `material` icon pack, waypoint-routed connectors,
per-node wiki `headerLink`s) and rebuild it **using only MCP**. Script:
`scratchpad/rebuild.py` (transcribes the export → `apply_ops` batches).

**Result — 199 elements built, 0 failures:** 96 nodes · 55 connectors · 25 rectangles
· 23 text boxes. The skeleton (positions, zones, lanes, flow) came through. But
faithful reproduction is still blocked. Fidelity ≈ 50–60% structural, visibly different.

## What replicated 1:1

| Feature | Verified |
|---|---|
| Nodes at **exact hand-placed tiles** (`create_node.tile`) | ✓ all 96 |
| Label color + font size (`style.labelColor/labelFontSize`) | ✓ |
| **Zone/lane rectangles** incl. hex `customColor` (`create_rect from/to/color/customColor`) | ✓ all 25 |
| **Horizontal** text labels (`create_text content/tile/fontSize/color/isBold`) | ✓ |
| Connectors: 2-anchor, palette color, `DOTTED`/`SOLID`, `SINGLE`/`DOUBLE`, arrow toggle | ✓ all 55 |
| Connector endpoints referencing a **tile** (not just an item) | ✓ |

## Gaps that block 1:1 fidelity (each confirmed by a live op error)

| # | Gap | Evidence | Impact on this diagram |
|---|-----|----------|------------------------|
| R2-1 | **No custom icon import** (base64 PNG) | `kind` resolves catalog only | 9 nodes → placeholder |
| R2-2 | **No `material` pack / non-iso icons** | `requiredPacks` unreachable; `material_*` kinds don't resolve | 12 nodes → placeholder (9 arrows + 3 glyphs) |
| R2-3 | **`create_node` rejects `headerLink`** | `Unrecognized keys: "headerLink"` | every 🤖-agent's wiki link lost (folded into `notes` as a workaround) |
| R2-4 | **`create_node` rejects `description`** | `Unrecognized keys: "description"` | minor (notes survives) |
| R2-5 | **`connect` rejects `waypoints` / no multi-anchor** | `Unrecognized keys: "waypoints"`; schema is `from`+`to` only | all 55 connectors lose hand-routing → straight/default paths (in a dense map this is the biggest *visual* regression) |
| R2-6 | **`connect` rejects `width`** | `Unrecognized keys: "width"` | no thick connectors |
| R2-7 | **`connect` rejects `customColor`** | `Unrecognized keys: "customColor"` | capped at 7 palette colors |
| R2-8 | **`connect` no positional `labels[]`** | single `label` at fixed pos 50 | multi-label edges lost |
| R2-9 | **`create_text` rejects `orientation`** | `Unrecognized key: "orientation"` | 4 vertical swimlane titles flattened to horizontal |
| R2-10 | **No per-node `labelHeight`/`offset`/`zIndex`/`snap`** | not in `nodeStyleSchema` | label nudging & z-order lost |
| R2-11 | **`kind:"database"` → `unknown kind`** | live error | the skill's own canonical example doesn't resolve against the shipped catalog (lockstep drift, same class as the `radial` layout enum gap) |

## New DevX findings this round

- **Pairing codes EXPIRE on a TTL**, not just rotate on reconnect — a working edit code
  (`AXV-XZMJ-TVAS-B4JB`) went dead mid-session with `-32010 "Pairing expired — re-pair…"`.
  Combined with rotate-on-reconnect (Round 1 §4), a long agent job is very likely to
  outlive its credential. **Needs a refresh/renew path or a much longer TTL for edit
  sessions.**
- **Cloudflare WAF 403s non-browser User-Agents.** `Python-urllib/*` → `HTTP 403
  Forbidden` at the edge; `curl` and `Mozilla/5.0` pass. Any non-browser MCP client
  (scripts, CI, headless agents) needs a browser-like UA or it's blocked before reaching
  the worker. Undocumented.
- **Writes hang on backgrounded tab** (Round 1 focus-loss, still present): `-32010
  "Timed out waiting for the Axoview tab to respond."` after ~15–30 s when the browser
  tab isn't foregrounded. Reads sometimes still serve; writes don't.

## Suggested improvements to the modeling skill (`modelingSkill.ts` / `MODELING_SKILL`)

The skill text is good but now **drifts from the shipped contract** and **omits the
newly-shipped verbs**. Concrete edits:

1. **Fix the canonical example** — `kind: "database"` doesn't resolve. Either add a
   `database` icon or change the example to a real catalog id (`server`, `storage`).
   Lockstep rule already requires skill↔schema coherence; this violates it.
2. **Document the new verbs** the code ships but the skill never mentions: `create_rect`
   (`{from,to}` | `{around}`, `color`, `customColor`), `create_text`
   (`{content,tile,fontSize,color,isBold,isItalic,isUnderline}` — **no `orientation`**),
   `create_label`, `create_diagram`, `save_diagram`. Right now an agent only discovers
   them by probing errors (as this session did).
3. **State the hard limits inline so agents don't attempt them:** connectors are
   **exactly two anchors** (no waypoints/manual path/width/customColor); text is
   **horizontal only**; nodes have **no `headerLink`/`description`**; icons are the
   **catalog only** (no import, no material). A short "Not supported yet" list prevents
   wasted ops and mis-set user expectations.
4. **Reconcile `radial`:** the injected instructions advertise `layout: radial` but
   `set_diagram.layout`'s enum is `layered-lr|layered-tb|grid`. Either ship `radial` in
   the enum or drop it from the skill until it lands.
5. **Add an "exact-replication vs. generation" note.** The skill is written for
   *generation* ("never compute a tile"). But agents are now asked to *replicate* exact
   exports — the skill should acknowledge that supplying `tile` for faithful placement is
   legitimate, and point at `create_rect`/`create_text` for zones/labels.
6. **Teach the `headerLink→notes` fallback** (and any other lossy-but-lossless-ish
   workarounds) so data isn't silently dropped when a field isn't supported.

## Updated priority stack (Round 2)

| # | Fix | Why |
|---|-----|-----|
| P0 | Icon import + non-iso/material packs via `kind` | #1 fidelity killer; 21/96 nodes unbuildable here |
| P0 | `create_node.headerLink` | semantic data loss, not cosmetic |
| P0 | Skill: fix `database` example + document new verbs + list "not supported" | stops drift + wasted ops (cheap, high-leverage) |
| P1 | `connect` waypoints / manual path | dense diagrams unreadable without routing |
| P1 | Edit-session credential that survives a long job (TTL refresh / renew) | pairing expiry killed a mid-run job |
| P1 | Document the browser-UA requirement (or relax the WAF for the MCP path) | non-browser clients 403 silently |
| P2 | `create_text` vertical orientation; connector `width`/`customColor`; positional labels | remaining visual fidelity |
| P2 | Node `labelHeight`/`offset`/`zIndex`/`snap` | fine layout control |
| P2 | Ship `radial` in `set_diagram.layout` enum (or remove from skill) | lockstep |

## Reproduction (Round 2)

- Deployed endpoint `https://axoview-mcp.molikas.workers.dev/mcp/AXV-<code>` (edit-scoped
  pairing). Source export: `sdlc-v2-20260702-1501.json`. Transform: `scratchpad/rebuild.py`
  (maps items→`create_node` with `tile`, rectangles→`create_rect`, textBoxes→`create_text`,
  connectors→`connect` first+last anchor; unknown `kind`→`cube` placeholder, tracked;
  `headerLink`→appended to `notes`).
- Non-browser clients MUST send `User-Agent: Mozilla/5.0` (Cloudflare WAF) and, on a
  stale local CA bundle, an unverified TLS context (server cert is valid; `curl` confirms).
