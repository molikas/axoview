// ---------------------------------------------------------------------------
// glSpriteBatch — instanced, single-atlas textured-quad renderer on WebGL2.
//
// The "heroic" GPU substrate: where the previous per-quad spike re-emitted every quad's
// device-space corners on the CPU and re-uploaded a vertex buffer every frame
// (and, because each chip is a unique content-keyed texture, flushed a draw
// call PER node), this batch:
//
//   1. Packs every icon + chip + the stalk dot into ONE mipmapped texture atlas.
//   2. Stores per-instance geometry in TILE (scene) space — the anchor, the two
//      local basis vectors (which bake the isometric shear), the atlas UV rect,
//      a tint, and a counter-scale flag — uploaded ONCE when the scene changes.
//   3. Computes each corner's screen position in the VERTEX SHADER from a single
//      view uniform (zoom·dpr, device origin) + the per-instance data. A base
//      unit quad comes from gl_VertexID, so no base-quad buffer is needed.
//
// Result: pan/zoom is one uniform write + one drawArraysInstanced call for the
// WHOLE layer, at any N. No per-node CPU work, no per-frame upload, one draw
// call — the property that lets the layer scale to tens of thousands of nodes.
//
// Coordinate model (identical to the previous per-quad spike):
//   device_px = (zoom · tilePoint + origin_css) · dpr
// so u_view = (zoom·dpr, origin_css_x·dpr, origin_css_y·dpr). tilePoint is the
// getTilePosition() output (independent of zoom/scroll — the whole point: only
// the uniform changes on navigation). The label counter-scale multiplies the
// LOCAL geometry (not the anchor), matching NodesCanvas exactly.
//
// WebGL2 is required (Phase C): createSpriteBatch returns null when it is
// unavailable, and the Renderer gates the whole canvas behind the
// WebGLUnsupportedScreen rather than any per-component Canvas2D fallback.
// ---------------------------------------------------------------------------

const VERT_SRC = `#version 300 es
layout(location=0) in vec4 i_anchorLocal; // (anchorX, anchorY, localOriginX, localOriginY)  tile space
layout(location=1) in vec4 i_basis;       // (ux, uy, vx, vy)  local edge vectors, tile space
layout(location=2) in vec4 i_uvRect;      // (u0, v0, uSize, vSize)  atlas coords
layout(location=3) in vec4 i_tint;        // (r, g, b, a)  colour multiply
layout(location=4) in vec4 i_misc;        // (counterScaleFlag, _, _, _)
uniform vec2 u_resolution;   // device px
uniform vec3 u_view;         // (zoom*dpr, originX_dev, originY_dev)
uniform float u_counterScale;
out vec2 v_uv;
out vec4 v_tint;
// Two triangles of a unit quad (TL,TR,BR / TL,BR,BL) — indexed by gl_VertexID.
const vec2 QUAD[6] = vec2[6](
  vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(1.0, 1.0),
  vec2(0.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0)
);
void main() {
  vec2 q = QUAD[gl_VertexID];
  float s = mix(1.0, u_counterScale, i_misc.x);
  vec2 local = (i_anchorLocal.zw + q.x * i_basis.xy + q.y * i_basis.zw) * s;
  vec2 tile = i_anchorLocal.xy + local;
  vec2 dev = vec2(u_view.x * tile.x + u_view.y, u_view.x * tile.y + u_view.z);
  vec2 clip = (dev / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = i_uvRect.xy + q * i_uvRect.zw;
  v_tint = i_tint;
}`;

