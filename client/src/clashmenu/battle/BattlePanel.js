// client/src/clashmenu/battle/BattlePanel.js - VERSION DIAGNOSTIC SIMPLE
export default class BattlePanel {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = config;
        this.container = null;
        this.isVisible = false;
        
        // Dimensions
        this.width = scene.scale.width;
        this.height = scene.scale.height;
        this.isMobile = scene.isMobile || false;
         // Écouter les événements de matchmaking
        this.setupMatchmakingListeners();
        
        console.log('🏗️ BattlePanel constructor démarré');
        console.log('🔍 Scene valide:', !!scene);
        console.log('🔍 Scene.add valide:', !!(scene && scene.add));
        
        // Initialiser immédiatement
        this.init();
    }
    
    init() {
        console.log('🏗️ BattlePanel.init() démarré');
        
        try {
            // Créer container avec vérifications
            console.log('🔍 Création container...');
            this.container = this.scene.add.container(0, 0);
            console.log('✅ Container créé:', !!this.container);
            console.log('🔍 Container type:', this.container.constructor.name);
            
            // Créer contenu minimal
            this.createSimpleContent();
            
            console.log('✅ BattlePanel initialisé avec succès');
            
        } catch (error) {
            console.error('❌ Erreur init BattlePanel:', error);
            this.container = null;
        }
    }
    
    createSimpleContent() {
        console.log('🎨 Création contenu simple...');
        
        try {
            // Titre simple
            const title = this.scene.add.text(
                this.width / 2, 100,
                '⚔️ BATAILLE PANEL',
                {
                    fontSize: '24px',
                    fontWeight: 'bold',
                    fill: '#FFD700',
                    align: 'center'
                }
            );
            title.setOrigin(0.5);
            
            console.log('✅ Titre créé:', !!title);
            
            // Ajouter au container
            this.container.add(title);
            console.log('✅ Titre ajouté au container');
            
            // Bouton Matchmaking simple
            const matchmakingBg = this.scene.add.graphics();
            matchmakingBg.fillStyle(0xFF6347);
            matchmakingBg.fillRoundedRect(
                this.width / 2 - 110, 150,
                220, 60, 12
            );
            
            const matchmakingText = this.scene.add.text(
                this.width / 2, 180,
                '🎯 MATCHMAKING',
                {
                    fontSize: '18px',
                    fontWeight: 'bold',
                    fill: '#FFFFFF'
                }
            );
            matchmakingText.setOrigin(0.5);
            
            // Zone interactive
            const hitArea = this.scene.add.zone(
                this.width / 2, 180,
                220, 60
            ).setInteractive();
            
            hitArea.on('pointerdown', () => {
                console.log('🎯 Bouton Matchmaking cliqué !');
                this.handleMatchmaking();
            });
            
            // Ajouter au container
            this.container.add([matchmakingBg, matchmakingText, hitArea]);
            console.log('✅ Bouton Matchmaking créé');
            
            // Texte d'état
            const statusText = this.scene.add.text(
                this.width / 2, 250,
                'Panel Battle chargé avec succès !\nBouton Matchmaking fonctionnel.',
                {
                    fontSize: '14px',
                    fill: '#B0C4DE',
                    align: 'center'
                }
            );
            statusText.setOrigin(0.5);
            
            this.container.add(statusText);
            console.log('✅ Contenu simple créé');
            
        } catch (error) {
            console.error('❌ Erreur création contenu:', error);
        }
    }
setupMatchmakingListeners() {
        console.log('🎧 Setup des listeners matchmaking...');
        
        const colyseusManager = window.colyseusManager;
        if (!colyseusManager) {
            console.warn('⚠️ ColyseusManager non disponible pour les listeners');
            return;
        }
        
        // Écouter les événements de match trouvé
        colyseusManager.on('matchFound', (matchData) => {
            console.log('🎯 Match trouvé dans BattlePanel:', matchData);
            this.onMatchFound(matchData);
        });
        
        // Écouter les événements de recherche annulée
        colyseusManager.on('searchCancelled', (data) => {
            console.log('❌ Recherche annulée dans BattlePanel');
            this.showSimpleNotification('❌ Recherche annulée');
        });
        
        // Écouter les erreurs de recherche
        colyseusManager.on('searchError', (data) => {
            console.log('❌ Erreur de recherche dans BattlePanel:', data);
            this.showSimpleNotification(`❌ ${data.message}`);
        });
    }
    
