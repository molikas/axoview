/**
 * layers-multiselect.spec.ts — Canvas-UX overhaul T2 (#13).
 *
 * The panel ↔ canvas multi-select mirror + bulk layer-assign, per ADR 0006
 * addendum and UX §4.1:
 *
 *   KR3 — a canvas Ctrl-multi-select highlights the matching LayersPanel rows.
 *         BEFORE T2 the panel highlight read only LASSO-mode selection, so a
 *         canvas Ctrl-click (which lives in `uiState.selectedIds`, ADR 0006 §6)
 *         left the rows unlit. The fix routes the row highlight through
 *         `selectedIds`.
 *
 *   KR4 — dragging a row that is part of the current multi-selection assigns
 *         EVERY selected item to the target layer (bulk `assignLayerToItems`),
 *         not just the dragged one.
 *
 * Both are LayersPanel-component changes, so this spec is the load-bearing
 * browser verification for them.
 *
 * Selection-state reads go through `__axoview__.ui` (selectedIds) and
 * `__axoview__.model` (view-item layerId) — the same debug bridge the rest of
 * the suite uses. Row highlight is asserted via computed backgroundColor: a
 * selected LayerItemRow paints `bgcolor: primary.main`, an unselected one is
 * transparent.
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { LayersPanelPOM } from '../pom/LayersPanelPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { getModelItemCount, waitForDebugBridge } from '../helpers/store';

const LOCAL_STORAGE_KEYS = [
  'axoview-diagrams',
  'axoview-last-opened',
  'axoview-last-opened-data',
  'axoview-explorer-initialized',
  'axoview-explorer-open'
];

const ONBOARDING_DISMISS_FLAGS: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];

async function pinOnboardingDismissed(page: import('@playwright/test').Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may be unavailable pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function bootBlankDiagram(page: import('@playwright/test').Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
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

async function openElementsPanel(page: import('@playwright/test').Page) {
  const elementsToggle = byAxoviewId(page, 'dock-elements-toggle');
  const gridItem = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (!(await gridItem.isVisible().catch(() => false))) await elementsToggle.click();
  await gridItem.waitFor({ state: 'visible', timeout: 5_000 });
}

async function placeIcon(page: import('@playwright/test').Page, point: CanvasPoint) {
  await openElementsPanel(page);
  const firstIcon = byAxoviewId(page, 'canvas-icon-grid-item').first();
  const canvas = byLibTestId(page, 'axoview-canvas');
  const iconBox = await firstIcon.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!iconBox || !canvasBox) throw new Error('placeIcon: missing bounding box');
  await page.mouse.move(iconBox.x + iconBox.width / 2, iconBox.y + iconBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + point.x, canvasBox.y + point.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}

const getViewItems = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    return ((view?.items as any[]) ?? []).map((i) => ({
      id: i.id,
      tile: i.tile,
      layerId: i.layerId ?? null
    }));
  });

const getSelectedIds = (page: import('@playwright/test').Page) =>
  page.evaluate(
    () =>
      ((window as any).__axoview__.ui.getState().selectedIds as any[]) ?? []
  );

const getRowBg = (page: import('@playwright/test').Page, itemId: string) =>
  page.evaluate((id: string) => {
    const el = document.querySelector(`[data-layer-item-id="${id}"]`);
    return el ? getComputedStyle(el).backgroundColor : null;
  }, itemId);

const TRANSPARENT = new Set(['rgba(0, 0, 0, 0)', 'transparent']);

/** Synthetic Ctrl+click at a screen point — carries ctrlKey on every pointer
 *  event so useInteractionManager threads `mouse.modifiers.ctrl` and Cursor's
 *  toggle-select path runs (ADR 0006 §6). Mirrors CanvasPOM.dispatchAt but
 *  with the modifier set. */
async function ctrlClickAt(
  canvas: CanvasPOM,
  point: CanvasPoint
) {
  await canvas.interactionsLayer().evaluate(
    async (el, args: { x: number; y: number }) => {
      const rect = el.getBoundingClientRect();
      const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      const types: Array<[string, number]> = [
        ['pointermove', 0],
        ['pointerdown', 1],
        ['pointerup', 0]
      ];
      for (const [type, buttons] of types) {
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + args.x,
            clientY: rect.top + args.y,
            button: 0,
            buttons,
            ctrlKey: true,
            pointerId: 1,
            pointerType: 'mouse',
            isPrimary: true
          })
        );
        await raf();
      }
    },
    { x: point.x, y: point.y }
  );
}

