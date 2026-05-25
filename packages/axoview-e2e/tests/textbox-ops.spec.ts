/**
 * textbox-ops.spec.ts — v1.1 Track 5h textbox coverage.
 *
 * Existing shapes.spec.ts (J3) covers textbox creation via the 't'
 * hotkey + persistence across reload. This spec adds the post-
 * creation delete contract:
 *
 *   delete — Delete key on a selected textbox routes through
 *            useInteractionManager.ts:211 -> scene.deleteTextBox.
 *            Non-cascading.
 *
 * Deferred 5h textbox sub-rows (filed as Finding #7 in
 * v1.1-test-coverage.md):
 *   - text edit via inline editor — needs the lib's TextBox edit
 *     mode entry path; F2 on canvas surface routes to the
 *     `inlineEditNodeName` custom event, intended for item names
 *     (ItemControls inline-rename), not the textbox content.
 *     TextBox text editing flows through a Quill-backed editor
 *     mounted by TextBoxControls; entering edit mode in tests
 *     requires either the controls panel click-to-edit handle or
 *     the in-canvas double-click path. Both need source-read +
 *     anchor retrofits.
 *   - resize (TransformRectangle on the textbox bounds) — same iso
 *     tile->screen helper requirement as rectangle resize.
 *
 * Lazy data-axoview-id retrofits — none.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { getViewTextBoxCount } from '../helpers/store';

const getFirstTextBoxId = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const tb = (view?.textBoxes ?? [])[0];
    return tb?.id ?? null;
  });

const selectTextBoxViaItemControls = (
  page: import('@playwright/test').Page,
  id: string
) =>
  page.evaluate((tbId: string) => {
    const ui = (window as any).__axoview__.ui;
    ui.getState().actions.setItemControls({ type: 'TEXTBOX', id: tbId });
  }, id);

test.describe('Textbox ops — Track 5h', () => {
  test('5h textbox: Delete on a selected textbox removes it; other textboxes survive', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Two textboxes so the surviving-items contract is testable.
    const TB_A: CanvasPoint = { x: 380, y: 280 };
    const TB_B: CanvasPoint = { x: 540, y: 360 };
    await canvas.placeTextBoxAt(TB_A);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);
    await canvas.placeTextBoxAt(TB_B);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(2);

    const firstId = await getFirstTextBoxId(page);
    expect(firstId).toBeTruthy();
    await selectTextBoxViaItemControls(page, firstId!);

    await page.keyboard.press('Delete');
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);
    const remainingId = await getFirstTextBoxId(page);
    expect(remainingId).not.toBe(firstId);
  });
});
