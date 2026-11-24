// ============================================================
// Física do jogador: gravidade, saltos, rampas e manobras aéreas
//
// A simulação roda em passos fixos de 60 Hz (ver main.js), então as
// constantes abaixo são "por passo" e independem da taxa do monitor.
// ============================================================

const PHYS = {
  GRAVITY:        0.62,   // aceleração base por passo
  APEX_GRAVITY:   0.46,   // leve hang-time perto do ápice do salto
  APEX_THRESHOLD: 2.6,    // faixa de |vy| considerada ápice
  FALL_GRAVITY:   0.70,   // gravidade mais firme na descida (peso real)
  FAST_FALL_ACC:  0.85,   // aceleração extra ao segurar Baixo/S no ar
  MAX_FALL:       20,     // velocidade terminal de queda
  MAX_FAST_FALL:  24,     // velocidade terminal em fast-fall
  JUMP_VELOCITY: -14.2,   // ollie
  GRIND_JUMP_VEL:-13.8,   // ollie saindo de um grind
  RAMP_VELOCITY: -19.8,   // lançamento de rampa
  JUMP_CUT:      -7.2,    // velocidade mantida ao soltar a tecla cedo
  MIN_JUMP_STEPS: 6,      // passos de subida garantidos antes do corte
  COYOTE_STEPS:   7,      // passos de tolerância após sair da borda
  BUFFER_STEPS:   7,      // passos de tolerância ao apertar pular antes de pousar
  SNAP_TOLERANCE: 8,      // folga para considerar "apoiado" na plataforma
  BASE_SPEED:     6.0,
  MAX_SPEED:      12.5,
  ACCELERATION:   0.0016,
  BRAKE_DECEL:    0.10,   // freio suave (nunca cai abaixo de BASE_SPEED)
  TURBO_FACTOR:   1.4,
  HOME_X:         190     // posição fixa do jogador na tela
};

const STAGES = [
  { id: 'skatepark', name: 'Skatepark ao Pôr do Sol', dist: 0, nextDist: 600, icon: '🌇', theme: 'skatepark' },
  { id: 'metropolis', name: 'Metrópole Cyberpunk Neon', dist: 600, nextDist: 1400, icon: '🏙️', theme: 'neon' },
  { id: 'beach', name: 'Praia & Píer Tropical', dist: 1400, nextDist: 2400, icon: '🌴', theme: 'beach' },
  { id: 'cosmic', name: 'Pista Cósmica das Estrelas', dist: 2400, nextDist: Infinity, icon: '🚀', theme: 'cosmic' }
];

const TRICKS = [
  { key: 'KeyZ',  name: 'KICKFLIP',   pts: 250, targetAngle:  Math.PI * 2,   rotSpeed:  0.32, color: '#22d3ee', style: 'flip' },
  { key: 'KeyX',  name: '360 SPIN',   pts: 400, targetAngle:  Math.PI * 2,   rotSpeed:  0.30, color: '#fbbf24', style: 'spin' },
  { key: 'KeyC',  name: 'INDY GRAB',  pts: 350, targetAngle: -Math.PI * 1.0, rotSpeed: -0.22, color: '#f43f7e', style: 'grab' },
  { key: 'Space', name: 'SUPER FLIP', pts: 600, targetAngle:  Math.PI * 2,   rotSpeed:  0.38, color: '#8b5cf6', style: 'super' }
];

const SPORTS = {
  skate: {
    id: 'skate',
    name: 'Skate',
    icon: '🛹',
    tagline: 'Equilibrado e clássico',
    tip: 'Manobras precisas, bom controle no ar e ótimo equilíbrio em tudo.',
    speedMult: 1.0,
    accelMult: 1.0,
    jumpMult: 1.0,
    rampBoostMult: 1.0,
    trickSpeedMult: 1.0,
    grindScoreMult: 1.0,
    landingSoftness: 1.0,
    airDoubleJump: false,
    stats: { velocidade: 'Alta', salto: 'Alto', manobras: 'Clássicas' },
    touchLabels: ['FLIP', '360°', 'GRAB'],
    grindLabel: 'GRIND!',
    tricks: TRICKS
  },
  bmx: {
    id: 'bmx',
    name: 'Bicicleta (BMX)',
    icon: '🚲',
    tagline: 'Super Rampa & Estável',
    tip: 'Voa mais alto nas rampas, pousa macio e manda Peg Grind metálico!',
    speedMult: 1.08,
    accelMult: 1.04,
    jumpMult: 0.98,
    rampBoostMult: 1.12,
    trickSpeedMult: 0.88,
    grindScoreMult: 1.15,
    landingSoftness: 1.25,
    airDoubleJump: false,
    stats: { velocidade: 'Muito Alta', salto: 'Super Rampa', manobras: 'Pesadas' },
    touchLabels: ['WHIP', 'BAR', 'SUPER'],
    grindLabel: 'PEG GRIND!',
    tricks: [
      { key: 'KeyZ',  name: 'TAILWHIP', pts: 280, targetAngle:  Math.PI * 2,   rotSpeed:  0.28, color: '#22d3ee', style: 'flip' },
      { key: 'KeyX',  name: 'BARSPIN',  pts: 400, targetAngle:  Math.PI * 2,   rotSpeed:  0.27, color: '#fbbf24', style: 'spin' },
      { key: 'KeyC',  name: 'SUPERMAN', pts: 380, targetAngle: -Math.PI * 1.0, rotSpeed: -0.20, color: '#f43f7e', style: 'grab' },
      { key: 'Space', name: 'BACKFLIP', pts: 650, targetAngle: -Math.PI * 2,   rotSpeed: -0.34, color: '#8b5cf6', style: 'super' }
    ]
  },
  scooter: {
    id: 'scooter',
    name: 'Patinete',
    icon: '🛴',
    tagline: 'Ágil & Combo Rápido',
    tip: 'Pulo ágil e manobras 25% mais rápidas para encadear combos fáceis!',
    speedMult: 0.98,
    accelMult: 1.08,
    jumpMult: 1.07,
    rampBoostMult: 1.04,
    trickSpeedMult: 1.25,
    grindScoreMult: 1.20,
    landingSoftness: 1.05,
    airDoubleJump: false,
    stats: { velocidade: 'Ágil', salto: 'Muito Alto', manobras: 'Ultra Rápidas' },
    touchLabels: ['WHIP', 'BAR', 'GRAB'],
    grindLabel: 'DECK GRIND!',
    tricks: [
      { key: 'KeyZ',  name: 'TAILWHIP',  pts: 250, targetAngle:  Math.PI * 2,   rotSpeed:  0.40, color: '#22d3ee', style: 'flip' },
      { key: 'KeyX',  name: 'BARSPIN',   pts: 380, targetAngle:  Math.PI * 2,   rotSpeed:  0.38, color: '#fbbf24', style: 'spin' },
      { key: 'KeyC',  name: 'NO-HANDER', pts: 350, targetAngle: -Math.PI * 1.0, rotSpeed: -0.28, color: '#f43f7e', style: 'grab' },
      { key: 'Space', name: 'BRI FLIP',  pts: 600, targetAngle:  Math.PI * 2,   rotSpeed:  0.46, color: '#8b5cf6', style: 'super' }
    ]
  },
  skates: {
    id: 'skates',
    name: 'Patins',
    icon: '🛼',
    tagline: 'Veloz + Pulo Duplo',
    tip: 'Acelera rápido, tem Pulo Duplo no ar e pontuação máxima no Soul Grind!',
    speedMult: 1.06,
    accelMult: 1.18,
    jumpMult: 0.96,
    rampBoostMult: 1.02,
    trickSpeedMult: 1.08,
    grindScoreMult: 1.30,
    landingSoftness: 1.08,
    airDoubleJump: true,
    stats: { velocidade: 'Veloz', salto: 'Pulo Duplo', manobras: 'Soul Grind' },
    touchLabels: ['MUTE', '360°', 'SOUL'],
    grindLabel: 'SOUL GRIND!',
    tricks: [
      { key: 'KeyZ',  name: 'MUTE GRAB',  pts: 260, targetAngle:  Math.PI * 2,   rotSpeed:  0.34, color: '#22d3ee', style: 'flip' },
      { key: 'KeyX',  name: '360° SPIN',  pts: 400, targetAngle:  Math.PI * 2,   rotSpeed:  0.32, color: '#fbbf24', style: 'spin' },
      { key: 'KeyC',  name: 'SOUL GRAB',  pts: 360, targetAngle: -Math.PI * 1.0, rotSpeed: -0.24, color: '#f43f7e', style: 'grab' },
      { key: 'Space', name: 'MISTY FLIP', pts: 620, targetAngle:  Math.PI * 2,   rotSpeed:  0.40, color: '#8b5cf6', style: 'super' }
    ]
  }
};

class Player {
  constructor() {
    this.reset();
  }

  reset(world, opts = {}) {
    this.x = PHYS.HOME_X;
    this.vy = 0;

    // Modo de partida ('classic' | 'time60' | 'free')
    this.gameMode = opts.gameMode || 'classic';
    this.difficulty = opts.difficulty === 'hard' ? 'hard' : 'easy';
    this.timeLeftSteps = this.gameMode === 'time60' ? 60 * 60 : 0;

    // Esporte ativo (skate, bmx, scooter, skates)
    const initialSport = opts.sportId || (window.game && window.game.selectedSport) || this.sportId || 'skate';
    this.sportId = 'skate';
    this.sport = SPORTS.skate;
    this.baseSpeed = PHYS.BASE_SPEED;
    this.maxSpeed = PHYS.MAX_SPEED;
    this.speed = PHYS.BASE_SPEED;
    this.doubleJumpAvailable = false;
    this.setSport(initialSport);
    this.speed = this.baseSpeed;
    this.speedNormalized = this.speed / this.maxSpeed;
    this.isAccelerating = false;
    this.isPushing = false;
    this.pushPhase = 0;
    this.isBraking = false;

    // Estado de contato com o solo, rampa e grind
    this.onGround = true;
    this.isDucking = false;
    this.isFastFalling = false;
    this.isGrinding = false;
    this.grindIntensity = 0;
    this.currentRail = null;
    this.grindTicks = 0;
    this.isOnRamp = false;
    this.isOnElevated = false;
    this.rampProgress = 0;
    this.currentRamp = null;
    this.rampBoostBuffered = false;
    this.surfaceType = 'asphalt';
    this.coyoteTimer = PHYS.COYOTE_STEPS;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.spaceAirArmed = false;
    this.upAirArmed = false;
    this._airTapSpace = false;
    this._airTapUp = false;
    this.airSteps = 0;

    // Manobras e combo
    this.trickState = null;
    this.trickProgress = 0;
    this.tricksInAir = [];
    this.rotation = 0;
    this.comboMultiplier = 1;
    this.comboPoints = 0;
    this.lastTrickName = '';
    this.bestCombo = 1;
    this.comboLinkTimer = 0;
    this.linkedComboMult = 1;

    // Progresso & Fases (inicia com 3 vidas e sobe até o teto de 5 ao vencer fases)
    this.lives = 3;
    this.maxLives = 5;
    const startStage = Math.max(0, Math.min(STAGES.length - 1, Math.floor(opts.startStageIndex || 0)));
    this.currentStageIndex = startStage;
    this.score = 0;
    this.distance = startStage > 0 ? STAGES[startStage].dist : 0;
    this.coins = 0;
    this.invincibleTimer = 0;
    this.turboTimer = 0;
    this.turboDuration = 1;
    this.magnetTimer = 0;
    this.magnetDuration = 1;
    this.doubleTimer = 0;
    this.doubleDuration = 1;
    this.feverGauge = 0;
    this.feverTimer = 0;
    this.feverDuration = 360;
    this.hasShield = false;
    this.isGameOver = false;
    this.deathReason = '';

    // Desafio da Palavra L-U-I-G-I e contadores da sessão
    this.lettersCollected = [false, false, false, false, false];
    this.nextLetterIndex = 0;
    this.smashedCount = 0;
    this.nearMissCount = 0;
    this.lipBoostCount = 0;
    this.wordsCompleted = 0;

    // Animação articulada e telemetria física
    this.squash = 1;          // 1 = neutro, <1 achatado, >1 esticado
    this.squashVel = 0;       // velocidade da mola elástica (spring-damper)
    this.stretchX = 1;
    this.lean = 0;
    this.pitch = 0;
    this.bob = 0;
    this.wheelPhase = 0;
    this.wheelSpin = 0;
    this.olliePopTimer = 0;
    this.boardFlipAngle = 0;
    this.boardTilt = 0;
    this.boardDropY = 0;
    this.crouchBlend = 0;
    this.pushBlend = 0;
    this.skewX = 0;
    this.currentPose = 'skate';
    this.prevPose = 'skate';
    this.poseBlend = 1;
    this.stridePhase = 0;
    this.rigPose = null;
    this.animTime = 0;
    this.landingImpact = 0;
    this.lastLandingImpact = 0;
    this.trail = [];
    this.frameEvents = [];

    this.applyCharacterDimensions();

    // Posiciona os pés exatamente sobre o asfalto
    const groundTop = world ? world.groundY : 480;
    this.y = groundTop - this.height;
    this.prevBottom = this.y + this.height;
    this.groundBelowY = groundTop;
    this.airHeight = 0;

    if (world) {
      world.playerDistance = this.distance;
      // Ao iniciar diretamente em uma fase já acima do recorde, evita disparar "NOVO RECORDE" no frame 0
      if (world.recordDistance > 0 && this.distance >= world.recordDistance) {
        world.recordPassed = true;
      }
    }
  }

  getSportLifeLabel() {
    if (this.sportId === 'bmx') return 'BMX';
    if (this.sportId === 'scooter') return 'PATINETE';
    if (this.sportId === 'skates') return 'PATINS';
    return 'SKATE';
  }

  setSport(sportId) {
    const s = SPORTS[sportId] || SPORTS.skate;
    this.sportId = s.id;
    this.sport = s;
    this.baseSpeed = PHYS.BASE_SPEED * (s.speedMult || 1);
    this.maxSpeed = PHYS.MAX_SPEED * (s.speedMult || 1);
    if (!this.speed || this.speed < this.baseSpeed) {
      this.speed = this.baseSpeed;
    } else if (this.speed > this.maxSpeed * 1.35) {
      this.speed = this.maxSpeed * 1.35;
    }
    this.speedNormalized = this.speed / this.maxSpeed;
    this.doubleJumpAvailable = !!s.airDoubleJump;
    return s;
  }

  emitEvent(type, data = {}) {
    this.frameEvents.push({
      type,
      intensity: data.intensity !== undefined ? data.intensity : 1,
      boosted: !!data.boosted,
      doubleJump: !!data.doubleJump,
      sportId: this.sportId || 'skate',
      surfaceType: data.surfaceType || this.surfaceType || 'asphalt',
      x: data.x !== undefined ? data.x : this.x + this.width * 0.5,
      y: data.y !== undefined ? data.y : this.bottom
    });
  }

  /** Curva exata compartilhada com GameWorld para subida e inclinação em rampa. */
  static sampleRamp(ramp, worldX, world) {
    if (world && typeof world.getRampSurface === 'function') {
      return world.getRampSurface(ramp, worldX);
    }
    const w = Math.max(1, ramp.width || 176);
    const h = ramp.height || 66;
    const baseY = ramp.y + h;
    const u = Math.max(0, Math.min(1, (worldX - ramp.x) / w));
    const y = baseY - h * u * u;
    const angle = Math.atan2(-2 * h * u, w);
    return { y, angle, u, onLip: u >= 0.78 };
  }

  // ---- Dimensões vindas do personagem selecionado --------------------------

  applyCharacterDimensions() {
    const char = window.characterManager && window.characterManager.getSelected();
    this.width      = (char && char.width)      || 100;
    this.height     = (char && char.height)     || 130;
    this.duckHeight = (char && char.duckHeight) || 85;
  }

  getCurrentHeight() {
    return this.isDucking ? this.duckHeight : this.height;
  }

  get bottom() {
    return this.y + this.getCurrentHeight();
  }

  /** Reposiciona o topo mantendo os pés no mesmo lugar. */
  setBottom(value) {
    this.y = value - this.getCurrentHeight();
  }

  // ---- Laço de simulação ---------------------------------------------------

  // ---- Leitura de entrada -------------------------------------------------
  //
  // Aceita tanto a classe Input (com buffer de toque) quanto um objeto
  // simples { Space: true }, o que mantém a física fácil de testar.

  static held(input, code) {
    return input.isHeld ? input.isHeld(code) : !!input[code];
  }

  static tapped(input, code) {
    return input.consumeTap ? input.consumeTap(code) : false;
  }

  notifyProgress(type, amount = 1, ctx = {}) {
    if (window.progressionManager && typeof window.progressionManager.recordRunEvent === 'function') {
      const notes = window.progressionManager.recordRunEvent(type, amount, {
        ...ctx,
        stageIndex: this.currentStageIndex,
        sportId: this.sportId,
        bestCombo: this.bestCombo
      });
      if (notes && notes.length > 0 && window.game && typeof window.game.onProgressionNotifications === 'function') {
        window.game.onProgressionNotifications(notes);
      }
    }
  }

  getScoreMult() {
    const rankMult = (window.progressionManager && typeof window.progressionManager.getScoreMultiplier === 'function')
      ? window.progressionManager.getScoreMultiplier()
      : 1;
    const activeMult = (this.doubleTimer > 0 ? 2 : 1) * (this.feverTimer > 0 ? 2 : 1);
    return rankMult * activeMult;
  }

  addScore(basePts) {
    const pts = Math.max(1, Math.round(basePts * this.getScoreMult()));
    this.score += pts;
    return pts;
  }

  addFever(amount) {
    if (this.feverTimer > 0) return;
    const bonusMult = (window.progressionManager && typeof window.progressionManager.getUpgradeBonus === 'function')
      ? window.progressionManager.getUpgradeBonus('fever')
      : 1;
    this.feverGauge = Math.min(100, this.feverGauge + amount * bonusMult);
    if (this.feverGauge >= 100) {
      this.activateFever();
    }
  }

  activateFever() {
    this.feverGauge = 0;
    this.feverTimer = this.feverDuration || 360;
    this.invincibleTimer = Math.max(this.invincibleTimer, 30);
    this.emitEvent('fever_start', { intensity: 1.5 });
    this.notifyProgress('fever', 1);

    if (window.soundSystem && window.soundSystem.playFeverStart) window.soundSystem.playFeverStart();
    if (window.particleSystem) {
      if (window.particleSystem.emitShockwave) {
        window.particleSystem.emitShockwave(this.x + this.width * 0.5, this.y + this.getCurrentHeight() * 0.5, '#fbbf24', 120);
      }
      if (window.particleSystem.emitConfetti) {
        window.particleSystem.emitConfetti(this.x + this.width * 0.5, this.y, 32);
      }
      if (window.particleSystem.addFloatingText) {
        window.particleSystem.addFloatingText('MODO RADICAL! x2', this.x + this.width * 0.5, this.y - 74, '#fbbf24', 28);
      }
    }
    if (window.game) {
      window.game.camera.shake(10);
      window.game.flash('power');
    }
  }

