// Tiny WebAudio synth: ambience beds (rain / mountain night / snow / harbour / garden / desert town / night train / monastery) and one-shot sounds. No samples.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.amb = null; // current ambience nodes
    this.ambKind = null;
    this.ambTimer = null;
    this.wantAmbience = 'rain';
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    this.setAmbience(this.wantAmbience);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  _noiseBuffer(seconds) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** Switch the ambience bed: 'rain' (stage I), 'night' (stage II), 'snow' (stage III), 'harbour' (stage IV), 'garden' (stage V), 'city' (stage VI), 'train' (stage VII) or 'monastery' (stage VIII). */
  setAmbience(kind) {
    this.wantAmbience = kind;
    if (!this.ctx || kind === this.ambKind) return;
    this.stopAmbience();
    this.ambKind = kind;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
    out.connect(this.master);
    const nodes = [out];

    // pad: slow detuned oscillators under a low-pass, breathing gently
    const padGain = ctx.createGain();
    padGain.gain.value = kind === 'rain' ? 0.045 : kind === 'harbour' || kind === 'garden' || kind === 'city' || kind === 'train' || kind === 'monastery' ? 0.03 : 0.035;
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.value = { rain: 260, night: 320, snow: 380, harbour: 420, garden: 440, city: 360, train: 340, monastery: 300 }[kind];
    padLp.connect(padGain).connect(out);
    const chord = {
      rain: [55, 82.6, 110.4],
      night: [49, 73.6, 98.2, 147.1],
      snow: [43.65, 65.4, 87.3, 130.8, 164.8],
      harbour: [55, 82.4, 110, 138.6, 164.8],
      garden: [73.4, 110, 146.8, 185, 220],
      city: [58.27, 87.31, 116.54, 174.61],
      train: [49, 73.4, 98, 123.5, 146.8],
      monastery: [55, 82.4, 110, 164.8],
    }[kind];
    for (const f of chord) {
      const o = ctx.createOscillator();
      o.type = f < 60 ? 'triangle' : 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.45;
      o.connect(g).connect(padLp);
      o.start();
      nodes.push(o);
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain).connect(padGain.gain);
    lfo.start();
    nodes.push(lfo);

    const noise = ctx.createBufferSource();
    noise.buffer = this._noiseBuffer(2);
    noise.loop = true;
    if (kind === 'rain') {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 0.5;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2600;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      noise.connect(bp).connect(lp).connect(g).connect(out);
    } else if (kind === 'snow') {
      // cold wind: a low rush with a slow swell, and a thin whistle that wanders in pitch
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 360;
      const g = ctx.createGain();
      g.gain.value = 0.04;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.07;
      const swellGain = ctx.createGain();
      swellGain.gain.value = 0.025;
      swell.connect(swellGain).connect(g.gain);
      swell.start();
      noise.connect(lp).connect(g).connect(out);
      const whistle = ctx.createBiquadFilter();
      whistle.type = 'bandpass';
      whistle.frequency.value = 820;
      whistle.Q.value = 14;
      const wander = ctx.createOscillator();
      wander.frequency.value = 0.045;
      const wanderDepth = ctx.createGain();
      wanderDepth.gain.value = 260;
      wander.connect(wanderDepth).connect(whistle.frequency);
      wander.start();
      const wg = ctx.createGain();
      wg.gain.value = 0.02;
      const gust = ctx.createOscillator();
      gust.frequency.value = 0.12;
      const gustDepth = ctx.createGain();
      gustDepth.gain.value = 0.018;
      gust.connect(gustDepth).connect(wg.gain);
      gust.start();
      noise.connect(whistle).connect(wg).connect(out);
      nodes.push(swell, wander, gust);
      // now and then a church bell somewhere down in the town
      const toll = () => {
        if (this.ambKind !== 'snow') return;
        this._bell(196, { vol: 0.03, dur: 4.5, dest: out });
        this.ambTimer = setTimeout(toll, 9000 + Math.random() * 9000);
      };
      this.ambTimer = setTimeout(toll, 2500);
    } else if (kind === 'harbour') {
      // the sea against the quays: a low wash that swells and draws back, a softer lapping over it
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 460;
      const g = ctx.createGain();
      g.gain.value = 0.04;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.11;
      const swellGain = ctx.createGain();
      swellGain.gain.value = 0.026;
      swell.connect(swellGain).connect(g.gain);
      swell.start();
      noise.connect(lp).connect(g).connect(out);
      const lap = ctx.createBiquadFilter();
      lap.type = 'bandpass';
      lap.frequency.value = 1100;
      lap.Q.value = 0.6;
      const lg = ctx.createGain();
      lg.gain.value = 0.012;
      const lapLfo = ctx.createOscillator();
      lapLfo.frequency.value = 0.37;
      const lapDepth = ctx.createGain();
      lapDepth.gain.value = 0.01;
      lapLfo.connect(lapDepth).connect(lg.gain);
      lapLfo.start();
      noise.connect(lap).connect(lg).connect(out);
      nodes.push(swell, lapLfo);
      // halyards tapping on the masts of the moored boats
      const tink = () => {
        if (this.ambKind !== 'harbour') return;
        const f = 1700 + Math.random() * 900;
        this._tone(f, { dur: 0.3, vol: 0.005 + Math.random() * 0.006 });
        if (Math.random() < 0.4) this._tone(f * 1.5, { dur: 0.2, vol: 0.004, delay: 0.09 });
        this.ambTimer = setTimeout(tink, 500 + Math.random() * 2300);
      };
      this.ambTimer = setTimeout(tink, 1200);
    } else if (kind === 'garden') {
      // a soft breeze in the trees
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 340;
      const g = ctx.createGain();
      g.gain.value = 0.026;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.08;
      const swellGain = ctx.createGain();
      swellGain.gain.value = 0.018;
      swell.connect(swellGain).connect(g.gain);
      swell.start();
      nodes.push(swell);
      noise.connect(lp).connect(g).connect(out);
      // frogs in the pond, and now and then the nightingale
      let song = 4;
      const croak = () => {
        if (this.ambKind !== 'garden') return;
        const f = 300 + Math.random() * 260;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this._tone(f, { type: 'sawtooth', dur: 0.06, vol: 0.004, slide: -50, attack: 0.01, delay: i * 0.08 });
        const wait = 600 + Math.random() * 2400;
        song -= wait / 1000;
        if (song <= 0) {
          this.nightingale(0.6);
          song = 9 + Math.random() * 10;
        }
        this.ambTimer = setTimeout(croak, wait);
      };
      this.ambTimer = setTimeout(croak, 900);
    } else if (kind === 'city') {
      // a warm wind off the desert, sand hissing along the roofs in the gusts
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 300;
      const g = ctx.createGain();
      g.gain.value = 0.032;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.06;
      const swellGain = ctx.createGain();
      swellGain.gain.value = 0.02;
      swell.connect(swellGain).connect(g.gain);
      swell.start();
      noise.connect(lp).connect(g).connect(out);
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 2800;
      const hiss = ctx.createGain();
      hiss.gain.value = 0.004;
      const gust = ctx.createOscillator();
      gust.frequency.value = 0.13;
      const gustDepth = ctx.createGain();
      gustDepth.gain.value = 0.004;
      gust.connect(gustDepth).connect(hiss.gain);
      gust.start();
      noise.connect(hp).connect(hiss).connect(out);
      nodes.push(swell, gust);
      // crickets on the roofs, and now and then an oud somewhere down in the town
      let tune = 5;
      const night = () => {
        if (this.ambKind !== 'city') return;
        const f = 4300 + Math.random() * 500;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) this._tone(f, { dur: 0.05, vol: 0.004, attack: 0.01, delay: i * 0.11 });
        const wait = 700 + Math.random() * 2000;
        tune -= wait / 1000;
        if (tune <= 0) {
          this.oud(0.7, out);
          tune = 10 + Math.random() * 9;
        }
        this.ambTimer = setTimeout(night, wait);
      };
      this.ambTimer = setTimeout(night, 800);
    } else if (kind === 'train') {
      // the rumble of the train under the cat (louder in a tunnel), wind over the roofs
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      const rumble = ctx.createGain();
      rumble.gain.value = 0.07;
      noise.connect(lp).connect(rumble).connect(out);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 700;
      bp.Q.value = 0.4;
      const wind = ctx.createGain();
      wind.gain.value = 0.014;
      noise.connect(bp).connect(wind).connect(out);
      this.trainRumble = rumble;
      this.trainOut = out;
      // the wheels clacking over the rail joints, two bogies at a time; now and then the engine whistles far ahead
      let whistle = 9;
      const clack = () => {
        if (this.ambKind !== 'train') return;
        const loud = 1 + 1.2 * (this.trainTunnel || 0);
        for (const d of [0, 0.11, 0.42, 0.53]) {
          this._noise(0.035, { freq: 1900, q: 1.5, vol: 0.035 * loud, delay: d, dest: out });
          this._tone(85, { type: 'triangle', dur: 0.06, vol: 0.05 * loud, delay: d, dest: out });
        }
        whistle -= 0.86;
        if (whistle <= 0) {
          this.trainWhistle(0.35, out);
          whistle = 20 + Math.random() * 20;
        }
        this.ambTimer = setTimeout(clack, 860);
      };
      this.ambTimer = setTimeout(clack, 300);
    } else if (kind === 'monastery') {
      // the wind on the heights: a rush that gusts and drops, a thin whistle over the ridges
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      const g = ctx.createGain();
      g.gain.value = 0.045;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.06;
      const swellGain = ctx.createGain();
      swellGain.gain.value = 0.03;
      swell.connect(swellGain).connect(g.gain);
      swell.start();
      noise.connect(lp).connect(g).connect(out);
      const whistle = ctx.createBiquadFilter();
      whistle.type = 'bandpass';
      whistle.frequency.value = 1100;
      whistle.Q.value = 10;
      const wander = ctx.createOscillator();
      wander.frequency.value = 0.037;
      const wanderDepth = ctx.createGain();
      wanderDepth.gain.value = 320;
      wander.connect(wanderDepth).connect(whistle.frequency);
      wander.start();
      const wg = ctx.createGain();
      wg.gain.value = 0.012;
      noise.connect(whistle).connect(wg).connect(out);
      nodes.push(swell, wander);
      // far off in the monastery: the long horns now and then, a hand bell, prayer flags snapping in a gust
      let horn = 6;
      let bell = 4;
      const step = () => {
        if (this.ambKind !== 'monastery') return;
        horn -= 1;
        bell -= 1;
        if (horn <= 0) {
          this.horn(0.45, out);
          horn = 24 + Math.random() * 16;
        }
        if (bell <= 0) {
          const f = 1480 + Math.random() * 300;
          for (let i = 0; i < 3; i++) this._bell(f, { vol: 0.012, dur: 1.4, dest: out, delay: i * 0.32 });
          bell = 8 + Math.random() * 8;
        }
        if (Math.random() < 0.25) for (let i = 0; i < 5; i++) this._noise(0.05, { freq: 700 + Math.random() * 500, q: 0.7, vol: 0.02, delay: i * 0.07 + Math.random() * 0.03, dest: out });
        this.ambTimer = setTimeout(step, 1000);
      };
      this.ambTimer = setTimeout(step, 1000);
    } else {
      // wind through trees: low noise with a slow swell
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      const g = ctx.createGain();
      g.gain.value = 0.035;
      const swell = ctx.createOscillator();
      swell.frequency.value = 0.11;
      const swellGain = ctx.createGain();
      swellGain.gain.value = 0.02;
      swell.connect(swellGain).connect(g.gain);
      swell.start();
      nodes.push(swell);
      noise.connect(lp).connect(g).connect(out);
      // crickets: a high tone chopped by a fast tremolo, in loose bursts
      const cricketGain = ctx.createGain();
      cricketGain.gain.value = 0;
      cricketGain.connect(out);
      for (const f of [4100, 4400]) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        const trem = ctx.createGain();
        trem.gain.value = 0;
        const tLfo = ctx.createOscillator();
        tLfo.frequency.value = f > 4200 ? 41 : 36;
        const tDepth = ctx.createGain();
        tDepth.gain.value = 0.5;
        tLfo.connect(tDepth).connect(trem.gain);
        tLfo.start();
        o.connect(trem).connect(cricketGain);
        o.start();
        nodes.push(o, tLfo);
      }
      const chirp = () => {
        if (this.ambKind !== 'night') return;
        const t = ctx.currentTime;
        const n = 2 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
          const s = t + i * 0.18;
          cricketGain.gain.setValueAtTime(0, s);
          cricketGain.gain.linearRampToValueAtTime(0.012, s + 0.02);
          cricketGain.gain.linearRampToValueAtTime(0, s + 0.12);
        }
        this.ambTimer = setTimeout(chirp, 900 + Math.random() * 2200);
      };
      this.ambTimer = setTimeout(chirp, 600);
    }
    noise.start();
    nodes.push(noise);
    this.amb = nodes;
  }

  /** Stage VII: how far into a tunnel the train is (0–1): the rumble and the clacks swell. */
  setTunnel(k) {
    this.trainTunnel = k;
    if (this.trainRumble && this.ambKind === 'train') this.trainRumble.gain.setTargetAtTime(0.07 + 0.11 * k, this.ctx.currentTime, 0.2);
  }

  stopAmbience() {
    if (this.ambTimer) clearTimeout(this.ambTimer);
    this.ambTimer = null;
    if (!this.amb) return;
    const ctx = this.ctx;
    const out = this.amb[0];
    out.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    const nodes = this.amb;
    setTimeout(() => {
      for (const n of nodes) {
        try {
          if (n.stop) n.stop();
          n.disconnect();
        } catch {
          /* already stopped */
        }
      }
    }, 2000);
    this.amb = null;
    this.ambKind = null;
  }

  _tone(freq, { type = 'sine', dur = 0.2, vol = 0.3, slide = 0, attack = 0.005, delay = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** A struck bell: inharmonic partials with long, staggered decays. */
  _bell(freq, { vol = 0.1, dur = 2.5, dest = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    for (const [ratio, amp, decay] of [
      [0.5, 0.5, 1],
      [1, 1, 0.9],
      [1.19, 0.45, 0.6],
      [1.5, 0.35, 0.5],
      [2.0, 0.4, 0.4],
      [2.74, 0.2, 0.25],
    ]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * amp, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur * decay);
      o.connect(g).connect(dest || this.master);
      o.start(t);
      o.stop(t + dur * decay + 0.05);
    }
  }

  /** A plucked string: bright at first, the brightness dying away faster than the note. */
  _pluck(freq, { vol = 0.05, dur = 0.9, dest = null, delay = 0 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(freq * 7, t);
    f.frequency.exponentialRampToValueAtTime(freq * 1.4, t + dur * 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(f).connect(g).connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise(dur, { freq = 400, q = 1, vol = 0.3, type = 'bandpass', delay = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(dest || this.master);
    src.start(t);
  }

  jump() {
    this._tone(420, { type: 'sine', dur: 0.18, vol: 0.12, slide: 380 });
    this._noise(0.08, { freq: 900, q: 0.8, vol: 0.05 });
  }
  land(strength = 1) {
    this._noise(0.12, { freq: 180, q: 0.7, vol: 0.1 + 0.1 * strength });
  }
  slide() {
    this._noise(0.22, { freq: 700, q: 0.4, vol: 0.07 });
  }
  dive() {
    this._tone(300, { type: 'sine', dur: 0.2, vol: 0.08, slide: -160 });
  }
  collect() {
    this._tone(1046, { type: 'sine', dur: 0.25, vol: 0.12 });
    this._tone(1568, { type: 'sine', dur: 0.35, vol: 0.1, delay: 0.06 });
  }
  checkpoint() {
    this._tone(784, { dur: 0.3, vol: 0.1 });
    this._tone(1175, { dur: 0.35, vol: 0.09, delay: 0.09 });
    this._tone(1568, { dur: 0.5, vol: 0.08, delay: 0.18 });
  }
  hit() {
    this._noise(0.35, { freq: 140, q: 0.6, vol: 0.4 });
    this._tone(110, { type: 'triangle', dur: 0.4, vol: 0.2, slide: -70 });
  }
  fall() {
    this._tone(360, { type: 'sine', dur: 0.7, vol: 0.1, slide: -300 });
  }
  splash() {
    this._noise(0.5, { freq: 900, q: 0.3, vol: 0.25, type: 'lowpass' });
  }
  /** Falling into deep snow. */
  poof() {
    this._noise(0.45, { freq: 380, q: 0.4, vol: 0.3, type: 'lowpass' });
  }
  /** Old boards taking the cat's weight. */
  creak() {
    this._tone(150, { type: 'triangle', dur: 0.32, vol: 0.1, slide: 60, attack: 0.03 });
    this._noise(0.18, { freq: 620, q: 4, vol: 0.06 });
  }
  /** ...and giving way. */
  crack() {
    this._noise(0.18, { freq: 2400, q: 0.9, vol: 0.2 });
    this._noise(0.45, { freq: 170, q: 0.6, vol: 0.28 });
    this._tone(95, { type: 'triangle', dur: 0.35, vol: 0.14, slide: -40 });
  }
  /** A bell brushed in passing. */
  chime() {
    this._bell(523, { vol: 0.07, dur: 2.2 });
  }
  /** Wind chimes knocked in passing: a handful of high bells, one after another. */
  chimes() {
    const notes = [1568, 1760, 2093, 2349, 2637].sort(() => Math.random() - 0.5);
    notes.forEach((f, i) => this._bell(f, { vol: 0.018, dur: 1.6, delay: i * (0.05 + Math.random() * 0.07) }));
  }
  /** A frog dropping into the pond. */
  plop() {
    this._tone(900, { dur: 0.12, vol: 0.04, slide: -620 });
    this._noise(0.08, { freq: 1300, q: 1.2, vol: 0.025 });
  }
  /** A nightingale's phrase: a few rising whistles, a quick trill, a low note to end. */
  nightingale(vol = 1) {
    const v = 0.014 * vol;
    let t = 0;
    const whistles = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < whistles; i++, t += 0.16) this._tone(1700 + Math.random() * 300, { dur: 0.09, vol: v, slide: 900, delay: t });
    t += 0.08;
    const lo = 2900 + Math.random() * 400;
    for (let i = 0; i < 10; i++, t += 0.035) this._tone(i % 2 ? lo * 1.18 : lo, { dur: 0.03, vol: v * 0.8, delay: t });
    this._tone(1300, { dur: 0.22, vol: v, slide: -350, delay: t + 0.06 });
  }
  /** A phrase on an oud: a few notes wandering up and down a hijaz scale, the last one held. */
  oud(vol = 1, dest = null) {
    const scale = [146.8, 155.6, 185, 196, 220, 233.1, 261.6, 293.7];
    let i = Math.floor(Math.random() * 4);
    let t = 0;
    const n = 4 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const last = k === n - 1;
      this._pluck(scale[i], { vol: 0.022 * vol, dur: last ? 1.6 : 0.7, dest, delay: t });
      // a quick tremolo on some notes
      if (!last && Math.random() < 0.25) for (let r = 1; r < 4; r++) this._pluck(scale[i], { vol: 0.014 * vol, dur: 0.3, dest, delay: t + r * 0.06 });
      t += Math.random() < 0.3 ? 0.42 : 0.24;
      i = Math.max(0, Math.min(scale.length - 1, i + (Math.random() < 0.55 ? 1 : -1) * (Math.random() < 0.8 ? 1 : 2)));
    }
  }
  /** Landing on an awning: the canvas thumps and throws. */
  bounce() {
    this._noise(0.16, { freq: 260, q: 0.6, vol: 0.22, type: 'lowpass' });
    this._tone(150, { type: 'sine', dur: 0.22, vol: 0.14, slide: 230 });
    this._tone(310, { type: 'triangle', dur: 0.3, vol: 0.04, slide: 420, delay: 0.03 });
  }
  /** Brass lanterns knocking together. */
  clink() {
    this._bell(1318, { vol: 0.022, dur: 1.1 });
    this._bell(1661, { vol: 0.016, dur: 0.9, delay: 0.09 + Math.random() * 0.06 });
  }
  /** Doves taking off: a clatter of wings. */
  flutter() {
    for (let i = 0; i < 7; i++) this._noise(0.05, { freq: 900 + Math.random() * 700, q: 0.8, vol: 0.05, delay: i * 0.055 + Math.random() * 0.02 });
  }
  /** A steam whistle: three detuned reeds in a chord, rising into the note and falling off at the end. */
  trainWhistle(vol = 1, dest = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.03 * vol, t + 0.12);
    out.gain.setValueAtTime(0.03 * vol, t + 1.1);
    out.gain.exponentialRampToValueAtTime(0.0005, t + 1.6);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 1.2;
    bp.connect(out).connect(dest || this.master);
    for (const f of [440, 523, 659]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.94, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.15);
      o.frequency.setValueAtTime(f, t + 1.2);
      o.frequency.linearRampToValueAtTime(f * 0.96, t + 1.6);
      o.connect(bp);
      o.start(t);
      o.stop(t + 1.65);
    }
  }
  /** A level crossing's bell going past: dings that fall in pitch as it slips away behind. */
  crossing() {
    for (let i = 0; i < 9; i++) this._bell(1180 * Math.pow(0.97, i), { vol: 0.03 * (1 - i / 11), dur: 0.5, delay: i * 0.22 });
  }
  /** A gasp of steam. */
  steam() {
    this._noise(1.2, { freq: 3200, q: 0.4, vol: 0.12, type: 'highpass' });
  }
  /** A gust of wind rising out of a gorge: a rush that sweeps up and dies away. */
  gust() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(1.4);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 0.8;
    f.frequency.setValueAtTime(320, t);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 1.4);
  }
  /** A gong: a low hum under a bright, shimmering strike, ringing on a long time. */
  gong(vol = 1) {
    this._bell(196, { vol: 0.05 * vol, dur: 4.5 });
    this._bell(201, { vol: 0.03 * vol, dur: 3.5 });
    this._tone(98, { dur: 3.2, vol: 0.05 * vol, attack: 0.05 });
  }
  /** The long horns of the monastery: a pair of low brassy notes swelling in and dying away. */
  horn(vol = 1, dest = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, t);
    out.gain.linearRampToValueAtTime(0.05 * vol, t + 0.9);
    out.gain.setValueAtTime(0.05 * vol, t + 2.6);
    out.gain.exponentialRampToValueAtTime(0.0005, t + 3.8);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    lp.Q.value = 3;
    lp.connect(out).connect(dest || this.master);
    for (const f of [58, 58.6, 116.4]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.97, t);
      o.frequency.linearRampToValueAtTime(f, t + 0.6);
      o.connect(lp);
      o.start(t);
      o.stop(t + 3.9);
    }
  }
  /** Thunder far down in the clouds: a long low roll. */
  thunder(vol = 1, delay = 0) {
    this._noise(2.6, { freq: 140, q: 0.5, vol: 0.18 * vol, type: 'lowpass', delay });
    this._noise(1.2, { freq: 90, q: 0.5, vol: 0.12 * vol, type: 'lowpass', delay: delay + 0.6 });
  }
  /** A prayer wheel set turning: its little bell, and the rattle of the axle. */
  wheel() {
    this._bell(1760, { vol: 0.014, dur: 1.0 });
    for (let i = 0; i < 4; i++) this._noise(0.03, { freq: 1400, q: 2, vol: 0.025, delay: 0.05 + i * 0.09 });
  }
  /** A shooting star: a faint high shimmer falling away. */
  meteor(vol = 1) {
    this._tone(2600 + Math.random() * 600, { dur: 0.9, vol: 0.006 * vol, slide: -1500, attack: 0.08 });
  }
  /** A rocket climbing over the bay. */
  whistle(dur = 1) {
    this._tone(620 + Math.random() * 200, { dur, vol: 0.008, slide: 700 + Math.random() * 400, attack: 0.15 });
  }
  /** A shell bursting out over the water: the boom arrives a moment after the flash; some crackle as they fall. */
  firework({ delay = 0.4, size = 1, crackle = false } = {}) {
    this._noise(1.1, { freq: 200, q: 0.5, vol: 0.12 * size, type: 'lowpass', delay });
    this._tone(62, { type: 'sine', dur: 0.55, vol: 0.08 * size, slide: -22, delay });
    if (!crackle) return;
    for (let i = 0; i < 24; i++) {
      this._noise(0.03, { freq: 3200 + Math.random() * 1800, q: 1.2, vol: 0.02 + Math.random() * 0.02, delay: delay + 0.55 + Math.random() * 0.9 });
    }
  }
  clear() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((n, i) => this._tone(n, { dur: 0.6, vol: 0.1, delay: i * 0.11 }));
  }
  start() {
    this._tone(660, { dur: 0.3, vol: 0.08 });
  }
  tick() {
    this._tone(880, { dur: 0.08, vol: 0.05 });
  }
  pause() {
    this._tone(440, { dur: 0.15, vol: 0.06 });
  }
}
