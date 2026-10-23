// Stage IV dressing: a fishing harbour on a summer festival night. The walk runs
// along stone quays, over the decks of moored fishing boats and across the tarred
// roofs of the fish sheds — fish boxes, herring barrels, lobster pots, bollards
// and heaps of net to jump, fish hung out to dry and paper lanterns to slide
// under, old jetty planks that give way. Harbour cats watch from the quays and
// the boats, fireworks burst over the bay, a lighthouse sweeps the water, and a
// friend waits at home with a bowl of fish.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Mesher } from './snow.js';
import { SceneryCats } from './cats.js';
import {
  quayStoneTexture,
  boardTexture,
  woodTexture,
  plasterTexture,
  windowPaneTexture,
  townWindowsTexture,
  waterNormalsTexture,
  beamTexture,
  boxWorldUV,
} from '../textures.js';

const WATER_Y = -1.5;
const MOLE = 2.6; // depth of a quay, with water on both sides
const SHED_D = 3.0; // depth of a fish shed
const RAIL = 0.14; // a boat's rail above its deck
const ATLAS = { cols: 48, rows: 24 };
const WALLS = [0xd8c8a8, 0xc9a77c, 0x9fb0c4, 0xc49a8a, 0xa8b49a, 0xe2dccc];
const SHEDS = [0x9a4632, 0xb8924e, 0x5a6e80, 0x4e6a52, 0xcfc6b4];
const HULLS = [
  { hull: 0x274866, rail: 0xd9cfb6, boot: 0x5a1e18 },
  { hull: 0x8c2c22, rail: 0x1f2a38, boot: 0x2a1a14 },
  { hull: 0x2e5a46, rail: 0xc9a24a, boot: 0x4a1c16 },
  { hull: 0xd6cfbf, rail: 0x2a5a8a, boot: 0x6a2418 },
  { hull: 0x2b2f3a, rail: 0xb3402e, boot: 0x3a1a14 },
];
const PAPER = [0xff5a3a, 0xff8a3a, 0xffc070, 0xff6a8a, 0xffe2a8];
// firework stars (linear colour; the first moments burn brighter than white)
const SHELLS = [
  [[1.0, 0.72, 0.32]],
  [[1.0, 0.28, 0.22], [1.0, 0.8, 0.4]],
  [[0.4, 1.0, 0.45]],
  [[0.45, 0.55, 1.0], [0.85, 0.5, 1.0]],
  [[1.0, 0.45, 0.75]],
  [[0.9, 0.95, 1.0]],
  [[1.0, 0.55, 0.2], [0.4, 1.0, 0.9]],
];
const EMBER = [1.0, 0.62, 0.28];
const GOLD = [1.0, 0.68, 0.28];
const SILVER = [0.92, 0.95, 1.0];
const CLIMB = 6; // how quickly a shell slows as it climbs
const _mat = new THREE.Matrix4();

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Half a hull's beam at u (0 at the transom, 1 at the stem). */
const hullHalf = (u, beam) =>
  (beam / 2) * (u > 0.55 ? Math.sqrt(Math.max(0, 1 - ((u - 0.55) / 0.45) ** 2)) : 1) * (0.86 + 0.14 * Math.min(1, u / 0.18));
/** The keel: flat, then sweeping up into the stem. */
const hullKeel = (u, deckY, keelY) => (u > 0.72 ? keelY + (deckY - 0.3 - keelY) * ((u - 0.72) / 0.28) ** 1.5 : keelY);

/**
 * A boat hull along +x from its transom (x = 0) to its stem (x = L): rounded
 * sections narrowing to the keel, the bow drawn in to a point, the rail RAIL
 * above deckY with a little sheer. Vertex colours paint the topsides, the rail
 * and a dark band at the waterline (waterY).
 */
