// Re-export the mapping shape from the canonical location.
export type { HotkeyMapping } from 'src/types/settings';
import type { HotkeyMapping } from 'src/types/settings';

// One fixed, read-only tool-hotkey scheme (ADR 0022 §6). The profile selector
// (qwerty / smnrct / none) and rebinding were removed: the only persistence
// available is per-browser localStorage — a rebind wouldn't follow the user
// across devices — so customization is deferred until per-user account storage
// exists. The keys stay VISIBLE but read-only (HotkeySettings reference table +
// HelpDialog) so users can still learn them.
//
// Locked keys: S select · M pan · N add-item · R rectangle · C connector ·
// T text · L lasso · F freehand. (The mnemonic set that used to be the default
// `smnrct` profile.)
export const TOOL_HOTKEYS: HotkeyMapping = {
  select: 's',
  pan: 'm',
  addItem: 'n',
  rectangle: 'r',
  connector: 'c',
  text: 't',
  lasso: 'l',
  freehandLasso: 'f'
};
