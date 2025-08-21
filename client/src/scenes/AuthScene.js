// client/src/scenes/AuthScene.js - AVEC GESTION COLYSEUS

import Phaser from 'phaser';
import { auth } from '../api';
import { default as colyseusManager } from '../managers/ColyseusManager.js';

export default class AuthScene extends Phaser.Scene {
  constructor() {
    super({ key: 'AuthScene' });

    this.isLoginMode = true;
    this.isLoading = false;

    this.inputs = {};
    this.buttons = {};
    this.activeInput = null;

    this.formData = { email: '', password: '', username: '' };
  }

  preload() {
    this.createUITextures();
    this.load.image('mainmenu-bg', 'background/mainmenu.png');
  }

  create() {
    console.log('🔐 AuthScene créée');
    
    this.gameInstance = this.registry.get('gameInstance');

    // 🌐 NETTOYAGE COLYSEUS AU DÉMARRAGE (IMPORTANT)
    this.cleanupColyseus();

    // 🔐 VÉRIFICATION AUTHENTIFICATION AVEC NOUVEAU CLIENT
    if (auth.isAuthenticated()) {
        console.log('✅ Utilisateur déjà authentifié - Redirection vers WelcomeScene');
        this.scene.start('WelcomeScene');
        return;
    }

    this.createBackground();
    this.createTitle();
    this.createForm();
    this.createButtons();
    this.createToggleLink();
    this.createFooter();
    this.setupKeyboardEvents();
    this.playEntranceAnimation();
    this.setupSecurityHooks();

    // 🔄 ESSAYER LE REFRESH APRÈS L'INITIALISATION
    this.time.delayedCall(500, () => {
        this.attemptAutoLogin();
    });
  }

  // 🌐 NETTOYAGE COLYSEUS (NOUVEAU)
  cleanupColyseus() {
    console.log('🧹 Nettoyage Colyseus dans AuthScene...');
    
    try {
      // Vérifier si Colyseus est connecté
      if (colyseusManager.isColyseusConnected()) {
        console.log('🌐 Déconnexion Colyseus (utilisateur non authentifié)');
        
        // Déconnexion asynchrone sans attendre
        colyseusManager.disconnect().catch(error => {
          console.warn('⚠️ Erreur déconnexion Colyseus:', error);
        });
      }
      
      // Nettoyer tous les callbacks
      colyseusManager.off('connected');
      colyseusManager.off('disconnected');
      colyseusManager.off('profileUpdated');
      colyseusManager.off('globalStatsUpdated');
      colyseusManager.off('playersUpdated');
      colyseusManager.off('error');
      
      // Arrêter le heartbeat
      colyseusManager.stopHeartbeat();
      
      console.log('✅ Nettoyage Colyseus terminé');
      
    } catch (error) {
      console.warn('⚠️ Erreur nettoyage Colyseus:', error);
    }
  }

  async attemptAutoLogin() {
    try {
        console.log('🔄 Tentative de récupération de session...');
        
        const token = await auth.refreshToken();
        
        if (token) {
            console.log('✅ Session récupérée automatiquement');
            
            const userData = await auth.getMe();
            if (userData.success && userData.user) {
                this.gameInstance.setCurrentUser(userData.user);
            }
            
            // 🆕 REDIRECTION VERS WELCOMESCENE AU LIEU DE MENUSCENE
            console.log('🏠 Redirection automatique vers WelcomeScene');
            this.scene.start('WelcomeScene');
            return;
        }
    } catch (error) {
        console.log('❌ Impossible de récupérer la session:', error.message);
    }
  }
  
  // MÉTHODE HOOKS SÉCURITÉ (MODIFIÉE)
  setupSecurityHooks() {
    // Vérifier que auth et config sont disponibles
    if (!auth || !auth.config) {
        console.warn('⚠️ Client API non encore initialisé');
        return;
    }
    
    // Hook pour déconnexion automatique
    if (auth.config.onAuthenticationLost) {
        auth.config.onAuthenticationLost((reason) => {
            console.warn('🚨 Authentification perdue:', reason);
            this.gameInstance?.clearAuthData();
            
            // 🌐 NETTOYER COLYSEUS AUSSI
            this.cleanupColyseus();
            
            window.NotificationManager.error(`Session expirée: ${reason}`);
            
            if (this.scene.key !== 'AuthScene') {
                this.scene.start('AuthScene');
            }
        });
    }
    
    // Hook pour refresh automatique
    if (auth.config.onTokenRefreshed) {
        auth.config.onTokenRefreshed(() => {
            console.log('🔄 Token rafraîchi automatiquement');
        });
    }
  }
  
