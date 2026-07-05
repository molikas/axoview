/**
 * connector-dot-and-label-placement.spec.ts — owner 2026-07-02.
 *
 *   - A connector whose two anchors land on the SAME tile has a single-point
 *     path (an SVG polyline draws nothing) — it now renders as a DOT marker so
 *     the degenerate connector is visible + selectable.
 *   - Placing a floating Label selects it but does NOT auto-open the Details
 *     deck (rightSidebar stays closed).
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { placeIconViaMouse } from '../helpers/place';
import { getModelItemCount, getModelConnectorCount } from '../helpers/store';

type Page = import('@playwright/test').Page;

const rightSidebarOpen = (page: Page) =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().rightSidebarOpen === true
  );
const itemControlsType = (page: Page) =>
  page.evaluate(
    () => (window as any).__axoview__.ui.getState().itemControls?.type ?? null
  );

test.describe('Single-tile connector renders a dot', () => {
  test('a connector with both anchors on one tile paints a dot marker', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const P = { x: 440, y: 300 };
    await placeIconViaMouse(page, P);
    await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);

    // Connector mode; click the SAME node twice → both anchors resolve to its
    // tile → a single-tile (zero-length) connector.
    await page.keyboard.press('c');
    await canvas.clickAt(P);
    await canvas.clickAt(P);
    await expect
      .poll(() => getModelConnectorCount(page), { timeout: 5_000 })
      .toBe(1);

    // The dot marker paints (the invisible-polyline case is now covered).
    await expect(page.locator('[data-testid="connector-dot"]')).toHaveCount(1);
  });
});

test.describe('Label placement does not open the Details deck', () => {
  test('placing a label selects it but leaves the right deck closed', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    // Ensure the deck starts closed.
    await page.evaluate(() =>
      (window as any).__axoview__.ui.getState().actions.setItemControls(null)
    );
    await canvas.placeLabelAt({ x: 420, y: 300 });

    // The label is selected (top-bar target)...
    await expect.poll(() => itemControlsType(page), { timeout: 3_000 }).toBe(
      'LABEL'
    );
    // ...but the Details deck did NOT auto-open.
    expect(await rightSidebarOpen(page)).toBe(false);
  });
});
