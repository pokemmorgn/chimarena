// client/src/clashmenu/TabNavigation.js - NAVIGATION ONGLETS CLASH ROYALE
export default class TabNavigation {
    constructor(scene, tabs, onTabChange) {
        this.scene = scene;
        this.tabs = tabs || ['Bataille', 'Collection', 'Deck', 'Clan', 'Profil'];
        this.onTabChange = onTabChange;
        this.container = null;
        
        // État de navigation
        this.currentTab = 0;
        this.tabButtons = [];
        this.indicators = [];
        
        // Configuration
        this.tabIcons = ['⚔️', '🃏', '🛡️', '🏰', '👤'];
        this.tabColors = {
            inactive: 0x4682B4,
            active: 0xFFD700,
            hover: 0x5A9FD4,
            disabled: 0x696969
        };
        
        // Dimensions
        this.width = scene.scale.width;
        this.height = 70;
        this.isMobile = scene.isMobile || false;
        
        // Swipe detection
        this.swipeStartX = 0;
        this.swipeThreshold = 50;
        this.isSwipeEnabled = this.isMobile;
        
        this.create();
    }

    create() {
        // Container fixé en bas
        this.container = this.scene.add.container(0, this.scene.scale.height - this.height);
        
        this.createBackground();
        this.createTabButtons();
        this.createActiveIndicator();
        this.setupInteractions();
        this.setupSwipeDetection();
        
        // Activer le premier onglet
        this.setActiveTab(0, false);
        
        console.log('📱 TabNavigation créé');
    }

    // === FOND DE LA BARRE ===
    createBackground() {
        // Fond principal avec dégradé
        const bg = this.scene.add.graphics();
        bg.fillGradientStyle(
            0x2F4F4F, 0x2F4F4F,
            0x1C3A3A, 0x1C3A3A,
            1
        );
        bg.fillRect(0, 0, this.width, this.height);
        
        // Bordure supérieure dorée
        bg.lineStyle(3, 0xFFD700);
        bg.lineBetween(0, 0, this.width, 0);
        
        // Effet d'ombre en haut
        const shadow = this.scene.add.graphics();
        shadow.fillGradientStyle(
            0x000000, 0x000000,
            0x000000, 0x000000,
            0.4, 0
        );
        shadow.fillRect(0, 0, this.width, 10);
        
        // Effet de brillance
        const shine = this.scene.add.graphics();
        shine.fillGradientStyle(
            0xFFFFFF, 0xFFFFFF,
            0xFFFFFF, 0xFFFFFF,
            0.1, 0.05
        );
        shine.fillRect(0, 5, this.width, 15);
        
        this.container.add([bg, shadow, shine]);
    }

    // === BOUTONS ONGLETS ===
    createTabButtons() {
        const tabWidth = this.width / this.tabs.length;
        
        this.tabs.forEach((tabName, index) => {
            const tabContainer = this.createSingleTab(index, tabName, tabWidth);
            this.tabButtons.push(tabContainer);
            this.container.add(tabContainer.container);
        });
    }

    createSingleTab(index, tabName, tabWidth) {
        const tabX = tabWidth * index + tabWidth / 2;
        const tabY = this.height / 2;
        
        // Container pour cet onglet
        const tabContainer = this.scene.add.container(tabX, tabY);
        
        // Background de l'onglet
        const tabBg = this.scene.add.graphics();
        this.drawTabBackground(tabBg, tabWidth, this.tabColors.inactive, false);
        
        // Icône
        const icon = this.scene.add.text(0, -8, this.tabIcons[index], {
            fontSize: this.isMobile ? '22px' : '26px'
        }).setOrigin(0.5);
        
        // Texte
        const text = this.scene.add.text(0, 18, tabName, {
            fontSize: this.isMobile ? '9px' : '11px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF'
        }).setOrigin(0.5);
        
        // Badge de notification (si nécessaire)
        const notificationBadge = this.createNotificationBadge();
        notificationBadge.setVisible(false);
        
        tabContainer.add([tabBg, icon, text, notificationBadge]);
        
        // Données de l'onglet
        const tabData = {
            container: tabContainer,
            background: tabBg,
            icon: icon,
            text: text,
            badge: notificationBadge,
            index: index,
            name: tabName,
            width: tabWidth,
            isActive: false,
            isEnabled: true
        };
        
        return tabData;
    }

