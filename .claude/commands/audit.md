# /audit — Axoview Quality & Architecture Audit

Run a comprehensive static analysis, coverage evaluation, security audit, and architecture review of the Axoview monorepo. Produces an executive-level report. Does NOT run E2E tests.

> **UX consistency check:** when reviewing UI code, flag deviations from [`docs/guidelines/ux-principles.md`](../../docs/guidelines/ux-principles.md) — the Axoview design language. Inline `Typography` headers instead of `Section`, ALL CAPS labels, opacity-0 affordances, missing F2/Enter/Escape, etc. should appear in the audit report under "UX consistency."
>
> **Process consistency check:** when the audit task touches session cadence (skill alignment, milestone gates, post-rename pointer hygiene, naming consistency across surfaces), read [`docs/workflow.md`](../../docs/workflow.md) first. Deviations from its locked decision table or design principles belong in the audit report.

## Phase 1 — Static Code Analysis

Run the following in sequence, capturing all output:

```bash
# ESLint only (separate from tsc to isolate rule violations)
cd packages/axoview-lib && npx eslint src --ext .ts,.tsx --format stylish 2>&1

# TypeScript strict type check (catches what ESLint misses)
npm run lint 2>&1

# Prettier compliance
cd packages/axoview-lib && npx prettier --check "src/**/*.{ts,tsx}" 2>&1 | tail -5
```

**Metrics to extract:**
- ESLint: total errors, total warnings, breakdown by rule (`no-explicit-any`, `no-unused-vars`, `exhaustive-deps`)
- TypeScript: total error count, which files, which categories (type mismatch vs missing props)
- Prettier: number of non-compliant files
- Count `any` usages in production source: `grep -rn ": any" src --include="*.ts" --include="*.tsx" | grep -v ".test." | wc -l`
- Count suppressions: `grep -rn "@ts-ignore\|@ts-nocheck" src | wc -l`

## Phase 2 — Security & Dependency Audit

```bash
npm audit --workspaces 2>&1
```

**Metrics to extract:**
- Vulnerability count by severity: critical / high / moderate / low
- Which packages, CVE IDs, and whether a fix is available
- Whether fix requires breaking changes

## Phase 3 — Test Coverage

```bash
cd packages/axoview-lib && npx jest --coverage --passWithNoTests 2>&1
```

**Metrics to extract from the coverage table:**
- Overall: Statements / Branches / Functions / Lines % (target: ≥70%)
- Per-module breakdown — flag any module at 0% (completely untested)
- Critically flag: branch coverage on state management stores and core math utilities
- Cross-check: TypeScript errors in test files indicate stale tests that pass but test wrong schemas

## Phase 4 — Build Verification

```bash
# Library build
cd packages/axoview-lib && npm run build 2>&1 | tail -20

# App build
cd packages/axoview-app && npm run build 2>&1 | tail -30
```

**Metrics to extract:**
- Build success/failure and any warnings
- Library bundle: size in KB, output formats (CJS only = no tree-shaking for consumers)
- App chunks: flag any chunk >1MB uncompressed; flag main entry >500KB gzip
- Check for `"type": "module"` warnings (rslib perf overhead)

## Phase 5 — Architecture Review

Explore and read the following, then assess each dimension:

```bash
# File size inventory — God file detection
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l | sort -rn | head -25

# Circular dependency check
npx madge --circular src/index.ts 2>&1

# Memoization coverage
grep -rn "React.memo\|useMemo\|useCallback" src --include="*.tsx" --include="*.ts" | grep -v ".test." | wc -l

# Store structure
ls packages/axoview-lib/src/stores/
ls packages/axoview-lib/src/hooks/
```

Also read:
- [`docs/guidelines/architecture.md`](../../docs/guidelines/architecture.md) (header + Section 1 inventory)
- `packages/axoview-lib/src/index.ts` — public API surface
- `packages/axoview-lib/src/standaloneExports.ts` — secondary exports
- `packages/axoview-lib/src/stores/sceneStore.tsx` — undo/redo architecture
- `packages/axoview-app/src/App.tsx` — app entry complexity

