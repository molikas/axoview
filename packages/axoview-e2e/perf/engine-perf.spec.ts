/**
 * engine-perf.spec.ts — the committed one-command perf harness (KR1/KR2).
 *
 * Drives the REAL app in REAL Chromium and reports p50/p95 frame time for two
 * scenarios, parameterised by entity count N:
 *   (a) bulk-spawn/render — commit N nodes in one store write (models paste/
 *       import) and measure the frames it takes to reconcile + paint.
 *   (b) drag — drag one node through an empty tile lane while N-1 others are
 *       rendered, measuring per-frame re-render cost.
 *
 * Methodology (charter PHASE 0):
 *   - All input + frame capture runs IN-PAGE (one page.evaluate per run) so the
 *     Node↔CDP roundtrip never sits between an input event and the frame it
 *     produces. A drag is an rAF-paced pointermove stream; frame time = the
 *     delta between successive requestAnimationFrame callbacks under load.
 *   - Frame timing via rAF deltas; long tasks via PerformanceObserver('longtask').
 *   - Median-of-≥7: REPEATS runs per (scenario,N); the first is a discarded
 *     warm-up. Reported number = median across the kept runs.
 *   - Noise band = run-to-run spread of the headline metric, (max−min)/median.
 *     Headline = p95 for drag, longest-frame (max) for spawn (a paste freeze is
 *     ONE giant frame, which a p95 over a settle window would hide).
 *
 * Anti-cheat (charter Guardrails): the dragged node traverses EMPTY tiles so
 * the collision path is never short-circuited, and no work the real app does is
 * removed. There is no viewport culling today (a T2 unlock), so all N nodes
 * cost render whether or not they are on-screen.
 *
 * Output: perf-results/baseline.md (human table) + perf-results/raw/*.json
 * (every run's frame array, for later trace analysis). One command:
 *   npm run perf
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// N set and repeats are env-tunable for fast smoke validation; defaults are the
// charter's committed baseline grid (KR2) and median-of-≥7.
const N_SET = process.env.PERF_N
  ? process.env.PERF_N.split(',').map((s) => parseInt(s.trim(), 10))
  : [25, 50, 100, 200, 500, 1000];
const REPEATS = process.env.PERF_REPEATS
  ? parseInt(process.env.PERF_REPEATS, 10)
  : 8; // first discarded as warm-up → 7 kept (charter: median-of-≥7)
// Paste-on-top scenario node counts (the reported freeze: select N → copy →
// paste directly on top). The pre-fix per-item pasteItems loop was O(N^3) here.
const PASTE_N_SET = process.env.PERF_PASTE_N
  ? process.env.PERF_PASTE_N.split(',').map((s) => parseInt(s.trim(), 10))
  : [10, 50, 100, 150];
const SPAWN_CAP_MS = 6000; // hard cap if the spawn never settles (it should)
const DRAG_STEPS = 80; // rAF-paced pointermoves per drag run
// Per-cell warm-up runs, discarded before the kept REPEATS. V8 tiers up the
// shared render/drag hot path after ~hundreds of invocations; without enough
// warm-up the first runs sit in a slower regime and the noise band is bimodal.
const WARMUP_RUNS = process.env.PERF_WARMUP
  ? parseInt(process.env.PERF_WARMUP, 10)
  : 3;
// Idle-churn guardrail probe window (charter: "idle heap flat ±5% over 60s").
const IDLE_PROBE_MS = process.env.PERF_IDLE_MS
  ? parseInt(process.env.PERF_IDLE_MS, 10)
  : 60_000;

const RESULTS_DIR = path.resolve(__dirname, '../../../perf-results');
const RAW_DIR = path.join(RESULTS_DIR, 'raw');

// ---------------------------------------------------------------------------
// Stats helpers (Node side)
// ---------------------------------------------------------------------------
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return percentile(s, 50);
}
function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}
// Coefficient of variation (relative stddev) — the run-to-run variance measure
// KR1 asks for. Robust to vsync quantization in a way (max−min)/median is not.
function cov(xs: number[]): number {
  const m = mean(xs);
  return m > 0 ? stddev(xs) / m : 0;
}
function round(x: number, d = 2): number {
  const m = 10 ** d;
  return Math.round(x * m) / m;
}

interface RunResult {
  frames: number[];
  longTasks: Array<{ start: number; duration: number }>;
  commitMs?: number; // spawn only: synchronous store-write duration (sub-vsync)
  dragEngaged?: boolean; // drag only: the DRAG_ITEMS mode actually activated
  renderCounts?: Record<string, number>; // drag only, ?perfprobe=1: renders during the drag loop
  renderedNodes?: number; // spawn/paste: node shells (or canvas draw-count) after settle
  paintedConnectors?: number; // spawn only: connectors that painted (anti-cheat: == committed)
  sceneCounts?: {
    nodes: number;
    connectors: number;
    rectangles: number;
    textBoxes: number;
  }; // spawn only: the committed multi-element scene composition
  pastedCount?: number; // paste only: nodes added by the paste (anti-cheat: == N)
  totalNodes?: number; // paste only: total nodes after paste (== 2N)
}
interface RunMetrics {
  p50: number;
  p95: number;
  max: number;
  meanFrame: number;
  settle: number;
  count: number;
  longTaskTotal: number;
  longTaskMax: number;
}
function metricsOf(run: RunResult): RunMetrics {
  const sorted = [...run.frames].sort((a, b) => a - b);
  const ltDurs = run.longTasks.map((l) => l.duration);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    max: sorted.length ? sorted[sorted.length - 1] : NaN,
    meanFrame: mean(run.frames),
    settle: run.frames.reduce((a, b) => a + b, 0),
    count: sorted.length,
    longTaskTotal: ltDurs.reduce((a, b) => a + b, 0),
    longTaskMax: ltDurs.length ? Math.max(...ltDurs) : 0
  };
}

// ---------------------------------------------------------------------------
// CDP trace attribution — compute self-time by event name on the busiest
// (renderer main) thread, so a spawn freeze can be split across scripting /
// style / layout / paint without double-counting nested events.
// ---------------------------------------------------------------------------
interface TraceEvent {
  name: string;
  ph: string;
  ts: number;
  dur?: number;
  pid: number;
  tid: number;
}
function attributeTrace(events: TraceEvent[]) {
  // Pick the thread with the most total complete-event duration (renderer main).
  const byThread = new Map<string, TraceEvent[]>();
  for (const e of events) {
    if (e.ph !== 'X' || typeof e.dur !== 'number') continue;
    const k = `${e.pid}:${e.tid}`;
    (byThread.get(k) ?? byThread.set(k, []).get(k)!).push(e);
  }
  let best: TraceEvent[] = [];
  let bestDur = -1;
  for (const evs of byThread.values()) {
    const d = evs.reduce((a, b) => a + (b.dur ?? 0), 0);
    if (d > bestDur) {
      bestDur = d;
      best = evs;
    }
  }
  // Self-time via a stack over time-ordered complete events.
  best.sort((a, b) => a.ts - b.ts || (b.dur ?? 0) - (a.dur ?? 0));
  const selfByName = new Map<string, number>();
  const stack: Array<{ end: number; name: string }> = [];
  for (const e of best) {
    const start = e.ts;
    const end = e.ts + (e.dur ?? 0);
    while (stack.length && stack[stack.length - 1].end <= start) stack.pop();
    // Subtract this event's duration from its parent's self-time.
    if (stack.length) {
      const p = stack[stack.length - 1];
      selfByName.set(p.name, (selfByName.get(p.name) ?? 0) - (e.dur ?? 0));
    }
    selfByName.set(e.name, (selfByName.get(e.name) ?? 0) + (e.dur ?? 0));
    stack.push({ end, name: e.name });
  }
  const rows = [...selfByName.entries()]
    .map(([name, us]) => ({ name, ms: us / 1000 }))
    .filter((r) => r.ms > 0.5)
    .sort((a, b) => b.ms - a.ms);
  const total = rows.reduce((a, b) => a + b.ms, 0);
  return { rows, total };
}

// ---------------------------------------------------------------------------
// In-page harness. Installed once per page; attaches window.__perfH.
// Self-contained: references only window/document so Playwright can serialise it.
// ---------------------------------------------------------------------------
function installHarness() {
  const w = window as any;
  const ax = () => w.__axoview__;
  const raf = (): Promise<number> =>
    new Promise((r) => requestAnimationFrame((t) => r(t)));

  // Deterministic PRNG so every run builds the identical scene (run-to-run
  // comparability). NOT Math.random.
  function mulberry32(seed: number) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Representative icons. The real app embeds ~2 KB base64 SVGs per node; the old
  // trivial 100-byte <rect> under-measured per-node icon decode/markup cost
  // (bloat-analysis.txt). A small SET assigned round-robin: each repeats (a real
  // dedup opportunity) yet there is variety (the "every node can be stylized"
  // challenge). ~1.7 KB each.
  const ICON_PALETTE = [
    '%235b8def',
    '%23e0644b',
    '%233fae6b',
    '%23f2b134',
    '%238e6fd6',
    '%2300a3a3'
  ];
  function makeIconUrl(seed: number) {
    const rnd = mulberry32(seed * 7919 + 1);
    let body = "<rect width='64' height='64' rx='6' fill='%23f4f6fb'/>";
    for (let i = 0; i < 26; i++) {
      const x = (rnd() * 56 + 4).toFixed(1);
      const y = (rnd() * 56 + 4).toFixed(1);
      const c = ICON_PALETTE[(rnd() * ICON_PALETTE.length) | 0];
      if (rnd() < 0.5) {
        const r = (rnd() * 7 + 2).toFixed(1);
        body += `<circle cx='${x}' cy='${y}' r='${r}' fill='${c}'/>`;
      } else {
        const wd = (rnd() * 12 + 3).toFixed(1);
        const ht = (rnd() * 12 + 3).toFixed(1);
        body += `<rect x='${x}' y='${y}' width='${wd}' height='${ht}' rx='1.5' fill='${c}'/>`;
      }
    }
    return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${body}</svg>`;
  }
  const PERF_ICONS = Array.from({ length: 5 }, (_, i) => ({
    id: 'perf-icon-' + i,
    name: 'perf-' + i,
    url: makeIconUrl(i + 1),
    collection: 'imported',
    isIsometric: false
  }));
  // Global colour palette (connectors/rectangles reference by id).
  const PERF_COLORS = [
    { id: 'c1', value: '#a5b8f3' },
    { id: 'c2', value: '#bbadfb' },
    { id: 'c3', value: '#f4eb8e' },
    { id: 'c4', value: '#f0aca9' },
    { id: 'c5', value: '#fad6ac' },
    { id: 'c6', value: '#a8dc9d' },
    { id: 'c7', value: '#b3e5e3' }
  ];
  // Per-node label colours (raw hex; '' = theme default). Variety so the label
  // styling path is exercised non-uniformly.
  const LABEL_COLORS = ['', '#c0392b', '#1565c0', '#2e7d32', '#6a1b9a'];

  function activeView() {
    const ui = ax().ui.getState();
    const m = ax().model.getState();
    const view =
      (ui.view && m.views.find((v: any) => v.id === ui.view)) || m.views[0];
    return { view, m };
  }

  function viewsWith(
    viewId: string,
    vitems: any[],
    connectors?: any[],
    rectangles?: any[],
    textBoxes?: any[]
  ) {
    const m = ax().model.getState();
    return m.views.map((v: any) =>
      v.id === viewId
        ? {
            ...v,
            items: vitems,
            connectors: connectors || [],
            rectangles: rectangles || [],
            textBoxes: textBoxes || []
          }
        : v
    );
  }

  function resetState() {
    const { view } = activeView();
    ax().model.getState().actions.set(
      {
        items: [],
        icons: PERF_ICONS,
        colors: PERF_COLORS,
        views: viewsWith(view.id, [])
      },
      true
    );
    ax().model.getState().actions.clearHistory();
    // Deterministic viewport so frame cost is comparable run-to-run.
    const uiActions = ax().ui.getState().actions;
    try {
      uiActions.setZoom(0.65);
      uiActions.setScroll({ position: { x: 0, y: 0 }, offset: { x: 0, y: 0 } });
      uiActions.setMode({ type: 'CURSOR', showCursor: true, mousedownItem: null });
      uiActions.setItemControls(null);
    } catch {
      /* action shape drift — non-fatal for measurement */
    }
  }

  // Realistic scene of N nodes + ~N connectors + grouping rectangles, with
  // varied per-item stylisation (5 icons round-robin, palette colours, varied
  // label colours, ~20% with descriptions, ~12% with notes). `xBase` offsets the
  // grid origin. Deterministic so the scene is identical run-to-run. N is the
  // NODE count (the SSB/LEB regime); the other element counts scale with it. The
  // full scene is what the real app renders on a diagram open / paste /
  // view-switch. (Text boxes are excluded — see the note at the return.)
  const NODE_NAMES = [
    'Service',
    'Gateway',
    'Store',
    'Queue',
    'Cache',
    'Worker',
    'Router',
    'Index'
  ];
  function buildScene(N: number, xBase: number) {
    const side = Math.ceil(Math.sqrt(N));
    const noLabel = !!w.__perfNoLabel; // diagnostic: isolate label-subtree cost
    const noConn = !!w.__perfNoConn; // diagnostic: isolate connector-subtree cost (T2 prize sizing)
    const items: any[] = [];
    const vitems: any[] = [];
    const connectors: any[] = [];
    for (let i = 0; i < N; i++) {
      const id = 'perf-' + i;
      const col = i % side;
      const row = Math.floor(i / side);
      const item: any = {
        id,
        name: NODE_NAMES[i % NODE_NAMES.length] + ' ' + i,
        icon: PERF_ICONS[i % PERF_ICONS.length].id
      };
      if (i % 5 === 0) {
        item.description =
          '<p>' +
          NODE_NAMES[i % NODE_NAMES.length] +
          ' ' +
          i +
          ' handles a slice of the workload and forwards downstream.</p>';
      }
      if (i % 8 === 0) item.notes = 'note ' + i;
      items.push(item);
      const vi: any = {
        id,
        tile: { x: xBase + col, y: row },
        labelColor: LABEL_COLORS[i % LABEL_COLORS.length]
      };
      if (noLabel) vi.showLabel = false;
      vitems.push(vi);
      // Connector to the right neighbour (same row): ~N−side edges, ~⅓ labelled.
      if (!noConn && col < side - 1 && i + 1 < N) {
        const c: any = {
          id: 'c-' + i,
          color: PERF_COLORS[i % PERF_COLORS.length].id,
          width: 10,
          style: 'SOLID',
          anchors: [
            { id: 'a' + i + 's', ref: { item: id } },
            { id: 'a' + i + 'e', ref: { item: 'perf-' + (i + 1) } }
          ]
        };
        if (i % 3 === 0) {
          c.labels = [
            { id: 'cl' + i, text: 'edge ' + i, position: 50, fontSize: 12 }
          ];
        }
        connectors.push(c);
      }
    }
    // Grouping rectangles over ~5×5 blocks (varied colours).
    const rectangles: any[] = [];
    const BLOCK = 5;
    let k = 0;
    for (let by = 0; by < side; by += BLOCK) {
      for (let bx = 0; bx < side; bx += BLOCK) {
        rectangles.push({
          id: 'r-' + k,
          color: PERF_COLORS[k % PERF_COLORS.length].id,
          from: { x: xBase + bx, y: by },
          to: {
            x: xBase + Math.min(bx + BLOCK - 1, side - 1),
            y: Math.min(by + BLOCK - 1, side - 1)
          }
        });
        k++;
      }
    }
    // Text boxes are intentionally excluded: their `size` is derived scene-side
    // by the createTextBox reducer (getTextBoxDimensions), which a bulk
    // model.set bypasses → the renderer crashes on undefined `size.height`. They
    // are a tiny annotation element (negligible bulk-render weight); the
    // representative load is nodes + connectors + rectangles + labels.
    return { items, vitems, connectors, rectangles, textBoxes: [] };
  }

  // Fit the viewport (zoom + scroll) so the whole grid is on-screen, so the
  // engine's viewport cull (Renderer.visibleItems via computeTileBounds) renders
  // ALL N nodes — i.e. N = visible entity count, the regime SSB/LEB60 measure
  // and the one that reproduces the production collapse. Off-screen nodes are
  // culled and ~free, so a representative baseline must keep them visible.
  function fitForGrid(xBase: number, count: number) {
    const side = Math.ceil(Math.sqrt(count));
    const UN = 100;
    const halfW = (UN * 1.415) / 2;
    const halfH = (UN * 0.819) / 2; // ISO (default canvas mode)
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const x of [xBase, xBase + side - 1]) {
      for (const y of [0, side - 1]) {
        const cx = halfW * (x - y);
        const cy = -halfH * (x + y);
        minX = Math.min(minX, cx);
        maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy);
        maxY = Math.max(maxY, cy);
      }
    }
    const ui = ax().ui.getState();
    const W = ui.rendererSize.width;
    const H = ui.rendererSize.height;
    const pad = UN * 2; // room for node/label footprint beyond tile centers
    const zoom = Math.min(W / (maxX - minX + pad), H / (maxY - minY + pad)) * 0.95;
    const cxc = (minX + maxX) / 2;
    const cyc = (minY + maxY) / 2;
    const acts = ax().ui.getState().actions;
    acts.setZoom(zoom);
    acts.setScroll({ position: { x: -cxc * zoom, y: -cyc * zoom }, offset: { x: 0, y: 0 } });
  }

  // Mirrors CanvasPOM.tileToScreen + adds the interactions-box client offset.
  function tileToClient(tile: { x: number; y: number }) {
    const ui = ax().ui.getState();
    const el = document.querySelector(
      '[data-axoview-id="canvas-interactions"]'
    ) as HTMLElement;
    const rect = el.getBoundingClientRect();
    const canvasMode = ui.canvasMode ?? 'ISOMETRIC';
    const rendererSize = ui.rendererSize;
    const zoom = ui.zoom;
    const scroll = ui.scroll;
    const UNPROJECTED = 100;
    const halfW = canvasMode === 'ISOMETRIC' ? (UNPROJECTED * 1.415) / 2 : UNPROJECTED / 2;
    const halfH = canvasMode === 'ISOMETRIC' ? (UNPROJECTED * 0.819) / 2 : UNPROJECTED / 2;
    let cx: number;
    let cy: number;
    if (canvasMode === 'ISOMETRIC') {
      cx = halfW * tile.x - halfW * tile.y;
      cy = -(halfH * tile.x + halfH * tile.y);
    } else {
      cx = tile.x * UNPROJECTED;
      cy = -tile.y * UNPROJECTED;
    }
    const sx = rendererSize.width / 2 + scroll.position.x + cx * zoom;
    const sy = rendererSize.height / 2 + scroll.position.y + cy * zoom;
    return { x: rect.left + sx, y: rect.top + sy };
  }

  // Robust grab point: the node's ACTUAL rendered screen position, read from the
  // DOM, not re-projected from tile coords. The harness's forward tileToClient and
  // the lib's inverse screen→tile round differently at the extreme fit-zoom used
  // for large N, so a tile-projected pointer could land on the wrong/empty tile and
  // the grab silently failed to engage (decision-log Harness-v2 drag caveat). The
  // visible icon <img> sits over its node's tile, so its centre always hit-tests to
  // that node. Returns null if the node isn't in the DOM / has no laid-out box.
  function nodeClientCenter(id: string): { x: number; y: number } | null {
    const shell = document.querySelector(`[data-drag-id="${id}"]`);
    if (!shell) return null;
    const target = (shell.querySelector('img') as HTMLElement | null) ?? shell;
    const r = target.getBoundingClientRect();
    if (r.width < 1 && r.height < 1) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function dispatchPointer(
    el: HTMLElement,
    type: string,
    x: number,
    y: number,
    buttons: number
  ) {
    el.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        buttons,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true
      })
    );
  }

  function observeLongTasks(sink: Array<{ start: number; duration: number }>) {
    let po: PerformanceObserver | null = null;
    try {
      po = new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          sink.push({ start: e.startTime, duration: e.duration });
      });
      po.observe({ entryTypes: ['longtask'] });
    } catch {
      /* longtask unsupported — frames still captured */
    }
    return () => po && po.disconnect();
  }

  function forceGc() {
    if (typeof w.gc === 'function') {
      try {
        w.gc();
        w.gc();
      } catch {
        /* ignore */
      }
    }
  }

  // Drive the page to a clean idle floor: force GC, then wait until K
  // consecutive sub-budget frames are observed (or a hard cap). Removes
  // inter-run carryover + GC-pause variance before each measurement.
  const IDLE_BUDGET_MS = 20;
  const IDLE_STREAK = 5;
  async function quiesce(maxMs = 2500) {
    forceGc();
    let streak = 0;
    let prev = await raf();
    const t0 = performance.now();
    while (performance.now() - t0 < maxMs) {
      const now = await raf();
      const d = now - prev;
      prev = now;
      if (d < IDLE_BUDGET_MS) {
        if (++streak >= IDLE_STREAK) return;
      } else {
        streak = 0;
      }
    }
  }

  // Capture frames from now until the scene settles (K consecutive sub-budget
  // frames) or a hard cap — deterministic, free of variable idle-tail length.
  async function captureUntilSettled(
    frames: number[],
    capMs: number
  ): Promise<void> {
    let streak = 0;
    let prev = await raf();
    const t0 = performance.now();
    while (performance.now() - t0 < capMs) {
      const now = await raf();
      const d = now - prev;
      prev = now;
      frames.push(d);
      if (d < IDLE_BUDGET_MS) {
        if (++streak >= IDLE_STREAK) return;
      } else {
        streak = 0;
      }
    }
  }

  async function measureSpawn(N: number, capMs: number) {
    resetState();
    const scene = buildScene(N, 1);
    fitForGrid(1, N); // make all N nodes visible so the engine renders them all
    await quiesce();
    const { view } = activeView();
    const newViews = viewsWith(
      view.id,
      scene.vitems,
      scene.connectors,
      scene.rectangles,
      scene.textBoxes
    );
    const frames: number[] = [];
    const longTasks: Array<{ start: number; duration: number }> = [];
    const stop = observeLongTasks(longTasks);
    // Commit the whole scene in one store write — models a bulk paste/import/
    // diagram-open. The first captured frame straddles the commit, so its delta
    // IS the freeze. commitMs times the synchronous portion of the write (React
    // renders external-store updates synchronously to avoid tearing) — a
    // sub-vsync, continuous measure, unlike frame-delta-based settle.
    const tc = performance.now();
    ax()
      .model.getState()
      .actions.set({ items: scene.items, views: newViews }, false);
    // D4-1: route connectors (synchronous SYNC_SCENE — the diagram-open path) so
    // the spawn measurement includes connector paint. A bare model.set leaves
    // scene.connectors empty, so every <Connector> early-returns null and paints
    // nothing (Iter-7's "connectors cost 0ms" measured zero painting, not free
    // painting). Folded into commitMs since it is part of the open/paste cost.
    ax().changeView(view.id, ax().model.getState());
    const commitMs = performance.now() - tc;
    await captureUntilSettled(frames, capMs);
    stop();
    // Anti-cheat (ADR 0019): the canvas node layer publishes its per-frame draw
    // count on `data-draw-count`. With fit-to-view this must equal N — proving the
    // benchmark paints every node the engine committed (no accidental off-screen
    // cull shrinking the scene). Falls back to the legacy DOM-shell count
    // (`[data-drag-id]`) for any non-canvas path. sceneCounts records the full
    // multi-element composition that was committed.
    const canvasEl = document.querySelector(
      '[data-testid="axoview-nodes-canvas"]'
    ) as HTMLElement | null;
    const renderedNodes = canvasEl
      ? parseInt(canvasEl.dataset.drawCount ?? '0', 10) || 0
      : document.querySelectorAll('[data-drag-id]').length;
    // Connector-paint anti-cheat (D4-1, mirrors the node draw-count): every
    // committed connector must paint — a routable path or an unroutable marker,
    // not nothing. Counts both DOM testids.
    const paintedConnectors = document.querySelectorAll(
      '[data-testid="connector-path"], [data-testid="connector-unroutable"]'
    ).length;
    return {
      frames,
      longTasks,
      commitMs,
      renderedNodes,
      paintedConnectors,
      sceneCounts: {
        nodes: scene.items.length,
        connectors: scene.connectors.length,
        rectangles: scene.rectangles.length,
        textBoxes: scene.textBoxes.length
      }
    };
  }

  async function measureDrag(N: number, steps: number) {
    resetState();
    // Realistic drag: the full scene (N nodes + connectors + rectangles + text
    // boxes) is rendered, and we drag an in-grid, CONNECTED node horizontally
    // across OCCUPIED tiles. So each rAF frame pays a collision check against
    // occupied tiles + a re-route of the dragged node's connector + the static
    // render of the rest. (The old harness dragged one unconnected node through
    // an empty lane — it under-measured the real drag path.)
    const scene = buildScene(N, 1);
    fitForGrid(1, N);
    await quiesce();
    const { view } = activeView();
    ax()
      .model.getState()
      .actions.set(
        {
          items: scene.items,
          views: viewsWith(
            view.id,
            scene.vitems,
            scene.connectors,
            scene.rectangles,
            scene.textBoxes
          )
        },
        true
      );
    ax().model.getState().actions.clearHistory();
    await quiesce();

    const el = document.querySelector(
      '[data-axoview-id="canvas-interactions"]'
    ) as HTMLElement;
    const side = Math.ceil(Math.sqrt(N));
    // Drag a node near the GRID CENTRE (not the top-left corner, which can sit at
    // or past the viewport edge at the extreme fit-zoom used for large N — the old
    // perf-0 grab). A centre node is guaranteed on-screen and fully surrounded by
    // occupied tiles, so dragging it rightwards through its row-mates exercises the
    // realistic path: per-frame collision checks + connector re-route + scene
    // render. Indices are row-major (index = row*side + col).
    const centerCol = Math.floor(side / 2);
    const centerRow = Math.floor(side / 2);
    let dragIndex = centerRow * side + centerCol;
    if (dragIndex >= N) dragIndex = Math.floor(N / 2); // tiny-N safety
    const dragCol = dragIndex % side;
    // Move right within the same row, staying on occupied tiles.
    const span = Math.min(6, Math.max(1, side - 1 - dragCol));
    const targetIndex = dragIndex + span;
    const dragId = 'perf-' + dragIndex;
    const targetId = 'perf-' + targetIndex;

    // Engagement points from the ACTUAL rendered nodes (DOM rect), with a
    // tileToClient fallback for safety. See nodeClientCenter.
    const start =
      nodeClientCenter(dragId) ?? tileToClient(scene.vitems[dragIndex].tile);
    let end =
      (targetIndex < N ? nodeClientCenter(targetId) : null) ??
      tileToClient({
        x: scene.vitems[dragIndex].tile.x + span,
        y: scene.vitems[dragIndex].tile.y
      });
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    const MIN_DRAG_PX = 150; // ≫ TAP_SLOP_PX (8) so the drag engages quickly
    if (dist < MIN_DRAG_PX) {
      const s = MIN_DRAG_PX / (dist || 1);
      end = { x: start.x + dx * s, y: start.y + dy * s };
    }

    // Engage the drag: land pointer on the node, then press. Await rAF between so
    // the lib's rAF-throttled mouse snapshot flushes (CanvasPOM note).
    dispatchPointer(el, 'pointermove', start.x, start.y, 0);
    await raf();
    dispatchPointer(el, 'pointerdown', start.x, start.y, 1);
    await raf();

    const frames: number[] = [];
    const longTasks: Array<{ start: number; duration: number }> = [];
    const stop = observeLongTasks(longTasks);
    // Render-fan-out probe (only when booted with ?perfprobe=1). Reset right
    // before the measured loop so the counts isolate the DRAG, not the mount.
    const probe = w.__axoviewRenderProbe;
    probe?.reset?.();
    // Diagnostic: does modelStore.views (the root of currentView.connectors)
    // churn references during a CSS-preview drag? It should NOT (no model write).
    let viewsRef = ax().model.getState().views;
    let viewsChanges = 0;
    let prev = await raf();
    let dragEngaged = false;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      dispatchPointer(
        el,
        'pointermove',
        start.x + (end.x - start.x) * t,
        start.y + (end.y - start.y) * t,
        1
      );
      const now = await raf();
      frames.push(now - prev);
      prev = now;
      // Anti-cheat: confirm the press+move actually entered DRAG_ITEMS. A failed
      // grab leaves the mode in CURSOR and the "drag" measures idle frames — that
      // cell must be flagged, not silently reported as fast.
      if (!dragEngaged) {
        dragEngaged = ax().ui.getState().mode.type === 'DRAG_ITEMS';
      }
      const nowViews = ax().model.getState().views;
      if (nowViews !== viewsRef) {
        viewsChanges++;
        viewsRef = nowViews;
      }
    }
    dispatchPointer(el, 'pointerup', end.x, end.y, 0);
    await raf();
    stop();
    const renderCounts = probe?.get?.();
    (renderCounts as Record<string, number> | undefined) &&
      (renderCounts!['__viewsChanges'] = viewsChanges);
    return { frames, longTasks, dragEngaged, renderCounts };
  }

  // Dispatch a Ctrl+<key> keydown that the app's window-level keydown handler
  // (useInteractionManager) routes to copy/paste. Dispatched on document.body so
  // e.target is a non-editable element (the handler early-returns on editable
  // targets) and bubbles up to the window listener.
  function dispatchCtrlKey(key: string) {
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        ctrlKey: true,
        bubbles: true,
        cancelable: true
      })
    );
  }

  // Paste-on-top: build N source nodes, select-all + copy, position the cursor on
  // the selection CENTROID (so handlePaste's offset = mouseTile − centroid ≈ 0 —
  // the pasted block lands directly on top of the source), then Ctrl+V and
  // measure the settle. This drives the REAL paste path end to end —
  // useCopyPaste.handlePaste → findNearestUnoccupiedTilesForGroup (rigid-stamp
  // collision resolution, since every target tile is occupied) → pasteItems
  // (the batched O(N) store write) → canvas redraw of the 2N nodes. The pre-fix
  // pasteItems was O(N^3) here and froze the main thread; the headline is the
  // longest frame / settle time, the user-perceived freeze.
  async function measurePaste(N: number, capMs: number) {
    resetState();
    // Node-only source (the reported scenario is "paste of N nodes"); reuse
    // buildScene for consistent icon/label stylisation but commit items+vitems
    // only (no connectors/rectangles), so the copy set is exactly N nodes.
    const scene = buildScene(N, 1);
    fitForGrid(1, N);
    const { view } = activeView();
    ax()
      .model.getState()
      .actions.set(
        { items: scene.items, views: viewsWith(view.id, scene.vitems) },
        true
      );
    ax().model.getState().actions.clearHistory();
    await quiesce();

    // Centroid of the source tiles — mirrors handleCopy's rounded average, so a
    // cursor placed here yields a ~zero paste offset (directly on top).
    let sx = 0;
    let sy = 0;
    for (const v of scene.vitems) {
      sx += v.tile.x;
      sy += v.tile.y;
    }
    const centroid = {
      x: Math.round(sx / scene.vitems.length),
      y: Math.round(sy / scene.vitems.length)
    };

    // Select all N as a LASSO selection so handleCopy gathers them (its
    // resolveSelectionIds reads LASSO mode.selection.items). Deterministic — we
    // don't depend on Ctrl+A's select-all heuristic.
    const itemRefs = scene.vitems.map((v: any) => ({ type: 'ITEM', id: v.id }));
    ax().ui.getState().actions.setMode({
      type: 'LASSO',
      showCursor: true,
      isDragging: false,
      selection: {
        startTile: { x: -100000, y: -100000 },
        endTile: { x: 100000, y: 100000 },
        items: itemRefs
      }
    });
    await raf();

    // Copy into the in-app clipboard.
    dispatchCtrlKey('c');
    await raf();

    // Move the cursor onto the centroid tile so the paste lands on top. The
    // mouse snapshot is rAF-throttled, so await a frame for it to flush.
    const el = document.querySelector(
      '[data-axoview-id="canvas-interactions"]'
    ) as HTMLElement;
    const c = tileToClient(centroid);
    dispatchPointer(el, 'pointermove', c.x, c.y, 0);
    await raf();
    await raf();
    await quiesce(); // clean idle floor right before the measured paste

    const before = ax().model.getState().items.length;
    const frames: number[] = [];
    const longTasks: Array<{ start: number; duration: number }> = [];
    const stop = observeLongTasks(longTasks);
    // handlePaste wraps the store write in startTransition, so the work lands in
    // the frames captured below rather than synchronously under this dispatch.
    dispatchCtrlKey('v');
    await captureUntilSettled(frames, capMs);
    stop();

    const after = ax().model.getState().items.length;
    const canvasEl = document.querySelector(
      '[data-testid="axoview-nodes-canvas"]'
    ) as HTMLElement | null;
    const renderedNodes = canvasEl
      ? parseInt(canvasEl.dataset.drawCount ?? '0', 10) || 0
      : 0;
    return {
      frames,
      longTasks,
      pastedCount: after - before, // anti-cheat: must equal N
      totalNodes: after, // must equal 2N
      renderedNodes
    };
  }

  function heapMB(): number {
    const mem = (performance as any).memory;
    return mem ? mem.usedJSHeapSize / 1048576 : -1;
  }

  // Idle-churn guardrail (charter KR3): with the canvas empty, watch the heap
  // and long tasks over a window. GC at the start fixes a clean baseline; we do
  // NOT force GC during the window (we want to see natural growth); a final GC
  // separates a real leak (retained) from transient garbage (collectable).
  async function measureIdle(durationMs: number) {
    resetState();
    await quiesce();
    forceGc();
    await raf();
    const heapStart = heapMB();
    const frames: number[] = [];
    const longTasks: Array<{ start: number; duration: number }> = [];
    const stop = observeLongTasks(longTasks);
    let prev = await raf();
    let heapPeak = heapStart;
    const t0 = performance.now();
    while (performance.now() - t0 < durationMs) {
      const now = await raf();
      frames.push(now - prev);
      prev = now;
      const h = heapMB();
      if (h > heapPeak) heapPeak = h;
    }
    stop();
    const heapBeforeGc = heapMB();
    forceGc();
    await raf();
    await raf();
    const heapAfterGc = heapMB();
    return {
      frames,
      longTasks,
      heapStart,
      heapPeak,
      heapBeforeGc,
      heapAfterGc,
      durationMs
    };
  }

  // Machine-speed calibration: a fixed, deterministic CPU-bound workload whose
  // median ms indexes the current machine state, so cross-RUN drift is visible.
  // (Cross-session drift was measured at ~22% — far larger than the ~2% within-run
  // noise; see decision-log "cross-session drift defect". Keep/revert decisions
  // must be same-session A/B; this index flags when two runs' machine states
  // differ enough that their absolute numbers are not directly comparable.)
  function calibrate(reps: number) {
    const times: number[] = [];
    for (let r = 0; r < reps; r++) {
      const t0 = performance.now();
      let acc = 0;
      let s = '';
      for (let i = 1; i < 400000; i++) {
        acc += Math.sqrt(i) * 1.0000001 + (acc % 7);
        if ((i & 2047) === 0) s += (acc | 0).toString(36);
      }
      if (s.length === -1) (w as any).__never = s; // defeat dead-code elimination
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  }

  w.__perfH = {
    measureSpawn,
    measureDrag,
    measurePaste,
    measureIdle,
    resetState,
    calibrate
  };
}

