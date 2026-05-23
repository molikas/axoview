import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { flattenCollections } from '@isoflow/isopacks/dist/utils';
import isoflowIsopack from '@isoflow/isopacks/dist/isoflow';
import type { AxoviewRef } from 'axoview';
import { DiagramData } from '../diagramUtils';
import { useIconPackManager } from '../services/iconPackManager';
import { useAppStorage } from './AppStorageContext';
import { useAutoSave, SaveStatus } from '../hooks/useAutoSave';
import { DiagramManager } from '../components/DiagramManager';
import { SaveDialog } from '../components/SaveDialog';
import { LoadDialog } from '../components/LoadDialog';
import { ExportSingleDiagramDialog } from '../components/ExportSingleDiagramDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { LocalStorageInspector } from '../LocalStorageInspector';
import { notificationStore } from '../stores/notificationStore';
import { sequentialName } from '../utils/fileOperations';
import { apiBaseUrl } from '../utils/apiBaseUrl';
import { exportAsJSON } from 'axoview';

// Core icons — loaded once at module level
const coreIcons = flattenCollections([isoflowIsopack]);

const defaultColors = [
  { id: 'blue', value: '#0066cc' },
  { id: 'green', value: '#00aa00' },
  { id: 'red', value: '#cc0000' },
  { id: 'orange', value: '#ff9900' },
  { id: 'purple', value: '#9900cc' },
  { id: 'black', value: '#000000' },
  { id: 'gray', value: '#666666' }
];

// Module-level Set helpers
function setWithAdd(prev: Set<string>, item: string): Set<string> {
  if (prev.has(item)) return prev;
  const next = new Set(prev);
  next.add(item);
  return next;
}
function setWithout(prev: Set<string>, ...items: string[]): Set<string> {
  const hasAny = items.some((i) => prev.has(i));
  if (!hasAny) return prev;
  const next = new Set(prev);
  for (const item of items) next.delete(item);
  return next;
}

export interface SavedDiagram {
  id: string;
  name: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

interface PendingConfirm {
  message: string;
  onConfirm: () => void;
  onDiscard?: () => void;
}

interface DiagramLifecycleContextValue {
  // Diagram state
  diagramName: string;
  setDiagramName: (name: string) => void;
  hasUnsavedChanges: boolean;
  lastSaved: Date | null;
  currentDiagram: SavedDiagram | null;
  diagrams: SavedDiagram[];
  currentModel: DiagramData | null;
  isReadonlyUrl: boolean;
  isPublicShareUrl: boolean;
  readonlyLoadFailed: boolean;
  clearReadonlyLoadFailed: () => void;
  publicShareLoadFailed: boolean;
  clearPublicShareLoadFailed: () => void;
  // Auto-save status (server mode)
  saveStatus: SaveStatus;
  // Dialog state
  showExportDialog: boolean;
  setShowExportDialog: (v: boolean) => void;
  // Refs
  axoviewRef: React.RefObject<AxoviewRef | null>;
  isAfterLoadRef: React.MutableRefObject<boolean>;
  frozenInitialDataRef: React.MutableRefObject<DiagramData | null>;
  // Portal state
  toolbarPortalTarget: HTMLElement | null;
  setToolbarPortalTarget: (el: HTMLElement) => void;
  sidebarTogglePortalTarget: HTMLElement | null;
  setSidebarTogglePortalTarget: (el: HTMLElement) => void;
  // Actions
  handleSaveClick: () => Promise<void>;
  handleOpenClick: () => void;
  handlePreviewClick: () => Promise<void>;
  handleModelUpdated: (model: any) => void;
  handleExportJSON: () => void;
  handleExportImage: () => void;
  handleExportProject: () => void;
  isProjectExportOpen: boolean;
  closeProjectExport: () => void;
  handleNewDiagram: () => Promise<void>;
  handleRenameCurrentDiagram: (newName: string) => Promise<void>;
  notifyDiagramRenamedFromTree: (id: string, newName: string) => void;
  notifyDiagramDeletedFromTree: (id: string) => void;
  saveAllDirty: () => Promise<void>;
  handleCreateBlankDiagram: (folderId: string | null) => Promise<void>;
  checkUnsavedBeforeNavigate: (onProceed: () => void) => void;
  // File explorer
  fileExplorerOpen: boolean;
  setFileExplorerOpen: (open: boolean) => void;
  openDiagramById: (id: string, name: string) => Promise<void>;
  fileTreeRefreshToken: number;
  refreshFileTree: () => void;
  dirtyDiagramIds: Set<string>;
  /**
   * Session-mode flag: true when the session has any work that has not been
   * exported to a project zip. Independent of `hasUnsavedChanges` (which tracks
   * "model differs from save target"). Cleared only by a successful project zip
   * export — see `markProjectExported`.
   */
  sessionWorkUnexported: boolean;
  markProjectExported: () => void;
  // Icon pack
  iconPackManagerProp: {
    lazyLoadingEnabled: boolean;
    onToggleLazyLoading: () => void;
    packInfo: any[];
    enabledPacks: string[];
    onTogglePack: (packName: string, enabled: boolean) => void;
  };
}

const DiagramLifecycleContext = createContext<DiagramLifecycleContextValue>(
  null as any
);

export function DiagramLifecycleProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const { readonlyDiagramId, shareUuid } = useParams<{
    readonlyDiagramId: string;
    shareUuid: string;
  }>();
  const navigate = useNavigate();
  const { t } = useTranslation('app');
  const { storage, serverStorageAvailable, isInitialized } = useAppStorage();
  const iconPackManager = useIconPackManager(coreIcons);

  const isPublicShareUrl = !!shareUuid;
  const isReadonlyUrl =
    isPublicShareUrl ||
    (window.location.pathname.startsWith('/display/') && !!readonlyDiagramId);

  const axoviewRef = useRef<AxoviewRef>(null);

