# Sustained-pan repaint floor — measurePan

_Generated 2026-06-30T07:55:27.496Z · 7 kept runs/cell (2 warm-up), cal 3.2 ms. Per-rAF setScroll oscillation; headline = p95 frame time during sustained pan (the #54 synchronous drawNow repaint floor — pan-r1-design.md). This is the FIRST pan baseline: measurePan did not exist on master, so there is no prior column to regress against — it records the floor ENG-PAN R1 must beat (KR-P3)._

| N | draw-count range | mean frame (ms) | p95 frame (ms) | longest (ms) | long-task total (ms) | noise (CoV mean) |
|---|---|---|---|---|---|---|
| 200 | 200..200/200 | 26.25 | 33.4 | 50 | 0 | 0.9% |
| 500 | 500..500/500 | 49.79 | 66.6 | 83.3 | 407 | 2.4% |
| 1000 | 1000..1000/1000 | 80.62 | 83.4 | 100 | 6314 | 2.8% |
