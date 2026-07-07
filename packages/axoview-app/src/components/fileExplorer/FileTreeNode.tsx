import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Button, CircularProgress, Skeleton, Tooltip, Typography } from '@mui/material';
import {
  FolderOutlined as FolderIcon,
  FolderOpenOutlined as FolderOpenIcon,
  ArticleOutlined as DiagramIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  FiberManualRecord as DotIcon,
  CloudOutlined as CloudIcon,
  ComputerOutlined as ComputerIcon,
  DnsOutlined as ServerIcon,
  CloudUploadOutlined as MoveAllIcon,
  ErrorOutlineOutlined as ErrorIcon
} from '@mui/icons-material';
import type { NodeRendererProps } from 'react-arborist';
import type { FileNode } from '../../hooks/useFileTree';
import { GoogleGIcon } from '../GoogleGIcon';

interface Props extends NodeRendererProps<FileNode> {
  selectedId?: string | null;
  onContextMenu: (event: React.MouseEvent, node: FileNode) => void;
  onOpen: (node: FileNode) => void;
  /** Click handler for actionable placeState rows (signin/reconnect/error/setup/scope). */
  onStateAction: (node: FileNode) => void;
  /** Session place row: show the "Move all to Drive" affordance. */
  moveAllVisible?: boolean;
  onMoveAll?: () => void;
  /** True in the self-host server deployment — relabels the local place. */
  serverPlace?: boolean;
  /** Diagrams mid-move to Drive: row shows a spinner, dims, and goes inert. */
  movingIds?: Set<string>;
}

function countDiagrams(nodes: FileNode[] | undefined): number {
  if (!nodes) return 0;
  let n = 0;
  for (const node of nodes) {
    if (node.type === 'diagram') n += 1;
    if (node.children) n += countDiagrams(node.children);
  }
  return n;
}

