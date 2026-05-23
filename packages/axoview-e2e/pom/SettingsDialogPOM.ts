/**
 * SettingsDialogPOM — packages/axoview-lib/src/components/SettingsDialog/
 * SettingsDialog.tsx.
 *
 * Surface walkthrough:
 *   - The dialog is triggered from the LeftDock's system anchor
 *     (`dock-settings` IconButton, bottom of the strip — see LeftDock.tsx#L150-164).
 *   - `dialog === DialogTypeEnum.SETTINGS` controls visibility; the dialog
 *     dispatches `setDialog(null)` on its onClose (backdrop / Escape / close
 *     button), which the lib's uiStateStore reduces to the closed state.
 *   - Tabs are a left rail (keyboard, canvas, connectors, iconPacks?, language?,
 *     about). The iconPacks tab only renders when iconPackManager prop is
 *     provided; language tab only when languageSelector prop is provided —
 *     both are wired in the app's <Axoview> mount so they're always present
 *     under standard boot conditions.
 *   - Post-B-5 (commit 315f395) the legacy DiagnosticsTab is GONE; the
 *     performance overlay (DiagnosticsToggleButton + DiagnosticsOverlay) is
 *     the surviving diagnostics surface and lives outside this dialog
 *     entirely — see DialogsOverlayPOM/DiagnosticsOverlay assertions in
 *     dialogs.spec.ts#J18.
 *
 * Lazy data-axoview-id retrofits — Session 6 (Commit 2):
 *   - LIB `dock-settings`              (LeftDock.tsx) — open()
 *   - LIB `dialog-settings`            (SettingsDialog.tsx Dialog) — root()
 *   - LIB `dialog-settings-close`      (SettingsDialog.tsx close IconButton) — close()
 *   - LIB `dialog-settings-tab-<id>`   (SettingsDialog.tsx ListItemButton) — tab(id)
 */
import { Locator, Page } from '@playwright/test';
import { byAxoviewId } from '../helpers/selectors';

export type SettingsTabId =
  | 'keyboard'
  | 'canvas'
  | 'connectors'
  | 'iconPacks'
  | 'language'
  | 'about';

export class SettingsDialogPOM {
  constructor(readonly page: Page) {}

  triggerButton(): Locator {
    return byAxoviewId(this.page, 'dock-settings');
  }

  root(): Locator {
    return byAxoviewId(this.page, 'dialog-settings');
  }

  closeButton(): Locator {
    return byAxoviewId(this.page, 'dialog-settings-close');
  }

  tab(id: SettingsTabId): Locator {
    return byAxoviewId(this.page, `dialog-settings-tab-${id}`);
  }

  /** Click the LeftDock Settings IconButton and wait for the dialog to open. */
  async open(timeoutMs = 5_000) {
    await this.triggerButton().click();
    await this.root().waitFor({ state: 'visible', timeout: timeoutMs });
  }

  /** Close via the corner close IconButton. */
  async closeViaButton(timeoutMs = 3_000) {
    await this.closeButton().click();
    await this.root().waitFor({ state: 'hidden', timeout: timeoutMs });
  }

  /** Close via Escape — confirms the onClose handler honours the keyboard path. */
  async closeViaEscape(timeoutMs = 3_000) {
    await this.page.keyboard.press('Escape');
    await this.root().waitFor({ state: 'hidden', timeout: timeoutMs });
  }
}
