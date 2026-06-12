/**
 * ADR 0014 — the load-bearing invariant: ephemeral annotation data must NEVER
 * reach any persistence path (session save, server save, export JSON, project
 * zip). Annotations live only in uiState; the model serializer
 * `modelFromModelStore` is a field whitelist, so even if an `annotation` slice
 * were somehow attached to the model store, it would be dropped on save.
 *
 * This is the single most important test for the annotation feature (see the
 * tactical doc's "persistence is the trap" note) — written to fail loudly if a
 * future change routes annotation strokes into the saved model.
 */
import { modelFromModelStore } from 'src/utils/model';
import { stripDefaultIcons } from 'src/utils/leanSave';

const sampleStroke = {
  id: 'stroke-1',
  tool: 'pencil' as const,
  color: '#ef4444',
  thickness: 4,
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 10 }
  ]
};

describe('annotation persistence exclusion (ADR 0014)', () => {
  it('modelFromModelStore emits only model fields — no annotation', () => {
    // A model store contaminated with an annotation slice (the regression we
    // guard against): the serializer must still drop it.
    const contaminated = {
      version: '1.0',
      title: 'T',
      description: '',
      colors: [],
      icons: [],
      items: [],
      views: [],
      annotation: { open: true, strokes: [sampleStroke] }
    } as any;

    const model = modelFromModelStore(contaminated);

    expect(Object.keys(model).sort()).toEqual(
      ['colors', 'description', 'icons', 'items', 'title', 'version', 'views'].sort()
    );
    expect('annotation' in model).toBe(false);
    const serialized = JSON.stringify(model);
    expect(serialized).not.toContain('annotation');
    expect(serialized).not.toContain('stroke-1');
    expect(serialized).not.toContain('strokes');
  });

  it('lean-save (stripDefaultIcons) output carries no annotation data', () => {
    const model = modelFromModelStore({
      version: '1.0',
      title: 'T',
      description: '',
      colors: [],
      icons: [],
      items: [],
      views: [],
      annotation: { strokes: [sampleStroke] }
    } as any);

    const saved = stripDefaultIcons(model);
    const serialized = JSON.stringify(saved);
    expect(serialized).not.toContain('annotation');
    expect(serialized).not.toContain('strokes');
    expect(serialized).not.toContain('stroke-1');
  });
});
