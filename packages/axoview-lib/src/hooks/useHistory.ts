import { useCallback, useRef } from 'react';
import { useModelStore } from 'src/stores/modelStore';
import { useSceneStore } from 'src/stores/sceneStore';
import { allocateHistorySequence } from 'src/stores/historySequence';

export const useHistory = () => {
  // Track if we're in a transaction to prevent nested history saves
  const transactionInProgress = useRef(false);

  // Get store actions
  const modelActions = useModelStore((state) => {
    return state?.actions;
  });
  const sceneActions = useSceneStore((state) => {
    return state?.actions;
  });

  // Get history state
  const modelCanUndo = useModelStore((state) => {
    return state?.actions?.canUndo?.() ?? false;
  });
  const sceneCanUndo = useSceneStore((state) => {
    return state?.actions?.canUndo?.() ?? false;
  });
  const modelCanRedo = useModelStore((state) => {
    return state?.actions?.canRedo?.() ?? false;
  });
  const sceneCanRedo = useSceneStore((state) => {
    return state?.actions?.canRedo?.() ?? false;
  });

  // Derived values
  const canUndo = modelCanUndo || sceneCanUndo;
  const canRedo = modelCanRedo || sceneCanRedo;

  // Transaction wrapper - groups multiple operations into single history entry
  const transaction = useCallback(
    (operations: () => void) => {
      if (!modelActions || !sceneActions) return;

      // Prevent nested transactions
      if (transactionInProgress.current) {
        operations();
        return;
      }

      // One logical action across both stores — allocate a single shared seq
      // so its entries stamp the same value (D-7).
      allocateHistorySequence();

      // Save current state before transaction
      modelActions.saveToHistory();
      sceneActions.saveToHistory();

      // Mark transaction as in progress
      transactionInProgress.current = true;

      try {
        // Execute all operations without saving intermediate history
        operations();
      } finally {
        // Always reset transaction state
        transactionInProgress.current = false;
      }

      // Note: We don't save after transaction - the final state is already current
    },
    [modelActions, sceneActions]
  );

  // D-7: the two stacks can skew to different depths (a model-only action pushes
  // a model entry but the scene store's no-op branch pushes nothing). Stepping
  // them in lockstep then pops entries belonging to DIFFERENT logical actions
  // (the invisible-connector symptom). Each entry carries a logical-action seq
  // (historySequence.ts); one keystroke must revert exactly one logical action,
  // so undo touches only the stack(s) whose top entry carries the highest seq
  // (the most recent action), redo only those at the lowest future seq.
  //
  // The `?? 0` fallback keeps the mocked-store unit tests (which expose no
  // peek*Seq) working: when both stacks report the same seq the behaviour
  // collapses to "step every stack that can", matching the legacy contract.
  const undo = useCallback(() => {
    if (!modelActions || !sceneActions) return false;

    const modelSeq = modelActions.canUndo()
      ? modelActions.peekUndoSeq?.() ?? 0
      : null;
    const sceneSeq = sceneActions.canUndo()
      ? sceneActions.peekUndoSeq?.() ?? 0
      : null;

    if (modelSeq === null && sceneSeq === null) return false;

    const target = Math.max(
      modelSeq ?? Number.NEGATIVE_INFINITY,
      sceneSeq ?? Number.NEGATIVE_INFINITY
    );

    let undoPerformed = false;
    if (modelSeq === target) {
      undoPerformed = modelActions.undo() || undoPerformed;
    }
    if (sceneSeq === target) {
      undoPerformed = sceneActions.undo() || undoPerformed;
    }

    return undoPerformed;
  }, [modelActions, sceneActions]);

  const redo = useCallback(() => {
    if (!modelActions || !sceneActions) return false;

    const modelSeq = modelActions.canRedo()
      ? modelActions.peekRedoSeq?.() ?? 0
      : null;
    const sceneSeq = sceneActions.canRedo()
      ? sceneActions.peekRedoSeq?.() ?? 0
      : null;

    if (modelSeq === null && sceneSeq === null) return false;

    const target = Math.min(
      modelSeq ?? Number.POSITIVE_INFINITY,
      sceneSeq ?? Number.POSITIVE_INFINITY
    );

    let redoPerformed = false;
    if (modelSeq === target) {
      redoPerformed = modelActions.redo() || redoPerformed;
    }
    if (sceneSeq === target) {
      redoPerformed = sceneActions.redo() || redoPerformed;
    }

    return redoPerformed;
  }, [modelActions, sceneActions]);

  const saveToHistory = useCallback(() => {
    // Don't save during transactions
    if (transactionInProgress.current) {
      return;
    }

    if (!modelActions || !sceneActions) return;

    // One logical action across both stores — shared seq (D-7).
    allocateHistorySequence();
    modelActions.saveToHistory();
    sceneActions.saveToHistory();
  }, [modelActions, sceneActions]);

  const clearHistory = useCallback(() => {
    if (!modelActions || !sceneActions) return;

    modelActions.clearHistory();
    sceneActions.clearHistory();
  }, [modelActions, sceneActions]);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    saveToHistory,
    clearHistory,
    transaction,
    isInTransaction: () => {
      return transactionInProgress.current;
    }
  };
};
