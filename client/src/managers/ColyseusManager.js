// client/src/managers/ColyseusManager.js - VERSION SIMPLIFIÉE COMPATIBLE
import { WorldState, WorldPlayer } from "../schema/WorldState.js";

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
    
    console.log('🌐 ColyseusManager initialisé (simplifié)');
  }

  // ✅ MÉTHODE CONNEXION SIMPLIFIÉE
  async connect() {
    console.log('🌐 === CONNEXION COLYSEUS SIMPLIFIÉE ===');
    
    if (this.isConnecting || this.isConnected) {
      console.warn('⚠️ Déjà connecté ou en cours');
      return this.isConnected;
    }
    
    // 🔐 VÉRIFIER AUTH
    if (!window.auth || !window.auth.isAuthenticated()) {
      console.error('❌ Non authentifié pour Colyseus');
      return false;
    }
    
    try {
      this.isConnecting = true;
      
      // 🧹 NETTOYER AVANT RECONNEXION
      if (this.worldRoom) {
        console.log('🧹 Nettoyage connexion existante');
        await this.forceDisconnect();
      }
      
      // 🔧 CRÉER CLIENT SIMPLE
      console.log('🔧 Création client Colyseus...');
      
      // Vérifier que Colyseus est disponible
      if (!window.Colyseus) {
        throw new Error('Colyseus non disponible');
      }
      
      this.client = new window.Colyseus.Client(this.serverUrl);
      
      // 🔑 RÉCUPÉRER TOKEN
      const tokenInfo = window.auth.getTokenInfo();
      if (!tokenInfo || !tokenInfo.token) {
        throw new Error('Token JWT manquant');
      }
      
      const joinOptions = { 
        token: tokenInfo.token,
        username: tokenInfo.username || 'Player'
      };
      
      console.log('🔌 Connexion WorldRoom...');
      
      // 🌐 CONNEXION
      this.worldRoom = await this.client.joinOrCreate('world', joinOptions);
      
      console.log('✅ CONNECTÉ WorldRoom:', {
        sessionId: this.worldRoom.sessionId,
        roomId: this.worldRoom.id
      });
      
      // ✅ SETUP HANDLERS SIMPLIFIÉS
      this.setupHandlers();
      
      this.isConnected = true;
      this.isConnecting = false;
      
      this.triggerCallback('connected');
      
      console.log('✅ === CONNEXION COLYSEUS RÉUSSIE ===');
      return true;
      
    } catch (error) {
      console.error('❌ === CONNEXION COLYSEUS ÉCHOUÉE ===');
      console.error('Erreur:', error.message);
      
      this.isConnecting = false;
      this.isConnected = false;
      
      await this.forceDisconnect();
      
      this.triggerCallback('error', `Connexion échouée: ${error.message}`);
      return false;
    }
  }

  // ✅ HANDLERS SIMPLIFIÉS
  setupHandlers() {
    if (!this.worldRoom) return;
    
    console.log('🔧 Setup handlers Colyseus simplifiés...');
    
    // ✅ MESSAGES SERVEUR EN PREMIER
    this.worldRoom.onMessage("player_profile", (data) => {
      console.log('📨 PROFIL REÇU:', data.profile?.username);
      this.playerProfile = data.profile;
      this.triggerCallback('profileUpdated', this.playerProfile);
    });
    
    this.worldRoom.onMessage("arena_info", (data) => {
      console.log('📨 ARENA INFO REÇUE');
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
      console.log('📨 RÉSULTAT COMBAT:', data.victory ? 'VICTOIRE' : 'DÉFAITE');
      this.triggerCallback('battleResult', data);
    });
    
    this.worldRoom.onMessage("leaderboard", (data) => {
      console.log('📨 LEADERBOARD REÇU:', data.players?.length, 'joueurs');
      this.triggerCallback('leaderboard', data);
    });
    
    this.worldRoom.onMessage("search_cancelled", (data) => {
      console.log('📨 RECHERCHE ANNULÉE');
      this.triggerCallback('searchCancelled', data);
    });
    
    this.worldRoom.onMessage("error", (data) => {
      console.error('📨 ERREUR SERVEUR:', data.message);
      this.triggerCallback('error', data.message);
    });
    
    this.worldRoom.onMessage("heartbeat_ack", (data) => {
      // Heartbeat silencieux
    });
    
    // ✅ ÉTAT SIMPLIFIÉ - PAS DE onAdd/onRemove
    this.worldRoom.onStateChange.once((state) => {
  console.log('📊 PREMIER ÉTAT REÇU');
  console.log('State:', {
    totalPlayers: state.totalPlayers,
    playersOnline: state.playersOnline,
    playersSearching: state.playersSearching,
    playersSize: state.players?.size
  });

  this.updateGlobalStats(state);
  this.updatePlayersSimple(state);
});

this.worldRoom.onStateChange((state) => {
  this.updateGlobalStats(state);
  this.updatePlayersSimple(state);
});

    
    // ✅ ÉVÉNEMENTS CONNEXION
    this.worldRoom.onLeave((code) => {
      console.log(`🔌 DÉCONNECTÉ (code: ${code})`);
      this.isConnected = false;
      this.worldRoom = null;
      this.triggerCallback('disconnected', code);
    });
    
    this.worldRoom.onError((code, message) => {
      console.error(`🔧 ERREUR ROOM: ${code} - ${message}`);
      this.triggerCallback('error', `Erreur room: ${message}`);
    });
    
    console.log('✅ Handlers Colyseus simplifiés configurés');
  }

  // ✅ MISE À JOUR STATS GLOBALES SIMPLE
  updateGlobalStats(state) {
    if (!state) return;
    
    this.globalStats = {
      totalPlayers: state.totalPlayers || 0,
      playersOnline: state.playersOnline || 0,
      playersSearching: state.playersSearching || 0
    };
    
    this.triggerCallback('globalStatsUpdated', this.globalStats);
  }

  // ✅ MISE À JOUR JOUEURS SIMPLE
  updatePlayersSimple(state) {
    if (!state || !state.players) return;
    
    try {
      // Nettoyer
      this.worldPlayers.clear();
      
      // Convertir MapSchema en Map simple
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
      
      console.log(`👥 ${this.worldPlayers.size} joueurs mis à jour`);
      this.triggerCallback('playersUpdated', this.worldPlayers);
      
    } catch (error) {
      console.error('❌ Erreur updatePlayersSimple:', error);
    }
  }

  // ✅ DÉCONNEXION
  async forceDisconnect() {
    console.log('🔌 DÉCONNEXION FORCÉE COLYSEUS');
    
    if (this.worldRoom) {
      try {
        await this.worldRoom.leave();
      } catch (error) {
        console.warn('⚠️ Erreur leave room:', error.message);
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
    if (this.worldRoom && this.isConnected) {
      console.log('⚔️ Recherche de bataille...');
      this.worldRoom.send("search_battle");
      return true;
    }
    console.warn('⚠️ Pas connecté pour recherche bataille');
    return false;
  }

  cancelSearch() {
    if (this.worldRoom && this.isConnected) {
      console.log('❌ Annulation recherche...');
      this.worldRoom.send("cancel_search");
      return true;
    }
    return false;
  }

  getLeaderboard(limit = 50) {
    if (this.worldRoom && this.isConnected) {
      console.log('🏆 Demande leaderboard...');
      this.worldRoom.send("get_leaderboard", { limit });
      return true;
    }
    return false;
  }

  requestArenaInfo() {
    if (this.worldRoom && this.isConnected) {
      console.log('🏟️ Demande infos arène...');
      this.worldRoom.send("get_arena_info");
      return true;
    }
    return false;
  }

  updateStatus(status) {
    if (this.worldRoom && this.isConnected) {
      this.worldRoom.send("update_status", { status });
      return true;
    }
    return false;
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

  // ✅ DEBUG
  getDebugInfo() {
    return {
      isConnected: this.isConnected,
      isConnecting: this.isConnecting,
      hasRoom: !!this.worldRoom,
      hasClient: !!this.client,
      sessionId: this.worldRoom?.sessionId,
      roomId: this.worldRoom?.id,
      playersCount: this.worldPlayers.size,
      hasProfile: !!this.playerProfile,
      serverUrl: this.serverUrl,
      globalStats: this.globalStats,
      auth: {
        isAuthenticated: window.auth?.isAuthenticated?.() || false,
        hasToken: !!window.auth?.getTokenInfo?.()?.token,
        username: window.auth?.getTokenInfo?.()?.username
      }
    };
  }

  isColyseusConnected() {
    return this.isConnected && !!this.worldRoom;
  }

  printConnectionHistory() {
    console.log('📊 État Colyseus:', this.getDebugInfo());
  }

  emergencyStop() {
    console.log('🛑 ARRÊT D\'URGENCE COLYSEUS');
    this.forceDisconnect();
  }

  fullReset() {
    console.log('🔄 RESET COMPLET COLYSEUS');
    this.emergencyStop();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  // ✅ HEARTBEAT SIMPLE
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.worldRoom && this.isConnected) {
        this.worldRoom.send("heartbeat", { timestamp: Date.now() });
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

// Export et exposition globale
const colyseusManager = new ColyseusManager();
window.colyseusManager = colyseusManager;
console.log('🌐 ColyseusManager exposé globalement');

export default colyseusManager;
export { colyseusManager };