const FRAG_SRC = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_tint;
uniform sampler2D u_atlas;
out vec4 outColor;
void main() {
  // Premultiplied pipeline (atlas uploaded premultiplied): premultiply the tint's
  // alpha into its RGB so a translucent tint (halo, fillOpacity) blends correctly
  // AND a mip-minified edge doesn't pull the atlas's black transparent surround
  // into a dark/grey fringe — the "grey border around the dots / bubbly dash
  // caps" artifact. Un-fringed edges match the DOM's vector strokes.
  vec4 tex = texture(u_atlas, v_uv);
  outColor = tex * vec4(v_tint.rgb * v_tint.a, v_tint.a);
}`;

// 20 floats / instance = 5 vec4 attributes (80-byte stride, 16-byte aligned).
const FLOATS_PER_INSTANCE = 20;
const ATTR_STRIDE = FLOATS_PER_INSTANCE * 4;

// Cheap one-time WebGL2 capability probe. WebGL2 is the SOLE render substrate
// (ADR 0038): the Renderer calls this once and shows the WebGLUnsupportedScreen
// gate when it is false — there is no Canvas2D/DOM bulk fallback in any layer.
// Memoised (and the probe context is released below); safe to call every render.
// NOTE: this is strictly WEAKER than what createSpriteBatch needs (it does not
// compile the shaders or allocate the atlas), so a browser that advertises
// WebGL2 but fails those can still slip past the gate — the layers surface that
// with a console.warn and a blank layer rather than a crash.
let _webgl2Supported: boolean | null = null;
export const isWebGL2Supported = (): boolean => {
  if (_webgl2Supported !== null) return _webgl2Supported;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    _webgl2Supported = !!gl && typeof gl.createVertexArray === 'function';
    // Release the probe's context immediately — otherwise it holds one of the
    // browser's ~16 live WebGL-context slots for the tab's life (each Renderer
    // opens 4, and image-export mounts a second Renderer), pushing a busy
    // session toward the cap where the oldest context gets force-lost.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    _webgl2Supported = false;
  }
  return _webgl2Supported;
};

/** A packed sub-rectangle in the atlas, in normalised [0,1] texture coords. */
export interface UVRect {
  u0: number;
  v0: number;
  uS: number;
  vS: number;
}

export interface SpriteBatch {
  // --- atlas insertion (content-keyed; all pixels rasterised by Canvas2D) ---
  /** Pack an offscreen-canvas chip. `make` is lazy — only called on a miss. */
  putCanvas(
    key: string,
    version: number,
    make: () => HTMLCanvasElement
  ): UVRect | null;
  /** Pack a decoded icon image (downscaled to the atlas icon cap). */
  putImage(
    key: string,
    img: TexImageSource,
    w: number,
    h: number
  ): UVRect | null;
  /** The built-in filled-circle sub-rect (stalk dots + round line caps, tinted). */
  readonly dot: UVRect;
  /** A solid white texel (zero-size UV at its centre) for tinted solid quads / lines. */
  readonly white: UVRect;

  // --- instance staging (rebuilt only on a geometry change) ---
  beginInstances(): void;
  addSprite(
    anchorX: number,
    anchorY: number,
    localOriginX: number,
    localOriginY: number,
    ux: number,
    uy: number,
    vx: number,
    vy: number,
    uv: UVRect,
    r: number,
    g: number,
    b: number,
    a: number,
    counterScaleFlag: number
  ): void;
  commitInstances(): void;
  instanceCount(): number;

  // --- per-frame render (one instanced draw call) ---
  render(
    bw: number,
    bh: number,
    zoomDpr: number,
    originXDev: number,
    originYDev: number,
    counterScale: number
  ): void;

  destroy(): void;
}

const compileShader = (
  gl: WebGL2RenderingContext,
  type: number,
  src: string
): WebGLShader | null => {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn(
      '[glSpriteBatch] shader compile failed:',
      gl.getShaderInfoLog(sh)
    );
    gl.deleteShader(sh);
    return null;
  }
  return sh;
};

export const createSpriteBatch = (
  canvas: HTMLCanvasElement,
  atlasSize = 4096
): SpriteBatch | null => {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: true,
      // Premultiplied pipeline (see FRAG_SRC + the premultiplied blend): the
      // atlas is uploaded premultiplied and the shader outputs premultiplied
      // color, so the context must composite it as premultiplied too.
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      // So async image-export (dom-to-image / toDataURL) reads the drawn layer
      // rather than a cleared buffer (mirrors the previous per-quad spike).
      preserveDrawingBuffer: true
    }) as WebGL2RenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl) return null;
  // jsdom / jest-canvas-mock hand back a non-WebGL stub for any getContext arg;
  // feature-check a WebGL2-only entry point so a stub cleanly falls back.
  if (
    typeof gl.createVertexArray !== 'function' ||
    typeof gl.vertexAttribDivisor !== 'function' ||
    typeof gl.getParameter !== 'function'
  ) {
    return null;
  }

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('[glSpriteBatch] link failed:', gl.getProgramInfoLog(prog));
    return null;
  }
  const uResolution = gl.getUniformLocation(prog, 'u_resolution');
  const uView = gl.getUniformLocation(prog, 'u_view');
  const uCounterScale = gl.getUniformLocation(prog, 'u_counterScale');
  const uAtlas = gl.getUniformLocation(prog, 'u_atlas');

  // --- atlas texture ---
  const MAX = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  // Atlas dimension is caller-chosen (chip-heavy layers pass 8192; line/fill
  // layers that need only the white/dot texel pass 512). Holds ~ (ATLAS/85)²
  // distinct chips — comfortably more than a viewport-culled scene shows readable
  // at once. A single build that needs MORE (e.g. the fit-to-view harness at
  // N=1000 with LOD labels on) degrades gracefully via atlasFull, never a
  // stale/broken render.
  const ATLAS = Math.min(atlasSize, MAX);
  const GUTTER = 2; // transparent px between sub-rects so mip levels don't bleed
  const atlasTex = gl.createTexture();
  if (!atlasTex) return null;
  gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    ATLAS,
    ATLAS,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Anisotropic filtering: in ISOMETRIC view every chip/dot is sampled on a
  // SHEARED parallelogram quad, which isotropic mip/linear filtering blurs (the
  // "fuzzy in iso only" report). Aniso samples along the projected axis and keeps
  // sheared text/dots crisp; a no-op in 2D (axis-aligned) and where unsupported.
  const aniso =
    gl.getExtension('EXT_texture_filter_anisotropic') ||
    gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  if (aniso) {
    const maxAniso = gl.getParameter(
      aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT
    ) as number;
    gl.texParameterf(
      gl.TEXTURE_2D,
      aniso.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(16, maxAniso || 1)
    );
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  // Shelf packer state. The stalk-dot is packed FIRST and its region is RESERVED —
  // a compaction restores the cursor to just past it (dotShelf*), so the persistent
  // `dot` UV survives (its texels are never overwritten).
  let shelfX = 0;
  let shelfY = 0;
  let shelfH = 0;
  let dotShelfX = 0;
  let dotShelfY = 0;
  let dotShelfH = 0;
  // Set when a pack didn't fit. The NEXT beginInstances() compacts (drop the stale
  // chip cache + repack fresh) instead of resetting MID-build — a mid-build reset
  // would strand already-packed sprites on overwritten atlas regions (a
  // silently-broken render). So an overflowing chip simply doesn't draw for one
  // build, then the atlas compacts. Realistic (viewport-culled) scenes never
  // overflow; only the culling-defeated fit-to-view harness reaches this path.
  let atlasFull = false;
  let mipDirty = false;
  const uvCache = new Map<string, { uv: UVRect; version: number }>();

  const resetAtlas = () => {
    // Restore to just past the reserved dot region; drop the (stale) chip cache.
    shelfX = dotShelfX;
    shelfY = dotShelfY;
    shelfH = dotShelfH;
    uvCache.clear();
    atlasFull = false;
  };

  // Reserve a (w×h device-px) slot; returns its top-left, or null (→ atlasFull;
  // the item is skipped this build, the atlas is compacted next build). NEVER
  // resets mid-build.
  const packSlot = (w: number, h: number): { x: number; y: number } | null => {
    if (w + GUTTER > ATLAS || h + GUTTER > ATLAS) return null;
    if (shelfX + w + GUTTER > ATLAS) {
      shelfY += shelfH + GUTTER;
      shelfX = 0;
      shelfH = 0;
    }
    if (shelfY + h + GUTTER > ATLAS) {
      atlasFull = true;
      return null;
    }
    const x = shelfX;
    const y = shelfY;
    shelfX += w + GUTTER;
    if (h > shelfH) shelfH = h;
    return { x, y };
  };

  // Half-texel UV inset so LINEAR sampling at a sub-rect edge never reaches into
  // the neighbour's gutter (the classic atlas seam fix). Sub-pixel at the
  // supersampled chip resolution → visually lossless.
  const uvOf = (x: number, y: number, w: number, h: number): UVRect => ({
    u0: (x + 0.5) / ATLAS,
    v0: (y + 0.5) / ATLAS,
    uS: (w - 1) / ATLAS,
    vS: (h - 1) / ATLAS
  });

  const putCanvas = (
    key: string,
    version: number,
    make: () => HTMLCanvasElement
  ): UVRect | null => {
    const hit = uvCache.get(key);
    if (hit && hit.version === version) return hit.uv;
    const cnv = make();
    const w = cnv.width;
    const h = cnv.height;
    const slot = packSlot(w, h);
    if (!slot) return null;
    gl!.bindTexture(gl!.TEXTURE_2D, atlasTex);
    gl!.texSubImage2D(
      gl!.TEXTURE_2D,
      0,
      slot.x,
      slot.y,
      gl!.RGBA,
      gl!.UNSIGNED_BYTE,
      cnv
    );
    const uv = uvOf(slot.x, slot.y, w, h);
    uvCache.set(key, { uv, version });
    mipDirty = true;
    return uv;
  };

  const putImage = (
    key: string,
    img: TexImageSource,
    w: number,
    h: number
  ): UVRect | null => {
    const hit = uvCache.get(key);
    if (hit) return hit.uv;
    const slot = packSlot(w, h);
    if (!slot) return null;
    gl!.bindTexture(gl!.TEXTURE_2D, atlasTex);
    gl!.texSubImage2D(
      gl!.TEXTURE_2D,
      0,
      slot.x,
      slot.y,
      gl!.RGBA,
      gl!.UNSIGNED_BYTE,
      img
    );
    const uv = uvOf(slot.x, slot.y, w, h);
    uvCache.set(key, { uv, version: 0 });
    mipDirty = true;
    return uv;
  };

  // Built-in filled-circle sub-rect for the dotted stalk (round cap parity).
  const DOT_PX = 32;
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = DOT_PX;
  dotCanvas.height = DOT_PX;
  const dctx = dotCanvas.getContext('2d');
  if (dctx) {
    dctx.clearRect(0, 0, DOT_PX, DOT_PX);
    dctx.fillStyle = '#ffffff';
    dctx.beginPath();
    dctx.arc(DOT_PX / 2, DOT_PX / 2, DOT_PX / 2 - 1, 0, Math.PI * 2);
    dctx.fill();
  }
  const dotUV = putImage('__dot__', dotCanvas, DOT_PX, DOT_PX) ?? {
    u0: 0,
    v0: 0,
    uS: 0,
    vS: 0
  };
  // A solid white texel for tinted solid quads / lines (connector bodies,
  // rectangle fills + borders). Sample its CENTRE so mip minification never bleeds
  // an edge in — a zero-size UV rect anchored mid-texel.
  const WHITE_PX = 4;
  const whiteCanvas = document.createElement('canvas');
  whiteCanvas.width = WHITE_PX;
  whiteCanvas.height = WHITE_PX;
  const wctx = whiteCanvas.getContext('2d');
  if (wctx) {
    wctx.fillStyle = '#ffffff';
    wctx.fillRect(0, 0, WHITE_PX, WHITE_PX);
  }
  const whitePacked = putImage('__white__', whiteCanvas, WHITE_PX, WHITE_PX);
  const whiteUV: UVRect = whitePacked
    ? {
        u0: whitePacked.u0 + whitePacked.uS / 2,
        v0: whitePacked.v0 + whitePacked.vS / 2,
        uS: 0,
        vS: 0
      }
    : { u0: 0, v0: 0, uS: 0, vS: 0 };
  // Reserve the dot + white: a compaction restores the shelf cursor to here, so
  // their texels are never overwritten and `dot`/`white` stay valid across
  // compactions.
  dotShelfX = shelfX;
  dotShelfY = shelfY;
  dotShelfH = shelfH;

  // --- geometry / instancing ---
  const vao = gl.createVertexArray();
  const instBuf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
  for (let loc = 0; loc < 5; loc++) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, ATTR_STRIDE, loc * 16);
    gl.vertexAttribDivisor(loc, 1);
  }
  gl.bindVertexArray(null);

  let staging = new Float32Array(FLOATS_PER_INSTANCE * 1024);
  let floatCount = 0;
  let instCount = 0;
  let instDirty = false;

  const ensureCapacity = (extra: number) => {
    if (floatCount + extra <= staging.length) return;
    let next = staging.length * 2;
    while (floatCount + extra > next) next *= 2;
    const grown = new Float32Array(next);
    grown.set(staging.subarray(0, floatCount));
    staging = grown;
  };

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  // Premultiplied-alpha blend: textures are uploaded premultiplied and the shader
  // premultiplies the tint, so src is already ·α → ONE / ONE_MINUS_SRC_ALPHA.
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  return {
    dot: dotUV,
    white: whiteUV,
    putCanvas,
    putImage,
    beginInstances() {
      // Compact a full atlas here (between builds), never mid-build — see packSlot.
      if (atlasFull) resetAtlas();
      floatCount = 0;
    },
    addSprite(
      anchorX,
      anchorY,
      localOriginX,
      localOriginY,
      ux,
      uy,
      vx,
      vy,
      uv,
      r,
      g,
      b,
      a,
      counterScaleFlag
    ) {
      ensureCapacity(FLOATS_PER_INSTANCE);
      const v = staging;
      let i = floatCount;
      v[i++] = anchorX;
      v[i++] = anchorY;
      v[i++] = localOriginX;
      v[i++] = localOriginY;
      v[i++] = ux;
      v[i++] = uy;
      v[i++] = vx;
      v[i++] = vy;
      v[i++] = uv.u0;
      v[i++] = uv.v0;
      v[i++] = uv.uS;
      v[i++] = uv.vS;
      v[i++] = r;
      v[i++] = g;
      v[i++] = b;
      v[i++] = a;
      v[i++] = counterScaleFlag;
      v[i++] = 0;
      v[i++] = 0;
      v[i++] = 0;
      floatCount = i;
    },
    commitInstances() {
      instCount = (floatCount / FLOATS_PER_INSTANCE) | 0;
      instDirty = true;
    },
    instanceCount: () => instCount,
    render(bw, bh, zoomDpr, originXDev, originYDev, counterScale) {
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl!.viewport(0, 0, bw, bh);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      if (mipDirty) {
        gl!.bindTexture(gl!.TEXTURE_2D, atlasTex);
        gl!.generateMipmap(gl!.TEXTURE_2D);
        mipDirty = false;
      }
      if (instCount === 0) return;
      gl!.useProgram(prog);
      gl!.bindVertexArray(vao);
      if (instDirty) {
        gl!.bindBuffer(gl!.ARRAY_BUFFER, instBuf);
        gl!.bufferData(
          gl!.ARRAY_BUFFER,
          staging.subarray(0, floatCount),
          gl!.DYNAMIC_DRAW
        );
        instDirty = false;
      }
      gl!.uniform2f(uResolution, bw, bh);
      gl!.uniform3f(uView, zoomDpr, originXDev, originYDev);
      gl!.uniform1f(uCounterScale, counterScale);
      gl!.activeTexture(gl!.TEXTURE0);
      gl!.bindTexture(gl!.TEXTURE_2D, atlasTex);
      gl!.uniform1i(uAtlas, 0);
      gl!.drawArraysInstanced(gl!.TRIANGLES, 0, 6, instCount);
      gl!.bindVertexArray(null);
    },
    destroy() {
      gl!.deleteTexture(atlasTex);
      gl!.deleteBuffer(instBuf);
      gl!.deleteVertexArray(vao);
      gl!.deleteProgram(prog);
      gl!.deleteShader(vs);
      gl!.deleteShader(fs);
    }
  };
};
