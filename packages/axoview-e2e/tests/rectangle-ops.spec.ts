/**
 * rectangle-ops.spec.ts — v1.1 Track 5h rectangle coverage.
 *
 * The existing shapes.spec.ts (J3) covers rectangle creation +
 * persistence. This spec adds the post-creation delete contract:
 *
 *   delete — Delete key on a selected rectangle routes through
 *            useInteractionManager.ts:213 -> scene.deleteRectangle.
 *            Non-cascading; other rectangles survive.
 *
 * Deferred 5h rectangle sub-rows (filed as Finding #6 in
 * v1.1-test-coverage.md):
 *   - move via drag — requires clicking on a tile INSIDE the
 *     rectangle's tile-coord bounds, which needs an iso-projection
 *     helper to convert tile coords back to screen pixels. The
 *     Cursor.mousedown getItemAtTile lookup gates the drag, so a
 *     screen-pixel approximation isn't reliable.
 *   - resize (TransformRectangle mode) — entering the mode requires
 *     clicking a corner handle whose tile depends on iso projection,
 *     same problem.
 * Both deferred to a follow-up session once a tile->screen helper
 * exists in CanvasPOM.
 *
 * Lazy data-axoview-id retrofits — none. The rectangle is created via
 * the existing 'r' hotkey; selection uses debug-bridge setItemControls.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { getViewRectangleCount, getUiMode } from '../helpers/store';

const getUiModeType = async (page: import('@playwright/test').Page) => {
  const mode = await getUiMode(page);
  return mode?.type ?? null;
};

const getFirstRectangle = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const r = (view?.rectangles ?? [])[0];
    if (!r) return null;
    return { id: r.id, from: r.from, to: r.to };
  });

const selectRectangleViaItemControls = (
  page: import('@playwright/test').Page,
  id: string
) =>
  page.evaluate((rectId: string) => {
    const ui = (window as any).__axoview__.ui;
    ui.getState().actions.setItemControls({ type: 'RECTANGLE', id: rectId });
  }, id);

test.describe('Rectangle ops — Track 5h', () => {
  test('5h rectangle: Delete on a selected rectangle removes it; other rectangles survive', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Two rectangles so the surviving-items contract is testable.
    await canvas.switchToRectangleMode();
    await canvas.dragFromTo({ x: 260, y: 220 }, { x: 360, y: 320 });
    await expect.poll(() => getViewRectangleCount(page), { timeout: 5_000 }).toBe(1);
    await canvas.switchToRectangleMode();
    await canvas.dragFromTo({ x: 460, y: 340 }, { x: 560, y: 440 });
    await expect.poll(() => getViewRectangleCount(page), { timeout: 5_000 }).toBe(2);

    // Select the first rectangle via the debug bridge — clicking on
    // a rectangle's tile in iso projection without knowing the tile
    // mapping is brittle; setItemControls pins the selection
    // deterministically.
    const first = await getFirstRectangle(page);
    expect(first).not.toBeNull();
    await selectRectangleViaItemControls(page, first!.id);

    await page.keyboard.press('Delete');
    await expect.poll(() => getViewRectangleCount(page), { timeout: 5_000 }).toBe(1);
    // The remaining rectangle is the OTHER one (the one we did not
    // select).
    const remaining = await getFirstRectangle(page);
    expect(remaining!.id).not.toBe(first!.id);
  });
});
