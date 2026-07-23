/**
 * Off-grid (ADR 0023) e2e helpers, shared by `off-grid-pointer.spec.ts` and the
 * off-grid cases in `snap-grid.spec.ts`.
 *
 * The load-bearing one is {@link drawnClientPoint}: everything about the
 * off-grid bug cluster is the gap between an item's grid CELL and where it is
 * DRAWN, so a spec that can only address the cell cannot see those bugs. These
 * helpers drive real `page.mouse` (locked decision 7) — the synthetic-pointer
 * POM path dispatches straight at the interactions box and skips
 * `document.elementFromPoint`, which is where two of the seven bugs lived.
 */
import { Page } from '@playwright/test';
import { byAxoviewId, byLibTestId } from './selectors';

export type Point = { x: number; y: number };
export type Box = { x: number; y: number; width: number; height: number };

export interface OffGridItem {
  id: string;
  tile: Point;
  offset?: Point;
  snap?: boolean;
}

export const getOffGridItems = (page: Page): Promise<OffGridItem[]> =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const view =
      (ui.view && views.find((v: any) => v.id === ui.view)) ?? views[0];
    return (view?.items ?? []).map((i: any) => ({
      id: i.id,
      tile: i.tile,
      offset: i.offset,
      snap: i.snap
    }));
  });

export const setSnapToGrid = (page: Page, value: boolean): Promise<void> =>
  page.evaluate(
    (v: boolean) =>
      (window as any).__axoview__.ui.getState().actions.setSnapToGrid(v),
    value
  );

export const getContextMenu = (page: Page) =>
  page.evaluate(() => {
    const cm = (window as any).__axoview__.ui.getState().contextMenu;
    return cm
      ? { variant: cm.variant, targetType: cm.target?.type ?? null }
      : null;
  });

export const getHoveredItemId = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().hoveredItem?.id ?? null
  );

/**
 * Absolute client coords of the point an item is DRAWN at: its tile projection
 * plus its committed px residual, scaled by zoom.
 *
 * Mirrors the lib's `toScreen` (as `CanvasPOM.tileToScreen` does —
 * `iso-helper-smoke.spec.ts` is the canary if that math moves) and then adds the
 * offset, because the offset is a post-projection SceneLayer translate: it is
 * NOT projected, it is added after. Pass `{...item, offset: undefined}` to get
 * the bare grid cell instead — the pairing "drawn here, cell there" is what
 * these specs assert.
 */
export const drawnClientPoint = (page: Page, item: OffGridItem): Promise<Point> =>
  page.evaluate((it: OffGridItem) => {
    const ui = (window as any).__axoview__.ui.getState();
    const box = document.querySelector(
      '[data-axoview-id="canvas-interactions"]'
    ) as HTMLElement;
    const rect = box.getBoundingClientRect();
    const UNPROJ = 100;
    const iso = ui.canvasMode !== '2D';
    const halfW = iso ? (UNPROJ * 1.415) / 2 : UNPROJ / 2;
    const halfH = iso ? (UNPROJ * 0.819) / 2 : UNPROJ / 2;
    const cx = iso ? halfW * it.tile.x - halfW * it.tile.y : it.tile.x * UNPROJ;
    const cy = iso
      ? -(halfH * it.tile.x + halfH * it.tile.y)
      : -it.tile.y * UNPROJ;
    const sceneX = cx + (it.offset?.x ?? 0);
    const sceneY = cy + (it.offset?.y ?? 0);
    return {
      x:
        rect.left +
        ui.rendererSize.width / 2 +
        ui.scroll.position.x +
        sceneX * ui.zoom,
      y:
        rect.top +
        ui.rendererSize.height / 2 +
        ui.scroll.position.y +
        sceneY * ui.zoom
    };
  }, item);

export const centreOf = (box: Box): Point => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2
});

export async function realDrag(page: Page, from: Point, to: Point) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** Drag-and-drop the first palette icon onto a canvas-relative point. */
export async function placeIconRealMouse(page: Page, pt: Point) {
  const gridItem = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (!(await gridItem.isVisible().catch(() => false))) {
    await byAxoviewId(page, 'dock-elements-toggle').click();
  }
  await gridItem.waitFor({ state: 'visible', timeout: 5_000 });
  const canvasBox = await byLibTestId(page, 'axoview-canvas').boundingBox();
  const iconBox = await gridItem.boundingBox();
  if (!canvasBox || !iconBox) throw new Error('placeIcon: missing bbox');
  await realDrag(
    page,
    { x: iconBox.x + iconBox.width / 2, y: iconBox.y + iconBox.height / 2 },
    { x: canvasBox.x + pt.x, y: canvasBox.y + pt.y }
  );
}

export async function closeElementsPanel(page: Page) {
  const gridItem = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (await gridItem.isVisible().catch(() => false)) {
    await byAxoviewId(page, 'dock-elements-toggle').click();
    await gridItem.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
}

/**
 * Park the cursor, then settle it on `at`.
 *
 * Hover recomputes only when the cursor crosses into a new tile
 * (`hasMovedTile`), and the recomputation lags the position by one move event —
 * a pre-existing quirk unrelated to off-grid (snapped items behave the same) and
 * invisible to a user, whose mouse emits a stream of moves. A single scripted
 * move would land before the evaluation, so send the extra pixel.
 */
export async function hoverAt(page: Page, park: Point, at: Point) {
  await page.mouse.move(park.x, park.y);
  await page.waitForTimeout(100);
  await page.mouse.move(at.x, at.y);
  await page.mouse.move(at.x + 1, at.y);
}