async onMatchFound(matchData) {
    console.log('🎉 MATCH TROUVÉ !', matchData);
    
    try {
        // Afficher notification initiale
        this.showSimpleNotification(`🎉 Adversaire trouvé: ${matchData.opponent?.username || 'Inconnu'}`);
        
        // Récupérer les données nécessaires
        // Diagnostic complet des données reçues
        console.log('🔍 DIAGNOSTIC COMPLET matchData:', JSON.stringify(matchData, null, 2));
        
        // Récupérer les données nécessaires
        const battleRoomId = matchData.battleRoomId;
        const playerData = matchData.playerData;
        const opponent = matchData.opponent;
        
        // Diagnostic détaillé
        const diagnostic = {
            hasBattleRoomId: !!battleRoomId,
            hasPlayerData: !!playerData,
            hasOpponent: !!opponent,
            battleRoomId: battleRoomId,
            playerDataKeys: playerData ? Object.keys(playerData) : 'MANQUANT',
            opponentKeys: opponent ? Object.keys(opponent) : 'MANQUANT',
            allKeys: Object.keys(matchData)
        };
        
        console.log('🔍 DIAGNOSTIC DÉTAILLÉ:', diagnostic);
        
        // Vérifications spécifiques
        const errors = [];
        if (!battleRoomId) errors.push('battleRoomId manquant');
        if (!playerData) errors.push('playerData manquant');
        if (!opponent) errors.push('opponent manquant');
        
        if (playerData) {
            if (!playerData.userId) errors.push('playerData.userId manquant');
            if (!playerData.username) errors.push('playerData.username manquant');
            if (!playerData.deck || !Array.isArray(playerData.deck)) errors.push('playerData.deck manquant ou invalide');
        }
        
        if (errors.length > 0) {
            const errorMsg = `Données de combat incomplètes: ${errors.join(', ')}`;
            console.error('❌ ERREURS DÉTAILLÉES:', errors);
            throw new Error(errorMsg);
        }
        
        console.log('✅ Toutes les données requises sont présentes');
        
        console.log('⚔️ Connexion au combat...', {
            battleRoomId,
            playerUsername: playerData.username
        });
        
        // Se connecter à la BattleRoom
        const colyseusManager = window.colyseusManager;
        const battleRoom = await colyseusManager.joinBattleRoom(battleRoomId, playerData);
        
        if (battleRoom) {
            console.log('✅ Connecté au combat !');
            this.showSimpleNotification('⚔️ Connexion au combat réussie !');
            
            // Configurer les listeners de combat
            this.setupBattleListeners();
            
            // Afficher l'interface de combat
            this.showBattleInterface();
            
        } else {
            throw new Error('Échec connexion BattleRoom');
        }
        
    } catch (error) {
        console.error('❌ Erreur onMatchFound:', error);
        this.showSimpleNotification(`❌ Erreur: ${error.message}`);
    }
}

    setupBattleListeners() {
    console.log('🎧 Setup listeners de combat...');
    
    const colyseusManager = window.colyseusManager;
    
    // Écouter les événements de combat
    colyseusManager.on('battleInfo', (data) => {
        console.log('📨 Battle Info reçue:', data);
        this.onBattleInfo(data);
    });
    
    colyseusManager.on('battleStarted', (data) => {
        console.log('📨 Combat démarré !');
        this.onBattleStarted(data);
    });
    
    colyseusManager.on('cardPlaced', (data) => {
        console.log('📨 Carte placée:', data.cardId);
        this.onCardPlaced(data);
    });
    
    colyseusManager.on('battleEnded', (data) => {
        console.log('📨 Combat terminé !');
        this.onBattleEnded(data);
    });
    
    colyseusManager.on('battleRoomError', (error) => {
        console.error('📨 Erreur combat:', error);
        this.showSimpleNotification(`❌ Erreur combat: ${error}`);
    });
}

