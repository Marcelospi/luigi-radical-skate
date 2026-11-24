// ============================================================
// Loop principal, câmera, telas e HUD
//
// A simulação usa passo fixo de 60 Hz com acumulador: em monitores de
// 120/144 Hz o jogo roda na mesma velocidade que em 60 Hz.
// ============================================================

const VIEW = { W: 1280, H: 720 };
const STEP_MS = 1000 / 60;
const MAX_STEPS_PER_FRAME = 5;

const SPORT_FALLBACK = {
  skate:   { id: 'skate',   name: 'Skate',     icon: '🛹', tagline: 'Equilibrado · Manobras clássicas e controle preciso', touchLabels: ['FLIP', '360°', 'GRAB'] },
  bmx:     { id: 'bmx',     name: 'Bicicleta', icon: '🚲', tagline: 'Super Rampa · Voa mais alto e pouso macio',          touchLabels: ['WHIP', 'BAR', 'SUPER'] },
  scooter: { id: 'scooter', name: 'Patinete',  icon: '🛴', tagline: 'Ágil · Manobras 25% mais rápidas para combos',       touchLabels: ['WHIP', 'BAR', 'GRAB'] },
  skates:  { id: 'skates',  name: 'Patins',    icon: '🛼', tagline: 'Veloz · Pulo Duplo no ar e deslize suave',           touchLabels: ['MUTE', '360°', 'SOUL'] }
};

class Camera {
  constructor() {
    this.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.reset();
  }

  reset() {
    this.y = 0;
    this.xOffset = 0;
    this.zoom = 1.02;
    this.zoomVelocity = 0;
    this.trauma = 0;
    this.shakeDirX = 0;
    this.shakeDirY = 0;
    this.shakeAmount = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  /**
   * Aciona tremor de câmera calibrado com trauma quadrático e direção opcional.
   * Retrocompatível com camera.shake(amount).
   */
  shake(amount, dirX = 0, dirY = 0) {
    if (this.reducedMotion) return;
    const added = Math.max(0, Math.min(1, amount / 18));
    this.trauma = Math.min(1, Math.max(this.trauma, added));
    this.shakeDirX = dirX;
    this.shakeDirY = dirY;
    this.shakeAmount = Math.min(26, Math.max(this.shakeAmount, amount));
  }

  /** Micro impulso elástico de zoom (ex.: pouso perfeito ou saída de rampa). */
  punchZoom(delta) {
    if (this.reducedMotion) return;
    this.zoomVelocity += delta;
  }

  update(player, world) {
    // Acompanha verticalmente quando o skatista sobe alto (rampas / corrimãos)
    const threshold = world.groundY - player.height - 175;
    const targetY = Math.min(0, (player.y - threshold) * 0.48);
    this.y += (targetY - this.y) * 0.12;

    const speedRatio = player.speedNormalized !== undefined
      ? player.speedNormalized
      : (player.speed / (player.maxSpeed || 12.5));
    const altitude = player.airHeight !== undefined
      ? player.airHeight
      : Math.max(0, world.groundY - player.bottom);

    // Zoom dinâmico >= 1.0 (nunca expõe bordas pretas): aproxima leve em cruzeiro,
    // abre para 1.0 em alta velocidade ou mega rampas para ampliar o campo de visão.
    if (!this.reducedMotion) {
      const speedPull = Math.min(0.028, Math.max(0, (speedRatio - 0.5) * 0.032));
      const airPull = Math.min(0.018, Math.max(0, altitude / 9000));
      const targetZoom = Math.max(1.0, 1.032 - speedPull - airPull);

      this.zoomVelocity += (targetZoom - this.zoom) * 0.14;
      this.zoomVelocity *= 0.72;
      this.zoom = Math.max(1.0, Math.min(1.06, this.zoom + this.zoomVelocity));

      // Look-ahead horizontal suave conforme velocidade
      const targetXOffset = Math.max(0, (speedRatio - 0.6) * 24);
      this.xOffset += (targetXOffset - this.xOffset) * 0.08;
    } else {
      this.zoom = 1.0;
      this.xOffset = 0;
    }

    // Decaimento quadrático de trauma para tremor orgânico e preciso
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - 0.048);
      const power = this.trauma * this.trauma * 18;
      const randX = (Math.random() * 2 - 1);
      const randY = (Math.random() * 2 - 1);
      const biasX = this.shakeDirX ? (0.45 + Math.abs(this.shakeDirX)) : 1;
      const biasY = this.shakeDirY ? (0.45 + Math.abs(this.shakeDirY)) : 1;
      this.shakeX = randX * power * biasX;
      this.shakeY = randY * power * biasY;
      this.shakeAmount = power;
    } else {
      this.shakeAmount = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeDirX = 0;
      this.shakeDirY = 0;
    }
  }

  idle() {
    this.y += (0 - this.y) * 0.08;
    this.xOffset += (0 - this.xOffset) * 0.08;
    this.zoom += (1.0 - this.zoom) * 0.08;
    this.zoomVelocity = 0;
    this.trauma = 0;
    this.shakeAmount = 0;
    this.shakeX = this.shakeY = 0;
  }
}

/**
 * Estado de entrada com buffer de toque.
 *
 * A física roda em passos fixos, então um toque muito rápido pode começar e
 * terminar entre dois passos. O buffer guarda a batida por alguns passos
 * para que nenhum comando curto seja engolido.
 */
class Input {
  constructor() { this.held = {}; this.taps = {}; }

  down(code) { this.held[code] = true; this.taps[code] = 8; }
  up(code)   { this.held[code] = false; }

  isHeld(code) { return !!this.held[code]; }

  /** Consome a batida: responde true uma única vez por toque. */
  consumeTap(code) {
    if (this.taps[code] > 0) { this.taps[code] = 0; return true; }
    return false;
  }

  tick() {
    for (const code in this.taps) {
      if (this.taps[code] > 0) this.taps[code]--;
    }
  }

  clear() { this.held = {}; this.taps = {}; }
}

// ============================================================
// Placar de Líderes (Leaderboard): persistência, ordenação decrescente e destaque
// ============================================================
class LeaderboardManager {
  constructor() {
    this.STORAGE_KEY = 'luigi_skate_leaderboard';
    this.CLEANED_FLAG = 'luigi_skate_cleaned_anon_scores_v3';
    this.cleanLegacyScores();
    this.stripHeavyPortraits();
  }

  // Zera as pontuações salvas hoje que não tinham nome
  cleanLegacyScores() {
    try {
      if (!localStorage.getItem(this.CLEANED_FLAG)) {
        localStorage.removeItem('luigi_skate_high_score');
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
        localStorage.setItem(this.CLEANED_FLAG, 'true');
      }
    } catch (_) {}
  }

