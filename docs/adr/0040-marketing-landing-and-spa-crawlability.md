# ADR 0040 — Marketing Landing & SPA Crawlability

**Status:** Accepted
**Date:** 2026-07-10
**Supersedes:** none
**Superseded by:** none

> **Paired with:** [ADR 0041 — Discoverability Metadata & Social-Sharing Contract](0041-discoverability-metadata-and-social-sharing.md). This ADR owns *where crawlable content comes from* (rendering / URL layout); 0041 owns *what tags declare the site* (metadata protocol). Read both together.

> **Implementation status (2026-07-13) — R1 ratified + shipped.** The owner ratified R1 (editor → `/app`) on 2026-07-13 and it is **implemented**. Mechanism (no PUBLIC_URL asset surgery): the SPA is emitted as **`app.html`** via a renamed rsbuild entry ([rsbuild.config.ts](../../packages/axoview-app/rsbuild.config.ts)) served at `/app`, with the router **basename `/app`** ([appBase.ts](../../packages/axoview-app/src/appBase.ts)) decoupled from `assetPrefix` (assets stay at `/static`). The marketing landing is the static, indexed **root `index.html`** ([public/index.html](../../packages/axoview-app/public/index.html)); the app shell ([app-shell.html](../../packages/axoview-app/app-shell.html)) is `noindex`. Routing via [`_redirects`](../../packages/axoview-app/public/_redirects) + [nginx.conf](../../nginx.conf) + an rsbuild dev fallback: `/`→landing, `/app` + `/app/*`→SPA, legacy `/display/*`→301→`/app/display/*`, unknown→`/404.html`. Share URLs carry `/app` ([shareUrl.ts](../../packages/axoview-app/src/utils/shareUrl.ts)); the editor's top-left brand links home; the e2e suite navigates to `/app`. The interim R2 content-in-shell + `/landing` preview were **removed** (the real landing at `/` supersedes them). **Verified locally** (dev server + a production build behind a Cloudflare-emulating preview, [scripts/preview-r1.mjs](../../packages/axoview-app/scripts/preview-r1.mjs)); **still needs a Pages preview deploy** to confirm Cloudflare's clean-URL + `_redirects` precedence, OAuth from `/app` (host-level origin, expected fine), and the real 404 status.

## Context

Axoview is a client-rendered React SPA served from Cloudflare Pages ([ADR 0009](0009-deployment-topology.md)). Its entire crawlable surface today is three URLs — `/` (the editor), [`/privacy`](../../packages/axoview-app/public/privacy.html), [`/terms`](../../packages/axoview-app/public/terms.html). There is no blog, docs site, or public-diagram gallery, so "SEO" here is **not** mass indexing. It is three things: rich social-sharing cards, branded + category discovery ("isometric diagram tool", "FossFLOW alternative"), and giving non-JS crawlers something to read.

