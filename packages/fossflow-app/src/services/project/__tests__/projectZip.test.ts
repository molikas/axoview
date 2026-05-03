import JSZip from 'jszip';
import {
  exportProject,
  parseProject,
  importProject,
  rewriteIds,
  PROJECT_FORMAT,
  PROJECT_FORMAT_VERSION,
  ParsedProject
} from '../projectZip';
import {
  DiagramMeta,
  FolderMeta,
  StorageProvider,
  TreeManifest
} from '../../storage';

// ---------------------------------------------------------------------------
// In-memory storage provider for round-trip tests
// ---------------------------------------------------------------------------

class FakeStorage implements StorageProvider {
  readonly id = 'local' as const;
  readonly displayName = 'Fake';
  readonly requiresAuth = false;

  diagrams = new Map<string, { meta: DiagramMeta; data: unknown }>();
  folders = new Map<string, FolderMeta>();
  manifest: TreeManifest = { folders: [] };
  private idSeq = 0;

  async isAvailable() { return true; }

  async listDiagrams(folderId?: string | null): Promise<DiagramMeta[]> {
    const all = Array.from(this.diagrams.values()).map((d) => d.meta);
    if (folderId === undefined) return all;
    return all.filter((d) => d.folderId === folderId);
  }
  async loadDiagram(id: string) {
    const d = this.diagrams.get(id);
    if (!d) throw new Error(`Not found: ${id}`);
    return d.data;
  }
  async saveDiagram(id: string, data: unknown) {
    const meta = this.diagrams.get(id)?.meta ?? {
      id,
      name: (data as any)?.name ?? 'Untitled',
      lastModified: new Date().toISOString(),
      folderId: null
    };
    this.diagrams.set(id, { meta, data });
  }
  async createDiagram(data: unknown, folderId?: string | null) {
    const id = `diagram_test_${++this.idSeq}`;
    const meta: DiagramMeta = {
      id,
      name: (data as any)?.name ?? (data as any)?.title ?? 'Untitled',
      lastModified: new Date().toISOString(),
      folderId: folderId ?? null
    };
    this.diagrams.set(id, { meta, data });
    return id;
  }
  async deleteDiagram(id: string) {
    this.diagrams.delete(id);
  }
  async restoreDiagram(id: string) {
    const d = this.diagrams.get(id);
    if (d) d.meta = { ...d.meta, deletedAt: undefined };
  }
  async renameDiagram(id: string, name: string) {
    const d = this.diagrams.get(id);
    if (d) d.meta = { ...d.meta, name };
  }
  async listFolders(parentId?: string | null) {
    const all = Array.from(this.folders.values());
    if (parentId === undefined) return all;
    return all.filter((f) => f.parentId === parentId);
  }
  async createFolder(name: string, parentId?: string | null) {
    const id = `folder_test_${++this.idSeq}`;
    this.folders.set(id, { id, name, parentId: parentId ?? null });
    return id;
  }
  async deleteFolder(id: string) {
    this.folders.delete(id);
  }
  async renameFolder(id: string, name: string) {
    const f = this.folders.get(id);
    if (f) this.folders.set(id, { ...f, name });
  }
  async moveItem(id: string, type: 'diagram' | 'folder', targetFolderId: string | null) {
    if (type === 'folder') {
      const f = this.folders.get(id);
      if (f) this.folders.set(id, { ...f, parentId: targetFolderId });
    } else {
      const d = this.diagrams.get(id);
      if (d) d.meta = { ...d.meta, folderId: targetFolderId };
    }
  }
  async getTreeManifest() { return this.manifest; }
  async saveTreeManifest(m: TreeManifest) { this.manifest = m; }
}

const sampleModel = (name: string) => ({
  title: name,
  name,
  version: '1.0',
  icons: [],
  colors: [],
  items: [],
  views: []
});

