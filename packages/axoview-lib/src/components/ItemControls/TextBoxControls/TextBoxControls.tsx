import React, { useEffect, useRef } from 'react';
import { ProjectionOrientationEnum } from 'src/types';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Slider,
  IconButton as MUIIconButton,
  TextField
} from '@mui/material';
import {
  TextRotationNone as TextRotationNoneIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useTextBox } from 'src/hooks/useTextBox';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { getIsoProjectionCss } from 'src/utils';
import { useScene } from 'src/hooks/useScene';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { LabelColorPicker } from '../components/LabelColorPicker';
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
          nameRef.current?.focus();
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
      <Box sx={{ position: 'relative', paddingTop: '24px' }}>
        <MUIIconButton
          aria-label={t('close')}
          onClick={() => uiStateActions.setItemControls(null)}
          sx={{ position: 'absolute', top: 16, right: 16, zIndex: 2 }}
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
        <Section title={t('textSize')}>
          <Box sx={{ px: 1 }}>
            <Slider
              marks
              step={0.15}
              min={0.15}
              max={0.9}
              value={textBox.fontSize}
              onChange={(e, newSize) =>
                updateTextBox(textBox.id, { fontSize: newSize as number })
              }
            />
          </Box>
        </Section>
        <Section title={t('textColor')}>
          <LabelColorPicker
            value={textBox.color}
            onChange={(color) => updateTextBox(textBox.id, { color })}
          />
        </Section>
        <Section title={t('alignment')}>
          <ToggleButtonGroup
            value={textBox.orientation}
            exclusive
            onChange={(e, orientation) => {
              if (textBox.orientation === orientation || orientation === null)
                return;
              updateTextBox(textBox.id, { orientation });
            }}
          >
            <ToggleButton value={ProjectionOrientationEnum.X}>
              <TextRotationNoneIcon sx={{ transform: getIsoProjectionCss() }} />
            </ToggleButton>
            <ToggleButton value={ProjectionOrientationEnum.Y}>
              <TextRotationNoneIcon
                sx={{
                  transform: `scale(-1, 1) ${getIsoProjectionCss()} scale(-1, 1)`
                }}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </Section>
      </Box>
    </ControlsContainer>
  );
};
