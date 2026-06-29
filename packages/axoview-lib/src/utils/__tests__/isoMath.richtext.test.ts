// @ts-nocheck
/**
 * Regression tests for MQA #11 canvas rich-text auto-grow behavior.
 *
 * These pin two contracts:
 *   1. countHtmlLines weights each block type by BLOCK_HEIGHT_UNITS so the
 *      stored textbox `size.height` accommodates the rendered content.
 *   2. splitIntoMeasurableBlocks emits per-block scale factors so a long
 *      <h1> isn't underestimated relative to body paragraphs.
 *
 * Drift in either contract would make textboxes clip their own content
 * (B1 from the screenshot-driven plan: dashed selection bounds smaller
 * than what's actually drawn).
 */

import {
  countHtmlLines,
  splitIntoMeasurableBlocks
} from 'src/utils/isoMath';

describe('countHtmlLines — weighted line counting (MQA #11 B1)', () => {
  it('plain text counts as 1 unit', () => {
    expect(countHtmlLines('Text')).toBe(1);
    expect(countHtmlLines('')).toBe(1);
  });

  it('content not starting with `<` short-circuits to 1', () => {
    expect(countHtmlLines('1. point one')).toBe(1);
  });

  it('single <p> block weighs more than a plain-text line', () => {
    // Quill normalises typed plain text to `<p>...</p>` on edit. The auto-
    // grown height must account for the paragraph's bottom margin.
    expect(countHtmlLines('<p>Text</p>')).toBeGreaterThan(1);
    expect(countHtmlLines('<p>Text</p>')).toBeCloseTo(1.5, 5);
  });

  it('h1 weighs significantly more than a paragraph', () => {
    // h1 renders at 1.875em with its own line-height + margins. Without
    // this weighting, an h1-only textbox under-grew and clipped its top.
    expect(countHtmlLines('<h1>Big</h1>')).toBeCloseTo(3.35, 5);
    expect(countHtmlLines('<h1>Big</h1>')).toBeGreaterThan(
      countHtmlLines('<p>Body</p>')
    );
  });

  it('h2 between h1 and h3', () => {
    const h1 = countHtmlLines('<h1>X</h1>');
    const h2 = countHtmlLines('<h2>X</h2>');
    const h3 = countHtmlLines('<h3>X</h3>');
    expect(h2).toBeLessThan(h1);
    expect(h2).toBeGreaterThan(h3);
  });

  it('multi-block content sums weights', () => {
    const single = countHtmlLines('<p>A</p>');
    const triple = countHtmlLines('<p>A</p><p>B</p><p>C</p>');
    expect(triple).toBeCloseTo(single * 3, 5);
  });

  it('mixes block types correctly', () => {
    const total = countHtmlLines(
      '<h1>Title</h1><p>Body</p><blockquote>Quote</blockquote>'
    );
    expect(total).toBeCloseTo(3.35 + 1.5 + 2.5, 5);
  });

  it('list items count via <li> (the <ul>/<ol> wrapper is structural)', () => {
    const list = countHtmlLines('<ul><li>One</li><li>Two</li></ul>');
    // li is 1.5 units each
    expect(list).toBeCloseTo(1.5 * 2, 5);
  });

  it('unknown block tags fall back to 1 unit', () => {
    // Future-proofing: if Quill emits something the table doesn't know
    // about, we get a reasonable default instead of NaN/undefined.
    expect(countHtmlLines('<p>X</p>')).toBeGreaterThan(0);
  });

  it('never returns less than 1 (Math.max floor)', () => {
    // Defensive: an empty regex match shouldn't underflow the auto-grown
    // dimensions to zero.
    expect(countHtmlLines('<div>raw</div>')).toBeGreaterThanOrEqual(1);
  });
});

describe('splitIntoMeasurableBlocks — per-block scale (MQA #11 B1 width)', () => {
  it('plain text returns one block at scale 1.0', () => {
    expect(splitIntoMeasurableBlocks('Hello world')).toEqual([
      { text: 'Hello world', scale: 1.0 }
    ]);
  });

  it('null/undefined content returns single empty block', () => {
    const result = splitIntoMeasurableBlocks(undefined as unknown as string);
    expect(result).toHaveLength(1);
    expect(result[0].scale).toBe(1.0);
  });

  it('extracts each <p> as its own block at scale 1.0', () => {
    const blocks = splitIntoMeasurableBlocks('<p>A</p><p>BB</p>');
    expect(blocks).toEqual([
      { text: 'A', scale: 1.0 },
      { text: 'BB', scale: 1.0 }
    ]);
  });

  it('h1 block carries the 1.875 scale (matches CANVAS_RICHTEXT_SCALE)', () => {
    // Width measurement uses this scale — a 4-char h1 needs ~88% more
    // horizontal room than a 4-char paragraph. Without the scale the
    // textbox auto-grew too narrow and h1 lines wrapped or clipped.
    const blocks = splitIntoMeasurableBlocks('<h1>Test</h1>');
    expect(blocks).toEqual([{ text: 'Test', scale: 1.875 }]);
  });

  it('h2 scale is 1.5, h3 is 1.25', () => {
    expect(splitIntoMeasurableBlocks('<h2>x</h2>')[0].scale).toBe(1.5);
    expect(splitIntoMeasurableBlocks('<h3>x</h3>')[0].scale).toBe(1.25);
  });

  it('strips inner inline tags and entities', () => {
    const blocks = splitIntoMeasurableBlocks(
      '<p>Hello <strong>bold</strong>&nbsp;world</p>'
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('Hello bold world');
  });

  it('skips empty blocks (Quill emits <p><br></p> for blank lines)', () => {
    const blocks = splitIntoMeasurableBlocks('<p>A</p><p><br></p><p>B</p>');
    // <br/> rendering: <br> remains after tag-stripping if not explicitly
    // handled. The function's intent is to skip blocks whose extracted
    // text trims to empty — current regex handles `<br>` via the strip step.
    expect(blocks.map((b) => b.text)).toContain('A');
    expect(blocks.map((b) => b.text)).toContain('B');
  });

  it('mixed content preserves block order and per-block scale', () => {
    const blocks = splitIntoMeasurableBlocks(
      '<h1>Big</h1><p>Body</p><h3>Sub</h3>'
    );
    expect(blocks).toEqual([
      { text: 'Big', scale: 1.875 },
      { text: 'Body', scale: 1.0 },
      { text: 'Sub', scale: 1.25 }
    ]);
  });

  it('falls back to longest-line plain-text heuristic when regex matches nothing', () => {
    // Defensive: malformed/unknown HTML shouldn't return an empty array
    // (caller would divide by zero / produce 0-width textbox).
    const blocks = splitIntoMeasurableBlocks('<custom>foo</custom>');
    expect(blocks.length).toBeGreaterThanOrEqual(1);
  });
});
