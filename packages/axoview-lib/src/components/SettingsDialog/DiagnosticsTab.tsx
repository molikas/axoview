import { Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import {
  FileDownloadOutlined as DumpIcon,
  DataObjectOutlined as JsonIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { exportAsJSON } from 'src/utils/exportOptions';
import { modelFromModelStore } from 'src/utils';

interface DiagnosticsTabProps {
  onSessionDump?: () => void;
}

export const DiagnosticsTab = ({ onSessionDump }: DiagnosticsTabProps) => {
  const enableDebugTools = useUiStateStore((s) => s.enableDebugTools);
  const setEnableDebugTools = useUiStateStore((s) => s.actions.setEnableDebugTools);
  const model = useModelStore((s) => modelFromModelStore(s));

  const handleModelDump = () => {
    exportAsJSON(model);
  };

  return (
    <Box sx={{ px: 2, py: 2 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Debug overlay
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={enableDebugTools}
                onChange={(e) => setEnableDebugTools(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2">
                Enable debug overlay
              </Typography>
            }
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Shows tile grid, coordinates, and store state at the canvas bottom-left.
          </Typography>
        </Box>

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Downloads
          </Typography>
          <Stack spacing={1} direction="row" flexWrap="wrap">
            <Button
              size="small"
              variant="outlined"
              startIcon={<JsonIcon sx={{ fontSize: 14 }} />}
              onClick={handleModelDump}
            >
              Download model JSON
            </Button>
            {onSessionDump && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<DumpIcon sx={{ fontSize: 14 }} />}
                onClick={onSessionDump}
              >
                Download session dump
              </Button>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};
