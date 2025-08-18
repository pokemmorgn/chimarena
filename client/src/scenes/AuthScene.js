// client/src/scenes/AuthScene.js
import Phaser from 'phaser';
import { auth } from '../api';

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
    this.setupSecurityHooks();

    this.setupKeyboardEvents();
    this.playEntranceAnimation();
  }

  // Nouvelle méthode à ajouter
setupSecurityHooks() {
  // Hook pour déconnexion automatique
  auth.config.onAuthenticationLost((reason) => {
    console.warn('🚨 Authentification perdue:', reason);
    this.gameInstance?.clearAuthData();
    window.NotificationManager.error(`Session expirée: ${reason}`);
    
    if (this.scene.key !== 'AuthScene') {
      this.scene.start('AuthScene');
    }
  });

  // Hook pour refresh automatique
  auth.config.onTokenRefreshed(() => {
    console.log('🔄 Token rafraîchi automatiquement');
  });
}
  
  // ---------- UI base ----------

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

    this.titleSubtext = this.add.text(width/2, 170, this.isLoginMode ? 'Connexion' : 'Inscription', {
      fontSize: '24px', fontFamily: 'Roboto, sans-serif', fill: '#ecf0f1'
    }).setOrigin(0.5);

    this.securityIndicator = this.add.text(width/2, 190, '🔐 Sécurité crypto-grade activée', {
  fontSize: '12px', fontFamily: 'Roboto, sans-serif', fill: '#2ecc71'
}).setOrigin(0.5);
    
    const version = (window.GameConfig && window.GameConfig.VERSION) ? `v${window.GameConfig.VERSION}` : '';
    this.add.text(width - 10, height - 10, version, { fontSize: '12px', fill: '#bdc3c7' }).setOrigin(1,1);
  }

  // ---------- Form ----------

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

  // ---------- Buttons & Links ----------

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

  // ---------- Input handling ----------

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

  // ---------- Submit ----------

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

      this.showMessage(
        this.isLoginMode ? 'Connexion sécurisée réussie !' : 'Inscription sécurisée réussie !', 
        'success'
      );

      setTimeout(() => this.scene.start('MenuScene'), 800);
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
      if (!username) return { isValid:false, message:'Le nom d’utilisateur est requis' };
      if (username.length < 3 || username.length > 20) return { isValid:false, message:'Le nom d’utilisateur doit contenir entre 3 et 20 caractères' };
    }
    return { isValid: true };
  }

  // ---------- UX helpers ----------

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

  destroy() {
  // Nettoyage des hooks lors de la destruction de la scène
  auth.config.onAuthenticationLost(null);
  auth.config.onTokenRefreshed(null);
  super.destroy();
}
}
