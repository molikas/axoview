import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Connector,
  ConnectorLabel,
  connectorStyleOptions,
  connectorLineTypeOptions
} from 'src/types';
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Button,
  Slider,
  Select,
  MenuItem,
  TextField,
  IconButton as MUIIconButton,
  FormControlLabel,
  Switch,
  Typography,
  Paper
} from '@mui/material';
import { useConnector } from 'src/hooks/useConnector';
import { ColorSelector } from 'src/components/ColorSelector/ColorSelector';
import { CustomColorInput } from 'src/components/ColorSelector/CustomColorInput';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  InsertLink as InsertLinkIcon,
  OpenInNew as OpenInNewIcon,
  VisibilityOutlined as ShowLabelIcon,
  VisibilityOffOutlined as HideLabelIcon
} from '@mui/icons-material';
import { getConnectorLabels, generateId } from 'src/utils';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { DeleteButton } from '../components/DeleteButton';
import { LabelColorPicker } from '../components/LabelColorPicker';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';
import { useTranslation } from 'src/stores/localeStore';

const INLINE_EDIT_EVENT = 'inlineEditNodeName';

const TAB_DETAILS = 0;
const TAB_STYLE = 1;
const TAB_NOTES = 2;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, index, value }: TabPanelProps) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    sx={{
      flex: 1,
      overflowY: 'auto',
      display: value === index ? 'flex' : 'none',
      flexDirection: 'column'
    }}
  >
    {value === index && children}
  </Box>
);

interface Props {
  id: string;
}

