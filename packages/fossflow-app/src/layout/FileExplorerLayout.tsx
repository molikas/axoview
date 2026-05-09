import { Box } from '@mui/material';

interface Props {
  children: React.ReactNode;
}

// File Explorer is no longer a flex sibling that pushes the canvas — it now
// renders as an absolute overlay inside the canvas container (see App.tsx).
// This component simply provides the main flex region for the canvas.
export function FileExplorerLayout({ children }: Props) {
  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <Box
        component="main"
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
