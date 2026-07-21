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

export interface DiagramInfo {
  id: string;
  name: string;
}

export interface NavResult {
  ok: boolean;
  error?: string;
}

// Diagram-library navigation (Feature A.4). The verb layer is canvas-only; the
// HOST app (which owns storage — session / Google Drive) injects these. Absent
// callbacks make the corresponding verb return an explicit "not available" result
// rather than failing silently.
export interface AgentNavigation {
  switchView: (viewId: string) => void;
  loadDiagram?: (id: string) => void | Promise<void>;
  listDiagrams?: () => DiagramInfo[] | Promise<DiagramInfo[]>;
  createDiagram?: (name?: string) => void | Promise<void>;
  saveDiagram?: () => void | Promise<void>;
}

export interface AgentSurface {
  version: string;
  apply_ops: (ops: unknown) => ApplyOpsResult;
  set_diagram: (spec: unknown) => ApplyOpsResult;
  get_diagram: () => Model;
  list_canvases: () => CanvasInfo[];
  select_canvas: (id: string) => NavResult;
  // Diagram-library verbs — async (storage / Drive).
  open_diagram: (id: string) => Promise<NavResult>;
  list_diagrams: () => Promise<{ diagrams: DiagramInfo[] } | { error: string }>;
  create_diagram: (name?: string) => Promise<NavResult>;
  save_diagram: () => Promise<NavResult>;
}

const NOT_WIRED = (verb: string): NavResult => ({
  ok: false,
  error: `${verb} is not available in this build (no storage host wired).`
});

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

  open_diagram: async (id: string) => {
    if (!nav.loadDiagram) return NOT_WIRED('open_diagram');
    try {
      await nav.loadDiagram(id);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  list_diagrams: async () => {
    if (!nav.listDiagrams) {
      return { error: 'list_diagrams is not available in this build.' };
    }
    try {
      const diagrams = await nav.listDiagrams();
      return { diagrams };
    } catch (e) {
      return { error: (e as Error).message };
    }
  },

  create_diagram: async (name?: string) => {
    if (!nav.createDiagram) return NOT_WIRED('create_diagram');
    try {
      await nav.createDiagram(name);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  save_diagram: async () => {
    if (!nav.saveDiagram) return NOT_WIRED('save_diagram');
    try {
      await nav.saveDiagram();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }
});
