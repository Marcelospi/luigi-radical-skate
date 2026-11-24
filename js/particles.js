// ============================================================
// Partículas e textos flutuantes
//
// Otimização de 60 FPS: sprites radiais de glow e fumaça são pré-renderizados
// em canvases offscreen cacheados por cor, eliminando createRadialGradient por
// partícula a cada quadro. Partículas luminosas rodam em passada aditiva única.
// ============================================================

const MAX_PARTICLES = 480;
const MAX_GLOW_SPRITES = 48;

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.texts = [];
    this._glowCache = new Map();
    this._smokeCache = new Map();
  }

  push(p) {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift();
    }
    this.particles.push(p);
  }

  // ---- Cache de sprites offscreen (zero gradiente por quadro) -------------

  _getGlowSprite(rgb) {
    let sprite = this._glowCache.get(rgb);
    if (sprite) return sprite;

    if (this._glowCache.size >= MAX_GLOW_SPRITES) {
      const firstKey = this._glowCache.keys().next().value;
      this._glowCache.delete(firstKey);
    }

    const size = 64;
    const half = size / 2;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, `rgba(255, 255, 255, 0.95)`);
    grad.addColorStop(0.22, `rgba(${rgb}, 0.85)`);
    grad.addColorStop(0.55, `rgba(${rgb}, 0.28)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    this._glowCache.set(rgb, c);
    return c;
  }

  _getSmokeSprite(rgb) {
    let sprite = this._smokeCache.get(rgb);
    if (sprite) return sprite;

    if (this._smokeCache.size >= 24) {
      const firstKey = this._smokeCache.keys().next().value;
      this._smokeCache.delete(firstKey);
    }

    const size = 48;
    const half = size / 2;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');

    const grad = ctx.createRadialGradient(half, half, 2, half, half, half);
    grad.addColorStop(0, `rgba(${rgb}, 0.85)`);
    grad.addColorStop(0.55, `rgba(${rgb}, 0.4)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    this._smokeCache.set(rgb, c);
    return c;
  }

  // ---- Emissores clássicos (retrocompatíveis) ------------------------------

  /** Poeira fina das rodinhas enquanto rola no asfalto. */
  emitWheelDust(x, y, color = '195, 208, 232') {
    this.push({
      kind: 'smoke',
      x: x + (Math.random() * 14 - 7),
      y: y - Math.random() * 3,
      vx: -(Math.random() * 2.8 + 1.6),
      vy: -(Math.random() * 0.9 + 0.15),
      size: Math.random() * 4.5 + 2.5,
      grow: 0.12,
      color: color.startsWith('#') ? hexToRgb(color) : color,
      alpha: 0.34,
      decay: 0.032,
      glow: false
    });
  }

  /** Anel de poeira no pouso / impulso do salto. */
  emitLandingDust(x, y, power = 8) {
    const count = Math.round(5 + power * 0.85);
    for (let i = 0; i < count; i++) {
      const dir = i % 2 === 0 ? -1 : 1;
      const spread = Math.random() * 4.2 + 1.1;
      this.push({
        kind: 'smoke',
        x: x + dir * (Math.random() * 14),
        y: y - Math.random() * 4,
        vx: dir * spread - 0.6,
        vy: -(Math.random() * 1.9 + 0.25),
        size: Math.random() * 6.5 + 3.5,
        grow: 0.22,
        color: '210, 218, 238',
        alpha: 0.48,
        decay: 0.038,
        drag: 0.94,
        glow: false
      });
    }
    // Pequenas faíscas/pedrinhas em pousos mais fortes
    if (power >= 10) {
      for (let i = 0; i < 4; i++) {
        this.push({
          kind: 'square',
          x: x + (Math.random() * 20 - 10),
          y: y - 2,
          vx: (Math.random() - 0.5) * 5.5,
          vy: -(Math.random() * 3.2 + 1.4),
          size: Math.random() * 2.5 + 1.5,
          color: '148, 163, 184',
          alpha: 0.85,
          decay: 0.04,
          gravity: 0.28,
          rot: Math.random() * Math.PI,
          spin: (Math.random() - 0.5) * 0.35,
          glow: false
        });
      }
    }
  }

  /** Faíscas de manobra, pouso e impacto. */
  emitSparks(x, y, count = 10, color = '#fbbf24') {
    const rgb = hexToRgb(color);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7.2 + 2.2;
      const isStreak = i % 2 === 0;
      this.push({
        kind: isStreak ? 'streak' : 'glow',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 3.2 + 1.6,
        grow: -0.025,
        color: rgb,
        alpha: 1,
        decay: Math.random() * 0.035 + 0.026,
        gravity: 0.2,
        drag: 0.96,
        glow: true
      });
    }
  }

  /** Brilho rápido ao pegar uma moeda. */
  emitSparkle(x, y) {
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.4;
      const spd = 1.6 + Math.random() * 1.8;
      this.push({
        kind: i < 2 ? 'streak' : 'glow',
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 1.2,
        size: Math.random() * 2.6 + 1.4,
        grow: -0.03,
        color: '254, 243, 199',
        alpha: 1,
        decay: 0.048,
        drag: 0.95,
        glow: true
      });
    }
  }

  /** Blocos de asfalto caindo quando a pista desaba. */
  emitRoadDebris(x, y, w, h) {
    for (let i = 0; i < 12; i++) {
      const palette = i % 3 === 0 ? '82, 92, 128' : i % 2 === 0 ? '48, 54, 82' : '28, 32, 52';
      this.push({
        kind: 'square',
        x: x + Math.random() * w,
        y: y + Math.random() * h,
        vx: Math.random() * 4.2 - 2.1,
        vy: Math.random() * 3.5 + 1.2,
        size: Math.random() * 7 + 3.5,
        grow: 0,
        color: palette,
        alpha: 0.95,
        decay: 0.015,
        gravity: 0.36,
        spin: (Math.random() - 0.5) * 0.32,
        rot: Math.random() * Math.PI,
        glow: false
      });
    }
    // Poeira acompanhando o desabamento
    for (let i = 0; i < 4; i++) {
      this.push({
        kind: 'smoke',
        x: x + Math.random() * w,
        y: y + Math.random() * 12,
        vx: (Math.random() - 0.5) * 1.8,
        vy: -(Math.random() * 1.2 + 0.3),
        size: Math.random() * 9 + 6,
        grow: 0.25,
        color: '150, 160, 185',
        alpha: 0.38,
        decay: 0.025,
        glow: false
      });
    }
  }

  /** Rastro arco-íris sob efeito de turbo. */
  emitTurboTrail(x, y) {
    const hues = ['244, 63, 126', '251, 191, 36', '52, 211, 153', '34, 211, 238', '139, 92, 246'];
    const color = hues[Math.floor(Math.random() * hues.length)];
    this.push({
      kind: Math.random() < 0.45 ? 'streak' : 'glow',
      x: x - 12,
      y: y + (Math.random() * 44 - 22),
      vx: -(Math.random() * 6.5 + 5),
      vy: Math.random() * 1.4 - 0.7,
      size: Math.random() * 6.5 + 4,
      grow: -0.1,
      color,
      alpha: 0.85,
      decay: 0.052,
      glow: true
    });
  }

  /** Rastro personalizado equipado na Oficina (arco-íris, fogo, raio, estrelas). */
  emitCustomTrail(x, y, colors = ['34, 211, 238']) {
    const palette = Array.isArray(colors) && colors.length ? colors : ['34, 211, 238'];
    const rawColor = palette[Math.floor(Math.random() * palette.length)];
    const color = hexToRgb(rawColor);
    this.push({
      kind: Math.random() < 0.5 ? 'streak' : 'glow',
      x: x - 8,
      y: y + (Math.random() * 24 - 12),
      vx: -(Math.random() * 4.5 + 3.2),
      vy: Math.random() * 1.4 - 0.7,
      size: Math.random() * 4.4 + 2.4,
      grow: -0.06,
      color,
      alpha: 0.88,
      decay: 0.055,
      glow: true
    });
  }

  /** Chuva festiva de confetes (palavra completa, novo recorde, Modo Radical). */
  emitConfetti(x, y, count = 30) {
    const palette = ['244, 63, 126', '251, 191, 36', '52, 211, 153', '34, 211, 238', '168, 85, 247'];
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * Math.PI * 1.3;
      const spd = 3.5 + Math.random() * 7.5;
      this.push({
        kind: 'square',
        x: x + (Math.random() * 36 - 18),
        y: y + (Math.random() * 20 - 10),
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 2,
        size: Math.random() * 5 + 4,
        grow: 0,
        color: palette[i % palette.length],
        alpha: 1,
        decay: 0.016 + Math.random() * 0.01,
        gravity: 0.22,
        drag: 0.97,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.4,
        glow: false
      });
    }
  }

  /** Estilhaços quando o skatista quebra um obstáculo no Turbo ou Modo Radical. */
  emitObstacleSmash(x, y, color = '#fbbf24') {
    this.emitShockwave(x, y, color, 88);
    this.emitSparks(x, y, 22, color);
    const debrisColors = ['148, 163, 184', '71, 85, 105', '251, 191, 36'];
    for (let i = 0; i < 14; i++) {
      this.push({
        kind: 'square',
        x: x + (Math.random() * 24 - 12),
        y: y + (Math.random() * 24 - 12),
        vx: 2 + Math.random() * 8,
        vy: -(3 + Math.random() * 7),
        size: Math.random() * 7 + 4,
        grow: 0,
        color: debrisColors[i % debrisColors.length],
        alpha: 0.95,
        decay: 0.02,
        gravity: 0.34,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.45,
        glow: false
      });
    }
  }

  /** Brilho sutil ao puxar moeda pelo Ímã. */
  emitMagnetPull(x, y) {
    this.push({
      kind: 'glow',
      x,
      y,
      vx: (Math.random() - 0.5) * 1.2,
      vy: (Math.random() - 0.5) * 1.2,
      size: 2.8,
      grow: -0.08,
      color: '244, 63, 126',
      alpha: 0.75,
      decay: 0.09,
      glow: true
    });
  }

  // ---- Novos emissores (Contrato Compartilhado) ----------------------------

  /** Faíscas metálicas contínuas ao deslizar (grind) no corrimão. */
  emitGrindSparks(x, y, intensity = 1) {
    const clamped = Math.max(0.3, Math.min(2, intensity));
    const count = Math.max(1, Math.round(2 + clamped * 2.5));
    const colors = ['254, 240, 138', '251, 191, 36', '249, 115, 22', '255, 255, 255'];

    for (let i = 0; i < count; i++) {
      const vx = -(Math.random() * 6.5 + 3.5) * clamped;
      const vy = -(Math.random() * 4.2 + 0.8);
      this.push({
        kind: 'streak',
        x: x + (Math.random() * 10 - 5),
        y: y + (Math.random() * 4 - 2),
        vx,
        vy,
        size: Math.random() * 2.4 + 1.5,
        grow: -0.02,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0.98,
        decay: Math.random() * 0.04 + 0.042,
        gravity: 0.28,
        drag: 0.97,
        glow: true
      });
    }
  }

  /** Onda de choque expansiva (mega rampa, pouso perfeito, power-ups). */
  emitShockwave(x, y, color = '#22d3ee', maxRadius = 72) {
    this.push({
      kind: 'ring',
      x,
      y,
      vx: 0,
      vy: 0,
      radius: 8,
      maxRadius: Math.max(24, maxRadius),
      lineWidth: 4.5,
      color: hexToRgb(color),
      alpha: 0.9,
      decay: 0.055,
      glow: true
    });
  }

  /** Poeira/fumaça arrastada ao agachar, frear ou deslizar. */
  emitSlideDust(x, y) {
    for (let i = 0; i < 2; i++) {
      this.push({
        kind: 'smoke',
        x: x + (Math.random() * 12 - 6),
        y: y - Math.random() * 5,
        vx: -(Math.random() * 4.2 + 2.2),
        vy: -(Math.random() * 1.4 + 0.2),
        size: Math.random() * 6 + 4,
        grow: 0.22,
        color: '215, 224, 242',
        alpha: 0.42,
        decay: 0.036,
        drag: 0.95,
        glow: false
      });
    }
  }

  /** Rajada direcional de linhas de velocidade (turbo, rampa, remada). */
  emitSpeedBurst(x, y, color = '#22d3ee') {
    const rgb = hexToRgb(color);
    for (let i = 0; i < 8; i++) {
      this.push({
        kind: 'streak',
        x: x + (Math.random() * 16 - 8),
        y: y + (Math.random() * 38 - 19),
        vx: -(Math.random() * 11 + 7),
        vy: (Math.random() - 0.5) * 1.8,
        size: Math.random() * 2.8 + 1.8,
        grow: -0.04,
        color: rgb,
        alpha: 0.92,
        decay: 0.055,
        drag: 0.96,
        glow: true
      });
    }
  }

  /** Explosão direcional no topo (lip) da rampa ao decolar. */
  emitRampLaunch(x, y, boosted = false) {
    const mainColor = boosted ? '#fbbf24' : '#22d3ee';
    this.emitShockwave(x, y, mainColor, boosted ? 94 : 68);

    const palette = boosted
      ? ['254, 240, 138', '251, 191, 36', '34, 211, 238', '255, 255, 255']
      : ['103, 232, 249', '34, 211, 238', '192, 132, 252', '255, 255, 255'];
    const count = boosted ? 16 : 9;

    for (let i = 0; i < count; i++) {
      // Direção para trás e ligeiramente para baixo (contraponto à decolagem)
      const angle = Math.PI * (0.72 + Math.random() * 0.42);
      const speed = (boosted ? 6.5 : 4.5) + Math.random() * (boosted ? 6.5 : 4.5);
      this.push({
        kind: 'streak',
        x: x + (Math.random() * 12 - 6),
        y: y + (Math.random() * 8 - 4),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 2.6 + (boosted ? 2.0 : 1.5),
        grow: -0.03,
        color: palette[i % palette.length],
        alpha: 1,
        decay: 0.035 + Math.random() * 0.025,
        gravity: 0.16,
        drag: 0.96,
        glow: true
      });
    }

    if (boosted) {
      this.emitSpeedBurst(x, y - 16, '#fbbf24');
    }
  }

  /** Estalo seco de poeira e micro-faíscas sob o tail ao bater o ollie. */
  emitOlliePop(x, y) {
    for (let i = 0; i < 4; i++) {
      this.push({
        kind: 'smoke',
        x: x + (Math.random() * 10 - 5),
        y: y - Math.random() * 3,
        vx: -(Math.random() * 2.8 + 1.2) + (Math.random() - 0.5) * 1.4,
        vy: -(Math.random() * 1.6 + 0.3),
        size: Math.random() * 4.5 + 2.8,
        grow: 0.16,
        color: '220, 228, 244',
        alpha: 0.48,
        decay: 0.044,
        drag: 0.94,
        glow: false
      });
    }
    for (let i = 0; i < 3; i++) {
      this.push({
        kind: 'streak',
        x: x + (Math.random() * 8 - 4),
        y: y - 2,
        vx: -(Math.random() * 4.5 + 2.0),
        vy: -(Math.random() * 2.8 + 0.6),
        size: 1.8,
        grow: -0.04,
        color: '254, 243, 199',
        alpha: 0.9,
        decay: 0.065,
        gravity: 0.22,
        glow: true
      });
    }
  }

  /** Pequena nuvem de poeira sob o tênis de impulso durante a remada. */
  emitPushDust(x, y) {
    for (let i = 0; i < 3; i++) {
      this.push({
        kind: 'smoke',
        x: x + (Math.random() * 10 - 5),
        y: y - Math.random() * 3,
        vx: -(Math.random() * 3.2 + 1.8),
        vy: -(Math.random() * 1.0 + 0.2),
        size: Math.random() * 4.2 + 2.6,
        grow: 0.15,
        color: '205, 215, 236',
        alpha: 0.38,
        decay: 0.04,
        drag: 0.95,
        glow: false
      });
    }
  }

  // ---- Texto flutuante -----------------------------------------------------

  addFloatingText(text, x, y, color = '#fbbf24', size = 20) {
    const cappedSize = Math.min(22, size || 20);
    let slot = y;
    const minSlot = y - 110;
    let moved = true;
    let guard = 0;
    while (moved && guard++ < 12) {
      moved = false;
      for (const t of this.texts) {
        if (Math.abs(t.x - x) < 220 && Math.abs(t.y - slot) < 30) {
          slot = Math.max(minSlot, t.y - 32);
          moved = slot > minSlot;
          break;
        }
      }
    }

    this.texts.push({
      text,
      x,
      y: slot,
      vy: -1.5,
      color,
      size: cappedSize,
      life: 1,
      decay: 0.02,
      scale: 0.4,
      age: 0
    });
    while (this.texts.length > 3) this.texts.shift();
  }

  // ---- Ciclo ---------------------------------------------------------------

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.kind === 'ring') {
        p.radius += (p.maxRadius - p.radius) * 0.22;
        p.lineWidth = Math.max(0.8, p.lineWidth * 0.92);
      } else {
        if (p.gravity) p.vy += p.gravity;
        if (p.drag) {
          p.vx *= p.drag;
          p.vy *= p.drag;
        }
        if (p.grow) p.size = Math.max(0.3, p.size + p.grow);
        if (p.spin) p.rot += p.spin;
      }

      p.alpha -= p.decay;
      if (p.alpha <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.age++;
      t.y += t.vy;
      t.vy *= 0.97;
      t.scale += (1 - t.scale) * 0.25;
      if (t.age > 26) t.life -= t.decay * 2.4;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    // Passada 1: partículas opacas (fumaça suave, detritos sólidos)
    ctx.save();
    for (const p of this.particles) {
      if (p.glow) continue;
      const a = Math.max(0, Math.min(1, p.alpha));
      ctx.globalAlpha = a;

      if (p.kind === 'square' || p.square) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = `rgb(${p.color})`;
        ctx.fillRect(-p.size * 0.5, -p.size * 0.4, p.size, p.size * 0.8);
        // Pequeno destaque de luz numa borda do fragmento
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(-p.size * 0.5, -p.size * 0.4, p.size, 1.2);
        ctx.restore();
      } else if (p.kind === 'smoke') {
        const sprite = this._getSmokeSprite(p.color);
        const d = p.size * 2.4;
        ctx.drawImage(sprite, p.x - d * 0.5, p.y - d * 0.5, d, d);
      } else {
        ctx.fillStyle = `rgb(${p.color})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // Passada 2: partículas luminosas em modo aditivo (sprites cacheados + streaks + rings)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of this.particles) {
      if (!p.glow) continue;
      const a = Math.max(0, Math.min(1, p.alpha));
      ctx.globalAlpha = a;

      if (p.kind === 'ring') {
        ctx.strokeStyle = `rgb(${p.color})`;
        ctx.lineWidth = p.lineWidth;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = a * 0.45;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(0.7, p.lineWidth * 0.35);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'streak') {
        const tailX = p.x - p.vx * 2.1;
        const tailY = p.y - p.vy * 2.1;

        ctx.strokeStyle = `rgb(${p.color})`;
        ctx.lineWidth = p.size * 1.45;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // Núcleo incandescente branco
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(1, p.size * 0.55);
        ctx.beginPath();
        ctx.moveTo(p.x - p.vx * 0.9, p.y - p.vy * 0.9);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else {
        const sprite = this._getGlowSprite(p.color);
        const d = p.size * 5.2;
        ctx.drawImage(sprite, p.x - d * 0.5, p.y - d * 0.5, d, d);
      }
    }
    ctx.restore();

    this.drawTexts(ctx);
  }

  drawTexts(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    for (const t of this.texts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
      ctx.translate(t.x, t.y);
      ctx.scale(t.scale, t.scale);
      ctx.font = `800 ${t.size}px Outfit, system-ui, sans-serif`;

      ctx.shadowColor = t.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = 'rgba(4, 5, 12, 0.92)';
      ctx.lineWidth = 5;
      ctx.strokeText(t.text, 0, 0);

      ctx.fillStyle = t.color;
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  clear() {
    this.particles.length = 0;
    this.texts.length = 0;
  }
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return '251, 191, 36';
  const trimmed = hex.trim();
  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(trimmed);
  if (rgbMatch) return `${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}`;
  if (!trimmed.startsWith('#')) return trimmed;
  const v = trimmed.slice(1);
  const full = v.length === 3 ? v.split('').map(c => c + c).join('') : v;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '251, 191, 36';
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

window.particleSystem = new ParticleSystem();
