// Stage 1 — "a night on the walls". Hand-authored layout + geometry + collision data.
import * as THREE from 'three';
import { boxWorldUV } from './textures.js';

export const STREET_Y = -3.2;
export const WALK_DEPTH = 2.2;

// --- layout -----------------------------------------------------------------
// plat(len, top, obstacles[{x, kind}]) / gap(len). Obstacle x is relative to the
// platform start. Rules of thumb (keep the stage fair at full jump range ≈5.5u):
//   obstacle.x >= 3.5 after a gap landing, >= 5 on a step-up, <= len - 4.5.
function layout() {
  const items = [];
  const plat = (len, top, obs = []) => items.push({ type: 'plat', len, top, obs });
  const gap = (len) => items.push({ type: 'gap', len });

  plat(20, 0); // intro — title screen lives here
  gap(2.4);
  plat(11, 0, [{ x: 5.5, kind: 'crate' }]);
  gap(2.8);
  plat(9, 0);
  plat(8, 0.8); // first wall step
  gap(3.2);
  plat(10, 0.8, [{ x: 5, kind: 'bin' }]);
  plat(10, 0, [{ x: 5, kind: 'planter' }]); // step down
  gap(3.0);
  plat(11, 0, [{ x: 5.0, kind: 'crate' }]);
  gap(3.4);
  plat(8, 0.6); // gap + step up
  plat(13, 0.6, [
    { x: 4.5, kind: 'bin' },
    { x: 6.5, kind: 'sign' },
  ]);
  gap(3.6);
  plat(6, 0);
  gap(2.6);
  plat(6, 0);
  gap(2.6);
  plat(11, 0.9, [{ x: 5.5, kind: 'crate' }]);
  gap(3.8);
  plat(10, 0.9, [{ x: 4.8, kind: 'planter' }]);
  plat(8, 0.2);
  gap(4.0);
  plat(11, 0.2, [{ x: 4.8, kind: 'sign' }]);
  gap(3.0);
  plat(7, 1.0);
  plat(9, 1.0, [
    { x: 2.5, kind: 'crate' },
    { x: 4.5, kind: 'crate' },
  ]);
  gap(3.4);
  plat(6, 0.4);
  gap(3.4);
  plat(11, 0.4, [{ x: 5.0, kind: 'bin' }]);
  gap(3.8);
  plat(13, 0, [
    { x: 5, kind: 'planter' },
    { x: 7.5, kind: 'sign' },
  ]);
  gap(4.2);
  plat(8, 0);
  plat(13, 0.9, [{ x: 7.0, kind: 'crate' }]);
  gap(3.0);
  plat(5, 0.9);
  gap(3.0);
  plat(5, 0.9);
  gap(3.2);
  plat(13, 0.3, [
    { x: 6.2, kind: 'bin' },
    { x: 8.7, kind: 'crate' },
  ]);
  gap(3.6);
  plat(26, 0); // home stretch; the gate sits 14u in
  return items;
}

const OBSTACLE_SIZE = {
  crate: { w: 0.8, h: 0.8 },
  bin: { w: 0.7, h: 0.95 },
  planter: { w: 1.0, h: 0.86 },
  sign: { w: 0.5, h: 1.08 },
};