export const ConnectorControls = ({ id }: Props) => {
  const { t } = useTranslation('connectorControls');
  const uiStateActions = useUiStateStore((state) => state.actions);
  const connector = useConnector(id);
  const { updateConnector, deleteConnector } = useScene();
  const editorMode = useUiStateStore((s) => s.editorMode);

  const [activeTab, setActiveTab] = useState(TAB_DETAILS);
  const [useCustomColor, setUseCustomColor] = useState(!!connector?.customColor);
  const [showLink, setShowLink] = useState(!!connector?.headerLink);
  const nameRef = useRef<HTMLInputElement>(null);

  // F2 from canvas focuses the Name field on the Details tab
  useEffect(() => {
    if (editorMode !== 'EDITABLE') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === id) {
        setActiveTab(TAB_DETAILS);
        requestAnimationFrame(() => {
          nameRef.current?.focus();
          nameRef.current?.select();
        });
      }
    };
    window.addEventListener(INLINE_EDIT_EVENT, handler);
    return () => window.removeEventListener(INLINE_EDIT_EVENT, handler);
  }, [id, editorMode]);

  const labels = useMemo(() => {
    if (!connector) return [];
    return getConnectorLabels(connector);
  }, [connector]);

  const handleAddLabel = useCallback(() => {
    if (!connector || labels.length >= 256) return;
    const newLabel: ConnectorLabel = {
      id: generateId(),
      text: '',
      position: 50,
      height: 0,
      line: '1'
    };
    updateConnector(connector.id, {
      labels: [...labels, newLabel],
      description: undefined,
      startLabel: undefined,
      endLabel: undefined,
      startLabelHeight: undefined,
      centerLabelHeight: undefined,
      endLabelHeight: undefined
    });
  }, [connector, labels, updateConnector]);

  const handleUpdateLabel = useCallback(
    (labelId: string, updates: Partial<ConnectorLabel>) => {
      if (!connector) return;
      const updatedLabels = labels.map((label) =>
        label.id === labelId ? { ...label, ...updates } : label
      );
      updateConnector(connector.id, {
        labels: updatedLabels,
        description: undefined,
        startLabel: undefined,
        endLabel: undefined,
        startLabelHeight: undefined,
        centerLabelHeight: undefined,
        endLabelHeight: undefined
      });
    },
    [connector, labels, updateConnector]
  );

  const handleDeleteLabel = useCallback(
    (labelId: string) => {
      if (!connector) return;
      updateConnector(connector.id, {
        labels: labels.filter((l) => l.id !== labelId),
        description: undefined,
        startLabel: undefined,
        endLabel: undefined,
        startLabelHeight: undefined,
        centerLabelHeight: undefined,
        endLabelHeight: undefined
      });
    },
    [connector, labels, updateConnector]
  );

  if (!connector) return null;

  const isDoubleLineType =
    connector.lineType === 'DOUBLE' || connector.lineType === 'DOUBLE_WITH_CIRCLE';

  const hasNotes =
    !!connector.notes && connector.notes.replace(/<[^>]*>/g, '').trim() !== '';

  return (
    <ControlsContainer>
      <Box
        onMouseDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.stopPropagation()}
        sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }}
      >
        {/* Header: tab bar + close button */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid',
            borderColor: 'divider',
            flexShrink: 0,
            pl: 0.5,
            pr: 0.5
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              flex: 1,
              minHeight: 36,
              '& .MuiTab-root': { minHeight: 36, fontSize: '0.72rem', py: 0.5, px: 1.5 }
            }}
          >
            <Tab label={t('details')} value={TAB_DETAILS} />
            <Tab label={t('style')} value={TAB_STYLE} />
            <Tab
              label={hasNotes ? t('notesModified') : t('notes')}
              value={TAB_NOTES}
              sx={{ color: hasNotes ? 'primary.main' : undefined }}
            />
          </Tabs>
          <Tooltip title={t('close')}>
            <IconButton
              size="small"
              onClick={() => uiStateActions.setItemControls(null)}
              sx={{ p: 0.5, flexShrink: 0 }}
            >
              <CloseIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Details tab */}
        <TabPanel value={activeTab} index={TAB_DETAILS}>
          {/* Name + link + show-name toggles */}
          <Section title={t('name')}>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <TextField
                inputRef={nameRef}
                placeholder={t('namePlaceholder')}
                value={connector.name ?? ''}
                size="small"
                fullWidth
                onChange={(e) =>
                  updateConnector(connector.id, { name: e.target.value || undefined })
                }
              />
              <Tooltip title={showLink ? t('removeLink') : t('addLink')}>
                <IconButton
                  size="small"
                  color={connector.headerLink ? 'primary' : 'default'}
                  onClick={() => {
                    if (showLink && connector.headerLink) {
                      updateConnector(connector.id, { headerLink: undefined });
                    }
                    setShowLink((v) => !v);
                  }}
                >
                  <InsertLinkIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={connector.showLabel === false ? t('showName') : t('hideName')}>
                <IconButton
                  size="small"
                  onClick={() => updateConnector(connector.id, { showLabel: connector.showLabel === false ? undefined : false })}
                >
                  {connector.showLabel === false
                    ? <HideLabelIcon sx={{ fontSize: 18 }} />
                    : <ShowLabelIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
            </Box>
            {showLink && (
              <TextField
                value={connector.headerLink ?? ''}
                placeholder={t('linkPlaceholder')}
                fullWidth
                size="small"
                sx={{ mt: 1 }}
                onChange={(e) =>
                  updateConnector(connector.id, { headerLink: e.target.value || undefined })
                }
              />
            )}
          </Section>

          {/* Additional labels */}
          <Section title={t('additionalLabels')}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddLabel}
                disabled={labels.length >= 256}
                size="small"
                variant="outlined"
              >
                {t('addLabel')}
              </Button>
            </Box>

            {labels.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                {t('noLabels')}
              </Typography>
            )}

              {labels.map((label, index) => (
                <Paper key={label.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1
                    }}
                  >
                    <Typography variant="caption" color="text.secondary">
                      Label {index + 1}
                    </Typography>
                    <MUIIconButton
                      size="small"
                      onClick={() => handleDeleteLabel(label.id)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </MUIIconButton>
                  </Box>

                  <TextField
                    label="Text"
                    value={label.text}
                    onChange={(e) => handleUpdateLabel(label.id, { text: e.target.value })}
                    fullWidth
                    sx={{ mb: 2 }}
                  />

                  <Box sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 0.5
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Position (%)
                      </Typography>
                      <TextField
                        type="number"
                        size="small"
                        value={label.position}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '') {
                            handleUpdateLabel(label.id, { position: 0 });
                            return;
                          }
                          const val = parseInt(inputValue, 10);
                          if (!Number.isNaN(val)) {
                            handleUpdateLabel(label.id, {
                              position: Math.max(0, Math.min(100, val))
                            });
                          }
                        }}
                        onBlur={(e) => {
                          if (e.target.value === '') handleUpdateLabel(label.id, { position: 0 });
                        }}
                        slotProps={{ htmlInput: { min: 0, max: 100 } }}
                        sx={{ width: 70 }}
                      />
                    </Box>
                    <Slider
                      step={1}
                      min={0}
                      max={100}
                      value={label.position}
                      onChange={(_, val) => handleUpdateLabel(label.id, { position: val as number })}
                    />
                    {isDoubleLineType && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Line
                        </Typography>
                        <Select
                          value={label.line || '1'}
                          onChange={(e) =>
                            handleUpdateLabel(label.id, { line: e.target.value as '1' | '2' })
                          }
                          fullWidth
                          size="small"
                        >
                          <MenuItem value="1">Line 1</MenuItem>
                          <MenuItem value="2">Line 2</MenuItem>
                        </Select>
                      </Box>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Height offset
                    </Typography>
                    <Slider
                      marks
                      step={10}
                      min={-100}
                      max={100}
                      value={label.height || 0}
                      onChange={(_, value) => handleUpdateLabel(label.id, { height: value as number })}
                    />
                  </Box>

                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Font size
                    </Typography>
                    <Slider
                      marks
                      step={1}
                      min={8}
                      max={24}
                      value={label.fontSize ?? 12}
                      onChange={(_, value) =>
                        handleUpdateLabel(label.id, { fontSize: value as number })
                      }
                    />
                  </Box>

                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Label color
                    </Typography>
                    <LabelColorPicker
                      value={label.labelColor}
                      onChange={(color) => handleUpdateLabel(label.id, { labelColor: color })}
                    />
                  </Box>

                  <Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={label.showLine !== false}
                          onChange={(e) => handleUpdateLabel(label.id, { showLine: e.target.checked })}
                        />
                      }
                      label="Show dotted line"
                    />
                  </Box>
                </Paper>
              ))}
          </Section>
        </TabPanel>

        {/* Style tab */}
        <TabPanel value={activeTab} index={TAB_STYLE}>
          <Section title={t('color')}>
            <FormControlLabel
              control={
                <Switch
                  checked={useCustomColor}
                  onChange={(e) => {
                    setUseCustomColor(e.target.checked);
                    if (!e.target.checked) updateConnector(connector.id, { customColor: '' });
                  }}
                />
              }
              label={t('useCustomColor')}
              sx={{ mb: 1 }}
            />
            {useCustomColor ? (
              <CustomColorInput
                value={connector.customColor || '#000000'}
                onChange={(color) => updateConnector(connector.id, { customColor: color })}
              />
            ) : (
              <ColorSelector
                onChange={(color) => updateConnector(connector.id, { color, customColor: '' })}
                activeColor={connector.color}
              />
            )}
          </Section>

          <Section title={t('width')}>
            <Slider
              marks
              step={10}
              min={10}
              max={30}
              value={connector.width}
              onChange={(_, newWidth) => updateConnector(connector.id, { width: newWidth as number })}
            />
          </Section>

          <Section title={t('lineStyle')}>
            <Select
              value={connector.style || 'SOLID'}
              onChange={(e) =>
                updateConnector(connector.id, { style: e.target.value as Connector['style'] })
              }
              fullWidth
              size="small"
            >
              {Object.values(connectorStyleOptions).map((style) => {
                const label = style === 'SOLID' ? t('solid')
                  : style === 'DOTTED' ? t('dotted')
                  : t('dashed');
                return (
                  <MenuItem key={style} value={style}>{label}</MenuItem>
                );
              })}
            </Select>
          </Section>

          <Section title={t('lineType')}>
            <Select
              value={connector.lineType || 'SINGLE'}
              onChange={(e) =>
                updateConnector(connector.id, { lineType: e.target.value as Connector['lineType'] })
              }
              fullWidth
              size="small"
            >
              {Object.values(connectorLineTypeOptions).map((type) => {
                const label = type === 'SINGLE' ? t('singleLine')
                  : type === 'DOUBLE' ? t('doubleLine')
                  : t('doubleLineWithCircle');
                return (
                  <MenuItem key={type} value={type}>{label}</MenuItem>
                );
              })}
            </Select>
          </Section>

          <Section>
            <FormControlLabel
              control={
                <Switch
                  checked={connector.showArrow !== false}
                  onChange={(e) => updateConnector(connector.id, { showArrow: e.target.checked })}
                />
              }
              label={t('showArrow')}
            />
          </Section>

          <Section>
            <DeleteButton
              onClick={() => {
                uiStateActions.setItemControls(null);
                deleteConnector(connector.id);
              }}
            />
          </Section>
        </TabPanel>

        {/* Notes tab */}
        <TabPanel value={activeTab} index={TAB_NOTES}>
          <Box sx={{ p: 2 }}>
            <RichTextEditor
              height={300}
              value={connector.notes}
              onChange={(text) => {
                const hasContent = (v?: string) =>
                  !!v && v.replace(/<[^>]*>/g, '').trim() !== '';
                const empty = !hasContent(text);
                if (empty && !hasContent(connector.notes)) return;
                if (connector.notes !== text)
                  updateConnector(connector.id, { notes: empty ? undefined : text });
              }}
            />
          </Box>
        </TabPanel>
      </Box>
    </ControlsContainer>
  );
};
