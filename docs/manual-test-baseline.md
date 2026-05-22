# Axoview Manual Test Baseline

**Purpose:** Canonical "what does Axoview do today" record. Walked between Wave 3b (architectural surface frozen 2026-05-20) and T1 (E2E rewrite). Findings here seed T1's scenario catalog AND become the M10 ship-readiness checklist.

**Status:** _Started 2026-05-21 by Igor · last updated 2026-05-21 · walk complete; awaiting triage of two findings_

---

## How to use this doc

Fill it in as you walk — three buckets:

1. **Canonical journeys** (Section 3) — checkbox each one as you verify it works end-to-end. Add a one-line note if behaviour was surprising (good or bad). These journeys feed T1's E2E specs directly.
2. **Per-mode observations** (Section 4) — short prose per mode. Capture what felt right, what felt awkward, what diverged from your mental model. This is the part that's hardest to derive from code-reading; it's the highest-value output for T1.
3. **Findings register** (Section 5) — anything that's *broken*, *confusing*, or *inconsistent*. Each row gets a disposition on the spot: **bug** (→ new C.2 row to fix), **cosmetic** (→ polish backlog, defer), **intentional** (→ no action; the behaviour is correct, just noted), **triage** (→ I'm not sure; come back to this).

**Don't fix anything during the walk.** The point is observation. Fixes go into a follow-up cleanup wave once you know the full picture.

**Don't try to walk every A.4 surface exhaustively.** Section 4's per-mode walk lists the high-value surfaces — hit those plus anything that catches your eye. The audit's A.4 mode matrix is the exhaustive reference if you want it: `docs/tactical/productization-audit.md` § A.4.3.

---

## 1. Setup per mode

### Local (browser-only)

```bash
npm run dev
```

Open `http://localhost:3000/`. SPA persists to `localStorage`.

### Session — Self-host Docker

```bash
docker build -t molikas/axoview:latest .
cat > .env <<EOF
HTTP_AUTH_USER=testuser
HTTP_AUTH_PASSWORD=testpass
ENABLE_SERVER_STORAGE=true
EOF
docker compose up -d
sleep 20
```

Then:

```bash
# Verify HEALTHCHECK (I3 smoke)
docker ps --format 'table {{.Names}}\t{{.Status}}'
# → expect "Up X seconds (healthy)"

# Verify /healthz (I3 smoke)
curl -s http://localhost:3000/healthz
# → expect {"ok":true,"adapter":"fs","storage_writable":true}
# → no auth required (401 means nginx is gating it — flag in findings)

# Verify nginx auth bypass (B3 smoke)
curl -i http://localhost:3000/api/diagrams/anything                    # → 401
curl -i http://localhost:3000/api/public/diagrams/nonexistent-uuid     # → non-401
curl -i -u testuser:testpass http://localhost:3000/api/diagrams/anything  # → non-401
```

Then open `http://localhost:3000/` (with creds: `testuser` / `testpass`).

Cleanup when done: `docker compose down && rm .env`.

### Session — Cloudflare deploy

Open `https://axoview.pages.dev/` (or whichever URL the live deploy resolves to).

---

## 2. DevTools spot-check (do once per mode)

On each mode's first page load, open DevTools → Network tab. Verify:

- Exactly **ONE** request to `/api/config`.
- **ZERO** requests to `/api/storage/status`.

This is the I1 dual-probe-collapse smoke. If you see a `/api/storage/status` call, something missed the collapse — flag in findings.

| Mode | One /api/config? | Zero /api/storage/status? | Notes |
|---|---|---|---|
| Local | **0** (not made) | ✓ | SPA falls back to `localStorage` without the request firing at all in dev. Minor ADR-language divergence (0009 D2 wording implies "always one" /api/config) but behaviourally correct — the dual-probe spirit is satisfied. No action needed. |
| Session-Docker | ✓ (exactly 1) | ✓ | I1 contract honoured. |
| Session-Cloudflare | ✓ | ✓ | Inferred from "works the same as session mode" per Section 4c. |

