import React from 'react';
import { Box, IconButton as MUIIconButton } from '@mui/material';
import { useRectangle } from 'src/hooks/useRectangle';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { Close as CloseIcon } from '@mui/icons-material';
import { ControlsContainer } from '../components/ControlsContainer';
import { NotesSection } from '../components/NotesSection';
import { MetadataSection } from '../components/MetadataSection';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  id: string;
}

// Rectangle panel (2026-07-02): all visual styling lives on the top-bar style
// strip, so the deck has no "Details" content — it leads with Notes, with the
// identity Name tucked into a collapsed Metadata section (names are Layers-first).
export const RectangleControls = ({ id }: Props) => {
  const { t } = useTranslation('rectangleControls');
  const uiStateActions = useUiStateStore((state) => state.actions);
  const rectangle = useRectangle(id);
  const { updateRectangle } = useScene();

  if (!rectangle) return null;

  return (
    <ControlsContainer>
      <Box sx={{ position: 'relative' }}>
        <MUIIconButton
          aria-label={t('close')}
          onClick={() => uiStateActions.setItemControls(null)}
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}
          size="small"
        >
          <CloseIcon />
        </MUIIconButton>
        <NotesSection
          title={t('notes')}
          value={rectangle.notes}
          onChange={(notes) => updateRectangle(rectangle.id, { notes })}
        />
        <MetadataSection
          title={t('metadata')}
          fieldLabel={t('name')}
          name={rectangle.name ?? ''}
          placeholder={t('namePlaceholder')}
          onChange={(v) =>
            updateRectangle(rectangle.id, { name: v || undefined })
          }
        />
      </Box>
    </ControlsContainer>
  );
};
