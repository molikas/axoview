import React from 'react';
import { Box, IconButton as MUIIconButton, TextField } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useLabel } from 'src/hooks/useLabel';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { NotesSection } from '../components/NotesSection';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  id: string;
}

// Floating Label panel (ADR 0031). A Label's `text` is BOTH its on-canvas
// content and its identity (Layers / info popover), so there is no separate
// Name/Metadata section — the Text field is it. All visual styling lives on the
// top-bar style strip (ADR 0030). Notes added 2026-07-02 (parity with all
// elements). The chip is also editable inline on canvas (double-click / F2).
export const LabelControls = ({ id }: Props) => {
  const { t } = useTranslation('textBoxControls');
  const uiStateActions = useUiStateStore((state) => state.actions);
  const label = useLabel(id);
  const { updateLabel } = useScene();

  if (!label) return null;

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
        <Section title={t('text')}>
          <TextField
            placeholder={t('namePlaceholder')}
            value={label.text}
            size="small"
            fullWidth
            multiline
            minRows={1}
            maxRows={6}
            onChange={(e) => updateLabel(label.id, { text: e.target.value })}
          />
        </Section>
        <NotesSection
          title={t('notes')}
          value={label.notes}
          onChange={(notes) => updateLabel(label.id, { notes })}
        />
      </Box>
    </ControlsContainer>
  );
};
