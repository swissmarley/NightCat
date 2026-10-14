// Tiny WebAudio synth: ambience beds (rain / mountain night / snow) and one-shot sounds. No samples.
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

  /** Switch the ambience bed: 'rain' (stage I), 'night' (stage II) or 'snow' (stage III). */
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
    padGain.gain.value = kind === 'rain' ? 0.045 : 0.035;
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.value = kind === 'rain' ? 260 : kind === 'snow' ? 380 : 320;
    padLp.connect(padGain).connect(out);
    const chord = {
      rain: [55, 82.6, 110.4],
      night: [49, 73.6, 98.2, 147.1],
      snow: [43.65, 65.4, 87.3, 130.8, 164.8],
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

  _tone(freq, { type = 'sine', dur = 0.2, vol = 0.3, slide = 0, attack = 0.005, delay = 0 } = {}) {
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
    o.connect(g).connect(this.master);
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

  _noise(dur, { freq = 400, q = 1, vol = 0.3, type = 'bandpass' } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
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
    src.connect(f).connect(g).connect(this.master);
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
