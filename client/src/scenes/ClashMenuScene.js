// client/src/scenes/ClashMenuScene.js - SCÈNE PRINCIPALE CLASH ROYALE
import Phaser from 'phaser';
import { auth } from '../api';

export default class ClashMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ClashMenuScene' });
        
        this.currentUser = null;
        this.gameInstance = null;
        
        // Navigation
        this.currentTab = 0; // 0=Bataille, 1=Collection, 2=Deck, 3=Clan, 4=Profil
        this.tabs = ['Bataille', 'Collection', 'Deck', 'Clan', 'Profil'];
        
        // Composants (seront importés plus tard)
        this.clashHeader = null;
        this.arenaDisplay = null;
        this.tabNavigation = null;
        this.tabPanels = null;
        
        // Dimensions
        this.isMobile = window.GameConfig?.MOBILE_OPTIMIZED || false;
    }

    create() {
        console.log('🏆 ClashMenuScene - Menu Clash Royale créé');
        
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
        this.createHeader();
        this.createArenaSection();
        this.createTabNavigation();
        this.createTabContent();
        
        // Afficher l'onglet par défaut
        this.switchToTab(0);
        
        // Animations et événements
        this.playEntranceAnimation();
        this.setupInputEvents();
        
        console.log('✅ ClashMenuScene initialisé');
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

    // === CRÉATION DES COMPOSANTS ===
    createHeader() {
        // TODO: Importer et utiliser ClashHeader
        // this.clashHeader = new ClashHeader(this, this.currentUser);
        
        // TEMPORAIRE - Version simplifiée
        this.createTempHeader();
    }

    createArenaSection() {
        // TODO: Importer et utiliser ArenaDisplay
        // this.arenaDisplay = new ArenaDisplay(this, this.currentUser);
        
        // TEMPORAIRE - Version simplifiée
        this.createTempArena();
    }

    createTabNavigation() {
        // TODO: Importer et utiliser TabNavigation
        // this.tabNavigation = new TabNavigation(this, this.tabs, (index) => this.switchToTab(index));
        
        // TEMPORAIRE - Version simplifiée
        this.createTempTabs();
    }

    createTabContent() {
        // TODO: Importer et utiliser TabPanels
        // this.tabPanels = new TabPanels(this, this.currentUser);
        
        // TEMPORAIRE - Version simplifiée
        this.createTempPanels();
    }

    // === VERSIONS TEMPORAIRES (en attendant les composants) ===
    createTempHeader() {
        const { width } = this.scale;
        
        // Panel header
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x2F4F4F, 0.9);
        headerBg.fillRoundedRect(10, 10, width - 20, 80, 10);
        headerBg.lineStyle(2, 0xFFD700);
        headerBg.strokeRoundedRect(10, 10, width - 20, 80, 10);
        
        // Info joueur
        const playerName = this.currentUser?.username || 'Joueur';
        const playerLevel = this.currentUser?.playerStats?.level || 1;
        
        this.add.text(30, 30, `👑 ${playerName}`, {
            fontSize: this.isMobile ? '16px' : '18px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF'
        });
        
        this.add.text(30, 55, `Niveau ${playerLevel}`, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        });
        
        // Ressources
        const trophies = this.currentUser?.playerStats?.trophies || 0;
        const gold = this.currentUser?.resources?.gold || 0;
        
        this.add.text(width - 150, 35, `🏆 ${window.GameUtils.formatNumber(trophies)}`, {
            fontSize: this.isMobile ? '14px' : '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        });
        
        this.add.text(width - 150, 60, `💰 ${window.GameUtils.formatNumber(gold)}`, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        });
    }

    createTempArena() {
        const { width } = this.scale;
        const arenaY = 110;
        
        // Panel arène
        const arenaBg = this.add.graphics();
        arenaBg.fillStyle(0x2F4F4F, 0.9);
        arenaBg.fillRoundedRect(20, arenaY, width - 40, 120, 15);
        arenaBg.lineStyle(3, 0xFFD700);
        arenaBg.strokeRoundedRect(20, arenaY, width - 40, 120, 15);
        
        // Image de l'arène (temporaire)
        const arenaImage = this.add.graphics();
        arenaImage.fillStyle(0x8B4513, 1);
        arenaImage.fillRoundedRect(30, arenaY + 10, 80, 60, 8);
        arenaImage.lineStyle(2, 0xDAA520);
        arenaImage.strokeRoundedRect(30, arenaY + 10, 80, 60, 8);
        
        // Détails
        arenaImage.fillStyle(0x90EE90, 1);
        arenaImage.fillRect(35, arenaY + 55, 70, 10);
        
        // Info arène
        this.add.text(130, arenaY + 25, 'Arène des Gobelins', {
            fontSize: this.isMobile ? '18px' : '20px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        });
        
        this.add.text(130, arenaY + 50, 'Arène 1', {
            fontSize: this.isMobile ? '14px' : '16px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        });
        
        // Progression
        const currentTrophies = this.currentUser?.playerStats?.trophies || 0;
        this.add.text(130, arenaY + 75, `${currentTrophies}/400 🏆`, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fill: '#FFD700'
        });
    }

    createTempTabs() {
        const { width, height } = this.scale;
        const tabsY = height - 70;
        
        // Background barre onglets
        const tabsBg = this.add.graphics();
        tabsBg.fillStyle(0x2F4F4F, 0.95);
        tabsBg.fillRect(0, tabsY, width, 70);
        tabsBg.lineStyle(2, 0x4682B4);
        tabsBg.strokeRect(0, tabsY, width, 70);
        
        // Onglets
        const tabWidth = width / this.tabs.length;
        const tabIcons = ['⚔️', '🃏', '🛡️', '🏰', '👤'];
        
        this.tabButtons = [];
        
        this.tabs.forEach((tabName, index) => {
            const tabX = tabWidth * index + tabWidth / 2;
            const tabY = tabsY + 35;
            
            // Background onglet
            const tabBg = this.add.graphics();
            tabBg.fillStyle(index === 0 ? 0xFFD700 : 0x4682B4, 0.8);
            tabBg.fillRoundedRect(tabX - tabWidth/2 + 5, tabY - 30, tabWidth - 10, 60, 8);
            
            // Icône et texte
            const icon = this.add.text(tabX, tabY - 8, tabIcons[index], {
                fontSize: this.isMobile ? '20px' : '24px'
            }).setOrigin(0.5);
            
            const text = this.add.text(tabX, tabY + 15, tabName, {
                fontSize: this.isMobile ? '10px' : '12px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            }).setOrigin(0.5);
            
            // Interactivité
            tabBg.setInteractive(new Phaser.Geom.Rectangle(tabX - tabWidth/2 + 5, tabY - 30, tabWidth - 10, 60), 
                Phaser.Geom.Rectangle.Contains);
            
            tabBg.on('pointerdown', () => this.switchToTab(index));
            
            this.tabButtons.push({ bg: tabBg, icon, text, index });
        });
    }

    createTempPanels() {
        const { width, height } = this.scale;
        const contentY = 250;
        const contentHeight = height - contentY - 80;
        
        this.contentPanels = [];
        
        this.tabs.forEach((tabName, index) => {
            const panel = this.add.container(0, contentY);
            
            // Background
            const panelBg = this.add.graphics();
            panelBg.fillStyle(0x2F4F4F, 0.8);
            panelBg.fillRoundedRect(15, 0, width - 30, contentHeight, 12);
            panelBg.lineStyle(2, 0x4682B4);
            panelBg.strokeRoundedRect(15, 0, width - 30, contentHeight, 12);
            panel.add(panelBg);
            
            // Contenu
            const title = this.add.text(width/2, 30, `${['⚔️', '🃏', '🛡️', '🏰', '👤'][index]} ${tabName.toUpperCase()}`, {
                fontSize: this.isMobile ? '18px' : '20px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                fill: '#FFD700'
            }).setOrigin(0.5);
            
            const content = this.add.text(width/2, contentHeight/2, `Contenu ${tabName}\n\nEn développement...`, {
                fontSize: this.isMobile ? '14px' : '16px',
                fontFamily: 'Arial, sans-serif',
                fill: '#B0C4DE',
                align: 'center'
            }).setOrigin(0.5);
            
            panel.add([title, content]);
            panel.setVisible(index === 0);
            
            this.contentPanels.push(panel);
        });
    }

    // === NAVIGATION ===
    switchToTab(index) {
        if (index === this.currentTab) return;
        
        // Masquer panel actuel
        if (this.contentPanels[this.currentTab]) {
            this.contentPanels[this.currentTab].setVisible(false);
        }
        
        // Réinitialiser style onglet précédent
        if (this.tabButtons[this.currentTab]) {
            const prevTab = this.tabButtons[this.currentTab];
            prevTab.bg.clear();
            prevTab.bg.fillStyle(0x4682B4, 0.8);
            const tabWidth = this.scale.width / this.tabs.length;
            const tabX = tabWidth * this.currentTab + tabWidth / 2;
            prevTab.bg.fillRoundedRect(tabX - tabWidth/2 + 5, this.scale.height - 70 + 5, tabWidth - 10, 60, 8);
        }
        
        // Activer nouvel onglet
        this.currentTab = index;
        
        // Style onglet actif
        const activeTab = this.tabButtons[this.currentTab];
        activeTab.bg.clear();
        activeTab.bg.fillStyle(0xFFD700, 0.8);
        const tabWidth = this.scale.width / this.tabs.length;
        const tabX = tabWidth * index + tabWidth / 2;
        activeTab.bg.fillRoundedRect(tabX - tabWidth/2 + 5, this.scale.height - 70 + 5, tabWidth - 10, 60, 8);
        
        // Afficher nouveau panel
        if (this.contentPanels[this.currentTab]) {
            this.contentPanels[this.currentTab].setVisible(true);
        }
        
        console.log(`📱 Onglet changé: ${this.tabs[index]}`);
    }

    // === ÉVÉNEMENTS ===
    setupInputEvents() {
        // Navigation clavier (PC)
        if (!this.isMobile) {
            this.input.keyboard.on('keydown-LEFT', () => {
                const newTab = Math.max(0, this.currentTab - 1);
                this.switchToTab(newTab);
            });
            
            this.input.keyboard.on('keydown-RIGHT', () => {
                const newTab = Math.min(this.tabs.length - 1, this.currentTab + 1);
                this.switchToTab(newTab);
            });
        }
        
        // Swipe mobile
        if (this.isMobile) {
            let startX = 0;
            
            this.input.on('pointerdown', (pointer) => {
                startX = pointer.x;
            });
            
            this.input.on('pointerup', (pointer) => {
                const diffX = pointer.x - startX;
                if (Math.abs(diffX) > 50) {
                    if (diffX > 0 && this.currentTab > 0) {
                        this.switchToTab(this.currentTab - 1);
                    } else if (diffX < 0 && this.currentTab < this.tabs.length - 1) {
                        this.switchToTab(this.currentTab + 1);
                    }
                }
            });
        }
    }

    // === ANIMATIONS ===
    playEntranceAnimation() {
        // Animation simple pour l'instant
        this.cameras.main.setAlpha(0);
        this.tweens.add({
            targets: this.cameras.main,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
    }

    // === MÉTHODES UTILITAIRES ===
    showMessage(message, type = 'info') {
        window.NotificationManager?.show(message, type);
    }

    update() {
        // Vérifications périodiques
        if (!auth.isAuthenticated()) {
            this.scene.start('AuthScene');
        }
    }

    destroy() {
        // Nettoyage
        console.log('🧹 ClashMenuScene détruite');
        super.destroy();
    }
}
