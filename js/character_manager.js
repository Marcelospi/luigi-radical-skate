// Gerenciador de Personagens e Estúdio de Criação de Novos Personagens
// Usa os sprites ilustrados oficiais e permite compor o rosto de qualquer foto
// diretamente sobre as 4 poses oficiais de skatista (ou usar a foto inteira).

// Coordenadas calibradas da abertura do rosto (abaixo da aba do capacete SK8)
// nas 4 poses ilustradas oficiais de luigi_3d_{skate,duck,jump,trick}.png.
const SKATER_FACE_SLOTS = {
  skate: { cx: 0.446, cy: 0.179, rx: 0.088, ry: 0.082, rot: -0.14 },
  duck:  { cx: 0.449, cy: 0.175, rx: 0.088, ry: 0.084, rot: -0.12 },
  jump:  { cx: 0.521, cy: 0.234, rx: 0.084, ry: 0.084, rot:  0.04 },
  trick: { cx: 0.332, cy: 0.276, rx: 0.090, ry: 0.084, rot: -0.45 }
};

class CharacterManager {
  constructor() {
    this.characters = [];
    this.selectedId = 'luigi_3d';
    this.loadedImages = {};
    this.loadedHeads = {};
    this.scaleCache = {};
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

    // Normaliza todos os personagens para modo 'sprite'
    this.characters = this.characters.map(char => this.normalizeCharacter(char));

    // Carregar personagens adicionais criados no navegador
    this.loadCustomCharacters();

    // Recuperar seleção anterior do usuário (com fallback seguro se o ID não existir mais)
    try {
      const saved = localStorage.getItem('luigi_selected_char');
      if (saved && this.characters.some(c => c.id === saved)) {
        this.selectedId = saved;
      } else if (!this.characters.some(c => c.id === this.selectedId) && this.characters[0]) {
        this.selectedId = this.characters[0].id;
      }
    } catch (e) {}

    // Pré-carregar todas as imagens
    await this.preloadAllSprites();
  }

