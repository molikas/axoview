import { readFileSync } from 'fs';
import { resolve } from 'path';

// MCP Durable Object wrangler config gate (ADR 0046 §2). Cloudflare Pages CANNOT
// define a DO in-project (it rejects [[migrations]] and requires a script_name),
// so the config is SPLIT:
//   - PAGES configs (repo-root + worker wrangler.toml) bind to the DO in the
//     standalone "axoview-mcp" Worker via `script_name`, and MUST NOT carry a
//     migration (Pages fails the build if they do — the 2026-07-22 failure).
//   - WORKER configs (wrangler.dev.toml + wrangler.mcp.toml) DEFINE + migrate the
//     DO with new_sqlite_classes (SQLite-backed = free-tier; NOT new_classes).
// All four keep the AGENT_SESSION / AgentSessionDO names in lockstep (ADR 0009 §5).

const p = (rel: string) => resolve(process.cwd(), rel);

// Strip `#` comment lines so prose that mentions "[[migrations]]" etc. doesn't
// trip the structural assertions below.
const readActive = (path: string): string =>
  readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('#'))
    .join('\n');

const pagesConfigs = [
  { name: 'worker wrangler.toml (Pages)', path: p('wrangler.toml') },
  { name: 'repo-root wrangler.toml (Pages)', path: p('../../wrangler.toml') }
];

const workerConfigs = [
  { name: 'wrangler.dev.toml (standalone)', path: p('wrangler.dev.toml') },
  { name: 'wrangler.mcp.toml (standalone)', path: p('wrangler.mcp.toml') }
];

describe.each(pagesConfigs)('$name — binds to external DO', ({ path }) => {
  const toml = readActive(path);

  it('declares the AGENT_SESSION → AgentSessionDO binding', () => {
    expect(toml).toMatch(/name\s*=\s*"AGENT_SESSION"/);
    expect(toml).toMatch(/class_name\s*=\s*"AgentSessionDO"/);
  });

  it('binds via script_name = "axoview-mcp" (Pages requirement)', () => {
    expect(toml).toMatch(/script_name\s*=\s*"axoview-mcp"/);
  });

  it('does NOT carry [[migrations]] (Pages rejects them)', () => {
    expect(toml).not.toMatch(/\[\[migrations\]\]/);
    expect(toml).not.toMatch(/new_sqlite_classes/);
  });
});

describe.each(workerConfigs)('$name — defines + migrates DO', ({ path }) => {
  const toml = readActive(path);

  it('declares the AGENT_SESSION → AgentSessionDO binding (no script_name — owns it)', () => {
    expect(toml).toMatch(/name\s*=\s*"AGENT_SESSION"/);
    expect(toml).toMatch(/class_name\s*=\s*"AgentSessionDO"/);
    expect(toml).not.toMatch(/script_name/);
  });

  it('uses new_sqlite_classes (free-tier requirement), NOT new_classes', () => {
    expect(toml).toMatch(/new_sqlite_classes\s*=\s*\[\s*"AgentSessionDO"\s*\]/);
    expect(toml).not.toMatch(/new_classes\s*=/);
  });
});
