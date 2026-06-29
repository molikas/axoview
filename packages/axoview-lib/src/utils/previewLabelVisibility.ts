// Present-mode (EXPLORABLE_READONLY) label visibility merge (ADR 0013,
// 2026-06-18 addendum).
//
// The single merge point both name-label render sites (Node, ConnectorLabel)
// consult so the present-mode "hide labels" toggle has one documented precedence.
// It is a UI-only flag (uiState.previewHideLabels) that hides node + connector
// *name* labels while presenting, without ever mutating the model's per-item
// `showLabel` — so presenting can't dirty or save the diagram. Precedence:
//   1. In EXPLORABLE_READONLY with hide-labels on, the name label is forced
//      hidden, regardless of the model's `showLabel`.
//   2. Otherwise the model's `showLabel` is authoritative (EDITABLE unchanged).
// Mirrors isEntityVisibleInPreview at label granularity and composes with the
// per-layer override through the same ephemeral, never-persisted uiState slice.

/**
 * Whether a name label is visible under the UI-only hide-labels override.
 *
 * The hide-labels toggle is now GLOBAL (bottom-dock zoom cluster, both editing
 * and presentation) rather than presentation-only — so the flag forces labels
 * hidden in any mode, without ever mutating the model's per-item `showLabel`.
 * `inPreview` is retained in the signature for call-site compatibility but no
 * longer gates the override.
 * @param baseShowLabel  model truth: `showLabel !== false` for the item
 * @param _inPreview     editorMode === 'EXPLORABLE_READONLY' (no longer gating)
 * @param hideLabels     the UI-only hide-labels flag
 */
export const isLabelVisibleInPreview = (
  baseShowLabel: boolean,
  _inPreview: boolean,
  hideLabels: boolean
): boolean => {
  if (hideLabels) return false;
  return baseShowLabel;
};
