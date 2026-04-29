/**
 * Storage adapter contract — implemented by `fs.js` (Node, Docker target).
 * The route layer never sees a filesystem path; it only knows opaque keys
 * like `diagrams/<id>`, `folders`, `tree-manifest`, `public/<uuid>`.
 *
 *   - fs: `diagrams/<id>` → `<STORAGE_PATH>/<id>.json` (flat — backward-compatible)
 */
export interface StorageAdapter {
  get(key: string): Promise<Uint8Array | null>;
  put(key: string, value: Uint8Array): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
  listDiagramMeta(): Promise<DiagramMeta[]>;
}

export interface DiagramMeta {
  id: string;
  name: string;
  lastModified: string;
  folderId: string | null;
  deletedAt: string | null;
}

export interface FolderMeta {
  id: string;
  name: string;
  parentId: string | null;
}
