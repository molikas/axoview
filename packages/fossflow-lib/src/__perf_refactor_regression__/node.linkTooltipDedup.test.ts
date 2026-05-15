/**
 * REGRESSION — MQA #22 + #25: preview mode link interaction.
 *
 * History:
 *   - #22 first pass (Bundle B initial): two `<Tooltip>` wrappers fired on the
 *     same badge area, producing two identical popups. Fix removed the inner one.
 *   - #25 redesign (Bundle B follow-up): replaced the bare body-click navigation
 *     with a hover-revealed action chip exposing up to three affordances —
 *     external link (name), linked diagram, notes (popover). The body click is
 *     now intentionally inert; the bottom-right link badge is a passive visual
 *     indicator only (`pointerEvents: none`).
 *
 * Structural pins:
 *   - Node.tsx must render the new hover chip (`data-testid="node-hover-chip"`).
 *   - The three action buttons must exist as separate testids so we know all
 *     three affordances survive future edits.
 *   - The link badge must NOT be a click target — `pointerEvents: 'none'` is the
 *     contract.
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

describe('Node — preview-mode hover chip (MQA #22 + #25)', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(NODE_PATH, 'utf-8');
  });

  it('Node.tsx exists', () => {
    expect(fs.existsSync(NODE_PATH)).toBe(true);
  });

  it('renders the hover chip with all three affordance testids', () => {
    expect(src).toContain('data-testid="node-hover-chip"');
    expect(src).toContain('data-testid="node-hover-chip-link"');
    expect(src).toContain('data-testid="node-hover-chip-diagram"');
    expect(src).toContain('data-testid="node-hover-chip-notes"');
  });

  it('the bottom-right link badge is non-interactive (passive indicator only)', () => {
    // Find the badge block (only present when hasLink) and assert pointerEvents none.
    const badgeIdx = src.indexOf('OpenInNewIcon sx={{ fontSize: 9');
    expect(badgeIdx).toBeGreaterThan(-1);
    // Walk back to the enclosing <Box ... sx={{ ... }}>
    const slice = src.slice(Math.max(0, badgeIdx - 600), badgeIdx);
    expect(slice).toMatch(/pointerEvents:\s*'none'/);
    // No onClick handler on the badge anymore.
    expect(slice).not.toMatch(/onClick=\{handleBadgeClick\}/);
  });

  it('opens notes via a Popover anchored to the node, not via setItemControls', () => {
    expect(src).toContain('<Popover');
    expect(src).toMatch(/anchorEl=\{notesAnchor\}/);
    // The hover-chip's notes button must NOT route through itemControls. The
    // onClick={handleOpenNotes} sits ABOVE the testid in JSX source order, so
    // grab a window straddling the testid and assert the handler is in scope.
    const notesBtnIdx = src.indexOf('node-hover-chip-notes');
    expect(notesBtnIdx).toBeGreaterThan(-1);
    const window = src.slice(
      Math.max(0, notesBtnIdx - 400),
      notesBtnIdx + 200,
    );
    expect(window).toContain('handleOpenNotes');
  });
});

describe('Pan mode — preview body click is inert (MQA #25)', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(PAN_PATH, 'utf-8');
  });

  it('does NOT navigate on EXPLORABLE_READONLY body click', () => {
    // The previous code called `window.open('/display/...')` from Pan.mouseup.
    // The redesign removes it.
    expect(src).not.toContain("window.open(`/display/${modelItem.link}`");
  });

  it('does NOT open the properties panel on EXPLORABLE_READONLY body click', () => {
    // Previous behaviour: setItemControls({ type: 'ITEM', id }) when notes/desc.
    // New behaviour: only setItemControls(null) (dismiss any leftover UI).
    expect(src).not.toMatch(/setItemControls\(\{\s*type:\s*'ITEM'/);
  });
});
