// Utility functions for handling diagram data
import type { Icon, Colors, ModelItem, View } from 'axoview';

export interface DiagramData {
  title: string;
  version?: string;
  description?: string;
  icons: Icon[];
  colors: Colors;
  items: ModelItem[];
  views: View[];
  fitToScreen?: boolean;
  /**
   * Companion to ADR 0003 lean-save: the icon-pack collections referenced
   * by `items`. Preserved in-memory so it survives a round-trip through
   * isoflow's onModelUpdated callback (which only emits schema fields) and
   * back into autosave, preventing the field from being wiped to [].
   */
  requiredPacks?: string[];
}
