/**
 * REGRESSION — MQA #22: preview mode shows two "Opens linked diagram in a new tab"
 * tooltips on hover.
 *
 * Cause: a `<Tooltip>` wrapped the entire node Box AND another `<Tooltip>` wrapped
 * the small link-badge inside it. Hovering the badge fired both. The fix removes
 * the inner badge-level Tooltip; the outer one covers the badge area.
 *
 * This is a structural regression test: assert that Node.tsx contains exactly one
 * Tooltip whose title is bound to `diagramTooltip`. A second occurrence resurrects
 * the duplicate-tooltip bug.
 */

import * as fs from 'fs';
import * as path from 'path';

const NODE_PATH = path.resolve(
  __dirname,
  '../components/SceneLayers/Nodes/Node/Node.tsx',
);

describe('Node — link tooltip is mounted exactly once (MQA #22)', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(NODE_PATH, 'utf-8');
  });

  it('Node.tsx exists', () => {
    expect(fs.existsSync(NODE_PATH)).toBe(true);
  });

  it('mounts exactly one <Tooltip ... title={... diagramTooltip ...}>', () => {
    const matches = src.match(/<Tooltip[^>]*\bdiagramTooltip\b/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('still defines the diagramTooltip text for the surviving tooltip', () => {
    expect(src).toContain('const diagramTooltip');
    expect(src).toMatch(/in a new tab/);
  });
});
