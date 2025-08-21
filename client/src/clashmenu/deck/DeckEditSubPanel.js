// client/src/clashmenu/deck/DeckEditSubPanel.js - SOUS-ONGLET ÉDITION DECK
export default class DeckEditSubPanel {
    constructor(parentPanel, scene, config = {}) {
        this.parentPanel = parentPanel;
        this.scene = scene;
        this.container = null;
        
        // Configuration
        this.config = {
            userData: config.userData || null,
            onAction: config.onAction || (() => {}),
            currentDeck: config.currentDeck || new Array(8).fill(null),
            ...config
        };
        
        // Dimensions
        this.width = scene.scale.width;
        this.height = scene.scale.height;
        this.isMobile = scene.isMobile || false;
        
        // Éléments UI
        this.elements = {
            deckSlots: [],
            actionButtons: null,
            deckInfo: null,
            elixirDisplay: null
        };
        
        this.create();
    }
    
    create() {
        this.container = this.scene.add.container(0, 0);
        
        // Grille de slots de deck (4x2)
        this.createDeckSlotsGrid();
        
        // Boutons d'action
        this.createDeckActionButtons();
        
        // Informations du deck
        this.createDeckInfo();
        
        console.log('🛡️ DeckEditSubPanel créé');
    }
    
    // === GRILLE DES SLOTS DE DECK ===
    
