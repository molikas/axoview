import React, { useMemo, memo, useCallback, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { DEFAULT_LABEL_HEIGHT } from 'src/config';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useIcon } from 'src/hooks/useIcon';
import { ViewItem } from 'src/types';
import { useModelItem } from 'src/hooks/useModelItem';
import { useSceneActions } from 'src/hooks/useSceneActions';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useRenderProbe } from 'src/utils/renderProbe';
import { ExpandableLabel } from 'src/components/Label/ExpandableLabel';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';
import { stripHtmlTags } from 'src/utils/stripHtml';

const INLINE_EDIT_EVENT = 'inlineEditNodeName';

interface Props {
  node: ViewItem;
  order: number;
}

// MQA #7 Path 2 — render-fan-out reduction for multi-element drag.
//
// During a drag, only `node.tile` (and therefore `order`) changes per frame.
// The outer Node shell still re-renders per tick (parent passes a new
// ViewItem ref), but its render output is now a thin position wrapper plus a
// memoized NodeContent. NodeContent's props are only the stable layout fields,
// so its memo bails as long as labels/text aren't being edited. Net effect:
// per-tick React commit drops from "rebuild icon + label + flex tree" to
// "update one inline style".
//
// Position uses inline `style={{left, top}}` (not sx) so emotion isn't
// re-invoked per drag tick. The static sx pieces are module-level constants
// so emotion's class hash hits cache every time.

// T1 "wholesale de-emotion" (decision-log): the per-node elements below are
// module-level styled() components, so their CSS is resolved ONCE into a cached
// emotion class and each of the ~N nodes pays only a className apply — NOT the
// per-instance MUI sx pipeline (extendSxProp / styleFunctionSx / murmur2), which
// `<Box sx={...}>` re-runs every render even for a constant sx object (~403 ms of
// the spawn freeze at N=1000; perf-results/cpuprofile-spawn-1000.md). Dynamic bits
// (the --ff-* CSS vars, cursor, label colour/size) stay inline; the drag CSS-var
// transform mechanism (MQA #7 Path 4-true) is preserved verbatim.

const NodeShell = styled('div')({ position: 'absolute' });

const NodeTransform = styled('div')({
  position: 'absolute',
  // --ff-x/--ff-y written by React from the model tile; --ff-drag-dx/dy mutated
  // by DragItems via DOM during a drag. One translate3d → compositor-only
  // updates (no layout, no per-frame React). (The tap-to-place carry affordance
  // was superseded by direct manipulation — ADR 0018 Revision B — so there is no
  // --ff-carry-scale here.)
  transform:
    'translate3d(calc(var(--ff-x, 0px) + var(--ff-drag-dx, 0px)), calc(var(--ff-y, 0px) + var(--ff-drag-dy, 0px)), 0)',
  willChange: 'transform'
});

// Flex-centering wrapper (cursor applied inline — it is the one dynamic bit).
const NodeContentFlex = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
});

// Replaces the former <Stack spacing={1}> / flex-div: 8px = theme.spacing(1).
const LabelStack = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  gap: 8
});

const IconWrap = styled('div')({
  pointerEvents: 'none',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative'
});

const NotesBadge = styled('div')({
  position: 'absolute',
  top: -6,
  right: -6,
  width: 14,
  height: 14,
  borderRadius: '50%',
  backgroundColor: '#1565c0',
  border: '2px solid #fff',
  boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
});

// Display-mode label title: theme.typography.body1 + the fixed overrides baked
// once. Per-node labelFontSize / labelColor go via inline style.
const LabelTitle = styled('p')(({ theme }) => ({
  ...theme.typography.body1,
  margin: 0,
  fontWeight: 600,
  fontSize: 14,
  color: theme.palette.text.primary
}));

export const Node = memo(({ node, order }: Props) => {
  useRenderProbe('Node', node.id);
  const { getTilePosition } = useCanvasMode();

  const position = useMemo(
    () =>
      getTilePosition({
        tile: node.tile,
        origin: 'CENTER'
      }),
    [getTilePosition, node.tile]
  );

  return (
    <NodeShell style={{ zIndex: order }} data-drag-id={node.id}>
      <NodeTransform
        style={
          {
            '--ff-x': `${position.x}px`,
            '--ff-y': `${position.y}px`
          } as React.CSSProperties
        }
      >
        <NodeContent
          id={node.id}
          showLabel={node.showLabel}
          labelHeight={node.labelHeight}
          labelFontSize={node.labelFontSize}
          labelColor={node.labelColor}
        />
      </NodeTransform>
    </NodeShell>
  );
});

