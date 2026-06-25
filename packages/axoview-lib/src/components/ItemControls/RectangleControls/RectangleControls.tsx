import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton as MUIIconButton,
  FormControlLabel,
  Switch,
  TextField
} from '@mui/material';
import { useRectangle } from 'src/hooks/useRectangle';
import { ColorSelector } from 'src/components/ColorSelector/ColorSelector';
import { CustomColorInput } from 'src/components/ColorSelector/CustomColorInput';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { Close as CloseIcon } from '@mui/icons-material';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { useTranslation } from 'src/stores/localeStore';

const PANEL_EVENT = 'rectanglePanel';

interface Props {
  id: string;
}

export const RectangleControls = ({ id }: Props) => {
  const { t } = useTranslation('rectangleControls');
  const uiStateActions = useUiStateStore((state) => state.actions);
  const rectangle = useRectangle(id);
  const { updateRectangle } = useScene();
  const [useCustomColor, setUseCustomColor] = useState(!!rectangle?.customColor);
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
        <Section title={t('name')}>
          <TextField
            inputRef={nameRef}
            placeholder={t('namePlaceholder')}
            value={rectangle.name ?? ''}
            size="small"
            fullWidth
            onChange={(e) =>
              updateRectangle(rectangle.id, { name: e.target.value || undefined })
            }
          />
        </Section>
        <Section title={t('color')}>
          <FormControlLabel
            control={
              <Switch
                checked={useCustomColor}
                onChange={(e) => {
                  setUseCustomColor(e.target.checked);
                  if (!e.target.checked) {
                    updateRectangle(rectangle.id, { customColor: '' });
                  }
                }}
              />
            }
            label={t('useCustomColor')}
            sx={{ mb: 2 }}
          />
          {useCustomColor ? (
            <CustomColorInput
              value={rectangle.customColor || '#000000'}
              onChange={(color) =>
                updateRectangle(rectangle.id, { customColor: color })
              }
            />
          ) : (
            <ColorSelector
              onChange={(color) =>
                updateRectangle(rectangle.id, { color, customColor: '' })
              }
              activeColor={rectangle.color}
            />
          )}
        </Section>
      </Box>
    </ControlsContainer>
  );
};
