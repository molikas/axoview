import {
  DiagramMeta,
  FolderMeta,
  PersistedDiagramBlob,
  StorageProvider,
  TreeManifest,
  isPersistedDiagramBlob
} from '../types';
import { leanIfModel } from '../leanModel';
import { authStore } from '../../../stores/authStore';
import { notificationStore } from '../../../stores/notificationStore';

// ADR 0036 — Google Drive Storage Provider.
//
// Every Axoview file/folder carries appProperties { axoview: 'true' }; the root
// folder additionally carries { axoviewRoot: 'true' } so the chosen root travels
// with the account (drive.file visibility follows the app + account, not the
// device). Delete = Drive trash. Sharing is intentionally not implemented
// (ADR 0036 §4 — session-backend-only per ADR 0010). Online-only v1: transient
// failures retry with backoff, then throw; the offline write queue is deferred.

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const JSON_MIME = 'application/json';
const APP_MARKER_Q = "appProperties has { key='axoview' and value='true' }";
const ROOT_MARKER_Q = "appProperties has { key='axoviewRoot' and value='true' }";
const APP_PROPS = { axoview: 'true' };
const ROOT_PROPS = { axoview: 'true', axoviewRoot: 'true' };
const ROOT_CACHE_KEY = 'axoview-drive-root';
const MANIFEST_NAME = 'axoview-manifest.json';
export const DEFAULT_ROOT_NAME = 'axoview-diagrams';

class DriveError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'DriveError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  parents?: string[];
  trashed?: boolean;
}

export class GoogleDriveProvider implements StorageProvider {
  readonly id = 'google-drive' as const;
  readonly displayName = 'Google Drive';
  readonly requiresAuth = true;

  private rootFolderId: string | null = null;
  // Overridable in tests to keep backoff fast.
  protected retryDelays = [500, 1000, 2000];

  async isAvailable(): Promise<boolean> {
    return authStore.getState().status === 'AUTHENTICATED';
  }

  // ---------------------------------------------------------------------------
  // Low-level request: auth (via getValidToken ONLY), retry/backoff, 401 → expire
  // ---------------------------------------------------------------------------

