import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  Divider
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { ModelItem, ViewItem } from 'src/types';
import { useModelItem } from 'src/hooks/useModelItem';
import { useScene } from 'src/hooks/useScene';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useIcon } from 'src/hooks/useIcon';
import { RichTextEditor } from 'src/components/RichTextEditor/RichTextEditor';
import { NodeInfoTab } from '../NodeInfoTab/NodeInfoTab';
import { ControlsContainer } from '../../components/ControlsContainer';
import { DeckHeader } from '../../components/DeckHeader';
import { NotesSection } from '../../components/NotesSection';
import { useTranslation } from 'src/stores/localeStore';

// Unified collapsible-section deck (2026-07-02, ux-principles §5.1): the node
// panel is a vertical stack of collapsible sections — Label (content, open) +
// Notes + Metadata (in NodeInfoTab) — not tabs. Styling lives in the top-bar
// style strip; the icon picker + icon/label sizing moved there too.
const PANEL_EVENT = 'nodePanel';

// True iff an HTML rich-text string carries visible text — used for the
// notes/caption presence checks. Scans char-by-char rather than regex-stripping
// tags so a partial/unclosed tag (e.g. `<script`) can't survive the emptiness
// probe (CodeQL js/incomplete-multi-character-sanitization).
const htmlHasVisibleText = (value: string | undefined): boolean => {
  if (!value) return false;
  let inTag = false;
  for (const ch of value) {
    if (ch === '<') {
      inTag = true;
    } else if (ch === '>') {
      inTag = false;
    } else if (!inTag && !/\s/.test(ch)) {
      return true;
    }
  }
  return false;
};

const resolveHeaderHref = (headerLink: string): string =>
  /^https?:\/\//i.test(headerLink) ? headerLink : `https://${headerLink}`;

// MQA #22 / #25 (4th pass): in the read-only panel the node name is itself the
// clickable affordance for the external header link (tooltip carries the URL).
const ReadOnlyHeaderName = ({
  name,
  headerLink
}: {
  name: string;
  headerLink?: string;
}) => {
  const hasHeaderLink = !!headerLink;
  const headerLinkUrl = hasHeaderLink ? resolveHeaderHref(headerLink!) : null;

  return hasHeaderLink ? (
    <Tooltip title={headerLinkUrl ?? ''}>
      <Box
        component="a"
        href={headerLinkUrl ?? '#'}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="node-panel-header-link"
        sx={{
          color: 'primary.main',
          textDecoration: 'underline',
          cursor: 'pointer',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block'
        }}
      >
        {name || '—'}
      </Box>
    </Tooltip>
  ) : (
    <Box
      component="span"
      sx={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block'
      }}
    >
      {name || '—'}
    </Box>
  );
};

// The "Linked Diagram" body section: a clickable resolved diagram name, or an
// explicit "cannot resolve id <id>" error when the linked diagram is missing
// from the project (never silent).
const LinkedDiagramSection = ({
  linkedDiagramId,
  linkedDiagramMeta
}: {
  linkedDiagramId: string;
  linkedDiagramMeta?: { name: string } | null;
}) => (
  <Box
    sx={{ px: 2, pt: 2, pb: 1 }}
    data-testid="node-panel-linked-diagram-section"
  >
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{ display: 'block', mb: 1 }}
    >
      Linked diagram
    </Typography>
    {linkedDiagramMeta ? (
      <Box
        component="a"
        href={`/display/${linkedDiagramId}`}
        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
          // Ctrl/Cmd/Shift/middle-click → let the browser do its native
          // new-tab/window behaviour. Plain left-click → same-window SPA
          // navigation via the app's router.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
          e.preventDefault();
          window.dispatchEvent(
            new CustomEvent('axoview-navigate-to-diagram', {
              detail: { id: linkedDiagramId }
            })
          );
        }}
        data-testid="node-panel-linked-diagram-link"
        sx={{
          color: 'primary.main',
          textDecoration: 'underline',
          cursor: 'pointer',
          wordBreak: 'break-word'
        }}
      >
        {linkedDiagramMeta.name}
      </Box>
    ) : (
      <Typography
        variant="body2"
        color="error"
        data-testid="node-panel-linked-diagram-error"
        sx={{ wordBreak: 'break-word' }}
      >
        Cannot resolve linked diagram with id: {linkedDiagramId}
      </Typography>
    )}
  </Box>
);

interface ReadOnlyNodePanelProps {
  modelItem: ModelItem;
  iconUrl: string;
  linkedDiagrams: Array<{ id: string; name: string }>;
  hasNotes: boolean;
  labels: { close: string; notes: string };
  onClose: () => void;
}

