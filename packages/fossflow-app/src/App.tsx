import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Isoflow, allLocales, type MainMenuOptions } from 'fossflow';
import { AppStorageProvider, useAppStorage } from './providers/AppStorageContext';
import {
  DiagramLifecycleProvider,
  useDiagramLifecycle
} from './providers/DiagramLifecycleProvider';
import { FileExplorerLayout } from './layout/FileExplorerLayout';
import { FileExplorer } from './components/fileExplorer/FileExplorer';
import { AppToolbar } from './components/AppToolbar';
import { EmptyStateScreen } from './components/EmptyStateScreen';
import { DiagnosticsOverlay } from './components/DiagnosticsOverlay';
import { DiagnosticsToggleButton } from './components/DiagnosticsToggleButton';
import { NotificationStack } from './components/NotificationStack';
import { SessionModeBanner } from './components/SessionModeBanner';
import { ExportDialog } from './components/fileExplorer/ExportDialog';
import { ImportDialog } from './components/fileExplorer/ImportDialog';
import { parseProject, importProject } from './services/project/projectZip';
import { notificationStore } from './stores/notificationStore';
import ChangeLanguage from './components/ChangeLanguage';
import { downloadSessionDump } from './utils/sessionDump';
import './App.css';

const publicUrl = process.env.PUBLIC_URL || '';
const basename = publicUrl
  ? publicUrl.endsWith('/')
    ? publicUrl.slice(0, -1)
    : publicUrl
  : '/';

// Burger removed per ADR 0005 — app stops using mainMenuOptions so MainMenu short-circuits.
const MAIN_MENU_OPTIONS: MainMenuOptions = [];

const EXPORTER_TAG = `fossflow-app@${process.env.REACT_APP_VERSION ?? 'dev'}`;

function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/" element={<EditorPage />} />
        <Route path="/display/p/:shareUuid" element={<EditorPage />} />
        <Route path="/display/:readonlyDiagramId" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  );
}

function EditorPage() {
  return (
    <AppStorageProvider>
      <DiagramLifecycleProvider>
        <EditorShell />
      </DiagramLifecycleProvider>
    </AppStorageProvider>
  );
}

