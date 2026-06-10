import type { Icon, Colors, ModelItem, View } from 'axoview';

/**
 * The loose blob shape persisted to storage. Includes legacy fields produced
 * by older exports (`name`, `t` compact-format alias) and storage-only fields
 * (`folderId`, `created`, `lastModified`) that aren't part of the strict
 * in-memory model (see `DiagramData` in `diagramUtils.ts`).
 *
 * Use `isPersistedDiagramBlob()` to narrow from `unknown` at storage and
 * import boundaries before reading individual fields.
 */
export interface PersistedDiagramBlob {
  title?: string;
  /** Legacy alias for title (some imports use this). */
  name?: string;
  /** Compact-format title field. */
  t?: string;
  version?: string;
  description?: string;
  icons?: Icon[];
  colors?: Colors;
  items?: ModelItem[];
  views?: View[];
  fitToScreen?: boolean;
  requiredPacks?: string[];
  folderId?: string | null;
  created?: string;
  lastModified?: string;
  sharedAt?: string;
}

/**
 * Narrow an opaque JSON-parsed value to a diagram blob. Returns true for any
 * plain object — field validation is the consumer's responsibility (each
 * field is optional in `PersistedDiagramBlob`).
 */
export function isPersistedDiagramBlob(x: unknown): x is PersistedDiagramBlob {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export interface DiagramMeta {
  id: string;
  name: string;
  lastModified: string;    // ISO 8601
  folderId: string | null; // null = root
  isDirty?: boolean;       // client-side only
  thumbnail?: string;      // base64 PNG, generated on save
  lockedBy?: string;       // reserved for P3 collaboration — leave undefined for now
  deletedAt?: string;      // ISO 8601 — soft delete, null = not deleted
}

export interface FolderMeta {
  id: string;
  name: string;
  parentId: string | null;
  isExpanded?: boolean;    // tree UI state
  deletedAt?: string;      // ISO 8601 — soft delete
}

export interface TreeManifest {
  folders: FolderMeta[];
  // diagram folderId is stored on DiagramMeta, not here
}

export interface StorageProvider {
  id: 'local' | 'google-drive';
  displayName: string;
  requiresAuth: boolean;

  isAvailable(): Promise<boolean>;

  // Diagrams
  listDiagrams(folderId?: string | null): Promise<DiagramMeta[]>;
  loadDiagram(id: string): Promise<unknown>;
  saveDiagram(id: string, data: unknown): Promise<void>;
  createDiagram(data: unknown, folderId?: string | null): Promise<string>;
  deleteDiagram(id: string, soft?: boolean): Promise<void>;
  restoreDiagram(id: string): Promise<void>;   // clears deletedAt
  renameDiagram(id: string, name: string): Promise<void>;

  // Folders
  listFolders(parentId?: string | null): Promise<FolderMeta[]>;
  createFolder(name: string, parentId?: string | null): Promise<string>;
  deleteFolder(id: string, recursive: boolean): Promise<void>;
  renameFolder(id: string, name: string): Promise<void>;
  moveItem(
    id: string,
    type: 'diagram' | 'folder',
    targetFolderId: string | null
  ): Promise<void>;

  // Tree manifest (open/close state, ordering)
  getTreeManifest(): Promise<TreeManifest>;
  saveTreeManifest(manifest: TreeManifest): Promise<void>;

  // Sharing — publish/unpublish a public snapshot. Returns the shareable URL.
  // Throws if the provider does not support shares (e.g. session-only).
  shareDiagram?(id: string): Promise<{ uuid: string; url: string; sharedAt: string }>;
  unshareDiagram?(id: string): Promise<void>;

  // Reserved for P3 — no-op stubs for now
  subscribe?(diagramId: string, callback: () => void): () => void;
}
