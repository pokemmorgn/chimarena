// client/src/scenes/AuthScene.js - MODIFIÉ POUR CLIENT SÉCURISÉ
import Phaser from 'phaser';
import { auth } from '../api'; // Nouveau client sécurisé

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
  }

  create() {
    this.gameInstance = this.registry.get('gameInstance');

    // 🔐 VÉRIFICATION AUTHENTIFICATION AVEC NOUVEAU CLIENT
    if (auth.isAuthenticated()) {
      console.log('✅ Utilisateur déjà authentifié');
      this.scene.start('MenuScene');
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

    // 🔧 CONFIGURATION DES HOOKS SÉCURITÉ
    this.setupSecurityHooks();
  }

  setupSecurityHooks() {
    // Hook pour déconnexion automatique
    auth.config.onAuthenticationLost((reason) => {
      console.warn('🚨 Authentification perdue:', reason);
      this.gameInstance?.clearAuthData();
      window.NotificationManager.error(`Session expirée: ${reason}`);
      
      // Si on n'est pas déjà sur AuthScene, y aller
      if (this.scene.key !== 'AuthScene') {
        this.scene.start('AuthScene');
      }
    });

    // Hook pour refresh automatique
    auth.config.onTokenRefreshed((newToken) => {
      console.log('🔄 Token rafraîchi automatiquement');
      // Le gameInstance sera mis à jour automatiquement
    });
  }

  // ---------- UI base (inchangée) ----------
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
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x667eea,0x667eea,0x764ba2,0x764ba2);
    bg.fillRect(0,0,width,height);
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

    // 🔐 Indicateur de sécurité
    this.securityIndicator = this.add.text(width/2, 190, '🔐 Sécurité crypto-grade activée', {
      fontSize: '12px', fontFamily: 'Roboto, sans-serif', fill: '#2ecc71'
    }).setOrigin(0.5);

    const version = (window.GameConfig && window.GameConfig.VERSION) ? `v${window.GameConfig.VERSION}` : '';
    this.add.text(width - 10, height - 10, version, { fontSize: '12px', fill: '#bdc3c7' }).setOrigin(1,1);
  }

  // ---------- Form (inchangée) ----------
  createForm() {
    const { width } = this.scale;
    const y = 260; // Ajusté pour l'indicateur sécurité

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

  // ---------- Buttons & Links ----------
  createButtons() {
    const { width } = this.scale;

    this.buttons.submit = this.add.image(width/2, 470, 'button-normal') // Ajusté position
      .setInteractive()
      .on('pointerover', () => { if (!this.isLoading) this.buttons.submit.setTexture('button-hover'); })
      .on('pointerout',  () => { if (!this.isLoading) this.buttons.submit.setTexture('button-normal'); })
      .on('pointerdown', () => { if (!this.isLoading) this.handleSubmit(); });

    this.submitButtonText = this.add.text(width/2, 470, 'Se connecter', {
      fontSize:'18px', fill:'#fff', fontFamily:'Roboto, sans-serif', fontWeight:'bold'
    }).setOrigin(0.5);
  }

  createToggleLink() {
    const { width } = this.scale;
    this.toggleText = this.add.text(width/2, 540, 'Pas encore de compte ? S\'inscrire', {
      fontSize:'14px', fill:'#3498db', fontFamily:'Roboto, sans-serif', fontStyle:'underline'
    })
    .setOrigin(0.5).setInteractive()
    .on('pointerover', () => this.toggleText.setTint(0x2980b9))
    .on('pointerout',  () => this.toggleText.clearTint())
    .on('pointerdown', () => { if (!this.isLoading) this.toggleMode(); });
  }

  createFooter() {
    const { width, height } = this.scale;
    this.add.text(width/2, height-40, 'Sécurité crypto-grade • Tokens en mémoire uniquement', {
      fontSize:'12px', fill:'#95a5a6', fontFamily:'Roboto, sans-serif'
    }).setOrigin(0.5);
  }

  // ---------- Input handling (inchangée) ----------
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
      this.titleSubtext.setText('Connexion Sécurisée');
      this.submitButtonText.setText('Se connecter');
      this.toggleText.setText('Pas encore de compte ? S\'inscrire');
      this.usernameLabel.setVisible(false);
      this.inputs.username.container.setVisible(false);
    } else {
      this.titleSubtext.setText('Inscription Sécurisée');
      this.submitButtonText.setText('S\'inscrire');
      this.toggleText.setText('Déjà un compte ? Se connecter');
      this.usernameLabel.setVisible(true);
      this.inputs.username.container.setVisible(true);
    }
    this.clearForm();

    this.tweens.add({
      targets:[this.titleSubtext,this.submitButtonText,this.toggleText],
