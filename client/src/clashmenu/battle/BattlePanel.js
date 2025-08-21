// client/src/clashmenu/battle/BattlePanel.js - PANEL BATAILLE MODULAIRE
import BasePanel from '../core/BasePanel.js';

export default class BattlePanel extends BasePanel {
    constructor(scene, config = {}) {
        super(scene, {
            name: 'BattlePanel',
            title: 'BATAILLE !!!',
            icon: '⚔️',
            contentStartY: 120, // Plus haut pour inclure l'arène
            ...config
        });
        
        // État spécifique au panel bataille
        this.battleState = {
            isSearching: false,
            searchStartTime: null,
            matchData: null,
            arenaInfo: null,
            globalStats: { totalPlayers: 0, playersOnline: 0 }
        };
        
        // Éléments UI spécifiques
        this.battleElements = {
            arena: null,
            battleButton: null,
            searchTimer: null,
            onlineCounter: null,
            leaderboard: null
        };
        
        // Références pour mise à jour temps réel
        this.realtimeElements = {
            trophyText: null,
            arenaName: null,
            progressBar: null,
            connectionStatus: null
        };
        
        // Configuration arène
        this.arenaConfig = this.getArenaConfiguration();
        
        this.log('Panel Bataille initialisé');
    }

    // === IMPLÉMENTATION BASEPANEL ===
    
    /**
     * Créer le contenu spécifique du panel bataille
     */
    createContent() {
        this.log('Création contenu bataille...');
        
        // 1. Section Arène (en haut)
        this.createArenaSection();
        
        // 2. Boutons de bataille (centre)
        this.createBattleButtons();
        
        // 3. Statistiques et info (bas)
        this.createStatsSection();
        
        // 4. Intégration Colyseus
        this.setupColyseusIntegration();
        
        this.log('Contenu bataille créé', 'success');
    }
    
    /**
     * Rafraîchir les données du panel
     */
    refresh() {
        super.refresh();
        
        this.log('Rafraîchissement données bataille... hihihihi');
        
        // Mettre à jour les infos d'arène
        this.updateArenaInfo();
        
        // Mettre à jour les statistiques
        this.updateBattleStats();
        
        // Mettre à jour l'état des boutons
        this.updateButtonStates();
    }
    
    /**
     * Gérer les actions spécifiques au panel bataille
     */
    handleAction(action, data) {
        this.log(`Action bataille: ${action}`, 'info');
        
        switch (action) {
            case 'battle':
                this.handleBattleRequest();
                break;
            case 'cancel_search':
                this.handleCancelSearch();
                break;
            case 'training':
                this.handleTraining();
                break;
            case 'tournament':
                this.handleTournament();
                break;
            case 'leaderboard':
                this.handleLeaderboard();
                break;
            case 'spectate':
                this.handleSpectate();
                break;
            default:
                super.handleAction(action, data);
        }
    }

    // === SECTION ARÈNE ===
    
    /**
     * Créer la section d'affichage de l'arène
     */
    createArenaSection() {
        const arenaContainer = this.scene.add.container(0, 0);
        
        // Fond arène
        const arenaBg = this.createArenaBackground();
        
        // Infos arène
        const arenaInfo = this.createArenaInfo();
        
        // Barre de progression
        const progressSection = this.createProgressSection();
        
        // Statut connexion
        const connectionInfo = this.createConnectionInfo();
        
        arenaContainer.add([arenaBg, arenaInfo, progressSection, connectionInfo]);
        
        this.battleElements.arena = arenaContainer;
        this.elements.content.add(arenaContainer);
    }
    
    /**
     * Créer le fond stylisé de l'arène
     */
    createArenaBackground() {
        const bg = this.createGraphics();
        
        // Panel principal avec dégradé
        bg.fillGradientStyle(
            0x2F4F4F, 0x2F4F4F,
            0x1C3A3A, 0x1C3A3A,
            1
        );
        bg.fillRoundedRect(20, 0, this.width - 40, 140, 15);
        
        // Bordure dorée épaisse
        bg.lineStyle(4, 0xFFD700, 1);
        bg.strokeRoundedRect(20, 0, this.width - 40, 140, 15);
        
        // Effet de brillance
        const shine = this.createGraphics();
        shine.fillGradientStyle(
            0xFFFFFF, 0xFFFFFF,
            0xFFFFFF, 0xFFFFFF,
            0.4, 0.1
        );
        shine.fillRoundedRect(25, 5, this.width - 50, 25, 10);
        
        return [bg, shine];
    }
    
