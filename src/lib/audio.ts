/* ------------------------------------------------------------------ */
/*  NOVA sound world — fully synthesized, no assets.                   */
/*  Layers: city ambience / electrical hum / sub drone / heartbeat /   */
/*  radio crackle / event stingers. Mixed by scroll progress.          */
/* ------------------------------------------------------------------ */

export class NovaAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private beatGain: GainNode | null = null;
  private crackleTimer = 0;
  private enabled = true;
  private started = false;

  /** Must be called from a user gesture. */
  init() {
    if (this.started) return;
    this.started = true;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    this.master = master;

    /* --- city ambience: filtered brown noise --- */
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2.5, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 320;
    const amb = ctx.createGain();
    amb.gain.value = 0;
    noise.connect(lp).connect(amb).connect(master);
    noise.start();
    this.ambGain = amb;

    /* --- electrical hum: two detuned saws, very quiet --- */
    const hum = ctx.createGain();
    hum.gain.value = 0;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = "lowpass";
    humFilter.frequency.value = 480;
    [54, 54.7, 108.3].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.16;
      o.connect(g).connect(humFilter);
      o.start();
    });
    humFilter.connect(hum).connect(master);
    this.humGain = hum;

    /* --- sub drone: slow beating sines --- */
    const drone = ctx.createGain();
    drone.gain.value = 0;
    [55, 57.8].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(drone);
      o.start();
    });
    drone.connect(master);
    this.droneGain = drone;

    /* --- heartbeat: sub sine gated by an LFO --- */
    const beat = ctx.createGain();
    beat.gain.value = 0;
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 41;
    const subAmp = ctx.createGain();
    subAmp.gain.value = 1;
    sub.connect(subAmp).connect(beat).connect(master);
    sub.start();
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.82;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.5;
    lfo.connect(lfoDepth).connect(subAmp.gain);
    lfo.start();
    subAmp.gain.value = 0.5;
    this.beatGain = beat;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.25);
    }
  }

  isEnabled() {
    return this.enabled;
  }

  private ramp(g: GainNode | null, v: number, t = 0.4) {
    if (g && this.ctx) g.gain.setTargetAtTime(v, this.ctx.currentTime, t);
  }

  /** Called every frame with smoothed progress + dt seconds. */
  setProgress(p: number, dt: number) {
    if (!this.ctx || !this.enabled) return;
    // city ambience: in by street level, out underground
    const amb = ramp01(p, 0.06, 0.2) * (1 - ramp01(p, 0.74, 0.8)) * 0.5 + 0.02 * ramp01(p, 0.02, 0.08);
    this.ramp(this.ambGain, amb);
    // hum grows with the city, morphs uneasy after act III
    this.ramp(this.humGain, 0.028 * ramp01(p, 0.12, 0.3) * (1 - ramp01(p, 0.86, 0.92)));
    // drone creeps in during recognition, peaks at corruption
    this.ramp(this.droneGain, 0.11 * ramp01(p, 0.4, 0.66) * (1 - ramp01(p, 0.88, 0.93)));
    // heartbeat in the freeze / server
    this.ramp(this.beatGain, 0.16 * ramp01(p, 0.7, 0.76) * (1 - ramp01(p, 0.9, 0.95)));

    // radio crackle — act V
    if (p > 0.55 && p < 0.86) {
      this.crackleTimer -= dt;
      if (this.crackleTimer <= 0) {
        this.crackleTimer = 0.5 + Math.random() * 1.6;
        this.crackle();
      }
    }
  }

  private crackle() {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const len = 0.05 + Math.random() * 0.08;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(hp).connect(g).connect(this.master);
    src.start();
  }

  /** Small UI/event blip. */
  blip(freq = 880, vol = 0.05) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(ctx.currentTime + 0.2);
  }

  /** Anomaly discovered — dissonant ping. */
  sting() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    [1174, 1241].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.02;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.055, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + 1);
    });
  }

  /** Final single notification tone. */
  chime() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled) return;
    [1318.5, 1975.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.07, t0 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
      o.connect(g).connect(this.master!);
      o.start(t0);
      o.stop(t0 + 1.5);
    });
  }
}

function ramp01(x: number, a: number, b: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
