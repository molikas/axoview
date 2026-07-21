// get_diagram — the cheap read (ADR 0045 §2 invariant 4). Returns the current
// diagram as a compact JSON object so the agent reads state as free context.
//
// E1 (2026-07-21): a diagram read used to carry the entire icon catalog inline —
// including a base64-encoded SVG `data:` URI for every one of ~37 icons — which is
// hugely token-expensive for an LLM and the same payload for both get_diagram and
// the MCP resource. The agent needs each node's *kind* (icon id/name), NOT the SVG
// bytes. So by default we PROJECT the icons array to `{ id, name, collection?,
// isIsometric? }`, dropping the base64 `url`. This also makes the full set of valid
// `kind` values discoverable cheaply from any read (the model carries the merged
// catalog). `icons: 'full'` restores byte-for-byte (still stripping default-icon
// duplicates via leanSave, per ADR 0003).

import { Model } from 'src/types';
import { stripDefaultIcons } from 'src/utils/leanSave';
import { SceneBridge } from './types';

export interface GetDiagramOptions {
  // 'names' (default) → id + name + light metadata, no base64. 'none' → drop the
  // icons array entirely. 'full' → the lean-saved model with real icon urls.
  icons?: 'names' | 'none' | 'full';
}

export const getDiagram = (
  bridge: SceneBridge,
  opts: GetDiagramOptions = {}
): Model => {
  const model = bridge.getModel();
  const mode = opts.icons ?? 'names';

  if (mode === 'full') return stripDefaultIcons(model);

  const icons =
    mode === 'none'
      ? []
      : (model.icons ?? []).map((i) => ({
          id: i.id,
          name: i.name,
          // Drop the base64 SVG `url` (the token hog); keep cheap metadata.
          url: '',
          ...(i.collection !== undefined ? { collection: i.collection } : {}),
          ...(i.isIsometric !== undefined ? { isIsometric: i.isIsometric } : {})
        }));

  return { ...model, icons };
};
