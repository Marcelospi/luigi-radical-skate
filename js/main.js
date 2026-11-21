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

  getAll() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      const list = data ? JSON.parse(data) : [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  addEntry({ name, score, distance, characterName, characterPortrait, sportId, sportIcon }) {
    const list = this.getAll();
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const entry = {
      id: 'score_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: (name || 'Luigi').trim(),
      score: Math.max(0, Math.floor(score)),
      distance: Math.max(0, Math.floor(distance)),
      characterName: characterName || 'Luigi',
      characterPortrait: characterPortrait || 'assets/portraits/portrait_luigi_3d.png',
      sportId: sportId || 'skate',
      sportIcon: sportIcon || '🛹',
      date: `${day}/${month}/${year}`,
      time: `${hours}:${minutes}`,
      timestamp: Date.now()
    };

    list.push(entry);
    // Ordena do maior ponto para o menor
    list.sort((a, b) => b.score - a.score);
    // Guarda até 40 pontuações
    const trimmed = list.slice(0, 40);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmed));
      if (trimmed.length > 0) {
        writeNumber('luigi_skate_high_score', trimmed[0].score);
      }
    } catch (_) {}

    return entry;
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
    this._popTimers = {};

    this.el = {
      score:             document.getElementById('hud-score'),
      distance:          document.getElementById('hud-distance'),
      speedChip:         document.getElementById('hud-speed-chip'),
      speed:             document.getElementById('hud-speed'),
      speedBar:          document.getElementById('hud-speed-bar'),
      coins:             document.getElementById('hud-coins'),
      lives:             document.getElementById('hud-lives'),
      highscore:         document.getElementById('hud-highscore'),
      stageIcon:         document.getElementById('hud-stage-icon'),
      stageTitle:        document.getElementById('hud-stage-title'),
      stageProgress:     document.getElementById('hud-stage-progress-fill'),
      stageBanner:       document.getElementById('stage-banner'),
      stageBannerIcon:   document.getElementById('stage-banner-icon'),
      stageBannerTitle:  document.getElementById('stage-banner-title'),
      stageBannerName:   document.getElementById('stage-banner-name'),
      combo:             document.getElementById('combo-display'),
      comboMult:         document.getElementById('combo-multiplier'),
      comboAction:       document.getElementById('combo-action'),
      comboPoints:       document.getElementById('combo-points'),
      turbo:             document.getElementById('turbo-meter'),
      shield:            document.getElementById('shield-meter'),
      flash:             document.getElementById('screen-flash'),
      runHint:           document.getElementById('run-hint'),
      playerNameInput:   document.getElementById('leaderboard-name-input'),
      btnSaveScore:      document.getElementById('btn-save-score'),
      registerFeedback:  document.getElementById('register-feedback')
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

    requestAnimationFrame(this.animate);
  }

  /**
   * Ajusta o buffer do canvas à resolução física da tela, mantendo as
   * coordenadas lógicas em 1280x720. Só mede o layout quando algo mudou —
   * ler getBoundingClientRect a cada quadro força reflow à toa.
   */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
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

    window.addEventListener('keydown', (e) => {
      if (blocked.includes(e.code)) e.preventDefault();
      if (e.repeat) return;

      this.input.down(e.code);
      window.soundSystem.init();

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (this.state === 'PLAYING') this.pauseGame();
        else if (this.state === 'PAUSED') this.resumeGame();
      }

      if (e.code === 'KeyM') this.toggleMute();

      if (e.code === 'Enter') {
        if (this.state === 'MENU' || this.state === 'GAME_OVER' || this.state === 'SELECT_CHAR') this.startPlay();
        else if (this.state === 'PAUSED') this.resumeGame();
      }
    });

    window.addEventListener('keyup', (e) => { this.input.up(e.code); });

    // Perder o foco não pode virar morte na volta
    window.addEventListener('blur', () => {
      this.input.clear();
      if (this.state === 'PLAYING') this.pauseGame();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'PLAYING') this.pauseGame();
    });

    this.bindTouch('touch-accelerate', 'TouchAccelerate');
    this.bindTouch('touch-jump', 'Space');
    this.bindTouch('touch-duck', 'ArrowDown');
    this.bindTouch('touch-trick-1', 'KeyZ');
    this.bindTouch('touch-trick-2', 'KeyX');
    this.bindTouch('touch-trick-3', 'KeyC');
  }

  bindTouch(id, code) {
    const btn = document.getElementById(id);
    if (!btn) return;

    const down = (e) => {
      e.preventDefault();
      window.soundSystem.init();
      btn.classList.add('is-pressed');
      this.input.down(code);
      if (btn.setPointerCapture && e.pointerId !== undefined) {
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      }
    };
    const up = (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      this.input.up(code);
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
    const on = (id, fn, soundKind = 'click') => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => {
        window.soundSystem.init();
        if (soundKind && window.soundSystem.playUI) window.soundSystem.playUI(soundKind);
        fn();
      });
    };

    on('btn-play', () => this.startPlay());
    on('btn-select-char', () => this.showCharacterSelect());
    on('btn-character-creator', () => this.setState('CREATOR'));
    on('btn-leaderboard', () => this.showLeaderboard());
    on('btn-how-to-play', () => this.setState('HOW_TO_PLAY'));
    on('btn-clear-leaderboard', () => this.clearLeaderboard(), 'back');
    on('btn-select-and-play', () => this.startPlay());
    on('btn-pause-hud', () => this.pauseGame());
    on('btn-resume', () => this.resumeGame());
    on('btn-pause-menu', () => this.setState('MENU'), 'back');
    on('btn-restart', () => this.startPlay());
    on('btn-gameover-menu', () => this.setState('MENU'), 'back');
    on('btn-mute-hud', () => this.toggleMute(), null);

    // Salvar pontuação com nome no placar
    const saveScoreHandler = (e) => {
      if (e) e.preventDefault();
      this.saveScoreFromGameOver();
    };

    const form = document.getElementById('form-save-score');
    if (form) form.addEventListener('submit', saveScoreHandler);
    on('btn-save-score', saveScoreHandler);

    document.querySelectorAll('.btn-back-menu').forEach(btn => {
      btn.addEventListener('click', () => {
        window.soundSystem.init();
        if (window.soundSystem.playUI) window.soundSystem.playUI('back');
        this.setState('MENU');
      });
    });

    this.syncMuteButton();
    this.initSportSelector();
    this.initCreator();
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

    // Atualiza os rótulos dos botões touch de manobra conforme o esporte
    const labels = sport.touchLabels || ['FLIP', '360°', 'GRAB'];
    ['touch-trick-1-label', 'touch-trick-2-label', 'touch-trick-3-label'].forEach((id, i) => {
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

  setState(state) {
    this.state = state;
    this.wrapper.dataset.state = state;

    const screens = {
      LOADING:      'screen-loading',
      MENU:         'screen-menu',
      SELECT_CHAR:  'screen-character-select',
      CREATOR:      'screen-character-creator',
      LEADERBOARD:  'screen-leaderboard',
      HOW_TO_PLAY:  'screen-how-to-play',
      PAUSED:       'screen-pause',
      GAME_OVER:    'screen-game-over',
      PLAYING:      null
    };

    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = screens[state];
    if (target) document.getElementById(target).classList.remove('hidden');

    if (state === 'MENU') {
      this.refreshMenuInfo();
      if (window.soundSystem && window.soundSystem.silenceLoops) window.soundSystem.silenceLoops();
      delete this.wrapper.dataset.speedFx;
    }
  }

  refreshMenuInfo() {
    const hs = document.getElementById('menu-highscore');
    const cc = document.getElementById('menu-current-char');
    if (hs) hs.textContent = formatNumber(this.highScore);
    const char = window.characterManager.getSelected();
    if (cc && char) cc.textContent = char.name;
  }

  showCharacterSelect() {
    this.setState('SELECT_CHAR');
    this.renderCharacterCards();
  }

  renderCharacterCards() {
    const grid = document.getElementById('characters-list');
    grid.innerHTML = '';

    window.characterManager.characters.forEach(char => {
      const card = document.createElement('div');
      card.className = 'char-card' + (char.id === window.characterManager.selectedId ? ' selected' : '');

      const stats = char.stats || {};
      card.innerHTML = `
        <span class="char-check">✓</span>
        ${char.isCustom ? '<button class="char-delete" title="Remover personagem">✕</button>' : ''}
        <img class="char-avatar" src="${char.portrait}" alt="${escapeHtml(char.name)}"
             onerror="this.src='${char.sprites.skate}'">
        <div class="char-name">${escapeHtml(char.name)}</div>
        <div class="char-badge">${escapeHtml(char.badge || 'Skatista')}</div>
        <div class="char-desc">${escapeHtml(char.description || '')}</div>
        <div class="char-stats">
          <div class="char-stat"><span>Velocidade</span><b>${escapeHtml(stats.velocidade || 'Alta')}</b></div>
          <div class="char-stat"><span>Salto</span><b>${escapeHtml(stats.salto || 'Alto')}</b></div>
          <div class="char-stat"><span>Manobras</span><b>${escapeHtml(stats.manobras || 'Épicas')}</b></div>
        </div>
      `;

      card.addEventListener('click', () => {
        window.characterManager.select(char.id);
        window.soundSystem.playCoin();
        this.renderCharacterCards();
      });

      const del = card.querySelector('.char-delete');
      if (del) {
        del.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Remover "${char.name}" da lista de personagens?`)) {
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
    const prompt = document.getElementById('creator-upload-prompt');
    const nameInput = document.getElementById('custom-char-name');
    const bodySkaterInput = document.getElementById('custom-body-skater');
    const zoomInput = document.getElementById('custom-face-zoom');
    const offsetYInput = document.getElementById('custom-face-y');
    const saveBtn = document.getElementById('btn-save-custom-char');
    let selectedFile = null;
    let loadedRawImg = null;

    const getOptions = () => ({
      bodyMode: (bodySkaterInput && !bodySkaterInput.checked) ? 'fullphoto' : 'skater',
      faceZoom: zoomInput ? parseFloat(zoomInput.value) || 1.1 : 1.1,
      faceOffsetY: offsetYInput ? parseFloat(offsetYInput.value) || 0 : 0
    });

    const syncSliderState = () => {
      const isSkater = !bodySkaterInput || bodySkaterInput.checked;
      if (zoomInput && zoomInput.parentElement) zoomInput.parentElement.classList.toggle('is-disabled', !isSkater);
      if (offsetYInput && offsetYInput.parentElement) offsetYInput.parentElement.classList.toggle('is-disabled', !isSkater);
    };

    const refreshPreview = () => {
      syncSliderState();
      if (!loadedRawImg) return;
      preview.src = window.characterManager.buildCreatorPreview(loadedRawImg, getOptions());
      preview.hidden = false;
      prompt.style.display = 'none';
    };

    const showPreview = (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          loadedRawImg = img;
          refreshPreview();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    };

    if (bodySkaterInput) bodySkaterInput.addEventListener('change', refreshPreview);
    if (zoomInput) zoomInput.addEventListener('input', refreshPreview);
    if (offsetYInput) offsetYInput.addEventListener('input', refreshPreview);
    syncSliderState();

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });

    ['dragenter', 'dragover'].forEach(ev =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.add('dragover'); }));
    ['dragleave', 'drop'].forEach(ev =>
      dropArea.addEventListener(ev, (e) => { e.preventDefault(); dropArea.classList.remove('dragover'); }));

    dropArea.addEventListener('drop', (e) => showPreview(e.dataTransfer.files[0]));
    fileInput.addEventListener('change', (e) => showPreview(e.target.files[0]));

    saveBtn.addEventListener('click', async () => {
      if (!selectedFile) { dropArea.classList.add('dragover'); setTimeout(() => dropArea.classList.remove('dragover'), 600); return; }

      const name = nameInput.value.trim() || 'Amigo do Luigi';
      const original = saveBtn.textContent;
      saveBtn.textContent = 'Processando…';
      saveBtn.disabled = true;

      try {
        await window.characterManager.createCustomCharacterFromImage(selectedFile, name, getOptions());
        selectedFile = null;
        loadedRawImg = null;
        preview.hidden = true;
        prompt.style.display = '';
        nameInput.value = '';
        fileInput.value = '';
        if (bodySkaterInput) bodySkaterInput.checked = true;
        if (zoomInput) zoomInput.value = '1.10';
        if (offsetYInput) offsetYInput.value = '0';
        syncSliderState();
        this.showCharacterSelect();
      } catch (err) {
        console.error(err);
        alert('Não foi possível processar a imagem. Tente outro arquivo JPG ou PNG.');
      } finally {
        saveBtn.textContent = original;
        saveBtn.disabled = false;
      }
    });
  }

  // ==========================================================
  // Fluxo de partida
  // ==========================================================

  startPlay() {
    this.world.reset();
    if (this.player.setSport) this.player.setSport(this.selectedSport);
    this.player.reset(this.world);
    this.camera.reset();
    window.particleSystem.clear();

    this.input.clear();
    this.accumulator = 0;
    this.lastTime = performance.now();
    this.hudCache = {};
    this.comboBankTimer = 0;
    this.comboBankMult = 1;
    this.comboBankPoints = 0;

    this.setState('PLAYING');
    window.soundSystem.startMusic();

    this.el.runHint.classList.add('visible');
    clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => this.el.runHint.classList.remove('visible'), 3400);
  }

  pauseGame() {
    if (this.state !== 'PLAYING') return;
    this.setState('PAUSED');
    window.soundSystem.stopMusic();
    if (window.soundSystem.silenceLoops) window.soundSystem.silenceLoops();
  }

  resumeGame() {
    if (this.state !== 'PAUSED') return;
    this.setState('PLAYING');
    this.lastTime = performance.now();
    this.accumulator = 0;
    window.soundSystem.startMusic();
  }

  gameOver() {
    this.setState('GAME_OVER');
    window.soundSystem.stopMusic();
    if (window.soundSystem.silenceLoops) window.soundSystem.silenceLoops();
    delete this.wrapper.dataset.speedFx;

    const p = this.player;
    document.getElementById('final-score').textContent = formatNumber(p.score);
    document.getElementById('final-distance').textContent = Math.floor(p.distance) + 'm';
    document.getElementById('final-coins').textContent = p.coins;
    document.getElementById('final-combo').textContent = 'x' + p.bestCombo;
    document.getElementById('gameover-reason').textContent = p.deathReason || 'Boa sessão de skate!';

    // Prepara o formulário de nome do jogador
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

    // Renderiza a lista atualizada de líderes no Game Over
    this.renderLeaderboard('gameover-leaderboard-list');

    // Destaque de novo recorde geral
    const topScore = this.leaderboard.getTopScore();
    const banner = document.getElementById('new-record-banner');
    if (banner) {
      banner.hidden = p.score <= topScore || p.score === 0;
    }
  }

  saveScoreFromGameOver() {
    const p = this.player;
    const input = this.el.playerNameInput;
    const name = (input && input.value ? input.value : '').trim() || (this.lastPlayerName || 'Luigi');
    this.lastPlayerName = name;
    try { localStorage.setItem('luigi_skate_last_player_name', name); } catch (_) {}

    const char = window.characterManager.getSelected();
    const sport = this.getSportInfo(this.selectedSport);
    const entry = this.leaderboard.addEntry({
      name,
      score: p.score,
      distance: p.distance,
      characterName: char ? char.name : 'Luigi',
      characterPortrait: char ? (char.portrait || char.sprites.skate) : 'assets/portraits/portrait_luigi_3d.png',
      sportId: sport.id,
      sportIcon: sport.icon
    });

    if (this.el.registerFeedback) {
      this.el.registerFeedback.hidden = false;
      this.el.registerFeedback.textContent = `🎉 Pontuação de ${name} (${formatNumber(entry.score)} pts) gravada no placar!`;
    }
    if (this.el.btnSaveScore) {
      this.el.btnSaveScore.disabled = true;
      this.el.btnSaveScore.innerHTML = '<span>✓</span> Gravado!';
    }

    this.highScore = this.leaderboard.getTopScore();
    if (this.el.highscore) this.el.highscore.textContent = formatNumber(this.highScore);
    const hs = document.getElementById('menu-highscore');
    if (hs) hs.textContent = formatNumber(this.highScore);

    this.renderLeaderboard('gameover-leaderboard-list');
    window.soundSystem.playCoin();
  }

  showLeaderboard() {
    this.setState('LEADERBOARD');
    this.renderLeaderboard('main-leaderboard-list');
  }

  clearLeaderboard() {
    if (confirm('Tem certeza que deseja zerar todas as pontuações do placar?')) {
      this.leaderboard.clear();
      this.highScore = 0;
      if (this.el.highscore) this.el.highscore.textContent = '0';
      const hs = document.getElementById('menu-highscore');
      if (hs) hs.textContent = '0';
      this.renderLeaderboard('main-leaderboard-list');
      this.renderLeaderboard('gameover-leaderboard-list');
    }
  }

  renderLeaderboard(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const list = this.leaderboard.getAll();
    if (list.length === 0) {
      container.innerHTML = `
        <div class="leaderboard-empty">
          <p>🛹 <b>Nenhuma pontuação registrada ainda!</b></p>
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

      html += `
        <div class="leader-item ${rankClass}">
          <div class="leader-col-left">
            <span class="leader-rank">${rankBadge}</span>
            <img class="leader-avatar" src="${escapeHtml(item.characterPortrait)}" alt="${escapeHtml(item.characterName)}" onerror="this.src='assets/sprites/luigi_3d_skate.png'">
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

    // Vidas (suporte a até 5 vidas com ícone do esporte ativo)
    const lives = Math.max(0, p.lives);
    const maxLives = p.maxLives || 5;
    const lifeIcon = this.getSportInfo(this.selectedSport).icon || '🛹';
    const livesKey = `${lives}:${lifeIcon}`;
    if (this.hudCache.lives !== livesKey) {
      this.hudCache.lives = livesKey;
      let html = '';
      for (let i = 0; i < maxLives; i++) {
        html += `<span class="${i < lives ? '' : 'life-lost'}">${lifeIcon}</span>`;
      }
      this.el.lives.innerHTML = html;
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
    const displayAction = isGrinding
      ? 'GRIND!'
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

    // Medidores
    this.setMeter(this.el.turbo, p.turboTimer > 0, p.turboTimer / (p.turboDuration || 1));
    this.setMeter(this.el.shield, p.hasShield, 1);
  }

  onStageUnlocked(stage) {
    const banner = this.el.stageBanner;
    if (!banner) return;

    // As duas ocupam o mesmo canto do rodapé; a dica sai de cena para o aviso
    if (this.el.runHint) this.el.runHint.classList.remove('visible');
    clearTimeout(this._hintTimer);
    this.el.stageBannerIcon.textContent = stage.icon || '🎉';
    this.el.stageBannerTitle.textContent = `FASE ${this.player.currentStageIndex + 1} DESBLOQUEADA!`;
    this.el.stageBannerName.textContent = stage.name;
    banner.classList.add('active');

    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    this._bannerTimer = setTimeout(() => {
      banner.classList.remove('active');
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

    // Consome eventos físicos do passo para feedback de câmera e HUD
    if (Array.isArray(p.frameEvents) && p.frameEvents.length > 0) {
      for (const ev of p.frameEvents) {
        if (ev.type === 'perfect_land') {
          this.camera.punchZoom(0.016);
          this.comboBankMult = Math.max(2, prevComboMult);
          this.comboBankPoints = prevComboPts > 0 ? prevComboPts : (this.comboBankMult * 300);
          this.comboBankTimer = 68;
        } else if (ev.type === 'land' && ev.intensity > 0.55) {
          this.camera.shake(Math.min(7, ev.intensity * 6.5), 0.15, 1.0);
        } else if (ev.type === 'ramp') {
          if (ev.boosted) {
            this.camera.punchZoom(-0.032);
            this.camera.shake(4.5, 0.2, 0.9);
            this.flash('power');
          } else {
            this.camera.punchZoom(-0.022);
          }
        } else if (ev.type === 'grind_start') {
          this.camera.shake(3.2, 0.25, 0.85);
        } else if (ev.type === 'damage') {
          this.camera.shake(14, 1.0, 0.35);
        }
      }
    }

    // Atualiza som ambiente de vento proporcional à velocidade e altura
    const speedNorm = p.speedNormalized !== undefined ? p.speedNormalized : (p.speed / (p.maxSpeed || 12.5));
    const altitude = p.airHeight !== undefined ? p.airHeight : Math.max(0, this.world.groundY - p.bottom);
    if (window.soundSystem && window.soundSystem.updateWind) {
      window.soundSystem.updateWind(speedNorm, altitude);
    }

    if (p.isGameOver) this.gameOver();
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
