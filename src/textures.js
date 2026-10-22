// Procedural canvas textures — no external assets, everything is generated at load.
import * as THREE from 'three';

/** Small deterministic PRNG (mulberry32) so a stage looks the same every run. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function addNoise(ctx, w, h, amount, rng) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rng() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function finish(c, { repeat = true, srgb = true, anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

/** Old brick wall, used for the street catwalk. 1 tile ≈ 2 world units. */
export function brickTexture(rng) {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#1f1b19';
  g.fillRect(0, 0, W, W);
  const bh = 16;
  const bw = 52;
  for (let row = 0; row < W / bh; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let col = -1; col < W / bw + 1; col++) {
      const x = col * bw + off + 1;
      const y = row * bh + 1;
      const hue = 18 + rng() * 14;
      const sat = 14 + rng() * 12;
      const lum = 21 + rng() * 12;
      g.fillStyle = `hsl(${hue}, ${sat}%, ${lum}%)`;
      g.fillRect(x, y, bw - 2, bh - 2);
      g.fillStyle = `hsla(${hue}, ${sat}%, ${lum + 8}%, 0.5)`;
      g.fillRect(x, y, bw - 2, 1);
    }
  }
  addNoise(g, W, W, 22, rng);
  return finish(c);
}

/** Lighter stone for the coping on top of the walls. */
export function stoneTexture(rng) {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#3b3733';
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${40 + rng() * 30}, ${38 + rng() * 26}, ${34 + rng() * 22}, ${0.25 + rng() * 0.4})`;
    g.beginPath();
    g.ellipse(rng() * W, rng() * W, 4 + rng() * 14, 2 + rng() * 6, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  addNoise(g, W, W, 18, rng);
  return finish(c);
}

/** Irregular stone blocks with moss creeping over them (shrine walls). 1 tile ≈ 2u. */
export function mossStoneTexture(rng) {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#151a16';
  g.fillRect(0, 0, W, W);
  let y = 0;
  while (y < W) {
    const rh = 18 + rng() * 14;
    let x = -rng() * 30;
    while (x < W) {
      const rw = 26 + rng() * 40;
      const hue = 90 + rng() * 60;
      const sat = 6 + rng() * 10;
      const lum = 20 + rng() * 10;
      g.fillStyle = `hsl(${hue}, ${sat}%, ${lum}%)`;
      g.fillRect(x + 1.5, y + 1.5, rw - 3, rh - 3);
      g.fillStyle = `hsla(${hue}, ${sat}%, ${lum + 7}%, 0.6)`;
      g.fillRect(x + 1.5, y + 1.5, rw - 3, 1.5);
      x += rw;
    }
    y += rh;
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `hsla(${100 + rng() * 30}, ${28 + rng() * 18}%, ${18 + rng() * 12}%, ${0.12 + rng() * 0.3})`;
    g.beginPath();
    g.ellipse(rng() * W, rng() * W, 4 + rng() * 12, 2 + rng() * 5, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  addNoise(g, W, W, 20, rng);
  return finish(c);
}

/** Tree bark — vertical streaks. */
export function barkTexture(rng) {
  const W = 128;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#2e2119';
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) {
    const x = rng() * W;
    g.strokeStyle = `hsla(${18 + rng() * 14}, ${20 + rng() * 15}%, ${10 + rng() * 18}%, ${0.4 + rng() * 0.5})`;
    g.lineWidth = 1 + rng() * 3;
    g.beginPath();
    g.moveTo(x, -5);
    g.bezierCurveTo(x + (rng() - 0.5) * 12, H * 0.3, x + (rng() - 0.5) * 12, H * 0.7, x + (rng() - 0.5) * 6, H + 5);
    g.stroke();
  }
  addNoise(g, W, H, 16, rng);
  return finish(c);
}

/** Wet asphalt: colour map + a roughness map with glossy puddles. */
export function asphaltMaps(rng) {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#0d0e14';
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${20 + rng() * 25}, ${22 + rng() * 25}, ${30 + rng() * 25}, ${rng() * 0.25})`;
    g.fillRect(rng() * W, rng() * W, 1 + rng() * 3, 1 + rng() * 3);
  }
  addNoise(g, W, W, 12, rng);
  const map = finish(c);

  const r = canvas(W, W);
  const rg = r.getContext('2d');
  rg.fillStyle = 'rgb(140,140,140)';
  rg.fillRect(0, 0, W, W);
  for (let i = 0; i < 14; i++) {
    rg.fillStyle = 'rgb(22,22,22)';
    rg.beginPath();
    rg.ellipse(rng() * W, rng() * W, 12 + rng() * 40, 6 + rng() * 18, rng() * Math.PI, 0, Math.PI * 2);
    rg.fill();
  }
  addNoise(rg, W, W, 30, rng);
  const roughnessMap = finish(r, { srgb: false });
  return { map, roughnessMap };
}

