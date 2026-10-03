/**
 * View rotation lives in each instance's uiState (ADR 0049 §1).
 *
 * The POC kept θ in a module global that every new store reset to 0 — so the
 * export dialog's hidden <Axoview> zeroed the live canvas's projection (finding
 * F1). These pin the per-instance model: two stores rotate and pick
 * independently, motion moves only the live angle, settle catches the base up,
 * and step animations land exactly on the lattice.
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { UiStateProvider, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { getLiveStrategy } from 'src/utils/coordinateTransforms';
import { UNPROJECTED_TILE_SIZE } from 'src/config';

const Providers = ({ children }: { children: React.ReactNode }) => (
  <UiStateProvider>{children}</UiStateProvider>
);

const setup = () =>
  renderHook(() => useUiStateStoreApi(), { wrapper: Providers }).result
    .current;

const setIso = (api: ReturnType<typeof setup>) =>
  act(() => {
    api.getState().actions.setCanvasMode('ISOMETRIC');
    api.getState().actions.setRendererSize({ width: 800, height: 600 });
  });

describe('uiState view rotation (ADR 0049)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('two stores rotate and project independently', () => {
    const a = setup();
    const b = setup();
    setIso(a);
    setIso(b);
    act(() => a.getState().actions.setViewRotation(60));
    expect(a.getState().viewRotation).toBe(60);
    expect(b.getState().viewRotation).toBe(0);
    // A FRESH store must not reset another's angle (the POC's export-dialog bug).
    setup();
    expect(a.getState().viewRotation).toBe(60);

    // ...and they pick independently: the same screen point resolves to
    // different tiles under different angles.
    const sa = getLiveStrategy(a.getState());
    const sb = getLiveStrategy(b.getState());
    expect(sa.rotation).toBe(60);
    expect(sb.rotation).toBe(0);
    const p = sb.toScreen(3, -2, UNPROJECTED_TILE_SIZE);
    const back = sa.fromCanvasPoint(p.x, p.y, UNPROJECTED_TILE_SIZE);
    expect(Math.round(back.x) === 3 && Math.round(back.y) === -2).toBe(false);
  });

  it('outside motion a change also settles; inside motion only the live angle moves', () => {
    const api = setup();
    setIso(api);
    act(() => api.getState().actions.setViewRotation(30));
    expect(api.getState().viewRotationBase).toBe(30);

    act(() => api.getState().actions.beginViewRotationMotion());
    act(() => api.getState().actions.setViewRotation(42));
    expect(api.getState().viewRotation).toBe(42);
    expect(api.getState().viewRotationBase).toBe(30);
    expect(api.getState().viewRotationInMotion).toBe(true);

    act(() => api.getState().actions.rebaseViewRotation());
    expect(api.getState().viewRotationBase).toBe(42);
    expect(api.getState().viewRotationInMotion).toBe(true);

    act(() => api.getState().actions.setViewRotation(50));
    act(() => api.getState().actions.settleViewRotation());
    expect(api.getState().viewRotationBase).toBe(50);
    expect(api.getState().viewRotationInMotion).toBe(false);
  });

  it('keeps the viewport centre over the same tile', () => {
    const api = setup();
    setIso(api);
    act(() =>
      api.getState().actions.setScroll({
        position: { x: 210, y: -80 },
        offset: { x: 0, y: 0 }
      })
    );
    act(() => api.getState().actions.setZoom(1.5));
    const before = getLiveStrategy(api.getState());
    const s0 = api.getState().scroll.position;
    const z = api.getState().zoom;
    const tile0 = before.fromCanvasPoint(-s0.x / z, -s0.y / z, UNPROJECTED_TILE_SIZE);
    act(() => api.getState().actions.setViewRotation(-75));
    const after = getLiveStrategy(api.getState());
    const s1 = api.getState().scroll.position;
    const tile1 = after.fromCanvasPoint(-s1.x / z, -s1.y / z, UNPROJECTED_TILE_SIZE);
    expect(tile1.x).toBeCloseTo(tile0.x, 9);
    expect(tile1.y).toBeCloseTo(tile0.y, 9);
  });

  it('in 2D θ is retained but moves nothing', () => {
    const api = setup();
    act(() => api.getState().actions.setCanvasMode('2D'));
    const scroll = api.getState().scroll;
    act(() => api.getState().actions.setViewRotation(45));
    expect(api.getState().viewRotation).toBe(45);
    expect(api.getState().scroll).toBe(scroll);
    expect(getLiveStrategy(api.getState()).rotation).toBe(0);
  });

  it('re-resolves the pointer tile when the view settles (paste targets it)', () => {
    const api = setup();
    setIso(api);
    act(() =>
      api.getState().actions.setMouse({
        position: { screen: { x: 650, y: 140 }, tile: { x: 0, y: 0 } },
        mousedown: null,
        delta: null
      })
    );
    act(() => api.getState().actions.setViewRotation(90));
    const s = getLiveStrategy(api.getState());
    const st = api.getState();
    const expected = s.fromScreen(
      650,
      140,
      UNPROJECTED_TILE_SIZE,
      st.zoom,
      st.scroll,
      st.rendererSize
    );
    expect(st.mouse.position.tile).toEqual(expected);
  });

  it('a step animation lands EXACTLY on the lattice and settles', () => {
    jest.useFakeTimers();
    const api = setup();
    setIso(api);
    act(() => api.getState().actions.setViewRotation(80));
    act(() => api.getState().actions.stepViewRotation(1));
    expect(api.getState().viewRotationInMotion).toBe(true);
    // A second press DURING the tween chains from its target (90 → 105).
    act(() => api.getState().actions.stepViewRotation(1));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(api.getState().viewRotation).toBe(105);
    expect(api.getState().viewRotationBase).toBe(105);
    expect(api.getState().viewRotationInMotion).toBe(false);
  });

  it('a canvas press completes an in-flight animation first', () => {
    jest.useFakeTimers();
    const api = setup();
    setIso(api);
    act(() => api.getState().actions.stepViewRotation(-1, true)); // → −90
    act(() => api.getState().actions.finishViewRotationAnimation());
    expect(api.getState().viewRotation).toBe(-90);
    expect(api.getState().viewRotationBase).toBe(-90);
    expect(api.getState().viewRotationInMotion).toBe(false);
  });

  it('is instant under prefers-reduced-motion', () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    })) as unknown as typeof window.matchMedia;
    try {
      const api = setup();
      setIso(api);
      act(() => api.getState().actions.animateViewRotationTo(135));
      expect(api.getState().viewRotation).toBe(135);
      expect(api.getState().viewRotationInMotion).toBe(false);
    } finally {
      window.matchMedia = original;
    }
  });
});
