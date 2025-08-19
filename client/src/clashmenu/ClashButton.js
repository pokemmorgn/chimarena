// client/src/clashmenu/ClashButton.js - BOUTON RÉUTILISABLE CLASH ROYALE
export default class ClashButton {
    constructor(scene, x, y, config = {}) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.container = null;
        
        // Configuration par défaut
        this.config = {
            width: config.width || 160,
            height: config.height || 50,
            text: config.text || 'Bouton',
            color: config.color || '#FFD700',
            textColor: config.textColor || '#FFFFFF',
            fontSize: config.fontSize || (scene.isMobile ? '14px' : '16px'),
            icon: config.icon || null,
            style: config.style || 'primary', // primary, secondary, danger, success
            enabled: config.enabled !== false,
            onClick: config.onClick || (() => {}),
            onHover: config.onHover || null,
            sounds: config.sounds !== false,
            animations: config.animations !== false,
            ...config
        };
        
        // État du bouton
        this.isPressed = false;
        this.isHovered = false;
        this.isEnabled = this.config.enabled;
        
        // Éléments visuels
        this.elements = {
            shadow: null,
            background: null,
            shine: null,
            border: null,
            text: null,
            icon: null,
            particles: null
        };
        
        // Styles prédéfinis
        this.styles = {
            primary: {
                color: 0xFFD700,
                borderColor: 0xFFA500,
                shadowColor: 0xB8860B,
                hoverScale: 1.05,
                glowColor: 0xFFFF00
            },
            secondary: {
                color: 0x4682B4,
                borderColor: 0x5A9FD4,
                shadowColor: 0x2F4F4F,
                hoverScale: 1.03,
                glowColor: 0x87CEEB
            },
            success: {
                color: 0x32CD32,
                borderColor: 0x228B22,
                shadowColor: 0x006400,
                hoverScale: 1.05,
                glowColor: 0x90EE90
            },
            danger: {
                color: 0xDC143C,
                borderColor: 0xB22222,
                shadowColor: 0x8B0000,
                hoverScale: 1.05,
                glowColor: 0xFF6347
            },
            warning: {
                color: 0xFF8C00,
                borderColor: 0xFF7F50,
                shadowColor: 0xFF4500,
                hoverScale: 1.05,
                glowColor: 0xFFA500
            },
            info: {
                color: 0x1E90FF,
                borderColor: 0x0080FF,
                shadowColor: 0x0066CC,
                hoverScale: 1.03,
                glowColor: 0x87CEFA
            },
            disabled: {
                color: 0x696969,
                borderColor: 0x808080,
                shadowColor: 0x2F2F2F,
                hoverScale: 1,
                glowColor: 0x888888
            }
        };
        
