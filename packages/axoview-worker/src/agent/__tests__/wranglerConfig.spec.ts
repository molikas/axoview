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

// Pages CANNOT host a Durable Object, so the Pages configs carry NO DO at all —
// the whole bridge is the standalone axoview-mcp Worker.
const pagesConfigs = [
  { name: 'worker wrangler.toml (Pages)', path: p('wrangler.toml') },
  { name: 'repo-root wrangler.toml (Pages)', path: p('../../wrangler.toml') }
];

// The standalone Worker configs DEFINE + migrate the DO.
const workerConfigs = [
  { name: 'wrangler.dev.toml (standalone)', path: p('wrangler.dev.toml') },
  { name: 'wrangler.mcp.toml (standalone)', path: p('wrangler.mcp.toml') }
];

describe.each(pagesConfigs)('$name — carries NO Durable Object', ({ path }) => {
  const toml = readActive(path);

  it('has no durable_objects binding (Pages cannot host a DO)', () => {
    expect(toml).not.toMatch(/\[\[durable_objects\.bindings\]\]/);
  });

  it('has no [[migrations]] (Pages rejects them)', () => {
    expect(toml).not.toMatch(/\[\[migrations\]\]/);
    expect(toml).not.toMatch(/new_sqlite_classes/);
  });
});

describe.each(workerConfigs)('$name — defines + migrates DO', ({ path }) => {
  const toml = readActive(path);

  it('declares the AGENT_SESSION → AgentSessionDO binding', () => {
    expect(toml).toMatch(/name\s*=\s*"AGENT_SESSION"/);
    expect(toml).toMatch(/class_name\s*=\s*"AgentSessionDO"/);
  });

  it('uses new_sqlite_classes (free-tier requirement), NOT new_classes', () => {
    expect(toml).toMatch(/new_sqlite_classes\s*=\s*\[\s*"AgentSessionDO"\s*\]/);
    expect(toml).not.toMatch(/new_classes\s*=/);
  });
});
