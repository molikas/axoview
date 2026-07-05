import React from 'react';
import {
  Stack,
  TextField,
  IconButton,
  Tooltip,
  Typography,
  Box
} from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { ModelItem, ViewItem } from 'src/types';
import { useModelItem } from 'src/hooks/useModelItem';
import { Section } from '../../components/Section';
import { CollapsibleSection } from '../../components/CollapsibleSection';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  node: ViewItem;
  readOnly?: boolean;
  onModelItemUpdated: (updates: Partial<ModelItem>) => void;
  nameRef?: React.RefObject<HTMLInputElement | null>;
}

export const NodeInfoTab = ({
  node,
  readOnly,
  onModelItemUpdated,
  nameRef
}: Props) => {
  const { t } = useTranslation('nodeInfoTab');
  const modelItem = useModelItem(node.id);

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
      {/* On-canvas label (identity `name` is renamed in Layers). The Add-link
          / link field / hide-name affordances moved to the top-bar strip
          (Link control + show/hide eye) — the deck no longer duplicates them
          (owner 2026-07-05). */}
      <CollapsibleSection title={t('label')} defaultOpen>
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
