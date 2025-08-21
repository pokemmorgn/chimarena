// client/src/managers/ColyseusManager.js - CORRECTION RECONNEXIONS MULTIPLES
import { Client } from 'colyseus.js';
import { auth, tokenManager } from '../api';

class ColyseusManager {
    constructor() {
        this.client = null;
        this.worldRoom = null;
        this.isConnected = false;
        this.isConnecting = false;
        this.isReady = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 3; // ✅ RÉDUIT de 5 à 3
        this.reconnectDelay = 3000; // ✅ AUGMENTÉ de 2s à 3s
        
        // ✅ NOUVEAU: Timeout de connexion
        this.connectionTimeout = null;
        this.readyTimeout = null;
        
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
        
        // Debug
        if (window.GameConfig?.DEBUG) {
            window.debugColyseusManager = this;
            console.log('🔧 ColyseusManager exposé pour debug');
        }
    }
    
    /**
     * 🔐 OBTENIR LE TOKEN JWT
     */
    getAuthToken() {
        const token = tokenManager.getToken();
        if (token) {
            console.log("🔑 Token récupéré (longueur:", token.length, ")");
            return token;
        }
        console.error("❌ Aucun token disponible !");
        return null;
    }
    
    /**
     * Obtenir l'URL du serveur Colyseus
     */
    getServerUrl() {
        if (typeof window !== 'undefined' && window.GameConfig?.COLYSEUS_URL) {
            return window.GameConfig.COLYSEUS_URL;
        }

        const host = window.location.hostname || 'chimarena.cloud';
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const calculatedUrl = `${protocol}://${host}/ws`;
        
        console.log('🔧 URL calculée:', calculatedUrl);
        return calculatedUrl;
    }
    
