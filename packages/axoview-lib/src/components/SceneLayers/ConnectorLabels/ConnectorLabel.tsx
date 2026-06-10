import React, { useMemo, memo, useEffect, useState, useCallback } from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
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
import { useScene } from 'src/hooks/useScene';
import { useUiStateStore } from 'src/stores/uiStateStore';

const INLINE_EDIT_EVENT = 'inlineEditNodeName';

interface Props {
  connector: Connector;
}

export const ConnectorLabel = memo(({ connector }: Props) => {
  const scenePath = useSceneStore(
    (state) => state.connectors[connector.id]?.path,
    (a, b) => a === b
  );
  const { getTilePosition } = useCanvasMode();
  const { updateConnector } = useScene();
  const editorMode = useUiStateStore((s) => s.editorMode);
  const isEditable = editorMode === 'EDITABLE';

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
    if (!trimmedName || connector.showLabel === false) return base;
    const synthetic: ConnectorLabelType = {
      id: '__name__',
      text: trimmedName,
      position: 50,
      line: '1',
      height: 0
    };
    return [synthetic, ...base];
  }, [connector, trimmedName]);

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
            <Box
              key="__name__-edit"
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
                onBlur={(e) => commitName(e.currentTarget.innerText)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).blur();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsEditingName(false);
                  }
                }}
                ref={(el) => {
                  if (el && document.activeElement !== el) {
                    el.focus();
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    const sel = window.getSelection();
                    sel?.removeAllRanges();
                    sel?.addRange(range);
                  }
                }}
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
                {connector.name ?? ''}
              </Typography>
            </Box>
          );
        }

        // Name label (not editing) — clickable when headerLink is set
        if (label.id === '__name__') {
          const url = connector.headerLink
            ? /^https?:\/\//i.test(connector.headerLink)
              ? connector.headerLink
              : `https://${connector.headerLink}`
            : null;
          return (
            <Box
              key="__name__"
              sx={{
                position: 'absolute',
                pointerEvents: url ? 'auto' : 'none',
                cursor: url ? 'pointer' : 'default'
              }}
              style={{ maxWidth: PROJECTED_TILE_SIZE.width, left: position.x, top: position.y }}
              onClick={url ? (e) => { e.stopPropagation(); window.open(url, '_blank', 'noopener,noreferrer'); } : undefined}
            >
              <Label
                maxWidth={150}
                labelHeight={label.height || 0}
                showLine={false}
                sx={{ py: 0.75, px: 1, borderRadius: 2, backgroundColor: 'background.paper', opacity: 0.95 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 400, color: url ? 'primary.main' : 'text.primary' }}>
                    {label.text}
                  </Typography>
                  {url && <OpenInNewIcon sx={{ fontSize: 11, color: 'primary.main', flexShrink: 0 }} />}
                </Box>
              </Label>
            </Box>
          );
        }

        return (
          <Box
            key={label.id}
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
                  ...(label.fontSize ? { fontSize: `${label.fontSize}px` } : {})
                }}
              >
                {label.text}
              </Typography>
            </Label>
          </Box>
        );
      })}
    </>
  );
});