The rendering problem this ADR resolves: **the crawlable HTML body is empty.** At parse time `#root` is empty — [index.html:81](../../packages/axoview-app/public/index.html#L81) ships only a decorative splash and a `<noscript>`. The content that eventually renders — [EmptyStateScreen](../../packages/axoview-app/src/components/EmptyStateScreen.tsx) — is two icon-cards ("New diagram" / "Import") with **no `<h1>` and no descriptive copy**. Googlebot executes JS and would eventually see those cards, but (a) they say nothing about what Axoview *is*, and (b) Bing, DuckDuckGo, social scrapers (Slack/Discord/X/LinkedIn/Facebook) and LLM crawlers largely **do not execute JS** — they read the raw HTML and find nothing.

Metadata alone (ADR 0041) cannot fix this: perfect `og:` tags won't help a category search or a non-JS scraper if the DOM carries no descriptive text. The owner ratified (2026-07-10) the **"Full marketing surface"** scope — a content-rich crawlable landing *distinct from the editor*, not merely meta enrichment.

The constraint is the project ethos: **no SSR framework.** Axoview ships static assets + a Hono Worker for `/api/*` ([ADR 0009](0009-deployment-topology.md)); adopting Next/Astro/remix-style SSR is an unjustified rebuild. The precedent already in the repo is [`privacy.html`](../../packages/axoview-app/public/privacy.html) / [`terms.html`](../../packages/axoview-app/public/terms.html): **hand-authored static HTML pages with inline styles, no framework, fully crawlable, fast.** A marketing landing is the same shape.

## Decision

**Static-first, no SSR. Ship a hand-authored static marketing landing as the crawlable root, following the `privacy.html` / `terms.html` precedent. The editor SPA is a distinct surface.**

Concretely:

1. **No SSR / no prerender pipeline.** The landing is authored HTML (semantic `<h1>`/`<h2>`, feature copy, CTA), not a React render snapshot. It carries its own inline critical CSS and loads no editor bundle. This mirrors the two existing static legal pages exactly.
2. **The landing is the content-rich root; the editor is a distinct entry.** The strongest URL (`/`, where domain authority concentrates) serves marketing content; the heavy editor SPA is reached via a primary CTA ("Open Axoview →").
3. **Canonical domain is `https://axoview.app/`** — hardcoded, resolving the `*.pages.dev` duplicate-content risk. The mechanics live in [ADR 0041](0041-discoverability-metadata-and-social-sharing.md) (this ADR only notes that the landing must self-declare the canonical host).

### URL layout — RESOLVED 2026-07-13: R1 ratified + shipped

> **RESOLVED (2026-07-13):** the owner ratified **R1** (`/app` path over a subdomain). See the *Implementation status* callout at the top for the shipped mechanism. The alternatives are retained below only as the record of what was considered. One refinement vs. the original R1 sketch: legacy `/display/*` links are **301-redirected** to `/app/display/*` (rather than dual-served at root), so there is a single canonical location for share routes.

- **R1 (shipped) — landing at `/`, editor at `/app`.** Strongest SEO (content at the root). The SPA mounts under an `/app` basename ([appBase.ts](../../packages/axoview-app/src/appBase.ts)); the SPA HTML is emitted as `app.html` (renamed rsbuild entry), assets stay at `/static`. Routing (`_redirects` + nginx): `/`→landing, `/app` + `/app/*`→SPA, `/display/*`→301→`/app/display/*`, unknown→404. Cost accepted: bookmarks to `axoview.app/` now show the landing (returning users click "Open Axoview" or use the bookmarked `/app`).
- **R2 (rejected) — content-in-shell at `/`.** The editor stays at `/`; `index.html` carries crawlable marketing HTML that React removes on mount. Zero link/route breakage, but the editor bundle loads on the landing, the content flashes then is replaced, and it is not truly "distinct from the editor." Shipped briefly (2026-07-10) as a safe interim, then removed when R1 landed.
- **Subdomain (`app.axoview.app`) — rejected.** Needs separate DNS + Pages routing + OAuth origin for no gain on a single-project deploy.

### Ripple / consequences (Phase 1.5 — reconciled)

- **Redundant?** The landing's "Open Axoview" CTA and the in-app [EmptyStateScreen](../../packages/axoview-app/src/components/EmptyStateScreen.tsx) "New / Import" cards are **not** redundant — they do different jobs: the landing *convinces + explains* (marketing), the empty state *creates the first diagram* (tooling). Reconciled: the landing does **not** duplicate New/Import; it links into the app, which then shows the empty state. Keep both.
- **Contradicts?** R1 moves the editor off `/`, contradicting the current [App.tsx:95](../../packages/axoview-app/src/App.tsx#L95) `/` → `EditorPage` route and any bookmark/deep-link assuming `/` = app. Reconciled by preserving `/display/*` at root (share links) and providing a prominent CTA; the residual cost (bookmarks to `/`) is accepted and listed below.
- **Orphaned surfaces — grepped:** the `_routes.json` this leans on **exists** ([_routes.json](../../packages/axoview-app/public/_routes.json), scopes Functions to `/api/*`); a `_redirects` file does **not** exist yet (build dependency, not an assumption). OAuth is **host-level** (runtime-origin token model, [ADR 0035](0035-google-identity-and-drive-authorization.md)), so an `/app` path does not change the authorized JS origin (`axoview.app`) — **verify at implementation, do not assume.** The `basename` is already `publicUrl`-derived ([App.tsx:51](../../packages/axoview-app/src/App.tsx#L51)), so relocation is a config change, not a rewrite.
- **Out of scope (explicit):** `hreflang` / per-locale URLs. The app localizes client-side on a single URL (13 locales), so there are no per-locale URLs to declare. Nobody should scaffold hreflang.

## Consequences

**Positive:**
- Non-JS crawlers and social scrapers get a real, content-rich HTML document at the canonical root.
- The marketing landing loads with zero editor-bundle weight → excellent LCP / Core Web Vitals on the indexed page (a ranking positive).
- Reuses an in-repo, proven pattern (static hand-authored pages) — no new framework, no build complexity beyond a second HTML entry.
- Clean separation: the SEO target (static landing) and the app (SPA) evolve independently.

**Negative / risks:**
- R1 relocates the editor off `/` — bookmarks/links to `axoview.app/` now land on marketing (mitigated by a prominent CTA; `/display/*` share links preserved).
- Two HTML entry points means the rsbuild config and Cloudflare routing map must stay coherent (a `_redirects` / `_routes.json` regression silently breaks either the landing or the app).
- Hand-authored marketing copy must be kept in sync with the product manually (no single-source-of-truth with the app's feature set).
- The landing is English-only initially (the app's i18n does not extend to static HTML); localizing it later is a separate effort.

## Implementation notes (non-binding)

- **Landing file:** `packages/axoview-app/public/landing.html` (or emit `/` directly), inline critical CSS in the `privacy.html` style, semantic headings, a hero, a short feature grid, and one primary CTA to the editor. Reuse the existing palette (`#2563eb` accent, `#0ea5e9` sky) and the `Axo`+`view` wordmark from the splash.
- **rsbuild:** either a second HTML entry (rsbuild multi-page) or keep the SPA's `index.html` emitted under `/app` and drop the static landing at root as a `public/` asset. Preserve `assetPrefix` behavior ([rsbuild.config.ts:22-27](../../packages/axoview-app/rsbuild.config.ts#L22-L27)).
- **Cloudflare routing:** add a `_redirects` (or extend `_routes.json` semantics) so `/` → landing, `/app/*` + `/display/*` → SPA shell (200 rewrite), legal pages untouched. `_routes.json` still scopes Functions to `/api/*` only.
- **Router:** move the editor routes under an `/app` basename in [App.tsx:93-98](../../packages/axoview-app/src/App.tsx#L93-L98); keep `/display/*` reachable at root (either a second `<Routes>` root or a Cloudflare rewrite to the same SPA shell).
- Once the routing map is finalized, record it as a dated **addendum to [ADR 0009](0009-deployment-topology.md)** (which owns the URL namespace + Cloudflare routing) — not as new prose here.

## Acceptance criteria

- **Manual verification:** `curl https://axoview.app/` returns HTML containing a descriptive `<h1>` and feature copy **without** executing JS (i.e., `view-source` is content-rich, not an empty `#root`).
- **Manual verification:** the editor is reachable from the landing via the CTA; a returning-user path into the editor works; existing `/display/p/<uuid>` and `/display/<id>` share links still resolve (no 404 on hard refresh).
- **Manual verification:** OAuth sign-in still succeeds from the relocated editor entry (host-level origin unchanged).
- **Lighthouse:** the landing scores ≥ 95 on the SEO category and passes Core Web Vitals (LCP/CLS) on a cold load.
- **Unit test:** N/A for static HTML; if the SPA basename/routing changes, add/adjust a routing test asserting the editor mounts under `/app` and `/display/*` still resolves.
