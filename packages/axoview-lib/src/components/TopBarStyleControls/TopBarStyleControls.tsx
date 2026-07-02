import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  IconButton,
  Popover,
  Tooltip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Switch,
  Slider,
  Typography,
  TextField,
  Autocomplete,
  Stack
} from '@mui/material';
import {
  FormatColorText as TextColorIcon,
  FormatSize as TextSizeIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  StrikethroughS as StrikethroughIcon,
  FormatColorFill as FillIcon,
  BorderStyle as BorderIcon,
  Timeline as ConnectionColorIcon,
  TextRotationNone as TextRotationNoneIcon,
  EditNote as RichTextIcon,
  PhotoSizeSelectLarge as IconSizeIcon,
  ImageOutlined as ChangeIconIcon,
  ArrowDropDown as CaretIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  InsertLink as LinkStripIcon,
  OpenInNew as OpenInNewIcon,
  VisibilityOutlined as ShowLabelIcon,
  VisibilityOffOutlined as HideLabelIcon
} from '@mui/icons-material';
import { LABEL_BASE_FONT_PX } from 'src/config/labelSettings';
import { useTranslation } from 'src/stores/localeStore';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { useModelItem } from 'src/hooks/useModelItem';
import { useScene } from 'src/hooks/useScene';
import { useViewItem } from 'src/hooks/useViewItem';
import { useTextBox } from 'src/hooks/useTextBox';
import { useLabel } from 'src/hooks/useLabel';
import { useConnector } from 'src/hooks/useConnector';
import { useRectangle } from 'src/hooks/useRectangle';
import { ProjectionOrientationEnum } from 'src/types';
import { connectorStyleOptions, connectorLineTypeOptions } from 'src/schemas';
import { getIsoProjectionCss } from 'src/utils';
import { LabelColorPicker } from '../ItemControls/components/LabelColorPicker';
import { ColorSwatch } from '../ColorSelector/ColorSwatch';
import { CustomColorInput } from '../ColorSelector/CustomColorInput';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import { QuickIconSelector } from '../ItemControls/NodeControls/QuickIconSelector';
import { resolveHomogeneousBulk } from 'src/utils/bulkStyleTarget';

// Unified on-canvas label size range (px). Node labels, floating Labels, and
// connector labels all share this range/step so the size control means the same
// thing across every label type (size-consistency pass, 2026-07-01). The text
// box is intentionally excluded — its size is a zoom SCALE (tile-space), not a
// screen-px chrome size, so it keeps its own control.
const LABEL_SIZE_MIN = 10;
const LABEL_SIZE_MAX = 40;
const LABEL_SIZE_STEP = 2;

// Google-Docs-style inline strip and the CANONICAL styling surface (ADR 0030):
// the single writer of visual styling for every item type. There is no
// side-panel Style tab — the item panel is Details / Notes only; all visual
// styling is reached here. It is portaled (via UiOverlay) into a slot the app
// provides next to the session badge, so it lives INSIDE the lib's store
// providers and can read selection + write through useScene like the detail
// panels.

type LineStyle = (typeof connectorStyleOptions)[number];
type LineType = (typeof connectorLineTypeOptions)[number];

const STYLE_DASHARRAY: Record<LineStyle, string | undefined> = {
  SOLID: undefined,
  DOTTED: '2 3',
  DASHED: '6 4'
};

// Mirrors the connector detail-panel previews so the two read identically.
const LineStylePreview = ({ style }: { style: LineStyle }) => (
  <svg width={26} height={12} viewBox="0 0 26 12" aria-hidden="true">
    <line
      x1={2}
      y1={6}
      x2={24}
      y2={6}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeDasharray={STYLE_DASHARRAY[style]}
    />
  </svg>
);

const LineTypePreview = ({ type }: { type: LineType }) => {
  if (type === 'SINGLE') {
    return (
      <svg width={26} height={12} viewBox="0 0 26 12" aria-hidden="true">
        <line x1={2} y1={6} x2={24} y2={6} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={26} height={12} viewBox="0 0 26 12" aria-hidden="true">
      <line x1={2} y1={4} x2={24} y2={4} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={2} y1={8} x2={24} y2={8} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      {type === 'DOUBLE_WITH_CIRCLE' && (
        <circle cx={13} cy={6} r={3} fill="none" stroke="currentColor" strokeWidth={1.5} />
      )}
    </svg>
  );
};

interface StripButtonProps {
  tooltip: string;
  disabled?: boolean;
  icon: React.ReactNode;
  /** Resolved hex shown as a thin underline bar; omit for non-colour controls. */
  colorBar?: string;
  popoverWidth?: number;
  /** Optional test hook on the trigger button (e2e). */
  testId?: string;
  /** Draw an accent ring to advertise the control is live (arm-time hint). */
  highlight?: boolean;
  children: React.ReactNode;
}

// A single strip control: icon (+ optional colour underline) + caret that opens
// a Popover hosting the same control body used in the detail panels. The body is
// only mounted while the popover is open (MUI unmounts on close), so it re-seeds
// from the current selection every time it is opened.
const StripButton = ({
  tooltip,
  disabled,
  icon,
  colorBar,
  popoverWidth = 240,
  testId,
  highlight,
  children
}: StripButtonProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <>
      <Tooltip title={tooltip} placement="bottom">
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            data-testid={testId}
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={{
              borderRadius: 1,
              // Strong enabled vs faded disabled contrast. The theme pins
              // SvgIcon to `color: 'action'` (0.54) regardless of disabled
              // state, so force icons to inherit the button colour — otherwise
              // enabled and disabled controls look identical (UX §2.5).
              color: disabled ? 'action.disabled' : 'text.primary',
              '& .MuiSvgIcon-root': { color: 'inherit' },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              px: 0.5,
              py: 0.25,
              // Arm-time discoverability hint: a subtle accent ring so the user
              // notices these controls are LIVE before drawing (they edit the
              // pre-draw defaults). Cleared once something is selected.
              ...(highlight
                ? {
                    boxShadow: (theme) =>
                      `0 0 0 2px ${theme.palette.primary.main}`,
                    bgcolor: 'action.hover'
                  }
                : {})
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {icon}
              <CaretIcon sx={{ fontSize: 14, ml: '-2px' }} />
            </Box>
            {colorBar !== undefined && (
              <Box
                sx={{
                  width: 18,
                  height: 3,
                  borderRadius: 1,
                  mt: '1px',
                  bgcolor: disabled ? 'action.disabled' : colorBar || '#000000'
                }}
              />
            )}
          </IconButton>
        </span>
      </Tooltip>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, width: popoverWidth }}>{children}</Box>
      </Popover>
    </>
  );
};

