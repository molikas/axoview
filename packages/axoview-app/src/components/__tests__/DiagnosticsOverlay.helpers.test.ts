/**
 * Unit coverage for the pure helpers extracted from DiagnosticsOverlay's rAF
 * loop (the M6 refactor — PR #21). These are contract tests: they assert each
 * helper's input → output behavior (events pushed, refs advanced), not the
 * tick() call ordering.
 */
import {
  getSceneCounts,
  getUiSnapshot,
  getHistoryLengths,
  pushEvent,
  buildAi,
  buildHuman,
  fpsColor,
  detectSceneChanges,
  detectFpsThreshold,
  detectLongTaskBurst,
  detectGc,
  detectMemoryWarning,
  detectZoomChange,
  detectViewChange,
  detectUndoRedo,
  detectDrag,
  type DiagEvent
} from '../DiagnosticsOverlay';

type WinWithBridge = Window & { __axoview__?: unknown };
const win = window as WinWithBridge;

afterEach(() => {
  delete win.__axoview__;
});

// ── fpsColor ────────────────────────────────────────────────────────────────
describe('fpsColor', () => {
  it('is green at or above 50', () => {
    expect(fpsColor(50)).toBe('#4caf50');
    expect(fpsColor(60)).toBe('#4caf50');
  });
  it('is orange in the 30–49 band', () => {
    expect(fpsColor(49)).toBe('#ff9800');
    expect(fpsColor(30)).toBe('#ff9800');
  });
  it('is red below 30', () => {
    expect(fpsColor(29)).toBe('#f44336');
    expect(fpsColor(0)).toBe('#f44336');
  });
});

// ── pushEvent (circular buffer) ───────────────────────────────────────────────
describe('pushEvent', () => {
  it('appends to the buffer', () => {
    const buf: DiagEvent[] = [];
    pushEvent(buf, [10, 'node_added', 1]);
    expect(buf).toEqual([[10, 'node_added', 1]]);
  });
  it('drops the oldest once MAX_EVENTS (300) is reached', () => {
    const buf: DiagEvent[] = [];
    for (let i = 0; i < 300; i++) pushEvent(buf, [i, 'x']);
    pushEvent(buf, [999, 'newest']);
    expect(buf).toHaveLength(300);
    expect(buf[0]).toEqual([1, 'x']); // [0,'x'] dropped
    expect(buf[299]).toEqual([999, 'newest']);
  });
});

// ── buildAi ───────────────────────────────────────────────────────────────────
describe('buildAi', () => {
  it('round-trips samples, events and t0 with field/unit metadata', () => {
    const samples = [[0, 60, -1, -1, 0, 1, 0, 0]];
    const events: DiagEvent[] = [[5, 'node_added', 1]];
    const parsed = JSON.parse(buildAi(samples, events, 1234));
    expect(parsed.meta.t0).toBe(1234);
    expect(parsed.meta.fields).toEqual(['dt', 'fps', 'hu', 'ht', 'lt', 'ni', 'nc', 'ntb']);
    expect(parsed.meta.units).toContain('fps=frames/s');
    expect(parsed.samples).toEqual(samples);
    expect(parsed.events).toEqual([[5, 'node_added', 1]]);
  });
});

