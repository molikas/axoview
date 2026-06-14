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
});
