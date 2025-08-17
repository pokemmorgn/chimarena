import Phaser from 'phaser';
import AuthScene from './scenes/AuthScene';
import MenuScene from './scenes/MenuScene';

// Configuration principale de Phaser
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    backgroundColor: '#2c3e50',
    
    // Configuration des scènes
    scene: [
        AuthScene,
        MenuScene
    ],
    
    // Configuration du rendu
    render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true
    },
    
    // Configuration des inputs
    input: {
        keyboard: true,
        mouse: true,
        touch: true,
        gamepad: false
    },
    
    // Configuration audio
    audio: {
        disableWebAudio: false
    },
    
    // Configuration de la physique (pour plus tard)
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: window.GameConfig.DEBUG
        }
    },
    
    // Configuration de mise à l'échelle
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        min: {
            width: 400,
            height: 300
        },
        max: {
            width: 1600,
            height: 1200
        }
    },
    
    // Configuration de performance
    fps: {
        target: 60,
        forceSetTimeOut: true
    }
};

// Classe principale du jeu
class ChimArenaGame {
    constructor() {
        this.game = null;
        this.authToken = null;
        this.currentUser = null;
        this.wsConnection = null;
        
        this.init();
    }
    
    init() {
        console.log('🎮 Initialisation de ChimArena...');
        
        // Vérifier le support WebGL
        if (!this.checkWebGLSupport()) {
            window.LoadingManager.showError('WebGL n\'est pas supporté par votre navigateur');
            return;
        }
        
        // Charger les données sauvegardées
        this.loadStoredData();
        
        // Créer le jeu Phaser
        this.createGame();
        
        // Setup des événements globaux
        this.setupGlobalEvents();
    }
    
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    }
    
    loadStoredData() {
        try {
            // Charger le token d'authentification
            this.authToken = localStorage.getItem('chimarena_token');
            
            // Charger les données utilisateur
            const userData = localStorage.getItem('chimarena_user');
            if (userData) {
                this.currentUser = JSON.parse(userData);
            }
            
            // Charger les paramètres
            const settings = localStorage.getItem('chimarena_settings');
            if (settings) {
                this.settings = JSON.parse(settings);
            } else {
                this.settings = this.getDefaultSettings();
                this.saveSettings();
            }
            
            console.log('📄 Données sauvegardées chargées');
            
        } catch (error) {
            console.error('❌ Erreur lors du chargement des données:', error);
            this.settings = this.getDefaultSettings();
        }
    }
    
    getDefaultSettings() {
        return {
            audio: {
                masterVolume: 0.8,
                musicVolume: 0.7,
                sfxVolume: 0.9,
                muted: false
            },
            graphics: {
                quality: 'high',
                particles: true,
                animations: true,
                shadows: true
            },
            gameplay: {
                autoSelectCards: false,
                fastMode: false,
                showDamageNumbers: true,
                confirmActions: true
            },
            interface: {
                language: 'fr',
                theme: 'default',
                showTooltips: true,
                compactMode: false
            }
        };
    }
    
    saveSettings() {
        try {
            localStorage.setItem('chimarena_settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('❌ Erreur sauvegarde paramètres:', error);
        }
    }
    
    createGame() {
        try {
            // Appliquer les paramètres à la configuration
            if (this.settings.graphics.quality === 'low') {
                config.render.antialias = false;
                config.fps.target = 30;
            }
            
            // Créer l'instance Phaser
            this.game = new Phaser.Game(config);
            
            // Ajouter une référence globale pour les scènes
            this.game.registry.set('gameInstance', this);
            this.game.registry.set('authToken', this.authToken);
            this.game.registry.set('currentUser', this.currentUser);
            this.game.registry.set('settings', this.settings);
            
            console.log('🎮 Jeu Phaser créé avec succès');
            
            // Simuler le chargement pour l'écran de loading
            this.simulateLoading();
            
        } catch (error) {
            console.error('❌ Erreur création du jeu:', error);
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
        // Gestion de la visibilité de la page
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.onGamePause();
            } else {
                this.onGameResume();
            }
        });
        
        // Gestion du redimensionnement
        window.addEventListener('resize', () => {
            if (this.game) {
                this.game.scale.refresh();
            }
        });
        
        // Gestion de la fermeture
        window.addEventListener('beforeunload', () => {
            this.onGameClose();
        });
        
        console.log('🎯 Événements globaux configurés');
    }
    
    onGamePause() {
        console.log('⏸️ Jeu en pause');
    }
    
    onGameResume() {
        console.log('▶️ Jeu repris');
    }
    
    onGameClose() {
        console.log('🚪 Fermeture du jeu');
        if (this.wsConnection) {
            this.wsConnection.close();
        }
    }
    
    // Méthodes d'authentification
    setAuthToken(token) {
        this.authToken = token;
        localStorage.setItem('chimarena_token', token);
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
        localStorage.removeItem('chimarena_token');
        localStorage.removeItem('chimarena_user');
        this.game.registry.set('authToken', null);
        this.game.registry.set('currentUser', null);
    }
    
    // Méthodes utilitaires
    isAuthenticated() {
        return !!this.authToken && !!this.currentUser;
    }
    
    getApiHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        
        if (this.authToken) {
            headers.Authorization = `Bearer ${this.authToken}`;
        }
        
        return headers;
    }
    
    // API Helper
    async apiCall(endpoint, options = {}) {
        try {
            const url = `${window.GameConfig.API_URL}${endpoint}`;
            const config = {
                headers: this.getApiHeaders(),
                ...options
            };
            
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Erreur API');
            }
            
            return data;
            
        } catch (error) {
            console.error('❌ Erreur API:', error);
            throw error;
        }
    }
    
    // Gestion des erreurs globales
    handleError(error, context = '') {
        console.error(`❌ Erreur ${context}:`, error);
        
        if (error.message.includes('Token') || error.message.includes('401')) {
            // Token expiré ou invalide
            this.clearAuthData();
            this.game.scene.start('AuthScene');
            window.NotificationManager.error('Session expirée, veuillez vous reconnecter');
        } else {
            window.NotificationManager.error(error.message || 'Une erreur est survenue');
        }
    }
}

// Classes utilitaires globales
window.GameUtils = {
    // Formater les nombres
    formatNumber: (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    },
    
    // Formater le temps
    formatTime: (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },
    
    // Générer un ID unique
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    // Validation email
    isValidEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
};

// Constantes du jeu
window.GameConstants = {
    // Dimensions de l'arène
    ARENA: {
        WIDTH: 800,
        HEIGHT: 600,
        BRIDGE_Y: 300
    },
    
    // Cartes
    CARDS: {
        DECK_SIZE: 8,
        HAND_SIZE: 4,
        MAX_LEVEL: 14
    },
    
    // Combat
    BATTLE: {
        DURATION: 180, // 3 minutes
        OVERTIME_DURATION: 60, // 1 minute
        ELIXIR_MAX: 10,
        ELIXIR_REGEN: 1000 // 1 seconde
    },
    
    // Couleurs du thème
    COLORS: {
        PRIMARY: 0x3498db,
        SECONDARY: 0x2ecc71,
        DANGER: 0xe74c3c,
        WARNING: 0xf39c12,
        DARK: 0x2c3e50,
        LIGHT: 0xecf0f1
    }
};

// Point d'entrée principal
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM chargé, démarrage de ChimArena...');
    
    // Créer l'instance principale du jeu
    window.ChimArenaInstance = new ChimArenaGame();
    
    console.log('✅ ChimArena initialisé avec succès');
});

export default ChimArenaGame;
