import { Box, Button, Stack, Typography } from '@mui/material';
import { GitHub as GitHubIcon } from '@mui/icons-material';

export const AboutTab = () => {
  return (
    <Box sx={{ px: 2, py: 2 }}>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Axoview Community Edition
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
      </Stack>
    </Box>
  );
};
