/**
 * Programmatic project-ZIP fixture builder for the import / export ZIP spec.
 *
 * Why programmatic and not a static binary fixture: the project ZIP format is
 * defined by app-side code (axoview-app/src/services/project/projectZip.ts, see
 * ADR 0001). Generating in-test means a future format-version bump can be
 * tracked alongside the lib without re-hand-rolling the binary. A static .zip
 * would also have to be opaque-checked into the repo.
 *
 * The shape we emit mirrors `exportProject()`:
 *   - manifest.json   (PROJECT_FORMAT, version, exportedAt, scope, folders, diagrams)
 *   - diagrams/<id>.json per diagram
 *   - tree-manifest.json (best-effort; we include a minimal one)
 *
 * Two diagrams + one folder + one icon are enough to verify import wiring
 * (tree shape + diagram count + per-diagram model items).
 *
 * The lib's JSZip dep is hoisted to the repo root by npm workspaces, so the
 * e2e package imports it without a local devDependency entry.
 */
import path from 'path';
import fs from 'fs';
import os from 'os';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const JSZip = require('jszip');

const FORMAT = 'axoview-project';
const FORMAT_VERSION = '1';

export interface FixtureDiagramSpec {
  id: string;
  name: string;
  folderId: string | null;
  /** Model shape — keep minimal; the lib's loader merges bundled fixtures on top. */
  model: {
    title: string;
    items: Array<{ id: string; name: string; icon?: string }>;
    views: Array<{
      id: string;
      name: string;
      items: Array<{ id: string; tile: { x: number; y: number } }>;
      connectors?: unknown[];
      rectangles?: unknown[];
      textBoxes?: unknown[];
    }>;
    icons?: unknown[];
    colors?: Array<{ id: string; value: string }>;
  };
}

export interface FixtureFolderSpec {
  id: string;
  name: string;
  parentId: string | null;
}

export interface ProjectZipFixture {
  diagrams: FixtureDiagramSpec[];
  folders: FixtureFolderSpec[];
}

/**
 * The canonical Session-4 fixture: 1 folder ("Imports") + 2 diagrams ("Alpha"
 * at root, "Beta" inside the folder). Keeps the import-tree assertion shape
 * cheap while still exercising the folder-remap branch of importProject.
 */
export const SAMPLE_PROJECT_FIXTURE: ProjectZipFixture = {
  folders: [{ id: 'fixture-folder-1', name: 'Imports', parentId: null }],
  diagrams: [
    {
      id: 'fixture-diagram-alpha',
      name: 'Alpha',
      folderId: null,
      model: {
        title: 'Alpha',
        items: [
          { id: 'alpha-item-1', name: 'A1', icon: 'block' },
          { id: 'alpha-item-2', name: 'A2', icon: 'block' }
        ],
        views: [
          {
            id: 'alpha-view',
            name: 'Main',
            items: [
              { id: 'alpha-item-1', tile: { x: 0, y: 0 } },
              { id: 'alpha-item-2', tile: { x: 2, y: 0 } }
            ],
            connectors: [],
            rectangles: [],
            textBoxes: []
          }
        ],
        icons: [],
        colors: [{ id: 'color-default', value: '#000000' }]
      }
    },
    {
      id: 'fixture-diagram-beta',
      name: 'Beta',
      folderId: 'fixture-folder-1',
      model: {
        title: 'Beta',
        items: [{ id: 'beta-item-1', name: 'B1', icon: 'block' }],
        views: [
          {
            id: 'beta-view',
            name: 'Main',
            items: [{ id: 'beta-item-1', tile: { x: 1, y: 1 } }],
            connectors: [],
            rectangles: [],
            textBoxes: []
          }
        ],
        icons: [],
        colors: [{ id: 'color-default', value: '#000000' }]
      }
    }
  ]
};

export interface BuiltProjectZip {
  /** Absolute filesystem path the ZIP was written to. Suitable for setInputFiles(). */
  filepath: string;
  /** Same data as the file, returned for any in-process assertions. */
  buffer: Buffer;
  /** The fixture spec, in case the caller wants to assert on counts. */
  fixture: ProjectZipFixture;
}

/**
 * Builds the sample project ZIP and writes it to a unique temp path. Callers
 * pass the path to Playwright's setInputFiles(). The temp file is overwritten
 * on each call — JS test isolation handles the lifecycle.
 */
export async function buildSampleProjectZip(
  fixture: ProjectZipFixture = SAMPLE_PROJECT_FIXTURE,
  outDir = path.join(os.tmpdir(), 'axoview-e2e-fixtures')
): Promise<BuiltProjectZip> {
  fs.mkdirSync(outDir, { recursive: true });

  const zip = new JSZip();

  const manifest = {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy: 'axoview-e2e/T1-Session-4',
    scope: 'project' as const,
    folders: fixture.folders,
    diagrams: fixture.diagrams.map((d) => ({
      id: d.id,
      name: d.name,
      folderId: d.folderId,
      lastModified: new Date().toISOString(),
      file: `diagrams/${d.id}.json`
    }))
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const diagramsDir = zip.folder('diagrams');
  if (!diagramsDir) throw new Error('buildSampleProjectZip: jszip refused to mint diagrams/ folder');
  for (const d of fixture.diagrams) {
    diagramsDir.file(`${d.id}.json`, JSON.stringify(d.model));
  }

  // Minimal tree manifest — the lib's TreeManifest type is open enough that
  // an empty `entries` array is accepted; the importer treats this file as
  // best-effort and ignores parse failures.
  zip.file('tree-manifest.json', JSON.stringify({ entries: [] }));

  const buffer: Buffer = await zip.generateAsync({ type: 'nodebuffer' });
  const filepath = path.join(outDir, `sample-project-${Date.now()}.zip`);
  fs.writeFileSync(filepath, buffer);

  return { filepath, buffer, fixture };
}

/**
 * Reads a saved zip (Playwright Download.path()) and returns its parsed
 * manifest + diagram-file list. Used by the J10 round-trip leg to verify the
 * exported zip carries what we just placed.
 */
export async function parseProjectZip(zipPath: string): Promise<{
  manifest: any;
  diagramFiles: string[];
}> {
  const data = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(data);
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) throw new Error('parseProjectZip: zip is missing manifest.json');
  const manifest = JSON.parse(await manifestFile.async('string'));
  const diagramFiles: string[] = [];
  zip.forEach((relPath: string) => {
    if (relPath.startsWith('diagrams/') && relPath.endsWith('.json')) {
      diagramFiles.push(relPath);
    }
  });
  return { manifest, diagramFiles };
}
