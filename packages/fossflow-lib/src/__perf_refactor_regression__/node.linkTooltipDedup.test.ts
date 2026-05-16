/**
 * REGRESSION — MQA #22 + #25 (3rd pass): preview-mode interaction is now:
 *   - default cursor (not grab)
 *   - right-drag = pan (canvas default)
 *   - LEFT click on a node opens the existing readOnly NodePanel
 *   - NodePanel header exposes external-link + open-linked-diagram buttons
 *
 * Prior attempts:
 *   - 1st pass added an inner Tooltip on the badge → duplicate tooltip (#22).
 *   - 2nd pass added a hover-revealed chip; only triggered on the name (icon
 *     was pointerEvents:none).
 *   - 3rd pass (this) removes the chip entirely; click handling lives in
 *     Pan.mouseup (EXPLORABLE_READONLY branch) and the readOnly NodePanel
 *     gains an "Open linked diagram" affordance.
 */

import * as fs from 'fs';
import * as path from 'path';

const NODE_PATH = path.resolve(
  __dirname,
  '../components/SceneLayers/Nodes/Node/Node.tsx',
);
const PAN_PATH = path.resolve(
  __dirname,
  '../interaction/modes/Pan.ts',
);
const NODE_PANEL_PATH = path.resolve(
  __dirname,
  '../components/ItemControls/NodeControls/NodePanel/NodePanel.tsx',
);

describe('Node — no chip/popover; click handled by Pan mode (MQA #22 + #25 3rd pass)', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(NODE_PATH, 'utf-8');
  });

  it('Node.tsx exists', () => {
    expect(fs.existsSync(NODE_PATH)).toBe(true);
  });

  it('does not render a hover chip or click-anchored Popover for the action menu', () => {
    expect(src).not.toContain('node-hover-chip');
    expect(src).not.toContain('node-action-menu');
    // The Popover/IconButton/Tooltip imports are no longer needed.
    expect(src).not.toMatch(/import\s*\{[^}]*\bPopover\b[^}]*\}\s*from\s*'@mui\/material'/);
  });

  it('the bottom-right link badge is non-interactive (passive indicator only)', () => {
    const badgeIdx = src.indexOf('OpenInNewIcon sx={{ fontSize: 9');
    expect(badgeIdx).toBeGreaterThan(-1);
    const slice = src.slice(Math.max(0, badgeIdx - 600), badgeIdx);
    expect(slice).toMatch(/pointerEvents:\s*'none'/);
  });
});

describe('Pan mode — EXPLORABLE_READONLY click opens details panel (MQA #25)', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(PAN_PATH, 'utf-8');
  });

  it('opens the readOnly details panel when the clicked node has any content', () => {
    // The panel-open path must dispatch setItemControls({ type: 'ITEM', id })
    // for any node carrying link / headerLink / description / notes content.
    expect(src).toMatch(/setItemControls\(\{\s*type:\s*'ITEM',\s*id:\s*item\.id/);
  });

  it('default cursor in EXPLORABLE_READONLY is "default" (not "grab")', () => {
    expect(src).toMatch(/EXPLORABLE_READONLY[\s\S]*?'default'/);
  });

  it('does NOT auto-navigate on body click (link navigation lives in the panel)', () => {
    expect(src).not.toContain("window.open(`/display/${modelItem.link}`");
  });
});

describe('NodePanel readOnly — "Open linked diagram" affordance (MQA #25)', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(NODE_PANEL_PATH, 'utf-8');
  });

  it('renders a button that opens modelItem.link in a new tab', () => {
    expect(src).toContain('data-testid="node-panel-open-linked-diagram"');
    expect(src).toMatch(/href=\{`\/display\/\$\{modelItem\.link\}`\}/);
    expect(src).toMatch(/target="_blank"/);
  });
});
