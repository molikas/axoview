# Axoview

**Beautiful isometric & 2D diagrams, right in your browser.**

## ▶ [Open Axoview → axoview.app](https://axoview.app)

Free and open-source. No install, no sign-up. The hosted app at **[axoview.app](https://axoview.app)** is the production deployment — built from `master`, always running the latest release.

Axoview is a diagramming tool for cloud architecture, network topologies and infrastructure maps, with built-in AWS, GCP, Azure, Kubernetes and Material icon packs. It began as a community fork of [FossFLOW](https://github.com/stan-smith/FossFLOW) (itself a fork of [Isoflow](https://github.com/markmanx/isoflow)) and has grown into a full product: a WebGL2-accelerated canvas, file management, Google Drive storage, share links, presentation mode, and 13 languages.

## Highlights

- **Isometric & 2D** — toggle between crisp isometric and flat 2D views of the same diagram; zoom and center are preserved.
- **Cloud icon packs** — AWS, GCP, Azure, Kubernetes, plus ~2,200 Material icons, loaded on demand.
- **Rich editing** — multi-select, cut/copy/paste, undo/redo, connectors with labels and waypoints, floating labels, inline rich text, and one docked style strip for every element.
- **Multi-view diagrams** — multiple named views per file, layers, and cross-diagram links.
- **Fast at scale** — a WebGL2 canvas holds 60 fps while panning diagrams with thousands of nodes.
- **Present & export** — distraction-free present mode, ephemeral annotation overlay, robust PNG export.
- **File management** — VS Code-style file explorer, project-zip import/export, compact LLM-friendly diagram format.
- **Your storage, your data** — browser session, your own Google Drive (per-file `drive.file` scope), or your own server. No tracking, no analytics.
- **Share links** — read-only share URLs: Drive diagrams share serverlessly via Google Drive's own access control (live links, optional anonymous "anyone with the link" preview); session diagrams get snapshot links on server-storage deployments.
- **Touch & pen** — full direct-manipulation touchscreen and stylus support.
- **13 languages** — complete internationalisation of the UI.

The complete feature inventory (with ADR links) lives in [docs/features.md](docs/features.md).

## Run it locally

The hosted app needs nothing — just open [axoview.app](https://axoview.app). To run your own:

### Docker (self-host)

Requires [Docker Desktop](https://www.docker.com/get-started/) and [Git](https://git-scm.com/downloads). No Node.js needed.

```bash
git clone https://github.com/molikas/axoview.git
cd axoview
cat > .env <<EOF
ENABLE_SERVER_STORAGE=true
EOF
docker compose up --build           # first run — takes 3–5 min
```

Open **http://localhost** for the landing page — the editor lives at **http://localhost/app**. Diagrams are saved to a `diagrams/` folder in the project directory. Subsequent starts omit `--build`; stop with `Ctrl+C` or `docker compose down`.

> **Security note:** no authentication is enabled by default, which is fine for a single-user machine but means anyone who can reach the port has full read/write access to your diagrams. Before exposing the instance to any untrusted network, set `AUTH_MODE=shared-token` + `AUTH_SHARED_SECRET` (and, behind a reverse proxy, `PUBLIC_BASE_URL`) per [docs/deployment.md](docs/deployment.md).

### From source (Node ≥ 22)

```bash
git clone https://github.com/molikas/axoview.git
cd axoview
npm install
npm run dev            # frontend on http://localhost:3000 — editor at /app
npm run dev:backend    # optional, second terminal — server storage + session-diagram share links on :3001
```

## Deployment targets

Axoview runs from a single codebase on three targets, sharing one `/api/*` HTTP contract:

| Target | Runtime | Storage | Auth options |
|---|---|---|---|
| **Local dev** | `npm run dev` (rsbuild on :3000 + Express on :3001) | Filesystem if `ENABLE_SERVER_STORAGE=true`, else session | `none`, `shared-token` |
| **Docker** | nginx + Express on Node | Filesystem volume | `none`, `shared-token` |
| **Cloudflare Pages** | Pages Functions (Hono) | **Session + user-owned Google Drive** (worker stays storage-less) | `none`, `shared-token`, `cf-access` |

The frontend bundle is identical across all three: a static marketing landing at `/`, the editor at `/app`, legal pages, and the API. Runtime config (`GET /api/config`) replaces build-time env injection. The Cloudflare worker itself remains storage-less; persistent storage there is the user's own Google Drive via the client-side provider (set `GOOGLE_CLIENT_ID` — see [ADR 0035](docs/adr/0035-google-identity-and-drive-authorization.md); optionally `GOOGLE_API_KEY` + `GOOGLE_PROJECT_NUMBER` to enable anonymous Drive-share preview and the Picker grant flow — see [ADR 0042](docs/adr/0042-drive-native-sharing-and-readonly-preview.md) and [docs/deployment.md](docs/deployment.md)).

For the from-scratch deploy walkthrough, see [docs/deployment.md](docs/deployment.md).

## Documentation

- [docs/features.md](docs/features.md) — the full feature inventory (what this fork adds vs upstream, with ADR links).
- [docs/guidelines/architecture.md](docs/guidelines/architecture.md) — feature inventory, store/reducer/mode architecture, test audit, gap analysis.
- [docs/deployment.md](docs/deployment.md) — local / Docker / Cloudflare deploy walkthroughs.
- [docs/guidelines/testing.md](docs/guidelines/testing.md) — regression suite reference (Playwright E2E in `packages/axoview-e2e/`).
- [docs/adr/](docs/adr/) — architectural decision records (project/storage formats, canvas interaction model, rendering & perf, deployment & session backend, error & UX contracts, and more).
- [PLAN.md](PLAN.md) — strategic phased roadmap.
- [CHANGELOG.md](CHANGELOG.md) — release changelog (generated by semantic-release).

## Development

```bash
npm run test:unit      # jest suite (packages/axoview-lib)
npm run test:e2e       # Playwright E2E (needs a build; see docs/testing.md)
npm run lint           # tsc + eslint across workspaces
npm test --workspace=packages/axoview-lib -- --coverage   # HTML report in coverage/lcov-report/
```

## Issues and feedback

Bug reports and feature requests are welcome at [github.com/molikas/axoview/issues](https://github.com/molikas/axoview/issues) — use the **Bug report** or **Feature request** templates.

**Code pull requests are not accepted** — this is a personal fork. If you want to build on top, fork it.

## License

See [LICENSE](LICENSE). Icons bundled under `@isoflow/isopacks` (the AWS / GCP / Azure / Kubernetes / core packs) remain attributed to the Isoflow project; see the in-app **Settings → About** tab for the full lineage.
