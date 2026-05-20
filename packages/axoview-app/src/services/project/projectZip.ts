import JSZip from 'jszip';
import {
  DiagramMeta,
  FolderMeta,
  StorageProvider,
  TreeManifest
} from '../storage';

// ----------------------------------------------------------------------------
// Format constants — see ADR 0001
// ----------------------------------------------------------------------------

export const PROJECT_FORMAT = 'axoview-project';
// Pre-rename format string. Accepted on import for backwards compatibility
// with project ZIPs exported before the FossFLOW → Axoview rename.
// New exports always write PROJECT_FORMAT.
export const LEGACY_PROJECT_FORMATS = new Set(['fossflow-project']);
export const PROJECT_FORMAT_VERSION = '1';
const SUPPORTED_VERSIONS = new Set([PROJECT_FORMAT_VERSION]);
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type ExportScope = 'project' | 'folder' | 'diagram';

export interface ExportProjectOpts {
  scope: ExportScope;
  folderId?: string;
  diagramId?: string;
}

export interface ProjectManifest {
  format: typeof PROJECT_FORMAT;
  version: string;
  exportedAt: string;
  exportedBy: string;
  scope: ExportScope;
  folders: FolderMeta[];
  diagrams: Array<DiagramMeta & { file: string }>;
}

export interface ParsedProject {
  manifest: ProjectManifest;
  diagrams: Map<string, unknown>; // id → diagram model JSON (raw)
  treeManifest?: TreeManifest;
}

export type ImportDestination =
  | { kind: 'root' }
  | { kind: 'newFolder'; name: string }
  | { kind: 'replaceAll' };

export interface ImportProjectOpts {
  destination: ImportDestination;
}

export class ProjectZipError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'ProjectZipError';
  }
}

// ----------------------------------------------------------------------------
// Filenames (ADR 0001)
// ----------------------------------------------------------------------------

const fsTimestamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const slugify = (s: string) =>
  s.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'untitled';

export const projectZipFilename = (scope: ExportScope, label?: string): string => {
  const ts = fsTimestamp();
  if (scope === 'folder') return `axoview-folder-${slugify(label ?? 'folder')}-${ts}.zip`;
  return `axoview-project-${ts}.zip`;
};

// ----------------------------------------------------------------------------
// Export
// ----------------------------------------------------------------------------

interface ExportContext {
  storage: StorageProvider;
  exporterTag: string;
}

const collectFolderSubtree = (
  rootId: string,
  allFolders: FolderMeta[]
): FolderMeta[] => {
  const result: FolderMeta[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const f = allFolders.find((x) => x.id === id);
    if (!f) return;
    result.push(f);
    for (const child of allFolders.filter((x) => x.parentId === id)) walk(child.id);
  };
  walk(rootId);
  return result;
};

