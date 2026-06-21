import { htmlToPlainText, decodeHtmlEntities } from '../htmlToPlainText';

// A1: the canvas/label/measurement text path must decode HTML entities (Quill
// stores rich text as HTML, so a literal "&nbsp;" otherwise reaches ctx.fillText).
describe('decodeHtmlEntities (decode-only — the plain-text name path)', () => {
  it('decodes the common named entities', () => {
    expect(decodeHtmlEntities('a&nbsp;b')).toBe('a b');
    expect(decodeHtmlEntities('R&amp;D')).toBe('R&D');
    expect(decodeHtmlEntities('&lt;tag&gt;')).toBe('<tag>');
    expect(decodeHtmlEntities('say &quot;hi&quot;')).toBe('say "hi"');
  });

  it('decodes numeric (decimal + hex) entities', () => {
    expect(decodeHtmlEntities('it&#39;s')).toBe("it's");
    expect(decodeHtmlEntities('&#65;&#66;')).toBe('AB');
    expect(decodeHtmlEntities('&#x41;&#x42;')).toBe('AB');
  });

  it('decodes left-to-right so a decoded & is not re-read as an entity head', () => {
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
    expect(decodeHtmlEntities('&amp;nbsp;')).toBe('&nbsp;');
  });

  it('does NOT strip tags — a legitimate name like List<T> survives intact', () => {
    // The name is rendered verbatim by the DOM overlay; stripping would corrupt
    // it and break canvas/DOM hybrid parity (ADR 0019).
    expect(decodeHtmlEntities('List<T>')).toBe('List<T>');
    expect(decodeHtmlEntities('a < b && c')).toBe('a < b && c');
  });

  it('leaves a bare ampersand and unknown entities untouched', () => {
    expect(decodeHtmlEntities('Tom & Jerry')).toBe('Tom & Jerry');
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
  });

  it('handles undefined / empty', () => {
    expect(decodeHtmlEntities(undefined)).toBe('');
    expect(decodeHtmlEntities('')).toBe('');
  });
});

describe('htmlToPlainText (strip + decode — the HTML caption path)', () => {
  it('strips tags AND decodes entities (the A1 caption fix)', () => {
    expect(htmlToPlainText('<p>foo&nbsp;bar</p>')).toBe('foo bar');
    expect(htmlToPlainText('<p>a&amp;b</p>')).toBe('a&b');
    expect(htmlToPlainText('<strong>x</strong>&#39;y')).toBe("x'y");
  });

  it('decodes encoded angle brackets to visible text after stripping real tags', () => {
    // Mirrors the DOM RichTextEditor, which renders &lt;script&gt; as the
    // visible text "<script>", not as an element.
    expect(htmlToPlainText('<p>&lt;script&gt;</p>')).toBe('<script>');
  });

  it('leaves no complete tag in the output', () => {
    expect(/<[^>]*>/.test(htmlToPlainText('<a<b>c>hello'))).toBe(false);
  });

  it('handles undefined / empty', () => {
    expect(htmlToPlainText(undefined)).toBe('');
    expect(htmlToPlainText('')).toBe('');
  });
});
