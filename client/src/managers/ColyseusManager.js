// client/src/managers/ColyseusManager.js - VERSION AVEC SYSTÈME DE STATUT SIMPLE
import { Client } from 'colyseus.js';
import { auth, tokenManager } from '../api';

class ColyseusManager {
    constructor() {
        this.client = null;
        this.worldRoom = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.isReady = false; // ✅ NOUVEAU: Flag ready client
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        
        // Données synchronisées
        this.playerProfile = null;
        this.worldPlayers = new Map();
        this.globalStats = {
            totalPlayers: 0,
            playersOnline: 0,
            playersSearching: 0
        };
        
        // Callbacks
        this.callbacks = {
            onConnected: null,
            onDisconnected: null,
            onProfileUpdated: null,
            onPlayersUpdated: null,
            onGlobalStatsUpdated: null,
            onMatchFound: null,
            onSearchStarted: null,
            onSearchCancelled: null,
            onBattleResult: null,
            onLeaderboard: null,
            onError: null
        };
        
        // Configuration
        this.serverUrl = this.getServerUrl();
        console.log('🌐 ColyseusManager initialisé - URL:', this.serverUrl);
        
        // Debug: exposer globalement en dev
        if (window.GameConfig?.DEBUG) {
            window.debugColyseusManager = this;
            console.log('🔧 ColyseusManager exposé pour debug');
        }
    }
    
    /**
     * 🔐 OBTENIR LE TOKEN JWT
     */
    getAuthToken() {
        console.log('🔑 Récupération token...');
        const token = tokenManager.getToken();
        if (token) {
            console.log("🔑 Token récupéré depuis tokenManager (longueur:", token.length, ")");
            console.log("🔑 Token preview:", token.substring(0, 20) + "..." + token.substring(token.length - 20));
            return token;
        }
        console.error("❌ Aucun token disponible !");
        return null;
    }
    
    /**
     * Obtenir l'URL du serveur Colyseus
     */
    getServerUrl() {
        console.log('🔧 Calcul URL serveur...');
        
        if (typeof window !== 'undefined' && window.GameConfig?.COLYSEUS_URL) {
            console.log('🔧 URL depuis GameConfig:', window.GameConfig.COLYSEUS_URL);
            return window.GameConfig.COLYSEUS_URL;
        }

        const host = window.location.hostname || 'chimarena.cloud';
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const calculatedUrl = `${protocol}://${host}/ws`;
        
        console.log('🔧 URL calculée:', calculatedUrl);
        return calculatedUrl;
    }
    
