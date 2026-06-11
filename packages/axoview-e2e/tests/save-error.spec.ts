/**
 * save-error.spec.ts — ADR 0011 failure-of-intent (Save).
 *
 * Closes the Save leg of the deferred E2E coverage from PR #9/#10 5e.
 *
 * Local (session) mode persists a saved diagram to sessionStorage under the
 * `axoview_diagram_<id>` key (LocalStorageProvider.sessionSaveDiagram). We boot
 * a blank diagram (the create write succeeds), make an edit so the toolbar Save
 * action is live, then arm a Storage.setItem trap that throws QuotaExceededError
 * for that key prefix. Clicking Save routes handleSaveClick → saveDiagram →
 * executeSave → storage.saveDiagram, whose throw is caught and converted into
 * the explicit SaveErrorDialog (replacing the pre-ADR-0011 toast).
 *
 * The trap is armed *before* the edit so the debounced autosave also throws —
 * its onError keeps the diagram dirty (the Save button stays enabled) and only
 * toasts, which is the ADR 0011 side-effect carve-out (autosave ≠ dialog).
 *
 * Two contracts:
 *   1. Dismiss (OK) clears the error and leaves the editor intact — the canvas
 *      stays mounted, no navigation (ADR 0011 §3 in-editor case).
 *   2. "Try again" re-runs the save; with the trap disarmed it succeeds and
 *      the dialog closes.
 *
 * Anchors stamped alongside this spec (app-side, no lib rebuild):
 *   - dialog-save-error          (SaveErrorDialog Dialog paper)
 *   - dialog-save-error-dismiss  (SaveErrorDialog OK Button)
 *   - dialog-save-error-retry    (SaveErrorDialog "Try again" Button)
 */
import { test as baseTest, expect } from '@playwright/test';
import { AppToolbarPOM } from '../pom/AppToolbarPOM';
import { DialogsPOM } from '../pom/DialogsPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { getModelItemCount, waitForDebugBridge } from '../helpers/store';

const LOCAL_STORAGE_KEYS = [
  'axoview-diagrams',
  'axoview-last-opened',
  'axoview-last-opened-data',
  'axoview-explorer-initialized',
  'axoview-explorer-open'
];

const ONBOARDING_DISMISS_FLAGS: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];

/**
 * Installs (pre-navigation) a Storage.prototype.setItem trap that throws a
 * QuotaExceededError for the session diagram-blob key, but only while the
 * `__axoviewFailSave` window flag is set. The initial create write happens
 * with the flag off, so only the post-arm saves fail.
 */
async function installSaveTrap(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __axoviewFailSave?: boolean };
    w.__axoviewFailSave = false;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (w.__axoviewFailSave && String(key).startsWith('axoview_diagram_')) {
        throw new DOMException('Quota exceeded (test trap)', 'QuotaExceededError');
      }
      return orig.call(this, key, value);
    };
  });
}

async function setSaveTrap(page: import('@playwright/test').Page, armed: boolean) {
  await page.evaluate((flag: boolean) => {
    (window as unknown as { __axoviewFailSave?: boolean }).__axoviewFailSave = flag;
  }, armed);
}

async function bootBlankDiagram(page: import('@playwright/test').Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
  await page.goto('/');
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
}

/**
 * Places one icon on the canvas to dirty the diagram (drag the first elements-
 * panel tile onto the canvas). Mirrors the placeIcon helper in
 * import-export-json.spec.ts.
 */
async function placeIcon(page: import('@playwright/test').Page) {
  const elementsToggle = byAxoviewId(page, 'dock-elements-toggle');
  const gridItem = byAxoviewId(page, 'canvas-icon-grid-item').first();
  if (!(await gridItem.isVisible().catch(() => false))) await elementsToggle.click();
  await gridItem.waitFor({ state: 'visible', timeout: 5_000 });
  const canvas = byLibTestId(page, 'axoview-canvas');
  const iconBox = await gridItem.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!iconBox || !canvasBox) throw new Error('placeIcon: missing bounding box');
  await page.mouse.move(iconBox.x + iconBox.width / 2, iconBox.y + iconBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + 400, canvasBox.y + 280, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => getModelItemCount(page), { timeout: 5_000 }).toBe(1);
}

baseTest.describe('Save error — ADR 0011 failure-of-intent (Save)', () => {
  baseTest.beforeEach(async ({ page }) => {
    await installSaveTrap(page);
  });

  baseTest('a failing save write shows SaveErrorDialog; dismiss leaves the editor intact', async ({ page }) => {
    await bootBlankDiagram(page);

    // Arm before the edit so the debounced autosave also fails (keeps the
    // diagram dirty / the Save button live) without short-circuiting the test.
    await setSaveTrap(page, true);
    await placeIcon(page);

    const toolbar = new AppToolbarPOM(page);
    await expect(toolbar.saveButton()).toBeEnabled({ timeout: 5_000 });
    await toolbar.clickSave();

    const dialogs = new DialogsPOM(page);
    await dialogs.saveError().waitFor({ state: 'visible', timeout: 10_000 });
    await expect(dialogs.saveError()).toContainText("Couldn't save.");
    await expect(dialogs.saveError()).toContainText('Browser storage may be full');

    await dialogs.dismissSaveError();
    await expect(dialogs.saveError()).toHaveCount(0);

    // Editor intact — no navigation, canvas still mounted.
    await expect(page).toHaveURL(/\/$/);
    await expect(byLibTestId(page, 'axoview-canvas')).toBeVisible();
  });

  baseTest('"Try again" re-runs the save and the dialog closes once the write succeeds', async ({ page }) => {
    await bootBlankDiagram(page);

    await setSaveTrap(page, true);
    await placeIcon(page);

    const toolbar = new AppToolbarPOM(page);
    await expect(toolbar.saveButton()).toBeEnabled({ timeout: 5_000 });
    await toolbar.clickSave();

    const dialogs = new DialogsPOM(page);
    await dialogs.saveError().waitFor({ state: 'visible', timeout: 10_000 });

    // Disarm the trap, then retry — the re-run save now succeeds and the
    // dialog dismisses.
    await setSaveTrap(page, false);
    await dialogs.retrySave();
    await expect(dialogs.saveError()).toHaveCount(0);
    await expect(byLibTestId(page, 'axoview-canvas')).toBeVisible();
  });
});