// Read-only details panel: header (name + external link) plus a scrollable
// body whose caption / linked-diagram / notes sections appear only when their
// content is available.
const ReadOnlyNodePanel = ({
  modelItem,
  iconUrl,
  linkedDiagrams,
  hasNotes,
  labels,
  onClose
}: ReadOnlyNodePanelProps) => {
  // Option A: the node caption (description) folds into Notes — it is no longer
  // a separate read-only section here; legacy content is migrated at load.
  const linkedDiagramId = modelItem.link ?? null;
  const linkedDiagramMeta = linkedDiagramId
    ? linkedDiagrams.find((d) => d.id === linkedDiagramId)
    : null;
  const hasLinkedDiagram = !!linkedDiagramId;

  return (
    <Box
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          pt: 1,
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0
        }}
      >
        {iconUrl && (
          <Box
            component="img"
            src={iconUrl}
            sx={{ width: 22, height: 22, flexShrink: 0 }}
          />
        )}
        <Typography variant="subtitle2" sx={{ flex: 1, minWidth: 0 }}>
          <ReadOnlyHeaderName
            name={modelItem.name}
            headerLink={modelItem.headerLink}
          />
        </Typography>
        <Tooltip title={labels.close}>
          <IconButton size="small" onClick={onClose} sx={{ p: 0.5 }}>
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Scrollable body */}
      <Box sx={{ overflowY: 'auto', flex: 1 }}>
        {linkedDiagramId && (
          <LinkedDiagramSection
            linkedDiagramId={linkedDiagramId}
            linkedDiagramMeta={linkedDiagramMeta}
          />
        )}
        {hasLinkedDiagram && hasNotes && <Divider sx={{ mx: 2 }} />}
        {hasNotes && (
          <Box sx={{ px: 2, pt: 2, pb: 2 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 1 }}
            >
              {labels.notes}
            </Typography>
            <RichTextEditor value={modelItem.notes} readOnly />
          </Box>
        )}
      </Box>
    </Box>
  );
};

interface Props {
  viewItem: ViewItem;
  readOnly?: boolean;
}

export const NodePanel = ({ viewItem, readOnly }: Props) => {
  const { t } = useTranslation('nodePanel');
  const modelItem = useModelItem(viewItem.id);
  const { updateModelItem, updateViewItem } = useScene();
  const uiStateActions = useUiStateStore((state) => state.actions);
  const linkedDiagrams = useUiStateStore((state) => state.linkedDiagrams);
  const { icon } = useIcon(modelItem?.icon || '');

  const [notesOpen, setNotesOpen] = useState(false);
  const [showLink, setShowLink] = useState(!!modelItem?.headerLink);
  const nameRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  // Listen for action-bar commands
  useEffect(() => {
    if (readOnly) return;

    const handler = (e: Event) => {
      const action = (e as CustomEvent<string>).detail;
      switch (action) {
        case 'focusName':
          requestAnimationFrame(() => {
            nameRef.current?.focus({ preventScroll: true });
            nameRef.current?.select();
          });
          break;
        case 'focusLink':
          setShowLink(true);
          requestAnimationFrame(() =>
            linkRef.current?.focus({ preventScroll: true })
          );
          break;
        case 'focusNotes':
          setNotesOpen(true);
          break;
      }
    };

    window.addEventListener(PANEL_EVENT, handler);
    return () => window.removeEventListener(PANEL_EVENT, handler);
  }, [readOnly]);

  const handleClose = useCallback(() => {
    uiStateActions.setItemControls(null);
  }, [uiStateActions]);

  const onModelUpdate = useCallback(
    (updates: Partial<ModelItem>) => updateModelItem(viewItem.id, updates),
    [updateModelItem, viewItem.id]
  );

  const onViewUpdate = useCallback(
    (updates: Partial<ViewItem>) => updateViewItem(viewItem.id, updates),
    [updateViewItem, viewItem.id]
  );

  if (!modelItem) return null;

  const hasNotes = htmlHasVisibleText(modelItem.notes);
  const iconUrl = icon.url || '';

  if (readOnly) {
    return (
      <ReadOnlyNodePanel
        modelItem={modelItem}
        iconUrl={iconUrl}
        linkedDiagrams={linkedDiagrams}
        hasNotes={hasNotes}
        labels={{ close: t('close'), notes: t('notes') }}
        onClose={handleClose}
      />
    );
  }

  return (
    <ControlsContainer
      header={<DeckHeader closeLabel={t('close')} onClose={handleClose} />}
    >
      <NodeInfoTab
        node={viewItem}
        onModelItemUpdated={onModelUpdate}
        onViewItemUpdated={onViewUpdate}
        nameRef={nameRef}
        linkRef={linkRef}
        showLink={showLink}
        onShowLinkChange={setShowLink}
      />
      <NotesSection
        title={t('notes')}
        value={modelItem.notes}
        onChange={(notes) => onModelUpdate({ notes })}
        open={notesOpen}
        onToggle={() => setNotesOpen((v) => !v)}
      />
    </ControlsContainer>
  );
};
