import {
  DiagramMeta,
  FolderMeta,
  StorageProvider,
  TreeManifest
} from '../types';
import { apiBaseUrl } from '../../../utils/apiBaseUrl';

/**
 * Apply ADR 0003 lean-save: keep only user-supplied (imported) icons.
 * Pack icons (isoflow, aws, gcp, …) are always rehydrated from the icon pack
 * manager on load, so there is no need to persist their SVG payloads.
 *
 * Also persists `requiredPacks` — the unique non-isoflow/imported collections
 * actually referenced by items — so the load path can fetch exactly those
 * packs without having to introspect bare icon-id strings.
 */
const leanIfModel = (data: unknown): unknown => {
  if (data && typeof data === 'object' && Array.isArray((data as any).icons)) {
    const model = data as any;

    // Plain Object dictionaries instead of Set: ts-jest transpiles `new Set`
    // under target=es5 with a broken polyfill where `.add()` is a no-op for
    // string members, making derived-/known- lookups silently empty.
    const itemIconIds: { [k: string]: true } = {};
    if (Array.isArray(model.items)) {
      for (let i = 0; i < model.items.length; i++) {
        const item = model.items[i];
        if (item && typeof item.icon === 'string') itemIconIds[item.icon] = true;
      }
    }

    const knownIconIds: { [k: string]: true } = {};
    const derivedRequiredPacks: { [k: string]: true } = {};
    for (let i = 0; i < model.icons.length; i++) {
      const icon = model.icons[i];
      if (icon && icon.id) knownIconIds[icon.id] = true;
      if (
        icon &&
        icon.id &&
        itemIconIds[icon.id] &&
        typeof icon.collection === 'string' &&
        icon.collection !== 'isoflow' &&
        icon.collection !== 'imported'
      ) {
        derivedRequiredPacks[icon.collection] = true;
      }
    }

    // If every item's icon resolves against the icons array, the derived list
    // is authoritative. Otherwise the input is already lean (icons stripped to
    // imported-only) and we can't see what packs the unresolved items need —
    // preserve whatever was on the input rather than overwriting with [].
    let allResolved = true;
    const itemIconIdList = Object.keys(itemIconIds);
    for (let i = 0; i < itemIconIdList.length; i++) {
      if (!knownIconIds[itemIconIdList[i]]) { allResolved = false; break; }
    }
    const existingRequiredPacks = Array.isArray(model.requiredPacks)
      ? (model.requiredPacks as unknown[]).filter((p): p is string => typeof p === 'string')
      : null;
    const derived = Object.keys(derivedRequiredPacks);
    const requiredPacks = allResolved
      ? derived
      : (existingRequiredPacks !== null ? existingRequiredPacks : derived);

    return {
      ...model,
      icons: (model.icons as any[]).filter((icon: any) => icon.collection === 'imported'),
      requiredPacks
    };
  }
  return data;
};

const SESSION_DIAGRAMS_KEY = 'fossflow_diagrams';
const SESSION_DIAGRAM_PREFIX = 'fossflow_diagram_';
const LOCAL_FOLDERS_KEY = 'fossflow-folders';
const LOCAL_MANIFEST_KEY = 'fossflow-tree-manifest';

