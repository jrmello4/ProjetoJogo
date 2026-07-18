// Feedback sonoro do jogo inteiro — 100% procedural via WebAudio, zero
// arquivos de áudio. Cada som é um envelope curto de osciladores/ruído,
// pensado pra ser sentido e não notado. Volume e mute persistem em
// localStorage; o AudioContext só nasce no primeiro gesto do usuário
// (política de autoplay dos navegadores).
//
// Uso: AudioService.play('click' | 'whoosh' | 'bell' | 'thud' | 'success'
//                       | 'fail' | 'cash' | 'notify' | 'impact')
//
// Ambiência de fundo (murmúrio contínuo de arena) é uma fonte separada —
// start/stopAmbient() — que nasce sozinha no unlock se ambientEnabled
// estiver ligado, e se abaixa (duckAmbient) durante cinemáticas.

const STORAGE_KEY = 'mma_audio';

export class AudioService {
  static _ctx = null;
  static _master = null;
  static _noiseBuffer = null;
  static _ambientBuffer = null;
  static _ambientSource = null;
  static _ambientGain = null;
  static _ambientLfo = null;
  static settings = { volume: 0.7, muted: false, ambientEnabled: true };

  static init() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) this.settings = { ...this.settings, ...saved };
    } catch { /* localStorage corrompido — usa padrão */ }

    // AudioContext suspenso até o primeiro gesto — cria/resume no pointerdown.
    const unlock = () => {
      this._ensureCtx();
      this._ctx?.resume?.();
      if (this.settings.ambientEnabled) this.startAmbient();
    };
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
  }

  static _ensureCtx() {
    if (this._ctx) return this._ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    this._ctx = new AC();
    this._master = this._ctx.createGain();
    this._master.gain.value = this.settings.muted ? 0 : this.settings.volume;
    this._master.connect(this._ctx.destination);

    // Buffer de ruído branco reutilizado por whoosh/thud.
    const len = this._ctx.sampleRate * 0.5;
    this._noiseBuffer = this._ctx.createBuffer(1, len, this._ctx.sampleRate);
    const data = this._noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // Buffer maior e mais longo pra ambiência — evita repetição audível
    // do loop (0.5s do SFX ficaria claramente cíclico em segundo plano).
    const ambLen = this._ctx.sampleRate * 4;
    this._ambientBuffer = this._ctx.createBuffer(1, ambLen, this._ctx.sampleRate);
    const ambData = this._ambientBuffer.getChannelData(0);
    for (let i = 0; i < ambLen; i++) ambData[i] = Math.random() * 2 - 1;

    return this._ctx;
  }

  // ===== Ambiência de fundo =====
  // Murmúrio de arena bem sutil — ruído filtrado em loop com um LFO lento
  // modulando o filtro (evita textura estática/robótica). Fica atrás de
  // todo o resto: ~4-5% de gain, nunca compete com os SFX discretos.

  static startAmbient() {
    if (this._ambientSource || this.settings.muted || !this.settings.ambientEnabled) return;
    const ctx = this._ensureCtx();
    if (!ctx || ctx.state !== 'running') return;

    const src = ctx.createBufferSource();
    src.buffer = this._ambientBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 380;
    filter.Q.value = 0.6;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06; // ciclo ~17s — respiração lenta, não perceptível como padrão
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 2.5);

    src.connect(filter).connect(gain).connect(this._master);
    src.start();

    this._ambientSource = src;
    this._ambientLfo = lfo;
    this._ambientGain = gain;
  }

  static stopAmbient() {
    if (!this._ambientSource || !this._ctx) return;
    const g = this._ambientGain;
    const src = this._ambientSource;
    const lfo = this._ambientLfo;
    const stopAt = this._ctx.currentTime + 1;
    g.gain.linearRampToValueAtTime(0, stopAt);
    setTimeout(() => {
      try { src.stop(); } catch { /* já parado */ }
      try { lfo.stop(); } catch { /* já parado */ }
    }, 1050);
    this._ambientSource = null;
    this._ambientGain = null;
    this._ambientLfo = null;
  }

  // Abaixa a ambiência sem parar (cinemáticas têm seu próprio som de
  // impacto — não deve ficar competindo com o murmúrio por baixo).
  static duckAmbient(duck) {
    if (!this._ambientGain || !this._ctx) return;
    this._ambientGain.gain.linearRampToValueAtTime(duck ? 0.01 : 0.045, this._ctx.currentTime + 0.6);
  }

  static setAmbientEnabled(enabled) {
    this.settings.ambientEnabled = !!enabled;
    this._persist();
    if (enabled) this.startAmbient();
    else this.stopAmbient();
  }

  static _persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
  }

  static setVolume(v) {
    this.settings.volume = Math.max(0, Math.min(1, v));
    if (this._master && !this.settings.muted) this._master.gain.value = this.settings.volume;
    this._persist();
  }

  static setMuted(muted) {
    this.settings.muted = !!muted;
    if (this._master) this._master.gain.value = muted ? 0 : this.settings.volume;
    this._persist();
    // Ambiência é uma fonte contínua própria (não passa por play()) — mutar
    // só o gain mestre a deixaria tocando silenciosamente pra sempre em vez
    // de liberar os nodes; ao desmutar, religa se a preferência mandar.
    if (muted) this.stopAmbient();
    else if (this.settings.ambientEnabled) this.startAmbient();
  }

  static play(name) {
    if (this.settings.muted) return;
    const ctx = this._ensureCtx();
    if (!ctx || ctx.state !== 'running') return;
    const fn = this._sounds[name];
    if (fn) fn.call(this, ctx, ctx.currentTime);
  }

  // ===== Blocos de construção =====

  static _tone(ctx, t0, { freq, to = null, type = 'sine', dur, gain, curve = 'exp' }) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    else g.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(g).connect(this._master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  static _noise(ctx, t0, { dur, gain, filterFreq, filterTo = null, type = 'bandpass', q = 1 }) {
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(filterFreq, t0);
    if (filterTo !== null) filter.frequency.exponentialRampToValueAtTime(filterTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(g).connect(this._master);
    src.start(t0, Math.random() * 0.2);
    src.stop(t0 + dur + 0.02);
  }

  // ===== Paleta de sons =====

  static _sounds = {
    // Tick suave de botão — presente, nunca cansativo.
    click(ctx, t) {
      this._tone(ctx, t, { freq: 720, to: 480, type: 'sine', dur: 0.045, gain: 0.10 });
    },

    // Avanço de semana — varredura de ar, página virando.
    whoosh(ctx, t) {
      this._noise(ctx, t, { dur: 0.30, gain: 0.16, filterFreq: 420, filterTo: 1900, q: 0.9 });
    },

    // Sino de luta — parciais metálicas com decay longo.
    bell(ctx, t) {
      this._tone(ctx, t, { freq: 880, dur: 1.1, gain: 0.12 });
      this._tone(ctx, t, { freq: 1320, dur: 0.85, gain: 0.07 });
      this._tone(ctx, t, { freq: 1979, dur: 0.55, gain: 0.045 });
    },

    // Impacto corporal — queda, knockdown.
    thud(ctx, t) {
      this._tone(ctx, t, { freq: 95, to: 38, type: 'sine', dur: 0.16, gain: 0.30 });
      this._noise(ctx, t, { dur: 0.09, gain: 0.12, filterFreq: 220, type: 'lowpass' });
    },

    // Vitória — duas notas subindo (E5 → A5).
    success(ctx, t) {
      this._tone(ctx, t, { freq: 659, dur: 0.16, gain: 0.10, type: 'triangle' });
      this._tone(ctx, t + 0.13, { freq: 880, dur: 0.42, gain: 0.11, type: 'triangle' });
    },

    // Derrota — descida menor, curta e discreta.
    fail(ctx, t) {
      this._tone(ctx, t, { freq: 440, dur: 0.2, gain: 0.09, type: 'triangle' });
      this._tone(ctx, t + 0.17, { freq: 349, dur: 0.45, gain: 0.09, type: 'triangle' });
    },

    // Dinheiro — dois blips de moeda.
    cash(ctx, t) {
      this._tone(ctx, t, { freq: 1245, dur: 0.07, gain: 0.07, type: 'square' });
      this._tone(ctx, t + 0.08, { freq: 1661, dur: 0.12, gain: 0.07, type: 'square' });
    },

    // Notificação — pop leve subindo.
    notify(ctx, t) {
      this._tone(ctx, t, { freq: 620, to: 930, type: 'sine', dur: 0.09, gain: 0.08 });
    },

    // Marco de carreira — impacto grave + brilho (usado nas cinemáticas).
    impact(ctx, t) {
      this._tone(ctx, t, { freq: 120, to: 45, type: 'sine', dur: 0.5, gain: 0.28 });
      this._noise(ctx, t, { dur: 0.35, gain: 0.10, filterFreq: 300, type: 'lowpass' });
      this._tone(ctx, t + 0.18, { freq: 1319, dur: 0.9, gain: 0.05 });
      this._tone(ctx, t + 0.26, { freq: 1760, dur: 1.1, gain: 0.04 });
    },
  };
}