  update(world, keys) {
    if (this.isGameOver) return;
    this.frameEvents.length = 0;

    // Trocar de personagem no meio da partida não pode empurrar os pés
    const feet = this.bottom;
    this.applyCharacterDimensions();
    this.setBottom(feet);

    this.updateTimers();
    if (this.gameMode === 'time60') {
      this.timeLeftSteps--;
      if (this.timeLeftSteps <= 0) {
        this.timeLeftSteps = 0;
        this.isGameOver = true;
        this.deathReason = 'Tempo esgotado! Corrida épica!';
        if (window.soundSystem && window.soundSystem.playStageClear) window.soundSystem.playStageClear();
        return;
      }
    }

    this.updateSpeed(keys);
    this.speedNormalized = this.speed / this.maxSpeed;

    const prevDistInt = Math.floor(this.distance);
    this.distance += this.speed * 0.1;
    const newDistInt = Math.floor(this.distance);
    if (newDistInt > prevDistInt) {
      this.notifyProgress('distance', newDistInt - prevDistInt, { distance: newDistInt });
    }
    this.score += Math.max(1, Math.floor(this.speed * 0.05 * (this.feverTimer > 0 ? 2 : 1) * (this.doubleTimer > 0 ? 2 : 1)));

    this.checkStageProgression();
    this.handleDuck(keys);
    this.handleJumpInput(keys);
    this.integrate(keys);

    // A colisão acontece depois do movimento, usando varredura entre
    // a posição anterior e a atual — nenhuma velocidade atravessa a pista.
    this.resolveGroundCollision(world);
    this.updateGroundBelow(world);
    this.returnHome(world);
    this.updateAnimation(world);

    // Emite rastro personalizado da Oficina (ou rastro extra no Modo Radical)
    if (window.particleSystem && window.particleSystem.emitCustomTrail) {
      const trailDef = window.progressionManager && window.progressionManager.getEquippedTrail
        ? window.progressionManager.getEquippedTrail()
        : null;
      const trailId = trailDef ? trailDef.id : 'classic';
      if (this.feverTimer > 0) {
        window.particleSystem.emitCustomTrail(
          this.x + 12,
          this.y + this.getCurrentHeight() * 0.65,
          ['244, 63, 126', '251, 191, 36', '52, 211, 153', '34, 211, 238', '168, 85, 247']
        );
      } else if (trailId !== 'classic' && (this.speedNormalized > 0.65 || !this.onGround) && this.animTime % 2 === 0) {
        window.particleSystem.emitCustomTrail(this.x + 12, this.y + this.getCurrentHeight() * 0.72, trailDef.colors);
      }
    }

    if (window.soundSystem) {
      if (window.soundSystem.updateRoll) {
        window.soundSystem.updateRoll(this.onGround && !this.isGrinding && !this.isOnRamp, this.speedNormalized, this.surfaceType, this.sportId);
      }
      if (window.soundSystem.updateGrind) {
        window.soundSystem.updateGrind(this.isGrinding, this.grindIntensity);
      }
      if (window.soundSystem.updateRampRide) {
        window.soundSystem.updateRampRide(this.isOnRamp, this.speedNormalized, this.rampProgress);
      }
      if (window.soundSystem.updateWind) {
        window.soundSystem.updateWind(this.speedNormalized, this.airHeight);
      }
    }

    // Queda no abismo: no Fácil perde 1 vida e resgata; no Difícil encerra a partida na hora!
    if (this.y > world.deathY) {
      const freeRescue = this.gameMode === 'time60' || this.gameMode === 'free';
      const hardAbyss = this.difficulty === 'hard' && !freeRescue;
      if (!hardAbyss && (this.lives > 1 || freeRescue)) {
        if (!freeRescue) this.lives--;
        this.invincibleTimer = 140;
        this.hasShield = true;
        this.vy = 0;
        this.isGrinding = false;
        this.grindIntensity = 0;
        this.currentRail = null;
        this.grindTicks = 0;
        this.isOnRamp = false;
        this.isOnElevated = false;
        this.rampProgress = 0;
        this.currentRamp = null;
        this.rampBoostBuffered = false;
        this.isDucking = false;
        this.isFastFalling = false;
        this.trickState = null;
        this.trickProgress = 0;
        this.tricksInAir = [];
        this.comboMultiplier = 1;
        this.comboPoints = 0;
        this.comboLinkTimer = 0;
        this.linkedComboMult = 1;
        this.rotation = 0;
        this.pitch = 0;
        this.lean = 0;
        this.trail.length = 0;
        this.doubleJumpAvailable = !!(this.sport && this.sport.airDoubleJump);

        // Prefere um trecho sólido (e não quebradiço) que já passe pela posição normal de corrida.
        const casa = PHYS.HOME_X;
        const cobreCasa = world.platforms.find(p =>
          !p.isBreakable && world.isPlatformSolid(p) && p.x <= casa && p.x + p.width >= casa + this.width)
          || world.platforms.find(p =>
          world.isPlatformSolid(p) && p.x <= casa && p.x + p.width >= casa + this.width);

        const safe = cobreCasa
          || world.platforms.find(p => !p.isBreakable && p.x + p.width > 200 && world.isPlatformSolid(p))
          || world.platforms.find(p => p.x + p.width > 200 && world.isPlatformSolid(p))
          || world.platforms[0];

        if (safe) {
          this.x = cobreCasa ? casa : Math.max(casa, safe.x + 60);
          this.setBottom(world.platformTop(safe));
        } else {
          this.x = casa;
          this.setBottom(world.groundY);
        }
        this.prevBottom = this.bottom;
        this.onGround = true;
        this.groundBelowY = this.bottom;
        this.airHeight = 0;
        this.emitEvent('rescue', { intensity: 1, y: this.bottom });

        if (window.soundSystem && window.soundSystem.playRescue) window.soundSystem.playRescue();
        if (window.particleSystem && window.particleSystem.emitSparks) {
          window.particleSystem.emitSparks(this.x + this.width * 0.5, this.bottom, 28, '#fbbf24');
        }
        if (window.particleSystem && window.particleSystem.addFloatingText) {
          window.particleSystem.addFloatingText(
            freeRescue ? 'RESGATE RÁPIDO!' : `RESGATE RADICAL! -1 ${this.getSportLifeLabel()}`,
            this.x + this.width * 0.5, this.y - 60, '#fbbf24', 24
          );
        }
        if (window.game) {
          window.game.camera.shake(10);
          window.game.flash('power');
        }
      } else {
        this.takeDamage(hardAbyss ? 'Caiu no abismo (Modo Difícil)' : 'Caiu no abismo', true);
      }
    }
  }

  /**
   * Volta devagar para a posição normal de corrida.
   */
  returnHome(world) {
    if (this.x <= PHYS.HOME_X || !this.onGround) return;

    const alvo = Math.max(PHYS.HOME_X, this.x - 2.4);
    const temChao = world.platforms.some(p =>
      world.isPlatformSolid(p) && p.x <= alvo && p.x + p.width >= alvo + this.width);

    if (temChao) this.x = alvo;
  }

  checkStageProgression() {
    const nextStage = STAGES[this.currentStageIndex + 1];
    if (nextStage && this.distance >= nextStage.dist) {
      this.currentStageIndex++;
      const stage = STAGES[this.currentStageIndex];

      // Recompensa de fase: +1 vida (até o teto de 5) e +1000 pontos!
      const livesBefore = this.lives;
      this.lives = Math.min(this.maxLives || 5, this.lives + 1);
      const gainedLife = this.lives > livesBefore;
      this.score += 1000;

      if (window.progressionManager && window.progressionManager.unlockStage) {
        window.progressionManager.unlockStage(this.currentStageIndex);
      }
      this.notifyProgress('stage', 1, { stageIndex: this.currentStageIndex });

      if (window.soundSystem && window.soundSystem.playStageClear) window.soundSystem.playStageClear();
      if (window.particleSystem && window.particleSystem.emitSparks) {
        window.particleSystem.emitSparks(this.x + this.width * 0.5, this.y, 40, '#22d3ee');
      }
      if (window.particleSystem && window.particleSystem.addFloatingText) {
        const rewardText = gainedLife
          ? `FASE ${this.currentStageIndex + 1}! +1 ${this.getSportLifeLabel()}`
          : `FASE ${this.currentStageIndex + 1}! +1000 PTS`;
        window.particleSystem.addFloatingText(rewardText, this.x + this.width * 0.5, this.y - 70, '#34d399', 28);
      }

      if (window.game && window.game.onStageUnlocked) {
        window.game.onStageUnlocked(stage);
      }
    }
  }

  updateTimers() {
    this.animTime++;
    if (this.invincibleTimer > 0) this.invincibleTimer--;
    if (this.magnetTimer > 0) this.magnetTimer--;
    if (this.doubleTimer > 0) this.doubleTimer--;
    if (this.feverTimer > 0) this.feverTimer--;
    if (this.comboLinkTimer > 0) this.comboLinkTimer--;
    if (this.jumpBuffer > 0) this.jumpBuffer--;
    if (this.olliePopTimer > 0) this.olliePopTimer--;
    if (this.landingImpact > 0) {
      this.landingImpact = Math.max(0, this.landingImpact * 0.86 - 0.015);
    }
    if (this.onGround) {
      this.coyoteTimer = PHYS.COYOTE_STEPS;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer--;
    }
  }

  updateSpeed(keys) {
    // Aceleração rápida: manter pressionada a seta para frente (ArrowRight) ou tecla D
    this.isAccelerating = keys ? (Player.held(keys, 'ArrowRight') || Player.held(keys, 'KeyD') || Player.held(keys, 'TouchAccelerate')) : false;
    // Freio leve: seta para trás (ArrowLeft) ou tecla A (nunca cai abaixo de BASE_SPEED)
    const wantsBrake = keys ? (Player.held(keys, 'ArrowLeft') || Player.held(keys, 'KeyA')) : false;
    this.isBraking = wantsBrake && !this.isAccelerating && this.turboTimer <= 0 && this.feverTimer <= 0;

    if (this.turboTimer > 0) {
      this.turboTimer--;
      this.speed = this.maxSpeed * PHYS.TURBO_FACTOR;
      this.isPushing = false;
      this.pushPhase = 0;
      if (window.particleSystem && window.particleSystem.emitTurboTrail) {
        window.particleSystem.emitTurboTrail(this.x + 10, this.y + this.getCurrentHeight() * 0.55);
      }
    } else if (this.feverTimer > 0) {
      const feverFloor = this.maxSpeed * 1.24;
      const fastMax = this.maxSpeed * 1.35;
      if (this.isAccelerating) {
        const accelMult = (this.sport && this.sport.accelMult) || 1;
        this.speed = Math.min(fastMax, Math.max(feverFloor, this.speed + 0.08 * accelMult));
      } else {
        this.speed = Math.max(feverFloor, this.speed - 0.04);
      }
      this.isPushing = false;
      this.pushPhase = 0;
      if (window.particleSystem && window.particleSystem.emitTurboTrail) {
        window.particleSystem.emitTurboTrail(this.x + 10, this.y + this.getCurrentHeight() * 0.55);
      }
    } else if (this.isAccelerating) {
      // Remada/impulso forte! Aceleração com cadência rítmica e até 135% da velocidade máxima
      const fastMax = this.maxSpeed * 1.35;
      const accelMult = (this.sport && this.sport.accelMult) || 1;
      const pushingGround = this.onGround && !this.isGrinding && !this.isOnRamp && !this.isDucking;
      this.isPushing = pushingGround;
      let accel = 0.08 * accelMult;
      if (pushingGround) {
        const prevPhase = this.pushPhase;
        this.pushPhase = (this.pushPhase + 1 / 24) % 1;
        // Pico de impulso da remada no início do ciclo
        if (this.pushPhase < prevPhase || prevPhase === 0) {
          accel += 0.14 * accelMult;
          this.squashVel -= 0.018;
          this.emitEvent('push', { intensity: Math.min(1, this.speed / this.maxSpeed) });
          if (window.soundSystem && window.soundSystem.playPush) window.soundSystem.playPush();
          if (window.particleSystem) {
            if (window.particleSystem.emitPushDust) {
              window.particleSystem.emitPushDust(this.x + this.width * 0.28, this.bottom);
            } else if (window.particleSystem.emitSlideDust) {
              window.particleSystem.emitSlideDust(this.x + this.width * 0.28, this.bottom);
            }
          }
        }
      } else {
        this.pushPhase = 0;
      }

      this.speed = Math.min(fastMax, this.speed + accel);
      if (this.onGround && Math.random() < 0.25 && window.particleSystem && window.particleSystem.emitSparks) {
        window.particleSystem.emitSparks(this.x + 15, this.bottom - 4, 1, '#fbbf24');
      }
    } else if (this.isBraking) {
      this.isPushing = false;
      this.pushPhase = 0;
      const minSpd = this.baseSpeed || PHYS.BASE_SPEED;
      this.speed = Math.max(minSpd, this.speed - PHYS.BRAKE_DECEL);
      if (this.onGround && !this.isGrinding && this.speed > minSpd + 0.4 && Math.random() < 0.35) {
        if (window.particleSystem && window.particleSystem.emitSlideDust) {
          window.particleSystem.emitSlideDust(this.x + this.width * 0.3, this.bottom);
        } else if (window.particleSystem && window.particleSystem.emitWheelDust) {
          window.particleSystem.emitWheelDust(this.x + this.width * 0.3, this.bottom);
        }
      }
    } else {
      this.isPushing = false;
      this.pushPhase = 0;
      const accelMult = (this.sport && this.sport.accelMult) || 1;
      // Se estava acima da velocidade normal após soltar a seta, desacelera suavemente
      if (this.speed > this.maxSpeed) {
        this.speed = Math.max(this.maxSpeed, this.speed - 0.06);
      } else {
        this.speed = Math.min(this.maxSpeed, this.speed + PHYS.ACCELERATION * accelMult);
      }
    }
  }

  handleDuck(keys) {
    const wants = keys ? (Player.held(keys, 'ArrowDown') || Player.held(keys, 'KeyS')) : false;

    // No ar: segurar Baixo/S ativa fast-fall para aterrissagem rápida e precisa
    if (!this.onGround) {
      this.isFastFalling = wants;
      if (this.isDucking) {
        const feet = this.bottom;
        this.isDucking = false;
        this.setBottom(feet);
      }
      return;
    }

    this.isFastFalling = false;
    // Em grind ou plataforma elevada (Caminho Alto), segurar Baixo/S solta para descer à pista
    if ((this.isGrinding || this.isOnElevated) && wants) {
      if (this.isGrinding) this.endGrind();
      this.isOnElevated = false;
      this.onGround = false;
      this.isFastFalling = true;
      this.vy = Math.max(this.vy, 3.5);
      return;
    }

    if (wants === this.isDucking) return;

    // Agachar/levantar mantém os pés no chão em vez de teleportar o corpo
    const feet = this.bottom;
    this.isDucking = wants && this.onGround && !this.isGrinding && !this.isOnRamp;
    this.setBottom(feet);
  }

  handleJumpInput(keys) {
    const heldUp = keys ? Player.held(keys, 'ArrowUp') : false;
    const heldW = keys ? Player.held(keys, 'KeyW') : false;
    const heldSpace = keys ? Player.held(keys, 'Space') : false;
    const pressed = heldUp || heldW || heldSpace;

    // Sem curto-circuito: as três teclas precisam ser consumidas no mesmo passo
    const tapUp = keys ? Player.tapped(keys, 'ArrowUp') : false;
    const tapW = keys ? Player.tapped(keys, 'KeyW') : false;
    const tapSpace = keys ? Player.tapped(keys, 'Space') : false;
    const tapped = tapUp || tapW || tapSpace;

    // Preserva os taps deste passo caso não sejam usados para pular (permite manobras em toques rápidos no ar)
    this._airTapSpace = tapSpace;
    this._airTapUp = tapUp || tapW;

    // Borda de descida OU toque curto capturado entre dois passos
    const freshPress = (pressed && !this.jumpHeld) || tapped;
    if (freshPress) {
      this.jumpBuffer = PHYS.BUFFER_STEPS;
    }
    this.jumpHeld = pressed;

    // Subindo na rampa: apertar Pulo perto do topo arma Lip Boost sem cancelar a curva
    if (this.isOnRamp && this.currentRamp) {
      this._airTapSpace = false;
      this._airTapUp = false;
      if (this.jumpBuffer > 0 && this.rampProgress >= 0.72) {
        this.rampBoostBuffered = true;
      }
      return;
    }

    // Coyote time + buffer: o salto sai mesmo com timing imperfeito
    const canJump = this.onGround || this.coyoteTimer > 0;
    const jumpMult = (this.sport && this.sport.jumpMult) || 1;
    if (this.jumpBuffer > 0 && canJump && !this.isDucking) {
      const fromGrind = this.isGrinding;
      const jumpVel = (fromGrind ? PHYS.GRIND_JUMP_VEL : PHYS.JUMP_VELOCITY) * jumpMult;
      const surf = this.surfaceType;
      this.jump(jumpVel, {
        keepCombo: fromGrind,
        jumpedWithSpace: heldSpace || tapSpace,
        jumpedWithUp: heldUp || tapUp || heldW || tapW
      });
      this.jumpBuffer = 0;
      this._airTapSpace = false;
      this._airTapUp = false;
      this.emitEvent('jump', { intensity: fromGrind ? 1.1 : 1, surfaceType: surf });
      if (window.soundSystem && window.soundSystem.playJump) window.soundSystem.playJump(this.sportId, false);
      if (window.particleSystem) {
        if (window.particleSystem.emitOlliePop) {
          window.particleSystem.emitOlliePop(this.x + this.width * 0.25, this.bottom);
        } else if (window.particleSystem.emitLandingDust) {
          window.particleSystem.emitLandingDust(this.x + this.width * 0.5, this.bottom, 8);
        }
      }
    } else if (freshPress && !canJump && !this.onGround && this.sport && this.sport.airDoubleJump && this.doubleJumpAvailable) {
      // Pulo Duplo exclusivo dos Patins!
      this.doubleJumpAvailable = false;
      this.vy = PHYS.JUMP_VELOCITY * 0.84;
      this.airSteps = 0;
      this.isFastFalling = false;
      this.jumpBuffer = 0;
      this._airTapSpace = false;
      this._airTapUp = false;
      this.spaceAirArmed = false; // Space deu o 2º salto primeiro; próximo toque faz manobra
      this.upAirArmed = false;
      this.squash = 1.18;
      this.squashVel = 0.04;
      this.olliePopTimer = 12;
      this.emitEvent('jump', { intensity: 1.05, doubleJump: true, surfaceType: 'air' });
      if (window.soundSystem && window.soundSystem.playJump) window.soundSystem.playJump(this.sportId, true);
      if (window.particleSystem) {
        if (window.particleSystem.emitShockwave) {
          window.particleSystem.emitShockwave(this.x + this.width * 0.5, this.bottom, '#22d3ee', 54);
        }
        if (window.particleSystem.emitSparks) {
          window.particleSystem.emitSparks(this.x + this.width * 0.5, this.bottom, 10, '#22d3ee');
        }
        if (window.particleSystem.addFloatingText) {
          window.particleSystem.addFloatingText('PULO DUPLO!', this.x + this.width * 0.5, this.y - 48, '#22d3ee', 20);
        }
      }
    }
  }

