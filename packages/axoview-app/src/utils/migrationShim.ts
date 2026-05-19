// One-shot migration of pre-rename localStorage / sessionStorage keys.
//
// Before the FossFLOW → Axoview rename, persisted browser state used the
// "fossflow_" / "fossflow-" prefix. New code reads/writes "axoview_" /
// "axoview-". Without this shim, every existing user would appear to lose
// their diagrams on first launch after upgrade.
//
// Idempotent: runs at most once per browser profile, gated by the sentinel
// localStorage key MIGRATION_SENTINEL_KEY.

const MIGRATION_SENTINEL_KEY = 'axoview_migration_v1';
const MIGRATION_SENTINEL_VALUE = 'done';

const renamePrefix = (oldKey: string): string | null => {
  if (oldKey.startsWith('fossflow_')) return 'axoview_' + oldKey.slice('fossflow_'.length);
  if (oldKey.startsWith('fossflow-')) return 'axoview-' + oldKey.slice('fossflow-'.length);
  return null;
};

const migrateStorage = (storage: Storage): number => {
  let migrated = 0;
  const oldKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k && (k.startsWith('fossflow_') || k.startsWith('fossflow-'))) {
      oldKeys.push(k);
    }
  }
  for (const oldKey of oldKeys) {
    const newKey = renamePrefix(oldKey);
    if (!newKey) continue;
    const value = storage.getItem(oldKey);
    if (value !== null && storage.getItem(newKey) === null) {
      storage.setItem(newKey, value);
      migrated++;
    }
    storage.removeItem(oldKey);
  }
  return migrated;
};

export interface MigrationResult {
  ran: boolean;
  localMigrated: number;
  sessionMigrated: number;
}

export const migrateFossflowStorageKeys = (): MigrationResult => {
  if (typeof window === 'undefined') {
    return { ran: false, localMigrated: 0, sessionMigrated: 0 };
  }

  try {
    if (localStorage.getItem(MIGRATION_SENTINEL_KEY) === MIGRATION_SENTINEL_VALUE) {
      return { ran: false, localMigrated: 0, sessionMigrated: 0 };
    }
  } catch {
    // localStorage unavailable (private browsing, blocked) — nothing we can do
    return { ran: false, localMigrated: 0, sessionMigrated: 0 };
  }

  let localMigrated = 0;
  let sessionMigrated = 0;

  try {
    localMigrated = migrateStorage(localStorage);
  } catch {
    // skip — best effort
  }
  try {
    sessionMigrated = migrateStorage(sessionStorage);
  } catch {
    // skip — best effort
  }

  try {
    localStorage.setItem(MIGRATION_SENTINEL_KEY, MIGRATION_SENTINEL_VALUE);
  } catch {
    // can't set sentinel; migration will retry next boot (idempotent)
  }

  return { ran: true, localMigrated, sessionMigrated };
};
