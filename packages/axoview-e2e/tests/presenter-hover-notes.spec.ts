/**
 * presenter-hover-notes.spec.ts — presenter-mode hover popover = notes-only.
 *
 * Owner (2026-07-01): in EXPLORABLE_READONLY the on-hover ViewModeInfoPopover
 * should appear ONLY when the hovered node has notes (and surface them) — a
 * name-only node must NOT pop an empty label-only popover. A pinned click still
 * shows the full details surface (unchanged).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { placeIconViaMouse } from '../helpers/place';
import { getModelItemCount } from '../helpers/store';

type Page = import('@playwright/test').Page;

const items = (page: Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === ui.view) ?? views[0];
    return (view.items ?? []).map((vi: any) => ({ id: vi.id, tile: vi.tile }));
  });

const setNotes = (page: Page, id: string, notes: string) =>
  page.evaluate(
    ({ id, notes }) => {
      const model = (window as any).__axoview__.model;
      const all = model.getState().items as any[];
      model.getState().actions.set({
        items: all.map((it) => (it.id === id ? { ...it, notes } : it))
      });
    },
    { id, notes }
  );

const setPresent = (page: Page) =>
  page.evaluate(() =>
    (window as any).__axoview__.ui
      .getState()
      .actions.setEditorMode('EXPLORABLE_READONLY')
  );

const popover = (page: Page) =>
  page.locator('[data-axoview-id="view-mode-info-popover"]');

test.describe('Presenter hover popover — notes-only', () => {
  test('hover shows the popover only when the node has notes', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    await placeIconViaMouse(page, { x: 360, y: 280 });
    await placeIconViaMouse(page, { x: 560, y: 340 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    const [a, b] = await items(page);
    await setNotes(page, b.id, 'Handles the write path.'); // only B has notes
    await setPresent(page);

    // Hover A (no notes) → no popover.
    await canvas.dispatchAt(['mousemove'], await canvas.tileToScreen(a.tile));
    await page.waitForTimeout(400);
    await expect(popover(page)).toHaveCount(0);

    // Hover B (has notes) → popover appears and shows the notes.
    await canvas.dispatchAt(['mousemove'], await canvas.tileToScreen(b.tile));
    await expect(popover(page)).toBeVisible({ timeout: 3_000 });
    await expect(
      page.locator('[data-axoview-id="view-mode-info-popover-notes"]')
    ).toBeVisible();

    // Move back to A → popover dismisses (no notes there).
    await canvas.dispatchAt(['mousemove'], await canvas.tileToScreen(a.tile));
    await expect(popover(page)).toHaveCount(0);
  });
});
