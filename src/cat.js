// A procedural cat: built from primitives, animated entirely in code.
// The root group sits at the cat's feet and faces +X.
import * as THREE from 'three';

const BODY_Y = 0.67; // body pivot height above the feet
const TAIL_SEGMENTS = 8;
const TWO_PI = Math.PI * 2;

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 14), mat);
  m.castShadow = true;
  return m;
}
function sphere(r, mat, w = 16, h = 12) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, w, h), mat);
  m.castShadow = true;
  return m;
}

class Leg {
  constructor(parent, x, y, z, mats, front) {
    this.front = front;
    this.pivot = new THREE.Group();
    this.pivot.position.set(x, y, z);
    parent.add(this.pivot);

    const upper = capsule(0.056, 0.17, mats.fur); // total length 0.28
    upper.position.y = -0.14;
    this.pivot.add(upper);

    this.knee = new THREE.Group();
    this.knee.position.y = -0.28;
    this.pivot.add(this.knee);

    const lower = capsule(0.044, 0.17, mats.fur); // total 0.26
    lower.position.y = -0.13;
    this.knee.add(lower);

    const sock = sphere(0.062, mats.white, 12, 10);
    sock.position.set(0.02, -0.27, 0);
    sock.scale.set(1.15, 0.85, 1);
    this.knee.add(sock);

    this.a = 0; // hip/shoulder angle (positive = forward)
    this.b = 0; // knee angle (negative = tucked back)
  }
  apply(a, b, k) {
    this.a = lerp(this.a, a, k);
    this.b = lerp(this.b, b, k);
    this.pivot.rotation.z = this.a;
    this.knee.rotation.z = this.b;
  }
}

// Base tail curve: lifts up and back, tip curls slightly.
const TAIL_BASE = [-0.75, -0.3, -0.12, 0.0, 0.08, 0.12, 0.14, 0.12];
const TAIL_SIT = [0.95, 0.55, 0.25, 0.05, -0.1, -0.2, -0.2, -0.1];

export class Cat {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'cat';

