import React from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import {
  RectangleSvg,
  TextSvg,
  LabelSvg,
  ConnectorSvg
} from '../../elementTypeIcons';

type DeckType = 'RECTANGLE' | 'TEXTBOX' | 'LABEL' | 'CONNECTOR';

// One icon per element type — the SAME shared thumbnails the Elements panel uses
// (LeftDock/CommonElements), so a type's icon is identical wherever the type is
// named. A node passes its OWN icon via `iconNode` instead, so the header mirrors
// what's on the canvas.
const TYPE_ICON: Record<DeckType, React.ReactNode> = {
  RECTANGLE: <RectangleSvg size={18} />,
  TEXTBOX: <TextSvg size={18} />,
  LABEL: <LabelSvg size={18} />,
  CONNECTOR: <ConnectorSvg size={18} />
};

interface Props {
  closeLabel: string;
  onClose: () => void;
  /** Element-type identity shown on the left (title text). */
  title?: string;
  /** Picks the built-in type icon; omit when passing a custom `iconNode`. */
  type?: DeckType;
  /** Custom leading icon (e.g. a node's own icon image). Wins over `type`. */
  iconNode?: React.ReactNode;
}

// Consistent Properties-deck header row (2026-07-02): a left-side element-type
// identity (icon + name) and a close button on the right, over the
// ControlsContainer divider. The identity gives the close button a companion so
// it no longer reads as a lone, orphaned ✕ (deck-UX finding #15), and tells you
// at a glance which element the deck is for. Same chrome for every type
// (ux-principles §5.1).
export const DeckHeader = ({
  closeLabel,
  onClose,
  title,
  type,
  iconNode
}: Props) => {
  const icon = iconNode ?? (type ? TYPE_ICON[type] : null);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.75,
        flexShrink: 0
      }}
    >
      {icon && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: 'text.secondary',
            '& svg': { display: 'block' },
            '& img': { width: 18, height: 18 }
          }}
        >
          {icon}
        </Box>
      )}
      {title && (
        <Typography
          variant="subtitle2"
          sx={{
            color: 'text.secondary',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {title}
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      <Tooltip title={closeLabel}>
        <IconButton size="small" onClick={onClose} sx={{ p: 0.5, flexShrink: 0 }}>
          <CloseIcon sx={{ fontSize: 15 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};
