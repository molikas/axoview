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
 * Lazy data-axoview-id retrofits — Session 6:
 *   - `toolbar-preview`            (Preview IconButton)          ← clickPreview()
 *   - `toolbar-back-to-editing`    (Back-to-editing Button)      ← clickBackToEditing()
 *   - `toolbar-share`              (Share IconButton)            ← openShareDialog()
 *   - `share-popover`              (Popover Paper)               ← sharePopover()
 *   - `share-popover-close`        (Popover close IconButton)    ← closeShareDialog()
 *   - `share-url-input`            (TextField input)             ← shareUrlInput()
 *   - `share-copy-button`          (Copy Button)                 ← copyShareUrl()
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

  shareButton() {
    return byAxoviewId(this.page, 'toolbar-share');
  }

  sharePopover() {
    return byAxoviewId(this.page, 'share-popover');
  }

  sharePopoverCloseButton() {
    return byAxoviewId(this.page, 'share-popover-close');
  }

  shareUrlInput() {
    return byAxoviewId(this.page, 'share-url-input');
  }

  shareCopyButton() {
    return byAxoviewId(this.page, 'share-copy-button');
  }

  /**
   * Opens the Share popover via the toolbar Share IconButton.
   *
   * In Local mode the Share button is render-disabled (per
   * `!serverStorageAvailable || !currentDiagramId`); the share spec relies
   * on mocked `/api/config` to flip `serverStorageAvailable=true` so this
   * affordance becomes clickable. See share.spec.ts for the mock setup.
   *
   * The handler triggers `storage.shareDiagram(currentDiagramId)` which
   * POSTs to `/api/diagrams/<id>/share`; specs mock that endpoint to return
   * a deterministic UUID so the URL input asserts against a known value.
   */
  async openShareDialog() {
    await this.shareButton().click();
    await this.sharePopover().waitFor({ state: 'visible', timeout: 5_000 });
  }

  async closeShareDialog() {
    await this.sharePopoverCloseButton().click();
    await this.sharePopover().waitFor({ state: 'hidden', timeout: 3_000 });
  }

  /** Reads the current share URL out of the popover input field. */
  async getShareUrl(): Promise<string> {
    return (await this.shareUrlInput().inputValue()).trim();
  }

  /** Clicks the Copy button. Caller must `context.grantPermissions(['clipboard-read', 'clipboard-write'])` to use the navigator.clipboard read-back. */
  async copyShareUrl() {
    await this.shareCopyButton().click();
  }

  previewButton() {
    return byAxoviewId(this.page, 'toolbar-preview');
  }

  backToEditingButton() {
    return byAxoviewId(this.page, 'toolbar-back-to-editing');
  }

  /**
   * Clicks the Preview IconButton. handlePreviewClick (DiagramLifecycleProvider)
   * autosaves the current diagram, then navigates to `/display/<currentId>`
   * with `state: { fromEditor: true }`. The fromEditor flag is what makes
   * the Back-to-editing affordance render on the readonly toolbar.
   */
  async clickPreview() {
    await this.previewButton().click();
  }

  /**
   * Clicks the Back-to-editing Button. Only renders on readonly routes when
   * `location.state.fromEditor === true`; the handler calls `navigate(-1)`,
   * which in the canonical "Preview from editor" flow returns to `/`.
   */
  async clickBackToEditing() {
    await this.backToEditingButton().click();
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
