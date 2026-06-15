/**
 * touch-palette-drag.spec — drag an Elements-panel icon onto the canvas to place
 * it (touch parity with the desktop drag-from-panel). The press arms placement
 * at pointerdown and captures the pointer; releasing over the canvas drops the
 * node there.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { getModelItemCount } from '../helpers/store';

test.describe('Touch — drag an element from the panel onto the canvas', () => {
  test('press an icon, drag onto the canvas, release → a node is placed', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);

    // Ensure the Elements panel is open.
    const toggle = byAxoviewId(page, 'dock-elements-toggle');
    const icon = byAxoviewId(page, 'canvas-icon-grid-item').first();
    if (!(await icon.isVisible().catch(() => false))) {
      await toggle.click();
      await icon.waitFor({ state: 'visible', timeout: 5_000 });
    }

    const before = await getModelItemCount(page);
    const iconBox = await icon.boundingBox();
    const canvasBox = await byLibTestId(page, 'axoview-canvas').boundingBox();
    if (!iconBox || !canvasBox) throw new Error('missing bounding box');

    // Drag from the icon centre to a point well inside the canvas.
    await touch.dragAbsolute(
      { x: iconBox.x + iconBox.width / 2, y: iconBox.y + iconBox.height / 2 },
      { x: canvasBox.x + canvasBox.width * 0.6, y: canvasBox.y + canvasBox.height * 0.5 }
    );

    await expect
      .poll(() => getModelItemCount(page), { timeout: 5_000 })
      .toBe(before + 1);
  });

  test('the PLACE_ICON preview ghost tracks the finger during the drag', async ({
    page,
    app
  }) => {
    void app;

    const toggle = byAxoviewId(page, 'dock-elements-toggle');
    const icon = byAxoviewId(page, 'canvas-icon-grid-item').first();
    if (!(await icon.isVisible().catch(() => false))) {
      await toggle.click();
      await icon.waitFor({ state: 'visible', timeout: 5_000 });
    }

    const iconBox = await icon.boundingBox();
    const canvasBox = await byLibTestId(page, 'axoview-canvas').boundingBox();
    if (!iconBox || !canvasBox) throw new Error('missing bounding box');

    const placeState = () =>
      page.evaluate(() => {
        const ui = (window as any).__axoview__.ui.getState();
        return {
          mode: ui.mode.type,
          tile: { ...ui.mouse.position.tile },
          suppressPreview:
            ui.mode.type === 'PLACE_ICON' ? !!ui.mode.suppressPreview : null
        };
      });

    const start = {
      x: iconBox.x + iconBox.width / 2,
      y: iconBox.y + iconBox.height / 2
    };
    const a = { x: canvasBox.x + canvasBox.width * 0.4, y: canvasBox.y + canvasBox.height * 0.45 };
    const b = { x: canvasBox.x + canvasBox.width * 0.65, y: canvasBox.y + canvasBox.height * 0.6 };

    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: start.x, y: start.y, id: 0 }]
    });
    await page.waitForTimeout(60);
    // Armed but not yet dragging: the preview ghost must be hidden (no hover on
    // touch, so it must not paint at a stale tile before the drag starts).
    const armed = await placeState();
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: a.x, y: a.y, id: 0 }]
    });
    await page.waitForTimeout(60);
    const atA = await placeState();
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: b.x, y: b.y, id: 0 }]
    });
    await page.waitForTimeout(60);
    const atB = await placeState();
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await client.detach();

    // Armed-but-stationary: PLACE_ICON is set but the preview is suppressed.
    expect(armed.mode).toBe('PLACE_ICON');
    expect(armed.suppressPreview).toBe(true);
    // Once dragging, the preview is live (mode stays PLACE_ICON, no longer
    // suppressed) and its tile moves with the finger — the missing affordance.
    expect(atA.mode).toBe('PLACE_ICON');
    expect(atA.suppressPreview).toBe(false);
    expect(atB.mode).toBe('PLACE_ICON');
    expect(atB.tile).not.toEqual(atA.tile);
  });
});
