/**
 * rename.spec.ts — Tier 1 J4.
 *
 * J4 (per docs/manual-test-baseline.md): open existing diagram → rename via
 * F2 in file explorer → save → reopen → name persists.
 *
 * Historical context (MQA #14, fixed 2026-05-15): the rename used to only
 * propagate after the user explicitly re-opened the renamed diagram. The
 * post-fix behaviour is that the rename persists immediately and survives a
 * reload without any open step. The "renames + reload without re-opening"
 * sub-test below asserts that contract.
 *
 * Surface walkthrough:
 *   - Local mode boots with the file explorer panel closed
 *     (DiagramLifecycleProvider only auto-opens for serverStorageAvailable).
 *     FileExplorerPOM.open() clicks the LeftDock toggle to bring the panel up.
 *   - The default diagram name from handleCreateBlankDiagram is `Untitled`
 *     (or `Untitled-1`, etc., via sequentialName). bootBlankDiagram clears
 *     storage first, so the seed is always the bare `Untitled`.
 *   - F2 routes through FileExplorer.tsx's outer treeContainer Box keydown
 *     listener, which calls `treeRef.current?.edit(selectedNode.id)`. The
 *     selectedNode is set by arborist's `node.handleClick` on the FileTreeRow
 *     wrapper — a single row click both selects the node and arms a 300ms
 *     open timer in the inner Box (which `handleOpenDiagram` short-circuits
 *     when the diagram is already current, so no race).
 *   - Inline edit: FileTreeNode mounts an autoFocused <input> when
 *     `node.isEditing` flips. The input.onKeyDown stops propagation so F2's
 *     keydown can't trigger another edit cycle on the same row.
 *
 * Lazy data-axoview-id retrofits this spec:
 *   - LIB: `dock-file-explorer-toggle` (LeftDock.tsx)
 *   - APP: `file-explorer-row` + data-diagram-name/-type (FileTreeNode.tsx)
 *   - APP: `file-explorer-rename-input` (FileTreeNode.tsx <input>)
 *
 * Lib rebuild cycles this spec: 1 (only `dock-file-explorer-toggle` is lib-side).
 */
import { appTest as test, expect } from '../fixtures/app.fixture';
import { FileExplorerPOM } from '../pom/FileExplorerPOM';
import { byAxoviewId, byLibTestId } from '../helpers/selectors';
import { waitForDebugBridge } from '../helpers/store';

const LOCAL_STORAGE_KEYS = [
  'axoview-diagrams',
  'axoview-last-opened',
  'axoview-last-opened-data',
  'axoview-explorer-initialized',
  'axoview-explorer-open'
];

const ONBOARDING_DISMISS_FLAGS: Array<[string, string]> = [
  ['axoview-lazy-loading-welcome-dismissed', 'true'],
  ['axoview-show-drag-hint', 'false']
];

const ORIGINAL_NAME = 'Untitled';

async function pinOnboardingDismissed(page: import('@playwright/test').Page) {
  await page.addInitScript((flags: Array<[string, string]>) => {
    try {
      for (const [k, v] of flags) localStorage.setItem(k, v);
    } catch {
      /* localStorage may not be available pre-navigation */
    }
  }, ONBOARDING_DISMISS_FLAGS);
}

async function clearDiagramStorage(page: import('@playwright/test').Page) {
  await page.evaluate((keys: string[]) => {
    for (const k of keys) localStorage.removeItem(k);
  }, LOCAL_STORAGE_KEYS);
}

async function bootBlankDiagram(page: import('@playwright/test').Page) {
  await clearDiagramStorage(page);
  await page.reload();
  const createBtn = byAxoviewId(page, 'screen-empty-create');
  await createBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await createBtn.click();
  await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
  await waitForDebugBridge(page);
}

test.describe('File explorer rename — J4 (F2 + persistence)', () => {
  test.beforeEach(async ({ page, app }) => {
    void app;
    await pinOnboardingDismissed(page);
    await bootBlankDiagram(page);
  });

  test('J4: F2 renames the diagram and the new name persists across reload', async ({ page }) => {
    const newName = `Renamed-${Date.now()}`;
    const explorer = new FileExplorerPOM(page);

    // 1. Open the explorer (closed-by-default in Local mode) and verify the
    //    seeded diagram surfaces as 'Untitled'.
    await explorer.open();
    await expect(explorer.getRowByName(ORIGINAL_NAME)).toBeVisible();

    // 2. Drive the rename.
    await explorer.renameDiagram(ORIGINAL_NAME, newName);

    // 3. Row updates in-place — react-arborist re-renders the visible row
    //    with the new name as soon as optimisticRename lands on the tree
    //    model. No save click needed: local-mode rename writes through the
    //    storage adapter and the lifecycle provider's autosave on the
    //    NEXT model touch — but for the explorer row label the optimistic
    //    tree-model update is enough.
    await expect(explorer.getRowByName(newName)).toBeVisible({ timeout: 5_000 });
    await expect(explorer.getRowByName(ORIGINAL_NAME)).toHaveCount(0);

    // 4. MQA #14 regression assertion: reload WITHOUT explicitly re-opening
    //    the renamed diagram, then verify the renamed row is still present.
    //    Pre-fix behaviour rolled the name back because the rename was only
    //    flushed via the open-on-click path; post-fix it persists.
    await page.reload();
    await byLibTestId(page, 'axoview-canvas').waitFor({ state: 'visible', timeout: 10_000 });
    await waitForDebugBridge(page);
    await explorer.open();
    await expect(explorer.getRowByName(newName)).toBeVisible({ timeout: 5_000 });
    await expect(explorer.getRowByName(ORIGINAL_NAME)).toHaveCount(0);
  });

  test('J4: Escape during inline rename preserves the original name', async ({ page }) => {
    const explorer = new FileExplorerPOM(page);
    await explorer.open();
    await expect(explorer.getRowByName(ORIGINAL_NAME)).toBeVisible();

    // Select + F2 to enter inline edit mode.
    await explorer.selectRow(ORIGINAL_NAME);
    await explorer.pressF2();

    const input = explorer.renameInput();
    await input.waitFor({ state: 'visible', timeout: 3_000 });

    // Type a candidate name and cancel via Escape. FileTreeNode.tsx routes
    // Escape on a non-`__pending__` row to `node.reset()` — the input
    // unmounts without invoking onRename.
    await input.fill('Discarded');
    await input.press('Escape');

    // The original row is still visible; the discarded name never landed.
    await expect(explorer.getRowByName(ORIGINAL_NAME)).toBeVisible({ timeout: 3_000 });
    await expect(explorer.getRowByName('Discarded')).toHaveCount(0);
  });
});
