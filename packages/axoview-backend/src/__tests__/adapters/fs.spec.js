import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { createFsAdapter } from '../../adapters/fs.js';

let storagePath;
let adapter;

beforeEach(async () => {
  storagePath = await fs.mkdtemp(path.join(os.tmpdir(), 'axoview-fs-'));
  adapter = createFsAdapter(storagePath);
});

afterEach(async () => {
  await fs.rm(storagePath, { recursive: true, force: true });
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const KEY_PATTERN_REJECTS = [
  '',
  '/',
  '/leading',
  'trailing/',
  '..',
  '../escape',
  'a/../b',
  'a//b',
  'a/b/',
  'a.b',
  'a b',
  'has space',
  'unicode-ñ'
];

describe('get', () => {
  test('returns null when key absent', async () => {
    expect(await adapter.get('diagrams/missing')).toBeNull();
  });

  test('round-trips bytes after put', async () => {
    const payload = encoder.encode('{"hello":"world"}');
    await adapter.put('diagrams/d1', payload);
    const got = await adapter.get('diagrams/d1');
    expect(got).toBeInstanceOf(Uint8Array);
    expect(decoder.decode(got)).toBe('{"hello":"world"}');
  });

  test('rejects invalid keys per KEY_PATTERN', async () => {
    for (const bad of KEY_PATTERN_REJECTS) {
      await expect(adapter.get(bad)).rejects.toThrow(/Invalid storage key/);
    }
  });

  test('propagates non-ENOENT I/O errors', async () => {
    // Make storage directory unreadable by replacing with a file blocking
    // the diagrams/<id> path: putting a directory where a file is expected
    // is the cross-platform way to surface EISDIR.
    await fs.mkdir(path.join(storagePath, 'd1.json'));
    await expect(adapter.get('diagrams/d1')).rejects.toThrow();
  });
});

describe('put', () => {
  test('writes file atomically (no .tmp residue on success)', async () => {
    await adapter.put('diagrams/d1', encoder.encode('payload'));
    const files = await fs.readdir(storagePath);
    expect(files).toContain('d1.json');
    expect(files.some((f) => f.includes('.tmp'))).toBe(false);
  });

  test('creates parent directory for nested keys', async () => {
    await adapter.put('public/abc123_______________', encoder.encode('{}'));
    const subdir = await fs.readdir(path.join(storagePath, 'public'));
    expect(subdir).toContain('abc123_______________.json');
  });

  test('overwrites existing key', async () => {
    await adapter.put('diagrams/d1', encoder.encode('v1'));
    await adapter.put('diagrams/d1', encoder.encode('v2'));
    const got = await adapter.get('diagrams/d1');
    expect(decoder.decode(got)).toBe('v2');
  });

  test('rejects invalid keys per KEY_PATTERN', async () => {
    for (const bad of KEY_PATTERN_REJECTS) {
      await expect(adapter.put(bad, encoder.encode('x'))).rejects.toThrow(/Invalid storage key/);
    }
  });

  test('sequential puts on the same key end in a single coherent value (last-writer-wins per ADR 0010 D7)', async () => {
    for (let i = 0; i < 10; i++) {
      await adapter.put('diagrams/d1', encoder.encode(String(i)));
    }
    const got = await adapter.get('diagrams/d1');
    expect(decoder.decode(got)).toBe('9');
    const files = await fs.readdir(storagePath);
    expect(files.some((f) => f.includes('.tmp'))).toBe(false);
  });
});

describe('delete', () => {
  test('removes existing key', async () => {
    await adapter.put('diagrams/d1', encoder.encode('x'));
    await adapter.delete('diagrams/d1');
    expect(await adapter.get('diagrams/d1')).toBeNull();
  });

  test('is idempotent on missing key (no throw)', async () => {
    await expect(adapter.delete('diagrams/never-existed')).resolves.toBeUndefined();
  });

  test('rejects invalid keys per KEY_PATTERN', async () => {
    for (const bad of KEY_PATTERN_REJECTS) {
      await expect(adapter.delete(bad)).rejects.toThrow(/Invalid storage key/);
    }
  });
});

describe('list', () => {
  test('returns empty array when directory missing', async () => {
    expect(await adapter.list('public')).toEqual([]);
  });

  test('returns prefixed keys for files under prefix', async () => {
    await adapter.put('public/aaa___________________', encoder.encode('{}'));
    await adapter.put('public/bbb___________________', encoder.encode('{}'));
    const out = await adapter.list('public');
    expect(out.sort()).toEqual(['public/aaa___________________', 'public/bbb___________________']);
  });

  test("empty prefix lists storage root files", async () => {
    await adapter.put('folders', encoder.encode('[]'));
    await adapter.put('tree-manifest', encoder.encode('{}'));
    const out = await adapter.list('');
    expect(out).toEqual(expect.arrayContaining(['folders', 'tree-manifest']));
  });
});

describe('listDiagramMeta', () => {
  test('returns empty array when storage directory missing', async () => {
    await fs.rm(storagePath, { recursive: true, force: true });
    expect(await adapter.listDiagramMeta()).toEqual([]);
  });

  test('returns metadata only for diagrams (flat layout), skipping reserved keys', async () => {
    await adapter.put('diagrams/d1', encoder.encode(JSON.stringify({ name: 'One', lastModified: '2026-01-01T00:00:00Z', folderId: 'f1' })));
    await adapter.put('diagrams/d2', encoder.encode(JSON.stringify({ title: 'Two', folderId: null })));
    await adapter.put('folders', encoder.encode('[]'));
    await adapter.put('tree-manifest', encoder.encode('{}'));
    // Reserved-key residue per ADR 0010 D5
    await fs.writeFile(path.join(storagePath, 'metadata.json'), '{}');
    await fs.writeFile(path.join(storagePath, 'diagrams-index.json'), '{}');

    const meta = await adapter.listDiagramMeta();
    const ids = meta.map((m) => m.id).sort();
    expect(ids).toEqual(['d1', 'd2']);

    const d1 = meta.find((m) => m.id === 'd1');
    expect(d1).toEqual({
      id: 'd1',
      name: 'One',
      lastModified: '2026-01-01T00:00:00Z',
      folderId: 'f1',
      deletedAt: null
    });

    const d2 = meta.find((m) => m.id === 'd2');
    expect(d2.name).toBe('Two');
    expect(d2.folderId).toBeNull();
    expect(d2.deletedAt).toBeNull();
  });

  test('lastModified falls back to file mtime when payload omits it', async () => {
    await adapter.put('diagrams/d1', encoder.encode(JSON.stringify({ name: 'No mtime' })));
    const meta = await adapter.listDiagramMeta();
    expect(meta[0].lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('skips files whose JSON cannot be parsed (defense in depth, not a throw)', async () => {
    await adapter.put('diagrams/d1', encoder.encode(JSON.stringify({ name: 'ok' })));
    await fs.writeFile(path.join(storagePath, 'broken.json'), 'not-json');
    const meta = await adapter.listDiagramMeta();
    expect(meta.map((m) => m.id)).toEqual(['d1']);
  });

  test('name fallback chain: data.name → data.title → "Untitled Diagram"', async () => {
    await adapter.put('diagrams/d1', encoder.encode(JSON.stringify({ name: 'N' })));
    await adapter.put('diagrams/d2', encoder.encode(JSON.stringify({ title: 'T' })));
    await adapter.put('diagrams/d3', encoder.encode(JSON.stringify({})));
    const meta = await adapter.listDiagramMeta();
    const byId = Object.fromEntries(meta.map((m) => [m.id, m.name]));
    expect(byId).toEqual({ d1: 'N', d2: 'T', d3: 'Untitled Diagram' });
  });
});
