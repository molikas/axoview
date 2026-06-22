# /ship — Promote integration → master

End-of-session promotion: take the current working branch (default: integration), verify it's green, and merge into master with a non-fast-forward merge commit. Always returns you to the working branch when done. Companion to `/notes` — run `/notes` first to sync docs and (optionally) cut a release; then `/ship` puts the cut onto master.

> **Refuse if the current branch is master.** Promoting master to master is meaningless; you almost certainly meant something else. Stop and ask which branch you meant.

## Phase 1 — Pre-flight (no changes)

Run all of the following in parallel:

```bash
git status --short                       # must be clean (or only contain staged work the user named)
git branch --show-current                # → working branch (default: integration)
git log origin/<branch>..HEAD --oneline  # → commits not yet on remote
git log master..HEAD --oneline           # → commits to be merged (must be non-empty)
git rev-parse HEAD                       # → working SHA
git rev-parse master                     # → master SHA
git remote get-url origin                # → for the compare link in Phase 4
```

Then **verify version coherence** — `/notes` cuts a release across 5 package.json files; if they drift, ship would publish a mismatched version. Read the `"version"` line in all 5 and assert equality:

- `package.json`
- `packages/axoview-app/package.json`
- `packages/axoview-lib/package.json`
- `packages/axoview-backend/package.json`
- `packages/axoview-worker/package.json`

**Test gate (strict).** Run both suites and require zero failures:

```bash
npm test --workspace=packages/axoview-lib
npm test --workspace=packages/axoview-app
```

If any test fails, stop and report. Do not propose tolerance lists — broken tests are either real regressions (fix them) or stale (delete or repair them). Direct the user to fix and re-run `/ship`.

## Phase 2 — Plan + confirm

Before any git mutation, output a single user-facing block with two parts:

**Part 1 — survey (what /ship found):**

```
Working branch: <branch>
  HEAD: <sha> <subject line>
  Unpushed: <N> commit(s)
  Versions: <X.Y.Z> (all 5 package.json files match)

To merge into master:
  <N commits since master>
  - <sha> <subject>
  - <sha> <subject>
  ...

Test gate: lib <N>/<N> suites · app <N>/<N> suites · all passing
```

**Part 2 — plan (what /ship is about to do):**

Spell out the exact ordered git commands. Substitute real branch name + commit subjects so the user can spot a wrong-branch ship in the plan, not after.

```
Plan:
  1. git push origin <branch>                        # publish unpushed commits (if any)
  2. git checkout master
  3. git pull --ff-only origin master                # match remote head
  4. git merge <branch> --no-ff -m "Merge branch '<branch>' into master"
     → expected merge of: <subject of HEAD> (+<N-1> others if N>1)
  5. git push origin master
  6. git checkout <branch>                           # always return here

On merge conflict: abort, return to <branch>, surface conflict files.
On any push failure: stop and report. Never force-push.
```

Then a single confirmation prompt: *"Proceed with this plan? Yes / No."* Skill stops if not yes.

## Phase 3 — Promote

Execute the plan exactly as printed in Phase 2. Don't deviate, don't optimize, don't combine. The user reviewed those exact commands.

If `git merge` returns a conflict:

1. `git merge --abort`
2. `git checkout <working-branch>` — always return the user to their working branch
3. Report the conflict files. Do not attempt auto-resolution.

## Phase 4 — Report

```
Shipped:
  master:  <sha-before> → <sha-after>  (merge commit <sha>)
  <branch>: still at <sha>
  Pushed to origin/master + origin/<branch>

Diff shipped:
  <git diff --shortstat master~..master output>

Subjects merged:
  - <sha> <subject>
  - ...

You're back on <branch>.
```

If `git remote get-url origin` returned a GitHub URL, append a compare link: `https://github.com/<owner>/<repo>/compare/<sha-before>...<sha-after>`.

## Hard rules

- **Always print the plan before mutating.** Phase 2 part 2 is non-optional. The user must see the exact commands before confirming.
- **Never force-push.** Plain `git push` only.
- **Never amend or rebase.** Merge workflow only.
- **Never skip hooks** (`--no-verify`).
- **Never auto-resolve merge conflicts.** Always abort + return + report.
- **Always restore the working branch** at the end, even on partial failure.
- **Refuse on master.** The skill is meaningless from master.
- **No tags.** This repo doesn't use git tags as release markers — the CHANGELOG section is authoritative.
- **Strict test gate.** Any test failure aborts. Don't propose tolerance lists.
