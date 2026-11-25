// Placar Universal Online via Firebase Firestore (projeto: luigi-radical-skate)
// Carregamento dinâmico ESM (Firebase v11) com timeout e fallback 100% seguro offline.

const FIREBASE_CONFIG = {
  projectId: 'luigi-radical-skate',
  appId: '1:549407420023:web:7ad4383a5ea90bb6492072',
  storageBucket: 'luigi-radical-skate.firebasestorage.app',
  apiKey: 'AIzaSyDZ7wdLYnHexa4NmQ3SNK1oKE4-Gf4X3gw',
  authDomain: 'luigi-radical-skate.firebaseapp.com',
  messagingSenderId: '549407420023'
};

const VALID_SPORTS = ['skate', 'bmx', 'scooter', 'skates'];
const SPORT_DEFAULT_ICONS = {
  skate: '🛹',
  bmx: '🚲',
  scooter: '🛴',
  skates: '🛼'
};
const COLLECTION_NAME = 'leaderboard';
const REQUEST_TIMEOUT_MS = 6500;

function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error('Tempo limite excedido ao conectar ao placar global');
      err.code = 'timeout';
      reject(err);
    }, ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Sanitiza texto sem quebrar pares substitutos UTF-16 (emojis), removendo
 * caracteres de controle e garantindo que o tamanho respeite [minLen, maxLen].
 */
function sanitizeText(raw, fallback, minLen, maxLen) {
  let clean = String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean || /^data:/i.test(clean)) {
    return fallback;
  }

  // Trunca por code points mantendo também clean.length <= maxLen (seguro em JS e Firestore)
  let out = '';
  for (const ch of Array.from(clean)) {
    if (out.length + ch.length > maxLen) break;
    out += ch;
  }
  out = out.trim();
  return out.length >= minLen ? out : fallback;
}

class OnlineLeaderboard {
  constructor() {
    this._sdkPromise = null;
    this._sdk = null;
    this._db = null;
    this._lastError = null;
    this._inFlightSubmissions = new Map();
    this._submittedKeys = new Map();
    this._setupConnectivityListeners();
  }

