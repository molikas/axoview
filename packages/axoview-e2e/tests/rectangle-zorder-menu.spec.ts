/**
 * rectangle-zorder-menu.spec.ts — Slice S1 (#2 rectangle z-order).
 *
 * The 2026-06-30 UX sweep owner-item #2: a big rectangle must be able to sit
 * BEHIND smaller rectangles stacked on top. Rectangles were pure insertion
 * order; S1 added an optional `zIndex` and wired the canvas context-menu
 * "Bring forward" / "Send backward" commands (canZOrder now includes
 * RECTANGLE; nudgeZOrder dispatches scene.updateRectangle for RECTANGLE).
 *
 * Contract pinned here: opening a rectangle's context menu and clicking
 * "Bring forward" bumps that rectangle's `zIndex` by +1 in the model;
 * "Send backward" decrements it. The render sort (Rectangles.tsx) consumes
 * this — the reducer/schema units pin the data path, this pins the menu wiring
 * end-to-end. The menu is opened via the store's openContextMenu action with a
 * RECTANGLE target (the same payload usePanHandlers builds on right-tap), then
 * the visible MenuItem is clicked by its label.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { getViewRectangleCount } from '../helpers/store';

type Page = import('@playwright/test').Page;

const firstRectangle = (page: Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view =
      (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const r = (view?.rectangles ?? [])[0];
    return r ? { id: r.id, zIndex: r.zIndex ?? 0 } : null;
  });

const openRectMenu = (page: Page, id: string) =>
  page.evaluate((rectId: string) => {
    const ui = (window as any).__axoview__.ui.getState();
    ui.actions.setSelectedIds([{ type: 'RECTANGLE', id: rectId }]);
    ui.actions.openContextMenu({
      anchor: { x: 200, y: 200 },
      variant: 'item',
      target: { type: 'RECTANGLE', id: rectId }
    });
  }, id);

test.describe('Rectangle z-order via context menu — Slice S1 (#2)', () => {
  test('Bring forward / Send backward nudge a rectangle zIndex', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Draw one rectangle (tile-coord drag → deterministic 4x4).
    const from = await canvas.tileToScreen({ x: -2, y: -2 });
    const to = await canvas.tileToScreen({ x: 2, y: 2 });
    await canvas.switchToRectangleMode();
    await canvas.dragFromTo(from, to);
    await expect
      .poll(() => getViewRectangleCount(page), { timeout: 5_000 })
      .toBe(1);

    const rect = await firstRectangle(page);
    expect(rect).not.toBeNull();
    expect(rect!.zIndex).toBe(0);

    // Bring forward → zIndex +1.
    await openRectMenu(page, rect!.id);
    await page.getByText('Bring forward', { exact: true }).click();
    await expect
      .poll(async () => (await firstRectangle(page))!.zIndex, { timeout: 3_000 })
      .toBe(1);

    // Send backward → back to 0.
    await openRectMenu(page, rect!.id);
    await page.getByText('Send backward', { exact: true }).click();
    await expect
      .poll(async () => (await firstRectangle(page))!.zIndex, { timeout: 3_000 })
      .toBe(0);
  });
});
