import { textBoxSchema } from '../textBox';

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
