import React, { memo, useMemo } from 'react';
import { Connector } from 'src/types';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { ConnectorLabel } from './ConnectorLabel';

interface Props {
  connectors: Connector[];
}

export const ConnectorLabels = memo(({ connectors }: Props) => {
  // The selected connector is always mounted, even with zero labels, so its F2
  // handler ("add a new label + inline-edit it", ADR 0032 connector amendment)
  // is live before the first label exists. Without this, a fresh connector had
  // no ConnectorLabel mounted and F2 was a no-op.
  const selectedConnectorId = useUiStateStore((s) =>
    s.itemControls?.type === 'CONNECTOR' ? s.itemControls.id : null
  );

  const labelledConnectors = useMemo(
    () =>
      connectors.filter((connector) =>
        Boolean(
          connector.id === selectedConnectorId ||
          (connector.name?.trim() && connector.showLabel !== false) ||
          connector.description ||
          connector.startLabel ||
          connector.endLabel ||
          (connector.labels && connector.labels.length > 0)
        )
      ),
    [connectors, selectedConnectorId]
  );

  return (
    <>
      {labelledConnectors.map((connector) => (
        <ConnectorLabel key={connector.id} connector={connector} />
      ))}
    </>
  );
});
