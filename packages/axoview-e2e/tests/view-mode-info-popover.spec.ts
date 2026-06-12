/**
 * view-mode-info-popover.spec.ts — Thread A (ADR 0012).
 *
 * In view-only mode an item's name/notes/link surface via a canvas-anchored
 * popover instead of the right editing dock. This spec covers:
 *   - hover (with intent) → lightweight preview popover (not pinned);
 *   - pinned popover content: name, clickable headerLink (target=_blank),
 *     read-only notes; closes via the X button and via Esc.
 *
 * editorMode is forced to EXPLORABLE_READONLY via the debug bridge (the app
 * drives it from a prop and only re-syncs on prop change, so the override
 * sticks). The pinned state is driven via setItemControls — the same state a
 * click produces; the click→select wiring is existing, separately-covered
 * behavior, while the popover's render-from-state is what this thread adds.
 */
import path from 'path';
import { appTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { EmptyStateScreenPOM } from '../pom/EmptyStateScreenPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { waitForDebugBridge } from '../helpers/store';

type Page = import('@playwright/test').Page;

const ONBOARDING_DISMISS_FLAGS: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];
const LOCAL_STORAGE_KEYS = [
  'axoview-diagrams',
  'axoview-last-opened',
  'axoview-last-opened-data',
  'axoview-explorer-initialized',
  'axoview-explorer-open'
];
const FIXTURE_JSON = path.join(__dirname, '..', 'fixtures', 'view-mode-info-diagram.json');

async function pinOnboardingDismissed(page: Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function importFixtureInViewMode(page: Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
  await page.reload();
  const emptyState = new EmptyStateScreenPOM(page);
  await emptyState.expectVisible();
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5_000 }),
    emptyState.clickImport()
  ]);
  await fileChooser.setFiles(FIXTURE_JSON);
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
  await page.evaluate(() => {
    (window as any).__axoview__.ui.getState().actions.setEditorMode('EXPLORABLE_READONLY');
  });
}

const pinItem = (page: Page, id: string, tile: { x: number; y: number }): Promise<void> =>
  page.evaluate(
    (args: { id: string; tile: { x: number; y: number } }) => {
      (window as any).__axoview__.ui
        .getState()
        .actions.setItemControls({ type: 'ITEM', id: args.id, tile: args.tile });
    },
    { id, tile }
  );

test.describe('View-mode info popover — Thread A (ADR 0012)', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await importFixtureInViewMode(page);
  });

  test('pinned popover shows name + clickable headerLink + notes; X and Esc close it', async ({
    page
  }) => {
    const popover = byAxoviewId(page, 'view-mode-info-popover');
    await expect(popover).toHaveCount(0);

    await pinItem(page, 'info-item-a', { x: 0, y: 0 });
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute('data-axoview-pinned', 'true');
    await expect(popover).toContainText('Alpha service');

    // headerLink is a real, safe, new-tab link.
    const link = byAxoviewId(page, 'view-mode-info-popover-link');
    await expect(link).toHaveAttribute('href', 'https://example.com/alpha');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);

    // Read-only notes are present.
    await expect(byAxoviewId(page, 'view-mode-info-popover-notes')).toBeVisible();

    // X closes it.
    await byAxoviewId(page, 'view-mode-info-popover-close').click();
    await expect(popover).toHaveCount(0);

    // Re-pin, then Esc closes it.
    await pinItem(page, 'info-item-a', { x: 0, y: 0 });
    await expect(popover).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(popover).toHaveCount(0);
  });

  test('hovering an item shows an unpinned preview; moving away closes it', async ({
    page
  }) => {
    const canvas = new CanvasPOM(page);
    const popover = byAxoviewId(page, 'view-mode-info-popover');
    await expect(popover).toHaveCount(0);

    // Hover over Beta (tile 3,0) — name-only item still has popover content.
    const betaPos = await canvas.tileToScreen({ x: 3, y: 0 });
    await canvas.dispatchAt(['mousemove'], betaPos);
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute('data-axoview-pinned', 'false');
    await expect(popover).toContainText('Beta service');

    // Move to an empty tile far away — the preview closes.
    const emptyPos = await canvas.tileToScreen({ x: 12, y: 9 });
    await canvas.dispatchAt(['mousemove'], emptyPos);
    await expect(popover).toHaveCount(0);
  });

  test('popover side-anchors to the RIGHT of the item, and flips LEFT near the right edge', async ({
    page
  }) => {
    const canvas = new CanvasPOM(page);
    const popover = byAxoviewId(page, 'view-mode-info-popover');

    const setScrollX = (x: number) =>
      page.evaluate((sx: number) => {
        (window as any).__axoview__.ui
          .getState()
          .actions.setScroll({ position: { x: sx, y: 0 }, offset: { x: 0, y: 0 } });
      }, x);
    const rendererWidth = (): Promise<number> =>
      page.evaluate(
        () => (window as any).__axoview__.ui.getState().rendererSize.width
      );

    // --- Normal case: item centered → popover sits to the RIGHT of it. ---
    await setScrollX(0); // tile (0,0) lands at the viewport horizontal center
    await pinItem(page, 'info-item-a', { x: 0, y: 0 });
    await expect(popover).toBeVisible();

    let nodeScreen = await canvas.tileToScreen({ x: 0, y: 0 });
    await expect
      .poll(async () => (await popover.boundingBox())?.x ?? -1, { timeout: 3_000 })
      .toBeGreaterThan(nodeScreen.x);

    // --- Flip case: push the item to the right edge → popover flips LEFT. ---
    const w = await rendererWidth();
    await setScrollX(w / 2 - 60); // node now ~60px from the right edge
    nodeScreen = await canvas.tileToScreen({ x: 0, y: 0 });
    // The popover re-anchors on scroll; its whole box now sits left of the node.
    await expect
      .poll(
        async () => {
          const b = await popover.boundingBox();
          return b ? b.x + b.width : Infinity;
        },
        { timeout: 3_000 }
      )
      .toBeLessThan(nodeScreen.x);
  });
});
