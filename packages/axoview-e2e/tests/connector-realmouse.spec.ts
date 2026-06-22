/**
 * connector-realmouse.spec.ts — real-mouse connector draw (regression guard).
 *
 * WHY THIS EXISTS (and why connector.spec.ts did NOT catch the "connector is
 * locked / left-click won't place it" regression):
 *
 *   connector.spec.ts#clickCanvasAt and CanvasPOM#dispatchAt draw connectors by
 *   dispatching synthetic PointerEvents DIRECTLY on the
 *   `[data-axoview-id="canvas-interactions"]` box. That deliberately forces
 *   `e.target === rendererRef.current` so the lib's `isRendererInteraction` gate
 *   passes — sidestepping real DOM hit-testing. It also fires move+down+up at a
 *   SINGLE point, so it only ever exercises the click-then-click flow, never a
 *   real press-DRAG-release gesture.
 *
 *   The real bug lived exactly in those two blind spots: a user, told by the
 *   connector hint to "drag between items to connect", performed a real
 *   press-drag-release in the DEFAULT click interaction mode. The first
 *   mousedown only ARMED the connector; click-mode mouseup was a no-op; so the
 *   provisional connector stayed glued to the cursor and never committed.
 *
 *   These specs drive REAL page.mouse so e.target flows through
 *   document.elementFromPoint (the user's path) and a genuine drag gesture is
 *   exercised end-to-end.
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  getModelConnectorCount,
  getModelItemCount,
  getUiMode,
  waitForDebugBridge
} from '../helpers/store';

const LOCAL_STORAGE_KEYS = [
  'axoview-diagrams',
  'axoview-last-opened',
  'axoview-last-opened-data',
  'axoview-explorer-initialized',
  'axoview-explorer-open'
];
const ONBOARDING: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];

async function boot(page: import('@playwright/test').Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    for (const [k, v] of flags)
      try {
        localStorage.setItem(k, v);
      } catch {
        /* pre-navigation */
      }
  }, ONBOARDING);
  await page
    .evaluate((keys: string[]) => {
      for (const k of keys) localStorage.removeItem(k);
    }, LOCAL_STORAGE_KEYS)
    .catch(() => {});
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({
    state: 'visible',
    timeout: 10_000
  });
  await waitForDebugBridge(page);
}

/** Drag-and-drop an icon from the Elements grid onto a canvas-relative point. */
async function placeIcon(
  page: import('@playwright/test').Page,
  pt: { x: number; y: number }
) {
  const elementsToggle = byAxoviewId(page, 'dock-elements-toggle');
  const gridItem = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (!(await gridItem.isVisible().catch(() => false))) await elementsToggle.click();
  await gridItem.waitFor({ state: 'visible', timeout: 5_000 });
  const canvas = byLibTestId(page, 'axoview-canvas');
  const iconBox = await gridItem.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!iconBox || !canvasBox) throw new Error('placeIcon: missing bbox');
  await page.mouse.move(iconBox.x + iconBox.width / 2, iconBox.y + iconBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + pt.x, canvasBox.y + pt.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

/** Close the left Elements dock so it can't overlap canvas click targets. */
async function closeElementsPanel(page: import('@playwright/test').Page) {
  const gridItem = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (await gridItem.isVisible().catch(() => false)) {
    await byAxoviewId(page, 'dock-elements-toggle').click();
    await gridItem.waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
  }
}

/** Absolute client coords of a model tile (mirrors CanvasPOM.tileToScreen but
 *  returns PAGE coords, anchored on the interactions-box rect). */
async function tileToClient(
  page: import('@playwright/test').Page,
  tile: { x: number; y: number }
) {
  return page.evaluate((t: { x: number; y: number }) => {
    const ui = (window as any).__axoview__.ui.getState();
    const box = document.querySelector(
      '[data-axoview-id="canvas-interactions"]'
    ) as HTMLElement;
    const rect = box.getBoundingClientRect();
    const UNPROJ = 100;
    const halfW = (UNPROJ * 1.415) / 2;
    const halfH = (UNPROJ * 0.819) / 2;
    const iso = ui.canvasMode !== '2D';
    const cx = iso ? halfW * t.x - halfW * t.y : t.x * UNPROJ;
    const cy = iso ? -(halfH * t.x + halfH * t.y) : -t.y * UNPROJ;
    return {
      x: rect.left + ui.rendererSize.width / 2 + ui.scroll.position.x + cx * ui.zoom,
      y: rect.top + ui.rendererSize.height / 2 + ui.scroll.position.y + cy * ui.zoom
    };
  }, tile);
}

const nodeTiles = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const views = (window as any).__axoview__.model.getState().views;
    const view = (ui.view && views.find((v: any) => v.id === ui.view)) ?? views[0];
    return (view?.items ?? []).map((i: any) => ({ x: i.tile.x, y: i.tile.y }));
  });

/** What real element sits on top at a page coord (the e.target a user gets). */
const topElementAxoviewId = (
  page: import('@playwright/test').Page,
  pt: { x: number; y: number }
) =>
  page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    return el?.getAttribute('data-axoview-id') ?? null;
  }, pt);

