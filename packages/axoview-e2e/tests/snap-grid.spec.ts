/**
 * snap-grid.spec.ts — Track T8 (ADR 0023, off-grid positioning + per-item collision).
 *
 * The acceptance surface for #12 (global snap-to-grid toggle) and #20 (per-item
 * unsnap / disable collision). The integer tile stays the engine's source of
 * truth; off-grid lives ONLY in `viewItem.offset` (unprojected px) committed by
 * the one `resolvePlacement` chokepoint and applied as a post-projection render
 * translate. These tests read the model directly (debug bridge) and assert the
 * data-model invariants the rest of the engine relies on:
 *
 *   1. global snap OFF  → a drag commits a px `offset` while `tile` stays integer;
 *   2. per-item Unsnap (the context-menu handler) makes an item non-colliding, so
 *      it overlaps a neighbour instead of being pushed/blocked;
 *   3. the global toggle round-trips through persisted settings across a reload.
 *
 * Drag is driven by CanvasPOM's synthetic-pointer path (same as
 * drag-collision.spec); the menu handler is exercised by opening the context
 * menu via the store action and clicking the real MenuItem.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { getViewItemCount, waitForDebugBridge } from '../helpers/store';

type Page = import('@playwright/test').Page;

interface ViewItemSnapshot {
  id: string;
  tile: { x: number; y: number };
  offset?: { x: number; y: number };
  snap?: boolean;
  collides?: boolean;
}

const getViewItems = (page: Page): Promise<ViewItemSnapshot[]> =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    if (!Array.isArray(views) || views.length === 0) return [];
    const view =
      (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    return (view?.items ?? []).map((i: any) => ({
      id: i.id,
      tile: i.tile,
      offset: i.offset,
      snap: i.snap,
      collides: i.collides
    }));
  });

const getSnapToGrid = (page: Page): Promise<boolean> =>
  page.evaluate(() => (window as any).__axoview__.ui.getState().snapToGrid);

const setSnapToGrid = (page: Page, value: boolean): Promise<void> =>
  page.evaluate(
    (v: boolean) =>
      (window as any).__axoview__.ui.getState().actions.setSnapToGrid(v),
    value
  );

/** Places the first palette icon at a canvas-relative point (mirrors drag-collision.spec). */
async function placeIcon(page: Page, point: CanvasPoint) {
  const elementsToggle = byAxoviewId(page, 'dock-elements-toggle');
  const firstIcon = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (!(await firstIcon.isVisible().catch(() => false))) {
    await elementsToggle.click();
    await firstIcon.waitFor({ state: 'visible', timeout: 5_000 });
  }
  const canvas = byLibTestId(page, 'axoview-canvas');
  const iconBox = await firstIcon.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!iconBox || !canvasBox)
    throw new Error('placeIcon: icon or canvas missing a bounding box');
  await page.mouse.move(
    iconBox.x + iconBox.width / 2,
    iconBox.y + iconBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + point.x, canvasBox.y + point.y, {
    steps: 10
  });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test.describe('T8 — off-grid positioning & per-item collision (ADR 0023)', () => {
  test('global snap OFF: a drag commits a px offset while the tile stays integer (#12)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    await setSnapToGrid(page, false);
    expect(await getSnapToGrid(page)).toBe(false);

    const place: CanvasPoint = { x: 400, y: 300 };
    await placeIcon(page, place);
    await expect.poll(() => getViewItemCount(page), { timeout: 5_000 }).toBe(1);

    // A deliberately sub-tile, off-axis drag: the floored tile is unlikely to
    // change, but an off-grid commit must record a non-zero px residual.
    const to: CanvasPoint = { x: place.x + 34, y: place.y + 19 };
    await canvas.dragFromTo(place, to);
    await page.waitForTimeout(150);

    const [item] = await getViewItems(page);
    expect(item).toBeTruthy();
    // The load-bearing invariant: tile is still an integer.
    expect(Number.isInteger(item.tile.x)).toBe(true);
    expect(Number.isInteger(item.tile.y)).toBe(true);
    // Off-grid: a px residual was committed.
    expect(item.offset).toBeTruthy();
    expect(Math.abs(item.offset!.x) + Math.abs(item.offset!.y)).toBeGreaterThan(1);
  });

  test('per-item Unsnap (context menu) lets an item overlap a neighbour without collision (#20, KR3)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Default global snap ON, so neighbours snap normally.
    await setSnapToGrid(page, true);

    const A: CanvasPoint = { x: 360, y: 300 };
    const B: CanvasPoint = { x: 540, y: 360 };
    await placeIcon(page, A);
    await placeIcon(page, B);
    await expect.poll(() => getViewItemCount(page), { timeout: 5_000 }).toBe(2);

    const before = await getViewItems(page);
    // The item placed at A is the drag subject; B is its neighbour.
    const subject = before[before.length === 2 ? 0 : 0];

    // Open the item context menu for the subject via the store action and click
    // the real "Unsnap from grid" entry (exercises the T8 menu handler).
    await page.evaluate((id: string) => {
      (window as any).__axoview__.ui.getState().actions.openContextMenu({
        anchor: { x: 200, y: 200 },
        variant: 'item',
        target: { type: 'ITEM', id }
      });
    }, subject.id);
    await page.getByRole('menuitem', { name: /Unsnap from grid/i }).click();

    await expect
      .poll(
        async () =>
          (await getViewItems(page)).find((i) => i.id === subject.id)?.snap,
        { timeout: 3_000 }
      )
      .toBe(false);

    // Drag the unsnapped item onto its neighbour. With collision implied off it
    // is NOT blocked — it lands on (overlaps) the neighbour's tile.
    await canvas.dragFromTo(A, B);
    await page.waitForTimeout(150);

    const after = await getViewItems(page);
    const movedSubject = after.find((i) => i.id === subject.id)!;
    const neighbour = after.find((i) => i.id !== subject.id)!;
    // Overlap: the two items now share an integer tile (the unsnapped one was
    // not pushed away, and the neighbour did not move).
    expect(movedSubject.tile).toEqual(neighbour.tile);
  });

  test('the global snap-to-grid toggle round-trips through persisted settings across reload', async ({
    page,
    app
  }) => {
    void app;

    await setSnapToGrid(page, false);
    // The persist effect writes localStorage on the next tick.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            try {
              return JSON.parse(
                localStorage.getItem('axoview_user_settings') || '{}'
              ).snapToGrid;
            } catch {
              return undefined;
            }
          }),
        { timeout: 3_000 }
      )
      .toBe(false);

    // Reload: the store re-initialises from persisted settings (same mechanism
    // as canvasMode). The fixture keeps the diagram in localStorage, so the
    // bridge re-attaches.
    await page.reload();
    await waitForDebugBridge(page);
    expect(await getSnapToGrid(page)).toBe(false);
  });
});
