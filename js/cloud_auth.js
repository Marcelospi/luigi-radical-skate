// ============================================================
// Autenticação Firebase (Google + E-mail/Senha) & Sincronização de Perfis
// Projeto Firebase: luigi-radical-skate
// Suporte completo offline + fallback seguro sem travar o carregamento.
// ============================================================

(function () {
  const AUTH_FIREBASE_CONFIG = {
    projectId: 'luigi-radical-skate',
    appId: '1:549407420023:web:7ad4383a5ea90bb6492072',
    storageBucket: 'luigi-radical-skate.firebasestorage.app',
    apiKey: 'AIzaSyDZ7wdLYnHexa4NmQ3SNK1oKE4-Gf4X3gw',
    authDomain: 'luigi-radical-skate.firebaseapp.com',
    messagingSenderId: '549407420023'
  };

  const AUTH_INIT_TIMEOUT_MS = 2500;
  const AUTH_OP_TIMEOUT_MS = 12000;

  function withTimeout(promise, ms = AUTH_OP_TIMEOUT_MS, label = 'Tempo esgotado na conexão com a nuvem') {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const err = new Error(label);
        err.code = 'auth/timeout';
        reject(err);
      }, ms);
      Promise.resolve(promise).then(
        (val) => { clearTimeout(timer); resolve(val); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }

  function cleanStr(val, fallback = '', maxLen = 48) {
    let s = String(val == null ? '' : val)
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!s) return fallback;
    let out = '';
    for (const ch of Array.from(s)) {
      if (out.length + ch.length > maxLen) break;
      out += ch;
    }
    return out.trim() || fallback;
  }

  function toInt(val, fallback = 0, min = 0) {
    const n = Number(val);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.floor(n));
  }

  function translateFirebaseError(err) {
    const code = (err && err.code) || '';
    const map = {
      'auth/popup-closed-by-user': 'A janela de login foi fechada antes de concluir.',
      'auth/cancelled-popup-request': 'Login cancelado. Tente novamente em instantes.',
      'auth/popup-blocked': 'O navegador bloqueou a janela do Google. Liberando redirecionamento…',
      'auth/unauthorized-domain': 'Este domínio ainda precisa ser autorizado no Console do Firebase (Authentication > Configurações > Domínios autorizados).',
      'auth/operation-not-allowed': 'Este tipo de login ainda precisa ser ativado no Console do Firebase (Authentication > Sign-in method).',
      'auth/invalid-email': 'Digite um endereço de e-mail válido.',
      'auth/missing-email': 'Informe seu endereço de e-mail primeiro.',
      'auth/user-not-found': 'E-mail não encontrado. Verifique ou toque em "Criar Conta".',
      'auth/wrong-password': 'Senha incorreta. Tente novamente ou use "Esqueci minha senha".',
      'auth/invalid-credential': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
      'auth/email-already-in-use': 'Este e-mail já está cadastrado! Mude para a aba "Entrar".',
      'auth/weak-password': 'Use uma senha mais forte com pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde alguns instantes antes de tentar novamente.',
      'auth/network-request-failed': 'Sem internet no momento. Você pode entrar como Visitante e sincronizar depois!',
      'auth/timeout': 'A conexão demorou para responder. Verifique sua internet ou jogue como Visitante.'
    };
    return map[code] || (err && err.message ? String(err.message) : 'Não foi possível concluir a operação agora.');
  }

  class CloudAuthManager {
    constructor() {
      this._readyPromise = null;
      this._sdk = null;
      this._auth = null;
      this._db = null;
      this._user = null;
      this._lastSyncAt = 0;
      this._syncPromise = null;
      this._pushTimer = null;
      this._pendingProfileIds = new Set();
      this._onAuthChangeCbs = new Set();
      this._onSyncStatusCbs = new Set();
      this._hooksBound = false;
      this._lifecycleBound = false;
    }

    isOnlineSupported() {
      if (typeof window === 'undefined') return false;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
      return true;
    }

    isLoggedIn() {
      return Boolean(this._user && this._user.uid);
    }

    getCurrentUser() {
      return this._user || null;
    }

    getUid() {
      return (this._user && this._user.uid) || '';
    }

    getDisplayLabel() {
      if (!this._user) return 'Visitante';
      const name = cleanStr(this._user.displayName, '', 24);
      if (name) return name;
      const email = cleanStr(this._user.email, '', 60);
      if (email && email.includes('@')) return cleanStr(email.split('@')[0], 'Conta', 24);
      return 'Conta Conectada';
    }

    getLastSyncText() {
      if (!this.isLoggedIn()) return 'Modo local (sem nuvem)';
      if (!this._lastSyncAt) return '☁️ Conectado · pronto para sincronizar';
      const d = new Date(this._lastSyncAt);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `☁️ Sincronizado às ${hh}:${mm} ✓`;
    }

    onAuthChange(cb) {
      if (typeof cb === 'function') this._onAuthChangeCbs.add(cb);
    }

    onSyncStatus(cb) {
      if (typeof cb === 'function') this._onSyncStatusCbs.add(cb);
    }

    _emitAuthChange() {
      for (const cb of this._onAuthChangeCbs) {
        try { cb(this._user); } catch (_) {}
      }
    }

    _emitSyncStatus(status, message = '') {
      for (const cb of this._onSyncStatusCbs) {
        try { cb(status, message); } catch (_) {}
      }
    }

    _bindHooks() {
      if (!this._hooksBound) {
        this._hooksBound = true;
        if (window.progressionManager) {
          const prevOnChange = window.progressionManager.onChange;
          window.progressionManager.onChange = (reason, profileId) => {
            if (typeof prevOnChange === 'function') prevOnChange(reason, profileId);
            if (this.isLoggedIn()) {
              const immediate = reason === 'score' || reason === 'buy' || reason === 'profile_create';
              this.schedulePushProfile(profileId, immediate ? 250 : 900);
            }
          };
        }
        if (window.characterManager) {
          const prevCharChange = window.characterManager.onCharacterChange;
          window.characterManager.onCharacterChange = (action, charOrNull) => {
            if (typeof prevCharChange === 'function') prevCharChange(action, charOrNull);
            if (!this.isLoggedIn()) return;
            if (action === 'delete' && charOrNull && charOrNull.isCustom && charOrNull.id) {
              this.deleteCloudProfile(charOrNull.id).catch(() => {});
              this.schedulePushAccountMeta(250);
            } else if (action === 'restore') {
              this.syncAllNow().catch(() => {});
            } else if (charOrNull && charOrNull.id) {
              this.schedulePushProfile(charOrNull.id, 300);
            }
          };
        }
      }

      if (!this._lifecycleBound && typeof window !== 'undefined') {
        this._lifecycleBound = true;
        const flush = () => { this.flushPendingSync().catch(() => {}); };
        window.addEventListener('pagehide', flush);
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.hidden) flush();
          });
        }
      }
    }

    async ensureReady() {
      this._bindHooks();
      if (!this.isOnlineSupported()) return null;
      if (this._auth && this._db && this._sdk) {
        return { auth: this._auth, db: this._db, sdk: this._sdk };
      }

      if (!this._readyPromise) {
        this._readyPromise = (async () => {
          const [appMod, authMod, fsMod] = await withTimeout(Promise.all([
            import('https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js'),
            import('https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js'),
            import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js')
          ]), AUTH_OP_TIMEOUT_MS);

          const existing = appMod.getApps && appMod.getApps();
          const app = (existing && existing.length > 0)
            ? existing[0]
            : appMod.initializeApp(AUTH_FIREBASE_CONFIG);

          const auth = authMod.getAuth(app);
          const db = fsMod.getFirestore(app);
          this._auth = auth;
          this._db = db;
          this._sdk = { appMod, authMod, fsMod };

          await new Promise((resolve) => {
            let resolved = false;
            const timer = setTimeout(() => {
              if (!resolved) { resolved = true; resolve(); }
            }, AUTH_INIT_TIMEOUT_MS);

            authMod.onAuthStateChanged(auth, (user) => {
              const prevUid = this._user ? this._user.uid : '';
              this._user = user || null;
              if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve();
              } else if ((this._user ? this._user.uid : '') !== prevUid) {
                this._emitAuthChange();
              }
            });
          });

          // Processa eventual retorno de signInWithRedirect (celulares com bloqueio de popup)
          authMod.getRedirectResult(auth).catch(() => {});

          return { auth: this._auth, db: this._db, sdk: this._sdk };
        })().catch((err) => {
          this._readyPromise = null;
          this._lastError = err;
          return null;
        });
      }

      return this._readyPromise;
    }

    async init() {
      this._bindHooks();
      const ready = await this.ensureReady();
      if (ready && this._user) {
        await this.syncAllNow().catch(() => {});
      }
      return this._user;
    }

    async signInWithGoogle() {
      const ready = await this.ensureReady();
      if (!ready) {
        return { ok: false, error: 'Sem conexão com a internet para entrar com o Google agora.' };
      }
      const { auth, sdk } = ready;
      const provider = new sdk.authMod.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      try {
        const res = await withTimeout(sdk.authMod.signInWithPopup(auth, provider), 45000);
        this._user = res && res.user ? res.user : auth.currentUser;
        await this.syncAllNow();
        this._emitAuthChange();
        return { ok: true, user: this._user };
      } catch (err) {
        if (err && err.code === 'auth/popup-blocked') {
          try {
            await sdk.authMod.signInWithRedirect(auth, provider);
            return { ok: true, redirecting: true };
          } catch (err2) {
            return { ok: false, code: err2.code, error: translateFirebaseError(err2) };
          }
        }
        return { ok: false, code: err && err.code, error: translateFirebaseError(err) };
      }
    }

    async registerWithEmail(name, email, password) {
      const ready = await this.ensureReady();
      if (!ready) {
        return { ok: false, error: 'Sem conexão com a internet para criar conta agora.' };
      }
      const cleanEmail = String(email || '').trim();
      const cleanName = cleanStr(name, 'Família Radical', 24);
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { ok: false, error: 'Digite um endereço de e-mail válido.' };
      }
      if (!password || String(password).length < 6) {
        return { ok: false, error: 'A senha precisa ter pelo menos 6 caracteres.' };
      }

      const { auth, sdk } = ready;
      try {
        const cred = await withTimeout(sdk.authMod.createUserWithEmailAndPassword(auth, cleanEmail, String(password)));
        if (cred && cred.user) {
          await sdk.authMod.updateProfile(cred.user, { displayName: cleanName }).catch(() => {});
          this._user = cred.user;
        }
        await this.syncAllNow();
        this._emitAuthChange();
        return { ok: true, user: this._user };
      } catch (err) {
        return { ok: false, code: err && err.code, error: translateFirebaseError(err) };
      }
    }

    async signInWithEmail(email, password) {
      const ready = await this.ensureReady();
      if (!ready) {
        return { ok: false, error: 'Sem conexão com a internet para entrar agora.' };
      }
      const cleanEmail = String(email || '').trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { ok: false, error: 'Digite seu e-mail corretamente.' };
      }
      if (!password) {
        return { ok: false, error: 'Digite sua senha.' };
      }

      const { auth, sdk } = ready;
      try {
        const cred = await withTimeout(sdk.authMod.signInWithEmailAndPassword(auth, cleanEmail, String(password)));
        this._user = cred && cred.user ? cred.user : auth.currentUser;
        await this.syncAllNow();
        this._emitAuthChange();
        return { ok: true, user: this._user };
      } catch (err) {
        return { ok: false, code: err && err.code, error: translateFirebaseError(err) };
      }
    }

    async sendPasswordReset(email) {
      const ready = await this.ensureReady();
      if (!ready) {
        return { ok: false, error: 'Sem conexão com a internet no momento.' };
      }
      const cleanEmail = String(email || '').trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { ok: false, error: 'Digite o seu e-mail acima para receber o link de redefinição.' };
      }
      const { auth, sdk } = ready;
      try {
        await withTimeout(sdk.authMod.sendPasswordResetEmail(auth, cleanEmail));
        return { ok: true, message: 'Enviamos um e-mail para você criar uma nova senha! Confira também a pasta de spam.' };
      } catch (err) {
        return { ok: false, error: translateFirebaseError(err) };
      }
    }

    async signOutUser() {
      await this.flushPendingSync().catch(() => {});
      this._pendingProfileIds.clear();
      if (this._pushTimer) {
        clearTimeout(this._pushTimer);
        this._pushTimer = null;
      }
      const ready = await this.ensureReady();
      if (ready && ready.sdk && ready.auth) {
        try {
          await ready.sdk.authMod.signOut(ready.auth);
        } catch (_) {}
      }
      this._user = null;
      this._lastSyncAt = 0;
      try { sessionStorage.removeItem('luigi_visitor_session'); } catch (_) {}
      this._emitAuthChange();
      return { ok: true };
    }

    _buildCloudAccountDoc(fsMod) {
      const pm = window.progressionManager;
      const cm = window.characterManager;
      const hiddenBuiltins = cm && typeof cm.getHiddenBuiltins === 'function'
        ? cm.getHiddenBuiltins().slice(0, 10)
        : [];
      const unlockedCharacters = pm && Array.isArray(pm.unlockedCharacters)
        ? pm.unlockedCharacters.slice(0, 30)
        : ['luigi_3d', 'luigi_real', 'luna_radical'];
      const activeProfileId = cleanStr((pm && pm.activeProfileId) || (cm && cm.selectedId) || 'luigi_3d', 'luigi_3d', 48);

      return {
        displayName: cleanStr(this.getDisplayLabel(), 'Família Radical', 40),
        email: cleanStr(this._user && this._user.email, '', 120),
        unlockedCharacters,
        hiddenBuiltins,
        activeProfileId,
        updatedAt: fsMod.serverTimestamp()
      };
    }

    _buildCloudProfileDoc(charId, fsMod) {
      const pm = window.progressionManager;
      const cm = window.characterManager;
      if (!pm) return null;
      const exported = pm.exportProfileForCloud(charId);
      const charBundle = (cm && typeof cm.exportCharacterMetaForCloud === 'function')
        ? cm.exportCharacterMetaForCloud(charId)
        : null;

      const s = exported.stats || {};
      const cleanStats = {
        totalRuns: toInt(s.totalRuns),
        totalCoins: toInt(s.totalCoins),
        totalTricks: toInt(s.totalTricks),
        totalGrinds: toInt(s.totalGrinds),
        totalSmashes: toInt(s.totalSmashes),
        totalNearMiss: toInt(s.totalNearMiss),
        totalWords: toInt(s.totalWords),
        totalLoops: toInt(s.totalLoops),
        bestCombo: toInt(s.bestCombo, 1, 1),
        bestDistance: toInt(s.bestDistance)
      };

      const cleanUpgrades = {};
      for (const k of ['magnet', 'turbo', 'fever', 'coinBonus']) {
        cleanUpgrades[k] = toInt(exported.upgrades && exported.upgrades[k], 0, 0);
      }

      const cleanAch = {};
      for (const [k, v] of Object.entries(exported.achievements || {})) {
        if (v) cleanAch[cleanStr(k, k, 40)] = toInt(v, Date.now(), 1);
      }

      const cleanMissions = (exported.activeMissions || []).slice(0, 3).map(m => ({
        id: cleanStr(m.id, 'm', 40),
        type: cleanStr(m.type, 'trick', 24),
        label: cleanStr(m.label, 'Missão', 120),
        target: toInt(m.target, 1, 1),
        progress: toInt(m.progress, 0, 0),
        reward: toInt(m.reward, 30, 1),
        done: Boolean(m.done)
      }));

      const meta = (charBundle && charBundle.charMeta) || {
        id: cleanStr(charId, 'luigi_3d', 48),
        name: cleanStr(charId, 'Skatista', 30),
        badge: 'Skatista',
        description: '',
        bodyStyle: 'custom',
        fullPhoto: false,
        useHelmet: true,
        hasPhoto: false,
        gender: 'boy',
        skinTone: 'fair',
        outfit: 'street_blue',
        hairColor: 'brown',
        accessory: (exported.equipped && exported.equipped.accessory) || 'none',
        headSize: 'large',
        headThumb: '',
        stats: { visual: 'Avatar 2D', favorito: '🌟 Todos', estilo: 'Radical' }
      };

      return {
        profileId: cleanStr(charId, 'luigi_3d', 48),
        coinsBank: toInt(exported.coinsBank, 50, 0),
        rankLevel: toInt(exported.rankLevel, 1, 1),
        missionsCompletedTotal: toInt(exported.missionsCompletedTotal, 0, 0),
        unlockedStageIndex: Math.min(5, toInt(exported.unlockedStageIndex, 0, 0)),
        highScore: toInt(exported.highScore, 0, 0),
        highScoreTime60: toInt(exported.highScoreTime60, 0, 0),
        preferredSport: cleanStr(exported.preferredSport, 'skate', 16),
        owned: {
          gear: (exported.owned && exported.owned.gear ? exported.owned.gear : ['classic']).slice(0, 30),
          trails: (exported.owned && exported.owned.trails ? exported.owned.trails : ['classic']).slice(0, 30),
          accessories: (exported.owned && exported.owned.accessories ? exported.owned.accessories : ['none', 'shades']).slice(0, 30),
          characters: (exported.owned && exported.owned.characters ? exported.owned.characters : ['luigi_3d']).slice(0, 30)
        },
        equipped: {
          gear: cleanStr(exported.equipped && exported.equipped.gear, 'classic', 32),
          trail: cleanStr(exported.equipped && exported.equipped.trail, 'classic', 32),
          accessory: cleanStr(exported.equipped && exported.equipped.accessory, 'none', 32),
          disabledUpgrades: Array.isArray(exported.equipped && exported.equipped.disabledUpgrades)
            ? exported.equipped.disabledUpgrades.slice(0, 8)
            : []
        },
        upgrades: cleanUpgrades,
        activeMissions: cleanMissions,
        achievements: cleanAch,
        stats: cleanStats,
        clientUpdatedAt: toInt(exported.clientUpdatedAt, Date.now(), 1),
        isCustom: Boolean(charBundle && charBundle.isCustom),
        isBuiltinOverride: Boolean(charBundle && charBundle.isBuiltinOverride),
        charMeta: meta,
        updatedAt: fsMod.serverTimestamp()
      };
    }

    async syncAllNow() {
      if (this._syncPromise) return this._syncPromise;
      const ready = await this.ensureReady();
      if (!ready || !this._user || !this._user.uid) {
        return { ok: false, reason: 'not_logged_in' };
      }

      const { db, sdk } = ready;
      const fsMod = sdk.fsMod;
      const uid = this._user.uid;
      this._emitSyncStatus('syncing', 'Sincronizando perfis na nuvem…');

      this._syncPromise = (async () => {
        try {
          const userRef = fsMod.doc(db, 'users', uid);
          const userSnap = await withTimeout(fsMod.getDoc(userRef));
          const cloudAccount = userSnap.exists() ? userSnap.data() : null;

          const profilesQ = fsMod.query(
            fsMod.collection(db, 'users', uid, 'profiles'),
            fsMod.limit(30)
          );
          const profilesSnap = await withTimeout(fsMod.getDocs(profilesQ));
          const cloudProfilesMap = {};
          profilesSnap.forEach((docSnap) => {
            cloudProfilesMap[docSnap.id] = docSnap.data();
          });

          const pm = window.progressionManager;
          const cm = window.characterManager;

          if (cm && typeof cm.applyCloudCharacters === 'function') {
            await cm.applyCloudCharacters(cloudAccount, cloudProfilesMap);
          }
          if (pm && typeof pm.importOrMergeCloudData === 'function') {
            pm.importOrMergeCloudData(cloudAccount, cloudProfilesMap, uid);
            if (cm && cm.selectedId) {
              if (cm.characters.some(c => c.id === pm.activeProfileId && cm.isCharacterUnlocked(c.id))) {
                cm.select(pm.activeProfileId);
              } else {
                pm.setActiveProfile(cm.selectedId, cm.getSelected());
              }
            }
          }

          // Envia de volta conta e todos os perfis presentes localmente (customs + originais)
          const accountPayload = this._buildCloudAccountDoc(fsMod);
          await withTimeout(fsMod.setDoc(userRef, accountPayload, { merge: true }));

          const allIds = new Set([
            ...(pm ? Object.keys(pm.profiles || {}) : []),
            ...(cm ? cm.characters.filter(c => cm.isCharacterUnlocked(c.id)).map(c => c.id) : [])
          ]);

          const uploads = [];
          for (const pid of allIds) {
            if (!pid) continue;
            const pDoc = this._buildCloudProfileDoc(pid, fsMod);
            if (pDoc) {
              const pRef = fsMod.doc(db, 'users', uid, 'profiles', pid);
              uploads.push(fsMod.setDoc(pRef, pDoc, { merge: true }));
            }
          }
          if (uploads.length > 0) {
            await withTimeout(Promise.allSettled(uploads));
          }

          this._lastSyncAt = Date.now();
          this._emitSyncStatus('ok', this.getLastSyncText());
          return { ok: true, count: allIds.size };
        } catch (err) {
          this._emitSyncStatus('error', 'Não foi possível sincronizar agora.');
          return { ok: false, error: translateFirebaseError(err) };
        } finally {
          this._syncPromise = null;
        }
      })();

      return this._syncPromise;
    }

    schedulePushAccountMeta(delayMs = 450) {
      if (!this.isLoggedIn()) return;
      this.schedulePushProfile(null, delayMs);
    }

    schedulePushProfile(profileId, delayMs = 700) {
      if (!this.isLoggedIn()) return;
      if (profileId) this._pendingProfileIds.add(profileId);
      if (this._pushTimer) clearTimeout(this._pushTimer);
      this._pushTimer = setTimeout(() => {
        this._pushTimer = null;
        this.flushPendingSync().catch(() => {});
      }, delayMs);
    }

    async flushPendingSync() {
      if (this._pushTimer) {
        clearTimeout(this._pushTimer);
        this._pushTimer = null;
      }
      if (!this.isLoggedIn() || !this.isOnlineSupported()) return false;
      const ready = await this.ensureReady();
      if (!ready || !this._user) return false;

      const { db, sdk } = ready;
      const fsMod = sdk.fsMod;
      const uid = this._user.uid;
      const idsToPush = Array.from(this._pendingProfileIds);
      this._pendingProfileIds.clear();

      try {
        const accountPayload = this._buildCloudAccountDoc(fsMod);
        const ops = [
          fsMod.setDoc(fsMod.doc(db, 'users', uid), accountPayload, { merge: true })
        ];
        for (const pid of idsToPush) {
          const pDoc = this._buildCloudProfileDoc(pid, fsMod);
          if (pDoc) {
            ops.push(fsMod.setDoc(fsMod.doc(db, 'users', uid, 'profiles', pid), pDoc, { merge: true }));
          }
        }
        await withTimeout(Promise.all(ops));
        this._lastSyncAt = Date.now();
        this._emitSyncStatus('ok', this.getLastSyncText());
        return true;
      } catch (_) {
        this._emitSyncStatus('error', 'Pendente de sincronização');
        return false;
      }
    }

    async deleteCloudProfile(profileId) {
      if (!this.isLoggedIn() || !profileId) return false;
      const ready = await this.ensureReady();
      if (!ready || !this._user) return false;
      const { db, sdk } = ready;
      try {
        await withTimeout(sdk.fsMod.deleteDoc(sdk.fsMod.doc(db, 'users', this._user.uid, 'profiles', profileId)));
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  window.CloudAuthManager = CloudAuthManager;
  window.cloudAuth = new CloudAuthManager();
})();
