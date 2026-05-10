import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Stack, Typography, Divider, Alert } from '@mui/material';
import { Icon } from 'src/types';
import { useModelStore } from 'src/stores/modelStore';
import { useIconCategories } from 'src/hooks/useIconCategories';
import { useIconFiltering } from 'src/hooks/useIconFiltering';
import { IconGrid } from '../IconSelectionControls/IconGrid';
import { Icons } from '../IconSelectionControls/Icons';
import { Searchbox } from '../IconSelectionControls/Searchbox';
import { Section } from '../components/Section';
import { useTranslation } from 'src/stores/localeStore';

interface Props {
  onIconSelected: (icon: Icon) => void;
  onClose?: () => void;
  currentIconId?: string;
}

const RECENT_ICONS_KEY = 'fossflow-recent-icons';
const MAX_RECENT_ICONS = 12;

const getRecentIcons = (): string[] => {
  try {
    const stored = localStorage.getItem(RECENT_ICONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const addToRecentIcons = (iconId: string) => {
  const recent = getRecentIcons();
  const filtered = recent.filter((id) => id !== iconId);
  const updated = [iconId, ...filtered].slice(0, MAX_RECENT_ICONS);
  localStorage.setItem(RECENT_ICONS_KEY, JSON.stringify(updated));
};

export const QuickIconSelector = ({
  onIconSelected,
  onClose,
  currentIconId: _currentIconId
}: Props) => {
  const { t } = useTranslation('quickIconSelector');
  const [hoveredIndex, setHoveredIndex] = useState(0);
  const { setFilter, filter, filteredIcons } = useIconFiltering();

  const icons = useModelStore((state) => state.icons);
  const { iconCategories } = useIconCategories();

  const recentIconIds = useMemo(() => getRecentIcons(), []);
  const recentIcons = useMemo(() => {
    return recentIconIds
      .map((id) => icons.find((icon) => icon.id === id))
      .filter(Boolean) as Icon[];
  }, [recentIconIds, icons]);

  const handleIconSelect = useCallback(
    (icon: Icon) => {
      addToRecentIcons(icon.id);
      onIconSelected(icon);
    },
    [onIconSelected]
  );

  const handleIconDoubleClick = useCallback(
    (icon: Icon) => {
      handleIconSelect(icon);
      onClose?.();
    },
    [handleIconSelect, onClose]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!filteredIcons || filteredIcons.length === 0) return;

      const itemsPerRow = 4;
      const totalItems = filteredIcons.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHoveredIndex((prev) =>
            Math.min(prev + itemsPerRow, totalItems - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHoveredIndex((prev) => Math.max(prev - itemsPerRow, 0));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          setHoveredIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case 'ArrowRight':
          e.preventDefault();
          setHoveredIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredIcons[hoveredIndex]) {
            handleIconSelect(filteredIcons[hoveredIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredIcons, hoveredIndex, onClose, handleIconSelect]);

  return (
    <Box>
      <Section sx={{ py: 2 }}>
        <Stack spacing={2}>
          <Searchbox
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setHoveredIndex(0);
            }}
            autoFocus
            size="small"
          />

          {!filter && recentIcons.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary">
                {t('recentlyUsed')}
              </Typography>
              <IconGrid
                icons={recentIcons}
                onClick={handleIconSelect}
                onDoubleClick={handleIconDoubleClick}
              />
              <Divider />
            </>
          )}
        </Stack>
      </Section>

      {filter && filteredIcons && (
        <>
          <Section sx={{ py: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {t('searchResults').replace('{count}', String(filteredIcons.length))}
            </Typography>
          </Section>
          <Divider />
          <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {filteredIcons.length > 0 ? (
              <Section>
                <IconGrid
                  icons={filteredIcons}
                  onClick={handleIconSelect}
                  onDoubleClick={handleIconDoubleClick}
                  hoveredIndex={hoveredIndex}
                  onHover={setHoveredIndex}
                />
              </Section>
            ) : (
              <Section>
                <Alert severity="info">
                  {t('noIconsFound').replace('{term}', filter)}
                </Alert>
              </Section>
            )}
          </Box>
        </>
      )}

      {!filter && (
        <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
          <Icons
            iconCategories={iconCategories}
            onClick={handleIconSelect}
            onMouseDown={() => {}}
          />
        </Box>
      )}
    </Box>
  );
};
