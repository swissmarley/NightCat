// Stage VIII dressing: a monastery on the cliffs above a sea of clouds, under a
// big moon over the high peaks. The walk runs along its flat roofs — whitewashed
// walls under the dark red kemar band with its gilt mirrors, black-framed windows
// lit by butter lamps, towers with gilt roofs — over rock pinnacles standing up
// out of the clouds, across what is left of old rope bridges (their planks give
// way), and through the gorges between the cliffs, where the wind blows up out
// of the clouds and carries the cat over, paper prayer horses whirling up with
// it. Mani stones, prayer wheels, copper pots, incense burners and little
// chortens to jump; prayer flags, victory banners and a gong to slide under.
// Behind, the monastery climbs the cliff; far off, more of it on the pinnacles,
// flags strung between them, lightning flickering down in the clouds, and the
// snow on the peaks under the moon. Monastery cats watch from the roofs, a snow
// leopard from a ledge, and at the great hall a family waits by the lamps.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SceneryCats } from './cats.js';
import { mergeByMaterial, sag } from './train.js';
import { limewashTexture, kemarTexture, tibetanWindowTexture, flagPrintTexture, stoneTexture, woodTexture, boxWorldUV } from '../textures.js';

const CLOUD_Y = -2.9; // the top of the sea of clouds
const DEEP = CLOUD_Y - 1.6; // how far down the cliffs are drawn: a little way into the clouds, which hide the rest
const FRONT = 1.2; // the buildings' front walls
const BACK = -2.6; // and their backs
const STOREY = 1.9; // a building's walls under the roof, where its cliff is lowest
const FLAGS = [0x2a56c8, 0xf2efe6, 0xc8242a, 0x2a8a48, 0xeab828]; // sky, wind, fire, water, earth
const SILK = [0xe0a828, 0xb8222a, 0x2a4ab0, 0x2a8a4a];
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (x, y, z) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * A block of rough rock from y0 up to y1: a subdivided box whose sides are
 * knocked about by noise and splay out below, coloured stone by stone and
 * darker towards the clouds. A flat top stays square (it is what stands on it);
 * otherwise the top is knocked about too. spire (0–1) narrows it towards the
 * top, as the pinnacles far out over the clouds. Built in world coordinates.
 */
