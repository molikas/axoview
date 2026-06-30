/**
 * Unit tests for the Option A name/caption/label fold (ADR 0032, slice A3).
 *
 * Pins the acceptance criteria: the rich `description` folds into `notes` with a
 * BLOCK SEPARATOR (the pre-fix concatenation ran them together inline), the
 * fold is idempotent on re-load, an empty description is skipped, and
 * `description` is dropped from the working model after folding.
 */

import {
  foldNodeDescription,
  NOTES_FOLD_SEPARATOR
} from 'src/utils/foldNodeDescription';

describe('foldNodeDescription (ADR 0032 Option-A fold)', () => {
  it('folds description into prior notes with a block separator between them', () => {
    const result = foldNodeDescription({
      id: 'n1',
      name: 'Server',
      notes: '<p>existing note</p>',
      description: '<p>old caption</p>'
    }) as Record<string, unknown>;

    expect(result.notes).toBe(
      `<p>existing note</p>${NOTES_FOLD_SEPARATOR}<p>old caption</p>`
    );
    // The separator keeps the two as distinct blocks, not "noteold caption".
    expect(result.notes).toContain(NOTES_FOLD_SEPARATOR);
    // Unrelated fields are preserved.
    expect(result.id).toBe('n1');
    expect(result.name).toBe('Server');
  });

  it('uses the description verbatim when there are no prior notes (no leading separator)', () => {
    expect(
      (foldNodeDescription({ description: '<p>only caption</p>' }) as Record<
        string,
        unknown
      >).notes
    ).toBe('<p>only caption</p>');

    expect(
      (
        foldNodeDescription({
          notes: '<p></p>',
          description: '<p>only caption</p>'
        }) as Record<string, unknown>
      ).notes
    ).toBe('<p>only caption</p>'); // whitespace-only notes count as empty
  });

  it('deletes description from the working model after folding', () => {
    const result = foldNodeDescription({
      notes: 'n',
      description: '<p>d</p>'
    }) as Record<string, unknown>;

    expect('description' in result).toBe(false);
    expect(result.description).toBeUndefined();
  });

  it('skips an empty or whitespace-only description (no fold, notes untouched)', () => {
    const emptyString = { id: 'a', notes: 'keep me', description: '' };
    expect(foldNodeDescription(emptyString)).toBe(emptyString); // same ref, unchanged

    const whitespaceHtml = { id: 'b', notes: 'keep me', description: '<p>  </p>' };
    const res = foldNodeDescription(whitespaceHtml) as Record<string, unknown>;
    expect(res.notes).toBe('keep me');

    const noDescription = { id: 'c', notes: 'keep me' };
    expect(foldNodeDescription(noDescription)).toBe(noDescription);
  });

  it('is idempotent — re-folding an already-folded item is a no-op', () => {
    const once = foldNodeDescription({
      notes: '<p>note</p>',
      description: '<p>caption</p>'
    });
    const twice = foldNodeDescription(once);

    expect(twice).toEqual(once);
    // No compounding: the separator appears exactly once.
    const notes = (twice as Record<string, unknown>).notes as string;
    expect(notes.split(NOTES_FOLD_SEPARATOR)).toHaveLength(2);
  });

  it('passes non-object values through unchanged', () => {
    expect(foldNodeDescription(null)).toBeNull();
    expect(foldNodeDescription(42)).toBe(42);
    expect(foldNodeDescription('str')).toBe('str');
  });
});
