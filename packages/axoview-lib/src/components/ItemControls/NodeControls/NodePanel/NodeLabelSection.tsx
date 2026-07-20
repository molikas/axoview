import React from 'react';
import { Stack, TextField } from '@mui/material';
import { ModelItem, ViewItem } from 'src/types';
import { useModelItem } from 'src/hooks/useModelItem';
import { CollapsibleSection } from '../../components/CollapsibleSection';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  node: ViewItem;
  onModelItemUpdated: (updates: Partial<ModelItem>) => void;
  nameRef?: React.RefObject<HTMLInputElement | null>;
}

// The node deck's editable on-canvas Label field. (Formerly `NodeInfoTab` — a
// fossil name left over from the retired tabbed Details/Style/Notes inspector;
// there is no tab, and its ex-sibling NodeStyleTab is gone.) Styling — icon,
// colour, size, link — lives on the top-bar style strip (ADR 0030 / 0034); the
// identity `name` is edited in the Metadata section rendered by NodePanel.
// Read-only rendering is owned wholly by NodePanel's ReadOnlyNodePanel, so this
// component has no read-only branch of its own.
export const NodeLabelSection = ({
  node,
  onModelItemUpdated,
  nameRef
}: Props) => {
  const { t } = useTranslation('nodeDeck');
  const modelItem = useModelItem(node.id);

  if (!modelItem) return null;

  // ADR 0032 amendment (2026-06-30): the field edits the on-canvas `label` (what
  // shows on the shape); the identity `name` is renamed in the Metadata section.
  // Effective text falls back to `name` pre-seed.
  const labelText = modelItem.label ?? modelItem.name;

  return (
    <Stack>
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
    </Stack>
  );
};
