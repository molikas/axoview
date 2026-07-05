import type { Quill } from 'react-quill-new';

// Strip ⇄ inline-editor bridge (ADR 0034 §2). While a text box is being edited
// on canvas, the mounted editor registers its live Quill instance here so the
// strip's text cluster (B/I/U/S, lists, link) can drive the caret/range via
// `quill.format()` and read the format under the selection. A module singleton
// (not a store slice): the instance is non-serializable and at most one editor
// exists at a time. Re-render of the strip is driven by the
// `uiState.editingTextBoxId` slice; the subscription below only covers the
// registration racing the strip's effect.

export interface TextBoxEditorRange {
  index: number;
  length: number;
}

export interface TextBoxEditorHandle {
  id: string;
  quill: Quill;
  /** Last non-null selection — survives focus moving into a strip popover
   *  (e.g. the Link URL field), where `quill.getSelection()` returns null. */
  lastRange: TextBoxEditorRange | null;
  /** Formatting applied from the strip counts as a change for the editor's
   *  commit-only-when-changed guard (Quill reports it as source 'api'). */
  markChanged: () => void;
}

let current: TextBoxEditorHandle | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const registerTextBoxEditor = (
  id: string,
  quill: Quill,
  markChanged: () => void
) => {
  current = { id, quill, lastRange: null, markChanged };
  emit();
};

/** The range strip controls should format: the live selection while the
 *  editor owns focus, else the sticky lastRange (focus is in a strip
 *  popover). Never the raw getSelection() when unfocused — see the spurious
 *  collapsed-selection note in setTextBoxEditorRange. */
export const getEffectiveEditorRange = (
  handle: TextBoxEditorHandle
): TextBoxEditorRange | null => {
  if (handle.quill.hasFocus()) {
    return handle.quill.getSelection() ?? handle.lastRange;
  }
  return handle.lastRange;
};

export const setTextBoxEditorRange = (
  id: string,
  range: TextBoxEditorRange | null
) => {
  // Record only while the editor owns focus. When focus moves into a strip
  // popover, the blur emits null (already ignored) — but Chromium can follow
  // it with a SPURIOUS collapsed {0,0} selection-change as the DOM selection
  // collapses onto the root, which would clobber the very range the popover
  // is about to format (observed 2026-07-04 with the Ctrl+K Link flow).
  if (current?.id === id && range && current.quill.hasFocus()) {
    current.lastRange = range;
  }
};

export const unregisterTextBoxEditor = (id: string, quill: Quill) => {
  // Guard on the instance so a promotion remount's stale cleanup can't drop a
  // successor registration.
  if (current?.id === id && current.quill === quill) {
    current = null;
    emit();
  }
};

export const getTextBoxEditor = (): TextBoxEditorHandle | null => current;

export const subscribeTextBoxEditor = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
