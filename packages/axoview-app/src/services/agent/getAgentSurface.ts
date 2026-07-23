// Reach the curated agent surface the lib publishes at window.__axoview__.agent
// (ADR 0045 §1). Returns null before Axoview has mounted.

import type { AgentSurface } from 'axoview';

interface WindowWithAgent extends Window {
  __axoview__?: { agent?: AgentSurface };
}

export const getAgentSurface = (): AgentSurface | null =>
  (window as WindowWithAgent).__axoview__?.agent ?? null;
