/**
 * HelpDialogPOM — packages/axoview-lib/src/components/HelpDialog/HelpDialog.tsx.
 *
 * Surface walkthrough:
 *   - Triggered from the BottomDock Help IconButton (data-axoview-id=
 *     `dock-help`, see BottomDock.tsx#L86). Also opens via F1 — useInteractionManager.ts:308
 *     wires the keydown listener; reachable in tests via `pressF1()` for
 *     parity with the J15 hotkey suite.
 *   - The dialog body renders two tables: keyboard shortcuts + mouse
 *     interactions. The B-4 follow-up (commit 0c9a1f9) added rows for
 *     Ctrl+A (Select All), Alt+click (Remove waypoint), and Ctrl/Cmd+click
 *     (Toggle Selection); J17's regression assertion is that those three
 *     rows are present in the rendered table.
 *
 * Lazy data-axoview-id retrofits — Session 6 (Commit 2):
 *   - LIB `dock-help`         (BottomDock.tsx)             — open()
 *   - LIB `dialog-help`       (HelpDialog.tsx Dialog)      — root()
 *   - LIB `dialog-help-close` (HelpDialog.tsx Close Button)— closeViaButton()
 *
 * Row-level assertions use text matching against table cells rather than a
 * per-row attribute; the table is a stable MUI <Table> with <TableRow> per
 * shortcut entry, and the literal copy is part of the contract being
 * asserted (changing the shortcut text without updating J17 is a defect
 * worth catching at PR review).
 */
import { Locator, Page } from '@playwright/test';
import { byAxoviewId } from '../helpers/selectors';

export class HelpDialogPOM {
  constructor(readonly page: Page) {}

  triggerButton(): Locator {
    return byAxoviewId(this.page, 'dock-help');
  }

  root(): Locator {
    return byAxoviewId(this.page, 'dialog-help');
  }

  closeButton(): Locator {
    return byAxoviewId(this.page, 'dialog-help-close');
  }

  /** Opens via the BottomDock Help IconButton. */
  async open(timeoutMs = 5_000) {
    await this.triggerButton().click();
    await this.root().waitFor({ state: 'visible', timeout: timeoutMs });
  }

  /** Opens via the F1 hotkey — useInteractionManager binds the keydown. */
  async openViaF1(timeoutMs = 5_000) {
    await this.page.keyboard.press('F1');
    await this.root().waitFor({ state: 'visible', timeout: timeoutMs });
  }

  /** Returns a locator for any table row whose first cell contains the
   *  given action name. Use `await loc.first().isVisible()` or count
   *  semantics against this. */
  shortcutRowByAction(actionName: string): Locator {
    return this.root().locator('tr', { hasText: actionName });
  }

  async closeViaButton(timeoutMs = 3_000) {
    await this.closeButton().click();
    await this.root().waitFor({ state: 'hidden', timeout: timeoutMs });
  }

  async closeViaEscape(timeoutMs = 3_000) {
    await this.page.keyboard.press('Escape');
    await this.root().waitFor({ state: 'hidden', timeout: timeoutMs });
  }
}
