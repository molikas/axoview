/**
 * multi-select-drag-lasso.spec.ts — v1.1 Finding #4 (KR2 helper-consumer).
 *
 * The pure-lasso variant of the 5e-5 waypoint-follows-multi-select-drag
 * regression class. The Ctrl+A path is already pinned by
 * `multi-select-drag.spec.ts`; that spec uses Ctrl+A deliberately because
 * before KR1 there was no deterministic way to start a drag INSIDE the
 * lasso selection (no tile→screen helper). Finding #4 in
 * `docs/tactical/v1.1-test-coverage.md` is the deferred row that this
 * spec closes.
 *
 * Now that `CanvasPOM.tileToScreen` projects a known tile to a known
 * interactions-box pixel (KR1 commit), the pure-lasso path is testable:
 *
 *   1. Place ICON_A + ICON_B at known canvas pixels (existing flow).
 *   2. Connect them, inject a middle waypoint at a free tile.
 *   3. Compute a lasso rect that encloses BOTH items + the waypoint —
 *      project each tile via `tileToScreen` and take the bounding box +
 *      margin.
 *   4. Drag the lasso (`l` hotkey + `dragFromTo`). Selection is populated
 *      by Lasso.mousemove → `getItemsInBounds` (2 items + 1 connector via
 *      path-hit + 1 CONNECTOR_ANCHOR via the waypoint fallback).
 *   5. Start a SECOND drag whose mousedown lands on ICON_A's tile —
 *      Lasso.mousedown sees `isWithinSelection` and sets `isDragging`;
 *      the next mousemove switches to DRAG_ITEMS with `initialTiles`
 *      seeded for items + waypoint (Lasso.ts:173-183).
 *   6. Assert items and waypoint translated by the SAME delta.
 *
 * The pure-lasso flow exercises the lasso-side selection seam
 * (`getConnectorWaypointRefs` collection + path-hit semantics) AND the
 * Lasso.mousemove → DRAG_ITEMS handoff at the waypoint-seeded boundary —
 * the Ctrl+A path bypasses both.
 *
 * Lazy data-axoview-id retrofits — none.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  getModelConnectorCount,
  getModelItemCount,
  getUiMode
} from '../helpers/store';

const getUiModeType = async (page: import('@playwright/test').Page) => {
  const mode = await getUiMode(page);
  return mode?.type ?? null;
};

const getViewItemTiles = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    if (!Array.isArray(views) || views.length === 0) return [];
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    return (view?.items ?? []).map((i: any) => ({ id: i.id, tile: i.tile }));
  });

const getWaypointTiles = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    if (!Array.isArray(views) || views.length === 0) return [];
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const out: Array<{ id: string; tile: { x: number; y: number } }> = [];
    for (const c of view?.connectors ?? []) {
      for (let i = 1; i < c.anchors.length - 1; i += 1) {
        const a = c.anchors[i];
        if (a?.ref?.tile) out.push({ id: a.id, tile: a.ref.tile });
      }
    }
    return out;
  });

const getLassoSelectionTypes = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const m = (window as any).__axoview__.ui.getState().mode;
    if (m?.type !== 'LASSO') return [];
    return ((m.selection?.items as any[]) ?? []).map((r) => r.type);
  });

const injectMiddleWaypoint = (
  page: import('@playwright/test').Page,
  tile: { x: number; y: number },
  id = 'wp-lasso-test'
) =>
  page.evaluate(
    (args: { tile: { x: number; y: number }; id: string }) => {
      const m = (window as any).__axoview__.model;
      const ui = (window as any).__axoview__.ui;
      const viewId = ui.getState().view;
      const state = m.getState();
      const views = state.views.map((v: any) => {
        if (v.id !== viewId) return v;
        return {
          ...v,
          connectors: v.connectors.map((c: any, idx: number) => {
            if (idx !== 0) return c;
            const start = c.anchors[0];
            const end = c.anchors[c.anchors.length - 1];
            return {
              ...c,
              anchors: [start, { id: args.id, ref: { tile: args.tile } }, end]
            };
          })
        };
      });
      m.setState({ views });
    },
    { tile, id }
  );

async function placeIcon(
  page: import('@playwright/test').Page,
  point: CanvasPoint
) {
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

test.describe('Multi-select + drag — Finding #4 (pure-lasso 5e-5 variant)', () => {
  test('pure-lasso variant: lasso a group with waypoint, drag the selection, waypoint follows', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // 1. Two icons + connector + injected middle waypoint.
    const ICON_A_PIXEL: CanvasPoint = { x: 380, y: 280 };
    const ICON_B_PIXEL: CanvasPoint = { x: 540, y: 360 };
    await placeIcon(page, ICON_A_PIXEL);
    await placeIcon(page, ICON_B_PIXEL);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    await page.keyboard.press('c');
    await expect
      .poll(() => getUiModeType(page), { timeout: 2_000 })
      .toBe('CONNECTOR');
    await canvas.clickAt(ICON_A_PIXEL);
    await page.waitForTimeout(100);
    await canvas.clickAt(ICON_B_PIXEL);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);

    const itemsBefore = await getViewItemTiles(page);
    expect(itemsBefore).toHaveLength(2);

    // Pick a waypoint tile that's inside the bounding box of the two
    // items' tiles so it sits naturally within the lasso rect.
    const minItemX = Math.min(itemsBefore[0].tile.x, itemsBefore[1].tile.x);
    const minItemY = Math.min(itemsBefore[0].tile.y, itemsBefore[1].tile.y);
    const WAYPOINT_TILE = { x: minItemX + 1, y: minItemY + 1 };
    await injectMiddleWaypoint(page, WAYPOINT_TILE);
    const waypointsBefore = await getWaypointTiles(page);
    expect(waypointsBefore).toHaveLength(1);

    // 2. Lasso mode + drag a rect that encloses both items + waypoint.
    //    Project each tile to a screen pixel via the new helper and take
    //    the bounding box. Margin > halfW/halfH so the iso-projected tile
    //    diamond is fully covered.
    await page.keyboard.press('l');
    await expect
      .poll(() => getUiModeType(page), { timeout: 2_000 })
      .toBe('LASSO');

    const tilesToEnclose = [
      itemsBefore[0].tile,
      itemsBefore[1].tile,
      WAYPOINT_TILE
    ];
    const screenPts = await Promise.all(
      tilesToEnclose.map((t) => canvas.tileToScreen(t))
    );
    const xs = screenPts.map((p) => p.x);
    const ys = screenPts.map((p) => p.y);
    const LASSO_MARGIN = 100; // > half-projected-tile in either axis (70.75 / 40.95)
    const LASSO_FROM: CanvasPoint = {
      x: Math.min(...xs) - LASSO_MARGIN,
      y: Math.min(...ys) - LASSO_MARGIN
    };
    const LASSO_TO: CanvasPoint = {
      x: Math.max(...xs) + LASSO_MARGIN,
      y: Math.max(...ys) + LASSO_MARGIN
    };
    await canvas.dragFromTo(LASSO_FROM, LASSO_TO);

    // Selection must contain BOTH items + the connector (path-hit) + at
    // least one CONNECTOR_ANCHOR (the waypoint fallback at Lasso.ts:133).
    const selTypes = await getLassoSelectionTypes(page);
    expect(selTypes.filter((t: string) => t === 'ITEM').length).toBe(2);
    expect(selTypes).toContain('CONNECTOR');

    // 3. SECOND drag — mousedown on ICON_A's tile (inside the selection
    //    bounds). Lasso.mousedown sets isDragging=true; the next
    //    mousemove transitions to DRAG_ITEMS with initialTiles seeded
    //    for items + waypoint (Lasso.ts:155-185).
    const iconAScreen = await canvas.tileToScreen(itemsBefore[0].tile);
    const DRAG_TO: CanvasPoint = {
      x: iconAScreen.x + 120,
      y: iconAScreen.y + 80
    };
    await canvas.dragFromTo(iconAScreen, DRAG_TO);

    // 4. Items + waypoint translate by the SAME delta.
    const itemsAfter = await getViewItemTiles(page);
    const waypointsAfter = await getWaypointTiles(page);
    expect(waypointsAfter).toHaveLength(1);

    const byIdA = new Map(itemsAfter.map((i: any) => [i.id, i.tile]));
    const itemDeltas = itemsBefore.map((b: any) => {
      const a = byIdA.get(b.id) as any;
      return { dx: a.x - b.tile.x, dy: a.y - b.tile.y };
    });
    const waypointDelta = {
      dx: waypointsAfter[0].tile.x - waypointsBefore[0].tile.x,
      dy: waypointsAfter[0].tile.y - waypointsBefore[0].tile.y
    };

    expect(itemDeltas[0]).toEqual(itemDeltas[1]);
    expect(waypointDelta).toEqual(itemDeltas[0]);
    expect(itemDeltas[0].dx !== 0 || itemDeltas[0].dy !== 0).toBe(true);
  });
});
