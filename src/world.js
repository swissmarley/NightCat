// Scene dressing: sky, street, buildings, lamps, lanterns, rain, lights & post-processing.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { STREET_Y } from './level.js';
import { windowTexture } from './textures.js';

const LAMP_LIGHTS = 6;
const LANTERN_LIGHTS = 3;
// three.js uses physical light units: point lights in candela, so values look large.
const LAMP_INTENSITY = 42;
const LANTERN_INTENSITY = 9;
const RAIN_COUNT = 650;

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
  constructor(scene, renderer, camera, level, tex, rng) {
    this.scene = scene;
    this.renderer = renderer;
    this.camera = camera;
    this.level = level;
    this.tex = tex;
    this.rng = rng;
    this.t = 0;

    scene.background = new THREE.Color(0x06070f);
    scene.fog = new THREE.Fog(0x080a16, 14, 52);

    this.buildLights();
    this.buildSky();
    this.buildStreet();
    this.buildBuildings();
    this.buildLamps();
    this.buildLanterns();
    this.buildSparks();
    this.buildRain();
    this.buildPost();
  }

  // --- lighting -------------------------------------------------------------
  buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0x2b3a6a, 0x160e0a, 1.5));

    // Moonlight — the one shadow-casting light; its frustum follows the cat.
    const moon = new THREE.DirectionalLight(0x7c8fd0, 3.6);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
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
    this.catFill = new THREE.PointLight(0x8fb0ff, 5.5, 7, 2);
    s.add(this.catFill);

    this.lampLights = [];
    for (let i = 0; i < LAMP_LIGHTS; i++) {
      const l = new THREE.PointLight(0xffb978, 0, 17, 2);
      s.add(l);
      this.lampLights.push(l);
    }
    this.lanternLights = [];
    for (let i = 0; i < LANTERN_LIGHTS; i++) {
      const l = new THREE.PointLight(0xff7a4a, 0, 9, 2);
      s.add(l);
      this.lanternLights.push(l);
    }
    this.homeLight = new THREE.PointLight(0xffc27a, 9, 11, 2);
    const hl = this.level.homeLight;
    this.homeLight.position.set(hl.x, hl.y, hl.z);
    s.add(this.homeLight);
  }

  // --- sky ---------------------------------------------------------------------
  buildSky() {
    this.sky = new THREE.Group();
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 190),
      new THREE.ShaderMaterial({
        uniforms: {},
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          void main(){
            vec3 top = vec3(0.012, 0.014, 0.045);
            vec3 mid = vec3(0.05, 0.045, 0.12);
            vec3 hor = vec3(0.16, 0.09, 0.13);
            float h = vUv.y;
            vec3 c = mix(hor, mid, smoothstep(0.18, 0.42, h));
            c = mix(c, top, smoothstep(0.42, 0.95, h));
            gl_FragColor = vec4(c, 1.0);
          }`,
      })
    );
    backdrop.position.set(0, 40, -95);
    this.sky.add(backdrop);

    // moon
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe9ecff, fog: false });
    const moon = new THREE.Mesh(new THREE.CircleGeometry(3.6, 40), moonMat);
    moon.position.set(28, 42, -92);
    this.sky.add(moon);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.tex.glow,
        color: 0x9fb0ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    halo.position.copy(moon.position);
    halo.position.z += 0.5;
    halo.scale.set(34, 34, 1);
    this.sky.add(halo);

    // stars
    const n = 420;
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
    const stars = new THREE.Points(
      sg,
      new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.9, fog: false, depthWrite: false })
    );
    this.sky.add(stars);
    this.scene.add(this.sky);
  }

  // --- street ------------------------------------------------------------------
  buildStreet() {
    const { map, roughnessMap } = this.tex.asphalt;
    map.repeat.set(140, 10);
    roughnessMap.repeat.set(140, 10);
    const mat = new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      roughness: 1,
      metalness: 0.05,
      color: 0x9a9aa6,
    });
    const len = this.level.endX + 160;
    const street = new THREE.Mesh(new THREE.PlaneGeometry(len, 36), mat);
    street.rotation.x = -Math.PI / 2;
    street.position.set(len / 2 - 60, STREET_Y, -6);
    street.receiveShadow = true;
    this.scene.add(street);

    // kerb in front of the walls
    const kerb = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.18, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.7 })
    );
    kerb.position.set(len / 2 - 60, STREET_Y + 0.09, 1.6);
    kerb.receiveShadow = true;
    this.scene.add(kerb);
  }

  // --- buildings ----------------------------------------------------------------
  buildBuildings() {
    const rng = this.rng;
    const group = new THREE.Group();
    const from = -50;
    const to = this.level.endX + 90;
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

        // rooftop details
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

    row(-9.5, 6, 6, 12, 5.5, 11, 0.34, 1.0, 12); // near row
    row(-19, 8, 8, 16, 10, 22, 0.26, 0.6, 9); // mid row
    row(-34, 10, 10, 22, 14, 32, 0.16, 0.35, 7); // far silhouettes
    this.scene.add(group);
  }

  // --- street lamps -----------------------------------------------------------------
  buildLamps() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x1a1b22, roughness: 0.55, metalness: 0.5 });
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
    const glowMat = new THREE.SpriteMaterial({
      map: this.tex.glow,
      color: 0xffb060,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.lamps = [];
    for (const l of this.level.lamps) {
      const g = new THREE.Group();
      const z = -1.9;
      g.position.set(l.x, STREET_Y, z);
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
      const glow = new THREE.Sprite(glowMat);
      glow.position.set(0, headY, headZ);
      glow.scale.set(2.6, 2.6, 1);
      g.add(glow);
      this.scene.add(g);
      this.lamps.push({ x: l.x, y: STREET_Y + headY, z: z + headZ, glow });
    }
  }

  // --- paper lanterns ------------------------------------------------------------------
  buildLanterns() {
    const colors = [0xff5a3a, 0xff8a3a, 0xff4a5a, 0xffb05a];
    const geo = new THREE.SphereGeometry(0.17, 14, 12);
    const capGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.8 });
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0c0c10, transparent: true, opacity: 0.6 });
    this.lanternStrings = [];
    for (const s of this.level.lanternStrings) {
      const g = new THREE.Group();
      const items = [];
      const pts = [];
      const width = (s.n - 1) * 1.15;
      for (let i = 0; i < s.n; i++) {
        const x = s.x0 + i * 1.15;
        const u = s.n > 1 ? i / (s.n - 1) : 0.5;
        const sag = s.goal ? 0 : 0.35 * Math.sin(u * Math.PI);
        const y = s.y - sag;
        const col = colors[Math.floor(this.rng() * colors.length)];
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
        str.position.y = -0.05 + 0.2;
        pivot.add(str);
        g.add(pivot);
        items.push({ pivot, phase: this.rng() * 6.28, color: col });
        pts.push(new THREE.Vector3(x, y + 0.3, s.z));
      }
      if (s.n > 1) {
        pts.unshift(new THREE.Vector3(s.x0 - 0.8, s.y + 0.45, s.z));
        pts.push(new THREE.Vector3(s.x0 + width + 0.8, s.y + 0.45, s.z));
        g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
      }
      this.scene.add(g);
      this.lanternStrings.push({ x: s.x0 + width / 2, y: s.y - 0.3, z: s.z, items, color: items[0].color });
    }
  }

  // --- sparks (collectibles) ------------------------------------------------------------
  buildSparks() {
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0xcfe9ff, emissiveIntensity: 2.0 });
    const geo = new THREE.SphereGeometry(0.07, 10, 8);
    const glowMat = new THREE.SpriteMaterial({
      map: this.tex.glow,
      color: 0x9fd0ff,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sparks = [];
    for (const s of this.level.sparks) {
      const g = new THREE.Group();
      g.position.set(s.x, s.y, 0);
      const core = new THREE.Mesh(geo, coreMat);
      g.add(core);
      const glow = new THREE.Sprite(glowMat.clone());
      glow.scale.set(0.9, 0.9, 1);
      g.add(glow);
      this.scene.add(g);
      this.sparks.push({ x: s.x, y: s.y, group: g, glow, alive: true, burst: 0, phase: this.rng() * 6.28 });
    }
  }

  resetSparks() {
    for (const s of this.sparks) {
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

  // --- rain -----------------------------------------------------------------------------
  buildRain() {
    const pos = new Float32Array(RAIN_COUNT * 2 * 3);
    this.rainVel = new Float32Array(RAIN_COUNT);
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainVel[i] = 9 + this.rng() * 4;
      this.seedDrop(pos, i, 0, true);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: 0x8d9bc2, transparent: true, opacity: 0.2, depthWrite: false })
    );
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);
  }
  seedDrop(pos, i, camX, randomY) {
    const x = camX + (this.rng() - 0.5) * 60;
    const y = randomY ? -4 + this.rng() * 20 : 14 + this.rng() * 3;
    const z = -14 + this.rng() * 24;
    const len = 0.25 + this.rng() * 0.2;
    pos[i * 6] = x;
    pos[i * 6 + 1] = y;
    pos[i * 6 + 2] = z;
    pos[i * 6 + 3] = x - 0.06;
    pos[i * 6 + 4] = y + len;
    pos[i * 6 + 5] = z;
  }

  // --- post-processing ---------------------------------------------------------------------
  buildPost() {
    const r = this.renderer;
    const size = r.getSize(new THREE.Vector2());
    const pr = r.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(r, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.75, 0.6, 0.92);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(VignetteGrainShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  resize(w, h) {
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
  }

  render() {
    this.composer.render();
  }

  // --- per-frame -----------------------------------------------------------------------------
  update(dt, catX, catY, camX) {
    this.t += dt;
    const t = this.t;
    this.grade.uniforms.time.value = t;

    // sky follows the camera horizontally
    this.sky.position.x = camX;

    // moon shadow frustum follows the cat
    this.moon.position.set(catX - 8, 16, 10);
    this.moon.target.position.set(catX, 0, 0);
    this.catFill.position.set(catX + 0.6, catY + 1.5, 1.8);

    // nearest lamps get the real point lights
    const lamps = this.lamps
      .map((l) => ({ l, d: Math.abs(l.x - catX) }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < LAMP_LIGHTS; i++) {
      const light = this.lampLights[i];
      const e = lamps[i];
      if (!e) {
        light.intensity = 0;
        continue;
      }
      light.position.set(e.l.x, e.l.y, e.l.z);
      const flicker = 1 + 0.035 * Math.sin(t * 17 + e.l.x) * Math.sin(t * 5.3 + e.l.x * 0.7);
      light.intensity = LAMP_INTENSITY * smoothstep(30, 18, e.d) * flicker;
    }
    for (const e of lamps) {
      const f = 1 + 0.08 * Math.sin(t * 11 + e.l.x) * Math.sin(t * 3.7 + e.l.x * 1.3);
      e.l.glow.material.opacity = 0.6 * f;
    }

    // lanterns sway; nearest strings get lights
    const strings = this.lanternStrings
      .map((s) => ({ s, d: Math.abs(s.x - catX) }))
      .sort((a, b) => a.d - b.d);
    for (let i = 0; i < LANTERN_LIGHTS; i++) {
      const light = this.lanternLights[i];
      const e = strings[i];
      if (!e) {
        light.intensity = 0;
        continue;
      }
      light.position.set(e.s.x, e.s.y, e.s.z + 0.3);
      light.color.setHex(e.s.color);
      light.intensity = LANTERN_INTENSITY * smoothstep(26, 14, e.d);
    }
    for (const e of strings) {
      if (e.d > 40) continue;
      for (const it of e.s.items) {
        it.pivot.rotation.z = 0.07 * Math.sin(t * 1.3 + it.phase);
        it.pivot.rotation.x = 0.05 * Math.sin(t * 0.9 + it.phase * 1.7);
      }
    }

    // sparks bob & burst
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

    // rain
    const pos = this.rain.geometry.attributes.position.array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const dy = this.rainVel[i] * dt;
      const dx = -1.2 * dt;
      pos[i * 6] += dx;
      pos[i * 6 + 3] += dx;
      pos[i * 6 + 1] -= dy;
      pos[i * 6 + 4] -= dy;
      if (pos[i * 6 + 1] < STREET_Y) this.seedDrop(pos, i, camX, false);
      else if (Math.abs(pos[i * 6] - camX) > 32) pos[i * 6] = pos[i * 6 + 3] = camX + (this.rng() - 0.5) * 60;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
}
