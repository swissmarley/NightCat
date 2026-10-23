// Stage V dressing: a botanical garden on a spring night. The walk runs along
// brick terrace walls, over clipped hedges and up onto the glass ridges of the
// glasshouses — watering cans, stacks of flowerpots, wheelbarrows, a gnome and a
// bird bath to jump, wisteria, hanging baskets and wind chimes to slide under,
// old plank bridges over the beds that give way. Behind it: a lily pond with
// frogs, blossom trees dropping petals, a palm house glowing across the water.
// Cats nap in flowerpots and on the hedges, and at home a family waits.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SceneryCats } from './cats.js';
import {
  brickTexture,
  stoneTexture,
  hedgeTexture,
  lawnTexture,
  gravelTexture,
  woodTexture,
  plasterTexture,
  petalTexture,
  conservatoryTexture,
  windowPaneTexture,
  waterNormalsTexture,
  boxWorldUV,
} from '../textures.js';

const GROUND_Y = -2.4; // the lawns, beds and paths below the walk
const TERRACE = 2.6; // depth of a terrace wall
const HEDGE = 2.2; // depth of a clipped hedge
const HALF = 1.45; // half a glasshouse's depth: the eaves sit at z = ±HALF
const ROOF_H = 0.85; // a glasshouse ridge's height above its eaves
const KNEE = GROUND_Y + 0.75; // top of the low brick wall a glasshouse stands on
const POND = { near: -5.4, far: -21, y: GROUND_Y - 0.25 };
const PALM_Z = -31; // the palm house across the pond
/** How far a glasshouse roof sits below its ridge at depth z. */
const roofDrop = (z) => (ROOF_H * Math.min(Math.abs(z), HALF)) / HALF;
const BLOSSOM = [0xffd6e4, 0xffc2d6, 0xfff0f4, 0xf6b6cc];
const BLOOMS = [0xe8384a, 0xf6c344, 0xf07aa0, 0xfff2e0, 0xb04ad0, 0xff8a3a];
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/** A flat four-cornered face, a→b→c→d counter-clockwise from the side it faces. */
function quadGeometry(a, b, c, d) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  geo.computeVertexNormals();
  return geo;
}

/** A line of points sagging between two ends (for ropes and garlands). */
function sag(x0, y0, x1, y1, z, drop, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - drop * Math.sin(u * Math.PI), z));
  }
  return pts;
}

