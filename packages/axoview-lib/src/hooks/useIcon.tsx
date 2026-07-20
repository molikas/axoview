import React, { useMemo, useEffect } from 'react';
import { useModelStore } from 'src/stores/modelStore';
import { getItemById } from 'src/utils';
import { IsometricIcon } from 'src/components/SceneLayers/Nodes/Node/IconTypes/IsometricIcon';
import { NonIsometricIcon } from 'src/components/SceneLayers/Nodes/Node/IconTypes/NonIsometricIcon';
import { DEFAULT_ICON, TOMBSTONE_ICON } from 'src/config';

export const useIcon = (
  id: string | undefined,
  // ADR 0044: a per-node icon scale (viewItem.iconScale) that OVERRIDES the
  // shared icon asset's `scale` for a single node. Undefined = fall back to the
  // shared asset scale, i.e. today's behaviour.
  iconScaleOverride?: number
) => {
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const icons = useModelStore((state) => {
    return state.icons;
  });

  const icon = useMemo(() => {
    // No id assigned — default block (today's behavior for new/blank items).
    if (!id) return DEFAULT_ICON;

    const item = getItemById(icons, id);
    if (item) return item.value;

    // Id is set but unresolved — show tombstone so the layout stays stable
    // and the user has a recoverable signal. ADR-0002 lifecycle section.
    return TOMBSTONE_ICON;
  }, [icons, id]);

  useEffect(() => {
    setHasLoaded(false);
  }, [icon.url]);

  const iconComponent = useMemo(() => {
    // ADR 0044: the per-node override wins over the shared asset scale; absent
    // → shared-asset `scale` → 1 (today's behaviour).
    const effectiveScale = iconScaleOverride ?? icon.scale ?? 1;

    if (!icon.isIsometric) {
      setHasLoaded(true);
      return <NonIsometricIcon icon={icon} scale={effectiveScale} />;
    }

    return (
      <IsometricIcon
        url={icon.url}
        scale={effectiveScale}
        onImageLoaded={() => {
          setHasLoaded(true);
        }}
      />
    );
  }, [icon, iconScaleOverride]);

  return {
    icon,
    iconComponent,
    hasLoaded
  };
};