/** A building façade with a grid of windows; some lit (warm or cool), most dark. */
export function windowTexture(rng, cols, rows, { litProb = 0.42, wall = '#16161e', dim = 1 } = {}) {
  const cw = 16;
  const ch = 18;
  const c = canvas(cols * cw, rows * ch);
  const g = c.getContext('2d');
  g.fillStyle = wall;
  g.fillRect(0, 0, c.width, c.height);
  const palette = ['#ffb86b', '#ffcf8f', '#f3a35a', '#9fc0ff', '#d9b3ff', '#ffe2b0'];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cw + 4;
      const py = y * ch + 4;
      const lit = rng() < litProb;
      if (lit) {
        const col = palette[Math.floor(rng() * palette.length)];
        const alpha = (0.45 + rng() * 0.55) * dim;
        g.globalAlpha = alpha;
        g.fillStyle = col;
        g.fillRect(px, py, cw - 8, ch - 8);
        g.globalAlpha = alpha * 0.5;
        g.fillStyle = '#000';
        g.fillRect(px + (cw - 8) / 2 - 0.5, py, 1, ch - 8);
        if (rng() < 0.35) g.fillRect(px, py + 3, cw - 8, 1);
        g.globalAlpha = 1;
      } else {
        g.fillStyle = `rgba(80, 90, 120, ${0.08 + rng() * 0.1})`;
        g.fillRect(px, py, cw - 8, ch - 8);
      }
    }
  }
  const tex = finish(c, { repeat: false });
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** Soft radial glow for lamp halos & sparks (additive sprites). */
export function glowTexture() {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.14)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, W);
  return finish(c, { repeat: false });
}

/** Wide, soft blob used for mist banks and dust puffs. */
export function mistTexture() {
  const W = 256;
  const H = 128;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.save();
  g.scale(1, H / W);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, W);
  g.restore();
  return finish(c, { repeat: false });
}

/** A single leaf silhouette (white, alpha), tinted per instance. */
export function leafTexture() {
  const W = 64;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(4, 32);
  g.bezierCurveTo(16, 4, 48, 4, 60, 32);
  g.bezierCurveTo(48, 60, 16, 60, 4, 32);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(6, 32);
  g.lineTo(58, 32);
  g.stroke();
  return finish(c, { repeat: false });
}

/** Plank texture for crates and footbridges. */
export function woodTexture(rng) {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#4a3220';
  g.fillRect(0, 0, W, W);
  const planks = 4;
  for (let i = 0; i < planks; i++) {
    const y = (i * W) / planks;
    g.fillStyle = `hsl(${24 + rng() * 8}, ${35 + rng() * 10}%, ${20 + rng() * 8}%)`;
    g.fillRect(0, y + 1, W, W / planks - 2);
    for (let k = 0; k < 6; k++) {
      g.fillStyle = `rgba(0,0,0,${0.08 + rng() * 0.12})`;
      g.fillRect(0, y + 2 + rng() * (W / planks - 4), W, 1);
    }
  }
  addNoise(g, W, W, 16, rng);
  return finish(c);
}

/**
 * Tileable water normal map: a few integer-frequency waves plus ripples,
 * converted to normals with finite differences.
 */
