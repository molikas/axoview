import { rectangleSchema } from '../rectangle';

describe('rectangleSchema', () => {
  it('validates a correct rectangle', () => {
    const valid = { id: 'rect1', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } };
    expect(rectangleSchema.safeParse(valid).success).toBe(true);
  });
  it('round-trips off-grid fields and stays optional (ADR 0023)', () => {
    const rect = {
      id: 'rect1',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
      offset: { x: 2.5, y: -1.5 },
      snap: false,
      collides: false
    };
    const result = rectangleSchema.safeParse(rect);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject(rect);
    // Omitting them still validates (lean-save / backward compat).
    const lean = rectangleSchema.safeParse({
      id: 'rect1',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 }
    });
    expect(lean.success).toBe(true);
    if (lean.success) expect(lean.data.offset).toBeUndefined();
  });
  it('accepts an optional integer zIndex and rejects a non-integer', () => {
    expect(
      rectangleSchema.safeParse({
        id: 'rect1',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 },
        zIndex: 3
      }).success
    ).toBe(true);
    expect(
      rectangleSchema.safeParse({
        id: 'rect1',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 },
        zIndex: 1.5
      }).success
    ).toBe(false);
  });
  it('accepts fill/border opacity in [0,1], rejects out-of-range, stays optional', () => {
    const base = { id: 'rect1', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } };
    expect(
      rectangleSchema.safeParse({ ...base, fillOpacity: 0.5, borderOpacity: 0 })
        .success
    ).toBe(true);
    expect(rectangleSchema.safeParse({ ...base, fillOpacity: 1.5 }).success).toBe(
      false
    );
    expect(
      rectangleSchema.safeParse({ ...base, borderOpacity: -0.1 }).success
    ).toBe(false);
    // Absent = opaque (zero-migration): omitting validates and leaves undefined.
    const lean = rectangleSchema.safeParse(base);
    expect(lean.success).toBe(true);
    if (lean.success) {
      expect(lean.data.fillOpacity).toBeUndefined();
      expect(lean.data.borderOpacity).toBeUndefined();
    }
  });
  it('fails if from is missing', () => {
    const invalid = { id: 'rect1', to: { x: 1, y: 1 } };
    const result = rectangleSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue: any) => {
          return issue.path.includes('from');
        })
      ).toBe(true);
    }
  });
});
