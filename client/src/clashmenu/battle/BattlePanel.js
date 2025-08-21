// Dans client/src/clashmenu/battle/BattlePanel.js - AJOUT BOUTON MATCHMAKING

// === BOUTONS DE BATAILLE (modification de la méthode existante) ===

/**
 * Créer les boutons de bataille
 */
createBattleButtons() {
    const buttonsContainer = this.scene.add.container(0, 160);
    
    // Bouton principal BATAILLE
    this.battleElements.battleButton = this.createBattleMainButton();
    
    // 🆕 NOUVEAU BOUTON MATCHMAKING
    const matchmakingButton = this.createButton(
        this.width / 2, 90, // Position sous le bouton principal
        200, 60,           // Plus large que les autres
        '🎯 MATCHMAKING',
        '#FF6347',         // Rouge-orange distinctif
        () => this.safeAction('matchmaking')
    );
    
    // Boutons secondaires (repositionnés)
    const trainingButton = this.createButton(
        this.width / 2 - 80, 160, // Décalé vers le bas
        140, 50,
        '🎯 Entraînement',
        '#32CD32',
        () => this.safeAction('training')
    );
    
    const tournamentButton = this.createButton(
        this.width / 2 + 80, 160,
        140, 50,
        '🏆 Tournoi',
        '#9370DB',
        () => this.safeAction('tournament')
    );
    
    // Boutons tertiaires (repositionnés)
    const leaderboardButton = this.createButton(
        this.width / 2 - 80, 220,
        140, 40,
        '📊 Classement',
        '#4682B4',
        () => this.safeAction('leaderboard')
    );
    
    const spectateButton = this.createButton(
        this.width / 2 + 80, 220,
        140, 40,
        '👁️ Observer',
        '#708090',
        () => this.safeAction('spectate')
    );
    
    buttonsContainer.add([
        this.battleElements.battleButton,
        matchmakingButton,        // 🆕 AJOUTÉ ICI
        trainingButton,
        tournamentButton,
        leaderboardButton,
        spectateButton
    ]);
    
    this.elements.content.add(buttonsContainer);
}

// === HANDLERS D'ACTIONS (ajout dans la méthode handleAction existante) ===

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
        // 🆕 NOUVEAU HANDLER MATCHMAKING
        case 'matchmaking':
            this.handleMatchmaking();
            break;
        default:
            super.handleAction(action, data);
    }
}

// 🆕 NOUVELLE MÉTHODE MATCHMAKING
/**
 * Gérer le matchmaking avancé
 */
handleMatchmaking() {
    this.log('Matchmaking avancé demandé');
    
    // Vérifier les prérequis
    if (this.battleState.isSearching) {
        this.log('Recherche déjà en cours', 'warn');
        this.showError('Une recherche est déjà en cours');
        return;
    }
    
    // Vérifier la connexion
    if (!this.isColyseusConnected()) {
        this.showError('Connexion au serveur requise pour le matchmaking');
        return;
    }
    
    // Données du joueur pour le matchmaking
    const playerData = {
        trophies: this.getUserData()?.playerStats?.trophies || 0,
        level: this.getUserData()?.playerStats?.level || 1,
        winRate: this.getUserData()?.winRate || 0,
        preferredGameMode: 'ranked', // Ou 'casual', 'tournament'
        region: 'EU', // À adapter selon la localisation
        deck: this.getUserData()?.currentDeck || []
    };
    
    this.log('Lancement matchmaking avec données:', playerData);
    
    // Envoyer l'action au PanelManager puis à ClashMenuScene
    super.handleAction('matchmaking', {
        type: 'advanced_matchmaking',
        playerData: playerData,
        timestamp: Date.now()
    });
    
    // Interface utilisateur
    this.showMatchmakingUI();
}

// 🆕 INTERFACE MATCHMAKING
/**
 * Afficher l'interface de matchmaking
 */
showMatchmakingUI() {
    // Créer une notification ou modal de matchmaking
    const message = '🎯 Recherche de match avancée...\nAnalyse des joueurs compatibles';
    
    // Utiliser le système de notification existant
    if (this.scene.showMessage) {
        this.scene.showMessage(message, 'info');
    }
    
    // Ou créer une interface spécialisée
    this.createMatchmakingOverlay();
}

/**
 * Créer l'overlay de matchmaking
 */
