import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DiagramMeta, StorageProvider } from '../services/storage';
import { ConfirmDialog } from './ConfirmDialog';
import { shareUrlFromUuid } from '../utils/shareUrl';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import './DiagramManager.css';

interface Props {
  storage: StorageProvider;
  isServerStorage: boolean;
  onLoadDiagram: (id: string, data: unknown, listingName: string) => void;
  onClose: () => void;
}

export const DiagramManager: React.FC<Props> = ({
  storage,
  isServerStorage,
  onLoadDiagram,
  onClose
}) => {
  const { t } = useTranslation('app');
  const { notifyDiagramDeletedFromTree } = useDiagramLifecycle();
  const [diagrams, setDiagrams] = useState<DiagramMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    loadDiagrams();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: load the diagram list once
  }, []);

  const loadDiagrams = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await storage.listDiagrams();
      setDiagrams(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('dialog.diagramManager.failedLoad')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (id: string, listingName: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await storage.loadDiagram(id);
      onLoadDiagram(id, data, listingName);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('dialog.diagramManager.failedLoadDiagram')
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    setPendingDelete({ id, name });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    try {
      // MQA #18: reset the canvas if this is the open diagram BEFORE the storage
      // delete, so any pending autosave is canceled and can't resurrect it.
      notifyDiagramDeletedFromTree(id);
      await storage.deleteDiagram(id);
      await loadDiagrams();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('dialog.diagramManager.failedDelete')
      );
    }
  };

  const handleShare = async (id: string) => {
    if (!storage.shareDiagram) {
      setError(t('dialog.diagramManager.shareUnavailable', 'Sharing is not available'));
      return;
    }
    try {
      const { uuid } = await storage.shareDiagram(id);
      const url = shareUrlFromUuid(uuid);
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('dialog.diagramManager.failedShare', 'Failed to create share link')
      );
    }
  };

  return (
    <div className="diagram-manager-overlay">
      <div className="diagram-manager">
        <div className="diagram-manager-header">
          <h2>{t('dialog.diagramManager.title')}</h2>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="storage-info">
          <span
            className={`storage-badge ${isServerStorage ? 'server' : 'local'}`}
          >
            {isServerStorage
              ? t('dialog.diagramManager.serverStorage')
              : t('dialog.diagramManager.localStorageBadge')}
          </span>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading">{t('dialog.diagramManager.loading')}</div>
        ) : (
          <div className="diagram-list">
            {diagrams.length === 0 ? (
              <div className="empty-state">
                <p>{t('dialog.diagramManager.noSaved')}</p>
                <p className="hint">{t('dialog.diagramManager.noSavedHint')}</p>
              </div>
            ) : (
              diagrams.map((diagram) => (
                <div key={diagram.id} className="diagram-item">
                  <div className="diagram-info">
                    <h3>{diagram.name}</h3>
                    <span className="diagram-meta">
                      {t('dialog.diagramManager.lastModified')}:{' '}
                      {new Date(diagram.lastModified).toLocaleString()}
                    </span>
                  </div>
                  <div className="diagram-actions">
                    <button
                      className="action-button primary"
                      onClick={() => handleLoad(diagram.id, diagram.name)}
                      disabled={loading}
                    >
                      {t('dialog.diagramManager.btnOpen')}
                    </button>
                    {isServerStorage && (
                      <button
                        className={`action-button share${copiedId === diagram.id ? ' copied' : ''}`}
                        onClick={() => handleShare(diagram.id)}
                        title={t('dialog.diagramManager.copyShareLink')}
                      >
                        {copiedId === diagram.id ? '✓' : '🔗'}
                      </button>
                    )}
                    <button
                      className="action-button danger"
                      onClick={() => handleDelete(diagram.id, diagram.name)}
                      disabled={loading}
                    >
                      {t('dialog.diagramManager.btnDelete')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          open
          message={t('dialog.diagramManager.deleteConfirm', { name: pendingDelete.name })}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
};
