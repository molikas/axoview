import {
  PANEL_EVENT,
  dispatch,
  hasVisibleText,
  type ItemType
} from '../NodeActionBar.helpers';

// ── hasVisibleText ────────────────────────────────────────────────────────────
// Contract: true iff the html string contains any non-tag, non-whitespace
// character. Used only as an emptiness check (drives the "has notes" indicator).
describe('hasVisibleText', () => {
  it('is false for an empty string', () => {
    expect(hasVisibleText('')).toBe(false);
  });
  it('is false for whitespace only', () => {
    expect(hasVisibleText('   \n\t ')).toBe(false);
  });
  it('is false for markup with no text content', () => {
    expect(hasVisibleText('<p></p>')).toBe(false);
    expect(hasVisibleText('<div><br/></div>')).toBe(false);
  });
  it('is false when tags only wrap whitespace', () => {
    expect(hasVisibleText('<p>   </p>')).toBe(false);
  });
  it('is true when there is real text inside tags', () => {
    expect(hasVisibleText('<p>hello</p>')).toBe(true);
  });
  it('is true for bare text with no tags', () => {
    expect(hasVisibleText('hello')).toBe(true);
  });
  it('skips tag attributes but still finds following text', () => {
    expect(hasVisibleText('<a href="http://x">link</a>')).toBe(true);
  });
  it('treats an unterminated "<" as visible content', () => {
    // No closing ">" → the "<" is scanned as an ordinary non-whitespace char.
    expect(hasVisibleText('<')).toBe(true);
    expect(hasVisibleText('a < b')).toBe(true);
  });
});

// ── PANEL_EVENT / dispatch ────────────────────────────────────────────────────
describe('PANEL_EVENT', () => {
  it('maps every item type to its panel event name', () => {
    expect(PANEL_EVENT).toEqual({
      ITEM: 'nodePanel',
      CONNECTOR: 'connectorPanel',
      TEXTBOX: 'textBoxPanel',
      RECTANGLE: 'rectanglePanel',
      // LABEL joined the channel with floating-Label "Add note" (commit e11aad1).
      LABEL: 'labelPanel'
    });
  });
});

describe('dispatch', () => {
  const types: ItemType[] = ['ITEM', 'CONNECTOR', 'TEXTBOX', 'RECTANGLE', 'LABEL'];

  it.each(types)(
    'fires the %s panel CustomEvent carrying the action in detail',
    (type) => {
      const received: string[] = [];
      const handler = (e: Event) =>
        received.push((e as CustomEvent<string>).detail);
      window.addEventListener(PANEL_EVENT[type], handler);
      dispatch(type, 'focusName');
      window.removeEventListener(PANEL_EVENT[type], handler);
      expect(received).toEqual(['focusName']);
    }
  );

  it('does not fire other panels when one type is dispatched', () => {
    const connectorEvents: string[] = [];
    const handler = (e: Event) =>
      connectorEvents.push((e as CustomEvent<string>).detail);
    window.addEventListener(PANEL_EVENT.CONNECTOR, handler);
    dispatch('ITEM', 'scrollToAppearance');
    window.removeEventListener(PANEL_EVENT.CONNECTOR, handler);
    expect(connectorEvents).toEqual([]);
  });
});