// ---------------------------------------------------------------------------
// Boot the app to a blank diagram + debug bridge, then install the harness.
// ---------------------------------------------------------------------------
async function bootApp(page: Page) {
  const ONBOARDING: Array<[string, string]> = [
    ['axoview-lazy-loading-welcome-dismissed', 'true'],
    ['axoview-show-drag-hint', 'false'],
    // Perf-measurement mode (read pre-boot). Disables two pieces of dev-only
    // instrumentation that production never runs, so frame cost is
    // representative: (1) StrictMode's double-render (index.tsx); (2) the
    // always-on DiagnosticsOverlay 1 Hz rAF+setState loop (diagnosticsStore).
    ['axoview-perf-harness', '1']
  ];
  // The Canvas2D node layer (NodesCanvas) is the default + sole bulk renderer
  // (ADR 0019) — no flag to set. The harness measures it unconditionally; the
  // draw-count anti-cheat above asserts it painted every node.
  const CLEAR_KEYS = [
    'axoview-diagrams',
    'axoview-last-opened',
    'axoview-last-opened-data',
    'axoview-explorer-initialized',
    'axoview-explorer-open'
  ];
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* pre-navigation */
    }
  }, ONBOARDING);
  // ?perfprobe=1 enables useRenderProbe (window.__axoviewRenderProbe) so the drag
  // can report render fan-out. Off by default — the probe's per-render side-effect
  // would otherwise perturb the timing the baseline measures.
  await page.goto(process.env.PERF_RENDERPROBE ? '/?perfprobe=1' : '/');
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, CLEAR_KEYS);
  await page.reload();
  const createBtn = page.locator('[data-axoview-id="screen-empty-create"]');
  await createBtn.waitFor({ state: 'visible', timeout: 15_000 });
  await createBtn.click();
  await page
    .locator('[data-testid="axoview-canvas"]')
    .waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForFunction(
    () => Boolean((window as any).__axoview__?.model?.getState),
    undefined,
    { timeout: 15_000 }
  );
  await page.keyboard.press('Escape'); // dismiss hint tooltips
  await page.evaluate(installHarness);
  await page.evaluate((v: boolean) => {
    (window as any).__perfNoLabel = v;
  }, !!process.env.PERF_NOLABEL);
  await page.evaluate((v: boolean) => {
    (window as any).__perfNoConn = v;
  }, !!process.env.PERF_NOCONN);
}

