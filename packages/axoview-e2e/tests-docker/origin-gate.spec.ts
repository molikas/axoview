/**
 * origin-gate.spec.ts — pins the backend's Origin gate as seen through nginx on
 * a remapped port (ADR 0048 §2 table).
 *
 * Browsers send `Origin` on every non-GET request, same-origin ones included;
 * curl sends none, which is why curl never saw the v3.9.0 403. Each row sends a
 * `POST /api/diagrams` with an explicit `Origin` header, through nginx, and
 * checks the gate's answer. It pins the contract, not just today's code.
 *
 * The gate (server.js `isOwnOrigin`) admits an Origin whose host[:port] equals
 * the request's `Host` header, which nginx forwards as `$http_host`, port
 * included (nginx.conf). The last row needs `Host: axoview.test:<port>`: the
 * request API runs in Node, where Chromium's host-resolver rule doesn't apply
 * and `axoview.test` doesn't resolve, so the request goes to the loopback port
 * with that `Host` header set explicitly. That is byte-for-byte what Chromium
 * sends for http://axoview.test:<port> once the name resolves to 127.0.0.1, and
 * nginx is still the hop that has to preserve the port. Reverting nginx to
 * `$host` fails this row and the first; making `isOwnOrigin` return false fails
 * both 201 rows.
 *
 * Runs under smoke-secure only (storage ON). It deletes whatever it created.
 */
import { test, expect } from './fixtures';

type Row = {
  name: string;
  origin: (own: URL) => string;
  host?: (own: URL) => string;
  expected: 201 | 403;
};

/** A port that is neither ours nor 3000 (the backend's default ALLOWED_ORIGINS). */
const otherPort = (port: string): string => (port === '9999' ? '9998' : '9999');

const ROWS: Row[] = [
  { name: "the page's own origin, port included", origin: (own) => own.origin, expected: 201 },
  { name: 'another site', origin: () => 'https://evil.example', expected: 403 },
  {
    name: 'same host, different port',
    origin: (own) => `${own.protocol}//${own.hostname}:${otherPort(own.port)}`,
    expected: 403
  },
  {
    name: 'same host, port missing',
    origin: (own) => `${own.protocol}//${own.hostname}`,
    expected: 403
  },
  {
    name: 'own origin via http://axoview.test:<port>',
    origin: (own) => `http://axoview.test:${own.port}`,
    host: (own) => `axoview.test:${own.port}`,
    expected: 201
  }
];

test.describe('Origin gate — POST /api/diagrams through nginx', () => {
  const created: string[] = [];

  test.afterEach(async ({ api }) => {
    while (created.length) {
      const id = created.pop()!;
      const res = await api.delete(`/api/diagrams/${encodeURIComponent(id)}`);
      expect([200, 404], `cleanup DELETE /api/diagrams/${id}`).toContain(res.status());
    }
  });

  for (const row of ROWS) {
    test(`${row.name} → ${row.expected}`, async ({ api, apiURL, baseURL }) => {
      const own = new URL(baseURL!);
      // Preconditions: the page's origin is the loopback origin the request API
      // talks to, on a remapped port (80 hides the port, 3000 is allowlisted).
      expect(own.origin, 'smoke-secure: page origin == API origin').toBe(new URL(apiURL).origin);
      expect(['', '80', '3000'], 'the gate is only meaningful on a remapped port').not.toContain(own.port);

      const headers: Record<string, string> = { Origin: row.origin(own) };
      if (row.host) headers.Host = row.host(own);
      const res = await api.post('/api/diagrams', {
        headers,
        data: {
          title: `origin-gate: ${row.name}`,
          name: `origin-gate: ${row.name}`,
          icons: [],
          colors: [],
          items: [],
          views: [],
          fitToScreen: true
        }
      });
      if (res.ok()) {
        const id = ((await res.json()) as { id?: string }).id;
        if (id) created.push(id);
      }

      expect(res.status(), `Origin: ${headers.Origin}${row.host ? ` · Host: ${row.host(own)}` : ''}`).toBe(
        row.expected
      );
      if (row.expected === 403) {
        // The gate's own refusal, not some other 403.
        expect(await res.json()).toEqual({ error: 'Origin not allowed' });
      } else {
        const id = created[created.length - 1];
        expect(id, 'a 201 carries the new id').toBeTruthy();
        expect((await api.get(`/api/diagrams/${encodeURIComponent(id)}`)).status()).toBe(200);
      }
    });
  }
});