// ---------------------------------------------------------------------------
// NodeContent — heavy content (label + icon + badges).
//
// Receives only the stable, non-position fields from ViewItem. Memo bails as
// long as those primitives are unchanged. During a drag, this means dragged
// nodes still re-render the position wrapper but the icon/label tree is
// reused without React reconciliation.
// ---------------------------------------------------------------------------

interface NodeContentProps {
  id: string;
  showLabel?: boolean;
  labelHeight?: number;
  labelFontSize?: number;
  labelColor?: string;
}

const NodeContent = memo(
  ({
    id,
    showLabel,
    labelHeight,
    labelFontSize,
    labelColor
  }: NodeContentProps) => {
    useRenderProbe('NodeContent', id);
    const modelItem = useModelItem(id);
    const { iconComponent } = useIcon(modelItem?.icon);
    const editorMode = useUiStateStore((s) => s.editorMode);
    // MQA #7 Path 2 — useSceneActions only (NOT useScene). The latter pulls
    // useSceneData which subscribes to {views, ...} shallow; `views` ticks
    // per drag frame and would force NodeContent to re-render past its memo
    // gate, defeating the split.
    const { updateModelItem } = useSceneActions();

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
        if (detail?.id === id) setIsEditingName(true);
      };
      window.addEventListener(INLINE_EDIT_EVENT, handler);
      return () => window.removeEventListener(INLINE_EDIT_EVENT, handler);
    }, [id, isEditable]);

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
          updateModelItem(id, { name: next });
        }
        setIsEditingName(false);
      },
      [updateModelItem, id, modelItem?.name]
    );

    // MQA #22 / #25 (3rd pass): the chip / hover-popover patterns were both
    // wrong. The user wants the existing read-only details panel (NodePanel
    // readOnly) to open on left-click of the node body — same component, same
    // surface, augmented with an "Open linked diagram" affordance in its header.
    // The body click itself is dispatched from Pan.mouseup (so right-drag pan
    // continues to work). The Node component just renders the visual; it does
    // not own the click handler anymore.

    const description = useMemo(() => {
      if (!modelItem?.description) return null;
      const visible = stripHtmlTags(modelItem.description).trim();
      return visible ? modelItem.description : null;
    }, [modelItem?.description]);

    // MQA #22 / #25 (final polish): in preview mode, give clickable nodes the
    // pointing-finger cursor so the hover affordance matches Pan.mouseup's
    // panel-opening logic. "Clickable" === any content that would populate
    // the readOnly NodePanel: linked diagram, external link, notes, or
    // description. EDITABLE mode is unaffected (cursor stays inherit so the
    // canvas tooling sets its own cursor).
    const visibleNotes = useMemo(() => {
      if (!modelItem?.notes) return null;
      const stripped = stripHtmlTags(modelItem.notes).trim();
      return stripped ? modelItem.notes : null;
    }, [modelItem?.notes]);

    const isClickableInReadonly =
      isReadonly &&
      (!!modelItem?.link ||
        !!modelItem?.headerLink ||
        !!description ||
        !!visibleNotes);

    if (!modelItem) {
      return null;
    }

    return (
      <NodeContentFlex
        style={{ cursor: isClickableInReadonly ? 'pointer' : 'inherit' }}
      >
        {showLabel !== false &&
          (modelItem?.name || description || isEditingName) && (
            <div data-testid="node-label" onDoubleClick={startInlineEdit}>
              <ExpandableLabel
                maxWidth={isEditingName ? 600 : 250}
                expandDirection="BOTTOM"
                labelHeight={labelHeight ?? DEFAULT_LABEL_HEIGHT}
              >
                <LabelStack>
                  {isEditingName ? (
                    <Typography
                      fontWeight={600}
                      fontSize={labelFontSize ?? 14}
                      color={labelColor || 'text.primary'}
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
                      <LabelTitle
                        style={{
                          ...(labelFontSize
                            ? { fontSize: labelFontSize }
                            : null),
                          ...(labelColor ? { color: labelColor } : null)
                        }}
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
                      </LabelTitle>
                    )
                  )}
                  {description && (
                    <RichTextEditor value={description} readOnly />
                  )}
                </LabelStack>
              </ExpandableLabel>
            </div>
          )}
        {iconComponent && (
          <IconWrap>
            {iconComponent}
            {modelItem.notes &&
              stripHtmlTags(modelItem.notes).trim() && <NotesBadge />}
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
          </IconWrap>
        )}
      </NodeContentFlex>
    );
  }
);
