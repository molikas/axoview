import React, { useEffect, useRef, useState } from 'react';
import { Stack, IconButton, Tooltip, ButtonBase, Divider, Box } from '@mui/material';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { useScene } from 'src/hooks/useScene';
import { useTranslation } from 'src/stores/localeStore';
import { canMutate } from 'src/interaction/readonlyPolicy';
import { normaliseDeg } from 'src/utils/viewRotation';

// ─── The view-rotation dock widget (ADR 0049 §7, ADR 0051 §2–§4) ──────────────
//
// Lives in the BottomDock right cluster — the viewport-state slot ADR 0005 §4
// reserves — beside the zoom controls, in their idiom.
//
//   ⟲ / ⟳        step 15° onto the 15° lattice (Q / E do the same)
//   ↺ θ°         a RESET button: off the page default it returns there; on a
//                pinned (non-zero) default it returns to 0°. Its tooltip names
//                the target, and the glyph says it is a button, not a label
//   pin          editor only, a TOGGLE: off the default it pins θ as the page's
//                `defaultRotation`; on a pinned default it shows pressed and
//                unpins it (the page opens at 0° again). Each is one undo step
//
// The angle itself is per-viewer uiState (viewers get the same controls, minus
// "set default"); rotating never dirties the diagram. In 2D the controls stay
// visible but disabled, with a tooltip saying why (ux-principles §2.5). The
// icons are an orbit around a floor — deliberately unlike the per-item
// "Rotate 90°" handle's arrow (ux-principles §2.2).

const btnSx = {
  borderRadius: 1,
  p: 0.5,
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
  '&:disabled': { opacity: 0.35 }
} as const;

// A turntable seen at an angle: the floor's back edge faint, its near edge
// carrying the arrow. Counter-clockwise from above = the near side moves right.
const OrbitIcon = ({ direction }: { direction: 1 | -1 }) => (
  <svg
    viewBox="0 0 16 16"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    style={direction < 0 ? { transform: 'scaleX(-1)' } : undefined}
    aria-hidden="true"
  >
    <path d="M2 9.5 A6 3.2 0 0 1 14 9.5" opacity="0.4" />
    <path d="M2 9.5 A6 3.2 0 0 0 13.2 11.2" />
    <path d="M11.8 10.35 L14.4 10 L13.85 12.55" strokeLinejoin="round" />
    <circle cx="8" cy="9.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

// The readout is a reset button: a counter-clockwise "replay" arrow.
const ResetIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="12"
    height="12"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
  </svg>
);

// "Pin this angle as the page's": a pushpin.
const PinIcon = () => (
  <svg
    viewBox="0 0 16 16"
    width="14"
    height="14"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M9.83 1.5a.75.75 0 0 1 .53.22l3.92 3.92a.75.75 0 0 1-.25 1.23l-2.1.84-1.98 1.98.4 2.4a.75.75 0 0 1-1.27.66L6.6 10.27l-3.32 3.31a.5.5 0 0 1-.7-.7l3.3-3.32-2.48-2.48a.75.75 0 0 1 .66-1.27l2.4.4 1.98-1.98.84-2.1a.75.75 0 0 1 .7-.47z" />
  </svg>
);

/** Whole degrees for display; −0 reads as 0. */
const formatDeg = (deg: number) => `${Math.round(normaliseDeg(deg)) || 0}°`;

/** Equal to the 0.1° a default is stored at. */
const sameAngle = (a: number, b: number) =>
  Math.round(normaliseDeg(a) * 10) === Math.round(normaliseDeg(b) * 10);

