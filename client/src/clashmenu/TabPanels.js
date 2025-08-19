// client/src/clashmenu/TabPanels.js - CONTENU ONGLETS CLASH ROYALE
export default class TabPanels {
    constructor(scene, userData, onAction) {
        this.scene = scene;
        this.userData = userData;
        this.onAction = onAction || (() => {});
        this.container = null;
        
        // Panels pour chaque onglet
        this.panels = [];
        this.currentPanel = 0;
        
        // Configuration
        this.tabs = ['Bataille', 'Collection', 'Deck', 'Clan', 'Profil'];
        
        // Dimensions
        this.width = scene.scale.width;
        this.contentY = scene.isMobile ? 280 : 320;
        this.contentHeight = scene.scale.height - this.contentY - 80;
        this.isMobile = scene.isMobile || false;
        
        this.create();
    }

    create() {
        // Container principal pour tous les panels
        this.container = this.scene.add.container(0, this.contentY);
        
        // Créer les 5 panels
        this.createBattlePanel();      // 0
        this.createCollectionPanel();  // 1
        this.createDeckPanel();        // 2
        this.createClanPanel();        // 3
        this.createProfilePanel();     // 4
        
        // Afficher le premier panel
        this.showPanel(0, false);
        
        console.log('📋 TabPanels créé');
    }

    // === PANEL COMMUN ===
    createPanelBase(index, title, titleIcon) {
        const panel = this.scene.add.container(0, 0);
        
        // Background principal
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x2F4F4F, 0.9);
        bg.fillRoundedRect(15, 0, this.width - 30, this.contentHeight, 12);
        bg.lineStyle(2, 0x4682B4);
        bg.strokeRoundedRect(15, 0, this.width - 30, this.contentHeight, 12);
        
