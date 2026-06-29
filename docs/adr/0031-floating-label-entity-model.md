# ADR 0031 — Floating Label as a First-Class Entity

**Status:** Proposed
**Date:** 2026-06-29
**Supersedes:** none (resolves the [ux-principles §5](../ux-principles.md) item-type-parity exemption taken by the spike's `variant:'label'` text box; relates to [ADR 0024](0024-node-label-positioning-and-sizing.md) node-label positioning, [ADR 0019](0019-canvas2d-node-render-layer.md) Canvas2D render substrate, [ADR 0020](0020-engine-perf-harness-and-measurement-protocol.md) perf harness)
**Superseded by:** none

## Context

The spike added a floating **Label** element as a **variant of TextBox** ([`schemas/textBox.ts:14`](../../packages/axoview-lib/src/schemas/textBox.ts) `variant: z.enum(['text','label'])`, plus optional `backgroundColor` / `zIndex` / `isStrikethrough`). A verification pass found the variant approach carries real, partly **intrinsic** debt:

- **Two deep forks** on `variant === 'label'`: a render-geometry fork (billboard chip vs iso-projection, [`TextBox.tsx`](../../packages/axoview-lib/src/components/SceneLayers/TextBoxes/TextBox.tsx) ~L60–235) and a hit-detection fork ([`hitDetection.ts:61,84–89`](../../packages/axoview-lib/src/utils/hitDetection.ts), anchor-tile-only vs footprint). Four further shallow branches.
- **z-order against nodes is impossible.** The `TextBoxes` SceneLayer is DOM-earlier than `NodesCanvas` at equal `zIndex:0`, so a label over a node is **always occluded**; the `zIndex` field is intra-layer only. This is architectural, not a bug a later patch can fix.
- **Anchor-tile-only hit-test:** a wide chip is only clickable on its single center tile.
- **Font model is a heuristic** (`iso fontSize × 24 → px`), not a first-class px size.
- **Double formatting:** a label exposes *both* per-character rich text *and* whole-chip B/I/S — the exact two-layer conflict the code deliberately excludes plain text boxes from.

The branch is **unpushed** — no saved diagram contains a `variant:'label'` element. The data-model reshape is therefore **free now and a permanent load-time migration after first ship.** The user has chosen the clean path ("implement it properly, not a POC").

## Decision

**Extract a dedicated first-class `Label` entity** (a peer of Node / Connector / TextBox / Rectangle per [§5](../ux-principles.md)), retiring the `variant:'label'` text-box. Done **before** the integration→master merge, while migration cost is zero.

1. **Dedicated schema + reducers.** A `Label` model entity with first-class fields (text, position, `backgroundColor`, `bold/italic/strikethrough`, font size in **px**, z-order). The `variant`/label fields are removed from `textBox.ts`; `TextBox` reverts to text-only.
2. **Own render layer, placed above the node layer.** Resolves cross-layer z-order — a Label can sit above nodes (and an explicit z-order field orders within the layer).
3. **Edit model: plain text + whole-chip B/I/S only.** No rich-text editor on labels — this dissolves the two-layer formatting conflict. (Rich text stays on plain TextBox, where per-character formatting is the point.)
4. **Full-chip hit-testing.** The entire chip is selectable, not just the anchor tile — via the proven `NodeLabelHitLayer` DOM hit-proxy pattern (or the Canvas2D path, per §6).
5. **Panel parity = Details / Notes** ([ADR 0030](0030-docked-style-controls-strip.md): no Style tab; styling via the docked strip).
6. **Render substrate is a performance decision, not an afterthought (binding).** Floating labels are billboard chips and a real diagram may carry **hundreds**. Rendering each as a DOM node reintroduces precisely the DOM-layer scaling cliff [ADR 0019](0019-canvas2d-node-render-layer.md) moved nodes *off of* (DOM doesn't cull or sub-linearly scale the way the Canvas2D layer does). The extracted Label layer **must be measured against the [ADR 0020](0020-engine-perf-harness-and-measurement-protocol.md) harness with a label-heavy scenario before merge.** If a DOM-chip layer regresses spawn/pan p95 beyond the noise band, render the Label layer on **Canvas2D** (billboard text, same substrate as node labels) with viewport culling — or virtualize the DOM layer. The substrate is chosen by measurement, and recorded here in an addendum once measured.
7. **Migration: none.** Because the branch is unpushed, the reshape lands with no load-time converter. This window does not reopen — if extraction does not happen before master, this ADR is void and the variant is ratified-with-debt instead.

## Consequences

**Positive:**
- §5 parity restored; the intrinsic limits (z-order, hit, font model, double-formatting) are fixed at the root, not patched forever.
- The render substrate is chosen on perf evidence — labels can't silently re-break the large-diagram budget.
- Zero migration; the data model is clean from first ship.

**Negative / risks:**
- One L-sized rebuild slice (schema + reducers + render layer + hit layer + clipboard/persistence). Keep it isolated so the schema diff is reviewable and the zero-migration claim is verifiable in one place.
- A second render layer above nodes adds compositing surface — mitigated by the §6 perf gate.

## Implementation notes (non-binding)

- Mirror the existing entity scaffolding (schema → reducer/scene actions → SceneLayer → hit layer → ItemControls panel → clipboard/persistence). The TextBox subsystem is the closest template; subtract the iso-projection + rich-text pieces.
- Reuse `NodeLabelHitLayer` as the hit-proxy template (§4).
- Keep the connector-label and node-label styling paths untouched — this ADR is only the *floating* Label.

## Acceptance criteria

- **Schema:** a `Label` parses/round-trips; `textBox.ts` no longer carries `variant`/label fields; no migration code exists (verified against the unpushed baseline).
- **Render/z-order:** a label placed over a node renders **above** it.
- **Hit-test:** the full chip width is selectable (not just the anchor tile); a connector passing under the chip is still selectable where the chip isn't.
- **Edit model:** a label cannot carry both rich text and whole-chip B/I/S (single model).
- **Performance (gates the merge):** a label-heavy scenario (≥200 floating labels) shows **no p95 regression beyond the ADR 0020 noise band (<10%)** vs the master baseline for spawn + pan; the chosen substrate is recorded in an addendum.
- **Coverage:** unit/e2e for placement, hit-branch, defaults, and the perf scenario.