---

## 3. Canonical user journeys

Each row applies to Local + Session unless noted. Tick on verification. One-line note column captures surprise (works = blank; works differently in Local vs Session = note that).

| # | Journey | Local | Session-Docker | Session-CF | One-line note |
|---|---|---|---|---|---|
| J1 | New diagram → place a few icons → save → close → reopen → state preserved |✓|✓|✓|passed|
| J2 | New diagram → draw a connector between two icons → undo/redo works correctly |✓|✓|✓|passed|
| J3 | New diagram → add a rectangle + a textbox → save → reopen → state preserved |✓|✓|✓|passed|
| J4 | Open existing diagram → rename via F2 in file explorer → save → reopen → name persists |✓|✓|✓|passed|
| J5 | Multi-diagram: create A, link a node to diagram B, click link → opens B |✗|✗|✗| Partially broken see notes |
| J6 | Layers: assign item to layer → hide layer → item hidden; lock layer → item not draggable |✓|✓|✓|passed|
| J7 | Import a JSON diagram → renders correctly |✓|✓|✓|✓|
| J8 | Export current diagram as JSON → file downloads → contents look right |✓|✓|✓|✓|
| J9 | Import a project ZIP → all diagrams + icons load |✓|✓|✓|✓|
| J10 | Export project ZIP → file downloads → can re-import into a clean session |✓|✓|✓|✓|
| J11 | Add a custom icon (Import Icons dialog) → drag to canvas → renders |✓|✓|✓|✓|
| J12 | Remove a custom icon that's in use → warning surfaces, behaviour matches expectations |✓|✓|✓|✓|
| J13 | Local-mode share-uuid (`/display/p/abc123`) → **B2 smoke**: explicit error dialog, dismiss strips URL | ✓ | n/a | n/a |✓|
| J14 | Session share link: generate from a diagram → URL copied → open in incognito → read-only view | n/a |✗|✗| conditionally passed see note on ux in section 4.|
| J15 | Hotkey sanity: Ctrl+S, Ctrl+Z, Ctrl+Y, Ctrl+A, Ctrl+C/X/V, Delete — each does what it claims |✓|✓|✓|passed|
| J16 | Settings dialog: open → all tabs render → close without changes → no state corruption |✓|✓|✓|passed|
| J17 | Help dialog: open → shortcuts listed match what J15 verified |✓|✓|✓| conditionally it seems like not all shortkuts are listes like alt+click|
| J18 | Diagnostics overlay: toggle on → renders → toggle off → goes away |✓|✓|✓| the diagnostis overlay that we have in Setting. not sure what that is used for and how it is usefull. we might need to get rid of it, i usually use only the performance debug overlay.|
| J19 | 2D canvas mode: toggle → switches projection cleanly → toggle back → return to iso |✓|✓|✓| passed|
| J20 | Empty state: delete all diagrams → EmptyStateScreen renders → "New / Import" buttons work |✓|✓|✓|passed|

**Tick legend:** `✓` = works · `✗` = broken (add a finding) · `~` = works but with a note · blank = not yet walked.

---

## 4. Per-mode observations


J14.  When a user open share diagram popover and tries to click on the input box or anywhere on the popover - the pop-over closes, the user can still sucessfully click on copy and copy the link.
J17.  Patially, doesn't seem like all key controls are listed in example alt+click to remove waypoint.


### 4a. Local mode

_Walked: 2026-05-21_

Observations:

J5. Issues
1. Session mode you can link diagrams in session mode, but there is no preview. sp this feature cannot be used essentially.
2. You can self reference in the diagram. in example "Diagram A" can have a link to "Diagram A" which would only make sense if it referenced another view in "Diagram A" but most diagrams only have 1 view by default

What surprised me:

n/a

### 4b. Session — Self-host Docker

_Walked: 2026-05-21_

Observations:

