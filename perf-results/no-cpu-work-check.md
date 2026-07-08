# Verifying "no per-frame CPU work" during pan/zoom (reusable prompt)

The whole point of the WebGL instancing + GPU fold (nodes, labels, connectors,
rectangles) is that **navigating the canvas costs O(1) on the CPU** — one uniform
write + one instanced draw call per layer, no per-element JavaScript. This doc is
the prompt + the automated check to prove that invariant holds (and catch a
regression that quietly reintroduces per-frame CPU work).

## The invariant

Each GPU layer splits work into two phases:
- **`buildInstances`** — the ONLY O(N) CPU work (project tiles, rasterise chips,
  pack the atlas, fill the instance buffer). Runs **only on a scene change**
  (nodes/connectors/rects/labels/colours/theme/projection, or a label-LOD-band
  crossing).
- **`render`** — per frame: update the view uniform + `drawArraysInstanced`. O(1)
  on the CPU regardless of N.

So during a **pan or zoom** (the scene is unchanged), `buildInstances` must **not
run**. If it does, per-frame CPU work has leaked back into navigation.

## The automated check (in the harness)

Every GPU canvas publishes a monotonically-increasing **`data-build-count`**
(incremented once per `buildInstances`). The `measurePan` scenario captures the
summed build-count across all four GPU canvases before and after the 80-frame
pan and returns `buildDelta`. The `PERF_PAN` gate:

- **logs** `noCPU-rebuild=true|false` per N, and
- **asserts** `buildDelta === 0` for every repeat (fails the run otherwise).

A green `noCPU-rebuild=true` + `longtask≈0` is the machine-checkable proof that
the pan did zero per-frame CPU geometry work.

```
# On AC power (the harness blocks battery — see the power gate):
PERF_ALLTYPES=1 PERF_PAN=1000,2000,5000,10000 npm run perf
#   → each [pan] line must show  noCPU-rebuild=true  and  longtask ≈ 0ms
```

## The manual prompt (when investigating a suspected regression)

> Drive a sustained pan on a large all-types scene (nodes + connectors + ≥3
> labels/connector + rectangles + floating labels) and prove no per-frame CPU
> work:
> 1. **Harness:** run `PERF_ALLTYPES=1 PERF_PAN=… npm run perf`. Every `[pan]`
>    row must report `noCPU-rebuild=true` and `longtask ≈ 0ms`. A non-zero
>    `buildDelta` names a layer rebuilding geometry per frame — find what marked
>    it `geomDirty` (a store subscription firing on scroll/zoom, a prop identity
>    churning from the Renderer cull, a `theme`/`colors`/`visibleIds` ref changing
>    every frame) and stop it.
> 2. **CPU profile:** `PERF_DRAGPROFILE`-style timeline over one pan frame should
>    show ~0 scripting self-time — no `getTilePosition`, `rasterize*`, `putCanvas`,
>    `addSprite`, or `chroma(...)` on the per-frame path. Those belong only to
>    `buildInstances`.
> 3. **DevTools (real browser):** Performance panel, record a pan. The main thread
>    should be idle between frames; the only per-frame work is the GL draw
>    (compositor/GPU), not scripting. If you see scripting spikes correlated with
>    scroll, a layer is rebuilding.
> 4. **The tell:** on the real GPU, an O(1) pan holds a flat 16.7 ms (60 fps)
>    that is **independent of N**. If frame time scales with N, per-frame CPU (or
>    a DOM/SVG layer still on the CSS-transform path) is the culprit — isolate
>    with `PERF_NOCONN` / per-layer toggles.

## What still does per-frame work (known, by design)

- The **sparse DOM hybrid** (selected node/connector, dragged node/rect, editing
  label) — 0–few elements, not O(N).
- **Connector labels** are still DOM (deferred fold) — at readable zoom they are
  viewport-culled to a bounded set; at fit-to-view they are the remaining
  per-frame DOM cost the on-power measurement will quantify.
