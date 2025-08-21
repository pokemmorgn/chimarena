// client/src/clashmenu/utils/PanelManager.js - CORRECTION ERREURS CONTAINER
export default class PanelManager {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.container = null;
        
        // Configuration
        this.config = {
            userData: config.userData || null,
            onAction: config.onAction || (() => {}),
            onTabChange: config.onTabChange || (() => {}),
            enableTransitions: config.enableTransitions !== false,
            defaultPanel: config.defaultPanel || 'battle',
            ...config
        };
        
        // État du manager
        this.state = {
            currentPanel: null,
            currentIndex: 0,
            isTransitioning: false,
            initialized: false
        };
        
        // Panels disponibles
        this.panels = new Map();
        this.panelConfigs = new Map();
        
        // Navigation
        this.navigation = null;
        this.tabDefinitions = [
            { id: 'battle', name: 'Bataille', icon: '⚔️', module: null },
            { id: 'cards', name: 'Cartes', icon: '🃏', module: null },
            { id: 'clan', name: 'Clan', icon: '🏰', module: null },
            { id: 'profile', name: 'Profil', icon: '👤', module: null }
        ];
        
        // Chargement dynamique
        this.loadingPromises = new Map();
        
        console.log('📋 PanelManager initialisé');
    }

    // === INITIALISATION ===
    
    async init() {
        if (this.state.initialized) return;
        
        console.log('🏗️ Initialisation PanelManager...');
        
        // Container principal
        this.container = this.scene.add.container(0, 0);
        
        // Créer la navigation
        this.createNavigation();
        
        // Enregistrer les configurations des panels
        this.registerPanelConfigs();
        
        // TEMPORAIRE : Commencer par un placeholder pour éviter les erreurs
        console.log('🧪 TEMPORAIRE: Chargement placeholder battle pour debug...');
        await this.showPanel('battle'); // Commencer par placeholder qui marche
        
        this.state.initialized = true;
        console.log('✅ PanelManager initialisé');
    }
    
    registerPanelConfigs() {
        this.panelConfigs.set('battle', {
            title: 'BATAILLE',
            icon: '⚔️',
            module: 'BattlePanel',
            className: 'BattlePanel',
            contentStartY: 120,
            enableColyseus: true
        });
        
        this.panelConfigs.set('cards', {
            title: 'CARTES',
            icon: '🃏',
            module: 'DeckPanel',
            className: 'DeckPanel',
            contentStartY: 120,
            hasSubTabs: true,
            subTabs: ['collection', 'deck', 'defis'],
            defaultSubTab: 'collection'
        });
        
        this.panelConfigs.set('clan', {
            title: 'CLAN',
            icon: '🏰',
            module: 'ClanPanel',
            className: 'ClanPanel',
            contentStartY: 180
        });
        
        this.panelConfigs.set('profile', {
            title: 'PROFIL',
            icon: '👤',
            module: 'ProfilePanel',
            className: 'ProfilePanel',
            contentStartY: 180
        });
        
        console.log(`📝 ${this.panelConfigs.size} configurations de panels enregistrées`);
    }

    // === GESTION DES PANELS ===
    
    async showPanel(panelId, animate = true) {
        if (this.state.isTransitioning) {
            console.warn('⚠️ Transition déjà en cours');
            return false;
        }
        
        const panelConfig = this.panelConfigs.get(panelId);
        if (!panelConfig) {
            console.error(`❌ Panel ${panelId} non trouvé`);
            return false;
        }
        
        console.log(`📱 Affichage panel: ${panelId}`);
        this.state.isTransitioning = true;
        
        try {
            // Charger le panel si nécessaire
            const panel = await this.loadPanel(panelId);
            if (!panel) {
                throw new Error(`Impossible de charger le panel ${panelId}`);
            }
            
            // Masquer le panel actuel
            const currentPanel = this.getCurrentPanel();
            if (currentPanel && currentPanel !== panel) {
                await this.hidePanelInternal(currentPanel, animate);
            }
            
            // Afficher le nouveau panel
            await this.showPanelInternal(panel, animate);
            
            // Mettre à jour l'état
            this.state.currentPanel = panelId;
            this.state.currentIndex = this.getPanelIndex(panelId);
            
            // Mettre à jour la navigation
            this.updateNavigation();
            
            // Callback
            this.config.onTabChange(panelId, this.state.currentIndex);
            
            console.log(`✅ Panel ${panelId} affiché`);
            return true;
            
        } catch (error) {
            console.error(`❌ Erreur affichage panel ${panelId}:`, error);
            this.showError(`Erreur lors du chargement de ${panelConfig.title}: ${error.message}`);
            return false;
        } finally {
            this.state.isTransitioning = false;
        }
    }
    
    async loadPanel(panelId) {
        // Vérifier si déjà chargé
        if (this.panels.has(panelId)) {
            return this.panels.get(panelId);
        }
        
        // Vérifier si chargement en cours
        if (this.loadingPromises.has(panelId)) {
            return await this.loadingPromises.get(panelId);
        }
        
        const panelConfig = this.panelConfigs.get(panelId);
        if (!panelConfig) {
            throw new Error(`Configuration panel ${panelId} non trouvée`);
        }
        
        console.log(`⏳ Chargement panel ${panelId}...`);
        
        // Créer la promise de chargement
        const loadingPromise = this.loadPanelModule(panelId, panelConfig);
        this.loadingPromises.set(panelId, loadingPromise);
        
        try {
            const panel = await loadingPromise;
            this.panels.set(panelId, panel);
            this.loadingPromises.delete(panelId);
            
            console.log(`✅ Panel ${panelId} chargé`);
            return panel;
            
        } catch (error) {
            this.loadingPromises.delete(panelId);
            throw error;
        }
    }
    
    async loadPanelModule(panelId, panelConfig) {
        try {
            let PanelClass = null;
            
            // POUR DEBUG : Forcer placeholder pour battle et cards
            // if (panelId === 'battle' || panelId === 'cards') {
            //    console.log(`🧪 DEBUG: Force placeholder pour ${panelId} pour éviter erreurs`);
            //     return this.createPlaceholderPanel(panelId, panelConfig);
            //  }
            
            // Import direct avec chemins corrects (désactivé temporairement)
            switch (panelId) {
                case 'battle':
                    try {
                        console.log('🔄 Import BattlePanel...');
                        const battleModule = await import('../battle/BattlePanel.js');
                        PanelClass = battleModule.default;
                        console.log('✅ BattlePanel importé:', !!PanelClass);
                    } catch (importError) {
                        console.warn('⚠️ Import BattlePanel échoué:', importError.message);
                        throw new Error(`Import BattlePanel failed: ${importError.message}`);
                    }
                    break;
                    
                case 'cards':
                    try {
                        console.log('🔄 Import DeckPanel...');
                        const deckModule = await import('../deck/DeckPanel.js');
                        PanelClass = deckModule.default;
                        console.log('✅ DeckPanel importé:', !!PanelClass);
                    } catch (importError) {
                        console.warn('⚠️ Import DeckPanel échoué:', importError.message);
                        throw new Error(`Import DeckPanel failed: ${importError.message}`);
                    }
                    break;
                    
                case 'clan':
                case 'profile':
                    // Créer un panel placeholder
                    console.log(`🔄 Création placeholder pour ${panelId}...`);
                    return this.createPlaceholderPanel(panelId, panelConfig);
                    
                default:
                    throw new Error(`Panel ${panelId} non supporté`);
            }
            
            // Vérifier que la classe a été importée
            if (!PanelClass) {
                throw new Error(`Classe ${panelConfig.className} non trouvée dans le module`);
            }
            
            // Créer l'instance du panel avec vérifications
            console.log(`🏗️ Création instance ${panelConfig.className}...`);
            
            // VÉRIFICATION CRITIQUE: S'assurer que la scène est valide
            if (!this.scene || !this.scene.add) {
                throw new Error('Scène Phaser invalide pour création panel');
            }
            
            const panelInstance = new PanelClass(this.scene, {
                name: panelId,
                title: panelConfig.title,
                icon: panelConfig.icon,
                userData: this.config.userData,
                contentStartY: panelConfig.contentStartY,
                onAction: (action, data) => this.handlePanelAction(panelId, action, data),
                hasSubTabs: panelConfig.hasSubTabs,
                subTabs: panelConfig.subTabs,
                defaultSubTab: panelConfig.defaultSubTab,
                ...panelConfig
            });
            
            // VÉRIFICATION CRITIQUE: S'assurer que le panel a un container valide
            const panelContainer = panelInstance.getContainer();
            if (!panelContainer) {
                throw new Error(`Panel ${panelId} n'a pas de container valide`);
            }
            
            console.log(`🔍 DEBUG: Panel container type:`, panelContainer.constructor.name);
            console.log(`🔍 DEBUG: Panel container valid:`, !!panelContainer);
            
            // Ajouter au container avec vérifications
            try {
                this.container.add(panelContainer);
                console.log(`✅ Panel ${panelId} ajouté au container`);
            } catch (addError) {
                console.error(`❌ Erreur ajout container:`, addError);
                throw new Error(`Impossible d'ajouter le panel au container: ${addError.message}`);
            }
            
            return panelInstance;
            
        } catch (error) {
            console.error(`❌ Erreur chargement panel ${panelId}:`, error);
            
            // Fallback: créer un panel d'erreur ROBUSTE
            return this.createErrorPanel(panelId, panelConfig, error.message);
        }
    }
    
    /**
     * Créer un panel placeholder ROBUSTE pour les panels pas encore implémentés
     */
    createPlaceholderPanel(panelId, panelConfig) {
        console.log(`🏗️ Création placeholder ROBUSTE pour ${panelId}...`);
        
        try {
            // VÉRIFIER LA SCÈNE D'ABORD
            if (!this.scene || !this.scene.add) {
                throw new Error('Scène Phaser invalide');
            }
            
            const { width, height } = this.scene.scale;
            
            // Créer le container Phaser AVEC VÉRIFICATIONS
            let container = null;
            try {
                container = this.scene.add.container(0, 0);
                console.log(`✅ Container placeholder créé pour ${panelId}`);
            } catch (containerError) {
                console.error(`❌ Erreur création container placeholder:`, containerError);
                throw new Error(`Container creation failed: ${containerError.message}`);
            }
            
            // Créer le contenu avec vérifications
            try {
                // Fond
                const bg = this.scene.add.graphics();
                bg.fillStyle(0x2F4F4F, 0.9);
                bg.fillRoundedRect(15, 130, width - 30, height - 200, 12);
                bg.lineStyle(2, 0x4682B4);
                bg.strokeRoundedRect(15, 130, width - 30, height - 200, 12);
                container.add(bg);
                
                // Titre
                const title = this.scene.add.text(width / 2, 200, 
                    `${panelConfig.icon} ${panelConfig.title}`, {
                    fontSize: '24px',
                    fontWeight: 'bold',
                    fill: '#FFD700',
                    align: 'center'
                }).setOrigin(0.5);
                container.add(title);
                
                // Message
                const message = this.scene.add.text(width / 2, 250, 
                    'Panel en développement\nBientôt disponible !', {
                    fontSize: '16px',
                    fill: '#B0C4DE',
                    align: 'center'
                }).setOrigin(0.5);
                container.add(message);
                
                // Bouton actualiser AVEC GESTION D'ERREUR
                const button = this.scene.add.graphics();
                button.fillStyle(0x4682B4);
                button.fillRoundedRect(width/2 - 70, 300, 140, 40, 8);
                container.add(button);
                
                const buttonText = this.scene.add.text(width / 2, 320, 
                    '🔄 Actualiser', {
                    fontSize: '14px',
                    fontWeight: 'bold',
                    fill: '#FFFFFF'
                }).setOrigin(0.5);
                container.add(buttonText);
                
                // Zone interactive AVEC TRY-CATCH
                try {
                    const hitArea = this.scene.add.zone(width/2, 320, 140, 40).setInteractive();
                    hitArea.on('pointerdown', () => {
                        console.log(`🔄 Actualisation panel ${panelId} demandée`);
                        try {
                            this.reloadPanel(panelId);
                        } catch (reloadError) {
                            console.error('❌ Erreur reload:', reloadError);
                        }
                    });
                    container.add(hitArea);
                } catch (interactiveError) {
                    console.warn('⚠️ Erreur zone interactive:', interactiveError);
                }
                
                console.log(`✅ Contenu placeholder créé pour ${panelId}`);
                
            } catch (contentError) {
                console.error(`❌ Erreur création contenu placeholder:`, contentError);
                // Container minimal de secours
                const errorText = this.scene.add.text(width / 2, height / 2, 
                    `${panelConfig.icon} ${panelConfig.title}\nErreur affichage`, {
                    fontSize: '16px',
                    fill: '#DC143C',
                    align: 'center'
                }).setOrigin(0.5);
                container.add(errorText);
            }
            
            // Créer l'objet panel avec interface standardisée
            const placeholderPanel = {
                config: {
                    name: panelId,
                    title: panelConfig.title,
                    icon: panelConfig.icon
                },
                container: container,
                isVisible: false,
                
                // Méthodes requises
                getContainer() {
                    return this.container;
                },
                
                show(animate = true) {
                    if (!this.container) return;
                    
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
                    } catch (showError) {
                        console.error(`❌ Erreur show placeholder ${panelId}:`, showError);
                    }
                },
                
                hide(animate = true) {
                    if (!this.container) return;
                    
                    try {
                        this.isVisible = false;
                        
                        if (animate) {
                            this.scene.tweens.add({
                                targets: this.container,
                                alpha: 0,
                                duration: 200,
                                onComplete: () => {
                                    if (this.container) {
                                        this.container.setVisible(false);
                                    }
                                }
                            });
                        } else {
                            this.container.setVisible(false);
                        }
                    } catch (hideError) {
                        console.error(`❌ Erreur hide placeholder ${panelId}:`, hideError);
                    }
                },
                
                isShown() {
                    return this.isVisible;
                },
                
                updateData(newData) {
                    // Pas d'action pour placeholder
                },
                
                destroy() {
                    try {
                        if (this.container) {
                            this.container.destroy();
                            this.container = null;
                        }
                    } catch (destroyError) {
                        console.error(`❌ Erreur destroy placeholder ${panelId}:`, destroyError);
                    }
                },
                
                // Référence à la scène pour les méthodes
                scene: this.scene
            };
            
            console.log(`✅ Placeholder ${panelId} créé avec succès`);
            return placeholderPanel;
            
        } catch (error) {
            console.error(`❌ Erreur création placeholder ${panelId}:`, error);
            
            // Panel de secours minimal
            return this.createMinimalPanel(panelId, panelConfig, `Placeholder error: ${error.message}`);
        }
    }
    
    /**
     * Créer un panel d'erreur ROBUSTE
     */
    createErrorPanel(panelId, panelConfig, errorMessage) {
        console.log(`🏗️ Création panel d'erreur ROBUSTE pour ${panelId}...`);
        
        try {
            // VÉRIFIER LA SCÈNE D'ABORD
            if (!this.scene || !this.scene.add) {
                throw new Error('Scène Phaser invalide pour panel erreur');
            }
            
            const { width, height } = this.scene.scale;
            
            // Créer le container avec vérifications
            let container = null;
            try {
                container = this.scene.add.container(0, 0);
                console.log(`✅ Container erreur créé pour ${panelId}`);
            } catch (containerError) {
                console.error(`❌ Erreur création container erreur:`, containerError);
                return this.createMinimalPanel(panelId, panelConfig, `Container error: ${containerError.message}`);
            }
            
            // Créer le contenu avec gestion d'erreur
            try {
                // Fond rouge pour erreur
                const bg = this.scene.add.graphics();
                bg.fillStyle(0x8B0000, 0.9);
                bg.fillRoundedRect(15, 130, width - 30, height - 200, 12);
                bg.lineStyle(2, 0xDC143C);
                bg.strokeRoundedRect(15, 130, width - 30, height - 200, 12);
                container.add(bg);
                
                // Titre erreur
                const title = this.scene.add.text(width / 2, 180, 
                    `❌ Erreur de chargement\n${panelConfig.title}`, {
                    fontSize: '18px',
                    fontWeight: 'bold',
                    fill: '#FFD700',
                    align: 'center'
                }).setOrigin(0.5);
                container.add(title);
                
                // Message d'erreur (tronqué pour éviter overflow)
                const shortError = errorMessage.length > 100 ? 
                    errorMessage.substring(0, 100) + '...' : errorMessage;
                    
                const message = this.scene.add.text(width / 2, 250, 
                    shortError, {
                    fontSize: '12px',
                    fill: '#FFB6C1',
                    align: 'center',
                    wordWrap: { width: width - 60 }
                }).setOrigin(0.5);
                container.add(message);
                
                // Bouton réessayer
                const button = this.scene.add.graphics();
                button.fillStyle(0xDC143C);
                button.fillRoundedRect(width/2 - 70, 320, 140, 40, 8);
                container.add(button);
                
                const buttonText = this.scene.add.text(width / 2, 340, 
                    '🔄 Réessayer', {
                    fontSize: '14px',
                    fontWeight: 'bold',
                    fill: '#FFFFFF'
                }).setOrigin(0.5);
                container.add(buttonText);
                
                // Zone interactive avec gestion d'erreur
                try {
                    const hitArea = this.scene.add.zone(width/2, 340, 140, 40).setInteractive();
                    hitArea.on('pointerdown', () => {
                        console.log(`🔄 Rechargement panel ${panelId} demandé après erreur`);
                        try {
                            this.reloadPanel(panelId);
                        } catch (reloadError) {
                            console.error('❌ Erreur reload après erreur:', reloadError);
                        }
                    });
                    container.add(hitArea);
                } catch (interactiveError) {
                    console.warn('⚠️ Erreur zone interactive erreur:', interactiveError);
                }
                
            } catch (contentError) {
                console.error(`❌ Erreur création contenu erreur:`, contentError);
                
                // Contenu minimal de secours
                const errorText = this.scene.add.text(width / 2, height / 2, 
                    `❌ ${panelConfig.title}\nErreur critique`, {
                    fontSize: '16px',
                    fill: '#DC143C',
                    align: 'center'
                }).setOrigin(0.5);
                container.add(errorText);
            }
            
            // Interface panel standardisée
            const errorPanel = {
                config: {
                    name: panelId,
                    title: panelConfig.title,
                    icon: panelConfig.icon
                },
                container: container,
                isVisible: false,
                
                getContainer() {
                    return this.container;
                },
                
                show(animate = true) {
                    if (!this.container) return;
                    
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
                    } catch (showError) {
                        console.error(`❌ Erreur show erreur ${panelId}:`, showError);
                    }
                },
                
                hide(animate = true) {
                    if (!this.container) return;
                    
                    try {
                        this.isVisible = false;
                        
                        if (animate) {
                            this.scene.tweens.add({
                                targets: this.container,
                                alpha: 0,
                                duration: 200,
                                onComplete: () => {
                                    if (this.container) {
                                        this.container.setVisible(false);
                                    }
                                }
                            });
                        } else {
                            this.container.setVisible(false);
                        }
                    } catch (hideError) {
                        console.error(`❌ Erreur hide erreur ${panelId}:`, hideError);
                    }
                },
                
                isShown() {
                    return this.isVisible;
                },
                
                updateData(newData) {
                    // Pas d'action pour erreur
                },
                
                destroy() {
                    try {
                        if (this.container) {
                            this.container.destroy();
                            this.container = null;
                        }
                    } catch (destroyError) {
                        console.error(`❌ Erreur destroy erreur ${panelId}:`, destroyError);
                    }
                },
                
                scene: this.scene
            };
            
            console.log(`✅ Panel d'erreur ${panelId} créé avec succès`);
            return errorPanel;
            
        } catch (error) {
            console.error(`❌ Erreur critique création panel erreur ${panelId}:`, error);
            return this.createMinimalPanel(panelId, panelConfig, `Critical error: ${error.message}`);
        }
    }
    
    /**
     * Panel minimal de dernier recours
     */
    createMinimalPanel(panelId, panelConfig, errorMessage) {
        console.log(`🆘 Création panel minimal pour ${panelId}...`);
        
        return {
            config: { name: panelId, title: panelConfig.title, icon: panelConfig.icon },
            container: null,
            isVisible: false,
            
            getContainer() {
                if (!this.container) {
                    try {
                        this.container = this.scene.add.container(0, 0);
                        const { width, height } = this.scene.scale;
                        
                        const text = this.scene.add.text(width / 2, height / 2, 
                            `🆘 ${panelConfig.title}\nErreur critique\n${errorMessage}`, {
                            fontSize: '14px',
                            fill: '#DC143C',
                            align: 'center',
                            wordWrap: { width: width - 40 }
                        }).setOrigin(0.5);
                        
                        this.container.add(text);
                    } catch (e) {
                        console.error('❌ Erreur panel minimal:', e);
                        return null;
                    }
                }
                return this.container;
            },
            
            show() { 
                try {
                    if (this.container) {
                        this.container.setVisible(true);
                        this.isVisible = true;
                    }
                } catch (e) {
                    console.error('❌ Erreur show minimal:', e);
                }
            },
            
            hide() { 
                try {
                    if (this.container) {
                        this.container.setVisible(false);
                        this.isVisible = false;
                    }
                } catch (e) {
                    console.error('❌ Erreur hide minimal:', e);
                }
            },
            
            isShown() { return this.isVisible; },
            updateData() {},
            destroy() { 
                try {
                    if (this.container) {
                        this.container.destroy();
                        this.container = null;
                    }
                } catch (e) {
                    console.error('❌ Erreur destroy minimal:', e);
                }
            },
            
            scene: this.scene
        };
    }

    // === ANIMATIONS DE TRANSITION ===
    
    async hidePanelInternal(panel, animate) {
        if (!panel || !panel.isShown()) return;
        
        try {
            if (animate && this.config.enableTransitions) {
                return new Promise(resolve => {
                    if (panel.hide) {
                        panel.hide(true);
                    }
                    setTimeout(resolve, 200);
                });
            } else {
                if (panel.hide) {
                    panel.hide(false);
                }
            }
        } catch (error) {
            console.error(`❌ Erreur hide panel:`, error);
        }
    }
    
    async showPanelInternal(panel, animate) {
        if (!panel) return;
        
        try {
            if (animate && this.config.enableTransitions) {
                return new Promise(resolve => {
                    if (panel.show) {
                        panel.show(true);
                    }
                    setTimeout(resolve, 300);
                });
            } else {
                if (panel.show) {
                    panel.show(false);
                }
            }
        } catch (error) {
            console.error(`❌ Erreur show panel:`, error);
        }
    }

    // === NAVIGATION ===
    
    createNavigation() {
        const { width, height } = this.scene.scale;
        const navHeight = 70;
        
        this.navigation = this.scene.add.container(0, height - navHeight);
        
        // Fond navigation
        const navBg = this.scene.add.graphics();
        navBg.fillGradientStyle(
            0x2F4F4F, 0x2F4F4F,
            0x1C3A3A, 0x1C3A3A,
            1
        );
        navBg.fillRect(0, 0, width, navHeight);
        navBg.lineStyle(3, 0xFFD700);
        navBg.lineBetween(0, 0, width, 0);
        
        this.navigation.add(navBg);
        
        // Boutons onglets
        const tabWidth = width / this.tabDefinitions.length;
        
        this.tabDefinitions.forEach((tab, index) => {
            const tabButton = this.createTabButton(tab, index, tabWidth, navHeight);
            this.navigation.add(tabButton);
        });
        
        // Indicateur actif
        this.createActiveIndicator(tabWidth);
        
        this.container.add(this.navigation);
    }
    
    createTabButton(tab, index, tabWidth, navHeight) {
        const x = tabWidth * index + tabWidth / 2;
        const y = navHeight / 2;
        
        const tabContainer = this.scene.add.container(x, y);
        
        // Zone cliquable
        const hitArea = this.scene.add.zone(0, 0, tabWidth, navHeight).setInteractive();
        
        // Fond onglet
        const tabBg = this.scene.add.graphics();
        this.drawTabBackground(tabBg, tabWidth, navHeight, false);
        
        // Icône
        const icon = this.scene.add.text(0, -8, tab.icon, {
            fontSize: '22px'
        }).setOrigin(0.5);
        
        // Texte
        const text = this.scene.add.text(0, 18, tab.name, {
            fontSize: this.scene.isMobile ? '9px' : '11px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF'
        }).setOrigin(0.5);
        
        tabContainer.add([hitArea, tabBg, icon, text]);
        
        // Stocker les références pour la mise à jour
        tabContainer.tabData = {
            id: tab.id,
            index: index,
            background: tabBg,
            icon: icon,
            text: text,
            width: tabWidth,
            height: navHeight
        };
        
        // Événements
        hitArea.on('pointerdown', () => {
            this.onTabClick(tab.id, index);
        });
        
        hitArea.on('pointerover', () => {
            this.onTabHover(tabContainer, true);
        });
        
        hitArea.on('pointerout', () => {
            this.onTabHover(tabContainer, false);
        });
        
        return tabContainer;
    }
    
    drawTabBackground(graphics, width, height, isActive) {
        graphics.clear();
        
        const bgWidth = width - 10;
        const bgHeight = height - 10;
        const color = isActive ? 0xFFD700 : 0x4682B4;
        const alpha = isActive ? 1 : 0.7;
        
        graphics.fillStyle(color, alpha);
        graphics.fillRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, 12);
        
        if (isActive) {
            graphics.lineStyle(2, 0xFFA500);
            graphics.strokeRoundedRect(-bgWidth/2, -bgHeight/2, bgWidth, bgHeight, 12);
        }
    }
    
    createActiveIndicator(tabWidth) {
        this.activeIndicator = this.scene.add.graphics();
        this.activeIndicator.fillStyle(0xFFD700, 1);
        
        const indicatorWidth = tabWidth * 0.6;
        const indicatorHeight = 4;
        
        this.activeIndicator.fillRoundedRect(
            -indicatorWidth/2,
            25,
            indicatorWidth,
            indicatorHeight,
            2
        );
        
        this.navigation.add(this.activeIndicator);
    }
    
    updateActiveIndicator() {
        if (!this.activeIndicator) return;
        
        const tabWidth = this.scene.scale.width / this.tabDefinitions.length;
        const targetX = tabWidth * this.state.currentIndex + tabWidth / 2;
        
        this.scene.tweens.add({
            targets: this.activeIndicator,
            x: targetX,
            duration: 300,
            ease: 'Back.easeOut'
        });
    }
    
    onTabClick(tabId, index) {
        if (this.state.isTransitioning || tabId === this.state.currentPanel) {
            return;
        }
        
        console.log(`📱 Clic onglet: ${tabId}`);
        
        // Animation de clic
        const tabButton = this.navigation.list.find(child => 
            child.tabData && child.tabData.id === tabId
        );
        
        if (tabButton) {
            this.scene.tweens.add({
                targets: [tabButton.tabData.icon, tabButton.tabData.text],
                scaleX: 0.9,
                scaleY: 0.9,
                duration: 100,
                yoyo: true,
                ease: 'Power2',
                onComplete: () => {
                    this.showPanel(tabId, true);
                }
            });
        } else {
            this.showPanel(tabId, true);
        }
    }
    
    onTabHover(tabContainer, isHovering) {
        if (!tabContainer.tabData || tabContainer.tabData.id === this.state.currentPanel) {
            return;
        }
        
        const targetScale = isHovering ? 1.1 : 1;
        
        this.scene.tweens.add({
            targets: [tabContainer.tabData.icon, tabContainer.tabData.text],
            scaleX: targetScale,
            scaleY: targetScale,
            duration: 200,
            ease: 'Back.easeOut'
        });
    }
    
    updateNavigation() {
        this.navigation.list.forEach(child => {
            if (child.tabData) {
                const isActive = child.tabData.id === this.state.currentPanel;
                
                // Mettre à jour le fond
                this.drawTabBackground(
                    child.tabData.background,
                    child.tabData.width,
                    child.tabData.height,
                    isActive
                );
                
                // Mettre à jour les couleurs
                child.tabData.icon.setTint(isActive ? 0x2F4F4F : 0xFFFFFF);
                child.tabData.text.setFill(isActive ? '#2F4F4F' : '#FFFFFF');
            }
        });
        
        // Mettre à jour l'indicateur
        this.updateActiveIndicator();
    }

    // === GESTION DES ACTIONS ===
    
    handlePanelAction(panelId, action, data) {
        console.log(`🎮 Action panel ${panelId}: ${action}`, data);
        
        // Actions spéciales gérées par le manager
        switch (action) {
            case 'switch_panel':
                this.showPanel(data.panelId);
                break;
                
            case 'reload_panel':
                this.reloadPanel(panelId);
                break;
                
            case 'update_data':
                this.updatePanelData(panelId, data);
                break;
                
            default:
                // Transmettre l'action à la scène parent
                this.config.onAction(action, { ...data, fromPanel: panelId });
        }
    }

    // === MÉTHODES PUBLIQUES ===
    
    async reloadPanel(panelId) {
        console.log(`🔄 Rechargement panel: ${panelId}`);
        
        try {
            // Supprimer le panel existant
            const existingPanel = this.panels.get(panelId);
            if (existingPanel) {
                if (existingPanel.destroy) {
                    existingPanel.destroy();
                }
                this.panels.delete(panelId);
            }
            
            // Si c'est le panel actuel, le recharger
            if (this.state.currentPanel === panelId) {
                await this.showPanel(panelId);
            }
        } catch (error) {
            console.error(`❌ Erreur rechargement panel ${panelId}:`, error);
        }
    }
    
    updateUserData(newUserData) {
        this.config.userData = newUserData;
        
        // Mettre à jour tous les panels chargés
        this.panels.forEach((panel, panelId) => {
            try {
                if (panel.updateData) {
                    panel.updateData(newUserData);
                }
            } catch (error) {
                console.error(`❌ Erreur update data panel ${panelId}:`, error);
            }
        });
        
        console.log('📊 Données utilisateur mises à jour dans tous les panels');
    }
    
    updatePanelData(panelId, data) {
        try {
            const panel = this.panels.get(panelId);
            if (panel && panel.updateData) {
                panel.updateData(data);
            }
        } catch (error) {
            console.error(`❌ Erreur update panel data ${panelId}:`, error);
        }
    }
    
    nextTab() {
        const nextIndex = (this.state.currentIndex + 1) % this.tabDefinitions.length;
        const nextTab = this.tabDefinitions[nextIndex];
        this.showPanel(nextTab.id);
    }
    
    previousTab() {
        const prevIndex = this.state.currentIndex === 0 ? 
            this.tabDefinitions.length - 1 : 
            this.state.currentIndex - 1;
        const prevTab = this.tabDefinitions[prevIndex];
        this.showPanel(prevTab.id);
    }
    
    showError(message) {
        console.error(`❌ PanelManager: ${message}`);
        
        // Utiliser le système de notification s'il existe
        if (this.scene.showMessage) {
            this.scene.showMessage(message, 'error');
        } else if (window.NotificationManager) {
            window.NotificationManager.show(message, 'error');
        } else {
            // Fallback: notification simple dans la console
            console.error(`ERREUR PANELMANAGER: ${message}`);
        }
    }

    // === HELPERS ===
    
    getCurrentPanel() {
        return this.panels.get(this.state.currentPanel);
    }
    
    getPanelIndex(panelId) {
        return this.tabDefinitions.findIndex(tab => tab.id === panelId);
    }
    
    isPanelLoaded(panelId) {
        return this.panels.has(panelId);
    }
    
    getLoadedPanels() {
        return Array.from(this.panels.keys());
    }

    // === NETTOYAGE ===
    
    destroy() {
        console.log('🗑️ Destruction PanelManager');
        
        try {
            // Détruire tous les panels
            this.panels.forEach(panel => {
                try {
                    if (panel.destroy) {
                        panel.destroy();
                    }
                } catch (destroyError) {
                    console.error('❌ Erreur destroy panel:', destroyError);
                }
            });
            this.panels.clear();
            
            // Nettoyer les promises en cours
            this.loadingPromises.clear();
            
            // Détruire le container
            if (this.container) {
                this.container.destroy();
                this.container = null;
            }
        } catch (error) {
            console.error('❌ Erreur destruction PanelManager:', error);
        }
        
        // Reset état
        this.state = {
            currentPanel: null,
            currentIndex: 0,
            isTransitioning: false,
            initialized: false
        };
    }

    // === GETTERS ===
    
    getCurrentPanelId() {
        return this.state.currentPanel;
    }
    
    getCurrentIndex() {
        return this.state.currentIndex;
    }
    
    isTransitioning() {
        return this.state.isTransitioning;
    }
    
    getContainer() {
        return this.container;
    }
    
    getTabDefinitions() {
        return [...this.tabDefinitions];
    }

    // === MÉTHODES DE DEBUG ===
    
    /**
     * Forcer le chargement d'un panel réel (pour debug)
     */
    async forceLoadRealPanel(panelId) {
        console.log(`🧪 DEBUG: Force chargement panel réel ${panelId}`);
        
        try {
            // Supprimer placeholder s'il existe
            const existingPanel = this.panels.get(panelId);
            if (existingPanel) {
                existingPanel.destroy();
                this.panels.delete(panelId);
            }
            
            // Forcer import réel
            let PanelClass = null;
            
            if (panelId === 'battle') {
                const battleModule = await import('../battle/BattlePanel.js');
                PanelClass = battleModule.default;
            } else if (panelId === 'cards') {
                const deckModule = await import('../deck/DeckPanel.js');
                PanelClass = deckModule.default;
            }
            
            if (!PanelClass) {
                throw new Error(`Classe ${panelId} non trouvée`);
            }
            
            // Créer instance
            const panelConfig = this.panelConfigs.get(panelId);
            const panelInstance = new PanelClass(this.scene, {
                name: panelId,
                title: panelConfig.title,
                icon: panelConfig.icon,
                userData: this.config.userData,
                contentStartY: panelConfig.contentStartY,
                onAction: (action, data) => this.handlePanelAction(panelId, action, data),
                ...panelConfig
            });
            
            // Ajouter au container
            const panelContainer = panelInstance.getContainer();
            if (panelContainer) {
                this.container.add(panelContainer);
                this.panels.set(panelId, panelInstance);
                
                console.log(`✅ Panel réel ${panelId} chargé avec succès !`);
                
                // Afficher si c'est le panel actuel
                if (this.state.currentPanel === panelId) {
                    await this.showPanel(panelId);
                }
                
                return true;
            } else {
                throw new Error(`Container invalide pour ${panelId}`);
            }
            
        } catch (error) {
            console.error(`❌ Erreur force load panel ${panelId}:`, error);
            return false;
        }
    }
    
    /**
     * Diagnostic complet du PanelManager
     */
    getDiagnostic() {
        return {
            state: { ...this.state },
            panelsLoaded: this.getLoadedPanels(),
            panelsConfigs: Array.from(this.panelConfigs.keys()),
            currentPanel: this.getCurrentPanelId(),
            containerValid: !!this.container,
            navigationValid: !!this.navigation,
            sceneValid: !!(this.scene && this.scene.add)
        };
    }
}