J5. Issues
1. preview link is borken, but the share link works fine. When you click preview link it just opens the same diagram in edit mode again.
2. Linked diagram in view only mode does not navigate properly 
 Working Link from share dialog http://localhost:3000/display/p/bEYUUldOo-jvsYtSUELeg
 Broken Link in preview mode in the right details deck http://localhost:3000/display/diagram_1775916857851

What surprised me:

n/a

### 4c. Session — Cloudflare deploy

_Walked: 2026-05-21_

Observations:

- works the same way as session mode as expected

What surprised me:

- n/a

**Cross-mode divergences** (Session-Docker behaviour ≠ Session-Cloudflare behaviour, or Local ≠ Session in a way that's not the expected mode-conditional UI):

- n/a it look that all three modes work consistently with the only expected difference that in server mode you have persistant storage and aility to share diagram previews.

---

## 5. Findings register

Every anomaly noticed gets one row. Disposition on the spot.

| # | Surface | Mode(s) | What happened | Expected? | Disposition | Action target |
|---|---|---|---|---|---|---|
| 1 | Diagram-to-diagram link — **no preview surface** (J5) | Local | Diagram-link node can be created but there's no preview affordance — the feature is essentially unreachable | Preview link should open the linked diagram in read-only view | **bug** _(Resolved 2026-05-22, commit `2a04061`)_ | C.2 B-1 |
| 2 | Diagram-to-diagram link — **self-reference allowed** (J5) | Local | "Diagram A" can link to "Diagram A" — meaningful only if multiple views exist, but most diagrams have one view by default | Prevent self-reference at the UI level (filter current diagram out of the link picker) | **bug** _(Resolved 2026-05-22, commit `84f4e09`)_ | C.2 B-2 |
| 3 | Diagram-to-diagram link — **preview opens edit mode** (J5) | Session-Docker, Session-CF | Clicking the preview link in the right details deck opens the same diagram in edit mode instead of preview/read-only | Should navigate to the linked diagram in read-only view at `/display/<diagramId>` and actually render it | **bug** _(Resolved 2026-05-22, commit `2a04061`)_ | C.2 B-1 |
| 4 | Diagram-to-diagram link — **view-only navigation broken** (J5) | Session-Docker, Session-CF | URL `/display/diagram_1775916857851` does not navigate properly; the share-style URL `/display/p/<uuid>` works fine | Both URL forms should resolve to a working read-only view (or the link should use the working URL form) | **bug** _(Resolved 2026-05-22, commit `2a04061`)_ | C.2 B-1 |
| 5 | Share dialog popover — **closes on input click** (J14) | Session-Docker, Session-CF | Clicking the input box or empty space inside the share popover closes the popover; copy button still works | Popover should stay open while interacting with its inputs (focus management bug) | **bug** | new C.2 row |
| 6 | HelpDialog — **missing shortcuts** (J17) | All modes | Alt+click (remove waypoint) and likely other shortcuts are not listed in the HelpDialog | All canonical shortcuts should be documented in HelpDialog | **bug** (small) | new C.2 row |
| 7 | Diagnostics overlay duplication (J18) | All modes | Two diagnostics surfaces exist: SettingsDialog DiagnosticsTab (never used) + the floating performance debug overlay (FPS / heap / long-tasks / nodes-connectors-textboxes counts / GC events / AI+Human export — actively used) | Two surfaces collapse to one: keep the performance overlay AS-IS (DiagnosticsOverlay + DiagnosticsToggleButton); delete the SettingsDialog tab and any code that exists only for it | **bug** _(triage resolved 2026-05-21)_ | new C.2 row — delete DiagnosticsTab + verify diagnosticsStore.ts and any helpers are still referenced by the overlay; if only the tab referenced them, delete those too (no dead code) |
| 8 | `compose.yml` requires Docker Hub pull (onboarding friction) | Self-host | `docker compose up --build` fails for new deployers because `molikas/axoview` is not published | **Docker Hub publish deferred to a future feature** (own ADR + tactical when wanted). Today: people check out the repo, run `docker compose up --build`, deploy the locally-built image somewhere. No tech debt left for the future feature — anything that exists only to support publishing gets removed cleanly now. | **bug** _(scope resolved 2026-05-21)_ | C.2 row: delete `.github/workflows/docker.yml` + drop `image:` line + add `build: .` to `compose.yml` + README onboarding instructions + drop T2 G6 (container scanning) + drop T4 `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN` external-action items |

**Disposition glossary:**
- **bug** — real defect; goes into a new C.2 row to fix
- **cosmetic** — visual drift, not behaviour-breaking; goes to polish backlog
- **intentional** — current behaviour is correct, documented here for reference
- **triage** — I'm not sure; come back to this

After the walk: bucket totals.

| Disposition | Count |
|---|---|
| bug | 8 (after both triage items resolved → bug); **4 resolved 2026-05-22 (findings #1–#4 via B-1 + B-2); 4 remaining (#5–#8)** |
| cosmetic | 0 |
| intentional | 0 |
| triage | 0 _(both resolved 2026-05-21)_ |

**Anecdotal observation (no row needed):** performance / FPS drops noticed in earlier sessions appear to have disappeared. No action required; nice signal that the Wave 3a/3b cleanups didn't introduce regressions and may have helped indirectly.

---

## 6. Screenshots / evidence

Drop file paths or notes here. Inline references look like `![Settings dialog](screenshots/settings.png)`.

- _(add as you take them)_

---

## 7. Ready for T1?

- [x] Every canonical journey J1–J20 walked in all applicable modes
- [x] DevTools spot-check passed in all three modes _(see Section 2 — Local has 0 calls intentionally; Session has the contracted 1)_
- [x] B2 smoke verified (J13 ✓ in Local)
- [x] B3 + I3 smokes verified during Session-Docker setup
- [x] All findings triaged _(8 bugs, 0 triage remaining)_
- [ ] Any **bug**-bucket items added as new C.2 rows _(pending — see "Next" section below; next agent session executes this)_
- [x] Any **triage**-bucket items resolved _(both resolved 2026-05-21)_
- [x] Per-mode observation sections have at least 3 bullets each

When all of the above is checked: this doc is T1's input spec. Commit + report back.

---

## Next (post-walk)

All triage resolved 2026-05-21. The findings produce the following new C.2 rows (next agent session adds them; execution follows in a later cleanup wave):

- **C2.1 — Diagram-link UX bugs** (Findings #1, #3, #4 combined — same feature, three observable failures): no preview affordance in Local; preview link opens current diagram in edit mode (Session); view-only navigation broken via `/display/<diagramId>` while `/display/p/<uuid>` works.
- **C2.2 — Diagram-link self-reference prevention** (Finding #2): filter the current diagram from the link picker.
- **C2.3 — Share dialog popover focus management** (Finding #5): popover should stay open while interacting with its inputs.
- **C2.4 — HelpDialog shortcut completeness** (Finding #6): add Alt+click (and any other missing canonical shortcuts) to the listing.
- **C2.5 — SettingsDialog DiagnosticsTab deletion** (Finding #7): remove the tab + any code that exists only for it; the performance overlay (DiagnosticsOverlay + DiagnosticsToggleButton + the FPS/heap/long-tasks/GC-event/export-buttons surface) stays untouched.
- **C2.6 — Docker Hub publish deferral** (Finding #8): delete `.github/workflows/docker.yml`; replace `image: molikas/axoview:latest` with `build: .` in `compose.yml`; update README with canonical `docker compose up --build` self-host instructions; drop T2 G6 (container scanning) from the git-automation tactical; drop DOCKERHUB items from T4. Future Docker Hub publish becomes its own feature (own ADR + tactical) when desired.

The C2.* numbering is local to this baseline doc; the next agent session will assign these proper IDs in the audit's C.2 plan.