        this.create();
    }

    create() {
        // Container principal
        this.container = this.scene.add.container(this.x, this.y);
        
        this.createShadow();
        this.createBackground();
        this.createBorder();
        this.createShine();
        this.createContent();
        this.setupInteractivity();
        
        // Animation d'apparition
        if (this.config.animations) {
            this.playCreationAnimation();
        }
        
        console.log('🔘 ClashButton créé');
    }

    // === OMBRE ===
    createShadow() {
        const style = this.getCurrentStyle();
        const shadowOffset = 4;
        
        this.elements.shadow = this.scene.add.graphics();
        this.elements.shadow.fillStyle(style.shadowColor, 0.4);
        this.elements.shadow.fillRoundedRect(
            -this.config.width/2 + shadowOffset,
            -this.config.height/2 + shadowOffset,
            this.config.width,
            this.config.height,
            8
        );
        
        this.container.add(this.elements.shadow);
    }

    // === FOND ===
    createBackground() {
        const style = this.getCurrentStyle();
        
        this.elements.background = this.scene.add.graphics();
        this.drawBackground(style.color);
        
        this.container.add(this.elements.background);
    }

    drawBackground(color) {
        this.elements.background.clear();
        
        // Dégradé principal
        this.elements.background.fillGradientStyle(
            color, color,
            Phaser.Display.Color.GetColor(
                Math.max(0, Phaser.Display.Color.GetRed(color) - 30),
                Math.max(0, Phaser.Display.Color.GetGreen(color) - 30),
                Math.max(0, Phaser.Display.Color.GetBlue(color) - 30)
            ), Phaser.Display.Color.GetColor(
                Math.max(0, Phaser.Display.Color.GetRed(color) - 30),
                Math.max(0, Phaser.Display.Color.GetGreen(color) - 30),
                Math.max(0, Phaser.Display.Color.GetBlue(color) - 30)
            ),
            1
        );
        
        this.elements.background.fillRoundedRect(
            -this.config.width/2,
            -this.config.height/2,
            this.config.width,
            this.config.height,
            8
        );
    }

    // === BORDURE ===
    createBorder() {
        const style = this.getCurrentStyle();
        
        this.elements.border = this.scene.add.graphics();
        this.elements.border.lineStyle(3, style.borderColor, 1);
        this.elements.border.strokeRoundedRect(
            -this.config.width/2,
            -this.config.height/2,
            this.config.width,
            this.config.height,
            8
        );
        
        this.container.add(this.elements.border);
    }

    // === BRILLANCE ===
    createShine() {
        this.elements.shine = this.scene.add.graphics();
        this.elements.shine.fillGradientStyle(
            0xFFFFFF, 0xFFFFFF,
            0xFFFFFF, 0xFFFFFF,
            0.4, 0.1
        );
        this.elements.shine.fillRoundedRect(
            -this.config.width/2 + 4,
            -this.config.height/2 + 2,
            this.config.width - 8,
            this.config.height/3,
            6
        );
        
        this.container.add(this.elements.shine);
    }

    // === CONTENU ===
    createContent() {
        // Icône (si présente)
        if (this.config.icon) {
            this.createIcon();
        }
        
        // Texte
        this.createText();
    }

    createIcon() {
        const iconX = this.config.text ? -this.config.width/4 : 0;
        
        this.elements.icon = this.scene.add.text(iconX, 0, this.config.icon, {
            fontSize: this.config.fontSize,
            fontFamily: 'Arial, sans-serif'
        }).setOrigin(0.5);
        
        this.container.add(this.elements.icon);
    }

    createText() {
        const textX = this.config.icon ? this.config.width/6 : 0;
        
        this.elements.text = this.scene.add.text(textX, 0, this.config.text, {
            fontSize: this.config.fontSize,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: this.config.textColor,
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);
        
        this.container.add(this.elements.text);
    }

    // === INTERACTIVITÉ ===
    setupInteractivity() {
        if (!this.isEnabled) return;
        
        const hitArea = new Phaser.Geom.Rectangle(
            -this.config.width/2,
            -this.config.height/2,
            this.config.width,
            this.config.height
        );
        
        this.elements.background.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
        
        // Events
        this.elements.background.on('pointerdown', this.onPointerDown.bind(this));
        this.elements.background.on('pointerup', this.onPointerUp.bind(this));
        this.elements.background.on('pointerover', this.onPointerOver.bind(this));
        this.elements.background.on('pointerout', this.onPointerOut.bind(this));
        this.elements.background.on('pointerupoutside', this.onPointerUpOutside.bind(this));
    }

    onPointerDown() {
        if (!this.isEnabled) return;
        
        this.isPressed = true;
        this.playPressAnimation();
        this.playSound('click');
    }

    onPointerUp() {
        if (!this.isEnabled || !this.isPressed) return;
        
        this.isPressed = false;
        this.playReleaseAnimation();
        this.config.onClick();
        this.createClickEffect();
    }

    onPointerOver() {
        if (!this.isEnabled || this.isHovered) return;
        
        this.isHovered = true;
        this.playHoverAnimation(true);
        this.playSound('hover');
        
        if (this.config.onHover) {
            this.config.onHover(true);
        }
    }

    onPointerOut() {
        if (!this.isEnabled || !this.isHovered) return;
        
        this.isHovered = false;
        this.isPressed = false;
        this.playHoverAnimation(false);
        
        if (this.config.onHover) {
            this.config.onHover(false);
        }
    }

    onPointerUpOutside() {
        this.isPressed = false;
        this.playReleaseAnimation();
    }

    // === ANIMATIONS ===
    playCreationAnimation() {
        this.container.setScale(0);
        this.container.setAlpha(0);
        
        this.scene.tweens.add({
            targets: this.container,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: 400,
            ease: 'Back.easeOut'
        });
    }

    playPressAnimation() {
        if (!this.config.animations) return;
        
        this.scene.tweens.add({
            targets: this.container,
            scaleX: 0.95,
            scaleY: 0.95,
            duration: 100,
            ease: 'Power2'
        });
        
        // Effet d'enfoncement
        this.elements.shadow.setAlpha(0.2);
    }

    playReleaseAnimation() {
        if (!this.config.animations) return;
        
        const style = this.getCurrentStyle();
        
        this.scene.tweens.add({
            targets: this.container,
            scaleX: this.isHovered ? style.hoverScale : 1,
            scaleY: this.isHovered ? style.hoverScale : 1,
            duration: 150,
            ease: 'Back.easeOut'
        });
        
        this.elements.shadow.setAlpha(0.4);
    }

    playHoverAnimation(isHovering) {
        if (!this.config.animations) return;
        
        const style = this.getCurrentStyle();
        const targetScale = isHovering ? style.hoverScale : 1;
        
        this.scene.tweens.add({
            targets: this.container,
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 200,
            ease: 'Back.easeOut'
        });
        
        if (isHovering) {
            this.createGlowEffect();
        } else {
            this.removeGlowEffect();
        }
    }

    // === EFFETS VISUELS ===
    createClickEffect() {
        // Onde de choc au clic
        const ripple = this.scene.add.graphics();
        ripple.lineStyle(3, 0xFFFFFF, 0.8);
        ripple.strokeCircle(0, 0, 10);
        
        this.container.add(ripple);
        
        this.scene.tweens.add({
            targets: ripple,
            scaleX: 3,
            scaleY: 3,
            alpha: 0,
            duration: 300,
            ease: 'Power2.easeOut',
            onComplete: () => {
                ripple.destroy();
            }
        });
        
        // Particules
        this.createParticleEffect();
    }

    createGlowEffect() {
        const style = this.getCurrentStyle();
        
        this.elements.glow = this.scene.add.graphics();
        this.elements.glow.fillStyle(style.glowColor, 0.3);
        this.elements.glow.fillRoundedRect(
            -this.config.width/2 - 5,
            -this.config.height/2 - 5,
            this.config.width + 10,
            this.config.height + 10,
            10
        );
        
        this.container.addAt(this.elements.glow, 0); // Derrière tout
        
        // Animation pulsante
        this.scene.tweens.add({
            targets: this.elements.glow,
            alpha: 0.1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    removeGlowEffect() {
        if (this.elements.glow) {
            this.scene.tweens.killTweensOf(this.elements.glow);
            this.elements.glow.destroy();
            this.elements.glow = null;
        }
    }

    createParticleEffect() {
        const particleCount = 6;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particle = this.scene.add.graphics();
            particle.fillStyle(0xFFD700, 0.8);
            particle.fillCircle(0, 0, 3);
            
            const angle = (Math.PI * 2 / particleCount) * i;
            const distance = 30;
            
            particle.setPosition(
                Math.cos(angle) * 10,
                Math.sin(angle) * 10
            );
            
            this.container.add(particle);
            particles.push(particle);
            
            this.scene.tweens.add({
                targets: particle,
                x: Math.cos(angle) * distance,
                y: Math.sin(angle) * distance,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 400,
                ease: 'Power2.easeOut',
                onComplete: () => {
                    particle.destroy();
                }
            });
        }
    }

    // === SONS ===
    playSound(type) {
        if (!this.config.sounds) return;
        
        // TODO: Implémenter système de sons
        // this.scene.sound.play(`button_${type}`);
    }

    // === MÉTHODES PUBLIQUES ===
    setText(newText) {
        this.config.text = newText;
        if (this.elements.text) {
            this.elements.text.setText(newText);
        }
    }

    setIcon(newIcon) {
        this.config.icon = newIcon;
        if (this.elements.icon) {
            this.elements.icon.setText(newIcon);
        } else if (newIcon) {
            this.createIcon();
        }
    }

    setStyle(newStyle) {
        this.config.style = newStyle;
        this.updateVisuals();
    }

    setEnabled(enabled) {
        this.isEnabled = enabled;
        this.config.enabled = enabled;
        
        if (enabled) {
            this.setupInteractivity();
            this.container.setAlpha(1);
        } else {
            this.elements.background.removeInteractive();
            this.container.setAlpha(0.6);
        }
        
        this.updateVisuals();
    }

    setColor(color) {
        this.config.color = color;
        this.updateVisuals();
    }

    setSize(width, height) {
        this.config.width = width;
        this.config.height = height;
        this.updateVisuals();
    }

    updateVisuals() {
        const style = this.getCurrentStyle();
        
        // Redessiner fond
        this.drawBackground(style.color);
        
        // Redessiner bordure
        this.elements.border.clear();
        this.elements.border.lineStyle(3, style.borderColor, 1);
        this.elements.border.strokeRoundedRect(
            -this.config.width/2,
            -this.config.height/2,
            this.config.width,
            this.config.height,
            8
        );
        
        // Mettre à jour ombre
        this.elements.shadow.clear();
        this.elements.shadow.fillStyle(style.shadowColor, 0.4);
        this.elements.shadow.fillRoundedRect(
            -this.config.width/2 + 4,
            -this.config.height/2 + 4,
            this.config.width,
            this.config.height,
            8
        );
    }

    getCurrentStyle() {
        const styleName = this.isEnabled ? this.config.style : 'disabled';
        return this.styles[styleName] || this.styles.primary;
    }

    // === ANIMATIONS GLOBALES ===
    pulse() {
        this.scene.tweens.add({
            targets: this.container,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 200,
            yoyo: true,
            ease: 'Power2'
        });
    }

    shake() {
        this.scene.tweens.add({
            targets: this.container,
            x: this.x - 5,
            duration: 50,
            yoyo: true,
            repeat: 3,
            ease: 'Power2',
            onComplete: () => {
                this.container.setX(this.x);
            }
        });
    }

    flash(color = 0xFFFFFF) {
        const flash = this.scene.add.graphics();
        flash.fillStyle(color, 0.8);
        flash.fillRoundedRect(
            -this.config.width/2,
            -this.config.height/2,
            this.config.width,
            this.config.height,
            8
        );
        
        this.container.add(flash);
        
        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 200,
            ease: 'Power2',
            onComplete: () => {
                flash.destroy();
            }
        });
    }

    show() {
        this.container.setVisible(true);
        this.container.setAlpha(0);
        this.container.setScale(0.8);
        
        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }

    hide() {
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 200,
            ease: 'Power2.easeIn',
            onComplete: () => {
                this.container.setVisible(false);
            }
        });
    }

    // === NETTOYAGE ===
    destroy() {
        this.removeGlowEffect();
        
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        
        console.log('🗑️ ClashButton détruit');
    }

    // === GETTERS ===
    getContainer() {
        return this.container;
    }

    isVisible() {
        return this.container && this.container.visible;
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    getSize() {
        return { width: this.config.width, height: this.config.height };
    }

    getConfig() {
        return { ...this.config };
    }
}
