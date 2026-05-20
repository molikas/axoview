/**
 * REGRESSION — ExportImageDialog: blank preview on first open
 *
 * Root cause: the old code fired exportImage() after a fixed 100 ms
 * setTimeout + double rAF on mount, before Axoview's model store was
 * populated. The capture ran against an empty canvas (just the blue
 * background), producing a blank PNG. Toggling a checkbox re-triggered
 * the export after Axoview had been running for seconds — which is why
 * it worked on the second attempt.
 *
 * Fix: use onModelUpdated on the hidden Axoview as a "ready" signal.
 * axoviewLoadedRef is set on the FIRST call and never again, so
 * subsequent onModelUpdated callbacks (options changes) do not re-trigger
 * the initial load path.
 *
 * This test reads ExportImageDialog.tsx source and pins the structural
 * constraints that make the fix correct and non-regressing.
 */

import * as fs from 'fs';
import * as path from 'path';

const DIALOG_PATH = path.resolve(
  __dirname,
  '../components/ExportImageDialog/ExportImageDialog.tsx'
);

describe('ExportImageDialog — initial load fix', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(DIALOG_PATH, 'utf-8');
  });

  it('ExportImageDialog.tsx exists', () => {
    expect(fs.existsSync(DIALOG_PATH)).toBe(true);
  });

  it('declares axoviewLoadedRef to gate the ready signal', () => {
    expect(src).toContain('axoviewLoadedRef');
  });

  it('declares axoviewReadySignal state to trigger the initial export effect', () => {
    expect(src).toContain('axoviewReadySignal');
  });

  it('uses handleHiddenAxoviewReady as the onModelUpdated callback', () => {
    expect(src).toContain('handleHiddenAxoviewReady');
    expect(src).toContain('onModelUpdated={handleHiddenAxoviewReady}');
  });

  it('axoviewLoadedRef guard prevents multiple initial exports', () => {
    // The handler must check the ref before setting it — ensures only the
    // first onModelUpdated call triggers the export, not subsequent ones
    // from option-change re-renders.
    expect(src).toContain('if (!axoviewLoadedRef.current)');
    expect(src).toContain('axoviewLoadedRef.current = true');
  });

  it('initial-load effect depends on axoviewReadySignal, not on exportImage directly', () => {
    // The initial export effect must list axoviewReadySignal in its deps.
    // If it listed exportImage it would re-fire on every option change.
    expect(src).toContain('[axoviewReadySignal]');
  });

  it('initial-load effect guards on axoviewReadySignal === 0 to skip on mount', () => {
    expect(src).toContain('axoviewReadySignal === 0');
  });

  it('options-change effect is guarded by axoviewLoadedRef.current', () => {
    // Re-export on options change must not fire until the initial load
    // has already completed — prevents a race where options-change fires
    // on mount before Axoview is ready.
    expect(src).toContain('axoviewLoadedRef.current');
    // The guard must appear inside the options-change effect body
    const optionsEffectMatch =
      src.match(
        /if \(!axoviewLoadedRef\.current[^)]*\|[^)]*cropToContent\) return/
      ) ||
      src.match(/if \(!axoviewLoadedRef\.current \|\| cropToContent\) return/);
    expect(optionsEffectMatch).not.toBeNull();
  });

  it('uses exportImageRef to call the latest exportImage without dep-array churn', () => {
    expect(src).toContain('exportImageRef');
    expect(src).toContain('exportImageRef.current = exportImage');
    expect(src).toContain('exportImageRef.current()');
  });

  it('hidden Axoview is always mounted (not gated on !imageData)', () => {
    // The Axoview for export must always remain mounted so onModelUpdated
    // fires even while the loading spinner is shown.
    // If the component were inside `{!imageData && ...}` it would unmount
    // as soon as the first export completes, making re-exports impossible.
    const axoviewBlock = src.indexOf('key="export-dialog-axoview"');
    const imageDataGate = src.indexOf('{!imageData && (');
    // The hidden Axoview must come BEFORE the imageData gate, i.e. it is
    // unconditionally rendered.
    expect(axoviewBlock).toBeGreaterThan(0);
    expect(imageDataGate).toBeGreaterThan(0);
    expect(axoviewBlock).toBeLessThan(imageDataGate);
  });
});
