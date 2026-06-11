import {
  hasInfoPopoverContent,
  toHref
} from 'src/components/ViewModeInfoPopover/ViewModeInfoPopover.helpers';

describe('hasInfoPopoverContent (ADR 0012 content gate)', () => {
  it('is false when name, notes, and headerLink are all empty/absent', () => {
    expect(hasInfoPopoverContent(undefined, undefined, undefined)).toBe(false);
    expect(hasInfoPopoverContent('', '', '')).toBe(false);
    expect(hasInfoPopoverContent('   ', undefined, undefined)).toBe(false);
    // Notes markup with no visible text does not count.
    expect(hasInfoPopoverContent('', '<p><br></p>', undefined)).toBe(false);
    expect(hasInfoPopoverContent('', '<p>   </p>', undefined)).toBe(false);
  });

  it('is true when there is a non-empty name', () => {
    expect(hasInfoPopoverContent('Database', undefined, undefined)).toBe(true);
  });

  it('is true when notes carry visible text', () => {
    expect(hasInfoPopoverContent('', '<p>See runbook</p>', undefined)).toBe(true);
  });

  it('is true when a headerLink is present even with no name/notes', () => {
    expect(hasInfoPopoverContent('', undefined, 'example.com')).toBe(true);
  });
});

describe('toHref', () => {
  it('leaves absolute http(s) links untouched', () => {
    expect(toHref('https://a.com')).toBe('https://a.com');
    expect(toHref('http://a.com')).toBe('http://a.com');
  });

  it('prefixes schemeless links with https://', () => {
    expect(toHref('example.com')).toBe('https://example.com');
    expect(toHref('example.com/path')).toBe('https://example.com/path');
  });
});
