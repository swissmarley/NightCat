// Generic stage builder: turns a stage layout into platforms, obstacles,
// hanging obstacles, sparks and checkpoints, delegating visuals to the theme.
import * as THREE from 'three';

export const WALK_DEPTH = 2.2;
/** Seconds a brittle platform (old boards) holds after it is first stood on. */
export const BRITTLE_DELAY = 0.4;

export function buildLevel(scene, stage, theme, tex, rng) {
  const level = {
    stage,
    theme,
    platforms: [],
    obstacles: [],
    hangers: [],
    brittle: [],
    bouncy: [],
    sparks: [],
    checkpoints: [],
    fixtures: [],
    startX: 3,
    goalX: 0,
    endX: 0,
    floorY: theme.floorY,
    group: new THREE.Group(),
  };
  scene.add(level.group);
  theme.init(tex, rng);

  let x = 0;
  let prevTop = 0;
  let lastWasGap = false;
  let prevBouncy = false;
  let gapStart = 0;

  for (const it of stage.layout()) {
    if (it.type === 'gap') {
      gapStart = x;
      x += it.len;
      lastWasGap = true;
      continue;
    }
    const x0 = x;
    const x1 = x + it.len;
    const top = it.top;
    if (it.brittle) {
      // old boards: they give way a moment after they are first stood on
      const pieces = theme.buildBrittle(level.group, x0, x1, top, rng).map((o) => ({
        o,
        pos: o.position.clone(),
        rot: o.rotation.clone(),
      }));
      const pl = { x0, x1, top, brittle: true, touchT: null, gone: false, dropping: false, fallT: 0, pieces };
      level.platforms.push(pl);
      level.brittle.push(pl);
      level.sparks.push({ x: x0 + (x1 - x0) * 0.55, y: top + 1.3 });
    } else if (it.bouncy) {
      // an awning: it throws the cat up as soon as it lands on it
      const pl = { x0, x1, top, bouncy: true, part: theme.buildBouncy(level.group, x0, x1, top, rng) };
      level.platforms.push(pl);
      level.bouncy.push(pl);
    } else {
      theme.buildPlatform(level.group, x0, x1, top, rng, level.platforms.length);
      level.platforms.push({ x0, x1, top });
    }

    for (const o of it.obs) {
      const ax = x0 + o.x;
      if (o.kind === 'cp') {
        level.checkpoints.push(buildCheckpoint(level, ax, top, theme, tex));
      } else if (theme.hanging.has(o.kind)) {
        // a hanging obstacle only blocks what it visibly occupies: slide under it, or jump over it
        const size = theme.buildHanging(level.group, o.kind, ax, top, rng);
        level.hangers.push({ x: ax, w: size.w, y0: top + size.clearance, y1: top + size.height, kind: o.kind });
      } else {
        const size = theme.buildObstacle(level.group, o.kind, ax, top, rng);
        level.obstacles.push({ x: ax, y: top, w: size.w, h: size.h, kind: o.kind });
      }
    }

    // sparks over gaps (high on the throw from an awning) and above obstacles
    if (lastWasGap) level.sparks.push({ x: (gapStart + x0) / 2, y: prevBouncy ? prevTop + 3.0 : Math.max(prevTop, top) + 1.5 });
    for (const o of it.obs) {
      if (o.kind !== 'cp' && !theme.hanging.has(o.kind) && rng() < 0.6) {
        level.sparks.push({ x: ax(o), y: top + 1.55 });
      }
    }
    function ax(o) {
      return x0 + o.x + 0.2;
    }

    x = x1;
    prevTop = top;
    prevBouncy = !!it.bouncy;
    lastWasGap = false;
  }

  level.endX = x;
  const last = level.platforms[level.platforms.length - 1];
  level.goalX = last.x0 + stage.goalOffset;
  for (const s of stage.extraSparks || []) level.sparks.push({ x: s.x, y: s.y });
  theme.buildGoal(level, rng);
  return level;
}

/** A small lantern on a pole at the back edge of the walk; it lights up when passed. */
function buildCheckpoint(level, x, top, theme, tex) {
  const g = new THREE.Group();
  g.position.set(x, top, -0.95);
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 0.7 });
  // on a sloped walk (roofs) the pole reaches down to the surface behind the walk
  const sink = theme.cpSink || 0;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.75 + sink, 8), dark);
  pole.position.y = (1.75 - sink) / 2;
  pole.castShadow = true;
  g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6), dark);
  arm.rotation.x = Math.PI / 2;
  arm.position.set(0, 1.72, 0.18);
  g.add(arm);
  const col = theme.colors.cp;
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(col).multiplyScalar(0.12),
    emissive: col,
    emissiveIntensity: 0.35,
    roughness: 0.9,
  });
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), mat);
  lantern.scale.set(1, 1.3, 1);
  lantern.position.set(0, 1.42, 0.36);
  g.add(lantern);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), dark);
  string.position.set(0, 1.66, 0.36);
  g.add(string);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex.glow,
      color: col,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  glow.position.copy(lantern.position);
  glow.scale.set(1.8, 1.8, 1);
  g.add(glow);
  level.group.add(g);

  const fixture = { x, y: top + 1.42, z: -0.6, color: col, intensity: 0, distance: 9 };
  level.fixtures.push(fixture);
  return { x, top, lantern, glow, fixture, active: false };
}

export function resetCheckpoints(level) {
  for (const cp of level.checkpoints) {
    cp.active = false;
    cp.lantern.material.emissiveIntensity = 0.35;
    cp.glow.material.opacity = 0;
    cp.fixture.intensity = 0;
  }
}

/** Put every brittle platform back as it was: unstood, unbroken, pieces in place. */
export function resetBrittle(level) {
  for (const pl of level.brittle) {
    pl.touchT = null;
    pl.gone = false;
    pl.dropping = false;
    pl.fallT = 0;
    for (const pc of pl.pieces) {
      pc.o.position.copy(pc.pos);
      pc.o.rotation.copy(pc.rot);
      pc.o.visible = true;
      pc.vy = 0;
      pc.resting = false;
    }
  }
}

export function activateCheckpoint(cp) {
  cp.active = true;
  cp.lantern.material.emissiveIntensity = 2.6;
  cp.glow.material.opacity = 0.55;
  cp.fixture.intensity = 7;
}
