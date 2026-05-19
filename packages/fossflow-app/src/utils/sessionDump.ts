/** Download a raw dump of all axoview sessionStorage entries. */
export const downloadSessionDump = (): void => {
  const entries: Record<string, unknown> = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (!key || !key.startsWith('axoview')) continue;
    const raw = sessionStorage.getItem(key) ?? '';
    try { entries[key] = JSON.parse(raw); } catch { entries[key] = raw; }
  }
  const blob = new Blob(
    [JSON.stringify({ timestamp: new Date().toISOString(), entries }, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `axoview-session-dump-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
