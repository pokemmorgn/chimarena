// client/src/managers/ColyseusManager.js - CORRECTION ERREUR onAdd

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
    
    // Callbacks
    this.callbacks = new Map();
    
    // 🔍 Import dynamique sécurisé de Colyseus
    this.Colyseus = null;
    this.initColyseus();
    
    console.log('🌐 ColyseusManager initialisé');
  }

  // 🔧 INITIALISATION SÉCURISÉE DE COLYSEUS
  async initColyseus() {
    try {
      // Vérifier si Colyseus est disponible globalement
      if (window.Colyseus) {
        this.Colyseus = window.Colyseus;
        console.log('✅ Colyseus trouvé globalement');
        return;
      }
      
      // Essayer import dynamique
      const colyseusModule = await import('colyseus.js');
      this.Colyseus = colyseusModule.default || colyseusModule;
      console.log('✅ Colyseus importé dynamiquement');
      
    } catch (error) {
      console.error('❌ Impossible de charger Colyseus:', error);
      this.Colyseus = null;
    }
  }

  // ✅ MÉTHODE CONNEXION CORRIGÉE
  async connect() {
    console.log('🌐 === CONNEXION COLYSEUS DEBUT ===');
    
    if (this.isConnecting) {
      console.warn('⚠️ Connexion déjà en cours');
      return this.isConnected;
    }
    
    if (this.isConnected && this.worldRoom) {
      console.log('✅ Déjà connecté');
      return true;
    }
    
    // 🔐 VÉRIFIER AUTH
    if (!window.auth || !window.auth.isAuthenticated()) {
      console.error('❌ Non authentifié pour Colyseus');
      return false;
    }
    
    // 🔧 VÉRIFIER COLYSEUS DISPONIBLE
    if (!this.Colyseus) {
      console.error('❌ Colyseus non disponible');
      await this.initColyseus();
      if (!this.Colyseus) {
        this.triggerCallback('error', 'Colyseus non disponible');
        return false;
      }
    }
    
    try {
      this.isConnecting = true;
      
      // 🧹 NETTOYER AVANT RECONNEXION
      if (this.worldRoom) {
        console.log('🧹 Nettoyage connexion existante');
        await this.forceDisconnect();
      }
      
      // 🔧 CRÉER CLIENT
      console.log('🔧 Création client Colyseus...');
      this.client = new this.Colyseus.Client(this.serverUrl);
      
      // 🔑 RÉCUPÉRER TOKEN
      const tokenInfo = window.auth.getTokenInfo();
      if (!tokenInfo || !tokenInfo.token) {
        throw new Error('Token JWT manquant');
      }
      
      const joinOptions = { 
        token: tokenInfo.token,
        username: tokenInfo.username || 'Player',
        clientVersion: window.GameConfig?.VERSION || '1.0.0'
      };
      
      console.log('🔌 Connexion WorldRoom avec options:', joinOptions);
      
      // 🌐 CONNEXION AVEC GESTION D'ERREUR SPÉCIFIQUE
      this.worldRoom = await this.client.joinOrCreate('world', joinOptions);
      
      console.log('✅ CONNECTÉ WorldRoom:', {
        sessionId: this.worldRoom.sessionId,
        roomId: this.worldRoom.id
      });
      
      // ✅ SETUP HANDLERS SÉCURISÉS
      this.setupSecureHandlers();
      
      this.isConnected = true;
      this.isConnecting = false;
      
      this.triggerCallback('connected');
      
      console.log('✅ === CONNEXION COLYSEUS RÉUSSIE ===');
      return true;
      
    } catch (error) {
      console.error('❌ === CONNEXION COLYSEUS ÉCHOUÉE ===');
      console.error('Erreur détaillée:', error);
      console.error('Stack:', error.stack);
      
      this.isConnecting = false;
      this.isConnected = false;
      
      await this.forceDisconnect();
      
      // 🔍 ANALYSE DE L'ERREUR SPÉCIFIQUE
      let errorMessage = error.message;
      if (error.message.includes('onAdd')) {
        errorMessage = 'Erreur de synchronisation état serveur (onAdd)';
        console.error('💡 SOLUTION: Vérifiez que le serveur renvoie un état valide avec des Collections');
      } else if (error.code === 4000) {
        errorMessage = 'Salle refusée par le serveur';
      } else if (error.code === 1006) {
        errorMessage = 'Connexion WebSocket fermée de manière inattendue';
      }
      
      this.triggerCallback('error', errorMessage);
      return false;
    }
  }

  // ✅ HANDLERS SÉCURISÉS AVEC GESTION ERREUR onAdd
  setupSecureHandlers() {
    if (!this.worldRoom) return;
    
    console.log('🔧 Setup handlers Colyseus sécurisés...');
    
    // ✅ ÉTAT INITIAL AVEC PROTECTION
    this.worldRoom.onStateChange.once((state) => {
      console.log('📊 PREMIER ÉTAT REÇU');
      console.log('État complet:', state);
      
      // 🔍 VÉRIFIER STRUCTURE ÉTAT
      if (state) {
        console.log('Propriétés état:', Object.keys(state));
        console.log('Type players:', typeof state.players);
        console.log('Players est Map?', state.players instanceof Map);
        console.log('Players est Schema?', state.players?.constructor?.name);
      }
      
      try {
        this.updatePlayersFromStateSafe(state);
        this.triggerCallback('globalStatsUpdated', {
          totalPlayers: state.totalPlayers || 0,
          playersOnline: state.playersOnline || 0,
          playersSearching: state.playersSearching || 0
        });
      } catch (error) {
        console.error('❌ Erreur traitement état initial:', error);
      }
    });
    
    // ✅ CHANGEMENTS D'ÉTAT AVEC PROTECTION
    this.worldRoom.onStateChange((state) => {
      try {
        this.updatePlayersFromStateSafe(state);
        this.triggerCallback('globalStatsUpdated', {
          totalPlayers: state.totalPlayers || 0,
          playersOnline: state.playersOnline || 0,
          playersSearching: state.playersSearching || 0
        });
      } catch (error) {
        console.error('❌ Erreur traitement changement état:', error);
      }
    });
    
    // ✅ AJOUT/SUPPRESSION JOUEURS SÉCURISÉ
    if (this.worldRoom.state && this.worldRoom.state.players) {
      try {
        // Protection contre l'erreur onAdd
        this.worldRoom.state.players.onAdd = (player, sessionId) => {
          try {
            console.log('👤 Joueur ajouté:', sessionId, player.username);
            this.worldPlayers.set(sessionId, {
              sessionId,
              username: player.username || 'Unknown',
              level: player.level || 1,
              trophies: player.trophies || 0,
              status: player.status || 'online'
            });
            this.triggerCallback('playersUpdated', this.worldPlayers);
          } catch (error) {
            console.error('❌ Erreur onAdd player:', error);
          }
        };

        this.worldRoom.state.players.onRemove = (player, sessionId) => {
          try {
            console.log('👤 Joueur supprimé:', sessionId);
            this.worldPlayers.delete(sessionId);
            this.triggerCallback('playersUpdated', this.worldPlayers);
          } catch (error) {
            console.error('❌ Erreur onRemove player:', error);
          }
        };
      } catch (error) {
        console.error('❌ Impossible de configurer onAdd/onRemove:', error);
        console.warn('⚠️ Mode fallback: polling manuel');
      }
    }
    
    // ✅ MESSAGES SERVEUR
    this.worldRoom.onMessage("player_profile", (data) => {
      console.log('📨 PROFIL REÇU:', data.profile?.username);
      this.playerProfile = data.profile;
      this.triggerCallback('profileUpdated', this.playerProfile);
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
    
    this.worldRoom.onMessage("error", (data) => {
      console.error('📨 ERREUR SERVEUR:', data.message);
      this.triggerCallback('error', data.message);
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
    
    console.log('✅ Handlers Colyseus configurés avec protection onAdd');
  }

  // ✅ MISE À JOUR JOUEURS SÉCURISÉE
  updatePlayersFromStateSafe(state) {
    if (!state) {
      console.warn('⚠️ État null, skip update players');
      return;
    }
    
    try {
      // Nettoyer d'abord
      this.worldPlayers.clear();
      
      // Vérifier si players existe et est itérable
      if (state.players) {
        if (typeof state.players.forEach === 'function') {
          // Schema Map
          state.players.forEach((player, sessionId) => {
            this.worldPlayers.set(sessionId, {
              sessionId,
              username: player.username || 'Unknown',
              level: player.level || 1,
              trophies: player.trophies || 0,
              status: player.status || 'online',
              wins: player.wins || 0,
              losses: player.losses || 0,
              winRate: player.winRate || 0
            });
          });
        } else if (state.players.constructor && state.players.constructor.name === 'MapSchema') {
          // MapSchema spécifique
          for (const [sessionId, player] of state.players) {
            this.worldPlayers.set(sessionId, {
              sessionId,
              username: player.username || 'Unknown',
              level: player.level || 1,
              trophies: player.trophies || 0,
              status: player.status || 'online'
            });
          }
        } else {
          console.warn('⚠️ Type players non reconnu:', state.players.constructor?.name);
        }
      }
      
      console.log(`👥 ${this.worldPlayers.size} joueurs mis à jour (safe)`);
      this.triggerCallback('playersUpdated', this.worldPlayers);
      
    } catch (error) {
      console.error('❌ Erreur updatePlayersFromStateSafe:', error);
    }
  }

  // ✅ DÉCONNEXION FORCÉE
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

  // ✅ MÉTHODES PUBLIQUES
  async disconnect() {
    await this.forceDisconnect();
    this.triggerCallback('disconnected');
  }

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

  // Nouvelle méthode pour demander les infos d'arène
  requestArenaInfo() {
    if (this.worldRoom && this.isConnected) {
      console.log('🏟️ Demande infos arène...');
      this.worldRoom.send("get_arena_info");
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
      hasColyseus: !!this.Colyseus,
      sessionId: this.worldRoom?.sessionId,
      roomId: this.worldRoom?.id,
      playersCount: this.worldPlayers.size,
      hasProfile: !!this.playerProfile,
      serverUrl: this.serverUrl,
      roomState: this.worldRoom?.state ? {
        hasPlayers: !!this.worldRoom.state.players,
        playersType: this.worldRoom.state.players?.constructor?.name,
        playersSize: this.worldRoom.state.players?.size,
        totalPlayers: this.worldRoom.state.totalPlayers,
        playersOnline: this.worldRoom.state.playersOnline
      } : null,
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
    if (this.worldRoom?.state) {
      console.log('📊 État Room:', this.worldRoom.state);
    }
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

  // ✅ HEARTBEAT
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

// Export par défaut ET nommé pour compatibilité
const colyseusManager = new ColyseusManager();
export default colyseusManager;
export { colyseusManager };
