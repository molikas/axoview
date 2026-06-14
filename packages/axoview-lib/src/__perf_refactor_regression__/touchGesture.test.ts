/**
 * ADR 0018 — touch / pen gesture contract unit guards.
 *
 * Covers the three pure / reducer-level pieces of the SELECT → GRAB → PLACE
 * machine that can be tested without DOM pointer-capture semantics:
 *   1. the px tap-vs-pan classifier (acceptance criteria),
 *   2. the decideTouchTap decision function,
 *   3. the CARRY_ITEM mode (PLACE relocates to a free tile; abort is structural).
 *
 * The multi-pointer pan/pinch orchestration lives in the manager effect and is
 * covered by the e2e touch project (setPointerCapture has no synthetic-event
 * semantics, so it cannot be unit-tested here).
 */

import {
  TAP_SLOP_PX,
  exceedsTapSlop,
  isTapGesture
} from 'src/config/tapGesture';
import { decideTouchTap } from 'src/interaction/touchTap';
import { CarryItem } from 'src/interaction/modes/CarryItem';

// CarryItem imports findNearestUnoccupiedTilesForGroup from src/utils — exercise
// the real implementation against a tiny scene.
jest.mock('src/hooks/useScene', () => ({ useScene: jest.fn() }));

describe('tapGesture classifier (ADR 0018 Decision 5)', () => {
  it('a sub-slop delta is a tap, independent of tile size', () => {
    expect(exceedsTapSlop({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false); // ~7.07px
    expect(
      isTapGesture({
        downScreen: { x: 0, y: 0 },
        upScreen: { x: 5, y: 5 },
        downTime: 0,
        upTime: 100
      })
    ).toBe(true);
  });

  it('a delta beyond the slop radius is a drag/pan', () => {
    expect(exceedsTapSlop({ x: 0, y: 0 }, { x: TAP_SLOP_PX + 2, y: 0 })).toBe(
      true
    );
    expect(
      isTapGesture({
        downScreen: { x: 0, y: 0 },
        upScreen: { x: TAP_SLOP_PX + 2, y: 0 },
        downTime: 0,
        upTime: 100
      })
    ).toBe(false);
  });

  it('a too-slow stationary press is not a tap (time bound)', () => {
    expect(
      isTapGesture({
        downScreen: { x: 0, y: 0 },
        upScreen: { x: 1, y: 1 },
        downTime: 0,
        upTime: 10_000
      })
    ).toBe(false);
  });
});

describe('decideTouchTap (SELECT → GRAB → PLACE)', () => {
  const nodeRef = { type: 'ITEM' as const, id: 'n1' };

  it('grabs when tapping the sole already-selected node again', () => {
    expect(
      decideTouchTap({
        modeType: 'CURSOR',
        tappedItem: nodeRef,
        selectedIds: [nodeRef],
        isInteractable: true
      })
    ).toBe('grab');
  });

  it('selects (no grab) on the first tap of an unselected node', () => {
    expect(
      decideTouchTap({
        modeType: 'CURSOR',
        tappedItem: nodeRef,
        selectedIds: [],
        isInteractable: true
      })
    ).toBe('select');
  });

  it('selects (no grab) when a different node is the current selection', () => {
    expect(
      decideTouchTap({
        modeType: 'CURSOR',
        tappedItem: nodeRef,
        selectedIds: [{ type: 'ITEM', id: 'other' }],
        isInteractable: true
      })
    ).toBe('select');
  });

  it('never grabs a non-interactable (locked/hidden) node — I-1', () => {
    expect(
      decideTouchTap({
        modeType: 'CURSOR',
        tappedItem: nodeRef,
        selectedIds: [nodeRef],
        isInteractable: false
      })
    ).toBe('select');
  });

  it('places whenever a node is being carried, regardless of the tap target', () => {
    expect(
      decideTouchTap({
        modeType: 'CARRY_ITEM',
        tappedItem: null,
        selectedIds: [nodeRef],
        isInteractable: false
      })
    ).toBe('place');
  });

  it('does not grab a selected connector/textbox (carry is node-only)', () => {
    const connectorRef = { type: 'CONNECTOR' as const, id: 'c1' };
    expect(
      decideTouchTap({
        modeType: 'CURSOR',
        tappedItem: connectorRef,
        selectedIds: [connectorRef],
        isInteractable: true
      })
    ).toBe('select');
  });
});

describe('CarryItem mode — PLACE + abort', () => {
  const makeScene = (items: { id: string; tile: { x: number; y: number } }[]) => ({
    items,
    connectors: [],
    rectangles: [],
    textBoxes: [],
    hitConnectors: [],
    currentView: { items, connectors: [] },
    beginDragTransaction: jest.fn(),
    commitDragTransaction: jest.fn(),
    updateViewItem: jest.fn()
  });

  const makeState = (scene: ReturnType<typeof makeScene>, tapTile: { x: number; y: number }) => {
    const actions = {
      setMode: jest.fn(),
      setSelectedIds: jest.fn(),
      setItemControls: jest.fn()
    };
    return {
      uiState: {
        mode: { type: 'CARRY_ITEM', showCursor: true, item: { type: 'ITEM', id: 'n1' } },
        mouse: { position: { tile: tapTile, screen: { x: 0, y: 0 } }, mousedown: null, delta: null },
        actions
      },
      scene,
      isRendererInteraction: true,
      actions
    };
  };

  it('relocates the carried node to the tapped (free) tile in one transaction and returns to SELECT', () => {
    const scene = makeScene([{ id: 'n1', tile: { x: 0, y: 0 } }]);
    const state = makeState(scene, { x: 4, y: 4 });
    CarryItem.mouseup!(state as never);

    expect(scene.beginDragTransaction).toHaveBeenCalledTimes(1);
    expect(scene.updateViewItem).toHaveBeenCalledWith('n1', { tile: { x: 4, y: 4 } });
    expect(scene.commitDragTransaction).toHaveBeenCalledTimes(1);
    // Back to CURSOR (SELECT) with the node reselected at its new location.
    expect(state.uiState.actions.setMode).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CURSOR' })
    );
    expect(state.uiState.actions.setSelectedIds).toHaveBeenCalledWith([
      { type: 'ITEM', id: 'n1' }
    ]);
  });

  it('does nothing when not in CARRY_ITEM (guard)', () => {
    const scene = makeScene([{ id: 'n1', tile: { x: 0, y: 0 } }]);
    const state = makeState(scene, { x: 4, y: 4 });
    state.uiState.mode = { type: 'CURSOR' } as never;
    CarryItem.mouseup!(state as never);
    expect(scene.updateViewItem).not.toHaveBeenCalled();
    expect(scene.beginDragTransaction).not.toHaveBeenCalled();
  });

  it('PLACE never writes the model when the tap is not a renderer interaction', () => {
    const scene = makeScene([{ id: 'n1', tile: { x: 0, y: 0 } }]);
    const state = makeState(scene, { x: 4, y: 4 });
    state.isRendererInteraction = false;
    CarryItem.mouseup!(state as never);
    expect(scene.updateViewItem).not.toHaveBeenCalled();
  });
});