    /**
     * 🔌 CONNEXION AVEC PROTECTION CONTRE LES MULTIPLES TENTATIVES
     */
    async connect() {
        console.log('🔌 === DÉBUT CONNEXION COLYSEUS ===');
        
        // ✅ PROTECTION: Empêcher les connexions multiples
        if (this.isConnecting) {
            console.warn('⚠️ Connexion déjà en cours, annulation');
            return false;
        }
        
        if (this.isConnected) {
            console.warn('⚠️ Déjà connecté');
            return true;
        }
        
        // ✅ NOUVEAU: Nettoyer complètement avant de reconnecter
        await this.forceDisconnect();
        
        // Vérifier authentification
        if (!auth.isAuthenticated()) {
            console.error('❌ Pas d\'authentification pour Colyseus');
            this.triggerCallback('onError', 'Authentification requise');
            return false;
        }
        
        try {
            this.isConnecting = true;
            this.isReady = false;
            
            // ✅ NOUVEAU: Timeout de connexion pour éviter les blocages
            this.connectionTimeout = setTimeout(() => {
                if (this.isConnecting) {
                    console.error('⏰ TIMEOUT CONNEXION (10s)');
                    this.handleConnectionTimeout();
                }
            }, 10000);
            
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
            
            // ✅ Nettoyer le timeout de connexion
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            // Configurer les handlers
            this.setupRoomHandlers();
            
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            
            console.log('✅ === CONNEXION COLYSEUS RÉUSSIE ===');
            return true;
            
        } catch (error) {
            console.error('❌ === ERREUR CONNEXION COLYSEUS ===');
            console.error('❌ Message:', error.message);
            
            // Nettoyer les timeouts
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            this.isConnecting = false;
            this.isConnected = false;
            this.isReady = false;
            
            this.triggerCallback('onError', `Connexion échouée: ${error.message}`);
            
            // ✅ PROTECTION: Pas de reconnexion immédiate si trop d'erreurs
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            } else {
                console.error('❌ TROP DE TENTATIVES DE CONNEXION - ARRÊT');
                this.triggerCallback('onError', 'Impossible de se connecter au serveur');
            }
            
            return false;
        }
    }
    
    /**
     * ✅ NOUVEAU: Gérer le timeout de connexion
     */
    handleConnectionTimeout() {
        console.error('⏰ TIMEOUT DE CONNEXION');
        this.isConnecting = false;
        this.isConnected = false;
        this.isReady = false;
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Forcer la déconnexion
        this.forceDisconnect();
        
        this.triggerCallback('onError', 'Timeout de connexion');
        this.scheduleReconnect();
    }
    
    /**
     * ✅ CONFIGURATION DES HANDLERS AVEC TIMEOUTS
     */
    setupRoomHandlers() {
        if (!this.worldRoom) {
            console.error('❌ worldRoom non disponible pour setup handlers');
            return;
        }
        
        console.log('🔧 Configuration des handlers WorldRoom...');
        
        // Handler pour confirmation serveur prêt
        this.worldRoom.onMessage("server_ready", (data) => {
            console.log('✅ SERVEUR PRÊT - Finalisation...');
            
            // Nettoyer le timeout ready
            if (this.readyTimeout) {
                clearTimeout(this.readyTimeout);
                this.readyTimeout = null;
            }
            
            this.isReady = true;
            this.triggerCallback('onConnected');
        });
        
        // ✅ ATTENDRE L'ÉTAT INITIAL
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
                    console.log(`👤 PLAYER AJOUTÉ: ${player.username} (${sessionId})`);
                    this.worldPlayers.set(sessionId, player);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                });
                
                state.players.onRemove((player, sessionId) => {
                    console.log(`👤 PLAYER SUPPRIMÉ: ${player.username} (${sessionId})`);
                    this.worldPlayers.delete(sessionId);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                });
                
                state.players.onChange((player, sessionId) => {
                    console.log(`👤 PLAYER MODIFIÉ: ${player.username} (${player.status})`);
                    this.worldPlayers.set(sessionId, player);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                });
                
                console.log('✅ Handlers players configurés');
            }
            
            // ✅ ATTENDRE UN PEU avant de signaler ready
            setTimeout(() => {
                console.log('📡 ENVOI SIGNAL CLIENT_READY...');
                
                // ✅ NOUVEAU: Timeout pour le signal ready
                this.readyTimeout = setTimeout(() => {
                    if (!this.isReady) {
                        console.error('⏰ TIMEOUT SIGNAL READY (5s)');
                        this.triggerCallback('onError', 'Timeout signal ready');
                    }
                }, 5000);
                
                this.worldRoom.send("client_ready", { 
                    timestamp: Date.now(),
                    clientVersion: "1.0.0"
                });
            }, 500); // ✅ AUGMENTÉ de 100ms à 500ms
        });
        
        // Changements d'état suivants
        this.worldRoom.onStateChange((state) => {
            this.updateGlobalStats(state);
            this.updatePlayersMap(state.players);
        });
        
        // Messages du serveur
        this.worldRoom.onMessage("player_profile", (data) => {
            console.log('📨 PROFIL REÇU:', data.profile.username);
            this.playerProfile = data.profile;
            this.triggerCallback('onProfileUpdated', this.playerProfile);
        });
        
        this.worldRoom.onMessage("arena_info", (data) => {
            console.log('📨 INFO ARÈNE REÇUE');
            if (this.playerProfile) {
                this.playerProfile.arenaInfo = data;
                this.triggerCallback('onProfileUpdated', this.playerProfile);
            }
        });
        
        this.worldRoom.onMessage("search_started", (data) => {
            console.log('📨 RECHERCHE COMMENCÉE');
            this.triggerCallback('onSearchStarted', data);
        });
        
        this.worldRoom.onMessage("search_cancelled", (data) => {
            console.log('📨 RECHERCHE ANNULÉE');
            this.triggerCallback('onSearchCancelled', data);
        });
        
        this.worldRoom.onMessage("match_found", (data) => {
            console.log('📨 MATCH TROUVÉ');
            this.triggerCallback('onMatchFound', data);
        });
        
        this.worldRoom.onMessage("battle_result", (data) => {
            console.log('📨 RÉSULTAT BATAILLE');
            if (this.playerProfile) {
                this.playerProfile.trophies = data.newTrophies;
                if (data.newArena) {
                    this.playerProfile.currentArena = data.newArena;
                }
            }
            this.triggerCallback('onBattleResult', data);
        });
        
        this.worldRoom.onMessage("leaderboard", (data) => {
            console.log('📨 LEADERBOARD REÇU');
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
        
        // ✅ DÉCONNEXION AVEC NETTOYAGE
        this.worldRoom.onLeave((code) => {
            console.log(`🔌 DÉCONNECTÉ (code: ${code})`);
            
            this.cleanupConnection();
            this.triggerCallback('onDisconnected', code);
            
            // Reconnexion seulement si pas volontaire et pas trop d'erreurs
            if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            }
        });
        
        this.worldRoom.onError((code, message) => {
            console.error(`🔧 ERREUR WORLDROOM: ${code} - ${message}`);
            this.triggerCallback('onError', `Erreur room: ${message}`);
        });
        
        console.log('✅ Handlers configurés');
    }
    
    /**
     * ✅ NOUVEAU: Nettoyage complet de la connexion
     */
    cleanupConnection() {
        this.isConnected = false;
        this.isReady = false;
        this.worldRoom = null;
        
        // Nettoyer les timeouts
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        if (this.readyTimeout) {
            clearTimeout(this.readyTimeout);
            this.readyTimeout = null;
        }
    }
    
    /**
     * 🔄 RECONNEXION AVEC BACKOFF EXPONENTIEL
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ TROP DE TENTATIVES DE RECONNEXION');
            this.triggerCallback('onError', 'Connexion impossible après plusieurs tentatives');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`🔄 RECONNEXION PROGRAMMÉE: tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${Math.round(delay / 1000)}s`);
        
        setTimeout(() => {
            if (!this.isConnected && !this.isConnecting && auth.isAuthenticated()) {
                console.log('🔄 TENTATIVE DE RECONNEXION...');
                this.connect();
            } else {
                console.log('🔄 RECONNEXION ANNULÉE (déjà connecté ou pas authentifié)');
            }
        }, delay);
    }
    
    /**
     * ✅ NOUVEAU: Déconnexion forcée (nettoyage complet)
     */
    async forceDisconnect() {
        console.log('🧹 DÉCONNEXION FORCÉE');
        
        // Nettoyer les timeouts
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        if (this.readyTimeout) {
            clearTimeout(this.readyTimeout);
            this.readyTimeout = null;
        }
        
        // Fermer la room
        if (this.worldRoom) {
            try {
                await this.worldRoom.leave();
                console.log('✅ Room fermée');
            } catch (error) {
                console.warn('⚠️ Erreur fermeture room:', error);
            }
            this.worldRoom = null;
        }
        
        // Fermer le client
        if (this.client) {
            try {
                this.client = null;
            } catch (error) {
                console.warn('⚠️ Erreur fermeture client:', error);
            }
        }
        
        // Reset des états
        this.isConnected = false;
        this.isConnecting = false;
        this.isReady = false;
        
        // Nettoyer les données
        this.playerProfile = null;
        this.worldPlayers.clear();
        
        console.log('✅ Déconnexion forcée terminée');
    }
    
    /**
     * 🔌 DÉCONNEXION VOLONTAIRE
     */
    async disconnect() {
        console.log('🔌 DÉCONNEXION VOLONTAIRE');
        
        this.reconnectAttempts = this.maxReconnectAttempts; // Empêcher reconnexion auto
        await this.forceDisconnect();
        this.triggerCallback('onDisconnected', 1000);
    }
    
    /**
     * 📨 ENVOYER UN MESSAGE - AVEC VÉRIFICATIONS
     */
    sendMessage(type, data = {}) {
        if (!this.isConnected || !this.worldRoom) {
            console.warn(`⚠️ Impossible d'envoyer ${type}, pas connecté`);
            return false;
        }
        
        // Vérifier si ready pour certains messages
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
     * 📊 MISE À JOUR DES STATS GLOBALES
     */
    updateGlobalStats(state) {
        const oldStats = { ...this.globalStats };
        
        this.globalStats = {
            totalPlayers: state.totalPlayers || 0,
            playersOnline: state.playersOnline || 0,
            playersSearching: state.playersSearching || 0
        };
        
        if (JSON.stringify(oldStats) !== JSON.stringify(this.globalStats)) {
            console.log('📊 STATS MISES À JOUR:', this.globalStats);
        }
        
        this.triggerCallback('onGlobalStatsUpdated', this.globalStats);
    }
    
    /**
     * 👥 MISE À JOUR DE LA MAP DES JOUEURS
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
            console.log('👥 JOUEURS MIS À JOUR:', this.worldPlayers.size);
        }
        
        this.triggerCallback('onPlayersUpdated', this.worldPlayers);
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
            if (this.isConnected && this.worldRoom) {
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
    
    /**
     * 🔧 GESTION DES CALLBACKS
     */
    on(event, callback) {
        const callbackName = 'on' + event.charAt(0).toUpperCase() + event.slice(1);
        if (this.callbacks.hasOwnProperty(callbackName)) {
            this.callbacks[callbackName] = callback;
        }
    }
    
    off(event) {
        const callbackName = 'on' + event.charAt(0).toUpperCase() + event.slice(1);
        if (this.callbacks.hasOwnProperty(callbackName)) {
            this.callbacks[callbackName] = null;
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
        return this.isConnected && this.isReady;
    }
    
    /**
     * 🔍 DEBUG INFO
     */
    getDebugInfo() {
        return {
            isConnected: this.isConnected,
            isReady: this.isReady,
            isConnecting: this.isConnecting,
            hasClient: !!this.client,
            hasRoom: !!this.worldRoom,
            sessionId: this.worldRoom?.sessionId,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            serverUrl: this.serverUrl,
            playersCount: this.worldPlayers.size,
            globalStats: this.globalStats,
            hasConnectionTimeout: !!this.connectionTimeout,
            hasReadyTimeout: !!this.readyTimeout
        };
    }
    
    /**
     * 🧹 NETTOYAGE COMPLET
     */
    destroy() {
        console.log('🧹 DESTRUCTION COLYSEUSMANAGER');
        
        this.stopHeartbeat();
        this.forceDisconnect();
        
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = null;
        });
        
        console.log('✅ ColyseusManager détruit');
    }
}

// Instance singleton
const colyseusManager = new ColyseusManager();

export default colyseusManager;