        // Effet de brillance en haut
        const shine = this.scene.add.graphics();
        shine.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0.2, 0.05);
        shine.fillRoundedRect(20, 5, this.width - 40, 20, 8);
        
        // Titre du panel
        const titleText = this.scene.add.text(this.width / 2, 25, `${titleIcon} ${title}`, {
            fontSize: this.isMobile ? '18px' : '22px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700',
            stroke: '#8B4513',
            strokeThickness: 2
        }).setOrigin(0.5);
        
        panel.add([bg, shine, titleText]);
        panel.setVisible(false);
        
        this.panels[index] = panel;
        this.container.add(panel);
        
        return panel;
    }

    // === 0. PANEL BATAILLE ===
    createBattlePanel() {
        const panel = this.createPanelBase(0, 'BATAILLE', '⚔️');
        
        const centerX = this.width / 2;
        const startY = 60;
        
        // Bouton principal BATAILLE
        const battleButton = this.createActionButton(
            centerX, startY + 40,
            220, 70,
            '⚔️ BATAILLE',
            '#FFD700',
            () => this.onAction('battle')
        );
        
        // Sous-titre motivant
        const subtitle = this.scene.add.text(centerX, startY, 'Affrontez des joueurs du monde entier !', {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE',
            align: 'center'
        }).setOrigin(0.5);
        
        // Modes de jeu secondaires
        const spacing = this.isMobile ? 60 : 70;
        
        const trainingButton = this.createActionButton(
            centerX - 80, startY + 40 + spacing,
            140, 50,
            '🎯 Entraînement',
            '#32CD32',
            () => this.onAction('training')
        );
        
        const tournamentButton = this.createActionButton(
            centerX + 80, startY + 40 + spacing,
            140, 50,
            '🏆 Tournoi',
            '#9370DB',
            () => this.onAction('tournament')
        );
        
        // Statistiques rapides
        if (!this.isMobile) {
            this.createBattleStats(panel, startY + 40 + spacing * 2);
        }
        
        panel.add([subtitle, battleButton, trainingButton, tournamentButton]);
    }

    createBattleStats(panel, y) {
        const centerX = this.width / 2;
        
        // Panel stats
        const statsBg = this.scene.add.graphics();
        statsBg.fillStyle(0x1C3A3A, 0.8);
        statsBg.fillRoundedRect(30, y, this.width - 60, 60, 8);
        statsBg.lineStyle(1, 0x4682B4);
        statsBg.strokeRoundedRect(30, y, this.width - 60, 60, 8);
        
        const statsTitle = this.scene.add.text(centerX, y + 15, 'Vos statistiques', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        // Stats en ligne
        const wins = this.userData?.gameStats?.wins || 0;
        const losses = this.userData?.gameStats?.losses || 0;
        const winRate = this.userData?.winRate || 0;
        
        const statsText = this.scene.add.text(centerX, y + 40, 
            `✅ ${wins} victoires  •  ❌ ${losses} défaites  •  📊 ${winRate}% de réussite`, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        }).setOrigin(0.5);
        
        panel.add([statsBg, statsTitle, statsText]);
    }

    // === 1. PANEL COLLECTION ===
    createCollectionPanel() {
        const panel = this.createPanelBase(1, 'COLLECTION', '🃏');
        
        const centerX = this.width / 2;
        const startY = 60;
        
        // Grille de cartes (simulation)
        this.createCardGrid(panel, startY);
        
        // Boutons d'action
        const upgradeButton = this.createActionButton(
            centerX - 70, this.contentHeight - 60,
            120, 40,
            '⬆️ Améliorer',
            '#32CD32',
            () => this.onAction('upgrade_cards')
        );
        
        const filterButton = this.createActionButton(
            centerX + 70, this.contentHeight - 60,
            120, 40,
            '🔍 Filtrer',
            '#4682B4',
            () => this.onAction('filter_cards')
        );
        
        panel.add([upgradeButton, filterButton]);
    }

    createCardGrid(panel, startY) {
        const cardWidth = this.isMobile ? 45 : 55;
        const cardHeight = this.isMobile ? 60 : 70;
        const spacing = this.isMobile ? 50 : 60;
        const cols = this.isMobile ? 4 : 5;
        const rows = this.isMobile ? 3 : 3;
        
        const startX = this.width / 2 - (cols - 1) * spacing / 2;
        
        // Cartes de base (simulation)
        const cardTypes = [
            { icon: '🗡️', name: 'Chevalier', rarity: 'common' },
            { icon: '🏹', name: 'Archers', rarity: 'common' },
            { icon: '🔥', name: 'Boule de feu', rarity: 'rare' },
            { icon: '⚡', name: 'Foudre', rarity: 'epic' },
            { icon: '🐲', name: 'Dragon', rarity: 'legendary' },
            { icon: '🛡️', name: 'Géant', rarity: 'rare' },
            { icon: '👥', name: 'Barbares', rarity: 'common' },
            { icon: '🦇', name: 'Gargouilles', rarity: 'common' }
        ];
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const index = row * cols + col;
                if (index >= cardTypes.length) break;
                
                const card = cardTypes[index];
                const x = startX + col * spacing;
                const y = startY + row * (cardHeight + 20);
                
                this.createCardPreview(panel, x, y, cardWidth, cardHeight, card);
            }
        }
    }

    createCardPreview(panel, x, y, width, height, cardData) {
        const cardContainer = this.scene.add.container(x, y);
        
        // Couleur selon rareté
        const rarityColors = {
            common: 0x808080,     // Gris
            rare: 0x4169E1,       // Bleu
            epic: 0x9370DB,       // Violet
            legendary: 0xFFD700   // Or
        };
        
        const color = rarityColors[cardData.rarity] || 0x808080;
        
        // Background carte
        const cardBg = this.scene.add.graphics();
        cardBg.fillStyle(color, 0.8);
        cardBg.fillRoundedRect(-width/2, -height/2, width, height, 6);
        cardBg.lineStyle(2, color);
        cardBg.strokeRoundedRect(-width/2, -height/2, width, height, 6);
        
        // Icône
        const icon = this.scene.add.text(0, -8, cardData.icon, {
            fontSize: this.isMobile ? '20px' : '24px'
        }).setOrigin(0.5);
        
        // Niveau (simulation)
        const level = Math.floor(Math.random() * 5) + 1;
        const levelText = this.scene.add.text(0, 15, `Niv. ${level}`, {
            fontSize: this.isMobile ? '8px' : '10px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF'
        }).setOrigin(0.5);
        
        cardContainer.add([cardBg, icon, levelText]);
        
        // Interactivité
        cardBg.setInteractive(new Phaser.Geom.Rectangle(-width/2, -height/2, width, height), 
            Phaser.Geom.Rectangle.Contains);
        
        cardBg.on('pointerdown', () => {
            this.scene.tweens.add({
                targets: cardContainer,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => this.onAction('view_card', cardData)
            });
        });
        
        panel.add(cardContainer);
    }

    // === 2. PANEL DECK ===
    createDeckPanel() {
        const panel = this.createPanelBase(2, 'DECK', '🛡️');
        
        const centerX = this.width / 2;
        const startY = 60;
        
        // Slots de deck (8 cartes)
        this.createDeckSlots(panel, startY);
        
        // Coût moyen en élixir
        this.createElixirCost(panel, startY + 140);
        
        // Boutons d'action
        const editButton = this.createActionButton(
            centerX - 70, this.contentHeight - 60,
            120, 40,
            '✏️ Modifier',
            '#FFD700',
            () => this.onAction('edit_deck')
        );
        
        const copyButton = this.createActionButton(
            centerX + 70, this.contentHeight - 60,
            120, 40,
            '📋 Copier',
            '#4682B4',
            () => this.onAction('copy_deck')
        );
        
        panel.add([editButton, copyButton]);
    }

    createDeckSlots(panel, startY) {
        const slotSize = this.isMobile ? 35 : 45;
        const spacing = this.isMobile ? 40 : 50;
        const cols = 4;
        const rows = 2;
        
        const startX = this.width / 2 - (cols - 1) * spacing / 2;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * spacing;
                const y = startY + row * (slotSize + 15);
                
                const slot = this.scene.add.graphics();
                slot.fillStyle(0x1C3A3A, 0.8);
                slot.fillRoundedRect(x - slotSize/2, y - slotSize/2, slotSize, slotSize, 6);
                slot.lineStyle(2, 0x4682B4, 0.5);
                slot.strokeRoundedRect(x - slotSize/2, y - slotSize/2, slotSize, slotSize, 6);
                
                // Placeholder
                const placeholder = this.scene.add.text(x, y, '+', {
                    fontSize: this.isMobile ? '16px' : '20px',
                    fontFamily: 'Arial, sans-serif',
                    fill: '#708090'
                }).setOrigin(0.5);
                
                panel.add([slot, placeholder]);
            }
        }
    }

    createElixirCost(panel, y) {
        const centerX = this.width / 2;
        
        const costBg = this.scene.add.graphics();
        costBg.fillStyle(0x1C3A3A, 0.8);
        costBg.fillRoundedRect(centerX - 80, y, 160, 40, 8);
        costBg.lineStyle(1, 0x9370DB);
        costBg.strokeRoundedRect(centerX - 80, y, 160, 40, 8);
        
        const costTitle = this.scene.add.text(centerX, y + 12, 'Coût moyen', {
            fontSize: this.isMobile ? '11px' : '12px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        }).setOrigin(0.5);
        
        const costValue = this.scene.add.text(centerX, y + 28, '⚡ 3.8', {
            fontSize: this.isMobile ? '14px' : '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#9370DB'
        }).setOrigin(0.5);
        
        panel.add([costBg, costTitle, costValue]);
    }

    // === 3. PANEL CLAN ===
    createClanPanel() {
        const panel = this.createPanelBase(3, 'CLAN', '🏰');
        
        const centerX = this.width / 2;
        const startY = 60;
        
        // État du clan
        const clanStatus = this.userData?.clan || null;
        
        if (clanStatus) {
            this.createClanInfo(panel, startY);
        } else {
            this.createNoClanContent(panel, startY);
        }
    }

    createNoClanContent(panel, startY) {
        const centerX = this.width / 2;
        
        // Message
        const message = this.scene.add.text(centerX, startY + 40, 
            'Vous n\'appartenez à aucun clan.\nRejoignez-en un pour accéder à de nouvelles fonctionnalités !', {
            fontSize: this.isMobile ? '13px' : '15px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE',
            align: 'center',
            wordWrap: { width: this.width - 60 }
        }).setOrigin(0.5);
        
        // Boutons
        const joinButton = this.createActionButton(
            centerX, startY + 120,
            180, 50,
            '🔍 Rejoindre un clan',
            '#32CD32',
            () => this.onAction('join_clan')
        );
        
        const createButton = this.createActionButton(
            centerX, startY + 190,
            180, 50,
            '🏗️ Créer un clan',
            '#FFD700',
            () => this.onAction('create_clan')
        );
        
        panel.add([message, joinButton, createButton]);
    }

    createClanInfo(panel, startY) {
        const centerX = this.width / 2;
        
        // Info clan (simulation)
        const clanName = this.userData?.clan?.name || 'Les Champions';
        const memberCount = this.userData?.clan?.members || 25;
        
        const clanTitle = this.scene.add.text(centerX, startY, clanName, {
            fontSize: this.isMobile ? '16px' : '18px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        const memberText = this.scene.add.text(centerX, startY + 25, `👥 ${memberCount}/50 membres`, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        }).setOrigin(0.5);
        
        // Boutons d'action clan
        const spacing = 70;
        
        const chatButton = this.createActionButton(
            centerX - spacing, startY + 80,
            120, 40,
            '💬 Chat',
            '#4682B4',
            () => this.onAction('clan_chat')
        );
        
        const warButton = this.createActionButton(
            centerX, startY + 80,
            120, 40,
            '⚔️ Guerre',
            '#DC143C',
            () => this.onAction('clan_war')
        );
        
        const donateButton = this.createActionButton(
            centerX + spacing, startY + 80,
            120, 40,
            '🎁 Donner',
            '#32CD32',
            () => this.onAction('clan_donate')
        );
        
        panel.add([clanTitle, memberText, chatButton, warButton, donateButton]);
    }

    // === 4. PANEL PROFIL ===
    createProfilePanel() {
        const panel = this.createPanelBase(4, 'PROFIL', '👤');
        
        const centerX = this.width / 2;
        const startY = 60;
        
        // Informations utilisateur
        this.createUserProfile(panel, startY);
        
        // Boutons d'action
        const settingsButton = this.createActionButton(
            centerX - 70, this.contentHeight - 60,
            120, 40,
            '⚙️ Paramètres',
            '#708090',
            () => this.onAction('settings')
        );
        
        const logoutButton = this.createActionButton(
            centerX + 70, this.contentHeight - 60,
            120, 40,
            '🚪 Déconnexion',
            '#DC143C',
            () => this.onAction('logout')
        );
        
        panel.add([settingsButton, logoutButton]);
    }

    createUserProfile(panel, startY) {
        const centerX = this.width / 2;
        const user = this.userData;
        
        // Stats principales
        const stats = [
            { label: '🏆 Trophées', value: user?.playerStats?.trophies || 0 },
            { label: '⭐ Niveau', value: user?.playerStats?.level || 1 },
            { label: '🎮 Parties jouées', value: user?.gameStats?.totalGames || 0 },
            { label: '✅ Victoires', value: user?.gameStats?.wins || 0 },
            { label: '📈 Ratio de victoire', value: `${user?.winRate || 0}%` },
            { label: '🔥 Série actuelle', value: user?.gameStats?.winStreak || 0 }
        ];
        
        const rowHeight = this.isMobile ? 25 : 30;
        const leftCol = centerX - 80;
        const rightCol = centerX + 80;
        
        stats.forEach((stat, index) => {
            const row = Math.floor(index / 2);
            const col = index % 2;
            const x = col === 0 ? leftCol : rightCol;
            const y = startY + row * rowHeight;
            
            // Label
            const label = this.scene.add.text(x - 60, y, stat.label, {
                fontSize: this.isMobile ? '11px' : '12px',
                fontFamily: 'Arial, sans-serif',
                fill: '#B0C4DE'
            });
            
            // Valeur
            const value = this.scene.add.text(x + 60, y, stat.value.toString(), {
                fontSize: this.isMobile ? '11px' : '12px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                fill: '#FFD700'
            }).setOrigin(1, 0);
            
            panel.add([label, value]);
        });
        
        // Temps de jeu (si disponible)
        if (!this.isMobile) {
            const playTime = this.scene.add.text(centerX, startY + stats.length / 2 * rowHeight + 20, 
                '⏱️ Temps de jeu total: 12h 34min', {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                fill: '#B0C4DE'
            }).setOrigin(0.5);
            
            panel.add(playTime);
        }
    }

    // === BOUTON D'ACTION RÉUTILISABLE ===
    createActionButton(x, y, width, height, text, color, callback) {
        const container = this.scene.add.container(x, y);
        
        // Convertir couleur hex en nombre
        const colorNum = typeof color === 'string' ? 
            parseInt(color.replace('#', '0x')) : color;
        
        // Background avec effet 3D
        const bg = this.scene.add.graphics();
        bg.fillStyle(colorNum);
        bg.fillRoundedRect(-width/2, -height/2, width, height, 8);
        
        // Ombre
        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.3);
        shadow.fillRoundedRect(-width/2 + 3, -height/2 + 3, width, height, 8);
        
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
        
        container.add([shadow, bg, shine, buttonText]);
        
        // Interactivité
        bg.setInteractive(new Phaser.Geom.Rectangle(-width/2, -height/2, width, height), 
            Phaser.Geom.Rectangle.Contains);
        
        bg.on('pointerdown', () => {
            container.setScale(0.95);
            this.scene.time.delayedCall(100, () => {
                container.setScale(1);
                if (callback) callback();
            });
        });
        
        bg.on('pointerover', () => {
            container.setScale(1.05);
        });
        
        bg.on('pointerout', () => {
            container.setScale(1);
        });
        
        return container;
    }

    // === GESTION DES PANELS ===
    showPanel(index, animate = true) {
        if (index === this.currentPanel || index < 0 || index >= this.panels.length) {
            return;
        }
        
        // Masquer panel actuel
        if (this.panels[this.currentPanel]) {
            this.hidePanel(this.currentPanel, animate);
        }
        
        // Afficher nouveau panel
        this.currentPanel = index;
        const panel = this.panels[index];
        
        if (panel) {
            panel.setVisible(true);
            
            if (animate) {
                panel.setAlpha(0);
                this.scene.tweens.add({
                    targets: panel,
                    alpha: 1,
                    duration: 300,
                    ease: 'Power2'
                });
            } else {
                panel.setAlpha(1);
            }
        }
        
        console.log(`📋 Panel actif: ${this.tabs[index]} (${index})`);
    }

    hidePanel(index, animate = true) {
        const panel = this.panels[index];
        if (!panel) return;
        
        if (animate) {
            this.scene.tweens.add({
                targets: panel,
                alpha: 0,
                duration: 200,
                ease: 'Power2',
                onComplete: () => {
                    panel.setVisible(false);
                }
            });
        } else {
            panel.setVisible(false);
        }
    }

    // === MÉTHODES PUBLIQUES ===
    switchToPanel(index) {
        this.showPanel(index, true);
    }

    getCurrentPanel() {
        return this.currentPanel;
    }

    updateUserData(newUserData) {
        this.userData = newUserData;
        this.refreshPanels();
    }

    refreshPanels() {
        // Recréer les panels avec nouvelles données
        // Pour l'instant, on log juste la mise à jour
        console.log('🔄 TabPanels mis à jour');
    }

    playPanelTransition(direction = 'left') {
        const panel = this.panels[this.currentPanel];
        if (!panel) return;
        
        const targetX = direction === 'left' ? -50 : 50;
        
        this.scene.tweens.add({
            targets: panel,
            x: targetX,
            duration: 200,
            yoyo: true,
            ease: 'Power2'
        });
    }

    // === ANIMATIONS GLOBALES ===
    show() {
        this.container.setAlpha(0);
        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            duration: 400,
            ease: 'Power2'
        });
    }

    hide() {
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 300,
            ease: 'Power2'
        });
    }

    // === NETTOYAGE ===
    destroy() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        
        this.panels = [];
        
        console.log('🗑️ TabPanels détruit');
    }

    // === GETTERS ===
    getContainer() {
        return this.container;
    }

    getPanelCount() {
        return this.panels.length;
    }

    getTabName(index) {
        return this.tabs[index] || null;
    }
}
