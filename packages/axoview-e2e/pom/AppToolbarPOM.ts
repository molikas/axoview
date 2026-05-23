/**
 * AppToolbarPOM — top toolbar (packages/axoview-app/src/components/AppToolbar.tsx).
 *
 * ADR 0005 Decision 1 fixes the four right-hand groups:
 *   1. View modes (reserved)
 *   2. Save group: Save IconButton (Local mode only) + StatusCluster
 *   3. Document actions: Export (popover) + Share + Preview
 *   4. Sidebar toggle portal
 *
 * Lazy data-axoview-id retrofits — Session 2:
 *   - `toolbar-save` (Save IconButton)  ← paired with clickSave()
 *
 * Lazy data-axoview-id retrofits — Session 4:
 *   - `toolbar-export`             (ExportPopover IconButton)   ← clickExport()
 *   - `toolbar-export-json`        (Export JSON MenuItem)        ← clickExportJson()
 *   - `toolbar-export-project-zip` (Export Project MenuItem)     ← clickExportProjectZip()
 *
 * Methods left as `not-yet-implemented` stubs are declared so consumer specs
 * in Sessions 5–6 know the API surface; each stub names the attribute it
 * will require. Adding an attribute without an exercising spec is forbidden
 * by ADR 0008 Decision 5, so the stubs do NOT pre-stamp `data-axoview-id`
 * onto the source — the retrofit lands in the same commit as the method
 * body and the consuming spec.
 */
import { Page } from '@playwright/test';
import { byAxoviewId } from '../helpers/selectors';

export class AppToolbarPOM {
  constructor(readonly page: Page) {}

  saveButton() {
    return byAxoviewId(this.page, 'toolbar-save');
  }

  /** Local-mode save click. Server mode autosaves and the Save button isn't rendered. */
  async clickSave() {
    await this.saveButton().click();
  }

  /** Ctrl+S parity path. Same effect as clickSave() but exercises the lib hotkey handler. */
  async pressSaveHotkey() {
    await this.page.keyboard.press('Control+S');
  }

  exportButton() {
    return byAxoviewId(this.page, 'toolbar-export');
  }

  exportJsonMenuItem() {
    return byAxoviewId(this.page, 'toolbar-export-json');
  }

  exportProjectZipMenuItem() {
    return byAxoviewId(this.page, 'toolbar-export-project-zip');
  }

  /** Opens the Export popover. The popover renders the JSON / Image / Project ZIP menu items. */
  async clickExport() {
    await this.exportButton().click();
  }

  /**
   * Triggers a JSON download via the Export popover's "Export JSON" menu item.
   * Callers MUST arm `page.waitForEvent('download')` BEFORE invoking this so
   * the synchronous `<a download>` click isn't missed.
   */
  async clickExportJson() {
    await this.clickExport();
    await this.exportJsonMenuItem().click();
  }

  /**
   * Opens the project-ZIP export dialog via the Export popover's
   * "Export Project (.zip)" menu item. The dialog is then driven by
   * DialogsPOM.confirmExportProjectZip().
   */
  async clickExportProjectZip() {
    await this.clickExport();
    await this.exportProjectZipMenuItem().click();
  }

  /** Stub — `data-axoview-id="toolbar-share"`. Lights up when share spec lands (Session 6). */
  async clickShare(): Promise<never> {
    throw new Error('AppToolbarPOM.clickShare: not implemented — Session 6 adds toolbar-share attribute + body.');
  }

  /** Stub — `data-axoview-id="toolbar-preview"`. Lights up when multi-diagram spec lands (Session 6). */
  async clickPreview(): Promise<never> {
    throw new Error('AppToolbarPOM.clickPreview: not implemented — Session 6 adds toolbar-preview attribute + body.');
  }

  /**
   * Stub — reads the wrapping Tooltip's `title` prop for the Save button's
   * disabled-reason text. Lights up when a spec needs to assert the
   * disabled-state copy (Session 6 candidate).
   */
  async getSaveButtonDisabledReason(): Promise<never> {
    throw new Error('AppToolbarPOM.getSaveButtonDisabledReason: not implemented — wire when first spec asserts the tooltip text.');
  }
}
