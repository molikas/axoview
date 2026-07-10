import {
  handleDeleteOrBackspace,
  deleteItemControlsTarget,
  isEditableTarget,
  DeleteKeyDeps
} from '../handleDeleteKey';
import type { State } from 'src/types';

// L-1 regression (UX sweep 2026-07-10, Maya): a selected floating Label
// (ADR 0031) could not be deleted via select + Delete — the single-item delete
// dispatcher had no LABEL branch, so the key was a silent no-op. These tests pin
// the per-type dispatch (every canvas type routes to its delete action) and the
// single-Label Delete path end-to-end through handleDeleteOrBackspace.

const makeDeps = (): jest.Mocked<DeleteKeyDeps> => ({
  deleteSelectedItems: jest.fn(),
  deleteViewItem: jest.fn(),
  deleteConnector: jest.fn(),
  deleteTextBox: jest.fn(),
  deleteRectangle: jest.fn(),
  deleteLabel: jest.fn()
});

const makeUiState = (overrides: Record<string, unknown> = {}) =>
  ({
    mode: { type: 'CURSOR', showCursor: true, mousedownItem: null },
    selectedIds: [],
    itemControls: null,
    actions: {
      setMode: jest.fn(),
      clearSelection: jest.fn(),
      setItemControls: jest.fn()
    },
    ...overrides
  }) as unknown as State['uiState'];

const keyEvent = (key: string, target?: HTMLElement): KeyboardEvent =>
  ({
    key,
    target: target ?? document.createElement('div'),
    preventDefault: jest.fn()
  }) as unknown as KeyboardEvent;

describe('deleteItemControlsTarget — per-type dispatch', () => {
  it('routes a LABEL to deleteLabel (L-1: was an unhandled no-op)', () => {
    const deps = makeDeps();
    deleteItemControlsTarget(
      makeUiState({ itemControls: { type: 'LABEL', id: 'l1' } }),
      deps
    );
    expect(deps.deleteLabel).toHaveBeenCalledWith('l1');
    expect(deps.deleteViewItem).not.toHaveBeenCalled();
    expect(deps.deleteConnector).not.toHaveBeenCalled();
    expect(deps.deleteTextBox).not.toHaveBeenCalled();
    expect(deps.deleteRectangle).not.toHaveBeenCalled();
  });

  it.each([
    ['ITEM', 'deleteViewItem'],
    ['CONNECTOR', 'deleteConnector'],
    ['TEXTBOX', 'deleteTextBox'],
    ['RECTANGLE', 'deleteRectangle'],
    ['LABEL', 'deleteLabel']
  ] as const)('%s → %s', (type, method) => {
    const deps = makeDeps();
    deleteItemControlsTarget(
      makeUiState({ itemControls: { type, id: 'x' } }),
      deps
    );
    expect(deps[method]).toHaveBeenCalledWith('x');
  });

  it('is a no-op when nothing is selected', () => {
    const deps = makeDeps();
    deleteItemControlsTarget(makeUiState({ itemControls: null }), deps);
    Object.values(deps).forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});

describe('handleDeleteOrBackspace — single floating Label', () => {
  it('Delete on a selected Label calls deleteLabel + clears the panel', () => {
    const deps = makeDeps();
    const uiState = makeUiState({
      selectedIds: [{ type: 'LABEL', id: 'l1' }],
      itemControls: { type: 'LABEL', id: 'l1' }
    });
    const consumed = handleDeleteOrBackspace(keyEvent('Delete'), uiState, deps);
    expect(consumed).toBe(true);
    expect(deps.deleteLabel).toHaveBeenCalledWith('l1');
    expect(uiState.actions.setItemControls).toHaveBeenCalledWith(null);
  });

  it('Backspace behaves identically', () => {
    const deps = makeDeps();
    const uiState = makeUiState({
      selectedIds: [{ type: 'LABEL', id: 'l1' }],
      itemControls: { type: 'LABEL', id: 'l1' }
    });
    handleDeleteOrBackspace(keyEvent('Backspace'), uiState, deps);
    expect(deps.deleteLabel).toHaveBeenCalledWith('l1');
  });

  it('does NOT delete while the Label is being inline-edited (contentEditable focus)', () => {
    const deps = makeDeps();
    const editing = document.createElement('div');
    editing.contentEditable = 'true';
    const uiState = makeUiState({
      selectedIds: [{ type: 'LABEL', id: 'l1' }],
      itemControls: { type: 'LABEL', id: 'l1' }
    });
    const consumed = handleDeleteOrBackspace(
      keyEvent('Delete', editing),
      uiState,
      deps
    );
    expect(consumed).toBe(false);
    expect(deps.deleteLabel).not.toHaveBeenCalled();
  });

  it('ignores unrelated keys', () => {
    const deps = makeDeps();
    const uiState = makeUiState({
      selectedIds: [{ type: 'LABEL', id: 'l1' }],
      itemControls: { type: 'LABEL', id: 'l1' }
    });
    expect(handleDeleteOrBackspace(keyEvent('a'), uiState, deps)).toBe(false);
    expect(deps.deleteLabel).not.toHaveBeenCalled();
  });
});

describe('isEditableTarget', () => {
  it('is true for input / textarea / contentEditable / quill', () => {
    const input = document.createElement('input');
    const textarea = document.createElement('textarea');
    const ce = document.createElement('div');
    ce.contentEditable = 'true';
    const ql = document.createElement('div');
    ql.className = 'ql-editor';
    const insideQl = document.createElement('span');
    ql.appendChild(insideQl);
    expect(isEditableTarget(input)).toBe(true);
    expect(isEditableTarget(textarea)).toBe(true);
    expect(isEditableTarget(ce)).toBe(true);
    expect(isEditableTarget(insideQl)).toBe(true);
  });

  it('is false for a plain element', () => {
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
  });
});
