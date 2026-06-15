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
const SPAWN_WINDOW_MS = 2000; // capture window after the bulk commit
const DRAG_STEPS = 80; // rAF-paced pointermoves per drag run

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
function round(x: number, d = 2): number {
  const m = 10 ** d;
  return Math.round(x * m) / m;
}

interface RunResult {
  frames: number[];
  longTasks: Array<{ start: number; duration: number }>;
}
interface RunMetrics {
  p50: number;
  p95: number;
  max: number;
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
    count: sorted.length,
    longTaskTotal: ltDurs.reduce((a, b) => a + b, 0),
    longTaskMax: ltDurs.length ? Math.max(...ltDurs) : 0
  };
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

  const PERF_ICON = {
    id: 'perf-icon',
    name: 'perf',
    url:
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' fill='%23888'/></svg>",
    collection: 'imported',
    isIsometric: false
  };

  function activeView() {
    const ui = ax().ui.getState();
    const m = ax().model.getState();
    const view =
      (ui.view && m.views.find((v: any) => v.id === ui.view)) || m.views[0];
    return { view, m };
  }

  function viewsWith(viewId: string, items: any[]) {
    const m = ax().model.getState();
    return m.views.map((v: any) =>
      v.id === viewId
        ? { ...v, items, connectors: [], rectangles: [], textBoxes: [] }
        : v
    );
  }

  function resetState() {
    const { view, m } = activeView();
    const icons = m.icons && m.icons.length ? m.icons : [PERF_ICON];
    ax().model.getState().actions.set(
      { items: [], icons, views: viewsWith(view.id, []) },
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

  function iconId() {
    const m = ax().model.getState();
    return m.icons && m.icons.length ? m.icons[0].id : PERF_ICON.id;
  }

  // Grid of N nodes. `xBase` lets the drag scenario reserve column 0 as an
  // empty lane for the dragged node. Tiles are unique → no spurious collisions.
  function buildGrid(N: number, xBase: number) {
    const side = Math.ceil(Math.sqrt(N));
    const icon = iconId();
    const items: any[] = [];
    const vitems: any[] = [];
    for (let i = 0; i < N; i++) {
      const id = 'perf-' + i;
      items.push({ id, name: 'n' + i, icon });
      vitems.push({ id, tile: { x: xBase + (i % side), y: Math.floor(i / side) } });
    }
    return { items, vitems };
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

  async function settle(frames = 3) {
    for (let i = 0; i < frames; i++) await raf();
  }

  async function measureSpawn(N: number, windowMs: number) {
    resetState();
    await settle();
    const { items, vitems } = buildGrid(N, 1);
    const { view } = activeView();
    const newViews = viewsWith(view.id, vitems);
    const frames: number[] = [];
    const longTasks: Array<{ start: number; duration: number }> = [];
    const stop = observeLongTasks(longTasks);
    let prev = await raf();
    // Commit the whole scene in one store write — models a bulk paste/import.
    ax().model.getState().actions.set({ items, views: newViews }, false);
    const t0 = performance.now();
    while (performance.now() - t0 < windowMs) {
      const now = await raf();
      frames.push(now - prev);
      prev = now;
    }
    stop();
    return { frames, longTasks };
  }

  async function measureDrag(N: number, steps: number) {
    resetState();
    await settle();
    // N nodes total: node 0 is the dragged one in the empty x=0 lane; the rest
    // are fillers at x≥1. All N render every drag frame (no culling today).
    const draggedTile = { x: 0, y: 3 };
    const fillers = buildGrid(N - 1, 1);
    const items = [
      { id: 'perf-drag', name: 'drag', icon: iconId() },
      ...fillers.items
    ];
    const vitems = [{ id: 'perf-drag', tile: draggedTile }, ...fillers.vitems];
    const { view } = activeView();
    ax().model.getState().actions.set(
      { items, views: viewsWith(view.id, vitems) },
      true
    );
    ax().model.getState().actions.clearHistory();
    await settle(4);

    const el = document.querySelector(
      '[data-axoview-id="canvas-interactions"]'
    ) as HTMLElement;
    const start = tileToClient(draggedTile);
    // Drag down the empty column (tiles (0,4..9)) — no collisions to suppress work.
    const end = tileToClient({ x: 0, y: draggedTile.y + 6 });

    // Engage the drag: land pointer on the node's tile, then press. Await rAF
    // between so the lib's rAF-throttled mouse snapshot flushes (CanvasPOM note).
    dispatchPointer(el, 'pointermove', start.x, start.y, 0);
    await raf();
    dispatchPointer(el, 'pointerdown', start.x, start.y, 1);
    await raf();

    const frames: number[] = [];
    const longTasks: Array<{ start: number; duration: number }> = [];
    const stop = observeLongTasks(longTasks);
    let prev = await raf();
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
    }
    dispatchPointer(el, 'pointerup', end.x, end.y, 0);
    await raf();
    stop();
    return { frames, longTasks };
  }

  w.__perfH = { measureSpawn, measureDrag, resetState };
}

// ---------------------------------------------------------------------------
// Boot the app to a blank diagram + debug bridge, then install the harness.
// ---------------------------------------------------------------------------
async function bootApp(page: Page) {
  const ONBOARDING: Array<[string, string]> = [
    ['axoview-lazy-loading-welcome-dismissed', 'true'],
    ['axoview-show-drag-hint', 'false']
  ];
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
  await page.goto('/');
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
}

// ---------------------------------------------------------------------------
// The harness test.
// ---------------------------------------------------------------------------
test('engine perf baseline — bulk-spawn + drag across N', async ({ page }) => {
  await bootApp(page);

  const table: any[] = [];
  const rawDump: Record<string, RunResult[]> = {};

  for (const N of N_SET) {
    for (const scenario of ['spawn', 'drag'] as const) {
      const runs: RunResult[] = [];
      for (let r = 0; r < REPEATS; r++) {
        const res: RunResult =
          scenario === 'spawn'
            ? await page.evaluate(
                ([n, win]) => (window as any).__perfH.measureSpawn(n, win),
                [N, SPAWN_WINDOW_MS] as const
              )
            : await page.evaluate(
                ([n, steps]) => (window as any).__perfH.measureDrag(n, steps),
                [N, DRAG_STEPS] as const
              );
        runs.push(res);
      }
      rawDump[`${scenario}-${N}`] = runs;

      const kept = runs.slice(1); // discard warm-up
      const m = kept.map(metricsOf);
      const p50s = m.map((x) => x.p50);
      const p95s = m.map((x) => x.p95);
      const maxs = m.map((x) => x.max);
      const ltTotals = m.map((x) => x.longTaskTotal);

      // Headline metric for the noise band: spawn = longest frame (the freeze),
      // drag = p95 frame time.
      const headline = scenario === 'spawn' ? maxs : p95s;
      const hMed = median(headline);
      const noiseBand =
        hMed > 0 ? (Math.max(...headline) - Math.min(...headline)) / hMed : 0;

      const row = {
        scenario,
        N,
        p50_ms: round(median(p50s)),
        p95_ms: round(median(p95s)),
        maxFrame_ms: round(median(maxs)),
        longTaskTotal_ms: round(median(ltTotals)),
        keptRuns: kept.length,
        noiseBand_pct: round(noiseBand * 100, 1)
      };
      table.push(row);
      console.log(
        `[perf] ${scenario} N=${N}  p50=${row.p50_ms}ms p95=${row.p95_ms}ms ` +
          `max=${row.maxFrame_ms}ms longTasks=${row.longTaskTotal_ms}ms ` +
          `noise=${row.noiseBand_pct}%`
      );
    }
  }

  // ---- write results ----
  fs.mkdirSync(RAW_DIR, { recursive: true });
  const stamp = new Date().toISOString();
  fs.writeFileSync(
    path.join(RAW_DIR, `run-${stamp.replace(/[:.]/g, '-')}.json`),
    JSON.stringify({ stamp, table, raw: rawDump }, null, 2)
  );

  // KR1 gate: worst noise band across all cells. The <10% sign-off is read
  // from the table, not hard-failed here, because the first proof may surface
  // the idle-churn noise the charter has us fix next.
  const worstNoise = Math.max(...table.map((r) => r.noiseBand_pct));

  const md = renderMarkdown(stamp, table, worstNoise);
  fs.writeFileSync(path.join(RESULTS_DIR, 'baseline.md'), md);
  console.log('\n' + md);
  console.log(`[perf] worst noise band across all cells: ${worstNoise}%`);
  expect(table.length).toBe(N_SET.length * 2);
});

function renderMarkdown(stamp: string, table: any[], worstNoise: number): string {
  const lines: string[] = [];
  lines.push('# Engine perf baseline');
  lines.push('');
  lines.push(`_Generated ${stamp} by packages/axoview-e2e/perf/engine-perf.spec.ts_`);
  lines.push('');
  const certified = worstNoise < 10;
  lines.push(
    certified
      ? `**KR1: CERTIFIED** — worst noise band ${worstNoise}% < 10%. Baseline is trustworthy.`
      : `**KR1: NOT CERTIFIED (PROVISIONAL)** — worst noise band ${worstNoise}% ≥ 10%. ` +
          'Numbers below are directional only until the harness noise floor is < 10% ' +
          '(see perf-results/decision-log.md).'
  );
  lines.push('');
  lines.push(
    'Median across kept runs (first of ' +
      REPEATS +
      ' discarded as warm-up). Headline noise band = (max−min)/median of the ' +
      'per-run headline metric (spawn→longest frame, drag→p95). ' +
      'Frame budget @60fps = 16.6 ms.'
  );
  lines.push('');
  for (const scenario of ['spawn', 'drag']) {
    lines.push(`## ${scenario}`);
    lines.push('');
    lines.push('| N | p50 (ms) | p95 (ms) | longest frame (ms) | long-task total (ms) | kept runs | noise band |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const r of table.filter((x) => x.scenario === scenario)) {
      lines.push(
        `| ${r.N} | ${r.p50_ms} | ${r.p95_ms} | ${r.maxFrame_ms} | ${r.longTaskTotal_ms} | ${r.keptRuns} | ${r.noiseBand_pct}% |`
      );
    }
    lines.push('');
  }
  return lines.join('\n');
}
