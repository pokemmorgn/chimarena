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
    
    handleMatchmaking() {
        console.log('🎯 Matchmaking lancé !');
        
        // Action simple pour test
        if (this.config.onAction) {
            this.config.onAction('matchmaking', {
                type: 'test_matchmaking',
                timestamp: Date.now()
            });
        }
        
        // Afficher notification
        this.showSimpleNotification('🎯 Matchmaking lancé !');
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
