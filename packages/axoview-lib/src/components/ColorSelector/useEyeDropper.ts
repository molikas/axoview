// Shared access to the browser EyeDropper API (the async "pick a colour from
// anywhere on screen" tool). Chromium-only, so callers gate the affordance on
// `hasEyeDropper()` and hide it where unsupported. Extracted from
// CustomColorInput so the unified picker (ADR 0039) can host the eyedropper at
// the top level while the embedded hue/sat input suppresses its own copy.

interface EyeDropperInstance {
  open: (options?: { signal?: AbortSignal }) => Promise<{ sRGBHex: string }>;
}

declare global {
  interface Window {
    EyeDropper?: {
      new (): EyeDropperInstance;
    };
  }
}

export const hasEyeDropper = (): boolean =>
  typeof window !== 'undefined' && !!window.EyeDropper;

// Resolves to the picked sRGB hex, or null when unsupported OR the user cancels
// (Esc rejects `open()` — a cancellation, not a failure per ADR 0011).
export const openEyeDropper = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !window.EyeDropper) return null;
  try {
    const result = await new window.EyeDropper().open();
    return result.sRGBHex;
  } catch {
    return null;
  }
};