/** Ensures CURSOR mode so canvas clicks select rather than place/draw. */
async function ensureCursorMode(page: import('@playwright/test').Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(80);
}

test.describe('Layers ↔ canvas multi-select mirror + bulk assign (T2 #13)', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('KR3 — canvas Ctrl-multi-select highlights the matching panel rows', async ({
    page
  }) => {
    const canvas = new CanvasPOM(page);
    await placeIcon(page, { x: 360, y: 280 });
    await placeIcon(page, { x: 560, y: 380 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    const items = await getViewItems(page);
    expect(items).toHaveLength(2);
    const [a, b] = items;

    const layers = new LayersPanelPOM(page);
    await layers.open();
    // Unassigned items always render in the panel's Unassigned group.
    await expect(layers.getItemRow(a.id)).toBeVisible({ timeout: 5_000 });
    await expect(layers.getItemRow(b.id)).toBeVisible({ timeout: 5_000 });

    // Both rows start unselected (transparent).
    expect(TRANSPARENT.has((await getRowBg(page, a.id)) ?? '')).toBe(true);
    expect(TRANSPARENT.has((await getRowBg(page, b.id)) ?? '')).toBe(true);

    // Plain-select A on canvas → row A lights up; capture the selected color.
    await ensureCursorMode(page);
    const aScreen = await canvas.tileToScreen(a.tile);
    await canvas.clickAt(aScreen);
    await expect
      .poll(async () => TRANSPARENT.has((await getRowBg(page, a.id)) ?? ''), {
        timeout: 3_000
      })
      .toBe(false);
    const selectedColor = await getRowBg(page, a.id);

    // Ctrl-click B → selectedIds = [A, B]; BOTH rows must now carry the
    // selected color (the bug: B's row stayed transparent pre-T2).
    const bScreen = await canvas.tileToScreen(b.tile);
    await ctrlClickAt(canvas, bScreen);
    await expect
      .poll(async () => (await getSelectedIds(page)).length, { timeout: 3_000 })
      .toBe(2);

    expect(await getRowBg(page, a.id)).toBe(selectedColor);
    expect(await getRowBg(page, b.id)).toBe(selectedColor);
  });

  test('KR4 — dragging one row of a multi-selection assigns the WHOLE selection', async ({
    page
  }) => {
    const canvas = new CanvasPOM(page);
    await placeIcon(page, { x: 360, y: 280 });
    await placeIcon(page, { x: 560, y: 380 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    const items = await getViewItems(page);
    expect(items).toHaveLength(2);
    const [a, b] = items;

    const layers = new LayersPanelPOM(page);
    await layers.open();
    await layers.addLayer();
    await expect(layers.getLayerRow('Layer 1')).toBeVisible({ timeout: 5_000 });

    // Multi-select both on canvas (selectedIds = [A, B]).
    await ensureCursorMode(page);
    await canvas.clickAt(await canvas.tileToScreen(a.tile));
    await ctrlClickAt(canvas, await canvas.tileToScreen(b.tile));
    await expect
      .poll(async () => (await getSelectedIds(page)).length, { timeout: 3_000 })
      .toBe(2);

    // Drag JUST item A's row onto Layer 1 — bulk-assign must move BOTH.
    await layers.dragItemToLayer(a.id, 'Layer 1');

    const layer = await page.evaluate(() => {
      const viewId = (window as any).__axoview__.ui.getState().view;
      const views = (window as any).__axoview__.model.getState().views;
      const view = (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
      return (view?.layers ?? []).find((l: any) => l.name === 'Layer 1') ?? null;
    });
    expect(layer).not.toBeNull();

    await expect
      .poll(
        async () => {
          const after = await getViewItems(page);
          return after.filter((it) => it.layerId === layer.id).length;
        },
        { timeout: 5_000 }
      )
      .toBe(2);
  });
});
