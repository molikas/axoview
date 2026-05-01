import React, { useMemo, memo, useCallback, useEffect, useState } from 'react';
import { Box, Typography, Stack, Tooltip } from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { DEFAULT_LABEL_HEIGHT } from 'src/config';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useIcon } from 'src/hooks/useIcon';
import { ViewItem } from 'src/types';
import { useModelItem } from 'src/hooks/useModelItem';
import { useScene } from 'src/hooks/useScene';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { ExpandableLabel } from 'src/components/Label/ExpandableLabel';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';

const INLINE_EDIT_EVENT = 'inlineEditNodeName';

interface Props {
  node: ViewItem;
  order: number;
}

export const Node = memo(({ node, order }: Props) => {
  const modelItem = useModelItem(node.id);
  const { iconComponent } = useIcon(modelItem?.icon);
  const { getTilePosition } = useCanvasMode();
  const editorMode = useUiStateStore((s) => s.editorMode);
  const linkedDiagrams = useUiStateStore((s) => s.linkedDiagrams);
  const { updateModelItem } = useScene();

  const isReadonly = editorMode === 'EXPLORABLE_READONLY';
  const isEditable = editorMode === 'EDITABLE';
  const hasLink = isReadonly && !!modelItem?.link;

  const [isEditingName, setIsEditingName] = useState(false);

  // F2 handler in useInteractionManager dispatches this event for the
  // currently-selected item; match by id so only that node enters edit mode.
  useEffect(() => {
    if (!isEditable) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === node.id) setIsEditingName(true);
    };
    window.addEventListener(INLINE_EDIT_EVENT, handler);
    return () => window.removeEventListener(INLINE_EDIT_EVENT, handler);
  }, [node.id, isEditable]);

  const startInlineEdit = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable) return;
      e.stopPropagation();
      e.preventDefault();
      setIsEditingName(true);
    },
    [isEditable]
  );

  const commitName = useCallback(
    (raw: string) => {
      const next = raw.trim();
      if (next && next !== modelItem?.name) {
        updateModelItem(node.id, { name: next });
      }
      setIsEditingName(false);
    },
    [updateModelItem, node.id, modelItem?.name]
  );

  const linkedDiagramName = hasLink
    ? (linkedDiagrams.find((d) => d.id === modelItem!.link)?.name ?? null)
    : null;

  const diagramTooltip = linkedDiagramName
    ? `Opens "${linkedDiagramName}" in a new tab`
    : 'Opens linked diagram in a new tab';

  // Badge click: stop mousedown from reaching the window-level Pan handler so
  // Pan.mouseup's tile-lookup doesn't also navigate (wrong tile for badge pixels).
  const handleBadgeMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopPropagation();
  }, []);

  const handleBadgeClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (modelItem?.link) {
        window.open(`/display/${modelItem.link}`, '_blank', 'noopener,noreferrer');
      }
    },
    [modelItem]
  );

  const position = useMemo(() => {
    return getTilePosition({
      tile: node.tile,
      origin: 'CENTER'
    });
  }, [getTilePosition, node.tile]);

  const description = useMemo(() => {
    if (!modelItem?.description) return null;
    const visible = modelItem.description.replace(/<[^>]*>/g, '').trim();
    return visible ? modelItem.description : null;
  }, [modelItem?.description]);

  if (!modelItem) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'absolute',
        zIndex: order
      }}
    >
      <Tooltip
        title={hasLink && !modelItem.headerLink ? diagramTooltip : ''}
        placement="top"
        disableInteractive
        arrow
      >
      <Box
        sx={{
          position: 'absolute',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          left: position.x,
          top: position.y,
          cursor: hasLink ? 'pointer' : 'inherit',
          ...(hasLink && { pointerEvents: 'auto' })
        }}
      >
        {(modelItem?.name || description || isEditingName) && (
          <Box data-testid="node-label" onDoubleClick={startInlineEdit}>
            <ExpandableLabel
              maxWidth={isEditingName ? 600 : 250}
              expandDirection="BOTTOM"
              labelHeight={node.labelHeight ?? DEFAULT_LABEL_HEIGHT}
            >
              <Stack spacing={1}>
                {isEditingName ? (
                  <Typography
                    fontWeight={600}
                    fontSize={node.labelFontSize ?? 14}
                    color={node.labelColor || 'text.primary'}
                    contentEditable
                    suppressContentEditableWarning
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onBlur={(e) => commitName(e.currentTarget.innerText)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.currentTarget as HTMLElement).blur();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setIsEditingName(false);
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
                    {modelItem?.name ?? ''}
                  </Typography>
                ) : (
                  modelItem?.name && (
                    <Typography
                      fontWeight={600}
                      fontSize={node.labelFontSize ?? 14}
                      color={node.labelColor || 'text.primary'}
                    >
                      {modelItem.headerLink ? (
                        <a
                          href="#"
                          data-testid="node-header-link"
                          title={modelItem.headerLink}
                          style={{
                            color: 'inherit',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const url = /^https?:\/\//i.test(
                              modelItem.headerLink!
                            )
                              ? modelItem.headerLink!
                              : `https://${modelItem.headerLink}`;
                            window.open(url, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          {modelItem.name}
                        </a>
                      ) : (
                        modelItem.name
                      )}
                    </Typography>
                  )
                )}
                {description && <RichTextEditor value={description} readOnly />}
              </Stack>
            </ExpandableLabel>
          </Box>
        )}
        {iconComponent && (
          <Box
            sx={{
              pointerEvents: 'none',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              position: 'relative'
            }}
          >
            {iconComponent}
            {modelItem.notes &&
              modelItem.notes.replace(/<[^>]*>/g, '').trim() && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: '#1565c0',
                    border: '2px solid #fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                />
              )}
            {hasLink && (
              <Tooltip title={diagramTooltip} placement="right" disableInteractive arrow>
                <Box
                  onMouseDown={handleBadgeMouseDown}
                  onClick={handleBadgeClick}
                  sx={{
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    border: '2px solid #fff',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 9, color: '#fff' }} />
                </Box>
              </Tooltip>
            )}
          </Box>
        )}
      </Box>
      </Tooltip>
    </Box>
  );
});
