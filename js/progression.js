// ============================================================
// Progressão, Economia de Moedas, Oficina/Loja, Missões e Troféus
// ============================================================

const PROGRESSION_STORAGE_KEY = 'luigi_skate_progression_v1';
const PROGRESSION_V2_STORAGE_KEY = 'luigi_skate_progression_v2';
const DEFAULT_UNLOCKED_CHARACTERS = ['luigi_3d', 'luigi_real', 'luna_radical'];
const VALID_SHOP_CATEGORIES = ['gear', 'trails', 'accessories', 'characters'];
const VALID_SPORTS_LIST = ['skate', 'bmx', 'scooter', 'skates'];
const VALID_UPGRADE_KEYS = ['magnet', 'turbo', 'fever', 'coinBonus'];

const RANK_TITLES = [
  'Novato na Pista',
  'Skatista de Rua',
  'Mestre do Ollie',
  'Radical',
  'Pro das Rampas',
  'Rei do Grind',
  'Estrela Neon',
  'Lenda Cósmica'
];

const SHOP_CATALOG = {
  gear: [
    {
      id: 'classic',
      name: 'Clássico SK8',
      desc: 'Visual oficial equilibrado para todos os esportes.',
      price: 0,
      icon: '🛹',
      primary: '#22d3ee',
      secondary: '#8b5cf6',
      accent: '#f43f7e',
      frame: '#ef4444'
    },
    {
      id: 'neon',
      name: 'Cyber Neon',
      desc: 'Brilho ciano e magenta das pistas noturnas.',
      price: 250,
      icon: '⚡',
      primary: '#00f5d4',
      secondary: '#f72585',
      accent: '#38bdf8',
      frame: '#00f5d4'
    },
    {
      id: 'lava',
      name: 'Fogo & Lava',
      desc: 'Shape e quadro em brasas incandescentes.',
      price: 550,
      icon: '🔥',
      primary: '#f97316',
      secondary: '#dc2626',
      accent: '#fde047',
      frame: '#f97316'
    },
    {
      id: 'galaxy',
      name: 'Galáxia Roxa',
      desc: 'Acabamento espacial com energia violeta.',
      price: 1000,
      icon: '🌌',
      primary: '#a855f7',
      secondary: '#3b82f6',
      accent: '#f0abfc',
      frame: '#a855f7'
    },
    {
      id: 'gold',
      name: 'Campeão Dourado',
      desc: 'Ouro puro para quem domina todas as manobras!',
      price: 1800,
      icon: '👑',
      primary: '#fbbf24',
      secondary: '#f59e0b',
      accent: '#fef08a',
      frame: '#fbbf24'
    },
    {
      id: 'prisma',
      name: 'Prisma Lendário',
      desc: 'Visual diamante arco-íris reservado às lendas da pista!',
      price: 3000,
      icon: '💎',
      primary: '#38bdf8',
      secondary: '#e879f9',
      accent: '#fde047',
      frame: '#f472b6'
    }
  ],
  trails: [
    {
      id: 'classic',
      name: 'Rastro Padrão',
      desc: 'Fumaça leve e brilho discreto de velocidade.',
      price: 0,
      icon: '💨',
      colors: ['226, 232, 240']
    },
    {
      id: 'rainbow',
      name: 'Arco-Íris',
      desc: 'Explosão colorida atrás do personagem!',
      price: 300,
      icon: '🌈',
      colors: ['244, 63, 126', '251, 191, 36', '52, 211, 153', '34, 211, 238', '168, 85, 247']
    },
    {
      id: 'fire',
      name: 'Chamas Turbo',
      desc: 'Faíscas de fogo intenso no asfalto e no ar.',
      price: 600,
      icon: '🔥',
      colors: ['254, 240, 138', '249, 115, 22', '239, 68, 68']
    },
    {
      id: 'electric',
      name: 'Raio Elétrico',
      desc: 'Descargas ciano e azul de alta voltagem.',
      price: 1100,
      icon: '⚡',
      colors: ['224, 242, 254', '34, 211, 238', '59, 130, 246']
    },
    {
      id: 'stars',
      name: 'Poeira Estelar',
      desc: 'Brilho cósmico violeta e dourado.',
      price: 1700,
      icon: '✨',
      colors: ['254, 240, 138', '192, 132, 252', '244, 114, 182']
    },
    {
      id: 'supernova',
      name: 'Supernova Diamante',
      desc: 'Explosão de brilho diamante e neon digna de campeão!',
      price: 2600,
      icon: '🌠',
      colors: ['186, 230, 253', '244, 114, 182', '253, 224, 71', '167, 139, 250', '52, 211, 153']
    }
  ],
  accessories: [
    { id: 'none',       name: 'Sem Acessório',    desc: 'Visual limpo mostrando o capacete ou cabelo.', price: 0,   icon: '🧢' },
    { id: 'shades',     name: 'Óculos Radical',   desc: 'Óculos estilosos que combinam com qualquer foto.', price: 0, icon: '🕶️' },
    { id: 'cap',        name: 'Boné Virado',      desc: 'Boné skatista virado para trás.', price: 150,  icon: '🧢' },
    { id: 'headphones', name: 'Fone DJ Neon',     desc: 'Fones brilhantes para curtir a trilha sonora.', price: 320,  icon: '🎧' },
    { id: 'dino',       name: 'Crista de Dino',   desc: 'Crista divertida de dinossauro no capacete!', price: 650, icon: '🦖' },
    { id: 'astro',      name: 'Antena Espacial',  desc: 'Antena luminosa de explorador das estrelas.', price: 1100, icon: '🛸' },
    { id: 'crown',      name: 'Coroa de Campeão', desc: 'Coroa dourada digna do 1º lugar!', price: 1900, icon: '👑' }
  ],
  upgrades: [
    {
      id: 'magnet',
      name: 'Ímã Turbinado',
      desc: 'Aumenta o alcance e a duração do Ímã de Moedas.',
      icon: '🧲',
      costs: [200, 450, 900, 1600]
    },
    {
      id: 'turbo',
      name: 'Super Turbo+',
      desc: 'Faz o Turbo e o Modo Foguete durarem mais tempo.',
      icon: '🚀',
      costs: [200, 450, 900, 1600]
    },
    {
      id: 'fever',
      name: 'Carga Radical',
      desc: 'Enche a barra do Modo Radical mais rápido nas manobras.',
      icon: '🔥',
      costs: [250, 550, 1100, 1800]
    },
    {
      id: 'coinBonus',
      name: 'Cofre de Ouro',
      desc: 'Ganha +15% moedas extras no final de cada partida por nível.',
      icon: '🪙',
      costs: [300, 650, 1300, 2200]
    }
  ],
  characters: [
    { id: 'luigi_3d',     name: 'Luigi 3D (SK8-BOY)', price: 0,   icon: '🛹', desc: 'O protagonista clássico da pista!' },
    { id: 'luigi_real',   name: 'Luigi Real',         price: 0,   icon: '📸', desc: 'Versão realista clássica com skate street.' },
    { id: 'luna_radical', name: 'Luna Radical',       price: 0,   icon: '🎀', desc: 'Skatista ágil cheia de estilo neon.' },
    { id: 'leo_cosmic',   name: 'Léo Espacial',       price: 750, icon: '🚀', desc: 'Aventureiro cósmico pronto para a Fase 4!' }
  ]
};

