// Thin localStorage wrapper for user preferences.
// Errors are silently swallowed so a corrupt/missing entry never crashes the editor.

import type { ZoomSettings, LabelSettings } from 'src/types/settings';
import type { CanvasMode, ConnectorInteractionMode } from 'src/types/ui';

const STORAGE_KEY = 'axoview_user_settings';

// NOTE: a previously-persisted `panSettings` / `hotkeyProfile` key may still
// exist in a returning user's localStorage — it is simply ignored on load now
// (ADR 0022 §6), no migration needed.
export interface PersistedSettings {
  zoomSettings?: ZoomSettings;
  labelSettings?: LabelSettings;
  connectorInteractionMode?: ConnectorInteractionMode;
  expandLabels?: boolean;
  readableLabels?: boolean;
  canvasMode?: CanvasMode;
}

export const loadPersistedSettings = (): PersistedSettings | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedSettings) : null;
  } catch {
    return null;
  }
};

export const savePersistedSettings = (settings: PersistedSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage may be unavailable (SSR, private browsing quota exceeded, etc.)
  }
};