// ── buildHuman ────────────────────────────────────────────────────────────────
describe('buildHuman', () => {
  it('returns an error blob when there is no data', () => {
    expect(JSON.parse(buildHuman([], [], 0))).toEqual({ error: 'no data' });
  });

  it('computes fps stats, long-task totals and heap peak', () => {
    // rows: [dt, fps, hu, ht, lt, ni, nc, ntb]
    const samples = [
      [0, 60, 100, 120, 0, 0, 0, 0],
      [1000, 40, 150, 180, 3, 0, 0, 0],
      [2000, 20, -1, -1, 8, 0, 0, 0]
    ];
    const out = JSON.parse(buildHuman(samples, [], 1000));
    expect(out.session.sampleCount).toBe(3);
    expect(out.session.durationSecs).toBe(2); // last dt 2000ms
    expect(out.performance.fps.avg).toBe(40); // (60+40+20)/3
    expect(out.performance.fps.min).toBe(20);
    expect(out.performance.fps.good_secs).toBe(1); // >=50
    expect(out.performance.fps.medium_secs).toBe(1); // 30..49
    expect(out.performance.fps.poor_secs).toBe(1); // <30
    expect(out.performance.heapUsedMB.peak).toBe(150); // -1 filtered out
    expect(out.performance.longTasks.total).toBe(8); // last lt - first lt
  });

  it('reports heap peak as n/a when no heap samples are available', () => {
    const samples = [[0, 60, -1, -1, 0, 0, 0, 0]];
    const out = JSON.parse(buildHuman(samples, [], 0));
    expect(out.performance.heapUsedMB.peak).toBe('n/a');
  });
});

// ── detectSceneChanges ────────────────────────────────────────────────────────
describe('detectSceneChanges', () => {
  const run = (prev: { ni: number; nc: number; ntb: number }, curr: typeof prev) => {
    const ev: DiagEvent[] = [];
    const ref = { current: prev };
    detectSceneChanges(ev, 100, curr, ref);
    return { ev, ref };
  };

  it('emits node_added / node_removed for ±1 node deltas', () => {
    expect(run({ ni: 0, nc: 0, ntb: 0 }, { ni: 1, nc: 0, ntb: 0 }).ev).toEqual([
      [100, 'node_added', 1]
    ]);
    expect(run({ ni: 5, nc: 0, ntb: 0 }, { ni: 4, nc: 0, ntb: 0 }).ev).toEqual([
      [100, 'node_removed', 4]
    ]);
  });

  it('emits nodes_added / nodes_removed for small multi-node deltas', () => {
    expect(run({ ni: 0, nc: 0, ntb: 0 }, { ni: 3, nc: 0, ntb: 0 }).ev[0][1]).toBe('nodes_added');
    expect(run({ ni: 4, nc: 0, ntb: 0 }, { ni: 1, nc: 0, ntb: 0 }).ev[0][1]).toBe('nodes_removed');
  });

  it('emits bulk_load / bulk_remove when |Δnodes| ≥ 5', () => {
    expect(run({ ni: 0, nc: 0, ntb: 0 }, { ni: 5, nc: 0, ntb: 0 }).ev).toEqual([
      [100, 'bulk_load', 5]
    ]);
    expect(run({ ni: 10, nc: 0, ntb: 0 }, { ni: 2, nc: 0, ntb: 0 }).ev).toEqual([
      [100, 'bulk_remove', 2]
    ]);
  });

  it('tracks connector deltas independently of node deltas', () => {
    expect(run({ ni: 0, nc: 0, ntb: 0 }, { ni: 0, nc: 1, ntb: 0 }).ev).toEqual([
      [100, 'connector_added', 1]
    ]);
    expect(run({ ni: 0, nc: 3, ntb: 0 }, { ni: 0, nc: 1, ntb: 0 }).ev[0][1]).toBe('connectors_removed');
  });

  it('advances the prevCounts ref and emits nothing when unchanged', () => {
    const { ev, ref } = run({ ni: 2, nc: 1, ntb: 0 }, { ni: 2, nc: 1, ntb: 0 });
    expect(ev).toEqual([]);
    expect(ref.current).toEqual({ ni: 2, nc: 1, ntb: 0 });
  });
});

