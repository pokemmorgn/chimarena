// client/src/main.js - VERSION AVEC DEBUG PRÉCOCE
import Phaser from 'phaser';
import AuthScene from './scenes/AuthScene';
import WelcomeScene from './scenes/WelcomeScene';
import ClashMenuScene from './scenes/ClashMenuScene';
import { auth, config } from './api';
import { LoadingManager } from './utils/LoadingManager.js';
import BattlePanel from './battle/BattlePanel.js';

// 🔍 IMPORT COLYSEUS TÔT POUR DEBUG
import * as ColyseusManagerModule from './managers/ColyseusManager.js';
const colyseusManager = ColyseusManagerModule.default || ColyseusManagerModule;
window.GameConfig.DEBUG = import.meta.env.DEV;
console.log(">>> MAIN.JS START");

// 🔍 === EXPOSITION PRÉCOCE DES FONCTIONS DEBUG ===
console.log('🔍 EXPOSITION FONCTIONS DEBUG COLYSEUS...');

// Exposer immédiatement les fonctions debug
window.debugColyseus = () => {
    console.log('🔍 DEBUG COLYSEUS:', colyseusManager.getDebugInfo());
    return colyseusManager.getDebugInfo();
};

window.colyseusHistory = () => {
    colyseusManager.printConnectionHistory();
};

window.colyseusStop = () => {
    console.log('🛑 ARRÊT FORCÉ COLYSEUS');
    colyseusManager.emergencyStop();
};

window.colyseusReset = () => {
    console.log('🔄 RESET COMPLET COLYSEUS');
    colyseusManager.fullReset();
};

window.colyseusReconnect = () => {
    console.log('🔄 FORCE RECONNEXION COLYSEUS');
    colyseusManager.connect();
};

window.colyseusManager = colyseusManager; // Accès direct

console.log('✅ FONCTIONS DEBUG COLYSEUS EXPOSÉES GLOBALEMENT');
console.log('▶️ debugColyseus() - État détaillé');
console.log('▶️ colyseusHistory() - Historique');
console.log('▶️ colyseusStop() - Arrêt d\'urgence');
console.log('▶️ colyseusReset() - Reset complet');
console.log('▶️ colyseusReconnect() - Force reconnexion');

// 📱 DÉTECTION DE L'APPAREIL
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768 ||
         ('ontouchstart' in window);
};

// 📱 DIMENSIONS OPTIMISÉES PORTRAIT (comme Clash Royale)
const getGameDimensions = () => {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const mobile = isMobile();
  
  // TOUJOURS EN FORMAT PORTRAIT (comme Clash Royale)
  if (mobile) {
    // Mobile : utiliser toute la largeur disponible
    return {
      width: Math.min(screenWidth, 414), // iPhone Pro Max width
      height: Math.min(screenHeight, 896), // iPhone Pro Max height
      portrait: true,
      mobile: true
    };
  } else {
    // PC : format portrait fixe centré (comme un téléphone)
    return {
      width: 400, // Largeur fixe type téléphone
      height: 700, // Hauteur fixe type téléphone
      portrait: true,
      mobile: false
    };
  }
};