showBattleInterface() {
    console.log('🎮 Affichage interface de combat...');
    
    // Cacher l'interface de matchmaking
    this.hideLobbyInterface();
    
    // Créer l'interface de combat simple
    this.createBattleInterface();
}

hideLobbyInterface() {
    // Cacher tous les éléments du lobby
    if (this.container) {
        this.container.getAll().forEach(child => {
            if (child.setVisible) {
                child.setVisible(false);
            }
        });
    }
}

createBattleInterface() {
    console.log('🎨 Création interface de combat...');
    
    try {
        // Titre du combat
        const battleTitle = this.scene.add.text(
            this.width / 2, 100,
            '⚔️ COMBAT EN COURS',
            {
                fontSize: '24px',
                fontWeight: 'bold',
                fill: '#FF4500',
                align: 'center'
            }
        );
        battleTitle.setOrigin(0.5);
        this.container.add(battleTitle);
        
        // Zone d'état
        this.battleStatusText = this.scene.add.text(
            this.width / 2, 150,
            'Connexion au combat...',
            {
                fontSize: '16px',
                fill: '#FFFFFF',
                align: 'center'
            }
        );
        this.battleStatusText.setOrigin(0.5);
        this.container.add(this.battleStatusText);
        
        // Bouton "Prêt"
        const readyBg = this.scene.add.graphics();
        readyBg.fillStyle(0x32CD32);
        readyBg.fillRoundedRect(
            this.width / 2 - 100, 200,
            200, 50, 10
        );
        
        const readyText = this.scene.add.text(
            this.width / 2, 225,
            '✅ PRÊT',
            {
                fontSize: '16px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            }
        );
        readyText.setOrigin(0.5);
        
        const readyZone = this.scene.add.zone(
            this.width / 2, 225,
            200, 50
        ).setInteractive();
        
        readyZone.on('pointerdown', () => {
            this.handlePlayerReady();
        });
        
        this.container.add([readyBg, readyText, readyZone]);
        
        // Bouton Abandon
        const forfeitBg = this.scene.add.graphics();
        forfeitBg.fillStyle(0xDC143C);
        forfeitBg.fillRoundedRect(
            this.width / 2 - 80, 270,
            160, 40, 8
        );
        
        const forfeitText = this.scene.add.text(
            this.width / 2, 290,
            '🏳️ ABANDONNER',
            {
                fontSize: '14px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            }
        );
        forfeitText.setOrigin(0.5);
        
        const forfeitZone = this.scene.add.zone(
            this.width / 2, 290,
            160, 40
        ).setInteractive();
        
        forfeitZone.on('pointerdown', () => {
            this.handleForfeit();
        });
        
        this.container.add([forfeitBg, forfeitText, forfeitZone]);
        
        console.log('✅ Interface de combat créée');
        
    } catch (error) {
        console.error('❌ Erreur création interface combat:', error);
    }
}

// Handlers des événements de combat
onBattleInfo(data) {
    console.log('⚔️ Info combat reçue:', data.players?.length, 'joueurs');
    this.updateBattleStatus('Combat préparé - 2 joueurs connectés');
}

onBattleStarted(data) {
    console.log('🚀 Combat démarré !');
    this.updateBattleStatus('⚔️ COMBAT EN COURS !');
    this.showSimpleNotification('🚀 Le combat commence !');
}

onCardPlaced(data) {
    const isOwnCard = data.playerId === window.colyseusManager.battleRoom?.sessionId;
    const playerName = isOwnCard ? 'Vous' : 'Adversaire';
    
    this.updateBattleStatus(`${playerName} a placé ${data.cardId}`);
    console.log(`🃏 ${playerName} place ${data.cardId} en (${data.x}, ${data.y})`);
}

onBattleEnded(data) {
    const isWinner = data.winner === window.colyseusManager.battleRoom?.sessionId;
    const result = data.winner === 'draw' ? 'Égalité' : (isWinner ? 'VICTOIRE !' : 'Défaite');
    
    this.updateBattleStatus(`🏁 ${result}`);
    this.showSimpleNotification(`🏁 Combat terminé - ${result}`);
    
    // Retourner au lobby après 5 secondes
    setTimeout(() => {
        this.returnToLobby();
    }, 5000);
}

// Actions de combat
handlePlayerReady() {
    console.log('✅ Joueur prêt !');
    const success = window.colyseusManager.playerReady();
    
    if (success) {
        this.updateBattleStatus('✅ Vous êtes prêt - En attente de l\'adversaire...');
        this.showSimpleNotification('✅ Prêt pour le combat !');
    }
}

handleForfeit() {
    const confirm = window.confirm('Abandonner le combat ?');
    if (!confirm) return;
    
    console.log('🏳️ Abandon !');
    const success = window.colyseusManager.forfeitBattle();
    
    if (success) {
        this.updateBattleStatus('🏳️ Abandon en cours...');
    }
}

// Utilitaires
updateBattleStatus(text) {
    if (this.battleStatusText) {
        this.battleStatusText.setText(text);
    }
}

returnToLobby() {
    console.log('🏠 Retour au lobby...');
    
    // Quitter la BattleRoom
    window.colyseusManager.leaveBattleRoom();
    
    // Recréer l'interface lobby
    this.container.removeAll(true);
    this.createSimpleContent();
    
    this.showSimpleNotification('🏠 Retour au lobby');
}
handleMatchmaking() {
        console.log('🎯 Matchmaking lancé !');
        
        try {
            // Utiliser le ColyseusManager global au lieu de networkManager
            const colyseusManager = window.colyseusManager;
            
            if (!colyseusManager) {
                console.error('❌ ColyseusManager non trouvé');
                this.showSimpleNotification('❌ Service réseau indisponible');
                return;
            }
            
            if (!colyseusManager.isColyseusConnected()) {
                this.showSimpleNotification('🔄 Connexion en cours...');
                console.log('🔄 Tentative de connexion via ColyseusManager...');
                
                // Essayer de se connecter via ColyseusManager
                colyseusManager.connect()
                    .then((success) => {
                        if (success) {
                            console.log('✅ Connexion réussie, relance du matchmaking...');
                            this.showSimpleNotification('✅ Connecté ! Recherche...');
                            // Relancer le matchmaking après connexion
                            setTimeout(() => this.sendMatchmakingRequest(), 1000);
                        } else {
                            console.error('❌ Échec connexion ColyseusManager');
                            this.showSimpleNotification('❌ Connexion échouée');
                        }
                    })
                    .catch((error) => {
                        console.error('❌ Erreur connexion ColyseusManager:', error);
                        this.showSimpleNotification('❌ Connexion échouée');
                    });
                return;
            }
            
            // Si déjà connecté, envoyer directement
            this.sendMatchmakingRequest();
            
        } catch (error) {
            console.error('❌ Erreur handleMatchmaking:', error);
            this.showSimpleNotification('❌ Erreur de connexion');
        }
    }
    
    sendMatchmakingRequest() {
        try {
            const colyseusManager = window.colyseusManager;
            
            // Utiliser la méthode searchBattle du ColyseusManager
            const success = colyseusManager.searchBattle();
            
            if (success) {
                console.log('✅ Demande de matchmaking envoyée au serveur');
                this.showSimpleNotification('🎯 Recherche d\'adversaire...');
                
                // Action pour le système local si nécessaire
                if (this.config.onAction) {
                    this.config.onAction('matchmaking', {
                        type: 'search_battle',
                        timestamp: Date.now()
                    });
                }
            } else {
                console.error('❌ Échec envoi demande matchmaking');
                this.showSimpleNotification('❌ Erreur envoi requête');
            }
            
        } catch (error) {
            console.error('❌ Erreur sendMatchmakingRequest:', error);
            this.showSimpleNotification('❌ Erreur envoi requête');
        }
    }
    
    showSimpleNotification(message) {
        try {
            const notification = this.scene.add.text(
                this.width / 2, 320,
                message,
                {
                    fontSize: '16px',
                    fontWeight: 'bold',
                    fill: '#32CD32',
                    backgroundColor: '#000000',
                    padding: { x: 20, y: 10 }
                }
            );
            notification.setOrigin(0.5);
            notification.setDepth(1000);
            
            // Animation
            notification.setAlpha(0);
            this.scene.tweens.add({
                targets: notification,
                alpha: 1,
                duration: 300
            });
            
            // Auto-suppression
            this.scene.time.delayedCall(3000, () => {
                this.scene.tweens.add({
                    targets: notification,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => notification.destroy()
                });
            });
            
        } catch (error) {
            console.error('❌ Erreur notification:', error);
        }
    }
    
    // === MÉTHODES REQUISES POUR PANELMANAGER ===
    
    getContainer() {
        console.log('🔍 getContainer() appelé, container:', !!this.container);
        return this.container;
    }
    
    show(animate = true) {
        console.log('👁️ show() appelé');
        
        if (!this.container) {
            console.error('❌ Pas de container pour show()');
            return;
        }
        
        try {
            this.container.setVisible(true);
            this.isVisible = true;
            
            if (animate) {
                this.container.setAlpha(0);
                this.scene.tweens.add({
                    targets: this.container,
                    alpha: 1,
                    duration: 300
                });
            }
            
            console.log('✅ Panel affiché');
        } catch (error) {
            console.error('❌ Erreur show():', error);
        }
    }
    
    hide(animate = true) {
        console.log('🙈 hide() appelé');
        
        if (!this.container) {
            console.error('❌ Pas de container pour hide()');
            return;
        }
        
        try {
            this.isVisible = false;
            
            if (animate) {
                this.scene.tweens.add({
                    targets: this.container,
                    alpha: 0,
                    duration: 200,
                    onComplete: () => {
                        this.container.setVisible(false);
                    }
                });
            } else {
                this.container.setVisible(false);
            }
            
            console.log('✅ Panel masqué');
        } catch (error) {
            console.error('❌ Erreur hide():', error);
        }
    }
    
    isShown() {
        return this.isVisible;
    }
    
    updateData(newData) {
        console.log('📊 updateData() appelé:', newData);
        // Pas d'action pour la version simple
    }
    
    destroy() {
        console.log('🗑️ destroy() appelé');
        
        try {
            if (this.container) {
                this.container.destroy();
                this.container = null;
            }
            console.log('✅ Panel détruit');
        } catch (error) {
            console.error('❌ Erreur destroy():', error);
        }
    }
    
    // === MÉTHODES DE DEBUG ===
    
    getDiagnostic() {
        return {
            containerExists: !!this.container,
            containerVisible: this.container ? this.container.visible : false,
            isVisible: this.isVisible,
            sceneValid: !!(this.scene && this.scene.add),
            configValid: !!this.config
        };
    }
}

// === FONCTIONS DE TEST GLOBALES ===
if (typeof window !== 'undefined') {
    
    // Test du BattlePanel simple
    window.testSimpleBattlePanel = () => {
        console.log('🧪 Test BattlePanel simple...');
        
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene?.panelManager) {
            return clashScene.panelManager.forceLoadRealPanel('battle');
        } else {
            console.error('❌ PanelManager non trouvé');
            return false;
        }
    };
    
    // Diagnostic du panel battle actuel
    window.debugBattlePanel = () => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene?.panelManager) {
            const battlePanel = clashScene.panelManager.panels.get('battle');
            
            if (battlePanel && battlePanel.getDiagnostic) {
                const diagnostic = battlePanel.getDiagnostic();
                console.group('🔍 DIAGNOSTIC BATTLE PANEL');
                console.table(diagnostic);
                console.groupEnd();
                return diagnostic;
            } else {
                console.log('❌ Pas de panel battle ou pas de méthode getDiagnostic');
                return null;
            }
        } else {
            console.error('❌ PanelManager non trouvé');
            return null;
        }
    };
    
    console.log(`
🧪 === TESTS BATTLE PANEL SIMPLE ===

🔍 DIAGNOSTIC:
▶️ debugBattlePanel() - État du panel battle

🧪 TESTS:
▶️ testSimpleBattlePanel() - Charger version simple
▶️ forceLoadRealPanel('battle') - Charger version complète

COMMENCEZ PAR: testSimpleBattlePanel()
    `);
}
