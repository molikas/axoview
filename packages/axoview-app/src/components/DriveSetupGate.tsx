import { useEffect, useRef, useState } from 'react';
import { useAppStorage } from '../providers/AppStorageContext';
import { useDiagramLifecycle } from '../providers/DiagramLifecycleProvider';
import { useAuthStore } from '../stores/authStore';
import { GoogleDriveProvider } from '../services/storage/providers/GoogleDriveProvider';
import { DriveRootFolderDialog } from './DriveRootFolderDialog';
import { notificationStore } from '../stores/notificationStore';

/**
 * First-connect Google Drive root chooser (places model, 2026-07-06): probes
 * once per fresh grant — sign-in with no root marker opens the dialog.
 * Cancelling only postpones setup (the tree's Drive section shows a "Finish
 * Google Drive setup…" row that re-opens it via 'axoview-drive-setup');
 * nothing is signed out. When the root is ready — pre-existing or just
 * configured — 'axoview-drive-root-ready' unblocks the migration offer.
 */
export function DriveSetupGate() {
  const { storageManager, googleDriveConfigured } = useAppStorage();
  const { refreshFileTree, isReadonlyUrl } = useDiagramLifecycle();
  const authStatus = useAuthStore((s) => s.status);
  const [needsSetup, setNeedsSetup] = useState(false);
  const checkedThisGrantRef = useRef(false);

  const drive = storageManager?.getProvider('google-drive') as
    | GoogleDriveProvider
    | undefined;

  useEffect(() => {
    if (!googleDriveConfigured || !drive) return;
    // Reset the one-per-grant probe on auth loss FIRST — before the readonly
    // guard — so a token expiry that happens WHILE on a /display/* route still
    // re-arms the probe (mirrors MigrateSessionDialog's ordering: reset inside
    // the UNAUTH/EXPIRED branch, gate on isReadonlyUrl only afterward). If the
    // readonly guard ran first, a SESSION_EXPIRED transition on a shared link
    // would be swallowed and the create-root onboarding would never re-open
    // after returning to the editor.
    if (authStatus === 'UNAUTHENTICATED' || authStatus === 'SESSION_EXPIRED') {
      checkedThisGrantRef.current = false;
      setNeedsSetup(false);
      return;
    }
    if (authStatus !== 'AUTHENTICATED') return;
    // A recipient viewing a shared diagram at /display/* may sign in only to
    // READ it — never route them into first-run "create your Drive root folder"
    // onboarding.
    if (isReadonlyUrl) {
      setNeedsSetup(false);
      return;
    }
    if (checkedThisGrantRef.current) return;
    checkedThisGrantRef.current = true;
    let cancelled = false;
    drive
      .hasConfiguredRoot()
      .then((has) => {
        if (cancelled) return;
        if (has) {
          window.dispatchEvent(new CustomEvent('axoview-drive-root-ready'));
        } else {
          setNeedsSetup(true);
        }
      })
      .catch(() => {
        // A probe failure (e.g. token issue) surfaces on the first list op;
        // don't block with the dialog.
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, drive, googleDriveConfigured, isReadonlyUrl]);

  // The Drive section's "Finish Google Drive setup…" row re-opens the chooser.
  useEffect(() => {
    const onReopen = () => setNeedsSetup(true);
    window.addEventListener('axoview-drive-setup', onReopen);
    return () => window.removeEventListener('axoview-drive-setup', onReopen);
  }, []);

  const handleConfirm = async (name: string) => {
    if (!drive) return;
    try {
      await drive.configureRoot(name);
      window.dispatchEvent(new CustomEvent('axoview-drive-root-ready'));
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
    // Postpone, don't punish: stay signed in; the session place keeps working
    // and the Drive section offers to finish setup.
    setNeedsSetup(false);
    refreshFileTree();
  };

  return (
    <DriveRootFolderDialog
      open={needsSetup}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
