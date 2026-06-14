/**
 * Shared canvas-setup helper: place an icon from the Elements panel onto the
 * canvas via a real mouse drag (the established pattern from
 * drag-collision.spec). Touch specs use this for fixture setup (placing nodes),
 * then exercise the touch gestures separately.
 */
import { Page } from '@playwright/test';
import { byAxoviewId, byLibTestId } from './selectors';

export interface CanvasPoint {
  x: number;
  y: number;
}

export async function placeIconViaMouse(page: Page, point: CanvasPoint) {
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
    throw new Error('placeIconViaMouse: icon or canvas missing a bounding box');
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

/**
 * Closes the Elements (left dock) panel if it is open, and returns the canvas to
 * CURSOR mode. Real touch taps hit-test, so a panel overlapping the canvas would
 * steal them (the synthetic-dispatch mouse specs don't have this problem). Touch
 * specs call this after placing fixture nodes so the canvas is unobstructed.
 */
export async function clearCanvasForTouch(page: Page) {
  const firstIcon = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (await firstIcon.isVisible().catch(() => false)) {
    await byAxoviewId(page, 'dock-elements-toggle').click();
    await firstIcon
      .waitFor({ state: 'hidden', timeout: 3_000 })
      .catch(() => undefined);
  }
  // Return to CURSOR (placing an icon leaves PLACE_ICON mode) and clear any
  // selection so taps start from a known state.
  await page.evaluate(() => {
    const ui = (window as any).__axoview__.ui.getState();
    ui.actions.setMode({ type: 'CURSOR', showCursor: true, mousedownItem: null });
    ui.actions.setItemControls(null);
  });
  await page.waitForTimeout(80);
}
