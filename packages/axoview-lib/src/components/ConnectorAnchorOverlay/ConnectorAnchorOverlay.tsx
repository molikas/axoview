import React, { useMemo } from 'react';
import { Tooltip } from '@mui/material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import {
  getAnchorTile,
  connectorPathTileToGlobal
} from 'src/utils';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { ConnectorAnchor, Coords, View } from 'src/types';

// App accent color, matching the default connector/node palette
const ACCENT = '#a5b8f3';
const ACCENT_DARK = '#7b96e8';
const RADIUS = 11;
const INNER_RADIUS = 4;
// Waypoints used to render at RADIUS - 3 (8px) with a faded 5×5 dark square
// inside — visually subordinate to endpoints. User feedback: too small and
// hard to spot. Bring them closer to endpoint size (10px) with a clearly
// visible accent-colored diamond so they read as interactive controls.
const WAYPOINT_RADIUS = 10;
const WAYPOINT_INNER = 7;
// Invisible hit area extends beyond the visual so Alt+click / drag is more
// forgiving without making the on-canvas dot bigger. Pattern matches Figma,
// Excalidraw, draw.io handle controls.
const WAYPOINT_HIT_RADIUS = 16;

const pulseKeyframes = `
@keyframes axoview-anchor-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(165,184,243,0.55), 0 2px 8px rgba(0,0,0,0.18); }
  70%  { box-shadow: 0 0 0 7px rgba(165,184,243,0), 0 2px 8px rgba(0,0,0,0.18); }
  100% { box-shadow: 0 0 0 0 rgba(165,184,243,0), 0 2px 8px rgba(0,0,0,0.18); }
}
`;

// Endpoint anchors resolve to their rendered path endpoint (when bound to an
// item); waypoints and detached endpoints resolve via the view geometry.
function computeAnchorGlobalTile(
  anchor: ConnectorAnchor,
  index: number,
  isEndpoint: boolean,
  pathTiles: Coords[],
  rectFrom: Coords,
  currentView: View
): Coords {
  if (isEndpoint && anchor.ref.item && pathTiles.length > 0) {
    const pathTile =
      index === 0 ? pathTiles[0] : pathTiles[pathTiles.length - 1];
    return connectorPathTileToGlobal(pathTile, rectFrom);
  }
  return getAnchorTile(anchor, currentView);
}