const seedWorkspace = async (s: FakeStorage) => {
  const networking = await s.createFolder('Networking');
  const internal = await s.createFolder('Internal', networking);
  const d1 = await s.createDiagram(sampleModel('VPC layout'), networking);
  const d2 = await s.createDiagram(sampleModel('Subnet plan'), internal);
  const d3 = await s.createDiagram(sampleModel('Root note'), null);
  return { networking, internal, d1, d2, d3 };
};

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe('projectZip — round-trip (ADR 0001 acceptance)', () => {
  it('export then import → workspace identical modulo IDs', async () => {
    const src = new FakeStorage();
    await seedWorkspace(src);

    const { blob } = await exportProject(
      { storage: src, exporterTag: 'fossflow-app@test' },
      { scope: 'project' }
    );

    const parsed = await parseProject(blob);
    expect(parsed.manifest.format).toBe(PROJECT_FORMAT);
    expect(parsed.manifest.version).toBe(PROJECT_FORMAT_VERSION);

    const dst = new FakeStorage();
    const result = await importProject({ storage: dst }, parsed, {
      destination: { kind: 'root' }
    });

    expect(result.folderCount).toBe(2);
    expect(result.diagramCount).toBe(3);

    const dstFolders = await dst.listFolders();
    const dstDiagrams = await dst.listDiagrams();
    expect(dstFolders.length).toBe(2);
    expect(dstDiagrams.length).toBe(3);

    const folderNames = dstFolders.map((f) => f.name).sort();
    expect(folderNames).toEqual(['Internal', 'Networking']);

    // Internal's parent should map to Networking's new id.
    const networking = dstFolders.find((f) => f.name === 'Networking')!;
    const internal = dstFolders.find((f) => f.name === 'Internal')!;
    expect(internal.parentId).toBe(networking.id);

    // Diagram names preserved
    const diagramNames = dstDiagrams.map((d) => d.name).sort();
    expect(diagramNames).toEqual(['Root note', 'Subnet plan', 'VPC layout']);
  });
});

// ---------------------------------------------------------------------------
// rewriteIds
// ---------------------------------------------------------------------------

describe('rewriteIds', () => {
  it('rewrites folder parentId chains and diagram folderIds', () => {
    const parsed: ParsedProject = {
      manifest: {
        format: PROJECT_FORMAT,
        version: PROJECT_FORMAT_VERSION,
        exportedAt: '2026-04-30T00:00:00.000Z',
        exportedBy: 'test',
        scope: 'project',
        folders: [
          { id: 'folder_a', name: 'A', parentId: null },
          { id: 'folder_b', name: 'B', parentId: 'folder_a' }
        ],
        diagrams: [
          {
            id: 'diagram_1',
            name: 'D1',
            folderId: 'folder_b',
            lastModified: '2026-04-30T00:00:00.000Z',
            file: 'diagrams/diagram_1.json'
          }
        ]
      },
      diagrams: new Map([['diagram_1', { items: [{ id: 'i1', link: 'diagram_1' }] }]])
    };

    const out = rewriteIds(parsed);
    expect(out.folders.length).toBe(2);
    expect(out.diagrams.length).toBe(1);

    const folderA = out.folders.find((f) => f.name === 'A')!;
    const folderB = out.folders.find((f) => f.name === 'B')!;
    expect(folderA.id).not.toBe('folder_a');
    expect(folderB.parentId).toBe(folderA.id);

    const diagram = out.diagrams[0];
    expect(diagram.folderId).toBe(folderB.id);
    expect(out.idMap.get('diagram_1')).toBe(diagram.newId);

    // Cross-diagram link reference inside the model is rewritten too.
    const model = out.models.get(diagram.newId) as any;
    expect(model.items[0].link).toBe(diagram.newId);
  });
});

// ---------------------------------------------------------------------------
// Replace-all
// ---------------------------------------------------------------------------

