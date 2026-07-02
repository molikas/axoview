import React, { useEffect, useState } from 'react';
import { useTextBox } from 'src/hooks/useTextBox';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';
import { ControlsContainer } from '../components/ControlsContainer';
import { DeckHeader } from '../components/DeckHeader';
import { CollapsibleSection } from '../components/CollapsibleSection';
import { NotesSection } from '../components/NotesSection';
import { MetadataSection } from '../components/MetadataSection';
import { PANEL_EVENT } from 'src/components/NodeActionBar/NodeActionBar.helpers';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  id: string;
}

// Text panel (2026-07-02): the on-canvas rich text (`content`) is the lead
// content section (open by default); Notes and the collapsed Metadata (identity
// Name) follow. Unified collapsible-section deck (ux-principles §5.1). All
// visual styling lives on the top-bar style strip (TopBarStyleControls).
export const TextBoxControls = ({ id }: Props) => {
  const { t } = useTranslation('textBoxControls');
  const uiStateActions = useUiStateStore((state) => state.actions);
  const textBox = useTextBox(id);
  const { updateTextBox } = useScene();
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent<string>).detail === 'focusNotes') setNotesOpen(true);
    };
    window.addEventListener(PANEL_EVENT.TEXTBOX, handler);
    return () => window.removeEventListener(PANEL_EVENT.TEXTBOX, handler);
  }, []);

  if (!textBox) return null;

  return (
    <ControlsContainer
      header={
        <DeckHeader
          closeLabel={t('close')}
          onClose={() => uiStateActions.setItemControls(null)}
        />
      }
    >
      <CollapsibleSection title={t('text')} defaultOpen>
        <RichTextEditor
          value={textBox.content}
          onChange={(html) => updateTextBox(textBox.id, { content: html })}
          height={120}
          contentStyle={{
            fontWeight: textBox.isBold ? 700 : undefined,
            fontStyle: textBox.isItalic ? 'italic' : undefined
          }}
        />
      </CollapsibleSection>
      <NotesSection
        title={t('notes')}
        value={textBox.notes}
        onChange={(notes) => updateTextBox(textBox.id, { notes })}
        open={notesOpen}
        onToggle={() => setNotesOpen((v) => !v)}
      />
      <MetadataSection
        title={t('metadata')}
        fieldLabel={t('name')}
        name={textBox.name ?? ''}
        placeholder={t('namePlaceholder')}
        onChange={(v) => updateTextBox(textBox.id, { name: v || undefined })}
      />
    </ControlsContainer>
  );
};