export const exportProject = async (
  ctx: ExportContext,
  opts: ExportProjectOpts
): Promise<{ blob: Blob; filename: string }> => {
  const { storage, exporterTag } = ctx;

  const allFolders = await storage.listFolders();
  const allDiagrams = await storage.listDiagrams();

  let folders: FolderMeta[];
  let diagrams: DiagramMeta[];
  let scopeLabel: string | undefined;

  if (opts.scope === 'project') {
    folders = allFolders;
    diagrams = allDiagrams;
  } else if (opts.scope === 'folder') {
    if (!opts.folderId) throw new ProjectZipError('folderId required for folder scope', 'BAD_INPUT');
    folders = collectFolderSubtree(opts.folderId, allFolders);
    const folderIds = new Set(folders.map((f) => f.id));
    diagrams = allDiagrams.filter((d) => d.folderId != null && folderIds.has(d.folderId));
    scopeLabel = folders[0]?.name;
  } else {
    if (!opts.diagramId) throw new ProjectZipError('diagramId required for diagram scope', 'BAD_INPUT');
    const meta = allDiagrams.find((d) => d.id === opts.diagramId);
    if (!meta) throw new ProjectZipError(`Diagram ${opts.diagramId} not found`, 'NOT_FOUND');
    folders = [];
    diagrams = [meta];
    scopeLabel = meta.name;
  }

  const zip = new JSZip();
  const diagramsDir = zip.folder('diagrams');
  if (!diagramsDir) throw new ProjectZipError('Failed to create diagrams folder', 'ZIP_ERROR');

  const manifestDiagrams: Array<DiagramMeta & { file: string }> = [];
  for (const meta of diagrams) {
    const model = await storage.loadDiagram(meta.id);
    const file = `diagrams/${meta.id}.json`;
    diagramsDir.file(`${meta.id}.json`, JSON.stringify(model));
    manifestDiagrams.push({ ...meta, file });
  }

  const manifest: ProjectManifest = {
    format: PROJECT_FORMAT,
    version: PROJECT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: exporterTag,
    scope: opts.scope,
    folders,
    diagrams: manifestDiagrams
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Tree manifest is best-effort — failure must not block export.
  try {
    const treeManifest = await storage.getTreeManifest();
    zip.file('tree-manifest.json', JSON.stringify(treeManifest));
  } catch {
    // skip
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return { blob, filename: projectZipFilename(opts.scope, scopeLabel) };
};

// ----------------------------------------------------------------------------
// Parse
// ----------------------------------------------------------------------------

export const parseProject = async (file: File | Blob): Promise<ParsedProject> => {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (err) {
    throw new ProjectZipError('Could not read zip archive', 'BAD_ZIP');
  }

  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) throw new ProjectZipError('Missing manifest.json', 'NO_MANIFEST');

  let manifest: ProjectManifest;
  try {
    manifest = JSON.parse(await manifestEntry.async('string'));
  } catch {
    throw new ProjectZipError('manifest.json is not valid JSON', 'BAD_MANIFEST');
  }

  if (manifest.format !== PROJECT_FORMAT && !LEGACY_PROJECT_FORMATS.has(manifest.format)) {
    throw new ProjectZipError(
      `Unrecognized format "${manifest.format}" — expected "${PROJECT_FORMAT}"`,
      'BAD_FORMAT'
    );
  }
  if (!SUPPORTED_VERSIONS.has(manifest.version)) {
    throw new ProjectZipError(
      `This project was exported by a newer Axoview (version ${manifest.version}); please upgrade.`,
      'UNSUPPORTED_VERSION'
    );
  }

  const diagrams = new Map<string, unknown>();
  for (const meta of manifest.diagrams ?? []) {
    if (!ID_PATTERN.test(meta.id)) {
      throw new ProjectZipError(`Invalid diagram id "${meta.id}"`, 'BAD_ID');
    }
    const path = meta.file ?? `diagrams/${meta.id}.json`;
    const entry = zip.file(path);
    if (!entry) throw new ProjectZipError(`Missing diagram file "${path}"`, 'MISSING_DIAGRAM');
    let model: unknown;
    try {
      model = JSON.parse(await entry.async('string'));
    } catch {
      throw new ProjectZipError(`Diagram ${meta.id} is not valid JSON`, 'BAD_DIAGRAM');
    }
    diagrams.set(meta.id, model);
  }

  for (const folder of manifest.folders ?? []) {
    if (!ID_PATTERN.test(folder.id)) {
      throw new ProjectZipError(`Invalid folder id "${folder.id}"`, 'BAD_ID');
    }
  }

  let treeManifest: TreeManifest | undefined;
  const tmEntry = zip.file('tree-manifest.json');
  if (tmEntry) {
    try {
      treeManifest = JSON.parse(await tmEntry.async('string'));
    } catch {
      // tree manifest is optional — ignore parse failures
    }
  }

  return { manifest, diagrams, treeManifest };
};

// ----------------------------------------------------------------------------
// ID rewriting
// ----------------------------------------------------------------------------

const newId = (prefix: 'diagram' | 'folder'): string => {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 18);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
};

const rewriteRefsInModel = (model: unknown, idMap: Map<string, string>): unknown => {
  if (model == null || typeof model !== 'object') return model;
  if (Array.isArray(model)) return model.map((m) => rewriteRefsInModel(m, idMap));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(model as Record<string, unknown>)) {
    if (k === 'link' && typeof v === 'string' && idMap.has(v)) {
      out[k] = idMap.get(v);
    } else {
      out[k] = rewriteRefsInModel(v, idMap);
    }
  }
  return out;
};

export interface RewriteResult {
  folders: FolderMeta[];
  diagrams: Array<DiagramMeta & { newId: string }>;
  models: Map<string, unknown>; // newId → rewritten model
  idMap: Map<string, string>; // oldId → newId (folders + diagrams)
}