const MISSION_POOL = [
  { type: 'trick',     label: 'Faça {t} manobras no ar',        targets: [6, 12, 18],     rewards: [30, 50, 75] },
  { type: 'grind',     label: 'Deslize em {t} corrimãos',       targets: [4, 8, 12],      rewards: [30, 50, 75] },
  { type: 'coin',      label: 'Colete {t} moedas',              targets: [35, 70, 120],   rewards: [30, 50, 75] },
  { type: 'lip_boost', label: 'Acerte {t} Lip Boosts em rampas', targets: [3, 6, 9],      rewards: [35, 55, 80] },
  { type: 'smash',     label: 'Quebre {t} obstáculos no Turbo/Radical', targets: [3, 6, 10], rewards: [35, 55, 80] },
  { type: 'near_miss', label: 'Faça {t} desvios "QUASE!"',      targets: [3, 6, 10],      rewards: [35, 55, 80] },
  { type: 'fever',     label: 'Ative o Modo Radical {t} vez(es)', targets: [1, 2, 4],     rewards: [40, 65, 90] },
  { type: 'distance',  label: 'Percorra {t}m acumulados',       targets: [700, 1400, 2200], rewards: [35, 55, 85] },
  { type: 'word',      label: 'Complete a palavra L-U-I-G-I',   targets: [1],             rewards: [70] }
];

const ACHIEVEMENTS_CATALOG = [
  { id: 'first_run',    name: 'Primeira Sessão',   desc: 'Complete sua primeira corrida na pista.',            icon: '🛹', reward: 25 },
  { id: 'trick_master', name: 'Rei das Manobras',  desc: 'Acumule 30 manobras aéreas em corridas.',            icon: '🌀', reward: 50 },
  { id: 'combo_king',   name: 'Combo Insano x6',   desc: 'Alcance um combo x6 ou maior numa única jogada.',    icon: '⚡', reward: 60 },
  { id: 'smasher',      name: 'Demolidor Turbo',   desc: 'Quebre 10 obstáculos usando Turbo ou Modo Radical.', icon: '💥', reward: 55 },
  { id: 'word_hunter',  name: 'Caçador de Letras', desc: 'Complete a palavra L-U-I-G-I na pista.',             icon: '🔤', reward: 65 },
  { id: 'rich_kid',     name: 'Cofre Cheio',       desc: 'Junte 1.000 moedas acumuladas na carreira.',         icon: '🪙', reward: 80 },
  { id: 'space_rider',      name: 'Viajante Espacial', desc: 'Alcance a Fase 4 (Pista Cósmica - 2.400m).',        icon: '🚀', reward: 120 },
  { id: 'fashion_star',     name: 'Estilo Próprio',    desc: 'Compre qualquer item na Oficina Radical.',           icon: '✨', reward: 35 },
  { id: 'loop_rider',       name: 'Mestre do Looping', desc: 'Complete um Looping 360° radical na pista!',         icon: '➰', reward: 75 },
  { id: 'glacier_explorer', name: 'Volta ao Mundo',    desc: 'Alcance a Fase 6 (Geleira Aurora - 4.600m).',       icon: '❄️', reward: 150 }
];

class ProgressionManager {
  constructor() {
    this.activeProfileId = 'luigi_3d';
    this.unlockedCharacters = [...DEFAULT_UNLOCKED_CHARACTERS];
    this.lastSyncedUid = null;
    this.onChange = null;
    this.profiles = {};
    this.data = this._defaultProfileState('luigi_3d');
    this.load();
  }

  _defaultProfileState(profileId = 'luigi_3d', charHint = null) {
    const pid = (typeof profileId === 'string' && profileId.trim()) ? profileId.trim() : 'luigi_3d';
    const baseAcc = ['none', 'shades'];
    if (pid === 'leo_cosmic' || (charHint && charHint.id === 'leo_cosmic')) {
      baseAcc.push('astro');
    }
    let initialAcc = 'none';
    if (pid === 'luna_radical') initialAcc = 'shades';
    else if (pid === 'leo_cosmic') initialAcc = 'astro';
    else if (charHint && typeof charHint.accessory === 'string' && baseAcc.includes(charHint.accessory)) {
      initialAcc = charHint.accessory;
    }

    let preferredSport = 'skate';
    if (pid === 'luna_radical') preferredSport = 'skates';
    else if (pid === 'leo_cosmic') preferredSport = 'bmx';
    else if (charHint && VALID_SPORTS_LIST.includes(charHint.preferredSport)) {
      preferredSport = charHint.preferredSport;
    }

    return {
      coinsBank: 50,
      rankLevel: 1,
      missionsCompletedTotal: 0,
      unlockedStageIndex: 0,
      highScore: 0,
      highScoreTime60: 0,
      preferredSport,
      owned: {
        gear: ['classic'],
        trails: ['classic'],
        accessories: baseAcc,
        characters: [...this.unlockedCharacters]
      },
      equipped: {
        gear: 'classic',
        trail: 'classic',
        accessory: initialAcc,
        disabledUpgrades: []
      },
      upgrades: {
        magnet: 0,
        turbo: 0,
        fever: 0,
        coinBonus: 0
      },
      activeMissions: [],
      achievements: {},
      stats: {
        totalRuns: 0,
        totalCoins: 0,
        totalTricks: 0,
        totalGrinds: 0,
        totalSmashes: 0,
        totalNearMiss: 0,
        totalWords: 0,
        totalLoops: 0,
        bestCombo: 1,
        bestDistance: 0
      },
      clientUpdatedAt: Date.now()
    };
  }

  _defaultState() {
    return this._defaultProfileState(this.activeProfileId || 'luigi_3d');
  }