function hullGeometry(L, beam, deckY, keelY, paint, waterY = WATER_Y) {
  const NS = 20;
  // rows down the side, in units below the rail: pairs at the edges of the
  // painted rail and the rubbing strake keep those bands crisp
  const BANDS = [0, 0.15, 0.17, 0.32, 0.34, 0.44, 0.46];
  const NK = BANDS.length + 3;
  const pos = [];
  const col = [];
  const idx = [];
  const c = new THREE.Color();
  for (const side of [1, -1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= NS; i++) {
      const u = i / NS;
      const w = hullHalf(u, beam);
      const keel = hullKeel(u, deckY, keelY);
      const railY = deckY + RAIL + 0.12 * u * u;
      const depth = railY - keel;
      for (let k = 0; k <= NK; k++) {
        const below = k < BANDS.length ? BANDS[k] : 0.46 + ((depth - 0.46) * (k - BANDS.length + 1)) / 4;
        const v = below / depth;
        const y = railY - below;
        pos.push(u * L, y, side * w * (1 - 0.6 * v ** 1.6));
        if (below < 0.16) c.setHex(paint.rail);
        else if (y < waterY + 0.18) c.setHex(paint.boot);
        else c.setHex(paint.hull).multiplyScalar(below > 0.33 && below < 0.45 ? 0.5 : 1);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < NS; i++) {
      for (let k = 0; k < NK; k++) {
        const a = base + i * (NK + 1) + k;
        const b = a + NK + 1;
        if (side > 0) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  // the transom: a fan across the stern section
  const centre = pos.length / 3;
  pos.push(0, (deckY + keelY) / 2, 0);
  c.setHex(paint.hull);
  col.push(c.r, c.g, c.b);
  const left = (NS + 1) * (NK + 1);
  const ring = [];
  for (let k = 0; k <= NK; k++) ring.push(k);
  for (let k = NK; k >= 0; k--) ring.push(left + k);
  for (let j = 0; j < ring.length - 1; j++) idx.push(centre, ring[j], ring[j + 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** The deck inside a hull at deck level, planks running fore and aft. */
function deckGeometry(L, beam) {
  const s = new THREE.Shape();
  const N = 20;
  s.moveTo(0, -hullHalf(0, beam) * 0.95);
  for (let i = 1; i <= N; i++) s.lineTo((i / N) * L, -hullHalf(i / N, beam) * 0.95);
  for (let i = N - 1; i >= 0; i--) s.lineTo((i / N) * L, hullHalf(i / N, beam) * 0.95);
  const geo = new THREE.ShapeGeometry(s);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

/** One fish, nose along +x: body, forked tail and a dorsal fin in one geometry. */
function fishGeometry() {
  const body = new THREE.SphereGeometry(0.05, 10, 8);
  body.scale(2.6, 0.75, 0.6);
  const tail = new THREE.ConeGeometry(0.05, 0.08, 4);
  tail.rotateZ(-Math.PI / 2);
  tail.scale(1, 1, 0.3);
  tail.translate(-0.15, 0, 0);
  const fin = new THREE.ConeGeometry(0.025, 0.06, 3);
  fin.scale(1.6, 1, 0.3);
  fin.translate(-0.01, 0.045, 0);
  return mergeGeometries([body, tail, fin].map((g) => g.toNonIndexed()));
}

/** A line of points sagging between two ends (for ropes and strings of lanterns). */
function sag(x0, y0, x1, y1, z, drop, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - drop * Math.sin(u * Math.PI), z));
  }
  return pts;
}

/**
 * Fireworks over the bay. Shells climb from the water on a trail of embers and
 * burst into stars that drag, fall and fade (a willow's stars trail gold, a
 * crackle's sparkle as they go out). Each burst flashes, lights the harbour for
 * a moment and booms a little later. Shells are aimed into the camera's view.
 */
class Fireworks {
  constructor(world, n) {
    this.world = world;
    this.n = n;
    this.density = Math.min(1, n / 1500);
    this.parts = [];
    this.spare = [];
    this.rockets = [];
    this.flashes = [];
    this.timer = 0.6;
    this.lightI = 0;
    this.v = new THREE.Vector3();
    const points = (count, size) => {
      const geo = new THREE.BufferGeometry();
      for (const name of ['position', 'color']) {
        geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
      }
      geo.setDrawRange(0, 0);
      const p = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size,
          map: world.tex.glow,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          fog: false,
        })
      );
      p.frustumCulled = false;
      world.scene.add(p);
      return p;
    };
    this.stars = points(n, 0.55);
    this.glows = points(8, 9);
    // each burst lights the harbour for a moment
    this.light = new THREE.HemisphereLight(0xffffff, 0x000000, 0);
    world.scene.add(this.light);
  }

  spawn(x, y, z, vx, vy, vz, life, c, kind, drag, grav) {
    if (this.parts.length >= this.n) return;
    const q = this.spare.pop() || {};
    q.x = x;
    q.y = y;
    q.z = z;
    q.vx = vx;
    q.vy = vy;
    q.vz = vz;
    q.age = 0;
    q.life = life;
    q.r = c[0];
    q.g = c[1];
    q.b = c[2];
    q.kind = kind; // 0 star, 1 ember, 2 crackling star, 3 willow star
    q.drag = drag;
    q.grav = grav;
    q.next = 0;
    this.parts.push(q);
  }

  /** The height at depth z of the point straight ahead at screen height ny (−1 bottom … 1 top). */
  screenY(ny, z) {
    const cam = this.world.camera;
    cam.updateMatrixWorld();
    const v = this.v.set(0, ny, 0.5).unproject(cam).sub(cam.position);
    return cam.position.y + v.y * ((z - cam.position.z) / v.z);
  }

  /** Queue a shell: it leaves the water after `wait` seconds and bursts at screen height ny. */
  launch(x, z, ny, wait = 0, big = false) {
    const r = Math.random();
    const type = r < 0.38 ? 'peony' : r < 0.58 ? 'willow' : r < 0.76 ? 'ring' : 'crackle';
    const pal = SHELLS[Math.floor(Math.random() * SHELLS.length)];
    this.rockets.push({ x, z, ny, wait, big, type, pal, y: WATER_Y + 0.3, vy: 0, top: 0, trail: 0, live: false });
  }

  /**
   * The show goes on: one shell, or a few in a salvo, every second or two.
   * lead: how far the view will have moved on by the time a shell bursts.
   */
  schedule(dt, camX, lead) {
    this.timer -= dt;
    if (this.timer > 0) return;
    const salvo = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 2) : 1;
    for (let i = 0; i < salvo; i++) {
      this.launch(camX + lead + (Math.random() - 0.5) * 24, -15 - Math.random() * 13, 0.2 + Math.random() * 0.45, i * 0.3);
    }
    this.timer = 1.2 + Math.random() * 1.8;
  }

  /** A volley to welcome the cat home. */
  finale(x) {
    for (let i = 0; i < 11; i++) {
      this.launch(x + 1 + Math.random() * 16, -14 - Math.random() * 10, 0.25 + Math.random() * 0.5, 0.2 + i * 0.28, true);
    }
    this.timer = 3.6;
  }

  burst(k) {
    const { x, y, z, pal, type, big } = k;
    const s = big ? 1.3 : 0.8 + Math.random() * 0.4;
    const n = Math.round((type === 'ring' ? 60 : type === 'willow' ? 70 : 110) * s * this.density);
    const speed = (type === 'willow' ? 4.4 : 5.8) * s;
    // a ring lies in a plane turned a little toward the camera
    const tilt = (Math.random() - 0.5) * 1.2;
    const turn = (Math.random() - 0.5) * 1.0;
    for (let i = 0; i < n; i++) {
      let dx;
      let dy;
      let dz;
      if (type === 'ring') {
        const a = (i / n) * Math.PI * 2;
        const ry = Math.sin(a) * Math.cos(tilt);
        const rz = Math.sin(a) * Math.sin(tilt);
        dx = Math.cos(a) * Math.cos(turn) + rz * Math.sin(turn);
        dy = ry;
        dz = rz * Math.cos(turn) - Math.cos(a) * Math.sin(turn);
      } else {
        const u = Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        dx = r * Math.cos(a);
        dy = u;
        dz = r * Math.sin(a);
      }
      const sp = speed * (type === 'ring' ? 1 : 0.8 + Math.random() * 0.3);
      if (type === 'willow') this.spawn(x, y, z, dx * sp, dy * sp, dz * sp, 2.4 + Math.random() * 0.8, GOLD, 3, 1.0, 1.5);
      else if (type === 'crackle') this.spawn(x, y, z, dx * sp, dy * sp, dz * sp, 1.0 + Math.random() * 0.5, SILVER, 2, 1.35, 2.2);
      else this.spawn(x, y, z, dx * sp, dy * sp, dz * sp, 1.3 + Math.random() * 0.6, pal[i % pal.length], 0, 1.35, 2.2);
    }
    const f = this.flashes.find((fl) => fl.age >= 0.4) || (this.flashes.length < 8 ? {} : null);
    if (f) {
      if (!this.flashes.includes(f)) this.flashes.push(f);
      Object.assign(f, { x, y, z, age: 0, c: pal[0], s });
    }
    this.light.color.setRGB(pal[0][0], pal[0][1], pal[0][2]);
    this.lightI = Math.max(this.lightI, big ? 0.55 : 0.3);
    const d = this.v.set(x, y, z).distanceTo(this.world.camera.position);
    this.world.sfx?.firework({ delay: 0.12 + d * 0.008, size: Math.min(1.3, s * (30 / d)), crackle: type === 'crackle' });
  }

  update(dt, camX, lead) {
    this.schedule(dt, camX, lead);
    const pos = this.stars.geometry.attributes.position.array;
    const col = this.stars.geometry.attributes.color.array;
    let w = 0;
    const put = (x, y, z, r, g, b) => {
      pos[w * 3] = x;
      pos[w * 3 + 1] = y;
      pos[w * 3 + 2] = z;
      col[w * 3] = r;
      col[w * 3 + 1] = g;
      col[w * 3 + 2] = b;
      w++;
    };

    // shells climbing, trailing embers
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const k = this.rockets[i];
      if (k.wait > 0) {
        k.wait -= dt;
        continue;
      }
      if (!k.live) {
        k.live = true;
        k.top = Math.max(WATER_Y + 3.5, this.screenY(k.ny, k.z));
        k.vy = Math.sqrt(2 * CLIMB * (k.top - k.y)) + 2.5; // slows as it climbs, still rising when it bursts
        if (Math.random() < 0.35) this.world.sfx?.whistle((k.vy - 2.5) / CLIMB);
      }
      k.vy = Math.max(2.5, k.vy - CLIMB * dt);
      k.y += k.vy * dt;
      k.trail -= dt;
      if (k.trail <= 0) {
        k.trail = 0.03;
        const j = () => (Math.random() - 0.5) * 0.4;
        this.spawn(k.x, k.y - 0.1, k.z, j(), -0.4 - Math.random() * 0.6, j(), 0.4 + Math.random() * 0.3, EMBER, 1, 2, 1);
      }
      if (k.y >= k.top) {
        this.burst(k);
        this.rockets.splice(i, 1);
      } else if (w < this.n) put(k.x, k.y, k.z, 1.6, 1.15, 0.7);
    }

    // stars: drag, fall, fade; dead ones are recycled and the buffer packed
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.age += dt;
      if (q.age >= q.life) {
        this.spare.push(q);
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      const f = Math.exp(-q.drag * dt);
      q.vx *= f;
      q.vy = q.vy * f - q.grav * dt;
      q.vz *= f;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      const u = q.age / q.life;
      let b;
      if (q.kind === 1) b = 0.55 * (1 - u) * (1 - u);
      else {
        b = 1.7 * Math.pow(1 - u, 1.3);
        if (q.age < 0.08) b *= 1 + (1 - q.age / 0.08) * 1.5; // white-hot at the burst
        if (q.kind === 2 && u > 0.55) b *= Math.random() < 0.45 ? 2.4 : 0.05;
      }
      if (q.kind === 3) {
        q.next -= dt;
        if (q.next <= 0 && this.parts.length < this.n * 0.8) {
          q.next = 0.09;
          this.spawn(q.x, q.y, q.z, 0, -0.15, 0, 0.7, GOLD, 1, 3, 0.5);
        }
      }
      if (w < this.n) put(q.x, q.y, q.z, q.r * b, q.g * b, q.b * b);
    }
    const sg = this.stars.geometry;
    sg.setDrawRange(0, w);
    sg.attributes.position.needsUpdate = true;
    sg.attributes.color.needsUpdate = true;

    // the flash of each burst
    const gp = this.glows.geometry.attributes.position.array;
    const gc = this.glows.geometry.attributes.color.array;
    let k = 0;
    for (const fl of this.flashes) {
      fl.age += dt;
      if (fl.age >= 0.4) continue;
      const b = 0.9 * fl.s * (1 - fl.age / 0.4) ** 2;
      gp[k * 3] = fl.x;
      gp[k * 3 + 1] = fl.y;
      gp[k * 3 + 2] = fl.z;
      gc[k * 3] = fl.c[0] * b;
      gc[k * 3 + 1] = fl.c[1] * b;
      gc[k * 3 + 2] = fl.c[2] * b;
      k++;
    }
    const gg = this.glows.geometry;
    gg.setDrawRange(0, k);
    gg.attributes.position.needsUpdate = true;
    gg.attributes.color.needsUpdate = true;

    this.lightI *= Math.exp(-6 * dt);
    this.light.intensity = this.lightI;
  }
}

