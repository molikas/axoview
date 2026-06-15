# Collision-drag profile — N=1000

_Generated 2026-06-15T19:14:31.149Z · one 80-step collision-drag, post-warmup. Timeline self-time (renderer main) + JS self-time by function._

## Timeline (scripting / style / layout / paint)

| self-time (ms) | event |
|---|---|
| 977.3 | FunctionCall |
| 495.8 | CpuProfiler::StartProfiling |
| 215.5 | LocalFrameView::performLayout |
| 175.0 | Document::updateStyle |
| 134.5 | Document::recalcStyle |
| 82.6 | Layout |
| 62.9 | PaintArtifactCompositor::Update |
| 36.8 | V8.GC_MC_MARK_WEAK_CLOSURE_EPHEMERON_MARKING |
| 34.2 | V8.GC_MC_INCREMENTAL |
| 34.0 | RunTask |
| 33.3 | V8.GC_SCAVENGER_SCAVENGE_PARALLEL |
| 29.3 | LocalFrameView::NotifyResizeObservers |
| 23.5 | Paint |
| 22.5 | HitTest |
| 20.7 | ResourceFetcher::requestResource |
| 18.1 | V8.GC_MC_MARK_EMBEDDER_TRACING |
| 15.9 | V8.HandleInterrupts |
| 15.4 | Blink.PrePaint.UpdateTime |

Total accounted: **2586 ms** over 80 frames.

## JS self-time by function

| self-time (ms) | function |
|---|---|
| 1047.2 | (idle) |
| 859.1 | (program) |
| 327.8 | getNativeRange @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:432130 |
| 286.4 | setAttribute |
| 160.7 | (garbage collector) |
| 56.8 | (anonymous) @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:298069 |
| 52.4 | getBoundingClientRect |
| 52.1 | handleStoreChange @ lib-react.js:16131 |
| 34.2 | (anonymous) @ index.js:17050 |
| 30.9 | (anonymous) @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:2253 |
| 29.2 | shallow @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:388189 |
| 28.3 | jsxDEV @ lib-react.js:32550 |
| 24.5 | (anonymous) @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:388134 |
| 23.2 | murmur2 @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:624 |
| 21.5 | ReactElement @ lib-react.js:33727 |
| 20.7 | now |
| 15.7 | parseFromString |
| 14.7 | commitMount @ lib-react.js:11019 |
| 13.6 | setValueForStyles @ lib-react.js:2806 |
| 12.3 | validateProperty$1 @ lib-react.js:3661 |
| 11.0 | createStringFromObject @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:1837 |
| 10.8 | computeNodeUpdates @ index.js:19164 |
| 10.3 | jsxWithValidation @ lib-react.js:32875 |
| 9.0 | removeChild |
| 8.7 | styleFunctionSx @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:364672 |
| 8.5 | entries @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:388206 |
| 7.6 | validatePropertiesInDevelopment @ lib-react.js:9540 |
| 7.4 | createElement @ lib-react.js:33785 |
| 7.2 | warnUnknownProperties @ lib-react.js:3800 |
| 6.1 | reconcileChildrenArray @ lib-react.js:13546 |
