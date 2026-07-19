import { useEffect, useState } from 'react';

// Cache of natural aspect (naturalHeight / naturalWidth) per image URL, so the
// selection box (ADR 0044) can size a node's screen-space outline to the icon's
// actual rendered height. Populated once per URL; the browser image cache makes
// the second load instant (the WebGL layer already fetched it).
const aspectCache = new Map<string, number>();

export const useImageAspect = (url?: string): number => {
  const [aspect, setAspect] = useState<number>(() =>
    url ? aspectCache.get(url) ?? 1 : 1
  );

  useEffect(() => {
    if (!url) {
      setAspect(1);
      return;
    }
    const cached = aspectCache.get(url);
    if (cached != null) {
      setAspect(cached);
      return;
    }
    if (typeof Image === 'undefined') return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      const a =
        img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
      aspectCache.set(url, a);
      if (!cancelled) setAspect(a);
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return aspect;
};
