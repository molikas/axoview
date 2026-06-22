import { sanitizeHtml } from '../sanitizeHtml';

describe('sanitizeHtml', () => {
  it('strips <script> entirely but keeps surrounding text', () => {
    const out = sanitizeHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).not.toMatch(/<script/i);
    expect(out).toContain('ok');
  });

  it('neutralises <img onerror> (drops the handler attribute)', () => {
    const out = sanitizeHtml('<img src=x onerror=alert(1)>');
    expect(out).not.toMatch(/onerror/i);
  });

  it('drops <svg onload> payloads (svg is not in the html profile)', () => {
    const out = sanitizeHtml('<svg onload=alert(1)></svg>');
    expect(out).not.toMatch(/onload/i);
    expect(out).not.toMatch(/<svg/i);
  });

  it('leaves no executable <script> after tag reassembly', () => {
    // A single-pass strip would re-form `<script>` from these fragments; the
    // DOM parser DOMPurify uses cannot be fooled this way.
    const out = sanitizeHtml('<scr<script>ipt>alert(1)</script>');
    expect(out).not.toMatch(/<script/i);
  });

  it('strips inline event handlers from otherwise-allowed tags', () => {
    const out = sanitizeHtml('<a href="https://example.com" onclick="alert(1)">x</a>');
    expect(out).not.toMatch(/onclick/i);
    expect(out).toContain('href');
  });

  it('preserves benign Quill formatting', () => {
    const out = sanitizeHtml('<p><strong>bold</strong> <em>italic</em></p>');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>italic</em>');
  });

  it('returns an empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('');
  });
});
