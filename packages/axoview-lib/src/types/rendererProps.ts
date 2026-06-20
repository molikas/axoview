export interface RendererProps {
  showGrid?: boolean;
  backgroundColor?: string;
  expandLabels?: boolean;
  /**
   * Keep node/connector name labels readable (ADR 0015 counter-scale). Used by
   * the image export so labels rendered at a low fit-to-view zoom stay legible
   * instead of shrinking with the canvas (ADR 0025 §3).
   */
  readableLabels?: boolean;
  /**
   * Show node/connector name labels. Defaults to shown; the image export sets
   * this `false` to render a clean, label-free diagram (ADR 0025 §3). Distinct
   * from `expandLabels`, which controls rich-description expansion.
   */
  showLabels?: boolean;
}
