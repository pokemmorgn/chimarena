// client/src/clashmenu/battle/BattleField.js - TERRAIN DE COMBAT VISUEL
export default class BattleField {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.config = config;
        
        // Dimensions du terrain (comme Clash Royale)
        this.FIELD_WIDTH = 18;
        this.FIELD_HEIGHT = 32;
        this.BRIDGE_Y = 16; // Pont au milieu
        
        // Dimensions d'affichage
        this.displayWidth = config.width || 360; // 18 * 20 pixels
        this.displayHeight = config.height || 640; // 32 * 20 pixels
        this.cellSize = 20; // Pixels par case
        
        // Position du terrain
        this.x = config.x || 0;
        this.y = config.y || 0;
        
        // Containers
        this.container = null;
        this.gridContainer = null;
        this.towersContainer = null;
        this.unitsContainer = null;
        this.effectsContainer = null;
        
        // État
        this.playerSide = config.playerSide || 'blue'; // 'blue' = bas, 'red' = haut
        this.towers = new Map();
        this.units = new Map();
        
        console.log('⚔️ BattleField créé:', {
            size: `${this.FIELD_WIDTH}x${this.FIELD_HEIGHT}`,
            display: `${this.displayWidth}x${this.displayHeight}`,
            playerSide: this.playerSide
        });
    }
    
    // === INITIALISATION ===
    
    init() {
        console.log('🎮 Initialisation BattleField...');
        
        try {
            // Créer le container principal
            this.container = this.scene.add.container(this.x, this.y);
            
            // Créer les sous-containers
            this.createContainers();
            
            // Créer le terrain
            this.createBackground();
            this.createGrid();
            this.createZones();
            this.createTowers();
            
            // Rendre interactif
            this.makeInteractive();
            
            console.log('✅ BattleField initialisé');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur init BattleField:', error);
            return false;
        }
    }
    
    createContainers() {
        // Ordre d'affichage : background < grid < towers < units < effects
        this.gridContainer = this.scene.add.container(0, 0);
        this.towersContainer = this.scene.add.container(0, 0);
        this.unitsContainer = this.scene.add.container(0, 0);
        this.effectsContainer = this.scene.add.container(0, 0);
        
        this.container.add([
            this.gridContainer,
            this.towersContainer, 
            this.unitsContainer,
            this.effectsContainer
        ]);
    }
    
    // === CRÉATION DU TERRAIN ===
    
    createBackground() {
        // Fond du terrain (couleur herbe)
        const background = this.scene.add.graphics();
        background.fillStyle(0x4a7c59); // Vert herbe
        background.fillRect(0, 0, this.displayWidth, this.displayHeight);
        
        // Rivière au milieu
        const river = this.scene.add.graphics();
        river.fillStyle(0x4682b4); // Bleu rivière
        river.fillRect(0, this.BRIDGE_Y * this.cellSize - 10, this.displayWidth, 20);
        
        // Pont au centre
        const bridge = this.scene.add.graphics();
        bridge.fillStyle(0x8b4513); // Marron pont
        bridge.fillRect(
            this.displayWidth / 2 - 40,
            this.BRIDGE_Y * this.cellSize - 15,
            80, 30
        );
        
        this.gridContainer.add([background, river, bridge]);
    }
    
    createGrid() {
        const grid = this.scene.add.graphics();
        grid.lineStyle(1, 0x666666, 0.3);
        
        // Lignes verticales
        for (let x = 0; x <= this.FIELD_WIDTH; x++) {
            const px = x * this.cellSize;
            grid.moveTo(px, 0);
            grid.lineTo(px, this.displayHeight);
        }
        
        // Lignes horizontales
        for (let y = 0; y <= this.FIELD_HEIGHT; y++) {
            const py = y * this.cellSize;
            grid.moveTo(0, py);
            grid.lineTo(this.displayWidth, py);
        }
        
        grid.strokePath();
        this.gridContainer.add(grid);
    }
    
    createZones() {
        // Zone de déploiement du joueur (côté bleu = bas)
        const playerZone = this.scene.add.graphics();
        playerZone.fillStyle(0x0066cc, 0.2); // Bleu transparent
        
        if (this.playerSide === 'blue') {
            // Joueur bleu peut déployer dans sa moitié + 2 cases au-delà du pont
            playerZone.fillRect(
                0, 
                (this.BRIDGE_Y - 2) * this.cellSize,
                this.displayWidth, 
                (this.FIELD_HEIGHT - this.BRIDGE_Y + 2) * this.cellSize
            );
        } else {
            // Joueur rouge peut déployer dans sa moitié + 2 cases en-deçà du pont
            playerZone.fillRect(
                0, 0,
                this.displayWidth, 
                (this.BRIDGE_Y + 2) * this.cellSize
            );
        }
        
        this.gridContainer.add(playerZone);
    }
    
    createTowers() {
        // Configuration des tours (positions Clash Royale)
        const towerConfigs = [
            // Tours BLEUES (joueur du bas)
            { id: 'blue_crown_left', x: 3, y: 2, type: 'crown', side: 'blue' },
            { id: 'blue_crown_right', x: 15, y: 2, type: 'crown', side: 'blue' },
            { id: 'blue_king', x: 9, y: 0, type: 'king', side: 'blue' },
            
            // Tours ROUGES (adversaire du haut)
            { id: 'red_crown_left', x: 3, y: 30, type: 'crown', side: 'red' },
            { id: 'red_crown_right', x: 15, y: 30, type: 'crown', side: 'red' },
            { id: 'red_king', x: 9, y: 32, type: 'king', side: 'red' }
        ];
        
        towerConfigs.forEach(config => {
            this.createTower(config);
        });
    }
    
    createTower(config) {
        const { id, x, y, type, side } = config;
        
        // Position en pixels
        const px = x * this.cellSize + this.cellSize / 2;
        const py = y * this.cellSize + this.cellSize / 2;
        
        // Créer la tour (représentation simple)
        const tower = this.scene.add.container(px, py);
        
        // Base de la tour
        const base = this.scene.add.graphics();
        const color = side === 'blue' ? 0x4169e1 : 0xdc143c;
        const size = type === 'king' ? 25 : 20;
        
        base.fillStyle(color);
        base.fillCircle(0, 0, size);
        
        // Bordure
        base.lineStyle(2, 0x000000);
        base.strokeCircle(0, 0, size);
        
        // Icône de la tour
        const icon = this.scene.add.text(0, 0, type === 'king' ? '👑' : '🏰', {
            fontSize: type === 'king' ? '20px' : '16px'
        });
        icon.setOrigin(0.5);
        
        // Barre de vie
        const healthBar = this.createHealthBar(size * 2);
        healthBar.y = -size - 10;
        
        tower.add([base, icon, healthBar]);
        
        // Sauvegarder
        this.towers.set(id, {
            container: tower,
            config,
            health: type === 'king' ? 4824 : 2534,
            maxHealth: type === 'king' ? 4824 : 2534,
            healthBar,
            isDestroyed: false
        });
        
        this.towersContainer.add(tower);
        
        console.log(`🏰 Tour créée: ${id} (${type}) à (${x}, ${y})`);
    }
    
    createHealthBar(width) {
        const container = this.scene.add.container(0, 0);
        
        // Fond de la barre
        const background = this.scene.add.graphics();
        background.fillStyle(0x000000);
        background.fillRect(-width/2, -3, width, 6);
        
        // Barre de vie
        const healthBar = this.scene.add.graphics();
        healthBar.fillStyle(0x00ff00);
        healthBar.fillRect(-width/2, -3, width, 6);
        
        container.add([background, healthBar]);
        container.healthBar = healthBar; // Référence pour mise à jour
        container.width = width;
        
        return container;
    }
    
    // === INTERACTIVITÉ ===
    
    makeInteractive() {
        // Zone interactive pour le déploiement
        const interactiveZone = this.scene.add.zone(
            this.displayWidth / 2,
            this.displayHeight / 2,
            this.displayWidth,
            this.displayHeight
        );
        
        interactiveZone.setInteractive();
        
        // Événements de déploiement
        interactiveZone.on('pointerdown', (pointer, localX, localY) => {
            this.handleDeploy(localX, localY);
        });
        
        this.container.add(interactiveZone);
    }
    
    handleDeploy(localX, localY) {
        // Convertir position écran vers coordonnées grille
        const gridX = Math.floor(localX / this.cellSize);
        const gridY = Math.floor(localY / this.cellSize);
        
        // Vérifier si c'est dans la zone de déploiement
        if (!this.isValidDeployZone(gridX, gridY)) {
            console.log('❌ Zone de déploiement invalide:', gridX, gridY);
            return;
        }
        
        console.log('🎯 Déploiement demandé à:', gridX, gridY);
        
        // Émettre l'événement (sera géré par BattlePanel)
        if (this.config.onDeploy) {
            this.config.onDeploy(gridX, gridY);
        }
    }
    
    isValidDeployZone(x, y) {
        // Vérifier les limites du terrain
        if (x < 0 || x >= this.FIELD_WIDTH || y < 0 || y >= this.FIELD_HEIGHT) {
            return false;
        }
        
        // Zone selon le côté du joueur
        if (this.playerSide === 'blue') {
            return y >= this.BRIDGE_Y - 2; // Moitié sud + 2 cases
        } else {
            return y <= this.BRIDGE_Y + 2; // Moitié nord + 2 cases
        }
    }
    
    // === GESTION DES UNITÉS ===
    
    addUnit(unitData) {
        const { id, cardId, x, y, side, health, maxHealth } = unitData;
        
        // Position en pixels
        const px = x * this.cellSize + this.cellSize / 2;
        const py = y * this.cellSize + this.cellSize / 2;
        
        // Créer l'unité (représentation simple)
        const unit = this.scene.add.container(px, py);
        
        // Corps de l'unité
        const body = this.scene.add.graphics();
        const color = side === 'blue' ? 0x4169e1 : 0xdc143c;
        body.fillStyle(color);
        body.fillCircle(0, 0, 8);
        body.lineStyle(1, 0x000000);
        body.strokeCircle(0, 0, 8);
        
        // Nom de la carte (simplifié)
        const label = this.scene.add.text(0, -15, cardId.substring(0, 3), {
            fontSize: '10px',
            fill: '#ffffff',
            backgroundColor: '#000000',
            padding: { x: 2, y: 1 }
        });
        label.setOrigin(0.5);
        
        // Barre de vie
        const healthBar = this.createHealthBar(20);
        healthBar.y = 12;
        
        unit.add([body, label, healthBar]);
        
        // Sauvegarder
        this.units.set(id, {
            container: unit,
            data: unitData,
            healthBar
        });
        
        this.unitsContainer.add(unit);
        
        console.log(`🎮 Unité ajoutée: ${cardId} (${id}) à (${x}, ${y})`);
        return unit;
    }
    
    updateUnit(id, newData) {
        const unit = this.units.get(id);
        if (!unit) return;
        
        const { x, y, health } = newData;
        
        // Mettre à jour la position
        if (x !== undefined && y !== undefined) {
            const px = x * this.cellSize + this.cellSize / 2;
            const py = y * this.cellSize + this.cellSize / 2;
            
            // Animation de mouvement
            this.scene.tweens.add({
                targets: unit.container,
                x: px,
                y: py,
                duration: 200,
                ease: 'Power2'
            });
        }
        
        // Mettre à jour la vie
        if (health !== undefined) {
            this.updateHealthBar(unit.healthBar, health, unit.data.maxHealth);
        }
        
        // Mettre à jour les données
        Object.assign(unit.data, newData);
    }
    
    removeUnit(id) {
        const unit = this.units.get(id);
        if (!unit) return;
        
        // Animation de destruction
        this.scene.tweens.add({
            targets: unit.container,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            onComplete: () => {
                unit.container.destroy();
            }
        });
        
        this.units.delete(id);
        console.log(`💀 Unité supprimée: ${id}`);
    }
    
    // === UTILITAIRES ===
    
    updateHealthBar(healthBarContainer, health, maxHealth) {
        const healthBar = healthBarContainer.healthBar;
        const percentage = Math.max(0, health / maxHealth);
        const width = healthBarContainer.width * percentage;
        
        // Couleur selon le pourcentage de vie
        let color = 0x00ff00; // Vert
        if (percentage < 0.5) color = 0xffaa00; // Orange
        if (percentage < 0.25) color = 0xff0000; // Rouge
        
        healthBar.clear();
        healthBar.fillStyle(color);
        healthBar.fillRect(-healthBarContainer.width/2, -3, width, 6);
    }
    
    updateTowerHealth(towerId, health) {
        const tower = this.towers.get(towerId);
        if (!tower) return;
        
        this.updateHealthBar(tower.healthBar, health, tower.maxHealth);
        tower.health = health;
        
        if (health <= 0 && !tower.isDestroyed) {
            tower.isDestroyed = true;
            // Animation de destruction
            this.scene.tweens.add({
                targets: tower.container,
                alpha: 0.5,
                scale: 0.8,
                duration: 500
            });
            console.log(`💥 Tour détruite: ${towerId}`);
        }
    }
    
    // === EFFETS VISUELS ===
    
    showEffect(type, x, y, data = {}) {
        const px = x * this.cellSize + this.cellSize / 2;
        const py = y * this.cellSize + this.cellSize / 2;
        
        switch (type) {
            case 'explosion':
                this.showExplosion(px, py, data);
                break;
            case 'damage':
                this.showDamageNumber(px, py, data.damage);
                break;
            case 'deploy':
                this.showDeployEffect(px, py);
                break;
        }
    }
    
    showExplosion(x, y, data) {
        const explosion = this.scene.add.graphics();
        explosion.fillStyle(0xff4500);
        explosion.fillCircle(x, y, 5);
        
        this.effectsContainer.add(explosion);
        
        this.scene.tweens.add({
            targets: explosion,
            scaleX: 4,
            scaleY: 4,
            alpha: 0,
            duration: 300,
            onComplete: () => explosion.destroy()
        });
    }
    
    showDamageNumber(x, y, damage) {
        const text = this.scene.add.text(x, y, `-${damage}`, {
            fontSize: '14px',
            fill: '#ff0000',
            fontWeight: 'bold'
        });
        text.setOrigin(0.5);
        
        this.effectsContainer.add(text);
        
        this.scene.tweens.add({
            targets: text,
            y: y - 30,
            alpha: 0,
            duration: 800,
            onComplete: () => text.destroy()
        });
    }
    
    showDeployEffect(x, y) {
        const circle = this.scene.add.graphics();
        circle.lineStyle(3, 0x00ff00);
        circle.strokeCircle(x, y, 15);
        
        this.effectsContainer.add(circle);
        
        this.scene.tweens.add({
            targets: circle,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 500,
            onComplete: () => circle.destroy()
        });
    }
    
    // === API PUBLIQUE ===
    
    getContainer() {
        return this.container;
    }
    
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
    
    destroy() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this.towers.clear();
        this.units.clear();
    }
}

// === TESTS GLOBAUX ===
if (typeof window !== 'undefined') {
    window.testBattleField = () => {
        console.log('🧪 Test BattleField disponible');
        // Tests seront ajoutés selon les besoins
    };
}
