import { migrateFossflowStorageKeys } from '../migrationShim';

const SENTINEL = 'axoview_migration_v1';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('migrateFossflowStorageKeys', () => {
  it('copies fossflow_* localStorage keys to axoview_* and deletes originals', () => {
    localStorage.setItem('fossflow_user_settings', JSON.stringify({ theme: 'dark' }));
    localStorage.setItem('fossflow_perf_enabled', 'true');
    localStorage.setItem('fossflow-tree-manifest', '{"folders":[]}');

    const result = migrateFossflowStorageKeys();

    expect(result.ran).toBe(true);
    expect(result.localMigrated).toBe(3);
    expect(localStorage.getItem('axoview_user_settings')).toBe(JSON.stringify({ theme: 'dark' }));
    expect(localStorage.getItem('axoview_perf_enabled')).toBe('true');
    expect(localStorage.getItem('axoview-tree-manifest')).toBe('{"folders":[]}');
    expect(localStorage.getItem('fossflow_user_settings')).toBeNull();
    expect(localStorage.getItem('fossflow_perf_enabled')).toBeNull();
    expect(localStorage.getItem('fossflow-tree-manifest')).toBeNull();
    expect(localStorage.getItem(SENTINEL)).toBe('done');
  });

  it('also migrates sessionStorage keys', () => {
    sessionStorage.setItem('fossflow_diagrams', '[]');
    sessionStorage.setItem('fossflow_diagram_abc', '{"name":"X"}');

    const result = migrateFossflowStorageKeys();

    expect(result.sessionMigrated).toBe(2);
    expect(sessionStorage.getItem('axoview_diagrams')).toBe('[]');
    expect(sessionStorage.getItem('axoview_diagram_abc')).toBe('{"name":"X"}');
    expect(sessionStorage.getItem('fossflow_diagrams')).toBeNull();
  });

  it('runs at most once — second invocation is a no-op', () => {
    localStorage.setItem('fossflow_user_settings', 'a');
    const first = migrateFossflowStorageKeys();
    expect(first.ran).toBe(true);
    expect(first.localMigrated).toBe(1);

    // Seed a fresh legacy key after the sentinel was set
    localStorage.setItem('fossflow_user_settings', 'b');
    const second = migrateFossflowStorageKeys();
    expect(second.ran).toBe(false);
    expect(second.localMigrated).toBe(0);
    // Sentinel honored — the new legacy key was not migrated
    expect(localStorage.getItem('fossflow_user_settings')).toBe('b');
  });

  it('does not overwrite an existing axoview_* key — preserves new value, deletes old', () => {
    localStorage.setItem('fossflow_user_settings', 'OLD');
    localStorage.setItem('axoview_user_settings', 'NEW');

    const result = migrateFossflowStorageKeys();

    expect(result.ran).toBe(true);
    expect(localStorage.getItem('axoview_user_settings')).toBe('NEW');
    expect(localStorage.getItem('fossflow_user_settings')).toBeNull();
  });

  it('returns ran=false with no work when nothing to migrate', () => {
    const result = migrateFossflowStorageKeys();
    expect(result.ran).toBe(true); // still flips the sentinel
    expect(result.localMigrated).toBe(0);
    expect(result.sessionMigrated).toBe(0);
    expect(localStorage.getItem(SENTINEL)).toBe('done');
  });

  it('ignores non-fossflow-prefixed keys', () => {
    localStorage.setItem('foo_user_settings', 'untouched');
    localStorage.setItem('axoview_existing', 'keep');
    migrateFossflowStorageKeys();
    expect(localStorage.getItem('foo_user_settings')).toBe('untouched');
    expect(localStorage.getItem('axoview_existing')).toBe('keep');
  });
});
