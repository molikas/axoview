import React from 'react';
import { Box, IconButton as MUIIconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTextBox } from 'src/hooks/useTextBox';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { NotesSection } from '../components/NotesSection';
import { MetadataSection } from '../components/MetadataSection';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  id: string;
}

// Text panel (2026-07-02): the on-canvas rich text (`content`) is the primary
// Details content; Notes and the collapsed Metadata (identity Name) follow, so
// name handling matches every other element.
export const TextBoxControls = ({ id }: Props) => {
  const { t } = useTranslation('textBoxControls');
  const uiStateActions = useUiStateStore((state) => state.actions);
  const textBox = useTextBox(id);
  const { updateTextBox } = useScene();

  if (!textBox) return null;

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
          <RichTextEditor
            value={textBox.content}
            onChange={(html) => updateTextBox(textBox.id, { content: html })}
            height={120}
            contentStyle={{
              fontWeight: textBox.isBold ? 700 : undefined,
              fontStyle: textBox.isItalic ? 'italic' : undefined
            }}
          />
        </Section>
        <NotesSection
          title={t('notes')}
          value={textBox.notes}
          onChange={(notes) => updateTextBox(textBox.id, { notes })}
        />
        <MetadataSection
          title={t('metadata')}
          name={textBox.name ?? ''}
          placeholder={t('namePlaceholder')}
          onChange={(v) => updateTextBox(textBox.id, { name: v || undefined })}
        />
        {/* All styling lives on the top-bar style strip (TopBarStyleControls). */}
      </Box>
    </ControlsContainer>
  );
};
