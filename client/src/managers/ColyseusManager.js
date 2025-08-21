// client/src/managers/ColyseusManager.js - VERSION AVEC LOGS DÉTAILLÉS
import { Client } from 'colyseus.js';
import { auth, tokenManager } from '../api';

/**
 * 🌐 GESTIONNAIRE COLYSEUS - Connexion WebSocket temps réel
 * Version avec logs détaillés pour debug
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
            // Log des premiers/derniers caractères pour debug (sans exposer le token)
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
     * 🔌 CONNEXION À LA WORLDROOM AVEC LOGS DÉTAILLÉS
     */
    async connect() {
        console.log('🔌 === DÉBUT CONNEXION COLYSEUS ===');
        
        if (this.isConnecting || this.isConnected) {
            console.warn('⚠️ Connexion Colyseus déjà en cours ou établie');
            console.log('📊 État actuel:', {
                isConnecting: this.isConnecting,
                isConnected: this.isConnected,
                hasClient: !!this.client,
                hasRoom: !!this.worldRoom
            });
            return false;
        }
        
        // ✅ NOUVEAU : Nettoyer toute connexion existante d'abord
        if (this.client || this.worldRoom) {
            console.log('🧹 Nettoyage connexion existante...');
            await this.disconnect();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1s
        }
        
        // Vérifier l'authentification
        if (!auth.isAuthenticated()) {
            console.error('❌ Pas d\'authentification pour Colyseus');
            console.log('🔍 État auth:', {
                isAuthenticated: auth.isAuthenticated(),
                tokenInfo: auth.getTokenInfo()
            });
            this.triggerCallback('onError', 'Authentification requise');
            return false;
        }
        
        try {
            this.isConnecting = true;
            console.log('🔌 Connexion à Colyseus...');
            console.log('📊 Paramètres connexion:', {
                serverUrl: this.serverUrl,
                isAuthenticated: auth.isAuthenticated(),
                hasToken: !!this.getAuthToken()
            });
            
            // Créer le client Colyseus
            console.log('🔧 Création client Colyseus...');
            this.client = new Client(this.serverUrl);
            console.log('✅ Client Colyseus créé');
            
            // Obtenir le token JWT depuis l'auth
            const token = this.getAuthToken();
            if (!token) {
                throw new Error('Token d\'authentification manquant');
            }
            
            // Se connecter à la WorldRoom avec seulement le token
            console.log('🔌 Connexion à la WorldRoom...');
            const roomOptions = { token: token };
            console.log('📦 Options room:', { token: token.substring(0, 20) + "..." });
            
            this.worldRoom = await this.client.joinOrCreate('world', roomOptions);
            
            console.log('✅ Connecté à la WorldRoom:', {
                sessionId: this.worldRoom.sessionId,
                roomId: this.worldRoom.id,
                hasState: !!this.worldRoom.state
            });
            
            // Configurer les handlers - MÉTHODE CORRIGÉE
            console.log('🔧 Configuration des handlers...');
            this.setupRoomHandlers();
            
            // Marquer comme connecté
            this.isConnected = true;
            this.isConnecting = false;
            this.reconnectAttempts = 0;
            
            console.log('✅ === CONNEXION COLYSEUS RÉUSSIE ===');
            this.triggerCallback('onConnected');
            return true;
            
        } catch (error) {
            console.error('❌ === ERREUR CONNEXION COLYSEUS ===');
            console.error('❌ Message:', error.message);
            console.error('❌ Stack:', error.stack);
            console.error('❌ Détails:', {
                serverUrl: this.serverUrl,
                hasClient: !!this.client,
                hasRoom: !!this.worldRoom,
                isConnecting: this.isConnecting,
                reconnectAttempts: this.reconnectAttempts
            });
            
            this.isConnecting = false;
            this.isConnected = false;
            
            this.triggerCallback('onError', `Connexion échouée: ${error.message}`);
            
            // Tentative de reconnexion automatique
            this.scheduleReconnect();
            return false;
        }
    }
    
    /**
     * 🔧 CONFIGURATION DES HANDLERS DE LA ROOM - VERSION AVEC LOGS DÉTAILLÉS
     */
    setupRoomHandlers() {
        if (!this.worldRoom) {
            console.error('❌ worldRoom non disponible pour setup handlers');
            return;
        }
        
        console.log('🔧 Configuration des handlers WorldRoom...');
        console.log('🔧 État room initial:', {
            sessionId: this.worldRoom.sessionId,
            hasState: !!this.worldRoom.state,
            stateType: typeof this.worldRoom.state
        });
        
        // ✅ CORRECTION CRITIQUE : Attendre l'état initial
        this.worldRoom.onStateChange.once((state) => {
            console.log('📊 PREMIER ÉTAT REÇU:', {
                totalPlayers: state.totalPlayers,
                playersOnline: state.playersOnline,
                playersSearching: state.playersSearching,
                playersSize: state.players.size,
                playersKeys: Array.from(state.players.keys()),
                stateType: typeof state,
                playersType: typeof state.players
            });
            
            this.updateGlobalStats(state);
            
            // ✅ Setup des handlers players SEULEMENT après réception de l'état
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
                        changes: 'Voir état complet dans player object'
                    });
                    this.worldPlayers.set(sessionId, player);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                });
                
                console.log('✅ Handlers players configurés');
            } else {
                console.error('❌ state.players non disponible !');
            }
        });
        
        // ✅ Changements d'état suivants
        this.worldRoom.onStateChange((state) => {
            console.log('📊 État WorldRoom mis à jour:', {
                totalPlayers: state.totalPlayers,
                playersOnline: state.playersOnline,
                playersSearching: state.playersSearching
            });
            this.updateGlobalStats(state);
            this.updatePlayersMap(state.players);
        });
        
        // 📨 Messages du serveur avec logs
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
            // Heartbeat silencieux (pas de log)
        });
        
        // 🔌 Déconnexion avec logs
        this.worldRoom.onLeave((code) => {
            console.log(`🔌 DÉCONNECTÉ DE LA WORLDROOM:`, {
                code: code,
                codeDescription: this.getLeaveCodeDescription(code),
                sessionId: this.worldRoom?.sessionId
            });
            
            this.isConnected = false;
            this.worldRoom = null;
            
            this.triggerCallback('onDisconnected', code);
            
            // Tentative de reconnexion si ce n'est pas volontaire
            if (code !== 1000) {
                console.log('🔄 Programmation reconnexion automatique...');
                this.scheduleReconnect();
            }
        });
        
        // 🔧 Erreur de room avec logs détaillés
        this.worldRoom.onError((code, message) => {
            console.error(`🔧 ERREUR WORLDROOM:`, {
                code: code,
                message: message,
                sessionId: this.worldRoom?.sessionId,
                roomState: !!this.worldRoom?.state
            });
            this.triggerCallback('onError', `Erreur room: ${message}`);
        });
        
        console.log('✅ Tous les handlers configurés');
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
     * 📊 METTRE À JOUR LES STATS GLOBALES AVEC LOGS
     */
    updateGlobalStats(state) {
        const oldStats = { ...this.globalStats };
        
        this.globalStats = {
            totalPlayers: state.totalPlayers || 0,
            playersOnline: state.playersOnline || 0,
            playersSearching: state.playersSearching || 0
        };
        
        // Log seulement si les stats changent
        if (JSON.stringify(oldStats) !== JSON.stringify(this.globalStats)) {
            console.log('📊 STATS GLOBALES MISES À JOUR:', {
                old: oldStats,
                new: this.globalStats
            });
        }
        
        this.triggerCallback('onGlobalStatsUpdated', this.globalStats);
    }
    
    /**
     * 👥 METTRE À JOUR LA MAP DES JOUEURS AVEC LOGS
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
                newSize: this.worldPlayers.size,
                players: Array.from(this.worldPlayers.values()).map(p => ({
                    username: p.username,
                    trophies: p.trophies,
                    status: p.status
                }))
            });
        }
        
        this.triggerCallback('onPlayersUpdated', this.worldPlayers);
    }
    
    /**
     * 🔄 RECONNEXION AUTOMATIQUE AVEC LOGS
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ TROP DE TENTATIVES DE RECONNEXION:', {
                attempts: this.reconnectAttempts,
                max: this.maxReconnectAttempts
            });
            this.triggerCallback('onError', 'Connexion impossible après plusieurs tentatives');
            return;
        }
        
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Backoff exponentiel
        
        console.log(`🔄 PROGRAMMATION RECONNEXION:`, {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            delay: delay,
            delaySeconds: Math.round(delay / 1000)
        });
        
        setTimeout(() => {
            if (!this.isConnected && auth.isAuthenticated()) {
                console.log('🔄 TENTATIVE DE RECONNEXION...');
                this.connect();
            } else {
                console.log('🔄 RECONNEXION ANNULÉE:', {
                    isConnected: this.isConnected,
                    isAuthenticated: auth.isAuthenticated()
                });
            }
        }, delay);
    }
    
    /**
     * 🔌 DÉCONNEXION VOLONTAIRE AVEC LOGS
     */
    async disconnect() {
        console.log('🔌 DÉCONNEXION VOLONTAIRE DE COLYSEUS');
        console.log('📊 État avant déconnexion:', {
            isConnected: this.isConnected,
            hasRoom: !!this.worldRoom,
            hasClient: !!this.client,
            reconnectAttempts: this.reconnectAttempts
        });
        
        this.isConnected = false;
        this.reconnectAttempts = this.maxReconnectAttempts; // Empêcher la reconnexion auto
        
        if (this.worldRoom) {
            try {
                console.log('🔌 Fermeture room...');
                await this.worldRoom.leave();
                console.log('✅ Room fermée');
            } catch (error) {
                console.warn('⚠️ Erreur lors de la fermeture room:', error);
            }
            this.worldRoom = null;
        }
        
        if (this.client) {
            console.log('🔌 Fermeture client...');
            this.client = null;
        }
        
        // Nettoyer les données
        this.playerProfile = null;
        this.worldPlayers.clear();
        
        console.log('✅ Déconnexion terminée');
        this.triggerCallback('onDisconnected', 1000);
    }
    
    /**
     * 📨 ENVOYER UN MESSAGE À LA WORLDROOM AVEC LOGS
     */
    sendMessage(type, data = {}) {
        console.log(`📨 ENVOI MESSAGE:`, {
            type: type,
            data: data,
            isConnected: this.isConnected,
            hasRoom: !!this.worldRoom
        });
        
        if (!this.isConnected || !this.worldRoom) {
            console.warn(`⚠️ Impossible d'envoyer ${type}, pas connecté`);
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
     * ⚔️ ACTIONS DE MATCHMAKING AVEC LOGS
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
                this.sendMessage("heartbeat", { timestamp: Date.now() });
            }
        }, 30000); // Toutes les 30 secondes
    }
    
    stopHeartbeat() {
        if (this.heartbeatInterval) {
            console.log('💓 ARRÊT HEARTBEAT');
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }
    
    /**
     * 🔧 GESTION DES CALLBACKS AVEC LOGS
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
        } else {
            console.log(`🔔 Pas de callback pour: ${callbackName}`);
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
     * 🔍 DEBUG INFO
     */
    getDebugInfo() {
        return {
            isConnected: this.isConnected,
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
     * 🧹 NETTOYAGE AVEC LOGS
     */
    destroy() {
        console.log('🧹 DESTRUCTION COLYSEUSMANAGER');
        this.stopHeartbeat();
        this.disconnect();
        
        // Nettoyer les callbacks
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = null;
        });
        
        console.log('✅ ColyseusManager détruit');
    }
}

// Instance singleton
const colyseusManager = new ColyseusManager();

export default colyseusManager;
