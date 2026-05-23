/**
 * dialogs.spec.ts — Tier 1 J16 + J17 + J18.
 *
 * J16 (Settings dialog, per docs/manual-test-baseline.md): open → all tabs
 * render → close without changes → no state corruption. Post-B-5 (commit
 * 315f395) the Diagnostics tab is gone; J16's tab-list assertion is the
 * regression guard against accidental re-add.
 *
 * J17 (Help dialog): open → shortcuts listed match what J15 verified.
 * Includes B-4 follow-up rows (Ctrl+A, Alt+click waypoint, Ctrl/Cmd+click)
 * — baseline finding #6 (commit 0c9a1f9) — so any future drift on the
 * canonical shortcut surface fails CI rather than the next manual walk.
 *
 * J18 (Diagnostics overlay): click DiagnosticsToggleButton → overlay
 * visible (the "AXOVIEW DIAG" floating chip) → close via the overlay's
 * `×` button → overlay hidden. Note: per the baseline's J18 note, the
 * "Diagnostics overlay" J18 references is the *performance* overlay
 * (DiagnosticsOverlay / DiagnosticsToggleButton), NOT the legacy
 * SettingsDialog DiagnosticsTab (deleted in B-5 / 315f395).
 *
 * Lazy data-axoview-id retrofits this spec:
 *   - LIB `dock-settings`            (LeftDock.tsx)
 *   - LIB `dialog-settings`          (SettingsDialog.tsx Dialog)
 *   - LIB `dialog-settings-close`    (SettingsDialog.tsx close IconButton)
 *   - LIB `dialog-settings-tab-<id>` (SettingsDialog.tsx ListItemButton ×6)
 *   - LIB `dock-help`                (BottomDock.tsx)
 *   - LIB `dialog-help`              (HelpDialog.tsx Dialog)
 *   - LIB `dialog-help-close`        (HelpDialog.tsx close Button)
 *   - APP `diagnostics-toggle`       (DiagnosticsToggleButton.tsx)
 *   - APP `diagnostics-overlay`      (DiagnosticsOverlay.tsx root)
 *   - APP `diagnostics-overlay-close`(DiagnosticsOverlay.tsx × button)
 *
 * Lib rebuild cycles this spec: 1 (LeftDock + BottomDock + HelpDialog +
 * SettingsDialog batched).
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { SettingsDialogPOM } from '../pom/SettingsDialogPOM';
import { HelpDialogPOM } from '../pom/HelpDialogPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { waitForDebugBridge } from '../helpers/store';

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

async function pinOnboardingDismissed(page: import('@playwright/test').Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function clearDiagramStorage(page: import('@playwright/test').Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
}

async function bootBlankDiagram(page: import('@playwright/test').Page) {
  await clearDiagramStorage(page);
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
}

test.describe('Dialogs — J16 / J17 / J18', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('J16: Settings dialog opens, renders the expected tab list, closes via Escape and via the close button', async ({ page }) => {
    const settings = new SettingsDialogPOM(page);
    await settings.open();

    // Tab list shape (post-B-5): keyboard + canvas + connectors + iconPacks +
    // language + about. Diagnostics is NOT present — that's the B-5 contract.
    await expect(settings.tab('keyboard')).toBeVisible();
    await expect(settings.tab('canvas')).toBeVisible();
    await expect(settings.tab('connectors')).toBeVisible();
    await expect(settings.tab('iconPacks')).toBeVisible();
    await expect(settings.tab('language')).toBeVisible();
    await expect(settings.tab('about')).toBeVisible();
    // Belt-and-braces: no element bearing a "diagnostics" tab id exists.
    await expect(
      page.locator('[data-axoview-id="dialog-settings-tab-diagnostics"]')
    ).toHaveCount(0);

    // Close via Escape — onClose handler reduces setDialog(null).
    await settings.closeViaEscape();

    // Re-open and close via the close button.
    await settings.open();
    await settings.closeViaButton();

    // No orphan dialog DOM left behind.
    await expect(settings.root()).toHaveCount(0);
  });

  test('J17: Help dialog opens via dock + F1, lists the B-4 canonical shortcuts, closes cleanly', async ({ page }) => {
    const help = new HelpDialogPOM(page);

    // Open via the BottomDock affordance.
    await help.open();

    // B-4 (0c9a1f9) added these three rows. Asserting all three guards the
    // baseline finding #6 fix from silent regression.
    await expect(help.shortcutRowByAction('Select All')).toBeVisible();
    await expect(help.shortcutRowByAction('Remove Waypoint')).toBeVisible();
    await expect(help.shortcutRowByAction('Toggle Selection')).toBeVisible();

    // Close via the dialog's close button.
    await help.closeViaButton();
    await expect(help.root()).toHaveCount(0);

    // Reopen via F1 — same dialog, exercises the keyboard path the docks
    // tooltip advertises. useInteractionManager filters INPUT/TEXTAREA
    // targets; after closing the dialog focus returns to <body>, which
    // passes the filter.
    await help.openViaF1();
    await help.closeViaEscape();
    await expect(help.root()).toHaveCount(0);
  });

  test('J18: diagnostics toggle shows the performance overlay; the overlay × button hides it', async ({ page }) => {
    const toggle = byAxoviewId(page, 'diagnostics-toggle');
    const overlay = byAxoviewId(page, 'diagnostics-overlay');
    const overlayClose = byAxoviewId(page, 'diagnostics-overlay-close');

    // Pre-state: the overlay can be either closed or open depending on
    // dev-server defaults. We assert the toggle button is present and
    // close any pre-existing overlay so the test starts from a known state.
    await expect(toggle).toBeVisible();
    if (await overlay.isVisible().catch(() => false)) {
      await overlayClose.click();
      await overlay.waitFor({ state: 'hidden', timeout: 3_000 });
    }

    // Toggle on — overlay mounts with the "AXOVIEW DIAG" header chip.
    await toggle.click();
    await overlay.waitFor({ state: 'visible', timeout: 3_000 });
    await expect(overlay).toContainText('AXOVIEW DIAG');

    // Toggle off via the overlay's × button (the toggle button only sets
    // open=true; it can't close — see DiagnosticsToggleButton.tsx).
    await overlayClose.click();
    await overlay.waitFor({ state: 'hidden', timeout: 3_000 });
  });
});
