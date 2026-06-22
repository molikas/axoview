import React, { useCallback, useRef, useState } from 'react';
import { Icon as IconI } from 'src/types';
import { Box } from '@mui/material';
import { Icon } from './Icon';

// The grid renders 5 columns (gridTemplateColumns below). Arrow-key roving
// navigation needs the column count to map Up/Down to ±GRID_COLUMNS.
const GRID_COLUMNS = 5;

interface Props {
  icons: IconI[];
  onMouseDown?: (icon: IconI) => void;
  onClick?: (icon: IconI) => void;
  onDoubleClick?: (icon: IconI) => void;
  /** Per-icon delete handler — only invoked for imported icons (Icon.tsx gates) */
  onDelete?: (icon: IconI) => void;
  deleteTooltip?: string;
  /**
   * C2 / Decision #7 — keyboard activation. Enter/Space on the focused tile
   * invokes this with the icon; the parent places it at the viewport-centre tile
   * (keyboard has no cursor) via the shared keyboard-placement path. When omitted
   * the tiles are still arrow-navigable but Enter/Space is a no-op.
   */
  onActivate?: (icon: IconI) => void;
  hoveredIndex?: number;
  onHover?: (index: number) => void;
}

export const IconGrid = ({
  icons,
  onMouseDown,
  onClick,
  onDoubleClick,
  onDelete,
  deleteTooltip,
  onActivate
}: Props) => {
  // ── C2 / Decision #7: roving tabindex ──────────────────────────────────────
  // Exactly one tile is tabbable (tabIndex=0) at a time — the rest are
  // tabIndex=-1 — so Tab enters/exits the grid as a single stop (WAI-ARIA grid/
  // toolbar pattern) instead of stepping through every icon. Arrow keys move
  // focus between tiles and the newly focused tile becomes the tabbable one.
  const [focusedIndex, setFocusedIndex] = useState(0);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Clamp the active index when the list shrinks (e.g. search narrows results)
  // so we never point past the end.
  const activeIndex = Math.min(focusedIndex, Math.max(0, icons.length - 1));

  const moveFocus = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(nextIndex, icons.length - 1));
      setFocusedIndex(clamped);
      // Focus moves to the tile that just became tabbable. The DOM node already
      // exists (all tiles render), so focus synchronously.
      tileRefs.current[clamped]?.focus();
    },
    [icons.length]
  );

  const handleTileKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLDivElement>) => {
      // Enter/Space (placement) is handled inside Icon.tsx and never reaches
      // here. This only handles roving navigation across the grid. Navigation
      // keys are consumed (preventDefault + stopPropagation) so the focused tile
      // doesn't also scroll the panel AND so arrow keys don't bubble to the
      // window-level canvas pan handler (the tile is a <Box>, not an editable
      // target). Unhandled keys fall through untouched.
      const NAV_KEYS = [
        'ArrowRight',
        'ArrowLeft',
        'ArrowDown',
        'ArrowUp',
        'Home',
        'End'
      ];
      if (!NAV_KEYS.includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();

      switch (e.key) {
        case 'ArrowRight':
          moveFocus(index + 1);
          break;
        case 'ArrowLeft':
          moveFocus(index - 1);
          break;
        case 'ArrowDown':
          moveFocus(index + GRID_COLUMNS);
          break;
        case 'ArrowUp':
          moveFocus(index - GRID_COLUMNS);
          break;
        case 'Home':
          moveFocus(0);
          break;
        case 'End':
          moveFocus(icons.length - 1);
          break;
        default:
          break;
      }
    },
    [moveFocus, icons.length]
  );

  return (
    // No container ARIA role: a true `grid` role would require row/gridcell
    // descendants (axe would flag button children), and `toolbar` implies a
    // single row. The roving tabindex + per-tile role="button"/aria-label
    // (Icon.tsx) already make this a fully keyboard-operable composite (C2 /
    // Decision #7), so we avoid making a false structural promise to AT.
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_COLUMNS}, 1fr)`,
        gap: 0.25
      }}
    >
      {icons.map((icon, index) => (
        <Icon
          key={icon.id}
          ref={(el) => {
            tileRefs.current[index] = el;
          }}
          icon={icon}
          tabIndex={index === activeIndex ? 0 : -1}
          onClick={() => onClick?.(icon)}
          onMouseDown={() => onMouseDown?.(icon)}
          onDoubleClick={() => onDoubleClick?.(icon)}
          onActivate={onActivate ? () => onActivate(icon) : undefined}
          onKeyDown={(e) => handleTileKeyDown(index, e)}
          onDelete={onDelete ? () => onDelete(icon) : undefined}
          deleteTooltip={deleteTooltip}
        />
      ))}
    </Box>
  );
};
