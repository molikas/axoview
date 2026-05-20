# ADR 0001 — Project Zip Format

**Status:** Accepted
**Date:** 2026-04-30
**Supersedes:** none
**Superseded by:** none

## Context

Axoview today imports/exports a single diagram as JSON. With the file explorer (Phase 2B-R), a workspace contains many diagrams in a folder tree plus UI state. There is no way to export the whole workspace, nor to hand it to someone else, nor to back it up.

In session-storage mode this is acute — sessionStorage dies with the tab, so the only durable persistence is download-and-reimport. Even in server mode, "give me my whole workspace as a file" is a missing primitive.

We need a workspace bundle format that is:

- portable across runtimes (server / Cloudflare / session),
- losslessly round-trippable (re-import gives the same workspace),
- simple enough that a human can unzip and inspect it,
- versioned so future changes don't break older bundles.

## Decision

A Axoview project is a single `.zip` file with this layout:

```
project.zip
├── manifest.json
├── diagrams/
│   ├── <id>.json
│   ├── <id>.json
│   └── ...
└── tree-manifest.json        (optional — UI state)
```

### `manifest.json`

```jsonc
{
  "format": "axoview-project",
  "version": "1",
  "exportedAt": "2026-04-30T14:32:11.123Z",
  "exportedBy": "axoview-app@1.11.0",
  "scope": "project",                 // "project" | "folder" | "diagram"
  "folders": [                        // mirrors /api/folders shape
    { "id": "folder_abc", "name": "Networking", "parentId": null },
    { "id": "folder_xyz", "name": "Internal",   "parentId": "folder_abc" }
  ],
  "diagrams": [                       // mirrors DiagramMeta shape
    {
      "id": "diagram_123",
      "name": "VPC layout",
      "folderId": "folder_abc",
      "lastModified": "2026-04-30T13:01:09.000Z",
      "file": "diagrams/diagram_123.json"
    }
  ]
}
```

`format` is the magic string used to detect that a `.zip` is a Axoview project (vs an arbitrary archive). `version` enables migration on import.

### `diagrams/<id>.json`

Each diagram is the model JSON exactly as produced by `modelFromModelStore` after the lean-icon-save pass (see [ADR 0003](0003-session-storage-lean-icon-save.md)).

Custom (user-imported) icons remain embedded as base64 inside the diagram's `icons[]` entries — option (a) from the design discussion. We deferred extracting them into a shared `images/` folder; revisit if a single project ever exceeds ~50 MB.

### `tree-manifest.json`

The UI state from `GET /api/tree-manifest` (folder open/closed flags, ordering hints). Optional — a project zip without it imports with everything collapsed. Including it (the default) makes re-import look identical to how the user left things.

### Filename convention

`axoview-project-<YYYY-MM-DDTHH-mm-ss>.zip` for full-project exports.
`axoview-folder-<folderName>-<timestamp>.zip` for folder scope.
`axoview-diagram-<diagramName>-<timestamp>.json` for single-diagram (no zip — backwards-compatible with current export).

## Import semantics

Re-import is the messy half. The contract:

1. **ID rewriting.** Every imported diagram and folder gets a fresh ID generated client-side (NanoID, same alphabet as existing IDs). The import pipeline maintains a `Map<oldId, newId>` and rewrites:
   - `diagrams[].folderId`
   - `folders[].parentId`
   - any cross-diagram link references inside the diagram model (item-level `link` fields, view connector refs).
   This guarantees collisions cannot happen, even when re-importing the same zip into the same workspace.
2. **Destination picker** (in the import dialog):
   - **Merge into root** — folders and diagrams attach at the workspace root, preserving relative tree shape.
   - **New folder** — a single new folder named after the zip filename is created at root, everything attaches under it.
   - **Replace all** — destructive; deletes every existing diagram and folder, then imports. Requires the user to type the literal string `replace` to confirm.
3. **Validation.** Reject the zip if `manifest.json` is missing, `format !== "axoview-project"`, or `version` is unknown. Reject any diagram whose `id` doesn't match `^[a-zA-Z0-9_-]{1,64}$` (defense in depth — the IDs get rewritten, but a malformed ID could still appear in cross-references).
4. **Single-JSON imports** stay supported. Dragging a `.json` (current or compact format) into the explorer imports one diagram into the selected folder, no manifest required.

## Versioning

`manifest.json#version` is a string. Future bumps:

- `"1"` → `"2"`: breaking change to a diagram field. Importer reads `version`, runs `migrate_v1_to_v2()` per diagram, then proceeds normally.
- The importer never refuses an older version; it migrates. Newer versions are refused with a clear error ("This project was exported by a newer Axoview; please upgrade").

## Consequences

**Positive:**

- One format covers session-mode "save your work," server-mode backup, and workspace transfer between users/runtimes.
- Symmetric UX across modes — Import/Export buttons in the file-explorer toolbar work the same on Cloudflare, Docker, and session.
- Human-inspectable: unzip and read.
- ID-rewriting on import means import is idempotent and never destructive (except explicit "Replace all").

**Negative:**

- Import can't preserve original IDs, so external links into the workspace (e.g. saved share URLs) won't survive a project round-trip. Acceptable: share URLs are server-mode only, and re-sharing is one click.
- Tree-manifest in the zip can drift from the workspace state at export time if export is async. We snapshot synchronously to avoid this.
- ZIP creation/parsing pulls in a dependency (`jszip` is the reasonable choice; ~96 KB). Bundle size acceptable.

## Implementation notes (non-binding)

- ZIP library: `jszip` for both write and read. Browser-only is fine; both server and Cloudflare runtimes only ever serve the file, they don't compose it.
- Streaming export: not needed at v1 (workspaces fit in memory).
- Per-folder export = same code path as project export with `scope: "folder"` and the folder/diagram lists pre-filtered.

## Acceptance criteria

- A workspace exported as a project zip and re-imported via "Merge into root" produces a workspace identical to the original modulo IDs and `lastModified`.
- A zip from "Replace all" import with the same zip restores the workspace bit-for-bit (modulo IDs).
- Importing a malformed zip surfaces a clear error and leaves the workspace untouched.
- Importing a v2 zip into a v1-aware build surfaces a clear "newer format" error.
