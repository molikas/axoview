# Background/border-heavy spawn — dense grouping rects with fills + ≤30px borders

_Generated 2026-06-30T07:52:00.484Z · 7 kept runs/cell (2 warm-up), cal 3.3 ms. Grouping rectangles at double density (BLOCK=2) each with a fill + a styled ≤30px border (varied width/colour/style) → heavy fill+stroke overdraw. Gates the rectangle background/border surface against the spawn baseline._

| N | drawn | commit (ms) | settle (ms) | p95 frame (ms) | longest (ms) | noise (CoV settle) |
|---|---|---|---|---|---|---|
| 200 | 200/200 | 25.4 | 116.7 | 29.17 | 33.3 | 5.3% |
| 500 | 500/500 | 117.9 | 150.1 | 54.2 | 66.7 | 8.2% |
| 1000 | 1000/1000 | 534.1 | 183.3 | 79.18 | 100 | 9.8% |
