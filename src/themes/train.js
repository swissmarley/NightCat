// Stage VII dressing: a circus train crossing the country under a full moon. The
// walk runs along the roofs of its cars — painted circus wagons strung with
// marquee bulbs, the lion's cage car, the elephant car, sleeping coaches, little
// wheeled wagons riding on flatcars — over the gaps between them, across planks
// laid over open wagons that give way, and up off the trampolines on the
// flatcars. Star tubs, steamer trunks, drums, striped balls and a cannon to jump;
// bunting, a trapeze and strings of bulbs to slide under. The country rushes by:
// telegraph poles, fields and farms, a windmill, hills with a village, mountains;
// a station, level crossings and tunnels sweep past, and the engine's smoke
// streams back over the train. At the front, by the engine, a family waits.
//
// The train stands still in the world and the country moves: everything outside
// the train is built in strips that repeat and slide back past the camera.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Mesher } from './snow.js';
import { SceneryCats } from './cats.js';
import {
  circusPanelTexture,
  wheelTexture,
  starsTexture,
  fieldTexture,
  signTexture,
  awningTexture,
  woodTexture,
  boardTexture,
  gravelTexture,
  lawnTexture,
  stoneTexture,
  windowPaneTexture,
  boxWorldUV,
} from '../textures.js';

const RAIL_Y = -2.4; // the tops of the rails
const FLOOR = -1.5; // the bottoms of the cars' bodies
const HALF = 1.25; // half a car's width: the sides are at z = ±HALF
const RAIL_Z = 0.82; // the rails, and the wheels on them
const WHEEL_R = 0.4;
const SPEED = 17; // the train's speed over the ground (u/s)
const TUNNEL_Y = 6.4; // the tunnel's roof: above the highest jump from the highest car
const PAINT = [0x8a1c22, 0x1e3a6e, 0x1e5a3e, 0x6a2a6a, 0x9a5a14];
const NAMES = ['CIRQUE DE LA NUIT', 'LES CHATS VOLANTS', 'MÉNAGERIE', 'GRAND CIRQUE'];
const BULBS = [0xffd27a, 0xff8a5a, 0xfff0c8, 0xff6a8a];
const PENNANTS = [0xd8282a, 0xf0c030, 0x2a6ad8, 0xf0f0e8, 0x2a9a5a];
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();
const mod = (a, n) => ((a % n) + n) % n;
const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/**
 * Merge a group's child meshes that share a material into one mesh each, so a
 * thing built from many small parts is a few draw calls. Only direct children
 * are merged; groups and sprites are left be.
 */
function mergeByMaterial(group) {
  const byMat = new Map();
  for (const o of group.children) {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material)) continue;
    if (!byMat.has(o.material)) byMat.set(o.material, []);
    byMat.get(o.material).push(o);
  }
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const indexed = meshes.every((o) => o.geometry.index);
    const geos = meshes.map((o) => {
      o.updateMatrix();
      const geo = o.geometry.clone().applyMatrix4(o.matrix);
      return indexed ? geo : geo.index ? geo.toNonIndexed() : geo;
    });
    const merged = new THREE.Mesh(mergeGeometries(geos), mat);
    merged.castShadow = meshes.some((o) => o.castShadow);
    merged.receiveShadow = true;
    for (const o of meshes) group.remove(o);
    for (const geo of geos) geo.dispose();
    group.add(merged);
  }
  return group;
}

/** A line of points sagging between two ends. */
function sag(x0, y0, x1, y1, z, drop, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - drop * Math.sin(u * Math.PI), z));
  }
  return pts;
}