// ── detectFpsThreshold ────────────────────────────────────────────────────────
describe('detectFpsThreshold', () => {
  it('emits fps_degraded once when crossing below 30 and flips the flag', () => {
    const ev: DiagEvent[] = [];
    const ok = { current: true };
    detectFpsThreshold(ev, 1, 20, ok);
    expect(ev).toEqual([[1, 'fps_degraded', 20]]);
    expect(ok.current).toBe(false);
    detectFpsThreshold(ev, 2, 18, ok); // already degraded → no repeat
    expect(ev).toHaveLength(1);
  });

  it('emits fps_recovered when climbing back to ≥50', () => {
    const ev: DiagEvent[] = [];
    const ok = { current: false };
    detectFpsThreshold(ev, 5, 55, ok);
    expect(ev).toEqual([[5, 'fps_recovered', 55]]);
    expect(ok.current).toBe(true);
  });

  it('stays silent in the 30–49 hysteresis band', () => {
    const ev: DiagEvent[] = [];
    detectFpsThreshold(ev, 1, 40, { current: true });
    expect(ev).toEqual([]);
  });
});

// ── detectLongTaskBurst ───────────────────────────────────────────────────────
describe('detectLongTaskBurst', () => {
  it('emits a burst when cumulative long tasks jump by more than 5', () => {
    const ev: DiagEvent[] = [];
    const samples = { current: [[0, 60, -1, -1, 2, 0, 0, 0]] };
    detectLongTaskBurst(ev, 9, 10, samples); // 10 - 2 = 8 > 5
    expect(ev).toEqual([[9, 'longtask_burst', 8]]);
  });
  it('is silent when there is no prior sample and lt ≤ 5', () => {
    const ev: DiagEvent[] = [];
    detectLongTaskBurst(ev, 9, 4, { current: [] });
    expect(ev).toEqual([]);
  });
});

// ── detectGc ──────────────────────────────────────────────────────────────────
describe('detectGc', () => {
  it('emits gc when heap drops by more than 20 MB', () => {
    const ev: DiagEvent[] = [];
    const prevHu = { current: 200 };
    detectGc(ev, 3, 150, prevHu);
    expect(ev).toEqual([[3, 'gc', '200→150MB']]);
    expect(prevHu.current).toBe(150);
  });
  it('does not fire (but still advances) when heap is unavailable', () => {
    const ev: DiagEvent[] = [];
    const prevHu = { current: -1 };
    detectGc(ev, 3, -1, prevHu);
    expect(ev).toEqual([]);
    expect(prevHu.current).toBe(-1);
  });
});

// ── detectMemoryWarning ───────────────────────────────────────────────────────
describe('detectMemoryWarning', () => {
  it('fires once when heap exceeds 200 MB and never again', () => {
    const ev: DiagEvent[] = [];
    const fired = { current: false };
    detectMemoryWarning(ev, 1, 250, fired);
    expect(ev).toEqual([[1, 'memory_warning', 250]]);
    expect(fired.current).toBe(true);
    detectMemoryWarning(ev, 2, 300, fired);
    expect(ev).toHaveLength(1);
  });
});

// ── detectZoomChange ──────────────────────────────────────────────────────────
describe('detectZoomChange', () => {
  it('emits zoom_changed when |Δzoom| > 0.1 and advances the ref', () => {
    const ev: DiagEvent[] = [];
    const prev = { current: 1 };
    detectZoomChange(ev, 4, 1.5, prev);
    expect(ev).toEqual([[4, 'zoom_changed', 1.5]]);
    expect(prev.current).toBe(1.5);
  });
  it('ignores sub-threshold zoom jitter', () => {
    const ev: DiagEvent[] = [];
    detectZoomChange(ev, 4, 1.05, { current: 1 });
    expect(ev).toEqual([]);
  });
});

// ── detectViewChange ──────────────────────────────────────────────────────────
describe('detectViewChange', () => {
  it('emits view_changed when the active view id changes', () => {
    const ev: DiagEvent[] = [];
    const prev = { current: 'view-a' };
    detectViewChange(ev, 7, 'view-b', prev);
    expect(ev).toEqual([[7, 'view_changed', 'view-b']]);
    expect(prev.current).toBe('view-b');
  });
  it('records the first view without emitting an event', () => {
    const ev: DiagEvent[] = [];
    const prev = { current: '' };
    detectViewChange(ev, 7, 'view-a', prev);
    expect(ev).toEqual([]);
    expect(prev.current).toBe('view-a');
  });
});

