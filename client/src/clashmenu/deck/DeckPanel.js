// client/src/clashmenu/deck/DeckPanel.js - PANEL DECK AVEC SOUS-ONGLETS
import BasePanel from '../core/BasePanel.js';
export default class DeckPanel extends BasePanel {
 
constructor(scene, config = {}) {
    super(scene, {
        name: 'DeckPanel',
        title: 'DECK',
        icon: '🛡️',
contentStartY: 200,
     enableTitle: false, // On va créer un titre custom avec sous-onglets
        ...config
    });
    
    // MAINTENANT initialiser les propriétés
    this.deckElements = {};
    this.subPanels = {};
    this.deckState = { currentSubTab: 'deck' };
    
    // Compléter l'initialisation après super()
    this.deckState.currentDeck = this.initializeDefaultDeck();
    this.deckState.selectedCard = null;
    this.deckState.filterBy = 'all';
    this.deckState.sortBy = 'cost';
    this.deckState.searchTerm = '';
    
    // Configuration des cartes
    this.cardsDatabase = this.initializeCardsDatabase();
    this.userCollection = this.initializeUserCollection();
    
    this.log('Panel Deck initialisé avec sous-onglets');
}
    
    // === IMPLÉMENTATION BASEPANEL ===
    
    /**
     * Créer le contenu du panel deck
     */
  createContent() {
    this.log('Création contenu deck avec sous-onglets...');
    
    // SOLUTION: Initialiser ici si pas déjà fait (problème d'ordre d'exécution)
    if (!this.deckElements) {
        this.deckElements = {};
    }
    if (!this.subPanels) {
        this.subPanels = {};
    }
    if (!this.deckState) {
        this.deckState = { 
            currentSubTab: 'deck',
            currentDeck: this.initializeDefaultDeck(), // ← FIX pour updateElixirCost()
            selectedCard: null,
            filterBy: 'all',
            sortBy: 'cost',
            searchTerm: ''
        };
    }
    
    // Initialiser les autres propriétés nécessaires
    if (!this.cardsDatabase) {
        this.cardsDatabase = this.initializeCardsDatabase();
    }
    if (!this.userCollection) {
        this.userCollection = this.initializeUserCollection();
    }
    
    // 1. Header custom avec sous-navigation
    this.createDeckHeader();
    
    // 2. Container pour les sous-panels
    this.createSubPanelsContainer();
    
    // 3. Créer les sous-panels
    this.createDeckSubPanel();
    this.createCollectionSubPanel();
    this.createDefisSubPanel();
    
    // 4. Afficher le premier sous-panel
    this.switchSubTab('deck');
    
    this.log('Contenu deck créé', 'success');
}
    
    /**
     * Rafraîchir les données du panel
     */
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
    
    /**
     * Gérer les actions spécifiques au deck
     */
    handleAction(action, data) {
        this.log(`Action deck: ${action}`, 'info');
        
        switch (action) {
            case 'switch_subtab':
                this.switchSubTab(data.subTab);
                break;
            case 'add_card_to_deck':
                this.addCardToDeck(data.card, data.slot);
                break;
            case 'remove_card_from_deck':
                this.removeCardFromDeck(data.slot);
                break;
            case 'select_card':
                this.selectCard(data.card);
                break;
            case 'upgrade_card':
                this.upgradeCard(data.card);
                break;
            case 'filter_collection':
                this.filterCollection(data.filter);
                break;
            case 'search_cards':
                this.searchCards(data.term);
                break;
            case 'save_deck':
                this.saveDeck();
                break;
            case 'reset_deck':
                this.resetDeck();
                break;
            case 'copy_deck':
                this.copyDeck(data.deckCode);
                break;
            default:
                super.handleAction(action, data);
        }
    }

    // === HEADER AVEC SOUS-NAVIGATION ===
    
    /**
     * Créer le header custom avec navigation des sous-onglets
     */
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
        
