// Stage VI dressing: a blue-washed desert town on a summer night. The walk runs
// along the flat roofs at the top of the town, over arches spanning the alleys,
// up onto the earth towers of the old walls — water jars, rolled rugs, a birdcage,
// a brazier and crates of oranges to jump, rugs hung out to air, brass lanterns
// and strings of peppers to slide under, old reed mats that give way, and the
// striped awnings of the market stalls below, which throw the cat high. Behind
// it the town falls away down the hill to a palm grove and the dunes, a caravan
// crossing them under the Milky Way and a thin moon. Doves sleep on the parapets,
// cats keep watch from the roofs, and at home a family waits by a dish of sardines.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Mesher } from './snow.js';
import { SceneryCats } from './cats.js';
import {
  limewashTexture,
  plasterTexture,
  awningTexture,
  rugTexture,
  lanternTexture,
  sandTexture,
  zelligeTexture,
  archWindowTexture,
  doorTexture,
  milkyWayTexture,
  reedTexture,
  woodTexture,
  townWindowsTexture,
  boxWorldUV,
} from '../textures.js';

const GROUND_Y = -2.6; // the alleys below the walk
const BACK = -1.4; // the back of the houses along the walk
const ATLAS = { cols: 48, rows: 24 };
// limewash: mostly blues, now and then a white house
const WASH = [0x3f78c8, 0x5a92dc, 0x2f62b0, 0x78a8e4, 0x4a86d0, 0x6a9ae0];
const WHITE = 0xe6eaf0;
const PAINT = [0x2e7a6a, 0x1e4a8a, 0xd8a040, 0x2a8aa0, 0xa83a3a]; // shutters and doors
const AWNINGS = [
  ['#e8dcc4', '#b8282a', '#1e3a6e'],
  ['#e8c870', '#1e4a8a', '#f0e6d0'],
  ['#f0e6d0', '#2a7a5a', '#c8402a'],
];
const SPICE = [0xd8341a, 0xf0b020, 0xe86a1a, 0x7a9a2a, 0x8a3a1a, 0xf6e0a0];
const GERANIUM = [0xe8283a, 0xff5a7a, 0xf04a2a, 0xfff0f0];
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();
const _c = new THREE.Color();

/**
 * Merge a group's child meshes that share a material into one mesh each, so a
 * thing built from many small parts (a birdcage, a string of peppers) is a few
 * draw calls. Only direct children are merged; groups and sprites are left be.
 */
function mergeByMaterial(group) {
  const byMat = new Map();
  for (const o of group.children) {
    if (!o.isMesh || o.isInstancedMesh) continue;
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

/** Map a geometry's 0–1 UVs onto rug k (0–3) of the rug sheet. */
function rugUV(geo, k) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ((k % 2) + uv.getX(i)) / 2, 1 - (Math.floor(k / 2) + 1 - uv.getY(i)) / 2);
  return geo;
}

/** The same rug as a [u0, v0, u1, v0, u1, v1, u0, v1] list for a Mesher quad. */
function rugQuadUV(k) {
  const u0 = (k % 2) / 2;
  const v0 = 1 - (Math.floor(k / 2) + 1) / 2;
  return [u0, v0, u0 + 0.5, v0, u0 + 0.5, v0 + 0.5, u0, v0 + 0.5];
}

/**
 * A horseshoe arch as a path: up the left jamb from y0, round over the crown at
 * yc (the circle a little wider than the opening), down the right jamb.
 */
function horseshoe(path, cx, w, y0, yc) {
  const r = (w / 2) * 1.12;
  const cy = yc - r;
  const yj = cy - Math.sqrt(r * r - (w / 2) * (w / 2));
  path.moveTo(cx - w / 2, y0);
  path.lineTo(cx - w / 2, yj);
  path.absarc(cx, cy, r, Math.atan2(yj - cy, -w / 2), Math.atan2(yj - cy, w / 2), true);
  path.lineTo(cx + w / 2, y0);
  return path;
}