const WHITE = '#ffffff';
// Sentinel stored in a fill's customColor to mean "transparent" (a no-fill
// rectangle keeps a visible outline and stays hittable — see Rectangle.tsx).
const TRANSPARENT = 'transparent';
const isQuickColor = (c?: string) => {
  const v = (c || '').toLowerCase();
  return v === WHITE || v === TRANSPARENT;
};

// "No color" swatch (white circle + red slash), matching ColorSwatch's footprint
// so it sits inline with the colour swatches.
const NoColorSwatch = ({
  isActive,
  onClick
}: {
  isActive?: boolean;
  onClick: () => void;
}) => {
  const { t } = useTranslation('topBarStyleControls');
  return (
  <Button
    onClick={onClick}
    variant="text"
    size="small"
    aria-label={t('noColor')}
    sx={{ width: 40, height: 40, minWidth: 'auto' }}
  >
    <Box
      sx={{
        position: 'relative',
        width: 28,
        height: 28,
        borderRadius: '100%',
        border: '1px solid',
        borderColor: 'grey.600',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        transform: `scale(${isActive ? 1.25 : 1})`
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '-10%',
          width: '120%',
          height: '2px',
          bgcolor: 'error.main',
          transform: 'translateY(-50%) rotate(-45deg)'
        }}
      />
    </Box>
  </Button>
  );
};

interface PresetCustomColorProps {
  presetId?: string;
  customColor?: string;
  onSelectPreset: (id: string) => void;
  onCustomChange: (hex: string) => void;
  onDisableCustom: () => void;
  // When provided, a "no color" swatch clears the fill (transparent) — used for
  // a text box / label background and the rectangle fill.
  onNoColor?: () => void;
  // Whether an ABSENT value (no preset + no custom) should read as "no color".
  // True for fill/background, where absent renders nothing. False for the
  // rectangle border, where an absent borderColor renders a DERIVED stroke — so
  // the No-color swatch must NOT show active just because the colour is unset.
  // Default true.
  absentIsNoColor?: boolean;
}

// The preset-or-custom colour body shared by the rectangle-fill, text/label
// background and connector-colour controls. White trails the scene presets
// (lightest-last convention); "no color" trails white where clearing is
// meaningful (onNoColor supplied). All swatches flow inline in one grid.
const PresetCustomColor = ({
  presetId,
  customColor,
  onSelectPreset,
  onCustomChange,
  onDisableCustom,
  onNoColor,
  absentIsNoColor = true
}: PresetCustomColorProps) => {
  const { t } = useTranslation('topBarStyleControls');
  const { colors } = useScene();
  // White / transparent are fixed swatches, not "custom" — keep them in the grid
  // view so reopening the popover doesn't land on the custom input.
  const [useCustom, setUseCustom] = useState(
    Boolean(customColor) && !isQuickColor(customColor)
  );
  const whiteActive = (customColor || '').toLowerCase() === WHITE;
  const noColorActive =
    (customColor || '').toLowerCase() === TRANSPARENT ||
    (absentIsNoColor && !presetId && !customColor);

  return (
    <Box>
      <FormControlLabel
        sx={{ mb: 1 }}
        control={
          <Switch
            checked={useCustom}
            onChange={(e) => {
              setUseCustom(e.target.checked);
              if (!e.target.checked) onDisableCustom();
            }}
          />
        }
        label={t('customColor')}
      />
      {useCustom ? (
        <CustomColorInput value={customColor || '#000000'} onChange={onCustomChange} />
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
          {colors.map((color) => (
            <ColorSwatch
              key={color.id}
              hex={color.value}
              isActive={!whiteActive && !noColorActive && presetId === color.id}
              onClick={() => onSelectPreset(color.id)}
            />
          ))}
          <ColorSwatch
            hex={WHITE}
            isActive={whiteActive}
            onClick={() => onCustomChange(WHITE)}
          />
          {onNoColor && (
            <NoColorSwatch isActive={noColorActive} onClick={onNoColor} />
          )}
        </Box>
      )}
    </Box>
  );
};

// Clean slider with a persistent value readout in the header (always visible —
// no hover/click needed) + plain tick marks + the drag bubble. Shared by the
// icon-size and connector-width controls so they read identically.
const LabeledSlider = ({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) => (
  <Box>
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        mb: 0.5
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="caption"
        color="text.primary"
        sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
      >
        {displayValue}
      </Typography>
    </Box>
    <Box sx={{ px: 1 }}>
      <Slider
        marks
        step={step}
        min={min}
        max={max}
        size="small"
        valueLabelDisplay="auto"
        value={value}
        onChange={(_e, v) => onChange(v as number)}
      />
    </Box>
  </Box>
);

// "Text size" presented as a uniform 0–100% scale regardless of selection, then
// mapped to each type's native range (node/connector labels are px, a text box
// is an iso-space scale factor). The UI reads identically across types; the
// value written under the hood is snapped to the type's native step.
const PercentSizeSlider = ({
  value,
  min,
  max,
  step,
  onChange
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (native: number) => void;
}) => {
  const { t } = useTranslation('topBarStyleControls');
  const toPct = (v: number) =>
    max === min ? 0 : ((v - min) / (max - min)) * 100;
  const toNative = (pct: number) => {
    const raw = min + (pct / 100) * (max - min);
    const snapped = min + Math.round((raw - min) / step) * step;
    return Math.min(max, Math.max(min, Number(snapped.toFixed(4))));
  };
  const pct = Math.round(toPct(value));

  return (
    <LabeledSlider
      label={t('textSize')}
      value={pct}
      displayValue={`${pct}%`}
      min={0}
      max={100}
      step={5}
      onChange={(p) => onChange(toNative(p))}
    />
  );
};

// Icon-size slider with local state + debounce (mirrors NodeStyleTab) so the
// model store isn't thrashed on every drag tick. Mounted only inside the open
// popover, so it re-seeds from the current scale each time it opens.
const IconSizeControl = ({
  initialScale,
  onChange
}: {
  initialScale: number;
  onChange: (scale: number) => void;
}) => {
  const { t } = useTranslation('topBarStyleControls');
  const [localScale, setLocalScale] = useState(initialScale);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    []
  );

  return (
    <LabeledSlider
      label={t('iconSize')}
      value={localScale}
      displayValue={`${localScale.toFixed(1)}×`}
      min={0.3}
      max={2.5}
      step={0.1}
      onChange={(scale) => {
        setLocalScale(scale);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => onChange(scale), 100);
      }}
    />
  );
};

