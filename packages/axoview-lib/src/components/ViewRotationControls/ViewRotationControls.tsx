import React, { useEffect, useRef, useState } from 'react';
import {
  Stack,
  IconButton,
  Tooltip,
  ButtonBase,
  Divider,
  Box,
  Menu,
  MenuItem
} from '@mui/material';
import {
  PushPin as PinnedIcon,
  PushPinOutlined as PinIcon
} from '@mui/icons-material';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { useScene } from 'src/hooks/useScene';
import { useTranslation } from 'src/stores/localeStore';
import { canMutate } from 'src/interaction/readonlyPolicy';
import { formatViewAngle, normaliseDeg } from 'src/utils/viewRotation';

// ─── The view-rotation dock widget (ADR 0049 §7, ADR 0051 §2–§4) ──────────────
//
// Lives in the BottomDock right cluster — the viewport-state slot ADR 0005 §4
// reserves — beside the zoom controls, in their idiom.
//
//   ⟲ / ⟳        step 15° onto the 15° lattice (Q / E do the same)
//   ↺ 30°        a RESET button with ONE target: the page default. Disabled
//                once there, so repeated clicks never wander on to another angle
//   pin          editor only. Outlined while the page has no default: a click
//                pins θ as the page's `defaultRotation`. FILLED whenever a
//                default exists, so it is visible from any angle: on the
//                default (highlighted) a click unpins it; elsewhere a click
//                opens a menu — replace it with θ, or remove it. Each change is
//                one undo step and is confirmed by a notice, because it changes
//                the page for everyone
//
// The readout shows a BEARING, clockwise positive (`formatViewAngle`), so E —
// which turns the floor clockwise — counts up. The angle itself is per-viewer
// uiState (viewers get the same controls, minus the pin); rotating never
// dirties the diagram. In 2D the controls stay visible but disabled, with a
// tooltip saying why (ux-principles §2.5). The step icons are an arrow orbiting
// a floor tile — deliberately unlike the per-item "Rotate 90°" handle's
// RotateRight (ux-principles §2.2).

const btnSx = {
  borderRadius: 1,
  p: 0.5,
  color: 'text.secondary',
  '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
  '&:disabled': { opacity: 0.35 }
} as const;

