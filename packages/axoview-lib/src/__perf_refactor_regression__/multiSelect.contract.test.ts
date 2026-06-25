/**
 * REGRESSION — ADR-0006 multi-select selection contract
 *
 * Verifies the store-level invariant that ties selectedIds to itemControls:
 *  - selectedIds.length === 0 → itemControls null, panel closed
 *  - selectedIds.length === 1 → itemControls set to that single item; per
 *    ADR 0022 §3 this is SELECT-ONLY — it derives the panel TARGET but does
 *    NOT mount the Properties dock. The dock opens on the explicit
 *    double-click / setItemControls (openPanel) path.
 *  - selectedIds.length  > 1 → itemControls null (panel auto-hides), MQA #9
 *
 * Also covers the toggle behaviour from MQA #8 (Ctrl+click semantics) and the
 * convenience clearSelection action.
 *
 * Why a pure store test: every consumer of itemControls (NodePanel, ConnectorControls,
 * the two-way layer-row sync) depends on this invariant. If a future
 * change breaks it, the panel will either render with stale state (length > 1
 * showing one item's fields) or fail to mount on single-select — both are silent UX
 * regressions that wouldn't surface in a build but would visibly break the app.
 */

import { renderHook, act } from '@testing-library/react';
import React from 'react';
import {
  UiStateProvider,
  useUiStateStore
} from '../stores/uiStateStore';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(UiStateProvider, null, children);

const itemA = { type: 'ITEM' as const, id: 'a' };
const itemB = { type: 'ITEM' as const, id: 'b' };
const itemC = { type: 'ITEM' as const, id: 'c' };

describe('ADR-0006 — multi-select contract', () => {
  it('setSelectedIds([]) clears both slices', () => {
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    act(() => result.current.a.setSelectedIds([itemA]));
    expect(result.current.s.selectedIds).toHaveLength(1);
    expect(result.current.s.itemControls).toEqual({ type: 'ITEM', id: 'a' });

    act(() => result.current.a.setSelectedIds([]));
    expect(result.current.s.selectedIds).toHaveLength(0);
    expect(result.current.s.itemControls).toBeNull();
  });

  it('setSelectedIds([single]) selects only — panel does NOT mount (ADR 0022 §3)', () => {
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    act(() => result.current.a.setEditorMode('EDITABLE'));
    act(() => result.current.a.setSelectedIds([itemB]));
    expect(result.current.s.selectedIds).toEqual([itemB]);
    expect(result.current.s.itemControls).toEqual({ type: 'ITEM', id: 'b' });
    // Select-only: the Properties dock is NOT mounted on single-click.
    expect(result.current.s.rightSidebarOpen).toBe(false);
  });

  it('double-click path (setItemControls) opens the dock; >1 selection auto-hides it (MQA #9)', () => {
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    act(() => result.current.a.setEditorMode('EDITABLE'));
    // Open the panel via the explicit open path (double-click / layer-row
    // double-click) so we can prove auto-hide actually closes it on multi.
    act(() => result.current.a.setItemControls({ type: 'ITEM', id: 'a' }));
    expect(result.current.s.itemControls).not.toBeNull();
    expect(result.current.s.rightSidebarOpen).toBe(true);

    act(() => result.current.a.setSelectedIds([itemA, itemB, itemC]));
    expect(result.current.s.selectedIds).toHaveLength(3);
    expect(result.current.s.itemControls).toBeNull();
    expect(result.current.s.rightSidebarOpen).toBe(false);
  });

  it('setItemControls(openPanel:false) is select-only — dock stays put', () => {
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    act(() => result.current.a.setEditorMode('EDITABLE'));
    act(() =>
      result.current.a.setItemControls(
        { type: 'CONNECTOR', id: 'x', tile: { x: 1, y: 2 } },
        { openPanel: false }
      )
    );
    expect(result.current.s.selectedIds).toEqual([{ type: 'CONNECTOR', id: 'x' }]);
    expect(result.current.s.itemControls).toMatchObject({ type: 'CONNECTOR', id: 'x' });
    expect(result.current.s.rightSidebarOpen).toBe(false);
  });

  it('view mode: single selection does NOT auto-open the right dock (ADR 0012)', () => {
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    // Default store mode is EXPLORABLE_READONLY — info surfaces via the canvas
    // popover, so selection must not auto-open the editing dock.
    expect(result.current.s.editorMode).toBe('EXPLORABLE_READONLY');
    act(() => result.current.a.setSelectedIds([itemB]));
    expect(result.current.s.itemControls).toEqual({ type: 'ITEM', id: 'b' });
    expect(result.current.s.rightSidebarOpen).toBe(false);

    // Direct itemControls path (layer-row click) is likewise non-opening.
    act(() => result.current.a.setItemControls({ type: 'ITEM', id: 'c' }));
    expect(result.current.s.rightSidebarOpen).toBe(false);
  });

  it('toggleSelected adds when absent, removes when present', () => {
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    act(() => result.current.a.toggleSelected(itemA));
    expect(result.current.s.selectedIds).toEqual([itemA]);

    act(() => result.current.a.toggleSelected(itemB));
    expect(result.current.s.selectedIds).toEqual([itemA, itemB]);

    // Re-toggle itemA removes it (Figma / Sketch / VS Code Ctrl+click semantics)
    act(() => result.current.a.toggleSelected(itemA));
    expect(result.current.s.selectedIds).toEqual([itemB]);
    // Down to 1 — itemControls mirrors the single item (panel TARGET) per the
    // invariant, even though the dock isn't mounted (select-only, ADR 0022 §3).
    expect(result.current.s.itemControls).toEqual({ type: 'ITEM', id: 'b' });
  });

  it('clearSelection clears both slices regardless of starting length', () => {
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    act(() => result.current.a.setSelectedIds([itemA, itemB]));
    act(() => result.current.a.clearSelection());
    expect(result.current.s.selectedIds).toEqual([]);
    expect(result.current.s.itemControls).toBeNull();
  });

  it('setItemControls(single) keeps selectedIds coherent (layer-row click path)', () => {
    // Simulates a click on a layer-row, which routes through setItemControls directly.
    // The store must still keep selectedIds in sync so a subsequent Ctrl+click works
    // as expected (toggle relative to the layer-row selection).
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    act(() =>
      result.current.a.setItemControls({ type: 'ITEM', id: 'from-layer-row' })
    );
    expect(result.current.s.selectedIds).toEqual([
      { type: 'ITEM', id: 'from-layer-row' }
    ]);
  });
});
