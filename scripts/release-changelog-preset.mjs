// Custom conventional-changelog config for @semantic-release/release-notes-generator.
//
// Wraps the `conventionalcommits` preset to implement ADR 0046:
//
//   1. Render each commit's BODY (the per-fix bullet list) beneath its subject
//      (ADR 0046 §1). `/shake-out` bundles a release into one commit; the body
//      is where the per-fix detail lives, and the preset drops it by default.
//
//   2. Suppress issue-reference links (ADR 0046 §2). The project uses no issue
//      tracker (issues are triaged in chat), so `closes #N` footers and stray
//      `#token`s (hex colours, SHAs, test ids) only ever render dead links.
//      Setting the parser's `issuePrefixes` to `[]` stops all reference
//      scraping; the real merge-PR link is untouched because the writer
//      re-linkifies the `(#N)` in the subject line separately.
//
// Wired via `.releaserc.json` → release-notes-generator `{ "config": "./scripts/release-changelog-preset.mjs" }`.
// The loader calls this default export with no arguments and expects the
// conventional-changelog config shape `{ commits, parser, writer, whatBump }`.
//
// Validated offline with `@semantic-release/release-notes-generator`'s
// `generateNotes` — see the PR description for the sample-commit fixture.

import createPreset from 'conventional-changelog-conventionalcommits';

// Mirrors the section map previously held inline in .releaserc.json's presetConfig.
const TYPES = [
  { type: 'feat', section: 'Features' },
  { type: 'fix', section: 'Bug Fixes' },
  { type: 'perf', section: 'Performance' },
  { type: 'revert', section: 'Reverts' },
  { type: 'docs', section: 'Documentation', hidden: false },
  { type: 'style', section: 'Styles', hidden: true },
  { type: 'chore', section: 'Chores', hidden: true },
  { type: 'refactor', section: 'Code Refactoring' },
  { type: 'test', section: 'Tests', hidden: true },
  { type: 'build', section: 'Build System', hidden: true },
  { type: 'ci', section: 'CI/CD', hidden: true },
];

export default async function createAxoviewChangelogConfig() {
  const preset = await createPreset({ types: TYPES });

  const baseTransform = preset.writer.transform;
  preset.writer.transform = (commit, context) => {
    // The preset transform runs first: it linkifies the `(#N)` PR ref *in the
    // subject* (baking a real link into the subject string) and returns the
    // remaining references as the `, closes …` list.
    const out = baseTransform(commit, context);
    if (out) {
      // (2) No issue tracker → drop the `, closes …` reference list entirely so
      // stray `#token`s (hex colours, SHAs, test ids, fabricated numbers) never
      // render as dead links. The real merge-PR link survives — it lives in the
      // already-linkified subject, not in `references`.
      out.references = [];

      // (1) Carry the commit BODY through (the preset strips it) and indent each
      // line two spaces so it nests as a sub-list under the commit's bullet.
      const body = (commit.body || '').trim();
      out.body = body
        ? body
            .split('\n')
            .map((line) => (line.trim() ? '  ' + line.trimEnd() : ''))
            .join('\n')
        : '';
    }
    return out;
  };

  // Append the body beneath the standard commit line. Triple-stache so markdown
  // (dashes, em-dashes, quotes) is emitted verbatim rather than HTML-escaped.
  preset.writer.commitPartial =
    preset.writer.commitPartial.replace(/\s*$/, '') + '\n{{#if body}}\n\n{{{body}}}\n{{/if}}\n';

  return preset;
}
