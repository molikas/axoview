# Floating-label-heavy spawn — N Canvas2D Label chips (B/I/S + colour + background)

_Generated 2026-06-30T10:39:54.657Z · 7 kept runs/cell (2 warm-up), cal 3.1 ms. N floating Labels (the first-class Label entity, ADR 0031) over the realistic node/connector/rect base. Labels render on the Canvas2D LabelsCanvas — the substrate ADR 0031 E3 chose after the DOM chip layer ~2.3×'d spawn p95 — so this re-measures the floating-label spawn cost on the new substrate. labels=N/N anti-cheats every chip drew._

| N | drawn | commit (ms) | settle (ms) | p95 frame (ms) | longest (ms) | noise (CoV settle) |
|---|---|---|---|---|---|---|
| 200 | 200/200 labels=200/200 | 26.8 | 133.3 | 33.3 | 33.4 | 11.4% |
| 500 | 500/500 labels=500/500 | 118.2 | 166.7 | 66.65 | 83.3 | 5% |
| 1000 | 1000/1000 labels=1000/1000 | 495.4 | 183.4 | 79.25 | 100.1 | 4.7% |