  integrate(keys) {
    this.prevBottom = this.bottom;

    if (this.onGround) {
      this.rotation = 0;
      if (!this.isGrinding && !this.isOnRamp && Math.random() < 0.4 && window.particleSystem && window.particleSystem.emitWheelDust) {
        window.particleSystem.emitWheelDust(this.x + this.width * 0.3, this.bottom);
      }
      return;
    }

    // Só arma manobras com Espaço ou Seta/W após soltar a tecla usada para pular
    if (!this.spaceAirArmed && !(keys && Player.held(keys, 'Space'))) {
      this.spaceAirArmed = true;
    }
    if (!this.upAirArmed && !(keys && (Player.held(keys, 'ArrowUp') || Player.held(keys, 'KeyW')))) {
      this.upAirArmed = true;
    }

    // Salto de altura variável, com piso garantido.
    this.airSteps++;
    if (!this.jumpHeld && this.airSteps > PHYS.MIN_JUMP_STEPS && this.vy < PHYS.JUMP_CUT) {
      this.vy = PHYS.JUMP_CUT;
    }

    // Curva de gravidade com sensação de peso (+ baixa gravidade na Pista Cósmica!)
    let grav = PHYS.GRAVITY;
    if (Math.abs(this.vy) < PHYS.APEX_THRESHOLD && !this.isFastFalling) {
      grav = PHYS.APEX_GRAVITY;
    } else if (this.vy > 0) {
      grav = PHYS.FALL_GRAVITY;
    }
    if (this.currentStageIndex === 3 && !this.isFastFalling) {
      grav *= 0.84;
    }
    if (this.isFastFalling) {
      grav += PHYS.FAST_FALL_ACC;
    }

    const maxFall = this.isFastFalling ? PHYS.MAX_FAST_FALL : PHYS.MAX_FALL;
    this.vy = Math.min(maxFall, this.vy + grav);
    this.y += this.vy;

    this.handleAirTricks(keys);

    if (this.trickState) {
      this.rotation += this.trickState.rotSpeed;
      const target = Math.abs(this.trickState.targetAngle) || 1;
      this.trickProgress = Math.min(1, Math.abs(this.rotation) / target);
      if (Math.abs(this.rotation) >= target) {
        this.rotation = 0;
        this.trickState = null;
        this.trickProgress = 0;
      }
    } else {
      this.trickProgress = 0;
    }

    // Rastro visual em alta velocidade ou em SUPER FLIP
    if (this.turboTimer > 0 || this.feverTimer > 0 || this.speed > this.maxSpeed * 0.8 || (this.trickState && this.trickState.style === 'super')) {
      this.trail.push({ x: this.x, y: this.y, rot: this.rotation, life: 1 });
      if (this.trail.length > 6) this.trail.shift();
    }
  }

  jump(velocity, opts = {}) {
    if (this.isGrinding) this.endGrind();
    if (this.isDucking) {
      const feet = this.bottom;
      this.isDucking = false;
      this.setBottom(feet);
    }
    this.isOnRamp = false;
    this.isOnElevated = false;
    this.rampProgress = 0;
    this.currentRamp = null;
    this.rampBoostBuffered = false;
    this.vy = velocity;
    this.onGround = false;
    this.coyoteTimer = 0;
    this.isFastFalling = false;

    if (opts.keepCombo) {
      // Saindo de um grind: preserva multiplicador e pontos do combo, mas libera novas manobras no ar!
      this.tricksInAir = [];
    } else {
      if (this.comboLinkTimer > 0 && this.linkedComboMult > 1) {
        // Emendou combo no próximo salto dentro da janela!
        this.comboMultiplier = this.linkedComboMult;
        this.comboLinkTimer = 0;
        this.linkedComboMult = 1;
        this.tricksInAir = [];
        if (window.particleSystem && window.particleSystem.addFloatingText) {
          window.particleSystem.addFloatingText(`COMBO EMENDADO x${this.comboMultiplier}!`, this.x + this.width * 0.5, this.y - 68, '#a855f7', 20);
        }
      } else {
        this.tricksInAir = [];
        this.comboMultiplier = 1;
        this.comboPoints = 0;
      }
    }
    this.spaceAirArmed = !opts.jumpedWithSpace;
    this.upAirArmed = !opts.jumpedWithUp;
    this.olliePopTimer = opts.fromRamp ? 8 : 15;
    this.squash = 1.18;
    this.squashVel = 0.04;
    this.airSteps = 0;
  }

  launchFromRamp(ramp = null) {
    const boosted = !!(this.rampBoostBuffered || this.jumpBuffer > 0 || (ramp && this.jumpHeld && this.rampProgress >= 0.72));
    if (ramp) {
      ramp.used = true;
      ramp.usedAnim = 18;
      ramp.riderU = 0;
      this.isDucking = false;
      this.setBottom(ramp.y);
    }

    const speedRatio = Math.max(0, Math.min(1.4, this.speed / this.maxSpeed));
    const rampMult = (this.sport && this.sport.rampBoostMult) || 1;
    let launchVy = -(17.6 + speedRatio * 2.8) * rampMult;
    if (boosted) {
      launchVy -= 2.1 * rampMult;
      this.addScore(250);
      this.lipBoostCount++;
      this.addFever(18);
      this.notifyProgress('lip_boost', 1);
    } else {
      this.addFever(8);
    }

    this.jump(launchVy, { keepCombo: false, jumpedWithSpace: false, fromRamp: true });
    this.jumpBuffer = 0;
    this.pitch = -0.44;
    this.emitEvent('ramp', { intensity: boosted ? 1.5 : 1.15, boosted, surfaceType: 'wood', y: this.bottom });

    if (window.soundSystem && window.soundSystem.playRamp) window.soundSystem.playRamp(boosted);
    if (window.particleSystem) {
      if (window.particleSystem.emitRampLaunch) {
        window.particleSystem.emitRampLaunch(this.x + this.width * 0.5, this.bottom, boosted);
      } else {
        if (window.particleSystem.emitSparks) {
          window.particleSystem.emitSparks(this.x + this.width * 0.5, this.bottom, boosted ? 28 : 22, boosted ? '#fbbf24' : '#8b5cf6');
        }
        if (window.particleSystem.emitShockwave) {
          window.particleSystem.emitShockwave(this.x + this.width * 0.5, this.bottom, boosted ? '#fbbf24' : '#22d3ee', boosted ? 115 : 95);
        }
      }
      if (window.particleSystem.addFloatingText) {
        window.particleSystem.addFloatingText(
          boosted ? 'MEGA RAMPA! +BOOST' : 'MEGA RAMPA',
          this.x + this.width * 0.5,
          this.y - 62,
          boosted ? '#fbbf24' : '#22d3ee',
          boosted ? 30 : 28
        );
      }
    }
    if (window.game) window.game.camera.shake(boosted ? 9 : 6);
  }

  // ---- Manobras ------------------------------------------------------------

  handleAirTricks(keys) {
    if (this.trickState || !keys) return;
    const tricks = (this.sport && this.sport.tricks) || TRICKS;
    const aliases = {
      KeyZ: ['KeyZ', 'Digit1', 'Numpad1', 'KeyJ'],
      KeyX: ['KeyX', 'Digit2', 'Numpad2', 'KeyK'],
      KeyC: ['KeyC', 'Digit3', 'Numpad3', 'KeyL']
    };

    for (const t of tricks) {
      if (this.tricksInAir.includes(t.name)) continue;

      if (t.key === 'Space') {
        // Nos Patins, Space no ar prioriza o pulo duplo se ainda disponível
        if (this.sport && this.sport.airDoubleJump && this.doubleJumpAvailable) continue;
        // Exige soltar o Espaço do pulo e dar novo toque no ar
        if (!this.spaceAirArmed) continue;
        if (Player.tapped(keys, 'Space') || this._airTapSpace || Player.held(keys, 'Space')) {
          this.spaceAirArmed = false;
          this._airTapSpace = false;
          this.executeTrick(t);
          return;
        }
      } else {
        const keyList = aliases[t.key] || [t.key];
        if (keyList.some(k => Player.held(keys, k) || Player.tapped(keys, k))) {
          this.executeTrick(t);
          return;
        }
      }
    }

    // Gatilho rápido com 1 tecla no ar: Shift ou 2º toque em Seta Cima / W
    const shiftPressed = Player.held(keys, 'ShiftLeft') || Player.tapped(keys, 'ShiftLeft') ||
                         Player.held(keys, 'ShiftRight') || Player.tapped(keys, 'ShiftRight');
    const upPressed = Player.held(keys, 'ArrowUp') || Player.tapped(keys, 'ArrowUp') ||
                      Player.held(keys, 'KeyW') || Player.tapped(keys, 'KeyW') ||
                      this._airTapUp;
    const canUpTrick = this.upAirArmed && !(this.sport && this.sport.airDoubleJump && this.doubleJumpAvailable);

    if (shiftPressed || (canUpTrick && upPressed)) {
      const nextTrick = tricks.find(t => !this.tricksInAir.includes(t.name));
      if (nextTrick) {
        if (upPressed && !shiftPressed) {
          this.upAirArmed = false;
          this._airTapUp = false;
        }
        if (nextTrick.key === 'Space') {
          this.spaceAirArmed = false;
          this._airTapSpace = false;
        }
        this.executeTrick(nextTrick);
      }
    }
  }

  executeTrick(t) {
    this.trickState = {
      name: t.name,
      rotSpeed: t.rotSpeed,
      targetAngle: t.targetAngle,
      style: t.style || 'spin',
      color: t.color
    };
    this.trickProgress = 0;
    this.tricksInAir.push(t.name);
    this.lastTrickName = t.name;

    // Assinatura física por estilo de manobra
    if (t.style === 'flip' && this.vy > -3 && this.vy < 4) {
      // Micro-pop do kickflip no ápice
      this.vy -= 1.2;
    } else if (t.style === 'grab' && this.vy > 0) {
      // Leve sustentação durante o Indy Grab
      this.vy *= 0.82;
    } else if (t.style === 'super' && window.particleSystem && window.particleSystem.emitSpeedBurst) {
      window.particleSystem.emitSpeedBurst(this.x + this.width * 0.5, this.y + this.getCurrentHeight() * 0.5, t.color);
    }

    if ((t.style === 'flip' || t.style === 'super') && window.soundSystem && window.soundSystem.playBoardFlip) {
      window.soundSystem.playBoardFlip();
    }

    this.comboMultiplier = Math.max(this.comboMultiplier + (this.tricksInAir.length > 1 ? 1 : 0), this.tricksInAir.length);
    this.bestCombo = Math.max(this.bestCombo, this.comboMultiplier);

    const points = this.addScore(t.pts * this.comboMultiplier);
    this.comboPoints += points;
    this.addFever(14);
    this.notifyProgress('trick', 1);
    this.notifyProgress('combo', this.comboMultiplier);
    this.emitEvent('trick', { intensity: Math.min(1.5, 0.7 + this.comboMultiplier * 0.25) });

    if (window.soundSystem && window.soundSystem.playTrick) {
      window.soundSystem.playTrick(this.comboMultiplier);
    }
    if (window.particleSystem && window.particleSystem.emitSparks) {
      window.particleSystem.emitSparks(this.x + this.width * 0.5, this.y + this.getCurrentHeight() * 0.5, 16, t.color);
    }

    const combo = this.comboMultiplier > 1 ? ` x${this.comboMultiplier}` : '';
    if (window.particleSystem && window.particleSystem.addFloatingText) {
      window.particleSystem.addFloatingText(
        `${t.name}${combo}  +${points}`,
        this.x + this.width * 0.5,
        this.y - 54,
        t.color,
        24
      );
    }
  }

  // ---- Colisão com o solo --------------------------------------------------
  //
  // Usa varredura (posição anterior -> atual) em vez de uma janela fixa de
  // pixels. Assim o pouso é detectado em qualquer velocidade de queda, e o
  // jogador nunca "atravessa" a pista.

  resolveGroundCollision(world) {
    const bottom = this.bottom;
    const prevBottom = this.prevBottom;

    // 1. Verifica subida contínua e decolagem em rampas (curva pixel-perfect compartilhada)
    const ramps = Array.isArray(world.ramps) ? world.ramps : [];
    const rampProbeX = this.x + this.width * 0.55;
    let activeRamp = null;
    let activeSample = null;

    if (ramps.length > 0) {
      for (const ramp of ramps) {
        if (ramp.used) continue;
        // Se já estava subindo esta rampa e passou do topo, decola imediatamente no lip!
        if (this.currentRamp === ramp && rampProbeX >= ramp.x + ramp.width * 0.92 && Math.abs(bottom - ramp.y) <= 60) {
          this.launchFromRamp(ramp);
          return;
        }
        if (rampProbeX < ramp.x - 4 || rampProbeX > ramp.x + ramp.width + 16) continue;

        const sample = Player.sampleRamp(ramp, rampProbeX, world);
        const alreadyRiding = this.currentRamp === ramp && Math.abs(bottom - sample.y) <= 45;
        const entersFromGround = this.onGround && !this.isGrinding && Math.abs(bottom - sample.y) <= 28;
        const landsOnRamp = !this.onGround && this.vy >= 0 && prevBottom <= sample.y + 16 && bottom >= sample.y - 10;

        if (alreadyRiding || entersFromGround || landsOnRamp) {
          activeRamp = ramp;
          activeSample = sample;
          break;
        }
      }
    }

    if (activeRamp && activeSample) {
      const lipThreshold = this.rampBoostBuffered ? 0.80 : 0.92;
      if (activeSample.u >= lipThreshold) {
        this.launchFromRamp(activeRamp);
        return;
      }
      this.rideRamp(activeRamp, activeSample);
      return;
    } else if (this.isOnRamp) {
      // Saiu de uma rampa antes de marcar used (ex: rampa rolou para trás)
      const prevRamp = this.currentRamp;
      if (prevRamp && !prevRamp.used && this.rampProgress >= 0.65 && Math.abs(bottom - prevRamp.y) <= 60) {
        this.launchFromRamp(prevRamp);
        return;
      }
      if (prevRamp) prevRamp.riderU = 0;
      this.isOnRamp = false;
      this.rampProgress = 0;
      this.currentRamp = null;
      this.rampBoostBuffered = false;
    }

    // Três pontos de apoio: traseira, centro e frente do skate
    const probes = [
      this.x + this.width * 0.22,
      this.x + this.width * 0.50,
      this.x + this.width * 0.78
    ];

    let support = null;
    let supportTop = Infinity;
    let supportIsElevated = false;

    for (const platform of world.platforms) {
      if (!world.isPlatformSolid(platform)) continue;

      const top = world.platformTop(platform);
      const left = platform.x;
      const right = platform.x + platform.width;

      const overlaps = probes.some(px => px >= left && px <= right);
      if (!overlaps) continue;

      // Se já está no chão (e não em grind), tolerância vertical generosa para manter o contato seguro
      const isAlreadyGrounded = this.onGround && !this.isGrinding && Math.abs(bottom - top) <= 16;
      // Se estava no ar, detecta passagem pela superfície
      const landed = prevBottom <= top + PHYS.SNAP_TOLERANCE && bottom >= top - 6;

      if ((isAlreadyGrounded || landed) && top < supportTop) {
        support = platform;
        supportTop = top;
        supportIsElevated = false;
      }
    }

    // Plataformas elevadas (Caminho Alto one-way: desce ao segurar S/Baixo)
    const elevated = Array.isArray(world.elevatedPlatforms) ? world.elevatedPlatforms : [];
    if (!this.isFastFalling && this.vy >= 0 && elevated.length > 0) {
      for (const ep of elevated) {
        const top = ep.y;
        const left = ep.x;
        const right = ep.x + ep.width;
        const overlaps = probes.some(px => px >= left && px <= right);
        if (!overlaps) continue;

        const alreadyOnEp = this.onGround && !this.isGrinding && Math.abs(bottom - top) <= 16;
        const landedOnEp = prevBottom <= top + PHYS.SNAP_TOLERANCE + 2 && bottom >= top - 6;
        if ((alreadyOnEp || landedOnEp) && top < supportTop) {
          support = ep;
          supportTop = top;
          supportIsElevated = true;
        }
      }
    }

    // Verifica corrimãos (rails) para grind quando estiver descendo ou já em grind
    let railSupport = null;
    let railTop = Infinity;
    const rails = Array.isArray(world.rails) ? world.rails : [];
    if (!this.isFastFalling && this.vy >= 0 && rails.length > 0) {
      for (const rail of rails) {
        const left = rail.x;
        const right = rail.x + rail.width;
        const top = rail.y;

        const overlaps = probes.some(px => px >= left && px <= right);
        if (!overlaps) continue;

        const alreadyOnRail = this.isGrinding && Math.abs(bottom - top) <= 18;
        const landedOnRail = prevBottom <= top + PHYS.SNAP_TOLERANCE + 4 && bottom >= top - 6;

        if ((alreadyOnRail || landedOnRail) && top < railTop) {
          railSupport = rail;
          railTop = top;
        }
      }
    }

    if (railSupport && railTop <= supportTop) {
      this.grindOnRail(railSupport, railTop);
    } else if (support) {
      if (this.isGrinding) this.endGrind();
      this.land(support, supportTop, world, supportIsElevated);
    } else {
      if (this.isGrinding) this.endGrind();
      this.isOnElevated = false;
      this.onGround = false;
      this.surfaceType = 'air';
      if (this.isDucking) {
        // Não dá para continuar agachado no ar
        const feet = this.bottom;
        this.isDucking = false;
        this.setBottom(feet);
      }
    }
  }

  rideRamp(ramp, sample) {
    const wasOnRamp = this.isOnRamp;
    if (this.isGrinding) this.endGrind();

    this.isOnRamp = true;
    this.isOnElevated = false;
    this.currentRamp = ramp;
    this.rampProgress = sample.u;
    ramp.riderU = sample.u;

    // Desfaz agachamento ANTES de fixar os pés na curva da rampa
    this.isDucking = false;
    this.setBottom(sample.y);
    this.vy = 0;
    this.onGround = true;
    this.isFastFalling = false;
    this.doubleJumpAvailable = !!(this.sport && this.sport.airDoubleJump);
    this.coyoteTimer = PHYS.COYOTE_STEPS;
    this.airSteps = 0;
    this.surfaceType = 'wood';
    this.pitch = sample.angle;
    this.lean = sample.angle;

    if (!wasOnRamp) {
      this.rampBoostBuffered = false;
      this.emitEvent('ramp_enter', { intensity: this.speedNormalized, surfaceType: 'wood', y: sample.y });
    }

    // Força G suave comprimindo os joelhos na transição côncava
    const targetG = 1 - Math.sin(sample.u * Math.PI) * 0.11;
    this.squash += (targetG - this.squash) * 0.28;
  }

