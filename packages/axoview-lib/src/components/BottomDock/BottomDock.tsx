import React from 'react';
import type { ReactNode } from 'react';
import { Box, Chip, IconButton, Tooltip } from '@mui/material';
import { ZoomControls } from 'src/components/ZoomControls/ZoomControls';
import { ViewTabs } from 'src/components/ViewTabs/ViewTabs';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { DialogTypeEnum } from 'src/types/ui';
import { useTranslation } from 'src/stores/localeStore';
import { countUserFacingRefs } from 'src/utils/connectorSelection';

// Lucid-style help icon: circle with question mark
const HelpSvg = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="none"
    viewBox="0 0 16 16"
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M14 8A6 6 0 1 1 2 8a6 6 0 0 1 12 0Zm1 0A7 7 0 1 1 1 8a7 7 0 0 1 14 0ZM8 5c-1.15 0-1.81.72-2.01 1.61A.5.5 0 1 1 5 6.39 2.95 2.95 0 0 1 8 4c.78 0 1.52.18 2.08.6.58.43.92 1.08.92 1.9 0 .62-.2 1.09-.51 1.45-.3.35-.69.57-1 .74l-.22.12a3.5 3.5 0 0 0-.57.33c-.15.12-.2.22-.2.36a.5.5 0 0 1-1 0c0-.53.26-.89.58-1.14.23-.18.52-.34.77-.47l.16-.08c.31-.16.55-.32.72-.51.16-.18.27-.42.27-.8 0-.51-.2-.86-.52-1.1C9.15 5.15 8.64 5 8 5Zm.75 6.5a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
      clipRule="evenodd"
    />
  </svg>
);

const btnSx = {
  borderRadius: 1,
  p: 0.5,
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }
} as const;

interface BottomDockProps {
  endSlot?: ReactNode;
}

export const BottomDock = ({ endSlot }: BottomDockProps = {}) => {
  // D6 — reuse the already-translated (previously orphaned) zoomControls.help
  // key instead of the hardcoded "Help (F1)". The value already carries the
  // "(F1)" suffix, so it is used as the full tooltip text.
  const { t } = useTranslation('zoomControls');
  const uiStateActions = useUiStateStore((s) => s.actions);
  // Count user-facing refs only — waypoint CONNECTOR_ANCHORs are bookkeeping,
  // not items the user thinks they selected. See utils/connectorSelection.
  const selectedCount = useUiStateStore((s) =>
    countUserFacingRefs(s.selectedIds)
  );

  return (
    <Box
      // Chrome sits above the canvas at a higher z-index than the annotation
      // overlay, so a stray draw-drag onto the dock would otherwise start a
      // native selection/drag (e.g. the ViewTabs page name) and paint a ghost —
      // the same top-bar corruption, on the bottom bar. Suppress text selection
      // and swallow any bubbled dragstart. Matches AppToolbar's guard.
      onDragStart={(e) => e.preventDefault()}
      sx={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 40,
        bgcolor: 'background.paper',
        borderTop: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 1.5,
        zIndex: 20,
        userSelect: 'none'
      }}
    >
      {/* Left zone: page selector (ViewTabs) + multi-selection feedback */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minHeight: 24,
          minWidth: 0,
          overflow: 'hidden'
        }}
      >
        <ViewTabs />
        {selectedCount > 1 && (
          <Chip
            label={t('selected').replace('{count}', String(selectedCount))}
            size="small"
            color="primary"
            sx={{
              height: 24,
              fontWeight: 500,
              userSelect: 'none',
              flexShrink: 0,
              '& .MuiChip-label': { px: 1.25 }
            }}
          />
        )}
      </Box>

      {/* Right zone: zoom controls + help + optional end slot */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <ZoomControls />
        <Tooltip title={t('help')} placement="top">
          <IconButton
            size="small"
            onClick={() => uiStateActions.setDialog(DialogTypeEnum.HELP)}
            data-axoview-id="dock-help"
            sx={btnSx}
          >
            <HelpSvg />
          </IconButton>
        </Tooltip>
        {endSlot}
      </Box>
    </Box>
  );
};
