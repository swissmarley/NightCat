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
