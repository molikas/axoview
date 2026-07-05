// Pure, render-independent helpers for the item panel-event channel. Originally
// extracted from the (now-removed) NodeActionBar; still the canonical home for
// the panel-event dispatch + the notes-visibility check, used by the canvas
// context menu's "Add note" command, the per-type ItemControls listeners, and
// ViewModeInfoPopover. Unit-tested without dragging in MUI.

export type ItemType = 'ITEM' | 'CONNECTOR' | 'TEXTBOX' | 'RECTANGLE' | 'LABEL';

export const PANEL_EVENT: Record<ItemType, string> = {
  ITEM: 'nodePanel',
  CONNECTOR: 'connectorPanel',
  TEXTBOX: 'textBoxPanel',
  RECTANGLE: 'rectanglePanel',
  LABEL: 'labelPanel'
};

export const dispatch = (type: ItemType, action: string) =>
  window.dispatchEvent(new CustomEvent(PANEL_EVENT[type], { detail: action }));

// True when `html` has any visible (non-tag, non-whitespace) text. Equivalent
// to `html.replace(/<[^>]*>/g, '').trim() !== ''` but without the tag-strip
// regex CodeQL flags as incomplete HTML sanitization — the result drives an
// emptiness check only and is never rendered as HTML.
export const hasVisibleText = (html: string): boolean => {
  let i = 0;
  while (i < html.length) {
    const ch = html[i];
    if (ch === '<') {
      const close = html.indexOf('>', i + 1);
      if (close !== -1) {
        i = close + 1;
        continue;
      }
    }
    if (ch.trim() !== '') return true;
    i++;
  }
  return false;
};
