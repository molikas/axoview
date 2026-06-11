/**
 * annotation-overlay.spec.ts — Thread C (ADR 0014).
 *
 * The ephemeral annotation overlay: pen entry opens a draggable palette; a
 * draw tool paints strokes on top of the canvas; collapse HIDES the drawing
 * (retaining strokes), expand shows it again; Clear wipes; and — the
 * load-bearing invariant — nothing reaches the saved model.
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { waitForDebugBridge } from '../helpers/store';

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

async function bootBlankDiagram(page: Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
}

const annotation = (page: Page): Promise<any> =>
  page.evaluate(() => (window as any).__axoview__.ui.getState().annotation);

const strokeCount = async (page: Page): Promise<number> =>
  (await annotation(page)).strokes.length;

/** Draw a freehand stroke across the canvas with the active tool. */
async function drawStroke(page: Page) {
  const box = await byLibTestId(page, 'axoview-canvas').boundingBox();
  if (!box) throw new Error('no canvas box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 60, cy - 30);
  await page.mouse.down();
  await page.mouse.move(cx - 20, cy + 10, { steps: 4 });
  await page.mouse.move(cx + 50, cy + 40, { steps: 4 });
  await page.mouse.up();
}

test.describe('Annotation overlay — Thread C (ADR 0014)', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('pen opens the palette; draw adds a stroke; collapse hides / expand shows; clear wipes', async ({
    page
  }) => {
    // Pen entry visible, palette closed.
    const pen = byAxoviewId(page, 'annotation-pen');
    await expect(pen).toBeVisible();
    await expect(byAxoviewId(page, 'annotation-palette')).toHaveCount(0);

    // Open the palette.
    await pen.click();
    await expect(byAxoviewId(page, 'annotation-palette')).toBeVisible();
    expect((await annotation(page)).open).toBe(true);

    // Draw a stroke with the default pencil tool.
    await drawStroke(page);
    await expect.poll(() => strokeCount(page), { timeout: 3_000 }).toBe(1);
    await expect(byAxoviewId(page, 'annotation-layer')).toBeVisible();

    // Collapse → drawing hidden (overlay unmounts) but the stroke is retained.
    await byAxoviewId(page, 'annotation-collapse').click();
    await expect(byAxoviewId(page, 'annotation-layer')).toHaveCount(0);
    expect(await strokeCount(page)).toBe(1);

    // Expand → drawing shown again, same stroke.
    await byAxoviewId(page, 'annotation-collapse').click();
    await expect(byAxoviewId(page, 'annotation-layer')).toBeVisible();
    expect(await strokeCount(page)).toBe(1);

    // Clear → wipes everything.
    await byAxoviewId(page, 'annotation-clear').click();
    await expect.poll(() => strokeCount(page), { timeout: 3_000 }).toBe(0);
  });

  test('drawn strokes never enter the saved model', async ({ page }) => {
    await byAxoviewId(page, 'annotation-pen').click();
    await drawStroke(page);
    await expect.poll(() => strokeCount(page), { timeout: 3_000 }).toBeGreaterThan(0);

    // The model store (what gets saved/exported) carries no annotation data.
    const modelJson = await page.evaluate(() => {
      const m = (window as any).__axoview__.model.getState();
      return JSON.stringify({
        version: m.version,
        title: m.title,
        description: m.description,
        colors: m.colors,
        icons: m.icons,
        items: m.items,
        views: m.views
      });
    });
    expect(modelJson).not.toContain('annotation');
    expect(modelJson).not.toContain('strokes');
  });
});
