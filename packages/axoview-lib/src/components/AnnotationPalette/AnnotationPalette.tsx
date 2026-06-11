// AnnotationPalette — entry pen + draggable floating palette for the ephemeral
// annotation overlay (ADR 0014). Available in edit + preview.
//
//   - closed → a single pen button (the entry) toggles the overlay on;
//   - open   → a draggable vertical palette: tools (pencil / highlighter /
//     line / arrow / rectangle / ellipse / eraser), color presets, thickness,
//     undo, Clear, a collapse toggle, and close.
//
// Collapse HIDES the drawing (overlay reads open && !collapsed) but RETAINS the
// strokes; Clear is the only wipe. Nothing here is ever persisted.

import React, { useCallback, useEffect, useRef } from 'react';
import { Box, Divider, IconButton, Paper, Stack, Tooltip } from '@mui/material';
import {
  GestureOutlined as PencilIcon,
  BorderColorOutlined as HighlighterIcon,
  RemoveOutlined as LineIcon,
  ArrowRightAltOutlined as ArrowIcon,
  CropSquareOutlined as RectIcon,
  CircleOutlined as EllipseIcon,
  CleaningServicesOutlined as EraserIcon,
  UndoOutlined as UndoIcon,
  DeleteOutlineOutlined as ClearIcon,
  CloseOutlined as CloseIcon,
  DragIndicatorOutlined as DragIcon,
  UnfoldLessOutlined as CollapseIcon,
  UnfoldMoreOutlined as ExpandIcon,
  EditOutlined as PenIcon
} from '@mui/icons-material';
import { shallow } from 'zustand/shallow';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useTranslation } from 'src/stores/localeStore';
import { AnnotationTool } from 'src/types';
import {
  ANNOTATION_COLOR_PRESETS,
  ANNOTATION_THICKNESS_PRESETS
} from 'src/config/annotationSettings';

const TOOL_ICONS: Record<AnnotationTool, React.ReactNode> = {
  pencil: <PencilIcon sx={{ fontSize: 18 }} />,
  highlighter: <HighlighterIcon sx={{ fontSize: 18 }} />,
  line: <LineIcon sx={{ fontSize: 18 }} />,
  arrow: <ArrowIcon sx={{ fontSize: 18 }} />,
  rectangle: <RectIcon sx={{ fontSize: 18 }} />,
  ellipse: <EllipseIcon sx={{ fontSize: 18 }} />,
  eraser: <EraserIcon sx={{ fontSize: 18 }} />
};

const TOOL_ORDER: AnnotationTool[] = [
  'pencil',
  'highlighter',
  'line',
  'arrow',
  'rectangle',
  'ellipse',
  'eraser'
];

