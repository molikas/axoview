# E-slice perf gate — labels/text-styling productization (integration vs master)

_Generated 2026-06-30 · median-of-7 kept runs/cell (2–3 warm-up discarded), N ∈ {200, 500, 1000}, fixed 1440×900 / dsf 1, calibration index ≈3.2 ms. Protocol per [ADR 0020](../docs/adr/0020-engine-perf-harness-and-measurement-protocol.md); scenarios added to [`engine-perf.spec.ts`](../packages/axoview-e2e/perf/engine-perf.spec.ts) (slice E1). Master spawn reference: [`baseline.md`](baseline.md) (12 kept runs, generated 2026-06-20)._

This gates the integration→master merge: the new label / connector-label / floating-label / background-border styling surfaces (and a first pan floor) must show **no spawn p95 regression beyond the ADR 0020 <10% noise band** vs the master baseline (ADR 0031 §6 / decision 7).

## 1. Regression gate — base spawn (integration vs master)

The bare-node spawn path is the regression check: did the spike's label/style/border code slow bulk spawn?

| N | master p95 | integration p95 | Δ | verdict |
|---|---|---|---|---|
| 200 | 35.41 ms | 29.25 ms | −17% (faster) | within floor¹ |
| 500 | 54.20 ms | 54.20 ms | 0% | ✓ no change |
| 1000 | 79.18 ms | 79.18 ms | 0% | ✓ no change |

¹ Small-N spawn sits at the 16.6 ms vsync quantization floor (bimodal), excluded from ADR 0020 certification; the −17% is quantization noise, not a real speed-up. Integration noise band ≤7.2% (CoV), certified.

**Verdict: PASS.** Base spawn is unchanged at the load-bearing N (500/1000). The styling code added no bulk-spawn regression. (Integration drag/pan are *faster* than master `baseline.md` — that baseline predates the landed #55/#57 culling-decouple fixes; not part of this slice. See [`integration-spawn-drag.md`](integration-spawn-drag.md).)

## 2. New styling-surface stress floors (the spike's surfaces, measured)

Each adds its styling load on top of (or beside) the N-node base. p95 = frame-time p95 over the spawn settle window.

| Scenario (substrate) | N=200 p95 | N=500 p95 | N=1000 p95 | N=1000 settle | report |
|---|---|---|---|---|---|
| node labels B/I/S + colour + px (**Canvas2D**) | 29.22 | 54.20 | 79.99 | 200 ms | [label-heavy.md](label-heavy.md) |
| every connector labelled + styled (DOM) | 41.62 | 54.22 | 79.25 | 183 ms | [conn-label-heavy.md](conn-label-heavy.md) |
| dense rect fills + ≤30px borders (**Canvas2D**) | 29.17 | 54.20 | 79.18 | 183 ms | [bg-heavy.md](bg-heavy.md) |
| **N floating Label chips (DOM)** | **83.40** | 66.70 | **184.96** | **600 ms** | [floating-label-heavy.md](floating-label-heavy.md) |

All anti-cheats green (canvas draw-count == N; floating labels DOM count == N).

**Finding.** Canvas2D surfaces (node-label B/I/S, backgrounds/borders) ride free — N=1000 p95 ≈ the 79.18 ms bare baseline. Connector labels (already DOM) add little. The **DOM floating-label** layer is the outlier: **~2.3× the spawn p95, ~3× the settle** at N=1000 — the [ADR 0019](../docs/adr/0019-canvas2d-node-render-layer.md) DOM-layer scaling cliff. This is the evidence behind the **C1 Label substrate = Canvas2D** decision ([ADR 0031](../docs/adr/0031-floating-label-entity-model.md) addendum, E3).

### 2b. C1 validation — the Canvas2D Label layer, re-measured (2026-06-30)

The C1 extraction ([ADR 0031](../docs/adr/0031-floating-label-entity-model.md)) landed the floating Label as a first-class Canvas2D layer (`LabelsCanvas` — billboard chips above the node layer + a per-(text, fontSize, B/I) layout cache mirroring `NodesCanvas`). The `floating-label-heavy` scenario was rewired from the retired textBox `variant:'label'` DOM chips to the new Label entity and re-run (median-of-7, dedicated server):

| N | drawn / labels | commit | settle | p95 | noise (CoV) |
|---|---|---|---|---|---|
| 200 | 200/200 | 26.8 ms | 133 ms | 33.30 | 11.4%¹ |
| 500 | 500/500 | 118.2 ms | 167 ms | 66.65 | 5.0% |
| 1000 | 1000/1000 | 495.4 ms | 183 ms | **79.25** | 4.7% |

¹ Small-N sits at the vsync quantization floor (bimodal), excluded from certification — same as §1.

**Finding — the cliff is eliminated, the layer rides at baseline.** At N=1000 the Canvas2D Label layer is **79.25 ms p95 / 183 ms settle** — within the <10% band of the 79.18 ms / 183 ms bare-node baseline, and ≈ the node-label Canvas2D surface (79.99 ms). Versus the DOM-chip cliff (184.96 ms / 600 ms) that's **−57% p95 / −69% settle**. The per-frame `measureText` was the dominant cost; the layout cache (the same one that makes node labels free) drops the per-chip work to draw calls, so 1000 extra billboard chips add ≈0 spawn cost. Canvas2D draw-count anti-cheat green (labels=N/N at every N). **The E3 substrate decision is validated by the shipped C1 layer.**

## 3. Pan floor (first baseline — measurePan)

`measurePan` did not exist on master (ENG-PAN R1 unstarted), so this is the **first** pan baseline (KR-P3), not a regression comparison. Per-rAF `setScroll` oscillation; headline = p95 frame time during sustained pan. Draw-count stayed at N each frame (no cull); pan engaged on every run.

| N | mean frame | p95 frame | long-task total | noise (CoV) |
|---|---|---|---|---|
| 200 | 26.25 ms | 33.40 ms | 0 ms | 0.9% |
| 500 | 49.79 ms | 66.60 ms | 407 ms | 2.4% |
| 1000 | 80.62 ms | 83.40 ms | 6314 ms | 2.8% |

Full report: [pan.md](pan.md). This is the floor ENG-PAN R1's dirty-region/scroll-blit fix must beat (the #54 synchronous `drawNow()` repaint floor — see [pan-r1-design.md](pan-r1-design.md)).

## 4. Gate verdict

- **Spawn regression gate: PASS** — base spawn unchanged at N≥500; noise ≤7.2% < 10%.
- **New surfaces measured & committed** — Canvas2D surfaces free; DOM floating labels regress (→ C1 substrate = Canvas2D, ADR 0031 addendum).
- **Pan floor recorded** — first measurePan baseline; hand-off to ENG-PAN R1.

Merge-blocking perf risk from this slice: **none** on the shipped surfaces. The floating-label cliff is pre-empted by the C1 substrate decision (it lands on Canvas2D, never as a DOM chip layer).