export function waterNormalsTexture(rng) {
  const W = 256;
  const h = new Float32Array(W * W);
  const waves = [];
  for (let i = 0; i < 7; i++) {
    waves.push({
      fx: Math.round(1 + rng() * 5) * (rng() < 0.5 ? 1 : -1),
      fy: Math.round(1 + rng() * 5) * (rng() < 0.5 ? 1 : -1),
      ph: rng() * Math.PI * 2,
      amp: 0.4 + rng() * 0.8,
    });
  }
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (const w of waves) v += w.amp * Math.sin(((w.fx * x + w.fy * y) / W) * Math.PI * 2 + w.ph);
      v += (rng() - 0.5) * 0.25;
      h[y * W + x] = v;
    }
  }
  const c = canvas(W, W);
  const g = c.getContext('2d');
  const img = g.createImageData(W, W);
  const d = img.data;
  const strength = 2.2;
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const l = h[y * W + ((x - 1 + W) % W)];
      const r = h[y * W + ((x + 1) % W)];
      const u = h[((y - 1 + W) % W) * W + x];
      const dn = h[((y + 1) % W) * W + x];
      let nx = (l - r) * strength;
      let ny = (u - dn) * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * W + x) * 4;
      d[i] = (nx * 0.5 + 0.5) * 255;
      d[i + 1] = (ny * 0.5 + 0.5) * 255;
      d[i + 2] = (nz * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c, { srgb: false });
}

/**
 * BoxGeometry with UVs scaled so one texture tile covers `tile` world units on
 * every face (BoxGeometry's default UVs stretch one tile across each face).
 */
export function boxWorldUV(w, h, d, tile = 2) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * su) / tile, (uv.getY(i) * sv) / tile);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

/** Packed snow: near-white with soft blue-grey drifts and a few glints. 1 tile ≈ 2u. */
export function snowTexture(rng) {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#e9eef6';
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = `rgba(${170 + rng() * 30}, ${185 + rng() * 25}, ${215 + rng() * 25}, ${0.08 + rng() * 0.14})`;
    g.beginPath();
    g.ellipse(rng() * W, rng() * W, 10 + rng() * 40, 4 + rng() * 14, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 140; i++) {
    g.fillStyle = `rgba(255, 255, 255, ${0.4 + rng() * 0.6})`;
    g.fillRect(rng() * W, rng() * W, 1, 1);
  }
  addNoise(g, W, W, 10, rng);
  return finish(c);
}

/** Rough lime plaster, near-white so a material colour can tint it. 1 tile ≈ 2u. */
export function plasterTexture(rng) {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#d6d0c6';
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 70; i++) {
    const l = 150 + rng() * 80;
    g.fillStyle = `rgba(${l}, ${l - 6}, ${l - 14}, ${0.1 + rng() * 0.2})`;
    g.beginPath();
    g.ellipse(rng() * W, rng() * W, 6 + rng() * 30, 4 + rng() * 18, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // a few hairline cracks and a damp streak or two
  g.strokeStyle = 'rgba(60, 55, 50, 0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = rng() * W;
    let y = rng() * W;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rng() - 0.5) * 18;
      y += 4 + rng() * 10;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  for (let i = 0; i < 3; i++) {
    g.fillStyle = 'rgba(90, 84, 76, 0.12)';
    g.fillRect(rng() * W, 0, 4 + rng() * 10, W * (0.3 + rng() * 0.5));
  }
  addNoise(g, W, W, 24, rng);
  return finish(c);
}

/**
 * One window: a dark frame, four panes, a little snow on the sill line.
 * lit: warm panes with a curtain drawn half across (also used as its emissive map).
 */
export function windowPaneTexture(lit) {
  const W = 64;
  const H = 88;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#22170f';
  g.fillRect(0, 0, W, H);
  const panes = [
    [7, 7],
    [34, 7],
    [7, 46],
    [34, 46],
  ];
  for (const [x, y] of panes) {
    if (lit) {
      const grad = g.createLinearGradient(0, y, 0, y + 35);
      grad.addColorStop(0, '#ffe2b0');
      grad.addColorStop(1, '#ff9c48');
      g.fillStyle = grad;
    } else {
      const grad = g.createLinearGradient(x, y, x + 23, y + 35);
      grad.addColorStop(0, '#26324a');
      grad.addColorStop(0.45, '#101828');
      grad.addColorStop(1, '#0a101c');
      g.fillStyle = grad;
    }
    g.fillRect(x, y, 23, 35);
  }
  if (lit) {
    // curtains: soft darker drapes at the sides
    g.fillStyle = 'rgba(120, 40, 20, 0.55)';
    g.beginPath();
    g.moveTo(7, 7);
    g.quadraticCurveTo(22, 40, 9, 81);
    g.lineTo(7, 81);
    g.fill();
    g.beginPath();
    g.moveTo(57, 7);
    g.quadraticCurveTo(44, 40, 55, 81);
    g.lineTo(57, 81);
    g.fill();
  }
  return finish(c, { repeat: false });
}

