import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import ReactQuill from 'react-quill-new';
import { formats } from 'src/components/RichTextEditor/RichTextEditor';
import { sanitizeHtml } from 'src/utils/sanitizeHtml';
import { ensureHtmlContent } from 'src/utils/richTextTransform';
import { htmlToPlainText } from 'src/utils/htmlToPlainText';
import { buildListAutofillBinding } from 'src/utils/quillListAutofill';
import { CANVAS_RICHTEXT_LIST_INDENT_EM } from 'src/config';
import {
  registerTextBoxEditor,
  setTextBoxEditorRange,
  unregisterTextBoxEditor
} from './textBoxEditorBridge';

interface Props {
  textBoxId: string;
  content: string | undefined;
  /** Base typography from useTextBoxProps — the editor renders in place with
   *  the exact canvas styles (fontSize/family/color + richTextStyles). */
  fontProps: Record<string, unknown>;
  /** Persist the edited HTML ('' when the box was emptied). */
  onCommit: (html: string) => void;
  /** Close without persisting (Escape / right-click-away). */
  onCancel: () => void;
}

// The on-canvas rich-text editor (ADR 0034 §1): a toolbar-less Quill mounted in
// place inside the projected text-box container, formatted from the strip via
// the textBoxEditorBridge. Commit semantics extend ADR 0022 §4 — left-click-away
// commits, right-click-away and Escape cancel — with one deliberate divergence:
// Enter inserts a newline (multi-paragraph element; lists need Enter), so
// click-away is the only commit gesture. Clicks inside the strip
// ([data-axoview-strip]) or any MUI portal overlay (the strip's own popovers)
// keep the session alive.
//
// Commit is a no-op unless something actually changed (user typing, or a strip
// format routed through the bridge's markChanged) — never compare plain text
// against stored HTML; that comparison is what made the old plain-text editor
// destroy formatting on a zero-keystroke click-away.
const QUILL_MODULES = {
  toolbar: false,
  // Markdown list autofill ("- "/"* "/"1. " → list) — the shared binding in
  // quillListAutofill.ts; retires MQA #12 (rationale + the undo-restores-
  // literal contract live there). Module scope is safe: this file already
  // imports ReactQuill (DOM-only) at module scope.
  keyboard: {
    bindings: {
      'list autofill': buildListAutofillBinding(ReactQuill.Quill)
    }
  }
};

