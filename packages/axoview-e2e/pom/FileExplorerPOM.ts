/**
 * FileExplorerPOM — left-edge file tree panel (packages/axoview-app/src/
 * components/fileExplorer/FileExplorer.tsx + FileTreeNode.tsx).
 *
 * Surface walkthrough:
 *   - Toggled via the LeftDock file-explorer IconButton — Local-mode boots
 *     with the panel closed (DiagramLifecycleProvider only auto-opens it for
 *     `serverStorageAvailable`), so every spec that drives the tree must
 *     `open()` first.
 *   - Rows are rendered by FileTreeNode inside react-arborist's virtualised
 *     <Tree>. The label Box anchors `data-axoview-id="file-explorer-row"`
 *     plus `data-diagram-name` and `data-diagram-type` so a row can be
 *     selected by its observable name.
 *   - Rename uses F2 against the outer container's keydown listener (see
 *     FileExplorer.tsx — `treeContainerRef.current?.edit(selectedNode.id)`).
 *     The inline <input> mounts inside the row when `node.isEditing` flips.
 *
 * Lazy data-axoview-id retrofits — Session 5:
 *   - `dock-file-explorer-toggle`   (lib, LeftDock.tsx)        — open()
 *   - `file-explorer-row`           (app, FileTreeNode.tsx)    — getRowByName
 *   - `file-explorer-rename-input`  (app, FileTreeNode.tsx)    — rename input
 *
 * MQA #14 (rename only propagated after explicit open) is regression-asserted
 * by rename.spec.ts — the canonical rename flow drives this POM and then
 * reloads without re-opening the diagram.
 */
import { Locator, Page } from '@playwright/test';
import { byAxoviewId } from '../helpers/selectors';

export class FileExplorerPOM {
  constructor(readonly page: Page) {}

  toggleButton(): Locator {
    return byAxoviewId(this.page, 'dock-file-explorer-toggle');
  }

  panelRoot(): Locator {
    // The FileExplorer panel mounts as a sibling of the canvas inside the
    // axoview-container <div>. It has no data-axoview-id of its own — the
    // visibility of any row is the only observable a spec needs.
    return this.page.locator('[data-axoview-id="file-explorer-row"]');
  }

  /**
   * Returns the row locator for a diagram by its visible name. Type filter
   * keeps a folder named identically to a diagram from matching by accident
   * (rare in practice, but the rename test creates the contract).
   */
  getRowByName(name: string, type: 'diagram' | 'folder' = 'diagram'): Locator {
    return this.page.locator(
      `[data-axoview-id="file-explorer-row"][data-diagram-name="${name}"][data-diagram-type="${type}"]`
    );
  }

  renameInput(): Locator {
    return byAxoviewId(this.page, 'file-explorer-rename-input');
  }

  /**
   * Opens the file-explorer panel if it isn't already open. Idempotent — a
   * second call when the panel is open is a no-op (we read row visibility
   * directly rather than the toggle's aria-pressed state).
   */
  async open() {
    // The Untitled row (or whatever else lives at root) becomes locatable as
    // soon as the panel mounts. If any row is already visible, no toggle is
    // needed. The 250ms first-paint nudge mirrors how the explorer ramps up
    // its react-window virtualisation.
    const anyRow = this.panelRoot().first();
    if (await anyRow.isVisible().catch(() => false)) return;
    await this.toggleButton().click();
    await anyRow.waitFor({ state: 'visible', timeout: 5_000 });
  }

  /**
   * Clicks a diagram row to select it without opening (the row's onClick has
   * a 300ms timer that fires onOpen; F2 only needs the arborist selection to
   * land, which is synchronous via the outer FileTreeRow's `node.handleClick`).
   * Caller is expected to follow up with `pressF2()` within the open-timer
   * window — handleOpenDiagram short-circuits when the same diagram is
   * already current, so a late-firing open is benign in steady state too.
   */
  async selectRow(name: string, type: 'diagram' | 'folder' = 'diagram') {
    const row = this.getRowByName(name, type);
    await row.waitFor({ state: 'visible', timeout: 5_000 });
    await row.click();
  }

  /**
   * Presses F2 on the page. The outer treeContainer Box's keydown handler
   * dispatches `treeRef.edit(selectedNode.id)` only when a row is selected,
   * so callers must `selectRow()` first.
   *
   * F2 also doubles as the in-canvas inline-rename trigger when a node is
   * selected on the canvas (see useInteractionManager.ts — the `cameFromRenderer`
   * guard ensures the explorer's F2 wins when focus is in the tree subtree).
   * In the rename spec the canvas selection is empty post-`bootBlankDiagram`,
   * so there's no contention.
   */
  async pressF2() {
    await this.page.keyboard.press('F2');
  }

  /**
   * End-to-end inline-rename: selects the row, presses F2, types `newName`,
   * presses Enter. The row's <input> autofocuses on mount and selects its
   * default value (FileTreeNode.tsx `onFocus={(e) => e.currentTarget.select()`),
   * so the type+Enter sequence replaces the existing name.
   */
  async renameDiagram(oldName: string, newName: string) {
    await this.selectRow(oldName);
    await this.pressF2();
    const input = this.renameInput();
    await input.waitFor({ state: 'visible', timeout: 3_000 });
    await input.fill(newName);
    await input.press('Enter');
  }
}
