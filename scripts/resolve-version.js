// Resolve the build-time version for the in-app version surfaces (About tab +
// boot splash). ADR 0045.
//
// Why not read package.json? Releases are cut by semantic-release as a git TAG
// + GitHub Release only — the committed package.json is intentionally NOT bumped
// (commit-back to master is blocked by the branch-protection ruleset, GH013;
// see commit #77). So the committed version is frozen and unreliable. The git
// tag is the source of truth, injected here at build time.
//
// Resolution order:
//   1. AXOVIEW_VERSION env override (lets CI / Cloudflare set it explicitly).
//   2. Exact tag on HEAD  → clean release version, e.g. "3.8.4" (the case after
//      the post-release Cloudflare rebuild — see ADR 0045, deploy hook).
//   3. Nearest reachable tag (clean, no sha suffix) → e.g. "3.8.3" (the case
//      when Cloudflare builds a commit before its release tag exists).
//   4. Fallback to the passed package.json version (git/tags unavailable).
//
// In CI / Cloudflare the clone may omit tags; step 3/4 first does a best-effort
// `git fetch --tags` so a tag-less checkout can't strand the version at the
// frozen package.json value.
//
// Consumed by packages/axoview-lib/rslib.config.ts (PACKAGE_VERSION) and
// packages/axoview-app/rsbuild.config.ts (REACT_APP_VERSION).

const { execSync } = require('child_process');

const clean = (v) => String(v).trim().replace(/^v/, '');

function git(args) {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

// Exact tag on HEAD → clean version; else the nearest reachable tag (clean).
// Empty string when no tag is reachable.
function describeVersion() {
  const exact = git('describe --tags --exact-match');
  if (exact) return clean(exact);
  const nearest = git('describe --tags --abbrev=0');
  if (nearest) return clean(nearest);
  return '';
}

module.exports = function resolveVersion(fallback) {
  if (process.env.AXOVIEW_VERSION) return clean(process.env.AXOVIEW_VERSION);

  let version = describeVersion();
  if (!version && (process.env.CF_PAGES || process.env.CI)) {
    // Cloudflare / CI checkout without tags — fetch once, best-effort, retry.
    git('fetch --tags --force');
    version = describeVersion();
  }
  return version || clean(fallback);
};
