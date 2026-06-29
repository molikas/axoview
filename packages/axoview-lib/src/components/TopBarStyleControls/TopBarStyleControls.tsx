import React, { useState, useRef, useEffect } from 'react';
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
  Typography
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
  ArrowDropDown as CaretIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { useModelItem } from 'src/hooks/useModelItem';
import { useScene } from 'src/hooks/useScene';
import { useViewItem } from 'src/hooks/useViewItem';
import { useTextBox } from 'src/hooks/useTextBox';
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

// Google-Docs-style inline strip that surfaces a subset of the right-dock style
// controls in the top bar. It is portaled (via UiOverlay) into a slot the app
// provides next to the session badge, so it lives INSIDE the lib's store
// providers and can read selection + write through useScene like the detail
// panels. The right dock is intentionally left untouched — this is a parallel
// affordance, not a replacement.

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
              py: 0.25
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
}) => (
  <Button
    onClick={onClick}
    variant="text"
    size="small"
    aria-label="No color"
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

interface PresetCustomColorProps {
  presetId?: string;
  customColor?: string;
  onSelectPreset: (id: string) => void;
  onCustomChange: (hex: string) => void;
  onDisableCustom: () => void;
  // When provided, a "no color" swatch clears the fill (transparent) — used for
  // a text box / label background and the rectangle fill.
  onNoColor?: () => void;
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
  onNoColor
}: PresetCustomColorProps) => {
  const { colors } = useScene();
  // White / transparent are fixed swatches, not "custom" — keep them in the grid
  // view so reopening the popover doesn't land on the custom input.
  const [useCustom, setUseCustom] = useState(
    Boolean(customColor) && !isQuickColor(customColor)
  );
  const whiteActive = (customColor || '').toLowerCase() === WHITE;
  const noColorActive =
    (customColor || '').toLowerCase() === TRANSPARENT ||
    (!presetId && !customColor);

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
        label="Custom color"
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
      label="Text size"
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
      label="Icon size"
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
  const itemControls = useUiStateStore((s) => s.itemControls);
  const mode = useUiStateStore((s) => s.mode);
  const selectedConnectorLabel = useUiStateStore(
    (s) => s.selectedConnectorLabel
  );
  const connectorDefaults = useUiStateStore((s) => s.connectorDefaults);
  const setConnectorDefaults = useUiStateStore(
    (s) => s.actions.setConnectorDefaults
  );
  const {
    colors,
    updateViewItem,
    updateModelItem,
    updateTextBox,
    updateConnector,
    updateRectangle
  } = useScene();

  const sel = itemControls && itemControls.type !== 'ADD_ITEM' ? itemControls : null;
  // Hooks must run unconditionally; each returns null when the id is absent from
  // its collection, so gating by type keeps cross-collection id collisions safe.
  const node = useViewItem(sel?.type === 'ITEM' ? sel.id : '');
  const textBox = useTextBox(sel?.type === 'TEXTBOX' ? sel.id : '');
  const connector = useConnector(sel?.type === 'CONNECTOR' ? sel.id : '');
  const rectangle = useRectangle(sel?.type === 'RECTANGLE' ? sel.id : '');

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

  const textColorEnabled = Boolean(node || textBox || activeLabel || isNameLabel);
  const textColorValue = node
    ? node.labelColor
    : textBox
    ? textBox.color
    : isNameLabel
    ? connector?.nameLabelColor
    : activeLabel?.labelColor;
  const onTextColorChange = (color: string | undefined) => {
    if (node) updateViewItem(node.id, { labelColor: color });
    else if (textBox) updateTextBox(textBox.id, { color });
    else if (isNameLabel && connector)
      updateConnector(connector.id, { nameLabelColor: color });
    else if (activeLabel) updateActiveLabel({ labelColor: color });
  };

  // --- Text size (presented as a unified % scale; mapped to each type's native
  // range: node label px 10–24, connector label px 8–24, text box scale 0.15–0.9).
  const textSize: {
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
  } | null = node
    ? {
        value: node.labelFontSize ?? 14,
        min: 10,
        max: 24,
        step: 2,
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
    : isNameLabel && connector
    ? {
        value: connector.nameLabelFontSize ?? 12,
        min: 8,
        max: 24,
        step: 1,
        onChange: (v) =>
          updateConnector(connector.id, { nameLabelFontSize: v })
      }
    : activeLabel
    ? {
        value: activeLabel.fontSize ?? 12,
        min: 8,
        max: 24,
        step: 1,
        onChange: (v) => updateActiveLabel({ fontSize: v })
      }
    : null;

  // --- Bold / italic / strikethrough — same target resolution as text colour,
  // for the things WITHOUT a rich-text editor: a node label, a connector name
  // label, a selected connector labels[] entry, and a floating Label chip.
  // A plain text box is EXCLUDED — it formats per-character via its rich-text
  // editor, so a whole-box B/I/S would fight that (two layers; CSS can't
  // subtract). Each supported type stores its own boolean trio.
  const labelTextBox = textBox && textBox.variant === 'label' ? textBox : null;
  const formatEnabled = Boolean(
    node || labelTextBox || activeLabel || isNameLabel
  );
  const formatValue = {
    bold: node
      ? node.labelBold
      : labelTextBox
      ? labelTextBox.isBold
      : isNameLabel
      ? connector?.nameLabelBold
      : activeLabel?.bold,
    italic: node
      ? node.labelItalic
      : labelTextBox
      ? labelTextBox.isItalic
      : isNameLabel
      ? connector?.nameLabelItalic
      : activeLabel?.italic,
    strike: node
      ? node.labelStrikethrough
      : labelTextBox
      ? labelTextBox.isStrikethrough
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
    else if (labelTextBox)
      updateTextBox(labelTextBox.id, {
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
            ? 'Text color'
            : 'Select a node, text, or connection label to set text color'
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
            ? 'Text size'
            : 'Select a node, text, or connection label to set text size'
        }
        disabled={!textSize}
        popoverWidth={220}
        icon={<TextSizeIcon sx={{ fontSize: 18 }} />}
      >
        {textSize && (
          <PercentSizeSlider
            value={textSize.value}
            min={textSize.min}
            max={textSize.max}
            step={textSize.step}
            onChange={textSize.onChange}
          />
        )}
      </StripButton>

      {/* Bold / italic / strikethrough — applies to the whole text box / label
          (a label has no rich-text toolbar, so this is its only B/I/S). On a
          rich text box it layers over inline formatting; clearing here won't
          undo inline <strong>/<em> set via the rich-text editor. */}
      <Tooltip
        title={
          formatEnabled
            ? 'Bold / italic / strikethrough'
            : 'Select a node, label, or connection label (text boxes format via rich text)'
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
            <ToggleButton value="bold" aria-label="Bold">
              <BoldIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton value="italic" aria-label="Italic">
              <ItalicIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
            <ToggleButton value="strike" aria-label="Strikethrough">
              <StrikethroughIcon sx={{ fontSize: 18 }} />
            </ToggleButton>
          </ToggleButtonGroup>
        </span>
      </Tooltip>

      {/* Background colour — rectangle fill, or a text box / label chip.
          A text box stores a raw hex in `backgroundColor`; clearing it removes
          the fill (and resets a label chip to white). */}
      <StripButton
        tooltip={
          rectangle || textBox
            ? 'Background color'
            : 'Select a rectangle, text, or label to set its background color'
        }
        disabled={!rectangle && !textBox}
        icon={<FillIcon sx={{ fontSize: 18 }} />}
        colorBar={
          rectangle
            ? resolveHex(rectangle.color, rectangle.customColor)
            : textBox
            ? textBox.backgroundColor || '#ffffff'
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
        ) : textBox ? (
          <PresetCustomColor
            presetId={colors.find((c) => c.value === textBox.backgroundColor)?.id}
            customColor={
              textBox.backgroundColor &&
              !colors.some((c) => c.value === textBox.backgroundColor)
                ? textBox.backgroundColor
                : undefined
            }
            onSelectPreset={(id) =>
              updateTextBox(textBox.id, { backgroundColor: resolveHex(id) })
            }
            onCustomChange={(hex) =>
              updateTextBox(textBox.id, { backgroundColor: hex })
            }
            onDisableCustom={() =>
              updateTextBox(textBox.id, { backgroundColor: undefined })
            }
            onNoColor={() =>
              updateTextBox(textBox.id, { backgroundColor: undefined })
            }
          />
        ) : null}
      </StripButton>

      {/* Border (rectangle) — line style + width + colour for the frame. */}
      <StripButton
        tooltip={
          rectangle ? 'Border' : 'Select a rectangle to set its border'
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
              Line style
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
                label="Width"
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
              Border color
            </Typography>
            <PresetCustomColor
              presetId={colors.find((c) => c.value === rectangle.borderColor)?.id}
              customColor={
                rectangle.borderColor &&
                !colors.some((c) => c.value === rectangle.borderColor)
                  ? rectangle.borderColor
                  : undefined
              }
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
          </Box>
        )}
      </StripButton>

      {/* Change icon (node) — moved here from the node Details panel. */}
      <StripButton
        tooltip={node ? 'Change icon' : 'Select a node to change its icon'}
        disabled={!node}
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
        tooltip={currentIcon ? 'Icon size' : 'Select a node to change its icon size'}
        disabled={!currentIcon}
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
          connStyle
            ? 'Connection color'
            : 'Select a connection (or the connector tool) to set its color'
        }
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
          connStyle
            ? 'Line options'
            : 'Select a connection (or the connector tool) to set its line options'
        }
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
              Line style
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
              Line type
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
                label="Width"
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
              label="Show arrow"
            />
          </Box>
        )}
      </StripButton>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* Text direction (text node) — inline toggle, no popover */}
      <Tooltip
        title={textBox ? 'Text direction' : 'Select a text box to set its direction'}
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
            <ToggleButton value={ProjectionOrientationEnum.X} aria-label="Text direction X">
              <TextRotationNoneIcon
                sx={{ fontSize: 18, transform: getIsoProjectionCss() }}
              />
            </ToggleButton>
            <ToggleButton value={ProjectionOrientationEnum.Y} aria-label="Text direction Y">
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

      {/* Rich text (text node) */}
      <StripButton
        tooltip={textBox ? 'Rich text' : 'Select a text box to edit rich text'}
        disabled={!textBox}
        popoverWidth={320}
        icon={<RichTextIcon sx={{ fontSize: 18 }} />}
      >
        {textBox && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Text
            </Typography>
            <RichTextEditor
              value={textBox.content}
              onChange={(html) => updateTextBox(textBox.id, { content: html })}
              height={120}
              contentStyle={{
                fontWeight: textBox.isBold ? 700 : undefined,
                fontStyle: textBox.isItalic ? 'italic' : undefined,
                textDecoration: textBox.isStrikethrough
                  ? 'line-through'
                  : undefined
              }}
            />
          </Box>
        )}
      </StripButton>
    </Box>
  );
};
