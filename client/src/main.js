import Phaser from 'phaser';
import AuthScene from './scenes/AuthScene';
import MenuScene from './scenes/MenuScene';
import { apiFetch, saveToken, clearToken } from './api';

// Configuration Phaser
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#2c3e50',
    scene: [AuthScene, MenuScene],
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
        this.authToken = null;
        this.currentUser = null;
        this.wsConnection = null;
        this.settings = null;

        this.init();
    }

    init() {
        console.log('🎮 Initialisation de ChimArena...');
        if (!this.checkWebGLSupport()) {
            window.LoadingManager.showError('WebGL non supporté');
            return;
        }
        this.loadStoredData();
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
            this.authToken = localStorage.getItem('chimarena_token');
            const userData = localStorage.getItem('chimarena_user');
            if (userData) this.currentUser = JSON.parse(userData);

            const settings = localStorage.getItem('chimarena_settings');
            if (settings) {
                this.settings = JSON.parse(settings);
            } else {
                this.settings = this.getDefaultSettings();
                this.saveSettings();
            }
            console.log('📄 Données sauvegardées chargées');
        } catch (err) {
            console.error('❌ Erreur chargement données:', err);
            this.settings = this.getDefaultSettings();
        }
    }

    getDefaultSettings() {
        return {
            audio: { masterVolume: 0.8, musicVolume: 0.7, sfxVolume: 0.9, muted: false },
            graphics: { quality: 'high', particles: true, animations: true, shadows: true },
            gameplay: { autoSelectCards: false, fastMode: false, showDamageNumbers: true, confirmActions: true },
            interface: { language: 'fr', theme: 'default', showTooltips: true, compactMode: false }
        };
    }

    saveSettings() {
        try {
            localStorage.setItem('chimarena_settings', JSON.stringify(this.settings));
        } catch (err) {
            console.error('❌ Erreur sauvegarde paramètres:', err);
        }
    }

    createGame() {
        try {
            if (this.settings.graphics.quality === 'low') {
                config.render.antialias = false;
                config.fps.target = 30;
            }
            this.game = new Phaser.Game(config);
            this.game.registry.set('gameInstance', this);
            this.game.registry.set('authToken', this.authToken);
            this.game.registry.set('currentUser', this.currentUser);
            this.game.registry.set('settings', this.settings);
            console.log('🎮 Jeu Phaser créé');
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
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.onGamePause();
            else this.onGameResume();
        });
        window.addEventListener('resize', () => { if (this.game) this.game.scale.refresh(); });
        window.addEventListener('beforeunload', () => this.onGameClose());
        console.log('🎯 Événements globaux configurés');
    }

    onGamePause() { console.log('⏸️ Jeu en pause'); }
    onGameResume() { console.log('▶️ Jeu repris'); }
    onGameClose() {
        console.log('🚪 Fermeture du jeu');
        if (this.wsConnection) this.wsConnection.close();
    }

    // --- Auth ---
    setAuthToken(token) {
        this.authToken = token;
        saveToken(token);
        this.game.registry.set('authToken', token);
    }

    setCurrentUser(user) {
        this.currentUser = user;
        localStorage.setItem('chimarena_user', JSON.stringify(user));
        this.game.registry.set('currentUser', user);
    }

    clearAuthData() {
        this.authToken = null;
        this.currentUser = null;
        clearToken();
        localStorage.removeItem('chimarena_user');
        this.game.registry.set('authToken', null);
        this.game.registry.set('currentUser', null);
    }

    isAuthenticated() {
        return !!this.authToken && !!this.currentUser;
    }

    // --- API wrapper ---
    async apiCall(endpoint, options = {}) {
        try {
            return await apiFetch(endpoint, options);
        } catch (err) {
            this.handleError(err, 'API');
            throw err;
        }
    }

    handleError(error, context = '') {
        console.error(`❌ Erreur ${context}:`, error);
        if (error.message.includes('Token') || error.status === 401) {
            this.clearAuthData();
            this.game.scene.start('AuthScene');
            window.NotificationManager.error('Session expirée, reconnectez-vous');
        } else {
            window.NotificationManager.error(error.message || 'Erreur inattendue');
        }
    }
}

// --- Utils globaux ---
window.GameUtils = {
    formatNumber: (n) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toString(),
    formatTime: (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`,
    generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
    isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
};

window.GameConstants = {
    ARENA: { WIDTH: 800, HEIGHT: 600, BRIDGE_Y: 300 },
    CARDS: { DECK_SIZE: 8, HAND_SIZE: 4, MAX_LEVEL: 14 },
    BATTLE: { DURATION: 180, OVERTIME_DURATION: 60, ELIXIR_MAX: 10, ELIXIR_REGEN: 1000 },
    COLORS: { PRIMARY: 0x3498db, SECONDARY: 0x2ecc71, DANGER: 0xe74c3c, WARNING: 0xf39c12, DARK: 0x2c3e50, LIGHT: 0xecf0f1 }
};

// --- Entrée principale ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM chargé, démarrage de ChimArena...');
    window.ChimArenaInstance = new ChimArenaGame();
    console.log('✅ ChimArena initialisé');
});

export default ChimArenaGame;
