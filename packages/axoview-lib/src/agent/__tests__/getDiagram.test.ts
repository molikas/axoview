// E1 (ADR 0045 §2 invariant 4 / read cost) — the diagram read must not carry the
// base64 icon SVGs, but must keep each node's kind (icon id/name).

import { getDiagram } from '../getDiagram';
import { SceneBridge } from '../types';
import { Model } from 'src/types';

const B64 = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='; // a fake base64 SVG

const modelWithBase64Icons = (): Model => ({
  version: '1',
  title: 'd',
  items: [{ id: 'n1', name: 'Web', icon: 'server' }],
  views: [{ id: 'v1', name: 'Page 1', items: [{ id: 'n1', tile: { x: 0, y: 0 } }], connectors: [] }],
  icons: [
    { id: 'server', name: 'Server', url: B64, collection: 'infra', isIsometric: true },
    { id: 'database', name: 'Database', url: B64 }
  ],
  colors: [{ id: 'c1', value: '#000000' }]
});

const bridgeFor = (model: Model): SceneBridge =>
  ({
    getModel: () => model,
    getCurrentViewId: () => 'v1'
  }) as unknown as SceneBridge;

describe('getDiagram — read projection (E1)', () => {
  it('drops the base64 icon urls by default but keeps id + name + metadata', () => {
    const out = getDiagram(bridgeFor(modelWithBase64Icons()));
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('base64');
    expect(out.icons).toEqual([
      { id: 'server', name: 'Server', url: '', collection: 'infra', isIsometric: true },
      { id: 'database', name: 'Database', url: '' }
    ]);
    // Topology + node kind survive.
    expect(out.items[0].icon).toBe('server');
    expect(out.views[0].items).toHaveLength(1);
  });

  it('icons:"none" omits the catalog entirely', () => {
    const out = getDiagram(bridgeFor(modelWithBase64Icons()), { icons: 'none' });
    expect(out.icons).toEqual([]);
  });

  it('icons:"full" restores real urls (lean-saved)', () => {
    const out = getDiagram(bridgeFor(modelWithBase64Icons()), { icons: 'full' });
    // Custom (non-fixture) icons keep their url under full mode.
    expect(JSON.stringify(out)).toContain('base64');
  });
});
