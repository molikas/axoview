import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Tooltip,
  Typography
} from '@mui/material';
import {
  Close as CloseIcon,
  DeleteOutline as DeleteIcon,
  FileOpenOutlined as LoadIcon
} from '@mui/icons-material';
import type { DiagramData } from '../diagramUtils';

interface SavedDiagram {
  id: string;
  name: string;
  data: DiagramData;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  diagrams: SavedDiagram[];
  onLoad: (diagram: SavedDiagram) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function LoadDialog({ diagrams, onLoad, onDelete, onClose }: Props) {
  const { t } = useTranslation('app');

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { boxShadow: '0px 10px 20px -2px rgba(0,0,0,0.25)', borderRadius: 2 } }}
    >
      <DialogTitle sx={{ pb: 1, pr: 6 }}>
        <Typography variant="h6" component="span">
          {t('dialog.load.title')}
        </Typography>
        <IconButton
          size="small"
          onClick={onClose}
          sx={{ position: 'absolute', top: 12, right: 12, color: 'text.secondary' }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
        {diagrams.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            {t('dialog.load.noSavedDiagrams')}
          </Typography>
        ) : (
          <List dense disablePadding>
            {diagrams.map((diagram) => (
              <ListItem
                key={diagram.id}
                divider
                disableGutters
                sx={{ py: 0.5 }}
                secondaryAction={
                  <>
                    <Tooltip title={t('dialog.load.btnLoad')} placement="top">
                      <IconButton
                        size="small"
                        onClick={() => onLoad(diagram)}
                        edge="end"
                        sx={{ mr: 0.5 }}
                      >
                        <LoadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('dialog.load.btnDelete')} placement="top">
                      <IconButton
                        size="small"
                        onClick={() => onDelete(diagram.id)}
                        edge="end"
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                }
              >
                <ListItemText
                  primary={diagram.name}
                  secondary={`${t('dialog.load.updated')}: ${new Date(diagram.updatedAt).toLocaleString()}`}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 1 }}>
        <Button variant="text" onClick={onClose}>
          {t('dialog.load.btnClose')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