// An arrow orbiting a floor tile. Drawn CLOCKWISE (over the top, left to right,
// head down on the right); the counter-clockwise button is its mirror. A solid
// diamond under an open arc — no ellipse-and-dot, which read as an eye.
const OrbitIcon = ({ clockwise }: { clockwise: boolean }) => (
  <svg
    viewBox="0 0 20 20"
    width="18"
    height="18"
    style={clockwise ? undefined : { transform: 'scaleX(-1)' }}
    aria-hidden="true"
  >
    <path
      d="M10 9 L15.5 11.75 L10 14.5 L4.5 11.75 Z"
      fill="currentColor"
      opacity="0.45"
    />
    <path
      d="M3 9.5 A7 5 0 0 1 17 9.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <path d="M14.4 8.9 H19.6 L17 12.7 Z" fill="currentColor" />
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
  // Highlighted while the view sits on a pinned page default: clicking unpins.
  const pinned = atDefault && hasDefault;
  // A default exists but the view is elsewhere: the pin stays filled (so the
  // default is never invisible) and offers replace / remove.
  const pinnedElsewhere = hasDefault && !atDefault;
  const [pinMenuAnchor, setPinMenuAnchor] = useState<HTMLElement | null>(null);
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
    setAnnouncement(t('announce').replace('{angle}', formatViewAngle(settled)));
  }, [settled, inMotion, t]);

  const disabledHint = t('disabledIn2D');
  // The step buttons also teach the free orbit, which has no button of its own.
  const stepTitle = (label: string) =>
    isIso ? (
      <>
        {label}
        <br />
        {t('orbitHint')}
      </>
    ) : (
      disabledHint
    );
  const readoutTitle = atDefault
    ? t('atDefault').replace('{angle}', formatViewAngle(rotation))
    : t('resetToDefault')
        .replace('{angle}', formatViewAngle(rotation))
        .replace('{default}', formatViewAngle(pageDefault));
  const pinTitle = !isIso
    ? disabledHint
    : pinned
      ? `${t('unpinPageDefault')} — ${t('unpinPageDefaultHint').replace(
          '{angle}',
          formatViewAngle(pageDefault)
        )}`
      : pinnedElsewhere
        ? t('pinnedElsewhereHint').replace('{default}', formatViewAngle(pageDefault))
        : atDefault
        ? t('nothingToPin')
        : `${t('setAsPageDefault')} — ${t('setAsPageDefaultHint').replace(
            '{angle}',
            formatViewAngle(rotation)
          )}`;

  // Mid-step, land the animation first: a default is the angle the step was
  // going to, never an intermediate frame.
  const landAnimation = () => {
    if (uiApi.getState().viewRotationInMotion) {
      actions.finishViewRotationAnimation();
    }
  };

  // Each change reaches everyone who opens the page, so it is confirmed in
  // words, not left to a hover tooltip — and stays one undo step.
  const removePageDefault = () => {
    if (!viewId) return;
    landAnimation();
    // The field goes (lean save) and the page opens at 0° again. The camera
    // stays where it is, so the pin is offered again right away.
    updateView(viewId, { defaultRotation: undefined });
    actions.setNotification({ message: t('unpinnedNotice'), severity: 'info' });
  };

  const setPageDefault = () => {
    if (!viewId) return;
    landAnimation();
    // One timestamped UPDATE_VIEW = one undo step, dirty + autosave like any
    // edit (ADR 0051 §2). 0 removes the field (lean save); rounded to 0.1°.
    const landed = uiApi.getState().viewRotation;
    const value = Math.round(normaliseDeg(landed) * 10) / 10;
    updateView(viewId, { defaultRotation: value === 0 ? undefined : value });
    actions.setNotification({
      message: t('pinnedNotice').replace('{angle}', formatViewAngle(value)),
      severity: 'success'
    });
  };

  const onPinClick = (e: React.MouseEvent<HTMLElement>) => {
    if (pinned) removePageDefault();
    else if (pinnedElsewhere) setPinMenuAnchor(e.currentTarget);
    else setPageDefault();
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
        title={stepTitle(t('rotateCounterClockwise'))}
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
            <OrbitIcon clockwise={false} />
          </IconButton>
        </span>
      </Tooltip>

      <Tooltip title={isIso ? readoutTitle : disabledHint} placement="top">
        <span>
          <ButtonBase
            disabled={!isIso || atDefault}
            aria-label={readoutTitle}
            onClick={() => actions.animateViewRotationTo(pageDefault)}
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
              // At the default only the reset ARROW fades: the angle is a value
              // to read, and greying it made the readout look broken.
              '&.Mui-disabled': {
                color: 'text.primary',
                opacity: isIso ? 1 : 0.35
              },
              '&.Mui-disabled svg': { opacity: 0.3 }
            }}
          >
            <ResetIcon />
            {formatViewAngle(rotation)}
          </ButtonBase>
        </span>
      </Tooltip>

      <Tooltip
        title={stepTitle(t('rotateClockwise'))}
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
            <OrbitIcon clockwise />
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
              aria-label={
                pinned
                  ? t('unpinPageDefault')
                  : pinnedElsewhere
                    ? t('pinnedElsewhereHint').replace(
                        '{default}',
                        formatViewAngle(pageDefault)
                      )
                    : t('setAsPageDefault')
              }
              aria-pressed={isIso && pinned}
              aria-haspopup={pinnedElsewhere ? 'menu' : undefined}
              onClick={onPinClick}
              data-axoview-id="view-rotation-set-default"
            >
              {hasDefault && isIso ? (
                <PinnedIcon sx={{ fontSize: 16 }} />
              ) : (
                <PinIcon sx={{ fontSize: 16 }} />
              )}
            </IconButton>
          </span>
        </Tooltip>
      )}
      <Menu
        anchorEl={pinMenuAnchor}
        open={!!pinMenuAnchor}
        onClose={() => setPinMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <MenuItem
          dense
          data-axoview-id="view-rotation-replace-default"
          onClick={() => {
            setPinMenuAnchor(null);
            setPageDefault();
          }}
        >
          {t('replacePageDefault')
            .replace('{angle}', formatViewAngle(rotation))
            .replace('{default}', formatViewAngle(pageDefault))}
        </MenuItem>
        <MenuItem
          dense
          data-axoview-id="view-rotation-remove-default"
          onClick={() => {
            setPinMenuAnchor(null);
            removePageDefault();
          }}
        >
          {t('removePageDefault').replace('{default}', formatViewAngle(pageDefault))}
        </MenuItem>
      </Menu>

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
