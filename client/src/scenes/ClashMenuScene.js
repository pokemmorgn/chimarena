// client/src/scenes/ClashMenuScene.js - SCÈNE AVEC COMPOSANTS INTÉGRÉS
import Phaser from 'phaser';
import { auth } from '../api';
import { 
    ClashHeader, 
    ArenaDisplay, 
    TabNavigation, 
    TabPanels 
} from '../clashmenu';

export default class ClashMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ClashMenuScene' });
        
        this.currentUser = null;
        this.gameInstance = null;
        
        // Navigation
        this.currentTab = 0;
        this.tabs = ['Bataille', 'Collection', 'Deck', 'Clan', 'Profil'];
        
        // Composants Clash Royale
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
        this.createClashComponents();
        
        // Afficher l'onglet par défaut
        this.switchToTab(0);
        
        // Animations et événements
        this.playEntranceAnimation();
        this.setupInputEvents();
        
        console.log('✅ ClashMenuScene initialisé avec composants');
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

    // === CRÉATION DES COMPOSANTS CLASH ROYALE ===
    createClashComponents() {
        console.log('🏗️ Création des composants Clash Royale...');
        
        try {
            // 1. Header avec infos joueur
            this.clashHeader = new ClashHeader(this, this.currentUser);
            console.log('✅ ClashHeader créé');
            
            // 2. Section arène centrale
            this.arenaDisplay = new ArenaDisplay(this, this.currentUser);
            console.log('✅ ArenaDisplay créé');
            
            // 3. Panels de contenu
            this.tabPanels = new TabPanels(this, this.currentUser, (action, data) => {
                this.handlePanelAction(action, data);
            });
            console.log('✅ TabPanels créé');
            
            // 4. Navigation en bas
            this.tabNavigation = new TabNavigation(this, this.tabs, (tabIndex) => {
                this.switchToTab(tabIndex);
            });
            console.log('✅ TabNavigation créé');
            
        } catch (error) {
            console.error('❌ Erreur création composants:', error);
            this.showMessage('Erreur de chargement des composants', 'error');
        }
    }

    // === GESTION DES ONGLETS ===
    switchToTab(index) {
        if (index === this.currentTab) return;
        
        console.log(`📱 Changement onglet: ${this.tabs[this.currentTab]} -> ${this.tabs[index]}`);
        
        const oldTab = this.currentTab;
        this.currentTab = index;
        
        // Changer le panel
        if (this.tabPanels) {
            this.tabPanels.switchToPanel(index);
        }
        
        // Mettre à jour la navigation
        if (this.tabNavigation) {
            // La navigation se met à jour automatiquement via son callback
        }
        
        console.log(`✅ Onglet actif: ${this.tabs[index]} (${index})`);
    }

    // === GESTION DES ACTIONS DES PANELS ===
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
                
            case 'view_card':
                this.showCardDetails(data);
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
                
            case 'clan_chat':
                this.showMessage('Chat de clan - En développement', 'info');
                break;
                
            case 'clan_war':
                this.showMessage('Guerre de clan - En développement', 'info');
                break;
                
            case 'clan_donate':
                this.showMessage('Donations - En développement', 'info');
                break;
                
            case 'settings':
                this.openSettings();
                break;
                
            case 'logout':
                this.handleLogout();
                break;
                
            default:
                console.warn('Action non gérée:', action);
                this.showMessage(`Action "${action}" non implémentée`, 'info');
        }
    }

    // === ACTIONS SPÉCIFIQUES ===
    startBattle() {
        console.log('⚔️ Démarrage bataille...');
        this.showMessage('Recherche d\'adversaire...', 'info');
        // TODO: Implémenter le matchmaking
    }

    showCardDetails(cardData) {
        console.log('🃏 Détails carte:', cardData);
        this.showMessage(`Carte: ${cardData.name}`, 'info');
        // TODO: Ouvrir popup de détails
    }

    openSettings() {
        console.log('⚙️ Ouverture paramètres...');
        this.showMessage('Paramètres - En développement', 'info');
        // TODO: Créer scene de paramètres
    }

    async handleLogout() {
        const confirm = window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
        if (!confirm) return;

        try {
            console.log('🚪 Déconnexion...');
            
            // Nettoyer les composants
            this.cleanupComponents();
            
            // Déconnexion API
            await auth.logout();
            this.gameInstance?.clearAuthData();
            
            this.showMessage('Déconnexion réussie', 'success');
            this.scene.start('AuthScene');
            
        } catch (error) {
            console.error('❌ Erreur déconnexion:', error);
            
            // Forcer la déconnexion locale
            this.cleanupComponents();
            this.gameInstance?.clearAuthData();
            
            this.showMessage('Déconnexion locale effectuée', 'info');
            this.scene.start('AuthScene');
        }
    }

    // === ÉVÉNEMENTS ===
    setupInputEvents() {
        // Navigation clavier (PC)
        if (!this.isMobile) {
            this.input.keyboard.on('keydown-LEFT', () => {
                if (this.tabNavigation) {
                    this.tabNavigation.handleKeyboard('left');
                }
            });
            
            this.input.keyboard.on('keydown-RIGHT', () => {
                if (this.tabNavigation) {
                    this.tabNavigation.handleKeyboard('right');
                }
            });
            
            this.input.keyboard.on('keydown-ESC', () => {
                this.handleLogout();
            });
        }
        
        // Swipe mobile (géré par TabNavigation)
        // Pas besoin de redéfinir ici
    }

    // === ANIMATIONS ===
    playEntranceAnimation() {
        // Animation globale simple
        this.cameras.main.setAlpha(0);
        this.tweens.add({
            targets: this.cameras.main,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
        
        // Les composants ont leurs propres animations d'entrée
        if (this.clashHeader) {
            this.clashHeader.show();
        }
        
        if (this.arenaDisplay) {
            this.arenaDisplay.show();
        }
        
        if (this.tabNavigation) {
            this.tabNavigation.show();
        }
        
        if (this.tabPanels) {
            this.tabPanels.show();
        }
    }

    // === MÉTHODES UTILITAIRES ===
    showMessage(message, type = 'info') {
        if (window.NotificationManager) {
            window.NotificationManager.show(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    updateUserData(newUserData) {
        this.currentUser = newUserData;
        this.registry.set('currentUser', newUserData);
        
        // Mettre à jour tous les composants
        if (this.clashHeader) {
            this.clashHeader.updateUserData(newUserData);
        }
        
        if (this.arenaDisplay) {
            this.arenaDisplay.updateUserData(newUserData);
        }
        
        if (this.tabPanels) {
            this.tabPanels.updateUserData(newUserData);
        }
        
        console.log('🔄 Données utilisateur mises à jour dans tous les composants');
    }

    cleanupComponents() {
        console.log('🧹 Nettoyage des composants...');
        
        if (this.clashHeader) {
            this.clashHeader.destroy();
            this.clashHeader = null;
        }
        
        if (this.arenaDisplay) {
            this.arenaDisplay.destroy();
            this.arenaDisplay = null;
        }
        
        if (this.tabNavigation) {
            this.tabNavigation.destroy();
            this.tabNavigation = null;
        }
        
        if (this.tabPanels) {
            this.tabPanels.destroy();
            this.tabPanels = null;
        }
    }

    update() {
        // Vérifications périodiques
        if (!auth.isAuthenticated()) {
            console.warn('⚠️ Perte d\'authentification détectée');
            this.cleanupComponents();
            this.scene.start('AuthScene');
        }
    }

    destroy() {
        console.log('🧹 ClashMenuScene détruite');
        this.cleanupComponents();
        super.destroy();
    }
}
