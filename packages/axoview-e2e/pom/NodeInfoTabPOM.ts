/**
 * NodeInfoTabPOM — right-sidebar Node Info tab inside the ItemControls panel
 * (packages/axoview-lib/src/components/ItemControls/NodeControls/NodeInfoTab/
 * NodeInfoTab.tsx).
 *
 * Surface walkthrough:
 *   - The Node Info tab renders whenever a single canvas item is selected in
 *     edit mode (EXPLORABLE_READONLY routes to NodePanel instead — see
 *     `NodePanel.tsx` for that surface; this POM is edit-mode only).
 *   - The "Link to diagram" Section only mounts when `linkedDiagrams.length > 0`
 *     — i.e. another diagram exists in the project. The picker is an MUI
 *     Autocomplete; the listbox portals out of the panel subtree when open.
 *   - Once the model item carries a `link`, the open-linked-diagram IconButton
 *     renders next to the picker and dispatches `axoview-open-diagram-in-editor`
 *     on click. App.tsx listens for that event and calls openDiagramById, so
 *     the editor swaps onto the linked diagram in the same tab (no URL change).
 *
 * Lazy data-axoview-id retrofits — Session 6 (Commit 1, J5):
 *   - `node-info-tab-link-picker`          (lib, NodeInfoTab.tsx <input>)
 *   - `node-info-tab-link-picker-listbox`  (lib, NodeInfoTab.tsx Autocomplete listbox)
 *   - `node-info-tab-open-linked`          (lib, NodeInfoTab.tsx IconButton)
 *
 * The legacy `data-testid="node-info-tab-open-linked-diagram"` stays in place
 * for the lib's own jest unit tests until that suite re-points; the new E2E
 * suite queries the axoview-id anchor exclusively.
 */
import { Locator, Page } from '@playwright/test';
import { byAxoviewId } from '../helpers/selectors';

export class NodeInfoTabPOM {
  constructor(readonly page: Page) {}

  linkPickerInput(): Locator {
    return byAxoviewId(this.page, 'node-info-tab-link-picker');
  }

  linkPickerListbox(): Locator {
    return byAxoviewId(this.page, 'node-info-tab-link-picker-listbox');
  }

  openLinkedDiagramButton(): Locator {
    return byAxoviewId(this.page, 'node-info-tab-open-linked');
  }

  /** Resolves when the Node Info tab's link-picker input is mounted — a
   *  reliable signal that the right sidebar is showing the selected item's
   *  Info tab AND that at least one linkable diagram exists. */
  async expectVisible(timeoutMs = 5_000) {
    await this.linkPickerInput().waitFor({ state: 'visible', timeout: timeoutMs });
  }

  /**
   * Opens the Autocomplete dropdown by focusing the input + pressing
   * ArrowDown. Returns the listbox locator so callers can interrogate option
   * counts or pick a specific name. MUI's Autocomplete renders the listbox as
   * a portaled <ul role="listbox"> child of body; the `data-axoview-id`
   * retrofit on Autocomplete's `slotProps.listbox` lands on that <ul> node.
   */
  async openPicker(): Promise<Locator> {
    const input = this.linkPickerInput();
    await input.click();
    // Down-arrow forces the listbox to open even when the input is empty —
    // a bare click sometimes auto-populates a single option but keeps the
    // dropdown collapsed if the input wasn't focused yet.
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
    await this.openLinkedDiagramButton().click();
  }
}