// ── detectUndoRedo ────────────────────────────────────────────────────────────
describe('detectUndoRedo', () => {
  it('emits undo when past shrinks and future grows', () => {
    const ev: DiagEvent[] = [];
    const past = { current: 5 };
    const future = { current: 0 };
    detectUndoRedo(ev, 2, { past: 4, future: 1 }, past, future);
    expect(ev).toEqual([[2, 'undo', 4]]);
    expect(past.current).toBe(4);
    expect(future.current).toBe(1);
  });
  it('emits redo when future shrinks and past grows', () => {
    const ev: DiagEvent[] = [];
    detectUndoRedo(ev, 2, { past: 5, future: 0 }, { current: 4 }, { current: 1 });
    expect(ev).toEqual([[2, 'redo', 5]]);
  });
});

// ── detectDrag ────────────────────────────────────────────────────────────────
describe('detectDrag', () => {
  it('emits drag_start on the down edge and drag_end on the up edge', () => {
    const ev: DiagEvent[] = [];
    const dragging = { current: false };
    detectDrag(ev, 1, true, dragging, 3);
    expect(ev).toEqual([[1, 'drag_start', 3]]);
    detectDrag(ev, 2, false, dragging, 3);
    expect(ev).toEqual([
      [1, 'drag_start', 3],
      [2, 'drag_end', 3]
    ]);
  });
  it('is silent while drag state is unchanged', () => {
    const ev: DiagEvent[] = [];
    detectDrag(ev, 1, true, { current: true }, 3);
    expect(ev).toEqual([]);
  });
});

// ── bridge readers ────────────────────────────────────────────────────────────
describe('getSceneCounts', () => {
  it('returns zeros when no debug bridge is present', () => {
    expect(getSceneCounts()).toEqual({ ni: 0, nc: 0, ntb: 0 });
  });

  it('counts the items/connectors of the active view plus scene text boxes', () => {
    win.__axoview__ = {
      ui: { getState: () => ({ view: 'v2' }) },
      model: {
        getState: () => ({
          views: [
            { id: 'v1', items: { length: 1 }, connectors: { length: 1 } },
            { id: 'v2', items: { length: 4 }, connectors: { length: 2 } }
          ]
        })
      },
      scene: { getState: () => ({ textBoxes: { a: 1, b: 2 } }) }
    };
    expect(getSceneCounts()).toEqual({ ni: 4, nc: 2, ntb: 2 });
  });

  it('falls back to the first view when no active view id is set', () => {
    win.__axoview__ = {
      ui: { getState: () => ({}) },
      model: { getState: () => ({ views: [{ id: 'v1', items: { length: 7 } }] }) }
    };
    expect(getSceneCounts().ni).toBe(7);
  });
});

describe('getUiSnapshot', () => {
  it('defaults to zoom 1, empty view and not-dragging without a bridge', () => {
    expect(getUiSnapshot()).toEqual({ zoom: 1, viewId: '', isDragging: false });
  });
  it('reads zoom, view id and a held mouse button as dragging', () => {
    win.__axoview__ = {
      ui: { getState: () => ({ zoom: 2, view: 'v9', mouse: { mousedown: {} } }) }
    };
    expect(getUiSnapshot()).toEqual({ zoom: 2, viewId: 'v9', isDragging: true });
  });
});

describe('getHistoryLengths', () => {
  it('defaults to zero past/future without a bridge', () => {
    expect(getHistoryLengths()).toEqual({ past: 0, future: 0 });
  });
  it('reads undo/redo stack lengths from the model history', () => {
    win.__axoview__ = {
      model: { getState: () => ({ history: { past: { length: 3 }, future: { length: 2 } } }) }
    };
    expect(getHistoryLengths()).toEqual({ past: 3, future: 2 });
  });
});