  /** Remove eventuais Data URLs base64 antigos do placar para evitar QuotaExceededError. */
  stripHeavyPortraits() {
    try {
      const list = this.getAll();
      let changed = false;
      for (const item of list) {
        if (typeof item.characterPortrait === 'string' && item.characterPortrait.startsWith('data:')) {
          item.characterPortrait = 'assets/portraits/portrait_luigi_3d.png';
          changed = true;
        }
      }
      if (changed) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      }
    } catch (_) {}
  }

  getAll() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const list = data ? JSON.parse(data) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  saveList(list) {
    const trimmed = list.slice(0, 40);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
      if (trimmed.length > 0) {
        writeNumber('luigi_skate_high_score', trimmed[0].score);
      }
    } catch (_) {}
    return trimmed;
  }

  addEntry({ name, score, distance, characterId, characterName, characterPortrait, sportId, sportIcon }) {
    const list = this.getAll();
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // Nunca grava Data URL base64 gigante no placar (evita QuotaExceededError no localStorage)
    const safePortrait = (typeof characterPortrait === 'string' && !characterPortrait.startsWith('data:'))
      ? characterPortrait
      : 'assets/portraits/portrait_luigi_3d.png';

    const entry = {
      id: 'score_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: (name || 'Skatista').trim(),
      score: Math.max(0, Math.floor(score)),
      distance: Math.max(0, Math.floor(distance)),
      characterId: characterId || 'luigi_3d',
      characterName: characterName || 'Luigi 3D',
      characterPortrait: safePortrait,
      sportId: sportId || 'skate',
      sportIcon: sportIcon || '🛹',
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}`,
      timestamp: Date.now()
    };

    list.push(entry);
    // Ordena do maior ponto para o menor
    list.sort((a, b) => b.score - a.score);
    this.saveList(list);

    return entry;
  }

  /** Atualiza o nome de uma entrada já salva nesta partida sem duplicar no placar. */
  updateEntryName(entryId, newName) {
    if (!entryId) return null;
    const list = this.getAll();
    const target = list.find(item => item.id === entryId);
    if (!target) return null;
    target.name = (newName || 'Skatista').trim();
    this.saveList(list);
    return target;
  }

  clear() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
      localStorage.removeItem('luigi_skate_high_score');
    } catch (_) {}
  }

  getTopScore() {
    const list = this.getAll();
    return list.length > 0 ? list[0].score : 0;
  }
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.wrapper = document.getElementById('game-wrapper');

    this.world = new window.GameWorld();
    this.player = new window.Player();
    this.selectedSport = readText('luigi_skate_selected_sport', 'skate');
    if (!this.getSportInfo(this.selectedSport)) this.selectedSport = 'skate';
    if (this.player.setSport) this.player.setSport(this.selectedSport);
    this.player.reset(this.world);   // sem isto o personagem flutua no menu
    this.camera = new Camera();

    this.state = 'LOADING';
    this.input = new Input();
    this.leaderboard = new LeaderboardManager();
    this.highScore = this.leaderboard.getTopScore();
    this.lastPlayerName = readText('luigi_skate_last_player_name', 'Luigi');

    this.accumulator = 0;
    this.lastTime = 0;
    this.hudCache = {};
    this.comboBankTimer = 0;
    this.comboBankMult = 1;
    this.comboBankPoints = 0;
    this._scoreSavedThisRun = false;
    this._lastSavedEntryId = null;
    this._onlineSavedThisRun = false;
    this.leaderboardTab = 'global';
    this._popTimers = {};

    this.selectedMode = 'classic';
    this.selectedDifficulty = (() => {
      try { return localStorage.getItem('luigi_skate_difficulty') === 'hard' ? 'hard' : 'easy'; }
      catch (_) { return 'easy'; }
    })();
    this.selectedStage = 0;
    this.shopTab = 'gear';
    this.leaderboardSportFilter = 'all';
    this._cachedLeaderboardList = [];
    this._cachedLbContainer = 'main-leaderboard-list';
    this._coinsBankedThisRun = false;
    this._toastQueue = [];
    this._toastBusy = false;
    this._toastTimer = null;
    this._hintTimer = null;
    this._bannerTimer = null;
    this._swipeTimers = new Set();
    this._lbReqSeq = {};
    this._runId = 0;
    this._prevLivesCount = null;
    this._finishSeq = null;
    this._resumeSeq = null;
    this._countAnimRaf = null;
    this._settingsReturnState = 'MENU';
    this._audioUnlocked = false;
    this._gamepadPrev = {};
    this._gamepadToastShown = false;
    this._confirmResolver = null;
    this.vibrationEnabled = readText('luigi_skate_vibration_v1', 'true') !== 'false';

    this.el = {
      score:             document.getElementById('hud-score'),
      distance:          document.getElementById('hud-distance'),
      speedChip:         document.getElementById('hud-speed-chip'),
      speed:             document.getElementById('hud-speed'),
      speedBar:          document.getElementById('hud-speed-bar'),
      coins:             document.getElementById('hud-coins'),
      lives:             document.getElementById('hud-lives'),
      avatar:            document.getElementById('hud-avatar'),
      word:              document.getElementById('hud-word'),
      timerChip:         document.getElementById('hud-timer-chip'),
      timer:             document.getElementById('hud-timer'),
      highscore:         document.getElementById('hud-highscore'),
      stageIcon:         document.getElementById('hud-stage-icon'),
      stageTitle:        document.getElementById('hud-stage-title'),
      stageProgress:     document.getElementById('hud-stage-progress-fill'),
      stageBanner:       document.getElementById('stage-banner'),
      stageBannerIcon:   document.getElementById('stage-banner-icon'),
      stageBannerTitle:  document.getElementById('stage-banner-title'),
      stageBannerName:   document.getElementById('stage-banner-name'),
      stageBannerReward: document.getElementById('stage-banner-reward'),
      combo:             document.getElementById('combo-display'),
      comboMult:         document.getElementById('combo-multiplier'),
      comboAction:       document.getElementById('combo-action'),
      comboPoints:       document.getElementById('combo-points'),
      fever:             document.getElementById('fever-meter'),
      feverLabel:        document.getElementById('fever-meter-label'),
      turbo:             document.getElementById('turbo-meter'),
      shield:            document.getElementById('shield-meter'),
      magnet:            document.getElementById('magnet-meter'),
      double:            document.getElementById('double-meter'),
      toastStack:        document.getElementById('toast-stack'),
      desktopTrickBar:   document.getElementById('desktop-trick-bar'),
      flash:             document.getElementById('screen-flash'),
      runHint:           document.getElementById('run-hint'),
      registerBox:       document.getElementById('gameover-register-box'),
      playerNameInput:   document.getElementById('leaderboard-name-input'),
      btnSaveScore:      document.getElementById('btn-save-score'),
      registerFeedback:  document.getElementById('register-feedback'),
      finishFreeBtn:     document.getElementById('btn-finish-free'),
      pauseFinishFreeBtn:document.getElementById('btn-pause-finish-free'),
      resumeCountdown:   document.getElementById('resume-countdown'),
      resumeCountdownNum:document.getElementById('resume-countdown-num'),
      gameoverTitle:     document.getElementById('gameover-title'),
      gameoverRankBadge: document.getElementById('gameover-rank-badge'),
      fullscreenHudBtn:  document.getElementById('btn-fullscreen-hud'),
      fullscreenMenuBtn: document.getElementById('btn-fullscreen-menu'),
      fullscreenSettingsBtn: document.getElementById('btn-settings-fullscreen')
    };

    this.resize();
    this.watchResize();
    this.initInputs();
    this.initUI();
    this.animate = this.animate.bind(this);
  }

  // ==========================================================
  // Inicialização
  // ==========================================================

  async start() {
    await window.characterManager.init();

    this.setState('MENU');
    this.refreshMenuInfo();
    this.el.highscore.textContent = formatNumber(this.highScore);
    this.registerServiceWorker();
    this.initGamepadListeners();
    this.syncFullscreenButtons();

    requestAnimationFrame(this.animate);
  }

  registerServiceWorker() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const okProto = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!okProto) return;
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  unlockAudioAndMenuMusic() {
    if (!window.soundSystem) return;
    window.soundSystem.init();
    this._audioUnlocked = true;
    if (['MENU', 'SHOP', 'MISSIONS', 'SELECT_CHAR', 'LEADERBOARD', 'HOW_TO_PLAY', 'SETTINGS'].includes(this.state)) {
      if (typeof window.soundSystem.startMenuMusic === 'function') {
        window.soundSystem.startMenuMusic();
      }
    }
  }

  haptic(pattern) {
    if (!this.vibrationEnabled || this.camera?.reducedMotion) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(pattern); } catch (_) {}
    }
  }

  isFullscreenSupported() {
    const docEl = document.documentElement;
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled || (docEl && (docEl.requestFullscreen || docEl.webkitRequestFullscreen)));
  }

  isFullscreenActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  toggleFullscreen() {
    if (!this.isFullscreenSupported()) return;
    const docEl = document.documentElement;
    try {
      if (this.isFullscreenActive()) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else {
        if (docEl.requestFullscreen) docEl.requestFullscreen().catch(() => {});
        else if (docEl.webkitRequestFullscreen) docEl.webkitRequestFullscreen();
      }
    } catch (_) {}
  }

  syncFullscreenButtons() {
    const supported = this.isFullscreenSupported();
    const active = this.isFullscreenActive();
    [this.el.fullscreenHudBtn, this.el.fullscreenMenuBtn, this.el.fullscreenSettingsBtn].forEach(btn => {
      if (!btn) return;
      btn.hidden = !supported;
    });
    if (this.el.fullscreenHudBtn) {
      this.el.fullscreenHudBtn.textContent = active ? '🗗' : '⛶';
      this.el.fullscreenHudBtn.title = active ? 'Sair da tela cheia (F)' : 'Tela cheia (F)';
    }
    if (this.el.fullscreenMenuBtn) {
      this.el.fullscreenMenuBtn.textContent = active ? '🗗' : '⛶';
      this.el.fullscreenMenuBtn.title = active ? 'Sair da tela cheia (F)' : 'Tela cheia (F)';
    }
    if (this.el.fullscreenSettingsBtn) {
      this.el.fullscreenSettingsBtn.textContent = active ? '🗗 Sair da Tela Cheia (F)' : '⛶ Ativar Tela Cheia (F)';
    }
  }

  /**
   * Ajusta o buffer do canvas à resolução física da tela, mantendo as
   * coordenadas lógicas em 1280x720. Só mede o layout quando algo mudou —
   * ler getBoundingClientRect a cada quadro força reflow à toa.
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(isCoarse ? 1.25 : 1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round((rect.width || VIEW.W) * dpr));
    const h = Math.max(1, Math.round((rect.height || VIEW.H) * dpr));

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.scaleX = w / VIEW.W;
    this.scaleY = h / VIEW.H;
    this.needsResize = false;
  }

  watchResize() {
    const mark = () => { this.needsResize = true; };
    window.addEventListener('resize', mark);
    window.addEventListener('orientationchange', mark);
    if (window.ResizeObserver) {
      this._ro = new ResizeObserver(mark);
      this._ro.observe(this.wrapper);
    }
  }

  applyViewTransform() {
    this.ctx.setTransform(this.scaleX, 0, 0, this.scaleY, 0, 0);
  }

  // ==========================================================
  // Entrada
  // ==========================================================

  initInputs() {
    const blocked = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    const isTextInput = (el) => {
      if (!el) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (tag === 'INPUT') {
        const t = (el.type || 'text').toLowerCase();
        return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'file'].includes(t);
      }
      return false;
    };
    const isInteractiveFocus = (el, allowedIds = []) => {
      if (!el || el === document.body || el === this.wrapper) return false;
      if (el.id && allowedIds.includes(el.id)) return false;
      const tag = el.tagName;
      return tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.getAttribute('role') === 'button';
    };

    window.addEventListener('keydown', (e) => {
      const target = e.target || document.activeElement;
      if (isTextInput(target)) {
        if (e.code === 'Escape' && target.blur) target.blur();
        return;
      }

      if (this.state === 'PLAYING' && blocked.includes(e.code)) {
        e.preventDefault();
      }
      if (e.repeat) return;

      if (this.state === 'PLAYING') {
        this.input.down(e.code);
      }
      this.unlockAudioAndMenuMusic();

      // Modal de confirmação aberto captura Escape / Enter
      if (this._confirmResolver) {
        if (e.code === 'Escape') {
          e.preventDefault();
          this._resolveConfirm(false);
        }
        return;
      }

      if (e.code === 'KeyP') {
        if (this.state === 'PLAYING' || this.state === 'RESUMING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
      }

      if (e.code === 'KeyF') {
        e.preventDefault();
        this.toggleFullscreen();
      }

      if (e.code === 'Escape') {
        if (this.state === 'PLAYING' || this.state === 'RESUMING') {
          this.pauseGame();
        } else if (this.state === 'PAUSED') {
          this.resumeGame();
        } else if (this.state === 'FINISHING') {
          this._finishSeq = null;
          this.gameOver();
        } else if (this.state === 'SETTINGS') {
          if (window.soundSystem.playUI) window.soundSystem.playUI('back');
          this.closeSettings();
        } else if (this.state === 'CREATOR' && this.isCreatorCameraOpen && this.isCreatorCameraOpen()) {
          if (this.stopCreatorCamera) this.stopCreatorCamera();
        } else if (['SHOP', 'MISSIONS', 'SELECT_CHAR', 'CREATOR', 'LEADERBOARD', 'HOW_TO_PLAY'].includes(this.state)) {
          if (window.soundSystem.playUI) window.soundSystem.playUI('back');
          this.setState('MENU');
        }
      }

      if (e.code === 'KeyM') this.toggleMute();

      if (e.code === 'Enter') {
        const activeEl = document.activeElement;
        if (this.state === 'GAME_OVER') {
          if (!isInteractiveFocus(activeEl, ['btn-restart'])) {
            e.preventDefault();
            this.flushOnlineScoreIfNeeded();
            this.startPlay();
          }
        } else if (this.state === 'MENU') {
          if (!isInteractiveFocus(activeEl, ['btn-play'])) {
            e.preventDefault();
            this.startPlay();
          }
        } else if (this.state === 'SELECT_CHAR') {
          if (!isInteractiveFocus(activeEl, ['btn-select-and-play'])) {
            e.preventDefault();
            this.startPlay();
          }
        } else if (this.state === 'PAUSED') {
          if (!isInteractiveFocus(activeEl, ['btn-resume'])) {
            e.preventDefault();
            this.resumeGame();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => { this.input.up(e.code); });

    document.addEventListener('fullscreenchange', () => this.syncFullscreenButtons());
    document.addEventListener('webkitfullscreenchange', () => this.syncFullscreenButtons());

    // Perder o foco não pode virar morte na volta
    window.addEventListener('blur', () => {
      this.input.clear();
      if (this.state === 'PLAYING' || this.state === 'RESUMING') this.pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'PLAYING' || this.state === 'RESUMING')) this.pauseGame();
    });

    this.bindTouch('touch-accelerate', 'TouchAccelerate');
    this.bindTouch('touch-jump', 'Space');
    this.bindTouch('touch-duck', 'ArrowDown');
    this.bindTouch('touch-trick-1', 'KeyZ');
    this.bindTouch('touch-trick-2', 'KeyX');
    this.bindTouch('touch-trick-3', 'KeyC');
    this.bindTouch('desk-trick-1', 'KeyZ');
    this.bindTouch('desk-trick-2', 'KeyX');
    this.bindTouch('desk-trick-3', 'KeyC');
    this.bindCanvasSwipes();
  }

  /** Gestos touch (swipe para cima/baixo/direita) direto no canvas durante o jogo. */
  bindCanvasSwipes() {
    if (!this.canvas) return;
    let startX = 0, startY = 0, active = false;
    const pulseKey = (code, ms) => {
      this.input.down(code);
      const t = setTimeout(() => {
        this._swipeTimers.delete(t);
        this.input.up(code);
      }, ms);
      this._swipeTimers.add(t);
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      if (this.state !== 'PLAYING' || e.pointerType === 'mouse') return;
      active = true;
      startX = e.clientX;
      startY = e.clientY;
    }, { passive: true });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!active || this.state !== 'PLAYING') return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) < 28) return;
      active = false;
      window.soundSystem.init();
      if (Math.abs(dy) >= Math.abs(dx)) {
        if (dy < 0) pulseKey('Space', 180);
        else pulseKey('ArrowDown', 340);
      } else if (dx > 0) {
        pulseKey('TouchAccelerate', 420);
      }
    }, { passive: true });

    const cancel = () => { active = false; };
    this.canvas.addEventListener('pointerup', cancel, { passive: true });
    this.canvas.addEventListener('pointercancel', cancel, { passive: true });
  }

  bindTouch(id, code) {
    const btn = document.getElementById(id);
    if (!btn) return;

    const down = (e) => {
      e.preventDefault();
      window.soundSystem.init();
      btn.classList.add('is-pressed');
      if (this.state === 'PLAYING') this.input.down(code);
      if (document.activeElement === btn && btn.blur) btn.blur();
      if (btn.setPointerCapture && e.pointerId !== undefined) {
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      }
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      this.input.up(code);
      if (document.activeElement === btn && btn.blur) btn.blur();
    };

    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ==========================================================
  // Interface
  // ==========================================================

  initUI() {
    const on = (id, fn, soundKind = 'click', { blur = false } = {}) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => {
        this.unlockAudioAndMenuMusic();
        if (soundKind && window.soundSystem.playUI) window.soundSystem.playUI(soundKind);
        if (blur && el.blur) el.blur();
        fn();
      });
    };

    on('btn-play', () => this.startPlay());
    on('btn-select-char', () => this.showCharacterSelect());
    on('btn-character-creator', () => this.openCreator());
    on('btn-shop', () => this.showShop());
    on('btn-missions', () => this.showMissions());
    on('btn-footer-missions', () => this.showMissions());
    on('btn-gameover-shop', () => { this.flushOnlineScoreIfNeeded(); this.showShop(); });
    on('btn-leaderboard', () => this.showLeaderboard());
    on('btn-how-to-play', () => this.setState('HOW_TO_PLAY'));
    on('btn-settings-menu', () => this.openSettings('MENU'), 'click', { blur: true });
    on('btn-fullscreen-menu', () => this.toggleFullscreen(), 'click', { blur: true });
    on('btn-fullscreen-hud', () => this.toggleFullscreen(), 'click', { blur: true });
    on('btn-finish-free', () => this.finishFreeRun(), 'click', { blur: true });
    on('btn-pause-finish-free', () => this.finishFreeRun(), 'click', { blur: true });
    on('btn-pause-settings', () => this.openSettings('PAUSED'));
    on('btn-settings-fullscreen', () => this.toggleFullscreen());
    on('btn-settings-back', () => this.closeSettings(), 'back');
    on('btn-clear-leaderboard', () => this.clearLeaderboard(), 'back');
    on('btn-select-and-play', () => this.startPlay());
    on('btn-pause-hud', () => this.pauseGame(), 'click', { blur: true });
    on('btn-resume', () => this.resumeGame());
    on('btn-pause-restart', () => { this.bankCoinsIfNeeded(); this.startPlay(); });
    on('btn-pause-menu', () => this.setState('MENU'), 'back');
    on('btn-restart', () => { this.flushOnlineScoreIfNeeded(); this.startPlay(); });
    on('btn-gameover-menu', () => { this.flushOnlineScoreIfNeeded(); this.setState('MENU'); }, 'back');
    on('btn-mute-hud', () => this.toggleMute(), null, { blur: true });
    on('tab-lb-global', () => this.switchLeaderboardTab('global'));
    on('tab-lb-local', () => this.switchLeaderboardTab('local'));

    this.initSettingsControls();
    this.initConfirmModal();

    // Abas da Oficina & Loja
    document.querySelectorAll('[data-shop-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundSystem.init();
        if (window.soundSystem.playUI) window.soundSystem.playUI('click');
        this.shopTab = btn.dataset.shopTab || 'gear';
        document.querySelectorAll('[data-shop-tab]').forEach(b => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        this.renderShop();
      });
    });

    // Filtro de esporte no Placar
    document.querySelectorAll('#lb-sport-filter [data-lb-sport]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundSystem.init();
        if (window.soundSystem.playUI) window.soundSystem.playUI('click');
        this.leaderboardSportFilter = btn.dataset.lbSport || 'all';
        document.querySelectorAll('#lb-sport-filter [data-lb-sport]').forEach(b => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        this.renderLeaderboard(this._cachedLbContainer || 'main-leaderboard-list', this._cachedLeaderboardList);
      });
    });

    // Salvar / atualizar pontuação com nome no placar (apenas submit evita disparo duplo)
    const form = document.getElementById('form-save-score');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        window.soundSystem.init();
        this.saveScoreFromGameOver({ auto: false });
      });
    }

    document.querySelectorAll('.btn-back-menu').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundSystem.init();
        if (window.soundSystem.playUI) window.soundSystem.playUI('back');
        this.setState('MENU');
      });
    });

    this.syncMuteButton();
    this.initSportSelector();
    this.initModeAndStageSelectors();
    this.initCreator();
  }

  initModeAndStageSelectors() {
    const syncModeUI = () => {
      document.querySelectorAll('#mode-selector [data-mode]').forEach(b => {
        const active = (b.dataset.mode || 'classic') === this.selectedMode;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      const diffGroup = document.getElementById('difficulty-selector');
      if (diffGroup) {
        diffGroup.classList.toggle('is-muted', this.selectedMode !== 'classic');
      }
    };

    const syncDifficultyUI = () => {
      document.querySelectorAll('#difficulty-selector [data-difficulty]').forEach(b => {
        const active = (b.dataset.difficulty || 'easy') === this.selectedDifficulty;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    };

    document.querySelectorAll('#mode-selector [data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundSystem.init();
        if (window.soundSystem.playUI) window.soundSystem.playUI('click');
        this.selectedMode = btn.dataset.mode || 'classic';
        syncModeUI();
      });
    });

    document.querySelectorAll('#difficulty-selector [data-difficulty]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundSystem.init();
        if (window.soundSystem.playUI) window.soundSystem.playUI('click');
        this.selectedDifficulty = btn.dataset.difficulty === 'hard' ? 'hard' : 'easy';
        try { localStorage.setItem('luigi_skate_difficulty', this.selectedDifficulty); } catch (_) {}
        if (this.selectedMode !== 'classic') {
          this.selectedMode = 'classic';
          syncModeUI();
        }
        syncDifficultyUI();
      });
    });

    syncModeUI();
    syncDifficultyUI();

    document.querySelectorAll('#stage-selector [data-stage]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundSystem.init();
        const st = parseInt(btn.dataset.stage || '0', 10) || 0;
        const unlocked = window.progressionManager ? window.progressionManager.getUnlockedStageIndex() : 0;
        if (st > unlocked) {
          if (window.soundSystem.playUI) window.soundSystem.playUI('back');
          const stageObj = window.STAGES && window.STAGES[st];
          const distNeed = stageObj ? stageObj.dist : st * 600;
          this.showToast({
            icon: '🔒',
            title: `Fase ${st + 1} bloqueada`,
            subtitle: `Alcance ${formatNumber(distNeed)}m em uma corrida!`,
            info: true
          });
          return;
        }
        if (window.soundSystem.playUI) window.soundSystem.playUI('click');
        this.selectedStage = st;
        document.querySelectorAll('#stage-selector [data-stage]').forEach(b => {
          const active = b === btn;
          b.classList.toggle('active', active);
          b.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      });
    });
  }

  openCreator() {
    this.setState('CREATOR');
    if (this._refreshCreatorScreen) this._refreshCreatorScreen();
  }

  getSportInfo(sportId) {
    const id = sportId || this.selectedSport || 'skate';
    const src = (window.SPORTS && window.SPORTS[id]) || SPORT_FALLBACK[id] || SPORT_FALLBACK.skate;
    const fb = SPORT_FALLBACK[id] || SPORT_FALLBACK.skate;
    return {
      ...fb,
      ...src,
      tagline: src.tagline || fb.tagline,
      touchLabels: src.touchLabels || fb.touchLabels
    };
  }

  initSportSelector() {
    const buttons = document.querySelectorAll('#sport-selector .sport-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundSystem.init();
        if (window.soundSystem.playUI) window.soundSystem.playUI('click');
        this.selectSport(btn.dataset.sport || 'skate', true);
      });
    });
    this.selectSport(this.selectedSport, false);
  }

  selectSport(sportId, save = true) {
    const sport = this.getSportInfo(sportId);
    this.selectedSport = sport.id;
    if (save) {
      try { localStorage.setItem('luigi_skate_selected_sport', sport.id); } catch (_) {}
    }
    if (this.player && this.player.setSport) {
      this.player.setSport(sport.id);
    }

    document.querySelectorAll('#sport-selector .sport-btn').forEach(btn => {
      const active = btn.dataset.sport === sport.id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    const taglineEl = document.getElementById('sport-tagline');
    if (taglineEl) taglineEl.textContent = sport.tagline;

    const playIcon = document.getElementById('btn-play-icon');
    if (playIcon) playIcon.textContent = sport.icon;

    // Atualiza os rótulos dos botões de manobra (mobile e desktop) conforme o esporte
    const labels = sport.touchLabels || ['FLIP', '360°', 'GRAB'];
    ['touch-trick-1-label', 'touch-trick-2-label', 'touch-trick-3-label'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && labels[i]) el.textContent = labels[i];
    });
    ['desk-trick-1-label', 'desk-trick-2-label', 'desk-trick-3-label'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && labels[i]) el.textContent = labels[i];
    });
  }

  toggleMute() {
    window.soundSystem.init();
    window.soundSystem.toggleMute();
    this.syncMuteButton();
  }

  syncMuteButton() {
    const btn = document.getElementById('btn-mute-hud');
    if (btn) btn.textContent = window.soundSystem.muted ? '🔇' : '🔊';
  }

  initSettingsControls() {
    const musicSlider = document.getElementById('opt-music-vol');
    const sfxSlider = document.getElementById('opt-sfx-vol');
    const musicVal = document.getElementById('opt-music-val');
    const sfxVal = document.getElementById('opt-sfx-val');
    const vibCheck = document.getElementById('opt-vibration');

    const syncUI = () => {
      const mPct = Math.round(((window.soundSystem && window.soundSystem.getMusicVolume) ? window.soundSystem.getMusicVolume() : 0.7) * 100);
      const sPct = Math.round(((window.soundSystem && window.soundSystem.getSfxVolume) ? window.soundSystem.getSfxVolume() : 0.9) * 100);
      if (musicSlider) musicSlider.value = String(mPct);
      if (musicVal) musicVal.textContent = mPct + '%';
      if (sfxSlider) sfxSlider.value = String(sPct);
      if (sfxVal) sfxVal.textContent = sPct + '%';
      if (vibCheck) vibCheck.checked = this.vibrationEnabled;
      this.syncFullscreenButtons();
    };
    this._syncSettingsUI = syncUI;

    if (musicSlider) {
      musicSlider.addEventListener('input', () => {
        this.unlockAudioAndMenuMusic();
        const pct = Math.max(0, Math.min(100, parseInt(musicSlider.value, 10) || 0));
        if (musicVal) musicVal.textContent = pct + '%';
        if (window.soundSystem && window.soundSystem.setMusicVolume) {
          window.soundSystem.setMusicVolume(pct / 100);
        }
      });
    }
    if (sfxSlider) {
      sfxSlider.addEventListener('input', () => {
        window.soundSystem.init();
        const pct = Math.max(0, Math.min(100, parseInt(sfxSlider.value, 10) || 0));
        if (sfxVal) sfxVal.textContent = pct + '%';
        if (window.soundSystem && window.soundSystem.setSfxVolume) {
          window.soundSystem.setSfxVolume(pct / 100);
        }
      });
      sfxSlider.addEventListener('change', () => {
        window.soundSystem?.playUI?.('click');
      });
    }
    if (vibCheck) {
      vibCheck.addEventListener('change', () => {
        this.vibrationEnabled = !!vibCheck.checked;
        try { localStorage.setItem('luigi_skate_vibration_v1', String(this.vibrationEnabled)); } catch (_) {}
        if (this.vibrationEnabled) this.haptic(25);
      });
    }
    syncUI();
  }

  openSettings(returnState = 'MENU') {
    this._settingsReturnState = returnState === 'PAUSED' ? 'PAUSED' : 'MENU';
    if (this._syncSettingsUI) this._syncSettingsUI();
    this.setState('SETTINGS');
  }

  closeSettings() {
    const dest = this._settingsReturnState === 'PAUSED' ? 'PAUSED' : 'MENU';
    this.setState(dest);
  }

  initConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');
    if (!modal || !okBtn || !cancelBtn) return;

    okBtn.addEventListener('click', () => {
      window.soundSystem?.playUI?.('click');
      this._resolveConfirm(true);
    });
    cancelBtn.addEventListener('click', () => {
      window.soundSystem?.playUI?.('back');
      this._resolveConfirm(false);
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        window.soundSystem?.playUI?.('back');
        this._resolveConfirm(false);
      }
    });
  }

  _resolveConfirm(result) {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.hidden = true;
    const resolver = this._confirmResolver;
    this._confirmResolver = null;
    if (typeof resolver === 'function') resolver(!!result);
  }

  confirmDialog({ icon = '⚠️', title = 'Confirmar', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
    const modal = document.getElementById('confirm-modal');
    const iconEl = document.getElementById('confirm-icon');
    const titleEl = document.getElementById('confirm-title');
    const msgEl = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok');
    const cancelBtn = document.getElementById('confirm-cancel');

    if (!modal || !okBtn || !cancelBtn) {
      return Promise.resolve(typeof window.confirm === 'function' ? window.confirm(message || title) : false);
    }

    if (this._confirmResolver) this._resolveConfirm(false);
    if (iconEl) iconEl.textContent = icon;
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    okBtn.className = 'btn btn-sm ' + (danger ? 'btn-danger' : 'btn-primary');
    modal.hidden = false;
    setTimeout(() => cancelBtn.focus(), 0);

    return new Promise((resolve) => {
      this._confirmResolver = resolve;
    });
  }

  initGamepadListeners() {
    if (typeof window === 'undefined' || !navigator.getGamepads) return;
    window.addEventListener('gamepadconnected', () => {
      if (!this._gamepadToastShown) {
        this._gamepadToastShown = true;
        this.showToast({
          icon: '🎮',
          title: 'Controle conectado!',
          subtitle: 'A: Pular · X/Y/B: Manobras · Start: Jogar',
          info: true
        });
      }
    });
  }

  pollGamepad() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
    let pads;
    try { pads = navigator.getGamepads(); } catch (_) { return; }
    if (!pads) return;
    let gp = null;
    for (let i = 0; i < pads.length; i++) {
      if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    }
    if (!gp) return;

    const btn = (idx) => !!(gp.buttons && gp.buttons[idx] && gp.buttons[idx].pressed);
    const ax0 = (gp.axes && gp.axes[0]) || 0;
    const ax1 = (gp.axes && gp.axes[1]) || 0;

    const nowState = {
      Space:      btn(0) || btn(12),          // A / Cross / D-Pad Up
      ArrowDown:  btn(13) || ax1 > 0.55,      // D-Pad Down / Analógico baixo
      ArrowRight: btn(15) || ax0 > 0.45,      // D-Pad Right / Analógico dir
      ArrowLeft:  btn(14) || ax0 < -0.45,     // D-Pad Left / Analógico esq
      KeyZ:       btn(2) || btn(4),           // X / Square / LB
      KeyX:       btn(3) || btn(5),           // Y / Triangle / RB
      KeyC:       btn(1) || btn(6) || btn(7), // B / Circle / LT / RT
      Start:      btn(9)                      // Start / Options
    };

    const prev = this._gamepadPrev;

    if (nowState.Start && !prev.Start) {
      this.unlockAudioAndMenuMusic();
      if (this.state === 'PLAYING' || this.state === 'RESUMING') this.pauseGame();
      else if (this.state === 'PAUSED') this.resumeGame();
      else if (this.state === 'MENU' || this.state === 'GAME_OVER' || this.state === 'SELECT_CHAR') this.startPlay();
    }

    const mappedKeys = ['Space', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'KeyZ', 'KeyX', 'KeyC'];
    for (const k of mappedKeys) {
      if (nowState[k] && !prev[k]) {
        this.unlockAudioAndMenuMusic();
        if (this.state === 'PLAYING') this.input.down(k);
      } else if (!nowState[k] && prev[k]) {
        this.input.up(k);
      }
    }

    this._gamepadPrev = nowState;
  }

  setState(state) {
    const prevState = this.state;

    // Garante envio automático da pontuação online ao sair da tela de Fim de Jogo por qualquer caminho
    if (prevState === 'GAME_OVER' && state !== 'GAME_OVER') {
      this.flushOnlineScoreIfNeeded();
    }

    // Ao sair da partida (via Pausa ou diretamente) para o Menu, salva moedas coletadas (ex.: Treino Livre)
    if ((prevState === 'PLAYING' || prevState === 'PAUSED' || prevState === 'RESUMING' || prevState === 'FINISHING') && state === 'MENU') {
      this.bankCoinsIfNeeded(true);
      this.clearGameplayTimersAndOverlays({ clearToasts: false });
    }

    if (state !== 'RESUMING') this.cancelResumeCountdown();
    if (state !== 'FINISHING') this._finishSeq = null;
    if (state !== 'GAME_OVER' && this._countAnimRaf) {
      cancelAnimationFrame(this._countAnimRaf);
      this._countAnimRaf = null;
    }

    this.state = state;
    this.wrapper.dataset.state = (state === 'RESUMING' || state === 'FINISHING') ? 'PLAYING' : state;

    const screens = {
      LOADING:      'screen-loading',
      MENU:         'screen-menu',
      SHOP:         'screen-shop',
      MISSIONS:     'screen-missions',
      SELECT_CHAR:  'screen-character-select',
      CREATOR:      'screen-character-creator',
      LEADERBOARD:  'screen-leaderboard',
      HOW_TO_PLAY:  'screen-how-to-play',
      SETTINGS:     'screen-settings',
      PAUSED:       'screen-pause',
      GAME_OVER:    'screen-game-over',
      PLAYING:      null,
      RESUMING:     null,
      FINISHING:    null
    };

    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = screens[state];
    if (target) {
      const targetEl = document.getElementById(target);
      if (targetEl) {
        targetEl.classList.remove('hidden');
        targetEl.scrollTop = 0;
      }
    }

    if (state !== 'CREATOR' && this.stopCreatorCamera) {
      this.stopCreatorCamera();
    }

    if (state === 'MENU') {
      if (window.soundSystem) {
        if (window.soundSystem.silenceLoops) window.soundSystem.silenceLoops();
        if (this._audioUnlocked && typeof window.soundSystem.startMenuMusic === 'function') {
          window.soundSystem.startMenuMusic();
        } else if (window.soundSystem.stopMusic) {
          window.soundSystem.stopMusic();
        }
      }
      // Recompõe a cena de fundo limpa ao voltar de uma partida pausada ou encerrada
      if (prevState === 'PAUSED' || prevState === 'GAME_OVER' || prevState === 'PLAYING' || prevState === 'RESUMING' || prevState === 'FINISHING') {
        this.world.reset();
        if (this.player.setSport) this.player.setSport(this.selectedSport);
        this.player.reset(this.world);
        this.camera.reset();
        if (window.particleSystem && window.particleSystem.clear) window.particleSystem.clear();
      }
      this.refreshMenuInfo();
      delete this.wrapper.dataset.speedFx;
      delete this.wrapper.dataset.fever;
    }
  }

  refreshMenuInfo() {
    const hs = document.getElementById('menu-highscore');
    const cc = document.getElementById('menu-current-char');
    if (hs) hs.textContent = formatNumber(this.highScore);
    const char = window.characterManager.getSelected();
    if (cc && char) cc.textContent = char.name;

    const pm = window.progressionManager;
    if (pm) {
      const coinsEl = document.getElementById('menu-coins');
      const rankEl = document.getElementById('menu-rank');
      const rankTitleEl = document.getElementById('menu-rank-title');
      const multEl = document.getElementById('menu-mult');
      const misEl = document.getElementById('menu-missions-summary');
      const dotEl = document.getElementById('shop-notif-dot');

      if (coinsEl) coinsEl.textContent = formatNumber(pm.getCoins());
      if (rankEl) rankEl.textContent = String(pm.getRankLevel());
      if (rankTitleEl) rankTitleEl.textContent = pm.getRankTitle();
      if (multEl) multEl.textContent = 'x' + pm.getScoreMultiplier().toFixed(1) + ' pts';
      if (misEl) {
        const doneCount = (pm.data.activeMissions || []).filter(m => m.done).length;
        misEl.textContent = `${doneCount}/3`;
      }
      if (dotEl) dotEl.hidden = !pm.canAffordAnyNewItem();

      const unlocked = pm.getUnlockedStageIndex();
      if (this.selectedStage > unlocked) this.selectedStage = 0;
      document.querySelectorAll('#stage-selector [data-stage]').forEach(btn => {
        const st = parseInt(btn.dataset.stage || '0', 10) || 0;
        const locked = st > unlocked;
        const active = st === this.selectedStage;
        btn.classList.toggle('is-locked', locked);
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }
  }

  // ==========================================================
  // Oficina & Loja + Missões & Troféus
  // ==========================================================

  showShop(tabOverride) {
    if (tabOverride) {
      this.shopTab = tabOverride;
      document.querySelectorAll('[data-shop-tab]').forEach(b => {
        const active = b.dataset.shopTab === this.shopTab;
        b.classList.toggle('active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
    }
    this.setState('SHOP');
    this.renderShop();
  }

  renderShop() {
    const pm = window.progressionManager;
    const cat = window.SHOP_CATALOG;
    const grid = document.getElementById('shop-grid');
    const coinsEl = document.getElementById('shop-coins');
    if (!pm || !cat || !grid) return;
    if (coinsEl) coinsEl.textContent = formatNumber(pm.getCoins());

    const playUnlockSound = () => {
      if (!window.soundSystem) return;
      if (typeof window.soundSystem.playChestOpen === 'function') window.soundSystem.playChestOpen();
      else if (typeof window.soundSystem.playPowerup === 'function') window.soundSystem.playPowerup();
    };

    const tab = this.shopTab || 'gear';
    grid.innerHTML = '';

    if (tab === 'upgrades') {
      cat.upgrades.forEach(upg => {
        const lvl = pm.getUpgradeLevel(upg.id);
        const maxLvl = upg.costs.length;
        const isMax = lvl >= maxLvl;
        const cost = isMax ? 0 : upg.costs[lvl];
        const canBuy = !isMax && pm.getCoins() >= cost;

        const card = document.createElement('div');
        card.className = 'shop-card' + (!isMax && cost >= 1600 ? ' shop-card--legendary' : '');
        let pipsHtml = '';
        for (let i = 0; i < maxLvl; i++) {
          pipsHtml += `<span class="${i < lvl ? 'on' : ''}"></span>`;
        }
        card.innerHTML = `
          <div class="shop-card-top">
            <span class="shop-card-icon">${upg.icon}</span>
            <span class="leaderboard-badge">Nv. ${lvl}/${maxLvl}</span>
          </div>
          <h4>${escapeHtml(upg.name)}</h4>
          <p>${escapeHtml(upg.desc)}</p>
          <div class="shop-level-pips">${pipsHtml}</div>
          <button type="button" class="btn btn-sm ${isMax ? 'btn-quiet' : (canBuy ? 'btn-primary' : 'btn-ghost')}" ${isMax || !canBuy ? 'disabled' : ''}>
            ${isMax ? 'Nível Máximo ✓' : `Melhorar · ${formatNumber(cost)} 🪙`}
          </button>
        `;
        const btn = card.querySelector('button');
        if (btn && !isMax) {
          btn.addEventListener('click', () => {
            const res = pm.buyUpgrade(upg.id);
            if (res.ok) {
              playUnlockSound();
              if (res.notifications?.length) this.onProgressionNotifications(res.notifications);
              this.renderShop();
            }
          });
        }
        grid.appendChild(card);
      });
      return;
    }

    const items = cat[tab] || [];
    items.forEach(item => {
      const owned = pm.isOwned(tab, item.id);
      let equipped = false;
      if (tab === 'gear') equipped = pm.data.equipped.gear === item.id;
      else if (tab === 'trails') equipped = pm.data.equipped.trail === item.id;
      else if (tab === 'accessories') equipped = pm.data.equipped.accessory === item.id;
      else if (tab === 'characters') equipped = window.characterManager.selectedId === item.id;

      const canBuy = pm.getCoins() >= item.price;
      const isLegendary = item.price >= 1800;
      const card = document.createElement('div');
      card.className = 'shop-card' + (isLegendary ? ' shop-card--legendary' : '') + (equipped ? ' is-equipped' : '');

      let swatchHtml = '';
      if (tab === 'gear') {
        swatchHtml = `<div class="shop-swatch-bar">
          <span class="shop-swatch-dot" style="background:${item.primary}"></span>
          <span class="shop-swatch-dot" style="background:${item.secondary}"></span>
          <span class="shop-swatch-dot" style="background:${item.accent}"></span>
        </div>`;
      } else if (tab === 'trails' && item.colors) {
        swatchHtml = `<div class="shop-swatch-bar">${item.colors.slice(0, 4).map(c => `<span class="shop-swatch-dot" style="background:rgb(${c})"></span>`).join('')}</div>`;
      }

      let btnLabel = `Comprar · ${formatNumber(item.price)} 🪙`;
      let btnClass = canBuy ? 'btn-primary' : 'btn-ghost';
      let disabled = !owned && !canBuy;
      if (equipped) {
        btnLabel = 'Equipado ✓';
        btnClass = 'btn-quiet';
        disabled = true;
      } else if (owned) {
        btnLabel = tab === 'characters' ? 'Selecionar' : 'Equipar';
        btnClass = 'btn-ghost';
        disabled = false;
      }

      card.innerHTML = `
        <div class="shop-card-top">
          <span class="shop-card-icon">${item.icon || '✨'}</span>
          ${swatchHtml}
        </div>
        <h4>${escapeHtml(item.name)}</h4>
        <p>${escapeHtml(item.desc || '')}</p>
        <button type="button" class="btn btn-sm ${btnClass}" ${disabled ? 'disabled' : ''}>${btnLabel}</button>
      `;

      const btn = card.querySelector('button');
      if (btn && !disabled) {
        btn.addEventListener('click', () => {
          const res = pm.buyItem(tab, item.id);
          if (res.ok) {
            if (tab === 'characters') {
              window.characterManager.select(item.id);
            }
            if (owned) window.soundSystem.playCoin();
            else playUnlockSound();
            if (res.notifications?.length) this.onProgressionNotifications(res.notifications);
            this.renderShop();
          }
        });
      }
      grid.appendChild(card);
    });
  }

  showMissions() {
    this.setState('MISSIONS');
    this.renderMissions();
  }

  renderMissions() {
    const pm = window.progressionManager;
    if (!pm) return;

    const rankEl = document.getElementById('missions-rank-label');
    const multEl = document.getElementById('missions-mult-label');
    const chestEl = document.getElementById('missions-chest-progress');
    const listEl = document.getElementById('missions-list');
    const achEl = document.getElementById('achievements-list');

    const missions = pm.data.activeMissions || [];
    const doneCount = missions.filter(m => m.done).length;

    if (rankEl) rankEl.textContent = `Nível ${pm.getRankLevel()} · ${pm.getRankTitle()}`;
    if (multEl) multEl.textContent = `Multiplicador permanente: x${pm.getScoreMultiplier().toFixed(1)} pontos`;
    if (chestEl) chestEl.textContent = `${doneCount} de 3 missões concluídas`;

    if (listEl) {
      listEl.innerHTML = missions.map(m => {
        const pct = Math.min(100, Math.round(((m.progress || 0) / Math.max(1, m.target)) * 100));
        return `
          <div class="mission-card ${m.done ? 'is-done' : ''}">
            <div class="mission-info">
              <strong>${m.done ? '✅ ' : '🎯 '}${escapeHtml(m.label)} (${Math.floor(m.progress || 0)}/${m.target})</strong>
              <div class="mission-progress-bar"><i style="width:${pct}%"></i></div>
            </div>
            <span class="mission-reward">${m.done ? 'Concluída!' : `+${m.reward} 🪙`}</span>
          </div>
        `;
      }).join('');
    }

    if (achEl && window.ACHIEVEMENTS_CATALOG) {
      achEl.innerHTML = window.ACHIEVEMENTS_CATALOG.map(a => {
        const unlocked = !!(pm.data.achievements && pm.data.achievements[a.id]);
        return `
          <div class="achievement-card ${unlocked ? 'unlocked' : ''}">
            <span class="ach-icon">${unlocked ? a.icon : '🔒'}</span>
            <div>
              <strong>${escapeHtml(a.name)}</strong>
              <small>${escapeHtml(a.desc)} (+${a.reward} 🪙)</small>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  showCharacterSelect() {
    this.setState('SELECT_CHAR');
    this.renderCharacterCards();
  }

  renderCharacterCards() {
    const grid = document.getElementById('characters-list');
    grid.innerHTML = '';

    window.characterManager.characters.forEach(char => {
      const unlocked = window.characterManager.isCharacterUnlocked(char.id);
      const card = document.createElement('div');
      card.className = 'char-card'
        + (char.id === window.characterManager.selectedId ? ' selected' : '')
        + (!unlocked ? ' is-locked' : '');

      const stats = char.stats || {};
      const fallbackSrc = (char.sprites && char.sprites.skate) || 'assets/portraits/portrait_luigi_3d.png';
      const shopEntry = window.SHOP_CATALOG && Array.isArray(window.SHOP_CATALOG.characters)
        ? window.SHOP_CATALOG.characters.find(c => c.id === char.id)
        : null;
      const unlockPrice = (shopEntry && shopEntry.price) || char.unlockPrice || 750;
      const badgeText = unlocked ? (char.badge || 'Skatista') : `🔒 ${formatNumber(unlockPrice)} 🪙 na Oficina`;

      card.innerHTML = `
        <span class="char-check">✓</span>
        ${char.isCustom ? '<button type="button" class="char-delete" title="Remover personagem" aria-label="Remover personagem">✕</button>' : ''}
        <img class="char-avatar" src="${escapeHtml(char.portrait || fallbackSrc)}" alt="${escapeHtml(char.name)}"
             onerror="this.onerror=null;this.src='${escapeHtml(fallbackSrc)}'">
        <div class="char-name">${escapeHtml(char.name)}</div>
        <div class="char-badge">${escapeHtml(badgeText)}</div>
        <div class="char-desc">${escapeHtml(char.description || '')}</div>
        <div class="char-stats">
          <div class="char-stat"><span>Visual</span><b>${escapeHtml(stats.visual || stats.velocidade || 'Rig 3D')}</b></div>
          <div class="char-stat"><span>Combina</span><b>${escapeHtml(stats.favorito || stats.salto || '🛹 Skate')}</b></div>
          <div class="char-stat"><span>Estilo</span><b>${escapeHtml(stats.estilo || stats.manobras || 'Radical')}</b></div>
        </div>
      `;

      card.addEventListener('click', () => {
        if (!unlocked) {
          this.showShop('characters');
          return;
        }
        window.characterManager.select(char.id);
        window.soundSystem.playCoin();
        this.renderCharacterCards();
      });

      const del = card.querySelector('.char-delete');
      if (del) {
        del.addEventListener('click', async (e) => {
          e.stopPropagation();
          const ok = await this.confirmDialog({
            icon: '🗑️',
            title: 'Remover personagem?',
            message: `Tem certeza que deseja apagar "${char.name}" da sua lista?`,
            confirmText: 'Remover',
            cancelText: 'Manter',
            danger: true
          });
          if (ok) {
            window.characterManager.deleteCustomCharacter(char.id);
            this.renderCharacterCards();
          }
        });
      }

      grid.appendChild(card);
    });
  }

  initCreator() {
    const fileInput = document.getElementById('custom-char-file');
    const dropArea = document.getElementById('creator-drop-area');
    const preview = document.getElementById('preview-character-img');
    const dragHint = document.getElementById('creator-drag-hint');
    const prompt = document.getElementById('creator-upload-prompt');
    const nameInput = document.getElementById('custom-char-name');
    const faceXInput = document.getElementById('custom-face-x');
    const faceYInput = document.getElementById('custom-face-y');
    const zoomInput = document.getElementById('custom-face-zoom');
    const flipInput = document.getElementById('custom-face-flip');
    const helmetInput = document.getElementById('custom-use-helmet');
    const fullPhotoInput = document.getElementById('custom-full-photo');
    const saveBtn = document.getElementById('btn-save-custom-char');

    const btnGallery = document.getElementById('btn-creator-gallery');
    const btnCamera = document.getElementById('btn-creator-camera');
    const btnNoPhoto = document.getElementById('btn-creator-nophoto');
    const cameraBox = document.getElementById('creator-camera-box');
    const cameraVideo = document.getElementById('creator-camera-video');
    const cameraError = document.getElementById('creator-camera-error');
    const btnCapture = document.getElementById('btn-camera-capture');
    const btnFlipCam = document.getElementById('btn-camera-flip');
    const btnCancelCam = document.getElementById('btn-camera-cancel');
    const fullBodyPreview = document.getElementById('preview-fullbody-img');
    const photoSlidersBox = document.getElementById('creator-photo-sliders');

    const skinRow = document.getElementById('creator-skin-row');
    const outfitRow = document.getElementById('creator-outfit-row');
    const hairRow = document.getElementById('creator-hair-row');
    const accRow = document.getElementById('creator-accessory-row');

    let loadedRawImg = null;
    let cameraStream = null;
    let cameraRequestId = 0;
    let facingMode = 'user';

    const customState = {
      headSize: 'large',
      gender: 'boy',
      skinTone: 'fair',
      outfit: 'street_blue',
      hairColor: 'brown',
      accessory: 'none'
    };

    const showCameraError = (msg) => {
      if (!cameraError) return;
      if (!msg) {
        cameraError.hidden = true;
        cameraError.textContent = '';
      } else {
        cameraError.textContent = msg;
        cameraError.hidden = false;
      }
    };

    const stopStreamTracks = (stream) => {
      if (!stream) return;
      stream.getTracks().forEach(t => { try { t.stop(); } catch (_) {} });
    };

    const stopCamera = () => {
      cameraRequestId++;
      if (cameraStream) {
        stopStreamTracks(cameraStream);
        cameraStream = null;
      }
      if (cameraVideo) cameraVideo.srcObject = null;
      if (cameraBox) cameraBox.hidden = true;
      if (dropArea) dropArea.hidden = false;
    };
    this.stopCreatorCamera = stopCamera;
    this.isCreatorCameraOpen = () => !!(cameraStream || (cameraBox && !cameraBox.hidden));
    window.addEventListener('pagehide', stopCamera);

    const startCamera = async () => {
      showCameraError('');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (window.location && window.location.protocol === 'file:') {
          showCameraError('Para usar a câmera no computador, abra o jogo pelo JOGAR.bat (localhost) ou pelo link HTTPS. Você ainda pode usar "Escolher foto"!');
        } else {
          showCameraError('Câmera não disponível neste navegador. Use "Escolher foto" ou abra em HTTPS/localhost.');
        }
        return;
      }
      stopCamera();
      const reqId = ++cameraRequestId;
      let stream = null;
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
            audio: false
          });
        } catch (firstErr) {
          const fname = (firstErr && firstErr.name) || '';
          if (fname === 'NotAllowedError' || fname === 'PermissionDeniedError' || fname === 'NotFoundError' || fname === 'DevicesNotFoundError') {
            throw firstErr;
          }
          // Fallback universal para webcams de PC/notebook que rejeitam facingMode/resolução
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        // Se o jogador saiu do Estúdio ou cancelou enquanto aguardava a permissão, encerra o stream imediatamente!
        if (reqId !== cameraRequestId || this.state !== 'CREATOR') {
          stopStreamTracks(stream);
          return;
        }
        cameraStream = stream;

        if (cameraBox) cameraBox.hidden = false;
        if (dropArea) dropArea.hidden = true;

        if (cameraVideo) {
          cameraVideo.srcObject = cameraStream;
          await new Promise((resolve) => {
            if (cameraVideo.readyState >= 1) { resolve(); return; }
            const onReady = () => {
              cameraVideo.removeEventListener('loadedmetadata', onReady);
              resolve();
            };
            cameraVideo.addEventListener('loadedmetadata', onReady);
            setTimeout(resolve, 1200);
          });
          if (reqId !== cameraRequestId || this.state !== 'CREATOR') {
            stopCamera();
            return;
          }
          await cameraVideo.play().catch(() => {});
        }
      } catch (err) {
        if (stream) stopStreamTracks(stream);
        stopCamera();
        if (this.state !== 'CREATOR') return;
        const name = (err && err.name) || '';
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          showCameraError('Permissão da câmera negada. Libere o acesso à câmera no navegador ou clique em "Escolher foto".');
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          showCameraError('Nenhuma câmera foi encontrada neste computador. Clique em "Escolher foto".');
        } else if (name === 'NotReadableError' || name === 'TrackStartError') {
          showCameraError('A câmera está sendo usada por outro programa. Feche o outro app ou use "Escolher foto".');
        } else {
          showCameraError('Não foi possível abrir a câmera agora. Use "Escolher foto".');
        }
      }
    };

    const getOptions = () => ({
      faceOffsetX: faceXInput ? parseFloat(faceXInput.value) || 0 : 0,
      faceOffsetY: faceYInput ? parseFloat(faceYInput.value) || 0 : 0,
      faceZoom: zoomInput ? parseFloat(zoomInput.value) || 1.15 : 1.15,
      faceFlipX: flipInput ? !!flipInput.checked : false,
      useHelmet: helmetInput ? !!helmetInput.checked : true,
      fullPhoto: fullPhotoInput ? !!fullPhotoInput.checked : false,
      headSize: customState.headSize,
      gender: customState.gender,
      skinTone: customState.skinTone,
      outfit: customState.outfit,
      hairColor: customState.hairColor,
      accessory: customState.accessory
    });

    const syncSliderState = () => {
      const isFull = fullPhotoInput && fullPhotoInput.checked && !!loadedRawImg;
      [faceXInput, faceYInput, zoomInput].forEach(inp => {
        if (inp && inp.parentElement) inp.parentElement.classList.toggle('is-disabled', !!isFull || !loadedRawImg);
      });
      if (helmetInput && helmetInput.parentElement) {
        helmetInput.parentElement.classList.toggle('is-disabled', !!isFull);
      }
      if (fullPhotoInput && fullPhotoInput.parentElement) {
        fullPhotoInput.parentElement.classList.toggle('is-disabled', !loadedRawImg);
      }
      if (photoSlidersBox) {
        photoSlidersBox.classList.toggle('is-no-photo', !loadedRawImg);
      }
      if (dragHint) dragHint.hidden = !loadedRawImg || !!isFull;
    };

    const refreshPreview = () => {
      syncSliderState();
      const opts = getOptions();
      if (fullBodyPreview && window.characterManager.buildFullBodyPreview) {
        try {
          fullBodyPreview.src = window.characterManager.buildFullBodyPreview(loadedRawImg, opts);
        } catch (_) {}
      }
      if (!loadedRawImg) {
        preview.hidden = true;
        prompt.style.display = '';
        dropArea.classList.remove('has-photo');
        return;
      }
      try {
        preview.src = window.characterManager.buildCreatorPreview(loadedRawImg, opts);
      } catch (_) {
        preview.src = loadedRawImg.src || '';
      }
      preview.hidden = false;
      prompt.style.display = 'none';
      dropArea.classList.add('has-photo');
    };

    // Popula botões de cor da pele, roupa, cabelo e acessórios desbloqueados
    const pal = window.CHAR_CUSTOMIZATION;
    if (pal && skinRow) {
      skinRow.innerHTML = '';
      pal.SKIN_TONES.forEach(s => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch-btn' + (customState.skinTone === s.id ? ' active' : '');
        b.style.background = s.hex;
        b.title = s.name;
        b.addEventListener('click', () => {
          customState.skinTone = s.id;
          skinRow.querySelectorAll('.swatch-btn').forEach(x => x.classList.toggle('active', x === b));
          refreshPreview();
        });
        skinRow.appendChild(b);
      });
    }
    if (pal && outfitRow) {
      outfitRow.innerHTML = '';
      pal.OUTFITS.forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch-btn' + (customState.outfit === o.id ? ' active' : '');
        b.style.background = `linear-gradient(135deg, ${o.top} 55%, ${o.topAccent} 55%)`;
        b.title = o.name;
        b.addEventListener('click', () => {
          customState.outfit = o.id;
          outfitRow.querySelectorAll('.swatch-btn').forEach(x => x.classList.toggle('active', x === b));
          refreshPreview();
        });
        outfitRow.appendChild(b);
      });
    }
    if (pal && hairRow) {
      hairRow.innerHTML = '';
      pal.HAIR_COLORS.forEach(h => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'swatch-btn' + (customState.hairColor === h.id ? ' active' : '');
        b.style.background = h.hex;
        b.title = h.name;
        b.addEventListener('click', () => {
          customState.hairColor = h.id;
          hairRow.querySelectorAll('.swatch-btn').forEach(x => x.classList.toggle('active', x === b));
          refreshPreview();
        });
        hairRow.appendChild(b);
      });
    }

    const refreshCreatorAccessories = () => {
      if (!accRow || !window.SHOP_CATALOG) return;
      const pm = window.progressionManager;
      accRow.innerHTML = '';
      const list = window.SHOP_CATALOG.accessories.filter(a => !pm || pm.isOwned('accessories', a.id));
      if (!list.some(a => a.id === customState.accessory)) customState.accessory = 'none';
      list.forEach(a => {
        const b = document.createElement('button');
        b.type = 'button';
        const active = customState.accessory === a.id;
        b.className = 'pill-opt' + (active ? ' active' : '');
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
        b.title = a.name;
        const shortName = a.id === 'none' ? 'Nenhum' : a.name.split(' ')[0];
        b.textContent = `${a.icon} ${shortName}`;
        b.addEventListener('click', () => {
          customState.accessory = a.id;
          accRow.querySelectorAll('.pill-opt').forEach(x => {
            const isSel = x === b;
            x.classList.toggle('active', isSel);
            x.setAttribute('aria-pressed', isSel ? 'true' : 'false');
          });
          refreshPreview();
        });
        accRow.appendChild(b);
      });
    };

    document.querySelectorAll('#creator-headsize-row [data-headsize]').forEach(b => {
      b.addEventListener('click', () => {
        customState.headSize = b.dataset.headsize || 'large';
        document.querySelectorAll('#creator-headsize-row [data-headsize]').forEach(x => {
          const isSel = x === b;
          x.classList.toggle('active', isSel);
          x.setAttribute('aria-pressed', isSel ? 'true' : 'false');
        });
        refreshPreview();
      });
    });

    document.querySelectorAll('#creator-gender-row [data-gender]').forEach(b => {
      b.addEventListener('click', () => {
        customState.gender = b.dataset.gender || 'boy';
        document.querySelectorAll('#creator-gender-row [data-gender]').forEach(x => {
          const isSel = x === b;
          x.classList.toggle('active', isSel);
          x.setAttribute('aria-pressed', isSel ? 'true' : 'false');
        });
        refreshPreview();
      });
    });

    if (btnNoPhoto) {
      btnNoPhoto.addEventListener('click', () => {
        stopCamera();
        loadedRawImg = null;
        if (fileInput) fileInput.value = '';
        if (fullPhotoInput) fullPhotoInput.checked = false;
        refreshPreview();
      });
    }

    this._refreshCreatorScreen = () => {
      refreshCreatorAccessories();
      refreshPreview();
    };

    const setRawImage = (img) => {
      loadedRawImg = img;
      showCameraError('');
      refreshPreview();
    };

    const openFilePicker = () => {
      stopCamera();
      showCameraError('');
      if (!fileInput) return;
      // Limpar antes permite reenviar o mesmo arquivo se o usuário quiser
      fileInput.value = '';
      fileInput.click();
    };

    const showPreviewFile = (file) => {
      if (!file) return;
      const isImage = (file.type && file.type.startsWith('image/'))
        || /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(file.name || '');
      if (!isImage) {
        showCameraError('Escolha um arquivo de imagem válido (JPG, PNG ou WEBP).');
        return;
      }
      stopCamera();
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => setRawImage(img);
        img.onerror = () => showCameraError('Não foi possível ler esta imagem. Tente outro arquivo JPG ou PNG.');
        img.src = e.target.result;
      };
      reader.onerror = () => showCameraError('Erro ao carregar o arquivo selecionado.');
      reader.readAsDataURL(file);
    };

    // Botões de origem (galeria e câmera)
    if (btnGallery) btnGallery.addEventListener('click', openFilePicker);
    if (btnCamera) btnCamera.addEventListener('click', () => startCamera());
    if (btnCancelCam) btnCancelCam.addEventListener('click', () => stopCamera());
    if (btnFlipCam) {
      btnFlipCam.addEventListener('click', () => {
        facingMode = facingMode === 'user' ? 'environment' : 'user';
        startCamera();
      });
    }
    if (btnCapture) {
      btnCapture.addEventListener('click', () => {
        if (!cameraVideo || !cameraVideo.videoWidth) {
          showCameraError('Aguarde a imagem da câmera aparecer antes de capturar.');
          return;
        }
        const snap = document.createElement('canvas');
        snap.width = cameraVideo.videoWidth;
        snap.height = cameraVideo.videoHeight;
        const sctx = snap.getContext('2d');
        sctx.drawImage(cameraVideo, 0, 0, snap.width, snap.height);
        stopCamera();
        const img = new Image();
        img.onload = () => setRawImage(img);
        img.src = snap.toDataURL('image/png');
      });
    }

    // Sliders e checkboxes
    [faceXInput, faceYInput, zoomInput].forEach(el => {
      if (el) el.addEventListener('input', refreshPreview);
    });
    [flipInput, helmetInput, fullPhotoInput].forEach(el => {
      if (el) el.addEventListener('change', refreshPreview);
    });
    syncSliderState();

    // Arrastar com dedo ou mouse direto na prévia para centralizar o rosto
    let dragging = false;
    let dragStartX = 0, dragStartY = 0, startOffX = 0, startOffY = 0;

    dropArea.addEventListener('pointerdown', (e) => {
      if (!loadedRawImg || (fullPhotoInput && fullPhotoInput.checked)) return;
      dragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      startOffX = faceXInput ? parseFloat(faceXInput.value) || 0 : 0;
      startOffY = faceYInput ? parseFloat(faceYInput.value) || 0 : 0;
      dropArea.classList.add('is-dragging');
      if (dropArea.setPointerCapture && e.pointerId !== undefined) {
        try { dropArea.setPointerCapture(e.pointerId); } catch (_) {}
      }
    });

    dropArea.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const nx = Math.max(-0.45, Math.min(0.45, startOffX + (e.clientX - dragStartX) / 190));
      const ny = Math.max(-0.45, Math.min(0.45, startOffY + (e.clientY - dragStartY) / 190));
      if (faceXInput) faceXInput.value = nx.toFixed(2);
      if (faceYInput) faceYInput.value = ny.toFixed(2);
      refreshPreview();
    });

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      dropArea.classList.remove('is-dragging');
    };
    dropArea.addEventListener('pointerup', endDrag);
    dropArea.addEventListener('pointercancel', endDrag);

    // Clique abre a galeria somente quando ainda não há foto carregada
    dropArea.addEventListener('click', () => {
      if (!loadedRawImg) openFilePicker();
    });
    dropArea.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !loadedRawImg) {
        e.preventDefault();
        openFilePicker();
      }
    });

    ['dragenter', 'dragover'].forEach(ev =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.remove('dragover'); }));

    dropArea.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) showPreviewFile(f);
    });
    fileInput.addEventListener('change', (e) => showPreviewFile(e.target.files[0]));

    refreshCreatorAccessories();
    refreshPreview();

    saveBtn.addEventListener('click', async () => {
      const name = nameInput.value.trim() || 'Skatista Radical';
      const original = saveBtn.textContent;
      saveBtn.textContent = 'Processando…';
      saveBtn.disabled = true;

      try {
        stopCamera();
        const opts = getOptions();
        await window.characterManager.createCustomCharacterFromImage(loadedRawImg, name, opts);
        if (window.progressionManager && opts.accessory && window.progressionManager.isOwned('accessories', opts.accessory)) {
          window.progressionManager.equipItem('accessories', opts.accessory);
        }
        loadedRawImg = null;
        preview.hidden = true;
        if (dragHint) dragHint.hidden = true;
        dropArea.classList.remove('has-photo');
        prompt.style.display = '';
        nameInput.value = '';
        fileInput.value = '';
        if (faceXInput) faceXInput.value = '0';
        if (faceYInput) faceYInput.value = '0';
        if (zoomInput) zoomInput.value = '1.15';
        if (flipInput) flipInput.checked = false;
        if (helmetInput) helmetInput.checked = true;
        if (fullPhotoInput) fullPhotoInput.checked = false;
        refreshPreview();
        this.showCharacterSelect();
      } catch (err) {
        console.error(err);
        showCameraError('Não foi possível salvar o personagem. Tente outra imagem ou estilo.');
      } finally {
        saveBtn.textContent = original;
        saveBtn.disabled = false;
      }
    });
  }

  // ==========================================================
  // Fluxo de partida
  // ==========================================================

  blurActiveElement() {
    const active = document.activeElement;
    if (active && active !== document.body && typeof active.blur === 'function') {
      active.blur();
    }
  }

  clearSwipeTimers() {
    if (!this._swipeTimers) return;
    this._swipeTimers.forEach(id => clearTimeout(id));
    this._swipeTimers.clear();
  }

  clearGameplayTimersAndOverlays({ clearToasts = false } = {}) {
    this.input.clear();
    this.clearSwipeTimers();

    if (this._hintTimer) { clearTimeout(this._hintTimer); this._hintTimer = null; }
    if (this._bannerTimer) { clearTimeout(this._bannerTimer); this._bannerTimer = null; }
    for (const key in this._popTimers) {
      clearTimeout(this._popTimers[key]);
      delete this._popTimers[key];
    }

    if (this.el.runHint) this.el.runHint.classList.remove('visible');
    if (this.el.stageBanner) this.el.stageBanner.classList.remove('active');
    if (this.el.combo) {
      this.el.combo.classList.remove('active', 'is-grinding', 'is-banked');
    }
    document.querySelectorAll('.touch-btn.is-pressed, .desk-trick-btn.is-pressed').forEach(btn => {
      btn.classList.remove('is-pressed');
    });

    if (clearToasts) {
      this._toastQueue = [];
      this._toastBusy = false;
      if (this._toastTimer) { clearTimeout(this._toastTimer); this._toastTimer = null; }
      if (this.el.toastStack) this.el.toastStack.innerHTML = '';
    }
  }

  /** Deposita moedas coletadas na carteira (1 única vez por corrida), inclusive ao sair do Treino Livre. */
  bankCoinsIfNeeded(notify = false) {
    const p = this.player;
    const rawCoins = p ? Math.max(0, Math.floor(p.coins || 0)) : 0;
    if (this._coinsBankedThisRun || !window.progressionManager) {
      return { raw: rawCoins, bonus: 0, total: rawCoins };
    }
    this._coinsBankedThisRun = true;
    const info = window.progressionManager.bankRunCoins(rawCoins);
    if (notify && info.total > 0) {
      this.showToast({
        icon: '🪙',
        title: 'Moedas guardadas na carteira',
        reward: info.total
      });
    }
    return info;
  }

  startPlay() {
    this._runId++;
    this.blurActiveElement();
    this.clearGameplayTimersAndOverlays({ clearToasts: true });

    const localBestDist = this.leaderboard.getAll().reduce((acc, it) => Math.max(acc, it.distance || 0), 0);
    const progBestDist = (window.progressionManager && window.progressionManager.data?.stats?.bestDistance) || 0;
    const recordDistance = Math.max(localBestDist, progBestDist);

    this.world.reset({ recordDistance });
    if (this.player.setSport) this.player.setSport(this.selectedSport);
    this.player.reset(this.world, {
      gameMode: this.selectedMode,
      difficulty: this.selectedDifficulty,
      startStageIndex: this.selectedStage,
      sportId: this.selectedSport
    });
    this.camera.reset();
    window.particleSystem.clear();

    this.accumulator = 0;
    this.lastTime = performance.now();
    this.hudCache = {};
    this._prevLivesCount = this.player.lives;
    this.comboBankTimer = 0;
    this.comboBankMult = 1;
    this.comboBankPoints = 0;
    this._scoreSavedThisRun = false;
    this._lastSavedEntryId = null;
    this._onlineSavedThisRun = false;
    this._coinsBankedThisRun = false;

    this._finishSeq = null;
    this.cancelResumeCountdown();

    if (this.el.avatar && window.characterManager) {
      const ch = window.characterManager.getSelected();
      this.el.avatar.src = (ch && ch.portrait) || 'assets/portraits/portrait_luigi_3d.png';
    }

    const isFree = this.player.gameMode === 'free';
    if (this.el.finishFreeBtn) this.el.finishFreeBtn.hidden = !isFree;
    if (this.el.pauseFinishFreeBtn) this.el.pauseFinishFreeBtn.hidden = !isFree;

    this.setState('PLAYING');
    this.updateHUD();
    if (window.soundSystem.setMusicContext) {
      window.soundSystem.setMusicContext(this.player.currentStageIndex, false);
    }
    window.soundSystem.startMusic('game');

    if (this.el.runHint) this.el.runHint.classList.add('visible');
    this._hintTimer = setTimeout(() => {
      if (this.el.runHint) this.el.runHint.classList.remove('visible');
      this._hintTimer = null;
    }, 3400);
  }

  cancelResumeCountdown() {
    if (this._resumeSeq && this._resumeSeq.timer) {
      clearTimeout(this._resumeSeq.timer);
    }
    this._resumeSeq = null;
    if (this.el.resumeCountdown) this.el.resumeCountdown.hidden = true;
  }

  pauseGame() {
    if (this.state !== 'PLAYING' && this.state !== 'RESUMING') return;
    this.cancelResumeCountdown();
    this.input.clear();
    this.clearSwipeTimers();
    document.querySelectorAll('.touch-btn.is-pressed, .desk-trick-btn.is-pressed').forEach(btn => {
      btn.classList.remove('is-pressed');
    });
    this.blurActiveElement();
    this.setState('PAUSED');
    window.soundSystem.stopMusic();
    if (window.soundSystem.silenceLoops) window.soundSystem.silenceLoops();
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.blurActiveElement();
    const p = this.player;
    const needsCountdown = !this.camera.reducedMotion && p && ((p.sessionDistance || 0) > 3 || !p.onGround);

    if (!needsCountdown) {
      this.setState('PLAYING');
      this.lastTime = performance.now();
      this.accumulator = 0;
      window.soundSystem.startMusic('game');
      return;
    }

    this.cancelResumeCountdown();
    this.setState('RESUMING');
    let count = 3;
    const box = this.el.resumeCountdown;
    const numEl = this.el.resumeCountdownNum;

    const showStep = () => {
      if (this.state !== 'RESUMING') return;
      if (count <= 0) {
        this.cancelResumeCountdown();
        if (window.soundSystem.playCountdownTick) window.soundSystem.playCountdownTick(0);
        this.setState('PLAYING');
        this.lastTime = performance.now();
        this.accumulator = 0;
        window.soundSystem.startMusic('game');
        return;
      }
      if (box && numEl) {
        box.hidden = false;
        numEl.textContent = String(count);
        numEl.style.animation = 'none';
        void numEl.offsetWidth;
        numEl.style.animation = '';
      }
      if (window.soundSystem.playCountdownTick) window.soundSystem.playCountdownTick(count);
      count--;
      this._resumeSeq = { timer: setTimeout(showStep, 360) };
    };
    showStep();
  }

  finishFreeRun() {
    if (!this.player || this.player.gameMode !== 'free') return;
    if (this.state !== 'PLAYING' && this.state !== 'PAUSED' && this.state !== 'RESUMING') return;
    this.cancelResumeCountdown();
    this.player.endedFreeMode = true;
    this.player.deathReason = 'Sessão de treino concluída!';
    window.soundSystem?.playStageClear?.();
    this.gameOver();
  }

  animateGameOverCounters(targetScore, targetDist, targetCoins) {
    if (this._countAnimRaf) {
      cancelAnimationFrame(this._countAnimRaf);
      this._countAnimRaf = null;
    }
    const scoreEl = document.getElementById('final-score');
    const distEl = document.getElementById('final-distance');
    const coinsEl = document.getElementById('final-coins');
    if (this.camera.reducedMotion) {
      if (scoreEl) scoreEl.textContent = formatNumber(targetScore);
      if (distEl) distEl.textContent = Math.floor(targetDist) + 'm';
      if (coinsEl) coinsEl.textContent = formatNumber(targetCoins);
      return;
    }
    const start = performance.now();
    const duration = 560;
    const tick = (now) => {
      if (this.state !== 'GAME_OVER') {
        this._countAnimRaf = null;
        return;
      }
      const raw = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - raw, 3);
      if (scoreEl) scoreEl.textContent = formatNumber(Math.round(targetScore * ease));
      if (distEl) distEl.textContent = Math.floor(targetDist * ease) + 'm';
      if (coinsEl) coinsEl.textContent = formatNumber(Math.round(targetCoins * ease));
      if (raw < 1) {
        this._countAnimRaf = requestAnimationFrame(tick);
      } else {
        this._countAnimRaf = null;
      }
    };
    this._countAnimRaf = requestAnimationFrame(tick);
  }

  gameOver() {
    this._finishSeq = null;
    this.cancelResumeCountdown();
    this.clearGameplayTimersAndOverlays({ clearToasts: false });
    this.setState('GAME_OVER');
    window.soundSystem.stopMusic();
    if (window.soundSystem.silenceLoops) window.soundSystem.silenceLoops();
    delete this.wrapper.dataset.speedFx;
    delete this.wrapper.dataset.fever;

    const p = this.player;
    const isFree = p.gameMode === 'free' || p.endedFreeMode;
    const isCleanTimeUp = p.gameMode === 'time60' && (p.timeLeftSteps || 0) <= 0;
    const runDist = Math.max(0, Math.floor(p.sessionDistance !== undefined ? p.sessionDistance : (p.distance || 0)));
    const prevTopScore = this.leaderboard.getTopScore();

    if (this.el.gameoverTitle) {
      if (isFree) {
        this.el.gameoverTitle.textContent = '🌟 Treino Concluído';
        this.el.gameoverTitle.className = 'screen-title screen-title--good';
      } else if (isCleanTimeUp) {
        this.el.gameoverTitle.textContent = '⏱️ Tempo Esgotado!';
        this.el.gameoverTitle.className = 'screen-title screen-title--good';
      } else {
        this.el.gameoverTitle.textContent = 'Fim da linha';
        this.el.gameoverTitle.className = 'screen-title screen-title--danger';
      }
    }

    // Deposita moedas coletadas na Carteira Permanente (1 única vez por corrida)
    let bankInfo = { raw: p.coins, bonus: 0, total: p.coins };
    if (!this._coinsBankedThisRun && window.progressionManager) {
      bankInfo = this.bankCoinsIfNeeded(false);
      const endNotes = window.progressionManager.recordRunEvent('run_end', 1, {
        distance: runDist,
        bestCombo: p.bestCombo,
        stageIndex: p.currentStageIndex,
        startedStageIndex: p.startedStageIndex || 0
      });
      if (endNotes && endNotes.length) this.onProgressionNotifications(endNotes);
    }

    const bankSummaryEl = document.getElementById('gameover-bank-summary');
    if (bankSummaryEl) {
      const totalBank = window.progressionManager ? window.progressionManager.getCoins() : bankInfo.total;
      const bonusStr = bankInfo.bonus > 0 ? ` (+${bankInfo.bonus} bônus!)` : '';
      bankSummaryEl.textContent = `🪙 +${bankInfo.total} moedas guardadas na carteira${bonusStr} · Saldo: ${formatNumber(totalBank)} 🪙`;
    }
    const shopCoinsEl = document.getElementById('gameover-shop-coins');
    if (shopCoinsEl && window.progressionManager) {
      shopCoinsEl.textContent = formatNumber(window.progressionManager.getCoins());
    }

    document.getElementById('final-combo').textContent = 'x' + p.bestCombo;
    document.getElementById('gameover-reason').textContent = p.deathReason || 'Boa sessão radical!';
    this.animateGameOverCounters(p.score, runDist, p.coins);

    // Treino Livre não entra no placar competitivo
    if (this.el.registerBox) {
      this.el.registerBox.hidden = isFree || p.score <= 0;
    }

    if (this.el.playerNameInput) {
      this.el.playerNameInput.value = this.lastPlayerName || 'Luigi';
    }
    if (this.el.btnSaveScore) {
      this.el.btnSaveScore.disabled = false;
      this.el.btnSaveScore.innerHTML = '<span class="btn-icon">⭐</span> Gravar Pontuação';
    }
    if (this.el.registerFeedback) {
      this.el.registerFeedback.hidden = true;
    }

    if (!isFree && p.score > 0 && !this._scoreSavedThisRun) {
      this.saveScoreFromGameOver({ auto: true });
    } else {
      if (this.el.gameoverRankBadge) {
        if (isFree) {
          this.el.gameoverRankBadge.hidden = false;
          this.el.gameoverRankBadge.textContent = '🌟 Modo Treino — moedas e missões salvas (fora do placar)';
        } else {
          this.el.gameoverRankBadge.hidden = true;
        }
      }
      this.loadLeaderboardView('gameover-leaderboard-list', 'gameover-leaderboard-status', 'global');
    }

    // Destaque de novo recorde geral comparado ao recorde anterior à partida
    const banner = document.getElementById('new-record-banner');
    if (banner) {
      banner.hidden = isFree || p.score <= prevTopScore || p.score === 0;
    }
  }

  /** Constrói o objeto completo de pontuação da partida atual para local/online. */
  buildCurrentRunScoreEntry(nameOverride) {
    const p = this.player;
    const input = this.el.playerNameInput;
    const name = (nameOverride || (input && input.value) || this.lastPlayerName || 'Skatista').trim() || 'Skatista';
    const char = window.characterManager.getSelected();
    const sport = this.getSportInfo(this.selectedSport);
    const now = new Date();
    const date = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const runDist = p.sessionDistance !== undefined ? p.sessionDistance : (p.distance || 0);

    return {
      name,
      score: Math.max(0, Math.floor(p.score)),
      distance: Math.max(0, Math.floor(runDist)),
      characterId: char ? char.id : 'luigi_3d',
      characterName: char ? char.name : 'Luigi 3D',
      characterPortrait: char ? char.portrait : 'assets/portraits/portrait_luigi_3d.png',
      sportId: sport.id,
      sportIcon: sport.icon,
      date,
      time
    };
  }

  /** Envia a pontuação para o Placar Global 1 única vez nesta partida. */
  async submitOnlineScoreOnce({ silent = false } = {}) {
    if (this._onlineSavedThisRun) return { ok: true, alreadySaved: true };
    const p = this.player;
    if (!p || p.score <= 0) return { ok: false, reason: 'zero' };
    if (!window.onlineLeaderboard || !window.onlineLeaderboard.submitScore) {
      return { ok: false, reason: 'unavailable' };
    }

    // Marca antes do await para evitar qualquer envio duplicado por cliques rápidos
    this._onlineSavedThisRun = true;
    const payload = this.buildCurrentRunScoreEntry();
    const res = await window.onlineLeaderboard.submitScore(payload);

    if (!res || !res.ok) {
      // Se falhou por rede, permite tentar de novo caso clique manualmente
      if (!silent) this._onlineSavedThisRun = false;
      return res || { ok: false };
    }

    return res;
  }

  /** Se o jogador sair do Game Over sem clicar em Gravar, envia automaticamente ao Placar Global. */
  flushOnlineScoreIfNeeded() {
    if (this.state !== 'GAME_OVER') return;
    if (this._onlineSavedThisRun) return;
    if (!this.player || this.player.score <= 0 || this.player.gameMode === 'free' || this.player.endedFreeMode) return;
    // Atualiza o nome local também caso tenha editado no campo antes de sair
    const input = this.el.playerNameInput;
    const name = (input && input.value ? input.value : '').trim() || (this.lastPlayerName || 'Skatista');
    this.lastPlayerName = name;
    try { localStorage.setItem('luigi_skate_last_player_name', name); } catch (_) {}
    if (this._lastSavedEntryId) {
      this.leaderboard.updateEntryName(this._lastSavedEntryId, name);
    }
    this.submitOnlineScoreOnce({ silent: true });
  }

  async saveScoreFromGameOver({ auto = false } = {}) {
    const p = this.player;
    if (p.score <= 0 || p.gameMode === 'free' || p.endedFreeMode) return;

    const input = this.el.playerNameInput;
    const name = (input && input.value ? input.value : '').trim() || (this.lastPlayerName || 'Skatista');
    this.lastPlayerName = name;
    try { localStorage.setItem('luigi_skate_last_player_name', name); } catch (_) {}

    let entry = null;

    if (this._scoreSavedThisRun && this._lastSavedEntryId) {
      // Já foi gravado localmente nesta partida: atualiza o nome sem duplicar
      entry = this.leaderboard.updateEntryName(this._lastSavedEntryId, name);
    } else {
      entry = this.leaderboard.addEntry(this.buildCurrentRunScoreEntry(name));
      this._scoreSavedThisRun = true;
      this._lastSavedEntryId = entry ? entry.id : null;
    }

    this.highScore = this.leaderboard.getTopScore();
    if (this.el.highscore) this.el.highscore.textContent = formatNumber(this.highScore);
    const hs = document.getElementById('menu-highscore');
    if (hs) hs.textContent = formatNumber(this.highScore);

    if (this.el.gameoverRankBadge && entry) {
      const localList = this.leaderboard.getAll();
      const pos = localList.findIndex(item => item.id === entry.id);
      if (pos >= 0) {
        this.el.gameoverRankBadge.hidden = false;
        this.el.gameoverRankBadge.textContent = pos === 0
          ? '🥇 #1 Melhor Pontuação deste Aparelho!'
          : `🏅 #${pos + 1} no Placar deste Aparelho`;
      } else {
        this.el.gameoverRankBadge.hidden = true;
      }
    }

    if (auto) {
      if (this.el.registerFeedback && entry) {
        this.el.registerFeedback.hidden = false;
        this.el.registerFeedback.textContent = `✅ Salvo neste aparelho (${formatNumber(entry.score)} pts). Clique em "Gravar Pontuação" para enviar ao Placar Global 🌎`;
      }
      if (this.el.btnSaveScore) {
        this.el.btnSaveScore.disabled = false;
        this.el.btnSaveScore.innerHTML = '<span class="btn-icon">⭐</span> Gravar Pontuação';
      }
      this.loadLeaderboardView('gameover-leaderboard-list', 'gameover-leaderboard-status', 'global');
      return;
    }

    // Envio explícito para o Placar Global Online (1 única vez por partida)
    const runId = this._runId;
    if (this.el.btnSaveScore) {
      this.el.btnSaveScore.disabled = true;
      this.el.btnSaveScore.innerHTML = '<span>⏳</span> Enviando…';
    }

    const res = await this.submitOnlineScoreOnce({ silent: false });
    if (runId !== this._runId || this.state !== 'GAME_OVER') return;

    if (res && res.ok) {
      if (this.el.registerFeedback && entry) {
        this.el.registerFeedback.hidden = false;
        this.el.registerFeedback.textContent = `🌎 Salvo no placar global! ${name} — ${formatNumber(entry.score)} pts`;
      }
      if (this.el.btnSaveScore) {
        this.el.btnSaveScore.disabled = true;
        this.el.btnSaveScore.innerHTML = '<span>🌎</span> Salvo no Global!';
      }
    } else {
      if (this.el.registerFeedback && entry) {
        this.el.registerFeedback.hidden = false;
        this.el.registerFeedback.textContent = `📱 Sem internet — salvo no placar local (${name}: ${formatNumber(entry.score)} pts).`;
      }
      if (this.el.btnSaveScore) {
        this.el.btnSaveScore.disabled = false;
        this.el.btnSaveScore.innerHTML = '<span class="btn-icon">⭐</span> Tentar Enviar Global';
      }
    }

    this.loadLeaderboardView('gameover-leaderboard-list', 'gameover-leaderboard-status', 'global');
    window.soundSystem.playCoin();
  }

  showLeaderboard() {
    this.setState('LEADERBOARD');
    this.switchLeaderboardTab(this.leaderboardTab || 'global');
  }

  switchLeaderboardTab(tab) {
    this.leaderboardTab = tab === 'local' ? 'local' : 'global';
    const tabGlobal = document.getElementById('tab-lb-global');
    const tabLocal = document.getElementById('tab-lb-local');
    const clearBtn = document.getElementById('btn-clear-leaderboard');

    if (tabGlobal) {
      tabGlobal.classList.toggle('active', this.leaderboardTab === 'global');
      tabGlobal.setAttribute('aria-selected', this.leaderboardTab === 'global' ? 'true' : 'false');
    }
    if (tabLocal) {
      tabLocal.classList.toggle('active', this.leaderboardTab === 'local');
      tabLocal.setAttribute('aria-selected', this.leaderboardTab === 'local' ? 'true' : 'false');
    }
    if (clearBtn) {
      clearBtn.hidden = this.leaderboardTab !== 'local';
    }

    this.loadLeaderboardView('main-leaderboard-list', 'leaderboard-status', this.leaderboardTab);
  }

  async loadLeaderboardView(containerId, statusId, mode = 'global') {
    const statusEl = statusId ? document.getElementById(statusId) : null;
    const isBadge = statusId === 'gameover-leaderboard-status';
    const isMain = containerId === 'main-leaderboard-list';
    if (isMain) this._cachedLbContainer = containerId;
    const reqSeq = (this._lbReqSeq[containerId] = (this._lbReqSeq[containerId] || 0) + 1);

    if (mode === 'local') {
      if (statusEl) statusEl.textContent = isBadge ? '📱 Local' : '📱 Pontuações salvas neste aparelho';
      const localList = this.leaderboard.getAll();
      if (isMain) this._cachedLeaderboardList = localList;
      this.renderLeaderboard(containerId, localList);
      return;
    }

    if (statusEl) statusEl.textContent = isBadge ? '⏳ Global…' : '⏳ Carregando ranking global…';

    if (window.onlineLeaderboard && window.onlineLeaderboard.isAvailable()) {
      try {
        const scores = await window.onlineLeaderboard.fetchTopScores(40);
        if (this._lbReqSeq[containerId] !== reqSeq) return;
        if (statusEl) statusEl.textContent = isBadge ? '🌎 Global' : '🌎 Placar universal — todos os jogadores';
        if (isMain) this._cachedLeaderboardList = scores;
        this.renderLeaderboard(containerId, scores);
        return;
      } catch (_) {}
    }

    if (this._lbReqSeq[containerId] !== reqSeq) return;

    // Fallback automático offline para o placar local
    if (statusEl) statusEl.textContent = isBadge ? '📱 Local (offline)' : '📡 Sem internet — mostrando placar local';
    const fallback = this.leaderboard.getAll();
    if (isMain) this._cachedLeaderboardList = fallback;
    this.renderLeaderboard(containerId, fallback);
  }

  async clearLeaderboard() {
    const ok = await this.confirmDialog({
      icon: '🧹',
      title: 'Zerar placar local?',
      message: 'Isso apagará todas as pontuações salvas neste aparelho. O Placar Global não será alterado.',
      confirmText: 'Zerar tudo',
      cancelText: 'Cancelar',
      danger: true
    });
    if (ok) {
      this.leaderboard.clear();
      this.highScore = 0;
      if (this.el.highscore) this.el.highscore.textContent = '0';
      const hs = document.getElementById('menu-highscore');
      if (hs) hs.textContent = '0';
      this._cachedLeaderboardList = [];
      this.renderLeaderboard('main-leaderboard-list', []);
      this.renderLeaderboard('gameover-leaderboard-list', []);
    }
  }

  renderLeaderboard(containerId, customList = null) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let list = Array.isArray(customList) ? customList : this.leaderboard.getAll();
    if (containerId === 'main-leaderboard-list' && this.leaderboardSportFilter && this.leaderboardSportFilter !== 'all') {
      list = list.filter(it => (it.sportId || 'skate') === this.leaderboardSportFilter);
    }
    if (list.length === 0) {
      const isFiltered = containerId === 'main-leaderboard-list' && this.leaderboardSportFilter && this.leaderboardSportFilter !== 'all';
      container.innerHTML = `
        <div class="leaderboard-empty">
          <p>🛹 <b>${isFiltered ? 'Nenhuma pontuação registrada neste esporte ainda!' : 'Nenhuma pontuação registrada ainda!'}</b></p>
          <span>Jogue uma partida, digite seu nome e seja o 1º Campeão Radical!</span>
        </div>
      `;
      return;
    }

    let html = '';
    list.forEach((item, index) => {
      let rankBadge = `${index + 1}º`;
      let rankClass = '';

      if (index === 0) {
        rankBadge = '🥇';
        rankClass = 'leader-first';
      } else if (index === 1) {
        rankBadge = '🥈';
        rankClass = 'leader-second';
      } else if (index === 2) {
        rankBadge = '🥉';
        rankClass = 'leader-third';
      }

      // Resolve retrato dinamicamente pelo characterId (evita guardar base64 no localStorage)
      const matchedChar = (item.characterId && window.characterManager)
        ? window.characterManager.characters.find(c => c.id === item.characterId)
        : null;
      const avatarSrc = (matchedChar && matchedChar.portrait)
        || (item.characterPortrait && !item.characterPortrait.startsWith('data:') ? item.characterPortrait : null)
        || 'assets/portraits/portrait_luigi_3d.png';

      const isCurrentRun = !!(this._lastSavedEntryId && item.id === this._lastSavedEntryId);
      html += `
        <div class="leader-item ${rankClass}${isCurrentRun ? ' is-current-run' : ''}">
          <div class="leader-col-left">
            <span class="leader-rank">${rankBadge}</span>
            <img class="leader-avatar" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(item.characterName)}" onerror="this.onerror=null;this.src='assets/portraits/portrait_luigi_3d.png'">
            <div class="leader-info">
              <span class="leader-name">${escapeHtml(item.name)} ${index === 0 ? '<span title="Campeão">👑</span>' : ''}</span>
              <div class="leader-meta">
                <span>📅 ${escapeHtml(item.date)} às ${escapeHtml(item.time)}</span>
                <span>• ${escapeHtml(item.sportIcon || '🛹')} ${escapeHtml(item.characterName)}</span>
              </div>
            </div>
          </div>
          <div class="leader-col-right">
            <span class="leader-score">${formatNumber(item.score)} <small style="font-size: 10px; opacity: 0.7;">pts</small></span>
            <span class="leader-dist">${formatNumber(item.distance)}m</span>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  flash(kind) {
    const el = this.el.flash;
    el.className = kind === 'damage' ? 'flash-damage' : 'flash-power';
    // Força o reflow para reiniciar a transição antes de esmaecer
    void el.offsetWidth;
    el.className = '';
  }

  // ==========================================================
  // HUD
  // ==========================================================

  updateHUD() {
    const p = this.player;

    this.setText('score', this.el.score, formatNumber(p.score), true);
    this.setText('coins', this.el.coins, String(p.coins), true);
    this.setText('distance', this.el.distance, String(Math.floor(p.distance)));

    // Velocímetro (km/h + barra de embalo em GPU scaleX)
    const speedRatio = p.speedNormalized !== undefined
      ? p.speedNormalized
      : (p.speed / (p.maxSpeed || 12.5));
    const kmh = Math.round(p.speed * 3.4);
    if (this.el.speed) {
      this.setText('speed', this.el.speed, String(kmh));
    }
    if (this.el.speedBar) {
      const barRatio = Math.max(0.08, Math.min(1, speedRatio / 1.35));
      const barKey = barRatio.toFixed(2);
      if (this.hudCache.speedBar !== barKey) {
        this.hudCache.speedBar = barKey;
        this.el.speedBar.style.transform = `scaleX(${barKey})`;
      }
    }
    if (this.el.speedChip) {
      const speedMode = p.turboTimer > 0 ? 'turbo' : ((p.isPushing || p.isAccelerating) ? 'push' : 'normal');
      if (this.hudCache.speedMode !== speedMode) {
        this.hudCache.speedMode = speedMode;
        this.el.speedChip.classList.toggle('is-turbo', speedMode === 'turbo');
        this.el.speedChip.classList.toggle('is-pushing', speedMode === 'push');
      }
    }

    // Efeito sutil de velocidade extrema na vinheta
    const speedFx = p.turboTimer > 0 ? 'turbo' : (speedRatio > 1.08 ? 'high' : 'normal');
    if (this.hudCache.speedFx !== speedFx) {
      this.hudCache.speedFx = speedFx;
      if (speedFx === 'normal') delete this.wrapper.dataset.speedFx;
      else this.wrapper.dataset.speedFx = speedFx;
    }

    // Vidas (3 iniciais, até 5 com bônus de fase — exibe 3 acesos + 2 espaços extras; ∞ em Treino Livre/60s)
    const lives = Math.max(0, p.lives);
    const maxLives = p.maxLives || 5;
    const sportInfo = this.getSportInfo(this.selectedSport);
    const lifeIcon = sportInfo.icon || '🛹';
    const isNoLifeLoss = p.gameMode === 'free' || p.gameMode === 'time60';
    const livesKey = `${isNoLifeLoss ? 'inf' : lives}:${maxLives}:${lifeIcon}`;
    if (this.hudCache.lives !== livesKey) {
      const gained = !isNoLifeLoss && this._prevLivesCount !== null && lives > this._prevLivesCount;
      this._prevLivesCount = lives;
      this.hudCache.lives = livesKey;
      if (isNoLifeLoss) {
        this.el.lives.innerHTML = `<span class="life-infinite">${lifeIcon} ∞</span>`;
        this.el.lives.setAttribute('aria-label', 'Vidas infinitas neste modo');
      } else {
        let html = '';
        for (let i = 0; i < maxLives; i++) {
          const isLit = i < lives;
          const cls = isLit ? (gained && i === lives - 1 ? 'life-gained' : '') : 'life-lost';
          html += `<span class="${cls}">${lifeIcon}</span>`;
        }
        this.el.lives.innerHTML = html;
        this.el.lives.setAttribute('aria-label', `${lives} de ${maxLives} vidas restantes`);
      }
    }

    // Progresso da Fase atual e sincronização de bioma no HUD
    const currentStage = STAGES[p.currentStageIndex] || STAGES[0];
    const biomeTheme = currentStage.theme || 'skatepark';
    if (this.hudCache.biome !== biomeTheme) {
      this.hudCache.biome = biomeTheme;
      this.wrapper.dataset.biome = biomeTheme;
    }

    if (this.el.stageTitle && this.el.stageIcon && this.el.stageProgress) {
      let progressRatio = 1;
      let stageTitle = 'Fase 4: Cósmica ★';
      if (currentStage.nextDist !== Infinity) {
        const stageSpan = currentStage.nextDist - currentStage.dist;
        const currentInStage = Math.max(0, p.distance - currentStage.dist);
        progressRatio = Math.min(1, Math.max(0, currentInStage / stageSpan));
        stageTitle = `Fase ${p.currentStageIndex + 1}: ${currentStage.name.split(' ')[0]}`;
      }
      const progKey = progressRatio.toFixed(3);
      if (this.hudCache.stageProg !== progKey) {
        this.hudCache.stageProg = progKey;
        this.el.stageProgress.style.transform = `scaleX(${progKey})`;
      }
      this.setText('stageTitle', this.el.stageTitle, stageTitle);
      this.setText('stageIcon', this.el.stageIcon, currentStage.icon || '🛹');
    }

    // Combo, Grind e confirmação de Combo Fechado
    const isGrinding = !!p.isGrinding;
    const activeAirCombo = !p.onGround && (p.comboMultiplier > 1 || (p.tricksInAir && p.tricksInAir.length > 0));
    const showBanked = !isGrinding && !activeAirCombo && this.comboBankTimer > 0;
    const showCombo = isGrinding || activeAirCombo || showBanked;

    const displayMult = showBanked ? this.comboBankMult : Math.max(1, p.comboMultiplier || 1);
    const displayPoints = showBanked ? this.comboBankPoints : (p.comboPoints || 0);
    const grindLabel = (p.sport && p.sport.grindLabel) || sportInfo.grindLabel || 'GRIND!';
    const displayAction = isGrinding
      ? grindLabel
      : (showBanked ? 'COMBO FECHADO!' : (p.lastTrickName || 'COMBO'));
    const comboKey = `${showCombo}:${isGrinding}:${showBanked}:${displayMult}:${displayAction}:${Math.floor(displayPoints)}`;

    if (this.hudCache.combo !== comboKey) {
      this.hudCache.combo = comboKey;
      this.el.combo.classList.toggle('active', showCombo);
      this.el.combo.classList.toggle('is-grinding', isGrinding);
      this.el.combo.classList.toggle('is-banked', showBanked);
      if (showCombo) {
        this.el.comboMult.textContent = isGrinding && displayMult <= 1 ? '⚡' : ('x' + displayMult);
        if (this.el.comboAction) this.el.comboAction.textContent = displayAction;
        if (this.el.comboPoints) {
          if (displayPoints > 0) {
            this.el.comboPoints.hidden = false;
            this.el.comboPoints.textContent = '+' + formatNumber(displayPoints) + ' pts';
          } else {
            this.el.comboPoints.hidden = true;
          }
        }
      }
    }

    // Medidores e efeitos do HUD
    if (this.el.timerChip && this.el.timer) {
      const is60 = p.gameMode === 'time60';
      this.el.timerChip.hidden = !is60;
      if (is60) {
        const secs = Math.max(0, Math.ceil((p.timeLeftSteps || 0) / 60));
        this.setText('timer', this.el.timer, secs + 's');
      }
    }

    if (this.el.word && Array.isArray(p.lettersCollected)) {
      const wKey = p.lettersCollected.map(v => (v ? '1' : '0')).join('');
      if (this.hudCache.word !== wKey) {
        this.hudCache.word = wKey;
        const spans = this.el.word.querySelectorAll('span');
        spans.forEach((sp, idx) => sp.classList.toggle('collected', !!p.lettersCollected[idx]));
      }
    }

    const isFever = (p.feverTimer || 0) > 0;
    const feverVal = isFever ? (p.feverTimer / (p.feverDuration || 360)) : ((p.feverGauge || 0) / 100);
    if (this.el.fever) {
      this.setMeter(this.el.fever, true, feverVal);
      this.el.fever.classList.toggle('is-fever', isFever);
      if (this.el.feverLabel) {
        const txt = isFever ? 'MODO RADICAL x2!' : `RADICAL ${Math.floor(p.feverGauge || 0)}%`;
        this.setText('feverLabel', this.el.feverLabel, txt);
      }
    }
    const feverAttr = isFever ? 'on' : '';
    if (this.hudCache.feverAttr !== feverAttr) {
      this.hudCache.feverAttr = feverAttr;
      if (feverAttr) this.wrapper.dataset.fever = feverAttr;
      else delete this.wrapper.dataset.fever;
    }

    this.setMeter(this.el.turbo, p.turboTimer > 0, p.turboTimer / (p.turboDuration || 1));
    this.setMeter(this.el.shield, p.hasShield, 1);
    if (this.el.magnet) this.setMeter(this.el.magnet, (p.magnetTimer || 0) > 0, (p.magnetTimer || 0) / (p.magnetDuration || 1));
    if (this.el.double) this.setMeter(this.el.double, (p.doubleTimer || 0) > 0, (p.doubleTimer || 0) / (p.doubleDuration || 1));

    if (this.el.desktopTrickBar) {
      const inAir = !p.onGround && !p.isGrinding;
      if (this.hudCache.deskInAir !== inAir) {
        this.hudCache.deskInAir = inAir;
        this.el.desktopTrickBar.classList.toggle('in-air', inAir);
      }
    }
  }

  showToast({ icon = '✨', title = '', reward = 0, subtitle = '', info = false } = {}) {
    if (!title && !subtitle) return;
    if (this._toastQueue.length >= 2) this._toastQueue.shift();
    this._toastQueue.push({ icon, title, reward, subtitle, info });
    this._pumpToastQueue();
  }

  onProgressionNotifications(notes) {
    if (!Array.isArray(notes) || notes.length === 0) return;
    let playedChest = false;
    let playedMission = false;
    for (const n of notes) {
      if (n.kind === 'levelup' && !playedChest) {
        playedChest = true;
        window.soundSystem?.playChestOpen?.();
      } else if (!playedMission) {
        playedMission = true;
        window.soundSystem?.playMissionComplete?.();
      }
      if (this._toastQueue.length < 2) {
        this._toastQueue.push(n);
      } else if (n.kind === 'levelup') {
        const idx = this._toastQueue.findIndex(item => item.kind !== 'levelup');
        if (idx >= 0) this._toastQueue[idx] = n;
      }
    }
    this._pumpToastQueue();
  }

  _pumpToastQueue() {
    if (this._toastBusy || !this.el.toastStack || this._toastQueue.length === 0) return;
    const n = this._toastQueue.shift();
    if (!n) return;

    this._toastBusy = true;
    this.el.toastStack.innerHTML = '';

    const detailHtml = n.subtitle
      ? `<span>${escapeHtml(n.subtitle)}</span>`
      : (n.reward ? `<span>+${formatNumber(n.reward)} 🪙</span>` : '');

    const el = document.createElement('div');
    el.className = 'toast-item' + (n.info ? ' toast-item--info' : '');
    el.innerHTML = `
      <span class="toast-icon">${escapeHtml(n.icon || '🎯')}</span>
      <div class="toast-body">
        <strong>${escapeHtml(n.title || '')}</strong>
        ${detailHtml}
      </div>
    `;
    this.el.toastStack.appendChild(el);

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.remove();
      this._toastBusy = false;
      this._toastTimer = null;
      this._pumpToastQueue();
    }, 2200);
  }

  onStageUnlocked(stage) {
    const banner = this.el.stageBanner;
    if (!banner) return;

    // As duas ocupam o mesmo canto do rodapé; a dica sai de cena para o aviso
    if (this.el.runHint) this.el.runHint.classList.remove('visible');
    if (this._hintTimer) { clearTimeout(this._hintTimer); this._hintTimer = null; }
    this.el.stageBannerIcon.textContent = stage.icon || '🎉';
    this.el.stageBannerTitle.textContent = `FASE ${this.player.currentStageIndex + 1} DESBLOQUEADA!`;
    this.el.stageBannerName.textContent = stage.name;
    if (this.el.stageBannerReward) {
      const sportIcon = this.getSportInfo(this.selectedSport).icon || '🛹';
      const isNoLifeLoss = this.player.gameMode === 'free' || this.player.gameMode === 'time60';
      this.el.stageBannerReward.textContent = isNoLifeLoss
        ? '+1.000 pts'
        : `${sportIcon} +1 vida · +1.000 pts`;
    }
    banner.classList.add('active');

    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => {
      banner.classList.remove('active');
      this._bannerTimer = null;
    }, 3000);
  }

  setText(key, el, value, pop = false) {
    if (!el || this.hudCache[key] === value) return;
    const changed = this.hudCache[key] !== undefined;
    this.hudCache[key] = value;
    el.textContent = value;

    // Animação pop sem forced reflow (sem ler offsetWidth)
    if (pop && changed) {
      el.classList.remove('pop');
      clearTimeout(this._popTimers[key]);
      this._popTimers[key] = setTimeout(() => {
        el.classList.add('pop');
      }, 0);
    }
  }

  setMeter(el, active, ratio) {
    el.classList.toggle('active', active);
    if (active) el.querySelector('i').style.setProperty('--fill', Math.max(0, Math.min(1, ratio)));
  }

  // ==========================================================
  // Laço
  // ==========================================================

  animate(now) {
    requestAnimationFrame(this.animate);
    this.pollGamepad();

    if (this.state === 'PLAYING') {
      // Acumulador com teto: uma aba em segundo plano não gera 500 passos
      let delta = now - this.lastTime;
      if (!isFinite(delta) || delta < 0) delta = STEP_MS;
      this.lastTime = now;
      this.accumulator = Math.min(this.accumulator + delta, STEP_MS * MAX_STEPS_PER_FRAME);

      let steps = 0;
      while (this.accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME) {
        this.step();
        this.accumulator -= STEP_MS;
        steps++;
        if (this.state !== 'PLAYING') break;
      }

      this.updateHUD();
    } else if (this.state === 'FINISHING' && this._finishSeq) {
      let delta = now - this.lastTime;
      if (!isFinite(delta) || delta < 0) delta = STEP_MS;
      delta = Math.min(delta, 50);
      this.lastTime = now;

      const seq = this._finishSeq;
      if (seq.hitstopMs > 0) {
        seq.hitstopMs -= delta;
      } else {
        seq.slowMoMs -= delta;
        seq.slowAcc += delta * 0.25;
        while (seq.slowAcc >= STEP_MS) {
          seq.slowAcc -= STEP_MS;
          this.camera.update(this.player, this.world);
          window.particleSystem.update();
          if (!seq.isCleanFinish) {
            if (!this.player.onGround) {
              this.player.rotation += 0.08;
              this.player.y += 1.2;
            } else {
              this.player.pitch = Math.max(-0.45, (this.player.pitch || 0) - 0.06);
              this.player.lean = this.player.pitch;
            }
          }
        }
        if (seq.slowMoMs <= 0) {
          this.gameOver();
        }
      }
      this.updateHUD();
    } else if (this.state === 'RESUMING' || this.state === 'PAUSED') {
      this.lastTime = now;
      this.updateHUD();
    } else {
      this.lastTime = now;
      this.world.time++;
      this.world.scroll += 0.9;   // parallax suave nos menus
      this.camera.idle();
      window.particleSystem.update();
    }

    this.render();
  }

  step() {
    const p = this.player;
    const prevComboMult = p.comboMultiplier || 1;
    const prevComboPts = p.comboPoints || 0;

    this.world.update(p);
    p.update(this.world, this.input);
    this.input.tick();
    this.camera.update(p, this.world);
    window.particleSystem.update();

    if (this.comboBankTimer > 0) this.comboBankTimer--;

    // Consome eventos físicos do passo para feedback de câmera, HUD e vibração
    if (Array.isArray(p.frameEvents) && p.frameEvents.length > 0) {
      for (const ev of p.frameEvents) {
        if (ev.type === 'perfect_land') {
          this.camera.punchZoom(0.016);
          this.comboBankMult = Math.max(2, prevComboMult);
          this.comboBankPoints = prevComboPts > 0 ? prevComboPts : (this.comboBankMult * 300);
          this.comboBankTimer = 68;
          this.haptic(14);
        } else if (ev.type === 'land' && ev.intensity > 0.55) {
          this.camera.shake(Math.min(7, ev.intensity * 6.5), 0.15, 1.0);
        } else if (ev.type === 'ramp') {
          if (ev.boosted) {
            this.camera.punchZoom(-0.032);
            this.camera.shake(4.5, 0.2, 0.9);
            this.flash('power');
            this.haptic([18, 24, 26]);
          } else {
            this.camera.punchZoom(-0.022);
            this.haptic(12);
          }
        } else if (ev.type === 'grind_start') {
          this.camera.shake(3.2, 0.25, 0.85);
          this.haptic(10);
        } else if (ev.type === 'damage') {
          this.camera.shake(14, 1.0, 0.35);
          this.haptic([35, 30, 50]);
        }
      }
    }

    // Atualiza som ambiente de vento e contexto musical dinâmico por bioma
    const speedNorm = p.speedNormalized !== undefined ? p.speedNormalized : (p.speed / (p.maxSpeed || 12.5));
    const altitude = p.airHeight !== undefined ? p.airHeight : Math.max(0, this.world.groundY - p.bottom);
    if (window.soundSystem) {
      if (window.soundSystem.updateWind) window.soundSystem.updateWind(speedNorm, altitude);
      if (window.soundSystem.setMusicContext) {
        window.soundSystem.setMusicContext(p.currentStageIndex, p.turboTimer > 0 || p.feverTimer > 0);
      }
    }

    if (p.isGameOver) {
      const isCleanTimeUp = p.gameMode === 'time60' && (p.timeLeftSteps || 0) <= 0;
      if (this.camera.reducedMotion) {
        this.gameOver();
        return;
      }
      if (!isCleanTimeUp) {
        window.soundSystem?.stopMusic?.();
        window.soundSystem?.silenceLoops?.();
        this.camera.punchZoom(0.024);
        this.haptic([45, 30, 75]);
      }
      this._finishSeq = {
        hitstopMs: isCleanTimeUp ? 0 : 90,
        slowMoMs: isCleanTimeUp ? 420 : 580,
        isCleanFinish: isCleanTimeUp,
        slowAcc: 0
      };
      this.state = 'FINISHING';
      this.wrapper.dataset.state = 'PLAYING';
    }
  }

  render() {
    const ctx = this.ctx;
    const cam = this.camera;

    if (this.needsResize) this.resize();
    this.applyViewTransform();

    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, VIEW.W, VIEW.H);

    this.world.drawBackground(ctx, VIEW.W, VIEW.H, cam.y);

    ctx.save();
    // Aplica zoom cinematográfico centrado próximo à linha da pista (zoom >= 1.0)
    if (cam.zoom && cam.zoom !== 1) {
      const focusX = VIEW.W * 0.32;
      const focusY = VIEW.H * 0.68;
      ctx.translate(focusX, focusY);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-focusX, -focusY);
    }
    ctx.translate(cam.shakeX - (cam.xOffset || 0), -cam.y + cam.shakeY);

    this.world.drawTrack(ctx, VIEW.W, VIEW.H);
    this.world.drawCollectibles(ctx);

    if (this.state !== 'LOADING') this.player.draw(ctx);
    window.particleSystem.draw(ctx);

    ctx.restore();

    const speedRatio = this.state === 'PLAYING' ? this.player.speed / this.player.maxSpeed : 0;
    this.world.drawForeground(ctx, VIEW.W, VIEW.H, speedRatio);
  }
}

// ============================================================
// Utilitários
// ============================================================

function formatNumber(n) {
  return Math.floor(n).toLocaleString('pt-BR');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function readNumber(key) {
  try { return parseInt(localStorage.getItem(key) || '0', 10) || 0; } catch (_) { return 0; }
}

/**
 * Leitura de texto do armazenamento local.
 *
 * Em aba anônima, com dados de site bloqueados ou dentro de um iframe com
 * restrição, o simples acesso a localStorage lança exceção. Sem esta
 * proteção o jogo nem chega a iniciar.
 */
function readText(key, fallback = '') {
  try { return localStorage.getItem(key) || fallback; } catch (_) { return fallback; }
}

function writeNumber(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (_) {}
}

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  window.game = game;
  game.start();
});
