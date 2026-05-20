import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { StorageProvider } from '../services/storage/types';
import { StorageManager } from '../services/storage/StorageManager';
import { LocalStorageProvider } from '../services/storage/providers/LocalStorageProvider';
import { fetchRuntimeConfig, RuntimeConfig } from '../hooks/useRuntimeConfig';

interface AppStorageContextValue {
  storage: StorageProvider | null;
  storageManager: StorageManager | null;
  isServerStorage: boolean;
  isInitialized: boolean;
  serverStorageAvailable: boolean;
  runtimeConfig: RuntimeConfig | null;
}

const AppStorageContext = createContext<AppStorageContextValue>({
  storage: null,
  storageManager: null,
  isServerStorage: false,
  isInitialized: false,
  serverStorageAvailable: false,
  runtimeConfig: null
});

// Singleton — created once outside the component so it survives re-renders.
const manager = new StorageManager();
manager.registerProvider(new LocalStorageProvider());
manager.setActiveProvider('local');

export function AppStorageProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isServerStorage, setIsServerStorage] = useState(false);
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(null);
  const initStarted = useRef(false);

  useEffect(() => {
    if (initStarted.current) return;
    initStarted.current = true;

    (async () => {
      // ADR 0009 D2: single /api/config probe. The serverStorage boolean in
      // that response is the canonical mode signal — no second probe to
      // /api/storage/status. fetchRuntimeConfig itself swallows network
      // errors and warns; on failure its result is DEFAULT_CONFIG (serverStorage:
      // false), which is exactly the Local-mode fallback the ADR specifies.
      const config = await fetchRuntimeConfig();
      manager.setServerStorage(config.serverStorage);
      setRuntimeConfig(config);
      setIsServerStorage(manager.serverStorageAvailable);
      setIsInitialized(true);
    })();
  }, []);

  const serverStorageAvailable = isServerStorage && isInitialized;

  return (
    <AppStorageContext.Provider
      value={{
        storage: manager,
        storageManager: manager,
        isServerStorage,
        isInitialized,
        serverStorageAvailable,
        runtimeConfig
      }}
    >
      {children}
    </AppStorageContext.Provider>
  );
}

export const useAppStorage = () => useContext(AppStorageContext);
