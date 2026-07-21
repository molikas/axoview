import { readFileSync } from 'fs';
import { resolve } from 'path';

// The two free-tier traps are one line each in wrangler.toml (ADR 0046 §2). This
// gate fails the build if either regresses: the DO must be declared with
// new_sqlite_classes (NOT new_classes), in BOTH the repo-root and worker-package
// configs (kept in lockstep per ADR 0009 §5).

const workerToml = resolve(process.cwd(), 'wrangler.toml');
const rootToml = resolve(process.cwd(), '../../wrangler.toml');
const devToml = resolve(process.cwd(), 'wrangler.dev.toml');

const configs = [
  { name: 'worker wrangler.toml', path: workerToml },
  { name: 'repo-root wrangler.toml', path: rootToml },
  { name: 'local-dev wrangler.dev.toml', path: devToml }
];

describe.each(configs)('$name — MCP Durable Object config', ({ path }) => {
  const toml = readFileSync(path, 'utf8');

  it('declares the AgentSessionDO binding named AGENT_SESSION', () => {
    expect(toml).toMatch(/name\s*=\s*"AGENT_SESSION"/);
    expect(toml).toMatch(/class_name\s*=\s*"AgentSessionDO"/);
  });

  it('uses new_sqlite_classes (free-tier requirement), NOT new_classes', () => {
    expect(toml).toMatch(/new_sqlite_classes\s*=\s*\[\s*"AgentSessionDO"\s*\]/);
    // The paid-plan-demanding variant must be absent.
    expect(toml).not.toMatch(/new_classes\s*=/);
  });
});
