import React, { useMemo, memo, useCallback, useEffect, useState, useRef } from 'react';
import { Box, Typography, Stack, Tooltip, IconButton, Popover } from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  ArticleOutlined as LinkedDiagramIcon,
  StickyNote2Outlined as NotesIcon
} from '@mui/icons-material';
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
      // Always commit whenever the value changed — including clearing to empty,
      // which is how the user hides the label (matching the details-panel TextField).
      if (next !== (modelItem?.name ?? '')) {
        updateModelItem(node.id, { name: next });
      }
      setIsEditingName(false);
    },
    [updateModelItem, node.id, modelItem?.name]
  );

  const linkedDiagramName = hasLink
    ? (linkedDiagrams.find((d) => d.id === modelItem!.link)?.name ?? null)
    : null;

  // MQA #22 / #25: in preview mode the node body is no longer clickable for
  // navigation. The hover-revealed action chip below surfaces up to three
  // affordances (external link via name, linked-diagram navigation, notes).
  const [isHovered, setIsHovered] = useState(false);
  const [notesAnchor, setNotesAnchor] = useState<HTMLElement | null>(null);
  const nodeBoxRef = useRef<HTMLDivElement | null>(null);

  const visibleNotes = useMemo(() => {
    if (!modelItem?.notes) return null;
    const stripped = modelItem.notes.replace(/<[^>]*>/g, '').trim();
    return stripped ? modelItem.notes : null;
  }, [modelItem?.notes]);

  const headerLinkUrl = useMemo(() => {
    if (!modelItem?.headerLink) return null;
    return /^https?:\/\//i.test(modelItem.headerLink)
      ? modelItem.headerLink
      : `https://${modelItem.headerLink}`;
  }, [modelItem?.headerLink]);

  const stopMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopPropagation();
  }, []);

  const handleOpenHeaderLink = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (headerLinkUrl) {
        window.open(headerLinkUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [headerLinkUrl]
  );

  const handleOpenLinkedDiagram = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (modelItem?.link) {
        window.open(`/display/${modelItem.link}`, '_blank', 'noopener,noreferrer');
      }
    },
    [modelItem?.link]
  );

  const handleOpenNotes = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setNotesAnchor(nodeBoxRef.current);
    },
    []
  );

  const handleCloseNotes = useCallback(() => setNotesAnchor(null), []);

  const showHoverChip =
    isReadonly &&
    isHovered &&
    (!!headerLinkUrl || !!modelItem?.link || !!visibleNotes);

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
      <Box
        ref={nodeBoxRef}
        onMouseEnter={isReadonly ? () => setIsHovered(true) : undefined}
        onMouseLeave={isReadonly ? () => setIsHovered(false) : undefined}
        sx={{
          position: 'absolute',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          left: position.x,
          top: position.y,
          cursor: 'inherit',
          ...(isReadonly && (!!modelItem?.link || !!headerLinkUrl || !!visibleNotes)
            ? { pointerEvents: 'auto' }
            : {})
        }}
      >
        {showHoverChip && (
          <Box
            data-testid="node-hover-chip"
            onMouseDown={stopMouseDown}
            onClick={(e) => e.stopPropagation()}
            sx={{
              position: 'absolute',
              bottom: '100%',
              mb: 0.75,
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
              px: 0.5,
              py: 0.25,
              borderRadius: 1,
              bgcolor: 'background.paper',
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              border: '1px solid',
              borderColor: 'divider',
              pointerEvents: 'auto',
              whiteSpace: 'nowrap',
              zIndex: 1
            }}
          >
            {headerLinkUrl && (
              <Tooltip title={`Open link: ${modelItem.headerLink}`} disableInteractive arrow>
                <IconButton
                  size="small"
                  onMouseDown={stopMouseDown}
                  onClick={handleOpenHeaderLink}
                  data-testid="node-hover-chip-link"
                  sx={{ p: 0.5 }}
                >
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {modelItem?.link && (
              <Tooltip
                title={
                  linkedDiagramName
                    ? `Open "${linkedDiagramName}" in a new tab`
                    : 'Open linked diagram in a new tab'
                }
                disableInteractive
                arrow
              >
                <IconButton
                  size="small"
                  onMouseDown={stopMouseDown}
                  onClick={handleOpenLinkedDiagram}
                  data-testid="node-hover-chip-diagram"
                  sx={{ p: 0.5 }}
                >
                  <LinkedDiagramIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
            {visibleNotes && (
              <Tooltip title="Open notes" disableInteractive arrow>
                <IconButton
                  size="small"
                  onMouseDown={stopMouseDown}
                  onClick={handleOpenNotes}
                  data-testid="node-hover-chip-notes"
                  sx={{ p: 0.5 }}
                >
                  <NotesIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
        <Popover
          open={!!notesAnchor && !!visibleNotes}
          anchorEl={notesAnchor}
          onClose={handleCloseNotes}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          slotProps={{
            paper: {
              sx: { p: 1.5, maxWidth: 360, minWidth: 220 },
              onMouseDown: stopMouseDown
            }
          }}
        >
          {visibleNotes && (
            <RichTextEditor value={visibleNotes} readOnly />
          )}
        </Popover>
        {node.showLabel !== false && (modelItem?.name || description || isEditingName) && (
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
              <Box
                sx={{
                  pointerEvents: 'none',
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
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
});
