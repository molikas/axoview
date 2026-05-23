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
   *  hidden picker, NOT via this POM — the picker fires a native chooser. */
  async confirmImportIcons() {
    await this.importIconsConfirmButton().click();
  }

  /** Confirms the icon deletion. The "in-use" warning text is asserted by
   *  the spec directly via locator role/name (DeleteIconConfirmDialog renders
   *  the count copy inline; no separate attribute needed). */
  async confirmDeleteIcon() {
    await this.deleteIconConfirmButton().click();
  }
}
