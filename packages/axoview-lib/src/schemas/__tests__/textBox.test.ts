import { textBoxSchema } from '../textBox';
import { ProjectionOrientationEnum } from '../../types/common';

describe('textBoxSchema', () => {
  it('validates a correct text box', () => {
    const valid = { id: 'tb1', tile: { x: 0, y: 0 }, content: 'Text' };
    expect(textBoxSchema.safeParse(valid).success).toBe(true);
  });
  it('accepts optional color field', () => {
    expect(
      textBoxSchema.safeParse({
        id: 'tb1',
        tile: { x: 0, y: 0 },
        content: 'Text',
        color: '#ff0000'
      }).success
    ).toBe(true);
  });
  it('color is optional — omitting it still passes', () => {
    expect(
      textBoxSchema.safeParse({
        id: 'tb1',
        tile: { x: 0, y: 0 },
        content: 'Text'
      }).success
    ).toBe(true);
  });
  it('round-trips off-grid fields and stays optional (ADR 0023)', () => {
    const tb = {
      id: 'tb1',
      tile: { x: 0, y: 0 },
      content: 'Text',
      offset: { x: 9.75, y: 4 },
      snap: false,
      collides: false
    };
    const result = textBoxSchema.safeParse(tb);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject(tb);
    const lean = textBoxSchema.safeParse({
      id: 'tb1',
      tile: { x: 0, y: 0 },
      content: 'Text'
    });
    expect(lean.success).toBe(true);
    if (lean.success) expect(lean.data.snap).toBeUndefined();
  });
  it('round-trips the ADR 0034 text-styling fields and keeps them optional', () => {
    const tb = {
      id: 'tb1',
      tile: { x: 0, y: 0 },
      content: 'Text',
      lineHeight: 1.5,
      width: 8,
      height: 6,
      backgroundColor: '#ffffff',
      borderColor: '#000000',
      borderWidth: 30,
      borderStyle: 'DASHED' as const,
      borderOpacity: 0.5,
      verticalAlign: 'middle' as const,
      orientation: ProjectionOrientationEnum.Y
    };
    const result = textBoxSchema.safeParse(tb);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject(tb);
    // Lean text box omits all of them (zero-migration / lean-save).
    const lean = textBoxSchema.safeParse({
      id: 'tb1',
      tile: { x: 0, y: 0 },
      content: 'Text'
    });
    expect(lean.success).toBe(true);
    if (lean.success) {
      expect(lean.data.lineHeight).toBeUndefined();
      expect(lean.data.width).toBeUndefined();
      expect(lean.data.borderColor).toBeUndefined();
      expect(lean.data.verticalAlign).toBeUndefined();
    }
  });
  it('accepts the large unbounded geometry values the strip can write (the S1-brick guard)', () => {
    // fontSize/lineHeight/width/height/borderWidth are deliberately unbounded —
    // a cap tighter than what the strip can write bricks saved diagrams on
    // reload (the connector-label fontSize 24→40 S1). This fails if a bound is
    // ever re-introduced, matching the schema's load-bearing comment.
    const base = { id: 'tb1', tile: { x: 0, y: 0 }, content: 'Text' };
    expect(textBoxSchema.safeParse({ ...base, fontSize: 40 }).success).toBe(true);
    expect(textBoxSchema.safeParse({ ...base, lineHeight: 2.5 }).success).toBe(true);
    expect(
      textBoxSchema.safeParse({ ...base, width: 999, height: 999 }).success
    ).toBe(true);
    expect(textBoxSchema.safeParse({ ...base, borderWidth: 30 }).success).toBe(
      true
    );
  });
  it('bounds borderOpacity to [0,1] and rejects an invalid borderStyle / verticalAlign', () => {
    const base = { id: 'tb1', tile: { x: 0, y: 0 }, content: 'Text' };
    expect(
      textBoxSchema.safeParse({ ...base, borderOpacity: 1.5 }).success
    ).toBe(false);
    expect(
      textBoxSchema.safeParse({ ...base, borderOpacity: -0.1 }).success
    ).toBe(false);
    expect(
      textBoxSchema.safeParse({ ...base, borderStyle: 'GROOVE' }).success
    ).toBe(false);
    expect(
      textBoxSchema.safeParse({ ...base, verticalAlign: 'center' }).success
    ).toBe(false);
  });
  it('fails if content is missing', () => {
    const invalid = { id: 'tb1', tile: { x: 0, y: 0 } };
    const result = textBoxSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue: any) => {
          return issue.path.includes('content');
        })
      ).toBe(true);
    }
  });
});
