# ADR 0033 — Element Text-Style (Bold / Italic / Strikethrough) Field Convention

**Status:** Accepted
**Date:** 2026-06-29
**Supersedes:** none (relates to [ADR 0030](0030-docked-style-controls-strip.md) — the strip is the single writer of these fields)
**Superseded by:** none

## Context

The styling overhaul made **bold / italic / strikethrough (B/I/S)** settable on every label-like surface, stored as **four divergent field shapes** for one concept:

| Surface | Fields | File |
|---|---|---|
| Node label | `labelBold` / `labelItalic` / `labelStrikethrough` | [`views.ts:17–19`](../../packages/axoview-lib/src/schemas/views.ts) |
| Connector name label | `nameLabelBold` / `nameLabelItalic` / `nameLabelStrikethrough` | [`connector.ts`](../../packages/axoview-lib/src/schemas/connector.ts) |
| Connector additional label | `labels[].bold` / `labels[].italic` / `labels[].strikethrough` | [`connector.ts`](../../packages/axoview-lib/src/schemas/connector.ts) |
| Text box / label | `isBold` / `isItalic` / `isStrikethrough` | [`textBox.ts`](../../packages/axoview-lib/src/schemas/textBox.ts) |

All four are `.optional()` with `Required<Omit<…>>` compile-time defaults, so the divergence is **safe — not a correctness defect**. But "four names for one concept" is a parity/maintainability question, and the *decision* (normalize vs accept) is time-boxed by the zero-migration window (it closes at first ship), even though the *implementation* of unifying is optional.

## Decision

**Accept the four flat conventions as intentional.** Do **not** normalize to a shared `textStyle{bold,italic,strikethrough}` mixin.

Rationale: unification would touch every reader (the strip, `Node`, `NodesCanvas`, `ConnectorLabel`, `useTextBoxProps`) for **zero correctness gain** — an L-sized refactor traded against an S-sized decision-of-record. The `Required<Omit<>>` guards already make the divergence safe. New label-like surfaces follow the **nearest sibling's** convention (a node-ish label uses `label*`; a textbox-ish element uses `is*`).

*(This ADR is deliberately small and may be folded into [ADR 0030](0030-docked-style-controls-strip.md) if the project prefers fewer files. Kept separate here so the "we considered unifying and chose not to" reasoning is discoverable.)*

**2026-07-03 ([ADR 0034](0034-inline-canvas-text-editing-and-dual-scope-strip-formatting.md)):** the **text-box row is retired as a strip write target** — text-box B/I/U/S is now written into the content HTML itself (per-character or whole-range), and the element-level `isBold/isItalic/isUnderline` flags are folded into `content` once at load, no longer rendered, and no longer persisted at creation (they stay schema-parseable for round-trip). The **connector name-label row (`nameLabel*`) is dead** — nothing renders or writes it since the ADR 0032 decouple; it survives only as legacy-parse fields for the one-time seed. The table's remaining live conventions (node `label*`, floating Label `is*`, connector `labels[].*`) are unchanged, and the nearest-sibling rule stands — exercised the same day by ADR 0034 O1, which grew each trio to a quad with **underline** (`labelUnderline` / `isUnderline` / `labels[].underline`).

## Consequences

**Positive:** no churn, back-compat-neutral, the decision is on record before the migration window closes.

**Negative / risks:** four field names for one concept persist as mild cognitive friction; a future contributor may re-propose unification — this ADR is the answer ("considered, declined, here's why").

## Acceptance criteria

- The B/I/S field convention is a decision of record before the integration→master merge.
- No code change is required by this decision (accept path). If the project later overrides toward unification, that is a new ADR with the schema reshape done while still unpushed.
