// client/src/managers/ColyseusManager.js - GESTIONNAIRE COLYSEUS WEBSOCKET
import { Client } from 'colyseus.js';
import { auth } from '../api';

/**
 * 🌐 GESTIONNAIRE COLYSEUS - Connexion WebSocket temps réel
 * Gère la connexion à la WorldRoom et la synchronisation des données
 */
class ColyseusManager {
    constructor() {
        this.client = null;
        this.worldRoom = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000; // 2 secondes initial
        
        // Données synchronisées
        this.playerProfile = null;
        this.worldPlayers = new Map();
        this.globalStats = {
            totalPlayers: 0,
            playersOnline: 0,
            playersSearching: 0
        };
        
        // Callbacks pour notifier les composants
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
            onError: null
        };
        
        // Configuration
        this.serverUrl = this.getServerUrl();
        console.log('🌐 ColyseusManager initialisé - URL:', this.serverUrl);
    }
    
    /**
     * 🔐 OBTENIR LE TOKEN JWT (même méthode que l'API HTTP)
     */
    getAuthToken() {
    try {
        console.log("🔍 Vérification du token JWT...");

        // Vérifier d'abord auth.getToken()
        if (auth && typeof auth.getToken === 'function') {
            const directToken = auth.getToken();
            console.log("🔑 Token via auth.getToken():", directToken ? "[OK]" : "[VIDE]");
            if (directToken) return directToken;
        } else {
            console.warn("⚠️ auth.getToken() n'existe pas");
        }

        // Vérifier via apiClient headers
        if (auth.apiClient && typeof auth.apiClient.getHeaders === 'function') {
            const headers = auth.apiClient.getHeaders();
            console.log("📦 Headers récupérés:", headers);

            const authHeader = headers.Authorization || headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                console.log("🔑 Token via apiClient headers: [OK]");
                return token;
            } else {
                console.warn("⚠️ Pas de header Authorization valide:", authHeader);
            }
        } else {
            console.warn("⚠️ apiClient.getHeaders() n'existe pas");
        }

        console.error("❌ Aucun token trouvé !");
        return null;

    } catch (error) {
        console.error("❌ Erreur récupération token:", error);
        return null;
    }
}

    
    /**
     * Obtenir l'URL du serveur Colyseus
     */
    getServerUrl() {
        // Utiliser la config du jeu ou fallback
        if (typeof window !== 'undefined' && window.GameConfig?.COLYSEUS_URL) {
            return window.GameConfig.COLYSEUS_URL;
        }
        
        // Dériver de l'API URL
        const apiUrl = (typeof window !== 'undefined' && window.GameConfig?.API_URL) 
            ? window.GameConfig.API_URL 
            : 'https://chimarena.cloud/api';
            
        // Remplacer /api par :2567 pour Colyseus
        return apiUrl.replace('/api', ':2567').replace('https://', 'wss://').replace('http://', 'ws://');
    }
    
    /**
     * 🔌 CONNEXION À LA WORLDROOM
     */
    async connect() {
        if (this.isConnecting || this.isConnected) {
            console.warn('⚠️ Connexion Colyseus déjà en cours ou établie');
            return false;
        }
        
        // Vérifier l'authentification
        if (!auth.isAuthenticated()) {
            console.error('❌ Pas d\'authentification pour Colyseus');
            this.triggerCallback('onError', 'Authentification requise');
            return false;
        }
        
        try {
            this.isConnecting = true;
            console.log('🔌 Connexion à Colyseus...');
            
            // Créer le client Colyseus
            this.client = new Client(this.serverUrl);
            
            // Obtenir le token JWT depuis l'auth
            const token = this.getAuthToken();
            if (!token) {
                throw new Error('Token d\'authentification manquant');
            }
            
            // Se connecter à la WorldRoom avec seulement le token
            // Le serveur extraira userId et username du JWT
            this.worldRoom = await this.client.joinOrCreate('world', {
                token: token // ✅ SEUL LE TOKEN EST NÉCESSAIRE
            });
            
            console.log('✅ Connecté à la WorldRoom:', this.worldRoom.sessionId);
            
            // Configurer les handlers
            this.setupRoomHandlers();
            
            // Marquer comme connecté
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            
            this.triggerCallback('onConnected');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur connexion Colyseus:', error);
            this.isConnecting = false;
            this.isConnected = false;
            
            this.triggerCallback('onError', `Connexion échouée: ${error.message}`);
            
            // Tentative de reconnexion automatique
            this.scheduleReconnect();
            return false;
        }
    }
    
    /**
     * 🔧 CONFIGURATION DES HANDLERS DE LA ROOM
     */
    setupRoomHandlers() {
        if (!this.worldRoom) return;
        
        console.log('🔧 Configuration des handlers WorldRoom...');
        
        // 📊 Changements d'état général
        this.worldRoom.onStateChange((state) => {
            console.log('📊 État WorldRoom mis à jour');
            this.updateGlobalStats(state);
            this.updatePlayersMap(state.players);
        });
        
        // 👤 Ajout de joueur
        this.worldRoom.state.players.onAdd = (player, sessionId) => {
            console.log(`👤 Joueur ajouté: ${player.username} (${sessionId})`);
            this.worldPlayers.set(sessionId, player);
            this.triggerCallback('onPlayersUpdated', this.worldPlayers);
        };
        
        // 👤 Suppression de joueur
        this.worldRoom.state.players.onRemove = (player, sessionId) => {
            console.log(`👤 Joueur supprimé: ${player.username} (${sessionId})`);
            this.worldPlayers.delete(sessionId);
            this.triggerCallback('onPlayersUpdated', this.worldPlayers);
        };
        
        // 👤 Changement de joueur
        this.worldRoom.state.players.onChange = (player, sessionId) => {
            console.log(`👤 Joueur modifié: ${player.username}`);
            this.worldPlayers.set(sessionId, player);
            this.triggerCallback('onPlayersUpdated', this.worldPlayers);
        };
        
        // 📨 Messages du serveur
        this.worldRoom.onMessage("player_profile", (data) => {
            console.log('📨 Profil reçu:', data.profile.username);
            this.playerProfile = data.profile;
            this.triggerCallback('onProfileUpdated', this.playerProfile);
        });
        
        this.worldRoom.onMessage("arena_info", (data) => {
            console.log('📨 Info arène reçue:', data);
            // Mettre à jour le profil local avec les infos d'arène
            if (this.playerProfile) {
                this.playerProfile.arenaInfo = data;
                this.triggerCallback('onProfileUpdated', this.playerProfile);
            }
        });
        
        this.worldRoom.onMessage("search_started", (data) => {
            console.log('📨 Recherche commencée:', data.message);
            this.triggerCallback('onSearchStarted', data);
        });
        
        this.worldRoom.onMessage("search_cancelled", (data) => {
            console.log('📨 Recherche annulée:', data.message);
            this.triggerCallback('onSearchCancelled', data);
        });
        
        this.worldRoom.onMessage("match_found", (data) => {
            console.log('📨 Match trouvé:', data);
            this.triggerCallback('onMatchFound', data);
        });
        
        this.worldRoom.onMessage("battle_result", (data) => {
            console.log('📨 Résultat bataille:', data);
            // Mettre à jour le profil local
            if (this.playerProfile) {
                this.playerProfile.trophies = data.newTrophies;
                if (data.newArena) {
                    this.playerProfile.currentArena = data.newArena;
                }
            }
            this.triggerCallback('onBattleResult', data);
        });
        
        this.worldRoom.onMessage("leaderboard", (data) => {
            console.log('📨 Leaderboard reçu:', data.players.length, 'joueurs');
            this.triggerCallback('onLeaderboard', data);
        });
        
        this.worldRoom.onMessage("error", (data) => {
            console.error('📨 Erreur serveur:', data.message);
            this.triggerCallback('onError', data.message);
        });
        
        this.worldRoom.onMessage("heartbeat_ack", (data) => {
            // Heartbeat silencieux
        });
        
        // 🔌 Déconnexion
        this.worldRoom.onLeave((code) => {
            console.log(`🔌 Déconnecté de la WorldRoom (code: ${code})`);
            this.isConnected = false;
            this.worldRoom = null;
            
            this.triggerCallback('onDisconnected', code);
            
            // Tentative de reconnexion si ce n'est pas volontaire
            if (code !== 1000) {
                this.scheduleReconnect();
            }
        });
        
        // 🔧 Erreur de room
        this.worldRoom.onError((code, message) => {
            console.error(`🔧 Erreur WorldRoom (${code}):`, message);
            this.triggerCallback('onError', `Erreur room: ${message}`);
        });
    }
    
    /**
     * 📊 METTRE À JOUR LES STATS GLOBALES
     */
    updateGlobalStats(state) {
        this.globalStats = {
            totalPlayers: state.totalPlayers || 0,
            playersOnline: state.playersOnline || 0,
            playersSearching: state.playersSearching || 0
        };
        this.triggerCallback('onGlobalStatsUpdated', this.globalStats);
    }
    
    /**
     * 👥 METTRE À JOUR LA MAP DES JOUEURS
     */
    updatePlayersMap(playersMap) {
        this.worldPlayers.clear();
        if (playersMap) {
            playersMap.forEach((player, sessionId) => {
                this.worldPlayers.set(sessionId, player);
            });
        }
        this.triggerCallback('onPlayersUpdated', this.worldPlayers);
    }
    
    /**
     * 🔄 RECONNEXION AUTOMATIQUE
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Trop de tentatives de reconnexion, abandon');
            this.triggerCallback('onError', 'Connexion impossible après plusieurs tentatives');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Backoff exponentiel
        
        console.log(`🔄 Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(() => {
            if (!this.isConnected && auth.isAuthenticated()) {
                this.connect();
            }
        }, delay);
    }
    
    /**
     * 🔌 DÉCONNEXION VOLONTAIRE
     */
    async disconnect() {
        console.log('🔌 Déconnexion volontaire de Colyseus');
        
        this.isConnected = false;
        this.reconnectAttempts = this.maxReconnectAttempts; // Empêcher la reconnexion auto
        
        if (this.worldRoom) {
            try {
                await this.worldRoom.leave();
            } catch (error) {
                console.warn('⚠️ Erreur lors de la déconnexion:', error);
            }
            this.worldRoom = null;
        }
        
        if (this.client) {
            this.client = null;
        }
        
        // Nettoyer les données
        this.playerProfile = null;
        this.worldPlayers.clear();
        
        this.triggerCallback('onDisconnected', 1000);
    }
    
    /**
     * 📨 ENVOYER UN MESSAGE À LA WORLDROOM
     */
    sendMessage(type, data = {}) {
        if (!this.isConnected || !this.worldRoom) {
            console.warn(`⚠️ Impossible d'envoyer ${type}, pas connecté`);
            return false;
        }
        
        try {
            this.worldRoom.send(type, data);
            console.log(`📨 Message envoyé: ${type}`, data);
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
        return this.sendMessage("search_battle");
    }
    
    cancelSearch() {
        return this.sendMessage("cancel_search");
    }
    
    requestArenaInfo() {
        return this.sendMessage("get_arena_info");
    }
    
    requestLeaderboard(limit = 50) {
        return this.sendMessage("get_leaderboard", { limit });
    }
    
    updateStatus(status) {
        return this.sendMessage("update_status", { status });
    }
    
    /**
     * 💓 HEARTBEAT
     */
    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        
        this.heartbeatInterval = setInterval(() => {
            if (this.isConnected) {
                this.sendMessage("heartbeat", { timestamp: Date.now() });
            }
        }, 30000); // Toutes les 30 secondes
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    /**
     * 🔧 GESTION DES CALLBACKS
     */
    on(event, callback) {
        if (this.callbacks.hasOwnProperty('on' + event.charAt(0).toUpperCase() + event.slice(1))) {
            this.callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)] = callback;
        } else {
            console.warn(`⚠️ Événement non reconnu: ${event}`);
        }
    }
    
    off(event) {
        if (this.callbacks.hasOwnProperty('on' + event.charAt(0).toUpperCase() + event.slice(1))) {
            this.callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)] = null;
        }
    }
    
    triggerCallback(callbackName, data = null) {
        const callback = this.callbacks[callbackName];
        if (callback && typeof callback === 'function') {
            try {
                callback(data);
            } catch (error) {
                console.error(`❌ Erreur callback ${callbackName}:`, error);
            }
        }
    }
    
    /**
     * 📊 GETTERS POUR L'ÉTAT ACTUEL
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
        return this.isConnected;
    }
    
    /**
     * 🧹 NETTOYAGE
     */
    destroy() {
        console.log('🧹 Destruction ColyseusManager');
        this.stopHeartbeat();
        this.disconnect();
        
        // Nettoyer les callbacks
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = null;
        });
    }
}

// Instance singleton
const colyseusManager = new ColyseusManager();

export default colyseusManager;
