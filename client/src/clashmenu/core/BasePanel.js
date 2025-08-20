// client/src/clashmenu/core/BasePanel.js - CLASSE DE BASE POUR TOUS LES PANELS
export default class BasePanel {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.container = null;
        this.isVisible = false;
        this.isInitialized = false;
        
        // Configuration par défaut
        this.config = {
            name: config.name || 'BasePanel',
            title: config.title || 'Panel',
            icon: config.icon || '❓',
            userData: config.userData || null,
            onAction: config.onAction || (() => {}),
            contentStartY: config.contentStartY || 180,
            contentHeight: config.contentHeight || 400,
            enableNavigation: config.enableNavigation !== false,
            enableBackground: config.enableBackground !== false,
            enableTitle: config.enableTitle !== false,
            ...config
        };
        
        // Dimensions
        this.width = scene.scale.width;
        this.height = scene.scale.height;
        this.isMobile = scene.isMobile || false;
        
        // Éléments UI communs
        this.elements = {
            background: null,
            title: null,
            content: null,
            navigation: null
        };
        
        // État
        this.state = {
            loading: false,
            error: null,
            data: null
        };
        
        console.log(`📄 BasePanel créé: ${this.config.name}`);
    }

    // === MÉTHODES VIRTUELLES (À OVERRIDE) ===
    
    /**
     * Créer le contenu spécifique du panel
     * DOIT être implémentée dans les classes filles
     */
    createContent() {
        throw new Error(`createContent() doit être implémentée dans ${this.config.name}`);
    }
    
    /**
     * Mettre à jour les données du panel
     * Peut être overridée dans les classes filles
     */
    updateData(newData) {
        this.config.userData = newData;
        this.refresh();
    }
    
    /**
     * Gérer les actions spécifiques du panel
     * Peut être overridée dans les classes filles
     */
    handleAction(action, data) {
        if (this.config.onAction) {
            this.config.onAction(action, data);
        }
    }
    
    /**
     * Rafraîchir le contenu du panel
     * Peut être overridée dans les classes filles
     */
    refresh() {
        console.log(`🔄 Refresh ${this.config.name}`);
        if (this.elements.content) {
            // Les classes filles peuvent override cette méthode
            // pour rafraîchir leur contenu spécifique
        }
    }

    // === MÉTHODES DE CYCLE DE VIE ===
    
    /**
     * Initialiser le panel (appelé une seule fois)
     */
    init() {
        if (this.isInitialized) return;
        
        console.log(`🏗️ Initialisation ${this.config.name}...`);
        
        // Container principal
        this.container = this.scene.add.container(0, 0);
        this.container.setVisible(false);
        
        // Créer les éléments de base
        if (this.config.enableBackground) {
            this.createBackground();
        }
        
        if (this.config.enableTitle) {
            this.createTitle();
        }
        
        // Container pour le contenu spécifique
        this.elements.content = this.scene.add.container(0, this.config.contentStartY);
        this.container.add(this.elements.content);
        
        // Créer le contenu spécifique (implémenté par les classes filles)
        try {
            this.createContent();
        } catch (error) {
            console.error(`❌ Erreur création contenu ${this.config.name}:`, error);
            this.showError('Erreur lors du chargement du contenu');
        }
        
        this.isInitialized = true;
        console.log(`✅ ${this.config.name} initialisé`);
    }
    
    /**
     * Afficher le panel avec animation
     */
    show(animate = true) {
        if (!this.isInitialized) {
            this.init();
        }
        
        this.container.setVisible(true);
        this.isVisible = true;
        
        if (animate) {
            this.playShowAnimation();
        } else {
            this.container.setAlpha(1);
        }
        
        console.log(`👁️ ${this.config.name} affiché`);
    }
    
    /**
     * Masquer le panel avec animation
     */
    hide(animate = true) {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        
        if (animate) {
            this.playHideAnimation(() => {
                this.container.setVisible(false);
            });
        } else {
            this.container.setVisible(false);
        }
        
        console.log(`🙈 ${this.config.name} masqué`);
    }
    
    /**
     * Détruire le panel
     */
    destroy() {
        console.log(`🗑️ Destruction ${this.config.name}`);
        
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        
        this.isInitialized = false;
        this.isVisible = false;
        
        // Nettoyer les références
        Object.keys(this.elements).forEach(key => {
            this.elements[key] = null;
        });
    }

    // === CRÉATION DES ÉLÉMENTS DE BASE ===
    
    /**
     * Créer le fond du panel
     */
    createBackground() {
        const bg = this.scene.add.graphics();
        
        // Fond principal avec dégradé
        bg.fillGradientStyle(
            0x2F4F4F, 0x2F4F4F,
            0x1C3A3A, 0x1C3A3A,
            1
        );
        bg.fillRoundedRect(15, this.config.contentStartY - 50, this.width - 30, this.config.contentHeight + 50, 12);
        
        // Bordure
        bg.lineStyle(2, 0x4682B4);
        bg.strokeRoundedRect(15, this.config.contentStartY - 50, this.width - 30, this.config.contentHeight + 50, 12);
        
        // Effet de brillance
        const shine = this.scene.add.graphics();
        shine.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0.2, 0.05);
        shine.fillRoundedRect(20, this.config.contentStartY - 45, this.width - 40, 20, 8);
        
        this.elements.background = bg;
        this.container.add([bg, shine]);
    }
    
    /**
     * Créer le titre du panel
     */
    createTitle() {
        const titleText = `${this.config.icon} ${this.config.title}`;
        
        this.elements.title = this.scene.add.text(this.width / 2, this.config.contentStartY - 20, titleText, {
            fontSize: this.isMobile ? '18px' : '22px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700',
            stroke: '#8B4513',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        this.container.add(this.elements.title);
    }

    // === UTILITAIRES POUR LES CLASSES FILLES ===
    
    /**
     * Créer un bouton stylisé réutilisable
     */
    createButton(x, y, width, height, text, color, callback, container = null) {
        const buttonContainer = this.scene.add.container(x, y);
        
        // Convertir couleur hex en nombre si nécessaire
        const colorNum = typeof color === 'string' ? 
            parseInt(color.replace('#', '0x')) : color;
        
        // Ombre
        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.3);
        shadow.fillRoundedRect(-width/2 + 3, -height/2 + 3, width, height, 8);
        
        // Fond
        const bg = this.scene.add.graphics();
        bg.fillStyle(colorNum);
        bg.fillRoundedRect(-width/2, -height/2, width, height, 8);
        
        // Brillance
        const shine = this.scene.add.graphics();
        shine.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0.3, 0.1);
        shine.fillRoundedRect(-width/2 + 2, -height/2 + 2, width, height/3, 6);
        
        // Texte
        const buttonText = this.scene.add.text(0, 0, text, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);
        
        buttonContainer.add([shadow, bg, shine, buttonText]);
        
        // Interactivité
        bg.setInteractive(new Phaser.Geom.Rectangle(-width/2, -height/2, width, height), 
            Phaser.Geom.Rectangle.Contains);
        
        bg.on('pointerdown', () => {
            buttonContainer.setScale(0.95);
            this.scene.time.delayedCall(100, () => {
                buttonContainer.setScale(1);
                if (callback) callback();
            });
        });
        
        bg.on('pointerover', () => {
            buttonContainer.setScale(1.05);
        });
        
        bg.on('pointerout', () => {
            buttonContainer.setScale(1);
        });
        
        // Ajouter au container spécifié ou au contenu
        const targetContainer = container || this.elements.content;
        if (targetContainer) {
            targetContainer.add(buttonContainer);
        }
        
        return buttonContainer;
    }
    
    /**
     * Créer un texte stylisé
     */
    createText(x, y, text, style = {}, container = null) {
        const defaultStyle = {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fill: '#FFFFFF',
            ...style
        };
        
        const textElement = this.scene.add.text(x, y, text, defaultStyle);
        
        // Ajouter au container spécifié ou au contenu
        const targetContainer = container || this.elements.content;
        if (targetContainer) {
            targetContainer.add(textElement);
        }
        
        return textElement;
    }
    
    /**
     * Créer un conteneur graphique
     */
    createGraphics(container = null) {
        const graphics = this.scene.add.graphics();
        
        // Ajouter au container spécifié ou au contenu
        const targetContainer = container || this.elements.content;
        if (targetContainer) {
            targetContainer.add(graphics);
        }
        
        return graphics;
    }
    
    /**
     * Créer une zone interactive invisible
     */
    createInteractiveZone(x, y, width, height, callback, container = null) {
        const zone = this.scene.add.zone(x, y, width, height).setInteractive();
        zone.on('pointerdown', callback);
        
        const targetContainer = container || this.elements.content;
        if (targetContainer) {
            targetContainer.add(zone);
        }
        
        return zone;
    }

    // === ANIMATIONS ===
    
    /**
     * Animation d'apparition
     */
    playShowAnimation() {
        this.container.setAlpha(0);
        this.container.setScale(0.9);
        
        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }
    
    /**
     * Animation de disparition
     */
    playHideAnimation(onComplete = null) {
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 200,
            ease: 'Power2.easeIn',
            onComplete: onComplete
        });
    }
    
    /**
     * Animation de pulsation (pour attirer l'attention)
     */
    pulse(target = null, duration = 500) {
        const element = target || this.container;
        
        this.scene.tweens.add({
            targets: element,
            scaleX: 1.05,
            scaleY: 1.05,
            duration: duration,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
    }
    
    /**
     * Animation de secousse (pour erreurs)
     */
    shake(target = null) {
        const element = target || this.container;
        const originalX = element.x;
        
        this.scene.tweens.add({
            targets: element,
            x: originalX - 5,
            duration: 50,
            yoyo: true,
            repeat: 3,
            ease: 'Power2',
            onComplete: () => {
                element.setX(originalX);
            }
        });
    }

    // === GESTION D'ÉTAT ===
    
    /**
     * Afficher un état de chargement
     */
    showLoading(message = 'Chargement...') {
        this.state.loading = true;
        
        // Créer overlay de chargement
        const loadingOverlay = this.scene.add.graphics();
        loadingOverlay.fillStyle(0x000000, 0.5);
        loadingOverlay.fillRect(0, 0, this.width, this.height);
        
        const loadingText = this.scene.add.text(this.width / 2, this.height / 2, message, {
            fontSize: '16px',
            fontFamily: 'Arial, sans-serif',
            fill: '#FFFFFF'
        }).setOrigin(0.5);
        
        // Animation rotation
        const spinner = this.scene.add.text(this.width / 2, this.height / 2 - 40, '⏳', {
            fontSize: '32px'
        }).setOrigin(0.5);
        
        this.scene.tweens.add({
            targets: spinner,
            rotation: Math.PI * 2,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });
        
        this.elements.loading = { overlay: loadingOverlay, text: loadingText, spinner: spinner };
        this.container.add([loadingOverlay, loadingText, spinner]);
    }
    
    /**
     * Masquer l'état de chargement
     */
    hideLoading() {
        this.state.loading = false;
        
        if (this.elements.loading) {
            this.elements.loading.overlay.destroy();
            this.elements.loading.text.destroy();
            this.elements.loading.spinner.destroy();
            this.elements.loading = null;
        }
    }
    
    /**
     * Afficher une erreur
     */
    showError(message, duration = 3000) {
        this.state.error = message;
        
        const errorBg = this.scene.add.graphics();
        errorBg.fillStyle(0xDC143C, 0.9);
        errorBg.fillRoundedRect(20, 20, this.width - 40, 60, 8);
        
        const errorText = this.scene.add.text(this.width / 2, 50, `❌ ${message}`, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF',
            wordWrap: { width: this.width - 60 },
            align: 'center'
        }).setOrigin(0.5);
        
        this.container.add([errorBg, errorText]);
        
        // Auto-masquer après le délai
        this.scene.time.delayedCall(duration, () => {
            this.scene.tweens.add({
                targets: [errorBg, errorText],
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    errorBg.destroy();
                    errorText.destroy();
                    this.state.error = null;
                }
            });
        });
        
        // Animation d'entrée
        errorBg.setAlpha(0);
        errorText.setAlpha(0);
        this.scene.tweens.add({
            targets: [errorBg, errorText],
            alpha: 1,
            duration: 200
        });
    }

    // === GETTERS ===
    
    getContainer() {
        return this.container;
    }
    
    isShown() {
        return this.isVisible;
    }
    
    getConfig() {
        return { ...this.config };
    }
    
    getState() {
        return { ...this.state };
    }
    
    getUserData() {
        return this.config.userData;
    }

    // === HELPERS ===
    
    /**
     * Wrapper pour les actions avec gestion d'erreur
     */
    safeAction(action, data = null) {
        try {
            this.handleAction(action, data);
        } catch (error) {
            console.error(`❌ Erreur action ${action} dans ${this.config.name}:`, error);
            this.showError(`Erreur lors de l'action: ${action}`);
        }
    }
    
    /**
     * Débounce pour éviter les clics multiples
     */
    debounce(func, delay = 500) {
        if (this._debounceTimer) {
            clearTimeout(this._debounceTimer);
        }
        
        this._debounceTimer = setTimeout(() => {
            func();
            this._debounceTimer = null;
        }, delay);
    }
    
    /**
     * Logger spécifique au panel
     */
    log(message, type = 'info') {
        const prefix = `[${this.config.name}]`;
        
        switch (type) {
            case 'error':
                console.error(`❌ ${prefix} ${message}`);
                break;
            case 'warn':
                console.warn(`⚠️ ${prefix} ${message}`);
                break;
            case 'success':
                console.log(`✅ ${prefix} ${message}`);
                break;
            default:
                console.log(`ℹ️ ${prefix} ${message}`);
        }
    }
}
