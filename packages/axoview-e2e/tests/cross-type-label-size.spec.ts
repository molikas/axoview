/**
 * cross-type-label-size.spec.ts — owner 2026-07-02.
 *
 * A mixed selection (e.g. a node + a connection) can't do the normal
 * homogeneous bulk styling, but the ONE shared attribute — on-canvas label font
 * size — is adjustable together via a relative +/- stepper, in one undo entry.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { placeIconViaMouse } from '../helpers/place';
import {
  getModelItemCount,
  getModelConnectorCount,
  getModelHistoryLength
} from '../helpers/store';

type Page = import('@playwright/test').Page;

const view = (page: Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const v = views.find((x: any) => x.id === ui.view) ?? views[0];
    return {
      nodeId: v.items[0].id,
      nodeSize: v.items[0].labelFontSize ?? 18,
      connId: (v.connectors ?? [])[0].id,
      connSize: (v.connectors ?? [])[0].nameLabelFontSize ?? 18
    };
  });

test.describe('Cross-type label size (mixed selection)', () => {
  test('bumping label size on a node + connection changes both in one undo', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const A = { x: 360, y: 280 };
    const B = { x: 560, y: 340 };
    await placeIconViaMouse(page, A);
    await placeIconViaMouse(page, B);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    await page.keyboard.press('c');
    await canvas.clickAt(A);
    await canvas.clickAt(B);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);
    await page.keyboard.press('s');

    const before = await view(page);

    // Mixed selection: node A + the connector (heterogeneous, both label-bearing).
    await page.evaluate(
      ({ nodeId, connId }) => {
        (window as any).__axoview__.ui
          .getState()
          .actions.setSelectedIds([
            { type: 'ITEM', id: nodeId },
            { type: 'CONNECTOR', id: connId }
          ]);
      },
      { nodeId: before.nodeId, connId: before.connId }
    );

    const historyBefore = await getModelHistoryLength(page);

    // The Text-size control is enabled for the mixed selection; bump label size.
    await page.locator('[data-testid="strip-text-size"]').click();
    await page.locator('[data-testid="crosstype-font-increase"]').click();

    await expect
      .poll(async () => {
        const v = await view(page);
        return `${v.nodeSize},${v.connSize}`;
      }, { timeout: 3_000 })
      .toBe('20,20'); // both stepped +2 from the 18px default

    // One undo entry for the whole cross-type fan-out.
    expect(await getModelHistoryLength(page)).toBe(historyBefore + 1);
  });
});
