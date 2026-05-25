/**
 * multi-select-drag.spec.ts — v1.1 Track 5e-5.
 *
 * Multi-select + drag — the user-amended (2026-05-26) regression class:
 * a multi-selection that includes a connector waypoint must drag every
 * waypoint with the rest of the selection, rather than pinning the
 * waypoint while items translate.
 *
 * The regression class spans two seams in the lib:
 *
 *   (a) SELECTION — the lasso's `getItemsInBounds` (modes/Lasso.ts:100)
 *       must include `CONNECTOR_ANCHOR` refs for middle waypoints when
 *       the connector is path-hit. 5e-1's path-hit spec already pins the
 *       `CONNECTOR` ref side of this contract; `getConnectorWaypointRefs`
 *       coverage is exercised at the lib unit-test layer (`Lasso.modes.
 *       test.ts`). This spec deliberately does NOT depend on the lasso
 *       gesture's iso-coord landing to make the drag-side seam testable
 *       in isolation.
 *
 *   (b) DRAG — when DragItems' `mousemove` (`DragItems.ts:142`) sees a
 *       CONNECTOR_ANCHOR ref with a corresponding `initialTiles[id]`,
 *       it writes the offset tile into `previewAnchorTiles`. Mouseup
 *       commits the preview via `scene.updateConnector`. Pre-fix the
 *       initialTiles wasn't seeded for waypoints, so DragItems treated
 *       them as "anchor reconnect" and re-anchored to the cursor tile
 *       every frame — the visible bug.
 *
 * The clean way to drive seam (b) without depending on lasso-coord
 * placement is `Ctrl+A` which (useInteractionManager.ts:271-303)
 * collects every item + connector + waypoint ref into `selectedIds`,
 * switches to CURSOR mode, and lets `Cursor.mousemove`'s
 * `inMultiSelect` branch promote the click into a whole-selection drag.
 * This is what we use here. The pure-lasso variant is filed under
 * Findings #3 in the tactical (deferred to a follow-up session once a
 * deterministic lasso-coord harness exists).
 *
 * Lazy data-axoview-id retrofits — none.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { getModelConnectorCount, getModelItemCount, getUiMode } from '../helpers/store';

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

const getSelectedIdsCount = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () => ((window as any).__axoview__.ui.getState().selectedIds ?? []).length
  );

const injectMiddleWaypoint = (
  page: import('@playwright/test').Page,
  tile: { x: number; y: number },
  id = 'wp-test'
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
      return args;
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

test.describe('Multi-select + drag — Track 5e-5', () => {
  test('5e-5: Ctrl+A + drag preserves relative item positions across the group', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const ICON_A: CanvasPoint = { x: 380, y: 280 };
    const ICON_B: CanvasPoint = { x: 540, y: 360 };
    await placeIcon(page, ICON_A);
    await placeIcon(page, ICON_B);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    const before = await getViewItemTiles(page);
    expect(before).toHaveLength(2);

    // Ensure CURSOR; Ctrl+A flips to CURSOR if not already and seeds
    // selectedIds with every item + connector + waypoint ref.
    await page.keyboard.press('s');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe('CURSOR');
    await page.keyboard.press('Control+a');
    await expect
      .poll(() => getSelectedIdsCount(page), { timeout: 2_000 })
      .toBeGreaterThanOrEqual(2);

    // Drag from one icon to a target tile. Cursor.mousemove sees
    // inMultiSelect=true and promotes the click into a whole-selection
    // DRAG_ITEMS with initialTiles seeded for every selected ref.
    const DRAG_FROM: CanvasPoint = { x: 380, y: 280 };
    const DRAG_TO: CanvasPoint = { x: 480, y: 340 };
    await canvas.dragFromTo(DRAG_FROM, DRAG_TO);

    const after = await getViewItemTiles(page);
    expect(after).toHaveLength(2);
    const byId = new Map(after.map((a: any) => [a.id, a.tile]));
    const a0 = byId.get(before[0].id) as any;
    const a1 = byId.get(before[1].id) as any;
    expect(a0).toBeDefined();
    expect(a1).toBeDefined();
    // Relative offset preserved.
    expect(a1.x - a0.x).toBe(before[1].tile.x - before[0].tile.x);
    expect(a1.y - a0.y).toBe(before[1].tile.y - before[0].tile.y);
    // At least one item moved (the drag was non-empty).
    const moved =
      a0.x !== before[0].tile.x ||
      a0.y !== before[0].tile.y ||
      a1.x !== before[1].tile.x ||
      a1.y !== before[1].tile.y;
    expect(moved).toBe(true);
  });

  test('5e-5 waypoint-follows-multi-select-drag (2026-05-26 named regression class)', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Two icons + a connector between them.
    const ICON_A: CanvasPoint = { x: 380, y: 280 };
    const ICON_B: CanvasPoint = { x: 540, y: 360 };
    await placeIcon(page, ICON_A);
    await placeIcon(page, ICON_B);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    await page.keyboard.press('c');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe(
      'CONNECTOR'
    );
    await canvas.clickAt(ICON_A);
    await page.waitForTimeout(100);
    await canvas.clickAt(ICON_B);
    await expect.poll(() => getModelConnectorCount(page), { timeout: 5_000 }).toBe(1);

    // Inject a tile-bound middle waypoint via the model debug bridge.
    const WAYPOINT_TILE = { x: 1, y: 1 };
    await injectMiddleWaypoint(page, WAYPOINT_TILE);
    const waypointsBefore = await getWaypointTiles(page);
    expect(waypointsBefore).toHaveLength(1);
    expect(waypointsBefore[0].tile).toEqual(WAYPOINT_TILE);

    const itemsBefore = await getViewItemTiles(page);
    expect(itemsBefore).toHaveLength(2);

    // Return to CURSOR and select all (Ctrl+A includes connector +
    // every middle waypoint ref).
    await page.keyboard.press('s');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe(
      'CURSOR'
    );
    await page.keyboard.press('Control+a');
    // 2 items + 1 connector + 1 waypoint ref = 4 selected refs.
    await expect
      .poll(() => getSelectedIdsCount(page), { timeout: 2_000 })
      .toBeGreaterThanOrEqual(4);

    // Drag from one icon to a new tile.
    const DRAG_FROM: CanvasPoint = { x: 380, y: 280 };
    const DRAG_TO: CanvasPoint = { x: 460, y: 340 };
    await canvas.dragFromTo(DRAG_FROM, DRAG_TO);

    // Items + waypoint must all translate by the SAME delta.
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

    // Group cohesion.
    expect(itemDeltas[0]).toEqual(itemDeltas[1]);
    // The regression class: waypoint moves with the group, not pinned.
    expect(waypointDelta).toEqual(itemDeltas[0]);
    expect(itemDeltas[0].dx !== 0 || itemDeltas[0].dy !== 0).toBe(true);
  });
});
