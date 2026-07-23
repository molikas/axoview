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
//   2. Exact tag on HEAD  → clean release version, e.g. "3.8.1".
//   3. Nearest tag + distance + short sha → e.g. "3.8.1-3-gabc1234" (honest
//      "preview past the last release" marker; Cloudflare builds a commit
//      before its release tag exists, so this is the common production case).
//   4. Fallback to the passed package.json version (git/tags unavailable).
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

module.exports = function resolveVersion(fallback) {
  if (process.env.AXOVIEW_VERSION) return clean(process.env.AXOVIEW_VERSION);

  const exact = git('describe --tags --exact-match');
  if (exact) return clean(exact);

  // No --always: if the clone has no tags, this returns empty and we fall back
  // rather than emitting a bare commit sha as if it were a version.
  const described = git('describe --tags');
  if (described) return clean(described);

  return clean(fallback);
};
