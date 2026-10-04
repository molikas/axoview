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

describe('ViewRotationControls — pin toggle and reset (ADR 0051 §2–§3)', () => {
  const readout = () =>
    document.querySelector<HTMLButtonElement>(
      '[data-axoview-id="view-rotation-readout"]'
    )!;
  const animateTo = () =>
    (ui.actions as { animateViewRotationTo: jest.Mock }).animateViewRotationTo;

  beforeEach(() => {
    pageDefault = undefined;
    updateView.mockClear();
  });

  it('on a pinned default the pin shows pressed and clicking it unpins', () => {
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
  });

  it('off the default the pin is an unpressed "set" again', () => {
    pageDefault = 30;
    ui = baseUi({ viewRotation: 45, viewRotationBase: 45 });
    render(<ViewRotationControls />);
    expect(pin()!.getAttribute('aria-pressed')).toBe('false');
    expect(pin()!.getAttribute('aria-label')).toBe('setAsPageDefault');
    fireEvent.click(pin()!);
    expect(updateView).toHaveBeenCalledWith('v1', { defaultRotation: 45 });
  });

  it('reset goes to the page default when off it', () => {
    pageDefault = 30;
    ui = baseUi({ viewRotation: 75, viewRotationBase: 75 });
    render(<ViewRotationControls />);
    expect(readout().disabled).toBe(false);
    fireEvent.click(readout());
    expect(animateTo()).toHaveBeenCalledWith(30);
  });

  it('reset goes to 0° when the view is on a pinned default', () => {
    pageDefault = 30;
    ui = baseUi({ viewRotation: 30, viewRotationBase: 30 });
    render(<ViewRotationControls />);
    expect(readout().disabled).toBe(false);
    expect(readout().getAttribute('aria-label')).toBe('resetToZero');
    fireEvent.click(readout());
    expect(animateTo()).toHaveBeenCalledWith(0);
  });

  it('at 0° with no default there is nowhere to reset to and nothing to pin', () => {
    ui = baseUi({ viewRotation: 0, viewRotationBase: 0 });
    render(<ViewRotationControls />);
    expect(readout().disabled).toBe(true);
    expect(pin()!.disabled).toBe(true);
    expect(pin()!.getAttribute('aria-pressed')).toBe('false');
  });

  it('viewers still get the reset to 0° on a pinned default', () => {
    pageDefault = 30;
    ui = baseUi({
      editorMode: 'EXPLORABLE_READONLY',
      viewRotation: 30,
      viewRotationBase: 30
    });
    render(<ViewRotationControls />);
    expect(pin()).toBeNull();
    fireEvent.click(readout());
    expect(animateTo()).toHaveBeenCalledWith(0);
  });
});
