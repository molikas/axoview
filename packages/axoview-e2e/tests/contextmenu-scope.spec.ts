/**
 * contextmenu-scope.spec — ADR 0018 window-bound contextmenu listener scoping.
 *
 * Regression guard. The Pointer-Events rewrite moved the `contextmenu` listener
 * from the renderer element to `window` (pointer capture needs the superset
 * surface). The handler must therefore scope its preventDefault to right-clicks
 * that land INSIDE the Renderer container:
 *
 *   - an off-canvas right-click (toolbar, property panel, a text input's native
 *     Cut/Copy/Paste menu, the file-explorer tree) must keep its native menu
 *     (defaultPrevented === false);
 *   - a right-click over a canvas node must still be swallowed (defaultPrevented
 *     === true) so the OS menu can't double up with the canvas context menu
 *     (which opens via the right-TAP pointer path, exercised by the context-menu
 *     specs).
 *
 * Pre-fix the listener preventDefault'd every contextmenu on the page — this
 * spec pins both directions so that can't regress. (The floating action bar was
 * removed in the 2026-06-25 shake-out; the only canvas-scoped reaction this
 * listener owns is now the preventDefault.)
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { placeIconViaMouse } from '../helpers/place';
import { getModelItemCount } from '../helpers/store';

type Page = import('@playwright/test').Page;

const nodeTile = (page: Page) =>
  page.evaluate(() => {
    const v = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    return (views.find((x: any) => x.id === v) ?? views[0]).items[0].tile;
  });

// CURSOR mode, no selection — a known start state.
const resetCanvas = (page: Page) =>
  page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    ui.actions.setMode({ type: 'CURSOR', showCursor: true, mousedownItem: null });
    ui.actions.setItemControls(null);
    ui.actions.clearSelection();
  });

// Dispatch a right-click (contextmenu) on document.body — guaranteed OUTSIDE the
// Renderer container — and report whether the handler swallowed it.
const rightClickOffCanvas = (page: Page) =>
  page.evaluate(() => {
    const renderer = (window as any).__axoview__.ui.getState()
      .rendererEl as HTMLElement | null;
    const target = document.body;
    if (renderer && renderer.contains(target)) {
      throw new Error('test setup: document.body is inside the renderer');
    }
    const ev = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 4,
      clientY: 4,
      button: 2
    });
    target.dispatchEvent(ev);
    return ev.defaultPrevented;
  });

// Dispatch a right-click on the interactions Box at a canvas point.
const rightClickCanvasAt = (canvas: CanvasPOM, point: { x: number; y: number }) =>
  canvas.interactionsLayer().evaluate((el, p: { x: number; y: number }) => {
    const rect = el.getBoundingClientRect();
    const ev = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + p.x,
      clientY: rect.top + p.y,
      button: 2
    });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  }, point);

test.describe('contextmenu scoping (window-bound listener)', () => {
  test('off-canvas right-click keeps its native menu (no preventDefault)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await resetCanvas(page);

    // Seed the mouse OVER the node so mouse.position.tile resolves to it — the
    // stale tile a pre-fix off-canvas right-click would have acted on.
    const point = await canvas.tileToScreen(await nodeTile(page));
    await canvas.dispatchAt(['mousemove'], point);

    const defaultPrevented = await rightClickOffCanvas(page);

    // Native menu preserved — the listener did not swallow an off-canvas click.
    expect(defaultPrevented).toBe(false);
  });

  test('right-click over a canvas node is swallowed by the window-bound listener (positive control)', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    await placeIconViaMouse(page, { x: 420, y: 300 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
    await resetCanvas(page);

    const point = await canvas.tileToScreen(await nodeTile(page));
    await canvas.dispatchAt(['mousemove'], point);

    const defaultPrevented = await rightClickCanvasAt(canvas, point);

    // The in-renderer right-click is swallowed so the OS menu can't double up
    // with the canvas context menu (which opens via the right-TAP pointer path
    // in usePanHandlers, covered by the context-menu specs).
    expect(defaultPrevented).toBe(true);
  });
});
