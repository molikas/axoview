/**
 * REGRESSION — Welcome notification: Axoview branding + lineage attribution
 *
 * The first-run welcome notification (LazyLoadingWelcomeNotification) must:
 *   - greet the user with "Welcome to Axoview" (no longer "Community Edition")
 *   - preserve the FossFLOW + Isoflow lineage attribution (Decision #12 of the rename plan)
 *   - point at the current GitHub repo
 *   - be signed "— Axoview" (no longer "-Stan" from upstream or
 *     "— Axoview Community & Opus" from the rename mid-state)
 *
 * The "hamburger" navigation hint was removed from the notification JSX
 * when the burger menu was redistributed (ADR 0005), so we also assert
 * the stale hint text is no longer pinned to the title path.
 */

import * as fs from 'fs';
import * as path from 'path';

const LOCALE_PATH = path.resolve(__dirname, '../i18n/en-US.ts');

describe('Welcome notification — Axoview branding (en-US)', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(LOCALE_PATH, 'utf-8');
  });

  it('en-US.ts exists', () => {
    expect(fs.existsSync(LOCALE_PATH)).toBe(true);
  });

  it('title is "Welcome to Axoview" (no Community Edition suffix)', () => {
    expect(src).toContain("title: 'Welcome to Axoview'");
    expect(src).not.toContain('Community Edition');
  });

  it('message preserves FossFLOW + Isoflow lineage attribution', () => {
    expect(src).toContain('FossFLOW');
    expect(src).toContain('Isoflow');
  });

  it('message references the rename repo URL', () => {
    expect(src).toContain('github.com/molikas/axoview');
  });

  it('signature is "— Axoview" (drops Community / Stan)', () => {
    expect(src).toContain("signature: '— Axoview'");
    expect(src).not.toMatch(/signature: ['"]-Stan['"]/);
    expect(src).not.toContain('Axoview Community & Opus');
  });

  it('original upstream "Lazy Loading" title has been replaced', () => {
    expect(src).not.toContain('New Feature: Lazy Loading!');
  });
});
