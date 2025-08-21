// client/src/clashmenu/deck/ChallengesSubPanel.js - SOUS-ONGLET DÉFIS
export default class ChallengesSubPanel {
    constructor(parentPanel, scene, config = {}) {
        this.parentPanel = parentPanel;
        this.scene = scene;
        this.container = null;
        
        // Configuration
        this.config = {
            userData: config.userData || null,
            onAction: config.onAction || (() => {}),
            ...config
        };
        
        // Dimensions
        this.width = scene.scale.width;
        this.height = scene.scale.height;
        this.isMobile = scene.isMobile || false;
        
        // Éléments UI
        this.elements = {
            challengesList: [],
            activeChallenge: null,
            rewardPreview: null
        };
        
        // Données des défis
        this.challenges = this.initializeChallenges();
        
        this.create();
    }
    
    create() {
        this.container = this.scene.add.container(0, 0);
        
        // Titre et description
        this.createHeader();
        
        // Liste des défis
        this.createChallengesList();
        
        // Défi actuel (si en cours)
        this.createActiveChallengeDisplay();
        
        console.log('⚡ ChallengesSubPanel créé');
    }
    
    // === HEADER ===
    
    createHeader() {
        // Titre principal
        const title = this.scene.add.text(
            this.width / 2, 30,
            '⚡ DÉFIS SPÉCIAUX',
            {
                fontSize: this.isMobile ? '18px' : '22px',
                fontWeight: 'bold',
                fill: '#FFD700',
                stroke: '#8B4513',
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        this.container.add(title);
        
        // Description
        const description = this.scene.add.text(
            this.width / 2, 60,
            'Testez vos compétences avec des decks prédéfinis\net remportez des récompenses exclusives !',
            {
                fontSize: this.isMobile ? '11px' : '13px',
                fill: '#B0C4DE',
                align: 'center'
            }
        ).setOrigin(0.5);
        this.container.add(description);
    }
    
    // === LISTE DES DÉFIS ===
    
    createChallengesList() {
        const startY = 100;
        const challengeHeight = this.isMobile ? 70 : 80;
        const spacing = this.isMobile ? 75 : 85;
        
        this.challenges.forEach((challenge, index) => {
            const y = startY + index * spacing;
            const challengeDisplay = this.createChallengeDisplay(challenge, y);
            this.elements.challengesList.push(challengeDisplay);
            this.container.add(challengeDisplay);
        });
    }
    
    createChallengeDisplay(challenge, y) {
        const challengeContainer = this.scene.add.container(0, y);
        const challengeWidth = this.width - 30;
        const challengeHeight = this.isMobile ? 65 : 75;
        
        // Fond du défi
        const bg = this.scene.add.graphics();
        this.drawChallengeBackground(bg, challengeWidth, challengeHeight, challenge);
        challengeContainer.add(bg);
        
        // Icône du défi
        const icon = this.scene.add.text(
            40, 0,
            challenge.icon,
            { fontSize: this.isMobile ? '24px' : '28px' }
        ).setOrigin(0.5);
        challengeContainer.add(icon);
        
        // Informations du défi
        const infoContainer = this.scene.add.container(90, -15);
        
        // Nom du défi
        const name = this.scene.add.text(
            0, 0,
            challenge.name,
            {
                fontSize: this.isMobile ? '14px' : '16px',
                fontWeight: 'bold',
                fill: '#FFFFFF'
            }
        );
        infoContainer.add(name);
        
        // Difficulté et type
        const difficulty = this.scene.add.text(
            0, 20,
            `${this.getDifficultyText(challenge.difficulty)} • ${challenge.type}`,
            {
                fontSize: this.isMobile ? '10px' : '12px',
                fill: this.getDifficultyColor(challenge.difficulty)
            }
        );
        infoContainer.add(difficulty);
        
        challengeContainer.add(infoContainer);
        
        // Récompenses
        const rewardContainer = this.scene.add.container(this.width - 120, 0);
        this.createRewardDisplay(rewardContainer, challenge.rewards);
        challengeContainer.add(rewardContainer);
        
        // Statut et bouton
        const statusContainer = this.scene.add.container(this.width - 200, 15);
        this.createChallengeStatus(statusContainer, challenge);
        challengeContainer.add(statusContainer);
        
        // Zone interactive
        const hitArea = this.scene.add.zone(
            this.width / 2, 0,
            challengeWidth, challengeHeight
        ).setInteractive();
        
        hitArea.on('pointerdown', () => this.handleChallengeClick(challenge));
        challengeContainer.add(hitArea);
        
        // Effet hover
        hitArea.on('pointerover', () => {
            challengeContainer.setScale(1.02);
            bg.setTint(0xF0F0F0);
        });
        
        hitArea.on('pointerout', () => {
            challengeContainer.setScale(1);
            bg.clearTint();
        });
        
        // Stocker les données
        challengeContainer.challengeData = challenge;
        
        return challengeContainer;
    }
    
    drawChallengeBackground(graphics, width, height, challenge) {
        graphics.clear();
        
        // Couleur selon l'état
        let bgColor, borderColor;
        
        switch (challenge.status) {
            case 'available':
                bgColor = 0x1C3A3A;
                borderColor = 0x32CD32;
                break;
            case 'locked':
                bgColor = 0x2F2F2F;
                borderColor = 0x696969;
                break;
            case 'completed':
                bgColor = 0x2F4F4F;
                borderColor = 0xFFD700;
                break;
            case 'active':
                bgColor = 0x191970;
                borderColor = 0x4169E1;
                break;
            default:
                bgColor = 0x1C3A3A;
                borderColor = 0x4682B4;
        }
        
        // Fond principal
        graphics.fillStyle(bgColor, 0.9);
        graphics.fillRoundedRect(-width/2 + 15, -height/2, width - 30, height, 12);
        
        // Bordure
        graphics.lineStyle(2, borderColor);
        graphics.strokeRoundedRect(-width/2 + 15, -height/2, width - 30, height, 12);
        
        // Effet brillance si disponible
        if (challenge.status === 'available') {
            graphics.fillGradientStyle(0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0xFFFFFF, 0.1, 0.05);
            graphics.fillRoundedRect(-width/2 + 17, -height/2 + 2, width - 34, 15, 8);
        }
    }
    
    createRewardDisplay(container, rewards) {
        let rewardText = '';
        
        rewards.forEach((reward, index) => {
            if (index > 0) rewardText += '\n';
            
            switch (reward.type) {
                case 'gold':
                    rewardText += `💰 ${reward.amount}`;
                    break;
                case 'gems':
                    rewardText += `💎 ${reward.amount}`;
                    break;
                case 'trophies':
                    rewardText += `🏆 ${reward.amount}`;
                    break;
                case 'card':
                    rewardText += `🃏 ${reward.rarity} Card`;
                    break;
                case 'chest':
                    rewardText += `📦 ${reward.chestType}`;
                    break;
                default:
                    rewardText += `🎁 ${reward.type}`;
            }
        });
        
        const rewardDisplay = this.scene.add.text(
            0, 0,
            rewardText,
            {
                fontSize: this.isMobile ? '9px' : '11px',
                fontWeight: 'bold',
                fill: '#32CD32',
                align: 'right'
            }
        ).setOrigin(1, 0.5);
        
        container.add(rewardDisplay);
    }
    
    createChallengeStatus(container, challenge) {
        let statusText, statusColor, buttonText;
        
        switch (challenge.status) {
            case 'available':
                statusText = 'Disponible';
                statusColor = '#32CD32';
                buttonText = '▶️ Jouer';
                break;
            case 'locked':
                statusText = `Verrouillé\n${challenge.unlockRequirement}`;
                statusColor = '#696969';
                buttonText = '🔒 Verrouillé';
                break;
            case 'completed':
                statusText = 'Terminé';
                statusColor = '#FFD700';
                buttonText = '✅ Terminé';
                break;
            case 'active':
                statusText = 'En cours';
                statusColor = '#4169E1';
                buttonText = '⏸️ Continuer';
                break;
            default:
                statusText = 'Inconnu';
                statusColor = '#FFFFFF';
                buttonText = '❓';
        }
        
        const status = this.scene.add.text(
            0, -10,
            statusText,
            {
                fontSize: this.isMobile ? '8px' : '10px',
                fill: statusColor,
                align: 'center'
            }
        ).setOrigin(0.5);
        container.add(status);
        
        // Bouton action si le défi est interactif
        if (challenge.status === 'available' || challenge.status === 'active') {
            const button = this.scene.add.text(
                0, 10,
                buttonText,
                {
                    fontSize: this.isMobile ? '9px' : '11px',
                    fontWeight: 'bold',
                    fill: '#FFFFFF',
                    backgroundColor: statusColor,
                    padding: { x: 8, y: 4 }
                }
            ).setOrigin(0.5);
            
            button.setInteractive();
            button.on('pointerdown', () => this.handleChallengeAction(challenge));
            
            container.add(button);
        }
    }
    
    // === DÉFI ACTUEL ===
    
    createActiveChallengeDisplay() {
        // Afficher le défi en cours s'il y en a un
        const activeChallenge = this.challenges.find(c => c.status === 'active');
        
        if (!activeChallenge) return;
        
        const activeChallengeY = this.height - 120;
        const activeContainer = this.scene.add.container(0, activeChallengeY);
        
        // Fond spécial pour défi actuel
        const activeBg = this.scene.add.graphics();
        activeBg.fillStyle(0x191970, 0.9);
        activeBg.fillRoundedRect(10, -50, this.width - 20, 100, 15);
        activeBg.lineStyle(3, 0x4169E1);
        activeBg.strokeRoundedRect(10, -50, this.width - 20, 100, 15);
        activeContainer.add(activeBg);
        
        // Titre
        const activeTitle = this.scene.add.text(
            this.width / 2, -25,
            `⚡ DÉFI EN COURS: ${activeChallenge.name}`,
            {
                fontSize: this.isMobile ? '12px' : '14px',
                fontWeight: 'bold',
                fill: '#FFD700'
            }
        ).setOrigin(0.5);
        activeContainer.add(activeTitle);
        
        // Progression
        const progress = activeChallenge.progress || { current: 0, total: 3 };
        const progressText = this.scene.add.text(
            this.width / 2, 0,
            `Progression: ${progress.current}/${progress.total} victoires`,
            {
                fontSize: this.isMobile ? '10px' : '12px',
                fill: '#B0C4DE'
            }
        ).setOrigin(0.5);
        activeContainer.add(progressText);
        
        // Barre de progression
        const progressBarWidth = this.width - 100;
        const progressBarHeight = 8;
        
        // Fond de la barre
        const progressBg = this.scene.add.graphics();
        progressBg.fillStyle(0x2F2F2F, 0.8);
        progressBg.fillRoundedRect(
            this.width/2 - progressBarWidth/2, 15,
            progressBarWidth, progressBarHeight, 4
        );
        activeContainer.add(progressBg);
        
        // Remplissage
        const progressFill = this.scene.add.graphics();
        progressFill.fillStyle(0x32CD32, 1);
        const fillWidth = (progressBarWidth * progress.current) / progress.total;
        progressFill.fillRoundedRect(
            this.width/2 - progressBarWidth/2 + 1, 16,
            Math.max(0, fillWidth - 2), progressBarHeight - 2, 3
        );
        activeContainer.add(progressFill);
        
        // Boutons action
        const continueBtn = this.scene.add.text(
            this.width / 2 - 60, 35,
            '▶️ Continuer',
            {
                fontSize: this.isMobile ? '10px' : '12px',
                fontWeight: 'bold',
                fill: '#FFFFFF',
                backgroundColor: '#32CD32',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5).setInteractive();
        
        continueBtn.on('pointerdown', () => this.handleContinueChallenge(activeChallenge));
        activeContainer.add(continueBtn);
        
        const abandonBtn = this.scene.add.text(
            this.width / 2 + 60, 35,
            '❌ Abandonner',
            {
                fontSize: this.isMobile ? '10px' : '12px',
                fontWeight: 'bold',
                fill: '#FFFFFF',
                backgroundColor: '#DC143C',
                padding: { x: 10, y: 5 }
            }
        ).setOrigin(0.5).setInteractive();
        
        abandonBtn.on('pointerdown', () => this.handleAbandonChallenge(activeChallenge));
        activeContainer.add(abandonBtn);
        
        this.elements.activeChallenge = activeContainer;
        this.container.add(activeContainer);
    }
    
    // === GESTION DES ÉVÉNEMENTS ===
    
    handleChallengeClick(challenge) {
        if (challenge.status === 'locked') {
            this.showChallengeDetails(challenge);
        } else {
            this.handleChallengeAction(challenge);
        }
        
        console.log(`⚡ Clic défi: ${challenge.name} (${challenge.status})`);
    }
    
    handleChallengeAction(challenge) {
        switch (challenge.status) {
            case 'available':
                this.startChallenge(challenge);
                break;
            case 'active':
                this.continueChallenge(challenge);
                break;
            case 'completed':
                this.showChallengeResults(challenge);
                break;
        }
    }
    
    startChallenge(challenge) {
        // Confirmer le démarrage
        if (window.confirm(`Commencer le défi "${challenge.name}" ?\n\nDeck imposé: ${challenge.deck.name}`)) {
            // Marquer comme actif
            challenge.status = 'active';
            challenge.progress = { current: 0, total: challenge.winsRequired || 3 };
            
            // Notifier le parent
            if (this.config.onAction) {
                this.config.onAction('start_challenge', { challenge: challenge });
            }
            
            // Rafraîchir l'affichage
            this.refreshChallengesList();
            this.createActiveChallengeDisplay();
            
            this.showSuccess(`Défi "${challenge.name}" commencé !`);
            console.log(`⚡ Défi commencé: ${challenge.name}`);
        }
    }
    
    continueChallenge(challenge) {
        if (this.config.onAction) {
            this.config.onAction('continue_challenge', { challenge: challenge });
        }
        
        console.log(`⚡ Défi continué: ${challenge.name}`);
    }
    
    handleContinueChallenge(challenge) {
        this.continueChallenge(challenge);
    }
    
    handleAbandonChallenge(challenge) {
        if (window.confirm(`Abandonner le défi "${challenge.name}" ?\n\nVous perdrez votre progression actuelle.`)) {
            // Remettre en disponible
            challenge.status = 'available';
            challenge.progress = null;
            
            // Notifier le parent
            if (this.config.onAction) {
                this.config.onAction('abandon_challenge', { challenge: challenge });
            }
            
            // Rafraîchir l'affichage
            this.refreshChallengesList();
            this.refreshActiveChallengeDisplay();
            
            this.showInfo(`Défi "${challenge.name}" abandonné`);
            console.log(`⚡ Défi abandonné: ${challenge.name}`);
        }
    }
    
    // === MODALS ET DÉTAILS ===
    
    showChallengeDetails(challenge) {
        const { width, height } = this.scene.scale;
        
        // Overlay
        const overlay = this.scene.add.graphics();
        overlay.fillStyle(0x000000, 0.7);
        overlay.fillRect(0, 0, width, height);
        overlay.setDepth(1000);
        overlay.setInteractive();
        
        // Panel de détails
        const panelWidth = Math.min(width - 40, 350);
        const panelHeight = 400;
        
        const detailPanel = this.scene.add.graphics();
        detailPanel.fillStyle(0x2F4F4F, 1);
        detailPanel.fillRoundedRect(
            width/2 - panelWidth/2, height/2 - panelHeight/2,
            panelWidth, panelHeight, 15
        );
        detailPanel.lineStyle(3, this.getDifficultyColor(challenge.difficulty));
        detailPanel.strokeRoundedRect(
            width/2 - panelWidth/2, height/2 - panelHeight/2,
            panelWidth, panelHeight, 15
        );
        detailPanel.setDepth(1001);
        
        // Contenu du défi
        const challengeTitle = this.scene.add.text(
            width/2, height/2 - 150,
            `${challenge.icon} ${challenge.name}`,
            {
                fontSize: '18px',
                fontWeight: 'bold',
                fill: '#FFD700'
            }
        ).setOrigin(0.5).setDepth(1002);
        
        const challengeDesc = this.scene.add.text(
            width/2, height/2 - 100,
            challenge.description,
            {
                fontSize: '12px',
                fill: '#FFFFFF',
                align: 'center',
                wordWrap: { width: panelWidth - 40 }
            }
        ).setOrigin(0.5).setDepth(1002);
        
        // Informations du deck
        const deckInfo = this.scene.add.text(
            width/2, height/2 - 40,
            `Deck imposé: ${challenge.deck.name}\nStratégie: ${challenge.deck.strategy}`,
            {
                fontSize: '11px',
                fill: '#B0C4DE',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(1002);
        
        // Conditions de déverrouillage
        let unlockText = '';
        if (challenge.status === 'locked') {
            unlockText = `🔒 ${challenge.unlockRequirement}`;
        } else {
            unlockText = `✅ Défi disponible`;
        }
        
        const unlockInfo = this.scene.add.text(
            width/2, height/2 + 10,
            unlockText,
            {
                fontSize: '12px',
                fill: challenge.status === 'locked' ? '#DC143C' : '#32CD32',
                fontWeight: 'bold'
            }
        ).setOrigin(0.5).setDepth(1002);
        
        // Récompenses détaillées
        let rewardText = 'Récompenses:\n';
        challenge.rewards.forEach(reward => {
            switch (reward.type) {
                case 'gold':
                    rewardText += `💰 ${reward.amount} Or\n`;
                    break;
                case 'gems':
                    rewardText += `💎 ${reward.amount} Gemmes\n`;
                    break;
                case 'trophies':
                    rewardText += `🏆 ${reward.amount} Trophées\n`;
                    break;
                case 'card':
                    rewardText += `🃏 Carte ${reward.rarity}\n`;
                    break;
                case 'chest':
                    rewardText += `📦 Coffre ${reward.chestType}\n`;
                    break;
            }
        });
        
        const rewardInfo = this.scene.add.text(
            width/2, height/2 + 60,
            rewardText,
            {
                fontSize: '10px',
                fill: '#32CD32',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(1002);
        
        // Bouton fermer
        const closeBtn = this.scene.add.text(
            width/2, height/2 + 140,
            '❌ Fermer',
            {
                fontSize: '14px',
                fontWeight: 'bold',
                fill: '#FFD700'
            }
        ).setOrigin(0.5).setDepth(1002).setInteractive();
        
        const elementsToDestroy = [
            overlay, detailPanel, challengeTitle, challengeDesc,
            deckInfo, unlockInfo, rewardInfo, closeBtn
        ];
        
        const closeModal = () => {
            elementsToDestroy.forEach(element => element.destroy());
        };
        
        closeBtn.on('pointerdown', closeModal);
        overlay.on('pointerdown', closeModal);
    }
    
    showChallengeResults(challenge) {
        // Afficher les résultats du défi terminé
        const { width, height } = this.scene.scale;
        
        // Panel simple de résultats
        const resultPanel = this.scene.add.graphics();
        resultPanel.fillStyle(0x2F4F4F, 0.95);
        resultPanel.fillRoundedRect(20, height/2 - 100, width - 40, 200, 15);
        resultPanel.lineStyle(3, 0xFFD700);
        resultPanel.strokeRoundedRect(20, height/2 - 100, width - 40, 200, 15);
        resultPanel.setDepth(1000);
        
        const resultTitle = this.scene.add.text(
            width/2, height/2 - 50,
            `🏆 Défi "${challenge.name}" terminé !`,
            {
                fontSize: '16px',
                fontWeight: 'bold',
                fill: '#FFD700'
            }
        ).setOrigin(0.5).setDepth(1001);
        
        const resultText = this.scene.add.text(
            width/2, height/2,
            'Récompenses déjà obtenues\nConsultez votre historique pour plus de détails',
            {
                fontSize: '12px',
                fill: '#B0C4DE',
                align: 'center'
            }
        ).setOrigin(0.5).setDepth(1001);
        
        const closeResultBtn = this.scene.add.text(
            width/2, height/2 + 50,
            '✅ OK',
            {
                fontSize: '14px',
                fontWeight: 'bold',
                fill: '#FFFFFF',
                backgroundColor: '#32CD32',
                padding: { x: 15, y: 8 }
            }
        ).setOrigin(0.5).setDepth(1001).setInteractive();
        
        closeResultBtn.on('pointerdown', () => {
            [resultPanel, resultTitle, resultText, closeResultBtn].forEach(el => el.destroy());
        });
        
        // Auto-fermeture après 5 secondes
        this.scene.time.delayedCall(5000, () => {
            if (resultPanel.active) {
                [resultPanel, resultTitle, resultText, closeResultBtn].forEach(el => el.destroy());
            }
        });
    }
    
    // === UTILITAIRES ===
    
    getDifficultyText(difficulty) {
        const texts = {
            easy: 'Facile',
            medium: 'Moyen',
            hard: 'Difficile',
            expert: 'Expert',
            legendary: 'Légendaire'
        };
        return texts[difficulty] || 'Inconnu';
    }
    
    getDifficultyColor(difficulty) {
        const colors = {
            easy: '#32CD32',
            medium: '#FFD700',
            hard: '#FF6347',
            expert: '#DC143C',
            legendary: '#9370DB'
        };
        return colors[difficulty] || '#FFFFFF';
    }
    
    // === DONNÉES DES DÉFIS ===
    
    initializeChallenges() {
        return [
            {
                id: 'classic_rush',
                name: 'Assaut Classic',
                icon: '⚔️',
                description: 'Affrontez 3 adversaires avec un deck équilibré. Parfait pour débuter !',
                difficulty: 'easy',
                type: 'Classic',
                status: 'available',
                winsRequired: 3,
                unlockRequirement: null,
                deck: {
                    name: 'Deck Équilibré',
                    strategy: 'Attaque et défense équilibrées',
                    cards: ['knight', 'archers', 'fireball', 'giant', 'minions', 'wizard', 'barbarians', 'arrows']
                },
                rewards: [
                    { type: 'gold', amount: 500 },
                    { type: 'trophies', amount: 50 }
                ],
                progress: null
            },
            {
                id: 'spell_master',
                name: 'Maître des Sorts',
                icon: '🔮',
                description: 'Deck composé uniquement de sorts et de créatures magiques. Tactique pure !',
                difficulty: 'medium',
                type: 'Spécialisé',
                status: 'available',
                winsRequired: 5,
                unlockRequirement: null,
                deck: {
                    name: 'Deck Magique',
                    strategy: 'Sorts et créatures magiques',
                    cards: ['wizard', 'witch', 'fireball', 'lightning', 'baby_dragon', 'ice_wizard', 'freeze', 'tornado']
                },
                rewards: [
                    { type: 'gold', amount: 1000 },
                    { type: 'gems', amount: 10 },
                    { type: 'card', rarity: 'rare' }
                ],
                progress: null
            },
            {
                id: 'giant_challenge',
                name: 'Défi des Géants',
                icon: '🏗️',
                description: 'Affrontez des adversaires avec uniquement des unités lourdes et coûteuses.',
                difficulty: 'hard',
                type: 'Tanky',
                status: 'locked',
                winsRequired: 7,
                unlockRequirement: 'Niveau 5 requis',
                deck: {
                    name: 'Deck Lourd',
                    strategy: 'Unités tankys et lentes',
                    cards: ['giant', 'pekka', 'golem', 'lava_hound', 'giant_skeleton', 'royal_giant', 'mega_knight', 'electro_giant']
                },
                rewards: [
                    { type: 'gold', amount: 2000 },
                    { type: 'gems', amount: 25 },
                    { type: 'chest', chestType: 'Épique' }
                ],
                progress: null
            },
            {
                id: 'speed_demon',
                name: 'Démon de Vitesse',
                icon: '💨',
                description: 'Deck ultra-rapide avec des unités low-cost. Vitesse maximale !',
                difficulty: 'medium',
                type: 'Rush',
                status: 'locked',
                winsRequired: 4,
                unlockRequirement: '10 victoires PvP',
                deck: {
                    name: 'Deck Rush',
                    strategy: 'Attaques rapides et coût faible',
                    cards: ['goblins', 'spear_goblins', 'minions', 'fire_spirits', 'ice_spirit', 'skeletons', 'bats', 'zap']
                },
                rewards: [
                    { type: 'gold', amount: 800 },
                    { type: 'trophies', amount: 100 }
                ],
                progress: null
            },
            {
                id: 'legendary_trial',
                name: 'Épreuve Légendaire',
                icon: '👑',
                description: 'Le défi ultime ! Deck composé uniquement de cartes légendaires.',
                difficulty: 'legendary',
                type: 'Légendaire',
                status: 'locked',
                winsRequired: 12,
                unlockRequirement: 'Posséder 3 cartes légendaires',
                deck: {
                    name: 'Deck Légendaire',
                    strategy: 'Cartes légendaires exclusivement',
                    cards: ['ice_wizard', 'princess', 'lava_hound', 'miner', 'sparky', 'graveyard', 'log', 'electro_wizard']
                },
                rewards: [
                    { type: 'gold', amount: 5000 },
                    { type: 'gems', amount: 100 },
                    { type: 'card', rarity: 'legendary' },
                    { type: 'chest', chestType: 'Légendaire' }
                ],
                progress: null
            }
        ];
    }
    
    // === MISE À JOUR ===
    
    refreshChallengesList() {
        // Détruire l'ancienne liste
        this.elements.challengesList.forEach(challenge => challenge.destroy());
        this.elements.challengesList = [];
        
        // Recréer la liste
        this.createChallengesList();
    }
    
    refreshActiveChallengeDisplay() {
        // Détruire l'affichage actuel
        if (this.elements.activeChallenge) {
            this.elements.activeChallenge.destroy();
            this.elements.activeChallenge = null;
        }
        
        // Recréer si nécessaire
        this.createActiveChallengeDisplay();
    }
    
    updateChallengeProgress(challengeId, newProgress) {
        const challenge = this.challenges.find(c => c.id === challengeId);
        if (!challenge) return;
        
        challenge.progress = newProgress;
        
        // Vérifier si terminé
        if (newProgress.current >= newProgress.total) {
            challenge.status = 'completed';
            this.showSuccess(`Défi "${challenge.name}" terminé ! 🏆`);
        }
        
        // Rafraîchir l'affichage
        this.refreshActiveChallengeDisplay();
    }
    
    unlockChallenge(challengeId) {
        const challenge = this.challenges.find(c => c.id === challengeId);
        if (challenge && challenge.status === 'locked') {
            challenge.status = 'available';
            this.refreshChallengesList();
            this.showSuccess(`Nouveau défi déverrouillé: ${challenge.name} !`);
        }
    }
    
    // === NOTIFICATIONS ===
    
    showSuccess(message) {
        this.showNotification(message, '#32CD32');
    }
    
    showInfo(message) {
        this.showNotification(message, '#4682B4');
    }
    
    showNotification(message, color) {
        const notification = this.scene.add.text(
            this.width / 2, 80,
            message,
            {
                fontSize: '12px',
                fontWeight: 'bold',
                fill: color,
                backgroundColor: '#000000',
                padding: { x: 12, y: 6 }
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
    
    getChallenges() {
        return [...this.challenges];
    }
    
    getActiveChallenge() {
        return this.challenges.find(c => c.status === 'active') || null;
    }
    
    updateData(newData) {
        if (newData.userData) {
            this.config.userData = newData.userData;
            
            // Mettre à jour les statuts selon les données utilisateur
            this.updateChallengeStatuses(newData.userData);
        }
        
        if (newData.challenges) {
            this.challenges = newData.challenges;
            this.refreshChallengesList();
            this.refreshActiveChallengeDisplay();
        }
    }
    
    updateChallengeStatuses(userData) {
        // Exemple de mise à jour des statuts selon les données utilisateur
        const userLevel = userData.playerStats?.level || 1;
        const userWins = userData.playerStats?.wins || 0;
        const userLegendaryCards = userData.collection?.filter(c => c.rarity === 'legendary').length || 0;
        
        this.challenges.forEach(challenge => {
            switch (challenge.id) {
                case 'giant_challenge':
                    if (userLevel >= 5) {
                        challenge.status = challenge.status === 'locked' ? 'available' : challenge.status;
                    }
                    break;
                case 'speed_demon':
                    if (userWins >= 10) {
                        challenge.status = challenge.status === 'locked' ? 'available' : challenge.status;
                    }
                    break;
                case 'legendary_trial':
                    if (userLegendaryCards >= 3) {
                        challenge.status = challenge.status === 'locked' ? 'available' : challenge.status;
                    }
                    break;
            }
        });
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
        
        console.log('🗑️ ChallengesSubPanel détruit');
    }
}
