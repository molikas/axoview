/**
 * REGRESSION — MQA #21: Docker mode (fs adapter) folder import + folder
 * creation failed when the SPA dispatched a sequential burst of createFolder /
 * createDiagram requests — `${prefix}_${Date.now()}` reused the same id within
 * a millisecond, producing duplicate folder ids and 409 conflicts on diagrams.
 *
 * The fix lives server-side in `packages/axoview-backend/src/routes.js`:
 * append a random suffix and bail out on the (vanishingly rare) collision.
 *
 * Backend has no jest harness of its own, so we pin the contract from here by
 * reading the source file. Cheap and stops accidental reverts.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROUTES_PATH = path.resolve(
  __dirname,
  '../../../../../axoview-backend/src/routes.js',
);

describe('backend routes — burst-safe id generation (MQA #21)', () => {
  let src: string;

  beforeAll(() => {
    src = fs.readFileSync(ROUTES_PATH, 'utf-8');
  });

  it('routes.js exists at the expected location', () => {
    expect(fs.existsSync(ROUTES_PATH)).toBe(true);
  });

  it('createFolder uses random suffix + collision check', () => {
    const idx = src.indexOf('export async function createFolder');
    expect(idx).toBeGreaterThan(-1);
    // Slice up to the next top-level export so we don't match adjacent handlers.
    const next = src.indexOf('export async function', idx + 1);
    const slice = src.slice(idx, next > -1 ? next : idx + 1500);
    expect(slice).toMatch(/Math\.random\(\)\.toString\(36\)/);
    expect(slice).toMatch(/existingIds\.has\(id\)/);
  });

  it('createDiagram uses random suffix + collision check when no id supplied', () => {
    const idx = src.indexOf('export async function createDiagram');
    expect(idx).toBeGreaterThan(-1);
    const next = src.indexOf('export async function', idx + 1);
    const slice = src.slice(idx, next > -1 ? next : idx + 1500);
    expect(slice).toMatch(/Math\.random\(\)\.toString\(36\)/);
    // do-while around adapter.get is the collision-retry loop introduced by the fix.
    expect(slice).toMatch(/do\s*\{[\s\S]*?\}\s*while\s*\(await\s+adapter\.get/);
  });
});
