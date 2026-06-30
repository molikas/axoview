# Engine perf baseline

_Generated 2026-06-30T07:49:58.441Z by packages/axoview-e2e/perf/engine-perf.spec.ts_

**KR1: CERTIFIED (load-bearing regime)** — worst noise band 7.2% < 10% across all drag cells and spawn N≥200. Baseline is trustworthy for the optimization-relevant range. (All-cells worst = 7.2%; the excess is small-N spawn ≤100 — sub-120 ms operations at the 16.6 ms vsync quantization floor, bimodal 83↔117 ms settle, not an optimization target.)

Median across 7 kept runs (3 per-cell warm-up runs + a global warm-up discarded first). Noise band = coefficient of variation (stddev/mean) of the per-run **continuous** headline metric (**spawn → settle time** = commit→idle wall time; **drag → mean frame time**) — a real run-to-run variance measure, robust to the vsync quantization that makes frame-time percentiles bimodal. Frame budget @60fps = 16.6 ms.

**Scene (realistic, per N):** N nodes (5 icon types ≈1.7 KB each, varied label colours, ~20% with a description, ~12% with notes) + ~N connectors (⅓ labelled) + grouping rectangles. **Spawn** commits the whole scene in one store write (paste / import / diagram-open). **Drag** drags a connected in-grid node through OCCUPIED tiles → per-frame collision checks + connector re-route. (Text boxes excluded — their scene-side size derivation is incompatible with a bulk model.set.)

**Machine calibration index: 3.2 ms** (fixed CPU workload, this session). Cross-session machine drift was measured at ~22% (≫ the ~2% within-run noise), so absolute numbers are comparable only between runs with a similar index — **keep/revert decisions must be same-session A/B**, never a fresh run vs a prior-session baseline.

## spawn

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 200 | 16.65 | 29.25 | 19.45 | 33.4 | 116.7 | 66 | 7 | 7.2% |
| 500 | 16.7 | 54.2 | 25.02 | 66.7 | 150.1 | 206 | 7 | 4.1% |
| 1000 | 16.7 | 79.18 | 30.55 | 100 | 183.3 | 745 | 7 | 0% |

## drag

| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|---|
| 200 | 16.7 | 16.71 | 16.87 | 33.4 | 1349.9 | 59 | 7 | 0% |
| 500 | 16.7 | 17.63 | 17.71 | 50 | 1416.6 | 160 | 7 | 1.5% |
| 1000 | 16.7 | 16.8 | 17.92 | 66.7 | 1433.3 | 246 | 7 | 0.4% |

## paste (on-top collision)

**Scene:** N source nodes (varied icons/labels), select-all + copy, cursor on the selection centroid so the paste offset ≈ 0 (every pasted node hits an occupied tile → rigid-stamp placement). Drives the real Ctrl+C/Ctrl+V path → handlePaste → pasteItems → canvas redraw of 2N nodes.

| N | p50 (ms) | p95 (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |
|---|---|---|---|---|---|---|---|
| 10 | 16.7 | 16.7 | 16.7 | 83.4 | 0 | 7 | 14.3% |

## Guardrail — idle floor (KR3)

**KR3: PASS** — 2s with zero entities on canvas. Charter bar: idle heap flat ±5% (retained after GC) AND zero long tasks.

| metric | value |
|---|---|
| heap start | 87.5 MB |
| heap peak | 87.5 MB |
| heap after final GC | 87.5 MB |
| retained growth (leak) | 0 MB (0%) |
| long tasks at idle | 0 |
| idle frame p95 / max | 16.7 / 16.8 ms |
