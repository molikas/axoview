/**
 * REGRESSION — MQA #18: deleting the currently-open diagram leaked into a
 * stale-canvas + autosave-resurrect cycle. The fix exposes
 * `notifyDiagramDeletedFromTree(id)` on the lifecycle provider, and the two
 * delete entry points (FileExplorer.confirmDelete, DiagramManager.confirmDelete)
 * must invoke it *before* the storage delete so the in-flight autosave is
 * canceled before the storage entry disappears.
 *
 * Structural test — keeps the contract from silently regressing without
 * spinning up the entire app + storage stack.
 */

import * as fs from 'fs';
import * as path from 'path';

const APP_SRC = path.resolve(__dirname, '../../..');

function read(rel: string) {
  return fs.readFileSync(path.resolve(APP_SRC, rel), 'utf-8');
}

describe('Delete-current-diagram contract (MQA #18)', () => {
  it('DiagramLifecycleProvider exports notifyDiagramDeletedFromTree on the context value', () => {
    const src = read('providers/DiagramLifecycleProvider.tsx');
    expect(src).toContain('notifyDiagramDeletedFromTree:');
    expect(src).toMatch(/notifyDiagramDeletedFromTree\s*=\s*useCallback/);
  });

  it('notifyDiagramDeletedFromTree cancels autosave and clears the scratch buffer', () => {
    const src = read('providers/DiagramLifecycleProvider.tsx');
    // The block must cancel the pending autosave AND drop the buffered scratch
    // model for the deleted id — both are required to prevent recreation.
    const block = src.split('notifyDiagramDeletedFromTree')[2] ?? '';
    expect(block).toContain('autoSave.resetStatus');
    expect(block).toContain('scratchBufferRef.current.delete');
    expect(block).toContain('setCurrentDiagram(null)');
  });

  it('FileExplorer.confirmDelete calls notifyDiagramDeletedFromTree before storage delete', () => {
    const src = read('components/fileExplorer/FileExplorer.tsx');
    const notifyIdx = src.indexOf('notifyDiagramDeletedFromTree(target.id)');
    const deleteIdx = src.indexOf('tree.hardDeleteDiagram(target.id)');
    expect(notifyIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(notifyIdx).toBeLessThan(deleteIdx);
  });

  it('DiagramManager.confirmDelete calls notifyDiagramDeletedFromTree before storage.deleteDiagram', () => {
    const src = read('components/DiagramManager.tsx');
    const notifyIdx = src.indexOf('notifyDiagramDeletedFromTree(id)');
    const deleteIdx = src.indexOf('storage.deleteDiagram(id)');
    expect(notifyIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeGreaterThan(-1);
    expect(notifyIdx).toBeLessThan(deleteIdx);
  });
});