// Configuration Phaser PORTRAIT UNIVERSEL
const createGameConfig = () => {
  const mobile = isMobile();
  const dimensions = getGameDimensions();
  
  console.log(`🎮 Mode: ${mobile ? 'Mobile' : 'PC Portrait'} - ${dimensions.width}x${dimensions.height}`);
  
  return {
    type: Phaser.AUTO,
    width: dimensions.width,
    height: dimensions.height,
    parent: 'game-container',
    backgroundColor: '#2c3e50',
    scene: [AuthScene, WelcomeScene, ClashMenuScene],
    render: { 
      antialias: !mobile, // Désactiver sur mobile pour performance
      pixelArt: false, 
      roundPixels: true 
    },
    input: { 
      keyboard: true, // Garder clavier sur PC
      mouse: true,
      touch: mobile, // Touch sur mobile uniquement
      gamepad: false 
    },
    audio: { 
      disableWebAudio: mobile // Meilleure compatibilité mobile
    },
    physics: { 
      default: 'arcade', 
      arcade: { 
        gravity: { y: 0 }, 
        debug: import.meta.env.DEV // 🔄 Utilise Vite env
      } 
    },
    scale: {
      mode: mobile ? Phaser.Scale.RESIZE : Phaser.Scale.NONE, // PC : taille fixe
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: dimensions.width,
      height: dimensions.height,
      min: { 
        width: mobile ? 320 : dimensions.width, 
        height: mobile ? 568 : dimensions.height 
      },
      max: { 
        width: mobile ? 414 : dimensions.width, 
        height: mobile ? 896 : dimensions.height 
      }
    },
    fps: { 
      target: mobile ? 30 : 60, // 30 FPS sur mobile pour économiser batterie
      forceSetTimeOut: true 
    },
    // 📱 OPTIONS SPÉCIFIQUES
    fullscreenTarget: mobile ? 'game-container' : null,
    disableContextMenu: mobile,
    powerPreference: mobile ? 'low-power' : 'high-performance'
  };
};

class ChimArenaGame {
  constructor() {
    this.game = null;
    this.currentUser = null;
    this.wsConnection = null;
    this.settings = null;
    this.securityMonitor = null;
    this.isMobile = isMobile();
    
    // 🔍 EXPOSER L'INSTANCE POUR DEBUG
    window.gameInstance = this;
    
    this.init();
  }

  init() {
    console.log(`🎮 Initialisation ChimArena PORTRAIT ${this.isMobile ? 'MOBILE' : 'PC'}...`);
    
    if (!this.checkWebGLSupport()) {
      window.LoadingManager.showError('WebGL non supporté');
      return;
    }
    
    this.loadStoredData();
    this.setupSecurityMonitoring();
    this.setupPortraitOptimizations();
    this.createGame();
    this.setupGlobalEvents();
    
    // 🔍 DIAGNOSTIC AUTOMATIQUE APRÈS INIT
    setTimeout(() => {
      this.runDiagnostic();
    }, 2000);
  }

  // 🔍 === DIAGNOSTIC AUTOMATIQUE ===
  runDiagnostic() {
    console.log('🔍 === DIAGNOSTIC AUTOMATIQUE ===');
    
    // État du jeu
    console.log('Game instance:', !!this.game);
    console.log('Scenes:', this.game?.scene?.getScenes()?.map(s => s.scene.key));
    
    // État auth
    console.log('Auth state:', {
      authenticated: auth.isAuthenticated(),
      hasToken: !!auth.getTokenInfo(),
      tokenInfo: auth.getTokenInfo()
    });
    
    // État Colyseus
    console.log('Colyseus state:', colyseusManager.getDebugInfo());
    
    // Registry Phaser
    if (this.game?.registry) {
      console.log('Phaser registry keys:', Object.keys(this.game.registry.list));
    }
    
    console.log('✅ DIAGNOSTIC TERMINÉ - Utilisez debugColyseus() pour plus de détails');
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
    if (!debugInfo.isAuthenticated && (this.game.scene.isActive('WelcomeScene') || this.game.scene.isActive('ClashMenuScene'))) {
      console.error('❌ État incohérent: Scène authentifiée active mais non authentifié');
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
    
    // 🔍 AUSSI NETTOYER COLYSEUS
    console.log('🌐 Nettoyage Colyseus après perte auth...');
    if (colyseusManager.isColyseusConnected()) {
      colyseusManager.disconnect();
    }
    
    // Rediriger vers AuthScene
    if (this.game && (this.game.scene.isActive('WelcomeScene') || this.game.scene.isActive('ClashMenuScene'))) {
      this.game.scene.start('AuthScene');
    }
    
    // Notifier l'utilisateur
    window.NotificationManager?.error(`Session expirée: ${reason}`);
  }

  // 📱 OPTIMISATIONS FORMAT PORTRAIT
  setupPortraitOptimizations() {
    console.log('📱 Configuration format portrait universel...');
    
    if (this.isMobile) {
      // Empêcher le zoom sur mobile
      const viewport = document.querySelector('meta[name="viewport"]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover');
      }
      
      // Empêcher le défilement/rebond sur iOS
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.height = '100%';
      
      // Masquer la barre d'adresse sur mobile
      setTimeout(() => {
        window.scrollTo(0, 1);
      }, 100);
      
      // Optimisations performance mobile
      this.settings = {
        ...this.getDefaultSettings(),
        graphics: {
          quality: 'medium',
          particles: false,
          animations: true,
          shadows: false
        }
      };
    } else {
      // PC : centrer le jeu et ajouter un fond
      document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      document.body.style.display = 'flex';
      document.body.style.justifyContent = 'center';
      document.body.style.alignItems = 'center';
      document.body.style.minHeight = '100vh';
      document.body.style.margin = '0';
      document.body.style.padding = '20px';
      
      // Style du container de jeu sur PC
      const gameContainer = document.getElementById('game-container');
      if (gameContainer) {
        gameContainer.style.boxShadow = '0 10px 30px rgba(0,0,0,0.3)';
        gameContainer.style.borderRadius = '15px';
        gameContainer.style.overflow = 'hidden';
        gameContainer.style.border = '2px solid rgba(255,255,255,0.1)';
      }
    }
  }