**Dimensions to assess (score each A–F):**

| Dimension | Key Questions |
|-----------|---------------|
| Modularity & Coupling | Circular deps? God files? Clean public API? Fan-in/fan-out? |
| Fragility & Ease of Change | How many files change per new feature? Are seams clean post-refactor? |
| Maintainability | Dead code? Config sprawl? Consistent patterns? |
| Vibe Coding / AI-Friendliness | Clear naming? Colocation? Type completeness? Formatting consistency? |
| State Architecture | Store count/split? Undo/redo soundness? Derived vs stored state? |
| Performance Architecture | Bundle formats? Lazy loading? Memoization? Large chunks? **Drag hot-path anti-patterns (Phase 5c)?** |

## Phase 5b — UX Guideline Compliance

Run grep checks against [`docs/guidelines/ux-principles.md`](../../docs/guidelines/ux-principles.md). Each finding is a deviation; report under "UX consistency" in the executive report.

```bash
# §1.5 — inline fontSize on Typography (drift; theme owns it)
grep -rn "fontSize:" packages/axoview-lib/src packages/axoview-app/src \
  --include="*.tsx" | grep -v "__tests__\|theme\.ts\|test\.tsx"

# §1.5 — inline fontWeight on Typography (drift outside content emphasis)
grep -rn "fontWeight={\|fontWeight: " packages/axoview-lib/src packages/axoview-app/src \
  --include="*.tsx" | grep -v "__tests__\|theme\.ts\|test\.tsx"

# §1.2 / §7.2 — manual textTransform: uppercase (use overline variant; sentence case)
grep -rn "textTransform: 'uppercase'\|textTransform=\"uppercase\"" \
  packages/axoview-lib/src packages/axoview-app/src --include="*.tsx" \
  --include="*.ts" | grep -v "__tests__\|theme\.ts"

# §1.2 / §7.2 — string literals that look ALL-CAPS in JSX/render
# (pattern: a single-word ALL-CAPS string passed as Typography children)
grep -rEn '>[A-Z]{4,}<' packages/axoview-lib/src packages/axoview-app/src \
  --include="*.tsx" | grep -v "__tests__\|test\.tsx"

# §1.3 — TextField with floating MUI label= prop (placeholder doing label's job)
grep -rEn '<TextField[^>]*\blabel=' packages/axoview-lib/src packages/axoview-app/src \
  --include="*.tsx" | grep -v "__tests__"

# §6.3 — console.error in user-facing paths (should also surface via setNotification)
grep -rn "console\.error" packages/axoview-lib/src packages/axoview-app/src \
  --include="*.ts" --include="*.tsx" | grep -v "__tests__\|test\.tsx"

# React/MUI gotcha — createPortal() returns a ReactPortal whose $$typeof is
# react.portal, not react.element. MUI's PropTypes.node check on Box / Stack /
# Typography rejects it in dev (`Invalid prop children supplied to
# ForwardRef(Box)`). Manually review each hit: if the call sits inside a MUI
# container's children, hoist it to a sibling.
grep -rn "createPortal" packages/axoview-lib/src packages/axoview-app/src \
  --include="*.tsx" | grep -v "__tests__\|test\.tsx"

