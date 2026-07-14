import {
  deriveItemInfo,
  ItemInfoSources
} from 'src/components/ViewModeInfoPopover/ViewModeInfoPopover.helpers';
import {
  Coords,
  ModelItem,
  ViewItem,
  Connector,
  TextBox,
  Label,
  Rectangle
} from 'src/types';

// Minimal, schema-valid backing entities (only required fields + the info
// fields under test). The notes-parity contract: EVERY type below carries
// `notes` in its schema, and deriveItemInfo must surface it — the hover gate
// (owner 2026-07-01) only shows a hover popover when the item HAS notes, so a
// type that drops `notes` here is hover-invisible (the original rectangle /
// textbox / label bug).

const modelItem: ModelItem = {
  id: 'n1',
  name: 'Alpha service',
  notes: '<p>node notes</p>',
  headerLink: 'https://example.com/alpha'
};
const viewItem: ViewItem = { id: 'n1', tile: { x: 2, y: 3 } };

const connector: Connector = {
  id: 'c1',
  name: 'writes to',
  description: 'legacy description',
  notes: '<p>connector notes</p>',
  headerLink: 'https://example.com/conn',
  anchors: []
};

const textBox: TextBox = {
  id: 't1',
  name: 'Caption',
  notes: '<p>textbox notes</p>',
  tile: { x: 4, y: 1 },
  content: 'Hello'
};

const label: Label = {
  id: 'l1',
  text: 'Floating label',
  notes: '<p>label notes</p>',
  headerLink: 'https://example.com/label',
  tile: { x: 6, y: 2 },
  offset: { x: 40, y: -20 }
};

const rectangle: Rectangle = {
  id: 'r1',
  name: 'Zone A',
  notes: '<p>rectangle notes</p>',
  from: { x: 1, y: 5 },
  to: { x: 3, y: 2 }
};

const fallbackTile: Coords = { x: 9, y: 9 };

const sources: ItemInfoSources = {
  modelItem,
  viewItem,
  connector,
  textBox,
  label,
  rectangle,
  fallbackTile
};

describe('deriveItemInfo (per-type popover content — notes parity)', () => {
  it('ITEM: name + notes + headerLink from the model item, anchor from the view item', () => {
    expect(deriveItemInfo('ITEM', sources)).toEqual({
      name: 'Alpha service',
      notes: '<p>node notes</p>',
      headerLink: 'https://example.com/alpha',
      anchorTile: { x: 2, y: 3 }
    });
  });

  it('CONNECTOR: name (falling back to description) + notes + headerLink, anchored at the fallback tile', () => {
    expect(deriveItemInfo('CONNECTOR', sources)).toEqual({
      name: 'writes to',
      notes: '<p>connector notes</p>',
      headerLink: 'https://example.com/conn',
      anchorTile: fallbackTile
    });
    // Legacy fallback: no name → the description carries the title.
    expect(
      deriveItemInfo('CONNECTOR', {
        ...sources,
        connector: { ...connector, name: undefined }
      }).name
    ).toBe('legacy description');
  });

  it('TEXTBOX: reads notes (the hover-parity fix) and never emits a headerLink (no schema field)', () => {
    expect(deriveItemInfo('TEXTBOX', sources)).toEqual({
      name: 'Caption',
      notes: '<p>textbox notes</p>',
      anchorTile: { x: 4, y: 1 }
    });
    expect(deriveItemInfo('TEXTBOX', sources).headerLink).toBeUndefined();
  });

  it('LABEL: text is the name, notes + headerLink read, chip offset becomes the anchorOffset', () => {
    expect(deriveItemInfo('LABEL', sources)).toEqual({
      name: 'Floating label',
      notes: '<p>label notes</p>',
      headerLink: 'https://example.com/label',
      anchorTile: { x: 6, y: 2 },
      anchorOffset: { x: 40, y: -20 }
    });
    // A snapped chip (no offset) anchors at its home tile.
    expect(
      deriveItemInfo('LABEL', {
        ...sources,
        label: { ...label, offset: undefined }
      }).anchorOffset
    ).toBeUndefined();
  });

  it('RECTANGLE: reads notes (the hover-parity fix), anchors mid-x / top-y, no headerLink (no schema field)', () => {
    expect(deriveItemInfo('RECTANGLE', sources)).toEqual({
      name: 'Zone A',
      notes: '<p>rectangle notes</p>',
      // x = midpoint of from/to, y = the lesser (top) row.
      anchorTile: { x: 2, y: 2 }
    });
    expect(deriveItemInfo('RECTANGLE', sources).headerLink).toBeUndefined();
  });

  it('returns an empty derivation for non-info types and for a missing backing entity', () => {
    expect(deriveItemInfo('CONNECTOR_ANCHOR', sources)).toEqual({});
    // The backing entity can lag the reference (stale id) — no anchor, no info.
    expect(deriveItemInfo('LABEL', { fallbackTile })).toEqual({
      name: undefined,
      notes: undefined,
      headerLink: undefined,
      anchorTile: undefined,
      anchorOffset: undefined
    });
  });
});
