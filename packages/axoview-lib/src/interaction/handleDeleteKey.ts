import type { State, ItemReference } from 'src/types';

// Delete/Backspace handling (deleteItemControlsTarget + handleDeleteOrBackspace)
// is extracted here — like handleEscapeKey.ts — so the per-type delete dispatch
// is unit-testable in isolation (the full useInteractionManager hook needs a
// provider stack to mount). L-1 regression: the single-item path had no LABEL
// branch, so a selected floating Label (ADR 0031) survived Delete.

// Minimal dependency surface these handlers need — a structural subset of
// useInteractionManager's KeydownDeps, kept here so this module stays runtime
// dependency-free (mirrors handleEscapeKey.ts's EscapeDeps).
export interface DeleteKeyDeps {
  deleteSelectedItems: (refs: ItemReference[]) => void;
  deleteViewItem: (id: string) => void;
  deleteConnector: (id: string) => void;
  deleteTextBox: (id: string) => void;
  deleteRectangle: (id: string) => void;
  deleteLabel: (id: string) => void;
}

// True when the keystroke target is a text-editing surface — typing there must
// not be hijacked by canvas shortcuts.
export const isEditableTarget = (target: HTMLElement): boolean =>
  target.tagName === 'INPUT' ||
  target.tagName === 'TEXTAREA' ||
  target.contentEditable === 'true' ||
  !!target.closest('.ql-editor');

// Delete the single item currently in itemControls, dispatched by its type.
export const deleteItemControlsTarget = (
  uiState: State['uiState'],
  deps: DeleteKeyDeps
) => {
  const ctrl = uiState.itemControls;
  if (!ctrl) return;
  if (ctrl.type === 'ITEM') {
    deps.deleteViewItem(ctrl.id);
  } else if (ctrl.type === 'CONNECTOR') {
    deps.deleteConnector(ctrl.id);
  } else if (ctrl.type === 'TEXTBOX') {
    deps.deleteTextBox(ctrl.id);
  } else if (ctrl.type === 'RECTANGLE') {
    deps.deleteRectangle(ctrl.id);
  } else if (ctrl.type === 'LABEL') {
    // Floating Label (ADR 0031): the single-item Delete path had no LABEL
    // branch, so select-then-Delete was a silent no-op — the label merely
    // deselected. deleteLabel exists on the scene API (deleteSelectedItems
    // uses it for the multi path); route the single delete through it too.
    deps.deleteLabel(ctrl.id);
  }
};

// Delete/Backspace: lasso selection → multi-selection → single itemControls.
// Handled before the text-field guard so it always fires when a canvas
// selection exists (matches how diagram tools like Figma behave), but the
// multi-selection and single-item branches still respect text-field focus so
// editing input/panel text isn't hijacked. Returns true when consumed.
export const handleDeleteOrBackspace = (
  e: KeyboardEvent,
  uiState: State['uiState'],
  deps: DeleteKeyDeps
): boolean => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return false;
  const mode = uiState.mode;

  if (
    (mode.type === 'LASSO' || mode.type === 'FREEHAND_LASSO') &&
    mode.selection?.items?.length
  ) {
    e.preventDefault();
    deps.deleteSelectedItems(mode.selection.items);
    uiState.actions.setMode({
      type: 'CURSOR',
      showCursor: true,
      mousedownItem: null
    });
    uiState.actions.clearSelection();
    return true;
  }

  // Multi-selection (CURSOR mode): delete every selected item.
  if (
    uiState.selectedIds.length > 1 &&
    !isEditableTarget(e.target as HTMLElement)
  ) {
    e.preventDefault();
    deps.deleteSelectedItems(uiState.selectedIds);
    uiState.actions.clearSelection();
    return true;
  }

  // Single-item (properties panel) delete.
  if (
    uiState.itemControls &&
    uiState.itemControls.type !== 'ADD_ITEM' &&
    !isEditableTarget(e.target as HTMLElement)
  ) {
    e.preventDefault();
    deleteItemControlsTarget(uiState, deps);
    uiState.actions.setItemControls(null);
    return true;
  }

  return false;
};
