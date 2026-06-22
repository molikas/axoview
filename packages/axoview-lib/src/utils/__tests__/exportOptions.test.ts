jest.mock('dom-to-image-more', () => ({
  __esModule: true,
  default: { toSvg: jest.fn(), toPng: jest.fn() }
}));

import domtoimage from 'dom-to-image-more';
import { exportAsSVG } from '../exportOptions';

const toSvg = (domtoimage as unknown as { toSvg: jest.Mock }).toSvg;
const toPng = (domtoimage as unknown as { toPng: jest.Mock }).toPng;

// F-02: SVG export must not dead-end when dom-to-image's native toSvg cannot
// inline a resource on the deployed host ("Failed to fetch"). It falls back to a
// raster-backed SVG (the PNG capture path, which works) so the download always
// produces a usable file.
describe('exportAsSVG (F-02 raster fallback)', () => {
  const el = { clientWidth: 100, clientHeight: 80 } as HTMLDivElement;

  beforeEach(() => jest.clearAllMocks());

  it('returns the optimized native SVG when toSvg succeeds (no raster fallback)', async () => {
    toSvg.mockResolvedValue(
      'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    );

    const result = await exportAsSVG(el, { width: 100, height: 80 });

    expect(toSvg).toHaveBeenCalledTimes(1);
    expect(toPng).not.toHaveBeenCalled();
    expect(result.startsWith('data:image/svg+xml')).toBe(true);
  });

  it('falls back to a raster-backed SVG when toSvg throws "Failed to fetch"', async () => {
    toSvg.mockRejectedValue(new TypeError('Failed to fetch'));
    toPng.mockResolvedValue('data:image/png;base64,AAAA');

    const result = await exportAsSVG(el, { width: 100, height: 80 });

    expect(toPng).toHaveBeenCalledTimes(1);
    expect(result.startsWith('data:image/svg+xml;base64,')).toBe(true);

    // The PNG raster is embedded inside the SVG <image>.
    const decoded = atob(result.replace('data:image/svg+xml;base64,', ''));
    expect(decoded).toContain('<image');
    expect(decoded).toContain('data:image/png;base64,AAAA');
  });

  it('does not pass cacheBust to dom-to-image (the deployed Failed-to-fetch trigger)', async () => {
    toSvg.mockResolvedValue(
      'data:image/svg+xml;charset=utf-8,' +
        encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
    );

    await exportAsSVG(el, { width: 100, height: 80 });

    const passedOptions = toSvg.mock.calls[0][1];
    expect(passedOptions.cacheBust).toBeUndefined();
  });
});