  normalizeCharacter(char) {
    if (!char) return char;
    return {
      ...char,
      renderMode: 'sprite'
    };
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
    }
    await Promise.all(promises);
    this.scaleCache = {};
  }

  getSprite(charId, pose) {
    return (this.loadedImages[charId] && this.loadedImages[charId][pose]) || null;
  }

  getHeadImage(charId) {
    return this.loadedHeads[charId] || null;
  }

  /**
   * Fator de escala em pixels por unidade de sprite, derivado da pose "skate".
   * Todas as poses usam esta mesma escala para manter proporção consistente.
   */
  getSpriteScale(charId, targetHeight) {
    const cacheKey = charId + ':' + targetHeight;
    if (this.scaleCache[cacheKey] !== undefined) return this.scaleCache[cacheKey];

    const base = this.getSprite(charId, 'skate');
    const scale = base && base.height ? targetHeight / base.height : targetHeight / 240;

    this.scaleCache[cacheKey] = scale;
    return scale;
  }

  /** Cor de contraluz (rim-light) coerente com o bioma atual. */
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
  // Estúdio de Personagens: rosto no corpo ilustrado ou foto inteira
  // ==========================================================

  /** Calcula a janela quadrada de recorte do rosto na foto enviada. */
  getFaceCropRect(img, options = {}) {
    const faceZoom = Math.max(0.8, Math.min(2.0, Number(options.faceZoom) || 1.1));
    const faceOffsetY = Math.max(-0.35, Math.min(0.35, Number(options.faceOffsetY) || 0));
    const minSide = Math.min(img.width, img.height);
    const cropSize = Math.max(24, minSide / faceZoom);
    const sx = Math.max(0, Math.min(img.width - cropSize, (img.width - cropSize) * 0.5));
    const baseTop = Math.max(0, (img.height - minSide) * 0.14);
    const syRaw = baseTop + faceOffsetY * minSide + (minSide - cropSize) * 0.22;
    const sy = Math.max(0, Math.min(img.height - cropSize, syRaw));
    return { sx, sy, cropSize };
  }

  /** Recorta o rosto em máscara oval suave pronta para encaixar sob o capacete. */
  createFacePatchCanvas(userImg, options = {}) {
    const { sx, sy, cropSize } = this.getFaceCropRect(userImg, options);
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(userImg, sx, sy, cropSize, cropSize, 0, 0, size, size);

    // Sombra sutil da aba do capacete na testa para integração realista
    const shadowGrad = ctx.createLinearGradient(0, 0, 0, size * 0.38);
    shadowGrad.addColorStop(0, 'rgba(20, 14, 10, 0.42)');
    shadowGrad.addColorStop(1, 'rgba(20, 14, 10, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, 0, size, size * 0.38);

    // Máscara oval suave nas bordas (feather)
    ctx.globalCompositeOperation = 'destination-in';
    const mask = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.49);
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.72, 'rgba(0,0,0,1)');
    mask.addColorStop(0.92, 'rgba(0,0,0,0.45)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mask;
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, size * 0.46, size * 0.49, 0, 0, Math.PI * 2);
    ctx.fill();

    return canvas;
  }

  /** Compõe o rosto recortado sobre uma pose ilustrada oficial de skatista. */
  composeFaceOnPose(baseSprite, facePatch, slot) {
    const w = baseSprite.naturalWidth || baseSprite.width;
    const h = baseSprite.naturalHeight || baseSprite.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(baseSprite, 0, 0, w, h);

    ctx.save();
    ctx.translate(slot.cx * w, slot.cy * h);
    ctx.rotate(slot.rot || 0);
    const drawW = slot.rx * 2 * w;
    const drawH = slot.ry * 2 * h;
    ctx.drawImage(facePatch, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    return canvas.toDataURL('image/png');
  }

  /** Gera prévia ao vivo no Estúdio de Personagens (corpo de skatista ou foto inteira). */
  buildCreatorPreview(userImg, options = {}) {
    const bodyMode = options.bodyMode || 'skater';
    const baseSkate = this.getSprite('luigi_3d', 'skate');

    if (bodyMode === 'skater' && baseSkate) {
      const facePatch = this.createFacePatchCanvas(userImg, options);
      return this.composeFaceOnPose(baseSkate, facePatch, SKATER_FACE_SLOTS.skate);
    }

    // Modo foto inteira: mostra a imagem ajustada com enquadramento limpo
    const canvas = document.createElement('canvas');
    const targetH = 220;
    const targetW = Math.max(110, Math.min(220, Math.floor(userImg.width * (targetH / userImg.height))));
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(userImg, 0, 0, targetW, targetH);
    return canvas.toDataURL('image/png');
  }

  /** Gera retrato quadrado (160x160) focado no rosto para cards e placar de líderes. */
  createPortraitDataUrl(userImg, options = {}) {
    const { sx, sy, cropSize } = this.getFaceCropRect(userImg, options);
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(userImg, sx, sy, cropSize, cropSize, 0, 0, 160, 160);
    return canvas.toDataURL('image/png');
  }

  // Cria um novo personagem personalizado a partir de uma foto enviada pelo usuário
  async createCustomCharacterFromImage(file, name, options = {}) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const rawImg = new Image();
        rawImg.onload = async () => {
          const charId = 'custom_' + Date.now();
          const bodyMode = options.bodyMode || 'skater';
          const sprites = this.generateCustomSprites(rawImg, { ...options, bodyMode });

          const newChar = this.normalizeCharacter({
            id: charId,
            name: name || 'Novo Amigo Radical',
            badge: bodyMode === 'skater' ? 'Skatista 3D!' : 'Foto Personalizada!',
            description: bodyMode === 'skater'
              ? 'Seu rosto no corpo oficial de skatista com manobras radicais!'
              : 'Personagem personalizado criado com sua foto na pista do Luigi!',
            isCustom: true,
            renderMode: 'sprite',
            portrait: sprites.portrait,
            sprites: {
              skate: sprites.skate,
              duck:  sprites.duck,
              jump:  sprites.jump,
              trick: sprites.trick
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
          resolve(newChar);
        };
        rawImg.onerror = reject;
        rawImg.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** Gera os 4 sprites (rosto composto nas 4 poses ilustradas ou foto inteira). */
  generateCustomSprites(userImg, options = {}) {
    const bodyMode = options.bodyMode || 'skater';
    const portrait = this.createPortraitDataUrl(userImg, options);

    if (bodyMode === 'skater') {
      const poses = ['skate', 'duck', 'jump', 'trick'];
      const hasAllBases = poses.every(p => !!this.getSprite('luigi_3d', p));
      if (hasAllBases) {
        const facePatch = this.createFacePatchCanvas(userImg, options);
        return {
          skate: this.composeFaceOnPose(this.getSprite('luigi_3d', 'skate'), facePatch, SKATER_FACE_SLOTS.skate),
          duck:  this.composeFaceOnPose(this.getSprite('luigi_3d', 'duck'),  facePatch, SKATER_FACE_SLOTS.duck),
          jump:  this.composeFaceOnPose(this.getSprite('luigi_3d', 'jump'),  facePatch, SKATER_FACE_SLOTS.jump),
          trick: this.composeFaceOnPose(this.getSprite('luigi_3d', 'trick'), facePatch, SKATER_FACE_SLOTS.trick),
          portrait
        };
      }
    }

    // Fallback ou modo "Usar a foto inteira"
    return {
      ...this.generateSpritesFromCanvas(userImg),
      portrait
    };
  }

  // Gera variações (skate, duck, jump, trick, portrait) a partir da foto inteira
  generateSpritesFromCanvas(img) {
    const createDataUrl = (drawFn, w, h) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      drawFn(ctx, w, h);
      return canvas.toDataURL('image/png');
    };

    const targetH = 240;
    const targetW = Math.max(120, Math.min(220, Math.floor(img.width * (targetH / img.height))));

    const skateData = createDataUrl((ctx, w, h) => {
      ctx.drawImage(img, 0, 0, w, h);
    }, targetW, targetH);

    const duckData = createDataUrl((ctx, w, h) => {
      ctx.drawImage(img, 0, 0, w, h);
    }, Math.floor(targetW * 1.12), Math.floor(targetH * 0.70));

    const jumpData = createDataUrl((ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-14 * Math.PI / 180);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    }, targetW + 40, targetH + 40);

    const trickData = createDataUrl((ctx, w, h) => {
      ctx.translate(w / 2, h / 2);
      ctx.rotate(22 * Math.PI / 180);
      ctx.drawImage(img, -targetW / 2, -targetH / 2, targetW, targetH);
    }, targetW + 40, targetH + 40);

    const portraitData = this.createPortraitDataUrl(img);

    return {
      skate: skateData,
      duck:  duckData,
      jump:  jumpData,
      trick: trickData,
      portrait: portraitData
    };
  }

  deleteCustomCharacter(id) {
    this.characters = this.characters.filter(c => c.id !== id);
    delete this.loadedImages[id];
    delete this.loadedHeads[id];
    this.scaleCache = {};
    this.saveCustomCharacters();

    if (this.selectedId === id) {
      const fallback = this.characters[0];
      this.select(fallback ? fallback.id : 'luigi_3d');
    }
  }
}

window.characterManager = new CharacterManager();
