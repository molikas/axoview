/**
 * bulk-style.spec.ts — Slice S4 (#7 bulk styling + #11 bulk label font-size).
 *
 * ADR 0030 §2 amendment: the docked style strip now acts on a HOMOGENEOUS
 * multi-selection — each control fans its write out across the whole selection
 * in ONE transaction (a single undo entry). #11 adds a relative +/- font-size
 * stepper that nudges each selected target from its own size.
 *
 * Pins the load-bearing invariants on the node-label font-size stepper (the
 * most directly driveable bulk control; it shares applyToTargets/transaction
 * with every other strip writer): select 2 nodes → bump size → BOTH change and
 * it is a SINGLE undo entry.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { placeIconViaMouse } from '../helpers/place';
import { getModelItemCount, getModelHistoryLength } from '../helpers/store';

type Page = import('@playwright/test').Page;

const nodeFontSizes = (page: Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === ui.view) ?? views[0];
    return (view.items ?? []).map((i: any) => i.labelFontSize ?? 18);
  });

const selectedCount = (page: Page) =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().selectedIds.length
  );

test.describe('Bulk styling — Slice S4 (#7 / #11)', () => {
  test('bulk font-size stepper bumps every selected node in one undo entry', async ({
    page,
    app
  }) => {
    void app;

    await placeIconViaMouse(page, { x: 360, y: 280 });
    await placeIconViaMouse(page, { x: 560, y: 340 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    // Select all → homogeneous 2-node selection (itemControls null, bulk active).
    await page.keyboard.press('Control+a');
    await expect.poll(() => selectedCount(page), { timeout: 3_000 }).toBe(2);

    expect(await nodeFontSizes(page)).toEqual([18, 18]);
    const historyBefore = await getModelHistoryLength(page);

    // Open the Text size popover and bump up — fans out to both nodes.
    await page.locator('[data-testid="strip-text-size"]').click();
    await page.locator('[data-testid="bulk-font-increase"]').click();

    await expect
      .poll(() => nodeFontSizes(page), { timeout: 3_000 })
      .toEqual([20, 20]);

    // Single undo entry for the whole fan-out.
    expect(await getModelHistoryLength(page)).toBe(historyBefore + 1);

    // Undo reverts BOTH in one step.
    await page.keyboard.press('Escape'); // close popover
    await page.keyboard.press('Control+z');
    await expect
      .poll(() => nodeFontSizes(page), { timeout: 3_000 })
      .toEqual([18, 18]);
  });
});
