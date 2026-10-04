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
//   3. Credit co-authors ONCE (ADR 0046 §4). Every commit carries a
//      `Co-Authored-By:` trailer, and a squash merge pastes each branch
//      commit's message into its body, so rendering bodies verbatim repeated
//      the same trailer once per commit (v3.10.0 had 15). Trailers are
//      stripped from every body, and the distinct co-authors are named in one
//      line at the end of the notes.
//
//   4. Re-flow hard-wrapped bodies (ADR 0046 §4). GitHub renders each newline
//      in a release body as a line break, so 72-column commit wrapping showed
//      as a narrow ragged column; wrapped lines are joined back into their
//      paragraph or list item.
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

// `Co-Authored-By: Name <email>` (git trailer keys are case-insensitive).
const CO_AUTHOR_LINE = /^\s*co-authored-by:\s*(.+?)\s*$/i;

/** Splits text into its lines without co-author trailers and the names those trailers credit. */
export function splitCoAuthors(text) {
  const names = [];
  const kept = [];
  for (const line of (text || '').split('\n')) {
    const m = CO_AUTHOR_LINE.exec(line);
    if (m) names.push(m[1].replace(/\s*<[^>]*>$/, '').trim());
    else kept.push(line);
  }
  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), names };
}

// A line that starts its own block: a list item, heading, quote or table row.
const BLOCK_START = /^\s*(?:[-*+]\s|\d+[.)]\s|#|>|\|)/;
const FENCE = /^\s*(?:```|~~~)/;

/**
 * Joins hard-wrapped lines back into their paragraph or list item. GitHub
 * renders every newline in a release body as a line break, so a body wrapped
 * at 72 columns showed as a narrow ragged column instead of filling the page.
 * List items, headings, quotes, table rows, blank lines and fenced code keep
 * their own lines.
 */
export function unwrapLines(text) {
  const out = [];
  let inFence = false;
  let joinable = false;
  for (const line of (text || '').split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      out.push(line);
      joinable = false;
    } else if (inFence || !line.trim()) {
      out.push(line);
      joinable = false;
    } else if (joinable && !BLOCK_START.test(line)) {
      out[out.length - 1] += ' ' + line.trim();
    } else {
      out.push(line);
      joinable = !/^\s*(?:#|\|)/.test(line);
    }
  }
  return out.join('\n');
}

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
      // (3) Co-author trailers are credited once, in the footer — never per commit.
      const split = splitCoAuthors(commit.body);
      out.coAuthorNames = [...split.names, ...splitCoAuthors(commit.footer).names];
      // (4) Re-flow hard-wrapped lines so the text fills the release page.
      const body = unwrapLines(split.text);
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

  // (3) One credit line for the whole release, from the commits it renders.
  // The transform has already stripped the trailers, so it hands the names on
  // as `coAuthorNames` (read from both the parsed body and footer).
  preset.writer.finalizeContext = (context, _options, filteredCommits) => {
    const names = new Set();
    for (const commit of filteredCommits || []) {
      for (const name of commit.coAuthorNames || []) if (name) names.add(name);
    }
    return { ...context, coAuthors: [...names].join(', ') };
  };
  preset.writer.footerPartial =
    preset.writer.footerPartial.replace(/\s*$/, '') +
    '\n{{#if coAuthors}}\n\nCo-authored by {{coAuthors}}.\n{{/if}}\n';

  return preset;
}
