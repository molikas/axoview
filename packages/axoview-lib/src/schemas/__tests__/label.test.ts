import { labelSchema } from '../label';

// Floating Label schema (ADR 0031). Extracted from the retired textBox
// `variant:'label'`: plain text + whole-chip styling, no iso-projection, no
// per-character rich text. These tests pin the round-trip + the lean-default
// shape (KR1) and that the variant/content fields did NOT carry over.
describe('labelSchema', () => {
  it('validates a minimal label (text + tile)', () => {
    expect(
      labelSchema.safeParse({ id: 'l1', tile: { x: 0, y: 0 }, text: 'Label' })
        .success
    ).toBe(true);
  });

  it('round-trips all first-class fields (ADR 0031)', () => {
    const label = {
      id: 'l1',
      tile: { x: 2, y: 3 },
      text: 'Region A',
      fontSize: 18,
      color: '#112233',
      backgroundColor: '#ffeecc',
      isBold: true,
      isItalic: true,
      isStrikethrough: true,
      zIndex: 4,
      layerId: 'layer1',
      offset: { x: 9.5, y: -4 },
      snap: false
    };
    const result = labelSchema.safeParse(label);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject(label);
  });

  it('styling fields are optional — a lean label omits them (lean-save)', () => {
    const lean = labelSchema.safeParse({
      id: 'l1',
      tile: { x: 0, y: 0 },
      text: 'Label'
    });
    expect(lean.success).toBe(true);
    if (lean.success) {
      expect(lean.data.backgroundColor).toBeUndefined();
      expect(lean.data.fontSize).toBeUndefined();
      expect(lean.data.zIndex).toBeUndefined();
      expect(lean.data.isStrikethrough).toBeUndefined();
      expect(lean.data.snap).toBeUndefined();
    }
  });

  it('fails if text is missing', () => {
    const result = labelSchema.safeParse({ id: 'l1', tile: { x: 0, y: 0 } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue: any) => issue.path.includes('text'))
      ).toBe(true);
    }
  });

  it('does NOT carry the retired variant/content fields (zod strips them)', () => {
    const parsed = labelSchema.safeParse({
      id: 'l1',
      tile: { x: 0, y: 0 },
      text: 'Label',
      variant: 'label',
      content: 'legacy'
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect('variant' in parsed.data).toBe(false);
      expect('content' in parsed.data).toBe(false);
    }
  });
});
