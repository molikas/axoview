import React, { useMemo, memo, useCallback, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { toPx, CoordsUtils } from 'src/utils';
import { decodeHtmlEntities } from 'src/utils/htmlToPlainText';
import { stripHtmlTags } from 'src/utils/stripHtml';
import { sanitizeHtml } from 'src/utils/sanitizeHtml';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import { useTextBoxProps } from 'src/hooks/useTextBoxProps';
import { useSceneData } from 'src/hooks/useSceneData';
import { useSceneActions } from 'src/hooks/useSceneActions';
import { useInlineRename } from 'src/hooks/useInlineRename';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';

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

// Strip HTML tags so existing rich-text content can be edited as plain text inline.
// Rich editing remains available via the side panel.
const htmlToPlain = (s: string | undefined): string => {
  if (!s) return '';
  // Block tags → newlines (preserve line breaks), then strip the rest via the
  // shared FIXPOINT stripper and decode entities (A1 converge — also covers
  // &#39;/&quot;/numeric). The fixpoint strip (vs a single `/<[^>]*>/g` pass)
  // can't leave a reassembled tag behind, clearing CodeQL
  // js/incomplete-multi-character-sanitization on this path.
  const withBreaks = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n');
  return decodeHtmlEntities(stripHtmlTags(withBreaks)).replace(/\n+$/, '');
};

export const TextBox = memo(({ textBox }: Props) => {
  const { paddingX, fontProps } = useTextBoxProps(textBox);
  const editorMode = useUiStateStore((s) => s.editorMode);
  // Actions only (not useScene): this textbox sits in the drag hot path and must
  // not re-render on every scene mutation just to hold updateTextBox (perf A-1).
  const { updateTextBox } = useSceneActions();
  const isEditable = editorMode === 'EDITABLE';
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditable) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === textBox.id) setIsEditing(true);
    };
    window.addEventListener(INLINE_EDIT_EVENT, handler);
    return () => window.removeEventListener(INLINE_EDIT_EVENT, handler);
  }, [textBox.id, isEditable]);

  const startInlineEdit = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      e.stopPropagation();
      e.preventDefault();
      setIsEditing(true);
    },
    [isEditable]
  );

  const commit = useCallback(
    (raw: string) => {
      const next = raw.trim();
      if (next !== (textBox.content ?? '')) {
        updateTextBox(textBox.id, { content: next });
      }
      setIsEditing(false);
    },
    [updateTextBox, textBox.id, textBox.content]
  );

  const inlineRename = useInlineRename({
    active: isEditing,
    commit,
    cancel: () => setIsEditing(false),
    multiline: true
  });

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
          <Typography
            contentEditable
            suppressContentEditableWarning
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={inlineRename.onBlur}
            onKeyDown={inlineRename.onKeyDown}
            ref={inlineRename.setRef}
            sx={{
              ...fontProps,
              outline: '1px solid rgba(0,0,0,0.3)',
              borderRadius: 1,
              px: 0.75,
              bgcolor: '#fff',
              minWidth: 20,
              cursor: 'text',
              display: 'inline-block',
              width: 'max-content',
              maxWidth: '100%',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {htmlToPlain(textBox.content)}
          </Typography>
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