  _safeInt(val, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER) {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(n)));
  }

  _isPlainObject(val) {
    return !!val && typeof val === 'object' && !Array.isArray(val);
  }

  _sanitizeOwnedList(rawList, fallbackList) {
    const base = Array.isArray(rawList) ? rawList : fallbackList;
    const seen = new Set();
    const out = [];
    for (const id of base) {
      if (typeof id === 'string' && id.trim() && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  }

  _sanitizeMissions(rawList) {
    if (!Array.isArray(rawList)) return [];
    const validTypes = new Set(MISSION_POOL.map(m => m.type));
    const seenTypes = new Set();
    const cleaned = [];
    for (const m of rawList) {
      if (!this._isPlainObject(m)) continue;
      if (typeof m.type !== 'string' || !validTypes.has(m.type) || seenTypes.has(m.type)) continue;
      const target = this._safeInt(m.target, 0, 1, 1000000);
      if (target <= 0) continue;
      const reward = this._safeInt(m.reward, 30, 1, 10000);
      const progress = this._safeInt(m.progress, 0, 0, target);
      const done = Boolean(m.done) || progress >= target;
      const poolDef = MISSION_POOL.find(p => p.type === m.type);
      const fallbackLabel = poolDef
        ? poolDef.label.replace('{t}', String(target)).replace('vez(es)', target === 1 ? 'vez' : 'vezes')
        : 'Complete o objetivo';
      const label = (typeof m.label === 'string' && m.label.trim())
        ? m.label.trim().replace('vez(es)', target === 1 ? 'vez' : 'vezes')
        : fallbackLabel;
      seenTypes.add(m.type);
      cleaned.push({
        id: (typeof m.id === 'string' && m.id.trim()) ? m.id : ('m_' + Date.now() + '_' + cleaned.length),
        type: m.type,
        label,
        target,
        progress: done ? target : progress,
        reward,
        done
      });
      if (cleaned.length >= 3) break;
    }
    return cleaned;
  }

  _sanitizeProfile(raw, profileId = 'luigi_3d', charHint = null) {
    const def = this._defaultProfileState(profileId, charHint);
    let profile = def;

    if (this._isPlainObject(raw)) {
      const pOwned = this._isPlainObject(raw.owned) ? raw.owned : {};
      const pEquipped = this._isPlainObject(raw.equipped) ? raw.equipped : {};
      const pUpgrades = this._isPlainObject(raw.upgrades) ? raw.upgrades : {};
      const pStats = this._isPlainObject(raw.stats) ? raw.stats : {};
      const pAch = this._isPlainObject(raw.achievements) ? raw.achievements : {};

      const safeUpgrades = { ...def.upgrades };
      for (const upg of SHOP_CATALOG.upgrades) {
        safeUpgrades[upg.id] = this._safeInt(pUpgrades[upg.id], 0, 0, upg.costs.length);
      }

      const safeAchievements = {};
      for (const a of ACHIEVEMENTS_CATALOG) {
        if (pAch[a.id]) {
          safeAchievements[a.id] = this._safeInt(pAch[a.id], Date.now(), 1);
        }
      }

      const safeDisabledUpgrades = Array.isArray(pEquipped.disabledUpgrades)
        ? Array.from(new Set(pEquipped.disabledUpgrades.filter(k => VALID_UPGRADE_KEYS.includes(k))))
        : [];

      const safeSport = (typeof raw.preferredSport === 'string' && VALID_SPORTS_LIST.includes(raw.preferredSport))
        ? raw.preferredSport
        : def.preferredSport;

      profile = {
        coinsBank: this._safeInt(raw.coinsBank, def.coinsBank, 0, 99999999),
        rankLevel: this._safeInt(raw.rankLevel, def.rankLevel, 1, 999),
        missionsCompletedTotal: this._safeInt(raw.missionsCompletedTotal, 0, 0, 999999),
        unlockedStageIndex: this._safeInt(raw.unlockedStageIndex, 0, 0, 5),
        highScore: this._safeInt(raw.highScore, 0, 0, 99999999),
        highScoreTime60: this._safeInt(raw.highScoreTime60, 0, 0, 99999999),
        preferredSport: safeSport,
        owned: {
          gear: this._sanitizeOwnedList(pOwned.gear, def.owned.gear),
          trails: this._sanitizeOwnedList(pOwned.trails, def.owned.trails),
          accessories: this._sanitizeOwnedList(pOwned.accessories, def.owned.accessories),
          characters: this._sanitizeOwnedList(pOwned.characters, def.owned.characters)
        },
        equipped: {
          gear: typeof pEquipped.gear === 'string' ? pEquipped.gear : def.equipped.gear,
          trail: typeof pEquipped.trail === 'string' ? pEquipped.trail : def.equipped.trail,
          accessory: typeof pEquipped.accessory === 'string' ? pEquipped.accessory : def.equipped.accessory,
          disabledUpgrades: safeDisabledUpgrades
        },
        upgrades: safeUpgrades,
        activeMissions: this._sanitizeMissions(raw.activeMissions),
        achievements: safeAchievements,
        stats: {
          totalRuns: this._safeInt(pStats.totalRuns, 0, 0),
          totalCoins: this._safeInt(pStats.totalCoins, 0, 0),
          totalTricks: this._safeInt(pStats.totalTricks, 0, 0),
          totalGrinds: this._safeInt(pStats.totalGrinds, 0, 0),
          totalSmashes: this._safeInt(pStats.totalSmashes, 0, 0),
          totalNearMiss: this._safeInt(pStats.totalNearMiss, 0, 0),
          totalWords: this._safeInt(pStats.totalWords, 0, 0),
          totalLoops: this._safeInt(pStats.totalLoops, 0, 0),
          bestCombo: this._safeInt(pStats.bestCombo, 1, 1),
          bestDistance: this._safeInt(pStats.bestDistance, 0, 0)
        },
        clientUpdatedAt: this._safeInt(raw.clientUpdatedAt, Date.now(), 1)
      };
    }

    // Garante itens gratuitos básicos e itens nativos do personagem
    for (const cat of VALID_SHOP_CATEGORIES) {
      if (!Array.isArray(profile.owned[cat])) profile.owned[cat] = [];
      for (const item of SHOP_CATALOG[cat] || []) {
        if (item.price === 0 && !profile.owned[cat].includes(item.id)) {
          profile.owned[cat].push(item.id);
        }
      }
    }
    if (profileId === 'leo_cosmic' && !profile.owned.accessories.includes('astro')) {
      profile.owned.accessories.push('astro');
    }

    for (const cid of profile.owned.characters) {
      if (!this.unlockedCharacters.includes(cid)) {
        this.unlockedCharacters.push(cid);
      }
    }
    profile.owned.characters = [...this.unlockedCharacters];

    if (!SHOP_CATALOG.gear.some(g => g.id === profile.equipped.gear) || !profile.owned.gear.includes(profile.equipped.gear)) {
      profile.equipped.gear = 'classic';
    }
    if (!SHOP_CATALOG.trails.some(t => t.id === profile.equipped.trail) || !profile.owned.trails.includes(profile.equipped.trail)) {
      profile.equipped.trail = 'classic';
    }
    if (!SHOP_CATALOG.accessories.some(a => a.id === profile.equipped.accessory) || !profile.owned.accessories.includes(profile.equipped.accessory)) {
      profile.equipped.accessory = 'none';
    }

    if (profile.activeMissions.length !== 3 || profile.activeMissions.every(m => m.done)) {
      this._refillMissions(profile);
    }
    return profile;
  }

  load() {
    this.unlockedCharacters = [...DEFAULT_UNLOCKED_CHARACTERS];
    this.profiles = {};
    this.lastSyncedUid = null;
    let selectedChar = 'luigi_3d';
    try {
      const sc = localStorage.getItem('luigi_selected_char');
      if (sc && sc.trim()) selectedChar = sc.trim();
    } catch (_) {}

    let loadedV2 = false;
    try {
      const rawV2 = localStorage.getItem(PROGRESSION_V2_STORAGE_KEY);
      if (rawV2) {
        const parsedV2 = JSON.parse(rawV2);
        if (this._isPlainObject(parsedV2) && this._isPlainObject(parsedV2.profiles)) {
          loadedV2 = true;
          this.unlockedCharacters = this._sanitizeOwnedList(parsedV2.unlockedCharacters, DEFAULT_UNLOCKED_CHARACTERS);
          for (const id of DEFAULT_UNLOCKED_CHARACTERS) {
            if (!this.unlockedCharacters.includes(id)) this.unlockedCharacters.push(id);
          }
          if (typeof parsedV2.lastSyncedUid === 'string' && parsedV2.lastSyncedUid.trim()) {
            this.lastSyncedUid = parsedV2.lastSyncedUid.trim();
          }
          for (const [pid, rawProf] of Object.entries(parsedV2.profiles)) {
            if (typeof pid === 'string' && pid.trim()) {
              this.profiles[pid.trim()] = this._sanitizeProfile(rawProf, pid.trim());
            }
          }
          if (typeof parsedV2.activeProfileId === 'string' && parsedV2.activeProfileId.trim()) {
            this.activeProfileId = parsedV2.activeProfileId.trim();
          } else {
            this.activeProfileId = selectedChar;
          }
        }
      }
    } catch (_) {
      loadedV2 = false;
    }

    if (!loadedV2) {
      let legacyRaw = null;
      let legacyHighScore = 0;
      try {
        const rawV1 = localStorage.getItem(PROGRESSION_STORAGE_KEY);
        if (rawV1) legacyRaw = JSON.parse(rawV1);
        legacyHighScore = this._safeInt(localStorage.getItem('luigi_skate_high_score'), 0, 0, 99999999);
      } catch (_) {}

      this.activeProfileId = selectedChar || 'luigi_3d';
      const migrated = this._sanitizeProfile(legacyRaw, this.activeProfileId);
      migrated.highScore = Math.max(migrated.highScore || 0, legacyHighScore);
      this.profiles[this.activeProfileId] = migrated;
    }

    for (const defId of DEFAULT_UNLOCKED_CHARACTERS) {
      if (!this.profiles[defId]) {
        this.profiles[defId] = this._sanitizeProfile(null, defId);
      }
    }
    if (!this.profiles[this.activeProfileId]) {
      this.profiles[this.activeProfileId] = this._sanitizeProfile(null, this.activeProfileId);
    }

    this.data = this.profiles[this.activeProfileId];
    this.save();
  }

  save(reason = null, profileId = null) {
    try {
      const payload = {
        version: 2,
        activeProfileId: this.activeProfileId,
        unlockedCharacters: [...this.unlockedCharacters],
        lastSyncedUid: this.lastSyncedUid,
        profiles: this.profiles
      };
      localStorage.setItem(PROGRESSION_V2_STORAGE_KEY, JSON.stringify(payload));
      if (this.data) {
        localStorage.setItem(PROGRESSION_STORAGE_KEY, JSON.stringify(this.data));
      }
    } catch (_) {}

    if (reason && typeof this.onChange === 'function') {
      try {
        this.onChange(reason, profileId || this.activeProfileId);
      } catch (_) {}
    }
  }

  _touchAndSave(reason = 'update', profileId = null) {
    const pid = profileId || this.activeProfileId;
    if (this.profiles[pid]) {
      this.profiles[pid].clientUpdatedAt = Date.now();
    }
    this.save(reason, pid);
  }

  hasProfile(charId) {
    return Boolean(typeof charId === 'string' && charId.trim() && this.profiles && this.profiles[charId.trim()]);
  }

  setActiveProfile(charId, charHint = null) {
    const pid = (typeof charId === 'string' && charId.trim()) ? charId.trim() : 'luigi_3d';
    const created = !this.profiles[pid];
    if (created) {
      this.profiles[pid] = this._sanitizeProfile(null, pid, charHint);
    } else {
      this.profiles[pid].owned.characters = [...this.unlockedCharacters];
    }
    const prevId = this.activeProfileId;
    this.activeProfileId = pid;
    this.data = this.profiles[pid];
    this.save(created ? 'profile_create' : (prevId !== pid ? 'profile_switch' : null), pid);
    return this.data;
  }

  deleteProfile(charId) {
    if (!charId || DEFAULT_UNLOCKED_CHARACTERS.includes(charId) || charId === 'leo_cosmic') return false;
    if (this.profiles[charId]) {
      delete this.profiles[charId];
      if (this.activeProfileId === charId) {
        const nextId = Object.keys(this.profiles)[0] || 'luigi_3d';
        this.setActiveProfile(nextId);
      } else {
        this.save();
      }
      return true;
    }
    return false;
  }

  getProfileSummary(charId) {
    const pid = (typeof charId === 'string' && charId.trim()) ? charId.trim() : this.activeProfileId;
    const p = this.profiles[pid] || this._defaultProfileState(pid);
    const lvl = this._safeInt(p.rankLevel, 1, 1, 999);
    const titleIdx = Math.min(RANK_TITLES.length - 1, lvl - 1);
    return {
      profileId: pid,
      coins: this._safeInt(p.coinsBank, 0, 0, 99999999),
      rankLevel: lvl,
      rankTitle: RANK_TITLES[titleIdx],
      highScore: this._safeInt(p.highScore, 0, 0, 99999999),
      highScoreTime60: this._safeInt(p.highScoreTime60, 0, 0, 99999999),
      bestDistance: this._safeInt(p.stats && p.stats.bestDistance, 0, 0),
      unlockedStageIndex: this._safeInt(p.unlockedStageIndex, 0, 0, 5),
      preferredSport: VALID_SPORTS_LIST.includes(p.preferredSport) ? p.preferredSport : 'skate',
      equipped: p.equipped ? { ...p.equipped } : { gear: 'classic', trail: 'classic', accessory: 'none', disabledUpgrades: [] },
      totalRuns: this._safeInt(p.stats && p.stats.totalRuns, 0, 0)
    };
  }

  getHighScore(mode = 'classic') {
    if (mode === 'time60') {
      return this._safeInt(this.data.highScoreTime60, 0, 0, 99999999);
    }
    return this._safeInt(this.data.highScore, 0, 0, 99999999);
  }

  recordHighScore(score, mode = 'classic') {
    const val = this._safeInt(score, 0, 0, 99999999);
    if (val <= 0) return false;
    let isNew = false;
    if (mode === 'time60') {
      const cur = this.getHighScore('time60');
      if (val > cur) {
        this.data.highScoreTime60 = val;
        isNew = true;
      }
    } else {
      const cur = this.getHighScore('classic');
      if (val > cur) {
        this.data.highScore = val;
        isNew = true;
      }
    }
    if (isNew) {
      this._touchAndSave('score', this.activeProfileId);
    }
    return isNew;
  }

  getPreferredSport() {
    const sp = this.data && this.data.preferredSport;
    return VALID_SPORTS_LIST.includes(sp) ? sp : 'skate';
  }

  setPreferredSport(sportId) {
    if (!VALID_SPORTS_LIST.includes(sportId)) return;
    if (this.data.preferredSport !== sportId) {
      this.data.preferredSport = sportId;
      this._touchAndSave('sport', this.activeProfileId);
    }
  }

  // ---- Consultas e bônus ----

  getCoins() {
    return this._safeInt(this.data.coinsBank, 0, 0, 99999999);
  }

  addCoins(amount) {
    const val = this._safeInt(amount, 0, 0, 9999999);
    if (val <= 0) return 0;
    this.data.coinsBank = this.getCoins() + val;
    this._touchAndSave('coins', this.activeProfileId);
    return val;
  }

  getRankLevel() {
    return this._safeInt(this.data.rankLevel, 1, 1, 999);
  }

  getRankTitle() {
    const idx = Math.min(RANK_TITLES.length - 1, this.getRankLevel() - 1);
    return RANK_TITLES[idx];
  }

  getScoreMultiplier() {
    const raw = Math.min(2.5, 1 + (this.getRankLevel() - 1) * 0.1);
    return Math.round(raw * 10) / 10;
  }

  getUnlockedStageIndex() {
    return this._safeInt(this.data.unlockedStageIndex, 0, 0, 5);
  }

  unlockStage(stageIndex) {
    const idx = this._safeInt(stageIndex, 0, 0, 5);
    if (idx > this.getUnlockedStageIndex()) {
      this.data.unlockedStageIndex = idx;
      this._touchAndSave('stage', this.activeProfileId);
      return true;
    }
    return false;
  }

  getUpgradeLevel(key) {
    const upg = SHOP_CATALOG.upgrades.find(u => u.id === key);
    const maxLvl = upg ? upg.costs.length : 4;
    return this._safeInt(this.data.upgrades && this.data.upgrades[key], 0, 0, maxLvl);
  }

  isUpgradeEnabled(key) {
    const disabled = this.data && this.data.equipped && this.data.equipped.disabledUpgrades;
    return !Array.isArray(disabled) || !disabled.includes(key);
  }

  getEffectiveUpgradeLevel(key) {
    if (!this.isUpgradeEnabled(key)) return 0;
    return this.getUpgradeLevel(key);
  }

  toggleUpgradeEnabled(key) {
    if (!VALID_UPGRADE_KEYS.includes(key)) return { ok: false, reason: 'invalid_upgrade' };
    if (this.getUpgradeLevel(key) <= 0) return { ok: false, reason: 'not_owned' };
    if (!Array.isArray(this.data.equipped.disabledUpgrades)) {
      this.data.equipped.disabledUpgrades = [];
    }
    const idx = this.data.equipped.disabledUpgrades.indexOf(key);
    let enabled = true;
    if (idx >= 0) {
      this.data.equipped.disabledUpgrades.splice(idx, 1);
      enabled = true;
    } else {
      this.data.equipped.disabledUpgrades.push(key);
      enabled = false;
    }
    this._touchAndSave('equip', this.activeProfileId);
    return { ok: true, enabled };
  }

  getUpgradeBonus(key) {
    const lvl = this.getEffectiveUpgradeLevel(key);
    if (key === 'magnet') return lvl * 60;                         // +60 frames duração e +35px raio por nível
    if (key === 'turbo') return lvl * 55;                          // +55 frames duração por nível
    if (key === 'fever') return Math.round((1 + lvl * 0.20) * 100) / 100;     // +20% velocidade de carga por nível
    if (key === 'coinBonus') return Math.round((1 + lvl * 0.15) * 100) / 100; // +15% moedas no fim da corrida por nível
    return lvl;
  }

  getEquippedGearTheme() {
    const id = (this.data.equipped && this.data.equipped.gear) || 'classic';
    return SHOP_CATALOG.gear.find(g => g.id === id) || SHOP_CATALOG.gear[0];
  }

  getEquippedTrail() {
    const id = (this.data.equipped && this.data.equipped.trail) || 'classic';
    return SHOP_CATALOG.trails.find(t => t.id === id) || SHOP_CATALOG.trails[0];
  }

  getEquippedAccessory() {
    const id = (this.data.equipped && this.data.equipped.accessory) || 'none';
    if (SHOP_CATALOG.accessories.some(a => a.id === id) && this.isOwned('accessories', id)) {
      return id;
    }
    return 'none';
  }

  isOwned(category, id) {
    if (category === 'characters' && this.unlockedCharacters.includes(id)) return true;
    const list = this.data.owned && this.data.owned[category];
    return Array.isArray(list) && list.includes(id);
  }

  // ---- Loja / Oficina ----

  buyItem(category, id) {
    if (!VALID_SHOP_CATEGORIES.includes(category)) {
      return { ok: false, reason: 'invalid_category' };
    }
    const catalog = SHOP_CATALOG[category];
    if (!Array.isArray(catalog)) return { ok: false, reason: 'invalid_category' };
    const item = catalog.find(i => i.id === id);
    if (!item || typeof item.price !== 'number' || !Number.isFinite(item.price)) {
      return { ok: false, reason: 'not_found' };
    }

    if (this.isOwned(category, id)) {
      return this.equipItem(category, id);
    }

    const coins = this.getCoins();
    if (coins < item.price) {
      return { ok: false, reason: 'insufficient_coins', needed: item.price - coins };
    }

    this.data.coinsBank = coins - item.price;
    if (!Array.isArray(this.data.owned[category])) this.data.owned[category] = [];
    if (!this.data.owned[category].includes(id)) {
      this.data.owned[category].push(id);
    }
    if (category === 'characters') {
      if (!this.unlockedCharacters.includes(id)) this.unlockedCharacters.push(id);
      for (const prof of Object.values(this.profiles)) {
        if (prof && prof.owned) prof.owned.characters = [...this.unlockedCharacters];
      }
    }
    if (category === 'gear' || category === 'trails' || category === 'accessories') {
      const equipKey = category === 'trails' ? 'trail' : (category === 'accessories' ? 'accessory' : 'gear');
      this.data.equipped[equipKey] = id;
    }

    // Desbloqueia conquista Estilo Próprio na primeira compra paga
    const notes = [];
    if (item.price > 0) {
      this._tryUnlockAchievement('fashion_star', notes);
    }
    this._touchAndSave('buy', this.activeProfileId);
    return { ok: true, item, notifications: notes };
  }

  equipItem(category, id) {
    if (!VALID_SHOP_CATEGORIES.includes(category)) return { ok: false, reason: 'invalid_category' };
    if (!this.isOwned(category, id)) return { ok: false, reason: 'not_owned' };
    if (category === 'gear') this.data.equipped.gear = id;
    else if (category === 'trails') this.data.equipped.trail = id;
    else if (category === 'accessories') this.data.equipped.accessory = id;
    this._touchAndSave('equip', this.activeProfileId);
    return { ok: true };
  }

  toggleEquipItem(category, id) {
    if (!['gear', 'trails', 'accessories'].includes(category)) {
      return { ok: false, reason: 'invalid_category' };
    }
    if (!this.isOwned(category, id)) return { ok: false, reason: 'not_owned' };

    let equippedNow = true;
    if (category === 'accessories') {
      if (id === 'none' || this.data.equipped.accessory === id) {
        this.data.equipped.accessory = 'none';
        equippedNow = false;
      } else {
        this.data.equipped.accessory = id;
      }
    } else if (category === 'gear') {
      if (id === 'classic' || this.data.equipped.gear === id) {
        this.data.equipped.gear = 'classic';
        equippedNow = false;
      } else {
        this.data.equipped.gear = id;
      }
    } else if (category === 'trails') {
      if (id === 'classic' || this.data.equipped.trail === id) {
        this.data.equipped.trail = 'classic';
        equippedNow = false;
      } else {
        this.data.equipped.trail = id;
      }
    }
    this._touchAndSave('equip', this.activeProfileId);
    return {
      ok: true,
      equipped: equippedNow,
      activeId: category === 'trails' ? this.data.equipped.trail : (category === 'accessories' ? this.data.equipped.accessory : this.data.equipped.gear)
    };
  }

  buyUpgrade(key) {
    const upg = SHOP_CATALOG.upgrades.find(u => u.id === key);
    if (!upg) return { ok: false, reason: 'not_found' };
    const lvl = this.getUpgradeLevel(key);
    if (lvl >= upg.costs.length) return { ok: false, reason: 'max_level' };
    const cost = upg.costs[lvl];
    const coins = this.getCoins();
    if (coins < cost) {
      return { ok: false, reason: 'insufficient_coins', needed: cost - coins };
    }
    this.data.coinsBank = coins - cost;
    this.data.upgrades[key] = lvl + 1;
    if (Array.isArray(this.data.equipped.disabledUpgrades)) {
      this.data.equipped.disabledUpgrades = this.data.equipped.disabledUpgrades.filter(k => k !== key);
    }
    const notes = [];
    this._tryUnlockAchievement('fashion_star', notes);
    this._touchAndSave('buy', this.activeProfileId);
    return { ok: true, newLevel: lvl + 1, notifications: notes };
  }

  canAffordAnyNewItem() {
    const coins = this.getCoins();
    for (const cat of VALID_SHOP_CATEGORIES) {
      for (const item of SHOP_CATALOG[cat] || []) {
        if (item.price > 0 && !this.isOwned(cat, item.id) && coins >= item.price) return true;
      }
    }
    for (const upg of SHOP_CATALOG.upgrades) {
      const lvl = this.getUpgradeLevel(upg.id);
      if (lvl < upg.costs.length && coins >= upg.costs[lvl]) return true;
    }
    return false;
  }

  // ---- Sincronização na Nuvem ----

  _isUntouchedDefaultProfile(profile) {
    if (!profile) return true;
    const stats = profile.stats || {};
    const upgSum = Object.values(profile.upgrades || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
    return (stats.totalRuns || 0) === 0
      && (profile.coinsBank || 0) === 50
      && (profile.rankLevel || 1) === 1
      && (profile.highScore || 0) === 0
      && (profile.highScoreTime60 || 0) === 0
      && (profile.unlockedStageIndex || 0) === 0
      && upgSum === 0
      && (!profile.achievements || Object.keys(profile.achievements).length === 0)
      && ((profile.owned?.gear?.length || 0) <= 1)
      && ((profile.owned?.trails?.length || 0) <= 1);
  }

  exportProfileForCloud(charId) {
    const pid = (typeof charId === 'string' && charId.trim()) ? charId.trim() : this.activeProfileId;
    const prof = this._sanitizeProfile(this.profiles[pid], pid);
    return JSON.parse(JSON.stringify(prof));
  }

  importOrMergeCloudData(cloudAccount, cloudProfilesMap, uid) {
    if (cloudAccount && Array.isArray(cloudAccount.unlockedCharacters)) {
      for (const cid of cloudAccount.unlockedCharacters) {
        if (typeof cid === 'string' && cid.trim() && !this.unlockedCharacters.includes(cid.trim())) {
          this.unlockedCharacters.push(cid.trim());
        }
      }
    }

    const sameAccount = Boolean(uid && this.lastSyncedUid === uid);
    const map = this._isPlainObject(cloudProfilesMap) ? cloudProfilesMap : {};

    for (const [pid, rawCloud] of Object.entries(map)) {
      if (typeof pid !== 'string' || !pid.trim() || !this._isPlainObject(rawCloud)) continue;
      const cloud = this._sanitizeProfile(rawCloud, pid);
      const local = this.profiles[pid];

      if (!local || this._isUntouchedDefaultProfile(local)) {
        this.profiles[pid] = cloud;
        continue;
      }

      const cloudNewer = (cloud.clientUpdatedAt || 0) >= (local.clientUpdatedAt || 0);
      const newer = cloudNewer ? cloud : local;

      const mergedOwned = {
        gear: Array.from(new Set([...(local.owned.gear || []), ...(cloud.owned.gear || [])])),
        trails: Array.from(new Set([...(local.owned.trails || []), ...(cloud.owned.trails || [])])),
        accessories: Array.from(new Set([...(local.owned.accessories || []), ...(cloud.owned.accessories || [])])),
        characters: [...this.unlockedCharacters]
      };

      const mergedUpgrades = {};
      for (const upg of SHOP_CATALOG.upgrades) {
        mergedUpgrades[upg.id] = Math.max(local.upgrades[upg.id] || 0, cloud.upgrades[upg.id] || 0);
      }

      const mergedAch = { ...(local.achievements || {}), ...(cloud.achievements || {}) };
      const mergedStats = {
        totalRuns: Math.max(local.stats.totalRuns || 0, cloud.stats.totalRuns || 0),
        totalCoins: Math.max(local.stats.totalCoins || 0, cloud.stats.totalCoins || 0),
        totalTricks: Math.max(local.stats.totalTricks || 0, cloud.stats.totalTricks || 0),
        totalGrinds: Math.max(local.stats.totalGrinds || 0, cloud.stats.totalGrinds || 0),
        totalSmashes: Math.max(local.stats.totalSmashes || 0, cloud.stats.totalSmashes || 0),
        totalNearMiss: Math.max(local.stats.totalNearMiss || 0, cloud.stats.totalNearMiss || 0),
        totalWords: Math.max(local.stats.totalWords || 0, cloud.stats.totalWords || 0),
        totalLoops: Math.max(local.stats.totalLoops || 0, cloud.stats.totalLoops || 0),
        bestCombo: Math.max(local.stats.bestCombo || 1, cloud.stats.bestCombo || 1),
        bestDistance: Math.max(local.stats.bestDistance || 0, cloud.stats.bestDistance || 0)
      };

      const coinsBank = sameAccount
        ? newer.coinsBank
        : Math.max(local.coinsBank || 0, cloud.coinsBank || 0);

      this.profiles[pid] = this._sanitizeProfile({
        coinsBank,
        rankLevel: Math.max(local.rankLevel || 1, cloud.rankLevel || 1),
        missionsCompletedTotal: Math.max(local.missionsCompletedTotal || 0, cloud.missionsCompletedTotal || 0),
        unlockedStageIndex: Math.max(local.unlockedStageIndex || 0, cloud.unlockedStageIndex || 0),
        highScore: Math.max(local.highScore || 0, cloud.highScore || 0),
        highScoreTime60: Math.max(local.highScoreTime60 || 0, cloud.highScoreTime60 || 0),
        preferredSport: newer.preferredSport,
        owned: mergedOwned,
        equipped: newer.equipped,
        upgrades: mergedUpgrades,
        activeMissions: newer.activeMissions,
        achievements: mergedAch,
        stats: mergedStats,
        clientUpdatedAt: Math.max(local.clientUpdatedAt || 0, cloud.clientUpdatedAt || 0)
      }, pid);
    }

    for (const pid of Object.keys(this.profiles)) {
      this.profiles[pid].owned.characters = [...this.unlockedCharacters];
    }

    if (cloudAccount && typeof cloudAccount.activeProfileId === 'string' && this.profiles[cloudAccount.activeProfileId]) {
      const curLocal = this.profiles[this.activeProfileId];
      if (!curLocal || this._isUntouchedDefaultProfile(curLocal)) {
        this.activeProfileId = cloudAccount.activeProfileId;
      }
    }

    if (uid) this.lastSyncedUid = uid;
    if (!this.profiles[this.activeProfileId]) {
      this.profiles[this.activeProfileId] = this._sanitizeProfile(null, this.activeProfileId);
    }
    this.data = this.profiles[this.activeProfileId];
    this.save();
    return true;
  }

  // ---- Missões, Troféus e Eventos de Corrida ----

  _pickMission(excludeTypes = [], rankOverride = null) {
    const rank = rankOverride !== null ? this._safeInt(rankOverride, 1, 1, 999) : this.getRankLevel();
    const tier = rank >= 5 ? 2 : (rank >= 3 ? 1 : 0);
    const candidates = MISSION_POOL.filter(m => !excludeTypes.includes(m.type));
    const pool = candidates.length > 0 ? candidates : MISSION_POOL;
    const def = pool[Math.floor(Math.random() * pool.length)];
    const tIdx = Math.min(def.targets.length - 1, tier);
    const target = def.targets[tIdx];
    const reward = def.rewards[tIdx];
    const label = def.label
      .replace('{t}', String(target))
      .replace('vez(es)', target === 1 ? 'vez' : 'vezes');
    return {
      id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      type: def.type,
      label,
      target,
      progress: 0,
      reward,
      done: false
    };
  }

  _refillMissions(targetProfile = null) {
    const target = targetProfile || this.data;
    const current = Array.isArray(target.activeMissions) ? target.activeMissions : [];
    if (current.length === 3 && current.some(m => !m.done)) return;

    // Se todas as 3 foram concluídas (ou lista vazia), gera 3 novas; se houve corrupção parcial, completa mantendo as válidas
    const keep = (current.length > 0 && current.length < 3 && current.some(m => !m.done))
      ? current.slice(0, 3)
      : [];
    const usedTypes = keep.map(m => m.type);
    const next = [...keep];
    const rankVal = this._safeInt(target.rankLevel, 1, 1, 999);
    while (next.length < 3) {
      const m = this._pickMission(usedTypes, rankVal);
      usedTypes.push(m.type);
      next.push(m);
    }
    target.activeMissions = next;
  }

  _tryUnlockAchievement(id, outNotifications) {
    if (this.data.achievements[id]) return false;
    const def = ACHIEVEMENTS_CATALOG.find(a => a.id === id);
    if (!def) return false;
    this.data.achievements[id] = Date.now();
    this.data.coinsBank = this.getCoins() + def.reward;
    if (Array.isArray(outNotifications)) {
      outNotifications.push({
        kind: 'achievement',
        icon: def.icon,
        title: `Troféu: ${def.name}`,
        reward: def.reward
      });
    }
    return true;
  }

  /** Registra progresso em tempo real durante a corrida ou no encerramento. */
  recordRunEvent(eventType, amount = 1, ctx = {}) {
    const numAmt = Number(amount);
    const val = (Number.isFinite(numAmt) && numAmt > 0) ? numAmt : 0;
    const safeCtx = this._isPlainObject(ctx) ? ctx : {};
    const notifications = [];
    const stats = this.data.stats;

    if (eventType === 'trick') stats.totalTricks = this._safeInt(stats.totalTricks, 0) + val;
    else if (eventType === 'grind') stats.totalGrinds = this._safeInt(stats.totalGrinds, 0) + val;
    else if (eventType === 'coin') stats.totalCoins = this._safeInt(stats.totalCoins, 0) + val;
    else if (eventType === 'smash') stats.totalSmashes = this._safeInt(stats.totalSmashes, 0) + val;
    else if (eventType === 'near_miss') stats.totalNearMiss = this._safeInt(stats.totalNearMiss, 0) + val;
    else if (eventType === 'word') stats.totalWords = this._safeInt(stats.totalWords, 0) + val;
    else if (eventType === 'loop') stats.totalLoops = this._safeInt(stats.totalLoops, 0) + val;
    else if (eventType === 'combo') stats.bestCombo = Math.max(this._safeInt(stats.bestCombo, 1, 1), Math.floor(val));
    else if (eventType === 'distance') {
      const runDist = Number.isFinite(Number(safeCtx.distance))
        ? Math.max(0, Math.floor(Number(safeCtx.distance)))
        : Math.floor(val);
      stats.bestDistance = Math.max(this._safeInt(stats.bestDistance, 0), runDist);
    } else if (eventType === 'run_end') {
      stats.totalRuns = this._safeInt(stats.totalRuns, 0) + 1;
      if (Number.isFinite(Number(safeCtx.distance))) {
        stats.bestDistance = Math.max(this._safeInt(stats.bestDistance, 0), Math.floor(Number(safeCtx.distance)));
      }
      if (Number.isFinite(Number(safeCtx.bestCombo))) {
        stats.bestCombo = Math.max(this._safeInt(stats.bestCombo, 1, 1), Math.floor(Number(safeCtx.bestCombo)));
      }
    }

    // Atualiza missões ativas
    let changed = false;
    for (const m of this.data.activeMissions) {
      if (m.done || m.type !== eventType || val <= 0) continue;
      m.progress = Math.min(m.target, (Number(m.progress) || 0) + val);
      changed = true;
      if (m.progress >= m.target) {
        m.done = true;
        this.data.missionsCompletedTotal = this._safeInt(this.data.missionsCompletedTotal, 0) + 1;
        this.data.coinsBank = this.getCoins() + m.reward;
        notifications.push({
          kind: 'mission',
          icon: '🎯',
          title: `Missão cumprida: ${m.label}`,
          reward: m.reward
        });
      }
    }

    // Se completou todas as 3 missões, abre Baú de Nível!
    if (this.data.activeMissions.length === 3 && this.data.activeMissions.every(m => m.done)) {
      const chestReward = 100;
      this.data.rankLevel = this.getRankLevel() + 1;
      this.data.coinsBank = this.getCoins() + chestReward;
      notifications.push({
        kind: 'levelup',
        icon: '🎁',
        title: `Baú de Nível ${this.getRankLevel()}: ${this.getRankTitle()}!`,
        reward: chestReward
      });
      this.data.activeMissions = [];
      this._refillMissions();
      changed = true;
    }

    // Troféus
    if (stats.totalRuns >= 1) this._tryUnlockAchievement('first_run', notifications);
    if (stats.totalTricks >= 30) this._tryUnlockAchievement('trick_master', notifications);
    if (stats.bestCombo >= 6) this._tryUnlockAchievement('combo_king', notifications);
    if (stats.totalSmashes >= 10) this._tryUnlockAchievement('smasher', notifications);
    if (stats.totalWords >= 1) this._tryUnlockAchievement('word_hunter', notifications);
    if (stats.totalCoins >= 1000) this._tryUnlockAchievement('rich_kid', notifications);
    const reachedSpaceLegit = (Number(safeCtx.stageIndex) || 0) >= 3 && (Number(safeCtx.startedStageIndex) || 0) < 3;
    if (reachedSpaceLegit || stats.bestDistance >= 2400) {
      this._tryUnlockAchievement('space_rider', notifications);
    }
    if ((stats.totalLoops || 0) >= 1) this._tryUnlockAchievement('loop_rider', notifications);
    const reachedGlacierLegit = (Number(safeCtx.stageIndex) || 0) >= 5 && (Number(safeCtx.startedStageIndex) || 0) < 5;
    if (reachedGlacierLegit || stats.bestDistance >= 4600) {
      this._tryUnlockAchievement('glacier_explorer', notifications);
    }

    if (eventType === 'run_end' || notifications.length > 0) {
      this._touchAndSave('progress', this.activeProfileId);
    } else if (changed) {
      this.save();
    }
    return notifications;
  }

  /** Deposita moedas coletadas na partida com bônus do upgrade Cofre de Ouro. */
  bankRunCoins(runCoins) {
    const raw = this._safeInt(runCoins, 0, 0, 9999999);
    const mult = this.getUpgradeBonus('coinBonus');
    const finalCoins = Math.round(raw * mult);
    const bonus = Math.max(0, finalCoins - raw);
    if (finalCoins > 0) {
      this.data.coinsBank = this.getCoins() + finalCoins;
      if (bonus > 0 && this.data.stats) {
        this.data.stats.totalCoins = this._safeInt(this.data.stats.totalCoins, 0) + bonus;
      }
      this._touchAndSave('coins', this.activeProfileId);
    }
    return { raw, bonus, total: finalCoins };
  }
}

window.SHOP_CATALOG = SHOP_CATALOG;
window.ACHIEVEMENTS_CATALOG = ACHIEVEMENTS_CATALOG;
window.ProgressionManager = ProgressionManager;
window.progressionManager = new ProgressionManager();