function rockGeo(x0, x1, y0, y1, z0, z1, seed = 0, { flatTop = true, spire = 0, coarse = 1 } = {}) {
  const w = x1 - x0;
  const h = y1 - y0;
  const d = z1 - z0;
  const step = Math.max(0.9, Math.min(w, d) / 4) * coarse;
  const geo = new THREE.BoxGeometry(w, h, d, Math.max(1, Math.round(w / step)), Math.max(1, Math.round(h / step)), Math.max(1, Math.round(d / step)));
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const col = [];
  const [cx, cy, cz] = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const rough = 0.6 + 0.05 * Math.min(w, d);
  for (let i = 0; i < pos.count; i++) {
    const [lx, ly, lz] = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    // noise from the vertex's place before it moves, so faces that share an edge stay joined
    const [qx, qy, qz] = [Math.round((cx + lx) * 4) / 4, Math.round((cy + ly) * 4) / 4, Math.round((cz + lz) * 4) / 4];
    const n = (a) => hash(qx + a, qy, qz + seed) - 0.5;
    const down = Math.max(0, h / 2 - ly);
    const k = flatTop ? smoothstep(0, 0.6, down) : 1;
    const narrow = 1 - spire * (1 - Math.sqrt(down / Math.max(h, 8))) * 0.6;
    const x = cx + lx * narrow + (n(0.1) * rough + Math.sign(lx) * down * 0.06) * k;
    const z = cz + lz * narrow + (n(0.7) * rough * 0.8 + Math.sign(lz) * down * 0.04) * k;
    const y = cy + ly + (down > 0.01 || !flatTop ? n(0.4) * 0.45 * k : 0);
    pos.setXYZ(i, x, y, z);
    uv.setXY(i, (x + z) / 2.5, y / 2.5);
    const b = (0.75 + 0.6 * n(1.3)) * (1 - 0.45 * smoothstep(0, 9, down));
    col.push(0.15 * b, 0.155 * b, 0.18 * b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const out = geo.toNonIndexed();
  out.computeVertexNormals();
  geo.dispose();
  return out;
}

/** A box whose texture runs along it, one tile every 2u, with v spanning its full height (for the kemar band). */
function bandBox(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const along = [d, d, w, w, w, w];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) uv.setX(f * 4 + v, (uv.getX(f * 4 + v) * along[f]) / 2);
  return geo;
}

/**
 * Prayer flags hung along a line of points: n flags, w wide and depth deep, in
 * the five colours in order. Each vertex carries how far it hangs from the cord
 * (0–1), which the flags' material uses to flutter them in the wind.
 */
function flagGeo(pts, n, w, depth, first = 0) {
  const pos = [];
  const uv = [];
  const col = [];
  const flut = [];
  const nor = [];
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += pts[i].distanceTo(pts[i + 1]);
  const at = (u) => {
    const f = clamp(u, 0, 1) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    return pts[i].clone().lerp(pts[i + 1], f - i);
  };
  const du = w / 2 / len;
  for (let k = 0; k < n; k++) {
    const u = (k + 0.5) / n;
    const a = at(u - du);
    const b = at(u + du);
    const c = b.clone();
    c.y -= depth;
    const d = a.clone();
    d.y -= depth;
    _c.setHex(FLAGS[(first + k) % FLAGS.length]);
    for (const [v, tu, tv, f] of [
      [a, 0, 1, 0],
      [d, 0, 0, 1],
      [c, 1, 0, 1],
      [a, 0, 1, 0],
      [c, 1, 0, 1],
      [b, 1, 1, 0],
    ]) {
      pos.push(v.x, v.y, v.z);
      uv.push(tu, tv);
      col.push(_c.r, _c.g, _c.b);
      flut.push(f);
      nor.push(0, 0, 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('flutter', new THREE.Float32BufferAttribute(flut, 1));
  return geo;
}

/** A tall flag down the side of a pole, from its top: h long, w out from the pole, fluttering more the further out. */
function bannerGeo(h, w, color) {
  const geo = new THREE.PlaneGeometry(w, h, 4, 8).translate(w / 2, -h / 2, 0);
  const pos = geo.attributes.position;
  const col = [];
  const flut = [];
  _c.setHex(color);
  for (let i = 0; i < pos.count; i++) {
    col.push(_c.r, _c.g, _c.b);
    flut.push(pos.getX(i) / w);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('flutter', new THREE.Float32BufferAttribute(flut, 1));
  return geo;
}

const cord = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, r, 4);

export const monasteryTheme = {
  key: 'monastery',
  floorY: CLOUD_Y,
  ambience: 'monastery',
  hanging: new Set(['flags', 'banner', 'gong']),
  cpSink: 0,
  fallFx: { sound: 'poof', color: 0xe8ecf6 },
  liftHint: 'the wind blows up out of the gorge — jump into it and it carries you over',
  colors: {
    bg: 0x060914,
    fog: 0x121b32,
    fogNear: 24,
    fogFar: 120,
    hemiSky: 0x4a5a8a,
    hemiGround: 0x2a2c3a,
    hemiInt: 1.15,
    moon: 0xdfe6ff,
    moonInt: 2.6,
    moonPos: [-20, 15, -92],
    moonSize: 4.2,
    moonHalo: 0xc8d4ff,
    skyTop: [0.004, 0.008, 0.028],
    skyMid: [0.018, 0.032, 0.075],
    skyHor: [0.06, 0.08, 0.14],
    starCount: 1100,
    starRange: [6, 100],
    fill: 0xc0ccff,
    puff: 0xe0e4ee,
    spark: 0xfff0a8,
    cp: 0xffc860,
  },

  makeTextures(rng) {
    return {
      wash: limewashTexture(rng),
      kemar: kemarTexture(rng),
      winLit: tibetanWindowTexture(true),
      winDark: tibetanWindowTexture(false),
      print: flagPrintTexture(rng),
      stone: stoneTexture(rng),
      wood: woodTexture(rng),
    };
  },

  /** Flags and banners: their vertices flutter by how far they hang from the cord (the `flutter` attribute). */
  flutterMat(opts) {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, emissive: 0xffffff, emissiveIntensity: 0.04, ...opts });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.time;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float flutter;\nuniform float uTime;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float fph = uTime * 7.0 + position.x * 2.3 + position.y * 1.7 + position.z * 1.3;
          transformed.z += flutter * 0.09 * sin(fph);
          transformed.y += flutter * 0.025 * sin(fph * 1.3 + 1.0);
          transformed.x += flutter * 0.03 * cos(fph * 0.9);`
        );
    };
    return mat;
  },

  init(tex) {
    this.tex = tex;
    this.time = { value: 0 };
    // filled while the level is built, used when the world is dressed
    this.swings = [];
    this.lights = [];
    this.taken = [];
    this.drums = []; // the prayer wheels to jump, turning
    this.gallery = []; // little prayer wheels along the roofs, as [x, y, z]
    this.galleryRows = [];
    this.burners = [];
    this.bridges = [];
    this.gorges = [];
    this.lamps = []; // butter lamps, as [x, y, z]
    this.windows = { lit: [], dark: [] };
    this.joists = [];
    this.home = null;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    this.m = {
      wash: std({ map: tex.wash, color: 0xf2eadc, roughness: 0.92 }),
      washBack: std({ map: tex.wash, color: 0xcfc8be, roughness: 0.95 }),
      kemar: std({ map: tex.kemar, roughness: 0.95, emissive: 0x2a0806, emissiveIntensity: 0.5 }),
      roof: std({ color: 0x625850, roughness: 1 }),
      timber: std({ color: 0x24140c, roughness: 0.85 }),
      red: std({ color: 0x8e1a18, roughness: 0.55 }),
      gold: std({ color: 0xe0b050, roughness: 0.3, metalness: 0.75, emissive: 0x4a3008, emissiveIntensity: 0.7 }),
      copper: std({ color: 0xb8683a, roughness: 0.35, metalness: 0.8, emissive: 0x2a0e04, emissiveIntensity: 0.4, side: THREE.DoubleSide }),
      bronze: std({ color: 0x9a7a3a, roughness: 0.3, metalness: 0.85, emissive: 0x2a1a06, emissiveIntensity: 0.5 }),
      rock: std({ vertexColors: true, roughness: 1, flatShading: true }),
      rockFar: std({ vertexColors: true, color: 0xb0b8c8, roughness: 1, flatShading: true }),
      slab: std({ color: 0x5e5c64, roughness: 0.95 }),
      mani: std({ color: 0x6e6e76, roughness: 0.95, flatShading: true }),
      paint: std({ color: 0xf0ece0, roughness: 0.8 }),
      wood: std({ map: tex.wood, color: 0x9a7a58, roughness: 0.85 }),
      plank: std({ map: tex.wood, color: 0xc8b49a, roughness: 0.9 }),
      rope: std({ color: 0x8a7656, roughness: 1 }),
      dark: std({ color: 0x0c0a08, roughness: 1 }),
      water: std({ color: 0x0a0c12, roughness: 0.1, metalness: 0.4 }),
      ember: std({ color: 0x2a0a04, emissive: 0xff6a20, emissiveIntensity: 2.2, roughness: 1 }),
      flame: std({ color: 0x2a1404, emissive: 0xffb048, emissiveIntensity: 3.0, roughness: 1 }),
      winLit: std({ map: tex.winLit, emissiveMap: tex.winLit, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.8, alphaTest: 0.5 }),
      winDark: std({ map: tex.winDark, roughness: 0.6, alphaTest: 0.5 }),
      flag: this.flutterMat({ map: tex.print }),
      tall: this.flutterMat({}),
      paper: std({ map: tex.print, side: THREE.DoubleSide, roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0.08 }),
      silk: SILK.map((color) => std({ color, roughness: 0.7, side: THREE.DoubleSide })),
      cushion: std({ color: 0x8a1e2a, roughness: 0.95 }),
      saffron: std({ color: 0xd8902a, roughness: 0.95 }),
      milk: std({ color: 0xf4f0e8, roughness: 0.3 }),
      bowl: std({ color: 0x6a3a1a, roughness: 0.5, side: THREE.DoubleSide }),
      door: std({ color: 0x3a0a06, emissive: 0xffa040, emissiveIntensity: 1.3, roughness: 0.8 }),
    };
    this.geo = {
      unitBox: new THREE.BoxGeometry(1, 1, 1),
      ball: new THREE.SphereGeometry(1, 14, 10),
      lump: new THREE.IcosahedronGeometry(1, 1),
      pole: new THREE.CylinderGeometry(1, 1, 1, 8),
      plane: new THREE.PlaneGeometry(1, 1),
    };
  },

  /** Buildings, pinnacles and bridges are dressed in dress(), once their neighbours are known. */
  buildPlatform() {},

  /** The things on the roofs, built round the origin into g: returns their size. Shared with the scenery. */
  shape(kind, g, rng) {
    const m = this.m;
    const add = (geo, mat, px, py, pz, shadow = true) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    if (kind === 'cairn') {
      // mani stones: flat stones heaped up, mantra painted on the biggest in white
      let y = 0;
      [
        [0.4, 0.08, 0.3],
        [0.34, 0.075, 0.26],
        [0.29, 0.07, 0.22],
        [0.24, 0.065, 0.19],
        [0.18, 0.06, 0.15],
        [0.12, 0.05, 0.1],
      ].forEach(([sx, sy, sz], i) => {
        const s = add(this.geo.lump, m.mani, (rng() - 0.5) * 0.08, y + sy * 0.8, (rng() - 0.5) * 0.06);
        s.scale.set(sx, sy, sz);
        s.rotation.y = rng() * 3;
        if (i < 3) add(this.geo.unitBox, m.paint, s.position.x, s.position.y + 0.01, sz * 0.86, false).scale.set(sx * 1.1, 0.018, 0.01);
        y += sy * 1.6;
      });
      return { w: 0.82, h: 0.66 };
    }
    if (kind === 'burner') {
      // an incense burner: a little whitewashed oven, juniper smouldering in its mouth
      add(boxWorldUV(0.62, 0.42, 0.5, 1), m.wash, 0, 0.21, 0);
      add(boxWorldUV(0.66, 0.06, 0.54, 1), m.red, 0, 0.42, 0);
      add(new THREE.SphereGeometry(0.27, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.wash, 0, 0.44, 0).scale.set(1.1, 0.9, 0.9);
      add(new THREE.CylinderGeometry(0.07, 0.09, 0.24, 10), m.wash, 0.05, 0.75, 0);
      add(new THREE.TorusGeometry(0.075, 0.015, 6, 12).rotateX(Math.PI / 2), m.red, 0.05, 0.86, 0, false);
      add(new THREE.PlaneGeometry(0.22, 0.16), m.ember, 0, 0.17, 0.252, false);
      return { w: 0.66, h: 0.86 };
    }
    if (kind === 'pots') {
      // copper water pots, a big one and a small, water dark in their mouths
      const pot = (r, h) => {
        const pts = [
          [0, 0],
          [r * 0.6, 0],
          [r * 0.95, h * 0.22],
          [r, h * 0.48],
          [r * 0.82, h * 0.78],
          [r * 0.55, h * 0.88],
          [r * 0.64, h],
        ].map(([a, b]) => new THREE.Vector2(a, b));
        return new THREE.LatheGeometry(pts, 16);
      };
      add(pot(0.27, 0.6), m.copper, -0.14, 0, 0);
      add(new THREE.TorusGeometry(0.265, 0.014, 6, 18).rotateX(Math.PI / 2), m.bronze, -0.14, 0.3, 0, false);
      add(new THREE.CircleGeometry(0.15, 14).rotateX(-Math.PI / 2), m.water, -0.14, 0.53, 0, false);
      add(pot(0.19, 0.42), m.copper, 0.24, 0, 0.04);
      add(new THREE.CircleGeometry(0.1, 14).rotateX(-Math.PI / 2), m.water, 0.24, 0.37, 0.04, false);
      return { w: 0.86, h: 0.62 };
    }
    if (kind === 'chorten') {
      // a little chorten: a stepped base, the dome, a gilt spire of rings, the moon and sun on top
      add(boxWorldUV(0.7, 0.12, 0.6, 1), m.wash, 0, 0.06, 0);
      add(boxWorldUV(0.58, 0.1, 0.5, 1), m.wash, 0, 0.17, 0);
      add(boxWorldUV(0.46, 0.08, 0.4, 1), m.wash, 0, 0.26, 0);
      add(new THREE.SphereGeometry(0.22, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), m.wash, 0, 0.28, 0).scale.set(1, 1.05, 1);
      add(boxWorldUV(0.16, 0.08, 0.16, 1), m.red, 0, 0.53, 0);
      add(new THREE.ConeGeometry(0.075, 0.3, 10), m.gold, 0, 0.72, 0);
      for (let i = 0; i < 4; i++) add(new THREE.TorusGeometry(0.06 - i * 0.01, 0.012, 5, 12).rotateX(Math.PI / 2), m.gold, 0, 0.62 + i * 0.06, 0, false);
      add(new THREE.TorusGeometry(0.04, 0.01, 5, 10, Math.PI), m.gold, 0, 0.88, 0, false).rotation.z = Math.PI;
      add(new THREE.SphereGeometry(0.025, 8, 6), m.gold, 0, 0.9, 0, false);
      return { w: 0.7, h: 0.92 };
    }
    // a prayer wheel on its plinth (the drum that turns is added by the caller)
    add(boxWorldUV(0.62, 0.1, 0.5, 1), m.wood, 0, 0.05, 0);
    add(this.geo.pole, m.timber, 0, 0.44, 0).scale.set(0.025, 0.78, 0.025);
    return { w: 0.6, h: 0.82 };
  },

  /** A prayer wheel's drum: gilt, a red band of mantra round it, turning on its axle. */
  drum(x, y, z) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const d = (geo, mat, py) => {
      const o = new THREE.Mesh(geo, mat);
      o.position.y = py;
      o.castShadow = true;
      g.add(o);
      return o;
    };
    d(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 18), m.gold, 0.42);
    d(new THREE.CylinderGeometry(0.256, 0.256, 0.16, 18), m.red, 0.42);
    for (const py of [0.18, 0.66]) d(new THREE.TorusGeometry(0.25, 0.018, 6, 18).rotateX(Math.PI / 2), m.gold, py);
    d(new THREE.ConeGeometry(0.2, 0.12, 18), m.gold, 0.73);
    d(new THREE.SphereGeometry(0.035, 8, 6), m.gold, 0.8);
    // gilt syllables on the band, so it shows turning
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = d(this.geo.unitBox, m.gold, 0.42);
      s.position.set(Math.cos(a) * 0.258, 0.42, Math.sin(a) * 0.258);
      s.rotation.y = -a;
      s.scale.set(0.01, 0.09, 0.05);
    }
    return mergeByMaterial(g);
  },

  buildObstacle(group, kind, x, top, rng) {
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    const size = this.shape(kind, g, rng);
    group.add(mergeByMaterial(g));
    if (kind === 'wheel') {
      const drum = this.drum(x, top, 0);
      group.add(drum);
      this.drums.push({ g: drum, x, spin: 0.6 });
    } else if (kind === 'burner') {
      this.burners.push({ x: x + 0.05, y: top + 0.9, z: 0 });
      this.lights.push({ x, y: top + 0.4, z: 0.8, color: 0xff7a30, intensity: 2.5, distance: 4, flicker: true });
    }
    return size;
  },

  buildHanging(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    const post = (px, h, mat) => {
      const p = new THREE.Mesh(this.geo.pole, mat);
      p.scale.set(0.04, h, 0.04);
      p.position.set(px, h / 2, -0.95);
      p.castShadow = true;
      g.add(p);
      const cap = new THREE.Mesh(this.geo.ball, m.gold);
      cap.scale.setScalar(0.055);
      cap.position.set(px, h + 0.03, -0.95);
      g.add(cap);
    };
    const arm = (px, y) => {
      const a = new THREE.Mesh(this.geo.pole, m.timber);
      a.scale.set(0.022, 0.92, 0.022);
      a.rotation.x = Math.PI / 2;
      a.position.set(px, y, -0.52);
      g.add(a);
    };
    // what hangs over the walk swings when the cat goes by
    const swing = new THREE.Group();
    g.add(swing);
    let size;
    if (kind === 'flags') {
      // a string of prayer flags, sagging low between two poles
      const lineY = 1.06;
      for (const s of [-1, 1]) {
        post(s * 0.85, lineY + 0.08, m.wood);
        arm(s * 0.85, lineY + 0.04);
      }
      swing.position.set(0, lineY, -0.06);
      const pts = sag(-0.85, 0, 0.85, 0, 0, 0.12, 12);
      swing.add(new THREE.Mesh(cord(pts, 0.008), m.rope));
      const flags = new THREE.Mesh(flagGeo(pts, 7, 0.2, 0.4, Math.floor(rng() * 5)), m.flag);
      flags.castShadow = true;
      swing.add(flags);
      size = { w: 1.3, clearance: 0.5, height: 1.06 };
    } else if (kind === 'banner') {
      // a victory banner hung from a beam: a gilt finial and canopy over skirts of silk, layer on layer
      const beamY = 1.5;
      for (const s of [-1, 1]) {
        post(s * 0.6, beamY + 0.06, m.red);
        arm(s * 0.6, beamY + 0.02);
      }
      const beam = new THREE.Mesh(this.geo.pole, m.red);
      beam.scale.set(0.035, 1.25, 0.035);
      beam.rotation.z = Math.PI / 2;
      beam.position.set(0, beamY + 0.02, -0.06);
      g.add(beam);
      swing.position.set(0, beamY, -0.06);
      const rope = new THREE.Mesh(this.geo.pole, m.rope);
      rope.scale.set(0.01, 0.3, 0.01);
      rope.position.y = -0.15;
      swing.add(rope);
      const fin = new THREE.Mesh(this.geo.ball, m.gold);
      fin.scale.setScalar(0.05);
      fin.position.y = -0.31;
      swing.add(fin);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.1, 16), m.gold);
      canopy.position.y = -0.4;
      swing.add(canopy);
      for (let i = 0; i < 4; i++) {
        const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.19 + i * 0.012, 0.23 + i * 0.012, 0.13, 16, 1, true), m.silk[i]);
        skirt.position.y = -0.51 - i * 0.115;
        skirt.castShadow = true;
        swing.add(skirt);
      }
      const hem = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 5, 18).rotateX(Math.PI / 2), m.gold);
      hem.position.y = -0.92;
      swing.add(hem);
      size = { w: 0.56, clearance: 0.53, height: 1.06 };
    } else {
      // a bronze gong hung low in a red frame: it rings as the cat goes by
      const barY = 1.48;
      for (const s of [-1, 1]) {
        post(s * 0.52, barY + 0.06, m.red);
        arm(s * 0.52, barY + 0.02);
      }
      const bar = new THREE.Mesh(this.geo.pole, m.red);
      bar.scale.set(0.035, 1.1, 0.035);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, barY + 0.02, -0.06);
      g.add(bar);
      swing.position.set(0, barY, -0.06);
      for (const s of [-1, 1]) {
        const c = new THREE.Mesh(this.geo.pole, m.rope);
        c.scale.set(0.008, 0.4, 0.008);
        c.position.set(s * 0.12, -0.2, 0);
        c.rotation.z = s * 0.25;
        swing.add(c);
      }
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.035, 28).rotateX(Math.PI / 2), m.bronze);
      disc.position.y = -0.66;
      disc.castShadow = true;
      swing.add(disc);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.022, 6, 28), m.bronze);
      rim.position.y = -0.66;
      swing.add(rim);
      const boss = new THREE.Mesh(this.geo.ball, m.gold);
      boss.scale.set(0.08, 0.08, 0.04);
      boss.position.set(0, -0.66, 0.02);
      swing.add(boss);
      size = { w: 0.6, clearance: 0.55, height: 1.08 };
    }
    mergeByMaterial(swing);
    group.add(mergeByMaterial(g));
    this.swings.push({ x, g: swing, kick: 0, age: 0, ph: rng() * 6.28, kind });
    this.lights.push({ x, y: top + 1.1, z: 0.9, color: 0xffc070, intensity: 2.5, distance: 6, flicker: true });
    return size;
  },

  /** What is left of a rope bridge: its planks (the ropes and posts are dressed with the bridge, in dress()). */
  buildBrittle(group, x0, x1, top, rng) {
    const len = x1 - x0;
    const n = Math.max(3, Math.round(len / 0.75));
    const seg = len / n;
    const plankGeo = new THREE.BoxGeometry(seg - 0.12, 0.06, 1.95);
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Group();
      p.position.set(x0 + seg * (i + 0.5), top, 0);
      const b = new THREE.Mesh(plankGeo, this.m.plank);
      b.position.set((rng() - 0.5) * 0.04, -0.03, (rng() - 0.5) * 0.06);
      b.rotation.y = (rng() - 0.5) * 0.08;
      b.rotation.x = (rng() - 0.5) * 0.04;
      b.castShadow = b.receiveShadow = true;
      p.add(b);
      group.add(p);
      pieces.push(p);
    }
    this.bridges.push({ x0, x1, top });
    return pieces;
  },

  /** A gorge with the wind in it: dressed in dress(), with its rims. */
  buildLift(group, x0, x1, low, high, ceil) {
    const z = { x0, x1, low: Math.min(low, high), ceil, boost: 0 };
    this.gorges.push(z);
    return z;
  },

  /** Home: a gate before the great hall, its doors open on the lamplight; a dharma wheel and two deer on its roof. */
  buildGoal(level, rng) {
    const m = this.m;
    const gx = level.goalX;
    const last = level.platforms[level.platforms.length - 1];
    const top = last.top;
    this.home = { x: gx, top };
    const g = new THREE.Group();
    const add = (geo, mat, x, y, z, shadow = false) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    // the gate: two red pillars behind the walk, a painted beam, a little gilt roof
    const back = -0.95;
    for (const s of [-1, 1]) {
      add(this.geo.pole, m.red, gx + s * 1.1, top + 1.15, back, true).scale.set(0.08, 2.3, 0.08);
      add(this.geo.unitBox, m.gold, gx + s * 1.1, top + 2.3, back).scale.set(0.22, 0.08, 0.22);
    }
    add(bandBox(2.8, 0.26, 0.28), m.kemar, gx, top + 2.45, back);
    add(this.geo.unitBox, m.gold, gx, top + 2.6, back).scale.set(2.9, 0.05, 0.3);
    const roof = add(new THREE.ConeGeometry(1.95, 0.55, 4), m.gold, gx, top + 2.9, back, true);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.3);
    add(this.geo.ball, m.gold, gx, top + 3.22, back).scale.setScalar(0.09);
    add(new THREE.ConeGeometry(0.06, 0.25, 8), m.gold, gx, top + 3.4, back);

    // the great hall behind it: whitewashed, two red bands, its doors open
    const hx0 = gx - 6;
    const hx1 = gx + 13;
    const hz0 = -7.5;
    const hz1 = -3.0;
    const hy0 = top - STOREY - 0.6;
    const hy1 = top + 5.4;
    const hall = add(boxWorldUV(hx1 - hx0, hy1 - hy0, hz1 - hz0, 2), m.washBack, (hx0 + hx1) / 2, (hy0 + hy1) / 2, (hz0 + hz1) / 2);
    hall.receiveShadow = true;
    add(bandBox(hx1 - hx0 + 0.06, 0.7, hz1 - hz0 + 0.06), m.kemar, (hx0 + hx1) / 2, hy1 - 0.45, (hz0 + hz1) / 2);
    add(bandBox(hx1 - hx0 + 0.06, 0.35, hz1 - hz0 + 0.06), m.kemar, (hx0 + hx1) / 2, top + 3.0, (hz0 + hz1) / 2);
    add(boxWorldUV(hx1 - hx0 + 0.2, 0.12, hz1 - hz0 + 0.2, 2), m.roof, (hx0 + hx1) / 2, hy1 + 0.02, (hz0 + hz1) / 2);
    add(new THREE.PlaneGeometry(1.7, 2.2), m.door, gx, top + 1.1, hz1 + 0.012);
    for (const s of [-1, 1]) {
      // the door leaves, swung open into the light, and the black surround
      add(this.geo.unitBox, m.red, gx + s * 0.95, top + 1.1, hz1 + 0.2).scale.set(0.06, 2.2, 0.4);
      add(this.geo.unitBox, m.dark, gx + s * 1.0, top + 1.2, hz1 + 0.015).scale.set(0.2, 2.5, 0.01);
    }
    add(this.geo.unitBox, m.dark, gx, top + 2.45, hz1 + 0.015).scale.set(2.2, 0.22, 0.01);
    for (const wx of [hx0 + 1.5, hx0 + 3.4, gx + 3.2, gx + 5.2, gx + 7.2, gx + 9.4, hx1 - 1.5]) {
      for (const wy of [top + 4.1, top + 1.6]) {
        if (Math.abs(wx - gx) < 2) continue;
        this.windows[rng() < 0.75 ? 'lit' : 'dark'].push(_m.compose(_p.set(wx, wy, hz1 + 0.012), _q.identity(), _s.set(0.85, 1.05, 1)).clone());
      }
    }
    // on the roof: the dharma wheel between two deer, and gilt banners at the corners
    const wy = hy1 + 0.75;
    const wz = hz1 + 0.3;
    add(new THREE.TorusGeometry(0.5, 0.06, 8, 28), m.gold, gx, wy, wz, true);
    add(this.geo.ball, m.gold, gx, wy, wz).scale.set(0.12, 0.12, 0.08);
    for (let i = 0; i < 8; i++) {
      const sp = add(this.geo.unitBox, m.gold, gx, wy, wz);
      sp.rotation.z = (i / 8) * Math.PI;
      sp.scale.set(0.035, 0.95, 0.035);
    }
    add(new THREE.ConeGeometry(0.18, 0.35, 10), m.gold, gx, wy + 0.72, wz);
    add(boxWorldUV(1.4, 0.2, 0.5, 1), m.gold, gx, hy1 + 0.18, wz);
    for (const s of [-1, 1]) {
      // a deer lying down, looking up at the wheel
      const deer = new THREE.Group();
      deer.position.set(gx + s * 1.0, hy1 + 0.08, wz);
      deer.rotation.y = s > 0 ? Math.PI : 0;
      const part = (geo, sx, sy, sz, px, py, pz) => {
        const o = new THREE.Mesh(geo, m.gold);
        o.scale.set(sx, sy, sz);
        o.position.set(px, py, pz);
        o.castShadow = true;
        deer.add(o);
        return o;
      };
      part(this.geo.ball, 0.32, 0.17, 0.16, 0, 0.17, 0);
      part(this.geo.pole, 0.05, 0.3, 0.05, 0.22, 0.36, 0).rotation.z = -0.5;
      part(this.geo.ball, 0.09, 0.07, 0.07, 0.32, 0.5, 0).rotation.z = 0.5;
      for (const e of [-1, 1]) part(new THREE.ConeGeometry(1, 1, 6), 0.025, 0.1, 0.025, 0.28, 0.58, e * 0.05);
      for (const f of [-1, 1]) part(this.geo.ball, 0.12, 0.05, 0.05, 0.1, 0.04, f * 0.1);
      g.add(deer);
    }
    for (const x of [hx0 + 0.4, hx1 - 0.4]) {
      add(new THREE.CylinderGeometry(0.16, 0.16, 0.7, 12), m.gold, x, hy1 + 0.45, hz1 + 0.3, true);
      add(this.geo.ball, m.gold, x, hy1 + 0.85, hz1 + 0.3).scale.setScalar(0.12);
    }
    // the cliff under it
    g.add(new THREE.Mesh(rockGeo(hx0 - 0.5, hx1 + 0.5, DEEP, hy0 + 0.05, hz0 - 1, hz1 + 0.4, 7), m.rock));
    level.group.add(mergeByMaterial(g));
    level.fixtures.push({ x: gx, y: top + 1.3, z: -1.6, color: 0xffa050, intensity: 7, distance: 9, flicker: true });
    level.fixtures.push({ x: gx, y: top + 2.9, z: 0.2, color: 0xffd080, intensity: 3, distance: 6 });
  },

  // --- dressing ----------------------------------------------------------------
  dress(world) {
    const { quality } = world;
    const S = (world.themeState = {
      cats: null,
      strips: [],
      far: [],
      sea: null,
      zones: [],
      papers: null,
      mist: null,
      smoke: null,
      gallery: null,
      bolt: null,
      flashT: 5,
      lastCatX: 0,
      finale: false,
      homeZone: null,
    });
    this.buildClusters(world);
    this.buildBridges(world);
    this.buildGorges(world, S, Math.round(44 * quality.particles));
    this.buildCloudSea(world, S);
    this.buildClouds(world, S);
    this.buildPeaks(world, S);
    this.buildDistance(world, S);
    this.buildCats(world, S);
    this.buildSmoke(world, S, Math.round(28 * quality.particles));
    this.buildInstanced(world, S);
    for (const l of this.lights) world.fixtures.push(l);
  },

  /**
   * The monastery: platforms that touch are one building on its cliff, each part
   * a block of it (a tall one a tower); a lone short platform is a rock pinnacle.
   * Behind the longer ones the monastery climbs the cliff.
   */
  buildClusters(world) {
    const { scene, level, rng } = world;
    const clusters = [];
    for (const pl of level.platforms) {
      const c = clusters[clusters.length - 1];
      if (c && Math.abs(pl.x0 - c.x1) < 0.01) {
        c.parts.push(pl);
        c.x1 = pl.x1;
      } else clusters.push({ x0: pl.x0, x1: pl.x1, parts: [pl] });
    }
    this.clusters = clusters;
    const lastPl = level.platforms[level.platforms.length - 1];
    clusters.forEach((c, ci) => {
      const parts = c.parts.filter((pl) => !pl.brittle && !pl.bouncy);
      if (!parts.length) return;
      const g = new THREE.Group();
      const x0 = parts[0].x0;
      const x1 = parts[parts.length - 1].x1;
      if (parts.length === 1 && c.parts.length === 1 && x1 - x0 <= 6.5) {
        this.pinnacle(g, parts[0], ci, rng);
        scene.add(mergeByMaterial(g));
        return;
      }
      const minTop = Math.min(...parts.map((pl) => pl.top));
      const maxTop = Math.max(...parts.map((pl) => pl.top));
      const base = minTop - STOREY;
      g.add(new THREE.Mesh(rockGeo(x0 - 0.25, x1 + 0.25, DEEP, base + 0.05, -4.2, FRONT + 0.45, ci), this.m.rock));
      for (const pl of parts) {
        if (pl.top >= 1.8 && pl.x1 - pl.x0 >= 12) this.tower(g, pl, base, rng);
        else this.building(g, pl, base, rng);
      }
      const home = parts.includes(lastPl);
      if (!home && x1 - x0 >= 14) this.backBuildings(g, x0, x1, minTop, maxTop, ci, rng);
      if (!home) this.galleries(level, parts);
      scene.add(mergeByMaterial(g));
    });
  },

  /** A block of the monastery under a stretch of roof: whitewash, the kemar band, rafter ends, windows. */
  building(g, pl, base, rng) {
    const { x0, x1, top } = pl;
    const m = this.m;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const cz = (FRONT + BACK) / 2;
    const h = top - 0.1 - base;
    const body = new THREE.Mesh(boxWorldUV(len, h, FRONT - BACK, 2), m.wash);
    body.position.set(cx, base + h / 2, cz);
    body.receiveShadow = true;
    g.add(body);
    const band = new THREE.Mesh(bandBox(len + 0.06, 0.5, FRONT - BACK + 0.06), m.kemar);
    band.position.set(cx, top - 0.37, cz);
    g.add(band);
    const roof = new THREE.Mesh(boxWorldUV(len + 0.1, 0.1, FRONT - BACK + 0.16, 2), m.roof);
    roof.position.set(cx, top - 0.05, cz);
    roof.receiveShadow = roof.castShadow = true;
    g.add(roof);
    for (const y of [top - 0.11, top - 0.72]) {
      const edge = new THREE.Mesh(this.geo.unitBox, m.timber);
      edge.scale.set(len + 0.1, 0.05, 0.06);
      edge.position.set(cx, y, FRONT + 0.08);
      g.add(edge);
    }
    for (let x = x0 + 0.15; x < x1 - 0.05; x += 0.3) this.joists.push(_m.compose(_p.set(x, top - 0.66, FRONT + 0.05), _q.identity(), _s.set(0.09, 0.08, 0.14)).clone());
    this.windowRows(x0, x1, top - 1.32, base, FRONT + 0.012, rng);
    this.lights.push({ x: cx, y: top - 1.2, z: FRONT + 0.9, color: 0xffb060, intensity: 3.5, distance: 6, flicker: rng() < 0.4 });
  },

  /** Rows of windows on a wall from y down, while there is wall for them; some lit. */
  windowRows(x0, x1, y, base, z, rng, litProb = 0.55) {
    for (; y - 0.5 > base + 0.2; y -= 1.2) {
      for (let x = x0 + 1.0; x < x1 - 0.7; x += 1.7 + rng() * 0.6) {
        if (rng() < 0.18) continue;
        this.windows[rng() < litProb ? 'lit' : 'dark'].push(_m.compose(_p.set(x, y, z), _q.identity(), _s.set(0.8, 1.0, 1)).clone());
      }
    }
  },

  /** A tower: a building with a second band round it and a gilt roof on the back of its roof. */
  tower(g, pl, base, rng) {
    this.building(g, pl, base, rng);
    const { x0, x1, top } = pl;
    const m = this.m;
    const cx = (x0 + x1) / 2;
    if (top - 2.3 > base + 0.3) {
      const band = new THREE.Mesh(bandBox(x1 - x0 + 0.06, 0.28, FRONT - BACK + 0.06), m.kemar);
      band.position.set(cx, top - 2.15, (FRONT + BACK) / 2);
      g.add(band);
    }
    const n = x1 - x0 >= 18 ? 2 : 1;
    for (let i = 0; i < n; i++) this.pavilion(g, n === 1 ? cx : x0 + (x1 - x0) * (i ? 0.72 : 0.28), top, -1.95);
  },

  /** A little pavilion with a gilt roof: four red posts, the roof, a finial. */
  pavilion(g, x, y, z) {
    const m = this.m;
    for (const sx of [-0.55, 0.55]) {
      for (const sz of [-0.4, 0.4]) {
        const p = new THREE.Mesh(this.geo.pole, m.red);
        p.scale.set(0.05, 0.75, 0.05);
        p.position.set(x + sx, y + 0.375, z + sz);
        p.castShadow = true;
        g.add(p);
      }
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.55, 4), m.gold);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.8);
    roof.position.set(x, y + 1.0, z);
    roof.castShadow = true;
    g.add(roof);
    const ball = new THREE.Mesh(this.geo.ball, m.gold);
    ball.scale.setScalar(0.08);
    ball.position.set(x, y + 1.33, z);
    g.add(ball);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 8), m.gold);
    spire.position.set(x, y + 1.52, z);
    g.add(spire);
  },

  /** The monastery climbing the cliff behind a building: higher blocks set back, a gilt roof on some. */
  backBuildings(g, x0, x1, minTop, maxTop, ci, rng) {
    const m = this.m;
    const len = x1 - x0;
    const n = 1 + Math.floor(len / 18);
    for (let i = 0; i < n; i++) {
      const bl = Math.min(len, 5 + rng() * 8);
      const bx0 = x0 + rng() * (len - bl);
      const bx1 = bx0 + bl;
      const z1 = -3.0 - i * 0.4;
      const z0 = z1 - 2.5 - rng() * 2;
      const top = maxTop + 1.3 + rng() * 3.2;
      const base = minTop - STOREY - 0.4;
      const h = top - base;
      const body = new THREE.Mesh(boxWorldUV(bl, h, z1 - z0, 2), m.washBack);
      body.position.set((bx0 + bx1) / 2, base + h / 2, (z0 + z1) / 2);
      body.receiveShadow = true;
      g.add(body);
      const band = new THREE.Mesh(bandBox(bl + 0.06, 0.55, z1 - z0 + 0.06), m.kemar);
      band.position.set((bx0 + bx1) / 2, top - 0.4, (z0 + z1) / 2);
      g.add(band);
      const roof = new THREE.Mesh(boxWorldUV(bl + 0.1, 0.1, z1 - z0 + 0.16, 2), m.roof);
      roof.position.set((bx0 + bx1) / 2, top + 0.03, (z0 + z1) / 2);
      g.add(roof);
      this.windowRows(bx0, bx1, top - 1.35, base + 1.6, z1 + 0.012, rng, 0.45);
      if (rng() < 0.5) this.pavilion(g, (bx0 + bx1) / 2, top + 0.08, (z0 + z1) / 2);
      g.add(new THREE.Mesh(rockGeo(bx0 - 0.3, bx1 + 0.3, DEEP, base + 0.05, z0 - 0.8, z1 + 0.2, ci * 7 + i), m.rock));
    }
  },

  /** On a long roof, out of the way of what is on the walk: a row of little prayer wheels under a roof of their own. */
  galleries(level, parts) {
    const busy = (x) =>
      level.hangers.some((h) => Math.abs(h.x - x) < 2.4) ||
      level.checkpoints.some((cp) => Math.abs(cp.x - x) < 1.6) ||
      this.gorges.some((z) => x > z.x0 - 2.5 && x < z.x1 + 2.5);
    for (const pl of parts) {
      if (pl.x1 - pl.x0 < 16 || pl.top > 1.4) continue;
      const gx0 = pl.x0 + 3;
      const gx1 = gx0 + 3.2;
      if (busy(gx0) || busy(gx1) || busy((gx0 + gx1) / 2)) continue;
      const row = { x0: gx0, x1: gx1, top: pl.top };
      for (let x = gx0 + 0.25; x < gx1 - 0.1; x += 0.36) this.gallery.push([x, pl.top + 0.3, -1.75]);
      this.taken.push(gx0, gx1);
      this.galleryRows.push(row);
    }
  },

  /** A rock pinnacle out of the clouds, a stone slab on top, and on it a chorten, a cairn or a flagpole. */
  pinnacle(g, pl, ci, rng) {
    const { x0, x1, top } = pl;
    const m = this.m;
    const cx = (x0 + x1) / 2;
    g.add(new THREE.Mesh(rockGeo(x0, x1, DEEP, top - 0.12, -1.6, 1.45, ci), m.rock));
    const slab = new THREE.Mesh(boxWorldUV(x1 - x0 + 0.1, 0.14, 3.1, 2), m.slab);
    slab.position.set(cx, top - 0.07, -0.08);
    slab.receiveShadow = slab.castShadow = true;
    g.add(slab);
    const kind = ci % 3;
    const at = new THREE.Group();
    at.position.set(cx + (rng() - 0.5) * 1.5, top, -1.25);
    g.add(at);
    if (kind === 0) this.shape('chorten', at, rng);
    else if (kind === 1) this.shape('cairn', at, rng);
    else this.flagpole(at, 0, 0, 0, 3.0);
    mergeByMaterial(at);
  },

  /** A tall pole with a long white prayer flag down it. */
  flagpole(g, x, y, z, h) {
    const p = new THREE.Mesh(this.geo.pole, this.m.wood);
    p.scale.set(0.045, h, 0.045);
    p.position.set(x, y + h / 2, z);
    p.castShadow = true;
    g.add(p);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 8), this.m.gold);
    cap.position.set(x, y + h + 0.1, z);
    g.add(cap);
    const flag = new THREE.Mesh(bannerGeo(Math.min(2.6, h * 0.55), 0.26, 0xf2efe6), this.m.tall);
    flag.position.set(x + 0.04, y + h - 0.08, z);
    flag.castShadow = true;
    g.add(flag);
  },

  /** The old rope bridges: posts at the ends, hand ropes and foot ropes between, the planks that are left. */
  buildBridges(world) {
    const { scene, level } = world;
    const g = new THREE.Group();
    const m = this.m;
    for (const br of this.bridges) {
      const prev = [...level.platforms].reverse().find((pl) => pl.x1 <= br.x0 + 0.01 && !pl.brittle);
      const next = level.platforms.find((pl) => pl.x0 >= br.x1 - 0.01 && !pl.brittle);
      const a = prev && br.x0 - prev.x1 < 3 ? prev.x1 - 0.25 : br.x0 + 0.1;
      const b = next && next.x0 - br.x1 < 3 ? next.x0 + 0.25 : br.x1 - 0.1;
      const y = br.top;
      const foot = (x) => level.platforms.find((pl) => !pl.brittle && pl.x0 <= x && pl.x1 >= x)?.top ?? y - 0.4;
      for (const z of [-1.05, 1.05]) {
        for (const x of [a, b]) {
          const y0 = foot(x);
          const post = new THREE.Mesh(this.geo.pole, m.wood);
          post.scale.set(0.05, y + 0.95 - y0, 0.05);
          post.position.set(x, (y + 0.95 + y0) / 2, z);
          post.castShadow = true;
          g.add(post);
        }
        const hand = sag(a, y + 0.88, b, y + 0.88, z, 0.22, 16);
        g.add(new THREE.Mesh(cord(hand, 0.018), m.rope));
        g.add(new THREE.Mesh(cord(sag(a, y - 0.07, b, y - 0.07, z * 0.92, 0.04, 8), 0.022), m.rope));
        for (let i = 1; i < 16; i += 2) {
          const p = hand[i];
          const s = new THREE.Mesh(this.geo.pole, m.rope);
          s.scale.set(0.008, p.y - (y - 0.07), 0.008);
          s.position.set(p.x, (p.y + y - 0.07) / 2, z);
          g.add(s);
        }
      }
      this.taken.push(a, b);
      this.lights.push({ x: (br.x0 + br.x1) / 2, y: y + 1.4, z: 0.4, color: 0xffc070, intensity: 3, distance: 7, flicker: true });
    }
    scene.add(mergeByMaterial(g));
  },

  /**
   * The gorges: a tall flagpole on each rim, a string of flags high across the
   * back, and the wind made visible — paper prayer horses and wisps of cloud
   * blown up out of the depths.
   */
  buildGorges(world, S, n) {
    const { scene, level, rng } = world;
    const g = new THREE.Group();
    const zoneOf = (zone, papers) => {
      const z = zone;
      zone.papers = [];
      zone.wisps = [];
      for (let i = 0; i < papers; i++) {
        zone.papers.push({
          x: z.x0 + 0.3 + rng() * (z.x1 - z.x0 - 0.6),
          y: z.low - 2.5 + rng() * (z.ceil - z.low + 6),
          z: -1.8 + rng() * 3.4,
          vy: 1.4 + rng() * 1.6,
          a: rng() * 6.28,
          spin: (rng() - 0.5) * 6,
          f: 0.8 + rng() * 1.4,
          ph: rng() * 6.28,
          col: FLAGS[i % FLAGS.length],
        });
      }
      for (let i = 0; i < 5; i++) zone.wisps.push({ x: z.x0 + rng() * (z.x1 - z.x0), u: rng(), z: -2.6 + rng() * 2, w: 2.5 + rng() * 2 });
      S.zones.push(zone);
      return zone;
    };
    for (const z of this.gorges) {
      const zone = zoneOf(z, n);
      const prev = [...level.platforms].reverse().find((pl) => pl.x1 <= z.x0 + 0.01);
      const next = level.platforms.find((pl) => pl.x0 >= z.x1 - 0.01);
      const rim = (pl) => (pl && pl.x1 - pl.x0 <= 6.5 ? -1.35 : -1.95);
      const ax = z.x0 - 0.6;
      const bx = z.x1 + 0.6;
      const ah = z.ceil + 3.0 - (prev?.top ?? 0);
      const bh = z.ceil + 3.3 - (next?.top ?? 0);
      this.flagpole(g, ax, prev?.top ?? 0, rim(prev), ah);
      this.flagpole(g, bx, next?.top ?? 0, rim(next), bh);
      const pts = sag(ax, z.ceil + 2.85, bx, z.ceil + 3.15, -1.9, 1.1, 24);
      g.add(new THREE.Mesh(cord(pts, 0.01), this.m.rope));
      const len = bx - ax;
      g.add(new THREE.Mesh(flagGeo(pts, Math.round(len / 0.36), 0.24, 0.34), this.m.flag));
      this.taken.push(ax, bx);
      zone.rim = [ax, bx];
    }
    scene.add(mergeByMaterial(g));
    // the burst of prayer horses thrown up at home
    if (this.home) {
      const { x, top } = this.home;
      S.homeZone = zoneOf({ x0: x - 4, x1: x + 13, low: top + 2.5, ceil: top + 6, boost: 0, home: true }, Math.round(n * 4));
      S.homeZone.on = false;
    }
    const count = S.zones.reduce((a, z) => a + z.papers.length, 0);
    const papers = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.15, 0.19), this.m.paper, count);
    papers.frustumCulled = false;
    let k = 0;
    for (const z of S.zones) {
      z.first = k;
      for (const pp of z.papers) {
        papers.setMatrixAt(k, _m.makeScale(0, 0, 0));
        papers.setColorAt(k++, _c.setHex(pp.col));
      }
    }
    scene.add(papers);
    S.papers = papers;
    const wisps = S.zones.reduce((a, z) => a + z.wisps.length, 0);
    const mist = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: world.tex.mist, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      wisps
    );
    mist.frustumCulled = false;
    k = 0;
    for (const z of S.zones) {
      z.firstWisp = k;
      for (let i = 0; i < z.wisps.length; i++) {
        mist.setMatrixAt(k, _m.makeScale(0, 0, 0));
        mist.setColorAt(k++, _c.setRGB(0, 0, 0));
      }
    }
    scene.add(mist);
    S.mist = mist;
  },

  // --- the clouds, the peaks, the far monasteries ----------------------------------
  /** The top of the sea of clouds: one big sheet that follows the camera, its billows drawn in world space by noise. */
  buildCloudSea(world, S) {
    const c = this.colors;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector2() },
        uMoonX: { value: 0 },
        uFlash: { value: 0 },
        uFlashPos: { value: new THREE.Vector2() },
        uDark: { value: new THREE.Vector3(0.028, 0.036, 0.07) },
        uLit: { value: new THREE.Vector3(0.24, 0.27, 0.36) },
        uHor: { value: new THREE.Vector3(...c.skyHor) },
      },
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec2 uCam; uniform float uMoonX; uniform float uFlash; uniform vec2 uFlashPos;
        uniform vec3 uDark; uniform vec3 uLit; uniform vec3 uHor;
        varying vec3 vW;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
        }
        float fbm(vec2 p) {
          float v = 0.0; float a = 0.5;
          for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
          return v;
        }
        void main() {
          vec2 p = vW.xz * vec2(0.09, 0.16) + vec2(uTime * 0.012, 0.0);
          float n = fbm(p);
          // light from the moon's side: brighter where the billows rise towards it
          float lit = clamp((n - fbm(p + vec2(0.05, 0.03))) * 7.0 + 0.5, 0.0, 1.0);
          float puff = smoothstep(0.4, 0.75, n);
          // dark hollows between the billows, where the clouds fall away deep below
          vec3 col = mix(uDark * 0.25, uDark, smoothstep(0.22, 0.46, n));
          col = mix(col, uLit * 1.15, puff * (0.35 + 0.65 * lit));
          // the moon's path across the clouds
          float far = clamp(-vW.z / 90.0, 0.0, 1.0);
          col += uLit * 0.45 * puff * exp(-pow((vW.x - uMoonX) / (5.0 + 30.0 * far), 2.0)) * smoothstep(0.1, 0.9, far);
          // lightning inside the clouds
          col += vec3(0.55, 0.62, 0.95) * uFlash * exp(-length(vW.xz - uFlashPos) / 16.0) * (0.5 + puff);
          col = mix(col, uHor, smoothstep(35.0, 100.0, length(vW.xz - uCam)));
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(460, 136).rotateX(-Math.PI / 2), mat);
    sea.position.set(0, CLOUD_Y - 0.1, -52);
    world.scene.add(sea);
    S.sea = sea;
    // a glow for the lightning, seen through the cloud tops
    S.boltGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: world.tex.glow, color: 0xaab8ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    S.boltGlow.scale.set(44, 14, 1);
    world.scene.add(S.boltGlow);
  },

  /** Billows on the sea of clouds, in strips that repeat round the camera and drift slowly with the wind. */
  buildClouds(world, S) {
    const { scene, rng } = world;
    const strip = (P, n, z0, z1, y0, y1, w0, w1, drift, bright) => {
      const g = new THREE.Group();
      scene.add(g);
      const mesh = new THREE.InstancedMesh(
        this.geo.plane,
        new THREE.MeshBasicMaterial({ map: world.tex.mist, transparent: true, opacity: 0.7, depthWrite: false }),
        n * 3
      );
      for (let i = 0; i < n; i++) {
        const x = rng() * P;
        const z = z0 + rng() * (z1 - z0);
        const y = y0 + rng() * (y1 - y0);
        const w = w0 + rng() * (w1 - w0);
        const b = bright * (0.75 + rng() * 0.35);
        for (let k = 0; k < 3; k++) {
          mesh.setMatrixAt(i * 3 + k, _m.compose(_p.set(x + k * P, y, z), _q.identity(), _s.set(w, w * (0.3 + rng() * 0.15), 1)).clone());
          mesh.setColorAt(i * 3 + k, _c.setRGB(b * 0.85, b * 0.9, b));
        }
      }
      g.add(mesh);
      S.strips.push({ g, P, drift });
    };
    const k = world.quality.particles;
    strip(48, Math.round(16 * k), 3, 8, CLOUD_Y - 0.5, CLOUD_Y + 0.15, 4, 9, 0.6, 0.55);
    strip(70, Math.round(24 * k), -18, -5, CLOUD_Y - 0.4, CLOUD_Y + 0.5, 5, 11, 0.4, 0.6);
    strip(110, Math.round(26 * k), -60, -22, CLOUD_Y - 0.2, CLOUD_Y + 1.2, 9, 20, 0.25, 0.5);
  },

  /** The high peaks under snow, two ranges far off; each slides past slower than the world, as if much further away. */
  buildPeaks(world, S) {
    const { scene, rng } = world;
    const L = world.level.endX;
    const range = (z, f, base, amps, snowline, litSnow, shadeSnow, rock) => {
      const g = new THREE.Group();
      scene.add(g);
      S.far.push({ g, f });
      const x0 = -110;
      const x1 = L * (1 - f) + 110;
      const waves = amps.map(([amp, lam]) => [amp, lam, rng()]);
      const height = (x) => base + waves.reduce((h, [amp, lam, ph]) => h + amp * Math.pow(1 - Math.abs(2 * mod(x / lam + ph, 1) - 1), 1.6), 0);
      const pos = [];
      const col = [];
      const idx = [];
      const step = 1.5;
      const lit = new THREE.Color();
      const dark = new THREE.Color(rock);
      let i = 0;
      for (let x = x0; x <= x1; x += step, i++) {
        const h = height(x);
        const slope = (height(x + step) - height(x - step)) / (2 * step);
        const k = smoothstep(-0.25, 0.5, slope); // facing the moon (to the left) or away
        const snow = new THREE.Color(shadeSnow).lerp(new THREE.Color(litSnow), k);
        const sy = Math.min(h - 0.4, Math.max(snowline + (hash(x, 1, z) - 0.5) * 3, h - 2.5 - hash(x, 2, z) * 5));
        lit.copy(dark).lerp(snow, 0.25 * k);
        pos.push(x, h, z, x, sy, z, x, sy, z, x, -12, z);
        for (const cc of [snow, snow.clone().multiplyScalar(0.8), lit, dark.clone().multiplyScalar(0.5)]) col.push(cc.r, cc.g, cc.b);
        if (i > 0) {
          const a = (i - 1) * 4;
          const b = i * 4;
          idx.push(a, a + 1, b, b, a + 1, b + 1); // snow
          idx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3); // rock
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
    };
    range(-89, 0.92, -2, [[9, 70], [4, 23], [1.6, 8], [0.5, 2.7]], 5, 0x8a96b4, 0x2a3450, 0x0a0e1a);
    range(-72, 0.8, -5, [[6, 44], [3, 15], [1, 5], [0.4, 1.9]], 4.5, 0x5a6684, 0x1e2640, 0x070a12);
  },

  /** Out over the clouds: rock pinnacles, some with a monastery on them, its windows lit, flags strung between them. */
  buildDistance(world) {
    const { scene, rng } = world;
    const L = world.level.endX;
    const rocks = [];
    const walls = new THREE.Group();
    const lights = [];
    const flags = [];
    const tops = [];
    let ci = 100;
    for (let x = -50; x < L + 120; x += 10 + rng() * 16) {
      const z = -22 - rng() * 26;
      const top = -1 + rng() * 11 * (0.4 + 0.6 * rng());
      const w = 2.5 + rng() * 5;
      const house = rng() < 0.45;
      rocks.push(rockGeo(x - w / 2, x + w / 2, DEEP, top, z - w * 0.4, z + w * 0.4, ci++, { flatTop: house, spire: house ? 0.2 : 0.8, coarse: 1.6 }));
      tops.push([x, top, z, w]);
      if (house) {
        // a little monastery on top
        const bw = Math.min(w * 0.8, 2 + rng() * 3);
        const bh = 1.2 + rng() * 2.2;
        const body = new THREE.Mesh(boxWorldUV(bw, bh, w * 0.6, 2), this.m.washBack);
        body.position.set(x, top + bh / 2, z);
        walls.add(body);
        const band = new THREE.Mesh(bandBox(bw + 0.05, 0.3, w * 0.6 + 0.05), this.m.kemar);
        band.position.set(x, top + bh - 0.2, z);
        walls.add(band);
        for (let k = 0; k < 2 + rng() * 4; k++) lights.push(x - bw / 2 + 0.3 + rng() * (bw - 0.6), top + 0.4 + rng() * (bh - 0.9), z + w * 0.3 + 0.05);
        if (rng() < 0.4) this.pavilion(walls, x, top + bh, z);
      }
    }
    // flags strung from one pinnacle's top to the next
    for (let i = 0; i < tops.length - 1; i++) {
      const [ax, at, az] = tops[i];
      const [bx, bt, bz] = tops[i + 1];
      if (rng() < 0.4 || Math.abs(az - bz) > 12) continue;
      const pts = [];
      for (let k = 0; k <= 16; k++) {
        const u = k / 16;
        pts.push(new THREE.Vector3(ax + (bx - ax) * u, at + 0.3 + (bt - at) * u - 1.4 * Math.sin(u * Math.PI), az + (bz - az) * u));
      }
      flags.push(flagGeo(pts, Math.round(pts[0].distanceTo(pts[16]) / 0.6), 0.4, 0.5, i));
    }
    const merged = new THREE.Mesh(mergeGeometriesSafe(rocks), this.m.rockFar);
    merged.receiveShadow = true;
    scene.add(merged);
    scene.add(mergeByMaterial(walls));
    if (flags.length) scene.add(new THREE.Mesh(mergeGeometriesSafe(flags), this.m.flag));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
    scene.add(new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.7, map: world.tex.glow, color: 0xffb860, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  },

  // --- the monastery's cats ----------------------------------------------------------
  /** Cats on the roofs: by a prayer wheel, asleep on a cushion, in a copper pot, a kitten and the flags; a snow leopard on a ledge; a family at home. */
  buildCats(world, S) {
    const { scene, level, rng } = world;
    const m = this.m;
    const cats = (S.cats = new SceneryCats(scene, rng, { watch: Math.PI / 2 }));
    const add = (coat, pose, x, y, z, yaw, opts) => {
      this.taken.push(x);
      return cats.add(coat, pose, x, y, z, yaw, opts);
    };
    const free = (x) =>
      !level.hangers.some((h) => Math.abs(h.x - x) < 1.6) &&
      !level.checkpoints.some((cp) => Math.abs(cp.x - x) < 1.3) &&
      !this.taken.some((t) => Math.abs(t - x) < 1.2);
    const roofs = level.platforms.filter((pl) => !pl.brittle && pl.x1 - pl.x0 > 12);
    const cushion = (x, y, z, mat = m.cushion) => {
      const c = new THREE.Mesh(boxWorldUV(0.6, 0.1, 0.5, 1), mat);
      c.position.set(x, y + 0.05, z);
      c.castShadow = c.receiveShadow = true;
      scene.add(c);
      return y + 0.1;
    };
    // a grey cat on a cushion beside a prayer wheel, on the first roof
    const w = new THREE.Group();
    w.position.set(8.4, 0, -1.2);
    this.shape('wheel', w, rng);
    scene.add(mergeByMaterial(w));
    const d0 = this.drum(8.4, 0, -1.2);
    scene.add(d0);
    this.drums.push({ g: d0, x: 8.4, spin: 0.6 });
    add('grey', 'sit', 7.4, cushion(7.4, 0, -1.0), -1.0, Math.PI / 2 - 0.5);
    // a white cat asleep on a saffron cushion
    const nap = roofs.find((pl) => pl.x0 > level.goalX * 0.1 && free(pl.x0 + 3));
    if (nap) add('white', 'loaf', nap.x0 + 3, cushion(nap.x0 + 3, nap.top, -1.0, m.saffron), -1.0, 0.3);
    // a tabby peeking out of a big copper pot
    const pot = roofs.find((pl) => pl.x0 > level.goalX * 0.27 && free(pl.x0 + 2.6));
    if (pot) {
      const g = new THREE.Group();
      g.position.set(pot.x0 + 2.6, pot.top, -1.15);
      g.scale.setScalar(1.25);
      this.shape('pots', g, rng);
      scene.add(mergeByMaterial(g));
      add('tabby', 'peek', pot.x0 + 2.6 - 0.17, pot.top + 0.72, -1.15, Math.PI / 2 - 0.3);
    }
    // a tuxedo kitten batting at the flags on a low line behind it
    const kit = roofs.find((pl) => pl.x0 > level.goalX * 0.42 && pl.top < 1.6 && free(pl.x0 + 3.4));
    if (kit) {
      const kx = kit.x0 + 3.4;
      add('tuxedo', 'sit', kx, kit.top, -1.25, -0.8, { scale: 0.55, paw: true });
      const g = new THREE.Group();
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(this.geo.pole, m.wood);
        p.scale.set(0.03, 0.75, 0.03);
        p.position.set(kx + s * 0.9, kit.top + 0.375, -1.7);
        g.add(p);
      }
      const pts = sag(kx - 0.9, kit.top + 0.72, kx + 0.9, kit.top + 0.72, -1.7, 0.08, 10);
      g.add(new THREE.Mesh(cord(pts, 0.006), m.rope));
      g.add(new THREE.Mesh(flagGeo(pts, 7, 0.18, 0.24), m.flag));
      scene.add(mergeByMaterial(g));
    }
    // a snow leopard on a ledge across a gorge, watching
    const gorge = this.gorges.find((z) => z.x0 > level.goalX * 0.3);
    if (gorge) {
      const lx = gorge.x0 + (gorge.x1 - gorge.x0) * 0.6;
      const ly = gorge.ceil + 2.6;
      scene.add(new THREE.Mesh(rockGeo(lx - 2.6, lx + 2.2, DEEP, ly, -18, -14, 41, { spire: 0.3 }), m.rock));
      const spots = [];
      const blot = (on, c, r, n) => {
        for (let i = 0; i < n; i++) {
          const a = rng() * Math.PI * 2;
          const b = (rng() - 0.3) * 1.4;
          const sz = 0.022 + rng() * 0.02;
          spots.push([on, 0x45423e, sz, sz * 0.8, sz, c[0] + Math.cos(a) * Math.cos(b) * r[0], c[1] + Math.sin(b) * r[1], c[2] + Math.sin(a) * Math.cos(b) * r[2]]);
        }
      };
      blot('body', [-0.06, 0.14, 0], [0.19, 0.15, 0.18], 14);
      blot('body', [0.03, 0.3, 0], [0.12, 0.19, 0.14], 8);
      blot('head', [0, 0.02, 0], [0.105, 0.09, 0.115], 6);
      add('snow', 'sit', lx, ly, -16, -Math.PI / 2 + 0.7, { scale: 3.2, patches: spots });
    }
    // a cream cat on a tower roof late on, watching the peaks
    const tall = level.platforms.find((pl) => pl.top >= 1.8 && pl.x0 > level.goalX * 0.62 && !pl.brittle && free(pl.x0 + 2.4));
    if (tall) add('cream', 'sit', tall.x0 + 2.4, cushion(tall.x0 + 2.4, tall.top, -1.0), -1.0, Math.PI / 2 + 0.3);
    // home: a friend and two kittens on a rug among the butter lamps, a bowl of milk
    if (this.home) {
      const { x, top } = this.home;
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3).rotateX(-Math.PI / 2), m.cushion);
      rug.position.set(x + 10.6, top + 0.012, -0.8);
      rug.receiveShadow = true;
      scene.add(rug);
      const border = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.5).rotateX(-Math.PI / 2), m.saffron);
      border.position.set(x + 10.6, top + 0.008, -0.8);
      scene.add(border);
      add('ginger', 'sit', x + 10.1, top, -0.6, Math.PI, { patches: [['head', 0xf0e6d8, 0.06, 0.05, 0.08, 0.04, -0.02, 0]] });
      add('grey', 'sit', x + 10.9, top, -0.95, Math.PI - 0.3, { scale: 0.48 });
      add('white', 'sit', x + 11.25, top, -1.1, Math.PI + 0.4, { scale: 0.45, paw: true });
      const bowl = new THREE.Mesh(
        new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.12, 0.01), new THREE.Vector2(0.17, 0.07), new THREE.Vector2(0.18, 0.08)], 16),
        m.bowl
      );
      bowl.position.set(x + 9.4, top, -0.85);
      scene.add(bowl);
      const milk = new THREE.Mesh(new THREE.CircleGeometry(0.155, 16).rotateX(-Math.PI / 2), m.milk);
      milk.position.set(x + 9.4, top + 0.06, -0.85);
      scene.add(milk);
      // butter lamps on a low table behind them, and a few on the walk round the rug
      const table = new THREE.Mesh(boxWorldUV(3.2, 0.3, 0.4, 1), m.red);
      table.position.set(x + 10.6, top + 0.15, -1.75);
      table.castShadow = table.receiveShadow = true;
      scene.add(table);
      for (let i = 0; i < 9; i++) this.lamps.push([x + 9.2 + i * 0.35, top + 0.3, -1.75]);
      for (const [lx, lz] of [[9.0, -0.2], [12.1, -0.3], [12.2, -1.3], [8.9, -1.35]]) this.lamps.push([x + lx, top, lz]);
      this.lights.push({ x: x + 10.6, y: top + 0.8, z: -0.6, color: 0xffb048, intensity: 5, distance: 6, flicker: true });
    }
  },

  /** Juniper smoke from the incense burners. */
  buildSmoke(world, S, n) {
    const mesh = new THREE.InstancedMesh(
      this.geo.plane,
      new THREE.MeshBasicMaterial({ map: world.tex.mist, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
      n
    );
    mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
      mesh.setColorAt(i, _c.setRGB(0, 0, 0));
    }
    world.scene.add(mesh);
    S.smoke = { mesh, items: Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0, life: 0, max: 1 })), clock: 0 };
  },

  /** Everything gathered while the monastery was built: windows, rafter ends, butter lamps, the little prayer wheels. */
  buildInstanced(world, S) {
    const { scene } = world;
    const batch = (geo, mat, list) => {
      const runs = new Map();
      for (const item of list) {
        const k = Math.floor(item.elements[12] / 40);
        if (!runs.has(k)) runs.set(k, []);
        runs.get(k).push(item);
      }
      for (const run of runs.values()) {
        const mesh = new THREE.InstancedMesh(geo, mat, run.length);
        run.forEach((mx, i) => mesh.setMatrixAt(i, mx));
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        scene.add(mesh);
      }
    };
    batch(this.geo.plane, this.m.winLit, this.windows.lit);
    batch(this.geo.plane, this.m.winDark, this.windows.dark);
    batch(this.geo.unitBox, this.m.timber, this.joists);
    // butter lamps: a gilt cup and a flame each, a glow over each little row
    const cups = this.lamps.map(([x, y, z]) => _m.compose(_p.set(x, y + 0.025, z), _q.identity(), _s.setScalar(1)).clone());
    const flames = this.lamps.map(([x, y, z]) => _m.compose(_p.set(x, y + 0.08, z), _q.identity(), _s.setScalar(1)).clone());
    if (cups.length) {
      batch(new THREE.CylinderGeometry(0.05, 0.035, 0.05, 8), this.m.gold, cups);
      batch(new THREE.ConeGeometry(0.018, 0.07, 6), this.m.flame, flames);
      for (const [x, y, z] of this.lamps.filter((_, i) => i % 3 === 0)) {
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.tex.glow, color: 0xffb048, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.position.set(x + 0.35, y + 0.1, z + 0.1);
        glow.scale.set(1.3, 0.9, 1);
        scene.add(glow);
      }
    }
    // the galleries of little prayer wheels: a red wall under them, a roof over them, the wheels turning
    const g = new THREE.Group();
    for (const row of this.galleryRows) {
      const len = row.x1 - row.x0;
      const cx = (row.x0 + row.x1) / 2;
      const wall = new THREE.Mesh(boxWorldUV(len, 0.3, 0.3, 1), this.m.red);
      wall.position.set(cx, row.top + 0.15, -1.75);
      g.add(wall);
      const roof = new THREE.Mesh(boxWorldUV(len + 0.3, 0.08, 0.6, 1), this.m.roof);
      roof.position.set(cx, row.top + 0.95, -1.75);
      g.add(roof);
      const trim = new THREE.Mesh(this.geo.unitBox, this.m.gold);
      trim.scale.set(len + 0.3, 0.05, 0.05);
      trim.position.set(cx, row.top + 0.9, -1.45);
      g.add(trim);
      for (const x of [row.x0, row.x1]) {
        const post = new THREE.Mesh(this.geo.pole, this.m.red);
        post.scale.set(0.04, 0.65, 0.04);
        post.position.set(x, row.top + 0.62, -1.55);
        g.add(post);
      }
    }
    scene.add(mergeByMaterial(g));
    if (this.gallery.length) {
      const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 12), this.m.gold, this.gallery.length);
      const band = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.104, 0.104, 0.08, 12), this.m.red, this.gallery.length);
      const knob = new THREE.InstancedMesh(new THREE.SphereGeometry(0.02, 6, 4), this.m.red, this.gallery.length);
      for (const mesh of [body, band, knob]) {
        mesh.frustumCulled = false;
        scene.add(mesh);
      }
      S.gallery = { body, band, knob, items: this.gallery.map(([x, y, z]) => ({ x, y, z, a: 0, v: 0.3 })) };
      this.updateGallery(S, 0, -99, 0, Infinity);
    }
  },

  /** Turn the little prayer wheels: the cat sets each spinning as it runs by. */
  updateGallery(S, dt, catX, camX, near = 30) {
    const G = S.gallery;
    if (!G) return;
    let moved = false;
    for (let i = 0; i < G.items.length; i++) {
      const w = G.items[i];
      if (Math.abs(w.x - camX) > near) continue;
      if (Math.abs(w.x - catX) < 0.3 && w.v < 4) w.v = 9;
      w.v = Math.max(0.3, w.v * Math.exp(-dt * 0.5));
      w.a += w.v * dt;
      _q.setFromEuler(_e.set(0, w.a, 0));
      G.body.setMatrixAt(i, _m.compose(_p.set(w.x, w.y, w.z), _q, _s.setScalar(1)));
      G.band.setMatrixAt(i, _m);
      G.knob.setMatrixAt(i, _m.compose(_p.set(w.x + Math.cos(w.a) * 0.1, w.y + 0.06, w.z - Math.sin(w.a) * 0.1), _q, _s.setScalar(1)));
      moved = true;
    }
    if (moved) for (const mesh of [G.body, G.band, G.knob]) mesh.instanceMatrix.needsUpdate = true;
  },

  /** Hanging things swing when the cat goes by; the gong rings. */
  onPass(o, sfx) {
    const s = this.swings.find((sw) => Math.abs(sw.x - o.x) < 0.01);
    if (!s) return;
    s.kick = 1;
    s.age = 0;
    if (o.kind === 'gong') sfx?.gong(0.8);
  },

  /** The cat rides the wind: the prayer horses whirl up faster for a moment. */
  onLift(lift) {
    if (lift.part) lift.part.boost = 1.2;
  },

  update(world, dt, t, catX, camX) {
    const S = world.themeState;
    const rng = world.rng;
    this.time.value = t;

    // the clouds and the far peaks
    const U = S.sea.material.uniforms;
    S.sea.position.x = camX;
    U.uTime.value = t;
    U.uCam.value.set(camX, 0);
    U.uMoonX.value = camX + this.colors.moonPos[0];
    for (const st of S.strips) st.g.position.x = camX - st.P - mod(camX - t * st.drift, st.P);
    for (const r of S.far) r.g.position.x = camX * r.f;

    // lightning, now and then, somewhere down in the clouds; the thunder comes after
    S.flashT -= dt;
    if (S.flashT <= 0) {
      S.flashT = 7 + rng() * 12;
      const x = camX + (rng() - 0.35) * 110;
      const z = -35 - rng() * 55;
      S.bolt = { t: 0, x, z };
      world.sfx?.thunder(0.5 + rng() * 0.4, Math.hypot(x - camX, z - 11) / 60);
    }
    let flash = 0;
    if (S.bolt) {
      const b = S.bolt;
      b.t += dt;
      flash = b.t < 0.07 ? 1 : b.t < 0.15 ? 0.15 : b.t < 0.27 ? 0.85 : Math.max(0, 0.85 - (b.t - 0.27) * 2.4);
      U.uFlashPos.value.set(b.x, b.z);
      S.boltGlow.position.set(b.x, CLOUD_Y + 0.4, b.z);
      if (b.t > 0.7) S.bolt = null;
    }
    U.uFlash.value = flash;
    S.boltGlow.material.opacity = 0.7 * flash;

    // hanging things swing; prayer wheels turn (faster once the cat has jumped them)
    for (const s of this.swings) {
      s.age += dt;
      s.kick *= Math.exp(-dt * (s.kind === 'gong' ? 0.9 : 1.4));
      const amp = s.kind === 'gong' ? 0.4 : s.kind === 'banner' ? 0.35 : 0.3;
      s.g.rotation.x = 0.06 * Math.sin(t * 1.4 + s.ph) + s.kick * amp * Math.sin(s.age * (s.kind === 'gong' ? 4.4 : 6.0));
      s.g.rotation.z = 0.03 * Math.sin(t * 0.9 + s.ph) + s.kick * 0.12 * Math.sin(s.age * 5.1);
    }
    for (const d of this.drums) {
      if (Math.abs(d.x - camX) > 40) continue;
      if (S.lastCatX < d.x && catX >= d.x) {
        d.spin = 9;
        world.sfx?.wheel();
      }
      d.spin = Math.max(0.6, d.spin * Math.exp(-dt * 0.6));
      d.g.rotation.y += d.spin * dt;
    }
    this.updateGallery(S, dt, catX, camX);
    S.lastCatX = catX;
    this.m.flame.emissiveIntensity = 2.6 + 0.6 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);

    this.updateWind(S, dt, t, rng, camX);
    this.updateSmoke(S, dt, rng, camX);
    S.cats.update(dt, t, catX, camX);

    // home: the gong and the long horns, and the wind throws up a shower of prayer horses
    const goal = world.level.goalX;
    if (!S.finale && catX >= goal) {
      S.finale = true;
      world.sfx?.gong(1.2);
      world.sfx?.horn(0.9);
      if (S.homeZone) {
        S.homeZone.on = true;
        S.homeZone.boost = 3;
        for (const pp of S.homeZone.papers) {
          pp.done = false;
          pp.y = this.home.top + rng() * 2.5;
        }
      }
    } else if (S.finale && catX < goal - 2) {
      S.finale = false;
      if (S.homeZone) S.homeZone.on = false;
    }
  },

  /** Prayer horses and wisps of cloud blown up the gorges (and at home, once it is reached). */
  updateWind(S, dt, t, rng, camX) {
    const P = S.papers;
    const M = S.mist;
    let moved = false;
    for (const z of S.zones) {
      const near = Math.abs((z.x0 + z.x1) / 2 - camX) < 48 && (!z.home || z.on);
      if (!near) {
        if (z.shown) {
          z.shown = false;
          z.papers.forEach((_, i) => P.setMatrixAt(z.first + i, _m.makeScale(0, 0, 0)));
          z.wisps.forEach((_, i) => M.setMatrixAt(z.firstWisp + i, _m.makeScale(0, 0, 0)));
          moved = true;
        }
        continue;
      }
      z.shown = true;
      moved = true;
      if (z.boost > 0) z.boost = Math.max(0, z.boost - dt);
      const sp = 1 + 1.6 * z.boost;
      z.papers.forEach((pp, i) => {
        if (pp.done) return;
        pp.y += pp.vy * sp * dt;
        pp.a += pp.spin * dt;
        if (pp.y > z.ceil + 3.5) {
          if (z.home && z.boost <= 0) {
            // at home the shower thins out once the gust has passed
            pp.done = true;
            P.setMatrixAt(z.first + i, _m.makeScale(0, 0, 0));
            return;
          }
          pp.y = z.low - 2.5 - rng() * 0.5;
          pp.x = z.x0 + 0.3 + rng() * (z.x1 - z.x0 - 0.6);
        }
        const sway = Math.sin(t * pp.f + pp.ph);
        _q.setFromEuler(_e.set(pp.a, pp.a * 0.7, sway * 0.6));
        P.setMatrixAt(z.first + i, _m.compose(_p.set(pp.x + 0.5 * sway, pp.y, pp.z + 0.3 * Math.cos(t * pp.f * 0.7 + pp.ph)), _q, _s.setScalar(1)));
      });
      z.wisps.forEach((w, i) => {
        w.u += dt * 0.12 * sp;
        if (w.u > 1) {
          w.u -= 1;
          w.x = z.x0 + rng() * (z.x1 - z.x0);
        }
        const y = CLOUD_Y - 0.5 + w.u * (z.ceil - CLOUD_Y + 2);
        const a = 0.12 * Math.sin(Math.PI * w.u) * (z.home ? 0 : 1);
        M.setMatrixAt(z.firstWisp + i, _m.compose(_p.set(w.x, y, w.z), _q.identity(), _s.set(w.w, w.w * 1.5, 1)));
        M.setColorAt(z.firstWisp + i, _c.setRGB(a * 0.85, a * 0.9, a));
      });
    }
    if (moved) {
      P.instanceMatrix.needsUpdate = true;
      M.instanceMatrix.needsUpdate = true;
      M.instanceColor.needsUpdate = true;
    }
  },

  /** Wisps of juniper smoke from the incense burners near the camera. */
  updateSmoke(S, dt, rng, camX) {
    const Sm = S.smoke;
    Sm.clock -= dt;
    if (Sm.clock <= 0) {
      Sm.clock = 0.22;
      for (const b of this.burners) {
        if (Math.abs(b.x - camX) > 26) continue;
        const d = Sm.items.find((it) => it.life <= 0);
        if (!d) break;
        d.life = d.max = 2.2 + rng();
        [d.x, d.y, d.z] = [b.x, b.y, b.z];
      }
    }
    Sm.items.forEach((d, i) => {
      if (d.life <= 0) return;
      d.life -= dt;
      const u = 1 - Math.max(0, d.life) / d.max;
      d.x += 0.25 * dt;
      d.y += 0.55 * dt;
      const sc = 0.25 + u * 0.9;
      Sm.mesh.setMatrixAt(i, d.life > 0 ? _m.compose(_p.set(d.x, d.y, d.z), _q.identity(), _s.set(sc, sc * 1.3, 1)) : _m.makeScale(0, 0, 0));
      const a = 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.2));
      Sm.mesh.setColorAt(i, _c.setRGB(a, a * 0.97, a * 0.94));
    });
    Sm.mesh.instanceMatrix.needsUpdate = true;
    Sm.mesh.instanceColor.needsUpdate = true;
  },

  dispose() {},
};

/** mergeGeometries, after making every geometry non-indexed with the same attributes as the first. */
function mergeGeometriesSafe(list) {
  const names = Object.keys(list[0].attributes);
  const geos = list.map((geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!names.includes(k)) g.deleteAttribute(k);
    return g;
  });
  return mergeGeometries(geos);
}
