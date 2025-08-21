// client/src/managers/ColyseusManager.js - VERSION FINALE SANS BOUCLE
import { WorldState } from "../schemas/WorldState.js";
import { Client } from 'colyseus.js';

class ColyseusManager {
  constructor() {
    this.client = null;
    this.worldRoom = null;
    this.isConnected = false;
    this.isConnecting = false;
    
    // Configuration
    this.serverUrl = window.GameConfig?.COLYSEUS_URL || 'wss://chimarena.cloud/ws';
    
    // Données simples
    this.playerProfile = null;
    this.worldPlayers = new Map();
    this.globalStats = { totalPlayers: 0, playersOnline: 0, playersSearching: 0 };
    
    // Callbacks
    this.callbacks = new Map();
    
    // ✅ PROTECTION CONTRE LES BOUCLES
    this.authCheckInProgress = false;
    this.lastConnectionAttempt = 0;
    this.connectionCooldown = 5000; // 5 secondes entre tentatives
    
    console.log('🌐 ColyseusManager initialisé (version sans boucle)');
  }

  // ✅ MÉTHODE CONNEXION SANS BOUCLE INFINIE
  async connect() {
    console.log('🌐 === CONNEXION COLYSEUS (SANS BOUCLE) ===');
    
    // ✅ PROTECTION COOLDOWN
    const now = Date.now();
    if (now - this.lastConnectionAttempt < this.connectionCooldown) {
      console.log('⏳ Cooldown actif, connexion ignorée');
      return this.isConnected;
    }
    this.lastConnectionAttempt = now;
    
    if (this.isConnecting || this.isConnected) {
      console.log('⚠️ Déjà connecté ou en cours');
      return this.isConnected;
    }
    
    // ✅ PROTECTION CONTRE AUTH CHECK MULTIPLE
    if (this.authCheckInProgress) {
      console.log('🔄 Vérification auth déjà en cours');
      return false;
    }
    
    try {
      this.isConnecting = true;
      this.authCheckInProgress = true;
      
      // 🔐 VÉRIFICATION AUTH AVEC IMPORT DYNAMIQUE
      console.log('🔐 Vérification authentification unique...');
      
      // ✅ ESSAYER D'IMPORTER auth DYNAMIQUEMENT
      let auth = window.auth;
      if (!auth) {
        try {
          console.log('📥 Import dynamique du module auth...');
          const authModule = await import('../api.js');
          auth = authModule.auth;
          
          // Exposer globalement pour les prochaines fois
          window.auth = auth;
          console.log('✅ Module auth importé et exposé');
        } catch (importError) {
          console.error('❌ Impossible d\'importer auth:', importError);
          throw new Error('Module auth non disponible après import');
        }
      }
      
      if (!auth) {
        throw new Error('Module auth toujours non disponible');
      }
      
      // ✅ APPEL UNIQUE À isAuthenticated
      const isAuth = auth.isAuthenticated();
      console.log('🔐 Auth check résultat:', isAuth);
      
      if (!isAuth) {
        // ✅ UNE SEULE TENTATIVE DE RÉCUPÉRATION TOKEN
        console.log('🔑 Récupération token directe...');
        const tokenInfo = auth.getTokenInfo();
        
        if (!tokenInfo?.token) {
          throw new Error('Non authentifié - aucun token disponible');
        }
        
        console.log('⚠️ Token présent mais auth=false, tentative de connexion');
      }
      
      // 🧹 NETTOYER AVANT RECONNEXION
      if (this.worldRoom) {
        console.log('🧹 Nettoyage connexion existante');
        await this.forceDisconnect();
      }
      
      // 🔧 CRÉER CLIENT SIMPLE
      console.log('🔧 Création client Colyseus...');
      
      this.client = new Client(this.serverUrl);
      
      // 🔑 RÉCUPÉRER TOKEN FINAL
      const tokenInfo = auth.getTokenInfo();
      if (!tokenInfo?.token) {
        throw new Error('Token manquant au moment de la connexion');
      }
      
      console.log('🔑 Token utilisé pour:', tokenInfo.username);
      
      const joinOptions = { 
        token: tokenInfo.token,
        username: tokenInfo.username || 'Player'
      };
      
      console.log('🔌 Connexion WorldRoom...');
      
      // 🌐 CONNEXION AVEC TIMEOUT
      const connectionPromise = this.client.joinOrCreate('world', joinOptions);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout connexion Colyseus (10s)')), 10000);
      });
      
