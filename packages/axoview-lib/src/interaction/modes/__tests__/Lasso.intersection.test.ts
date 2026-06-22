/**
 * Lasso intersection semantics (ADR 0006 addendum, canvas-UX overhaul T2).
 *
 * Drives the REAL Lasso.mousemove with the REAL utils (no mocks) so the
 * rectangle/textbox/connector hit-tests exercise the actual geometry:
 *   - #16 rectangles select on ANY overlap (lasso through the middle), not
 *     only full four-corner enclosure.
 *   - #16 textboxes hit on their FULL bounds, not just the origin tile.
 *   - #2  a free-floating (tile-bound) connector endpoint is captured for
 *     MOVEMENT (CONNECTOR_ANCHOR ref) so the connector drags rigidly; a
 *     node-bound connector is unaffected (no endpoint anchors).
 */

import { Lasso } from 'src/interaction/modes/Lasso';
import { ItemReference } from 'src/types';

type Marquee = { start: { x: number; y: number }; end: { x: number; y: number } };

// Run a single marquee frame and return the resulting selection refs.
function selectWithin(marquee: Marquee, scene: any): ItemReference[] {
  let captured: ItemReference[] = [];
  const uiState: any = {
    mode: { type: 'LASSO', selection: null, isDragging: false },
    mouse: {
      delta: { tile: { x: 1, y: 1 } }, // hasMovedTile → true
      mousedown: { tile: marquee.start, screen: { x: 0, y: 0 } },
      position: { tile: marquee.end }
    },
    actions: {
      setMode: (next: any) => {
        if (next?.selection) captured = next.selection.items;
      }
    }
  };
  Lasso.mousemove!({
    uiState,
    scene,
    isRendererInteraction: true,
    isItemInteractable: () => true
  } as any);
  return captured;
}

const emptyScene = () => ({
  items: [],
  rectangles: [],
  textBoxes: [],
  connectors: []
});

describe('Lasso — rectangle ANY-overlap (#16)', () => {
  it('selects a long rectangle the marquee crosses through its MIDDLE', () => {
    const scene = {
      ...emptyScene(),
      // A wide bar far overhanging the marquee on both ends — never fully
      // enclosed, but the marquee cuts straight through it.
      rectangles: [{ id: 'r1', from: { x: -20, y: 5 }, to: { x: 20, y: 5 } }]
    };
    const refs = selectWithin(
      { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      scene
    );
    expect(refs).toContainEqual({ type: 'RECTANGLE', id: 'r1' });
  });

  it('does NOT select a rectangle fully outside the marquee', () => {
    const scene = {
      ...emptyScene(),
      rectangles: [{ id: 'r1', from: { x: 50, y: 50 }, to: { x: 60, y: 60 } }]
    };
    const refs = selectWithin(
      { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      scene
    );
    expect(refs).toHaveLength(0);
  });
});

describe('Lasso — textbox FULL-bounds (#16)', () => {
  // Textbox at (5,5), orientation X, width 6 → spans x 5..11 on row y=5.
  const textScene = () => ({
    ...emptyScene(),
    textBoxes: [
      {
        id: 't1',
        tile: { x: 5, y: 5 },
        orientation: 'X',
        size: { width: 6, height: 1 }
      }
    ]
  });

  it('selects a textbox the marquee overlaps in its BODY (not the origin tile)', () => {
    // Marquee (7,4)-(9,6) overlaps the body around x≈8 but NOT the origin (5,5).
    const refs = selectWithin(
      { start: { x: 7, y: 4 }, end: { x: 9, y: 6 } },
      textScene()
    );
    expect(refs).toContainEqual({ type: 'TEXTBOX', id: 't1' });
  });

  it('does NOT select a textbox the marquee misses entirely', () => {
    const refs = selectWithin(
      { start: { x: 20, y: 20 }, end: { x: 25, y: 25 } },
      textScene()
    );
    expect(refs).toHaveLength(0);
  });
});

describe('Lasso — mixed rectangle + text marquee', () => {
  it('selects both a rectangle and a textbox under one marquee', () => {
    const scene = {
      ...emptyScene(),
      rectangles: [{ id: 'r1', from: { x: 1, y: 1 }, to: { x: 3, y: 3 } }],
      textBoxes: [
        {
          id: 't1',
          tile: { x: 4, y: 4 },
          orientation: 'X',
          size: { width: 3, height: 1 }
        }
      ]
    };
    const refs = selectWithin(
      { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      scene
    );
    expect(refs).toContainEqual({ type: 'RECTANGLE', id: 'r1' });
    expect(refs).toContainEqual({ type: 'TEXTBOX', id: 't1' });
  });
});

describe('Lasso — connector endpoint capture for movement (#2)', () => {
  it('captures a free-floating (tile-bound) connector endpoint as CONNECTOR_ANCHOR', () => {
    const scene = {
      ...emptyScene(),
      connectors: [
        {
          id: 'c1',
          anchors: [
            { id: 'e0', ref: { tile: { x: 2, y: 2 } } },
            { id: 'e1', ref: { tile: { x: 8, y: 8 } } }
          ]
        }
      ]
    };
    const refs = selectWithin(
      { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      scene
    );
    // Connector selected, and BOTH free endpoints come along so it drags rigidly.
    expect(refs).toContainEqual({ type: 'CONNECTOR', id: 'c1' });
    expect(refs).toContainEqual({ type: 'CONNECTOR_ANCHOR', id: 'e0' });
    expect(refs).toContainEqual({ type: 'CONNECTOR_ANCHOR', id: 'e1' });
  });

  it('does NOT capture endpoint anchors for a node-bound connector (unchanged common case)', () => {
    const scene = {
      ...emptyScene(),
      items: [
        { id: 'n1', tile: { x: 2, y: 2 } },
        { id: 'n2', tile: { x: 8, y: 8 } }
      ],
      connectors: [
        {
          id: 'c1',
          anchors: [
            { id: 'e0', ref: { item: 'n1' } },
            { id: 'e1', ref: { item: 'n2' } }
          ]
        }
      ]
    };
    const refs = selectWithin(
      { start: { x: 0, y: 0 }, end: { x: 10, y: 10 } },
      scene
    );
    expect(refs).toContainEqual({ type: 'CONNECTOR', id: 'c1' });
    expect(refs.filter((r) => r.type === 'CONNECTOR_ANCHOR')).toEqual([]);
  });
});
