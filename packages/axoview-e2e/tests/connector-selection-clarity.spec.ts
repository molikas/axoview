/**
 * connector-selection-clarity.spec.ts — Slice S3 (A2 + #5).
 *
 * A2 (strongest UX-sweep finding): connectors had NO selected-state — a
 * selected connector was indistinguishable in a dense diagram. S3 renders a
 * wide semi-transparent accent halo under a selected connector
 * (`[data-testid="connector-selection-halo"]`).
 *
 * #5: click-SELECTION now uses exact connector tiles, so clicking an empty tile
 * beside a connector segment clears the selection instead of grabbing the
 * connector. (Hover / reconnect keep the ±1 halo — covered by the hit-detection
 * unit tests.)
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { placeIconViaMouse } from '../helpers/place';
import { getModelConnectorCount, getItemControls } from '../helpers/store';

type Page = import('@playwright/test').Page;

// Global tiles of the active view's first connector path (origin - localTile).
const connectorGlobalTiles = (page: Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === ui.view) ?? views[0];
    const con = (view.connectors ?? [])[0];
    if (!con) return null;
    const sceneCon = (window as any).__axoview__.scene.getState().connectors[
      con.id
    ];
    const path = sceneCon?.path;
    if (!path?.tiles?.length) return null;
    const o = path.rectangle.from;
    return {
      id: con.id,
      tiles: path.tiles.map((t: any) => ({ x: o.x - t.x, y: o.y - t.y }))
    };
  });

const occupiedTiles = (page: Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const view = views.find((v: any) => v.id === ui.view) ?? views[0];
    return (view.items ?? []).map((i: any) => `${i.tile.x},${i.tile.y}`);
  });

test.describe('Connector selection clarity — Slice S3 (A2 + #5)', () => {
  test('selecting a connector shows the halo; an empty adjacent tile clears it (#5)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const A = { x: 360, y: 280 };
    const B = { x: 560, y: 340 };
    await placeIconViaMouse(page, A);
    await placeIconViaMouse(page, B);

    // Draw a connector A→B (click-interaction mode; `c` enters CONNECTOR mode).
    await page.keyboard.press('c');
    await canvas.clickAt(A);
    await canvas.clickAt(B);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);

    await page.keyboard.press('s'); // CURSOR mode

    const path = await connectorGlobalTiles(page);
    expect(path).not.toBeNull();
    const occupied = new Set(await occupiedTiles(page));

    // A path tile that is NOT a node tile — the connector's own selectable tile.
    const onLine = path!.tiles.find(
      (t) => !occupied.has(`${t.x},${t.y}`)
    );
    expect(onLine).toBeTruthy();

    // Select the connector by clicking its exact path tile.
    await canvas.clickAt(await canvas.tileToScreen(onLine!));
    await expect
      .poll(async () => (await getItemControls(page))?.type ?? null, {
        timeout: 3_000
      })
      .toBe('CONNECTOR');

    // A2: the selection halo is now rendered.
    await expect(
      page.locator('[data-testid="connector-selection-halo"]')
    ).toBeVisible();

    // #5: an empty tile beside the segment (not a path tile, not occupied) must
    // CLEAR the selection rather than re-grab the connector.
    const isPathTile = (t: { x: number; y: number }) =>
      path!.tiles.some((p) => p.x === t.x && p.y === t.y);
    const neighbour = [
      { x: onLine!.x, y: onLine!.y + 1 },
      { x: onLine!.x, y: onLine!.y - 1 },
      { x: onLine!.x + 1, y: onLine!.y },
      { x: onLine!.x - 1, y: onLine!.y }
    ].find((t) => !isPathTile(t) && !occupied.has(`${t.x},${t.y}`));
    expect(neighbour).toBeTruthy();

    await canvas.clickAt(await canvas.tileToScreen(neighbour!));
    await expect
      .poll(async () => (await getItemControls(page))?.type ?? null, {
        timeout: 3_000
      })
      .toBe(null);
  });
});
