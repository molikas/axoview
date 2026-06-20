import { resolveToolHotkey } from '../toolHotkeys';
import { TOOL_HOTKEYS } from 'src/config/hotkeys';
import type { HotkeyMapping } from 'src/types/settings';

// T1 #17 — Ctrl/Cmd + a tool letter must NOT resolve to a tool. In the fixed
// scheme the connector tool is bound to "c", so before the guard Ctrl+C (copy)
// also switched to the connector tool. Ctrl+X / Ctrl+V never bound to a tool but
// are covered here too for the regression contract.
//
// The hotkey-profile machinery was removed (ADR 0022 §6) — TOOL_HOTKEYS is the
// single fixed mapping. The guard is still mapping-independent (it short-circuits
// before the lookup), proven below with an inline custom mapping.
describe('resolveToolHotkey', () => {
  const allNull: HotkeyMapping = {
    select: null,
    pan: null,
    addItem: null,
    rectangle: null,
    connector: null,
    text: null,
    lasso: null,
    freehandLasso: null
  };

  it('resolves a plain tool key (no modifier)', () => {
    expect(resolveToolHotkey(false, 'c', TOOL_HOTKEYS)).toBe('connector');
    expect(resolveToolHotkey(false, 'r', TOOL_HOTKEYS)).toBe('rectangle');
    expect(resolveToolHotkey(false, 't', TOOL_HOTKEYS)).toBe('text');
    expect(resolveToolHotkey(false, 'l', TOOL_HOTKEYS)).toBe('lasso');
  });

  it('does NOT resolve a tool while Ctrl/Cmd is held (#17)', () => {
    // The headline regression: Ctrl+C (copy) must not pick the connector tool.
    expect(resolveToolHotkey(true, 'c', TOOL_HOTKEYS)).toBeNull();
    expect(resolveToolHotkey(true, 'x', TOOL_HOTKEYS)).toBeNull();
    expect(resolveToolHotkey(true, 'v', TOOL_HOTKEYS)).toBeNull();
    // Cmd (meta) collapses to the same isCtrlOrCmd flag at the call site.
    expect(resolveToolHotkey(true, 'r', TOOL_HOTKEYS)).toBeNull();
  });

  it('applies the guard regardless of which letter a mapping binds', () => {
    // A custom mapping that binds the connector tool to "t" — the guard is
    // mapping-independent because it short-circuits before the lookup.
    const custom: HotkeyMapping = { ...allNull, connector: 't' };
    expect(resolveToolHotkey(false, 't', custom)).toBe('connector');
    expect(resolveToolHotkey(true, 't', custom)).toBeNull();
  });

  it('returns null for an unmapped key and for an all-null mapping', () => {
    expect(resolveToolHotkey(false, 'z', TOOL_HOTKEYS)).toBeNull();
    expect(resolveToolHotkey(false, 'c', allNull)).toBeNull();
  });
});