    drawTabBackground(graphics, width, color, isActive) {
        graphics.clear();
        
        const bgWidth = width - 10;
        const bgHeight = this.height - 10;
        const radius = 12;
        
        if (isActive) {
            // Onglet actif avec effet 3D
            graphics.fillStyle(color, 1);
            graphics.fillRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, radius);
            
            // Bordure brillante
            graphics.lineStyle(2, 0xFFA500);
            graphics.strokeRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, radius);
            
            // Effet de brillance
            graphics.fillGradientStyle(
                0xFFFFFF, 0xFFFFFF,
                0xFFFFFF, 0xFFFFFF,
                0.3, 0.1
            );
            graphics.fillRoundedRect(-bgWidth/2, -bgHeight/2 + 2, bgWidth, bgHeight/3, radius);
        } else {
            // Onglet inactif
            graphics.fillStyle(color, 0.7);
            graphics.fillRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, radius);
            
            graphics.lineStyle(1, 0x708090, 0.5);
            graphics.strokeRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, radius);
        }
    }

    createNotificationBadge() {
        const badge = this.scene.add.container(15, -15);
        
        // Cercle rouge
        const circle = this.scene.add.circle(0, 0, 8, 0xFF4500);
        circle.setStrokeStyle(2, 0xFFFFFF);
        
        // Nombre (sera mis à jour dynamiquement)
        const number = this.scene.add.text(0, 0, '1', {
            fontSize: '10px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF'
        }).setOrigin(0.5);
        
        badge.add([circle, number]);
        
        // Animation pulsante
        this.scene.tweens.add({
            targets: badge,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        return badge;
    }

    // === INDICATEUR ACTIF ===
    createActiveIndicator() {
        // Ligne dorée sous l'onglet actif
        this.activeIndicator = this.scene.add.graphics();
        this.activeIndicator.fillStyle(0xFFD700, 1);
        
        const tabWidth = this.width / this.tabs.length;
        const indicatorWidth = tabWidth * 0.6;
        const indicatorHeight = 4;
        
        this.activeIndicator.fillRoundedRect(
            -indicatorWidth/2, 
            this.height/2 + 25, 
            indicatorWidth, 
            indicatorHeight, 
            2
        );
        
        this.container.add(this.activeIndicator);
    }

    // === INTERACTIVITÉ ===
    setupInteractions() {
        this.tabButtons.forEach((tabData, index) => {
            const hitArea = new Phaser.Geom.Rectangle(
                -tabData.width/2, 
                -this.height/2, 
                tabData.width, 
                this.height
            );
            
            tabData.background.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
            
            // Events de clic
            tabData.background.on('pointerdown', (pointer) => {
                if (tabData.isEnabled) {
                    this.onTabClick(index, pointer);
                }
            });
            
            // Hover effects
            tabData.background.on('pointerover', () => {
                if (tabData.isEnabled && !tabData.isActive) {
                    this.onTabHover(tabData, true);
                }
            });
            
            tabData.background.on('pointerout', () => {
                if (tabData.isEnabled && !tabData.isActive) {
                    this.onTabHover(tabData, false);
                }
            });
        });
    }

    onTabClick(index, pointer) {
        // Effet de clic
        const tabData = this.tabButtons[index];
        
        this.scene.tweens.add({
            targets: [tabData.icon, tabData.text],
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 100,
            yoyo: true,
            ease: 'Power2',
            onComplete: () => {
                this.setActiveTab(index, true);
            }
        });
        
        // Effet visuel de sélection
        this.createClickEffect(tabData.container.x, tabData.container.y);
    }

    onTabHover(tabData, isHovering) {
        const targetColor = isHovering ? this.tabColors.hover : this.tabColors.inactive;
        const targetScale = isHovering ? 1.05 : 1;
        
        // Animation du background
        this.scene.tweens.add({
            targets: tabData.background,
            duration: 200,
            ease: 'Power2',
            onUpdate: () => {
                this.drawTabBackground(tabData.background, tabData.width, targetColor, false);
            }
        });
        
        // Animation d'échelle
        this.scene.tweens.add({
            targets: [tabData.icon, tabData.text],
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 200,
            ease: 'Back.easeOut'
        });
    }

    createClickEffect(x, y) {
        // Effet de particules au clic
        const effect = this.scene.add.graphics();
        effect.fillStyle(0xFFD700, 0.8);
        effect.fillCircle(x, y, 5);
        
        this.container.add(effect);
        
        this.scene.tweens.add({
            targets: effect,
            scaleX: 3,
            scaleY: 3,
            alpha: 0,
            duration: 300,
            ease: 'Power2.easeOut',
            onComplete: () => {
                effect.destroy();
            }
        });
    }

    // === SWIPE DETECTION ===
    setupSwipeDetection() {
        if (!this.isSwipeEnabled) return;
        
        this.scene.input.on('pointerdown', (pointer) => {
            this.swipeStartX = pointer.x;
        });
        
        this.scene.input.on('pointerup', (pointer) => {
            const diffX = pointer.x - this.swipeStartX;
            
            if (Math.abs(diffX) > this.swipeThreshold) {
                if (diffX > 0 && this.currentTab > 0) {
                    // Swipe droite - onglet précédent
                    this.setActiveTab(this.currentTab - 1, true);
                } else if (diffX < 0 && this.currentTab < this.tabs.length - 1) {
                    // Swipe gauche - onglet suivant
                    this.setActiveTab(this.currentTab + 1, true);
                }
            }
        });
    }

    // === GESTION DES ONGLETS ===
    setActiveTab(index, animate = true) {
        if (index === this.currentTab || index < 0 || index >= this.tabs.length) {
            return;
        }
        
        const oldTab = this.currentTab;
        this.currentTab = index;
        
        // Désactiver l'ancien onglet
        if (this.tabButtons[oldTab]) {
            this.deactivateTab(oldTab, animate);
        }
        
        // Activer le nouveau
        this.activateTab(index, animate);
        
        // Déplacer l'indicateur
        this.moveActiveIndicator(index, animate);
        
        // Callback
        if (this.onTabChange) {
            this.onTabChange(index, oldTab);
        }
        
        console.log(`📱 Onglet actif: ${this.tabs[index]} (${index})`);
    }

    activateTab(index, animate) {
        const tabData = this.tabButtons[index];
        if (!tabData) return;
        
        tabData.isActive = true;
        
        // Redessiner le background
        this.drawTabBackground(tabData.background, tabData.width, this.tabColors.active, true);
        
        if (animate) {
            // Animation d'activation
            this.scene.tweens.add({
                targets: [tabData.icon, tabData.text],
                scaleX: 1.1,
                scaleY: 1.1,
                duration: 300,
                yoyo: true,
                ease: 'Back.easeOut'
            });
            
            // Effet de brillance
            this.createTabActivationEffect(tabData);
        }
    }

    deactivateTab(index, animate) {
        const tabData = this.tabButtons[index];
        if (!tabData) return;
        
        tabData.isActive = false;
        
        // Redessiner le background
        this.drawTabBackground(tabData.background, tabData.width, this.tabColors.inactive, false);
        
        if (animate) {
            // Animation de désactivation
            this.scene.tweens.add({
                targets: [tabData.icon, tabData.text],
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Power2'
            });
        }
    }

    moveActiveIndicator(index, animate) {
        const tabWidth = this.width / this.tabs.length;
        const targetX = tabWidth * index + tabWidth / 2;
        
        if (animate) {
            this.scene.tweens.add({
                targets: this.activeIndicator,
                x: targetX,
                duration: 400,
                ease: 'Back.easeOut'
            });
        } else {
            this.activeIndicator.setX(targetX);
        }
    }

    createTabActivationEffect(tabData) {
        // Effet de rayons dorés
        const rays = this.scene.add.graphics();
        rays.lineStyle(2, 0xFFD700, 0.8);
        
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 / 8) * i;
            const startX = tabData.container.x;
            const startY = tabData.container.y;
            const endX = startX + Math.cos(angle) * 20;
            const endY = startY + Math.sin(angle) * 20;
            
            rays.lineBetween(startX, startY, endX, endY);
        }
        
        this.container.add(rays);
        
        // Animation des rayons
        this.scene.tweens.add({
            targets: rays,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 500,
            ease: 'Power2.easeOut',
            onComplete: () => {
                rays.destroy();
            }
        });
    }

    // === MÉTHODES PUBLIQUES ===
    getCurrentTab() {
        return this.currentTab;
    }

    switchToTab(index) {
        this.setActiveTab(index, true);
    }

    enableTab(index, enabled = true) {
        const tabData = this.tabButtons[index];
        if (!tabData) return;
        
        tabData.isEnabled = enabled;
        
        const color = enabled ? this.tabColors.inactive : this.tabColors.disabled;
        const alpha = enabled ? 1 : 0.5;
        
        this.drawTabBackground(tabData.background, tabData.width, color, tabData.isActive);
        tabData.icon.setAlpha(alpha);
        tabData.text.setAlpha(alpha);
    }

    setTabNotification(index, count = 1) {
        const tabData = this.tabButtons[index];
        if (!tabData) return;
        
        if (count > 0) {
            tabData.badge.setVisible(true);
            tabData.badge.list[1].setText(count.toString());
        } else {
            tabData.badge.setVisible(false);
        }
    }

    clearAllNotifications() {
        this.tabButtons.forEach((tabData) => {
            tabData.badge.setVisible(false);
        });
    }

    // === NAVIGATION CLAVIER ===
    handleKeyboard(direction) {
        let newIndex = this.currentTab;
        
        if (direction === 'left' && this.currentTab > 0) {
            newIndex = this.currentTab - 1;
        } else if (direction === 'right' && this.currentTab < this.tabs.length - 1) {
            newIndex = this.currentTab + 1;
        }
        
        if (newIndex !== this.currentTab) {
            this.setActiveTab(newIndex, true);
        }
    }

    // === ANIMATIONS GLOBALES ===
    show() {
        this.container.setY(this.scene.scale.height);
        this.scene.tweens.add({
            targets: this.container,
            y: this.scene.scale.height - this.height,
            duration: 600,
            ease: 'Back.easeOut'
        });
    }

    hide() {
        this.scene.tweens.add({
            targets: this.container,
            y: this.scene.scale.height,
            duration: 400,
            ease: 'Power2.easeIn'
        });
    }

    playEntranceAnimation() {
        // Animation d'entrée échelonnée
        this.tabButtons.forEach((tabData, index) => {
            tabData.container.setAlpha(0);
            tabData.container.setY(tabData.container.y + 50);
            
            this.scene.tweens.add({
                targets: tabData.container,
                alpha: 1,
                y: tabData.container.y - 50,
                duration: 500,
                delay: index * 100,
                ease: 'Back.easeOut'
            });
        });
    }

    // === NETTOYAGE ===
    destroy() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        
        this.tabButtons = [];
        this.indicators = [];
        
        console.log('🗑️ TabNavigation détruit');
    }

    // === GETTERS ===
    getContainer() {
        return this.container;
    }

    getHeight() {
        return this.height;
    }

    getTabCount() {
        return this.tabs.length;
    }

    getTabName(index) {
        return this.tabs[index] || null;
    }
}
