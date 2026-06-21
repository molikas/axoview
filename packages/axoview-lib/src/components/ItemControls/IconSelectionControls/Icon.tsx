import React from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { Icon as IconI } from 'src/types';

const GRID_SIZE = 36;
const PREVIEW_SIZE = 56;

// Tooltip content: larger icon preview + full name
const IconTooltipContent = ({ icon }: { icon: IconI }) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 0.75,
      p: 0.5
    }}
  >
    <Box
      component="img"
      src={icon.url}
      alt={icon.name}
      sx={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE, objectFit: 'contain' }}
    />
    <Typography
      variant="caption"
      sx={{
        fontSize: 11,
        color: 'inherit',
        textAlign: 'center',
        maxWidth: 120
      }}
    >
      {icon.name}
    </Typography>
  </Box>
);

interface Props {
  icon: IconI;
  onClick?: () => void;
  onMouseDown?: () => void;
  onDoubleClick?: () => void;
  /**
   * Imported icons only: when supplied, renders a hover-revealed × badge on
   * the tile that invokes this callback. Tile's own click handlers are
   * suppressed when the × is clicked so the delete gesture never doubles as
   * a "place icon" gesture. See ADR-0002 lifecycle section.
   */
  onDelete?: () => void;
  deleteTooltip?: string;
  /**
   * C2 / Decision #7 — roving-tabindex (a11y). The grid (IconGrid) makes exactly
   * ONE tile `tabIndex=0` and the rest `tabIndex=-1`; arrow keys move focus and
   * the focused tile becomes the new 0. Defaults to -1 so a stray render outside
   * a roving grid is still non-focusable. The keydown handler is owned by the
   * grid (arrow nav) and this tile (Enter/Space → place via onActivate).
   */
  tabIndex?: number;
  /** Enter/Space on the focused tile — places the icon at the viewport centre. */
  onActivate?: () => void;
  /** Arrow-key navigation handler, injected by the roving grid. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}

// forwardRef so the roving grid can call `.focus()` on the tile it moves to.
export const Icon = React.forwardRef<HTMLDivElement, Props>(function Icon(
  {
    icon,
    onClick,
    onMouseDown,
    onDoubleClick,
    onDelete,
    deleteTooltip,
    tabIndex = -1,
    onActivate,
    onKeyDown
  },
  ref
) {
  const showDelete = !!onDelete && icon.collection === 'imported';

  return (
    <Tooltip
      title={<IconTooltipContent icon={icon} />}
      placement="right"
      arrow
      enterDelay={400}
      enterNextDelay={200}
    >
      <Box
        ref={ref}
        onClick={onClick}
        onMouseDown={onMouseDown}
        // Touch: arm placement at pointerdown (onMouseDown only fires as a compat
        // event after touchend, too late for a drag-from-panel). Capture the
        // pointer so the browser can't reinterpret the drag as a panel scroll
        // (which fires pointercancel and aborts the drag). The interaction
        // manager then drops/places the icon where the finger lifts over the
        // canvas. Mouse keeps onMouseDown (its drag-from-panel already works).
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse') return;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* capture unavailable */
          }
          onMouseDown?.();
        }}
        onDoubleClick={onDoubleClick}
        // C2 / Decision #7 — keyboard a11y (UX §2 affordances, §3 keyboard).
        // The tile is a real button to AT and to the keyboard: role+label expose
        // it; Enter/Space place the icon at the viewport centre (keyboard has no
        // cursor); arrow keys (onKeyDown, from the roving grid) move focus. The
        // grid owns which tile is tabbable (roving tabIndex).
        role="button"
        aria-label={icon.name}
        tabIndex={tabIndex}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            // Prevent Space from scrolling the panel/page, and stop the key from
            // bubbling to the window-level canvas handler (the tile is a <Box>,
            // so isEditableTarget is false and the canvas would otherwise also
            // react). Mirrors the UX §3.1 F2-rename stopPropagation rule.
            e.preventDefault();
            e.stopPropagation();
            onActivate?.();
            return;
          }
          onKeyDown?.(e);
        }}
        data-axoview-id="canvas-icon-grid-item"
        sx={{
          position: 'relative',
          width: GRID_SIZE,
          height: GRID_SIZE,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 1,
          cursor: 'pointer',
          userSelect: 'none',
          // Don't let the browser treat a touch-drag from the icon as a panel
          // scroll — that fires pointercancel and aborts the drag-to-place.
          touchAction: 'none',
          '&:hover': { bgcolor: 'action.hover' },
          // C1 sibling: the theme-wide :focus-visible ring is on MuiButtonBase,
          // but this tile is a plain <Box>, so it needs its own keyboard focus
          // outline (same 2px primary ring + offset) so roving focus is visible.
          '&:focus-visible': {
            outline: (theme) => `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px'
          },
          '&:hover .ff-icon-delete, &:focus-within .ff-icon-delete': {
            opacity: 1
          }
        }}
      >
        <Box
          component="img"
          draggable={false}
          src={icon.url}
          alt={icon.name}
          sx={{
            width: 28,
            height: 28,
            objectFit: 'contain',
            pointerEvents: 'none'
          }}
        />
        {showDelete && (
          <Tooltip title={deleteTooltip ?? 'Delete imported icon'} arrow>
            <Box
              className="ff-icon-delete"
              role="button"
              aria-label={deleteTooltip ?? 'Delete imported icon'}
              data-axoview-id="canvas-icon-grid-delete"
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete!();
              }}
              sx={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: 'error.main',
                color: 'common.white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.5,
                transition: 'opacity 120ms ease',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                '&:hover': { bgcolor: 'error.dark' }
              }}
            >
              <CloseIcon sx={{ fontSize: 10 }} />
            </Box>
          </Tooltip>
        )}
      </Box>
    </Tooltip>
  );
});
