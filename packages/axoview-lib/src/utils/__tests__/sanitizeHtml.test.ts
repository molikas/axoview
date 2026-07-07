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

  it('forces rel="noopener noreferrer" on rendered links', () => {
    const out = sanitizeHtml('<a href="https://example.com">x</a>');
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(out).toMatch(/rel="[^"]*noreferrer[^"]*"/);
  });

  it('overrides an attacker-supplied rel on a link', () => {
    const out = sanitizeHtml(
      '<a href="https://example.com" rel="opener">x</a>'
    );
    expect(out).not.toMatch(/rel="opener"/);
    expect(out).toMatch(/noopener/);
  });
});

// ADR 0034 addendum 2026-07-03 — paragraph alignment rides on inline
// `text-align` styles (Quill style attributor). The DOMPurify html profile
// must keep the style attribute (it CSS-sanitizes the value) or alignment
// would silently vanish on load/commit.
describe('sanitizeHtml — alignment styles', () => {
  const { sanitizeHtml } = require('../sanitizeHtml');

  it('keeps inline text-align styles on paragraphs and list items', () => {
    expect(sanitizeHtml('<p style="text-align: center;">a</p>')).toContain(
      'text-align: center'
    );
    expect(
      sanitizeHtml('<ul><li style="text-align: right;">a</li></ul>')
    ).toContain('text-align: right');
  });

  it('still strips scripting alongside a style attribute', () => {
    const out = sanitizeHtml(
      '<p style="text-align: center;" onclick="alert(1)">a</p><script>x</script>'
    );
    expect(out).toContain('text-align: center');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('<script');
  });
});
