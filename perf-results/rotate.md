# View-rotation motion — measureRotate (ADR 0049 §6)

_Generated 2026-10-03 (1k/5k: 3 kept runs/cell, 3 warm-up; 20k at 22:26Z: 2 kept runs, 1 warm-up — run separately to fit the 30-min test cap), cal 3.4 ms. A 13-step eased 15° turn + a sustained ±45° sine, each followed by a settle. Gate: zero rebuilds in motion, build delta == settle count. p95 target ≤ 16.7 ms on the reference GPU (owner to confirm the thresholds)._

| N | draw-count range | builds / settles | mean frame (ms) | p95 frame (ms) | longest (ms) | noise (CoV mean) |
|---|---|---|---|---|---|---|
| 1000 | 1000..1000/1000 | 2/2 | 17.38 | 16.74 | 66.8 | 0.6% |
| 5000 | 5000..5000/5000 | 2/2 | 16.67 | 16.7 | 16.8 | 0% |
| 20000 | 20000..20000/20000 | 2/2 | 16.76 | 16.8 | 25.05 | 0.7% |
