/// <reference types="@rsbuild/core/types" />

// `dom-to-image-more` ships no type declarations. Minimal ambient module so
// the dynamic import in `useThumbnail` can be typed without `any`.
declare module 'dom-to-image-more' {
  interface DomToImageOptions {
    width?: number;
    height?: number;
    style?: Record<string, string>;
  }
  interface DomToImageApi {
    toPng: (node: HTMLElement, options?: DomToImageOptions) => Promise<string>;
  }
  const api: DomToImageApi;
  export default api;
}
