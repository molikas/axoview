/**
 * REGRESSION — MQA #13: F2 inline-rename in the file explorer disappeared
 * instantly when a canvas node was selected.
 *
 * Cause: the library's window-level keydown handler captured F2 whenever a
 * canvas item was selected (regardless of where the keystroke originated)
 * and dispatched the `inlineEditNodeName` event, which stole focus into the
 * canvas node's inline editor and unmounted the file-explorer edit input.
 *
 * Fix: scope the F2 → inline-rename handoff to keystrokes that came from
 * inside the renderer. We assert that contract via the source rather than
 * spinning up the full interaction manager.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.resolve(
  __dirname,
  '../interaction/useInteractionManager.ts',
);

describe('useInteractionManager — F2 renderer-scope guard (MQA #13)', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(SRC, 'utf-8');
  });

  it('F2 handler checks cameFromRenderer before dispatching inlineEditNodeName', () => {
    // Slice the F2 branch out of the file so other parts can't satisfy these assertions.
    const f2Idx = src.indexOf("e.key === 'F2'");
    expect(f2Idx).toBeGreaterThan(-1);
    const slice = src.slice(f2Idx, f2Idx + 1500);
    expect(slice).toContain('cameFromRenderer');
    expect(slice).toContain('rendererRef.current');
    // The dispatch must be conditional on cameFromRenderer being truthy.
    expect(slice).toMatch(/cameFromRenderer[\s\S]*inlineEditNodeName/);
  });
});