      this.worldRoom = await Promise.race([connectionPromise, timeoutPromise]);
      
      console.log('✅ CONNECTÉ WorldRoom:', {
        sessionId: this.worldRoom.sessionId,
        roomId: this.worldRoom.id
      });
      
      // ✅ SETUP HANDLERS
      this.setupHandlers();
      
      this.isConnected = true;
      this.isConnecting = false;
      this.authCheckInProgress = false;
      
      // Démarrer heartbeat
      this.startHeartbeat();
      
      this.triggerCallback('connected');
      
      console.log('✅ === CONNEXION COLYSEUS RÉUSSIE ===');
      return true;
      
    } catch (error) {
      console.error('❌ === CONNEXION COLYSEUS ÉCHOUÉE ===');
      console.error('Erreur:', error.message);
      
      this.isConnecting = false;
      this.isConnected = false;
      this.authCheckInProgress = false;
      
      await this.forceDisconnect();
      
      this.triggerCallback('error', `Connexion échouée: ${error.message}`);
      return false;
    }
  }

  // ✅ HANDLERS SIMPLIFIÉS
  setupHandlers() {
    if (!this.worldRoom) return;
    
    console.log('🔧 Setup handlers Colyseus...');
    
    // ✅ MESSAGES SERVEUR
    this.worldRoom.onMessage("player_profile", (data) => {
      console.log('📨 PROFIL REÇU:', data.profile?.username);
      this.playerProfile = data.profile;
      this.triggerCallback('profileUpdated', this.playerProfile);
    });
    
    this.worldRoom.onMessage("arena_info", (data) => {
      console.log('📨 ARENA INFO');
      this.triggerCallback('arenaInfo', data);
    });
    
    this.worldRoom.onMessage("search_started", (data) => {
      console.log('📨 RECHERCHE COMMENCÉE');
      this.triggerCallback('searchStarted', data);
    });
    
    this.worldRoom.onMessage("match_found", (data) => {
      console.log('📨 MATCH TROUVÉ:', data.opponent?.username);
      this.triggerCallback('matchFound', data);
    });
    
    this.worldRoom.onMessage("battle_result", (data) => {
      console.log('📨 RÉSULTAT:', data.victory ? 'VICTOIRE' : 'DÉFAITE');
      this.triggerCallback('battleResult', data);
    });
    
    this.worldRoom.onMessage("leaderboard", (data) => {
      console.log('📨 LEADERBOARD:', data.players?.length, 'joueurs');
      this.triggerCallback('leaderboard', data);
    });
    
    this.worldRoom.onMessage("search_cancelled", (data) => {
      console.log('📨 RECHERCHE ANNULÉE');
      this.triggerCallback('searchCancelled', data);
    });
   this.worldRoom.onMessage("search_error", (data) => {
      console.log('📨 ERREUR RECHERCHE:', data.message);
      this.triggerCallback('searchError', data);
    });
    this.worldRoom.onMessage("error", (data) => {
      console.error('📨 ERREUR SERVEUR:', data.message);
      this.triggerCallback('error', data.message);
    });
    
    this.worldRoom.onMessage("heartbeat_ack", (data) => {
      // Heartbeat silencieux - pas de log
    });
    
    // ✅ ÉTAT INITIAL
    this.worldRoom.onStateChange.once((state) => {
      console.log('📊 Premier état reçu:', {
        totalPlayers: state.totalPlayers,
        playersOnline: state.playersOnline,
        playersSearching: state.playersSearching
      });
      this.updateGlobalStats(state);
      this.updatePlayersSimple(state);
    });

    // ✅ CHANGEMENTS D'ÉTAT
    this.worldRoom.onStateChange((state) => {
      this.updateGlobalStats(state);
      this.updatePlayersSimple(state);
    });
    
    // ✅ ÉVÉNEMENTS CONNEXION
    this.worldRoom.onLeave((code) => {
      console.log(`🔌 DÉCONNECTÉ (code: ${code})`);
      this.isConnected = false;
      this.worldRoom = null;
      this.stopHeartbeat();
      this.triggerCallback('disconnected', code);
    });
    
    this.worldRoom.onError((code, message) => {
      console.error(`🔧 ERREUR ROOM: ${code} - ${message}`);
      this.triggerCallback('error', `Erreur room: ${message}`);
    });
    
    console.log('✅ Handlers configurés');
  }

  // ✅ MISE À JOUR STATS GLOBALES
  updateGlobalStats(state) {
    if (!state) return;
    
    const newStats = {
      totalPlayers: state.totalPlayers || 0,
      playersOnline: state.playersOnline || 0,
      playersSearching: state.playersSearching || 0
    };
    
    // ✅ ÉVITER LES UPDATES INUTILES
    if (JSON.stringify(newStats) !== JSON.stringify(this.globalStats)) {
      this.globalStats = newStats;
      this.triggerCallback('globalStatsUpdated', this.globalStats);
    }
  }

  // ✅ MISE À JOUR JOUEURS
  updatePlayersSimple(state) {
    if (!state?.players) return;
    
    try {
      const oldSize = this.worldPlayers.size;
      this.worldPlayers.clear();
      
      if (state.players.forEach) {
        state.players.forEach((player, sessionId) => {
          this.worldPlayers.set(sessionId, {
            sessionId,
            username: player.username || 'Unknown',
            level: player.level || 1,
            trophies: player.trophies || 0,
            status: player.status || 'idle',
            wins: player.wins || 0,
            losses: player.losses || 0,
            winRate: player.winRate || 0
          });
        });
      }
      
      // ✅ LOG SEULEMENT SI CHANGEMENT SIGNIFICATIF
      if (Math.abs(this.worldPlayers.size - oldSize) > 0) {
        const diff = this.worldPlayers.size - oldSize;
        const sign = diff >= 0 ? '+' : '';
        console.log(`👥 ${this.worldPlayers.size} joueurs (${sign}${diff})`);
      }
      
      this.triggerCallback('playersUpdated', this.worldPlayers);
      
    } catch (error) {
      console.error('❌ Erreur updatePlayers:', error);
    }
  }

  // ✅ DÉCONNEXION PROPRE
  async forceDisconnect() {
    console.log('🔌 Déconnexion forcée');
    
    // ✅ RÉINITIALISER LES FLAGS
    this.authCheckInProgress = false;
    this.stopHeartbeat();
    
    if (this.worldRoom) {
      try {
        await this.worldRoom.leave();
      } catch (error) {
        console.warn('⚠️ Erreur leave:', error.message);
      }
      this.worldRoom = null;
    }
    
    if (this.client) {
      this.client = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    
    // Nettoyer données
    this.playerProfile = null;
    this.worldPlayers.clear();
  }

  async disconnect() {
    await this.forceDisconnect();
    this.triggerCallback('disconnected');
  }

  // ✅ MÉTHODES DE JEU
  searchBattle() {
    if (!this.isConnected || !this.worldRoom) {
      console.warn('⚠️ Pas connecté pour recherche');
      return false;
    }
    
    console.log('⚔️ Recherche bataille...');
    this.worldRoom.send("search_battle");
    return true;
  }

  cancelSearch() {
    if (!this.isConnected || !this.worldRoom) return false;
    
    console.log('❌ Annulation recherche...');
    this.worldRoom.send("cancel_search");
    return true;
  }

  getLeaderboard(limit = 50) {
    if (!this.isConnected || !this.worldRoom) return false;
    
    console.log('🏆 Demande leaderboard...');
    this.worldRoom.send("get_leaderboard", { limit });
    return true;
  }

  requestArenaInfo() {
    if (!this.isConnected || !this.worldRoom) return false;
    
    console.log('🏟️ Demande arena info...');
    this.worldRoom.send("get_arena_info");
    return true;
  }

  updateStatus(status) {
    if (!this.isConnected || !this.worldRoom) return false;
    
    this.worldRoom.send("update_status", { status });
    return true;
  }

  // ✅ SYSTÈME DE CALLBACKS
  on(event, callback) {
    this.callbacks.set(event, callback);
  }

  off(event) {
    this.callbacks.delete(event);
  }

  triggerCallback(event, data = null) {
    const callback = this.callbacks.get(event);
    if (callback && typeof callback === 'function') {
      try {
        callback(data);
      } catch (error) {
        console.error(`❌ Erreur callback ${event}:`, error);
      }
    }
  }

  // ✅ DEBUG SANS APPELS AUTH RÉPÉTÉS
  getDebugInfo() {
    // ✅ VÉRIFICATION SAFE DE window.auth
    let authState = { error: 'auth module unavailable' };
    
    try {
      if (window.auth) {
        authState = {
          isAuthenticated: window.auth.isAuthenticated(),
          hasTokenInfo: !!window.auth.getTokenInfo(),
          tokenInfo: window.auth.getTokenInfo()
        };
      }
    } catch (error) {
      authState = { error: `auth check failed: ${error.message}` };
    }

    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      authCheckInProgress: this.authCheckInProgress,
      hasRoom: !!this.worldRoom,
      hasClient: !!this.client,
      sessionId: this.worldRoom?.sessionId,
      roomId: this.worldRoom?.id,
      playersCount: this.worldPlayers.size,
      hasProfile: !!this.playerProfile,
      serverUrl: this.serverUrl,
      globalStats: this.globalStats,
      heartbeatActive: !!this.heartbeatInterval,
      lastConnectionAttempt: this.lastConnectionAttempt,
      auth: authState,
      timestamp: Date.now()
    };
  }

  isColyseusConnected() {
    return this.isConnected && !!this.worldRoom;
  }

  printConnectionHistory() {
    console.log('📊 État Colyseus:', this.getDebugInfo());
  }

  emergencyStop() {
    console.log('🛑 ARRÊT D\'URGENCE');
    this.forceDisconnect();
  }

  fullReset() {
    console.log('🔄 RESET COMPLET');
    this.emergencyStop();
    
    // ✅ DÉLAI PLUS LONG POUR ÉVITER BOUCLE
    setTimeout(() => {
      if (!this.isConnected && !this.isConnecting) {
        this.connect();
      }
    }, 2000);
  }

  // ✅ HEARTBEAT OPTIMISÉ
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.worldRoom && this.isConnected) {
        try {
          this.worldRoom.send("heartbeat", { timestamp: Date.now() });
        } catch (error) {
          console.warn('⚠️ Erreur heartbeat:', error.message);
          this.stopHeartbeat();
        }
      } else {
        this.stopHeartbeat();
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ✅ RECONNEXION INTELLIGENTE AVEC PROTECTION
  async reconnectIfNeeded() {
    if (this.isConnected || this.isConnecting) {
      return this.isConnected;
    }
    
    // ✅ VÉRIFIER COOLDOWN
    const now = Date.now();
    if (now - this.lastConnectionAttempt < this.connectionCooldown) {
      console.log('⏳ Reconnexion en cooldown');
      return false;
    }
    
    console.log('🔄 Reconnexion intelligente...');
    return await this.connect();
  }
}

// Export et exposition globale
const colyseusManager = new ColyseusManager();
window.colyseusManager = colyseusManager;
console.log('🌐 ColyseusManager exposé (version sans boucle)');

export default colyseusManager;
export { colyseusManager };
