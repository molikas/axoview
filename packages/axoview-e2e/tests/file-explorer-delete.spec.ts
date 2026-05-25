/**
 * file-explorer-delete.spec.ts — v1.1 Finding #8 (KR3, delete sub-row).
 *
 * Closes the "delete diagram with confirmation" sub-row of Finding #8
 * in docs/tactical/v1.1-test-coverage.md. The flow:
 *
 *   1. Right-click a diagram row -> FileTreeNode's onContextMenu fires
 *      handleContextMenu (FileExplorer.tsx) which opens the MUI Menu
 *      anchored at the click pixel and renders ContextMenuItems.
 *   2. Click the Delete MenuItem -> onDelete -> handleDeleteDiagram
 *      sets deleteConfirm state -> Dialog opens.
 *   3. Click the Delete confirm Button -> confirmDelete fires
 *      tree.deleteDiagram and the row leaves the tree.
 *
 * Lazy data-axoview-id retrofits (app-side, no lib rebuild):
 *   - file-explorer-context-menu-delete (ContextMenuItems.tsx Delete
 *     MenuItem)
 *   - file-explorer-delete-confirm-dialog (FileExplorer.tsx Dialog
 *     PaperProps)
 *   - file-explorer-delete-confirm (Delete confirm Button)
 *   - file-explorer-delete-cancel (Cancel Button — pinned alongside so a
 *     future cancel-flow spec doesn't need a second retrofit pass)
 *
 * Cancel-flow assertion (the dialog dismisses without deleting) is left
 * to a future session — the user-named sub-row is "delete with
 * confirmation" and the happy path is sufficient for KR3.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { FileExplorerPOM } from '../pom/FileExplorerPOM';
import { byAxoviewId } from '../helpers/selectors';

test.describe('File explorer — delete with confirmation (Finding #8)', () => {
  test('right-click + Delete + confirm removes the diagram row', async ({
    page,
    app
  }) => {
    void app;
    const explorer = new FileExplorerPOM(page);
    await explorer.open();

    // canvasReadyTest's empty-create produces a diagram named "Untitled".
    // Read the actual name in case future fixture changes rename it.
    const firstRow = explorer.panelRoot().first();
    await firstRow.waitFor({ state: 'visible', timeout: 5_000 });
    const diagramName = await firstRow.getAttribute('data-diagram-name');
    expect(diagramName).toBeTruthy();
    const row = explorer.getRowByName(diagramName!, 'diagram');
    await expect(row).toBeVisible();

    // 1. Right-click the row to open the context menu. Playwright's
    //    `click({button:'right'})` dispatches a contextmenu event which
    //    is what FileTreeNode's onContextMenu listens for.
    await row.click({ button: 'right' });

    // 2. Click the Delete item -> opens confirmation dialog.
    const deleteMenuItem = byAxoviewId(page, 'file-explorer-context-menu-delete');
    await deleteMenuItem.waitFor({ state: 'visible', timeout: 3_000 });
    await deleteMenuItem.click();

    const confirmDialog = byAxoviewId(
      page,
      'file-explorer-delete-confirm-dialog'
    );
    await confirmDialog.waitFor({ state: 'visible', timeout: 3_000 });

    // 3. Confirm — the row leaves the tree.
    await byAxoviewId(page, 'file-explorer-delete-confirm').click();

    await expect(row).toBeHidden({ timeout: 5_000 });
    // Dialog auto-closes when confirmDelete sets deleteConfirm = null.
    await expect(confirmDialog).toBeHidden();
  });
});