    /**
     * Créer les informations de l'arène
     */
    createArenaInfo() {
        const currentArena = this.getCurrentArena();
        
        // Nom de l'arène
        this.realtimeElements.arenaName = this.createText(
            this.width / 2, 30,
            currentArena.name,
            {
                fontSize: this.isMobile ? '18px' : '22px',
                fontWeight: 'bold',
                fill: '#FFD700',
                stroke: '#8B4513',
                strokeThickness: 2
            }
        );
        this.realtimeElements.arenaName.setOrigin(0.5);
        
        // Niveau d'arène
        const arenaLevel = this.createText(
            this.width / 2, 55,
            currentArena.displayName,
            {
                fontSize: this.isMobile ? '14px' : '16px',
                fontWeight: 'bold',
                fill: '#B0C4DE',
                stroke: '#2F4F4F',
                strokeThickness: 1
            }
        );
        arenaLevel.setOrigin(0.5);
        
        return [this.realtimeElements.arenaName, arenaLevel];
    }
    
    /**
     * Créer la section de progression
     */
    createProgressSection() {
        const currentTrophies = this.getUserData()?.playerStats?.trophies || 0;
        const currentArena = this.getCurrentArena();
        const nextArena = this.getNextArena();
        
        // Texte des trophées
        const progressText = nextArena ? 
            `🏆 ${currentTrophies}/${nextArena.minTrophies}` :
            `🏆 ${currentTrophies} MAX`;
            
        this.realtimeElements.trophyText = this.createText(
            this.width / 2, 85,
            progressText,
            {
                fontSize: this.isMobile ? '13px' : '15px',
                fontWeight: 'bold',
                fill: '#FFD700',
                stroke: '#8B4513',
                strokeThickness: 1
            }
        );
        this.realtimeElements.trophyText.setOrigin(0.5);
        
        // Barre de progression
        const progressBar = this.createProgressBar(currentTrophies, currentArena, nextArena);
        
        return [this.realtimeElements.trophyText, progressBar];
    }
    
    /**
     * Créer la barre de progression des trophées
     */
    createProgressBar(currentTrophies, currentArena, nextArena) {
        const barX = this.width / 2 - 100;
        const barY = 105;
        const barWidth = 200;
        const barHeight = 12;
        
        // Fond de la barre
        const progressBg = this.createGraphics();
        progressBg.fillStyle(0x2F2F2F, 0.8);
        progressBg.fillRoundedRect(barX, barY, barWidth, barHeight, 6);
        progressBg.lineStyle(2, 0x555555);
        progressBg.strokeRoundedRect(barX, barY, barWidth, barHeight, 6);
        
        // Barre de progression
        this.realtimeElements.progressBar = this.createGraphics();
        
        if (nextArena) {
            const progressInArena = currentTrophies - currentArena.minTrophies;
            const totalArenaRange = nextArena.minTrophies - currentArena.minTrophies;
            const progressPercent = Math.min((progressInArena / totalArenaRange) * 100, 100);
            
            this.realtimeElements.progressBar.fillStyle(0xFFD700, 1);
            this.realtimeElements.progressBar.fillRoundedRect(
                barX + 2, barY + 2,
                Math.max(0, (barWidth - 4) * progressPercent / 100),
                barHeight - 4,
                4
            );
            
            // Effet brillance
            const progressShine = this.createGraphics();
            progressShine.fillGradientStyle(
                0xFFFFFF, 0xFFFFFF,
                0xFFFFFF, 0xFFFFFF,
                0.6, 0.2
            );
            progressShine.fillRoundedRect(
                barX + 2, barY + 2,
                Math.max(0, (barWidth - 4) * progressPercent / 100),
                (barHeight - 4) / 2,
                2
            );
            
            return [progressBg, this.realtimeElements.progressBar, progressShine];
        } else {
            // Arène max
            this.realtimeElements.progressBar.fillStyle(0x9370DB, 1);
            this.realtimeElements.progressBar.fillRoundedRect(
                barX + 2, barY + 2,
                barWidth - 4,
                barHeight - 4,
                4
            );
            
            return [progressBg, this.realtimeElements.progressBar];
        }
    }
    
