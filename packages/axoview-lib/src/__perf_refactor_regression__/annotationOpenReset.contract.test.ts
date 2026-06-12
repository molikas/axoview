/**
 * REGRESSION — opening the annotation overlay resets the canvas tool (ADR 0014).
 *
 * Bug: in edit mode, arming a tool (e.g. the connector) and then opening the
 * annotation pen left that tool active behind the overlay — the toolbar still
 * showed it selected, and it resumed the moment annotation went pass-through or
 * closed. Opening annotation must drop any armed tool and clear the active
 * selection / floating action bar (the right dock only closes if auto-opened).
 */

import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { UiStateProvider, useUiStateStore } from '../stores/uiStateStore';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(UiStateProvider, null, children);

const setup = () =>
  renderHook(() => useUiStateStore((s) => ({ s, a: s.actions })), { wrapper });

describe('annotation open — canvas tool reset', () => {
  it('resets an armed CONNECTOR tool to CURSOR (EDITABLE) on open', () => {
    const { result } = setup();
    act(() => result.current.a.setEditorMode('EDITABLE'));
    act(() =>
      result.current.a.setMode({ type: 'CONNECTOR', id: null, showCursor: true })
    );
    expect(result.current.s.mode.type).toBe('CONNECTOR');

    act(() => result.current.a.setAnnotationOpen(true));
    expect(result.current.s.annotation.open).toBe(true);
    expect(result.current.s.mode.type).toBe('CURSOR');
  });

  it('clears the active selection + action bar on open', () => {
    const { result } = setup();
    act(() => result.current.a.setEditorMode('EDITABLE'));
    act(() => result.current.a.setSelectedIds([{ type: 'CONNECTOR', id: 'c1' }]));
    expect(result.current.s.itemControls).not.toBeNull();

    act(() => result.current.a.setAnnotationOpen(true));
    expect(result.current.s.itemControls).toBeNull();
    expect(result.current.s.selectedIds).toHaveLength(0);
    expect(result.current.s.itemActionBarOpen).toBe(false);
  });

  it('resets to the mode-appropriate default in preview (PAN)', () => {
    const { result } = setup();
    act(() => result.current.a.setEditorMode('EXPLORABLE_READONLY'));
    act(() => result.current.a.setMode({ type: 'CURSOR', showCursor: true, mousedownItem: null }));

    act(() => result.current.a.setAnnotationOpen(true));
    expect(result.current.s.mode.type).toBe('PAN');
  });

  it('closing the overlay does NOT touch the canvas mode', () => {
    const { result } = setup();
    act(() => result.current.a.setEditorMode('EDITABLE'));
    act(() => result.current.a.setAnnotationOpen(true)); // mode → CURSOR
    act(() =>
      result.current.a.setMode({ type: 'PAN', showCursor: false })
    );
    act(() => result.current.a.setAnnotationOpen(false));
    expect(result.current.s.mode.type).toBe('PAN');
  });
});
