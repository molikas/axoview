/**
 * CONTRACT — the two label hit-proxies handle pointers identically.
 *
 * Why this exists: bug #7 of the ADR 0023 off-grid cluster. `LabelHitLayer`
 * (floating labels) and `NodeLabelHitLayer` (node name chips) are siblings that
 * do the same job over two different paint layers, and they drifted: the node
 * layer swallowed a right-click, so right-clicking a node's label opened nothing
 * while right-clicking a floating label opened its item menu. Sibling drift is
 * invisible unless something tests the two against the SAME expectations — that
 * is this file.
 *
 * Both proxies render `[data-axoview-id="canvas-label-hit"]`, so every case here
 * is written once and run against both layers.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import type { Coords } from 'src/types';

// jsdom has no PointerEvent, and without it RTL falls back to a bare Event —
// which silently drops `button`, so EVERY press would read as `undefined` and
// the button guard under test would appear to hold for the wrong reason.
class TestPointerEvent extends MouseEvent {
  constructor(type: string, params: PointerEventInit = {}) {
    super(type, params);
  }
}
(window as unknown as { PointerEvent: unknown }).PointerEvent = TestPointerEvent;

jest.mock('src/contexts/CanvasModeContext', () => {
  const actual = jest.requireActual('src/utils/coordinateTransforms');
  const strategy = actual.isometricStrategy;
  return {
    useCanvasMode: () => ({
      strategy,
      getTilePosition: actual.makeTilePositionFn(strategy),
      screenToTile: () => ({ x: 0, y: 0 }),
      getProjectionCss: () => ''
    })
  };
});

const actions = {
  setItemControls: jest.fn(),
  setInlineEditLabelId: jest.fn(),
  setViewModeHoveredLabelId: jest.fn(),
  openContextMenu: jest.fn(),
  setLabelMove: jest.fn(),
  clearLabelMove: jest.fn(),
  setLabelDrag: jest.fn(),
  clearLabelDrag: jest.fn()
};

const uiState = {
  zoom: 1,
  editorMode: 'EDITABLE',
  inlineEditLabelId: null as string | null,
  viewModeHoveredLabelId: null as string | null,
  actions
};

jest.mock('src/stores/uiStateStore', () => ({
  useUiStateStore: (selector: (s: unknown) => unknown) => selector(uiState),
  useUiStateStoreApi: () => ({
    getState: () => uiState,
    setState: () => {},
    subscribe: () => () => {}
  })
}));

jest.mock('src/stores/modelStore', () => ({
  useModelStore: (selector: (s: unknown) => unknown) =>
    selector({ items: [{ id: 'n1', name: 'Node one' }] })
}));

jest.mock('src/hooks/useLayerContext', () => ({
  useLayerContext: () => ({
    visibleIds: new Set<string>(),
    lockedIds: new Set<string>()
  })
}));

jest.mock('src/hooks/useSceneActions', () => ({
  useSceneActions: () => ({ updateLabel: jest.fn(), updateViewItem: jest.fn() })
}));

jest.mock('src/hooks/useInlineRename', () => ({
  useInlineRename: () => ({ setRef: () => {}, onKeyDown: () => {} })
}));

/* eslint-disable import/first */
import { LabelHitLayer } from 'src/components/SceneLayers/Labels/LabelHitLayer';
import { NodeLabelHitLayer } from 'src/components/SceneLayers/Nodes/NodeLabelHitLayer';
/* eslint-enable import/first */

const TILE: Coords = { x: 1, y: 1 };

const LAYERS: {
  name: string;
  render: () => ReturnType<typeof render>;
}[] = [
  {
    name: 'LabelHitLayer (floating label)',
    render: () =>
      render(
        <LabelHitLayer
          labels={
            [
              { id: 'l1', text: 'Floating', tile: TILE, offset: { x: 12, y: -7 } }
            ] as never
          }
        />
      )
  },
  {
    name: 'NodeLabelHitLayer (node name chip)',
    render: () =>
      render(
        <NodeLabelHitLayer
          nodes={
            [
              {
                id: 'n1',
                tile: TILE,
                offset: { x: 12, y: -7 },
                showLabel: true,
                labelHeight: 40
              }
            ] as never
          }
        />
      )
  }
];

describe.each(LAYERS)('label pointer contract — $name', ({ render: mount }) => {
  let addSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    addSpy = jest.spyOn(window, 'addEventListener');
  });

  afterEach(() => {
    addSpy.mockRestore();
  });

  const proxy = (container: HTMLElement): HTMLElement => {
    const el = container.querySelector<HTMLElement>(
      '[data-axoview-id="canvas-label-hit"]'
    );
    expect(el).not.toBeNull();
    return el!;
  };

  const movesArmed = () =>
    addSpy.mock.calls.some(([type]) => type === 'pointermove');

  it('a PRIMARY press arms the label move gesture', () => {
    const { container } = mount();
    fireEvent.pointerDown(proxy(container), { button: 0 });
    expect(movesArmed()).toBe(true);
  });

  it('a RIGHT press does NOT arm the move gesture (menu owns it)', () => {
    const { container } = mount();
    fireEvent.pointerDown(proxy(container), { button: 2 });
    expect(movesArmed()).toBe(false);
  });

  it('a MIDDLE press does NOT arm the move gesture', () => {
    const { container } = mount();
    fireEvent.pointerDown(proxy(container), { button: 1 });
    expect(movesArmed()).toBe(false);
  });
});