/**
 * A big sheet of façade cells for the houses behind the walk: each cell is a
 * window on a neutral wall (tinted by vertex colour). Returns the colour map
 * and an emissive map in which only the lit windows show. sill: the colour of
 * the snow lying on the sills, or null for none.
 */
export function townWindowsTexture(rng, cols, rows, litProb = 0.3, sill = '#e8eef6') {
  const cw = 16;
  const ch = 18;
  const a = canvas(cols * cw, rows * ch);
  const b = canvas(cols * cw, rows * ch);
  const g = a.getContext('2d');
  const e = b.getContext('2d');
  g.fillStyle = '#8a8580';
  g.fillRect(0, 0, a.width, a.height);
  e.fillStyle = '#000';
  e.fillRect(0, 0, b.width, b.height);
  const palette = ['#ffb86b', '#ffcf8f', '#f3a35a', '#ffe2b0', '#ff9a5a'];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const px = x * cw + 5;
      const py = y * ch + 4;
      g.fillStyle = '#2a211b';
      g.fillRect(px - 1, py - 1, cw - 8, ch - 7);
      if (rng() < litProb) {
        const col = palette[Math.floor(rng() * palette.length)];
        const alpha = 0.5 + rng() * 0.5;
        for (const ctx of [g, e]) {
          ctx.globalAlpha = alpha;
          ctx.fillStyle = col;
          ctx.fillRect(px, py, cw - 10, ch - 9);
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#000';
          ctx.fillRect(px + (cw - 10) / 2 - 0.5, py, 1, ch - 9);
        }
      } else {
        g.fillStyle = `rgba(30, 40, 60, ${0.6 + rng() * 0.4})`;
        g.fillRect(px, py, cw - 10, ch - 9);
      }
      // snow on the sill (none in summer)
      if (sill) {
        g.fillStyle = sill;
        g.fillRect(px - 2, py + ch - 9, cw - 6, 2);
      }
    }
  }
  const map = finish(a, { repeat: false });
  const emissiveMap = finish(b, { repeat: false });
  return { map, emissiveMap };
}

/**
 * Northern lights: vertical rays over a bright green lower hem fading up into
 * violet. RGB is the colour, alpha the brightness (for additive blending).
 * Tiles horizontally so it can drift.
 */
