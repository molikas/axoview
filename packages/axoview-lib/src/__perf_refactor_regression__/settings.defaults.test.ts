/**
 * REGRESSION — Settings default values
 *
 * Guards against accidental changes to default settings that affect user
 * experience out of the box. Any change to these defaults is a UX decision
 * that should be intentional and visible in a test failure.
 */

import { TOOL_HOTKEYS } from 'src/config/hotkeys';
import { DEFAULT_ZOOM_SETTINGS } from 'src/config/zoomSettings';

// ---------------------------------------------------------------------------
// Tool hotkeys — one fixed read-only scheme (ADR 0022 §6). The qwerty/smnrct/
// none profiles + the selector were removed; these guard the locked keys.
// ---------------------------------------------------------------------------
describe('Tool hotkeys (fixed scheme)', () => {
  it('binds the locked keys S/M/N/R/C/T/L/F', () => {
    expect(TOOL_HOTKEYS.select).toBe('s');
    expect(TOOL_HOTKEYS.pan).toBe('m');
    expect(TOOL_HOTKEYS.addItem).toBe('n');
    expect(TOOL_HOTKEYS.rectangle).toBe('r');
    expect(TOOL_HOTKEYS.connector).toBe('c');
    expect(TOOL_HOTKEYS.text).toBe('t');
    expect(TOOL_HOTKEYS.lasso).toBe('l');
    expect(TOOL_HOTKEYS.freehandLasso).toBe('f');
  });

  it('has no unbound (null) keys', () => {
    expect(Object.values(TOOL_HOTKEYS).every((k) => k !== null)).toBe(true);
  });
});

// Pan customization was removed (ADR 0022 §6): pan is a fixed model
// (middle/right-drag + arrow keys, always on), so there are no DEFAULT_PAN_SETTINGS
// to guard anymore.

// ---------------------------------------------------------------------------
// Zoom settings defaults
// ---------------------------------------------------------------------------
describe('Zoom settings defaults', () => {
  it('zoomToCursor is true by default', () => {
    expect(DEFAULT_ZOOM_SETTINGS.zoomToCursor).toBe(true);
  });
});