# §6.4 — cold-start splash must exist in the app shell. 0 hits = regression.
grep -c 'id="ax-splash"' packages/axoview-app/public/index.html
```

**How to interpret findings:**

| Pattern | Severity | Action |
|---|---|---|
| `fontSize` on Typography sx | High — drift | Replace with the appropriate variant. If no variant fits, propose adding to theme.ts. |
| `fontWeight` on Typography sx | Medium | Allowed only for content emphasis (e.g. bolding a single value); never for headers/labels. |
| `textTransform: 'uppercase'` | High | Replace with `overline` variant (sentence case + tracked in our theme) or fix the source string. |
| `<TextField label="…">` | Medium | Replace with external `Section`/`caption` label + `placeholder=`. |
| ALL-CAPS literal in JSX | Medium | Convert to sentence case unless it's a vendor TLA (AWS/GCP/DNS) or a chip-style mode badge. |
| `console.error` without `setNotification` for user-triggered failure | Medium | Add a notification with severity:'error' summarising the issue. |
| `createPortal(...)` inside a MUI container's children | Medium | Dev-only warning; hoist the portal to be a sibling of the MUI container (it renders into its target node regardless of JSX position). The `UiOverlay` fix is the reference pattern — `git log -S createPortal -- packages/axoview-lib/src` to find it. |
| `id="ax-splash"` missing from `public/index.html` (count = 0) | High | Cold-start splash was removed — restore from UX §6.4. Without it the app shows a white screen during bundle parse + storage probes (~1–4 s). |

The audit report must include a **UX Consistency** subsection: count of findings per pattern, top 3 offending files, and whether any high-severity violations exist (any high-severity violation downgrades the maintainability score by one letter grade).

## Phase 5c — Performance & Hot-Path Anti-Pattern Audit

Run grep checks against the anti-patterns codified in [`docs/guidelines/perf-troubleshooting.md`](../../docs/guidelines/perf-troubleshooting.md). Each finding is a potential regression or a candidate for future perf work; report under "Performance hot-path" in the executive report.

```bash
# A-1 — useScene() inside SceneLayers (drag-hot-path components should use
# useSceneActions or narrow useSceneStore selectors instead)
grep -rn "useScene()" packages/axoview-lib/src/components/SceneLayers \
  --include="*.tsx" | grep -v "__tests__\|test\.tsx"

