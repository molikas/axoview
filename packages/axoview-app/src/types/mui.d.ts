// MUI module augmentation mirror for the app's TS program.
//
// The `micro` Typography variant is DEFINED (styles + augmentation) in the lib:
// packages/axoview-lib/src/styles/theme.ts. That augmentation does not reach
// this package's `tsc --noEmit` program, so the variant override is mirrored
// here for type-checking only. Runtime styling always comes from the lib theme.
// If the lib variant set changes, update both sites.
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    micro: true;
  }
}

export {};