  private async request(
    url: string,
    init: RequestInit = {},
    attempt = 0
  ): Promise<Response> {
    const token = await authStore.getValidToken();
    if (!token) throw new DriveError('Not signed in to Google', 401);

    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` }
      });
    } catch {
      // Network error — treat as transient.
      if (attempt < this.retryDelays.length) {
        await sleep(this.retryDelays[attempt]);
        return this.request(url, init, attempt + 1);
      }
      throw new DriveError('Network error contacting Google Drive', 0);
    }

    if (res.ok) return res;

    if (res.status === 401) {
      // Token rejected server-side despite not being locally expired — force the
      // auth store to SESSION_EXPIRED so the user gets the re-sign-in prompt.
      authStore.markExpired();
      throw new DriveError('Google session expired', 401);
    }

    // 429 / 403 (rate) and 5xx are transient — back off and retry.
    const transient = res.status === 429 || res.status === 403 || res.status >= 500;
    if (transient && attempt < this.retryDelays.length) {
      if (res.status === 429 || res.status === 403) {
        notificationStore.push({
          severity: 'warning',
          message: 'Google Drive is busy — retrying…'
        });
      }
      await sleep(this.retryDelays[attempt]);
      return this.request(url, init, attempt + 1);
    }

    throw new DriveError(`Google Drive request failed (${res.status})`, res.status);
  }

  private async listFiles(q: string, fields: string): Promise<DriveFile[]> {
    const url =
      `${DRIVE_API}/files?q=${encodeURIComponent(q)}` +
      `&fields=${encodeURIComponent(fields)}&pageSize=1000` +
      `&spaces=drive`;
    const res = await this.request(url);
    const json = (await res.json()) as { files?: DriveFile[] };
    return json.files ?? [];
  }

  private async patchJson(id: string, body: unknown): Promise<void> {
    await this.request(`${DRIVE_API}/files/${id}?fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': JSON_MIME },
      body: JSON.stringify(body)
    });
  }

  /** Multipart create (metadata + media) → new file id. */
  private async uploadCreate(
    name: string,
    parents: string[],
    mimeType: string,
    content: string,
    appProperties: Record<string, string> = APP_PROPS
  ): Promise<string> {
    const boundary = `axoview_${Math.random().toString(36).slice(2)}`;
    const metadata = { name, parents, mimeType, appProperties };
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;
    const res = await this.request(
      `${DRIVE_UPLOAD}/files?uploadType=multipart&fields=id`,
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
        body
      }
    );
    const json = (await res.json()) as { id: string };
    return json.id;
  }

  private async uploadMedia(id: string, content: string): Promise<void> {
    await this.request(`${DRIVE_UPLOAD}/files/${id}?uploadType=media&fields=id`, {
      method: 'PATCH',
      headers: { 'Content-Type': JSON_MIME },
      body: content
    });
  }

  // ---------------------------------------------------------------------------
  // Root folder — default axoview-diagrams, marker-discovered, choice in Drive
  // ---------------------------------------------------------------------------

  private setRoot(id: string): void {
    this.rootFolderId = id;
    try {
      localStorage.setItem(ROOT_CACHE_KEY, id);
    } catch {
      /* cache is a boot accelerator only */
    }
  }

  private async folderExists(id: string): Promise<boolean> {
    try {
      const res = await this.request(`${DRIVE_API}/files/${id}?fields=id,trashed`);
      const json = (await res.json()) as DriveFile;
      return !json.trashed;
    } catch {
      return false;
    }
  }

  private async findRootByMarker(): Promise<string | null> {
    const q = `mimeType='${FOLDER_MIME}' and ${ROOT_MARKER_Q} and trashed=false`;
    const files = await this.listFiles(q, 'files(id)');
    return files[0]?.id ?? null;
  }

  private async createRootFolder(name: string): Promise<string> {
    const res = await this.request(`${DRIVE_API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': JSON_MIME },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, appProperties: ROOT_PROPS })
    });
    const json = (await res.json()) as { id: string };
    return json.id;
  }

  /**
   * Resolve the root folder id WITHOUT creating it (cache → marker discovery).
   * Read operations use this so a tree load can never race the first-connect
   * dialog into auto-creating (or duplicating) the root folder.
   */
  private async resolveRoot(): Promise<string | null> {
    if (this.rootFolderId) return this.rootFolderId;
    const cached = (() => {
      try {
        return localStorage.getItem(ROOT_CACHE_KEY);
      } catch {
        return null;
      }
    })();
    if (cached && (await this.folderExists(cached))) {
      this.rootFolderId = cached;
      return cached;
    }
    if (cached) {
      try {
        localStorage.removeItem(ROOT_CACHE_KEY);
      } catch {
        /* ignore */
      }
    }
    const found = await this.findRootByMarker();
    if (found) {
      this.setRoot(found);
      return found;
    }
    return null;
  }

  /** True when a root folder (marker) already exists for this account. */
  async hasConfiguredRoot(): Promise<boolean> {
    return (await this.resolveRoot()) !== null;
  }

  /** First-connect setup: create the named root folder + stamp the marker. */
  async configureRoot(name: string): Promise<void> {
    const trimmed = name.trim() || DEFAULT_ROOT_NAME;
    const id = await this.createRootFolder(trimmed);
    this.setRoot(id);
  }

  /** Resolve the root, creating the default folder if none is configured (writes only). */
  private async ensureRoot(): Promise<string> {
    const existing = await this.resolveRoot();
    if (existing) return existing;
    const id = await this.createRootFolder(DEFAULT_ROOT_NAME);
    this.setRoot(id);
    return id;
  }

  // ---------------------------------------------------------------------------
  // Diagrams
  // ---------------------------------------------------------------------------

  async listDiagrams(folderId?: string | null): Promise<DiagramMeta[]> {
    const root = await this.resolveRoot();
    if (!root) return []; // root not configured yet (first-connect dialog pending)
    const q =
      folderId === undefined
        ? `mimeType='${JSON_MIME}' and trashed=false and ${APP_MARKER_Q}`
        : `'${folderId ?? root}' in parents and mimeType='${JSON_MIME}' and trashed=false`;
    const files = await this.listFiles(q, 'files(id,name,modifiedTime,parents)');
    return files
      .filter((f) => f.name !== MANIFEST_NAME)
      .map((f) => {
        const parent = f.parents?.[0] ?? root;
        return {
          id: f.id,
          name: f.name,
          lastModified: f.modifiedTime ?? new Date().toISOString(),
          folderId: parent === root ? null : parent
        };
      });
  }

  async loadDiagram(id: string): Promise<unknown> {
    const res = await this.request(`${DRIVE_API}/files/${id}?alt=media`);
    return res.json();
  }

  async saveDiagram(id: string, data: unknown): Promise<void> {
    // ADR 0003 lean-save — strip rehydratable pack icons before upload so Drive
    // stores a few KB, not the full icon-pack SVG payload, on every autosave.
    await this.uploadMedia(id, JSON.stringify(leanIfModel(data)));
  }

  async createDiagram(data: unknown, folderId?: string | null): Promise<string> {
    const root = await this.ensureRoot();
    const parent = folderId ?? root;
    const blob: PersistedDiagramBlob = isPersistedDiagramBlob(data) ? data : {};
    const name = blob.title || blob.name || 'Untitled Diagram';
    return this.uploadCreate(name, [parent], JSON_MIME, JSON.stringify(leanIfModel(data)));
  }

  async deleteDiagram(id: string): Promise<void> {
    // ADR 0036 §3 — Drive trash (recoverable ~30 days), never hard delete.
    await this.patchJson(id, { trashed: true });
  }

  async restoreDiagram(id: string): Promise<void> {
    await this.patchJson(id, { trashed: false });
  }

  async renameDiagram(id: string, name: string): Promise<void> {
    await this.patchJson(id, { name });
  }

  // ---------------------------------------------------------------------------
  // Folders
  // ---------------------------------------------------------------------------

  async listFolders(parentId?: string | null): Promise<FolderMeta[]> {
    const root = await this.resolveRoot();
    if (!root) return []; // root not configured yet
    const q =
      parentId === undefined
        ? `mimeType='${FOLDER_MIME}' and trashed=false and ${APP_MARKER_Q}`
        : `'${parentId ?? root}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`;
    const files = await this.listFiles(q, 'files(id,name,parents)');
    return files
      .filter((f) => f.id !== root) // the root folder itself is not a listed folder
      .map((f) => {
        const parent = f.parents?.[0] ?? root;
        return { id: f.id, name: f.name, parentId: parent === root ? null : parent };
      });
  }

  async createFolder(name: string, parentId?: string | null): Promise<string> {
    const root = await this.ensureRoot();
    const res = await this.request(`${DRIVE_API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': JSON_MIME },
      body: JSON.stringify({
        name,
        mimeType: FOLDER_MIME,
        parents: [parentId ?? root],
        appProperties: APP_PROPS
      })
    });
    const json = (await res.json()) as { id: string };
    return json.id;
  }

  async deleteFolder(id: string): Promise<void> {
    // Trashing a folder trashes its descendants — Drive semantics cover the
    // `recursive` intent, so the flag is not forwarded.
    await this.patchJson(id, { trashed: true });
  }

  async renameFolder(id: string, name: string): Promise<void> {
    await this.patchJson(id, { name });
  }

  async moveItem(
    id: string,
    _type: 'diagram' | 'folder',
    targetFolderId: string | null
  ): Promise<void> {
    const root = await this.ensureRoot();
    const target = targetFolderId ?? root;
    const meta = (await (
      await this.request(`${DRIVE_API}/files/${id}?fields=parents`)
    ).json()) as DriveFile;
    const prevParents = (meta.parents ?? []).join(',');
    const query = prevParents
      ? `addParents=${target}&removeParents=${prevParents}`
      : `addParents=${target}`;
    await this.request(`${DRIVE_API}/files/${id}?${query}&fields=id`, {
      method: 'PATCH'
    });
  }

  // ---------------------------------------------------------------------------
  // Tree manifest — axoview-manifest.json in the root folder
  // ---------------------------------------------------------------------------

  private async findManifestId(root: string): Promise<string | null> {
    const q = `'${root}' in parents and name='${MANIFEST_NAME}' and trashed=false`;
    const files = await this.listFiles(q, 'files(id)');
    return files[0]?.id ?? null;
  }

  async getTreeManifest(): Promise<TreeManifest> {
    const root = await this.resolveRoot();
    if (!root) return { folders: [] };
    const id = await this.findManifestId(root);
    if (!id) return { folders: [] };
    const res = await this.request(`${DRIVE_API}/files/${id}?alt=media`);
    return res.json();
  }

  async saveTreeManifest(manifest: TreeManifest): Promise<void> {
    const root = await this.ensureRoot();
    const id = await this.findManifestId(root);
    if (!id) {
      await this.uploadCreate(
        MANIFEST_NAME,
        [root],
        JSON_MIME,
        JSON.stringify(manifest)
      );
      return;
    }
    await this.uploadMedia(id, JSON.stringify(manifest));
  }

  // shareDiagram / unshareDiagram intentionally omitted (ADR 0036 §4).
}
