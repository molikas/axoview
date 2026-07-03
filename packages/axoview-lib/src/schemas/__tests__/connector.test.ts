import {
  anchorSchema,
  connectorLabelSchema,
  connectorSchema
} from '../connector';
import { ARRAY_MAX } from '../common';

describe('anchorSchema', () => {
  it('validates a correct anchor', () => {
    const valid = { id: 'a1', ref: { item: 'item1' } };
    expect(anchorSchema.safeParse(valid).success).toBe(true);
  });
  it('fails if id is missing', () => {
    const invalid = { ref: { item: 'item1' } };
    const result = anchorSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue: any) => {
          return issue.path.includes('id');
        })
      ).toBe(true);
    }
  });
});

describe('anchorSchema — ref field contracts', () => {
  it('accepts anchor with only tile ref', () => {
    expect(
      anchorSchema.safeParse({ id: 'a1', ref: { tile: { x: 5, y: 10 } } })
        .success
    ).toBe(true);
  });

  it('accepts anchor with empty ref (all ref fields are optional)', () => {
    expect(anchorSchema.safeParse({ id: 'a1', ref: {} }).success).toBe(true);
  });

  it('accepts anchor with both item AND tile set — documents no exclusivity guard at schema level', () => {
    // The anchorSchema uses .partial() which allows all ref fields simultaneously.
    // There is currently NO Zod validation preventing both item and tile being set.
    // The 2-ref exclusivity rule is an application-level invariant only.
    // If .refine() exclusivity is added in the future, update this test to expect failure.
    const result = anchorSchema.safeParse({
      id: 'a1',
      ref: { item: 'item1', tile: { x: 0, y: 0 } }
    });
    expect(result.success).toBe(true);
  });
});

describe('connectorSchema', () => {
  it('validates a correct connector', () => {
    const valid = { id: 'c1', anchors: [{ id: 'a1', ref: { item: 'item1' } }] };
    expect(connectorSchema.safeParse(valid).success).toBe(true);
  });
  it('fails if anchors is missing', () => {
    const invalid = { id: 'c1' };
    const result = connectorSchema.safeParse(invalid);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue: any) => {
          return issue.path.includes('anchors');
        })
      ).toBe(true);
    }
  });
});

describe('connectorLabelSchema', () => {
  const baseLabel = { id: 'l1', text: 'Label', position: 50 };

  it('validates a minimal label', () => {
    expect(connectorLabelSchema.safeParse(baseLabel).success).toBe(true);
  });

  it('accepts optional fontSize within range', () => {
    expect(
      connectorLabelSchema.safeParse({ ...baseLabel, fontSize: 8 }).success
    ).toBe(true);
    // 40 = the strip's unified label-size max (ADR 0030 / ADR 0034 §4). The old
    // 24 cap rejected sizes the strip itself wrote, bricking saved diagrams.
    expect(
      connectorLabelSchema.safeParse({ ...baseLabel, fontSize: 40 }).success
    ).toBe(true);
    expect(
      connectorLabelSchema.safeParse({ ...baseLabel, fontSize: 14 }).success
    ).toBe(true);
  });

  it('rejects fontSize outside 8–40', () => {
    expect(
      connectorLabelSchema.safeParse({ ...baseLabel, fontSize: 7 }).success
    ).toBe(false);
    expect(
      connectorLabelSchema.safeParse({ ...baseLabel, fontSize: 41 }).success
    ).toBe(false);
  });

  it('accepts optional labelColor as hex string', () => {
    expect(
      connectorLabelSchema.safeParse({ ...baseLabel, labelColor: '#ff0000' })
        .success
    ).toBe(true);
    expect(
      connectorLabelSchema.safeParse({ ...baseLabel, labelColor: '#000000' })
        .success
    ).toBe(true);
  });

  it('fontSize and labelColor are fully optional', () => {
    expect(connectorLabelSchema.safeParse(baseLabel).success).toBe(true);
  });

  it('fails if id is missing', () => {
    const result = connectorLabelSchema.safeParse({
      text: 'Label',
      position: 50
    });
    expect(result.success).toBe(false);
  });

  it('accepts and round-trips an optional headerLink (#4 connector-label links)', () => {
    const result = connectorLabelSchema.safeParse({
      ...baseLabel,
      headerLink: 'https://example.com'
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.headerLink).toBe('https://example.com');
    }
  });

  it('rejects a headerLink over 2048 chars', () => {
    expect(
      connectorLabelSchema.safeParse({
        ...baseLabel,
        headerLink: 'x'.repeat(2049)
      }).success
    ).toBe(false);
  });
});

describe('connectorSchema — name and notes fields', () => {
  const base = { id: 'c1', anchors: [] };

  it('accepts connector with a valid name', () => {
    expect(connectorSchema.safeParse({ ...base, name: 'My link' }).success).toBe(true);
  });

  it('rejects name longer than 200 characters', () => {
    expect(
      connectorSchema.safeParse({ ...base, name: 'x'.repeat(201) }).success
    ).toBe(false);
  });

  it('accepts connector with valid notes', () => {
    expect(
      connectorSchema.safeParse({ ...base, notes: '<p>hello</p>' }).success
    ).toBe(true);
  });

  it('rejects notes longer than 50000 characters', () => {
    expect(
      connectorSchema.safeParse({ ...base, notes: 'x'.repeat(50001) }).success
    ).toBe(false);
  });

  it('round-trips name and notes through parse', () => {
    const input = { ...base, name: 'Edge label', notes: '<p>some notes</p>' };
    const result = connectorSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Edge label');
      expect(result.data.notes).toBe('<p>some notes</p>');
    }
  });

  it('connector without name or notes still validates', () => {
    expect(connectorSchema.safeParse(base).success).toBe(true);
  });

  it('accepts and round-trips the nameSeeded migration marker', () => {
    const result = connectorSchema.safeParse({ ...base, nameSeeded: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.nameSeeded).toBe(true);
  });
});

describe('connectorSchema — anchor count at schema level', () => {
  it('accepts connector with 0 anchors (no minimum enforced at schema level)', () => {
    // The 2-anchor minimum is an application-level invariant, not a Zod constraint.
    // If z.array(anchorSchema).min(2) is added in the future, update this test.
    expect(connectorSchema.safeParse({ id: 'c1', anchors: [] }).success).toBe(
      true
    );
  });

  it('accepts connector with exactly 1 anchor', () => {
    const result = connectorSchema.safeParse({
      id: 'c1',
      anchors: [{ id: 'a1', ref: { item: 'x' } }]
    });
    expect(result.success).toBe(true);
  });
});

describe('connectorSchema — anchors bound (import-DoS guard, ADR 0029)', () => {
  const anchors = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ id: `a${i}`, ref: { item: 'x' } }));

  it('rejects an anchors array over the cap', () => {
    const result = connectorSchema.safeParse({
      id: 'c1',
      anchors: anchors(ARRAY_MAX.connectorAnchors + 1)
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((iss: any) => iss.path.includes('anchors'))
      ).toBe(true);
    }
  });

  it('accepts a normal anchor count', () => {
    expect(
      connectorSchema.safeParse({ id: 'c1', anchors: anchors(4) }).success
    ).toBe(true);
  });
});
