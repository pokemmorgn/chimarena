// client/src/main.js - MODIFIÉ POUR CLIENT SÉCURISÉ
import Phaser from 'phaser';
import AuthScene from './scenes/AuthScene';
import WelcomeScene from './scenes/WelcomeScene';
import MenuScene from './scenes/MenuScene';
import { auth, config } from './api'; // Nouveau client sécurisé

// Configuration Phaser
const gameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#2c3e50',
    scene: [AuthScene, WelcomeScene, MenuScene],
    render: { antialias: true, pixelArt: false, roundPixels: true },
    input: { keyboard: true, mouse: true, touch: true, gamepad: false },
    audio: { disableWebAudio: false },
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: window.GameConfig.DEBUG } },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: { width: 400, height: 300 },
        max: { width: 1600, height: 1200 }
    },
    fps: { target: 60, forceSetTimeOut: true }
};

class ChimArenaGame {
    constructor() {
        this.game = null;
        this.currentUser = null;
        this.wsConnection = null;
        this.settings = null;
        this.securityMonitor = null;

        this.init();
    }

    init() {
        console.log('🎮 Initialisation de ChimArena avec sécurité crypto-grade...');
        
        if (!this.checkWebGLSupport()) {
            window.LoadingManager.showError('WebGL non supporté');
            return;
        }
        
        this.loadStoredData();
        this.setupSecurityMonitoring();
        this.createGame();
        this.setupGlobalEvents();
    }

    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch {
            return false;
        }
    }

    loadStoredData() {
        try {
            // 🔐 NE PLUS CHARGER LES TOKENS DEPUIS localStorage
            // Les tokens sont maintenant UNIQUEMENT en mémoire
            
            // Charger seulement les paramètres (non sensibles)
            const settings = localStorage.getItem('chimarena_settings');
            if (settings) {
                this.settings = JSON.parse(settings);
            } else {
                this.settings = this.getDefaultSettings();
                this.saveSettings();
            }
            
            // ⚠️ NETTOYER LES ANCIENS TOKENS localStorage SI PRÉSENTS
            this.cleanupOldTokens();
            
            console.log('📄 Paramètres chargés (tokens exclus pour sécurité)');
        } catch (err) {
            console.error('❌ Erreur chargement données:', err);
            this.settings = this.getDefaultSettings();
        }
    }

    cleanupOldTokens() {
        // Nettoyer les anciens tokens localStorage de l'ancienne version
        const oldTokenKeys = [
            'chimarena_token',
            'chimarena_refresh_token',
            'chimarena_user',
            'auth_token',
            'access_token',
            'refresh_token'
        ];
        
        let cleanedTokens = 0;
        oldTokenKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
                cleanedTokens++;
            }
        });
        
        if (cleanedTokens > 0) {
            console.log(`🧹 ${cleanedTokens} anciens tokens nettoyés du localStorage`);
            window.NotificationManager?.show('Sécurité améliorée : anciens tokens supprimés', 'success');
        }
    }

    setupSecurityMonitoring() {
        console.log('🔐 Configuration du monitoring de sécurité...');
        
        // Hook global pour la perte d'authentification
        config.onAuthenticationLost((reason) => {
            console.warn('🚨 SÉCURITÉ : Authentification perdue -', reason);
            this.handleAuthenticationLoss(reason);
        });

        // Hook global pour le refresh de token
        config.onTokenRefreshed(() => {
            console.log('🔄 SÉCURITÉ : Token rafraîchi automatiquement');
            this.updateSecurityStatus();
        });

        // Monitoring périodique de l'état de sécurité
        this.startSecurityMonitoring();
    }

    startSecurityMonitoring() {
        this.securityMonitor = setInterval(() => {
            this.checkSecurityStatus();
        }, 30000); // Vérification toutes les 30 secondes
    }

    checkSecurityStatus() {
        const debugInfo = config.getDebugInfo();
        
        if (!debugInfo) return;

        // Vérifier si le token expire bientôt
        if (debugInfo.timeToExpiry && debugInfo.timeToExpiry < 2 * 60 * 1000) { // 2 minutes
            console.warn('⚠️ Token expire dans moins de 2 minutes');
            this.updateSecurityStatus('warning');
        }

        // Vérifier l'état global
        if (!debugInfo.isAuthenticated && this.game.scene.isActive('MenuScene')) {
            console.error('❌ État incohérent: MenuScene active mais non authentifié');
            this.handleAuthenticationLoss('État de session incohérent');
        }
    }

    updateSecurityStatus(level = 'normal') {
        // Mettre à jour l'indicateur visuel si nécessaire
        const colors = {
            normal: '#2ecc71',
            warning: '#f39c12',
            error: '#e74c3c'
        };
        
        // Cette méthode peut être utilisée pour mettre à jour l'UI
        // selon l'état de sécurité
    }

    handleAuthenticationLoss(reason) {
        console.error('🚨 Gestion de la perte d\'authentification:', reason);
        
        // Nettoyer les données sensibles
        this.clearAuthData();
        
        // Déconnecter WebSocket si actif
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }
        
        // Rediriger vers AuthScene si pas déjà fait
        if (this.game && this.game.scene.isActive('MenuScene')) {
            this.game.scene.start('AuthScene');
        }
        
        // Notifier l'utilisateur
        window.NotificationManager?.error(`Session expirée: ${reason}`);
    }

    getDefaultSettings() {
        return {
            audio: { masterVolume: 0.8, musicVolume: 0.7, sfxVolume: 0.9, muted: false },
            graphics: { quality: 'high', particles: true, animations: true, shadows: true },
            gameplay: { autoSelectCards: false, fastMode: false, showDamageNumbers: true, confirmActions: true },
            interface: { language: 'fr', theme: 'default', showTooltips: true, compactMode: false },
            security: { autoLockMinutes: 60, requireConfirmForSensitiveActions: true, enableSecurityNotifications: true }
        };
    }

    saveSettings() {
        try {
            // Sauvegarder seulement les paramètres non sensibles
            localStorage.setItem('chimarena_settings', JSON.stringify(this.settings));
        } catch (err) {
            console.error('❌ Erreur sauvegarde paramètres:', err);
        }
    }

    createGame() {
        try {
            if (this.settings.graphics.quality === 'low') {
                gameConfig.render.antialias = false;
                gameConfig.fps.target = 30;
            }
            
            this.game = new Phaser.Game(gameConfig);
            
            // Enregistrer les données dans le registry Phaser
            this.game.registry.set('gameInstance', this);
            this.game.registry.set('currentUser', this.currentUser);
            this.game.registry.set('settings', this.settings);
            
            console.log('🎮 Jeu Phaser créé avec sécurité intégrée');
            this.simulateLoading();
        } catch (err) {
            console.error('❌ Erreur création jeu:', err);
            window.LoadingManager.showError('Impossible de créer le jeu');
        }
    }

    simulateLoading() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
            }
            window.LoadingManager.updateProgress(progress, 100);
        }, 200);
    }

    setupGlobalEvents() {
        // Gestion de la visibilité de l'onglet avec sécurité
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onGamePause();
            } else {
                this.onGameResume();
            }
        });
        
        // Redimensionnement
        window.addEventListener('resize', () => { 
            if (this.game) this.game.scale.refresh(); 
        });
        
        // Fermeture avec nettoyage sécurisé
        window.addEventListener('beforeunload', () => this.onGameClose());
        
        // Détection de tentatives de manipulation du localStorage
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.includes('token')) {
                console.warn('🚨 Tentative de manipulation de token détectée');
                // Ne pas réagir aux changements de tokens localStorage
                // car ils ne sont plus utilisés
            }
        });
        
        console.log('🎯 Événements globaux sécurisés configurés');
    }

    onGamePause() { 
        console.log('⏸️ Jeu en pause');
        
        // Vérification de sécurité lors de la pause
        const debugInfo = config.getDebugInfo();
        if (debugInfo && debugInfo.timeToExpiry < 5 * 60 * 1000) { // 5 minutes
            console.warn('⚠️ Token expire bientôt, refresh recommandé');
        }
    }
    
    onGameResume() { 
        console.log('▶️ Jeu repris');
        
        // Vérification de sécurité lors de la reprise
        if (auth.isAuthenticated()) {
            this.checkSecurityStatus();
        }
    }
    
    onGameClose() {
        console.log('🚪 Fermeture sécurisée du jeu');
        this.cleanup();
    }

    cleanup() {
        // Nettoyer le monitoring
        if (this.securityMonitor) {
            clearInterval(this.securityMonitor);
            this.securityMonitor = null;
        }
        
        // Fermer WebSocket
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }
        
        // Les tokens sont automatiquement nettoyés par le client API
        console.log('🧹 Nettoyage sécurisé terminé');
    }

    // --- Méthodes d'interface pour les scènes ---
    
    // ⚠️ MÉTHODES DÉPRÉCIÉES (compatibilité)
    setAuthToken(token) {
        console.warn('⚠️ setAuthToken est déprécié. Les tokens sont gérés automatiquement par le client sécurisé.');
        // Ne rien faire, les tokens sont gérés par le nouveau client
    }

    clearAuthData() {
        console.log('🧹 Nettoyage des données d\'authentification');
        this.currentUser = null;
        this.game?.registry.set('currentUser', null);
        
        // Le client API gère automatiquement le nettoyage des tokens
    }

    // ✅ NOUVELLES MÉTHODES SÉCURISÉES
    setCurrentUser(user) {
        console.log('👤 Mise à jour des données utilisateur');
        this.currentUser = user;
        this.game?.registry.set('currentUser', user);
        
        // Ne pas sauvegarder en localStorage pour la sécurité
        // Les données sont récupérées à chaque session
    }

    isAuthenticated() {
        return auth.isAuthenticated();
    }

    // Méthode pour obtenir les infos de debug (développement)
    getSecurityDebugInfo() {
        if (window.GameConfig?.DEBUG) {
            return {
                apiDebug: config.getDebugInfo(),
                gameInstance: {
                    currentUser: !!this.currentUser,
                    wsConnection: !!this.wsConnection,
                    securityMonitor: !!this.securityMonitor,
                },
                tokenInfo: auth.getTokenInfo(),
            };
        }
        return null;
    }

    // Wrapper pour les appels API (compatibilité)
    async apiCall(endpoint, options = {}) {
        console.warn('⚠️ apiCall est déprécié. Utilisez directement les modules auth/user/game/crypto de l\'API.');
        
        try {
            // Rediriger vers le nouveau client selon l'endpoint
            if (endpoint.startsWith('/auth/')) {
                throw new Error('Utilisez les méthodes auth.* pour l\'authentification');
            } else if (endpoint.startsWith('/user/')) {
                throw new Error('Utilisez les méthodes user.* pour les données utilisateur');
            }
            
            throw new Error('Endpoint non supporté par la méthode dépréciée');
        } catch (err) {
            this.handleError(err, 'API');
            throw err;
        }
    }

    handleError(error, context = '') {
        console.error(`❌ Erreur ${context}:`, error);
        
        // Gestion spécifique des erreurs d'authentification
        if (error.message.includes('session') || error.message.includes('token') || error.status === 401) {
            this.handleAuthenticationLoss(error.message);
        } else {
            window.NotificationManager?.error(error.message || 'Erreur inattendue');
        }
    }
}

