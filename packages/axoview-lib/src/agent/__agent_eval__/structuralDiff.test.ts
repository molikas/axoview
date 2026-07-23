import { normalize, diff, StructuralGraph } from './structuralDiff';
import { makeHarness, EVAL_VIEW_ID, replay } from './harness';
import { runMeasure } from './measure';

describe('structuralDiff (ADR 0047 §Implementation notes)', () => {
  it('normalizes a built diagram to a placement-equivalent graph (tiles dropped)', () => {
    const h = makeHarness();
    replay(h, [
      {
        tool: 'set_diagram',
        args: {
          nodes: [
            { id: 'a', kind: 'server', label: 'A' },
            { id: 'b', kind: 'database', label: 'B' }
          ],
          connectors: [{ from: 'a', to: 'b' }]
        }
      }
    ]);
    const g = normalize(h.model(), EVAL_VIEW_ID);
    expect(g.nodes.map((n) => n.label)).toEqual(['A', 'B']);
    expect(g.edges).toEqual([['A', 'B']]);
  });

  it('detects missing + extra nodes and edges', () => {
    const actual: StructuralGraph = {
      nodes: [{ label: 'A' }, { label: 'B' }],
      edges: [['A', 'B']]
    };
    const golden: StructuralGraph = {
      nodes: [{ label: 'A' }, { label: 'C' }],
      edges: [['A', 'C']]
    };
    const d = diff(actual, golden);
    expect(d.equal).toBe(false);
    expect(d.missingNodes).toEqual(['C']);
    expect(d.extraNodes).toEqual(['B']);
    expect(d.missingEdges).toEqual(['A—C']);
    expect(d.extraEdges).toEqual(['A—B']);
  });
});

describe('runMeasure (ADR 0047 §3 MEASURE) — with an injected solver', () => {
  it('reports PASS when a perfect solver replays each task golden', async () => {
    // A stand-in "model" that solves each task by emitting the ideal one call.
    const solve = async ({
      prompt,
      surface
    }: {
      prompt: string;
      surface: import('../createAgentSurface').AgentSurface;
    }) => {
      if (prompt.startsWith('3-tier')) {
        surface.set_diagram({
          nodes: [
            { id: 'web', kind: 'server', label: 'Web' },
            { id: 'api', kind: 'server', label: 'API' },
            { id: 'db', kind: 'database', label: 'DB' }
          ],
          connectors: [
            { from: 'web', to: 'api' },
            { from: 'api', to: 'db' }
          ]
        });
      }
    };

    const records = await runMeasure(solve as never, {
      tasks: [
        {
          name: 'generate-3-tier',
          prompt: '3-tier web app',
          build: () => [],
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
        }
      ]
    });

    expect(records[0].verdict).toBe('PASS');
    expect(records[0].roundTrips).toBe(1);
  });
});
