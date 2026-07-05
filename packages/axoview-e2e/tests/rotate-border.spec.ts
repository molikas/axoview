/**
 * rotate-border.spec.ts — the on-canvas rotate handle (ADR 0034 addendum
 * 2026-07-04; owner: "de-dense the top control") + the text-box Border strip
 * branch.
 *
 *   - ROTATE (text box): the handle flips the iso plane (orientation X↔Y) and
 *     resets any manual size — the strip's text-direction toggle is gone.
 *   - ROTATE (rectangle): the handle transposes the footprint about its
 *     center (width/height swap).
 *   - BORDER (text box): the strip Border popover (formerly rectangle-only)
 *     writes borderStyle/borderColor — picking a style first seeds a default
 *     color so the change is visible.
 *
 * Lazy data-axoview-id retrofits: `canvas-rotate-handle` (TransformControls),
 * `strip-border-button` / `strip-border-style-*` testids (strip Border).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { getViewTextBoxCount } from '../helpers/store';

const getFirstTextBox = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view =
      (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const tb = (view?.textBoxes ?? [])[0];
    if (!tb) return null;
    return {
      orientation: tb.orientation ?? 'X',
      width: tb.width ?? null,
      height: tb.height ?? null,
      borderStyle: tb.borderStyle ?? null,
      borderColor: tb.borderColor ?? null
    };
  });

const getFirstRectangle = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const viewId = (window as any).__axoview__.ui.getState().view;
    const views = (window as any).__axoview__.model.getState().views;
    const view =
      (viewId && views.find((v: any) => v.id === viewId)) ?? views[0];
    const r = (view?.rectangles ?? [])[0];
    if (!r) return null;
    return { from: r.from, to: r.to };
  });

test.describe('Canvas rotate handle + text-box border (ADR 0034 addenda)', () => {
  test('textbox ROTATE: the handle flips orientation X↔Y and back', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);
    expect((await getFirstTextBox(page))!.orientation).toBe('X');

    // The selected box shows the rotate handle above its bounds.
    const handle = page.locator('[data-axoview-id="canvas-rotate-handle"]');
    await handle.waitFor({ state: 'visible', timeout: 5_000 });
    await handle.click();
    await expect
      .poll(async () => (await getFirstTextBox(page))!.orientation, {
        timeout: 3_000
      })
      .toBe('Y');

    // Selection survives the rotate (the handle never reaches the canvas
    // layer); a second click turns it back.
    await handle.click();
    await expect
      .poll(async () => (await getFirstTextBox(page))!.orientation, {
        timeout: 3_000
      })
      .toBe('X');
  });

  test('rectangle ROTATE: the handle transposes the footprint about its center', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Draw a clearly non-square rectangle.
    await canvas.switchToRectangleMode();
    const RECT_FROM: CanvasPoint = { x: 260, y: 220 };
    const RECT_TO: CanvasPoint = { x: 500, y: 300 };
    await canvas.dragFromTo(RECT_FROM, RECT_TO);
    await expect
      .poll(async () => Boolean(await getFirstRectangle(page)), {
        timeout: 5_000
      })
      .toBe(true);
    const before = (await getFirstRectangle(page))!;
    const spanX = Math.abs(before.to.x - before.from.x);
    const spanY = Math.abs(before.to.y - before.from.y);
    expect(spanX).not.toBe(spanY);

    // Select it (click inside the footprint), then rotate.
    const center = await canvas.tileToScreen({
      x: Math.round((before.from.x + before.to.x) / 2),
      y: Math.round((before.from.y + before.to.y) / 2)
    });
    await canvas.dispatchAt(['mousemove', 'mousedown', 'mouseup'], center);
    const handle = page.locator('[data-axoview-id="canvas-rotate-handle"]');
    await handle.waitFor({ state: 'visible', timeout: 5_000 });
    await handle.click();

    await expect
      .poll(
        async () => {
          const r = (await getFirstRectangle(page))!;
          return {
            x: Math.abs(r.to.x - r.from.x),
            y: Math.abs(r.to.y - r.from.y)
          };
        },
        { timeout: 3_000 }
      )
      .toEqual({ x: spanY, y: spanX });
  });

  test('textbox BORDER: the strip Border popover writes style + seeds a default color', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);

    const placePixel = await canvas.tileToScreen({ x: 0, y: 0 });
    await canvas.placeTextBoxAt(placePixel);
    await expect.poll(() => getViewTextBoxCount(page), { timeout: 5_000 }).toBe(1);

    await page.getByTestId('strip-border-button').click();
    await page.getByTestId('strip-border-style-DASHED').click();

    await expect
      .poll(async () => (await getFirstTextBox(page))!.borderStyle, {
        timeout: 3_000
      })
      .toBe('DASHED');
    // No color was set — the style pick seeds one so the border is visible.
    expect((await getFirstTextBox(page))!.borderColor).toBe('#000000');
  });
});