# A-2 — nested immer produce() inside reducers (the cliff fuel)
# Flag any reducer file with > 1 produce() call (likely chain pattern)
for f in packages/axoview-lib/src/stores/reducers/*.ts; do
  c=$(grep -c "produce(" "$f")
  if [ "$c" -gt 1 ]; then echo "  $f: $c produce() calls"; fi
done

# A-3 — inline sx object literals on hot-path render functions
# Hard to catch generically; flag any SceneLayers component with > 5 sx={{ ... }}
grep -rcE "sx=\{\{" packages/axoview-lib/src/components/SceneLayers \
  --include="*.tsx" | grep -v ":0$\|test\.tsx" | awk -F: '$2 > 5 {print}'

# A-4 — multiple writers to scene.connectors[id] / view.items[].tile
# in the same module — race-prone. Manual review of any new such writer.
grep -rn "scene\.connectors\[\|previewConnectorPaths\|batchUpdateViewItemTiles" \
  packages/axoview-lib/src --include="*.ts" --include="*.tsx" | \
  grep -v "__tests__\|test\.tsx\|\.test\.\|hooks/useSceneActions"

# A-5 — flushSync usage (should be rare and justified)
grep -rn "flushSync" packages/axoview-lib/src \
  --include="*.ts" --include="*.tsx" | grep -v "__tests__"

# A-6 — stray console.log / console.warn in production source
# (excludes our intentional render probe + DiagnosticsOverlay)
grep -rn "console\.\(log\|warn\|debug\)" packages/axoview-lib/src packages/axoview-app/src \
  --include="*.ts" --include="*.tsx" | grep -v "__tests__\|\.test\.\|test\.tsx\|renderProbe\.ts\|DiagnosticsOverlay\.tsx"
```

**How to interpret findings:**

| Pattern | Severity | Action |
|---|---|---|
| `useScene()` in `SceneLayers/` | High | Replace with `useSceneActions()` or narrow `useSceneStore(selector, ===)`. See A-1 in perf-troubleshooting. |
| Reducer file with multiple `produce()` calls | Medium | Likely a nested reducer chain. Acceptable for one-shot user actions; flag if called from a per-frame handler (drag mousemove, etc.). |
| `SceneLayers/` component with > 5 inline `sx={{ ... }}` | Medium | Hoist static sx to module-level constants; inline-style dynamic per-frame values. See A-3. |
| New writer to `scene.connectors[...].path` outside `useSceneActions` | High | Multiple writers WILL race within one frame. Collapse to one source of truth. See A-4. |
| `flushSync` outside `previewConnectorPaths` | High | Defeats React batching. Justify in a comment or remove. See A-5. |
| Stray `console.*` in production source | High | Strip before commit. See A-6. |

The audit report must include a **Performance hot-path** subsection: count of findings per pattern (A-1 through A-6), top 3 offending files per pattern, and whether any high-severity violations exist (any high-severity violation downgrades the Performance Architecture score by one letter grade).

## Phase 5d — Whole-experience coherence & orphan detection

Static greps catch drift; this pass catches **incoherence** — controls with no consumer, affordances that contradict each other, and surfaces referenced but never built (workflow.md Principle 7). Report under "Experience coherence" in the executive report.

```bash
# Settings / toggles whose state is never read in a hot path or handler
# (a persisted setting with no consumer is a dead control). Manual review:
# for each setting key, grep its read sites.
grep -rn "panSettings\.\|\.settings\." packages/axoview-lib/src packages/axoview-app/src \
  --include="*.ts" --include="*.tsx" | grep -v "__tests__\|test\.tsx"

# Components referenced in docs/PLAN but absent from the tree (phantom surfaces)
# e.g. a "context menu" commands are routed into. Cross-check PLAN.md's snapshot
# against the actual component dirs.
ls packages/axoview-lib/src/components/

# Two affordances bound to the same gesture (contradiction smell) — manual review
# of every gesture (left/right/double-click, long-press) for a single owner.
grep -rn "onContextMenu\|onDoubleClick\|onClick" packages/axoview-lib/src/interaction \
  --include="*.ts" --include="*.tsx"
```

**How to interpret findings:**

| Pattern | Severity | Action |
|---|---|---|
| Persisted setting with no read site | High | Dead control — remove it or wire it. A toggle that does nothing is a UX lie. |
| A command/affordance routed to a surface not in the tree | High | Phantom dependency — either build the surface or re-home the command before the work is "planned." |
| One gesture with two owners | High | Contradiction — reconcile to a single owner (e.g. right-click = pan **or** menu, with a tap/drag split, not both ambiguously). |
| A control whose sibling was removed/changed, leaving it stranded | Medium | Reconcile the mirror (selection sync §4.1, item-type parity §5). |

The audit report must include an **Experience coherence** subsection: list any orphaned controls, phantom surfaces, and gesture contradictions found (any high-severity item downgrades the Fragility/Ease-of-Change score by one letter grade).

## Phase 6 — Executive Report

Synthesize all findings into a report with this structure:

1. **Executive Summary** — health scorecard table (A–F per dimension)
2. **Critical Findings** — numbered, must-fix before next release
3. **Quality Metrics Dashboard** — all numeric scores in one table with thresholds
4. **Coverage Deep Dive** — well-tested vs zero-coverage modules
5. **Architecture Assessment** — per-dimension narrative with file path evidence
6. **UX Consistency** — Phase 5b findings: count per pattern, top offending files, high-severity violations
7. **Performance hot-path** — Phase 5c findings: count per A-1..A-6 pattern, top offending files, high-severity violations
8. **Experience coherence** — Phase 5d findings: orphaned controls, phantom surfaces, gesture contradictions
9. **Risk Register** — top risks ranked by Likelihood × Impact
10. **Recommendations** — P1 (immediate) / P2 (next sprint) / P3 (quarterly) backlog
11. **Positive Highlights** — what is working well

## Reference Thresholds

| Metric | Minimum Acceptable | Target |
|--------|-------------------|--------|
| Statement coverage | 50% | 70%+ |
| Branch coverage | 50% | 70%+ |
| ESLint errors | 0 | 0 |
| npm audit HIGH/CRITICAL | 0 | 0 |
| Lib bundle (gzip) | <1MB | <500KB |
| App entry chunk (gzip) | <500KB | <200KB |
| God files (>400 lines) | Documented | 0 |
| Circular dependencies | 0 | 0 |
| Prettier violations | 0 | 0 |
| @ts-ignore suppressions | <5 | 0 |
| Hot-path `useScene()` in `SceneLayers/` | 0 | 0 |
| Stray `console.log` in production source | 0 | 0 |