    createDeckSlotsGrid() {
        const slotSize = this.isMobile ? 50 : 60;
        const spacing = this.isMobile ? 55 : 65;
        const cols = 4;
        const rows = 2;
        
        const startX = this.width / 2 - (cols - 1) * spacing / 2;
        const startY = 60;
        
        this.elements.deckSlots = [];
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const slotIndex = row * cols + col;
                const x = startX + col * spacing;
                const y = startY + row * (spacing + 10);
                
                const slot = this.createDeckSlot(x, y, slotSize, slotIndex);
                this.elements.deckSlots.push(slot);
                this.container.add(slot);
            }
        }
    }
    
    createDeckSlot(x, y, size, index) {
        const slotContainer = this.scene.add.container(x, y);
        
        // Fond du slot
        const slotBg = this.scene.add.graphics();
        slotBg.fillStyle(0x1C3A3A, 0.8);
        slotBg.fillRoundedRect(-size/2, -size/2, size, size, 8);
        slotBg.lineStyle(2, 0x4682B4, 0.5);
        slotBg.strokeRoundedRect(-size/2, -size/2, size, size, 8);
        slotContainer.add(slotBg);
        
        // Carte actuelle ou placeholder
        const currentCard = this.config.currentDeck[index];
        
        if (currentCard) {
            const cardDisplay = this.createCardDisplay(currentCard, size * 0.8);
            slotContainer.add(cardDisplay);
        } else {
            // Placeholder
            const placeholder = this.scene.add.text(
                0, 0,
                '+',
                {
                    fontSize: this.isMobile ? '20px' : '24px',
                    fill: '#708090'
                }
            ).setOrigin(0.5);
            slotContainer.add(placeholder);
        }
        
        // Zone interactive
        const hitArea = this.scene.add.zone(0, 0, size, size).setInteractive();
        hitArea.on('pointerdown', () => this.handleSlotClick(index));
        slotContainer.add(hitArea);
        
        // Effet hover
        hitArea.on('pointerover', () => {
            slotContainer.setScale(1.05);
            if (!currentCard) {
                slotBg.lineStyle(2, 0xFFD700, 0.8);
                slotBg.strokeRoundedRect(-size/2, -size/2, size, size, 8);
            }
        });
        
        hitArea.on('pointerout', () => {
            slotContainer.setScale(1);
            if (!currentCard) {
                slotBg.lineStyle(2, 0x4682B4, 0.5);
                slotBg.strokeRoundedRect(-size/2, -size/2, size, size, 8);
            }
        });
        
        // Stocker les données du slot
        slotContainer.slotData = {
            index: index,
            card: currentCard,
            background: slotBg,
            size: size
        };
        
        return slotContainer;
    }
    
    createCardDisplay(card, size) {
        const cardContainer = this.scene.add.container(0, 0);
        
        // Fond avec couleur de rareté
        const cardBg = this.scene.add.graphics();
        const rarityColor = this.getRarityColor(card.rarity);
        cardBg.fillStyle(rarityColor, 0.9);
        cardBg.fillRoundedRect(-size/2, -size/2, size, size, 6);
        cardBg.lineStyle(2, rarityColor);
        cardBg.strokeRoundedRect(-size/2, -size/2, size, size, 6);
        cardContainer.add(cardBg);
        
        // Icône
        const cardIcon = this.scene.add.text(
            0, -size/4,
            card.icon,
            { fontSize: `${size * 0.4}px` }
        ).setOrigin(0.5);
        cardContainer.add(cardIcon);
        
        // Coût en élixir
        const costBg = this.scene.add.graphics();
        costBg.fillStyle(0x9370DB, 1);
        costBg.fillCircle(-size/2 + 8, -size/2 + 8, 8);
        cardContainer.add(costBg);
        
        const costText = this.scene.add.text(
            -size/2 + 8, -size/2 + 8,
            card.cost.toString(),
            {
                fontSize: '10px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            }
        ).setOrigin(0.5);
        cardContainer.add(costText);
        
        // Niveau
        const levelText = this.scene.add.text(
            0, size/4,
            `Niv. ${card.level || 1}`,
            {
                fontSize: '8px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            }
        ).setOrigin(0.5);
        cardContainer.add(levelText);
        
        return cardContainer;
    }
    
    // === BOUTONS D'ACTION ===
    
    createDeckActionButtons() {
        const buttonsY = 200;
        const buttonContainer = this.scene.add.container(0, 0);
        
        // Sauvegarder
        const saveButton = this.createButton(
            this.width / 2 - 80, buttonsY,
            140, 40,
            '💾 Sauvegarder',
            '#32CD32',
            () => this.handleSaveDeck()
        );
        buttonContainer.add(saveButton);
        
        // Réinitialiser
        const resetButton = this.createButton(
            this.width / 2 + 80, buttonsY,
            140, 40,
            '🔄 Réinitialiser',
            '#DC143C',
            () => this.handleResetDeck()
        );
        buttonContainer.add(resetButton);
        
        // Copier deck (code)
        if (!this.isMobile) {
            const copyButton = this.createButton(
                this.width / 2 - 80, buttonsY + 60,
                140, 35,
                '📋 Copier Code',
                '#4682B4',
                () => this.handleCopyDeck()
            );
            buttonContainer.add(copyButton);
            
            // Coller deck
            const pasteButton = this.createButton(
                this.width / 2 + 80, buttonsY + 60,
                140, 35,
                '📥 Coller Code',
                '#9370DB',
                () => this.handlePasteDeck()
            );
            buttonContainer.add(pasteButton);
        }
        
        this.elements.actionButtons = buttonContainer;
        this.container.add(buttonContainer);
    }
    
    createButton(x, y, width, height, text, color, callback) {
        const buttonContainer = this.scene.add.container(x, y);
        
        // Convertir couleur hex en nombre si nécessaire
        const colorNum = typeof color === 'string' ? 
            parseInt(color.replace('#', '0x')) : color;
        
        // Ombre
        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.3);
        shadow.fillRoundedRect(-width/2 + 3, -height/2 + 3, width, height, 8);
        buttonContainer.add(shadow);
        
        // Fond
        const bg = this.scene.add.graphics();
        bg.fillStyle(colorNum);
        bg.fillRoundedRect(-width/2, -height/2, width, height, 8);
        buttonContainer.add(bg);
        
        // Brillance
        const shine = this.scene.add.graphics();
        shine.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0.3, 0.1);
        shine.fillRoundedRect(-width/2 + 2, -height/2 + 2, width, height/3, 6);
        buttonContainer.add(shine);
        
        // Texte
        const buttonText = this.scene.add.text(0, 0, text, {
            fontSize: this.isMobile ? '12px' : '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 1
        }).setOrigin(0.5);
        buttonContainer.add(buttonText);
        
        // Interactivité
        bg.setInteractive(new Phaser.Geom.Rectangle(-width/2, -height/2, width, height), 
            Phaser.Geom.Rectangle.Contains);
        
        bg.on('pointerdown', () => {
            buttonContainer.setScale(0.95);
            this.scene.time.delayedCall(100, () => {
                buttonContainer.setScale(1);
                if (callback) callback();
            });
        });
        
        bg.on('pointerover', () => {
            buttonContainer.setScale(1.05);
        });
        
        bg.on('pointerout', () => {
            buttonContainer.setScale(1);
        });
        
        return buttonContainer;
    }
    
    // === INFORMATIONS DU DECK ===
    
    createDeckInfo() {
        if (this.isMobile) return; // Pas d'infos détaillées sur mobile
        
        const infoY = 280;
        const infoContainer = this.scene.add.container(0, 0);
        
        // Statistiques du deck
        const deckStats = this.calculateDeckStats();
        
        // Coût moyen
        const avgCostText = this.scene.add.text(
            this.width / 2, infoY,
            `⚡ Coût moyen: ${deckStats.avgCost}`,
            {
                fontSize: '14px',
                fontWeight: 'bold',
                fill: this.getElixirCostColor(deckStats.avgCost)
            }
        ).setOrigin(0.5);
        infoContainer.add(avgCostText);
        
        // Types de cartes
        const typesText = this.scene.add.text(
            this.width / 2, infoY + 25,
            `📊 ${deckStats.typeDistribution}`,
            {
                fontSize: '12px',
                fill: '#B0C4DE'
            }
        ).setOrigin(0.5);
        infoContainer.add(typesText);
        
        // Cartes manquantes
        const missingCards = 8 - deckStats.cardCount;
        if (missingCards > 0) {
            const missingText = this.scene.add.text(
                this.width / 2, infoY + 45,
                `⚠️ ${missingCards} carte(s) manquante(s)`,
                {
                    fontSize: '12px',
                    fill: '#FFD700'
                }
            ).setOrigin(0.5);
            infoContainer.add(missingText);
        }
        
        this.elements.deckInfo = infoContainer;
        this.container.add(infoContainer);
    }
    
    // === GESTION DES ÉVÉNEMENTS ===
    
    handleSlotClick(slotIndex) {
        const currentCard = this.config.currentDeck[slotIndex];
        
        if (currentCard) {
            // Retirer la carte du deck
            this.removeCardFromDeck(slotIndex);
        } else {
            // Signaler qu'on veut ajouter une carte
            if (this.config.onAction) {
                this.config.onAction('open_card_selection', { slotIndex: slotIndex });
            }
        }
        
        console.log(`🔘 Clic slot deck: ${slotIndex}, carte: ${currentCard?.name || 'vide'}`);
    }
    
    handleSaveDeck() {
        const cardCount = this.config.currentDeck.filter(card => card !== null).length;
        
        if (cardCount < 8) {
            this.showError(`Deck incomplet ! ${8 - cardCount} cartes manquantes`);
            return;
        }
        
        if (this.config.onAction) {
            this.config.onAction('save_deck', { deck: [...this.config.currentDeck] });
        }
        
        this.showSuccess('Deck sauvegardé avec succès !');
        console.log('💾 Deck sauvegardé');
    }
    
    handleResetDeck() {
        if (window.confirm('Êtes-vous sûr de vouloir réinitialiser le deck ?')) {
            this.config.currentDeck = new Array(8).fill(null);
            this.refreshAllSlots();
            this.updateDeckInfo();
            
            if (this.config.onAction) {
                this.config.onAction('reset_deck', {});
            }
            
            this.showInfo('Deck réinitialisé');
            console.log('🔄 Deck réinitialisé');
        }
    }
    
    handleCopyDeck() {
        const deckCode = this.generateDeckCode();
        
        // Copier dans le presse-papier
        if (navigator.clipboard) {
            navigator.clipboard.writeText(deckCode).then(() => {
                this.showSuccess('Code deck copié dans le presse-papier !');
            }).catch(() => {
                this.showCopyModal(deckCode);
            });
        } else {
            this.showCopyModal(deckCode);
        }
        
        console.log('📋 Code deck généré:', deckCode);
    }
    
    handlePasteDeck() {
        // Demander le code à l'utilisateur
        const deckCode = prompt('Collez le code du deck :');
        
        if (deckCode) {
            try {
                const decodedDeck = this.decodeDeckCode(deckCode);
                this.config.currentDeck = decodedDeck;
                this.refreshAllSlots();
                this.updateDeckInfo();
                
                if (this.config.onAction) {
                    this.config.onAction('paste_deck', { deck: decodedDeck, code: deckCode });
                }
                
                this.showSuccess('Deck importé avec succès !');
                console.log('📥 Deck importé depuis code');
            } catch (error) {
                this.showError('Code deck invalide');
                console.error('❌ Erreur import deck:', error);
            }
        }
    }
    
    // === GESTION DES CARTES ===
    
    addCardToDeck(card, slotIndex) {
        if (slotIndex < 0 || slotIndex >= 8) return false;
        
        // Vérifier si la carte est déjà dans le deck
        const existingSlot = this.config.currentDeck.findIndex(c => c && c.id === card.id);
        if (existingSlot !== -1) {
            this.showError('Cette carte est déjà dans le deck');
            return false;
        }
        
        // Ajouter la carte
        this.config.currentDeck[slotIndex] = { ...card };
        
        // Rafraîchir l'affichage
        this.refreshSlot(slotIndex);
        this.updateDeckInfo();
        
        if (this.config.onAction) {
            this.config.onAction('card_added', { card: card, slotIndex: slotIndex });
        }
        
        console.log(`✅ Carte ${card.name} ajoutée au slot ${slotIndex}`);
        return true;
    }
    
    removeCardFromDeck(slotIndex) {
        if (slotIndex < 0 || slotIndex >= 8) return false;
        
        const removedCard = this.config.currentDeck[slotIndex];
        this.config.currentDeck[slotIndex] = null;
        
        // Rafraîchir l'affichage
        this.refreshSlot(slotIndex);
        this.updateDeckInfo();
        
        if (this.config.onAction) {
            this.config.onAction('card_removed', { card: removedCard, slotIndex: slotIndex });
        }
        
        console.log(`❌ Carte ${removedCard?.name} retirée du slot ${slotIndex}`);
        return true;
    }
    
    // === MISE À JOUR AFFICHAGE ===
    
    refreshSlot(slotIndex) {
        const slot = this.elements.deckSlots[slotIndex];
        if (!slot) return;
        
        // Nettoyer le contenu actuel (sauf le fond)
        slot.list.slice(1).forEach(child => child.destroy());
        
        const currentCard = this.config.currentDeck[slotIndex];
        const size = slot.slotData.size;
        
        if (currentCard) {
            // Afficher la carte
            const cardDisplay = this.createCardDisplay(currentCard, size * 0.8);
            slot.add(cardDisplay);
        } else {
            // Afficher le placeholder
            const placeholder = this.scene.add.text(
                0, 0,
                '+',
                {
                    fontSize: this.isMobile ? '20px' : '24px',
                    fill: '#708090'
                }
            ).setOrigin(0.5);
            slot.add(placeholder);
        }
        
        // Mettre à jour les données
        slot.slotData.card = currentCard;
    }
    
    refreshAllSlots() {
        this.elements.deckSlots.forEach((_, index) => {
            this.refreshSlot(index);
        });
    }
    
    updateDeckInfo() {
        if (!this.elements.deckInfo) return;
        
        // Recalculer les stats
        const deckStats = this.calculateDeckStats();
        
        // Mettre à jour les textes (simple reconstruction pour cet exemple)
        this.elements.deckInfo.destroy();
        this.createDeckInfo();
        
        // Notifier le parent pour mettre à jour le coût élixir global
        if (this.config.onAction) {
            this.config.onAction('deck_stats_changed', { stats: deckStats });
        }
    }
    
    // === CALCULS ET UTILITAIRES ===
    
    calculateDeckStats() {
        const cards = this.config.currentDeck.filter(card => card !== null);
        const cardCount = cards.length;
        
        // Coût moyen
        const totalCost = cards.reduce((sum, card) => sum + (card.cost || 0), 0);
        const avgCost = cardCount > 0 ? (totalCost / cardCount).toFixed(1) : '0.0';
        
        // Distribution par type
        const types = {};
        cards.forEach(card => {
            types[card.type] = (types[card.type] || 0) + 1;
        });
        
        const typeDistribution = Object.entries(types).length > 0 ?
            Object.entries(types).map(([type, count]) => `${type}: ${count}`).join(', ') :
            'Aucune carte';
        
        // Autres stats
        const defenseCards = cards.filter(card => card.type === 'défense').length;
        const attackCards = cards.filter(card => card.type === 'troupe' || card.type === 'sort').length;
        
        return {
            cardCount,
            avgCost: parseFloat(avgCost),
            totalCost,
            typeDistribution,
            defenseCards,
            attackCards,
            types
        };
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
    
    getElixirCostColor(avgCost) {
        if (avgCost > 4.5) return '#FF6347';      // Rouge si trop cher
        if (avgCost < 2.5) return '#32CD32';      // Vert si peu cher
        return '#FFFFFF';                         // Blanc normal
    }
    
    // === CODES DE DECK ===
    
    generateDeckCode() {
        // Générer un code simple basé sur les IDs des cartes
        const cardIds = this.config.currentDeck.map(card => card ? card.id : 'null');
        const deckString = cardIds.join(',');
        
        // Encoder en base64 pour faire plus court
        return btoa(deckString);
    }
    
    decodeDeckCode(code) {
        try {
            // Décoder depuis base64
            const deckString = atob(code);
            const cardIds = deckString.split(',');
            
            if (cardIds.length !== 8) {
                throw new Error('Code deck invalide - doit contenir 8 cartes');
            }
            
            // Reconstituer le deck (nécessite accès à la base de cartes)
            const deck = cardIds.map(id => {
                if (id === 'null') return null;
                
                // Ici il faudrait accéder à la base de données des cartes
                // Pour l'instant, on simule
                return { id: id, name: `Carte ${id}`, icon: '🃏', cost: 3, rarity: 'common', type: 'troupe' };
            });
            
            return deck;
        } catch (error) {
            throw new Error('Code deck invalide');
        }
    }
    
    // === NOTIFICATIONS ===
    
    showSuccess(message) {
        this.showNotification(message, '#32CD32');
    }
    
    showError(message) {
        this.showNotification(message, '#DC143C');
    }
    
    showInfo(message) {
        this.showNotification(message, '#4682B4');
    }
    
    showNotification(message, color) {
        const notification = this.scene.add.text(
            this.width / 2, 50,
            message,
            {
                fontSize: '14px',
                fontWeight: 'bold',
                fill: color,
                backgroundColor: '#000000',
                padding: { x: 15, y: 8 }
            }
        ).setOrigin(0.5).setDepth(1000);
        
        // Animation d'apparition
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
    
    showCopyModal(deckCode) {
        // Modal simple pour afficher le code à copier manuellement
        const { width, height } = this.scene.scale;
        
        // Overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(1000);
        overlay.setInteractive();
        
        // Panel
        const panelWidth = Math.min(width - 40, 400);
        const panelHeight = 200;
        
        const panel = this.scene.add.graphics();
        panel.fillStyle(0x2F4F4F, 1);
        panel.fillRoundedRect(
            width/2 - panelWidth/2, height/2 - panelHeight/2,
            panelWidth, panelHeight, 15
        );
        panel.lineStyle(2, 0xFFD700);
        panel.strokeRoundedRect(
            width/2 - panelWidth/2, height/2 - panelHeight/2,
            panelWidth, panelHeight, 15
        );
        panel.setDepth(1001);
        
        // Titre
        const title = this.scene.add.text(width/2, height/2 - 60, 'Code du deck', {
            fontSize: '18px',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5).setDepth(1002);
        
        // Code
        const codeText = this.scene.add.text(width/2, height/2 - 20, deckCode, {
            fontSize: '12px',
            fill: '#FFFFFF',
            backgroundColor: '#1C3A3A',
            padding: { x: 10, y: 5 },
            wordWrap: { width: panelWidth - 40 }
        }).setOrigin(0.5).setDepth(1002);
        
        // Instructions
        const instructions = this.scene.add.text(width/2, height/2 + 20, 'Sélectionnez et copiez ce code', {
            fontSize: '12px',
            fill: '#B0C4DE'
        }).setOrigin(0.5).setDepth(1002);
        
        // Bouton fermer
        const closeBtn = this.scene.add.text(width/2, height/2 + 60, '❌ Fermer', {
            fontSize: '14px',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5).setDepth(1002).setInteractive();
        
        const elementsToDestroy = [overlay, panel, title, codeText, instructions, closeBtn];
        
        const closeModal = () => {
            elementsToDestroy.forEach(element => element.destroy());
        };
        
        closeBtn.on('pointerdown', closeModal);
        overlay.on('pointerdown', closeModal);
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
    
    getCurrentDeck() {
        return [...this.config.currentDeck];
    }
    
    setCurrentDeck(newDeck) {
        if (!Array.isArray(newDeck) || newDeck.length !== 8) {
            console.error('❌ Deck invalide pour setCurrentDeck');
            return false;
        }
        
        this.config.currentDeck = [...newDeck];
        this.refreshAllSlots();
        this.updateDeckInfo();
        return true;
    }
    
    updateData(newData) {
        if (newData.currentDeck) {
            this.setCurrentDeck(newData.currentDeck);
        }
        
        if (newData.userData) {
            this.config.userData = newData.userData;
        }
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
        
        console.log('🗑️ DeckEditSubPanel détruit');
    }
}
