// client/src/clashmenu/deck/DeckPanel.js - VERSION REFACTORISÉE AVEC SOUS-ONGLETS SÉPARÉS
import BasePanel from '../core/BasePanel.js';
import CollectionSubPanel from './CollectionSubPanel.js';
import DeckEditSubPanel from './DeckEditSubPanel.js';
import ChallengesSubPanel from './ChallengesSubPanel.js';

export default class DeckPanel extends BasePanel {
    constructor(scene, config = {}) {
        // SOLUTION CORRECTE: Appeler super() en PREMIER, puis initialiser
        super(scene, {
            name: 'DeckPanel',
            title: 'DECK',
            icon: '🛡️',
            contentStartY: 200,
            enableTitle: false,
            enableBackground: false,
            // Flag spécial pour éviter l'auto-création de contenu
            skipAutoInit: true,
            ...config
        });
        
        // MAINTENANT on peut initialiser les propriétés
        this.deckState = {
            currentSubTab: 'deck',
            currentDeck: this.initializeDefaultDeck(),
            selectedCard: null,
            selectedSlot: null
        };
        
        this.subPanels = {
            collection: null,
            deck: null,
            challenges: null
        };
        
        this.headerElements = {
            navigation: null,
            elixirDisplay: null
        };
        
        this.subPanelsContainer = null;
        
        // Configuration des cartes
        this.cardsDatabase = this.initializeCardsDatabase();
        this.userCollection = this.initializeUserCollection();
        
        // FORCER l'initialisation maintenant que tout est prêt
        // Note: On assume que BasePanel a un flag skipAutoInit
        // Sinon on peut simplement appeler createContent() directement
        try {
            if (!this.isInitialized) {
                this.createContent();
                this.isInitialized = true;
            }
        } catch (error) {
            console.error('❌ Erreur initialisation DeckPanel:', error);
            // Fallback: créer un contenu minimal
            this.createFallbackContent();
        }
        
        this.log('Panel Deck refactorisé initialisé');
    }
    
    // === IMPLÉMENTATION BASEPANEL ===
    
    createContent() {
        this.log('Création contenu deck refactorisé...');
        
        // SOLUTION ROBUSTE: Vérifier et initialiser si nécessaire
        if (!this.headerElements) {
            this.headerElements = {
                navigation: null,
                elixirDisplay: null
            };
        }
        
        if (!this.subPanels) {
            this.subPanels = {
                collection: null,
                deck: null,
                challenges: null
            };
        }
        
        // 1. Header custom avec sous-navigation
        this.createDeckHeader();
        
        // 2. Container pour les sous-panels
        this.createSubPanelsContainer();
        
        // 3. Initialiser les sous-panels
        this.initializeSubPanels();
        
        // 4. Afficher le sous-panel par défaut
        this.switchSubTab('deck');
        
        this.log('Contenu deck refactorisé créé', 'success');
    }
    
    refresh() {
        super.refresh();
        
        this.log('Rafraîchissement données deck...');
        
        // Mettre à jour la collection utilisateur
        this.updateUserCollection();
        
        // Recalculer le coût élixir
        this.updateElixirCost();
        
        // Rafraîchir le sous-panel actuel
        this.refreshCurrentSubPanel();
    }
    
