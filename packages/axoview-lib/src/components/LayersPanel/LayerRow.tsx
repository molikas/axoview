import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Typography, InputBase } from '@mui/material';
import {
  VisibilityOutlined,
  VisibilityOffOutlined,
  LockOutlined,
  LockOpenOutlined,
  DragIndicator,
  ChevronRight,
  ExpandMore
} from '@mui/icons-material';
import { Layer } from 'src/types';

interface Props {
  layer: Layer;
  isSelected: boolean;
  itemCount: number;
  isExpanded: boolean;
  // Externally-driven edit signal (F2 from the panel). Parent flips to true,
  // and onEditEnd is called when the row leaves edit mode (commit/cancel).
  isEditingExternal?: boolean;
  onEditEnd?: () => void;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export const LayerRow = memo(
  ({
    layer,
    isSelected,
    itemCount,
    isExpanded,
    isEditingExternal,
    onEditEnd,
    onSelect,
    onToggleExpand,
    onToggleVisible,
    onToggleLocked,
    onRename,
    dragHandleProps
  }: Props) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(layer.name);
    const inputRef = useRef<HTMLInputElement>(null);

    // External edit trigger (F2 from the panel) — sync into local state and
    // prime the draft from the latest layer name.
    useEffect(() => {
      if (isEditingExternal && !editing) {
        setDraft(layer.name);
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
      }
    }, [isEditingExternal, editing, layer.name]);

    const endEdit = useCallback(() => {
      setEditing(false);
      onEditEnd?.();
    }, [onEditEnd]);

    const commitRename = useCallback(() => {
      const trimmed = draft.trim();
      if (trimmed && trimmed !== layer.name) {
        onRename(layer.id, trimmed);
      } else {
        setDraft(layer.name);
      }
      endEdit();
    }, [draft, layer.id, layer.name, onRename, endEdit]);

    const handleDoubleClick = useCallback(() => {
      setDraft(layer.name);
      setEditing(true);
      setTimeout(() => inputRef.current?.select(), 0);
    }, [layer.name]);

    return (
      <Box
        onClick={() => onSelect(layer.id)}
        data-axoview-id="layer-row"
        data-layer-name={layer.name}
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 0.5,
          py: 0.25,
          cursor: 'pointer',
          borderRadius: 1,
          bgcolor: isSelected
            ? 'action.selected'
            : layer.locked
              ? 'action.hover'
              : 'transparent',
          // Locked rows get a left accent stripe so the state is unambiguous
          // at a glance, not just a near-identical icon swap (mqa-results.md #2).
          borderLeft: layer.locked ? '2px solid' : '2px solid transparent',
          borderLeftColor: layer.locked ? 'warning.main' : 'transparent',
          opacity: layer.visible ? 1 : 0.45,
          '&:hover': {
            bgcolor: isSelected ? 'action.selected' : 'action.hover'
          },
          userSelect: 'none'
        }}
      >
        {/* Expand/collapse chevron */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: 'text.disabled',
            mr: 0
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(layer.id);
          }}
        >
          {itemCount > 0 ? (
            isExpanded ? (
              <ExpandMore sx={{ fontSize: 16 }} />
            ) : (
              <ChevronRight sx={{ fontSize: 16 }} />
            )
          ) : (
            <Box sx={{ width: 16 }} />
          )}
        </Box>

        {/* Drag handle */}
        <Box
          {...dragHandleProps}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            color: 'text.disabled',
            mr: 0.25
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <DragIndicator fontSize="small" />
        </Box>

        {/* Layer name / inline edit */}
        <Box sx={{ flex: 1, minWidth: 0 }} onDoubleClick={handleDoubleClick}>
          {editing ? (
            <InputBase
              inputRef={inputRef}
              value={draft}
              size="small"
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setDraft(layer.name);
                  endEdit();
                }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
              sx={{ fontSize: '0.875rem', width: '100%' }}
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                overflow: 'hidden'
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {layer.name}
              </Typography>
              {itemCount > 0 && (
                <Typography
                  variant="micro"
                  color="text.disabled"
                  sx={{ flexShrink: 0 }}
                >
                  {itemCount}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Visibility toggle */}
        <Tooltip
          title={layer.visible ? 'Hide layer' : 'Show layer'}
          placement="top"
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisible(layer.id);
            }}
            data-axoview-id="layer-toggle-visibility"
            sx={{ p: 0.25 }}
          >
            {layer.visible ? (
              <VisibilityOutlined sx={{ fontSize: 14 }} />
            ) : (
              <VisibilityOffOutlined sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Lock toggle */}
        <Tooltip
          title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          placement="top"
        >
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLocked(layer.id);
            }}
            data-axoview-id="layer-toggle-lock"
            sx={{
              p: 0.25,
              // Saturate the icon when locked so the state is obvious next to
              // a row of similar-looking outlines (mqa-results.md #2).
              color: layer.locked ? 'warning.main' : 'action.active'
            }}
          >
            {layer.locked ? (
              <LockOutlined sx={{ fontSize: 14 }} />
            ) : (
              <LockOpenOutlined sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    );
  }
);
