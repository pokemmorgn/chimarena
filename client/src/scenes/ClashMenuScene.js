// client/src/scenes/ClashMenuScene.js - ARCHITECTURE CORRIGÉE
import Phaser from 'phaser';
import { auth } from '../api';
import { ClashHeader } from '../clashmenu';

export default class ClashMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ClashMenuScene' });
        
        this.currentUser = null;
        this.gameInstance = null;
        
        // Navigation
        this.currentTab = 0;
        this.tabs = ['Bataille', 'Collection', 'Deck', 'Clan', 'Profil'];
        
        // Composants Clash Royale
        this.clashHeader = null; // ✅ RESTE FIXE
        // 🔄 TOUS CES COMPOSANTS VONT DANS LES PANELS MAINTENANT :
        // this.arenaDisplay = null;     -> va dans le panel Bataille
        // this.tabNavigation = null;    -> va dans chaque panel
        // this.tabPanels = null;        -> remplacé par des panels complets
        
        // 🆕 NOUVEAUX PANELS COMPLETS
        this.fullPanels = [];
        this.currentPanelContainer = null;
        
        // Dimensions
        this.isMobile = window.GameConfig?.MOBILE_OPTIMIZED || false;
        this.contentStartY = 100; // Après le header
    }

    create() {
        console.log('🏆 ClashMenuScene - Architecture Header + Panels complets');
        
        // Récupérer données
        this.gameInstance = this.registry.get('gameInstance');
        this.currentUser = this.registry.get('currentUser');
        
        // Vérifier auth
        if (!auth.isAuthenticated()) {
            console.warn('❌ Non authentifié, retour AuthScene');
            this.scene.start('AuthScene');
            return;
        }
        
        // Créer l'interface
        this.createBackground();
        this.createFixedHeader(); // ✅ SEUL ÉLÉMENT FIXE
        this.createAllPanels();   // 🆕 CRÉER TOUS LES PANELS COMPLETS
        
        // Afficher le premier panel
        this.showPanel(0);
        
        // Animations et événements
        this.playEntranceAnimation();
        this.setupInputEvents();
        
        console.log('✅ ClashMenuScene avec Header fixe + Panels complets');
    }

    // === CRÉATION DU FOND ===
    createBackground() {
        const { width, height } = this.scale;
        
        // Dégradé bleu Clash Royale
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x4682B4, 0x4682B4, 1);
        bg.fillRect(0, 0, width, height);
        
        // Nuages décoratifs
        this.createClouds();
    }

    createClouds() {
        const { width } = this.scale;
        const cloudCount = this.isMobile ? 3 : 5;
        
        for (let i = 0; i < cloudCount; i++) {
            const cloud = this.add.graphics();
            cloud.fillStyle(0xFFFFFF, 0.1);
            
            // Forme de nuage simple
            cloud.fillCircle(0, 0, 30);
            cloud.fillCircle(25, 0, 25);
            cloud.fillCircle(-20, 0, 20);
            cloud.fillCircle(10, -15, 15);
            
            cloud.setPosition(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(50, 200)
            );
            
            // Animation flottante
            this.tweens.add({
                targets: cloud,
                x: cloud.x + Phaser.Math.Between(20, 50),
                duration: Phaser.Math.Between(8000, 12000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    // === HEADER FIXE (inchangé) ===
    createFixedHeader() {
        console.log('🏗️ Création Header fixe...');
        this.clashHeader = new ClashHeader(this, this.currentUser);
    }

    // === CRÉATION DE TOUS LES PANELS COMPLETS ===
    createAllPanels() {
        console.log('🏗️ Création de tous les panels complets...');
        
        // Créer les 5 panels complets
        this.fullPanels = [
            this.createBattlePanel(),      // 0 - Bataille avec ArenaDisplay + Navigation
            this.createCollectionPanel(),  // 1 - Collection complète
            this.createDeckPanel(),        // 2 - Deck complet
            this.createClanPanel(),        // 3 - Clan complet
            this.createProfilePanel()      // 4 - Profil complet
        ];
        
        // Tous invisibles au départ
        this.fullPanels.forEach(panel => panel.setVisible(false));
    }

    // === PANEL BATAILLE COMPLET (avec ArenaDisplay + Navigation) ===
    createBattlePanel() {
        const { width, height } = this.scale;
        const panel = this.add.container(0, 0);
        
        // 1. ArenaDisplay (remplace l'ancien composant séparé)
        const arenaContainer = this.add.container(0, this.contentStartY);
        
        // Fond arène
        const arenaBg = this.add.graphics();
        arenaBg.fillStyle(0x2F4F4F, 0.9);
        arenaBg.fillRoundedRect(20, 0, width - 40, 140, 15);
        arenaBg.lineStyle(4, 0xFFD700, 1);
        arenaBg.strokeRoundedRect(20, 0, width - 40, 140, 15);
        
        // Info arène
        const arenaName = this.add.text(width/2, 30, 'Arène des Gobelins', {
            fontSize: this.isMobile ? '18px' : '22px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        const trophies = this.currentUser?.playerStats?.trophies || 0;
        const trophyText = this.add.text(width/2, 60, `🏆 ${trophies}/400`, {
            fontSize: this.isMobile ? '14px' : '16px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        }).setOrigin(0.5);
        
        // Barre progression
        const progressBg = this.add.graphics();
        progressBg.fillStyle(0x2F2F2F, 0.8);
        progressBg.fillRoundedRect(width/2 - 100, 80, 200, 12, 6);
        
        const progressFill = this.add.graphics();
        progressFill.fillStyle(0xFFD700, 1);
        const progressPercent = Math.min((trophies / 400) * 100, 100);
        progressFill.fillRoundedRect(width/2 - 98, 82, (196 * progressPercent / 100), 8, 4);
        
        arenaContainer.add([arenaBg, arenaName, trophyText, progressBg, progressFill]);
        
        // 2. Contenu bataille
        const battleContent = this.add.container(0, this.contentStartY + 160);
        
        // Bouton principal BATAILLE
        const battleBtn = this.createPanelButton(width/2, 40, 220, 70, '⚔️ BATAILLE', '#FFD700', () => {
            this.handlePanelAction('battle');
        });
        
        // Boutons secondaires
        const trainingBtn = this.createPanelButton(width/2 - 80, 130, 140, 50, '🎯 Entraînement', '#32CD32', () => {
            this.handlePanelAction('training');
        });
        
        const tournamentBtn = this.createPanelButton(width/2 + 80, 130, 140, 50, '🏆 Tournoi', '#9370DB', () => {
            this.handlePanelAction('tournament');
        });
        
        battleContent.add([battleBtn, trainingBtn, tournamentBtn]);
        
        // 3. Navigation en bas
        const navigation = this.createPanelNavigation(0);
        
        panel.add([arenaContainer, battleContent, navigation]);
        panel.name = 'BattlePanel';
        
        return panel;
    }

    // === PANEL COLLECTION COMPLET ===
    createCollectionPanel() {
        const { width, height } = this.scale;
        const panel = this.add.container(0, 0);
        
        // Titre
        const title = this.add.text(width/2, this.contentStartY + 30, '🃏 MA COLLECTION', {
            fontSize: this.isMobile ? '18px' : '22px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        // Grille de cartes simulée
        const cardGrid = this.add.container(0, this.contentStartY + 80);
        this.createSimpleCardGrid(cardGrid);
        
        // Boutons d'action
        const upgradeBtn = this.createPanelButton(width/2 - 70, height - 150, 120, 40, '⬆️ Améliorer', '#32CD32', () => {
            this.handlePanelAction('upgrade_cards');
        });
        
        const filterBtn = this.createPanelButton(width/2 + 70, height - 150, 120, 40, '🔍 Filtrer', '#4682B4', () => {
            this.handlePanelAction('filter_cards');
        });
        
        // Navigation
        const navigation = this.createPanelNavigation(1);
        
        panel.add([title, cardGrid, upgradeBtn, filterBtn, navigation]);
        panel.name = 'CollectionPanel';
        
        return panel;
    }

    // === PANEL DECK COMPLET ===
    createDeckPanel() {
        const { width, height } = this.scale;
        const panel = this.add.container(0, 0);
        
        // Titre
        const title = this.add.text(width/2, this.contentStartY + 30, '🛡️ MON DECK', {
            fontSize: this.isMobile ? '18px' : '22px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        // Slots de deck (8 cartes)
        const deckSlots = this.add.container(0, this.contentStartY + 80);
        this.createDeckSlots(deckSlots);
        
        // Coût moyen
        const costBg = this.add.graphics();
        costBg.fillStyle(0x1C3A3A, 0.8);
        costBg.fillRoundedRect(width/2 - 80, this.contentStartY + 200, 160, 40, 8);
        
        const costText = this.add.text(width/2, this.contentStartY + 220, '⚡ Coût moyen: 3.8', {
            fontSize: this.isMobile ? '14px' : '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#9370DB'
        }).setOrigin(0.5);
        
        // Boutons d'action
        const editBtn = this.createPanelButton(width/2 - 70, height - 150, 120, 40, '✏️ Modifier', '#FFD700', () => {
            this.handlePanelAction('edit_deck');
        });
        
        const copyBtn = this.createPanelButton(width/2 + 70, height - 150, 120, 40, '📋 Copier', '#4682B4', () => {
            this.handlePanelAction('copy_deck');
        });
        
        // Navigation
        const navigation = this.createPanelNavigation(2);
        
        panel.add([title, deckSlots, costBg, costText, editBtn, copyBtn, navigation]);
        panel.name = 'DeckPanel';
        
        return panel;
    }

    // === PANEL CLAN COMPLET ===
    createClanPanel() {
        const { width, height } = this.scale;
        const panel = this.add.container(0, 0);
        
        // Titre
        const title = this.add.text(width/2, this.contentStartY + 30, '🏰 CLAN', {
            fontSize: this.isMobile ? '18px' : '22px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        // Message pas de clan
        const message = this.add.text(width/2, this.contentStartY + 120, 
            'Vous n\'appartenez à aucun clan.\nRejoignez-en un pour accéder à de nouvelles fonctionnalités !', {
            fontSize: this.isMobile ? '13px' : '15px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE',
            align: 'center',
            wordWrap: { width: width - 60 }
        }).setOrigin(0.5);
        
        // Boutons
        const joinBtn = this.createPanelButton(width/2, this.contentStartY + 200, 180, 50, '🔍 Rejoindre un clan', '#32CD32', () => {
            this.handlePanelAction('join_clan');
        });
        
        const createBtn = this.createPanelButton(width/2, this.contentStartY + 270, 180, 50, '🏗️ Créer un clan', '#FFD700', () => {
            this.handlePanelAction('create_clan');
        });
        
        // Navigation
        const navigation = this.createPanelNavigation(3);
        
        panel.add([title, message, joinBtn, createBtn, navigation]);
        panel.name = 'ClanPanel';
        
        return panel;
    }

    // === PANEL PROFIL COMPLET ===
    createProfilePanel() {
        const { width, height } = this.scale;
        const panel = this.add.container(0, 0);
        
        // Titre
        const title = this.add.text(width/2, this.contentStartY + 30, '👤 MON PROFIL', {
            fontSize: this.isMobile ? '18px' : '22px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        // Stats utilisateur
        const statsContainer = this.add.container(0, this.contentStartY + 80);
        this.createUserStats(statsContainer);
        
        // Boutons d'action
        const settingsBtn = this.createPanelButton(width/2 - 70, height - 150, 120, 40, '⚙️ Paramètres', '#708090', () => {
            this.handlePanelAction('settings');
        });
        
        const logoutBtn = this.createPanelButton(width/2 + 70, height - 150, 120, 40, '🚪 Déconnexion', '#DC143C', () => {
            this.handlePanelAction('logout');
        });
        
        // Navigation
        const navigation = this.createPanelNavigation(4);
        
        panel.add([title, statsContainer, settingsBtn, logoutBtn, navigation]);
        panel.name = 'ProfilePanel';
        
        return panel;
    }

    // === NAVIGATION POUR CHAQUE PANEL ===
    createPanelNavigation(activeIndex) {
        const { width, height } = this.scale;
        const navContainer = this.add.container(0, height - 70);
        
        // Fond navigation (ajouté en premier pour être derrière)
        const navBg = this.add.graphics();
        navBg.fillStyle(0x2F4F4F, 1);
        navBg.fillRect(0, 0, width, 70);
        navBg.lineStyle(3, 0xFFD700);
        navBg.lineBetween(0, 0, width, 0);
        navContainer.add(navBg);
        
        // Boutons onglets
        const tabWidth = width / this.tabs.length;
        const tabIcons = ['⚔️', '🃏', '🛡️', '🏰', '👤'];
        
        this.tabs.forEach((tabName, index) => {
            const x = tabWidth * index + tabWidth / 2;
            const y = 35;
            
            // Background onglet
            const tabBg = this.add.graphics();
            const isActive = index === activeIndex;
            
            if (isActive) {
                tabBg.fillStyle(0xFFD700, 1);
                tabBg.fillRoundedRect(x - 30, y - 25, 60, 50, 12);
            } else {
                tabBg.fillStyle(0x4682B4, 0.7);
                tabBg.fillRoundedRect(x - 25, y - 20, 50, 40, 10);
            }
            
            // Icône avec couleur visible
            const icon = this.add.text(x, y - 5, tabIcons[index], {
                fontSize: isActive ? '24px' : '20px',
                fill: isActive ? '#2F4F4F' : '#FFFFFF'  // ✅ Couleur ajoutée
            }).setOrigin(0.5);
            
            // Texte
            const text = this.add.text(x, y + 15, tabName, {
                fontSize: isActive ? '10px' : '8px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                fill: isActive ? '#2F4F4F' : '#FFFFFF'
            }).setOrigin(0.5);
            
            // Ajouter les éléments dans le bon ordre
            navContainer.add([tabBg, icon, text]);
            
            // Interactivité (ajoutée après pour être au-dessus)
            if (!isActive) {
                const hitArea = this.add.zone(x, y, 60, 50).setInteractive();
                hitArea.on('pointerdown', () => {
                    this.switchToTab(index);
                });
                navContainer.add(hitArea);
            }
        });
        
        return navContainer;
    }

    // === UTILITAIRES ===
    createPanelButton(x, y, width, height, text, color, callback) {
        const container = this.add.container(x, y);
        
        const colorNum = typeof color === 'string' ? parseInt(color.replace('#', '0x')) : color;
        
        const bg = this.add.graphics();
        bg.fillStyle(colorNum);
        bg.fillRoundedRect(-width/2, -height/2, width, height, 8);
        
        const buttonText = this.add.text(0, 0, text, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF'
        }).setOrigin(0.5);
        
        container.add([bg, buttonText]);
        
        bg.setInteractive(new Phaser.Geom.Rectangle(-width/2, -height/2, width, height), 
            Phaser.Geom.Rectangle.Contains);
        
        bg.on('pointerdown', () => {
            container.setScale(0.95);
            this.time.delayedCall(100, () => {
                container.setScale(1);
                if (callback) callback();
            });
        });
        
        return container;
    }

    createSimpleCardGrid(container) {
        const { width } = this.scale;
        const cardSize = this.isMobile ? 35 : 45;
        const spacing = this.isMobile ? 40 : 50;
        const cols = 4;
        const rows = 3;
        
        const startX = width / 2 - (cols - 1) * spacing / 2;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * spacing;
                const y = row * (cardSize + 15);
                
                const card = this.add.graphics();
                card.fillStyle(0x4169E1, 0.8);
                card.fillRoundedRect(x - cardSize/2, y - cardSize/2, cardSize, cardSize, 6);
                
                const icon = this.add.text(x, y, ['🗡️', '🏹', '🔥', '⚡', '🐲', '🛡️'][row * cols + col] || '❓', {
                    fontSize: this.isMobile ? '16px' : '20px'
                }).setOrigin(0.5);
                
                container.add([card, icon]);
            }
        }
    }

    createDeckSlots(container) {
        const { width } = this.scale;
        const slotSize = this.isMobile ? 35 : 45;
        const spacing = this.isMobile ? 40 : 50;
        const cols = 4;
        const rows = 2;
        
        const startX = width / 2 - (cols - 1) * spacing / 2;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = startX + col * spacing;
                const y = row * (slotSize + 15);
                
                const slot = this.add.graphics();
                slot.fillStyle(0x1C3A3A, 0.8);
                slot.fillRoundedRect(x - slotSize/2, y - slotSize/2, slotSize, slotSize, 6);
                slot.lineStyle(2, 0x4682B4, 0.5);
                slot.strokeRoundedRect(x - slotSize/2, y - slotSize/2, slotSize, slotSize, 6);
                
                const placeholder = this.add.text(x, y, '+', {
                    fontSize: this.isMobile ? '16px' : '20px',
                    fontFamily: 'Arial, sans-serif',
                    fill: '#708090'
                }).setOrigin(0.5);
                
                container.add([slot, placeholder]);
            }
        }
    }

    createUserStats(container) {
        const { width } = this.scale;
        const user = this.currentUser;
        
        const stats = [
            { label: '🏆 Trophées', value: user?.playerStats?.trophies || 0 },
            { label: '⭐ Niveau', value: user?.playerStats?.level || 1 },
            { label: '🎮 Parties', value: user?.gameStats?.totalGames || 0 },
            { label: '✅ Victoires', value: user?.gameStats?.wins || 0 },
        ];
        
        const rowHeight = 30;
        const leftCol = width / 2 - 80;
        const rightCol = width / 2 + 80;
        
        stats.forEach((stat, index) => {
            const row = Math.floor(index / 2);
            const col = index % 2;
            const x = col === 0 ? leftCol : rightCol;
            const y = row * rowHeight;
            
            const label = this.add.text(x - 60, y, stat.label, {
                fontSize: this.isMobile ? '12px' : '14px',
                fontFamily: 'Arial, sans-serif',
                fill: '#B0C4DE'
            });
            
            const value = this.add.text(x + 60, y, stat.value.toString(), {
                fontSize: this.isMobile ? '12px' : '14px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                fill: '#FFD700'
            }).setOrigin(1, 0);
            
            container.add([label, value]);
        });
    }

    // === GESTION DES ONGLETS ===
    showPanel(index) {
        // Masquer tous les panels
        this.fullPanels.forEach(panel => panel.setVisible(false));
        
        // Afficher le panel demandé
        if (this.fullPanels[index]) {
            this.fullPanels[index].setVisible(true);
            this.currentTab = index;
            console.log(`✅ Panel affiché: ${this.tabs[index]} (${index})`);
        }
    }

    switchToTab(index) {
        if (index === this.currentTab) return;
        
        console.log(`📱 Changement onglet: ${this.tabs[this.currentTab]} -> ${this.tabs[index]}`);
        
        // Animation de transition
        const currentPanel = this.fullPanels[this.currentTab];
        const nextPanel = this.fullPanels[index];
        
        if (currentPanel) {
            this.tweens.add({
                targets: currentPanel,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    currentPanel.setVisible(false);
                    nextPanel.setVisible(true);
                    nextPanel.setAlpha(0);
                    
                    this.tweens.add({
                        targets: nextPanel,
                        alpha: 1,
                        duration: 200
                    });
                }
            });
        } else {
            nextPanel.setVisible(true);
        }
        
        this.currentTab = index;
    }

    // === RESTE DES MÉTHODES (handlePanelAction, etc.) INCHANGÉES ===
    handlePanelAction(action, data) {
        console.log(`🎮 Action panel: ${action}`, data);
        
        switch (action) {
            case 'battle':
                this.startBattle();
                break;
            case 'training':
                this.showMessage('Mode entraînement - Bientôt disponible !', 'info');
                break;
            case 'tournament':
                this.showMessage('Tournois - Bientôt disponibles !', 'info');
                break;
            case 'upgrade_cards':
                this.showMessage('Amélioration de cartes - En développement', 'info');
                break;
            case 'filter_cards':
                this.showMessage('Filtres de cartes - En développement', 'info');
                break;
            case 'edit_deck':
                this.showMessage('Éditeur de deck - En développement', 'info');
                break;
            case 'copy_deck':
                this.showMessage('Copie de deck - En développement', 'info');
                break;
            case 'join_clan':
                this.showMessage('Rejoindre un clan - En développement', 'info');
                break;
            case 'create_clan':
                this.showMessage('Créer un clan - En développement', 'info');
                break;
            case 'settings':
                this.showMessage('Paramètres - En développement', 'info');
                break;
            case 'logout':
                this.handleLogout();
                break;
            default:
                this.showMessage(`Action "${action}" non implémentée`, 'info');
        }
    }

    startBattle() {
        console.log('⚔️ Démarrage bataille...');
        this.showMessage('Recherche d\'adversaire...', 'info');
    }

    async handleLogout() {
        const confirm = window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
        if (!confirm) return;

        try {
            console.log('🚪 Déconnexion...');
            this.cleanup();
            await auth.logout();
            this.gameInstance?.clearAuthData();
            this.showMessage('Déconnexion réussie', 'success');
            this.scene.start('AuthScene');
        } catch (error) {
            console.error('❌ Erreur déconnexion:', error);
            this.cleanup();
            this.gameInstance?.clearAuthData();
            this.showMessage('Déconnexion locale effectuée', 'info');
            this.scene.start('AuthScene');
        }
    }

    showMessage(message, type = 'info') {
        if (window.NotificationManager) {
            window.NotificationManager.show(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    setupInputEvents() {
        if (!this.isMobile) {
            this.input.keyboard.on('keydown-LEFT', () => {
                const newIndex = Math.max(0, this.currentTab - 1);
                this.switchToTab(newIndex);
            });
            
            this.input.keyboard.on('keydown-RIGHT', () => {
                const newIndex = Math.min(this.tabs.length - 1, this.currentTab + 1);
                this.switchToTab(newIndex);
            });
        }
    }

    playEntranceAnimation() {
        this.cameras.main.setAlpha(0);
        this.tweens.add({
            targets: this.cameras.main,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
        
        if (this.clashHeader) {
            this.clashHeader.show();
        }
    }

    cleanup() {
        if (this.clashHeader) {
            this.clashHeader.destroy();
            this.clashHeader = null;
        }
    }

    update() {
        if (!auth.isAuthenticated()) {
            console.warn('⚠️ Perte d\'authentification détectée');
            this.cleanup();
            this.scene.start('AuthScene');
        }
    }

    destroy() {
        console.log('🧹 ClashMenuScene détruite');
        this.cleanup();
        super.destroy();
    }
}
