import React, { useEffect, useState } from 'react';
import { TextField } from '@mui/material';
import { useLabel } from 'src/hooks/useLabel';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { ControlsContainer } from '../components/ControlsContainer';
import { DeckHeader } from '../components/DeckHeader';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { NotesSection } from '../components/NotesSection';
import { PANEL_EVENT } from 'src/components/NodeActionBar/NodeActionBar.helpers';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  id: string;
}

// Floating Label panel (ADR 0031). A Label's `text` is BOTH its on-canvas
// content and its identity (Layers / info popover), so there is no separate
// Metadata section — the Text field (open by default) is it. Notes follows.
// Unified collapsible-section deck (ux-principles §5.1). All visual styling
// lives on the top-bar style strip (ADR 0030). The chip is also editable inline
// on canvas (double-click / F2).
export const LabelControls = ({ id }: Props) => {
  const { t } = useTranslation('textBoxControls');
  // The floating Label's content section is titled "Label" (not "Text") — the
  // element is called Label, so its content should be too (owner 2026-07-02,
  // "match element, kill inversions"). Reuse the already-translated nodeInfoTab
  // "Label" title + placeholder rather than minting duplicate keys.
  const { t: tLabel } = useTranslation('nodeInfoTab');
  const uiStateActions = useUiStateStore((state) => state.actions);
  const label = useLabel(id);
  const { updateLabel } = useScene();
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'focusNotes') setNotesOpen(true);
    };
    window.addEventListener(PANEL_EVENT.LABEL, handler);
    return () => window.removeEventListener(PANEL_EVENT.LABEL, handler);
  }, []);

  if (!label) return null;

  return (
    <ControlsContainer
      header={
        <DeckHeader
          closeLabel={t('close')}
          onClose={() => uiStateActions.setItemControls(null)}
        />
      }
    >
      <CollapsibleSection title={tLabel('label')} defaultOpen>
        <TextField
          placeholder={tLabel('labelPlaceholder')}
          value={label.text}
          size="small"
          fullWidth
          multiline
          minRows={1}
          maxRows={6}
          onChange={(e) => updateLabel(label.id, { text: e.target.value })}
        />
      </CollapsibleSection>
      <NotesSection
        title={t('notes')}
        value={label.notes}
        onChange={(notes) => updateLabel(label.id, { notes })}
        open={notesOpen}
        onToggle={() => setNotesOpen((v) => !v)}
      />
    </ControlsContainer>
  );
};
