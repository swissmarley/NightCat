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

/** A clipped hedge: dense small leaves in a dozen greens. Tiles both ways. 1 tile ≈ 1.2u. */
export function hedgeTexture(rng) {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#10200f';
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 900; i++) {
    const x = rng() * W;
    const y = rng() * W;
    const r = 1.5 + rng() * 3;
    const turn = rng() * Math.PI;
    g.fillStyle = `hsl(${95 + rng() * 40}, ${30 + rng() * 25}%, ${10 + rng() * 22}%)`;
    // drawn again a tile over where it crosses an edge, so the leaves wrap
    for (const ox of [0, -W, W]) {
      for (const oy of [0, -W, W]) {
        if (x + ox < -r || x + ox > W + r || y + oy < -r || y + oy > W + r) continue;
        g.beginPath();
        g.ellipse(x + ox, y + oy, r, r * 0.6, turn, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  addNoise(g, W, W, 10, rng);
  return finish(c);
}

/** Mown grass over dark earth, for the lawns and beds. 1 tile ≈ 2u. */
export function lawnTexture(rng) {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#16240f';
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `hsla(${85 + rng() * 40}, ${25 + rng() * 30}%, ${8 + rng() * 18}%, 0.8)`;
    g.fillRect(rng() * W, rng() * W, 1, 2 + rng() * 3);
  }
  addNoise(g, W, W, 12, rng);
  return finish(c);
}

/** Pale raked gravel for the paths. 1 tile ≈ 2u. */
export function gravelTexture(rng) {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#6e665a';
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 1200; i++) {
    const l = 30 + rng() * 45;
    g.fillStyle = `hsl(${30 + rng() * 20}, ${6 + rng() * 10}%, ${l}%)`;
    g.fillRect(rng() * W, rng() * W, 1 + rng() * 2, 1 + rng() * 2);
  }
  addNoise(g, W, W, 14, rng);
  return finish(c);
}

/** One blossom petal (white, alpha), tinted per instance. */
export function petalTexture() {
  const W = 64;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, W);
  const grad = g.createRadialGradient(W / 2, W * 0.62, 2, W / 2, W / 2, W / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#e8e0e8');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(W / 2, W - 6);
  g.bezierCurveTo(6, W * 0.6, 10, 8, W / 2 - 4, 6);
  g.quadraticCurveTo(W / 2, 14, W / 2 + 4, 6);
  g.bezierCurveTo(W - 10, 8, W - 6, W * 0.6, W / 2, W - 6);
  g.fill();
  return finish(c, { repeat: false });
}

/**
 * The inside of a glasshouse as seen through its glass: lamplight low down, green
 * shade above, and the dark shapes of palms, ferns and leaves in front. Meant as
 * an emissive map on a plane at the back. Tiles across.
 */
export function conservatoryTexture(rng) {
  const W = 512;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0e2a22');
  sky.addColorStop(0.55, '#3c5a2c');
  sky.addColorStop(0.85, '#c88a3a');
  sky.addColorStop(1, '#f0b860');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  // lamps among the plants
  for (let i = 0; i < 6; i++) {
    const x = ((i + rng() * 0.6) / 6) * W;
    const y = H * (0.45 + rng() * 0.25);
    const lamp = g.createRadialGradient(x, y, 0, x, y, 60);
    lamp.addColorStop(0, 'rgba(255, 214, 140, 0.8)');
    lamp.addColorStop(1, 'rgba(255, 214, 140, 0)');
    g.fillStyle = lamp;
    g.fillRect(x - 60, y - 60, 120, 120);
  }
  // silhouettes: palms with arching fronds, broad leaves below; each is drawn
  // three times, a tile apart, so the picture wraps
  const leafy = (x, y, draw) => {
    for (const ox of [0, -W, W]) {
      g.save();
      g.translate(x + ox, y);
      draw();
      g.restore();
    }
  };
  g.fillStyle = 'rgba(6, 16, 10, 0.92)';
  g.strokeStyle = 'rgba(6, 16, 10, 0.92)';
  for (let i = 0; i < 9; i++) {
    const x = rng() * W;
    const crown = H * (0.6 + rng() * 0.3);
    const fronds = Array.from({ length: 7 }, (_, f) => [-Math.PI / 2 + (f / 6 - 0.5) * 2.6, 40 + rng() * 40]);
    leafy(x, H, () => {
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 0);
      g.quadraticCurveTo(8, -crown / 2, 0, -crown);
      g.stroke();
      g.lineWidth = 6;
      for (const [a, len] of fronds) {
        g.beginPath();
        g.moveTo(0, -crown);
        g.quadraticCurveTo(Math.cos(a) * len * 0.6, -crown + Math.sin(a) * len * 0.6 - 18, Math.cos(a) * len, -crown + Math.sin(a) * len + 10);
        g.stroke();
      }
    });
  }
  for (let i = 0; i < 40; i++) {
    const x = rng() * W;
    const y = H * (0.7 + rng() * 0.3);
    const turn = (rng() - 0.5) * 1.6;
    const rx = 8 + rng() * 14;
    const ry = 3 + rng() * 6;
    leafy(x, y, () => {
      g.rotate(turn);
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    });
  }
  return finish(c, { anisotropy: 1 });
}