  grindOnRail(rail, top) {
    const wasGrinding = this.isGrinding;
    const wasAirborne = !this.onGround;
    const impact = this.vy;

    // Desfaz agachamento ANTES de fixar os pés no topo do corrimão
    this.isDucking = false;
    this.isOnElevated = false;
    this.setBottom(top);
    this.vy = 0;
    this.onGround = true;
    this.isGrinding = true;
    this.isFastFalling = false;
    this.currentRail = rail;
    this.coyoteTimer = PHYS.COYOTE_STEPS;
    this.airSteps = 0;
    this.surfaceType = rail.surfaceType || 'metal';
    this.grindIntensity = Math.max(0.25, Math.min(1, this.speed / this.maxSpeed));

    if (!wasGrinding) {
      this.grindTicks = 0;
      if (wasAirborne) {
        const impactNorm = Math.max(0, Math.min(1, impact / PHYS.MAX_FALL));
        this.lastLandingImpact = impactNorm;
        this.landingImpact = Math.max(this.landingImpact, impactNorm * 0.7);
        this.squash = Math.max(0.80, 1 - impact * 0.008);
        this.squashVel = -impact * 0.004;
      }

      // Mantém e amplia o combo se veio de manobras aéreas
      if (this.tricksInAir.length > 0) {
        this.comboMultiplier = Math.max(this.comboMultiplier + 1, this.tricksInAir.length + 1);
      }
      this.bestCombo = Math.max(this.bestCombo, this.comboMultiplier);
      const grindLabel = (this.sport && this.sport.grindLabel) || 'GRIND!';
      this.lastTrickName = grindLabel.replace('!', '');
      this.trickState = null;
      this.trickProgress = 0;
      this.rotation = 0;
      this.doubleJumpAvailable = !!(this.sport && this.sport.airDoubleJump);

      this.emitEvent('grind_start', { intensity: this.grindIntensity, surfaceType: this.surfaceType, y: top });
      this.notifyProgress('grind', 1);
      this.notifyProgress('combo', this.comboMultiplier);
      if (window.particleSystem && window.particleSystem.addFloatingText) {
        const combo = this.comboMultiplier > 1 ? ` x${this.comboMultiplier}` : '';
        window.particleSystem.addFloatingText(`${grindLabel}${combo}`, this.x + this.width * 0.5, this.y - 54, '#22d3ee', 24);
      }
    }

    this.grindTicks++;
    const grindMult = (this.sport && this.sport.grindScoreMult) || 1;
    const pts = this.addScore(Math.max(2, Math.round(this.speed * 0.45 * this.comboMultiplier * grindMult)));
    this.comboPoints += pts;
    this.addFever(0.35);

    // A cada ~0,5s de grind contínuo, aumenta o multiplicador
    if (this.grindTicks > 0 && this.grindTicks % 30 === 0) {
      this.comboMultiplier++;
      this.bestCombo = Math.max(this.bestCombo, this.comboMultiplier);
    }

    // Faíscas contínuas do grind (BMX Peg Grind gera faíscas extras metálicas)
    const sparkBoost = this.sportId === 'bmx' ? 1.3 : 1;
    if (window.particleSystem) {
      if (window.particleSystem.emitGrindSparks) {
        window.particleSystem.emitGrindSparks(this.x + this.width * 0.45, top, Math.min(1.4, this.grindIntensity * sparkBoost));
      } else if (Math.random() < 0.45 && window.particleSystem.emitSparks) {
        window.particleSystem.emitSparks(this.x + this.width * 0.45, top, 2, '#fbbf24');
      }
    }
  }

  endGrind() {
    if (!this.isGrinding) return;
    this.emitEvent('grind_end', { intensity: this.grindIntensity, surfaceType: this.surfaceType });
    this.isGrinding = false;
    this.grindIntensity = 0;
    this.currentRail = null;
    this.grindTicks = 0;
  }

  detectSurfaceType(platform, world) {
    if (platform && platform.surfaceType) return platform.surfaceType;
    if (platform && platform.isBreakable && platform.triggered) return 'breakable';
    if (world && typeof world.getSurfaceAt === 'function') {
      const s = world.getSurfaceAt(this.x + this.width * 0.5);
      if (s) return s;
    }
    const stage = STAGES[this.currentStageIndex];
    if (stage && stage.id === 'beach') return 'wood';
    if (stage && stage.id === 'cosmic') return 'cosmic';
    return 'asphalt';
  }

  updateGroundBelow(world) {
    const cx = this.x + this.width * 0.5;
    const footY = this.bottom;
    let bestY = null;

    if (world && Array.isArray(world.platforms)) {
      for (const p of world.platforms) {
        if (!world.isPlatformSolid(p)) continue;
        if (cx >= p.x && cx <= p.x + p.width) {
          const top = world.platformTop(p);
          if (top >= footY - 12 && (bestY === null || top < bestY)) {
            bestY = top;
          }
        }
      }
    }

    if (world && Array.isArray(world.rails)) {
      for (const r of world.rails) {
        if (cx >= r.x && cx <= r.x + r.width) {
          if (r.y >= footY - 12 && (bestY === null || r.y < bestY)) {
            bestY = r.y;
          }
        }
      }
    }

    if (world && Array.isArray(world.elevatedPlatforms)) {
      for (const ep of world.elevatedPlatforms) {
        if (cx >= ep.x && cx <= ep.x + ep.width) {
          if (ep.y >= footY - 12 && (bestY === null || ep.y < bestY)) {
            bestY = ep.y;
          }
        }
      }
    }

    if (world && Array.isArray(world.ramps)) {
      for (const r of world.ramps) {
        if (cx >= r.x && cx <= r.x + r.width) {
          const s = Player.sampleRamp(r, cx, world);
          if (s.y >= footY - 14 && (bestY === null || s.y < bestY)) {
            bestY = s.y;
          }
        }
      }
    }

    this.groundBelowY = bestY;
    const fallbackY = (world && world.groundY) ? world.groundY : footY;
    this.airHeight = bestY === null ? Math.max(0, fallbackY - footY) + 90 : Math.max(0, bestY - footY);
  }

  land(platform, top, world, isElevated = false) {
    const wasAirborne = !this.onGround;
    const impact = this.vy;
    const incompleteTrick = !!(this.trickState && this.trickProgress <= 0.78);

    this.setBottom(top);
    this.vy = 0;
    this.onGround = true;
    this.isOnElevated = !!isElevated;
    this.isFastFalling = false;
    this.doubleJumpAvailable = !!(this.sport && this.sport.airDoubleJump);
    this.coyoteTimer = PHYS.COYOTE_STEPS;
    this.airSteps = 0;
    this.surfaceType = this.detectSurfaceType(platform, world);

    if (wasAirborne) {
      const softness = (this.sport && this.sport.landingSoftness) || 1;
      const impactNorm = Math.max(0.08, Math.min(1, (impact / PHYS.MAX_FALL) / softness));
      this.lastLandingImpact = impactNorm;
      this.landingImpact = impactNorm;

      // Compressão proporcional ao impacto + impulso na mola elástica
      const extraSquash = incompleteTrick ? 0.08 : 0;
      this.squash = Math.max(0.68, 1 - (impact * 0.013) / softness - extraSquash);
      this.squashVel = -(impact * 0.0055) / softness;
      // BMX com suspensão macia mantém mini-embalo no pouso firme
      if (softness > 1.15 && !incompleteTrick && impact > 8) {
        this.speed = Math.min(this.maxSpeed * 1.15, this.speed + 0.25);
      }

      if (window.particleSystem && window.particleSystem.emitLandingDust) {
        window.particleSystem.emitLandingDust(this.x + this.width * 0.5, top, Math.min(18, 5 + impact));
      }

      if (this.tricksInAir.length > 0 && !incompleteTrick) {
        const bonus = this.addScore(this.tricksInAir.length * 300);
        // Emenda de combo: janela de ~1,5s para o próximo salto ou corrimão continuar o multiplicador!
        this.comboLinkTimer = 95;
        this.linkedComboMult = this.comboMultiplier;
        this.addFever(16);
        // Mini-boost de embalo ao cravar um pouso perfeito
        this.speed = Math.min(this.maxSpeed * 1.18, this.speed + 0.65);
        this.emitEvent('perfect_land', { intensity: impactNorm, surfaceType: this.surfaceType, y: top });

        if (window.soundSystem && window.soundSystem.playCoin) window.soundSystem.playCoin();
        if (window.particleSystem && window.particleSystem.emitSparks) {
          window.particleSystem.emitSparks(this.x + this.width * 0.5, top, 14, '#34d399');
        }
        if (window.particleSystem && window.particleSystem.emitShockwave) {
          window.particleSystem.emitShockwave(this.x + this.width * 0.5, top, '#34d399', 64);
        }
        if (window.particleSystem && window.particleSystem.addFloatingText) {
          window.particleSystem.addFloatingText(
            `POUSO PERFEITO  +${bonus}`, this.x + this.width * 0.5, this.y - 58, '#34d399', 22
          );
        }
      } else if (incompleteTrick) {
        // Sem punição de vida (amigável para crianças), apenas perda leve de embalo
        const minSpd = this.baseSpeed || PHYS.BASE_SPEED;
        this.speed = Math.max(minSpd, this.speed - 0.5);
        this.comboLinkTimer = 0;
        this.linkedComboMult = 1;
        this.emitEvent('land', { intensity: impactNorm, surfaceType: this.surfaceType, y: top });
        if (window.particleSystem && window.particleSystem.addFloatingText) {
          window.particleSystem.addFloatingText(
            'POUSO TORTO!', this.x + this.width * 0.5, this.y - 54, '#fbbf24', 20
          );
        }
      } else {
        this.emitEvent('land', { intensity: impactNorm, surfaceType: this.surfaceType, y: top });
      }

      if (impact > 12 && window.game) window.game.camera.shake(Math.min(6, impact * 0.3));
      if (window.soundSystem && window.soundSystem.playLand) {
        window.soundSystem.playLand(impactNorm, this.surfaceType, this.sportId);
      }
    }

    this.tricksInAir = [];
    this.trickState = null;
    this.trickProgress = 0;
    this.rotation = 0;
    this.comboMultiplier = 1;
    this.comboPoints = 0;
    this.trail.length = 0;

    if (platform.isBreakable && !platform.triggered) {
      platform.triggerFall();
    }
  }

  // ---- Animação ------------------------------------------------------------

