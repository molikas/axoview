/**
 * empty-state-clickable-card.spec.ts — Thread F (tactical locked decision #8).
 *
 * The empty-state "New diagram" / "Import" cards are now fully clickable: the
 * whole card is a single CardActionArea and the blue pill is a non-interactive
 * label. J20 (smoke.spec) already covers clicking the hook centre; this spec
 * proves the WHOLE square is the target by clicking the icon region near the
 * top of each card (away from where the old inner button sat).
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { EmptyStateScreenPOM } from '../pom/EmptyStateScreenPOM';
import { byLibTestId } from '../helpers/selectors';
import { getModelItemCount, waitForDebugBridge } from '../helpers/store';

type Page = import('@playwright/test').Page;

const LOCAL_STORAGE_KEYS = [
  'axoview-diagrams',
  'axoview-last-opened',
  'axoview-last-opened-data',
  'axoview-explorer-initialized',
  'axoview-explorer-open'
];

const ONBOARDING_DISMISS_FLAGS: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];

async function pinOnboardingDismissed(page: Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function bootEmptyState(page: Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
  await page.reload();
}

test.describe('Empty state — Thread F: whole card is clickable', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
  });

  test('clicking the create card icon region (not the pill) opens a blank diagram', async ({
    page
  }) => {
    await bootEmptyState(page);
    const emptyState = new EmptyStateScreenPOM(page);
    await emptyState.expectVisible();

    await emptyState.clickCreateCardTop();

    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
    await waitForDebugBridge(page);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(0);
  });

  test('the import card has no nested button (single interactive element)', async ({
    page
  }) => {
    await bootEmptyState(page);
    const emptyState = new EmptyStateScreenPOM(page);
    await emptyState.expectVisible();

    // The hook sits on the CardActionArea <button>; it must not wrap another
    // <button> (the a11y trap locked decision #8 forbids).
    const nestedButtons = await emptyState
      .importButton()
      .locator('button')
      .count();
    expect(nestedButtons).toBe(0);
  });
});