export function FileTreeNode({
  node,
  style,
  dragHandle,
  selectedId,
  onContextMenu,
  onOpen,
  onStateAction,
  moveAllVisible,
  onMoveAll,
  serverPlace,
  movingIds
}: Props) {
  const { t } = useTranslation('app');
  const isFolder = node.data.type === 'folder';
  const isSelected = node.data.id === selectedId;
  const isDirty = node.data.isDirty;
  // Mid-move to Drive: honest indeterminate feedback (§6.4 — no fake percent)
  // right where the user acted; the row is inert until the move settles.
  const isMoving = node.data.type === 'diagram' && !!movingIds?.has(node.data.id);

  // Distinguish single-click (open) from double-click (rename) with a short timer.
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    if (node.data.type === 'place') {
      node.toggle();
      return;
    }
    if (node.data.type === 'placeState') return; // state rows own their actions
    if (isFolder) {
      node.toggle();
      return;
    }
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onOpen(node.data);
    }, 300);
  }, [isFolder, node, onOpen]);

  // ---------------------------------------------------------------------------
  // Place section header row ("Google Drive" / "This session" / "This server")
  // ---------------------------------------------------------------------------
  if (node.data.type === 'place') {
    const isDrive = node.data.placeId === 'google-drive';
    const PlaceIcon = isDrive ? CloudIcon : serverPlace ? ServerIcon : ComputerIcon;
    const count = countDiagrams(node.data.children);
    return (
      <Box
        style={style}
        onClick={handleClick}
        data-axoview-id={`file-explorer-place-${node.data.placeId}`}
        sx={{ display: 'flex', alignItems: 'center', width: '100%' }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 0.5,
            py: 0.25,
            borderRadius: 0.5,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' },
            userSelect: 'none',
            overflow: 'hidden',
            width: '100%'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'text.secondary', width: 16 }}>
            {node.isOpen
              ? <ExpandMoreIcon sx={{ fontSize: 16 }} />
              : <ChevronRightIcon sx={{ fontSize: 16 }} />}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'text.secondary' }}>
            <PlaceIcon sx={{ fontSize: 15 }} />
          </Box>
          <Typography
            variant="overline"
            noWrap
            sx={{ flex: 1, color: 'text.secondary', lineHeight: 1.6 }}
          >
            {node.data.name}
          </Typography>
          {count > 0 && (
            <Typography variant="micro" sx={{ color: 'text.disabled', pr: 0.5 }}>
              {count}
            </Typography>
          )}
          {!isDrive && moveAllVisible && (
            // §2.1 — in-row affordance at half opacity, full on hover.
            <Tooltip title={t('places.moveAllToDrive', 'Move all to Drive')} placement="top">
              <Box
                component="button"
                data-axoview-id="file-explorer-move-all-to-drive"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onMoveAll?.();
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: 'text.secondary',
                  p: 0.25,
                  opacity: 0.5,
                  '&:hover': { opacity: 1 }
                }}
              >
                <MoveAllIcon sx={{ fontSize: 15 }} />
              </Box>
            </Tooltip>
          )}
        </Box>
      </Box>
    );
  }

  // ---------------------------------------------------------------------------
  // Synthetic state rows inside a place section
  // ---------------------------------------------------------------------------
  if (node.data.type === 'placeState') {
    const kind = node.data.stateKind;
    const indentSx = { pl: 3, pr: 1, py: 0.25, display: 'flex', alignItems: 'center', gap: 0.75, width: '100%' } as const;

    if (kind === 'loading') {
      return (
        <Box style={style} sx={indentSx} data-axoview-id="file-explorer-drive-loading">
          <Skeleton variant="circular" width={12} height={12} />
          <Skeleton variant="text" sx={{ flex: 1, maxWidth: '70%' }} />
        </Box>
      );
    }
    if (kind === 'signin' || kind === 'reconnect') {
      return (
        <Box style={style} sx={{ width: '100%' }}>
          <Box
            component="button"
            onClick={() => onStateAction(node.data)}
            data-axoview-id={`file-explorer-drive-${kind}`}
            sx={{
              ...indentSx,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: 0.5,
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <GoogleGIcon />
            <Typography variant="body2" sx={{ color: 'primary.main', textAlign: 'left', whiteSpace: 'normal' }}>
              {kind === 'signin'
                ? t('places.driveSignInRow', 'Sign in to connect Google Drive')
                : t('places.driveReconnectRow', 'Reconnect to load your Drive diagrams')}
            </Typography>
          </Box>
        </Box>
      );
    }
    if (kind === 'setup') {
      return (
        <Box style={style} sx={{ width: '100%' }}>
          <Box
            component="button"
            onClick={() => onStateAction(node.data)}
            data-axoview-id="file-explorer-drive-setup"
            sx={{
              ...indentSx,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderRadius: 0.5,
              '&:hover': { bgcolor: 'action.hover' }
            }}
          >
            <CloudIcon sx={{ fontSize: 14, color: 'primary.main' }} />
            <Typography variant="body2" sx={{ color: 'primary.main' }} noWrap>
              {t('places.driveSetupRow', 'Finish Google Drive setup…')}
            </Typography>
          </Box>
        </Box>
      );
    }
    if (kind === 'scope') {
      // Partial grant: signed in, but the consent screen's Drive checkbox was
      // left unchecked. Distinct from 'error' — Retry can't fix it; only a
      // re-consent can.
      return (
        <Box style={style} sx={indentSx} data-axoview-id="file-explorer-drive-scope">
          <ErrorIcon sx={{ fontSize: 14, color: 'warning.main', flexShrink: 0, mt: 0.25 }} />
          <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1, whiteSpace: 'normal' }}>
            {t('places.driveScopeMissing', 'Drive access is needed to save here — grant it to continue.')}
          </Typography>
          <Button
            size="small"
            variant="text"
            onClick={() => onStateAction(node.data)}
            sx={{ minWidth: 0, px: 0.5, py: 0, textTransform: 'none', lineHeight: 1.5, flexShrink: 0 }}
          >
            {t('places.grantAccess', 'Grant access')}
          </Button>
        </Box>
      );
    }
    if (kind === 'error') {
      // node.name carries the backend's own failure message (e.g. Google's
      // "Request had insufficient authentication scopes.") — show it inline
      // after the generic headline so the cause is visible without hovering.
      return (
        <Box style={style} sx={indentSx} data-axoview-id="file-explorer-drive-error">
          <ErrorIcon sx={{ fontSize: 14, color: 'error.main', flexShrink: 0 }} />
          <Tooltip title={node.data.name || ''} placement="bottom-start">
            <Typography variant="caption" sx={{ color: 'error.main', flex: 1 }} noWrap>
              {t('places.driveError', "Google Drive couldn't be loaded.")}
              {node.data.name ? ` — ${node.data.name}` : ''}
            </Typography>
          </Tooltip>
          <Button
            size="small"
            variant="text"
            onClick={() => onStateAction(node.data)}
            sx={{ minWidth: 0, px: 0.5, py: 0, textTransform: 'none', lineHeight: 1.5 }}
          >
            {t('places.retry', 'Retry')}
          </Button>
        </Box>
      );
    }
    // 'empty'
    return (
      <Box style={style} sx={indentSx}>
        <Typography variant="caption" color="text.secondary" noWrap>
          {node.data.placeId === 'google-drive'
            ? t('places.driveEmpty', 'No diagrams in Drive yet.')
            : t('fileExplorer.empty', 'No diagrams yet. Create one to get started.')}
        </Typography>
      </Box>
    );
  }

  const FolderIconComponent = node.isOpen ? FolderOpenIcon : FolderIcon;

  const label = (
    <Box
      data-axoview-id="file-explorer-row"
      data-diagram-name={node.data.name}
      data-diagram-type={node.data.type}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 0.5,
        py: 0.25,
        borderRadius: 0.5,
        cursor: 'pointer',
        bgcolor: isSelected ? 'action.selected' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
        userSelect: 'none',
        overflow: 'hidden',
        width: '100%',
        opacity: isMoving ? 0.55 : 1
      }}
    >
      {/* Expand/collapse chevron for folders */}
      {isFolder ? (
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'text.secondary', width: 16 }}>
          {node.isOpen
            ? <ExpandMoreIcon sx={{ fontSize: 16 }} />
            : <ChevronRightIcon sx={{ fontSize: 16 }} />}
        </Box>
      ) : (
        <Box sx={{ width: 16, flexShrink: 0 }} />
      )}

      {/* Icon (a spinner while the diagram is mid-move to Drive) */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: isFolder ? 'primary.main' : 'text.secondary' }}>
        {isFolder ? (
          <FolderIconComponent sx={{ fontSize: 16 }} />
        ) : isMoving ? (
          <CircularProgress size={13} thickness={5} sx={{ color: 'text.secondary' }} />
        ) : (
          <DiagramIcon sx={{ fontSize: 16 }} />
        )}
      </Box>

      {/* Name or inline rename input — never rendered together to avoid flex gap */}
      {node.isEditing ? (
        <input
          autoFocus
          data-axoview-id="file-explorer-rename-input"
          defaultValue={node.data.name}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => {
            const value = e.currentTarget.value;
            if (node.data.id === '__pending__' && !value.trim()) {
              node.submit('');
            } else {
              node.submit(value);
            }
          }}
          onKeyDown={(e) => {
            // Stop ALL key events from reaching arborist's native tree-level handler.
            // React synthetic stopPropagation alone is insufficient because arborist
            // uses a native addEventListener on its container. stopImmediatePropagation
            // on the native event prevents bubbling to any ancestor native listener.
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              node.submit(e.currentTarget.value);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              if (node.data.id === '__pending__') {
                node.submit('');
              } else {
                node.reset();
              }
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            border: '1px solid',
            borderRadius: 2,
            padding: '0 4px',
            fontSize: '0.875rem',
            outline: 'none',
            minWidth: 0,
            background: 'var(--mui-palette-background-paper, #fff)',
            color: 'inherit'
          }}
        />
      ) : (
        <Typography
          variant="body2"
          noWrap
          sx={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {node.data.name}
          {isDirty && (
            <Box
              component="span"
              sx={{ ml: 0.5, color: 'warning.main', verticalAlign: 'middle' }}
            >
              <DotIcon sx={{ fontSize: 8 }} />
            </Box>
          )}
        </Typography>
      )}
    </Box>
  );

  const isPending = node.data.id === '__pending__';

  return (
    <Box
      ref={dragHandle}
      style={style}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, node.data)}
      // Inert while mid-move: no open/rename/drag/menu until the move settles.
      sx={{ display: 'flex', alignItems: 'center', pointerEvents: isMoving ? 'none' : 'auto' }}
    >
      {isPending ? (
        label
      ) : !node.isEditing && node.data.type === 'diagram' && node.data.thumbnail ? (
        <Tooltip
          title={<img src={node.data.thumbnail} alt={node.data.name} style={{ maxWidth: 200, maxHeight: 150 }} />}
          placement="right"
          arrow
        >
          {label}
        </Tooltip>
      ) : (
        <Tooltip
          title={node.data.name.length > 28 ? node.data.name : ''}
          placement="right"
          arrow
          disableInteractive
        >
          {label}
        </Tooltip>
      )}
    </Box>
  );
}
