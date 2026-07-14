// The faint isometric grid backdrop shared by the empty-canvas surfaces
// (EmptyStateScreen and the Drive display gate), so a signed-out/gate screen
// reads as the app's own empty canvas rather than a bare error page. Kept in
// one place so the two never drift.
export const isoGridBackground = {
  backgroundImage: [
    'repeating-linear-gradient(30deg,  rgba(128,128,128,0.13) 0, rgba(128,128,128,0.13) 1px, transparent 0, transparent 28px)',
    'repeating-linear-gradient(150deg, rgba(128,128,128,0.13) 0, rgba(128,128,128,0.13) 1px, transparent 0, transparent 28px)'
  ].join(', ')
} as const;
