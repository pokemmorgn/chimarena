// client/src/clashmenu/utils/PanelManager.js - GESTIONNAIRE CENTRAL DES PANELS
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
    
    /**
     * Initialiser le gestionnaire
     */
    async init() {
        if (this.state.initialized) return;
        
        console.log('🏗️ Initialisation PanelManager...');
        
        // Container principal
        this.container = this.scene.add.container(0, 0);
        
        // Créer la navigation
        this.createNavigation();
        
        // Enregistrer les configurations des panels
        this.registerPanelConfigs();
        
        // Charger le panel par défaut
        await this.showPanel(this.config.defaultPanel);
        
        this.state.initialized = true;
        console.log('✅ PanelManager initialisé');
    }
    
    /**
     * Enregistrer les configurations des panels
     */
    registerPanelConfigs() {
        this.panelConfigs.set('battle', {
            title: 'BATAILLE',
            icon: '⚔️',
            module: 'battle/BattlePanel',
            className: 'BattlePanel',
            contentStartY: 120,
            enableColyseus: true
        });
        
        this.panelConfigs.set('cards', {
            title: 'CARTES',
            icon: '🃏',
            module: 'deck/DeckPanel',
            className: 'DeckPanel',
            contentStartY: 120,
            hasSubTabs: true,
            subTabs: ['collection', 'deck', 'defis'],
            defaultSubTab: 'collection'
        });
        
        this.panelConfigs.set('clan', {
            title: 'CLAN',
            icon: '🏰',
            module: 'clan/ClanPanel',
            className: 'ClanPanel',
            contentStartY: 180
        });
        
        this.panelConfigs.set('profile', {
            title: 'PROFIL',
            icon: '👤',
            module: 'profile/ProfilePanel',
            className: 'ProfilePanel',
            contentStartY: 180
        });
        
        console.log(`📝 ${this.panelConfigs.size} configurations de panels enregistrées`);
    }

    // === GESTION DES PANELS ===
    
    /**
     * Afficher un panel (avec chargement dynamique)
     */
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
            this.showError(`Erreur lors du chargement de ${panelConfig.title}`);
            return false;
        } finally {
            this.state.isTransitioning = false;
        }
    }
    
    /**
     * Charger dynamiquement un panel
     */
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
    
    /**
     * Charger le module d'un panel
     */
    async loadPanelModule(panelId, panelConfig) {
        try {
            let modulePath;
            let PanelClass;
            
            // Chemins spécifiques selon le panel
            switch (panelId) {
                case 'battle':
                    modulePath = '../battle/BattlePanel.js';
                    break;
                case 'cards':
                    modulePath = '../deck/DeckPanel.js'; // Panel cartes = DeckPanel
                    break;
                case 'clan':
                    // Pour l'instant, créer un panel placeholder
                    return this.createPlaceholderPanel(panelId, panelConfig);
                case 'profile':
                    // Pour l'instant, créer un panel placeholder
                    return this.createPlaceholderPanel(panelId, panelConfig);
                default:
                    throw new Error(`Panel ${panelId} non supporté`);
            }
            
            // Import dynamique du module
            const module = await import(modulePath);
            PanelClass = module.default || module[panelConfig.className];
            
            if (!PanelClass) {
                throw new Error(`Classe ${panelConfig.className} non trouvée`);
            }
            
            // Créer l'instance du panel
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
            
            // Ajouter au container
            this.container.add(panelInstance.getContainer());
            
            return panelInstance;
            
        } catch (error) {
            console.error(`❌ Erreur chargement module ${panelConfig.module}:`, error);
            
            // Fallback: créer un panel d'erreur
            return this.createErrorPanel(panelId, panelConfig, error.message);
        }
    }
    
    /**
     * Créer un panel placeholder pour les panels pas encore implémentés
     */
    createPlaceholderPanel(panelId, panelConfig) {
        // Import de BasePanel pour créer un placeholder
        return new (class PlaceholderPanel extends BasePanel {
            createContent() {
                this.createText(
                    this.width / 2, 100,
                    `${panelConfig.icon} ${panelConfig.title}`,
                    {
                        fontSize: '24px',
                        fontWeight: 'bold',
                        fill: '#FFD700',
                        align: 'center'
                    }
                ).setOrigin(0.5);
                
                this.createText(
                    this.width / 2, 150,
                    'Panel en développement\nBientôt disponible !',
                    {
                        fontSize: '16px',
                        fill: '#B0C4DE',
                        align: 'center'
                    }
                ).setOrigin(0.5);
                
                this.createButton(
                    this.width / 2, 220,
                    140, 40,
                    '🔄 Actualiser',
                    '#4682B4',
                    () => {
                        this.scene.panelManager?.reloadPanel(panelId);
                    }
                );
            }
        })(this.scene, {
            name: panelId,
            title: panelConfig.title,
            icon: panelConfig.icon,
            userData: this.config.userData,
            contentStartY: panelConfig.contentStartY
        });
    }
    
    /**
     * Créer un panel d'erreur en cas d'échec de chargement
     */
    createErrorPanel(panelId, panelConfig, errorMessage) {
        // Import de BasePanel pour créer un panel d'erreur basique
        const BasePanel = this.getBasePanel();
        
        return new (class ErrorPanel extends BasePanel {
            createContent() {
                this.createText(
                    this.width / 2, 100,
                    `❌ Erreur de chargement\n${panelConfig.title}`,
                    {
                        fontSize: '16px',
                        fill: '#DC143C',
                        align: 'center'
                    }
                ).setOrigin(0.5);
                
                this.createText(
                    this.width / 2, 150,
                    errorMessage,
                    {
                        fontSize: '12px',
                        fill: '#B0C4DE',
                        align: 'center',
                        wordWrap: { width: this.width - 40 }
                    }
                ).setOrigin(0.5);
                
                this.createButton(
                    this.width / 2, 220,
                    140, 40,
                    '🔄 Réessayer',
                    '#4682B4',
                    () => {
                        this.scene.panelManager?.reloadPanel(panelId);
                    }
                );
            }
        })(this.scene, {
            name: panelId,
            title: panelConfig.title,
            icon: panelConfig.icon,
            userData: this.config.userData,
            contentStartY: panelConfig.contentStartY
        });
    }
    
    /**
     * Obtenir BasePanel pour les panels d'erreur/placeholder
     */
    getBasePanel() {
        // Référence vers BasePanel (sera disponible via import)
        if (typeof BasePanel !== 'undefined') {
            return BasePanel;
        }
        
        // Fallback simple si BasePanel pas disponible
        return class SimpleBasePanel {
            constructor(scene, config) {
                this.scene = scene;
                this.config = config;
                this.container = scene.add.container(0, 0);
                this.width = scene.scale.width;
                this.height = scene.scale.height;
                this.init();
            }
            
            init() {
                this.createContent();
            }
            
            createContent() {
                // À override
            }
            
            createText(x, y, text, style) {
                return this.scene.add.text(x, y, text, style);
            }
            
            createButton(x, y, width, height, text, color, callback) {
                const button = this.scene.add.rectangle(x, y, width, height, parseInt(color.replace('#', '0x')));
                const buttonText = this.scene.add.text(x, y, text, {
                    fontSize: '14px',
                    fill: '#FFFFFF'
                }).setOrigin(0.5);
                
                button.setInteractive().on('pointerdown', callback);
                this.container.add([button, buttonText]);
                return button;
            }
            
            getContainer() {
                return this.container;
            }
            
            show() {
                this.container.setVisible(true);
            }
            
            hide() {
                this.container.setVisible(false);
            }
            
            destroy() {
                this.container.destroy();
            }
        };
    }

    // === ANIMATIONS DE TRANSITION ===
    
    /**
     * Masquer un panel avec animation
     */
    async hidePanelInternal(panel, animate) {
        if (!panel || !panel.isShown()) return;
        
        if (animate && this.config.enableTransitions) {
            return new Promise(resolve => {
                panel.playHideAnimation(resolve);
            });
        } else {
            panel.hide(false);
        }
    }
    
    /**
     * Afficher un panel avec animation
     */
    async showPanelInternal(panel, animate) {
        if (!panel) return;
        
        if (animate && this.config.enableTransitions) {
            return new Promise(resolve => {
                panel.show(true);
                // Attendre la fin de l'animation
                this.scene.time.delayedCall(300, resolve);
            });
        } else {
            panel.show(false);
        }
    }

    // === NAVIGATION ===
    
    /**
     * Créer la navigation en bas d'écran
     */
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
    
    /**
     * Créer un bouton d'onglet
     */
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
    
    /**
     * Dessiner le fond d'un onglet
     */
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
    
    /**
     * Créer l'indicateur d'onglet actif
     */
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
    
    /**
     * Mettre à jour la position de l'indicateur actif
     */
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
    
    /**
     * Gérer le clic sur un onglet
     */
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
    
    /**
     * Gérer le survol d'un onglet
     */
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
    
    /**
     * Mettre à jour l'état visuel de la navigation
     */
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
                const iconColor = isActive ? '#2F4F4F' : '#FFFFFF';
                const textColor = isActive ? '#2F4F4F' : '#FFFFFF';
                
                child.tabData.icon.setTint(isActive ? 0x2F4F4F : 0xFFFFFF);
                child.tabData.text.setFill(textColor);
            }
        });
        
        // Mettre à jour l'indicateur
        this.updateActiveIndicator();
    }

    // === GESTION DES ACTIONS ===
    
    /**
     * Gérer une action d'un panel
     */
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
                
            // === ACTIONS SPÉCIFIQUES DECK ===
            case 'switch_subtab':
                // Action interne au DeckPanel, on la laisse passer
                break;
                
            case 'save_deck':
                this.handleSaveDeck(panelId, data);
                break;
                
            case 'deck_updated':
                this.handleDeckUpdated(panelId, data);
                break;
                
            // === ACTIONS SPÉCIFIQUES BATAILLE ===
            case 'battle':
            case 'cancel_search':
            case 'training':
            case 'tournament':
            case 'leaderboard':
                // Transmettre directement à la scène pour Colyseus
                this.config.onAction(action, { ...data, fromPanel: panelId });
                break;
                
            default:
                // Transmettre l'action à la scène parent
                this.config.onAction(action, { ...data, fromPanel: panelId });
        }
    }
    
    /**
     * Gérer la sauvegarde d'un deck
     */
    handleSaveDeck(panelId, data) {
        console.log(`💾 Sauvegarde deck depuis panel ${panelId}`, data);
        
        // Mettre à jour les données utilisateur
        const userData = this.config.userData;
        if (userData) {
            // Sauvegarder le deck dans les données utilisateur
            if (!userData.decks) {
                userData.decks = {};
            }
            
            userData.decks.current = data.deck;
            userData.lastDeckUpdate = Date.now();
            
            // Notifier la scène parent
            this.config.onAction('user_data_updated', { 
                userData: userData,
                source: 'deck_save'
            });
            
            console.log('✅ Deck sauvegardé dans les données utilisateur');
        }
    }
    
    /**
     * Gérer la mise à jour d'un deck
     */
    handleDeckUpdated(panelId, data) {
        console.log(`🔄 Deck mis à jour depuis panel ${panelId}`, data);
        
        // Mettre à jour le coût élixir dans le header si nécessaire
        if (data.elixirCost !== undefined) {
            this.config.onAction('deck_cost_changed', {
                newCost: data.elixirCost,
                fromPanel: panelId
            });
        }
    }

    // === MÉTHODES PUBLIQUES ===
    
    /**
     * Recharger un panel
     */
    async reloadPanel(panelId) {
        console.log(`🔄 Rechargement panel: ${panelId}`);
        
        // Supprimer le panel existant
        const existingPanel = this.panels.get(panelId);
        if (existingPanel) {
            existingPanel.destroy();
            this.panels.delete(panelId);
        }
        
        // Si c'est le panel actuel, le recharger
        if (this.state.currentPanel === panelId) {
            await this.showPanel(panelId);
        }
    }
    
    /**
     * Mettre à jour les données utilisateur
     */
    updateUserData(newUserData) {
        this.config.userData = newUserData;
        
        // Mettre à jour tous les panels chargés
        this.panels.forEach((panel, panelId) => {
            if (panel.updateData) {
                panel.updateData(newUserData);
            }
        });
        
        console.log('📊 Données utilisateur mises à jour dans tous les panels');
    }
    
    /**
     * Mettre à jour les données d'un panel spécifique
     */
    updatePanelData(panelId, data) {
        const panel = this.panels.get(panelId);
        if (panel && panel.updateData) {
            panel.updateData(data);
        }
    }
    
    /**
     * Naviguer vers l'onglet suivant
     */
    nextTab() {
        const nextIndex = (this.state.currentIndex + 1) % this.tabDefinitions.length;
        const nextTab = this.tabDefinitions[nextIndex];
        this.showPanel(nextTab.id);
    }
    
    /**
     * Naviguer vers l'onglet précédent
     */
    previousTab() {
        const prevIndex = this.state.currentIndex === 0 ? 
            this.tabDefinitions.length - 1 : 
            this.state.currentIndex - 1;
        const prevTab = this.tabDefinitions[prevIndex];
        this.showPanel(prevTab.id);
    }
    
    /**
     * Afficher un message d'erreur global
     */
    showError(message) {
        console.error(`❌ PanelManager: ${message}`);
        
        // Utiliser le système de notification s'il existe
        if (this.scene.showMessage) {
            this.scene.showMessage(message, 'error');
        } else if (window.NotificationManager) {
            window.NotificationManager.show(message, 'error');
        }
    }

    // === HELPERS ===
    
    /**
     * Obtenir le panel actuellement affiché
     */
    getCurrentPanel() {
        return this.panels.get(this.state.currentPanel);
    }
    
    /**
     * Obtenir l'index d'un panel
     */
    getPanelIndex(panelId) {
        return this.tabDefinitions.findIndex(tab => tab.id === panelId);
    }
    
    /**
     * Vérifier si un panel est chargé
     */
    isPanelLoaded(panelId) {
        return this.panels.has(panelId);
    }
    
    /**
     * Obtenir la liste des panels chargés
     */
    getLoadedPanels() {
        return Array.from(this.panels.keys());
    }

    // === NETTOYAGE ===
    
    /**
     * Détruire le gestionnaire
     */
    destroy() {
        console.log('🗑️ Destruction PanelManager');
        
        // Détruire tous les panels
        this.panels.forEach(panel => {
            if (panel.destroy) {
                panel.destroy();
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
}
