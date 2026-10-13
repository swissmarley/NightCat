// Tiny WebAudio synth: a rain/pad ambience plus a handful of one-shot sounds. No samples.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambienceOn = false;
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
    this.startAmbience();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  startAmbience() {
    if (this.ambienceOn || !this.ctx) return;
    this.ambienceOn = true;
    const ctx = this.ctx;

    // rain: looping noise through a band-pass
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.05;
    noise.connect(bp).connect(lp).connect(rainGain).connect(this.master);
    noise.start();

    // pad: two slow detuned oscillators under a low-pass, breathing gently
    const padGain = ctx.createGain();
    padGain.gain.value = 0.045;
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.value = 260;
    padLp.connect(padGain).connect(this.master);
    for (const [type, f] of [
      ['triangle', 55],
      ['sine', 82.6],
      ['sine', 110.4],
    ]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      o.connect(g).connect(padLp);
      o.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(padGain.gain);
    lfo.start();
  }

  _tone(freq, { type = 'sine', dur = 0.2, vol = 0.3, slide = 0, attack = 0.005 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
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

  _noise(dur, { freq = 400, q = 1, vol = 0.3 } = {}) {
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
    f.type = 'bandpass';
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
  land() {
    this._noise(0.12, { freq: 180, q: 0.7, vol: 0.14 });
  }
  collect() {
    this._tone(1046, { type: 'sine', dur: 0.25, vol: 0.12 });
    setTimeout(() => this._tone(1568, { type: 'sine', dur: 0.35, vol: 0.1 }), 60);
  }
  hit() {
    this._noise(0.35, { freq: 140, q: 0.6, vol: 0.4 });
    this._tone(110, { type: 'triangle', dur: 0.4, vol: 0.2, slide: -70 });
  }
  fall() {
    this._tone(360, { type: 'sine', dur: 0.7, vol: 0.1, slide: -300 });
  }
  clear() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((n, i) => setTimeout(() => this._tone(n, { dur: 0.6, vol: 0.1 }), i * 110));
  }
  start() {
    this._tone(660, { dur: 0.3, vol: 0.08 });
  }
}
