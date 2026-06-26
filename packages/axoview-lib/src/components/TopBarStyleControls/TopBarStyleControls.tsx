import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
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
  FormatColorFill as FillIcon,
  Timeline as ConnectionColorIcon,
  TextRotationNone as TextRotationNoneIcon,
  EditNote as RichTextIcon,
  PhotoSizeSelectLarge as IconSizeIcon,
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
import { ColorSelector } from '../ColorSelector/ColorSelector';
import { CustomColorInput } from '../ColorSelector/CustomColorInput';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';

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

interface PresetCustomColorProps {
  presetId?: string;
  customColor?: string;
  onSelectPreset: (id: string) => void;
  onCustomChange: (hex: string) => void;
  onDisableCustom: () => void;
}

// The preset-or-custom colour body shared by the rectangle-fill and
// connector-colour controls (matches RectangleControls / ConnectorControls).
const PresetCustomColor = ({
  presetId,
  customColor,
  onSelectPreset,
  onCustomChange,
  onDisableCustom
}: PresetCustomColorProps) => {
  const [useCustom, setUseCustom] = useState(Boolean(customColor));

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
        <ColorSelector activeColor={presetId} onChange={onSelectPreset} />
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
  const connectorDefaults = useUiStateStore((s) => s.connectorDefaults);
  const setConnectorDefaults = useUiStateStore(
    (s) => s.actions.setConnectorDefaults
  );
  const { colors, updateViewItem, updateTextBox, updateConnector, updateRectangle } =
    useScene();

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

  // --- Text colour (node label / text node / connector labels) ---
  const connectorLabels = connector?.labels ?? [];
  const textColorEnabled = Boolean(
    node || textBox || (connector && connectorLabels.length > 0)
  );
  const textColorValue = node
    ? node.labelColor
    : textBox
    ? textBox.color
    : connectorLabels[0]?.labelColor;
  const onTextColorChange = (color: string | undefined) => {
    if (node) updateViewItem(node.id, { labelColor: color });
    else if (textBox) updateTextBox(textBox.id, { color });
    else if (connector)
      updateConnector(connector.id, {
        labels: connectorLabels.map((l) => ({ ...l, labelColor: color }))
      });
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
    : connector && connectorLabels.length > 0
    ? {
        value: connectorLabels[0]?.fontSize ?? 12,
        min: 8,
        max: 24,
        step: 1,
        onChange: (v) =>
          updateConnector(connector.id, {
            labels: connectorLabels.map((l) => ({ ...l, fontSize: v }))
          })
      }
    : null;

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

      {/* Background colour (rectangle) */}
      <StripButton
        tooltip={rectangle ? 'Background color' : 'Select a rectangle to set its background color'}
        disabled={!rectangle}
        icon={<FillIcon sx={{ fontSize: 18 }} />}
        colorBar={rectangle ? resolveHex(rectangle.color, rectangle.customColor) : undefined}
      >
        {rectangle && (
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
          />
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
            />
          </Box>
        )}
      </StripButton>
    </Box>
  );
};
