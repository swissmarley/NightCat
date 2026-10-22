// Stage III dressing: a hill town under the first snow. The walk runs along the
// ridges of steep snowy roofs — chimneys, stovepipes, woodpiles and a snowman to
// jump, fir garlands and a bell to slide under, old boards across the alleys
// that give way. Lit windows, icicles, chimney smoke, pine hills, falling snow
// and the northern lights.
import * as THREE from 'three';
import {
  brickTexture,
  plasterTexture,
  snowTexture,
  woodTexture,
  windowPaneTexture,
  townWindowsTexture,
  auroraTexture,
  roofTileTexture,
  boxWorldUV,
} from '../textures.js';

const GROUND_Y = -3.5; // the snowy lanes below the roofs
const HALF = 1.45; // half a house's depth: the eaves sit at z = ±HALF
const ROOF_H = 1.1; // ridge height above the eaves
const SLOPE = Math.hypot(HALF, ROOF_H);
const PITCH = Math.atan2(ROOF_H, HALF);
const OVER = 0.3; // eaves overhang past the walls, along the slope
const GABLE_OVER = 0.16; // ...and past the gables
/** How far the roof surface sits below the ridge at depth z. */
const roofDrop = (z) => (ROOF_H * Math.abs(z)) / HALF;

const WALLS = [0xd8c8a8, 0xc9a77c, 0x9fb0c4, 0xc49a8a, 0xa8b49a];
const BULBS = [0xffb45a, 0xffd38a, 0xff6a4a, 0xfff0c8];
const ATLAS = { cols: 48, rows: 24 };

/** Collects quads into one BufferGeometry so a whole row of houses is a single draw call. */
export class Mesher {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.col = [];
  }
  /** a-b-c-d counter-clockwise as seen from the side the face looks at. */
  quad(a, b, c, d, col, uv = [0, 0, 1, 0, 1, 1, 0, 1]) {
    this.face([a, b, c, d], [0, 1, 2, 0, 2, 3], col, uv);
  }
  tri(a, b, c, col) {
    this.face([a, b, c], [0, 1, 2], col, [0, 0, 1, 0, 0.5, 1]);
  }
  face(v, order, col, uv) {
    const [a, b, c] = v;
    const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
      .cross(new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]))
      .normalize();
    for (const k of order) {
      this.pos.push(...v[k]);
      this.nor.push(n.x, n.y, n.z);
      this.uv.push(uv[k * 2], uv[k * 2 + 1]);
      this.col.push(col.r, col.g, col.b);
    }
  }
  box(x0, x1, y0, y1, z0, z1, col) {
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col);
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], col);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], col);
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], col);
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], col);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

