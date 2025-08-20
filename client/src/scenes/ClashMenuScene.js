// client/src/scenes/ClashMenuScene.js - REFACTORISÉ AVEC PANEL MANAGER
import Phaser from 'phaser';
import { auth } from '../api';
import { ClashHeader } from '../clashmenu';
import PanelManager from '../clashmenu/utils/PanelManager.js';
import colyseusManager from '../managers/ColyseusManager';

export default class ClashMenuScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ClashMenuScene' });
        
        // Données utilisateur
        this.currentUser = null;
        this.gameInstance = null;
        
        // Composants principaux
        this.clashHeader = null;
        this.panelManager = null;
        
        // 🌐 COLYSEUS - État temps réel
        this.colyseusState = {
            connected: false,
            realtimeProfile: null,
            globalStats: { totalPlayers: 0, playersOnline: 0, playersSearching: 0 },
            isSearchingBattle: false,
            currentMatch: null
        };
        
        // Configuration
        this.isMobile = window.GameConfig?.MOBILE_OPTIMIZED || false;
        
        console.log('🏆 ClashMenuScene initialisé (version modulaire)');
    }

    // === CYCLE DE VIE PHASER ===
    
    create() {
        console.log('🏗️ ClashMenuScene.create() - Architecture modulaire');
        
        // Récupérer les données
        this.gameInstance = this.registry.get('gameInstance');
        this.currentUser = this.registry.get('currentUser');
        
        // Vérifier authentification
        if (!this.validateAuthentication()) {
            return;
        }
        
        // Créer l'interface
        this.createBackground();
        this.createHeader();
        this.createPanelSystem();
        
        // Configurer Colyseus
        this.setupColyseus();
        
        // Finaliser
        this.setupInputHandlers();
        this.playEntranceAnimation();
        
        console.log('✅ ClashMenuScene créé avec succès');
    }
    
    update() {
        // Vérifier l'authentification en continu
        if (!auth.isAuthenticated()) {
            console.warn('⚠️ Perte d\'authentification détectée');
            this.cleanup();
            this.scene.start('AuthScene');
        }
    }
    
    destroy() {
        console.log('🧹 ClashMenuScene.destroy()');
        this.cleanup();
        super.destroy();
    }

    // === VALIDATION ===
    
    /**
     * Valider l'authentification et les données
     */
    validateAuthentication() {
        if (!auth.isAuthenticated()) {
            console.warn('❌ Non authentifié, retour AuthScene');
            this.scene.start('AuthScene');
            return false;
        }
        
        if (!this.currentUser) {
            console.error('❌ Données utilisateur manquantes');
            this.showMessage('Erreur de données utilisateur', 'error');
            this.scene.start('AuthScene');
            return false;
        }
        
        return true;
    }

    // === CRÉATION DE L'INTERFACE ===
    
    /**
     * Créer le fond d'écran
     */
    createBackground() {
        const { width, height } = this.scale;
        
        // Dégradé bleu Clash Royale
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x4682B4, 0x4682B4, 1);
        bg.fillRect(0, 0, width, height);
        
        // Nuages décoratifs
        this.createClouds();
        
        console.log('🎨 Fond d\'écran créé');
    }
    
    /**
     * Créer les nuages décoratifs
     */
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
    
    /**
     * Créer le header fixe
     */
    createHeader() {
        console.log('🏗️ Création Header...');
        
        try {
            this.clashHeader = new ClashHeader(this, this.currentUser);
            console.log('✅ ClashHeader créé');
        } catch (error) {
            console.error('❌ Erreur création ClashHeader:', error);
            this.showMessage('Erreur lors de la création du header', 'error');
        }
    }
    
    /**
     * Créer le système de panels
     */
    async createPanelSystem() {
        console.log('🏗️ Création système de panels...');
        
        try {
            // Créer le gestionnaire de panels
            this.panelManager = new PanelManager(this, {
                userData: this.currentUser,
                onAction: this.handlePanelAction.bind(this),
                onTabChange: this.handleTabChange.bind(this),
                enableTransitions: true,
                defaultPanel: 'battle'
            });
            
            // Initialiser le système
            await this.panelManager.init();
            
            console.log('✅ Système de panels créé');
        } catch (error) {
            console.error('❌ Erreur création système panels:', error);
            this.showMessage('Erreur lors de la création des panels', 'error');
        }
    }

    // === GESTION DES ACTIONS PANELS ===
    
    /**
     * Gérer les actions venant des panels
     */
    handlePanelAction(action, data = null) {
        console.log(`🎮 Action panel reçue: ${action}`, data);
        
        switch (action) {
            // === ACTIONS BATAILLE ===
            case 'battle':
                this.handleBattleRequest(data);
                break;
            case 'cancel_search':
                this.handleCancelSearch();
                break;
            case 'training':
                this.handleTraining(data);
                break;
            case 'tournament':
                this.handleTournament(data);
                break;
            case 'leaderboard':
                this.handleLeaderboard(data);
                break;
            case 'spectate':
                this.handleSpectate(data);
                break;
                
            // === ACTIONS COLLECTION ===
            case 'upgrade_cards':
                this.handleUpgradeCards(data);
                break;
            case 'filter_cards':
                this.handleFilterCards(data);
                break;
            case 'view_card':
                this.handleViewCard(data);
                break;
                
            // === ACTIONS DECK ===
            case 'edit_deck':
                this.handleEditDeck(data);
                break;
            case 'copy_deck':
                this.handleCopyDeck(data);
                break;
            case 'save_deck':
                this.handleSaveDeck(data);
                break;
                
            // === ACTIONS CLAN ===
            case 'join_clan':
                this.handleJoinClan(data);
                break;
            case 'create_clan':
                this.handleCreateClan(data);
                break;
            case 'clan_chat':
                this.handleClanChat(data);
                break;
            case 'clan_war':
                this.handleClanWar(data);
                break;
                
            // === ACTIONS PROFIL ===
            case 'settings':
                this.handleSettings(data);
                break;
            case 'logout':
                this.handleLogout();
                break;
                
            // === ACTIONS GÉNÉRIQUES ===
            default:
                console.warn(`⚠️ Action non gérée: ${action}`);
                this.showMessage(`Action "${action}" en développement`, 'info');
        }
    }
    
    /**
     * Gérer les changements d'onglets
     */
    handleTabChange(panelId, index) {
        console.log(`📱 Changement onglet: ${panelId} (${index})`);
        
        // Notifier le header si nécessaire
        if (this.clashHeader && this.clashHeader.onTabChanged) {
            this.clashHeader.onTabChanged(panelId);
        }
        
        // Actions spécifiques selon le panel
        switch (panelId) {
            case 'battle':
                // Rafraîchir les données de bataille
                this.refreshBattlePanelData();
                break;
            case 'collection':
                // Charger les cartes si nécessaire
                this.refreshCollectionData();
                break;
            // Autres panels...
        }
    }

    // === HANDLERS D'ACTIONS BATAILLE ===
    
    /**
     * Gérer une demande de bataille
     */
    handleBattleRequest(data) {
        console.log('⚔️ Demande de bataille', data);
        
        if (!this.colyseusState.connected) {
            this.showMessage('Connexion au serveur requise pour jouer', 'warning');
            return;
        }
        
        if (this.colyseusState.isSearchingBattle) {
            console.warn('⚠️ Recherche déjà en cours');
            return;
        }
        
        // Lancer la recherche via Colyseus
        colyseusManager.searchBattle()
            .then(() => {
                console.log('✅ Recherche de bataille lancée');
            })
            .catch(error => {
                console.error('❌ Erreur lancement bataille:', error);
                this.showMessage('Erreur lors du lancement de la bataille', 'error');
            });
    }
    
    /**
     * Gérer l'annulation de recherche
     */
    handleCancelSearch() {
        console.log('❌ Annulation recherche bataille');
        
        if (!this.colyseusState.isSearchingBattle) {
            console.warn('⚠️ Aucune recherche en cours');
            return;
        }
        
        // Annuler via Colyseus
        colyseusManager.cancelSearch()
            .then(() => {
                console.log('✅ Recherche annulée');
            })
            .catch(error => {
                console.error('❌ Erreur annulation:', error);
                this.showMessage('Erreur lors de l\'annulation', 'error');
            });
    }
    
    /**
     * Gérer l'entraînement
     */
    handleTraining(data) {
        console.log('🎯 Mode entraînement demandé');
        this.showMessage('Mode entraînement - Bientôt disponible !', 'info');
        // TODO: Implémenter mode entraînement
    }
    
    /**
     * Gérer les tournois
     */
    handleTournament(data) {
        console.log('🏆 Tournois demandés');
        this.showMessage('Tournois - Bientôt disponibles !', 'info');
        // TODO: Implémenter système de tournois
    }
    
    /**
     * Gérer le classement
     */
    handleLeaderboard(data) {
        console.log('📊 Classement demandé');
        
        if (!this.colyseusState.connected) {
            this.showMessage('Connexion au serveur requise', 'warning');
            return;
        }
        
        // Demander le leaderboard via Colyseus
        colyseusManager.requestLeaderboard(20)
            .then(leaderboardData => {
                this.showLeaderboardModal(leaderboardData);
            })
            .catch(error => {
                console.error('❌ Erreur leaderboard:', error);
                this.showMessage('Erreur lors du chargement du classement', 'error');
            });
    }
    
    /**
     * Gérer le mode spectateur
     */
    handleSpectate(data) {
        console.log('👁️ Mode spectateur demandé');
        this.showMessage('Mode spectateur - En développement', 'info');
        // TODO: Implémenter mode spectateur
    }

    // === HANDLERS D'ACTIONS AUTRES PANELS ===
    
    /**
     * Gérer l'amélioration de cartes
     */
    handleUpgradeCards(data) {
        console.log('⬆️ Amélioration cartes', data);
        this.showMessage('Amélioration de cartes - En développement', 'info');
    }
    
    /**
     * Gérer les filtres de cartes
     */
    handleFilterCards(data) {
        console.log('🔍 Filtres cartes', data);
        this.showMessage('Filtres de cartes - En développement', 'info');
    }
    
    /**
     * Gérer la visualisation d'une carte
     */
    handleViewCard(data) {
        console.log('👁️ Voir carte', data);
        this.showMessage('Visualisation carte - En développement', 'info');
    }
    
    /**
     * Gérer l'édition de deck
     */
    handleEditDeck(data) {
        console.log('✏️ Édition deck', data);
        this.showMessage('Éditeur de deck - En développement', 'info');
    }
    
    /**
     * Gérer la copie de deck
     */
    handleCopyDeck(data) {
        console.log('📋 Copie deck', data);
        this.showMessage('Copie de deck - En développement', 'info');
    }
    
    /**
     * Gérer la sauvegarde de deck
     */
    handleSaveDeck(data) {
        console.log('💾 Sauvegarde deck', data);
        this.showMessage('Sauvegarde deck - En développement', 'info');
    }
    
    /**
     * Gérer rejoindre un clan
     */
    handleJoinClan(data) {
        console.log('🔍 Rejoindre clan', data);
        this.showMessage('Rejoindre un clan - En développement', 'info');
    }
    
    /**
     * Gérer la création de clan
     */
    handleCreateClan(data) {
        console.log('🏗️ Créer clan', data);
        this.showMessage('Créer un clan - En développement', 'info');
    }
    
    /**
     * Gérer le chat clan
     */
    handleClanChat(data) {
        console.log('💬 Chat clan', data);
        this.showMessage('Chat clan - En développement', 'info');
    }
    
    /**
     * Gérer la guerre de clan
     */
    handleClanWar(data) {
        console.log('⚔️ Guerre clan', data);
        this.showMessage('Guerre de clan - En développement', 'info');
    }
    
    /**
     * Gérer les paramètres
     */
    handleSettings(data) {
        console.log('⚙️ Paramètres', data);
        this.showMessage('Paramètres - En développement', 'info');
    }
    
    /**
     * Gérer la déconnexion
     */
    async handleLogout() {
        const confirm = window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
        if (!confirm) return;

        try {
            console.log('🚪 Déconnexion...');
            
            // Déconnecter Colyseus d'abord
            if (this.colyseusState.connected) {
                await colyseusManager.disconnect();
            }
            
            // Nettoyer et déconnecter
            this.cleanup();
            await auth.logout();
            this.gameInstance?.clearAuthData();
            
            this.showMessage('Déconnexion réussie', 'success');
            this.scene.start('AuthScene');
        } catch (error) {
            console.error('❌ Erreur déconnexion:', error);
            
            // Déconnexion forcée en cas d'erreur
            this.cleanup();
            this.gameInstance?.clearAuthData();
            this.showMessage('Déconnexion locale effectuée', 'info');
            this.scene.start('AuthScene');
        }
    }

    // === CONFIGURATION COLYSEUS ===
    
    /**
     * Configurer les handlers Colyseus
     */
    setupColyseus() {
        console.log('🌐 Configuration Colyseus...');
        
        // === ÉVÉNEMENTS DE CONNEXION ===
        colyseusManager.on('connected', () => {
            console.log('✅ Colyseus connecté !');
            this.colyseusState.connected = true;
            this.showMessage('Connecté au serveur temps réel', 'success');
            
            // Notifier le panel bataille
            this.notifyBattlePanel('setColyseusConnected', true);
            
            // Demander les infos d'arène
            colyseusManager.requestArenaInfo();
        });
        
        colyseusManager.on('disconnected', (code) => {
            console.log('🔌 Colyseus déconnecté, code:', code);
            this.colyseusState.connected = false;
            
            // Notifier le panel bataille
            this.notifyBattlePanel('setColyseusConnected', false);
            
            if (code !== 1000) { // Pas une déconnexion volontaire
                this.showMessage('Connexion temps réel perdue', 'warning');
            }
        });
        
        // === ÉVÉNEMENTS PROFIL ===
        colyseusManager.on('profileUpdated', (profile) => {
            console.log('📊 Profil mis à jour via Colyseus:', profile.username);
            this.colyseusState.realtimeProfile = profile;
            this.updateUIFromRealtimeData();
        });
        
        colyseusManager.on('globalStatsUpdated', (stats) => {
            console.log('📊 Stats globales mises à jour:', stats);
            this.colyseusState.globalStats = stats;
            
            // Notifier le panel bataille
            this.notifyBattlePanel('updateGlobalStats', stats);
        });
        
        // === ÉVÉNEMENTS MATCHMAKING ===
        colyseusManager.on('searchStarted', (data) => {
            console.log('⚔️ Recherche bataille commencée:', data.message);
            this.colyseusState.isSearchingBattle = true;
            
            // Notifier le panel bataille
            this.notifyBattlePanel('setSearchState', true, data);
            
            this.showMessage(data.message, 'info');
        });
        
        colyseusManager.on('searchCancelled', (data) => {
            console.log('❌ Recherche bataille annulée:', data.message);
            this.colyseusState.isSearchingBattle = false;
            
            // Notifier le panel bataille
            this.notifyBattlePanel('setSearchState', false, data);
            
            this.showMessage(data.message, 'info');
        });
        
        colyseusManager.on('matchFound', (data) => {
            console.log('🎯 Match trouvé !', data);
            this.handleMatchFound(data);
        });
        
        colyseusManager.on('battleResult', (data) => {
            console.log('🏆 Résultat bataille:', data);
            this.handleBattleResult(data);
        });
        
        // === ÉVÉNEMENTS LEADERBOARD ===
        colyseusManager.on('leaderboard', (data) => {
            console.log('📊 Leaderboard reçu:', data);
            this.showLeaderboardModal(data);
        });
        
        // === GESTION D'ERREURS ===
        colyseusManager.on('error', (error) => {
            console.error('❌ Erreur Colyseus:', error);
            this.showMessage(`Erreur: ${error}`, 'error');
        });
        
        // Tenter la connexion
        colyseusManager.connect().then(success => {
            if (success) {
                console.log('✅ Connexion Colyseus réussie');
            } else {
                console.warn('⚠️ Connexion Colyseus échouée, mode hors ligne');
                this.showMessage('Mode hors ligne - Fonctionnalités limitées', 'warning');
            }
        });
    }

    // === HANDLERS ÉVÉNEMENTS COLYSEUS ===
    
    /**
     * Gérer un match trouvé
     */
    handleMatchFound(data) {
        this.colyseusState.isSearchingBattle = false;
        this.colyseusState.currentMatch = data;
        
        console.log('🎯 Match trouvé, préparation bataille...');
        
        // Notifier le panel bataille
        this.notifyBattlePanel('notifyMatchFound', data);
        
        this.showMessage(`Adversaire trouvé: ${data.opponent?.username}`, 'success');
        
        // TODO: Transition vers BattleScene
        // this.scene.start('BattleScene', { matchData: data });
        
        // Pour l'instant, simuler une bataille
        this.simulateBattle(data);
    }
    
    /**
     * Gérer le résultat d'une bataille
     */
    handleBattleResult(data) {
        this.colyseusState.isSearchingBattle = false;
        this.colyseusState.currentMatch = null;
        
        console.log('🏆 Résultat bataille reçu:', data);
        
        // Notifier le panel bataille
        this.notifyBattlePanel('notifyBattleResult', data);
        
        // Mettre à jour les données utilisateur si nécessaire
        if (data.updatedProfile) {
            this.updateUserData(data.updatedProfile);
        }
        
        const message = data.victory ? 
            `🎉 Victoire ! +${data.trophyChange} trophées` : 
            `😞 Défaite ! ${data.trophyChange} trophées`;
            
        this.showMessage(message, data.victory ? 'success' : 'error');
        
        if (data.arenaChanged) {
            setTimeout(() => {
                this.showMessage('🏟️ Nouvelle arène débloquée !', 'success');
            }, 2000);
        }
    }
    
    /**
     * Simuler une bataille (temporaire)
     */
    simulateBattle(matchData) {
        console.log('🎮 Simulation bataille...');
        
        this.showMessage('Bataille en cours...', 'info');
        
        // Simuler bataille après 3 secondes
        setTimeout(() => {
            const victory = Math.random() > 0.5;
            const trophyChange = victory ? 
                Math.floor(Math.random() * 30) + 20 : 
                -(Math.floor(Math.random() * 20) + 10);
            
            const result = {
                victory: victory,
                trophyChange: trophyChange,
                opponent: matchData.opponent,
                duration: 123, // secondes
                arenaChanged: false
            };
            
            this.handleBattleResult(result);
        }, 3000);
    }

    // === MISE À JOUR DONNÉES ===
    
    /**
     * Mettre à jour l'interface depuis les données temps réel
     */
    updateUIFromRealtimeData() {
        if (!this.colyseusState.realtimeProfile) return;
        
        console.log('🔄 Mise à jour UI depuis données temps réel');
        
        // Mettre à jour le header
        if (this.clashHeader && this.clashHeader.updateFromProfile) {
            this.clashHeader.updateFromProfile(this.colyseusState.realtimeProfile);
        }
        
        // Mettre à jour le panel bataille
        this.notifyBattlePanel('updateRealtimeProfile', this.colyseusState.realtimeProfile);
        
        // Mettre à jour les données utilisateur locales
        this.updateUserData({
            ...this.currentUser,
            playerStats: {
                ...this.currentUser.playerStats,
                ...this.colyseusState.realtimeProfile
            }
        });
    }
    
    /**
     * Mettre à jour les données utilisateur
     */
    updateUserData(newUserData) {
        this.currentUser = newUserData;
        this.registry.set('currentUser', newUserData);
        
        // Mettre à jour le header
        if (this.clashHeader) {
            this.clashHeader.updateUserData(newUserData);
        }
        
        // Mettre à jour le panel manager
        if (this.panelManager) {
            this.panelManager.updateUserData(newUserData);
        }
        
        console.log('📊 Données utilisateur mises à jour');
    }
    
    /**
     * Rafraîchir les données du panel bataille
     */
    refreshBattlePanelData() {
        if (this.colyseusState.connected) {
            // Demander les dernières stats
            colyseusManager.requestArenaInfo();
            colyseusManager.requestGlobalStats();
        }
    }
    
    /**
     * Rafraîchir les données de collection
     */
    refreshCollectionData() {
        // TODO: Charger les cartes depuis l'API
        console.log('🔄 Rafraîchissement données collection');
    }

    // === COMMUNICATION AVEC PANELS ===
    
    /**
     * Notifier le panel bataille
     */
    notifyBattlePanel(method, data = null) {
        if (!this.panelManager) return;
        
        const battlePanel = this.panelManager.panels.get('battle');
        if (battlePanel && typeof battlePanel[method] === 'function') {
            battlePanel[method](data);
        }
    }

    // === MODALES ET NOTIFICATIONS ===
    
    /**
     * Afficher le modal de classement
     */
    showLeaderboardModal(data) {
        console.log('📊 Affichage leaderboard modal', data);
        
        const { width, height } = this.scale;
        
        // Overlay semi-transparent
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(1000);
        overlay.setInteractive();
        
        // Panel leaderboard
        const panelWidth = Math.min(width - 40, 400);
        const panelHeight = Math.min(height - 100, 500);
        const panelX = width / 2;
        const panelY = height / 2;
        
        const leaderboardPanel = this.add.graphics();
        leaderboardPanel.fillStyle(0x2F4F4F, 1);
        leaderboardPanel.fillRoundedRect(
            panelX - panelWidth/2, panelY - panelHeight/2, 
            panelWidth, panelHeight, 15
        );
        leaderboardPanel.lineStyle(3, 0xFFD700, 1);
        leaderboardPanel.strokeRoundedRect(
            panelX - panelWidth/2, panelY - panelHeight/2, 
            panelWidth, panelHeight, 15
        );
        leaderboardPanel.setDepth(1001);
        
        // Titre
        const title = this.add.text(panelX, panelY - panelHeight/2 + 30, '🏆 CLASSEMENT', {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5).setDepth(1002);
        
        // Liste des joueurs
        const startY = panelY - panelHeight/2 + 70;
        const lineHeight = 25;
        const elementsToDestroy = [overlay, leaderboardPanel, title];
        
        data.players?.slice(0, 15).forEach((player, index) => {
            const y = startY + index * lineHeight;
            
            const rankText = this.add.text(panelX - panelWidth/2 + 20, y, `#${player.rank}`, {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                fill: index < 3 ? '#FFD700' : '#B0C4DE'
            }).setDepth(1002);
            
            const nameText = this.add.text(panelX - panelWidth/2 + 60, y, player.username, {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                fill: '#FFFFFF'
            }).setDepth(1002);
            
            const trophyText = this.add.text(panelX + panelWidth/2 - 20, y, `🏆 ${player.trophies}`, {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                fill: '#FFD700'
            }).setOrigin(1, 0).setDepth(1002);
            
            elementsToDestroy.push(rankText, nameText, trophyText);
        });
        
        // Bouton fermer
        const closeBtn = this.add.text(panelX, panelY + panelHeight/2 - 30, '❌ Fermer', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5).setDepth(1002).setInteractive();
        
        elementsToDestroy.push(closeBtn);
        
        // Fonction de fermeture
        const closeModal = () => {
            elementsToDestroy.forEach(element => {
                if (element && element.destroy) {
                    element.destroy();
                }
            });
        };
        
        // Events de fermeture
        closeBtn.on('pointerdown', closeModal);
        overlay.on('pointerdown', closeModal);
        
        // Animation d'entrée
        elementsToDestroy.forEach((element, index) => {
            if (element && element !== overlay) {
                element.setAlpha(0);
                element.setScale(0.9);
                
                this.tweens.add({
                    targets: element,
                    alpha: 1,
                    scaleX: 1,
                    scaleY: 1,
                    duration: 300,
                    delay: index * 20,
                    ease: 'Back.easeOut'
                });
            }
        });
    }
    
    /**
     * Afficher un message/notification
     */
    showMessage(message, type = 'info') {
        // Utiliser le système de notification global s'il existe
        if (window.NotificationManager) {
            window.NotificationManager.show(message, type);
        } else {
            // Fallback console
            const prefix = `[${type.toUpperCase()}]`;
            console.log(`${prefix} ${message}`);
            
            // Créer une notification simple
            this.createSimpleNotification(message, type);
        }
    }
    
    /**
     * Créer une notification simple
     */
    createSimpleNotification(message, type) {
        const { width } = this.scale;
        
        // Couleurs selon le type
        const colors = {
            info: 0x4682B4,
            success: 0x32CD32,
            warning: 0xFF8C00,
            error: 0xDC143C
        };
        
        const color = colors[type] || colors.info;
        
        // Créer la notification
        const notificationBg = this.add.graphics();
        notificationBg.fillStyle(color, 0.9);
        notificationBg.fillRoundedRect(20, 20, width - 40, 60, 8);
        notificationBg.setDepth(2000);
        
        const notificationText = this.add.text(width / 2, 50, message, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF',
            wordWrap: { width: width - 60 },
            align: 'center'
        }).setOrigin(0.5).setDepth(2001);
        
        // Animation d'entrée
        notificationBg.setAlpha(0);
        notificationText.setAlpha(0);
        
        this.tweens.add({
            targets: [notificationBg, notificationText],
            alpha: 1,
            duration: 200,
            ease: 'Power2'
        });
        
        // Auto-suppression après 3 secondes
        this.time.delayedCall(3000, () => {
            this.tweens.add({
                targets: [notificationBg, notificationText],
                alpha: 0,
                duration: 200,
                onComplete: () => {
                    notificationBg.destroy();
                    notificationText.destroy();
                }
            });
        });
    }

    // === GESTION DES ENTRÉES ===
    
    /**
     * Configurer les handlers d'entrée
     */
    setupInputHandlers() {
        // Navigation clavier si pas mobile
        if (!this.isMobile && this.input.keyboard) {
            this.input.keyboard.on('keydown-LEFT', () => {
                if (this.panelManager) {
                    this.panelManager.previousTab();
                }
            });
            
            this.input.keyboard.on('keydown-RIGHT', () => {
                if (this.panelManager) {
                    this.panelManager.nextTab();
                }
            });
            
            // Échap pour annuler recherche
            this.input.keyboard.on('keydown-ESC', () => {
                if (this.colyseusState.isSearchingBattle) {
                    this.handleCancelSearch();
                }
            });
        }
        
        console.log('⌨️ Handlers d\'entrée configurés');
    }

    // === ANIMATIONS ===
    
    /**
     * Animation d'entrée de la scène
     */
    playEntranceAnimation() {
        // Fade in de la caméra
        this.cameras.main.setAlpha(0);
        this.tweens.add({
            targets: this.cameras.main,
            alpha: 1,
            duration: 500,
            ease: 'Power2'
        });
        
        // Animation du header
        if (this.clashHeader && this.clashHeader.show) {
            this.clashHeader.show();
        }
        
        // Animation du panel manager
        if (this.panelManager && this.panelManager.playEntranceAnimation) {
            this.time.delayedCall(200, () => {
                this.panelManager.playEntranceAnimation();
            });
        }
        
        console.log('🎬 Animation d\'entrée jouée');
    }

    // === MÉTHODES PUBLIQUES POUR INTÉGRATION ===
    
    /**
     * API publique pour accès externe
     */
    
    // Obtenir l'état Colyseus
    getColyseusState() {
        return { ...this.colyseusState };
    }
    
    // Obtenir le panel manager
    getPanelManager() {
        return this.panelManager;
    }
    
    // Obtenir l'utilisateur actuel
    getCurrentUser() {
        return this.currentUser;
    }
    
    // Changer de panel programmatiquement
    switchToPanel(panelId) {
        if (this.panelManager) {
            return this.panelManager.showPanel(panelId);
        }
        return false;
    }
    
    // Recharger un panel
    reloadPanel(panelId) {
        if (this.panelManager) {
            return this.panelManager.reloadPanel(panelId);
        }
        return false;
    }

    // === NETTOYAGE ===
    
    /**
     * Nettoyer les ressources
     */
    cleanup() {
        console.log('🧹 Nettoyage ClashMenuScene...');
        
        // Déconnecter Colyseus
        if (this.colyseusState.connected) {
            colyseusManager.disconnect().catch(error => {
                console.warn('⚠️ Erreur déconnexion Colyseus:', error);
            });
        }
        
        // Nettoyer les callbacks Colyseus
        this.cleanupColyseusCallbacks();
        
        // Nettoyer les composants
        if (this.clashHeader) {
            this.clashHeader.destroy();
            this.clashHeader = null;
        }
        
        if (this.panelManager) {
            this.panelManager.destroy();
            this.panelManager = null;
        }
        
        // Reset état
        this.colyseusState = {
            connected: false,
            realtimeProfile: null,
            globalStats: { totalPlayers: 0, playersOnline: 0, playersSearching: 0 },
            isSearchingBattle: false,
            currentMatch: null
        };
        
        console.log('✅ Nettoyage terminé');
    }
    
    /**
     * Nettoyer les callbacks Colyseus
     */
    cleanupColyseusCallbacks() {
        const eventsToClean = [
            'connected', 'disconnected', 'profileUpdated', 'globalStatsUpdated',
            'searchStarted', 'searchCancelled', 'matchFound', 'battleResult',
            'leaderboard', 'error'
        ];
        
        eventsToClean.forEach(event => {
            colyseusManager.off(event);
        });
        
        console.log('🧹 Callbacks Colyseus nettoyés');
    }

    // === DEBUG ET DÉVELOPPEMENT ===
    
    /**
     * Méthodes de debug pour développement
     */
    
    // Simuler connexion Colyseus
    debugSimulateColyseusConnection() {
        if (this.colyseusState.connected) {
            console.log('🔌 Simulation déconnexion Colyseus');
            this.colyseusState.connected = false;
            this.notifyBattlePanel('setColyseusConnected', false);
        } else {
            console.log('🔌 Simulation connexion Colyseus');
            this.colyseusState.connected = true;
            this.notifyBattlePanel('setColyseusConnected', true);
        }
    }
    
    // Simuler recherche de bataille
    debugSimulateBattleSearch() {
        if (this.colyseusState.isSearchingBattle) {
            console.log('❌ Simulation annulation recherche');
            this.colyseusState.isSearchingBattle = false;
            this.notifyBattlePanel('setSearchState', false);
        } else {
            console.log('⚔️ Simulation début recherche');
            this.colyseusState.isSearchingBattle = true;
            this.notifyBattlePanel('setSearchState', true, { message: 'Recherche d\'adversaire...' });
        }
    }
    
    // Simuler match trouvé
    debugSimulateMatchFound() {
        const mockMatchData = {
            opponent: {
                username: 'TestOpponent',
                trophies: 1200,
                level: 8
            },
            battleType: 'ranked',
            arena: 'arena_2'
        };
        
        console.log('🎯 Simulation match trouvé');
        this.handleMatchFound(mockMatchData);
    }
    
    // Forcer mise à jour données
    debugForceDataUpdate() {
        const mockProfile = {
            trophies: this.currentUser?.playerStats?.trophies + 25,
            level: this.currentUser?.playerStats?.level,
            experience: (this.currentUser?.playerStats?.experience || 0) + 100
        };
        
        console.log('📊 Simulation mise à jour profil');
        this.colyseusState.realtimeProfile = mockProfile;
        this.updateUIFromRealtimeData();
    }
}

