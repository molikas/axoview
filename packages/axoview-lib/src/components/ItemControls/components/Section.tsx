import React from 'react';
import { Box, SxProps, Typography, Stack } from '@mui/material';

interface Props {
  children: React.ReactNode;
  title?: string;
  sx?: SxProps;
}

export const Section = ({ children, sx, title }: Props) => {
  return (
    <Box
      sx={{
        pt: 1.5,
        px: 2,
        ...sx
      }}
    >
      <Stack>
        {title && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mb: 0.75 }}
          >
            {title}
          </Typography>
        )}
        {children}
      </Stack>
    </Box>
  );
};
