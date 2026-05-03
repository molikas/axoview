import React, { useMemo, memo, useCallback, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { toPx, CoordsUtils } from 'src/utils';
import { useIsoProjection } from 'src/hooks/useIsoProjection';
import { useTextBoxProps } from 'src/hooks/useTextBoxProps';
import { useScene } from 'src/hooks/useScene';
import { useUiStateStore } from 'src/stores/uiStateStore';

const INLINE_EDIT_EVENT = 'inlineEditNodeName';

interface Props {
  textBox: ReturnType<typeof useScene>['textBoxes'][0];
}

// Strip HTML tags so existing rich-text content can be edited as plain text inline.
// Rich editing remains available via the side panel.
const htmlToPlain = (s: string | undefined): string => {
  if (!s) return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n+$/, '');
};

export const TextBox = memo(({ textBox }: Props) => {
  const { paddingX, fontProps } = useTextBoxProps(textBox);
  const editorMode = useUiStateStore((s) => s.editorMode);
  const { updateTextBox } = useScene();
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

  const from = useMemo(() => {
    return CoordsUtils.add(textBox.tile, {
      x: 0,
      y: -(textBox.size.height - 1)
    });
  }, [textBox.tile, textBox.size.height]);

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

  return (
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
            onBlur={(e) => commit(e.currentTarget.innerText)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.currentTarget as HTMLElement).blur();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setIsEditing(false);
              }
            }}
            ref={(el) => {
              if (el && document.activeElement !== el) {
                el.focus();
                const range = document.createRange();
                range.selectNodeContents(el);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
              }
            }}
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
              <span dangerouslySetInnerHTML={{ __html: textBox.content }} />
            ) : (
              textBox.content
            )}
          </Typography>
        )}
      </Box>
    </Box>
  );
});
