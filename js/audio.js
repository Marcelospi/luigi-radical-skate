// Sistema de Efeitos Sonoros e Música Sintetizada via Web Audio API
// 100% nativo no navegador, sem dependências externas!

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicPlaying = false;
    this.musicWanted = false;
    this.musicTimer = null;
    this.musicStage = 0;
    this.musicBoosted = false;

    // Canais contínuos (rolamento, grind metálico e vento) + cache de buffers curtos de SFX
    this.noiseBuffer = null;
    this._sfxBuffers = {};
    this.rollNode = null;
    this.rollFilter = null;
    this.rollGain = null;
    this.jointPhase = 0;
    this.freehubPhase = 0;

    this.grindNode = null;
    this.grindFilter = null;
    this.grindRingOsc = null;
    this.grindRingGain = null;
    this.grindGain = null;

    this.windNode = null;
    this.windFilter = null;
    this.windGain = null;

    this.rampNode = null;
    this.rampFilter = null;
    this.rampGain = null;

    this.isRolling = false;

    // Tentativa de recuperação de preferências
    try {
      this.muted = localStorage.getItem('luigi_skate_muted') === 'true';
    } catch (e) {}
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      // Barramento mestre: um único ponto de volume e de mudo
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.85;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.startSkateRollSound();
    this.startGrindSound();
    this.startWindSound();
    this.startRampRideSound();
  }

  /** Destino de todos os sons — cai no destination caso o master não exista. */
  output() {
    return this.master || (this.ctx && this.ctx.destination);
  }

  /** Gera e armazena em cache um buffer de ruído rosa suave (2 segundos). */
  getNoiseBuffer() {
    if (this.noiseBuffer || !this.ctx) return this.noiseBuffer;
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Filtro simples de Paul Kellet para ruído rosa (mais natural que ruído branco)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }

    this.noiseBuffer = buffer;
    return buffer;
  }

  /** Cache lazy de buffers curtos de ruído para SFX (zero alocação por pulo/pouso/remada). */
  getSfxNoiseBuffer(key, durationSec, shapeFn) {
    if (!this.ctx) return null;
    if (this._sfxBuffers[key]) return this._sfxBuffers[key];
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * durationSec));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * shapeFn(i / len);
    }
    this._sfxBuffers[key] = buf;
    return buf;
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('luigi_skate_muted', String(this.muted));
    } catch (e) {}

    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime, 0.02);
    }

    if (this.muted) {
      this.stopMusic(true);
      this.silenceLoops();
    } else if (this.musicWanted && (!window.game || window.game.state === 'PLAYING')) {
      this.startMusic();
    }
    return this.muted;
  }

  /** Silencia todos os canais contínuos (pausa, game over, menu ou mudo). */
  silenceLoops() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.rollGain) this.rollGain.gain.setTargetAtTime(0, now, 0.03);
    if (this.grindGain) this.grindGain.gain.setTargetAtTime(0, now, 0.02);
    if (this.grindRingGain) this.grindRingGain.gain.setTargetAtTime(0, now, 0.02);
    if (this.windGain) this.windGain.gain.setTargetAtTime(0, now, 0.04);
    if (this.rampGain) this.rampGain.gain.setTargetAtTime(0, now, 0.025);
    this.isRolling = false;
  }

  // ==========================================================
  // Canais contínuos: rolamento, grind metálico e vento
  // ==========================================================

  // Som contínuo realista das rodinhas de poliuretano na pista
  startSkateRollSound() {
    if (!this.ctx || this.rollNode) return;
    try {
      const buffer = this.getNoiseBuffer();
      this.rollNode = this.ctx.createBufferSource();
      this.rollNode.buffer = buffer;
      this.rollNode.loop = true;

      this.rollFilter = this.ctx.createBiquadFilter();
      this.rollFilter.type = 'bandpass';
      this.rollFilter.frequency.value = 460;
      this.rollFilter.Q.value = 1.1;

      this.rollGain = this.ctx.createGain();
      this.rollGain.gain.value = 0;

      this.rollNode.connect(this.rollFilter);
      this.rollFilter.connect(this.rollGain);
      this.rollGain.connect(this.output());

      this.rollNode.start();
    } catch (e) {
      console.warn('Erro ao iniciar som de rolamento', e);
    }
  }

  /**
   * Atualiza o som contínuo das rodas conforme contato, velocidade, superfície e esporte.
   * @param {boolean} onGround
   * @param {number} speedRatio - 0..1.4
   * @param {string} [surfaceType='asphalt']
   * @param {string} [sportId='skate'] - 'skate' | 'bmx' | 'scooter' | 'skates'
   */
  updateRoll(onGround, speedRatio, surfaceType = 'asphalt', sportId = 'skate') {
    if (!this.rollGain || !this.rollFilter || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.muted || !onGround || !Number.isFinite(speedRatio) || speedRatio <= 0.05) {
      this.rollGain.gain.setTargetAtTime(0, now, 0.04);
      this.isRolling = false;
      return;
    }

    this.isRolling = true;
    const clampedSpeed = Math.max(0, Math.min(1.5, speedRatio));

    // Perfil acústico base por superfície
    let baseFreq = 340;
    let freqSpan = 560;
    let qVal = 1.05;
    let gainScale = 0.24;

    if (surfaceType === 'wood') {
      baseFreq = 220;
      freqSpan = 340;
      qVal = 1.8;
      gainScale = 0.22;
    } else if (surfaceType === 'metal') {
      baseFreq = 860;
      freqSpan = 820;
      qVal = 2.4;
      gainScale = 0.16;
    } else if (surfaceType === 'cosmic') {
      baseFreq = 480;
      freqSpan = 740;
      qVal = 2.0;
      gainScale = 0.18;
    } else if (surfaceType === 'breakable') {
      baseFreq = 420;
      freqSpan = 620;
      qVal = 0.9;
      gainScale = 0.26;
    }

    // Modulação de timbre por esporte
    if (sportId === 'bmx') {
      // Pneu de borracha mais grave e encorpado
      baseFreq *= 0.56;
      freqSpan *= 0.58;
      qVal = 0.85;
      gainScale *= 0.72;
    } else if (sportId === 'scooter') {
      // Rodinhas menores e mais agudas de PU/alumínio
      baseFreq *= 1.42;
      freqSpan *= 1.25;
      qVal = Math.max(1.5, qVal);
      gainScale *= 0.92;
    } else if (sportId === 'skates') {
      // Deslize suave e sedoso de 8 rodinhas inline
      baseFreq *= 1.12;
      freqSpan *= 0.95;
      qVal = 0.9;
      gainScale *= 0.78;
    }

    const targetFreq = baseFreq + clampedSpeed * freqSpan;
    const targetGain = Math.min(0.32, clampedSpeed * gainScale);

    this.rollFilter.frequency.setTargetAtTime(targetFreq, now, 0.06);
    this.rollFilter.Q.setTargetAtTime(qVal, now, 0.06);
    this.rollGain.gain.setTargetAtTime(targetGain, now, 0.05);

    // Clique característico de catraca (freehub) da BMX em velocidade
    if (sportId === 'bmx' && clampedSpeed > 0.35) {
      this.freehubPhase += 0.18 + clampedSpeed * 0.22;
      if (this.freehubPhase >= 1) {
        this.freehubPhase -= 1;
        this.playFreehubClick(clampedSpeed);
      }
      return;
    }

    // Batida sutil periódica das juntas da pista / tábuas do píer
    const jointStep = (surfaceType === 'wood' ? 0.065 : 0.032) * (0.6 + clampedSpeed);
    this.jointPhase += jointStep;
    if (this.jointPhase >= 1) {
      this.jointPhase -= 1;
      this.playSurfaceJoint(clampedSpeed, surfaceType);
    }
  }

  /** Clique metálico sutil de catraca (freehub) da bicicleta BMX. */
  playFreehubClick(speedNorm) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1750 + speedNorm * 450, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.012);

    gain.gain.setValueAtTime(Math.min(0.032, 0.014 + speedNorm * 0.014), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.014);

    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.016);
  }

  /** Micro estalo rítmico quando as rodinhas passam por uma emenda de asfalto ou tábua. */
  playSurfaceJoint(speedNorm, surfaceType) {
    if (this.muted || !this.ctx || speedNorm < 0.15) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const startFreq = surfaceType === 'wood' ? 165 : (surfaceType === 'cosmic' ? 240 : 120);
    osc.frequency.setValueAtTime(startFreq + speedNorm * 40, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.028);

    const vol = Math.min(0.055, 0.02 + speedNorm * 0.03);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.035);
  }

  // Canal contínuo de grind metálico em corrimãos
  startGrindSound() {
    if (!this.ctx || this.grindNode) return;
    try {
      const buffer = this.getNoiseBuffer();
      this.grindNode = this.ctx.createBufferSource();
      this.grindNode.buffer = buffer;
      this.grindNode.loop = true;

      this.grindFilter = this.ctx.createBiquadFilter();
      this.grindFilter.type = 'bandpass';
      this.grindFilter.frequency.value = 2600;
      this.grindFilter.Q.value = 3.2;

      this.grindGain = this.ctx.createGain();
      this.grindGain.gain.value = 0;

      this.grindNode.connect(this.grindFilter);
      this.grindFilter.connect(this.grindGain);
      this.grindGain.connect(this.output());
      this.grindNode.start();

      // Ressonância metálica sutil do truck deslizando no trilho
      this.grindRingOsc = this.ctx.createOscillator();
      this.grindRingOsc.type = 'sawtooth';
      this.grindRingOsc.frequency.value = 620;

      const ringFilter = this.ctx.createBiquadFilter();
      ringFilter.type = 'bandpass';
      ringFilter.frequency.value = 1850;
      ringFilter.Q.value = 6.0;

      this.grindRingGain = this.ctx.createGain();
      this.grindRingGain.gain.value = 0;

      this.grindRingOsc.connect(ringFilter);
      ringFilter.connect(this.grindRingGain);
      this.grindRingGain.connect(this.output());
      this.grindRingOsc.start();
    } catch (e) {
      console.warn('Erro ao iniciar som de grind', e);
    }
  }

  /**
   * Atualiza o som contínuo de grind metálico.
   * @param {boolean} active
   * @param {number} [intensity=0.7] - 0..1.4
   */
  updateGrind(active, intensity = 0.7) {
    if (!this.grindGain || !this.grindFilter || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.muted || !active) {
      this.grindGain.gain.setTargetAtTime(0, now, 0.025);
      if (this.grindRingGain) this.grindRingGain.gain.setTargetAtTime(0, now, 0.025);
      return;
    }

    const safeIntensity = Number.isFinite(intensity) ? intensity : 0.7;
    const level = Math.max(0.2, Math.min(1.3, safeIntensity));
    const jitter = (Math.random() - 0.5) * 280;
    this.grindFilter.frequency.setTargetAtTime(2100 + level * 1150 + jitter, now, 0.03);
    this.grindGain.gain.setTargetAtTime(Math.min(0.36, 0.16 + level * 0.15), now, 0.02);

    if (this.grindRingOsc && this.grindRingGain) {
      this.grindRingOsc.frequency.setTargetAtTime(520 + level * 260, now, 0.04);
      this.grindRingGain.gain.setTargetAtTime(Math.min(0.06, 0.025 + level * 0.025), now, 0.025);
    }
  }

  // Camada ambiente de vento em alta velocidade e grandes saltos
  startWindSound() {
    if (!this.ctx || this.windNode) return;
    try {
      const buffer = this.getNoiseBuffer();
      this.windNode = this.ctx.createBufferSource();
      this.windNode.buffer = buffer;
      this.windNode.loop = true;

      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'lowpass';
      this.windFilter.frequency.value = 260;
      this.windFilter.Q.value = 0.8;

      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;

      this.windNode.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.output());
      this.windNode.start();
    } catch (e) {
      console.warn('Erro ao iniciar som de vento', e);
    }
  }

  /**
   * Atualiza o som de vento conforme velocidade normalizada e altura do salto.
   * @param {number} speedRatio - 0..1.4
   * @param {number} [altitude=0] - altura em pixels acima do chão
   */
  updateWind(speedRatio = 0, altitude = 0) {
    if (!this.windGain || !this.windFilter || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.muted) {
      this.windGain.gain.setTargetAtTime(0, now, 0.04);
      return;
    }

    const safeSpeed = Number.isFinite(speedRatio) ? speedRatio : 0;
    const safeAlt = Number.isFinite(altitude) ? altitude : 330;
    const speedFactor = Math.max(0, (safeSpeed - 0.62) / 0.78);
    const airFactor = Math.max(0, Math.min(1, (safeAlt - 70) / 260));
    const intensity = Math.min(1, speedFactor * 0.7 + airFactor * 0.55);

    const targetGain = intensity > 0.02 ? intensity * 0.16 : 0;
    const targetFreq = 220 + intensity * 580;

    this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.08);
    this.windGain.gain.setTargetAtTime(targetGain, now, 0.08);
  }

  // Canal contínuo das rodinhas subindo a curva de madeira/concreto da rampa
  startRampRideSound() {
    if (!this.ctx || this.rampNode) return;
    try {
      const buffer = this.getNoiseBuffer();
      this.rampNode = this.ctx.createBufferSource();
      this.rampNode.buffer = buffer;
      this.rampNode.loop = true;

      this.rampFilter = this.ctx.createBiquadFilter();
      this.rampFilter.type = 'bandpass';
      this.rampFilter.frequency.value = 300;
      this.rampFilter.Q.value = 2.6;

      this.rampGain = this.ctx.createGain();
      this.rampGain.gain.value = 0;

      this.rampNode.connect(this.rampFilter);
      this.rampFilter.connect(this.rampGain);
      this.rampGain.connect(this.output());
      this.rampNode.start();
    } catch (e) {
      console.warn('Erro ao iniciar som de subida de rampa', e);
    }
  }

  /**
   * Atualiza o som contínuo de subida na rampa (ressonância oca subindo até o lip).
   * @param {boolean} active
   * @param {number} [speedNorm=0.6]
   * @param {number} [progress=0] - 0..1 na curva da rampa
   */
  updateRampRide(active, speedNorm = 0.6, progress = 0) {
    if (!this.rampGain || !this.rampFilter || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.muted || !active) {
      this.rampGain.gain.setTargetAtTime(0, now, 0.025);
      return;
    }

    const u = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
    const spd = Math.max(0.2, Math.min(1.4, Number.isFinite(speedNorm) ? speedNorm : 0.6));
    const targetFreq = 250 + u * 540 + spd * 110;
    const targetGain = Math.min(0.32, (0.14 + u * 0.14) * spd);

    this.rampFilter.frequency.setTargetAtTime(targetFreq, now, 0.03);
    this.rampGain.gain.setTargetAtTime(targetGain, now, 0.025);
  }

  // ==========================================================
  // Efeitos sonoros de skate
  // ==========================================================

  // Salto realista adaptado ao esporte ('skate' | 'bmx' | 'scooter' | 'skates')
  playJump(sportId = 'skate', isDoubleJump = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (sportId === 'bmx') {
      // Bunny hop: impulso grave de pneu/suspensão
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(165, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.09);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(this.output());
      osc.start(now);
      osc.stop(now + 0.11);

      const spring = this.ctx.createOscillator();
      const sGain = this.ctx.createGain();
      spring.type = 'triangle';
      spring.frequency.setValueAtTime(240, now + 0.02);
      spring.frequency.exponentialRampToValueAtTime(420, now + 0.11);
      sGain.gain.setValueAtTime(0.11, now + 0.02);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      spring.connect(sGain);
      sGain.connect(this.output());
      spring.start(now + 0.02);
      spring.stop(now + 0.13);
      return;
    }

    if (sportId === 'scooter') {
      // Estalo metálico leve de deck de alumínio
      const ping = this.ctx.createOscillator();
      const pGain = this.ctx.createGain();
      ping.type = 'triangle';
      ping.frequency.setValueAtTime(1180, now);
      ping.frequency.exponentialRampToValueAtTime(480, now + 0.06);
      pGain.gain.setValueAtTime(0.18, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
      ping.connect(pGain);
      pGain.connect(this.output());
      ping.start(now);
      ping.stop(now + 0.07);

      const body = this.ctx.createOscillator();
      const bGain = this.ctx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(290, now);
      body.frequency.exponentialRampToValueAtTime(135, now + 0.07);
      bGain.gain.setValueAtTime(0.18, now);
      bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      body.connect(bGain);
      bGain.connect(this.output());
      body.start(now);
      body.stop(now + 0.08);
      return;
    }

    if (sportId === 'skates') {
      // Impulso limpo e ágil de patins (brilho agudo extra no Pulo Duplo!)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = isDoubleJump ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isDoubleJump ? 420 : 280, now);
      osc.frequency.exponentialRampToValueAtTime(isDoubleJump ? 940 : 620, now + 0.095);
      gain.gain.setValueAtTime(isDoubleJump ? 0.19 : 0.17, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      osc.connect(gain);
      gain.connect(this.output());
      osc.start(now);
      osc.stop(now + 0.12);
      return;
    }

    // Padrão Skate: 1. Estalo seco do tail batendo na pista (snap de madeira)
    const snapBuf = this.getSfxNoiseBuffer('jump_snap', 0.055, t => Math.pow(1 - t, 4));
    const snapSrc = this.ctx.createBufferSource();
    snapSrc.buffer = snapBuf;

    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = 'bandpass';
    snapFilter.frequency.setValueAtTime(1950, now);
    snapFilter.Q.value = 1.4;

    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.32, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    snapSrc.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.output());
    snapSrc.start(now);

    // 2. Corpo amadeirado do shape (ressonância do maple)
    const woodOsc = this.ctx.createOscillator();
    const woodGain = this.ctx.createGain();
    woodOsc.type = 'triangle';
    woodOsc.frequency.setValueAtTime(240, now);
    woodOsc.frequency.exponentialRampToValueAtTime(98, now + 0.075);

    woodGain.gain.setValueAtTime(0.24, now);
    woodGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    woodOsc.connect(woodGain);
    woodGain.connect(this.output());
    woodOsc.start(now);
    woodOsc.stop(now + 0.085);

    // 3. Leve raspada da lixa no tênis (slide do ollie)
    const gripBuf = this.getSfxNoiseBuffer('jump_grip', 0.07, t => Math.sin(t * Math.PI) * 0.5);
    const gripSrc = this.ctx.createBufferSource();
    gripSrc.buffer = gripBuf;

    const gripFilter = this.ctx.createBiquadFilter();
    gripFilter.type = 'highpass';
    gripFilter.frequency.setValueAtTime(2800, now + 0.015);

    const gripGain = this.ctx.createGain();
    gripGain.gain.setValueAtTime(0.08, now + 0.015);
    gripGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    gripSrc.connect(gripFilter);
    gripFilter.connect(gripGain);
    gripGain.connect(this.output());
    gripSrc.start(now + 0.015);
  }

  // Som de remada com o pé no asfalto ao acelerar
  playPush() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const buf = this.getSfxNoiseBuffer('push', 0.11, t => Math.sin(t * Math.PI) * (1 - t * 0.45));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + 0.1);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.output());
    src.start(now);
  }

  // Som de Rampa (saída no coping + vento ascendente; brilho extra no Lip Boost)
  playRamp(boosted = false) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // 1. Estalo metálico do coping no topo da rampa
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'triangle';
    popOsc.frequency.setValueAtTime(boosted ? 480 : 340, now);
    popOsc.frequency.exponentialRampToValueAtTime(140, now + 0.065);
    popGain.gain.setValueAtTime(boosted ? 0.24 : 0.18, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    popOsc.connect(popGain);
    popGain.connect(this.output());
    popOsc.start(now);
    popOsc.stop(now + 0.075);

    // 2. Whoosh ascendente de decolagem
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(boosted ? 1040 : 820, now + 0.30);

    gain.gain.setValueAtTime(boosted ? 0.28 : 0.22, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.36);

    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.37);

    // 3. Brilho harmônico extra quando acerta o Lip Boost no topo
    if (boosted) {
      const notes = [587.33, 880, 1174.66];
      notes.forEach((freq, idx) => {
        const bOsc = this.ctx.createOscillator();
        const bGain = this.ctx.createGain();
        const t = now + idx * 0.035;
        bOsc.type = 'triangle';
        bOsc.frequency.setValueAtTime(freq, t);
        bGain.gain.setValueAtTime(0.14, t);
        bGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        bOsc.connect(bGain);
        bGain.connect(this.output());
        bOsc.start(t);
        bOsc.stop(t + 0.19);
      });
    }
  }

  // Som curto e seco do shape girando no ar (Kickflip / Super Flip)
  playBoardFlip() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const buf = this.getSfxNoiseBuffer('board_flip', 0.045, t => Math.pow(1 - t, 3.5));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.Q.value = 2.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.output());
    src.start(now);
  }

  // Som de Manobra no Ar (toque de flip + acorde energético)
  playTrick(trickIndex = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [
      [523.25, 659.25, 783.99],  // Dó, Mi, Sol
      [587.33, 739.99, 880.00],  // Ré, Fá#, Lá
      [659.25, 830.61, 987.77],  // Mi, Sol#, Si
      [783.99, 987.77, 1174.66]  // Sol, Si, Ré
    ];
    const chords = notes[Math.abs(trickIndex) % notes.length];

    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.045;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.14, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(this.output());

      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  // Som de Pista Rachando e Caindo
  playPavementCrumble() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.linearRampToValueAtTime(32, now + 0.38);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(360, now);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.44);
  }

  // Som de Moeda Coletada
  playCoin() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now);        // B5
    osc2.frequency.setValueAtTime(1318.51, now + 0.075); // E6

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.output());

    osc1.start(now);
    osc1.stop(now + 0.08);
    osc2.start(now + 0.075);
    osc2.stop(now + 0.25);
  }

  // Som de Power-up (Estrela Turbo / Escudo)
  playPowerup() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [440, 554.37, 659.25, 880];
    freqs.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.065;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain);
      gain.connect(this.output());
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  // Som de Colisão / Dano
  playHit() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(175, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.28);

    gain.gain.setValueAtTime(0.36, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Som realista das rodas batendo na superfície ao pousar.
   * @param {number} [impactNorm=0.5] - intensidade normalizada 0..1 (aceita velocidade bruta)
   * @param {string} [surfaceType='asphalt'] - tipo da superfície
   * @param {string} [sportId='skate'] - 'skate' | 'bmx' | 'scooter' | 'skates'
   */
  playLand(impactNorm = 0.5, surfaceType = 'asphalt', sportId = 'skate') {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Retrocompatível caso alguém passe velocidade vertical bruta (ex.: 14)
    const norm = Math.max(0.15, Math.min(1, impactNorm > 1.5 ? impactNorm / 18 : impactNorm));

    // 1. Corpo grave do impacto (pneus/suspensão na BMX, trucks no skate/patinete)
    const thudOsc = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thudOsc.type = 'sine';
    let baseThud = surfaceType === 'wood' ? 145 : (surfaceType === 'metal' ? 210 : 115);
    if (sportId === 'bmx') baseThud = 86;
    else if (sportId === 'scooter') baseThud = 175;
    else if (sportId === 'skates') baseThud = 140;

    thudOsc.frequency.setValueAtTime(baseThud + norm * 30, now);
    thudOsc.frequency.exponentialRampToValueAtTime(sportId === 'bmx' ? 34 : 42, now + (sportId === 'bmx' ? 0.13 : 0.09));

    thudGain.gain.setValueAtTime((sportId === 'bmx' ? 0.18 : 0.14) + norm * 0.22, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + (sportId === 'bmx' ? 0.14 : 0.11));

    thudOsc.connect(thudGain);
    thudGain.connect(this.output());
    thudOsc.start(now);
    thudOsc.stop(now + 0.15);

    // 2. Estalo duplo rápido (rodas traseiras + dianteiras tocando a pista)
    const hitOffsets = sportId === 'bmx' ? [0] : [0, 0.016];
    let cutoff = surfaceType === 'wood' ? 1100 : (surfaceType === 'metal' ? 2800 : 1750);
    if (sportId === 'bmx') cutoff *= 0.55;
    else if (sportId === 'scooter') cutoff *= 1.35;
    else if (sportId === 'skates') cutoff *= 1.15;

    const landBuf = this.getSfxNoiseBuffer('land_hit', 0.085, t => Math.pow(1 - t, 3.2));
    hitOffsets.forEach((offset, idx) => {
      const t = now + offset;
      const src = this.ctx.createBufferSource();
      src.buffer = landBuf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff, t);
      filter.frequency.exponentialRampToValueAtTime(280, t + 0.085);

      const gain = this.ctx.createGain();
      const sportGain = sportId === 'bmx' ? 0.65 : (sportId === 'skates' ? 0.78 : 1.0);
      const vol = (0.12 + norm * 0.16) * sportGain * (idx === 0 ? 1 : 0.72);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.output());
      src.start(t);
    });
  }

  // Acorde descendente de fim de jogo
  playGameOver() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [392.00, 329.63, 261.63, 196.00];

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.16;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);

      osc.connect(gain);
      gain.connect(this.output());
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  // Fanfarra triunfal e alegre de passagem de fase
  playStageClear() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.50];

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.085;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.24, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.52);

      osc.connect(gain);
      gain.connect(this.output());
      osc.start(t);
      osc.stop(t + 0.56);
    });
  }

  // Efeito sonoro de resgate / salvamento ao cair no abismo
  playRescue() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.28);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.35);
  }

  // Micro feedback tátil sonoro para cliques na interface
  playUI(kind = 'click') {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    if (kind === 'back') {
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.05);
    } else {
      osc.frequency.setValueAtTime(560, now);
      osc.frequency.exponentialRampToValueAtTime(760, now + 0.045);
    }

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /** Impacto crocante quando o skatista esmaga obstáculos no Turbo/Radical. */
  playSmash() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const buf = this.getSfxNoiseBuffer('smash', 0.14, t => Math.pow(1 - t, 1.8));
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(900, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.output());
    src.start(now);

    const osc = this.ctx.createOscillator();
    const oGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.12);
    oGain.gain.setValueAtTime(0.28, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(oGain);
    oGain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.15);
  }

  /** Mola alegre do Trampolim. */
  playBounce() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.22);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.26);
  }

  /** Fanfarra explosiva ao ativar o Modo Radical! */
  playFeverStart() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * 0.045;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.20, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain);
      gain.connect(this.output());
      osc.start(t);
      osc.stop(t + 0.30);
    });
  }

  /** Nota ascendente para cada letra de L-U-I-G-I. */
  playLetter(index = 0) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const scale = [587.33, 659.25, 783.99, 880.0, 1046.5];
    const f = scale[index % scale.length];
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.25, now + 0.14);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.25);
  }

  /** Whoosh rápido ao passar raspando por um obstáculo (Quase!). */
  playNearMiss() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(720, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.09);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.output());
    osc.start(now);
    osc.stop(now + 0.12);
  }

  /** Jingle rápido de missão/troféu concluído. */
  playMissionComplete() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    [659.25, 783.99, 1046.5].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.065;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain);
      gain.connect(this.output());
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  /** Fanfarra de Baú de Nível ou compra na Oficina. */
  playChestOpen() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + i * 0.055;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
      osc.connect(gain);
      gain.connect(this.output());
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  setMusicContext(stageIndex = 0, boosted = false) {
    this.musicStage = Math.max(0, Math.min(3, Math.floor(stageIndex || 0)));
    this.musicBoosted = !!boosted;
  }

  // ==========================================================
  // Trilha sonora procedural dinâmica por Bioma + Turbo/Radical
  // ==========================================================

  startMusic() {
    this.musicWanted = true;
    if (this.muted || this.musicPlaying || !this.ctx) return;
    this.musicPlaying = true;

    const themes = [
      // Fase 1: Skatepark Rock-Synth animado (Lá menor)
      {
        bass: [110, 110, 130.81, 146.83, 110, 110, 164.81, 146.83, 98, 98, 123.47, 146.83, 130.81, 146.83, 164.81, 196.0],
        lead: [440, 0, 523.25, 587.33, 659.25, 0, 523.25, 440, 392, 0, 493.88, 587.33, 659.25, 783.99, 659.25, 523.25],
        wave: 'triangle',
        stepMs: 155
      },
      // Fase 2: Metrópole Cyberpunk Neon (Synthwave pulsante)
      {
        bass: [98, 98, 196, 98, 116.54, 116.54, 233.08, 116.54, 130.81, 130.81, 261.63, 130.81, 146.83, 146.83, 196, 146.83],
        lead: [392, 587.33, 466.16, 783.99, 466.16, 698.46, 587.33, 466.16, 523.25, 783.99, 622.25, 523.25, 587.33, 880, 783.99, 698.46],
        wave: 'sawtooth',
        stepMs: 145
      },
      // Fase 3: Praia & Píer Tropical (Alegre marimba/solar)
      {
        bass: [130.81, 0, 164.81, 196.0, 146.83, 0, 196.0, 220.0, 164.81, 0, 196.0, 246.94, 196.0, 164.81, 146.83, 130.81],
        lead: [523.25, 659.25, 783.99, 659.25, 880, 783.99, 659.25, 523.25, 587.33, 739.99, 880, 783.99, 1046.5, 880, 783.99, 659.25],
        wave: 'sine',
        stepMs: 150
      },
      // Fase 4: Pista Cósmica das Estrelas (Espacial etéreo)
      {
        bass: [82.41, 164.81, 110, 164.81, 98, 196, 123.47, 196, 110, 220, 146.83, 220, 130.81, 261.63, 196, 164.81],
        lead: [659.25, 830.61, 987.77, 1318.5, 587.33, 783.99, 987.77, 1174.66, 659.25, 880, 1046.5, 1318.5, 783.99, 987.77, 1174.66, 1567.98],
        wave: 'triangle',
        stepMs: 142
      }
    ];

    let noteIdx = 0;

    const playNote = () => {
      if (!this.musicPlaying || this.muted || !this.ctx) return;

      const theme = themes[this.musicStage % themes.length] || themes[0];
      const delay = this.musicBoosted ? Math.max(116, theme.stepMs - 24) : theme.stepMs;

      // Evita enfileirar osciladores enquanto o AudioContext ainda está suspenso
      if (this.ctx.state !== 'running') {
        this.musicTimer = setTimeout(playNote, delay);
        return;
      }

      const now = this.ctx.currentTime;
      const step = noteIdx % 16;
      const freq = theme.bass[step];
      const leadFreq = theme.lead[step];

      if (freq > 0) {
        // Baixo synthwave quente
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime((step % 4 === 0 ? 540 : 400) + (this.musicBoosted ? 260 : 0), now);

        gain.gain.setValueAtTime(0.056, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.output());

        osc.start(now);
        osc.stop(now + 0.17);
      }

      if (leadFreq > 0) {
        const lOsc = this.ctx.createOscillator();
        const lGain = this.ctx.createGain();
        lOsc.type = theme.wave;
        lOsc.frequency.setValueAtTime(leadFreq, now);
        lGain.gain.setValueAtTime(this.musicBoosted ? 0.044 : 0.028, now);
        lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        lOsc.connect(lGain);
        lGain.connect(this.output());
        lOsc.start(now);
        lOsc.stop(now + 0.15);
      }

      // Bumbo nos tempos fortes + chimbal leve nos contratempos
      if (step % 4 === 0) {
        const kick = this.ctx.createOscillator();
        const kGain = this.ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(118, now);
        kick.frequency.exponentialRampToValueAtTime(42, now + 0.09);
        kGain.gain.setValueAtTime(0.085, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        kick.connect(kGain);
        kGain.connect(this.output());
        kick.start(now);
        kick.stop(now + 0.11);
      } else if (step % 4 === 2 || (this.musicBoosted && step % 2 === 1)) {
        const hatBuf = this.getSfxNoiseBuffer('music_hat', 0.032, t => Math.pow(1 - t, 3.5));
        if (hatBuf) {
          const hat = this.ctx.createBufferSource();
          hat.buffer = hatBuf;
          const hFilter = this.ctx.createBiquadFilter();
          hFilter.type = 'highpass';
          hFilter.frequency.setValueAtTime(6800, now);
          const hGain = this.ctx.createGain();
          hGain.gain.setValueAtTime(this.musicBoosted ? 0.022 : 0.014, now);
          hGain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);
          hat.connect(hFilter);
          hFilter.connect(hGain);
          hGain.connect(this.output());
          hat.start(now);
        }
      }

      noteIdx++;
      this.musicTimer = setTimeout(playNote, delay);
    };

    playNote();
  }

  stopMusic(keepWanted = false) {
    this.musicPlaying = false;
    if (!keepWanted) this.musicWanted = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

window.soundSystem = new SoundSystem();