    const fur = new THREE.MeshPhysicalMaterial({
      color: 0x1b1a20,
      roughness: 0.62,
      metalness: 0,
      sheen: 1.0,
      sheenRoughness: 0.55,
      sheenColor: new THREE.Color(0x8f90b0),
    });
    const white = new THREE.MeshPhysicalMaterial({
      color: 0xd9d4c7,
      roughness: 0.7,
      sheen: 0.6,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0xffffff),
    });
    const eye = new THREE.MeshStandardMaterial({
      color: 0x0a2a14,
      emissive: 0x9cffb4,
      emissiveIntensity: 2.6,
      roughness: 0.2,
    });
    const nose = new THREE.MeshStandardMaterial({ color: 0x8a4a4a, roughness: 0.5 });
    const earIn = new THREE.MeshStandardMaterial({ color: 0x5a3a3a, roughness: 0.8 });
    const collar = new THREE.MeshStandardMaterial({ color: 0x8c1f2a, roughness: 0.6 });
    const brass = new THREE.MeshStandardMaterial({
      color: 0xc9a040,
      roughness: 0.25,
      metalness: 0.9,
      emissive: 0x4a3410,
      emissiveIntensity: 0.6,
    });
    this.mats = { fur, white, eye };

    // --- body -------------------------------------------------------------
    this.body = new THREE.Group();
    this.body.position.y = BODY_Y;
    this.group.add(this.body);

    const torso = capsule(0.21, 0.5, fur);
    torso.rotation.z = Math.PI / 2;
    this.body.add(torso);

    const chest = sphere(0.235, fur);
    chest.position.set(0.24, 0.0, 0);
    this.body.add(chest);
    const bib = sphere(0.165, white);
    bib.position.set(0.3, -0.1, 0);
    this.body.add(bib);

    const hips = sphere(0.215, fur);
    hips.position.set(-0.26, 0.02, 0);
    this.body.add(hips);

    // --- head -------------------------------------------------------------
    this.head = new THREE.Group();
    this.head.position.set(0.42, 0.17, 0);
    this.body.add(this.head);

    const skull = sphere(0.175, fur, 20, 16);
    skull.position.set(0.1, 0.07, 0);
    this.head.add(skull);
    const muzzle = sphere(0.1, white, 14, 10);
    muzzle.position.set(0.23, 0.0, 0);
    muzzle.scale.set(1, 0.85, 1.1);
    this.head.add(muzzle);
    const noseM = sphere(0.028, nose, 8, 6);
    noseM.position.set(0.32, 0.04, 0);
    this.head.add(noseM);

    // collar with a small brass bell
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.028, 8, 20), collar);
    ring.position.set(-0.03, -0.06, 0);
    ring.rotation.y = Math.PI / 2;
    ring.scale.set(1, 1.15, 1);
    this.head.add(ring);
    const bell = sphere(0.035, brass, 10, 8);
    bell.position.set(0.02, -0.21, 0);
    this.head.add(bell);
    this.bell = bell;

    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      ear.position.set(0.07, 0.19, s * 0.095);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.16, 8), fur);
      cone.position.y = 0.07;
      cone.castShadow = true;
      ear.add(cone);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), earIn);
      inner.position.set(0.012, 0.055, 0);
      ear.add(inner);
      ear.rotation.x = -s * 0.38;
      ear.rotation.z = -0.12;
      this.head.add(ear);
      this.ears.push(ear);
    }

    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = sphere(0.03, eye, 10, 8);
      e.position.set(0.225, 0.095, s * 0.075);
      e.scale.set(0.6, 1, 1);
      this.head.add(e);
      this.eyes.push(e);
    }

    const wPts = [];
    for (const s of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        wPts.push(new THREE.Vector3(0.28, 0.0 + i * 0.015, s * 0.07));
        wPts.push(new THREE.Vector3(0.36, 0.03 + i * 0.05, s * 0.3));
      }
    }
    const whiskers = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(wPts),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 })
    );
    this.head.add(whiskers);

    // --- legs -------------------------------------------------------------
    const ly = -0.06;
    this.legs = [
      new Leg(this.body, 0.31, ly, 0.12, this.mats, true), // FL
      new Leg(this.body, 0.31, ly, -0.12, this.mats, true), // FR
      new Leg(this.body, -0.3, ly, 0.12, this.mats, false), // BL
      new Leg(this.body, -0.3, ly, -0.12, this.mats, false), // BR
    ];

    // --- tail -------------------------------------------------------------
    this.tail = [];
    let parent = this.body;
    const pos = new THREE.Vector3(-0.44, 0.1, 0);
    const L = 0.11;
    for (let i = 0; i < TAIL_SEGMENTS; i++) {
      const g = new THREE.Group();
      g.position.copy(pos);
      parent.add(g);
      const r = 0.046 - i * 0.0035;
      const seg = capsule(r, L, i === TAIL_SEGMENTS - 1 ? white : fur);
      seg.rotation.z = Math.PI / 2;
      seg.position.x = -L / 2;
      g.add(seg);
      this.tail.push({ g, a: 0 });
      parent = g;
      pos.set(-L, 0, 0);
    }

    // --- animation state --------------------------------------------------
    this.phase = 0;
    this.landT = 10;
    this.jumpT = 10;
    this.blinkT = 2.5;
    this.blink = 0;
    this.state = { bodyPitch: 0, bodyY: 0, headPitch: 0, headYaw: 0, sx: 1, sy: 1 };
  }

  onJump() {
    this.jumpT = 0;
  }
  onLand() {
    this.landT = 0;
  }

  /** Reset transient animation for a fresh run. */
  reset() {
    this.phase = 0;
    this.landT = 10;
    this.jumpT = 10;
    this.group.rotation.set(0, 0, 0);
    this.group.scale.set(1, 1, 1);
  }

  /**
   * @param {number} dt seconds
   * @param {object} s  { mode: 'idle'|'run'|'air'|'slide'|'dive'|'sit'|'dead', vy, speed, t }
   */
  update(dt, s) {
    const k = 1 - Math.exp(-dt * 20);
    const kSlow = 1 - Math.exp(-dt * 9);
    this.landT += dt;
    this.jumpT += dt;
    const t = s.t;

    let legs; // [[a,b] x4] FL FR BL BR
    let bodyPitch = 0;
    let bodyY = 0;
    let headPitch = 0;
    let headYaw = 0;
    let sx = 1;
    let sy = 1;
    const tailA = new Array(TAIL_SEGMENTS).fill(0);
    let earFlap = 0;
    let legK = k;

    if (s.mode === 'run') {
      this.phase = (this.phase + (dt * s.speed) / 2.1) % 1;
      const p = this.phase;
      const q = [p + 0.5, p + 0.62, p, p + 0.11]; // rotary gallop phase per leg
      legs = q.map((qq, i) => {
        const front = i < 2;
        const sw = Math.sin(TWO_PI * qq);
        const flex = Math.max(0, Math.cos(TWO_PI * qq));
        const a = (front ? 0.82 : 0.72) * sw + (front ? 0.05 : -0.05);
        const b = -(front ? 1.0 : 1.15) * flex * flex - 0.12;
        return [a, b];
      });
      bodyPitch = 0.11 * Math.sin(TWO_PI * p + 0.7) - 0.02;
      bodyY = 0.05 * Math.sin(TWO_PI * p + 1.3) + 0.02;
      sx = 1 + 0.05 * Math.sin(TWO_PI * p + 1.0);
      sy = 1 - 0.03 * Math.sin(TWO_PI * p + 1.0);
      headPitch = -bodyPitch * 0.7 + 0.1;
      headYaw = 0.02 * Math.sin(TWO_PI * p);
      for (let i = 0; i < TAIL_SEGMENTS; i++) {
        tailA[i] = TAIL_BASE[i] + 0.2 * Math.sin(TWO_PI * p - i * 0.55) * (0.35 + i * 0.09);
      }
    } else if (s.mode === 'air') {
      const rise = smoothstep(-5, 5, s.vy);
      // rising: stretched out; falling: reaching for the ground, hind legs tucked
      const riseLegs = [
        [0.95, -0.3],
        [0.9, -0.35],
        [-0.95, 0.2],
        [-0.9, 0.25],
      ];
      const fallLegs = [
        [0.55, -0.8],
        [0.5, -0.75],
        [0.4, -1.15],
        [0.35, -1.1],
      ];
      legs = riseLegs.map((r, i) => [lerp(fallLegs[i][0], r[0], rise), lerp(fallLegs[i][1], r[1], rise)]);
      bodyPitch = lerp(-0.2, 0.3, rise);
      headPitch = lerp(0.18, -0.12, rise);
      sx = lerp(1.0, 1.1, rise);
      sy = lerp(1.0, 0.92, rise);
      for (let i = 0; i < TAIL_SEGMENTS; i++) {
        tailA[i] = lerp(TAIL_BASE[i] * 0.35 + 0.1, TAIL_BASE[i] * 0.6 - 0.1, rise) + 0.08 * Math.sin(t * 9 - i * 0.6);
      }
      legK = 1 - Math.exp(-dt * 14);
    } else if (s.mode === 'dive') {
      // nose down, legs swept back, tail straight up behind
      legs = [
        [-0.75, -0.55],
        [-0.7, -0.5],
        [-0.95, -0.25],
        [-0.9, -0.3],
      ];
      bodyPitch = -0.5;
      headPitch = 0.3;
      sx = 1.12;
      sy = 0.9;
      for (let i = 0; i < TAIL_SEGMENTS; i++) tailA[i] = -0.35 + 0.1 * Math.sin(t * 11 - i * 0.7);
      legK = 1 - Math.exp(-dt * 16);
    } else if (s.mode === 'slide') {
      // belly to the ground, front paws reaching, hind legs trailing
      this.phase = (this.phase + (dt * s.speed) / 2.1) % 1;
      legs = [
        [1.25, -0.25],
        [1.15, -0.3],
        [-1.05, 0.15],
        [-1.0, 0.1],
      ];
      bodyPitch = -0.04;
      bodyY = -0.25;
      headPitch = 0.12;
      sx = 1.12;
      sy = 0.78;
      for (let i = 0; i < TAIL_SEGMENTS; i++) tailA[i] = TAIL_BASE[i] * 0.25 + 0.12 * Math.sin(t * 7 - i * 0.6);
      legK = 1 - Math.exp(-dt * 16);
    } else if (s.mode === 'sit') {
      legs = [
        [-0.18, 0.05],
        [-0.14, 0.05],
        [1.35, -2.35],
        [1.3, -2.3],
      ];
      bodyPitch = 0.42;
      bodyY = -0.17;
      headPitch = -0.3 + 0.03 * Math.sin(t * 1.1);
      headYaw = 0.25 * Math.sin(t * 0.5);
      sy = 1 + 0.015 * Math.sin(t * 2.4);
      for (let i = 0; i < TAIL_SEGMENTS; i++) tailA[i] = TAIL_SIT[i] + 0.12 * Math.sin(t * 1.7 - i * 0.7);
      legK = kSlow;
    } else if (s.mode === 'dead') {
      legs = [
        [0.7, -0.4],
        [-0.3, -0.9],
        [0.5, -0.3],
        [-0.6, -0.7],
      ];
      for (let i = 0; i < TAIL_SEGMENTS; i++) tailA[i] = TAIL_BASE[i] * 0.3;
      legK = kSlow;
    } else {
      // idle: standing, breathing, looking around
      legs = [
        [0.04, -0.08],
        [-0.03, -0.06],
        [0.03, -0.1],
        [-0.04, -0.08],
      ];
      sy = 1 + 0.02 * Math.sin(t * 2.2);
      sx = 1 - 0.008 * Math.sin(t * 2.2);
      headYaw = 0.38 * Math.sin(t * 0.55) + 0.1 * Math.sin(t * 1.7);
      headPitch = 0.06 + 0.05 * Math.sin(t * 1.3);
      earFlap = Math.sin(t * 6.3) > 0.985 ? 0.4 : 0;
      for (let i = 0; i < TAIL_SEGMENTS; i++) tailA[i] = TAIL_BASE[i] + 0.24 * Math.sin(t * 1.5 - i * 0.7) * (0.3 + i * 0.1);
      legK = kSlow;
    }

    // landing squash (overlaid)
    if (this.landT < 0.24) {
      const u = Math.sin((Math.PI * this.landT) / 0.24);
      sy *= 1 - 0.2 * u;
      sx *= 1 + 0.14 * u;
      bodyY -= 0.08 * u;
      legs = legs.map(([a, b], i) => [a + (i < 2 ? 0.25 : -0.25) * u, b - 0.5 * u]);
    }
    // takeoff stretch (overlaid)
    if (this.jumpT < 0.16) {
      const u = Math.sin((Math.PI * this.jumpT) / 0.16);
      sy *= 1 + 0.1 * u;
      sx *= 1 - 0.06 * u;
    }

    // apply with smoothing
    for (let i = 0; i < 4; i++) this.legs[i].apply(legs[i][0], legs[i][1], legK);
    const st = this.state;
    st.bodyPitch = lerp(st.bodyPitch, bodyPitch, k);
    st.bodyY = lerp(st.bodyY, bodyY, k);
    st.headPitch = lerp(st.headPitch, headPitch, k);
    st.headYaw = lerp(st.headYaw, headYaw, kSlow);
    st.sx = lerp(st.sx, sx, k);
    st.sy = lerp(st.sy, sy, k);

    this.body.rotation.z = st.bodyPitch;
    this.body.position.y = BODY_Y + st.bodyY;
    this.body.scale.set(st.sx, st.sy, 1);
    this.head.rotation.z = st.headPitch;
    this.head.rotation.y = st.headYaw;
    for (let i = 0; i < TAIL_SEGMENTS; i++) {
      const seg = this.tail[i];
      seg.a = lerp(seg.a, tailA[i], k);
      seg.g.rotation.z = seg.a;
      seg.g.rotation.y = 0.15 * Math.sin(t * 2.3 + i * 0.5) * (i / TAIL_SEGMENTS);
    }
    for (const e of this.ears) e.rotation.y = lerp(e.rotation.y, earFlap * Math.sign(e.position.z), kSlow);
    // the bell swings a little with the run
    this.bell.position.x = 0.02 + 0.02 * Math.sin(t * 12) * (s.mode === 'run' ? 1 : 0.2);

    // blink
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinkT = 2.5 + Math.random() * 3;
      this.blink = 0.14;
    }
    if (this.blink > 0) {
      this.blink -= dt;
      const closed = this.blink > 0.04 && this.blink < 0.1;
      for (const e of this.eyes) e.scale.y = closed ? 0.12 : 1;
    }
  }
}
