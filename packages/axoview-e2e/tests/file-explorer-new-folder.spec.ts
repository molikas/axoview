/**
 * file-explorer-new-folder.spec.ts — v1.1 Track 5g (KR3, partial).
 *
 * Pins the "create folder" sub-row of 5g. The flow:
 *
 *   1. Open the file explorer (LeftDock toggle — closed by default in
 *      Local mode per DiagramLifecycleProvider's auto-open gate on
 *      serverStorageAvailable).
 *   2. Click the file-explorer-new-folder toolbar button. The button
 *      lives in a hover/focus-revealed (opacity 0) cluster, so the
 *      click is forced past actionability — the click handler fires
 *      regardless of pixel visibility.
 *   3. handleNewFolder (FileExplorer.tsx:280) sets pendingNew, which
 *      renders an inline FileTreeNode in edit mode with the rename
 *      input mounted (data-axoview-id="file-explorer-rename-input").
 *   4. Type a name, press Enter — tree.createFolder runs and the new
 *      folder row appears with data-diagram-type="folder".
 *
 * Lazy data-axoview-id retrofits (app-side, no lib rebuild):
 *   - file-explorer-new-folder (FileTreeToolbar.tsx)
 *
 * Deferred 5g sub-rows (filed as Finding #8 in v1.1-test-coverage.md):
 *   - drag diagram into folder — react-arborist drag-drop gesture
 *     across virtualised tree rows; needs deterministic row-position
 *     coordinates and dragstart/dragover/drop sequencing.
 *   - delete diagram with confirmation — needs the right-click
 *     ContextMenuItems anchor retrofits (Delete MenuItem) AND the
 *     delete-confirmation Dialog anchor.
 *   - multi-select tree ops — react-arborist's multi-select API
 *     (Shift/Ctrl+click on rows) needs probing for the right hooks.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { FileExplorerPOM } from '../pom/FileExplorerPOM';
import { byAxoviewId } from '../helpers/selectors';

test.describe('File explorer — new folder (Track 5g partial)', () => {
  test('5g: clicking new-folder + typing a name + Enter creates a folder row', async ({ page, app }) => {
    void app;
    const explorer = new FileExplorerPOM(page);
    await explorer.open();

    // The toolbar icon cluster has opacity:0 by default; force the
    // click past actionability since the handler fires regardless of
    // pixel visibility. The reveal-on-hover behaviour is a chrome
    // affordance, not a gate on the click target.
    await byAxoviewId(page, 'file-explorer-new-folder').click({ force: true });

    // The inline rename input mounts inside the pending FileTreeNode.
    const input = explorer.renameInput();
    await input.waitFor({ state: 'visible', timeout: 5_000 });
    const folderName = `TestFolder-${Date.now()}`;
    await input.fill(folderName);
    await input.press('Enter');

    // The new row appears with data-diagram-type="folder".
    await expect(explorer.getRowByName(folderName, 'folder')).toBeVisible({
      timeout: 5_000
    });
  });
});
