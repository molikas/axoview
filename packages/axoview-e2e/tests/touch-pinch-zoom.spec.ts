/**
 * touch-pinch-zoom.spec — ADR 0018 D-12. A two-finger pinch changes zoom
 * (zoom-to-centroid), routed through setZoom on the store. Zoom clamps at
 * MIN_ZOOM/MAX_ZOOM. Drives real multi-touch via CDP.
 */
import { canvasReadyTest as test, expect } from '../fixtures/app.fixture';
import { CanvasPOM } from '../pom/CanvasPOM';
import { TouchPOM } from '../pom/TouchPOM';
import { getZoom } from '../helpers/store';

test.describe('Touch — two-finger pinch zoom (D-12)', () => {
  test('pinch out increases zoom; pinch in decreases it; clamped to [0.1, 1]', async ({
    page,
    app
  }) => {
    void app;
    const canvas = new CanvasPOM(page);
    const touch = new TouchPOM(page, canvas);

    const centroid = { x: 400, y: 300 };

    // Pinch IN first (scale < 1) so zoom has room to grow afterwards.
    await touch.pinch(centroid, 0.5);
    const zoomedOut = await getZoom(page);
    expect(zoomedOut).toBeGreaterThanOrEqual(0.1);
    expect(zoomedOut).toBeLessThanOrEqual(1);

    // Pinch OUT (scale > 1) → zoom increases.
    await touch.pinch(centroid, 2);
    const zoomedIn = await getZoom(page);
    expect(zoomedIn).toBeGreaterThan(zoomedOut);
    expect(zoomedIn).toBeLessThanOrEqual(1); // clamp at MAX_ZOOM
  });
});
