// The curated agent surface (ADR 0045 §1) — published at
// `window.__axoview__.agent`, SEPARATE from the raw-store debug bridge (which
// stays as-is for e2e/diagnostics). Three mutation verbs + cheap reads + canvas
// navigation, all over one transaction-correct façade.
//
// This factory is a thin assembler: the heavy lifting is in applyOps / setDiagram
// / getDiagram, which take a SceneBridge and are unit-tested WITHOUT React. The
// factory adds the navigation verbs and a stable version string.
//
// NAVIGATION SCOPE (Track A): `list_canvases` / `select_canvas` operate over the
// current tab's views (pages). `open_diagram` is the AxoviewRef.load seam and is
// injected by the host (Axoview.tsx); full cross-TAB routing — the ADR 0046 §4
// most-recently-focused-tab semantics — is Track D (the MCP session bridge), not
// the verb layer.

import { Model } from 'src/types';
import { applyOps } from './applyOps';
import { setDiagram } from './setDiagram';
import { getDiagram } from './getDiagram';
import { SceneBridge, ApplyOpsResult } from './types';

// The contract version. Bumped when the op vocabulary changes — MUST move in
// lockstep with the modeling skill (C) and eval suite (F) (ADR 0045 §Consequences).
export const AGENT_CONTRACT_VERSION = '1.0.0-track-a';

export interface CanvasInfo {
  id: string;
  name: string;
  current: boolean;
}

export interface NavResult {
  ok: boolean;
  error?: string;
}

export interface AgentNavigation {
  switchView: (viewId: string) => void;
  // Track D seam — load a stored diagram by id (maps to AxoviewRef.load). Absent
  // until the transport wires it.
  loadDiagram?: (id: string) => void;
}

export interface AgentSurface {
  version: string;
  apply_ops: (ops: unknown) => ApplyOpsResult;
  set_diagram: (spec: unknown) => ApplyOpsResult;
  get_diagram: () => Model;
  list_canvases: () => CanvasInfo[];
  select_canvas: (id: string) => NavResult;
  open_diagram: (id: string) => NavResult;
}

export const createAgentSurface = (
  bridge: SceneBridge,
  nav: AgentNavigation
): AgentSurface => ({
  version: AGENT_CONTRACT_VERSION,

  apply_ops: (ops: unknown) => applyOps(ops, bridge),

  set_diagram: (spec: unknown) => setDiagram(spec, bridge),

  get_diagram: () => getDiagram(bridge),

  list_canvases: () => {
    const current = bridge.getCurrentViewId();
    return bridge.getModel().views.map((v) => ({
      id: v.id,
      name: v.name,
      current: v.id === current
    }));
  },

  select_canvas: (id: string) => {
    const exists = bridge.getModel().views.some((v) => v.id === id);
    if (!exists) return { ok: false, error: `no canvas with id ${id}` };
    nav.switchView(id);
    return { ok: true };
  },

  open_diagram: (id: string) => {
    if (!nav.loadDiagram) {
      return {
        ok: false,
        error:
          'open_diagram is wired by the MCP transport (Track D); not available in this build.'
      };
    }
    nav.loadDiagram(id);
    return { ok: true };
  }
});
