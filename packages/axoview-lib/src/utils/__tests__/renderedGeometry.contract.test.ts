/**
 * CONTRACT — off-grid rendered geometry has exactly one composition site.
 *
 * Why this exists: ADR 0023 put a px `offset` beside the authoritative integer
 * `tile`, and every renderer / chrome / hit-test path hand-rolled
 * `getTilePosition(tile) + (offset ?? 0)` — seven of them forgot, shipping a
 * cluster of off-by-an-offset bugs (selection chrome off-centre, nodes
 * un-hoverable, a rect snapping back on drop, the wrong context menu) that the
 * data-model acceptance test could not see. Composition now lives in
 * `utils/renderedGeometry.ts`; this test greps the source so a new hand-rolled
 * one fails CI instead of shipping.
 *
 * Source-scan rather than ESLint `no-restricted-syntax` on purpose: the AST
 * can't tell a read-and-compose (`base.x + item.offset.x`) from a legitimate
 * write (`offset: CoordsUtils.add(current, residual)` in DragItems). Precedent:
 * `axoview-app/.../backendRoutes.contract.test.ts`.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../..');

// Files allowed to compose an offset by hand. Keep this list at one entry:
// every addition is a place the seven-bug failure mode can recur.
const ALLOWLIST = ['utils/renderedGeometry.ts'];

// Directories the scan skips: tests deliberately hand-roll expected geometry so
// they can assert the helper (the invariant suite would be tautological
// otherwise — see renderedGeometry.invariant.test.tsx).
const SKIP_DIRS = new Set([
  '__tests__',
  '__perf_refactor_regression__',
  '__mocks__'
]);

interface Pattern {
  name: string;
  re: RegExp;
  /** A line that MUST match — guards against a regex that silently rots. */
  positive: string;
  /** A line that must NOT match — guards against over-matching. */
  negative: string;
}

const PATTERNS: Pattern[] = [
  {
    name: 'nullish-coalesced offset read (`offset?.x ?? 0`)',
    re: /offset\?\.(x|y)\s*\?\?\s*0/,
    positive: 'const ox = item.offset?.x ?? 0;',
    negative: 'const ox = getRenderedOffset(item).x;'
  },
  {
    name: 'offset added to a projected point (`+ item.offset.x`)',
    re: /[+-]\s*[A-Za-z_$][A-Za-z0-9_$]*\.offset\.(x|y)\b/,
    positive: 'const pos = { x: base.x + node.offset.x, y: base.y };',
    negative: 'const next = CoordsUtils.add(item.offset, residual);'
  },
  {
    name: 'offset interpolated into a CSS translate (`${o.offset.x}px`)',
    re: /\{[^{}]*\.offset\.(x|y)[^{}]*\}px/,
    positive: 'transform: `translate3d(${rect.offset.x}px, 0, 0)`',
    negative: 'transform: getRenderedDragTransform(rect.offset)'
  }
];

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
};

const relative = (file: string): string =>
  path.relative(SRC_ROOT, file).split(path.sep).join('/');

describe('renderedGeometry contract — one offset composition site (ADR 0023)', () => {
  it('the helper module exists and exports the composition API', () => {
    const helper = path.join(SRC_ROOT, 'utils/renderedGeometry.ts');
    expect(fs.existsSync(helper)).toBe(true);
    const src = fs.readFileSync(helper, 'utf-8');
    for (const fn of [
      'getRenderedOffset',
      'getRenderedTilePosition',
      'getRenderedTileFootprint',
      'getRenderedAreaCorners',
      'getRenderedDragTransform',
      'footprintContainsPoint'
    ]) {
      expect(src).toContain(`export const ${fn}`);
    }
  });

  // A scan test that cannot match anything passes forever while enforcing
  // nothing. Pin each pattern against a sample of the code it must reject and a
  // sample of the refactored form it must accept.
  it.each(PATTERNS)('pattern "$name" matches what it claims', (pattern) => {
    expect(pattern.re.test(pattern.positive)).toBe(true);
    expect(pattern.re.test(pattern.negative)).toBe(false);
  });

  it('no file outside the allowlist composes an offset by hand', () => {
    const violations: string[] = [];

    for (const file of walk(SRC_ROOT)) {
      const rel = relative(file);
      if (ALLOWLIST.includes(rel)) continue;
      const lines = fs.readFileSync(file, 'utf-8').split(/\r?\n/);
      lines.forEach((line, i) => {
        for (const pattern of PATTERNS) {
          if (pattern.re.test(line)) {
            violations.push(`${rel}:${i + 1} — ${pattern.name}\n    ${line.trim()}`);
          }
        }
      });
    }

    expect(
      violations.length === 0
        ? ''
        : [
            'Hand-rolled off-grid offset composition found.',
            '',
            'An item renders at its tile projection PLUS a sub-tile px offset',
            '(ADR 0023). Composing that by hand is how seven consumers ended up',
            'drawing, framing or hit-testing items at their grid cell instead of',
            'where they are drawn. Use src/utils/renderedGeometry.ts:',
            '',
            '  getRenderedTilePosition(item, getTilePosition, origin)  — a point',
            '  getRenderedTileFootprint(item, getTilePosition, mode)   — a hit shape',
            '  getRenderedAreaCorners(from, to, offset, …)             — a rect/textbox quad',
            '  getRenderedOffset(item) / getRenderedDragTransform(o)   — a bare translate',
            '',
            'Never round an offset into a tile — it is sub-tile, and rounding it',
            'discards up to half a tile. See the ADR 0023 addendum (2026-07-23).',
            '',
            ...violations
          ].join('\n')
    ).toBe('');
  });
});
