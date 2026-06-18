/**
 * PERF REGRESSION — lasso marquee at scale (SPATIAL-3)
 *
 * getItemsInBounds runs on every marquee-drag mousemove frame. Its connector
 * branch resolved each item-anchor with scene.items.find — an O(N) scan PER
 * anchor, making the whole pass O(N + C·A·N) per frame. On a 1000-node,
 * connector-heavy diagram that turned marquee selection into a single-digit-fps
 * crawl.
 *
 * The fix builds one id→tile Map per call and resolves anchors in O(1), so the
 * pass is O(N + C·A). This drives the REAL Lasso.mousemove (with the real
 * isWithinBounds / segmentIntersectsRect) over a 1000-node + 400-connector
 * scene for a sequence of frames and asserts a loose absolute bound — enough to
 * catch a re-introduction of the per-anchor linear scan without flaking on slow
 * CI runners.
 */

import { Lasso } from 'src/interaction/modes/Lasso';
import { Connector, ViewItem } from 'src/types';

const NODE_COUNT = 1000;
const CONNECTOR_COUNT = 400;
const FRAMES = 20;
// Generous order-of-magnitude bound; the fix runs the whole sequence in well
// under 100ms. Re-introducing O(C·A·N)/frame pushes this into seconds.
const BUDGET_MS = 2000;

function buildScene() {
  const width = 32;
  const items: ViewItem[] = [];
  for (let i = 0; i < NODE_COUNT; i += 1) {
    items.push({
      id: `n${i}`,
      tile: { x: i % width, y: Math.floor(i / width) }
    });
  }

  const connectors: Connector[] = [];
  for (let i = 0; i < CONNECTOR_COUNT; i += 1) {
    // Link two arbitrary (but existing) nodes by item-ref — the branch that
    // used to do a scene.items.find per anchor.
    const a = i % NODE_COUNT;
    const b = (i * 7 + 3) % NODE_COUNT;
    connectors.push({
      id: `c${i}`,
      anchors: [
        { id: `c${i}-a`, ref: { item: `n${a}` } },
        { id: `c${i}-b`, ref: { item: `n${b}` } }
      ]
    });
  }

  return { items, rectangles: [], textBoxes: [], connectors };
}

describe('lasso marquee — perf regression (SPATIAL-3)', () => {
  test(`${FRAMES} marquee frames over ${NODE_COUNT} nodes + ${CONNECTOR_COUNT} connectors stay under ${BUDGET_MS}ms`, () => {
    const scene = buildScene();
    const uiState: any = {
      mode: { type: 'LASSO', selection: null, isDragging: false },
      mouse: {
        delta: { tile: { x: 1, y: 1 } },
        mousedown: { tile: { x: -5, y: -5 }, screen: { x: 0, y: 0 } },
        position: { tile: { x: 40, y: 40 } }
      },
      actions: { setMode: () => {} }
    };
    const gate = () => true;

    const t0 = performance.now();
    for (let f = 0; f < FRAMES; f += 1) {
      // Grow the marquee each frame so the selection genuinely rebuilds.
      uiState.mouse.position = { tile: { x: 40 + f, y: 40 + f } };
      Lasso.mousemove!({
        uiState,
        scene,
        isRendererInteraction: true,
        isItemInteractable: gate
      } as any);
    }
    const elapsed = performance.now() - t0;

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