    handleAction(action, data) {
        this.log(`Action deck: ${action}`, 'info');
        
        switch (action) {
            case 'switch_subtab':
                this.switchSubTab(data.subTab);
                break;
                
            // Actions de la collection
            case 'collection_card_clicked':
                this.handleCollectionCardClick(data.card);
                break;
            case 'filter_collection':
                this.forwardToSubPanel('collection', 'setFilterBy', data.filter);
                break;
            case 'search_cards':
                this.forwardToSubPanel('collection', 'setSearchTerm', data.term);
                break;
                
            // Actions du deck
            case 'open_card_selection':
                this.openCardSelection(data.slotIndex);
                break;
            case 'card_added':
            case 'card_removed':
                this.updateElixirCost();
                break;
            case 'deck_stats_changed':
                this.updateElixirCost();
                break;
            case 'save_deck':
                this.saveDeck(data.deck);
                break;
            case 'reset_deck':
                this.resetDeck();
                break;
            case 'paste_deck':
                this.handlePasteDeck(data.deck, data.code);
                break;
                
            // Actions des défis
            case 'start_challenge':
                this.startChallenge(data.challenge);
                break;
            case 'continue_challenge':
                this.continueChallenge(data.challenge);
                break;
            case 'abandon_challenge':
                this.abandonChallenge(data.challenge);
                break;
                
            default:
                super.handleAction(action, data);
        }
    }
    
    // === HEADER AVEC SOUS-NAVIGATION ===
    
    createDeckHeader() {
        const headerContainer = this.scene.add.container(0, 0);
        
        // Titre principal
        const mainTitle = this.createText(
            this.width / 2, 20,
            '🛡️ DECK',
            {
                fontSize: this.isMobile ? '18px' : '22px',
                fontWeight: 'bold',
                fill: '#FFD700',
                stroke: '#8B4513',
                strokeThickness: 2
            },
            headerContainer
        );
        mainTitle.setOrigin(0.5);
        
        // Sous-navigation horizontale
        this.createSubNavigation(headerContainer);
        
        // Coût élixir (affiché en permanence)
        this.createElixirDisplay(headerContainer);
        
        this.headerElements.container = headerContainer;
        this.elements.content.add(headerContainer);
    }
    
    createSubNavigation(container) {
        const navY = 50;
        const subTabs = [
            { id: 'deck', name: 'Deck', icon: '🛡️' },
            { id: 'collection', name: 'Collection', icon: '🃏' },
            { id: 'challenges', name: 'Défis', icon: '⚡' }
        ];
        
        const tabWidth = 120;
        const totalWidth = tabWidth * subTabs.length;
        const startX = this.width / 2 - totalWidth / 2;
        
        const navigationContainer = this.scene.add.container(0, 0);
        
        subTabs.forEach((tab, index) => {
            const x = startX + index * tabWidth + tabWidth / 2;
            
            // Container du sous-onglet
            const tabContainer = this.scene.add.container(x, navY);
            
            // Fond de l'onglet
            const tabBg = this.scene.add.graphics();
            this.drawSubTabBackground(tabBg, tabWidth, tab.id === (this.deckState?.currentSubTab || 'deck'));
            tabContainer.add(tabBg);
            
            // Icône
            const icon = this.createText(
                0, -8,
                tab.icon,
                { fontSize: this.isMobile ? '16px' : '18px' },
                tabContainer
            );
            icon.setOrigin(0.5);
            
            // Texte
            const text = this.createText(
                0, 12,
                tab.name,
                {
                    fontSize: this.isMobile ? '10px' : '12px',
                    fontWeight: 'bold',
                    fill: tab.id === (this.deckState?.currentSubTab || 'deck') ? '#2F4F4F' : '#FFFFFF'
                },
                tabContainer
            );
            text.setOrigin(0.5);
            
            // Zone interactive
            const hitArea = this.createInteractiveZone(
                0, 0, tabWidth, 40,
                () => this.safeAction('switch_subtab', { subTab: tab.id }),
                tabContainer
            );
            
            // Stocker les références
            tabContainer.tabData = {
                id: tab.id,
                background: tabBg,
                icon: icon,
                text: text,
                width: tabWidth
            };
            
            navigationContainer.add(tabContainer);
        });
        
        this.headerElements.navigation = navigationContainer;
        container.add(navigationContainer);
    }
    
    drawSubTabBackground(graphics, width, isActive) {
        graphics.clear();
        
        const height = 35;
        const color = isActive ? 0xFFD700 : 0x4682B4;
        const alpha = isActive ? 1 : 0.7;
        
        graphics.fillStyle(color, alpha);
        graphics.fillRoundedRect(-width/2, -height/2, width, height, 8);
        
        if (isActive) {
            graphics.lineStyle(2, 0xFFA500);
            graphics.strokeRoundedRect(-width/2, -height/2, width, height, 8);
        }
    }
    
