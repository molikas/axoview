import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ConnectorLabel } from 'src/types';
import {
  Box,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Button,
  Select,
  MenuItem,
  TextField,
  IconButton as MUIIconButton,
  FormControlLabel,
  Switch,
  Typography,
  Paper,
  Collapse,
  Chip
} from '@mui/material';
import { useConnector } from 'src/hooks/useConnector';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { stripHtmlTags } from 'src/utils/stripHtml';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  InsertLink as InsertLinkIcon,
  VisibilityOutlined as ShowLabelIcon,
  VisibilityOffOutlined as HideLabelIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { getConnectorLabels, generateId } from 'src/utils';
import { ControlsContainer } from '../components/ControlsContainer';
import { Section } from '../components/Section';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';
import { useTranslation } from 'src/stores/localeStore';

const INLINE_EDIT_EVENT = 'inlineEditNodeName';
const PANEL_EVENT = 'connectorPanel';

const TAB_DETAILS = 0;
const TAB_NOTES = 1;

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
      overflowX: 'hidden',
      display: value === index ? 'flex' : 'none',
      flexDirection: 'column'
    }}
  >
    {value === index && children}
  </Box>
);

// Connector line style/type previews + the Style tab moved out: those controls
// now live in the top-bar style strip (TopBarStyleControls). The Details tab
// still reads connector.lineType (label line placement), it just no longer edits it.

interface Props {
  id: string;
}

