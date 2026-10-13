// Generic stage builder: turns a stage layout into platforms, obstacles,
// hanging obstacles, sparks and checkpoints, delegating visuals to the theme.
import * as THREE from 'three';

export const WALK_DEPTH = 2.2;

export function buildLevel(scene, stage, theme, tex, rng) {
  const level = {
    stage,
    theme,
    platforms: [],
    obstacles: [],
    hangers: [],
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
    theme.buildPlatform(level.group, x0, x1, top, rng, level.platforms.length);
    level.platforms.push({ x0, x1, top });

    for (const o of it.obs) {
      const ax = x0 + o.x;
      if (o.kind === 'cp') {
        level.checkpoints.push(buildCheckpoint(level, ax, top, theme, tex));
      } else if (theme.hanging.has(o.kind)) {
        const size = theme.buildHanging(level.group, o.kind, ax, top, rng);
        level.hangers.push({ x: ax, w: size.w, y0: top + size.clearance, y1: top + 3.5, kind: o.kind });
      } else {
        const size = theme.buildObstacle(level.group, o.kind, ax, top, rng);
        level.obstacles.push({ x: ax, y: top, w: size.w, h: size.h, kind: o.kind });
      }
    }

    // sparks over gaps and above obstacles
    if (lastWasGap) level.sparks.push({ x: (gapStart + x0) / 2, y: Math.max(prevTop, top) + 1.5 });
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
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.75, 8), dark);
  pole.position.y = 0.875;
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

export function activateCheckpoint(cp) {
  cp.active = true;
  cp.lantern.material.emissiveIntensity = 2.6;
  cp.glow.material.opacity = 0.55;
  cp.fixture.intensity = 7;
}