export const snowTheme = {
  key: 'snow',
  floorY: GROUND_Y,
  ambience: 'snow',
  hanging: new Set(['garland', 'bell']),
  cpSink: roofDrop(0.95),
  fallFx: { sound: 'poof', color: 0xe6eefa },
  colors: {
    bg: 0x070b16,
    fog: 0x0e1729,
    fogNear: 12,
    fogFar: 52,
    hemiSky: 0x3a4f7a,
    hemiGround: 0x1a1e2a,
    hemiInt: 1.0,
    moon: 0xb4c6ff,
    moonInt: 2.1,
    moonPos: [24, 5.6, -92],
    moonSize: 1.6,
    moonHalo: 0xaabfff,
    skyTop: [0.006, 0.01, 0.03],
    skyMid: [0.018, 0.035, 0.08],
    skyHor: [0.045, 0.08, 0.13],
    starCount: 900,
    starRange: [-4, 90], // low enough to show above the roofs
    fill: 0xa8c0ff,
    puff: 0xdce6f4,
    spark: 0xffd58a,
    cp: 0xffc070,
  },

  makeTextures(rng) {
    return {
      brick: brickTexture(rng),
      plaster: plasterTexture(rng),
      snow: snowTexture(rng),
      wood: woodTexture(rng),
      tiles: roofTileTexture(rng),
      paneLit: windowPaneTexture(true),
      paneDark: windowPaneTexture(false),
      town: townWindowsTexture(rng, ATLAS.cols, ATLAS.rows, 0.32),
      aurora: auroraTexture(rng),
    };
  },

  init(tex) {
    this.tex = tex;
    // filled while the level is built, used when the world is dressed
    this.windows = [];
    this.skylights = [];
    this.icicles = [];
    this.smokers = [];
    this.bells = [];
    const std = (o) => new THREE.MeshStandardMaterial(o);
    this.m = {
      walls: WALLS.map((c) => std({ map: tex.plaster, color: c, roughness: 0.92 })),
      snow: std({ map: tex.snow, color: 0xdfe6f2, roughness: 0.85 }),
      tiles: std({ map: tex.tiles, roughness: 0.6 }),
      timber: std({ color: 0x33241a, roughness: 0.8 }),
      boards: std({ map: tex.wood, color: 0x9a928a, roughness: 0.9 }),
      brick: std({ map: tex.brick, roughness: 0.85 }),
      stone: std({ color: 0x5f5a56, roughness: 0.85 }),
      iron: std({ color: 0x1c1d24, roughness: 0.5, metalness: 0.6 }),
      ice: std({ color: 0xcfe4ff, roughness: 0.15, emissive: 0x5a78a0, emissiveIntensity: 0.25 }),
      fir: std({ color: 0x1f3d2e, roughness: 0.9, flatShading: true }),
      bronze: std({ color: 0xd2a55a, roughness: 0.4, metalness: 0.35, emissive: 0x3a2008, emissiveIntensity: 0.4 }),
      red: std({ color: 0x9e1f22, roughness: 0.7 }),
      coal: std({ color: 0x0b0b0e, roughness: 0.6 }),
      carrot: std({ color: 0xd8641c, roughness: 0.7 }),
      bark: std({ color: 0x4a3324, roughness: 0.95 }),
      cut: std({ color: 0xb48c5c, roughness: 0.9 }),
      paneLit: std({ map: tex.paneLit, emissiveMap: tex.paneLit, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.8 }),
      paneDark: std({ map: tex.paneDark, roughness: 0.25, metalness: 0.3 }),
      lamp: std({ color: 0x2a1406, emissive: 0xffb45a, emissiveIntensity: 3.2, roughness: 0.6 }),
      bulbs: BULBS.map((c) => std({ color: 0x1a0d04, emissive: c, emissiveIntensity: 2.8 })),
    };
    const icicle = new THREE.ConeGeometry(0.035, 1, 5);
    icicle.rotateX(Math.PI);
    icicle.translate(0, -0.5, 0); // hangs from y = 0 down to its tip at y = -1
    this.geo = {
      lump: new THREE.IcosahedronGeometry(1, 2),
      clump: new THREE.IcosahedronGeometry(0.1, 0),
      bulb: new THREE.SphereGeometry(0.035, 8, 6),
      log: new THREE.CylinderGeometry(0.115, 0.115, 0.82, 10),
      post: new THREE.BoxGeometry(0.12, 3.2, 0.06),
      icicle,
    };
  },

  /** Two snowy slopes meeting at a ridge along x, eaves overhanging; returns where the front eave ends. */
  roof(group, x0, x1, ridge, zc, half, rh, shadow) {
    const slope = Math.hypot(half, rh);
    const pitch = Math.atan2(rh, half);
    const L = x1 - x0 + GABLE_OVER * 2;
    const S = slope + OVER;
    const T = 0.16;
    const cx = (x0 + x1) / 2;
    const dy = rh / slope;
    const dz = half / slope;
    // snow lies on the tiles but stops short of the eave, where a band of tiles shows
    const SN = S - 0.42;
    for (const side of [1, -1]) {
      const slab = new THREE.Mesh(boxWorldUV(L, T, SN, 2), this.m.snow);
      slab.position.set(cx, ridge - dy * (SN / 2) - dz * (T / 2), zc + side * (dz * (SN / 2) - dy * (T / 2)));
      slab.rotation.x = side * pitch;
      slab.castShadow = shadow && side === 1;
      slab.receiveShadow = true;
      group.add(slab);
      const tiles = new THREE.Mesh(boxWorldUV(L + 0.1, 0.1, S, 1), this.m.tiles);
      const tt = T + 0.04; // its top sits just under the snow's
      tiles.position.set(cx, ridge - dy * (S / 2) - dz * (tt - 0.05), zc + side * (dz * (S / 2) - dy * (tt - 0.05)));
      tiles.rotation.x = side * pitch;
      tiles.receiveShadow = true;
      group.add(tiles);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, L, 10), this.m.snow);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(cx, ridge - 0.08, zc);
    cap.receiveShadow = true;
    group.add(cap);
    // the eave's underside corner, with a dark fascia board under the snow lip
    const edgeY = ridge - dy * S - dz * (T + 0.04);
    const edgeZ = zc + dz * S - dy * (T + 0.04);
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(L, 0.16, 0.06), this.m.timber);
    fascia.position.set(cx, edgeY - 0.05, edgeZ - 0.05);
    group.add(fascia);
    return { edgeY: edgeY - 0.12, edgeZ: edgeZ - 0.05, L };
  },

  /** The plaster triangle under the roof at a house's end (dir −1: facing −x, +1: facing +x). */
  gable(x, eave, top, mat, dir) {
    const h = HALF - 0.1;
    const geo = new THREE.BufferGeometry();
    const v = [x, eave, -h, x, eave, h, x, top - 0.1, 0];
    if (dir > 0) v.splice(0, 6, x, eave, h, x, eave, -h);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([v[2] / 2, v[1] / 2, v[5] / 2, v[4] / 2, v[8] / 2, v[7] / 2], 2));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, mat);
  },

  buildPlatform(group, x0, x1, top, rng) {
    const eave = top - ROOF_H;
    // a long roof is a terrace of houses: the walls change colour along it
    let a = x0;
    let first = null;
    let last = null;
    while (a < x1 - 0.01) {
      let b = x1 - a > 12 ? a + 5 + rng() * 5 : x1;
      if (x1 - b < 4) b = x1;
      const mat = this.m.walls[Math.floor(rng() * this.m.walls.length)];
      this.houseBody(group, a, b, eave, mat, rng);
      first = first || mat;
      last = mat;
      a = b;
    }
    group.add(this.gable(x0, eave, top, first, -1));
    group.add(this.gable(x1, eave, top, last, 1));
    const { edgeY, edgeZ } = this.roof(group, x0, x1, top, 0, HALF, ROOF_H, true);
    // now and then a lit skylight in the front slope, below the walk
    for (let x = x0 + 1.5 + rng() * 3; x < x1 - 1.2; x += 4 + rng() * 6) {
      if (rng() < 0.55) this.skylights.push({ x, top });
    }
    // icicles along the front eave
    for (let x = x0 - GABLE_OVER + 0.08; x < x1 + GABLE_OVER - 0.05; x += 0.16 + rng() * 0.2) {
      if (rng() < 0.3) continue;
      this.icicles.push({ x, y: edgeY, z: edgeZ, len: 0.06 + Math.pow(rng(), 2) * 0.46 });
    }
  },

  houseBody(group, a, b, eave, mat, rng) {
    const len = b - a;
    const cx = (a + b) / 2;
    const h = eave - GROUND_Y;
    const front = HALF - 0.1;
    const wall = new THREE.Mesh(boxWorldUV(len, h, front * 2, 2), mat);
    wall.position.set(cx, GROUND_Y + h / 2, 0);
    wall.receiveShadow = true;
    group.add(wall);
    // half-timbering: a beam under the eaves and a post at each corner
    const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.06), this.m.timber);
    beam.position.set(cx, eave - 0.08, front + 0.03);
    group.add(beam);
    for (const x of [a + 0.06, b - 0.06]) {
      const post = new THREE.Mesh(this.geo.post, this.m.timber);
      post.position.set(x, eave - 1.6, front + 0.03);
      group.add(post);
    }
    // a row of windows under the eaves (instanced when the world is dressed)
    const n = Math.max(1, Math.round(len / 2.4));
    for (let i = 0; i < n; i++) {
      const x = a + (len * (i + 0.5)) / n + (rng() - 0.5) * 0.3;
      this.windows.push({ x, y: eave - 0.8, z: front + 0.012, lit: rng() < 0.45 });
    }
  },

  buildObstacle(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    const add = (mesh, px, py, pz, shadow = true) => {
      mesh.position.set(px, py, pz);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      g.add(mesh);
      return mesh;
    };
    let size;
    if (kind === 'chimney') {
      add(new THREE.Mesh(boxWorldUV(0.64, 1.5, 0.64, 1.2), m.brick), 0, 0.27, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.08, 0.74), m.stone), 0, 0.98, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.8), m.snow), 0, 1.07, 0);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.3), m.coal), 0, 1.125, 0, false);
      this.smokers.push({ x, y: top + 1.15, z: 0, s: 1 });
      size = { w: 0.72, h: 1.12 };
    } else if (kind === 'drift') {
      // snow slid off a higher roof and heaped on the ridge
      const heap = add(new THREE.Mesh(this.geo.lump, m.snow), 0, 0, 0);
      heap.scale.set(0.66, 0.6, 0.95);
      for (const s of [-1, 1]) {
        const l = add(new THREE.Mesh(this.geo.lump, m.snow), s * 0.32, 0.05, (rng() - 0.5) * 0.4);
        l.scale.set(0.3, 0.3 + rng() * 0.08, 0.5);
      }
      size = { w: 1.2, h: 0.6 };
    } else if (kind === 'logs') {
      // a woodpile, cut ends to the street, on a bank of snow
      const bank = add(new THREE.Mesh(this.geo.lump, m.snow), 0, -0.02, 0);
      bank.scale.set(0.5, 0.2, 0.62);
      const mats = [m.bark, m.cut, m.cut];
      for (const [lx, ly] of [
        [-0.24, 0.12],
        [0, 0.12],
        [0.24, 0.12],
        [-0.12, 0.33],
        [0.12, 0.33],
        [0, 0.54],
      ]) {
        const log = add(new THREE.Mesh(this.geo.log, mats), lx + (rng() - 0.5) * 0.02, ly, (rng() - 0.5) * 0.06);
        log.rotation.set(Math.PI / 2, rng() * 3, 0);
      }
      const cap = add(new THREE.Mesh(this.geo.lump, m.snow), 0, 0.62, 0);
      cap.scale.set(0.3, 0.09, 0.4);
      size = { w: 0.8, h: 0.72 };
    } else if (kind === 'pipe') {
      // a stovepipe with a rain hat
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 1.25, 12), m.iron), 0, 0.36, 0);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.08, 12), m.iron), 0, 0.02, 0);
      add(new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.12, 12), m.iron), 0, 1.03, 0);
      const cap = add(new THREE.Mesh(this.geo.lump, m.snow), 0, 1.07, 0);
      cap.scale.set(0.17, 0.04, 0.17);
      this.smokers.push({ x, y: top + 1.0, z: 0, s: 0.6 });
      size = { w: 0.44, h: 1.1 };
    } else {
      // snowman: someone climbed up here to build him
      add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), m.snow), 0, 0.22, 0);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), m.snow), 0, 0.64, 0);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12), m.snow), 0, 0.96, 0);
      for (const s of [-1, 1]) {
        add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), m.coal), s * 0.055, 1.0, 0.135, false);
        const arm = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.34, 5), m.bark), s * 0.27, 0.72, 0);
        arm.rotation.z = -s * 1.0;
      }
      for (const by of [0.56, 0.68]) add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), m.coal), 0, by, 0.215, false);
      const nose = add(new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.16, 6), m.carrot), 0, 0.96, 0.22, false);
      nose.rotation.x = Math.PI / 2;
      const scarf = add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 14), m.red), 0, 0.82, 0);
      scarf.rotation.x = Math.PI / 2;
      const tail = add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.24, 0.03), m.red), 0.08, 0.7, 0.16);
      tail.rotation.z = 0.2;
      size = { w: 0.68, h: 1.12 };
    }
    group.add(g);
    return size;
  },

  buildHanging(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    if (kind === 'garland') {
      // two poles behind the walk, arms reaching over it, a fir swag with lights between
      const half = 0.85;
      const sink = roofDrop(0.95);
      for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.62 + sink, 8), m.iron);
        pole.position.set(s * half, (1.62 - sink) / 2, -0.95);
        pole.castShadow = true;
        g.add(pole);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6), m.iron);
        arm.rotation.x = Math.PI / 2;
        arm.position.set(s * half, 1.58, -0.55);
        g.add(arm);
      }
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        pts.push(new THREE.Vector3(-half + u * half * 2, 1.52 - 0.88 * Math.pow(Math.sin(u * Math.PI), 1.2), -0.15));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const swag = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.08, 7), m.fir);
      swag.castShadow = true;
      g.add(swag);
      for (let i = 0; i <= 18; i++) {
        const p = curve.getPointAt(0.04 + (i / 18) * 0.92);
        const c = new THREE.Mesh(this.geo.clump, m.fir);
        c.position.set(p.x + (rng() - 0.5) * 0.06, p.y + (rng() - 0.5) * 0.05, p.z + (rng() - 0.5) * 0.12);
        c.scale.setScalar(0.9 + rng() * 0.6);
        c.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        g.add(c);
      }
      for (let i = 0; i < 9; i++) {
        const p = curve.getPointAt(0.1 + (i / 8) * 0.8);
        const b = new THREE.Mesh(this.geo.bulb, m.bulbs[i % m.bulbs.length]);
        b.position.set(p.x, p.y - 0.07, p.z + 0.09);
        g.add(b);
      }
      // a red bow and a bauble at the low point
      for (const s of [-1, 1]) {
        const loop = new THREE.Mesh(this.geo.lump, m.red);
        loop.scale.set(0.08, 0.05, 0.03);
        loop.position.set(s * 0.07, 0.68, -0.02);
        loop.rotation.z = s * 0.4;
        g.add(loop);
      }
      const bauble = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), m.bronze);
      bauble.position.set(0, 0.5, -0.1);
      g.add(bauble);
      group.add(g);
      return { w: 1.15, clearance: 0.42, height: 1.0 };
    }
    // bell: a frame behind the walk with a bracket reaching over it, the bell hung on the path
    const back = -1.0;
    const sink = roofDrop(back);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 2.75 + sink, 0.14), m.timber);
      post.position.set(s * 0.85, (2.75 - sink) / 2, back);
      post.castShadow = true;
      g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 0.2), m.timber);
    beam.position.set(0, 2.7, back);
    beam.castShadow = true;
    g.add(beam);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.36), m.snow);
    cap.position.set(0, 2.84, back);
    g.add(cap);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.15), m.timber);
    bracket.position.set(0, 2.62, back / 2 + 0.05);
    g.add(bracket);
    const pivot = new THREE.Group();
    pivot.position.set(0, 2.56, 0);
    g.add(pivot);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.0, 5), m.red);
    rope.position.y = -0.5;
    pivot.add(rope);
    const profile = [
      [0.001, 0],
      [0.1, 0],
      [0.14, -0.04],
      [0.155, -0.12],
      [0.17, -0.28],
      [0.2, -0.42],
      [0.27, -0.53],
      [0.31, -0.59],
      [0.3, -0.62],
      [0.22, -0.58],
      [0.001, -0.56],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const bell = new THREE.Mesh(new THREE.LatheGeometry(profile, 22), m.bronze);
    bell.position.y = -1.0;
    bell.castShadow = true;
    pivot.add(bell);
    const crown = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 10), m.bronze);
    crown.position.y = -0.98;
    pivot.add(crown);
    const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), m.iron);
    clapper.position.y = -1.52;
    pivot.add(clapper);
    group.add(g);
    this.bells.push({ x, pivot, ring: 0, age: 0, ph: rng() * 6.28 });
    return { w: 0.7, clearance: 0.46, height: 1.1 };
  },

  /** Old boards laid across an alley on a scaffold: the pieces drop when they give way. */
  buildBrittle(group, x0, x1, top, rng) {
    const m = this.m;
    const len = x1 - x0;
    const n = Math.max(2, Math.round(len / 1.3));
    const seg = len / n;
    const boardGeo = new THREE.BoxGeometry(seg - 0.03, 0.08, 0.3);
    const snowGeo = new THREE.BoxGeometry(seg - 0.14, 0.06, 0.8);
    const battenGeo = new THREE.BoxGeometry(0.1, 0.07, 1.05);
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const g = new THREE.Group();
      g.position.set(x0 + seg * (i + 0.5), top, 0);
      for (const z of [-0.33, 0, 0.33]) {
        const b = new THREE.Mesh(boardGeo, m.boards);
        b.position.set((rng() - 0.5) * 0.05, -0.07 + (rng() - 0.5) * 0.02, z + (rng() - 0.5) * 0.03);
        b.rotation.y = (rng() - 0.5) * 0.05;
        b.castShadow = b.receiveShadow = true;
        g.add(b);
      }
      const snow = new THREE.Mesh(snowGeo, m.snow);
      snow.position.set((rng() - 0.5) * 0.08, -0.01, 0);
      snow.receiveShadow = true;
      g.add(snow);
      const batten = new THREE.Mesh(battenGeo, m.timber);
      batten.position.set(seg / 2 - 0.12, -0.145, 0);
      g.add(batten);
      group.add(g);
      pieces.push(g);
    }
    // the scaffold stands in the alley and stays when the boards go
    const h = top - 0.2 - GROUND_Y;
    for (const x of [x0 + 0.22, x1 - 0.22]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 7), m.timber);
      pole.position.set(x, GROUND_Y + h / 2, -0.72);
      pole.castShadow = true;
      group.add(pole);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len - 0.3, 0.08, 0.08), m.timber);
    rail.position.set((x0 + x1) / 2, top - 0.24, -0.72);
    group.add(rail);
    return pieces;
  },

  buildGoal(level, rng) {
    const m = this.m;
    const gx = level.goalX;
    const g = new THREE.Group();
    g.position.set(gx, 0, 0);
    // the gate: a fir arch with lights standing just behind the walk, framing the cat as it passes
    const back = -0.75;
    const sink = roofDrop(back);
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.3 + sink, 0.16), m.timber);
      post.position.set(s * 1.15, (2.3 - sink) / 2, back);
      post.castShadow = true;
      g.add(post);
    }
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      pts.push(new THREE.Vector3(-1.15 * Math.cos(a), 2.2 + 0.9 * Math.sin(a), back));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 36, 0.12, 7), m.fir));
    for (let i = 0; i <= 14; i++) {
      const p = curve.getPointAt(0.03 + (i / 14) * 0.94);
      const c = new THREE.Mesh(this.geo.clump, m.fir);
      c.position.set(p.x, p.y, p.z + 0.06);
      c.scale.setScalar(1.2 + rng() * 0.6);
      c.rotation.set(rng() * 3, rng() * 3, rng() * 3);
      g.add(c);
    }
    for (let i = 0; i < 13; i++) {
      const p = curve.getPointAt(0.04 + (i / 12) * 0.92);
      const b = new THREE.Mesh(this.geo.bulb, m.bulbs[i % m.bulbs.length]);
      b.position.set(p.x, p.y, p.z + 0.17);
      g.add(b);
    }
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(this.geo.lump, m.red);
      loop.scale.set(0.11, 0.07, 0.03);
      loop.position.set(s * 0.1, 3.0, back + 0.2);
      loop.rotation.z = s * 0.4;
      g.add(loop);
    }

    // home: a tall house just behind the walk, a big lit window, a wreath on the wall
    const hx0 = 2.4;
    const hx1 = 11.2;
    const zc = -3.6;
    const half = 1.5;
    const eave = 2.3;
    const wallMat = m.walls[0];
    const body = new THREE.Mesh(boxWorldUV(hx1 - hx0, eave - GROUND_Y, half * 2, 2), wallMat);
    body.position.set((hx0 + hx1) / 2, (eave + GROUND_Y) / 2, zc);
    body.receiveShadow = true;
    g.add(body);
    this.roof(g, hx0, hx1, eave + 1.2, zc, half + 0.1, 1.2, false);
    const front = zc + half;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 1.6), m.paneLit);
    win.position.set(6.6, 0.95, front + 0.012);
    g.add(win);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.2), m.snow);
    sill.position.set(6.6, 0.1, front + 0.1);
    g.add(sill);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), m.walls[0]);
    candle.position.set(6.25, 0.24, front + 0.12);
    g.add(candle);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), m.bulbs[3]);
    flame.scale.set(1, 1.7, 1);
    flame.position.set(6.25, 0.38, front + 0.12);
    g.add(flame);
    const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 7, 16), m.fir);
    wreath.position.set(4.3, 1.15, front + 0.08);
    g.add(wreath);
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(this.geo.lump, m.red);
      loop.scale.set(0.09, 0.06, 0.03);
      loop.position.set(4.3 + s * 0.08, 0.86, front + 0.18);
      loop.rotation.z = s * 0.4;
      g.add(loop);
    }
    // lights along its eave, a lantern by the door, a chimney that smokes
    for (let x = hx0 + 0.3; x < hx1; x += 0.55) {
      const b = new THREE.Mesh(this.geo.bulb, m.bulbs[Math.floor(rng() * m.bulbs.length)]);
      b.position.set(x, eave - 0.12 - 0.05 * Math.sin(((x - hx0) / 1.1) * Math.PI), front + 0.3);
      g.add(b);
    }
    const chimney = new THREE.Mesh(boxWorldUV(0.6, 1.6, 0.6, 1.2), m.brick);
    chimney.position.set(9.6, eave + 1.4, zc - 0.4);
    g.add(chimney);
    const chimCap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.1, 0.76), m.snow);
    chimCap.position.set(9.6, eave + 2.25, zc - 0.4);
    g.add(chimCap);
    this.smokers.push({ x: gx + 9.6, y: eave + 2.3, z: zc - 0.4, s: 1.3 });
    level.group.add(g);
    level.fixtures.push({ x: gx + 6.6, y: 1.0, z: front + 0.6, color: 0xffc27a, intensity: 8, distance: 10 });
    level.fixtures.push({ x: gx, y: 2.9, z: 0.2, color: 0xffb060, intensity: 5, distance: 7 });
  },

  // --- dressing ----------------------------------------------------------------
  dress(world) {
    const { quality } = world;
    const S = (world.themeState = { smoke: [], aurora: [], flakes: null, lamps: [] });
    this.buildGround(world);
    this.buildTown(world);
    this.buildHills(world);
    this.buildTower(world);
    this.buildAurora(world, S);
    this.buildIcicles(world);
    this.buildWindows(world);
    this.buildAlleyLamps(world, S);
    this.buildSmoke(world, S);
    this.buildSnowfall(world, S, Math.round(650 * quality.particles));
  },

  buildGround(world) {
    const { scene, level } = world;
    const len = level.endX + 200;
    const map = this.tex.snow.clone();
    map.needsUpdate = true;
    map.repeat.set(len / 3, 20);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 60),
      new THREE.MeshStandardMaterial({ map, color: 0xc8d2e4, roughness: 0.9 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(len / 2 - 80, GROUND_Y, -10);
    ground.receiveShadow = true;
    scene.add(ground);
  },

  /** Three rows of houses behind the walk, each row merged into a few draw calls. */
  buildTown(world) {
    const { scene, level, rng } = world;
    const { town } = this.tex;
    const from = -40;
    const to = level.endX + 70;
    const col = new THREE.Color();
    const row = (zc, depth, wMin, wMax, eMin, eMax, dim, glow) => {
      const body = new Mesher();
      const fronts = new Mesher();
      const roofs = new Mesher();
      const half = depth / 2;
      let x = from;
      while (x < to) {
        const w = wMin + rng() * (wMax - wMin);
        const eave = eMin + rng() * (eMax - eMin);
        const rh = half * (0.7 + rng() * 0.35);
        const ridge = eave + rh;
        const x0 = x;
        const x1 = x + w;
        col.setHex(WALLS[Math.floor(rng() * WALLS.length)]).multiplyScalar(dim * (0.8 + rng() * 0.25));
        body.box(x0, x1, GROUND_Y, eave, zc - half, zc + half, col);
        body.tri([x0, eave, zc - half], [x0, eave, zc + half], [x0, ridge, zc], col);
        body.tri([x1, eave, zc + half], [x1, eave, zc - half], [x1, ridge, zc], col);
        // façade: a block of window cells from the atlas
        const yTop = eave - 0.2;
        const rows = Math.max(1, Math.min(5, Math.round((yTop - GROUND_Y - 0.4) / 1.0)));
        const cols = Math.max(2, Math.round((w - 0.3) / 1.0));
        const c0 = Math.floor(rng() * (ATLAS.cols - cols));
        const r0 = Math.floor(rng() * (ATLAS.rows - rows));
        const u0 = c0 / ATLAS.cols;
        const u1 = (c0 + cols) / ATLAS.cols;
        const v0 = r0 / ATLAS.rows;
        const v1 = (r0 + rows) / ATLAS.rows;
        const fz = zc + half + 0.01;
        const yb = yTop - rows * 1.0;
        const uv = [u0, v0, u1, v0, u1, v1, u0, v1];
        fronts.quad([x0 + 0.15, yb, fz], [x1 - 0.15, yb, fz], [x1 - 0.15, yTop, fz], [x0 + 0.15, yTop, fz], col, uv);
        // snowy roof with an overhang and a lip of snow at the front
        const ov = 0.2;
        const oz = 0.3;
        const dy = (oz * rh) / half;
        const snow = col.clone().setRGB(0.8, 0.86, 0.96).multiplyScalar(dim * (0.92 + rng() * 0.1));
        const zf = zc + half + oz;
        const [xa, xb, ye, zb] = [x0 - ov, x1 + ov, eave - dy, zc - half - oz];
        roofs.quad([xa, ye, zf], [xb, ye, zf], [xb, ridge, zc], [xa, ridge, zc], snow);
        roofs.quad([xa, ye - 0.1, zf], [xb, ye - 0.1, zf], [xb, ye, zf], [xa, ye, zf], snow);
        roofs.quad([xb, ye, zb], [xa, ye, zb], [xa, ridge, zc], [xb, ridge, zc], snow);
        if (rng() < 0.55) {
          // a chimney on the back slope
          const cx = x0 + w * (0.2 + rng() * 0.6);
          const cz = zc - half * 0.4;
          const ch = ridge + 0.4 + rng() * 0.4;
          const brick = col.clone().setRGB(0.32, 0.2, 0.16).multiplyScalar(dim);
          body.box(cx - 0.22, cx + 0.22, eave, ch, cz - 0.22, cz + 0.22, brick);
          roofs.box(cx - 0.27, cx + 0.27, ch, ch + 0.09, cz - 0.27, cz + 0.27, snow);
        }
        x += w + 0.2 + rng() * 2.2;
      }
      scene.add(new THREE.Mesh(body.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
      scene.add(
        new THREE.Mesh(
          fronts.build(),
          new THREE.MeshStandardMaterial({
            map: town.map,
            emissiveMap: town.emissiveMap,
            emissive: 0xffffff,
            emissiveIntensity: glow,
            vertexColors: true,
            roughness: 0.9,
          })
        )
      );
      scene.add(new THREE.Mesh(roofs.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
    };
    row(-9, 3.4, 3.5, 7, -2.6, -0.6, 0.6, 1.0);
    row(-16, 4, 4, 8, -1.8, 0.8, 0.45, 0.85);
    row(-25, 4.6, 4, 9, -0.8, 2.0, 0.35, 0.7);
  },

  /** Snowy mountains far off, and a dark hill of pines behind the town. */
  buildHills(world) {
    const { scene, level, rng } = world;
    const from = -160;
    const to = level.endX + 280;
    const ridgeFn = (base, amp) => {
      const ph = rng() * 10;
      const ph2 = rng() * 10;
      return (x) => base + amp * (0.55 + 0.45 * Math.sin(x * 0.021 + ph)) * (0.6 + 0.4 * Math.sin(x * 0.067 + ph2));
    };
    // a strip from the ridge down past the horizon: snow on top fading into the dark slopes
    const range = (z, fn, step, snowCol, darkCol, snowLine) => {
      const pos = [];
      const col = [];
      const idx = [];
      const top = new THREE.Color();
      const snow = new THREE.Color(snowCol);
      const dark = new THREE.Color(darkCol);
      let i = 0;
      for (let x = from; x <= to; x += step) {
        const y = fn(x) + (rng() - 0.5) * step * 0.25;
        pos.push(x, y, z, x, y - snowLine, z, x, -40, z);
        top.copy(dark).lerp(snow, 0.55 + 0.45 * rng());
        col.push(top.r, top.g, top.b, dark.r, dark.g, dark.b, dark.r, dark.g, dark.b);
        if (i > 0) {
          const a = (i - 1) * 3;
          const b = i * 3;
          idx.push(a, a + 1, b, b, a + 1, b + 1, a + 1, a + 2, b + 1, b + 1, a + 2, b + 2);
        }
        i++;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
    };
    range(-74, ridgeFn(-1, 10), 6, 0x3c4a66, 0x0c1220, 3.2);
    range(-56, ridgeFn(-3, 7), 4, 0x2e3a52, 0x0a0f1a, 2.4);
    // the pine hill
    const hill = ridgeFn(-3.2, 4.2);
    range(-36, hill, 3, 0x1c2638, 0x080c14, 1.2);
    const n = Math.floor((to - from) / 1.3);
    const cone = new THREE.ConeGeometry(1, 1, 7);
    const pine = (color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    const trees = new THREE.InstancedMesh(cone, pine(0x0f2124), n);
    const caps = new THREE.InstancedMesh(cone, pine(0x7a889e), n);
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const x = from + i * 1.3 + rng() * 1.2;
      const z = -34 + rng() * 4;
      const h = 2.2 + rng() * 2.6;
      const r = h * (0.28 + rng() * 0.08);
      const y = hill(x) - 1.0 - rng() * 1.6;
      p.set(x, y + h / 2, z);
      s.set(r, h, r);
      mat.compose(p, q, s);
      trees.setMatrixAt(i, mat);
      p.set(x, y + h * 0.83, z + 0.05);
      s.set(r * 0.42, h * 0.36, r * 0.42);
      mat.compose(p, q, s);
      caps.setMatrixAt(i, mat);
    }
    scene.add(trees, caps);
  },

  /** A clock tower rising out of the town: a pale lit dial, a belfry, a spire. */
  buildTower(world) {
    const { scene, level } = world;
    const x = Math.round(level.goalX * 0.42);
    const zc = -11.2;
    const g = new THREE.Group();
    g.position.set(x, 0, zc);
    const wall = this.m.walls[2];
    const body = new THREE.Mesh(boxWorldUV(2.4, 2.8 - GROUND_Y, 2.2, 2), wall);
    body.position.y = (2.8 + GROUND_Y) / 2;
    g.add(body);
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 2.4), this.m.snow);
    ledge.position.y = 2.86;
    g.add(ledge);
    const belfry = new THREE.Mesh(boxWorldUV(2.0, 1.5, 1.9, 2), wall);
    belfry.position.y = 3.68;
    g.add(belfry);
    for (const dx of [-0.45, 0.45]) {
      const arch = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), this.m.lamp);
      arch.position.set(dx, 3.68, 0.96);
      g.add(arch);
    }
    const slate = new THREE.MeshStandardMaterial({ color: 0x252b3a, roughness: 0.7 });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4.2, 4), slate);
    spire.rotation.y = Math.PI / 4;
    spire.position.y = 6.5;
    g.add(spire);
    const dial = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 32),
      new THREE.MeshStandardMaterial({ color: 0x3a3020, emissive: 0xfff0d0, emissiveIntensity: 0.9 })
    );
    dial.position.set(0, 1.6, 1.11);
    g.add(dial);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 6, 32), this.m.timber);
    rim.position.set(0, 1.6, 1.12);
    g.add(rim);
    for (const [len, rot] of [
      [0.5, 0.15],
      [0.36, -1.9],
    ]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.04, len, 0.02), this.m.coal);
      hand.geometry.translate(0, len / 2, 0);
      hand.position.set(0, 1.6, 1.13);
      hand.rotation.z = rot;
      g.add(hand);
    }
    scene.add(g);
  },

  buildAurora(world, S) {
    const { rng } = world;
    for (const [y, z, w, h, op, speed, color] of [
      [9.5, -84, 300, 24, 0.5, 0.004, 0x9affd0],
      [18, -87, 280, 40, 0.3, -0.003, 0xc0a8ff],
      [5, -82, 260, 13, 0.35, 0.006, 0x7affc0],
    ]) {
      const map = this.tex.aurora.clone();
      map.needsUpdate = true;
      map.repeat.set(1.6, 1);
      map.offset.x = rng();
      const geo = new THREE.PlaneGeometry(w, h, 90, 1);
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          map,
          color,
          transparent: true,
          opacity: op,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: false,
          side: THREE.DoubleSide,
        })
      );
      mesh.position.set(0, y, z);
      world.sky.add(mesh);
      S.aurora.push({ mesh, base: geo.attributes.position.array.slice(), speed, ph: rng() * 6.28 });
    }
  },

  buildIcicles(world) {
    const list = this.icicles;
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(this.geo.icicle, this.m.ice, list.length);
    const mat = new THREE.Matrix4();
    list.forEach((ic, i) => {
      mat.makeScale(1, ic.len, 1).setPosition(ic.x, ic.y, ic.z);
      mesh.setMatrixAt(i, mat);
    });
    world.scene.add(mesh);
  },

  buildWindows(world) {
    const mat = new THREE.Matrix4();
    const pane = new THREE.PlaneGeometry(0.56, 0.77);
    for (const [list, m] of [
      [this.windows.filter((w) => w.lit), this.m.paneLit],
      [this.windows.filter((w) => !w.lit), this.m.paneDark],
    ]) {
      if (!list.length) continue;
      const mesh = new THREE.InstancedMesh(pane, m, list.length);
      list.forEach((w, i) => mesh.setMatrixAt(i, mat.makeTranslation(w.x, w.y, w.z)));
      world.scene.add(mesh);
    }
    if (this.skylights.length) {
      // lies in the front slope: rotated to its pitch, a hair above the snow
      const sky = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.62), this.m.paneLit, this.skylights.length);
      const frame = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.74, 0.06), this.m.timber, this.skylights.length);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-(Math.PI / 2 - PITCH), 0, 0));
      const one = new THREE.Vector3(1, 1, 1);
      const pos = new THREE.Vector3();
      const s = 0.95; // distance down the slope from the ridge
      const n = new THREE.Vector3(0, HALF / SLOPE, ROOF_H / SLOPE); // the slope's normal
      this.skylights.forEach((k, i) => {
        pos.set(k.x, k.top - (ROOF_H / SLOPE) * s, (HALF / SLOPE) * s);
        frame.setMatrixAt(i, mat.compose(pos, q, one));
        pos.addScaledVector(n, 0.05);
        sky.setMatrixAt(i, mat.compose(pos, q, one));
      });
      world.scene.add(frame, sky);
    }
    if (!this.windows.length) return;
    const sills = new THREE.InstancedMesh(new THREE.BoxGeometry(0.7, 0.06, 0.15), this.m.snow, this.windows.length);
    this.windows.forEach((w, i) => sills.setMatrixAt(i, mat.makeTranslation(w.x, w.y - 0.42, w.z + 0.07)));
    world.scene.add(sills);
  },

  /** A lantern on the gable wall over most alleys: the warm light the cat jumps through. */
  buildAlleyLamps(world, S) {
    const { scene, level, rng, tex } = world;
    const m = this.m;
    const glowMat = new THREE.SpriteMaterial({
      map: tex.glow,
      color: 0xffb060,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const bodyGeo = new THREE.BoxGeometry(0.16, 0.24, 0.16);
    const capGeo = new THREE.ConeGeometry(0.14, 0.12, 4);
    const armGeo = new THREE.BoxGeometry(0.34, 0.03, 0.03);
    const pls = level.platforms;
    for (let i = 0; i < pls.length - 1; i++) {
      const cur = pls[i];
      const next = pls[i + 1];
      if (cur.brittle) continue;
      const alley = next.x0 - cur.x1 > 1.5 || next.brittle;
      if (!alley || rng() < 0.3) continue;
      const x = cur.x1 + 0.28;
      const y = cur.top - ROOF_H - 0.45;
      const z = 0.9;
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const arm = new THREE.Mesh(armGeo, m.iron);
      arm.position.set(-0.12, 0.26, 0);
      g.add(arm);
      const body = new THREE.Mesh(bodyGeo, m.lamp);
      g.add(body);
      const cap = new THREE.Mesh(capGeo, m.iron);
      cap.rotation.y = Math.PI / 4;
      cap.position.y = 0.18;
      g.add(cap);
      const glow = new THREE.Sprite(glowMat.clone());
      glow.scale.set(1.7, 1.7, 1);
      g.add(glow);
      scene.add(g);
      world.fixtures.push({ x: x + 0.2, y, z: z + 0.35, color: 0xffb46a, intensity: 10, distance: 8, flicker: true });
      S.lamps.push({ x, glow });
    }
  },

  buildSmoke(world, S) {
    const { scene, tex, rng } = world;
    const base = new THREE.SpriteMaterial({ map: tex.mist, color: 0x8e9ab0, transparent: true, opacity: 0, depthWrite: false });
    for (const sm of this.smokers) {
      const puffs = [];
      for (let k = 0; k < 5; k++) {
        const sp = new THREE.Sprite(base.clone());
        sp.visible = false;
        scene.add(sp);
        puffs.push(sp);
      }
      S.smoke.push({ ...sm, puffs, ph: rng() });
    }
  },

  buildSnowfall(world, S, n) {
    const { scene, rng, tex } = world;
    const pos = new Float32Array(n * 3);
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push({
        x: (rng() - 0.5) * 48,
        y: GROUND_Y + rng() * 15,
        z: -9 + rng() * 16,
        v: 0.45 + rng() * 0.7,
        ph: rng() * 6.28,
        amp: 0.15 + rng() * 0.35,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.12, map: tex.glow, color: 0xe6eeff, transparent: true, opacity: 0.9, depthWrite: false })
    );
    pts.frustumCulled = false;
    scene.add(pts);
    S.flakes = { pts, items, n };
  },

  /** The hanging bell rings as the cat passes under (or over) it. */
  onPass(o, sfx) {
    if (o.kind !== 'bell') return;
    const b = this.bells.find((bl) => Math.abs(bl.x - o.x) < 0.01);
    if (!b) return;
    b.ring = 1;
    b.age = 0;
    sfx.chime();
  },

  update(world, dt, t, catX, camX) {
    const S = world.themeState;
    const rng = world.rng;

    for (const a of S.aurora) {
      a.mesh.material.map.offset.x += a.speed * dt;
      const pos = a.mesh.geometry.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        const x = a.base[i];
        pos[i + 1] = a.base[i + 1] + 2.2 * Math.sin(x * 0.035 + t * 0.12 + a.ph) + 2.6 * Math.sin(x * 0.012 - t * 0.07 + a.ph * 2);
      }
      a.mesh.geometry.attributes.position.needsUpdate = true;
    }

    for (const l of S.lamps) {
      if (Math.abs(l.x - catX) > 40) continue;
      l.glow.material.opacity = 0.55 * (1 + 0.08 * Math.sin(t * 9 + l.x) * Math.sin(t * 2.9 + l.x));
    }

    for (const b of this.bells) {
      b.age += dt;
      b.ring *= Math.exp(-dt * 0.8);
      b.pivot.rotation.z = 0.03 * Math.sin(t * 1.3 + b.ph) + b.ring * 0.28 * Math.sin(b.age * 5.2);
    }

    // smoke: puffs rise, drift with the wind, swell and fade
    for (const sm of S.smoke) {
      const near = Math.abs(sm.x - camX) < 30;
      sm.puffs.forEach((sp, k) => {
        sp.visible = near;
        if (!near) return;
        const u = (t / 3.4 + k / sm.puffs.length + sm.ph) % 1;
        sp.position.set(sm.x - 0.9 * u * u + 0.08 * Math.sin(t * 1.5 + k), sm.y + 1.7 * u * sm.s, sm.z);
        const sc = (0.25 + 1.3 * u) * sm.s;
        sp.scale.set(sc * 1.3, sc, 1);
        sp.material.opacity = 0.2 * Math.pow(Math.sin(Math.PI * u), 1.5);
      });
    }

    // snow falls, sways and drifts left on the wind; respawns above the camera
    const F = S.flakes;
    const fp = F.pts.geometry.attributes.position.array;
    for (let i = 0; i < F.n; i++) {
      const f = F.items[i];
      f.y -= f.v * dt;
      f.x -= 0.3 * dt;
      if (f.y < GROUND_Y) {
        f.y = 10 + rng() * 2;
        f.x = camX + (rng() - 0.5) * 48;
      } else if (Math.abs(f.x - camX) > 24) f.x = camX + (f.x < camX ? 23 : -23);
      fp[i * 3] = f.x + f.amp * Math.sin(t * 0.9 + f.ph);
      fp[i * 3 + 1] = f.y;
      fp[i * 3 + 2] = f.z;
    }
    F.pts.geometry.attributes.position.needsUpdate = true;
  },

  dispose() {},
};
