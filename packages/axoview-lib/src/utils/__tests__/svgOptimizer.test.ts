import {
  stripIrrelevantProperties,
  roundNumbers,
  roundStyleDeclarations,
  pruneHiddenElements,
  utf8ToBase64,
  optimizeSvgDataUrl
} from '../svgOptimizer';

// dom-to-image-more escapes only %, # and \n (escapeXhtml). Mirror that so the
// fixtures match the real shape `optimizeSvgDataUrl` receives.
const escapeXhtml = (s: string) =>
  s.replace(/%/g, '%25').replace(/#/g, '%23').replace(/\n/g, '%0A');

const makeSvgDataUri = (inner: string, w = 100, h = 50) =>
  `data:image/svg+xml;charset=utf-8,${escapeXhtml(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><foreignObject width="${w}" height="${h}">${inner}</foreignObject></svg>`
  )}`;

// Decode a base64 SVG data-URL back to its UTF-8 text.
const decodeBase64Svg = (dataUrl: string) => {
  const b64 = dataUrl.replace('data:image/svg+xml;base64,', '');
  return new TextDecoder().decode(
    Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  );
};

// ---------------------------------------------------------------------------
// Phase 1 — stripIrrelevantProperties
// ---------------------------------------------------------------------------

describe('stripIrrelevantProperties', () => {
  test('removes vendor-prefixed properties', () => {
    const input =
      '-webkit-tap-highlight-color: rgba(0,0,0,0); position: absolute; -moz-user-select: none; width: 50px';
    const result = stripIrrelevantProperties(input);
    expect(result).not.toContain('-webkit-');
    expect(result).not.toContain('-moz-');
    expect(result).toContain('position: absolute');
    expect(result).toContain('width: 50px');
  });

  test('removes animation properties', () => {
    const input =
      'animation: none; animation-duration: 0s; transition: all 0.2s; width: 100px';
    const result = stripIrrelevantProperties(input);
    expect(result).not.toContain('animation');
    expect(result).not.toContain('transition');
    expect(result).toContain('width: 100px');
  });

  test('removes will-change', () => {
    const input = 'will-change: transform; left: 10px';
    expect(stripIrrelevantProperties(input)).not.toContain('will-change');
  });

  test('removes margin/padding/inset logical props (physical equivalents present)', () => {
    const input =
      'margin-inline-start: 0px; padding-block: 4px; width: 200px; inset-inline-start: 0px';
    const result = stripIrrelevantProperties(input);
    expect(result).not.toContain('margin-inline-start');
    expect(result).not.toContain('padding-block');
    expect(result).not.toContain('inset-inline-start');
    expect(result).toContain('width: 200px');
  });

  test('preserves inline-size and block-size (critical for layout in transformed spaces)', () => {
    // In position:absolute elements inside isometric transform layers, removing
    // inline-size causes the browser to resolve width from the containing block
    // (the full canvas) instead of the explicit value, causing text to wrap.
    const input =
      'inline-size: 114.609px; block-size: 34.3125px; width: 114.609px; height: 34.3125px';
    const result = stripIrrelevantProperties(input);
    expect(result).toContain('inline-size: 114.609px');
    expect(result).toContain('block-size: 34.3125px');
    expect(result).toContain('width: 114.609px');
    expect(result).toContain('height: 34.3125px');
  });

  test('removes print and scroll props', () => {
    const input =
      'orphans: 2; widows: 2; scroll-behavior: smooth; overscroll-behavior: none; display: flex';
    const result = stripIrrelevantProperties(input);
    expect(result).not.toContain('orphans');
    expect(result).not.toContain('scroll-behavior');
    expect(result).toContain('display: flex');
  });

  test('preserves layout-critical properties', () => {
    const input =
      'position: absolute; top: 10px; left: 20px; width: 100px; height: 50px; overflow: hidden; display: flex; z-index: 10';
    const result = stripIrrelevantProperties(input);
    expect(result).toContain('position: absolute');
    expect(result).toContain('top: 10px');
    expect(result).toContain('width: 100px');
    expect(result).toContain('overflow: hidden');
    expect(result).toContain('z-index: 10');
  });

  test('preserves white-space property (critical for labels)', () => {
    const input = 'white-space: nowrap; font-size: 14px';
    const result = stripIrrelevantProperties(input);
    expect(result).toContain('white-space: nowrap');
    expect(result).toContain('font-size: 14px');
  });

  test('preserves -webkit-font-smoothing (affects text metrics)', () => {
    const input =
      '-webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: rgba(0,0,0,0)';
    const result = stripIrrelevantProperties(input);
    expect(result).toContain('-webkit-font-smoothing: antialiased');
    expect(result).not.toContain('-webkit-tap-highlight-color');
  });

  test('preserves -webkit-locale (affects font selection)', () => {
    const input = '-webkit-locale: "en"; -webkit-appearance: none';
    const result = stripIrrelevantProperties(input);
    expect(result).toContain('-webkit-locale');
    expect(result).not.toContain('-webkit-appearance');
  });

  test('handles empty and null-ish input', () => {
    expect(stripIrrelevantProperties('')).toBe('');
    expect(stripIrrelevantProperties('   ')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Phase 2 — roundNumbers
// ---------------------------------------------------------------------------

describe('roundNumbers', () => {
  test('rounds long floats to 2dp', () => {
    expect(roundNumbers('12.345678px')).toBe('12.35px');
    expect(roundNumbers('0.333333')).toBe('0.33');
    expect(roundNumbers('-99.99999px')).toBe('-100px');
  });

  test('removes trailing zeros', () => {
    expect(roundNumbers('10.10000')).toBe('10.1');
    expect(roundNumbers('5.00000px')).toBe('5px');
  });

  test('leaves short floats alone', () => {
    expect(roundNumbers('1.5px')).toBe('1.5px');
    expect(roundNumbers('10.25')).toBe('10.25');
  });

  test('leaves integers alone', () => {
    expect(roundNumbers('100px')).toBe('100px');
    expect(roundNumbers('0')).toBe('0');
  });

  test('handles SVG transform strings', () => {
    const input = 'translate(123.456789, -45.678901)';
    const result = roundNumbers(input);
    expect(result).toBe('translate(123.46, -45.68)');
  });

  test('handles empty string', () => {
    expect(roundNumbers('')).toBe('');
  });

  test('does not corrupt non-numeric text', () => {
    expect(roundNumbers('rgba(255,128,0,1)')).toBe('rgba(255,128,0,1)');
  });
});

// ---------------------------------------------------------------------------
// Phase 2b — roundStyleDeclarations (layout-safe CSS rounding)
// ---------------------------------------------------------------------------

describe('roundStyleDeclarations', () => {
  test('rounds transform values', () => {
    const input = 'transform: matrix(1, 0, 0, 1, -70.304700, -34.312500)';
    const result = roundStyleDeclarations(input);
    expect(result).toContain('matrix(1, 0, 0, 1, -70.3, -34.31)');
  });

  test('rounds perspective-origin and transform-origin', () => {
    const input =
      'perspective-origin: 70.296900px 17.156200px; transform-origin: 70.304700px 34.312500px';
    const result = roundStyleDeclarations(input);
    expect(result).toContain('70.3px 17.16px');
    expect(result).toContain('70.3px 34.31px');
  });

  test('does NOT round width', () => {
    const input = 'width: 114.609375px';
    expect(roundStyleDeclarations(input)).toBe('width: 114.609375px');
  });

  test('does NOT round height', () => {
    const input = 'height: 34.312500px';
    expect(roundStyleDeclarations(input)).toBe('height: 34.312500px');
  });

  test('does NOT round inset / top / left', () => {
    const input = 'top: -80.000000px; left: 0px; right: 234.390625px';
    const result = roundStyleDeclarations(input);
    expect(result).toContain('top: -80.000000px');
    expect(result).toContain('right: 234.390625px');
  });

  test('does NOT round padding, margin, border-width', () => {
    const input =
      'padding: 8.333333px 12.666667px; margin-top: 4.123456px; border-width: 1.000000px';
    const result = roundStyleDeclarations(input);
    expect(result).toContain('padding: 8.333333px 12.666667px');
    expect(result).toContain('margin-top: 4.123456px');
    expect(result).toContain('border-width: 1.000000px');
  });

  test('does NOT round font-size or line-height', () => {
    const input =
      'font-size: 13.600000px; line-height: 16.320000px; letter-spacing: 0.127568px';
    const result = roundStyleDeclarations(input);
    expect(result).toContain('font-size: 13.600000px');
    expect(result).toContain('line-height: 16.320000px');
    expect(result).toContain('letter-spacing: 0.127568px');
  });
});

// ---------------------------------------------------------------------------
// utf8ToBase64 — Unicode round-trip (issue #9)
// ---------------------------------------------------------------------------

describe('utf8ToBase64', () => {
  test('round-trips ASCII', () => {
    expect(new TextDecoder().decode(
      Uint8Array.from(atob(utf8ToBase64('Hello')), (c) => c.charCodeAt(0))
    )).toBe('Hello');
  });

  test('round-trips multi-byte Unicode (CJK, accents, emoji)', () => {
    const s = 'Café 日本語 🚀 Ñoño €';
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(utf8ToBase64(s)), (c) => c.charCodeAt(0))
    );
    expect(decoded).toBe(s);
  });

  test('does NOT throw on a lone surrogate (broken paste)', () => {
    // The old btoa(unescape(encodeURIComponent())) path threw URIError here.
    expect(() => utf8ToBase64('broken\uD83Dpaste')).not.toThrow();
  });

  test('handles a large string without exceeding fromCharCode limits', () => {
    const big = 'あ'.repeat(50_000);
    expect(() => utf8ToBase64(big)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// optimizeSvgDataUrl — end-to-end Unicode + resilience (issue #9)
// ---------------------------------------------------------------------------

describe('optimizeSvgDataUrl', () => {
  test('preserves Unicode label content through optimization', async () => {
    const uri = makeSvgDataUri(
      '<div xmlns="http://www.w3.org/1999/xhtml" style="width:50%">Café 日本語 🚀</div>'
    );
    const out = await optimizeSvgDataUrl(uri);
    expect(out.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const decoded = decodeBase64Svg(out);
    expect(decoded).toContain('Café');
    expect(decoded).toContain('日本語');
    expect(decoded).toContain('🚀');
  });

  test('never throws on a lone surrogate in a label', async () => {
    const uri = makeSvgDataUri(
      '<div xmlns="http://www.w3.org/1999/xhtml">broken\uD83Dpaste</div>'
    );
    let out = '';
    await expect(
      (async () => {
        out = await optimizeSvgDataUrl(uri);
      })()
    ).resolves.toBeUndefined();
    expect(out.length).toBeGreaterThan(0);
  });

  test('returns the input untouched for an unknown data-URL format', async () => {
    const weird = 'data:image/png;base64,AAAA';
    expect(await optimizeSvgDataUrl(weird)).toBe(weird);
  });
});

// ---------------------------------------------------------------------------
// Phase 3 — pruneHiddenElements
// ---------------------------------------------------------------------------

describe('pruneHiddenElements', () => {
  function makeDoc(html: string): Document {
    const parser = new DOMParser();
    return parser.parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject>${html}</foreignObject></svg>`,
      'image/svg+xml'
    );
  }

  test('removes element with display:none', () => {
    const doc = makeDoc(
      '<div style="display:none"><span>hidden</span></div><div style="display:block">visible</div>'
    );
    pruneHiddenElements(doc);
    expect(doc.querySelector('svg')!.textContent).not.toContain('hidden');
    expect(doc.querySelector('svg')!.textContent).toContain('visible');
  });

  test('removes entire subtree of display:none element', () => {
    const doc = makeDoc(
      '<div style="display:none"><p><span>deep</span></p></div>'
    );
    pruneHiddenElements(doc);
    expect(doc.getElementsByTagName('p')).toHaveLength(0);
    expect(doc.getElementsByTagName('span')).toHaveLength(0);
  });

  test('keeps elements with other display values', () => {
    const doc = makeDoc(
      '<div style="display:flex">flex</div><div style="display:block">block</div>'
    );
    const before = doc.querySelectorAll('div').length;
    pruneHiddenElements(doc);
    expect(doc.querySelectorAll('div').length).toBe(before);
  });

  test('handles elements with no style attribute', () => {
    const doc = makeDoc('<div><span>text</span></div>');
    expect(() => pruneHiddenElements(doc)).not.toThrow();
    expect(doc.querySelector('span')!.textContent).toBe('text');
  });

  test('handles display:none with surrounding whitespace in style value', () => {
    const doc = makeDoc(
      '<div style="color:red; display : none ; width:100px">x</div>'
    );
    pruneHiddenElements(doc);
    expect(doc.querySelector('div')).toBeNull();
  });
});
