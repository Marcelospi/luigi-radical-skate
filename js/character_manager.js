// Gerenciador de Personagens, Peças do Cutout Rig 2D e Estúdio de Personagens
// Pré-carrega assets/rig/*.png para animação articulada com IK e permite criar
// personagens por foto (galeria ou câmera) acoplando o rosto sob o capacete SK8 oficial.

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

class CharacterManager {
  constructor() {
    this.characters = [];
    this.selectedId = 'luigi_3d';
    this.loadedImages = {};
    this.loadedHeads = {};
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

  async init() {
    try {
      const resp = await fetch('assets/characters.json');
      const data = await resp.json();
      this.characters = data.characters || [];
      this.selectedId = data.defaultCharacter || 'luigi_3d';
    } catch (e) {
      console.warn('Erro ao carregar characters.json, usando padrão de fallback', e);
      this.characters = [
        {
          id: 'luigi_3d',
          name: 'Luigi 3D (SK8-BOY)',
          badge: 'Estilo Radical 3D',
          description: 'Luigi em sua versão oficial 3D com capacete SK8, camisa xadrez, skate street art e manobras radicais!',
          renderMode: 'sprite',
          portrait: 'assets/portraits/portrait_luigi_3d.png',
          sprites: {
            skate: 'assets/sprites/luigi_3d_skate.png',
            duck:  'assets/sprites/luigi_3d_duck.png',
            jump:  'assets/sprites/luigi_3d_jump.png',
            trick: 'assets/sprites/luigi_3d_trick.png'
          },
          width: 105,
          height: 130,
          duckHeight: 85
        }
      ];
    }

    this.characters = this.characters.map(char => this.normalizeCharacter(char));
    this.loadCustomCharacters();

    // Recuperar seleção anterior com fallback seguro
    try {
      const saved = localStorage.getItem('luigi_selected_char');
      if (saved && this.characters.some(c => c.id === saved)) {
        this.selectedId = saved;
      } else if (!this.characters.some(c => c.id === this.selectedId) && this.characters[0]) {
        this.selectedId = this.characters[0].id;
      }
    } catch (e) {}

    await Promise.all([
      this.preloadRigParts(),
      this.preloadAllSprites()
    ]);
  }

  normalizeCharacter(char) {
    if (!char) return char;
    const isFullPhoto = !!(char.fullPhoto || char.bodyMode === 'fullphoto');
    return {
      ...char,
      renderMode: 'sprite',
      fullPhoto: isFullPhoto,
      useHelmet: char.useHelmet !== false
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

  /** Retorna as 8 peças do Cutout Rig 2D (ou { ready: false } enquanto carrega). */
  getRigParts() {
    return this.rigParts;
  }

  loadCustomCharacters() {
    try {
      const customStr = localStorage.getItem('luigi_custom_characters');
      if (customStr) {
        const customChars = JSON.parse(customStr);
        for (const raw of customChars) {
          if (!this.characters.some(c => c.id === raw.id)) {
            this.characters.push(this.normalizeCharacter({ ...raw, isCustom: true }));
          }
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar personagens customizados', e);
    }
  }

  saveCustomCharacters() {
    try {
      const customOnly = this.characters.filter(c => c.isCustom);
      localStorage.setItem('luigi_custom_characters', JSON.stringify(customOnly));
    } catch (e) {
      console.warn('Erro ao salvar personagens customizados', e);
    }
  }

  getCharacter(id) {
    return this.characters.find(c => c.id === id) || this.characters[0];
  }

  getSelected() {
    return this.getCharacter(this.selectedId);
  }

  select(id) {
    if (this.characters.some(c => c.id === id)) {
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
                this.loadedImages[char.id][pose] = img;
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

      // Pré-carrega headSprite de personagens customizados para o Cutout Rig
      const headSrc = char.headSprite || (char.isCustom && !char.fullPhoto ? char.portrait : null);
      if (headSrc && !this.loadedHeads[char.id]) {
        promises.push(new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            this.loadedHeads[char.id] = img;
            resolve();
          };
          img.onerror = () => {
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

  getSprite(charId, pose) {
    return (this.loadedImages[charId] && this.loadedImages[charId][pose]) || null;
  }

  /**
   * Retorna a imagem pré-carregada da cabeça 160x160 para o Cutout Rig 2D.
   * Para `luigi_3d` retorna `rigParts.head`; para customizados retorna `loadedHeads[charId]`.
   */
  getHeadImage(charId) {
    if (this.loadedHeads[charId]) return this.loadedHeads[charId];
    if (charId === 'luigi_3d' && this.rigParts.head) return this.rigParts.head;
    return null;
  }

  /** Fallback de sprite sem prancha de skate (usado apenas se o Cutout Rig não estiver pronto). */
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
  // Estúdio de Personagens: cabeça 160x160 com helmet_overlay.png
  // ==========================================================

  /**
   * Compõe a cabeça 160x160 no mesmo enquadramento de head_luigi.png:
   * - Aplica zoom, deslocamento X/Y e espelhamento horizontal (faceFlipX).
   * - Recorta em oval suave (feather) adaptado para capacete ou rosto livre.
   * - Aplica assets/rig/helmet_overlay.png POR CIMA quando useHelmet=true.
   */
  composeHeadSpriteCanvas(userImg, options = {}) {
    const size = 160;
    const zoom = Math.max(0.7, Math.min(2.6, Number(options.faceZoom) || 1.15));
    const offsetX = Math.max(-0.5, Math.min(0.5, Number(options.faceOffsetX) || 0));
    const offsetY = Math.max(-0.5, Math.min(0.5, Number(options.faceOffsetY) || 0));
    const flipX = !!options.faceFlipX;
    const useHelmet = options.useHelmet !== false;

    // 1. Camada da foto recortada em oval suave
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = size;
    faceCanvas.height = size;
    const fctx = faceCanvas.getContext('2d');
    fctx.imageSmoothingEnabled = true;
    fctx.imageSmoothingQuality = 'high';

    const iw = userImg.naturalWidth || userImg.width || 160;
    const ih = userImg.naturalHeight || userImg.height || 160;
    const baseScale = Math.max(size / iw, size / ih) * zoom;
    const drawW = iw * baseScale;
    const drawH = ih * baseScale;

    // Centraliza levemente para baixo quando tem capacete (para o rosto ficar abaixo da aba)
    const centerShiftY = useHelmet ? 14 : 0;
    const dx = size * 0.5 + offsetX * size;
    const dy = size * 0.5 + centerShiftY + offsetY * size;

    fctx.save();
    fctx.translate(dx, dy);
    if (flipX) fctx.scale(-1, 1);
    fctx.drawImage(userImg, -drawW * 0.5, -drawH * 0.5, drawW, drawH);
    fctx.restore();

    // Aplica máscara oval suave (feather) deixando o rosto bem integrado
    fctx.globalCompositeOperation = 'destination-in';
    const ovalCx = size * 0.5;
    const ovalCy = useHelmet ? size * 0.58 : size * 0.50;
    const ovalRx = useHelmet ? size * 0.37 : size * 0.42;
    const ovalRy = useHelmet ? size * 0.38 : size * 0.46;

    fctx.save();
    fctx.translate(ovalCx, ovalCy);
    fctx.scale(1, ovalRy / ovalRx);
    const mask = fctx.createRadialGradient(0, 0, ovalRx * 0.62, 0, 0, ovalRx);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.80, 'rgba(0,0,0,1)');
    mask.addColorStop(0.95, 'rgba(0,0,0,0.45)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    fctx.fillStyle = mask;
    fctx.beginPath();
    fctx.arc(0, 0, ovalRx, 0, Math.PI * 2);
    fctx.fill();
    fctx.restore();

    // 2. Camada final combinando rosto + capacete SK8 oficial por cima
    const out = document.createElement('canvas');
    out.width = size;
    out.height = size;
    const octx = out.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';

    octx.drawImage(faceCanvas, 0, 0);

    if (useHelmet && this.rigParts.helmetOverlay) {
      octx.drawImage(this.rigParts.helmetOverlay, 0, 0, size, size);
    }

    return out;
  }

  /** Gera prévia ao vivo no Estúdio de Personagens (cabeça com/sem capacete ou foto inteira). */
  buildCreatorPreview(userImg, options = {}) {
    if (options.fullPhoto) {
      const canvas = document.createElement('canvas');
      const targetH = 220;
      const iw = userImg.naturalWidth || userImg.width || 160;
      const ih = userImg.naturalHeight || userImg.height || 160;
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
      ctx.drawImage(userImg, 0, 0, targetW, targetH);
      return canvas.toDataURL('image/png');
    }

    return this.composeHeadSpriteCanvas(userImg, options).toDataURL('image/png');
  }

  /** Cria um novo personagem a partir de um arquivo ou imagem (galeria ou câmera). */
  async createCustomCharacterFromImage(fileOrImg, name, options = {}) {
    const loadRawImg = () => new Promise((resolve, reject) => {
      if (fileOrImg instanceof HTMLImageElement || fileOrImg instanceof HTMLCanvasElement) {
        resolve(fileOrImg);
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const rawImg = new Image();
        rawImg.onload = () => resolve(rawImg);
        rawImg.onerror = reject;
        rawImg.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileOrImg);
    });

    const rawImg = await loadRawImg();
    const charId = 'custom_' + Date.now();
    const fullPhoto = !!options.fullPhoto;
    const useHelmet = options.useHelmet !== false;

    const headDataUrl = this.composeHeadSpriteCanvas(rawImg, { ...options, useHelmet }).toDataURL('image/png');
    const fallbackSprites = this.generateSpritesFromCanvas(rawImg, { faceFlipX: !!options.faceFlipX });

    const newChar = this.normalizeCharacter({
      id: charId,
      name: name || 'Novo Amigo Radical',
      badge: fullPhoto ? 'Foto Personalizada!' : (useHelmet ? 'Skatista com Capacete!' : 'Skatista Articulado!'),
      description: fullPhoto
        ? 'Personagem criado com sua foto inteira na pista!'
        : 'Seu rosto integrado ao boneco articulado com remada, flexão de joelhos e manobras reais!',
      isCustom: true,
      renderMode: 'sprite',
      fullPhoto,
      useHelmet,
      headSprite: headDataUrl,
      portrait: headDataUrl,
      sprites: {
        skate: fallbackSprites.skate,
        duck:  fallbackSprites.duck,
        jump:  fallbackSprites.jump,
        trick: fallbackSprites.trick
      },
      stats: {
        velocidade: 'Máxima',
        salto: 'Foguete',
        manobras: 'Radical'
      },
      width: 105,
      height: 130,
      duckHeight: 85
    });

    this.characters.push(newChar);
    this.saveCustomCharacters();
    await this.preloadAllSprites();
    this.select(charId);
    return newChar;
  }

  // Gera variações (skate, duck, jump, trick) para modo fullPhoto e fallback
  generateSpritesFromCanvas(img, options = {}) {
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
      return canvas.toDataURL('image/png');
    };

    const iw = img.naturalWidth || img.width || 160;
    const ih = img.naturalHeight || img.height || 160;
    const targetH = 220;
    const targetW = Math.max(110, Math.min(200, Math.floor(iw * (targetH / ih))));

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
    }, targetW + 36, targetH + 36);

    const trickData = createDataUrl((ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(22 * Math.PI / 180);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    }, targetW + 36, targetH + 36);

    return {
      skate: skateData,
      duck:  duckData,
      jump:  jumpData,
      trick: trickData
    };
  }

  deleteCustomCharacter(id) {
    this.characters = this.characters.filter(c => c.id !== id);
    delete this.loadedImages[id];
    delete this.loadedHeads[id];
    for (const k of Object.keys(this.riderCache)) {
      if (k.startsWith(id + ':')) delete this.riderCache[k];
    }
    this.scaleCache = {};
    this.saveCustomCharacters();

    if (this.selectedId === id) {
      const fallback = this.characters[0];
      this.select(fallback ? fallback.id : 'luigi_3d');
    }
  }
}

window.characterManager = new CharacterManager();