export const ConnectorControls = ({ id }: Props) => {
  const { t } = useTranslation('connectorControls');
  const uiStateActions = useUiStateStore((state) => state.actions);
  const connector = useConnector(id);
  const { updateConnector } = useScene();
  const editorMode = useUiStateStore((s) => s.editorMode);
  // Per-label selection (shared with the canvas + top-bar style strip): clicking
  // a label card here selects it so the top bar targets it and the canvas
  // highlights it. Position/size/colour are set on the canvas + top bar now.
  const selectedConnectorLabel = useUiStateStore(
    (s) => s.selectedConnectorLabel
  );

  const [activeTab, setActiveTab] = useState(TAB_DETAILS);
  const [showLink, setShowLink] = useState(!!connector?.headerLink);
  // Option A: positioned labels[] are the advanced/power surface, demoted behind
  // a disclosure so the single `name` (the midpoint label) is the obvious path.
  // Start expanded only when the connector already has labels, so existing
  // power-user content isn't hidden.
  const [showAdvanced, setShowAdvanced] = useState(
    () => (connector?.labels?.length ?? 0) > 0
  );
  const nameRef = useRef<HTMLInputElement>(null);

  // F2 from canvas focuses the Name field on the Details tab
  useEffect(() => {
    if (editorMode !== 'EDITABLE') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === id) {
        setActiveTab(TAB_DETAILS);
        requestAnimationFrame(() => {
          nameRef.current?.focus({ preventScroll: true });
          nameRef.current?.select();
        });
      }
    };
    window.addEventListener(INLINE_EDIT_EVENT, handler);
    return () => window.removeEventListener(INLINE_EDIT_EVENT, handler);
  }, [id, editorMode]);

  // Action bar panel events (Style, Edit name, Notes)
  useEffect(() => {
    const handler = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      if (action === 'focusName') {
        setActiveTab(TAB_DETAILS);
        requestAnimationFrame(() => {
          nameRef.current?.focus({ preventScroll: true });
          nameRef.current?.select();
        });
      } else if (action === 'focusLink') {
        setActiveTab(TAB_DETAILS);
      } else if (action === 'focusNotes') {
        setActiveTab(TAB_NOTES);
      }
    };
    window.addEventListener(PANEL_EVENT, handler);
    return () => window.removeEventListener(PANEL_EVENT, handler);
  }, []);

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
    uiStateActions.setSelectedConnectorLabel({
      connectorId: connector.id,
      labelId: newLabel.id
    });
    // Edit the new label inline on canvas; empty text on commit discards it, so
    // an accidental add never leaves a blank label. (The card below also lets
    // you type the text.)
    requestAnimationFrame(() =>
      window.dispatchEvent(
        new CustomEvent('inlineEditConnectorLabel', {
          detail: { connectorId: connector.id, labelId: newLabel.id }
        })
      )
    );
  }, [connector, labels, updateConnector, uiStateActions]);

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
    !!connector.notes && stripHtmlTags(connector.notes).trim() !== '';

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
              '& .MuiTab-root': { minHeight: 36, py: 0.5, px: 1.5 }
            }}
          >
            <Tab label={t('details')} value={TAB_DETAILS} />
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

          {/* Advanced labels — positioned, styled labels along the path. Demoted
              behind a disclosure (Option A) so the single `name` (the midpoint
              label) is the obvious path. Auto-expanded when labels already
              exist so power-user content isn't hidden. */}
          <Section title={t('additionalLabels')}>
            <Button
              fullWidth
              size="small"
              onClick={() => setShowAdvanced((v) => !v)}
              startIcon={
                <ExpandMoreIcon
                  sx={{
                    transition: 'transform 150ms ease',
                    transform: showAdvanced ? 'rotate(180deg)' : 'none'
                  }}
                />
              }
              sx={{ justifyContent: 'flex-start', textTransform: 'none', mb: 1 }}
            >
              {showAdvanced ? t('hideLabel') : t('showLabel')}
              {labels.length > 0 && (
                <Chip size="small" label={labels.length} sx={{ ml: 1, height: 18 }} />
              )}
            </Button>

            <Collapse in={showAdvanced} unmountOnExit>
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

              {labels.length > 0 && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 1 }}
                >
                  Drag a label on the canvas to position it; use the top bar for
                  its text size and colour.
                </Typography>
              )}

              {labels.map((label, index) => {
                const isSelected =
                  selectedConnectorLabel?.connectorId === connector.id &&
                  selectedConnectorLabel.labelId === label.id;
                return (
                  <Paper
                    key={label.id}
                    variant="outlined"
                    onClick={() =>
                      uiStateActions.setSelectedConnectorLabel({
                        connectorId: connector.id,
                        labelId: label.id
                      })
                    }
                    sx={{
                      p: 2,
                      mb: 2,
                      cursor: 'pointer',
                      ...(isSelected
                        ? { outline: '2px solid', outlineColor: 'primary.main' }
                        : {})
                    }}
                  >
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteLabel(label.id);
                        }}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </MUIIconButton>
                    </Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mb: 0.5, display: 'block' }}
                    >
                      Text
                    </Typography>
                    <TextField
                      value={label.text}
                      onChange={(e) =>
                        handleUpdateLabel(label.id, { text: e.target.value })
                      }
                      // A label with no text has no reason to exist: clearing it
                      // and blurring removes the label (matches the canvas
                      // inline-edit behaviour).
                      onBlur={() => {
                        if (!label.text.trim()) handleDeleteLabel(label.id);
                      }}
                      fullWidth
                      size="small"
                      sx={{ mb: isDoubleLineType ? 2 : 1 }}
                    />

                    {isDoubleLineType && (
                      <Box sx={{ mb: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          Line
                        </Typography>
                        <Select
                          value={label.line || '1'}
                          onChange={(e) =>
                            handleUpdateLabel(label.id, {
                              line: e.target.value as '1' | '2'
                            })
                          }
                          fullWidth
                          size="small"
                        >
                          <MenuItem value="1">Line 1</MenuItem>
                          <MenuItem value="2">Line 2</MenuItem>
                        </Select>
                      </Box>
                    )}

                    <Box>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={label.showLine !== false}
                            onChange={(e) =>
                              handleUpdateLabel(label.id, {
                                showLine: e.target.checked
                              })
                            }
                          />
                        }
                        label="Show dotted line"
                      />
                    </Box>
                  </Paper>
                );
              })}
            </Collapse>
          </Section>
        </TabPanel>

        {/* Style tab removed — colour, width, line style/type and show-arrow now
            live in the top-bar style strip (TopBarStyleControls). */}

        {/* Notes tab */}
        <TabPanel value={activeTab} index={TAB_NOTES}>
          <Box sx={{ p: 2 }}>
            <RichTextEditor
              height={300}
              value={connector.notes}
              onChange={(text) => {
                const hasContent = (v?: string) =>
                  !!v && stripHtmlTags(v).trim() !== '';
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
