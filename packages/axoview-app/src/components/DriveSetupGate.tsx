import { useEffect, useState } from 'react';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { GoogleDriveProvider } from '../services/storage/providers/GoogleDriveProvider';
import { DriveRootFolderDialog } from './DriveRootFolderDialog';
import { notificationStore } from '../stores/notificationStore';

/**
 * Watches for Google Drive becoming the active provider without a configured
 * root folder, and shows the first-connect chooser. Decoupled from the provider
 * switch itself so the switch stays synchronous.
 */
export function DriveSetupGate() {
  const { activeProviderId, storageManager, setActiveProviderId } = useAppStorage();
  const { refreshFileTree } = useDiagramLifecycle();
  const [needsSetup, setNeedsSetup] = useState(false);

  const drive = storageManager?.getProvider('google-drive') as
    | GoogleDriveProvider
    | undefined;

  useEffect(() => {
    if (activeProviderId !== 'google-drive' || !drive) {
      setNeedsSetup(false);
      return;
    }
    let cancelled = false;
    drive
      .hasConfiguredRoot()
      .then((has) => {
        if (!cancelled) setNeedsSetup(!has);
      })
      .catch(() => {
        // A probe failure (e.g. token issue) surfaces on the first list op;
        // don't block with the dialog.
      });
    return () => {
      cancelled = true;
    };
  }, [activeProviderId, drive]);

  const handleConfirm = async (name: string) => {
    if (!drive) return;
    try {
      await drive.configureRoot(name);
      refreshFileTree();
    } catch {
      notificationStore.push({
        severity: 'error',
        message: 'Could not set up the Google Drive folder. Try again.'
      });
    } finally {
      setNeedsSetup(false);
    }
  };

  const handleCancel = () => {
    setNeedsSetup(false);
    setActiveProviderId('local');
  };

  return (
    <DriveRootFolderDialog
      open={needsSetup}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