export const TopBarStyleControls = () => {
  const { t } = useTranslation('topBarStyleControls');
  const itemControls = useUiStateStore((s) => s.itemControls);
  const selectedIds = useUiStateStore((s) => s.selectedIds);
  const mode = useUiStateStore((s) => s.mode);
  const selectedConnectorLabel = useUiStateStore(
    (s) => s.selectedConnectorLabel
  );
  const connectorDefaults = useUiStateStore((s) => s.connectorDefaults);
  const setConnectorDefaults = useUiStateStore(
    (s) => s.actions.setConnectorDefaults
  );
  // Diagram-to-diagram link targets (app-supplied). Powers the strip Link
  // control's "Link to diagram" picker (D2 — consolidated from the node deck).
  const linkedDiagrams = useUiStateStore((s) => s.linkedDiagrams);
  const {
    colors,
    currentView,
    transaction,
    // Raw single-target writers — wrapped below into bulk-aware shadows.
    updateViewItem: applyViewItem,
    updateModelItem,
    updateTextBox: applyTextBox,
    updateLabel: applyLabel,
    updateConnector: applyConnector,
    updateRectangle: applyRectangle
  } = useScene();

  // S4 (#7) — ADR 0030 §2 amendment. A homogeneous multi-selection (every
  // selected item shares a type) is a bulk-style target; the strip enables and
  // each control's writer fans out across the whole selection in ONE
  // transaction (one undo entry). Heterogeneous multi stays disabled.
  const bulk = useMemo(
    () => resolveHomogeneousBulk(selectedIds),
    [selectedIds]
  );
  const isBulk = !!bulk;

  // Representative target — the single controlled item, or the FIRST of a
  // homogeneous multi-selection. Drives every control's displayed value (the
  // type-keyed hooks below resolve against it) while writes fan out.
  const sel = useMemo(
    () =>
      itemControls && itemControls.type !== 'ADD_ITEM'
        ? itemControls
        : bulk
        ? { type: bulk.type, id: bulk.ids[0] }
        : null,
    [itemControls, bulk]
  );

  // Apply a per-id update to every target of `type` (the homogeneous selection,
  // or the single representative). Multi fans out inside one transaction so the
  // change is a single undo entry — mirrors deleteSelectedItems' pattern.
  const applyToTargets = useCallback(
    (type: string, apply: (id: string) => void) => {
      const ids =
        bulk && bulk.type === type
          ? bulk.ids
          : sel && sel.type === type
          ? [sel.id]
          : [];
      if (ids.length <= 1) ids.forEach(apply);
      else transaction(() => ids.forEach(apply));
    },
    [bulk, sel, transaction]
  );

  // Bulk-aware shadows: every single-target writer below now fans out across a
  // homogeneous multi-selection automatically (the `id` arg is the
  // representative; targets are resolved by type). Icon change/size and
  // rich-text stay single — they're gated on !isBulk where rendered.
  const updateViewItem = useCallback(
    (_id: string, patch: Parameters<typeof applyViewItem>[1]) =>
      applyToTargets('ITEM', (tid) => applyViewItem(tid, patch)),
    [applyToTargets, applyViewItem]
  );
  const updateTextBox = useCallback(
    (_id: string, patch: Parameters<typeof applyTextBox>[1]) =>
      applyToTargets('TEXTBOX', (tid) => applyTextBox(tid, patch)),
    [applyToTargets, applyTextBox]
  );
  const updateLabel = useCallback(
    (_id: string, patch: Parameters<typeof applyLabel>[1]) =>
      applyToTargets('LABEL', (tid) => applyLabel(tid, patch)),
    [applyToTargets, applyLabel]
  );
  const updateConnector = useCallback(
    (_id: string, patch: Parameters<typeof applyConnector>[1]) =>
      applyToTargets('CONNECTOR', (tid) => applyConnector(tid, patch)),
    [applyToTargets, applyConnector]
  );
  const updateRectangle = useCallback(
    (_id: string, patch: Parameters<typeof applyRectangle>[1]) =>
      applyToTargets('RECTANGLE', (tid) => applyRectangle(tid, patch)),
    [applyToTargets, applyRectangle]
  );

  // #11 — relative font-size nudge for node labels / floating Labels. Each
  // selected target steps from ITS OWN current size (preserving relative
  // differences across a multi-selection), clamped, in one transaction.
  const clampNum = (v: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, v));
  // Hooks must run unconditionally; each returns null when the id is absent from
  // its collection, so gating by type keeps cross-collection id collisions safe.
  const node = useViewItem(sel?.type === 'ITEM' ? sel.id : '');
  const textBox = useTextBox(sel?.type === 'TEXTBOX' ? sel.id : '');
  const connector = useConnector(sel?.type === 'CONNECTOR' ? sel.id : '');
  const rectangle = useRectangle(sel?.type === 'RECTANGLE' ? sel.id : '');
  const label = useLabel(sel?.type === 'LABEL' ? sel.id : '');

  // Icon size lives on the model icon's `scale` (shared by every node using that
  // icon) — same source the NodeStyleTab "Icon size" slider writes to.
  const modelItem = useModelItem(sel?.type === 'ITEM' ? sel.id : '');
  const icons = useModelStore((s) => s.icons);
  const modelActions = useModelStore((s) => s.actions);
  const currentIcon = icons.find((i) => i.id === modelItem?.icon);
  const applyIconScale = (scale: number) => {
    if (!currentIcon) return;
    modelActions.set({
      icons: icons.map((i) => (i.id === currentIcon.id ? { ...i, scale } : i))
    });
  };

  const resolveHex = (presetId?: string, customColor?: string) =>
    customColor || colors.find((c) => c.id === presetId)?.value;

  // --- Text colour / size target the ONE selected connector label (a labels[]
  // entry the user clicked on canvas), so styling is per-label rather than
  // applied to every label at once. Node / text box are unchanged.
  const connectorLabels = connector?.labels ?? [];
  const activeLabelId =
    connector && selectedConnectorLabel?.connectorId === connector.id
      ? selectedConnectorLabel.labelId
      : null;
  // The primary name label ('__name__') stores its style on the connector's
  // nameLabel* fields, not in labels[]; every other selected label is a labels[]
  // entry.
  const isNameLabel = !!connector && activeLabelId === '__name__';
  const activeLabel =
    activeLabelId && activeLabelId !== '__name__'
      ? connectorLabels.find((l) => l.id === activeLabelId) ?? null
      : null;
  const updateActiveLabel = (patch: Partial<(typeof connectorLabels)[number]>) => {
    if (!connector || !activeLabel) return;
    updateConnector(connector.id, {
      labels: connectorLabels.map((l) =>
        l.id === activeLabel.id ? { ...l, ...patch } : l
      )
    });
  };

  // #11 / size-consistency: relative +/- font nudge for every on-canvas LABEL
  // type (node label, floating Label, connector name/added label) — each steps
  // from its OWN size, clamped to the unified px range, so the +/- control means
  // the same thing everywhere. Text box excluded (its size is a zoom scale).
  const nudgeFontSize = (delta: number) => {
    if (node) {
      applyToTargets('ITEM', (id) => {
        const cur =
          currentView.items?.find((i) => i.id === id)?.labelFontSize ??
          LABEL_BASE_FONT_PX;
        applyViewItem(id, {
          labelFontSize: clampNum(cur + delta, LABEL_SIZE_MIN, LABEL_SIZE_MAX)
        });
      });
    } else if (label) {
      applyToTargets('LABEL', (id) => {
        const cur =
          currentView.labels?.find((l) => l.id === id)?.fontSize ??
          LABEL_BASE_FONT_PX;
        applyLabel(id, {
          fontSize: clampNum(cur + delta, LABEL_SIZE_MIN, LABEL_SIZE_MAX)
        });
      });
    } else if (isNameLabel && connector) {
      const cur = connector.nameLabelFontSize ?? LABEL_BASE_FONT_PX;
      updateConnector(connector.id, {
        nameLabelFontSize: clampNum(cur + delta, LABEL_SIZE_MIN, LABEL_SIZE_MAX)
      });
    } else if (activeLabel) {
      const cur = activeLabel.fontSize ?? LABEL_BASE_FONT_PX;
      updateActiveLabel({
        fontSize: clampNum(cur + delta, LABEL_SIZE_MIN, LABEL_SIZE_MAX)
      });
    }
  };
  // Does the current target support the px label-size control (everything except
  // the scale-based text box)?
  const hasLabelSizeTarget = Boolean(node || label || isNameLabel || activeLabel);

  // Cross-type label sizing (owner 2026-07-02): when a MIXED selection is
  // active (e.g. a node + a connection) the normal homogeneous bulk path is off,
  // but the ONE thing that means the same across those types — the on-canvas
  // label font size — should still be adjustable together. Enabled only when
  // every selected item is a label-bearing type (node / floating label /
  // connector); a rectangle/text box in the mix keeps the strip disabled.
  const crossTypeLabelIds = useMemo(() => {
    if (selectedIds.length < 2) return null;
    const types = new Set(selectedIds.map((r) => r.type));
    if (types.size <= 1) return null; // homogeneous → handled by the normal path
    const allLabelBearing = selectedIds.every(
      (r) => r.type === 'ITEM' || r.type === 'LABEL' || r.type === 'CONNECTOR'
    );
    return allLabelBearing ? selectedIds : null;
  }, [selectedIds]);

  const nudgeCrossTypeLabelSize = (delta: number) => {
    if (!crossTypeLabelIds) return;
    transaction(() => {
      crossTypeLabelIds.forEach((ref) => {
        if (ref.type === 'ITEM') {
          const cur =
            currentView.items?.find((i) => i.id === ref.id)?.labelFontSize ??
            LABEL_BASE_FONT_PX;
          applyViewItem(ref.id, {
            labelFontSize: clampNum(cur + delta, LABEL_SIZE_MIN, LABEL_SIZE_MAX)
          });
        } else if (ref.type === 'LABEL') {
          const cur =
            currentView.labels?.find((l) => l.id === ref.id)?.fontSize ??
            LABEL_BASE_FONT_PX;
          applyLabel(ref.id, {
            fontSize: clampNum(cur + delta, LABEL_SIZE_MIN, LABEL_SIZE_MAX)
          });
        } else if (ref.type === 'CONNECTOR') {
          const cur =
            currentView.connectors?.find((c) => c.id === ref.id)
              ?.nameLabelFontSize ?? LABEL_BASE_FONT_PX;
          applyConnector(ref.id, {
            nameLabelFontSize: clampNum(
              cur + delta,
              LABEL_SIZE_MIN,
              LABEL_SIZE_MAX
            )
          });
        }
      });
    });
  };

  const textColorEnabled = Boolean(
    node || textBox || label || activeLabel || isNameLabel
  );
  const textColorValue = node
    ? node.labelColor
    : textBox
    ? textBox.color
    : label
    ? label.color
    : isNameLabel
    ? connector?.nameLabelColor
    : activeLabel?.labelColor;
  const onTextColorChange = (color: string | undefined) => {
    if (node) updateViewItem(node.id, { labelColor: color });
    else if (textBox) updateTextBox(textBox.id, { color });
    else if (label) updateLabel(label.id, { color });
    else if (isNameLabel && connector)
      updateConnector(connector.id, { nameLabelColor: color });
    else if (activeLabel) updateActiveLabel({ labelColor: color });
  };

  // --- Text size. Every LABEL type (node / floating / connector) now shares one
  // px range (LABEL_SIZE_MIN..MAX) so the control is consistent; the text box
  // keeps its zoom-scale range (0.15–0.9) since its size is tile-space, not
  // screen-px chrome.
  const textSize: {
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
  } | null = node
    ? {
        value: node.labelFontSize ?? LABEL_BASE_FONT_PX,
        min: LABEL_SIZE_MIN,
        max: LABEL_SIZE_MAX,
        step: LABEL_SIZE_STEP,
        onChange: (v) => updateViewItem(node.id, { labelFontSize: v })
      }
    : textBox
    ? {
        value: textBox.fontSize ?? 0.15,
        min: 0.15,
        max: 0.9,
        step: 0.15,
        onChange: (v) => updateTextBox(textBox.id, { fontSize: v })
      }
    : label
    ? {
        value: label.fontSize ?? LABEL_BASE_FONT_PX,
        min: LABEL_SIZE_MIN,
        max: LABEL_SIZE_MAX,
        step: LABEL_SIZE_STEP,
        onChange: (v) => updateLabel(label.id, { fontSize: v })
      }
    : isNameLabel && connector
    ? {
        value: connector.nameLabelFontSize ?? LABEL_BASE_FONT_PX,
        min: LABEL_SIZE_MIN,
        max: LABEL_SIZE_MAX,
        step: LABEL_SIZE_STEP,
        onChange: (v) =>
          updateConnector(connector.id, { nameLabelFontSize: v })
      }
    : activeLabel
    ? {
        value: activeLabel.fontSize ?? LABEL_BASE_FONT_PX,
        min: LABEL_SIZE_MIN,
        max: LABEL_SIZE_MAX,
        step: LABEL_SIZE_STEP,
        onChange: (v) => updateActiveLabel({ fontSize: v })
      }
    : null;

  // --- Bold / italic / strikethrough — same target resolution as text colour,
  // for the things WITHOUT a rich-text editor: a node label, a connector name
  // label, a selected connector labels[] entry, and a floating Label chip.
  // A plain text box is EXCLUDED — it formats per-character via its rich-text
  // editor, so a whole-box B/I/S would fight that (two layers; CSS can't
  // subtract). Each supported type stores its own boolean trio.
  const formatEnabled = Boolean(node || label || activeLabel || isNameLabel);
  const formatValue = {
    bold: node
      ? node.labelBold
      : label
      ? label.isBold
      : isNameLabel
      ? connector?.nameLabelBold
      : activeLabel?.bold,
    italic: node
      ? node.labelItalic
      : label
      ? label.isItalic
      : isNameLabel
      ? connector?.nameLabelItalic
      : activeLabel?.italic,
    strike: node
      ? node.labelStrikethrough
      : label
      ? label.isStrikethrough
      : isNameLabel
      ? connector?.nameLabelStrikethrough
      : activeLabel?.strikethrough
  };
  const setFormat = (next: {
    bold: boolean;
    italic: boolean;
    strike: boolean;
  }) => {
    if (node)
      updateViewItem(node.id, {
        labelBold: next.bold,
        labelItalic: next.italic,
        labelStrikethrough: next.strike
      });
    else if (label)
      updateLabel(label.id, {
        isBold: next.bold,
        isItalic: next.italic,
        isStrikethrough: next.strike
      });
    else if (isNameLabel && connector)
      updateConnector(connector.id, {
        nameLabelBold: next.bold,
        nameLabelItalic: next.italic,
        nameLabelStrikethrough: next.strike
      });
    else if (activeLabel)
      updateActiveLabel({
        bold: next.bold,
        italic: next.italic,
        strikethrough: next.strike
      });
  };

  // --- Connector style target. The connection-colour + line-options controls
  // operate on the selected connector, or — when the connector tool is armed
  // with nothing selected — on the pending defaults the next drawn connector
  // inherits. This is what makes the controls usable BEFORE drawing.
  const connectorToolActive = mode.type === 'CONNECTOR';
  // Discoverability (owner 2026-07-01): when the connector tool is armed with
  // nothing selected, the color/line controls already edit the PRE-DRAW
  // defaults — but testers didn't notice. Flag that state to add an accent-ring
  // hint + "next connection" wording so the pre-styling affordance is visible.
  const connectorArmed = connectorToolActive && !connector;
  const connStyle = connector
    ? {
        color: connector.color,
        customColor: connector.customColor,
        style: connector.style,
        lineType: connector.lineType,
        width: connector.width,
        showArrow: connector.showArrow,
        apply: (patch: Parameters<typeof setConnectorDefaults>[0]) =>
          updateConnector(connector.id, patch)
      }
    : connectorToolActive
    ? {
        color: connectorDefaults.color,
        customColor: connectorDefaults.customColor,
        style: connectorDefaults.style,
        lineType: connectorDefaults.lineType,
        width: connectorDefaults.width,
        showArrow: connectorDefaults.showArrow,
        apply: setConnectorDefaults
      }
    : null;

  // --- Link (owner 2026-07-01): set/clear an external link straight from the
  // strip so you don't have to open the Details deck. Node → modelItem.headerLink
  // (also renders the on-canvas label as a link); connector / floating Label →
  // their headerLink (surfaced in the view-mode info popover).
  const linkEnabled = Boolean(node || connector || label);
  // When a specific connector label is selected on canvas, the Link control
  // targets THAT label's headerLink (#4, parity with node-label links); with the
  // connector itself selected (no label), it targets the whole-connector link.
  const linkValue = node
    ? modelItem?.headerLink
    : activeLabel
    ? activeLabel.headerLink
    : connector
    ? connector.headerLink
    : label
    ? label.headerLink
    : undefined;
  const onLinkChange = (raw: string) => {
    const next = raw.trim() || undefined;
    if (node) updateModelItem(node.id, { headerLink: next });
    else if (activeLabel) updateActiveLabel({ headerLink: next });
    else if (connector) updateConnector(connector.id, { headerLink: next });
    else if (label) updateLabel(label.id, { headerLink: next });
  };

  // --- Show / hide the on-canvas node label (viewItem.showLabel) — previously
  // only reachable via Details / Layers. Bulk-aware (updateViewItem fans out).
  const labelHidden = node?.showLabel === false;
  const onToggleShowLabel = () => {
    if (node) updateViewItem(node.id, { showLabel: labelHidden ? undefined : false });
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        flexShrink: 0
      }}
    >
      {/* Text colour */}
      <StripButton
        tooltip={
          textColorEnabled
            ? t('textColor')
            : t('textColorDisabled')
        }
        disabled={!textColorEnabled}
        icon={<TextColorIcon sx={{ fontSize: 18 }} />}
        colorBar={textColorValue || '#000000'}
      >
        <LabelColorPicker value={textColorValue} onChange={onTextColorChange} />
      </StripButton>

      {/* Text size */}
      <StripButton
        tooltip={
          textSize
            ? t('textSize')
            : crossTypeLabelIds
            ? t('labelSizeAllSelected')
            : t('textSizeDisabled')
        }
        disabled={!textSize && !crossTypeLabelIds}
        popoverWidth={220}
        testId="strip-text-size"
        icon={<TextSizeIcon sx={{ fontSize: 18 }} />}
      >
        {/* Cross-type mixed selection (e.g. node + connection): no shared
            absolute scale, so offer just the relative +/- label-size stepper
            that bumps each selected item's own label size together. */}
        {!textSize && crossTypeLabelIds && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1
            }}
          >
            <Tooltip title={t('decreaseLabelSize')}>
              <IconButton
                size="small"
                data-testid="crosstype-font-decrease"
                onClick={() => nudgeCrossTypeLabelSize(-2)}
              >
                <RemoveIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Typography variant="caption" color="text.secondary">
              {t('labelSize')}
            </Typography>
            <Tooltip title={t('increaseLabelSize')}>
              <IconButton
                size="small"
                data-testid="crosstype-font-increase"
                onClick={() => nudgeCrossTypeLabelSize(2)}
              >
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
        {textSize && (
          <Box>
            <PercentSizeSlider
              value={textSize.value}
              min={textSize.min}
              max={textSize.max}
              step={textSize.step}
              onChange={textSize.onChange}
            />
            {/* #11: relative +/- stepper for node-label / floating-Label px
                sizes — bumps each selected target from its own size (preserving
                relative differences across a multi-selection). */}
            {hasLabelSizeTarget && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  mt: 1
                }}
              >
                <Tooltip title={t('decreaseSize')}>
                  <IconButton
                    size="small"
                    data-testid="bulk-font-decrease"
                    onClick={() => nudgeFontSize(-2)}
                  >
                    <RemoveIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" color="text.secondary">
                  {isBulk ? t('stepAll') : t('size')}
                </Typography>
                <Tooltip title={t('increaseSize')}>
                  <IconButton
                    size="small"
                    data-testid="bulk-font-increase"
                    onClick={() => nudgeFontSize(2)}
                  >
                    <AddIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        )}
      </StripButton>

      {/* Bold / italic / strikethrough — applies to the whole text box / label
          (a label has no rich-text toolbar, so this is its only B/I/S). On a
          rich text box it layers over inline formatting; clearing here won't
          undo inline <strong>/<em> set via the rich-text editor. */}
      <Tooltip
        title={
          formatEnabled
            ? t('format')
            : t('formatDisabled')
        }
        placement="bottom"
      >
        <span>
          <ToggleButtonGroup
            size="small"
            disabled={!formatEnabled}
            value={
              formatEnabled
                ? [
                    formatValue.bold ? 'bold' : '',
                    formatValue.italic ? 'italic' : '',
                    formatValue.strike ? 'strike' : ''
                  ].filter(Boolean)
                : []
            }
            onChange={(_e, vals: string[]) => {
              if (!formatEnabled) return;
              setFormat({
                bold: vals.includes('bold'),
                italic: vals.includes('italic'),
                strike: vals.includes('strike')
              });
            }}
            sx={{
              '& .MuiSvgIcon-root': { color: 'inherit' },
              '& .MuiToggleButton-root': { color: 'text.primary', px: 0.75 },
              '& .MuiToggleButton-root.Mui-disabled': { color: 'action.disabled' }
            }}
          >
            <ToggleButton value="bold" aria-label={t('bold')}>
              <BoldIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton value="italic" aria-label={t('italic')}>
              <ItalicIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton value="strike" aria-label={t('strikethrough')}>
              <StrikethroughIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </span>
      </Tooltip>

      {/* Background colour — rectangle fill, or a floating Label chip (ADR 0031).
          Clearing it removes the fill (and resets a label chip to white). */}
      <StripButton
        tooltip={
          rectangle || label
            ? t('background')
            : t('backgroundDisabled')
        }
        disabled={!rectangle && !label}
        icon={<FillIcon sx={{ fontSize: 18 }} />}
        colorBar={
          rectangle
            ? resolveHex(rectangle.color, rectangle.customColor)
            : label
            ? label.backgroundColor || '#ffffff'
            : undefined
        }
      >
        {rectangle ? (
          <PresetCustomColor
            presetId={rectangle.color}
            customColor={rectangle.customColor}
            onSelectPreset={(color) =>
              updateRectangle(rectangle.id, { color, customColor: '' })
            }
            onCustomChange={(customColor) =>
              updateRectangle(rectangle.id, { customColor })
            }
            onDisableCustom={() => updateRectangle(rectangle.id, { customColor: '' })}
            onNoColor={() =>
              updateRectangle(rectangle.id, { customColor: TRANSPARENT })
            }
          />
        ) : label ? (
          <PresetCustomColor
            presetId={colors.find((c) => c.value === label.backgroundColor)?.id}
            customColor={
              label.backgroundColor &&
              !colors.some((c) => c.value === label.backgroundColor)
                ? label.backgroundColor
                : undefined
            }
            onSelectPreset={(id) =>
              updateLabel(label.id, { backgroundColor: resolveHex(id) })
            }
            onCustomChange={(hex) =>
              updateLabel(label.id, { backgroundColor: hex })
            }
            onDisableCustom={() =>
              updateLabel(label.id, { backgroundColor: undefined })
            }
            onNoColor={() =>
              updateLabel(label.id, { backgroundColor: undefined })
            }
          />
        ) : null}
        {rectangle ? (
          <Box sx={{ mt: 1.5 }}>
            <LabeledSlider
              label={t('opacity')}
              value={rectangle.fillOpacity ?? 1}
              displayValue={`${Math.round((rectangle.fillOpacity ?? 1) * 100)}%`}
              min={0}
              max={1}
              step={0.1}
              onChange={(v) =>
                updateRectangle(rectangle.id, {
                  fillOpacity: v >= 1 ? undefined : v
                })
              }
            />
          </Box>
        ) : label ? (
          <Box sx={{ mt: 1.5 }}>
            <LabeledSlider
              label={t('opacity')}
              value={label.backgroundOpacity ?? 1}
              displayValue={`${Math.round((label.backgroundOpacity ?? 1) * 100)}%`}
              min={0}
              max={1}
              step={0.1}
              onChange={(v) =>
                updateLabel(label.id, {
                  backgroundOpacity: v >= 1 ? undefined : v
                })
              }
            />
          </Box>
        ) : null}
      </StripButton>

      {/* Border (rectangle) — line style + width + colour for the frame. */}
      <StripButton
        tooltip={
          rectangle ? t('border') : t('borderDisabled')
        }
        disabled={!rectangle}
        popoverWidth={240}
        icon={<BorderIcon sx={{ fontSize: 18 }} />}
        colorBar={rectangle ? rectangle.borderColor || undefined : undefined}
      >
        {rectangle && (
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.5 }}
            >
              {t('lineStyle')}
            </Typography>
            <ToggleButtonGroup
              value={rectangle.borderStyle || 'SOLID'}
              exclusive
              fullWidth
              size="small"
              onChange={(_e, style: LineStyle | null) => {
                if (!style) return;
                updateRectangle(rectangle.id, { borderStyle: style });
              }}
            >
              {connectorStyleOptions.map((style) => (
                <ToggleButton key={style} value={style} aria-label={style}>
                  <LineStylePreview style={style} />
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Box sx={{ mt: 1.5 }}>
              <LabeledSlider
                label={t('width')}
                value={rectangle.borderWidth ?? 2}
                displayValue={String(rectangle.borderWidth ?? 2)}
                min={2}
                max={30}
                step={4}
                onChange={(borderWidth) =>
                  updateRectangle(rectangle.id, { borderWidth })
                }
              />
            </Box>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 1.5, mb: 0.5 }}
            >
              {t('borderColor')}
            </Typography>
            <PresetCustomColor
              presetId={colors.find((c) => c.value === rectangle.borderColor)?.id}
              customColor={
                rectangle.borderColor &&
                !colors.some((c) => c.value === rectangle.borderColor)
                  ? rectangle.borderColor
                  : undefined
              }
              // Absent borderColor renders a DERIVED stroke, not nothing — so an
              // unset border must not light up the No-color swatch.
              absentIsNoColor={false}
              onSelectPreset={(id) =>
                updateRectangle(rectangle.id, { borderColor: resolveHex(id) })
              }
              onCustomChange={(hex) =>
                updateRectangle(rectangle.id, { borderColor: hex })
              }
              onDisableCustom={() =>
                updateRectangle(rectangle.id, { borderColor: undefined })
              }
              onNoColor={() =>
                updateRectangle(rectangle.id, { borderColor: TRANSPARENT })
              }
            />

            <Box sx={{ mt: 1.5 }}>
              <LabeledSlider
                label={t('opacity')}
                value={rectangle.borderOpacity ?? 1}
                displayValue={`${Math.round((rectangle.borderOpacity ?? 1) * 100)}%`}
                min={0}
                max={1}
                step={0.1}
                onChange={(v) =>
                  updateRectangle(rectangle.id, {
                    borderOpacity: v >= 1 ? undefined : v
                  })
                }
              />
            </Box>
          </Box>
        )}
      </StripButton>

      {/* Link — the single Link surface (D2): a web URL for any node / connection
          / floating Label (headerLink), plus a "Link to diagram" picker for a
          node (modelItem.link) when other diagrams exist. Consolidated here from
          the node Details deck so both link kinds live in one place. */}
      <StripButton
        tooltip={
          linkEnabled
            ? t('link')
            : t('linkDisabled')
        }
        disabled={!linkEnabled}
        popoverWidth={280}
        testId="strip-link-button"
        icon={<LinkStripIcon sx={{ fontSize: 18 }} />}
        colorBar={undefined}
      >
        {linkEnabled && (
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.5 }}
            >
              {t('linkToWeb')}
            </Typography>
            <TextField
              autoFocus
              fullWidth
              size="small"
              placeholder={t('webLinkPlaceholder')}
              value={linkValue ?? ''}
              onChange={(e) => onLinkChange(e.target.value)}
              data-axoview-id="strip-link-input"
            />

            {node && linkedDiagrams.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.5 }}
                >
                  {t('linkToDiagram')}
                </Typography>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Autocomplete
                    size="small"
                    sx={{ flex: 1 }}
                    options={linkedDiagrams}
                    getOptionLabel={(opt) =>
                      typeof opt === 'string' ? opt : opt.name
                    }
                    isOptionEqualToValue={(opt, val) => opt.id === val.id}
                    value={
                      linkedDiagrams.find((d) => d.id === modelItem?.link) ?? null
                    }
                    onChange={(_e, newVal) =>
                      updateModelItem(node.id, { link: newVal?.id ?? undefined })
                    }
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder={t('searchDiagrams')}
                        inputProps={{
                          ...params.inputProps,
                          'data-axoview-id': 'strip-link-diagram-picker'
                        }}
                      />
                    )}
                    slotProps={{
                      listbox: {
                        'data-axoview-id': 'strip-link-diagram-listbox'
                      } as React.ComponentProps<'ul'>
                    }}
                    clearOnEscape
                    handleHomeEndKeys={false}
                  />
                  {modelItem?.link && (
                    <Tooltip title={t('openLinkedDiagram')}>
                      <IconButton
                        size="small"
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent('axoview-open-diagram-in-editor', {
                              detail: { id: modelItem.link }
                            })
                          )
                        }
                        data-axoview-id="strip-link-diagram-open"
                      >
                        <OpenInNewIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Stack>
              </Box>
            )}
          </Box>
        )}
      </StripButton>

      {/* Show / hide the on-canvas node label — inline toggle (no popover). */}
      <Tooltip
        title={
          node
            ? labelHidden
              ? t('showLabel')
              : t('hideLabel')
            : t('showHideLabelDisabled')
        }
        placement="bottom"
      >
        <span>
          <IconButton
            size="small"
            disabled={!node}
            onClick={onToggleShowLabel}
            data-testid="strip-toggle-label"
            sx={{
              borderRadius: 1,
              color: !node ? 'action.disabled' : 'text.primary',
              '& .MuiSvgIcon-root': { color: 'inherit' },
              px: 0.5,
              py: 0.25
            }}
          >
            {labelHidden ? (
              <HideLabelIcon sx={{ fontSize: 18 }} />
            ) : (
              <ShowLabelIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </span>
      </Tooltip>

      {/* Change icon (node) — moved here from the node Details panel. Single
          only: an icon is a shared model asset, not a per-selection field. */}
      <StripButton
        tooltip={
          isBulk
            ? t('changeIconBulk')
            : node
            ? t('changeIcon')
            : t('changeIconDisabled')
        }
        disabled={!node || isBulk}
        popoverWidth={320}
        icon={
          currentIcon?.url ? (
            <Box
              component="img"
              src={currentIcon.url}
              sx={{ width: 18, height: 18, display: 'block', objectFit: 'contain' }}
            />
          ) : (
            <ChangeIconIcon sx={{ fontSize: 18 }} />
          )
        }
      >
        {node && (
          <Box sx={{ maxHeight: 360, overflowY: 'auto' }}>
            <QuickIconSelector
              currentIconId={modelItem?.icon}
              onIconSelected={(icon) => updateModelItem(node.id, { icon: icon.id })}
            />
          </Box>
        )}
      </StripButton>

      {/* Icon size (node) */}
      <StripButton
        tooltip={
          isBulk
            ? t('iconSizeBulk')
            : currentIcon
            ? t('iconSize')
            : t('iconSizeDisabled')
        }
        disabled={!currentIcon || isBulk}
        popoverWidth={220}
        icon={<IconSizeIcon sx={{ fontSize: 18 }} />}
      >
        {currentIcon && (
          <IconSizeControl
            initialScale={currentIcon.scale ?? 1}
            onChange={applyIconScale}
          />
        )}
      </StripButton>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Connection colour — the selected connector, or the next-connector
          default while the connector tool is armed. */}
      <StripButton
        tooltip={
          connectorArmed
            ? t('connectionColorPredraw')
            : connStyle
            ? t('connectionColor')
            : t('connectionColorDisabled')
        }
        highlight={connectorArmed}
        disabled={!connStyle}
        icon={<ConnectionColorIcon sx={{ fontSize: 18 }} />}
        colorBar={connStyle ? resolveHex(connStyle.color, connStyle.customColor) : undefined}
      >
        {connStyle && (
          <PresetCustomColor
            presetId={connStyle.color}
            customColor={connStyle.customColor}
            onSelectPreset={(color) => connStyle.apply({ color, customColor: '' })}
            onCustomChange={(customColor) => connStyle.apply({ customColor })}
            onDisableCustom={() => connStyle.apply({ customColor: '' })}
          />
        )}
      </StripButton>

      {/* Connection line options — style + type + width + arrow */}
      <StripButton
        tooltip={
          connectorArmed
            ? t('lineOptionsPredraw')
            : connStyle
            ? t('lineOptions')
            : t('lineOptionsDisabled')
        }
        highlight={connectorArmed}
        disabled={!connStyle}
        popoverWidth={240}
        icon={
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <LineStylePreview style={(connStyle?.style as LineStyle) || 'SOLID'} />
          </Box>
        }
      >
        {connStyle && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {t('lineStyle')}
            </Typography>
            <ToggleButtonGroup
              value={connStyle.style || 'SOLID'}
              exclusive
              fullWidth
              size="small"
              onChange={(_e, style: LineStyle | null) => {
                if (!style) return;
                connStyle.apply({ style });
              }}
            >
              {connectorStyleOptions.map((style) => (
                <ToggleButton key={style} value={style} aria-label={style}>
                  <LineStylePreview style={style} />
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, mb: 0.5 }}>
              {t('lineType')}
            </Typography>
            <ToggleButtonGroup
              value={connStyle.lineType || 'SINGLE'}
              exclusive
              fullWidth
              size="small"
              onChange={(_e, lineType: LineType | null) => {
                if (!lineType) return;
                connStyle.apply({ lineType });
              }}
            >
              {connectorLineTypeOptions.map((type) => (
                <ToggleButton key={type} value={type} aria-label={type}>
                  <LineTypePreview type={type} />
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            <Box sx={{ mt: 1.5 }}>
              <LabeledSlider
                label={t('width')}
                value={connStyle.width ?? 10}
                displayValue={String(connStyle.width ?? 10)}
                min={10}
                max={30}
                step={5}
                onChange={(width) => connStyle.apply({ width })}
              />
            </Box>

            <FormControlLabel
              sx={{ mt: 0.5 }}
              control={
                <Switch
                  checked={connStyle.showArrow !== false}
                  onChange={(e) => connStyle.apply({ showArrow: e.target.checked })}
                />
              }
              label={t('showArrow')}
            />
            {/* Per-label leader-line toggle — shown only when a specific
                connector label is selected (moved here from the deck, #10). */}
            {activeLabel && (
              <FormControlLabel
                sx={{ mt: 0.5, display: 'flex' }}
                control={
                  <Switch
                    checked={activeLabel.showLine !== false}
                    onChange={(e) =>
                      updateActiveLabel({ showLine: e.target.checked })
                    }
                  />
                }
                label={t('showDottedLine')}
              />
            )}
          </Box>
        )}
      </StripButton>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Text direction (text node) — inline toggle, no popover */}
      <Tooltip
        title={textBox ? t('textDirection') : t('textDirectionDisabled')}
        placement="bottom"
      >
        <span>
          <ToggleButtonGroup
            value={textBox?.orientation ?? null}
            exclusive
            size="small"
            disabled={!textBox}
            onChange={(_e, orientation) => {
              if (!textBox || orientation === null || textBox.orientation === orientation)
                return;
              updateTextBox(textBox.id, { orientation });
            }}
            sx={{
              // Match the strip's enabled/disabled contrast (see StripButton).
              '& .MuiSvgIcon-root': { color: 'inherit' },
              '& .MuiToggleButton-root': { color: 'text.primary', px: 0.75 },
              '& .MuiToggleButton-root.Mui-disabled': { color: 'action.disabled' }
            }}
          >
            <ToggleButton value={ProjectionOrientationEnum.X} aria-label={t('textDirectionX')}>
              <TextRotationNoneIcon
                sx={{ fontSize: 18, transform: getIsoProjectionCss() }}
              />
            </ToggleButton>
            <ToggleButton value={ProjectionOrientationEnum.Y} aria-label={t('textDirectionY')}>
              <TextRotationNoneIcon
                sx={{
                  fontSize: 18,
                  transform: `scale(-1, 1) ${getIsoProjectionCss()} scale(-1, 1)`
                }}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </span>
      </Tooltip>

      {/* Rich text (text node) — single only: a per-character editor can't
          target a multi-selection. */}
      <StripButton
        tooltip={
          isBulk
            ? t('richTextBulk')
            : textBox
            ? t('richText')
            : t('richTextDisabled')
        }
        disabled={!textBox || isBulk}
        popoverWidth={320}
        icon={<RichTextIcon sx={{ fontSize: 18 }} />}
      >
        {textBox && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {t('text')}
            </Typography>
            <RichTextEditor
              value={textBox.content}
              onChange={(html) => updateTextBox(textBox.id, { content: html })}
              height={120}
              contentStyle={{
                fontWeight: textBox.isBold ? 700 : undefined,
                fontStyle: textBox.isItalic ? 'italic' : undefined
              }}
            />
          </Box>
        )}
      </StripButton>
    </Box>
  );
};
