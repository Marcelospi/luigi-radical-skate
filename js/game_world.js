// ============================================================
// Mundo: geração procedural da pista + direção de arte realista
//
// A geração trabalha em "blocos" (chunks) encadeados. Cada bloco sabe onde
// termina, então a pista nunca nasce com um buraco acidental — os vãos são
// sempre intencionais e dimensionados pela velocidade atual do jogador.
// ============================================================

const TRACK = {
  DEPTH: 320,          // espessura desenhada da pista/viaduto
  SURFACE: 104,        // faixa superior onde se anda (o resto é estrutura)
  EDGE: 6,             // coping / faixa superior
  MIN_LANDING: 430,    // largura mínima de plataforma após um vão
  WARMUP: 1700,        // trecho inicial sem nenhum perigo
  AHEAD: 2400          // quanto gerar à frente da tela
};

const PALETTE = {
  roadDeep:  '#080a14',
  edge:      '#22d3ee',
  edgeWarn:  '#fbbf24',
  danger:    '#f43f7e',
  gold:      '#fbbf24',
  green:     '#34d399'
};

const BIOMES = [
  {
    id: 'skatepark',
    name: 'Skatepark ao Pôr do Sol',
    minDist: 0,
    maxDist: 600,
    sky: ['#0b1026', '#1b2048', '#42275a', '#7c325e', '#c95657', '#f59e56'],
    orbColor: ['#fffbeb', '#fde047', '#f97316'],
    orbHalo: [251, 166, 60, 0.34],
    orbStyle: 'sunset',
    edgeColor: '#22d3ee',
    roadColor1: '#2f3554',
    roadColor2: '#20253d',
    roadColor3: '#14182a',
    hazeColor: [186, 82, 92, 0.36],
    ambientColor: '#fb923c',
    rimColor: '#fdba74',
    starAlpha: 0.42,
    cloudColor: [58, 28, 66, 0.34],
    cloudRim: [253, 186, 116, 0.38]
  },
  {
    id: 'metropolis',
    name: 'Metrópole Cyberpunk Neon',
    minDist: 600,
    maxDist: 1400,
    sky: ['#02030c', '#09071f', '#140a33', '#2a0b4a', '#4c0f57', '#7e184b'],
    orbColor: ['#f8fafc', '#f472b6', '#9333ea'],
    orbHalo: [244, 63, 126, 0.38],
    orbStyle: 'neonMoon',
    edgeColor: '#f43f7e',
    roadColor1: '#241430',
    roadColor2: '#180c24',
    roadColor3: '#0f0618',
    hazeColor: [148, 28, 86, 0.42],
    ambientColor: '#f43f7e',
    rimColor: '#38bdf8',
    starAlpha: 0.72,
    cloudColor: [24, 10, 44, 0.44],
    cloudRim: [244, 63, 126, 0.28]
  },
  {
    id: 'beach',
    name: 'Praia & Píer Tropical',
    minDist: 1400,
    maxDist: 2400,
    sky: ['#0369a1', '#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#fef08a'],
    orbColor: ['#ffffff', '#fef08a', '#facc15'],
    orbHalo: [253, 224, 71, 0.46],
    orbStyle: 'tropicalSun',
    edgeColor: '#fbbf24',
    roadColor1: '#854d27',
    roadColor2: '#5c3317',
    roadColor3: '#361c0b',
    hazeColor: [125, 211, 252, 0.34],
    ambientColor: '#38bdf8',
    rimColor: '#fef08a',
    starAlpha: 0.0,
    cloudColor: [255, 255, 255, 0.46],
    cloudRim: [254, 249, 195, 0.55]
  },
  {
    id: 'cosmic',
    name: 'Pista Cósmica das Estrelas',
    minDist: 2400,
    maxDist: Infinity,
    sky: ['#000105', '#050417', '#10092b', '#220e47', '#3b0c6b', '#5b1e8c'],
    orbColor: ['#f5f3ff', '#c084fc', '#6d28d9'],
    orbHalo: [168, 85, 247, 0.46],
    orbStyle: 'ringedPlanet',
    edgeColor: '#a855f7',
    roadColor1: '#2e1065',
    roadColor2: '#1f0b47',
    roadColor3: '#110529',
    hazeColor: [124, 58, 237, 0.42],
    ambientColor: '#a855f7',
    rimColor: '#e879f9',
    starAlpha: 1.0,
    cloudColor: [76, 29, 149, 0.24],
    cloudRim: [192, 132, 252, 0.30]
  }
];

const BIOME_TRANSITION_DIST = 140;

// ---- Utilitários leves de cor para interpolação suave ----------------------

