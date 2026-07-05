import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconButton,
  Link as MuiLink,
  Paper,
  Popper,
  TextField,
  Tooltip
} from '@mui/material';
import {
  ContentCopyOutlined as CopyIcon,
  CheckOutlined as CopiedIcon,
  EditOutlined as EditIcon,
  LinkOffOutlined as UnlinkIcon
} from '@mui/icons-material';
import { useScene } from 'src/hooks/useScene';
import { useModelStore } from 'src/stores/modelStore';
import { useTranslation } from 'src/stores/localeStore';
import {
  EDIT_ELEMENT_LINK_EVENT,
  ElementLinkTarget,
  normalizeWebLinkUrl
} from 'src/utils/quillLinkShortcut';

// Element-level twin of TextBoxLinkCard (ADR 0034 addendum 2026-07-05):
// Ctrl+K while inline-renaming ANY plain-text label — a floating Label, a
// node name, a connector label — opens this card at the label instead of the
// strip's popover at the top of the screen. Plain-text labels carry ONE link
// (the element headerLink), so the card reads/writes that: Enter applies
// (Docs-forgiving URL), the view chip offers open/copy/edit/remove. Mounted
// once next to the TransformControlsManager; anchored on a rect snapshot the
// dispatching editor takes before this card's field steals its focus (the
// focus loss also commits the rename — same contract as the strip path).

interface OpenState {
  target: ElementLinkTarget;
  rect: { left: number; top: number; width: number; height: number };
  editMode: boolean;
}

const resolveHref = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : `https://${url}`;

export const ElementLinkCard = () => {
  const { t } = useTranslation('textBoxControls');
  const { t: tStrip } = useTranslation('topBarStyleControls');
  const scene = useScene();
  const items = useModelStore((s) => s.items);
  const [open, setOpen] = useState<OpenState | null>(null);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Current headerLink of the target (live — a write re-renders the chip).
  const currentUrl = useMemo(() => {
    if (!open) return '';
    const { target } = open;
    if (target.kind === 'LABEL') {
      return scene.labels.find((l) => l.id === target.id)?.headerLink ?? '';
    }
    if (target.kind === 'NODE') {
      return items.find((i) => i.id === target.id)?.headerLink ?? '';
    }
    const connector = scene.connectors.find((c) => c.id === target.connectorId);
    if (!connector) return '';
    if (target.labelId === null) return connector.headerLink ?? '';
    return (
      connector.labels?.find((l) => l.id === target.labelId)?.headerLink ?? ''
    );
  }, [open, scene.labels, scene.connectors, items]);

  const writeUrl = useCallback(
    (url: string | undefined) => {
      if (!open) return;
      const { target } = open;
      if (target.kind === 'LABEL') {
        scene.updateLabel(target.id, { headerLink: url });
        return;
      }
      if (target.kind === 'NODE') {
        scene.updateModelItem(target.id, { headerLink: url });
        return;
      }
      const connector = scene.connectors.find(
        (c) => c.id === target.connectorId
      );
      if (!connector) return;
      if (target.labelId === null) {
        scene.updateConnector(connector.id, { headerLink: url });
        return;
      }
      scene.updateConnector(connector.id, {
        labels: (connector.labels ?? []).map((l) =>
          l.id === target.labelId ? { ...l, headerLink: url } : l
        )
      });
    },
    [open, scene]
  );

  const hide = useCallback(() => {
    setOpen(null);
    setCopied(false);
  }, []);

  // Open on the editors' Ctrl+K dispatch.
  useEffect(() => {
    const onEdit = (e: Event) => {
      const detail = (e as CustomEvent<{
        target: ElementLinkTarget;
        rect: { left: number; top: number; width: number; height: number };
      }>).detail;
      if (!detail?.target || !detail.rect) return;
      setOpen({ target: detail.target, rect: detail.rect, editMode: true });
      setCopied(false);
    };
    window.addEventListener(EDIT_ELEMENT_LINK_EVENT, onEdit);
    return () => window.removeEventListener(EDIT_ELEMENT_LINK_EVENT, onEdit);
  }, []);

  // Seed the draft when (re)entering edit mode.
  useEffect(() => {
    if (open?.editMode) setDraft(currentUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed on mode flip only; typing owns the draft afterwards
  }, [open?.editMode, open?.target]);

  // Click-away closes (capture, so canvas handlers can't precede it) — the
  // card is a transient overlay, not a selection surface.
  useEffect(() => {
    if (!open) return undefined;
    const onPress = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Node | null;
      if (target && cardRef.current?.contains(target)) return;
      hide();
    };
    window.addEventListener('pointerdown', onPress, true);
    window.addEventListener('mousedown', onPress, true);
    return () => {
      window.removeEventListener('pointerdown', onPress, true);
      window.removeEventListener('mousedown', onPress, true);
    };
  }, [open, hide]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    []
  );

  const virtualAnchor = useMemo(() => {
    if (!open) return null;
    const { left, top, width, height } = open.rect;
    return {
      getBoundingClientRect: () => new DOMRect(left, top, width, height)
    };
  }, [open]);

  const applyEdit = useCallback(() => {
    const normalized = normalizeWebLinkUrl(draft);
    writeUrl(normalized ?? undefined);
    if (!normalized) {
      hide();
      return;
    }
    setOpen((prev) => (prev ? { ...prev, editMode: false } : prev));
  }, [draft, writeUrl, hide]);

  const copyUrl = useCallback(() => {
    if (!currentUrl) return;
    navigator.clipboard?.writeText(resolveHref(currentUrl)).catch(() => {});
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [currentUrl]);

  const removeLink = useCallback(() => {
    writeUrl(undefined);
    hide();
  }, [writeUrl, hide]);

  if (!open || !virtualAnchor) return null;

  return (
    <Popper
      open
      anchorEl={virtualAnchor}
      placement="bottom-start"
      sx={{ zIndex: (theme) => theme.zIndex.tooltip }}
    >
      <Paper
        ref={cardRef}
        elevation={4}
        data-axoview-id="element-link-card"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            hide();
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.25,
          px: 1,
          py: 0.5,
          mt: 0.5,
          borderRadius: 2,
          maxWidth: 380
        }}
      >
        {open.editMode ? (
          <TextField
            autoFocus
            size="small"
            placeholder={tStrip('webLinkPlaceholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                applyEdit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                hide();
              }
            }}
            data-axoview-id="element-link-card-input"
            sx={{ minWidth: 240 }}
          />
        ) : (
          <>
            <MuiLink
              href={resolveHref(currentUrl)}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              data-axoview-id="element-link-card-url"
              sx={{
                fontSize: 13,
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mr: 0.5
              }}
            >
              {currentUrl}
            </MuiLink>
            <Tooltip title={copied ? t('linkCopied') : t('linkCopy')} placement="top">
              <IconButton
                size="small"
                onClick={copyUrl}
                data-axoview-id="element-link-card-copy"
              >
                {copied ? (
                  <CopiedIcon sx={{ fontSize: 16 }} color="success" />
                ) : (
                  <CopyIcon sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
            <Tooltip title={t('linkEdit')} placement="top">
              <IconButton
                size="small"
                onClick={() =>
                  setOpen((prev) =>
                    prev ? { ...prev, editMode: true } : prev
                  )
                }
                data-axoview-id="element-link-card-edit"
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('linkRemove')} placement="top">
              <IconButton
                size="small"
                onClick={removeLink}
                data-axoview-id="element-link-card-remove"
              >
                <UnlinkIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Paper>
    </Popper>
  );
};
