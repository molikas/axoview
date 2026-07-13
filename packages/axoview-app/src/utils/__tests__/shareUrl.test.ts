import { shareUrlFromUuid } from '../shareUrl';

describe('shareUrlFromUuid (MQA #24 regression)', () => {
  const originalLocation = window.location;

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  function setOrigin(origin: string) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, origin },
    });
  }

  it('anchors the share URL to the current window origin (under the /app base, R1)', () => {
    setOrigin('http://localhost:3000');
    expect(shareUrlFromUuid('abc-123')).toBe('http://localhost:3000/app/display/p/abc-123');
  });

  it('does not leak the backend port (3001) into the share link', () => {
    setOrigin('http://localhost:3000');
    expect(shareUrlFromUuid('uuid')).not.toContain(':3001');
  });

  it('uses the same origin regardless of uuid shape', () => {
    setOrigin('https://example.com');
    expect(shareUrlFromUuid('00000000-0000-0000-0000-000000000000')).toBe(
      'https://example.com/app/display/p/00000000-0000-0000-0000-000000000000',
    );
  });
});