export const trainTheme = {
  key: 'train',
  floorY: RAIL_Y + 0.1,
  ambience: 'train',
  hanging: new Set(['bunting', 'trapeze', 'bulbs']),
  cpSink: 0,
  fallFx: { sound: 'poof', color: 0xb8b0a0 },
  bouncyHint: 'a trampoline below — drop onto it and it throws you high',
  colors: {
    bg: 0x060912,
    fog: 0x0c1322,
    fogNear: 22,
    fogFar: 95,
    hemiSky: 0x3a4a78,
    hemiGround: 0x1a1e14,
    hemiInt: 1.2,
    moon: 0xfff0d8,
    moonInt: 2.5,
    moonPos: [-26, 8.5, -92],
    moonSize: 3.2,
    moonHalo: 0xffe8c8,
    skyTop: [0.005, 0.01, 0.03],
    skyMid: [0.02, 0.034, 0.075],
    skyHor: [0.05, 0.066, 0.1],
    starCount: 700,
    starRange: [2, 24],
    fill: 0xb8c8ff,
    puff: 0xb8b4a8,
    spark: 0xfff0a0,
    cp: 0xffc070,
  },

  makeTextures(rng) {
    return {
      panels: NAMES.map((name, i) => circusPanelTexture(rng, ['#7a1418', '#1a2e5e', '#1a4a32', '#5a1e5a'][i], name)),
      wheel: wheelTexture(),
      starsBlue: starsTexture(rng, '#1e3a8a', '#f0d070'),
      starsRed: starsTexture(rng, '#a82028', '#f8f0e0'),
      stripes: awningTexture(['#f0e6d0', '#c8282a', '#1e3a6e']),
      wood: woodTexture(rng),
      board: boardTexture(rng),
      gravel: gravelTexture(rng),
      lawn: lawnTexture(rng),
      wheat: fieldTexture(rng, '#3a3a2a', '#4e4a32'),
      plough: fieldTexture(rng, '#1e1a16', '#2c2620'),
      stone: stoneTexture(rng),
      paneLit: windowPaneTexture(true),
      paneDark: windowPaneTexture(false),
      sign: signTexture('SAINT-MINOU'),
    };
  },

  init(tex) {
    this.tex = tex;
    // filled while the level is built, used when the world is dressed
    this.swings = [];
    this.tramps = [];
    this.lights = [];
    this.taken = [];
    this.wheels = []; // [x, y, z, radius, turns] of every wheel seen side on
    this.bulbs = [[], []]; // marquee bulbs, as [matrix, colour], in two sets that chase each other
    this.bars = []; // cage bars, as matrices
    this.windows = { lit: [], dark: [] };
    this.home = null;
    this.cars = [];
    this.lionBody = null;
    this.elephant = null;
    this.engine = null;
    this.stove = null;
    const std = (o) => new THREE.MeshStandardMaterial(o);
    // for bulbs drawn many to a batch: the glow takes each one's instance colour
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
    const wheelCap = std({ map: tex.wheel, roughness: 0.6 });
    this.m = {
      paint: PAINT.map((color) => std({ color, roughness: 0.6, emissive: color, emissiveIntensity: 0.06 })),
      panels: tex.panels.map((map) => std({ map, roughness: 0.55, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.08 })),
      roof: std({ color: 0x2a2622, roughness: 0.8 }),
      gold: std({ color: 0xe0b050, roughness: 0.35, metalness: 0.7, emissive: 0x4a3008, emissiveIntensity: 0.6 }),
      coach: std({ color: 0x4a1a20, roughness: 0.6, emissive: 0x4a1a20, emissiveIntensity: 0.05 }),
      cream: std({ color: 0xd8c8a0, roughness: 0.7 }),
      iron: std({ color: 0x1a1a1e, roughness: 0.55, metalness: 0.6 }),
      steel: std({ color: 0x8a8e96, roughness: 0.3, metalness: 0.9 }),
      wood: std({ map: tex.wood, color: 0x9a7a58, roughness: 0.85 }),
      slats: std({ map: tex.board, color: 0x8a6a4a, roughness: 0.9 }),
      plank: std({ map: tex.wood, color: 0xd8c8b0, roughness: 0.9 }),
      dark: std({ color: 0x0c0a08, roughness: 1 }),
      straw: std({ color: 0x3a2a14, emissive: 0x6a4a18, emissiveIntensity: 0.6, roughness: 1 }),
      bulb: tinted({ emissiveIntensity: 2.2, roughness: 0.4 }),
      bulbB: tinted({ emissiveIntensity: 2.2, roughness: 0.4 }),
      wheel: [std({ color: 0x1a1614, roughness: 0.6, metalness: 0.4 }), wheelCap, wheelCap],
      starsBlue: std({ map: tex.starsBlue, roughness: 0.6 }),
      starsRed: std({ map: tex.starsRed, roughness: 0.6 }),
      stripes: std({ map: tex.stripes, roughness: 0.7 }),
      mat: std({ color: 0x16161c, roughness: 0.9 }),
      trunk: std({ color: 0x5a3a22, roughness: 0.8 }),
      drumHead: std({ color: 0xf4ecdc, roughness: 0.7, emissive: 0x2a2620 }),
      red: std({ color: 0xc02028, roughness: 0.5 }),
      white: std({ color: 0xeeeae0, roughness: 0.6 }),
      lamp: std({ color: 0x2a1406, emissive: 0xffc27a, emissiveIntensity: 3.0, roughness: 0.6 }),
      redLamp: std({ color: 0x300404, emissive: 0xff2a1a, emissiveIntensity: 0.3, roughness: 0.6 }),
      paneLit: std({ map: tex.paneLit, emissiveMap: tex.paneLit, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.8 }),
      paneDark: std({ map: tex.paneDark, roughness: 0.4 }),
      lion: std({ color: 0xc8944a, roughness: 0.9 }),
      mane: std({ color: 0x7a3e14, roughness: 1, flatShading: true }),
      elephant: std({ color: 0x6e6e78, roughness: 0.9 }),
      tusk: std({ color: 0xf0ead8, roughness: 0.5 }),
      eye: std({ color: 0x0a0806, roughness: 0.3 }),
      cushion: std({ color: 0xa83a4a, roughness: 0.9 }),
      blanket: std({ map: tex.stripes, roughness: 0.9 }),
      dish: std({ color: 0x2a5aa8, roughness: 0.3 }),
      fish: std({ color: 0xa8b4c0, roughness: 0.3, metalness: 0.5 }),
      sooty: std({ color: 0x141416, roughness: 0.7, metalness: 0.3 }),
      fire: std({ color: 0x2a0a04, emissive: 0xff7a2a, emissiveIntensity: 2.2, roughness: 1 }),
      head: std({ color: 0x1a1006, emissive: 0xfff0c0, emissiveIntensity: 4, roughness: 0.4 }),
      pennant: std({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.05 }),
    };
    this.geo = {
      unitBox: new THREE.BoxGeometry(1, 1, 1),
      ball: new THREE.SphereGeometry(1, 14, 10),
      lump: new THREE.IcosahedronGeometry(1, 1),
      clump: new THREE.IcosahedronGeometry(1, 0),
      pole: new THREE.CylinderGeometry(1, 1, 1, 8),
      bulb: new THREE.SphereGeometry(0.06, 8, 6),
      // a wheel lying in the x-y plane, its caps facing ±z
      wheel: new THREE.CylinderGeometry(1, 1, 0.12, 20).rotateX(Math.PI / 2),
      tube: new THREE.CylinderGeometry(0.012, 0.012, 1, 5).translate(0, -0.5, 0),
    };
  },

  /** Cars are dressed in dress(), once their neighbours are known. */
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
    if (kind === 'pedestal') {
      // a circus tub painted with stars, gilt rims
      add(new THREE.CylinderGeometry(0.28, 0.24, 0.48, 18), m.starsBlue, 0, 0.24, 0);
      add(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 18), m.red, 0, 0.5, 0);
      for (const y of [0.04, 0.47]) add(new THREE.TorusGeometry(y > 0.1 ? 0.29 : 0.25, 0.015, 6, 20), m.gold, 0, y, 0, false).rotation.x = Math.PI / 2;
      size = { w: 0.6, h: 0.54 };
    } else if (kind === 'trunk') {
      // a steamer trunk: a domed lid, brass corners and leather straps
      add(boxWorldUV(0.8, 0.46, 0.5, 1), m.trunk, 0, 0.23, 0);
      const lid = add(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 14, 1, false, 0, Math.PI), m.trunk, 0, 0.46, 0);
      lid.rotation.z = Math.PI / 2;
      lid.scale.set(1, 1, 0.8);
      for (const sx of [-0.27, 0.27]) {
        const strap = add(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 14, 1, false, 0, Math.PI), m.dark, sx, 0.46, 0, false);
        strap.rotation.z = Math.PI / 2;
        strap.scale.set(1, 1, 0.81);
        add(this.geo.unitBox, m.dark, sx, 0.23, 0).scale.set(0.06, 0.47, 0.52);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(this.geo.unitBox, m.gold, sx * 0.38, 0.05, sz * 0.23, false).scale.setScalar(0.07);
      size = { w: 0.82, h: 0.66 };
    } else if (kind === 'drum') {
      // a big bass drum standing on its rim, its head to the camera
      const shell = add(new THREE.CylinderGeometry(0.38, 0.38, 0.4, 24), m.red, 0, 0.39, 0);
      shell.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) {
        const head = add(new THREE.CircleGeometry(0.36, 24), m.drumHead, 0, 0.39, s * 0.205, false);
        if (s < 0) head.rotation.y = Math.PI;
        add(new THREE.TorusGeometry(0.38, 0.025, 6, 24), m.gold, 0, 0.39, s * 0.2, false);
      }
      add(this.geo.ball, m.starsRed, 0, 0.39, 0.215, false).scale.set(0.14, 0.14, 0.01);
      size = { w: 0.78, h: 0.78 };
    } else if (kind === 'ball') {
      // a big striped ball on a low ring
      const b = add(this.geo.ball, m.stripes, 0, 0.47, 0);
      b.scale.setScalar(0.4);
      b.rotation.z = 0.4;
      add(new THREE.TorusGeometry(0.18, 0.03, 6, 16), m.gold, 0, 0.06, 0).rotation.x = Math.PI / 2;
      size = { w: 0.8, h: 0.87 };
    } else {
      // the cannon a clown is fired from: a striped barrel cocked on a two-wheeled carriage
      const barrel = add(new THREE.CylinderGeometry(0.17, 0.22, 1.0, 16), m.stripes, -0.05, 0.5, 0);
      barrel.rotation.z = -0.95;
      const mouth = add(new THREE.TorusGeometry(0.17, 0.04, 6, 16), m.gold, 0.36, 0.78, 0, false);
      mouth.rotation.set(0, Math.PI / 2, -0.95 + Math.PI / 2);
      add(new THREE.SphereGeometry(0.2, 12, 8), m.red, -0.42, 0.22, 0);
      for (const s of [-1, 1]) {
        const w = add(this.geo.wheel, this.m.wheel, -0.2, 0.22, s * 0.26);
        w.scale.set(0.22, 0.22, 0.6);
      }
      add(this.geo.unitBox, m.wood, -0.25, 0.2, 0).scale.set(0.5, 0.12, 0.42);
      size = { w: 0.98, h: 0.9 };
    }
    group.add(mergeByMaterial(g));
    return size;
  },

  buildHanging(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    const post = (px, h) => {
      const p = new THREE.Mesh(this.geo.pole, m.gold);
      p.scale.set(0.035, h, 0.035);
      p.position.set(px, h / 2, -0.95);
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
    if (kind === 'bunting') {
      // a string of pennants between two gilt poles
      const lineY = 1.06;
      for (const s of [-1, 1]) {
        post(s * 0.85, lineY + 0.08);
        arm(s * 0.85, lineY + 0.04);
      }
      swing.position.set(0, lineY, -0.06);
      const pts = sag(-0.85, 0, 0.85, 0, 0, 0.12, 12);
      const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.008, 4), m.iron);
      swing.add(cord);
      const pos = [];
      const col = [];
      for (let i = 0; i < 7; i++) {
        const u = (i + 0.5) / 7;
        const px = -0.85 + 1.7 * u;
        const py = -0.12 * Math.sin(u * Math.PI);
        const w = 0.1;
        pos.push(px - w, py, 0, px + w, py, 0, px, py - 0.4, 0);
        _c.setHex(PENNANTS[i % PENNANTS.length]);
        for (let k = 0; k < 3; k++) col.push(_c.r, _c.g, _c.b);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      const flags = new THREE.Mesh(geo, m.pennant);
      flags.castShadow = true;
      swing.add(flags);
      size = { w: 1.3, clearance: 0.5, height: 1.06 };
    } else if (kind === 'trapeze') {
      // a trapeze frame on the roof, the bar hung low between two ropes
      const barY = 1.5;
      for (const s of [-1, 1]) {
        post(s * 0.6, barY + 0.06);
        arm(s * 0.6, barY + 0.02);
      }
      const cross = new THREE.Mesh(this.geo.pole, m.gold);
      cross.scale.set(0.03, 1.25, 0.03);
      cross.rotation.z = Math.PI / 2;
      cross.position.set(0, barY + 0.02, -0.06);
      g.add(cross);
      swing.position.set(0, barY, -0.06);
      for (const s of [-1, 1]) {
        const rope = new THREE.Mesh(this.geo.tube, m.white);
        rope.scale.set(1.2, 0.92, 1.2);
        rope.position.set(s * 0.28, 0, 0);
        swing.add(rope);
      }
      const bar = new THREE.Mesh(this.geo.pole, m.red);
      bar.scale.set(0.035, 0.62, 0.035);
      bar.rotation.z = Math.PI / 2;
      bar.position.y = -0.93;
      bar.castShadow = true;
      swing.add(bar);
      for (const s of [-1, 1]) {
        const tape = new THREE.Mesh(this.geo.pole, m.white);
        tape.scale.set(0.04, 0.08, 0.04);
        tape.rotation.z = Math.PI / 2;
        tape.position.set(s * 0.22, -0.93, 0);
        swing.add(tape);
      }
      size = { w: 0.72, clearance: 0.52, height: 1.1 };
    } else {
      // a string of big marquee bulbs, sagging low between two poles
      const lineY = 1.06;
      for (const s of [-1, 1]) {
        post(s * 0.75, lineY + 0.08);
        arm(s * 0.75, lineY + 0.04);
      }
      swing.position.set(0, lineY, -0.06);
      const pts = sag(-0.75, 0, 0.75, 0, 0, 0.3, 12);
      swing.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.01, 4), m.iron));
      for (let i = 1; i < 12; i += 2) {
        const p = pts[i];
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), i % 4 === 1 ? m.bulb : m.bulbB);
        b.position.set(p.x, p.y - 0.1, 0);
        swing.add(b);
        const cap = new THREE.Mesh(this.geo.pole, m.gold);
        cap.scale.set(0.03, 0.06, 0.03);
        cap.position.set(p.x, p.y - 0.02, 0);
        swing.add(cap);
      }
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffc27a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
      );
      glow.position.set(0, -0.4, 0);
      glow.scale.set(1.8, 0.9, 1);
      swing.add(glow);
      size = { w: 1.2, clearance: 0.56, height: 1.06 };
    }
    mergeByMaterial(swing);
    group.add(mergeByMaterial(g));
    this.swings.push({ x, g: swing, kick: 0, age: 0, ph: rng() * 6.28, kind });
    this.lights.push({ x, y: top + 1.0, z: 0.9, color: 0xffc27a, intensity: kind === 'bulbs' ? 6 : 3, distance: 6, flicker: kind === 'bulbs' });
    return size;
  },

  /** Planks laid across an open wagon: they drop into it when they give way (the wagon is dressed with the cars). */
  buildBrittle(group, x0, x1, top, rng) {
    const m = this.m;
    const len = x1 - x0;
    const n = Math.max(2, Math.round(len / 1.2));
    const seg = len / n;
    const plankGeo = new THREE.BoxGeometry(seg - 0.04, 0.07, 0.36);
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Group();
      p.position.set(x0 + seg * (i + 0.5), top, 0);
      for (const z of [-0.8, -0.4, 0, 0.4, 0.8]) {
        if (Math.abs(z) > 0.1 && rng() < 0.15) continue; // a plank missing here and there
        const b = new THREE.Mesh(plankGeo, m.plank);
        b.position.set((rng() - 0.5) * 0.06, -0.035 + (rng() - 0.5) * 0.02, z + (rng() - 0.5) * 0.03);
        b.rotation.y = (rng() - 0.5) * 0.06;
        b.castShadow = b.receiveShadow = true;
        p.add(b);
      }
      group.add(p);
      pieces.push(p);
    }
    // a lantern hung on a post at the near end
    const pole = new THREE.Mesh(this.geo.pole, m.iron);
    pole.scale.set(0.04, 1.5, 0.04);
    pole.position.set(x0 + 0.25, top + 0.55, -1.0);
    group.add(pole);
    const lamp = new THREE.Mesh(this.geo.unitBox, m.lamp);
    lamp.scale.set(0.13, 0.18, 0.13);
    lamp.position.set(x0 + 0.25, top + 1.2, -0.88);
    group.add(lamp);
    this.lights.push({ x: x0 + 1.2, y: top + 1.3, z: -0.2, color: 0xffc070, intensity: 7, distance: 8, flicker: true });
    return pieces;
  },

  /**
   * A trampoline on a flatcar: a dark mat on springs inside a padded frame. Returns
   * the mat's skin, which sags and springs when the cat lands on it.
   */
  buildBouncy(group, x0, x1, top, rng) {
    const m = this.m;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const depth = 2.2;
    const deck = top - 0.55;
    // legs down to the flatcar's deck
    for (const x of [x0 + 0.2, x1 - 0.2]) {
      for (const z of [-depth / 2 + 0.1, depth / 2 - 0.1]) {
        const leg = new THREE.Mesh(this.geo.pole, m.steel);
        leg.scale.set(0.05, top - deck, 0.05);
        leg.position.set(x, (top + deck) / 2 - 0.08, z);
        group.add(leg);
      }
    }
    // the padded frame round the mat
    const pads = new THREE.Group();
    const padded = (l) => {
      // a pad's stripes go round it, a band every 0.35u along its length
      const geo = new THREE.CylinderGeometry(0.13, 0.13, l, 12);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getY(i) * l) / 0.35, uv.getX(i));
      return geo;
    };
    for (const s of [-1, 1]) {
      const along = new THREE.Mesh(padded(len).rotateZ(Math.PI / 2), m.stripes);
      along.position.set(cx, top - 0.08, s * (depth / 2));
      pads.add(along);
      const across = new THREE.Mesh(padded(depth).rotateX(Math.PI / 2), m.stripes);
      across.position.set(s > 0 ? x1 : x0, top - 0.08, 0);
      pads.add(across);
    }
    for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.35) {
      for (const s of [-1, 1]) {
        const spring = new THREE.Mesh(this.geo.pole, m.steel);
        spring.scale.set(0.015, 0.2, 0.015);
        spring.rotation.x = s * 1.2;
        spring.position.set(x, top - 0.08, s * (depth / 2 - 0.12));
        pads.add(spring);
      }
    }
    group.add(mergeByMaterial(pads));
    // the mat: a little slack in the middle (more when it is landed on)
    const skin = new THREE.Group();
    skin.position.set(cx, top, 0);
    group.add(skin);
    const sheet = new THREE.PlaneGeometry(len - 0.25, depth - 0.25, Math.max(4, Math.round(len * 3)), 6).rotateX(-Math.PI / 2);
    const pos = sheet.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / (len - 0.25) + 0.5;
      const v = pos.getZ(i) / (depth - 0.25) + 0.5;
      pos.setY(i, -0.04 - 0.06 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
    }
    sheet.computeVertexNormals();
    const mat = new THREE.Mesh(sheet, m.mat);
    mat.receiveShadow = true;
    skin.add(mat);
    // a spot lamp on a post, lighting the mat
    const pole = new THREE.Mesh(this.geo.pole, m.gold);
    pole.scale.set(0.035, 1.9, 0.035);
    pole.position.set(x0 + 0.2, deck + 0.95, -1.15);
    group.add(pole);
    const lamp = new THREE.Mesh(this.geo.ball, m.lamp);
    lamp.scale.setScalar(0.1);
    lamp.position.set(x0 + 0.2, deck + 1.92, -1.05);
    group.add(lamp);
    this.lights.push({ x: cx, y: top + 1.4, z: 0.6, color: 0xffd8a0, intensity: 6, distance: 7 });
    const t = { x0, x1, skin, kick: 0, age: 0, ph: rng() * 6.28 };
    this.tramps.push(t);
    return t;
  },

  /** Home: a ring of bulbs over the walk, and ahead the tender and the engine. */
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
    // the gate: a gilt arch of bulbs standing behind the walk
    const back = -0.95;
    for (const s of [-1, 1]) add(this.geo.pole, m.gold, gx + s * 1.1, top + 1.1, back, true).scale.set(0.045, 2.2, 0.045);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      pts.push(new THREE.Vector3(gx - 1.1 * Math.cos(a), top + 2.2 + 0.7 * Math.sin(a), back));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    add(new THREE.TubeGeometry(curve, 30, 0.04, 6), m.gold, 0, 0, 0);
    for (let i = 0; i <= 14; i++) {
      const p = curve.getPointAt(i / 14);
      this.bulbs[i % 2].push([_m.compose(_p.set(p.x, p.y, p.z + 0.06), _q.identity(), _s.setScalar(1)).clone(), BULBS[i % BULBS.length]]);
    }
    for (let y = top + 0.2; y < top + 2.1; y += 0.32) {
      for (const s of [-1, 1]) this.bulbs[Math.round(y * 3) % 2].push([_m.compose(_p.set(gx + s * 1.1, y, back + 0.06), _q.identity(), _s.setScalar(1)).clone(), BULBS[2]]);
    }
    // a stovepipe on the coach's roof, its smoke drawn with the engine's
    add(this.geo.pole, m.sooty, gx + 6, top + 0.45, -0.95, true).scale.set(0.09, 0.9, 0.09);
    add(new THREE.ConeGeometry(0.16, 0.12, 10), m.sooty, gx + 6, top + 0.95, -0.95);
    this.stove = { x: gx + 6, y: top + 1.0, z: -0.95 };

    // the tender and the engine, ahead of the coach
    const tx0 = last.x1 + 2.2;
    const tx1 = tx0 + 8;
    const ex0 = tx1 + 1.6;
    const ex1 = ex0 + 15;
    this.engine = { x0: tx0, x1: ex1, chimney: { x: ex1 - 2.6, y: 2.5 } };
    // tender: a coal box, its top heaped
    add(boxWorldUV(8, 1.6, HALF * 2, 2), m.sooty, (tx0 + tx1) / 2, FLOOR + 0.8, 0, true);
    for (const s of [-1, 1]) {
      add(this.geo.unitBox, m.red, (tx0 + tx1) / 2, FLOOR + 1.62, s * (HALF + 0.02)).scale.set(8.1, 0.1, 0.1);
      add(this.geo.unitBox, m.red, s > 0 ? tx1 : tx0, FLOOR + 1.62, 0).scale.set(0.1, 0.1, HALF * 2 + 0.1);
    }
    for (let i = 0; i < 22; i++) add(this.geo.lump, m.dark, tx0 + 0.5 + rng() * 7, FLOOR + 1.5 + rng() * 0.25, (rng() - 0.5) * 2).scale.set(0.45 + rng() * 0.4, 0.3, 0.45);
    this.chassis(g, tx0, tx1, rng);
    // engine: a long boiler, a smokebox and a chimney up front, a steam dome, the cab behind with the fire glowing
    const by = FLOOR + 1.35;
    const boiler = add(new THREE.CylinderGeometry(1.0, 1.0, 10, 24).rotateZ(Math.PI / 2), m.sooty, ex0 + 3.5 + 5, by, 0, true);
    boiler.receiveShadow = true;
    for (let i = 0; i < 4; i++) add(new THREE.CylinderGeometry(1.03, 1.03, 0.12, 24).rotateZ(Math.PI / 2), m.gold, ex0 + 4.5 + i * 2.6, by, 0);
    add(new THREE.CylinderGeometry(1.05, 1.05, 1.4, 24).rotateZ(Math.PI / 2), m.iron, ex1 - 1.0, by, 0, true);
    add(new THREE.CircleGeometry(0.9, 24).rotateY(Math.PI / 2), m.iron, ex1 - 0.29, by, 0);
    add(new THREE.CylinderGeometry(0.28, 0.34, 1.2, 16), m.sooty, ex1 - 2.6, by + 1.4, 0, true);
    add(new THREE.CylinderGeometry(0.4, 0.3, 0.2, 16), m.gold, ex1 - 2.6, by + 2.05, 0);
    add(new THREE.SphereGeometry(0.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.gold, ex0 + 7.6, by + 0.9, 0, true);
    add(boxWorldUV(3.4, 2.6, HALF * 2, 2), m.paint[0], ex0 + 1.7, FLOOR + 1.6, 0, true);
    add(boxWorldUV(3.8, 0.15, HALF * 2 + 0.3, 1), m.roof, ex0 + 1.7, FLOOR + 2.98, 0, true);
    for (const wx of [ex0 + 1.0, ex0 + 2.4]) add(new THREE.PlaneGeometry(0.8, 0.7), m.fire, wx, FLOOR + 2.2, HALF + 0.01);
    add(boxWorldUV(13.5, 0.2, HALF * 2 + 0.2, 1), m.red, ex0 + 7.8, FLOOR + 0.2, 0);
    add(new THREE.ConeGeometry(0.8, 1.0, 4).rotateZ(-Math.PI / 2).rotateX(Math.PI / 4), m.red, ex1 + 0.3, FLOOR - 0.15, 0);
    add(this.geo.ball, m.head, ex1 - 0.2, by + 0.95, 0).scale.set(0.12, 0.22, 0.22);
    const beam = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xfff0c0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    beam.position.set(ex1 + 0.2, by + 0.95, 0.2);
    beam.scale.set(3, 3, 1);
    g.add(beam);
    // big driving wheels, coupled by a red rod
    for (const wx of [ex0 + 4.2, ex0 + 6.4, ex0 + 8.6]) this.wheels.push([wx, RAIL_Y + 0.75, RAIL_Z + 0.25, 0.75, true]);
    for (const wx of [ex0 + 11.4, ex0 + 13.0]) this.wheels.push([wx, RAIL_Y + 0.42, RAIL_Z + 0.25, 0.42, true]);
    add(this.geo.unitBox, m.red, ex0 + 6.4, RAIL_Y + 0.75, RAIL_Z + 0.36).scale.set(4.6, 0.1, 0.05);
    level.group.add(mergeByMaterial(g));
    level.fixtures.push({ x: gx, y: top + 2.0, z: -0.2, color: 0xffc27a, intensity: 5, distance: 7, flicker: true });
    level.fixtures.push({ x: ex0 + 1.7, y: FLOOR + 2.2, z: HALF + 0.8, color: 0xff8a3a, intensity: 6, distance: 7, flicker: true });
  },

  /** A car's underframe: the sole bar, a bogie at each end with its wheels, buffers. */
  chassis(group, x0, x1, rng) {
    const m = this.m;
    const len = x1 - x0;
    const sole = new THREE.Mesh(boxWorldUV(len - 0.3, 0.28, HALF * 2 - 0.2, 1), m.iron);
    sole.position.set((x0 + x1) / 2, FLOOR - 0.14, 0);
    group.add(sole);
    const bogies = len < 4 ? [(x0 + x1) / 2] : [x0 + 1.25, x1 - 1.25];
    for (const bx of bogies) {
      const frame = new THREE.Mesh(this.geo.unitBox, m.iron);
      frame.scale.set(1.9, 0.22, 0.1);
      frame.position.set(bx, RAIL_Y + 0.46, RAIL_Z + 0.16);
      group.add(frame);
      const bolster = new THREE.Mesh(this.geo.unitBox, m.iron);
      bolster.scale.set(0.5, 0.4, HALF * 1.6);
      bolster.position.set(bx, FLOOR - 0.38, 0);
      group.add(bolster);
      for (const s of [-1, 1]) this.wheels.push([bx + s * 0.62, RAIL_Y + WHEEL_R, RAIL_Z + 0.06, WHEEL_R, true]);
    }
    for (const ex of [x0 + 0.05, x1 - 0.05]) {
      for (const z of [-0.75, 0.75]) {
        const buf = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.25, 10).rotateZ(Math.PI / 2), m.steel);
        buf.position.set(ex + (ex < (x0 + x1) / 2 ? -0.1 : 0.1), FLOOR - 0.12, z);
        group.add(buf);
      }
    }
  },

  // --- dressing ----------------------------------------------------------------
  dress(world) {
    const { quality } = world;
    const S = (world.themeState = {
      scroll: 0,
      strips: [],
      cats: null,
      flies: null,
      smoke: null,
      embers: null,
      wheels: null,
      sails: [],
      lion: null,
      elephants: [],
      pieces: [],
      tunnelLights: [],
      dark: 0,
      base: null,
      finale: false,
      finaleT: 0,
    });
    this.buildCars(world);
    this.buildTrack(world, S);
    this.buildVerges(world, S);
    this.buildFields(world, S);
    this.buildHills(world, S);
    this.buildSetPieces(world, S);
    this.buildCats(world, S);
    this.buildSmoke(world, S, Math.round(48 * quality.particles));
    this.buildInstanced(world, S);
    for (const l of this.lights) world.fixtures.push(l);
    const hemi = world.scene.children.find((o) => o.isHemisphereLight);
    S.base = {
      hemi,
      hemiInt: hemi.intensity,
      moon: world.moon.intensity,
      fill: world.catFill.intensity,
      bg: world.scene.background.clone(),
      fog: world.scene.fog.color.clone(),
    };
  },

  /**
   * The cars: platforms that touch belong to one car. Each part of a car is
   * dressed for what it is: a painted circus wagon, the lion's cage, the
   * elephant car, a sleeping coach, a little wheeled wagon on a flatcar, an open
   * wagon (under old planks), a flatcar (under a trampoline).
   */
  buildCars(world) {
    const { scene, level, rng } = world;
    const pls = level.platforms;
    const cars = [];
    for (const pl of pls) {
      const car = cars[cars.length - 1];
      if (car && Math.abs(pl.x0 - car.x1) < 0.01) {
        car.parts.push(pl);
        car.x1 = pl.x1;
      } else cars.push({ x0: pl.x0, x1: pl.x1, parts: [pl] });
    }
    this.cars = cars;
    let cages = 0;
    let stock = 0;
    cars.forEach((car, ci) => {
      const g = new THREE.Group();
      this.chassis(g, car.x0, car.x1, rng);
      // couplings to the car in front
      const next = cars[ci + 1];
      if (next) {
        const bar = new THREE.Mesh(this.geo.unitBox, this.m.iron);
        bar.scale.set(next.x0 - car.x1 + 0.3, 0.08, 0.08);
        bar.position.set((car.x1 + next.x0) / 2, FLOOR - 0.15, 0);
        g.add(bar);
      }
      const paint = this.m.paint[ci % this.m.paint.length];
      const lone = car.parts.length === 1;
      for (const pl of car.parts) {
        const len = pl.x1 - pl.x0;
        if (pl.bouncy) this.flatcar(g, pl, pl.top - 0.55);
        else if (pl.brittle) this.gondola(g, pl, paint);
        else if (lone && len <= 6.5) this.wagon(g, pl, paint, rng);
        else if (pl.top >= 1.6 && stock++ < 2) this.stockCar(world, g, pl, stock === 1);
        else if (lone && len >= 20 && pl.top <= 0.2) this.coach(g, pl, rng);
        else if (!lone && len >= 14 && pl.top <= 0.4 && ci % 3 === 0) this.coach(g, pl, rng);
        else if (len >= 15 && pl.top <= 1.0 && ci % 4 === 2 && cages++ < 2) this.cage(world, g, pl, paint);
        else this.boxBody(g, pl, paint, ci, rng);
      }
      scene.add(mergeByMaterial(g));
    });
  },

  /** The roof over a body: dark, with a gilt edge along the front. */
  roof(g, { x0, x1, top }) {
    const r = new THREE.Mesh(boxWorldUV(x1 - x0 + 0.06, 0.08, HALF * 2 + 0.16, 2), this.m.roof);
    r.position.set((x0 + x1) / 2, top - 0.04, 0);
    r.receiveShadow = r.castShadow = true;
    g.add(r);
    const trim = new THREE.Mesh(this.geo.unitBox, this.m.gold);
    trim.scale.set(x1 - x0 + 0.06, 0.05, 0.04);
    trim.position.set((x0 + x1) / 2, top - 0.1, HALF + 0.09);
    g.add(trim);
  },

  /** Marquee bulbs along the top front edge between x0 and x1. */
  bulbRow(x0, x1, y) {
    let k = 0;
    for (let x = x0 + 0.2; x < x1 - 0.1; x += 0.36, k++) {
      this.bulbs[k % 2].push([_m.compose(_p.set(x, y, HALF + 0.05), _q.identity(), _s.setScalar(1)).clone(), BULBS[k % BULBS.length]]);
    }
  },

  body(g, { x0, x1 }, y1, mat) {
    const h = y1 - FLOOR;
    const b = new THREE.Mesh(boxWorldUV(x1 - x0, h, HALF * 2, 2), mat);
    b.position.set((x0 + x1) / 2, FLOOR + h / 2, 0);
    b.receiveShadow = true;
    g.add(b);
  },

  /** A painted circus wagon: its name on a gilt panel, bulbs along the roof. */
  boxBody(g, pl, paint, ci, rng) {
    const { x0, x1, top } = pl;
    const len = x1 - x0;
    this.body(g, pl, top - 0.08, paint);
    this.roof(g, pl);
    this.bulbRow(x0, x1, top - 0.2);
    const h = top - 0.08 - FLOOR;
    if (len >= 7) {
      const w = Math.min(len - 1.4, 9);
      const ph = Math.min(h * 0.6, w / 4);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, ph), this.m.panels[ci % this.m.panels.length]);
      panel.position.set((x0 + x1) / 2, FLOOR + h * 0.5, HALF + 0.012);
      g.add(panel);
    } else {
      // a short raised part: a round window, lit
      const win = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), this.m.paneLit);
      win.position.set((x0 + x1) / 2, top - 0.75, HALF + 0.012);
      g.add(win);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.04, 6, 16), this.m.gold);
      ring.position.copy(win.position);
      g.add(ring);
    }
    this.lights.push({ x: (x0 + x1) / 2, y: top - 0.3, z: HALF + 0.9, color: 0xffc27a, intensity: 3.5, distance: 6, flicker: rng() < 0.3 });
  },

  /** A sleeping coach: maroon over a cream band, a row of windows, some lit. */
  coach(g, pl, rng) {
    const { x0, x1, top } = pl;
    this.body(g, pl, top - 0.08, this.m.coach);
    const band = new THREE.Mesh(this.geo.unitBox, this.m.cream);
    band.scale.set(x1 - x0 - 0.1, 0.12, 0.02);
    band.position.set((x0 + x1) / 2, FLOOR + 0.45, HALF + 0.01);
    g.add(band);
    this.roof(g, pl);
    for (let x = x0 + 1.0; x < x1 - 0.6; x += 1.3) {
      const lit = rng() < 0.55;
      (lit ? this.windows.lit : this.windows.dark).push(_m.compose(_p.set(x, top - 0.85, HALF + 0.012), _q.identity(), _s.set(0.55, 0.7, 1)).clone());
      if (lit && rng() < 0.4) this.lights.push({ x, y: top - 0.8, z: HALF + 0.9, color: 0xffb46a, intensity: 3, distance: 5 });
    }
  },

  /** A little circus wagon on its own spoked wheels, riding on a flatcar. */
  wagon(g, pl, paint, rng) {
    const { x0, x1, top } = pl;
    const deck = FLOOR + 0.25;
    const deckM = new THREE.Mesh(boxWorldUV(x1 - x0, 0.25, HALF * 2, 1), this.m.wood);
    deckM.position.set((x0 + x1) / 2, FLOOR + 0.125, 0);
    g.add(deckM);
    const inner = { x0: x0 + 0.35, x1: x1 - 0.35 };
    const h = top - 0.08 - (deck + 0.55);
    const b = new THREE.Mesh(boxWorldUV(inner.x1 - inner.x0, h, HALF * 2 - 0.3, 2), paint);
    b.position.set((x0 + x1) / 2, deck + 0.55 + h / 2, 0);
    g.add(b);
    this.roof(g, pl);
    this.bulbRow(x0, x1, top - 0.2);
    // (riding on the flatcar, they don't turn)
    for (const wx of [inner.x0 + 0.6, inner.x1 - 0.6]) this.wheels.push([wx, deck + 0.42, HALF - 0.1, 0.42, false]);
    // a sunburst painted on its side
    const sun = new THREE.Mesh(new THREE.CircleGeometry(Math.min(0.55, h * 0.35), 18), this.m.starsBlue);
    sun.position.set((x0 + x1) / 2, deck + 0.55 + h * 0.55, HALF - 0.14);
    g.add(sun);
    this.lights.push({ x: (x0 + x1) / 2, y: top - 0.3, z: HALF + 0.9, color: 0xffc27a, intensity: 3, distance: 5, flicker: rng() < 0.3 });
  },

  /** The lion's cage: a barred front, straw inside and the lion asleep on it. */
  cage(world, g, pl, paint) {
    const { x0, x1, top } = pl;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const h = top - 0.08 - FLOOR;
    const back = new THREE.Mesh(boxWorldUV(len, h, 0.15, 2), paint);
    back.position.set(cx, FLOOR + h / 2, -HALF + 0.075);
    g.add(back);
    for (const ex of [x0 + 0.15, x1 - 0.15]) {
      const end = new THREE.Mesh(boxWorldUV(0.3, h, HALF * 2, 2), paint);
      end.position.set(ex, FLOOR + h / 2, 0);
      g.add(end);
    }
    const floor = new THREE.Mesh(boxWorldUV(len, 0.2, HALF * 2, 2), paint);
    floor.position.set(cx, FLOOR + 0.1, 0);
    g.add(floor);
    const straw = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.4, h - 0.3), this.m.straw);
    straw.position.set(cx, FLOOR + 0.2 + (h - 0.3) / 2, -HALF + 0.16);
    g.add(straw);
    this.roof(g, pl);
    this.bulbRow(x0, x1, top - 0.2);
    for (let x = x0 + 0.45; x < x1 - 0.3; x += 0.28) this.bars.push(_m.compose(_p.set(x, FLOOR + h / 2 + 0.1, HALF - 0.05), _q.identity(), _s.set(0.025, h - 0.2, 0.025)).clone());
    // the lion, asleep, its mane rising and falling
    const lion = new THREE.Group();
    lion.position.set(cx + 1.2, FLOOR + 0.2, -0.2);
    const part = (geo, mat, sx, sy, sz, px, py, pz) => {
      const o = new THREE.Mesh(geo, mat);
      o.scale.set(sx, sy, sz);
      o.position.set(px, py, pz);
      lion.add(o);
      return o;
    };
    const body = part(this.geo.ball, this.m.lion, 0.75, 0.3, 0.34, 0, 0.3, 0);
    part(this.geo.lump, this.m.mane, 0.36, 0.38, 0.4, 0.72, 0.36, 0.04);
    part(this.geo.ball, this.m.lion, 0.22, 0.2, 0.22, 0.86, 0.3, 0.14);
    part(this.geo.ball, this.m.lion, 0.1, 0.08, 0.1, 1.04, 0.25, 0.2);
    for (const s of [-1, 1]) part(this.geo.ball, this.m.lion, 0.2, 0.08, 0.09, 0.6, 0.08, 0.2 + s * 0.12);
    part(this.geo.pole, this.m.lion, 0.04, 0.7, 0.04, -0.95, 0.12, 0.2).rotation.z = Math.PI / 2 - 0.2;
    part(this.geo.lump, this.m.mane, 0.08, 0.08, 0.08, -1.32, 0.2, 0.2);
    world.scene.add(lion);
    this.lionBody = body;
    this.lights.push({ x: cx, y: top - 0.6, z: 0.4, color: 0xffb060, intensity: 4, distance: 6, flicker: true });
  },

  /** A tall stock car of slatted boards; the first has an elephant with its trunk out of a window. */
  stockCar(world, g, pl, elephant) {
    const { x0, x1, top } = pl;
    const cx = (x0 + x1) / 2;
    this.body(g, pl, top - 0.08, this.m.slats);
    this.roof(g, pl);
    this.bulbRow(x0, x1, top - 0.2);
    if (!elephant) return;
    const wx = cx + 2.2;
    const wy = top - 1.25;
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.3), this.m.dark);
    hole.position.set(wx, wy, HALF + 0.012);
    g.add(hole);
    const frame = new THREE.Mesh(this.geo.unitBox, this.m.gold);
    frame.scale.set(1.7, 0.08, 0.05);
    frame.position.set(wx, wy + 0.68, HALF + 0.03);
    g.add(frame);
    const e = new THREE.Group();
    e.position.set(wx, wy - 0.05, HALF + 0.1);
    const part = (geo, mat, sx, sy, sz, px, py, pz, parent = e) => {
      const o = new THREE.Mesh(geo, mat);
      o.scale.set(sx, sy, sz);
      o.position.set(px, py, pz);
      parent.add(o);
      return o;
    };
    part(this.geo.ball, this.m.elephant, 0.5, 0.48, 0.4, 0, 0.1, -0.15);
    for (const s of [-1, 1]) {
      const ear = part(this.geo.ball, this.m.elephant, 0.5, 0.58, 0.07, s * 0.62, 0.06, -0.02);
      ear.rotation.y = s * 0.25;
      part(this.geo.ball, this.m.eye, 0.04, 0.05, 0.03, s * 0.22, 0.24, 0.22);
      const tusk = part(new THREE.ConeGeometry(0.045, 0.32, 8), this.m.tusk, 1, 1, 1, s * 0.17, -0.22, 0.3);
      tusk.rotation.x = 1.3;
    }
    // the trunk: segments, each turned a little further out and down, swaying
    const trunk = [];
    let parent = e;
    let at = new THREE.Vector3(0, -0.08, 0.3);
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Group();
      seg.position.copy(at);
      seg.rotation.x = i === 0 ? -0.5 : 0.1;
      parent.add(seg);
      part(this.geo.pole, this.m.elephant, 0.12 - i * 0.008, 0.2, 0.12 - i * 0.008, 0, -0.1, 0, seg);
      trunk.push(seg);
      parent = seg;
      at = new THREE.Vector3(0, -0.18, 0);
    }
    world.scene.add(e);
    this.elephant = { e, trunk };
  },

  /** An open wagon under old planks: low sides, dark inside. */
  gondola(g, pl, paint) {
    const { x0, x1, top } = pl;
    const len = x1 - x0;
    const h = top - 0.06 - FLOOR;
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(boxWorldUV(len, h, 0.12, 2), this.m.slats);
      side.position.set((x0 + x1) / 2, FLOOR + h / 2, s * (HALF - 0.06));
      g.add(side);
      const end = new THREE.Mesh(boxWorldUV(0.12, h, HALF * 2, 2), this.m.slats);
      end.position.set(s > 0 ? x1 - 0.06 : x0 + 0.06, FLOOR + h / 2, 0);
      g.add(end);
    }
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.2, HALF * 2 - 0.2).rotateX(-Math.PI / 2), this.m.dark);
    inside.position.set((x0 + x1) / 2, FLOOR + 0.05, 0);
    g.add(inside);
    const rim = new THREE.Mesh(this.geo.unitBox, paint);
    rim.scale.set(len, 0.1, 0.16);
    rim.position.set((x0 + x1) / 2, top - 0.1, HALF - 0.02);
    g.add(rim);
  },

  /** A flatcar: a plank deck on the underframe. */
  flatcar(g, { x0, x1 }, deck) {
    const d = new THREE.Mesh(boxWorldUV(x1 - x0, deck - FLOOR, HALF * 2, 1), this.m.wood);
    d.position.set((x0 + x1) / 2, (deck + FLOOR) / 2, 0);
    d.receiveShadow = true;
    g.add(d);
  },

  // --- the country going by --------------------------------------------------
  /**
   * A strip of the country, built over local x in [0, 3P) so that what is in it
   * repeats every P; each frame it is set back by the distance the train has
   * come (times f: far strips are cheated slower, as if much further off) and
   * wrapped round the camera.
   */
  strip(world, S, P, f) {
    const g = new THREE.Group();
    world.scene.add(g);
    S.strips.push({ g, P, f });
    return g;
  },

  /** Instanced copies of a geometry inside a strip group. */
  scatter(g, geo, mat, list, shadow = false) {
    if (!list.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((item, i) => {
      if (Array.isArray(item)) {
        mesh.setMatrixAt(i, item[0]);
        mesh.setColorAt(i, _c.set(item[1]));
      } else mesh.setMatrixAt(i, item);
    });
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  },

  /** A textured strip of ground in a strip group: len 3P along x, z0..z1, at y. */
  ground(g, P, map, color, z0, z1, y, tile) {
    const tex = map.clone();
    tex.needsUpdate = true;
    tex.repeat.set((3 * P) / tile, (z1 - z0) / tile);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3 * P, z1 - z0), new THREE.MeshStandardMaterial({ map: tex, color, roughness: 1 }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(1.5 * P, y, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  },

  /** The rails (which look the same wherever the train is), and the ballast and sleepers going by under them. */
  buildTrack(world, S) {
    const { scene, level, tex } = world;
    const len = level.endX + 240;
    for (const z of [-RAIL_Z, RAIL_Z]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.08), this.m.steel);
      rail.position.set(len / 2 - 100, RAIL_Y - 0.05, z);
      scene.add(rail);
    }
    const P = 24;
    const g = this.strip(world, S, P, 1);
    this.ground(g, P, tex.gravel, 0x6a6660, -1.7, 1.7, RAIL_Y - 0.24, 2);
    for (const s of [-1, 1]) {
      // the shoulders of the embankment, sloping down to the fields
      const shoulder = this.ground(g, P, tex.gravel, 0x4a4842, 0, 2.0, 0, 2);
      shoulder.rotation.set(-Math.PI / 2 + s * 0.35, 0, 0);
      shoulder.position.set(1.5 * P, RAIL_Y - 0.57, s * 2.6);
    }
    const sleepers = [];
    _q.identity();
    for (let x = 0; x < 3 * P; x += 0.75) sleepers.push(_m.compose(_p.set(x, RAIL_Y - 0.17, 0), _q, _s.set(0.28, 0.12, 2.3)).clone());
    this.scatter(g, this.geo.unitBox, this.m.wood, sleepers);
  },

  /** Either side of the line: grass, bushes, a fence in front, telegraph poles and their wires behind, fireflies. */
  buildVerges(world, S) {
    const { rng, tex } = world;
    const m = this.m;
    const leaf = new THREE.MeshStandardMaterial({ color: 0x1e3420, roughness: 0.95, flatShading: true });
    // in front
    const P = 48;
    const g = this.strip(world, S, P, 1);
    this.ground(g, P, tex.lawn, 0x8a9a7a, 3.4, 18, RAIL_Y - 0.9, 2);
    const bushes = [];
    const posts = [];
    for (let x = 0; x < P; x += 0.8 + rng() * 3) {
      const r = 0.3 + rng() * 0.5;
      const z = 3.5 + rng() * 9;
      _q.setFromEuler(_e.set(rng() * 3, rng() * 3, 0));
      for (let k = 0; k < 3; k++) bushes.push(_m.compose(_p.set(x + k * P, RAIL_Y - 0.9 + r * 0.6, z), _q, _s.set(r * 1.3, r, r)).clone());
    }
    for (let x = 0; x < 3 * P; x += 2.4) posts.push(_m.compose(_p.set(x, RAIL_Y - 0.45, 6.5), _q.identity(), _s.set(0.08, 0.9, 0.08)).clone());
    this.scatter(g, this.geo.clump, leaf, bushes);
    this.scatter(g, this.geo.unitBox, m.wood, posts);
    for (const y of [-0.2, -0.5]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3 * P, 0.05, 0.04), m.wood);
      rail.position.set(1.5 * P, RAIL_Y + y, 6.5);
      g.add(rail);
    }
    // fireflies over the verge: points in the strip, twinkling
    const n = Math.round(36 * world.quality.particles);
    const fpos = new Float32Array(n * 3);
    for (let i = 0; i < n; i += 3) {
      const [x, y, z] = [rng() * P, RAIL_Y - 0.5 + rng() * 1.6, 3.5 + rng() * 8];
      for (let k = 0; k < 3 && i + k < n; k++) fpos.set([x + k * P, y, z], (i + k) * 3);
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.BufferAttribute(fpos, 3));
    fgeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const flies = new THREE.Points(fgeo, new THREE.PointsMaterial({ size: 0.2, map: tex.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    flies.frustumCulled = false;
    g.add(flies);
    S.flies = { pts: flies, n, ph: Array.from({ length: n }, () => rng() * 6.28) };

    // behind
    const Q = 60;
    const h = this.strip(world, S, Q, 1);
    this.ground(h, Q, tex.lawn, 0x7a8a6a, -16, -3.4, RAIL_Y - 0.9, 2);
    const poles = [];
    const arms = [];
    const wire = [];
    for (let x = 0; x < 3 * Q; x += 15) {
      poles.push(_m.compose(_p.set(x, RAIL_Y + 1.6, -10), _q.identity(), _s.set(0.08, 5, 0.08)).clone());
      arms.push(_m.compose(_p.set(x, RAIL_Y + 3.8, -10), _q.identity(), _s.set(0.06, 0.08, 1.4)).clone());
      for (const z of [-10.6, -9.4]) {
        const pts = sag(x, RAIL_Y + 3.86, x + 15, RAIL_Y + 3.86, z, 0.4, 10);
        for (let i = 0; i < pts.length - 1; i++) wire.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
      }
    }
    this.scatter(h, this.geo.pole, m.wood, poles, true);
    this.scatter(h, this.geo.unitBox, m.wood, arms);
    const wgeo = new THREE.BufferGeometry();
    wgeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    h.add(new THREE.LineSegments(wgeo, new THREE.LineBasicMaterial({ color: 0x1a1c22 })));
    const back = [];
    for (let x = 0; x < Q; x += 1 + rng() * 4) {
      const r = 0.4 + rng() * 0.6;
      const z = -10.5 - rng() * 5;
      _q.setFromEuler(_e.set(rng() * 3, rng() * 3, 0));
      for (let k = 0; k < 3; k++) back.push(_m.compose(_p.set(x + k * Q, RAIL_Y - 0.9 + r * 0.6, z), _q, _s.set(r * 1.4, r, r)).clone());
    }
    this.scatter(h, this.geo.clump, leaf, back);
  },

  /** The fields beyond: wheat and plough, hedgerows, trees, haystacks, a farm with its lights on, a windmill. */
  buildFields(world, S) {
    const { rng, tex } = world;
    const P = 200;
    const g = this.strip(world, S, P, 0.55);
    this.ground(g, P, tex.wheat, 0x9a9a88, -34, -16, RAIL_Y - 1.0, 4);
    this.ground(g, P, tex.plough, 0x8a8478, -60, -34, RAIL_Y - 1.05, 4);
    const leaf = new THREE.MeshStandardMaterial({ color: 0x1a2c1c, roughness: 0.95, flatShading: true });
    const bark = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 });
    const hay = new THREE.MeshStandardMaterial({ color: 0x8a7a4a, roughness: 1 });
    const crowns = [];
    const trunks = [];
    const hedges = [];
    const stacks = [];
    const add3 = (list, x, ...rest) => {
      for (let k = 0; k < 3; k++) list.push(_m.compose(_p.set(x + k * P, rest[0], rest[1]), rest[2], rest[3]).clone());
    };
    for (let x = 0; x < P; x += 0.9 + rng() * 0.5) add3(hedges, x, RAIL_Y - 0.7, -34 + (rng() - 0.5) * 0.4, _q.setFromEuler(_e.set(rng() * 3, rng() * 3, 0)).clone(), _s.set(0.9, 0.6, 0.7).clone());
    for (let x = 0; x < P; x += 6 + rng() * 14) {
      const z = -17 - rng() * 40;
      const h = 2 + rng() * 2.5;
      add3(trunks, x, RAIL_Y - 1 + h / 2, z, _q.identity().clone(), _s.set(0.18, h, 0.18).clone());
      add3(crowns, x, RAIL_Y - 1 + h + 0.4, z, _q.setFromEuler(_e.set(rng(), rng() * 3, 0)).clone(), _s.set(1.4 + rng(), 1.2 + rng() * 0.6, 1.3 + rng()).clone());
    }
    for (let x = 0; x < P; x += 3 + rng() * 9) add3(stacks, x, RAIL_Y - 0.6, -18 - rng() * 14, _q.identity().clone(), _s.set(0.7, 0.8, 0.7).clone());
    this.scatter(g, this.geo.lump, leaf, crowns);
    this.scatter(g, this.geo.pole, bark, trunks);
    this.scatter(g, this.geo.clump, leaf, hedges);
    this.scatter(g, new THREE.CylinderGeometry(0.75, 1, 1, 10), hay, stacks);
    // a farm: a house with lit windows and a barn, once a strip
    const farm = new Mesher();
    const wall = new THREE.Color(0x8a8070);
    const roof = new THREE.Color(0x3a2a24);
    const lit = [];
    for (let k = 0; k < 3; k++) {
      const fx = 70 + k * P;
      const fz = -40;
      const y0 = RAIL_Y - 1.0;
      farm.box(fx, fx + 6, y0, y0 + 3, fz - 3, fz, wall);
      farm.quad([fx - 0.2, y0 + 3, fz + 0.3], [fx + 6.2, y0 + 3, fz + 0.3], [fx + 6.2, y0 + 4.6, fz - 1.5], [fx - 0.2, y0 + 4.6, fz - 1.5], roof);
      farm.box(fx + 8, fx + 15, y0, y0 + 4, fz - 5, fz - 1, new THREE.Color(0x5a2a22));
      farm.quad([fx + 7.8, y0 + 4, fz - 0.8], [fx + 15.2, y0 + 4, fz - 0.8], [fx + 15.2, y0 + 5.6, fz - 3], [fx + 7.8, y0 + 5.6, fz - 3], roof);
      for (const wx of [fx + 1.2, fx + 3, fx + 4.8]) lit.push(_m.compose(_p.set(wx, y0 + 1.6, fz + 0.02), _q.identity(), _s.set(0.6, 0.8, 1)).clone());
    }
    g.add(new THREE.Mesh(farm.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
    this.scatter(g, new THREE.PlaneGeometry(1, 1), this.m.paneLit, lit);
    // a windmill on a rise, its sails turning in the night wind
    for (let k = 0; k < 3; k++) {
      const wx = 150 + k * P;
      const mill = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 6, 10), new THREE.MeshStandardMaterial({ color: 0x8a8478, roughness: 0.9 }));
      mill.position.set(wx, RAIL_Y + 2, -48);
      g.add(mill);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.4, 10), new THREE.MeshStandardMaterial({ color: 0x3a2a24, roughness: 0.9 }));
      cap.position.set(wx, RAIL_Y + 5.7, -48);
      g.add(cap);
      const sails = new THREE.Group();
      sails.position.set(wx, RAIL_Y + 4.6, -46.6);
      for (let i = 0; i < 4; i++) {
        const sail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.05).translate(0.2, 2.2, 0), new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.9 }));
        sail.rotation.z = (i / 4) * Math.PI * 2;
        sails.add(sail);
      }
      g.add(sails);
      S.sails.push(sails);
    }
  },

  /** Hills with a village on them, and mountains far off; both sliding slowly. */
  buildHills(world, S) {
    const { rng, tex } = world;
    const range = (P, f, z, base, amp, step, topCol, darkCol) => {
      const g = this.strip(world, S, P, f);
      const ph = rng() * 10;
      const ph2 = rng() * 10;
      const height = (x) => base + amp * (0.55 + 0.45 * Math.sin((x / P) * Math.PI * 2 * 2 + ph)) * (0.6 + 0.4 * Math.sin((x / P) * Math.PI * 2 * 5 + ph2));
      const pos = [];
      const cols = [];
      const idx = [];
      const hi = new THREE.Color(topCol);
      const lo = new THREE.Color(darkCol);
      let i = 0;
      for (let x = 0; x <= 3 * P + 0.01; x += step) {
        pos.push(x, height(x), z, x, -30, z);
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
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
      return { g, height };
    };
    range(420, 0.07, -88, 1.5, 7.5, 6, 0x1e2638, 0x080a12);
    const hills = range(300, 0.2, -66, -4, 5.5, 3, 0x14201c, 0x070a0a);
    // the village on the hillside: lit windows, a church spire
    const lights = [];
    const P = 300;
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 40; i++) {
        const x = 90 + (rng() - 0.5) * 40 + k * P;
        lights.push(x, hills.height(x) - 0.5 - rng() * 2.5, -65);
      }
      const spire = new Mesher();
      const c = new THREE.Color(0x0c1012);
      const sx = 90 + k * P;
      const sy = hills.height(sx) - 0.8;
      spire.box(sx - 0.8, sx + 0.8, sy - 3, sy + 3.5, -66, -64.5, c);
      spire.tri([sx - 0.9, sy + 3.5, -64.4], [sx + 0.9, sy + 3.5, -64.4], [sx, sy + 7, -64.4], c);
      hills.g.add(new THREE.Mesh(spire.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
    hills.g.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, map: tex.glow, color: 0xffb860, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  },

  // --- set pieces: things the train passes, once each ----------------------------
  /** The station, a level crossing (twice) and a tunnel (twice): built once, swept past when the cat reaches their places. */
  buildSetPieces(world, S) {
    const goal = world.level.goalX;
    const piece = (kind, at, len, build) => {
      const g = new THREE.Group();
      g.visible = false;
      world.scene.add(g);
      const p = { kind, at: goal * at, len, g, x: 0, active: false, done: false, lights: [] };
      build(g, p);
      S.pieces.push(p);
    };
    piece('station', 0.17, 60, (g, p) => this.station(world, g, p));
    piece('crossing', 0.31, 6, (g, p) => this.crossing(world, g, p));
    piece('tunnel', 0.47, 150, (g, p) => this.tunnel(world, g, p));
    piece('crossing', 0.62, 6, (g, p) => this.crossing(world, g, p));
    piece('tunnel', 0.74, 130, (g, p) => this.tunnel(world, g, p));
  },

  /** A village station going by behind the train: platform, canopy and lamps, a sign, the waiting room lit. */
  station(world, g, p) {
    const m = this.m;
    const stone = new THREE.MeshStandardMaterial({ map: world.tex.stone, color: 0x9a948a, roughness: 0.9 });
    const len = p.len;
    const plat = new THREE.Mesh(boxWorldUV(len, 1.0, 3.6, 2), stone);
    plat.position.set(len / 2, RAIL_Y + 0.0, -4.2);
    plat.receiveShadow = true;
    g.add(plat);
    const edge = new THREE.Mesh(this.geo.unitBox, m.cream);
    edge.scale.set(len, 0.06, 0.25);
    edge.position.set(len / 2, RAIL_Y + 0.53, -2.5);
    g.add(edge);
    for (let x = 4; x < len - 2; x += 7) {
      const col = new THREE.Mesh(this.geo.pole, m.iron);
      col.scale.set(0.08, 3.6, 0.08);
      col.position.set(x, RAIL_Y + 2.3, -5.2);
      col.castShadow = true;
      g.add(col);
    }
    const canopy = new THREE.Mesh(boxWorldUV(len - 4, 0.14, 3.2, 2), m.roof);
    canopy.position.set(len / 2, RAIL_Y + 4.15, -4.4);
    g.add(canopy);
    const valance = new THREE.Mesh(boxWorldUV(len - 4, 0.35, 0.04, 1), m.cream);
    valance.position.set(len / 2, RAIL_Y + 3.95, -2.8);
    g.add(valance);
    for (let x = 6; x < len - 4; x += 10) {
      const lamp = new THREE.Mesh(this.geo.ball, m.lamp);
      lamp.scale.setScalar(0.16);
      lamp.position.set(x, RAIL_Y + 3.6, -3.4);
      g.add(lamp);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffd08a, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.copy(lamp.position);
      glow.scale.set(2.2, 2.2, 1);
      g.add(glow);
      p.lights.push({ dx: x, y: RAIL_Y + 3.4, z: -2.6 });
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.75), new THREE.MeshStandardMaterial({ map: world.tex.sign, roughness: 0.5, emissive: 0xffffff, emissiveMap: world.tex.sign, emissiveIntensity: 0.25 }));
    sign.position.set(len * 0.45, RAIL_Y + 3.2, -2.85);
    g.add(sign);
    for (let x = 10; x < len - 6; x += 14) {
      const bench = new THREE.Mesh(this.geo.unitBox, m.wood);
      bench.scale.set(1.6, 0.08, 0.45);
      bench.position.set(x, RAIL_Y + 0.95, -5.4);
      g.add(bench);
    }
    const house = new THREE.Mesh(boxWorldUV(len - 14, 3.8, 3, 2), stone);
    house.position.set(len / 2, RAIL_Y + 2.4, -7.6);
    g.add(house);
    for (let x = 10; x < len - 8; x += 3.2) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.3), m.paneLit);
      win.position.set(x, RAIL_Y + 2.3, -6.08);
      g.add(win);
    }
    mergeByMaterial(g);
    // the station cat, on a bench, watching the train go by
    p.catAt = { dx: 10.4, y: RAIL_Y + 0.99, z: -5.4 };
  },

  /** A level crossing: the road over the line, barriers down with red lamps flashing, a car waiting. */
  crossing(world, g, p) {
    const m = this.m;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(5, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1e1e22, roughness: 0.9 }));
    road.position.set(p.len / 2, RAIL_Y - 0.2, -4);
    road.receiveShadow = true;
    g.add(road);
    p.lamps = [];
    for (const z of [3.4, -3.4]) {
      const post = new THREE.Mesh(this.geo.pole, m.white);
      post.scale.set(0.07, 2.4, 0.07);
      post.position.set(z > 0 ? -0.4 : p.len + 0.4, RAIL_Y + 0.9, z);
      g.add(post);
      const arm = new THREE.Mesh(this.geo.unitBox, m.stripes);
      arm.scale.set(5.6, 0.12, 0.08);
      arm.position.set(p.len / 2, RAIL_Y + 0.75, z);
      g.add(arm);
      for (const s of [-1, 1]) {
        const lamp = new THREE.Mesh(this.geo.ball, m.redLamp.clone());
        lamp.scale.setScalar(0.11);
        lamp.position.set((z > 0 ? -0.4 : p.len + 0.4) + s * 0.22, RAIL_Y + 1.85, z + 0.08);
        g.add(lamp);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xff3a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.position.copy(lamp.position);
        glow.scale.set(1.4, 1.4, 1);
        g.add(glow);
        p.lamps.push({ lamp, glow, s });
      }
    }
    // a car waiting at the barrier, its headlamps on
    const car = new THREE.Group();
    car.position.set(p.len / 2, RAIL_Y - 0.2, 7.5);
    const body = new THREE.Mesh(boxWorldUV(1.7, 0.6, 3.6, 1), m.paint[1]);
    body.position.y = 0.55;
    car.add(body);
    const cab = new THREE.Mesh(boxWorldUV(1.5, 0.5, 1.8, 1), m.paint[1]);
    cab.position.set(0, 1.05, 0.3);
    car.add(cab);
    for (const s of [-1, 1]) {
      const head = new THREE.Mesh(this.geo.ball, m.head);
      head.scale.setScalar(0.12);
      head.position.set(s * 0.6, 0.55, -1.82);
      car.add(head);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xfff0c0, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(s * 0.6, 0.55, -1.95);
      glow.scale.set(1.6, 1.6, 1);
      car.add(glow);
      const wheel = new THREE.Mesh(this.geo.wheel, m.iron);
      wheel.rotation.y = Math.PI / 2;
      wheel.scale.set(0.3, 0.3, 1.5);
      wheel.position.set(s * 0.86, 0.3, 1.0);
      car.add(wheel);
    }
    g.add(car);
    p.lights.push({ dx: -0.4, y: RAIL_Y + 1.8, z: 3.8, color: 0xff3a2a });
  },

  /** A tunnel, cut away on the camera's side: a stone back wall and roof, lamps along the wall, the hill over it. */
  tunnel(world, g, p) {
    const stone = new THREE.MeshStandardMaterial({ map: world.tex.stone, color: 0x6a645c, roughness: 0.95 });
    const len = p.len;
    const wall = new THREE.Mesh(boxWorldUV(len, TUNNEL_Y - RAIL_Y + 1.2, 0.6, 2), stone);
    wall.position.set(len / 2, (TUNNEL_Y + RAIL_Y - 1.2) / 2, -3.2);
    g.add(wall);
    const roof = new THREE.Mesh(boxWorldUV(len, 1.6, 20, 2), stone);
    roof.position.set(len / 2, TUNNEL_Y + 0.8, 6.5);
    g.add(roof);
    // the portals: a stone face across each end, and the hill heaped over the whole
    for (const x of [0, len]) {
      const face = new THREE.Mesh(boxWorldUV(1.2, 3.4, 22, 2), stone);
      face.position.set(x, TUNNEL_Y + 1.7, 6);
      g.add(face);
    }
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x141c16, roughness: 1 }));
    hill.scale.set(len / 2 + 18, 14, 10);
    hill.position.set(len / 2, TUNNEL_Y - 1, -13.5);
    g.add(hill);
    for (let x = 6; x < len - 2; x += 12) {
      const lamp = new THREE.Mesh(this.geo.unitBox, this.m.lamp);
      lamp.scale.set(0.2, 0.28, 0.12);
      lamp.position.set(x, RAIL_Y + 3.4, -2.85);
      g.add(lamp);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffb060, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.copy(lamp.position);
      glow.scale.set(2.2, 2.2, 1);
      g.add(glow);
      p.lights.push({ dx: x, y: RAIL_Y + 3.4, z: -2.2 });
    }
    mergeByMaterial(g);
  },

  // --- people of the train ---------------------------------------------------------
  /** Circus cats: on star tubs, asleep on a trunk, a kitten with a ball, one watching the lion, the station cat, and at home a family. */
  buildCats(world, S) {
    const { scene, level } = world;
    const m = this.m;
    const cats = (S.cats = new SceneryCats(scene, world.rng, { watch: Math.PI / 2 }));
    const add = (coat, pose, x, y, z, yaw, opts) => {
      this.taken.push(x);
      return cats.add(coat, pose, x, y, z, yaw, opts);
    };
    const free = (x) => !level.hangers.some((h) => Math.abs(h.x - x) < 1.6) && !level.checkpoints.some((cp) => Math.abs(cp.x - x) < 1.3);
    const roofs = level.platforms.filter((pl) => !pl.brittle && !pl.bouncy && pl.x1 - pl.x0 > 12);
    const tub = (x, y, z) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.42, 16), m.starsBlue);
      t.position.set(x, y + 0.21, z);
      t.castShadow = t.receiveShadow = true;
      scene.add(t);
      return y + 0.42;
    };
    // a ginger cat on a star tub on the first roof
    add('ginger', 'sit', 7.4, tub(7.4, 0, -1.0), -1.0, Math.PI / 2 - 0.5);
    // a white cat asleep on a trunk
    const trunkRoof = roofs.find((pl) => pl.x0 > level.goalX * 0.1 && free(pl.x0 + 3));
    if (trunkRoof) {
      const tx = trunkRoof.x0 + 3;
      const t = new THREE.Mesh(boxWorldUV(0.8, 0.4, 0.5, 1), m.trunk);
      t.position.set(tx, trunkRoof.top + 0.2, -1.0);
      t.castShadow = true;
      scene.add(t);
      add('white', 'loaf', tx, trunkRoof.top + 0.4, -1.0, 0.3);
    }
    // a tuxedo kitten batting at the air beside a ball
    const kit = roofs.find((pl) => pl.x0 > level.goalX * 0.38 && free(pl.x0 + 3.4));
    if (kit) {
      add('tuxedo', 'sit', kit.x0 + 3.4, kit.top, -1.1, -0.8, { scale: 0.55, paw: true });
      const b = new THREE.Mesh(this.geo.ball, m.stripes);
      b.scale.setScalar(0.18);
      b.position.set(kit.x0 + 3.85, kit.top + 0.18, -1.05);
      scene.add(b);
    }
    // a grey cat on a tall car, watching the country go by
    const tall = level.platforms.find((pl) => pl.top >= 1.8 && pl.x0 > level.goalX * 0.55 && !pl.bouncy);
    if (tall) add('grey', 'sit', tall.x0 + 2.2, tall.top, -1.1, Math.PI / 2 + 0.3);
    // a cream cat on a tub late on
    const late = roofs.filter((pl) => pl.x0 > level.goalX * 0.66 && free(pl.x0 + 2.4));
    if (late[0]) add('cream', 'sit', late[0].x0 + 2.4, tub(late[0].x0 + 2.4, late[0].top, -1.0), -1.0, Math.PI / 2 - 0.2);
    // the station cat: it rides with the station
    const st = S.pieces.find((p) => p.kind === 'station');
    if (st) {
      st.cat = add('tabby', 'sit', -999, st.catAt.y, st.catAt.z, -Math.PI / 2 + 0.4);
      st.cat.g.visible = false;
    }
    // home: a friend and two kittens on a striped blanket by a dish of sardines
    if (this.home) {
      const { x, top } = this.home;
      const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2).rotateX(-Math.PI / 2), m.blanket);
      rug.position.set(x + 10.6, top + 0.012, -0.8);
      rug.receiveShadow = true;
      scene.add(rug);
      add('ginger', 'sit', x + 10.1, top, -0.6, Math.PI, {
        patches: [['head', 0xf0e6d8, 0.06, 0.05, 0.08, 0.04, -0.02, 0]],
      });
      add('white', 'sit', x + 10.9, top, -0.95, Math.PI - 0.3, { scale: 0.48 });
      add('tuxedo', 'sit', x + 11.25, top, -1.1, Math.PI + 0.4, { scale: 0.45, paw: true });
      const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.06, 14), m.dish);
      dish.position.set(x + 9.4, top + 0.03, -0.85);
      scene.add(dish);
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(this.geo.ball, m.fish);
        f.scale.set(0.09, 0.02, 0.025);
        f.rotation.y = (i - 1) * 0.5;
        f.position.set(x + 9.4 + (i - 1) * 0.05, top + 0.08, -0.85 + (i - 1) * 0.04);
        scene.add(f);
      }
    }
  },

  /** The engine's smoke streaming back over the train, a few embers in it; wisps from the home coach's stovepipe. */
  buildSmoke(world, S, n) {
    const { scene } = world;
    // one instanced mesh of puffs; a puff fades by darkening towards the night behind it
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: world.tex.mist, transparent: true, opacity: 0.4, depthWrite: false }),
      n
    );
    mesh.frustumCulled = false;
    for (let i = 0; i < n; i++) {
      mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
      mesh.setColorAt(i, _c.setRGB(0, 0, 0));
    }
    scene.add(mesh);
    S.smoke = { mesh, items: Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0, life: 0, max: 1, vx: 0, vy: 0, grow: 1, stove: false })), clock: 0, stoveClock: 0 };
    const m = 24;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.12, map: world.tex.glow, color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false;
    scene.add(pts);
    S.embers = { pts, items: Array.from({ length: m }, () => ({ x: 0, y: -99, z: 0, vx: 0, vy: 0, life: 0 })), m };
  },

  /** Everything gathered while the cars were built: wheels, bulbs, cage bars, coach windows. */
  buildInstanced(world, S) {
    const { scene } = world;
    const wheels = new THREE.InstancedMesh(this.geo.wheel, this.m.wheel, this.wheels.length);
    wheels.frustumCulled = false;
    scene.add(wheels);
    S.wheels = wheels;
    this.updateWheels(S, 0, Infinity);
    const batch = (geo, mat, list) => {
      const runs = new Map();
      for (const item of list) {
        const k = Math.floor((Array.isArray(item) ? item[0] : item).elements[12] / 40);
        if (!runs.has(k)) runs.set(k, []);
        runs.get(k).push(item);
      }
      for (const run of runs.values()) this.scatter(scene, geo, mat, run);
    };
    batch(this.geo.bulb, this.m.bulb, this.bulbs[0]);
    batch(this.geo.bulb, this.m.bulbB, this.bulbs[1]);
    batch(this.geo.pole, this.m.gold, this.bars);
    const plane = new THREE.PlaneGeometry(1, 1);
    batch(plane, this.m.paneLit, this.windows.lit);
    batch(plane, this.m.paneDark, this.windows.dark);
  },

  /** Turn the wheels near the camera by the distance the train has come. */
  updateWheels(S, camX, near = 30) {
    const W = S.wheels;
    this.wheels.forEach(([x, y, z, r, turns], i) => {
      if (Math.abs(x - camX) > near) return;
      _q.setFromEuler(_e.set(0, 0, turns ? -S.scroll / r : 0));
      W.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(r, r, 1)));
    });
    W.instanceMatrix.needsUpdate = true;
  },

  /** Hanging things swing when the cat goes by. */
  onPass(o) {
    const s = this.swings.find((sw) => Math.abs(sw.x - o.x) < 0.01);
    if (!s) return;
    s.kick = 1;
    s.age = 0;
  },

  /** A trampoline takes the cat's weight and throws it: the mat sags and springs back. */
  onBounce(pl) {
    const t = pl.part;
    if (!t) return;
    t.kick = 1;
    t.age = 0;
  },

  update(world, dt, t, catX, camX) {
    const S = world.themeState;
    const rng = world.rng;
    S.scroll += SPEED * dt;

    // the country slides back past the camera
    for (const st of S.strips) st.g.position.x = camX - st.P - mod(camX + S.scroll * st.f, st.P);
    for (const sails of S.sails) sails.rotation.z = -t * 0.6;
    this.updateWheels(S, camX);

    // bulbs chase; hanging things swing; trampolines spring; the lion breathes, the elephant swings its trunk
    const chase = 0.5 + 0.5 * Math.sin(t * 5);
    this.m.bulb.emissiveIntensity = 0.9 + 2.2 * chase;
    this.m.bulbB.emissiveIntensity = 0.9 + 2.2 * (1 - chase);
    for (const s of this.swings) {
      s.age += dt;
      s.kick *= Math.exp(-dt * (s.kind === 'trapeze' ? 0.8 : 1.4));
      const amp = s.kind === 'trapeze' ? 0.55 : 0.3;
      s.g.rotation.x = 0.05 * Math.sin(t * 1.3 + s.ph) + s.kick * amp * Math.sin(s.age * (s.kind === 'trapeze' ? 4.2 : 6.5));
      s.g.rotation.z = 0.03 * Math.sin(t * 0.9 + s.ph) + s.kick * 0.12 * Math.sin(s.age * 5.1);
    }
    for (const tr of this.tramps) {
      if (Math.abs(tr.x0 - camX) > 40) continue;
      tr.age += dt;
      tr.kick *= Math.exp(-dt * 4.5);
      tr.skin.scale.y = 1 + 6 * tr.kick * Math.cos(tr.age * 17);
    }
    if (this.lionBody) this.lionBody.scale.y = 0.3 * (1 + 0.06 * Math.sin(t * 1.3));
    if (this.elephant) {
      this.elephant.trunk.forEach((seg, i) => {
        seg.rotation.x = (i === 0 ? -0.5 : 0.1) + 0.12 * Math.sin(t * 1.1 - i * 0.5);
        seg.rotation.z = 0.08 * Math.sin(t * 0.7 - i * 0.4);
      });
    }

    // fireflies wink on and off
    const F = S.flies;
    const fc = F.pts.geometry.attributes.color.array;
    for (let i = 0; i < F.n; i++) {
      const b = Math.pow(Math.max(0, Math.sin(t * 0.9 + F.ph[i] * 3)), 3);
      fc[i * 3] = 0.8 * b;
      fc[i * 3 + 1] = 1.0 * b;
      fc[i * 3 + 2] = 0.35 * b;
    }
    F.pts.geometry.attributes.color.needsUpdate = true;

    this.updatePieces(world, S, dt, t, catX, camX);
    this.updateSmoke(world, S, dt, camX);
    S.cats.update(dt, t, catX, camX);

    // home: the engine whistles, a gasp of steam, a burst of sparks from the chimney
    const goal = world.level.goalX;
    if (!S.finale && catX >= goal) {
      S.finale = true;
      S.finaleT = 2.5;
      world.sfx?.trainWhistle(1);
      world.sfx?.steam();
    } else if (S.finale && catX < goal - 2) S.finale = false;
    if (S.finaleT > 0) S.finaleT -= dt;
  },

  /** Sweep the station, the crossings and the tunnels past, and darken the night inside a tunnel. */
  updatePieces(world, S, dt, t, catX, camX) {
    let dark = 0;
    for (const p of S.pieces) {
      if (catX < p.at - 2) {
        // back before it (a restart): ready to pass again
        p.done = false;
        p.active = false;
        p.g.visible = false;
      }
      // (passed it by already, as when a run starts from a lantern beyond it: let it be)
      if (!p.active && !p.done && catX > p.at + 20) p.done = true;
      if (!p.active && !p.done && catX >= p.at) {
        p.active = true;
        p.x = camX + (p.kind === 'tunnel' ? 40 : 34);
        p.g.visible = true;
        p.rang = false;
        if (!p.fx) {
          p.fx = p.lights.map((l) => {
            const f = { x: 0, y: l.y, z: l.z, color: l.color || 0xffc27a, intensity: 0, distance: 9, flicker: p.kind !== 'crossing' };
            world.fixtures.push(f);
            return f;
          });
        }
      }
      if (!p.active) continue;
      p.x -= SPEED * dt;
      p.g.position.x = p.x;
      p.lights.forEach((l, i) => {
        p.fx[i].x = p.x + l.dx;
        p.fx[i].intensity = p.kind === 'crossing' ? 4 * (Math.sin(t * 9) > 0 ? 1 : 0.2) : 7;
      });
      if (p.cat) {
        p.cat.g.visible = true;
        p.cat.x = p.x + p.catAt.dx;
        p.cat.g.position.x = p.cat.x;
      }
      if (p.kind === 'crossing') {
        for (const l of p.lamps) {
          const on = Math.sin(t * 9) * l.s > 0;
          l.lamp.material.emissiveIntensity = on ? 3 : 0.3;
          l.glow.material.opacity = on ? 0.8 : 0;
        }
        if (!p.rang && p.x < camX + 14) {
          p.rang = true;
          world.sfx?.crossing();
        }
      }
      if (p.kind === 'tunnel') dark = Math.max(dark, smoothstep(-8, 2, catX - p.x) * smoothstep(-8, 2, p.x + p.len - catX));
      if (p.x + p.len < camX - 45) {
        p.active = false;
        p.done = true;
        p.g.visible = false;
        for (const f of p.fx) f.intensity = 0;
        if (p.cat) p.cat.g.visible = false;
      }
    }
    // inside a tunnel the moon and the sky go out
    if (Math.abs(dark - S.dark) > 0.002) {
      S.dark = dark;
      const B = S.base;
      world.moon.intensity = B.moon * (1 - 0.8 * dark);
      B.hemi.intensity = B.hemiInt * (1 - 0.5 * dark);
      world.scene.background.copy(B.bg).multiplyScalar(1 - 0.85 * dark);
      world.scene.fog.color.copy(B.fog).multiplyScalar(1 - 0.8 * dark);
      world.sfx?.setTunnel(dark);
    }
  },

  /** Smoke from the engine far ahead streams back over the train; embers in it; wisps from home's stovepipe. */
  updateSmoke(world, S, dt, camX) {
    const rng = world.rng;
    const Sm = S.smoke;
    const chimney = this.engine?.chimney;
    // from the chimney when it is in view, otherwise from where the plume comes into view
    const fromChimney = chimney && chimney.x < camX + 40;
    const spawn = (stove) => {
      const d = Sm.items.find((it) => it.life <= 0);
      if (!d) return;
      d.stove = stove;
      if (stove) {
        d.life = d.max = 2.5;
        [d.x, d.y, d.z] = [this.stove.x, this.stove.y, this.stove.z];
        d.vx = -SPEED * 0.6;
        d.vy = 0.6;
        d.grow = 0.5;
      } else {
        d.life = d.max = 3.2 + rng() * 1.5;
        [d.x, d.y, d.z] = [fromChimney ? chimney.x : camX + 40, fromChimney ? chimney.y + 0.2 : 4.2 + rng() * 0.8, -0.6 + rng() * 1.2];
        d.vx = -SPEED * (0.85 + rng() * 0.15);
        d.vy = 0.5 + rng() * 0.5 + (S.finaleT > 0 ? 1.5 : 0);
        d.grow = 1.2 + rng() * 1.4;
      }
    };
    Sm.clock -= dt;
    while (Sm.clock <= 0) {
      Sm.clock += 0.09;
      spawn(false);
    }
    if (this.stove && Math.abs(this.stove.x - camX) < 30) {
      Sm.stoveClock -= dt;
      if (Sm.stoveClock <= 0) {
        Sm.stoveClock = 0.35;
        spawn(true);
      }
    }
    const shade = 0.55 * (1 - 0.6 * S.dark);
    Sm.items.forEach((d, i) => {
      if (d.life <= 0) {
        Sm.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0));
        return;
      }
      d.life -= dt;
      const u = 1 - Math.max(0, d.life) / d.max;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      const sc = (d.stove ? 0.3 : 0.9) + u * d.grow * (d.stove ? 1 : 2.4);
      Sm.mesh.setMatrixAt(i, _m.compose(_p.set(d.x, d.y, d.z), _q.identity(), _s.set(sc * 1.4, sc, 1)));
      const a = shade * (d.stove ? 0.7 : 1) * Math.sin(Math.PI * Math.min(1, u * 1.3));
      Sm.mesh.setColorAt(i, _c.setRGB(a, a * 0.98, a * 0.95));
    });
    Sm.mesh.instanceMatrix.needsUpdate = true;
    Sm.mesh.instanceColor.needsUpdate = true;
    // embers: a few at a time, more at the finale
    const E = S.embers;
    const ep = E.pts.geometry.attributes.position.array;
    for (let i = 0; i < E.m; i++) {
      const e = E.items[i];
      if (e.life <= 0 && rng() < dt * (S.finaleT > 0 ? 12 : 1.2)) {
        e.life = 1.2 + rng();
        e.x = fromChimney ? chimney.x : camX + 38;
        e.y = (fromChimney ? chimney.y : 4.4) + rng() * 0.4;
        e.z = -0.4 + rng() * 0.8;
        e.vx = -SPEED * (0.8 + rng() * 0.3);
        e.vy = 1 + rng() * 1.5;
      }
      if (e.life > 0) {
        e.life -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.vy -= 0.6 * dt;
      }
      ep[i * 3] = e.x;
      ep[i * 3 + 1] = e.life > 0 ? e.y : -99;
      ep[i * 3 + 2] = e.z;
    }
    E.pts.geometry.attributes.position.needsUpdate = true;
  },

  dispose() {},
};