// Inner marker: filled dot for the source endpoint, hollow ring for the target
// endpoint, accent diamond for a waypoint.
const AnchorInnerDot = ({
  isEndpoint,
  isSource,
  isReconnecting
}: {
  isEndpoint: boolean;
  isSource: boolean;
  isReconnecting: boolean;
}) => {
  if (!isEndpoint) {
    // Filled accent-colored diamond — clearly visible against the canvas and
    // distinguishable from endpoints (which are circles).
    return (
      <div
        style={{
          width: WAYPOINT_INNER,
          height: WAYPOINT_INNER,
          backgroundColor: ACCENT,
          border: '1px solid rgba(0,0,0,0.18)',
          transform: 'rotate(45deg)',
          flexShrink: 0,
          pointerEvents: 'none'
        }}
      />
    );
  }
  if (isSource) {
    return (
      <div
        style={{
          width: INNER_RADIUS * 2,
          height: INNER_RADIUS * 2,
          borderRadius: '50%',
          backgroundColor: isReconnecting ? ACCENT_DARK : ACCENT,
          flexShrink: 0
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: INNER_RADIUS * 2,
        height: INNER_RADIUS * 2,
        borderRadius: '50%',
        border: `2px solid ${isReconnecting ? ACCENT_DARK : ACCENT}`,
        backgroundColor: 'transparent',
        flexShrink: 0
      }}
    />
  );
};

interface AnchorHandleProps {
  anchorId: string;
  pos: Coords;
  radius: number;
  hitR: number;
  isEndpoint: boolean;
  isSource: boolean;
  isReconnecting: boolean;
}

// The rendered anchor control: a transparent hit area wrapping a frosted visual
// disc + inner marker. forwardRef so MUI Tooltip (waypoints) can attach its ref
// and inject hover handlers via the spread props — same DOM as a bare div.
const AnchorHandle = React.forwardRef<
  HTMLDivElement,
  AnchorHandleProps & React.HTMLAttributes<HTMLDivElement>
>(
  (
    {
      anchorId,
      pos,
      radius,
      hitR,
      isEndpoint,
      isSource,
      isReconnecting,
      ...rest
    },
    ref
  ) => (
    <div
      ref={ref}
      data-anchor-id={!isEndpoint ? anchorId : undefined}
      style={{
        position: 'absolute',
        left: pos.x - hitR,
        top: pos.y - hitR,
        width: hitR * 2,
        height: hitR * 2,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: isEndpoint ? 'none' : 'auto',
        cursor: isEndpoint ? 'default' : 'pointer',
        background: 'transparent'
      }}
      {...rest}
    >
      <div
        style={{
          width: radius * 2,
          height: radius * 2,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(4px)',
          border: `1.5px solid rgba(0,0,0,0.10)`,
          boxShadow: isReconnecting
            ? `0 0 0 0 rgba(165,184,243,0.55), 0 2px 8px rgba(0,0,0,0.18)`
            : `0 1px 4px rgba(0,0,0,0.14), 0 0 0 1px rgba(255,255,255,0.6)`,
          animation: isReconnecting
            ? 'axoview-anchor-pulse 1.2s ease-out infinite'
            : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <AnchorInnerDot
          isEndpoint={isEndpoint}
          isSource={isSource}
          isReconnecting={isReconnecting}
        />
      </div>
    </div>
  )
);

export const ConnectorAnchorOverlay = () => {
  const itemControls = useUiStateStore((state) => state.itemControls);
  const mode = useUiStateStore((state) => state.mode);
  const { hitConnectors, currentView } = useScene();
  const { getTilePosition } = useCanvasMode();

  const selectedId = useMemo(() => {
    if (mode.type === 'RECONNECT_ANCHOR') return mode.connectorId;
    if (mode.type === 'CONNECTOR') return mode.id;
    if (itemControls?.type === 'CONNECTOR') return itemControls.id;
    return null;
  }, [mode, itemControls]);

  const reconnectingAnchorId =
    mode.type === 'RECONNECT_ANCHOR' ? mode.anchorId : null;

  const connector = useMemo(() => {
    if (!selectedId) return null;
    return hitConnectors.find((c) => c.id === selectedId) ?? null;
  }, [selectedId, hitConnectors]);

  if (!connector?.path?.tiles?.length) return null;

  const lastIdx = connector.anchors.length - 1;

  return (
    <>
      <style>{pulseKeyframes}</style>
      {connector.anchors.map((anchor, index) => {
        const isEndpoint = index === 0 || index === lastIdx;
        const isSource = index === 0;
        const isReconnecting = anchor.id === reconnectingAnchorId;

        const globalTile = computeAnchorGlobalTile(
          anchor,
          index,
          isEndpoint,
          connector.path.tiles,
          connector.path.rectangle.from,
          currentView
        );

        const pos = getTilePosition({ tile: globalTile });
        const radius = isEndpoint ? RADIUS : WAYPOINT_RADIUS;
        // Waypoints get a larger invisible hit area (Alt+click / drag is more
        // forgiving) plus a "Alt+click to remove" tooltip on hover. To detect
        // hover the element must accept pointer events; it is tagged with
        // data-anchor-id so useInteractionManager treats it as a renderer
        // interaction (matching Cursor.mousedown's check).
        const hitR = !isEndpoint ? WAYPOINT_HIT_RADIUS : radius;

        if (isEndpoint) {
          return (
            <AnchorHandle
              key={anchor.id}
              anchorId={anchor.id}
              pos={pos}
              radius={radius}
              hitR={hitR}
              isEndpoint
              isSource={isSource}
              isReconnecting={isReconnecting}
            />
          );
        }
        return (
          <Tooltip
            key={anchor.id}
            title="Alt+click to remove"
            enterDelay={600}
            enterNextDelay={600}
            placement="top"
            arrow
          >
            <AnchorHandle
              anchorId={anchor.id}
              pos={pos}
              radius={radius}
              hitR={hitR}
              isEndpoint={false}
              isSource={isSource}
              isReconnecting={isReconnecting}
            />
          </Tooltip>
        );
      })}
    </>
  );
};