export const AnnotationPalette = () => {
  const { t } = useTranslation('annotationPalette');
  const actions = useUiStateStore((s) => s.actions);
  const { open, collapsed, tool, color, thickness, palettePos, strokeCount } =
    useUiStateStore(
      (s) => ({
        open: s.annotation.open,
        collapsed: s.annotation.collapsed,
        tool: s.annotation.tool,
        color: s.annotation.color,
        thickness: s.annotation.thickness,
        palettePos: s.annotation.palettePos,
        strokeCount: s.annotation.strokes.length
      }),
      shallow
    );

  // --- Drag the palette by its header -----------------------------------------
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const handleDragDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { dx: e.clientX - palettePos.x, dy: e.clientY - palettePos.y };
    },
    [palettePos.x, palettePos.y]
  );
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      actions.setAnnotationPalettePos({
        x: Math.max(0, e.clientX - dragRef.current.dx),
        y: Math.max(0, e.clientY - dragRef.current.dy)
      });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [actions]);

  // Closed → just the pen entry button.
  if (!open) {
    return (
      <Tooltip title={t('pen')} placement="right">
        <IconButton
          size="small"
          onClick={() => actions.setAnnotationOpen(true)}
          data-axoview-id="annotation-pen"
          sx={{
            // Top-right of the canvas — clear of the left docks/file explorer,
            // the top-center ToolMenu, and the bottom chrome.
            position: 'absolute',
            right: 12,
            top: 12,
            zIndex: 20,
            borderRadius: 1,
            bgcolor: 'background.paper',
            boxShadow: 2,
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <PenIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    );
  }

  const swatch = (preset: string) => (
    <Box
      key={preset}
      role="button"
      aria-label={preset}
      data-axoview-id="annotation-color"
      onClick={() => actions.setAnnotationColor(preset)}
      sx={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        bgcolor: preset,
        cursor: 'pointer',
        border: '2px solid',
        borderColor: color === preset ? 'primary.main' : 'divider',
        boxSizing: 'border-box'
      }}
    />
  );

  return (
    <Paper
      elevation={6}
      data-axoview-id="annotation-palette"
      onPointerDown={(e) => e.stopPropagation()}
      sx={{
        position: 'absolute',
        left: palettePos.x,
        top: palettePos.y,
        zIndex: 20,
        width: 56,
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      {/* Header / drag handle + collapse + close */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 0.25, py: 0.25, bgcolor: 'action.hover', cursor: 'grab' }}
        onPointerDown={handleDragDown}
        data-axoview-id="annotation-palette-header"
      >
        <DragIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        <Stack direction="row">
          <Tooltip title={collapsed ? t('expand') : t('collapse')} placement="top">
            <IconButton
              size="small"
              onClick={() => actions.setAnnotationCollapsed(!collapsed)}
              data-axoview-id="annotation-collapse"
              sx={{ p: 0.25 }}
            >
              {collapsed ? (
                <ExpandIcon sx={{ fontSize: 14 }} />
              ) : (
                <CollapseIcon sx={{ fontSize: 14 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={t('close')} placement="top">
            <IconButton
              size="small"
              onClick={() => actions.setAnnotationOpen(false)}
              data-axoview-id="annotation-close"
              sx={{ p: 0.25 }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {!collapsed && (
        <Stack spacing={0.5} sx={{ p: 0.5, alignItems: 'center' }}>
          {TOOL_ORDER.map((tl) => (
            <Tooltip key={tl} title={t(tl)} placement="right">
              <IconButton
                size="small"
                onClick={() => actions.setAnnotationTool(tl)}
                aria-pressed={tool === tl}
                data-axoview-id={`annotation-tool-${tl}`}
                sx={{
                  p: 0.5,
                  borderRadius: 1,
                  color: tool === tl ? 'primary.main' : 'text.secondary',
                  bgcolor: tool === tl ? 'action.selected' : 'transparent'
                }}
              >
                {TOOL_ICONS[tl]}
              </IconButton>
            </Tooltip>
          ))}

          <Divider flexItem sx={{ my: 0.25 }} />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0.5,
              placeItems: 'center'
            }}
          >
            {ANNOTATION_COLOR_PRESETS.map(swatch)}
          </Box>

          <Divider flexItem sx={{ my: 0.25 }} />

          <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
            {ANNOTATION_THICKNESS_PRESETS.map((w) => (
              <Box
                key={w}
                role="button"
                aria-label={`${w}`}
                data-axoview-id="annotation-thickness"
                onClick={() => actions.setAnnotationThickness(w)}
                sx={{
                  width: 28,
                  height: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderRadius: 1,
                  bgcolor: thickness === w ? 'action.selected' : 'transparent'
                }}
              >
                <Box
                  sx={{
                    width: 22,
                    height: Math.min(w, 12),
                    borderRadius: 4,
                    bgcolor: 'text.primary'
                  }}
                />
              </Box>
            ))}
          </Stack>

          <Divider flexItem sx={{ my: 0.25 }} />

          <Tooltip title={t('undo')} placement="right">
            <span>
              <IconButton
                size="small"
                onClick={actions.undoAnnotationStroke}
                disabled={strokeCount === 0}
                data-axoview-id="annotation-undo"
                sx={{ p: 0.5 }}
              >
                <UndoIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('clear')} placement="right">
            <span>
              <IconButton
                size="small"
                onClick={actions.clearAnnotations}
                disabled={strokeCount === 0}
                data-axoview-id="annotation-clear"
                sx={{ p: 0.5, color: 'error.main' }}
              >
                <ClearIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      )}
    </Paper>
  );
};
