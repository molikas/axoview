# Tactical — Docker regression gate

> **Read first:**
> - [ADR 0048 — Docker image regression gate](../adr/0048-docker-image-regression-gate.md): the decisions this plan implements. The reasoning lives there, not here.
> - [ADR 0045](../adr/0045-release-version-provenance-and-in-app-surfacing.md): D2 below adds a dated addendum to it.
> - [ADR 0010](../adr/0010-session-backend-contract.md) decision 8 and [docs/deployment.md](../deployment.md) §D, §D.1 and §F: the health and storage-off contract that A1 restores on Docker.
> - [docs/guidelines/testing.md](../guidelines/testing.md): read only "CI execution model — sharding" and "Running the e2e gate — three rig traps".
> - [docs/workflow.md](../workflow.md): session conventions (the baseline).
> - Evidence: [issue #89](https://github.com/molikas/axoview/issues/89) and [PR #90](https://github.com/molikas/axoview/pull/90). The PR's Verification section is the raw record of the local Docker runs.
>
> **Status:** Done, and being wrapped. A–E landed through PR #92 and the close-out PR; both Docker checks are required on master. B3 is still unexercised (it only runs on a failure). **Owner:** molikas · **Last updated:** 2026-09-24
>
> This is a **short-lived working doc.** Delete it after the work merges; the ADRs and testing.md are the durable record. See "Wrap-up".

## Session startup checklist

1. Read this file fully, then ADR 0048.
2. Read the other "Read first" links; for testing.md, read only the two sections named.
3. Skim `PLAN.md` Phase Status Dashboard **for context only**; do not modify it.
4. Work in phase order (A → C → B → D, then E, the close-out PR, after the main PR merges). Each numbered item is one commit unless it says otherwise. A single orchestrated session may have subagents write code for different phases in parallel, but everything heavy still runs one stream at a time, in this order.
5. Mark `[x]` as work completes. Put run URLs and measurements next to the item they prove.

## Goal

v3.9.0 and v3.9.1 shipped two Docker-only bugs through every gate: `403 Origin not allowed` on every write, and an editor that failed to load over plain HTTP. This plan makes that class of bug fail a required check before merge (A), and adds a full E2E run against the built image before shipping (C, then B). Replacing or re-sharding the dev-server suite is **not** a goal.

## Scope

**In scope:**
- the smoke gate;
- the one runner script shared by CI and local runs;
- making the suite prod-compatible;
- the full-regression workflow and its attribution step;
- the `/ship` integration;
- the #90 fidelity backlog (D).

**Out of scope:**
- the dev-server suite's gate semantics;
- DNS-rebinding hardening (see #90's Security note);
- the Cloudflare/Worker deploy;
- **server-storage runs of the full suite** (ADR 0048 §3), and with them the browser-storage tagging such runs would need. See C5;
- **allowing `Closes #N` in commits.** The owner ruled yes on 2026-09-24, now that GitHub issues are live. It's a separate change: `/feature extend 0046`, workflow.md's commit-subject paragraph, and `scripts/release-changelog-preset.mjs`, which currently clears issue references.

## Locked decisions

| # | Decision | Source |
|---|---|---|
| 1 | The full pre-ship regression includes the built Docker image, not only the dev server. | owner, 2026-09-24 |
| 2 | Heavy local runs go one stream at a time: no local sharding, and no image build on top of a running suite. Parallelism belongs in CI. | owner, 2026-09-24 |
| 3 | The dev-server config and its invariants stay as they are. Docker runs get their own config. | testing.md |
| 4 | The smoke is the `Docker Gate` check on every PR to master. It becomes **required** only after A6 proves it can fail (A5–A7). | owner, 2026-09-24; ADR 0048 §1 |
| 5 | Production images expose the bridge through the runtime flag `axoview_perf_enabled='1'` in `storageState`. There is no CI-only build flag. | owner, 2026-09-24; ADR 0048 §4 |
| 6 | The full regression is the `Docker Regression Gate` check. It stays advisory (reported, not in the ruleset, with `/ship` asking once if it's red) until it runs green on master, then becomes required. | owner, 2026-09-24; ADR 0048 §5 |
| 7 | Record the decisions in a new ADR 0048, plus an ADR 0045 addendum for the Docker version. | owner, 2026-09-24 |
| 8 | The smoke drives the journeys with storage ON and runs a boot probe with storage OFF. The full regression runs storage OFF. | ADR 0048 §2, §3 |
| 9 | CI and local runs use one runner, `scripts/e2e-docker.js`. CI builds the image with buildx caching and passes `--image`. | ADR 0048 §6 |
| 10 | The full regression runs whenever changes land (every PR and push to master, plus on demand), not on a nightly schedule. | owner, 2026-09-24; ADR 0048 §3 |
| 11 | `npm run docker:run` serves on `http://localhost:8080`, not `3000`, and every doc that mentions the port moves with it. | owner, 2026-09-24; ADR 0048 §2 |

## Runner contract (A3 must enforce all of it; the 2026-09-24 incident)

On 2026-09-24, four Playwright streams, about eight containers and two image builds made the dev machine unresponsive. Killing the containers didn't stop the test loops. Stopping the background tasks left 33 child processes alive: 12 `chrome-headless-shell`, 9 bash loops, 6 Playwright `node`, 3 `ffmpeg` and 3 `cmd`. On Windows, `$!` and task stops reach the wrapper process, not the process tree. The full narrative is in this file's git history.

1. **One heavy stream at a time.** Before starting, print the ETA and the resource plan.
2. **Single instance.** Keep a lock file at `.e2e-docker.lock` (pid plus run id). Refuse to start if the lock's pid is alive or if any container labelled `axoview.regress` exists. In that case print the cleanup command; don't run it.
3. **Label everything the run creates**, and remove it on `exit`, `SIGINT`, `SIGTERM` and uncaught errors:
   - `--label axoview.regress=<run-id>` on containers and volumes;
   - images tagged `axoview:regress-<run-id>`, and only when the runner built them itself.
4. **Kill process trees, never PIDs.** On win32, `taskkill /pid <pid> /T /F`. On POSIX, spawn detached and `process.kill(-pid)`.
5. **Fail fast.** A watchdog polls `docker inspect` every 5 s. If the container stops, kill the Playwright tree, clean up and exit 3.
6. **Cap the cost:**
   - `docker run --cpus=2 --memory=2g`;
   - Playwright `workers: 1`, `video: 'off'`, traces kept on failure only;
   - a per-run output directory, `test-results/docker-<run-id>` (per-file runs that share one `--output` directory delete each other's artifacts).
7. **Finish with a leak audit**, whether the run passed, failed or aborted, and print it:
   - no `chrome-headless-shell`, `ffmpeg` or Playwright `node` from this run (match on command line; on win32 use `Get-CimInstance Win32_Process`);
   - no labelled containers or volumes, and no `axoview:regress-*` images.

   Exit non-zero on any leak.

Exit codes:

| Code | Meaning |
|---|---|
| 0 | pass |
| 1 | test failures |
| 2 | harness or setup error (including Docker not running) |
| 3 | aborted: the container died |
| 4 | leak audit failed |

## Phase A — Docker smoke gate (P0)

- [x] **A1. Always start the backend** ([docker-entrypoint.sh:10-21](../../docker-entrypoint.sh)).
  - **Done:** `13e441aa`. Every storage-OFF phase comes up `healthy` with `/api/config` 200 in about 6 s (e.g. run `20260924-230217-d1d7`), and `boot-storage-off.spec.ts` gets the backend's 404 JSON from `/api/public/diagrams/<id>`, not nginx's 502.
  - **Change:** move `su-exec node:node node server.js &` out of the `ENABLE_SERVER_STORAGE` branch. Keep `mkdir` and `chown` unconditional.
  - **Why:** the backend already handles storage-off. `/healthz` returns ok ([server.js](../../packages/axoview-backend/server.js) `probeStorage`), `/api/config` reports `serverStorage:false`, and the §D.1 routes stay reachable. Today nothing listens, so with storage OFF:
    - `/api/config`, the ADR 0009 D2 boot probe, returns 502;
    - the §D.1 published-link and unpublish routes are unreachable;
    - the container is `unhealthy` forever.
  - **Also closes** D's healthcheck item.
  - **Verify:** run with `-e ENABLE_SERVER_STORAGE=false -p 8081:80`. `/api/config` returns 200 with `serverStorage:false`, and `docker inspect` reports `healthy`. A `fix(docker)` commit whose body carries the user-facing bullet.
- [x] **A2. Playwright config** `packages/axoview-e2e/playwright.docker.config.ts` (new):
  - **Done:** `f30e2670`, with C3. One deviation: `smoke-secure` ignores `boot-storage-off.spec.ts`, which needs a storage-OFF container. Each project sets `expectSecureContext` and `expectServerStorage` as fixture options.
  - **Server:** no `webServer`. `baseURL` comes from `AXOVIEW_BASE_URL`, and the config **throws if it's unset** (so it can never silently hit `:3000`).
  - **Run settings:** `workers: 1`, `fullyParallel: false`, `retries: 0`.
  - **Reporters:** list, json to `$AXOVIEW_E2E_OUT/results.json`, html, and blob under `CI`.
  - **Artifacts:** `video: 'off'`, `trace: 'retain-on-failure'`.
  - **Browser:** `launchOptions.args: ['--host-resolver-rules=MAP axoview.test 127.0.0.1']`.
  - **Projects:**
    - `smoke-secure`: `tests-docker/`, baseURL `http://localhost:<port>`;
    - `smoke-insecure`: `tests-docker/journey.spec.ts` only, baseURL `http://axoview.test:<port>`;
    - `smoke-storage-off`: `tests-docker/boot-storage-off.spec.ts` only;
    - `regression` and `regression-touch` are added in C3.
- [x] **A3. Runner** `scripts/e2e-docker.js` (new; Node builtins only, like the other `scripts/*.js`).
  - **Done:** `18216933`, with B1. The smoke is green locally: run `20260924-230217-d1d7`, 8/8, 281 s wall including a 161 s build, and about 2 min against an existing image. The leak audit was CLEAN on every run. A `docker kill` mid-Playwright exits 3 with a clean audit (B4). Ctrl+C at each stage is the owner's test. Beyond the plan the runner has `--run-id`, `-- <playwright args>`, `--aggregate` (the CI merge), a loopback-only port binding, and one output directory per phase, because Playwright empties its output directory at startup. `.dockerignore` keeps the runner's lock and output out of the build context.
  - **Flags:** `--suite=smoke|full` (default smoke), `--image=<tag>` (skip the build), `--port=8081`, `--shard=i/N`, `--files=<spec,...>`, `--no-volume`.
  - **Smoke sequence:**
    1. Build `axoview:regress-<id>` with `--build-arg AXOVIEW_VERSION=$(node -p "require('./scripts/resolve-version')(require('./package.json').version)")`.
    2. Run storage ON with a labelled volume and `--health-interval=2s`. This overrides only the probe cadence, never the image.
    3. Wait: poll `http://localhost:<port>/api/config` through nginx until 200, and `docker inspect` until `healthy`. Time out at 90 s. The poll also absorbs nginx's startup `no live upstreams` window.
    4. Run `smoke-secure` and `smoke-insecure`.
    5. Replace the container with a storage-OFF one and run `smoke-storage-off`.
    6. Save `docker logs` to the output directory, then tear down and audit.
  - **Scripts:** add root `package.json` script `test:e2e:docker` (`node scripts/e2e-docker.js`), and add `.e2e-docker.lock` to `.gitignore`.
  - **Docs:** [.claude/commands/shake-out.md:65](../../.claude/commands/shake-out.md) tells agents to build an image, run it on a spare port and open it through `--host-resolver-rules` by hand. Replace that procedure with `npm run test:e2e:docker`, which now does all of it and cleans up afterwards.
  - **Verify:** the smoke runs green locally. Ctrl+C at each stage (build, wait, Playwright) leaves a clean leak audit.
- [x] **A4. Smoke specs** in `packages/axoview-e2e/tests-docker/` (new).
  - **Done:** `a3c2d9e1`, fixed in `6b12ac20`. Deviations:
    - save is Ctrl+S, because `toolbar-save` isn't rendered with server storage;
    - step 5 waits on the explorer row's new `aria-current`: the first run waited on `localStorage['axoview-last-opened']`, which the explorer's load path never writes;
    - origin-gate row 5 posts to loopback with an explicit `Host: axoview.test:<port>`.
  - **Imports:** no import of `helpers/store.ts` or any other bridge helper. Use `byAxoviewId` from `helpers/selectors.ts`, and seed the onboarding flags the way `fixtures/app.fixture.ts` does (`ONBOARDING_DISMISS_FLAGS`).
  - **`fixtures.ts`** fails the test on:
    - any `/api/*` response ≥ 400 that the test didn't declare;
    - any `pageerror`.

    Before each test it asserts these preconditions:
    - `window.__axoview__ === undefined` (this is the image as shipped, and a prod bundle that starts leaking the bridge fails here);
    - `window.isSecureContext` matches the project;
    - the `Server` header on `/app` is nginx;
    - `/api/config`'s `serverStorage` matches the phase.
  - **`journey.spec.ts`** runs under both origins:
    1. Create from the empty state (`screen-empty-create`).
    2. Make a DOM-only edit, then save (`toolbar-save`). Wait for a 2xx `PUT /api/diagrams/:id`.
    3. Reload: the diagram is still listed (it came back from the server).
    4. Rename it in the explorer.
    5. Create a second diagram from the explorer.
    6. Share (`toolbar-share`): expect a 2xx `POST …/share`, then open the returned link in a new page and see it render.
    7. Delete it and reload: it's gone.

    Borrow selectors from `rename.spec.ts`, `file-explorer-delete.spec.ts` and `share.spec.ts`.
  - **`origin-gate.spec.ts`** uses the Playwright request API with explicit `Origin` headers and expects:

    | `Origin` | Expected |
    |---|---|
    | the page's own origin (port included) | 201 |
    | another site | 403 |
    | same host, different port | 403 |
    | same host, port missing | 403 |
    | own origin via `http://axoview.test:<port>` | 201 |

    It deletes whatever it created.
  - **`boot-storage-off.spec.ts`:**
    - `/api/config` returns 200 with `serverStorage:false`;
    - the editor reaches the empty state;
    - create works (session storage);
    - no `/api/diagrams` write is attempted.
- [x] **A5. Workflow** `.github/workflows/docker-smoke.yml` (new). Copy the trigger block from [e2e-playwright.yml](../../.github/workflows/e2e-playwright.yml): PRs to master with `ready_for_review`, push to master, `workflow_dispatch`, a draft filter, `concurrency`, and `permissions: contents: read`. **Add no `paths:` filter** (see ADR 0048 §1). Also add `push: branches: ['gate-proof/**']` so A6 can run before this file is on master. `gh workflow run` only works for workflows that already exist on the default branch.
  - **Done:** `0e239ad0`. The first CI run is green on the gate-proof baseline: [36072933840](https://github.com/molikas/axoview/actions/runs/36072933840), 5 min 8 s wall on a cold buildx cache; warm runs take about 3 min. The PR's own first run is still to come.
  - Job `docker-smoke`:
    1. `actions/checkout@v6` with `fetch-depth: 0` (for the version).
    2. Node 22 and `npm ci`.
    3. The Playwright browser cache and install steps from e2e-playwright.yml.
    4. `docker/setup-buildx-action`.
    5. `docker/build-push-action` with `load: true`, `tags: axoview:ci`, `cache-from`/`cache-to: type=gha,mode=max` and the `AXOVIEW_VERSION` build arg.
    6. `node scripts/e2e-docker.js --image=axoview:ci`.
    7. On failure, upload the output directory (report plus container logs).
  - Job `docker-gate`, named **`Docker Gate`**: `if: always()`, `needs: [docker-smoke]`, and fails unless the result is `success`. Copy `e2e-gate` verbatim.
  - **Verify:** the first run is green on the PR that lands A. Record its wall-clock time; the target is under 8 min.
- [x] **A6. Prove it can fail.** Branch `gate-proof/docker-smoke` off the phase-A branch. For each revert: apply it alone, push the branch (the `push` trigger from A5 runs the smoke), read the result, then undo the revert before the next one. **Ask the owner before the first push, and don't open a PR to master.**
  - **Done:** Recorded in ADR 0048's Acceptance criteria (`16c8e29f`), and the branch is deleted. Revert 3 needed a second attempt: the first broke the image build, so it was red for the wrong reason.

  | Revert | Where | Expected failure |
  |---|---|---|
  | `isOwnOrigin` → `return false` | server.js `isOwnOrigin` | origin-gate own-origin rows, journey save |
  | `$http_host` → `$host` | [nginx.conf:70](../../nginx.conf) | own-origin writes on `:8081` |
  | `generateId` → bare `crypto.randomUUID()` | lib `utils/common.ts` `generateId` | `smoke-insecure` journey (pageerror) |

  Record the three run URLs in ADR 0048's Acceptance criteria, then delete the branch.
- [x] **A7. Make it required (owner action).** Add `{"context":"Docker Gate"}` to the `required_status_checks` rule of ruleset `16783964` ("master protect"):
  - **Done:** `Docker Gate` joined ruleset `16783964` at 23:22 EDT on 2026-09-24, after the first master run on PR #92's merge commit `376410fd` was green ([36089799380](https://github.com/molikas/axoview/actions/runs/36089799380)). Run on the owner's go-ahead. ADR 0048 is Accepted (E1).
  1. `gh api repos/molikas/axoview/rulesets/16783964 > rs.json`.
  2. Edit `rules[].parameters.required_status_checks`.
  3. `gh api -X PUT repos/molikas/axoview/rulesets/16783964 --input rs.json`.

  Prepare the file; **the owner runs the PUT.** Then flip ADR 0048's `**Status:**` to `Accepted`.

## Phase C — Make the suite prod-compatible (P1; gates B5's flip to strict)

- [x] **C1. Replace the three MUI-icon selectors** (MUI strips icon `data-testid` in production builds). Only 3 helpers in 2 files depend on them:
  - **Done:** `93b23d86`. `grep -rn 'Icon"\]' packages/axoview-e2e` returns nothing, the lib builds, and both specs pass on the dev server and on the image.

  | Helper | Spec location | Icon | Calls | Add this hook |
  |---|---|---|---|---|
  | `addPage` | undo-page-navigation.spec.ts:26-27 | `AddIcon` | 5 | `data-axoview-id="view-tabs-add"` on the IconButton in lib `ViewTabs.tsx:264-270` |
  | `deletePageTab` | undo-page-navigation.spec.ts:29-30 | `CloseIcon` | 1 | `data-axoview-id="view-tab-close"` on `ViewTabs.tsx:235-248` |
  | `stripButtonByIcon` | bulk-format-mixed.spec.ts:98-99 | `FormatColorFillIcon` | 1 | pass `testId="strip-fill-button"` to the Fill `StripButton` at `TopBarStyleControls.tsx:1771-1778`, matching the sibling `strip-border-button` |

  Delete `stripButtonByIcon` once it has no callers. Follow ADR 0008's naming (`data-axoview-id`, kebab-case).
  - **Verify:** `grep -rn 'Icon"\]' packages/axoview-e2e` returns nothing; both specs pass on the dev server; the lib builds.
- [x] **C2. Remove the hardcoded dev URLs.**
  - **Done:** `f6c179a8`. Both specs pass on the dev server (18/18 with C1's) and on the image.
  - `landing-navigation.spec.ts:44`: `waitForURL(/localhost:3000\/$/)` becomes a pathname predicate (`u => u.pathname === '/'`).
  - `share.spec.ts:235` and `:278`: take the `baseURL` fixture, **and forward `storageState`** from `testInfo.project.use`. Contexts made with `browser.newContext` inherit neither, and on the image the bridge rides on `storageState`.
  - Fix the stale comment at `share.spec.ts:193-195`: `apiBaseUrl()` returns `http://localhost:3001` in dev.
- [x] **C3. Add the regression projects** to `playwright.docker.config.ts`:
  - **Done:** Config `f30e2670`, runner `18216933`. The full regression on `axoview:local` (HEAD `6b12ac20`), run `20260924-231621-6b3e`: 289 tests, 286 passed, 3 expected-fail (the `test.fail()` repros), 0 unexpected, 0 flaky. It took 42 min 26 s at 1 worker, not 80. There was nothing to attribute.
  - `regression` and `regression-touch` use `testDir: ./tests` and the same `touch-*` split as `playwright.config.ts:38-54`.
  - Set `storageState` as an object: `{ cookies: [], origins: [{ origin: <baseURL>, localStorage: [{ name: 'axoview_perf_enabled', value: '1' }] }] }`.
  - Make the runner's `--suite=full` start one storage-OFF container and run both projects.
  - **Verify** with one local stream (about 80 min at 1 worker; 42 min was measured at 2 workers on 2026-09-24). Read `results.json`, not the list output: the list reporter prints the 3 `test.fail()` repros as `x` even when they fail as expected. The target is 0 unexpected failures. Attribute every remaining failure per "Reference facts" before calling it done.
- [x] **C4. testing.md.**
  - **Done:** `5e4b5988`.
  - Correct the second invariant in "CI execution model — sharding" (line 54): the bridge is gated at runtime, not tree-shaken. Point it at ADR 0048 §4. The rule "never point the *dev* config at a prod bundle" stays.
  - Add a "Testing against the Docker image" section under Contracts, drawn from ADR 0048, the runner contract above and "Reference facts" below.
  - Add its row to the `## Sections` index.
- [ ] **C5. Deferred, don't do it:** tag the browser-storage specs for server-storage runs. The regression runs storage OFF, where they all work (decision 8). If server-storage runs are ever scoped, these are the specs that assume browser storage:
  - `hotkeys` (:139-166)
  - `shapes` (:148-170)
  - `smoke` (:142-154)
  - `import-export-zip`
  - `snap-grid` (:222-236)
  - `save-error`
  - `multi-diagram`
  - `share`
  - `share-error`
  - `label-drag`

  Playwright 1.59 `tag` plus `grepInvert` would carry the tags. Note also that `clearAllStorage` (import-export-zip:92-104) never clears the server.

## Phase B — Full regression against Docker (P1)

Land B only after C3 is green on a master image. B runs on every PR, so landing it earlier would put a red check on every PR until C catches up.

- [x] **B1. Runner `--suite=full`:** shard support, and a `summary.json` (passed, failed, flaky, expected-fail, failures with file and title) in the output directory. Print the ETA from the measured cost.
  - **Done:** `18216933`. Every local run writes `summary.json`.
- [x] **B2. Workflow** `.github/workflows/docker-regression.yml` (decision 10).
  - **Done:** `0cedfa73`. Its first run, on PR #92, was green: [36076295118](https://github.com/molikas/axoview/actions/runs/36076295118), 4 shards, 13 min wall from trigger to summary. [36077456478](https://github.com/molikas/axoview/actions/runs/36077456478) was green too: 11 min 38 s to `Docker Regression Gate`, with the slowest shard at 9 min 17 s.
  - **Triggers:** copy the trigger block from e2e-playwright.yml: PRs to master with `ready_for_review`, push to master, `workflow_dispatch` (input: shard count, default 4), plus the draft filter and `concurrency` with `cancel-in-progress`. **No `schedule`** and **no `paths:` filter**; the check becomes required later.
  - **Jobs:**
    1. `build`: buildx, then upload `docker save | gzip` as an artifact, so every shard tests identical bytes.
    2. `shard` matrix: load the image and run `--image --suite=full --shard=i/N`.
    3. `summary`: merge the blobs into HTML, and the JSON into `$GITHUB_STEP_SUMMARY` plus an artifact.
    4. `docker-regression-gate`, named **`Docker Regression Gate`**: `if: always()`, `needs: [shard]`, and fails unless the result is `success`. It must not depend on B3's job.
  - **Verify:** the first run is green on the PR that lands B. Record its wall-clock time.
- [ ] **B3. Attribution job.** It runs only when there are failures. Build a master image (`docker build https://github.com/molikas/axoview.git#master`) and apply the attribution rule to each failing file. Label each failure `regression`, `pre-existing` or `flake` in the summary. **It annotates only; it never changes the conclusion** (ADR 0048 §5).
  - **Status:** `0cedfa73`. Written; it runs only when a shard fails, so it stays unexercised until then.
- [x] **B4. Runner hygiene proof.** Interrupt one run with Ctrl+C, and `docker kill` the container during another. Both must end in an empty leak audit. Paste both audits into the PR.
  - **Done:**
    - **`docker kill`:** exit 3 with a CLEAN audit, run `20260924-231033-4533`.
    - **Ctrl+C:** a real `CTRL_C_EVENT` sent to the runner's console (`GenerateConsoleCtrlEvent`, the event a keypress delivers) at each stage. Every run printed "SIGINT received", audited CLEAN and exited 2:
      - build, 40 s in (`20260925-004831-66f2`): killed the `docker build` tree and removed its image;
      - container wait (`20260925-004949-41dc`): removed the container and volume;
      - Playwright, mid-journey (`20260925-005011-7f6c`): killed the Playwright tree, removed the container and volume.

      An independent check found no leftover processes, containers, volumes, images or lock. The audits are in PR #92.
- [x] **B5. `.claude/commands/ship.md`** (decision 6). The regression now runs on the promotion PR by itself, so `/ship` never triggers it; it only waits for it and reports it.
  - **Done:** `46a80d30`. The flip:
    - **ruleset half:** `Docker Regression Gate` joined the ruleset at 23:31 EDT on 2026-09-24, after its first master run was green ([36089799370](https://github.com/molikas/axoview/actions/runs/36089799370));
    - **docs half:** E2.
  - **Plan step 3:** make the stop condition `gh pr checks --watch --required`, which stops on required-check failures (these include `Docker Gate`). Plain `gh pr checks --watch` exits non-zero on *any* failure, so an advisory red would stop `/ship`, and it doesn't do that yet.
  - **New step 3b (advisory period):**
    1. Wait for `Docker Regression Gate` to finish (read it with `gh pr checks`).
    2. Report `Docker regression: <p>/<n> · <r> regressions · <run url>`.
    3. If it's red, ask once: "Docker regression failed (advisory). Merge anyway? Yes/No."

    Printing this step in the Phase 2 plan is what makes it legal under Phase 3's "execute exactly".
  - **Phase 4 report:** add the Docker regression line.
  - **The flip.** Once `Docker Regression Gate` has run green on master, the owner adds it to ruleset `16783964`, the same way as A7. In the same commit, remove step 3b and the prompt, because `--required` now covers the check.

## Phase D — Fidelity backlog from #90 (independent; one commit each)

- [x] **D1.** Healthcheck `unhealthy` forever with storage OFF: resolved by A1. Tick it when A1 lands.
  - **Done:** Resolved by A1 (`13e441aa`).
- [x] **D2. The Docker version shows `v3.7.0`.** `.dockerignore:2` excludes `.git`, so `resolve-version.js` falls back to the frozen `package.json`.
  - **Done:** `6a8edd79`, plus the ADR 0045 addendum `d9a75ace`. In an image built with `AXOVIEW_VERSION=3.9.2`, `app.html` carries `3.9.2` and no `3.7.0`.
  - Add `ARG AXOVIEW_VERSION` to the Dockerfile build stage before line 27. An ARG is visible to `RUN` as an environment variable, and an empty value falls through.
  - Add `build.args` to both compose files.
  - Add one line to deployment.md §B.
  - Run `/feature extend 0045` to record the addendum.
  - **Verify:** `grep` the version in `/usr/share/nginx/html/app.html` inside the image.
  - The provenance tactical has no Docker coverage.
- [x] **D3. `check:audit` misses the lockfile Docker actually ships.** [scripts/check-audit.js](../../scripts/check-audit.js) audits only the root tree (`npm audit --json --workspaces`), while the image installs from `packages/axoview-backend/package-lock.json`.
  - **Done:** `c35c0ee7`. The backend pass reads 72 prod / 98 total deps (the backend lockfile has 98 entries), and both trees are clean.
  - Add a second pass in that directory: `npm audit --json --omit=dev --workspaces=false`.
  - Allowlist entries may need a scope field.
  - **Verify** the pass reads the backend tree (its dependency count matches the backend lockfile).
- [x] **D4. Delete `packages/axoview-app/package-lock.json`.** Nothing has referenced it since the 2026-05-19 folder rename (33d4d71b); npm workspaces use only the root lockfile; it carries 5 advisories.
  - **Done:** `de3dc892`. `docker build` succeeds, including its `npm ci`. The PR's CI runs the local `npm ci`.
  - The `Dockerfile:10` glob still matches `package.json`.
  - **Verify:** `npm ci` and `docker build` both succeed.
- [x] **D5. nginx's first-request 502.** `proxy_pass http://localhost:3001` resolves to `::1` and `127.0.0.1`, and both get marked down.
  - **Done:** `cf09dbad`. Polling every 100 ms from container start gave one 502 before the backend bound, then 200 from 256 ms on, and no 502 after that.
  - Change it to `http://127.0.0.1:3001`. nginx never marks a single-address upstream unavailable.
  - Confirm the backend accepts IPv4: `app.listen(PORT)` binds dual-stack `::`.
  - **Verify:** looping requests at startup see no multi-second 502 window.
- [x] **D6. The build stage uses `npm install`** (`Dockerfile:17`). Switch to `npm ci`, so the image builds from the same locked tree CI tests.
  - **Done:** `e8f4d147`. The build succeeds with `npm ci` even though the stage doesn't copy the worker and e2e `package.json` files.
- [x] **D7. The docs stamp check always skips in CI.** `test.yml` checks out at depth 1, and `lint-docs.js:244-261` skips on a shallow clone. Set `fetch-depth: 0` (the pack is about 17 MiB).
  - **Done:** `294b2d8c`. The PR's CI run proves it.
- [ ] **D8. Optional lint rule** `no-restricted-properties` for `crypto.randomUUID` in `eslint.config.mjs` (rules at :35-56).
  - **Skipped:** it isn't small. The app's jest maps `axoview` to `jest.axoviewMock.ts`, which would have to re-export `generateId` (pulling chroma-js into app tests), or `generateId` would have to move into its own module. Carry it to `known_issues.md` at wrap.
  - It needs `generateId` exported from the lib's `src/index.ts`, and the two guarded app call sites (`projectZip.ts:420`, `LocalStorageProvider.ts:73`) migrated to it.
- [x] **D9. Move `npm run docker:run` to port 8080** (decision 11). `compose.dev.yml:7` maps `"3000:80"`, so the local container's origin equals the backend's default `ALLOWED_ORIGINS` (`http://localhost:3000`), and the Origin gate always passes: the setup that hid the v3.9.0 403. It also clashes with `npm run dev`, which uses 3000 too.
  - **Done:** `c70537b5`. compose.dev.yml on `:8080` (throwaway project, no bind mount, `ALLOWED_ORIGINS` unset): the smoke journey and the Origin table pass in a real browser, 6/6. `git grep -n '3000:80'` still hits the docs that describe history (ADR 0048's Context, this file, known_issues CHR-07), but nothing in code or config.
  - **Change:** `compose.dev.yml:7` becomes `"8080:80"`. Leave `"3001:3001"` and the `docker:run` script as they are.
  - **Docs and comments that move with it:**
    - `packages/axoview-app/src/utils/apiBaseUrl.ts:7-22`: keep the A5/CHR-07 history, but note that compose.dev.yml moved to 8080 on this date (ADR 0048), and drop "the deployment deliberately serves on the port developers expect". **The code doesn't change.** Its production-build check is still the right guard for any prod bundle served on `localhost:3000`, and its tests stay as they are.
    - `packages/axoview-app/src/utils/__tests__/apiBaseUrl.test.ts:1-14`: rewrite the same history in the past tense.
    - `docs/deployment.md` §B: add one line saying `npm run docker:run` (compose.dev.yml) serves on `http://localhost:8080`, with the editor at `/app`, and publishes the backend on `:3001`.
    - C4's new testing.md section: say why the local Docker port is never 3000.
  - **Leave alone:**
    - `README.md`: it documents `docker compose up` on port 80, not docker:run.
    - `docs/manual-test-baseline.md`: its header marks it as a historical record not to follow as-is.
    - The ADR 0048 Context line, which describes what happened at the time.
  - **Verify:** `npm run docker:run`, then create and save a diagram at `http://localhost:8080/app`. The write succeeds through the Origin gate with no `ALLOWED_ORIGINS` override. Finally, `git grep -n '3000:80'` returns nothing.
- [x] **D10. Storage ON without a mount returned 500 on writes** (seen once, not investigated). Reproduce with `--no-volume`, then either file it in `known_issues.md` or strike this line.
  - **Struck, not reproduced:** storage ON with `--no-volume` (run `20260924-230815-372d`) passed 8/8, and every write returned 2xx.

## Where the plan was wrong (found while implementing, 2026-09-24)

- **A4, save:** with server storage, `toolbar-save` isn't rendered. The journey saves with Ctrl+S, which runs the same handler.
- **A4, the insecure-origin failure:** the plan expected a `pageerror`. With `generateId` reverted, an error boundary catches the throw, so none fires. What goes red is the journey's canvas assertion (A6 run 36074327050). The pageerror guard alone wouldn't have caught v3.9.1.
- **A2, `smoke-secure: tests-docker/`:** that would include `boot-storage-off.spec.ts`, which fails with storage ON. `smoke-secure` ignores it.
- **A6, "revert `generateId` to bare `crypto.randomUUID()`":** an early `return` in the current body breaks TypeScript narrowing and the image build. The revert has to restore the pre-v3.9.2 body.
- **C3, the estimate:** the full regression took 42 min at 1 worker, not 80.
- **D8:** not small; see the item.
- **D9, verify:** `git grep -n '3000:80'` can't come back empty, because the docs that describe the history still quote it. Scope the grep to code and config: `git grep -n '3000:80' -- ':!docs' ':!known_issues.md'`.
- **D10:** not reproduced.
- **ADR 0048 §1, "/ship needs no change":** true for `Docker Gate`, but the advisory regression needed `--required` in `/ship` anyway (B5).
- **Not in the plan:** the root `npm run test:e2e` script doesn't run on Windows, because cmd.exe can't parse `node_modules/.bin/playwright`. It predates this work. `node node_modules/@playwright/test/cli.js test --config packages/axoview-e2e/playwright.config.ts <files>` is the equivalent.

- **Found while preparing the close-out:**
  - the runner's `--files` never worked: it put the file filters after the multi-value `--project`, so Playwright read them as project names. That would have broken the CI attribute job the first time a shard failed. Fixed in `8a1b8c39`.
  - the smoke journey slept 500 ms for the explorer's click-to-open timer; it now waits for the row's `aria-current` (`2d9291e9`).
  - the runner printed the plan's estimates; it now prints the measured ETAs (`5d09afa8`).
- **B3 is still unexercised:** the attribute job only runs when a shard fails, and none has yet.

## Reference facts (verified 2026-09-24)

- **Insecure context without editing hosts files:**
  - Chromium's `--host-resolver-rules="MAP axoview.test 127.0.0.1"` plus `http://axoview.test:<port>/app`.
  - `localhost` and HTTPS are always secure contexts.
- **Check what an image really ships:**
  - `docker run --rm --entrypoint sh <img> -c '…'`.
  - Baseline image: `docker build -t axoview:baseline https://github.com/molikas/axoview.git#master`.
- **Attribution rule:** re-run the failing spec alone against a master image, in the same mode.
  - Fails there too: pre-existing or environmental.
  - Passes there: re-run the candidate alone. If it still fails, it's a regression; if not, it's a flake.
- **Known residue on a master image before C** (storage OFF, 280 of 289 passed):
  - `bulk-format-mixed:271` and 5 tests in `undo-page-navigation` (the MUI icons);
  - `landing-navigation`;
  - `share` (the URLs);
  - one load flake.
- **The fixtures don't clear the bridge flag.** `app.fixture.ts` removes 5 named keys, and nothing calls `localStorage.clear()`, so `axoview_perf_enabled` survives.
- **What the flag changes on a prod bundle:** it also starts the diagnostics rAF loop and shows the dock toggle. The panel stays closed (`_open` defaults to `false`). Dev builds are in this same state.
- **Storage-ON limits:** `clearAllStorage()` never clears the server. Between spec files, `rm -rf /data/diagrams/*` inside the container is a safe wipe (the fs adapter keeps no cache), but it doesn't isolate tests within a file.
- **`curl` sends no `Origin`,** but browsers send it on every non-GET request.

## Phase E — Close-out PR (the wrap-up; after PR #92 merges)

The last PR of this initiative carries the wrap-up, the notes that must outlive this file, and the `/ship` protocol change, together. It is the only change after #92.

**Preconditions, in order.** Prepare the branch early if useful, but open the PR only when all of these hold:

1. #92 is merged with a **merge commit** (not squash: its title is `ci(…)`, which cuts no release), and the release it cut is noted.
2. `Docker Gate` is green on master, and A7's ruleset PUT is done.
3. `Docker Regression Gate` is green on master, and the ruleset half of B5's flip is done: add `{"context":"Docker Regression Gate"}` the same way as A7.

The PUTs are GitHub settings changes, so each needs the owner's explicit yes. The close-out PR then shows both checks green as **required** checks.

**Branch and merge:** branch `docs/docker-regression-gate-closeout` off master, one commit per item below. Every commit is `docs`, `ci` or `chore`, so the merge cuts no release. Its own CI is the final proof that both checks are required and green.

- [x] **E1. ADR 0048 → Accepted.**
  - **Done:** ADR 0048 is Accepted on 2026-09-24, with its three acceptance criteria met and recorded, and §1 names `/ship`'s real step-3 command.
  - Set `**Status:** Accepted` and add `**Accepted on:** <date>` (the ADR 0045 shape).
  - In Acceptance criteria:
    - **Positive:** the first green `Docker Gate` run on master, and the date it joined `required_status_checks`;
    - **Runner hygiene:** point at B4's runs;
    - **Full regression:** the first green master run, and the date it joined the ruleset.
  - Tick A7 and B5's flip here before the file goes (E5).
- [x] **E2. The `/ship` protocol: B5's flip, docs half.**
  - **Done:** `3bd6301e`. `ship.md` now differs from its pre-initiative version only by `--required`.
  - In [ship.md](../../.claude/commands/ship.md), delete:
    - step 3b;
    - Phase 3's advisory-prompt exception sentence;
    - Phase 4's `Docker regression:` report line;
    - the strict-test-gate exception sentence.
  - Step 3 stays `gh pr checks --watch --required`, which now covers both Docker checks.
  - In [testing.md](../guidelines/testing.md)'s "Testing against the Docker image" table, both Status cells become `required`.
  - **Verify:** `grep -n '3b\|advisory' .claude/commands/ship.md` returns nothing Docker-related.
- [x] **E3. Notes: move what must outlive this file.** Go through "Where the plan was wrong", "Reference facts" and "Notes for Claude" line by line. Each line either moves to a permanent home or is dropped because testing.md or ADR 0048 already says it. Known moves:
  - **Done:** `cffdd587`, plus the memory note, which is local to Claude.
  - **testing.md, Docker section,** two lessons:
    - a `pageerror` guard misses a throw an error boundary catches, so assert that the UI actually rendered (A6 revert 3);
    - prove a gate by reverting each fix alone on a `gate-proof/**` branch, and don't count a revert that breaks the build.
  - **`known_issues.md`:** D8 as an Open entry. That's the `no-restricted-properties` rule for `crypto.randomUUID`, blocked on `jest.axoviewMock.ts` needing a `generateId` re-export or `generateId` moving into its own module.
  - **Claude's local memory** (not in the PR): repoint `docker-e2e-against-prod-image` at the runner and testing.md; its "temporary untracked config" advice is obsolete.
- [x] **E4. Repoint every pointer to this file** ([workflow.md](../workflow.md) Principle 5: pointers move in the commit that retires the file). `git grep -n 'tactical/docker-regression-gate'` lists them:
  - **Done:** `55c58a49`.
  - ADR 0048's Implementation-notes link;
  - the header comments of `docker-smoke.yml` and `docker-regression.yml`;
  - `playwright.docker.config.ts`;
  - the four `tests-docker/` files;
  - `scripts/e2e-docker.js` and `scripts/e2e-docker-attribute.js`.

  Point them at ADR 0048 and testing.md instead.
  - **Verify:** that grep finds only `docs/tactical/README.md` until E5 removes the row, and `lint:docs` passes.
- [ ] **E5. Wrap** (`/feature wrap docker-regression-gate`).
  - **PLAN.md:** Phase **5*** is a dashboard row with no section of its own, so append to that row's Notes cell, the way the landing page's wrap did:
    ```
    **Docker regression gate shipped <date>** — required `Docker Gate` smoke + `Docker Regression Gate` full E2E against the built image; see [ADR 0048](docs/adr/0048-docker-image-regression-gate.md) + retired `docs/tactical/docker-regression-gate.md` git history.
    ```
  - **[README.md](README.md):** remove this file's row and fix the count sentence.
  - Delete this file.
  - **Verify:** `lint:docs` passes, and `ls docs/tactical/` no longer lists this file.

## Notes for Claude

- One heavy stream at a time (decision 2). Say the ETA before any run longer than 2 minutes. Until A3 exists, follow the runner contract by hand.
- After any stop, abort or kill, run the leak audit. Stopping a background task leaves its children alive.
- Never point `playwright.config.ts` at a prod bundle; only `playwright.docker.config.ts` targets the image.
- Treat every Docker failure as unattributed until it has been re-run alone against a master image.
- Outward-facing actions need the owner: both ruleset PUTs (A7 and B5's flip), any push, and any PR to master. A6 runs by pushing a `gate-proof/**` branch, never through a PR.
- Seed the welcome card's dismissal flag; don't click it. The smoke gets past the first-run card the same way the other specs do (`ONBOARDING_DISMISS_FLAGS`). On a prod image its ✕ has no stable selector: it has no label and no test id, and MUI strips the icon's test id.
- After adding the Docker config and the `tests-docker/` directory, run `npx knip`. The e2e workspace's `**/*.spec.ts` entry covers the specs, and knip resolves the config through the package.json `--config` argument, but confirm it.
