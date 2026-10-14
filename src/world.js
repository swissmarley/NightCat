// Shared scene engine: lights (a pool of real point lights handed to the nearest
// fixtures), sky, sparks, dust puffs, and post-processing. Stage-specific
// dressing lives in themes/*.js.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

const VignetteGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 0.55 },
    grain: { value: 0.035 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float time; uniform float vignette; uniform float grain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = 1.0 - vignette * smoothstep(0.2, 1.0, dot(d, d) * 2.2);
      float g = (hash(vUv * vec2(1931.0, 1087.0) + fract(time)) - 0.5) * grain;
      gl_FragColor = vec4(c.rgb * v + g, c.a);
    }
  `,
};

export class World {
  constructor(scene, renderer, camera, level, theme, tex, rng, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.level = level;
    this.theme = theme;
    this.tex = tex;
    this.rng = rng;
    this.quality = quality;
    this.t = 0;
    this.fixtures = [...level.fixtures];
    this.themeState = null;

    const c = theme.colors;
    scene.background = new THREE.Color(c.bg);
    scene.fog = new THREE.Fog(c.fog, c.fogNear, c.fogFar);

    this.buildLights();
    this.buildSky();
    theme.dress(this);
    this.buildSparks();
    this.buildDust();
    this.buildPost();
  }

  // --- lighting -------------------------------------------------------------
  buildLights() {
    const s = this.scene;
    const c = this.theme.colors;
    s.add(new THREE.HemisphereLight(c.hemiSky, c.hemiGround, c.hemiInt));

    // Moonlight — the one shadow-casting light; its frustum follows the cat.
    const moon = new THREE.DirectionalLight(c.moon, c.moonInt);
    moon.castShadow = true;
    moon.shadow.mapSize.set(this.quality.shadow, this.quality.shadow);
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 50;
    moon.shadow.camera.left = -9;
    moon.shadow.camera.right = 9;
    moon.shadow.camera.top = 9;
    moon.shadow.camera.bottom = -9;
    moon.shadow.bias = -0.0006;
    moon.shadow.normalBias = 0.02;
    moon.shadow.radius = 3;
    s.add(moon);
    s.add(moon.target);
    this.moon = moon;

    // Soft fill that follows the cat so it always reads against the dark.
    this.catFill = new THREE.PointLight(c.fill, 5.5, 7, 2);
    s.add(this.catFill);

    this.pool = [];
    for (let i = 0; i < this.quality.lights; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 16, 2);
      s.add(l);
      this.pool.push(l);
    }
  }

  // --- sky ---------------------------------------------------------------------
  buildSky() {
    const c = this.theme.colors;
    this.sky = new THREE.Group();
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 190),
      new THREE.ShaderMaterial({
        uniforms: {
          top: { value: new THREE.Vector3(...c.skyTop) },
          mid: { value: new THREE.Vector3(...c.skyMid) },
          hor: { value: new THREE.Vector3(...c.skyHor) },
        },
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top; uniform vec3 mid; uniform vec3 hor;
          varying vec2 vUv;
          void main(){
            float h = vUv.y;
            vec3 col = mix(hor, mid, smoothstep(0.18, 0.42, h));
            col = mix(col, top, smoothstep(0.42, 0.95, h));
            gl_FragColor = vec4(col, 1.0);
          }`,
      })
    );
    backdrop.position.set(0, 40, -95);
    this.sky.add(backdrop);

    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(c.moonSize, 40),
      new THREE.MeshBasicMaterial({ color: 0xe9ecff, fog: false })
    );
    moon.position.set(...c.moonPos);
    this.sky.add(moon);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.tex.glow,
        color: c.moonHalo,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    halo.position.copy(moon.position);
    halo.position.z += 0.5;
    halo.scale.set(c.moonSize * 9.5, c.moonSize * 9.5, 1);
    this.sky.add(halo);

    const n = c.starCount;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (this.rng() - 0.5) * 380;
      pos[i * 3 + 1] = 12 + Math.pow(this.rng(), 0.6) * 110;
      pos[i * 3 + 2] = -93;
      const b = 0.35 + this.rng() * 0.65;
      const warm = this.rng() < 0.3;
      col[i * 3] = b * (warm ? 1 : 0.85);
      col[i * 3 + 1] = b * 0.9;
      col[i * 3 + 2] = b * (warm ? 0.8 : 1);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.sky.add(
      new THREE.Points(
        sg,
        new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.9, fog: false, depthWrite: false })
      )
    );
    this.scene.add(this.sky);
  }

  // --- sparks (collectibles) ------------------------------------------------------------
  buildSparks() {
    const col = this.theme.colors.spark;
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x223344, emissive: col, emissiveIntensity: 2.0 });
    const geo = new THREE.SphereGeometry(0.07, 10, 8);
    this.sparks = [];
    for (const s of this.level.sparks) {
      const g = new THREE.Group();
      g.position.set(s.x, s.y, 0);
      g.add(new THREE.Mesh(geo, coreMat));
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.tex.glow,
          color: col,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      glow.scale.set(0.9, 0.9, 1);
      g.add(glow);
      this.scene.add(g);
      this.sparks.push({ x: s.x, y: s.y, group: g, glow, alive: true, burst: 0, phase: this.rng() * 6.28 });
    }
  }

  resetSparks(fromX = -Infinity) {
    for (const s of this.sparks) {
      if (s.x < fromX) continue;
      s.alive = true;
      s.burst = 0;
      s.group.visible = true;
      s.group.scale.set(1, 1, 1);
      s.glow.material.opacity = 0.4;
    }
  }

  collectSpark(s) {
    s.alive = false;
    s.burst = 0.001;
  }

  // --- dust puffs ------------------------------------------------------------------------
  buildDust() {
    this.dust = [];
    const mat = new THREE.SpriteMaterial({
      map: this.tex.mist,
      color: this.theme.colors.puff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (let i = 0; i < 28; i++) {
      const sp = new THREE.Sprite(mat.clone());
      sp.visible = false;
      this.scene.add(sp);
      this.dust.push({ sp, life: 0, max: 1, vx: 0, vy: 0, grow: 1 });
    }
  }

  /** Burst `n` soft puffs at (x, y). strength scales size/speed; color overrides the theme tint. */
  puff(x, y, n = 6, strength = 1, color = null) {
    let spawned = 0;
    for (const d of this.dust) {
      if (d.life > 0) continue;
      d.life = d.max = 0.45 + this.rng() * 0.3;
      d.vx = (this.rng() - 0.5) * 2.2 * strength;
      d.vy = (0.4 + this.rng() * 1.2) * strength;
      d.grow = (0.6 + this.rng() * 0.5) * strength;
      d.sp.position.set(x + (this.rng() - 0.5) * 0.5, y + 0.05 + this.rng() * 0.1, 0.3 + this.rng() * 0.4);
      d.sp.scale.set(0.3, 0.2, 1);
      d.sp.material.color.setHex(color ?? this.theme.colors.puff);
      d.sp.material.opacity = 0.35;
      d.sp.visible = true;
      if (++spawned >= n) break;
    }
  }

  // --- post-processing ---------------------------------------------------------------------
  buildPost() {
    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    const pr = r.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, {
      type: THREE.HalfFloatType,
      samples: this.quality.msaa,
    });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bs = this.quality.bloomScale;
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x * bs, size.y * bs), 0.75, 0.6, 0.92);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(VignetteGrainShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  resize(w, h) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    const bs = this.quality.bloomScale;
    this.bloom.setSize(w * bs, h * bs);
  }

  render() {
    this.composer.render();
  }

  // --- per-frame -----------------------------------------------------------------------------
  update(dt, catX, catY, camX) {
    this.t += dt;
    const t = this.t;
    this.grade.uniforms.time.value = t;

    this.sky.position.x = camX;
    this.moon.position.set(catX - 8, 16, 10);
    this.moon.target.position.set(catX, 0, 0);
    this.catFill.position.set(catX + 0.6, catY + 1.5, 1.8);

    // hand the real lights to the fixtures nearest the cat
    const near = [];
    for (const f of this.fixtures) {
      if (f.intensity <= 0) continue;
      const d = Math.abs(f.x - catX);
      if (d < 34) near.push({ f, d });
    }
    near.sort((a, b) => a.d - b.d);
    for (let i = 0; i < this.pool.length; i++) {
      const light = this.pool[i];
      const e = near[i];
      if (!e) {
        light.intensity = 0;
        continue;
      }
      const f = e.f;
      light.position.set(f.x, f.y, f.z);
      light.color.setHex(f.color);
      light.distance = f.distance || 16;
      const flicker = f.flicker ? 1 + 0.035 * Math.sin(t * 17 + f.x) * Math.sin(t * 5.3 + f.x * 0.7) : 1;
      light.intensity = f.intensity * smoothstep(30, 18, e.d) * flicker;
    }

    this.theme.update(this, dt, t, catX, camX);

    for (const s of this.sparks) {
      if (Math.abs(s.x - catX) > 40) continue;
      if (s.alive) {
        s.group.position.y = s.y + 0.12 * Math.sin(t * 2.6 + s.phase);
        s.glow.scale.setScalar(0.9 + 0.15 * Math.sin(t * 5 + s.phase));
      } else if (s.burst > 0) {
        s.burst += dt;
        const u = s.burst / 0.35;
        if (u >= 1) {
          s.burst = 0;
          s.group.visible = false;
        } else {
          s.group.scale.setScalar(1 + u * 2.5);
          s.glow.material.opacity = 0.4 * (1 - u);
        }
      }
    }

    for (const cp of this.level.checkpoints) {
      if (!cp.active) continue;
      cp.glow.material.opacity = 0.45 + 0.1 * Math.sin(t * 3);
    }

    for (const d of this.dust) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) {
        d.sp.visible = false;
        continue;
      }
      const u = 1 - d.life / d.max;
      d.sp.position.x += d.vx * dt;
      d.sp.position.y += d.vy * dt;
      d.vy -= 1.2 * dt;
      const sc = 0.3 + u * d.grow;
      d.sp.scale.set(sc * 1.4, sc * 0.9, 1);
      d.sp.material.opacity = 0.35 * (1 - u) * (1 - u);
    }
  }

  dispose() {
    this.theme.dispose(this);
    this.composer.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        for (const k of ['map', 'emissiveMap', 'roughnessMap', 'normalMap', 'alphaMap']) {
          if (m[k] && m[k].dispose && !this.tex.shared.has(m[k])) m[k].dispose();
        }
        m.dispose();
      }
    });
  }
}
