// client/src/managers/ColyseusManager.js - DEBUG RECONNEXIONS EN BOUCLE
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
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 3000;
        
        // Timeouts
        this.connectionTimeout = null;
        this.readyTimeout = null;
        this.reconnectTimeout = null; // ✅ NOUVEAU: Tracker du timeout de reconnexion
        
        // ✅ NOUVEAU: Debug tracking
        this.connectionHistory = [];
        this.lastDisconnectReason = null;
        this.consecutiveFailures = 0;
        
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
     * ✅ NOUVEAU: Ajouter à l'historique de connexion
     */
    addToConnectionHistory(event, details = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            event,
            details,
            state: {
                isConnected: this.isConnected,
                isConnecting: this.isConnecting,
                isReady: this.isReady,
                reconnectAttempts: this.reconnectAttempts
            }
        };
        
        this.connectionHistory.unshift(entry);
        
        // Garder seulement les 20 dernières entrées
        if (this.connectionHistory.length > 20) {
            this.connectionHistory = this.connectionHistory.slice(0, 20);
        }
        
        console.log(`📊 [${event}]`, details);
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
     * 🔌 CONNEXION AVEC DEBUG DÉTAILLÉ
     */
    async connect() {
        this.addToConnectionHistory('CONNECT_ATTEMPT', {
            reason: 'Manuel ou auto-reconnect',
            authStatus: auth.isAuthenticated(),
            hasToken: !!this.getAuthToken()
        });
        
        // ✅ PROTECTION RENFORCÉE
        if (this.isConnecting) {
            console.warn('⚠️ CONNEXION DÉJÀ EN COURS - ANNULATION');
            this.addToConnectionHistory('CONNECT_BLOCKED', { reason: 'isConnecting = true' });
            return false;
        }
        
        if (this.isConnected) {
            console.warn('⚠️ DÉJÀ CONNECTÉ - VÉRIFICATION');
            this.addToConnectionHistory('CONNECT_BLOCKED', { reason: 'isConnected = true' });
            
            // ✅ NOUVEAU: Vérifier si vraiment connecté
            if (this.worldRoom && this.worldRoom.connection && this.worldRoom.connection.readyState === WebSocket.OPEN) {
                console.log('✅ Connexion vraiment active');
                return true;
            } else {
                console.warn('⚠️ Connexion corrompue, nettoyage...');
                this.addToConnectionHistory('CONNECT_CLEANUP', { reason: 'Connexion corrompue' });
                this.cleanupConnection();
            }
        }
        
        // ✅ NOUVEAU: Empêcher les tentatives trop fréquentes
        const lastAttempt = this.connectionHistory.find(h => h.event === 'CONNECT_ATTEMPT');
        if (lastAttempt) {
            const timeSinceLastAttempt = Date.now() - new Date(lastAttempt.timestamp).getTime();
            if (timeSinceLastAttempt < 1000) { // Moins d'1 seconde
                console.warn('⚠️ TENTATIVE TROP FRÉQUENTE - ATTENTE');
                this.addToConnectionHistory('CONNECT_BLOCKED', { 
                    reason: 'Tentative trop fréquente',
                    timeSinceLastAttempt 
                });
                return false;
            }
        }
        
        // Nettoyer complètement avant de reconnecter
        await this.forceDisconnect();
        
        // Vérifier authentification
        if (!auth.isAuthenticated()) {
            console.error('❌ Pas d\'authentification pour Colyseus');
            this.addToConnectionHistory('CONNECT_FAILED', { reason: 'Pas authentifié' });
            this.triggerCallback('onError', 'Authentification requise');
            return false;
        }
        
        try {
            this.isConnecting = true;
            this.isReady = false;
            
            this.addToConnectionHistory('CONNECT_START', {
                serverUrl: this.serverUrl,
                attempt: this.reconnectAttempts + 1
            });
            
            // Timeout de connexion
            this.connectionTimeout = setTimeout(() => {
                if (this.isConnecting) {
                    console.error('⏰ TIMEOUT CONNEXION (10s)');
                    this.addToConnectionHistory('CONNECT_TIMEOUT', { duration: '10s' });
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
            
            this.addToConnectionHistory('CONNECT_SUCCESS', {
                sessionId: this.worldRoom.sessionId,
                roomId: this.worldRoom.id
            });
            
            // Nettoyer le timeout de connexion
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            // Configurer les handlers
            this.setupRoomHandlers();
            
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            this.consecutiveFailures = 0;
            
            console.log('✅ === CONNEXION COLYSEUS RÉUSSIE ===');
            return true;
            
        } catch (error) {
            console.error('❌ === ERREUR CONNEXION COLYSEUS ===');
            console.error('❌ Message:', error.message);
            
            this.addToConnectionHistory('CONNECT_ERROR', {
                error: error.message,
                stack: error.stack?.split('\n').slice(0, 3)
            });
            
            // Nettoyer les timeouts
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            
            this.isConnecting = false;
            this.isConnected = false;
            this.isReady = false;
            this.consecutiveFailures++;
            
            this.triggerCallback('onError', `Connexion échouée: ${error.message}`);
            
            // ✅ PROTECTION: Plus de reconnexion si trop d'échecs consécutifs
            if (this.consecutiveFailures >= 5) {
                console.error('❌ TROP D\'ÉCHECS CONSÉCUTIFS - ARRÊT TOTAL');
                this.addToConnectionHistory('CONNECT_ABANDONED', { 
                    consecutiveFailures: this.consecutiveFailures 
                });
                this.triggerCallback('onError', 'Connexion abandonnée après trop d\'échecs');
                return false;
            }
            
            // Programmer reconnexion si pas trop de tentatives
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                this.scheduleReconnect();
            } else {
                console.error('❌ TROP DE TENTATIVES DE CONNEXION - ARRÊT');
                this.addToConnectionHistory('CONNECT_ABANDONED', { 
                    reason: 'Trop de tentatives',
                    attempts: this.reconnectAttempts 
                });
                this.triggerCallback('onError', 'Impossible de se connecter au serveur');
            }
            
            return false;
        }
    }
    
    /**
     * ✅ GESTION TIMEOUT AVEC DEBUG
     */
    handleConnectionTimeout() {
        console.error('⏰ TIMEOUT DE CONNEXION');
        this.addToConnectionHistory('TIMEOUT_HANDLED', {
            wasConnecting: this.isConnecting,
            hasRoom: !!this.worldRoom,
            hasClient: !!this.client
        });
        
        this.isConnecting = false;
        this.isConnected = false;
        this.isReady = false;
        this.consecutiveFailures++;
        
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
        
        // Forcer la déconnexion
        this.forceDisconnect();
        
        this.triggerCallback('onError', 'Timeout de connexion');
        
        // Programmer reconnexion si autorisé
        if (this.consecutiveFailures < 3 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        }
    }
    
    /**
     * ✅ CONFIGURATION DES HANDLERS AVEC DEBUG
     */
    setupRoomHandlers() {
        if (!this.worldRoom) {
            console.error('❌ worldRoom non disponible pour setup handlers');
            return;
        }
        
        console.log('🔧 Configuration des handlers WorldRoom...');
        this.addToConnectionHistory('HANDLERS_SETUP_START');
        
        // Handler pour confirmation serveur prêt
        this.worldRoom.onMessage("server_ready", (data) => {
            console.log('✅ SERVEUR PRÊT - Finalisation...');
            this.addToConnectionHistory('SERVER_READY', data);
            
            // Nettoyer le timeout ready
            if (this.readyTimeout) {
                clearTimeout(this.readyTimeout);
                this.readyTimeout = null;
            }
            
            this.isReady = true;
            this.triggerCallback('onConnected');
        });
        
        // Attendre l'état initial
        this.worldRoom.onStateChange.once((state) => {
            console.log('📊 PREMIER ÉTAT REÇU:', {
                totalPlayers: state.totalPlayers,
                playersOnline: state.playersOnline,
                playersSearching: state.playersSearching,
                playersSize: state.players?.size || 0
            });
            
            this.addToConnectionHistory('FIRST_STATE_RECEIVED', {
                totalPlayers: state.totalPlayers,
                playersCount: state.players?.size || 0
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
            
            // Attendre avant de signaler ready
            setTimeout(() => {
                console.log('📡 ENVOI SIGNAL CLIENT_READY...');
                this.addToConnectionHistory('CLIENT_READY_SENT');
                
                // Timeout pour le signal ready
                this.readyTimeout = setTimeout(() => {
                    if (!this.isReady) {
                        console.error('⏰ TIMEOUT SIGNAL READY (5s)');
                        this.addToConnectionHistory('READY_TIMEOUT');
                        this.triggerCallback('onError', 'Timeout signal ready');
                    }
                }, 5000);
                
                if (this.worldRoom) {
                    this.worldRoom.send("client_ready", { 
                        timestamp: Date.now(),
                        clientVersion: "1.0.0"
                    });
                } else {
                    console.error('❌ WorldRoom perdue avant envoi client_ready');
                    this.addToConnectionHistory('READY_FAILED', { reason: 'WorldRoom perdue' });
                }
            }, 500);
        });
        
        // Changements d'état suivants
        this.worldRoom.onStateChange((state) => {
            this.updateGlobalStats(state);
            this.updatePlayersMap(state.players);
        });
        
        // Messages du serveur (simplifiés pour debug)
        const messageTypes = ["player_profile", "arena_info", "search_started", "search_cancelled", "match_found", "battle_result", "leaderboard", "error", "search_error"];
        
        messageTypes.forEach(messageType => {
            this.worldRoom.onMessage(messageType, (data) => {
                console.log(`📨 MESSAGE REÇU: ${messageType}`);
                this.handleServerMessage(messageType, data);
            });
        });
        
        this.worldRoom.onMessage("heartbeat_ack", (data) => {
            // Heartbeat silencieux
        });
        
        // ✅ DÉCONNEXION AVEC DEBUG DÉTAILLÉ
        this.worldRoom.onLeave((code) => {
            console.log(`🔌 DÉCONNECTÉ (code: ${code})`);
            
            this.addToConnectionHistory('DISCONNECTED', {
                code,
                reason: this.getLeaveCodeDescription(code),
                wasReady: this.isReady,
                voluntary: code === 1000
            });
            
            this.lastDisconnectReason = code;
            this.cleanupConnection();
            this.triggerCallback('onDisconnected', code);
            
            // ✅ DÉCISION DE RECONNEXION AVEC LOGIC CLAIRE
            const shouldReconnect = this.shouldAttemptReconnect(code);
            console.log(`🤔 Reconnexion ? ${shouldReconnect}`, {
                code,
                voluntary: code === 1000,
                attempts: this.reconnectAttempts,
                maxAttempts: this.maxReconnectAttempts,
                consecutiveFailures: this.consecutiveFailures
            });
            
            if (shouldReconnect) {
                this.scheduleReconnect();
            } else {
                this.addToConnectionHistory('RECONNECT_SKIPPED', {
                    reason: 'shouldAttemptReconnect = false',
                    code
                });
            }
        });
        
        this.worldRoom.onError((code, message) => {
            console.error(`🔧 ERREUR WORLDROOM: ${code} - ${message}`);
            this.addToConnectionHistory('ROOM_ERROR', { code, message });
            this.triggerCallback('onError', `Erreur room: ${message}`);
        });
        
        console.log('✅ Handlers configurés');
        this.addToConnectionHistory('HANDLERS_SETUP_COMPLETE');
    }
    
    /**
     * ✅ NOUVEAU: Décider si on doit tenter une reconnexion
     */
    shouldAttemptReconnect(code) {
        // Jamais reconnecter si déconnexion volontaire
        if (code === 1000) {
            return false;
        }
        
        // Jamais reconnecter si trop de tentatives
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            return false;
        }
        
        // Jamais reconnecter si trop d'échecs consécutifs
        if (this.consecutiveFailures >= 3) {
            return false;
        }
        
        // Jamais reconnecter si pas authentifié
        if (!auth.isAuthenticated()) {
            return false;
        }
        
        // Jamais reconnecter si déjà en cours de reconnexion
        if (this.reconnectTimeout) {
            return false;
        }
        
        return true;
    }
    
    /**
     * ✅ TRAITEMENT DES MESSAGES SERVEUR
     */
    handleServerMessage(type, data) {
        switch (type) {
            case "player_profile":
                this.playerProfile = data.profile;
                this.triggerCallback('onProfileUpdated', this.playerProfile);
                break;
            case "arena_info":
                if (this.playerProfile) {
                    this.playerProfile.arenaInfo = data;
                    this.triggerCallback('onProfileUpdated', this.playerProfile);
                }
                break;
            case "search_started":
                this.triggerCallback('onSearchStarted', data);
                break;
            case "search_cancelled":
                this.triggerCallback('onSearchCancelled', data);
                break;
            case "match_found":
                this.triggerCallback('onMatchFound', data);
                break;
            case "battle_result":
                if (this.playerProfile) {
                    this.playerProfile.trophies = data.newTrophies;
                    if (data.newArena) {
                        this.playerProfile.currentArena = data.newArena;
                    }
                }
                this.triggerCallback('onBattleResult', data);
                break;
            case "leaderboard":
                this.triggerCallback('onLeaderboard', data);
                break;
            case "error":
            case "search_error":
                this.triggerCallback('onError', data.message);
                break;
        }
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
            4000: 'Erreur personnalisée serveur',
            4001: 'Nouvelle connexion détectée'
        };
        return codes[code] || `Code inconnu: ${code}`;
    }
    
    /**
     * ✅ NETTOYAGE COMPLET
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
        
        this.addToConnectionHistory('CONNECTION_CLEANED');
    }
    
    /**
     * 🔄 RECONNEXION AVEC DEBUG
     */
    scheduleReconnect() {
        // ✅ PROTECTION: Pas de double reconnexion
        if (this.reconnectTimeout) {
            console.warn('⚠️ RECONNEXION DÉJÀ PROGRAMMÉE');
            this.addToConnectionHistory('RECONNECT_SKIPPED', { reason: 'Déjà programmée' });
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
        
        console.log(`🔄 RECONNEXION PROGRAMMÉE: tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${Math.round(delay / 1000)}s`);
        
        this.addToConnectionHistory('RECONNECT_SCHEDULED', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            delay: delay,
            delaySeconds: Math.round(delay / 1000)
        });
        
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null; // ✅ IMPORTANT: Reset du timeout
            
            this.addToConnectionHistory('RECONNECT_EXECUTING');
            
            if (!this.isConnected && !this.isConnecting && auth.isAuthenticated()) {
                console.log('🔄 EXÉCUTION RECONNEXION...');
                this.connect();
            } else {
                console.log('🔄 RECONNEXION ANNULÉE:', {
                    isConnected: this.isConnected,
                    isConnecting: this.isConnecting,
                    isAuthenticated: auth.isAuthenticated()
                });
                this.addToConnectionHistory('RECONNECT_CANCELLED', {
                    isConnected: this.isConnected,
                    isConnecting: this.isConnecting,
                    isAuthenticated: auth.isAuthenticated()
                });
            }
        }, delay);
    }
    
    /**
     * ✅ DÉCONNEXION FORCÉE
     */
    async forceDisconnect() {
        console.log('🧹 DÉCONNEXION FORCÉE');
        this.addToConnectionHistory('FORCE_DISCONNECT_START');
        
        // ✅ NOUVEAU: Annuler la reconnexion programmée
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
            console.log('🛑 Reconnexion programmée annulée');
        }
        
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
        
        this.addToConnectionHistory('FORCE_DISCONNECT_COMPLETE');
        console.log('✅ Déconnexion forcée terminée');
    }
    
    /**
     * 🔌 DÉCONNEXION VOLONTAIRE
     */
    async disconnect() {
        console.log('🔌 DÉCONNEXION VOLONTAIRE');
        this.addToConnectionHistory('VOLUNTARY_DISCONNECT');
        
        this.reconnectAttempts = this.maxReconnectAttempts; // Empêcher reconnexion auto
        await this.forceDisconnect();
        this.triggerCallback('onDisconnected', 1000);
    }
    
    /**
     * 📨 ENVOYER UN MESSAGE
     */
    sendMessage(type, data = {}) {
        if (!this.isConnected || !this.worldRoom) {
            console.warn(`⚠️ Impossible d'envoyer ${type}, pas connecté`);
            return false;
        }
        
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
     * 📊 MISE À JOUR DES STATS
     */
    updateGlobalStats(state) {
        this.globalStats = {
            totalPlayers: state.totalPlayers || 0,
            playersOnline: state.playersOnline || 0,
            playersSearching: state.playersSearching || 0
        };
        this.triggerCallback('onGlobalStatsUpdated', this.globalStats);
    }
    
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
     * ⚔️ ACTIONS
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
     * 🔧 CALLBACKS
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
     * ✅ NOUVEAU: Debug détaillé
     */
    getDebugInfo() {
        return {
            // États actuels
            isConnected: this.isConnected,
            isReady: this.isReady,
            isConnecting: this.isConnecting,
            
            // Objets
            hasClient: !!this.client,
            hasRoom: !!this.worldRoom,
            sessionId: this.worldRoom?.sessionId,
            
            // Reconnexion
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts,
            consecutiveFailures: this.consecutiveFailures,
            lastDisconnectReason: this.lastDisconnectReason,
            
            // Timeouts actifs
            hasConnectionTimeout: !!this.connectionTimeout,
            hasReadyTimeout: !!this.readyTimeout,
            hasReconnectTimeout: !!this.reconnectTimeout,
            
            // Données
            serverUrl: this.serverUrl,
            playersCount: this.worldPlayers.size,
            globalStats: this.globalStats,
            hasProfile: !!this.playerProfile,
            
            // Historique (5 dernières entrées)
            recentHistory: this.connectionHistory.slice(0, 5),
            
            // WebSocket state si disponible
            websocketState: this.worldRoom?.connection?.readyState,
            websocketStateText: this.getWebSocketStateText()
        };
    }
    
    /**
     * ✅ NOUVEAU: Texte état WebSocket
     */
    getWebSocketStateText() {
        if (!this.worldRoom?.connection) return 'Pas de connexion';
        
        switch (this.worldRoom.connection.readyState) {
            case WebSocket.CONNECTING: return 'CONNECTING';
            case WebSocket.OPEN: return 'OPEN';
            case WebSocket.CLOSING: return 'CLOSING';
            case WebSocket.CLOSED: return 'CLOSED';
            default: return 'UNKNOWN';
        }
    }
    
    /**
     * ✅ NOUVEAU: Afficher l'historique de connexion
     */
    printConnectionHistory() {
        console.group('📊 HISTORIQUE CONNEXION');
        this.connectionHistory.forEach((entry, index) => {
            console.log(`${index + 1}. [${entry.timestamp}] ${entry.event}`, entry.details);
        });
        console.groupEnd();
    }
    
    /**
     * ✅ NOUVEAU: Forcer un arrêt complet
     */
    emergencyStop() {
        console.warn('🚨 ARRÊT D\'URGENCE COLYSEUS');
        this.addToConnectionHistory('EMERGENCY_STOP');
        
        // Empêcher toute reconnexion
        this.reconnectAttempts = this.maxReconnectAttempts + 10;
        this.consecutiveFailures = 10;
        
        // Annuler toutes les reconnexions
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        // Déconnexion forcée
        this.forceDisconnect();
        
        console.log('🛑 Arrêt d\'urgence terminé');
    }
    
    /**
     * ✅ NOUVEAU: Reset complet pour redémarrer
     */
    fullReset() {
        console.log('🔄 RESET COMPLET COLYSEUS');
        this.addToConnectionHistory('FULL_RESET');
        
        // Arrêt d'urgence d'abord
        this.emergencyStop();
        
        // Reset de tous les compteurs
        this.reconnectAttempts = 0;
        this.consecutiveFailures = 0;
        this.lastDisconnectReason = null;
        
        // Vider l'historique
        this.connectionHistory = [];
        
        console.log('✅ Reset complet terminé');
    }
    
    /**
     * 🧹 NETTOYAGE COMPLET
     */
    destroy() {
        console.log('🧹 DESTRUCTION COLYSEUSMANAGER');
        this.addToConnectionHistory('MANAGER_DESTROYED');
        
        this.stopHeartbeat();
        this.emergencyStop();
        
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = null;
        });
        
        console.log('✅ ColyseusManager détruit');
    }
}

// Instance singleton
const colyseusManager = new ColyseusManager();

// ✅ NOUVEAU: Exposer les fonctions de debug globalement
if (typeof window !== 'undefined') {
    window.debugColyseus = () => {
        console.log('🔍 DEBUG COLYSEUS:', colyseusManager.getDebugInfo());
    };
    
    window.colyseusHistory = () => {
        colyseusManager.printConnectionHistory();
    };
    
    window.colyseusStop = () => {
        colyseusManager.emergencyStop();
    };
    
    window.colyseusReset = () => {
        colyseusManager.fullReset();
    };
    
    window.colyseusReconnect = () => {
        console.log('🔄 Force reconnexion...');
        colyseusManager.connect();
    };
    
    console.log(`
🎯 === FONCTIONS DEBUG COLYSEUS ===

▶️ debugColyseus() - État actuel détaillé
▶️ colyseusHistory() - Historique connexions  
▶️ colyseusStop() - Arrêt d'urgence
▶️ colyseusReset() - Reset complet
▶️ colyseusReconnect() - Force reconnexion

Utilisez ces fonctions pour diagnostiquer les problèmes !
    `);
}

export default colyseusManager;