// ---------------------------------------------------------------------------
// The harness test.
// ---------------------------------------------------------------------------
test('engine perf baseline — bulk-spawn + drag across N', async ({ page }) => {
  await bootApp(page);
  const env = await page.evaluate(() => ({
    gc: typeof (window as any).gc === 'function',
    harness: localStorage.getItem('axoview-perf-harness')
  }));
  console.log(
    `[perf] window.gc available: ${env.gc} · perf-mode (no StrictMode, ` +
      `no diagnostics loop): ${env.harness === '1'}`
  );

  const runOnce = (scenario: 'spawn' | 'drag', N: number): Promise<RunResult> =>
    scenario === 'spawn'
      ? page.evaluate(
          ([n, cap]) => (window as any).__perfH.measureSpawn(n, cap),
          [N, SPAWN_CAP_MS] as const
        )
      : page.evaluate(
          ([n, steps]) => (window as any).__perfH.measureDrag(n, steps),
          [N, DRAG_STEPS] as const
        );

  // Global V8 warm-up: tier up the shared render + drag hot paths once before
  // any measurement so per-cell warm-up can stay small. (Cheap mid-N cycles.)
  for (let i = 0; i < 3; i++) {
    await runOnce('spawn', 100);
    await runOnce('drag', 100);
  }

  // PROFILE mode: capture a CDP timeline trace around ONE spawn at PERF_PROFILE
  // and attribute the freeze across scripting/style/layout/paint. Skips the
  // baseline loop. Used to pick/verify the optimization target from a trace,
  // not a guess (charter LOOP step 7).
  if (process.env.PERF_PROFILE) {
    const N = parseInt(process.env.PERF_PROFILE, 10);
    const client = await page.context().newCDPSession(page);
    await client.send('Tracing.start', {
      transferMode: 'ReportEvents',
      traceConfig: {
        recordMode: 'recordAsMuchAsPossible',
        includedCategories: [
          'devtools.timeline',
          'disabled-by-default-devtools.timeline',
          'v8',
          'v8.execute',
          'blink',
          'cc'
        ]
      }
    });
    const events: TraceEvent[] = [];
    client.on('Tracing.dataCollected', (e: any) => {
      if (e.value) events.push(...e.value);
    });
    await runOnce('spawn', N); // the traced spawn
    const done = new Promise<void>((res) =>
      client.once('Tracing.tracingComplete', () => res())
    );
    await client.send('Tracing.end');
    await done;

    const { rows, total } = attributeTrace(events);
    const top = rows.slice(0, 20);
    console.log(`[profile] spawn N=${N} — main-thread self-time by event (ms):`);
    for (const r of top) console.log(`    ${r.ms.toFixed(1).padStart(8)}  ${r.name}`);
    console.log(`    total accounted: ${total.toFixed(0)} ms`);

    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const lines = [
      `# Spawn profile — N=${N}`,
      '',
      `_Generated ${new Date().toISOString()} · CDP timeline self-time on the renderer main thread (one spawn, post-warmup)._`,
      '',
      '| self-time (ms) | event |',
      '|---|---|',
      ...top.map((r) => `| ${r.ms.toFixed(1)} | ${r.name} |`),
      '',
      `Total accounted: **${total.toFixed(0)} ms**.`,
      ''
    ];
    fs.writeFileSync(path.join(RESULTS_DIR, `profile-spawn-${N}.md`), lines.join('\n'));
    expect(events.length).toBeGreaterThan(0);
    return;
  }

  // CPU-PROFILE mode: sampled JS profile around ONE spawn, aggregated to
  // self-time by function — pinpoints the hottest JS (which the timeline trace
  // lumps into one "FunctionCall" bucket). Skips the baseline loop.
  if (process.env.PERF_CPUPROFILE) {
    const N = parseInt(process.env.PERF_CPUPROFILE, 10);
    const client = await page.context().newCDPSession(page);
    await client.send('Profiler.enable');
    await client.send('Profiler.setSamplingInterval', { interval: 100 });
    await client.send('Profiler.start');
    await runOnce('spawn', N);
    const { profile } = (await client.send('Profiler.stop')) as any;
    // Aggregate self-time: each sample attributes its timeDelta to that node.
    const nodeById = new Map<number, any>();
    for (const n of profile.nodes) nodeById.set(n.id, n);
    const selfUsById = new Map<number, number>();
    for (let i = 0; i < profile.samples.length; i++) {
      const id = profile.samples[i];
      const dt = profile.timeDeltas[i] ?? 0;
      selfUsById.set(id, (selfUsById.get(id) ?? 0) + dt);
    }
    const byFn = new Map<string, number>();
    for (const [id, us] of selfUsById) {
      const cf = nodeById.get(id)?.callFrame;
      if (!cf) continue;
      const fn = cf.functionName || '(anonymous)';
      const url = (cf.url || '').split(/[\\/]/).pop() || '';
      const key = url ? `${fn} @ ${url}:${cf.lineNumber}` : fn;
      byFn.set(key, (byFn.get(key) ?? 0) + us);
    }
    const rows = [...byFn.entries()]
      .map(([key, us]) => ({ key, ms: us / 1000 }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 30);
    console.log(`[cpuprofile] spawn N=${N} — JS self-time by function (ms):`);
    for (const r of rows.slice(0, 25))
      console.log(`    ${r.ms.toFixed(1).padStart(8)}  ${r.key}`);
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(RESULTS_DIR, `cpuprofile-spawn-${N}.md`),
      [
        `# Spawn CPU profile — N=${N}`,
        '',
        `_Generated ${new Date().toISOString()} · sampled JS self-time, one spawn, post-warmup._`,
        '',
        '| self-time (ms) | function |',
        '|---|---|',
        ...rows.map((r) => `| ${r.ms.toFixed(1)} | ${r.key.replace(/\|/g, '\\|')} |`),
        ''
      ].join('\n')
    );
    expect(profile.samples.length).toBeGreaterThan(0);
    return;
  }

  // DRAG-PROFILE mode: attribute ONE collision-drag across the renderer main
  // thread (timeline self-time: scripting vs style/layout vs paint) AND by JS
  // function (CPU sampler) — to split the per-frame drag cost into collision
  // check / connector re-route / React render / layout / paint. Skips the
  // baseline loop. PERF_DRAGPROFILE=N.
  if (process.env.PERF_DRAGPROFILE) {
    const N = parseInt(process.env.PERF_DRAGPROFILE, 10);
    const client = await page.context().newCDPSession(page);
    // Timeline trace for the scripting/style/layout/paint split.
    await client.send('Tracing.start', {
      transferMode: 'ReportEvents',
      traceConfig: {
        recordMode: 'recordAsMuchAsPossible',
        includedCategories: [
          'devtools.timeline',
          'disabled-by-default-devtools.timeline',
          'v8',
          'v8.execute',
          'blink',
          'cc'
        ]
      }
    });
    const events: TraceEvent[] = [];
    client.on('Tracing.dataCollected', (e: any) => {
      if (e.value) events.push(...e.value);
    });
    // CPU sampler for the JS-function breakdown, concurrently.
    await client.send('Profiler.enable');
    await client.send('Profiler.setSamplingInterval', { interval: 80 });
    await client.send('Profiler.start');
    await runOnce('drag', N); // the profiled collision-drag
    const { profile } = (await client.send('Profiler.stop')) as any;
    const traceDone = new Promise<void>((res) =>
      client.once('Tracing.tracingComplete', () => res())
    );
    await client.send('Tracing.end');
    await traceDone;

    const { rows: tlRows, total: tlTotal } = attributeTrace(events);
    const tlTop = tlRows.slice(0, 18);
    console.log(`[dragprofile] drag N=${N} — main-thread self-time by event (ms):`);
    for (const r of tlTop)
      console.log(`    ${r.ms.toFixed(1).padStart(8)}  ${r.name}`);
    console.log(`    timeline total accounted: ${tlTotal.toFixed(0)} ms`);

    const nodeById = new Map<number, any>();
    for (const n of profile.nodes) nodeById.set(n.id, n);
    const selfUsById = new Map<number, number>();
    for (let i = 0; i < profile.samples.length; i++) {
      const id = profile.samples[i];
      selfUsById.set(id, (selfUsById.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0));
    }
    const byFn = new Map<string, number>();
    for (const [id, us] of selfUsById) {
      const cf = nodeById.get(id)?.callFrame;
      if (!cf) continue;
      const fn = cf.functionName || '(anonymous)';
      const url = (cf.url || '').split(/[\\/]/).pop() || '';
      const key = url ? `${fn} @ ${url}:${cf.lineNumber}` : fn;
      byFn.set(key, (byFn.get(key) ?? 0) + us);
    }
    const jsRows = [...byFn.entries()]
      .map(([key, us]) => ({ key, ms: us / 1000 }))
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 30);
    console.log(`[dragprofile] drag N=${N} — JS self-time by function (ms):`);
    for (const r of jsRows.slice(0, 20))
      console.log(`    ${r.ms.toFixed(1).padStart(8)}  ${r.key}`);

    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(RESULTS_DIR, `dragprofile-${N}.md`),
      [
        `# Collision-drag profile — N=${N}`,
        '',
        `_Generated ${new Date().toISOString()} · one ${DRAG_STEPS}-step collision-drag, post-warmup. Timeline self-time (renderer main) + JS self-time by function._`,
        '',
        '## Timeline (scripting / style / layout / paint)',
        '',
        '| self-time (ms) | event |',
        '|---|---|',
        ...tlTop.map((r) => `| ${r.ms.toFixed(1)} | ${r.name} |`),
        '',
        `Total accounted: **${tlTotal.toFixed(0)} ms** over ${DRAG_STEPS} frames.`,
        '',
        '## JS self-time by function',
        '',
        '| self-time (ms) | function |',
        '|---|---|',
        ...jsRows.map((r) => `| ${r.ms.toFixed(1)} | ${r.key.replace(/\|/g, '\\|')} |`),
        ''
      ].join('\n')
    );
    expect(profile.samples.length).toBeGreaterThan(0);
    return;
  }

  // RENDER-PROBE mode: count React renders during ONE collision-drag (booted with
  // ?perfprobe=1 so useRenderProbe is live). Answers: does the per-frame connector
  // preview leak into NodeContent, and for how many nodes? PERF_RENDERPROBE=N.
  if (process.env.PERF_RENDERPROBE) {
    const N = parseInt(process.env.PERF_RENDERPROBE, 10);
    for (let i = 0; i < WARMUP_RUNS; i++) await runOnce('drag', N); // warm the path
    const res = (await runOnce('drag', N)) as RunResult;
    const counts = res.renderCounts ?? {};
    const byComponent = new Map<string, { total: number; instances: number }>();
    for (const [key, n] of Object.entries(counts)) {
      const comp = key.split(':')[0];
      const agg = byComponent.get(comp) ?? { total: 0, instances: 0 };
      agg.total += n;
      agg.instances += 1;
      byComponent.set(comp, agg);
    }
    const frameCount = res.frames.length;
    console.log(
      `[renderprobe] drag N=${N} — ${frameCount} drag frames, engaged=${res.dragEngaged}`
    );
    if (Object.keys(counts).length === 0) {
      console.log('    (no counts — probe not enabled? expected ?perfprobe=1)');
    }
    const rows = [...byComponent.entries()].sort((a, b) => b[1].total - a[1].total);
    for (const [comp, agg] of rows) {
      console.log(
        `    ${comp.padEnd(18)} total renders=${agg.total}  distinct instances=${agg.instances}  ` +
          `≈${(agg.total / Math.max(1, agg.instances)).toFixed(1)}/instance  ` +
          `≈${(agg.total / Math.max(1, frameCount)).toFixed(1)}/frame`
      );
    }
    expect(frameCount).toBeGreaterThan(0);
    return;
  }

  const covPct = (xs: number[]) => round(cov(xs) * 100, 1);

  // Machine-speed calibration (drift detector — decision-log "cross-session
  // drift defect"). A fixed CPU workload; its ms indexes machine state so two
  // runs' absolute numbers can be sanity-checked for comparability.
  const calibrationMs: number = await page.evaluate(() =>
    (window as any).__perfH.calibrate(7)
  );
  console.log(
    `[perf] machine calibration index = ${round(calibrationMs, 1)} ms ` +
      '(fixed CPU workload; compare across runs to gauge drift — keep/revert ' +
      'decisions must be same-session A/B, not vs a prior-session baseline)'
  );

  const table: any[] = [];
  const rawDump: Record<string, RunResult[]> = {};

  for (const N of N_SET) {
    for (const scenario of ['spawn', 'drag'] as const) {
      // Per-cell warm-up (discarded), then the kept measured runs.
      for (let r = 0; r < WARMUP_RUNS; r++) await runOnce(scenario, N);
      const kept: RunResult[] = [];
      for (let r = 0; r < REPEATS; r++) kept.push(await runOnce(scenario, N));
      rawDump[`${scenario}-${N}`] = kept;

      const m = kept.map(metricsOf);
      const p50s = m.map((x) => x.p50);
      const p95s = m.map((x) => x.p95);
      const maxs = m.map((x) => x.max);
      const meanFrames = m.map((x) => x.meanFrame);
      const settles = m.map((x) => x.settle);
      const ltTotals = m.map((x) => x.longTaskTotal);
      const commits = kept.map((r) => r.commitMs ?? 0);

      // Headline metric (continuous, so the noise band reflects real variance,
      // not vsync quantization): spawn → settle time (commit→idle wall time);
      // drag → mean frame time. Noise band = coefficient of variation.
      const headline = scenario === 'spawn' ? settles : meanFrames;

      const renderedNodes = kept.map((r) => r.renderedNodes ?? -1);
      const paintedConn = kept.map((r) => r.paintedConnectors ?? -1);
      const sc = kept[0]?.sceneCounts;
      const engagedCount = kept.filter((r) => r.dragEngaged).length;
      const row = {
        scenario,
        N,
        p50_ms: round(median(p50s)),
        p95_ms: round(median(p95s)),
        maxFrame_ms: round(median(maxs)),
        meanFrame_ms: round(median(meanFrames)),
        settle_ms: round(median(settles)),
        longTaskTotal_ms: round(median(ltTotals)),
        keptRuns: kept.length,
        noiseBand_pct: covPct(headline),
        // Guard values, asserted after results are written (see below).
        drawnMedian: scenario === 'spawn' ? median(renderedNodes) : null,
        paintedConnMedian: scenario === 'spawn' ? median(paintedConn) : null,
        expectedConnectors: scenario === 'spawn' ? (sc?.connectors ?? 0) : null,
        engagedCount: scenario === 'drag' ? engagedCount : null
      };
      table.push(row);
      const commitInfo =
        scenario === 'spawn'
          ? ` commit=${round(median(commits), 1)} commitN=${covPct(commits)}%` +
            ` rendered=${median(renderedNodes)}/${N}` +
            (sc ? ` scene[conn=${sc.connectors} rect=${sc.rectangles}]` : '')
          : ` engaged=${engagedCount}/${kept.length}`;
      console.log(
        `[perf] ${scenario} N=${N}  p50=${row.p50_ms} p95=${row.p95_ms} ` +
          `mean=${row.meanFrame_ms} max=${row.maxFrame_ms} settle=${row.settle_ms} ` +
          `lt=${row.longTaskTotal_ms} noise(CoV)=${row.noiseBand_pct}%  ` +
          `[meanN=${covPct(meanFrames)}% settleN=${covPct(settles)}% p95N=${covPct(p95s)}%${commitInfo}]`
      );
      console.log(
        `        head[]=${headline.map((x) => round(x, 1)).join(',')}` +
          (scenario === 'spawn'
            ? `  commit[]=${commits.map((x) => round(x, 1)).join(',')}`
            : '')
      );
    }
  }

  // ---- paste-on-top scenario (the reported freeze) ----
  // Drives the REAL Ctrl+C / Ctrl+V path with the cursor on the selection
  // centroid, so every pasted node lands on an occupied tile (rigid-stamp
  // collision resolution) and pasteItems does the full batched store write +
  // canvas redraw. Headline = settle time (the user-perceived freeze).
  const runPasteOnce = (N: number): Promise<RunResult> =>
    page.evaluate(
      ([n, cap]) => (window as any).__perfH.measurePaste(n, cap),
      [N, SPAWN_CAP_MS] as const
    );

  const pasteTable: any[] = [];
  for (const N of PASTE_N_SET) {
    for (let r = 0; r < WARMUP_RUNS; r++) await runPasteOnce(N);
    const kept: RunResult[] = [];
    for (let r = 0; r < REPEATS; r++) kept.push(await runPasteOnce(N));
    rawDump[`paste-${N}`] = kept;

    const m = kept.map(metricsOf);
    const settles = m.map((x) => x.settle);
    const row = {
      scenario: 'paste',
      N,
      p50_ms: round(median(m.map((x) => x.p50))),
      p95_ms: round(median(m.map((x) => x.p95))),
      maxFrame_ms: round(median(m.map((x) => x.max))),
      settle_ms: round(median(settles)),
      longTaskTotal_ms: round(median(m.map((x) => x.longTaskTotal))),
      keptRuns: kept.length,
      noiseBand_pct: covPct(settles),
      // Guard values (asserted after results are written): the paste must add
      // exactly N nodes for a total of 2N — proves the paste actually ran and
      // nothing was silently dropped/stacked-into-one.
      pastedMedian: median(kept.map((r) => r.pastedCount ?? -1)),
      totalMedian: median(kept.map((r) => r.totalNodes ?? -1))
    };
    pasteTable.push(row);
    console.log(
      `[perf] paste(on-top) N=${N}  p50=${row.p50_ms} p95=${row.p95_ms} ` +
        `max=${row.maxFrame_ms} settle=${row.settle_ms} ` +
        `lt=${row.longTaskTotal_ms} noise(CoV)=${row.noiseBand_pct}%  ` +
        `pasted=${row.pastedMedian}/${N} total=${row.totalMedian}`
    );
    console.log(
      `        settle[]=${settles.map((x) => round(x, 1)).join(',')}`
    );
  }

  // ---- idle-churn guardrail probe (KR3) ----
  const idle = await page.evaluate(
    (ms) => (window as any).__perfH.measureIdle(ms),
    IDLE_PROBE_MS
  );
  const idleFrames: number[] = idle.frames;
  const idleSorted = [...idleFrames].sort((a: number, b: number) => a - b);
  const leakMB = round(idle.heapAfterGc - idle.heapStart, 1);
  const leakPct =
    idle.heapStart > 0
      ? round(((idle.heapAfterGc - idle.heapStart) / idle.heapStart) * 100, 1)
      : -1;
  const idleGuard = {
    durationS: round(idle.durationMs / 1000, 0),
    heapStartMB: round(idle.heapStart, 1),
    heapPeakMB: round(idle.heapPeak, 1),
    heapAfterGcMB: round(idle.heapAfterGc, 1),
    leakMB, // retained growth after a final GC = real leak signal
    leakPct,
    longTaskCount: idle.longTasks.length,
    p95FrameMs: round(percentile(idleSorted, 95), 1),
    maxFrameMs: round(idleSorted.length ? idleSorted[idleSorted.length - 1] : 0, 1),
    // KR3 passes: heap flat (±5% retained after GC) AND zero long tasks at idle.
    pass: Math.abs(leakPct) <= 5 && idle.longTasks.length === 0
  };
  console.log(
    `[perf] IDLE ${idleGuard.durationS}s @0 nodes: heap ${idleGuard.heapStartMB}` +
      `→${idleGuard.heapPeakMB}MB peak, ${idleGuard.heapAfterGcMB}MB after GC ` +
      `(retained ${idleGuard.leakMB}MB / ${idleGuard.leakPct}%) · ` +
      `longTasks=${idleGuard.longTaskCount} · idle p95=${idleGuard.p95FrameMs}ms ` +
      `max=${idleGuard.maxFrameMs}ms · KR3 ${idleGuard.pass ? 'PASS' : 'FAIL'}`
  );

  // ---- write results ----
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const stamp = new Date().toISOString();
  fs.writeFileSync(
    path.join(RAW_DIR, `run-${stamp.replace(/[:.]/g, '-')}.json`),
    JSON.stringify(
      { stamp, calibrationMs, table, pasteTable, idleGuard, raw: rawDump },
      null,
      2
    )
  );

  // KR1 gate. Load-bearing regime = all drag + spawn N≥100 (the cells whose
  // operation is large enough — >~100 ms — to resolve well above the 16.6 ms
  // vsync quantization floor). Small-N spawn (≤50) is a sub-100 ms operation at
  // the quantization floor and is NOT an optimization target (the app is smooth
  // there). We report both, transparently.
  const isLoadBearing = (r: any) => r.scenario === 'drag' || r.N >= 100;
  const worstNoise = Math.max(...table.map((r) => r.noiseBand_pct));
  const worstLoadBearing = Math.max(
    ...table.filter(isLoadBearing).map((r) => r.noiseBand_pct)
  );

  const md = renderMarkdown(
    stamp,
    calibrationMs,
    table,
    pasteTable,
    worstLoadBearing,
    worstNoise,
    idleGuard
  );
  fs.writeFileSync(path.join(RESULTS_DIR, 'baseline.md'), md);
  console.log('\n' + md);
  console.log(
    `[perf] worst noise band: load-bearing(drag+spawn N≥100)=${worstLoadBearing}% · ` +
      `all-cells=${worstNoise}%`
  );

  // ---- guards (real assertions, not just reporting) ----
  // Results are already written above, so a guard failure still leaves a
  // diagnosable baseline.md + raw dump. These are the integrity signals that
  // were previously only console.log'd; a regression now fails the run.
  expect(table.length).toBe(N_SET.length * 2);
  for (const r of table) {
    if (r.scenario === 'spawn') {
      // Draw-count anti-cheat: at fit-to-view the canvas must paint every node
      // the scene committed (no off-screen cull silently shrinking the work and
      // faking a faster spawn).
      expect(
        r.drawnMedian,
        `spawn N=${r.N}: draw-count anti-cheat (drawn == N)`
      ).toBe(r.N);
      // Connector-paint anti-cheat (D4-1): every committed connector must paint,
      // so the spawn cost includes connector render — not the old 0-paint path
      // that made Iter-7 "connectors cost 0ms" meaningless (and would let a T3
      // tick harness build on a path that never paints moving-endpoint connectors).
      expect(
        r.paintedConnMedian,
        `spawn N=${r.N}: connector-paint anti-cheat (painted == committed connectors)`
      ).toBe(r.expectedConnectors);
    } else {
      // The drag must actually engage DRAG_ITEMS on every kept run — otherwise a
      // failed grab measures idle frames and reads as a false 60 fps.
      expect(
        r.engagedCount,
        `drag N=${r.N}: DRAG_ITEMS engaged on every kept run`
      ).toBe(r.keptRuns);
    }
  }
  // Paste anti-cheat: each paste must add exactly N nodes (total 2N) — proves
  // the real paste path ran and nothing was dropped or collapsed onto one tile.
  expect(pasteTable.length).toBe(PASTE_N_SET.length);
  for (const r of pasteTable) {
    expect(r.pastedMedian, `paste N=${r.N}: paste added exactly N nodes`).toBe(
      r.N
    );
    expect(r.totalMedian, `paste N=${r.N}: 2N nodes after paste`).toBe(2 * r.N);
  }
  // KR3 idle-churn guardrail: heap flat (±5% retained after GC) AND zero idle
  // long tasks at zero entities.
  expect(idleGuard.pass, 'KR3 idle-churn guardrail').toBe(true);
});

