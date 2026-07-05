import { ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import {
  ComputerOutlined as LocalIcon,
  CloudOutlined as DriveIcon
} from '@mui/icons-material';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { useAuthStore } from '../stores/authStore';

/**
 * Local | Google Drive storage selector (ADR 0036 §6). Rendered only when a
 * Google client id is configured; Drive is disabled until the user is signed in.
 * S3 was dropped 2026-04-29, so this replaces the PLAN 3A three-way picker.
 */
export function StorageProviderPicker() {
  const { runtimeConfig, activeProviderId } = useAppStorage();
  const { switchStorageProvider } = useDiagramLifecycle();
  const authStatus = useAuthStore((s) => s.status);

  const clientId =
    runtimeConfig?.googleClientId || process.env.PUBLIC_GOOGLE_CLIENT_ID || null;
  if (!clientId) return null;

  const driveEnabled = authStatus === 'AUTHENTICATED';

  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={activeProviderId}
      onChange={(_e, val: string | null) => {
        if (val) switchStorageProvider(val);
      }}
      sx={{ '& .MuiToggleButton-root': { px: 0.75, py: 0.25, border: 'none' } }}
    >
      <ToggleButton value="local" data-axoview-id="storage-picker-local">
        <Tooltip title="Local storage">
          <LocalIcon sx={{ fontSize: 16 }} />
        </Tooltip>
      </ToggleButton>
      <ToggleButton
        value="google-drive"
        disabled={!driveEnabled}
        data-axoview-id="storage-picker-drive"
      >
        <Tooltip
          title={driveEnabled ? 'Google Drive' : 'Sign in to use Google Drive'}
        >
          <DriveIcon sx={{ fontSize: 16 }} />
        </Tooltip>
      </ToggleButton>
    </ToggleButtonGroup>
  );
}
