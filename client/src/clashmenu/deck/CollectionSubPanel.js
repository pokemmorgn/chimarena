// client/src/clashmenu/deck/CollectionSubPanel.js - SOUS-ONGLET COLLECTION
export default class CollectionSubPanel {
    constructor(parentPanel, scene, config = {}) {
        this.parentPanel = parentPanel;
        this.scene = scene;
        this.container = null;
        
        // Configuration
        this.config = {
            userData: config.userData || null,
            onAction: config.onAction || (() => {}),
            cardsDatabase: config.cardsDatabase || [],
            userCollection: config.userCollection || [],
            ...config
        };
        
        // État du filtre
        this.filterState = {
            filterBy: 'all',
            sortBy: 'cost',
            searchTerm: ''
        };
        
        // Dimensions
        this.width = scene.scale.width;
        this.height = scene.scale.height;
        this.isMobile = scene.isMobile || false;
        
        // Éléments UI
        this.elements = {
            filters: null,
            searchBar: null,
            collectionGrid: null,
            scrollContainer: null
        };
        
        this.create();
    }
    
    create() {
        this.container = this.scene.add.container(0, 0);
        
        // Barre de recherche et filtres
        this.createCollectionFilters();
        
        // Grille de cartes
        this.createCollectionGrid();
        
        console.log('🃏 CollectionSubPanel créé');
    }
    
    // === FILTRES ET RECHERCHE ===
    
    createCollectionFilters() {
        const filtersY = 20;
        
        // Barre de recherche
        const searchBg = this.scene.add.graphics();
        searchBg.fillStyle(0x2F2F2F, 0.9);
        searchBg.fillRoundedRect(20, filtersY, this.width - 40, 30, 15);
        searchBg.lineStyle(1, 0x4682B4);
        searchBg.strokeRoundedRect(20, filtersY, this.width - 40, 30, 15);
        this.container.add(searchBg);
        
        const searchPlaceholder = this.scene.add.text(
            this.width / 2, filtersY + 15,
            '🔍 Rechercher une carte...',
            {
                fontSize: '12px',
                fill: '#708090'
            }
        ).setOrigin(0.5);
        this.container.add(searchPlaceholder);
        
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
                filter.id === this.filterState.filterBy,
                () => this.handleFilterChange(filter.id)
            );
            
