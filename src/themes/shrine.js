// Stage II dressing: a mountain shrine at night in autumn — moss walls and
// footbridges over a still lake, torii gates, stone lanterns, maples, mist,
// fireflies and falling leaves.
import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { WALK_DEPTH } from '../level.js';
import { mossStoneTexture, barkTexture, woodTexture, waterNormalsTexture, leafTexture, boxWorldUV } from '../textures.js';

const WATER_Y = -2.8;
const CANOPY = [0x8c2a18, 0xa3401c, 0xb8741e, 0x6e1f12, 0x9a3a1a];

export const shrineTheme = {
  key: 'shrine',
  floorY: WATER_Y,
  ambience: 'night',
  hanging: new Set(['rope', 'branch']),
  colors: {
    bg: 0x060a0e,
    fog: 0x0a1518,
    fogNear: 12,
    fogFar: 48,
    hemiSky: 0x1e3a3a,
    hemiGround: 0x0d1a10,
    hemiInt: 1.4,
    moon: 0x9fb8d8,
    moonInt: 3.4,
    moonPos: [-22, 44, -92],
    moonSize: 4.6,
    moonHalo: 0xb0c8e8,
    skyTop: [0.008, 0.016, 0.03],
    skyMid: [0.03, 0.08, 0.1],
    skyHor: [0.1, 0.16, 0.15],
    starCount: 520,
    fill: 0x9fc8d8,
    puff: 0x9fb8c0,
    spark: 0xbfe8ff,
    cp: 0xbfe8ff,
  },

  makeTextures(rng) {
    return {
      moss: mossStoneTexture(rng),
      bark: barkTexture(rng),
      plank: woodTexture(rng),
      waterNormals: waterNormalsTexture(rng),
      leaf: leafTexture(),
    };
  },

  init(tex, rng) {
    this.tex = tex;
    this.m = {
      wall: new THREE.MeshStandardMaterial({ map: tex.moss, roughness: 0.9 }),
      cap: new THREE.MeshStandardMaterial({ color: 0x3f4a40, roughness: 0.7 }),
      plank: new THREE.MeshStandardMaterial({ map: tex.plank, roughness: 0.75 }),
      post: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8 }),
      torii: new THREE.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.55 }),
      toriiDark: new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.7 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x4a4d48, roughness: 0.85 }),
      stoneLight: new THREE.MeshStandardMaterial({ color: 0xcfc8bb, roughness: 0.8 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x3b473c, roughness: 0.95, flatShading: true }),
      paper: new THREE.MeshStandardMaterial({
        color: 0x2a1a08,
        emissive: 0xffb070,
        emissiveIntensity: 2.4,
        roughness: 0.9,
      }),
      shide: new THREE.MeshStandardMaterial({ color: 0xe8e4d8, roughness: 0.9, side: THREE.DoubleSide }),
      rope: new THREE.MeshStandardMaterial({ color: 0xb59b6e, roughness: 0.95 }),
      bark: new THREE.MeshStandardMaterial({ map: tex.bark, roughness: 0.95 }),
      canopy: CANOPY.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })),
      cedar: new THREE.MeshStandardMaterial({ color: 0x0c1c1a, roughness: 1, flatShading: true }),
      lantern: new THREE.MeshStandardMaterial({
        color: 0x331408,
        emissive: 0xff8a3a,
        emissiveIntensity: 2.0,
        roughness: 0.9,
      }),
    };
    this.geo = {
      rock: new THREE.IcosahedronGeometry(0.42, 1),
      canopy: new THREE.IcosahedronGeometry(1, 1),
      cedar: new THREE.ConeGeometry(1, 1, 7),
    };
  },

  buildPlatform(group, x0, x1, top, rng, index) {
    const len = x1 - x0;
    const cx = (x0 + x1) / 2;
    const bridge = len <= 8 && top <= 0.6 && index % 2 === 1;
    if (bridge) {
      // wooden footbridge on posts
      const deck = new THREE.Mesh(boxWorldUV(len, 0.24, WALK_DEPTH, 1.2), this.m.plank);
      deck.position.set(cx, top - 0.12, 0);
      deck.receiveShadow = deck.castShadow = true;
      group.add(deck);
      for (let x = x0 + 0.6; x < x1; x += 2.2) {
        for (const z of [-0.85, 0.85]) {
          const h = top - 0.2 - WATER_Y + 0.4;
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, h, 8), this.m.post);
          post.position.set(x, WATER_Y - 0.4 + h / 2, z);
          post.castShadow = true;
          group.add(post);
        }
      }
      // railing on the back edge
      for (let x = x0 + 0.3; x < x1; x += 1.5) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.85, 6), this.m.post);
        p.position.set(x, top + 0.42, -1.0);
        p.castShadow = true;
        group.add(p);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.08), this.m.post);
      rail.position.set(cx, top + 0.84, -1.0);
      rail.castShadow = true;
      group.add(rail);
      return;
    }
    const h = top - WATER_Y + 0.6; // walls sink below the surface
    const wall = new THREE.Mesh(boxWorldUV(len, h, WALK_DEPTH, 2), this.m.wall);
    wall.position.set(cx, top - h / 2, 0);
    wall.receiveShadow = wall.castShadow = true;
    group.add(wall);
    const cap = new THREE.Mesh(boxWorldUV(len + 0.1, 0.12, WALK_DEPTH + 0.2, 1), this.m.cap);
    cap.position.set(cx, top - 0.06, 0);
    cap.receiveShadow = cap.castShadow = true;
    group.add(cap);
  },

  buildObstacle(group, kind, x, top, rng) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    let size;
    if (kind === 'rock') {
      const r = new THREE.Mesh(this.geo.rock, m.rock);
      r.scale.set(1.1, 0.9, 1.0);
      r.position.y = 0.36;
      r.rotation.set(rng() * 3, rng() * 3, 0);
      r.castShadow = r.receiveShadow = true;
      g.add(r);
      size = { w: 0.9, h: 0.75 };
    } else if (kind === 'fence') {
      for (const px of [-0.5, 0, 0.5]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.68, 0.08), m.post);
        p.position.set(px, 0.34, 0);
        p.castShadow = true;
        g.add(p);
      }
      for (const ry of [0.28, 0.56]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.06), m.post);
        rail.position.set(0, ry, 0.03);
        rail.castShadow = true;
        g.add(rail);
      }
      size = { w: 1.2, h: 0.65 };
    } else if (kind === 'fox') {
      // a kitsune statue on a pedestal
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.38, 0.5), m.stone);
      ped.position.y = 0.19;
      ped.castShadow = ped.receiveShadow = true;
      g.add(ped);
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 4, 10), m.stoneLight);
      body.position.set(-0.02, 0.62, 0);
      body.rotation.z = -0.25;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), m.stoneLight);
      head.position.set(0.1, 0.9, 0);
      head.castShadow = true;
      g.add(head);
      for (const s of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), m.stoneLight);
        ear.position.set(0.08, 1.02, s * 0.06);
        g.add(ear);
      }
      const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.25, 4, 8), m.stoneLight);
      tail.position.set(-0.22, 0.62, 0);
      tail.rotation.z = 0.6;
      g.add(tail);
      size = { w: 0.6, h: 1.05 };
    } else {
      // offering box with slatted lid
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.62, 0.7), m.post);
      box.position.y = 0.31;
      box.castShadow = box.receiveShadow = true;
      g.add(box);
      for (let i = 0; i < 5; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.08), m.toriiDark);
        slat.position.set(0, 0.66, -0.28 + i * 0.14);
        g.add(slat);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.86), m.toriiDark);
      roof.position.y = 0.86;
      roof.castShadow = true;
      g.add(roof);
      size = { w: 0.9, h: 0.9 };
    }
    group.add(g);
    return size;
  },

  /** A torii gate straddling the walk. rope: 'low' (obstacle), 'high' (decor) or null. */
  torii(group, x, top, rope, withLanterns, world) {
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    // tall enough that a cat at the top of its jump passes under the beams
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.6, 10), m.torii);
      post.position.set(0, 1.8, s * 1.25);
      post.castShadow = true;
      g.add(post);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.2, 10), m.toriiDark);
      foot.position.set(0, 0.1, s * 1.25);
      g.add(foot);
    }
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 3.4), m.toriiDark);
    kasagi.position.set(0, 3.7, 0);
    kasagi.castShadow = true;
    g.add(kasagi);
    const shimaki = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.14, 3.2), m.torii);
    shimaki.position.set(0, 3.53, 0);
    g.add(shimaki);
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 3.0), m.torii);
    nuki.position.set(0, 3.0, 0);
    nuki.castShadow = true;
    g.add(nuki);
    if (rope) {
      // the low rope hangs at head height: slide under it or clear it with a jump
      const ry = rope === 'low' ? 0.98 : 2.6;
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.6, 8), m.rope);
      r.rotation.x = Math.PI / 2;
      r.position.set(0, ry, 0);
      r.castShadow = true;
      g.add(r);
      for (let i = 0; i < 6; i++) {
        const z = -1.1 + i * 0.44;
        const len = rope === 'low' ? 0.5 : 0.45;
        const shide = new THREE.Mesh(new THREE.PlaneGeometry(0.12, len), m.shide);
        shide.position.set(0.02, ry - len / 2 - 0.04, z);
        shide.rotation.y = (i % 2 ? 1 : -1) * 0.25;
        g.add(shide);
        if (i < 5) {
          const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.015, 0.24, 5), m.rope);
          tassel.position.set(-0.02, ry - 0.17, z + 0.22);
          g.add(tassel);
        }
      }
    }
    if (withLanterns) {
      for (const s of [-1, 1]) {
        const lan = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), m.lantern);
        lan.scale.set(1, 1.3, 1);
        lan.position.set(0, 2.45, s * 0.75);
        g.add(lan);
        const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 4), m.toriiDark);
        str.position.set(0, 2.78, s * 0.75);
        g.add(str);
      }
      world.fixtures.push({ x, y: top + 2.4, z: 0, color: 0xff9a4a, intensity: 7, distance: 9, flicker: true });
    }
    group.add(g);
  },

  buildHanging(group, kind, x, top, rng) {
    if (kind === 'rope') {
      this.torii(group, x, top, 'low', false, null);
      return { w: 0.6, clearance: 0.42, height: 1.08 };
    }
    // branch: a maple leaning over the walk from a rock behind it
    const m = this.m;
    const g = new THREE.Group();
    g.position.set(x, top, 0);
    const rock = new THREE.Mesh(this.geo.rock, m.rock);
    rock.scale.set(2.2, (top - WATER_Y + 0.6) / 0.42, 2.0);
    rock.position.set(-0.4, (WATER_Y + top) / 2 - 0.2, -2.4);
    group.add(rock);
    const trunkH = 2.6;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, trunkH, 8), m.bark);
    trunk.position.set(-0.4, top + trunkH / 2 - 0.1, -2.4);
    trunk.rotation.x = 0.28;
    trunk.castShadow = true;
    g.add(trunk);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.08, 2.6, 7), m.bark);
    branch.position.set(-0.1, top + 1.05, -1.05);
    branch.rotation.set(1.05, 0, 0.35);
    branch.castShadow = true;
    g.add(branch);
    for (let i = 0; i < 4; i++) {
      const leaf = new THREE.Mesh(this.geo.canopy, m.canopy[Math.floor(rng() * m.canopy.length)]);
      const r = 0.34 + rng() * 0.16;
      leaf.scale.set(r * 1.3, r * 0.7, r * 1.1);
      leaf.position.set(-0.45 + i * 0.32, top + 0.78 + rng() * 0.2, -0.35 + rng() * 0.5);
      leaf.rotation.set(rng(), rng(), rng());
      leaf.castShadow = true;
      g.add(leaf);
    }
    group.add(g);
    return { w: 1.4, clearance: 0.42, height: 1.1 };
  },

  buildGoal(level, rng) {
    const m = this.m;
    const g = new THREE.Group();
    const gx = level.goalX;
    g.position.set(gx, 0, 0);
    // haiden (worship hall) behind the walk
    const hall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 2.9, 3.0), m.post);
    hall.position.set(5.6, 1.45 + 0.3, -3.4);
    hall.receiveShadow = true;
    g.add(hall);
    const base = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.6, 3.8), m.stone);
    base.position.set(5.6, 0.3, -3.4);
    g.add(base);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 1.6, 4), m.toriiDark);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1.0, 1, 0.65);
    roof.position.set(5.6, 4.5, -3.4);
    roof.castShadow = true;
    g.add(roof);
    const doors = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.0), m.paper);
    doors.position.set(5.6, 1.9, -1.89);
    g.add(doors);
    for (const dx of [-0.6, 0, 0.6]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.0, 0.03), m.toriiDark);
      bar.position.set(5.6 + dx, 1.9, -1.87);
      g.add(bar);
    }
    for (const dy of [0.5, 1.0, 1.5, 2.0, 2.5]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.03), m.toriiDark);
      bar.position.set(5.6, 0.9 + dy * 0.4, -1.87);
      g.add(bar);
    }
    // steps down to the walk
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 0.5), m.stone);
      step.position.set(5.6, 0.1 + i * 0.2, -1.45 + i * -0.3 + 0.3);
      step.receiveShadow = true;
      g.add(step);
    }
    level.group.add(g);
    level.fixtures.push({ x: gx + 5.6, y: 1.9, z: -1.4, color: 0xffb070, intensity: 14, distance: 12 });
    level.goalTorii = gx - 0.6;
  },

  // --- dressing ----------------------------------------------------------------
  dress(world) {
    const { scene, level, rng, tex, quality } = world;
    const S = (world.themeState = { toro: [], mist: [], fireflies: null, leaves: null, water: null });

    this.buildWater(world, S);
    this.buildMountains(world);
    this.buildCedars(world);
    this.buildMaples(world);
    this.buildToro(world, S);

    // decorative torii: one at the start, every ~50u, and one at the goal
    this.torii(scene, 7.5, 0, 'high', true, world);
    for (let x = 60; x < level.goalX - 20; x += 50) {
      const p = level.platforms.find((pl) => pl.x0 + 1.5 <= x && pl.x1 - 1.5 >= x);
      if (p && !level.hangers.some((h) => Math.abs(h.x - x) < 4)) this.torii(scene, x, p.top, 'high', true, world);
    }
    this.torii(scene, level.goalTorii, 0, 'high', true, world);

    this.buildMist(world, S);
    this.buildFireflies(world, S, Math.round(80 * quality.particles));
    this.buildLeaves(world, S, Math.round(150 * quality.particles));
  },

  buildWater(world, S) {
    const { scene, level, tex, quality } = world;
    const len = level.endX + 220;
    const water = new Water(new THREE.PlaneGeometry(len, 80), {
      textureWidth: quality.waterRes,
      textureHeight: quality.waterRes,
      waterNormals: tex.waterNormals,
      sunDirection: new THREE.Vector3(-0.2, 0.42, -0.88).normalize(),
      sunColor: 0x8aa4c8,
      waterColor: 0x07151a,
      distortionScale: 1.4,
      fog: true,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(len / 2 - 90, WATER_Y, -10);
    water.material.uniforms.size.value = 7;
    scene.add(water);
    S.water = water;
  },

  buildMountains(world) {
    const { scene, level, rng } = world;
    const from = -140;
    const to = level.endX + 260;
    const ridge = (z, base, amp, color, step) => {
      const shape = new THREE.Shape();
      shape.moveTo(from, -40);
      let ph = rng() * 10;
      for (let x = from; x <= to; x += step) {
        const y =
          base +
          amp * (0.55 + 0.45 * Math.sin(x * 0.021 + ph)) * (0.6 + 0.4 * Math.sin(x * 0.067 + ph * 2)) +
          (rng() - 0.5) * amp * 0.12;
        shape.lineTo(x, y);
      }
      shape.lineTo(to, -40);
      shape.closePath();
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, fog: false }));
      mesh.position.z = z;
      scene.add(mesh);
    };
    ridge(-64, 6, 26, 0x0a1319, 9);
    ridge(-44, 2, 18, 0x0d1c22, 7);
  },

  buildCedars(world) {
    const { scene, level, rng } = world;
    const n = Math.floor((level.endX + 200) / 2.2);
    const mesh = new THREE.InstancedMesh(this.geo.cedar, this.m.cedar, n);
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const x = -90 + i * 2.2 + rng() * 1.6;
      const z = -15 - rng() * 9;
      const h = 4 + rng() * 5;
      p.set(x, WATER_Y + h / 2 - 0.5, z);
      s.set(0.9 + rng() * 0.6, h, 0.9 + rng() * 0.6);
      mat.compose(p, q, s);
      mesh.setMatrixAt(i, mat);
    }
    mesh.receiveShadow = true;
    scene.add(mesh);
  },

  buildMaples(world) {
    const { scene, level, rng } = world;
    const m = this.m;
    const tree = (x, z, h, scale, shadow) => {
      const g = new THREE.Group();
      g.position.set(x, WATER_Y, z);
      const rock = new THREE.Mesh(this.geo.rock, m.rock);
      rock.scale.set(2.6 * scale, 1.2 * scale, 2.2 * scale);
      rock.position.y = 0.1;
      rock.rotation.y = rng() * 3;
      g.add(rock);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * scale, 0.2 * scale, h, 8), m.bark);
      trunk.position.y = h / 2 + 0.3;
      trunk.rotation.z = (rng() - 0.5) * 0.25;
      trunk.castShadow = shadow;
      g.add(trunk);
      // many small clumps read as foliage; a few big ones read as boulders
      const n = 7 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const c = new THREE.Mesh(this.geo.canopy, m.canopy[Math.floor(rng() * m.canopy.length)]);
        const r = (0.38 + rng() * 0.32) * scale;
        c.scale.set(r * 1.3, r * 0.75, r * 1.2);
        c.position.set((rng() - 0.5) * 2.2 * scale, h + 0.2 + (rng() - 0.25) * 1.1 * scale, (rng() - 0.5) * 1.6 * scale);
        c.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        c.castShadow = shadow;
        g.add(c);
      }
      scene.add(g);
    };
    for (let x = -30; x < level.endX + 60; x += 6 + rng() * 7) {
      tree(x, -6.5 - rng() * 3, 2.6 + rng() * 1.6, 0.95, true);
    }
    for (let x = -30; x < level.endX + 60; x += 5 + rng() * 6) {
      tree(x + 2, -11.5 - rng() * 4, 3.2 + rng() * 2.4, 1.25, false);
    }
    // a few foreground clumps framing the top edge of the view
    for (let x = -20; x < level.endX + 40; x += 20 + rng() * 16) {
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(this.geo.canopy, m.canopy[Math.floor(rng() * m.canopy.length)]);
        const r = 0.45 + rng() * 0.25;
        c.scale.set(r * 1.4, r * 0.7, r);
        c.position.set(x + i * 0.9, 4.7 + rng() * 0.4, 4.6 + rng() * 0.8);
        c.rotation.set(rng() * 3, rng() * 3, rng() * 3);
        scene.add(c);
      }
    }
  },

  /** Stone lanterns (tōrō) on pedestals just behind the walk. */
  buildToro(world, S) {
    const { scene, level, rng, tex } = world;
    const m = this.m;
    const glowMat = new THREE.SpriteMaterial({
      map: tex.glow,
      color: 0xffa860,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const xs = [];
    let lx = 9;
    while (lx < level.goalX - 4) {
      xs.push(lx);
      lx += 9 + rng() * 3;
    }
    xs.push(level.goalX + 2.2);
    for (const x of xs) {
      const p = level.platforms.find((pl) => pl.x0 - 0.5 <= x && pl.x1 + 0.5 >= x);
      const top = p ? p.top : 0;
      const z = -1.95;
      const g = new THREE.Group();
      g.position.set(x, top, z);
      const pedH = top - WATER_Y + 0.5;
      const ped = new THREE.Mesh(boxWorldUV(0.9, pedH, 0.9, 2), m.wall);
      ped.position.y = -pedH / 2 + 0.02;
      g.add(ped);
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.18, 0.58), m.stone);
      base.position.y = 0.09;
      base.castShadow = true;
      g.add(base);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.78, 10), m.stone);
      pillar.position.y = 0.57;
      g.add(pillar);
      const mid = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.1, 0.46), m.stone);
      mid.position.y = 1.0;
      g.add(mid);
      const fire = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), m.stone);
      fire.position.y = 1.23;
      g.add(fire);
      for (const [dx, dz, ry] of [
        [0.172, 0, Math.PI / 2],
        [-0.172, 0, -Math.PI / 2],
        [0, 0.172, 0],
        [0, -0.172, Math.PI],
      ]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.2), m.paper);
        w.position.set(dx, 1.23, dz);
        w.rotation.y = ry;
        g.add(w);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.24, 4), m.stone);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = 1.52;
      roof.castShadow = true;
      g.add(roof);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), m.stone);
      knob.position.y = 1.68;
      g.add(knob);
      const glow = new THREE.Sprite(glowMat.clone());
      glow.position.set(0, 1.23, 0.2);
      glow.scale.set(1.3, 1.3, 1);
      g.add(glow);
      scene.add(g);
      world.fixtures.push({ x, y: top + 1.23, z: z + 0.35, color: 0xffb070, intensity: 11, distance: 11, flicker: true });
      S.toro.push({ x, glow });
    }
  },

  buildMist(world, S) {
    const { scene, level, rng, tex } = world;
    const geo = new THREE.PlaneGeometry(26, 6);
    for (const [z, y, op] of [
      [-4.5, -1.5, 0.14],
      [-8.5, -1.0, 0.16],
      [-14, 0.2, 0.14],
    ]) {
      for (let x = -30; x < level.endX + 60; x += 18 + rng() * 8) {
        const mat = new THREE.MeshBasicMaterial({
          map: tex.mist,
          color: 0x6f9a9c,
          transparent: true,
          opacity: op,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y + rng() * 0.6, z + rng());
        scene.add(mesh);
        S.mist.push({ mesh, x0: mesh.position.x, phase: rng() * 6.28 });
      }
    }
  },

  buildFireflies(world, S, n) {
    const { scene, rng, tex } = world;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const items = [];
    for (let i = 0; i < n; i++) {
      items.push({ ax: (rng() - 0.5) * 60, ay: 0.4 + rng() * 2.6, az: -5 + rng() * 7, ph: rng() * 6.28 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 0.3,
        map: tex.glow,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    pts.frustumCulled = false;
    scene.add(pts);
    S.fireflies = { pts, items, n };
  },

  buildLeaves(world, S, n) {
    const { scene, rng, tex } = world;
    const mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.17, 0.11),
      new THREE.MeshStandardMaterial({
        map: tex.leaf,
        transparent: true,
        alphaTest: 0.4,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      n
    );
    const items = [];
    const color = new THREE.Color();
    for (let i = 0; i < n; i++) {
      items.push({
        x: (rng() - 0.5) * 50,
        y: -2 + rng() * 10,
        z: -7 + rng() * 11,
        v: 0.55 + rng() * 0.6,
        ph: rng() * 6.28,
        rx: rng() * 2,
        ry: rng() * 2,
      });
      color.setHex(CANOPY[Math.floor(rng() * CANOPY.length)]);
      mesh.setColorAt(i, color);
    }
    mesh.frustumCulled = false;
    scene.add(mesh);
    S.leaves = { mesh, items, n };
  },

  update(world, dt, t, catX, camX) {
    const S = world.themeState;
    const rng = world.rng;
    S.water.material.uniforms.time.value += dt * 0.5;

    for (const l of S.toro) {
      if (Math.abs(l.x - catX) > 40) continue;
      l.glow.material.opacity = 0.5 * (1 + 0.1 * Math.sin(t * 9 + l.x) * Math.sin(t * 2.9 + l.x));
    }
    for (const m of S.mist) {
      if (Math.abs(m.x0 - camX) > 60) continue;
      m.mesh.position.x = m.x0 + 1.5 * Math.sin(t * 0.08 + m.phase);
    }

    // fireflies drift around an anchor that stays near the camera
    const F = S.fireflies;
    const fp = F.pts.geometry.attributes.position.array;
    const fc = F.pts.geometry.attributes.color.array;
    for (let i = 0; i < F.n; i++) {
      const f = F.items[i];
      if (Math.abs(f.ax - camX) > 32) f.ax = camX + (f.ax < camX ? 30 : -30) + (rng() - 0.5) * 6;
      fp[i * 3] = f.ax + 0.7 * Math.sin(t * 0.6 + f.ph);
      fp[i * 3 + 1] = f.ay + 0.35 * Math.sin(t * 1.1 + f.ph * 2.1);
      fp[i * 3 + 2] = f.az + 0.4 * Math.sin(t * 0.45 + f.ph * 1.3);
      const b = 0.15 + 0.85 * Math.pow(Math.max(0, Math.sin(t * 1.7 + f.ph * 3)), 3);
      fc[i * 3] = 0.85 * b;
      fc[i * 3 + 1] = 1.0 * b;
      fc[i * 3 + 2] = 0.45 * b;
    }
    F.pts.geometry.attributes.position.needsUpdate = true;
    F.pts.geometry.attributes.color.needsUpdate = true;

    // leaves fall, sway and tumble; respawn above the camera when they reach the water
    const L = S.leaves;
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < L.n; i++) {
      const lf = L.items[i];
      lf.y -= lf.v * dt;
      lf.x += (0.6 * Math.sin(t * 1.3 + lf.ph) - 0.35) * dt;
      if (lf.y < WATER_Y || Math.abs(lf.x - camX) > 32) {
        lf.x = camX + (rng() - 0.5) * 50;
        lf.y = 7 + rng() * 3;
        lf.z = -7 + rng() * 11;
      }
      p.set(lf.x, lf.y, lf.z);
      e.set(t * lf.rx + lf.ph, t * lf.ry, Math.sin(t * 2 + lf.ph) * 0.8);
      q.setFromEuler(e);
      mat.compose(p, q, s);
      L.mesh.setMatrixAt(i, mat);
    }
    L.mesh.instanceMatrix.needsUpdate = true;
  },

  dispose(world) {
    const S = world.themeState;
    // Water keeps its render target private; releasing the mirror texture frees the GPU memory.
    if (S?.water) S.water.material.uniforms.mirrorSampler.value.dispose();
  },
};
