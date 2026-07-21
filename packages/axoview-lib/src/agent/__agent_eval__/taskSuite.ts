// The versioned agent-interaction task suite (ADR 0047 §2). Each task carries a
// natural-language prompt (what a model would be given), a recorded tool-call
// transcript (the known-good calls — no model in the GATE loop), a golden
// structural Model, and a round-trip budget. Versioned WITH the op vocabulary: a
// verb change updates this suite in the same commit (the lockstep guard).
//
// The measured transcript is built from the post-setup Model so an "edit" task can
// reference existing nodes by their real id exactly as an agent would after
// reading get_diagram — realistic and not brittle to id-allocation order.

import { Model } from 'src/types';
import { EVAL_VIEW_ID, TranscriptCall } from './harness';
import { StructuralGraph } from './structuralDiff';

const idByLabel = (model: Model, label: string): string | undefined => {
  const view = model.views.find((v) => v.id === EVAL_VIEW_ID);
  if (!view) return undefined;
  const placed = new Set((view.items ?? []).map((i) => i.id));
  const mi = model.items.find(
    (m) => placed.has(m.id) && (m.label ?? m.name) === label
  );
  return mi?.id;
};

// The connector joining two labelled nodes — how an agent finds the edge to
// splice after reading get_diagram.
const connectorIdByLabels = (
  model: Model,
  labelA: string,
  labelB: string
): string | undefined => {
  const idA = idByLabel(model, labelA);
  const idB = idByLabel(model, labelB);
  const view = model.views.find((v) => v.id === EVAL_VIEW_ID);
  return (view?.connectors ?? []).find((c) => {
    const items = c.anchors.map((a) => a.ref.item);
    return items.includes(idA) && items.includes(idB);
  })?.id;
};

export interface EvalTask {
  name: string;
  prompt: string;
  // Un-measured preparation (builds the starting canvas).
  setup?: TranscriptCall[];
  // The measured calls — round-trips counted against the budget.
  build: (model: Model) => TranscriptCall[];
  golden: StructuralGraph;
  roundTripBudget: number;
  // Recovery tasks expect the batch to surface an error while still applying the
  // valid ops (ADR 0045 §2 invariant 6).
  expectErrors?: boolean;
}

const threeTier: TranscriptCall = {
  tool: 'set_diagram',
  args: {
    nodes: [
      { id: 'web', kind: 'server', label: 'Web' },
      { id: 'api', kind: 'server', label: 'API' },
      { id: 'db', kind: 'database', label: 'DB' }
    ],
    connectors: [
      { from: 'web', to: 'api' },
      { from: 'api', to: 'db' }
    ]
  }
};

export const TASK_SUITE: EvalTask[] = [
  {
    name: 'generate-3-tier',
    prompt: '3-tier web app (web → api → db) with labelled connectors',
    build: () => [threeTier],
    roundTripBudget: 1,
    golden: {
      nodes: [
        { label: 'API', icon: 'icon-server' },
        { label: 'DB', icon: 'icon-database' },
        { label: 'Web', icon: 'icon-server' }
      ],
      edges: [
        ['API', 'DB'],
        ['API', 'Web']
      ]
    }
  },

  {
    name: 'incremental-add-cache',
    prompt: 'add a Redis cache between api and db',
    setup: [threeTier],
    build: (model) => {
      const api = idByLabel(model, 'API');
      const db = idByLabel(model, 'DB');
      const apiDb = connectorIdByLabels(model, 'API', 'DB');
      return [
        {
          tool: 'apply_ops',
          args: [
            { op: 'create_node', id: 'redis', kind: 'cache', label: 'Redis' },
            // "Between" → splice the direct API→DB link out and route through Redis.
            ...(apiDb ? [{ op: 'disconnect', id: apiDb }] : []),
            { op: 'connect', from: api, to: 'redis' },
            { op: 'connect', from: 'redis', to: db }
          ]
        }
      ];
    },
    roundTripBudget: 1,
    golden: {
      nodes: [
        { label: 'API', icon: 'icon-server' },
        { label: 'DB', icon: 'icon-database' },
        { label: 'Redis', icon: 'icon-cache' },
        { label: 'Web', icon: 'icon-server' }
      ],
      edges: [
        ['API', 'Redis'],
        ['API', 'Web'],
        ['DB', 'Redis']
      ]
    }
  },

  {
    name: 'redesign-microservices',
    prompt: 'convert to a microservices topology with an API gateway and 2 services',
    setup: [threeTier],
    build: () => [
      {
        tool: 'set_diagram',
        args: {
          nodes: [
            { id: 'gw', kind: 'gateway', label: 'Gateway' },
            { id: 's1', kind: 'server', label: 'Service A' },
            { id: 's2', kind: 'server', label: 'Service B' }
          ],
          connectors: [
            { from: 'gw', to: 's1' },
            { from: 'gw', to: 's2' }
          ],
          prune: true
        }
      }
    ],
    roundTripBudget: 1,
    golden: {
      nodes: [
        { label: 'Gateway', icon: 'icon-gateway' },
        { label: 'Service A', icon: 'icon-server' },
        { label: 'Service B', icon: 'icon-server' }
      ],
      edges: [
        ['Gateway', 'Service A'],
        ['Gateway', 'Service B']
      ]
    }
  },

  {
    name: 'recovery-partial-success',
    prompt: 'a batch with one invalid op — fix only the failed op, not the whole batch',
    build: () => [
      {
        tool: 'apply_ops',
        args: [
          { op: 'create_node', id: 'a', kind: 'server', label: 'Alpha' },
          // Invalid kind — must fail without sinking the valid ops.
          { op: 'create_node', id: 'bad', kind: 'no-such-kind', label: 'Bad' },
          { op: 'create_node', id: 'b', kind: 'database', label: 'Beta' },
          { op: 'connect', from: 'a', to: 'b' }
        ]
      }
    ],
    roundTripBudget: 1,
    expectErrors: true,
    golden: {
      nodes: [
        { label: 'Alpha', icon: 'icon-server' },
        { label: 'Beta', icon: 'icon-database' }
      ],
      edges: [['Alpha', 'Beta']]
    }
  }
];
