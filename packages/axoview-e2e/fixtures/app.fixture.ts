/**
 * Base app fixture. Loads `/`, waits for either the EmptyStateScreen or the
 * canvas to mount (covers both first-run and resumed-diagram boots), and
 * dismisses any onboarding/import tooltip overlays.
 *
 * Tests that need a clean storage starting point should clear it via
 * `page.addInitScript` BEFORE invoking the fixture — the fixture itself
 * preserves whatever state localStorage carries so suites can opt into
 * persisted-state scenarios (e.g. the J1 reopen leg).
 */
import { test as base, Page } from '@playwright/test';
import { waitForDebugBridge } from '../helpers/store';

export class AppPage {
  constructor(readonly page: Page) {}

  async dismissHintTooltips() {
    // ConnectorHintTooltip + ImportHintTooltip dismiss on any interaction;
    // Escape is the lightest path that doesn't accidentally trigger a menu.
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(150);
  }
}

async function waitForAppReady(page: Page) {
  // Either the empty state OR the canvas must be visible — they're mutually
  // exclusive, so a `:visible` race resolves on whichever boot path the
  // current localStorage carries.
  await Promise.race([
    page.locator('[data-axoview-id="screen-empty-create"]').waitFor({ state: 'visible', timeout: 15_000 }),
    page.locator('[data-testid="axoview-canvas"]').waitFor({ state: 'visible', timeout: 15_000 })
  ]);
}

export const appTest = base.extend<{ app: AppPage }>({
  app: async ({ page }, use) => {
    await page.goto('/');
    await waitForAppReady(page);
    await waitForDebugBridge(page);
    const app = new AppPage(page);
    await app.dismissHintTooltips();
    await use(app);
  }
});

export { expect } from '@playwright/test';
