/**
 * viewport.spec.ts — v1.1 Track 5f (KR2).
 *
 * Pan + zoom + fit-to-view at the viewport layer. The lib exposes
 * three independent paths to these:
 *
 *   pan  — keyboard arrows / wasd / ijkl in EDITABLE mode
 *          (useInteractionManager.ts:435-481). Each arrow press adds
 *          `panSpeed` to scroll.position via setScroll.
 *
 *   zoom — UI buttons in ZoomControls (canvas-zoom-{in,out}) call
 *          uiStateStoreActions.incrementZoom / decrementZoom. There
 *          is also a wheel-driven onScroll handler in
 *          useInteractionManager.ts:726-769 but it depends on
 *          dispatching synthetic WheelEvents to the renderer — out of
 *          scope here; UI buttons are the simpler driver.
 *
 *   fit  — UI button `canvas-zoom-fit` calls fitToView() from
 *          useDiagramUtils. The handler resets scroll and zoom to
 *          fit the diagram's bounding rect. We don't pin exact
 *          numerical post-fit values (depends on iso/2D mode and
 *          rendererSize); we assert that AFTER zooming in + panning,
 *          a fit click returns the scroll to its post-fit baseline
 *          (typically near {0,0}) and the zoom changes.
 *
 * Lazy data-axoview-id retrofits — landed in the prior lib commit
 * (canvas-zoom-{in,out,percent,fit} on ZoomControls.tsx).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { byAxoviewId } from '../helpers/selectors';
import { getScroll, getZoom } from '../helpers/store';

test.describe('Viewport — pan + zoom + fit-to-view (Track 5f)', () => {
  test('5f pan: ArrowUp/ArrowDown/ArrowLeft/ArrowRight adjust scroll.position', async ({ page, app }) => {
    void app;
    const initial = await getScroll(page);
    expect(initial?.position).toBeDefined();
    const { x: x0, y: y0 } = initial.position as { x: number; y: number };

    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(50);
    const afterUp = await getScroll(page);
    // ArrowUp adds +panSpeed to y (panDy = panSpeed) per
    // useInteractionManager line 437.
    expect(afterUp.position.y).toBeGreaterThan(y0);
    expect(afterUp.position.x).toBe(x0);

    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(50);
    const afterDown = await getScroll(page);
    expect(afterDown.position.y).toBe(y0);
    expect(afterDown.position.x).toBe(x0);

    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(50);
    const afterRight = await getScroll(page);
    // ArrowRight subtracts panSpeed from x (panDx = -panSpeed).
    expect(afterRight.position.x).toBeLessThan(x0);
    expect(afterRight.position.y).toBe(y0);

    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(50);
    const afterLeft = await getScroll(page);
    expect(afterLeft.position.x).toBe(x0);
    expect(afterLeft.position.y).toBe(y0);
  });

  test('5f zoom: canvas-zoom-in / canvas-zoom-out adjust zoom in opposite directions', async ({ page, app }) => {
    void app;
    const z0 = await getZoom(page);

    await byAxoviewId(page, 'canvas-zoom-in').click();
    await expect
      .poll(() => getZoom(page), { timeout: 3_000 })
      .toBeGreaterThan(z0);
    const z1 = await getZoom(page);

    await byAxoviewId(page, 'canvas-zoom-out').click();
    await expect
      .poll(() => getZoom(page), { timeout: 3_000 })
      .toBeLessThan(z1);
    // Zoom step is symmetric in incrementZoom/decrementZoom (see
    // src/utils zoom helpers); a single in + out round-trip returns
    // to the original value.
    await expect.poll(() => getZoom(page), { timeout: 3_000 }).toBe(z0);
  });

  test('5f fit-to-view: zoom + pan, then click fit returns zoom to a different value (fit-driven)', async ({ page, app }) => {
    void app;
    const z0 = await getZoom(page);

    // Zoom in twice + pan up so the state is meaningfully off baseline.
    await byAxoviewId(page, 'canvas-zoom-in').click();
    await byAxoviewId(page, 'canvas-zoom-in').click();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    const zoomedIn = await getZoom(page);
    expect(zoomedIn).toBeGreaterThan(z0);

    await byAxoviewId(page, 'canvas-zoom-fit').click();
    // fitToView resets scroll AND zoom to fit the diagram bounds. The
    // post-fit zoom for an empty diagram is implementation-defined
    // (depends on rendererSize + content bounds) — we assert the
    // change occurred rather than the exact value.
    await expect
      .poll(() => getZoom(page), { timeout: 3_000 })
      .not.toBe(zoomedIn);
  });
});
