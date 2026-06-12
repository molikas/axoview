/**
 * canvas-mode-zoom-preserve.spec.ts — Thread D (ADR locked decision #6).
 *
 * Iso↔2D switching must PRESERVE the user's zoom and viewport center. The old
 * `fitToView()` force-fit in ToolMenu recomputed zoom on every projection swap
 * (the reported 65%→80%→97% "pop") and recentred the whole diagram. The fix
 * removes the force-fit and instead re-projects the tile under the viewport
 * center so it stays centered at the same zoom.
 *
 * What this spec asserts:
 *   - zoom % is byte-identical across a single switch and across a round-trip;
 *   - the tile under the viewport center is preserved across the switch
 *     (the recenter math, mirrored here from coordinateTransforms.fromCanvasPoint).
 *
 * Surface: the toggle is the lib ToolMenu button (`canvas-mode-toggle`). State
 * is read via the debug bridge `window.__axoview__.ui` (same as canvas-modes.spec).
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { waitForDebugBridge } from '../helpers/store';

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

type Page = import('@playwright/test').Page;

async function pinOnboardingDismissed(page: Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function bootBlankDiagram(page: Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
}

const getCanvasMode = (page: Page): Promise<string | null> =>
  page.evaluate(() => (window as any).__axoview__?.ui?.getState?.()?.canvasMode ?? null);

const getZoom = (page: Page): Promise<number> =>
  page.evaluate(() => (window as any).__axoview__.ui.getState().zoom);

/** Sets zoom + scroll directly so the viewport center is a non-trivial tile. */
const setViewport = (page: Page, zoom: number, scroll: { x: number; y: number }) =>
  page.evaluate(
    (args: { zoom: number; scroll: { x: number; y: number } }) => {
      const actions = (window as any).__axoview__.ui.getState().actions;
      actions.setZoom(args.zoom);
      actions.setScroll({ position: args.scroll, offset: { x: 0, y: 0 } });
    },
    { zoom, scroll }
  );

/**
 * The (fractional) tile under the viewport center. The SceneLayer renders a
 * tile at `rendererCenter + scroll + zoom·toScreen(tile)`, so the canvas point
 * under the center is `-scroll/zoom`; we invert toScreen for the active mode
 * (mirrors coordinateTransforms.fromCanvasPoint).
 */
const getCenterTile = (page: Page): Promise<{ x: number; y: number }> =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    const mode: 'ISOMETRIC' | '2D' = ui.canvasMode ?? 'ISOMETRIC';
    const zoom: number = ui.zoom;
    const scroll = ui.scroll.position as { x: number; y: number };
    const cx = -scroll.x / zoom;
    const cy = -scroll.y / zoom;
    if (mode === 'ISOMETRIC') {
      const halfW = (100 * 1.415) / 2;
      const halfH = (100 * 0.819) / 2;
      const diff = cx / halfW;
      const sum = -cy / halfH;
      return { x: (diff + sum) / 2, y: (sum - diff) / 2 };
    }
    return { x: cx / 100, y: -cy / 100 };
  });

test.describe('Canvas mode — Thread D: zoom + center preserved across iso↔2D', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('zoom % survives a switch and a round-trip; center tile is preserved', async ({
    page
  }) => {
    const canvas = new CanvasPOM(page);

    // Normalise to ISOMETRIC so the assertions are deterministic regardless of
    // the persisted starting mode.
    if ((await getCanvasMode(page)) === '2D') {
      await canvas.toggleCanvasMode();
      await expect.poll(() => getCanvasMode(page), { timeout: 3_000 }).toBe('ISOMETRIC');
    }

    // A zoom the old fitToView would NOT have produced, plus an off-origin
    // scroll so the centered tile is non-trivial.
    await setViewport(page, 0.65, { x: -240, y: 130 });
    const zoomBefore = await getZoom(page);
    expect(zoomBefore).toBeCloseTo(0.65, 5);
    const centerBefore = await getCenterTile(page);

    // iso → 2D: zoom unchanged, same tile centered.
    await canvas.toggleCanvasMode();
    await expect.poll(() => getCanvasMode(page), { timeout: 3_000 }).toBe('2D');
    expect(await getZoom(page)).toBeCloseTo(zoomBefore, 5);
    const center2D = await getCenterTile(page);
    expect(center2D.x).toBeCloseTo(centerBefore.x, 3);
    expect(center2D.y).toBeCloseTo(centerBefore.y, 3);

    // 2D → iso: round-trip restores zoom and the centered tile exactly.
    await canvas.toggleCanvasMode();
    await expect.poll(() => getCanvasMode(page), { timeout: 3_000 }).toBe('ISOMETRIC');
    expect(await getZoom(page)).toBeCloseTo(zoomBefore, 5);
    const centerBack = await getCenterTile(page);
    expect(centerBack.x).toBeCloseTo(centerBefore.x, 3);
    expect(centerBack.y).toBeCloseTo(centerBefore.y, 3);
  });
});