export const TextBoxInlineEditor = ({
  textBoxId,
  content,
  fontProps,
  onCommit,
  onCancel
}: Props) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const quillRef = useRef<ReactQuill | null>(null);
  const changedRef = useRef(false);
  const finishedRef = useRef(false);

  // Seed once per session — sanitized write-side (the editor is an HTML
  // source, ADR 0029), plain-text legacy content escaped so a literal leading
  // '<' can't be misparsed (catalog I-23).
  const initialHtml = useMemo(
    () => {
      const html = ensureHtmlContent(content);
      return html ? sanitizeHtml(html) : '';
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once; the editor owns the value while mounted
    []
  );

  const finish = useCallback(
    (kind: 'commit' | 'cancel') => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      if (kind === 'commit' && changedRef.current) {
        const quill = quillRef.current?.getEditor();
        const html = quill ? sanitizeHtml(quill.getSemanticHTML()) : '';
        // An emptied box round-trips as '' (not Quill's empty-paragraph shell).
        onCommit(htmlToPlainText(html).trim() ? html : '');
      } else {
        onCancel();
      }
    },
    [onCommit, onCancel]
  );
  const finishRef = useRef(finish);
  finishRef.current = finish;

  // Click-away contract (capture phase, ahead of the canvas's own pointerdown
  // deselect — same trick as useInlineRename). Bound to BOTH pointerdown and
  // mousedown: real input fires pointerdown first (mousedown then no-ops via
  // finishedRef); the e2e suite's synthetic canvas events are mouse-only.
  useEffect(() => {
    const onPressAway = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const rootEl = rootRef.current;
      if (!target || !rootEl || rootEl.contains(target)) return;
      // The strip and its popovers (MUI portals) drive the live selection —
      // pressing them must not end the session (ADR 0034 §1).
      if (
        target.closest?.('[data-axoview-strip]') ||
        target.closest?.('.MuiPopover-root, .MuiPopper-root, .MuiModal-root')
      ) {
        return;
      }
      finishRef.current(e.button === 2 ? 'cancel' : 'commit');
    };
    window.addEventListener('pointerdown', onPressAway, true);
    window.addEventListener('mousedown', onPressAway, true);
    return () => {
      window.removeEventListener('pointerdown', onPressAway, true);
      window.removeEventListener('mousedown', onPressAway, true);
    };
  }, []);

  // Mount: focus + select-all (type-to-replace, matching the F2 rename
  // convention), then register with the strip bridge.
  useEffect(() => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return undefined;
    registerTextBoxEditor(textBoxId, quill, () => {
      changedRef.current = true;
    });
    quill.focus();
    quill.setSelection(0, quill.getLength(), 'silent');
    const onSelectionChange = (range: { index: number; length: number } | null) => {
      setTextBoxEditorRange(textBoxId, range);
    };
    const onTextChange = (
      _delta: unknown,
      _old: unknown,
      source: string
    ) => {
      if (source === 'user') changedRef.current = true;
    };
    quill.on('selection-change', onSelectionChange);
    quill.on('text-change', onTextChange);
    return () => {
      quill.off('selection-change', onSelectionChange);
      quill.off('text-change', onTextChange);
      unregisterTextBoxEditor(textBoxId, quill);
    };
  }, [textBoxId]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Typing must never reach the canvas shortcut layer (Delete, tool hotkeys,
    // canvas Escape) — mirrors useInlineRename's contract.
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      finishRef.current('cancel');
    }
  }, []);

  const stop = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <Box
      ref={rootRef}
      onKeyDown={onKeyDown}
      onPointerDown={stop}
      onMouseDown={stop}
      onClick={stop}
      onDoubleClick={stop}
      data-axoview-id="textbox-inline-editor"
      sx={{
        ...fontProps,
        // Grow-as-you-type (Lucid convention): the box extends rightward with
        // the longest line instead of wrapping at the stale committed width —
        // which is also what commit will measure (isoMath sizes the box to the
        // longest line, so resting content never soft-wraps either).
        width: 'max-content',
        minWidth: '100%',
        outline: '1px solid rgba(0,0,0,0.3)',
        borderRadius: 1,
        bgcolor: '#fff',
        px: 0.75,
        cursor: 'text',
        // Quill chrome off — the box IS the editor (snow theme classes exist
        // for the globally-imported quill.snow.css; borders are ours to kill).
        '& .ql-container.ql-snow': {
          border: 'none',
          fontSize: 'inherit',
          fontFamily: 'inherit',
          lineHeight: 'inherit',
          height: 'auto'
        },
        '& .ql-editor': {
          padding: 0,
          overflow: 'visible',
          minHeight: '1em',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          // Beat quill.snow.css's fixed 1.42 — line spacing must match the
          // resting render (the box's lineHeight, ADR 0034 addendum).
          lineHeight: 'inherit'
        },
        // Editing/resting list-geometry parity: Quill's snow defaults total
        // 3em of text indent (1.5em on ol + 1.5em on li) while the resting
        // render indents CANVAS_RICHTEXT_LIST_INDENT_EM. Pin the editor to
        // the same constant: all indent on the ol, none on the li, marker
        // metrics re-derived so the glyph sits inside the indent. (Quill puts
        // every list in an <ol> and marks bullets via data-list/.ql-ui.)
        '& .ql-editor ol': {
          paddingLeft: `${CANVAS_RICHTEXT_LIST_INDENT_EM}em`
        },
        '& .ql-editor li': { paddingLeft: 0 },
        '& .ql-editor li > .ql-ui::before': {
          marginLeft: `-${CANVAS_RICHTEXT_LIST_INDENT_EM}em`,
          marginRight: '0.3em',
          width: `${CANVAS_RICHTEXT_LIST_INDENT_EM - 0.3}em`
        },
        // The link tooltip misplaces under the iso matrix transform — links are
        // authored from the strip's Link control instead (ADR 0034 §2).
        '& .ql-tooltip': { display: 'none' }
      }}
    >
      <ReactQuill
        ref={quillRef}
        theme="snow"
        defaultValue={initialHtml}
        formats={formats}
        modules={QUILL_MODULES}
      />
    </Box>
  );
};
