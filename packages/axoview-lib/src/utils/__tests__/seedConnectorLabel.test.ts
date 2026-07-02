import { seedConnectorLabel } from '../seedConnectorLabel';

type Raw = Record<string, unknown>;
const labels = (o: unknown) => (o as Raw).labels as Raw[] | undefined;

describe('seedConnectorLabel (ADR 0032 connector amendment — name↔label decouple seed)', () => {
  it('folds a connector name into a midpoint labels[] entry and marks it seeded', () => {
    const out = seedConnectorLabel({
      id: 'c1',
      name: 'flows to',
      anchors: []
    }) as Raw;
    expect(out.nameSeeded).toBe(true);
    const ls = labels(out)!;
    expect(ls).toHaveLength(1);
    expect(ls[0].text).toBe('flows to');
    expect(ls[0].position).toBe(50);
    // The identity name is retained (Layers-renamed); it just no longer draws.
    expect(out.name).toBe('flows to');
  });

  it('carries the nameLabel* placement/style onto the seeded label', () => {
    const out = seedConnectorLabel({
      id: 'c1',
      name: 'API',
      nameLabelPosition: 25,
      nameLabelHeight: 12,
      nameLabelFontSize: 20,
      nameLabelColor: '#ff0000',
      nameLabelBold: true,
      anchors: []
    }) as Raw;
    const l = labels(out)![0];
    expect(l.position).toBe(25);
    expect(l.height).toBe(12);
    expect(l.fontSize).toBe(20);
    expect(l.labelColor).toBe('#ff0000');
    expect(l.bold).toBe(true);
  });

  it('prepends the name label ahead of existing labels[] (name was the midpoint)', () => {
    const out = seedConnectorLabel({
      id: 'c1',
      name: 'primary',
      labels: [{ id: 'x', text: 'existing', position: 90 }],
      anchors: []
    }) as Raw;
    const ls = labels(out)!;
    expect(ls).toHaveLength(2);
    expect(ls[0].text).toBe('primary');
    expect(ls[1].text).toBe('existing');
  });

  it('migrates legacy label fields into labels[] alongside the seeded name', () => {
    const out = seedConnectorLabel({
      id: 'c1',
      name: 'mid',
      startLabel: 'start',
      endLabel: 'end',
      anchors: []
    }) as Raw;
    const texts = labels(out)!.map((l) => l.text);
    expect(texts).toEqual(['mid', 'start', 'end']);
    // Legacy fields are dropped after folding.
    expect(out.startLabel).toBeUndefined();
    expect(out.endLabel).toBeUndefined();
  });

  it('is idempotent — a second pass is a no-op (no duplicate labels)', () => {
    const once = seedConnectorLabel({ id: 'c1', name: 'flows to', anchors: [] });
    const twice = seedConnectorLabel(once);
    expect(twice).toEqual(once);
    expect(labels(twice)).toHaveLength(1);
  });

  it('marks a nameless connector seeded without adding a label', () => {
    const out = seedConnectorLabel({ id: 'c1', anchors: [] }) as Raw;
    expect(out.nameSeeded).toBe(true);
    expect(labels(out)).toBeUndefined();
  });

  it('never re-seeds an already-migrated connector even if a name is later set', () => {
    // Simulates a connector stamped by a prior load whose identity name is then
    // edited in Layers — the name must stay identity-only, never redrawn.
    const out = seedConnectorLabel({
      id: 'c1',
      name: 'renamed in layers',
      nameSeeded: true,
      anchors: []
    }) as Raw;
    expect(labels(out)).toBeUndefined();
  });

  it('returns non-objects untouched', () => {
    expect(seedConnectorLabel(null)).toBeNull();
    expect(seedConnectorLabel('x')).toBe('x');
  });
});
