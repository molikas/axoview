import { Box, Button, Paper } from '@mui/material';
import { AddCircleOutline as AddIcon, FileUploadOutlined as ImportIcon } from '@mui/icons-material';

const SKY_BLUE = '#0ea5e9';

const isoGridBackground = {
  backgroundImage: [
    'repeating-linear-gradient(30deg,  rgba(128,128,128,0.13) 0, rgba(128,128,128,0.13) 1px, transparent 0, transparent 28px)',
    'repeating-linear-gradient(150deg, rgba(128,128,128,0.13) 0, rgba(128,128,128,0.13) 1px, transparent 0, transparent 28px)'
  ].join(', ')
} as const;

const cardSx = {
  width: 220,
  py: 4,
  px: 3,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 2,
  borderRadius: 3
} as const;

const buttonSx = {
  bgcolor: SKY_BLUE,
  '&:hover': { bgcolor: '#0284c7' },
  px: 4,
  borderRadius: 2,
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '1rem'
} as const;

interface Props {
  onCreate: () => void;
  onImport: () => void;
}

export function EmptyStateScreen({ onCreate, onImport }: Props) {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: 'background.default',
        backgroundImage: isoGridBackground.backgroundImage,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3
      }}
    >
      <Paper elevation={3} sx={cardSx}>
        <AddIcon sx={{ fontSize: 72, color: SKY_BLUE }} />
        <Button
          variant="contained"
          size="large"
          onClick={onCreate}
          data-axoview-id="screen-empty-create"
          sx={buttonSx}
        >
          New diagram
        </Button>
      </Paper>

      <Paper elevation={3} sx={cardSx}>
        <ImportIcon sx={{ fontSize: 72, color: SKY_BLUE }} />
        <Button
          variant="contained"
          size="large"
          onClick={onImport}
          data-axoview-id="screen-empty-import"
          sx={buttonSx}
        >
          Import
        </Button>
      </Paper>
    </Box>
  );
}
