/**
 * The view-rotation dock widget must not flicker while the view turns.
 *
 * The "set as page default" pin used to be mounted only while the angle was
 * off the default AND not in motion, so every step animation unmounted it and
 * remounted it at settle — the dock reflowed twice per Q / E press. It is now
 * mounted for editors throughout and disabled in place, keyed to the SETTLED
 * angle, so it changes state once per gesture.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewRotationControls } from '../ViewRotationControls';

jest.mock('src/stores/localeStore', () => ({
  useTranslation: () => ({ t: (k: string) => k })
}));

const updateView = jest.fn();
jest.mock('src/hooks/useScene', () => ({ useScene: () => ({ updateView }) }));

let pageDefault: number | undefined;
jest.mock('src/stores/modelStore', () => ({
  useModelStore: (selector: (s: unknown) => unknown) =>
    selector({ views: [{ id: 'v1', defaultRotation: pageDefault }] })
}));

const finishViewRotationAnimation = jest.fn();
let ui: Record<string, unknown>;
jest.mock('src/stores/uiStateStore', () => ({
  useUiStateStore: (selector: (s: unknown) => unknown) => selector(ui),
  useUiStateStoreApi: () => ({ getState: () => ui })
}));

const baseUi = (over: Record<string, unknown> = {}) => ({
  actions: {
    stepViewRotation: jest.fn(),
    animateViewRotationTo: jest.fn(),
    setNotification: jest.fn(),
    finishViewRotationAnimation
  },
  canvasMode: 'ISOMETRIC',
  editorMode: 'EDITABLE',
  view: 'v1',
  viewRotation: 15,
  viewRotationBase: 15,
  viewRotationInMotion: false,
  ...over
});

const pin = () =>
  document.querySelector<HTMLButtonElement>(
    '[data-axoview-id="view-rotation-set-default"]'
  );

describe('ViewRotationControls — no flicker while turning', () => {
  beforeEach(() => {
    pageDefault = undefined;
    updateView.mockClear();
    finishViewRotationAnimation.mockClear();
  });

  it('keeps the pin mounted and enabled through a step animation', () => {
    ui = baseUi();
    const { rerender } = render(<ViewRotationControls />);
    expect(pin()).not.toBeNull();
    expect(pin()!.disabled).toBe(false);

    // Every frame of a 15° → 30° step.
    for (const live of [17, 22, 27, 29.9]) {
      ui = baseUi({ viewRotation: live, viewRotationInMotion: true });
      rerender(<ViewRotationControls />);
      expect(pin()).not.toBeNull();
      expect(pin()!.disabled).toBe(false);
    }
    ui = baseUi({ viewRotation: 30, viewRotationBase: 30 });
    rerender(<ViewRotationControls />);
    expect(pin()!.disabled).toBe(false);
  });

  it('is disabled (not removed) at the default, and stays so until settle', () => {
    ui = baseUi({ viewRotation: 0, viewRotationBase: 0 });
    const { rerender } = render(<ViewRotationControls />);
    expect(pin()).not.toBeNull();
    expect(pin()!.disabled).toBe(true);

    // Stepping away from the default: one state change, at settle.
    ui = baseUi({
      viewRotation: 7,
      viewRotationBase: 0,
      viewRotationInMotion: true
    });
    rerender(<ViewRotationControls />);
    expect(pin()!.disabled).toBe(true);
    ui = baseUi({ viewRotation: 15, viewRotationBase: 15 });
    rerender(<ViewRotationControls />);
    expect(pin()!.disabled).toBe(false);
  });

  it('an orbit sweeping across the default does not toggle it', () => {
    pageDefault = 30;
    ui = baseUi({ viewRotation: 10, viewRotationBase: 10 });
    const { rerender } = render(<ViewRotationControls />);
    for (const live of [20, 29.96, 30, 30.04, 40]) {
      ui = baseUi({
        viewRotation: live,
        viewRotationBase: 10,
        viewRotationInMotion: true
      });
      rerender(<ViewRotationControls />);
      expect(pin()!.disabled).toBe(false);
    }
  });

  it('a click mid-step saves the angle the step lands on', () => {
    ui = baseUi({
      viewRotation: 22,
      viewRotationBase: 15,
      viewRotationInMotion: true
    });
    finishViewRotationAnimation.mockImplementation(() => {
      ui = baseUi({ viewRotation: 30, viewRotationBase: 30 });
    });
    render(<ViewRotationControls />);
    fireEvent.click(pin()!);
    expect(finishViewRotationAnimation).toHaveBeenCalledTimes(1);
    expect(updateView).toHaveBeenCalledWith('v1', { defaultRotation: 30 });
  });

  it('viewers get no pin at all', () => {
    ui = baseUi({ editorMode: 'EXPLORABLE_READONLY' });
    render(<ViewRotationControls />);
    expect(pin()).toBeNull();
    expect(screen.getByRole('group')).toBeTruthy();
  });
});

describe('ViewRotationControls — pin toggle, reset and readout (UX review 2026-10-03)', () => {
  const readout = () =>
    document.querySelector<HTMLButtonElement>(
      '[data-axoview-id="view-rotation-readout"]'
    )!;
  const acts = () =>
    ui.actions as {
      animateViewRotationTo: jest.Mock;
      setNotification: jest.Mock;
    };

  beforeEach(() => {
    pageDefault = undefined;
    updateView.mockClear();
  });

  it('on a pinned default the pin shows pressed, unpins, and says so', () => {
    pageDefault = 30;
    ui = baseUi({ viewRotation: 30, viewRotationBase: 30 });
    render(<ViewRotationControls />);
    expect(pin()!.getAttribute('aria-pressed')).toBe('true');
    expect(pin()!.disabled).toBe(false);
    expect(pin()!.getAttribute('aria-label')).toBe('unpinPageDefault');
    fireEvent.click(pin()!);
    // The field goes: the page opens at 0° again. One UPDATE_VIEW = one undo.
    expect(updateView).toHaveBeenCalledTimes(1);
    expect(updateView).toHaveBeenCalledWith('v1', {
      defaultRotation: undefined
    });
    expect(acts().setNotification).toHaveBeenCalledWith({
      message: 'unpinnedNotice',
      severity: 'info'
    });
  });

  it('pinning confirms the shared change in words', () => {
    pageDefault = 30;
    ui = baseUi({ viewRotation: 45, viewRotationBase: 45 });
    render(<ViewRotationControls />);
    expect(pin()!.getAttribute('aria-pressed')).toBe('false');
    expect(pin()!.getAttribute('aria-label')).toBe('setAsPageDefault');
    fireEvent.click(pin()!);
    expect(updateView).toHaveBeenCalledWith('v1', { defaultRotation: 45 });
    expect(acts().setNotification).toHaveBeenCalledWith({
      message: 'pinnedNotice',
      severity: 'success'
    });
  });

  it('reset has ONE target — the page default — and is disabled once there', () => {
    pageDefault = -30;
    ui = baseUi({ viewRotation: 15, viewRotationBase: 15 });
    const { rerender } = render(<ViewRotationControls />);
    expect(readout().disabled).toBe(false);
    fireEvent.click(readout());
    expect(acts().animateViewRotationTo).toHaveBeenCalledWith(-30);
    // Landed on the pinned default: a second click has nowhere else to go
    // (the reviewer's double-click ended at 0° because it used to).
    ui = baseUi({ viewRotation: -30, viewRotationBase: -30 });
    rerender(<ViewRotationControls />);
    expect(readout().disabled).toBe(true);
    expect(readout().getAttribute('aria-label')).toBe('atDefault');
  });

  it('after unpinning, reset goes to 0°', () => {
    ui = baseUi({ viewRotation: -30, viewRotationBase: -30 });
    render(<ViewRotationControls />);
    fireEvent.click(readout());
    expect(acts().animateViewRotationTo).toHaveBeenCalledWith(0);
  });

  it('the readout counts clockwise as positive (a bearing)', () => {
    // θ −30 is the floor turned clockwise twice with E.
    ui = baseUi({ viewRotation: -30, viewRotationBase: -30 });
    const { rerender } = render(<ViewRotationControls />);
    expect(readout().textContent).toBe('30°');
    ui = baseUi({ viewRotation: 15, viewRotationBase: 15 });
    rerender(<ViewRotationControls />);
    expect(readout().textContent).toBe('-15°');
    ui = baseUi({ viewRotation: 180, viewRotationBase: 180 });
    rerender(<ViewRotationControls />);
    expect(readout().textContent).toBe('180°');
  });

  it('at 0° with no default there is nowhere to reset to and nothing to pin', () => {
    ui = baseUi({ viewRotation: 0, viewRotationBase: 0 });
    render(<ViewRotationControls />);
    expect(readout().disabled).toBe(true);
    expect(pin()!.disabled).toBe(true);
    expect(pin()!.getAttribute('aria-pressed')).toBe('false');
  });
});
