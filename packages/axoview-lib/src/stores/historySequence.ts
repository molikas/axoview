// D-7 dual-stack undo fix — logical-action sequence stamping.
//
// Undo/redo is two independent immer patch stacks (modelStore + sceneStore).
// A model-only action (lone-node drag, place-icon) pushes a model entry but the
// scene store's no-op branch pushes nothing, so the two stacks drift to
// different depths. Stepping them in lockstep then pops entries belonging to
// DIFFERENT logical actions (behaviour-map §4.5 — the invisible-connector
// symptom).
//
// The fix: every history entry a store's set() pushes is stamped with a
// monotonic logical-action sequence shared by BOTH stores. One logical action
// allocates ONE sequence at its boundary (a standalone set, a transaction, or a
// beginDragTransaction); whichever store(s) commit for that action stamp the
// SAME value. useHistory then undoes only the stack(s) whose top entry carries
// the highest sequence (redo: the lowest future sequence) — so one keystroke
// reverts exactly one logical action across whichever store(s) participated.
//
// The counter is module-global. Values are only ever compared between the two
// stores of one provider pair, and the counter is strictly monotonic, so the
// relative ordering within a pair is always correct even if other provider
// pairs (e.g. parallel tests) interleave allocations.

let counter = 0;

/**
 * Open a new logical action — allocate and return the next sequence. Call once
 * at each logical-action boundary; the store set()s that follow stamp their
 * entries with `currentHistorySequence()` (the value returned here).
 */
export const allocateHistorySequence = (): number => {
  counter += 1;
  return counter;
};

/**
 * The sequence of the logical action currently being stamped. Read (do not
 * allocate) so a second store committing for the same action stamps the same
 * value the first store stamped.
 */
export const currentHistorySequence = (): number => {
  return counter;
};
