// Gerenciador de Personagens, Cutout Rig Customizável e Estúdio de Personagens
// Pré-carrega assets/rig/*.png para animação articulada com IK, gera avatares
// customizados (gênero, tom de pele, roupa, cabelo, acessórios) e melhora a
// nitidez/tamanho do rosto em fotos (galeria ou câmera).

const RIG_ASSET_PATHS = {
  head:          'assets/rig/head_luigi.png',
  helmetOverlay: 'assets/rig/helmet_overlay.png',
  torso:         'assets/rig/torso.png',
  armUpper:      'assets/rig/arm_upper.png',
  armLower:      'assets/rig/arm_lower.png',
  thigh:         'assets/rig/thigh.png',
  shinShoe:      'assets/rig/shin_shoe.png',
  skateboard:    'assets/rig/skateboard.png'
};

// Linhas de corte abaixo dos solados dos tênis (fallback de sprite quando rig não carregou)
const SKATE_CUT_LINES = {
  skate: { x1: 0.22, y1: 0.94, x2: 0.96, y2: 0.60 },
  duck:  { x1: 0.22, y1: 0.94, x2: 0.96, y2: 0.60 },
  jump:  { x1: 0.18, y1: 0.85, x2: 0.86, y2: 0.66 },
  trick: { x1: 0.48, y1: 0.92, x2: 0.90, y2: 0.44 }
};

const CHAR_CUSTOMIZATION = {
  SKIN_TONES: [
    { id: 'light',  name: 'Claro',        hex: '#fde2c8', shadow: '#e4b892' },
    { id: 'fair',   name: 'Médio Claro',  hex: '#f3c69f', shadow: '#cf966b' },
    { id: 'medium', name: 'Dourado',      hex: '#d99b66', shadow: '#ad7141' },
    { id: 'tan',    name: 'Bronzeado',    hex: '#b57445', shadow: '#8a5029' },
    { id: 'brown',  name: 'Marrom',       hex: '#7c4a2b', shadow: '#583018' },
    { id: 'deep',   name: 'Retinto',      hex: '#4a2a19', shadow: '#2d160b' }
  ],
  GENDERS: [
    { id: 'boy',     name: 'Menino', icon: '👦' },
    { id: 'girl',    name: 'Menina', icon: '👧' },
    { id: 'neutral', name: 'Livre',  icon: '🌟' }
  ],
  OUTFITS: [
    { id: 'street_blue',   name: 'Azul SK8',      top: '#2563eb', topAccent: '#22d3ee', bottom: '#1e293b', shoe: '#ef4444', shoeSole: '#f8fafc' },
    { id: 'pink_cyan',     name: 'Rosa & Ciano',  top: '#ec4899', topAccent: '#22d3ee', bottom: '#312e81', shoe: '#22d3ee', shoeSole: '#f8fafc' },
    { id: 'neon_green',    name: 'Verde Neon',    top: '#10b981', topAccent: '#a3e635', bottom: '#0f172a', shoe: '#10b981', shoeSole: '#fde047' },
    { id: 'solar_orange',  name: 'Fogo Laranja',  top: '#f97316', topAccent: '#fde047', bottom: '#1f2937', shoe: '#f59e0b', shoeSole: '#ffffff' },
    { id: 'galaxy_purple', name: 'Galáxia Roxa',  top: '#7c3aed', topAccent: '#f0abfc', bottom: '#1e1b4b', shoe: '#a855f7', shoeSole: '#e0f2fe' },
    { id: 'gold_black',    name: 'Campeão Ouro',  top: '#18181b', topAccent: '#fbbf24', bottom: '#27272a', shoe: '#fbbf24', shoeSole: '#ffffff' }
  ],
  HAIR_COLORS: [
    { id: 'black',  name: 'Preto',     hex: '#18181b', shine: '#3f3f46' },
    { id: 'brown',  name: 'Castanho',  hex: '#5c3317', shine: '#854d27' },
    { id: 'blonde', name: 'Loiro',     hex: '#eab308', shine: '#fef08a' },
    { id: 'red',    name: 'Ruivo',     hex: '#c2410c', shine: '#fb923c' },
    { id: 'cyan',   name: 'Azul Neon', hex: '#06b6d4', shine: '#67e8f9' },
    { id: 'pink',   name: 'Rosa Pop',  hex: '#ec4899', shine: '#f9a8d4' }
  ]
};

window.CHAR_CUSTOMIZATION = CHAR_CUSTOMIZATION;

function getSkinPalette(id) {
  return CHAR_CUSTOMIZATION.SKIN_TONES.find(s => s.id === id) || CHAR_CUSTOMIZATION.SKIN_TONES[1];
}

function getOutfitPalette(id) {
  return CHAR_CUSTOMIZATION.OUTFITS.find(o => o.id === id) || CHAR_CUSTOMIZATION.OUTFITS[0];
}

function getHairPalette(id) {
  return CHAR_CUSTOMIZATION.HAIR_COLORS.find(h => h.id === id) || CHAR_CUSTOMIZATION.HAIR_COLORS[1];
}

class CharacterManager {
  constructor() {
    this.characters = [];
    this.selectedId = 'luigi_3d';
    this.loadedImages = {};
    this.loadedHeads = {};
    this._failedHeads = {};
    this._helmetOverlayTainted = false;
    this.lastStorageError = null;
    this.riderCache = {};
    this.scaleCache = {};
    this.rigParts = {
      ready: false,
      head: null,
      helmetOverlay: null,
      torso: null,
      armUpper: null,
      armLower: null,
      thigh: null,
      shinShoe: null,
      skateboard: null
    };
  }

