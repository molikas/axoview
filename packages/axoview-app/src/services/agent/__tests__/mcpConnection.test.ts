import { wsUrlFromBase, absoluteUrl } from '../mcpConnection';

describe('MCP connection URL helpers (ADR 0046)', () => {
  it('swaps http→ws and https→wss', () => {
    expect(wsUrlFromBase('http://localhost:8787', '/pair/AXV-AB2K/ws')).toBe(
      'ws://localhost:8787/pair/AXV-AB2K/ws'
    );
    expect(wsUrlFromBase('https://axoview.app', '/pair/AXV-AB2K/ws')).toBe(
      'wss://axoview.app/pair/AXV-AB2K/ws'
    );
  });

  it('resolves the MCP endpoint against the base origin', () => {
    expect(absoluteUrl('http://localhost:8787', '/mcp/AXV-AB2K')).toBe(
      'http://localhost:8787/mcp/AXV-AB2K'
    );
    expect(absoluteUrl('https://axoview.app/', '/pair/new')).toBe(
      'https://axoview.app/pair/new'
    );
  });
});
