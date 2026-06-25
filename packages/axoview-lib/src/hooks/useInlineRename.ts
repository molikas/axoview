import { useCallback, useEffect, useRef } from 'react';

interface Params {
  /** True while the contentEditable is mounted / editing. */
  active: boolean;
  /** Persist the edited value (called on left-click-away and Enter). */
  commit: (value: string) => void;
  /** Discard the edit (called on right-click-away and Escape). */
  cancel: () => void;
  /** When true, plain Enter inserts a newline and only Enter commits via blur
   *  (Shift+Enter stays a newline). Used by the multi-line text box. */
  multiline?: boolean;
}

/**
 * Shared click-away contract for the canvas inline-rename editors (node label,
 * text box, connector name). Left-click-away and Enter PERSIST the edit;
 * right-click-away and Escape CANCEL it.
 *
 * The bug this fixes: left-clicking the canvas deselects the element, which
 * unmounts the contentEditable BEFORE its `onBlur` commit can run, so the edit
 * was silently lost and read as a cancel (only Enter — which blurs explicitly
 * first — persisted). A capture-phase `pointerdown` listener runs ahead of the
 * canvas's own deselect handler and blurs the editor synchronously, so the
 * commit lands before the unmount. The pointer button decides commit vs cancel
 * (right button → cancel), since a bare `blur` can't tell them apart.
 *
 * Contract documented in ADR 0022 §4 (inline-rename commit semantics).
 */
export const useInlineRename = ({
  active,
  commit,
  cancel,
  multiline
}: Params) => {
  const elRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef(false);

  // Hold the latest callbacks so the capture listener doesn't re-subscribe on
  // every render (commit/cancel close over changing model state).
  const commitRef = useRef(commit);
  const cancelFnRef = useRef(cancel);
  commitRef.current = commit;
  cancelFnRef.current = cancel;

  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = elRef.current;
      if (!el || el.contains(e.target as Node)) return;
      // Right-click away cancels; any other button commits.
      if (e.button === 2) cancelRef.current = true;
      // Synchronously blur so the commit/cancel below runs before the canvas's
      // own pointerdown handler deselects and unmounts this editor.
      el.blur();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [active]);

  // Callback ref: focus + select-all on mount (matches prior per-editor logic).
  const setRef = useCallback((el: HTMLElement | null) => {
    elRef.current = el;
    if (el && document.activeElement !== el) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, []);

  const onBlur = useCallback((e: React.FocusEvent<HTMLElement>) => {
    if (cancelRef.current) {
      cancelRef.current = false;
      cancelFnRef.current();
    } else {
      commitRef.current(e.currentTarget.innerText);
    }
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter' && (!multiline || !e.shiftKey)) {
        e.preventDefault();
        (e.currentTarget as HTMLElement).blur(); // → commit
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelRef.current = true;
        (e.currentTarget as HTMLElement).blur(); // → cancel
      }
    },
    [multiline]
  );

  return { setRef, onBlur, onKeyDown };
};
