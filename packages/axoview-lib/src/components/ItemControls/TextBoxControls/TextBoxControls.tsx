import React, { useEffect, useRef } from 'react';
import {
  Box,
  IconButton as MUIIconButton,
  TextField
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useTextBox } from 'src/hooks/useTextBox';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { useTranslation } from 'src/stores/localeStore';

const PANEL_EVENT = 'textBoxPanel';

interface Props {
  id: string;
}

export const TextBoxControls = ({ id }: Props) => {
  const { t } = useTranslation('textBoxControls');
  const uiStateActions = useUiStateStore((state) => state.actions);
  const textBox = useTextBox(id);
  const { updateTextBox } = useScene();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      if (action === 'focusName') {
        requestAnimationFrame(() => {
          nameRef.current?.focus({ preventScroll: true });
          nameRef.current?.select();
        });
      }
    };
    window.addEventListener(PANEL_EVENT, handler);
    return () => window.removeEventListener(PANEL_EVENT, handler);
  }, []);

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
        <Section title={t('name')}>
          <TextField
            inputRef={nameRef}
            placeholder={t('namePlaceholder')}
            value={textBox.name ?? ''}
            size="small"
            fullWidth
            onChange={(e) =>
              updateTextBox(textBox.id, { name: e.target.value || undefined })
            }
          />
        </Section>
        <Section title={t('text')}>
          <RichTextEditor
            value={textBox.content}
            onChange={(html) => updateTextBox(textBox.id, { content: html })}
            height={120}
          />
        </Section>
        {/* Text size, colour + alignment moved to the top-bar style strip
            (TopBarStyleControls): text size + text color + text direction. */}
      </Box>
    </ControlsContainer>
  );
};
