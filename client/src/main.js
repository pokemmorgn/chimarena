// client/src/main.js - CONFIGURATION MOBILE MISE À JOUR
import Phaser from 'phaser';
import AuthScene from './scenes/AuthScene';
import WelcomeScene from './scenes/WelcomeScene';
import MenuScene from './scenes/MenuScene';
import { auth, config } from './api';

// 📱 DÉTECTION DE L'APPAREIL
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         window.innerWidth <= 768 ||
         ('ontouchstart' in window);
};

// 📱 DIMENSIONS OPTIMISÉES POUR MOBILE
const getMobileDimensions = () => {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  // Format portrait optimisé pour jeu mobile (comme Clash Royale)
  if (screenHeight > screenWidth) {
    return {
      width: Math.min(screenWidth, 414), // iPhone Pro Max width
      height: Math.min(screenHeight, 896), // iPhone Pro Max height
      portrait: true
    };
  }
  
  // Format paysage pour desktop/tablettes
  return {
    width: Math.min(screenWidth, 800),
    height: Math.min(screenHeight, 600),
    portrait: false
  };
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
    scene: [AuthScene, WelcomeScene, MenuScene],
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
        debug: window.GameConfig.DEBUG 
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
    this.setupPortraitOptimizations(); // Optimisations portrait
    this.createGame();
    this.setupGlobalEvents();
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

  createGame() {
    try {
      const gameConfig = createGameConfig();
      
      // Ajuster la qualité selon l'appareil
      if (this.isMobile) {
        gameConfig.render.antialias = false;
        gameConfig.fps.target = 30;
