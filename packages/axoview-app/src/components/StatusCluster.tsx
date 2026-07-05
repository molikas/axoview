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

const formatSavedAt = (d: Date, t: TFunction, locale: string): string => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // L3: format the clock + month in the UI language (i18n.language is BCP-47:
  // en-US, de-DE, …), not the OS locale (`[]`), so a French UI shows 24-hour
  // time + French month abbreviations.
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (dDay.getTime() === today.getTime()) return t('status.savedAt', { time });
  if (dDay.getTime() === yesterday.getTime()) return t('status.savedYesterdayAt', { time });
  const month = d.toLocaleString(locale, { month: 'short' });
  const day = d.getDate();
  if (d.getFullYear() === now.getFullYear()) return t('status.savedOnDate', { month, day, time });
  return t('status.savedOnDateYear', { month, day, year: d.getFullYear(), time });
};

export function StatusCluster() {
  const { t, i18n } = useTranslation('app');
  const { remoteStorageActive } = useAppStorage();
  const { hasUnsavedChanges, lastSaved, saveStatus, handleSaveClick } = useDiagramLifecycle();

  if (remoteStorageActive) {
    // Remote storage (server or Drive): auto-save status only
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
            {formatSavedAt(lastSaved, t, i18n.language)}
          </Typography>
        );
      }
      return null;
    })();

    if (!content) return null;
    // Reserve a stable width so the toolbar doesn't expand/contract as the
    // status cycles "Saving…" ↔ "Saved at HH:MM" (the right group is
    // right-anchored, so any width change here shifts the style strip).
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          px: 0.5,
          minWidth: '9.5em'
        }}
      >
        {content}
      </Box>
    );
  }

  // Session mode: save state text + SESSION chip + storage gauge.
  // The orange SESSION chip already conveys mode; no wrapper background.
  // The unsaved-changes bullet is rendered with reserved space (visibility,
  // not conditional mount) so it appearing/disappearing doesn't change the
  // text width and jitter the toolbar.
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.5
      }}
    >
      {lastSaved ? (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            userSelect: 'none'
          }}
        >
          {formatSavedAt(lastSaved, t, i18n.language)}
          <Box
            component="span"
            sx={{ visibility: hasUnsavedChanges ? 'visible' : 'hidden' }}
          >
            {' •'}
          </Box>
        </Typography>
      ) : hasUnsavedChanges ? (
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            whiteSpace: 'nowrap',
            userSelect: 'none'
          }}
        >
          {t('status.unsaved', 'Unsaved')}
        </Typography>
      ) : null}
      <Chip
        label={<Typography variant="micro" component="span">{t('status.session', 'Session')}</Typography>}
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