  _defaultBuiltins() {
    return [
      {
        id: 'luigi_3d',
        name: 'Luigi 3D (SK8-BOY)',
        badge: 'Estilo Radical 3D',
        description: 'Luigi em sua versão oficial 3D com capacete SK8, camisa xadrez, skate street art e manobras radicais!',
        renderMode: 'sprite',
        bodyStyle: 'rig',
        headSize: 'normal',
        portrait: 'assets/portraits/portrait_luigi_3d.png',
        sprites: {
          skate: 'assets/sprites/luigi_3d_skate.png',
          duck:  'assets/sprites/luigi_3d_duck.png',
          jump:  'assets/sprites/luigi_3d_jump.png',
          trick: 'assets/sprites/luigi_3d_trick.png'
        },
        stats: { visual: 'Rig 3D', favorito: '🛹 Skate', estilo: 'Radical' },
        width: 105,
        height: 130,
        duckHeight: 85
      },
      {
        id: 'luigi_real',
        name: 'Luigi Real',
        badge: 'Clássico Foto',
        description: 'Luigi em estilo realista clássico pronto para encarar corrimãos e mega rampas!',
        renderMode: 'sprite',
        bodyStyle: 'sprite',
        headSize: 'normal',
        portrait: 'assets/portraits/portrait_luigi_real.png',
        sprites: {
          skate: 'assets/sprites/luigi_real_skate.png',
          duck:  'assets/sprites/luigi_real_duck.png',
          jump:  'assets/sprites/luigi_real_jump.png',
          trick: 'assets/sprites/luigi_real_trick.png'
        },
        stats: { visual: 'Clássico', favorito: '🛹 Street', estilo: 'Realista' },
        width: 105,
        height: 130,
        duckHeight: 85
      },
      {
        id: 'luna_radical',
        name: 'Luna Radical',
        badge: 'Estrela Neon',
        description: 'Skatista cheia de energia, rabo de cavalo estilizado, jaqueta rosa-ciano e manobras elétricas!',
        renderMode: 'sprite',
        bodyStyle: 'custom',
        gender: 'girl',
        skinTone: 'medium',
        outfit: 'pink_cyan',
        hairColor: 'brown',
        accessory: 'shades',
        headSize: 'large',
        useHelmet: false,
        hasPhoto: false,
        stats: { visual: 'Neon 2D', favorito: '🛼 Patins', estilo: 'Elétrico' },
        width: 105,
        height: 130,
        duckHeight: 85
      },
      {
        id: 'leo_cosmic',
        name: 'Léo Espacial',
        badge: 'Viajante Cósmico',
        description: 'Desbloqueie na Oficina! Traje galáctico roxo, antena espacial e muito estilo nas pistas!',
        renderMode: 'sprite',
        bodyStyle: 'custom',
        gender: 'boy',
        skinTone: 'deep',
        outfit: 'galaxy_purple',
        hairColor: 'black',
        accessory: 'astro',
        headSize: 'large',
        useHelmet: true,
        hasPhoto: false,
        unlockPrice: 750,
        stats: { visual: 'Galáctico', favorito: '🚲 BMX', estilo: 'Cósmico' },
        width: 105,
        height: 130,
        duckHeight: 85
      }
    ];
  }

  async init() {
    try {
      const resp = await fetch('assets/characters.json');
      const data = await resp.json();
      this.characters = data.characters || [];
      this.selectedId = data.defaultCharacter || 'luigi_3d';
    } catch (e) {
      console.warn('Erro ao carregar characters.json, usando padrão de fallback', e);
      this.characters = this._defaultBuiltins();
    }

    this.characters = this.characters.map(char => this.normalizeCharacter(char));
    this.loadCustomCharacters();

    // Recuperar seleção anterior com fallback seguro (respeitando bloqueio de personagem pago)
    try {
      const saved = localStorage.getItem('luigi_selected_char');
      if (saved && this.characters.some(c => c.id === saved) && this.isCharacterUnlocked(saved)) {
        this.selectedId = saved;
      } else if (!this.characters.some(c => c.id === this.selectedId) || !this.isCharacterUnlocked(this.selectedId)) {
        const firstUnlocked = this.characters.find(c => this.isCharacterUnlocked(c.id)) || this.characters[0];
        if (firstUnlocked) this.selectedId = firstUnlocked.id;
      }
    } catch (e) {}

    await Promise.all([
      this.preloadRigParts(),
      this.preloadAllSprites()
    ]);

    this.ensureGeneratedHeadsAndPortraits();
  }

  isCharacterUnlocked(id) {
    const char = this.getCharacter(id);
    if (!char || !char.unlockPrice) return true;
    if (window.progressionManager && typeof window.progressionManager.isOwned === 'function') {
      return window.progressionManager.isOwned('characters', id);
    }
    return false;
  }

  normalizeCharacter(char) {
    if (!char) return char;
    const isFullPhoto = !!(char.fullPhoto || char.bodyMode === 'fullphoto');
    let bodyStyle = char.bodyStyle;
    if (!bodyStyle) {
      if (char.isCustom && !isFullPhoto) bodyStyle = 'custom';
      else if (char.id === 'luigi_real') bodyStyle = 'sprite';
      else bodyStyle = 'rig';
    }
    const hasPhoto = char.hasPhoto !== undefined
      ? !!char.hasPhoto
      : !!(char.isCustom && (char.headSprite || (char.portrait && char.portrait.startsWith('data:'))));

    const validGender = CHAR_CUSTOMIZATION.GENDERS.some(g => g.id === char.gender) ? char.gender : 'boy';
    const validSkin = CHAR_CUSTOMIZATION.SKIN_TONES.some(s => s.id === char.skinTone) ? char.skinTone : 'fair';
    const validOutfit = CHAR_CUSTOMIZATION.OUTFITS.some(o => o.id === char.outfit) ? char.outfit : 'street_blue';
    const validHair = CHAR_CUSTOMIZATION.HAIR_COLORS.some(h => h.id === char.hairColor) ? char.hairColor : 'brown';
    const validHeadSize = (char.headSize === 'normal' || char.headSize === 'large')
      ? char.headSize
      : ((char.isCustom && hasPhoto) || bodyStyle === 'custom' ? 'large' : 'normal');

    return {
      ...char,
      name: (typeof char.name === 'string' && char.name.trim()) ? char.name.trim().slice(0, 30) : 'Skatista',
      renderMode: 'sprite',
      bodyStyle,
      fullPhoto: isFullPhoto,
      useHelmet: char.useHelmet !== false,
      gender: validGender,
      skinTone: validSkin,
      outfit: validOutfit,
      hairColor: validHair,
      accessory: (typeof char.accessory === 'string' && char.accessory.trim()) ? char.accessory : 'none',
      headSize: validHeadSize,
      hasPhoto,
      portrait: char.portrait || char.headSprite || ''
    };
  }

