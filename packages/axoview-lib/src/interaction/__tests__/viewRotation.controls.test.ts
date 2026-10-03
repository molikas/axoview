/**
 * View-rotation input routes (ADR 0049 §7): Q/E and the Alt+drag orbit mode.
 */
import { handleViewRotationKeys } from '../handleViewRotationKeys';
import { ViewRotate, orbitAngle, ORBIT_DEG_PER_PX } from '../modes/ViewRotate';
import {
  CANVAS_KEYBOARD_SURFACES,
  canUseKeyboardSurface
} from '../readonlyPolicy';

const key = (k: string, mods: Partial<KeyboardEvent> = {}) =>
  ({
    key: k,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault: jest.fn(),
    ...mods
  }) as unknown as KeyboardEvent;

describe('Q / E', () => {
  const ui = (canvasMode: 'ISOMETRIC' | '2D' = 'ISOMETRIC') => ({
    canvasMode,
    actions: { stepViewRotation: jest.fn() }
  });

  it('Q steps counter-clockwise (+), E clockwise (−); Shift goes cardinal', () => {
    const u = ui();
    expect(handleViewRotationKeys(key('q'), u as never, true)).toBe(true);
    expect(u.actions.stepViewRotation).toHaveBeenLastCalledWith(1, false);
    expect(handleViewRotationKeys(key('E', { shiftKey: true }), u as never, true)).toBe(true);
    expect(u.actions.stepViewRotation).toHaveBeenLastCalledWith(-1, true);
  });

  it('leaves chords, other keys and the 2D view alone', () => {
    const u = ui();
    expect(handleViewRotationKeys(key('q', { ctrlKey: true }), u as never, true)).toBe(false);
    expect(handleViewRotationKeys(key('q', { altKey: true }), u as never, true)).toBe(false);
    expect(handleViewRotationKeys(key('w'), u as never, true)).toBe(false);
    const flat = ui('2D');
    expect(handleViewRotationKeys(key('q'), flat as never, true)).toBe(false);
    expect(flat.actions.stepViewRotation).not.toHaveBeenCalled();
  });

  it('is a VIEWER surface — it works in every interactive mode', () => {
    expect(CANVAS_KEYBOARD_SURFACES.viewRotation).toBe('viewer');
    expect(canUseKeyboardSurface('viewRotation', 'EXPLORABLE_READONLY')).toBe(true);
    expect(canUseKeyboardSurface('viewRotation', 'EDITABLE')).toBe(true);
  });
});

describe('the Alt + drag orbit', () => {
  it('turns ~0.4° per horizontal px, right = θ up; Shift snaps to 15°', () => {
    expect(ORBIT_DEG_PER_PX).toBeCloseTo(0.4);
    expect(orbitAngle(10, 100, 150, false)).toBeCloseTo(30);
    expect(orbitAngle(10, 100, 50, false)).toBeCloseTo(-10);
    expect(orbitAngle(10, 100, 150, true)).toBe(30);
    expect(orbitAngle(10, 100, 120, true)).toBe(15);
  });

  const makeUi = (overrides: Record<string, unknown> = {}) => ({
    mode: {
      type: 'VIEW_ROTATE',
      showCursor: false,
      startScreenX: 100,
      startRotation: 0,
      returnTo: 'CURSOR'
    },
    viewRotationBase: 0,
    mouse: { position: { screen: { x: 100, y: 0 } }, modifiers: {} },
    actions: {
      beginViewRotationMotion: jest.fn(),
      setViewRotation: jest.fn(),
      rebaseViewRotation: jest.fn(),
      settleViewRotation: jest.fn(),
      setMode: jest.fn()
    },
    ...overrides
  });

  it('enters motion, follows the pointer, and settles + returns on release', () => {
    const ui = makeUi();
    ViewRotate.entry?.({ uiState: ui } as never);
    expect(ui.actions.beginViewRotationMotion).toHaveBeenCalled();

    ui.mouse.position.screen.x = 160;
    ViewRotate.mousemove?.({ uiState: ui } as never);
    expect(ui.actions.setViewRotation).toHaveBeenLastCalledWith(24);

    ViewRotate.mouseup?.({ uiState: ui } as never);
    expect(ui.actions.settleViewRotation).toHaveBeenCalled();
    expect(ui.actions.setMode).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'CURSOR' })
    );
  });

  it('returns a viewer to PAN', () => {
    const ui = makeUi();
    (ui.mode as { returnTo: string }).returnTo = 'PAN';
    ViewRotate.mouseup?.({ uiState: ui } as never);
    expect(ui.actions.setMode).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: 'PAN' })
    );
  });

  it('re-baselines at a bounded interval on a long orbit, never per frame', () => {
    const ui = makeUi();
    let t = 1000;
    jest.spyOn(performance, 'now').mockImplementation(() => t);
    try {
      ViewRotate.entry?.({ uiState: ui } as never);
      // 60° away, but within the interval of the entry: no rebase yet.
      ui.mouse.position.screen.x = 100 + 60 / ORBIT_DEG_PER_PX;
      t = 1100;
      ViewRotate.mousemove?.({ uiState: ui } as never);
      expect(ui.actions.rebaseViewRotation).not.toHaveBeenCalled();
      // Past the interval: one rebase.
      t = 1600;
      ViewRotate.mousemove?.({ uiState: ui } as never);
      expect(ui.actions.rebaseViewRotation).toHaveBeenCalledTimes(1);
      // Next frame, still far from the (stale snapshot) base: interval holds.
      t = 1616;
      ViewRotate.mousemove?.({ uiState: ui } as never);
      expect(ui.actions.rebaseViewRotation).toHaveBeenCalledTimes(1);
    } finally {
      (performance.now as jest.Mock).mockRestore();
    }
  });

  it('settles on exit (Escape, a lost release)', () => {
    const ui = makeUi();
    ViewRotate.exit?.({ uiState: ui } as never);
    expect(ui.actions.settleViewRotation).toHaveBeenCalled();
  });
});