// Date.now() alone collides when many ids are minted in the same tick (e.g.
// during a project import loop). A collision on folder ids lets the import's
// parent-remap produce a folder whose parentId equals its own id, which the
// recursive tree builder then walks forever.
function uniqueSuffix(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${Date.now().toString(36)}_${rand}`;
}

/** Builds an AbortSignal with timeout, falling back gracefully if unavailable. */
function timeoutSignal(ms: number): AbortSignal | undefined {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(ms);
  }
  return undefined;
}

export class LocalStorageProvider implements StorageProvider {
  readonly id = 'local' as const;
  readonly displayName = 'Local Storage';
  readonly requiresAuth = false;

  /** True when server storage resolved as available during the last isAvailable() call */
  usingServer = false;

  private readonly baseUrl: string;
  private serverAvailable: boolean | null = null;
  private serverCheckedAt: number | null = null;
  private readonly AVAILABILITY_CACHE_MS = 60000;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? apiBaseUrl();
  }

  // ---------------------------------------------------------------------------
  // Availability
  // ---------------------------------------------------------------------------

  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (
      this.serverAvailable !== null &&
      this.serverCheckedAt !== null &&
      now - this.serverCheckedAt < this.AVAILABILITY_CACHE_MS
    ) {
      return true; // provider is always available (server or fallback)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/storage/status`, {
        signal: timeoutSignal(5000)
      });
      const data = await response.json();
      this.serverAvailable = !!data.enabled;
    } catch {
      this.serverAvailable = false;
    }

    this.usingServer = this.serverAvailable === true;
    this.serverCheckedAt = Date.now();
    return true; // always available
  }

  private async ensureChecked(): Promise<void> {
    if (this.serverAvailable === null) {
      await this.isAvailable();
    }
  }

  // ---------------------------------------------------------------------------
  // Diagrams — server path
  // ---------------------------------------------------------------------------

  private async serverListDiagrams(folderId?: string | null): Promise<DiagramMeta[]> {
    const params = folderId != null ? `?folderId=${encodeURIComponent(folderId)}` : '';
    const response = await fetch(`${this.baseUrl}/api/diagrams${params}`, {
      signal: timeoutSignal(10000)
    });
    if (!response.ok) throw new Error(`Failed to list diagrams: ${response.status}`);
    const list = await response.json();
    return list.map((d: any) => ({
      id: d.id,
      name: d.name,
      lastModified: typeof d.lastModified === 'string'
        ? d.lastModified
        : new Date(d.lastModified).toISOString(),
      folderId: d.folderId ?? null,
      deletedAt: d.deletedAt ?? undefined
    }));
  }

  private async serverLoadDiagram(id: string): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}/api/diagrams/${id}`, {
      signal: timeoutSignal(10000)
    });
    if (!response.ok) throw new Error(`Failed to load diagram: ${response.status}`);
    return response.json();
  }

  private async serverSaveDiagram(id: string, data: unknown): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/diagrams/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leanIfModel(data)),
      signal: timeoutSignal(15000)
    });
    if (!response.ok) throw new Error(`Failed to save diagram: ${response.status}`);
  }

  private async serverCreateDiagram(
    data: unknown,
    folderId?: string | null
  ): Promise<string> {
    const body = folderId != null ? { ...(data as object), folderId } : data;
    const response = await fetch(`${this.baseUrl}/api/diagrams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: timeoutSignal(15000)
    });
    if (!response.ok) throw new Error(`Failed to create diagram: ${response.status}`);
    const result = await response.json();
    return result.id;
  }

  private async serverDeleteDiagram(id: string, soft = false): Promise<void> {
    if (soft) {
      const response = await fetch(`${this.baseUrl}/api/diagrams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedAt: new Date().toISOString() }),
        signal: timeoutSignal(10000)
      });
      if (!response.ok) throw new Error(`Failed to soft-delete diagram: ${response.status}`);
    } else {
      const response = await fetch(`${this.baseUrl}/api/diagrams/${id}`, {
        method: 'DELETE',
        signal: timeoutSignal(10000)
      });
      if (!response.ok) throw new Error(`Failed to delete diagram: ${response.status}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Diagrams — session storage fallback
  // ---------------------------------------------------------------------------

  private sessionListDiagrams(folderId?: string | null): DiagramMeta[] {
    const raw = sessionStorage.getItem(SESSION_DIAGRAMS_KEY);
    if (!raw) return [];
    const list: DiagramMeta[] = JSON.parse(raw);
    if (folderId === undefined) return list;
    return list.filter((d) => d.folderId === folderId);
  }

  private sessionLoadDiagram(id: string): unknown {
    const raw = sessionStorage.getItem(`${SESSION_DIAGRAM_PREFIX}${id}`);
    if (!raw) throw new Error('Diagram not found');
    return JSON.parse(raw);
  }

  private sessionSaveDiagram(id: string, data: unknown): void {
    const lean = leanIfModel(data);
    sessionStorage.setItem(`${SESSION_DIAGRAM_PREFIX}${id}`, JSON.stringify(lean));
    const list = this.sessionListDiagrams();
    const idx = list.findIndex((d) => d.id === id);
    const existing = idx >= 0 ? list[idx] : undefined;
    const name = (data as any)?.name || (data as any)?.title || existing?.name || 'Untitled Diagram';
    // Preserve the existing meta's folderId when the save payload doesn't carry one.
    // Autosave strips folderId from the model; without this fallback every autosave
    // would relocate the diagram to root.
    const dataFolderId = (data as any)?.folderId;
    const folderId =
      dataFolderId !== undefined ? dataFolderId : existing?.folderId ?? null;
    const meta: DiagramMeta = {
      id,
      name,
      lastModified: new Date().toISOString(),
      folderId
    };
    if (idx >= 0) list[idx] = meta;
    else list.push(meta);
    sessionStorage.setItem(SESSION_DIAGRAMS_KEY, JSON.stringify(list));
    // Notify subscribers (storage gauge) — sessionStorage has no native cross-component event.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('fossflow-session-changed'));
    }
  }

  private sessionCreateDiagram(data: unknown, folderId?: string | null): string {
    const id = `diagram_${uniqueSuffix()}`;
    const dataWithFolder = folderId != null ? { ...(data as object), folderId } : data;
    this.sessionSaveDiagram(id, dataWithFolder);
    return id;
  }

  private sessionDeleteDiagram(id: string, soft = false): void {
    const list = this.sessionListDiagrams();
    if (soft) {
      const idx = list.findIndex((d) => d.id === id);
      if (idx >= 0) list[idx] = { ...list[idx], deletedAt: new Date().toISOString() };
      sessionStorage.setItem(SESSION_DIAGRAMS_KEY, JSON.stringify(list));
    } else {
      sessionStorage.removeItem(`${SESSION_DIAGRAM_PREFIX}${id}`);
      sessionStorage.setItem(
        SESSION_DIAGRAMS_KEY,
        JSON.stringify(list.filter((d) => d.id !== id))
      );
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('fossflow-session-changed'));
    }
  }

  // ---------------------------------------------------------------------------
  // StorageProvider — Diagrams
  // ---------------------------------------------------------------------------

  async listDiagrams(folderId?: string | null): Promise<DiagramMeta[]> {
    await this.ensureChecked();
    if (this.usingServer) {
      try {
        return await this.serverListDiagrams(folderId);
      } catch {
        return this.sessionListDiagrams(folderId);
      }
    }
    return this.sessionListDiagrams(folderId);
  }

  async loadDiagram(id: string): Promise<unknown> {
    await this.ensureChecked();
    if (this.usingServer) {
      try {
        return await this.serverLoadDiagram(id);
      } catch {
        return this.sessionLoadDiagram(id);
      }
    }
    return this.sessionLoadDiagram(id);
  }

  async saveDiagram(id: string, data: unknown): Promise<void> {
    await this.ensureChecked();
    if (this.usingServer) {
      await this.serverSaveDiagram(id, data);
    } else {
      this.sessionSaveDiagram(id, data);
    }
  }

  async createDiagram(data: unknown, folderId?: string | null): Promise<string> {
    await this.ensureChecked();
    if (this.usingServer) {
      return this.serverCreateDiagram(data, folderId);
    }
    return this.sessionCreateDiagram(data, folderId);
  }

  async deleteDiagram(id: string, soft = false): Promise<void> {
    await this.ensureChecked();
    if (this.usingServer) {
      await this.serverDeleteDiagram(id, soft);
    } else {
      this.sessionDeleteDiagram(id, soft);
    }
  }

  async restoreDiagram(id: string): Promise<void> {
    await this.ensureChecked();
    if (this.usingServer) {
      const response = await fetch(`${this.baseUrl}/api/diagrams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedAt: null }),
        signal: timeoutSignal(10000)
      });
      if (!response.ok) throw new Error(`Failed to restore diagram: ${response.status}`);
    } else {
      const list = this.sessionListDiagrams();
      const updated = list.map((d) =>
        d.id === id ? { ...d, deletedAt: undefined } : d
      );
      sessionStorage.setItem(SESSION_DIAGRAMS_KEY, JSON.stringify(updated));
    }
  }

  async renameDiagram(id: string, name: string): Promise<void> {
    await this.ensureChecked();
    if (this.usingServer) {
      const response = await fetch(`${this.baseUrl}/api/diagrams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, title: name }),
        signal: timeoutSignal(10000)
      });
      if (!response.ok) throw new Error(`Failed to rename diagram: ${response.status}`);
    } else {
      const list = this.sessionListDiagrams();
      const updated = list.map((d) =>
        d.id === id ? { ...d, name } : d
      );
      sessionStorage.setItem(SESSION_DIAGRAMS_KEY, JSON.stringify(updated));
    }
  }

  // ---------------------------------------------------------------------------
  // Folders — server path
  // ---------------------------------------------------------------------------

  private async serverListFolders(parentId?: string | null): Promise<FolderMeta[]> {
    const params = parentId != null ? `?parentId=${encodeURIComponent(parentId)}` : '';
    const response = await fetch(`${this.baseUrl}/api/folders${params}`, {
      signal: timeoutSignal(10000)
    });
    if (!response.ok) throw new Error(`Failed to list folders: ${response.status}`);
    return response.json();
  }

  private async serverCreateFolder(
    name: string,
    parentId?: string | null
  ): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api/folders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: parentId ?? null }),
      signal: timeoutSignal(10000)
    });
    if (!response.ok) throw new Error(`Failed to create folder: ${response.status}`);
    const result = await response.json();
    return result.id;
  }

  private async serverDeleteFolder(id: string, recursive: boolean): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/api/folders/${id}?recursive=${recursive}`,
      { method: 'DELETE', signal: timeoutSignal(10000) }
    );
    if (!response.ok) throw new Error(`Failed to delete folder: ${response.status}`);
  }

  private async serverRenameFolder(id: string, name: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
      signal: timeoutSignal(10000)
    });
    if (!response.ok) throw new Error(`Failed to rename folder: ${response.status}`);
  }

  private async serverMoveItem(
    id: string,
    type: 'diagram' | 'folder',
    targetFolderId: string | null
  ): Promise<void> {
    const endpoint =
      type === 'diagram'
        ? `${this.baseUrl}/api/diagrams/${id}/move`
        : `${this.baseUrl}/api/folders/${id}/move`;
    const response = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetFolderId }),
      signal: timeoutSignal(10000)
    });
    if (!response.ok) throw new Error(`Failed to move item: ${response.status}`);
  }

  // ---------------------------------------------------------------------------
  // Folders — localStorage fallback
  // ---------------------------------------------------------------------------

  private localGetFolders(): FolderMeta[] {
    const raw = localStorage.getItem(LOCAL_FOLDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private localSaveFolders(folders: FolderMeta[]): void {
    localStorage.setItem(LOCAL_FOLDERS_KEY, JSON.stringify(folders));
  }

  private localListFolders(parentId?: string | null): FolderMeta[] {
    const all = this.localGetFolders();
    if (parentId === undefined) return all;
    return all.filter((f) => f.parentId === parentId);
  }

  private localCreateFolder(name: string, parentId?: string | null): string {
    const folders = this.localGetFolders();
    const id = `folder_${uniqueSuffix()}`;
    folders.push({ id, name, parentId: parentId ?? null });
    this.localSaveFolders(folders);
    return id;
  }

  private localDeleteFolder(id: string, recursive: boolean): void {
    let folders = this.localGetFolders();
    if (recursive) {
      const toDelete = new Set<string>();
      const collect = (fid: string) => {
        toDelete.add(fid);
        folders.filter((f) => f.parentId === fid).forEach((f) => collect(f.id));
      };
      collect(id);
      folders = folders.filter((f) => !toDelete.has(f.id));
    } else {
      folders = folders.filter((f) => f.id !== id);
    }
    this.localSaveFolders(folders);
  }

  private localRenameFolder(id: string, name: string): void {
    const folders = this.localGetFolders().map((f) =>
      f.id === id ? { ...f, name } : f
    );
    this.localSaveFolders(folders);
  }

  private localMoveItem(
    id: string,
    type: 'diagram' | 'folder',
    targetFolderId: string | null
  ): void {
    if (type === 'folder') {
      const folders = this.localGetFolders().map((f) =>
        f.id === id ? { ...f, parentId: targetFolderId } : f
      );
      this.localSaveFolders(folders);
    } else {
      const list = this.sessionListDiagrams();
      const updated = list.map((d) =>
        d.id === id ? { ...d, folderId: targetFolderId } : d
      );
      sessionStorage.setItem(SESSION_DIAGRAMS_KEY, JSON.stringify(updated));
    }
  }

  // ---------------------------------------------------------------------------
  // StorageProvider — Folders
  // ---------------------------------------------------------------------------

  async listFolders(parentId?: string | null): Promise<FolderMeta[]> {
    await this.ensureChecked();
    if (this.usingServer) {
      try {
        return await this.serverListFolders(parentId);
      } catch {
        return this.localListFolders(parentId);
      }
    }
    return this.localListFolders(parentId);
  }

  async createFolder(name: string, parentId?: string | null): Promise<string> {
    await this.ensureChecked();
    if (this.usingServer) {
      return this.serverCreateFolder(name, parentId);
    }
    return this.localCreateFolder(name, parentId);
  }

  async deleteFolder(id: string, recursive: boolean): Promise<void> {
    await this.ensureChecked();
    if (this.usingServer) {
      await this.serverDeleteFolder(id, recursive);
    } else {
      this.localDeleteFolder(id, recursive);
    }
  }

  async renameFolder(id: string, name: string): Promise<void> {
    await this.ensureChecked();
    if (this.usingServer) {
      await this.serverRenameFolder(id, name);
    } else {
      this.localRenameFolder(id, name);
    }
  }

  async moveItem(
    id: string,
    type: 'diagram' | 'folder',
    targetFolderId: string | null
  ): Promise<void> {
    await this.ensureChecked();
    if (this.usingServer) {
      await this.serverMoveItem(id, type, targetFolderId);
    } else {
      this.localMoveItem(id, type, targetFolderId);
    }
  }

  // ---------------------------------------------------------------------------
  // Tree manifest
  // ---------------------------------------------------------------------------

  async getTreeManifest(): Promise<TreeManifest> {
    await this.ensureChecked();
    if (this.usingServer) {
      try {
        const response = await fetch(`${this.baseUrl}/api/tree-manifest`, {
          signal: timeoutSignal(10000)
        });
        if (!response.ok) throw new Error('Failed to get tree manifest');
        return response.json();
      } catch {
        // fall through to localStorage
      }
    }
    const raw = localStorage.getItem(LOCAL_MANIFEST_KEY);
    return raw ? JSON.parse(raw) : { folders: [] };
  }

  // ---------------------------------------------------------------------------
  // Share — server-only (snapshot to public namespace)
  // ---------------------------------------------------------------------------

  async shareDiagram(id: string): Promise<{ uuid: string; url: string; sharedAt: string }> {
    await this.ensureChecked();
    if (!this.usingServer) {
      throw new Error('Sharing requires server storage');
    }
    const response = await fetch(`${this.baseUrl}/api/diagrams/${id}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: timeoutSignal(10000)
    });
    if (!response.ok) throw new Error(`Share failed: ${response.status}`);
    return response.json();
  }

  async unshareDiagram(id: string): Promise<void> {
    await this.ensureChecked();
    if (!this.usingServer) return;
    const response = await fetch(`${this.baseUrl}/api/diagrams/${id}/share`, {
      method: 'DELETE',
      signal: timeoutSignal(10000)
    });
    if (!response.ok) throw new Error(`Unshare failed: ${response.status}`);
  }

  async saveTreeManifest(manifest: TreeManifest): Promise<void> {
    await this.ensureChecked();
    if (this.usingServer) {
      try {
        const response = await fetch(`${this.baseUrl}/api/tree-manifest`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(manifest),
          signal: timeoutSignal(10000)
        });
        if (!response.ok) throw new Error('Failed to save tree manifest');
        return;
      } catch {
        // fall through to localStorage
      }
    }
    localStorage.setItem(LOCAL_MANIFEST_KEY, JSON.stringify(manifest));
  }
}
