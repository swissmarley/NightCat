// Cats for the scenery, much simpler than the hero: a handful of primitives,
// sitting up, curled asleep, or peeking over the rim of a flowerpot. Sitting and
// peeking cats turn their heads to watch the night cat go by (and otherwise look
// out the way the stage asks), flick their tails and blink; a kitten may bat at
// the air; sleepers breathe.
import * as THREE from 'three';

// fur, chest and muzzle, eyes
const COATS = {
  ginger: [0xd8802e, 0xf0dcc0, 0x9cff8a],
  white: [0xece6dc, 0xf8f4ec, 0x8fd8ff],
  grey: [0x6e7482, 0xc6c6cc, 0xffd060],
  cream: [0xe2c69e, 0xf4e6d0, 0xffc040],
  tabby: [0x8a6a4c, 0xdcc8ac, 0x9cff8a],
  tuxedo: [0x24232b, 0xe8e4da, 0xffd060],
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class SceneryCats {
  /**
   * rng: the stage's generator. watch: the way a sitting cat looks while the night
   * cat isn't near, as a yaw (π/2 faces away from the camera).
   */
  constructor(scene, rng, { watch = Math.PI / 2 } = {}) {
    this.scene = scene;
    this.rng = rng;
    this.watch = watch;
    this.list = [];
    this.coats = {};
    this.patches = {};
    const std = (o) => new THREE.MeshStandardMaterial(o);
    this.m = {
      nose: std({ color: 0xc87a7a, roughness: 0.6 }),
      earIn: std({ color: 0x8a5a58, roughness: 0.8 }),
      lid: std({ color: 0x15100c, roughness: 0.8 }),
    };
    this.geo = {
      ball: new THREE.SphereGeometry(1, 12, 8),
      ear: new THREE.ConeGeometry(0.045, 0.1, 6),
      tail: new THREE.CapsuleGeometry(0.026, 0.06, 3, 8).rotateZ(Math.PI / 2),
    };
  }

  /** Materials for a coat, made once per stage. */
  coat(key) {
    if (!this.coats[key]) {
      const [fur, light, eyes] = COATS[key];
      this.coats[key] = {
        fur: new THREE.MeshStandardMaterial({ color: fur, roughness: 0.85 }),
        light: new THREE.MeshStandardMaterial({ color: light, roughness: 0.85 }),
        eyes: new THREE.MeshStandardMaterial({ color: 0x101008, emissive: eyes, emissiveIntensity: 1.6, roughness: 0.3 }),
      };
    }
    return this.coats[key];
  }

  patch(color) {
    if (!this.patches[color]) this.patches[color] = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
    return this.patches[color];
  }

  /**
   * A cat facing yaw (0 faces +x). pose: 'sit' (upright, tail curled round its
   * paws), 'loaf' (asleep, paws tucked in) or 'peek' (head and paws over a rim at
   * the origin, the tail hanging out behind). paw: a sitting kitten bats at the
   * air now and then. patches: markings, [on ('body' | 'head'), colour, sx, sy, sz, x, y, z].
   */
  add(coat, pose, x, y, z, yaw, { scale = 1, patches = [], paw = false } = {}) {
    const { geo } = this;
    const mats = this.coat(coat);
    const g = new THREE.Group();
    const part = (parent, mat, sx, sy, sz, px, py, pz) => {
      const o = new THREE.Mesh(geo.ball, mat);
      o.scale.set(sx, sy, sz);
      o.position.set(px, py, pz);
      o.castShadow = true;
      parent.add(o);
      return o;
    };
    const head = new THREE.Group();
    g.add(head);
    let body;
    let tailFrom;
    let curl;
    let swing = null;
    if (pose === 'sit') {
      part(g, mats.fur, 0.19, 0.15, 0.18, -0.06, 0.14, 0); // haunches
      body = part(g, mats.fur, 0.12, 0.19, 0.14, 0.03, 0.3, 0); // back and shoulders
      body.rotation.z = -0.35;
      part(g, mats.light, 0.085, 0.13, 0.1, 0.1, 0.3, 0); // chest
      for (const s of [-1, 1]) {
        // forelegs; a kitten's right one is on a shoulder joint so it can bat
        const leg = paw && s > 0 ? new THREE.Group() : g;
        if (leg !== g) {
          leg.position.set(0.1, 0.22, s * 0.055);
          g.add(leg);
          swing = leg;
        }
        const o = leg === g ? [0.1, 0.12, s * 0.055] : [0, -0.1, 0];
        part(leg, mats.fur, 0.033, 0.13, 0.033, o[0], o[1], o[2]);
        part(leg, mats.light, 0.045, 0.028, 0.04, o[0] + 0.025, o[1] - 0.1, o[2]);
      }
      head.position.set(0.12, 0.5, 0);
      if (paw) head.rotation.z = 0.35; // looking up at whatever it is batting at
      tailFrom = new THREE.Vector3(-0.2, 0.04, 0.02);
      curl = [0.5, 0.7, 0.7, 0.6, 0.45];
    } else if (pose === 'peek') {
      body = part(g, mats.fur, 0.2, 0.15, 0.18, -0.08, -0.1, 0); // mostly down inside
      for (const s of [-1, 1]) part(g, mats.light, 0.05, 0.03, 0.045, 0.2, 0.0, s * 0.08); // paws on the rim
      head.position.set(0.08, 0.1, 0);
      tailFrom = new THREE.Vector3(-0.28, 0.02, 0);
      curl = [0.9, 0.5, 0.2, -0.3, -0.6]; // over the back of the rim and down, the tip curling up
    } else {
      body = part(g, mats.fur, 0.27, 0.15, 0.17, 0, 0.14, 0);
      for (const s of [-1, 1]) part(g, mats.light, 0.05, 0.03, 0.045, 0.24, 0.03, s * 0.06); // paws tucked under the chin
      head.position.set(0.24, 0.17, 0);
      head.rotation.set(0.25, 0, -0.18); // resting, tipped to one side
      tailFrom = new THREE.Vector3(-0.25, 0.05, 0.06);
      curl = [1.1, 0.55, 0.4, 0.3, 0.25];
    }
    part(head, mats.fur, 0.11, 0.1, 0.12, 0, 0, 0);
    part(head, mats.light, 0.05, 0.04, 0.065, 0.085, -0.035, 0);
    part(head, this.m.nose, 0.013, 0.01, 0.015, 0.132, -0.012, 0);
    const awake = pose !== 'loaf';
    const eyes = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(geo.ear, mats.fur);
      ear.position.set(-0.005, 0.1, s * 0.062);
      ear.rotation.x = -s * 0.35;
      ear.castShadow = true;
      head.add(ear);
      const inner = new THREE.Mesh(geo.ear, this.m.earIn);
      inner.scale.setScalar(0.6);
      inner.position.set(0.012, 0.095, s * 0.06);
      inner.rotation.x = -s * 0.35;
      head.add(inner);
      eyes.push(
        awake
          ? part(head, mats.eyes, 0.012, 0.022, 0.018, 0.09, 0.022, s * 0.045)
          : part(head, this.m.lid, 0.008, 0.004, 0.02, 0.098, 0.015, s * 0.045)
      );
    }
    // the tail: short segments, each turned a little further round (a peeking
    // cat's hangs down, so its segments turn about z instead)
    const axis = pose === 'peek' ? 'z' : 'y';
    const tail = [];
    let parent = g;
    const at = tailFrom.clone();
    curl.forEach((a) => {
      const s = new THREE.Group();
      s.position.copy(at);
      s.rotation[axis] = a;
      parent.add(s);
      const seg = new THREE.Mesh(geo.tail, mats.fur);
      seg.position.x = -0.045;
      seg.castShadow = true;
      s.add(seg);
      tail.push(s);
      parent = s;
      at.set(-0.085, 0, 0);
    });
    for (const [on, color, sx, sy, sz, px, py, pz] of patches) part(on === 'head' ? head : g, this.patch(color), sx, sy, sz, px, py, pz);

    g.position.set(x, y, z);
    g.rotation.y = yaw;
    g.scale.setScalar(scale);
    this.scene.add(g);
    const rng = this.rng;
    const c = { g, head, body, eyes, tail, curl, axis, swing, bodySy: body.scale.y, x, z, yaw, pose, ph: rng() * 20, blinkT: rng() * 4, blink: 0, swipeAge: 1 };
    c.swipeT = swing ? 1 + rng() * 2 : 0;
    this.list.push(c);
    return c;
  }

  update(dt, t, catX, camX) {
    const rng = this.rng;
    for (const c of this.list) {
      if (Math.abs(c.x - camX) > 32) continue;
      const tt = t + c.ph;
      if (c.pose === 'loaf') {
        c.body.scale.y = c.bodySy * (1 + 0.045 * Math.sin(tt * 1.4));
        continue;
      }
      // watch the night cat go by; otherwise look out the way the stage asks
      const dx = catX - c.x;
      const near = Math.abs(dx) < 7;
      const want = near ? Math.atan2(c.z, dx) : this.watch + 0.25 * Math.sin(tt * 0.35);
      c.head.rotation.y = damp(c.head.rotation.y, clamp(wrapAngle(want - c.yaw), -1.1, 1.1), 3.5, dt);
      const flick = Math.sin(tt * (near ? 3.4 : 1.5));
      c.tail[3].rotation[c.axis] = c.curl[3] + 0.3 * flick;
      c.tail[4].rotation[c.axis] = c.curl[4] + 0.5 * flick;
      c.blinkT -= dt;
      if (c.blinkT <= 0) {
        c.blinkT = 2.5 + rng() * 4;
        c.blink = 0.14;
      }
      if (c.blink > 0) c.blink -= dt;
      const shut = c.blink > 0.03 && c.blink < 0.11;
      for (const e of c.eyes) e.scale.y = shut ? 0.003 : 0.022;
      if (c.swing) {
        // a quick swipe at the air every couple of seconds
        c.swipeT -= dt;
        if (c.swipeT <= 0) {
          c.swipeT = 1.6 + rng() * 2.4;
          c.swipeAge = 0;
        }
        c.swipeAge += dt;
        c.swing.rotation.z = c.swipeAge < 0.45 ? 1.5 * Math.sin((Math.PI * c.swipeAge) / 0.45) : 0;
      }
    }
  }
}
