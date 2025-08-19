// client/src/clashmenu/ClashHeader.js - HEADER JOUEUR CLASH ROYALE
export default class ClashHeader {
    constructor(scene, userData) {
        this.scene = scene;
        this.userData = userData;
        this.container = null;
        
        // Éléments UI
        this.elements = {
            background: null,
            avatar: null,
            playerName: null,
            playerLevel: null,
            expBar: null,
            trophyCount: null,
            goldCount: null,
            gemCount: null,
            elixirCount: null
        };
        
        // Dimensions
        this.width = scene.scale.width;
        this.height = 90;
        this.isMobile = scene.isMobile || false;
        
        this.create();
    }

    create() {
        // Container principal
        this.container = this.scene.add.container(0, 0);
        
        this.createBackground();
        this.createPlayerAvatar();
        this.createPlayerInfo();
        this.createExperienceBar();
        this.createResources();
        this.createSettingsButton();
        
        console.log('🏆 ClashHeader créé');
    }

    // === FOND DU HEADER ===
    createBackground() {
        const bg = this.scene.add.graphics();
        
        // Dégradé principal
        bg.fillGradientStyle(0x2F4F4F, 0x2F4F4F, 0x1C3A3A, 0x1C3A3A, 1);
        bg.fillRoundedRect(10, 10, this.width - 20, this.height, 12);
        
        // Bordure dorée
        bg.lineStyle(3, 0xFFD700, 1);
        bg.strokeRoundedRect(10, 10, this.width - 20, this.height, 12);
        
        // Effet brillance en haut
        const shine = this.scene.add.graphics();
        shine.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0.3, 0.1);
        shine.fillRoundedRect(15, 15, this.width - 30, 20, 8);
        
