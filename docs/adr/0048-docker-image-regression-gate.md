# ADR 0048 — Docker Image Regression Gate

**Status:** Proposed
**Date:** 2026-09-24
**Supersedes:** none (retires the "CI-only build flag" recommendation in [testing.md "CI execution model — sharding"](../guidelines/testing.md#ci-execution-model--sharding-2026-07-10-pr-66); relates to [ADR 0009](0009-deployment-topology.md), [ADR 0010](0010-session-backend-contract.md) decision 8 and [ADR 0045](0045-release-version-provenance-and-in-app-surfacing.md))
**Superseded by:** none

## Context

[ADR 0009](0009-deployment-topology.md) ships two deploy targets: Cloudflare Pages, and a self-host Docker image (nginx, the prod bundle and the Express backend in one container). v3.9.0 and v3.9.1 shipped two bugs that exist only in the Docker image, and every gate passed:

- every browser write was refused with `403 Origin not allowed`;
- over plain HTTP from another machine, the editor failed to load (`crypto.randomUUID is not a function`).

v3.9.2 (PR #90) fixed both. No gate could have seen either one:

- **No workflow builds the image.** `.github/workflows/` holds no `docker build`. The five required checks on master are CI Gate, E2E Gate, the perf smoke, CodeQL and the promotion-title lint.
- **The E2E suite runs on the rsbuild dev server** (`npm run dev`, `:3000`) with no backend and session storage. It never touches nginx, the backend, the prod bundle, server storage, a non-loopback origin or a remapped port.
- **Every environment we test in is a secure context.** `localhost` and HTTPS both expose `crypto.randomUUID`; only a plain-HTTP, non-loopback origin does not.
- **The local Docker run hides the Origin bug.** The backend's default `ALLOWED_ORIGINS` is `http://localhost:3000` (`server.js`), and `npm run docker:run` uses [compose.dev.yml](../../compose.dev.yml), which maps `3000:80`. That is the one origin for which the gate always passes.
- **nginx's `$host` drops the port**, so the port half of the gate bug only appears on a remapped host port. [nginx.conf](../../nginx.conf) now forwards `$http_host`.

The E2E suite can't simply be pointed at the image either:

- The prod bundle doesn't expose the `window.__axoview__` store bridge by default. [Axoview.tsx](../../packages/axoview-lib/src/Axoview.tsx) exposes it only when `enableDebugTools || exposeStoreBridge || NODE_ENV !== 'production'`.
- MUI strips icon `data-testid`s in production builds.
- A few specs hardcode `localhost:3000`.

The first full run against the image (storage OFF) failed 9 of 289 tests. All 9 were environmental and failed identically on a master image.

## Decision

### 1. The Docker image is a gated target

Every pull request to `master` builds the image from the PR head and runs a **smoke** against the running container. The smoke reports under one stable check name, **`Docker Gate`**: an aggregator job with `if: always()` that fails closed on `skipped`, the same pattern as `CI Gate` and `E2E Gate`. The workflow has no `paths:` filter, because a path-filtered required check either never reports (and blocks) or reports skipped (and passes).

`Docker Gate` joins the master ruleset's required checks only after it has been **proven able to go red**: each of the three v3.9.x fixes, reverted on its own, must fail it (see Acceptance criteria). `/ship` needs no change for this, because its `gh pr checks --watch` step already waits on every required check.

### 2. What the smoke must exercise

The smoke exists to hold the conditions that hid the v3.9.x bugs. Each of these is a requirement, not a convenience:

| Condition | Why |
|---|---|
| The image `docker build .` produces. The only build argument allowed is the version (§6). | Anything else tests an image nobody runs. |
| All traffic through nginx on the host port, never the backend's `:3001`. | nginx's `Host` handling is where the port bug lived. |
| A remapped host port that is neither `80` nor `3000`. | `80` hides the port; `3000` equals the default `ALLOWED_ORIGINS`. |
| Server storage **ON**, backed by a volume. | ON is the shipped default (ADR 0009) and where the 403 lived. |
| Browser-driven writes: create, autosave, rename, delete, share. | Browsers send `Origin` on every non-GET request; curl does not. |
| A secure origin (`http://localhost:<port>`) **and** an insecure one (`http://axoview.test:<port>`, mapped through Chromium's `--host-resolver-rules`). | Only an insecure context lacks `crypto.randomUUID`. |
| The Origin table below, sent with explicit `Origin` headers. | It pins the gate's contract, not just today's code. |
| A storage-**OFF** boot probe: `/api/config` answers 200 and the container turns `healthy`. | [deployment.md §D.1](../deployment.md) promises `/api/config` stays reachable. |

| `Origin` on a `POST /api/diagrams` | Expected |
|---|---|
| the page's own origin, port included | 201 |
| another site | 403 |
| same host, different port | 403 |
| same host, port missing | 403 |

The smoke specs **don't use the debug bridge**. They drive the DOM and the HTTP API only, so they test the image exactly as users receive it. Each spec also asserts its own preconditions: `window.isSecureContext` is `true` or `false` as intended, the response came from nginx, and the storage mode is the one requested. A precondition that silently fails turns the check into a false green.

The same reasoning applies to local runs. `compose.dev.yml` (`npm run docker:run`) publishes nginx on `8080`, not `3000`, so a developer's local container goes through the Origin gate the way a real deployment does.

### 3. The full regression against the image

The full E2E suite also runs against the built image:

- **when:** on every pull request to `master` and every push to `master`, so it runs whenever the owner lands a change, plus on demand (`workflow_dispatch`). There is no nightly schedule (owner, 2026-09-24);
- **config:** a separate Playwright config, sharded across CI runners. The dev config, and both of testing.md's sharding invariants for it, stay as they are;
- **storage:** OFF, the suite's native mode.

Server-storage runs of the full suite are out of scope until the suite can isolate server state between tests.

### 4. How a production bundle exposes the store bridge

The full regression reaches `window.__axoview__` through the **existing runtime flag**: Playwright's `storageState` preloads `localStorage.axoview_perf_enabled = '1'`. That turns on `diagnosticsStore`'s `enabled` flag, and App passes it as `exposeStoreBridge`.

There is **no CI-only build flag**. This retires testing.md's recommendation of one, for three reasons:

- The image under test must be the one that ships (§2), and a build flag would produce a variant nobody runs.
- The runtime path already ships in production. Adding a build flag would widen nothing and isolate nothing.
- Dev builds already run with diagnostics enabled (`diagnosticsStore` returns `true` under `IS_DEV`). The flag therefore puts the prod bundle in the same state the suite was written against.

### 5. How the full regression is enforced

The full regression reports under its own stable check name, **`Docker Regression Gate`**, using the same aggregator pattern as §1.

- **Advisory at first.** The check runs and reports on every PR but isn't in the ruleset. While it's advisory, `/ship` waits for it and reports the result. If it failed, `/ship` asks for one extra confirmation before merging. Required-check failures still stop `/ship` exactly as before.
- **Strict once green.** Today's baseline has 9 known environmental failures, and `/ship` forbids tolerance lists. Once the tactical's sub-task C has made the suite prod-compatible and the check has run green on `master`, `Docker Regression Gate` joins the required checks. From then on `/ship`'s required-checks wait covers it, and the extra confirmation goes away.

Failure attribution (§6) annotates a red run; it never turns red into green.

### 6. One runner, and a local resource contract

One script, `scripts/e2e-docker.js`, does build → run → wait → Playwright → teardown. It serves both CI and local runs, so the path CI exercises on every PR is the path a developer runs.

Locally it enforces the resource contract written after the 2026-09-24 overload incident:

- one heavy stream at a time;
- a single-instance guard;
- labels on everything it creates, removed on exit, interrupt and termination;
- process trees killed, never lone PIDs;
- a health check before each spec file;
- capped CPU, memory and workers;
- a leak audit printed at the end of every run.

The rules live in testing.md; this ADR fixes only that the runner, not the operator, enforces them.

Docker builds exclude `.git` ([.dockerignore](../../.dockerignore)), so `resolve-version.js` falls back to the frozen `package.json` version. The version therefore reaches the image as an `AXOVIEW_VERSION` build argument. This is recorded as an ADR 0045 addendum.

## Consequences

**Positive:**
- The two v3.9.x bug classes (Origin/Host handling behind nginx, and insecure-context APIs) fail a required check before merge.
- The Docker image is exercised on every PR by the same runner a developer can run locally.
- The pre-ship regression covers both deploy shapes, not only the dev server.

**Negative / risks:**
- Every PR to master pays for two more workflows, both running in parallel with the existing gates:
  - the smoke: one runner, about 5–8 minutes;
  - the full regression: one image build plus 4 shards, about 20 minutes of wall-clock (to be measured).
- A required check that depends on Docker Hub (`node:22`, `node:22-alpine`) inherits Docker Hub's availability and rate limits.
- The runtime flag also runs the diagnostics rAF loop on the prod bundle. That matches dev, but specs that measure timing on the image aren't comparable with Cloudflare.
- Server-storage runs of the full suite stay out of scope. Bugs that need server state across tests are covered only by the smoke's single journey.

## Implementation notes (non-binding)

- Workflows:
  - `.github/workflows/docker-smoke.yml`: the `Docker Gate` check;
  - `.github/workflows/docker-regression.yml`: the `Docker Regression Gate` check, on PRs and pushes to master plus `workflow_dispatch`, sharded.
- Playwright: `packages/axoview-e2e/playwright.docker.config.ts`, with three smoke projects over `tests-docker/` (`smoke-secure`, `smoke-insecure`, `smoke-storage-off`) and two regression projects over `tests/` (`regression`, `regression-touch`, with the bridge `storageState`).
- Runner: `scripts/e2e-docker.js`, wired as `npm run test:e2e:docker` (the smoke) and `test:e2e:docker:full`.
- Build: [Dockerfile](../../Dockerfile) takes `ARG AXOVIEW_VERSION` in the build stage.
- Step-by-step plan: [docs/tactical/docker-regression-gate.md](../tactical/docker-regression-gate.md).

## Acceptance criteria

- **Negative proof (before the ruleset change):** each of these three reverts, applied alone to a branch, fails `Docker Gate` in the named spec:
  - `isOwnOrigin` returns `false` → the own-origin write is refused;
  - nginx sends `$host` instead of `$http_host` → the remapped-port write is refused;
  - `generateId` loses its fallback → the insecure-origin load fails.

  Proven 2026-09-24 on `gate-proof/docker-smoke` (branch deleted afterwards), one revert at a time on top of the phase-A head `46a80d30`:

  | Revert | Run | Result |
  |---|---|---|
  | none (baseline) | [36072933840](https://github.com/molikas/axoview/actions/runs/36072933840) | green, 8/8, 5 min 8 s wall on a cold buildx cache |
  | `isOwnOrigin` → `return false` | [36073428591](https://github.com/molikas/axoview/actions/runs/36073428591) | red: both own-origin rows of the Origin table, and the journey's first `POST /api/diagrams` under both origins |
  | nginx `$http_host` → `$host` | [36073749706](https://github.com/molikas/axoview/actions/runs/36073749706) | red: the same three, plus "same host, port missing → 403", which now passes the gate: the port-less `Host` makes a port-less `Origin` match |
  | `generateId` → the pre-v3.9.2 body, `return crypto.randomUUID()` | [36074327050](https://github.com/molikas/axoview/actions/runs/36074327050) | red: only `smoke-insecure`'s journey. The server creates the diagram, but the editor never mounts on the insecure origin. |

  For the third revert, an error boundary catches the throw, so no `pageerror` fires. The journey's canvas assertion is what fails. An earlier attempt at the same revert ([36074059820](https://github.com/molikas/axoview/actions/runs/36074059820)) returned early inside the current body, which broke TypeScript narrowing and failed the image build. That run was red for the wrong reason, so it doesn't count.
- **Positive:** `Docker Gate` is green on `master` and appears in the ruleset's `required_status_checks`.
- **Runner hygiene:** interrupt a local run with Ctrl+C, and in a second run kill its container mid-run. Both must end in a leak audit that reports zero leftover processes, containers, volumes and images.
- **Full regression:** `Docker Regression Gate` runs green on `master`, with no failures and none attributed away. Only then does it join the ruleset (§5), and `/ship` drops its advisory confirmation.
