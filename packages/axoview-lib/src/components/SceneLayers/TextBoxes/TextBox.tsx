import React, { useMemo, memo, useCallback, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { toPx, CoordsUtils } from 'src/utils';
import { sanitizeHtml } from 'src/utils/sanitizeHtml';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import { useTextBoxProps } from 'src/hooks/useTextBoxProps';
import { useSceneData } from 'src/hooks/useSceneData';
import { useSceneActions } from 'src/hooks/useSceneActions';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { TextBoxInlineEditor } from './TextBoxInlineEditor';

const INLINE_EDIT_EVENT = 'inlineEditNodeName';

// Compositor drag wrapper (RECT-1) — same mechanism as nodes/rectangles. During
// a move, DragItems mutates --ff-drag-dx/dy on the [data-drag-id] element; this
// translate3d moves the textbox on the GPU with no per-frame model write / repaint.
const TEXTBOX_DRAG_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  transform: 'translate3d(var(--ff-drag-dx, 0px), var(--ff-drag-dy, 0px), 0)',
  willChange: 'transform'
};

interface Props {
  textBox: ReturnType<typeof useSceneData>['textBoxes'][0];
}

export const TextBox = memo(({ textBox }: Props) => {
  const { paddingX, fontProps } = useTextBoxProps(textBox);
  const editorMode = useUiStateStore((s) => s.editorMode);
  // Actions only (not useScene): this textbox sits in the drag hot path and must
  // not re-render on every scene mutation just to hold updateTextBox (perf A-1).
  const { updateTextBox } = useSceneActions();
  const isEditable = editorMode === 'EDITABLE';
  const uiActions = useUiStateStore((s) => s.actions);
  // The on-canvas edit session is store state (ADR 0034): while set, the
  // Renderer promotes this box ABOVE the interactions box (so the editor gets
  // pointer events) and the strip's text cluster targets the live editor. That
  // promotion re-parents this component mid-session — which is exactly why the
  // flag must live in the store, not component state.
  const isEditing = useUiStateStore(
    (s) => s.editingTextBoxId === textBox.id && isEditable
  );

  // F2 / context-menu Rename entry point (nodes and connectors share the event).
  useEffect(() => {
    if (!isEditable) return undefined;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === textBox.id) uiActions.setEditingTextBoxId(textBox.id);
    };
    window.addEventListener(INLINE_EDIT_EVENT, handler);
    return () => window.removeEventListener(INLINE_EDIT_EVENT, handler);
  }, [textBox.id, isEditable, uiActions]);

  const startInlineEdit = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      e.stopPropagation();
      e.preventDefault();
      uiActions.setEditingTextBoxId(textBox.id);
    },
    [isEditable, uiActions, textBox.id]
  );

  const commit = useCallback(
    (html: string) => {
      if (html !== (textBox.content ?? '')) {
        updateTextBox(textBox.id, { content: html });
      }
      uiActions.setEditingTextBoxId(null);
    },
    [updateTextBox, textBox.id, textBox.content, uiActions]
  );

  const cancel = useCallback(() => {
    uiActions.setEditingTextBoxId(null);
  }, [uiActions]);

  const { strategy } = useCanvasMode();

  // 2D-Y orientation renders as a wide-and-short rectangle that
  // useIsoProjection then rotates 90° (see MQA #11 in useIsoProjection.ts).
  // The wrapper bounds must match the dashed selection box, which for Y
  // orientation is 1 tile wide × size.width tall — so `from = tile` (no y
  // offset) and `to = tile + {size.width, 0}` (same shape as the X-mode
  // single-line rect, just at the tile itself).
  const isTwoDY =
    strategy.projectionName === '2D' && textBox.orientation === 'Y';

  const from = useMemo(() => {
    if (isTwoDY) return textBox.tile;
    return CoordsUtils.add(textBox.tile, {
      x: 0,
      y: -(textBox.size.height - 1)
    });
  }, [textBox.tile, textBox.size.height, isTwoDY]);

  const to = useMemo(() => {
    return CoordsUtils.add(textBox.tile, {
      x: textBox.size.width,
      y: 0
    });
  }, [textBox.tile, textBox.size.width]);

  const { css } = useIsoProjection({
    from,
    to,
    orientation: textBox.orientation
  });

  // ADR 0023 off-grid: compose the unprojected-px offset into the same wrapper
  // translate3d as the drag delta (the inner projected Box stays driven by the
  // integer tile/size). Snapped text boxes keep the shared module-const style.
  const dragStyle = useMemo(
    () =>
      textBox.offset
        ? {
            ...TEXTBOX_DRAG_STYLE,
            transform: `translate3d(calc(var(--ff-drag-dx, 0px) + ${textBox.offset.x}px), calc(var(--ff-drag-dy, 0px) + ${textBox.offset.y}px), 0)`
          }
        : TEXTBOX_DRAG_STYLE,
    [textBox.offset?.x, textBox.offset?.y] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ADR 0029: the read view renders Quill HTML via dangerouslySetInnerHTML.
  // Sanitize first so a shared/imported diagram can't smuggle a stored-XSS
  // payload (<img onerror>/<svg onload>) into the viewer's origin. Memoised so
  // this text box (drag hot path) doesn't re-sanitize on unrelated re-renders.
  const sanitizedContent = useMemo(
    () => (textBox.content ? sanitizeHtml(textBox.content) : ''),
    [textBox.content]
  );

  return (
    <div data-drag-id={textBox.id} style={dragStyle}>
      <Box style={css}>
        <Box
          onDoubleClick={startInlineEdit}
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'flex',
          alignItems: 'flex-start',
          width: '100%',
          height: '100%',
          px: toPx(paddingX),
          pointerEvents: isEditable ? 'auto' : 'inherit'
        }}
      >
        {isEditing ? (
          <TextBoxInlineEditor
            textBoxId={textBox.id}
            content={textBox.content}
            fontProps={fontProps}
            onCommit={commit}
            onCancel={cancel}
          />
        ) : (
          <Typography
            sx={{
              ...fontProps
            }}
          >
            {textBox.content?.trim().startsWith('<') ? (
              <span dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
            ) : (
              textBox.content
            )}
          </Typography>
        )}
        </Box>
      </Box>
    </div>
  );
});