export const gardenTheme = {
  key: 'garden',
  floorY: GROUND_Y,
  ambience: 'garden',
  hanging: new Set(['wisteria', 'basket', 'chimes']),
  cpSink: roofDrop(0.95), // on a glasshouse the lantern's pole reaches down to the glass
  fallFx: { sound: 'poof', color: 0xffd0e0 },
  colors: {
    bg: 0x070a12,
    fog: 0x0c1418,
    fogNear: 16,
    fogFar: 72,
    hemiSky: 0x3a4a68,
    hemiGround: 0x16200f,
    hemiInt: 1.25,
    moon: 0xd8dcf0,
    moonInt: 2.4,
    moonPos: [26, 6.2, -92],
    moonSize: 2.6,
    moonHalo: 0xe8ecff,
    skyTop: [0.006, 0.01, 0.028],
    skyMid: [0.02, 0.034, 0.07],
    skyHor: [0.05, 0.07, 0.09],
    starCount: 600,
    starRange: [3, 22], // low enough to show over the trees across the pond
    fill: 0xb8c8ff,
    puff: 0xc8d0c0,
    spark: 0xd6ff8a,
    cp: 0xffc070,
  },

  makeTextures(rng) {
    return {
      brick: brickTexture(rng),
      stone: stoneTexture(rng),
      hedge: hedgeTexture(rng),
      lawn: lawnTexture(rng),
      gravel: gravelTexture(rng),
      wood: woodTexture(rng),
      plaster: plasterTexture(rng),
      petal: petalTexture(),
      conservatory: conservatoryTexture(rng),
      paneLit: windowPaneTexture(true),
      waterNormals: waterNormalsTexture(rng),
    };
  },

  init(tex) {
    this.tex = tex;
    // filled while the level is built, used when the world is dressed
    this.bars = []; // glazing bars, as matrices
    this.plants = []; // leafy clumps inside the glasshouses, as matrices + colours
    this.pots = []; // flowerpots on the staging benches
    this.ivy = [];
    this.lumps = []; // the ragged edges of the hedges, as matrices
    this.trunks = []; // blossom tree trunks, as matrices
    this.blossoms = []; // their crowns, as [matrix, colour]
    this.leaves = []; // leaves on the rose arch and round the cottage door, as matrices
    this.roses = []; // and the flowers among them, as [matrix, colour]
    this.swings = [];
    this.lights = [];
    this.taken = [];
    this.home = null;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    // for flowers drawn many to a batch: the glow takes each one's instance colour too
    const tinted = (o) => {
      const mat = std({ color: 0xffffff, emissive: 0xffffff, ...o });
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif'
        );
      };
      return mat;
    };
    this.m = {
      brick: std({ map: tex.brick, color: 0xffe0d0, roughness: 0.85 }),
      coping: std({ map: tex.stone, color: 0xd8d0c4, roughness: 0.8 }),
      hedge: std({ map: tex.hedge, color: 0xc8e0b8, roughness: 0.95, emissive: 0x0a1a08, emissiveIntensity: 1 }),
      lawn: std({ map: tex.lawn, roughness: 1 }),
      gravel: std({ map: tex.gravel, color: 0xb0a898, roughness: 1 }),
      soil: std({ color: 0x241810, roughness: 1 }),
      // glass lit faintly from within; the bars and the interior do most of the drawing
      glass: std({
        color: 0xc8f0e0,
        transparent: true,
        opacity: 0.16,
        roughness: 0.1,
        emissive: 0x2a4a38,
        emissiveIntensity: 0.5,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
      frame: std({ color: 0xe8eae2, roughness: 0.5 }),
      ridge: std({ map: tex.wood, color: 0xf4f0e8, roughness: 0.6 }),
      interior: std({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex.conservatory, emissiveIntensity: 1.0, roughness: 1 }),
      bench: std({ map: tex.wood, color: 0x8a7a68, roughness: 0.9 }),
      plant: std({ color: 0xffffff, roughness: 0.9, flatShading: true }),
      leaf: std({ color: 0x2c5a2e, roughness: 0.9, flatShading: true }),
      terracotta: std({ color: 0xb85a3c, roughness: 0.85 }),
      galv: std({ color: 0x9aa4ac, roughness: 0.35, metalness: 0.7 }),
      wood: std({ map: tex.wood, roughness: 0.85 }),
      oldPlank: std({ map: tex.wood, color: 0xe0d6c6, roughness: 0.9 }),
      timber: std({ color: 0x3a2a1e, roughness: 0.85 }),
      iron: std({ color: 0x1e3428, roughness: 0.5, metalness: 0.5 }),
      stone: std({ color: 0xa8a296, roughness: 0.85 }),
      bark: std({ color: 0x3a2a22, roughness: 0.95 }),
      blossom: tinted({ roughness: 0.8, emissiveIntensity: 0.14, flatShading: true }),
      // the hanging things glow a little so they read against the dark
      wisteria: std({ color: 0xc0a0f0, roughness: 0.8, emissive: 0x7a58c0, emissiveIntensity: 0.45 }),
      bloom: tinted({ roughness: 0.8, emissiveIntensity: 0.35 }),
      moss: std({ color: 0x3a4a22, roughness: 1 }),
      brass: std({ color: 0xd8b060, roughness: 0.3, metalness: 0.7, emissive: 0x5a3a10, emissiveIntensity: 0.6 }),
      lamp: std({ color: 0x2a1406, emissive: 0xffd08a, emissiveIntensity: 3.0, roughness: 0.6 }),
      coat: std({ color: 0x2a5aa8, roughness: 0.7 }),
      hat: std({ color: 0xc8282a, roughness: 0.6 }),
      beard: std({ color: 0xf0eee8, roughness: 0.9 }),
      skin: std({ color: 0xf0b898, roughness: 0.7 }),
      plaster: std({ map: tex.plaster, color: 0xf2ece0, roughness: 0.9 }),
      slate: std({ color: 0x343840, roughness: 0.7 }),
      door: std({ color: 0x3a6a4a, roughness: 0.65 }),
      paneLit: std({ map: tex.paneLit, emissiveMap: tex.paneLit, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.8 }),
      pad: std({ color: 0x2c4c26, roughness: 0.8 }),
      lily: std({ color: 0xfff0f6, roughness: 0.6, emissive: 0xff9ac0, emissiveIntensity: 0.6 }),
      frog: std({ color: 0x4a7a2a, roughness: 0.55 }),
      frogEye: std({ color: 0x202010, emissive: 0xffe060, emissiveIntensity: 1.6 }),
      milk: std({ color: 0xf6f4ee, roughness: 0.3 }),
      wicker: std({ color: 0x9a7448, roughness: 0.9 }),
      cushion: std({ color: 0xa83a4a, roughness: 0.9 }),
    };
    const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    this.geo = {
      unitBox: new THREE.BoxGeometry(1, 1, 1),
      ball: new THREE.SphereGeometry(1, 12, 8),
      lump: new THREE.IcosahedronGeometry(1, 1),
      clump: new THREE.IcosahedronGeometry(1, 0),
      pole: new THREE.CylinderGeometry(1, 1, 1, 8),
      pot: lathe([[0.001, 0], [0.14, 0], [0.2, 0.3], [0.22, 0.3], [0.22, 0.36], [0.19, 0.36], [0.17, 0.08], [0.001, 0.08]], 14),
      benchPot: new THREE.CylinderGeometry(0.14, 0.105, 0.21, 8), // seen through glass: a plain one will do
      bigPot: lathe([[0.001, 0], [0.2, 0], [0.3, 0.42], [0.34, 0.44], [0.34, 0.5], [0.3, 0.5], [0.26, 0.1], [0.001, 0.1]], 16),
      bath: lathe([[0.001, 0], [0.24, 0], [0.24, 0.06], [0.1, 0.1], [0.08, 0.6], [0.14, 0.66], [0.34, 0.74], [0.36, 0.8], [0.3, 0.8], [0.001, 0.76]], 16),
      basket: lathe([[0.001, 0], [0.28, 0], [0.33, 0.06], [0.35, 0.18], [0.32, 0.19], [0.3, 0.07], [0.001, 0.07]], 16),
      saucer: lathe([[0.001, 0], [0.09, 0], [0.12, 0.025], [0.11, 0.03], [0.001, 0.02]], 14),
      raceme: new THREE.ConeGeometry(0.06, 1, 7).rotateX(Math.PI).translate(0, -0.5, 0), // hangs from y = 0 to a tip at y = -1
      tube: new THREE.CylinderGeometry(0.014, 0.014, 1, 6).translate(0, -0.5, 0),
      petal: new THREE.PlaneGeometry(0.09, 0.09),
    };
  },

  /** Platforms are dressed in dress(), once their neighbours are known. */
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
    let size;
    if (kind === 'pots') {
      // flowerpots stacked upside down, leaning a little, a seedling on top
      let y = 0;
      for (let i = 0; i < 4; i++) {
        const s = 1.25 - i * 0.08;
        const p = add(this.geo.pot, m.terracotta, (rng() - 0.5) * 0.04, y + 0.36 * s, 0);
        p.rotation.set(Math.PI + (rng() - 0.5) * 0.08, rng() * 3, (rng() - 0.5) * 0.08);
        p.scale.setScalar(s);
        y += 0.22;
      }
      add(this.geo.lump, m.leaf, 0, y + 0.15, 0).scale.set(0.1, 0.07, 0.1);
      size = { w: 0.6, h: 1.03 };
    } else if (kind === 'can') {
      // a watering can, its rose pointing down the walk
      add(this.geo.pole, m.galv, 0, 0.22, 0).scale.set(0.17, 0.44, 0.17);
      add(this.geo.ball, m.galv, 0, 0.44, 0).scale.set(0.17, 0.05, 0.17);
      const spout = add(this.geo.pole, m.galv, 0.25, 0.3, 0);
      spout.scale.set(0.025, 0.42, 0.025);
      spout.rotation.z = -0.95;
      add(this.geo.pole, m.galv, 0.42, 0.44, 0).scale.set(0.05, 0.03, 0.05);
      const handle = add(new THREE.TorusGeometry(0.13, 0.016, 6, 14, Math.PI), m.galv, -0.04, 0.44, 0);
      handle.rotation.z = 0.2;
      size = { w: 0.62, h: 0.52 };
    } else if (kind === 'barrow') {
      // a wheelbarrow of earth and seedlings
      const tray = add(new THREE.BoxGeometry(0.9, 0.3, 0.6), m.wood, 0.05, 0.42, 0);
      tray.rotation.z = 0.08;
      add(new THREE.BoxGeometry(0.84, 0.06, 0.54), m.soil, 0.05, 0.56, 0);
      for (let i = 0; i < 5; i++) add(this.geo.clump, m.leaf, -0.25 + i * 0.13, 0.62, (rng() - 0.5) * 0.3).scale.setScalar(0.06 + rng() * 0.03);
      add(new THREE.TorusGeometry(0.15, 0.04, 6, 14), m.timber, 0.52, 0.17, 0);
      for (const s of [-1, 1]) {
        const handle = add(this.geo.pole, m.timber, -0.55, 0.38, s * 0.26);
        handle.scale.set(0.022, 0.6, 0.022);
        handle.rotation.z = 1.25;
        add(this.geo.pole, m.timber, -0.25, 0.14, s * 0.24).scale.set(0.022, 0.28, 0.022);
      }
      size = { w: 1.3, h: 0.66 };
    } else if (kind === 'gnome') {
      // a garden gnome: boots, blue coat, white beard, red hat
      for (const s of [-1, 1]) add(this.geo.ball, m.timber, 0.03, 0.05, s * 0.07).scale.set(0.08, 0.05, 0.06);
      add(this.geo.ball, m.coat, 0, 0.26, 0).scale.set(0.17, 0.22, 0.16);
      add(this.geo.ball, m.skin, 0.02, 0.5, 0).scale.setScalar(0.1);
      add(new THREE.ConeGeometry(0.11, 0.26, 10), m.beard, 0.08, 0.38, 0).rotation.z = Math.PI;
      add(this.geo.ball, m.skin, 0.11, 0.5, 0).scale.setScalar(0.035);
      const hat = add(new THREE.ConeGeometry(0.12, 0.34, 12), m.hat, -0.01, 0.72, 0);
      hat.rotation.z = 0.15;
      size = { w: 0.42, h: 0.86 };
    } else if (kind === 'birdbath') {
      // a stone bird bath on a tall pedestal, water in the bowl
      add(this.geo.bath, m.stone, 0, 0, 0).scale.set(1, 1.25, 1);
      add(new THREE.CircleGeometry(0.31, 18).rotateX(-Math.PI / 2), m.glass, 0, 0.97, 0, false);
      size = { w: 0.72, h: 1.0 };
    } else {
      // vent: a little ventilator on a glasshouse ridge, glass on a white frame under a pitched cap
      add(new THREE.BoxGeometry(0.86, 0.56, 0.54), m.glass, 0, 0.28, 0, false);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) add(this.geo.unitBox, m.frame, sx * 0.42, 0.28, sz * 0.26).scale.set(0.05, 0.56, 0.05);
      }
      add(this.geo.unitBox, m.frame, 0, 0.57, 0).scale.set(0.92, 0.05, 0.6);
      for (const s of [-1, 1]) {
        const cap = add(this.geo.unitBox, m.frame, 0, 0.67, s * 0.15);
        cap.scale.set(0.98, 0.04, 0.38);
        cap.rotation.x = s * 0.55;
      }
      size = { w: 0.9, h: 0.78 };
    }
    group.add(g);
    return size;
  },

  buildHanging(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    // on a glasshouse ridge the posts reach down to the glass behind
    const sink = top >= 1.3 ? roofDrop(0.95) : 0;
    const post = (px, h) => {
      const p = new THREE.Mesh(this.geo.pole, m.iron);
      p.scale.set(0.035, h + sink, 0.035);
      p.position.set(px, (h - sink) / 2, -0.95);
      p.castShadow = true;
      g.add(p);
    };
    const arm = (px, y) => {
      const a = new THREE.Mesh(this.geo.pole, m.iron);
      a.scale.set(0.02, 0.92, 0.02);
      a.rotation.x = Math.PI / 2;
      a.position.set(px, y, -0.52);
      g.add(a);
    };
    // what hangs over the walk swings when the cat goes by
    const swing = new THREE.Group();
    g.add(swing);
    let size;
    if (kind === 'wisteria') {
      // a pergola beam over the walk, hung with wisteria
      const lineY = 1.2;
      for (const s of [-1, 1]) {
        post(s * 0.8, lineY + 0.1);
        arm(s * 0.8, lineY + 0.06);
      }
      const beam = new THREE.Mesh(this.geo.unitBox, m.timber);
      beam.scale.set(1.9, 0.1, 0.1);
      beam.position.set(0, lineY + 0.06, -0.08);
      g.add(beam);
      swing.position.set(0, lineY, -0.08);
      for (let i = 0; i < 7; i++) {
        const r = new THREE.Mesh(this.geo.raceme, m.wisteria);
        const len = 0.45 + rng() * 0.18;
        r.scale.set(1 + rng() * 0.3, len, 1 + rng() * 0.3);
        r.position.set(-0.48 + i * 0.16 + (rng() - 0.5) * 0.04, -0.02, (rng() - 0.5) * 0.12);
        r.castShadow = true;
        swing.add(r);
      }
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(this.geo.clump, m.leaf);
        leaf.scale.setScalar(0.08 + rng() * 0.04);
        leaf.position.set(-0.6 + i * 0.24, 0.02, (rng() - 0.5) * 0.2);
        swing.add(leaf);
      }
      size = { w: 1.15, clearance: 0.46, height: 1.04 };
    } else if (kind === 'basket') {
      // a hanging basket on a bracket, flowers trailing from it
      post(0, 1.54);
      arm(0, 1.5);
      swing.position.set(0, 1.46, -0.1);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const chain = new THREE.Mesh(this.geo.tube, m.iron);
        chain.scale.set(0.6, 0.42, 0.6);
        chain.position.set(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04);
        chain.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
        swing.add(chain);
      }
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.moss);
      bowl.position.y = -0.4;
      bowl.castShadow = true;
      swing.add(bowl);
      const flowers = new THREE.InstancedMesh(this.geo.clump, m.bloom, 14);
      const color = new THREE.Color();
      for (let i = 0; i < 14; i++) {
        const a = rng() * Math.PI * 2;
        const r = 0.12 + rng() * 0.14;
        const drop = rng() < 0.5 ? rng() * 0.3 : 0;
        flowers.setColorAt(i, color.setHex(BLOOMS[Math.floor(rng() * BLOOMS.length)]));
        flowers.setMatrixAt(i, _m.compose(_p.set(Math.cos(a) * r, -0.4 - drop, Math.sin(a) * r), _q.identity(), _s.setScalar(0.05 + rng() * 0.03)));
      }
      swing.add(flowers);
      size = { w: 0.8, clearance: 0.5, height: 1.04 };
    } else {
      // wind chimes on a bracket: they ring when the cat brushes past
      post(0, 1.62);
      arm(0, 1.58);
      swing.position.set(0, 1.56, -0.1);
      const cord = new THREE.Mesh(this.geo.tube, m.timber);
      cord.scale.set(0.4, 0.3, 0.4);
      swing.add(cord);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 14), m.wood);
      disc.position.y = -0.32;
      swing.add(disc);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const t = new THREE.Mesh(this.geo.tube, m.brass);
        t.scale.set(1.2, 0.36 + i * 0.05, 1.2);
        t.position.set(Math.cos(a) * 0.12, -0.36, Math.sin(a) * 0.12);
        t.castShadow = true;
        swing.add(t);
      }
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.01), m.wood);
      sail.position.y = -0.88;
      swing.add(sail);
      size = { w: 0.55, clearance: 0.5, height: 1.05 };
    }
    group.add(g);
    this.swings.push({ x, g: swing, kick: 0, age: 0, ph: rng() * 6.28, kind });
    this.lights.push({ x, y: top + 1.0, z: 0.9, color: 0xffd08a, intensity: 3, distance: 6 });
    return size;
  },

  /** Old planks laid across the beds on a light frame: the planks drop when they give way. */
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
    // the frame stands in the bed and stays when the planks go; a lantern hangs on it
    for (const x of [x0 + 0.25, x1 - 0.25]) {
      for (const z of [-0.85, 0.85]) {
        const leg = new THREE.Mesh(this.geo.pole, m.timber);
        leg.scale.set(0.07, top - 0.14 - GROUND_Y, 0.07);
        leg.position.set(x, (top - 0.14 + GROUND_Y) / 2, z);
        leg.castShadow = true;
        group.add(leg);
      }
    }
    const rail = new THREE.Mesh(boxWorldUV(len - 0.3, 0.1, 0.1, 1), m.timber);
    rail.position.set((x0 + x1) / 2, top - 0.18, -0.85);
    group.add(rail);
    const pole = new THREE.Mesh(this.geo.pole, m.timber);
    pole.scale.set(0.05, 1.5, 0.05);
    pole.position.set(x0 + 0.25, top + 0.55, -0.95);
    pole.castShadow = true;
    group.add(pole);
    const lamp = new THREE.Mesh(this.geo.unitBox, m.lamp);
    lamp.scale.set(0.13, 0.18, 0.13);
    lamp.position.set(x0 + 0.25, top + 1.2, -0.82);
    group.add(lamp);
    this.lights.push({ x: x0 + 1.2, y: top + 1.3, z: -0.2, color: 0xffc070, intensity: 7, distance: 8, flicker: true });
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
    // the gate: an arch of roses standing just behind the walk
    const back = -0.85;
    for (const s of [-1, 1]) add(this.geo.pole, m.iron, s * 1.15, top + 1.15, back, true).scale.set(0.05, 2.3, 0.05);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      pts.push(new THREE.Vector3(-1.15 * Math.cos(a), top + 2.3 + 0.8 * Math.sin(a), back));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    add(new THREE.TubeGeometry(curve, 30, 0.04, 6), m.iron, 0, 0, 0);
    const leaf = (x, y, z, r) => this.leaves.push(_m.compose(_p.set(gx + x, y, z), _q.identity(), _s.setScalar(r)).clone());
    const rose = (x, y, z, r, color) => this.roses.push([_m.compose(_p.set(gx + x, y, z), _q.identity(), _s.setScalar(r)).clone(), color]);
    for (let i = 0; i <= 26; i++) {
      const p = curve.getPointAt(i / 26);
      leaf(p.x + (rng() - 0.5) * 0.12, p.y + (rng() - 0.5) * 0.12, p.z + 0.05, 0.09 + rng() * 0.05);
      if (i % 2 === 0) rose(p.x, p.y, p.z + 0.14, 0.06 + rng() * 0.02, BLOOMS[[0, 2, 3][i % 3]]);
    }

    // home: the gardener's cottage on a terrace behind the walk
    const hx0 = 2.6;
    const hx1 = 11.0;
    const zc = -3.7;
    const half = 1.5;
    const eave = top + 2.5;
    const front = zc + half;
    add(boxWorldUV(13, top - 0.16 - GROUND_Y, 4.6, 2), m.brick, 7.0, (top - 0.16 + GROUND_Y) / 2, -3.6);
    add(boxWorldUV(13, 0.16, 4.6, 2), m.lawn, 7.0, top - 0.08, -3.6);
    add(boxWorldUV(hx1 - hx0, eave - top, half * 2, 2), m.plaster, (hx0 + hx1) / 2, (top + eave) / 2, zc);
    // a pitched slate roof over plaster gables
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
    // a green door with roses round it, a lit window with a box of flowers, a lamp, a bench
    add(this.geo.unitBox, m.door, hx0 + 1.6, top + 0.85, front + 0.04).scale.set(0.9, 1.7, 0.08);
    add(this.geo.unitBox, m.coping, hx0 + 1.6, top + 0.06, front + 0.25).scale.set(1.2, 0.12, 0.4);
    add(this.geo.ball, m.brass, hx0 + 1.9, top + 0.85, front + 0.1).scale.setScalar(0.035);
    for (let i = 0; i < 40; i++) {
      const a = (i / 39) * Math.PI;
      const rx = hx0 + 1.6 - Math.cos(a) * 0.68;
      const ry = top + 1.0 + Math.sin(a) * 1.0 + (a < 0.3 || a > 2.84 ? -rng() * 0.9 : 0);
      leaf(rx, ry, front + 0.1, 0.07 + rng() * 0.04);
      if (i % 2) rose(rx, ry, front + 0.16, 0.045 + rng() * 0.02, BLOOMS[[0, 2, 3][i % 3]]);
    }
    add(new THREE.PlaneGeometry(1.1, 1.0), m.paneLit, hx0 + 4.8, top + 1.45, front + 0.014);
    add(this.geo.unitBox, m.timber, hx0 + 4.8, top + 1.45, front + 0.004).scale.set(1.24, 1.14, 0.008);
    add(this.geo.unitBox, m.door, hx0 + 4.8, top + 0.86, front + 0.12).scale.set(1.25, 0.16, 0.24);
    for (let i = 0; i < 9; i++) rose(hx0 + 4.25 + i * 0.14, top + 0.98 + rng() * 0.05, front + 0.14 + (rng() - 0.5) * 0.08, 0.05, BLOOMS[i % 4]);
    add(this.geo.unitBox, m.lamp, hx0 + 0.75, top + 2.0, front + 0.14).scale.set(0.16, 0.22, 0.16);
    add(this.geo.unitBox, m.wood, hx0 + 6.9, top + 0.42, front + 0.42).scale.set(1.3, 0.07, 0.36);
    for (const s of [-1, 1]) add(this.geo.unitBox, m.timber, hx0 + 6.9 + s * 0.55, top + 0.2, front + 0.42).scale.set(0.07, 0.4, 0.3);
    for (const [px, s] of [
      [hx0 + 3.3, 1],
      [hx0 + 7.9, 0.8],
    ]) {
      add(this.geo.bigPot, m.terracotta, px, top, front + 0.4).scale.setScalar(s);
      for (let i = 0; i < 6; i++) {
        const [x, y, z] = [px + (rng() - 0.5) * 0.3 * s, top + 0.55 * s + rng() * 0.2, front + 0.4 + (rng() - 0.5) * 0.3];
        if (i % 2) leaf(x, y, z, 0.08 * s);
        else rose(x, y, z, 0.08 * s, BLOOMS[i % 4]);
      }
    }
    level.group.add(g);
    level.fixtures.push({ x: gx + hx0 + 4.8, y: top + 1.45, z: front + 0.9, color: 0xffc27a, intensity: 4.5, distance: 9 });
    level.fixtures.push({ x: gx, y: top + 2.4, z: 0, color: 0xffb0c0, intensity: 4, distance: 7 });
    level.fixtures.push({ x: gx + hx0 + 0.75, y: top + 2.0, z: front + 0.5, color: 0xffc070, intensity: 4, distance: 6, flicker: true });
  },

  // --- dressing ----------------------------------------------------------------
  dress(world) {
    const { quality } = world;
    const S = (world.themeState = {
      water: null,
      cats: null,
      lamps: [],
      frogs: [],
      petals: null,
      worms: null,
      moths: null,
      palm: null,
      finale: false,
    });
    this.buildGround(world);
    this.buildPond(world, S);
    this.buildPlatforms(world);
    this.buildFarBank(world, S);
    this.buildHighStars(world);
    this.buildCats(world, S);
    this.buildLamps(world, S);
    this.buildFrogs(world, S);
    this.buildPetals(world, S, Math.round(160 * quality.particles));
    this.buildWorms(world, S, Math.round(70 * quality.particles));
    this.buildMoths(world, S);
    this.buildInstanced(world);
    for (const l of this.lights) world.fixtures.push(l);
    // the pond's mirror camera sees layer 0 only: what sits in front of the pond can't be
    // reflected, so it goes on layer 1 and the mirror skips drawing it
    world.camera.layers.enable(1);
  },

  /** The lawn under everything, a gravel path behind the walk and a flower bed in front of it. */
  buildGround(world) {
    const { scene, level, rng } = world;
    const len = level.endX + 220;
    const x0 = -100;
    const strip = (mat, z0, z1, y, repeat) => {
      const map = mat.map.clone();
      map.needsUpdate = true;
      map.repeat.set(len / repeat, (z1 - z0) / repeat);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, z1 - z0), new THREE.MeshStandardMaterial({ map, color: mat.color, roughness: 1 }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x0 + len / 2, y, (z0 + z1) / 2);
      mesh.receiveShadow = true;
      scene.add(mesh);
    };
    // lawn on either side of the pond, gravel along the back of the walk
    strip(this.m.lawn, POND.near, 14, GROUND_Y, 2);
    strip(this.m.lawn, -70, POND.far, GROUND_Y, 2);
    strip(this.m.gravel, -3.1, -1.5, GROUND_Y + 0.01, 2);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.6), this.m.soil);
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(x0 + len / 2, GROUND_Y + 0.01, 2.7);
    bed.receiveShadow = true;
    scene.add(bed);
    // the bed: tulips, narcissi and little blooms
    const stems = [];
    const heads = [];
    _q.identity();
    for (let i = Math.floor(len * 1.6); i > 0; i--) {
      const x = x0 + rng() * len;
      const z = 1.6 + rng() * 2.4;
      const h = 0.25 + rng() * 0.3;
      stems.push(_m.compose(_p.set(x, GROUND_Y + h / 2, z), _q, _s.set(1.4, h, 1.4)).clone());
      const r = 0.05 + rng() * 0.03;
      const color = new THREE.Color(BLOOMS[Math.floor(rng() * BLOOMS.length)]).multiplyScalar(0.8 + rng() * 0.4);
      heads.push([_m.compose(_p.set(x, GROUND_Y + h + r * 0.8, z), _q, _s.set(r, r * 1.4, r)).clone(), color]);
    }
    const stem = new THREE.CylinderGeometry(0.014, 0.014, 1, 3, 1, true);
    for (const mesh of this.batch(world, stem, this.m.leaf, stems, 1)) mesh.receiveShadow = true;
    this.batch(world, this.geo.clump, this.m.plant, heads, 1);
  },

  /** The lily pond behind the walk: still water, stone edges, lily pads and their flowers. */
  buildPond(world, S) {
    const { scene, level, rng, tex, quality } = world;
    const len = level.endX + 220;
    const x0 = -100;
    const water = new Water(new THREE.PlaneGeometry(len, POND.near - POND.far), {
      textureWidth: quality.waterRes,
      textureHeight: quality.waterRes,
      waterNormals: tex.waterNormals,
      sunDirection: new THREE.Vector3(0.25, 0.14, -0.96).normalize(),
      sunColor: 0xb8c4e0,
      waterColor: 0x08161a,
      distortionScale: 0.35, // a still pond: long, slow ripples
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(x0 + len / 2, POND.y, (POND.near + POND.far) / 2);
    water.material.uniforms.size.value = 2;
    scene.add(water);
    S.water = water;
    for (const z of [POND.near, POND.far]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.4), this.m.stone);
      edge.position.set(x0 + len / 2, GROUND_Y - 0.1, z);
      scene.add(edge);
    }
    // lily pads in drifts, a flower on some; the frogs sit on others
    const pads = [];
    const flowers = [];
    this.pads = [];
    _q.identity();
    for (let x = x0; x < x0 + len; x += 3 + rng() * 6) {
      const z = POND.near - 1.5 - rng() * 12;
      const count = 2 + Math.floor(rng() * 6);
      for (let i = 0; i < count; i++) {
        const r = 0.22 + rng() * 0.2;
        const px = x + (rng() - 0.5) * 2.2;
        const pz = z + (rng() - 0.5) * 1.6;
        pads.push(_m.compose(_p.set(px, POND.y + 0.02, pz), _q, _s.set(r, 1, r)).clone());
        if (rng() < 0.3) flowers.push(_m.compose(_p.set(px + r * 0.3, POND.y + 0.08, pz), _q, _s.set(1, 1, 1)).clone());
        else this.pads.push([px, pz]);
      }
    }
    this.batch(world, new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), this.m.pad, pads, 1);
    this.batch(world, new THREE.ConeGeometry(0.1, 0.08, 7).rotateX(Math.PI), this.m.lily, flowers, 1);
  },

  /** Dress each platform: a glasshouse if it is high, a clipped hedge if it is short with gaps either side, else a terrace wall. */
  buildPlatforms(world) {
    const pls = world.level.platforms;
    pls.forEach((pl, i) => {
      if (pl.brittle) return;
      const prev = pls[i - 1];
      const next = pls[i + 1];
      const open = (!prev || pl.x0 - prev.x1 > 0.01) && (!next || next.x0 - pl.x1 > 0.01);
      if (pl.top >= 1.3) this.glasshouse(world, pl);
      else if (open && pl.x1 - pl.x0 <= 6) this.hedge(world, pl);
      else this.wall(world, pl);
    });
  },

  /** A brick terrace wall with a stone coping, ivy on its face. */
  wall(world, { x0, x1, top }) {
    const { scene, rng } = world;
    const m = this.m;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const h = top - 0.16 - GROUND_Y;
    const wall = new THREE.Mesh(boxWorldUV(len, h, TERRACE, 2), m.brick);
    wall.position.set(cx, GROUND_Y + h / 2, 0);
    wall.receiveShadow = true;
    scene.add(wall);
    const cope = new THREE.Mesh(boxWorldUV(len + 0.1, 0.16, TERRACE + 0.2, 1), m.coping);
    cope.position.set(cx, top - 0.08, 0);
    cope.receiveShadow = cope.castShadow = true;
    scene.add(cope);
    for (let x = x0 + rng() * 3; x < x1 - 0.5; x += 1.5 + rng() * 4) {
      const n = 4 + Math.floor(rng() * 8);
      const yTop = top - 0.25 - rng() * 0.5;
      for (let i = 0; i < n; i++) this.ivy.push([x + (rng() - 0.5) * 0.8, yTop - rng() * Math.min(h - 0.4, 1.8), 0.08 + rng() * 0.07]);
    }
  },

  /** A box hedge clipped flat on top, a little ragged at the edges. */
  hedge(world, { x0, x1, top }) {
    const { scene, rng } = world;
    const m = this.m;
    const len = x1 - x0;
    const h = top - GROUND_Y;
    const box = new THREE.Mesh(boxWorldUV(len, h, HEDGE, 1.2), m.hedge);
    box.position.set((x0 + x1) / 2, GROUND_Y + h / 2, 0);
    box.receiveShadow = box.castShadow = true;
    scene.add(box);
    for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.5 + rng() * 0.4) {
      for (const z of [HEDGE / 2, -HEDGE / 2]) {
        _s.set(0.3 + rng() * 0.1, 0.12 + rng() * 0.05, 0.16);
        this.lumps.push(_m.compose(_p.set(x, top - 0.1 - rng() * 0.05, z), _q.identity(), _s).clone());
      }
    }
  },

  /**
   * A glasshouse on a low brick wall, the walk along its ridge: glass walls and
   * roof on white bars, a staging bench of pots inside, palms and lamplight
   * glowing behind.
   */
  glasshouse(world, { x0, x1, top }) {
    const { scene, rng } = world;
    const m = this.m;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const eave = top - ROOF_H;
    const knee = new THREE.Mesh(boxWorldUV(len, KNEE - GROUND_Y, HALF * 2 + 0.1, 2), m.brick);
    knee.position.set(cx, (KNEE + GROUND_Y) / 2, 0);
    knee.receiveShadow = true;
    scene.add(knee);
    const glass = (geo) => {
      const mesh = new THREE.Mesh(geo, m.glass);
      mesh.renderOrder = 1;
      scene.add(mesh);
    };
    for (const s of [1, -1]) {
      // the side wall and the roof slope on this side
      glass(quadGeometry([x0, KNEE, s * HALF], [x1, KNEE, s * HALF], [x1, eave, s * HALF], [x0, eave, s * HALF]));
      glass(quadGeometry([x0, eave, s * HALF], [x1, eave, s * HALF], [x1, top, 0], [x0, top, 0]));
    }
    for (const gx of [x0, x1]) {
      const shape = new THREE.Shape();
      shape.moveTo(-HALF, KNEE);
      shape.lineTo(HALF, KNEE);
      shape.lineTo(HALF, eave);
      shape.lineTo(0, top);
      shape.lineTo(-HALF, eave);
      const geo = new THREE.ShapeGeometry(shape).rotateY(Math.PI / 2);
      geo.translate(gx, 0, 0);
      glass(geo);
    }
    // white bars: posts on the walls, rafters on the roof, a gutter at each eave
    const slope = Math.hypot(HALF, ROOF_H);
    const pitch = Math.atan2(ROOF_H, HALF);
    const n = Math.max(2, Math.round(len / 0.75));
    for (let i = 0; i <= n; i++) {
      const x = x0 + (len * i) / n;
      for (const s of [1, -1]) {
        this.bars.push(_m.compose(_p.set(x, (KNEE + eave) / 2, s * HALF), _q.identity(), _s.set(0.045, eave - KNEE, 0.045)).clone());
        _e.set(-s * (Math.PI / 2 - pitch), 0, 0);
        this.bars.push(_m.compose(_p.set(x, (top + eave) / 2, (s * HALF) / 2), _q.setFromEuler(_e), _s.set(0.04, slope, 0.04)).clone());
      }
    }
    for (const s of [1, -1]) {
      this.bars.push(_m.compose(_p.set(cx, eave, s * HALF), _q.identity(), _s.set(len + 0.1, 0.07, 0.09)).clone());
      this.bars.push(_m.compose(_p.set(cx, (KNEE + eave) / 2, s * HALF), _q.identity(), _s.set(len, 0.035, 0.035)).clone());
    }
    // the ridge board the walk runs along
    const ridge = new THREE.Mesh(boxWorldUV(len + 0.1, 0.09, 0.34, 1), m.ridge);
    ridge.position.set(cx, top - 0.045, 0);
    ridge.receiveShadow = ridge.castShadow = true;
    scene.add(ridge);
    // inside: palms and lamplight painted on a backdrop, a bench of pots in front of it
    const backdrop = new THREE.PlaneGeometry(len - 0.1, top - 0.1 - KNEE);
    const uv = backdrop.attributes.uv;
    const shift = rng();
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (len / 4) + shift);
    const back = new THREE.Mesh(backdrop, m.interior);
    back.position.set(cx, (KNEE + top - 0.1) / 2, -HALF + 0.15);
    scene.add(back);
    const bench = new THREE.Mesh(boxWorldUV(len - 0.4, 0.08, 0.7, 1), m.bench);
    bench.position.set(cx, KNEE + 0.25, HALF - 0.55);
    scene.add(bench);
    for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.35 + rng() * 0.3) {
      const z = HALF - 0.55 + (rng() - 0.5) * 0.3;
      this.pots.push([x, KNEE + 0.29, z]);
      this.plants.push([x, KNEE + 0.48 + rng() * 0.08, z, 0.1 + rng() * 0.06, rng()]);
    }
    for (let x = x0 + 0.6; x < x1 - 0.5; x += 0.9 + rng() * 1.2) {
      this.plants.push([x, KNEE + 0.3 + rng() * 0.5, -0.4 + rng() * 0.6, 0.25 + rng() * 0.25, rng() * 0.4]);
    }
    // lamps hung from the ridge, one of them lighting the walk above
    for (let x = x0 + 1.5; x < x1 - 1; x += 4 + rng() * 2) {
      const lamp = new THREE.Mesh(this.geo.ball, m.lamp);
      lamp.scale.setScalar(0.08);
      lamp.position.set(x, top - 0.55, 0.2);
      scene.add(lamp);
    }
    world.fixtures.push({ x: cx, y: eave + 0.2, z: 0.6, color: 0xffcc80, intensity: 7, distance: 8 });
  },

  /** Across the pond: blossom trees, lamps along the far path, the palm house and the dark woods behind. */
  buildFarBank(world, S) {
    const { scene, level, rng, tex } = world;
    const m = this.m;
    const from = -70;
    const to = level.endX + 120;
    // blossom trees: a few close behind the walk, many along the far bank (all instanced below)
    const tree = (x, z, h, scale) => {
      _q.setFromEuler(_e.set(0, 0, (rng() - 0.5) * 0.2));
      this.trunks.push(_m.compose(_p.set(x, GROUND_Y + h / 2, z), _q, _s.set(0.12 * scale, h, 0.12 * scale)).clone());
      const n = 8 + Math.floor(rng() * 5);
      for (let i = 0; i < n; i++) {
        const color = BLOSSOM[Math.floor(rng() * BLOSSOM.length)];
        const r = (0.45 + rng() * 0.4) * scale;
        _p.set(x + (rng() - 0.5) * 2.6 * scale, GROUND_Y + h + (rng() - 0.3) * 1.2 * scale, z + (rng() - 0.5) * 1.8 * scale);
        _q.setFromEuler(_e.set(rng() * 3, rng() * 3, rng() * 3));
        this.blossoms.push([_m.compose(_p, _q, _s.set(r * 1.3, r * 0.8, r * 1.1)).clone(), color]);
      }
    };
    for (let x = from; x < to; x += 5 + rng() * 6) tree(x, POND.far - 2.5 - rng() * 4, 2.2 + rng() * 1.4, 1.2);
    for (let x = from + 10; x < to; x += 20 + rng() * 18) tree(x, -3.8 - rng() * 0.8, 3.4 + rng() * 0.6, 1.0);
    // lamps along the far path, their light doubled in the pond
    const lamps = [];
    for (let x = from; x < to; x += 11 + rng() * 4) lamps.push(x);
    const z = POND.far - 0.8;
    const posts = new THREE.InstancedMesh(this.geo.pole, m.iron, lamps.length);
    const heads = new THREE.InstancedMesh(this.geo.unitBox, m.lamp, lamps.length);
    const glow = new Float32Array(lamps.length * 3);
    _q.identity();
    lamps.forEach((x, i) => {
      posts.setMatrixAt(i, _m.compose(_p.set(x, GROUND_Y + 1.3, z), _q, _s.set(0.06, 2.6, 0.06)));
      heads.setMatrixAt(i, _m.compose(_p.set(x, GROUND_Y + 2.75, z), _q, _s.set(0.22, 0.3, 0.22)));
      glow.set([x, GROUND_Y + 2.75, z], i * 3);
    });
    const glowGeo = new THREE.BufferGeometry();
    glowGeo.setAttribute('position', new THREE.BufferAttribute(glow, 3));
    const halos = new THREE.Points(
      glowGeo,
      new THREE.PointsMaterial({ size: 2.4, map: tex.glow, color: 0xffd08a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    scene.add(posts, heads, halos);
    this.buildPalmHouse(world, S, Math.round(level.goalX * 0.55));
    // the woods behind, and hills beyond them
    const range = (z, base, amp, step, topCol, darkCol) => {
      const ph = rng() * 10;
      const ph2 = rng() * 10;
      const pos = [];
      const cols = [];
      const idx = [];
      const hi = new THREE.Color(topCol);
      const lo = new THREE.Color(darkCol);
      let i = 0;
      for (let x = from - 60; x <= to + 60; x += step) {
        const y = base + amp * (0.55 + 0.45 * Math.sin(x * 0.05 + ph)) * (0.6 + 0.4 * Math.sin(x * 0.17 + ph2)) + (rng() - 0.5) * step * 0.3;
        pos.push(x, y, z, x, -30, z);
        cols.push(hi.r, hi.g, hi.b, lo.r, lo.g, lo.b);
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
    range(-75, 0.5, 4.0, 5, 0x141c2c, 0x070a10);
    range(-46, 0.6, 2.8, 1.6, 0x0c1a14, 0x050a08);
  },

  /** The palm house: a glass dome between two long glass wings, palms glowing inside. */
  buildPalmHouse(world, S, x) {
    const { scene } = world;
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, GROUND_Y, PALM_Z);
    scene.add(g);
    const base = new THREE.Mesh(boxWorldUV(38, 0.8, 9, 2), m.stone);
    base.position.y = 0.4;
    g.add(base);
    // the glow inside: painted palms on a long backdrop, behind glass
    const backdrop = new THREE.PlaneGeometry(36, 6.4);
    const uv = backdrop.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 7);
    const back = new THREE.Mesh(backdrop, m.interior);
    back.position.set(0, 3.9, -1.2);
    g.add(back);
    const ribs = []; // every rib, merged into one mesh at the end
    const vault = (cxw, len, r) => {
      // the top half of a cylinder lying along x
      const geo = new THREE.CylinderGeometry(r, r, len, 24, 1, true, 0, Math.PI);
      geo.rotateZ(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, m.glass);
      mesh.position.set(cxw, 2.8, 0);
      mesh.renderOrder = 1;
      g.add(mesh);
      const n = Math.round(len / 1.2);
      for (let i = 0; i <= n; i++) ribs.push(new THREE.TorusGeometry(r, 0.05, 4, 20, Math.PI).rotateY(Math.PI / 2).translate(cxw - len / 2 + (len * i) / n, 2.8, 0));
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(len, 2), m.glass);
      wall.position.set(cxw, 1.8, r);
      wall.renderOrder = 1;
      g.add(wall);
    };
    vault(-11, 13, 3.0);
    vault(11, 13, 3.0);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(4.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.glass);
    dome.position.y = 2.8;
    dome.renderOrder = 1;
    g.add(dome);
    for (let i = 0; i < 12; i++) {
      // a quarter circle from the dome's foot to its crown, turned about the vertical
      ribs.push(new THREE.TorusGeometry(4.2, 0.06, 4, 16, Math.PI / 2).rotateY((i / 12) * Math.PI * 2).translate(0, 2.8, 0));
    }
    g.add(new THREE.Mesh(mergeGeometries(ribs), m.frame));
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.25, 4.25, 2, 24, 1, true), m.glass);
    drum.position.y = 1.8;
    drum.renderOrder = 1;
    g.add(drum);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.8, 8), m.lamp);
    lantern.position.y = 7.3;
    g.add(lantern);
    S.palm = { x };
  },

  /**
   * The world's stars are packed low so they show over the woods in a wide view;
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

  /** The garden cats: napping in pots and on hedges, a kitten batting at a moth, and at home a family. */
  buildCats(world, S) {
    const { scene, level } = world;
    const m = this.m;
    const pls = level.platforms.filter((pl) => !pl.brittle);
    const cats = (S.cats = new SceneryCats(scene, world.rng, { watch: Math.PI / 2 }));
    const add = (coat, pose, x, y, z, yaw, opts) => {
      cats.add(coat, pose, x, y, z, yaw, opts);
      this.taken.push(x);
    };
    const pot = (x, y, z, s = 1) => {
      const p = new THREE.Mesh(this.geo.bigPot, m.terracotta);
      p.position.set(x, y, z);
      p.scale.setScalar(s);
      p.castShadow = p.receiveShadow = true;
      scene.add(p);
      return y + 0.5 * s;
    };
    const walls = pls.filter((pl) => pl.top < 1.3 && pl.x1 - pl.x0 > 6);
    // a ginger cat peeking out of a big flowerpot on the first wall
    add('ginger', 'peek', 6.6, pot(6.6, 0, -1.1), -1.1, -0.6);
    // a white cat asleep on top of the second hedge
    const hedges = pls.filter((pl) => pl.top < 1.3 && pl.x1 - pl.x0 <= 6);
    if (hedges[1]) add('white', 'loaf', (hedges[1].x0 + hedges[1].x1) / 2 + 0.6, hedges[1].top, -0.82, 0.4);
    // a tuxedo kitten batting at a moth
    const kit = walls.find((pl) => pl.x0 > level.goalX * 0.15 && !level.hangers.some((h) => Math.abs(h.x - pl.x0 - 3) < 2.2));
    if (kit) {
      add('white', 'sit', kit.x0 + 3, kit.top, -1.12, -0.8, { scale: 0.55, paw: true });
      this.kittenMoth = { x: kit.x0 + 3 + 0.12, y: kit.top + 0.55, z: -1.0 };
    }
    // a grey cat on a wall, watching the pond and the palm house
    const grey = walls.find((pl) => pl.x0 > level.goalX * 0.35 && pl.x1 - pl.x0 > 12);
    if (grey) add('grey', 'sit', grey.x0 + 4.2, grey.top, -1.15, Math.PI / 2 - 0.3);
    // a cream cat asleep in a garden trug
    const trug = walls.find((pl) => pl.x0 > level.goalX * 0.5 && pl.x1 - pl.x0 > 12);
    if (trug) {
      const tx = trug.x0 + 2.6;
      const b = new THREE.Mesh(this.geo.basket, m.wicker);
      b.position.set(tx, trug.top, -1.1);
      b.castShadow = true;
      scene.add(b);
      add('cream', 'loaf', tx, trug.top + 0.05, -1.1, -0.3, { scale: 0.85 });
    }
    // two more peeking out of pots further on
    const late = walls.filter((pl) => pl.x0 > level.goalX * 0.68 && pl.x1 - pl.x0 > 12);
    if (late[0]) add('tabby', 'peek', late[0].x0 + 2.4, pot(late[0].x0 + 2.4, late[0].top, -1.1, 0.9), -1.1, -0.4);
    // home: a friend and two kittens by a saucer of milk, just past where the night cat comes to rest
    if (this.home) {
      const { x, top } = this.home;
      add('white', 'sit', x + 10.0, top, -0.55, Math.PI, {
        patches: [
          ['body', 0xd8802e, 0.13, 0.1, 0.12, -0.08, 0.24, 0.06],
          ['body', 0x1c1a20, 0.09, 0.07, 0.1, -0.12, 0.12, -0.08],
          ['head', 0x1c1a20, 0.07, 0.05, 0.08, -0.02, 0.06, 0.05],
        ],
      });
      const bed = new THREE.Mesh(this.geo.basket, m.wicker);
      bed.position.set(x + 10.95, top, -0.95);
      bed.castShadow = true;
      scene.add(bed);
      const cushion = new THREE.Mesh(this.geo.ball, m.cushion);
      cushion.scale.set(0.27, 0.05, 0.27);
      cushion.position.set(x + 10.95, top + 0.1, -0.95);
      scene.add(cushion);
      add('ginger', 'sit', x + 10.8, top + 0.1, -0.9, Math.PI - 0.3, { scale: 0.48 });
      add('tuxedo', 'sit', x + 11.1, top + 0.1, -1.02, Math.PI + 0.4, { scale: 0.45, paw: true });
      const saucer = new THREE.Mesh(this.geo.saucer, m.milk);
      saucer.position.set(x + 9.4, top, -0.85);
      scene.add(saucer);
    }
  },

  /** Lamps along the back of the terrace walls, and moths about them. */
  buildLamps(world, S) {
    const { scene, level, rng, tex } = world;
    const m = this.m;
    const glowMat = new THREE.SpriteMaterial({ map: tex.glow, color: 0xffd08a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    const busy = (x) =>
      level.hangers.some((h) => Math.abs(h.x - x) < 1.6) ||
      level.checkpoints.some((cp) => Math.abs(cp.x - x) < 1.3) ||
      this.taken.some((t) => Math.abs(t - x) < 1.2) ||
      x > level.goalX - 2.5;
    for (const pl of level.platforms) {
      if (pl.brittle || pl.top >= 1.3 || pl.x1 - pl.x0 < 10) continue;
      for (let x = pl.x0 + 2 + rng() * 3; x < pl.x1 - 1.5; x += 10 + rng() * 4) {
        if (busy(x)) continue;
        const g = new THREE.Group();
        g.position.set(x, pl.top, -1.15);
        const post = new THREE.Mesh(this.geo.pole, m.iron);
        post.scale.set(0.05, 2.3, 0.05);
        post.position.y = 1.15;
        post.castShadow = true;
        g.add(post);
        const head = new THREE.Mesh(this.geo.unitBox, m.lamp);
        head.scale.set(0.2, 0.28, 0.2);
        head.position.y = 2.42;
        g.add(head);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.16, 6), m.iron);
        cap.position.y = 2.64;
        g.add(cap);
        const glow = new THREE.Sprite(glowMat.clone());
        glow.position.y = 2.42;
        glow.scale.set(2.2, 2.2, 1);
        g.add(glow);
        scene.add(g);
        world.fixtures.push({ x, y: pl.top + 2.4, z: -0.75, color: 0xffd08a, intensity: 10, distance: 9, flicker: true });
        S.lamps.push({ x, y: pl.top + 2.42, z: -1.15, glow });
      }
    }
  },

  /** Frogs on the lily pads (those far enough out to be seen over the walk); they leap into the pond as the cat runs by. */
  buildFrogs(world, S) {
    const { scene, rng } = world;
    const m = this.m;
    let last = -Infinity;
    for (const [x, z] of this.pads) {
      if (z > -8.5 || z < -13 || x - last < 9) continue;
      last = x;
      const g = new THREE.Group();
      const body = new THREE.Mesh(this.geo.ball, m.frog);
      body.scale.set(0.12, 0.07, 0.1);
      body.position.y = 0.06;
      g.add(body);
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(this.geo.ball, m.frogEye);
        eye.scale.setScalar(0.028);
        eye.position.set(0.07, 0.12, s * 0.045);
        g.add(eye);
      }
      g.position.set(x, POND.y + 0.03, z);
      g.rotation.y = Math.PI / 2 + (rng() - 0.5) * 1.5;
      g.traverse((o) => o.layers.set(1));
      scene.add(g);
      S.frogs.push({ g, x, z, y: POND.y + 0.03, state: 'sit', t: 0, ph: rng() * 6.28 });
    }
  },

  /** Blossom petals drifting down around the camera. */
  buildPetals(world, S, n) {
    const { scene, rng, tex } = world;
    const mesh = new THREE.InstancedMesh(
      this.geo.petal,
      new THREE.MeshStandardMaterial({ map: tex.petal, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, emissive: 0x3a2028 }),
      n
    );
    const items = [];
    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      items.push({ x: (rng() - 0.5) * 50, y: GROUND_Y + rng() * 9, z: -7 + rng() * 11, v: 0.25 + rng() * 0.35, vx: 0, vy: 0, ph: rng() * 6.28, rx: rng() * 2, ry: rng() * 2, gust: 0 });
      color.setHex(BLOSSOM[Math.floor(rng() * BLOSSOM.length)]);
      mesh.setColorAt(i, color);
    }
    mesh.frustumCulled = false;
    scene.add(mesh);
    S.petals = { mesh, items, n };
  },

  /** Glow-worms in the bed and the lawn. */
  buildWorms(world, S, n) {
    const { scene, rng, tex } = world;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const items = [];
    for (let i = 0; i < n; i++) {
      const front = rng() < 0.6;
      items.push({ x: (rng() - 0.5) * 60, y: GROUND_Y + 0.03 + rng() * 0.12, z: front ? 1.4 + rng() * 2.8 : -1.6 - rng() * 3, ph: rng() * 6.28 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.22, map: tex.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    pts.frustumCulled = false;
    pts.layers.set(1);
    scene.add(pts);
    S.worms = { pts, items, n };
  },

  /** A few moths about each lamp near the camera, and one for the kitten to bat at. */
  buildMoths(world, S) {
    const n = 28;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.09, color: 0xf4ecdc, transparent: true, opacity: 0.9, depthWrite: false })
    );
    pts.frustumCulled = false;
    pts.layers.set(1);
    world.scene.add(pts);
    S.moths = { pts, n };
  },

  /**
   * Draws a list of matrices, or of [matrix, colour] pairs (a hex or a Color), as
   * instanced meshes on the given layer: one for each 40u stretch of the garden, so
   * the stretches off screen are culled. Returns the meshes.
   */
  batch(world, geo, mat, list, layer) {
    const runs = new Map();
    for (const item of list) {
      const k = Math.floor((Array.isArray(item) ? item[0] : item).elements[12] / 40);
      if (!runs.has(k)) runs.set(k, []);
      runs.get(k).push(item);
    }
    const color = new THREE.Color();
    return [...runs.values()].map((run) => {
      const mesh = new THREE.InstancedMesh(geo, mat, run.length);
      run.forEach((item, i) => {
        if (Array.isArray(item)) {
          mesh.setMatrixAt(i, item[0]);
          mesh.setColorAt(i, color.set(item[1]));
        } else mesh.setMatrixAt(i, item);
      });
      mesh.layers.set(layer);
      world.scene.add(mesh);
      return mesh;
    });
  },

  /** Everything gathered while the level was built: trees, glazing bars, hedges, ivy, pots, plants and roses. */
  buildInstanced(world) {
    const { rng } = world;
    const m = this.m;
    // the blossom trees stand behind the pond and show in it; the rest is on the walk's side
    this.batch(world, this.geo.pole, m.bark, this.trunks, 0);
    this.batch(world, this.geo.lump, m.blossom, this.blossoms, 0);
    this.batch(world, this.geo.unitBox, m.frame, this.bars, 1);
    this.batch(world, this.geo.lump, m.hedge, this.lumps, 1);
    this.batch(world, this.geo.clump, m.leaf, this.leaves, 1);
    this.batch(world, this.geo.lump, m.bloom, this.roses, 1);
    const ivy = this.ivy.map(([x, y, r]) => {
      _q.setFromEuler(_e.set(rng() * 3, rng() * 3, rng() * 3));
      return _m.compose(_p.set(x, y, TERRACE / 2 + r * 0.3), _q, _s.set(r, r, r * 0.5)).clone();
    });
    this.batch(world, this.geo.clump, m.leaf, ivy, 1);
    _q.identity();
    const pots = this.pots.map(([x, y, z]) => _m.compose(_p.set(x, y + 0.035, z), _q, _s.set(1, 1, 1)).clone());
    this.batch(world, this.geo.benchPot, m.terracotta, pots, 1);
    const plants = this.plants.map(([x, y, z, r, bloom]) => {
      _q.setFromEuler(_e.set(rng() * 3, rng() * 3, rng() * 3));
      const color = new THREE.Color(bloom > 0.75 ? BLOOMS[Math.floor(rng() * BLOOMS.length)] : 0x2c5a2e).multiplyScalar(0.7 + rng() * 0.5);
      return [_m.compose(_p.set(x, y, z), _q, _s.set(r, r * 0.8, r)).clone(), color];
    });
    this.batch(world, this.geo.clump, m.plant, plants, 1);
  },

  /** Hanging things swing when the cat goes by; the chimes ring. */
  onPass(o, sfx) {
    const s = this.swings.find((sw) => Math.abs(sw.x - o.x) < 0.01);
    if (!s) return;
    s.kick = 1;
    s.age = 0;
    if (s.kind === 'chimes') sfx.chimes();
  },

  update(world, dt, t, catX, camX) {
    const S = world.themeState;
    const rng = world.rng;
    S.water.material.uniforms.time.value += dt * 0.25;

    for (const s of this.swings) {
      s.age += dt;
      s.kick *= Math.exp(-dt * (s.kind === 'chimes' ? 0.9 : 1.4));
      const amp = s.kind === 'chimes' ? 0.45 : 0.3;
      s.g.rotation.x = 0.04 * Math.sin(t * 1.1 + s.ph) + s.kick * amp * Math.sin(s.age * 6.5);
      s.g.rotation.z = s.kind === 'wisteria' ? 0 : 0.03 * Math.sin(t * 0.8 + s.ph) + s.kick * 0.15 * Math.sin(s.age * 5.1);
    }
    for (const l of S.lamps) {
      if (Math.abs(l.x - catX) > 40) continue;
      l.glow.material.opacity = 0.6 * (1 + 0.08 * Math.sin(t * 9 + l.x) * Math.sin(t * 2.9 + l.x));
    }

    // moths circle the lamps near the camera; one flutters over the kitten
    const mp = S.moths.pts.geometry.attributes.position.array;
    let k = 0;
    const flutter = (cx, cy, cz, r, i) => {
      if (k >= S.moths.n) return;
      const a = t * (2.2 + (i % 3) * 0.7) + i * 2.1;
      mp[k * 3] = cx + r * Math.cos(a) + 0.05 * Math.sin(t * 17 + i);
      mp[k * 3 + 1] = cy + 0.25 * Math.sin(t * 1.9 + i) + 0.04 * Math.sin(t * 23 + i);
      mp[k * 3 + 2] = cz + r * 0.8 * Math.sin(a);
      k++;
    };
    for (const l of S.lamps) {
      if (Math.abs(l.x - camX) > 22) continue;
      for (let i = 0; i < 3; i++) flutter(l.x, l.y, l.z, 0.35 + i * 0.12, i + Math.floor(l.x));
    }
    if (this.kittenMoth && Math.abs(this.kittenMoth.x - camX) < 22) {
      const km = this.kittenMoth;
      flutter(km.x + 0.1, km.y + 0.15, km.z + 0.1, 0.12, 7);
    }
    S.moths.pts.geometry.setDrawRange(0, k);
    S.moths.pts.geometry.attributes.position.needsUpdate = true;

    // glow-worms glow and fade, and keep near the camera
    const W = S.worms;
    const wp = W.pts.geometry.attributes.position.array;
    const wc = W.pts.geometry.attributes.color.array;
    for (let i = 0; i < W.n; i++) {
      const w = W.items[i];
      if (Math.abs(w.x - camX) > 30) w.x = camX + (w.x < camX ? 29 : -29) + (rng() - 0.5) * 4;
      wp[i * 3] = w.x;
      wp[i * 3 + 1] = w.y;
      wp[i * 3 + 2] = w.z;
      const b = 0.3 + 0.7 * Math.pow(Math.max(0, Math.sin(t * 0.7 + w.ph * 3)), 2);
      wc[i * 3] = 0.7 * b;
      wc[i * 3 + 1] = 1.0 * b;
      wc[i * 3 + 2] = 0.35 * b;
    }
    W.pts.geometry.attributes.position.needsUpdate = true;
    W.pts.geometry.attributes.color.needsUpdate = true;

    // frogs: sit and breathe; leap into the pond as the cat comes by; climb back when it has gone
    for (const f of S.frogs) {
      if (Math.abs(f.x - camX) > 40) continue;
      if (f.state === 'sit') {
        f.g.scale.y = 1 + 0.08 * Math.sin(t * 3 + f.ph);
        if (Math.abs(catX - f.x) < 2.5) {
          f.state = 'jump';
          f.t = 0;
        }
      } else if (f.state === 'jump') {
        f.t += dt;
        const u = f.t / 0.45;
        f.g.position.set(f.x + 0.3 * u, f.y + 0.45 * Math.sin(Math.PI * u) - (u > 1 ? (u - 1) * 2 : 0), f.z - 0.6 * u);
        if (u >= 1 && !f.plopped) {
          f.plopped = true;
          world.sfx?.plop();
          world.puff(f.x + 0.3, POND.y + 0.05, 3, 0.35, 0x9fc8c0);
        }
        if (u > 1.3) {
          f.state = 'gone';
          f.g.visible = false;
        }
      } else if (catX < f.x - 6 || Math.abs(catX - f.x) > 30) {
        // back on its pad once the cat is well away (or has started over)
        f.state = 'sit';
        f.plopped = false;
        f.g.visible = true;
        f.g.position.set(f.x, f.y, f.z);
      }
    }

    // petals drift down, sway and tumble; respawn above the camera
    const P = S.petals;
    for (let i = 0; i < P.n; i++) {
      const p = P.items[i];
      p.gust *= Math.exp(-dt * 0.8);
      p.y -= (p.v - p.vy * p.gust) * dt;
      p.x += (0.35 * Math.sin(t * 1.2 + p.ph) - 0.25 + p.vx * p.gust) * dt;
      if (p.y < GROUND_Y || Math.abs(p.x - camX) > 30) {
        p.x = camX + (rng() - 0.5) * 50;
        p.y = 6 + rng() * 4;
        p.z = -7 + rng() * 11;
        p.gust = 0;
      }
      _e.set(t * p.rx + p.ph, t * p.ry, Math.sin(t * 2 + p.ph) * 0.8);
      P.mesh.setMatrixAt(i, _m.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e), _s.set(1, 1, 1)));
    }
    P.mesh.instanceMatrix.needsUpdate = true;

    S.cats.update(dt, t, catX, camX);

    // home: a gust of petals round the cat, and the nightingale sings
    const goal = world.level.goalX;
    if (!S.finale && catX >= goal) {
      S.finale = true;
      world.sfx?.nightingale(1.4);
      for (const p of P.items) {
        if (rng() < 0.6) {
          p.x = catX + 4 + (rng() - 0.5) * 10;
          p.y = GROUND_Y + 2.4 + rng() * 2;
          p.z = -2 + rng() * 4;
          p.gust = 1;
          p.vx = (rng() - 0.3) * 2.5;
          p.vy = 1.2 + rng() * 1.2;
        }
      }
    } else if (S.finale && catX < goal - 2) S.finale = false;
  },

  dispose(world) {
    const S = world.themeState;
    // Water keeps its render target private; releasing the mirror texture frees the GPU memory.
    if (S?.water) S.water.material.uniforms.mirrorSampler.value.dispose();
    world.camera.layers.disable(1);
  },
};
