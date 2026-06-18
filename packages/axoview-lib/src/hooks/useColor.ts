import { useMemo } from 'react';
import { getItemById } from 'src/utils';
import { useModelStore } from 'src/stores/modelStore';

// Stable empty fallback so the selector result keeps a constant reference when
// the model has no colors yet (avoids a spurious re-render each store change).
const EMPTY_COLORS: never[] = [];

export const useColor = (colorId?: string) => {
  // Subscribe ONLY to model colors. Previously this read `useScene()`, which
  // pulls useSceneData and subscribes to sceneStore.connectors — so every
  // <Connector>/<ConnectorLabel> (which call useColor) re-rendered on EVERY
  // per-frame `previewConnectorPaths` write during a drag (renderProbe: ~436
  // connector renders/frame at N=500), even though only the dragged node's 1–2
  // connectors actually changed. Colors live in the model store and are stable
  // during a drag, so a granular model selector eliminates the fan-out.
  const colors = useModelStore((state) => state.colors) ?? EMPTY_COLORS;

  const color = useMemo(() => {
    if (colorId === undefined) {
      return colors.length > 0 ? colors[0] : null;
    }

    const item = getItemById(colors, colorId);
    return item ? item.value : null;
  }, [colorId, colors]);

  return color;
};
