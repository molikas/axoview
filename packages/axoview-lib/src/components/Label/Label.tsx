import React, { useRef } from 'react';
import { SxProps } from '@mui/material';
import { styled } from '@mui/material/styles';

const CONNECTOR_DOT_SIZE = 3;

export interface Props {
  labelHeight?: number;
  maxWidth: number;
  maxHeight?: number;
  expandDirection?: 'CENTER' | 'BOTTOM';
  children: React.ReactNode;
  sx?: SxProps;
  showLine?: boolean;
}

// T1 wholesale de-emotion (decision-log): the label's positioning wrapper and the
// chip are module-level styled() components — CSS resolved ONCE into a cached
// class, so each of the ~N node/connector labels pays only a className apply, not
// the per-instance MUI sx pipeline (extendSxProp/styleFunctionSx/murmur2) a
// `<Box sx={...}>` re-runs every render. The chip still accepts `sx` (ConnectorLabel
// overrides py/px/whiteSpace); dynamic transform / maxHeight / top / width go inline.

const LabelOuter = styled('div')({ position: 'absolute' });

const LabelChip = styled('div')(({ theme }) => ({
  position: 'absolute',
  display: 'inline-block',
  backgroundColor: theme.palette.common.white, // bgcolor: 'common.white'
  border: '1px solid',
  borderColor: theme.palette.grey[400], // borderColor: 'grey.400'
  borderRadius: (theme.shape.borderRadius as number) * 2, // sx borderRadius: 2
  paddingTop: theme.spacing(1), // py: 1
  paddingBottom: theme.spacing(1),
  paddingLeft: theme.spacing(1.5), // px: 1.5
  paddingRight: theme.spacing(1.5),
  transformOrigin: 'bottom center',
  overflow: 'hidden'
}));

export const Label = ({
  children,
  maxWidth,
  maxHeight,
  expandDirection = 'CENTER',
  labelHeight = 0,
  sx,
  showLine = true
}: Props) => {
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <LabelOuter style={{ width: maxWidth }}>
      {labelHeight > 0 && showLine && (
        <svg
          viewBox={`0 0 ${CONNECTOR_DOT_SIZE} ${labelHeight}`}
          width={CONNECTOR_DOT_SIZE}
          style={{
            position: 'absolute',
            top: -labelHeight,
            left: -CONNECTOR_DOT_SIZE / 2,
            pointerEvents: 'none'
          }}
        >
          <line
            x1={CONNECTOR_DOT_SIZE / 2}
            y1={0}
            x2={CONNECTOR_DOT_SIZE / 2}
            y2={labelHeight}
            strokeDasharray={`0, ${CONNECTOR_DOT_SIZE * 2}`}
            stroke="black"
            strokeWidth={CONNECTOR_DOT_SIZE}
            strokeLinecap="round"
          />
        </svg>
      )}

      <LabelChip
        ref={contentRef}
        sx={sx}
        // The optional `--axoview-label-scale` counter-scale (ADR 0015, set by
        // ExpandableLabel when "keep labels readable" is on) composes after the
        // translate; scaling about bottom-center holds the stalk-attachment point
        // fixed. Defaults to 1 (no-op) for other consumers, e.g. ConnectorLabel.
        style={{
          maxHeight,
          top: -labelHeight,
          transform: `translate(-50%, ${
            expandDirection === 'BOTTOM' ? '-100%' : '-50%'
          }) scale(var(--axoview-label-scale, 1))`
        }}
      >
        {children}
      </LabelChip>
    </LabelOuter>
  );
};
