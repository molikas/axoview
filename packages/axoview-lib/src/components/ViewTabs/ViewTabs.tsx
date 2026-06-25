import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box, IconButton, Tooltip, TextField, Typography } from '@mui/material';
import { Add, Close, Edit, Check, ChevronRight } from '@mui/icons-material';
import { useModelStore } from 'src/stores/modelStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import { useTranslation } from 'src/stores/localeStore';

type EditingTarget = { kind: 'title' } | { kind: 'view'; id: string } | null;

// Hard cap on pages until a proper overflow-scroll UX lands. Beyond ~15 the
// tabs become unreachable; 5 is the agreed interim ceiling (mqa-results.md
// follow-up, 2026-05-15).
const MAX_PAGES = 5;

// Flat icon-button style mirroring BottomDock's btnSx so the page selector
// reads as part of the dock chrome, not a floating elevated card.
const iconBtnSx = {
  p: 0.25,
  borderRadius: 1,
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }
} as const;

export const ViewTabs = () => {
  const { t } = useTranslation('viewTabs');

  const views = useModelStore((state) => state.views);
  const title = useModelStore((state) => state.title);
  const modelActions = useModelStore((state) => state.actions);
  const currentViewId = useUiStateStore((state) => state.view);
  const editorMode = useUiStateStore((state) => state.editorMode);
  const isReadonly = editorMode !== 'EDITABLE';
  const { createView, deleteView, updateView, switchView } = useScene();

  const [editing, setEditing] = useState<EditingTarget>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = useCallback(
    (target: EditingTarget, currentName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditing(target);
      setEditingName(currentName);
    },
    []
  );

  const commitEdit = useCallback(() => {
    const name = editingName.trim();
    if (name.length > 0 && editing) {
      if (editing.kind === 'title') {
        modelActions.set({ title: name });
      } else {
        updateView(editing.id, { name });
      }
    }
    setEditing(null);
    setEditingName('');
  }, [editing, editingName, modelActions, updateView]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
      } else if (e.key === 'Escape') {
        setEditing(null);
        setEditingName('');
      }
    },
    [commitEdit]
  );

  const handleTabClick = useCallback(
    (viewId: string) => {
      if (editing?.kind === 'view' && editing.id === viewId) return;
      switchView(viewId);
    },
    [editing, switchView]
  );

  const canDelete = views.length > 1;

  // Flat tab — no card/shadow. The active page reads via a subtle neutral
  // "selected" fill (matching the dock's monochrome chrome) rather than a bold
  // filled accent pill.
  const tabBase = {
    display: 'flex',
    flexDirection: 'row' as const,
    alignItems: 'center',
    gap: 0.25,
    px: 1,
    py: 0.25,
    borderRadius: 1,
    maxWidth: 200,
    transition: 'background-color 0.15s'
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 0.25,
        minWidth: 0,
        pointerEvents: 'auto'
      }}
    >
      {/* Diagram title — read-only; name is managed via Save / file manager */}
      <Typography
        variant="body2"
        noWrap
        sx={{
          flexShrink: 0,
          fontWeight: 600,
          color: 'text.secondary',
          fontSize: '0.8125rem',
          px: 0.5
        }}
      >
        {title}
      </Typography>

      <ChevronRight
        sx={{ color: 'text.disabled', width: 16, height: 16, flexShrink: 0 }}
      />

      {/* View tabs */}
      {views.map((view) => {
        const isActive = view.id === currentViewId;
        const isViewEditing =
          editing?.kind === 'view' && editing.id === view.id;

        return (
          <Box
            key={view.id}
            onClick={() => handleTabClick(view.id)}
            sx={{ cursor: 'pointer', display: 'flex', minWidth: 0 }}
          >
            <Box
              sx={{
                ...tabBase,
                bgcolor: isActive ? 'action.selected' : 'transparent',
                color: isActive ? 'text.primary' : 'text.secondary',
                '&:hover': isViewEditing
                  ? {}
                  : { bgcolor: isActive ? 'action.selected' : 'action.hover' }
              }}
            >
              {isViewEditing ? (
                <TextField
                  inputRef={inputRef}
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={commitEdit}
                  onClick={(e) => e.stopPropagation()}
                  size="small"
                  variant="standard"
                  sx={{
                    flexGrow: 1,
                    minWidth: 60,
                    backgroundColor: 'transparent'
                  }}
                  slotProps={{
                    htmlInput: {
                      style: {
                        fontSize: '0.8125rem',
                        padding: 0,
                        background: 'transparent'
                      }
                    }
                  }}
                />
              ) : (
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    flexGrow: 1,
                    fontWeight: isActive ? 600 : 400,
                    color: 'inherit',
                    fontSize: '0.8125rem',
                    lineHeight: 1.5
                  }}
                >
                  {view.name}
                </Typography>
              )}

              {!isReadonly &&
                (isViewEditing ? (
                  <Tooltip title={t('renameDiagram')}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        commitEdit();
                      }}
                      sx={iconBtnSx}
                    >
                      <Check sx={{ width: 14, height: 14 }} />
                    </IconButton>
                  </Tooltip>
                ) : (
                  <Tooltip title={t('renameDiagram')}>
                    <IconButton
                      size="small"
                      onClick={(e) =>
                        startEdit({ kind: 'view', id: view.id }, view.name, e)
                      }
                      sx={{
                        ...iconBtnSx,
                        opacity: 0,
                        '.MuiBox-root:hover > &': { opacity: 0.7 },
                        '&:hover': { opacity: 1, bgcolor: 'action.hover' }
                      }}
                    >
                      <Edit sx={{ width: 13, height: 13 }} />
                    </IconButton>
                  </Tooltip>
                ))}

              {!isReadonly && canDelete && !isViewEditing && (
                <Tooltip title={t('deletePage')}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteView(view.id);
                    }}
                    sx={{
                      ...iconBtnSx,
                      opacity: 0,
                      '.MuiBox-root:hover > &': { opacity: 0.7 },
                      '&:hover': { opacity: 1, bgcolor: 'action.hover' }
                    }}
                  >
                    <Close sx={{ width: 13, height: 13 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        );
      })}

      {/* Add view button — editable mode only. Capped at MAX_PAGES until the
          tab-overflow UX is rebuilt. */}
      {!isReadonly && (() => {
        const atLimit = views.length >= MAX_PAGES;
        return (
          <Tooltip title={atLimit ? t('addPageDisabled') : t('addPage')}>
            <span>
              <IconButton
                size="small"
                onClick={() => createView()}
                disabled={atLimit}
                sx={iconBtnSx}
              >
                <Add sx={{ width: 16, height: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        );
      })()}
    </Box>
  );
};