  // ---------- UI base (INCHANGÉE) ----------

  createUITextures() {
    const g = this.add.graphics();

    g.clear(); g.fillStyle(0x3498db); g.fillRoundedRect(0,0,200,50,10); g.generateTexture('button-normal',200,50);
    g.clear(); g.fillStyle(0x2980b9); g.fillRoundedRect(0,0,200,50,10); g.generateTexture('button-hover',200,50);
    g.clear(); g.fillStyle(0x7f8c8d); g.fillRoundedRect(0,0,200,50,10); g.generateTexture('button-disabled',200,50);

    g.clear(); g.fillStyle(0x34495e); g.lineStyle(2,0x3498db);
    g.fillRoundedRect(0,0,300,40,5); g.strokeRoundedRect(0,0,300,40,5); g.generateTexture('input-bg',300,40);

    g.clear(); g.fillStyle(0x34495e); g.lineStyle(2,0x2ecc71);
    g.fillRoundedRect(0,0,300,40,5); g.strokeRoundedRect(0,0,300,40,5); g.generateTexture('input-active',300,40);

    g.destroy();
  }

  createBackground() {
    const { width, height } = this.scale;
    
    // Ajouter l'image
    const bg = this.add.image(width / 2, height / 2, 'mainmenu-bg')
      .setOrigin(0.5)
      .setDisplaySize(width, height);
    
    this.createBackgroundParticles();
  }

