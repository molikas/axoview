import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Isoflow, allLocales } from 'fossflow';
import { AppStorageProvider, useAppStorage } from './providers/AppStorageContext';
import {
  DiagramLifecycleProvider,
  useDiagramLifecycle
} from './providers/DiagramLifecycleProvider';
import { FileExplorerLayout } from './layout/FileExplorerLayout';
import { AppToolbar } from './components/AppToolbar';
import { EmptyStateScreen } from './components/EmptyStateScreen';
import { DiagnosticsOverlay } from './components/DiagnosticsOverlay';
import { DiagnosticsToggleButton } from './components/DiagnosticsToggleButton';
import { NotificationStack } from './components/NotificationStack';
import { SessionModeBanner } from './components/SessionModeBanner';
import { ExportDialog } from './components/fileExplorer/ExportDialog';
import ChangeLanguage from './components/ChangeLanguage';
import './App.css';

const publicUrl = process.env.PUBLIC_URL || '';
const basename = publicUrl
  ? publicUrl.endsWith('/')
    ? publicUrl.slice(0, -1)
    : publicUrl
  : '/';

// Stable reference — prevents Isoflow's useEffect([mainMenuOptions]) from firing on
// every EditorShell re-render (which would call setEditorMode and reset the tool mode).
const MAIN_MENU_OPTIONS = ['LINK.GITHUB', 'VERSION'] as const;

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
    toolbarPortalTarget,
    sidebarTogglePortalTarget,
    isReadonlyUrl,
    currentDiagram,
    fileTreeRefreshToken,
    markProjectExported
  } = useDiagramLifecycle();

  const [linkedDiagrams, setLinkedDiagrams] = useState<Array<{ id: string; name: string }>>([]);
  const [showProjectExport, setShowProjectExport] = useState(false);

  useEffect(() => {
    if (!storage || !isInitialized) return;
    // Re-fetch whenever the file tree refreshes (diagram created/deleted/renamed)
    // or when the current diagram changes (covers session-mode saves).
    storage.listDiagrams().then((list) => {
      setLinkedDiagrams(list.map((d) => ({ id: d.id, name: d.name })));
    }).catch(() => {});
  }, [storage, isInitialized, fileTreeRefreshToken, currentDiagram]);

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

      {showSessionBanner && (
        <SessionModeBanner onExportProject={() => setShowProjectExport(true)} />
      )}

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
            toolbarPortalTarget={toolbarPortalTarget}
            sidebarTogglePortalTarget={sidebarTogglePortalTarget}
            languageSelector={<ChangeLanguage />}
            bottomDockEnd={<DiagnosticsToggleButton />}
            suppressOnboardingHints={!!currentDiagram || isReadonlyUrl}
            mainMenuOptions={MAIN_MENU_OPTIONS}
          />
          {!currentDiagram && !isReadonlyUrl && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
              <EmptyStateScreen onCreate={() => handleCreateBlankDiagram(null)} />
            </div>
          )}
        </div>
      </FileExplorerLayout>

      {storage && (
        <ExportDialog
          open={showProjectExport}
          onClose={() => setShowProjectExport(false)}
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
