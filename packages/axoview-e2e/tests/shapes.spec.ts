/**
 * shapes.spec.ts — Tier 1 J3.
 *
 * J3 (per docs/manual-test-baseline.md): new diagram → add a rectangle +
 * a textbox → save → reopen → state preserved.
 *
 * Surface walkthrough (lib code paths):
 *   - Rectangle: useInteractionManager binds the `r` hotkey to `setMode(
 *     RECTANGLE.DRAW)`. The DrawRectangle mode then creates a rectangle on
 *     `mousedown` (gated by `isRendererInteraction`), grows it on `mousemove`
 *     while the mouse is held down, and commits on `mouseup` by transitioning
 *     to CURSOR mode. Rectangles persist on `model.views[*].rectangles`.
 *   - Textbox: pressing the `t` hotkey in useInteractionManager is one-shot —
 *     it creates the textbox at `uiState.mouse.position.tile` synchronously
 *     and enters TEXTBOX mode. The TextBox mode's mouseup either commits (if
 *     `isRendererInteraction`) or deletes (otherwise). Text boxes persist on
 *     `model.views[*].textBoxes`.
 *
 * Why hotkeys, not ToolMenu buttons: rectangle is wired only through the
 * keyboard handler today (no Rectangle button in ToolMenu.tsx, which renders
 * Cursor/Lasso/Freehand/Pan/Connector only). Textbox is the same — only the
 * keyboard handler exposes it. The hotkey path keeps this session's lib
 * retrofits at zero (CanvasPOM's `canvas-tool-*` button retrofits stay
 * deferred per ADR 0008 D5).
 *
 * State assertion strategy:
 *   - Use helpers/store.ts#getViewRectangleCount / getViewTextBoxCount — both
 *     read `model.views[*].rectangles|textBoxes`, mirroring how
 *     getViewItemCount reads `model.views[*].items`. Save (Ctrl+S) snapshots
 *     the entire model to `axoview-last-opened-data`, so both arrays survive
 *     the reload leg.
 *
 * Lazy data-axoview-id retrofits — none this spec. The CanvasPOM methods
 * consume already-landed attributes (`canvas-interactions` from Session 3,
 * `canvas-icon-grid-item` from Session 2).
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  getViewRectangleCount,
  getViewTextBoxCount,
  waitForDebugBridge
} from '../helpers/store';

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
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function clearDiagramStorage(page: import('@playwright/test').Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
}

async function bootBlankDiagram(page: import('@playwright/test').Page) {
  await clearDiagramStorage(page);
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
}

test.describe('Shapes — J3: rectangle + textbox round-trip', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('J3: draws a rectangle + places a textbox, saves, reloads, both persist', async ({ page }) => {
    const canvas = new CanvasPOM(page);

    // 1. Switch to RECTANGLE.DRAW mode via the `r` hotkey.
    await canvas.switchToRectangleMode();
    await expect
      .poll(
        () => page.evaluate(() => (window as any).__axoview__.ui.getState().mode.type),
        { timeout: 2_000 }
      )
      .toBe('RECTANGLE.DRAW');

    // 2. Drag from (260, 220) to (460, 360) on the interactions Box. The drag
    //    walks through three intermediate points so DrawRectangle.mousemove's
    //    `hasMovedTile` gate trips reliably even at low zoom (small drags can
    //    otherwise stay within a single tile band).
    const RECT_FROM: CanvasPoint = { x: 260, y: 220 };
    const RECT_TO: CanvasPoint = { x: 460, y: 360 };
    await canvas.dragFromTo(RECT_FROM, RECT_TO);
    await expect.poll(() => getViewRectangleCount(page), { timeout: 5_000 }).toBe(1);

    // After mouseup, DrawRectangle transitions back to CURSOR. Sanity-check
    // the mode flip so an unexpected stuck DRAW state fails here, not at the
    // textbox-placement step which would mis-attribute the failure.
    await expect
      .poll(
        () => page.evaluate(() => (window as any).__axoview__.ui.getState().mode.type),
        { timeout: 2_000 }
      )
      .toBe('CURSOR');

    // 3. Place a textbox at a different canvas point. placeTextBoxAt:
    //    mousemove → press `t` (creates textbox at current tile + enters
    //    TEXTBOX mode) → mouseup (TextBox mode commits via isRendererInteraction).
    const TEXT_BOX_AT: CanvasPoint = { x: 540, y: 240 };
    await canvas.placeTextBoxAt(TEXT_BOX_AT);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    // 4. Capture pre-save IDs so the reload leg can verify the SAME entities
    //    came back, not just the counts. Local-mode persistence serialises
    //    the entire model, so the rectangle/textbox ids survive.
    const preIds = await page.evaluate(() => {
      const viewId = (window as any).__axoview__.ui.getState().view;
      const views = (window as any).__axoview__.model.getState().views;
      const view =
        (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
      return {
        rectangleIds: (view?.rectangles ?? []).map((r: any) => r.id),
        textBoxIds: (view?.textBoxes ?? []).map((t: any) => t.id)
      };
    });
    expect(preIds.rectangleIds.length).toBe(1);
    expect(preIds.textBoxIds.length).toBe(1);

    // 5. Save via Ctrl+S (same path J15's Ctrl+S sub-test exercises). The
    //    handler routes to saveDiagram → writes `axoview-last-opened-data`.
    await page.keyboard.press('Control+s');
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const raw = localStorage.getItem('axoview-last-opened-data');
            if (!raw) return { rectangles: -1, textBoxes: -1 };
            try {
              const parsed = JSON.parse(raw);
              const views =
                parsed?.views ?? parsed?.data?.views ?? [];
              const view = views[0] ?? {};
              return {
                rectangles: Array.isArray(view.rectangles)
                  ? view.rectangles.length
                  : 0,
                textBoxes: Array.isArray(view.textBoxes)
                  ? view.textBoxes.length
                  : 0
              };
            } catch {
              return { rectangles: -1, textBoxes: -1 };
            }
          }),
        { timeout: 5_000 }
      )
      .toEqual({ rectangles: 1, textBoxes: 1 });

    // 6. Reload — DiagramLifecycleProvider rehydrates from
    //    `axoview-last-opened-data` on first render.
    await page.reload();
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
    await waitForDebugBridge(page);

    // 7. State preserved — both arrays carry exactly the same ids that the
    //    pre-save snapshot captured.
    await expect.poll(() => getViewRectangleCount(page), { timeout: 5_000 }).toBe(1);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    const postIds = await page.evaluate(() => {
      const viewId = (window as any).__axoview__.ui.getState().view;
      const views = (window as any).__axoview__.model.getState().views;
      const view =
        (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
      return {
        rectangleIds: (view?.rectangles ?? []).map((r: any) => r.id),
        textBoxIds: (view?.textBoxes ?? []).map((t: any) => t.id)
      };
    });
    expect(postIds.rectangleIds).toEqual(preIds.rectangleIds);
    expect(postIds.textBoxIds).toEqual(preIds.textBoxIds);
  });
});
