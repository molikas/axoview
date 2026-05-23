import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  FileUpload as FileUploadIcon,
  CloudDownloadOutlined as LoadPackIcon,
  ExpandMore as ExpandMoreIcon,
  AutoAwesomeOutlined as AiIcon
} from '@mui/icons-material';
import { useUiStateStore } from 'src/stores/uiStateStore';
import { useModelStore } from 'src/stores/modelStore';
import { Icon } from 'src/types';
import { Searchbox } from 'src/components/ItemControls/IconSelectionControls/Searchbox';
import { Icons } from 'src/components/ItemControls/IconSelectionControls/Icons';
import { IconGrid } from 'src/components/ItemControls/IconSelectionControls/IconGrid';
import { useIconFiltering } from 'src/hooks/useIconFiltering';
import { useIconCategories } from 'src/hooks/useIconCategories';
import { generateId } from 'src/utils';
import { useTranslation } from 'src/stores/localeStore';
import { CommonElements } from './CommonElements';
import { ImportIconsDialog } from './ImportIconsDialog';
import { DeleteIconConfirmDialog } from './DeleteIconConfirmDialog';
import { IconUsageReport } from 'src/types/axoviewProps';

// Literal LLM prompt — intentionally NOT i18n'd. This is content the user
// pastes verbatim into an external AI tool (mqa-results.md #28).
const AI_ICON_PROMPT = `Create an image of 'my object', use folowing parameters: Transparent background. True isometric projection, 30-degree isometric view (mathematical isometric, not 2:1 pixel-art). Orthographic camera at 45° azimuth and 35.264° elevation (arctan 1/√2). All three axes foreshortened equally; the two horizontal edges of any cube run at exactly +30° and -30° above horizontal on screen, and vertical edges stay perfectly vertical. Tile footprint width:height ratio is √3 : 1.`;

