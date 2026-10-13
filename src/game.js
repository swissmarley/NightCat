// Game state machine, fixed-step physics, camera, and the render loop.
import * as THREE from 'three';
import { Cat } from './cat.js';
import { buildLevel, STREET_Y } from './level.js';
import { World } from './world.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { UI } from './ui.js';
import { makeRng, brickTexture, stoneTexture, asphaltMaps, glowTexture, woodTexture } from './textures.js';

const STEP = 1 / 120;
const GRAVITY = 30;
const JUMP_V = 11.5;
const JUMP_CUT_V = 4.0;
const COYOTE = 0.1;
const BUFFER = 0.13;
const STEP_TOL = 0.35; // small ledges are climbed automatically; anything taller is a wall
const FOOT = 0.22; // half the foot span used for support
const BODY = 0.3; // half the body length used for obstacles/walls
const BASE_SPEED = 7.0;
const SPEED_GAIN = 1.6;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Game {
  constructor(container) {
    this.container = container;
    this.params = new URLSearchParams(location.search);
    this.autopilot = this.params.has('auto');

    // --- renderer -------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 160);

    // --- content --------------------------------------------------------
    const rng = makeRng(20261013);
    this.tex = {
      brick: brickTexture(rng),
      stone: stoneTexture(rng),
      asphalt: asphaltMaps(rng),
      glow: glowTexture(),
      wood: woodTexture(rng),
    };
    this.level = buildLevel(this.scene, this.tex, rng);
    this.world = new World(this.scene, renderer, this.camera, this.level, this.tex, rng);
    this.cat = new Cat();
    this.scene.add(this.cat.group);

    this.input = new Input(renderer.domElement);
    this.sfx = new Sfx();
    this.ui = new UI();
    this.input.onFirstInteraction = () => this.sfx.ensure();

    // --- state ----------------------------------------------------------
    this.t = 0;
    this.acc = 0;
    this.last = performance.now();
    this.cam = { x: 0, y: 2.4, z: 10.5, lookY: 1.0, lookX: 0 };
    this.p = {}; // player physics
    this.resetRun();
    this.setState('title');

    window.addEventListener('resize', () => this.resize());
    this.resize();

    // debug / test hooks
    window.__catwalk = this;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.world.resize(w, h);
  }

  // --- state ------------------------------------------------------------
  resetRun() {
    const p = this.p;
    p.x = this.level.startX;
    p.y = 0;
    p.vy = 0;
    p.vx = 0;
    p.grounded = true;
    p.coyote = 0;
    p.buffer = 0;
    p.groundY = 0;
    p.sparks = 0;
    p.runTime = 0;
    p.deathKind = null;
    p.deathT = 0;
    p.clearT = 0;
    p.rot = 0;
    p.autoHold = 0;
    this.cat.reset();
    this.world.resetSparks();
    this.ui.setSparks(0);
    this.ui.setProgress(0);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    if (s === 'title') {
      this.ui.showTitle();
      this.ui.fadeIn(false);
    } else if (s === 'run') {
      this.ui.showRun();
      this.ui.fadeIn(true);
    }
  }

  startRun() {
    this.resetRun();
    this.setState('run');
    this.sfx.start();
  }

  die(kind) {
    const p = this.p;
    p.deathKind = kind;
    p.deathT = 0;
    p.vx = kind === 'hit' ? -1.6 : this.speedAt(p.x) * 0.5;
    if (kind === 'hit') {
      p.vy = 5.5;
      p.grounded = false;
      this.ui.flash();
      this.sfx.hit();
    } else {
      this.sfx.fall();
    }
    this.setState('dead');
  }

  clearStage() {
    const p = this.p;
    p.vx = this.speedAt(p.x);
    p.clearT = 0;
    this.setState('clear');
    this.sfx.clear();
  }

  speedAt(x) {
    return BASE_SPEED + SPEED_GAIN * clamp(x / this.level.goalX, 0, 1);
  }

  // --- physics (fixed step) ------------------------------------------------
  stepRun(h) {
    const p = this.p;
    const level = this.level;
    p.runTime += h;
    const speed = this.speedAt(p.x);
    p.vx = speed;
    p.x += speed * h;

    if (this.autopilot) this.runAutopilot(h);

    // jump input
    if (this.input.consumePress()) p.buffer = BUFFER;
    if (p.buffer > 0 && (p.grounded || p.coyote > 0)) {
      p.vy = JUMP_V;
      p.grounded = false;
      p.coyote = 0;
      p.buffer = 0;
      this.cat.onJump();
      this.sfx.jump();
    } else if (p.buffer > 0) p.buffer -= h;
    if (!p.grounded && p.coyote > 0) p.coyote -= h;

    const prevY = p.y;
    if (!p.grounded) {
      if (!this.input.held && p.vy > JUMP_CUT_V) p.vy = JUMP_CUT_V;
      p.vy -= GRAVITY * h;
      p.y += p.vy * h;
    }

    // walls: running face-first into the leading edge of a platform whose top is
    // well above the feet (only the leading edge counts, so stepping down off a
    // ledge never collides with the wall just left behind)
    for (const pl of level.platforms) {
      if (pl.top > p.y + STEP_TOL && pl.x0 < p.x + BODY && pl.x0 >= p.x - BODY) {
        p.x = pl.x0 - BODY - 0.02;
        p.groundY = Math.max(STREET_Y, p.groundY);
        this.die('hit');
        return;
      }
    }

    // support
    if (p.grounded) {
      let top = -Infinity;
      for (const pl of level.platforms) {
        if (pl.x1 > p.x - FOOT && pl.x0 < p.x + FOOT && Math.abs(pl.top - p.y) <= STEP_TOL) top = Math.max(top, pl.top);
      }
      if (top === -Infinity) {
        p.grounded = false;
        p.coyote = COYOTE;
        p.vy = 0;
      } else {
        p.y = top;
        p.groundY = top;
      }
    } else if (p.vy <= 0) {
      // land when the feet cross a top this step; a near miss within STEP_TOL
      // below the ledge counts too (a cat always finds the ledge)
      let top = -Infinity;
      for (const pl of level.platforms) {
        if (pl.x1 > p.x - FOOT && pl.x0 < p.x + FOOT && pl.top <= prevY + STEP_TOL && pl.top >= p.y) {
          top = Math.max(top, pl.top);
        }
      }
      if (top > -Infinity) {
        p.y = top;
        p.groundY = top;
        p.vy = 0;
        p.grounded = true;
        this.cat.onLand();
        this.sfx.land();
      }
    }

    // obstacles
    const cx0 = p.x - BODY + 0.05;
    const cx1 = p.x + BODY - 0.05;
    const cy0 = p.y + 0.06;
    const cy1 = p.y + 0.55;
    for (const o of level.obstacles) {
      if (Math.abs(o.x - p.x) > 2) continue;
      const ox0 = o.x - o.w / 2;
      const ox1 = o.x + o.w / 2;
      if (cx1 > ox0 && cx0 < ox1 && cy1 > o.y && cy0 < o.y + o.h) {
        this.die('hit');
        return;
      }
    }

    // sparks
    for (const s of this.world.sparks) {
      if (!s.alive) continue;
      const dx = s.x - p.x;
      const dy = s.group.position.y - (p.y + 0.38);
      if (dx * dx + dy * dy < 0.6 * 0.6) {
        this.world.collectSpark(s);
        p.sparks++;
        this.ui.setSparks(p.sparks);
        this.sfx.collect();
      }
    }

    // fell off the walk
    if (!p.grounded && p.y < -1.1) {
      p.groundY = STREET_Y;
      this.die('fall');
      return;
    }

    if (p.x >= level.goalX) this.clearStage();
  }

  runAutopilot(h) {
    const p = this.p;
    const level = this.level;
    if (!p.grounded) {
      p.autoHold -= h;
      this.input.held = p.autoHold > 0;
      return;
    }
    let hazard = Infinity;
    let hold = 0.45; // full jump unless a shorter hop is clearly enough
    const cur = level.platforms.find((pl) => pl.x1 > p.x - FOOT && pl.x0 < p.x + FOOT && Math.abs(pl.top - p.y) <= STEP_TOL);
    if (cur) {
      const next = level.platforms.find((pl) => pl.x0 >= cur.x1 - 0.01);
      const gapAhead = !next || next.x0 > cur.x1 + 0.01 || next.top > cur.top + STEP_TOL;
      if (gapAhead && next && next.x0 <= cur.x1 + 0.01) hazard = Math.min(hazard, cur.x1 - 1.7); // wall
      else if (gapAhead && next) {
        hazard = Math.min(hazard, cur.x1 - 0.3); // gap
        if (next.top <= cur.top) {
          // hop just far enough: ~1.9u with a tap, ~5.5u with a full hold
          const need = next.x0 - cur.x1 + 1.2;
          hold = clamp(((need - 1.9) / 3.6) * 0.45, 0.06, 0.45);
        }
      }
    }
    for (const o of level.obstacles) {
      const edge = o.x - o.w / 2;
      if (edge > p.x && o.y <= p.y + STEP_TOL + 0.01 && edge - 1.3 < hazard) {
        hazard = edge - 1.3;
        hold = 0.45;
      }
    }
    if (p.x >= hazard) {
      this.input.pressed = true;
      this.input.held = true;
      p.autoHold = hold;
    }
  }

  stepDead(h) {
    const p = this.p;
    p.deathT += h;
    p.vx = damp(p.vx, 0, 3, h);
    p.x += p.vx * h;
    if (!p.grounded) {
      p.vy -= GRAVITY * h;
      p.y += p.vy * h;
      if (p.deathKind === 'hit') p.rot -= 6 * h;
      const floor = p.deathKind === 'fall' ? STREET_Y : p.groundY;
      if (p.y <= floor) {
        p.y = floor;
        p.vy = 0;
        p.grounded = true;
        this.cat.onLand();
        this.sfx.land();
      }
    }
  }

  stepClear(h) {
    const p = this.p;
    p.clearT += h;
    p.vx = Math.max(0, p.vx - 7 * h);
    p.x += p.vx * h;
    if (!p.grounded) {
      p.vy -= GRAVITY * h;
      p.y += p.vy * h;
      if (p.y <= p.groundY) {
        p.y = p.groundY;
        p.vy = 0;
        p.grounded = true;
        this.cat.onLand();
      }
    }
  }

  /**
   * Headless check used by the test harness: runs the autopilot through the
   * stage without rendering and reports where it ended up.
   */
  simulate(maxSeconds = 240) {
    const wasAuto = this.autopilot;
    this.autopilot = true;
    this.resetRun();
    this.setState('run');
    let t = 0;
    const trace = [];
    let wasGrounded = true;
    while (this.state === 'run' && t < maxSeconds) {
      this.stepRun(STEP);
      t += STEP;
      if (this.p.grounded !== wasGrounded) {
        wasGrounded = this.p.grounded;
        trace.push(`${wasGrounded ? 'land' : 'jump'}@${this.p.x.toFixed(1)},${this.p.y.toFixed(2)}`);
      }
    }
    this.autopilot = wasAuto;
    const p = this.p;
    return { state: this.state, x: p.x, y: p.y, goal: this.level.goalX, kind: p.deathKind, sparks: p.sparks, time: p.runTime, trace };
  }

  // --- frame ---------------------------------------------------------------
  start() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  frame(dt) {
    this.t += dt;
    this.stateT += dt;
    const p = this.p;

    if (this.input.consumeMute()) {
      this.sfx.setMuted(!this.sfx.muted);
      this.ui.setMuted(this.sfx.muted);
    }

    // state transitions driven by "any press"
    if (this.state === 'title') {
      if (this.input.consumeAny()) this.startRun();
    } else if (this.state === 'dead') {
      if (this.stateT > 1.2 && this.input.consumeAny()) this.startRun();
      else if (this.stateT > 1.2 && !this.ui.el.gameover.classList.contains('visible')) {
        const pct = Math.round(clamp(p.x / this.level.goalX, 0, 1) * 100);
        this.ui.showGameOver(p.deathKind, `${pct}% of the way · ${p.sparks} sparks`);
      }
      this.input.consumeAny();
    } else if (this.state === 'clear') {
      if (this.stateT > 2.2 && !this.ui.el.clear.classList.contains('visible')) {
        this.ui.showClear(`${p.runTime.toFixed(1)}s · ${p.sparks} / ${this.world.sparks.length} sparks`);
      }
      if (this.stateT > 2.4 && this.input.consumeAny()) this.startRun();
      else this.input.consumeAny();
    } else {
      this.input.consumeAny();
    }

    // fixed-step simulation
    if (this.state === 'run' || this.state === 'dead' || this.state === 'clear') {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= STEP && guard++ < 12) {
        this.acc -= STEP;
        if (this.state === 'run') this.stepRun(STEP);
        else if (this.state === 'dead') this.stepDead(STEP);
        else if (this.state === 'clear') this.stepClear(STEP);
      }
      this.input.consumePress();
    } else {
      this.acc = 0;
    }

    if (this.state === 'run') this.ui.setProgress(p.x / this.level.goalX);

    // cat pose
    let mode = 'idle';
    if (this.state === 'run') mode = p.grounded ? 'run' : 'air';
    else if (this.state === 'dead') mode = p.deathKind === 'hit' ? 'dead' : p.grounded ? 'sit' : 'air';
    else if (this.state === 'clear') mode = p.vx > 0.3 ? (p.grounded ? 'run' : 'air') : 'sit';
    this.cat.group.position.set(p.x, p.y, 0);
    this.cat.group.rotation.z = p.rot;
    this.cat.update(dt, { mode, vy: p.vy, speed: Math.max(p.vx, 2), t: this.t });

    // camera
    this.updateCamera(dt);

    this.world.update(dt, p.x, p.y, this.camera.position.x);
    this.world.render();
  }

  updateCamera(dt) {
    const p = this.p;
    const c = this.cam;
    let tx, ty, tz, lookX, lookY;
    if (this.state === 'title') {
      tx = p.x + 1.4;
      ty = 2.6;
      tz = 7.8;
      lookX = p.x + 1.4;
      lookY = 0.55;
    } else if (this.state === 'clear') {
      tx = p.x + 1.0;
      ty = 2.4 + p.groundY * 0.5;
      tz = 7.2;
      lookX = p.x + 1.0;
      lookY = 0.5 + p.groundY * 0.5;
    } else if (this.state === 'dead') {
      tx = c.x;
      ty = c.y;
      tz = c.z;
      lookX = c.lookX;
      lookY = c.lookY;
    } else {
      tx = p.x + 3.0;
      ty = 3.9 + p.groundY * 0.5;
      tz = 11.0;
      lookX = p.x + 3.0;
      lookY = 0.65 + p.groundY * 0.5;
    }
    const kx = this.state === 'run' ? 30 : 3;
    c.x = damp(c.x, tx, kx, dt);
    c.y = damp(c.y, ty, 3, dt);
    c.z = damp(c.z, tz, 2.5, dt);
    c.lookX = damp(c.lookX, lookX, kx, dt);
    c.lookY = damp(c.lookY, lookY, 3, dt);
    this.camera.position.set(c.x, c.y, c.z);
    this.camera.lookAt(c.lookX, c.lookY, 0);
  }
}
