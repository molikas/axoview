# HTML/DOM-bloat stress — N=1000

_Generated 2026-06-20T16:10:16.546Z · 8 kept runs, cal 3.2 ms. Worst-case fully-loaded diagram: every node carries a rich/formatted description + notes + header link + link; isometric icons from 3 packs; every connector labelled; grouping rectangles; 8 layers. The node layer is Canvas2D (ADR 0019), so nodes emit no per-node DOM._

## Scene

nodes 1000 · connectors 968 (all labelled) · rectangles 49 · layers 8 · draw-count 1000/1000 (anti-cheat: canvas painted every node)

## Canvas spawn cost (rich content)

| metric | value |
|---|---|
| synchronous commit | 492.5 ms |
| settle | 166.65 ms |
| longest frame | 83.3 ms |

## DOM census (what still emits HTML at scale)

| element | count |
|---|---|
| total document elements | 11547 |
| renderer subtree elements | 10811 |
| <svg> | 1053 |
| connector paths | 968 |
| node label-hit divs (T6) | 0 |
| node DOM shells (hybrid overlay) | 49 |

## Heap per entity (guardrail < 5 KB/entity)

| metric | value |
|---|---|
| heap @ empty canvas | 87.5 MB |
| heap @ full scene | 87.5 MB |
| entities | 2017 |
| **bytes / entity** | **0 KB** |
