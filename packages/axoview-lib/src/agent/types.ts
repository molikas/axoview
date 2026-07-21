// Agent verb-layer shared types (ADR 0045).

import {
  Model,
  ModelItem,
  ViewItem,
  Connector
} from 'src/types';
import { Op } from './opSchemas';

// The minimal surface the verb layer needs from `useSceneActions` + the stores.
// Every mutating method here already exists on the useSceneActions return and is
// transaction-aware; `transaction()` is re-entrant, so wrapping a whole op batch
// in one call yields exactly one undo entry (ADR 0045 §2 invariant 3).
export interface SceneBridge {
  transaction: (operations: () => void) => void;
  createModelItem: (modelItem: ModelItem) => void;
  updateModelItem: (id: string, updates: Partial<ModelItem>) => void;
  createViewItem: (viewItem: ViewItem) => void;
  updateViewItem: (id: string, updates: Partial<ViewItem>) => void;
  deleteViewItem: (id: string) => void;
  createConnector: (connector: Connector) => void;
  deleteConnector: (id: string) => void;
  // Reads. getModel returns the current committed Model; getCurrentViewId the
  // active view. generateId is injected (not imported) so tests can supply a
  // deterministic id source and the layout goldens stay stable.
  getModel: () => Model;
  getCurrentViewId: () => string | undefined;
  generateId: () => string;
}

// A single op's failure (ADR 0045 §2 invariant 6). The rest of the batch still
// applies; the agent gets a precise, actionable list in one response.
export interface OpError {
  index: number;
  op?: Op['op'];
  id?: string;
  message: string;
}

// The diff-shaped result — never the full model (ADR 0045 §2 invariant 5).
export interface ApplyOpsResult {
  // Real generateId() ids created this batch (nodes + connectors), in apply order.
  created_ids: string[];
  // agent-local id -> real id, for every id introduced this batch.
  id_map: Record<string, string>;
  // Real ids of entities updated / deleted / connected this batch.
  changed: string[];
  errors: OpError[];
  counts: {
    applied: number;
    failed: number;
    created: number;
    changed: number;
  };
}
