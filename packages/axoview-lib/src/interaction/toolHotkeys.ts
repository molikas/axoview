// Pure tool-hotkey resolution — split out of useInteractionManager so it can be
// unit-tested without dragging in the whole interaction system (stores, modes,
// clipboard). The keydown dispatcher imports resolveToolHotkey from here.

import type { HotkeyMapping } from 'src/types/settings';

// Iteration order = resolution priority ("first match wins"); mirrors the
// original else-if order in the keydown handler.
export const TOOL_HOTKEY_ACTIONS = [
  'select',
  'pan',
  'addItem',
  'rectangle',
  'connector',
  'text',
  'lasso',
  'freehandLasso'
] as const;

export type ToolHotkeyAction = (typeof TOOL_HOTKEY_ACTIONS)[number];

// Resolve a keystroke to the matching tool-hotkey action for the active
// profile, or null. First match wins.
// #17: tool keys never resolve while Ctrl/Cmd is held — that chord belongs to
// the clipboard/history shortcuts (Ctrl+C copies; it must not also switch to the
// connector tool, whose hotkey is C in the default profile). Plain tool keys
// still resolve.
export const resolveToolHotkey = (
  isCtrlOrCmd: boolean,
  key: string,
  mapping: HotkeyMapping
): ToolHotkeyAction | null => {
  if (isCtrlOrCmd) return null;
  for (const action of TOOL_HOTKEY_ACTIONS) {
    if (mapping[action] && key === mapping[action]) return action;
  }
  return null;
};
