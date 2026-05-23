/**
 * Canvas-ready fixture. Extends the base app fixture, asserts an editable
 * canvas is mounted, and exposes a CanvasPage helper for the handful of
 * sub-canvas reads tests need before the dedicated CanvasPOM lands
 * (Session 5 per docs/tactical/e2e-suite-rewrite.md).
 *
 * If the boot lands on EmptyStateScreen, the fixture creates a blank diagram
 * via the screen-empty-create affordance so canvas-dependent tests can rely
 * on a freshly-opened editor surface.
 */
import { Page } from '@playwright/test';
import { appTest, AppPage } from './app.fixture';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { getModelItemCount, getUiMode } from '../helpers/store';

export class CanvasPage extends AppPage {
  constructor(page: Page) {
    super(page);
  }

  /** Reads the model item count from the debug bridge. */
  async itemCount(): Promise<number> {
    return getModelItemCount(this.page);
  }

  /** Reads the current UI mode (CURSOR, PLACE_ICON, …) from the debug bridge. */
  async mode() {
    return getUiMode(this.page);
  }

  /** The Renderer canvas locator — still uses lib data-testid pending CanvasPOM migration. */
  canvas() {
    return byLibTestId(this.page, 'axoview-canvas');
  }
}

export const canvasTest = appTest.extend<{ canvas: CanvasPage }>({
  canvas: async ({ page, app }, use) => {
    const emptyCreate = byAxoviewId(page, 'screen-empty-create');
    if (await emptyCreate.isVisible().catch(() => false)) {
      await emptyCreate.click();
      await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
    }
    await use(new CanvasPage(page));
    void app;
  }
});

export { expect } from '@playwright/test';