        this.elements.background = bg;
        this.container.add([bg, shine]);
    }

    // === AVATAR JOUEUR ===
    createPlayerAvatar() {
        const avatarX = 45;
        const avatarY = 50;
        const avatarSize = this.isMobile ? 28 : 32;
        
        // Cercle de fond
        const avatarBg = this.scene.add.circle(avatarX, avatarY, avatarSize, 0x4169E1);
        avatarBg.setStrokeStyle(3, 0xFFD700);
        
        // Icône joueur (emoji pour l'instant, sera remplacé par image)
        const avatarIcon = this.scene.add.text(avatarX, avatarY, '👑', {
            fontSize: this.isMobile ? '32px' : '36px'
        }).setOrigin(0.5);
        
        // Animation pulsation
        this.scene.tweens.add({
            targets: [avatarBg, avatarIcon],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.elements.avatar = { bg: avatarBg, icon: avatarIcon };
        this.container.add([avatarBg, avatarIcon]);
    }

    // === INFORMATIONS JOUEUR ===
    createPlayerInfo() {
        const playerName = this.userData?.username || 'Joueur';
        const playerLevel = this.userData?.playerStats?.level || 1;
        const startX = 85;
        
        // Nom du joueur
        this.elements.playerName = this.scene.add.text(startX, 35, playerName, {
            fontSize: this.isMobile ? '18px' : '20px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 1
        });
        
        // Niveau du joueur avec style
        const levelBg = this.scene.add.graphics();
        levelBg.fillStyle(0xFFD700, 1);
        levelBg.fillRoundedRect(startX - 2, 50, 60, 20, 10);
        levelBg.lineStyle(1, 0xFFA500);
        levelBg.strokeRoundedRect(startX - 2, 50, 60, 20, 10);
        
        this.elements.playerLevel = this.scene.add.text(startX + 28, 60, `NIV. ${playerLevel}`, {
            fontSize: this.isMobile ? '11px' : '12px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#2F4F4F'
        }).setOrigin(0.5);
        
        this.container.add([levelBg, this.elements.playerName, this.elements.playerLevel]);
    }

    // === BARRE D'EXPÉRIENCE ===
    createExperienceBar() {
        const currentExp = this.userData?.playerStats?.experience || 0;
        const currentLevel = this.userData?.playerStats?.level || 1;
        
        // Calcul XP pour niveau suivant (formule simple)
        const expForNextLevel = currentLevel * 100;
        const expInCurrentLevel = currentExp % expForNextLevel;
        const expPercent = (expInCurrentLevel / expForNextLevel) * 100;
        
        const barX = 85;
        const barY = 75;
        const barWidth = this.isMobile ? 100 : 120;
        const barHeight = 8;
        
        // Fond de la barre
        const expBg = this.scene.add.graphics();
        expBg.fillStyle(0x2F2F2F, 0.8);
        expBg.fillRoundedRect(barX, barY, barWidth, barHeight, 4);
        expBg.lineStyle(1, 0x555555);
        expBg.strokeRoundedRect(barX, barY, barWidth, barHeight, 4);
        
        // Remplissage XP
        const expFill = this.scene.add.graphics();
        expFill.fillStyle(0x00FF00, 1); // Vert vif
        expFill.fillRoundedRect(barX + 1, barY + 1, Math.max(0, (barWidth - 2) * expPercent / 100), barHeight - 2, 3);
        
        // Effet brillance sur la barre
        const expShine = this.scene.add.graphics();
        expShine.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0.6, 0.2);
        expShine.fillRoundedRect(barX + 1, barY + 1, Math.max(0, (barWidth - 2) * expPercent / 100), 3, 2);
        
        // Texte XP
        const expText = this.scene.add.text(barX + barWidth + 5, barY + 4, `${Math.floor(expPercent)}%`, {
            fontSize: this.isMobile ? '9px' : '10px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        });
        
        this.elements.expBar = { bg: expBg, fill: expFill, shine: expShine, text: expText };
        this.container.add([expBg, expFill, expShine, expText]);
    }

    // === RESSOURCES ===
    createResources() {
        const resources = this.userData?.resources || {};
        const playerStats = this.userData?.playerStats || {};
        
        const startX = this.width - (this.isMobile ? 140 : 160);
        const iconSize = this.isMobile ? '16px' : '18px';
        const textSize = this.isMobile ? '13px' : '15px';
        const spacing = this.isMobile ? 25 : 30;
        
        // Trophées
        const trophies = playerStats.trophies || 0;
        const trophyIcon = this.scene.add.text(startX, 30, '🏆', { fontSize: iconSize });
        this.elements.trophyCount = this.scene.add.text(startX + 20, 30, window.GameUtils.formatNumber(trophies), {
            fontSize: textSize,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700',
            stroke: '#8B4513',
            strokeThickness: 1
        });
        
        // Or
        const gold = resources.gold || 0;
        const goldIcon = this.scene.add.text(startX, 30 + spacing, '💰', { fontSize: iconSize });
        this.elements.goldCount = this.scene.add.text(startX + 20, 30 + spacing, window.GameUtils.formatNumber(gold), {
            fontSize: textSize,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700',
            stroke: '#8B4513',
            strokeThickness: 1
        });
        
        // Gemmes
        const gems = resources.gems || 0;
        const gemIcon = this.scene.add.text(startX + (this.isMobile ? 70 : 80), 30, '💎', { fontSize: iconSize });
        this.elements.gemCount = this.scene.add.text(startX + (this.isMobile ? 90 : 100), 30, gems.toString(), {
            fontSize: textSize,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#9370DB',
            stroke: '#483D8B',
            strokeThickness: 1
        });
        
        // Élixir (si disponible)
        if (resources.elixir !== undefined) {
            const elixir = resources.elixir || 0;
            const elixirIcon = this.scene.add.text(startX + (this.isMobile ? 70 : 80), 30 + spacing, '⚡', { fontSize: iconSize });
            this.elements.elixirCount = this.scene.add.text(startX + (this.isMobile ? 90 : 100), 30 + spacing, elixir.toString(), {
                fontSize: textSize,
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                fill: '#FF69B4',
                stroke: '#8B008B',
                strokeThickness: 1
            });
            
            this.container.add([elixirIcon, this.elements.elixirCount]);
        }
        
        // Animations des ressources
        this.scene.tweens.add({
            targets: [trophyIcon, goldIcon, gemIcon],
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            delay: (i, target) => i * 200
        });
        
        this.container.add([
            trophyIcon, this.elements.trophyCount,
            goldIcon, this.elements.goldCount,
            gemIcon, this.elements.gemCount
        ]);
    }

    // === BOUTON PARAMÈTRES ===
    createSettingsButton() {
        const buttonX = this.width - 35;
        const buttonY = 25;
        
        // Background bouton
        const buttonBg = this.scene.add.circle(buttonX, buttonY, 15, 0x4682B4);
        buttonBg.setStrokeStyle(2, 0xFFD700);
        
        // Icône paramètres
        const settingsIcon = this.scene.add.text(buttonX, buttonY, '⚙️', {
            fontSize: '16px'
        }).setOrigin(0.5);
        
        // Interactivité
        buttonBg.setInteractive()
            .on('pointerover', () => {
                buttonBg.setScale(1.1);
                settingsIcon.setScale(1.1);
            })
            .on('pointerout', () => {
                buttonBg.setScale(1);
                settingsIcon.setScale(1);
            })
            .on('pointerdown', () => {
                this.scene.tweens.add({
                    targets: [buttonBg, settingsIcon],
                    scaleX: 0.9,
                    scaleY: 0.9,
                    duration: 100,
                    yoyo: true,
                    onComplete: () => this.openSettings()
                });
            });
        
        this.container.add([buttonBg, settingsIcon]);
    }

    // === MÉTHODES PUBLIQUES ===
    updateUserData(newUserData) {
        this.userData = newUserData;
        this.refresh();
    }

    refresh() {
        // Mettre à jour les éléments avec nouvelles données
        if (this.elements.playerName && this.userData?.username) {
            this.elements.playerName.setText(this.userData.username);
        }
        
        if (this.elements.playerLevel && this.userData?.playerStats?.level) {
            this.elements.playerLevel.setText(`NIV. ${this.userData.playerStats.level}`);
        }
        
        if (this.elements.trophyCount && this.userData?.playerStats?.trophies !== undefined) {
            this.elements.trophyCount.setText(window.GameUtils.formatNumber(this.userData.playerStats.trophies));
        }
        
        if (this.elements.goldCount && this.userData?.resources?.gold !== undefined) {
            this.elements.goldCount.setText(window.GameUtils.formatNumber(this.userData.resources.gold));
        }
        
        if (this.elements.gemCount && this.userData?.resources?.gems !== undefined) {
            this.elements.gemCount.setText(this.userData.resources.gems.toString());
        }
        
        if (this.elements.elixirCount && this.userData?.resources?.elixir !== undefined) {
            this.elements.elixirCount.setText(this.userData.resources.elixir.toString());
        }
        
        // Recalculer la barre d'expérience
        this.updateExperienceBar();
        
        console.log('🔄 ClashHeader mis à jour');
    }

    updateExperienceBar() {
        if (!this.elements.expBar) return;
        
        const currentExp = this.userData?.playerStats?.experience || 0;
        const currentLevel = this.userData?.playerStats?.level || 1;
        const expForNextLevel = currentLevel * 100;
        const expInCurrentLevel = currentExp % expForNextLevel;
        const expPercent = (expInCurrentLevel / expForNextLevel) * 100;
        
        // Redessiner la barre
        this.elements.expBar.fill.clear();
        this.elements.expBar.fill.fillStyle(0x00FF00, 1);
        const barWidth = this.isMobile ? 100 : 120;
        this.elements.expBar.fill.fillRoundedRect(86, 76, Math.max(0, (barWidth - 2) * expPercent / 100), 6, 3);
        
        // Mettre à jour le texte
        this.elements.expBar.text.setText(`${Math.floor(expPercent)}%`);
    }

    playResourceAnimation(resourceType) {
        let targetElement = null;
        
        switch (resourceType) {
            case 'trophies':
                targetElement = this.elements.trophyCount;
                break;
            case 'gold':
                targetElement = this.elements.goldCount;
                break;
            case 'gems':
                targetElement = this.elements.gemCount;
                break;
            case 'elixir':
                targetElement = this.elements.elixirCount;
                break;
        }
        
        if (targetElement) {
            this.scene.tweens.add({
                targets: targetElement,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 200,
                yoyo: true,
                ease: 'Back.easeOut'
            });
        }
    }

    openSettings() {
        // TODO: Ouvrir menu des paramètres
        console.log('⚙️ Ouverture paramètres');
        this.scene.showMessage && this.scene.showMessage('Paramètres - En développement', 'info');
    }

    // === GESTION DE L'ANIMATION ===
    show() {
        this.container.setY(-this.height);
        this.scene.tweens.add({
            targets: this.container,
            y: 0,
            duration: 600,
            ease: 'Back.easeOut'
        });
    }

    hide() {
        this.scene.tweens.add({
            targets: this.container,
            y: -this.height,
            duration: 400,
            ease: 'Power2.easeIn'
        });
    }

    // === NETTOYAGE ===
    destroy() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        console.log('🗑️ ClashHeader détruit');
    }

    // === GETTERS ===
    getContainer() {
        return this.container;
    }

    getHeight() {
        return this.height;
    }
}