function renderMarkdown(
  stamp: string,
  calibrationMs: number,
  table: any[],
  pasteTable: any[],
  worstLoadBearing: number,
  worstNoise: number,
  idleGuard: any
): string {
  const lines: string[] = [];
  lines.push('# Engine perf baseline');
  lines.push('');
  lines.push(`_Generated ${stamp} by packages/axoview-e2e/perf/engine-perf.spec.ts_`);
  lines.push('');
  const certified = worstLoadBearing < 10;
  lines.push(
    certified
      ? `**KR1: CERTIFIED (load-bearing regime)** — worst noise band ${worstLoadBearing}% ` +
          '< 10% across all drag cells and spawn N≥100. Baseline is trustworthy for ' +
          `the optimization-relevant range. (All-cells worst = ${worstNoise}%; the ` +
          'excess is small-N spawn ≤50 — sub-100 ms operations at the 16.6 ms vsync ' +
          'quantization floor, not an optimization target.)'
      : `**KR1: NOT CERTIFIED** — worst load-bearing noise band ${worstLoadBearing}% ≥ 10%. ` +
          'Numbers below are directional only (see perf-results/decision-log.md).'
  );
  lines.push('');
  lines.push(
    `Median across ${REPEATS} kept runs (${WARMUP_RUNS} per-cell warm-up runs + ` +
      'a global warm-up discarded first). Noise band = coefficient of variation ' +
      '(stddev/mean) of the per-run **continuous** headline metric ' +
      '(**spawn → settle time** = commit→idle wall time; **drag → mean frame ' +
      'time**) — a real run-to-run variance measure, robust to the vsync ' +
      'quantization that makes frame-time percentiles bimodal. Frame budget ' +
      '@60fps = 16.6 ms.'
  );
  lines.push('');
  lines.push(
    '**Scene (realistic, per N):** N nodes (5 icon types ≈1.7 KB each, varied ' +
      'label colours, ~20% with a description, ~12% with notes) + ~N connectors ' +
      '(⅓ labelled) + grouping rectangles. **Spawn** commits the whole scene in ' +
      'one store write (paste / import / diagram-open). **Drag** drags a ' +
      'connected in-grid node through OCCUPIED tiles → per-frame collision ' +
      'checks + connector re-route. (Text boxes excluded — their scene-side size ' +
      'derivation is incompatible with a bulk model.set.)'
  );
  lines.push('');
  lines.push(
    `**Machine calibration index: ${round(calibrationMs, 1)} ms** (fixed CPU ` +
      'workload, this session). Cross-session machine drift was measured at ~22% ' +
      '(≫ the ~2% within-run noise), so absolute numbers are comparable only ' +
      'between runs with a similar index — **keep/revert decisions must be ' +
      'same-session A/B**, never a fresh run vs a prior-session baseline.'
  );
  lines.push('');
  for (const scenario of ['spawn', 'drag']) {
    lines.push(`## ${scenario}`);
    lines.push('');
    lines.push('| N | p50 (ms) | p95 (ms) | mean frame (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |');
    lines.push('|---|---|---|---|---|---|---|---|---|');
    for (const r of table.filter((x) => x.scenario === scenario)) {
      lines.push(
        `| ${r.N} | ${r.p50_ms} | ${r.p95_ms} | ${r.meanFrame_ms} | ${r.maxFrame_ms} | ${r.settle_ms} | ${r.longTaskTotal_ms} | ${r.keptRuns} | ${r.noiseBand_pct}% |`
      );
    }
    lines.push('');
  }

  // Paste-on-top scenario — the reported freeze (select N → copy → paste
  // directly on top). Headline = settle time (commit→idle wall time). Pre-fix
  // this was O(N^3) in pasteItems and froze; post-fix it is O(N).
  lines.push('## paste (on-top collision)');
  lines.push('');
  lines.push(
    '**Scene:** N source nodes (varied icons/labels), select-all + copy, cursor ' +
      'on the selection centroid so the paste offset ≈ 0 (every pasted node hits ' +
      'an occupied tile → rigid-stamp placement). Drives the real Ctrl+C/Ctrl+V ' +
      'path → handlePaste → pasteItems → canvas redraw of 2N nodes.'
  );
  lines.push('');
  lines.push(
    '| N | p50 (ms) | p95 (ms) | longest frame (ms) | settle (ms) | long-task total (ms) | kept runs | noise band (CoV) |'
  );
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const r of pasteTable) {
    lines.push(
      `| ${r.N} | ${r.p50_ms} | ${r.p95_ms} | ${r.maxFrame_ms} | ${r.settle_ms} | ${r.longTaskTotal_ms} | ${r.keptRuns} | ${r.noiseBand_pct}% |`
    );
  }
  lines.push('');

  // Guardrail: idle-churn floor (KR3).
  lines.push('## Guardrail — idle floor (KR3)');
  lines.push('');
  lines.push(
    `**KR3: ${idleGuard.pass ? 'PASS' : 'FAIL'}** — ${idleGuard.durationS}s with ` +
      'zero entities on canvas. Charter bar: idle heap flat ±5% (retained after ' +
      'GC) AND zero long tasks.'
  );
  lines.push('');
  lines.push('| metric | value |');
  lines.push('|---|---|');
  lines.push(`| heap start | ${idleGuard.heapStartMB} MB |`);
  lines.push(`| heap peak | ${idleGuard.heapPeakMB} MB |`);
  lines.push(`| heap after final GC | ${idleGuard.heapAfterGcMB} MB |`);
  lines.push(`| retained growth (leak) | ${idleGuard.leakMB} MB (${idleGuard.leakPct}%) |`);
  lines.push(`| long tasks at idle | ${idleGuard.longTaskCount} |`);
  lines.push(`| idle frame p95 / max | ${idleGuard.p95FrameMs} / ${idleGuard.maxFrameMs} ms |`);
  lines.push('');
  return lines.join('\n');
}