createMatchmakingOverlay() {
    // Overlay semi-transparent
    const overlay = this.createGraphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, this.width, this.height);
    overlay.setDepth(1000);
    
    // Panel de matchmaking
    const panelWidth = Math.min(this.width - 40, 300);
    const panelHeight = 200;
    
    const matchmakingPanel = this.createGraphics();
    matchmakingPanel.fillStyle(0x2F4F4F, 1);
    matchmakingPanel.fillRoundedRect(
        this.width/2 - panelWidth/2, this.height/2 - panelHeight/2,
        panelWidth, panelHeight, 15
    );
    matchmakingPanel.lineStyle(3, 0xFF6347); // Couleur matchmaking
    matchmakingPanel.strokeRoundedRect(
        this.width/2 - panelWidth/2, this.height/2 - panelHeight/2,
        panelWidth, panelHeight, 15
    );
    matchmakingPanel.setDepth(1001);
    
    // Titre
    const title = this.createText(
        this.width/2, this.height/2 - 60,
        '🎯 MATCHMAKING AVANCÉ',
        {
            fontSize: '18px',
            fontWeight: 'bold',
            fill: '#FF6347'
        }
    );
    title.setOrigin(0.5);
    title.setDepth(1002);
    
    // Statut
    const status = this.createText(
        this.width/2, this.height/2 - 20,
        'Recherche de joueurs compatibles...\nAnalyse du niveau et des trophées',
        {
            fontSize: '12px',
            fill: '#B0C4DE',
            align: 'center'
        }
    );
    status.setOrigin(0.5);
    status.setDepth(1002);
    
    // Animation de recherche
    const spinner = this.createText(
        this.width/2, this.height/2 + 20,
        '⏳',
        { fontSize: '24px' }
    );
    spinner.setOrigin(0.5);
    spinner.setDepth(1002);
    
    // Animation rotation
    this.scene.tweens.add({
        targets: spinner,
        rotation: Math.PI * 2,
        duration: 1000,
        repeat: -1,
        ease: 'Linear'
    });
    
    // Bouton annuler
    const cancelButton = this.createButton(
        this.width/2, this.height/2 + 60,
        120, 35,
        'Annuler',
        '#DC143C',
        () => {
            this.cancelMatchmaking();
            // Nettoyer l'overlay
            [overlay, matchmakingPanel, title, status, spinner].forEach(element => {
                if (element.destroy) element.destroy();
            });
        }
    );
    cancelButton.setDepth(1002);
    
    // Stocker les références pour nettoyage
    this.matchmakingElements = {
        overlay, matchmakingPanel, title, status, spinner, cancelButton
    };
    
    // Auto-fermeture après 30 secondes
    this.scene.time.delayedCall(30000, () => {
        this.cancelMatchmaking();
        this.cleanupMatchmakingUI();
    });
}

/**
 * Annuler le matchmaking
 */
cancelMatchmaking() {
    this.log('Annulation matchmaking avancé');
    
    // Envoyer annulation au serveur
    super.handleAction('cancel_matchmaking', {
        type: 'advanced_matchmaking',
        timestamp: Date.now()
    });
    
    this.cleanupMatchmakingUI();
}

/**
 * Nettoyer l'interface de matchmaking
 */
cleanupMatchmakingUI() {
    if (this.matchmakingElements) {
        Object.values(this.matchmakingElements).forEach(element => {
            if (element && element.destroy) {
                element.destroy();
            }
        });
        this.matchmakingElements = null;
    }
}

// === CALLBACKS MATCHMAKING (nouvelles méthodes) ===

/**
 * Callback: Match trouvé via matchmaking avancé
 */
onAdvancedMatchFound(matchData) {
    this.log(`Match avancé trouvé:`, matchData);
    
    // Nettoyer l'UI de matchmaking
    this.cleanupMatchmakingUI();
    
    // Afficher les détails du match
    this.showAdvancedMatchFoundNotification(matchData);
}

/**
 * Afficher notification de match avancé trouvé
 */
showAdvancedMatchFoundNotification(matchData) {
    const opponentInfo = matchData.opponent || {};
    const estimatedWinRate = matchData.estimatedWinRate || 50;
    
    const message = `🎯 Match optimal trouvé !\n` +
                   `Adversaire: ${opponentInfo.username || 'Joueur'}\n` +
                   `Niveau: ${opponentInfo.level || '?'} | Trophées: ${opponentInfo.trophies || '?'}\n` +
                   `Chance de victoire estimée: ${estimatedWinRate}%`;
    
    // Notification étendue
    const notification = this.createText(
        this.width / 2,
        this.height / 2,
        message,
        {
            fontSize: '14px',
            fontWeight: 'bold',
            fill: '#32CD32',
            align: 'center',
            backgroundColor: '#000000',
            padding: { x: 20, y: 15 }
        }
    );
    notification.setOrigin(0.5);
    notification.setDepth(2000);
    
    // Animation d'apparition
    notification.setAlpha(0);
    notification.setScale(0.8);
    
    this.scene.tweens.add({
        targets: notification,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 400,
        ease: 'Back.easeOut'
    });
    
    // Auto-suppression après 5 secondes
    this.scene.time.delayedCall(5000, () => {
        this.scene.tweens.add({
            targets: notification,
            alpha: 0,
            duration: 300,
            onComplete: () => notification.destroy()
        });
    });
}

// === INTÉGRATION DANS LA CLASSE (ajouts aux méthodes existantes) ===

/**
 * Nettoyage étendu (ajout à la méthode destroy existante)
 */
destroy() {
    this.log('Destruction panel bataille');
    
    // Nettoyer les timers
    this.clearSearchTimer();
    
    // 🆕 Nettoyer le matchmaking
    this.cleanupMatchmakingUI();
    
    // Nettoyer les références existantes...
    Object.keys(this.battleElements).forEach(key => {
        this.battleElements[key] = null;
    });
    
    Object.keys(this.realtimeElements).forEach(key => {
        this.realtimeElements[key] = null;
    });
    
    // Appeler le nettoyage parent
    super.destroy();
}

// === API PUBLIQUE ÉTENDUE ===

/**
 * Forcer l'arrêt du matchmaking depuis l'extérieur
 */
stopMatchmaking() {
    this.cancelMatchmaking();
}

/**
 * Obtenir l'état du matchmaking
 */
getMatchmakingState() {
    return {
        isActive: !!this.matchmakingElements,
        timestamp: Date.now()
    };
}
