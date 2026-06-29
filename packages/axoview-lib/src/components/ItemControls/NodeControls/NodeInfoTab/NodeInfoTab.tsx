import React, { useCallback } from 'react';
import {
  Stack,
  TextField,
  IconButton,
  Tooltip,
  Typography,
  Box,
  Autocomplete
} from '@mui/material';
import {
  InsertLink as InsertLinkIcon,
  OpenInNew as OpenInNewIcon,
  VisibilityOutlined as ShowNameIcon,
  VisibilityOffOutlined as HideNameIcon
} from '@mui/icons-material';
import { ModelItem, ViewItem } from 'src/types';
import { useModelItem } from 'src/hooks/useModelItem';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { Section } from '../../components/Section';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  node: ViewItem;
  readOnly?: boolean;
  onModelItemUpdated: (updates: Partial<ModelItem>) => void;
  onViewItemUpdated?: (updates: Partial<ViewItem>) => void;
  nameRef?: React.RefObject<HTMLInputElement | null>;
  linkRef?: React.RefObject<HTMLInputElement | null>;
  showLink: boolean;
  onShowLinkChange: (show: boolean) => void;
}

export const NodeInfoTab = ({
  node,
  readOnly,
  onModelItemUpdated,
  onViewItemUpdated,
  nameRef,
  linkRef,
  showLink,
  onShowLinkChange
}: Props) => {
  const { t } = useTranslation('nodeInfoTab');
  const { t: tPanel } = useTranslation('nodePanel');
  const modelItem = useModelItem(node.id);
  const linkedDiagrams = useUiStateStore((s) => s.linkedDiagrams);

  const handleToggleLink = useCallback(() => {
    if (showLink && modelItem?.headerLink) {
      onModelItemUpdated({ headerLink: undefined });
    }
    onShowLinkChange(!showLink);
  }, [showLink, modelItem?.headerLink, onModelItemUpdated, onShowLinkChange]);

  if (!modelItem) return null;

  if (readOnly) {
    return (
      <Stack>
        {/* Name */}
        <Section title={t('name')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
              {modelItem.name || '—'}
            </Typography>
            {modelItem.headerLink && (
              <Tooltip title={t('openLink')}>
                <IconButton
                  size="small"
                  component="a"
                  href={
                    /^https?:\/\//i.test(modelItem.headerLink)
                      ? modelItem.headerLink
                      : `https://${modelItem.headerLink}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ p: 0.5 }}
                >
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Section>
      </Stack>
    );
  }

  return (
    <Stack>
      {/* Name */}
      <Section title={t('name')}>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <TextField
            inputRef={nameRef}
            value={modelItem.name}
            fullWidth
            placeholder={t('namePlaceholder')}
            size="small"
            onChange={(e) => {
              const text = e.target.value;
              if (modelItem.name !== text) onModelItemUpdated({ name: text });
            }}
          />
          <Tooltip title={showLink ? t('removeLink') : t('addLink')}>
            <IconButton
              size="small"
              color={modelItem.headerLink ? 'primary' : 'default'}
              onClick={handleToggleLink}
            >
              <InsertLinkIcon />
            </IconButton>
          </Tooltip>
          {onViewItemUpdated && (
            <Tooltip title={node.showLabel === false ? tPanel('showName') : tPanel('hideName')}>
              <IconButton
                size="small"
                onClick={() => onViewItemUpdated({ showLabel: node.showLabel === false ? undefined : false })}
              >
                {node.showLabel === false
                  ? <HideNameIcon sx={{ fontSize: 18 }} />
                  : <ShowNameIcon sx={{ fontSize: 18 }} />}
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        {showLink && (
          <TextField
            inputRef={linkRef}
            value={modelItem.headerLink || ''}
            placeholder={t('linkPlaceholder')}
            fullWidth
            size="small"
            sx={{ mt: 1 }}
            onChange={(e) => {
              onModelItemUpdated({ headerLink: e.target.value || undefined });
            }}
          />
        )}
      </Section>

      {/* Icon picker moved to the top-bar style strip (Change icon). */}

      {/* Link to diagram — only shown when diagrams are available */}
      {linkedDiagrams.length > 0 && (
        <Section title={t('diagramLink')}>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ display: 'block', mb: 0.5 }}
          >
            {t('diagramLinkHint')}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Autocomplete
              size="small"
              sx={{ flex: 1 }}
              options={linkedDiagrams}
              getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.name)}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              value={linkedDiagrams.find((d) => d.id === modelItem.link) ?? null}
              onChange={(_e, newVal) => {
                onModelItemUpdated({ link: newVal?.id ?? undefined });
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('diagramLinkPlaceholder')}
                  inputProps={{
                    ...params.inputProps,
                    'data-axoview-id': 'node-info-tab-link-picker'
                  }}
                />
              )}
              slotProps={{
                listbox: {
                  'data-axoview-id': 'node-info-tab-link-picker-listbox'
                } as React.ComponentProps<'ul'>
              }}
              clearOnEscape
              handleHomeEndKeys={false}
            />
            {modelItem.link && (
              <Tooltip title={t('openDiagramLink')}>
                <IconButton
                  size="small"
                  onClick={() => {
                    // Edit-mode picker → open the linked diagram in the
                    // editor (not the readonly view), same tab. App.tsx
                    // listener resolves the name and calls openDiagramById.
                    window.dispatchEvent(
                      new CustomEvent('axoview-open-diagram-in-editor', {
                        detail: { id: modelItem.link }
                      })
                    );
                  }}
                  data-axoview-id="node-info-tab-open-linked"
                  data-testid="node-info-tab-open-linked-diagram"
                >
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Section>
      )}
    </Stack>
  );
};
