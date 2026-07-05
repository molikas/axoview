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
      // Post-decouple (ADR 0032 connector amendment) on-canvas text lives in
      // labels[]; the nameLabel* fields are inert round-trip legacy and the
      // stepper writes labels[].fontSize (ADR 0034).
      connSize: ((v.connectors ?? [])[0].labels ?? [])[0]?.fontSize ?? 18
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

    // Post-decouple (ADR 0032) a fresh connector has labels: [] and the
    // cross-type stepper deliberately no-ops on label-less connectors (ADR
    // 0034 — the legacy nameLabel* fields are inert). Give it an on-canvas
    // label the user way: F2 on the selected connector adds a midpoint label
    // and inline-edits it; Enter commits the seeded text.
    const { connId: freshConnId } = await view(page);
    await page.evaluate((cid) => {
      (window as any).__axoview__.ui
        .getState()
        .actions.setItemControls({ type: 'CONNECTOR', id: cid });
    }, freshConnId);
    // Let ConnectorLabels mount the selected connector's F2 listener, then drop
    // focus to the body (F2 only inline-edits from the renderer/body — MQA #13;
    // same choreography as connector-parity.spec).
    await page.waitForTimeout(300);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press('F2');
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const ui = (window as any).__axoview__.ui.getState();
            const views = (window as any).__axoview__.model.getState().views;
            const v = views.find((x: any) => x.id === ui.view) ?? views[0];
            return ((v.connectors ?? [])[0]?.labels ?? []).length;
          }),
        { timeout: 3_000 }
      )
      .toBe(1);
    // Type real text before committing — an empty just-added label is removed
    // on commit (empty labels never draw), which would leave the connector
    // label-less again and turn the stepper back into a no-op.
    await page.keyboard.type('sized');
    await page.keyboard.press('Enter');
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const ui = (window as any).__axoview__.ui.getState();
            const views = (window as any).__axoview__.model.getState().views;
            const v = views.find((x: any) => x.id === ui.view) ?? views[0];
            return ((v.connectors ?? [])[0]?.labels ?? []).length;
          }),
        { timeout: 3_000 }
      )
      .toBe(1);

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
