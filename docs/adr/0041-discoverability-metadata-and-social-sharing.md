# ADR 0041 — Discoverability Metadata & Social-Sharing Contract

**Status:** Accepted
**Date:** 2026-07-10
**Supersedes:** none
**Superseded by:** none

> **Paired with:** [ADR 0040 — Marketing Landing & SPA Crawlability](0040-marketing-landing-and-spa-crawlability.md). 0040 owns *where crawlable content comes from*; this ADR owns *the metadata protocol that declares the site to crawlers and social platforms*. This contract is **independent of the URL layout** in 0040 — the tags apply to whichever document is the canonical root.

> **Implementation status (2026-07-10) — shipped in full.** The complete metadata contract below is implemented on the canonical root ([index.html](../../packages/axoview-app/public/index.html)) and mirrored onto the legal pages. The `og:url` / `canonical` / sitemap all point at `/` — the current canonical root under 0040's shipped R2 interim, so the "depends on 0040's layout" note is satisfied. Verified in a real browser: inline JSON-LD is **not** blocked by the `script-src 'self'` CSP (the one item this ADR flagged to confirm). **Accepted 2026-07-14** — the manual live-validator checks (social-card inspectors, Rich Results Test) on the public landing passed (owner-confirmed), clearing the last gate.

## Context

Axoview ships almost none of the discoverability metadata that a modern web app is expected to expose. Audited state ([index.html](../../packages/axoview-app/public/index.html), 2026-07-10):

