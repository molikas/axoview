/**
 * NodeInfoTabPOM — the "Link to diagram" picker.
 *
 * As of D2 (2026-07-02) the diagram-link picker moved OUT of the node Details
 * deck and INTO the top-bar style strip's Link control, which is now the single
 * Link surface (web URL + link-to-diagram). This POM drives that strip control:
 *   1. select a node in edit mode,
 *   2. open the strip Link popover (`data-testid="strip-link-button"`),
 *   3. the diagram picker (an MUI Autocomplete) mounts inside the popover — but
 *      only when `linkedDiagrams.length > 0` (another diagram exists).
 *   4. once the model item carries a `link`, the open-linked-diagram IconButton
 *      renders and dispatches `axoview-open-diagram-in-editor` on click; App.tsx
 *      calls openDiagramById → the editor swaps onto the linked diagram in the
 *      same tab (no URL change).
 *
 * Anchors (lib, TopBarStyleControls.tsx):
 *   - `strip-link-button`          (data-testid on the Link StripButton trigger)
 *   - `strip-link-diagram-picker`  (Autocomplete <input>)
 *   - `strip-link-diagram-listbox` (Autocomplete portaled listbox <ul>)
 *   - `strip-link-diagram-open`    (open-linked IconButton)
 */
import { Locator, Page } from '@playwright/test';
import { byAxoviewId } from '../helpers/selectors';

export class NodeInfoTabPOM {
  constructor(readonly page: Page) {}

  private linkButton(): Locator {
    return this.page.locator('[data-testid="strip-link-button"]');
  }

  linkPickerInput(): Locator {
    return byAxoviewId(this.page, 'strip-link-diagram-picker');
  }

  linkPickerListbox(): Locator {
    return byAxoviewId(this.page, 'strip-link-diagram-listbox');
  }

  openLinkedDiagramButton(): Locator {
    return byAxoviewId(this.page, 'strip-link-diagram-open');
  }

  /** Opens the strip Link popover (idempotent: skips if the picker is already
   *  visible). The diagram picker only mounts here when ≥1 linkable diagram
   *  exists, so this doubles as the "diagram-link is available" gate. */
  async openLinkPopover(timeoutMs = 5_000) {
    if (await this.linkPickerInput().isVisible().catch(() => false)) return;
    await this.linkButton().click();
    await this.linkPickerInput().waitFor({ state: 'visible', timeout: timeoutMs });
  }

  /** Resolves when the strip Link popover shows the diagram picker — i.e. a node
   *  is selected AND at least one linkable diagram exists. */
  async expectVisible(timeoutMs = 5_000) {
    await this.openLinkPopover(timeoutMs);
  }

  /**
   * Opens the Autocomplete dropdown by focusing the input + pressing ArrowDown.
   * Returns the listbox locator. MUI portals the listbox as a <ul role="listbox">
   * child of body; the `data-axoview-id` retrofit lands on that <ul>.
   */
  async openPicker(): Promise<Locator> {
    await this.openLinkPopover();
    const input = this.linkPickerInput();
    await input.click();
    await input.press('ArrowDown');
    const listbox = this.linkPickerListbox();
    await listbox.waitFor({ state: 'visible', timeout: 3_000 });
    return listbox;
  }

  /** Reads the visible option labels from the open listbox. */
  async getOptionNames(): Promise<string[]> {
    const listbox = this.linkPickerListbox();
    return listbox.locator('li[role="option"]').allTextContents();
  }

  /**
   * Picks the named option in the Autocomplete and waits for the post-select
   * state to settle (open-linked IconButton appears).
   */
  async selectLinkedDiagram(name: string) {
    const listbox = await this.openPicker();
    await listbox.locator('li[role="option"]', { hasText: name }).click();
    await this.openLinkedDiagramButton().waitFor({ state: 'visible', timeout: 3_000 });
  }

  /**
   * Clicks the open-linked-diagram IconButton. The handler dispatches
   * `axoview-open-diagram-in-editor` with `{ id: modelItem.link }`; App.tsx
   * resolves the diagram name and calls openDiagramById — no URL change,
   * same browser tab, stays in edit mode.
   */
  async clickOpenLinkedDiagram() {
    await this.openLinkPopover();
    await this.openLinkedDiagramButton().click();
  }
}