export const harbourTheme = {
  key: 'harbour',
  floorY: WATER_Y,
  ambience: 'harbour',
  hanging: new Set(['fishline', 'lanterns']),
  fallFx: { sound: 'splash', color: 0x8fe0ff },
  colors: {
    bg: 0x060814,
    fog: 0x0b1222,
    fogNear: 18,
    fogFar: 80,
    hemiSky: 0x3a4572,
    hemiGround: 0x1c140e,
    hemiInt: 1.2,
    moon: 0xc4c8f0,
    moonInt: 2.2,
    moonPos: [-34, 6.4, -92],
    moonSize: 1.9,
    moonHalo: 0xffe2b8,
    skyTop: [0.006, 0.008, 0.026],
    skyMid: [0.018, 0.026, 0.066],
    skyHor: [0.06, 0.045, 0.085],
    starCount: 600,
    starRange: [3, 22], // low enough to show over the hills across the bay
    fill: 0xb4bcff,
    puff: 0x9aa4b4,
    spark: 0xa0f0ff,
    cp: 0xffb46a,
  },

  makeTextures(rng) {
    return {
      quay: quayStoneTexture(rng),
      boards: boardTexture(rng),
      wood: woodTexture(rng),
      plaster: plasterTexture(rng),
      paneLit: windowPaneTexture(true),
      paneDark: windowPaneTexture(false),
      town: townWindowsTexture(rng, ATLAS.cols, ATLAS.rows, 0.38, null),
      waterNormals: waterNormalsTexture(rng),
      beam: beamTexture(),
    };
  },

  init(tex) {
    this.tex = tex;
    // filled while the level is built, used when the world is dressed
    this.windows = [];
    this.rings = [];
    this.tyres = [];
    this.piles = [];
    this.bollards = [];
    this.boats = [];
    this.swings = [];
    this.lights = [];
    this.vanes = [];
    this.taken = [];
    this.home = null;
    this.vaned = false;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    this.m = {
      stone: std({ map: tex.quay, color: 0xb4b8c0, roughness: 0.9 }),
      coping: std({ map: tex.quay, color: 0xd0cabe, roughness: 0.75 }),
      weed: std({ color: 0x18241a, roughness: 0.95 }),
      crate: std({ map: tex.wood, color: 0xe2d2b8, roughness: 0.85 }),
      boxes: [0x6f9ac0, 0xd8ccb4, 0xb85a48, 0x7fae96].map((c) => std({ map: tex.boards, color: c, roughness: 0.8 })),
      barrel: std({ map: tex.wood, color: 0xb09a80, roughness: 0.8 }),
      deck: std({ map: tex.wood, color: 0xd0c0a8, roughness: 0.8 }),
      tar: std({ map: tex.wood, color: 0x8a8078, roughness: 0.9 }),
      trim: std({ color: 0xcfc6b4, roughness: 0.8 }),
      oldPlank: std({ map: tex.wood, color: 0xe0d6c6, roughness: 0.9 }),
      timber: std({ color: 0x2e2218, roughness: 0.85 }),
      pile: std({ color: 0x3a2c22, roughness: 0.92 }),
      iron: std({ color: 0x1c1e24, roughness: 0.5, metalness: 0.6 }),
      rubber: std({ color: 0x141416, roughness: 0.8 }),
      rope: std({ color: 0xb59b6e, roughness: 0.95 }),
      net: std({ color: 0x34443a, roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
      wicker: std({ color: 0x9a7448, roughness: 0.9 }),
      cork: std({ color: 0xc8a878, roughness: 0.9 }),
      buoy: std({ color: 0xe0642a, roughness: 0.55 }),
      fish: std({ color: 0xa8b4c4, roughness: 0.3, metalness: 0.6, emissive: 0x18222e, emissiveIntensity: 0.5 }),
      // drying fish catch the lamplight, so the line reads against the dark water
      dried: std({ color: 0xd8b070, roughness: 0.45, metalness: 0.3, emissive: 0x6a4818, emissiveIntensity: 0.9 }),
      ice: std({ color: 0xdfeefa, roughness: 0.2, emissive: 0x3a5a7a, emissiveIntensity: 0.25 }),
      sheds: SHEDS.map((c) => std({ map: tex.boards, color: c, roughness: 0.88 })),
      plaster: std({ map: tex.plaster, color: 0xf0ebe0, roughness: 0.9 }),
      slate: std({ color: 0x2c303a, roughness: 0.7 }),
      door: std({ color: 0x2c5c8c, roughness: 0.65 }),
      dark: std({ color: 0x0c0a08, roughness: 1 }),
      hull: std({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
      cabin: std({ color: 0xe6e0d2, roughness: 0.8 }),
      rock: std({ color: 0x23252c, roughness: 1, flatShading: true }),
      white: std({ color: 0xece8e0, roughness: 0.6 }),
      red: std({ color: 0xa82a24, roughness: 0.6 }),
      brass: std({ color: 0xd2a55a, roughness: 0.35, metalness: 0.6, emissive: 0x3a2008, emissiveIntensity: 0.4 }),
      bowl: std({ color: 0x3a6aa8, roughness: 0.3 }),
      paneLit: std({ map: tex.paneLit, emissiveMap: tex.paneLit, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.8 }),
      paneDark: std({ map: tex.paneDark, roughness: 0.25, metalness: 0.3 }),
      lamp: std({ color: 0x2a1406, emissive: 0xffb45a, emissiveIntensity: 3.2, roughness: 0.6 }),
      lens: std({ color: 0x302818, emissive: 0xfff0c8, emissiveIntensity: 3.5, roughness: 0.4, fog: false }),
      masthead: std({ color: 0x1a1612, emissive: 0xfff4e0, emissiveIntensity: 3, roughness: 0.5 }),
      port: std({ color: 0x200000, emissive: 0xff3a2a, emissiveIntensity: 3 }),
      starboard: std({ color: 0x002000, emissive: 0x3aff6a, emissiveIntensity: 3 }),
      beacon: std({ color: 0x002000, emissive: 0x4aff7a, emissiveIntensity: 0.2 }),
      paper: PAPER.map((c) => std({ color: new THREE.Color(c).multiplyScalar(0.15), emissive: c, emissiveIntensity: 2.2, roughness: 0.9 })),
      // the strings high over the quays: dimmer, so they colour the night rather than glare
      festoon: PAPER.slice(0, 4).map((c) => std({ color: new THREE.Color(c).multiplyScalar(0.15), emissive: c, emissiveIntensity: 1.3, roughness: 0.9 })),
      floater: std({ color: 0x2a1406, emissive: 0xffb060, emissiveIntensity: 2.4, roughness: 0.9 }),
      flowers: [0xff6a9a, 0xffd25a, 0xffffff].map((c) => std({ color: c, roughness: 0.8, emissive: c, emissiveIntensity: 0.15 })),
    };
    const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    this.geo = {
      unitBox: new THREE.BoxGeometry(1, 1, 1),
      unitPlane: new THREE.PlaneGeometry(1, 1),
      ball: new THREE.SphereGeometry(1, 12, 8),
      lump: new THREE.IcosahedronGeometry(1, 1),
      fish: fishGeometry(),
      pile: new THREE.CylinderGeometry(1, 1, 1, 8),
      ring: new THREE.TorusGeometry(0.09, 0.016, 6, 14),
      tyre: new THREE.TorusGeometry(0.26, 0.09, 8, 18),
      bollard: lathe([[0.001, 0], [0.22, 0], [0.22, 0.05], [0.17, 0.08], [0.15, 0.3], [0.16, 0.42], [0.24, 0.48], [0.25, 0.54], [0.2, 0.6], [0.001, 0.62]], 14),
      barrel: lathe([[0.001, 0], [0.27, 0], [0.3, 0.12], [0.325, 0.3], [0.33, 0.46], [0.325, 0.62], [0.3, 0.8], [0.27, 0.9], [0.24, 0.9], [0.24, 0.85], [0.001, 0.85]], 16),
      bowl: lathe([[0.001, 0], [0.1, 0], [0.12, 0.02], [0.15, 0.08], [0.16, 0.1], [0.14, 0.1], [0.12, 0.04], [0.001, 0.04]], 16),
      basket: lathe([[0.001, 0], [0.3, 0], [0.36, 0.06], [0.38, 0.2], [0.35, 0.21], [0.33, 0.08], [0.001, 0.08]], 18),
      hoop: new THREE.TorusGeometry(1, 0.025, 4, 24).rotateX(Math.PI / 2),
      potNet: new THREE.CylinderGeometry(0.24, 0.24, 0.52, 12, 1, true, 0, Math.PI).rotateZ(Math.PI / 2),
      potEnd: new THREE.CircleGeometry(0.24, 10, 0, Math.PI).rotateY(Math.PI / 2),
      potHoop: new THREE.TorusGeometry(0.245, 0.014, 4, 12, Math.PI).rotateY(Math.PI / 2),
      cork: new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8),
      lantern: new THREE.SphereGeometry(0.14, 12, 10),
    };
  },

  /** Platforms are dressed in dress(), once their neighbours are known: a quay, a moored boat or a fish shed. */
  buildPlatform() {},

  buildObstacle(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    const add = (geo, mat, px, py, pz, shadow = true) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(px, py, pz);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    const fish = (px, py, pz) => add(this.geo.fish, m.fish, px, py, pz, false);
    let size;
    if (kind === 'crate') {
      // painted fish boxes stacked three high, the top one heaped with fish on ice
      const paint = () => m.boxes[Math.floor(rng() * m.boxes.length)];
      add(boxWorldUV(0.86, 0.36, 0.62, 1), paint(), 0, 0.18, 0);
      add(boxWorldUV(0.82, 0.34, 0.6, 1), paint(), -0.02, 0.53, 0.01).rotation.y = (rng() - 0.5) * 0.16;
      add(boxWorldUV(0.78, 0.3, 0.58, 1), paint(), 0.02, 0.85, -0.01).rotation.y = (rng() - 0.5) * 0.2;
      add(this.geo.unitBox, m.ice, 0.02, 1.005, -0.01, false).scale.set(0.7, 0.03, 0.5);
      for (let i = 0; i < 6; i++) {
        const f = fish(-0.22 + (i % 3) * 0.22 + (rng() - 0.5) * 0.05, 1.045 + (i > 2 ? 0.025 : 0), i > 2 ? 0.09 : -0.11);
        f.rotation.order = 'YXZ';
        f.rotation.set(Math.PI / 2, (rng() - 0.5) * 1.2 + (i % 2) * Math.PI, 0);
      }
      size = { w: 0.86, h: 1.08 };
    } else if (kind === 'barrel') {
      // a herring barrel, tails poking out of the top
      add(this.geo.barrel, m.barrel, 0, 0, 0);
      for (const [y, r] of [
        [0.1, 0.302],
        [0.28, 0.33],
        [0.64, 0.33],
        [0.8, 0.305],
      ]) {
        add(this.geo.hoop, m.iron, 0, y, 0, false).scale.set(r, 1, r);
      }
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + rng();
        const f = fish(0.12 * Math.cos(a), 0.86, 0.12 * Math.sin(a));
        f.rotation.set(0, a, -Math.PI / 2 + (rng() - 0.5) * 0.4); // nose down in the brine
      }
      size = { w: 0.66, h: 0.95 };
    } else if (kind === 'creel') {
      // lobster pots stacked up, a buoy tied to the top one
      const pot = (px, py, ry) => {
        const p = new THREE.Group();
        p.position.set(px, py, 0);
        p.rotation.y = ry;
        g.add(p);
        const base = new THREE.Mesh(this.geo.unitBox, m.crate);
        base.scale.set(0.52, 0.08, 0.48);
        base.position.y = 0.04;
        base.castShadow = true;
        p.add(base);
        const net = new THREE.Mesh(this.geo.potNet, m.net);
        net.position.y = 0.08;
        net.castShadow = true;
        p.add(net);
        for (const s of [-1, 1]) {
          const end = new THREE.Mesh(this.geo.potEnd, m.net);
          end.position.set(s * 0.26, 0.08, 0);
          p.add(end);
        }
        for (const hx of [-0.24, 0, 0.24]) {
          const h = new THREE.Mesh(this.geo.potHoop, m.timber);
          h.position.set(hx, 0.08, 0);
          p.add(h);
        }
      };
      pot(-0.26, 0, 0.04);
      pot(0.26, 0, -0.06);
      pot(0.02, 0.32, 0.1);
      pot(-0.04, 0.64, -0.08);
      const buoy = add(this.geo.ball, m.buoy, 0.14, 1.0, 0.12);
      buoy.scale.set(0.09, 0.11, 0.09);
      size = { w: 1.04, h: 1.05 };
    } else if (kind === 'bollard') {
      // an iron bollard, a mooring rope round it running off to a boat
      add(this.geo.bollard, m.iron, 0, 0, 0);
      for (const [y, r] of [
        [0.07, 0.24],
        [0.13, 0.22],
      ]) {
        const coil = add(new THREE.TorusGeometry(r, 0.03, 6, 18), m.rope, 0, y, 0, false);
        coil.rotation.x = Math.PI / 2;
      }
      const line = add(this.geo.pile, m.rope, 0.05, 0.1, -0.7, false);
      line.scale.set(0.025, 1.3, 0.025);
      line.rotation.set(1.2, 0, 0);
      size = { w: 0.52, h: 0.62 };
    } else {
      // a heap of nets with cork floats and two buoys
      for (const [lx, ly, sx, sy, sz] of [
        [0, 0.12, 0.6, 0.32, 0.48],
        [-0.36, 0.08, 0.32, 0.2, 0.36],
        [0.34, 0.07, 0.34, 0.18, 0.38],
      ]) {
        const lump = add(this.geo.lump, m.net, lx, ly, (rng() - 0.5) * 0.1);
        lump.scale.set(sx, sy, sz);
        lump.rotation.set(rng(), rng() * 3, rng() * 0.3);
      }
      for (let i = 0; i < 9; i++) {
        const a = rng() * Math.PI * 2;
        const r = 0.15 + rng() * 0.35;
        const c = add(this.geo.cork, m.cork, Math.cos(a) * r, 0.3 - r * 0.35, Math.sin(a) * r * 0.7, false);
        c.rotation.set(rng() * 3, 0, rng() * 3);
      }
      for (const s of [-1, 1]) add(this.geo.ball, m.buoy, s * 0.52, 0.11, 0.2 * s, true).scale.setScalar(0.11);
      size = { w: 1.3, h: 0.55 };
    }
    group.add(g);
    return size;
  },

  buildHanging(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    // two posts behind the walk, arms reaching over it; the line hangs low between them
    const half = 0.8;
    const lineY = kind === 'fishline' ? 1.02 : 1.16;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(this.geo.pile, m.timber);
      post.scale.set(0.04, lineY + 0.16, 0.04);
      post.position.set(s * half, (lineY + 0.16) / 2, -0.95);
      post.castShadow = true;
      g.add(post);
      const arm = new THREE.Mesh(this.geo.pile, m.timber);
      arm.scale.set(0.025, 0.9, 0.025);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(s * half, lineY + 0.1, -0.52);
      g.add(arm);
    }
    // what hangs from the line swings when the cat brushes past
    const swing = new THREE.Group();
    swing.position.set(0, lineY, -0.08);
    g.add(swing);
    const drop = kind === 'fishline' ? 0.04 : 0.14;
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sag(-half, 0.06, half, 0.06, 0, drop, 12)), 24, 0.012, 5), m.rope);
    swing.add(line);
    if (kind === 'fishline') {
      // fish hung out to dry, nose down, pegged by the tail
      for (let i = 0; i < 5; i++) {
        const fx = -0.5 + i * 0.25 + (rng() - 0.5) * 0.04;
        const f = new THREE.Mesh(this.geo.fish, m.dried);
        f.scale.set(1.45, 1.9, 2.2);
        f.position.set(fx, -0.3 + (rng() - 0.5) * 0.04, 0);
        f.rotation.set(0, (rng() - 0.5) * 0.6, -Math.PI / 2);
        f.castShadow = true;
        swing.add(f);
        const peg = new THREE.Mesh(this.geo.unitBox, m.crate);
        peg.scale.set(0.025, 0.08, 0.035);
        peg.position.set(fx, 0.02, 0);
        swing.add(peg);
      }
      // a lamp on the post lights them
      const lamp = new THREE.Mesh(this.geo.unitBox, m.lamp);
      lamp.scale.set(0.11, 0.15, 0.11);
      lamp.position.set(-half, lineY + 0.24, -0.95);
      g.add(lamp);
      group.add(g);
      this.swings.push({ x, g: swing, kick: 0, age: 0, ph: rng() * 6.28 });
      this.lights.push({ x, y: top + 1.2, z: 0.4, color: 0xffb46a, intensity: 6, distance: 6 });
      return { w: 1.15, clearance: 0.44, height: 1.02 };
    }
    // a string of paper lanterns hung low across the walk
    for (let i = 0; i < 4; i++) {
      const lx = -0.42 + i * 0.28;
      const ly = 0.06 - drop * Math.sin(((lx + half) / (half * 2)) * Math.PI);
      const str = new THREE.Mesh(this.geo.pile, m.timber);
      str.scale.set(0.006, 0.12, 0.006);
      str.position.set(lx, ly - 0.06, 0);
      swing.add(str);
      const lan = new THREE.Mesh(this.geo.lantern, m.paper[Math.floor(rng() * m.paper.length)]);
      lan.scale.set(1, 1.35, 1);
      lan.position.set(lx, ly - 0.12 - 0.19, 0);
      swing.add(lan);
      const cap = new THREE.Mesh(this.geo.pile, m.timber);
      cap.scale.set(0.06, 0.03, 0.06);
      cap.position.set(lx, ly - 0.12, 0);
      swing.add(cap);
    }
    group.add(g);
    this.swings.push({ x, g: swing, kick: 0, age: 0, ph: rng() * 6.28 });
    this.lights.push({ x, y: top + 0.8, z: 0.3, color: 0xff9a5a, intensity: 6, distance: 6 });
    return { w: 1.15, clearance: 0.46, height: 1.02 };
  },

  /** Old jetty planks laid across the water on a light frame: the planks drop when they give way. */
  buildBrittle(group, x0, x1, top, rng) {
    const m = this.m;
    const len = x1 - x0;
    const n = Math.max(2, Math.round(len / 1.2));
    const seg = len / n;
    const plankGeo = new THREE.BoxGeometry(seg - 0.04, 0.07, 0.34);
    const battenGeo = new THREE.BoxGeometry(0.1, 0.06, 1.1);
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Group();
      p.position.set(x0 + seg * (i + 0.5), top, 0);
      for (const z of [-0.37, 0, 0.37]) {
        if (z !== 0 && rng() < 0.15) continue; // a plank missing here and there
        const b = new THREE.Mesh(plankGeo, m.oldPlank);
        b.position.set((rng() - 0.5) * 0.06, -0.035 + (rng() - 0.5) * 0.02, z + (rng() - 0.5) * 0.03);
        b.rotation.y = (rng() - 0.5) * 0.06;
        b.castShadow = b.receiveShadow = true;
        p.add(b);
      }
      const batten = new THREE.Mesh(battenGeo, m.timber);
      batten.position.set(seg / 2 - 0.12, -0.1, 0);
      p.add(batten);
      group.add(p);
      pieces.push(p);
    }
    // the frame stands in the water and stays when the planks go
    for (const x of [x0 + 0.25, x1 - 0.25]) {
      for (const z of [-0.85, 0.85]) this.piles.push({ x, z, y0: WATER_Y - 0.6, y1: top - 0.14, r: 0.08 });
    }
    const rail = new THREE.Mesh(boxWorldUV(len - 0.3, 0.1, 0.1, 1), m.timber);
    rail.position.set((x0 + x1) / 2, top - 0.18, -0.85);
    group.add(rail);
    // an old lantern on a post at the back of the frame, so the planks show in the dark
    const post = new THREE.Mesh(this.geo.pile, m.timber);
    post.scale.set(0.05, 1.5, 0.05);
    post.position.set(x0 + 0.25, top + 0.55, -0.95);
    post.castShadow = true;
    group.add(post);
    const lamp = new THREE.Mesh(this.geo.unitBox, m.lamp);
    lamp.scale.set(0.13, 0.18, 0.13);
    lamp.position.set(x0 + 0.25, top + 1.2, -0.82);
    group.add(lamp);
    this.lights.push({ x: x0 + 1.2, y: top + 1.3, z: -0.2, color: 0xffb05a, intensity: 7, distance: 8, flicker: true });
    return pieces;
  },

  buildGoal(level, rng) {
    const m = this.m;
    const gx = level.goalX;
    const top = level.platforms[level.platforms.length - 1].top;
    this.home = { x: gx, top };
    const g = new THREE.Group();
    g.position.set(gx, 0, 0);
    const add = (geo, mat, x, y, z, shadow = false) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    // the gate: two masts behind the walk, a string of paper lanterns high between them
    for (const s of [-1, 1]) {
      add(this.geo.pile, m.timber, s * 1.3, top + 1.5, -0.85, true).scale.set(0.07, 3.0, 0.07);
      add(this.geo.ball, m.brass, s * 1.3, top + 3.05, -0.85).scale.setScalar(0.08);
    }
    const pts = sag(-1.3, top + 2.9, 1.3, top + 2.9, -0.85, 0.4, 12);
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.015, 5), m.rope, 0, 0, 0);
    for (let i = 1; i < 6; i++) {
      const p = pts[i * 2];
      add(this.geo.lantern, m.paper[i % m.paper.length], p.x, p.y - 0.28, p.z).scale.set(1.1, 1.4, 1.1);
    }

    // home: a whitewashed cottage on a landing behind the walk
    const hx0 = 2.6;
    const hx1 = 11.0;
    const zc = -3.6;
    const half = 1.5;
    const eave = top + 2.5;
    const front = zc + half;
    const land = add(boxWorldUV(13, top - 0.2 - (WATER_Y - 0.8), 4.4, 2), m.stone, 7.0, (top - 0.2 + WATER_Y - 0.8) / 2, -3.5);
    land.receiveShadow = true;
    add(boxWorldUV(13.1, 0.2, 4.5, 1), m.coping, 7.0, top - 0.1, -3.5);
    add(boxWorldUV(hx1 - hx0, eave - top, half * 2, 2), m.plaster, (hx0 + hx1) / 2, (top + eave) / 2, zc);
    // a pitched slate roof with plaster gables
    const rise = 1.3;
    const slope = Math.hypot(half + 0.3, rise);
    const pitch = Math.atan2(rise, half + 0.3);
    for (const s of [1, -1]) {
      const r = add(new THREE.BoxGeometry(hx1 - hx0 + 0.5, 0.12, slope), m.slate, (hx0 + hx1) / 2, eave + rise / 2 - 0.05, zc + (s * (half + 0.3)) / 2, true);
      r.rotation.x = s * pitch;
    }
    const gableMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.9, side: THREE.DoubleSide });
    for (const gxe of [hx0, hx1]) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([gxe, eave, zc - half, gxe, eave, zc + half, gxe, eave + rise - 0.08, zc], 3));
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, gableMat));
    }
    add(boxWorldUV(0.6, 1.2, 0.6, 1), m.stone, hx1 - 1.6, eave + 1.1, zc - 0.4);
    // a blue door with a step, a lit window with a box of flowers, a lifebuoy, oars on the wall, a bench
    add(this.geo.unitBox, m.door, hx0 + 1.6, top + 0.85, front + 0.04).scale.set(0.9, 1.7, 0.08);
    add(this.geo.unitBox, m.coping, hx0 + 1.6, top + 0.06, front + 0.25).scale.set(1.2, 0.12, 0.4);
    add(this.geo.ball, m.brass, hx0 + 1.9, top + 0.85, front + 0.1).scale.setScalar(0.035);
    add(this.geo.unitPlane, m.paneLit, hx0 + 4.8, top + 1.45, front + 0.014).scale.set(1.1, 1.0, 1);
    add(this.geo.unitBox, m.timber, hx0 + 4.8, top + 1.45, front + 0.004).scale.set(1.24, 1.14, 0.008);
    add(this.geo.unitBox, m.door, hx0 + 4.8, top + 0.86, front + 0.12).scale.set(1.25, 0.16, 0.24);
    for (let i = 0; i < 9; i++) {
      add(this.geo.ball, m.flowers[i % 3], hx0 + 4.25 + i * 0.14, top + 0.98 + rng() * 0.05, front + 0.14 + (rng() - 0.5) * 0.08).scale.setScalar(0.05);
    }
    for (let k = 0; k < 4; k++) {
      const arc = add(new THREE.TorusGeometry(0.26, 0.07, 8, 8, Math.PI / 2), k % 2 ? m.white : m.red, hx0 + 3.2, top + 1.5, front + 0.09);
      arc.rotation.z = (k * Math.PI) / 2;
    }
    // a pair of oars crossed on the wall, a string of cork floats over them
    for (const s of [-1, 1]) {
      const oar = new THREE.Group();
      oar.position.set(hx1 - 1.5, top + 1.3, front + 0.06);
      oar.rotation.z = s * 0.7;
      g.add(oar);
      const loom = new THREE.Mesh(this.geo.unitBox, m.crate);
      loom.scale.set(0.05, 1.5, 0.04);
      oar.add(loom);
      const blade = new THREE.Mesh(this.geo.unitBox, m.crate);
      blade.scale.set(0.16, 0.42, 0.03);
      blade.position.y = -0.62;
      oar.add(blade);
    }
    for (let i = 0; i < 5; i++) add(this.geo.cork, m.cork, hx1 - 2.0 + i * 0.25, top + 1.95 - Math.sin((i / 4) * Math.PI) * 0.08, front + 0.06);
    add(this.geo.unitBox, m.crate, hx0 + 6.7, top + 0.42, front + 0.42).scale.set(1.3, 0.07, 0.36);
    for (const s of [-1, 1]) add(this.geo.unitBox, m.timber, hx0 + 6.7 + s * 0.55, top + 0.2, front + 0.42).scale.set(0.07, 0.4, 0.3);
    add(this.geo.unitBox, m.lamp, hx0 + 0.75, top + 2.0, front + 0.14).scale.set(0.16, 0.22, 0.16);

    // the harbour light at the end of the quay, blinking green
    const bx = 15.4;
    add(this.geo.pile, m.white, bx, top + 1.2, -0.9, true).scale.set(0.3, 2.4, 0.3);
    add(this.geo.pile, m.red, bx, top + 1.9, -0.9).scale.set(0.31, 0.4, 0.31);
    add(this.geo.pile, m.beacon, bx, top + 2.6, -0.9).scale.set(0.2, 0.4, 0.2);
    add(new THREE.ConeGeometry(0.3, 0.3, 8), m.red, bx, top + 2.95, -0.9);
    level.group.add(g);
    level.fixtures.push({ x: gx + hx0 + 4.8, y: top + 1.45, z: front + 0.6, color: 0xffc27a, intensity: 8, distance: 10 });
    level.fixtures.push({ x: gx, y: top + 2.5, z: 0, color: 0xff9a5a, intensity: 5, distance: 7 });
    level.fixtures.push({ x: gx + hx0 + 0.75, y: top + 2.0, z: front + 0.5, color: 0xffb45a, intensity: 4, distance: 6, flicker: true });
  },

  // --- dressing ----------------------------------------------------------------
  dress(world) {
    const { quality } = world;
    const S = (world.themeState = {
      water: null,
      bay: [],
      lamps: [],
      strings: [],
      cats: null,
      floaters: null,
      lighthouse: null,
      fw: null,
      finale: false,
      camX: world.level.startX,
      camV: 0,
    });
    this.buildWater(world, S);
    this.buildPlatforms(world);
    this.buildFarShore(world);
    this.buildHighStars(world);
    this.buildLighthouse(world, S);
    this.buildBay(world, S);
    this.buildCats(world, S);
    this.buildLamps(world, S);
    this.buildFloaters(world, S, Math.round(60 * quality.particles));
    this.buildInstanced(world);
    for (const l of this.lights) world.fixtures.push(l);
    S.fw = new Fireworks(world, Math.round(1500 * quality.particles));
  },

  buildWater(world, S) {
    const { scene, level, tex, quality } = world;
    const len = level.endX + 240;
    const water = new Water(new THREE.PlaneGeometry(len, 112), {
      textureWidth: quality.waterRes,
      textureHeight: quality.waterRes,
      waterNormals: tex.waterNormals,
      sunDirection: new THREE.Vector3(-0.32, 0.12, -0.94).normalize(),
      sunColor: 0x8a96c0,
      waterColor: 0x061a26,
      distortionScale: 1.8,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(len / 2 - 100, WATER_Y, -2);
    water.material.uniforms.size.value = 6;
    scene.add(water);
    S.water = water;
  },

  /** Dress each platform: a fish shed if it is high, a moored boat if it is short with water either side, else a quay. */
  buildPlatforms(world) {
    const pls = world.level.platforms;
    pls.forEach((pl, i) => {
      if (pl.brittle) return;
      const prev = pls[i - 1];
      const next = pls[i + 1];
      const open = (!prev || pl.x0 - prev.x1 > 0.01) && (!next || next.x0 - pl.x1 > 0.01);
      if (pl.top >= 1.5) this.shed(world, pl);
      else if (open && pl.x1 - pl.x0 <= 8) this.boat(world, pl);
      else this.quay(world, pl);
    });
  },

  quay(world, { x0, x1, top }) {
    const { scene, rng } = world;
    const m = this.m;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const bottom = WATER_Y - 1;
    const h = top - 0.2 - bottom;
    const wall = new THREE.Mesh(boxWorldUV(len, h, MOLE, 2), m.stone);
    wall.position.set(cx, bottom + h / 2, 0);
    wall.receiveShadow = true;
    scene.add(wall);
    const cope = new THREE.Mesh(boxWorldUV(len + 0.1, 0.2, MOLE + 0.24, 1), m.coping);
    cope.position.set(cx, top - 0.1, 0);
    cope.receiveShadow = cope.castShadow = true;
    scene.add(cope);
    // weed and barnacles where the tide reaches
    const weed = new THREE.Mesh(this.geo.unitBox, m.weed);
    weed.scale.set(len + 0.02, 0.7, 0.04);
    weed.position.set(cx, WATER_Y + 0.15, MOLE / 2 + 0.01);
    scene.add(weed);
    // iron rings and old tyres on the face, bollards along the back edge
    for (let x = x0 + 1.2 + rng() * 2; x < x1 - 0.8; x += 3.5 + rng() * 3) this.rings.push({ x, y: top - 0.5 });
    for (let x = x0 + 2 + rng() * 3; x < x1 - 1; x += 5 + rng() * 5) this.tyres.push({ x, y: WATER_Y + 0.55 + rng() * 0.2 });
    for (let x = x0 + 1.5 + rng() * 2; x < x1 - 1; x += 7 + rng() * 6) this.bollards.push({ x, y: top, z: -1.08 });
  },

  /** A fishing boat moored bow or stern first; its deck is the walk. */
  boat(world, { x0, x1, top }) {
    const { scene, rng } = world;
    const m = this.m;
    const L = x1 - x0;
    const beam = 2.9;
    const ahead = rng() < 0.5; // the bow points on down the walk, or back along it
    const wx = (lx) => (ahead ? x0 + lx : x1 - lx);
    const g = new THREE.Group();
    g.position.set(ahead ? x0 : x1, 0, 0);
    g.scale.x = ahead ? 1 : -1;
    scene.add(g);
    const add = (geo, mat, x, y, z, shadow = false) => {
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    add(hullGeometry(L, beam, top, WATER_Y - 0.7, HULLS[Math.floor(rng() * HULLS.length)]), m.hull, 0, 0, 0);
    add(deckGeometry(L, beam), m.deck, 0, top, 0);
    // old tyres for fenders, hung over the side on short ropes
    for (const u of [0.22, 0.5]) {
      const z = hullHalf(u, beam) * 0.93 + 0.06;
      add(this.geo.tyre, m.rubber, u * L, top - 0.42, z, true).scale.setScalar(0.8);
      add(this.geo.pile, m.rope, u * L, top - 0.05, z - 0.04).scale.set(0.012, 0.3, 0.012);
    }
    // a mast at the back of the deck, a lantern on it lighting the walk
    const mx = L * (0.28 + rng() * 0.12);
    add(this.geo.pile, m.timber, mx, top + 1.85, -1.0, true).scale.set(0.05, 3.7, 0.05);
    const boom = add(this.geo.pile, m.timber, mx + 0.6, top + 1.45, -1.0);
    boom.scale.set(0.03, 1.2, 0.03);
    boom.rotation.z = 1.1;
    add(this.geo.ball, m.masthead, mx, top + 3.74, -1.0).scale.setScalar(0.05);
    add(this.geo.unitBox, m.lamp, mx, top + 2.3, -0.86).scale.set(0.13, 0.19, 0.13);
    world.fixtures.push({ x: wx(mx), y: top + 2.3, z: -0.5, color: 0xffb05a, intensity: 6, distance: 8, flicker: true });
    // paper lanterns strung from the masthead to a post at the stern
    add(this.geo.pile, m.timber, 0.35, top + 1.0, -1.0).scale.set(0.035, 2.0, 0.035);
    const pts = sag(0.35, top + 2.0, mx, top + 3.7, -1.0, 0.15, 10);
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.008, 4), m.rope, 0, 0, 0);
    for (let i = 2; i < 10; i += 2) {
      const p = pts[i];
      add(this.geo.lantern, m.paper[Math.floor(rng() * m.paper.length)], p.x, p.y - 0.2, p.z).scale.set(0.7, 0.9, 0.7);
    }
    // gear at the back of the deck: a heap of nets, a fish box or two
    const nx = L * 0.68;
    const heap = add(this.geo.lump, m.net, nx, top + 0.08, -0.98);
    heap.scale.set(0.45, 0.18, 0.3);
    heap.rotation.y = rng();
    for (let i = 0; i < 2; i++) {
      add(boxWorldUV(0.5, 0.24, 0.36, 1), m.crate, mx + 0.75 + i * 0.58, top + 0.12, -1.05).rotation.y = (rng() - 0.5) * 0.3;
    }
    this.boats.push({ x0, x1, top, nets: wx(nx) });
  },

  /** A tarred fish shed on a stone footing in the water; the walk runs over its roof. */
  shed(world, { x0, x1, top }) {
    const { scene, rng } = world;
    const m = this.m;
    const foot = WATER_Y + 0.4;
    // a long roof is a row of sheds
    let a = x0;
    while (a < x1 - 0.01) {
      let b = x1 - a > 12 ? a + 6 + rng() * 5 : x1;
      if (x1 - b < 4) b = x1;
      const len = b - a;
      const cx = (a + b) / 2;
      const h = top - 0.2 - foot;
      const body = new THREE.Mesh(boxWorldUV(len, h, SHED_D, 2), m.sheds[Math.floor(rng() * m.sheds.length)]);
      body.position.set(cx, foot + h / 2, 0);
      body.receiveShadow = true;
      scene.add(body);
      for (const x of [a + 0.06, b - 0.06]) {
        const post = new THREE.Mesh(this.geo.unitBox, m.timber);
        post.scale.set(0.12, h, 0.06);
        post.position.set(x, foot + h / 2, SHED_D / 2 + 0.03);
        scene.add(post);
      }
      // a big door down to the water with a lamp over it, windows under the eaves
      const front = SHED_D / 2;
      const dx = len > 4 ? cx + (rng() - 0.5) * (len - 3.5) : cx;
      const door = new THREE.Mesh(this.geo.unitBox, m.dark);
      door.scale.set(Math.min(1.5, len - 1), 1.5, 0.04);
      door.position.set(dx, foot + 0.75, front + 0.01);
      scene.add(door);
      const lintel = new THREE.Mesh(this.geo.unitBox, m.timber);
      lintel.scale.set(Math.min(1.75, len - 0.6), 0.14, 0.08);
      lintel.position.set(dx, foot + 1.55, front + 0.04);
      scene.add(lintel);
      const lamp = new THREE.Mesh(this.geo.unitBox, m.lamp);
      lamp.scale.set(0.14, 0.18, 0.14);
      lamp.position.set(dx, foot + 1.78, front + 0.12);
      scene.add(lamp);
      world.fixtures.push({ x: dx, y: foot + 1.8, z: front + 0.7, color: 0xffb46a, intensity: 6, distance: 7, flicker: true });
      for (let wx = a + 0.9 + rng() * 0.6; wx < b - 0.6; wx += 1.6 + rng() * 1.4) {
        if (Math.abs(wx - dx) < 1.1) continue;
        this.windows.push({ x: wx, y: Math.max(foot + 1.25, top - 0.85), z: front + 0.012, lit: rng() < 0.55 });
      }
      a = b;
    }
    const base = new THREE.Mesh(boxWorldUV(x1 - x0, 1.4, SHED_D + 0.2, 2), m.stone);
    base.position.set((x0 + x1) / 2, foot - 0.7, 0);
    scene.add(base);
    // a tarred roof
    const roof = new THREE.Mesh(boxWorldUV(x1 - x0 + 0.3, 0.2, SHED_D + 0.5, 1.2), m.tar);
    roof.position.set((x0 + x1) / 2, top - 0.1, 0);
    roof.receiveShadow = roof.castShadow = true;
    scene.add(roof);
    // a pale board along the edge of the roof, where the walk ends
    const fascia = new THREE.Mesh(this.geo.unitBox, m.trim);
    fascia.scale.set(x1 - x0 + 0.32, 0.12, 0.05);
    fascia.position.set((x0 + x1) / 2, top - 0.08, SHED_D / 2 + 0.27);
    scene.add(fascia);
    // a stovepipe at the back of the roof, and on the first shed a fish weathervane
    const px = x0 + (x1 - x0) * (0.6 + rng() * 0.25);
    const pipe = new THREE.Mesh(this.geo.pile, m.iron);
    pipe.scale.set(0.07, 0.9, 0.07);
    pipe.position.set(px, top + 0.45, -1.3);
    pipe.castShadow = true;
    scene.add(pipe);
    if (!this.vaned) {
      this.vaned = true;
      const vx = x0 + 1.4;
      const rod = new THREE.Mesh(this.geo.pile, m.iron);
      rod.scale.set(0.02, 1.7, 0.02);
      rod.position.set(vx, top + 0.85, -1.35);
      scene.add(rod);
      const fish = new THREE.Mesh(this.geo.fish, m.brass);
      fish.scale.setScalar(3.2);
      fish.position.set(vx, top + 1.75, -1.35);
      scene.add(fish);
      this.vanes.push({ fish, ph: rng() * 6.28 });
    }
  },

  /** Across the bay: a town climbing its hill, lights along the water; hills behind. */
  buildFarShore(world) {
    const { scene, level, rng } = world;
    const from = -70;
    const to = level.endX + 130;
    const col = new THREE.Color();
    const shore = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, fog: false, ...o });
    const row = (zc, depth, wMin, wMax, base, eMin, eMax, dim, glow) => {
      const body = new Mesher();
      const fronts = new Mesher();
      const roofs = new Mesher();
      const half = depth / 2;
      // the terrace the row stands on
      col.setRGB(0.05, 0.05, 0.06);
      if (base > WATER_Y) body.quad([from, WATER_Y, zc + half + 0.4], [to, WATER_Y, zc + half + 0.4], [to, base, zc + half + 0.4], [from, base, zc + half + 0.4], col);
      let x = from;
      while (x < to) {
        const w = wMin + rng() * (wMax - wMin);
        const eave = eMin + rng() * (eMax - eMin);
        const rh = half * (0.55 + rng() * 0.3);
        const ridge = eave + rh;
        const x0 = x;
        const x1 = x + w;
        col.setHex(WALLS[Math.floor(rng() * WALLS.length)]).multiplyScalar(dim * (0.8 + rng() * 0.25));
        body.box(x0, x1, base, eave, zc - half, zc + half, col);
        body.tri([x0, eave, zc - half], [x0, eave, zc + half], [x0, ridge, zc], col);
        body.tri([x1, eave, zc + half], [x1, eave, zc - half], [x1, ridge, zc], col);
        // the façade: a block of window cells from the atlas
        const yTop = eave - 0.2;
        const rows = Math.max(1, Math.min(4, Math.round((yTop - base - 0.3) / 1.0)));
        const cols = Math.max(2, Math.round((w - 0.3) / 1.0));
        const c0 = Math.floor(rng() * (ATLAS.cols - cols));
        const r0 = Math.floor(rng() * (ATLAS.rows - rows));
        const uv = [c0 / ATLAS.cols, r0 / ATLAS.rows, (c0 + cols) / ATLAS.cols, r0 / ATLAS.rows, (c0 + cols) / ATLAS.cols, (r0 + rows) / ATLAS.rows, c0 / ATLAS.cols, (r0 + rows) / ATLAS.rows];
        const fz = zc + half + 0.01;
        const yb = yTop - rows * 1.0;
        fronts.quad([x0 + 0.15, yb, fz], [x1 - 0.15, yb, fz], [x1 - 0.15, yTop, fz], [x0 + 0.15, yTop, fz], col, uv);
        // terracotta or slate, a little overhang
        const roof = col.clone().setHex(rng() < 0.6 ? 0x8a4632 : 0x3a3e4a).multiplyScalar(dim);
        const xa = x0 - 0.18;
        const xb = x1 + 0.18;
        const ye = eave - (0.25 * rh) / half;
        roofs.quad([xa, ye, zc + half + 0.25], [xb, ye, zc + half + 0.25], [xb, ridge, zc], [xa, ridge, zc], roof);
        roofs.quad([xb, ye, zc - half - 0.25], [xa, ye, zc - half - 0.25], [xa, ridge, zc], [xb, ridge, zc], roof);
        x += w + 0.1 + rng() * 1.4;
      }
      scene.add(new THREE.Mesh(body.build(), shore()));
      scene.add(
        new THREE.Mesh(
          fronts.build(),
          shore({ map: this.tex.town.map, emissiveMap: this.tex.town.emissiveMap, emissive: 0xffffff, emissiveIntensity: glow, roughness: 0.9 })
        )
      );
      scene.add(new THREE.Mesh(roofs.build(), shore({ roughness: 0.85 })));
    };
    row(-55, 3.6, 3, 6, WATER_Y, -0.6, 1.2, 0.5, 1.0); // the waterfront
    row(-60, 4, 3.5, 7, 0.2, 1.8, 3.2, 0.4, 0.85);
    row(-65, 4.4, 4, 8, 1.6, 3.0, 4.4, 0.32, 0.7);

    // the hill behind the town and the headlands beyond
    const range = (z, base, amp, step, topCol, darkCol) => {
      const ph = rng() * 10;
      const ph2 = rng() * 10;
      const pos = [];
      const cols = [];
      const idx = [];
      const top = new THREE.Color(topCol);
      const dark = new THREE.Color(darkCol);
      let i = 0;
      for (let x = from - 60; x <= to + 60; x += step) {
        const y = base + amp * (0.55 + 0.45 * Math.sin(x * 0.023 + ph)) * (0.6 + 0.4 * Math.sin(x * 0.071 + ph2));
        pos.push(x, y, z, x, -30, z);
        cols.push(top.r, top.g, top.b, dark.r, dark.g, dark.b);
        if (i > 0) {
          const a = (i - 1) * 2;
          idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
        }
        i++;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      geo.setIndex(idx);
      scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
    };
    range(-82, 1.0, 4.0, 6, 0x182030, 0x080b12);
    range(-70, 2.6, 2.6, 4, 0x101a1c, 0x060a0c);

    // festival lights strung along the waterfront, doubled in the water
    const n = Math.floor((to - from) / 0.6);
    const pos = new Float32Array(n * 3);
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = from + i * 0.6;
      pos[i * 3] = x;
      pos[i * 3 + 1] = WATER_Y + 1.15 - 0.22 * Math.abs(Math.sin((x / 6) * Math.PI));
      pos[i * 3 + 2] = -52.9;
      col.setHex(PAPER[Math.floor(rng() * PAPER.length)]).multiplyScalar(0.8 + rng() * 0.6);
      cols.set([col.r, col.g, col.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    scene.add(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({ size: 0.42, map: world.tex.glow, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
      )
    );
  },

  /**
   * The world's stars are packed low so they show over the hills in a wide view;
   * a fainter field fills the sky above them for tall (portrait) screens.
   */
  buildHighStars(world) {
    const { rng } = world;
    const n = 500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rng() - 0.5) * 380;
      pos[i * 3 + 1] = 20 + rng() * 80;
      pos[i * 3 + 2] = -93;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    world.sky.add(
      new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.45, color: 0xb8c0d8, transparent: true, opacity: 0.6, fog: false, depthWrite: false }))
    );
  },

  /** A lighthouse on a rock at the harbour mouth, its beam sweeping round over the water. */
  buildLighthouse(world, S) {
    const { scene, level, tex } = world;
    const m = this.m;
    const x = Math.round(level.goalX * 0.58);
    const z = -36;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    const rock = new THREE.Mesh(this.geo.lump, m.rock);
    rock.scale.set(4.5, 2.2, 3.2);
    rock.position.y = WATER_Y - 0.6;
    g.add(rock);
    // a tapering tower in red and white bands
    const y0 = WATER_Y + 1.2;
    const bands = 5;
    const bh = 5.4 / bands;
    for (let i = 0; i < bands; i++) {
      const r0 = 0.95 - (i / bands) * 0.3;
      const r1 = 0.95 - ((i + 1) / bands) * 0.3;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, bh, 16), i % 2 ? m.red : m.white);
      band.position.y = y0 + bh * (i + 0.5);
      g.add(band);
    }
    const top = y0 + 5.4;
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 16), m.iron);
    gallery.position.y = top + 0.05;
    g.add(gallery);
    const room = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.7, 12), m.lens);
    room.position.y = top + 0.45;
    g.add(room);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.red);
    dome.position.y = top + 0.8;
    g.add(dome);
    // two beams back to back; the lamp flares when one swings round to face the camera
    const pivot = new THREE.Group();
    pivot.position.y = top + 0.45;
    g.add(pivot);
    const beamMat = new THREE.MeshBasicMaterial({
      map: tex.beam,
      color: 0xfff0c8,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    const cone = new THREE.CylinderGeometry(0.2, 2.2, 30, 18, 1, true);
    cone.translate(0, -15, 0);
    cone.rotateZ(Math.PI / 2);
    for (const a of [0, Math.PI]) {
      const beam = new THREE.Mesh(cone, beamMat);
      beam.rotation.y = a;
      pivot.add(beam);
    }
    const flare = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex.glow, color: 0xfff2d0, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    flare.position.y = top + 0.45;
    flare.scale.set(6, 6, 1);
    g.add(flare);
    S.lighthouse = { pivot, flare, x, y: top + 0.45, z };
  },

  /** Boats moored out in the bay, rocking on the swell, their mast lights doubled in the water. */
  buildBay(world, S) {
    const { scene, level, rng, tex } = world;
    const m = this.m;
    const glow = new THREE.SpriteMaterial({ map: tex.glow, color: 0xfff0d8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let x = -24; x < level.endX + 50; x += 11 + rng() * 14) {
      const L = 5 + rng() * 4;
      const beam = 1.9 + rng() * 0.5;
      const z = -6.5 - rng() * 15;
      const g = new THREE.Group();
      const add = (geo, mat, px, py, pz) => {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(px, py, pz);
        g.add(mesh);
        return mesh;
      };
      const deck = 0.8;
      add(hullGeometry(L, beam, deck, -0.6, HULLS[Math.floor(rng() * HULLS.length)], 0), m.hull, 0, 0, 0).translateX(-L / 2);
      // a wheelhouse aft with a lit window, a mast forward with its lights
      const wx = -L * 0.18;
      add(this.geo.unitBox, m.cabin, wx, deck + 0.42, 0).scale.set(L * 0.22, 0.85, beam * 0.55);
      add(this.geo.unitBox, m.timber, wx, deck + 0.88, 0).scale.set(L * 0.26, 0.08, beam * 0.62);
      add(this.geo.unitPlane, m.paneLit, wx, deck + 0.55, beam * 0.276).scale.set(L * 0.14, 0.3, 1);
      const mh = 2.6 + rng() * 1.6;
      add(this.geo.pile, m.timber, L * 0.08, deck + mh / 2, 0).scale.set(0.045, mh, 0.045);
      add(this.geo.ball, m.masthead, L * 0.08, deck + mh, 0).scale.setScalar(0.06);
      const halo = new THREE.Sprite(glow);
      halo.position.set(L * 0.08, deck + mh, 0);
      halo.scale.set(0.9, 0.9, 1);
      g.add(halo);
      add(this.geo.ball, m.port, L * 0.1, deck + 0.95, -0.2).scale.setScalar(0.04);
      add(this.geo.ball, m.starboard, L * 0.1, deck + 0.95, 0.2).scale.setScalar(0.04);
      g.position.set(x, WATER_Y, z);
      g.rotation.y = (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.4;
      scene.add(g);
      S.bay.push({ g, x, ph: rng() * 6.28 });
    }
  },

  /** The harbour cats, and at home a friend waiting by a bowl of fish. */
  buildCats(world, S) {
    const { scene, level, rng } = world;
    const pls = level.platforms.filter((pl) => !pl.brittle);
    const cats = (S.cats = new SceneryCats(scene, rng));
    const add = (coat, pose, x, y, z, yaw, scale = 1, patches) => {
      cats.add(coat, pose, x, y, z, yaw, { scale, patches });
      this.taken.push(x);
    };
    // a ginger cat sees the night cat off from the first quay
    add('ginger', 'sit', 6.4, 0, -1.2, -0.5);
    // a white cat asleep on the nets of the second boat
    const nap = this.boats[1];
    if (nap) add('white', 'loaf', nap.nets, nap.top + 0.2, -0.98, 0.3);
    // a grey cat on the first shed roof, watching the fireworks
    const shed = pls.find((pl) => pl.top >= 1.5);
    if (shed) add('grey', 'sit', shed.x0 + 3.4, shed.top, -1.25, Math.PI / 2 - 0.4);
    // a mother and her kittens in a fish basket on a quay halfway along
    const mid = pls.find((pl) => pl.x0 > level.goalX * 0.42 && pl.top < 1.5 && pl.x1 - pl.x0 >= 14 && !level.hangers.some((h) => Math.abs(h.x - pl.x0 - 3) < 2));
    if (mid) {
      const bx = mid.x0 + 3;
      const basket = new THREE.Mesh(this.geo.basket, this.m.wicker);
      basket.position.set(bx, mid.top, -1.2);
      basket.castShadow = true;
      scene.add(basket);
      add('cream', 'loaf', bx, mid.top + 0.04, -1.2, -0.2, 0.95);
      add('cream', 'sit', bx + 0.5, mid.top, -1.0, -0.9, 0.5);
      add('tabby', 'sit', bx - 0.5, mid.top, -1.05, -0.3, 0.55);
    }
    // a tabby keeping watch on a boat further on
    const late = this.boats.find((bt) => bt.x0 > level.goalX * 0.75);
    if (late) add('tabby', 'sit', late.nets, late.top + 0.2, -0.98, -0.8);
    // home: a friend waits by a bowl of fish
    if (this.home) {
      const { x, top } = this.home;
      add('white', 'sit', x + 9.3, top, -0.55, Math.PI, 1, [
        ['body', 0xd8802e, 0.13, 0.1, 0.12, -0.08, 0.24, 0.06],
        ['body', 0x1c1a20, 0.09, 0.07, 0.1, -0.12, 0.12, -0.08],
        ['head', 0x1c1a20, 0.07, 0.05, 0.08, -0.02, 0.06, 0.05],
      ]);
      const bowl = new THREE.Mesh(this.geo.bowl, this.m.bowl);
      bowl.position.set(x + 8.6, top, -0.85);
      bowl.castShadow = true;
      scene.add(bowl);
      for (let i = 0; i < 2; i++) {
        const f = new THREE.Mesh(this.geo.fish, this.m.fish);
        f.position.set(x + 8.55 + i * 0.1, top + 0.11, -0.85 + (i - 0.5) * 0.08);
        f.rotation.set(0.4, i * 2.2, 0.3);
        scene.add(f);
      }
    }
  },

  /** Iron lamps along the back of the quays, and now and then a string of paper lanterns between two of them. */
  buildLamps(world, S) {
    const { scene, level, rng, tex } = world;
    const m = this.m;
    const glowMat = new THREE.SpriteMaterial({ map: tex.glow, color: 0xffb466, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    const postGeo = new THREE.CylinderGeometry(0.045, 0.065, 2.3, 8);
    const busy = (x) =>
      level.hangers.some((h) => Math.abs(h.x - x) < 1.6) ||
      level.checkpoints.some((cp) => Math.abs(cp.x - x) < 1.3) ||
      this.taken.some((t) => Math.abs(t - x) < 1.2) ||
      x > level.goalX - 2.5;
    for (const pl of level.platforms) {
      if (pl.brittle || pl.top >= 1.5 || pl.x1 - pl.x0 < 10) continue;
      let prev = null;
      for (let x = pl.x0 + 2 + rng() * 3; x < pl.x1 - 1.5; x += 10 + rng() * 4) {
        if (busy(x)) continue;
        const z = -1.12;
        const g = new THREE.Group();
        g.position.set(x, pl.top, z);
        const post = new THREE.Mesh(postGeo, m.iron);
        post.position.y = 1.15;
        post.castShadow = true;
        g.add(post);
        const head = new THREE.Mesh(this.geo.unitBox, m.lamp);
        head.scale.set(0.2, 0.28, 0.2);
        head.position.y = 2.42;
        g.add(head);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 4), m.iron);
        cap.rotation.y = Math.PI / 4;
        cap.position.y = 2.63;
        g.add(cap);
        const glow = new THREE.Sprite(glowMat.clone());
        glow.position.y = 2.42;
        glow.scale.set(2.2, 2.2, 1);
        g.add(glow);
        scene.add(g);
        world.fixtures.push({ x, y: pl.top + 2.4, z: z + 0.4, color: 0xffc27a, intensity: 10, distance: 9, flicker: true });
        S.lamps.push({ x, glow });
        if (prev !== null && x - prev < 15 && rng() < 0.75) this.lanternString(world, S, prev, x, pl.top + 2.75, z);
        prev = x;
      }
    }
  },

  /** Paper lanterns strung between two lamps, high over the walk. */
  lanternString(world, S, xa, xb, y, z) {
    const { scene, rng } = world;
    const m = this.m;
    const pts = sag(xa, y, xb, y, z, 0.45, 16);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.01, 4), m.rope));
    const items = [];
    const n = Math.max(3, Math.floor((xb - xa) / 1.4));
    for (let i = 1; i <= n; i++) {
      const u = i / (n + 1);
      const p = pts[Math.round(u * 16)];
      const pivot = new THREE.Group();
      pivot.position.copy(p);
      const lan = new THREE.Mesh(this.geo.lantern, m.festoon[Math.floor(rng() * m.festoon.length)]);
      lan.scale.set(1, 1.3, 1);
      lan.position.y = -0.24;
      pivot.add(lan);
      g.add(pivot);
      items.push({ pivot, ph: rng() * 6.28 });
    }
    scene.add(g);
    world.fixtures.push({ x: (xa + xb) / 2, y: y - 0.6, z: z + 0.3, color: 0xff8a50, intensity: 6, distance: 8 });
    S.strings.push({ x: (xa + xb) / 2, items });
  },

  /** Paper lanterns set afloat on the water, drifting out on the tide. */
  buildFloaters(world, S, n) {
    const { scene, rng, tex } = world;
    const paper = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), this.m.floater, n);
    const raft = new THREE.InstancedMesh(new THREE.BoxGeometry(0.26, 0.04, 0.26), this.m.timber, n);
    const pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const halo = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.9, map: tex.glow, color: 0xffa860, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push({ x: (rng() - 0.5) * 64, z: -2.9 - rng() * 12, v: 0.12 + rng() * 0.2, ph: rng() * 6.28 });
    }
    for (const o of [paper, raft, halo]) {
      o.frustumCulled = false;
      scene.add(o);
    }
    S.floaters = { paper, raft, halo, items, n };
  },

  /** Piles, rings, tyres, bollards and windows collected while building: one instanced mesh each. */
  buildInstanced(world) {
    const { scene } = world;
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const inst = (geo, material, list, set) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((it, i) => {
        s.set(1, 1, 1);
        set(it);
        mesh.setMatrixAt(i, mat.compose(p, q, s));
      });
      mesh.receiveShadow = true;
      scene.add(mesh);
    };
    inst(this.geo.pile, this.m.pile, this.piles, (it) => {
      p.set(it.x, (it.y0 + it.y1) / 2, it.z);
      s.set(it.r, it.y1 - it.y0, it.r);
    });
    inst(this.geo.ring, this.m.iron, this.rings, (it) => p.set(it.x, it.y, MOLE / 2 + 0.03));
    inst(this.geo.tyre, this.m.rubber, this.tyres, (it) => p.set(it.x, it.y, MOLE / 2 + 0.1));
    inst(this.geo.bollard, this.m.iron, this.bollards, (it) => {
      p.set(it.x, it.y, it.z);
      s.set(0.7, 0.7, 0.7);
    });
    const pane = new THREE.PlaneGeometry(0.62, 0.82);
    inst(pane, this.m.paneLit, this.windows.filter((w) => w.lit), (w) => p.set(w.x, w.y, w.z));
    inst(pane, this.m.paneDark, this.windows.filter((w) => !w.lit), (w) => p.set(w.x, w.y, w.z));
  },

  /** Lanterns and drying fish swing when the cat brushes past or slides under. */
  onPass(o) {
    const s = this.swings.find((sw) => Math.abs(sw.x - o.x) < 0.01);
    if (s) {
      s.kick = 1;
      s.age = 0;
    }
  },

  update(world, dt, t, catX, camX) {
    const S = world.themeState;
    S.water.material.uniforms.time.value += dt * 0.4;

    // boats in the bay rock on the swell
    for (const b of S.bay) {
      if (Math.abs(b.x - camX) > 48) continue;
      b.g.position.y = WATER_Y + 0.06 * Math.sin(t * 0.9 + b.ph);
      b.g.rotation.x = 0.035 * Math.sin(t * 0.7 + b.ph * 1.3);
      b.g.rotation.z = 0.02 * Math.sin(t * 0.55 + b.ph * 0.7);
    }

    for (const l of S.lamps) {
      if (Math.abs(l.x - catX) > 40) continue;
      l.glow.material.opacity = 0.6 * (1 + 0.08 * Math.sin(t * 9 + l.x) * Math.sin(t * 2.9 + l.x));
    }
    for (const s of S.strings) {
      if (Math.abs(s.x - camX) > 40) continue;
      for (const it of s.items) {
        it.pivot.rotation.z = 0.07 * Math.sin(t * 1.3 + it.ph);
        it.pivot.rotation.x = 0.05 * Math.sin(t * 0.9 + it.ph * 1.7);
      }
    }
    // what hangs over the walk sways, and swings when the cat goes by
    for (const s of this.swings) {
      s.age += dt;
      s.kick *= Math.exp(-dt * 1.4);
      s.g.rotation.x = 0.04 * Math.sin(t * 1.2 + s.ph) + s.kick * 0.32 * Math.sin(s.age * 6.5);
    }
    for (const v of this.vanes) v.fish.rotation.y = 0.9 * Math.sin(t * 0.25 + v.ph) + 0.15 * Math.sin(t * 1.3 + v.ph);

    // the lighthouse beam sweeps round; the lamp flares as it faces the camera
    const L = S.lighthouse;
    L.pivot.rotation.y = t * 0.5;
    const a = L.pivot.rotation.y;
    const cam = world.camera.position;
    const vx = cam.x - L.x;
    const vz = cam.z - L.z;
    const facing = Math.abs((Math.cos(a) * vx - Math.sin(a) * vz) / Math.hypot(vx, vz));
    L.flare.material.opacity = 0.25 + 0.75 * Math.pow(facing, 24);

    // the harbour light blinks green at the end of the quay
    this.m.beacon.emissiveIntensity = (t % 2.4) < 0.7 ? 3.2 : 0.2;

    // floating lanterns drift on the tide around the camera
    const F = S.floaters;
    const hp = F.halo.geometry.attributes.position.array;
    for (let i = 0; i < F.n; i++) {
      const f = F.items[i];
      f.x += f.v * dt;
      if (f.x - camX > 32) f.x -= 64;
      else if (camX - f.x > 32) f.x += 64;
      const y = WATER_Y + 0.02 + 0.03 * Math.sin(t * 1.2 + f.ph);
      _mat.makeRotationY(f.ph + t * 0.05).setPosition(f.x, y + 0.12, f.z);
      F.paper.setMatrixAt(i, _mat);
      _mat.setPosition(f.x, y, f.z);
      F.raft.setMatrixAt(i, _mat);
      hp[i * 3] = f.x;
      hp[i * 3 + 1] = y + 0.14;
      hp[i * 3 + 2] = f.z;
    }
    F.paper.instanceMatrix.needsUpdate = true;
    F.raft.instanceMatrix.needsUpdate = true;
    F.halo.geometry.attributes.position.needsUpdate = true;

    // the harbour cats: sitters watch the night cat go by (and otherwise the fireworks), sleepers breathe
    S.cats.update(dt, t, catX, camX);

    // fireworks, aimed where the view will be when they burst, and a volley when the cat gets home
    if (dt > 0) {
      S.camV = damp(S.camV, clamp((camX - S.camX) / dt, -20, 20), 2, dt);
      S.camX = camX;
    }
    const goal = world.level.goalX;
    if (!S.finale && catX >= goal) {
      S.finale = true;
      S.fw.finale(goal);
    } else if (S.finale && catX < goal - 2) S.finale = false;
    S.fw.update(dt, camX, S.camV * 1.4);
  },

  dispose(world) {
    const S = world.themeState;
    // Water keeps its render target private; releasing the mirror texture frees the GPU memory.
    if (S?.water) S.water.material.uniforms.mirrorSampler.value.dispose();
  },
};
