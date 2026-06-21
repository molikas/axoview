import React, { useState } from 'react';
import { Box, Divider, Stack, Typography, Button, alpha } from '@mui/material';
import {
  ExpandMore as ChevronDownIcon,
  ExpandLess as ChevronUpIcon
} from '@mui/icons-material';
import { Icon as IconI } from 'src/types';
import { Section } from 'src/components/ItemControls/components/Section';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { IconGrid } from './IconGrid';

// Collections larger than this render a limited preview to avoid freezing the
// browser with thousands of DOM nodes. Users can use the search box instead.
const LARGE_PACK_THRESHOLD = 100;
const PREVIEW_COUNT = 60;

interface Props {
  id?: string;
  icons: IconI[];
  onClick?: (icon: IconI) => void;
  onMouseDown?: (icon: IconI) => void;
  /** Per-icon delete handler — Icon.tsx only renders the badge for imported icons */
  onDelete?: (icon: IconI) => void;
  deleteTooltip?: string;
  /** C2 / Decision #7 — Enter/Space keyboard placement, forwarded to the grid. */
  onActivate?: (icon: IconI) => void;
  isExpanded: boolean;
}

export const IconCollection = ({
  id,
  icons,
  onClick,
  onMouseDown,
  onDelete,
  deleteTooltip,
  onActivate,
  isExpanded: _isExpanded
}: Props) => {
  const [isExpanded, setIsExpanded] = useState(_isExpanded);
  const isLargePack = icons.length > LARGE_PACK_THRESHOLD;
  const isFreshlyLoaded = useUiStateStore((s) =>
    id ? s.freshlyLoadedCategoryIds.includes(id) : false
  );

  return (
    <Section sx={{ py: 0 }}>
      <Button
        variant="text"
        fullWidth
        sx={(theme) => ({
          py: 0.5,
          minHeight: 32,
          ...(isFreshlyLoaded && {
            animation: 'axoviewIconPulse 1.6s ease-out 1',
            '@keyframes axoviewIconPulse': {
              '0%': { backgroundColor: 'transparent' },
              '20%': {
                backgroundColor: alpha(theme.palette.primary.main, 0.18)
              },
              '100%': { backgroundColor: 'transparent' }
            }
          })
        })}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Stack
          sx={{ width: '100%' }}
          direction="row"
          spacing={1}
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography
            variant="overline"
            color="text.secondary"
          >
            {/* Capitalize first char only — preserves TLA casing in upstream
                pack ids like "AWS", "GCP" while rendering "isoflow" → "Axoview". */}
            {id ? id.charAt(0).toUpperCase() + id.slice(1) : id}
            {isLargePack && (
              <Typography
                component="span"
                variant="caption"
                color="text.disabled"
                sx={{ ml: 0.5, fontSize: 10, textTransform: 'none', fontWeight: 400 }}
              >
                ({icons.length})
              </Typography>
            )}
          </Typography>
          {isExpanded ? (
            <ChevronUpIcon color="action" sx={{ fontSize: 16 }} />
          ) : (
            <ChevronDownIcon color="action" sx={{ fontSize: 16 }} />
          )}
        </Stack>
      </Button>
      <Divider />

      {isExpanded && (
        <Box sx={{ py: 0.5, px: 0.5 }}>
          <IconGrid
            icons={isLargePack ? icons.slice(0, PREVIEW_COUNT) : icons}
            onMouseDown={onMouseDown}
            onClick={onClick}
            onDelete={onDelete}
            deleteTooltip={deleteTooltip}
            onActivate={onActivate}
          />
          {isLargePack && (
            <Typography
              variant="caption"
              color="text.disabled"
              display="block"
              sx={{ mt: 0.5, px: 0.5, fontSize: 10, lineHeight: 1.4 }}
            >
              Showing {PREVIEW_COUNT} of {icons.length} — use search to find more
            </Typography>
          )}
        </Box>
      )}
    </Section>
  );
};
