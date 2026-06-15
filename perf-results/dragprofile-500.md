# Collision-drag profile — N=500

_Generated 2026-06-15T19:13:09.563Z · one 80-step collision-drag, post-warmup. Timeline self-time (renderer main) + JS self-time by function._

## Timeline (scripting / style / layout / paint)

| self-time (ms) | event |
|---|---|
| 2429.3 | FunctionCall |
| 514.4 | CpuProfiler::StartProfiling |
| 297.1 | V8.GC_SCAVENGER_SCAVENGE_PARALLEL |
| 84.3 | Document::recalcStyle |
| 64.8 | LocalFrameView::performLayout |
| 46.8 | V8.GC_MC_MARK_WEAK_CLOSURE_EPHEMERON_MARKING |
| 43.7 | Document::updateStyle |
| 35.6 | PaintArtifactCompositor::Update |
| 32.5 | RunTask |
| 22.7 | Layout |
| 19.3 | LocalFrameView::NotifyResizeObservers |
| 18.7 | V8.GC_MC_MARK_EMBEDDER_TRACING |
| 14.9 | WebFrameWidgetImpl::UpdateLifecycle |
| 14.6 | V8.GC_SCAVENGER_FREE_REMEMBERED_SET |
| 14.1 | V8.HandleInterrupts |
| 13.2 | HitTest |
| 13.0 | V8.GC_SCAVENGER_SCAVENGE_COLLECT_OLD_TO_NEW_PAGES |
| 12.6 | V8.GC_MC_INCREMENTAL |

Total accounted: **3888 ms** over 80 frames.

## JS self-time by function

| self-time (ms) | function |
|---|---|
| 735.5 | (program) |
| 663.8 | (anonymous) @ index.js:17050 |
| 493.6 | (garbage collector) |
| 226.7 | (idle) |
| 104.5 | useMemo @ lib-react.js:17062 |
| 98.1 | getNativeRange @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:432130 |
| 94.1 | setAttribute |
| 77.5 | jsxDEV @ lib-react.js:32550 |
| 74.7 | (anonymous) @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:298069 |
| 73.2 | useCallback @ lib-react.js:17032 |
| 65.0 | (anonymous) @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:2253 |
| 62.4 | shallow @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:388189 |
| 55.0 | now |
| 48.8 | murmur2 @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:624 |
| 47.8 | getBoundingClientRect |
| 44.4 | commitHookEffectListUnmount @ lib-react.js:23107 |
| 39.0 | handleStoreChange @ lib-react.js:16131 |
| 32.7 | updateEffectImpl @ lib-react.js:16249 |
| 27.7 | useColor @ index.js:22879 |
| 23.5 | ReactElement @ lib-react.js:33727 |
| 22.6 | getThemeValue @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:364626 |
| 22.2 | useSceneActions @ index.js:17603 |
| 20.8 | styleFunctionSx @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:364672 |
| 20.4 | (anonymous) @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:388134 |
| 18.2 | createStringFromObject @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:1837 |
| 17.5 | updateSimpleMemoComponent @ lib-react.js:19369 |
| 17.4 | handleInterpolation @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:1736 |
| 16.7 | createElement @ lib-react.js:33785 |
| 16.5 | entries @ vendors-node_modules_isoflow_isopacks_dist_isoflow_js-node_modules_isoflow_isopacks_dist_util-9ad4fc.js:388206 |
| 15.5 | forceStoreRerender @ lib-react.js:16156 |
