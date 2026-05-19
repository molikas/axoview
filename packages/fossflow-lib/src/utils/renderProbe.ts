// MQA #7 / Problem B — render-count probe.
//
// Lightweight render counter for diagnosing fan-out during multi-element
// drag. Zero cost in normal use. Enable via URL query: ?perfprobe=1
//
// Usage in a component:
//   useRenderProbe('Node', node.id);
//
// At runtime (in DevTools console):
//   __axoviewRenderProbe.dump()    // grouped table
//   __axoviewRenderProbe.reset()   // zero counters
//   __axoviewRenderProbe.start()   // start fresh (resets + marks t0)
//   __axoviewRenderProbe.stop()    // logs summary since start()

let enabled = false;
if (typeof window !== 'undefined') {
  try {
    enabled = new URLSearchParams(window.location.search).get('perfprobe') === '1';
  } catch {
    /* ignore */
  }
}

const counts = new Map<string, number>();
let t0 = 0;

function bumpCount(component: string, id: string) {
  const key = id ? `${component}:${id}` : component;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function dump() {
  const rows: Array<{ key: string; count: number }> = [];
  counts.forEach((count, key) => rows.push({ key, count }));
  rows.sort((a, b) => b.count - a.count);
  // eslint-disable-next-line no-console
  console.table(rows);
  const elapsed = t0 ? ((performance.now() - t0) / 1000).toFixed(2) : 'n/a';
  // eslint-disable-next-line no-console
  console.log(`[renderProbe] ${rows.length} keys, ${elapsed}s since start()`);
}

function reset() {
  counts.clear();
}

function start() {
  reset();
  t0 = performance.now();
  // eslint-disable-next-line no-console
  console.log('[renderProbe] started — reproduce the scenario, then call __axoviewRenderProbe.stop()');
}

function stop() {
  dump();
  t0 = 0;
}

if (typeof window !== 'undefined' && enabled) {
  (window as any).__axoviewRenderProbe = { dump, reset, start, stop };
  // eslint-disable-next-line no-console
  console.log('[renderProbe] enabled. Call window.__axoviewRenderProbe.start(), reproduce, then .stop().');
}

export function useRenderProbe(component: string, id = '') {
  if (!enabled) return;
  // Side-effect during render — intentional. The probe is opt-in via URL flag
  // and we want to count every render attempt, including ones React discards.
  bumpCount(component, id);
}
