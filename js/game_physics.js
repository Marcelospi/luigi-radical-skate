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

class Player {
  constructor() {
    this.reset();
  }

  reset(world) {
    this.x = PHYS.HOME_X;
    this.vy = 0;

    this.speed = PHYS.BASE_SPEED;
    this.maxSpeed = PHYS.MAX_SPEED;
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
    this.rampProgress = 0;
    this.currentRamp = null;
    this.rampBoostBuffered = false;
    this.surfaceType = 'asphalt';
    this.coyoteTimer = PHYS.COYOTE_STEPS;
    this.jumpBuffer = 0;
    this.jumpHeld = false;
    this.spaceAirArmed = false;
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

    // Progresso & Fases
    this.lives = 5;
    this.maxLives = 5;
    this.currentStageIndex = 0;
    this.score = 0;
    this.distance = 0;
    this.coins = 0;
    this.invincibleTimer = 0;
    this.turboTimer = 0;
    this.turboDuration = 1;
    this.hasShield = false;
    this.isGameOver = false;
    this.deathReason = '';

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
  }

  emitEvent(type, data = {}) {
    this.frameEvents.push({
      type,
      intensity: data.intensity !== undefined ? data.intensity : 1,
      boosted: !!data.boosted,
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

  update(world, keys) {
    if (this.isGameOver) return;
    this.frameEvents.length = 0;

    // Trocar de personagem no meio da partida não pode empurrar os pés
    const feet = this.bottom;
    this.applyCharacterDimensions();
    this.setBottom(feet);

    this.updateTimers();
    this.updateSpeed(keys);
    this.speedNormalized = this.speed / this.maxSpeed;

    this.distance += this.speed * 0.1;
    this.score += Math.max(1, Math.floor(this.speed * 0.05));

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

    if (window.soundSystem) {
      if (window.soundSystem.updateRoll) {
        window.soundSystem.updateRoll(this.onGround && !this.isGrinding && !this.isOnRamp, this.speedNormalized, this.surfaceType);
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

    // Queda no abismo: resgate seguro se tiver vidas restantes!
    if (this.y > world.deathY) {
      if (this.lives > 1) {
        this.lives--;
        this.invincibleTimer = 140;
        this.hasShield = true;
        this.vy = 0;
        this.isGrinding = false;
        this.grindIntensity = 0;
        this.currentRail = null;
        this.grindTicks = 0;
        this.isOnRamp = false;
        this.rampProgress = 0;
        this.currentRamp = null;
        this.rampBoostBuffered = false;
        this.isFastFalling = false;
        this.trickState = null;
        this.trickProgress = 0;
        this.tricksInAir = [];
        this.comboMultiplier = 1;
        this.comboPoints = 0;
        this.rotation = 0;

        // Prefere um trecho que já passe pela posição normal de corrida.
        // Sem isso o resgate podia largar o jogador mais à direita e ele
        // ficava ali pelo resto da partida, com menos tempo de reação.
        const casa = PHYS.HOME_X;
        const cobreCasa = world.platforms.find(p =>
          world.isPlatformSolid(p) && p.x <= casa && p.x + p.width >= casa + this.width);

        const safe = cobreCasa
          || world.platforms.find(p => p.x + p.width > 200 && world.isPlatformSolid(p))
          || world.platforms[0];

        if (safe) {
          this.x = cobreCasa ? casa : Math.max(casa, safe.x + 60);
          this.setBottom(world.platformTop(safe));
        } else {
          this.x = casa;
          this.setBottom(world.groundY);
        }
        this.onGround = true;
        this.groundBelowY = this.bottom;
        this.airHeight = 0;
        this.emitEvent('rescue', { intensity: 1, y: this.bottom });

        if (window.soundSystem && window.soundSystem.playRescue) window.soundSystem.playRescue();
        if (window.particleSystem && window.particleSystem.emitSparks) {
          window.particleSystem.emitSparks(this.x + this.width * 0.5, this.bottom, 28, '#fbbf24');
        }
        if (window.particleSystem && window.particleSystem.addFloatingText) {
          window.particleSystem.addFloatingText('RESGATE RADICAL! -1 SKATE', this.x + this.width * 0.5, this.y - 60, '#fbbf24', 24);
        }
        if (window.game) {
          window.game.camera.shake(10);
          window.game.flash('power');
        }
      } else {
        this.takeDamage('Caiu no abismo', true);
      }
    }
  }

  /**
   * Volta devagar para a posição normal de corrida.
   *
   * Quando o resgate cai num buraco largo não existe chão sobre a posição
   * de origem, então o jogador é colocado na próxima plataforma. Sem este
   * retorno ele ficaria ali pelo resto da partida, mais perto da borda da
   * tela e com menos tempo de reação.
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

      // Recompensa de fase: +1 vida e +1000 pontos!
      this.lives = Math.min(this.maxLives || 5, this.lives + 1);
      this.score += 1000;

      if (window.soundSystem && window.soundSystem.playStageClear) window.soundSystem.playStageClear();
      if (window.particleSystem && window.particleSystem.emitSparks) {
        window.particleSystem.emitSparks(this.x + this.width * 0.5, this.y, 40, '#22d3ee');
      }
      if (window.particleSystem && window.particleSystem.addFloatingText) {
        window.particleSystem.addFloatingText(`FASE ${this.currentStageIndex + 1}! +1 SKATE`, this.x + this.width * 0.5, this.y - 70, '#34d399', 28);
      }

      if (window.game && window.game.onStageUnlocked) {
        window.game.onStageUnlocked(stage);
      }
    }
  }

  updateTimers() {
    this.animTime++;
    if (this.invincibleTimer > 0) this.invincibleTimer--;
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
    this.isBraking = wantsBrake && !this.isAccelerating && this.turboTimer <= 0;

    if (this.turboTimer > 0) {
      this.turboTimer--;
      this.speed = this.maxSpeed * PHYS.TURBO_FACTOR;
      this.isPushing = false;
      this.pushPhase = 0;
      if (window.particleSystem && window.particleSystem.emitTurboTrail) {
        window.particleSystem.emitTurboTrail(this.x + 10, this.y + this.getCurrentHeight() * 0.55);
      }
    } else if (this.isAccelerating) {
      // Remada forte no skate! Aceleração com cadência rítmica e até 135% da velocidade máxima
      const fastMax = this.maxSpeed * 1.35;
      const pushingGround = this.onGround && !this.isGrinding && !this.isOnRamp && !this.isDucking;
      this.isPushing = pushingGround;
      let accel = 0.08;
      if (pushingGround) {
        const prevPhase = this.pushPhase;
        this.pushPhase = (this.pushPhase + 1 / 24) % 1;
        // Pico de impulso da remada no início do ciclo
        if (this.pushPhase < prevPhase || prevPhase === 0) {
          accel += 0.14;
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
      this.speed = Math.max(PHYS.BASE_SPEED, this.speed - PHYS.BRAKE_DECEL);
      if (this.onGround && !this.isGrinding && this.speed > PHYS.BASE_SPEED + 0.4 && Math.random() < 0.35) {
        if (window.particleSystem && window.particleSystem.emitSlideDust) {
          window.particleSystem.emitSlideDust(this.x + this.width * 0.3, this.bottom);
        } else if (window.particleSystem && window.particleSystem.emitWheelDust) {
          window.particleSystem.emitWheelDust(this.x + this.width * 0.3, this.bottom);
        }
      }
    } else {
      this.isPushing = false;
      this.pushPhase = 0;
      // Se estava acima da velocidade normal após soltar a seta, desacelera suavemente
      if (this.speed > this.maxSpeed) {
        this.speed = Math.max(this.maxSpeed, this.speed - 0.06);
      } else {
        this.speed = Math.min(this.maxSpeed, this.speed + PHYS.ACCELERATION);
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
    // Em grind, segurar Baixo/S permite soltar do corrimão para descer à pista
    if (this.isGrinding && wants) {
      this.endGrind();
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

    // Borda de descida OU toque curto capturado entre dois passos
    if ((pressed && !this.jumpHeld) || tapped) {
      this.jumpBuffer = PHYS.BUFFER_STEPS;
    }
    this.jumpHeld = pressed;

    // Subindo na rampa: apertar Pulo perto do topo arma Lip Boost sem cancelar a curva
    if (this.isOnRamp && this.currentRamp) {
      if (this.jumpBuffer > 0 && this.rampProgress >= 0.72) {
        this.rampBoostBuffered = true;
      }
      return;
    }

    // Coyote time + buffer: o salto sai mesmo com timing imperfeito
    const canJump = this.onGround || this.coyoteTimer > 0;
    if (this.jumpBuffer > 0 && canJump && !this.isDucking) {
      const fromGrind = this.isGrinding;
      const jumpVel = fromGrind ? PHYS.GRIND_JUMP_VEL : PHYS.JUMP_VELOCITY;
      const surf = this.surfaceType;
      this.jump(jumpVel, { keepCombo: fromGrind, jumpedWithSpace: heldSpace || tapSpace });
      this.jumpBuffer = 0;
      this.emitEvent('jump', { intensity: fromGrind ? 1.1 : 1, surfaceType: surf });
      if (window.soundSystem && window.soundSystem.playJump) window.soundSystem.playJump();
      if (window.particleSystem) {
        if (window.particleSystem.emitOlliePop) {
          window.particleSystem.emitOlliePop(this.x + this.width * 0.25, this.bottom);
        } else if (window.particleSystem.emitLandingDust) {
          window.particleSystem.emitLandingDust(this.x + this.width * 0.5, this.bottom, 8);
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

    // Só arma o SUPER FLIP com Space após soltar o Space usado para pular
    if (!this.spaceAirArmed && !(keys && Player.held(keys, 'Space'))) {
      this.spaceAirArmed = true;
    }

    // Salto de altura variável, com piso garantido.
    //
    // Sem o piso, um toque curto (o normal no celular) virava um pulinho que
    // não passava por cima de nada. Os primeiros passos de subida sempre
    // acontecem; segurar a tecla apenas estende o salto a partir daí.
    this.airSteps++;
    if (!this.jumpHeld && this.airSteps > PHYS.MIN_JUMP_STEPS && this.vy < PHYS.JUMP_CUT) {
      this.vy = PHYS.JUMP_CUT;
    }

    // Curva de gravidade com sensação de peso:
    // - Ápice suave (hang-time curto para encaixar manobras)
    // - Descida mais firme (+ fast-fall opcional ao segurar Baixo/S)
    let grav = PHYS.GRAVITY;
    if (Math.abs(this.vy) < PHYS.APEX_THRESHOLD && !this.isFastFalling) {
      grav = PHYS.APEX_GRAVITY;
    } else if (this.vy > 0) {
      grav = PHYS.FALL_GRAVITY;
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
    if (this.turboTimer > 0 || this.speed > this.maxSpeed * 0.8 || (this.trickState && this.trickState.style === 'super')) {
      this.trail.push({ x: this.x, y: this.y, rot: this.rotation, life: 1 });
      if (this.trail.length > 6) this.trail.shift();
    }
  }

  jump(velocity, opts = {}) {
    if (this.isGrinding) this.endGrind();
    this.isOnRamp = false;
    this.rampProgress = 0;
    this.currentRamp = null;
    this.rampBoostBuffered = false;
    this.vy = velocity;
    this.onGround = false;
    this.coyoteTimer = 0;
    this.isDucking = false;
    this.isFastFalling = false;
    if (!opts.keepCombo) {
      this.tricksInAir = [];
      this.comboMultiplier = 1;
      this.comboPoints = 0;
    }
    this.spaceAirArmed = !opts.jumpedWithSpace;
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
      this.setBottom(ramp.y);
    }

    const speedRatio = Math.max(0, Math.min(1.4, this.speed / this.maxSpeed));
    let launchVy = -(17.6 + speedRatio * 2.8);
    if (boosted) {
      launchVy -= 2.1;
      this.score += 250;
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

    for (const t of TRICKS) {
      if (this.tricksInAir.includes(t.name)) continue;

      if (t.key === 'Space') {
        // Exige soltar o Espaço do pulo e dar novo toque no ar
        if (!this.spaceAirArmed) continue;
        if (Player.tapped(keys, 'Space') || Player.held(keys, 'Space')) {
          this.spaceAirArmed = false;
          this.executeTrick(t);
          return;
        }
      } else if (Player.held(keys, t.key) || Player.tapped(keys, t.key)) {
        this.executeTrick(t);
        return;
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

    const points = t.pts * this.comboMultiplier;
    this.score += points;
    this.comboPoints += points;
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
      if (prevRamp && !prevRamp.used && this.rampProgress >= 0.65) {
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
      this.land(support, supportTop, world);
    } else {
      if (this.isGrinding) this.endGrind();
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
    this.currentRamp = ramp;
    this.rampProgress = sample.u;
    ramp.riderU = sample.u;

    this.setBottom(sample.y);
    this.vy = 0;
    this.onGround = true;
    this.isDucking = false;
    this.isFastFalling = false;
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

    this.setBottom(top);
    this.vy = 0;
    this.onGround = true;
    this.isGrinding = true;
    this.isDucking = false;
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
      this.lastTrickName = 'GRIND';
      this.trickState = null;
      this.trickProgress = 0;
      this.rotation = 0;

      this.emitEvent('grind_start', { intensity: this.grindIntensity, surfaceType: this.surfaceType, y: top });
      if (window.particleSystem && window.particleSystem.addFloatingText) {
        const combo = this.comboMultiplier > 1 ? ` x${this.comboMultiplier}` : '';
        window.particleSystem.addFloatingText(`GRIND!${combo}`, this.x + this.width * 0.5, this.y - 54, '#22d3ee', 24);
      }
    }

    this.grindTicks++;
    const pts = Math.max(2, Math.round(this.speed * 0.45 * this.comboMultiplier));
    this.score += pts;
    this.comboPoints += pts;

    // A cada ~0,5s de grind contínuo, aumenta o multiplicador
    if (this.grindTicks > 0 && this.grindTicks % 30 === 0) {
      this.comboMultiplier++;
      this.bestCombo = Math.max(this.bestCombo, this.comboMultiplier);
    }

    // Faíscas contínuas do grind
    if (window.particleSystem) {
      if (window.particleSystem.emitGrindSparks) {
        window.particleSystem.emitGrindSparks(this.x + this.width * 0.45, top, this.grindIntensity);
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
    this.airHeight = bestY === null ? Infinity : Math.max(0, bestY - footY);
  }

  land(platform, top, world) {
    const wasAirborne = !this.onGround;
    const impact = this.vy;
    const incompleteTrick = !!(this.trickState && this.trickProgress <= 0.78);

    this.setBottom(top);
    this.vy = 0;
    this.onGround = true;
    this.isFastFalling = false;
    this.coyoteTimer = PHYS.COYOTE_STEPS;
    this.airSteps = 0;
    this.surfaceType = this.detectSurfaceType(platform, world);

    if (wasAirborne) {
      const impactNorm = Math.max(0.08, Math.min(1, impact / PHYS.MAX_FALL));
      this.lastLandingImpact = impactNorm;
      this.landingImpact = impactNorm;

      // Compressão proporcional ao impacto + impulso na mola elástica
      const extraSquash = incompleteTrick ? 0.08 : 0;
      this.squash = Math.max(0.68, 1 - impact * 0.013 - extraSquash);
      this.squashVel = -impact * 0.0055;

      if (window.particleSystem && window.particleSystem.emitLandingDust) {
        window.particleSystem.emitLandingDust(this.x + this.width * 0.5, top, Math.min(18, 5 + impact));
      }

      if (this.tricksInAir.length > 0 && !incompleteTrick) {
        const bonus = this.tricksInAir.length * 300;
        this.score += bonus;
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
        this.speed = Math.max(PHYS.BASE_SPEED, this.speed - 0.5);
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
        window.soundSystem.playLand(impactNorm, this.surfaceType);
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

    // Rotação real das rodinhas e vibração da superfície
    this.wheelSpin += this.onGround ? this.speed * 0.22 : this.speed * 0.07;

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
    if (this.invincibleTimer > 0 || this.turboTimer > 0) return;

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
    this.lives -= instantDeath ? this.lives : 1;
    this.invincibleTimer = 100;
    this.deathReason = reason;
    this.comboMultiplier = 1;
    this.comboPoints = 0;
    this.emitEvent('damage', { intensity: 1 });

    if (window.soundSystem && window.soundSystem.playHit) window.soundSystem.playHit();
    if (window.particleSystem && window.particleSystem.emitSparks) {
      window.particleSystem.emitSparks(this.x + this.width * 0.5, this.y + 50, 26, '#f43f7e');
    }
    if (window.particleSystem && window.particleSystem.addFloatingText) {
      window.particleSystem.addFloatingText(reason, this.x + this.width * 0.5, this.y - 58, '#f43f7e', 24);
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

  draw(ctx) {
    const char = window.characterManager.getSelected();
    if (!char) return;

    const cm = window.characterManager;
    const pose = this.getPose();
    const sprite = cm.getSprite(char.id, pose);
    const prevSprite = (this.poseBlend < 1 && this.prevPose !== pose)
      ? cm.getSprite(char.id, this.prevPose)
      : null;

    const footY = this.bottom + this.bob;
    const centerX = this.x + this.width * 0.5;

    // Sombra de contato — ancora o personagem na superfície sólida real abaixo
    this.drawContactShadow(ctx, centerX, footY);

    // Contraluz integrada ao bioma atual
    this.drawBacklight(ctx, centerX, footY);

    // Rastro de velocidade / turbo / Super Flip
    for (const ghost of this.trail) {
      ctx.save();
      ctx.globalAlpha = ghost.life * 0.24;
      ctx.translate(ghost.x + this.width * 0.5, ghost.y + this.getCurrentHeight() * 0.5);
      ctx.rotate(ghost.rot);
      this.paintSprite(ctx, sprite, char, 0, this.getCurrentHeight() * 0.5, 1, 1);
      ctx.restore();
    }

    // Pisca durante a invencibilidade, mas nunca some por completo
    const blinking = this.invincibleTimer > 0 && Math.floor(this.invincibleTimer / 4) % 2 === 0;
    const baseAlpha = blinking ? 0.3 : 1;

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
    if (this.turboTimer > 0) this.drawTurboAura(ctx, centerX, footY);
  }

  /** Desenha o sprite com crossfade suave de 4-5 frames ao trocar de pose. */
  paintPoseCrossfade(ctx, sprite, prevSprite, char, offsetX, footOffsetY, scaleX, scaleY, lift, baseAlpha) {
    if (prevSprite && prevSprite !== sprite && this.poseBlend < 1) {
      ctx.globalAlpha = baseAlpha * (1 - this.poseBlend);
      this.paintSprite(ctx, prevSprite, char, offsetX, footOffsetY, scaleX, scaleY, lift * 0.5);
      ctx.globalAlpha = baseAlpha * this.poseBlend;
      this.paintSprite(ctx, sprite, char, offsetX, footOffsetY, scaleX, scaleY, lift);
      ctx.globalAlpha = baseAlpha;
    } else {
      this.paintSprite(ctx, sprite, char, offsetX, footOffsetY, scaleX, scaleY, lift);
    }
  }

  /**
   * Desenha o sprite ancorado nos pés, respeitando a proporção original.
   * Todas as poses usam a mesma escala em pixels (derivada do sprite de
   * skate), então o personagem nunca "estica" ou "encolhe" ao trocar de pose.
   */
  paintSprite(ctx, sprite, char, offsetX, footOffsetY, scaleX = 1, scaleY = 1, lift = 0) {
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

    ctx.drawImage(sprite, offsetX - w / 2, footOffsetY - h, w, h);

    // Clareia o sprite sem lavar as cores: uma segunda passada aditiva fraca
    if (lift > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = lift;
      ctx.drawImage(sprite, offsetX - w / 2, footOffsetY - h, w, h);
      ctx.restore();
    }
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
