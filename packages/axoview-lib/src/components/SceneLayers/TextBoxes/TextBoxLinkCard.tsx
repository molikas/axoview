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
import ReactQuill from 'react-quill-new';
import type { Quill } from 'react-quill-new';
import { useTranslation } from 'src/stores/localeStore';
import { normalizeWebLinkUrl } from 'src/utils/quillLinkShortcut';

// Docs-style link chip for the on-canvas editor (ADR 0034 addendum
// 2026-07-04): Quill's own .ql-tooltip is hidden (it misplaces under the iso
// matrix transform), which left linked text with NO affordance mid-edit. The
// card anchors to the link's DOM rect — getBoundingClientRect is
// post-transform, so a Popper portaled to the body lands on the projected
// text regardless of plane/zoom — and offers the Docs trio: open/copy the
// target, edit the URL inline, remove the link. Shown when the caret sits
// inside a link or the pointer hovers one; the editor's click-away contract
// already allowlists .MuiPopper-root, so using the card never ends the
// session.

interface LinkTarget {
  anchorEl: HTMLAnchorElement;
  url: string;
  index: number;
  length: number;
}

interface Props {
  quill: Quill;
  /** Card writes (edit/remove) count as changes for the editor's
   *  commit-only-when-changed guard. */
  onChanged: () => void;
}

const HOVER_HIDE_GRACE_MS = 250;

