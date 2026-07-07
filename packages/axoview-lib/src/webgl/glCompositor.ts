// ---------------------------------------------------------------------------
// glCompositor — a minimal batched textured-quad renderer on WebGL2.
//
// This is the GPU substrate the NodesCanvas / LabelsCanvas WebGL spike draws
// through. It intentionally mirrors what the Canvas2D bulk path did (ADR 0019 /
// 0031): O(visible) quads per frame, painter's order preserved, drawn into the
// same <canvas>. The win it demonstrates is compositing thousands of textured
// quads through one GL program instead of per-item Canvas2D state changes.
//
// Coordinate model: callers pass DEVICE-PIXEL quad corners (already through the
// SceneLayer zoom/scroll transform — see NodesCanvas §3). The vertex shader only
// maps device px → clip space via u_resolution, so the compositor stays a dumb,
// exact blitter and every pixel decision lives in the (proven) Canvas2D raster.
//
// Text/chip crispness: chips are rasterised by Canvas2D into offscreen canvases
// at a fixed supersample and uploaded as mipmapped textures (see itemRaster.ts),
// so glyph pixels are byte-identical to the old path; only the compositing moved.
//
// Fallback: createGLCompositor returns null if WebGL2 is unavailable, and the
// canvas components then keep their original Canvas2D draw path unchanged.
// ---------------------------------------------------------------------------

const VERT_SRC = `#version 300 es
in vec2 a_pos;
in vec2 a_uv;
in vec4 a_color;
uniform vec2 u_resolution;
out vec2 v_uv;
out vec4 v_color;
void main() {
  vec2 clip = (a_pos / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = a_uv;
  v_color = a_color;
}`;

const FRAG_SRC = `#version 300 es
precision mediump float;
in vec2 v_uv;
in vec4 v_color;
uniform sampler2D u_tex;
out vec4 outColor;
void main() {
  outColor = texture(u_tex, v_uv) * v_color;
}`;

// 8 floats / vertex: pos.xy, uv.xy, color.rgba. 6 verts / quad (two triangles).
const FLOATS_PER_VERT = 8;
const VERTS_PER_QUAD = 6;
const FLOATS_PER_QUAD = FLOATS_PER_VERT * VERTS_PER_QUAD;

