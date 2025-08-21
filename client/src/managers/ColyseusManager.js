// client/src/managers/ColyseusManager.js - FIX ERREUR onAdd
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
        
        // Verrous anti-boucle
        this.connectionLock = false;
        this.destroyed = false;
        this.lastConnectAttempt = 0;
        this.minConnectInterval = 2000;
        
        // Timeouts
        this.connectionTimeout = null;
        this.readyTimeout = null;
        this.reconnectTimeout = null;
        this.healthCheckInterval = null;
        
        // Debug tracking
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
        
        this.serverUrl = this.getServerUrl();
        console.log('🌐 ColyseusManager initialisé (version fix onAdd)');
        
        // Health check
        this.startHealthCheck();
        
        if (window.GameConfig?.DEBUG) {
            window.debugColyseusManager = this;
        }
    }
    
    startHealthCheck() {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 10000);
    }
    
    performHealthCheck() {
        if (this.destroyed) return;
        
        // Détecter connexion zombie
        if (this.isConnected && this.worldRoom) {
            const wsState = this.worldRoom.connection?.readyState;
            if (wsState !== WebSocket.OPEN) {
                console.warn('🚨 CONNEXION ZOMBIE DÉTECTÉE');
                this.addToConnectionHistory('ZOMBIE_DETECTED', { wsState });
                this.cleanupConnection();
                return;
            }
        }
        
        // Détecter état incohérent
        if (this.isConnecting && !this.connectionTimeout) {
            console.warn('🚨 ÉTAT INCOHÉRENT: isConnecting=true mais pas de timeout');
            this.addToConnectionHistory('INCONSISTENT_STATE');
            this.forceReset();
            return;
        }
        
        // Détecter reconnexions trop fréquentes
        const recentAttempts = this.connectionHistory.filter(h => 
            h.event === 'CONNECT_ATTEMPT' && 
            Date.now() - new Date(h.timestamp).getTime() < 30000
        ).length;
        
        if (recentAttempts > 5) {
            console.error('🚨 TROP DE TENTATIVES RÉCENTES - PAUSE FORCÉE');
            this.addToConnectionHistory('FORCED_PAUSE', { attempts: recentAttempts });
            this.emergencyStop();
        }
    }
    
    forceReset() {
        console.warn('🔄 RESET FORCÉ POUR ÉTAT INCOHÉRENT');
        this.addToConnectionHistory('FORCE_RESET');
        
        this.isConnecting = false;
        this.connectionLock = false;
        this.clearAllTimeouts();
        this.cleanupConnection();
    }
    
    addToConnectionHistory(event, details = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            event,
            details,
            state: {
                isConnected: this.isConnected,
                isConnecting: this.isConnecting,
                isReady: this.isReady,
                reconnectAttempts: this.reconnectAttempts,
                connectionLock: this.connectionLock
            }
        };
        
        this.connectionHistory.unshift(entry);
        
        if (this.connectionHistory.length > 20) {
            this.connectionHistory = this.connectionHistory.slice(0, 20);
        }
        
        console.log(`📊 [${event}]`, details);
    }
    
    getAuthToken() {
        const token = tokenManager.getToken();
        if (token) {
            console.log("🔑 Token récupéré (longueur:", token.length, ")");
            return token;
        }
        console.error("❌ Aucun token disponible !");
        return null;
    }
    
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
     * ✅ CONNEXION AVEC PROTECTION ANTI-BOUCLE
     */
    async connect() {
        // Vérifications de sécurité
        if (this.destroyed) {
            console.warn('⚠️ Manager détruit - connexion refusée');
            return false;
        }
        
        if (this.connectionLock) {
            console.warn('⚠️ CONNEXION VERROUILLÉE - REFUS');
            this.addToConnectionHistory('CONNECT_BLOCKED', { reason: 'connectionLock actif' });
            return false;
        }
        
        // Protection intervalle minimum
        const now = Date.now();
        const timeSinceLastAttempt = now - this.lastConnectAttempt;
        if (timeSinceLastAttempt < this.minConnectInterval) {
            console.warn(`⚠️ TENTATIVE TROP RAPIDE (${timeSinceLastAttempt}ms < ${this.minConnectInterval}ms)`);
            this.addToConnectionHistory('CONNECT_BLOCKED', { 
                reason: 'Tentative trop rapide',
                timeSinceLastAttempt 
            });
            return false;
        }
        
        if (this.isConnecting) {
            console.warn('⚠️ CONNEXION DÉJÀ EN COURS');
            this.addToConnectionHistory('CONNECT_BLOCKED', { reason: 'isConnecting = true' });
            return false;
        }
        
        if (this.isConnected) {
            // Vérification stricte de l'état réel
            if (this.worldRoom && this.worldRoom.connection && this.worldRoom.connection.readyState === WebSocket.OPEN) {
                console.log('✅ Déjà connecté avec connexion active');
                return true;
            } else {
                console.warn('⚠️ État incohérent: isConnected=true mais connexion fermée');
                this.addToConnectionHistory('CONNECT_CLEANUP', { reason: 'État incohérent' });
                this.cleanupConnection();
            }
        }
        
        // Vérification authentification
        if (!auth.isAuthenticated()) {
            console.error('❌ Pas d\'authentification pour Colyseus');
            this.addToConnectionHistory('CONNECT_FAILED', { reason: 'Pas authentifié' });
            this.triggerCallback('onError', 'Authentification requise');
            return false;
        }
        
        // Vérification limite de tentatives
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ LIMITE DE TENTATIVES ATTEINTE');
            this.addToConnectionHistory('CONNECT_BLOCKED', { 
                reason: 'Limite tentatives',
                attempts: this.reconnectAttempts 
            });
            return false;
        }
        
        // Vérification échecs consécutifs
        if (this.consecutiveFailures >= 3) {
            console.error('❌ TROP D\'ÉCHECS CONSÉCUTIFS');
            this.addToConnectionHistory('CONNECT_BLOCKED', { 
                reason: 'Trop d\'échecs',
                failures: this.consecutiveFailures 
            });
            return false;
        }
        
        this.addToConnectionHistory('CONNECT_ATTEMPT', {
            reason: 'Manuel ou auto-reconnect',
            authStatus: auth.isAuthenticated(),
            hasToken: !!this.getAuthToken(),
            attempt: this.reconnectAttempts + 1
        });
        
        // Verrouillage strict
        this.connectionLock = true;
        this.lastConnectAttempt = now;
        
        // Nettoyer complètement avant connexion
        await this.forceDisconnect();
        
        try {
            this.isConnecting = true;
            this.isReady = false;
            
            // Timeout de connexion strict
            this.connectionTimeout = setTimeout(() => {
                if (this.isConnecting) {
                    console.error('⏰ TIMEOUT CONNEXION (8s)');
                    this.addToConnectionHistory('CONNECT_TIMEOUT', { duration: '8s' });
                    this.handleConnectionTimeout();
                }
            }, 8000);
            
            console.log('🔌 Connexion à Colyseus...');
            
            // Créer le client
            this.client = new Client(this.serverUrl);
            console.log('✅ Client Colyseus créé');
            
            // Obtenir le token
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
            
            // Nettoyer le timeout
            this.clearConnectionTimeout();
            
            // Configurer les handlers
            this.setupRoomHandlers();
            
            // Mise à jour état avec déverrouillage
            this.isConnected = true;
            this.isConnecting = false;
            this.connectionLock = false;
            this.reconnectAttempts = 0;
            this.consecutiveFailures = 0;
            
            console.log('✅ === CONNEXION COLYSEUS RÉUSSIE ===');
            return true;
            
        } catch (error) {
            console.error('❌ === ERREUR CONNEXION COLYSEUS ===');
            console.error('❌ Message:', error.message);
            console.error('❌ Stack:', error.stack);
            
            this.addToConnectionHistory('CONNECT_ERROR', {
                error: error.message,
                stack: error.stack?.split('\n').slice(0, 3)
            });
            
            // Nettoyage complet en cas d'erreur
            this.clearConnectionTimeout();
            this.isConnecting = false;
            this.isConnected = false;
            this.isReady = false;
            this.connectionLock = false;
            this.consecutiveFailures++;
            
            this.triggerCallback('onError', `Connexion échouée: ${error.message}`);
            
            // Décision de reconnexion plus stricte
            if (this.consecutiveFailures >= 3) {
                console.error('❌ TROP D\'ÉCHECS - ARRÊT DÉFINITIF');
                this.addToConnectionHistory('CONNECT_ABANDONED', { 
                    consecutiveFailures: this.consecutiveFailures 
                });
                this.emergencyStop();
                return false;
            }
            
            // Programmer reconnexion avec délai croissant
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
                const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
                setTimeout(() => {
                    this.scheduleReconnect();
                }, delay);
            }
            
            return false;
        }
    }
    
    handleConnectionTimeout() {
        console.error('⏰ TIMEOUT DE CONNEXION GÉRÉ');
        this.addToConnectionHistory('TIMEOUT_HANDLED', {
            wasConnecting: this.isConnecting,
            hasRoom: !!this.worldRoom,
            hasClient: !!this.client
        });
        
        // Nettoyage complet
        this.isConnecting = false;
        this.isConnected = false;
        this.isReady = false;
        this.connectionLock = false;
        this.consecutiveFailures++;
        
        this.clearConnectionTimeout();
        this.forceDisconnect();
        
        this.triggerCallback('onError', 'Timeout de connexion');
        
        // Arrêt si trop de timeouts
        if (this.consecutiveFailures >= 2) {
            console.error('❌ TROP DE TIMEOUTS - ARRÊT');
            this.emergencyStop();
        }
    }
    
    /**
     * ✅ SETUP HANDLERS AVEC FIX onAdd
     */
    setupRoomHandlers() {
        if (!this.worldRoom) {
            console.error('❌ worldRoom non disponible pour setup handlers');
            return;
        }
        
        console.log('🔧 Configuration des handlers WorldRoom...');
        this.addToConnectionHistory('HANDLERS_SETUP_START');
        
        // Handler server_ready protégé
        this.worldRoom.onMessage("server_ready", (data) => {
            console.log('✅ SERVEUR PRÊT - Finalisation...');
            this.addToConnectionHistory('SERVER_READY', data);
            
            this.clearReadyTimeout();
            this.isReady = true;
            this.triggerCallback('onConnected');
        });
        
        // ✅ ÉTAT INITIAL AVEC PROTECTION onAdd
        this.worldRoom.onStateChange.once((state) => {
            console.log('📊 PREMIER ÉTAT REÇU');
            console.log('📊 État complet:', {
                totalPlayers: state.totalPlayers,
                playersOnline: state.playersOnline,
                playersSearching: state.playersSearching,
                hasPlayers: !!state.players,
                playersType: typeof state.players,
                playersSize: state.players?.size,
                playersKeys: state.players ? Object.keys(state.players) : 'N/A'
            });
            
            this.addToConnectionHistory('FIRST_STATE_RECEIVED', {
                totalPlayers: state.totalPlayers,
                playersCount: state.players?.size || 0,
                hasPlayers: !!state.players,
                playersType: typeof state.players
            });
            
            this.updateGlobalStats(state);
            
            // ✅ FIX CRITIQUE: Vérifier state.players avant setup handlers
            if (state.players && typeof state.players === 'object') {
                console.log('🔧 Configuration handlers players - state.players valide');
                this.setupPlayersHandlers(state);
            } else {
                console.warn('⚠️ state.players invalide ou manquant:', {
                    hasPlayers: !!state.players,
                    type: typeof state.players,
                    value: state.players
                });
                this.addToConnectionHistory('PLAYERS_HANDLERS_SKIPPED', {
                    reason: 'state.players invalide',
                    hasPlayers: !!state.players,
                    type: typeof state.players
                });
            }
            
            // Envoi client_ready protégé
            setTimeout(() => {
                if (this.destroyed || !this.worldRoom) {
                    console.warn('⚠️ Connexion fermée avant client_ready');
                    return;
                }
                
                console.log('📡 ENVOI SIGNAL CLIENT_READY...');
                this.addToConnectionHistory('CLIENT_READY_SENT');
                
                // Timeout ready plus court
                this.readyTimeout = setTimeout(() => {
                    if (!this.isReady && !this.destroyed) {
                        console.error('⏰ TIMEOUT SIGNAL READY (3s)');
                        this.addToConnectionHistory('READY_TIMEOUT');
                        this.handleReadyTimeout();
                    }
                }, 3000);
                
                try {
                    this.worldRoom.send("client_ready", { 
                        timestamp: Date.now(),
                        clientVersion: "1.0.0"
                    });
                } catch (error) {
                    console.error('❌ Erreur envoi client_ready:', error);
                    this.addToConnectionHistory('CLIENT_READY_ERROR', { error: error.message });
                    this.handleReadyTimeout();
                }
            }, 200);
        });
        
        // États suivants
        this.worldRoom.onStateChange((state) => {
            if (!this.destroyed) {
                this.updateGlobalStats(state);
                this.updatePlayersMap(state.players);
            }
        });
        
        // Messages serveur
        this.setupMessageHandlers();
        
        // Déconnexion avec logique anti-boucle
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
            
            // Décision de reconnexion stricte
            const shouldReconnect = this.shouldAttemptReconnect(code);
            console.log(`🤔 Reconnexion ? ${shouldReconnect}`, {
                code,
                voluntary: code === 1000,
                attempts: this.reconnectAttempts,
                maxAttempts: this.maxReconnectAttempts,
                consecutiveFailures: this.consecutiveFailures,
                destroyed: this.destroyed,
                authenticated: auth.isAuthenticated()
            });
            
            if (shouldReconnect) {
                // Délai avant reconnexion
                setTimeout(() => {
                    this.scheduleReconnect();
                }, 1000);
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
            
            // Erreur room peut déclencher nettoyage
            if (code >= 4000) { // Erreurs personnalisées serveur
                this.consecutiveFailures++;
                if (this.consecutiveFailures >= 2) {
                    this.emergencyStop();
                }
            }
        });
        
        console.log('✅ Handlers configurés');
        this.addToConnectionHistory('HANDLERS_SETUP_COMPLETE');
    }
    
    handleReadyTimeout() {
        console.error('⏰ TIMEOUT READY - FORCE RECONNEXION');
        this.addToConnectionHistory('READY_TIMEOUT_HANDLED');
        
        this.isReady = false;
        this.consecutiveFailures++;
        
        // Forcer une nouvelle connexion
        this.forceDisconnect().then(() => {
            if (this.consecutiveFailures < 3) {
                setTimeout(() => {
                    this.connect();
                }, 2000);
            } else {
                this.emergencyStop();
            }
        });
    }
    
    /**
     * ✅ SETUP HANDLERS PLAYERS AVEC PROTECTION TOTALE
     */
    setupPlayersHandlers(state) {
        // ✅ VÉRIFICATIONS MULTIPLES AVANT onAdd
        if (!state || !state.players) {
            console.warn('⚠️ setupPlayersHandlers: state ou state.players manquant');
            return;
        }
        
        if (typeof state.players !== 'object') {
            console.warn('⚠️ setupPlayersHandlers: state.players n\'est pas un objet');
            return;
        }
        
        // ✅ VÉRIFIER QUE LES MÉTHODES onAdd/onRemove/onChange EXISTENT
        if (typeof state.players.onAdd !== 'function') {
            console.warn('⚠️ setupPlayersHandlers: state.players.onAdd n\'est pas une fonction');
            console.log('🔍 state.players type:', typeof state.players);
            console.log('🔍 state.players keys:', Object.keys(state.players));
            console.log('🔍 state.players.onAdd type:', typeof state.players.onAdd);
            return;
        }
        
        console.log('🔧 Configuration handlers players - Toutes vérifications OK');
        
        try {
            state.players.onAdd((player, sessionId) => {
                if (!this.destroyed) {
                    console.log(`👤 PLAYER AJOUTÉ: ${player.username} (${sessionId})`);
                    this.worldPlayers.set(sessionId, player);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                }
            });
            
            state.players.onRemove((player, sessionId) => {
                if (!this.destroyed) {
                    console.log(`👤 PLAYER SUPPRIMÉ: ${player.username} (${sessionId})`);
                    this.worldPlayers.delete(sessionId);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                }
            });
            
            state.players.onChange((player, sessionId) => {
                if (!this.destroyed) {
                    console.log(`👤 PLAYER MODIFIÉ: ${player.username} (${player.status})`);
                    this.worldPlayers.set(sessionId, player);
                    this.triggerCallback('onPlayersUpdated', this.worldPlayers);
                }
            });
            
            console.log('✅ Handlers players configurés avec succès');
            this.addToConnectionHistory('PLAYERS_HANDLERS_SUCCESS');
            
        } catch (error) {
            console.error('❌ Erreur configuration handlers players:', error);
            this.addToConnectionHistory('PLAYERS_HANDLERS_ERROR', {
                error: error.message,
                stack: error.stack?.split('\n').slice(0, 3)
            });
        }
    }
    
    setupMessageHandlers() {
        const messageTypes = [
            "player_profile", "arena_info", "search_started", 
            "search_cancelled", "match_found", "battle_result", 
            "leaderboard", "error", "search_error"
        ];
        
        messageTypes.forEach(messageType => {
            this.worldRoom.onMessage(messageType, (data) => {
                if (!this.destroyed) {
                    console.log(`📨 MESSAGE REÇU: ${messageType}`);
                    this.handleServerMessage(messageType, data);
                }
            });
        });
        
        this.worldRoom.onMessage("heartbeat_ack", (data) => {
            // Heartbeat silencieux
        });
    }
    
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
    
    shouldAttemptReconnect(code) {
        if (this.destroyed) return false;
        if (code === 1000) return false;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) return false;
        if (this.consecutiveFailures >= 3) return false;
        if (!auth.isAuthenticated()) return false;
        if (this.reconnectTimeout) return false;
        if (this.connectionLock) return false;
        return true;
    }
    
    clearAllTimeouts() {
        this.clearConnectionTimeout();
        this.clearReadyTimeout();
        this.clearReconnectTimeout();
    }
    
    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }
    
    clearReadyTimeout() {
        if (this.readyTimeout) {
            clearTimeout(this.readyTimeout);
            this.readyTimeout = null;
        }
    }
    
    clearReconnectTimeout() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }
    
    cleanupConnection() {
        this.isConnected = false;
        this.isReady = false;
        this.worldRoom = null;
        this.clearAllTimeouts();
        this.addToConnectionHistory('CONNECTION_CLEANED');
    }
    
    scheduleReconnect() {
        if (this.destroyed) return;
        
        if (this.reconnectTimeout) {
            console.warn('⚠️ RECONNEXION DÉJÀ PROGRAMMÉE');
            this.addToConnectionHistory('RECONNECT_SKIPPED', { reason: 'Déjà programmée' });
            return;
        }
        
        this.reconnectAttempts++;
        
        // Délai progressif plus long
        const baseDelay = Math.max(this.reconnectDelay, 2000);
        const delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);
        
        console.log(`🔄 RECONNEXION PROGRAMMÉE: tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts} dans ${Math.round(delay / 1000)}s`);
        
        this.addToConnectionHistory('RECONNECT_SCHEDULED', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            delay: delay,
            delaySeconds: Math.round(delay / 1000)
        });
        
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            
            if (this.destroyed) {
                console.log('🔄 RECONNEXION ANNULÉE: Manager détruit');
                return;
            }
            
            this.addToConnectionHistory('RECONNECT_EXECUTING');
            
            if (!this.isConnected && !this.isConnecting && !this.connectionLock && auth.isAuthenticated()) {
                console.log('🔄 EXÉCUTION RECONNEXION...');
                this.connect();
            } else {
                console.log('🔄 RECONNEXION ANNULÉE:', {
                    isConnected: this.isConnected,
                    isConnecting: this.isConnecting,
                    connectionLock: this.connectionLock,
                    isAuthenticated: auth.isAuthenticated()
                });
                this.addToConnectionHistory('RECONNECT_CANCELLED', {
                    isConnected: this.isConnected,
                    isConnecting: this.isConnecting,
                    connectionLock: this.connectionLock,
                    isAuthenticated: auth.isAuthenticated()
                });
            }
        }, delay);
    }
    
    /**
     * ✅ DÉCONNEXION FORCÉE AMÉLIORÉE
     */
    async forceDisconnect() {
        console.log('🧹 DÉCONNEXION FORCÉE');
        this.addToConnectionHistory('FORCE_DISCONNECT_START');
        
        // Annuler reconnexion programmée
        this.clearReconnectTimeout();
        
        // Nettoyer timeouts
        this.clearAllTimeouts();
        
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
        this.connectionLock = false;
        
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
     * ✅ DEBUG DÉTAILLÉ
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
            
            // Verrous
            connectionLock: this.connectionLock,
            destroyed: this.destroyed,
            
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
    
    printConnectionHistory() {
        console.group('📊 HISTORIQUE CONNEXION');
        this.connectionHistory.forEach((entry, index) => {
            console.log(`${index + 1}. [${entry.timestamp}] ${entry.event}`, entry.details);
        });
        console.groupEnd();
    }
    
    /**
     * ✅ ARRÊT D'URGENCE
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
     * ✅ RESET COMPLET
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
        
        this.destroyed = true;
        
        this.stopHeartbeat();
        this.emergencyStop();
        
        // Nettoyer health check
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = null;
        });
        
        console.log('✅ ColyseusManager détruit');
    }
}

// Instance singleton
const colyseusManager = new ColyseusManager();

// ✅ EXPOSITION GLOBALE DES FONCTIONS DEBUG
if (typeof window !== 'undefined') {
    window.debugColyseus = () => {
        console.log('🔍 DEBUG COLYSEUS:', colyseusManager.getDebugInfo());
        return colyseusManager.getDebugInfo();
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
    
    // Accès direct
    window.colyseusManager = colyseusManager;
    
    console.log(`
🎯 === FONCTIONS DEBUG COLYSEUS EXPOSÉES ===

▶️ debugColyseus() - État actuel détaillé
▶️ colyseusHistory() - Historique connexions  
▶️ colyseusStop() - Arrêt d'urgence
▶️ colyseusReset() - Reset complet
▶️ colyseusReconnect() - Force reconnexion
▶️ window.colyseusManager - Accès direct

✅ FIX onAdd: Protection complète contre erreur "Cannot set properties of undefined"
    `);
}

export default colyseusManager;