  /** Pré-carrega as 8 peças ilustradas do Cutout Rig 2D em assets/rig/*.png. */
  async preloadRigParts() {
    const entries = Object.entries(RIG_ASSET_PATHS);
    const promises = entries.map(([key, src]) => new Promise((resolve) => {
      if (this.rigParts[key]) { resolve(); return; }
      const img = new Image();
      img.onload = () => {
        this.rigParts[key] = img;
        resolve();
      };
      img.onerror = () => {
        console.warn(`Falha ao carregar peça do rig (${key}): ${src}`);
        resolve();
      };
      img.src = src;
    }));

    await Promise.all(promises);
    this.rigParts.ready = entries.every(([key]) => !!this.rigParts[key]);
  }

  getRigParts() {
    return this.rigParts;
  }

  loadCustomCharacters() {
    try {
      const customStr = localStorage.getItem('luigi_custom_characters');
      if (customStr) {
        const customChars = JSON.parse(customStr);
        if (Array.isArray(customChars)) {
          for (const raw of customChars) {
            if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) continue;
            if (!this.characters.some(c => c.id === raw.id)) {
              const restored = {
                ...raw,
                portrait: raw.portrait || raw.headSprite || '',
                isCustom: true
              };
              this.characters.push(this.normalizeCharacter(restored));
            }
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar personagens customizados', e);
    }
  }

  _serializeCustomForStorage(char, compactPhoto = false) {
    const copy = { ...char };
    // Personagem sem foto regenera a cabeça ilustrada em canvas instantaneamente (zero bytes em base64!)
    if (!copy.hasPhoto && !copy.fullPhoto) {
      copy.headSprite = '';
      copy.portrait = '';
      copy.sprites = { skate: '', duck: '', jump: '', trick: '' };
      return copy;
    }
    // Evita duplicar a mesma DataURL gigante em headSprite e portrait (reduz 50% do espaço)
    if (copy.headSprite && copy.portrait === copy.headSprite) {
      copy.portrait = '';
    }
    // Em modo de emergência por falta de espaço (QuotaExceededError), recompacta a cabeça em WebP/JPEG leve
    if (compactPhoto && typeof document !== 'undefined' && this.loadedHeads[copy.id] && this._isDrawableImage(this.loadedHeads[copy.id])) {
      try {
        const tmp = document.createElement('canvas');
        tmp.width = 192;
        tmp.height = 192;
        const tctx = tmp.getContext('2d');
        tctx.imageSmoothingEnabled = true;
        tctx.imageSmoothingQuality = 'high';
        tctx.drawImage(this.loadedHeads[copy.id], 0, 0, 192, 192);
        const shrunk = this.safeToDataUrl(tmp, copy.headSprite, true, 0.58);
        if (shrunk && shrunk.length < (copy.headSprite || '').length) {
          copy.headSprite = shrunk;
          copy.portrait = '';
        }
      } catch (_) {}
    }
    return copy;
  }

  _isQuotaError(err) {
    if (!err) return false;
    return err.name === 'QuotaExceededError'
      || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || err.code === 22
      || err.code === 1014;
  }

  saveCustomCharacters() {
    this.lastStorageError = null;
    const customOnly = this.characters.filter(c => c.isCustom);
    try {
      const payload = customOnly.map(c => this._serializeCustomForStorage(c, false));
      localStorage.setItem('luigi_custom_characters', JSON.stringify(payload));
      return { ok: true };
    } catch (e) {
      if (this._isQuotaError(e)) {
        // 2ª tentativa: compacta fotos dos avatares customizados para caber na cota do navegador
        try {
          const compactPayload = customOnly.map(c => this._serializeCustomForStorage(c, true));
          localStorage.setItem('luigi_custom_characters', JSON.stringify(compactPayload));
          return { ok: true, compacted: true };
        } catch (e2) {
          this.lastStorageError = 'quota_exceeded';
          console.warn('Cota do localStorage cheia ao salvar personagens customizados', e2);
          return { ok: false, reason: 'quota_exceeded' };
        }
      }
      this.lastStorageError = 'storage_error';
      console.warn('Erro ao salvar personagens customizados', e);
      return { ok: false, reason: 'storage_error' };
    }
  }

  getCharacter(id) {
    return this.characters.find(c => c.id === id) || this.characters[0];
  }

  getSelected() {
    return this.getCharacter(this.selectedId);
  }

  select(id) {
    if (this.characters.some(c => c.id === id) && this.isCharacterUnlocked(id)) {
      this.selectedId = id;
      try {
        localStorage.setItem('luigi_selected_char', id);
      } catch (e) {}
      return true;
    }
    return false;
  }

  async preloadAllSprites() {
    const promises = [];
    for (const char of this.characters) {
      if (!this.loadedImages[char.id]) {
        this.loadedImages[char.id] = {};
      }
      if (char.sprites) {
        for (const [pose, src] of Object.entries(char.sprites)) {
          if (src && !this.loadedImages[char.id][pose]) {
            promises.push(new Promise((resolve) => {
              const img = new Image();
              img.onload = () => {
                if ((img.naturalWidth || img.width) > 0) {
                  this.loadedImages[char.id][pose] = img;
                }
                resolve();
              };
              img.onerror = () => {
                console.warn(`Falha ao carregar sprite ${char.id} - ${pose}`);
                resolve();
              };
              img.src = src;
            }));
          }
        }
      }

      // Pré-carrega headSprite de personagens customizados
      const headSrc = char.headSprite || (char.isCustom && !char.fullPhoto ? char.portrait : null);
      if (headSrc && !this.loadedHeads[char.id]) {
        promises.push(new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            if ((img.naturalWidth || img.width) > 0) {
              this.loadedHeads[char.id] = img;
              delete this._failedHeads[char.id];
            } else {
              this._failedHeads[char.id] = true;
            }
            resolve();
          };
          img.onerror = () => {
            this._failedHeads[char.id] = true;
            console.warn(`Falha ao carregar cabeça do personagem ${char.id}`);
            resolve();
          };
          img.src = headSrc;
        }));
      }
    }
    await Promise.all(promises);
    this.scaleCache = {};
  }

  /** Garante retrato e headSprite gerado em canvas para personagens custom (como Luna, Léo ou fallback de foto quebrada). */
  ensureGeneratedHeadsAndPortraits() {
    if (typeof document === 'undefined') return;
    for (const char of this.characters) {
      if (char.bodyStyle === 'custom' && !this.loadedHeads[char.id] && (!char.hasPhoto || this._failedHeads[char.id] || !char.headSprite)) {
        const canvas = this.composeIllustratedHeadCanvas({
          skinTone: char.skinTone,
          gender: char.gender,
          hairColor: char.hairColor,
          outfit: char.outfit,
          useHelmet: char.useHelmet
        });
        this.loadedHeads[char.id] = canvas;
        if (!char.portrait || this._failedHeads[char.id]) {
          char.portrait = this.safeToDataUrl(canvas, 'assets/portraits/portrait_luigi_3d.png');
        }
      } else if (char.bodyStyle === 'custom' && !char.portrait && this.loadedHeads[char.id]) {
        char.portrait = this.safeToDataUrl(this.loadedHeads[char.id], 'assets/portraits/portrait_luigi_3d.png');
      }
    }
  }

  getSprite(charId, pose) {
    return (this.loadedImages[charId] && this.loadedImages[charId][pose]) || null;
  }

  getHeadImage(charId) {
    if (this.loadedHeads[charId]) return this.loadedHeads[charId];
    if (charId === 'luigi_3d' && this.rigParts.head) return this.rigParts.head;
    const char = this.getCharacter(charId);
    if (char && char.bodyStyle === 'custom' && (!char.hasPhoto || this._failedHeads[charId] || !char.headSprite) && typeof document !== 'undefined') {
      const c = this.composeIllustratedHeadCanvas({
        skinTone: char.skinTone,
        gender: char.gender,
        hairColor: char.hairColor,
        outfit: char.outfit,
        useHelmet: char.useHelmet
      });
      this.loadedHeads[charId] = c;
      return c;
    }
    return null;
  }

  /** Fallback de sprite sem prancha de skate (usado quando o rig não desenha). */
  getRiderSprite(charId, pose) {
    const base = this.getSprite(charId, pose);
    if (!base) return null;

    const char = this.getCharacter(charId);
    if (char && char.fullPhoto) return base;

    const key = charId + ':' + pose;
    if (this.riderCache[key]) return this.riderCache[key];

    const cut = SKATE_CUT_LINES[pose] || SKATE_CUT_LINES.skate;
    try {
      const w = base.naturalWidth || base.width;
      const h = base.naturalHeight || base.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(base, 0, 0, w, h);

      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, cut.y1 * h);
      ctx.lineTo(cut.x1 * w, cut.y1 * h);
      ctx.lineTo(cut.x2 * w, cut.y2 * h);
      ctx.lineTo(w, cut.y2 * h);
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();

      this.riderCache[key] = canvas;
      return canvas;
    } catch (_) {
      return base;
    }
  }

  getSpriteScale(charId, targetHeight) {
    const cacheKey = charId + ':' + targetHeight;
    if (this.scaleCache[cacheKey] !== undefined) return this.scaleCache[cacheKey];

    const base = this.getSprite(charId, 'skate');
    const scale = base && base.height ? targetHeight / base.height : targetHeight / 240;

    this.scaleCache[cacheKey] = scale;
    return scale;
  }

  getRimColor(theme = 'skatepark') {
    const map = {
      skatepark: 'rgba(255, 198, 120, 0.28)',
      neon:      'rgba(34, 211, 238, 0.30)',
      beach:     'rgba(255, 245, 210, 0.24)',
      cosmic:    'rgba(167, 139, 250, 0.34)'
    };
    return map[theme] || map.skatepark;
  }

  // ==========================================================
  // Estúdio de Personagens: cabeça 256x256 nítida + avatar ilustrado + corpo inteiro
  // ==========================================================

  /** Desenha um capacete vetorial estiloso bem alto para nunca tampar os olhos da foto. */
  _drawVectorHelmetTop(ctx, size, outfitId) {
    const outfit = getOutfitPalette(outfitId);
    ctx.save();
    // Cúpula alta do capacete
    const cx = size * 0.5;
    const cy = size * 0.28;
    const rx = size * 0.41;
    const ry = size * 0.24;

    const grad = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
    grad.addColorStop(0, outfit.topAccent);
    grad.addColorStop(0.55, outfit.top);
    grad.addColorStop(1, '#0f172a');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.96, Math.PI * 2.04);
    ctx.quadraticCurveTo(cx, cy + size * 0.03, cx - rx, cy);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(2, size * 0.018);
    ctx.stroke();

    // Faixa esportiva central + detalhe "SK8"
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.25, cy - ry * 0.45, rx * 0.28, ry * 0.16, -0.25, 0, Math.PI * 2);
    ctx.fill();

    // Aba frontal alta (deixa olhos totalmente visíveis!)
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(cx + size * 0.06, cy + size * 0.01, rx * 0.88, size * 0.045, 0.04, 0, Math.PI);
    ctx.fill();
    ctx.restore();
  }

  /** Verifica se a imagem ou canvas está pronto e possui dimensões válidas para desenho. */
  _isDrawableImage(img) {
    if (!img) return false;
    if (typeof HTMLCanvasElement !== 'undefined' && img instanceof HTMLCanvasElement) {
      return img.width > 0 && img.height > 0;
    }
    if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
      return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    }
    return (img.naturalWidth || img.width || 0) > 0 && (img.naturalHeight || img.height || 0) > 0;
  }

  /**
   * Compõe a cabeça 256x256 a partir de uma foto real:
   * - Máscara oval ampla (preserva rosto inteiro, olhos e sorriso)
   * - Moldura estilo sticker (borda branca + contorno escuro) para se destacar na pista
   * - Capacete posicionado alto na testa para nunca cobrir os olhos!
   */
  composeHeadSpriteCanvas(userImg, options = {}) {
    if (!this._isDrawableImage(userImg)) {
      return this.composeIllustratedHeadCanvas(options);
    }

    const size = 256;
    const zoom = Math.max(0.7, Math.min(2.6, Number(options.faceZoom) || 1.15));
    const offsetX = Math.max(-0.5, Math.min(0.5, Number(options.faceOffsetX) || 0));
    const offsetY = Math.max(-0.5, Math.min(0.5, Number(options.faceOffsetY) || 0));
    const flipX = !!options.faceFlipX;
    const useHelmet = options.useHelmet !== false;

    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = size;
    faceCanvas.height = size;
    const fctx = faceCanvas.getContext('2d');
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = 'high';

    const iw = userImg.naturalWidth || userImg.width || size;
    const ih = userImg.naturalHeight || userImg.height || size;
    const baseScale = Math.max(size / iw, size / ih) * zoom;
    const drawW = iw * baseScale;
    const drawH = ih * baseScale;

    const centerShiftY = useHelmet ? size * 0.075 : 0;
    const dx = size * 0.5 + offsetX * size;
    const dy = size * 0.5 + centerShiftY + offsetY * size;

    fctx.save();
    fctx.translate(dx, dy);
    if (flipX) fctx.scale(-1, 1);
    fctx.drawImage(userImg, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
    fctx.restore();

    // Máscara oval ampla para o rosto aparecer grande e nítido
    const ovalCx = size * 0.5;
    const ovalCy = useHelmet ? size * 0.57 : size * 0.51;
    const ovalRx = size * 0.43;
    const ovalRy = useHelmet ? size * 0.40 : size * 0.45;

    fctx.globalCompositeOperation = 'destination-in';
    fctx.save();
    fctx.translate(ovalCx, ovalCy);
    fctx.scale(1, ovalRy / ovalRx);
    const mask = fctx.createRadialGradient(0, 0, ovalRx * 0.80, 0, 0, ovalRx);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.92, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = mask;
    fctx.beginPath();
    fctx.arc(0, 0, ovalRx, 0, Math.PI * 2);
    fctx.fill();
    fctx.restore();

    const drawStickerBase = (ctx) => {
      // Halo/moldura sticker nítida atrás do rosto para dar máximo destaque no fundo
      ctx.save();
      ctx.translate(ovalCx, ovalCy);
      ctx.scale(1, ovalRy / ovalRx);
      ctx.beginPath();
      ctx.arc(0, 0, ovalRx * 1.03, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
      ctx.restore();
      ctx.drawImage(faceCanvas, 0, 0);
    };

    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    drawStickerBase(octx);

    if (useHelmet) {
      if (this.rigParts.helmetOverlay && !this._helmetOverlayTainted) {
        try {
          // Recorta apenas a cúpula superior do capacete PNG (0..54%), descartando a tira do queixo (60..98%)
          // para nunca cruzar a boca/bochechas nem cobrir os olhos da foto!
          const hImg = this.rigParts.helmetOverlay;
          const hW = hImg.naturalWidth || hImg.width || size;
          const hH = hImg.naturalHeight || hImg.height || size;
          const cropH = Math.max(1, Math.floor(hH * 0.54));
          octx.drawImage(hImg, 0, 0, hW, cropH, size * 0.03, size * 0.02, size * 0.94, size * 0.44);
          out.toDataURL('image/png');
        } catch (_) {
          // Canvas tainted (ex.: aberto via file://) não pode ser limpo; recria um canvas limpo com capacete vetorial!
          this._helmetOverlayTainted = true;
          const cleanOut = document.createElement('canvas');
          cleanOut.width = size;
          cleanOut.height = size;
          const cctx = cleanOut.getContext('2d');
          cctx.imageSmoothingEnabled = true;
          cctx.imageSmoothingQuality = 'high';
          drawStickerBase(cctx);
          this._drawVectorHelmetTop(cctx, size, options.outfit);
          return cleanOut;
        }
      } else {
        this._drawVectorHelmetTop(octx, size, options.outfit);
      }
    }

    return out;
  }

  /** Desenha uma cabeça ilustrada expressiva (256x256) quando não houver foto enviada. */
  composeIllustratedHeadCanvas(options = {}) {
    const size = 256;
    const skin = getSkinPalette(options.skinTone);
    const hair = getHairPalette(options.hairColor);
    const gender = options.gender || 'boy';
    const useHelmet = options.useHelmet !== false;

    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;

    const cx = size * 0.5;
    const cy = useHelmet ? size * 0.56 : size * 0.52;
    const rx = size * 0.34;
    const ry = size * 0.36;

    // Cabelo atrás (para menina ou estilo livre)
    ctx.fillStyle = hair.hex;
    if (gender === 'girl') {
      ctx.beginPath();
      ctx.ellipse(cx - size * 0.14, cy + size * 0.04, size * 0.25, size * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Orelha
    ctx.fillStyle = skin.shadow;
    ctx.beginPath();
    ctx.arc(cx - rx * 0.94, cy + size * 0.02, size * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.hex;
    ctx.beginPath();
    ctx.arc(cx - rx * 0.92, cy + size * 0.02, size * 0.052, 0, Math.PI * 2);
    ctx.fill();

    // Rosto
    const faceGrad = ctx.createRadialGradient(cx + size * 0.05, cy - size * 0.06, size * 0.06, cx, cy, rx * 1.15);
    faceGrad.addColorStop(0, skin.hex);
    faceGrad.addColorStop(1, skin.shadow);
    ctx.fillStyle = faceGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // Bochechas coradas sutis
    ctx.fillStyle = 'rgba(244, 63, 94, 0.22)';
    ctx.beginPath();
    ctx.ellipse(cx - size * 0.08, cy + size * 0.08, size * 0.055, size * 0.032, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + size * 0.21, cy + size * 0.08, size * 0.055, size * 0.032, 0, 0, Math.PI * 2);
    ctx.fill();

    // Olhos expressivos (olhando ligeiramente para a direita, sentido da pista!)
    const eyeY = cy - size * 0.02;
    const eyeXs = [cx - size * 0.02, cx + size * 0.16];
    for (const ex of eyeXs) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, size * 0.055, size * 0.068, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(ex + size * 0.015, eyeY + size * 0.004, size * 0.032, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex + size * 0.024, eyeY - size * 0.014, size * 0.013, 0, Math.PI * 2);
      ctx.fill();
    }

    // Sobrancelhas
    ctx.strokeStyle = hair.hex;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(eyeXs[0] - 12, eyeY - 20);
    ctx.lineTo(eyeXs[0] + 10, eyeY - 22);
    ctx.moveTo(eyeXs[1] - 10, eyeY - 22);
    ctx.lineTo(eyeXs[1] + 12, eyeY - 19);
    ctx.stroke();

    // Nariz e sorriso confiante
    ctx.strokeStyle = skin.shadow;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(cx + size * 0.09, cy + size * 0.05, 6, -0.4, 1.3);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.01, cy + size * 0.14);
    ctx.quadraticCurveTo(cx + size * 0.10, cy + size * 0.15, cx + size * 0.18, cy + size * 0.12);
    ctx.quadraticCurveTo(cx + size * 0.10, cy + size * 0.25, cx + size * 0.01, cy + size * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cabelo superior / franja
    if (!useHelmet) {
      ctx.fillStyle = hair.hex;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      if (gender === 'boy') {
        ctx.moveTo(cx - rx * 0.96, cy - size * 0.10);
        ctx.quadraticCurveTo(cx - rx * 0.5, cy - ry * 1.28, cx + size * 0.08, cy - ry * 1.15);
        ctx.lineTo(cx + size * 0.20, cy - ry * 1.24);
        ctx.lineTo(cx + size * 0.22, cy - ry * 0.92);
        ctx.lineTo(cx + rx * 0.96, cy - size * 0.16);
        ctx.quadraticCurveTo(cx + size * 0.16, cy - size * 0.22, cx - size * 0.06, cy - size * 0.16);
        ctx.quadraticCurveTo(cx - size * 0.22, cy - size * 0.14, cx - rx * 0.96, cy - size * 0.10);
      } else if (gender === 'girl') {
        ctx.moveTo(cx - rx * 0.98, cy - size * 0.04);
        ctx.quadraticCurveTo(cx - rx * 0.4, cy - ry * 1.24, cx + size * 0.12, cy - ry * 1.12);
        ctx.quadraticCurveTo(cx + rx * 0.98, cy - ry * 0.80, cx + rx * 0.92, cy - size * 0.14);
        ctx.quadraticCurveTo(cx + size * 0.12, cy - size * 0.22, cx - size * 0.08, cy - size * 0.10);
        ctx.quadraticCurveTo(cx - size * 0.25, cy + size * 0.02, cx - rx * 0.98, cy - size * 0.04);
      } else {
        ctx.moveTo(cx - rx * 0.96, cy - size * 0.08);
        ctx.quadraticCurveTo(cx, cy - ry * 1.30, cx + rx * 0.95, cy - size * 0.16);
        ctx.quadraticCurveTo(cx + size * 0.04, cy - size * 0.24, cx - rx * 0.96, cy - size * 0.08);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      this._drawVectorHelmetTop(ctx, size, options.outfit);
    }

    return c;
  }

  /** Exporta canvas para DataURL leve (tenta WebP primeiro para economizar espaço no localStorage). */
  safeToDataUrl(canvas, fallbackSrc = '', preferCompact = false, quality = 0.84) {
    try {
      if (preferCompact) {
        const webp = canvas.toDataURL('image/webp', quality);
        if (webp && webp.startsWith('data:image/webp')) return webp;
      }
      return canvas.toDataURL('image/png');
    } catch (_) {
      return fallbackSrc;
    }
  }

  /** Gera prévia da cabeça/rosto no Estúdio. */
  buildCreatorPreview(userImg, options = {}) {
    const validImg = this._isDrawableImage(userImg) ? userImg : null;
    const fallbackSrc = (validImg && validImg.src) || '';
    if (options.fullPhoto && validImg) {
      const canvas = document.createElement('canvas');
      const targetH = 220;
      const iw = validImg.naturalWidth || validImg.width || 160;
      const ih = validImg.naturalHeight || validImg.height || 160;
      const targetW = Math.max(110, Math.min(220, Math.floor(iw * (targetH / ih))));
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (options.faceFlipX) {
        ctx.translate(targetW, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(validImg, 0, 0, targetW, targetH);
      return this.safeToDataUrl(canvas, fallbackSrc);
    }

    if (validImg) {
      return this.safeToDataUrl(this.composeHeadSpriteCanvas(validImg, options), fallbackSrc);
    }
    return this.safeToDataUrl(this.composeIllustratedHeadCanvas(options), fallbackSrc);
  }

  /** Gera prévia ao vivo de CORPO INTEIRO no Estúdio (mostra pele, gênero, roupa, cabeça e acessório!). */
  buildFullBodyPreview(userImg, options = {}) {
    const c = document.createElement('canvas');
    c.width = 240;
    c.height = 240;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;

    const validImg = this._isDrawableImage(userImg) ? userImg : null;
    const skin = getSkinPalette(options.skinTone);
    const outfit = getOutfitPalette(options.outfit);
    const hair = getHairPalette(options.hairColor);
    const gender = options.gender || 'boy';
    const isLarge = (options.headSize || 'large') === 'large';
    const acc = options.accessory || 'none';

    if (options.fullPhoto && validImg) {
      const iw = validImg.naturalWidth || validImg.width || 160;
      const ih = validImg.naturalHeight || validImg.height || 160;
      const maxW = 176;
      const maxH = 196;
      const ratio = Math.min(maxW / iw, maxH / ih);
      const dw = Math.max(40, iw * ratio);
      const dh = Math.max(40, ih * ratio);
      const dx = (240 - dw) * 0.5;
      const dy = 212 - dh;

      ctx.fillStyle = 'rgba(0,0,0,0.40)';
      ctx.beginPath();
      ctx.ellipse(120, 214, Math.min(72, dw * 0.42), 9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      if (options.faceFlipX) {
        ctx.translate(240, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(validImg, dx, dy, dw, dh);
      ctx.restore();
      return this.safeToDataUrl(c, (validImg && validImg.src) || '');
    }

    const headCanvas = validImg
      ? this.composeHeadSpriteCanvas(validImg, options)
      : this.composeIllustratedHeadCanvas(options);

    // Chão sutil + sombra
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(120, 214, 62, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Skate na base
    ctx.fillStyle = outfit.topAccent;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(62, 194, 116, 11, 5) : ctx.fillRect(62, 194, 116, 11);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(70, 193, 100, 3);
    for (const wx of [84, 156]) {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(wx, 209, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = outfit.top;
      ctx.beginPath();
      ctx.arc(wx, 209, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const scale = 1.32;
    ctx.save();
    ctx.translate(120, 196);
    ctx.scale(scale, scale);

    // Perna traseira e dianteira
    const legs = [
      { kx: -12, ky: -22, fx: -15, fy: -4, alpha: 0.88 },
      { kx: 11, ky: -21, fx: 16, fy: -4, alpha: 1 }
    ];
    for (const lg of legs) {
      ctx.save();
      ctx.globalAlpha = lg.alpha;
      ctx.strokeStyle = outfit.bottom;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -42);
      ctx.lineTo(lg.kx, lg.ky);
      ctx.lineTo(lg.fx, lg.fy - 3);
      ctx.stroke();

      // Tênis
      ctx.fillStyle = outfit.shoe;
      ctx.beginPath();
      ctx.ellipse(lg.fx + 3, lg.fy - 3, 10, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = outfit.shoeSole;
      ctx.fillRect(lg.fx - 6, lg.fy - 1, 18, 2.5);
      ctx.restore();
    }

    // Helper para desenhar membro com contorno nítido (consistente com o rig da pista)
    const drawArmSegment = (x1, y1, x2, y2, width, color, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = width + 2.6;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
    };

    // Braço traseiro (manga da camiseta + antebraço na cor da pele)
    drawArmSegment(-8, -72, -15, -62, 7.6, outfit.top, 0.90);
    drawArmSegment(-15, -62, -22, -52, 6.6, skin.shadow, 0.92);

    // Tronco (varia por gênero)
    ctx.fillStyle = outfit.top;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (gender === 'girl') {
      ctx.moveTo(-13, -76);
      ctx.lineTo(13, -76);
      ctx.lineTo(10, -45);
      ctx.lineTo(14, -37);
      ctx.lineTo(-14, -37);
      ctx.lineTo(-10, -45);
    } else if (gender === 'neutral') {
      ctx.moveTo(-16, -77);
      ctx.lineTo(16, -77);
      ctx.lineTo(16, -40);
      ctx.lineTo(-16, -40);
    } else {
      ctx.moveTo(-15, -77);
      ctx.lineTo(15, -77);
      ctx.lineTo(13, -42);
      ctx.lineTo(-13, -42);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Faixa esportiva na camiseta
    ctx.fillStyle = outfit.topAccent;
    ctx.fillRect(-10, -64, 20, 6);

    // Pescoço
    ctx.fillStyle = skin.shadow;
    ctx.fillRect(-4.5, -83, 9, 9);

    // Cabeça (Grande vs Normal!) + Rabo de cavalo acompanhando dinamicamente hs
    const hs = isLarge ? 60 : 42;
    if (gender === 'girl') {
      ctx.save();
      ctx.fillStyle = hair.hex;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(-hs * 0.42, -80 - hs * 0.44, hs * 0.24, hs * 0.12, -0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.drawImage(headCanvas, -hs * 0.5, -80 - hs * 0.82, hs, hs);

    // Acessório na prévia
    if (acc && acc !== 'none' && window.Player && typeof window.Player.drawHeadAccessoryStatic === 'function') {
      window.Player.drawHeadAccessoryStatic(ctx, 0, -80, hs, acc, 0);
    }

    // Braço dianteiro (manga da camiseta + antebraço na cor da pele)
    drawArmSegment(10, -72, 17.5, -63.5, 7.6, outfit.top, 1);
    drawArmSegment(17.5, -63.5, 25, -55, 6.6, skin.hex, 1);

    ctx.restore();
    return this.safeToDataUrl(c, '');
  }

  /** Cria um novo personagem (com foto ou avatar ilustrado customizado). */
  async createCustomCharacterFromImage(fileOrImg, name, options = {}) {
    const loadRawImg = () => new Promise((resolve, reject) => {
      if (!fileOrImg) {
        resolve(null);
        return;
      }
      if ((typeof HTMLImageElement !== 'undefined' && fileOrImg instanceof HTMLImageElement)
        || (typeof HTMLCanvasElement !== 'undefined' && fileOrImg instanceof HTMLCanvasElement)) {
        resolve(this._isDrawableImage(fileOrImg) ? fileOrImg : null);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawImg = new Image();
        rawImg.onload = () => {
          if ((rawImg.naturalWidth || rawImg.width) > 0) resolve(rawImg);
          else reject(new Error('Imagem vazia ou inválida.'));
        };
        rawImg.onerror = () => reject(new Error('Não foi possível decodificar esta imagem.'));
        rawImg.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo de imagem.'));
      reader.readAsDataURL(fileOrImg);
    });

    const rawImg = await loadRawImg();
    const validImg = this._isDrawableImage(rawImg) ? rawImg : null;
    const charId = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    const fullPhoto = !!(options.fullPhoto && validImg);
    const useHelmet = options.useHelmet !== false;
    const hasPhoto = !!validImg;

    const headCanvas = validImg
      ? this.composeHeadSpriteCanvas(validImg, { ...options, useHelmet })
      : this.composeIllustratedHeadCanvas({ ...options, useHelmet });

    const headDataUrl = this.safeToDataUrl(headCanvas, validImg ? (validImg.src || '') : '', true);

    // Só gera os 4 sprites extras se o jogador escolheu modo foto inteira (economiza localStorage)
    const fallbackSprites = fullPhoto
      ? this.generateSpritesFromCanvas(validImg, { faceFlipX: !!options.faceFlipX })
      : { skate: '', duck: '', jump: '', trick: '' };

    const genderObj = CHAR_CUSTOMIZATION.GENDERS.find(g => g.id === (options.gender || 'boy')) || CHAR_CUSTOMIZATION.GENDERS[0];
    const safeName = String(name || '').trim().slice(0, 24) || 'Novo Amigo Radical';

    const newChar = this.normalizeCharacter({
      id: charId,
      name: safeName,
      badge: fullPhoto ? 'Foto Inteira!' : (hasPhoto ? `${genderObj.icon} Foto Radical!` : `${genderObj.icon} Avatar Customizado`),
      description: fullPhoto
        ? 'Personagem criado com sua foto inteira na pista!'
        : (hasPhoto
          ? 'Personagem articulado com seu rosto grande, cor de pele, roupa e estilo próprios!'
          : 'Avatar ilustrado com cor de pele, cabelo, roupa e acessório do seu jeito!'),
      isCustom: true,
      renderMode: 'sprite',
      bodyStyle: fullPhoto ? 'sprite' : 'custom',
      fullPhoto,
      useHelmet,
      hasPhoto,
      gender: options.gender || 'boy',
      skinTone: options.skinTone || 'fair',
      outfit: options.outfit || 'street_blue',
      hairColor: options.hairColor || 'brown',
      accessory: options.accessory || 'none',
      headSize: options.headSize || 'large',
      headSprite: headDataUrl,
      portrait: headDataUrl,
      sprites: fallbackSprites,
      stats: {
        visual: fullPhoto ? 'Foto 2D' : (hasPhoto ? 'Rig Foto' : 'Avatar 2D'),
        favorito: '🌟 Todos',
        estilo: 'Exclusivo'
      },
      width: 105,
      height: 130,
      duckHeight: 85
    });

    this.characters.push(newChar);
    this.loadedHeads[charId] = headCanvas;
    this.saveCustomCharacters();
    await this.preloadAllSprites();
    this.ensureGeneratedHeadsAndPortraits();
    this.select(charId);
    return newChar;
  }

  // Gera variações (skate, duck, jump, trick) para modo fullPhoto
  generateSpritesFromCanvas(img, options = {}) {
    if (!this._isDrawableImage(img)) {
      return { skate: '', duck: '', jump: '', trick: '' };
    }
    const createDataUrl = (drawFn, w, h) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (options.faceFlipX) {
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
      }
      drawFn(ctx, w, h);
      return this.safeToDataUrl(canvas, '', true);
    };

    const iw = img.naturalWidth || img.width || 160;
    const ih = img.naturalHeight || img.height || 160;
    const targetH = 210;
    const targetW = Math.max(105, Math.min(190, Math.floor(iw * (targetH / ih))));

    const skateData = createDataUrl((ctx, w, h) => {
      ctx.drawImage(img, 0, 0, w, h);
    }, targetW, targetH);

    const duckData = createDataUrl((ctx, w, h) => {
      ctx.drawImage(img, 0, 0, w, h);
    }, Math.floor(targetW * 1.10), Math.floor(targetH * 0.72));

    const jumpData = createDataUrl((ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-14 * Math.PI / 180);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    }, targetW + 32, targetH + 32);

    const trickData = createDataUrl((ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(22 * Math.PI / 180);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    }, targetW + 32, targetH + 32);

    return {
      skate: skateData,
      duck:  duckData,
      jump:  jumpData,
      trick: trickData
    };
  }

  deleteCustomCharacter(id) {
    const target = this.characters.find(c => c.id === id);
    if (!target || !target.isCustom) return false;

    this.characters = this.characters.filter(c => c.id !== id);
    delete this.loadedImages[id];
    delete this.loadedHeads[id];
    delete this._failedHeads[id];
    for (const k of Object.keys(this.riderCache)) {
      if (k.startsWith(id + ':')) delete this.riderCache[k];
    }
    this.scaleCache = {};
    this.saveCustomCharacters();

    if (this.selectedId === id) {
      const fallback = this.characters.find(c => this.isCharacterUnlocked(c.id)) || this.characters[0];
      this.select(fallback ? fallback.id : 'luigi_3d');
    }
    return true;
  }
}

window.characterManager = new CharacterManager();
