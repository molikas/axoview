import { stripHtmlTags } from '../stripHtml';

describe('stripHtmlTags', () => {
  it('removes tags and keeps the text content', () => {
    expect(stripHtmlTags('<p>hello</p>')).toBe('hello');
    expect(stripHtmlTags('<b>a</b><i>b</i>')).toBe('ab');
    expect(stripHtmlTags('<div class="x">A</div> <span>B</span>')).toBe('A B');
  });

  it('leaves plain text and the empty string untouched', () => {
    expect(stripHtmlTags('just text')).toBe('just text');
    expect(stripHtmlTags('')).toBe('');
  });

  it('leaves no complete tag in the output (the fixpoint guard)', () => {
    for (const input of [
      '<p>x</p>',
      '<a<b>c>',
      '<<script>>',
      '<img src=x onerror=alert(1)>'
    ]) {
      expect(/<[^>]*>/.test(stripHtmlTags(input))).toBe(false);
    }
  });

  it('is idempotent', () => {
    const once = stripHtmlTags('<a<b>c>d<e>');
    expect(stripHtmlTags(once)).toBe(once);
  });
});