async function realMouseDrag(
  page: import('@playwright/test').Page,
  from: { x: number; y: number },
  to: { x: number; y: number }
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 6 });
  await page.mouse.up();
}

test.describe('Connector — real-mouse draw (default click interaction mode)', () => {
  test('a real DRAG from a single node commits a connector and does not lock the tool', async ({
    page,
    app
  }) => {
    void app;
    await boot(page);

    // The user's exact scene: ONE node, no dock open.
    await placeIcon(page, { x: 480, y: 320 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await closeElementsPanel(page);

    await page.keyboard.press('c');
    await expect
      .poll(async () => (await getUiMode(page))?.type ?? null, { timeout: 2_000 })
      .toBe('CONNECTOR');
    // The bug only reproduces in the DEFAULT click interaction mode.
    expect(
      await page.evaluate(
        () => (window as any).__axoview__.ui.getState().connectorInteractionMode
      )
    ).toBe('click');

    const [tile] = await nodeTiles(page);
    const node = await tileToClient(page, tile);
    const target = { x: node.x + 220, y: node.y + 140 };

    // Guard the original misdiagnosis path too: a real press on the node must
    // resolve to the interactions box (isRendererInteraction), not a layer
    // stacked above it — i.e. no z-order regression sneaks the hit elsewhere.
    expect(await topElementAxoviewId(page, node)).toBe('canvas-interactions');

    // Follow the on-screen hint literally: "drag between items to connect".
    await realMouseDrag(page, node, target);
    await page.waitForTimeout(150);

    // Connector committed…
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 3_000 })
      .toBe(1);
    // …and the tool is NOT left mid-connection ("locked" to the cursor).
    const mode = await getUiMode(page);
    expect(mode?.type).toBe('CONNECTOR');
    expect(mode?.id ?? null).toBeNull();
    expect(mode?.isConnecting ?? false).toBe(false);
  });

  test('a real DRAG between two nodes connects them', async ({ page, app }) => {
    void app;
    await boot(page);

    await placeIcon(page, { x: 420, y: 280 });
    await placeIcon(page, { x: 660, y: 420 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);
    await closeElementsPanel(page);

    await page.keyboard.press('c');
    await expect
      .poll(async () => (await getUiMode(page))?.type ?? null, { timeout: 2_000 })
      .toBe('CONNECTOR');

    const tiles = await nodeTiles(page);
    const a = await tileToClient(page, tiles[0]);
    const b = await tileToClient(page, tiles[1]);

    await realMouseDrag(page, a, b);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 3_000 })
      .toBe(1);

    const mode = await getUiMode(page);
    expect(mode?.id ?? null).toBeNull();
  });

  // ADR 0022 addendum (refined 2026-06-22): you can draw a free-floating line on
  // empty canvas with a DRAG, while a lone stray click on empty stays a no-op.
  test('a real DRAG between two EMPTY tiles draws a free-floating connector (both ends tile-bound)', async ({
    page,
    app
  }) => {
    void app;
    await boot(page);
    await closeElementsPanel(page);

    await page.keyboard.press('c');
    await expect
      .poll(async () => (await getUiMode(page))?.type ?? null, { timeout: 2_000 })
      .toBe('CONNECTOR');

    // Two empty points in the canvas interior (right of any dock).
    const box = await byAxoviewId(page, 'canvas-interactions').boundingBox();
    if (!box) throw new Error('no interactions box');
    const from = { x: box.x + box.width * 0.42, y: box.y + box.height * 0.4 };
    const to = { x: box.x + box.width * 0.62, y: box.y + box.height * 0.62 };

    await realMouseDrag(page, from, to);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 3_000 })
      .toBe(1);

    // Both endpoints are tile-bound (free-floating — not attached to any node).
    const endpoints = await page.evaluate(() => {
      const ui = (window as any).__axoview__.ui.getState();
      const views = (window as any).__axoview__.model.getState().views;
      const view = (ui.view && views.find((v: any) => v.id === ui.view)) ?? views[0];
      const c = (view?.connectors ?? [])[0];
      if (!c) return null;
      const last = c.anchors.length - 1;
      return [c.anchors[0], c.anchors[last]].map((a: any) => ({
        tile: a.ref?.tile ?? null,
        item: a.ref?.item ?? null
      }));
    });
    expect(endpoints).not.toBeNull();
    expect(endpoints!.every((e) => e.tile !== null && e.item == null)).toBe(true);

    const mode = await getUiMode(page);
    expect(mode?.id ?? null).toBeNull();
  });

  test('a lone CLICK on empty canvas does NOT create a connector (stray-click guard)', async ({
    page,
    app
  }) => {
    void app;
    await boot(page);
    await closeElementsPanel(page);

    await page.keyboard.press('c');
    await expect
      .poll(async () => (await getUiMode(page))?.type ?? null, { timeout: 2_000 })
      .toBe('CONNECTOR');

    const box = await byAxoviewId(page, 'canvas-interactions').boundingBox();
    if (!box) throw new Error('no interactions box');
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(250);

    // Stray click leaves nothing behind.
    expect(await getModelConnectorCount(page)).toBe(0);
    const mode = await getUiMode(page);
    expect(mode?.id ?? null).toBeNull();
  });
});
