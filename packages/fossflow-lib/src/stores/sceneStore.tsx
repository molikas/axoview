import React, { createContext, useRef, useContext } from 'react';
import { createStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { enablePatches, produceWithPatches, applyPatches, Patch } from 'immer';
import { SceneStore, Scene } from 'src/types';

// enablePatches() is idempotent — safe to call in multiple modules.
enablePatches();

type HistoryEntry = { patches: Patch[]; inversePatches: Patch[] };

export interface SceneHistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];
  maxHistorySize: number;
}

export interface SceneStoreWithHistory extends Omit<SceneStore, 'actions'> {
  history: SceneHistoryState;
  actions: {
    get: () => SceneStoreWithHistory;
    set: (scene: Partial<Scene>, skipHistory?: boolean) => void;
    undo: () => boolean;
    redo: () => boolean;
    canUndo: () => boolean;
    canRedo: () => boolean;
    saveToHistory: () => void;
    clearHistory: () => void;
    freezePendingPre: () => void;
    unfreezePendingPre: () => void;
  };
}

const MAX_HISTORY_SIZE = 50;

const createSceneHistoryState = (): SceneHistoryState => ({
  past: [],
  future: [],
  maxHistorySize: MAX_HISTORY_SIZE
});

const extractSceneData = (state: SceneStoreWithHistory): Scene => ({
  connectors: state.connectors,
  textBoxes: state.textBoxes
});

const initialState = () => {
  return createStore<SceneStoreWithHistory>((set, get) => {
    const initialScene: Scene = { connectors: {}, textBoxes: {} };

    let pendingPre: Scene | null = null;

    // While true, set() will not consume pendingPre — see modelStore.tsx for why.
    let pendingPreFrozen = false;

    const saveToHistory = () => {
      pendingPre = extractSceneData(get());
    };

    // MQA #5 (Bundle B follow-up #3): scene store's undo/redo previously
    // recomputed entry patches via `produceWithPatches(current, draft =>
    // Object.assign(draft, applyPatches(current, entry.inversePatches)))`,
    // which yielded patches in the WRONG direction (B → A, not A → B).
    // Pushing those backwards-patches to future meant `redo` applied
    // undo-direction patches to an already-undone state — a no-op. Model
    // store stayed correct, so model.redo restored the connector to
    // `views[].connectors` but scene.redo never re-populated
    // `scene.connectors[id]`, leaving the connector with no path → invisible.
    // The redo also consumed the future entry, disabling the redo button.
    // Mirror the model store: push the ORIGINAL entry to future on undo,
    // pop it back on redo. entry.patches always travel pre → post.
    const undo = (): boolean => {
      const { history } = get();
      if (history.past.length === 0) return false;

      const entry = history.past[history.past.length - 1];
      const newPast = history.past.slice(0, history.past.length - 1);

      set((state) => {
        const currentScene = extractSceneData(state);
        const previousScene = applyPatches(currentScene, entry.inversePatches);
        return {
          ...previousScene,
          history: {
            ...state.history,
            past: newPast,
            future: [entry, ...state.history.future]
          }
        };
      });

      // eslint-disable-next-line no-console
      console.debug(
        '[history.scene.undo] past=%d future=%d',
        get().history.past.length,
        get().history.future.length,
      );

      return true;
    };

    const redo = (): boolean => {
      const { history } = get();
      if (history.future.length === 0) return false;

      const entry = history.future[0];
      const newFuture = history.future.slice(1);

      set((state) => {
        const currentScene = extractSceneData(state);
        const nextScene = applyPatches(currentScene, entry.patches);
        return {
          ...nextScene,
          history: {
            ...state.history,
            past: [...state.history.past, entry],
            future: newFuture
          }
        };
      });

      return true;
    };

    const canUndo = () => get().history.past.length > 0;
    const canRedo = () => get().history.future.length > 0;

    const clearHistory = () => {
      pendingPre = null;
      pendingPreFrozen = false;
      set((state) => ({ ...state, history: createSceneHistoryState() }));
    };

    const freezePendingPre = () => {
      pendingPreFrozen = true;
    };

    const unfreezePendingPre = () => {
      pendingPreFrozen = false;
    };

    return {
      ...initialScene,
      history: createSceneHistoryState(),
      actions: {
        get,
        set: (updates: Partial<Scene>, skipHistory = false) => {
          if (!skipHistory) {
            saveToHistory();
          }

          if (pendingPre !== null && !pendingPreFrozen) {
            const pre = pendingPre;
            pendingPre = null;
            set((state) => {
              const next: Scene = { ...extractSceneData(state), ...updates };
              const [, patches, inversePatches] = produceWithPatches(
                pre,
                (draft: Scene) => {
                  Object.assign(draft, next);
                }
              );

              // MQA #5: see modelStore. A no-op set() must not clobber `future`,
              // otherwise undo+undo+redo+redo loses the trailing action whenever
              // a transient inter-redo write produced no real change.
              if (patches.length === 0) {
                return { ...state, ...next };
              }

              const newPast = [
                ...state.history.past,
                { patches, inversePatches }
              ];
              if (newPast.length > state.history.maxHistorySize)
                newPast.shift();

              // MQA #5 diagnostic — see modelStore counterpart. Log every scene
              // write that wipes a non-empty future stack so we can identify
              // the stray write that's eating redo state.
              if (state.history.future.length > 0) {
                // eslint-disable-next-line no-console
                console.warn(
                  '[history.scene.set] clearing future (%d entries) — patches: %s skipHistory=%s',
                  state.history.future.length,
                  patches.map((p) => `${p.op} ${p.path.join('.')}`).join(', '),
                  skipHistory,
                );
                // eslint-disable-next-line no-console
                console.trace('[history.scene.set] caller stack');
              }

              return {
                ...state,
                ...next,
                history: {
                  ...state.history,
                  past: newPast,
                  future: []
                }
              };
            });
          } else {
            set((state) => ({ ...state, ...updates }));
          }
        },
        undo,
        redo,
        canUndo,
        canRedo,
        saveToHistory,
        clearHistory,
        freezePendingPre,
        unfreezePendingPre
      }
    };
  });
};

const SceneContext = createContext<ReturnType<typeof initialState> | null>(
  null
);

interface ProviderProps {
  children: React.ReactNode;
}

export const SceneProvider = ({ children }: ProviderProps) => {
  const storeRef = useRef<ReturnType<typeof initialState> | undefined>(
    undefined
  );

  if (!storeRef.current) {
    storeRef.current = initialState();
  }

  return (
    <SceneContext.Provider value={storeRef.current}>
      {children}
    </SceneContext.Provider>
  );
};

export function useSceneStore<T>(
  selector: (state: SceneStoreWithHistory) => T,
  equalityFn?: (left: T, right: T) => boolean
) {
  const store = useContext(SceneContext);
  if (store === null) throw new Error('Missing provider in the tree');
  return useStoreWithEqualityFn(store, selector, equalityFn);
}

export function useSceneStoreApi() {
  const store = useContext(SceneContext);
  if (store === null) throw new Error('Missing provider in the tree');
  return store;
}