export const TextBoxLinkCard = ({ quill, onChanged }: Props) => {
  const { t } = useTranslation('textBoxControls');
  const [target, setTarget] = useState<LinkTarget | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const hoveredAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearHideTimer();
    setTarget(null);
    setEditMode(false);
    setCopied(false);
  }, [clearHideTimer]);

  const showForAnchor = useCallback(
    (a: HTMLAnchorElement) => {
      // Resolve the link blot from its DOM node so edit/remove can format the
      // link's EXACT extent (the selection may be a caret anywhere inside).
      const find = (
        ReactQuill.Quill as unknown as {
          find: (node: Node, bubble?: boolean) => unknown;
        }
      ).find;
      const blot = find(a, true) as { length: () => number } | null;
      if (!blot || typeof blot.length !== 'function') return;
      let index: number;
      try {
        index = quill.getIndex(blot as never);
      } catch {
        return;
      }
      setTarget((prev) => {
        const url = a.getAttribute('href') ?? '';
        // Keep identity when nothing moved so the Popper doesn't churn.
        if (
          prev &&
          prev.anchorEl === a &&
          prev.url === url &&
          prev.index === index
        ) {
          return prev;
        }
        return { anchorEl: a, url, index, length: blot.length() };
      });
    },
    [quill]
  );

  // One revalidation used by every trigger: caret-in-link wins, then a
  // hovered anchor, else hide — but never while the card itself has focus
  // (edit mode / a pressed button must not self-dismiss).
  const revalidate = useCallback(() => {
    if (cardRef.current?.contains(document.activeElement)) return;
    const range = quill.getSelection();
    if (range && range.length === 0) {
      const [leaf] = quill.getLeaf(range.index);
      const dom = (leaf as { domNode?: Node } | null)?.domNode ?? null;
      const el =
        dom && dom.nodeType === Node.ELEMENT_NODE
          ? (dom as Element)
          : dom?.parentElement ?? null;
      const a = el?.closest?.('a');
      if (a) {
        showForAnchor(a as HTMLAnchorElement);
        return;
      }
    }
    if (hoveredAnchorRef.current?.isConnected) {
      showForAnchor(hoveredAnchorRef.current);
      return;
    }
    hide();
  }, [quill, showForAnchor, hide]);
  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;

  // Caret trigger + tracking of edits (a text-change can move, rewrite or
  // delete the link under the card).
  useEffect(() => {
    const onEditorChange = () => revalidateRef.current();
    quill.on('editor-change', onEditorChange);
    return () => {
      quill.off('editor-change', onEditorChange);
    };
  }, [quill]);

  // Hover trigger (Docs shows the chip on hover in edit mode too). The grace
  // timer lets the pointer travel from the text into the card.
  useEffect(() => {
    const root = quill.root;
    const onOver = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a) return;
      hoveredAnchorRef.current = a as HTMLAnchorElement;
      clearHideTimer();
      showForAnchor(a as HTMLAnchorElement);
    };
    const onOut = (e: Event) => {
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a !== hoveredAnchorRef.current) return;
      hoveredAnchorRef.current = null;
      clearHideTimer();
      hideTimerRef.current = setTimeout(() => {
        if (cardRef.current?.matches(':hover')) return;
        revalidateRef.current();
      }, HOVER_HIDE_GRACE_MS);
    };
    root.addEventListener('pointerover', onOver);
    root.addEventListener('pointerout', onOut);
    return () => {
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerout', onOut);
      clearHideTimer();
    };
  }, [quill, showForAnchor, clearHideTimer]);

  useEffect(
    () => () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    },
    []
  );

  // Virtual popper anchor that re-reads the live rect (screen coords include
  // the iso transform). A detached anchor parks the card off-screen until the
  // next editor-change revalidates it.
  const virtualAnchor = useMemo(() => {
    if (!target) return null;
    return {
      getBoundingClientRect: () =>
        target.anchorEl.isConnected
          ? target.anchorEl.getBoundingClientRect()
          : new DOMRect(-9999, -9999, 0, 0)
    };
  }, [target]);

  const copyUrl = useCallback(() => {
    if (!target) return;
    navigator.clipboard?.writeText(target.url).catch(() => {});
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [target]);

  const startEdit = useCallback(() => {
    if (!target) return;
    setDraft(target.url);
    setEditMode(true);
  }, [target]);

  const applyEdit = useCallback(() => {
    if (!target) return;
    const normalized = normalizeWebLinkUrl(draft);
    if (normalized) {
      quill.formatText(target.index, target.length, 'link', normalized, 'user');
    } else {
      // Emptied URL = remove the link (Docs behavior).
      quill.formatText(target.index, target.length, 'link', false, 'user');
    }
    onChanged();
    setEditMode(false);
    // Land the caret one char INSIDE the link (at the exact start boundary
    // getLeaf resolves to the preceding text node) so the refreshed card —
    // with the new URL and a fresh DOM anchor — reappears via revalidation.
    quill.focus();
    quill.setSelection(target.index + Math.min(1, target.length), 0, 'user');
  }, [quill, target, draft, onChanged]);

  const removeLink = useCallback(() => {
    if (!target) return;
    quill.formatText(target.index, target.length, 'link', false, 'user');
    onChanged();
    hide();
    quill.focus();
    quill.setSelection(target.index + target.length, 0, 'user');
  }, [quill, target, onChanged, hide]);

  if (!target || !virtualAnchor) return null;

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
        data-axoview-id="textbox-link-card"
        onPointerEnter={clearHideTimer}
        onPointerLeave={() => {
          if (cardRef.current?.contains(document.activeElement)) return;
          revalidateRef.current();
        }}
        onKeyDown={(e) => {
          // Keep card keys away from the canvas hotkey layer; Escape returns
          // to the text.
          e.stopPropagation();
          if (e.key === 'Escape') {
            e.preventDefault();
            setEditMode(false);
            hide();
            quill.focus();
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
        {editMode ? (
          <TextField
            autoFocus
            size="small"
            fullWidth
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') applyEdit();
              if (e.key === 'Escape') {
                e.preventDefault();
                setEditMode(false);
              }
            }}
            data-axoview-id="textbox-link-card-input"
            sx={{ minWidth: 220 }}
          />
        ) : (
          <>
            <MuiLink
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              data-axoview-id="textbox-link-card-url"
              sx={{
                fontSize: 13,
                maxWidth: 220,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mr: 0.5
              }}
            >
              {target.url}
            </MuiLink>
            <Tooltip title={copied ? t('linkCopied') : t('linkCopy')} placement="top">
              <IconButton
                size="small"
                onClick={copyUrl}
                data-axoview-id="textbox-link-card-copy"
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
                onClick={startEdit}
                data-axoview-id="textbox-link-card-edit"
              >
                <EditIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('linkRemove')} placement="top">
              <IconButton
                size="small"
                onClick={removeLink}
                data-axoview-id="textbox-link-card-remove"
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
