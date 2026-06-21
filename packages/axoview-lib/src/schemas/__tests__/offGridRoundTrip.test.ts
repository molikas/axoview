import { modelSchema } from '../model';

// Full export -> import round-trip for the ADR 0023 off-grid fields
// (snap / collides / offset) across all three placeable item types.
//
// This exercises the REAL save/load path: DiagramLifecycleProvider.exportDiagram
// serialises { title, icons, colors, items, views } to JSON, and the loader
// (useInitialDataManager) re-parses it with modelSchema. So
// `modelSchema.parse(JSON.parse(JSON.stringify(exported)))` is exactly what a
// user's export-then-import does. Guards the reported concern: unsnapped /
// no-collision objects must survive save/load — for new AND pre-existing diagrams.

const roundTrip = (model: unknown) =>
  modelSchema.safeParse(JSON.parse(JSON.stringify(model)));

const baseItems = [{ id: 'node-1', name: 'Node One' }];

describe('off-grid export/import round-trip (ADR 0023)', () => {
  it('preserves snap/collides/offset on nodes, rectangles and text boxes (new diagram)', () => {
    const exported = {
      title: 'Off-grid diagram',
      items: baseItems,
      views: [
        {
          id: 'view-1',
          name: 'Main',
          items: [
            {
              id: 'node-1',
              tile: { x: 2, y: 3 },
              snap: false,
              collides: false,
              offset: { x: 12.5, y: -3.25 }
            }
          ],
          rectangles: [
            {
              id: 'rect-1',
              from: { x: 0, y: 0 },
              to: { x: 3, y: 3 },
              snap: false,
              collides: false,
              offset: { x: 5, y: 5 }
            }
          ],
          textBoxes: [
            {
              id: 'tb-1',
              tile: { x: 5, y: 5 },
              content: 'note',
              snap: false,
              collides: false,
              offset: { x: 1, y: 1 }
            }
          ]
        }
      ],
      icons: [],
      colors: []
    };

    const result = roundTrip(exported);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const view = result.data.views[0];
    expect(view.items[0]).toMatchObject({
      snap: false,
      collides: false,
      offset: { x: 12.5, y: -3.25 }
    });
    expect(view.rectangles?.[0]).toMatchObject({
      snap: false,
      collides: false,
      offset: { x: 5, y: 5 }
    });
    expect(view.textBoxes?.[0]).toMatchObject({
      snap: false,
      collides: false,
      offset: { x: 1, y: 1 }
    });
  });

  it('pre-existing diagram WITHOUT off-grid fields loads cleanly (defaults to snapped/colliding)', () => {
    const legacy = {
      title: 'Legacy',
      items: baseItems,
      views: [
        { id: 'view-1', name: 'Main', items: [{ id: 'node-1', tile: { x: 0, y: 0 } }] }
      ],
      icons: [],
      colors: []
    };

    const result = roundTrip(legacy);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const item = result.data.views[0].items[0];
    expect(item.snap).toBeUndefined();
    expect(item.collides).toBeUndefined();
    expect(item.offset).toBeUndefined();
  });

  it('pre-existing diagram WITH a saved snap=false survives the round-trip', () => {
    const legacyOffGrid = {
      title: 'Legacy off-grid',
      items: baseItems,
      views: [
        {
          id: 'view-1',
          name: 'Main',
          items: [{ id: 'node-1', tile: { x: 1, y: 1 }, snap: false }]
        }
      ],
      icons: [],
      colors: []
    };

    const result = roundTrip(legacyOffGrid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.views[0].items[0].snap).toBe(false);
  });
});