export const ElementsPanel = () => {
  const { t } = useTranslation('iconSelectionControls');
  const uiStateActions = useUiStateStore((s) => s.actions);
  const iconCategoriesState = useUiStateStore((s) => s.iconCategoriesState);
  const iconPackManager = useUiStateStore((s) => s.iconPackManager);
  const iconUsageScan = useUiStateStore((s) => s.iconUsageScan);
  const freshlyLoadedCategoryIds = useUiStateStore(
    (s) => s.freshlyLoadedCategoryIds
  );
  const modelActions = useModelStore((s) => s.actions);
  const currentIcons = useModelStore((s) => s.icons);
  const currentItems = useModelStore((s) => s.items);
  const { setFilter, filteredIcons, filter } = useIconFiltering();
  const { iconCategories } = useIconCategories();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pending files waiting for the import dialog confirmation
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  // Delete-imported-icon confirm state
  const [iconPendingDelete, setIconPendingDelete] = useState<Icon | null>(null);
  const [deleteUsage, setDeleteUsage] = useState<IconUsageReport[] | null>(null);
  const [deleteScanning, setDeleteScanning] = useState(false);

  // AI prompt popover state (mqa-results.md #28)
  const [aiPromptAnchor, setAiPromptAnchor] = useState<HTMLElement | null>(null);
  const [aiPromptCopied, setAiPromptCopied] = useState(false);

  const handleCopyAiPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(AI_ICON_PROMPT);
      setAiPromptCopied(true);
      setTimeout(() => setAiPromptCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable (insecure context) — leave the user to
      // copy from the readonly textarea manually.
    }
  }, []);

  const handleIconMouseDown = useCallback(
    (icon: Icon) => {
      uiStateActions.setMode({
        type: 'PLACE_ICON',
        showCursor: true,
        id: icon.id
      });
    },
    [uiStateActions]
  );

  // Step 1: user picks files → stash them, open the dialog
  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((f) =>
        f.type.startsWith('image/')
      );
      if (imageFiles.length > 0) setPendingFiles(imageFiles);

      // Reset input so the same file can be re-selected
      event.target.value = '';
    },
    []
  );

  // Step 2: user confirms in dialog → process and import
  const handleImportConfirm = useCallback(
    async (isIsometric: boolean) => {
      const newIcons: Icon[] = [];
      const existingNames = new Set(
        currentIcons.map((icon) => icon.name.toLowerCase())
      );

      for (const file of pendingFiles) {
        let baseName = file.name.replace(/\.[^/.]+$/, '');
        let finalName = baseName;
        let counter = 1;
        while (existingNames.has(finalName.toLowerCase())) {
          finalName = `${baseName}_${counter}`;
          counter++;
        }
        existingNames.add(finalName.toLowerCase());

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const original = e.target?.result as string;
            if (file.type === 'image/svg+xml') {
              resolve(original);
              return;
            }
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(original);
                return;
              }
              const TARGET = 128;
              const s = Math.min(TARGET / img.width, TARGET / img.height);
              const w = img.width * s,
                h = img.height * s;
              canvas.width = TARGET;
              canvas.height = TARGET;
              ctx.clearRect(0, 0, TARGET, TARGET);
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, (TARGET - w) / 2, (TARGET - h) / 2, w, h);
              resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = original;
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        newIcons.push({
          id: generateId(),
          name: finalName,
          url: dataUrl,
          collection: 'imported',
          isIsometric
        });
      }

      if (newIcons.length > 0) {
        modelActions.set({ icons: [...currentIcons, ...newIcons] });
        const hasImported = iconCategoriesState.some(
          (cat) => cat.id === 'imported'
        );
        if (!hasImported) {
          uiStateActions.setIconCategoriesState([
            ...iconCategoriesState,
            { id: 'imported', isExpanded: true }
          ]);
        }
      }

      setPendingFiles([]);
    },
    [
      pendingFiles,
      currentIcons,
      modelActions,
      iconCategoriesState,
      uiStateActions
    ]
  );

  const handleImportCancel = useCallback(() => {
    setPendingFiles([]);
  }, []);

  // Open the delete confirm dialog and kick off the usage scan.
  // Falls back to a current-diagram scan when the app hasn't injected
  // iconUsageScan (e.g. in tests / stripped embeds).
  const handleIconDelete = useCallback(
    async (icon: Icon) => {
      setIconPendingDelete(icon);
      setDeleteUsage(null);
      setDeleteScanning(true);
      try {
        if (iconUsageScan) {
          const result = await iconUsageScan(icon.id);
          setDeleteUsage(result);
        } else {
          // Local fallback: count refs in the currently loaded items only.
          const count = currentItems.filter((it) => it.icon === icon.id).length;
          setDeleteUsage(
            count > 0
              ? [{ diagramId: '__current__', diagramName: 'Current diagram', count }]
              : []
          );
        }
      } catch (e) {
        // Surface failure as "no usage detected" — better to let the user
        // proceed than to block on a broken scan. The warning copy in the
        // dialog footer already makes the consequence explicit.
        console.error('[ElementsPanel] icon usage scan failed:', e);
        setDeleteUsage([]);
      } finally {
        setDeleteScanning(false);
      }
    },
    [iconUsageScan, currentItems]
  );

  // Clear the freshly-loaded marker after the header pulse animation finishes
  // (animation is 1.6s; small buffer keeps the keyframe from being cut short
  // if the user is mid-frame when state changes).
  useEffect(() => {
    if (freshlyLoadedCategoryIds.length === 0) return;
    const t = window.setTimeout(() => {
      uiStateActions.setFreshlyLoadedCategoryIds([]);
    }, 1800);
    return () => window.clearTimeout(t);
  }, [freshlyLoadedCategoryIds, uiStateActions]);

  const handleDeleteCancel = useCallback(() => {
    setIconPendingDelete(null);
    setDeleteUsage(null);
    setDeleteScanning(false);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!iconPendingDelete) return;
    // modelActions.set() defaults to skipHistory=false → pushes a history
    // entry, so Ctrl+Z restores the icon (which un-tombstones any node that
    // referenced it). See modelStore.tsx and ADR-0002 lifecycle section.
    modelActions.set({
      icons: currentIcons.filter((i) => i.id !== iconPendingDelete.id)
    });
    setIconPendingDelete(null);
    setDeleteUsage(null);
    setDeleteScanning(false);
  }, [iconPendingDelete, currentIcons, modelActions]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Common elements: Rectangle, Text, Connector */}
      <Box
        sx={{
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <CommonElements />
      </Box>

      {/* Search */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          flexShrink: 0
        }}
      >
        <Searchbox value={filter} onChange={setFilter} />
      </Box>

      {/* Icon grid */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1 }}>
        {filteredIcons ? (
          <Box sx={{ py: 1 }}>
            <IconGrid
              icons={filteredIcons}
              onMouseDown={handleIconMouseDown}
              onDelete={handleIconDelete}
            />
          </Box>
        ) : (
          <Icons
            iconCategories={iconCategories}
            onMouseDown={handleIconMouseDown}
            onDelete={handleIconDelete}
          />
        )}
      </Box>

      {/* "Add more icons" — pack loaders + import, collapsed by default */}
      {(() => {
        const loadedCollections = new Set(
          currentIcons.map((icon) => icon.collection).filter(Boolean)
        );
        const unloaded = iconPackManager
          ? iconPackManager.packInfo.filter(
              (p) => !p.loaded && !p.loading && !loadedCollections.has(p.name)
            )
          : [];
        const loading = iconPackManager
          ? iconPackManager.packInfo.filter((p) => p.loading)
          : [];
        const hasPacks = unloaded.length > 0 || loading.length > 0;

        return (
          <Accordion
            disableGutters
            elevation={0}
            square
            defaultExpanded={false}
            sx={{
              flexShrink: 0,
              borderTop: '1px solid',
              borderColor: 'divider',
              '&:before': { display: 'none' },
              bgcolor: 'transparent'
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon fontSize="small" />}
              sx={{ minHeight: 0, py: 0.5, px: 1.5, '& .MuiAccordionSummary-content': { my: 0.5 } }}
            >
              {t('addMoreIcons')}
            </AccordionSummary>
            <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
              {hasPacks && (
                <Stack spacing={0.5} sx={{ mb: 1 }}>
                  {[...loading, ...unloaded].map((pack) => (
                    <Button
                      key={pack.name}
                      size="small"
                      variant="text"
                      fullWidth
                      disabled={pack.loading}
                      startIcon={
                        pack.loading ? (
                          <CircularProgress size={12} color="inherit" />
                        ) : (
                          <LoadPackIcon sx={{ fontSize: 16 }} />
                        )
                      }
                      onClick={() => iconPackManager?.onTogglePack(pack.name, true)}
                      sx={{
                        justifyContent: 'flex-start',
                        color: 'text.secondary',
                        fontSize: 12,
                        py: 0.25,
                        '&:hover': { color: 'text.primary' }
                      }}
                    >
                      {pack.loading
                        ? `Loading ${pack.displayName}…`
                        : pack.displayName}
                    </Button>
                  ))}
                </Stack>
              )}
              {hasPacks && <Divider sx={{ mb: 1 }} />}
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Button
                  variant="outlined"
                  startIcon={<FileUploadIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ flex: 1 }}
                  size="small"
                  data-axoview-id="dock-elements-import-icons"
                >
                  {t('importIcons')}
                </Button>
                <Tooltip title={t('aiPromptTooltip')} placement="top">
                  <IconButton
                    size="small"
                    onClick={(e) => setAiPromptAnchor(e.currentTarget)}
                    sx={{ flexShrink: 0, color: 'primary.main' }}
                  >
                    <AiIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </AccordionDetails>
          </Accordion>
        );
      })()}

      <Popover
        open={!!aiPromptAnchor}
        anchorEl={aiPromptAnchor}
        onClose={() => setAiPromptAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1.5, maxWidth: 360 } } }}
      >
        <Stack spacing={1}>
          <Typography variant="subtitle2">{t('aiPromptTitle')}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t('aiPromptBody')}
          </Typography>
          <TextField
            multiline
            minRows={4}
            maxRows={8}
            value={AI_ICON_PROMPT}
            InputProps={{ readOnly: true, sx: { fontSize: 11, fontFamily: 'monospace' } }}
            size="small"
          />
          <Stack direction="row" justifyContent="flex-end">
            <Button
              variant={aiPromptCopied ? 'contained' : 'outlined'}
              color={aiPromptCopied ? 'success' : 'primary'}
              size="small"
              onClick={handleCopyAiPrompt}
              sx={{ textTransform: 'none' }}
            >
              {aiPromptCopied ? t('aiPromptCopied') : t('aiPromptCopy')}
            </Button>
          </Stack>
        </Stack>
      </Popover>

      <ImportIconsDialog
        open={pendingFiles.length > 0}
        fileCount={pendingFiles.length}
        onConfirm={handleImportConfirm}
        onCancel={handleImportCancel}
      />

      <DeleteIconConfirmDialog
        open={!!iconPendingDelete}
        icon={iconPendingDelete}
        usage={deleteUsage}
        scanning={deleteScanning}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </Box>
  );
};