function EditorShell() {
  const { i18n } = useTranslation('app');
  const { storage, serverStorageAvailable, isInitialized } = useAppStorage();
  const {
    isoflowRef,
    frozenInitialDataRef,
    iconPackManagerProp,
    handleModelUpdated,
    handleCreateBlankDiagram,
    sidebarTogglePortalTarget,
    isReadonlyUrl,
    currentDiagram,
    fileTreeRefreshToken,
    refreshFileTree,
    openDiagramById,
    fileExplorerOpen,
    setFileExplorerOpen,
    markProjectExported,
    isProjectExportOpen,
    closeProjectExport
  } = useDiagramLifecycle();

  const [linkedDiagrams, setLinkedDiagrams] = useState<Array<{ id: string; name: string }>>([]);
  const [treeIsEmpty, setTreeIsEmpty] = useState(true);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!storage || !isInitialized) return;
    // Re-fetch whenever the file tree refreshes (diagram created/deleted/renamed)
    // or when the current diagram changes (covers session-mode saves).
    Promise.all([
      storage.listDiagrams(),
      storage.listFolders()
    ]).then(([diagrams, folders]) => {
      setLinkedDiagrams(diagrams.map((d) => ({ id: d.id, name: d.name })));
      setTreeIsEmpty(diagrams.length === 0 && folders.length === 0);
    }).catch(() => {});
  }, [storage, isInitialized, fileTreeRefreshToken, currentDiagram]);

  const handleDirectImportFile = useCallback(async (file: File) => {
    if (!storage) return;
    try {
      const isZip = /\.zip$/i.test(file.name);
      if (isZip) {
        const parsed = await parseProject(file);
        await importProject({ storage }, parsed, { destination: { kind: 'root' } });
        refreshFileTree();
        setFileExplorerOpen(true);
        const dc = parsed.manifest.diagrams.length;
        const fc = parsed.manifest.folders.length;
        const parts = [`${dc} diagram${dc !== 1 ? 's' : ''}`];
        if (fc > 0) parts.push(`${fc} folder${fc !== 1 ? 's' : ''}`);
        notificationStore.push({ severity: 'success', message: `Imported ${parts.join(' across ')} at the top level` });
      } else {
        const text = await file.text();
        let data: unknown;
        try { data = JSON.parse(text); } catch {
          throw new Error('That file is not valid JSON.');
        }
        const embedded = (data as any)?.title || (data as any)?.name || (data as any)?.t || '';
        const fileBase = file.name.replace(/\.(?:compact\.)?json$/i, '');
        const name = typeof embedded === 'string' && embedded.trim() ? embedded.trim() : fileBase;
        const newId = await storage.createDiagram({ ...(data as object), name, title: name }, null);
        refreshFileTree();
        setFileExplorerOpen(true);
        notificationStore.push({ severity: 'success', message: `Imported diagram "${name}"` });
        await openDiagramById(newId, name);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      notificationStore.push({ severity: 'error', message: msg });
    }
  }, [storage, refreshFileTree, openDiagramById, setFileExplorerOpen]);

  const handleImportClick = useCallback(() => {
    if (treeIsEmpty) {
      importFileInputRef.current?.click();
    } else {
      setShowImportDialog(true);
    }
  }, [treeIsEmpty]);

  const currentLocale =
    allLocales[i18n.language as keyof typeof allLocales] || allLocales['en-US'];

  // Don't render canvas until storage init completes — prevents onboarding hints from
  // briefly appearing before EmptyStateScreen takes over.
  if (!isInitialized) return null;

  const showSessionBanner =
    !serverStorageAvailable && !isReadonlyUrl && linkedDiagrams.length > 0;

  return (
    <div className="App">
      <AppToolbar />

      {showSessionBanner && <SessionModeBanner />}

      <FileExplorerLayout>
        <div className="fossflow-container" style={{ position: 'relative' }}>
          <Isoflow
            ref={isoflowRef}
            initialData={frozenInitialDataRef.current}
            onModelUpdated={handleModelUpdated}
            editorMode={isReadonlyUrl ? 'EXPLORABLE_READONLY' : 'EDITABLE'}
            locale={currentLocale}
            iconPackManager={iconPackManagerProp}
            linkedDiagrams={linkedDiagrams}
            sidebarTogglePortalTarget={sidebarTogglePortalTarget}
            languageSelector={<ChangeLanguage />}
            bottomDockEnd={<DiagnosticsToggleButton />}
            suppressOnboardingHints={!!currentDiagram || isReadonlyUrl}
            mainMenuOptions={MAIN_MENU_OPTIONS}
            fileExplorerOpen={fileExplorerOpen}
            onFileExplorerToggle={() => setFileExplorerOpen(!fileExplorerOpen)}
            disableLeftDockWorkingTabs={!currentDiagram}
            onSessionDump={downloadSessionDump}
          />
          {/* File Explorer overlay — sits to the right of the LeftDock strip,
              never pushes the canvas. z=15 places it above the canvas/empty
              state but below the strip (z=20) and BottomDock (z=20). */}
          {!isReadonlyUrl && fileExplorerOpen && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 40,
                left: 40,
                width: 280,
                zIndex: 15,
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--mui-palette-background-paper, #fff)',
                borderRight: '1px solid rgba(0,0,0,0.12)',
                boxShadow: '0 0 8px rgba(0,0,0,0.08)',
                overflow: 'hidden'
              }}
            >
              <FileExplorer />
            </div>
          )}
          {!currentDiagram && !isReadonlyUrl && (
            // Confined to the canvas area only — leaves left strip (40px) and
            // bottom dock (40px) visually uncovered, which sidesteps the
            // stacking-context trap created by Isoflow's translateZ(0).
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 40,
                right: 0,
                bottom: 40,
                zIndex: 5
              }}
            >
              <EmptyStateScreen
                onCreate={() => handleCreateBlankDiagram(null)}
                onImport={handleImportClick}
              />
            </div>
          )}
        </div>
      </FileExplorerLayout>

      {/* Hidden file input for empty-tree direct import */}
      <input
        ref={importFileInputRef}
        type="file"
        accept=".zip,.json,application/zip,application/json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleDirectImportFile(f);
          e.target.value = '';
        }}
      />

      {/* Import dialog for non-empty tree */}
      {showImportDialog && storage && (
        <ImportDialog
          open
          onClose={() => setShowImportDialog(false)}
          storage={storage}
          onImported={async () => {
            refreshFileTree();
            setFileExplorerOpen(true);
            notificationStore.push({ severity: 'success', message: 'Import complete' });
          }}
          onImportSingleJson={async (data, suggestedName) => {
            const newId = await storage.createDiagram(
              { ...(data as object), name: suggestedName, title: suggestedName },
              null
            );
            refreshFileTree();
            await openDiagramById(newId, suggestedName);
          }}
        />
      )}

      {storage && (
        <ExportDialog
          open={isProjectExportOpen}
          onClose={closeProjectExport}
          scope="project"
          storage={storage}
          exporterTag={EXPORTER_TAG}
          onProjectZipExported={() => markProjectExported?.()}
        />
      )}

      <DiagnosticsOverlay />
      <NotificationStack />
    </div>
  );
}

export default App;