    /**
     * 🔌 CONNEXION À LA WORLDROOM AVEC SYSTÈME DE STATUT
     */
    async connect() {
        console.log('🔌 === DÉBUT CONNEXION COLYSEUS ===');
        
        if (this.isConnecting || this.isConnected) {
            console.warn('⚠️ Connexion Colyseus déjà en cours ou établie');
            return false;
        }
        
        // Nettoyer toute connexion existante
        if (this.client || this.worldRoom) {
            console.log('🧹 Nettoyage connexion existante...');
            await this.disconnect();
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Vérifier authentification
        if (!auth.isAuthenticated()) {
            console.error('❌ Pas d\'authentification pour Colyseus');
            this.triggerCallback('onError', 'Authentification requise');
            return false;
        }
        
        try {
            this.isConnecting = true;
            this.isReady = false; // ✅ Reset ready
            
            console.log('🔌 Connexion à Colyseus...');
            
            // Créer le client Colyseus
            this.client = new Client(this.serverUrl);
            console.log('✅ Client Colyseus créé');
            
            // Obtenir le token JWT
            const token = this.getAuthToken();
            if (!token) {
                throw new Error('Token d\'authentification manquant');
            }
            
            // Se connecter à la WorldRoom
            console.log('🔌 Connexion à la WorldRoom...');
            const roomOptions = { token: token };
            
            this.worldRoom = await this.client.joinOrCreate('world', roomOptions);
            
            console.log('✅ Connecté à la WorldRoom:', {
                sessionId: this.worldRoom.sessionId,
                roomId: this.worldRoom.id
            });
            
            // ✅ NOUVEAU: Configurer les handlers AVANT de signaler ready
            this.setupRoomHandlers();
            
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            
            console.log('✅ === CONNEXION COLYSEUS RÉUSSIE - EN ATTENTE READY ===');
            return true;
            
        } catch (error) {
            console.error('❌ === ERREUR CONNEXION COLYSEUS ===');
            console.error('❌ Message:', error.message);
            
            this.isConnecting = false;
            this.isConnected = false;
            this.isReady = false;
            
            this.triggerCallback('onError', `Connexion échouée: ${error.message}`);
            this.scheduleReconnect();
            return false;
        }
    }
    
    /**
     * ✅ CONFIGURATION DES HANDLERS AVEC SYSTÈME DE STATUT
     */
    setupRoomHandlers() {
        if (!this.worldRoom) {
            console.error('❌ worldRoom non disponible pour setup handlers');
            return;
        }
        
        console.log('🔧 Configuration des handlers WorldRoom...');
        
        // ✅ NOUVEAU: Handler pour confirmation serveur prêt
        this.worldRoom.onMessage("server_ready", (data) => {
            console.log('✅ SERVEUR PRÊT - Finalisation...');
            this.isReady = true;
            this.triggerCallback('onConnected'); // ✅ Maintenant on peut dire qu'on est connecté
        });
        
        // ✅ ATTENDRE L'ÉTAT INITIAL AVANT DE SIGNALER READY
        this.worldRoom.onStateChange.once((state) => {
            console.log('📊 PREMIER ÉTAT REÇU:', {
                totalPlayers: state.totalPlayers,
                playersOnline: state.playersOnline,
                playersSearching: state.playersSearching,
                playersSize: state.players?.size || 0
            });
            
            this.updateGlobalStats(state);
            
            // Configuration des handlers players
            if (state.players) {
                console.log('🔧 Configuration handlers players...');
                
                state.players.onAdd((player, sessionId) => {
                    console.log(`👤 PLAYER AJOUTÉ:`, {
                        sessionId: sessionId,
                        username: player.username,
                        level: player.level,
                        trophies: player.trophies,
                        status: player.status
                    });
                    this.worldPlayers.set(sessionId, player);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                });
                
                state.players.onRemove((player, sessionId) => {
                    console.log(`👤 PLAYER SUPPRIMÉ:`, {
                        sessionId: sessionId,
                        username: player.username
                    });
                    this.worldPlayers.delete(sessionId);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                });
                
                state.players.onChange((player, sessionId) => {
                    console.log(`👤 PLAYER MODIFIÉ:`, {
                        sessionId: sessionId,
                        username: player.username,
                        status: player.status
                    });
                    this.worldPlayers.set(sessionId, player);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                });
                
                console.log('✅ Handlers players configurés');
            }
            
            // ✅ MAINTENANT signaler au serveur que le client est prêt
            console.log('📡 ENVOI SIGNAL CLIENT_READY...');
            this.worldRoom.send("client_ready", { 
                timestamp: Date.now(),
                clientVersion: "1.0.0"
            });
        });
        
        // Changements d'état suivants
        this.worldRoom.onStateChange((state) => {
            this.updateGlobalStats(state);
            this.updatePlayersMap(state.players);
        });
        
        // ✅ MESSAGES - Tous peuvent être traités directement maintenant
        this.worldRoom.onMessage("player_profile", (data) => {
            console.log('📨 PROFIL REÇU:', {
                username: data.profile.username,
                level: data.profile.level,
                trophies: data.profile.trophies
            });
            this.playerProfile = data.profile;
            this.triggerCallback('onProfileUpdated', this.playerProfile);
        });
        
        this.worldRoom.onMessage("arena_info", (data) => {
            console.log('📨 INFO ARÈNE REÇUE:', data);
            if (this.playerProfile) {
                this.playerProfile.arenaInfo = data;
                this.triggerCallback('onProfileUpdated', this.playerProfile);
            }
        });
        
        this.worldRoom.onMessage("search_started", (data) => {
            console.log('📨 RECHERCHE COMMENCÉE:', data);
            this.triggerCallback('onSearchStarted', data);
        });
        
        this.worldRoom.onMessage("search_cancelled", (data) => {
            console.log('📨 RECHERCHE ANNULÉE:', data);
            this.triggerCallback('onSearchCancelled', data);
        });
        
        this.worldRoom.onMessage("match_found", (data) => {
            console.log('📨 MATCH TROUVÉ:', data);
            this.triggerCallback('onMatchFound', data);
        });
        
        this.worldRoom.onMessage("battle_result", (data) => {
            console.log('📨 RÉSULTAT BATAILLE:', data);
            if (this.playerProfile) {
                this.playerProfile.trophies = data.newTrophies;
                if (data.newArena) {
                    this.playerProfile.currentArena = data.newArena;
                }
            }
            this.triggerCallback('onBattleResult', data);
        });
        
        this.worldRoom.onMessage("leaderboard", (data) => {
            console.log('📨 LEADERBOARD REÇU:', {
                playersCount: data.players.length,
                total: data.total
            });
            this.triggerCallback('onLeaderboard', data);
        });
        
        this.worldRoom.onMessage("error", (data) => {
            console.error('📨 ERREUR SERVEUR:', data);
            this.triggerCallback('onError', data.message);
        });
        
        this.worldRoom.onMessage("search_error", (data) => {
            console.error('📨 ERREUR RECHERCHE:', data);
            this.triggerCallback('onError', data.message);
        });
        
        this.worldRoom.onMessage("heartbeat_ack", (data) => {
            // Heartbeat silencieux
        });
        
        // Déconnexion
        this.worldRoom.onLeave((code) => {
            console.log(`🔌 DÉCONNECTÉ DE LA WORLDROOM:`, {
                code: code,
                codeDescription: this.getLeaveCodeDescription(code)
            });
            
            this.isConnected = false;
            this.isReady = false; // ✅ Reset ready
            this.worldRoom = null;
            
            this.triggerCallback('onDisconnected', code);
            
            if (code !== 1000) {
                this.scheduleReconnect();
            }
        });
        
        this.worldRoom.onError((code, message) => {
            console.error(`🔧 ERREUR WORLDROOM:`, { code, message });
            this.triggerCallback('onError', `Erreur room: ${message}`);
        });
        
        console.log('✅ Handlers configurés - En attente du premier état...');
    }
    
    /**
     * 🔍 Description des codes de déconnexion
     */
    getLeaveCodeDescription(code) {
        const codes = {
            1000: 'Fermeture normale',
            1001: 'Endpoint parti',
            1002: 'Erreur de protocole',
            1003: 'Type de données non supporté',
            1005: 'Aucun code de statut reçu',
            1006: 'Connexion fermée anormalement',
            1007: 'Données invalides',
            1008: 'Violation de politique',
            1009: 'Message trop grand',
            1010: 'Extension manquante',
            1011: 'Erreur interne du serveur',
            4000: 'Erreur personnalisée serveur'
        };
        return codes[code] || `Code inconnu: ${code}`;
    }
    
    /**
     * 📊 METTRE À JOUR LES STATS GLOBALES
     */
    updateGlobalStats(state) {
        const oldStats = { ...this.globalStats };
        
        this.globalStats = {
            totalPlayers: state.totalPlayers || 0,
            playersOnline: state.playersOnline || 0,
            playersSearching: state.playersSearching || 0
        };
        
        if (JSON.stringify(oldStats) !== JSON.stringify(this.globalStats)) {
            console.log('📊 STATS GLOBALES MISES À JOUR:', {
                old: oldStats,
                new: this.globalStats
            });
        }
        
        this.triggerCallback('onGlobalStatsUpdated', this.globalStats);
    }
    
    /**
     * 👥 METTRE À JOUR LA MAP DES JOUEURS
     */
    updatePlayersMap(playersMap) {
        const oldSize = this.worldPlayers.size;
        this.worldPlayers.clear();
        
        if (playersMap) {
            playersMap.forEach((player, sessionId) => {
                this.worldPlayers.set(sessionId, player);
            });
        }
        
        if (oldSize !== this.worldPlayers.size) {
            console.log('👥 MAP JOUEURS MISE À JOUR:', {
                oldSize: oldSize,
                newSize: this.worldPlayers.size
            });
        }
        
        this.triggerCallback('onPlayersUpdated', this.worldPlayers);
    }
    
    /**
     * 🔄 RECONNEXION AUTOMATIQUE
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ TROP DE TENTATIVES DE RECONNEXION');
            this.triggerCallback('onError', 'Connexion impossible après plusieurs tentatives');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`🔄 PROGRAMMATION RECONNEXION: tentative ${this.reconnectAttempts} dans ${Math.round(delay / 1000)}s`);
        
        setTimeout(() => {
            if (!this.isConnected && auth.isAuthenticated()) {
                console.log('🔄 TENTATIVE DE RECONNEXION...');
                this.connect();
            }
        }, delay);
    }
    
    /**
     * 🔌 DÉCONNEXION VOLONTAIRE
     */
    async disconnect() {
        console.log('🔌 DÉCONNEXION VOLONTAIRE DE COLYSEUS');
        
        this.isConnected = false;
        this.isReady = false; // ✅ Reset ready
        this.reconnectAttempts = this.maxReconnectAttempts; // Empêcher reconnexion auto
        
        if (this.worldRoom) {
            try {
                await this.worldRoom.leave();
                console.log('✅ Room fermée');
            } catch (error) {
                console.warn('⚠️ Erreur fermeture room:', error);
            }
            this.worldRoom = null;
        }
        
        if (this.client) {
            this.client = null;
        }
        
        // Nettoyer les données
        this.playerProfile = null;
        this.worldPlayers.clear();
        
        console.log('✅ Déconnexion terminée');
        this.triggerCallback('onDisconnected', 1000);
    }
    
    /**
     * 📨 ENVOYER UN MESSAGE - AVEC VÉRIFICATION READY
     */
    sendMessage(type, data = {}) {
        console.log(`📨 ENVOI MESSAGE:`, {
            type: type,
            data: data,
            isConnected: this.isConnected,
            isReady: this.isReady
        });
        
        if (!this.isConnected || !this.worldRoom) {
            console.warn(`⚠️ Impossible d'envoyer ${type}, pas connecté`);
            return false;
        }
        
        // ✅ NOUVEAU: Vérifier si ready pour certains messages
        const requiresReady = ['search_battle', 'cancel_search', 'get_arena_info', 'get_leaderboard', 'update_status'];
        if (requiresReady.includes(type) && !this.isReady) {
            console.warn(`⚠️ Impossible d'envoyer ${type}, client pas encore prêt`);
            return false;
        }
        
        try {
            this.worldRoom.send(type, data);
            console.log(`✅ Message envoyé: ${type}`);
            return true;
        } catch (error) {
            console.error(`❌ Erreur envoi message ${type}:`, error);
            return false;
        }
    }
    
    /**
     * ⚔️ ACTIONS DE MATCHMAKING
     */
    searchBattle() {
        console.log('⚔️ DEMANDE RECHERCHE BATAILLE');
        return this.sendMessage("search_battle");
    }
    
    cancelSearch() {
        console.log('❌ DEMANDE ANNULATION RECHERCHE');
        return this.sendMessage("cancel_search");
    }
    
    requestArenaInfo() {
        console.log('🏟️ DEMANDE INFO ARÈNE');
        return this.sendMessage("get_arena_info");
    }
    
    requestLeaderboard(limit = 50) {
        console.log('🏆 DEMANDE LEADERBOARD (limit:', limit, ')');
        return this.sendMessage("get_leaderboard", { limit });
    }
    
    updateStatus(status) {
        console.log('📊 MISE À JOUR STATUT:', status);
        return this.sendMessage("update_status", { status });
    }
    
    /**
     * 💓 HEARTBEAT
     */
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        console.log('💓 DÉMARRAGE HEARTBEAT (30s)');
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                // Heartbeat ne nécessite pas ready
                if (this.worldRoom) {
                    this.worldRoom.send("heartbeat", { timestamp: Date.now() });
                }
            }
        }, 30000);
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            console.log('💓 ARRÊT HEARTBEAT');
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    /**
     * 🔧 GESTION DES CALLBACKS
     */
    on(event, callback) {
        const callbackName = 'on' + event.charAt(0).toUpperCase() + event.slice(1);
        if (this.callbacks.hasOwnProperty(callbackName)) {
            this.callbacks[callbackName] = callback;
            console.log(`🔧 Callback configuré: ${callbackName}`);
        } else {
            console.warn(`⚠️ Événement non reconnu: ${event}`);
        }
    }
    
    off(event) {
        const callbackName = 'on' + event.charAt(0).toUpperCase() + event.slice(1);
        if (this.callbacks.hasOwnProperty(callbackName)) {
            this.callbacks[callbackName] = null;
            console.log(`🔧 Callback supprimé: ${callbackName}`);
        }
    }
    
    triggerCallback(callbackName, data = null) {
        const callback = this.callbacks[callbackName];
        if (callback && typeof callback === 'function') {
            try {
                console.log(`🔔 DÉCLENCHEMENT CALLBACK: ${callbackName}`, data ? 'avec données' : 'sans données');
                callback(data);
            } catch (error) {
                console.error(`❌ Erreur callback ${callbackName}:`, error);
            }
        }
    }
    
    /**
     * 📊 GETTERS
     */
    getPlayerProfile() {
        return this.playerProfile;
    }
    
    getWorldPlayers() {
        return Array.from(this.worldPlayers.values());
    }
    
    getGlobalStats() {
        return this.globalStats;
    }
    
    isColyseusConnected() {
        return this.isConnected && this.isReady; // ✅ Connecté ET prêt
    }
    
    /**
     * 🔍 DEBUG INFO
     */
    getDebugInfo() {
        return {
            isConnected: this.isConnected,
            isReady: this.isReady, // ✅ NOUVEAU
            isConnecting: this.isConnecting,
            hasClient: !!this.client,
            hasRoom: !!this.worldRoom,
            sessionId: this.worldRoom?.sessionId,
            reconnectAttempts: this.reconnectAttempts,
            serverUrl: this.serverUrl,
            playersCount: this.worldPlayers.size,
            globalStats: this.globalStats,
            playerProfile: !!this.playerProfile,
            callbacksConfigured: Object.keys(this.callbacks).filter(k => this.callbacks[k] !== null)
        };
    }
    
    /**
     * 🧹 NETTOYAGE
     */
    destroy() {
        console.log('🧹 DESTRUCTION COLYSEUSMANAGER');
        this.stopHeartbeat();
        this.disconnect();
        
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = null;
        });
        
        console.log('✅ ColyseusManager détruit');
    }
}

// Instance singleton
const colyseusManager = new ColyseusManager();

export default colyseusManager;
