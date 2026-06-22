# Engine perf baseline

_Generated 2026-06-20T16:29:51.559Z by packages/axoview-e2e/perf/engine-perf.spec.ts_

**KR1: CERTIFIED (load-bearing regime)** — worst noise band 7.8% < 10% across all drag cells and spawn N≥200. Baseline is trustworthy for the optimization-relevant range. (All-cells worst = 17.7%; the excess is small-N spawn ≤100 — sub-120 ms operations at the 16.6 ms vsync quantization floor, bimodal 83↔117 ms settle, not an optimization target.)

Median across 12 kept runs (3 per-cell warm-up runs + a global warm-up discarded first). Noise band = coefficient of variation (stddev/mean) of the per-run **continuous** headline metric (**spawn → settle time** = commit→idle wall time; **drag → mean frame time**) — a real run-to-run variance measure, robust to the vsync quantization that makes frame-time percentiles bimodal. Frame budget @60fps = 16.6 ms.

**Scene (realistic, per N):** N nodes (5 icon types ≈1.7 KB each, varied label colours, ~20% with a description, ~12% with notes) + ~N connectors (⅓ labelled) + grouping rectangles. **Spawn** commits the whole scene in one store write (paste / import / diagram-open). **Drag** drags a connected in-grid node through OCCUPIED tiles → per-frame collision checks + connector re-route. (Text boxes excluded — their scene-side size derivation is incompatible with a bulk model.set.)

**Machine calibration index: 3.3 ms** (fixed CPU workload, this session). Cross-session machine drift was measured at ~22% (≫ the ~2% within-run noise), so absolute numbers are comparable only between runs with a similar index — **keep/revert decisions must be same-session A/B**, never a fresh run vs a prior-session baseline.

## spawn

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.7 | 16.66 | 16.7 | 83.3 | 0 | 12 | 0.1% |
| 50 | 16.7 | 16.7 | 16.66 | 16.7 | 83.3 | 0 | 12 | 0.1% |
| 100 | 16.7 | 16.74 | 16.68 | 16.75 | 83.4 | 0 | 12 | 17.7% |
| 200 | 16.7 | 35.41 | 20.83 | 41.65 | 125 | 63 | 12 | 6.9% |
| 500 | 16.7 | 54.2 | 25 | 66.7 | 150 | 263 | 12 | 7.8% |
| 1000 | 16.7 | 79.18 | 30.55 | 100 | 183.3 | 756 | 12 | 2.6% |

## drag

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 25 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 12 | 0.5% |
| 50 | 16.7 | 16.7 | 16.67 | 16.8 | 1333.3 | 0 | 12 | 0% |
| 100 | 16.7 | 16.8 | 16.67 | 16.8 | 1333.3 | 0 | 12 | 0% |
| 200 | 16.7 | 16.75 | 16.87 | 33.3 | 1349.9 | 56.5 | 12 | 0.6% |
| 500 | 33.3 | 33.41 | 28.96 | 50 | 2316.6 | 188.5 | 12 | 1.1% |
| 1000 | 83.3 | 83.4 | 71.46 | 100 | 5716.55 | 5796 | 12 | 1% |

## paste (on-top collision)

**Scene:** N source nodes (varied icons/labels), select-all + copy, cursor on the selection centroid so the paste offset ≈ 0 (every pasted node hits an occupied tile → rigid-stamp placement). Drives the real Ctrl+C/Ctrl+V path → handlePaste → pasteItems → canvas redraw of 2N nodes.

| N | p50 (ms) | p95 (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|
| 10 | 16.7 | 16.7 | 16.7 | 83.3 | 0 | 12 | 0.1% |
| 50 | 16.7 | 16.7 | 16.7 | 83.3 | 0 | 12 | 0.1% |
| 100 | 16.7 | 16.7 | 16.7 | 83.3 | 0 | 12 | 0.1% |
| 150 | 16.7 | 29.19 | 33.35 | 116.7 | 0 | 12 | 11.7% |

## Guardrail — idle floor (KR3)

**KR3: PASS** — 60s with zero entities on canvas. Charter bar: idle heap flat ±5% (retained after GC) AND zero long tasks.

| metric | value |
|---|---|
| heap start | 77.6 MB |
| heap peak | 77.6 MB |
| heap after final GC | 77.6 MB |
| retained growth (leak) | 0 MB (0%) |
| long tasks at idle | 0 |
| idle frame p95 / max | 16.7 / 33.4 ms |