    /**
     * Créer les informations de connexion
     */
    createConnectionInfo() {
        // Indicateur de connexion
        this.realtimeElements.connectionStatus = this.createText(
            this.width - 30, 20,
            '🔴',
            { fontSize: '16px' }
        );
        this.realtimeElements.connectionStatus.setOrigin(1, 0);
        
        // Compteur joueurs en ligne
        this.battleElements.onlineCounter = this.createText(
            this.width - 30, 45,
            '👥 ? en ligne',
            {
                fontSize: this.isMobile ? '10px' : '12px',
                fill: '#B0C4DE'
            }
        );
        this.battleElements.onlineCounter.setOrigin(1, 0);
        
        return [this.realtimeElements.connectionStatus, this.battleElements.onlineCounter];
    }

    // === BOUTONS DE BATAILLE ===
    
    /**
     * Créer les boutons de bataille
     */
    createBattleButtons() {
        const buttonsContainer = this.scene.add.container(0, 160);
        
        // Bouton principal BATAILLE
        this.battleElements.battleButton = this.createBattleMainButton();
        
        // Boutons secondaires
        const trainingButton = this.createButton(
            this.width / 2 - 80, 90,
            140, 50,
            '🎯 Entraînement',
            '#32CD32',
            () => this.safeAction('training')
        );
        
        const tournamentButton = this.createButton(
            this.width / 2 + 80, 90,
            140, 50,
            '🏆 Tournoi',
            '#9370DB',
            () => this.safeAction('tournament')
        );
        
        // Boutons tertiaires
        const leaderboardButton = this.createButton(
            this.width / 2 - 80, 150,
            140, 40,
            '📊 Classement',
            '#4682B4',
            () => this.safeAction('leaderboard')
        );
        
        const spectateButton = this.createButton(
            this.width / 2 + 80, 150,
            140, 40,
            '👁️ Observer',
            '#708090',
            () => this.safeAction('spectate')
        );
        
        buttonsContainer.add([
            this.battleElements.battleButton,
            trainingButton,
            tournamentButton,
            leaderboardButton,
            spectateButton
        ]);
        
        this.elements.content.add(buttonsContainer);
    }
    
