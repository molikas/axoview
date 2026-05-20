import { Box, Button, Divider, Link, Stack, Typography } from '@mui/material';
import { GitHub as GitHubIcon } from '@mui/icons-material';

export const AboutTab = () => {
  return (
    <Box sx={{ px: 2, py: 2 }}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Axoview
        </Typography>
        <Typography variant="body2">
          Version: <strong>v{PACKAGE_VERSION}</strong>
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<GitHubIcon />}
          onClick={() => window.open(REPOSITORY_URL, '_blank', 'noopener,noreferrer')}
          sx={{ alignSelf: 'flex-start' }}
        >
          View on GitHub
        </Button>
        <Divider sx={{ my: 1 }} />
        <Stack spacing={0.75}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Lineage &amp; attribution
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Forked from{' '}
            <Link
              href="https://github.com/stan-smith/FossFLOW"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
            >
              FossFLOW
            </Link>
            , itself forked from{' '}
            <Link
              href="https://github.com/markmanx/isoflow"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
            >
              Isoflow
            </Link>
            .
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Bundled icon collections (AWS, GCP, Azure, Kubernetes, core) ship via{' '}
            <Link
              href="https://github.com/markmanx/isoflow"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
            >
              @isoflow/isopacks
            </Link>{' '}
            and remain attributed to the Isoflow project.
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
};
