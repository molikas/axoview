/**
 * connector-parity.spec.ts — connector name↔label decouple (ADR 0032 connector
 * amendment, 2026-07-02).
 *
 * Owner: "decouple connection name and label the same way we did with nodes...
 * on a connection clicking F2 would try to add a new label."
 *
 * Pins the headline invariant: F2 on a selected connector ADDS a new midpoint
 * labels[] entry and inline-edits it (rather than renaming the identity `name`,
 * which is now Layers-only and never drawn). Typing + Enter commits the label.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { placeIconViaMouse } from '../helpers/place';
import { getModelItemCount, getModelConnectorCount } from '../helpers/store';

type Page = import('@playwright/test').Page;

const firstConnector = (page: Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const v = views.find((x: any) => x.id === ui.view) ?? views[0];
    const c = (v.connectors ?? [])[0];
    return c
      ? { id: c.id, name: c.name ?? null, labels: c.labels ?? [] }
      : null;
  });

const selectConnector = (page: Page, id: string) =>
  page.evaluate((cid) => {
    (window as any).__axoview__.ui
      .getState()
      .actions.setItemControls({ type: 'CONNECTOR', id: cid });
  }, id);

test.describe('Connector name↔label decouple (#3)', () => {
  test('F2 on a connector adds a new midpoint label and inline-edits it', async ({
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

    const before = await firstConnector(page);
    expect(before).not.toBeNull();
    // A freshly-drawn connector carries no name and no labels.
    expect(before!.labels).toHaveLength(0);

    // Select the connector, then F2 → adds a labels[] entry + opens the inline
    // editor for it.
    await selectConnector(page, before!.id);
    // Let ConnectorLabels mount the (label-less) selected connector's
    // ConnectorLabel so its F2 listener is attached; then drop focus back to the
    // document body (the on-canvas condition — F2 only inline-edits when the
    // keystroke came from the renderer/body, MQA #13) before pressing F2.
    await page.waitForTimeout(300);
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await page.keyboard.press('F2');

    // F2 adds a new (empty) labels[] entry at the model level first.
    await expect
      .poll(async () => (await firstConnector(page))!.labels.length, {
        timeout: 3_000
      })
      .toBe(1);

    const editor = page.locator('[contenteditable="true"]').last();
    await editor.waitFor({ state: 'visible', timeout: 3_000 });
    await editor.click();
    await page.keyboard.type('routes to');
    await page.keyboard.press('Enter');

    // The new label is committed with the typed text; identity `name` is untouched
    // (F2 grows the label set, it does not rename the connector).
    await expect
      .poll(
        async () => (await firstConnector(page))!.labels.map((l: any) => l.text),
        { timeout: 3_000 }
      )
      .toContain('routes to');
    expect((await firstConnector(page))!.name).toBeNull();
  });
});