        this.deckElements.header = headerContainer;
        this.elements.content.add(headerContainer);
    }
    
    /**
     * Créer la sous-navigation horizontale
     */
    createSubNavigation(container) {
        const navY = 50;
        const subTabs = [
            { id: 'deck', name: 'Deck', icon: '🛡️' },
            { id: 'collection', name: 'Collection', icon: '🃏' },
            { id: 'defis', name: 'Défis', icon: '⚡' }
        ];
        
        const tabWidth = 120;
        const totalWidth = tabWidth * subTabs.length;
        const startX = this.width / 2 - totalWidth / 2;
        
        subTabs.forEach((tab, index) => {
            const x = startX + index * tabWidth + tabWidth / 2;
            
            // Container du sous-onglet
            const tabContainer = this.scene.add.container(x, navY);
            
            // Fond de l'onglet
            const tabBg = this.createGraphics();
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
            
            container.add(tabContainer);
        });

         console.log('DEBUG - this.deckElements:', this.deckElements);
    console.log('DEBUG - typeof this.deckElements:', typeof this.deckElements);
    console.log('DEBUG - container:', container);
        this.deckElements.subNavigation = container;
    }
    
    /**
     * Dessiner le fond d'un sous-onglet
     */
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
    
    /**
     * Créer l'affichage du coût élixir
     */
    createElixirDisplay(container) {
        const elixirContainer = this.scene.add.container(this.width - 80, 50);
        
        // Fond
        const elixirBg = this.createGraphics();
        elixirBg.fillStyle(0x9370DB, 0.9);
        elixirBg.fillRoundedRect(-40, -15, 80, 30, 15);
        elixirBg.lineStyle(2, 0x8A2BE2);
        elixirBg.strokeRoundedRect(-40, -15, 80, 30, 15);
        elixirContainer.add(elixirBg);
        
        // Texte coût
        this.deckElements.elixirCost = this.createText(
            0, 0,
            '⚡ 0.0',
            {
                fontSize: this.isMobile ? '12px' : '14px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            },
            elixirContainer
        );
        this.deckElements.elixirCost.setOrigin(0.5);
        
        container.add(elixirContainer);
        
        // Mettre à jour le coût initial
        this.updateElixirCost();
    }

    // === CONTAINER DES SOUS-PANELS ===
    
    /**
     * Créer le container pour les sous-panels
     */
    createSubPanelsContainer() {
        this.subPanelsContainer = this.scene.add.container(0, 90);
        this.elements.content.add(this.subPanelsContainer);
    }

    // === SOUS-PANEL DECK ===
    
    /**
     * Créer le sous-panel d'édition de deck
     */
    createDeckSubPanel() {
        const deckPanel = this.scene.add.container(0, 0);
        
        // Grille de slots de deck (4x2)
        this.createDeckSlotsGrid(deckPanel);
        
        // Boutons d'action
        this.createDeckActionButtons(deckPanel);
        
        // Informations du deck
        this.createDeckInfo(deckPanel);
        
        deckPanel.setVisible(false);
        this.subPanels.deck = deckPanel;
        this.subPanelsContainer.add(deckPanel);
    }
    
    /**
     * Créer la grille des slots de deck
     */
    createDeckSlotsGrid(container) {
        const slotSize = this.isMobile ? 50 : 60;
        const spacing = this.isMobile ? 55 : 65;
        const cols = 4;
        const rows = 2;
        
        const startX = this.width / 2 - (cols - 1) * spacing / 2;
        const startY = 60;
        
        this.deckElements.deckSlots = [];
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const slotIndex = row * cols + col;
                const x = startX + col * spacing;
                const y = startY + row * (spacing + 10);
                
                const slot = this.createDeckSlot(x, y, slotSize, slotIndex);
                this.deckElements.deckSlots.push(slot);
                container.add(slot);
            }
        }
    }
    
    /**
     * Créer un slot de deck individuel
     */
    createDeckSlot(x, y, size, index) {
        const slotContainer = this.scene.add.container(x, y);
        
        // Fond du slot
        const slotBg = this.createGraphics();
        slotBg.fillStyle(0x1C3A3A, 0.8);
        slotBg.fillRoundedRect(-size/2, -size/2, size, size, 8);
        slotBg.lineStyle(2, 0x4682B4, 0.5);
        slotBg.strokeRoundedRect(-size/2, -size/2, size, size, 8);
        slotContainer.add(slotBg);
        
        // Carte actuelle ou placeholder
        const currentCard = this.deckState.currentDeck[index];
        
        if (currentCard) {
            const cardDisplay = this.createCardDisplay(currentCard, size * 0.8);
            slotContainer.add(cardDisplay);
        } else {
            // Placeholder
            const placeholder = this.createText(
                0, 0,
                '+',
                {
                    fontSize: this.isMobile ? '20px' : '24px',
                    fill: '#708090'
                },
                slotContainer
            );
            placeholder.setOrigin(0.5);
        }
        
        // Zone interactive
        const hitArea = this.createInteractiveZone(
            0, 0, size, size,
            () => this.handleSlotClick(index),
            slotContainer
        );
        
        // Stocker les données du slot
        slotContainer.slotData = {
            index: index,
            card: currentCard,
            background: slotBg,
            size: size
        };
        
        return slotContainer;
    }
    
    /**
     * Créer les boutons d'action du deck
     */
    createDeckActionButtons(container) {
        const buttonsY = 200;
        
        // Sauvegarder
        const saveButton = this.createButton(
            this.width / 2 - 80, buttonsY,
            140, 40,
            '💾 Sauvegarder',
            '#32CD32',
            () => this.safeAction('save_deck')
        );
        
        // Réinitialiser
        const resetButton = this.createButton(
            this.width / 2 + 80, buttonsY,
            140, 40,
            '🔄 Réinitialiser',
            '#DC143C',
            () => this.safeAction('reset_deck')
        );
        
        container.add([saveButton, resetButton]);
    }
    
    /**
     * Créer les informations du deck
     */
    createDeckInfo(container) {
        if (this.isMobile) return; // Pas d'infos détaillées sur mobile
        
        const infoY = 270;
        
        // Statistiques du deck
        const deckStats = this.calculateDeckStats();
        
        const statsText = this.createText(
            this.width / 2, infoY,
            `📊 Types: ${deckStats.typeDistribution} • 🎯 Dégâts moy: ${deckStats.avgDamage} • 🛡️ Défense: ${deckStats.defenseCards}`,
            {
                fontSize: '12px',
                fill: '#B0C4DE',
                align: 'center'
            },
            container
        );
        statsText.setOrigin(0.5);
    }

    // === SOUS-PANEL COLLECTION ===
    
    /**
     * Créer le sous-panel de collection
     */
    createCollectionSubPanel() {
        const collectionPanel = this.scene.add.container(0, 0);
        
        // Barre de recherche et filtres
        this.createCollectionFilters(collectionPanel);
        
        // Grille de cartes
        this.createCollectionGrid(collectionPanel);
        
        collectionPanel.setVisible(false);
        this.subPanels.collection = collectionPanel;
        this.subPanelsContainer.add(collectionPanel);
    }
    
    /**
     * Créer les filtres de la collection
     */
    createCollectionFilters(container) {
        const filtersY = 20;
        
        // Barre de recherche
        const searchBg = this.createGraphics();
        searchBg.fillStyle(0x2F2F2F, 0.9);
        searchBg.fillRoundedRect(20, filtersY, this.width - 40, 30, 15);
        searchBg.lineStyle(1, 0x4682B4);
        searchBg.strokeRoundedRect(20, filtersY, this.width - 40, 30, 15);
        container.add(searchBg);
        
        const searchPlaceholder = this.createText(
            this.width / 2, filtersY + 15,
            '🔍 Rechercher une carte...',
            {
                fontSize: '12px',
                fill: '#708090'
            },
            container
        );
        searchPlaceholder.setOrigin(0.5);
        
        // Filtres par rareté
        const filterY = filtersY + 45;
        const filters = [
            { id: 'all', name: 'Toutes', color: 0x708090 },
            { id: 'common', name: 'Communes', color: 0x808080 },
            { id: 'rare', name: 'Rares', color: 0x4169E1 },
            { id: 'epic', name: 'Épiques', color: 0x9370DB },
            { id: 'legendary', name: 'Légendaires', color: 0xFFD700 }
        ];
        
        const filterWidth = 70;
        const totalFiltersWidth = filterWidth * filters.length;
        const filtersStartX = this.width / 2 - totalFiltersWidth / 2;
        
        filters.forEach((filter, index) => {
            const x = filtersStartX + index * filterWidth + filterWidth / 2;
            
            const filterButton = this.createFilterButton(
                x, filterY,
                filterWidth - 5, 25,
                filter.name,
                filter.color,
                filter.id === this.deckState.filterBy,
                () => this.safeAction('filter_collection', { filter: filter.id })
            );
            
            container.add(filterButton);
        });
        
        this.deckElements.filters = container;
    }
    
    /**
     * Créer un bouton de filtre
     */
    createFilterButton(x, y, width, height, text, color, isActive, callback) {
        const buttonContainer = this.scene.add.container(x, y);
        
        const bg = this.createGraphics();
        const alpha = isActive ? 1 : 0.6;
        const borderColor = isActive ? 0xFFFFFF : color;
        
        bg.fillStyle(color, alpha);
        bg.fillRoundedRect(-width/2, -height/2, width, height, 6);
        bg.lineStyle(1, borderColor);
        bg.strokeRoundedRect(-width/2, -height/2, width, height, 6);
        buttonContainer.add(bg);
        
        const buttonText = this.createText(
            0, 0,
            text,
            {
                fontSize: '10px',
                fontWeight: 'bold',
                fill: isActive ? '#FFFFFF' : '#E0E0E0'
            },
            buttonContainer
        );
        buttonText.setOrigin(0.5);
        
        // Zone interactive
        const hitArea = this.createInteractiveZone(
            0, 0, width, height,
            callback,
            buttonContainer
        );
        
        return buttonContainer;
    }
    
    /**
     * Créer la grille de cartes de la collection
     */
    createCollectionGrid(container) {
        const gridStartY = 90;
        const cardSize = this.isMobile ? 40 : 50;
        const spacing = this.isMobile ? 45 : 55;
        const cols = this.isMobile ? 5 : 6;
        
        // Récupérer les cartes filtrées
        const filteredCards = this.getFilteredCards();
        
        // Créer la grille scrollable
        this.createScrollableCardGrid(container, filteredCards, gridStartY, cardSize, spacing, cols);
    }
    
    /**
     * Créer une grille de cartes scrollable
     */
    createScrollableCardGrid(container, cards, startY, cardSize, spacing, cols) {
        const rows = Math.ceil(cards.length / cols);
        const maxVisibleRows = this.isMobile ? 4 : 5;
        const gridHeight = maxVisibleRows * spacing;
        
        // Container de scroll
        const scrollContainer = this.scene.add.container(0, startY);
        const gridMask = this.scene.add.graphics();
        gridMask.fillStyle(0xFFFFFF);
        gridMask.fillRect(10, 0, this.width - 20, gridHeight);
        scrollContainer.setMask(gridMask.createGeometryMask());
        
        // Grille de cartes
        const cardsContainer = this.scene.add.container(0, 0);
        
        const startX = this.width / 2 - (cols - 1) * spacing / 2;
        
        cards.forEach((card, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            const x = startX + col * spacing;
            const y = row * spacing;
            
            const cardDisplay = this.createCollectionCardDisplay(card, x, y, cardSize);
            cardsContainer.add(cardDisplay);
        });
        
        scrollContainer.add(cardsContainer);
        container.add(scrollContainer);
        
        // Système de scroll si nécessaire
        if (rows > maxVisibleRows) {
            this.setupCardGridScroll(scrollContainer, cardsContainer, gridHeight, rows * spacing);
        }
        
        this.deckElements.collectionGrid = scrollContainer;
    }
    
    /**
     * Créer l'affichage d'une carte dans la collection
     */
    createCollectionCardDisplay(card, x, y, size) {
        const cardContainer = this.scene.add.container(x, y);
        
        // Fond de carte avec couleur de rareté
        const cardBg = this.createGraphics();
        const rarityColor = this.getRarityColor(card.rarity);
        cardBg.fillStyle(rarityColor, 0.8);
        cardBg.fillRoundedRect(-size/2, -size/2, size, size, 6);
        cardBg.lineStyle(2, rarityColor);
        cardBg.strokeRoundedRect(-size/2, -size/2, size, size, 6);
        cardContainer.add(cardBg);
        
        // Icône de la carte
        const cardIcon = this.createText(
            0, -8,
            card.icon,
            { fontSize: this.isMobile ? '16px' : '20px' },
            cardContainer
        );
        cardIcon.setOrigin(0.5);
        
        // Niveau et quantité
        const userCard = this.userCollection.find(uc => uc.id === card.id);
        const level = userCard?.level || 1;
        const count = userCard?.count || 0;
        
        const levelText = this.createText(
            0, 12,
            `${level}`,
            {
                fontSize: '10px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            },
            cardContainer
        );
        levelText.setOrigin(0.5);
        
        // Indicateur de quantité
        if (count > 0) {
            const countText = this.createText(
                size/2 - 5, -size/2 + 5,
                count.toString(),
                {
                    fontSize: '8px',
                    fontWeight: 'bold',
                    fill: '#32CD32'
                },
                cardContainer
            );
            countText.setOrigin(1, 0);
        }
        
        // Zone interactive
        const hitArea = this.createInteractiveZone(
            0, 0, size, size,
            () => this.handleCollectionCardClick(card),
            cardContainer
        );
        
        // Effet hover
        hitArea.on('pointerover', () => {
            cardContainer.setScale(1.1);
        });
        
        hitArea.on('pointerout', () => {
            cardContainer.setScale(1);
        });
        
        // Stocker les données
        cardContainer.cardData = {
            card: card,
            userCard: userCard,
            background: cardBg
        };
        
        return cardContainer;
    }

    // === SOUS-PANEL DÉFIS ===
    
    /**
     * Créer le sous-panel des défis
     */
    createDefisSubPanel() {
        const defisPanel = this.scene.add.container(0, 0);
        
        // Message temporaire
        const comingSoonText = this.createText(
            this.width / 2, 100,
            '⚡ DÉFIS\n\nDécks spéciaux et défis\nBientôt disponibles !',
            {
                fontSize: this.isMobile ? '14px' : '16px',
                fill: '#B0C4DE',
                align: 'center'
            },
            defisPanel
        );
        comingSoonText.setOrigin(0.5);
        
        // Placeholder défis
        this.createDefisPlaceholders(defisPanel);
        
        defisPanel.setVisible(false);
        this.subPanels.defis = defisPanel;
        this.subPanelsContainer.add(defisPanel);
    }
    
    /**
     * Créer des placeholders pour les défis
     */
    createDefisPlaceholders(container) {
        const defis = [
            { name: 'Défi Classic', icon: '⚔️', reward: '100 🏆' },
            { name: 'Défi Grand', icon: '👑', reward: '1000 💰' },
            { name: 'Défi Légendaire', icon: '💎', reward: 'Carte Légendaire' }
        ];
        
        const startY = 180;
        const spacing = 60;
        
        defis.forEach((defi, index) => {
            const y = startY + index * spacing;
            
            // Fond du défi
            const defiBg = this.createGraphics();
            defiBg.fillStyle(0x1C3A3A, 0.8);
            defiBg.fillRoundedRect(20, y - 20, this.width - 40, 40, 8);
            defiBg.lineStyle(1, 0x4682B4);
            defiBg.strokeRoundedRect(20, y - 20, this.width - 40, 40, 8);
            container.add(defiBg);
            
            // Infos du défi
            const defiText = this.createText(
                this.width / 2, y,
                `${defi.icon} ${defi.name} - Récompense: ${defi.reward}`,
                {
                    fontSize: '12px',
                    fontWeight: 'bold',
                    fill: '#B0C4DE'
                },
                container
            );
            defiText.setOrigin(0.5);
        });
    }

    // === GESTION DES SOUS-ONGLETS ===
    
    /**
     * Basculer vers un sous-onglet
     */
    switchSubTab(subTabId) {
        if (subTabId === this.deckState.currentSubTab) return;
        
        this.log(`Basculement vers sous-onglet: ${subTabId}`);
        
        // Masquer le sous-panel actuel
        if (this.subPanels[this.deckState.currentSubTab]) {
            this.subPanels[this.deckState.currentSubTab].setVisible(false);
        }
        
        // Afficher le nouveau sous-panel
        if (this.subPanels[subTabId]) {
            this.subPanels[subTabId].setVisible(true);
        }
        
        // Mettre à jour l'état
        this.deckState.currentSubTab = subTabId;
        
        // Mettre à jour la navigation visuelle
        this.updateSubNavigation();
        
        // Actions spécifiques selon le sous-onglet
        switch (subTabId) {
            case 'collection':
                this.refreshCollectionGrid();
                break;
            case 'deck':
                this.refreshDeckSlots();
                break;
        }
    }
    
    /**
     * Mettre à jour la navigation visuelle
     */
    updateSubNavigation() {
        if (!this.deckElements.subNavigation) return;
        
        this.deckElements.subNavigation.list.forEach(tabContainer => {
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

    // === GESTION DES CARTES ===
    
    /**
     * Gérer le clic sur un slot de deck
     */
    handleSlotClick(slotIndex) {
        this.log(`Clic slot deck: ${slotIndex}`);
        
        const currentCard = this.deckState.currentDeck[slotIndex];
        
        if (currentCard) {
            // Retirer la carte du deck
            this.safeAction('remove_card_from_deck', { slot: slotIndex });
        } else {
            // Basculer vers la collection pour choisir une carte
            this.switchSubTab('collection');
            this.deckState.selectedSlot = slotIndex;
        }
    }
    
    /**
     * Gérer le clic sur une carte de la collection
     */
    handleCollectionCardClick(card) {
        this.log(`Clic carte collection: ${card.name}`);
        
        if (this.deckState.selectedSlot !== undefined) {
            // Ajouter la carte au slot sélectionné
            this.safeAction('add_card_to_deck', { 
                card: card, 
                slot: this.deckState.selectedSlot 
            });
            this.deckState.selectedSlot = undefined;
            this.switchSubTab('deck');
        } else {
            // Sélectionner/afficher les détails de la carte
            this.safeAction('select_card', { card: card });
        }
    }
    
    /**
     * Ajouter une carte au deck
     */
    addCardToDeck(card, slotIndex) {
        if (slotIndex < 0 || slotIndex >= 8) {
            this.log('Index de slot invalide', 'error');
            return;
        }
        
        // Vérifier si la carte est déjà dans le deck
        const existingSlot = this.deckState.currentDeck.findIndex(c => c && c.id === card.id);
        if (existingSlot !== -1) {
            this.showError('Cette carte est déjà dans le deck');
            return;
        }
        
        // Ajouter la carte
        this.deckState.currentDeck[slotIndex] = { ...card };
        
        // Rafraîchir l'affichage
        this.refreshDeckSlot(slotIndex);
        this.updateElixirCost();
        
        this.log(`Carte ${card.name} ajoutée au slot ${slotIndex}`, 'success');
    }
    
    /**
     * Retirer une carte du deck
     */
    removeCardFromDeck(slotIndex) {
        if (slotIndex < 0 || slotIndex >= 8) {
            this.log('Index de slot invalide', 'error');
            return;
        }
        
        const removedCard = this.deckState.currentDeck[slotIndex];
        this.deckState.currentDeck[slotIndex] = null;
        
        // Rafraîchir l'affichage
        this.refreshDeckSlot(slotIndex);
        this.updateElixirCost();
        
        this.log(`Carte ${removedCard?.name} retirée du slot ${slotIndex}`, 'success');
    }
    
    /**
     * Sélectionner une carte
     */
    selectCard(card) {
        this.deckState.selectedCard = card;
        this.showCardDetails(card);
    }
    
    /**
     * Améliorer une carte
     */
    upgradeCard(card) {
        this.log(`Amélioration carte: ${card.name}`);
        // TODO: Implémenter système d'amélioration
        this.showMessage('Amélioration de cartes - En développement', 'info');
    }

    // === FILTRES ET RECHERCHE ===
    
    /**
     * Filtrer la collection
     */
    filterCollection(filter) {
        this.deckState.filterBy = filter;
        this.refreshCollectionGrid();
        this.log(`Filtre appliqué: ${filter}`);
    }
    
    /**
     * Rechercher des cartes
     */
    searchCards(searchTerm) {
        this.deckState.searchTerm = searchTerm.toLowerCase();
        this.refreshCollectionGrid();
        this.log(`Recherche: "${searchTerm}"`);
    }
    
    /**
     * Obtenir les cartes filtrées
     */
    getFilteredCards() {
        let filteredCards = [...this.cardsDatabase];
        
        // Filtre par rareté
        if (this.deckState.filterBy !== 'all') {
            filteredCards = filteredCards.filter(card => 
                card.rarity === this.deckState.filterBy
            );
        }
        
        // Filtre par recherche
        if (this.deckState.searchTerm) {
            filteredCards = filteredCards.filter(card =>
                card.name.toLowerCase().includes(this.deckState.searchTerm) ||
                card.type.toLowerCase().includes(this.deckState.searchTerm)
            );
        }
        
        // Tri
        filteredCards.sort((a, b) => {
            switch (this.deckState.sortBy) {
                case 'cost':
                    return a.cost - b.cost;
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'rarity':
                    const rarityOrder = { common: 0, rare: 1, epic: 2, legendary: 3 };
                    return rarityOrder[a.rarity] - rarityOrder[b.rarity];
                default:
                    return 0;
            }
        });
        
        return filteredCards;
    }

    // === MISE À JOUR AFFICHAGE ===
    
    /**
     * Rafraîchir la grille de collection
     */
    refreshCollectionGrid() {
        if (!this.deckElements.collectionGrid) return;
        
        // Détruire l'ancienne grille
        this.deckElements.collectionGrid.destroy();
        
        // Recréer avec les nouvelles données
        const collectionPanel = this.subPanels.collection;
        this.createCollectionGrid(collectionPanel);
    }
    
    /**
     * Rafraîchir tous les slots de deck
     */
    refreshDeckSlots() {
        this.deckElements.deckSlots.forEach((slot, index) => {
            this.refreshDeckSlot(index);
        });
    }
    
    /**
     * Rafraîchir un slot de deck spécifique
     */
    refreshDeckSlot(slotIndex) {
        const slot = this.deckElements.deckSlots[slotIndex];
        if (!slot) return;
        
        // Nettoyer le contenu actuel (sauf le fond)
        slot.list.slice(1).forEach(child => child.destroy());
        
        const currentCard = this.deckState.currentDeck[slotIndex];
        const size = slot.slotData.size;
        
        if (currentCard) {
            // Afficher la carte
            const cardDisplay = this.createCardDisplay(currentCard, size * 0.8);
            slot.add(cardDisplay);
        } else {
            // Afficher le placeholder
            const placeholder = this.createText(
                0, 0,
                '+',
                {
                    fontSize: this.isMobile ? '20px' : '24px',
                    fill: '#708090'
                },
                slot
            );
            placeholder.setOrigin(0.5);
        }
        
        // Mettre à jour les données
        slot.slotData.card = currentCard;
    }
    
    /**
     * Mettre à jour le coût en élixir
     */
    updateElixirCost() {
        if (!this.deckElements.elixirCost) return;
        
        const totalCost = this.deckState.currentDeck
            .filter(card => card !== null)
            .reduce((sum, card) => sum + (card.cost || 0), 0);
        
        const cardCount = this.deckState.currentDeck.filter(card => card !== null).length;
        const avgCost = cardCount > 0 ? (totalCost / cardCount).toFixed(1) : '0.0';
        
        this.deckElements.elixirCost.setText(`⚡ ${avgCost}`);
        
        // Changer la couleur selon le coût
        if (avgCost > 4.5) {
            this.deckElements.elixirCost.setFill('#FF6347'); // Rouge si trop cher
        } else if (avgCost < 2.5) {
            this.deckElements.elixirCost.setFill('#32CD32'); // Vert si peu cher
        } else {
            this.deckElements.elixirCost.setFill('#FFFFFF'); // Blanc normal
        }
    }
    
    /**
     * Rafraîchir le sous-panel actuel
     */
    refreshCurrentSubPanel() {
        switch (this.deckState.currentSubTab) {
            case 'deck':
                this.refreshDeckSlots();
                break;
            case 'collection':
                this.refreshCollectionGrid();
                break;
            case 'defis':
                // Pas de rafraîchissement nécessaire pour l'instant
                break;
        }
    }

    // === ACTIONS DE DECK ===
    
    /**
     * Sauvegarder le deck
     */
    saveDeck() {
        // Vérifier que le deck est complet
        const cardCount = this.deckState.currentDeck.filter(card => card !== null).length;
        
        if (cardCount < 8) {
            this.showError(`Deck incomplet ! ${8 - cardCount} cartes manquantes`);
            return;
        }
        
        // Sauvegarder dans les données utilisateur
        const userData = this.getUserData();
        if (userData) {
            userData.currentDeck = [...this.deckState.currentDeck];
            this.updateData(userData);
        }
        
        this.showMessage('Deck sauvegardé avec succès !', 'success');
        this.log('Deck sauvegardé', 'success');
    }
    
    /**
     * Réinitialiser le deck
     */
    resetDeck() {
        const confirm = window.confirm('Êtes-vous sûr de vouloir réinitialiser le deck ?');
        if (!confirm) return;
        
        this.deckState.currentDeck = this.initializeDefaultDeck();
        this.refreshDeckSlots();
        this.updateElixirCost();
        
        this.showMessage('Deck réinitialisé', 'info');
        this.log('Deck réinitialisé');
    }
    
    /**
     * Copier un deck depuis un code
     */
    copyDeck(deckCode) {
        this.log(`Copie deck depuis code: ${deckCode}`);
        // TODO: Implémenter système de codes de deck
        this.showMessage('Import de deck - En développement', 'info');
    }

    // === UTILITAIRES ===
    
    /**
     * Créer l'affichage d'une carte
     */
    createCardDisplay(card, size) {
        const cardContainer = this.scene.add.container(0, 0);
        
        // Fond avec couleur de rareté
        const cardBg = this.createGraphics();
        const rarityColor = this.getRarityColor(card.rarity);
        cardBg.fillStyle(rarityColor, 0.9);
        cardBg.fillRoundedRect(-size/2, -size/2, size, size, 6);
        cardBg.lineStyle(2, rarityColor);
        cardBg.strokeRoundedRect(-size/2, -size/2, size, size, 6);
        cardContainer.add(cardBg);
        
        // Icône
        const cardIcon = this.createText(
            0, -size/4,
            card.icon,
            { fontSize: `${size * 0.4}px` },
            cardContainer
        );
        cardIcon.setOrigin(0.5);
        
        // Coût en élixir
        const costBg = this.createGraphics();
        costBg.fillStyle(0x9370DB, 1);
        costBg.fillCircle(-size/2 + 8, -size/2 + 8, 8);
        cardContainer.add(costBg);
        
        const costText = this.createText(
            -size/2 + 8, -size/2 + 8,
            card.cost.toString(),
            {
                fontSize: '10px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            },
            cardContainer
        );
        costText.setOrigin(0.5);
        
        // Niveau
        const levelText = this.createText(
            0, size/4,
            `Niv. ${card.level || 1}`,
            {
                fontSize: '8px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            },
            cardContainer
        );
        levelText.setOrigin(0.5);
        
        return cardContainer;
    }
    
    /**
     * Obtenir la couleur selon la rareté
     */
    getRarityColor(rarity) {
        const colors = {
            common: 0x808080,     // Gris
            rare: 0x4169E1,       // Bleu
            epic: 0x9370DB,       // Violet
            legendary: 0xFFD700   // Or
        };
        return colors[rarity] || colors.common;
    }
    
    /**
     * Calculer les statistiques du deck
     */
    calculateDeckStats() {
        const cards = this.deckState.currentDeck.filter(card => card !== null);
        
        // Distribution par type
        const types = {};
        cards.forEach(card => {
            types[card.type] = (types[card.type] || 0) + 1;
        });
        
        const typeDistribution = Object.entries(types)
            .map(([type, count]) => `${type}: ${count}`)
            .join(', ');
        
        // Dégâts moyens (simulé)
        const avgDamage = Math.floor(cards.reduce((sum, card) => sum + (card.damage || 100), 0) / cards.length) || 0;
        
        // Cartes de défense
        const defenseCards = cards.filter(card => card.type === 'défense').length;
        
        return {
            typeDistribution,
            avgDamage,
            defenseCards
        };
    }
    
    /**
     * Configurer le scroll de la grille
     */
    setupCardGridScroll(scrollContainer, cardsContainer, gridHeight, totalHeight) {
        let isDragging = false;
        let startY = 0;
        let currentY = 0;
        
        // Zone de scroll invisible
        const scrollZone = this.scene.add.zone(
            this.width / 2, gridHeight / 2, 
            this.width, gridHeight
        ).setInteractive();
        
        scrollZone.on('pointerdown', (pointer) => {
            isDragging = true;
            startY = pointer.y;
            currentY = cardsContainer.y;
        });
        
        scrollZone.on('pointermove', (pointer) => {
            if (!isDragging) return;
            
            const deltaY = pointer.y - startY;
            const newY = currentY + deltaY;
            const maxY = Math.max(0, totalHeight - gridHeight);
            
            cardsContainer.y = Phaser.Math.Clamp(newY, -maxY, 0);
        });
        
        scrollZone.on('pointerup', () => {
            isDragging = false;
        });
        
        scrollContainer.add(scrollZone);
    }
    
    /**
     * Afficher les détails d'une carte
     */
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

    // === INITIALISATION DES DONNÉES ===
    
    /**
     * Initialiser un deck par défaut
     */
    initializeDefaultDeck() {
        return new Array(8).fill(null);
    }
    
    /**
     * Initialiser la base de données des cartes
     */
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
    
    /**
     * Initialiser la collection utilisateur
     */
    initializeUserCollection() {
        // Simuler la collection de l'utilisateur
        return this.cardsDatabase.map(card => ({
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
    
    /**
     * Mettre à jour la collection utilisateur
     */
    updateUserCollection() {
        const userData = this.getUserData();
        if (userData?.collection) {
            this.userCollection = userData.collection;
        }
    }

    // === NETTOYAGE ===
    
    /**
     * Nettoyer les ressources
     */
    destroy() {
        this.log('Destruction panel deck');
        
        // Nettoyer les sous-panels
        Object.values(this.subPanels).forEach(panel => {
            if (panel) {
                panel.destroy();
            }
        });
        
        // Nettoyer les références
        Object.keys(this.deckElements).forEach(key => {
            this.deckElements[key] = null;
        });
        
        Object.keys(this.subPanels).forEach(key => {
            this.subPanels[key] = null;
        });
        
        super.destroy();
    }

    // === API PUBLIQUE ===
    
    /**
     * Obtenir le deck actuel
     */
    getCurrentDeck() {
        return [...this.deckState.currentDeck];
    }
    
    /**
     * Définir un nouveau deck
     */
    setDeck(newDeck) {
        if (!Array.isArray(newDeck) || newDeck.length !== 8) {
            this.log('Deck invalide', 'error');
            return false;
        }
        
        this.deckState.currentDeck = [...newDeck];
        this.refreshDeckSlots();
        this.updateElixirCost();
        return true;
    }
    
    /**
     * Obtenir l'état du panel
     */
    getDeckState() {
        return { ...this.deckState };
    }
    
    /**
     * Forcer le basculement vers un sous-onglet
     */
    switchToSubTab(subTabId) {
        this.switchSubTab(subTabId);
    }
}
