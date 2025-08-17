import Phaser from 'phaser';

export default class AuthScene extends Phaser.Scene {
    constructor() {
        super({ key: 'AuthScene' });
        
        // État de la scène
        this.isLoginMode = true;
        this.isLoading = false;
        
        // Éléments de l'interface
        this.inputs = {};
        this.buttons = {};
        this.activeInput = null;
        
        // Données du formulaire
        this.formData = {
            email: '',
            password: '',
            username: ''
        };
    }

    preload() {
        // Créer les textures pour les éléments UI
        this.createUITextures();
    }

    create() {
        console.log('🔐 Scène d\'authentification créée');
        
        // Référence à l'instance principale
        this.gameInstance = this.registry.get('gameInstance');
        
        // Vérifier si l'utilisateur est déjà connecté
        if (this.gameInstance.isAuthenticated()) {
            this.scene.start('MenuScene');
            return;
        }
        
        // Créer l'interface
        this.createBackground();
        this.createTitle();
        this.createForm();
        this.createButtons();
        this.createToggleLink();
        this.createFooter();
        
        // Configuration des événements
        this.setupKeyboardEvents();
        
        // Animation d'entrée
        this.playEntranceAnimation();
    }

    createUITextures() {
        const graphics = this.add.graphics();
        
        // Texture pour les boutons normaux
        graphics.clear();
        graphics.fillStyle(0x3498db);
        graphics.fillRoundedRect(0, 0, 200, 50, 10);
        graphics.generateTexture('button-normal', 200, 50);
        
        // Texture pour les boutons survolés
        graphics.clear();
        graphics.fillStyle(0x2980b9);
        graphics.fillRoundedRect(0, 0, 200, 50, 10);
        graphics.generateTexture('button-hover', 200, 50);
        
        // Texture pour les boutons désactivés
        graphics.clear();
        graphics.fillStyle(0x7f8c8d);
        graphics.fillRoundedRect(0, 0, 200, 50, 10);
        graphics.generateTexture('button-disabled', 200, 50);
        
        // Texture pour les inputs
        graphics.clear();
        graphics.fillStyle(0x34495e);
        graphics.lineStyle(2, 0x3498db);
        graphics.fillRoundedRect(0, 0, 300, 40, 5);
        graphics.strokeRoundedRect(0, 0, 300, 40, 5);
        graphics.generateTexture('input-bg', 300, 40);
        
        // Texture pour les inputs actifs
        graphics.clear();
        graphics.fillStyle(0x34495e);
        graphics.lineStyle(2, 0x2ecc71);
        graphics.fillRoundedRect(0, 0, 300, 40, 5);
        graphics.strokeRoundedRect(0, 0, 300, 40, 5);
        graphics.generateTexture('input-active', 300, 40);
        
        graphics.destroy();
    }

    createBackground() {
        const { width, height } = this.scale;
        
        // Dégradé de fond
        const background = this.add.graphics();
        background.fillGradientStyle(0x667eea, 0x667eea, 0x764ba2, 0x764ba2);
        background.fillRect(0, 0, width, height);
        
        // Particules d'arrière-plan
        this.createBackgroundParticles();
    }

    createBackgroundParticles() {
        const { width, height } = this.scale;
        
        for (let i = 0; i < 30; i++) {
            const star = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(1, 3),
                0xffffff,
                0.3
            );
            
            this.tweens.add({
                targets: star,
                alpha: { from: 0.1, to: 0.6 },
                duration: Phaser.Math.Between(2000, 4000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    createTitle() {
        const { width } = this.scale;
        
        // Logo principal
        this.titleLogo = this.add.text(width / 2, 120, 'ChimArena', {
            fontSize: '48px',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: '#2c3e50',
            strokeThickness: 4
        }).setOrigin(0.5);
        
        // Sous-titre dynamique
        this.titleSubtext = this.add.text(width / 2, 170, 'Connexion', {
            fontSize: '24px',
            fontFamily: 'Roboto, sans-serif',
            fill: '#ecf0f1'
        }).setOrigin(0.5);
        
        // Version
        this.add.text(width - 10, height - 10, `v${window.GameConfig.VERSION}`, {
            fontSize: '12px',
            fill: '#bdc3c7'
        }).setOrigin(1, 1);
    }

    createForm() {
        const { width } = this.scale;
        const formY = 240;
        
        // Email
        this.add.text(width / 2 - 150, formY, 'Email:', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif'
        });
        
        this.inputs.email = this.createInput(width / 2 - 150, formY + 25, 'Entrez votre email');
        
        // Mot de passe
        this.add.text(width / 2 - 150, formY + 80, 'Mot de passe:', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif'
        });
        
        this.inputs.password = this.createInput(width / 2 - 150, formY + 105, 'Mot de passe', true);
        
        // Nom d'utilisateur (caché par défaut)
        this.usernameLabel = this.add.text(width / 2 - 150, formY + 160, 'Nom d\'utilisateur:', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            visible: false
        });
        
        this.inputs.username = this.createInput(width / 2 - 150, formY + 185, 'Nom d\'utilisateur');
        this.inputs.username.container.setVisible(false);
    }

    createInput(x, y, placeholder, isPassword = false) {
        const container = this.add.container(x, y);
        
        // Background de l'input
        const bg = this.add.image(0, 0, 'input-bg').setOrigin(0, 0);
        
        // Texte saisi
        const textInput = this.add.text(10, 10, '', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fixedWidth: 280,
            fixedHeight: 20
        });
        
        // Placeholder
        const placeholderText = this.add.text(10, 10, placeholder, {
            fontSize: '16px',
            fill: '#7f8c8d',
            fontFamily: 'Roboto, sans-serif',
            fixedWidth: 280,
            fixedHeight: 20
        });
        
        container.add([bg, textInput, placeholderText]);
        
        // Zone interactive
        const hitArea = this.add.zone(x + 150, y + 20, 300, 40)
            .setInteractive()
            .on('pointerdown', () => {
                this.activateInput(container, textInput, placeholderText, isPassword);
            });
        
        // Propriétés personnalisées
        container.bg = bg;
        container.textInput = textInput;
        container.placeholderText = placeholderText;
        container.hitArea = hitArea;
        container.value = '';
        container.isPassword = isPassword;
        container.isActive = false;
        
        return { container, textInput, placeholderText, hitArea };
    }

