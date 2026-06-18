import { resolveToolHotkey } from '../toolHotkeys';
import { HOTKEY_PROFILES } from 'src/config/hotkeys';

// T1 #17 — Ctrl/Cmd + a tool letter must NOT resolve to a tool. In the default
// `smnrct` profile the connector tool is bound to "c", so before the guard
// Ctrl+C (copy) also switched to the connector tool. Ctrl+X / Ctrl+V never bound
// to a tool but are covered here too for the regression contract.
describe('resolveToolHotkey', () => {
  const smnrct = HOTKEY_PROFILES.smnrct;
  const qwerty = HOTKEY_PROFILES.qwerty;

  it('resolves a plain tool key (no modifier)', () => {
    expect(resolveToolHotkey(false, 'c', smnrct)).toBe('connector');
    expect(resolveToolHotkey(false, 'r', smnrct)).toBe('rectangle');
    expect(resolveToolHotkey(false, 't', smnrct)).toBe('text');
    expect(resolveToolHotkey(false, 'l', smnrct)).toBe('lasso');
  });

  it('does NOT resolve a tool while Ctrl/Cmd is held (#17)', () => {
    // The headline regression: Ctrl+C (copy) must not pick the connector tool.
    expect(resolveToolHotkey(true, 'c', smnrct)).toBeNull();
    expect(resolveToolHotkey(true, 'x', smnrct)).toBeNull();
    expect(resolveToolHotkey(true, 'v', smnrct)).toBeNull();
    // Cmd (meta) collapses to the same isCtrlOrCmd flag at the call site.
    expect(resolveToolHotkey(true, 'r', smnrct)).toBeNull();
  });

  it('applies the guard regardless of which profile binds the letter', () => {
    // qwerty binds the connector tool to "t", not "c" — the guard is profile-
    // independent because it short-circuits before the mapping lookup.
    expect(resolveToolHotkey(false, 't', qwerty)).toBe('connector');
    expect(resolveToolHotkey(true, 't', qwerty)).toBeNull();
  });

  it('returns null for an unmapped key and for the empty profile', () => {
    expect(resolveToolHotkey(false, 'z', smnrct)).toBeNull();
    expect(resolveToolHotkey(false, 'c', HOTKEY_PROFILES.none)).toBeNull();
  });
});
