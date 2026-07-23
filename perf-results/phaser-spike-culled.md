# Phaser 4 Gate-A spike — same-session A/B vs the WebGL substrate

_Generated 2026-07-19T10:27:04.405Z · 5 kept runs/cell (1 warm-up), median-of-5, ADR 0020 §2 protocol._

**Machine calibration (ms):** cool-boot 3.4 · warm-ref 3.2 · WebGL-end 3.1 · Phaser 3.2 — warm drift 3.2% (matched ✓)
**GPU:** WebGL `see [perf] WebGL renderer line` · Phaser `ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU (0x00002860) Direct3D11 vs_5_0 ps_5_0, D3D11)`
**CSP violations (spike):** 0 · **regime:** culled@zoom1 · **cull:** ON · **layers:** nodes+labels+conn

**Scene composition** — WebGL (reference, `buildScene`): N nodes + ~N connectors + grouping rects + node-name labels. Phaser (spike): N Blitter bobs + N/2 chunked-Graphics connectors (solid/dashed/dotted) + N counter-scaled label Images. The reference carries *more* connectors, so a Phaser win is conservative.

**Headline:** spawn → settle (ms, commit→idle); pan/zoom → p95 frame time (ms). Within-band = Phaser ≤ WebGL × (1 + max(CoV, 10%)). Frame budget @60fps = 16.6 ms.

| scenario | N | WebGL | Phaser | Δ | CoV w/p | within band | note |
|---|---|---|---|---|---|---|---|
| pan | 20000 | — | 150.1 | — | — / 3.4% | 🔴<20fps | draw 242 lt 11103ms |
| zoom | 20000 | — | 150 | — | — / 1.2% | 🔴<20fps | draw 287 lt 10191ms |
| pan | 50000 | — | 383.4 | — | — / 1.5% | 🔴<20fps | draw 242 lt 28575ms |
| zoom | 50000 | — | 383.4 | — | — / 2.8% | 🔴<20fps | draw 287 lt 27240ms |
| pan | 100000 | — | 733.3 | — | — / 2.9% | 🔴<20fps | draw 241 lt 55354ms |
| zoom | 100000 | — | 750.83 | — | — / 1.3% | 🔴<20fps | draw 288 lt 52757ms |

## Verdict: 🔴 NO-GO / ESCALATE

- Within noise band at N∈{} (spawn+pan+zoom): **PASS**
- Headroom ≥10k (pan+zoom p95 ≤ 25.05ms): **FAIL**
- Zero long-tasks at gate N (pan+zoom): **PASS**
- CSP clean (no unsafe-eval): **PASS**

_Escalation ladder on NO-GO (ADR 0044 §6 / tactical A5): (1) harder camera cull (`PERF_PHASER_CULL=1`); (2) connectors → mesh/geometry; (3) LOD-band-quantized label counter-scale. Re-measure one variable at a time._