// --- Utils globaux (inchangés mais améliorés) ---
window.GameUtils = {
    formatNumber: (n) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toString(),
    formatTime: (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`,
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    
    // Nouvelles méthodes de sécurité
    sanitizeInput: (input) => {
        if (typeof input !== 'string') return input;
        return input.replace(/[<>'"&]/g, '');
    },
    
    validateUsername: (username) => {
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    }
};

window.GameConstants = {
    ARENA: { WIDTH: 800, HEIGHT: 600, BRIDGE_Y: 300 },
    CARDS: { DECK_SIZE: 8, HAND_SIZE: 4, MAX_LEVEL: 14 },
    BATTLE: { DURATION: 180, OVERTIME_DURATION: 60, ELIXIR_MAX: 10, ELIXIR_REGEN: 1000 },
    COLORS: { PRIMARY: 0x3498db, SECONDARY: 0x2ecc71, DANGER: 0xe74c3c, WARNING: 0xf39c12, DARK: 0x2c3e50, LIGHT: 0xecf0f1 },
    
    // Nouvelles constantes de sécurité
    SECURITY: {
        TOKEN_REFRESH_THRESHOLD: 2 * 60 * 1000, // 2 minutes
        MAX_IDLE_TIME: 60 * 60 * 1000, // 1 heure
        SESSION_CHECK_INTERVAL: 30 * 1000, // 30 secondes
    }
};

// --- Entrée principale sécurisée ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM chargé, démarrage de ChimArena sécurisé...');
    
    // Vérifier la compatibilité de sécurité
    if (!window.crypto || !window.crypto.getRandomValues) {
        console.error('❌ API de sécurité non disponible');
        window.LoadingManager?.showError('Navigateur non compatible avec les fonctionnalités de sécurité');
        return;
    }
    
    // Créer l'instance de jeu sécurisée
    window.ChimArenaInstance = new ChimArenaGame();
    
    console.log('✅ ChimArena sécurisé initialisé');
    console.log('🔐 Tokens stockés UNIQUEMENT en mémoire');
    console.log('🛡️ Monitoring de sécurité actif');
    
    // Debug en développement
    if (window.GameConfig?.DEBUG) {
        console.log('🔧 Mode debug activé');
        window.getSecurityDebug = () => window.ChimArenaInstance.getSecurityDebugInfo();
    }
});

export default ChimArenaGame;