export const cityTheme = {
  key: 'city',
  floorY: GROUND_Y,
  ambience: 'city',
  hanging: new Set(['carpet', 'fanous', 'peppers']),
  cpSink: 0,
  fallFx: { sound: 'poof', color: 0xd8c4a0 },
  colors: {
    bg: 0x05070f,
    fog: 0x0c1124,
    fogNear: 20,
    fogFar: 90,
    hemiSky: 0x3c4e84,
    hemiGround: 0x2a1e18,
    hemiInt: 1.2,
    moon: 0xc8d4ff,
    moonInt: 2.3,
    moonPos: [-24, 7.5, -92],
    moonSize: 2.0,
    moonHalo: 0xd8e0ff,
    skyTop: [0.004, 0.008, 0.03],
    skyMid: [0.014, 0.026, 0.07],
    skyHor: [0.07, 0.055, 0.08],
    starCount: 900,
    starRange: [1, 24],
    fill: 0xb8c8ff,
    puff: 0xd8c8b0,
    spark: 0xffe08a,
    cp: 0xffb060,
  },

  makeTextures(rng) {
    return {
      limewash: limewashTexture(rng),
      plaster: plasterTexture(rng),
      awnings: AWNINGS.map((c) => awningTexture(c)),
      rug: rugTexture(rng),
      lantern: lanternTexture(),
      sand: sandTexture(rng),
      zellige: zelligeTexture(rng),
      winLit: archWindowTexture(true),
      winDark: archWindowTexture(false),
      door: doorTexture(rng),
      milky: milkyWayTexture(rng),
      reed: reedTexture(rng),
      wood: woodTexture(rng),
      town: townWindowsTexture(rng, ATLAS.cols, ATLAS.rows, 0.34, null),
    };
  },

  init(tex) {
    this.tex = tex;
    // filled while the level is built, used when the world is dressed
    this.awnings = [];
    this.swings = [];
    this.lights = [];
    this.braziers = [];
    this.taken = [];
    this.home = null;
    this.goods = []; // spice heaps, oranges, dates on the market stalls, as [matrix, colour]
    this.windows = { lit: [], dark: [] };
    this.shutters = []; // [matrix, colour]
    this.doors = []; // [matrix, colour]
    this.pots = []; // flowerpots on the roofs, as [matrix, colour]
    this.blooms = []; // and what grows in them, as [matrix, colour]
    this.merlons = []; // the battlements of the towers, as matrices
    this.studs = []; // diamonds in relief on the towers, as matrices
    this.palms = { trunks: [], fronds: [] };
    this.rugs = new Mesher(); // rugs hung over the parapets, down the façades
    const std = (o) => new THREE.MeshStandardMaterial(o);
    // for things drawn many to a batch whose glow takes each one's instance colour too
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
    const wash = (color, o = {}) => std({ map: tex.limewash, color, roughness: 0.95, emissive: color, emissiveIntensity: 0.06, ...o });
    this.m = {
      wash: WASH.map((c) => wash(c)),
      white: wash(WHITE, { emissiveIntensity: 0.03 }),
      roof: std({ map: tex.limewash, color: 0x9ea4b4, roughness: 1 }),
      earth: std({ map: tex.plaster, color: 0xc88a5a, roughness: 0.95, emissive: 0x1a0c04, emissiveIntensity: 1 }),
      earthDark: std({ map: tex.plaster, color: 0x9a6038, roughness: 0.95 }),
      sand: std({ map: tex.sand, color: 0x9a8670, roughness: 1 }),
      wood: std({ map: tex.wood, color: 0x9a7a58, roughness: 0.85 }),
      timber: std({ color: 0x3a2618, roughness: 0.85 }),
      palm: std({ color: 0x4a3828, roughness: 0.95 }),
      frond: std({ color: 0x24402a, roughness: 0.9, flatShading: true, side: THREE.DoubleSide }),
      clay: std({ color: 0xb8643a, roughness: 0.85 }),
      jar: std({ color: 0xc8845a, roughness: 0.8 }),
      glaze: std({ color: 0x1e5aa0, roughness: 0.3 }),
      brass: std({ color: 0xd8a850, roughness: 0.3, metalness: 0.75, emissive: 0x4a2a08, emissiveIntensity: 0.5 }),
      lantern: std({ map: tex.lantern.map, emissiveMap: tex.lantern.emissiveMap, emissive: 0xffc070, emissiveIntensity: 2.4, roughness: 0.4, metalness: 0.6 }),
      lamp: std({ color: 0x2a1406, emissive: 0xffc27a, emissiveIntensity: 3.0, roughness: 0.6 }),
      coals: std({ color: 0x2a0a04, emissive: 0xff5a1a, emissiveIntensity: 2.4, roughness: 0.9 }),
      iron: std({ color: 0x1c1a1e, roughness: 0.55, metalness: 0.5 }),
      rug: std({ map: tex.rug, roughness: 0.95, side: THREE.DoubleSide }),
      rugVc: std({ map: tex.rug, roughness: 0.95, vertexColors: true, side: THREE.DoubleSide }),
      awnings: tex.awnings.map((map) => std({ map, roughness: 0.9, side: THREE.DoubleSide })),
      reed: std({ map: tex.reed, roughness: 1 }),
      orange: std({ color: 0xff8a1a, roughness: 0.55, emissive: 0x3a1400 }),
      pepper: std({ color: 0xc8141a, roughness: 0.45, emissive: 0x6a0808, emissiveIntensity: 0.7 }),
      garlic: std({ color: 0xf0e8dc, roughness: 0.7, emissive: 0x2a2620 }),
      goods: tinted({ roughness: 0.9, emissiveIntensity: 0.12, flatShading: true }),
      bloom: tinted({ roughness: 0.8, emissiveIntensity: 0.3 }),
      paint: std({ color: 0xffffff, roughness: 0.7 }),
      shutter: std({ color: PAINT[0], roughness: 0.7 }),
      leaf: std({ color: 0x2c5a2e, roughness: 0.9, flatShading: true }),
      zellige: std({ map: tex.zellige, roughness: 0.3 }),
      door: std({ map: tex.door, alphaTest: 0.5, roughness: 0.7 }),
      winLit: std({ map: tex.winLit, emissiveMap: tex.winLit, emissive: 0xffffff, emissiveIntensity: 0.9, alphaTest: 0.5, roughness: 0.8 }),
      winDark: std({ map: tex.winDark, alphaTest: 0.5, roughness: 0.6 }),
      dove: std({ color: 0xe8e4dc, roughness: 0.8, emissive: 0x2a2a30 }),
      wing: std({ color: 0xe8e4dc, roughness: 0.8, emissive: 0x2a2a30, side: THREE.DoubleSide }),
      bird: std({ color: 0xf0c830, roughness: 0.6, emissive: 0x4a3a00 }),
      cushion: std({ color: 0xa83a4a, roughness: 0.9 }),
      cushion2: std({ color: 0xd8a040, roughness: 0.9 }),
      dish: std({ color: 0x1e5aa0, roughness: 0.3 }),
      fish: std({ color: 0xa8b4c0, roughness: 0.3, metalness: 0.5 }),
      lemon: std({ color: 0xf0d020, roughness: 0.6, emissive: 0x3a3000 }),
    };
    const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    this.geo = {
      unitBox: new THREE.BoxGeometry(1, 1, 1),
      ball: new THREE.SphereGeometry(1, 12, 8),
      lump: new THREE.IcosahedronGeometry(1, 1),
      clump: new THREE.IcosahedronGeometry(1, 0),
      pole: new THREE.CylinderGeometry(1, 1, 1, 8),
      cone: new THREE.ConeGeometry(1, 1, 10),
      jar: lathe([[0.001, 0], [0.12, 0], [0.2, 0.08], [0.27, 0.3], [0.28, 0.45], [0.22, 0.66], [0.12, 0.76], [0.1, 0.84], [0.13, 0.88], [0.13, 0.9], [0.09, 0.9], [0.08, 0.85], [0.001, 0.85]], 16),
      pot: lathe([[0.001, 0], [0.12, 0], [0.17, 0.26], [0.19, 0.26], [0.19, 0.31], [0.16, 0.31], [0.14, 0.07], [0.001, 0.07]], 12),
      // a brass lantern: a pierced body under an onion dome, a finial on top
      lantern: lathe([[0.001, 0], [0.05, 0], [0.11, 0.06], [0.12, 0.22], [0.09, 0.27], [0.12, 0.31], [0.08, 0.4], [0.02, 0.46], [0.001, 0.5]], 10),
      bowl: lathe([[0.001, 0], [0.12, 0], [0.24, 0.08], [0.27, 0.16], [0.25, 0.16], [0.001, 0.1]], 14),
      teapot: lathe([[0.001, 0], [0.07, 0], [0.1, 0.06], [0.09, 0.12], [0.05, 0.15], [0.04, 0.18], [0.001, 0.2]], 10),
      tube: new THREE.CylinderGeometry(0.012, 0.012, 1, 5).translate(0, -0.5, 0),
      wing: new THREE.PlaneGeometry(0.14, 0.18),
      frond: (() => {
        // a palm frond: a long narrow leaf arching out and down from the crown
        const g = new THREE.PlaneGeometry(1, 0.22, 4, 1);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const u = pos.getX(i) + 0.5;
          pos.setXYZ(i, u, -0.6 * u * u, pos.getY(i) * (1 - u * 0.7));
        }
        g.computeVertexNormals();
        return g;
      })(),
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
    if (kind === 'jar') {
      // a big water jar with a blue-glazed band, a little one behind it
      add(this.geo.jar, m.jar, 0, 0, 0);
      const band = add(new THREE.TorusGeometry(0.275, 0.025, 6, 20), m.glaze, 0, 0.42, 0, false);
      band.rotation.x = Math.PI / 2;
      for (const s of [-1, 1]) {
        const h = add(new THREE.TorusGeometry(0.09, 0.022, 6, 10, Math.PI), m.jar, 0, 0.66, s * 0.17);
        h.rotation.set(0, s > 0 ? 0 : Math.PI, -Math.PI / 2);
      }
      add(this.geo.jar, m.clay, -0.05, 0, -0.42).scale.setScalar(0.62);
      size = { w: 0.6, h: 0.9 };
    } else if (kind === 'rugs') {
      // rolled rugs stacked two and one, tied with cord
      const roll = (px, py, k) => {
        const r = add(rugUV(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 14), k), m.rug, px, py, 0);
        r.rotation.x = Math.PI / 2;
        for (const z of [-0.35, 0.35]) add(new THREE.TorusGeometry(0.165, 0.012, 4, 14), m.timber, px, py, z, false);
      };
      roll(-0.17, 0.16, 0);
      roll(0.17, 0.16, 1);
      roll(0, 0.44, 2 + Math.floor(rng() * 2));
      size = { w: 0.68, h: 0.6 };
    } else if (kind === 'cage') {
      // a domed brass birdcage on a low stand, a canary inside
      add(this.geo.pole, m.brass, 0, 0.02, 0).scale.set(0.2, 0.04, 0.2);
      add(this.geo.pole, m.brass, 0, 0.2, 0).scale.set(0.025, 0.36, 0.025);
      add(this.geo.pole, m.brass, 0, 0.39, 0).scale.set(0.22, 0.03, 0.22);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        add(this.geo.pole, m.brass, Math.cos(a) * 0.2, 0.56, Math.sin(a) * 0.2, false).scale.set(0.008, 0.34, 0.008);
      }
      for (let i = 0; i < 4; i++) {
        const arc = add(new THREE.TorusGeometry(0.2, 0.008, 4, 16, Math.PI), m.brass, 0, 0.73, 0, false);
        arc.rotation.y = (i / 4) * Math.PI;
      }
      add(new THREE.TorusGeometry(0.2, 0.012, 4, 20), m.brass, 0, 0.73, 0, false).rotation.x = Math.PI / 2;
      add(this.geo.ball, m.brass, 0, 0.95, 0).scale.setScalar(0.03);
      const perch = add(this.geo.pole, m.timber, 0, 0.55, 0, false);
      perch.scale.set(0.006, 0.34, 0.006);
      perch.rotation.x = Math.PI / 2;
      add(this.geo.ball, m.bird, 0, 0.61, 0).scale.set(0.06, 0.045, 0.045);
      add(this.geo.ball, m.bird, 0.05, 0.65, 0).scale.setScalar(0.03);
      size = { w: 0.48, h: 0.96 };
    } else if (kind === 'brazier') {
      // a brass brazier on three legs, the coals glowing, a teapot keeping warm
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = add(this.geo.pole, m.iron, Math.cos(a) * 0.17, 0.16, Math.sin(a) * 0.17);
        leg.scale.set(0.02, 0.34, 0.02);
        leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
      }
      add(this.geo.bowl, m.brass, 0, 0.3, 0);
      for (let i = 0; i < 9; i++) add(this.geo.clump, m.coals, (rng() - 0.5) * 0.3, 0.44, (rng() - 0.5) * 0.3, false).scale.setScalar(0.05 + rng() * 0.03);
      add(this.geo.teapot, m.brass, 0.02, 0.45, 0);
      const spout = add(this.geo.pole, m.brass, 0.12, 0.54, 0, false);
      spout.scale.set(0.012, 0.12, 0.012);
      spout.rotation.z = -0.9;
      this.braziers.push({ x, y: top + 0.5 });
      this.lights.push({ x, y: top + 0.7, z: 0.5, color: 0xff7a30, intensity: 5, distance: 5, flicker: true });
      size = { w: 0.6, h: 0.68 };
    } else {
      // oranges: a crate heaped with them, a few spilled on top
      add(boxWorldUV(0.7, 0.36, 0.55, 1), m.wood, 0, 0.18, 0);
      for (let i = 0; i < 16; i++) {
        const r = 0.065 + rng() * 0.01;
        const px = (rng() - 0.5) * 0.52;
        const pz = (rng() - 0.5) * 0.4;
        const py = 0.36 + r + (0.08 - Math.abs(px) * 0.2) * (rng() < 0.6 ? 1 : 0.4);
        add(this.geo.ball, m.orange, px, py, pz, false).scale.setScalar(r);
      }
      size = { w: 0.72, h: 0.58 };
    }
    group.add(mergeByMaterial(g));
    return size;
  },

  buildHanging(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    const post = (px, h) => {
      const p = new THREE.Mesh(this.geo.pole, m.timber);
      p.scale.set(0.045, h, 0.045);
      p.position.set(px, h / 2, -0.95);
      p.castShadow = true;
      g.add(p);
    };
    const arm = (px, y) => {
      const a = new THREE.Mesh(this.geo.pole, m.timber);
      a.scale.set(0.025, 0.92, 0.025);
      a.rotation.x = Math.PI / 2;
      a.position.set(px, y, -0.52);
      g.add(a);
    };
    // what hangs over the walk swings when the cat goes by
    const swing = new THREE.Group();
    g.add(swing);
    let size;
    if (kind === 'carpet') {
      // a pole over the walk with rugs hung over it to air
      const lineY = 1.02;
      for (const s of [-1, 1]) {
        post(s * 0.85, lineY + 0.08);
        arm(s * 0.85, lineY + 0.04);
      }
      const bar = new THREE.Mesh(this.geo.pole, m.timber);
      bar.scale.set(0.03, 1.9, 0.03);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, lineY + 0.04, -0.06);
      g.add(bar);
      swing.position.set(0, lineY + 0.04, -0.06);
      const k = Math.floor(rng() * 4);
      for (const [px, w, k2] of [
        [-0.33, 0.62, k],
        [0.34, 0.6, (k + 1) % 4],
      ]) {
        const rug = new THREE.Mesh(rugUV(new THREE.BoxGeometry(w, 0.54, 0.02), k2), m.rug);
        rug.position.set(px, -0.29, 0.015);
        rug.rotation.z = (rng() - 0.5) * 0.04;
        rug.castShadow = true;
        swing.add(rug);
        const back = new THREE.Mesh(rugUV(new THREE.BoxGeometry(w, 0.24, 0.02), k2), m.rug);
        back.position.set(px, -0.12, -0.04);
        swing.add(back);
      }
      size = { w: 1.3, clearance: 0.48, height: 1.08 };
    } else if (kind === 'fanous') {
      // brass lanterns hung at different heights from a bracket: they clink as the cat goes by
      post(0, 1.66);
      arm(0, 1.62);
      swing.position.set(0, 1.6, -0.08);
      for (const [px, pz, drop, s] of [
        [-0.2, 0.02, 0.52, 0.95],
        [0.02, -0.06, 0.22, 0.8],
        [0.2, 0.05, 0.42, 1.05],
      ]) {
        const chain = new THREE.Mesh(this.geo.tube, m.iron);
        chain.scale.set(1, drop, 1);
        chain.position.set(px, 0, pz);
        swing.add(chain);
        const l = new THREE.Mesh(this.geo.lantern, m.lantern);
        l.scale.setScalar(s);
        l.position.set(px, -drop - 0.5 * s, pz);
        l.castShadow = true;
        swing.add(l);
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffb860, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })
        );
        glow.position.set(px, -drop - 0.3 * s, pz);
        glow.scale.set(0.9, 0.9, 1);
        swing.add(glow);
      }
      size = { w: 0.72, clearance: 0.5, height: 1.1 };
    } else {
      // strings of red peppers and plaits of garlic hung from a beam to dry
      const lineY = 1.02;
      for (const s of [-1, 1]) {
        post(s * 0.62, lineY + 0.08);
        arm(s * 0.62, lineY + 0.04);
      }
      const beam = new THREE.Mesh(this.geo.unitBox, m.timber);
      beam.scale.set(1.45, 0.08, 0.08);
      beam.position.set(0, lineY + 0.06, -0.06);
      g.add(beam);
      swing.position.set(0, lineY + 0.02, -0.06);
      for (let i = 0; i < 5; i++) {
        const sx = -0.4 + i * 0.2;
        const garlic = i === 2;
        const n = garlic ? 5 : 7;
        const len = 0.42 + rng() * 0.06;
        for (let k = 0; k < n; k++) {
          const u = k / (n - 1);
          const mesh = garlic
            ? new THREE.Mesh(this.geo.ball, m.garlic)
            : new THREE.Mesh(this.geo.cone, m.pepper);
          if (garlic) mesh.scale.set(0.055, 0.05, 0.055);
          else {
            mesh.scale.set(0.028, 0.14, 0.028);
            mesh.rotation.set((rng() - 0.5) * 0.8, 0, Math.PI + (rng() - 0.5) * 0.8);
          }
          mesh.position.set(sx + (rng() - 0.5) * 0.06, -0.06 - u * len, (rng() - 0.5) * 0.08);
          mesh.castShadow = k % 2 === 0;
          swing.add(mesh);
        }
      }
      size = { w: 1.0, clearance: 0.44, height: 1.1 };
    }
    mergeByMaterial(swing);
    group.add(mergeByMaterial(g));
    this.swings.push({ x, g: swing, kick: 0, age: 0, ph: rng() * 6.28, kind });
    this.lights.push({ x, y: top + 1.0, z: 0.9, color: 0xffc27a, intensity: kind === 'fanous' ? 6 : 3, distance: kind === 'fanous' ? 7 : 6, flicker: kind === 'fanous' });
    return size;
  },

  /** Old reed mats laid over palm-trunk beams between the roofs: mat and beams drop together when they give way. */
  buildBrittle(group, x0, x1, top, rng) {
    const m = this.m;
    const len = x1 - x0;
    const n = Math.max(2, Math.round(len / 1.2));
    const seg = len / n;
    const matGeo = new THREE.BoxGeometry(seg - 0.05, 0.05, 1.3);
    const beamGeo = new THREE.CylinderGeometry(0.07, 0.07, seg, 7).rotateZ(Math.PI / 2);
    const pieces = [];
    for (let i = 0; i < n; i++) {
      const p = new THREE.Group();
      p.position.set(x0 + seg * (i + 0.5), top, 0);
      const mat = new THREE.Mesh(matGeo, m.reed);
      mat.position.set((rng() - 0.5) * 0.04, -0.03, (rng() - 0.5) * 0.06);
      mat.rotation.set((rng() - 0.5) * 0.04, (rng() - 0.5) * 0.04, (rng() - 0.5) * 0.03);
      mat.castShadow = mat.receiveShadow = true;
      p.add(mat);
      for (const z of [-0.45, 0.45]) {
        const b = new THREE.Mesh(beamGeo, m.palm);
        b.position.set(0, -0.12, z);
        b.castShadow = true;
        p.add(b);
      }
      group.add(p);
      pieces.push(p);
    }
    // palm-trunk posts stand in the alley at either end and stay; a lantern hangs from one
    for (const x of [x0 + 0.2, x1 - 0.2]) {
      for (const z of [-0.7, 0.7]) {
        const leg = new THREE.Mesh(this.geo.pole, m.palm);
        leg.scale.set(0.09, top - 0.2 - GROUND_Y, 0.09);
        leg.position.set(x, (top - 0.2 + GROUND_Y) / 2, z);
        leg.castShadow = true;
        group.add(leg);
      }
    }
    const pole = new THREE.Mesh(this.geo.pole, m.timber);
    pole.scale.set(0.05, 1.55, 0.05);
    pole.position.set(x0 + 0.2, top + 0.55, -0.95);
    pole.castShadow = true;
    group.add(pole);
    const lamp = new THREE.Mesh(this.geo.lantern, m.lantern);
    lamp.scale.setScalar(0.7);
    lamp.position.set(x0 + 0.2, top + 0.98, -0.82);
    group.add(lamp);
    this.lights.push({ x: x0 + 1.2, y: top + 1.3, z: -0.2, color: 0xffb860, intensity: 7, distance: 8, flicker: true });
    return pieces;
  },

  /**
   * A market stall in the alley: a striped awning stretched flat on four poles,
   * scalloped at the edges, goods heaped on a table under it and a lamp lit.
   * Returns the awning's skin, which sags and springs when the cat lands on it.
   */
  buildBouncy(group, x0, x1, top, rng) {
    const m = this.m;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const depth = 2.3;
    const mat = m.awnings[this.awnings.length % m.awnings.length];
    for (const x of [x0 + 0.12, x1 - 0.12]) {
      for (const z of [-depth / 2 + 0.08, depth / 2 - 0.08]) {
        const pole = new THREE.Mesh(this.geo.pole, m.timber);
        pole.scale.set(0.05, top - GROUND_Y + 0.02, 0.05);
        pole.position.set(x, (top + GROUND_Y) / 2, z);
        pole.castShadow = true;
        group.add(pole);
      }
    }
    // the canvas: a little slack in the middle (more when it is landed on)
    const skin = new THREE.Group();
    skin.position.set(cx, top, 0);
    group.add(skin);
    const sheet = new THREE.PlaneGeometry(len, depth, Math.max(4, Math.round(len * 3)), 6).rotateX(-Math.PI / 2);
    const pos = sheet.attributes.position;
    const uv = sheet.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / len + 0.5;
      const v = pos.getZ(i) / depth + 0.5;
      pos.setY(i, -0.07 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
      uv.setX(i, (u * len) / 0.9);
    }
    sheet.computeVertexNormals();
    const canvas = new THREE.Mesh(sheet, mat);
    canvas.castShadow = canvas.receiveShadow = true;
    skin.add(canvas);
    // scalloped valances front and back, outside the skin so they flap on their own
    const flaps = [];
    const n = Math.max(3, Math.round(len / 0.45));
    const tabGeo = new THREE.CircleGeometry(len / n / 2, 10, Math.PI, Math.PI);
    for (const s of [-1, 1]) {
      const flap = new THREE.Group();
      flap.position.set(cx, top - 0.01, s * depth * 0.5);
      const band = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.1), mat);
      band.position.y = -0.05;
      flap.add(band);
      for (let i = 0; i < n; i++) {
        const tab = new THREE.Mesh(tabGeo, mat);
        tab.position.set(-len / 2 + (len / n) * (i + 0.5), -0.1, 0);
        tab.scale.y = 0.7;
        flap.add(tab);
      }
      group.add(mergeByMaterial(flap));
      flaps.push(flap);
    }
    // the stall: a table of goods, a lamp hung under the awning
    const table = new THREE.Mesh(boxWorldUV(len - 0.5, 0.08, 1.2, 1), m.wood);
    table.position.set(cx, GROUND_Y + 0.8, 0.25);
    table.receiveShadow = true;
    group.add(table);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(this.geo.unitBox, m.timber);
      leg.scale.set(0.07, 0.8, 1.1);
      leg.position.set(cx + s * (len / 2 - 0.4), GROUND_Y + 0.4, 0.25);
      group.add(leg);
    }
    for (let x = x0 + 0.5; x < x1 - 0.4; x += 0.42 + rng() * 0.12) {
      const z = 0.25 + (rng() - 0.5) * 0.7;
      const kind = rng();
      const y = GROUND_Y + 0.84;
      if (kind < 0.6) {
        // a heap of spice, pointed like a cone
        const r = 0.13 + rng() * 0.04;
        this.goods.push([_m.compose(_p.set(x, y + r * 0.6, z), _q.identity(), _s.set(r, r * 1.2, r)).clone(), SPICE[Math.floor(rng() * SPICE.length)], 'cone']);
      } else {
        // a basket of dates, olives or oranges
        const r = 0.15;
        this.goods.push([_m.compose(_p.set(x, y + 0.06, z), _q.identity(), _s.set(r, 0.06, r)).clone(), 0x7a5a34, 'cyl']);
        const fill = [0x4a1e10, 0x3a4a1a, 0xff8a1a][Math.floor(rng() * 3)];
        this.goods.push([_m.compose(_p.set(x, y + 0.12, z), _q.identity(), _s.set(r * 0.9, 0.05, r * 0.9)).clone(), fill, 'ball']);
      }
    }
    const lamp = new THREE.Mesh(this.geo.lantern, m.lantern);
    lamp.scale.setScalar(0.8);
    lamp.position.set(cx, top - 0.65, 0.4);
    group.add(lamp);
    this.lights.push({ x: cx, y: top - 0.6, z: 0.9, color: 0xffb060, intensity: 6, distance: 6, flicker: true });
    const a = { x0, x1, skin, flaps, kick: 0, age: 0, at: 0, ph: rng() * 6.28 };
    this.awnings.push(a);
    return a;
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
    // the gate: a horseshoe arch standing just behind the walk, a lantern in its crown
    const back = -1.0;
    const gate = new THREE.Shape();
    gate.moveTo(-1.45, top);
    gate.lineTo(1.45, top);
    gate.lineTo(1.45, top + 2.9);
    gate.lineTo(-1.45, top + 2.9);
    gate.holes.push(horseshoe(new THREE.Path(), 0, 1.9, top, top + 2.45));
    const gateGeo = new THREE.ExtrudeGeometry(gate, { depth: 0.3, bevelEnabled: false });
    const guv = gateGeo.attributes.uv;
    for (let i = 0; i < guv.count; i++) guv.setXY(i, guv.getX(i) * 0.5, guv.getY(i) * 0.5);
    add(gateGeo, m.white, 0, 0, back - 0.15, true);
    add(boxWorldUV(3.1, 0.14, 0.42, 1), m.roof, 0, top + 2.97, back);
    for (let i = -2; i <= 2; i++) add(this.geo.unitBox, m.white, i * 0.6, top + 3.16, back).scale.set(0.3, 0.26, 0.3);
    add(new THREE.PlaneGeometry(2.7, 0.34), m.zellige, 0, top + 2.68, back + 0.16);
    add(this.geo.tube, m.iron, 0, top + 2.45, back + 0.1).scale.set(1, 0.35, 1);
    add(this.geo.lantern, m.lantern, 0, top + 1.6, back + 0.1).scale.setScalar(1.0);

    // home: a riad on a terrace behind the walk, its door under a horseshoe arch
    const hx0 = 2.4;
    const hx1 = 12.5;
    const zc = -4.0;
    const half = 1.6;
    const front = zc + half;
    const h = 3.6;
    add(boxWorldUV(14, top - 0.12 - GROUND_Y + 6, 5, 2), m.wash[2], 7.4, (top - 0.12 + GROUND_Y - 6) / 2, -4.0);
    add(boxWorldUV(14, 0.12, 5, 1), m.zellige, 7.4, top - 0.06, -4.0);
    add(boxWorldUV(hx1 - hx0, h, half * 2, 2), m.white, (hx0 + hx1) / 2, top + h / 2, zc);
    add(boxWorldUV(hx1 - hx0 + 0.3, 0.16, half * 2 + 0.3, 1), m.roof, (hx0 + hx1) / 2, top + h + 0.08, zc);
    for (let x = hx0; x <= hx1 + 0.01; x += 0.7) add(this.geo.unitBox, m.white, x, top + h + 0.3, front - 0.1).scale.set(0.34, 0.32, 0.2);
    const dx = hx0 + 3.0;
    // the door: zellige round it, the arch over it, studs on the planks
    const surround = new THREE.Shape();
    surround.moveTo(dx - 1.15, top);
    surround.lineTo(dx + 1.15, top);
    surround.lineTo(dx + 1.15, top + 2.95);
    surround.lineTo(dx - 1.15, top + 2.95);
    surround.holes.push(horseshoe(new THREE.Path(), dx, 1.3, top, top + 2.45));
    const sgeo = new THREE.ShapeGeometry(surround);
    const suv = sgeo.attributes.uv;
    for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getX(i) / 0.6, suv.getY(i) / 0.6);
    add(sgeo, m.zellige, 0, 0, front + 0.012);
    const doorMat = m.door.clone();
    doorMat.color.setHex(0x2a5aa8);
    add(new THREE.PlaneGeometry(1.3, 2.45), doorMat, dx, top + 1.225, front + 0.006);
    add(this.geo.unitBox, m.earthDark, dx, top + 0.05, front + 0.3).scale.set(1.6, 0.1, 0.5);
    add(this.geo.ball, m.brass, dx + 0.42, top + 1.2, front + 0.05).scale.setScalar(0.05);
    // lanterns either side of the door, a lit window, a bench with cushions, lemon trees in pots
    for (const s of [-1, 1]) {
      add(this.geo.unitBox, m.iron, dx + s * 1.45, top + 2.3, front + 0.1).scale.set(0.04, 0.04, 0.24);
      add(this.geo.lantern, m.lantern, dx + s * 1.45, top + 1.78, front + 0.2).scale.setScalar(0.9);
    }
    for (const wx of [hx0 + 5.6, hx0 + 7.6]) {
      add(new THREE.PlaneGeometry(0.75, 1.15), m.winLit, wx, top + 1.7, front + 0.01);
      for (const s of [-1, 1]) add(this.geo.unitBox, m.shutter, wx + s * 0.55, top + 1.7, front + 0.03).scale.set(0.34, 1.12, 0.03);
    }
    add(this.geo.unitBox, m.wood, hx0 + 6.6, top + 0.42, front + 0.42).scale.set(1.5, 0.08, 0.42);
    for (const s of [-1, 1]) add(this.geo.unitBox, m.timber, hx0 + 6.6 + s * 0.65, top + 0.2, front + 0.42).scale.set(0.08, 0.4, 0.36);
    add(this.geo.ball, m.cushion, hx0 + 6.3, top + 0.52, front + 0.42).scale.set(0.3, 0.07, 0.18);
    add(this.geo.ball, m.cushion2, hx0 + 6.95, top + 0.52, front + 0.42).scale.set(0.28, 0.07, 0.18);
    for (const px of [hx0 + 1.2, hx0 + 4.8]) {
      add(this.geo.pot, m.glaze, px, top, front + 0.45).scale.setScalar(1.8);
      add(this.geo.pole, m.palm, px, top + 0.8, front + 0.45).scale.set(0.035, 0.6, 0.035);
      add(this.geo.lump, m.leaf, px, top + 1.3, front + 0.45, true).scale.setScalar(0.36);
      for (let i = 0; i < 7; i++) {
        const a = rng() * Math.PI * 2;
        add(this.geo.ball, m.lemon, px + Math.cos(a) * 0.3, top + 1.2 + rng() * 0.25, front + 0.45 + Math.sin(a) * 0.3).scale.setScalar(0.045);
      }
    }
    level.group.add(mergeByMaterial(g));
    level.fixtures.push({ x: gx, y: top + 1.7, z: -0.5, color: 0xffb860, intensity: 5, distance: 7, flicker: true });
    level.fixtures.push({ x: gx + dx - 1.45, y: top + 1.9, z: front + 0.8, color: 0xffc070, intensity: 4.5, distance: 7, flicker: true });
    level.fixtures.push({ x: gx + dx + 1.45, y: top + 1.9, z: front + 0.8, color: 0xffc070, intensity: 4.5, distance: 7, flicker: true });
    level.fixtures.push({ x: gx + hx0 + 6.6, y: top + 1.7, z: front + 0.9, color: 0xffc27a, intensity: 4, distance: 8 });
  },

  // --- dressing ----------------------------------------------------------------
  dress(world) {
    const { quality } = world;
    const S = (world.themeState = {
      cats: null,
      lamps: [],
      doves: [],
      moths: null,
      motes: null,
      meteors: [],
      meteorT: 2,
      caravan: null,
      finale: false,
      finaleT: 0,
    });
    this.buildGround(world);
    this.buildPlatforms(world);
    this.buildTown(world);
    this.buildDesert(world, S);
    this.buildSkyExtras(world, S);
    this.buildCats(world, S);
    this.buildLamps(world, S);
    this.buildDoves(world, S);
    this.buildMoths(world, S);
    this.buildMotes(world, S, Math.round(110 * quality.particles));
    this.buildInstanced(world);
    for (const l of this.lights) world.fixtures.push(l);
  },

  /** The alleys under the walk, and the wall the town drops away behind. */
  buildGround(world) {
    const { scene, level } = world;
    const len = level.endX + 220;
    const x0 = -100;
    const map = this.m.sand.map.clone();
    map.needsUpdate = true;
    map.repeat.set(len / 3, 9 / 3);
    const alley = new THREE.Mesh(new THREE.PlaneGeometry(len, 9), new THREE.MeshStandardMaterial({ map, color: 0x6a5c50, roughness: 1 }));
    alley.rotation.x = -Math.PI / 2;
    alley.position.set(x0 + len / 2, GROUND_Y, 1.5);
    alley.receiveShadow = true;
    scene.add(alley);
    const drop = new THREE.Mesh(boxWorldUV(len, 8, 0.6, 2), this.m.wash[2]);
    drop.position.set(x0 + len / 2, GROUND_Y - 4, -3.3);
    scene.add(drop);
  },

  /** Dress each platform: an earth tower if it is high, an arch over the alley if it is short with gaps either side, else a row of houses. */
  buildPlatforms(world) {
    const pls = world.level.platforms;
    pls.forEach((pl, i) => {
      if (pl.brittle || pl.bouncy) return;
      const prev = pls[i - 1];
      const next = pls[i + 1];
      const open = (!prev || pl.x0 - prev.x1 > 0.01) && (!next || next.x0 - pl.x1 > 0.01);
      if (pl.top >= 1.8) this.tower(world, pl);
      else if (open && pl.x1 - pl.x0 <= 6) this.arch(world, pl);
      else this.houses(world, pl);
    });
  },

  /** Windows on a façade between x0 and x1 at depth z: rows of them, lit or dark, some shuttered. */
  facade(rng, x0, x1, top, z, { rowsFrom = 0.95, door = true } = {}) {
    const w = x1 - x0;
    const cols = Math.max(1, Math.floor((w - 0.4) / 1.3));
    for (let y = top - rowsFrom; y > GROUND_Y + 1.5; y -= 1.3) {
      for (let i = 0; i < cols; i++) {
        if (rng() < 0.22) continue;
        const x = x0 + ((i + 0.5) / cols) * w + (rng() - 0.5) * 0.2;
        const lit = rng() < 0.38;
        _q.identity();
        (lit ? this.windows.lit : this.windows.dark).push(_m.compose(_p.set(x, y, z + 0.012), _q, _s.set(0.5, 0.75, 1)).clone());
        if (rng() < 0.55) {
          const col = PAINT[Math.floor(rng() * PAINT.length)];
          for (const s of [-1, 1]) this.shutters.push([_m.compose(_p.set(x + s * 0.4, y - 0.04, z + 0.03), _q, _s.set(0.28, 0.66, 0.03)).clone(), col]);
        }
      }
    }
    if (door && rng() < 0.6) {
      const x = x0 + 0.8 + rng() * Math.max(0.1, w - 1.6);
      this.doors.push([_m.compose(_p.set(x, GROUND_Y + 0.85, z + 0.01), _q.identity(), _s.set(1.0, 1.7, 1)).clone(), PAINT[Math.floor(rng() * PAINT.length)]]);
    }
  },

  /** A row of flat-roofed houses under the walk, each its own wash, depth and parapet. */
  houses(world, pl) {
    const { scene, rng } = world;
    const m = this.m;
    const { x0, x1, top } = pl;
    let x = x0;
    while (x < x1 - 0.01) {
      let w = 3.5 + rng() * 3.5;
      if (x1 - (x + w) < 2.5) w = x1 - x;
      const hx0 = x;
      const hx1 = x + w;
      const front = 1.3 + rng() * 0.25;
      const mat = rng() < 0.16 ? m.white : m.wash[Math.floor(rng() * m.wash.length)];
      const h = top - 0.1 - GROUND_Y;
      const box = new THREE.Mesh(boxWorldUV(w, h, front - BACK, 2), mat);
      box.position.set((hx0 + hx1) / 2, GROUND_Y + h / 2, (front + BACK) / 2);
      box.receiveShadow = true;
      scene.add(box);
      const roof = new THREE.Mesh(boxWorldUV(w + 0.04, 0.1, front - BACK + 0.1, 2), m.roof);
      roof.position.set((hx0 + hx1) / 2, top - 0.05, (front + BACK) / 2);
      roof.receiveShadow = roof.castShadow = true;
      scene.add(roof);
      // the parapet at the back of the roof, now and then stepped
      const ph = 0.3 + rng() * 0.3;
      const par = new THREE.Mesh(boxWorldUV(w, ph, 0.2, 2), mat);
      par.position.set((hx0 + hx1) / 2, top + ph / 2, BACK + 0.08);
      par.castShadow = true;
      scene.add(par);
      if (rng() < 0.3) {
        for (let mx = hx0 + 0.35; mx < hx1 - 0.2; mx += 0.7) this.merlons.push([_m.compose(_p.set(mx, top + ph + 0.12, BACK + 0.08), _q.identity(), _s.set(0.32, 0.24, 0.2)).clone(), mat.color]);
      }
      this.facade(rng, hx0, hx1, top, front);
      // a rug hung over the edge of the roof, down the front
      if (rng() < 0.3 && w > 2.4) {
        const rx = hx0 + 0.7 + rng() * (w - 1.4);
        const rw = 0.8 + rng() * 0.3;
        const rh = 1.1 + rng() * 0.4;
        const z = front + 0.05;
        this.rugs.quad([rx - rw / 2, top - 0.08 - rh, z], [rx + rw / 2, top - 0.08 - rh, z], [rx + rw / 2, top - 0.08, z], [rx - rw / 2, top - 0.08, z], _c.setRGB(1, 1, 1), rugQuadUV(Math.floor(rng() * 4)));
      }
      // pots of geraniums along the back of the roof
      for (let px = hx0 + 0.4 + rng(); px < hx1 - 0.3; px += 0.8 + rng() * 2.2) {
        if (rng() < 0.4) continue;
        const s = 0.9 + rng() * 0.5;
        this.pots.push([_m.compose(_p.set(px, top, -1.05), _q.identity(), _s.setScalar(s)).clone(), rng() < 0.6 ? 0x1e5aa0 : 0xb8643a]);
        for (let k = 0; k < 4; k++) {
          const r = 0.06 + rng() * 0.04;
          const leaf = k < 2;
          this.blooms.push([_m.compose(_p.set(px + (rng() - 0.5) * 0.2 * s, top + 0.33 * s + rng() * 0.12, -1.05 + (rng() - 0.5) * 0.18), _q.identity(), _s.setScalar(leaf ? r * 1.4 : r)).clone(), leaf ? 0x2c5a2e : GERANIUM[Math.floor(rng() * GERANIUM.length)]]);
        }
      }
      // a fixture for each house with a lit window looking onto the walk
      if (rng() < 0.45) world.fixtures.push({ x: (hx0 + hx1) / 2, y: top - 0.9, z: front + 0.8, color: 0xffb46a, intensity: 3, distance: 6 });
      x = hx1;
    }
  },

  /** A tower of the old earth walls: battlements at the back, diamonds in relief, slit windows. */
  tower(world, pl) {
    const { scene, rng } = world;
    const m = this.m;
    const { x0, x1, top } = pl;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const front = 1.45;
    const h = top - 0.1 - GROUND_Y;
    const body = new THREE.Mesh(boxWorldUV(len, h, front - BACK, 2), m.earth);
    body.position.set(cx, GROUND_Y + h / 2, (front + BACK) / 2);
    body.receiveShadow = true;
    scene.add(body);
    const roof = new THREE.Mesh(boxWorldUV(len + 0.04, 0.1, front - BACK + 0.1, 2), m.earthDark);
    roof.position.set(cx, top - 0.05, (front + BACK) / 2);
    roof.receiveShadow = roof.castShadow = true;
    scene.add(roof);
    // the corners stand proud of the face, up to just over the roof
    for (const px of [x0 + 0.3, x1 - 0.3]) {
      const p = new THREE.Mesh(boxWorldUV(0.6, h + 0.25, 0.3, 2), m.earth);
      p.position.set(px, GROUND_Y + (h + 0.25) / 2, front + 0.1);
      p.castShadow = true;
      scene.add(p);
    }
    const par = new THREE.Mesh(boxWorldUV(len, 0.45, 0.24, 2), m.earth);
    par.position.set(cx, top + 0.22, BACK + 0.1);
    par.castShadow = true;
    scene.add(par);
    for (let mx = x0 + 0.3; mx < x1 - 0.2; mx += 0.8) {
      // stepped merlons: a block and a smaller one on top
      this.merlons.push([_m.compose(_p.set(mx, top + 0.6, BACK + 0.1), _q.identity(), _s.set(0.42, 0.3, 0.24)).clone(), m.earth.color]);
      this.merlons.push([_m.compose(_p.set(mx, top + 0.82, BACK + 0.1), _q.identity(), _s.set(0.22, 0.16, 0.22)).clone(), m.earth.color]);
    }
    // a frieze of diamonds in relief below the roof, a darker band under it
    _q.setFromEuler(_e.set(0, 0, Math.PI / 4));
    for (let dx = x0 + 0.9; dx < x1 - 0.7; dx += 0.42) this.studs.push(_m.compose(_p.set(dx, top - 0.55, front + 0.02), _q, _s.set(0.2, 0.2, 0.06)).clone());
    const band = new THREE.Mesh(boxWorldUV(len - 1.2, 0.12, 0.06, 1), m.earthDark);
    band.position.set(cx, top - 0.85, front + 0.02);
    scene.add(band);
    // slit windows, a few lit
    for (let y = top - 1.5; y > GROUND_Y + 1.2; y -= 1.4) {
      for (let x = x0 + 1.2 + rng() * 0.6; x < x1 - 1; x += 1.6 + rng() * 1.6) {
        _q.identity();
        (rng() < 0.4 ? this.windows.lit : this.windows.dark).push(_m.compose(_p.set(x, y, front + 0.012), _q, _s.set(0.2, 0.55, 1)).clone());
      }
    }
    world.fixtures.push({ x: cx, y: top - 1.2, z: front + 0.9, color: 0xffa860, intensity: 3, distance: 6 });
  },

  /** An arch over an alley, the walk across its top, a lantern hung in its crown. */
  arch(world, pl) {
    const { scene, rng } = world;
    const { x0, x1, top } = pl;
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const mat = rng() < 0.3 ? this.m.white : this.m.wash[Math.floor(rng() * this.m.wash.length)];
    const shape = new THREE.Shape();
    shape.moveTo(x0, GROUND_Y);
    shape.lineTo(x1, GROUND_Y);
    shape.lineTo(x1, top - 0.1);
    shape.lineTo(x0, top - 0.1);
    const w = Math.min(len - 1.4, 2.6);
    shape.holes.push(horseshoe(new THREE.Path(), cx, w, GROUND_Y, top - 0.7));
    const depth = 2.5;
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.5, uv.getY(i) * 0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = -depth / 2;
    mesh.receiveShadow = mesh.castShadow = true;
    scene.add(mesh);
    const roof = new THREE.Mesh(boxWorldUV(len + 0.04, 0.1, depth + 0.1, 2), this.m.roof);
    roof.position.set(cx, top - 0.05, 0);
    roof.receiveShadow = roof.castShadow = true;
    scene.add(roof);
    // a band of zellige round the arch
    const trim = new THREE.Shape();
    trim.moveTo(cx - w / 2 - 0.25, GROUND_Y);
    trim.lineTo(cx + w / 2 + 0.25, GROUND_Y);
    trim.lineTo(cx + w / 2 + 0.25, top - 0.45);
    trim.lineTo(cx - w / 2 - 0.25, top - 0.45);
    trim.holes.push(horseshoe(new THREE.Path(), cx, w, GROUND_Y, top - 0.7));
    const tgeo = new THREE.ShapeGeometry(trim);
    const tuv = tgeo.attributes.uv;
    for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) / 0.6, tuv.getY(i) / 0.6);
    const tm = new THREE.Mesh(tgeo, this.m.zellige);
    tm.position.z = depth / 2 + 0.01;
    scene.add(tm);
    const chain = new THREE.Mesh(this.geo.tube, this.m.iron);
    chain.scale.set(1, 0.4, 1);
    chain.position.set(cx, top - 0.7, 0.4);
    scene.add(chain);
    const lamp = new THREE.Mesh(this.geo.lantern, this.m.lantern);
    lamp.position.set(cx, top - 1.6, 0.4);
    scene.add(lamp);
    world.fixtures.push({ x: cx, y: top - 1.3, z: 1.4, color: 0xffb860, intensity: 6, distance: 7, flicker: true });
  },

  /**
   * The town falling away down the hill behind the walk: rows of flat roofs,
   * white domes, palms in the courtyards and lamps in the lanes, each row a
   * few draw calls.
   */
  buildTown(world) {
    const { scene, level, rng, tex } = world;
    const from = -80;
    const to = level.endX + 140;
    const mat = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, ...o });
    const lamps = [];
    const domes = [];
    const row = (zc, depth, wMin, wMax, eMin, eMax, dim, glow) => {
      const body = new Mesher();
      const fronts = new Mesher();
      const half = depth / 2;
      let x = from;
      while (x < to) {
        const w = wMin + rng() * (wMax - wMin);
        const eave = eMin + rng() * (eMax - eMin);
        const x0 = x;
        const x1 = x + w;
        const zf = zc + half + (rng() - 0.5) * 0.8;
        const white = rng() < 0.22;
        _c.setHex(white ? WHITE : WASH[Math.floor(rng() * WASH.length)]).multiplyScalar(dim * (0.75 + rng() * 0.3));
        body.box(x0, x1, eave - 14, eave, zc - half, zf, _c);
        // a parapet round the roof, a stair-head now and then
        const p = _c.clone().multiplyScalar(0.92);
        body.box(x0, x1, eave, eave + 0.3, zf - 0.2, zf, p);
        if (rng() < 0.35) {
          const sx = x0 + 0.4 + rng() * Math.max(0.1, w - 1.6);
          body.box(sx, sx + 1.1, eave, eave + 1.0, zc - 0.6, zc + 0.5, p);
        }
        if (rng() < 0.12) domes.push([x0 + w / 2, eave, zc, Math.min(w, depth) * 0.32, white ? 1 : 0.85, dim]);
        // the façade: a block of window cells from the atlas
        const rows = Math.max(1, Math.min(5, Math.round((eave - (eMin - 6)) / 1.1)));
        const cols = Math.max(1, Math.round((w - 0.4) / 1.1));
        const c0 = Math.floor(rng() * (ATLAS.cols - cols));
        const r0 = Math.floor(rng() * (ATLAS.rows - rows));
        const uv = [c0 / ATLAS.cols, r0 / ATLAS.rows, (c0 + cols) / ATLAS.cols, r0 / ATLAS.rows, (c0 + cols) / ATLAS.cols, (r0 + rows) / ATLAS.rows, c0 / ATLAS.cols, (r0 + rows) / ATLAS.rows];
        const yTop = eave - 0.35;
        const yb = yTop - rows * 1.1;
        fronts.quad([x0 + 0.2, yb, zf + 0.01], [x1 - 0.2, yb, zf + 0.01], [x1 - 0.2, yTop, zf + 0.01], [x0 + 0.2, yTop, zf + 0.01], _c, uv);
        if (rng() < 0.3) lamps.push([x0 + rng() * w, yb - 0.4, zf + 0.4]);
        // a palm in a courtyard between the houses
        if (rng() < 0.18) this.palm(x1 + 0.4, eave - 3.5, zc + (rng() - 0.5) * depth, 4 + rng() * 2.5, rng);
        x += w + (rng() < 0.25 ? 0.3 + rng() * 1.6 : 0);
      }
      scene.add(new THREE.Mesh(body.build(), mat()));
      scene.add(new THREE.Mesh(fronts.build(), mat({ map: tex.town.map, emissiveMap: tex.town.emissiveMap, emissive: 0xffffff, emissiveIntensity: glow })));
    };
    // (the camera looks over the parapets on a line dropping about 0.27u for each
    // 1u back, so each row stands a little above it)
    row(-6.4, 4.4, 2.6, 6, -1.2, 0.2, 0.9, 1.0);
    row(-11.8, 4.6, 3, 6.5, -2.3, -0.9, 0.78, 0.95);
    row(-17.8, 5, 3, 7, -3.9, -2.5, 0.66, 0.9);
    row(-24.8, 5, 3.5, 7.5, -5.7, -4.3, 0.56, 0.85);
    row(-32, 5, 3.5, 8, -7.6, -6.2, 0.48, 0.8);
    // white domes on some of the bigger houses
    const domeGeo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMesh = new THREE.InstancedMesh(domeGeo, new THREE.MeshStandardMaterial({ map: tex.limewash, roughness: 0.9 }), Math.max(1, domes.length));
    domes.forEach(([x, y, z, r, b, dim], i) => {
      domeMesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q.identity(), _s.set(r, r * 1.1, r)));
      domeMesh.setColorAt(i, _c.setRGB(b * dim, b * dim, b * dim * 1.05));
    });
    domeMesh.count = domes.length;
    scene.add(domeMesh);
    // lamps in the lanes, glittering down the hill
    const pos = new Float32Array(lamps.length * 3);
    lamps.forEach((l, i) => pos.set(l, i * 3));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.9, map: tex.glow, color: 0xffb860, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })));
  },

  /** A date palm: a leaning trunk, a crown of drooping fronds (gathered for instancing). */
  palm(x, y, z, h, rng) {
    const lean = (rng() - 0.5) * 0.25;
    _q.setFromEuler(_e.set(0, 0, lean));
    this.palms.trunks.push(_m.compose(_p.set(x - Math.sin(lean) * h * 0.5, y + h / 2, z), _q, _s.set(0.13, h, 0.13)).clone());
    const tx = x - Math.sin(lean) * h;
    const ty = y + h * Math.cos(lean);
    const n = 9 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
      const yaw = (i / n) * Math.PI * 2 + rng() * 0.4;
      _q.setFromEuler(_e.set(0, yaw, 0.25 + rng() * 0.35, 'YXZ'));
      const len = 1.4 + rng() * 0.6;
      this.palms.fronds.push(_m.compose(_p.set(tx, ty, z), _q, _s.set(len, len, len)).clone());
    }
  },

  /** Beyond the town: the palm grove, the dunes rolling away, a kasbah on a ridge and a caravan crossing. */
  buildDesert(world, S) {
    const { scene, level, rng, tex } = world;
    const from = -80;
    const to = level.endX + 140;
    for (let x = from; x < to; x += 2.6 + rng() * 3.4) this.palm(x, -12.5, -37 - rng() * 7, 4 + rng() * 3.5, rng);
    // dunes: curtains of sand with sharp, wind-cut crests, lighter on the faces towards the moon
    const dunes = [];
    const range = (z, base, amp, step, lit, dark, warp) => {
      const ph = rng() * 10;
      const ph2 = rng() * 10;
      const height = (x) => {
        const a = Math.abs(Math.sin(x * 0.035 * warp + ph));
        const b = Math.abs(Math.sin(x * 0.083 * warp + ph2));
        return base + amp * (0.6 * Math.pow(a, 0.7) + 0.4 * Math.pow(b, 0.8));
      };
      const pos = [];
      const cols = [];
      const idx = [];
      const hi = new THREE.Color(lit);
      const lo = new THREE.Color(dark);
      let i = 0;
      for (let x = from - 60; x <= to + 60; x += step) {
        const y = height(x);
        const slope = (height(x + 0.5) - height(x - 0.5)) / 1.0;
        // the moon is ahead and to the left: faces climbing to the right catch it
        const face = THREE.MathUtils.clamp(0.55 + slope * 1.6, 0.2, 1.2);
        _c.copy(hi).multiplyScalar(face);
        pos.push(x, y, z, x, y - amp * 2.2 - 6, z);
        cols.push(_c.r, _c.g, _c.b, lo.r, lo.g, lo.b);
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
      dunes.push({ z, height });
    };
    range(-88, -2.0, 5.0, 2, 0x4a4660, 0x0a0a12, 0.6);
    range(-74, -6.0, 5.2, 1.5, 0x5a5268, 0x0c0b12, 0.8);
    range(-58, -10.5, 4.6, 1.2, 0x5e5468, 0x0a090e, 1.0);
    range(-47, -13.0, 3.0, 1.0, 0x3e3846, 0x07060a, 1.3);
    // a kasbah on the ridge: earth walls and towers, a few lit windows
    const kx = Math.round(level.goalX * 0.42);
    const kz = -80;
    const ky = dunes[1].height(kx) - 1.5;
    const k = new Mesher();
    const earth = new THREE.Color(0x2c2228);
    const tall = new THREE.Color(0x35282c);
    k.box(kx - 14, kx + 14, ky - 4, ky + 4.2, kz - 4, kz + 2, earth);
    for (const [tx, th] of [
      [-14, 7.5],
      [-6, 9.5],
      [3, 8],
      [14, 7.5],
    ]) {
      k.box(kx + tx - 1.6, kx + tx + 1.6, ky - 4, ky + th, kz - 1, kz + 2.6, tall);
      for (let mx = -1.2; mx <= 1.2; mx += 0.8) k.box(kx + tx + mx - 0.2, kx + tx + mx + 0.2, ky + th, ky + th + 0.5, kz + 2.2, kz + 2.6, tall);
    }
    for (let mx = -12.5; mx <= 12.5; mx += 1) k.box(kx + mx - 0.25, kx + mx + 0.25, ky + 4.2, ky + 4.7, kz + 1.6, kz + 2, earth);
    scene.add(new THREE.Mesh(k.build(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false })));
    const kw = [];
    for (let i = 0; i < 18; i++) kw.push(kx + (rng() - 0.5) * 30, ky + 0.5 + rng() * 6, kz + 2.7);
    const kgeo = new THREE.BufferGeometry();
    kgeo.setAttribute('position', new THREE.Float32BufferAttribute(kw, 3));
    scene.add(new THREE.Points(kgeo, new THREE.PointsMaterial({ size: 1.6, map: tex.glow, color: 0xffa050, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    // the caravan: camels in a line along a crest, a lantern swinging at the head
    const parts = [];
    const piece = (geo, x, y, z, sx, sy, sz, rz = 0) => parts.push(geo.clone().scale(sx, sy, sz).rotateZ(rz).translate(x, y, z));
    const ball = new THREE.SphereGeometry(1, 8, 6);
    const pole = new THREE.CylinderGeometry(1, 1, 1, 5);
    piece(ball, 0, 1.55, 0, 0.75, 0.42, 0.34);
    piece(ball, -0.05, 1.95, 0, 0.36, 0.32, 0.28);
    piece(pole, 0.75, 1.95, 0, 0.12, 0.8, 0.12, -0.7);
    piece(ball, 1.08, 2.3, 0, 0.24, 0.12, 0.12);
    for (const [lx, lz] of [
      [0.45, 0.18],
      [0.45, -0.18],
      [-0.45, 0.18],
      [-0.45, -0.18],
    ])
      piece(pole, lx, 0.65, lz, 0.07, 1.3, 0.07);
    const merged = mergeGeometries(parts);
    const camelMat = new THREE.MeshBasicMaterial({ color: 0x06050a, fog: false });
    const crest = dunes[1];
    const camels = [];
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(merged, camelMat);
      c.scale.setScalar(0.85 + rng() * 0.2);
      scene.add(c);
      camels.push({ mesh: c, off: -i * 3.1 - rng() * 0.6, ph: rng() * 6.28 });
    }
    const light = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex.glow, color: 0xffb050, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    light.scale.set(2.2, 2.2, 1);
    scene.add(light);
    S.caravan = { camels, light, z: crest.z + 3, height: crest.height, x: -30 };
  },

  /** The moon turned to a thin crescent, the Milky Way, a fainter field of stars higher up, and shooting stars. */
  buildSkyExtras(world, S) {
    const { rng, tex } = world;
    const sky = world.sky;
    const moon = sky.children.find((o) => o.geometry?.type === 'CircleGeometry');
    if (moon) {
      moon.material.dispose();
      moon.material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          void main(){
            vec2 p = vUv * 2.0 - 1.0;
            float disc = 1.0 - smoothstep(0.96, 1.0, length(p));
            float shade = smoothstep(0.84, 0.92, length(p - vec2(-0.42, 0.16)));
            vec3 lit = vec3(0.93, 0.94, 1.0);
            vec3 earthshine = vec3(0.035, 0.045, 0.075);
            gl_FragColor = vec4(mix(earthshine, lit, shade), disc);
          }`,
      });
    }
    // across the strip of sky the camera sees over the dunes, high on the left, sinking to the right
    const milky = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 30),
      new THREE.MeshBasicMaterial({ map: tex.milky, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    );
    milky.position.set(4, 5.5, -92.5);
    milky.rotation.z = -0.13;
    sky.add(milky);
    const n = 600;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rng() - 0.5) * 380;
      pos[i * 3 + 1] = 20 + rng() * 80;
      pos[i * 3 + 2] = -93;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sky.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.45, color: 0xc0c8e0, transparent: true, opacity: 0.6, fog: false, depthWrite: false })));
    // shooting stars: a bright head and a tail fading out behind it
    const streak = new THREE.PlaneGeometry(1, 0.14).translate(-0.5, 0, 0);
    const cols = [];
    const p = streak.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const b = p.getX(i) > -0.5 ? 1 : 0;
      cols.push(b, b * 0.95, b * 0.85);
    }
    streak.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(streak, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      mesh.visible = false;
      sky.add(mesh);
      S.meteors.push({ mesh, t: 0, dur: 1, x: 0, y: 0, vx: 0, vy: 0, len: 8, active: false });
    }
  },

  /** Send a shooting star across the visible sky (in the sky group's frame). */
  launchMeteor(S, rng, bright = 1) {
    const m = S.meteors.find((mm) => !mm.active);
    if (!m) return;
    const dir = rng() < 0.7 ? 1 : -1;
    const ang = 0.35 + rng() * 0.4;
    const speed = 30 + rng() * 25;
    m.active = true;
    m.t = 0;
    m.dur = 0.5 + rng() * 0.5;
    m.x = (rng() - 0.5) * 90;
    m.y = 6 + rng() * 10;
    m.vx = Math.cos(ang) * speed * dir;
    m.vy = -Math.sin(ang) * speed;
    m.len = 6 + rng() * 8;
    m.bright = bright;
    m.mesh.visible = true;
    m.mesh.rotation.z = Math.atan2(m.vy, m.vx);
    m.mesh.position.set(m.x, m.y, -91.5);
  },

  /** The town's cats: on the roofs, on a rug, peeking from a jar, on a tower watching the desert, and at home a family. */
  buildCats(world, S) {
    const { scene, level } = world;
    const m = this.m;
    const pls = level.platforms.filter((pl) => !pl.brittle && !pl.bouncy);
    const cats = (S.cats = new SceneryCats(scene, world.rng, { watch: Math.PI / 2 }));
    const add = (coat, pose, x, y, z, yaw, opts) => {
      cats.add(coat, pose, x, y, z, yaw, opts);
      this.taken.push(x);
    };
    const free = (x) => !level.hangers.some((h) => Math.abs(h.x - x) < 1.6) && !level.checkpoints.some((cp) => Math.abs(cp.x - x) < 1.3);
    const roofs = pls.filter((pl) => pl.top < 1.8 && pl.x1 - pl.x0 > 10);
    // a ginger cat on the first roof, watching the desert
    add('ginger', 'sit', 7.2, 0, -1.1, Math.PI / 2 - 0.4);
    // a white cat asleep on a rug laid out on a roof
    const rugRoof = roofs.find((pl) => pl.x0 > level.goalX * 0.08 && free(pl.x0 + 3));
    if (rugRoof) {
      const rx = rugRoof.x0 + 3;
      const rug = new THREE.Mesh(rugUV(new THREE.PlaneGeometry(1.0, 0.7).rotateX(-Math.PI / 2), 1), m.rug);
      rug.position.set(rx, rugRoof.top + 0.012, -0.95);
      rug.receiveShadow = true;
      scene.add(rug);
      add('white', 'loaf', rx, rugRoof.top + 0.02, -0.98, 0.3);
    }
    // a cream cat peeking out of a big jar
    const jarRoof = roofs.find((pl) => pl.x0 > level.goalX * 0.25 && free(pl.x0 + 2.6));
    if (jarRoof) {
      const jx = jarRoof.x0 + 2.6;
      const jar = new THREE.Mesh(this.geo.jar, m.jar);
      jar.scale.setScalar(1.25);
      jar.position.set(jx, jarRoof.top, -1.1);
      jar.castShadow = jar.receiveShadow = true;
      scene.add(jar);
      add('cream', 'peek', jx, jarRoof.top + 1.06, -1.1, -0.5, { scale: 0.9 });
    }
    // a tuxedo kitten batting at a tassel
    const kit = roofs.find((pl) => pl.x0 > level.goalX * 0.4 && free(pl.x0 + 3.4));
    if (kit) {
      add('tuxedo', 'sit', kit.x0 + 3.4, kit.top, -1.12, -0.8, { scale: 0.55, paw: true });
      this.kittenMoth = { x: kit.x0 + 3.52, y: kit.top + 0.55, z: -1.0 };
    }
    // a grey cat up on a tower's battlements, looking out over the dunes
    const tower = pls.find((pl) => pl.top >= 1.8 && pl.x0 > level.goalX * 0.3);
    if (tower) add('grey', 'sit', tower.x0 + 1.9, tower.top + 0.98, BACK + 0.1, Math.PI / 2 + 0.2, { scale: 0.85 });
    // a tabby on a roof late on
    const late = roofs.filter((pl) => pl.x0 > level.goalX * 0.65 && free(pl.x0 + 2.2));
    if (late[0]) add('tabby', 'sit', late[0].x0 + 2.2, late[0].top, -1.15, Math.PI / 2 - 0.2);
    // home: a friend and two kittens on a rug by a dish of sardines
    if (this.home) {
      const { x, top } = this.home;
      const rug = new THREE.Mesh(rugUV(new THREE.PlaneGeometry(2.2, 1.3).rotateX(-Math.PI / 2), 0), m.rug);
      rug.position.set(x + 10.6, top + 0.012, -0.85);
      rug.receiveShadow = true;
      scene.add(rug);
      add('white', 'sit', x + 10.1, top, -0.6, Math.PI, {
        patches: [
          ['body', 0x8a6a4c, 0.13, 0.1, 0.12, -0.08, 0.24, 0.06],
          ['head', 0x8a6a4c, 0.07, 0.05, 0.08, -0.02, 0.06, 0.05],
        ],
      });
      add('grey', 'sit', x + 10.9, top, -0.95, Math.PI - 0.3, { scale: 0.48 });
      add('ginger', 'sit', x + 11.25, top, -1.1, Math.PI + 0.4, { scale: 0.45, paw: true });
      const dish = new THREE.Mesh(this.geo.bowl, m.dish);
      dish.scale.set(0.8, 0.5, 0.8);
      dish.position.set(x + 9.4, top, -0.85);
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

  /** Brass lanterns on posts along the backs of the roofs, and moths about them. */
  buildLamps(world, S) {
    const { scene, level, rng, tex } = world;
    const m = this.m;
    const glowMat = new THREE.SpriteMaterial({ map: tex.glow, color: 0xffb860, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
    const busy = (x) =>
      level.hangers.some((h) => Math.abs(h.x - x) < 1.6) ||
      level.checkpoints.some((cp) => Math.abs(cp.x - x) < 1.3) ||
      this.taken.some((t) => Math.abs(t - x) < 1.2) ||
      x > level.goalX - 2.5;
    for (const pl of level.platforms) {
      if (pl.brittle || pl.bouncy || pl.top >= 1.8 || pl.x1 - pl.x0 < 10) continue;
      for (let x = pl.x0 + 2 + rng() * 3; x < pl.x1 - 1.5; x += 10 + rng() * 4) {
        if (busy(x)) continue;
        const g = new THREE.Group();
        g.position.set(x, pl.top, -1.15);
        const post = new THREE.Mesh(this.geo.pole, m.iron);
        post.scale.set(0.04, 1.9, 0.04);
        post.position.y = 0.95;
        post.castShadow = true;
        g.add(post);
        const armM = new THREE.Mesh(this.geo.unitBox, m.iron);
        armM.scale.set(0.03, 0.03, 0.3);
        armM.position.set(0, 1.88, 0.14);
        g.add(armM);
        const lamp = new THREE.Mesh(this.geo.lantern, m.lantern);
        lamp.scale.setScalar(0.9);
        lamp.position.set(0, 1.4, 0.28);
        g.add(lamp);
        const glow = new THREE.Sprite(glowMat.clone());
        glow.position.set(0, 1.6, 0.28);
        glow.scale.set(2.0, 2.0, 1);
        g.add(glow);
        scene.add(g);
        world.fixtures.push({ x, y: pl.top + 1.6, z: -0.6, color: 0xffb860, intensity: 9, distance: 9, flicker: true });
        S.lamps.push({ x, y: pl.top + 1.6, z: -0.87, glow });
      }
    }
  },

  /** Doves asleep on the parapets; they take off when the cat comes by. */
  buildDoves(world, S) {
    const { scene, level, rng } = world;
    const m = this.m;
    let last = -Infinity;
    for (const pl of level.platforms) {
      if (pl.brittle || pl.bouncy || pl.top >= 1.8 || pl.x1 - pl.x0 < 8) continue;
      for (let x = pl.x0 + 3 + rng() * 4; x < pl.x1 - 2; x += 6 + rng() * 6) {
        if (x - last < 14 || this.taken.some((t) => Math.abs(t - x) < 1.5) || x > level.goalX - 4) continue;
        last = x;
        const flock = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < flock; i++) {
          const g = new THREE.Group();
          const body = new THREE.Mesh(this.geo.ball, m.dove);
          body.scale.set(0.1, 0.07, 0.07);
          g.add(body);
          const head = new THREE.Mesh(this.geo.ball, m.dove);
          head.scale.setScalar(0.045);
          head.position.set(0.08, 0.05, 0);
          g.add(head);
          const tail = new THREE.Mesh(this.geo.ball, m.dove);
          tail.scale.set(0.08, 0.02, 0.04);
          tail.position.set(-0.11, 0.0, 0);
          tail.rotation.z = 0.3;
          g.add(tail);
          const wings = [];
          for (const s of [-1, 1]) {
            const w = new THREE.Mesh(this.geo.wing, m.wing);
            w.position.set(-0.01, 0.03, s * 0.05);
            w.rotation.x = Math.PI / 2;
            w.visible = false;
            g.add(w);
            wings.push(w);
          }
          const dx = x + i * 0.32;
          // perched on the parapet behind the walk
          const y = pl.top + 0.66;
          g.position.set(dx, y, BACK + 0.08);
          g.rotation.y = (rng() - 0.5) * 2;
          scene.add(g);
          S.doves.push({ g, wings, x: dx, y, z: BACK + 0.08, state: 'sit', t: 0, ph: rng() * 6.28, vx: 0.6 + rng() * 1.5, vz: -1.5 - rng() * 2, delay: i * 0.08 });
        }
      }
    }
  },

  /** A few moths about each lamp near the camera, and one for the kitten to bat at. */
  buildMoths(world, S) {
    const n = 28;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, color: 0xf4ecdc, transparent: true, opacity: 0.9, depthWrite: false }));
    pts.frustumCulled = false;
    world.scene.add(pts);
    S.moths = { pts, n };
  },

  /** Fine sand drifting on the warm wind, catching the lamplight. */
  buildMotes(world, S, n) {
    const { scene, rng, tex } = world;
    const items = [];
    for (let i = 0; i < n; i++) items.push({ x: (rng() - 0.5) * 50, y: GROUND_Y + rng() * 7, z: -5 + rng() * 9, v: 0.6 + rng() * 1.2, ph: rng() * 6.28 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.07, map: tex.glow, color: 0xffd8a0, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    pts.frustumCulled = false;
    scene.add(pts);
    S.motes = { pts, items, n };
  },

  /**
   * Draws a list of matrices, or of [matrix, colour] pairs (a hex or a Color), as
   * instanced meshes: one for each 40u stretch of the town, so the stretches off
   * screen are culled. Returns the meshes.
   */
  batch(world, geo, mat, list, shadow = false) {
    const runs = new Map();
    for (const item of list) {
      const k = Math.floor((Array.isArray(item) ? item[0] : item).elements[12] / 40);
      if (!runs.has(k)) runs.set(k, []);
      runs.get(k).push(item);
    }
    return [...runs.values()].map((run) => {
      const mesh = new THREE.InstancedMesh(geo, mat, run.length);
      run.forEach((item, i) => {
        if (Array.isArray(item)) {
          mesh.setMatrixAt(i, item[0]);
          mesh.setColorAt(i, _c.set(item[1]));
        } else mesh.setMatrixAt(i, item);
      });
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      world.scene.add(mesh);
      return mesh;
    });
  },

  /** Everything gathered while the level was built: windows, shutters, doors, battlements, pots, palms and market goods. */
  buildInstanced(world) {
    const m = this.m;
    const plane = new THREE.PlaneGeometry(1, 1);
    this.batch(world, plane, m.winLit, this.windows.lit);
    this.batch(world, plane, m.winDark, this.windows.dark);
    this.batch(world, this.geo.unitBox, m.paint, this.shutters);
    this.batch(world, plane, m.door, this.doors);
    this.batch(world, this.geo.unitBox, m.paint, this.merlons, true);
    this.batch(world, this.geo.unitBox, m.earthDark, this.studs);
    this.batch(world, this.geo.pot, m.paint, this.pots, true);
    this.batch(world, this.geo.clump, m.bloom, this.blooms);
    this.batch(world, new THREE.CylinderGeometry(0.6, 1, 1, 7), m.palm, this.palms.trunks);
    this.batch(world, this.geo.frond, m.frond, this.palms.fronds);
    const kinds = { cone: this.geo.cone, cyl: this.geo.pole, ball: this.geo.ball };
    for (const [kind, geo] of Object.entries(kinds)) {
      const list = this.goods.filter((gd) => gd[2] === kind).map(([mat4, col]) => [mat4, col]);
      if (list.length) this.batch(world, geo, m.goods, list);
    }
    if (this.rugs.pos.length) {
      const mesh = new THREE.Mesh(this.rugs.build(), m.rugVc);
      mesh.receiveShadow = true;
      world.scene.add(mesh);
    }
  },

  /** Hanging things swing when the cat goes by; the brass lanterns clink. */
  onPass(o, sfx) {
    const s = this.swings.find((sw) => Math.abs(sw.x - o.x) < 0.01);
    if (!s) return;
    s.kick = 1;
    s.age = 0;
    if (s.kind === 'fanous') sfx.clink();
  },

  /** An awning takes the cat's weight and throws it: the canvas sags and springs back. */
  onBounce(pl, x) {
    const a = pl.part;
    if (!a) return;
    a.kick = 1;
    a.age = 0;
    a.at = x;
  },

  update(world, dt, t, catX, camX) {
    const S = world.themeState;
    const rng = world.rng;

    for (const s of this.swings) {
      s.age += dt;
      s.kick *= Math.exp(-dt * (s.kind === 'fanous' ? 1.0 : 1.4));
      const amp = s.kind === 'fanous' ? 0.4 : 0.3;
      s.g.rotation.x = 0.04 * Math.sin(t * 1.1 + s.ph) + s.kick * amp * Math.sin(s.age * 6.5);
      s.g.rotation.z = s.kind === 'carpet' ? 0 : 0.03 * Math.sin(t * 0.8 + s.ph) + s.kick * 0.15 * Math.sin(s.age * 5.1);
    }
    for (const a of this.awnings) {
      if (Math.abs(a.x0 - camX) > 40) continue;
      a.age += dt;
      a.kick *= Math.exp(-dt * 4.5);
      // the canvas is pushed down and springs back; the valances flap
      a.skin.scale.y = 1 + 4.5 * a.kick * Math.cos(a.age * 17);
      for (const [i, f] of a.flaps.entries()) f.rotation.x = (i ? -1 : 1) * (0.05 * Math.sin(t * 1.3 + a.ph + i) + 0.5 * a.kick * Math.sin(a.age * 11));
    }
    this.m.coals.emissiveIntensity = 2.2 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 2.9);
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

    // sand on the wind, kept round the camera
    const M = S.motes;
    const mo = M.pts.geometry.attributes.position.array;
    for (let i = 0; i < M.n; i++) {
      const p = M.items[i];
      p.x += p.v * dt;
      p.y += 0.15 * Math.sin(t * 0.9 + p.ph) * dt;
      if (Math.abs(p.x - camX) > 25) p.x = camX + (p.x < camX ? 24 : -24) - rng() * 2 * Math.sign(p.x - camX);
      mo[i * 3] = p.x;
      mo[i * 3 + 1] = p.y + 0.2 * Math.sin(t * 1.7 + p.ph);
      mo[i * 3 + 2] = p.z;
    }
    M.pts.geometry.attributes.position.needsUpdate = true;

    // doves: doze, take off when the cat comes close, wheel away; back on the parapet when it has gone
    for (const d of S.doves) {
      if (Math.abs(d.x - camX) > 40) continue;
      if (d.state === 'sit') {
        d.g.scale.y = 1 + 0.05 * Math.sin(t * 2 + d.ph);
        if (Math.abs(catX - d.x) < 2.2) {
          d.state = 'fly';
          d.t = -d.delay;
          if (!d.delay) world.sfx?.flutter();
          for (const w of d.wings) w.visible = true;
          d.g.rotation.y = Math.atan2(-d.vz, d.vx);
        }
      } else if (d.state === 'fly') {
        d.t += dt;
        if (d.t < 0) continue;
        const u = d.t;
        d.g.position.set(d.x + d.vx * u, d.y + 2.2 * u + 0.6 * u * u, d.z + d.vz * u);
        const flap = Math.sin(t * 32 + d.ph);
        d.wings[0].rotation.x = Math.PI / 2 + flap;
        d.wings[1].rotation.x = Math.PI / 2 - flap;
        if (u > 3) {
          d.state = 'gone';
          d.g.visible = false;
        }
      } else if (catX < d.x - 8 || Math.abs(catX - d.x) > 30) {
        d.state = 'sit';
        d.g.visible = true;
        for (const w of d.wings) w.visible = false;
        d.g.position.set(d.x, d.y, d.z);
      }
    }

    // the caravan plods along its crest, kept in view ahead of the camera
    const C = S.caravan;
    C.x += dt * 0.7;
    if (C.x < camX - 70) C.x = camX + 30;
    if (C.x > camX + 75) C.x = camX - 60;
    for (const c of C.camels) {
      const x = C.x + c.off;
      const y = C.height(x) - 0.4;
      c.mesh.position.set(x, y + 0.05 * Math.sin(t * 2.4 + c.ph), C.z);
      c.mesh.rotation.z = Math.atan2(C.height(x + 1) - C.height(x - 1), 2) * 0.6;
    }
    const lead = C.camels[0].mesh.position;
    C.light.position.set(lead.x + 1.3, lead.y + 1.8 + 0.06 * Math.sin(t * 2.4), C.z + 0.3);

    // shooting stars
    S.meteorT -= dt;
    if (S.meteorT <= 0) {
      S.meteorT = 3 + rng() * 6;
      this.launchMeteor(S, rng);
    }
    if (S.finale && S.finaleT > 0) {
      S.finaleT -= dt;
      if (rng() < dt * 6) {
        this.launchMeteor(S, rng, 1.3);
        if (rng() < 0.4) world.sfx?.meteor(0.8);
      }
    }
    for (const m of S.meteors) {
      if (!m.active) continue;
      m.t += dt;
      const u = m.t / m.dur;
      if (u >= 1) {
        m.active = false;
        m.mesh.visible = false;
        continue;
      }
      m.mesh.position.set(m.x + m.vx * m.t, m.y + m.vy * m.t, -91.5);
      m.mesh.scale.set(m.len * Math.min(1, u * 3), 1, 1);
      m.mesh.material.opacity = (m.bright || 1) * Math.sin(Math.PI * u);
    }

    S.cats.update(dt, t, catX, camX);

    // home: a shower of shooting stars, and the oud plays
    const goal = world.level.goalX;
    if (!S.finale && catX >= goal) {
      S.finale = true;
      S.finaleT = 4.5;
      world.sfx?.oud(1.6);
    } else if (S.finale && catX < goal - 2) S.finale = false;
  },

  dispose() {},
};
