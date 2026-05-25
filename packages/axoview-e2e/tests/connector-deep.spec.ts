/**
 * connector-deep.spec.ts — v1.1 Track 5e connector-deep coverage.
 *
 * Connector lifecycle gestures beyond create/delete-via-lasso (5e-1)
 * and create-across-boundaries (5e-2). This spec covers the
 * delete-via-Delete-key path on a single selected connector, which is
 * the most-load-bearing untested gesture for the connector lifecycle.
 *
 * The Delete-key handler in useInteractionManager.ts:193-218 reads
 * `uiState.itemControls`. If itemControls.type === 'CONNECTOR' and
 * the keyboard target isn't a text-editing element, the handler calls
 * `scene.deleteConnector(ctrl.id)` and clears itemControls. This is
 * the user-facing equivalent of right-click + delete from the
 * context menu, but driven by hotkey.
 *
 * Deferred sub-rows of connector-deep coverage (filed as Finding #4
 * in v1.1-test-coverage.md):
 *   - Waypoint add via the in-UI mousedown+drag-on-path gesture
 *     (Cursor.mousemove:304-310 -> getAnchor). Needs reliable click
 *     placement on the rendered connector path.
 *   - Connector style controls (color, line style, arrowhead) — needs
 *     ConnectorControls.tsx surface read + several new data-axoview-id
 *     retrofits on the right-sidebar panel.
 *   - Half-attached endpoint reconnect (ReconnectAnchor mode entry on
 *     endpoint click — Cursor.mousedown:155-167).
 * Each is its own follow-up session; the breadth (delete + anchor
 * types) is sufficient for the v1.1 wrap.
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

const getFirstConnectorId = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const c = (view?.connectors ?? [])[0];
    return c?.id ?? null;
  });

const selectConnectorViaItemControls = (
  page: import('@playwright/test').Page,
  connectorId: string
) =>
  page.evaluate((id: string) => {
    const ui = (window as any).__axoview__.ui;
    ui.getState().actions.setItemControls({
      type: 'CONNECTOR',
      id,
      tile: { x: 0, y: 0 }
    });
  }, connectorId);

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

test.describe('Connector-deep — delete-via-Delete-key', () => {
  test('connector-deep: Delete on a selected connector removes only the connector, items survive', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);

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

    // Return to CURSOR and select the connector via the debug bridge.
    // Real-mouse single-click on the connector path lands somewhere
    // along the iso-projected path geometry; using setItemControls
    // pins the selection deterministically without depending on the
    // rendered path's hit ring. The contract under test is the
    // Delete-key handler, not the click-to-select path.
    await page.keyboard.press('s');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe('CURSOR');
    const connectorId = await getFirstConnectorId(page);
    expect(connectorId).toBeTruthy();
    await selectConnectorViaItemControls(page, connectorId!);

    // Press Delete — useInteractionManager.ts:208 routes
    // itemControls.type === 'CONNECTOR' through scene.deleteConnector
    // and clears itemControls.
    await page.keyboard.press('Delete');
    await expect.poll(() => getModelConnectorCount(page), { timeout: 5_000 }).toBe(0);
    // Items survive — the Delete contract on a connector is non-
    // cascading; only the connector is removed.
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);
  });
});
