import { rectangleSchema } from '../rectangle';
import { textBoxSchema } from '../textBox';
import { labelSchema } from '../label';

// 2026-07-02: Notes are available on every canvas element. Rectangle / TextBox /
// Label gained an optional `notes` field (parity with node / connector).
describe('notes field parity across canvas elements', () => {
  it('rectangle round-trips notes', () => {
    const r = rectangleSchema.safeParse({
      id: 'r1',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
      notes: '<p>hi</p>'
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBe('<p>hi</p>');
  });

  it('text box round-trips notes (separate from content)', () => {
    const r = textBoxSchema.safeParse({
      id: 't1',
      tile: { x: 0, y: 0 },
      content: 'on-canvas text',
      notes: '<p>meta</p>'
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.content).toBe('on-canvas text');
      expect(r.data.notes).toBe('<p>meta</p>');
    }
  });

  it('label round-trips notes (separate from text)', () => {
    const r = labelSchema.safeParse({
      id: 'l1',
      text: 'Chip',
      tile: { x: 0, y: 0 },
      notes: '<p>note</p>'
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.text).toBe('Chip');
      expect(r.data.notes).toBe('<p>note</p>');
    }
  });

  it('notes stays optional (absent validates)', () => {
    expect(
      rectangleSchema.safeParse({
        id: 'r1',
        from: { x: 0, y: 0 },
        to: { x: 1, y: 1 }
      }).success
    ).toBe(true);
  });
});
