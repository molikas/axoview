import React, { memo, useMemo } from 'react';
import { Connector } from 'src/types';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { ConnectorLabel } from './ConnectorLabel';

interface Props {
  connectors: Connector[];
}

// Below this zoom, connector labels are unreadable — and, at scale, a per-frame
// DOM composite cost (measured: the residual pan wall once connector/rectangle
// bodies moved to the GPU). Mirror the node-label canvas LOD (LABEL_LOD_ZOOM):
// hide them when zoomed out (unless readable-labels is on), keeping only the
// SELECTED connector's labels live for F2 / inline-edit.
const CONNECTOR_LABEL_LOD_ZOOM = 0.25;
const NO_CONNECTORS: Connector[] = [];

export const ConnectorLabels = memo(({ connectors }: Props) => {
  // The selected connector is always mounted, even with zero labels, so its F2
  // handler ("add a new label + inline-edit it", ADR 0032 connector amendment)
  // is live before the first label exists. Without this, a fresh connector had
  // no ConnectorLabel mounted and F2 was a no-op.
  const selectedConnectorId = useUiStateStore((s) =>
    s.itemControls?.type === 'CONNECTOR' ? s.itemControls.id : null
  );
  // A boolean selector — re-renders only when it FLIPS across the LOD zoom (or
  // readable-labels toggles), never per pan frame.
  const zoomReadable = useUiStateStore(
    (s) => s.readableLabels || s.zoom >= CONNECTOR_LABEL_LOD_ZOOM
  );
  // `__axoviewNoGpuFold` (perf A/B only) reproduces the pre-fold DOM state — no
  // LOD, connectors/rects on DOM — so before/after isolates the whole change.
  const labelsReadable =
    zoomReadable ||
    (typeof window !== 'undefined' &&
      !!(window as { __axoviewNoGpuFold?: boolean }).__axoviewNoGpuFold);

  const labelledConnectors = useMemo(() => {
    const base = connectors.filter((connector) =>
      Boolean(
        connector.id === selectedConnectorId ||
        (connector.name?.trim() && connector.showLabel !== false) ||
        connector.description ||
        connector.startLabel ||
        connector.endLabel ||
        (connector.labels && connector.labels.length > 0)
      )
    );
    if (labelsReadable) return base;
    // LOD: only the selected connector keeps its labels mounted when zoomed out.
    return selectedConnectorId
      ? base.filter((c) => c.id === selectedConnectorId)
      : NO_CONNECTORS;
  }, [connectors, selectedConnectorId, labelsReadable]);

  return (
    <>
      {labelledConnectors.map((connector) => (
        <ConnectorLabel key={connector.id} connector={connector} />
      ))}
    </>
  );
});
