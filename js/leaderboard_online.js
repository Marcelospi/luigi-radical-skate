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
const COLLECTION_NAME = 'leaderboard';
const REQUEST_TIMEOUT_MS = 6500;

function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo limite excedido ao conectar ao placar global')), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

class OnlineLeaderboard {
  constructor() {
    this._sdkPromise = null;
    this._sdk = null;
    this._db = null;
    this._lastError = null;
  }

  /** Indica se o ambiente suporta acesso online (navegador com fetch/ESM). */
  isAvailable() {
    if (typeof window === 'undefined') return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    return true;
  }

  /** Carrega os módulos ESM do Firebase sob demanda (1 única vez). */
  async ensureReady() {
    if (!this.isAvailable()) return null;
    if (this._db && this._sdk) return { db: this._db, sdk: this._sdk };

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
    const score = Math.floor(Number(entry && entry.score) || 0);
    if (score < 1 || score > 9999999) return null;

    const now = new Date();
    const defaultDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const rawSport = String((entry && entry.sportId) || 'skate').trim();
    const sportId = VALID_SPORTS.includes(rawSport) ? rawSport : 'skate';

    const name = String((entry && entry.name) || 'Skatista').trim().slice(0, 24) || 'Skatista';
    const characterId = String((entry && entry.characterId) || 'luigi_3d').trim().slice(0, 40) || 'luigi_3d';
    const characterName = String((entry && entry.characterName) || 'Luigi 3D').trim().slice(0, 30) || 'Luigi 3D';
    const sportIcon = String((entry && entry.sportIcon) || '🛹').trim().slice(0, 8) || '🛹';
    const date = String((entry && entry.date) || defaultDate).trim().slice(0, 20) || defaultDate;
    const time = String((entry && entry.time) || defaultTime).trim().slice(0, 12) || defaultTime;
    const distance = Math.max(0, Math.min(999999, Math.floor(Number(entry && entry.distance) || 0)));

    // Exatamente os 10 campos permitidos pelas regras do Firestore (sem base64/data:)
    return {
      name,
      score,
      distance,
      characterId,
      characterName,
      sportId,
      sportIcon,
      date: date.length >= 4 ? date : defaultDate,
      time: time.length >= 4 ? time : defaultTime,
      createdAt: serverTimestampFn()
    };
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
    snapshot.forEach((doc) => {
      const d = doc.data() || {};
      results.push({
        id: doc.id,
        name: d.name || 'Skatista',
        score: Math.max(0, Math.floor(Number(d.score) || 0)),
        distance: Math.max(0, Math.floor(Number(d.distance) || 0)),
        characterId: d.characterId || 'luigi_3d',
        characterName: d.characterName || 'Luigi 3D',
        characterPortrait: 'assets/portraits/portrait_luigi_3d.png',
        sportId: VALID_SPORTS.includes(d.sportId) ? d.sportId : 'skate',
        sportIcon: d.sportIcon || '🛹',
        date: d.date || '',
        time: d.time || '',
        isOnline: true
      });
    });

    return results;
  }

  /** Envia uma pontuação para o Placar Universal Global (imutável, 10 campos exatos). */
  async submitScore(entry) {
    const ready = await this.ensureReady();
    if (!ready) return { ok: false, reason: 'offline' };

    const { db, sdk } = ready;
    const payload = this.buildStrictPayload(entry, sdk.serverTimestamp);
    if (!payload) return { ok: false, reason: 'invalid_score' };

    try {
      const docRef = await withTimeout(
        sdk.addDoc(sdk.collection(db, COLLECTION_NAME), payload)
      );
      return { ok: true, id: docRef.id };
    } catch (err) {
      this._lastError = err;
      return { ok: false, reason: (err && err.code) || 'error' };
    }
  }
}

window.onlineLeaderboard = new OnlineLeaderboard();