function parseHex(hex) {
  const v = hex.charCodeAt(0) === 35 ? hex.slice(1) : hex;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lerpHex(hexA, hexB, t) {
  if (t <= 0.001) return hexA;
  if (t >= 0.999) return hexB;
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function lerpRgba(arrA, arrB, t) {
  const r = Math.round(arrA[0] + (arrB[0] - arrA[0]) * t);
  const g = Math.round(arrA[1] + (arrB[1] - arrA[1]) * t);
  const b = Math.round(arrA[2] + (arrB[2] - arrA[2]) * t);
  const a = (arrA[3] + (arrB[3] - arrA[3]) * t).toFixed(3);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function smoothstep(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

class GameWorld {
  constructor() {
    this.layers = null;
    this.patterns = {};
    this.playerDistance = 0;
    this._playerTurbo = false;
    this._ambientMotes = this._createAmbientPool(56);
    this._meteors = [];
    this.reset();
  }

  _createAmbientPool(count) {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: Math.random() * 1400,
        y: Math.random() * 620,
        vx: -(Math.random() * 1.5 + 0.5),
        vy: Math.random() * 0.6 - 0.3,
        size: Math.random() * 2.2 + 0.9,
        alpha: Math.random() * 0.55 + 0.25,
        phase: Math.random() * Math.PI * 2
      });
    }
    return arr;
  }

  getBiome(dist) {
    const d = dist !== undefined ? dist : this.playerDistance;
    for (let i = BIOMES.length - 1; i >= 0; i--) {
      if (d >= BIOMES[i].minDist) return BIOMES[i];
    }
    return BIOMES[0];
  }

  /**
   * Retorna informações de transição suave entre biomas e iluminação ambiente.
   * Contrato compartilhado com física/personagem/HUD.
   */
  getBiomeBlend(dist) {
    const d = dist !== undefined ? dist : this.playerDistance;
    let idx = 0;
    for (let i = BIOMES.length - 1; i >= 0; i--) {
      if (d >= BIOMES[i].minDist) {
        idx = i;
        break;
      }
    }
    const current = BIOMES[idx];
    const next = BIOMES[Math.min(BIOMES.length - 1, idx + 1)];

    let t = 0;
    if (current !== next && isFinite(current.maxDist)) {
      const startBlend = current.maxDist - BIOME_TRANSITION_DIST;
      if (d > startBlend) {
        t = smoothstep((d - startBlend) / BIOME_TRANSITION_DIST);
      }
    }

    return {
      current,
      next,
      t,
      ambientColor: lerpHex(current.ambientColor, next.ambientColor, t),
      rimColor: lerpHex(current.rimColor, next.rimColor, t),
      sunDir: { x: 0.72, y: -0.69 }
    };
  }

  /**
   * Identifica o tipo de superfície sob a coordenada X (para áudio e partículas).
   * Contrato compartilhado: 'asphalt' | 'wood' | 'metal' | 'cosmic' | 'breakable'.
   */
  getSurfaceAt(x) {
    for (const p of this.platforms) {
      if (x >= p.x && x <= p.x + p.width && this.isPlatformSolid(p)) {
        if (p.isBreakable) return 'breakable';
        const biomeId = this.getBiome().id;
        if (biomeId === 'beach') return 'wood';
        if (biomeId === 'cosmic') return 'cosmic';
        return 'asphalt';
      }
    }
    return 'asphalt';
  }

  reset() {
    this.groundY = 520;
    this.deathY = 860;

    this.platforms = [];
    this.ramps = [];
    this.rails = [];
    this.obstacles = [];
    this.collectibles = [];

    this.scroll = 0;
    this.time = 0;
    this.lastChunk = 'flat';
    this.playerDistance = 0;
    this._playerTurbo = false;
    this._meteors = [];

    if (!this.layers && typeof document !== 'undefined') {
      this.buildLayers();
    }

    // Pista inicial: longa, plana e limpa
    this.platforms.push(this.makePlatform(-400, TRACK.WARMUP + 400));
  }

  // ==========================================================
  // Estrutura da pista
  // ==========================================================

  makePlatform(x, width, opts = {}) {
    return {
      x,
      width,
      y: this.groundY,
      height: TRACK.DEPTH,
      isBreakable: !!opts.breakable,
      spawnSpeed: opts.speed || 0,
      triggered: false,
      shakeTimer: 26,
      shakeOffset: 0,
      fallY: 0,
      fallSpeed: 0,
      crackSeed: Math.random() * 1000,
      triggerFall() {
        if (this.triggered) return;
        this.triggered = true;
        if (window.soundSystem) window.soundSystem.playPavementCrumble();
        if (window.particleSystem) {
          window.particleSystem.addFloatingText(
            'PULE!', this.x + this.width * 0.5, this.y - 46, PALETTE.danger, 26
          );
          if (window.particleSystem.emitShockwave) {
            window.particleSystem.emitShockwave(this.x + this.width * 0.5, this.y, PALETTE.danger, 56);
          }
        }
        if (window.game) window.game.camera.shake(5);
      }
    };
  }

  /** Um trecho só sustenta o jogador enquanto não tiver desabado. */
  isPlatformSolid(platform) {
    return !(platform.isFalling && platform.fallY > 24);
  }

  platformTop(platform) {
    return platform.y + (platform.fallY || 0);
  }

  /**
   * Curva matemática única da rampa (compartilhada entre desenho e física).
   * Parábola y(u) = baseY - h * u^2, idêntica a quadraticCurveTo(x + w*0.5, baseY, x + w, y).
   */
  getRampSurface(ramp, worldX) {
    const w = ramp.width || 176;
    const h = ramp.height || 66;
    const u = Math.max(0, Math.min(1, (worldX - ramp.x) / w));
    const baseY = ramp.y + h;
    const y = baseY - h * u * u;
    const angle = Math.atan2(-2 * h * u, w);
    return { y, angle, u, onLip: u >= 0.78 };
  }

  getRampSurfaceY(ramp, worldX) {
    return this.getRampSurface(ramp, worldX).y;
  }

  getRampAngle(ramp, worldX) {
    return this.getRampSurface(ramp, worldX).angle;
  }

  /** Fim da pista gerada até agora (em coordenadas de mundo). */
  get trackEnd() {
    let end = -Infinity;
    for (const p of this.platforms) end = Math.max(end, p.x + p.width);
    return end === -Infinity ? 0 : end;
  }

  // ==========================================================
  // Simulação
  // ==========================================================

  update(player) {
    const speed = player.speed;
    this.scroll += speed;
    this.time++;
    this.playerDistance = player.distance || 0;
    this._playerTurbo = (player.turboTimer || 0) > 0;

    this.updatePlatforms(speed);
    this.updateRamps(speed);
    this.updateRails(speed);
    this.updateObstacles(speed, player);
    this.updateCollectibles(speed, player);
    this.updateAmbient(speed);
    this.generate(player);
  }

  updatePlatforms(speed) {
    for (let i = this.platforms.length - 1; i >= 0; i--) {
      const p = this.platforms[i];
      p.x -= speed;

      if (p.isBreakable && p.triggered) {
        if (p.shakeTimer > 0) {
          p.shakeTimer--;
          p.shakeOffset = (Math.random() * 7 - 3.5) * (p.shakeTimer / 26);
          if (p.shakeTimer === 0 && window.particleSystem) {
            window.particleSystem.emitRoadDebris(p.x, p.y, p.width, 26);
          }
        } else {
          p.shakeOffset = 0;
          p.isFalling = true;
          p.fallSpeed = (p.fallSpeed || 1.5) + 0.75;
          p.fallY += p.fallSpeed;
          p.fallTilt = (p.fallTilt || 0) + 0.006;
          if (Math.random() < 0.3 && window.particleSystem) {
            window.particleSystem.emitRoadDebris(p.x, p.y + p.fallY, p.width, 24);
          }
        }
      }

      if (p.x + p.width < -420 || p.fallY > 900) this.platforms.splice(i, 1);
    }
  }

  updateRamps(speed) {
    for (let i = this.ramps.length - 1; i >= 0; i--) {
      const r = this.ramps[i];
      r.x -= speed;
      if (r.usedAnim > 0) {
        r.usedAnim = r.usedAnim > 1
          ? Math.max(0, r.usedAnim - 1)
          : Math.max(0, r.usedAnim - 0.055);
      }

      if (r.x + r.width < -260) this.ramps.splice(i, 1);
    }
  }

  updateRails(speed) {
    for (let i = this.rails.length - 1; i >= 0; i--) {
      const rail = this.rails[i];
      rail.x -= speed;
      rail.glowPhase = (rail.glowPhase || 0) + 0.08;
      if (rail.x + rail.width < -280) this.rails.splice(i, 1);
    }
  }

  updateObstacles(speed, player) {
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.x -= speed;

      if (!o.hit && this.hitsObstacle(player, o)) {
        o.hit = true;
        player.takeDamage(o.damageReason);
      }

      if (o.x + o.width < -260) this.obstacles.splice(i, 1);
    }
  }

  updateCollectibles(speed, player) {
    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const c = this.collectibles[i];
      c.x -= speed;
      c.anim = (c.anim || 0) + 0.075;

      if (!c.collected && this.hitsCollectible(player, c)) {
        c.collected = true;
        this.collect(player, c);
        this.collectibles.splice(i, 1);
        continue;
      }

      if (c.x + c.size < -140) this.collectibles.splice(i, 1);
    }
  }

  updateAmbient(speed) {
    const biome = this.getBiome().id;

    // Estrelas cadentes ocasionais no bioma cósmico
    if (biome === 'cosmic') {
      if (this._meteors.length < 2 && Math.random() < 0.015) {
        this._meteors.push({
          x: 420 + Math.random() * 960,
          y: 24 + Math.random() * 190,
          vx: -(12 + Math.random() * 8),
          vy: 4 + Math.random() * 3.5,
          life: 1
        });
      }
    }
    for (let i = this._meteors.length - 1; i >= 0; i--) {
      const m = this._meteors[i];
      m.x += m.vx;
      m.y += m.vy;
      m.life -= 0.032;
      if (m.life <= 0) this._meteors.splice(i, 1);
    }

    // Pool fixo de partículas climáticas (zero alocação por quadro)
    for (let i = 0; i < this._ambientMotes.length; i++) {
      const m = this._ambientMotes[i];
      if (biome === 'metropolis') {
        // Chuva fina diagonal na metrópole neon
        m.x -= 5.5 + speed * 0.45;
        m.y += 14 + (i % 5) * 1.4;
        if (m.y > this.groundY + 6) {
          m.y = -20 - Math.random() * 140;
          m.x = Math.random() * 1550;
        }
        if (m.x < -40) m.x = 1360 + Math.random() * 140;
      } else {
        m.phase += 0.03;
        m.x += m.vx - speed * 0.16;
        m.y += m.vy + Math.sin(m.phase) * 0.25;
        if (m.x < -30) {
          m.x = 1320 + Math.random() * 120;
          m.y = 40 + Math.random() * (this.groundY - 60);
        }
        if (m.y < 10) m.y = this.groundY - 40;
        if (m.y > this.groundY + 10) m.y = 30;
      }
    }
  }

  hitsObstacle(player, obs) {
    const p = player.getHitbox();
    const ox = obs.x + 6, oy = obs.y + 5;
    const ow = obs.width - 12, oh = obs.height - 10;
    return p.x < ox + ow && p.x + p.w > ox && p.y < oy + oh && p.y + p.h > oy;
  }

  hitsCollectible(player, item) {
    const p = player.getHitbox();
    const cx = p.x + p.w * 0.5;
    const cy = p.y + p.h * 0.5;
    const dx = Math.abs(cx - item.x) - p.w * 0.5;
    const dy = Math.abs(cy - item.y) - p.h * 0.5;
    const r = item.size * 0.6;
    return dx < r && dy < r;
  }

  collect(player, item) {
    if (item.type === 'coin') {
      player.coins++;
      player.score += 50;
      if (window.soundSystem) window.soundSystem.playCoin();
      if (window.particleSystem) {
        window.particleSystem.emitSparks(item.x, item.y, 10, PALETTE.gold);
        window.particleSystem.emitSparkle(item.x, item.y);
      }
    } else if (item.type === 'turbo') {
      player.turboTimer = 320;
      player.turboDuration = 320;
      player.score += 200;
      if (window.soundSystem) window.soundSystem.playPowerup();
      if (window.particleSystem) {
        window.particleSystem.emitSparks(item.x, item.y, 26, PALETTE.edge);
        if (window.particleSystem.emitShockwave) {
          window.particleSystem.emitShockwave(item.x, item.y, PALETTE.edge, 84);
        }
        if (window.particleSystem.emitSpeedBurst) {
          window.particleSystem.emitSpeedBurst(item.x, item.y, PALETTE.edge);
        }
        window.particleSystem.addFloatingText('SUPER TURBO', item.x, item.y - 24, PALETTE.edge, 26);
      }
      if (window.game) window.game.flash('power');
    } else if (item.type === 'shield') {
      player.hasShield = true;
      player.score += 150;
      if (window.soundSystem) window.soundSystem.playPowerup();
      if (window.particleSystem) {
        window.particleSystem.emitSparks(item.x, item.y, 20, PALETTE.green);
        if (window.particleSystem.emitShockwave) {
          window.particleSystem.emitShockwave(item.x, item.y, PALETTE.green, 74);
        }
        window.particleSystem.addFloatingText('ESCUDO', item.x, item.y - 24, PALETTE.green, 24);
      }
    }
  }

  // ==========================================================
  // Geração procedural
  // ==========================================================

  generate(player) {
    let guard = 0;
    while (this.trackEnd < TRACK.AHEAD && guard++ < 8) {
      this.spawnChunk(player);
    }
  }

  /**
   * Largura de vão que o jogador consegue vencer com o salto normal.
   * Usa no máximo ~42% do alcance real, então sempre sobra margem.
   */
  jumpableGap(speed) {
    const airSteps = (2 * Math.abs(window.PHYS.JUMP_VELOCITY)) / window.PHYS.GRAVITY;
    const reach = airSteps * speed;
    return Math.round(Math.max(95, Math.min(235, reach * 0.42)));
  }

  pickChunkType(player) {
    const d = player.distance;
    // FASE 1: 0m a 600m - 100% PISTA CONTÍNUA E SEGURA!
    if (d < 600) {
      const r = Math.random();
      if (r < 0.30) return 'ramp';
      if (r < 0.56) return 'rail';
      return 'flat';
    }

    // A partir da Fase 2 (600m+):
    if (this.lastChunk === 'breakable' || this.lastChunk === 'gap') {
      const r = Math.random();
      if (r < 0.38) return 'ramp';
      if (r < 0.68) return 'rail';
      return 'flat';
    }

    const hazard = Math.min(0.44, 0.16 + (d - 600) / 9000);
    const r = Math.random();

    if (r < hazard * 0.50) return 'breakable';
    if (r < hazard) return 'gap';
    if (r < hazard + 0.24) return 'ramp';
    if (r < hazard + 0.46) return 'rail';
    return 'flat';
  }

  spawnChunk(player) {
    const startX = Math.max(this.trackEnd, 900);
    const type = this.pickChunkType(player);
    this.lastChunk = type;

    switch (type) {
      case 'breakable': this.chunkBreakable(startX, player); break;
      case 'gap':       this.chunkGap(startX, player);       break;
      case 'ramp':      this.chunkRamp(startX, player);      break;
      case 'rail':      this.chunkRail(startX, player);      break;
      default:          this.chunkFlat(startX, player);      break;
    }
  }

  // ---- Bloco plano com obstáculo ----
  chunkFlat(x, player) {
    const width = 820 + Math.random() * 380;
    this.platforms.push(this.makePlatform(x, width));

    const obsX = x + 340 + Math.random() * 140;

    if (Math.random() < 0.5) {
      this.obstacles.push({
        type: 'crate',
        x: obsX, y: this.groundY - 58,
        width: 54, height: 58,
        damageReason: 'Bateu na caixa',
        hit: false
      });
      this.collectibles.push({ type: 'coin', x: obsX + 27, y: this.groundY - 124, size: 28, collected: false });
    } else {
      this.obstacles.push({
        type: 'sign',
        x: obsX, y: this.groundY - 150,
        width: 78, height: 62,
        damageReason: 'Bateu na placa',
        hit: false
      });
      for (let i = 0; i < 3; i++) {
        this.collectibles.push({
          type: 'coin', x: obsX + 16 + i * 34, y: this.groundY - 44, size: 24, collected: false
        });
      }
    }

    if (Math.random() < 0.22 && !player.hasShield) {
      this.collectibles.push({ type: 'shield', x: x + width - 220, y: this.groundY - 62, size: 38, collected: false });
    }
  }

  // ---- Bloco com corrimão de grind (seguro e bem espaçado) ----
  chunkRail(x, player) {
    const railWidth = Math.round(250 + Math.random() * 130);
    const width = railWidth + 580 + Math.random() * 160;
    this.platforms.push(this.makePlatform(x, width));

    const railX = x + 260;
    const railY = this.groundY - 68;
    const surfaceType = this.getBiome().id === 'beach' ? 'wood' : 'metal';

    this.rails.push({
      x: railX,
      y: railY,
      width: railWidth,
      height: 14,
      surfaceType,
      glowPhase: Math.random() * Math.PI * 2
    });

    // Trilha de moedas sobre o corrimão convidando para o grind
    const coinCount = Math.max(4, Math.floor(railWidth / 64));
    for (let i = 0; i < coinCount; i++) {
      const t = coinCount === 1 ? 0.5 : i / (coinCount - 1);
      this.collectibles.push({
        type: 'coin',
        x: railX + 28 + t * (railWidth - 56),
        y: railY - 36,
        size: 26,
        collected: false
      });
    }

    if (Math.random() < 0.25 && !player.hasShield) {
      this.collectibles.push({
        type: 'shield',
        x: railX + railWidth + 140,
        y: this.groundY - 64,
        size: 38,
        collected: false
      });
    }
  }

  // ---- Bloco com rampa de mega salto ----
  chunkRamp(x, player) {
    const rampW = 176;
    const rampH = 66;
    const width = 920 + Math.random() * 280;
    this.platforms.push(this.makePlatform(x, width));

    const rampX = x + 280;
    this.ramps.push({
      x: rampX,
      y: this.groundY - rampH,
      width: rampW,
      height: rampH,
      used: false,
      usedAnim: 0,
      riderU: 0
    });

    // Arco de moedas saindo exatamente do lip (topo) da rampa
    const lipX = rampX + rampW;
    this.spawnJumpArc(lipX + 24, this.groundY - 165, 7, 340, player.speed);

    if (Math.random() < 0.45) {
      this.collectibles.push({
        type: 'turbo', x: lipX + 250, y: this.groundY - 315, size: 40, collected: false
      });
    }
  }

  // ---- Bloco com vão para saltar ----
  chunkGap(x, player) {
    const gap = this.jumpableGap(player.speed);
    const landing = TRACK.MIN_LANDING + Math.random() * 260;

    this.platforms.push(this.makePlatform(x + gap, landing));
    this.spawnJumpArc(x + 20, this.groundY - 110, 5, gap + 40, player.speed);
  }

  // ---- Bloco com pista quebradiça ----
  chunkBreakable(x, player) {
    const runway = 200;

    const airSteps = (2 * Math.abs(window.PHYS.JUMP_VELOCITY)) / window.PHYS.GRAVITY;
    const reach = airSteps * player.speed;
    const breakWidth = Math.round(Math.max(180, Math.min(420, reach * (0.62 + Math.random() * 0.14))));

    this.platforms.push(this.makePlatform(x, runway));
    this.platforms.push(this.makePlatform(x + runway, breakWidth, { breakable: true, speed: player.speed }));
    this.platforms.push(this.makePlatform(x + runway + breakWidth, TRACK.MIN_LANDING + Math.random() * 220));

    this.spawnJumpArc(x + runway + 30, this.groundY - 120, 5, breakWidth - 40, player.speed);
  }

  /** Distribui moedas ao longo de uma parábola de salto. */
  spawnJumpArc(startX, baseY, count, span, speed) {
    const lift = Math.min(150, 70 + speed * 6);
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      this.collectibles.push({
        type: 'coin',
        x: startX + t * span,
        y: baseY - Math.sin(t * Math.PI) * lift,
        size: 28,
        collected: false
      });
    }
  }

  // ==========================================================
  // Camadas pré-renderizadas por bioma (feitas uma única vez)
  // ==========================================================

  buildLayers() {
    this.layers = {
      stars: this.renderStars(1400, 460),
      nebula: this.renderNebula(1400, 440),
      biomes: {
        skatepark: {
          far:   this.renderSunsetFar(1400, 340),
          mid:   this.renderSkateparkMid(1180, 410),
          props: this.renderSkateparkProps(820, 300)
        },
        metropolis: {
          far:   this.renderCyberCity(1400, 360, true),
          mid:   this.renderCyberCity(1140, 430, false),
          props: this.renderCyberProps(800, 300)
        },
        beach: {
          far:   this.renderBeachFar(1400, 290),
          mid:   this.renderBeachOcean(1100, 170),
          props: this.renderBeachProps(820, 310)
        },
        cosmic: {
          far:   this.renderCosmicFar(1400, 320),
          mid:   this.renderCosmicMid(1140, 380),
          props: this.renderCosmicProps(820, 290)
        }
      },
      textures: {
        asphalt: this.renderAsphaltTexture(256),
        wood:    this.renderWoodTexture(256),
        cosmic:  this.renderCosmicTexture(256)
      }
    };
  }

  makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  renderStars(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');

    for (let i = 0; i < 290; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const a = Math.random() * 0.62 + 0.14;
      const r = Math.random() * 1.2 + 0.3;
      const tint = i % 7 === 0 ? '254, 215, 170' : i % 5 === 0 ? '186, 230, 253' : '226, 232, 255';
      ctx.fillStyle = `rgba(${tint}, ${a * (1 - y / h)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < 16; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h * 0.72;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 10);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      g.addColorStop(0.35, 'rgba(180, 210, 255, 0.35)');
      g.addColorStop(1, 'rgba(160, 200, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 10, y - 10, 20, 20);
    }
    return c;
  }

  renderNebula(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const blobs = [
      [w * 0.18, h * 0.38, 250, '168, 85, 247', 0.22],
      [w * 0.48, h * 0.28, 290, '56, 189, 248', 0.16],
      [w * 0.76, h * 0.44, 260, '236, 72, 153', 0.20],
      [w * 0.92, h * 0.30, 200, '124, 58, 237', 0.18]
    ];
    for (const [bx, by, br, rgb, a] of blobs) {
      const g = ctx.createRadialGradient(bx, by, 10, bx, by, br);
      g.addColorStop(0, `rgba(${rgb}, ${a})`);
      g.addColorStop(0.55, `rgba(${rgb}, ${a * 0.35})`);
      g.addColorStop(1, `rgba(${rgb}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    return c;
  }

  // ---- Bioma 1: Skatepark ao Pôr do Sol ----

  renderSunsetFar(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');

    // Colinas distantes suaves
    ctx.fillStyle = '#241a3f';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 28) {
      const hill = Math.sin(x * 0.0045) * 44 + Math.sin(x * 0.011 + 1.4) * 22;
      ctx.lineTo(x, h - 135 - hill);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Silhueta urbana quente
    let x = 0;
    while (x < w) {
      const bw = 46 + Math.random() * 68;
      const bh = 86 + Math.random() * 140;
      const by = h - bh;
      ctx.fillStyle = '#1b1433';
      ctx.fillRect(x, by, bw, bh);

      // Luz de pôr do sol na borda esquerda dos prédios
      ctx.fillStyle = 'rgba(251, 146, 60, 0.16)';
      ctx.fillRect(x + bw - 3, by, 3, bh);

      // Janelas douradas quentes
      for (let wy = by + 12; wy < h - 12; wy += 16) {
        for (let wx = x + 8; wx < x + bw - 8; wx += 12) {
          if (Math.random() < 0.56) continue;
          ctx.fillStyle = Math.random() < 0.85
            ? 'rgba(254, 215, 130, 0.30)'
            : 'rgba(125, 211, 252, 0.22)';
          ctx.fillRect(wx, wy, 4, 6);
        }
      }
      x += bw + 4;
    }
    return c;
  }

  renderSkateparkMid(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');

    let x = 0;
    while (x < w) {
      if (Math.random() < 0.36) {
        // Silhueta de half-pipe / bowl de skatepark ao fundo
        const sw = 180;
        const sh = 76;
        const by = h - sh;
        ctx.fillStyle = '#110d24';
        ctx.beginPath();
        ctx.moveTo(x, h);
        ctx.lineTo(x, by);
        ctx.quadraticCurveTo(x + sw * 0.25, h - 18, x + sw * 0.5, h - 18);
        ctx.quadraticCurveTo(x + sw * 0.75, h - 18, x + sw, by);
        ctx.lineTo(x + sw, h);
        ctx.closePath();
        ctx.fill();

        // Refletor do skatepark
        ctx.strokeStyle = '#0d0a1c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x + 14, by);
        ctx.lineTo(x + 14, by - 120);
        ctx.stroke();
        const beam = ctx.createRadialGradient(x + 14, by - 120, 2, x + 14, by - 120, 48);
        beam.addColorStop(0, 'rgba(255, 240, 200, 0.55)');
        beam.addColorStop(1, 'rgba(255, 220, 150, 0)');
        ctx.fillStyle = beam;
        ctx.fillRect(x - 34, by - 168, 96, 96);

        x += sw + 18;
      } else {
        const bw = 72 + Math.random() * 98;
        const bh = 125 + Math.random() * 175;
        const by = h - bh;
        ctx.fillStyle = '#0f0c21';
        ctx.fillRect(x, by, bw, bh);

        // Borda iluminada pelo sol poente
        ctx.fillStyle = 'rgba(251, 146, 60, 0.14)';
        ctx.fillRect(x + bw - 3, by, 3, bh);

        for (let wy = by + 16; wy < h - 14; wy += 20) {
          for (let wx = x + 10; wx < x + bw - 12; wx += 15) {
            if (Math.random() < 0.52) continue;
            ctx.fillStyle = 'rgba(255, 212, 130, 0.34)';
            ctx.fillRect(wx, wy, 6, 9);
          }
        }
        x += bw + 10;
      }
    }
    return c;
  }

  renderSkateparkProps(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const ink = '#090716';

    // Palmeira detalhada
    this._drawPalmSilhouette(ctx, 100, h, 205, ink, 'rgba(251, 146, 60, 0.28)');

    // Poste de luz quente
    this._drawStreetLamp(ctx, 410, h, 224, ink, '255, 224, 160');

    // Alambrado de skatepark
    ctx.strokeStyle = 'rgba(18, 16, 36, 0.85)';
    ctx.lineWidth = 1.8;
    for (let fx = 550; fx < 790; fx += 14) {
      ctx.beginPath();
      ctx.moveTo(fx, h);
      ctx.lineTo(fx + 14, h - 78);
      ctx.moveTo(fx + 14, h);
      ctx.lineTo(fx, h - 78);
      ctx.stroke();
    }
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(546, h - 80);
    ctx.lineTo(794, h - 80);
    ctx.moveTo(550, h);
    ctx.lineTo(550, h - 82);
    ctx.moveTo(670, h);
    ctx.lineTo(670, h - 82);
    ctx.moveTo(790, h);
    ctx.lineTo(790, h - 82);
    ctx.stroke();

    return c;
  }

  // ---- Bioma 2: Metrópole Cyberpunk Neon ----

  renderCyberCity(w, h, far) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const body = far ? '#0d0924' : '#070516';
    const winA = far ? 'rgba(56, 189, 248, 0.24)' : 'rgba(56, 189, 248, 0.44)';
    const winB = far ? 'rgba(244, 63, 126, 0.24)' : 'rgba(244, 63, 126, 0.44)';

    let x = 0;
    while (x < w) {
      const bw = (far ? 56 : 82) + Math.random() * (far ? 78 : 118);
      const bh = (far ? 130 : 175) + Math.random() * (far ? 190 : 230);
      const by = h - bh;

      ctx.fillStyle = body;
      ctx.fillRect(x, by, bw, bh);

      // Topo em degrau + antena com luz vermelha/rosa
      if (Math.random() < 0.45) {
        const tw = bw * 0.46;
        ctx.fillRect(x + (bw - tw) * 0.5, by - 28, tw, 28);
        ctx.fillRect(x + bw * 0.5 - 1, by - 68, 2, 40);
        ctx.fillStyle = 'rgba(244, 63, 126, 0.85)';
        ctx.fillRect(x + bw * 0.5 - 2.5, by - 71, 5, 5);
        ctx.fillStyle = body;
      }

      // Feixes verticais de luz neon nos prédios altos
      if (Math.random() < 0.35) {
        const stripHue = Math.random() < 0.5 ? '34, 211, 238' : '244, 63, 126';
        ctx.fillStyle = `rgba(${stripHue}, ${far ? 0.35 : 0.65})`;
        ctx.fillRect(x + 3, by + 6, 2, bh - 12);
      }

      // Janelas
      const stepX = far ? 11 : 15;
      const stepY = far ? 15 : 19;
      for (let wy = by + 12; wy < h - 10; wy += stepY) {
        for (let wx = x + 8; wx < x + bw - 9; wx += stepX) {
          const roll = Math.random();
          if (roll < 0.44) continue;
          ctx.fillStyle = roll > 0.72 ? winB : winA;
          ctx.fillRect(wx, wy, far ? 4 : 6, far ? 6 : 8);
        }
      }

      // Letreiros holográficos neon na camada média
      if (!far && Math.random() < 0.42) {
        const sy = by + 34 + Math.random() * 90;
        const sw = bw * 0.55;
        const hue = Math.random() < 0.5 ? '244, 63, 126' : '34, 211, 238';
        const g = ctx.createRadialGradient(x + bw * 0.5, sy + 6, 2, x + bw * 0.5, sy + 6, 44);
        g.addColorStop(0, `rgba(${hue}, 0.52)`);
        g.addColorStop(1, `rgba(${hue}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x + bw * 0.5 - 44, sy - 38, 88, 88);
        ctx.fillStyle = `rgba(${hue}, 0.92)`;
        ctx.fillRect(x + (bw - sw) * 0.5, sy, sw, 5);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.fillRect(x + (bw - sw) * 0.5 + 4, sy + 1, sw - 8, 2);
      }

      ctx.fillStyle = body;
      x += bw + (far ? 4 : 8);
    }

    // Linha de monotrilho/viaduto ao fundo na camada média
    if (!far) {
      ctx.fillStyle = '#050311';
      ctx.fillRect(0, h - 54, w, 12);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.fillRect(0, h - 54, w, 2);
    }
    return c;
  }

  renderCyberProps(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const ink = '#050311';

    // Poste cyberpunk ciano
    this._drawStreetLamp(ctx, 180, h, 234, ink, '56, 189, 248');

    // Poste cyberpunk magenta
    this._drawStreetLamp(ctx, 560, h, 234, ink, '244, 63, 126');

    // Painel neon de rua
    ctx.fillStyle = ink;
    ctx.fillRect(360, h - 108, 72, 108);
    ctx.strokeStyle = 'rgba(244, 63, 126, 0.75)';
    ctx.lineWidth = 2;
    ctx.strokeRect(368, h - 98, 56, 48);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.65)';
    ctx.fillRect(376, h - 86, 40, 5);
    ctx.fillRect(376, h - 74, 28, 4);

    return c;
  }

  // ---- Bioma 3: Praia & Píer Tropical ----

  renderBeachFar(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');

    // Ilhas e morros costeiros em tons tropicais suaves
    ctx.fillStyle = 'rgba(14, 116, 144, 0.55)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 30) {
      const y = h - 72 - Math.max(0, Math.sin(x * 0.0052) * 58 + Math.sin(x * 0.013) * 20);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Farol costeiro distante
    const lx = w * 0.64;
    const ly = h - 115;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(lx - 8, ly + 42);
    ctx.lineTo(lx - 5, ly);
    ctx.lineTo(lx + 5, ly);
    ctx.lineTo(lx + 8, ly + 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(lx - 6, ly + 10, 12, 8);
    ctx.fillRect(lx - 7, ly + 26, 14, 8);
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(lx, ly - 3, 5, 0, Math.PI * 2);
    ctx.fill();

    return c;
  }

  renderBeachOcean(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.45, '#0369a1');
    grad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Linhas horizontais de ondas e brilho solar
    for (let i = 0; i < 42; i++) {
      const wx = Math.random() * w;
      const wy = 10 + Math.random() * (h - 24);
      const ww = 28 + Math.random() * 76;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(254, 249, 195, 0.35)' : 'rgba(186, 230, 253, 0.28)';
      ctx.fillRect(wx, wy, ww, 2.2);
    }
    return c;
  }

  renderBeachProps(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');

    // Coqueiro tropical exuberante
    this._drawPalmSilhouette(ctx, 130, h, 224, '#14532d', 'rgba(254, 240, 138, 0.35)', '#78350f');
    this._drawPalmSilhouette(ctx, 640, h, 186, '#166534', 'rgba(254, 240, 138, 0.32)', '#78350f');

    // Postes de madeira do píer com corda náutica e lanterna
    const posts = [320, 440, 560];
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(posts[0], h - 66);
    ctx.quadraticCurveTo((posts[0] + posts[1]) * 0.5, h - 42, posts[1], h - 66);
    ctx.quadraticCurveTo((posts[1] + posts[2]) * 0.5, h - 42, posts[2], h - 66);
    ctx.stroke();

    for (const px of posts) {
      ctx.fillStyle = '#451a03';
      ctx.fillRect(px - 7, h - 84, 14, 84);
      ctx.fillStyle = 'rgba(254, 240, 138, 0.22)';
      ctx.fillRect(px - 7, h - 84, 4, 84);
      // Lanterna no topo do poste do meio
      if (px === 440) {
        const g = ctx.createRadialGradient(px, h - 94, 2, px, h - 94, 28);
        g.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
        g.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(px - 28, h - 122, 56, 56);
      }
    }

    return c;
  }

  // ---- Bioma 4: Pista Cósmica ----

  renderCosmicFar(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#14082e';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 65) {
      const peak = 45 + ((x * 37) % 95);
      ctx.lineTo(x, h - peak);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Brilho violeta nas cristas
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.28)';
    ctx.lineWidth = 2;
    ctx.stroke();
    return c;
  }

  renderCosmicMid(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');

    // Arcos energéticos e cristais orbitais
    for (let x = 140; x < w; x += 320) {
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, h, 110, Math.PI, 0);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, h, 96, Math.PI, 0);
      ctx.stroke();
    }
    return c;
  }

  renderCosmicProps(w, h) {
    const c = this.makeCanvas(w, h);
    const ctx = c.getContext('2d');

    // Cristais energéticos translúcidos
    const crystals = [[140, 125, 26], [420, 160, 32], [690, 110, 22]];
    for (const [cx, ch, cw] of crystals) {
      const grad = ctx.createLinearGradient(cx, h - ch, cx, h);
      grad.addColorStop(0, 'rgba(216, 180, 254, 0.55)');
      grad.addColorStop(1, 'rgba(88, 28, 135, 0.88)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx, h - ch);
      ctx.lineTo(cx + cw * 0.5, h - ch * 0.72);
      ctx.lineTo(cx + cw * 0.35, h);
      ctx.lineTo(cx - cw * 0.35, h);
      ctx.lineTo(cx - cw * 0.5, h - ch * 0.72);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(240, 171, 252, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    return c;
  }

  // ---- Helpers de props reutilizáveis ----

  _drawPalmSilhouette(ctx, px, py, height, leafColor, rimColor, trunkColor) {
    const topX = px - 32;
    const topY = py - height;
    ctx.strokeStyle = trunkColor || leafColor;
    ctx.lineCap = 'round';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - 10, py - height * 0.55, topX, topY);
    ctx.stroke();

    // Rim light sutil no tronco
    if (rimColor) {
      ctx.strokeStyle = rimColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px + 4, py);
      ctx.quadraticCurveTo(px - 6, py - height * 0.55, topX + 3, topY);
      ctx.stroke();
    }

    // Copa com folhas em arco
    ctx.strokeStyle = leafColor;
    ctx.lineWidth = 6;
    const fronds = [
      [-68, -12], [-54, -44], [-14, -62], [32, -52],
      [66, -16], [42, 10], [-28, 8], [8, -28]
    ];
    for (const [fx, fy] of fronds) {
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + fx * 0.55, topY + fy - 22, topX + fx, topY + fy);
      ctx.stroke();
    }
  }

  _drawStreetLamp(ctx, lx, py, height, poleColor, lightRgb) {
    ctx.strokeStyle = poleColor;
    ctx.lineCap = 'round';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(lx, py);
    ctx.lineTo(lx, py - height + 18);
    ctx.quadraticCurveTo(lx, py - height, lx + 34, py - height);
    ctx.stroke();

    const cone = ctx.createLinearGradient(lx + 34, py - height + 4, lx + 34, py);
    cone.addColorStop(0, `rgba(${lightRgb}, 0.24)`);
    cone.addColorStop(1, `rgba(${lightRgb}, 0)`);
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(lx + 34, py - height + 4);
    ctx.lineTo(lx + 114, py);
    ctx.lineTo(lx - 42, py);
    ctx.closePath();
    ctx.fill();

    const bulb = ctx.createRadialGradient(lx + 34, py - height + 4, 1, lx + 34, py - height + 4, 28);
    bulb.addColorStop(0, `rgba(255, 255, 255, 0.95)`);
    bulb.addColorStop(0.35, `rgba(${lightRgb}, 0.65)`);
    bulb.addColorStop(1, `rgba(${lightRgb}, 0)`);
    ctx.fillStyle = bulb;
    ctx.fillRect(lx + 6, py - height - 24, 56, 56);
  }

  // ---- Texturas procedurais tileáveis (sincronizadas com a rolagem) ----

  renderAsphaltTexture(size) {
    const c = this.makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const r = Math.random();
      const v = r > 0.85 ? 230 : r > 0.5 ? 140 : 40;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = r < 0.62 ? 22 : 10;
    }
    ctx.putImageData(img, 0, 0);

    // Junta sutil de concretagem/asfalto
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(0, 0, 2, size);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(2, 0, 1, size);

    // Manchas sutis de rodinhas/desgaste horizontais
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.fillRect(0, 26, size, 8);
    ctx.fillRect(0, 62, size, 12);
    return c;
  }

  renderWoodTexture(size) {
    const c = this.makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const plankW = 32;

    for (let x = 0; x < size; x += plankW) {
      // Variação tonal sutil entre tábuas
      const shade = ((x / plankW) % 3) * 10 - 10;
      ctx.fillStyle = shade > 0 ? 'rgba(255, 220, 175, 0.08)' : 'rgba(0, 0, 0, 0.10)';
      ctx.fillRect(x, 0, plankW, size);

      // Veios verticais da madeira
      ctx.strokeStyle = 'rgba(30, 12, 4, 0.16)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 3; g++) {
        const gx = x + 6 + g * 8;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.bezierCurveTo(gx + 3, size * 0.33, gx - 3, size * 0.66, gx, size);
        ctx.stroke();
      }

      // Fresta entre tábuas + realce de borda
      ctx.fillStyle = 'rgba(15, 6, 2, 0.55)';
      ctx.fillRect(x, 0, 2, size);
      ctx.fillStyle = 'rgba(255, 224, 178, 0.10)';
      ctx.fillRect(x + 2, 0, 1, size);

      // Cabeças de pregos
      ctx.fillStyle = 'rgba(20, 10, 4, 0.55)';
      ctx.fillRect(x + 8, 12, 3, 3);
      ctx.fillRect(x + plankW - 10, 12, 3, 3);
      ctx.fillRect(x + 8, 76, 3, 3);
      ctx.fillRect(x + plankW - 10, 76, 3, 3);
    }
    return c;
  }

  renderCosmicTexture(size) {
    const c = this.makeCanvas(size, size);
    const ctx = c.getContext('2d');

    ctx.strokeStyle = 'rgba(192, 132, 252, 0.16)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= size; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 1.5);
    }
    return c;
  }

  _getPattern(ctx, key) {
    if (this.patterns[key] !== undefined) return this.patterns[key];
    if (!this.layers || !this.layers.textures || !this.layers.textures[key]) return null;
    this.patterns[key] = ctx.createPattern(this.layers.textures[key], 'repeat') || null;
    return this.patterns[key];
  }

  // ==========================================================
  // Desenho do Mundo
  // ==========================================================

  drawBackground(ctx, W, H, camY = 0) {
    const blend = this.getBiomeBlend();
    const { current, next, t } = blend;
    this.drawSky(ctx, W, H, camY, blend);

    if (!this.layers) return;
    const L = this.layers;
    const horizon = this.groundY - camY * 0.25;

    // Estrelas com fade-out suave na praia
    const starAlpha = current.starAlpha + (next.starAlpha - current.starAlpha) * t;
    if (starAlpha > 0.02) {
      this.tile(ctx, L.stars, this.scroll * 0.012, horizon - 470, W, starAlpha * 0.92);
    }

    // Nebulosa no bioma cósmico
    const cosmicWeight = current.id === 'cosmic' ? (1 - t) : next.id === 'cosmic' ? t : 0;
    if (cosmicWeight > 0.02) {
      this.tile(ctx, L.nebula, this.scroll * 0.018, horizon - 460, W, cosmicWeight * 0.9);
    }

    // Camada distante (com crossfade suave entre biomas)
    this._drawBiomeLayer(ctx, 'far', current.id, next.id, t, this.scroll * 0.055, horizon, W, 0.92, 6);

    // Névoa atmosférica separando as camadas
    const haze = ctx.createLinearGradient(0, horizon - 230, 0, horizon + 14);
    haze.addColorStop(0, 'rgba(0, 0, 0, 0)');
    haze.addColorStop(1, lerpRgba(current.hazeColor, next.hazeColor, t));
    ctx.fillStyle = haze;
    ctx.fillRect(0, horizon - 230, W, 244);

    // Camada média
    this._drawBiomeLayer(ctx, 'mid', current.id, next.id, t, this.scroll * 0.16, horizon, W, 1, 4);

    // Brilho especular animado sobre o oceano no bioma praia
    const beachWeight = current.id === 'beach' ? (1 - t) : next.id === 'beach' ? t : 0;
    if (beachWeight > 0.05) {
      this._drawOceanSunGlint(ctx, W, horizon, beachWeight);
    }

    // Objetos próximos de rua / píer / cristais
    this._drawBiomeLayer(ctx, 'props', current.id, next.id, t, this.scroll * 0.4, horizon, W, 1, 0);
  }

  _drawBiomeLayer(ctx, slot, currId, nextId, t, offset, horizon, W, baseAlpha, yPad) {
    const currCanvas = this.layers.biomes[currId] && this.layers.biomes[currId][slot];
    const nextCanvas = this.layers.biomes[nextId] && this.layers.biomes[nextId][slot];

    if (currCanvas && (1 - t) > 0.01) {
      this.tile(ctx, currCanvas, offset, horizon - currCanvas.height + yPad, W, baseAlpha * (1 - t));
    }
    if (nextCanvas && currId !== nextId && t > 0.01) {
      this.tile(ctx, nextCanvas, offset, horizon - nextCanvas.height + yPad, W, baseAlpha * t);
    }
  }

  _drawOceanSunGlint(ctx, W, horizon, alpha) {
    const sx = W * 0.78;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.45;
    for (let i = 0; i < 8; i++) {
      const y = horizon - 145 + i * 18;
      const sway = Math.sin(this.time * 0.05 + i * 1.1) * 14;
      const gw = 110 - i * 8;
      ctx.fillStyle = 'rgba(254, 249, 195, 0.55)';
      ctx.fillRect(sx - gw * 0.5 + sway, y, gw, 3);
    }
    ctx.restore();
  }

  drawSky(ctx, W, H, camY, blend) {
    const { current, next, t } = blend;
    const shift = camY * 0.2;
    const sky = ctx.createLinearGradient(0, shift - 60, 0, this.groundY + 40 - shift);
    const stops = [0.00, 0.32, 0.58, 0.78, 0.91, 1.00];
    for (let i = 0; i < stops.length; i++) {
      const cA = current.sky[i] || current.sky[current.sky.length - 1];
      const cB = next.sky[i] || next.sky[next.sky.length - 1];
      sky.addColorStop(stops[i], lerpHex(cA, cB, t));
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Estrelas cadentes no bioma cósmico
    if (this._meteors.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const m of this._meteors) {
        ctx.globalAlpha = Math.max(0, m.life);
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 3.5, m.y - m.vy * 3.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Astro principal do céu (com estilo dedicado por bioma)
    const sx = W * 0.78;
    const sy = this.groundY - 340 - camY * 0.22;
    const r = 62;

    // Raios crepusculares / halo atmosférico
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bloom = ctx.createRadialGradient(sx, sy, r * 0.45, sx, sy, r * 5.2);
    bloom.addColorStop(0, lerpRgba(current.orbHalo, next.orbHalo, t));
    bloom.addColorStop(0.42, 'rgba(255, 220, 180, 0.07)');
    bloom.addColorStop(1, 'rgba(150, 170, 255, 0)');
    ctx.fillStyle = bloom;
    ctx.fillRect(sx - r * 5.2, sy - r * 5.2, r * 10.4, r * 10.4);

    // Raios solares sutis no pôr do sol e praia
    if (current.orbStyle === 'sunset' || current.orbStyle === 'tropicalSun') {
      ctx.globalAlpha = 0.08 * (1 - t * 0.5);
      ctx.fillStyle = '#fef3c7';
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3 + this.time * 0.0008;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(ang) * 420, sy + Math.sin(ang) * 420);
        ctx.lineTo(sx + Math.cos(ang + 0.14) * 420, sy + Math.sin(ang + 0.14) * 420);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // Parte traseira do anel planetário (se cósmico)
    if (current.orbStyle === 'ringedPlanet' || (next.orbStyle === 'ringedPlanet' && t > 0.4)) {
      ctx.save();
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 2.25, r * 0.52, -0.26, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Disco do astro
    const disc = ctx.createLinearGradient(sx, sy - r, sx, sy + r);
    disc.addColorStop(0, lerpHex(current.orbColor[0], next.orbColor[0], t));
    disc.addColorStop(0.6, lerpHex(current.orbColor[1], next.orbColor[1], t));
    disc.addColorStop(1, lerpHex(current.orbColor[2], next.orbColor[2], t));
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Detalhes específicos do astro
    if (current.orbStyle === 'ringedPlanet') {
      // Faixas sutis do planeta + parte frontal do anel
      ctx.save();
      ctx.strokeStyle = '#e879f9';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 2.25, r * 0.52, -0.26, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    } else if (current.orbStyle === 'neonMoon') {
      ctx.fillStyle = 'rgba(140, 120, 180, 0.28)';
      const craters = [[-18, -14, 11], [14, 8, 8], [-6, 22, 6], [24, -20, 5]];
      for (const [cx, cy, cr] of craters) {
        ctx.beginPath();
        ctx.arc(sx + cx, sy + cy, cr, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (current.orbStyle === 'sunset') {
      // Faixas atmosféricas quentes cortando a base do sol poente
      ctx.fillStyle = 'rgba(201, 86, 87, 0.28)';
      ctx.fillRect(sx - r, sy + r * 0.35, r * 2, 4);
      ctx.fillRect(sx - r, sy + r * 0.58, r * 2, 5);
    }

    // Nuvens estilizadas com borda iluminada (rim light)
    ctx.save();
    const cloudFill = lerpRgba(current.cloudColor, next.cloudColor, t);
    const cloudRim = lerpRgba(current.cloudRim, next.cloudRim, t);
    for (let i = 0; i < 5; i++) {
      const cy = this.groundY - 265 + i * 36 - camY * 0.2;
      const off = ((this.scroll * (0.02 + i * 0.006)) % (W + 640)) - 320;
      const cx = W - off;
      const cw = 210 + i * 68;
      const ch = 10 + i * 2.5;

      // Borda iluminada
      ctx.fillStyle = cloudRim;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, cw * 0.96, ch, 0, 0, Math.PI * 2);
      ctx.fill();

      // Corpo da nuvem
      ctx.fillStyle = cloudFill;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 1, cw, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  tile(ctx, canvas, offset, y, W, alpha) {
    const w = canvas.width;
    let x = -(offset % w);
    if (x > 0) x -= w;
    ctx.save();
    if (alpha !== 1) ctx.globalAlpha = alpha;
    while (x < W) {
      ctx.drawImage(canvas, Math.round(x), Math.round(y));
      x += w;
    }
    ctx.restore();
  }

  drawTrack(ctx, W = 1280, H = 720) {
    // Fosso atrás da pista
    const pit = ctx.createLinearGradient(0, this.groundY - 10, 0, this.groundY + 260);
    pit.addColorStop(0, 'rgba(4, 5, 12, 0.55)');
    pit.addColorStop(0.28, 'rgba(3, 4, 10, 0.94)');
    pit.addColorStop(1, '#02030a');
    ctx.fillStyle = pit;
    ctx.fillRect(-40, this.groundY - 10, W + 80, H - this.groundY + 420);

    for (const p of this.platforms) {
      p.leftOpen = !this.platforms.some(o => o !== p && !o.isFalling &&
        o.x <= p.x - 1 && o.x + o.width >= p.x - 1);
      p.rightOpen = !this.platforms.some(o => o !== p && !o.isFalling &&
        o.x <= p.x + p.width + 1 && o.x + o.width >= p.x + p.width + 1);
    }

    const blend = this.getBiomeBlend();
    for (const p of this.platforms) this.drawPlatform(ctx, p, blend);
    for (const r of this.ramps) this.drawRamp(ctx, r);
    for (const rail of this.rails) this.drawRail(ctx, rail, blend);
    for (const o of this.obstacles) this.drawObstacle(ctx, o);
  }

  drawPlatform(ctx, p, blend) {
    const x = p.x + (p.shakeOffset || 0);
    const y = this.platformTop(p);
    const w = p.width;
    const warn = p.isBreakable;
    const { current, next, t } = blend;

    ctx.save();
    if (p.fallTilt) {
      ctx.translate(x + w * 0.5, y);
      ctx.rotate(p.fallTilt);
      ctx.translate(-(x + w * 0.5), -y);
    }

    const r1 = warn ? '#3a2630' : lerpHex(current.roadColor1, next.roadColor1, t);
    const r2 = warn ? '#2a1b22' : lerpHex(current.roadColor2, next.roadColor2, t);
    const r3 = warn ? '#1b1116' : lerpHex(current.roadColor3, next.roadColor3, t);

    // Superfície rolável
    const surface = ctx.createLinearGradient(0, y, 0, y + TRACK.SURFACE);
    surface.addColorStop(0, r1);
    surface.addColorStop(0.55, r2);
    surface.addColorStop(1, r3);
    ctx.fillStyle = surface;
    ctx.fillRect(x, y, w, TRACK.SURFACE);

    // Parede / estrutura inferior
    const wall = ctx.createLinearGradient(0, y + TRACK.SURFACE, 0, y + TRACK.DEPTH);
    wall.addColorStop(0, warn ? '#170f14' : r2);
    wall.addColorStop(0.45, r3);
    wall.addColorStop(1, PALETTE.roadDeep);
    ctx.fillStyle = wall;
    ctx.fillRect(x, y + TRACK.SURFACE, w, TRACK.DEPTH - TRACK.SURFACE);

    // Textura procedural sincronizada com o scroll da plataforma
    const texKey = current.id === 'beach' ? 'wood' : current.id === 'cosmic' ? 'cosmic' : 'asphalt';
    const pattern = this._getPattern(ctx, texKey);
    if (pattern) {
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.globalAlpha = texKey === 'wood' ? 0.85 : 0.65;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, w, TRACK.SURFACE);
      ctx.restore();
    }

    // Quina realista entre laje superior e parede inferior
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(x, y + TRACK.SURFACE, w, 1.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.52)';
    ctx.fillRect(x, y + TRACK.SURFACE + 1.5, w, 5);

    // Arquitetura da estrutura inferior (pilares/vigas/estacas)
    if (!warn) {
      this.drawUnderstructure(ctx, x, y, w, current.id);
    }

    // Coping metálico + faixa neon no topo
    const edgeColor = warn ? PALETTE.edgeWarn : lerpHex(current.edgeColor, next.edgeColor, t);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const halo = ctx.createLinearGradient(0, y - 22, 0, y + 10);
    halo.addColorStop(0, 'rgba(0, 0, 0, 0)');
    halo.addColorStop(1, warn ? 'rgba(251, 191, 36, 0.30)' : lerpRgba(current.orbHalo, next.orbHalo, t));
    ctx.fillStyle = halo;
    ctx.fillRect(x, y - 22, w, 32);
    ctx.restore();

    ctx.fillStyle = edgeColor;
    ctx.fillRect(x, y, w, TRACK.EDGE);
    // Brilho especular tubular do coping
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fillRect(x, y, w, 1.8);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x, y + TRACK.EDGE, w, 2);

    if (warn) {
      this.drawHazardSurface(ctx, p, x, y, w);
    } else {
      this.drawSurfaceReflections(ctx, x, y, w, current.id);

      // Faixas de sinalização (exceto no píer de madeira)
      if (current.id !== 'beach') {
        ctx.fillStyle = current.id === 'cosmic'
          ? 'rgba(216, 180, 254, 0.22)'
          : 'rgba(226, 232, 255, 0.16)';
        for (let lx = x + 40; lx < x + w - 40; lx += 92) {
          ctx.fillRect(lx, y + 42, 50, 4);
        }
      }

      // Grafite discreto na parede
      ctx.font = '700 15px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = current.id === 'beach'
        ? 'rgba(254, 240, 138, 0.10)'
        : 'rgba(139, 92, 246, 0.12)';
      for (let gx = x + 90; gx < x + w - 180; gx += 620) {
        ctx.fillText('LUIGI SK8', gx, y + TRACK.SURFACE + 46);
      }
    }

    this.drawTrackEdges(ctx, x, y, w, TRACK.DEPTH, edgeColor, p);
    ctx.restore();
  }

  drawUnderstructure(ctx, x, y, w, biomeId) {
    const topY = y + TRACK.SURFACE + 6;
    const h = TRACK.DEPTH - TRACK.SURFACE - 6;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, topY, w, h);
    ctx.clip();

    if (biomeId === 'beach') {
      // Vigas transversais e estacas de píer de madeira
      ctx.fillStyle = 'rgba(20, 8, 2, 0.55)';
      ctx.fillRect(x, topY, w, 12);
      for (let px = x + 60; px < x + w - 40; px += 150) {
        ctx.fillStyle = '#2c1507';
        ctx.fillRect(px, topY, 22, h);
        ctx.fillStyle = 'rgba(254, 240, 138, 0.08)';
        ctx.fillRect(px, topY, 4, h);
        // Suporte diagonal
        ctx.strokeStyle = '#3b1c0a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(px + 20, topY + 42);
        ctx.lineTo(px + 54, topY + 6);
        ctx.stroke();
      }
    } else if (biomeId === 'cosmic') {
      // Nervuras energéticas flutuantes
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.20)';
      ctx.lineWidth = 2;
      for (let px = x + 40; px < x + w; px += 120) {
        ctx.beginPath();
        ctx.moveTo(px, topY);
        ctx.lineTo(px - 28, topY + 70);
        ctx.lineTo(px + 48, topY + 70);
        ctx.stroke();
      }
    } else {
      // Pilares e vigas de viaduto urbano
      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.fillRect(x, topY, w, 14);
      for (let px = x + 50; px < x + w - 50; px += 220) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
        ctx.fillRect(px, topY + 10, 34, h);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(px, topY + 10, 3, h);
      }
    }
    ctx.restore();
  }

  /** Reflexos especulares na superfície, coerentes com o material de cada bioma. */
  drawSurfaceReflections(ctx, x, y, w, biomeId) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + TRACK.EDGE, w, TRACK.SURFACE - TRACK.EDGE);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';

    const period = 340;
    const start = Math.floor(x / period) * period;

    if (biomeId === 'beach') {
      // Brilho solar quente seco nas tábuas
      for (let rx = start; rx < x + w + period; rx += period) {
        const glow = ctx.createLinearGradient(0, y, 0, y + 64);
        glow.addColorStop(0, 'rgba(254, 240, 138, 0.14)');
        glow.addColorStop(1, 'rgba(254, 240, 138, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(rx - 30, y, 60, 64);
      }
    } else if (biomeId === 'metropolis') {
      // Asfalto molhado de chuva refletindo neon rosa e ciano
      for (let rx = start; rx < x + w + period; rx += period) {
        const pink = ctx.createLinearGradient(0, y, 0, y + 98);
        pink.addColorStop(0, 'rgba(244, 63, 126, 0.22)');
        pink.addColorStop(0.5, 'rgba(244, 63, 126, 0.08)');
        pink.addColorStop(1, 'rgba(244, 63, 126, 0)');
        ctx.fillStyle = pink;
        ctx.fillRect(rx - 22, y, 44, 98);

        const cyan = ctx.createLinearGradient(0, y, 0, y + 86);
        cyan.addColorStop(0, 'rgba(34, 211, 238, 0.20)');
        cyan.addColorStop(1, 'rgba(34, 211, 238, 0)');
        ctx.fillStyle = cyan;
        ctx.fillRect(rx + 150, y, 36, 86);
      }
    } else {
      // Reflexos quentes/frios suaves no skatepark e cósmico
      const primary = biomeId === 'cosmic' ? '192, 132, 252' : '255, 224, 165';
      const secondary = biomeId === 'cosmic' ? '56, 189, 248' : '120, 200, 255';
      for (let rx = start; rx < x + w + period; rx += period) {
        const glow = ctx.createLinearGradient(0, y, 0, y + 96);
        glow.addColorStop(0, `rgba(${primary}, 0.16)`);
        glow.addColorStop(0.5, `rgba(${primary}, 0.05)`);
        glow.addColorStop(1, `rgba(${primary}, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(rx - 26, y, 52, 96);

        const cool = ctx.createLinearGradient(0, y, 0, y + 76);
        cool.addColorStop(0, `rgba(${secondary}, 0.11)`);
        cool.addColorStop(1, `rgba(${secondary}, 0)`);
        ctx.fillStyle = cool;
        ctx.fillRect(rx + 150, y, 34, 76);
      }
    }
    ctx.restore();
  }

  drawHazardSurface(ctx, p, x, y, w) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y + TRACK.EDGE, w, 16);
    ctx.clip();
    for (let sx = x - 24; sx < x + w + 24; sx += 26) {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.beginPath();
      ctx.moveTo(sx, y + TRACK.EDGE);
      ctx.lineTo(sx + 13, y + TRACK.EDGE);
      ctx.lineTo(sx + 1, y + TRACK.EDGE + 16);
      ctx.lineTo(sx - 12, y + TRACK.EDGE + 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const progress = p.triggered ? 1 - Math.max(0, p.shakeTimer) / 26 : 0.25;
    ctx.save();
    ctx.strokeStyle = `rgba(244, 63, 126, ${0.35 + progress * 0.65})`;
    ctx.lineWidth = 1.5 + progress * 2.5;
    ctx.lineCap = 'round';

    const rnd = (n) => {
      const s = Math.sin(p.crackSeed + n * 12.9898) * 43758.5453;
      return s - Math.floor(s);
    };

    for (let b = 0; b < 4; b++) {
      let cx = x + (0.15 + rnd(b) * 0.7) * w;
      let cy = y + TRACK.EDGE + 20;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const segs = 3 + Math.floor(progress * 3);
      for (let s = 0; s < segs; s++) {
        cx += (rnd(b * 10 + s) - 0.5) * 62;
        cy += 20 + rnd(b * 20 + s) * 24;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.font = '800 13px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + progress * 0.5})`;
    ctx.fillText('PISTA QUEBRADIÇA', x + w * 0.5, y + 64);
  }

  /** Quinas laterais: marcam claramente onde o chão acaba e começa o vão. */
  drawTrackEdges(ctx, x, y, w, h, edgeColor, p) {
    const left = p.leftOpen !== false;
    const right = p.rightOpen !== false;
    if (!left && !right) return;

    const edge = ctx.createLinearGradient(0, y, 0, y + h * 0.45);
    edge.addColorStop(0, edgeColor);
    edge.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = edge;
    if (left) ctx.fillRect(x, y, 4, h * 0.45);
    if (right) ctx.fillRect(x + w - 4, y, 4, h * 0.45);

    ctx.globalAlpha = 1;
    if (left) {
      const g = ctx.createLinearGradient(x, 0, x + 30, 0);
      g.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 30, h * 0.4);
    }
    if (right) {
      const g = ctx.createLinearGradient(x + w, 0, x + w - 30, 0);
      g.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + w - 30, y, 30, h * 0.4);
    }
    ctx.restore();
  }

  /** Corrimão de skatepark realista para grind. */
  drawRail(ctx, rail, blend) {
    const { x, y, width: w, height: h, surfaceType } = rail;
    const ground = this.groundY;
    const isWood = surfaceType === 'wood';

    ctx.save();

    // Sombra projetada no chão
    ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, ground + 4, w * 0.52, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pés de sustentação ancorados no chão
    const legs = w > 310 ? [x + 28, x + w * 0.5, x + w - 28] : [x + 28, x + w - 28];
    for (const lx of legs) {
      ctx.fillStyle = isWood ? '#451a03' : '#1e293b';
      ctx.fillRect(lx - 4, y + h - 2, 8, ground - (y + h - 2));
      ctx.fillStyle = isWood ? 'rgba(254, 240, 138, 0.16)' : 'rgba(226, 232, 240, 0.28)';
      ctx.fillRect(lx - 4, y + h - 2, 2, ground - (y + h - 2));
      // Base aparafusada no asfalto
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(lx - 10, ground - 4, 20, 5);
    }

    // Barra horizontal com volume cilíndrico 3D
    const barGrad = ctx.createLinearGradient(0, y, 0, y + h);
    if (isWood) {
      barGrad.addColorStop(0, '#fde68a');
      barGrad.addColorStop(0.25, '#b45309');
      barGrad.addColorStop(0.75, '#78350f');
      barGrad.addColorStop(1, '#451a03');
    } else {
      barGrad.addColorStop(0, '#f8fafc');
      barGrad.addColorStop(0.28, '#94a3b8');
      barGrad.addColorStop(0.72, '#475569');
      barGrad.addColorStop(1, '#1e293b');
    }
    this.roundRect(ctx, x, y, w, h, h * 0.45);
    ctx.fillStyle = barGrad;
    ctx.fill();

    // Brilho especular correndo no topo do corrimão
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillRect(x + 6, y + 1.5, w - 12, 2);

    // Pontas com realce neon sutil para leitura rápida de grind
    const pulse = 0.55 + Math.sin(rail.glowPhase || 0) * 0.25;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = blend.current.edgeColor || '#22d3ee';
    ctx.globalAlpha = pulse * 0.7;
    ctx.fillRect(x, y + 2, 10, h - 4);
    ctx.fillRect(x + w - 10, y + 2, 10, h - 4);
    ctx.restore();

    ctx.restore();
  }

  drawRamp(ctx, r) {
    const { x, y, width: w, height: h } = r;
    const baseY = y + h;
    const flash = r.usedAnim > 1 ? Math.min(1, r.usedAnim / 18) : (r.usedAnim || 0);
    const riderU = !r.used && r.riderU > 0 ? Math.min(1, r.riderU) : 0;

    ctx.save();

    // Sombra realista no chão
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.56, baseY + 4, w * 0.54, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Halo atmosférico sob a rampa (intensifica durante subida e decolagem)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glowStrength = 0.30 + flash * 0.42 + riderU * 0.22;
    const glow = ctx.createRadialGradient(x + w * 0.72, y + h * 0.35, 6, x + w * 0.72, y + h * 0.35, 118);
    glow.addColorStop(0, `rgba(139, 92, 246, ${glowStrength.toFixed(3)})`);
    glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 110, y - 110, w + 220, h + 220);
    ctx.restore();

    // Corpo: curva parabólica EXATA y(u) = baseY - h * u^2
    // (quadraticCurveTo com controle em (x + w * 0.5, baseY) é matematicamente idêntico!)
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + w * 0.5, baseY, x + w, y);
    ctx.lineTo(x + w, baseY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(x, baseY, x + w, y);
    grad.addColorStop(0, '#1e1b4b');
    grad.addColorStop(0.55, '#5b21b6');
    grad.addColorStop(0.86, '#0891b2');
    grad.addColorStop(1, '#22d3ee');
    ctx.fillStyle = grad;
    ctx.fill();

    // Detalhes internos (nervuras estruturais + chevrons LED)
    ctx.save();
    ctx.clip();

    // Nervuras de estrutura lateral
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.lineWidth = 3;
    for (let sx = x + 32; sx < x + w; sx += 28) {
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx, y);
      ctx.stroke();
    }

    // Faixa traseira de reforço estrutural
    ctx.fillStyle = 'rgba(15, 23, 42, 0.36)';
    ctx.fillRect(x + w - 12, y, 12, h);

    // Chevrons LED animados indicando aceleração
    const t = (this.time * 1.8) % 36;
    ctx.strokeStyle = `rgba(255, 255, 255, ${(0.45 + riderU * 0.35 + flash * 0.35).toFixed(3)})`;
    ctx.lineWidth = 3;
    for (let i = -2; i < 7; i++) {
      const cx = x + i * 36 + t;
      ctx.beginPath();
      ctx.moveTo(cx, baseY);
      ctx.lineTo(cx + 16, baseY - h);
      ctx.stroke();
    }

    // Destaque da zona do LIP (últimos 22%: u >= 0.78)
    const lipStartX = x + w * 0.78;
    const lipPulse = 0.55 + Math.sin(this.time * 0.16) * 0.25;
    const lipGrad = ctx.createLinearGradient(lipStartX, baseY, x + w, y);
    lipGrad.addColorStop(0, 'rgba(251, 191, 36, 0)');
    lipGrad.addColorStop(1, `rgba(251, 191, 36, ${(0.28 * lipPulse + flash * 0.55 + (riderU >= 0.7 ? 0.35 : 0)).toFixed(3)})`);
    ctx.fillStyle = lipGrad;
    ctx.fillRect(lipStartX, y, w * 0.22, h);

    ctx.restore();

    // Coping metálico cromado contínuo ao longo de toda a curva exata
    ctx.strokeStyle = '#e0f2fe';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.quadraticCurveTo(x + w * 0.5, baseY, x + w, y);
    ctx.stroke();

    // Faixa luminosa de timing no LIP (u = 0.78 .. 1.0)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lipHot = riderU >= 0.7 || flash > 0.1;
    ctx.strokeStyle = lipHot ? '#fde047' : '#67e8f9';
    ctx.lineWidth = lipHot ? 5.5 : 4;
    ctx.globalAlpha = lipHot ? 0.95 : 0.65 + Math.sin(this.time * 0.16) * 0.2;
    ctx.beginPath();
    for (let s = 0; s <= 6; s++) {
      const u = 0.78 + (0.22 * s) / 6;
      const px = x + w * u;
      const py = baseY - h * u * u;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Brilho sob as rodinhas enquanto o skatista sobe a curva
    if (riderU > 0.02) {
      const rx = x + w * riderU;
      const ry = baseY - h * riderU * riderU;
      const rg = ctx.createRadialGradient(rx, ry, 2, rx, ry, 34);
      rg.addColorStop(0, riderU >= 0.72 ? 'rgba(254, 240, 138, 0.9)' : 'rgba(103, 232, 249, 0.85)');
      rg.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = rg;
      ctx.fillRect(rx - 34, ry - 34, 68, 68);
    }

    // Flash de energia no lip no momento da decolagem
    if (flash > 0.02) {
      const fg = ctx.createRadialGradient(x + w, y, 2, x + w, y, 56 * (1.2 - flash * 0.4));
      fg.addColorStop(0, `rgba(255, 255, 255, ${(flash * 0.9).toFixed(3)})`);
      fg.addColorStop(0.45, `rgba(251, 191, 36, ${(flash * 0.55).toFixed(3)})`);
      fg.addColorStop(1, 'rgba(34, 211, 238, 0)');
      ctx.fillStyle = fg;
      ctx.fillRect(x + w - 64, y - 64, 128, 128);
    }
    ctx.restore();

    // Tubo de coping metálico no lábio superior (x + w, y)
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(x + w, y, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  drawObstacle(ctx, obs) {
    ctx.save();
    if (obs.type === 'crate') {
      this.drawCrate(ctx, obs);
    } else {
      this.drawSign(ctx, obs);
    }
    ctx.restore();
  }

  drawCrate(ctx, o) {
    const { x, y, width: w, height: h } = o;
    const r = 6;

    // Sombra projetada realista no asfalto
    ctx.fillStyle = 'rgba(0, 0, 0, 0.44)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.46, y + h + 4, w * 0.68, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Face principal chanfrada (barreira/caixote de rua)
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#475569');
    grad.addColorStop(0.5, '#293449');
    grad.addColorStop(1, '#151b2b');
    this.roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = grad;
    ctx.fill();

    // Faixas zebradas refletivas dentro da caixa
    ctx.save();
    this.roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 3);
    ctx.clip();
    ctx.strokeStyle = 'rgba(244, 63, 126, 0.36)';
    ctx.lineWidth = 8;
    for (let i = -h; i < w; i += 18) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
    ctx.restore();

    // Moldura metálica + cantoneiras com parafusos
    this.roundRect(ctx, x, y, w, h, r);
    ctx.strokeStyle = 'rgba(244, 63, 126, 0.82)';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    const bolts = [[x + 6, y + 6], [x + w - 9, y + 6], [x + 6, y + h - 9], [x + w - 9, y + h - 9]];
    for (const [bx, by] of bolts) {
      ctx.fillRect(bx, by, 3, 3);
    }

    // Luz especular superior
    ctx.fillStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.fillRect(x + 5, y + 2, w - 10, 2);

    // Indicador de "pule"
    const bob = Math.sin(this.time * 0.08) * 3;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.5 - 9, y - 14 + bob);
    ctx.lineTo(x + w * 0.5, y - 23 + bob);
    ctx.lineTo(x + w * 0.5 + 9, y - 14 + bob);
    ctx.stroke();
  }

  drawSign(ctx, o) {
    const { x, y, width: w, height: h } = o;

    // Sombra projetada no asfalto abaixo da placa (guia visual de agachamento!)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
    ctx.beginPath();
    ctx.ellipse(x + w * 0.5, this.groundY + 5, w * 0.62, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Treliça metálica descendo do topo
    ctx.strokeStyle = 'rgba(110, 124, 162, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 14, y); ctx.lineTo(x + 14, y - 900);
    ctx.moveTo(x + w - 14, y); ctx.lineTo(x + w - 14, y - 900);
    ctx.stroke();

    // Travessas diagonais da treliça
    ctx.strokeStyle = 'rgba(110, 124, 162, 0.32)';
    ctx.lineWidth = 1.5;
    for (let ty = y - 24; ty > y - 340; ty -= 32) {
      ctx.beginPath();
      ctx.moveTo(x + 14, ty);
      ctx.lineTo(x + w - 14, ty - 24);
      ctx.stroke();
    }

    // Braçadeiras
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x + 9, y - 6, 10, 8);
    ctx.fillRect(x + w - 19, y - 6, 10, 8);

    // Painel chanfrado
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#fef08a');
    grad.addColorStop(0.5, '#fbbf24');
    grad.addColorStop(1, '#d97706');
    this.roundRect(ctx, x, y, w, h, 7);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(30, 20, 5, 0.82)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Highlight metálico superior
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillRect(x + 6, y + 3, w - 12, 2);

    // Chevrons para baixo
    ctx.strokeStyle = 'rgba(30, 20, 5, 0.85)';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    const bob = Math.sin(this.time * 0.08) * 2;
    for (let i = 0; i < 2; i++) {
      const cy = y + 20 + i * 17 + bob;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5 - 13, cy - 6);
      ctx.lineTo(x + w * 0.5, cy + 4);
      ctx.lineTo(x + w * 0.5 + 13, cy - 6);
      ctx.stroke();
    }

    // LEDs piscantes nos cantos superiores
    const blink = Math.sin(this.time * 0.22) > 0;
    ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
    ctx.beginPath();
    ctx.arc(x + 9, y + 9, 3.2, 0, Math.PI * 2);
    ctx.arc(x + w - 9, y + 9, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Halo de alerta
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(x + w * 0.5, y + h * 0.5, 5, x + w * 0.5, y + h * 0.5, 72);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 72, y - 72, w + 144, h + 144);
    ctx.restore();
  }

  drawCollectibles(ctx) {
    for (const c of this.collectibles) {
      const anim = c.anim || 0;
      const bob = Math.sin(anim) * 5;
      const y = c.y + bob;

      // Reflexo/sombra sutil no chão quando o coletável está baixo
      const distToGround = this.groundY - y;
      if (distToGround > 0 && distToGround < 130) {
        const s = 1 - distToGround / 130;
        ctx.fillStyle = `rgba(0, 0, 0, ${(0.22 * s).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(c.x, this.groundY + 3, 12 * s, 3.5 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.save();
      ctx.translate(c.x, y);

      if (c.type === 'coin') this.drawCoin(ctx, c);
      else if (c.type === 'turbo') this.drawTurbo(ctx, c);
      else if (c.type === 'shield') this.drawShieldPickup(ctx, c);

      ctx.restore();
    }
  }

  drawCoin(ctx, c) {
    const r = c.size * 0.5;
    const anim = c.anim || 0;
    const spin = Math.cos(anim * 1.2);
    const faceW = Math.abs(spin);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2.4);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.38)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-r * 2.4, -r * 2.4, r * 4.8, r * 4.8);
    ctx.restore();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(1.8, r * faceW), r, 0, 0, Math.PI * 2);
    ctx.fill();

    if (faceW > 0.18) {
      const grad = ctx.createLinearGradient(-r, -r, r, r);
      grad.addColorStop(0, '#fef9c3');
      grad.addColorStop(0.45, '#fbbf24');
      grad.addColorStop(1, '#d97706');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * faceW * 0.84, r * 0.84, 0, 0, Math.PI * 2);
      ctx.fill();

      // Brilho especular branco na borda superior
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.ellipse(-r * faceW * 0.2, -r * 0.38, r * faceW * 0.3, r * 0.16, -0.3, 0, Math.PI * 2);
      ctx.fill();

      if (faceW > 0.55) {
        ctx.fillStyle = 'rgba(146, 64, 14, 0.85)';
        ctx.font = `800 ${Math.round(r)}px Outfit, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.save();
        ctx.scale(faceW, 1);
        ctx.fillText('L', 0, 1);
        ctx.restore();
      }
    }
  }

  drawTurbo(ctx, c) {
    const r = c.size * 0.5;
    const anim = c.anim || 0;
    ctx.rotate(anim * 0.6);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 3.1);
    glow.addColorStop(0, 'rgba(34, 211, 238, 0.58)');
    glow.addColorStop(0.5, 'rgba(139, 92, 246, 0.24)');
    glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-r * 3.1, -r * 3.1, r * 6.2, r * 6.2);
    ctx.restore();

    this.star(ctx, 5, r * 1.12, r * 0.48);
    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#67e8f9');
    grad.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawShieldPickup(ctx, c) {
    const r = c.size * 0.5;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 2.6);
    glow.addColorStop(0, 'rgba(52, 211, 153, 0.48)');
    glow.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-r * 2.6, -r * 2.6, r * 5.2, r * 5.2);
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.86, -r * 0.5);
    ctx.lineTo(r * 0.86, r * 0.34);
    ctx.quadraticCurveTo(r * 0.86, r * 0.95, 0, r * 1.12);
    ctx.quadraticCurveTo(-r * 0.86, r * 0.95, -r * 0.86, r * 0.34);
    ctx.lineTo(-r * 0.86, -r * 0.5);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, '#d1fae5');
    grad.addColorStop(0.45, '#34d399');
    grad.addColorStop(1, '#047857');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(4, 60, 44, 0.85)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.32, r * 0.05);
    ctx.lineTo(-r * 0.05, r * 0.38);
    ctx.lineTo(r * 0.38, -r * 0.3);
    ctx.stroke();
  }

  /** Clima ambiente por bioma, névoa atmosférica e linhas de velocidade. */
  drawForeground(ctx, W, H, speedRatio) {
    const blend = this.getBiomeBlend();
    const biomeId = blend.current.id;

    // Clima ambiente por bioma (pool pré-alocado, zero GC)
    ctx.save();
    if (biomeId === 'metropolis') {
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.24)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < this._ambientMotes.length; i++) {
        const m = this._ambientMotes[i];
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - 8, m.y + 18);
      }
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = 'lighter';
      const moteColor = biomeId === 'beach'
        ? '254, 249, 195'
        : biomeId === 'cosmic'
          ? '216, 180, 254'
          : '253, 186, 116';
      for (let i = 0; i < this._ambientMotes.length; i += 2) {
        const m = this._ambientMotes[i];
        ctx.fillStyle = `rgba(${moteColor}, ${(m.alpha * 0.45).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Brilho atmosférico de piso adaptado ao bioma
    const glow = ctx.createLinearGradient(0, this.groundY - 40, 0, H);
    glow.addColorStop(0, lerpRgba(blend.current.orbHalo, blend.next.orbHalo, blend.t));
    glow.addColorStop(1, 'rgba(10, 8, 24, 0)');
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = glow;
    ctx.fillRect(0, this.groundY - 40, W, H - this.groundY + 40);
    ctx.restore();

    // Linhas de velocidade dinâmicas (intensificam com velocidade e turbo)
    const effectiveRatio = this._playerTurbo ? Math.max(speedRatio, 1.0) : speedRatio;
    if (effectiveRatio > 0.52) {
      const a = Math.min(1, (effectiveRatio - 0.52) / 0.48);
      ctx.save();
      ctx.globalAlpha = a * (this._playerTurbo ? 0.28 : 0.18);
      ctx.strokeStyle = this._playerTurbo ? '#67e8f9' : '#dbeafe';
      ctx.lineWidth = this._playerTurbo ? 2 : 1.5;
      const lines = this._playerTurbo ? 13 : 9;
      for (let i = 0; i < lines; i++) {
        const seed = (i * 137.5 + this.scroll * (1.4 + i * 0.12)) % (W + 420);
        const lx = W + 210 - seed;
        const ly = 56 + ((i * 83) % (this.groundY - 110));
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 75 + a * 110, ly);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---- Utilitários de desenho ----

  roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  star(ctx, spikes, outer, inner) {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(0, -outer);
    for (let i = 0; i < spikes; i++) {
      ctx.lineTo(Math.cos(rot) * outer, Math.sin(rot) * outer);
      rot += step;
      ctx.lineTo(Math.cos(rot) * inner, Math.sin(rot) * inner);
      rot += step;
    }
    ctx.closePath();
  }
}

window.GameWorld = GameWorld;
window.PALETTE = PALETTE;
