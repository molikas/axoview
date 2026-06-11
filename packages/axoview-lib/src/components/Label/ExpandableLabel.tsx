import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box } from '@mui/material';
import { shallow } from 'zustand/shallow';
import { useResizeObserver } from 'src/hooks/useResizeObserver';
import { Gradient } from 'src/components/Gradient/Gradient';
import { ExpandButton } from './ExpandButton';
import { Label, Props as LabelProps } from './Label';
import { useUiStateStore, useUiStateStoreApi } from 'src/stores/uiStateStore';
import { computeLabelCounterScale } from 'src/utils/labelScale';
import {
  LABEL_BASE_FONT_PX,
  LABEL_MIN_READABLE_PX,
  LABEL_MAX_COUNTER_SCALE
} from 'src/config/labelSettings';

type Props = Omit<LabelProps, 'maxHeight'> & {
  onToggleExpand?: (isExpanded: boolean) => void;
};

const STANDARD_LABEL_HEIGHT = 80;

export const ExpandableLabel = ({
  children,
  onToggleExpand,
  ...rest
}: Props) => {
  const { forceExpandLabels, editorMode, labelSettings } = useUiStateStore(
    (state) => ({
      forceExpandLabels: state.expandLabels,
      editorMode: state.editorMode,
      labelSettings: state.labelSettings
    }),
    shallow
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const counterScaleRef = useRef<HTMLDivElement>(null);
  const storeApi = useUiStateStoreApi();
  const { observe, size: contentSize } = useResizeObserver();

  useEffect(() => {
    if (!contentRef.current) return;

    observe(contentRef.current);
  }, [observe]);

  // "Keep labels readable" (ADR 0015): counter-scale the node name label up to
  // a legible floor below a zoom threshold. Driven by a direct DOM subscription
  // to uiState.zoom (the §8.8 / NodeActionBar pattern) so panning/zooming never
  // re-renders React; the scale is published as a CSS custom property the Label
  // composes into its transform. Label-only — node geometry is untouched.
  useEffect(() => {
    const apply = () => {
      if (!counterScaleRef.current) return;
      const { zoom, readableLabels } = storeApi.getState();
      const scale = computeLabelCounterScale(zoom, {
        enabled: readableLabels,
        baseFontPx: LABEL_BASE_FONT_PX,
        minReadablePx: LABEL_MIN_READABLE_PX,
        maxCounterScale: LABEL_MAX_COUNTER_SCALE
      });
      counterScaleRef.current.style.setProperty(
        '--axoview-label-scale',
        String(scale)
      );
    };
    apply();
    return storeApi.subscribe((state, prev) => {
      if (
        state.zoom === prev.zoom &&
        state.readableLabels === prev.readableLabels
      ) {
        return;
      }
      apply();
    });
  }, [storeApi]);

  const effectiveExpanded = useMemo(() => {
    // Only force expand in NON_INTERACTIVE mode (export preview)
    const shouldForceExpand =
      forceExpandLabels && editorMode === 'NON_INTERACTIVE';
    return shouldForceExpand || isExpanded;
  }, [forceExpandLabels, isExpanded, editorMode]);

  const containerMaxHeight = useMemo(() => {
    return effectiveExpanded ? undefined : STANDARD_LABEL_HEIGHT;
  }, [effectiveExpanded]);

  const isContentTruncated = useMemo(() => {
    return (
      !effectiveExpanded && contentSize.height >= STANDARD_LABEL_HEIGHT - 10
    );
  }, [effectiveExpanded, contentSize.height]);

  // Determine overflow behavior based on mode
  const overflowBehavior = useMemo(() => {
    if (editorMode === 'NON_INTERACTIVE') {
      // In export mode, no overflow needed - container expands to fit
      return 'visible';
    }
    // In interactive modes, use scroll when expanded, hidden when collapsed
    return effectiveExpanded ? 'scroll' : 'hidden';
  }, [editorMode, effectiveExpanded]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [effectiveExpanded]);

  return (
    <Box ref={counterScaleRef}>
      <Label
        {...rest}
        maxHeight={containerMaxHeight}
        maxWidth={effectiveExpanded ? rest.maxWidth * 1.5 : rest.maxWidth}
      >
      <Box
        ref={contentRef}
        sx={{
          '&::-webkit-scrollbar': {
            display: 'none'
          },
          pb:
            isContentTruncated || isExpanded
              ? labelSettings.expandButtonPadding
              : 0 // Add bottom padding when expand button is visible
        }}
        style={{
          overflowY: overflowBehavior,
          maxHeight: containerMaxHeight
        }}
      >
        {children}

        {isContentTruncated && (
          <Gradient
            sx={{
              position: 'absolute',
              width: '100%',
              height: 50,
              bottom: 0,
              left: 0
            }}
          />
        )}
      </Box>

      {editorMode !== 'NON_INTERACTIVE' &&
        ((!isExpanded && isContentTruncated) || isExpanded) && (
          <ExpandButton
            sx={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              m: 0.5
            }}
            isExpanded={isExpanded}
            onClick={() => {
              setIsExpanded(!isExpanded);
              onToggleExpand?.(!isExpanded);
            }}
          />
        )}
      </Label>
    </Box>
  );
};
