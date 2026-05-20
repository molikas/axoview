/**
 * REGRESSION — ADR-0006 multi-select selection contract
 *
 * Verifies the store-level invariant that ties selectedIds to itemControls:
 *  - selectedIds.length === 0 → itemControls null, panel closed
 *  - selectedIds.length === 1 → itemControls set to that single item, panel opens
 *  - selectedIds.length  > 1 → itemControls null (panel auto-hides), MQA #9
 *
 * Also covers the toggle behaviour from MQA #8 (Ctrl+click semantics) and the
 * convenience clearSelection action.
 *
 * Why a pure store test: every consumer of itemControls (NodePanel, ConnectorControls,
 * NodeActionBar, the two-way layer-row sync) depends on this invariant. If a future
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

  it('setSelectedIds([single]) sets itemControls to that single item', () => {
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    act(() => result.current.a.setSelectedIds([itemB]));
    expect(result.current.s.selectedIds).toEqual([itemB]);
    expect(result.current.s.itemControls).toEqual({ type: 'ITEM', id: 'b' });
    expect(result.current.s.rightSidebarOpen).toBe(true);
  });

  it('setSelectedIds([>1 items]) hides the panel (MQA #9 auto-hide)', () => {
    const { result } = renderHook(
      () => useUiStateStore((s) => ({ s, a: s.actions })),
      { wrapper }
    );
    // First open the panel via a single selection so we can prove auto-hide
    // actually closes it on transition to multi.
    act(() => result.current.a.setSelectedIds([itemA]));
    expect(result.current.s.itemControls).not.toBeNull();
    expect(result.current.s.rightSidebarOpen).toBe(true);

    act(() => result.current.a.setSelectedIds([itemA, itemB, itemC]));
    expect(result.current.s.selectedIds).toHaveLength(3);
    expect(result.current.s.itemControls).toBeNull();
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
    // Down to 1 — panel should re-open per the invariant
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