export const rewriteIds = (parsed: ParsedProject): RewriteResult => {
  const idMap = new Map<string, string>();
  for (const folder of parsed.manifest.folders) idMap.set(folder.id, newId('folder'));
  for (const diagram of parsed.manifest.diagrams) idMap.set(diagram.id, newId('diagram'));

  const folders: FolderMeta[] = parsed.manifest.folders.map((f) => ({
    ...f,
    id: idMap.get(f.id)!,
    parentId: f.parentId ? idMap.get(f.parentId) ?? null : null
  }));

  const diagrams: Array<DiagramMeta & { newId: string }> = parsed.manifest.diagrams.map((d) => ({
    ...d,
    newId: idMap.get(d.id)!,
    folderId: d.folderId ? idMap.get(d.folderId) ?? null : null
  }));

  const models = new Map<string, unknown>();
  for (const d of parsed.manifest.diagrams) {
    const raw = parsed.diagrams.get(d.id);
    models.set(idMap.get(d.id)!, rewriteRefsInModel(raw, idMap));
  }

  return { folders, diagrams, models, idMap };
};

// ----------------------------------------------------------------------------
// Import
// ----------------------------------------------------------------------------

interface ImportContext {
  storage: StorageProvider;
}

const wipeWorkspace = async (storage: StorageProvider): Promise<void> => {
  const diagrams = await storage.listDiagrams();
  for (const d of diagrams) await storage.deleteDiagram(d.id, false);
  const folders = await storage.listFolders();
  // Delete children before parents — sort by depth (parent chain length).
  const depth = (f: FolderMeta): number => {
    let n = 0;
    let cur: FolderMeta | undefined = f;
    while (cur && cur.parentId) {
      const next = folders.find((x) => x.id === cur!.parentId);
      if (!next) break;
      cur = next;
      n++;
    }
    return n;
  };
  const sorted = [...folders].sort((a, b) => depth(b) - depth(a));
  for (const f of sorted) await storage.deleteFolder(f.id, false);
};

export const importProject = async (
  ctx: ImportContext,
  parsed: ParsedProject,
  opts: ImportProjectOpts
): Promise<{ folderCount: number; diagramCount: number }> => {
  const { storage } = ctx;

  if (opts.destination.kind === 'replaceAll') {
    await wipeWorkspace(storage);
  }

  const rewritten = rewriteIds(parsed);

  // Determine root override for top-level items.
  let rootOverride: string | null = null;
  if (opts.destination.kind === 'newFolder') {
    rootOverride = await storage.createFolder(opts.destination.name, null);
  }

  // Recreate folder tree. Parents must exist before children; sort by depth ascending.
  const depthIn = (f: FolderMeta): number => {
    let n = 0;
    let cur: FolderMeta | undefined = f;
    while (cur && cur.parentId) {
      const next = rewritten.folders.find((x) => x.id === cur!.parentId);
      if (!next) break;
      cur = next;
      n++;
    }
    return n;
  };
  const folderRemap = new Map<string, string>();
  const ordered = [...rewritten.folders].sort((a, b) => depthIn(a) - depthIn(b));
  for (const f of ordered) {
    const parentId = f.parentId
      ? folderRemap.get(f.parentId) ?? f.parentId
      : rootOverride;
    const realId = await storage.createFolder(f.name, parentId);
    folderRemap.set(f.id, realId);
  }

  let diagramCount = 0;
  for (const d of rewritten.diagrams) {
    const rawModel = rewritten.models.get(d.newId);
    if (rawModel == null) continue;
    // MQA #14 (Bundle B follow-up): the exported blob still carries its
    // original `id`. If a diagram with that id still exists in storage
    // (e.g. orphaned after a folder delete that didn't sweep its contents),
    // the server 409s and the whole import aborts. Strip the original id
    // and let the server allocate a fresh one — keeps import idempotent
    // against pre-existing collisions and matches the duplicate flow.
    const { id: _strippedId, ...model } =
      rawModel && typeof rawModel === 'object'
        ? (rawModel as Record<string, unknown>)
        : { id: undefined };
    const folderId = d.folderId
      ? folderRemap.get(d.folderId) ?? d.folderId
      : rootOverride;
    await storage.createDiagram(model, folderId);
    diagramCount++;
  }

  return { folderCount: rewritten.folders.length, diagramCount };
};