// === EXPORTS ET FONCTIONS GLOBALES DE DEBUG ===

// Fonctions de test globales pour développement
if (typeof window !== 'undefined') {
    // Test des panels
    window.testSwitchPanel = (panelId) => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene) {
            clashScene.switchToPanel(panelId);
            console.log(`📱 Test: Basculement vers panel ${panelId}`);
        } else {
            console.error('❌ ClashMenuScene non trouvée');
        }
    };
    
    // Test Colyseus
    window.testColyseus = () => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene) {
            clashScene.debugSimulateColyseusConnection();
            console.log('🔌 Test: Simulation connexion Colyseus');
        } else {
            console.error('❌ ClashMenuScene non trouvée');
        }
    };
    
    // Test recherche bataille
    window.testBattleSearch = () => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene) {
            clashScene.debugSimulateBattleSearch();
            console.log('⚔️ Test: Simulation recherche bataille');
        } else {
            console.error('❌ ClashMenuScene non trouvée');
        }
    };
    
    // Test match trouvé
    window.testMatchFound = () => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene) {
            clashScene.debugSimulateMatchFound();
            console.log('🎯 Test: Simulation match trouvé');
        } else {
            console.error('❌ ClashMenuScene non trouvée');
        }
    };
    
    // Afficher les commandes de test
    console.log(`
🎯 === COMMANDES DE TEST DISPONIBLES ===

▶️ testSwitchPanel('battle') - Basculer vers un panel
▶️ testColyseus() - Tester connexion Colyseus
▶️ testBattleSearch() - Tester recherche bataille
▶️ testMatchFound() - Tester match trouvé

PANELS DISPONIBLES: battle, collection, deck, clan, profile
    `);
}
