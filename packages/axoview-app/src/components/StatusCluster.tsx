import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import {
  SyncOutlined as SavingIcon,
  ErrorOutlineOutlined as SaveErrorIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { SessionStorageGauge } from './fileExplorer/SessionStorageGauge';

const formatSavedAt = (d: Date, t: TFunction): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dDay.getTime() === today.getTime()) return t('status.savedAt', { time });
  if (dDay.getTime() === yesterday.getTime()) return t('status.savedYesterdayAt', { time });
  const month = d.toLocaleString([], { month: 'short' });
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) return t('status.savedOnDate', { month, day, time });
  return t('status.savedOnDateYear', { month, day, year: d.getFullYear(), time });
};

export function StatusCluster() {
  const { t } = useTranslation('app');
  const { serverStorageAvailable } = useAppStorage();
  const { hasUnsavedChanges, lastSaved, saveStatus, handleSaveClick } = useDiagramLifecycle();

  if (serverStorageAvailable) {
    // Server mode: auto-save status only
    const content = (() => {
      if (saveStatus === 'saving') {
        return (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <SavingIcon sx={{ fontSize: 13, color: 'text.disabled', animation: 'spin 1s linear infinite', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
            <Typography variant="caption" sx={{ color: 'text.disabled', userSelect: 'none' }}>
              {t('status.saving', 'Saving…')}
            </Typography>
          </Stack>
        );
      }
      if (saveStatus === 'error') {
        return (
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <SaveErrorIcon sx={{ fontSize: 13, color: 'error.main' }} />
            <Typography variant="caption" sx={{ color: 'error.main', userSelect: 'none' }}>
              {t('status.saveFailed', 'Save failed')}
            </Typography>
            <Button
              size="small"
              variant="text"
              color="error"
              sx={{ minWidth: 0, px: 0.5, py: 0, textTransform: 'none', lineHeight: 1.5 }}
              onClick={handleSaveClick}
            >
              {t('status.retry', 'Retry')}
            </Button>
          </Stack>
        );
      }
      if (lastSaved) {
        return (
          <Typography variant="caption" sx={{ color: 'text.disabled', userSelect: 'none', whiteSpace: 'nowrap' }}>
            {formatSavedAt(lastSaved, t)}
          </Typography>
        );
      }
      return null;
    })();

    if (!content) return null;
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5 }}>
        {content}
      </Box>
    );
  }

  // Session mode: save state text + SESSION chip + storage gauge.
  // The orange SESSION chip already conveys mode; no wrapper background.
  const saveText = lastSaved
    ? `${formatSavedAt(lastSaved, t)}${hasUnsavedChanges ? ' •' : ''}`
    : hasUnsavedChanges
      ? t('status.unsaved', 'Unsaved')
      : '';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.5
      }}
    >
      {saveText && (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            userSelect: 'none'
          }}
        >
          {saveText}
        </Typography>
      )}
      <Chip
        label={<Typography variant="micro" component="span">Session</Typography>}
        size="small"
        sx={{
          height: 16,
          bgcolor: 'warning.dark',
          color: 'warning.contrastText',
          '& .MuiChip-label': { px: 0.5 }
        }}
      />
      <SessionStorageGauge />
    </Box>
  );
}