| Lever | State | Evidence |
|---|---|---|
| `<title>` + `<meta description>` | present | [index.html:8-11,23](../../packages/axoview-app/public/index.html#L8-L23) |
| Open Graph (`og:title`/`image`/`url`/`type`/`site_name`) | **absent** | grep `og:` → 0 hits |
| Twitter Card (`twitter:card`/`title`/`image`) | **absent** | grep `twitter:` → 0 hits |
| OG share image (1200×630) | **absent** | no `*og*`/`*social*` asset in `public/` |
| `<link rel="canonical">` | **absent** | + `*.pages.dev` duplicate-content risk ([ADR 0009](0009-deployment-topology.md) §pages.dev exposure) |
| JSON-LD structured data | **absent** | no `application/ld+json` |
| `robots.txt` `Sitemap:` directive | **absent** | [robots.txt](../../packages/axoview-app/public/robots.txt) allows all but points to no sitemap |
| `sitemap.xml` | **absent** | — |

The highest-impact gap is **social sharing**: with zero `og:`/`twitter:` tags and no image, every shared `axoview.app` link renders as a bare text URL. A card with an image dramatically outperforms text-only — this is the lowest-effort, highest-ROI SEO win in the whole effort.

The duplicate-domain risk is real: `axoview.app` and `axoview.pages.dev` serve the *identical* static build ([ADR 0009](0009-deployment-topology.md) — the apex is a Pages custom domain on the same project). Without a canonical signal they compete for the same content.

## Decision

Ship the following metadata contract on the canonical root document (and mirror the head tags onto [`privacy.html`](../../packages/axoview-app/public/privacy.html) / [`terms.html`](../../packages/axoview-app/public/terms.html) with their own titles/URLs):

1. **Open Graph** — `og:type=website`, `og:site_name=Axoview`, `og:title`, `og:description`, `og:url=https://axoview.app/`, `og:image=https://axoview.app/og-image.png` (+ `og:image:width=1200`, `og:image:height=630`, `og:image:alt`).
2. **Twitter Card** — `twitter:card=summary_large_image`, `twitter:title`, `twitter:description`, `twitter:image`.
3. **Canonical** — a **hardcoded** `<link rel="canonical" href="https://axoview.app/">`. Because both domains serve the same static HTML, this self-references on `axoview.app` and points the `pages.dev` fallback back to the canonical host — resolving the duplicate-content risk with one line, no host-conditional logic (owner ratified 2026-07-10).
4. **JSON-LD structured data** — an inline `<script type="application/ld+json">` describing a `WebApplication` (name, url, description, `applicationCategory: DesignApplication`, `operatingSystem: Any`, `offers` with `price: 0` — it's free/open-source). Makes the site eligible for rich results and feeds LLM/knowledge-graph crawlers a structured description.
5. **OG image** — a branded **1200×630** PNG at `public/og-image.png` (1.91:1, the standard OG ratio — the existing 512×512 app icon is the wrong shape). Generated from the Axoview wordmark + palette (owner ratified 2026-07-10: a placeholder now, polished later).
6. **`sitemap.xml`** — a **static, hand-authored** file listing the canonical URLs (`/`, `/privacy`, `/terms`, + the editor entry per [ADR 0040](0040-marketing-landing-and-spa-crawlability.md)). Three-to-four URLs need **no build step** — avoid over-engineering a generator.
7. **`robots.txt`** — add a `Sitemap: https://axoview.app/sitemap.xml` directive (keep the allow-all posture).

The PWA [manifest.json](../../packages/axoview-app/public/manifest.json) is already correct (categories, icons, theme) — no change.

### Ripple / consequences (Phase 1.5 — reconciled)

- **Contradicts — CSP vs inline JSON-LD.** [`_headers`](../../packages/axoview-app/public/_headers#L6) sets `script-src 'self' …` with **no** `'unsafe-inline'`. An inline `<script type="application/ld+json">` is a *data block*, not executed JS, so the CSP `script-src` directive does not gate it in spec-compliant browsers — **but this must be verified in a real browser** before we rely on it (Principle 2: screenshot/DOM is truth, not theory). If it is blocked, the fallback is an external `/structured-data.json`-referencing approach or adding a hash. **Do not assume — verify.**
- **Not a contradiction — CSP `img-src` vs OG image.** CSP governs what *this page* loads, not what *external scrapers* (Slack/X/LinkedIn) fetch. The OG image is fetched by third-party crawlers directly from `axoview.app/og-image.png`; `img-src 'self'` is irrelevant to them. No CSP change needed.
- **Orphaned — sitemap ↔ robots.** A `sitemap.xml` with no `Sitemap:` line in `robots.txt` is undiscoverable. The two ship together (single sub-task), not separately.
- **Redundant?** `og:description` mirrors `<meta name="description">` — this is expected convention, not debt. Keep both; keep them in sync.
- **Depends on [ADR 0040](0040-marketing-landing-and-spa-crawlability.md):** `og:url` / `canonical` / the sitemap's primary entry all point at whatever document is the canonical root. If 0040's URL layout changes (editor at `/app`), the sitemap gains the editor entry but the canonical *root* stays the landing. The tags themselves are layout-independent; only the URL *values* track 0040.

## Consequences

**Positive:**
- Shared links render rich cards everywhere (Slack/Discord/X/LinkedIn/Facebook/iMessage) → materially higher click-through.
- Eligibility for rich results + a structured self-description for search-engine and LLM knowledge crawlers.
- The `pages.dev` duplicate-content risk is closed with one hardcoded line — no host-conditional header logic.
- Sitemap + robots directive give crawlers an explicit, complete map of the (small) site.

**Negative / risks:**
- The canonical/OG URLs are **hardcoded to `https://axoview.app/`** — if the canonical domain ever changes, these strings must be updated (low risk; the domain is stable per [ADR 0009](0009-deployment-topology.md), and it is already the single hardcoded host in the legal pages).
- The OG image and marketing copy are maintained by hand; drift from the real product is possible.
- Inline JSON-LD is a small ongoing maintenance surface (keep it consistent with `<title>`/description).

## Implementation notes (non-binding)

- All head tags live in the canonical root document (the landing per [ADR 0040](0040-marketing-landing-and-spa-crawlability.md), or `index.html` under R2). Mirror `og:`/`twitter:`/`canonical` (with per-page URLs) onto `privacy.html` / `terms.html`.
- OG image: compose the `Axo`+`view` wordmark (`#2563eb` accent) on a light ground at 1200×630; export PNG; place at `public/og-image.png`. Keep < ~200 KB.
- JSON-LD: `WebApplication` is the tightest fit (a browser-run tool); `SoftwareApplication` is an acceptable superset if a download/offer needs expressing. Include `isAccessibleForFree: true`.
- `sitemap.xml`: minimal `urlset`, `<lastmod>` optional; no `<priority>`/`<changefreq>` theatrics for a 3-URL site.
- **Verification tooling (manual, not CI):** the OpenGraph / X Card / LinkedIn Post Inspector validators for the card; Google Rich Results Test for the JSON-LD; `curl -s https://axoview.app/robots.txt` for the sitemap directive.

## Acceptance criteria

- **Manual verification:** pasting `https://axoview.app/` into Slack (or the OpenGraph validator) renders a card with the image, title, and description.
- **Manual verification:** Google Rich Results Test parses the JSON-LD with zero errors; the `WebApplication` entity is recognized.
- **Manual verification (CSP):** the inline `ld+json` block is present in the DOM and **not** blocked by CSP in a real browser (console shows no CSP violation) — the one theory that must be confirmed, not assumed.
- **Manual verification:** `view-source` on the canonical root shows exactly one `<link rel="canonical" href="https://axoview.app/">`; the same source served from `axoview.pages.dev` also points canonical at `axoview.app`.
- **Manual verification:** `robots.txt` contains the `Sitemap:` line; `sitemap.xml` validates (well-formed `urlset`) and lists every public URL.
- **Unit test:** N/A (static assets). Optionally a build-output smoke assert that `og-image.png`, `sitemap.xml`, and the `Sitemap:` line are present in `build/` (fits the C.8 "fail CI if `_headers`/`_routes.json` missing" pattern from [ADR 0009](0009-deployment-topology.md)).
