# ADR 0047 — Agent Interaction Eval Harness & Measurement Protocol

**Status:** Proposed
**Date:** 2026-07-21
**Supersedes:** none
**Superseded by:** none

## Context

The pluggable-agent contract ([ADR 0045](0045-agent-control-contract.md)) exists to be **efficient** — its whole reason for the declarative, coarse-grained shape is to minimize round-trips and shift heavy lifting to the user's AI. "Efficient" is a claim that must be *measured*, or the contract and the modeling skill will drift toward whatever felt right in a demo. Axoview already treats measurable qualities this way and gives each its own harness + written protocol:

- **Engine performance** — [ADR 0020](0020-engine-perf-harness-and-measurement-protocol.md) (perf harness + tier ladder + anti-cheat).
- **Operational tracing** — [ADR 0007](0007-trace-harness.md) (three zero-cost-when-off layers; the deferred `/trace` skill).
- **Usability** — [ADR 0028](0028-ux-journey-testing-protocol.md) (persona-driven journey tests + a mandatory verification gate; the deferred `/ux-journey-test` skill).

This ADR adds the fourth: a harness + protocol for **agent-interaction quality**, and it inherits those three's disciplines — zero-cost-when-off, a deterministic metric of record, a verification gate against agentic noise, and a deferred-skill candidate.

## Decision

### 1. What we measure — four axes

| Axis | Metric | Why it's the right number |
|---|---|---|
| **Round-trips** | Tool calls per task (the primary optimization target) | Directly measures "did the AI do it in one shot or crawl?" — the [ADR 0045](0045-agent-control-contract.md) mandate and the [ADR 0046 §6](0046-mcp-session-bridge-topology.md) free-tier envelope. |
| **Tool-call efficiency** | Edits per call; wasted/failed/retried calls; response-token size | Catches "one call but it re-sent the whole model every turn" and blind-retry storms (the §2-invariant-6 failure the contract is designed to prevent). |
| **Skill effectiveness** | Task success + round-trips **with vs without** the modeling skill loaded | Turns "is the skill worth it?" into a delta, not an opinion. Tunes the [ADR 0045 §5](0045-agent-control-contract.md) skill against evidence. |
| **Interaction correctness** | Resulting `Model` vs a golden expected Model (structural diff) | The agent can be *fast and wrong*; correctness is the gate that efficiency doesn't get to trade away. |

### 2. The task suite

A fixed, versioned set of modeling tasks, each carrying a natural-language prompt, a **golden expected `Model`** (structural — topology + labels + styles, tolerant of layout coordinates within a placement-equivalence class), and a **round-trip budget**. Starter set:

- **Generate:** "3-tier web app (web → api → db) with labelled connectors" → expect **1** `set_diagram`.
- **Incremental edit:** "add a Redis cache between api and db" → expect **1** `apply_ops`.
- **Bulk restyle:** "make every database node blue" → expect **1** `apply_ops` with one `set_style` over the target set.
- **Redesign:** "convert this to a microservices topology with an API gateway and 5 services" → expect **1** `set_diagram`.
- **Recovery:** a prompt that triggers one invalid op → expect the agent to read `errors[]` and resend **only** the failed op (not the whole batch).

Golden Models use [ADR 0045 §4](0045-agent-control-contract.md)'s determinism so a structural diff is stable across runs. The suite is versioned with the op vocabulary — a contract change that adds/removes a verb updates the suite in the same commit (the lockstep guard from [ADR 0045](0045-agent-control-contract.md)).

### 3. Three drivers, layered (owner-selected 2026-07-21)

- **MEASURE — scripted API-key client (metric of record).** A headless MCP client driven by a real model behind an **API key** (Vercel AI SDK / Claude API) replays the task suite, counts tool calls, captures each call's args/response size, and structurally diffs the final Model against the golden. Deterministic enough to be the number we quote and optimize against. Costs API tokens per run (this is a *dev/CI* cost, unrelated to how end users pay — they use their own subscription per [ADR 0046](0046-mcp-session-bridge-topology.md)).
- **GATE — golden-transcript replay (free CI regression gate).** Recorded tool-call transcripts from known-good runs are replayed against the live verb layer with **no model in the loop**; CI asserts the tool-call sequence still produces the golden Model and the round-trip count hasn't regressed. Zero token cost → runs on every PR. It measures the *contract + layout + skill wiring*, not the model's choices — which is exactly what a regression gate should pin.
- **REALISM — live agent (periodic).** A real connector driven Claude-for-Chrome-style (the [ADR 0028](0028-ux-journey-testing-protocol.md) method) against a preview deploy, run before a release or after a contract change. Most realistic, least deterministic → **signal, not proof**; every surprising result is verified against the scripted harness before it becomes a task.

### 4. Zero-cost-when-off and where it lives