  getDefaultSettings() {
    return {
      audio: { masterVolume: 0.8, musicVolume: 0.7, sfxVolume: 0.9, muted: false },
      graphics: { quality: 'high', particles: true, animations: true, shadows: true },
      gameplay: { autoSelectCards: false, fastMode: false, showDamageNumbers: true, confirmActions: true },
      interface: { language: 'fr', theme: 'default', showTooltips: true, compactMode: false },
      security: { autoLockMinutes: 60, requireConfirmForSensitiveActions: true, enableSecurityNotifications: true },
      crypto: { showWalletWarnings: true, confirmTransactions: true, maxDailyWithdrawals: 5 }
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
      const gameConfig = createGameConfig();
      
      // Ajuster la qualité selon l'appareil
      if (this.isMobile) {
        gameConfig.render.antialias = false;
        gameConfig.fps.target = 30;
      }
      
      this.game = new Phaser.Game(gameConfig);
      
      // Enregistrer les données dans le registry Phaser
      this.game.registry.set('gameInstance', this);
      this.game.registry.set('currentUser', this.currentUser);
      this.game.registry.set('settings', this.settings);
      this.game.registry.set('colyseusManager', colyseusManager); // 🔍 EXPOSER COLYSEUS
      
      console.log('🎮 Jeu Phaser créé avec ClashMenuScene + sécurité intégrée + PORTRAIT');
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
      LoadingManager.updateProgress(progress, 100);
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
    
    // Redimensionnement adapté au portrait
    window.addEventListener('resize', () => { 
      if (this.game) {
        this.game.scale.refresh();
        
        // Repositionner si nécessaire sur mobile
        if (this.isMobile) {
          setTimeout(() => {
            window.scrollTo(0, 1);
          }, 100);
        }
      }
    });
    
    // Gestion de l'orientation sur mobile
    window.addEventListener('orientationchange', () => {
      if (this.isMobile) {
        setTimeout(() => {
          window.scrollTo(0, 1);
          if (this.game) {
            this.game.scale.refresh();
          }
        }, 500);
      }
    });
    
    // Fermeture avec nettoyage sécurisé
    window.addEventListener('beforeunload', () => this.onGameClose());
    
    // Détection de tentatives de manipulation du localStorage
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.includes('token')) {
        console.warn('🚨 Tentative de manipulation de token détectée');
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
    
    // Masquer à nouveau la barre d'adresse sur mobile
    if (this.isMobile) {
      setTimeout(() => {
        window.scrollTo(0, 1);
      }, 100);
    }
    
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
    
    // 🔍 NETTOYER COLYSEUS
    if (colyseusManager.isColyseusConnected()) {
      colyseusManager.disconnect();
    }
    
    console.log('🧹 Nettoyage sécurisé terminé');
  }

  // --- Méthodes d'interface pour les scènes ---
  
  clearAuthData() {
    console.log('🧹 Nettoyage des données d\'authentification');
    this.currentUser = null;
    this.game?.registry.set('currentUser', null);
  }

  setCurrentUser(user) {
    console.log('👤 Mise à jour des données utilisateur');
    this.currentUser = user;
    this.game?.registry.set('currentUser', user);
  }

  isAuthenticated() {
    return auth.isAuthenticated();
  }

  getUserWalletInfo() {
    return this.currentUser?.cryptoWallet || null;
  }

  updateUserWalletInfo(walletInfo) {
    if (this.currentUser) {
      this.currentUser.cryptoWallet = walletInfo;
      this.game?.registry.set('currentUser', this.currentUser);
    }
  }

  getSecurityDebugInfo() {
    if (import.meta.env.DEV) { // 🔄 Utilise Vite env
      return {
        apiDebug: config.getDebugInfo(),
        gameInstance: {
          currentUser: !!this.currentUser,
          wsConnection: !!this.wsConnection,
          securityMonitor: !!this.securityMonitor,
        },
        tokenInfo: auth.getTokenInfo(),
        colyseusDebug: colyseusManager.getDebugInfo(), // 🔍 AJOUT
      };
    }
    return null;
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

// --- Utils globaux (mis à jour pour Vite) ---
window.GameUtils = {
  formatNumber: (n) => n >= 1e6 ? (n/1e6).toFixed(1)+'M' : n >= 1e3 ? (n/1e3).toFixed(1)+'K' : n.toString(),
  formatTime: (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`,
  generateId: () => Date.now().toString(36) + Math.random().toString(36).substr(2),
  isValidEmail: (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>'"&]/g, '');
  },
  
  validateUsername: (username) => {
    return /^[a-zA-Z0-9_]{3,20}$/.test(username);
  },

  isValidEthereumAddress: (address) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  },

  formatEthereumAddress: (address) => {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  },

  formatCryptoAmount: (amount, decimals = 4) => {
    if (!amount || isNaN(amount)) return '0';
    return parseFloat(amount).toFixed(decimals);
  },

  isMobileDevice: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768 ||
           ('ontouchstart' in window);
  },

  getOptimalFontSize: (baseSize, isMobile) => {
    return isMobile ? `${Math.max(parseInt(baseSize) * 0.8, 10)}px` : baseSize;
  },

  getOptimalSpacing: (baseSpacing, isMobile) => {
    return isMobile ? baseSpacing * 0.7 : baseSpacing;
  }
};

// Configuration mise à jour pour Vite
window.GameConstants = {
  ARENA: { WIDTH: 400, HEIGHT: 700, BRIDGE_Y: 350 },
  CARDS: { DECK_SIZE: 8, HAND_SIZE: 4, MAX_LEVEL: 14 },
  BATTLE: { DURATION: 180, OVERTIME_DURATION: 60, ELIXIR_MAX: 10, ELIXIR_REGEN: 1000 },
  COLORS: { PRIMARY: 0x3498db, SECONDARY: 0x2ecc71, DANGER: 0xe74c3c, WARNING: 0xf39c12, DARK: 0x2c3e50, LIGHT: 0xecf0f1 },
  
  SECURITY: {
    TOKEN_REFRESH_THRESHOLD: 2 * 60 * 1000,
    MAX_IDLE_TIME: 60 * 60 * 1000,
    SESSION_CHECK_INTERVAL: 30 * 1000,
  },

  CRYPTO: {
    SIGNATURE_VALIDITY: 5 * 60 * 1000,
    MAX_WALLET_CONNECTIONS_PER_HOUR: 3,
    MAX_CRYPTO_ACTIONS_PER_HOUR: 5,
    WITHDRAWAL_COOLDOWN: 24 * 60 * 60 * 1000,
    SUPPORTED_NETWORKS: {
      ETHEREUM: 1,
      POLYGON: 137,
      BSC: 56
    }
  },

  UI: {
    MOBILE_BREAKPOINT: 768,
    PORTRAIT_WIDTH: 400,
    PORTRAIT_HEIGHT: 700,
    HEADER_HEIGHT: 60,
    FOOTER_HEIGHT: 80,
    BUTTON_HEIGHT_MOBILE: 35,
    BUTTON_HEIGHT_DESKTOP: 40,
    FONT_SCALE_MOBILE: 0.8
  }
};

// --- Entrée principale sécurisée avec Vite ---
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOM chargé, démarrage de ChimArena avec Vite...');
  
  // Vérifier la compatibilité de sécurité
  if (!window.crypto || !window.crypto.getRandomValues) {
    console.error('❌ API de sécurité non disponible');
    window.LoadingManager?.showError('Navigateur non compatible avec les fonctionnalités de sécurité');
    return;
  }

  // Vérifier disponibilité MetaMask
  if (typeof window.ethereum !== 'undefined') {
    console.log('🦊 MetaMask détecté');
    window.GameConstants.CRYPTO.METAMASK_AVAILABLE = true;
  } else {
    console.log('⚠️ MetaMask non détecté - Fonctionnalités crypto limitées');
    window.GameConstants.CRYPTO.METAMASK_AVAILABLE = false;
  }

  // Détecter le mode d'affichage
  const mobile = isMobile();
  console.log(`📱 Appareil détecté: ${mobile ? 'MOBILE' : 'PC'} - Mode PORTRAIT activé`);
  
   // 🌐 CONFIGURATION GLOBALE DU JEU
  window.GameConfig = {
    // URLs selon l'environnement
    API_URL: import.meta.env.VITE_API_URL || 'https://chimarena.cloud/api',
    COLYSEUS_URL: import.meta.env.VITE_COLYSEUS_URL || 'wss://chimarena.cloud/ws',
    
    // Pour développement local, décommenter :
    // API_URL: 'http://localhost:3000/api',
    // COLYSEUS_URL: 'ws://localhost:2567',
    
    // Optimisations mobile
    MOBILE_OPTIMIZED: isMobile(),
    
    // Features
    FEATURES: {
      COLYSEUS_ENABLED: true,
      CRYPTO_ENABLED: true,
      DEBUG_ENABLED: import.meta.env.DEV
    }
  };
  
  console.log('⚙️ GameConfig initialisé:', window.GameConfig); 
  
  // Créer l'instance de jeu sécurisée
  window.ChimArenaInstance = new ChimArenaGame();
  
  console.log('✅ ChimArena avec Vite initialisé');
  console.log('🔐 Tokens stockés UNIQUEMENT en mémoire');
  console.log('🛡️ Monitoring de sécurité actif');
  console.log('📱 Mode PORTRAIT universel activé');
  console.log('💰 Support crypto: ' + (window.GameConstants.CRYPTO.METAMASK_AVAILABLE ? 'ACTIVÉ' : 'LIMITÉ'));
  console.log('🏆 Menu Clash Royale authentique prêt !');
  console.log('⚡ Vite HMR activé pour développement');
  
  // 🔍 === FONCTIONS DEBUG SUPPLÉMENTAIRES ===
  
  // Debug complet de l'application
  window.debugApp = () => {
    console.group('🔍 === DEBUG APPLICATION COMPLÈTE ===');
    
    // État général
    console.log('🎮 ChimArenaInstance:', !!window.ChimArenaInstance);
    console.log('🎮 Game Phaser:', !!window.ChimArenaInstance?.game);
    
    // Scènes
    if (window.ChimArenaInstance?.game?.scene) {
      const scenes = window.ChimArenaInstance.game.scene.getScenes();
      console.log('🎬 Scènes actives:', scenes.map(s => ({
        key: s.scene.key,
        active: s.scene.isActive(),
        visible: s.scene.isVisible()
      })));
    }
    
    // Auth
    console.log('🔐 Authentification:', {
      isAuthenticated: auth.isAuthenticated(),
      tokenInfo: auth.getTokenInfo(),
      apiDebug: config.getDebugInfo()
    });
    
    // Colyseus
    console.log('🌐 Colyseus:', colyseusManager.getDebugInfo());
    
    // Registry Phaser
    if (window.ChimArenaInstance?.game?.registry) {
      console.log('📊 Registry Phaser:', window.ChimArenaInstance.game.registry.list);
    }
    
    console.groupEnd();
    
    return {
      game: !!window.ChimArenaInstance?.game,
      scenes: window.ChimArenaInstance?.game?.scene?.getScenes()?.map(s => s.scene.key),
      auth: auth.isAuthenticated(),
      colyseus: colyseusManager.isColyseusConnected()
    };
  };
  
  // Test connexion Colyseus forcée
  window.testColyseusConnection = async () => {
    console.log('🧪 TEST CONNEXION COLYSEUS FORCÉE...');
    
    try {
      // Vérifier auth d'abord
      if (!auth.isAuthenticated()) {
        console.error('❌ Pas authentifié pour test Colyseus');
        return false;
      }
      
      // Forcer déconnexion
      console.log('🔌 Déconnexion forcée...');
      await colyseusManager.forceDisconnect();
      
      // Attendre un peu
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reconnecter
      console.log('🔌 Reconnexion...');
      const success = await colyseusManager.connect();
      
      console.log('✅ Test terminé:', success ? 'SUCCÈS' : 'ÉCHEC');
      return success;
      
    } catch (error) {
      console.error('❌ Erreur test Colyseus:', error);
      return false;
    }
  };
  
  // Forcer une scène spécifique
  window.forceScene = (sceneName) => {
    if (window.ChimArenaInstance?.game?.scene) {
      console.log(`🎬 Force scene: ${sceneName}`);
      window.ChimArenaInstance.game.scene.start(sceneName);
    } else {
      console.error('❌ Pas de game/scene disponible');
    }
  };
  
  // Debug en développement
  if (import.meta.env.DEV) {
    console.log('🔧 Mode debug Vite activé');
    
    // Exposer auth et config globalement pour debug
    window.auth = auth;
    window.config = config;
    
    // Function de debug sécurité
    window.getSecurityDebug = () => window.ChimArenaInstance?.getSecurityDebugInfo();
    
    // Auto-diagnostic au démarrage
    setTimeout(() => {
      console.log('🔍 AUTO-DIAGNOSTIC AU DÉMARRAGE:');
      window.debugApp();
    }, 3000);
  }
  
  console.log(`
🎯 === FONCTIONS DEBUG DISPONIBLES ===

🔍 GÉNÉRAL:
▶️ debugApp() - État complet de l'application
▶️ debugColyseus() - État détaillé Colyseus
▶️ colyseusHistory() - Historique connexions

🧪 TESTS:
▶️ testColyseusConnection() - Test connexion forcée
▶️ forceScene('AuthScene') - Forcer une scène

🛠️ CONTRÔLES:
▶️ colyseusStop() - Arrêt d'urgence Colyseus
▶️ colyseusReset() - Reset complet Colyseus
▶️ colyseusReconnect() - Force reconnexion

🔐 SÉCURITÉ (DEV):
▶️ getSecurityDebug() - Debug sécurité complet
▶️ auth.getTokenInfo() - Info token JWT
▶️ config.getDebugInfo() - Debug API client

ESSAYEZ: debugColyseus() pour voir l'état Colyseus !
  `);
});

export default ChimArenaGame;
