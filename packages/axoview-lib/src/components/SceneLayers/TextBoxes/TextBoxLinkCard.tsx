import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Link as MuiLink,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Popper,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  ContentCopyOutlined as CopyIcon,
  CheckOutlined as CopiedIcon,
  EditOutlined as EditIcon,
  LinkOffOutlined as UnlinkIcon,
  ArticleOutlined as DiagramIcon
} from '@mui/icons-material';
import ReactQuill from 'react-quill-new';
import type { Quill } from 'react-quill-new';
import { useTranslation } from 'src/stores/localeStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import {
  normalizeWebLinkUrl,
  DIAGRAM_LINK_PREFIX,
  EDIT_LINK_AT_SELECTION_EVENT
} from 'src/utils/quillLinkShortcut';

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
  /** The link's <a> when it exists; null while CREATING a link over a plain
   *  selection (Ctrl+K on unlinked text). */
  anchorEl: HTMLAnchorElement | null;
  /** Positioning fallback for the create case: a snapshot of the native
   *  selection rect, taken before the card's field steals focus. */
  rect: DOMRect | null;
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
  // Docs-style suggestions: the same diagram list the strip's link-to-diagram
  // picker uses (the app feeds it; empty in a single-diagram project).
  const linkedDiagrams = useUiStateStore((s) => s.linkedDiagrams);
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
        return { anchorEl: a, rect: null, url, index, length: blot.length() };
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

  // Ctrl/Cmd+K (quillLinkShortcut binding): open the card in EDIT mode right
  // at the selection — create a link over plain text, or edit the one under
  // the caret. This replaced routing the shortcut to the strip's popover at
  // the top of the screen (owner 2026-07-04).
  useEffect(() => {
    const onEditAtSelection = () => {
      const range = quill.getSelection();
      if (!range || range.length === 0) return;
      const formats = quill.getFormat(range.index, range.length) as {
        link?: unknown;
      };
      const url = typeof formats.link === 'string' ? formats.link : '';
      // Anchor at the existing <a> when there is one; otherwise snapshot the
      // native selection rect NOW — it collapses once the field takes focus.
      const [leaf] = quill.getLeaf(range.index + 1);
      const dom = (leaf as { domNode?: Node } | null)?.domNode ?? null;
      const el =
        dom && dom.nodeType === Node.ELEMENT_NODE
          ? (dom as Element)
          : dom?.parentElement ?? null;
      const a = (el?.closest?.('a') as HTMLAnchorElement | null) ?? null;
      const sel = window.getSelection();
      const rect =
        sel && sel.rangeCount > 0
          ? sel.getRangeAt(0).getBoundingClientRect()
          : null;
      clearHideTimer();
      setTarget({
        anchorEl: a,
        rect,
        url,
        index: range.index,
        length: range.length
      });
      setDraft(url);
      setEditMode(true);
      setCopied(false);
    };
    window.addEventListener(EDIT_LINK_AT_SELECTION_EVENT, onEditAtSelection);
    return () =>
      window.removeEventListener(
        EDIT_LINK_AT_SELECTION_EVENT,
        onEditAtSelection
      );
  }, [quill, clearHideTimer]);

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
      getBoundingClientRect: () => {
        if (target.anchorEl?.isConnected) {
          return target.anchorEl.getBoundingClientRect();
        }
        return target.rect ?? new DOMRect(-9999, -9999, 0, 0);
      }
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
    // Deferred one macrotask: refocusing quill INSIDE the Enter keydown lets
    // the keystroke's default action land in the editor and split the
    // paragraph mid-link (same trap as the strip URL field).
    setTimeout(() => {
      quill.focus();
      quill.setSelection(target.index + Math.min(1, target.length), 0, 'user');
    }, 0);
  }, [quill, target, draft, onChanged]);

  const removeLink = useCallback(() => {
    if (!target) return;
    quill.formatText(target.index, target.length, 'link', false, 'user');
    onChanged();
    hide();
    quill.focus();
    quill.setSelection(target.index + target.length, 0, 'user');
  }, [quill, target, onChanged, hide]);

  // Link the selection to another DIAGRAM (Docs' file suggestions): a
  // fragment-scheme href the resting render intercepts and navigates.
  const applyDiagramLink = useCallback(
    (diagramId: string) => {
      if (!target) return;
      quill.formatText(
        target.index,
        target.length,
        'link',
        `${DIAGRAM_LINK_PREFIX}${diagramId}`,
        'user'
      );
      onChanged();
      setEditMode(false);
      setTimeout(() => {
        quill.focus();
        quill.setSelection(target.index + Math.min(1, target.length), 0, 'user');
      }, 0);
    },
    [quill, target, onChanged]
  );

  // Suggestions while typing (edit mode): filter by name; hidden once the
  // draft clearly IS a URL. Empty draft lists the first few.
  const suggestions = useMemo(() => {
    if (!editMode || linkedDiagrams.length === 0) return [];
    const q = draft.trim().toLowerCase();
    if (q.includes('://') || q.startsWith('www.')) return [];
    const matches = q
      ? linkedDiagrams.filter((d) => d.name.toLowerCase().includes(q))
      : linkedDiagrams;
    return matches.slice(0, 5);
  }, [editMode, linkedDiagrams, draft]);

  // An internal link renders as the target diagram's name (not the sentinel
  // href); a deleted target degrades to the raw id.
  const diagramTarget = useMemo(() => {
    if (!target || !target.url.startsWith(DIAGRAM_LINK_PREFIX)) return null;
    const id = target.url.slice(DIAGRAM_LINK_PREFIX.length);
    return { id, name: linkedDiagrams.find((d) => d.id === id)?.name ?? id };
  }, [target, linkedDiagrams]);

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
          flexDirection: editMode ? 'column' : 'row',
          alignItems: editMode ? 'stretch' : 'center',
          gap: 0.25,
          px: 1,
          py: 0.5,
          mt: 0.5,
          borderRadius: 2,
          maxWidth: 380
        }}
      >
        {editMode ? (
          <Box sx={{ minWidth: 260 }}>
            <TextField
              autoFocus
              size="small"
              fullWidth
              placeholder={t('linkSearchPlaceholder')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  // preventDefault so the keystroke can't act anywhere else
                  // once focus returns to the editor (see applyEdit's
                  // deferral).
                  e.preventDefault();
                  applyEdit();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  if (target.url) {
                    // Editing an existing link: back to the view card.
                    setEditMode(false);
                  } else {
                    // Creating: nothing to fall back to — dismiss.
                    hide();
                    quill.focus();
                  }
                }
              }}
              data-axoview-id="textbox-link-card-input"
            />
            {suggestions.length > 0 && (
              <List
                dense
                disablePadding
                sx={{ mt: 0.5, maxHeight: 168, overflowY: 'auto' }}
              >
                {suggestions.map((d) => (
                  <ListItemButton
                    key={d.id}
                    dense
                    onClick={() => applyDiagramLink(d.id)}
                    data-axoview-id="textbox-link-card-diagram"
                    sx={{ borderRadius: 1, px: 0.75 }}
                  >
                    <ListItemIcon sx={{ minWidth: 26 }}>
                      <DiagramIcon sx={{ fontSize: 16 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={d.name}
                      primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        ) : (
          <>
            {diagramTarget ? (
              // Internal link: show the target diagram's NAME (Docs shows the
              // doc title). Copy is meaningless for the sentinel — hidden.
              <>
                <DiagramIcon sx={{ fontSize: 15, mr: 0.5, color: 'text.secondary' }} />
                <Typography
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
                  {diagramTarget.name}
                </Typography>
              </>
            ) : (
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
            )}
            {!diagramTarget && (
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
            )}
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