            this.container.add(filterButton);
        });
        
        this.elements.filters = this.container;
    }
    
    createFilterButton(x, y, width, height, text, color, isActive, callback) {
        const buttonContainer = this.scene.add.container(x, y);
        
        const bg = this.scene.add.graphics();
        const alpha = isActive ? 1 : 0.6;
        const borderColor = isActive ? 0xFFFFFF : color;
        
        bg.fillStyle(color, alpha);
        bg.fillRoundedRect(-width/2, -height/2, width, height, 6);
        bg.lineStyle(1, borderColor);
        bg.strokeRoundedRect(-width/2, -height/2, width, height, 6);
        buttonContainer.add(bg);
        
        const buttonText = this.scene.add.text(
            0, 0,
            text,
            {
                fontSize: '10px',
                fontWeight: 'bold',
                fill: isActive ? '#FFFFFF' : '#E0E0E0'
            }
        ).setOrigin(0.5);
        buttonContainer.add(buttonText);
        
        // Zone interactive
        const hitArea = this.scene.add.zone(0, 0, width, height).setInteractive();
        hitArea.on('pointerdown', callback);
        buttonContainer.add(hitArea);
        
        // Stocker références pour mise à jour
        buttonContainer.filterData = {
            id: text.toLowerCase(),
            background: bg,
            text: buttonText,
            color: color,
            width: width,
            height: height
        };
        
        return buttonContainer;
    }
    
    // === GRILLE DE CARTES ===
    
    createCollectionGrid() {
        const gridStartY = 90;
        const cardSize = this.isMobile ? 40 : 50;
        const spacing = this.isMobile ? 45 : 55;
        const cols = this.isMobile ? 5 : 6;
        
        // Récupérer les cartes filtrées
        const filteredCards = this.getFilteredCards();
        
        // Créer la grille scrollable
        this.createScrollableCardGrid(filteredCards, gridStartY, cardSize, spacing, cols);
    }
    
    createScrollableCardGrid(cards, startY, cardSize, spacing, cols) {
        const rows = Math.ceil(cards.length / cols);
        const maxVisibleRows = this.isMobile ? 4 : 5;
        const gridHeight = maxVisibleRows * spacing;
        
        // Container de scroll
        this.elements.scrollContainer = this.scene.add.container(0, startY);
        
        // Masque pour le scroll
        const gridMask = this.scene.add.graphics();
        gridMask.fillStyle(0xFFFFFF);
        gridMask.fillRect(10, 0, this.width - 20, gridHeight);
        this.elements.scrollContainer.setMask(gridMask.createGeometryMask());
        
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
        
        this.elements.scrollContainer.add(cardsContainer);
        this.container.add(this.elements.scrollContainer);
        
        // Système de scroll si nécessaire
        if (rows > maxVisibleRows) {
            this.setupCardGridScroll(this.elements.scrollContainer, cardsContainer, gridHeight, rows * spacing);
        }
        
        this.elements.collectionGrid = this.elements.scrollContainer;
    }
    
    createCollectionCardDisplay(card, x, y, size) {
        const cardContainer = this.scene.add.container(x, y);
        
        // Fond de carte avec couleur de rareté
        const cardBg = this.scene.add.graphics();
        const rarityColor = this.getRarityColor(card.rarity);
        cardBg.fillStyle(rarityColor, 0.8);
        cardBg.fillRoundedRect(-size/2, -size/2, size, size, 6);
        cardBg.lineStyle(2, rarityColor);
        cardBg.strokeRoundedRect(-size/2, -size/2, size, size, 6);
        cardContainer.add(cardBg);
        
        // Icône de la carte
        const cardIcon = this.scene.add.text(
            0, -8,
            card.icon,
            { fontSize: this.isMobile ? '16px' : '20px' }
        ).setOrigin(0.5);
        cardContainer.add(cardIcon);
        
        // Niveau et quantité
        const userCard = this.config.userCollection.find(uc => uc.id === card.id);
        const level = userCard?.level || 1;
        const count = userCard?.count || 0;
        
        const levelText = this.scene.add.text(
            0, 12,
            `${level}`,
            {
                fontSize: '10px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            }
        ).setOrigin(0.5);
        cardContainer.add(levelText);
        
        // Indicateur de quantité
        if (count > 0) {
            const countText = this.scene.add.text(
                size/2 - 5, -size/2 + 5,
                count.toString(),
                {
                    fontSize: '8px',
                    fontWeight: 'bold',
                    fill: '#32CD32'
                }
            ).setOrigin(1, 0);
            cardContainer.add(countText);
        }
        
        // Zone interactive
        const hitArea = this.scene.add.zone(0, 0, size, size).setInteractive();
        hitArea.on('pointerdown', () => this.handleCardClick(card));
        cardContainer.add(hitArea);
        
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
    
    // === GESTION DES ÉVÉNEMENTS ===
    
    handleFilterChange(filterId) {
        this.filterState.filterBy = filterId;
        this.refreshCollectionGrid();
        this.updateFilterButtons();
        
        if (this.config.onAction) {
            this.config.onAction('filter_collection', { filter: filterId });
        }
        
        console.log(`🔍 Filtre appliqué: ${filterId}`);
    }
    
    handleSearchChange(searchTerm) {
        this.filterState.searchTerm = searchTerm.toLowerCase();
        this.refreshCollectionGrid();
        
        if (this.config.onAction) {
            this.config.onAction('search_cards', { term: searchTerm });
        }
        
        console.log(`🔍 Recherche: "${searchTerm}"`);
    }
    
    handleCardClick(card) {
        if (this.config.onAction) {
            this.config.onAction('collection_card_clicked', { card: card });
        }
        
        console.log(`🃏 Carte cliquée: ${card.name}`);
    }
    
    // === LOGIQUE DE FILTRAGE ===
    
    getFilteredCards() {
        let filteredCards = [...this.config.cardsDatabase];
        
        // Filtre par rareté
        if (this.filterState.filterBy !== 'all') {
            filteredCards = filteredCards.filter(card => 
                card.rarity === this.filterState.filterBy
            );
        }
        
        // Filtre par recherche
        if (this.filterState.searchTerm) {
            filteredCards = filteredCards.filter(card =>
                card.name.toLowerCase().includes(this.filterState.searchTerm) ||
                card.type.toLowerCase().includes(this.filterState.searchTerm)
            );
        }
        
        // Tri
        filteredCards.sort((a, b) => {
            switch (this.filterState.sortBy) {
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
    
    // === SCROLL ===
    
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
    
    // === UTILITAIRES ===
    
    getRarityColor(rarity) {
        const colors = {
            common: 0x808080,     // Gris
            rare: 0x4169E1,       // Bleu
            epic: 0x9370DB,       // Violet
            legendary: 0xFFD700   // Or
        };
        return colors[rarity] || colors.common;
    }
    
    // === MISE À JOUR ===
    
    refreshCollectionGrid() {
        if (!this.elements.collectionGrid) return;
        
        // Détruire l'ancienne grille
        this.elements.collectionGrid.destroy();
        
        // Recréer avec les nouvelles données
        this.createCollectionGrid();
    }
    
    updateFilterButtons() {
        if (!this.elements.filters) return;
        
        this.elements.filters.list.forEach(child => {
            if (child.filterData) {
                const isActive = child.filterData.id === this.filterState.filterBy;
                
                // Mettre à jour le fond
                child.filterData.background.clear();
                const alpha = isActive ? 1 : 0.6;
                const borderColor = isActive ? 0xFFFFFF : child.filterData.color;
                
                child.filterData.background.fillStyle(child.filterData.color, alpha);
                child.filterData.background.fillRoundedRect(
                    -child.filterData.width/2, -child.filterData.height/2, 
                    child.filterData.width, child.filterData.height, 6
                );
                child.filterData.background.lineStyle(1, borderColor);
                child.filterData.background.strokeRoundedRect(
                    -child.filterData.width/2, -child.filterData.height/2, 
                    child.filterData.width, child.filterData.height, 6
                );
                
                // Mettre à jour le texte
                child.filterData.text.setFill(isActive ? '#FFFFFF' : '#E0E0E0');
            }
        });
    }
    
    updateData(newData) {
        if (newData.cardsDatabase) {
            this.config.cardsDatabase = newData.cardsDatabase;
        }
        
        if (newData.userCollection) {
            this.config.userCollection = newData.userCollection;
        }
        
        this.refreshCollectionGrid();
    }
    
    // === MÉTHODES PUBLIQUES ===
    
    show() {
        if (this.container) {
            this.container.setVisible(true);
        }
    }
    
    hide() {
        if (this.container) {
            this.container.setVisible(false);
        }
    }
    
    getContainer() {
        return this.container;
    }
    
    setFilterBy(filter) {
        this.handleFilterChange(filter);
    }
    
    setSearchTerm(term) {
        this.handleSearchChange(term);
    }
    
    setSortBy(sortType) {
        this.filterState.sortBy = sortType;
        this.refreshCollectionGrid();
    }
    
    // === NETTOYAGE ===
    
    destroy() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        
        // Nettoyer les références
        Object.keys(this.elements).forEach(key => {
            this.elements[key] = null;
        });
        
        console.log('🗑️ CollectionSubPanel détruit');
    }
}