/**
 * Limewash brushed on in uneven coats: near-white, streaked and patchy, so a
 * material colour can make it any blue (or white, or ochre). 1 tile ≈ 2u.
 */
export function limewashTexture(rng) {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#d8dce0';
  g.fillRect(0, 0, W, W);
  // brush strokes, each coat a little lighter or darker than the last
  for (let i = 0; i < 260; i++) {
    const l = 180 + rng() * 75;
    g.strokeStyle = `rgba(${l - 4}, ${l}, ${l + 6}, ${0.05 + rng() * 0.12})`;
    g.lineWidth = 3 + rng() * 10;
    const x = rng() * W;
    const y = rng() * W;
    const len = 10 + rng() * 40;
    const a = (rng() - 0.5) * 1.2 + (rng() < 0.5 ? 0 : Math.PI / 2);
    for (const ox of [0, -W, W]) {
      for (const oy of [0, -W, W]) {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
        g.stroke();
      }
    }
  }
  // worn patches where the plaster underneath shows through
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(150, 140, 125, ${0.08 + rng() * 0.12})`;
    g.beginPath();
    g.ellipse(rng() * W, rng() * W, 4 + rng() * 16, 3 + rng() * 9, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  addNoise(g, W, W, 18, rng);
  return finish(c);
}

/** Awning canvas in broad stripes with a pinstripe between: colours [ground, stripe, pin]. Stripes run across u. */
export function awningTexture(colors) {
  const W = 128;
  const H = 8;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const [ground, stripe, pin] = colors;
  g.fillStyle = ground;
  g.fillRect(0, 0, W, H);
  g.fillStyle = stripe;
  g.fillRect(0, 0, W / 4, H);
  g.fillRect(W / 2, 0, W / 4, H);
  g.fillStyle = pin;
  for (const x of [W * 0.375, W * 0.875]) g.fillRect(x - 2, 0, 4, H);
  return finish(c, { anisotropy: 2 });
}

/**
 * Four rugs on one sheet (2 × 2): a border, a field in a deep colour, rows of
 * diamond medallions, a fringe at the ends. Each rug fills a quarter of the sheet.
 */
export function rugTexture(rng) {
  const W = 512;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  const palettes = [
    ['#8a1c22', '#e8b850', '#1c2a5a', '#f0e2c0'],
    ['#1e3a6e', '#d8a040', '#7a1a28', '#ece0c8'],
    ['#b8502a', '#2a1a14', '#e8c878', '#f2e6d0'],
    ['#2a5a4a', '#c83a2a', '#f0d080', '#e8dcc0'],
  ];
  const S = W / 2;
  palettes.forEach(([field, border, motif, light], k) => {
    const x0 = (k % 2) * S;
    const y0 = Math.floor(k / 2) * S;
    g.save();
    g.translate(x0, y0);
    // fringe at top and bottom
    g.fillStyle = light;
    for (let x = 6; x < S - 6; x += 4) {
      g.fillRect(x, 0, 2, 10);
      g.fillRect(x, S - 10, 2, 10);
    }
    g.fillStyle = border;
    g.fillRect(6, 10, S - 12, S - 20);
    g.fillStyle = field;
    g.fillRect(22, 26, S - 44, S - 52);
    // a running zig-zag in the border
    g.strokeStyle = motif;
    g.lineWidth = 3;
    g.beginPath();
    for (let x = 10; x <= S - 10; x += 12) g.lineTo(x, 18 + ((x / 12) % 2 ? 4 : -4));
    g.stroke();
    g.beginPath();
    for (let x = 10; x <= S - 10; x += 12) g.lineTo(x, S - 18 + ((x / 12) % 2 ? 4 : -4));
    g.stroke();
    // diamond medallions down the field, each with a smaller one inside
    const diamond = (cx, cy, rx, ry, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(cx, cy - ry);
      g.lineTo(cx + rx, cy);
      g.lineTo(cx, cy + ry);
      g.lineTo(cx - rx, cy);
      g.fill();
    };
    for (let i = 0; i < 3; i++) {
      const cy = 26 + ((i + 0.5) / 3) * (S - 52);
      diamond(S / 2, cy, 46, 30, motif);
      diamond(S / 2, cy, 30, 19, light);
      diamond(S / 2, cy, 14, 9, border);
      for (const sx of [-1, 1]) diamond(S / 2 + sx * 74, cy, 10, 14, light);
    }
    g.restore();
  });
  addNoise(g, W, W, 22, rng);
  return finish(c, { repeat: false });
}

/**
 * Pierced brass: dark metal with rows of little stars and dots cut through, the
 * light behind them showing. Map and emissive map both (the holes glow).
 */
export function lanternTexture() {
  const W = 128;
  const H = 128;
  const a = canvas(W, H);
  const b = canvas(W, H);
  const g = a.getContext('2d');
  const e = b.getContext('2d');
  g.fillStyle = '#5a3e1c';
  g.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  const star = (ctx, cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const an = (i / 16) * Math.PI * 2;
      ctx.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr);
    }
    ctx.fill();
  };
  for (const ctx of [g, e]) {
    ctx.fillStyle = '#ffd890';
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const cx = (x + (y % 2 ? 0.5 : 0) + 0.25) * (W / 4);
        const cy = (y + 0.5) * (H / 4);
        star(ctx, cx % W, cy, 9);
        for (let k = 0; k < 6; k++) {
          const an = (k / 6) * Math.PI * 2;
          ctx.fillRect(((cx + Math.cos(an) * 14) % W) - 1, cy + Math.sin(an) * 14 - 1, 2.5, 2.5);
        }
      }
    }
  }
  return { map: finish(a, { anisotropy: 2 }), emissiveMap: finish(b, { anisotropy: 2 }) };
}

/** Wind-rippled sand. 1 tile ≈ 3u. */
export function sandTexture(rng) {
  const W = 256;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#b89870';
  g.fillRect(0, 0, W, W);
  for (let i = 0; i < 46; i++) {
    const y0 = (i / 46) * W + rng() * 3;
    g.strokeStyle = `rgba(${rng() < 0.5 ? '255, 236, 200' : '90, 66, 40'}, ${0.12 + rng() * 0.12})`;
    g.lineWidth = 1 + rng() * 2;
    g.beginPath();
    for (let x = 0; x <= W; x += 8) g.lineTo(x, y0 + 3 * Math.sin((x / W) * Math.PI * 4 + i));
    g.stroke();
  }
  addNoise(g, W, W, 16, rng);
  return finish(c);
}

/** Zellige: glazed tiles in eight-pointed stars and crosses, white grout between. 1 tile ≈ 0.6u. */
export function zelligeTexture(rng) {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#e8e2d4';
  g.fillRect(0, 0, W, W);
  const cols = ['#1e5aa0', '#2a8a6a', '#e0b040', '#c03a2a', '#14305a'];
  const star = (cx, cy, r, col) => {
    g.fillStyle = col;
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const rr = i % 2 ? r * 0.72 : r;
      const an = (i / 16) * Math.PI * 2 + Math.PI / 16;
      g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr);
    }
    g.fill();
  };
  for (const [x, y] of [
    [0, 0],
    [W, 0],
    [0, W],
    [W, W],
    [W / 2, W / 2],
  ]) {
    star(x, y, 28, cols[0]);
    star(x, y, 12, cols[2]);
  }
  for (const [x, y] of [
    [W / 2, 0],
    [0, W / 2],
    [W, W / 2],
    [W / 2, W],
  ]) {
    star(x, y, 20, cols[1]);
    star(x, y, 8, cols[3]);
  }
  addNoise(g, W, W, 14, rng);
  return finish(c);
}

/**
 * A small arched window in a deep reveal, with a wrought grille: lit (warm, a
 * curtain), or dark. Also the emissive map when lit.
 */
export function archWindowTexture(lit) {
  const W = 64;
  const H = 96;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const arch = (inset) => {
    g.beginPath();
    g.moveTo(inset, H - inset);
    g.lineTo(inset, W / 2);
    g.arc(W / 2, W / 2, W / 2 - inset, Math.PI, 0);
    g.lineTo(W - inset, H - inset);
    g.closePath();
  };
  g.fillStyle = '#1a1410';
  arch(0);
  g.fill();
  if (lit) {
    const grad = g.createLinearGradient(0, 8, 0, H);
    grad.addColorStop(0, '#ffe6b8');
    grad.addColorStop(1, '#ff9a48');
    g.fillStyle = grad;
  } else {
    const grad = g.createLinearGradient(0, 8, W, H);
    grad.addColorStop(0, '#22304a');
    grad.addColorStop(1, '#0a0f1a');
    g.fillStyle = grad;
  }
  arch(7);
  g.fill();
  if (lit) {
    g.fillStyle = 'rgba(140, 40, 30, 0.6)';
    g.beginPath();
    g.moveTo(7, 30);
    g.quadraticCurveTo(26, 60, 9, H - 7);
    g.lineTo(7, H - 7);
    g.fill();
  }
  g.strokeStyle = '#140e0a';
  g.lineWidth = 3;
  for (const x of [W * 0.35, W * 0.65]) {
    g.beginPath();
    g.moveTo(x, 10);
    g.lineTo(x, H - 7);
    g.stroke();
  }
  for (const y of [H * 0.45, H * 0.7]) {
    g.beginPath();
    g.moveTo(7, y);
    g.lineTo(W - 7, y);
    g.stroke();
  }
  return finish(c, { repeat: false });
}

/** A studded door under a horseshoe arch, painted (the paint colour comes from the material). */
export function doorTexture(rng) {
  const W = 128;
  const H = 192;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#e8e8e8';
  g.beginPath();
  g.moveTo(8, H);
  g.lineTo(8, 64);
  g.arc(W / 2, 64, W / 2 - 8, Math.PI * 0.92, Math.PI * 0.08);
  g.lineTo(W - 8, H);
  g.closePath();
  g.fill();
  // planks and a frame round the panels
  g.strokeStyle = 'rgba(40, 40, 50, 0.5)';
  g.lineWidth = 2;
  for (let x = 24; x < W - 10; x += 16) {
    g.beginPath();
    g.moveTo(x, 30);
    g.lineTo(x, H);
    g.stroke();
  }
  g.strokeStyle = 'rgba(30, 30, 40, 0.7)';
  g.lineWidth = 4;
  g.strokeRect(20, 80, W - 40, 44);
  g.strokeRect(20, 134, W - 40, 50);
  // iron studs
  g.fillStyle = '#2a2a30';
  for (let y = 70; y < H - 6; y += 14) {
    for (const x of [14, W - 14]) {
      g.beginPath();
      g.arc(x, y, 2.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  addNoise(g, W, H, 20, rng);
  return finish(c, { repeat: false });
}

/**
 * The Milky Way as a long band: a glowing river of faint stars with dark dust
 * lanes along it. RGB is the colour, alpha the brightness (for additive blending).
 */
export function milkyWayTexture(rng) {
  const W = 1024;
  const H = 256;
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  // the glow: a soft river along the middle, swelling towards the core...
  for (let x = 0; x < W; x += 4) {
    const core = Math.exp(-Math.pow((x - W * 0.62) / (W * 0.22), 2));
    const half = H * (0.12 + 0.1 * core);
    const y = H / 2 + 10 * Math.sin(x / 90);
    const grad = g.createLinearGradient(0, y - half, 0, y + half);
    const a = 0.05 + 0.09 * core;
    grad.addColorStop(0, 'rgba(200, 212, 255, 0)');
    grad.addColorStop(0.5, `rgba(${226 + 20 * core}, ${222 + 6 * core}, 250, ${a})`);
    grad.addColorStop(1, 'rgba(200, 212, 255, 0)');
    g.fillStyle = grad;
    g.fillRect(x, y - half, 4, half * 2);
  }
  // ...and soft clouds in it
  for (let i = 0; i < 520; i++) {
    const x = rng() * W;
    const core = Math.exp(-Math.pow((x - W * 0.62) / (W * 0.22), 2));
    const y = H / 2 + (rng() - 0.5) * H * (0.18 + 0.2 * core) + 10 * Math.sin(x / 90);
    const r = 24 + rng() * 50;
    const a = (0.012 + rng() * 0.025) * (0.5 + core);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const warm = rng() < 0.3 + core * 0.4;
    grad.addColorStop(0, warm ? `rgba(255, 228, 196, ${a})` : `rgba(200, 214, 255, ${a})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // dust lanes: dark streaks cut through the glow
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 90; i++) {
    const x = rng() * W;
    const y = H / 2 + (rng() - 0.4) * H * 0.18 + 6 * Math.sin(x / 70);
    g.fillStyle = `rgba(0, 0, 0, ${0.15 + rng() * 0.25})`;
    g.beginPath();
    g.ellipse(x, y, 20 + rng() * 60, 2 + rng() * 6, (rng() - 0.5) * 0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // the dense faint stars of the band itself
  for (let i = 0; i < 2600; i++) {
    const x = rng() * W;
    const spread = H * (0.12 + rng() * 0.2);
    const y = H / 2 + (rng() + rng() + rng() - 1.5) * spread;
    g.fillStyle = `rgba(255, 250, 240, ${0.2 + rng() * 0.6})`;
    g.fillRect(x, y, rng() < 0.1 ? 2 : 1, 1);
  }
  // fade out towards both ends and edges
  g.globalCompositeOperation = 'destination-in';
  const fadeX = g.createLinearGradient(0, 0, W, 0);
  fadeX.addColorStop(0, 'rgba(0,0,0,0)');
  fadeX.addColorStop(0.15, 'rgba(0,0,0,1)');
  fadeX.addColorStop(0.85, 'rgba(0,0,0,1)');
  fadeX.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fadeX;
  g.fillRect(0, 0, W, H);
  const fadeY = g.createLinearGradient(0, 0, 0, H);
  fadeY.addColorStop(0, 'rgba(0,0,0,0)');
  fadeY.addColorStop(0.3, 'rgba(0,0,0,1)');
  fadeY.addColorStop(0.7, 'rgba(0,0,0,1)');
  fadeY.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fadeY;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';
  return finish(c, { repeat: false, anisotropy: 1 });
}

/** A woven reed mat: straw-coloured, close vertical reeds, bound across now and then. */
export function reedTexture(rng) {
  const W = 128;
  const c = canvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#a88a58';
  g.fillRect(0, 0, W, W);
  for (let x = 0; x < W; x += 3) {
    const l = 45 + rng() * 25;
    g.fillStyle = `hsl(${36 + rng() * 8}, ${35 + rng() * 15}%, ${l}%)`;
    g.fillRect(x, 0, 2, W);
  }
  g.fillStyle = 'rgba(60, 40, 20, 0.7)';
  for (const y of [W * 0.2, W * 0.7]) g.fillRect(0, y, W, 3);
  addNoise(g, W, W, 16, rng);
  return finish(c);
}
