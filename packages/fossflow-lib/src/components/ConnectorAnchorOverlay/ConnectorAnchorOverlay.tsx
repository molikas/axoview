import React, { useMemo } from 'react';
import { Tooltip } from '@mui/material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useScene } from 'src/hooks/useScene';
import {
  getAnchorTile,
  connectorPathTileToGlobal
} from 'src/utils';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { Coords } from 'src/types';

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
@keyframes fossflow-anchor-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(165,184,243,0.55), 0 2px 8px rgba(0,0,0,0.18); }
  70%  { box-shadow: 0 0 0 7px rgba(165,184,243,0), 0 2px 8px rgba(0,0,0,0.18); }
  100% { box-shadow: 0 0 0 0 rgba(165,184,243,0), 0 2px 8px rgba(0,0,0,0.18); }
}
`;

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

        let globalTile: Coords;
        if (isEndpoint && anchor.ref.item && connector.path.tiles.length > 0) {
          const pathTile =
            index === 0
              ? connector.path.tiles[0]
              : connector.path.tiles[connector.path.tiles.length - 1];
          globalTile = connectorPathTileToGlobal(
            pathTile,
            connector.path.rectangle.from
          );
        } else {
          globalTile = getAnchorTile(anchor, currentView);
        }

        const pos = getTilePosition({ tile: globalTile });
        const radius = isEndpoint ? RADIUS : WAYPOINT_RADIUS;

        // Waypoints get a "Alt+click to remove" tooltip on hover. To detect
        // hover the div must accept pointer events, which would normally
        // break the renderer-interaction check in Cursor.mousedown — handled
        // by tagging the element with data-anchor-id and treating matching
        // targets as renderer interactions in useInteractionManager. The
        // outer wrapper is a larger transparent hit area; the inner div
        // carries the visual.
        const hitR = !isEndpoint ? WAYPOINT_HIT_RADIUS : radius;
        const anchorEl = (
          <div
            key={anchor.id}
            data-anchor-id={!isEndpoint ? anchor.id : undefined}
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
                  ? 'fossflow-anchor-pulse 1.2s ease-out infinite'
                  : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
            {/* Inner dot: filled for source, hollow ring for target, small square for waypoint */}
            {isEndpoint ? (
              isSource ? (
                <div
                  style={{
                    width: INNER_RADIUS * 2,
                    height: INNER_RADIUS * 2,
                    borderRadius: '50%',
                    backgroundColor: isReconnecting ? ACCENT_DARK : ACCENT,
                    flexShrink: 0
                  }}
                />
              ) : (
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
              )
            ) : (
              // Filled accent-colored diamond — clearly visible against the
              // canvas and distinguishable from endpoints (which are circles).
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
            )}
            </div>
          </div>
        );

        if (isEndpoint) return anchorEl;
        return (
          <Tooltip
            key={anchor.id}
            title="Alt+click to remove"
            enterDelay={600}
            enterNextDelay={600}
            placement="top"
            arrow
          >
            {anchorEl}
          </Tooltip>
        );
      })}
    </>
  );
};