Following [ADR 0007 §1](0007-trace-harness.md): the harness is **inert unless invoked**. The scripted client and live driver are dev/CI tooling (not bundled); the golden-replay gate is a test suite. Home: a new `packages/axoview-agent-eval/` (or a `__agent_eval__/` suite in lib, mirroring `__perf_refactor_regression__/`) — the tactical decides. No agent-eval code ships in the app or worker bundle.

### 5. The optimization loop (why this ADR is load-bearing, not decorative)

The harness **is** how the contract and skill get tuned:

1. Run the scripted MEASURE pass → get round-trips + correctness per task.
2. A task that takes more round-trips than its budget, or fails correctness, is a **contract or skill defect** — fix the op vocabulary, the layout engine, or the modeling skill ([ADR 0045](0045-agent-control-contract.md)).
3. Re-run; lock the improved transcript as the new golden GATE baseline.
4. CI fails any PR that regresses a task's round-trip count or correctness.

Skill effectiveness (axis 3) is run as an A/B: the same suite with the modeling skill loaded and omitted; the delta justifies (or trims) the skill's content.

### 6. Verification gate (against agentic noise)

Inheriting [ADR 0028 §5](0028-ux-journey-testing-protocol.md): a **live-driver (REALISM)** finding is not a defect until reproduced by the **scripted (MEASURE)** harness or traced to a `file:line` in the verb layer / skill. Live agents manufacture false problems (wrong tool picked because of an unrelated prompt artifact); the scripted harness is the arbiter. An unverified live finding does not get a fix task.

## Consequences

**Positive:**
- "The contract is efficient" becomes a CI-enforced number, not a demo impression. Round-trip regressions fail the build.
- The free golden-replay gate runs on every PR without burning tokens; the paid scripted pass runs on demand for real-model truth; live runs add periodic realism. Cost scales with confidence needed.
- Skill effectiveness is an A/B delta — the modeling skill earns its content or loses it.
- Mirrors the existing 0007/0020/0028 harness family, so the cadence and the deferred-skill path are familiar.

**Negative / risks:**
- **Golden Models are maintenance.** A deliberate contract change invalidates goldens; regenerating them is real work and, done carelessly, can rubber-stamp a regression. The lockstep-with-the-op-vocabulary rule mitigates but doesn't eliminate this.
- **Structural-diff tolerance is a judgment call** — too strict and layout jitter fails good runs; too loose and it misses real errors. The placement-equivalence class ([ADR 0045 §4](0045-agent-control-contract.md) determinism) is what makes a tight-but-fair diff possible; getting that class right is non-trivial.
- **Scripted-driver token cost** discourages frequent full runs — mitigated by the free GATE for per-PR coverage, but the richest signal (MEASURE) is not free.
- **Live-driver variance** is inherent (the [ADR 0028](0028-ux-journey-testing-protocol.md) lesson); the verification gate is the only defense.

## Implementation notes (non-binding)

- Scripted client: Vercel AI SDK against a local/preview `/mcp` endpoint ([ADR 0046](0046-mcp-session-bridge-topology.md)) or directly against the in-tab verb layer for the no-transport case; log a per-task record `{prompt, tool_calls[], response_bytes[], final_model, golden, verdict}`.
- Structural diff: normalize both Models (sort by id, drop layout coords into an equivalence bucket, compare topology + labels + styles) — reuse the `exportAsJSON` / `stripDefaultIcons` normalization from [leanSave.ts](../../packages/axoview-lib/src/utils/leanSave.ts).
- Golden-replay: store transcripts as JSON fixtures; the gate feeds each recorded tool call through the live verb layer and asserts the accumulated Model.
- CI: the free GATE runs in the existing test workflow; the MEASURE pass is a manual/scheduled job (needs an API key secret).

## Acceptance criteria

- **Process:** a run of the scripted MEASURE pass produces a per-task record with round-trip count, response sizes, and a `PASS/FAIL` correctness verdict against each golden.
- **Gate:** the golden-replay GATE runs in CI with no model in the loop and fails on a round-trip-count regression or a correctness diff.
- **Skill A/B:** the suite runs with the modeling skill loaded and omitted, reporting the round-trip / success delta.
- **Verification:** a live-driver (REALISM) finding is admitted only after the scripted harness reproduces it or it's traced to `file:line`.
- **Zero-cost:** no agent-eval code appears in the app or worker production bundle.

## See also

- [ADR 0045](0045-agent-control-contract.md) — the contract whose efficiency this harness measures and tunes (esp. §2 invariants and §4 determinism).
- [ADR 0046 §6](0046-mcp-session-bridge-topology.md) — the free-tier round-trip envelope this harness protects.
- [ADR 0007](0007-trace-harness.md), [ADR 0020](0020-engine-perf-harness-and-measurement-protocol.md), [ADR 0028](0028-ux-journey-testing-protocol.md) — the harness family this one joins; `/agent-eval` is a deferred-skill candidate sibling to `/trace` and `/ux-journey-test`.
