import React, { useCallback } from 'react';
import {
  Stack,
  TextField,
  IconButton,
  Tooltip,
  Typography,
  Box
} from '@mui/material';
import {
  InsertLink as InsertLinkIcon,
  OpenInNew as OpenInNewIcon,
  VisibilityOutlined as ShowNameIcon,
  VisibilityOffOutlined as HideNameIcon
} from '@mui/icons-material';
import { ModelItem, ViewItem } from 'src/types';
import { useModelItem } from 'src/hooks/useModelItem';
import { Section } from '../../components/Section';
import { CollapsibleSection } from '../../components/CollapsibleSection';
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

  const handleToggleLink = useCallback(() => {
    if (showLink && modelItem?.headerLink) {
      onModelItemUpdated({ headerLink: undefined });
    }
    onShowLinkChange(!showLink);
  }, [showLink, modelItem?.headerLink, onModelItemUpdated, onShowLinkChange]);

  if (!modelItem) return null;

  // ADR 0032 amendment (2026-06-30): the Details field edits the on-canvas
  // `label` (the field you type into is what shows on the shape); the identity
  // `name` is renamed in Layers. Effective text falls back to `name` pre-seed.
  const labelText = modelItem.label ?? modelItem.name;

  if (readOnly) {
    return (
      <Stack>
        {/* On-canvas label */}
        <Section title={t('label')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>
              {labelText || '—'}
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
      {/* On-canvas label (identity `name` is renamed in Layers) */}
      <CollapsibleSection title={t('label')} defaultOpen>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <TextField
            inputRef={nameRef}
            value={labelText}
            fullWidth
            placeholder={t('labelPlaceholder')}
            size="small"
            onChange={(e) => {
              const text = e.target.value;
              if (labelText !== text) onModelItemUpdated({ label: text });
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
      </CollapsibleSection>

      {/* Icon picker moved to the top-bar style strip (Change icon). */}
      {/* "Link to diagram" moved to the top-bar Link control (D2) — the strip is
          now the single Link surface (web URL + link-to-diagram). */}
      {/* Identity name (Metadata) is rendered by NodePanel AFTER Notes, so the
          node deck matches the canonical content → Notes → Metadata order
          (ux-principles §5.1) shared by every other element type. */}
    </Stack>
  );
};