  createBackgroundParticles() {
    const { width, height } = this.scale;
    for (let i = 0; i < 30; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0,width),
        Phaser.Math.Between(0,height),
        Phaser.Math.Between(1,3),
        0xffffff, 0.3
      );
      this.tweens.add({
        targets: star,
        alpha: { from: 0.1, to: 0.6 },
        duration: Phaser.Math.Between(2000,4000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
      });
    }
  }

  createTitle() {
    const { width, height } = this.scale;

    this.titleLogo = this.add.text(width/2, 120, 'ChimArena', {
        fontSize: '48px', fontFamily: 'Orbitron, sans-serif', fontWeight: 'bold',
        fill: '#ffffff', stroke: '#2c3e50', strokeThickness: 4
    }).setOrigin(0.5);

    this.titleSubtext = this.add.text(width/2, 170, this.isLoginMode ? 'Connexion Sécurisée' : 'Inscription Sécurisée', {
        fontSize: '24px', fontFamily: 'Roboto, sans-serif', fill: '#ecf0f1'
    }).setOrigin(0.5);

    // 🔐 Indicateur de sécurité avec état
    this.securityIndicator = this.add.text(width/2, 190, '🔄 Vérification de session...', {
        fontSize: '12px', fontFamily: 'Roboto, sans-serif', fill: '#f39c12'
    }).setOrigin(0.5);

    // 🌐 INDICATEUR COLYSEUS (NOUVEAU)
    this.colyseusIndicator = this.add.text(width/2, 205, '🌐 Mode hors ligne', {
        fontSize: '10px', fontFamily: 'Roboto, sans-serif', fill: '#95a5a6'
    }).setOrigin(0.5);

    // Mettre à jour après tentative de récupération
    this.time.delayedCall(1000, () => {
        if (this.securityIndicator) {
            this.securityIndicator.setText('🔐 Sécurité crypto-grade activée');
            this.securityIndicator.setFill('#2ecc71');
        }
    });

    const version = (window.GameConfig && window.GameConfig.VERSION) ? `v${window.GameConfig.VERSION}` : '';
    this.add.text(width - 10, height - 10, version, { fontSize: '12px', fill: '#bdc3c7' }).setOrigin(1,1);

    // 💰 Indicateur MetaMask
    const metamaskStatus = window.GameConstants?.CRYPTO?.METAMASK_AVAILABLE;
    if (metamaskStatus !== undefined) {
        const metamaskText = metamaskStatus ? '🦊 MetaMask détecté' : '⚠️ MetaMask requis pour crypto';
        const metamaskColor = metamaskStatus ? '#f6851b' : '#95a5a6';
        
        this.add.text(width/2, height - 50, metamaskText, {
            fontSize: '10px', fontFamily: 'Roboto, sans-serif', fill: metamaskColor
        }).setOrigin(0.5);
    }
  }

  // ---------- Form (INCHANGÉE) ----------

  createForm() {
    const { width } = this.scale;
    const y = 240;

    this.add.text(width/2 - 150, y, 'Email:', { fontSize: '16px', fill:'#fff', fontFamily:'Roboto, sans-serif' });
    this.inputs.email = this.createInput(width/2 - 150, y+25, 'Entrez votre email');

    this.add.text(width/2 - 150, y+80, 'Mot de passe:', { fontSize:'16px', fill:'#fff', fontFamily:'Roboto, sans-serif' });
    this.inputs.password = this.createInput(width/2 - 150, y+105, 'Mot de passe', true);

    this.usernameLabel = this.add.text(width/2 - 150, y+160, 'Nom d\'utilisateur:', {
      fontSize:'16px', fill:'#fff', fontFamily:'Roboto, sans-serif', visible:false
    });

    this.inputs.username = this.createInput(width/2 - 150, y+185, 'Nom d\'utilisateur');
    this.inputs.username.container.setVisible(false);
  }

  createInput(x, y, placeholder, isPassword = false) {
    const container = this.add.container(x,y);
    const bg = this.add.image(0,0,'input-bg').setOrigin(0,0);

    const textInput = this.add.text(10,10,'', {
      fontSize:'16px', fill:'#fff', fontFamily:'Roboto, sans-serif',
      fixedWidth:280, fixedHeight:20
    });

    const placeholderText = this.add.text(10,10,placeholder, {
      fontSize:'16px', fill:'#7f8c8d', fontFamily:'Roboto, sans-serif',
      fixedWidth:280, fixedHeight:20
    });

    container.add([bg, textInput, placeholderText]);

    const zone = this.add.zone(x+150, y+20, 300, 40)
      .setInteractive()
      .on('pointerdown', () => this.activateInput(container, textInput, placeholderText, isPassword));

    container.bg = bg;
    container.textInput = textInput;
    container.placeholderText = placeholderText;
    container.hitArea = zone;
    container.value = '';
    container.isPassword = isPassword;
    container.isActive = false;

    return { container, textInput, placeholderText, hitArea: zone };
  }

  activateInput(container, textInput, placeholderText, isPassword) {
    Object.values(this.inputs).forEach(input => {
      if (input.container !== container) {
        input.container.isActive = false;
        input.container.bg.setTexture('input-bg');
      }
    });

    container.isActive = true;
    container.bg.setTexture('input-active');
    this.activeInput = container;

    this.updateInputDisplay(container, textInput, placeholderText, isPassword);
  }

  updateInputDisplay(container, textInput, placeholderText, isPassword) {
    const empty = container.value === '';
    placeholderText.setVisible(empty);
    textInput.setText(isPassword && container.value ? '•'.repeat(container.value.length) : container.value);
  }

  // ---------- Buttons & Links (INCHANGÉES) ----------

  createButtons() {
    const { width } = this.scale;

    this.buttons.submit = this.add.image(width/2, 450, 'button-normal')
      .setInteractive()
      .on('pointerover', () => { if (!this.isLoading) this.buttons.submit.setTexture('button-hover'); })
      .on('pointerout',  () => { if (!this.isLoading) this.buttons.submit.setTexture('button-normal'); })
      .on('pointerdown', () => { if (!this.isLoading) this.handleSubmit(); });

    this.submitButtonText = this.add.text(width/2, 450, 'Se connecter', {
      fontSize:'18px', fill:'#fff', fontFamily:'Roboto, sans-serif', fontWeight:'bold'
    }).setOrigin(0.5);
  }

  createToggleLink() {
    const { width } = this.scale;
    this.toggleText = this.add.text(width/2, 520, 'Pas encore de compte ? S\'inscrire', {
      fontSize:'14px', fill:'#3498db', fontFamily:'Roboto, sans-serif', fontStyle:'underline'
    })
    .setOrigin(0.5).setInteractive()
    .on('pointerover', () => this.toggleText.setTint(0x2980b9))
    .on('pointerout',  () => this.toggleText.clearTint())
    .on('pointerdown', () => { if (!this.isLoading) this.toggleMode(); });
  }

  createFooter() {
    const { width, height } = this.scale;
    this.add.text(width/2, height-40, 'Propulsé par Phaser.js et Colyseus', {
      fontSize:'12px', fill:'#95a5a6', fontFamily:'Roboto, sans-serif'
    }).setOrigin(0.5);
  }

  // ---------- Input handling (INCHANGÉES) ----------

  setupKeyboardEvents() {
    this.input.keyboard.on('keydown', (e) => {
      if (!this.activeInput) return;
      const key = e.key;

      if (key === 'Backspace') {
        this.activeInput.value = this.activeInput.value.slice(0, -1);
        this.updateFormData();
      } else if (key === 'Enter') {
        this.handleSubmit();
      } else if (key === 'Tab') {
        e.preventDefault();
        this.focusNextInput();
      } else if (key.length === 1) {
        this.activeInput.value += key;
        this.updateFormData();
      }

      this.updateInputDisplay(
        this.activeInput,
        this.activeInput.textInput,
        this.activeInput.placeholderText,
        this.activeInput.isPassword
      );
    });
  }

  focusNextInput() {
    const keys = Object.keys(this.inputs);
    let idx = keys.findIndex(k => this.inputs[k].container === this.activeInput);
    if (idx < 0) idx = 0;

    let next = (idx + 1) % keys.length;
    while (!this.inputs[keys[next]].container.visible && next !== idx) {
      next = (next + 1) % keys.length;
    }

    const target = this.inputs[keys[next]];
    this.activateInput(target.container, target.textInput, target.placeholderText, target.container.isPassword);
  }

  updateFormData() {
    Object.keys(this.inputs).forEach(k => { this.formData[k] = this.inputs[k].container.value; });
  }

  toggleMode() {
    this.isLoginMode = !this.isLoginMode;

    if (this.isLoginMode) {
      this.titleSubtext.setText('Connexion');
      this.submitButtonText.setText('Se connecter');
      this.toggleText.setText('Pas encore de compte ? S\'inscrire');
      this.usernameLabel.setVisible(false);
      this.inputs.username.container.setVisible(false);
    } else {
      this.titleSubtext.setText('Inscription');
      this.submitButtonText.setText('S\'inscrire');
      this.toggleText.setText('Déjà un compte ? Se connecter');
      this.usernameLabel.setVisible(true);
      this.inputs.username.container.setVisible(true);
    }
    this.clearForm();

    this.tweens.add({
      targets:[this.titleSubtext,this.submitButtonText,this.toggleText],
      alpha:{ from:0.5, to:1 }, duration:300, ease:'Power2'
    });
  }

  clearForm() {
    Object.values(this.inputs).forEach(input => {
      input.container.value = '';
      input.container.isActive = false;
      input.container.bg.setTexture('input-bg');
      input.textInput.setText('');
      input.placeholderText.setVisible(true);
    });
    this.formData = { email:'', password:'', username:'' };
    this.activeInput = null;
  }

  // ---------- Submit (MODIFIÉ POUR WELCOMESCENE) ----------

  async handleSubmit() {
  if (this.isLoading) return;

  this.updateFormData();
  const v = this.validateForm();
  if (!v.isValid) {
    this.showMessage(v.message, 'error');
    return;
  }

  this.setLoading(true);
  
  try {
    let response;
    
    if (this.isLoginMode) {
      console.log('🔐 Tentative de connexion sécurisée...');
      response = await auth.login(this.formData.email, this.formData.password);
    } else {
      console.log('🔐 Tentative d\'inscription sécurisée...');
      response = await auth.register({
        email: this.formData.email,
        password: this.formData.password,
        username: this.formData.username
      });
    }

    if (response.success) {
      console.log('✅ Authentification réussie');
      
      if (response.user) {
        this.gameInstance.setCurrentUser(response.user);
      }

      // Récupérer les données complètes
      try {
        const userData = await auth.getMe();
        if (userData.success && userData.user) {
          this.gameInstance.setCurrentUser(userData.user);
        }
      } catch (error) {
        console.warn('⚠️ Impossible de récupérer les données utilisateur:', error);
      }

      // 🌐 Connexion Colyseus après authentification
      try {
        console.log("🌐 Connexion Colyseus après login...");
        await colyseusManager.connect();
        console.log("🌐 Connexion Colyseus OK");
      } catch (err) {
        console.error("❌ Connexion Colyseus échouée:", err.message);
      }

      this.showMessage(
        this.isLoginMode ? 'Connexion sécurisée réussie !' : 'Inscription sécurisée réussie !', 
        'success'
      );

      // 🆕 REDIRECTION VERS WELCOMESCENE
      console.log('🏠 Redirection vers WelcomeScene après authentification');
      setTimeout(() => this.scene.start('WelcomeScene'), 800);
    } else {
      throw new Error(response.message || 'Échec de l\'authentification');
    }

  } catch (error) {
    console.error('❌ Erreur authentification:', error);
    
    let errorMessage = error.message;
    if (error.message.includes('réseau') || error.message.includes('Network')) {
      errorMessage = 'Problème de connexion réseau';
    } else if (error.status === 429) {
      errorMessage = 'Trop de tentatives, attendez quelques minutes';
    }
    
    this.showMessage(errorMessage, 'error');
  } finally {
    this.setLoading(false);
  }
}


  validateForm() {
    const { email, password, username } = this.formData;

    if (!email || !password) return { isValid:false, message:'Veuillez remplir tous les champs requis' };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return { isValid:false, message:'Adresse email invalide' };
    if (password.length < 6) return { isValid:false, message:'Le mot de passe doit contenir au moins 6 caractères' };

    if (!this.isLoginMode) {
      if (!username) return { isValid:false, message:'Le nom d\'utilisateur est requis' };
      if (username.length < 3 || username.length > 20) return { isValid:false, message:'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères' };
    }
    return { isValid: true };
  }

  // ---------- UX helpers (INCHANGÉES) ----------

  setLoading(loading) {
    this.isLoading = loading;
    this.buttons.submit.setTexture(loading ? 'button-disabled' : 'button-normal');
    this.submitButtonText.setText(loading ? 'Chargement...' : (this.isLoginMode ? 'Se connecter' : 'S\'inscrire'));
  }

  showMessage(text, type = 'info') {
    if (this.messageText) this.messageText.destroy();

    const color = type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db';
    this.messageText = this.add.text(this.scale.width/2, 380, text, {
      fontSize:'14px', fill: color, fontFamily:'Roboto, sans-serif', align:'center', wordWrap:{ width: 400 }
    }).setOrigin(0.5);

    this.messageText.setAlpha(0);
    this.tweens.add({ targets:this.messageText, alpha:1, duration:300, ease:'Power2' });
    this.time.delayedCall(3000, () => {
      if (!this.messageText) return;
      this.tweens.add({
        targets:this.messageText, alpha:0, duration:300, ease:'Power2',
        onComplete: () => { this.messageText?.destroy(); this.messageText = null; }
      });
    });
  }

  playEntranceAnimation() {
    const elements = [
      this.titleLogo, this.titleSubtext,
      ...Object.values(this.inputs).map(i => i.container),
      this.buttons.submit, this.submitButtonText, this.toggleText
    ];
    elements.forEach((el, i) => {
      if (!el) return;
      el.setAlpha(0); el.setY(el.y + 50);
      this.tweens.add({ targets: el, alpha:1, y:el.y - 50, duration:600, delay:i*100, ease:'Back.easeOut' });
    });
  }

  update() {}

  // 🧹 NETTOYAGE FINAL (MODIFIÉ)
  destroy() {
    console.log('🔥 Destruction AuthScene...');
    
    // 🌐 NETTOYAGE COLYSEUS FINAL
    this.cleanupColyseus();
    
    // Nettoyage des hooks lors de la destruction de la scène
    if (auth && auth.config) {
        if (auth.config.onAuthenticationLost) {
            auth.config.onAuthenticationLost(null);
        }
        if (auth.config.onTokenRefreshed) {
            auth.config.onTokenRefreshed(null);
        }
    }
    
    super.destroy();
    console.log('✅ AuthScene détruite');
  }
}
