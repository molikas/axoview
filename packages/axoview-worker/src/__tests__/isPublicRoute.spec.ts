import { isPublicRoute } from '../auth';

describe('isPublicRoute', () => {
  describe('always allows GET /api/config', () => {
    test.each(['GET'])('%s /api/config → public', (method) => {
      expect(isPublicRoute(method, '/api/config')).toBe(true);
    });

    test.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])(
      '%s /api/config → NOT public (read-only cutout)',
      (method) => {
        expect(isPublicRoute(method, '/api/config')).toBe(false);
      }
    );
  });

  describe('GET /api/public/diagrams/:uuid (ADR 0010 D6 cutout)', () => {
    test('21-char UUID accepted', () => {
      expect(isPublicRoute('GET', `/api/public/diagrams/${'A'.repeat(21)}`)).toBe(true);
    });

    test('64-char UUID accepted', () => {
      expect(isPublicRoute('GET', `/api/public/diagrams/${'A'.repeat(64)}`)).toBe(true);
    });

    test('20-char UUID rejected (below floor)', () => {
      expect(isPublicRoute('GET', `/api/public/diagrams/${'A'.repeat(20)}`)).toBe(false);
    });

    test('65-char UUID rejected (above ceiling)', () => {
      expect(isPublicRoute('GET', `/api/public/diagrams/${'A'.repeat(65)}`)).toBe(false);
    });

    test('rejects UUID containing disallowed characters', () => {
      expect(isPublicRoute('GET', `/api/public/diagrams/${'!'.repeat(21)}`)).toBe(false);
      expect(isPublicRoute('GET', `/api/public/diagrams/${'A'.repeat(20)}/`)).toBe(false);
    });

    test.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
      '%s on the share path is NOT public — write side stays authenticated (ADR 0010 D6)',
      (method) => {
        expect(isPublicRoute(method, `/api/public/diagrams/${'A'.repeat(21)}`)).toBe(false);
      }
    );

    test('rejects trailing path segments beyond the uuid', () => {
      expect(isPublicRoute('GET', `/api/public/diagrams/${'A'.repeat(21)}/extra`)).toBe(false);
    });
  });

  describe('all other routes private', () => {
    test.each([
      ['GET', '/api/diagrams'],
      ['GET', '/api/diagrams/abc'],
      ['POST', '/api/diagrams'],
      ['GET', '/api/folders'],
      ['GET', '/api/tree-manifest'],
      ['GET', '/api/public'],
      ['GET', '/api/public/'],
      ['GET', '/'],
      ['GET', '/index.html']
    ])('%s %s → NOT public', (method, pathname) => {
      expect(isPublicRoute(method, pathname)).toBe(false);
    });
  });
});
