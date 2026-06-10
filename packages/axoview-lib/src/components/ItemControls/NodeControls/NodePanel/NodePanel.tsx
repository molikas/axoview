import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Tabs,
  Tab,
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
import { NodeStyleTab } from '../NodeStyleTab/NodeStyleTab';
import { useTranslation } from 'src/stores/localeStore';

const PANEL_EVENT = 'nodePanel';

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
      overflowX: 'hidden',
      display: value === index ? 'flex' : 'none',
      flexDirection: 'column'
    }}
  >
    {value === index && children}
  </Box>
);

// Shared "does this HTML string carry visible text?" probe — used for the
// notes/caption presence checks throughout the panel.
const hasRichText = (value: string | undefined): boolean =>
  !!value && value.replace(/<[^>]*>/g, '').trim() !== '';

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
  labels: { close: string; caption: string; notes: string };
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
  const hasCaption = hasRichText(modelItem.description);
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
        {hasCaption && (
          <Box sx={{ px: 2, pt: 2, pb: 1 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 1 }}
            >
              {labels.caption}
            </Typography>
            <RichTextEditor value={modelItem.description} readOnly />
          </Box>
        )}
        {hasCaption && hasLinkedDiagram && <Divider sx={{ mx: 2 }} />}
        {linkedDiagramId && (
          <LinkedDiagramSection
            linkedDiagramId={linkedDiagramId}
            linkedDiagramMeta={linkedDiagramMeta}
          />
        )}
        {(hasCaption || hasLinkedDiagram) && hasNotes && <Divider sx={{ mx: 2 }} />}
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

  const [activeTab, setActiveTab] = useState(TAB_DETAILS);
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
          setActiveTab(TAB_DETAILS);
          requestAnimationFrame(() => {
            nameRef.current?.focus();
            nameRef.current?.select();
          });
          break;
        case 'focusLink':
          setActiveTab(TAB_DETAILS);
          setShowLink(true);
          requestAnimationFrame(() => linkRef.current?.focus());
          break;
        case 'scrollToAppearance':
          setActiveTab(TAB_STYLE);
          break;
        case 'focusNotes':
          setActiveTab(TAB_NOTES);
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

  const hasNotes = hasRichText(modelItem.notes);
  const iconUrl = icon.url || '';

  if (readOnly) {
    return (
      <ReadOnlyNodePanel
        modelItem={modelItem}
        iconUrl={iconUrl}
        linkedDiagrams={linkedDiagrams}
        hasNotes={hasNotes}
        labels={{ close: t('close'), caption: t('caption'), notes: t('notes') }}
        onClose={handleClose}
      />
    );
  }

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
            '& .MuiTab-root': {
              minHeight: 36,
              py: 0.5,
              px: 1.5
            }
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
            onClick={handleClose}
            sx={{ p: 0.5, flexShrink: 0 }}
          >
            <CloseIcon sx={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Details tab */}
      <TabPanel value={activeTab} index={TAB_DETAILS}>
        <NodeInfoTab
          node={viewItem}
          onModelItemUpdated={onModelUpdate}
          onViewItemUpdated={onViewUpdate}
          nameRef={nameRef}
          linkRef={linkRef}
          showLink={showLink}
          onShowLinkChange={setShowLink}
        />
      </TabPanel>

      {/* Style tab */}
      <TabPanel value={activeTab} index={TAB_STYLE}>
        <NodeStyleTab
          node={viewItem}
          iconUrl={iconUrl}
          onModelItemUpdated={onModelUpdate}
          onViewItemUpdated={onViewUpdate}
        />
      </TabPanel>

      {/* Notes tab */}
      <TabPanel value={activeTab} index={TAB_NOTES}>
        <Box sx={{ p: 2 }}>
          <RichTextEditor
            height={300}
            value={modelItem.notes}
            onChange={(text) => {
              const empty = !hasRichText(text);
              if (empty && !hasRichText(modelItem.notes)) return;
              if (modelItem.notes !== text)
                onModelUpdate({ notes: empty ? undefined : text });
            }}
          />
        </Box>
      </TabPanel>
    </Box>
  );
};
