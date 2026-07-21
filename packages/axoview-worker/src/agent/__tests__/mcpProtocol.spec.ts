import {
  handleMcpMessage,
  McpRouter,
  MCP_PROTOCOL_VERSION
} from '../mcpProtocol';

const fakeRouter = (over: Partial<McpRouter> = {}): McpRouter => ({
  serverVersion: '1.0.0-test',
  getManifest: async () => ({
    tools: [{ name: 'apply_ops', description: 'batch edits', inputSchema: {} }],
    skill: 'MODELING SKILL TEXT'
  }),
  callTool: async (name, args) => ({ result: { called: name, args } }),
  ...over
});

const req = (method: string, params?: object, id: number | null = 1) => ({
  jsonrpc: '2.0' as const,
  id,
  method,
  ...(params ? { params } : {})
});

describe('handleMcpMessage — MCP protocol (ADR 0046 §5)', () => {
  it('initialize returns the protocol version + server info + skill instructions (X1)', async () => {
    const res: any = await handleMcpMessage(req('initialize'), fakeRouter());
    expect(res.result.protocolVersion).toBe(MCP_PROTOCOL_VERSION);
    expect(res.result.serverInfo).toEqual({
      name: 'axoview',
      version: '1.0.0-test'
    });
    expect(res.result.capabilities).toHaveProperty('tools');
    // X1: the modeling skill reaches tools-only agents via `instructions`.
    expect(res.result.instructions).toMatch(/axoview:\/\/diagram\/current/);
    expect(res.result.instructions).toContain('MODELING SKILL TEXT');
  });

  it('initialize still returns a breadcrumb when no tab has registered', async () => {
    const res: any = await handleMcpMessage(
      req('initialize'),
      fakeRouter({ getManifest: async () => null })
    );
    expect(res.result.instructions).toMatch(/never compute a tile/i);
  });

  it('tools/list returns the tab-registered manifest tools', async () => {
    const res: any = await handleMcpMessage(req('tools/list'), fakeRouter());
    expect(res.result.tools).toHaveLength(1);
    expect(res.result.tools[0].name).toBe('apply_ops');
  });

  it('tools/list returns [] when no tab has registered (tab-not-open)', async () => {
    const res: any = await handleMcpMessage(
      req('tools/list'),
      fakeRouter({ getManifest: async () => null })
    );
    expect(res.result.tools).toEqual([]);
  });

  it('tools/call forwards and wraps the result as tool content', async () => {
    const res: any = await handleMcpMessage(
      req('tools/call', { name: 'apply_ops', arguments: [{ op: 'x' }] }),
      fakeRouter()
    );
    expect(res.result.isError).toBe(false);
    const payload = JSON.parse(res.result.content[0].text);
    expect(payload.called).toBe('apply_ops');
  });

  it('tools/call reports an error outcome as isError content, not a JSON-RPC error', async () => {
    const res: any = await handleMcpMessage(
      req('tools/call', { name: 'apply_ops', arguments: {} }),
      fakeRouter({ callTool: async () => ({ error: 'no active canvas' }) })
    );
    expect(res.result.isError).toBe(true);
    // E2: canonical error body shape {error:{code,message}}.
    expect(JSON.parse(res.result.content[0].text)).toEqual({
      error: { code: -32010, message: 'no active canvas' }
    });
  });

  it('resources/read pulls the diagram via a get_diagram tool call', async () => {
    const spy = jest.fn(async () => ({ result: { title: 'd' } }));
    const res: any = await handleMcpMessage(
      req('resources/read', { uri: 'axoview://diagram/current' }),
      fakeRouter({ callTool: spy })
    );
    expect(spy).toHaveBeenCalledWith('get_diagram', {});
    expect(JSON.parse(res.result.contents[0].text)).toEqual({ title: 'd' });
  });

  it('prompts/get returns the modeling skill', async () => {
    const res: any = await handleMcpMessage(req('prompts/get'), fakeRouter());
    expect(res.result.messages[0].content.text).toBe('MODELING SKILL TEXT');
  });

  it('a notification (no id) yields no response', async () => {
    const res = await handleMcpMessage(
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      fakeRouter()
    );
    expect(res).toBeNull();
  });

  it('an unknown method with an id is a method-not-found error', async () => {
    const res: any = await handleMcpMessage(req('does/not/exist'), fakeRouter());
    expect(res.error.code).toBe(-32601);
  });
});
