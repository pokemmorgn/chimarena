class ColyseusManager {
  constructor() {
    this.client = null;
    this.worldRoom = null;
    this.isConnected = false;
    this.isConnecting = false;
    
    // ✅ COMME POKEMMO: Configuration simple
    this.serverUrl = window.GameConfig?.COLYSEUS_URL || 'wss://chimarena.cloud/ws';
    
    // ✅ Données simples
    this.playerProfile = null;
    this.worldPlayers = new Map();
    
    // ✅ Callbacks simples comme PokeMMO
    this.callbacks = new Map();
    
    console.log('🌐 ColyseusManager initialisé (style PokeMMO)');
  }

  // ✅ MÉTHODE PRINCIPALE SIMPLIFIÉE (inspirée PokeMMO connect)
  async connect() {
    console.log('🌐 === CONNEXION COLYSEUS (STYLE POKEMMO) ===');
    
    if (this.isConnecting || this.isConnected) {
      console.warn('⚠️ Déjà connecté ou en cours');
      return this.isConnected;
    }
    
    // ✅ VÉRIFIER AUTH COMME POKEMMO
    if (!auth.isAuthenticated()) {
      console.error('❌ Non authentifié pour Colyseus');
      return false;
    }
    
    try {
      this.isConnecting = true;
      
      // ✅ NETTOYER AVANT RECONNEXION
      if (this.worldRoom) {
        console.log('🧹 Nettoyage connexion existante');
        await this.forceDisconnect();
      }
      
      // ✅ CRÉER CLIENT COMME POKEMMO
      console.log('🔧 Création client Colyseus...');
      this.client = new Colyseus.Client(this.serverUrl);
      
      // ✅ RÉCUPÉRER TOKEN (votre système sécurisé)
      const token = auth.getTokenInfo()?.token || tokenManager.getToken();
      if (!token) {
        throw new Error('Token JWT manquant');
      }
      
      console.log('🔌 Connexion WorldRoom...');
      
      // ✅ CONNEXION DIRECTE COMME POKEMMO AuthRoom
      this.worldRoom = await this.client.joinOrCreate('world', { 
        token: token,
        username: auth.getTokenInfo()?.username
      });
      
      console.log('✅ CONNECTÉ WorldRoom:', {
        sessionId: this.worldRoom.sessionId,
        roomId: this.worldRoom.id
      });
      
      // ✅ SETUP HANDLERS SIMPLES COMME POKEMMO
      this.setupSimpleHandlers();
      
      this.isConnected = true;
      this.isConnecting = false;
      
      // ✅ TRIGGER CALLBACK CONNEXION
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

  // ✅ HANDLERS SIMPLES COMME POKEMMO setupMessageHandlers()
  setupSimpleHandlers() {
    if (!this.worldRoom) return;
    
    console.log('🔧 Setup handlers Colyseus simples...');
    
    // ✅ ÉTAT INITIAL COMME POKEMMO onStateChange.once
    this.worldRoom.onStateChange.once((state) => {
      console.log('📊 PREMIER ÉTAT REÇU:', {
        totalPlayers: state.totalPlayers,
        playersOnline: state.playersOnline,
        playersCount: state.players?.size || 0
      });
      
      this.updatePlayersFromState(state);
      this.triggerCallback('globalStatsUpdated', {
        totalPlayers: state.totalPlayers,
        playersOnline: state.playersOnline,
        playersSearching: state.playersSearching
      });
    });
    
    // ✅ CHANGEMENTS D'ÉTAT COMME POKEMMO onStateChange
    this.worldRoom.onStateChange((state) => {
      this.updatePlayersFromState(state);
      this.triggerCallback('globalStatsUpdated', {
        totalPlayers: state.totalPlayers,
        playersOnline: state.playersOnline,
        playersSearching: state.playersSearching
      });
    });
    
    // ✅ MESSAGES COMME POKEMMO onMessage handlers
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
    
    // ✅ CONNEXION/DÉCONNEXION COMME POKEMMO
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
    
    console.log('✅ Handlers Colyseus configurés');
  }

  // ✅ MISE À JOUR JOUEURS SIMPLIFIÉE
  updatePlayersFromState(state) {
    if (!state.players) return;
    
    // ✅ Nettoyer et remplir la Map
    this.worldPlayers.clear();
    
    state.players.forEach((player, sessionId) => {
      this.worldPlayers.set(sessionId, {
        sessionId,
        username: player.username,
        level: player.level,
        trophies: player.trophies,
        status: player.status,
        wins: player.wins,
        losses: player.losses,
        winRate: player.winRate
      });
    });
    
    console.log(`👥 ${this.worldPlayers.size} joueurs mis à jour`);
    this.triggerCallback('playersUpdated', this.worldPlayers);
  }

  // ✅ DÉCONNEXION FORCÉE COMME POKEMMO
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

  // ✅ MÉTHODES PUBLIQUES COMME POKEMMO
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

  // ✅ SYSTÈME DE CALLBACKS COMME POKEMMO
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

  // ✅ MÉTHODES DEBUG COMME POKEMMO
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
      auth: {
        isAuthenticated: auth.isAuthenticated(),
        hasToken: !!auth.getTokenInfo()?.token,
        username: auth.getTokenInfo()?.username
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

  // ✅ HEARTBEAT SIMPLE (optionnel)
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.worldRoom && this.isConnected) {
        this.worldRoom.send("heartbeat", { timestamp: Date.now() });
      }
    }, 30000); // 30 secondes
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
