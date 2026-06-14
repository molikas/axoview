/**
 * touch-tap-place.spec — ADR 0018 §5.1 P0. The headline SELECT → GRAB → PLACE
 * flow: tap a node (select) → tap it again (grab, mode = CARRY_ITEM) → tap a
 * free tile (the node relocates there). Asserts the relocation lands on the
 * tapped tile and NOT at the corner (the old (0,0) touch-synthesis bug).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { placeIconViaMouse, clearCanvasForTouch } from '../helpers/place';
import { getModelItemCount, getUiMode } from '../helpers/store';

const nodeTile = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === viewId) ?? views[0];
    return view.items[0].tile as { x: number; y: number };
  });

test.describe('Touch — tap to place (SELECT → GRAB → PLACE)', () => {
  test('tap → tap-same (grab) → tap-target relocates the node; no corner jump', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);

    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await clearCanvasForTouch(page);

    const origin = await nodeTile(page);

    // Tap 1 — select.
    await touch.tapTile(origin);
    // Tap 2 — grab (same node) → CARRY_ITEM.
    await touch.tapTile(origin);
    await expect
      .poll(async () => (await getUiMode(page)).type, { timeout: 5_000 })
      .toBe('CARRY_ITEM');

    // Tap 3 — a free target tile a few tiles away → PLACE.
    const target = { x: origin.x + 3, y: origin.y + 2 };
    await touch.tapTile(target);

    // Back to a non-carry mode, and the node moved to (near) the target — and
    // crucially NOT to the corner (0,0).
    await expect
      .poll(async () => (await getUiMode(page)).type, { timeout: 5_000 })
      .not.toBe('CARRY_ITEM');

    const placed = await nodeTile(page);
    expect(placed).not.toEqual(origin);
    expect(placed).not.toEqual({ x: 0, y: 0 });
    // Nearest-free placement: within one tile of the requested target.
    expect(Math.abs(placed.x - target.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(placed.y - target.y)).toBeLessThanOrEqual(1);
  });
});
