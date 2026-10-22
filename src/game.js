// Game flow (title → select → ready → run → dead | clear), fixed-step physics,
// camera, stage loading and the render loop.
import * as THREE from 'three';
import { Cat } from './cat.js';
import { buildLevel, resetCheckpoints, activateCheckpoint, resetBrittle, BRITTLE_DELAY } from './level.js';
import { World } from './world.js';
import { Input } from './input.js';
import { Sfx } from './audio.js';
import { UI } from './ui.js';
import { STAGES, stageById } from './stages.js';
import { streetTheme } from './themes/street.js';
import { shrineTheme } from './themes/shrine.js';
import { snowTheme } from './themes/snow.js';
import { harbourTheme } from './themes/harbour.js';
import { loadSave, storeSave, recordRun } from './save.js';
import { makeRng, glowTexture, mistTexture } from './textures.js';

const THEMES = { street: streetTheme, shrine: shrineTheme, snow: snowTheme, harbour: harbourTheme };

const STEP = 1 / 120;
const GRAVITY = 30;
const JUMP_V = 11.5;
const JUMP_CUT_V = 4.0;
const DIVE_V = -13;
const COYOTE = 0.1;
const BUFFER = 0.13;
const STEP_TOL = 0.35; // small ledges are climbed automatically; anything taller is a wall
const FOOT = 0.22; // half the foot span used for support
const BODY = 0.3; // half the body length used for obstacles/walls
const STAND_H = 0.55;
const SLIDE_H = 0.28;
const DIVE_H = 0.45;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class Game {
  constructor(container) {
    this.container = container;
    this.params = new URLSearchParams(location.search);
    this.autopilot = this.params.has('auto');
    this.autoMode = this.params.get('auto') === 'jump' ? 'jump' : 'slide'; // how the autopilot handles hanging obstacles
    this.hints = {};
    this.save = loadSave();

    this.input = new Input(container);
    this.quality = this.detectQuality();

    // --- renderer -------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(this.quality.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;
    this.safe = !!this.save.safe || this.params.has('safe');
    this.contextLost = false;
    // A lost WebGL context is the one thing that turns the canvas black mid-run.
    // Keep the page alive, pause the game, and come back in simple graphics.
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
      if (this.state === 'run') this.setState('paused');
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 0.75));
      this.resize();
      this.setSafeMode(true, 'graphics were reset — switched to simple graphics');
    });
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 160);

    this.sfx = new Sfx();
    this.sfx.muted = !!this.save.muted;
    this.ui = new UI();
    this.ui.setTouch(this.input.touch);
    this.ui.setMuted(this.sfx.muted);
    this.ui.setGfx(this.safe);
    this.ui.el.btnGfx.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget.blur();
      this.setSafeMode(!this.safe, this.safe ? 'rich graphics' : 'simple graphics');
    });
    this.input.onFirstInteraction = () => this.sfx.ensure();
    this.ui.onCard = (i) => {
      if (this.state !== 'select') return;
      this.selected = i;
      this.ui.setSelected(i);
      this.input.clearEdges();
      this.enterStage(STAGES[i].id);
    };
    // corner buttons must not keep keyboard focus, or Space (jump) re-presses them
    this.ui.el.btnSound.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget.blur();
      this.toggleMute();
    });
    this.ui.el.btnFull.addEventListener('click', (e) => {
      e.stopPropagation();
      e.currentTarget.blur();
      this.toggleFullscreen();
    });
    this.debug = this.params.has('debug');
    this.ui.showDebug(this.debug);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'run') this.setState('paused');
    });

    this.cat = new Cat();
    this.sharedTex = { glow: glowTexture(), mist: mistTexture() };
    this.sharedTex.shared = new Set([this.sharedTex.glow, this.sharedTex.mist]);

    // --- state ----------------------------------------------------------
    this.t = 0;
    this.acc = 0;
    this.last = performance.now();
    this.timeScale = 1;
    this.slowmo = 0;
    this.shake = 0;
    this.cam = { x: 0, y: 2.6, z: 7.8, lookY: 0.55, lookX: 0 };
    this.p = {};
    this.selected = 0;
    this.frameTimes = [];
    this.frameClock = 0;
    this.stage = null;
    this.world = null;

    const initial = Number(this.params.get('stage')) || STAGES[0].id;
    this.loadStage(initial);
    this.ui.buildCards(STAGES, this.save.records);
    this.setState(this.params.has('stage') ? 'ready' : 'title');
    if (this.state === 'ready') this.ui.fadeIn(false);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    window.__catwalk = this;
  }

  /**
   * Every tier starts at a conservative render resolution and only steps up when
   * frames are measured to be fast (see adaptResolution). Overloading the GPU
   * costs far more than a few pixels: a lost WebGL context is a black screen.
   */
  detectQuality() {
    const touch = this.input.touch;
    const small = Math.min(screen.width, screen.height) <= 600; // phones; tablets get the medium tier
    const forced = Number(this.params.get('pr'));
    const dpr = forced > 0 ? forced : window.devicePixelRatio || 1;
    if (touch && small) {
      return { tier: 'low', pixelRatio: Math.min(dpr, 1.0), maxPixelRatio: Math.min(dpr, 1.25), msaa: 2, bloomScale: 0.5, waterRes: 256, particles: 0.6, lights: 6, shadow: 1024 };
    }
    if (touch) {
      return { tier: 'medium', pixelRatio: Math.min(dpr, 1.0), maxPixelRatio: Math.min(dpr, 1.5), msaa: 2, bloomScale: 0.5, waterRes: 384, particles: 0.8, lights: 6, shadow: 1024 };
    }
    return { tier: 'high', pixelRatio: Math.min(dpr, 1.0), maxPixelRatio: Math.min(dpr, 1.5), msaa: 2, bloomScale: 0.5, waterRes: 512, particles: 1, lights: 6, shadow: 1024 };
  }

  /** Simple graphics: no post-processing, no multisampled HDR buffer. */
  setSafeMode(on, reason) {
    this.safe = on;
    this.save.safe = on;
    storeSave(this.save);
    this.ui.setGfx(on);
    if (reason) this.ui.toast(reason, 2600);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.updateFov();
    this.renderer.setSize(w, h);
    this.world?.resize();
  }

  /** Keep a steady horizontal field of view so portrait phones still see ahead. */
  updateFov(speedBoost = 0) {
    const hFov = THREE.MathUtils.degToRad(62 + speedBoost);
    const v = 2 * Math.atan(Math.tan(hFov / 2) / this.camera.aspect);
    this.camera.fov = clamp(THREE.MathUtils.radToDeg(v), 36, 96);
    this.camera.updateProjectionMatrix();
  }

  toggleMute() {
    this.sfx.ensure();
    this.sfx.setMuted(!this.sfx.muted);
    this.ui.setMuted(this.sfx.muted);
    this.save.muted = this.sfx.muted;
    storeSave(this.save);
  }

  toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  }

  // --- stage loading ----------------------------------------------------
  loadStage(id) {
    const stage = stageById(id);
    if (this.world) {
      this.scene.remove(this.cat.group);
      this.world.dispose();
    }
    this.stage = stage;
    this.theme = THEMES[stage.theme];
    this.scene = new THREE.Scene();
    const rng = makeRng(stage.seed);
    this.tex = { ...this.sharedTex, ...this.theme.makeTextures(rng) };
    this.level = buildLevel(this.scene, stage, this.theme, this.tex, rng);
    this.world = new World(this.scene, this.renderer, this.camera, this.level, this.theme, this.tex, rng, this.quality);
    this.world.sfx = this.sfx; // scenery that makes its own sounds (stage IV's fireworks) plays through it
    this.scene.add(this.cat.group);
    this.sfx.setAmbience(this.theme.ambience);
    this.ui.setTicks(this.level.checkpoints.map((cp) => cp.x / this.level.goalX));
    this.hints = {};
    this.resetRun(false);
    this.cam.x = this.p.x + 1.4;
    this.cam.lookX = this.cam.x;
  }

  controlsHint() {
    return this.input.touch
      ? 'tap right to jump · hold left to slide · hold for height'
      : '<kbd>space</kbd> jump · <kbd>↓</kbd> or right-click slide · hold to jump higher';
  }

  /** One-time, in-the-moment hints before the first gap and the first hanging obstacle. */
  maybeHint(p) {
    const level = this.level;
    if (!this.hints.hang) {
      const h = level.hangers.find((o) => o.x > p.x && o.x - p.x < 8.5);
      if (h) {
        this.hints.hang = true;
        this.ui.toast(
          this.input.touch
            ? 'something low ahead — hold the left side to slide under it, or hold jump to leap it'
            : 'something low ahead — hold ↓ to slide under it, or hold jump to leap it',
          1900
        );
      }
    }
    if (!this.hints.brittle) {
      const b = level.brittle.find((pl) => pl.x0 > p.x && pl.x0 - p.x < 9);
      if (b) {
        this.hints.brittle = true;
        this.ui.toast('old boards ahead — they give way a moment after you land: jump off them', 2200);
      }
    }
    if (!this.hints.gap) {
      const first = level.platforms[0];
      if (first.x1 - p.x < 5) {
        this.hints.gap = true;
        this.ui.toast(this.input.touch ? 'a gap — tap to jump, hold for distance' : 'a gap — jump, hold for distance', 1600);
      }
    }
  }

  enterStage(id) {
    this.ui.fadeOut(true);
    setTimeout(() => {
      if (this.stage.id !== id) this.loadStage(id);
      else this.resetRun(false);
      this.setState('ready');
      this.ui.fadeIn(true);
    }, 380);
    this.state = 'loading';
  }

  // --- run state ----------------------------------------------------------
  resetRun(fromCheckpoint) {
    const p = this.p;
    const cp = fromCheckpoint ? p.checkpoint : null;
    p.x = cp ? cp.x + 0.6 : this.level.startX;
    p.y = cp ? cp.top : 0;
    p.vy = 0;
    p.vx = 0;
    p.grounded = true;
    p.coyote = 0;
    p.buffer = 0;
    p.groundY = p.y;
    p.sliding = false;
    p.diving = false;
    p.forceSlide = 0;
    p.slideGrace = 0;
    p.deathKind = null;
    p.deathT = 0;
    p.rot = 0;
    p.autoHold = 0;
    resetBrittle(this.level);
    for (const o of this.level.hangers) o.passed = o.x < p.x;
    if (!fromCheckpoint) {
      p.sparks = 0;
      p.runTime = 0;
      p.deaths = 0;
      p.checkpoint = null;
      resetCheckpoints(this.level);
      this.world.resetSparks();
    }
    this.cat.reset();
    this.ui.setSparks(p.sparks, this.world.sparks.length);
    this.ui.setTime(p.runTime);
    this.ui.setProgress(p.x / this.level.goalX);
  }

  setState(s) {
    this.state = s;
    this.stateT = 0;
    this.input.clearEdges();
    if (s === 'title') {
      this.ui.showTitle();
      this.ui.fadeIn(false);
    } else if (s === 'select') {
      this.ui.buildCards(STAGES, this.save.records);
      this.ui.showSelect(this.selected);
    } else if (s === 'ready') {
      this.ui.showReady(this.stage, `${this.controlsHint()}<br><span class="go">press to run</span>`);
    } else if (s === 'run') {
      this.ui.showRun();
    } else if (s === 'paused') {
      this.ui.showPause(true);
      this.sfx.pause();
    }
  }

  startRun() {
    this.setState('run');
    this.sfx.start();
  }

  die(kind) {
    const p = this.p;
    p.deathKind = kind;
    p.deathT = 0;
    p.deaths++;
    p.sliding = false;
    p.vx = kind === 'hit' ? -1.6 : this.speedAt(p.x) * 0.5;
    if (kind === 'hit') {
      p.vy = 5.5;
      p.grounded = false;
      this.sfx.hit();
      this.shake = 0.45;
      this.slowmo = 0.5;
      this.world.puff(p.x, p.y, 8, 1.3);
    } else {
      this.sfx.fall();
      // drift on down into the gap, but not through the wall of the roof ahead
      const ahead = this.level.platforms.find((pl) => !pl.gone && pl.x0 > p.x - BODY);
      p.fallLimit = ahead ? ahead.x0 - BODY : Infinity;
    }
    this.setState('dead');
  }

  clearStage() {
    const p = this.p;
    p.vx = this.speedAt(p.x);
    p.sliding = false;
    const total = this.world.sparks.length;
    const rank = p.deaths === 0 && p.sparks === total ? 'S' : p.deaths === 0 ? 'A' : p.deaths <= 2 ? 'B' : 'C';
    const record = recordRun(this.save, this.stage.id, { time: p.runTime, sparks: p.sparks, sparksTotal: total, rank });
    this.result = { rank, time: p.runTime, sparks: p.sparks, total, deaths: p.deaths, record, hasNext: !!this.nextStage() };
    this.setState('clear');
    this.sfx.clear();
  }

  nextStage() {
    const i = STAGES.findIndex((s) => s.id === this.stage.id);
    return STAGES[i + 1] || null;
  }

  speedAt(x) {
    return this.stage.baseSpeed + this.stage.speedGain * clamp(x / this.level.goalX, 0, 1);
  }

  // --- physics (fixed step) ------------------------------------------------
  stepRun(h) {
    const p = this.p;
    const level = this.level;
    const input = this.input;
    p.runTime += h;
    const speed = this.speedAt(p.x);
    p.vx = speed;
    p.x += speed * h;

    if (this.autopilot) this.runAutopilot(h);
    else this.maybeHint(p);

    // slide / dive — the slide lingers briefly after release so letting go a
    // hair early under something low doesn't cost the run
    if (p.forceSlide > 0) p.forceSlide -= h;
    if (input.slideHeld) p.slideGrace = 0.15;
    else if (p.slideGrace > 0) p.slideGrace -= h;
    const wantSlide = input.slideHeld || p.forceSlide > 0 || p.slideGrace > 0;
    if (!p.grounded && input.consume('slide') && !p.diving) {
      p.diving = true;
      p.vy = Math.min(p.vy, DIVE_V);
      this.sfx.dive();
    }

    // jump
    if (input.consume('jump')) p.buffer = BUFFER;
    if (p.buffer > 0 && (p.grounded || p.coyote > 0)) {
      p.vy = JUMP_V;
      p.grounded = false;
      p.sliding = false;
      p.forceSlide = 0;
      p.coyote = 0;
      p.buffer = 0;
      this.cat.onJump();
      this.sfx.jump();
      this.world.puff(p.x - 0.2, p.y, 3, 0.6);
    } else if (p.buffer > 0) p.buffer -= h;
    if (!p.grounded && p.coyote > 0) p.coyote -= h;

    const prevY = p.y;
    if (!p.grounded) {
      if (!input.jumpHeld && p.vy > JUMP_CUT_V) p.vy = JUMP_CUT_V;
      p.vy -= GRAVITY * h;
      p.y += p.vy * h;
    }

    // old boards give way a moment after they are first stood on
    for (const pl of level.brittle) {
      if (pl.touchT === null || pl.gone) continue;
      pl.touchT += h;
      if (pl.touchT >= BRITTLE_DELAY) {
        pl.gone = true;
        this.sfx.crack();
        this.world.puff(Math.min(Math.max(p.x, pl.x0 + 0.5), pl.x1 - 0.5), pl.top, 8, 1.1);
      }
    }

    // walls: running face-first into the leading edge of a platform whose top is
    // well above the feet (only the leading edge counts)
    for (const pl of level.platforms) {
      if (pl.gone) continue;
      if (pl.top > p.y + STEP_TOL && pl.x0 < p.x + BODY && pl.x0 >= p.x - BODY) {
        p.x = pl.x0 - BODY - 0.02;
        p.groundY = Math.max(level.floorY, p.groundY);
        this.die('hit');
        return;
      }
    }

    // support
    if (p.grounded) {
      let top = -Infinity;
      for (const pl of level.platforms) {
        if (pl.gone) continue;
        if (pl.x1 > p.x - FOOT && pl.x0 < p.x + FOOT && Math.abs(pl.top - p.y) <= STEP_TOL) top = Math.max(top, pl.top);
      }
      if (top === -Infinity) {
        p.grounded = false;
        p.sliding = false;
        p.coyote = COYOTE;
        p.vy = 0;
      } else {
        p.y = top;
        p.groundY = top;
        this.touchBrittle(top);
      }
    } else if (p.vy <= 0) {
      // land when the feet cross a top this step; a near miss just below the ledge counts too
      let top = -Infinity;
      for (const pl of level.platforms) {
        if (pl.gone) continue;
        if (pl.x1 > p.x - FOOT && pl.x0 < p.x + FOOT && pl.top <= prevY + STEP_TOL && pl.top >= p.y) top = Math.max(top, pl.top);
      }
      if (top > -Infinity) {
        const impact = -p.vy;
        p.y = top;
        p.groundY = top;
        p.vy = 0;
        p.grounded = true;
        if (p.diving) {
          p.diving = false;
          p.forceSlide = 0.28;
          this.shake = Math.max(this.shake, 0.12);
        }
        this.cat.onLand();
        this.sfx.land(clamp(impact / 14, 0.3, 1.2));
        this.world.puff(p.x, p.y, impact > 11 ? 8 : 5, clamp(impact / 12, 0.6, 1.4));
        this.touchBrittle(top);
      }
    }

    // the slide state is resolved after landing so that touching down with slide
    // held ducks immediately (landing just before something low is survivable)
    if (p.grounded) {
      if (wantSlide && !p.sliding) this.sfx.slide();
      p.sliding = wantSlide;
    } else p.sliding = false;

    // obstacles (ground) and hanging obstacles
    const hb = p.sliding ? SLIDE_H : p.diving ? DIVE_H : STAND_H;
    const cx0 = p.x - BODY + 0.05;
    const cx1 = p.x + BODY - 0.05;
    const cy0 = p.y + 0.06;
    const cy1 = p.y + hb;
    for (const o of level.obstacles) {
      if (Math.abs(o.x - p.x) > 2) continue;
      if (cx1 > o.x - o.w / 2 && cx0 < o.x + o.w / 2 && cy1 > o.y && cy0 < o.y + o.h) {
        this.die('hit');
        return;
      }
    }
    for (const o of level.hangers) {
      if (Math.abs(o.x - p.x) > 2.5) continue;
      if (cx1 > o.x - o.w / 2 && cx0 < o.x + o.w / 2 && cy1 > o.y0 && cy0 < o.y1) {
        this.die('hit');
        return;
      }
      if (!o.passed && p.x >= o.x) {
        o.passed = true;
        this.theme.onPass?.(o, this.sfx);
      }
    }

    // sparks
    for (const s of this.world.sparks) {
      if (!s.alive || Math.abs(s.x - p.x) > 1) continue;
      const dx = s.x - p.x;
      const dy = s.group.position.y - (p.y + (p.sliding ? 0.2 : 0.38));
      if (dx * dx + dy * dy < 0.62 * 0.62) {
        this.world.collectSpark(s);
        p.sparks++;
        this.ui.setSparks(p.sparks);
        this.sfx.collect();
      }
    }

    // checkpoints
    for (const cp of level.checkpoints) {
      if (!cp.active && p.x >= cp.x) {
        activateCheckpoint(cp);
        p.checkpoint = cp;
        this.sfx.checkpoint();
        this.ui.toast('the lantern remembers you');
        this.world.puff(cp.x, cp.top + 1.3, 6, 0.9, this.theme.colors.cp);
      }
    }

    // fell off the walk
    if (!p.grounded && p.y < -1.1) {
      p.groundY = level.floorY;
      this.die('fall');
      return;
    }

    if (p.x >= level.goalX) this.clearStage();
  }

  /** Standing on boards starts their countdown (once). */
  touchBrittle(top) {
    const p = this.p;
    for (const pl of this.level.brittle) {
      if (pl.touchT !== null || pl.gone || Math.abs(pl.top - top) > 0.01) continue;
      if (pl.x1 > p.x - FOOT && pl.x0 < p.x + FOOT) {
        pl.touchT = 0;
        this.sfx.creak();
      }
    }
  }

  /** Seconds in the air for a jump held `hold` seconds that comes down `dy` above where it left. */
  airTime(hold, dy) {
    let t0 = 0;
    let y0 = 0;
    let v0 = JUMP_V;
    if (JUMP_V - GRAVITY * hold > JUMP_CUT_V) {
      // released while still rising fast: the jump is cut short
      t0 = hold;
      y0 = JUMP_V * hold - 0.5 * GRAVITY * hold * hold;
      v0 = JUMP_CUT_V;
    }
    const disc = v0 * v0 + 2 * GRAVITY * (y0 - dy);
    return disc < 0 ? 0 : t0 + (v0 + Math.sqrt(disc)) / GRAVITY;
  }

  /** The shortest hold that carries the cat `dist` forward, landing `dy` above the takeoff. */
  holdFor(dist, dy, speed) {
    for (let hold = 0.04; hold < 0.3; hold += 0.01) {
      if (this.airTime(hold, dy) * speed >= dist) return hold;
    }
    return 0.45;
  }

  runAutopilot(h) {
    const p = this.p;
    const level = this.level;
    const input = this.input;
    // 'slide' mode ducks under anything hanging close ahead; 'jump' mode never
    // slides and must clear every hanging obstacle with a jump instead
    let wantSlide = false;
    if (this.autoMode === 'slide') {
      for (const o of level.hangers) {
        if (p.x > o.x - o.w / 2 - 0.9 && p.x < o.x + o.w / 2 + 0.35) wantSlide = true;
      }
    }
    input.slideHeld = wantSlide;
    if (!p.grounded) {
      p.autoHold -= h;
      input.jumpHeld = p.autoHold > 0;
      return;
    }
    if (wantSlide) return;
    let hazard = Infinity;
    let hold = 0.45;
    const speed = this.speedAt(p.x);
    const cur = level.platforms.find(
      (pl) => !pl.gone && pl.x1 > p.x - FOOT && pl.x0 < p.x + FOOT && Math.abs(pl.top - p.y) <= STEP_TOL
    );
    if (cur) {
      const next = level.platforms.find((pl) => pl.x0 >= cur.x1 - 0.01);
      const gapAhead = !next || next.x0 > cur.x1 + 0.01 || next.top > cur.top + STEP_TOL;
      if (gapAhead && next && next.x0 <= cur.x1 + 0.01) hazard = Math.min(hazard, cur.x1 - 1.7); // wall
      else if (gapAhead && next) {
        hazard = Math.min(hazard, cur.x1 - 0.3); // gap: land about a body length in
        if (next.top <= cur.top) hold = this.holdFor(next.x0 - cur.x1 + 1.3, next.top - cur.top, speed);
      }
      if (cur.brittle && cur.touchT !== null && cur.touchT >= BRITTLE_DELAY - 0.15 && next) {
        // the boards are about to go: leave now, for wherever is next
        hazard = p.x;
        hold = next.top > cur.top ? 0.45 : this.holdFor(next.x0 - p.x + 1.0, next.top - cur.top, speed);
      }
    }
    for (const o of level.obstacles) {
      const edge = o.x - o.w / 2;
      if (edge > p.x && o.y <= p.y + STEP_TOL + 0.01 && edge - 1.3 < hazard) {
        hazard = edge - 1.3;
        hold = 0.45;
      }
    }
    if (this.autoMode === 'jump') {
      for (const o of level.hangers) {
        const edge = o.x - o.w / 2;
        if (edge > p.x && edge - 1.4 < hazard) {
          hazard = edge - 1.4;
          hold = 0.45;
        }
      }
    }
    if (p.x >= hazard) {
      input._edges.jump = true;
      input.jumpHeld = true;
      p.autoHold = hold;
    }
  }

  stepDead(h) {
    const p = this.p;
    p.deathT += h;
    p.vx = damp(p.vx, 0, 3, h);
    p.x += p.vx * h;
    if (p.deathKind === 'fall') p.x = Math.min(p.x, p.fallLimit);
    if (!p.grounded) {
      p.vy -= GRAVITY * h;
      p.y += p.vy * h;
      if (p.deathKind === 'hit') p.rot -= 6 * h;
      const floor = p.deathKind === 'fall' ? this.level.floorY + 0.1 : p.groundY;
      if (p.y <= floor) {
        p.y = floor;
        p.vy = 0;
        p.grounded = true;
        this.cat.onLand();
        const fx = this.theme.fallFx;
        if (p.deathKind === 'fall' && fx) {
          this.sfx[fx.sound]();
          this.world.puff(p.x, p.y, 10, 1.6, fx.color);
        } else {
          this.sfx.land();
          this.world.puff(p.x, p.y, 6, 1);
        }
      }
    }
  }

  stepClear(h) {
    const p = this.p;
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

  /** Headless check: runs the autopilot through a stage without rendering. mode: 'slide' | 'jump'. */
  simulate(stageId = this.stage.id, mode = 'slide', maxSeconds = 300) {
    if (this.stage.id !== stageId) this.loadStage(stageId);
    const wasAuto = this.autopilot;
    const wasMode = this.autoMode;
    this.autopilot = true;
    this.autoMode = mode;
    this.resetRun(false);
    this.setState('run');
    let t = 0;
    const trace = [];
    let wasGrounded = true;
    let wasSliding = false;
    while (this.state === 'run' && t < maxSeconds) {
      this.stepRun(STEP);
      t += STEP;
      const p = this.p;
      if (p.grounded !== wasGrounded) {
        wasGrounded = p.grounded;
        trace.push(`${wasGrounded ? 'land' : 'jump'}@${p.x.toFixed(1)},${p.y.toFixed(2)}`);
      }
      if (p.sliding !== wasSliding) {
        wasSliding = p.sliding;
        if (wasSliding) trace.push(`slide@${p.x.toFixed(1)}`);
      }
    }
    this.autopilot = wasAuto;
    this.autoMode = wasMode;
    const p = this.p;
    return { stage: stageId, mode, state: this.state, x: p.x, y: p.y, goal: this.level.goalX, kind: p.deathKind, sparks: p.sparks, total: this.world.sparks.length, time: p.runTime, trace };
  }

  // --- frame ---------------------------------------------------------------
  start() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.frame(dt, now);
    };
    requestAnimationFrame(loop);
  }

  /** ?debug: live numbers in the corner, for bug reports. */
  updateDebug(dt) {
    this.debugClock = (this.debugClock || 0) + dt;
    this.debugFrames = (this.debugFrames || 0) + 1;
    if (this.debugClock < 0.5) return;
    const fps = this.debugFrames / this.debugClock;
    this.debugClock = 0;
    this.debugFrames = 0;
    const r = this.renderer;
    const gl = r.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'n/a';
    this.ui.setDebug(
      [
        `${fps.toFixed(0)} fps · pr ${r.getPixelRatio()} · ${r.domElement.width}×${r.domElement.height}`,
        `${this.state} · stage ${this.stage.id} · x ${this.p.x.toFixed(1)} y ${this.p.y.toFixed(2)} · ${this.safe ? 'simple' : 'rich'}`,
        `calls ${r.info.render.calls} · tris ${r.info.render.triangles} · programs ${r.info.programs?.length ?? '?'}`,
        `${gpu}`,
        `ctx lost ${this.contextLost} · gl error ${gl.getError()}`,
      ].join('\n')
    );
  }

  /**
   * Resolution follows measured frame time: step down quickly when the device
   * cannot keep up, step up slowly (and only as far as the tier allows) when
   * frames are comfortably fast. Changes are rate-limited so they never flicker.
   */
  adaptResolution(dt) {
    this.frameTimes.push(dt);
    this.frameClock += dt;
    if (this.frameClock < 2.5) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    this.frameClock = 0;
    this.adaptCooldown = Math.max(0, (this.adaptCooldown || 0) - 2.5);
    if (this.adaptCooldown > 0) return;
    const pr = this.renderer.getPixelRatio();
    let next = pr;
    if (avg > 0.022 && pr > 0.75) next = Math.max(0.75, pr - 0.25);
    else if (avg < 0.009 && pr < this.quality.maxPixelRatio) next = Math.min(this.quality.maxPixelRatio, pr + 0.25);
    if (next !== pr) {
      this.renderer.setPixelRatio(next);
      this.resize();
      this.adaptCooldown = 8;
    }
  }

  frame(dt, now) {
    this.t += dt;
    this.stateT += dt;
    const p = this.p;
    const input = this.input;
    // Render resolution is fixed for the session: re-allocating the render
    // targets mid-run is exactly the kind of thing that blanks a real GPU's
    // canvas without an error. Opt back in with ?adapt.
    if (this.state === 'run' && this.params.has('adapt')) this.adaptResolution(dt);
    if (this.debug) this.updateDebug(dt);

    if (input.consume('mute')) this.toggleMute();
    if (input.consume('gfx')) this.setSafeMode(!this.safe, this.safe ? 'rich graphics' : 'simple graphics');

    // --- flow ---------------------------------------------------------------
    switch (this.state) {
      case 'title':
        if (input.consume('any')) {
          this.sfx.tick();
          this.setState('select');
        }
        break;
      case 'select': {
        if (input.consume('left')) {
          this.selected = (this.selected + STAGES.length - 1) % STAGES.length;
          this.ui.setSelected(this.selected);
          this.sfx.tick();
        }
        if (input.consume('right')) {
          this.selected = (this.selected + 1) % STAGES.length;
          this.ui.setSelected(this.selected);
          this.sfx.tick();
        }
        if (input.consume('back')) this.setState('title');
        else if (input.consume('confirm')) this.enterStage(STAGES[this.selected].id);
        break;
      }
      case 'ready':
        if (input.consume('back')) this.setState('select');
        else if (input.consume('any')) this.startRun();
        break;
      case 'run':
        if (input.consume('pause') || input.consume('back')) this.setState('paused');
        else if (input.consume('restart')) {
          this.resetRun(false);
          this.setState('ready');
        }
        break;
      case 'paused':
        if (input.consume('back')) {
          this.ui.showPause(false);
          this.resetRun(false);
          this.setState('select');
        } else if (input.consume('confirm') || input.consume('pause')) {
          this.ui.showPause(false);
          this.state = 'run';
          this.input.clearEdges();
        }
        break;
      case 'dead': {
        const shown = this.ui.el.gameover.classList.contains('visible');
        if (this.stateT > 1.1 && !shown) {
          const pct = Math.round(clamp(p.x / this.level.goalX, 0, 1) * 100);
          this.ui.showGameOver(p.deathKind, `${pct}% of the way · ${p.sparks} sparks`, !!p.checkpoint);
        }
        if (shown) {
          if (input.consume('back')) {
            this.resetRun(false);
            this.setState('select');
          } else if (input.consume('restart')) {
            this.resetRun(false);
            this.setState('ready');
          } else if (input.consume('any')) {
            this.resetRun(!!p.checkpoint);
            this.ui.fadeIn(true);
            this.startRun();
          }
        }
        break;
      }
      case 'clear': {
        const shown = this.ui.el.clear.classList.contains('visible');
        if (this.stateT > 2.2 && !shown) this.ui.showClear(this.result);
        if (shown) {
          if (input.consume('back')) {
            this.resetRun(false);
            this.setState('select');
          } else if (input.consume('any')) {
            const next = this.nextStage();
            if (next) {
              this.selected = STAGES.indexOf(next);
              this.enterStage(next.id);
            } else this.enterStage(this.stage.id);
          }
        }
        break;
      }
      default:
        break;
    }

    // --- simulation --------------------------------------------------------
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      this.timeScale = damp(this.timeScale, 0.3, 14, dt);
    } else this.timeScale = damp(this.timeScale, 1, 6, dt);
    const sdt = dt * this.timeScale;

    if (this.state === 'run' || this.state === 'dead' || this.state === 'clear') {
      this.acc += sdt;
      let guard = 0;
      while (this.acc >= STEP && guard++ < 12) {
        this.acc -= STEP;
        if (this.state === 'run') this.stepRun(STEP);
        else if (this.state === 'dead') this.stepDead(STEP);
        else if (this.state === 'clear') this.stepClear(STEP);
      }
    } else this.acc = 0;
    // one-shot presses live for exactly one frame (the physics above consumes jump/slide)
    input.clearEdges();

    if (this.state === 'run') {
      this.ui.setProgress(p.x / this.level.goalX);
      this.ui.setTime(p.runTime);
    }

    // --- cat pose ---------------------------------------------------------
    let mode = 'idle';
    if (this.state === 'run' || this.state === 'paused') {
      mode = p.grounded ? (p.sliding ? 'slide' : 'run') : p.diving ? 'dive' : 'air';
    } else if (this.state === 'dead') mode = p.deathKind === 'hit' ? 'dead' : p.grounded ? 'sit' : 'air';
    else if (this.state === 'clear') mode = p.vx > 0.3 ? (p.grounded ? 'run' : 'air') : 'sit';
    this.cat.group.position.set(p.x, p.y, 0);
    this.cat.group.rotation.z = p.rot;
    const animDt = this.state === 'paused' ? 0 : sdt;
    this.cat.update(animDt, { mode, vy: p.vy, speed: Math.max(p.vx, 2), t: this.t });

    this.updateCamera(dt);
    this.world.update(this.state === 'paused' ? 0 : sdt, p.x, p.y, this.camera.position.x);
    if (!this.contextLost) this.world.render(this.safe);
  }

  updateCamera(dt) {
    const p = this.p;
    const c = this.cam;
    let tx, ty, tz, lookX, lookY;
    const gy = p.groundY * 0.5;
    if (this.state === 'title' || this.state === 'ready' || this.state === 'select' || this.state === 'loading') {
      tx = p.x + 1.4;
      ty = 2.6 + gy;
      tz = 7.8;
      lookX = p.x + 1.4;
      lookY = 0.55 + gy;
    } else if (this.state === 'clear') {
      tx = p.x + 1.0;
      ty = 2.4 + gy;
      tz = 7.2;
      lookX = p.x + 1.0;
      lookY = 0.5 + gy;
    } else if (this.state === 'dead') {
      tx = c.x;
      ty = c.y;
      tz = c.z;
      lookX = c.lookX;
      lookY = c.lookY;
    } else {
      tx = p.x + 3.0;
      ty = 3.9 + gy;
      tz = 11.0;
      lookX = p.x + 3.0;
      lookY = 0.65 + gy;
    }
    const kx = this.state === 'run' || this.state === 'paused' ? 30 : 3;
    c.x = damp(c.x, tx, kx, dt);
    c.y = damp(c.y, ty, 3, dt);
    c.z = damp(c.z, tz, 2.5, dt);
    c.lookX = damp(c.lookX, lookX, kx, dt);
    c.lookY = damp(c.lookY, lookY, 3, dt);

    this.shake = Math.max(0, this.shake - dt * 1.4);
    const sx = (Math.random() - 0.5) * this.shake * 0.5;
    const sy = (Math.random() - 0.5) * this.shake * 0.5;
    if (!Number.isFinite(c.x + c.y + c.z + c.lookX + c.lookY)) {
      // a NaN camera draws nothing at all; snap back to the target instead
      console.warn('camera reset');
      c.x = tx;
      c.y = ty;
      c.z = tz;
      c.lookX = lookX;
      c.lookY = lookY;
    }
    this.camera.position.set(c.x + sx, c.y + sy, c.z);
    this.camera.lookAt(c.lookX + sx, c.lookY + sy, 0);

    const boost = this.state === 'run' ? (p.vx - 7) * 1.1 : 0;
    this.updateFov(boost);
  }
}
