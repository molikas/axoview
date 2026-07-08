/**
 * PERF REGRESSION — N-2/N-3: Connector must not re-render on unrelated model changes
 *
 * Before the fix, each Connector component:
 *  1. Called useScene() to get currentView (N subscriptions to modelStore)
 *  2. Called useConnector(id) which also called useScene() (another N subscriptions)
 *
 * With N connectors, any model change (even renaming a diagram title) caused
 * N×2 useScene selector evaluations and potentially N connector re-renders.
 *
 * The fix: Connector receives currentView as a prop and uses the connector prop
 * directly instead of re-fetching via useConnector. The single useScene
 * subscription was later lifted one level further — from Connectors.tsx up to
 * Renderer.tsx (the WebGL GPU-fold, 2026-07) — which now passes currentView
 * down to <Connectors>. The invariant that matters is unchanged: exactly ONE
 * useScene subscription in an ancestor, never re-fetched per connector.
 *
 * Contract pinned here:
 *  - Connector and Connectors are wrapped in React.memo
 *  - Connector does NOT call useScene() or useConnector() directly
 *  - Connectors is prop-driven (holds only a TYPE reference to useScene); the
 *    live subscription is owned by Renderer.tsx, which passes currentView down
 */

import * as fs from 'fs';
import * as path from 'path';

const CONNECTOR_PATH = path.resolve(
  __dirname,
  '../components/SceneLayers/Connectors/Connector.tsx'
);
const CONNECTORS_PATH = path.resolve(
  __dirname,
  '../components/SceneLayers/Connectors/Connectors.tsx'
);
const RENDERER_PATH = path.resolve(
  __dirname,
  '../components/Renderer/Renderer.tsx'
);

describe('Connector render isolation — N-2/N-3 regression', () => {
  let connectorSource: string;
  let connectorsSource: string;

  beforeAll(() => {
    connectorSource = fs.readFileSync(CONNECTOR_PATH, 'utf8');
    connectorsSource = fs.readFileSync(CONNECTORS_PATH, 'utf8');
  });

  it('Connector.tsx does NOT call useScene() directly', () => {
    // useScene should not appear as a direct call — connector data
    // is received as a prop and currentView is passed down from parent
    const hasDirectUseScene = /\buseScene\s*\(\s*\)/.test(connectorSource);
    expect(hasDirectUseScene).toBe(false);
  });

  it('Connector.tsx does NOT call useConnector() (redundant re-fetch via useScene)', () => {
    const hasUseConnector = /\buseConnector\s*\(/.test(connectorSource);
    expect(hasUseConnector).toBe(false);
  });

  it('Connectors.tsx is prop-driven — the single useScene subscription is lifted to Renderer', () => {
    // The list-level component must NOT re-fetch via useScene(); it receives
    // currentView as a prop (a type-only `import type { useScene }` is fine).
    // The live subscription is owned by Renderer.tsx (the GPU-fold lifted it
    // there) and flows down as a prop — exactly one subscription, not N.
    const listCallsUseScene = /\buseScene\s*\(\s*\)/.test(connectorsSource);
    expect(listCallsUseScene).toBe(false);

    const rendererSource = fs.readFileSync(RENDERER_PATH, 'utf8');
    expect(/\buseScene\s*\(\s*\)/.test(rendererSource)).toBe(true);
    expect(/currentView={currentView}/.test(rendererSource)).toBe(true);
  });

  it('Connector is exported as a React.memo component', () => {
    // memo() wrapping is visible as: export const Connector = memo(
    const isMemo = /export\s+const\s+Connector\s*=\s*memo\s*\(/.test(
      connectorSource
    );
    expect(isMemo).toBe(true);
  });

  it('Connectors is exported as a React.memo component', () => {
    const isMemo = /export\s+const\s+Connectors\s*=\s*memo\s*\(/.test(
      connectorsSource
    );
    expect(isMemo).toBe(true);
  });
});
