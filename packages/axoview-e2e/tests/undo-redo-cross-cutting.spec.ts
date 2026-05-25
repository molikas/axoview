/**
 * undo-redo-cross-cutting.spec.ts — v1.1 Track 5e-7.
 *
 * Undo/redo across the canvas surface boundary. Existing
 * connector.spec.ts (J2) covers a single create -> undo -> redo cycle
 * for one connector. hotkeys.spec.ts (J15) covers single-action undo
 * for icon placement. This spec drives a multi-action chain across
 * BOTH surfaces and verifies each undo step unwinds correctly.
 *
 * Contract: a chain of (icon placement -> icon placement -> connector
 * creation) produces 3 history entries (one per drag-transaction). Each
 * Ctrl+Z reverses exactly one entry; Ctrl+Y replays it. The final
 * round-trip lands back at the initial 2-icon-1-connector state.
 *
 * Lazy data-axoview-id retrofits — none.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM, CanvasPoint } from '../pom/CanvasPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import {
  getModelConnectorCount,
  getModelItemCount,
  getUiMode
} from '../helpers/store';

const getUiModeType = async (page: import('@playwright/test').Page) => {
  const mode = await getUiMode(page);
  return mode?.type ?? null;
};

async function placeIcon(
  page: import('@playwright/test').Page,
  point: CanvasPoint
) {
  const elementsToggle = byAxoviewId(page, 'dock-elements-toggle');
  const firstIcon = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (!(await firstIcon.isVisible().catch(() => false))) {
    await elementsToggle.click();
    await firstIcon.waitFor({ state: 'visible', timeout: 5_000 });
  }
  const canvas = byLibTestId(page, 'axoview-canvas');
  const iconBox = await firstIcon.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!iconBox || !canvasBox)
    throw new Error('placeIcon: icon or canvas missing a bounding box');
  await page.mouse.move(
    iconBox.x + iconBox.width / 2,
    iconBox.y + iconBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + point.x, canvasBox.y + point.y, {
    steps: 10
  });
  await page.mouse.up();
  await page.waitForTimeout(150);
}

test.describe('Undo / redo cross-cutting — Track 5e-7', () => {
  test('5e-7: place icon -> place icon -> draw connector -> undo x3 -> redo x3 round-trips cleanly', async ({ page, app }) => {
    void app;
    const canvas = new CanvasPOM(page);

    // Build the 3-step state.
    await placeIcon(page, { x: 380, y: 280 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    await placeIcon(page, { x: 540, y: 360 });
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    await page.keyboard.press('c');
    await expect.poll(() => getUiModeType(page), { timeout: 2_000 }).toBe(
      'CONNECTOR'
    );
    await canvas.clickAt({ x: 380, y: 280 });
    await page.waitForTimeout(100);
    await canvas.clickAt({ x: 540, y: 360 });
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);

    // Undo x3 unwinds in LIFO order: connector first, then the second
    // icon, then the first. Each Ctrl+Z handled by
    // useInteractionManager.handleKeyDown lines 233-238 routes through
    // useHistory's undo() — one history entry per drag-transaction
    // commit (placeIcon + the connector create-drag-commit cycle).
    await page.keyboard.press('Control+z');
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(0);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    await page.keyboard.press('Control+z');
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    await page.keyboard.press('Control+z');
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(0);

    // Redo x3 replays each entry in FIFO order.
    await page.keyboard.press('Control+y');
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    await page.keyboard.press('Control+y');
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);

    await page.keyboard.press('Control+y');
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);
    // Final state matches the initial 3-step state.
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(2);
  });
});