    activateInput(container, textInput, placeholderText, isPassword) {
        // Désactiver tous les autres inputs
        Object.values(this.inputs).forEach(input => {
            if (input.container !== container) {
                input.container.isActive = false;
                input.container.bg.setTexture('input-bg');
            }
        });
        
        // Activer cet input
        container.isActive = true;
        container.bg.setTexture('input-active');
        this.activeInput = container;
        
        // Mise à jour de l'affichage
        this.updateInputDisplay(container, textInput, placeholderText, isPassword);
    }

    updateInputDisplay(container, textInput, placeholderText, isPassword) {
        const showPlaceholder = container.value === '';
        placeholderText.setVisible(showPlaceholder);
        
        if (isPassword && container.value) {
            textInput.setText('•'.repeat(container.value.length));
        } else {
            textInput.setText(container.value);
        }
    }

    createButtons() {
        const { width } = this.scale;
        
        // Bouton principal (Connexion/Inscription)
        this.buttons.submit = this.add.image(width / 2, 450, 'button-normal')
            .setInteractive()
            .on('pointerover', () => {
                if (!this.isLoading) {
                    this.buttons.submit.setTexture('button-hover');
                }
            })
            .on('pointerout', () => {
                if (!this.isLoading) {
                    this.buttons.submit.setTexture('button-normal');
                }
            })
            .on('pointerdown', () => {
                if (!this.isLoading) {
                    this.handleSubmit();
                }
            });
        
        this.submitButtonText = this.add.text(width / 2, 450, 'Se connecter', {
            fontSize: '18px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
    }

    createToggleLink() {
        const { width } = this.scale;
        
        this.toggleText = this.add.text(width / 2, 520, 'Pas encore de compte ? S\'inscrire', {
            fontSize: '14px',
            fill: '#3498db',
            fontFamily: 'Roboto, sans-serif',
            fontStyle: 'underline'
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerover', () => {
            this.toggleText.setTint(0x2980b9);
        })
        .on('pointerout', () => {
            this.toggleText.clearTint();
        })
        .on('pointerdown', () => {
            if (!this.isLoading) {
                this.toggleMode();
            }
        });
    }

    createFooter() {
        const { width, height } = this.scale;
        
        this.add.text(width / 2, height - 40, 'Propulsé par Phaser.js et Colyseus', {
            fontSize: '12px',
            fill: '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
    }

    setupKeyboardEvents() {
        this.input.keyboard.on('keydown', (event) => {
            if (!this.activeInput) return;
            
            const key = event.key;
            
            if (key === 'Backspace') {
                this.activeInput.value = this.activeInput.value.slice(0, -1);
                this.updateFormData();
            } else if (key === 'Enter') {
                this.handleSubmit();
            } else if (key === 'Tab') {
                event.preventDefault();
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
        const inputs = Object.keys(this.inputs);
        let currentIndex = -1;
        
        // Trouver l'input actuel
        inputs.forEach((key, index) => {
            if (this.inputs[key].container === this.activeInput) {
                currentIndex = index;
            }
        });
        
        // Passer au suivant
        let nextIndex = (currentIndex + 1) % inputs.length;
        
        // Ignorer les inputs cachés
        while (!this.inputs[inputs[nextIndex]].container.visible && nextIndex !== currentIndex) {
            nextIndex = (nextIndex + 1) % inputs.length;
        }
        
        const nextInput = this.inputs[inputs[nextIndex]];
        this.activateInput(
            nextInput.container,
            nextInput.textInput,
            nextInput.placeholderText,
            nextInput.container.isPassword
        );
    }

    updateFormData() {
        // Synchroniser les données du formulaire
        Object.keys(this.inputs).forEach(key => {
            this.formData[key] = this.inputs[key].container.value;
        });
    }

    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        
        if (this.isLoginMode) {
            // Mode connexion
            this.titleSubtext.setText('Connexion');
            this.submitButtonText.setText('Se connecter');
            this.toggleText.setText('Pas encore de compte ? S\'inscrire');
            this.usernameLabel.setVisible(false);
            this.inputs.username.container.setVisible(false);
        } else {
            // Mode inscription
            this.titleSubtext.setText('Inscription');
            this.submitButtonText.setText('S\'inscrire');
            this.toggleText.setText('Déjà un compte ? Se connecter');
            this.usernameLabel.setVisible(true);
            this.inputs.username.container.setVisible(true);
        }
        
        // Réinitialiser les champs
        this.clearForm();
        
        // Animation de transition
        this.tweens.add({
            targets: [this.titleSubtext, this.submitButtonText, this.toggleText],
            alpha: { from: 0.5, to: 1 },
            duration: 300,
            ease: 'Power2'
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
        
        this.formData = { email: '', password: '', username: '' };
        this.activeInput = null;
    }

    async handleSubmit() {
        if (this.isLoading) return;
        
        this.updateFormData();
        
        // Validation côté client
        const validation = this.validateForm();
        if (!validation.isValid) {
            this.showMessage(validation.message, 'error');
            return;
        }
        
        // Démarrer le chargement
        this.setLoading(true);
        
        try {
            const endpoint = this.isLoginMode ? '/auth/login' : '/auth/register';
            const data = this.isLoginMode 
                ? { 
                    email: this.formData.email, 
                    password: this.formData.password 
                }
                : {
                    email: this.formData.email,
                    password: this.formData.password,
                    username: this.formData.username
                };
            
            const response = await this.gameInstance.apiCall(endpoint, {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            // Succès
            this.gameInstance.setAuthToken(response.token);
            this.gameInstance.setCurrentUser(response.user);
            
            this.showMessage(
                this.isLoginMode ? 'Connexion réussie !' : 'Inscription réussie !', 
                'success'
            );
            
            // Transition vers le menu principal
            setTimeout(() => {
                this.scene.start('MenuScene');
            }, 1000);
            
        } catch (error) {
            console.error('Erreur authentification:', error);
            this.showMessage(error.message || 'Une erreur est survenue', 'error');
        } finally {
            this.setLoading(false);
        }
    }

    validateForm() {
        const { email, password, username } = this.formData;
        
        if (!email || !password) {
            return { isValid: false, message: 'Veuillez remplir tous les champs requis' };
        }
        
        if (!window.GameUtils.isValidEmail(email)) {
            return { isValid: false, message: 'Adresse email invalide' };
        }
        
        if (password.length < 6) {
            return { isValid: false, message: 'Le mot de passe doit contenir au moins 6 caractères' };
        }
        
        if (!this.isLoginMode) {
            if (!username) {
                return { isValid: false, message: 'Le nom d\'utilisateur est requis pour l\'inscription' };
            }
            
            if (username.length < 3 || username.length > 20) {
                return { isValid: false, message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères' };
            }
        }
        
        return { isValid: true };
    }

    setLoading(loading) {
        this.isLoading = loading;
        
        if (loading) {
            this.buttons.submit.setTexture('button-disabled');
            this.submitButtonText.setText('Chargement...');
        } else {
            this.buttons.submit.setTexture('button-normal');
            this.submitButtonText.setText(this.isLoginMode ? 'Se connecter' : 'S\'inscrire');
        }
    }

    showMessage(text, type = 'info') {
        // Supprimer le message précédent s'il existe
        if (this.messageText) {
            this.messageText.destroy();
        }
        
        const color = type === 'error' ? '#e74c3c' : type === 'success' ? '#2ecc71' : '#3498db';
        
        this.messageText = this.add.text(this.scale.width / 2, 380, text, {
            fontSize: '14px',
            fill: color,
            fontFamily: 'Roboto, sans-serif',
            align: 'center',
            wordWrap: { width: 400 }
        }).setOrigin(0.5);
        
        // Animation d'apparition
        this.messageText.setAlpha(0);
        this.tweens.add({
            targets: this.messageText,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });
        
        // Faire disparaître après 3 secondes
        this.time.delayedCall(3000, () => {
            if (this.messageText) {
                this.tweens.add({
                    targets: this.messageText,
                    alpha: 0,
                    duration: 300,
                    ease: 'Power2',
                    onComplete: () => {
                        if (this.messageText) {
                            this.messageText.destroy();
                            this.messageText = null;
                        }
                    }
                });
            }
        });
    }

    playEntranceAnimation() {
        // Animation d'entrée des éléments
        const elements = [
            this.titleLogo,
            this.titleSubtext,
            ...Object.values(this.inputs).map(input => input.container),
            this.buttons.submit,
            this.submitButtonText,
            this.toggleText
        ];

        elements.forEach((element, index) => {
            if (element) {
                element.setAlpha(0);
                element.setY(element.y + 50);
                
                this.tweens.add({
                    targets: element,
                    alpha: 1,
                    y: element.y - 50,
                    duration: 600,
                    delay: index * 100,
                    ease: 'Back.easeOut'
                });
            }
        });
    }

    update() {
        // Mise à jour continue de la scène si nécessaire
    }
}