  _setupConnectivityListeners() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('online', () => {
      this._lastError = null;
      if (this._db && this._sdk && typeof this._sdk.enableNetwork === 'function') {
        try {
          Promise.resolve(this._sdk.enableNetwork(this._db)).catch(() => {});
        } catch (_) {}
      }
    });
    window.addEventListener('offline', () => {
      if (this._db && this._sdk && typeof this._sdk.disableNetwork === 'function') {
        try {
          Promise.resolve(this._sdk.disableNetwork(this._db)).catch(() => {});
        } catch (_) {}
      }
    });
  }

  /** Indica se o ambiente suporta acesso online (navegador com fetch/ESM). */
  isAvailable() {
    if (typeof window === 'undefined') return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return true;
  }

  getLastError() {
    return this._lastError;
  }

  /** Carrega os módulos ESM do Firebase sob demanda (1 única vez). */
  async ensureReady() {
    if (!this.isAvailable()) return null;
    if (this._db && this._sdk) {
      if (typeof this._sdk.enableNetwork === 'function') {
        try { Promise.resolve(this._sdk.enableNetwork(this._db)).catch(() => {}); } catch (_) {}
      }
      return { db: this._db, sdk: this._sdk };
    }

    if (!this._sdkPromise) {
      this._sdkPromise = (async () => {
        const [appMod, fsMod] = await withTimeout(Promise.all([
          import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js')
        ]));

        const existing = appMod.getApps && appMod.getApps();
        const app = (existing && existing.length > 0)
          ? existing[0]
          : appMod.initializeApp(FIREBASE_CONFIG);

        this._db = fsMod.getFirestore(app);
        this._sdk = fsMod;
        return { db: this._db, sdk: this._sdk };
      })().catch((err) => {
        this._lastError = err;
        this._sdkPromise = null; // permite tentar novamente mais tarde se a internet voltar
        return null;
      });
    }

    return this._sdkPromise;
  }

  /** Sanitiza uma entrada para cumprir exatamente os 10 campos exigidos em firestore.rules. */
  buildStrictPayload(entry, serverTimestampFn) {
    const rawScore = Number(entry && entry.score);
    if (!Number.isFinite(rawScore)) return null;
    const score = Math.floor(rawScore);
    if (score < 1 || score > 9999999) return null;

    const now = new Date();
    const defaultDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const rawSport = String((entry && entry.sportId) || 'skate').trim().toLowerCase();
    const sportId = VALID_SPORTS.includes(rawSport) ? rawSport : 'skate';
    const defaultSportIcon = SPORT_DEFAULT_ICONS[sportId] || '🛹';

    const name = sanitizeText(entry && entry.name, 'Skatista', 1, 24);
    const characterId = sanitizeText(entry && entry.characterId, 'luigi_3d', 1, 40);
    const characterName = sanitizeText(entry && entry.characterName, 'Luigi 3D', 1, 30);
    const sportIcon = sanitizeText(entry && entry.sportIcon, defaultSportIcon, 1, 8);
    const date = sanitizeText(entry && entry.date, defaultDate, 4, 20);
    const time = sanitizeText(entry && entry.time, defaultTime, 4, 12);

    const rawDist = Number(entry && entry.distance);
    const distance = Number.isFinite(rawDist)
      ? Math.max(0, Math.min(999999, Math.floor(rawDist)))
      : 0;

    // Exatamente os 10 campos permitidos pelas regras do Firestore (sem base64/data:)
    return {
      name,
      score,
      distance,
      characterId,
      characterName,
      sportId,
      sportIcon,
      date,
      time,
      createdAt: serverTimestampFn()
    };
  }

  /** Payload autenticado com UID verificado e nome da conta/família (com fallback para 10 campos). */
  buildAuthenticatedPayload(entry, serverTimestampFn, user) {
    const base = this.buildStrictPayload(entry, serverTimestampFn);
    if (!base) return null;
    if (!user || !user.uid) return base;
    const rawAcc = user.displayName || (user.email ? String(user.email).split('@')[0] : '') || base.name;
    return {
      ...base,
      uid: sanitizeText(user.uid, '', 1, 128),
      accountName: sanitizeText(rawAcc, base.name, 1, 30)
    };
  }

  _buildDedupKey(item) {
    return [
      String(item.name || '').trim().toLowerCase(),
      Math.floor(Number(item.score) || 0),
      Math.floor(Number(item.distance) || 0),
      String(item.characterId || 'luigi_3d').trim(),
      String(item.sportId || 'skate').trim(),
      String(item.date || '').trim(),
      String(item.time || '').trim()
    ].join('|');
  }

  /** Busca as maiores pontuações globais (sempre com orderBy('score','desc') e limit <= 50). */
  async fetchTopScores(max = 40) {
    const ready = await this.ensureReady();
    if (!ready) throw new Error('Placar global indisponível');

    const { db, sdk } = ready;
    const safeLimit = Math.max(1, Math.min(50, Math.floor(Number(max) || 40)));
    const q = sdk.query(
      sdk.collection(db, COLLECTION_NAME),
      sdk.orderBy('score', 'desc'),
      sdk.limit(safeLimit)
    );

    const snapshot = await withTimeout(sdk.getDocs(q));
    const results = [];
    const seen = new Set();

    snapshot.forEach((doc) => {
      const d = doc.data() || {};
      const sportId = VALID_SPORTS.includes(d.sportId) ? d.sportId : 'skate';
      const characterId = sanitizeText(d.characterId, 'luigi_3d', 1, 40);
      const uid = (typeof d.uid === 'string' && d.uid.trim()) ? d.uid.trim().slice(0, 128) : '';
      const accountName = (typeof d.accountName === 'string' && d.accountName.trim())
        ? sanitizeText(d.accountName, '', 1, 30)
        : '';
      const item = {
        id: doc.id,
        name: sanitizeText(d.name, 'Skatista', 1, 24),
        score: Math.max(0, Math.floor(Number(d.score) || 0)),
        distance: Math.max(0, Math.floor(Number(d.distance) || 0)),
        characterId,
        characterName: sanitizeText(d.characterName, 'Luigi 3D', 1, 30),
        characterPortrait: characterId === 'luigi_real'
          ? 'assets/portraits/portrait_luigi_real.png'
          : 'assets/portraits/portrait_luigi_3d.png',
        sportId,
        sportIcon: sanitizeText(d.sportIcon, SPORT_DEFAULT_ICONS[sportId] || '🛹', 1, 8),
        date: sanitizeText(d.date, '', 0, 20),
        time: sanitizeText(d.time, '', 0, 12),
        uid,
        accountName,
        verified: Boolean(uid),
        isOnline: true
      };

      // Deduplica registros idênticos que possam ter sido enviados duas vezes em reconexões antigas
      const dedupKey = this._buildDedupKey(item);
      if (!seen.has(dedupKey)) {
        seen.add(dedupKey);
        results.push(item);
      }
    });

    results.sort((a, b) => (b.score - a.score) || (b.distance - a.distance));
    return results;
  }

  /** Envia uma pontuação para o Placar Universal Global (autenticado com fallback clássico de 10 campos). */
  async submitScore(entry) {
    const ready = await this.ensureReady();
    if (!ready) return { ok: false, reason: 'offline' };

    const { db, sdk } = ready;
    const basePayload = this.buildStrictPayload(entry, sdk.serverTimestamp);
    if (!basePayload) return { ok: false, reason: 'invalid_score' };

    const authUser = (typeof window !== 'undefined' && window.cloudAuth && typeof window.cloudAuth.getCurrentUser === 'function')
      ? window.cloudAuth.getCurrentUser()
      : null;
    const authPayload = (authUser && authUser.uid)
      ? this.buildAuthenticatedPayload(entry, sdk.serverTimestamp, authUser)
      : null;

    const dedupKey = this._buildDedupKey(basePayload);
    if (this._submittedKeys.has(dedupKey)) {
      return { ok: true, id: this._submittedKeys.get(dedupKey), deduplicated: true };
    }
    if (this._inFlightSubmissions.has(dedupKey)) {
      return this._inFlightSubmissions.get(dedupKey);
    }

    const trySubmit = async () => {
      if (authPayload) {
        try {
          return await withTimeout(sdk.addDoc(sdk.collection(db, COLLECTION_NAME), authPayload));
        } catch (errAuth) {
          if (errAuth && errAuth.code === 'permission-denied') {
            return withTimeout(sdk.addDoc(sdk.collection(db, COLLECTION_NAME), basePayload));
          }
          throw errAuth;
        }
      }
      return withTimeout(sdk.addDoc(sdk.collection(db, COLLECTION_NAME), basePayload));
    };

    const requestPromise = (async () => {
      try {
        const docRef = await trySubmit();
        const id = docRef && docRef.id ? docRef.id : null;
        if (id) this._submittedKeys.set(dedupKey, id);
        return { ok: true, id, verified: Boolean(authPayload) };
      } catch (err) {
        this._lastError = err;
        return { ok: false, reason: (err && err.code) || 'error' };
      } finally {
        this._inFlightSubmissions.delete(dedupKey);
      }
    })();

    this._inFlightSubmissions.set(dedupKey, requestPromise);
    return requestPromise;
  }
}

window.onlineLeaderboard = new OnlineLeaderboard();