export function auroraTexture(rng) {
  const W = 512;
  const H = 128;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const d = img.data;
  // ray brightness per column: integer-frequency waves so the edges meet
  const waves = [];
  for (let i = 0; i < 9; i++) waves.push({ f: 1 + Math.floor(rng() * (6 + i * 5)), ph: rng() * Math.PI * 2, a: 0.4 + rng() });
  const ray = new Float32Array(W);
  let lo = Infinity;
  let hi = -Infinity;
  for (let x = 0; x < W; x++) {
    let v = 0;
    for (const w of waves) v += w.a * Math.sin((x / W) * Math.PI * 2 * w.f + w.ph);
    ray[x] = v;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const sm = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  for (let x = 0; x < W; x++) {
    const r = (ray[x] - lo) / (hi - lo);
    const rays = 0.25 + 0.75 * r * r;
    for (let y = 0; y < H; y++) {
      const v = 1 - y / (H - 1); // 0 at the hem, 1 at the top
      const body = sm(0, 0.1, v) * Math.pow(1 - sm(0.08, 1, v), 1.6);
      const top = sm(0.3, 0.85, v);
      const i = (y * W + x) * 4;
      d[i] = 70 + 110 * top;
      d[i + 1] = 255 - 150 * top;
      d[i + 2] = 160 + 90 * top;
      d[i + 3] = 255 * body * rays;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = finish(c, { anisotropy: 1 });
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Rows of rounded clay roof tiles, dark with frost. 1 tile ≈ 1u. */
export function roofTileTexture(rng) {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#1c1414';
  g.fillRect(0, 0, W, W);
  const tw = 16;
  const th = 16;
  for (let row = 0; row < W / th; row++) {
    const off = row % 2 ? tw / 2 : 0;
    for (let col = -1; col <= W / tw; col++) {
      const x = col * tw + off;
      const y = row * th;
      const l = 16 + rng() * 10;
      g.fillStyle = `hsl(${8 + rng() * 14}, ${22 + rng() * 14}%, ${l}%)`;
      g.beginPath();
      g.moveTo(x + 1, y);
      g.lineTo(x + tw - 1, y);
      g.lineTo(x + tw - 1, y + th * 0.55);
      g.quadraticCurveTo(x + tw / 2, y + th + 2, x + 1, y + th * 0.55);
      g.fill();
      g.fillStyle = `rgba(200, 215, 240, ${0.05 + rng() * 0.12})`; // frost
      g.fillRect(x + 2, y + 1, tw - 4, 2);
    }
  }
  addNoise(g, W, W, 14, rng);
  return finish(c);
}

/** Granite blocks laid in courses, weathered and salt-stained (harbour quays). 1 tile ≈ 2u. */
export function quayStoneTexture(rng) {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#141519';
  g.fillRect(0, 0, W, W);
  const rows = 4;
  const rh = W / rows;
  for (let r = 0; r < rows; r++) {
    const start = rng() * 60;
    let x = start;
    while (x < start + W) {
      const end = Math.min(x + 50 + rng() * 70, start + W);
      const l = 24 + rng() * 14;
      const fill = `hsl(${205 + rng() * 25}, ${5 + rng() * 6}%, ${l}%)`;
      const edge = `hsla(40, 12%, ${l + 12}%, 0.4)`;
      // drawn twice, a tile apart, so the courses wrap around
      for (const off of [0, -W]) {
        g.fillStyle = fill;
        g.fillRect(x + off + 2, r * rh + 2, end - x - 4, rh - 4);
        g.fillStyle = edge;
        g.fillRect(x + off + 2, r * rh + 2, end - x - 4, 2);
      }
      x = end;
    }
  }
  // salt and lichen
  for (let i = 0; i < 80; i++) {
    const l = 190 + rng() * 50;
    g.fillStyle = `rgba(${l}, ${l}, ${l - 15}, ${0.03 + rng() * 0.08})`;
    g.beginPath();
    g.ellipse(rng() * W, rng() * W, 3 + rng() * 16, 2 + rng() * 8, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  addNoise(g, W, W, 18, rng);
  return finish(c);
}

/** Weathered vertical boards with battens over the joints, near-white so paint can tint them. 1 tile ≈ 2u. */
export function boardTexture(rng) {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#bdb8b0';
  g.fillRect(0, 0, W, W);
  const n = 8;
  const bw = W / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = `hsl(35, 6%, ${70 + rng() * 14}%)`;
    g.fillRect(i * bw + 1, 0, bw - 2, W);
    for (let k = 0; k < 10; k++) {
      g.fillStyle = `rgba(60, 50, 40, ${0.05 + rng() * 0.1})`;
      g.fillRect(i * bw + 2 + rng() * (bw - 4), 0, 1, W);
    }
  }
  for (let i = 0; i <= n; i++) {
    g.fillStyle = 'rgba(40, 34, 28, 0.4)';
    g.fillRect(i * bw - 3, 0, 6, W);
    g.fillStyle = 'rgba(255, 255, 255, 0.12)';
    g.fillRect(i * bw - 3, 0, 2, W);
  }
  // where the paint has worn away
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(60, 48, 36, ${0.05 + rng() * 0.12})`;
    g.beginPath();
    g.ellipse(rng() * W, rng() * W, 4 + rng() * 18, 2 + rng() * 10, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  addNoise(g, W, W, 14, rng);
  return finish(c);
}

/** A lighthouse beam: white, brightest at the lamp (v = 1) and fading out along its length. */
export function beamTexture() {
  const W = 4;
  const H = 128;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  return finish(c, { repeat: false, anisotropy: 1 });
}