// --- build -------------------------------------------------------------------
export function buildLevel(scene, tex, rng) {
  const level = {
    platforms: [],
    obstacles: [],
    sparks: [],
    lamps: [],
    lanternStrings: [],
    startX: 3,
    goalX: 0,
    endX: 0,
    group: new THREE.Group(),
  };
  scene.add(level.group);

  const wallMat = new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 0.82, metalness: 0 });
  const copingMat = new THREE.MeshStandardMaterial({ map: tex.stone, roughness: 0.55, metalness: 0 });
  const crateMat = new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.8 });
  const binMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.45, metalness: 0.65 });
  const terracotta = new THREE.MeshStandardMaterial({ color: 0x6a3c2b, roughness: 0.85 });
  const bush = new THREE.MeshStandardMaterial({ color: 0x1b3524, roughness: 0.9 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2a1e16, roughness: 0.75 });
  const chalk = new THREE.MeshStandardMaterial({ color: 0x3b3a36, roughness: 0.9 });

  let x = 0;
  let prevTop = 0;
  let lastWasGap = false;
  let gapStart = 0;
  const items = layout();

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.type === 'gap') {
      gapStart = x;
      x += it.len;
      lastWasGap = true;
      continue;
    }
    const x0 = x;
    const x1 = x + it.len;
    const top = it.top;
    const h = top - STREET_Y;

    // wall body
    const wall = new THREE.Mesh(boxWorldUV(it.len, h, WALK_DEPTH, 2), wallMat);
    wall.position.set((x0 + x1) / 2, STREET_Y + h / 2, 0);
    wall.receiveShadow = true;
    wall.castShadow = true;
    level.group.add(wall);
    // coping / ledge on top
    const cop = new THREE.Mesh(boxWorldUV(it.len + 0.12, 0.14, WALK_DEPTH + 0.24, 1), copingMat);
    cop.position.set((x0 + x1) / 2, top - 0.07, 0);
    cop.receiveShadow = true;
    cop.castShadow = true;
    level.group.add(cop);

    level.platforms.push({ x0, x1, top });

    // obstacles
    for (const o of it.obs) {
      const size = OBSTACLE_SIZE[o.kind];
      const ox = x0 + o.x;
      const g = new THREE.Group();
      g.position.set(ox, top, 0);
      if (o.kind === 'crate') {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), crateMat);
        m.position.y = 0.4;
        m.rotation.y = (rng() - 0.5) * 0.4;
        m.castShadow = m.receiveShadow = true;
        g.add(m);
      } else if (o.kind === 'bin') {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.86, 14), binMat);
        m.position.y = 0.43;
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 14), binMat);
        lid.position.y = 0.9;
        lid.castShadow = true;
        g.add(lid);
      } else if (o.kind === 'planter') {
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.46, 0.6), terracotta);
        m.position.y = 0.23;
        m.castShadow = m.receiveShadow = true;
        g.add(m);
        for (let b = 0; b < 3; b++) {
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.22 + rng() * 0.08, 10, 8), bush);
          s.position.set(-0.3 + b * 0.3, 0.58 + rng() * 0.08, (rng() - 0.5) * 0.2);
          s.castShadow = true;
          g.add(s);
        }
      } else if (o.kind === 'sign') {
        const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.72, 0.08), chalk);
        board.position.y = 0.72;
        board.castShadow = true;
        g.add(board);
        for (const s of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.05), darkWood);
          leg.position.set(s * 0.18, 0.2, 0.08 * s);
          leg.rotation.x = s * 0.25;
          g.add(leg);
        }
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.06), darkWood);
        frame.position.set(0, 0.72, -0.02);
        g.add(frame);
      }
      level.group.add(g);
      level.obstacles.push({ x: ox, y: top, w: size.w, h: size.h, kind: o.kind });
    }

    // sparks over gaps and above obstacles
    if (lastWasGap) {
      const gx = (gapStart + x0) / 2;
      level.sparks.push({ x: gx, y: Math.max(prevTop, top) + 1.5 });
    }
    for (const o of it.obs) {
      if (rng() < 0.6) level.sparks.push({ x: x0 + o.x + 0.2, y: top + 1.55 });
    }

    x = x1;
    prevTop = top;
    lastWasGap = false;
  }

  level.endX = x;
  const last = level.platforms[level.platforms.length - 1];
  level.goalX = last.x0 + 14;

  // tutorial sparks on the first platform
  for (let i = 0; i < 3; i++) level.sparks.push({ x: 9.5 + i * 1.4, y: 0.6 });
  level.sparks.push({ x: 16.2, y: 1.7 });

  // lamps, spaced along the street
  let lx = 6;
  while (lx < level.goalX - 6) {
    level.lamps.push({ x: lx });
    lx += 11 + rng() * 3;
  }
  level.lamps.push({ x: level.goalX - 2.8 });
  level.lamps.push({ x: level.goalX + 4.5 });

  // paper lantern strings on a few platforms
  level.platforms.forEach((p, i) => {
    if (i % 4 === 2 && p.x1 - p.x0 >= 8) {
      const n = Math.min(6, Math.floor((p.x1 - p.x0 - 2) / 1.15));
      level.lanternStrings.push({ x0: p.x0 + 1.2, y: p.top + 3.0, n, z: -1.5 });
    }
  });
  level.lanternStrings.push({ x0: last.x0 + 2, y: 3.1, n: 7, z: -1.4 });
  level.lanternStrings.push({ x0: level.goalX - 1.2, y: 2.75, n: 3, z: 0.0, goal: true });

  buildGoal(level, tex);
  return level;
}

function buildGoal(level, tex) {
  const g = new THREE.Group();
  const gx = level.goalX;
  g.position.set(gx, 0, 0);
  const wood = new THREE.MeshStandardMaterial({ color: 0x24170f, roughness: 0.7 });
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
  const wallMat = new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 0.85 });
  const home = new THREE.Mesh(boxWorldUV(7, 4.2, 1.2, 2), wallMat);
  home.position.set(5.5, 2.1, -1.9);
  home.receiveShadow = true;
  g.add(home);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.2, 1.8), wood);
  roof.position.set(5.5, 4.3, -1.9);
  g.add(roof);
  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.4),
    new THREE.MeshStandardMaterial({
      color: 0x331a08,
      emissive: 0xffc27a,
      emissiveIntensity: 0.85,
      roughness: 1,
    })
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
  // a flowerpot on the sill
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.09, 0.18, 10),
    new THREE.MeshStandardMaterial({ color: 0x6a3c2b, roughness: 0.9 })
  );
  pot.position.set(4.0, 1.15, -1.15);
  g.add(pot);

  level.homeLight = { x: gx + 4.3, y: 1.75, z: -1.1 };
  level.group.add(g);
}

// --- collision helpers ----------------------------------------------------------
export function platformsUnder(level, x, halfSpan) {
  const out = [];
  for (const p of level.platforms) if (p.x1 > x - halfSpan && p.x0 < x + halfSpan) out.push(p);
  return out;
}