    createElixirDisplay(container) {
        const elixirContainer = this.scene.add.container(this.width - 80, 50);
        
        // Fond
        const elixirBg = this.scene.add.graphics();
        elixirBg.fillStyle(0x9370DB, 0.9);
        elixirBg.fillRoundedRect(-40, -15, 80, 30, 15);
        elixirBg.lineStyle(2, 0x8A2BE2);
        elixirBg.strokeRoundedRect(-40, -15, 80, 30, 15);
        elixirContainer.add(elixirBg);
        
        // Texte coût
        this.headerElements.elixirCost = this.createText(
            0, 0,
            '⚡ 0.0',
            {
                fontSize: this.isMobile ? '12px' : '14px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            },
            elixirContainer
        );
        this.headerElements.elixirCost.setOrigin(0.5);
        
        container.add(elixirContainer);
        
        // Mettre à jour le coût initial
        this.updateElixirCost();
    }
    
    // === CONTAINER DES SOUS-PANELS ===
    
    createSubPanelsContainer() {
        this.subPanelsContainer = this.scene.add.container(0, 90);
        this.elements.content.add(this.subPanelsContainer);
    }
    
    // === INITIALISATION DES SOUS-PANELS ===
    
    initializeSubPanels() {
        // Panel Collection
        this.subPanels.collection = new CollectionSubPanel(this, this.scene, {
            userData: this.config.userData,
            cardsDatabase: this.cardsDatabase,
            userCollection: this.userCollection,
            onAction: (action, data) => this.handleAction(action, data)
        });
        
        // Panel Deck Edit
        this.subPanels.deck = new DeckEditSubPanel(this, this.scene, {
            userData: this.config.userData,
            currentDeck: this.deckState.currentDeck,
            onAction: (action, data) => this.handleAction(action, data)
        });
        
        // Panel Challenges
        this.subPanels.challenges = new ChallengesSubPanel(this, this.scene, {
            userData: this.config.userData,
            onAction: (action, data) => this.handleAction(action, data)
        });
        
        // Ajouter tous les containers au container principal
        Object.values(this.subPanels).forEach(subPanel => {
            if (subPanel && subPanel.getContainer()) {
                this.subPanelsContainer.add(subPanel.getContainer());
            }
        });
        
        this.log('Sous-panels initialisés', 'success');
    }
    
    // === GESTION DES SOUS-ONGLETS ===
    
    switchSubTab(subTabId) {
        if (subTabId === this.deckState.currentSubTab) return;
        
        this.log(`Basculement vers sous-onglet: ${subTabId}`);
        
        // Masquer le sous-panel actuel
        const currentSubPanel = this.subPanels[this.deckState.currentSubTab];
        if (currentSubPanel && currentSubPanel.hide) {
            currentSubPanel.hide();
        }
        
        // Afficher le nouveau sous-panel
        const newSubPanel = this.subPanels[subTabId];
        if (newSubPanel && newSubPanel.show) {
            newSubPanel.show();
        }
        
        // Mettre à jour l'état
        this.deckState.currentSubTab = subTabId;
        
        // Mettre à jour la navigation visuelle
        this.updateSubNavigation();
        
        // Actions spécifiques selon le sous-onglet
        switch (subTabId) {
            case 'collection':
                this.refreshCollectionData();
                break;
            case 'deck':
                this.refreshDeckData();
                break;
            case 'challenges':
                this.refreshChallengesData();
                break;
        }
    }
    
    updateSubNavigation() {
        if (!this.headerElements.navigation) return;
        
        this.headerElements.navigation.list.forEach(tabContainer => {
            if (tabContainer.tabData) {
                const isActive = tabContainer.tabData.id === this.deckState.currentSubTab;
                
                // Mettre à jour le fond
                this.drawSubTabBackground(
                    tabContainer.tabData.background,
                    tabContainer.tabData.width,
                    isActive
                );
                
                // Mettre à jour les couleurs du texte
                tabContainer.tabData.text.setFill(isActive ? '#2F4F4F' : '#FFFFFF');
                tabContainer.tabData.icon.setTint(isActive ? 0x2F4F4F : 0xFFFFFF);
            }
        });
    }
    
    // === ACTIONS INTER-PANELS ===
    
    handleCollectionCardClick(card) {
        if (this.deckState.selectedSlot !== undefined) {
            // Ajouter la carte au slot sélectionné
            const deckPanel = this.subPanels.deck;
            if (deckPanel && deckPanel.addCardToDeck) {
                const success = deckPanel.addCardToDeck(card, this.deckState.selectedSlot);
                if (success) {
                    this.deckState.selectedSlot = undefined;
                    this.switchSubTab('deck');
                }
            }
        } else {
            // Afficher les détails de la carte
            this.showCardDetails(card);
        }
    }
    
    openCardSelection(slotIndex) {
        this.deckState.selectedSlot = slotIndex;
        this.switchSubTab('collection');
        
        // Optionnel: Mettre en évidence qu'on est en mode sélection
        this.showMessage('Sélectionnez une carte à ajouter au deck', 'info');
    }
    
    forwardToSubPanel(panelId, method, ...args) {
        const subPanel = this.subPanels[panelId];
        if (subPanel && typeof subPanel[method] === 'function') {
            subPanel[method](...args);
        }
    }
    
    // === ACTIONS DE DECK ===
    
    saveDeck(deck) {
        // Mettre à jour le deck actuel
        this.deckState.currentDeck = [...deck];
        
        // Sauvegarder dans les données utilisateur
        const userData = this.getUserData();
        if (userData) {
            userData.currentDeck = [...deck];
            this.updateData(userData);
        }
        
        this.showMessage('Deck sauvegardé avec succès !', 'success');
        this.log('Deck sauvegardé dans les données utilisateur', 'success');
    }
    
    resetDeck() {
        this.deckState.currentDeck = this.initializeDefaultDeck();
        
        // Mettre à jour le sous-panel deck
        const deckPanel = this.subPanels.deck;
        if (deckPanel && deckPanel.setCurrentDeck) {
            deckPanel.setCurrentDeck(this.deckState.currentDeck);
        }
        
        this.updateElixirCost();
        this.log('Deck réinitialisé');
    }
    
    handlePasteDeck(deck, code) {
        this.deckState.currentDeck = [...deck];
        
        // Mettre à jour le sous-panel deck
        const deckPanel = this.subPanels.deck;
        if (deckPanel && deckPanel.setCurrentDeck) {
            deckPanel.setCurrentDeck(this.deckState.currentDeck);
        }
        
        this.updateElixirCost();
        this.log(`Deck importé depuis code: ${code}`);
    }
    
    // === ACTIONS DE DÉFIS ===
    
    startChallenge(challenge) {
        this.log(`Démarrage défi: ${challenge.name}`);
        
        // Ici on pourrait changer de scène vers le combat
        // ou notifier le parent pour démarrer un combat avec le deck du défi
        if (this.config.onAction) {
            this.config.onAction('start_challenge_battle', {
                challenge: challenge,
                deck: challenge.deck
            });
        }
        
        this.showMessage(`Défi "${challenge.name}" en cours...`, 'info');
    }
    
    continueChallenge(challenge) {
        this.log(`Continuation défi: ${challenge.name}`);
        
        if (this.config.onAction) {
            this.config.onAction('continue_challenge_battle', {
                challenge: challenge
            });
        }
    }
    
    abandonChallenge(challenge) {
        this.log(`Abandon défi: ${challenge.name}`);
        
        if (this.config.onAction) {
            this.config.onAction('abandon_challenge', {
                challenge: challenge
            });
        }
        
        // Rafraîchir le panel des défis
        this.refreshChallengesData();
    }
    
    // === MISE À JOUR DES DONNÉES ===
    
    refreshCollectionData() {
        const collectionPanel = this.subPanels.collection;
        if (collectionPanel && collectionPanel.updateData) {
            collectionPanel.updateData({
                cardsDatabase: this.cardsDatabase,
                userCollection: this.userCollection
            });
        }
    }
    
    refreshDeckData() {
        const deckPanel = this.subPanels.deck;
        if (deckPanel && deckPanel.updateData) {
            deckPanel.updateData({
                currentDeck: this.deckState.currentDeck,
                userData: this.config.userData
            });
        }
    }
    
    refreshChallengesData() {
        const challengesPanel = this.subPanels.challenges;
        if (challengesPanel && challengesPanel.updateData) {
            challengesPanel.updateData({
                userData: this.config.userData
            });
        }
    }
    
    refreshCurrentSubPanel() {
        switch (this.deckState.currentSubTab) {
            case 'collection':
                this.refreshCollectionData();
                break;
            case 'deck':
                this.refreshDeckData();
                break;
            case 'challenges':
                this.refreshChallengesData();
                break;
        }
    }
    
    updateElixirCost() {
        if (!this.headerElements.elixirCost) return;
        
        // PROTECTION: Vérifier que deckState et currentDeck existent
        if (!this.deckState || !this.deckState.currentDeck) {
            // Affichage par défaut si pas encore initialisé
            this.headerElements.elixirCost.setText('⚡ 0.0');
            this.headerElements.elixirCost.setFill('#FFFFFF');
            return;
        }
        
        const totalCost = this.deckState.currentDeck
            .filter(card => card !== null)
            .reduce((sum, card) => sum + (card.cost || 0), 0);
        
        const cardCount = this.deckState.currentDeck.filter(card => card !== null).length;
        const avgCost = cardCount > 0 ? (totalCost / cardCount).toFixed(1) : '0.0';
        
        this.headerElements.elixirCost.setText(`⚡ ${avgCost}`);
        
        // Changer la couleur selon le coût
        if (avgCost > 4.5) {
            this.headerElements.elixirCost.setFill('#FF6347'); // Rouge si trop cher
        } else if (avgCost < 2.5) {
            this.headerElements.elixirCost.setFill('#32CD32'); // Vert si peu cher
        } else {
            this.headerElements.elixirCost.setFill('#FFFFFF'); // Blanc normal
        }
    }
    
    updateUserCollection() {
        const userData = this.getUserData();
        if (userData?.collection) {
            this.userCollection = userData.collection;
        }
    }
    
    // === UTILITAIRES ===
    
    showCardDetails(card) {
        // Modal simple pour les détails
        const { width, height } = this.scene.scale;
        
        // Overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(1000);
        overlay.setInteractive();
        
        // Panel de détails
        const panelWidth = Math.min(width - 40, 300);
        const panelHeight = 400;
        
        const detailPanel = this.scene.add.graphics();
        detailPanel.fillStyle(0x2F4F4F, 1);
        detailPanel.fillRoundedRect(
            width/2 - panelWidth/2, height/2 - panelHeight/2,
            panelWidth, panelHeight, 15
        );
        detailPanel.lineStyle(3, this.getRarityColor(card.rarity));
        detailPanel.strokeRoundedRect(
            width/2 - panelWidth/2, height/2 - panelHeight/2,
            panelWidth, panelHeight, 15
        );
        detailPanel.setDepth(1001);
        
        // Contenu de la carte
        const cardTitle = this.scene.add.text(width/2, height/2 - 150, card.name, {
            fontSize: '20px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5).setDepth(1002);
        
        const cardIcon = this.scene.add.text(width/2, height/2 - 100, card.icon, {
            fontSize: '60px'
        }).setOrigin(0.5).setDepth(1002);
        
        const cardInfo = this.scene.add.text(width/2, height/2 - 20, 
            `Coût: ⚡${card.cost}\nType: ${card.type}\nRareté: ${card.rarity}\n\n${card.description}`, {
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            fill: '#FFFFFF',
            align: 'center',
            wordWrap: { width: panelWidth - 40 }
        }).setOrigin(0.5).setDepth(1002);
        
        // Bouton fermer
        const closeBtn = this.scene.add.text(width/2, height/2 + 150, '❌ Fermer', {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5).setDepth(1002).setInteractive();
        
        const elementsToDestroy = [overlay, detailPanel, cardTitle, cardIcon, cardInfo, closeBtn];
        
        const closeModal = () => {
            elementsToDestroy.forEach(element => element.destroy());
        };
        
        closeBtn.on('pointerdown', closeModal);
        overlay.on('pointerdown', closeModal);
    }
    
    getRarityColor(rarity) {
        const colors = {
            common: 0x808080,     // Gris
            rare: 0x4169E1,       // Bleu
            epic: 0x9370DB,       // Violet
            legendary: 0xFFD700   // Or
        };
        return colors[rarity] || colors.common;
    }
    
    showMessage(message, type = 'info') {
        const colors = {
            success: '#32CD32',
            error: '#DC143C',
            info: '#4682B4',
            warning: '#FFD700'
        };
        
        const notification = this.scene.add.text(
            this.width / 2, 100,
            message,
            {
                fontSize: '14px',
                fontWeight: 'bold',
                fill: colors[type] || colors.info,
                backgroundColor: '#000000',
                padding: { x: 15, y: 8 }
            }
        ).setOrigin(0.5).setDepth(1000);
        
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
    }
    
    // === INITIALISATION DES DONNÉES (MÉTHODES STATIQUES) ===
    
    initializeDefaultDeck() {
        return new Array(8).fill(null);
    }
    
    initializeCardsDatabase() {
        return [
            // Cartes communes
            { id: 'knight', name: 'Chevalier', icon: '🗡️', cost: 3, rarity: 'common', type: 'troupe', damage: 150, description: 'Un brave chevalier avec une épée.' },
            { id: 'archers', name: 'Archers', icon: '🏹', cost: 3, rarity: 'common', type: 'troupe', damage: 80, description: 'Deux archers précis à distance.' },
            { id: 'barbarians', name: 'Barbares', icon: '🪓', cost: 5, rarity: 'common', type: 'troupe', damage: 120, description: 'Quatre barbares sauvages.' },
            { id: 'minions', name: 'Gargouilles', icon: '🦇', cost: 3, rarity: 'common', type: 'troupe', damage: 90, description: 'Trois créatures volantes.' },
            { id: 'spear_goblins', name: 'Gobelins à lance', icon: '🏹', cost: 2, rarity: 'common', type: 'troupe', damage: 60, description: 'Trois gobelins avec des lances.' },
            { id: 'goblins', name: 'Gobelins', icon: '⚔️', cost: 2, rarity: 'common', type: 'troupe', damage: 80, description: 'Trois gobelins rapides.' },
            
            // Cartes rares
            { id: 'fireball', name: 'Boule de feu', icon: '🔥', cost: 4, rarity: 'rare', type: 'sort', damage: 250, description: 'Une boule de feu dévastatrice.' },
            { id: 'giant', name: 'Géant', icon: '🧿', cost: 5, rarity: 'rare', type: 'troupe', damage: 200, description: 'Un géant lent mais costaud.' },
            { id: 'wizard', name: 'Sorcier', icon: '🧙', cost: 5, rarity: 'rare', type: 'troupe', damage: 180, description: 'Un sorcier qui lance des sorts.' },
            { id: 'musketeer', name: 'Mousquetaire', icon: '🔫', cost: 4, rarity: 'rare', type: 'troupe', damage: 150, description: 'Une tireuse d\'élite précise.' },
            
            // Cartes épiques
            { id: 'pekka', name: 'P.E.K.K.A', icon: '🤖', cost: 7, rarity: 'epic', type: 'troupe', damage: 400, description: 'Un robot de guerre redoutable.' },
            { id: 'baby_dragon', name: 'Dragon bébé', icon: '🐲', cost: 4, rarity: 'epic', type: 'troupe', damage: 160, description: 'Un petit dragon volant.' },
            { id: 'lightning', name: 'Foudre', icon: '⚡', cost: 6, rarity: 'epic', type: 'sort', damage: 350, description: 'Foudroie les ennemis les plus forts.' },
            
            // Cartes légendaires
            { id: 'ice_wizard', name: 'Sorcier de glace', icon: '❄️', cost: 3, rarity: 'legendary', type: 'troupe', damage: 80, description: 'Ralentit et gèle les ennemis.' },
            { id: 'princess', name: 'Princesse', icon: '👸', cost: 3, rarity: 'legendary', type: 'troupe', damage: 100, description: 'Tire des flèches à très longue portée.' },
            { id: 'lava_hound', name: 'Molosse de lave', icon: '🌋', cost: 7, rarity: 'legendary', type: 'troupe', damage: 50, description: 'Se transforme en chiots de lave.' }
        ];
    }
    
    initializeUserCollection() {
        // S'assurer que cardsDatabase existe
        const cardsDb = this.cardsDatabase || this.initializeCardsDatabase();
        
        // Simuler la collection de l'utilisateur
        return cardsDb.map(card => ({
            id: card.id,
            level: card.rarity === 'legendary' ? 1 : 
                   card.rarity === 'epic' ? Math.floor(Math.random() * 3) + 1 :
                   card.rarity === 'rare' ? Math.floor(Math.random() * 5) + 1 :
                   Math.floor(Math.random() * 8) + 1,
            count: card.rarity === 'legendary' ? Math.floor(Math.random() * 3) :
                   card.rarity === 'epic' ? Math.floor(Math.random() * 20) + 1 :
                   card.rarity === 'rare' ? Math.floor(Math.random() * 50) + 1 :
                   Math.floor(Math.random() * 100) + 10
        }));
    }
    
    // === MÉTHODES PUBLIQUES ===
    
    getCurrentDeck() {
        return [...this.deckState.currentDeck];
    }
    
    setDeck(newDeck) {
        if (!Array.isArray(newDeck) || newDeck.length !== 8) {
            this.log('Deck invalide', 'error');
            return false;
        }
        
        this.deckState.currentDeck = [...newDeck];
        this.refreshDeckData();
        this.updateElixirCost();
        return true;
    }
    
    getDeckState() {
        return { ...this.deckState };
    }
    
    switchToSubTab(subTabId) {
        this.switchSubTab(subTabId);
    }
    
    updateData(newData) {
        super.updateData(newData);
        
        // Mettre à jour tous les sous-panels
        Object.values(this.subPanels).forEach(subPanel => {
            if (subPanel && subPanel.updateData) {
                subPanel.updateData(newData);
            }
        });
        
        // Mettre à jour les données locales
        if (newData.currentDeck) {
            this.deckState.currentDeck = newData.currentDeck;
        }
        
        if (newData.collection) {
            this.userCollection = newData.collection;
        }
        
        this.updateElixirCost();
    }
    
    // === NETTOYAGE ===
    
    destroy() {
        this.log('Destruction panel deck refactorisé');
        
        // Détruire les sous-panels
        Object.values(this.subPanels).forEach(subPanel => {
            if (subPanel && subPanel.destroy) {
                subPanel.destroy();
            }
        });
        
        // Nettoyer les références
        Object.keys(this.subPanels).forEach(key => {
            this.subPanels[key] = null;
        });
        
        Object.keys(this.headerElements).forEach(key => {
            this.headerElements[key] = null;
        });
        
        super.destroy();
    }
}