// === FONCTIONS DE DEBUG GLOBALES ===
if (typeof window !== 'undefined') {
    
    // Test force chargement panel réel
    window.forceLoadRealPanel = async (panelId) => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene?.panelManager) {
            console.log(`🧪 Force chargement panel réel: ${panelId}`);
            return await clashScene.panelManager.forceLoadRealPanel(panelId);
        } else {
            console.error('❌ PanelManager non trouvé');
            return false;
        }
    };
    
    // Diagnostic PanelManager
    window.debugPanelManager = () => {
        const gameInstance = window.ChimArenaInstance;
        const scenes = gameInstance?.game?.scene?.getScenes();
        const clashScene = scenes?.find(s => s.scene.key === 'ClashMenuScene');
        
        if (clashScene?.panelManager) {
            const diagnostic = clashScene.panelManager.getDiagnostic();
            console.group('🔍 DIAGNOSTIC PANELMANAGER');
            console.table(diagnostic);
            console.groupEnd();
            return diagnostic;
        } else {
            console.error('❌ PanelManager non trouvé pour diagnostic');
            return null;
        }
    };
    
    console.log(`
🛠️ === DEBUG PANELMANAGER DISPONIBLE ===

🔍 DIAGNOSTIC:
▶️ debugPanelManager() - État complet

🧪 TESTS:
▶️ forceLoadRealPanel('battle') - Force BattlePanel réel
▶️ forceLoadRealPanel('cards') - Force DeckPanel réel
▶️ testSwitchPanel('clan') - Tester placeholder

POUR COMMENCER: debugPanelManager()
    `);
}
