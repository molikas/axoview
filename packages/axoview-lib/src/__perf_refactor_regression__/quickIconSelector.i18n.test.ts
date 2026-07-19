/**
 * REGRESSION — QuickIconSelector: hardcoded strings replaced with i18n.
 *
 * Originally these were hardcoded in JSX:
 *   "RECENTLY USED" / "SEARCH RESULTS ({n} icons)" / "No icons found …"
 *   plus a help footer and search placeholder.
 *
 * After the 2026-05 shake-out (UX §1.1, §1.5) the search input is the
 * shared `Searchbox` component (reused with the Elements panel), and the
 * help footer was dropped. So the only remaining quickIconSelector i18n
 * keys are recentlyUsed / searchResults / noIconsFound. The placeholder
 * comes from the searchbox namespace via Searchbox itself.
 *
 * Interpolation is done via .replace() since the lib's t() does not
 * support interpolation params.
 */

import * as fs from 'fs';
import * as path from 'path';

const QIS_PATH = path.resolve(
  __dirname,
  '../components/TopBarStyleControls/QuickIconSelector.tsx'
);

describe('QuickIconSelector — i18n strings', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(QIS_PATH, 'utf-8');
  });

  it('QuickIconSelector.tsx exists', () => {
    expect(fs.existsSync(QIS_PATH)).toBe(true);
  });

  it('imports useTranslation from localeStore', () => {
    expect(src).toContain("from 'src/stores/localeStore'");
    expect(src).toContain('useTranslation');
  });

  it('uses useTranslation("quickIconSelector") namespace', () => {
    expect(src).toContain("useTranslation('quickIconSelector')");
  });

  it('does not contain hardcoded "RECENTLY USED" string', () => {
    expect(src).not.toContain('RECENTLY USED');
    expect(src).toContain("t('recentlyUsed')");
  });

  it('does not contain hardcoded "SEARCH RESULTS" string', () => {
    expect(src).not.toContain('SEARCH RESULTS (');
    expect(src).toContain("t('searchResults')");
  });

  it('does not contain hardcoded "No icons found matching" string', () => {
    expect(src).not.toContain('No icons found matching');
    expect(src).toContain("t('noIconsFound')");
  });

  it('does not contain hardcoded "Type to search" help string (footer dropped in 2026-05 shake-out)', () => {
    expect(src).not.toContain('Type to search •');
    // helpBrowse / helpSearch were removed entirely; the input is now the shared Searchbox.
    expect(src).not.toContain("t('helpBrowse')");
    expect(src).not.toContain("t('helpSearch')");
  });

  it('does not contain hardcoded search placeholder (now provided by Searchbox)', () => {
    expect(src).not.toContain('Search icons (press Enter to select)');
    // searchPlaceholder was removed; Searchbox handles the placeholder via its own namespace.
    expect(src).not.toContain("t('searchPlaceholder')");
  });

  it('uses the shared Searchbox component for the search input', () => {
    expect(src).toContain('Searchbox');
  });

  it('uses .replace() for count interpolation in searchResults', () => {
    // The lib t() does not support object interpolation — must use string replace
    expect(src).toContain(".replace('{count}'");
  });

  it('uses .replace() for term interpolation in noIconsFound', () => {
    expect(src).toContain(".replace('{term}'");
  });
});