describe('importProject — replaceAll', () => {
  it('wipes existing workspace then imports', async () => {
    const dst = new FakeStorage();
    await dst.createDiagram(sampleModel('Pre-existing'), null);
    await dst.createFolder('Pre-existing folder');
    expect((await dst.listDiagrams()).length).toBe(1);
    expect((await dst.listFolders()).length).toBe(1);

    const src = new FakeStorage();
    await seedWorkspace(src);
    const { blob } = await exportProject(
      { storage: src, exporterTag: 'test' },
      { scope: 'project' }
    );
    const parsed = await parseProject(blob);

    await importProject({ storage: dst }, parsed, {
      destination: { kind: 'replaceAll' }
    });

    const folders = await dst.listFolders();
    const diagrams = await dst.listDiagrams();
    expect(folders.map((f) => f.name).sort()).toEqual(['Internal', 'Networking']);
    expect(diagrams.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Error paths
// ---------------------------------------------------------------------------

describe('parseProject — errors', () => {
  it('rejects non-zip blob with BAD_ZIP', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xff, 0xff, 0xff])]);
    await expect(parseProject(blob)).rejects.toMatchObject({
      name: 'ProjectZipError',
      code: 'BAD_ZIP'
    });
  });

  it('rejects zip without manifest with NO_MANIFEST', async () => {
    const zip = new JSZip();
    zip.file('hello.txt', 'hi');
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseProject(blob)).rejects.toMatchObject({
      code: 'NO_MANIFEST'
    });
  });

  it('rejects unknown format with BAD_FORMAT', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        format: 'something-else',
        version: '1',
        diagrams: [],
        folders: []
      })
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseProject(blob)).rejects.toMatchObject({
      code: 'BAD_FORMAT'
    });
  });

  it('rejects newer version with UNSUPPORTED_VERSION', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        format: PROJECT_FORMAT,
        version: '99',
        diagrams: [],
        folders: []
      })
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseProject(blob)).rejects.toMatchObject({
      code: 'UNSUPPORTED_VERSION'
    });
  });

  it('rejects missing diagram file with MISSING_DIAGRAM', async () => {
    const zip = new JSZip();
    zip.file(
      'manifest.json',
      JSON.stringify({
        format: PROJECT_FORMAT,
        version: PROJECT_FORMAT_VERSION,
        exportedAt: 'now',
        exportedBy: 'x',
        scope: 'project',
        folders: [],
        diagrams: [
          {
            id: 'diagram_x',
            name: 'X',
            folderId: null,
            lastModified: 'now',
            file: 'diagrams/diagram_x.json'
          }
        ]
      })
    );
    // Intentionally do NOT add diagrams/diagram_x.json
    const blob = await zip.generateAsync({ type: 'blob' });
    await expect(parseProject(blob)).rejects.toMatchObject({
      code: 'MISSING_DIAGRAM'
    });
  });
});

describe('parseProject leaves workspace untouched on error', () => {
  it('a failed parse does not modify storage', async () => {
    const dst = new FakeStorage();
    await dst.createDiagram(sampleModel('Stays'), null);

    const blob = new Blob([new Uint8Array([0xff, 0xff, 0xff, 0xff])]);
    await expect(parseProject(blob)).rejects.toMatchObject({
      name: 'ProjectZipError'
    });

    const diagrams = await dst.listDiagrams();
    expect(diagrams.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Folder scope
// ---------------------------------------------------------------------------

describe('exportProject — folder scope', () => {
  it('exports only the named subtree', async () => {
    const src = new FakeStorage();
    const { networking } = await seedWorkspace(src);

    const { blob } = await exportProject(
      { storage: src, exporterTag: 'test' },
      { scope: 'folder', folderId: networking }
    );

    const parsed = await parseProject(blob);
    expect(parsed.manifest.folders.length).toBe(2); // Networking + Internal
    expect(parsed.manifest.diagrams.length).toBe(2); // VPC + Subnet
    expect(parsed.manifest.scope).toBe('folder');
  });
});

describe('exportProject — diagram scope', () => {
  it('exports a single diagram and no folders', async () => {
    const src = new FakeStorage();
    const { d1 } = await seedWorkspace(src);

    const { blob } = await exportProject(
      { storage: src, exporterTag: 'test' },
      { scope: 'diagram', diagramId: d1 }
    );

    const parsed = await parseProject(blob);
    expect(parsed.manifest.diagrams.length).toBe(1);
    expect(parsed.manifest.folders.length).toBe(0);
    expect(parsed.manifest.scope).toBe('diagram');
  });
});
