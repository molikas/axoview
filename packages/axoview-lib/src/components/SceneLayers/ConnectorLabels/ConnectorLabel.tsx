import React, { useMemo, memo, useEffect, useState, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import { useSceneStore } from 'src/stores/sceneStore';
import {
  connectorPathTileToGlobal,
  getConnectorLabels,
  getLabelTileIndex
} from 'src/utils';
import { useCanvasMode } from 'src/contexts/CanvasModeContext';
import { PROJECTED_TILE_SIZE, UNPROJECTED_TILE_SIZE } from 'src/config';
import { Label } from 'src/components/Label/Label';
import { Connector, ConnectorLabel as ConnectorLabelType } from 'src/types';
import { useSceneActions } from 'src/hooks/useSceneActions';
import { useInlineRename } from 'src/hooks/useInlineRename';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { isLabelVisibleInPreview } from 'src/utils/previewLabelVisibility';

const INLINE_EDIT_EVENT = 'inlineEditNodeName';

interface LabelPosition {
  x: number;
  y: number;
}

const resolveConnectorUrl = (
  headerLink: string | undefined
): string | null => {
  if (!headerLink) return null;
  return /^https?:\/\//i.test(headerLink)
    ? headerLink
    : `https://${headerLink}`;
};

// Inline contentEditable editor for the connector name label.
const ConnectorNameEditor = ({
  position,
  name,
  onCommit,
  onCancel
}: {
  position: LabelPosition;
  name: string;
  onCommit: (raw: string) => void;
  onCancel: () => void;
}) => {
  const inlineRename = useInlineRename({
    active: true,
    commit: onCommit,
    cancel: onCancel
  });
  return (
  <Box
    sx={{ position: 'absolute', pointerEvents: 'auto', zIndex: 10 }}
    style={{ left: position.x, top: position.y }}
  >
    <Typography
      variant="body2"
      fontWeight={400}
      contentEditable
      suppressContentEditableWarning
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onBlur={inlineRename.onBlur}
      onKeyDown={inlineRename.onKeyDown}
      ref={inlineRename.setRef}
      sx={{
        outline: '1px solid rgba(0,0,0,0.3)',
        borderRadius: 1,
        px: 0.75,
        bgcolor: '#fff',
        minWidth: 20,
        cursor: 'text',
        display: 'inline-block',
        width: 'max-content',
        maxWidth: 200,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}
    >
      {name}
    </Typography>
  </Box>
  );
};

// Name label (not editing) — clickable when headerLink is set.
const ConnectorNameLabel = ({
  position,
  label,
  headerLink
}: {
  position: LabelPosition;
  label: ConnectorLabelType;
  headerLink?: string;
}) => {
  const url = resolveConnectorUrl(headerLink);
  return (
    <Box
      sx={{
        position: 'absolute',
        pointerEvents: url ? 'auto' : 'none',
        cursor: url ? 'pointer' : 'default'
      }}
      style={{
        maxWidth: PROJECTED_TILE_SIZE.width,
        left: position.x,
        top: position.y
      }}
      onClick={
        url
          ? (e) => {
              e.stopPropagation();
              window.open(url, '_blank', 'noopener,noreferrer');
            }
          : undefined
      }
    >
      <Label
        maxWidth={150}
        labelHeight={label.height || 0}
        showLine={false}
        sx={{
          py: 0.75,
          px: 1,
          borderRadius: 2,
          backgroundColor: 'background.paper',
          opacity: 0.95
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Typography
            variant="body2"
            sx={{
              fontWeight: 400,
              color: url ? 'primary.main' : 'text.primary',
              // #10: wrap a long connector name/link instead of clipping it on the
              // Label chip's overflow:hidden (parity with the node caption, §5.2).
              wordBreak: 'break-word',
              overflowWrap: 'anywhere'
            }}
          >
            {label.text}
          </Typography>
          {url && (
            <OpenInNewIcon
              sx={{ fontSize: 11, color: 'primary.main', flexShrink: 0 }}
            />
          )}
        </Box>
      </Label>
    </Box>
  );
};

// Standard (non-name) connector label.
const ConnectorTextLabel = ({
  position,
  label
}: {
  position: LabelPosition;
  label: ConnectorLabelType;
}) => (
  <Box
    sx={{ position: 'absolute', pointerEvents: 'none' }}
    style={{
      maxWidth: PROJECTED_TILE_SIZE.width,
      left: position.x,
      top: position.y
    }}
  >
    <Label
      maxWidth={150}
      labelHeight={label.height || 0}
      showLine={label.showLine !== false}
      sx={{
        py: 0.75,
        px: 1,
        borderRadius: 2,
        backgroundColor: 'background.paper',
        opacity: 0.95
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 400,
          color: label.labelColor || 'text.primary',
          // #10: keep long text labels wrapping (not clipped), matching the name
          // label above so every connector label behaves the same.
          wordBreak: 'break-word',
          overflowWrap: 'anywhere',
          ...(label.fontSize ? { fontSize: `${label.fontSize}px` } : {})
        }}
      >
        {label.text}
      </Typography>
    </Label>
  </Box>
);

interface Props {
  connector: Connector;
}

export const ConnectorLabel = memo(({ connector }: Props) => {
  const scenePath = useSceneStore(
    (state) => state.connectors[connector.id]?.path,
    (a, b) => a === b
  );
  const { getTilePosition } = useCanvasMode();
  // Actions only (not useScene): this label sits in the drag hot path, so it
  // must not re-render on every scene mutation just to hold the updateConnector
  // callback. useSceneActions has no data subscription (perf A-1).
  const { updateConnector } = useSceneActions();
  const editorMode = useUiStateStore((s) => s.editorMode);
  // Present-mode hide-labels override (ADR 0013 addendum) — UI-only.
  const previewHideLabels = useUiStateStore((s) => s.previewHideLabels);
  // Image-export hide-labels override (ADR 0025 §3) — UI-only, export-scoped.
  const exportHideLabels = useUiStateStore((s) => s.exportHideLabels);
  const isEditable = editorMode === 'EDITABLE';
  const isReadonly = editorMode === 'EXPLORABLE_READONLY';

  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    if (!isEditable) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string }>).detail;
      if (detail?.id === connector.id) setIsEditingName(true);
    };
    window.addEventListener(INLINE_EDIT_EVENT, handler);
    return () => window.removeEventListener(INLINE_EDIT_EVENT, handler);
  }, [connector.id, isEditable]);

  const commitName = useCallback(
    (raw: string) => {
      const next = raw.trim();
      if (next !== (connector.name ?? '')) {
        updateConnector(connector.id, { name: next || undefined });
      }
      setIsEditingName(false);
    },
    [updateConnector, connector.id, connector.name]
  );

  const trimmedName = connector.name?.trim() ?? '';

  const labels = useMemo(() => {
    const base = getConnectorLabels(connector);
    // The synthetic name label follows the model's `showLabel`, then the
    // present-mode hide-labels override (single merge point). Other connector
    // labels are content, not name labels, so the toggle leaves them alone.
    const nameVisible =
      isLabelVisibleInPreview(
        connector.showLabel !== false,
        isReadonly,
        previewHideLabels
      ) && !exportHideLabels;
    if (!trimmedName || !nameVisible) return base;
    const synthetic: ConnectorLabelType = {
      id: '__name__',
      text: trimmedName,
      position: 50,
      line: '1',
      height: 0
    };
    return [synthetic, ...base];
  }, [connector, trimmedName, isReadonly, previewHideLabels, exportHideLabels]);

  const labelPositions = useMemo(() => {
    if (!scenePath?.tiles?.length) return [];

    return labels
      .map((label) => {
        const tileIndex = getLabelTileIndex(
          scenePath.tiles.length,
          label.position
        );
        const tile = scenePath.tiles[tileIndex];
        if (!tile) return null;

        let position = getTilePosition({
          tile: connectorPathTileToGlobal(tile, scenePath.rectangle.from)
        });

        const lineType = connector.lineType || 'SINGLE';
        if (
          (lineType === 'DOUBLE' || lineType === 'DOUBLE_WITH_CIRCLE') &&
          label.line === '2'
        ) {
          const { tiles } = scenePath;
          if (tileIndex > 0 && tileIndex < tiles.length - 1) {
            const prev = tiles[tileIndex - 1];
            const next = tiles[tileIndex + 1];
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const connectorWidthPx =
              (UNPROJECTED_TILE_SIZE / 100) * (connector.width || 15);
            const offset = connectorWidthPx * 3;
            const perpX = -dy / len;
            const perpY = dx / len;
            position = {
              x: position.x - perpX * offset,
              y: position.y - perpY * offset
            };
          }
        }

        return { label, position };
      })
      .filter(
        (
          item
        ): item is {
          label: ConnectorLabelType;
          position: { x: number; y: number };
        } => item !== null
      );
  }, [labels, scenePath, connector.lineType, connector.width, getTilePosition]);

  return (
    <>
      {labelPositions.map(({ label, position }) => {
        if (label.id === '__name__' && isEditingName) {
          return (
            <ConnectorNameEditor
              key="__name__-edit"
              position={position}
              name={connector.name ?? ''}
              onCommit={commitName}
              onCancel={() => setIsEditingName(false)}
            />
          );
        }

        if (label.id === '__name__') {
          return (
            <ConnectorNameLabel
              key="__name__"
              position={position}
              label={label}
              headerLink={connector.headerLink}
            />
          );
        }

        return (
          <ConnectorTextLabel
            key={label.id}
            position={position}
            label={label}
          />
        );
      })}
    </>
  );
});
