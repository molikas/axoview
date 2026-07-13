# Tactical — SEO, Marketing Landing & Social-Sharing

> **Read first:**
> - [ADR 0040 — Marketing Landing & SPA Crawlability](../adr/0040-marketing-landing-and-spa-crawlability.md)
> - [ADR 0041 — Discoverability Metadata & Social-Sharing Contract](../adr/0041-discoverability-metadata-and-social-sharing.md)
> - [ADR 0009 — Deployment Topology](../adr/0009-deployment-topology.md) (owns the URL namespace + Cloudflare routing + `*.pages.dev` exposure)
> - [ADR 0035 — Google Identity & Drive Authorization](../adr/0035-google-identity-and-drive-authorization.md) (OAuth origin model — confirm the editor relocation doesn't break sign-in)
> - [docs/workflow.md](../workflow.md) · [docs/ux-principles.md](../ux-principles.md)
>
> **Status:** Not started · **Owner:** molikas · **Last updated:** 2026-07-10
>
> This is a **short-lived working doc.** Delete it after the work merges; the ADRs are the durable record. PLAN.md gets a one-line entry referencing ADRs 0040–0041 once shipped — see "Wrap-up" below.

## Session startup checklist

1. Read this file fully.
2. Read ADRs 0040 and 0041 (and skim 0009 for the routing/pages.dev context).
3. **Ratify the open URL-layout decision** (Sub-task B0) before starting any Group-B routing work — it gates everything in Group B.
4. Skim `PLAN.md` Phase Status Dashboard **for context only** — do not modify it during this work.
5. Use `TodoWrite` to track sub-tasks below.
6. Mark `[x]` as work completes.
7. On completion, follow the "Wrap-up" section to update PLAN.md with a single line.

## Goal

Make Axoview discoverable and shareable. Two shipped outcomes: **(1)** a content-rich, crawlable, fast static marketing landing at the canonical root (distinct from the editor SPA), and **(2)** a complete discoverability-metadata contract — OG/Twitter cards + image, JSON-LD, a hardcoded canonical to `https://axoview.app/`, a sitemap, and a robots `Sitemap:` directive.

**Explicitly not a goal:** SSR/prerender framework adoption; per-locale (`hreflang`) URLs; a blog/docs site/public-diagram gallery; localizing the static landing (English-only for v1).

## Scope

### In scope
- Static marketing landing (hand-authored HTML, `privacy.html` precedent).
- SPA URL relocation + Cloudflare routing so the landing owns `/` while the editor and share links keep working (per ratified layout).
- OG + Twitter + canonical + JSON-LD head tags on the root doc, mirrored onto `privacy.html` / `terms.html`.
- 1200×630 OG image (branded placeholder).
- Static `sitemap.xml` + `robots.txt` `Sitemap:` directive.
- Real-browser CSP verification of inline JSON-LD.

### Out of scope
- SSR / prerender pipeline.
- `hreflang` / per-locale URLs (single-URL client-side i18n — N/A).
- Google Search Console account setup / ownership (owner task; we only leave the verification-meta hook if needed).
- Analytics.

## Locked decisions (from design discussion 2026-07-10)

| # | Decision |
|---|---|
| 1 | **No SSR/prerender framework** — hand-authored static landing, mirroring `privacy.html` / `terms.html`. |
| 2 | **Scope = "Full marketing surface"** — a landing *distinct from* the editor, not meta-only. |
| 3 | **Canonical = hardcoded `https://axoview.app/`** — self-references on the live domain, points the `pages.dev` fallback back. No host-conditional logic. |
| 4 | **OG image = branded placeholder, generated in-repo**, 1200×630, `public/og-image.png`. Owner swaps for a polished design later. |
| 5 | **JSON-LD type = `WebApplication`** (`SoftwareApplication` acceptable superset), `isAccessibleForFree: true`, `applicationCategory: DesignApplication`. |
| 6 | **Sitemap = static hand-authored** — no build-step generator for a 3–4 URL site. |
| 7 | **`hreflang` = out of scope** — single URL, client-side i18n. |

## Open decision (blocks Group B)

> **B0 — URL layout (owner ratifies before Group B).** See [ADR 0040 §Open decision](../adr/0040-marketing-landing-and-spa-crawlability.md#open-decision--exact-url-layout-owner-ratifies).
> - **R1 (recommended):** landing at `/`, editor relocated to `/app`, `/display/*` preserved at root.
> - **R2 (fallback):** content-in-shell at `/` (editor stays at `/`, zero link breakage, muddier UX).
>
> Group A (metadata) is **layout-independent** and can start immediately. Group B (landing + routing) is blocked on this ratification.

## Update — 2026-07-13 (R1 shipped + graceful 404 + page cohesion; not committed)

Superseding the 2026-07-10 interim below. All uncommitted; owner tests locally.

- **R1 ratified + shipped** (editor → `/app`, landing = indexed root `/`). Mechanism: SPA emitted as `app.html` (renamed rsbuild entry), router basename `/app` ([appBase.ts](../../packages/axoview-app/src/appBase.ts)), assets at `/static`; app shell ([app-shell.html](../../packages/axoview-app/app-shell.html)) is `noindex`. Routing: [`_redirects`](../../packages/axoview-app/public/_redirects) + [nginx.conf](../../nginx.conf) + rsbuild dev fallback (`/`→landing, `/app/*`→SPA, `/display/*`→301→`/app/display/*`, unknown→404). Share URLs carry `/app`; editor top-left brand links home; e2e navigates to `/app`. The R2 content-in-shell + `/landing` preview were **removed**. See [ADR 0040](../adr/0040-marketing-landing-and-spa-crawlability.md) (now Accepted).
- **Graceful 404** (fixes the "unknown URL spins forever" bug): React catch-all `<Route path="*">` → [NotFound](../../packages/axoview-app/src/components/NotFound.tsx) (clears the splash via shared [bootScreen.ts](../../packages/axoview-app/src/utils/bootScreen.ts)) + static [404.html](../../packages/axoview-app/public/404.html). Also fixed a pre-existing nginx bug where `/privacy` fell through to the SPA.
- **Page cohesion**: shared [site.css](../../packages/axoview-app/public/site.css) design system across landing + legal + 404 (they were separate stylesheets → "looked like a different website"). Fixed the nav-button contrast (a `.nav-links a` rule out-specified `.btn-primary`, greying the label). Added a hero SVG illustration + consistent SVG feature icons.
- **Local preview**: [scripts/preview-r1.mjs](../../packages/axoview-app/scripts/preview-r1.mjs) (`npm run preview:r1`) serves `build/` like Cloudflare Pages so the R1 routing is testable without a deploy.

**Verified locally:** `tsc` clean · 202/202 app tests (shareUrl expectations updated to `/app`) · production build clean · **dev server** serves `/`→landing + `/app`→editor · **preview-r1 + Playwright** confirmed the full flow: landing at `/`, editor **boots** at `/app` (splash clears, no CSP errors, logo→home), `/display/*`→301, legal cohesion, unknown→real 404.

**Needs a Pages preview deploy to confirm** (can't be reproduced by `npm run dev`): Cloudflare clean-URL + `_redirects` precedence, OAuth sign-in from `/app` (host-level origin — expected fine), and the real 404 status on Cloudflare (`not_found_handling` interaction).

## Implementation log — 2026-07-10 (first pass, superseded by the 2026-07-13 update above)

**Shipped (safe subset — no routing surgery, zero e2e/build/share-link impact):**
- **All of Group A** — OG/Twitter/canonical/JSON-LD in [index.html](../../packages/axoview-app/public/index.html), OG image, sitemap, robots, mirrored tags on privacy/terms. See checkboxes below.
- **Content-in-shell crawlable landing (R2 mechanism)** — a styled, semantic `#ax-landing` block in `index.html` gives non-JS crawlers/scrapers a real page at the canonical root; it sits behind the opaque splash (so JS users never see it) and is removed on editor mount ([App.tsx](../../packages/axoview-app/src/App.tsx) splash-removal effect). A `<noscript>` hides the splash so no-JS users get the landing instead of an infinite spinner.
- **Standalone marketing page** — [landing.html](../../packages/axoview-app/public/landing.html) at `/landing`, shipped **`noindex`** as a reviewable *preview of the future root* (drops noindex when promoted to `/` under R1). Not linked from the app; not in the sitemap.
- **OG image generator** — [scripts/generate-og-image.mjs](../../packages/axoview-app/scripts/generate-og-image.mjs) (Playwright → 1200×630 PNG).

**Verified locally:** `tsc` clean · 202/202 app tests pass · production build clean, all 8 public assets emitted to `build/` · Playwright drive of the built app confirmed **(a)** raw HTML at `/` carries canonical+og+JSON-LD+crawlable copy, **(b)** `#ax-landing` is removed once the editor mounts, **(c)** **no CSP violation — inline JSON-LD is not blocked by `script-src 'self'`** (the one "verify, don't assume" item — confirmed clean), **(d)** `/landing` renders with CTA→`/` and noindex.

**Deferred (needs owner ratification — B0):** the R1 editor relocation (`/`→landing, editor→`/app`). Blast radius is large and not locally testable without a Pages deploy: rsbuild multi-entry, router basename, `shareUrlFromUuid` `/app` prefix, **the whole e2e suite (`goto('/')` × 16 specs)**, `_redirects`, self-host nginx. The content-in-shell interim delivers the SEO content-at-root win **now**; the human-facing funnel at `/` is the ratify-then-implement step. `landing.html` is the content that will populate it — no rework lost.

**Still TODO (owner / manual):** Lighthouse run, live social-card + Rich-Results validators (need a public URL), Search Console verification, and the R1 flip.

## Sub-tasks

### A. Metadata & social contract (ADR 0041 — no layout dependency, ship first) — ✅ DONE 2026-07-10
- [x] Add OG tags (`og:type/site_name/title/description/url/image` + `image:width/height/alt`) to the root doc's `<head>`.
- [x] Add Twitter Card tags (`summary_large_image` + title/description/image).
- [x] Add hardcoded `<link rel="canonical" href="https://axoview.app/">`.
- [x] Add inline `<script type="application/ld+json">` `WebApplication` block.
- [x] **Verify in a real browser** that the inline `ld+json` is not blocked by the `script-src 'self'` CSP — **CONFIRMED clean** (Playwright drive of the built app, no CSP console violation).
- [x] Generate `public/og-image.png` (1200×630, wordmark + palette, 159 KB).
- [x] Mirror `og:`/`twitter:`/`canonical` onto `privacy.html` + `terms.html` with their own per-page URLs/titles.
- [x] Author static `public/sitemap.xml` (canonical URLs; well-formed `urlset`).
- [x] Add `Sitemap: https://axoview.app/sitemap.xml` to `robots.txt`.
- [x] Confirm build emits `og-image.png`, `sitemap.xml`, updated `robots.txt` into `build/` (verified — all 8 assets present).

### B. Marketing landing & routing (ADR 0040 — gated on B0)
- [~] **B0 — owner ratifies URL layout (R1 vs R2).** Interim: R2 content-in-shell shipped; R1 relocation deferred to ratification.
- [x] Author `public/landing.html` — hero, feature grid, CTA → editor, footer, inline CSS, brand palette. **Shipped as `/landing` (noindex preview).**
- [ ] rsbuild: second HTML entry (or SPA emitted under `/app`); preserve `assetPrefix` ([rsbuild.config.ts:22-27](../../packages/axoview-app/rsbuild.config.ts#L22-L27)).
- [ ] Move editor routes under `/app` basename ([App.tsx:93-98](../../packages/axoview-app/src/App.tsx#L93-L98)); keep `/display/*` reachable at root.
- [ ] Add `_redirects` (or extend routing) so `/` → landing, `/app/*` + `/display/*` → SPA shell (200), legal pages untouched; `_routes.json` still scopes Functions to `/api/*`.
- [ ] **Verify** OAuth sign-in still works from the relocated editor entry (host-level origin, [ADR 0035](../adr/0035-google-identity-and-drive-authorization.md)) — confirm, don't assume.
- [ ] **Verify** existing `/display/p/<uuid>` + `/display/<id>` share links resolve (no 404 on hard refresh).
- [ ] Reconcile the landing CTA vs [EmptyStateScreen](../../packages/axoview-app/src/components/EmptyStateScreen.tsx) — landing = convince, empty state = create/import; no duplicated New/Import.
- [ ] Add the editor entry to `sitemap.xml`; canonical root stays the landing.

### C. Verification & wrap
- [ ] Lighthouse SEO ≥ 95 + Core Web Vitals pass on the landing (cold load).
- [ ] Social-card validators (OpenGraph / X / LinkedIn) render the card — manual, not CI.
- [ ] Google Rich Results Test parses the JSON-LD cleanly — manual.
- [ ] Record the finalized Cloudflare routing map as a dated **addendum to [ADR 0009](../adr/0009-deployment-topology.md)** (0009 owns the URL namespace) — one addendum, not new prose in 0040.
- [ ] Flip ADRs 0040 + 0041 `Status: Proposed → Accepted` once shipped + browser-verified.

## Wrap-up

When all sub-tasks are complete and verification passes:

1. Add a single line under the relevant `PLAN.md` phase section:
   ```
   - SEO / marketing landing + social-sharing metadata shipped — see docs/adr/0040–0041 and (this file's git history).
   ```
2. Delete this file. The ADRs are the durable record; this checklist's job is done.
3. Update the memory pointer if one exists (a new `seo-marketing-landing` memory, or fold into the deployment/domain memory).

## Notes for Claude

- **Two packages? No — mostly `axoview-app` static assets + one routing change.** But it touches the **deploy contract** ([ADR 0009](../adr/0009-deployment-topology.md)): the Cloudflare routing map and `pages.dev` behavior. Smoke-test a real Pages preview deploy, not just a local build.
- **All social/JSON-LD/CSP claims need a real-browser + real-scraper check.** jsdom/unit tests cannot render a social card or evaluate CSP. Verify with the live validators and `view-source` (Principle 2).
- **Order matters:** Group A ships value immediately and is layout-independent — do it first, even before B0 is ratified. Group B is blocked on B0.
- **Don't break share links.** `/display/*` compat is the load-bearing constraint of the R1 layout — every routing change must preserve it.
- **Don't localize the landing yet** (out of scope) and **don't scaffold hreflang** (N/A for single-URL i18n).
- **The OG image is a placeholder by decision** — generate a clean branded one, don't gold-plate; the owner replaces it later.
