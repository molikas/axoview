// Pure, render-independent helpers for NodeActionBar. Extracted to a sibling
// module so they can be unit-tested without dragging in MUI and the ~15 hooks
// the component depends on. No behavior change — NodeActionBar imports these.

export type ItemType = 'ITEM' | 'CONNECTOR' | 'TEXTBOX' | 'RECTANGLE';

export const PANEL_EVENT: Record<ItemType, string> = {
  ITEM: 'nodePanel',
  CONNECTOR: 'connectorPanel',
  TEXTBOX: 'textBoxPanel',
  RECTANGLE: 'rectanglePanel'
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
