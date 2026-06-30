import React from 'react';
import { Box, IconButton as MUIIconButton, TextField } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useLabel } from 'src/hooks/useLabel';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  id: string;
}

// Floating Label panel (ADR 0031). Details/Notes parity, no Style tab — all
// visual styling (size / colour / B/I/S / background) lives on the top-bar style
// strip (ADR 0030). A Label has ONE edit model: plain text + whole-chip B/I/S,
// so the panel is a single plain-text field (no rich-text editor — that, plus the
// retired textBox `variant:'label'` rich-HTML branch, is the two-layer-formatting
// fix). The label's `text` is also its identity (Layers / info popover).
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
        {/* All styling (text size/colour, B/I/S, background) lives on the
            top-bar style strip (TopBarStyleControls) — ADR 0030. */}
      </Box>
    </ControlsContainer>
  );
};
