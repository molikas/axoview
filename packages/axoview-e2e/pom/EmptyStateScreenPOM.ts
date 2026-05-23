/**
 * EmptyStateScreenPOM — packages/axoview-app/src/components/EmptyStateScreen.tsx.
 *
 * The empty-state screen renders when the file tree is empty (no diagrams
 * persisted) and offers two paths: create a blank diagram or import an
 * existing one. J20 in docs/manual-test-baseline.md exercises both buttons.
 *
 * Lazy data-axoview-id retrofits — Session 3:
 *   - `screen-empty-create` (New diagram Button) — landed Session 2 alongside J1.
 *   - `screen-empty-import` (Import Button)     — added Session 3 alongside J20.
 *
 * `clickImport()` triggers a native file chooser when the file tree is empty
 * (App.tsx handleImportClick → importFileInputRef.current?.click()). Tests
 * intercept that via `page.waitForEvent('filechooser')` rather than asserting
 * a visible dialog — the empty-state path bypasses the in-tree ImportDialog.
 */
import { Page } from '@playwright/test';
import { byAxoviewId } from '../helpers/selectors';

export class EmptyStateScreenPOM {
  constructor(readonly page: Page) {}

  createButton() {
    return byAxoviewId(this.page, 'screen-empty-create');
  }

  importButton() {
    return byAxoviewId(this.page, 'screen-empty-import');
  }

  async expectVisible(timeoutMs = 10_000) {
    await this.createButton().waitFor({ state: 'visible', timeout: timeoutMs });
  }

  async clickCreate() {
    await this.createButton().click();
  }

  /**
   * Clicks the Import button. In the empty-tree path this fires a native
   * file picker on a hidden <input type="file">. Callers should set up a
   * `page.waitForEvent('filechooser')` BEFORE invoking this so the event
   * isn't missed; see hotkeys/connector specs for the pattern.
   */
  async clickImport() {
    await this.importButton().click();
  }
}
