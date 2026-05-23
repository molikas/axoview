/**
 * Mouse gesture helpers. Playwright's page.mouse API maps directly to real
 * browser events, which made the right-click and middle-click flows that the
 * deleted Selenium suite struggled with reliable here.
 *
 * These are generic — no selector strategy dependency. POMs compose them
 * with locator-derived coordinates.
 */
import { Page } from '@playwright/test';

export interface Coords {
  x: number;
  y: number;
}

export const rightDrag = async (
  page: Page,
  from: Coords,
  to: Coords,
  steps = 10
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up({ button: 'right' });
};

export const rightClick = async (page: Page, coords: Coords) => {
  await page.mouse.move(coords.x, coords.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.up({ button: 'right' });
};

export const middleClickDrag = async (
  page: Page,
  from: Coords,
  to: Coords,
  steps = 10
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'middle' });
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up({ button: 'middle' });
};

export const leftDrag = async (
  page: Page,
  from: Coords,
  to: Coords,
  steps = 10
) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up({ button: 'left' });
};
