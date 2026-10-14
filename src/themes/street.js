// Stage I dressing: a rain-slicked night street — brick walls, street lamps,
// paper lanterns, lit windows, drizzle.
import * as THREE from 'three';
import { WALK_DEPTH } from '../level.js';
import { brickTexture, stoneTexture, asphaltMaps, woodTexture, windowTexture, boxWorldUV } from '../textures.js';

const STREET_Y = -3.2;

// Fake volumetric light cone under each lamp head.
function makeConeMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: 0.2 } },
    vertexShader: /* glsl */ `
      varying float vV; varying float vFacing;
      void main() {
        vV = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float strength;
      varying float vV; varying float vFacing;
      void main() {
        float a = pow(vV, 1.7) * pow(vFacing, 1.4) * strength;
        gl_FragColor = vec4(color, a);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export const streetTheme = {
  key: 'street',
  floorY: STREET_Y,
  ambience: 'rain',
  hanging: new Set(['laundry', 'hangsign']),
  colors: {
    bg: 0x06070f,
    fog: 0x080a16,
    fogNear: 14,
    fogFar: 52,
    hemiSky: 0x2b3a6a,
    hemiGround: 0x160e0a,
    hemiInt: 1.5,
    moon: 0x7c8fd0,
    moonInt: 3.6,
    moonPos: [28, 42, -92],
    moonSize: 3.6,
    moonHalo: 0x9fb0ff,
    skyTop: [0.012, 0.014, 0.045],
    skyMid: [0.05, 0.045, 0.12],
    skyHor: [0.16, 0.09, 0.13],
    starCount: 420,
    fill: 0x8fb0ff,
    puff: 0x8a8fa8,
    spark: 0x9fd0ff,
    cp: 0xbfe8ff,
  },

  makeTextures(rng) {
    return {
      brick: brickTexture(rng),
      stone: stoneTexture(rng),
      asphalt: asphaltMaps(rng),
      wood: woodTexture(rng),
    };
  },

  init(tex, rng) {
    this.tex = tex;
    this.m = {
      wall: new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 0.82 }),
      coping: new THREE.MeshStandardMaterial({ map: tex.stone, roughness: 0.42 }),
      crate: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.8 }),
      bin: new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.45, metalness: 0.65 }),
      terracotta: new THREE.MeshStandardMaterial({ color: 0x6a3c2b, roughness: 0.85 }),
      bush: new THREE.MeshStandardMaterial({ color: 0x1b3524, roughness: 0.9 }),
      darkWood: new THREE.MeshStandardMaterial({ color: 0x2a1e16, roughness: 0.75 }),
      chalk: new THREE.MeshStandardMaterial({ color: 0x3b3a36, roughness: 0.9 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x1a1b22, roughness: 0.55, metalness: 0.5 }),
      rope: new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.9 }),
      cloth: [0xc9d8ec, 0xe8c9b8, 0xf0ebdd, 0xc8dcc0, 0xe6c4d0].map(
        (c) =>
          new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.95,
            side: THREE.DoubleSide,
            emissive: c,
            emissiveIntensity: 0.12, // keeps the washing readable against the dark street
          })
      ),
      signFace: new THREE.MeshStandardMaterial({
        color: 0x2a1c10,
        emissive: 0xffb070,
        emissiveIntensity: 0.35,
        roughness: 0.8,
      }),
    };
  },

  buildPlatform(group, x0, x1, top) {
    const len = x1 - x0;
    const h = top - STREET_Y;
    const wall = new THREE.Mesh(boxWorldUV(len, h, WALK_DEPTH, 2), this.m.wall);
    wall.position.set((x0 + x1) / 2, STREET_Y + h / 2, 0);
    wall.receiveShadow = wall.castShadow = true;
    group.add(wall);
    const cop = new THREE.Mesh(boxWorldUV(len + 0.12, 0.14, WALK_DEPTH + 0.24, 1), this.m.coping);
    cop.position.set((x0 + x1) / 2, top - 0.07, 0);
    cop.receiveShadow = cop.castShadow = true;
    group.add(cop);
  },

  buildObstacle(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    let size;
    if (kind === 'crate') {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), m.crate);
      c.position.y = 0.4;
      c.rotation.y = (rng() - 0.5) * 0.4;
      c.castShadow = c.receiveShadow = true;
      g.add(c);
      size = { w: 0.8, h: 0.8 };
    } else if (kind === 'bin') {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.86, 14), m.bin);
      b.position.y = 0.43;
      b.castShadow = b.receiveShadow = true;
      g.add(b);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 14), m.bin);
      lid.position.y = 0.9;
      lid.castShadow = true;
      g.add(lid);
      size = { w: 0.7, h: 0.95 };
    } else if (kind === 'planter') {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.46, 0.6), m.terracotta);
      p.position.y = 0.23;
      p.castShadow = p.receiveShadow = true;
      g.add(p);
      for (let b = 0; b < 3; b++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(0.22 + rng() * 0.08, 10, 8), m.bush);
        s.position.set(-0.3 + b * 0.3, 0.58 + rng() * 0.08, (rng() - 0.5) * 0.2);
        s.castShadow = true;
        g.add(s);
      }
      size = { w: 1.0, h: 0.86 };
    } else {
      // sign: a chalkboard on an a-frame
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.08), m.chalk);
      board.position.y = 0.72;
      board.castShadow = true;
      g.add(board);
      for (const s of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), m.darkWood);
        leg.position.set(s * 0.18, 0.2, 0.08 * s);
        leg.rotation.x = s * 0.25;
        g.add(leg);
      }
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.06), m.darkWood);
      frame.position.set(0, 0.72, -0.02);
      g.add(frame);
      size = { w: 0.5, h: 1.08 };
    }
    group.add(g);
    return size;
  },

  buildHanging(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    if (kind === 'laundry') {
      // two poles at the back edge, a line between them, washing hanging across the walk
      // kept narrow (three pieces) so a held jump clears it with a comfortable window
      const half = 0.8;
      for (const s of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.6, 8), m.iron);
        pole.position.set(s * half, 0.8, -0.9);
        pole.castShadow = true;
        g.add(pole);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), m.iron);
        arm.rotation.x = Math.PI / 2;
        arm.position.set(s * half, 1.55, -0.6);
        g.add(arm);
      }
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        pts.push(new THREE.Vector3(-half + u * half * 2, 1.5 - 0.07 * Math.sin(u * Math.PI), -0.3));
      }
      g.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: 0x6a665e, transparent: true, opacity: 0.9 })
        )
      );
      // every piece hangs down to the same height, just above a sliding cat
      for (let i = 0; i < 3; i++) {
        const w = 0.34 + rng() * 0.1;
        const cx = -0.5 + i * 0.5;
        const lineY = 1.5 - 0.07 * Math.sin(((cx + half) / (half * 2)) * Math.PI);
        const h = lineY - 0.44;
        const cloth = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m.cloth[Math.floor(rng() * m.cloth.length)]);
        cloth.position.set(cx, lineY - h / 2, -0.3);
        cloth.rotation.y = (rng() - 0.5) * 0.25;
        cloth.castShadow = true;
        g.add(cloth);
      }
      group.add(g);
      // collision stops well below the line: brushing the hems at the top of a jump is fine
      return { w: 1.3, clearance: 0.42, height: 1.0 };
    }
    // hangsign: a bracket from a pole holding a lit sign over the walk
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.0, 8), m.iron);
    pole.position.set(0, 1.0, -0.9);
    pole.castShadow = true;
    g.add(pole);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6), m.iron);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(0, 1.92, -0.55);
    g.add(arm);
    for (const s of [-1, 1]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 4), m.iron);
      chain.position.set(s * 0.34, 1.45, -0.3);
      g.add(chain);
    }
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.52, 0.05), m.signFace);
    board.position.set(0, 0.72, -0.3);
    board.castShadow = true;
    g.add(board);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.58, 0.04), m.darkWood);
    frame.position.set(0, 0.72, -0.31);
    g.add(frame);
    group.add(g);
    return { w: 0.9, clearance: 0.44, height: 1.02 };
  },

  buildGoal(level) {
    const g = new THREE.Group();
    const gx = level.goalX;
    g.position.set(gx, 0, 0);
    const wood = this.m.darkWood;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.0, 10), wood);
      post.position.set(0, 1.5, s * 1.0);
      post.castShadow = true;
      g.add(post);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 2.6), wood);
    lintel.position.set(0, 3.0, 0);
    lintel.castShadow = true;
    g.add(lintel);
    const lintel2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 2.3), wood);
    lintel2.position.set(0, 2.72, 0);
    g.add(lintel2);

    // the cat's home: a small lit window in a wall just behind the walk
    const home = new THREE.Mesh(boxWorldUV(7, 4.2, 1.2, 2), this.m.wall);
    home.position.set(5.5, 2.1, -1.9);
    home.receiveShadow = true;
    g.add(home);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.2, 1.8), wood);
    roof.position.set(5.5, 4.3, -1.9);
    g.add(roof);
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x331a08, emissive: 0xffc27a, emissiveIntensity: 0.85, roughness: 1 })
    );
    win.position.set(4.3, 1.75, -1.29);
    g.add(win);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.3), wood);
    sill.position.set(4.3, 1.02, -1.2);
    g.add(sill);
    const frameV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.04), wood);
    frameV.position.set(4.3, 1.75, -1.28);
    g.add(frameV);
    const frameH = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.04), wood);
    frameH.position.set(4.3, 1.75, -1.28);
    g.add(frameH);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.18, 10), this.m.terracotta);
    pot.position.set(4.0, 1.15, -1.15);
    g.add(pot);
    level.group.add(g);
    level.fixtures.push({ x: gx + 4.3, y: 1.75, z: -1.1, color: 0xffc27a, intensity: 9, distance: 11 });
    level.lanternStrings = [{ x0: gx - 1.2, y: 2.75, n: 3, z: 0.0, goal: true }];
  },

  // --- dressing ----------------------------------------------------------------
  dress(world) {
    const { scene, level, rng, tex, quality } = world;
    const S = (world.themeState = { lamps: [], strings: [], rain: null, rainVel: null, cones: [] });

    // street + kerb
    const { map, roughnessMap } = tex.asphalt;
    map.repeat.set(140, 10);
    roughnessMap.repeat.set(140, 10);
    const len = level.endX + 160;
    const street = new THREE.Mesh(
      new THREE.PlaneGeometry(len, 36),
      new THREE.MeshStandardMaterial({ map, roughnessMap, roughness: 1, metalness: 0.05, color: 0x9a9aa6 })
    );
    street.rotation.x = -Math.PI / 2;
    street.position.set(len / 2 - 60, STREET_Y, -6);
    street.receiveShadow = true;
    scene.add(street);
    const kerb = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7 })
    );
    kerb.position.set(len / 2 - 60, STREET_Y + 0.09, 1.6);
    kerb.receiveShadow = true;
    scene.add(kerb);

    this.buildBuildings(world);
    this.buildLamps(world, S);
    this.buildLanterns(world, S);
    this.buildRain(world, S, Math.round(650 * quality.particles));
  },

  buildBuildings(world) {
    const { scene, level, rng } = world;
    const group = new THREE.Group();
    const from = -50;
    const to = level.endX + 90;
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 0.9 });
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x1c1c24, roughness: 0.8 });
    const row = (z, depth, wMin, wMax, hMin, hMax, litProb, dim, wallL) => {
      let x = from;
      while (x < to) {
        const w = wMin + rng() * (wMax - wMin);
        const h = hMin + rng() * (hMax - hMin);
        const cols = Math.max(3, Math.floor(w / 1.05));
        const rows = Math.max(3, Math.floor(h / 1.0));
        const hue = 215 + rng() * 40;
        const wall = `hsl(${hue}, ${8 + rng() * 10}%, ${wallL + rng() * 3}%)`;
        const wtex = windowTexture(rng, cols, rows, { litProb, wall, dim });
        const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(wall).multiplyScalar(0.8), roughness: 0.95 });
        const front = new THREE.MeshStandardMaterial({
          map: wtex,
          emissiveMap: wtex,
          emissive: 0xffffff,
          emissiveIntensity: 0.75,
          roughness: 0.9,
        });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, depth), [side, side, roofMat, side, front, side]);
        mesh.position.set(x + w / 2, STREET_Y + h / 2, z);
        mesh.receiveShadow = true;
        group.add(mesh);
        if (rng() < 0.5) {
          const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.1, 10), detailMat);
          tank.position.set(x + w * (0.2 + rng() * 0.6), STREET_Y + h + 0.55, z);
          group.add(tank);
        }
        if (rng() < 0.6) {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6 + rng() * 1.5, 5), detailMat);
          ant.position.set(x + w * rng(), STREET_Y + h + 0.8, z);
          group.add(ant);
        }
        if (rng() < 0.4) {
          const chim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), detailMat);
          chim.position.set(x + w * rng(), STREET_Y + h + 0.45, z + depth * 0.3);
          group.add(chim);
        }
        x += w + 0.25 + rng() * 1.6;
      }
    };
    row(-9.5, 6, 6, 12, 5.5, 11, 0.34, 1.0, 12);
    row(-19, 8, 8, 16, 10, 22, 0.26, 0.6, 9);
    row(-34, 10, 10, 22, 14, 32, 0.16, 0.35, 7);
    scene.add(group);
  },

  buildLamps(world, S) {
    const { scene, level, rng, tex } = world;
    const postMat = this.m.iron;
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x120800,
      emissive: 0xffc27a,
      emissiveIntensity: 5.0,
      roughness: 0.3,
    });
    const postGeo = new THREE.CylinderGeometry(0.055, 0.08, 5.6, 10);
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8);
    const capGeo = new THREE.ConeGeometry(0.26, 0.2, 6);
    const glassGeo = new THREE.BoxGeometry(0.24, 0.3, 0.24);
    const frameGeo = new THREE.BoxGeometry(0.3, 0.05, 0.3);
    const coneGeo = new THREE.ConeGeometry(1.7, 3.6, 24, 1, true);
    const coneMat = makeConeMaterial(0xffb060);
    const glowMat = new THREE.SpriteMaterial({
      map: tex.glow,
      color: 0xffb060,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // lamps spaced along the street
    const xs = [];
    let lx = 6;
    while (lx < level.goalX - 6) {
      xs.push(lx);
      lx += 11 + rng() * 3;
    }
    xs.push(level.goalX - 2.8, level.goalX + 4.5);

    for (const x of xs) {
      const g = new THREE.Group();
      const z = -1.9;
      g.position.set(x, STREET_Y, z);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 2.8;
      post.castShadow = true;
      g.add(post);
      const arm = new THREE.Mesh(armGeo, postMat);
      arm.rotation.x = Math.PI / 2;
      arm.position.set(0, 5.55, 0.5);
      g.add(arm);
      const headY = 5.2;
      const headZ = 1.0;
      const frame = new THREE.Mesh(frameGeo, postMat);
      frame.position.set(0, headY + 0.18, headZ);
      g.add(frame);
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(0, headY, headZ);
      g.add(glass);
      const cap = new THREE.Mesh(capGeo, postMat);
      cap.position.set(0, headY + 0.28, headZ);
      g.add(cap);
      const bottom = new THREE.Mesh(frameGeo, postMat);
      bottom.position.set(0, headY - 0.17, headZ);
      g.add(bottom);
      const glow = new THREE.Sprite(glowMat.clone());
      glow.position.set(0, headY, headZ);
      glow.scale.set(2.6, 2.6, 1);
      g.add(glow);
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(0, headY - 1.95, headZ);
      g.add(cone);
      scene.add(g);
      const fixture = { x, y: STREET_Y + headY, z: z + headZ, color: 0xffb978, intensity: 42, distance: 17, flicker: true };
      world.fixtures.push(fixture);
      S.lamps.push({ x, glow, fixture });
    }
  },

  buildLanterns(world, S) {
    const { scene, level, rng } = world;
    const colors = [0xff5a3a, 0xff8a3a, 0xff4a5a, 0xffb05a];
    const geo = new THREE.SphereGeometry(0.17, 14, 12);
    const capGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.8 });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0c0c10, transparent: true, opacity: 0.6 });
    const strings = [];
    level.platforms.forEach((p, i) => {
      if (i % 4 === 2 && p.x1 - p.x0 >= 8) {
        const n = Math.min(6, Math.floor((p.x1 - p.x0 - 2) / 1.15));
        strings.push({ x0: p.x0 + 1.2, y: p.top + 3.0, n, z: -1.5 });
      }
    });
    const last = level.platforms[level.platforms.length - 1];
    strings.push({ x0: last.x0 + 2, y: 3.1, n: 7, z: -1.4 });
    strings.push(...(level.lanternStrings || []));

    for (const s of strings) {
      const g = new THREE.Group();
      const items = [];
      const pts = [];
      const width = (s.n - 1) * 1.15;
      for (let i = 0; i < s.n; i++) {
        const x = s.x0 + i * 1.15;
        const u = s.n > 1 ? i / (s.n - 1) : 0.5;
        const sag = s.goal ? 0 : 0.35 * Math.sin(u * Math.PI);
        const y = s.y - sag;
        const col = colors[Math.floor(rng() * colors.length)];
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(col).multiplyScalar(0.15),
          emissive: col,
          emissiveIntensity: 2.2,
          roughness: 0.9,
        });
        const pivot = new THREE.Group();
        pivot.position.set(x, y + 0.3, s.z);
        const m = new THREE.Mesh(geo, mat);
        m.scale.set(1, 1.25, 1);
        m.position.y = -0.3;
        pivot.add(m);
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = -0.07;
        pivot.add(cap);
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), capMat);
        str.position.y = 0.15;
        pivot.add(str);
        g.add(pivot);
        items.push({ pivot, phase: rng() * 6.28 });
        pts.push(new THREE.Vector3(x, y + 0.3, s.z));
      }
      if (s.n > 1) {
        pts.unshift(new THREE.Vector3(s.x0 - 0.8, s.y + 0.45, s.z));
        pts.push(new THREE.Vector3(s.x0 + width + 0.8, s.y + 0.45, s.z));
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      }
      scene.add(g);
      const cx = s.x0 + width / 2;
      world.fixtures.push({ x: cx, y: s.y - 0.3, z: s.z + 0.3, color: 0xff7a4a, intensity: 9, distance: 9 });
      S.strings.push({ x: cx, items });
    }
  },

  buildRain(world, S, count) {
    const { scene, rng } = world;
    const pos = new Float32Array(count * 6);
    S.rainCount = count;
    S.rainVel = new Float32Array(count);
    S.seedDrop = (i, camX, randomY) => {
      const x = camX + (rng() - 0.5) * 60;
      const y = randomY ? -4 + rng() * 20 : 14 + rng() * 3;
      const z = -14 + rng() * 24;
      const len = 0.25 + rng() * 0.2;
      pos[i * 6] = x;
      pos[i * 6 + 1] = y;
      pos[i * 6 + 2] = z;
      pos[i * 6 + 3] = x - 0.06;
      pos[i * 6 + 4] = y + len;
      pos[i * 6 + 5] = z;
    };
    for (let i = 0; i < count; i++) {
      S.rainVel[i] = 9 + rng() * 4;
      S.seedDrop(i, 0, true);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    S.rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x8d9bc2, transparent: true, opacity: 0.2, depthWrite: false })
    );
    S.rain.frustumCulled = false;
    scene.add(S.rain);
  },

  update(world, dt, t, catX, camX) {
    const S = world.themeState;
    for (const l of S.lamps) {
      if (Math.abs(l.x - catX) > 40) continue;
      const f = 1 + 0.08 * Math.sin(t * 11 + l.x) * Math.sin(t * 3.7 + l.x * 1.3);
      l.glow.material.opacity = 0.6 * f;
    }
    for (const s of S.strings) {
      if (Math.abs(s.x - catX) > 40) continue;
      for (const it of s.items) {
        it.pivot.rotation.z = 0.07 * Math.sin(t * 1.3 + it.phase);
        it.pivot.rotation.x = 0.05 * Math.sin(t * 0.9 + it.phase * 1.7);
      }
    }
    const pos = S.rain.geometry.attributes.position.array;
    for (let i = 0; i < S.rainCount; i++) {
      const dy = S.rainVel[i] * dt;
      const dx = -1.2 * dt;
      pos[i * 6] += dx;
      pos[i * 6 + 3] += dx;
      pos[i * 6 + 1] -= dy;
      pos[i * 6 + 4] -= dy;
      if (pos[i * 6 + 1] < STREET_Y) S.seedDrop(i, camX, false);
      else if (Math.abs(pos[i * 6] - camX) > 32) pos[i * 6] = pos[i * 6 + 3] = camX + (world.rng() - 0.5) * 60;
    }
    S.rain.geometry.attributes.position.needsUpdate = true;
  },

  dispose() {},
};