    /**
     * Créer le bouton principal de bataille
     */
    createBattleMainButton() {
        const buttonText = this.battleState.isSearching ? '❌ ANNULER' : '⚔️ BATAILLE';
        const buttonColor = this.battleState.isSearching ? '#DC143C' : '#FFD700';
        
        const button = this.createButton(
            this.width / 2, 30,
            220, 70,
            buttonText,
            buttonColor,
            () => {
                if (this.battleState.isSearching) {
                    this.safeAction('cancel_search');
                } else {
                    this.safeAction('battle');
                }
            }
        );
        
        // Animation pulsante si en recherche
        if (this.battleState.isSearching) {
            this.scene.tweens.add({
                targets: button,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 1000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
        
        return button;
    }

    // === SECTION STATISTIQUES ===
    
    /**
     * Créer la section des statistiques
     */
    createStatsSection() {
        if (this.isMobile) return; // Pas d'stats sur mobile pour économiser l'espace
        
        const statsContainer = this.scene.add.container(0, 320);
        
        // Fond des stats
        const statsBg = this.createGraphics();
        statsBg.fillStyle(0x1C3A3A, 0.8);
        statsBg.fillRoundedRect(30, 0, this.width - 60, 80, 8);
        statsBg.lineStyle(1, 0x4682B4);
        statsBg.strokeRoundedRect(30, 0, this.width - 60, 80, 8);
        statsContainer.add(statsBg);
        
        // Titre stats
        const statsTitle = this.createText(
            this.width / 2, 15,
            '📊 Vos statistiques de bataille',
            {
                fontSize: '14px',
                fontWeight: 'bold',
                fill: '#FFD700'
            },
            statsContainer
        );
        statsTitle.setOrigin(0.5);
        
        // Stats en ligne
        this.createBattleStatsDisplay(statsContainer);
        
        this.elements.content.add(statsContainer);
    }
    
    /**
     * Afficher les statistiques de bataille
     */
    createBattleStatsDisplay(container) {
        const userData = this.getUserData();
        const wins = userData?.gameStats?.wins || 0;
        const losses = userData?.gameStats?.losses || 0;
        const winRate = userData?.winRate || 0;
        const winStreak = userData?.gameStats?.winStreak || 0;
        
        const statsText = this.createText(
            this.width / 2, 45,
            `✅ ${wins} victoires  •  ❌ ${losses} défaites  •  📈 ${winRate}% réussite  •  🔥 ${winStreak} série`,
            {
                fontSize: '12px',
                fill: '#B0C4DE'
            },
            container
        );
        statsText.setOrigin(0.5);
        
        // Timer de recherche si en cours
        if (this.battleState.isSearching) {
            this.createSearchTimer(container);
        }
    }
    
    /**
     * Créer le timer de recherche
     */
    createSearchTimer(container) {
        this.battleElements.searchTimer = this.createText(
            this.width / 2, 65,
            '⏱️ Recherche: 0:00',
            {
                fontSize: '12px',
                fontWeight: 'bold',
                fill: '#FF6347'
            },
            container
        );
        this.battleElements.searchTimer.setOrigin(0.5);
        
        // Mettre à jour le timer chaque seconde
        this.searchTimerInterval = setInterval(() => {
            this.updateSearchTimer();
        }, 1000);
    }

    // === INTÉGRATION COLYSEUS ===
    
    /**
     * Configurer l'intégration Colyseus
     */
    setupColyseusIntegration() {
        this.log('Configuration intégration Colyseus...');
        
        // Ces callbacks seront connectés par la scène parent
        // Via this.config.onAction qui remontera à ClashMenuScene
        
        // Pour l'instant, on simule juste les callbacks
        this.simulateColyseusCallbacks();
    }
    
    /**
     * Simuler les callbacks Colyseus (en attendant la vraie intégration)
     */
    simulateColyseusCallbacks() {
        // Simuler connexion après 2 secondes
        setTimeout(() => {
            this.onColyseusConnected();
        }, 2000);
        
        // Simuler mise à jour stats globales
        setTimeout(() => {
            this.onGlobalStatsUpdated({
                totalPlayers: 1247,
                playersOnline: 89,
                playersSearching: 12
            });
        }, 3000);
    }

    // === CALLBACKS COLYSEUS ===
    
    /**
     * Callback connexion Colyseus établie
     */
    onColyseusConnected() {
        this.log('Colyseus connecté', 'success');
        
        if (this.realtimeElements.connectionStatus) {
            this.realtimeElements.connectionStatus.setText('🟢');
        }
    }
    
    /**
     * Callback déconnexion Colyseus
     */
    onColyseusDisconnected() {
        this.log('Colyseus déconnecté', 'warn');
        
        if (this.realtimeElements.connectionStatus) {
            this.realtimeElements.connectionStatus.setText('🔴');
        }
        
        if (this.battleElements.onlineCounter) {
            this.battleElements.onlineCounter.setText('👥 Hors ligne');
        }
    }
    
    /**
     * Callback mise à jour statistiques globales
     */
    onGlobalStatsUpdated(stats) {
        this.battleState.globalStats = stats;
        
        if (this.battleElements.onlineCounter) {
            this.battleElements.onlineCounter.setText(`👥 ${stats.playersOnline} en ligne`);
        }
        
        this.log(`Stats globales: ${stats.playersOnline} joueurs en ligne`);
    }
    
    /**
     * Callback recherche de bataille commencée
     */
    onSearchStarted(data) {
        this.battleState.isSearching = true;
        this.battleState.searchStartTime = Date.now();
        
        this.updateBattleButton();
        this.createSearchTimer(this.elements.content);
        
        this.log('Recherche de bataille commencée', 'info');
    }
    
    /**
     * Callback recherche annulée
     */
    onSearchCancelled(data) {
        this.battleState.isSearching = false;
        this.battleState.searchStartTime = null;
        
        this.updateBattleButton();
        this.clearSearchTimer();
        
        this.log('Recherche de bataille annulée', 'info');
    }
    
    /**
     * Callback match trouvé
     */
    onMatchFound(data) {
        this.battleState.isSearching = false;
        this.battleState.matchData = data;
        
        this.updateBattleButton();
        this.clearSearchTimer();
        
        this.showMatchFoundNotification(data);
        
        this.log(`Match trouvé contre ${data.opponent?.username}`, 'success');
    }

    // === HANDLERS D'ACTIONS ===
    
    /**
     * Gérer la demande de bataille
     */
    handleBattleRequest() {
        this.log('Demande de bataille...');
        
        // Vérifier les prérequis
        if (this.battleState.isSearching) {
            this.log('Recherche déjà en cours', 'warn');
            return;
        }
        
        // Vérifier la connexion
        if (!this.isColyseusConnected()) {
            this.showError('Connexion au serveur requise pour jouer AHAHAHAHAHHA');
            return;
        }
        
        // Lancer la recherche (via callback parent)
        super.handleAction('battle', {
            trophies: this.getUserData()?.playerStats?.trophies || 0,
            level: this.getUserData()?.playerStats?.level || 1
        });
    }
    
    /**
     * Gérer l'annulation de recherche
     */
    handleCancelSearch() {
        this.log('Annulation recherche...');
        
        if (!this.battleState.isSearching) {
            this.log('Aucune recherche en cours', 'warn');
            return;
        }
        
        // Annuler la recherche (via callback parent)
        super.handleAction('cancel_search');
    }
    
    /**
     * Gérer l'entraînement
     */
    handleTraining() {
        this.log('Mode entraînement demandé');
        super.handleAction('training');
    }
    
    /**
     * Gérer les tournois
     */
    handleTournament() {
        this.log('Tournois demandés');
        super.handleAction('tournament');
    }
    
    /**
     * Gérer le classement
     */
    handleLeaderboard() {
        this.log('Classement demandé');
        super.handleAction('leaderboard');
    }
    
    /**
     * Gérer l'observation
     */
    handleSpectate() {
        this.log('Mode spectateur demandé');
        super.handleAction('spectate');
    }

    // === UTILITAIRES SPÉCIFIQUES ===
    
    /**
     * Mettre à jour le bouton de bataille
     */
    updateBattleButton() {
        if (!this.battleElements.battleButton) return;
        
        // Détruire l'ancien bouton
        this.battleElements.battleButton.destroy();
        
        // Recréer avec le bon état
        this.battleElements.battleButton = this.createBattleMainButton();
        
        // Retrouver le container des boutons et l'ajouter
        const buttonsContainer = this.elements.content.list.find(child => 
            child.list && child.list.some(item => item === this.battleElements.battleButton)
        );
        
        if (buttonsContainer) {
            buttonsContainer.add(this.battleElements.battleButton);
        }
    }
    
    /**
     * Mettre à jour l'état des boutons
     */
    updateButtonStates() {
        // Activer/désactiver les boutons selon l'état
        const isDisabled = this.battleState.isSearching;
        
        // TODO: Implémenter disable/enable sur les boutons
        // Pour l'instant on log juste
        this.log(`Boutons ${isDisabled ? 'désactivés' : 'activés'}`);
    }
    
    /**
     * Mettre à jour les informations d'arène
     */
    updateArenaInfo() {
        const currentArena = this.getCurrentArena();
        
        if (this.realtimeElements.arenaName) {
            this.realtimeElements.arenaName.setText(currentArena.name);
        }
        
        this.updateProgressBar();
    }
    
    /**
     * Mettre à jour la barre de progression
     */
    updateProgressBar() {
        if (!this.realtimeElements.progressBar) return;
        
        const currentTrophies = this.getUserData()?.playerStats?.trophies || 0;
        const currentArena = this.getCurrentArena();
        const nextArena = this.getNextArena();
        
        // Mettre à jour le texte
        if (this.realtimeElements.trophyText) {
            const progressText = nextArena ? 
                `🏆 ${currentTrophies}/${nextArena.minTrophies}` :
                `🏆 ${currentTrophies} MAX`;
            this.realtimeElements.trophyText.setText(progressText);
        }
        
        // Redessiner la barre
        this.realtimeElements.progressBar.clear();
        
        if (nextArena) {
            const progressInArena = currentTrophies - currentArena.minTrophies;
            const totalArenaRange = nextArena.minTrophies - currentArena.minTrophies;
            const progressPercent = Math.min((progressInArena / totalArenaRange) * 100, 100);
            
            this.realtimeElements.progressBar.fillStyle(0xFFD700, 1);
            this.realtimeElements.progressBar.fillRoundedRect(
                this.width / 2 - 98, 107,
                (196 * progressPercent / 100),
                8,
                4
            );
        }
    }
    
    /**
     * Mettre à jour le timer de recherche
     */
    updateSearchTimer() {
        if (!this.battleState.isSearching || !this.battleElements.searchTimer) {
            return;
        }
        
        const elapsed = Math.floor((Date.now() - this.battleState.searchStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        this.battleElements.searchTimer.setText(
            `⏱️ Recherche: ${minutes}:${seconds.toString().padStart(2, '0')}`
        );
    }
    
    /**
     * Nettoyer le timer de recherche
     */
    clearSearchTimer() {
        if (this.searchTimerInterval) {
            clearInterval(this.searchTimerInterval);
            this.searchTimerInterval = null;
        }
        
        if (this.battleElements.searchTimer) {
            this.battleElements.searchTimer.destroy();
            this.battleElements.searchTimer = null;
        }
    }
    
    /**
     * Afficher notification match trouvé
     */
    showMatchFoundNotification(data) {
        const message = `🎯 Adversaire trouvé !\n${data.opponent?.username || 'Joueur'}`;
        
        // Créer notification temporaire
        const notification = this.createText(
            this.width / 2,
            this.height / 2,
            message,
            {
                fontSize: '18px',
                fontWeight: 'bold',
                fill: '#32CD32',
                align: 'center',
                backgroundColor: '#000000',
                padding: { x: 20, y: 10 }
            }
        );
        notification.setOrigin(0.5);
        
        // Animation d'apparition
        notification.setAlpha(0);
        notification.setScale(0.8);
        
        this.scene.tweens.add({
            targets: notification,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
        
        // Auto-suppression après 3 secondes
        this.scene.time.delayedCall(3000, () => {
            this.scene.tweens.add({
                targets: notification,
                alpha: 0,
                duration: 200,
                onComplete: () => notification.destroy()
            });
        });
    }

    // === CONFIGURATION ARÈNE ===
    
    /**
     * Obtenir la configuration des arènes
     */
    getArenaConfiguration() {
        return [
            {
                id: 0,
                name: 'Arène des Gobelins',
                displayName: 'Arène 1',
                minTrophies: 0,
                maxTrophies: 399,
                color: 0x8B4513,
                accentColor: 0xDAA520
            },
            {
                id: 1,
                name: 'Arène d\'Os',
                displayName: 'Arène 2',
                minTrophies: 400,
                maxTrophies: 799,
                color: 0x2F4F4F,
                accentColor: 0x708090
            },
            {
                id: 2,
                name: 'Arène PEKKA',
                displayName: 'Arène 3',
                minTrophies: 800,
                maxTrophies: 1199,
                color: 0x4B0082,
                accentColor: 0x8A2BE2
            },
            {
                id: 3,
                name: 'Arène Royale',
                displayName: 'Arène 4',
                minTrophies: 1200,
                maxTrophies: 1599,
                color: 0x9370DB,
                accentColor: 0xDDA0DD
            }
        ];
    }
    
    /**
     * Obtenir l'arène actuelle
     */
    getCurrentArena() {
        const currentTrophies = this.getUserData()?.playerStats?.trophies || 0;
        
        return this.arenaConfig.find(arena => 
            currentTrophies >= arena.minTrophies && currentTrophies <= arena.maxTrophies
        ) || this.arenaConfig[0];
    }
    
    /**
     * Obtenir l'arène suivante
     */
    getNextArena() {
        const currentTrophies = this.getUserData()?.playerStats?.trophies || 0;
        
        return this.arenaConfig.find(arena => 
            arena.minTrophies > currentTrophies
        ) || null;
    }
    
    /**
     * Mettre à jour les statistiques de bataille
     */
    updateBattleStats() {
        // Recalculer et afficher les nouvelles stats
        if (!this.isMobile) {
            // TODO: Mettre à jour l'affichage des stats
            this.log('Mise à jour stats bataille');
        }
    }
    
    /**
     * Vérifier si Colyseus est connecté
     */
    isColyseusConnected() {
        // Pour l'instant, on simule avec l'indicateur visuel
        return this.realtimeElements.connectionStatus?.text === '🟢';
    }

    // === MISE À JOUR DEPUIS COLYSEUS ===
    
    /**
     * Mettre à jour depuis les données temps réel
     */
    updateFromRealtimeData(realtimeData) {
        this.log('Mise à jour depuis données temps réel');
        
        // Mettre à jour les trophées
        if (realtimeData.trophies !== undefined) {
            this.updateProgressBar();
        }
        
        // Mettre à jour l'arène
        if (realtimeData.currentArena) {
            this.updateArenaInfo();
        }
        
        // Mettre à jour les stats de bataille
        if (realtimeData.gameStats) {
            this.updateBattleStats();
        }
    }
    
    /**
     * Gérer le résultat d'une bataille
     */
    onBattleResult(result) {
        this.log(`Résultat bataille: ${result.victory ? 'Victoire' : 'Défaite'}`);
        
        // Mettre à jour l'état
        this.battleState.isSearching = false;
        this.battleState.matchData = null;
        
        // Nettoyer l'UI
        this.updateBattleButton();
        this.clearSearchTimer();
        
        // Afficher le résultat
        const message = result.victory ? 
            `🎉 Victoire ! +${result.trophyChange} trophées` :
            `😞 Défaite ! ${result.trophyChange} trophées`;
            
        this.showBattleResult(message, result.victory);
        
        // Vérifier changement d'arène
        if (result.arenaChanged) {
            this.showArenaUnlocked(result.newArena);
        }
        
        // Rafraîchir les données
        this.refresh();
    }
    
    /**
     * Afficher le résultat d'une bataille
     */
    showBattleResult(message, isVictory) {
        const color = isVictory ? '#32CD32' : '#DC143C';
        const icon = isVictory ? '🎉' : '😞';
        
        // Créer notification de résultat
        const resultBg = this.createGraphics();
        resultBg.fillStyle(isVictory ? 0x006400 : 0x8B0000, 0.9);
        resultBg.fillRoundedRect(20, this.height / 2 - 40, this.width - 40, 80, 15);
        
        const resultText = this.createText(
            this.width / 2,
            this.height / 2,
            `${icon} ${message}`,
            {
                fontSize: '16px',
                fontWeight: 'bold',
                fill: '#FFFFFF',
                align: 'center'
            }
        );
        resultText.setOrigin(0.5);
        
        // Animation d'entrée
        resultBg.setAlpha(0);
        resultText.setAlpha(0);
        
        this.scene.tweens.add({
            targets: [resultBg, resultText],
            alpha: 1,
            duration: 300,
            ease: 'Back.easeOut'
        });
        
        // Auto-suppression après 4 secondes
        this.scene.time.delayedCall(4000, () => {
            this.scene.tweens.add({
                targets: [resultBg, resultText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                    resultBg.destroy();
                    resultText.destroy();
                }
            });
        });
    }
    
    /**
     * Afficher notification nouvelle arène
     */
    showArenaUnlocked(newArena) {
        const message = `🏟️ Nouvelle arène débloquée !\n${newArena.name}`;
        
        // Animation spéciale pour nouvelle arène
        const unlockNotification = this.createText(
            this.width / 2,
            this.height / 2 - 60,
            message,
            {
                fontSize: '18px',
                fontWeight: 'bold',
                fill: '#FFD700',
                align: 'center',
                stroke: '#8B4513',
                strokeThickness: 2
            }
        );
        unlockNotification.setOrigin(0.5);
        
        // Effet de particules dorées
        this.createGoldenParticles(this.width / 2, this.height / 2 - 60);
        
        // Animation pulsante
        this.pulse(unlockNotification, 800);
        
        // Auto-suppression après 5 secondes
        this.scene.time.delayedCall(5000, () => {
            unlockNotification.destroy();
        });
    }
    
    /**
     * Créer effet de particules dorées
     */
    createGoldenParticles(x, y) {
        const particleCount = 12;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = this.createGraphics();
            particle.fillStyle(0xFFD700, 0.8);
            particle.fillCircle(x, y, 4);
            
            const angle = (Math.PI * 2 / particleCount) * i;
            const distance = 60;
            
            this.scene.tweens.add({
                targets: particle,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance,
                alpha: 0,
                scaleX: 0.3,
                scaleY: 0.3,
                duration: 1000,
                ease: 'Power2.easeOut',
                onComplete: () => particle.destroy()
            });
        }
    }

    // === GESTION DES ÉVÉNEMENTS ===
    
    /**
     * Gérer l'activation du panel
     */
    onPanelActivated() {
        this.log('Panel bataille activé');
        
        // Rafraîchir les données
        this.refresh();
        
        // Relancer les animations si nécessaire
        if (this.battleState.isSearching) {
            this.updateBattleButton();
        }
    }
    
    /**
     * Gérer la désactivation du panel
     */
    onPanelDeactivated() {
        this.log('Panel bataille désactivé');
        
        // Nettoyer les timers
        this.clearSearchTimer();
    }

    // === NETTOYAGE ===
    
    /**
     * Nettoyer les ressources du panel
     */
    destroy() {
        this.log('Destruction panel bataille');
        
        // Nettoyer les timers
        this.clearSearchTimer();
        
        // Nettoyer les références
        Object.keys(this.battleElements).forEach(key => {
            this.battleElements[key] = null;
        });
        
        Object.keys(this.realtimeElements).forEach(key => {
            this.realtimeElements[key] = null;
        });
        
        // Appeler le nettoyage parent
        super.destroy();
    }

    // === MÉTHODES PUBLIQUES POUR INTÉGRATION ===
    
    /**
     * API publique pour la scène parent
     */
    
    // Connexion Colyseus
    setColyseusConnected(connected) {
        if (connected) {
            this.onColyseusConnected();
        } else {
            this.onColyseusDisconnected();
        }
    }
    
    // Mise à jour stats globales
    updateGlobalStats(stats) {
        this.onGlobalStatsUpdated(stats);
    }
    
    // État de recherche
    setSearchState(isSearching, data = null) {
        if (isSearching) {
            this.onSearchStarted(data);
        } else {
            this.onSearchCancelled(data);
        }
    }
    
    // Match trouvé
    notifyMatchFound(matchData) {
        this.onMatchFound(matchData);
    }
    
    // Résultat bataille
    notifyBattleResult(result) {
        this.onBattleResult(result);
    }
    
    // Mise à jour profil temps réel
    updateRealtimeProfile(profile) {
        this.updateFromRealtimeData(profile);
    }

    // === GETTERS POUR DEBUG ===
    
    getBattleState() {
        return { ...this.battleState };
    }
    
    getArenaConfig() {
        return [...this.arenaConfig];
    }
    
    isSearching() {
        return this.battleState.isSearching;
    }
}
