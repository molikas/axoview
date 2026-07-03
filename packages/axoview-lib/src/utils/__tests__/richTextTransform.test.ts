/**
 * ADR 0034 §2 — whole-content transforms behind the strip's dual-scope format
 * cluster. These pin the "text box selected (not editing)" path: pressed-state
 * detection and apply/remove across the full content, for HTML and plain-text
 * content alike. Only Quill-whitelisted tags may be emitted (strong/em/u/s/
 * p/ul/ol/li) so the next live-editor session round-trips the result.
 */
import {
  plainTextToHtml,
  ensureHtmlContent,
  isHtmlContent,
  getWholeContentFormats,
  applyInlineFormat,
  applyListFormat
} from '../richTextTransform';

describe('plainTextToHtml / ensureHtmlContent', () => {
  it('escapes HTML-significant characters and wraps lines in <p>', () => {
    expect(plainTextToHtml('<todo> & "fix"')).toBe(
      '<p>&lt;todo&gt; &amp; &quot;fix&quot;</p>'
    );
  });

  it('keeps blank lines as <p><br></p>', () => {
    expect(plainTextToHtml('a\n\nb')).toBe('<p>a</p><p><br></p><p>b</p>');
  });

  it('passes HTML content through and converts plain text', () => {
    expect(isHtmlContent('<p>x</p>')).toBe(true);
    expect(isHtmlContent('plain')).toBe(false);
    expect(ensureHtmlContent('<p>x</p>')).toBe('<p>x</p>');
    expect(ensureHtmlContent('plain')).toBe('<p>plain</p>');
    expect(ensureHtmlContent('')).toBe('');
  });
});

describe('getWholeContentFormats', () => {
  it('reports nothing for plain text and empty content', () => {
    expect(getWholeContentFormats('hello')).toEqual({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      list: null
    });
    expect(getWholeContentFormats('')).toEqual({
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      list: null
    });
    expect(getWholeContentFormats(undefined).bold).toBe(false);
  });

  it('detects a format only when the ENTIRE content carries it', () => {
    expect(getWholeContentFormats('<p><strong>a</strong></p>').bold).toBe(true);
    expect(getWholeContentFormats('<p><strong>a</strong> b</p>').bold).toBe(
      false
    );
    expect(
      getWholeContentFormats('<p><strong>a</strong></p><p>b</p>').bold
    ).toBe(false);
    // Browser-synonym tags count when reading.
    expect(getWholeContentFormats('<p><b>a</b></p>').bold).toBe(true);
    expect(getWholeContentFormats('<p><u>a</u></p>').underline).toBe(true);
    expect(getWholeContentFormats('<p><s>a</s></p>').strike).toBe(true);
    expect(getWholeContentFormats('<p><em>a</em></p>').italic).toBe(true);
  });

  it('detects a uniform list and rejects mixed structures', () => {
    expect(getWholeContentFormats('<ul><li>a</li><li>b</li></ul>').list).toBe(
      'bullet'
    );
    expect(getWholeContentFormats('<ol><li>a</li></ol>').list).toBe('ordered');
    expect(
      getWholeContentFormats('<p>a</p><ul><li>b</li></ul>').list
    ).toBeNull();
  });
});

describe('applyInlineFormat', () => {
  it('bolds plain-text content (escaped + wrapped)', () => {
    expect(applyInlineFormat('hello', 'bold', true)).toBe(
      '<p><strong>hello</strong></p>'
    );
  });

  it('wraps every leaf block, skipping already-covered ones', () => {
    const out = applyInlineFormat(
      '<p><strong>a</strong></p><p>b</p>',
      'bold',
      true
    );
    expect(out).toBe('<p><strong>a</strong></p><p><strong>b</strong></p>');
    expect(getWholeContentFormats(out).bold).toBe(true);
  });

  it('removes the format including synonym tags and nesting', () => {
    const out = applyInlineFormat(
      '<p><strong>a <b>c</b></strong></p><p><b>b</b></p>',
      'bold',
      false
    );
    expect(out).toBe('<p>a c</p><p>b</p>');
  });

  it('formats list items in place', () => {
    const out = applyInlineFormat('<ul><li>a</li><li>b</li></ul>', 'underline', true);
    expect(out).toBe('<ul><li><u>a</u></li><li><u>b</u></li></ul>');
  });

  it('round-trips apply → remove back to the unformatted content', () => {
    const on = applyInlineFormat('<p>a</p><p>b</p>', 'strike', true);
    expect(applyInlineFormat(on, 'strike', false)).toBe('<p>a</p><p>b</p>');
  });
});

describe('applyListFormat', () => {
  it('converts paragraphs to one list, preserving inline formatting', () => {
    expect(
      applyListFormat('<p><strong>a</strong></p><p>b</p>', 'bullet', true)
    ).toBe('<ul><li><strong>a</strong></li><li>b</li></ul>');
  });

  it('converts plain text lines to list items', () => {
    expect(applyListFormat('a\nb', 'ordered', true)).toBe(
      '<ol><li>a</li><li>b</li></ol>'
    );
  });

  it('flattens legacy headers into items (block format replaced)', () => {
    expect(applyListFormat('<h1>Title</h1><p>x</p>', 'bullet', true)).toBe(
      '<ul><li>Title</li><li>x</li></ul>'
    );
  });

  it('re-typing an existing list swaps the container', () => {
    expect(
      applyListFormat('<ul><li>a</li><li>b</li></ul>', 'ordered', true)
    ).toBe('<ol><li>a</li><li>b</li></ol>');
  });

  it('unwraps lists back to paragraphs', () => {
    expect(
      applyListFormat('<ul><li><em>a</em></li><li>b</li></ul>', 'bullet', false)
    ).toBe('<p><em>a</em></p><p>b</p>');
  });
});
