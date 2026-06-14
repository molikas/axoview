/**
 * TouchPOM — drives REAL touch input for the ADR 0018 touch/pen gesture specs.
 *
 * Single-finger taps use page.touchscreen.tap (the supported high-level API).
 * One-finger pan and two-finger pinch use a CDP session
 * (Input.dispatchTouchEvent) because Playwright has no high-level multi-touch
 * API and synthetic DOM PointerEvents have no setPointerCapture semantics —
 * the lib's gesture machine relies on real captured pointers.
 *
 * All tile/point inputs are interactions-box-relative; helpers add the box's
 * viewport origin so CDP/touchscreen receive absolute viewport coordinates.
 */
import { CDPSession, Page } from '@playwright/test';
import { CanvasPOM, CanvasPoint } from './CanvasPOM';

export class TouchPOM {
  constructor(
    readonly page: Page,
    readonly canvas: CanvasPOM
  ) {}

  /** Interactions-box viewport origin (shares its bbox with the canvas). */
  private async origin(): Promise<CanvasPoint> {
    const box = await this.canvas.interactionsLayer().boundingBox();
    if (!box) throw new Error('TouchPOM: interactions box has no bounding box');
    return { x: box.x, y: box.y };
  }

  /** Box-relative point → absolute viewport point. */
  private async abs(point: CanvasPoint): Promise<CanvasPoint> {
    const o = await this.origin();
    return { x: o.x + point.x, y: o.y + point.y };
  }

  /** Box-relative point for a tile (mirrors CanvasPOM.tileToScreen). */
  async tilePoint(tile: { x: number; y: number }): Promise<CanvasPoint> {
    return this.canvas.tileToScreen(tile);
  }

  /** Tap a tile (single-finger). */
  async tapTile(tile: { x: number; y: number }) {
    const p = await this.abs(await this.tilePoint(tile));
    await this.page.touchscreen.tap(p.x, p.y);
    await this.page.waitForTimeout(60);
  }

  /** Tap a box-relative point (single-finger). */
  async tapPoint(point: CanvasPoint) {
    const p = await this.abs(point);
    await this.page.touchscreen.tap(p.x, p.y);
    await this.page.waitForTimeout(60);
  }

  private async cdp(): Promise<CDPSession> {
    return this.page.context().newCDPSession(this.page);
  }

  /** One-finger drag (pan): touchStart → moves → touchEnd. Box-relative. */
  async dragOneFinger(from: CanvasPoint, to: CanvasPoint, steps = 6) {
    const a = await this.abs(from);
    const b = await this.abs(to);
    const client = await this.cdp();
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: a.x, y: a.y, id: 0 }]
    });
    for (let i = 1; i <= steps; i++) {
      const x = a.x + ((b.x - a.x) * i) / steps;
      const y = a.y + ((b.y - a.y) * i) / steps;
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y, id: 0 }]
      });
      await this.page.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await client.detach();
    await this.page.waitForTimeout(60);
  }

  /**
   * Two-finger pinch about a centroid. `scale` > 1 zooms in, < 1 zooms out.
   * Box-relative centroid; the two fingers start `startGap` px apart and end
   * `startGap*scale` apart along the x axis.
   */
  async pinch(centroid: CanvasPoint, scale: number, startGap = 80, steps = 8) {
    const c = await this.abs(centroid);
    const half = startGap / 2;
    const endHalf = half * scale;
    const client = await this.cdp();
    const points = (h: number) => [
      { x: c.x - h, y: c.y, id: 0 },
      { x: c.x + h, y: c.y, id: 1 }
    ];
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: points(half)
    });
    for (let i = 1; i <= steps; i++) {
      const h = half + ((endHalf - half) * i) / steps;
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: points(h)
      });
      await this.page.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await client.detach();
    await this.page.waitForTimeout(60);
  }

  /**
   * Press one finger, then land a SECOND finger (without lifting the first) and
   * lift both. Used to exercise the "2nd finger aborts a carry" precedence.
   * Box-relative points.
   */
  async secondFingerTap(first: CanvasPoint, second: CanvasPoint) {
    const a = await this.abs(first);
    const b = await this.abs(second);
    const client = await this.cdp();
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: a.x, y: a.y, id: 0 }]
    });
    await this.page.waitForTimeout(30);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: a.x, y: a.y, id: 0 },
        { x: b.x, y: b.y, id: 1 }
      ]
    });
    await this.page.waitForTimeout(30);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [{ x: a.x, y: a.y, id: 0 }]
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    });
    await client.detach();
    await this.page.waitForTimeout(60);
  }
}
