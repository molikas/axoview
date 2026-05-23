/**
 * DialogsPOM — generic dialog primitives.
 *
 * Session 4 ships the bare minimum needed by the file-ops specs:
 *   - confirmExportProjectZip()   → drives ExportProjectZipDialog's
 *                                   "Download .zip" affordance.
 *   - confirmImportIcons()        → drives ImportIconsDialog's "Import"
 *                                   affordance (Commit 3 — icons.spec.ts).
 *   - confirmDeleteIcon()         → drives DeleteIconConfirmDialog's
 *                                   "Delete" affordance (Commit 3).
 *
 * Methods declared as `not-yet-implemented` here name the data-axoview-id
 * each future spec will require. Per ADR 0008 Decision 5, the retrofit
 * lands in the same commit as the consuming spec — not as a sweep.
 *
 * Lazy data-axoview-id retrofits paired with this POM (split across the
 * Session-4 commits — see each spec's commit body):
 *   - `dialog-export-project-zip-confirm` (Session 4, Commit 2)
 *   - `dialog-import-icons-confirm`       (Session 4, Commit 3)
 *   - `dialog-delete-icon-confirm`        (Session 4, Commit 3)
 *
 * Session 6 additions (Commit 3 — share spec):
 *   - `dialog-local-mode-share-error`           (LocalModeShareErrorDialog Dialog)
 *   - `dialog-local-mode-share-error-dismiss`   (LocalModeShareErrorDialog OK Button)
 */
import { Page } from '@playwright/test';
import { byAxoviewId } from '../helpers/selectors';

export class DialogsPOM {
  constructor(readonly page: Page) {}

  exportProjectZipConfirmButton() {
    return byAxoviewId(this.page, 'dialog-export-project-zip-confirm');
  }

  importIconsConfirmButton() {
    return byAxoviewId(this.page, 'dialog-import-icons-confirm');
  }

  deleteIconConfirmButton() {
    return byAxoviewId(this.page, 'dialog-delete-icon-confirm');
  }

  /**
   * Clicks the "Download .zip" affordance in ExportProjectZipDialog. Callers
   * MUST arm `page.waitForEvent('download')` before invoking — handleExport
   * dispatches `downloadBlob` synchronously, then calls onClose; missing the
   * listener means missing the file.
   */
  async confirmExportProjectZip() {
    await this.exportProjectZipConfirmButton().click();
  }

  /** Confirms the icon-import dialog. The dialog opens via setFiles() on the
   *  hidden picker, NOT via this POM — the picker fires a native chooser.
   *
   *  Awaits the confirm button's detach AFTER click so callers (and any
   *  subsequent drag onto the canvas) don't race the dialog's exit animation.
   *  Session 8 (commit `0c5f7dc` instrumentation) confirmed: post-confirm the
   *  `MuiDialog-container` was still mounted over the canvas on CI when
   *  `dragIconToCanvas` fired, intercepting the mouse.down on the imported
   *  icon tile (elementAtDrop = MuiDialog-container, mode stayed CURSOR,
   *  modelItemsCount = 0). MUI Dialog uses TransitionGroup with a ~225 ms
   *  fade-out; locally the timing absorbed it, headless CI did not. Waiting
   *  for the button to leave the DOM is a clean detach signal — by definition
   *  the dialog has fully unmounted. */
  async confirmImportIcons() {
    const btn = this.importIconsConfirmButton();
    await btn.click();
    await btn.waitFor({ state: 'detached', timeout: 5_000 });
  }

  /** Confirms the icon deletion. The "in-use" warning text is asserted by
   *  the spec directly via locator role/name (DeleteIconConfirmDialog renders
   *  the count copy inline; no separate attribute needed). Awaits detach for
   *  the same reason as confirmImportIcons — see that method's body. */
  async confirmDeleteIcon() {
    const btn = this.deleteIconConfirmButton();
    await btn.click();
    await btn.waitFor({ state: 'detached', timeout: 5_000 });
  }

  localModeShareError() {
    return byAxoviewId(this.page, 'dialog-local-mode-share-error');
  }

  localModeShareErrorDismissButton() {
    return byAxoviewId(this.page, 'dialog-local-mode-share-error-dismiss');
  }

  /**
   * Dismisses the LocalModeShareErrorDialog. The handler calls
   * `navigate('/', { replace: true })` so the URL strips back to the
   * editor root.
   */
  async dismissLocalModeShareError() {
    await this.localModeShareErrorDismissButton().click();
  }
}