/** Corners in device px, TL, TR, BR, BL order. */
export interface Corners {
  tlx: number;
  tly: number;
  trx: number;
  try_: number;
  brx: number;
  bry: number;
  blx: number;
  bly: number;
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
    // eslint-disable-next-line no-console
    console.warn('[glCompositor] shader compile failed:', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
};

// Chip textures are content-keyed; cap the live set so a churny scene can't grow
// GPU memory without bound. Least-recently-set entries are evicted (Map keeps
// insertion order) — an evicted chip is simply re-rasterised next frame.
const MAX_TEXTURES = 4096;

export interface GLCompositor {
  /** Begin a frame: resize/clear to the device backing store. */
  begin(bw: number, bh: number): void;
  /** Textured quad (icon / chip). tint defaults to opaque white (passthrough). */
  drawTexturedQuad(
    tex: WebGLTexture,
    c: Corners,
    r?: number,
    g?: number,
    b?: number,
    a?: number
  ): void;
  /** Solid-colour quad (stalk dots) — samples the built-in 1×1 white texture. */
  drawSolidQuad(c: Corners, r: number, g: number, b: number, a: number): void;
  /** Flush the current batch. Called by begin/end and on texture switches. */
  flush(): void;
  /** End a frame (flushes any remaining batch). */
  end(): void;
  /** A texture built from an already-decoded image, cached by url. null-safe. */
  imageTexture(url: string, img: TexImageSource): WebGLTexture | null;
  /**
   * A texture built from an offscreen canvas, cached by key. `version` lets the
   * caller invalidate (e.g. theme change) without a new key; a matching version
   * reuses the GPU texture with no re-upload. `make` is a LAZY factory — invoked
   * only on a cache miss, so pan/zoom (all hits) never re-rasterises a chip.
   */
  canvasTexture(
    key: string,
    version: number,
    make: () => HTMLCanvasElement
  ): WebGLTexture | null;
  /** The 1×1 white texture (exposed for solid tinted draws that batch by tex). */
  readonly whiteTex: WebGLTexture;
  destroy(): void;
}

export const createGLCompositor = (
  canvas: HTMLCanvasElement
): GLCompositor | null => {
  let gl: WebGL2RenderingContext | null = null;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      // Required so image-export (dom-to-image / toDataURL, which read the canvas
      // asynchronously, after compositing) capture the drawn layer instead of a
      // cleared buffer. Small perf cost, correctness win for the spike.
      preserveDrawingBuffer: true
    }) as WebGL2RenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl) return null;
  // jsdom / jest-canvas-mock return a non-WebGL stub for ANY getContext() arg, so
  // a truthy result isn't proof of a real WebGL2 context. Feature-check the
  // WebGL2-specific API before touching it; a stub cleanly falls back to Canvas2D
  // (createVertexArray is WebGL2-only, a good discriminator).
  if (
    typeof gl.createShader !== 'function' ||
    typeof gl.createVertexArray !== 'function' ||
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
  gl.bindAttribLocation(prog, 0, 'a_pos');
  gl.bindAttribLocation(prog, 1, 'a_uv');
  gl.bindAttribLocation(prog, 2, 'a_color');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    // eslint-disable-next-line no-console
    console.warn('[glCompositor] link failed:', gl.getProgramInfoLog(prog));
    return null;
  }
  const uResolution = gl.getUniformLocation(prog, 'u_resolution');
  const uTex = gl.getUniformLocation(prog, 'u_tex');

  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  const stride = FLOATS_PER_VERT * 4;
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 8);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 16);
  gl.bindVertexArray(null);

  // 1×1 white texture for solid tinted quads.
  const whiteTex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, whiteTex);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([255, 255, 255, 255])
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  // Non-premultiplied source over transparent; separate alpha so the framebuffer
  // alpha composites correctly over the page behind the canvas.
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA
  );
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  // Growable CPU-side vertex staging. count is in floats.
  let verts = new Float32Array(FLOATS_PER_QUAD * 256);
  let count = 0;
  let batchTex: WebGLTexture | null = null;

  const texCache = new Map<string, { tex: WebGLTexture; version: number }>();

  const ensureCapacity = (extra: number) => {
    if (count + extra <= verts.length) return;
    let next = verts.length * 2;
    while (count + extra > next) next *= 2;
    const grown = new Float32Array(next);
    grown.set(verts.subarray(0, count));
    verts = grown;
  };

  const flush = () => {
    if (count === 0 || !batchTex) {
      count = 0;
      return;
    }
    gl!.useProgram(prog);
    gl!.bindVertexArray(vao);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, vbo);
    gl!.bufferData(gl!.ARRAY_BUFFER, verts.subarray(0, count), gl!.DYNAMIC_DRAW);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, batchTex);
    gl!.uniform1i(uTex, 0);
    gl!.drawArrays(gl!.TRIANGLES, 0, count / FLOATS_PER_VERT);
    gl!.bindVertexArray(null);
    count = 0;
  };

  const pushQuad = (
    tex: WebGLTexture,
    c: Corners,
    r: number,
    g: number,
    b: number,
    a: number
  ) => {
    // Painter's order is preserved by flushing whenever the texture changes.
    if (batchTex !== tex) {
      flush();
      batchTex = tex;
    }
    ensureCapacity(FLOATS_PER_QUAD);
    const v = verts;
    let i = count;
    // TL, TR, BR  +  TL, BR, BL. uv: TL(0,0) TR(1,0) BR(1,1) BL(0,1).
    // tri 1
    v[i++] = c.tlx; v[i++] = c.tly; v[i++] = 0; v[i++] = 0; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    v[i++] = c.trx; v[i++] = c.try_; v[i++] = 1; v[i++] = 0; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    v[i++] = c.brx; v[i++] = c.bry; v[i++] = 1; v[i++] = 1; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    // tri 2
    v[i++] = c.tlx; v[i++] = c.tly; v[i++] = 0; v[i++] = 0; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    v[i++] = c.brx; v[i++] = c.bry; v[i++] = 1; v[i++] = 1; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    v[i++] = c.blx; v[i++] = c.bly; v[i++] = 0; v[i++] = 1; v[i++] = r; v[i++] = g; v[i++] = b; v[i++] = a;
    count = i;
  };

  const uploadTexture = (tex: WebGLTexture, src: TexImageSource) => {
    gl!.bindTexture(gl!.TEXTURE_2D, tex);
    gl!.texImage2D(
      gl!.TEXTURE_2D,
      0,
      gl!.RGBA,
      gl!.RGBA,
      gl!.UNSIGNED_BYTE,
      src
    );
    // WebGL2 supports mipmaps on NPOT textures; LINEAR_MIPMAP_LINEAR keeps chips
    // and icons clean when the scene is zoomed out (minified).
    gl!.generateMipmap(gl!.TEXTURE_2D);
    gl!.texParameteri(
      gl!.TEXTURE_2D,
      gl!.TEXTURE_MIN_FILTER,
      gl!.LINEAR_MIPMAP_LINEAR
    );
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_S, gl!.CLAMP_TO_EDGE);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_WRAP_T, gl!.CLAMP_TO_EDGE);
  };

  const evictIfNeeded = () => {
    while (texCache.size > MAX_TEXTURES) {
      const oldest = texCache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      const entry = texCache.get(oldest);
      if (entry) gl!.deleteTexture(entry.tex);
      texCache.delete(oldest);
    }
  };

  return {
    whiteTex,
    begin(bw: number, bh: number) {
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
      }
      gl!.viewport(0, 0, bw, bh);
      gl!.useProgram(prog);
      gl!.uniform2f(uResolution, bw, bh);
      gl!.clearColor(0, 0, 0, 0);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      count = 0;
      batchTex = null;
    },
    drawTexturedQuad(tex, c, r = 1, g = 1, b = 1, a = 1) {
      pushQuad(tex, c, r, g, b, a);
    },
    drawSolidQuad(c, r, g, b, a) {
      pushQuad(whiteTex, c, r, g, b, a);
    },
    flush,
    end() {
      flush();
    },
    imageTexture(url, img) {
      const cached = texCache.get(url);
      if (cached) return cached.tex;
      const tex = gl!.createTexture();
      if (!tex) return null;
      uploadTexture(tex, img);
      texCache.set(url, { tex, version: 0 });
      evictIfNeeded();
      return tex;
    },
    canvasTexture(key, version, make) {
      const cached = texCache.get(key);
      if (cached && cached.version === version) return cached.tex;
      const tex = cached?.tex ?? gl!.createTexture();
      if (!tex) return null;
      uploadTexture(tex, make());
      texCache.delete(key);
      texCache.set(key, { tex, version });
      evictIfNeeded();
      return tex;
    },
    destroy() {
      texCache.forEach((e) => gl!.deleteTexture(e.tex));
      texCache.clear();
      gl!.deleteTexture(whiteTex);
      gl!.deleteBuffer(vbo);
      gl!.deleteVertexArray(vao);
      gl!.deleteProgram(prog);
      gl!.deleteShader(vs);
      gl!.deleteShader(fs);
    }
  };
};
