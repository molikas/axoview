// Generates perf-stress-diagram.json — a deliberately heavy scene used to
// stress-test connector drag perf. Two named anchor nodes (Node A / Node B)
// sit at opposite ends of the canvas; everything else is filler to inflate
// the model so per-tick immer clones become measurable.
//
// Tweak NODE_COUNT / CONNECTOR_COUNT below and re-run with:
//   node packages/fossflow-e2e/fixtures/perf-stress-diagram.generator.mjs

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const NODE_COUNT = 80; // includes Node A + Node B
const CONNECTOR_COUNT = 120;

// Deterministic PRNG so re-running produces byte-identical output.
const rng = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
};
const rand = rng(0xc0ffee);

const ICON_DATA_URI =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9IjIwIiBoZWlnaHQ9IjgiIHJ4PSIyIiBmaWxsPSIjNjY2Ii8+PHJlY3QgeD0iMiIgeT0iMTQiIHdpZHRoPSIyMCIgaGVpZ2h0PSI4IiByeD0iMiIgZmlsbD0iIzY2NiIvPjwvc3ZnPg==';

const items = [];
const viewItems = [];

const placed = new Set();
const tryPlace = (x, y, key) => {
  if (placed.has(`${x},${y}`)) return false;
  placed.add(`${x},${y}`);
  return true;
};

// Anchor nodes at opposite ends so a connector drag from A → B traverses many
// tiles. Y-offset between them produces a diagonal drag (denser path).
const NODE_A = { id: 'node-A', name: 'Node A', tile: { x: 2, y: 6 } };
const NODE_B = { id: 'node-B', name: 'Node B', tile: { x: 48, y: 22 } };

placed.add(`${NODE_A.tile.x},${NODE_A.tile.y}`);
placed.add(`${NODE_B.tile.x},${NODE_B.tile.y}`);

items.push({ id: NODE_A.id, name: NODE_A.name, icon: 'stress-icon' });
items.push({ id: NODE_B.id, name: NODE_B.name, icon: 'stress-icon' });

viewItems.push({ id: NODE_A.id, tile: NODE_A.tile, labelHeight: 20 });
viewItems.push({ id: NODE_B.id, tile: NODE_B.tile, labelHeight: 20 });

// Filler nodes scattered between the anchors.
for (let i = 0; i < NODE_COUNT - 2; i += 1) {
  let tile;
  // Reject collisions; the canvas is large enough that this almost never loops.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const x = 4 + Math.floor(rand() * 43);
    const y = 1 + Math.floor(rand() * 26);
    if (!placed.has(`${x},${y}`)) {
      tile = { x, y };
      placed.add(`${x},${y}`);
      break;
    }
  }
  if (!tile) continue;

  const id = `node-${i.toString(36)}`;
  items.push({ id, name: `N${i}`, icon: 'stress-icon' });
  viewItems.push({ id, tile, labelHeight: 20 });
}

// Connectors between random filler-pairs (NOT touching A or B — leave those
// for the manual drag test).
const fillerIds = items.slice(2).map((it) => it.id);
const connectors = [];
for (let i = 0; i < CONNECTOR_COUNT; i += 1) {
  const a = fillerIds[Math.floor(rand() * fillerIds.length)];
  let b = fillerIds[Math.floor(rand() * fillerIds.length)];
  while (b === a) b = fillerIds[Math.floor(rand() * fillerIds.length)];
  connectors.push({
    id: `conn-${i.toString(36)}`,
    color: 'stress-color',
    anchors: [
      { id: `a-${i}-1`, ref: { item: a } },
      { id: `a-${i}-2`, ref: { item: b } }
    ]
  });
}

const fixture = {
  title: 'Connector Drag Perf Stress',
  description:
    'Two named anchors (Node A on the left, Node B on the right) plus filler. Drag a connector from A to B and watch FPS / GC.',
  version: '1.0.0',
  icons: [
    { id: 'stress-icon', name: 'Stress Node', isIsometric: true, url: ICON_DATA_URI }
  ],
  colors: [{ id: 'stress-color', label: 'Stress', value: '#6366F1' }],
  items,
  views: [
    {
      id: 'view-stress-1',
      name: 'Main',
      items: viewItems,
      connectors,
      textBoxes: [],
      rectangles: []
    }
  ],
  fitToView: true
};

const outPath = resolve(__dirname, 'perf-stress-diagram.json');
// Compact JSON — single line, no whitespace. Re-run the generator to tweak;
// the file is meant to be imported, not hand-edited.
writeFileSync(outPath, `${JSON.stringify(fixture)}\n`);
process.stdout.write(
  `wrote ${outPath} — ${items.length} nodes, ${connectors.length} connectors\n`
);