  updateAnimation(world) {
    // Amortecimento elástico (spring-damper) no squash/stretch
    let targetSquash = 1;
    if (this.isDucking) targetSquash = 0.93;
    else if (this.isOnRamp) targetSquash = 1 - Math.sin(this.rampProgress * Math.PI) * 0.11;
    else if (this.trickState && this.trickState.style === 'grab') targetSquash = 0.86;
    else if (this.isPushing) targetSquash = 1 - Math.sin(this.pushPhase * Math.PI) * 0.06;

    const stiffness = 0.22;
    const damping = 0.72;
    this.squashVel = (this.squashVel + (targetSquash - this.squash) * stiffness) * damping;
    this.squash = Math.max(0.65, Math.min(1.28, this.squash + this.squashVel));
    this.stretchX = 1 + (1 - this.squash) * 0.58;

    // Inclinação física (pitch) acompanhando rampa, remada, freio, grind e trajetória aérea
    if (!this.isOnRamp) {
      let targetPitch = 0.04;
      if (!this.onGround) {
        targetPitch = Math.max(-0.42, Math.min(0.36, this.vy * 0.022));
      } else if (this.isGrinding) {
        targetPitch = -0.05 + Math.sin(this.wheelPhase * 1.4) * 0.025;
      } else if (this.isPushing) {
        targetPitch = 0.11 + Math.sin(this.pushPhase * Math.PI) * 0.05;
      } else if (this.isBraking) {
        targetPitch = -0.10;
      }
      this.pitch += (targetPitch - this.pitch) * 0.18;
      this.lean = this.pitch;
    }

    // Rotação real das rodinhas, passada de patins/BMX e vibração da superfície
    this.wheelSpin += this.onGround ? this.speed * 0.22 : this.speed * 0.07;
    if (this.onGround && !this.isGrinding) {
      const strideRate = this.isAccelerating ? 0.026 : 0.015;
      this.stridePhase = (this.stridePhase + this.speed * strideRate) % (Math.PI * 2);
    }

    if (this.onGround) {
      this.wheelPhase += this.speed * 0.085;
      let amp = 1.3;
      if (this.isOnRamp) amp = 0.6;
      else if (this.surfaceType === 'wood') amp = 2.0;
      else if (this.surfaceType === 'metal') amp = 0.9;
      else if (this.surfaceType === 'breakable') amp = 2.4;
      else if (this.surfaceType === 'cosmic') amp = 0.8;
      this.bob = Math.sin(this.wheelPhase) * amp;
    } else {
      this.bob = 0;
    }

    // Cinemática do rig articulado (flexão de joelhos, remada e skate independente)
    const targetCrouch = this.isDucking
      ? 1.0
      : this.isOnRamp
        ? 0.28 + Math.sin(this.rampProgress * Math.PI) * 0.36
        : Math.min(1, this.landingImpact * 0.85 + (this.trickState && this.trickState.style === 'grab' ? 0.72 : 0));
    this.crouchBlend += (targetCrouch - this.crouchBlend) * 0.26;

    const targetPush = this.isPushing ? 1 : 0;
    this.pushBlend += (targetPush - this.pushBlend) * 0.24;

    if (this.trickState && (this.trickState.style === 'flip' || this.trickState.style === 'super')) {
      const flips = this.trickState.style === 'super' ? 2 : 1;
      this.boardFlipAngle = this.trickProgress * Math.PI * 2 * flips;
      this.boardDropY = Math.sin(this.trickProgress * Math.PI) * 14;
      this.boardTilt = Math.sin(this.trickProgress * Math.PI) * -0.18;
    } else {
      this.boardFlipAngle = 0;
      this.boardDropY += (0 - this.boardDropY) * 0.3;
      // Pop do tail no início do ollie, nivelando no ápice
      let targetBoardTilt = 0;
      if (!this.onGround && this.olliePopTimer > 0) {
        const t = this.olliePopTimer / 15;
        targetBoardTilt = -Math.sin(t * Math.PI) * 0.44;
      } else if (this.isBraking && this.onGround) {
        targetBoardTilt = -0.12;
      }
      this.boardTilt += (targetBoardTilt - this.boardTilt) * 0.32;
    }

    // Transição suave (crossfade de ~4-5 frames) ao trocar de pose
    const nextPose = this.getPose();
    if (nextPose !== this.currentPose) {
      this.prevPose = this.currentPose;
      this.currentPose = nextPose;
      this.poseBlend = 0;
    } else if (this.poseBlend < 1) {
      this.poseBlend = Math.min(1, this.poseBlend + 0.22);
    }

    // Micro-skew dinâmico ancorado nos pés (remada, freio, ollie, grind)
    let targetSkew = 0;
    if (this.isGrinding) {
      targetSkew = Math.sin(this.wheelPhase * 1.5) * 0.045;
    } else if (this.isPushing) {
      targetSkew = 0.045 + Math.sin(this.pushPhase * Math.PI) * 0.04;
    } else if (this.isBraking) {
      targetSkew = -0.075;
    } else if (!this.onGround && this.olliePopTimer > 0) {
      targetSkew = -Math.sin((this.olliePopTimer / 15) * Math.PI) * 0.055;
    }
    this.skewX += (targetSkew - this.skewX) * 0.22;

    for (let i = this.trail.length - 1; i >= 0; i--) {
      this.trail[i].life -= 0.14;
      this.trail[i].x -= this.speed * 0.6;
      if (this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
  }

  // ---- Dano ----------------------------------------------------------------

  takeDamage(reason = 'Bateu no obstáculo', instantDeath = false) {
    if (!instantDeath && (this.invincibleTimer > 0 || this.turboTimer > 0 || this.feverTimer > 0)) return;

    if (this.hasShield && !instantDeath) {
      this.hasShield = false;
      this.invincibleTimer = 70;
      this.emitEvent('damage', { intensity: 0.5 });
      if (window.soundSystem && window.soundSystem.playHit) window.soundSystem.playHit();
      if (window.particleSystem && window.particleSystem.emitSparks) {
        window.particleSystem.emitSparks(this.x + this.width * 0.5, this.y + 50, 20, '#34d399');
      }
      if (window.particleSystem && window.particleSystem.addFloatingText) {
        window.particleSystem.addFloatingText('ESCUDO QUEBROU', this.x + this.width * 0.5, this.y - 58, '#34d399', 22);
      }
      if (window.game) { window.game.camera.shake(8); window.game.flash('power'); }
      return;
    }

    if (this.isGrinding) this.endGrind();
    this.isOnElevated = false;
    const noLifeLoss = (this.gameMode === 'time60' || this.gameMode === 'free') && !instantDeath;
    if (!noLifeLoss) {
      this.lives -= instantDeath ? this.lives : 1;
    }
    this.invincibleTimer = 100;
    this.deathReason = reason;
    this.comboMultiplier = 1;
    this.comboPoints = 0;
    this.comboLinkTimer = 0;
    this.linkedComboMult = 1;
    this.emitEvent('damage', { intensity: 1 });

    if (window.soundSystem && window.soundSystem.playHit) window.soundSystem.playHit();
    if (window.particleSystem && window.particleSystem.emitSparks) {
      window.particleSystem.emitSparks(this.x + this.width * 0.5, this.y + 50, 26, '#f43f7e');
    }
    if (window.particleSystem && window.particleSystem.addFloatingText) {
      window.particleSystem.addFloatingText(noLifeLoss ? 'TROPEÇOU!' : reason, this.x + this.width * 0.5, this.y - 58, '#f43f7e', 24);
    }

    if (window.game) { window.game.camera.shake(14); window.game.flash('damage'); }

    if (this.lives <= 0) {
      this.isGameOver = true;
      if (window.soundSystem && window.soundSystem.stopMusic) window.soundSystem.stopMusic();
      if (window.soundSystem && window.soundSystem.playGameOver) window.soundSystem.playGameOver();
    }
  }

  // ---- Desenho -------------------------------------------------------------

  getPose() {
    if (this.trickState) return 'trick';
    if (!this.onGround) return 'jump';
    if (this.isDucking) return 'duck';
    return 'skate';
  }

  /** Cinemática inversa de 2 ossos (quadril->joelho->pé ou ombro->cotovelo->mão). */
  static solve2BoneIK(ax, ay, bx, by, len1, len2, bendDir = 1) {
    const dx = bx - ax;
    const dy = by - ay;
    const distRaw = Math.hypot(dx, dy) || 0.0001;
    const maxDist = Math.max(0.001, len1 + len2 - 0.5);
    const minDist = Math.abs(len1 - len2) + 0.5;
    const dist = Math.max(minDist, Math.min(maxDist, distRaw));

    const baseAngle = Math.atan2(dy, dx);
    const cosA = Math.max(-1, Math.min(1, (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist)));
    const jointAngle = baseAngle + bendDir * Math.acos(cosA);
    return {
      jx: ax + Math.cos(jointAngle) * len1,
      jy: ay + Math.sin(jointAngle) * len1
    };
  }

  /** Limita o ponto-alvo ao alcance anatômico real do membro (evita desconexão ou esticamento artificial). */
  static clampReach(ax, ay, bx, by, maxReach, minReach = 4) {
    const dx = bx - ax;
    const dy = by - ay;
    const d = Math.hypot(dx, dy);
    if (d < 0.0001) return { x: ax, y: ay + minReach };
    if (d > maxReach) {
      const k = maxReach / d;
      return { x: ax + dx * k, y: ay + dy * k };
    }
    if (d < minReach) {
      const k = minReach / d;
      return { x: ax + dx * k, y: ay + dy * k };
    }
    return { x: bx, y: by };
  }

  /**
   * Desenha uma peça ilustrada de membro conectando exatamente o pivô (x1, y1) ao pivô (x2, y2).
   * px1,py1 e px2,py2 são os pivôs normalizados (0..1) dentro da imagem.
   */
  static drawRigPart(ctx, img, x1, y1, x2, y2, px1, py1, px2, py2, drawW, drawH, alphaMult = 1) {
    if (!img) return;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const ang = Math.atan2(dy, dx);
    const imgAng = Math.atan2((py2 - py1) * drawH, (px2 - px1) * drawW);

    ctx.save();
    if (alphaMult < 1) ctx.globalAlpha *= alphaMult;
    ctx.translate(x1, y1);
    ctx.rotate(ang - imgAng);
    ctx.drawImage(img, -px1 * drawW, -py1 * drawH, drawW, drawH);
    ctx.restore();
  }

  getGearTheme() {
    if (window.progressionManager && typeof window.progressionManager.getEquippedGearTheme === 'function') {
      return window.progressionManager.getEquippedGearTheme();
    }
    return { id: 'classic', primary: '#22d3ee', secondary: '#8b5cf6', accent: '#f43f7e', frame: '#ef4444' };
  }

  getActiveAccessory(char) {
    if (window.progressionManager && typeof window.progressionManager.getEquippedAccessory === 'function') {
      const shopAcc = window.progressionManager.getEquippedAccessory();
      if (shopAcc && shopAcc !== 'none') return shopAcc;
    }
    return (char && char.accessory) || 'none';
  }

  static drawHeadAccessoryStatic(ctx, nx, ny, hs, accId, animTime = 0, opts = null) {
    if (!accId || accId === 'none') return;
    const headTopY = (opts && typeof opts.headTopY === 'number') ? opts.headTopY : -hs * 0.84;
    const useHelmet = !(opts && opts.useHelmet === false);
    const isIllustrated = !!(opts && opts.isIllustrated);

    ctx.save();
    ctx.translate(nx, ny);

    if (accId === 'shades') {
      // Óculos estilo skatista alinhados exatamente sobre os olhos (translúcidos para manter o rosto reconhecível!)
      const ey = headTopY + hs * (useHelmet ? 0.53 : 0.49);
      const cxShift = isIllustrated ? hs * 0.065 : 0;
      const ew = hs * 0.22;
      const eh = hs * 0.135;
      const gap = hs * 0.04;
      const leftX = cxShift - gap * 0.5 - ew;
      const rightX = cxShift + gap * 0.5;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.56)';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = Math.max(1.5, hs * 0.03);
      for (const lx of [leftX, rightX]) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(lx, ey - eh * 0.5, ew, eh, Math.max(2, hs * 0.04));
        else ctx.rect(lx, ey - eh * 0.5, ew, eh);
        ctx.fill();
        ctx.stroke();

        // Reflexo diagonal sutil na lente
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = Math.max(1.1, hs * 0.018);
        ctx.beginPath();
        ctx.moveTo(lx + ew * 0.22, ey - eh * 0.28);
        ctx.lineTo(lx + ew * 0.52, ey + eh * 0.22);
        ctx.stroke();
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = Math.max(1.5, hs * 0.03);
      }

      // Ponte nasal e hastes laterais até a orelha
      ctx.beginPath();
      ctx.moveTo(leftX + ew, ey - eh * 0.12);
      ctx.lineTo(rightX, ey - eh * 0.12);
      ctx.moveTo(Math.max(-hs * 0.40, leftX - hs * 0.16), ey - eh * 0.05);
      ctx.lineTo(leftX, ey - eh * 0.12);
      ctx.stroke();
    } else if (accId === 'cap') {
      // Boné virado para trás encaixado na cúpula real da cabeça (sem cobrir os olhos!)
      const capY = headTopY + hs * (useHelmet ? 0.21 : 0.27);
      const capR = hs * 0.36;
      ctx.fillStyle = '#f43f7e';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(1.8, hs * 0.032);
      ctx.beginPath();
      ctx.arc(0, capY, capR, Math.PI * 1.02, -0.02);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Botão no topo do boné
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(0, capY - capR, hs * 0.042, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Aba virada para trás (esquerda)
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.ellipse(-capR * 0.96, capY - hs * 0.01, hs * 0.22, hs * 0.065, -0.14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (accId === 'headphones') {
      // Arco abraçando o topo da cabeça e concha alinhada na orelha real
      const earY = headTopY + hs * 0.54;
      const archCenterY = headTopY + hs * 0.50;
      const archR = hs * 0.41;

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = Math.max(3, hs * 0.068);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, archCenterY, archR, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = Math.max(1.5, hs * 0.032);
      ctx.stroke();

      // Concha esquerda (sobre a orelha visível)
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.ellipse(-hs * 0.34, earY, hs * 0.105, hs * 0.155, 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f43f7e';
      ctx.lineWidth = Math.max(1.8, hs * 0.032);
      ctx.stroke();
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.ellipse(-hs * 0.34, earY, hs * 0.042, hs * 0.075, 0.06, 0, Math.PI * 2);
      ctx.fill();
    } else if (accId === 'crown') {
      // Coroa dourada assentada no topo real da cabeça/capacete
      const cy = headTopY + hs * (useHelmet ? 0.13 : 0.19);
      const cw = hs * 0.44;
      const ch = hs * 0.23;
      ctx.fillStyle = '#fbbf24';
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = Math.max(1.8, hs * 0.03);
      ctx.beginPath();
      ctx.moveTo(-cw * 0.5, cy);
      ctx.lineTo(-cw * 0.55, cy - ch * 0.88);
      ctx.lineTo(-cw * 0.22, cy - ch * 0.44);
      ctx.lineTo(0, cy - ch * 1.12);
      ctx.lineTo(cw * 0.22, cy - ch * 0.44);
      ctx.lineTo(cw * 0.55, cy - ch * 0.88);
      ctx.lineTo(cw * 0.5, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Joias coloridas na coroa
      ctx.fillStyle = '#f43f7e';
      ctx.beginPath();
      ctx.arc(0, cy - ch * 0.36, hs * 0.045, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(-cw * 0.26, cy - ch * 0.26, hs * 0.03, 0, Math.PI * 2);
      ctx.arc(cw * 0.26, cy - ch * 0.26, hs * 0.03, 0, Math.PI * 2);
      ctx.fill();
    } else if (accId === 'dino') {
      // Crista divertida de dinossauro acompanhando o contorno real da cúpula traseira
      const topShift = useHelmet ? 0 : hs * 0.05;
      const spikes = [
        { x: -hs * 0.08, y: headTopY + hs * 0.14 + topShift, r: -0.18 },
        { x: -hs * 0.28, y: headTopY + hs * 0.25 + topShift, r: -0.68 },
        { x: -hs * 0.38, y: headTopY + hs * 0.44 + topShift, r: -1.12 }
      ];
      ctx.fillStyle = '#34d399';
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = Math.max(1.6, hs * 0.028);
      for (const sp of spikes) {
        ctx.save();
        ctx.translate(sp.x, sp.y);
        ctx.rotate(sp.r);
        ctx.beginPath();
        ctx.moveTo(-hs * 0.08, 0);
        ctx.lineTo(0, -hs * 0.18);
        ctx.lineTo(hs * 0.08, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    } else if (accId === 'astro') {
      // Antena espacial fixada com suporte no topo real da cabeça
      const topY = headTopY + hs * (useHelmet ? 0.11 : 0.17);
      const sway = Math.sin(animTime * 0.16) * hs * 0.045;
      ctx.fillStyle = '#64748b';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(-hs * 0.04, topY + hs * 0.01, hs * 0.085, hs * 0.038, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(2.2, hs * 0.036);
      ctx.beginPath();
      ctx.moveTo(-hs * 0.04, topY);
      ctx.lineTo(-hs * 0.04 + sway, topY - hs * 0.23);
      ctx.stroke();
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.arc(-hs * 0.04 + sway, topY - hs * 0.24, hs * 0.075, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-hs * 0.04 + sway - 1.5, topY - hs * 0.26, hs * 0.026, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  static drawVectorLimb(ctx, x1, y1, x2, y2, thickness, color, border = '#0f172a', alpha = 1) {
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.lineCap = 'round';
    ctx.strokeStyle = border;
    ctx.lineWidth = thickness + 2.6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  static drawVectorFootShoe(ctx, x1, y1, x2, y2, legColor, shoeColor, soleColor, alpha = 1) {
    Player.drawVectorLimb(ctx, x1, y1, x2, y2 - 4, 8.5, legColor, '#0f172a', alpha);
    ctx.save();
    if (alpha < 1) ctx.globalAlpha *= alpha;
    ctx.translate(x2 + 2.5, y2 - 3);
    ctx.fillStyle = shoeColor;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9.5, 5.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = soleColor;
    ctx.fillRect(-8, 2.5, 17, 2.4);
    ctx.restore();
  }

  draw(ctx) {
    const cm = window.characterManager;
    const char = cm && typeof cm.getSelected === 'function' ? cm.getSelected() : null;
    if (!char) return;

    const baseFootY = this.bottom;
    const spriteFootY = this.bottom + this.bob * 0.35;
    const centerX = this.x + this.width * 0.5;

    // Sombra de contato — ancora o personagem na superfície sólida real abaixo
    this.drawContactShadow(ctx, centerX, baseFootY);

    // Contraluz integrada ao bioma atual
    this.drawBacklight(ctx, centerX, baseFootY);

    // Pisca durante a invencibilidade, mas nunca some por completo
    const blinking = this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 4) % 2 === 0;
    const baseAlpha = blinking ? 0.3 : 1;

    // Animação 2D Cutout (Puppet Rig oficial OU Vector Rig customizável com gênero/pele/rosto grande)
    const isCustomRig = char.bodyStyle === 'custom' && !char.fullPhoto;
    const isSpriteOnly = char.bodyStyle === 'sprite' || char.fullPhoto;
    const rig = (cm && typeof cm.getRigParts === 'function') ? cm.getRigParts() : null;
    if (!isSpriteOnly && (isCustomRig || (rig && rig.ready))) {
      // Rastro sutil em alta velocidade / turbo / Super Flip
      for (const ghost of this.trail) {
        ctx.save();
        ctx.globalAlpha = ghost.life * 0.16;
        this.drawCutoutRig(ctx, char, rig, ghost.x + this.width * 0.5, ghost.y + this.getCurrentHeight(), true, ghost.rot);
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = baseAlpha;
      // Rodas cravadas exatamente em baseFootY (this.bottom); trepidação `this.bob` vai na suspensão dos joelhos/quadril!
      this.drawCutoutRig(ctx, char, rig, centerX, baseFootY, false);
      ctx.restore();

      if (this.hasShield) this.drawShield(ctx, centerX, baseFootY);
      if (this.magnetTimer > 0) this.drawMagnetAura(ctx, centerX, baseFootY);
      if (this.turboTimer > 0) this.drawTurboAura(ctx, centerX, baseFootY);
      if (this.feverTimer > 0) this.drawFeverAura(ctx, centerX, baseFootY);
      return;
    }

    const footY = spriteFootY;
    const pose = this.getPose();
    const useRiderSprite = this.sportId !== 'skate' && typeof cm.getRiderSprite === 'function';
    const sprite = useRiderSprite ? (cm.getRiderSprite(char.id, pose) || cm.getSprite(char.id, pose)) : cm.getSprite(char.id, pose);
    const prevSprite = (this.poseBlend < 1 && this.prevPose !== pose)
      ? (useRiderSprite ? (cm.getRiderSprite(char.id, this.prevPose) || cm.getSprite(char.id, this.prevPose)) : cm.getSprite(char.id, this.prevPose))
      : null;

    // Rastro de velocidade / turbo / Super Flip
    for (const ghost of this.trail) {
      ctx.save();
      ctx.globalAlpha = ghost.life * 0.24;
      ctx.translate(ghost.x + this.width * 0.5, ghost.y + this.getCurrentHeight() * 0.5);
      ctx.rotate(ghost.rot);
      this.paintSprite(ctx, sprite, char, 0, this.getCurrentHeight() * 0.5, 1, 1);
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = baseAlpha;

    if (this.trickState) {
      const pivotY = footY - this.getCurrentHeight() * 0.5;
      ctx.translate(centerX, pivotY);
      if (this.trickState.style === 'flip') {
        // Kickflip: efeito 3D de giro com compressão horizontal + brilho extra
        const flipScaleX = 0.65 + Math.abs(Math.cos(this.trickProgress * Math.PI * 2)) * 0.35;
        ctx.rotate(this.rotation);
        this.paintPoseCrossfade(ctx, sprite, prevSprite, char, 0, this.getCurrentHeight() * 0.5, flipScaleX, 1, 0.42, baseAlpha);
      } else if (this.trickState.style === 'grab') {
        // Indy Grab: inclinação recolhida com pausa estilosa no ápice
        const grabAngle = -Math.sin(this.trickProgress * Math.PI) * 0.48;
        ctx.rotate(grabAngle);
        this.paintPoseCrossfade(ctx, sprite, prevSprite, char, 0, this.getCurrentHeight() * 0.5, this.stretchX, this.squash, 0.34, baseAlpha);
      } else if (this.trickState.style === 'super') {
        // Super Flip: rotação dupla energética
        ctx.rotate(this.rotation * 2);
        this.paintPoseCrossfade(ctx, sprite, prevSprite, char, 0, this.getCurrentHeight() * 0.5, 1, 1, 0.44, baseAlpha);
      } else {
        // 360 Spin: rotação limpa em torno do centro
        ctx.rotate(this.rotation);
        this.paintPoseCrossfade(ctx, sprite, prevSprite, char, 0, this.getCurrentHeight() * 0.5, 1, 1, 0.34, baseAlpha);
      }
    } else if (this.rotation !== 0) {
      const pivotY = footY - this.getCurrentHeight() * 0.5;
      ctx.translate(centerX, pivotY);
      ctx.rotate(this.rotation);
      this.paintPoseCrossfade(ctx, sprite, prevSprite, char, 0, this.getCurrentHeight() * 0.5, 1, 1, 0.3, baseAlpha);
    } else {
      ctx.translate(centerX, footY);
      ctx.rotate(this.pitch);
      // Micro-skew dinâmico ancorado nos pés (remada, freio, ollie e equilíbrio no grind)
      if (Math.abs(this.skewX) > 0.002) {
        ctx.transform(1, 0, this.skewX, 1, 0, 0);
      }
      const sy = this.squash;
      const sx = this.stretchX;
      this.paintPoseCrossfade(ctx, sprite, prevSprite, char, 0, 0, sx, sy, 0.3, baseAlpha);
    }

    ctx.restore();

    if (this.hasShield) this.drawShield(ctx, centerX, footY);
    if (this.magnetTimer > 0) this.drawMagnetAura(ctx, centerX, footY);
    if (this.turboTimer > 0) this.drawTurboAura(ctx, centerX, footY);
    if (this.feverTimer > 0) this.drawFeverAura(ctx, centerX, footY);
  }

  /**
   * Animação 2D Cutout (Puppet Rig com IK de 2 ossos) usando as peças ilustradas
   * oficiais em assets/rig/*.png — mantém 100% da arte do Luigi (e cabeças de foto)
   * com movimentos verdadeiramente articulados e fluidos em todos os 4 esportes.
   */
  drawCutoutRig(ctx, char, rig, centerX, footY, isGhost, ghostRot = null) {
    const cm = window.characterManager;
    const scale = (this.height || 130) / 130;
    const sportId = this.sportId || 'skate';
    const trickStyle = this.trickState ? this.trickState.style : null;
    const trickName = this.trickState ? this.trickState.name : '';
    const tp = this.trickProgress || 0;
    const isFlip = trickStyle === 'flip';
    const isSpin = trickStyle === 'spin';
    const isGrab = trickStyle === 'grab';
    const isSuper = trickStyle === 'super';
    const isSuperman = trickName === 'SUPERMAN';
    const isNoHander = trickName === 'NO-HANDER';
    const isTailwhip = trickName === 'TAILWHIP' && (sportId === 'bmx' || sportId === 'scooter');
    const isBarspin = trickName === 'BARSPIN' && (sportId === 'bmx' || sportId === 'scooter');
    const isMuteGrab = trickName === 'MUTE GRAB' && sportId === 'skates';
    const isSoulGrab = trickName === 'SOUL GRAB' && sportId === 'skates';
    const isAxialSpin = isSpin && !isBarspin; // 360 SPIN no Skate e Patins

    // ---- 1. Alvos cinemáticos (pés, quadril, tronco, cabeça, mãos, equipamento) ----
    const breathe = Math.sin(this.animTime * 0.085) * 1.3;
    const suspBob = this.onGround ? this.bob * 0.85 : 0;

    // Altura exata de apoio calibrada por esporte para rodas cravadas em y = 0
    const baseDeckY = sportId === 'bmx' ? -18.5 : (sportId === 'skates' ? -8.0 : (sportId === 'scooter' ? -10.2 : -12.6));
    // Apenas o Skate se separa verticalmente sob os pés durante Flip/Super Flip
    const targetDeckDropY = (sportId === 'skate' && (isFlip || isSuper)) ? Math.sin(tp * Math.PI) * 14 : 0;
    const targetDeckAngle = this.boardTilt + (this.isGrinding ? Math.sin(this.wheelPhase * 1.6) * 0.045 : 0);

    const cosB = Math.cos(targetDeckAngle);
    const sinB = Math.sin(targetDeckAngle);
    const deckY = baseDeckY + targetDeckDropY;

    // Ângulo compartilhado da pedivela da BMX (mantém pedais 100% sincronizados com os pés!)
    const pedalA = (sportId === 'bmx' && this.isAccelerating && this.onGround) ? this.stridePhase * 1.8 : 0.45;
    this._bmxPedalAngle = pedalA;

    // Pés ancorados por esporte (sem flutuação em nenhum estado!)
    const footClearance = sportId === 'skates' ? 0 : 2.4;
    let targetRearFootX = -17 * cosB;
    let targetRearFootY = deckY - footClearance - 17 * sinB;
    let targetFrontFootX = 18 * cosB;
    let targetFrontFootY = deckY - footClearance + 18 * sinB;
    let rearSkateTilt = 0;
    let frontSkateTilt = 0;

    if (sportId === 'bmx') {
      // Pés cravados nos pedais rotativos da BMX
      targetRearFootX = -4 - Math.cos(pedalA) * 9;
      targetRearFootY = -18.5 - Math.sin(pedalA) * 7;
      targetFrontFootX = -4 + Math.cos(pedalA) * 9;
      targetFrontFootY = -18.5 + Math.sin(pedalA) * 7;
      if (isSuperman) {
        // Superman na BMX: pernas esticadas para trás no ar com as duas mãos no guidão!
        const sup = Math.sin(tp * Math.PI);
        targetRearFootX -= sup * 30;
        targetRearFootY -= sup * 24;
        targetFrontFootX -= sup * 24;
        targetFrontFootY -= sup * 21;
      } else if (isTailwhip) {
        // Tailwhip na BMX: pernas recolhem alto enquanto o quadro traseiro gira por baixo
        const whip = Math.sin(tp * Math.PI);
        targetRearFootX -= whip * 6;
        targetRearFootY -= whip * 18;
        targetFrontFootX += whip * 4;
        targetFrontFootY -= whip * 17;
      }
    } else if (sportId === 'skates') {
      if (this.onGround && !this.isGrinding && !this.isOnRamp && !this.isDucking) {
        // Passada fluida alternada de patinação com apoio exato em y = -8.0 (rodas em 0.0px!)
        const s = Math.sin(this.stridePhase);
        const c = Math.cos(this.stridePhase);
        const amp = this.isAccelerating ? 16 : 9;
        const liftR = Math.max(0, c) * (this.isAccelerating ? 7 : 3);
        const liftF = Math.max(0, -c) * (this.isAccelerating ? 7 : 3);
        targetRearFootX = -6 - s * amp;
        targetRearFootY = -8.0 - liftR;
        targetFrontFootX = 6 + s * amp;
        targetFrontFootY = -8.0 - liftF;
        rearSkateTilt = liftR > 0.5 ? -0.16 * (liftR / 7) : 0;
        frontSkateTilt = liftF > 0.5 ? -0.16 * (liftF / 7) : 0;
      } else {
        // Agachado, grind, rampa ou ar: base exata em -8.0 (rodas encostadas na superfície!)
        targetRearFootX = -15;
        targetRearFootY = -8.0;
        targetFrontFootX = 16;
        targetFrontFootY = -8.0;
        if (this.isGrinding) {
          // Soul Grind estiloso: pé traseiro levemente inclinado atrás, dianteiro cravado na frente
          targetRearFootX = -13;
          targetFrontFootX = 15;
          rearSkateTilt = 0.08;
        }
      }
    } else if (this.pushBlend > 0.02 && this.onGround && (sportId === 'skate' || sportId === 'scooter')) {
      // Remada realista: pé traseiro toca o asfalto (y=-1.2) dentro do alcance anatômico (zero desconexão!)
      const ph = this.pushPhase * Math.PI * 2;
      const pushX = -5 - Math.sin(ph) * 19;
      const pushY = -1.2 - Math.max(0, -Math.cos(ph)) * 12;
      targetRearFootX = targetRearFootX + (pushX - targetRearFootX) * this.pushBlend;
      targetRearFootY = targetRearFootY + (pushY - targetRearFootY) * this.pushBlend;
    }

    // Movimento de pernas no ar (ollie, ápice recolhido, descida buscando chão, manobras)
    if (!this.onGround && !isSuperman && !isTailwhip) {
      if (isMuteGrab) {
        // Mute Grab nos Patins: pés sobem bem alto e cruzam à frente para a mão dianteira agarrar!
        const mg = Math.sin(tp * Math.PI);
        targetRearFootX = -10 + mg * 18;
        targetRearFootY = -8.0 - mg * 25;
        targetFrontFootX = 12 - mg * 8;
        targetFrontFootY = -8.0 - mg * 21;
        rearSkateTilt = -0.35 * mg;
        frontSkateTilt = 0.25 * mg;
      } else if (isSoulGrab) {
        // Soul Grab nos Patins: pé traseiro recolhe firme perto do quadril para a mão traseira alcançar limpo!
        const sg = Math.sin(tp * Math.PI);
        targetRearFootX = -14 + sg * 8;
        targetRearFootY = -8.0 - sg * 24;
        targetFrontFootX = 16 + sg * 6;
        targetFrontFootY = -8.0 - sg * 14;
        rearSkateTilt = 0.28 * sg;
      } else if (isFlip || isSuper) {
        // Recolhe joelhos bem alto acima do equipamento + catch no final
        const tuck = Math.sin(tp * Math.PI);
        targetRearFootY -= tuck * (sportId === 'skate' ? 20 : 14);
        targetFrontFootY -= tuck * (sportId === 'skate' ? 18 : 13);
        targetRearFootX -= tuck * 3;
        targetFrontFootX += tuck * 3;
      } else if (isBarspin) {
        // Barspin: joelhos levemente recolhidos para estabilidade no ar
        const bs = Math.sin(tp * Math.PI);
        targetRearFootY -= bs * 8;
        targetFrontFootY -= bs * 8;
      } else if (this.olliePopTimer > 0) {
        // Batida do tail no ollie: pé traseiro empurra para baixo, dianteiro sobe
        const pop = Math.sin((this.olliePopTimer / 15) * Math.PI);
        targetFrontFootY -= pop * 9;
        targetRearFootY += pop * 2;
      } else if (this.vy < 3) {
        // Recolhimento leve perto do ápice do salto
        const apexTuck = Math.max(0, 1 - Math.abs(this.vy) / 10) * 8;
        targetRearFootY -= apexTuck;
        targetFrontFootY -= apexTuck;
      } else {
        // Estica suavemente buscando a pista na descida
        const reach = Math.min(6, (this.vy - 3) * 0.45);
        targetRearFootY += reach * 0.5;
        targetFrontFootY += reach * 0.5;
      }
    }

    // Quadril e tronco com flexão real de joelhos (agachamento, pouso, remada, força G da rampa + suspensão `suspBob`)
    const crouchDrop = this.crouchBlend * 28 + (1 - this.squash) * 26;
    const pushKneeDip = this.pushBlend * 5.5;
    const airLift = (!this.onGround ? Math.min(10, Math.max(0, -this.vy * 0.44)) : 0)
      + ((sportId === 'skate' && (isFlip || isSuper)) ? Math.sin(tp * Math.PI) * 12 : 0)
      + (isTailwhip ? Math.sin(tp * Math.PI) * 6 : 0);
    const bmxLift = sportId === 'bmx' ? -6 : 0;

    const targetHipX = -2
      + this.pushBlend * 5
      + (this.isBraking ? -6 : 0)
      + (isSuperman ? -12 * Math.sin(tp * Math.PI) : 0);
    const targetHipY = Math.min(-28, -55 + bmxLift + crouchDrop + pushKneeDip - airLift + breathe * 0.6 + suspBob);

    const targetTorsoLean = 0.13
      + this.crouchBlend * 0.54
      + this.pushBlend * 0.22
      + (this.isGrinding ? -0.05 : 0)
      + (this.isBraking ? -0.18 : 0)
      + ((isGrab || isMuteGrab) && !isNoHander ? 0.30 : 0)
      + (isSuperman ? 0.58 * Math.sin(tp * Math.PI) : 0)
      + (isBarspin ? -0.14 * Math.sin(tp * Math.PI) : 0);

    const targetHeadTilt = -targetTorsoLean * 0.40 + (this.isOnRamp ? -0.12 : 0) + (this.isAccelerating ? 0.06 : 0);

    // Ombros provisórios para calcular alvos das mãos
    const torsoBone = 30;
    const tmpShoulderX = targetHipX + Math.sin(targetTorsoLean) * torsoBone;
    const tmpShoulderY = targetHipY - Math.cos(targetTorsoLean) * torsoBone;

    const sway = Math.sin(this.animTime * 0.11) * 3.5;
    let targetBackHandX = tmpShoulderX - 21 + sway;
    let targetBackHandY = tmpShoulderY + 17 + Math.cos(this.animTime * 0.11) * 3;
    let targetFrontHandX = tmpShoulderX + 24 - sway;
    let targetFrontHandY = tmpShoulderY + 14 - Math.cos(this.animTime * 0.11) * 3;

    const barX = sportId === 'bmx' ? 18 : 20;
    const barY = sportId === 'bmx' ? -71.5 : -76;

    if ((sportId === 'bmx' || sportId === 'scooter') && !isNoHander && (!isGrab || isSuperman)) {
      if (isBarspin) {
        // BARSPIN: mãos soltam em arco curto e giram o guidão 360°!
        const bs = Math.sin(tp * Math.PI);
        const spinA = tp * Math.PI * 2;
        targetBackHandX = barX - 6 - bs * 7 + Math.cos(spinA) * 5 * bs;
        targetBackHandY = barY - 2 - bs * 4 + Math.sin(spinA) * 4 * bs;
        targetFrontHandX = barX + 5 + bs * 6 - Math.cos(spinA) * 5 * bs;
        targetFrontHandY = barY + 1 - bs * 4 - Math.sin(spinA) * 4 * bs;
      } else {
        // Mãos presas ao guidão via IK (inclusive durante TAILWHIP, BACKFLIP, BRI FLIP e SUPERMAN!)
        targetBackHandX = barX - 4;
        targetBackHandY = barY + 1;
        targetFrontHandX = barX + 3;
        targetFrontHandY = barY + 2;
        if (this.pushBlend > 0.1 && sportId === 'scooter') {
          // Na remada do patinete, mão traseira solta um pouco para contrapeso
          const ph = this.pushPhase * Math.PI * 2;
          targetBackHandX = tmpShoulderX - 14 + Math.sin(ph) * 14 * this.pushBlend;
          targetBackHandY = tmpShoulderY + 16;
        }
      }
    } else if (isNoHander) {
      // NO-HANDER no Patinete: mãos partem EXATAMENTE do guidão (barX, barY) e abrem em V triunfal para cima!
      const nh = Math.sin(tp * Math.PI);
      const openBackX = tmpShoulderX - 27;
      const openBackY = tmpShoulderY - 14;
      const openFrontX = tmpShoulderX + 29;
      const openFrontY = tmpShoulderY - 16;
      targetBackHandX = (barX - 4) + (openBackX - (barX - 4)) * nh;
      targetBackHandY = (barY + 1) + (openBackY - (barY + 1)) * nh;
      targetFrontHandX = (barX + 3) + (openFrontX - (barX + 3)) * nh;
      targetFrontHandY = (barY + 2) + (openFrontY - (barY + 2)) * nh;
    } else if (isMuteGrab) {
      // MUTE GRAB nos Patins: mão dianteira desce e agarra o patins cruzado no alto; mão traseira abre em equilíbrio!
      const mg = Math.sin(tp * Math.PI);
      targetFrontHandX = targetFrontHandX + (targetRearFootX - targetFrontHandX) * mg;
      targetFrontHandY = targetFrontHandY + (targetRearFootY - 4 - targetFrontHandY) * mg;
      targetBackHandX = tmpShoulderX - 28;
      targetBackHandY = tmpShoulderY - 8;
    } else if (isGrab) {
      // INDY GRAB (Skate) / SOUL GRAB (Patins): mão traseira agarra a borda do shape ou bota do patins!
      const gb = Math.sin(tp * Math.PI);
      const gx = isSoulGrab ? targetRearFootX : 5;
      const gy = isSoulGrab ? (targetRearFootY - 4) : (deckY - 4);
      targetBackHandX = targetBackHandX + (gx - targetBackHandX) * gb;
      targetBackHandY = targetBackHandY + (gy - targetBackHandY) * gb;
      targetFrontHandX = tmpShoulderX + 28;
      targetFrontHandY = tmpShoulderY - 9;
    } else if (this.isGrinding) {
      // Equilíbrio dinâmico de braços abertos no Grind
      const bal = Math.sin(this.wheelPhase * 1.6) * 9;
      targetBackHandX = tmpShoulderX - 29;
      targetBackHandY = tmpShoulderY + 2 + bal;
      targetFrontHandX = tmpShoulderX + 30;
      targetFrontHandY = tmpShoulderY + 2 - bal;
    } else if (sportId === 'skates' && this.onGround && !this.isDucking) {
      // Balanço ritmado oposto às pernas na patinação
      const swing = Math.sin(this.stridePhase) * (this.isAccelerating ? 17 : 10);
      targetBackHandX = tmpShoulderX - 10 + swing;
      targetBackHandY = tmpShoulderY + 18;
      targetFrontHandX = tmpShoulderX + 14 - swing;
      targetFrontHandY = tmpShoulderY + 15;
    } else if (this.pushBlend > 0.05) {
      // Contrapeso dos braços na remada
      const ph = this.pushPhase * Math.PI * 2;
      const swing = Math.sin(ph) * 15 * this.pushBlend;
      targetBackHandX = tmpShoulderX - 14 + swing;
      targetBackHandY = tmpShoulderY + 18;
      targetFrontHandX = tmpShoulderX + 22 - swing;
      targetFrontHandY = tmpShoulderY + 12;
    } else if (!this.onGround) {
      // Braços abertos/erguidos no ar
      targetBackHandX = tmpShoulderX - 26;
      targetBackHandY = tmpShoulderY - 3;
      targetFrontHandX = tmpShoulderX + 28;
      targetFrontHandY = tmpShoulderY - 7;
    } else if (this.isDucking) {
      targetBackHandX = tmpShoulderX - 17;
      targetBackHandY = tmpShoulderY + 13;
      targetFrontHandX = tmpShoulderX + 21;
      targetFrontHandY = tmpShoulderY + 11;
    }

    // ---- 2. Interpolação suave das juntas (zero estalos entre poses!) ----
    if (!this.rigPose) {
      this.rigPose = {
        hipX: targetHipX, hipY: targetHipY, torsoLean: targetTorsoLean, headTilt: targetHeadTilt,
        rearFootX: targetRearFootX, rearFootY: targetRearFootY,
        frontFootX: targetFrontFootX, frontFootY: targetFrontFootY,
        backHandX: targetBackHandX, backHandY: targetBackHandY,
        frontHandX: targetFrontHandX, frontHandY: targetFrontHandY,
        deckAngle: targetDeckAngle, deckDropY: targetDeckDropY,
        rearSkateTilt, frontSkateTilt
      };
    } else if (!isGhost) {
      const k = 0.30;
      const p = this.rigPose;
      p.hipX += (targetHipX - p.hipX) * k;
      p.hipY += (targetHipY - p.hipY) * k;
      p.torsoLean += (targetTorsoLean - p.torsoLean) * k;
      p.headTilt += (targetHeadTilt - p.headTilt) * k;
      p.rearFootX += (targetRearFootX - p.rearFootX) * 0.36;
      p.rearFootY += (targetRearFootY - p.rearFootY) * 0.36;
      p.frontFootX += (targetFrontFootX - p.frontFootX) * 0.36;
      p.frontFootY += (targetFrontFootY - p.frontFootY) * 0.36;
      p.backHandX += (targetBackHandX - p.backHandX) * 0.30;
      p.backHandY += (targetBackHandY - p.backHandY) * 0.30;
      p.frontHandX += (targetFrontHandX - p.frontHandX) * 0.30;
      p.frontHandY += (targetFrontHandY - p.frontHandY) * 0.30;
      p.deckAngle += (targetDeckAngle - p.deckAngle) * 0.32;
      p.deckDropY += (targetDeckDropY - p.deckDropY) * 0.32;
      p.rearSkateTilt = (p.rearSkateTilt || 0) + (rearSkateTilt - (p.rearSkateTilt || 0)) * 0.32;
      p.frontSkateTilt = (p.frontSkateTilt || 0) + (frontSkateTilt - (p.frontSkateTilt || 0)) * 0.32;
    }

    const rp = this.rigPose;
    const shoulderX = rp.hipX + Math.sin(rp.torsoLean) * torsoBone;
    const shoulderY = rp.hipY - Math.cos(rp.torsoLean) * torsoBone;
    const neckX = rp.hipX + Math.sin(rp.torsoLean) * 34;
    const neckY = rp.hipY - Math.cos(rp.torsoLean) * 34;

    // ---- 3. Solução IK de 2 ossos com clamp anatômico (zero desconexões/esticamentos!) ----
    const thighLen = 24.5;
    const shinLen = 28.1;
    const upperArmLen = 17.7;
    const lowerArmLen = 19.2;
    const maxLegReach = thighLen + shinLen - 0.6;
    const maxArmReach = upperArmLen + lowerArmLen - 0.6;

    const rFoot = Player.clampReach(rp.hipX - 4, rp.hipY + 2, rp.rearFootX, rp.rearFootY, maxLegReach, 6);
    const fFoot = Player.clampReach(rp.hipX + 4, rp.hipY + 2, rp.frontFootX, rp.frontFootY, maxLegReach, 6);
    const bHand = Player.clampReach(shoulderX - 4, shoulderY + 3, rp.backHandX, rp.backHandY, maxArmReach, 6);
    const fHand = Player.clampReach(shoulderX + 4, shoulderY + 3, rp.frontHandX, rp.frontHandY, maxArmReach, 6);

    const rearKnee = Player.solve2BoneIK(rp.hipX - 4, rp.hipY + 2, rFoot.x, rFoot.y, thighLen, shinLen, -1);
    const frontKnee = Player.solve2BoneIK(rp.hipX + 4, rp.hipY + 2, fFoot.x, fFoot.y, thighLen, shinLen, -1);
    // Cotovelo traseiro dobra naturalmente para baixo quando o braço vai para trás, e para baixo/trás quando vai para frente!
    const backElbowBend = (bHand.x < shoulderX - 2) ? -1 : 1;
    const backElbow = Player.solve2BoneIK(shoulderX - 4, shoulderY + 3, bHand.x, bHand.y, upperArmLen, lowerArmLen, backElbowBend);
    const frontElbow = Player.solve2BoneIK(shoulderX + 4, shoulderY + 3, fHand.x, fHand.y, upperArmLen, lowerArmLen, 1);

    // ---- 4. Renderização em camadas de profundidade (trás -> frente) ----
    const isCustomRig = char.bodyStyle === 'custom';
    const customPal = isCustomRig && window.CHAR_CUSTOMIZATION ? window.CHAR_CUSTOMIZATION : null;
    const skinObj = isCustomRig && customPal
      ? (customPal.SKIN_TONES.find(s => s.id === char.skinTone) || customPal.SKIN_TONES[1])
      : { hex: '#f3c69f', shadow: '#cf966b' };
    const outfitObj = isCustomRig && customPal
      ? (customPal.OUTFITS.find(o => o.id === char.outfit) || customPal.OUTFITS[0])
      : { top: '#2563eb', topAccent: '#22d3ee', bottom: '#1e293b', shoe: '#ef4444', shoeSole: '#f8fafc' };
    const hairObj = isCustomRig && customPal
      ? (customPal.HAIR_COLORS.find(h => h.id === char.hairColor) || customPal.HAIR_COLORS[1])
      : { hex: '#5c3317' };
    const gender = (char && char.gender) || 'boy';
    const gear = this.getGearTheme();
    const activeAcc = this.getActiveAccessory(char);

    ctx.save();
    ctx.translate(centerX, footY);
    ctx.scale(scale, scale);

    // Peg Grind da BMX: assenta os pegs metálicos exatamente sobre o corrimão (y = 0)!
    if (sportId === 'bmx' && this.isGrinding) {
      ctx.translate(0, 14.5);
    }

    // Transformação de corpo inteiro distinta por estilo de manobra (sempre fecha volta exata!)
    const activeRot = (isGhost && ghostRot !== null && ghostRot !== undefined) ? ghostRot : this.rotation;
    if (isAxialSpin) {
      // 360 SPIN (Skate/Patins): giro axial horizontal 3D simulado (inconfundível vs flip!)
      const spinCos = Math.cos(activeRot);
      const safeSpinX = Math.abs(spinCos) < 0.22 ? (spinCos >= 0 ? 0.22 : -0.22) : spinCos;
      const spinTilt = Math.sin(activeRot) * 0.13;
      ctx.translate(0, -60);
      ctx.rotate(spinTilt);
      ctx.scale(safeSpinX, 1);
      ctx.translate(0, 60);
    } else if (isBarspin) {
      // BARSPIN (BMX/Patinete): piloto empina levemente sem dar cambalhota; o guidão gira 360°!
      const barTilt = -Math.sin(tp * Math.PI) * 0.18;
      ctx.translate(0, -56);
      ctx.rotate(barTilt);
      ctx.translate(0, 56);
    } else if (isSuper) {
      // SUPER FLIP / BACKFLIP / BRI FLIP / MISTY FLIP: sempre completa voltas inteiras de 2π!
      const superFactor = trickName === 'BACKFLIP' ? 1 : 2;
      ctx.translate(0, -62);
      ctx.rotate(activeRot * superFactor);
      if (trickName === 'MISTY FLIP') {
        const mistyX = 0.72 + Math.abs(Math.cos(activeRot)) * 0.28;
        ctx.scale(mistyX, 1);
      }
      ctx.translate(0, 62);
    } else if (isGrab || isMuteGrab) {
      const grabTilt = -Math.sin(tp * Math.PI) * (isSuperman ? 0.18 : 0.30);
      ctx.translate(0, -56);
      ctx.rotate(grabTilt);
      ctx.translate(0, 56);
    } else {
      ctx.rotate(this.pitch);
    }

    // 4a. Equipamento traseiro (BMX / Patinete — com giro real de TAILWHIP!)
    const whipAngle = isTailwhip ? tp * Math.PI * 2 : 0;
    const barSpinAngle = isBarspin ? tp * Math.PI * 2 : 0;
    if (sportId === 'bmx') {
      this.drawBMXBack(ctx, 0, rp.deckDropY, 1, 1, whipAngle);
    } else if (sportId === 'scooter') {
      this.drawScooterBack(ctx, 0, rp.deckDropY, 1, 1, whipAngle);
    }

    // 4b. Braço traseiro (Vector customizável ou peças ilustradas reais)
    if (isCustomRig) {
      Player.drawVectorLimb(ctx, shoulderX - 4, shoulderY + 3, backElbow.jx, backElbow.jy, 7.5, outfitObj.top, '#0f172a', 0.88);
      Player.drawVectorLimb(ctx, backElbow.jx, backElbow.jy, bHand.x, bHand.y, 6.8, skinObj.shadow, '#0f172a', 0.90);
    } else {
      Player.drawRigPart(ctx, rig.armUpper, shoulderX - 4, shoulderY + 3, backElbow.jx, backElbow.jy, 0.50, 0.16, 0.50, 0.84, 16, 26, 0.86);
      Player.drawRigPart(ctx, rig.armLower, backElbow.jx, backElbow.jy, bHand.x, bHand.y, 0.50, 0.14, 0.50, 0.88, 15, 26, 0.86);
    }

    // 4c. Perna traseira
    if (isCustomRig) {
      Player.drawVectorLimb(ctx, rp.hipX - 4, rp.hipY + 2, rearKnee.jx, rearKnee.jy, 10, outfitObj.bottom, '#0f172a', 0.88);
      Player.drawVectorFootShoe(ctx, rearKnee.jx, rearKnee.jy, rFoot.x, rFoot.y, outfitObj.bottom, outfitObj.shoe, outfitObj.shoeSole, 0.90);
    } else {
      Player.drawRigPart(ctx, rig.thigh, rp.hipX - 4, rp.hipY + 2, rearKnee.jx, rearKnee.jy, 0.50, 0.16, 0.50, 0.84, 24, 36, 0.86);
      Player.drawRigPart(ctx, rig.shinShoe, rearKnee.jx, rearKnee.jy, rFoot.x, rFoot.y, 0.42, 0.14, 0.52, 0.92, 25, 36, 0.88);
    }
    if (sportId === 'skates') {
      this.drawSingleInlineSkate(ctx, rFoot.x, rFoot.y, true, rp.rearSkateTilt || 0);
    }

    // 4d. Skate independente (com giro 3D real no Kickflip / Super Flip + trucks e skin da Oficina!)
    if (sportId === 'skate') {
      ctx.save();
      ctx.translate(0, baseDeckY + rp.deckDropY);
      ctx.rotate(rp.deckAngle);
      const flipScaleY = (isFlip || isSuper) ? Math.cos(this.boardFlipAngle) : 1;
      const safeScaleY = Math.abs(flipScaleY) < 0.18 ? (flipScaleY >= 0 ? 0.18 : -0.18) : flipScaleY;
      ctx.scale(1, safeScaleY);
      const bw = 88, bh = 27;
      if (rig && rig.skateboard && gear.id === 'classic') {
        ctx.drawImage(rig.skateboard, -bw * 0.50, -bh * 0.42, bw, bh);
      } else {
        // Shape estilizado da Oficina com trucks metálicos reais e rodas cravadas em y = 0!
        const deckGrad = ctx.createLinearGradient(-42, 0, 42, 0);
        deckGrad.addColorStop(0, gear.secondary);
        deckGrad.addColorStop(0.5, gear.primary);
        deckGrad.addColorStop(1, gear.accent);

        // Trucks metálicos (baseplate + hanger conectando shape às rodas)
        for (const wx of [-24, 24]) {
          ctx.fillStyle = '#94a3b8';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.4;
          ctx.fillRect(wx - 5.5, 2.2, 11, 2.4);
          ctx.beginPath();
          ctx.moveTo(wx - 3.8, 4.4);
          ctx.lineTo(wx + 3.8, 4.4);
          ctx.lineTo(wx + 2.2, 8.2);
          ctx.lineTo(wx - 2.2, 8.2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // Shape curvado (nose e tail levemente erguidos)
        ctx.fillStyle = deckGrad;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-43, -4.5);
        ctx.lineTo(-32, -2.2);
        ctx.lineTo(32, -2.2);
        ctx.lineTo(43, -4.5);
        ctx.lineTo(42, 1.5);
        ctx.lineTo(31, 3.6);
        ctx.lineTo(-31, 3.6);
        ctx.lineTo(-42, 1.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Lixa preta no topo
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-33, -3.4, 66, 2.0);

        // Rodinhas girando em wheelSpin (fundo: -12.6 + 7.6 + 5.0 = 0.0px exato!)
        for (const wx of [-24, 24]) {
          const wy = 7.6;
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(wx, wy, 5.0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = gear.accent;
          ctx.beginPath();
          ctx.arc(wx, wy, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + Math.cos(this.wheelSpin) * 3.8, wy + Math.sin(this.wheelSpin) * 3.8);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Arco cinético ciano durante Kickflip para reforçar leitura visual do giro do shape
      if (!isGhost && isFlip) {
        const arcAlpha = Math.sin(tp * Math.PI) * 0.65;
        if (arcAlpha > 0.05) {
          ctx.save();
          ctx.globalAlpha *= arcAlpha;
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.ellipse(0, baseDeckY + rp.deckDropY, 44, 12, rp.deckAngle, this.boardFlipAngle, this.boardFlipAngle + Math.PI * 1.15);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 4e. Tronco (Customizado por gênero/roupa OU camisa oficial do Luigi)
    if (isCustomRig) {
      ctx.save();
      ctx.translate(rp.hipX, rp.hipY);
      ctx.rotate(rp.torsoLean);
      // Pescoço no tom de pele
      ctx.fillStyle = skinObj.shadow;
      ctx.fillRect(-4.5, -39, 9, 10);

      ctx.fillStyle = outfitObj.top;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      if (gender === 'girl') {
        ctx.moveTo(-13, -34);
        ctx.lineTo(13, -34);
        ctx.lineTo(10, -7);
        ctx.lineTo(14.5, 2);
        ctx.lineTo(-14.5, 2);
        ctx.lineTo(-10, -7);
      } else if (gender === 'neutral') {
        ctx.moveTo(-16, -35);
        ctx.lineTo(16, -35);
        ctx.lineTo(16, 0);
        ctx.lineTo(-16, 0);
      } else {
        ctx.moveTo(-15, -35);
        ctx.lineTo(15, -35);
        ctx.lineTo(13, -1);
        ctx.lineTo(-13, -1);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Faixa street no peito
      ctx.fillStyle = outfitObj.topAccent;
      ctx.fillRect(-10, -23, 20, 6);
      ctx.restore();
    } else if (rig && rig.torso) {
      ctx.save();
      ctx.translate(rp.hipX, rp.hipY);
      ctx.rotate(rp.torsoLean);
      const tw = 40, th = 47;
      ctx.drawImage(rig.torso, -tw * 0.50, -th * 0.86, tw, th);
      ctx.restore();
    }

    // 4f. Perna dianteira
    if (isCustomRig) {
      Player.drawVectorLimb(ctx, rp.hipX + 4, rp.hipY + 2, frontKnee.jx, frontKnee.jy, 10, outfitObj.bottom, '#0f172a', 1);
      Player.drawVectorFootShoe(ctx, frontKnee.jx, frontKnee.jy, fFoot.x, fFoot.y, outfitObj.bottom, outfitObj.shoe, outfitObj.shoeSole, 1);
    } else {
      Player.drawRigPart(ctx, rig.thigh, rp.hipX + 4, rp.hipY + 2, frontKnee.jx, frontKnee.jy, 0.50, 0.16, 0.50, 0.84, 24, 36, 1);
      Player.drawRigPart(ctx, rig.shinShoe, frontKnee.jx, frontKnee.jy, fFoot.x, fFoot.y, 0.42, 0.14, 0.52, 0.92, 25, 36, 1);
    }
    if (sportId === 'skates') {
      this.drawSingleInlineSkate(ctx, fFoot.x, fFoot.y, false, rp.frontSkateTilt || 0);
    }

    // 4g. Cabeça (Grande para fotos/customizados bem encaixada no pescoço + rabo de cavalo fluido + Acessório!)
    const customHead = (cm && typeof cm.getHeadImage === 'function') ? cm.getHeadImage(char.id) : null;
    const headImg = (customHead && customHead.width > 0) ? customHead : (rig ? rig.head : null);
    const useLargeHead = char.headSize === 'large' || (char.isCustom && char.hasPhoto);
    const crouchHeadScale = useLargeHead ? (1 - this.crouchBlend * 0.08) : 1;
    const hs = (useLargeHead ? 76 : 48) * crouchHeadScale;
    const headTopY = useLargeHead ? -hs * 0.88 : -hs * 0.82;
    if (headImg) {
      ctx.save();
      ctx.translate(neckX, neckY + (useLargeHead ? this.crouchBlend * 4 : 0));
      ctx.rotate(rp.torsoLean * 0.55 + rp.headTilt);

      // Rabo de cavalo dinâmico com física de vento/salto e elástico colorido para estilo menina!
      if (isCustomRig && gender === 'girl') {
        const speedLag = (this.speedNormalized || 0) * 6;
        const airDrag = Math.max(-7, Math.min(8, (this.vy || 0) * 0.45));
        const wave = Math.sin(this.animTime * 0.18) * 3.2;
        const tieX = -hs * 0.34;
        const tieY = headTopY + hs * 0.46;
        const tailEndX = tieX - hs * 0.34 - speedLag;
        const tailEndY = tieY + hs * 0.14 + wave - airDrag;

        ctx.fillStyle = hairObj.hex;
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tieX, tieY - hs * 0.06);
        ctx.quadraticCurveTo(tieX - hs * 0.20, tieY - hs * 0.12 - airDrag * 0.5, tailEndX, tailEndY);
        ctx.quadraticCurveTo(tieX - hs * 0.18, tieY + hs * 0.16 + wave * 0.5, tieX, tieY + hs * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Elástico/presilha combinando com a roupa
        ctx.fillStyle = outfitObj.topAccent;
        ctx.beginPath();
        ctx.arc(tieX, tieY, hs * 0.052, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.drawImage(headImg, -hs * 0.50, headTopY, hs, hs);

      if (activeAcc && activeAcc !== 'none') {
        Player.drawHeadAccessoryStatic(ctx, 0, 0, hs, activeAcc, this.animTime, {
          headTopY,
          useHelmet: char.useHelmet !== false,
          isIllustrated: isCustomRig && !char.hasPhoto
        });
      }
      ctx.restore();
    }

    // 4h. Equipamento frontal (guidão BMX / haste Patinete — com giro de BARSPIN!)
    if (sportId === 'bmx') {
      this.drawBMXFront(ctx, 0, rp.deckDropY, 1, 1, barSpinAngle);
    } else if (sportId === 'scooter') {
      this.drawScooterFront(ctx, 0, rp.deckDropY, 1, 1, barSpinAngle);
    }

    // 4i. Braço dianteiro (à frente do tronco e do guidão!)
    if (isCustomRig) {
      Player.drawVectorLimb(ctx, shoulderX + 4, shoulderY + 3, frontElbow.jx, frontElbow.jy, 7.5, outfitObj.top, '#0f172a', 1);
      Player.drawVectorLimb(ctx, frontElbow.jx, frontElbow.jy, fHand.x, fHand.y, 6.8, skinObj.hex, '#0f172a', 1);
    } else {
      Player.drawRigPart(ctx, rig.armUpper, shoulderX + 4, shoulderY + 3, frontElbow.jx, frontElbow.jy, 0.50, 0.16, 0.50, 0.84, 16, 26, 1);
      Player.drawRigPart(ctx, rig.armLower, frontElbow.jx, frontElbow.jy, fHand.x, fHand.y, 0.50, 0.14, 0.50, 0.88, 15, 26, 1);
    }

    // 4j. Arcos cinéticos leves por manobra (clareza visual instantânea em 60fps!)
    if (!isGhost && this.trickState) {
      const fxAlpha = Math.sin(tp * Math.PI);
      if (fxAlpha > 0.08) {
        ctx.save();
        ctx.globalAlpha *= fxAlpha * 0.72;
        if (isAxialSpin) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(0, -52, 34, 10, 0, activeRot, activeRot + Math.PI * 1.1);
          ctx.stroke();
        } else if (isTailwhip) {
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2.6;
          ctx.beginPath();
          ctx.ellipse(6, -16, 38, 11, 0, whipAngle, whipAngle + Math.PI * 1.15);
          ctx.stroke();
        } else if (isBarspin) {
          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(barX, barY, 16, 6, 0, barSpinAngle, barSpinAngle + Math.PI * 1.25);
          ctx.stroke();
        } else if (isMuteGrab || (isGrab && !isNoHander && !isSuperman)) {
          const gx = isMuteGrab ? fHand.x : bHand.x;
          const gy = isMuteGrab ? fHand.y : bHand.y;
          ctx.strokeStyle = isMuteGrab ? '#22d3ee' : '#f43f7e';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(gx, gy, 7 + fxAlpha * 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  /** Desenha um único patins inline acoplado à posição exata do pé no IK (rodas cravadas em fy + 8.0 = 0.0px). */
  drawSingleInlineSkate(ctx, fx, fy, isBack, tilt = 0) {
    const gear = this.getGearTheme();
    const isClassic = gear.id === 'classic';
    ctx.save();
    ctx.translate(fx, fy);
    if (tilt) ctx.rotate(tilt);

    // Detalhe esportivo da bota envolvendo o tênis
    ctx.fillStyle = isBack ? (isClassic ? '#0284c7' : gear.secondary) : (isClassic ? '#22d3ee' : gear.primary);
    ctx.fillRect(-10, -5.5, 20, 4.2);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-6, -4.4, 12, 1.5);

    // Base metálica (frame) sob o solado
    ctx.fillStyle = isBack ? '#94a3b8' : '#e2e8f0';
    ctx.fillRect(-13, -1.5, 26, 3.6);

    // 4 rodinhas neon girando em wheelSpin (wy=4.6 + r=3.4 => fundo em fy + 8.0 = 0.0px!)
    for (let i = 0; i < 4; i++) {
      const wx = -10 + i * 6.8;
      const wy = 4.6;
      ctx.fillStyle = isBack ? (isClassic ? '#fbbf24' : gear.accent) : (isClassic ? '#34d399' : gear.primary);
      ctx.beginPath();
      ctx.arc(wx, wy, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(wx, wy, 1.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(this.wheelSpin) * 2.6, wy + Math.sin(this.wheelSpin) * 2.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Desenha o sprite com crossfade suave de 4-5 frames ao trocar de pose + equipamento do esporte. */
  paintPoseCrossfade(ctx, sprite, prevSprite, char, offsetX, footOffsetY, scaleX, scaleY, lift, baseAlpha) {
    const isAltSport = this.sportId && this.sportId !== 'skate';
    // Elevação calibrada do personagem quando está sobre BMX, Patins ou Patinete
    const riderLiftY = this.sportId === 'bmx' ? -11 : (this.sportId === 'skates' ? -7 : (this.sportId === 'scooter' ? -3 : 0));

    if (isAltSport) {
      this.drawSportEquipmentBack(ctx, offsetX, footOffsetY, scaleX, scaleY);
    }

    if (prevSprite && prevSprite !== sprite && this.poseBlend < 1) {
      ctx.globalAlpha = baseAlpha * (1 - this.poseBlend);
      this.paintSprite(ctx, prevSprite, char, offsetX, footOffsetY + riderLiftY, scaleX, scaleY, lift * 0.5, isAltSport);
      ctx.globalAlpha = baseAlpha * this.poseBlend;
      this.paintSprite(ctx, sprite, char, offsetX, footOffsetY + riderLiftY, scaleX, scaleY, lift, isAltSport);
      ctx.globalAlpha = baseAlpha;
    } else {
      this.paintSprite(ctx, sprite, char, offsetX, footOffsetY + riderLiftY, scaleX, scaleY, lift, isAltSport);
    }

    if (isAltSport) {
      this.drawSportEquipmentFront(ctx, offsetX, footOffsetY, scaleX, scaleY);
    }
  }

  /**
   * Desenha o sprite ancorado nos pés, respeitando a proporção original.
   * Todas as poses usam a mesma escala em pixels (derivada do sprite de
   * skate), então o personagem nunca "estica" ou "encolhe" ao trocar de pose.
   */
  paintSprite(ctx, sprite, char, offsetX, footOffsetY, scaleX = 1, scaleY = 1, lift = 0, clipSkateFallback = false) {
    if (!sprite) {
      // Placeholder enquanto a imagem carrega
      const w = this.width, h = this.getCurrentHeight();
      ctx.fillStyle = 'rgba(139, 92, 246, 0.85)';
      ctx.fillRect(offsetX - w / 2, footOffsetY - h, w, h);
      return;
    }

    const unit = window.characterManager.getSpriteScale(char.id, this.height);
    const w = sprite.width * unit * scaleX;
    const h = sprite.height * unit * scaleY;
    const dx = offsetX - w / 2;
    const dy = footOffsetY - h;

    // Se getRiderSprite não existir, recorta limpamente os 14% inferiores (prancha do skate)
    const needsClip = clipSkateFallback && !(window.characterManager && typeof window.characterManager.getRiderSprite === 'function');
    if (needsClip) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(dx - 8, dy - 8, w + 16, h * 0.86 + 8);
      ctx.clip();
    }

    ctx.drawImage(sprite, dx, dy, w, h);

    // Clareia o sprite sem lavar as cores: uma segunda passada aditiva fraca
    if (lift > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lift;
      ctx.drawImage(sprite, dx, dy, w, h);
      ctx.restore();
    }

    if (needsClip) ctx.restore();
  }

  // ---- Equipamentos 2.5D realistas (BMX, Patinete, Patins) -----------------

  drawSportEquipmentBack(ctx, offsetX, footOffsetY, scaleX, scaleY) {
    if (this.sportId === 'bmx') {
      this.drawBMXBack(ctx, offsetX, footOffsetY, scaleX, scaleY);
    } else if (this.sportId === 'scooter') {
      this.drawScooterBack(ctx, offsetX, footOffsetY, scaleX, scaleY);
    }
  }

  drawSportEquipmentFront(ctx, offsetX, footOffsetY, scaleX, scaleY) {
    if (this.sportId === 'bmx') {
      this.drawBMXFront(ctx, offsetX, footOffsetY, scaleX, scaleY);
    } else if (this.sportId === 'scooter') {
      this.drawScooterFront(ctx, offsetX, footOffsetY, scaleX, scaleY);
    } else if (this.sportId === 'skates') {
      this.drawInlineSkates(ctx, offsetX, footOffsetY, scaleX, scaleY);
    }
  }

  drawWheelSpoked(ctx, cx, cy, r, rimColor, tireColor) {
    // Pneu de borracha
    ctx.strokeStyle = tireColor || '#18181b';
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Aro metálico
    ctx.strokeStyle = rimColor || '#cbd5e1';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2.4, 0, Math.PI * 2);
    ctx.stroke();

    // 6 raios girando em wheelSpin
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 6; i++) {
      const a = this.wheelSpin + (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
      ctx.stroke();
    }

    // Cubo + peg metálico de grind
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(cx, cy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBMXBack(ctx, ox, fy, sx, sy, whipAngle = 0) {
    const gear = this.getGearTheme();
    const isClassic = gear.id === 'classic';
    const rimColor = isClassic ? '#38bdf8' : gear.primary;
    const frameColor = isClassic ? '#ef4444' : gear.frame;
    const rearX = -32, frontX = 34, wheelY = -17.8, r = 15.5;
    const bbX = -4, bbY = -18.5;
    const pedalA = this._bmxPedalAngle !== undefined ? this._bmxPedalAngle : 0.45;

    ctx.save();
    ctx.translate(ox, fy);
    ctx.scale(sx, sy);

    // Roda dianteira sempre alinhada ao garfo e guidão (fundo: -17.8 + 15.5 + 2.3 = 0.0px exato!)
    this.drawWheelSpoked(ctx, frontX, wheelY, r, rimColor, '#111827');

    // Quadro traseiro + roda traseira + selim + pedivela traseiro (gira 360° no TAILWHIP!)
    ctx.save();
    if (whipAngle) {
      const whipCos = Math.cos(whipAngle);
      const safeWhipX = Math.abs(whipCos) < 0.16 ? (whipCos >= 0 ? 0.16 : -0.16) : whipCos;
      const whipLift = Math.sin(whipAngle) * 5;
      ctx.translate(22, -48 + whipLift);
      ctx.scale(safeWhipX, 1);
      ctx.translate(-22, 48);
    }

    // Roda traseira com raios girando
    this.drawWheelSpoked(ctx, rearX, wheelY, r, rimColor, '#111827');

    // Pedivela e pedal traseiro sincronizados com o pé traseiro
    const backPedalX = bbX - Math.cos(pedalA) * 9;
    const backPedalY = bbY - Math.sin(pedalA) * 7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(bbX, bbY);
    ctx.lineTo(backPedalX, backPedalY);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(backPedalX - 4.5, backPedalY - 1.8, 9, 3.6);

    // Quadro tubular BMX (triângulo traseiro + tubo principal)
    ctx.lineJoin = 'round';
    ctx.strokeStyle = frameColor;
    ctx.lineWidth = 4.6;
    ctx.beginPath();
    ctx.moveTo(rearX, wheelY);
    ctx.lineTo(bbX, bbY);        // chain stay -> movimento central
    ctx.lineTo(-14, -44);        // tubo do selim
    ctx.lineTo(rearX, wheelY);   // seat stay
    ctx.moveTo(-14, -44);
    ctx.lineTo(22, -48);         // top tube
    ctx.lineTo(bbX, bbY);        // down tube
    ctx.stroke();

    // Brilho metálico no quadro
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-14, -44);
    ctx.lineTo(22, -48);
    ctx.stroke();

    // Selim BMX
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(-16, -48, 10, 3.6, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Peg traseiro no eixo (destaque metálico no Peg Grind!)
    ctx.fillStyle = this.isGrinding ? '#fef08a' : '#e2e8f0';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.fillRect(rearX - 6, wheelY - 2.1, 11, 4.2);
    ctx.strokeRect(rearX - 6, wheelY - 2.1, 11, 4.2);

    ctx.restore();
    ctx.restore();
  }

  drawBMXFront(ctx, ox, fy, sx, sy, barSpinAngle = 0) {
    const gear = this.getGearTheme();
    const isClassic = gear.id === 'classic';
    const frontX = 34, wheelY = -17.8;
    const bbX = -4, bbY = -18.5;
    const pedalA = this._bmxPedalAngle !== undefined ? this._bmxPedalAngle : 0.45;

    ctx.save();
    ctx.translate(ox, fy);
    ctx.scale(sx, sy);

    // Garfo dianteiro e coluna de direção
    ctx.lineCap = 'round';
    ctx.strokeStyle = isClassic ? '#22d3ee' : gear.primary;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(frontX, wheelY);
    ctx.lineTo(22, -48);
    ctx.lineTo(18, -69);
    ctx.stroke();

    // Guidão BMX elevado + barra transversal (gira 360° no BARSPIN!)
    ctx.save();
    if (barSpinAngle) {
      const barCos = Math.cos(barSpinAngle);
      const safeBarX = Math.abs(barCos) < 0.22 ? (barCos >= 0 ? 0.22 : -0.22) : barCos;
      ctx.translate(18, -71);
      ctx.scale(safeBarX, 1);
      ctx.translate(-18, 71);
    }
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 4.4;
    ctx.beginPath();
    ctx.moveTo(10, -72.5);
    ctx.lineTo(26, -70.5);
    ctx.stroke();
    ctx.strokeStyle = isClassic ? '#fbbf24' : gear.accent;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(12, -65.5);
    ctx.lineTo(24, -64.5);
    ctx.stroke();
    ctx.restore();

    // Coroa + pedivela e pedal dianteiro sincronizados com o pé dianteiro!
    ctx.fillStyle = '#cbd5e1';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(bbX, bbY, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const frontPedalX = bbX + Math.cos(pedalA) * 9;
    const frontPedalY = bbY + Math.sin(pedalA) * 7;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(bbX, bbY);
    ctx.lineTo(frontPedalX, frontPedalY);
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(frontPedalX - 4.8, frontPedalY - 2, 9.6, 4);

    // Peg metálico dianteiro no eixo para Peg Grind
    ctx.fillStyle = this.isGrinding ? '#fef08a' : '#e2e8f0';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.fillRect(frontX - 5, wheelY - 2.1, 11, 4.2);
    ctx.strokeRect(frontX - 5, wheelY - 2.1, 11, 4.2);

    ctx.restore();
  }

  drawScooterBack(ctx, ox, fy, sx, sy, whipAngle = 0) {
    const gear = this.getGearTheme();
    const isClassic = gear.id === 'classic';
    const wheelR = 7.2;
    const wheelY = -wheelR; // fundo exato em 0.0px!

    const drawScooterWheel = (wx) => {
      ctx.fillStyle = isClassic ? '#22d3ee' : gear.primary;
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(wx, wheelY, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(wx, wheelY);
      ctx.lineTo(wx + Math.cos(this.wheelSpin) * 5.2, wheelY + Math.sin(this.wheelSpin) * 5.2);
      ctx.stroke();
    };

    ctx.save();
    ctx.translate(ox, fy);
    ctx.scale(sx, sy);

    // Rodinha dianteira sempre alinhada à haste do guidão
    drawScooterWheel(28);

    // Deck + rodinha traseira (gira 360° em torno da coluna no TAILWHIP!)
    ctx.save();
    if (whipAngle) {
      const whipCos = Math.cos(whipAngle);
      const safeWhipX = Math.abs(whipCos) < 0.16 ? (whipCos >= 0 ? 0.16 : -0.16) : whipCos;
      const whipLift = Math.sin(whipAngle) * 5;
      ctx.translate(25, -10 + whipLift);
      ctx.scale(safeWhipX, 1);
      ctx.translate(-25, 10);
    }

    drawScooterWheel(-26);

    // Deck fino escovado sob os tênis (reflete tema da Oficina)
    const deckGrad = ctx.createLinearGradient(-28, -11, 28, -5);
    deckGrad.addColorStop(0, isClassic ? '#94a3b8' : gear.secondary);
    deckGrad.addColorStop(0.5, isClassic ? '#f1f5f9' : gear.primary);
    deckGrad.addColorStop(1, isClassic ? '#64748b' : gear.secondary);
    ctx.fillStyle = deckGrad;
    ctx.fillRect(-26, -11, 52, 5.5);

    // Lixa preta no topo do deck
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-24, -12, 44, 2.2);

    ctx.restore();
    ctx.restore();
  }

  drawScooterFront(ctx, ox, fy, sx, sy, barSpinAngle = 0) {
    const gear = this.getGearTheme();
    const isClassic = gear.id === 'classic';
    ctx.save();
    ctx.translate(ox, fy);
    ctx.scale(sx, sy);

    // Abraçadeira neon + haste de alumínio na frente + guidão em T
    ctx.lineCap = 'round';
    ctx.strokeStyle = isClassic ? '#e2e8f0' : gear.primary;
    ctx.lineWidth = 4.2;
    ctx.beginPath();
    ctx.moveTo(28, -8.5);
    ctx.lineTo(20, -76);
    ctx.stroke();

    // Abraçadeira colorida
    ctx.fillStyle = isClassic ? '#f43f7e' : gear.accent;
    ctx.fillRect(21.5, -24, 6.5, 9);

    // Guidão em T com manoplas emborrachadas (gira 360° no BARSPIN!)
    ctx.save();
    if (barSpinAngle) {
      const barCos = Math.cos(barSpinAngle);
      const safeBarX = Math.abs(barCos) < 0.22 ? (barCos >= 0 ? 0.22 : -0.22) : barCos;
      ctx.translate(20, -76);
      ctx.scale(safeBarX, 1);
      ctx.translate(-20, 76);
    }
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 5.2;
    ctx.beginPath();
    ctx.moveTo(10, -76);
    ctx.lineTo(30, -76);
    ctx.stroke();
    ctx.strokeStyle = isClassic ? '#22d3ee' : gear.accent;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(11, -76);
    ctx.lineTo(15, -76);
    ctx.moveTo(25, -76);
    ctx.lineTo(29, -76);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  drawInlineSkates(ctx, ox, fy, sx, sy) {
    const gear = this.getGearTheme();
    const isClassic = gear.id === 'classic';
    ctx.save();
    ctx.translate(ox, fy);
    ctx.scale(sx, sy);

    // Dois patins inline (pé traseiro e pé dianteiro) com rodinhas cravadas em y = 0 (cy = -3.6, r = 3.6)
    const feet = [
      { cx: -16, cy: -3.6, isBack: true },
      { cx: 16,  cy: -3.6, isBack: false }
    ];

    for (const f of feet) {
      // Base metálica (frame) sob o tênis
      ctx.fillStyle = f.isBack ? '#94a3b8' : '#e2e8f0';
      ctx.fillRect(f.cx - 14, f.cy - 6.5, 28, 4.0);

      // Detalhe de bota/fivela esportiva sobre o tênis
      ctx.fillStyle = f.isBack ? (isClassic ? '#0284c7' : gear.secondary) : (isClassic ? '#22d3ee' : gear.primary);
      ctx.fillRect(f.cx - 11, f.cy - 11.2, 22, 5.0);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(f.cx - 7, f.cy - 10.2, 14, 1.8);

      // 4 rodinhas neon girando em wheelSpin sob cada pé!
      for (let i = 0; i < 4; i++) {
        const wx = f.cx - 11 + i * 7.4;
        const wy = f.cy;
        ctx.fillStyle = f.isBack ? (isClassic ? '#fbbf24' : gear.accent) : (isClassic ? '#34d399' : gear.primary);
        ctx.beginPath();
        ctx.arc(wx, wy, 3.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(wx, wy, 1.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.cos(this.wheelSpin) * 2.8, wy + Math.sin(this.wheelSpin) * 2.8);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /** Converte cor #hex para rgba com alpha controlado (preserva rgba já formatado). */
  static colorWithAlpha(color, alpha) {
    if (typeof color !== 'string') return null;
    const c = color.trim();
    if (c.startsWith('rgba(')) return c;
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (!m) return null;
    let hex = m[1];
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /** Halo suave atrás do personagem, adaptado ao bioma atual quando disponível. */
  drawBacklight(ctx, cx, footY) {
    const h = this.getCurrentHeight();
    const cy = footY - h * 0.52;
    const r = h * 1.0;

    let innerColor = 'rgba(150, 205, 255, 0.22)';
    let midColor = 'rgba(110, 140, 235, 0.10)';
    let outerColor = 'rgba(110, 140, 235, 0)';

    if (window.game && window.game.world && typeof window.game.world.getBiomeBlend === 'function') {
      const blend = window.game.world.getBiomeBlend();
      if (blend) {
        const inner = Player.colorWithAlpha(blend.rimColor, 0.22);
        const mid = Player.colorWithAlpha(blend.ambientColor, 0.10);
        const outer = Player.colorWithAlpha(blend.ambientColor || blend.rimColor, 0);
        if (inner) innerColor = inner;
        if (mid) midColor = mid;
        if (outer) outerColor = outer;
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    glow.addColorStop(0, innerColor);
    glow.addColorStop(0.45, midColor);
    glow.addColorStop(1, outerColor);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
  }

  drawContactShadow(ctx, cx, footY) {
    // Projeta a sombra apenas sobre a superfície sólida real abaixo (some sobre abismos)
    let surfaceY = this.groundBelowY;
    if (surfaceY === undefined) {
      surfaceY = window.game ? window.game.world.groundY : footY;
    }
    if (surfaceY === null) return;

    const airGap = Math.max(0, surfaceY - footY);
    const fade = Math.max(0, 1 - airGap / 320);
    if (fade <= 0.02) return;

    const rx = this.width * (0.44 + fade * 0.16);
    ctx.save();
    ctx.globalAlpha = 0.42 * fade;
    const grad = ctx.createRadialGradient(cx, surfaceY, 0, cx, surfaceY, rx);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, surfaceY + 3, rx, rx * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawShield(ctx, cx, footY) {
    const h = this.getCurrentHeight();
    const cy = footY - h * 0.5;
    const r = h * 0.62;
    const pulse = 0.7 + Math.sin(Date.now() * 0.006) * 0.3;

    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r);
    grad.addColorStop(0, 'rgba(52, 211, 153, 0)');
    grad.addColorStop(0.8, `rgba(52, 211, 153, ${0.18 * pulse})`);
    grad.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(52, 211, 153, ${0.55 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawMagnetAura(ctx, cx, footY) {
    const h = this.getCurrentHeight();
    const cy = footY - h * 0.5;
    const phase = (this.animTime * 0.09) % 1;
    const r = h * (0.55 + (1 - phase) * 0.45);
    ctx.save();
    ctx.strokeStyle = `rgba(244, 63, 126, ${(0.42 * phase).toFixed(3)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawTurboAura(ctx, cx, footY) {
    const h = this.getCurrentHeight();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(cx, footY - h * 0.5, 0, cx, footY - h * 0.5, h * 0.85);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0.22)');
    grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, footY - h * 0.5, h * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawFeverAura(ctx, cx, footY) {
    const h = this.getCurrentHeight();
    const cy = footY - h * 0.55;
    const pulse = 0.78 + Math.sin(this.animTime * 0.28) * 0.22;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, h * 0.98 * pulse);
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.34)');
    grad.addColorStop(0.55, 'rgba(244, 63, 126, 0.16)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.98 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Caixa de colisão usada para obstáculos (mais estreita que o sprite). */
  getHitbox() {
    const h = this.getCurrentHeight();
    return {
      x: this.x + this.width * 0.20,
      y: this.y + h * 0.08,
      w: this.width * 0.60,
      h: h * 0.88
    };
  }
}

window.Player = Player;
window.PHYS = PHYS;
window.SPORTS = SPORTS;
window.STAGES = STAGES;
