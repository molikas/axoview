import React, { memo, useState, useRef, useCallback } from 'react';
import { Box, Typography, InputBase, IconButton, Tooltip } from '@mui/material';
import {
  DeviceHubOutlined,
  RectangleOutlined,
  TextFieldsOutlined,
  WidgetsOutlined,
  LabelOutlined as ShowNameIcon,
  LabelOffOutlined as HideNameIcon
} from '@mui/icons-material';
import { LayerItem, LayerItemType } from 'src/hooks/useLayerContext';

const GLYPH_ICON: Partial<Record<LayerItemType, React.ReactElement>> = {
  CONNECTOR: <DeviceHubOutlined sx={{ fontSize: 16 }} />,
  RECTANGLE: <RectangleOutlined sx={{ fontSize: 16 }} />,
  TEXTBOX: <TextFieldsOutlined sx={{ fontSize: 16 }} />
};

const ItemThumbnail = ({ item }: { item: LayerItem }) => {
  if (item.type === 'ITEM' && item.iconUrl) {
    return (
      <Box
        component="img"
        src={item.iconUrl}
        sx={{ width: 16, height: 16, objectFit: 'contain' }}
      />
    );
  }
  return GLYPH_ICON[item.type] ?? <WidgetsOutlined sx={{ fontSize: 16 }} />;
};

const RENAMEABLE: Set<LayerItemType> = new Set(['ITEM', 'CONNECTOR', 'TEXTBOX', 'RECTANGLE']);

const HAS_LABEL: Set<LayerItemType> = new Set(['ITEM', 'CONNECTOR']);

interface Props {
  item: LayerItem;
  isSelected: boolean;
  onClick: (item: LayerItem) => void;
  onRename?: (item: LayerItem, newName: string) => void;
  onDragStart?: (item: LayerItem) => void;
  onToggleLabel?: (item: LayerItem) => void;
}

export const LayerItemRow = memo(
  ({ item, isSelected, onClick, onRename, onDragStart, onToggleLabel }: Props) => {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const rowRef = useRef<HTMLDivElement>(null);

    const startEditFromDblClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onRename || !RENAMEABLE.has(item.type)) return;
        setDraft(item.name);
        setEditing(true);
        setTimeout(() => inputRef.current?.select(), 0);
      },
      [item.name, item.type, onRename]
    );

    const commitEdit = useCallback(() => {
      if (!editing) return;
      const trimmed = draft.trim();
      if (trimmed && trimmed !== item.name) {
        onRename?.(item, trimmed);
      }
      setEditing(false);
    }, [editing, draft, item, onRename]);

    const handleInputKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
        if (e.key === 'Escape') { setEditing(false); }
      },
      [commitEdit]
    );

    const handleRowKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'F2' && RENAMEABLE.has(item.type) && onRename) {
          e.stopPropagation();
          e.preventDefault();
          setDraft(item.name);
          setEditing(true);
          setTimeout(() => inputRef.current?.select(), 0);
        }
      },
      [item.name, item.type, onRename]
    );

    return (
      <Box
        ref={rowRef}
        tabIndex={0}
        onClick={() => {
          if (!editing) {
            onClick(item);
            rowRef.current?.focus();
          }
        }}
        onDoubleClick={startEditFromDblClick}
        onKeyDown={handleRowKeyDown}
        onMouseDown={(e) => {
          if (!editing) {
            e.preventDefault();
            onDragStart?.(item);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          pl: 3.5,
          pr: 0.5,
          py: 0.25,
          cursor: editing ? 'text' : 'pointer',
          borderRadius: 1,
          bgcolor: isSelected ? 'primary.main' : 'transparent',
          color: isSelected ? 'primary.contrastText' : 'text.secondary',
          outline: 'none',
          '&:hover': { bgcolor: isSelected ? 'primary.main' : 'action.hover' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
          userSelect: 'none'
        }}
      >
        <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 0.7 }}>
          <ItemThumbnail item={item} />
        </Box>
        {editing ? (
          <InputBase
            inputRef={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleInputKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            sx={{
              flex: 1,
              fontSize: '0.7rem',
              bgcolor: 'background.paper',
              color: 'text.primary',
              borderRadius: 0.5,
              border: '1px solid',
              borderColor: 'primary.main',
              px: 0.5,
              '& input': { p: 0, height: 'auto' }
            }}
          />
        ) : (
          <>
            <Typography
              variant="caption"
              sx={{
                flex: 1,
                fontSize: '0.7rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {item.name}
            </Typography>
            {HAS_LABEL.has(item.type) && onToggleLabel && (
              <Tooltip title={item.showLabel === false ? 'Show name' : 'Hide name'} placement="right">
                <IconButton
                  size="small"
                  className="label-toggle"
                  onClick={(e) => { e.stopPropagation(); onToggleLabel(item); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  sx={{
                    p: 0.25,
                    flexShrink: 0,
                    opacity: item.showLabel === false ? 1 : 0.5,
                    color: 'inherit',
                    transition: 'opacity 0.15s',
                    '&:hover': { opacity: 1 }
                  }}
                >
                  {item.showLabel === false
                    ? <HideNameIcon sx={{ fontSize: 14 }} />
                    : <ShowNameIcon sx={{ fontSize: 14 }} />}
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
      </Box>
    );
  }
);