  // ---------------------------------------------------------------------------
  // Diagram list state
  // ---------------------------------------------------------------------------
  const [diagrams, setDiagrams] = useState<SavedDiagram[]>([]);
  const [isDiagramsInitialized, setIsDiagramsInitialized] = useState(false);
  const [currentDiagram, setCurrentDiagram] = useState<SavedDiagram | null>(null);
  const [diagramName, setDiagramName] = useState('');
  const [readonlyLoadFailed, setReadonlyLoadFailed] = useState(false);
  const clearReadonlyLoadFailed = useCallback(() => setReadonlyLoadFailed(false), []);
  const [publicShareLoadFailed, setPublicShareLoadFailed] = useState(false);
  const clearPublicShareLoadFailed = useCallback(() => setPublicShareLoadFailed(false), []);

  // Clear stale failure flags when the user leaves the readonly route — covers
  // the preview → back-to-editing case where an in-flight load could surface
  // its error dialog on the editor route in spite of the cancel guard.
  useEffect(() => {
    if (!isReadonlyUrl) {
      setReadonlyLoadFailed(false);
      setPublicShareLoadFailed(false);
    }
  }, [isReadonlyUrl]);

  // ---------------------------------------------------------------------------
  // UI state
  // ---------------------------------------------------------------------------
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showStorageManager, setShowStorageManager] = useState(false);
  const [showDiagramManager, setShowDiagramManager] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

  // ---------------------------------------------------------------------------
  // Model / save state
  // ---------------------------------------------------------------------------
  const [currentModel, setCurrentModel] = useState<DiagramData | null>(null);

  // Session-mode dirty tracking (unchanged)
  const [dirtyDiagramIds, setDirtyDiagramIds] = useState<Set<string>>(new Set());
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // ADR — session-mode "work needs to be exported to a file" flag, decoupled
  // from hasUnsavedChanges. Listens to the same custom event the gauge uses,
  // since every session mutation already dispatches it.
  const [sessionWorkUnexported, setSessionWorkUnexported] = useState(false);
  const markProjectExported = useCallback(() => {
    setSessionWorkUnexported(false);
  }, []);
  const hasUnsavedChangesRef = useRef(false);
  const sessionWorkUnexportedRef = useRef(false);
  useEffect(() => {
    sessionWorkUnexportedRef.current = sessionWorkUnexported;
  }, [sessionWorkUnexported]);
  useEffect(() => {
    if (serverStorageAvailable) return; // server mode does not use this flag
    const handler = () => setSessionWorkUnexported(true);
    window.addEventListener('axoview-session-changed', handler);
    return () => window.removeEventListener('axoview-session-changed', handler);
  }, [serverStorageAvailable]);

  // beforeunload — warn before leaving with unsaved/un-exported work.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const trigger = serverStorageAvailable
        ? hasUnsavedChangesRef.current
        : sessionWorkUnexportedRef.current;
      if (!trigger) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [serverStorageAvailable]);

  // In server mode the single-diagram hasUnsavedChanges is driven by saveStatus.
  // In session mode it uses dirtyDiagramIds as before.
  const hasUnsavedChanges = serverStorageAvailable
    ? false  // toolbar uses saveStatus directly in server mode
    : dirtyDiagramIds.has(currentDiagram?.id ?? '__unsaved__');
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // ---------------------------------------------------------------------------
  // Auto-save (server mode only)
  // ---------------------------------------------------------------------------
  const autoSave = useAutoSave({
    storage,
    enabled: !!storage && !isReadonlyUrl,
    onSaved: (id, savedAt) => {
      setLastSaved(savedAt);
      setFileTreeRefreshToken((n) => n + 1);
      // In session mode, clear the dirty bit so the badge + unsaved indicator update.
      if (!serverStorageAvailable) {
        setDirtyDiagramIds((prev) => setWithout(prev, id));
        scratchBufferRef.current.delete(id);
      }
    },
    onError: () => {
      notificationStore.push({
        severity: 'error',
        message: t('alert.saveFailed', 'Auto-save failed — check your connection.')
      });
    }
  });

  // ---------------------------------------------------------------------------
  // File explorer panel state
  // ---------------------------------------------------------------------------
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false);
  const [fileTreeRefreshToken, setFileTreeRefreshToken] = useState(0);
  const explorerInitializedRef = useRef(false);

  // Initialize fileExplorerOpen once storage check completes
  useEffect(() => {
    if (!isInitialized || explorerInitializedRef.current) return;
    explorerInitializedRef.current = true;
    if (!serverStorageAvailable) {
      setFileExplorerOpen(false);
      return;
    }
    const flag = localStorage.getItem('axoview-explorer-initialized');
    if (!flag) {
      localStorage.setItem('axoview-explorer-initialized', '1');
      setFileExplorerOpen(true);
    } else {
      const saved = localStorage.getItem('axoview-explorer-open');
      setFileExplorerOpen(saved === 'true');
    }
  }, [isInitialized, serverStorageAvailable]);

  // Persist fileExplorerOpen to localStorage (server mode only)
  useEffect(() => {
    if (!isInitialized || !serverStorageAvailable) return;
    localStorage.setItem('axoview-explorer-open', String(fileExplorerOpen));
  }, [fileExplorerOpen, isInitialized, serverStorageAvailable]);

  // ---------------------------------------------------------------------------
  // Portal state
  // ---------------------------------------------------------------------------
  const [toolbarPortalTarget, setToolbarPortalTarget] =
    useState<HTMLElement | null>(null);
  const [sidebarTogglePortalTarget, setSidebarTogglePortalTarget] =
    useState<HTMLElement | null>(null);

  // ---------------------------------------------------------------------------
  // Initial diagram data (from localStorage, frozen on first render)
  // ---------------------------------------------------------------------------
  const [diagramData] = useState<DiagramData>(() => {
    const lastOpenedData = localStorage.getItem('axoview-last-opened-data');
    if (lastOpenedData) {
      try {
        const data = JSON.parse(lastOpenedData);
        if (!Array.isArray(data.items) || !Array.isArray(data.views)) {
          console.warn('axoview-last-opened-data had invalid structure, discarding.');
          localStorage.removeItem('axoview-last-opened-data');
          throw new Error('invalid structure');
        }
        const importedIcons = (data.icons || []).filter(
          (icon: any) => icon.collection === 'imported'
        );
        return {
          ...data,
          icons: [...coreIcons, ...importedIcons],
          colors: data.colors?.length ? data.colors : defaultColors,
          items: data.items,
          views: data.views,
          fitToScreen: data.fitToScreen !== false
        };
      } catch (e) {
        console.error('Failed to load last opened data:', e);
      }
    }
    return {
      title: 'Untitled Diagram',
      icons: coreIcons,
      colors: defaultColors,
      items: [],
      views: [],
      fitToScreen: true
    };
  });

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------
  const isAfterLoadRef = useRef(true);
  const currentModelRef = useRef<DiagramData | null>(null);
  useEffect(() => { currentModelRef.current = currentModel; }, [currentModel]);

  const currentDiagramRef = useRef<SavedDiagram | null>(null);
  useEffect(() => { currentDiagramRef.current = currentDiagram; }, [currentDiagram]);

  const diagramNameRef = useRef(diagramName);
  useEffect(() => { diagramNameRef.current = diagramName; }, [diagramName]);

  // Session-mode scratch buffer
  const scratchBufferRef = useRef<Map<string, DiagramData>>(new Map());
  const dirtyDiagramIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => { dirtyDiagramIdsRef.current = dirtyDiagramIds; }, [dirtyDiagramIds]);

  // Storage ref so callbacks don't stale
  const storageRef = useRef(storage);
  useEffect(() => { storageRef.current = storage; }, [storage]);

  // ---------------------------------------------------------------------------
  // Frozen initial data for Axoview
  // ---------------------------------------------------------------------------
  const frozenInitialDataRef = useRef<DiagramData | null>(null);
  if (frozenInitialDataRef.current === null) {
    const importedIcons = (diagramData.icons || []).filter(
      (icon: any) => icon.collection === 'imported'
    );
    frozenInitialDataRef.current = {
      ...diagramData,
      icons: [...iconPackManager.loadedIcons, ...importedIcons]
    };
  }

  // ---------------------------------------------------------------------------
  // Load public-share snapshot from URL (no auth, no diagram-list fetch)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isPublicShareUrl || !shareUuid) return;
    // ADR 0009 Decision 3: share routes are session-mode only. In Local mode
    // the LocalModeShareErrorDialog handles the user-visible feedback;
    // suppress the fetch so the generic error toast doesn't also fire.
    if (!serverStorageAvailable) return;
    const loadPublicSnapshot = async () => {
      try {
        const response = await fetch(`${apiBaseUrl()}/api/public/diagrams/${shareUuid}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as any;
        const name = data.title || data.name || 'Shared Diagram';
        await iconPackManager.loadPacksForDiagram(data);
        const importedIcons = (data.icons || []).filter(
          (icon: any) => icon.collection === 'imported'
        );
        const dataWithIcons: DiagramData = {
          ...data,
          title: name,
          icons: [...iconPackManager.loadedIcons, ...importedIcons],
          colors: data.colors?.length ? data.colors : defaultColors,
          items: Array.isArray(data.items) ? data.items : [],
          views: Array.isArray(data.views) ? data.views : [],
          fitToScreen: data.fitToScreen !== false
        };
        const sharedDiagram: SavedDiagram = {
          id: shareUuid,
          name,
          data: dataWithIcons,
          createdAt: data.sharedAt || new Date().toISOString(),
          updatedAt: data.sharedAt || new Date().toISOString()
        };
        setCurrentDiagram(sharedDiagram);
        setDiagramName(name);
        setCurrentModel(dataWithIcons);
        setLastSaved(new Date(sharedDiagram.updatedAt));
        isAfterLoadRef.current = true;
        if (!axoviewRef.current) {
          frozenInitialDataRef.current = dataWithIcons;
        }
        axoviewRef.current?.load(dataWithIcons as any);
      } catch (_error) {
        setPublicShareLoadFailed(true);
      }
    };
    loadPublicSnapshot();
  }, [isPublicShareUrl, shareUuid, serverStorageAvailable]);

  // ---------------------------------------------------------------------------
  // Load readonly diagram from URL (owner-only, requires auth)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isPublicShareUrl) return; // public-share path uses the effect above
    if (!isReadonlyUrl || !storage) return;
    // Cancel the in-flight load if the user navigates away (Back to editing)
    // before the async chain settles — otherwise a late-resolving catch
    // surfaces ReadonlyLoadErrorDialog on the editor route after the readonly
    // view already unmounted, which is what the user reported on the
    // preview → back-to-editing flow.
    let cancelled = false;
    const loadReadonlyDiagram = async () => {
      try {
        const diagramList = await storage.listDiagrams();
        if (cancelled) return;
        const diagramInfo = diagramList.find((d) => d.id === readonlyDiagramId);
        const data = await storage.loadDiagram(readonlyDiagramId!);
        if (cancelled) return;
        await iconPackManager.loadPacksForDiagram(data);
        if (cancelled) return;
        const importedIcons = ((data as any).icons || []).filter(
          (icon: any) => icon.collection === 'imported'
        );
        const dataWithIcons: DiagramData = {
          ...(data as any),
          icons: [...iconPackManager.loadedIcons, ...importedIcons],
          colors: (data as any)?.colors?.length ? (data as any).colors : defaultColors,
          items: Array.isArray((data as any)?.items) ? (data as any).items : [],
          views: Array.isArray((data as any)?.views) ? (data as any).views : [],
          fitToScreen: (data as any)?.fitToScreen !== false
        };
        const readonlyDiagram: SavedDiagram = {
          id: readonlyDiagramId!,
          name: diagramInfo?.name || (data as any).title || 'Readonly Diagram',
          data: dataWithIcons,
          createdAt: new Date().toISOString(),
          updatedAt: diagramInfo?.lastModified || new Date().toISOString()
        };
        setCurrentDiagram(readonlyDiagram);
        setDiagramName(readonlyDiagram.name);
        setCurrentModel(dataWithIcons);
        setLastSaved(new Date(readonlyDiagram.updatedAt));
        isAfterLoadRef.current = true;
        if (!axoviewRef.current) {
          frozenInitialDataRef.current = dataWithIcons;
        }
        axoviewRef.current?.load(dataWithIcons as any);
      } catch (_error) {
        if (cancelled) return;
        setReadonlyLoadFailed(true);
      }
    };
    loadReadonlyDiagram();
    return () => {
      cancelled = true;
    };
  }, [readonlyDiagramId, storage]);

  // ---------------------------------------------------------------------------
  // Reload icon packs when they change
  // ---------------------------------------------------------------------------
  const iconPackEffectMountedRef = useRef(false);
  useEffect(() => {
    if (!iconPackEffectMountedRef.current) {
      iconPackEffectMountedRef.current = true;
      return;
    }
    if (!axoviewRef.current || !currentModelRef.current) return;
    const importedIcons = (currentModelRef.current.icons || []).filter(
      (icon: any) => icon.collection === 'imported'
    );
    const mergedIcons = [...iconPackManager.loadedIcons, ...importedIcons];
    isAfterLoadRef.current = true;
    axoviewRef.current.load(
      { ...currentModelRef.current, icons: mergedIcons } as any,
      { preserveViewport: true }
    );
  }, [iconPackManager.loadedIcons]);

  // ---------------------------------------------------------------------------
  // Load diagrams from localStorage (session mode)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const savedDiagrams = localStorage.getItem('axoview-diagrams');
    if (savedDiagrams) {
      setDiagrams(JSON.parse(savedDiagrams));
      setIsDiagramsInitialized(true);
    }
    const lastOpenedId = localStorage.getItem('axoview-last-opened');
    if (lastOpenedId && savedDiagrams) {
      try {
        const allDiagrams = JSON.parse(savedDiagrams);
        const lastDiagram = allDiagrams.find(
          (d: SavedDiagram) => d.id === lastOpenedId
        );
        if (lastDiagram) {
          setCurrentDiagram(lastDiagram);
          setDiagramName(lastDiagram.name);
          setCurrentModel(diagramData);
        }
      } catch (e) {
        console.error('Failed to restore last diagram metadata:', e);
      }
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Persist diagrams to localStorage (session mode)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isDiagramsInitialized) return;
    try {
      const diagramsToStore = diagrams.map((d) => ({
        ...d,
        data: { ...d.data, icons: [] }
      }));
      localStorage.setItem('axoview-diagrams', JSON.stringify(diagramsToStore));
    } catch (e) {
      console.error('Failed to save diagrams:', e);
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        notificationStore.push({
          severity: 'error',
          message: t('alert.quotaExceeded')
        });
      }
    }
  }, [diagrams]);

  // ---------------------------------------------------------------------------
  // Warn before unload
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasPending = serverStorageAvailable
        ? autoSave.saveStatus === 'saving'
        : dirtyDiagramIds.size > 0;
      if (hasPending) {
        e.preventDefault();
        e.returnValue = t('alert.beforeUnload');
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyDiagramIds, autoSave.saveStatus, serverStorageAvailable]);

  // ---------------------------------------------------------------------------
  // Build save payload (session mode / Ctrl+S in server mode)
  // ---------------------------------------------------------------------------
  const buildSaveData = useCallback(() => {
    const importedIcons = (currentModel?.icons || diagramData.icons || []).filter(
      (icon: any) => icon.collection === 'imported'
    );
    const preservedRequiredPacks = (currentModel as any)?.requiredPacks;
    return {
      title: currentModel?.title || diagramName || 'Untitled Diagram',
      icons: importedIcons,
      colors: currentModel?.colors || diagramData.colors || [],
      items: currentModel?.items || diagramData.items || [],
      views: currentModel?.views || diagramData.views || [],
      fitToScreen: true,
      ...(Array.isArray(preservedRequiredPacks)
        ? { requiredPacks: preservedRequiredPacks }
        : {})
    };
  }, [currentModel, diagramData, diagramName]);

  // ---------------------------------------------------------------------------
  // Session-mode save
  // ---------------------------------------------------------------------------
  const executeSave = useCallback(
    async (existingDiagram?: SavedDiagram) => {
      const s = storageRef.current;
      const importedIcons = (currentModel?.icons || diagramData.icons || []).filter(
        (icon) => icon.collection === 'imported'
      );
      const preservedRequiredPacks = (currentModel as any)?.requiredPacks;
      const savedData = {
        title: diagramName,
        icons: importedIcons,
        colors: currentModel?.colors || diagramData.colors || [],
        items: currentModel?.items || diagramData.items || [],
        views: currentModel?.views || diagramData.views || [],
        fitToScreen: true,
        ...(Array.isArray(preservedRequiredPacks)
          ? { requiredPacks: preservedRequiredPacks }
          : {})
      };

      // Resolve the diagram ID — new diagrams must go through createDiagram so
      // the storage provider (and the file tree) knows about them.
      let id: string;
      let createdAt: string;
      try {
        if (currentDiagram) {
          id = currentDiagram.id;
          createdAt = currentDiagram.createdAt;
          if (s) await s.saveDiagram(id, savedData as any);
        } else if (existingDiagram) {
          id = existingDiagram.id;
          createdAt = existingDiagram.createdAt;
          if (s) await s.saveDiagram(id, savedData as any);
        } else {
          // Brand-new diagram: let the storage provider allocate the ID.
          id = s ? await s.createDiagram(savedData as any, null) : Date.now().toString();
          createdAt = new Date().toISOString();
        }
      } catch (e) {
        console.error('executeSave: storage op failed', e);
        notificationStore.push({ severity: 'error', message: t('alert.saveFailed', 'Save failed') });
        return;
      }

      const newDiagram: SavedDiagram = {
        id,
        name: diagramName,
        data: savedData,
        createdAt,
        updatedAt: new Date().toISOString()
      };
      if (currentDiagram) {
        setDiagrams(diagrams.map((d) => (d.id === currentDiagram.id ? newDiagram : d)));
      } else if (existingDiagram) {
        setDiagrams(
          diagrams.map((d) =>
            d.id === existingDiagram.id
              ? { ...newDiagram, id: existingDiagram.id, createdAt: existingDiagram.createdAt }
              : d
          )
        );
      } else {
        setDiagrams([...diagrams, newDiagram]);
      }
      setCurrentDiagram(newDiagram);
      setShowSaveDialog(false);
      const oldKey = currentDiagram?.id ?? '__unsaved__';
      scratchBufferRef.current.delete(oldKey);
      scratchBufferRef.current.delete(newDiagram.id);
      setDirtyDiagramIds((prev) => setWithout(prev, oldKey, newDiagram.id));
      setLastSaved(new Date());
      setFileTreeRefreshToken((n) => n + 1);
      notificationStore.push({ severity: 'success', message: `"${diagramName}" saved` });
      try {
        localStorage.setItem('axoview-last-opened', newDiagram.id);
        localStorage.setItem('axoview-last-opened-data', JSON.stringify(newDiagram.data));
      } catch (e) {
        console.error('Failed to save diagram:', e);
        if (e instanceof DOMException && e.name === 'QuotaExceededError') {
          notificationStore.push({ severity: 'error', message: t('alert.storageFull') });
          setShowStorageManager(true);
        }
      }
    },
    [diagramName, diagrams, currentDiagram, currentModel, diagramData, t]
  );

  const saveDiagram = useCallback(() => {
    if (!diagramName.trim()) {
      notificationStore.push({ severity: 'error', message: t('alert.enterDiagramName') });
      return;
    }
    const existingDiagram = diagrams.find(
      (d) => d.name === diagramName.trim() && d.id !== currentDiagram?.id
    );
    if (existingDiagram) {
      setPendingConfirm({
        message: t('alert.diagramExists', { name: diagramName }),
        onConfirm: () => executeSave(existingDiagram)
      });
      return;
    }
    executeSave();
  }, [diagramName, diagrams, currentDiagram, t, executeSave]);

  // ---------------------------------------------------------------------------
  // Session-mode load
  // ---------------------------------------------------------------------------
  const executeLoad = useCallback(
    async (diagram: SavedDiagram) => {
      await iconPackManager.loadPacksForDiagram(diagram.data);
      const importedIcons = (diagram.data.icons || []).filter(
        (icon: any) => icon.collection === 'imported'
      );
      const dataWithIcons = {
        ...diagram.data,
        icons: [...iconPackManager.loadedIcons, ...importedIcons]
      };
      setCurrentDiagram(diagram);
      setDiagramName(diagram.name);
      setCurrentModel(dataWithIcons);
      setShowLoadDialog(false);
      setLastSaved(new Date(diagram.updatedAt));
      isAfterLoadRef.current = true;
      axoviewRef.current?.load(dataWithIcons as any);
      try {
        localStorage.setItem('axoview-last-opened', diagram.id);
        localStorage.setItem('axoview-last-opened-data', JSON.stringify(diagram.data));
      } catch (e) {
        console.error('Failed to save last opened:', e);
      }
    },
    [iconPackManager]
  );

  const loadDiagram = useCallback(
    async (diagram: SavedDiagram, skipUnsavedCheck = false) => {
      if (!skipUnsavedCheck && hasUnsavedChanges) {
        setPendingConfirm({
          message: t('alert.unsavedChanges'),
          onConfirm: () => executeLoad(diagram)
        });
        return;
      }
      await executeLoad(diagram);
    },
    [hasUnsavedChanges, executeLoad, t]
  );

  const deleteDiagram = useCallback(
    (id: string) => {
      setPendingConfirm({
        message: t('alert.confirmDelete'),
        onConfirm: () => {
          setDiagrams(diagrams.filter((d) => d.id !== id));
          if (currentDiagram?.id === id) {
            setCurrentDiagram(null);
            setDiagramName('');
          }
        }
      });
    },
    [diagrams, currentDiagram, t]
  );

  const exportDiagram = useCallback(() => {
    const modelToExport = currentModel || diagramData;
    const iconMap = new Map();
    (modelToExport.icons || []).forEach((icon) => iconMap.set(icon.id, icon));
    (diagramData.icons || [])
      .filter((icon) => icon.collection === 'imported')
      .forEach((icon) => {
        if (!iconMap.has(icon.id)) iconMap.set(icon.id, icon);
      });
    const exportData = {
      title: diagramName || modelToExport.title || 'Exported Diagram',
      icons: Array.from(iconMap.values()),
      colors: modelToExport.colors || [],
      items: modelToExport.items || [],
      views: modelToExport.views || [],
      fitToScreen: true
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${diagramName || 'diagram'}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  }, [currentModel, diagramData, diagramName]);

  // ---------------------------------------------------------------------------
  // Server-mode: load diagram into canvas
  // ---------------------------------------------------------------------------
  const handleDiagramManagerLoad = useCallback(
    async (id: string, rawData: any, listingName: string) => {
      const data: any = rawData;

      const loadedIcons = data.icons || [];
      await iconPackManager.loadPacksForDiagram(data);
      const hasDefaultIcons = loadedIcons.some(
        (icon: any) =>
          icon.collection === 'isoflow' ||
          icon.collection === 'aws' ||
          icon.collection === 'gcp'
      );
      const finalIcons = hasDefaultIcons
        ? loadedIcons
        : [
            ...iconPackManager.loadedIcons,
            ...loadedIcons.filter((icon: any) => icon.collection === 'imported')
          ];

      const name = listingName || data.title || data.name || data.t || 'Untitled Diagram';

      const mergedData: DiagramData = {
        ...data,
        title: name,
        icons: finalIcons,
        colors: data.colors?.length ? data.colors : defaultColors,
        items: Array.isArray(data.items) ? data.items : [],
        views: Array.isArray(data.views) ? data.views : [],
        fitToScreen: data.fitToScreen !== false
      };
      const newDiagram = {
        id,
        name,
        data: mergedData,
        createdAt: data.created || new Date().toISOString(),
        updatedAt: data.lastModified || new Date().toISOString()
      };
      setDiagramName(name);
      setCurrentDiagram(newDiagram);
      setCurrentModel(mergedData);
      setLastSaved(new Date(newDiagram.updatedAt));
      autoSave.resetStatus();
      isAfterLoadRef.current = true;
      if (!axoviewRef.current) {
        // Axoview not mounted yet (EmptyStateScreen showing) — seed initialData so it
        // mounts with the correct diagram instead of the stale frozen data.
        frozenInitialDataRef.current = mergedData;
      }
      axoviewRef.current?.load(mergedData as any);
      if (!hasDefaultIcons && storageRef.current) {
        storageRef.current.saveDiagram(id, mergedData as any).catch(() => {});
      }
    },
    [iconPackManager, autoSave.resetStatus]
  );

  // ---------------------------------------------------------------------------
  // Create blank diagram (for canvas card or file tree)
  // ---------------------------------------------------------------------------
  const handleCreateBlankDiagram = useCallback(
    async (folderId: string | null) => {
      if (!storageRef.current) return;
      try {
        const existing = await storageRef.current.listDiagrams();
        const existingNames = existing.map((d) => d.name);
        const name = sequentialName('Untitled', existingNames);
        const blankData = {
          title: name,
          name,
          icons: iconPackManager.loadedIcons,
          colors: defaultColors,
          items: [],
          views: [],
          fitToScreen: true
        };
        const id = await storageRef.current.createDiagram(blankData as any, folderId);
        setFileExplorerOpen(true);
        setFileTreeRefreshToken((n) => n + 1);
        await handleDiagramManagerLoad(id, blankData, name);
      } catch (e) {
        console.error('handleCreateBlankDiagram failed:', e);
        notificationStore.push({ severity: 'error', message: 'Failed to create diagram' });
      }
    },
    [iconPackManager.loadedIcons, handleDiagramManagerLoad]
  );

  // ---------------------------------------------------------------------------
  // Guard: check unsaved changes before navigating (session mode only)
  // ---------------------------------------------------------------------------
  const checkUnsavedBeforeNavigate = useCallback(
    (onProceed: () => void) => {
      if (serverStorageAvailable) {
        onProceed();
        return;
      }
      if (!hasUnsavedChanges) {
        onProceed();
        return;
      }
      setPendingConfirm({
        message: 'You have unsaved changes. Save before leaving?',
        onConfirm: () => { saveDiagram(); onProceed(); },
        onDiscard: onProceed
      });
    },
    [serverStorageAvailable, hasUnsavedChanges, saveDiagram]
  );

  // ---------------------------------------------------------------------------
  // New Diagram (Axoview-owned — replaces Axoview's ACTION.NEW)
  // ---------------------------------------------------------------------------
  const handleNewDiagram = useCallback(async () => {
    await autoSave.saveNow();

    setCurrentDiagram(null);
    setDiagramName('');
    setCurrentModel(null);
    setLastSaved(null);
    autoSave.resetStatus();

    setDirtyDiagramIds((prev) => setWithout(prev, '__unsaved__'));
    scratchBufferRef.current.delete('__unsaved__');

    const blankData: DiagramData = {
      title: '',
      icons: iconPackManager.loadedIcons,
      colors: defaultColors,
      items: [],
      views: [],
      fitToScreen: true
    };
    isAfterLoadRef.current = true;
    axoviewRef.current?.load(blankData as any);
  }, [autoSave.saveNow, autoSave.resetStatus, iconPackManager.loadedIcons]);

  // ---------------------------------------------------------------------------
  // Rename current diagram
  // ---------------------------------------------------------------------------
  const handleRenameCurrentDiagram = useCallback(
    async (newName: string) => {
      const trimmed = newName.trim();
      if (!trimmed || !currentDiagramRef.current) return;
      const diag = currentDiagramRef.current;
      setDiagramName(trimmed);
      setCurrentDiagram({ ...diag, name: trimmed });
      if (serverStorageAvailable && storageRef.current) {
        try {
          await storageRef.current.renameDiagram(diag.id, trimmed);
          setFileTreeRefreshToken((n) => n + 1);
        } catch {
          notificationStore.push({ severity: 'error', message: 'Rename failed' });
          setDiagramName(diag.name);
          setCurrentDiagram(diag);
        }
      }
    },
    [serverStorageAvailable]
  );

  // MQA #18: when the currently-open diagram is deleted from the file tree, the
  // canvas was left holding stale data and the next autosave tick recreated the
  // diagram (with the same scene under a new id). Reset everything synchronously:
  // cancel any pending autosave, drop the scratch buffer + dirty bit, clear the
  // active diagram reference, and load a blank scene so the empty-state condition
  // routes to the initial-load screen.
  const notifyDiagramDeletedFromTree = useCallback((id: string) => {
    if (currentDiagramRef.current?.id !== id) return;
    autoSave.resetStatus();
    scratchBufferRef.current.delete(id);
    setDirtyDiagramIds((prev) => setWithout(prev, id));
    // Null the ref synchronously so any in-flight model update dispatched between
    // here and the next render doesn't see a stale currentId and re-schedule a save.
    currentDiagramRef.current = null;
    setCurrentDiagram(null);
    setDiagramName('');
    setCurrentModel(null);
    setLastSaved(null);
    const blankData: DiagramData = {
      title: '',
      icons: iconPackManager.loadedIcons,
      colors: defaultColors,
      items: [],
      views: [],
      fitToScreen: true
    };
    isAfterLoadRef.current = true;
    axoviewRef.current?.load(blankData as any);
  }, [autoSave.resetStatus, iconPackManager.loadedIcons]);

  // Sync in-memory state (diagramName, currentDiagram, model store title) when
  // the file tree renames the currently-open diagram. Storage is already updated
  // by the caller — this only keeps the canvas breadcrumb in sync.
  const notifyDiagramRenamedFromTree = useCallback((id: string, newName: string) => {
    if (!currentDiagramRef.current || currentDiagramRef.current.id !== id) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    setDiagramName(trimmed);
    setCurrentDiagram((prev) => (prev ? { ...prev, name: trimmed } : prev));
    if (axoviewRef.current && currentModelRef.current) {
      const updatedModel = { ...currentModelRef.current, title: trimmed };
      setCurrentModel(updatedModel);
      isAfterLoadRef.current = true;
      axoviewRef.current.load(updatedModel as any, { preserveViewport: true });
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Toolbar save actions
  // ---------------------------------------------------------------------------
  const handleSaveClick = useCallback(async () => {
    if (serverStorageAvailable && storage) {
      if (currentDiagram) {
        await autoSave.saveNow();
        if (autoSave.saveStatus === 'idle') {
          try {
            const data = buildSaveData();
            await storage.saveDiagram(currentDiagram.id, data as any);
            const savedAt = new Date();
            setLastSaved(savedAt);
            notificationStore.push({ severity: 'success', message: `"${currentDiagram.name}" saved` });
          } catch {
            notificationStore.push({ severity: 'error', message: t('alert.saveFailed', 'Save failed') });
          }
        }
      }
    } else {
      if (currentDiagram) {
        saveDiagram();
      } else {
        setShowSaveDialog(true);
      }
    }
  }, [serverStorageAvailable, storage, currentDiagram, autoSave, buildSaveData, saveDiagram, t]);

  const handleOpenClick = useCallback(() => {
    if (serverStorageAvailable) {
      setShowDiagramManager(true);
    } else {
      setShowLoadDialog(true);
    }
  }, [serverStorageAvailable]);

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveClick();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        handleOpenClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveClick, handleOpenClick]);

  // ---------------------------------------------------------------------------
  // Open diagram by ID (file explorer)
  // ---------------------------------------------------------------------------
  const openDiagramById = useCallback(
    async (id: string, name: string) => {
      if (!storage) return;
      try {
        await autoSave.saveNow();

        if (!serverStorageAvailable) {
          const currentId = currentDiagramRef.current?.id ?? '__unsaved__';
          if (dirtyDiagramIdsRef.current.has(currentId) && currentModelRef.current) {
            scratchBufferRef.current.set(currentId, currentModelRef.current);
          }
        }

        const buffered = scratchBufferRef.current.get(id);
        const rawData: any = buffered ?? await storage.loadDiagram(id);
        await handleDiagramManagerLoad(id, rawData, name);
      } catch (e) {
        console.error('openDiagramById failed:', e);
        notificationStore.push({ severity: 'error', message: `Failed to open "${name}"` });
      }
    },
    [storage, serverStorageAvailable, autoSave.saveNow, handleDiagramManagerLoad]
  );

  const handlePreviewClick = useCallback(async () => {
    if (!currentDiagram || !storage) return;
    await autoSave.saveNow();
    // `fromEditor: true` tells the readonly toolbar (AppToolbar) to render
    // the "Back to editing" button. The flag rides location.state so direct
    // /display/<id> URLs (typed, shared, opened in a new tab) don't grow a
    // back button that would go somewhere the user didn't come from.
    navigate(`/display/${currentDiagram.id}`, { state: { fromEditor: true } });
  }, [currentDiagram, storage, autoSave.saveNow, navigate]);

  // ---------------------------------------------------------------------------
  // Export actions (toolbar Export popover)
  // ---------------------------------------------------------------------------
  const handleExportJSON = useCallback(() => {
    exportAsJSON(buildSaveData() as any);
  }, [buildSaveData]);

  const handleExportImage = useCallback(() => {
    axoviewRef.current?.openExportImageDialog();
  }, []);

  // "Export project" — full bundled-zip export. State lives here so the toolbar
  // popover and any other UI surface can trigger it without prop-drilling.
  const [isProjectExportOpen, setIsProjectExportOpen] = useState(false);
  const handleExportProject = useCallback(() => {
    setIsProjectExportOpen(true);
  }, []);
  const closeProjectExport = useCallback(() => {
    setIsProjectExportOpen(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Session-mode Save All
  // ---------------------------------------------------------------------------
  const saveAllDirty = useCallback(async () => {
    if (serverStorageAvailable) return;
    const allDirtyIds = Array.from(dirtyDiagramIdsRef.current);
    if (allDirtyIds.length === 0) return;

    const resolveData = (diagId: string): DiagramData | null => {
      const activeId = currentDiagramRef.current?.id ?? '__unsaved__';
      if (diagId === activeId) return currentModelRef.current;
      return scratchBufferRef.current.get(diagId) ?? null;
    };

    const clearDirty = (diagId: string) => {
      scratchBufferRef.current.delete(diagId);
      setDirtyDiagramIds((prev) => setWithout(prev, diagId));
    };

    const sessionExistingNames = diagrams.map((d) => d.name);
    const sessionUpdates: SavedDiagram[] = [];
    let savedCount = 0;
    const failedIds: string[] = [];

    const s = storageRef.current;
    for (const dirtyId of allDirtyIds) {
      const dirtyData = resolveData(dirtyId);
      if (!dirtyData) continue;
      try {
        if (dirtyId === '__unsaved__') {
          const nameCandidate = dirtyData.title || diagramNameRef.current || 'Untitled Diagram';
          const chosenName = sequentialName(nameCandidate, sessionExistingNames);
          sessionExistingNames.push(chosenName);
          const savedPayload = { ...dirtyData, title: chosenName };
          const newId = s
            ? await s.createDiagram(savedPayload as any, null)
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          const newSessionDiagram: SavedDiagram = {
            id: newId,
            name: chosenName,
            data: savedPayload,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          sessionUpdates.push(newSessionDiagram);
          if (!currentDiagramRef.current) {
            setCurrentDiagram(newSessionDiagram);
            setDiagramName(chosenName);
            setLastSaved(new Date());
          }
        } else {
          const existingEntry = diagrams.find((d) => d.id === dirtyId);
          if (existingEntry) {
            if (s) await s.saveDiagram(dirtyId, dirtyData as any);
            sessionUpdates.push({ ...existingEntry, data: dirtyData, updatedAt: new Date().toISOString() });
            if (dirtyId === currentDiagramRef.current?.id) setLastSaved(new Date());
          }
        }
        clearDirty(dirtyId);
        savedCount++;
      } catch {
        failedIds.push(dirtyId);
      }
    }

    if (sessionUpdates.length > 0) {
      setDiagrams((prev) => {
        const byId = new Map(prev.map((d) => [d.id, d]));
        for (const upd of sessionUpdates) byId.set(upd.id, upd);
        return Array.from(byId.values());
      });
    }

    setFileTreeRefreshToken((n) => n + 1);
    if (failedIds.length === 0) {
      notificationStore.push({
        severity: 'success',
        message: `${savedCount} diagram${savedCount !== 1 ? 's' : ''} saved`
      });
    } else {
      notificationStore.push({
        severity: 'warning',
        message: `${savedCount} saved, ${failedIds.length} failed`
      });
    }
  }, [diagrams, serverStorageAvailable]);

  // ---------------------------------------------------------------------------
  // Model update handler
  // ---------------------------------------------------------------------------
  const handleModelUpdated = useCallback(
    (model: any) => {
      // isoflow's model schema doesn't include `requiredPacks`, so the field
      // is dropped from `model` here. Re-attach from the in-memory ref so the
      // hint survives autosave round-trips when the icons array hasn't been
      // fully rehydrated (e.g. a pack is still loading on first open).
      const preservedRequiredPacks = (currentModelRef.current as any)?.requiredPacks;
      const updatedModel: DiagramData = {
        title: model.title || diagramNameRef.current || 'Untitled',
        icons: model.icons || [],
        colors: model.colors || defaultColors,
        items: model.items || [],
        views: model.views || [],
        fitToScreen: true,
        ...(Array.isArray(preservedRequiredPacks)
          ? { requiredPacks: preservedRequiredPacks }
          : {})
      };
      setCurrentModel(updatedModel);

      if (isAfterLoadRef.current) {
        isAfterLoadRef.current = false;
        return;
      }

      if (model.title && model.title !== diagramNameRef.current) {
        if (!currentDiagramRef.current) {
          setDiagramName(model.title);
          setCurrentDiagram(null);
          setLastSaved(null);
        }
      }

      if (isReadonlyUrl) return;

      if (serverStorageAvailable) {
        // ── Server mode ──────────────────────────────────────────────────────
        const currentId = currentDiagramRef.current?.id ?? null;
        if (currentId) {
          autoSave.scheduleSave(currentId, updatedModel);
        }
        // If no diagram open, do nothing — user must create explicitly
      } else {
        // ── Session mode ─────────────────────────────────────────────────────
        const currentId = currentDiagramRef.current?.id ?? null;
        const bufferKey = currentId ?? '__unsaved__';
        scratchBufferRef.current.set(bufferKey, updatedModel);
        if (!dirtyDiagramIdsRef.current.has(bufferKey)) {
          setDirtyDiagramIds((prev) => setWithAdd(prev, bufferKey));
        }
        // Auto-save to session storage when a diagram is open (no ID = unsaved new
        // diagram, must be explicitly saved first via Ctrl+S).
        if (currentId) {
          autoSave.scheduleSave(currentId, updatedModel);
        }
      }
    },
    [isReadonlyUrl, serverStorageAvailable, autoSave.scheduleSave]
  );

  // ---------------------------------------------------------------------------
  // Icon pack manager prop (memoised)
  // ---------------------------------------------------------------------------
  const handleTogglePack = useCallback(
    (packName: string, enabled: boolean) => {
      iconPackManager.togglePack(packName as any, enabled);
    },
    [iconPackManager.togglePack]
  );

  const iconPackManagerProp = useMemo(
    () => ({
      lazyLoadingEnabled: iconPackManager.lazyLoadingEnabled,
      onToggleLazyLoading: iconPackManager.toggleLazyLoading,
      packInfo: Object.values(iconPackManager.packInfo),
      enabledPacks: iconPackManager.enabledPacks,
      onTogglePack: handleTogglePack
    }),
    [
      iconPackManager.lazyLoadingEnabled,
      iconPackManager.toggleLazyLoading,
      iconPackManager.packInfo,
      iconPackManager.enabledPacks,
      handleTogglePack
    ]
  );

  const refreshFileTree = useCallback(
    () => setFileTreeRefreshToken((n) => n + 1),
    []
  );

  // ---------------------------------------------------------------------------
  // Context value
  // ---------------------------------------------------------------------------
  const value: DiagramLifecycleContextValue = {
    diagramName,
    setDiagramName,
    hasUnsavedChanges,
    lastSaved: serverStorageAvailable ? autoSave.lastSaved : lastSaved,
    currentDiagram,
    diagrams,
    currentModel,
    isReadonlyUrl,
    isPublicShareUrl,
    readonlyLoadFailed,
    clearReadonlyLoadFailed,
    publicShareLoadFailed,
    clearPublicShareLoadFailed,
    saveStatus: autoSave.saveStatus,
    showExportDialog,
    setShowExportDialog,
    axoviewRef,
    isAfterLoadRef,
    frozenInitialDataRef,
    toolbarPortalTarget,
    setToolbarPortalTarget,
    sidebarTogglePortalTarget,
    setSidebarTogglePortalTarget,
    handleSaveClick,
    handleOpenClick,
    handlePreviewClick,
    handleModelUpdated,
    handleExportJSON,
    handleExportImage,
    handleExportProject,
    isProjectExportOpen,
    closeProjectExport,
    handleNewDiagram,
    handleRenameCurrentDiagram,
    notifyDiagramRenamedFromTree,
    notifyDiagramDeletedFromTree,
    saveAllDirty,
    handleCreateBlankDiagram,
    checkUnsavedBeforeNavigate,
    fileExplorerOpen,
    setFileExplorerOpen,
    openDiagramById,
    fileTreeRefreshToken,
    refreshFileTree,
    dirtyDiagramIds,
    sessionWorkUnexported,
    markProjectExported,
    iconPackManagerProp
  };

  return (
    <DiagramLifecycleContext.Provider value={value}>
      {children}

      {showSaveDialog && (
        <SaveDialog
          diagramName={diagramName}
          onNameChange={setDiagramName}
          onSave={saveDiagram}
          onClose={() => setShowSaveDialog(false)}
        />
      )}

      {showLoadDialog && (
        <LoadDialog
          diagrams={diagrams}
          onLoad={(d) => loadDiagram(d, false)}
          onDelete={deleteDiagram}
          onClose={() => setShowLoadDialog(false)}
        />
      )}

      {showExportDialog && (
        <ExportSingleDiagramDialog
          onExport={exportDiagram}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {showStorageManager && (
        <LocalStorageInspector onClose={() => setShowStorageManager(false)} />
      )}

      {showDiagramManager && storage && (
        <DiagramManager
          storage={storage}
          isServerStorage={true}
          onLoadDiagram={handleDiagramManagerLoad}
          onClose={() => setShowDiagramManager(false)}
        />
      )}

      {pendingConfirm && (
        <ConfirmDialog
          open
          message={pendingConfirm.message}
          confirmLabel={pendingConfirm.onDiscard ? 'Save' : 'Confirm'}
          discardLabel="Discard"
          onConfirm={() => {
            const fn = pendingConfirm.onConfirm;
            setPendingConfirm(null);
            fn();
          }}
          onDiscard={pendingConfirm.onDiscard ? () => {
            const fn = pendingConfirm.onDiscard!;
            setPendingConfirm(null);
            fn();
          } : undefined}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </DiagramLifecycleContext.Provider>
  );
}

export const useDiagramLifecycle = () => useContext(DiagramLifecycleContext);
