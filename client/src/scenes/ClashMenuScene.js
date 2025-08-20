// client/src/scenes/ClashMenuScene.js - ARCHITECTURE AVEC COLYSEUS INTÉGRÉ
import Phaser from 'phaser';
import { auth } from '../api';
import { ClashHeader } from '../clashmenu';
import colyseusManager from '../managers/ColyseusManager';

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
        
        // 🆕 NOUVEAUX PANELS COMPLETS
        this.fullPanels = [];
        this.currentPanelContainer = null;
        
        // 🌐 COLYSEUS - Données temps réel
        this.colyseusConnected = false;
        this.realtimeProfile = null;
        this.worldPlayers = [];
        this.globalStats = { totalPlayers: 0, playersOnline: 0, playersSearching: 0 };
        this.isSearchingBattle = false;
        
        // UI Elements qui peuvent être mis à jour en temps réel
        this.trophyText = null;
        this.arenaName = null;
        this.progressFill = null;
        this.onlinePlayersText = null;
        
        // Dimensions
        this.isMobile = window.GameConfig?.MOBILE_OPTIMIZED || false;
        this.contentStartY = 100; // Après le header
    }

    create() {
        console.log('🏆 ClashMenuScene - Architecture Header + Panels + Colyseus');
        
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
        this.createFixedHeader();
        this.createAllPanels();
        
        // Afficher le premier panel
        this.showPanel(0);
        
        // 🌐 CONNECTER À COLYSEUS
        this.setupColyseus();
        
        // Animations et événements
        this.playEntranceAnimation();
        this.setupInputEvents();
        
        console.log('✅ ClashMenuScene avec Colyseus initialisé');
    }

    // === 🌐 CONFIGURATION COLYSEUS ===
    setupColyseus() {
        console.log('🌐 Configuration des handlers Colyseus...');
        
        // Configurer les callbacks
        colyseusManager.on('connected', () => {
            console.log('✅ Colyseus connecté !');
            this.colyseusConnected = true;
            this.showMessage('Connecté au serveur temps réel', 'success');
            
            // Demander les infos d'arène
            colyseusManager.requestArenaInfo();
        });
        
        colyseusManager.on('disconnected', (code) => {
            console.log('🔌 Colyseus déconnecté, code:', code);
            this.colyseusConnected = false;
            
            if (code !== 1000) { // Pas une déconnexion volontaire
                this.showMessage('Connexion temps réel perdue', 'warning');
            }
        });
        
        colyseusManager.on('profileUpdated', (profile) => {
            console.log('📊 Profil mis à jour via Colyseus:', profile.username);
            this.realtimeProfile = profile;
            this.updateUIFromRealtimeData();
        });
        
        colyseusManager.on('globalStatsUpdated', (stats) => {
            console.log('📊 Stats globales mises à jour:', stats);
            this.globalStats = stats;
            this.updateGlobalStatsUI();
        });
        
        colyseusManager.on('playersUpdated', (players) => {
            console.log('👥 Joueurs mis à jour:', players.size, 'connectés');
            this.worldPlayers = Array.from(players.values());
        });
        
        colyseusManager.on('searchStarted', (data) => {
            console.log('⚔️ Recherche bataille commencée:', data.message);
            this.isSearchingBattle = true;
            this.updateBattleButtonState();
            this.showMessage(data.message, 'info');
        });
        
        colyseusManager.on('searchCancelled', (data) => {
            console.log('❌ Recherche bataille annulée:', data.message);
            this.isSearchingBattle = false;
            this.updateBattleButtonState();
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
            }
        });
    }

    // === 📊 MISE À JOUR UI TEMPS RÉEL ===
    updateUIFromRealtimeData() {
        if (!this.realtimeProfile) return;
        
        console.log('🔄 Mise à jour UI depuis données temps réel');
        
        // Mettre à jour les trophées
        if (this.trophyText) {
            const trophies = this.realtimeProfile.trophies || 0;
            this.trophyText.setText(`🏆 ${trophies}/400`);
        }
        
        // Mettre à jour l'arène
        if (this.arenaName && this.realtimeProfile.currentArena) {
            this.arenaName.setText(this.getArenaDisplayName(this.realtimeProfile.currentArena));
        }
        
        // Mettre à jour la barre de progression
        if (this.progressFill && this.realtimeProfile.arenaInfo) {
            const progress = this.realtimeProfile.arenaInfo.progress || 0;
            const maxWidth = 196;
            this.progressFill.clear();
            this.progressFill.fillStyle(0xFFD700, 1);
            this.progressFill.fillRoundedRect(
                this.scale.width/2 - 98, 
                this.contentStartY + 82, 
                (maxWidth * progress / 100), 
                8, 
                4
            );
        }
        
        // Mettre à jour le header si nécessaire
        if (this.clashHeader && this.clashHeader.updateFromProfile) {
            this.clashHeader.updateFromProfile(this.realtimeProfile);
        }
    }
    
    updateGlobalStatsUI() {
        if (this.onlinePlayersText) {
            this.onlinePlayersText.setText(`👥 ${this.globalStats.playersOnline} en ligne`);
        }
    }
    
    updateBattleButtonState() {
        // Trouver le bouton bataille dans le panel bataille
        if (this.fullPanels[0] && this.isSearchingBattle !== undefined) {
            // Cette logique sera implémentée quand on crée les boutons
            // Pour l'instant on log juste
            console.log(`🔄 État bouton bataille: ${this.isSearchingBattle ? 'Recherche...' : 'BATAILLE'}`);
        }
    }

    // === CRÉATION DU FOND (inchangé) ===
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

    // === PANEL BATAILLE COMPLET (avec Colyseus intégré) ===
    createBattlePanel() {
        const { width, height } = this.scale;
        const panel = this.add.container(0, 0);
        
        // 1. ArenaDisplay (avec références pour mise à jour temps réel)
        const arenaContainer = this.add.container(0, this.contentStartY);
        
        // Fond arène
        const arenaBg = this.add.graphics();
        arenaBg.fillStyle(0x2F4F4F, 0.9);
        arenaBg.fillRoundedRect(20, 0, width - 40, 140, 15);
        arenaBg.lineStyle(4, 0xFFD700, 1);
        arenaBg.strokeRoundedRect(20, 0, width - 40, 140, 15);
        
        // Info arène (référence gardée pour mise à jour)
        this.arenaName = this.add.text(width/2, 30, 'Arène des Gobelins', {
            fontSize: this.isMobile ? '18px' : '22px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        const trophies = this.currentUser?.playerStats?.trophies || 0;
        this.trophyText = this.add.text(width/2, 60, `🏆 ${trophies}/400`, {
            fontSize: this.isMobile ? '14px' : '16px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        }).setOrigin(0.5);
        
        // Barre progression (référence gardée)
        const progressBg = this.add.graphics();
        progressBg.fillStyle(0x2F2F2F, 0.8);
        progressBg.fillRoundedRect(width/2 - 100, 80, 200, 12, 6);
        
        this.progressFill = this.add.graphics();
        this.progressFill.fillStyle(0xFFD700, 1);
        const progressPercent = Math.min((trophies / 400) * 100, 100);
        this.progressFill.fillRoundedRect(width/2 - 98, 82, (196 * progressPercent / 100), 8, 4);
        
        // Statut connexion Colyseus
        const connectionStatus = this.add.text(width - 30, 20, '🔴', {
            fontSize: '16px'
        }).setOrigin(1, 0);
        
        // Stats en ligne
        this.onlinePlayersText = this.add.text(width - 30, 45, '👥 ? en ligne', {
            fontSize: this.isMobile ? '10px' : '12px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        }).setOrigin(1, 0);
        
        arenaContainer.add([arenaBg, this.arenaName, this.trophyText, progressBg, this.progressFill, connectionStatus, this.onlinePlayersText]);
        
        // 2. Contenu bataille avec gestion Colyseus
        const battleContent = this.add.container(0, this.contentStartY + 160);
        
        // Bouton principal BATAILLE (référence gardée pour mise à jour)
        this.battleButton = this.createPanelButton(width/2, 40, 220, 70, '⚔️ BATAILLE', '#FFD700', () => {
            this.handleBattleClick();
        });
        
        // Boutons secondaires
        const trainingBtn = this.createPanelButton(width/2 - 80, 130, 140, 50, '🎯 Entraînement', '#32CD32', () => {
            this.handlePanelAction('training');
        });
        
        const tournamentBtn = this.createPanelButton(width/2 + 80, 130, 140, 50, '🏆 Tournoi', '#9370DB', () => {
            this.handlePanelAction('tournament');
        });
        
        // Bouton Leaderboard
        const leaderboardBtn = this.createPanelButton(width/2, 220, 160, 40, '🏆 Classement', '#4682B4', () => {
            this.handleLeaderboardClick();
        });
        
        battleContent.add([this.battleButton, trainingBtn, tournamentBtn, leaderboardBtn]);
        
        // 3. Navigation en bas
        const navigation = this.createPanelNavigation(0);
        
        panel.add([arenaContainer, battleContent, navigation]);
        panel.name = 'BattlePanel';
        
        return panel;
    }

    // === 🎮 HANDLERS COLYSEUS SPÉCIFIQUES ===
    
    /**
     * ⚔️ Gestion du clic bataille
     */
    handleBattleClick() {
        if (!this.colyseusConnected) {
            this.showMessage('Connexion au serveur requise pour jouer', 'warning');
            return;
        }
        
        if (this.isSearchingBattle) {
            // Annuler la recherche
            console.log('❌ Annulation recherche bataille');
            colyseusManager.cancelSearch();
        } else {
            // Lancer la recherche
            console.log('⚔️ Lancement recherche bataille');
            colyseusManager.searchBattle();
        }
    }
    
    /**
     * 🏆 Gestion du leaderboard
     */
    handleLeaderboardClick() {
        if (!this.colyseusConnected) {
            this.showMessage('Connexion au serveur requise', 'warning');
            return;
        }
        
        console.log('🏆 Demande du leaderboard');
        colyseusManager.requestLeaderboard(20);
        
        // Handler pour la réponse
        colyseusManager.on('leaderboard', (data) => {
            this.showLeaderboard(data);
        });
    }
    
    /**
     * 🎯 Match trouvé
     */
    handleMatchFound(data) {
        this.isSearchingBattle = false;
        this.updateBattleButtonState();
        
        console.log('🎯 Match trouvé, transition vers BattleRoom');
        this.showMessage(`Adversaire trouvé: ${data.opponent.username}`, 'success');
        
        // TODO: Transition vers la BattleRoom
        // this.scene.start('BattleScene', { matchData: data });
        
        // Pour l'instant, on simule juste
        this.showMessage('Bataille en cours...', 'info');
    }
    
    /**
     * 🏆 Résultat de bataille
     */
    handleBattleResult(data) {
        this.isSearchingBattle = false;
        this.updateBattleButtonState();
        
        const message = data.victory ? 
            `🎉 Victoire ! +${data.trophyChange} trophées` : 
            `😞 Défaite ! ${data.trophyChange} trophées`;
            
        this.showMessage(message, data.victory ? 'success' : 'error');
        
        // L'UI sera automatiquement mise à jour via profileUpdated
        
        if (data.arenaChanged) {
            this.showMessage(`🏟️ Nouvelle arène débloquée !`, 'success');
        }
    }
    
    /**
     * 🏆 Afficher le leaderboard
     */
    showLeaderboard(data) {
        // Créer une popup simple pour le leaderboard
        const { width, height } = this.scale;
        
        // Fond semi-transparent
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(1000);
        
        // Panneau leaderboard
        const panelWidth = Math.min(width - 40, 400);
        const panelHeight = Math.min(height - 100, 500);
        const panelX = width / 2;
        const panelY = height / 2;
        
        const leaderboardPanel = this.add.graphics();
        leaderboardPanel.fillStyle(0x2F4F4F, 1);
        leaderboardPanel.fillRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 15);
        leaderboardPanel.lineStyle(3, 0xFFD700, 1);
        leaderboardPanel.strokeRoundedRect(panelX - panelWidth/2, panelY - panelHeight/2, panelWidth, panelHeight, 15);
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
        
        data.players.slice(0, 15).forEach((player, index) => {
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
        });
        
        // Bouton fermer
        const closeBtn = this.add.text(panelX, panelY + panelHeight/2 - 30, '❌ Fermer', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5).setDepth(1002).setInteractive();
        
        closeBtn.on('pointerdown', () => {
            overlay.destroy();
            leaderboardPanel.destroy();
            title.destroy();
            closeBtn.destroy();
            // Détruire tous les textes de joueurs...
        });
    }

    // === UTILITAIRES ===
    getArenaDisplayName(arena) {
        // Conversion simple des nameId en noms affichables
        const arenaNames = {
            'arena.training_center.name': 'Centre d\'entraînement',
            'arena.goblin_stadium.name': 'Stade des Gobelins',
            'arena.bone_pit.name': 'Fosse aux Os',
            'arena.royal_arena.name': 'Arène Royale',
            'arena.spell_valley.name': 'Vallée des Sorts',
            'arena.builders_workshop.name': 'Atelier des Bâtisseurs',
            'arena.royal_arena_high.name': 'Arène Royale Suprême',
            'arena.legendary_arena.name': 'Arène Légendaire',
            'arena.champions_arena.name': 'Arène des Champions',
            'arena.ultimate_arena.name': 'Arène Ultime'
        };
        
        return arenaNames[arena.nameId] || arena.nameId || 'Arène Inconnue';
    }

    // === RESTE DES MÉTHODES (création panels, navigation, etc.) ===
    // [Le reste du code reste identique aux panels Collection, Deck, Clan, Profile]
    
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
        
        // Fond navigation
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
            
            // Icône
            const icon = this.add.text(x, y - 5, tabIcons[index], {
                fontSize: isActive ? '24px' : '20px',
                fill: isActive ? '#2F4F4F' : '#FFFFFF'
            }).setOrigin(0.5);
            
            // Texte
            const text = this.add.text(x, y + 15, tabName, {
                fontSize: isActive ? '10px' : '8px',
                fontFamily: 'Arial, sans-serif',
                fontWeight: 'bold',
                fill: isActive ? '#2F4F4F' : '#FFFFFF'
            }).setOrigin(0.5);
            
            navContainer.add([tabBg, icon, text]);
            
            // Interactivité
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

    // === HANDLERS D'ACTIONS ===
    handlePanelAction(action, data) {
        console.log(`🎮 Action panel: ${action}`, data);
        
        switch (action) {
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

    async handleLogout() {
        const confirm = window.confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
        if (!confirm) return;

        try {
            console.log('🚪 Déconnexion...');
            
            // Déconnecter Colyseus d'abord
            if (this.colyseusConnected) {
                await colyseusManager.disconnect();
            }
            
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
        console.log('🧹 Nettoyage ClashMenuScene...');
        
        // Nettoyer Colyseus
        if (this.colyseusConnected) {
            colyseusManager.disconnect();
        }
        
        // Nettoyer les callbacks Colyseus
        Object.keys(colyseusManager.callbacks).forEach(key => {
            colyseusManager.off(key.replace('on', '').toLowerCase());
        });
        
        if (this.clashHeader) {
            this.clashHeader.destroy();
            this.clashHeader = null;
        }
        
        // Nettoyer les références UI temps réel
        this.trophyText = null;
        this.arenaName = null;
        this.progressFill = null;
        this.onlinePlayersText = null;
        this.battleButton = null;
    }

    update() {
        if (!auth.isAuthenticated()) {
            console.warn('⚠️ Perte d\'authentification détectée');
            this.cleanup();
            this.scene.start('AuthScene');
        }
        
        // Mettre à jour l'indicateur de connexion Colyseus
        if (this.connectionStatus) {
            this.connectionStatus.setText(this.colyseusConnected ? '🟢' : '🔴');
        }
    }

    destroy() {
        console.log('🧹 ClashMenuScene détruite');
        this.cleanup();
        super.destroy();
    }
    // === TEST DIRECT VIA LA SCÈNE ===

// Fonction pour tester directement depuis ClashMenuScene
window.testDirectColyseus = () => {
  console.group('🎯 TEST DIRECT COLYSEUS VIA SCÈNE');
  
  // Récupérer la scène active
  const gameInstance = window.ChimArenaInstance;
  const scenes = gameInstance.game.scene.getScenes();
  const clashScene = scenes.find(s => s.scene.key === 'ClashMenuScene');
  
  if (!clashScene) {
    console.error('❌ ClashMenuScene non trouvée');
    return;
  }
  
  console.log('🏆 ClashMenuScene trouvée');
  
  // 1. Essayer d'accéder au colyseusManager via l'import dans la scène
  console.log('🔍 Recherche colyseusManager...');
  
  // Le colyseusManager est importé dans ClashMenuScene.js comme :
  // import colyseusManager from '../managers/ColyseusManager';
  
  // On va essayer de déclencher la méthode setupColyseus() directement
  if (typeof clashScene.setupColyseus === 'function') {
    console.log('🎯 setupColyseus trouvée, tentative d\'exécution...');
    try {
      clashScene.setupColyseus();
      console.log('✅ setupColyseus exécutée');
    } catch (error) {
      console.error('❌ Erreur setupColyseus:', error);
    }
  } else {
    console.log('⚠️ setupColyseus non trouvée');
  }
  
  // 2. Vérifier l'état de connexion
  console.log('📊 État actuel scène:', {
    colyseusConnected: clashScene.colyseusConnected,
    realtimeProfile: clashScene.realtimeProfile,
    globalStats: clashScene.globalStats
  });
  
  // 3. Essayer de simuler la connexion manuellement
  console.log('🔧 Tentative de connexion manuelle...');
  
  // Si on peut accéder à colyseusManager via une propriété de la scène
  const possibleManagers = [
    'colyseusManager',
    'manager', 
    'wsManager',
    'connectionManager'
  ];
  
  let foundManager = null;
  for (const prop of possibleManagers) {
    if (clashScene[prop]) {
      console.log(`✅ Manager trouvé: ${prop}`);
      foundManager = clashScene[prop];
      break;
    }
  }
  
  if (!foundManager) {
    console.log('⚠️ Aucun manager trouvé dans la scène');
    console.log('🔍 Propriétés de la scène contenant "manager":', 
      Object.keys(clashScene).filter(k => k.toLowerCase().includes('manager'))
    );
  } else {
    console.log('🎯 Test connexion via manager trouvé...');
    if (typeof foundManager.connect === 'function') {
      foundManager.connect().then(result => {
        console.log('📡 Résultat connexion:', result);
      }).catch(error => {
        console.error('❌ Erreur connexion:', error);
      });
    }
  }
  
  console.groupEnd();
};

// Test du bouton bataille
window.testBattleButton = () => {
  console.group('⚔️ TEST BOUTON BATAILLE');
  
  const gameInstance = window.ChimArenaInstance;
  const scenes = gameInstance.game.scene.getScenes();
  const clashScene = scenes.find(s => s.scene.key === 'ClashMenuScene');
  
  if (!clashScene) {
    console.error('❌ ClashMenuScene non trouvée');
    return;
  }
  
  // Simuler le clic sur le bouton bataille
  if (typeof clashScene.handleBattleClick === 'function') {
    console.log('🎯 Simulation clic bouton bataille...');
    try {
      clashScene.handleBattleClick();
      console.log('✅ Clic simulé');
    } catch (error) {
      console.error('❌ Erreur simulation:', error);
    }
  } else {
    console.log('❌ handleBattleClick non trouvée');
  }
  
  console.groupEnd();
};

// Forcer la connexion Colyseus avec URL directe
window.forceColyseusConnection = () => {
  console.group('🚀 FORCE CONNEXION COLYSEUS');
  
  // Test avec l'URL correcte
  const url = 'wss://chimarena.cloud:2567';
  console.log(`🔗 Test connexion directe: ${url}`);
  
  try {
    const ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('✅ WebSocket connecté !');
      
      // Envoyer un message de test (format Colyseus)
      const joinMessage = {
        method: 'joinOrCreate',
        roomName: 'world',
        options: {
          token: 'test' // Tu devras mettre le vrai token ici
        }
      };
      
      ws.send(JSON.stringify(joinMessage));
      console.log('📤 Message envoyé:', joinMessage);
    };
    
    ws.onmessage = (event) => {
      console.log('📨 Message reçu:', event.data);
    };
    
    ws.onerror = (error) => {
      console.error('❌ Erreur WebSocket:', error);
    };
    
    ws.onclose = (event) => {
      console.log(`🔌 WebSocket fermé: ${event.code} - ${event.reason}`);
    };
    
  } catch (error) {
    console.error('❌ Erreur création WebSocket:', error);
  }
  
  console.groupEnd();
};

console.log(`
🎯 === TESTS DIRECTS DISPONIBLES ===

▶️ testDirectColyseus() - Test via scène ClashMenu
▶️ testBattleButton() - Simuler clic bataille  
▶️ forceColyseusConnection() - Force connexion directe

COMMENCE PAR: testDirectColyseus()
`);
}
