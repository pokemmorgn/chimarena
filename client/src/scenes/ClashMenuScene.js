// client/src/scenes/ClashMenuScene.js - NOUVELLE VERSION AVEC SYSTÈME MODULAIRE
import Phaser from 'phaser';
import { auth } from '../api';
import { ClashHeader } from '../clashmenu';
import PanelManager from '../clashmenu/utils/PanelManager.js';

export default class ClashMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ClashMenuScene' });
        
        // Données
        this.currentUser = null;
        this.gameInstance = null;
        
        // Composants du nouveau système
        this.clashHeader = null;
        this.panelManager = null;
        
        // Configuration
        this.isMobile = window.GameConfig?.MOBILE_OPTIMIZED || false;
        
        console.log('🏆 ClashMenuScene - Nouveau système modulaire');
    }

    // === CYCLE DE VIE PHASER ===
    
    create() {
        console.log('🏗️ ClashMenuScene.create() - Système modulaire');
        
        // Récupérer les données
        this.gameInstance = this.registry.get('gameInstance');
        this.currentUser = this.registry.get('currentUser');
        
        // Vérifier authentification
        if (!this.validateAuth()) {
            return;
        }
        
        // Créer l'interface
        this.createBackground();
        this.createHeader();
        this.createPanelSystem();
        
        // Finaliser
        this.setupInput();
        this.playEntranceAnimation();
        
        console.log('✅ ClashMenuScene créé avec succès');
    }
    
    update() {
        // Vérifier auth en continu
        if (!auth.isAuthenticated()) {
            console.warn('⚠️ Perte authentification');
            this.scene.start('AuthScene');
        }
    }

    // === VALIDATION ===
    
    validateAuth() {
        if (!auth.isAuthenticated() || !this.currentUser) {
            console.warn('❌ Problème authentification, retour AuthScene');
            this.scene.start('AuthScene');
            return false;
        }
        return true;
    }

    // === CRÉATION INTERFACE ===
    
    createBackground() {
        const { width, height } = this.scale;
        
        // Dégradé bleu Clash Royale
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x4682B4, 0x4682B4, 1);
        bg.fillRect(0, 0, width, height);
        
        // Nuages décoratifs
        this.createClouds();
        
        console.log('🎨 Fond créé');
    }
    
    createClouds() {
        const { width } = this.scale;
        const cloudCount = this.isMobile ? 3 : 5;
        
        for (let i = 0; i < cloudCount; i++) {
            const cloud = this.add.graphics();
            cloud.fillStyle(0xFFFFFF, 0.1);
            
            // Forme nuage
            cloud.fillCircle(0, 0, 30);
            cloud.fillCircle(25, 0, 25);
            cloud.fillCircle(-20, 0, 20);
            cloud.fillCircle(10, -15, 15);
            
            cloud.setPosition(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(50, 200)
            );
            
            // Animation
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
    
    createHeader() {
        console.log('🏗️ Création Header...');
        
        try {
            this.clashHeader = new ClashHeader(this, this.currentUser);
            console.log('✅ ClashHeader créé');
        } catch (error) {
            console.error('❌ Erreur ClashHeader:', error);
            this.showMessage('Erreur header', 'error');
        }
    }
    
    async createPanelSystem() {
        console.log('🏗️ Création PanelManager...');
        
        try {
            this.panelManager = new PanelManager(this, {
                userData: this.currentUser,
                onAction: this.handleAction.bind(this),
                onTabChange: this.handleTabChange.bind(this),
                enableTransitions: true,
                defaultPanel: 'battle'
            });
            
            await this.panelManager.init();
            
            console.log('✅ PanelManager créé et initialisé');
        } catch (error) {
            console.error('❌ Erreur PanelManager:', error);
            this.showMessage('Erreur panels', 'error');
        }
    }

    // === GESTION DES ACTIONS ===
    
    handleAction(action, data = null) {
        console.log(`🎮 Action reçue: ${action}`, data);
        
        switch (action) {
            // Actions bataille
            case 'battle':
                this.showMessage('Bataille lancée !', 'info');
                break;
            case 'training':
                this.showMessage('Entraînement - En développement', 'info');
                break;
            case 'tournament':
                this.showMessage('Tournois - En développement', 'info');
                break;
            case 'leaderboard':
                this.showMessage('Classement - En développement', 'info');
                break;
                
            // Actions cartes
            case 'save_deck':
                this.handleSaveDeck(data);
                break;
            case 'deck_updated':
                this.showMessage('Deck mis à jour', 'success');
                break;
                
            // Actions clan
            case 'join_clan':
                this.showMessage('Rejoindre clan - En développement', 'info');
                break;
            case 'create_clan':
                this.showMessage('Créer clan - En développement', 'info');
                break;
                
            // Actions profil
            case 'settings':
                this.showMessage('Paramètres - En développement', 'info');
                break;
            case 'logout':
                this.handleLogout();
                break;
                
            default:
                console.warn(`⚠️ Action non gérée: ${action}`);
                this.showMessage(`Action "${action}" en développement`, 'info');
        }
    }
    
    handleTabChange(panelId, index) {
        console.log(`📱 Changement onglet: ${panelId} (${index})`);
        
        // Actions spécifiques selon le panel
        switch (panelId) {
            case 'battle':
                // Rafraîchir données bataille
                break;
            case 'cards':
                // Rafraîchir données cartes
                break;
            case 'clan':
                // Rafraîchir données clan
                break;
            case 'profile':
                // Rafraîchir données profil
                break;
        }
    }

    // === ACTIONS SPÉCIFIQUES ===
    
    handleSaveDeck(data) {
        console.log('💾 Sauvegarde deck', data);
        
        if (data?.deck) {
            // Mettre à jour données utilisateur
            const updatedUserData = {
                ...this.currentUser,
                currentDeck: data.deck,
                lastDeckUpdate: Date.now()
            };
            
            this.updateUserData(updatedUserData);
            this.showMessage('Deck sauvegardé !', 'success');
        } else {
            this.showMessage('Erreur sauvegarde deck', 'error');
        }
    }
    
    async handleLogout() {
        const confirm = window.confirm('Déconnexion ?');
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
            this.showMessage('Déconnexion locale', 'info');
            this.scene.start('AuthScene');
        }
    }

    // === UTILITAIRES ===
    
    updateUserData(newUserData) {
        this.currentUser = newUserData;
        this.registry.set('currentUser', newUserData);
        
        // Mettre à jour header
        if (this.clashHeader) {
            this.clashHeader.updateUserData(newUserData);
        }
        
        // Mettre à jour panel manager
        if (this.panelManager) {
            this.panelManager.updateUserData(newUserData);
        }
        
        console.log('📊 Données utilisateur mises à jour');
    }
    
    showMessage(message, type = 'info') {
        // Système de notification simple
        if (window.NotificationManager) {
            window.NotificationManager.show(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            this.createSimpleNotification(message, type);
        }
    }
    
    createSimpleNotification(message, type) {
        const { width } = this.scale;
        
        const colors = {
            info: 0x4682B4,
            success: 0x32CD32,
            warning: 0xFF8C00,
            error: 0xDC143C
        };
        
        const color = colors[type] || colors.info;
        
        // Notification
        const notifBg = this.add.graphics();
        notifBg.fillStyle(color, 0.9);
        notifBg.fillRoundedRect(20, 20, width - 40, 60, 8);
        notifBg.setDepth(2000);
        
        const notifText = this.add.text(width / 2, 50, message, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF',
            wordWrap: { width: width - 60 },
            align: 'center'
        }).setOrigin(0.5).setDepth(2001);
        
        // Animation
        notifBg.setAlpha(0);
        notifText.setAlpha(0);
        
        this.tweens.add({
            targets: [notifBg, notifText],
            alpha: 1,
            duration: 200
        });
        
        // Auto-suppression
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: [notifBg, notifText],
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    notifBg.destroy();
                    notifText.destroy();
                }
            });
        });
    }

    // === INPUT ===
    
    setupInput() {
        if (!this.isMobile && this.input.keyboard) {
            this.input.keyboard.on('keydown-LEFT', () => {
                this.panelManager?.previousTab();
            });
            
            this.input.keyboard.on('keydown-RIGHT', () => {
                this.panelManager?.nextTab();
            });
        }
        
        console.log('⌨️ Input configuré');
    }

    // === ANIMATIONS ===
    
    playEntranceAnimation() {
        // Fade in
        this.cameras.main.setAlpha(0);
        this.tweens.add({
            targets: this.cameras.main,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
        
        // Header
        if (this.clashHeader?.show) {
            this.clashHeader.show();
        }
        
        console.log('🎬 Animation d\'entrée');
    }

    // === MÉTHODES PUBLIQUES ===
    
    // API pour tests
    switchToPanel(panelId) {
        return this.panelManager?.showPanel(panelId);
    }
    
    getCurrentUser() {
        return this.currentUser;
    }
    
    getPanelManager() {
        return this.panelManager;
    }

    // === NETTOYAGE ===
    
    cleanup() {
        console.log('🧹 Nettoyage ClashMenuScene...');
        
        if (this.clashHeader) {
            this.clashHeader.destroy();
            this.clashHeader = null;
        }
        
        if (this.panelManager) {
            this.panelManager.destroy();
            this.panelManager = null;
        }
        
        console.log('✅ Nettoyage terminé');
    }
    
    destroy() {
        console.log('🧹 ClashMenuScene.destroy()');
        this.cleanup();
        super.destroy();
    }
}

// === FONCTIONS DE TEST GLOBALES ===
if (typeof window !== 'undefined') {
    
    // Test basculement panel
    window.testSwitchPanel = (panelId) => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene?.panelManager) {
            clashScene.switchToPanel(panelId);
            console.log(`📱 Test: Basculement vers ${panelId}`);
        } else {
            console.error('❌ PanelManager non trouvé');
        }
    };
    
    // Test panel cartes complet
    window.testCardsPanel = () => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene?.panelManager) {
            clashScene.switchToPanel('cards');
            console.log('🃏 Test: Panel cartes');
            
            // Tester sous-onglets après délai
            setTimeout(() => {
                const cardsPanel = clashScene.panelManager.panels.get('cards');
                if (cardsPanel?.switchToSubTab) {
                    console.log('🛡️ Test: Sous-onglet deck');
                    cardsPanel.switchToSubTab('deck');
                    
                    setTimeout(() => {
                        console.log('⚡ Test: Sous-onglet défis');
                        cardsPanel.switchToSubTab('defis');
                        
                        setTimeout(() => {
                            console.log('🃏 Test: Retour collection');
                            cardsPanel.switchToSubTab('collection');
                        }, 2000);
                    }, 2000);
                }
            }, 1000);
        } else {
            console.error('❌ PanelManager non trouvé');
        }
    };
    
    // Debug état système
    window.debugClashMenu = () => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        console.group('🔍 DEBUG CLASH MENU');
        console.log('Game instance:', !!gameInstance);
        console.log('ClashMenuScene:', !!clashScene);
        console.log('PanelManager:', !!clashScene?.panelManager);
        console.log('ClashHeader:', !!clashScene?.clashHeader);
        
        if (clashScene?.panelManager) {
            console.log('Onglets:', clashScene.panelManager.getTabDefinitions());
            console.log('Panel actuel:', clashScene.panelManager.getCurrentPanelId());
            console.log('Panels chargés:', clashScene.panelManager.getLoadedPanels());
        }
        console.groupEnd();
    };
    
    // Afficher commandes
    console.log(`
🎯 === NOUVEAU SYSTÈME CLASH MENU ===

▶️ testSwitchPanel('cards') - Basculer panel
▶️ testCardsPanel() - Test complet cartes
▶️ debugClashMenu() - Debug état système

PANELS: battle, cards, clan, profile
SOUS-ONGLETS CARTES: collection, deck, defis
    `);
}