export const ViewRotationControls = () => {
  const { t } = useTranslation('viewRotationControls');
  const actions = useUiStateStore((s) => s.actions);
  const canvasMode = useUiStateStore((s) => s.canvasMode);
  const editorMode = useUiStateStore((s) => s.editorMode);
  // The readout follows the LIVE angle (a few re-renders of one small widget
  // per gesture frame — the canvas itself never re-renders for it).
  const rotation = useUiStateStore((s) => s.viewRotation);
  const settled = useUiStateStore((s) => s.viewRotationBase);
  const inMotion = useUiStateStore((s) => s.viewRotationInMotion);
  const viewId = useUiStateStore((s) => s.view);
  const pageDefault = useModelStore(
    (s) => s.views.find((v) => v.id === viewId)?.defaultRotation ?? 0
  );
  const { updateView } = useScene();
  const uiApi = useUiStateStoreApi();

  const isIso = canvasMode === 'ISOMETRIC';
  // Keyed to the SETTLED angle, so the controls change state once per gesture —
  // at settle — and never flicker frame to frame while the view turns (or while
  // an orbit sweeps across the default). The pin is never mounted/unmounted by
  // a rotation either: it is disabled in place, so the dock does not reflow.
  const atDefault = sameAngle(settled, pageDefault);
  const hasDefault = !sameAngle(pageDefault, 0);
  // Pressed while the view sits on a pinned page default: clicking unpins it.
  const pinned = atDefault && hasDefault;
  // Where the reset button goes: back to the page default, or — already there,
  // on a pinned default — back to 0°. Nowhere at 0° with no default.
  const resetTarget = !atDefault ? pageDefault : hasDefault ? 0 : null;
  const showSetDefault = canMutate(editorMode);

  // Announce the angle once a rotation settles (aria-live), never per frame.
  const [announcement, setAnnouncement] = useState('');
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (inMotion) return;
    setAnnouncement(t('announce').replace('{angle}', formatDeg(settled)));
  }, [settled, inMotion, t]);

  const disabledHint = t('disabledIn2D');
  const readoutTitle = !atDefault
    ? t('resetToDefault')
        .replace('{angle}', formatDeg(rotation))
        .replace('{default}', formatDeg(pageDefault))
    : hasDefault
      ? t('resetToZero').replace('{angle}', formatDeg(rotation))
      : t('atDefault').replace('{angle}', formatDeg(rotation));
  const pinTitle = !isIso
    ? disabledHint
    : pinned
      ? `${t('unpinPageDefault')} — ${t('unpinPageDefaultHint').replace(
          '{angle}',
          formatDeg(pageDefault)
        )}`
      : atDefault
        ? t('nothingToPin')
        : `${t('setAsPageDefault')} — ${t('setAsPageDefaultHint').replace(
            '{angle}',
            formatDeg(rotation)
          )}`;

  const togglePageDefault = () => {
    if (!viewId) return;
    // Mid-step, land the animation first: the default is the angle the step
    // was going to, never an intermediate frame.
    if (uiApi.getState().viewRotationInMotion) {
      actions.finishViewRotationAnimation();
    }
    // Unpin: the field goes (lean save) and the page opens at 0° again. The
    // camera stays where it is, so the pin is offered again right away.
    if (pinned) {
      updateView(viewId, { defaultRotation: undefined });
      return;
    }
    // One timestamped UPDATE_VIEW = one undo step, dirty + autosave like any
    // edit (ADR 0051 §2). 0 removes the field (lean save); rounded to 0.1°.
    const landed = uiApi.getState().viewRotation;
    const value = Math.round(normaliseDeg(landed) * 10) / 10;
    updateView(viewId, { defaultRotation: value === 0 ? undefined : value });
  };

  return (
    <Stack
      direction="row"
      spacing={0}
      alignItems="center"
      role="group"
      aria-label={t('groupLabel')}
      data-axoview-id="view-rotation"
    >
      <Tooltip
        title={isIso ? t('rotateCounterClockwise') : disabledHint}
        placement="top"
      >
        <span>
          <IconButton
            size="small"
            sx={btnSx}
            disabled={!isIso}
            aria-label={t('rotateCounterClockwise')}
            onClick={() => actions.stepViewRotation(1)}
            data-axoview-id="view-rotation-ccw"
          >
            <OrbitIcon direction={1} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={isIso ? readoutTitle : disabledHint} placement="top">
        <span>
          <ButtonBase
            disabled={!isIso || resetTarget === null}
            aria-label={readoutTitle}
            onClick={() => {
              if (resetTarget !== null) actions.animateViewRotationTo(resetTarget);
            }}
            data-axoview-id="view-rotation-readout"
            sx={{
              // Fixed width (tabular digits, room for "−180°") so the dock never
              // reflows as the angle changes.
              minWidth: 52,
              height: 24,
              px: 0.5,
              gap: 0.375,
              borderRadius: 1,
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
              color: 'text.primary',
              '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-disabled': {
                color: 'text.secondary',
                opacity: isIso ? 1 : 0.35
              },
              '&.Mui-disabled svg': { opacity: 0.4 }
            }}
          >
            <ResetIcon />
            {formatDeg(rotation)}
          </ButtonBase>
        </span>
      </Tooltip>

      <Tooltip
        title={isIso ? t('rotateClockwise') : disabledHint}
        placement="top"
      >
        <span>
          <IconButton
            size="small"
            sx={btnSx}
            disabled={!isIso}
            aria-label={t('rotateClockwise')}
            onClick={() => actions.stepViewRotation(-1)}
            data-axoview-id="view-rotation-cw"
          >
            <OrbitIcon direction={-1} />
          </IconButton>
        </span>
      </Tooltip>

      {showSetDefault && (
        <Tooltip title={pinTitle} placement="top">
          <span>
            <IconButton
              size="small"
              sx={
                pinned && isIso
                  ? {
                      ...btnSx,
                      color: 'primary.main',
                      bgcolor: 'action.selected',
                      '&:hover': { bgcolor: 'action.hover', color: 'primary.main' }
                    }
                  : btnSx
              }
              disabled={!isIso || (atDefault && !hasDefault)}
              aria-label={pinned ? t('unpinPageDefault') : t('setAsPageDefault')}
              aria-pressed={isIso && pinned}
              onClick={togglePageDefault}
              data-axoview-id="view-rotation-set-default"
            >
              <PinIcon />
            </IconButton>
          </span>
        </Tooltip>
      )}

      {/* Screen-reader announcement on settle (ADR 0049 §7). */}
      <Box
        component="span"
        aria-live="polite"
        data-axoview-id="view-rotation-announce"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0 0 0 0)',
          whiteSpace: 'nowrap'
        }}
      >
        {announcement}
      </Box>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.75 }} />
    </Stack>
  );
};
