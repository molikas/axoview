import React from 'react';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { useScene } from 'src/hooks/useScene';
import { screenToCanvasPoint } from 'src/utils/coordinateTransforms';

// Off-grid hit-test debug overlay (ADR 0023). Mounted by `Renderer` only when
// `enableDebugTools` is on — the same gate as the `window.__axoview__` bridge.
// It repeatedly proved decisive while chasing the off-grid hit-test cluster, so
// it is kept as a permanent dev tool rather than deleted.
//
//   • RED dot  = the cursor's exact SceneLayer point (screenToCanvasPoint) — the
//     point pixel-accurate hit-testing tests.
//   • GREEN dot = each node's RENDERED footprint centre (tile projection +
//     offset) — the centre of the tile diamond hit-testing compares against. A
//     hover fires when the RED dot falls inside a node's footprint diamond
//     (half-extent ≈ 70.75 × 40.95 px in iso). Green should sit dead-centre on
//     the node.
//
// Lives in a SceneLayer so left/top are the SceneLayer-px coords getTilePosition
// and screenToCanvasPoint both return.
export const HoverHitDebug = () => {
  const modeType = useUiStateStore((s) => s.mode.type);
  const editorMode = useUiStateStore((s) => s.editorMode);
  const screenX = useUiStateStore((s) => s.mouse?.position?.screen?.x);
  const screenY = useUiStateStore((s) => s.mouse?.position?.screen?.y);
  const zoom = useUiStateStore((s) => s.zoom);
  const scroll = useUiStateStore((s) => s.scroll);
  const rendererSize = useUiStateStore((s) => s.rendererSize);
  const { getTilePosition } = useCanvasMode();
  const { items } = useScene();

  if (
    editorMode !== 'EDITABLE' ||
    modeType !== 'CURSOR' ||
    screenX == null ||
    screenY == null
  ) {
    return null;
  }

  const cursor = screenToCanvasPoint(
    { x: screenX, y: screenY },
    zoom || 1,
    scroll,
    rendererSize
  );

  const footprints = items.map((it) => {
    const c = getTilePosition({ tile: it.tile, origin: 'CENTER' });
    return { id: it.id, x: c.x + (it.offset?.x ?? 0), y: c.y + (it.offset?.y ?? 0) };
  });

  return (
    <>
      {/* GREEN — each node's rendered footprint centre (hit-test diamond centre). */}
      {footprints.map((f) => (
        <div
          key={f.id}
          data-axoview-id="debug-footprint-dot"
          style={{
            position: 'absolute',
            left: f.x - 5,
            top: f.y - 5,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#00e676',
            border: '2px solid #fff',
            pointerEvents: 'none',
            zIndex: 9998
          }}
        />
      ))}
      {/* RED — the cursor's exact canvas point (what hit-testing tests). */}
      <div
        data-axoview-id="debug-cursor-dot"
        style={{
          position: 'absolute',
          left: cursor.x - 6,
          top: cursor.y - 6,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: '#ff1744',
          border: '2px solid #fff',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
          pointerEvents: 'none',
          zIndex: 9999
        }}
      />
    </>
  );
};
