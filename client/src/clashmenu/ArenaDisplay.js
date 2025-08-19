// client/src/clashmenu/ArenaDisplay.js - SECTION ARÈNE CLASH ROYALE
export default class ArenaDisplay {
    constructor(scene, userData) {
        this.scene = scene;
        this.userData = userData;
        this.container = null;
        
        // Éléments UI
        this.elements = {
            background: null,
            arenaImage: null,
            arenaName: null,
            arenaLevel: null,
            progressBar: null,
            progressText: null,
            nextArenaInfo: null
        };
        
        // Configuration arène
        this.arenaConfig = this.getArenaConfig();
        
        // Dimensions
        this.width = scene.scale.width;
        this.height = scene.isMobile ? 140 : 170;
        this.isMobile = scene.isMobile || false;
        
        this.create();
    }

    create() {
        // Container principal
        this.container = this.scene.add.container(0, 110); // Position sous le header
        
        this.createBackground();
        this.createArenaImage();
        this.createArenaInfo();
        this.createProgressSection();
        this.createNextArenaPreview();
        this.startArenaAnimations();
        
        console.log('🏟️ ArenaDisplay créé');
    }

    // === CONFIGURATION DES ARÈNES ===
    getArenaConfig() {
        const currentTrophies = this.userData?.playerStats?.trophies || 0;
        
        // Arènes de base (sera étendu plus tard)
        const arenas = [
            {
                id: 0,
                name: 'Arène des Gobelins',
                displayName: 'Arène 1',
                minTrophies: 0,
                maxTrophies: 399,
                color: 0x8B4513, // Brun
                accentColor: 0xDAA520, // Or foncé
                description: 'Un terrain simple pour débuter'
            },
            {
                id: 1,
                name: 'Arène d\'Os',
                displayName: 'Arène 2', 
                minTrophies: 400,
                maxTrophies: 799,
                color: 0x2F4F4F, // Gris-bleu foncé
                accentColor: 0x708090, // Gris ardoise
                description: 'Un terrain plus sombre et dangereux'
            },
            {
                id: 2,
                name: 'Arène PEKKA',
                displayName: 'Arène 3',
                minTrophies: 800,
                maxTrophies: 1199,
                color: 0x4B0082, // Indigo
                accentColor: 0x8A2BE2, // Violet bleu
                description: 'L\'arène des robots géants'
            }
        ];
        
        // Trouver l'arène actuelle
        const currentArena = arenas.find(arena => 
            currentTrophies >= arena.minTrophies && currentTrophies <= arena.maxTrophies
        ) || arenas[0];
        
        // Trouver l'arène suivante
        const nextArena = arenas.find(arena => arena.minTrophies > currentTrophies) || null;
        
        return {
            current: currentArena,
            next: nextArena,
            allArenas: arenas
        };
    }

    // === FOND DE LA SECTION ===
    createBackground() {
        const bg = this.scene.add.graphics();
        
        // Panel principal avec dégradé
        bg.fillGradientStyle(
            0x2F4F4F, 0x2F4F4F, 
            0x1C3A3A, 0x1C3A3A, 
            1
        );
        bg.fillRoundedRect(20, 0, this.width - 40, this.height, 15);
        
        // Bordure dorée épaisse
        bg.lineStyle(4, 0xFFD700, 1);
        bg.strokeRoundedRect(20, 0, this.width - 40, this.height, 15);
        
        // Effet de brillance en haut
        const shine = this.scene.add.graphics();
        shine.fillGradientStyle(
            0xFFFFFF, 0xFFFFFF, 
            0xFFFFFF, 0xFFFFFF, 
            0.4, 0.1
        );
        shine.fillRoundedRect(25, 5, this.width - 50, 25, 10);
        
        // Ombres intérieures pour la profondeur
        const innerShadow = this.scene.add.graphics();
        innerShadow.fillGradientStyle(
            0x000000, 0x000000, 
            0x000000, 0x000000, 
            0.2, 0.05
        );
        innerShadow.fillRoundedRect(25, this.height - 20, this.width - 50, 15, 8);
        
        this.elements.background = bg;
        this.container.add([bg, shine, innerShadow]);
    }

    // === IMAGE DE L'ARÈNE ===
    createArenaImage() {
        const imageX = 40;
        const imageY = 20;
        const imageWidth = this.isMobile ? 90 : 110;
        const imageHeight = this.isMobile ? 70 : 85;
        
        const arena = this.arenaConfig.current;
        
        // Container pour l'image
        const imageContainer = this.scene.add.container(imageX, imageY);
        
        // Fond de l'arène avec couleur thématique
        const arenaBg = this.scene.add.graphics();
        arenaBg.fillStyle(arena.color, 1);
        arenaBg.fillRoundedRect(0, 0, imageWidth, imageHeight, 12);
        
        // Bordure avec couleur d'accent
        arenaBg.lineStyle(3, arena.accentColor, 1);
        arenaBg.strokeRoundedRect(0, 0, imageWidth, imageHeight, 12);
        
        // Éléments décoratifs selon l'arène
        this.createArenaDetails(arenaBg, arena, imageWidth, imageHeight);
        
        // Effet de profondeur avec ombre
        const shadow = this.scene.add.graphics();
        shadow.fillStyle(0x000000, 0.3);
        shadow.fillRoundedRect(3, 3, imageWidth, imageHeight, 12);
        
        imageContainer.add([shadow, arenaBg]);
        
        // Animation subtile de l'arène
        this.scene.tweens.add({
            targets: imageContainer,
            scaleX: 1.02,
            scaleY: 1.02,
            duration: 3000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        
        this.elements.arenaImage = imageContainer;
        this.container.add(imageContainer);
    }

    createArenaDetails(graphics, arena, width, height) {
        switch (arena.id) {
            case 0: // Arène des Gobelins
                this.createGoblinArenaDetails(graphics, width, height);
                break;
            case 1: // Arène d'Os
                this.createBoneArenaDetails(graphics, width, height);
                break;
            case 2: // Arène PEKKA
                this.createPekkaArenaDetails(graphics, width, height);
                break;
            default:
                this.createDefaultArenaDetails(graphics, width, height);
        }
    }

    createGoblinArenaDetails(graphics, width, height) {
        // Sol herbeux
        graphics.fillStyle(0x90EE90, 1);
        graphics.fillRect(5, height - 15, width - 10, 10);
        
        // Structures en bois (tours)
        graphics.fillStyle(0x8B4513, 1);
        graphics.fillRect(15, height - 35, 12, 25);
        graphics.fillRect(width - 27, height - 35, 12, 25);
        
        // Toits des tours
        graphics.fillStyle(0x654321, 1);
        graphics.fillTriangle(21, height - 35, 15, height - 45, 27, height - 45);
        graphics.fillTriangle(width - 21, height - 35, width - 27, height - 45, width - 15, height - 45);
        
        // Chemin central
        graphics.fillStyle(0xD2B48C, 1);
        graphics.fillRect(width/2 - 8, height - 15, 16, 10);
        
        // Détails verts (buissons)
        graphics.fillStyle(0x228B22, 1);
        graphics.fillCircle(width/4, height - 20, 6);
        graphics.fillCircle(3*width/4, height - 20, 6);
    }

    createBoneArenaDetails(graphics, width, height) {
        // Sol rocheux
        graphics.fillStyle(0x696969, 1);
        graphics.fillRect(5, height - 15, width - 10, 10);
        
        // Structures en pierre
        graphics.fillStyle(0x2F4F4F, 1);
        graphics.fillRect(15, height - 40, 15, 30);
        graphics.fillRect(width - 30, height - 40, 15, 30);
        
        // Décorations d'os
        graphics.fillStyle(0xF5F5DC, 1);
        graphics.fillRect(width/2 - 2, height - 25, 4, 15);
        graphics.fillCircle(width/2, height - 27, 3);
        graphics.fillCircle(width/2, height - 12, 3);
        
        // Crânes décoratifs
        graphics.fillCircle(width/4, height - 20, 4);
        graphics.fillCircle(3*width/4, height - 20, 4);
    }

    createPekkaArenaDetails(graphics, width, height) {
        // Sol métallique
        graphics.fillStyle(0x708090, 1);
        graphics.fillRect(5, height - 15, width - 10, 10);
        
        // Structures robotiques
        graphics.fillStyle(0x4B0082, 1);
        graphics.fillRect(12, height - 45, 20, 35);
        graphics.fillRect(width - 32, height - 45, 20, 35);
        
        // Détails technologiques
        graphics.fillStyle(0x8A2BE2, 1);
        graphics.fillRect(16, height - 35, 12, 4);
        graphics.fillRect(16, height - 25, 12, 4);
        graphics.fillRect(width - 28, height - 35, 12, 4);
        graphics.fillRect(width - 28, height - 25, 12, 4);
        
        // Centre énergétique
        graphics.fillStyle(0xFF00FF, 1);
        graphics.fillCircle(width/2, height - 25, 8);
        graphics.fillStyle(0x8A2BE2, 1);
        graphics.fillCircle(width/2, height - 25, 5);
    }

    createDefaultArenaDetails(graphics, width, height) {
        // Arène générique simple
        graphics.fillStyle(0x90EE90, 1);
        graphics.fillRect(5, height - 15, width - 10, 10);
        
        graphics.fillStyle(0x8B4513, 1);
        graphics.fillRect(15, height - 30, 10, 20);
        graphics.fillRect(width - 25, height - 30, 10, 20);
    }

    // === INFORMATIONS DE L'ARÈNE ===
    createArenaInfo() {
        const arena = this.arenaConfig.current;
        const startX = this.isMobile ? 140 : 170;
        const startY = 25;
        
        // Nom de l'arène
        this.elements.arenaName = this.scene.add.text(startX, startY, arena.name, {
            fontSize: this.isMobile ? '18px' : '22px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700',
            stroke: '#8B4513',
            strokeThickness: 2
        });
        
        // Niveau d'arène
        this.elements.arenaLevel = this.scene.add.text(startX, startY + 25, arena.displayName, {
            fontSize: this.isMobile ? '14px' : '16px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#B0C4DE',
            stroke: '#2F4F4F',
            strokeThickness: 1
        });
        
        // Description
        if (!this.isMobile) {
            this.scene.add.text(startX, startY + 45, arena.description, {
                fontSize: '12px',
                fontFamily: 'Arial, sans-serif',
                fill: '#D3D3D3',
                wordWrap: { width: 180 }
            });
        }
        
        this.container.add([this.elements.arenaName, this.elements.arenaLevel]);
    }

    // === SECTION PROGRESSION ===
    createProgressSection() {
        const arena = this.arenaConfig.current;
        const nextArena = this.arenaConfig.next;
        const currentTrophies = this.userData?.playerStats?.trophies || 0;
        
        const startX = this.isMobile ? 140 : 170;
        const progressY = this.isMobile ? 75 : 85;
        const barWidth = this.isMobile ? 140 : 180;
        const barHeight = 12;
        
        // Texte progression
        const progressText = nextArena 
            ? `${currentTrophies}/${nextArena.minTrophies} 🏆`
            : `${currentTrophies} 🏆 MAX`;
            
        this.elements.progressText = this.scene.add.text(startX, progressY - 20, progressText, {
            fontSize: this.isMobile ? '13px' : '15px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700',
            stroke: '#8B4513',
            strokeThickness: 1
        });
        
        // Barre de progression
        this.createProgressBar(startX, progressY, barWidth, barHeight, currentTrophies, arena, nextArena);
        
        this.container.add([this.elements.progressText]);
    }

    createProgressBar(x, y, width, height, currentTrophies, currentArena, nextArena) {
        // Fond de la barre
        const progressBg = this.scene.add.graphics();
        progressBg.fillStyle(0x2F2F2F, 0.8);
        progressBg.fillRoundedRect(x, y, width, height, height / 2);
        progressBg.lineStyle(2, 0x555555);
        progressBg.strokeRoundedRect(x, y, width, height, height / 2);
        
        if (nextArena) {
            // Calcul du pourcentage de progression
            const progressInArena = currentTrophies - currentArena.minTrophies;
            const totalArenaRange = nextArena.minTrophies - currentArena.minTrophies;
            const progressPercent = Math.min((progressInArena / totalArenaRange) * 100, 100);
            
            // Remplissage de la barre
            const progressFill = this.scene.add.graphics();
            progressFill.fillStyle(0xFFD700, 1);
            progressFill.fillRoundedRect(
                x + 2, y + 2, 
                Math.max(0, (width - 4) * progressPercent / 100), 
                height - 4, 
                (height - 4) / 2
            );
            
            // Effet brillance
            const progressShine = this.scene.add.graphics();
            progressShine.fillGradientStyle(
                0xFFFFFF, 0xFFFFFF, 
                0xFFFFFF, 0xFFFFFF, 
                0.6, 0.2
            );
            progressShine.fillRoundedRect(
                x + 2, y + 2, 
                Math.max(0, (width - 4) * progressPercent / 100), 
                (height - 4) / 2, 
                (height - 4) / 4
            );
            
            this.elements.progressBar = { bg: progressBg, fill: progressFill, shine: progressShine };
            this.container.add([progressBg, progressFill, progressShine]);
            
            // Animation de pulsation pour encourager la progression
            if (progressPercent > 80) {
                this.scene.tweens.add({
                    targets: [progressFill, progressShine],
                    alpha: 0.7,
                    duration: 1000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            }
        } else {
            // Arène maximale atteinte
            const maxFill = this.scene.add.graphics();
            maxFill.fillStyle(0x9370DB, 1); // Violet pour niveau max
            maxFill.fillRoundedRect(x + 2, y + 2, width - 4, height - 4, (height - 4) / 2);
            
            this.elements.progressBar = { bg: progressBg, fill: maxFill };
            this.container.add([progressBg, maxFill]);
        }
    }

    // === APERÇU ARÈNE SUIVANTE ===
    createNextArenaPreview() {
        const nextArena = this.arenaConfig.next;
        if (!nextArena || this.isMobile) return; // Pas d'aperçu sur mobile pour économiser l'espace
        
        const previewX = this.width - 90;
        const previewY = 15;
        const previewSize = 60;
        
        // Titre
        this.scene.add.text(previewX, previewY, 'Suivante:', {
            fontSize: '11px',
            fontFamily: 'Arial, sans-serif',
            fill: '#B0C4DE'
        });
        
        // Aperçu miniature de l'arène suivante
        const previewBg = this.scene.add.graphics();
        previewBg.fillStyle(nextArena.color, 0.7);
        previewBg.fillRoundedRect(previewX, previewY + 15, previewSize, previewSize * 0.6, 6);
        previewBg.lineStyle(2, nextArena.accentColor);
        previewBg.strokeRoundedRect(previewX, previewY + 15, previewSize, previewSize * 0.6, 6);
        
        // Nom de l'arène suivante
        this.scene.add.text(previewX + previewSize/2, previewY + 55, nextArena.displayName, {
            fontSize: '10px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            fill: '#FFD700'
        }).setOrigin(0.5);
        
        this.elements.nextArenaInfo = previewBg;
        this.container.add([previewBg]);
    }

    // === ANIMATIONS ===
    startArenaAnimations() {
        // Animation de brillance périodique
        const shineEffect = this.scene.add.graphics();
        shineEffect.fillGradientStyle(
            0xFFFFFF, 0xFFFFFF, 
            0xFFFFFF, 0xFFFFFF, 
            0.8, 0
        );
        shineEffect.fillRect(0, 0, 30, this.height);
        shineEffect.setPosition(-50, 0);
        
        this.container.add(shineEffect);
        
        // Animation de passage de brillance
        this.scene.tweens.add({
            targets: shineEffect,
            x: this.width + 50,
            duration: 3000,
            delay: 2000,
            repeat: -1,
            ease: 'Power2.easeInOut'
        });
    }

    // === MÉTHODES PUBLIQUES ===
    updateUserData(newUserData) {
        this.userData = newUserData;
        this.arenaConfig = this.getArenaConfig();
        this.refresh();
    }

    refresh() {
        // Mettre à jour les informations affichées
        const arena = this.arenaConfig.current;
        const nextArena = this.arenaConfig.next;
        const currentTrophies = this.userData?.playerStats?.trophies || 0;
        
        // Mettre à jour le nom de l'arène
        if (this.elements.arenaName) {
            this.elements.arenaName.setText(arena.name);
        }
        
        if (this.elements.arenaLevel) {
            this.elements.arenaLevel.setText(arena.displayName);
        }
        
        // Mettre à jour la progression
        if (this.elements.progressText) {
            const progressText = nextArena 
                ? `${currentTrophies}/${nextArena.minTrophies} 🏆`
                : `${currentTrophies} 🏆 MAX`;
            this.elements.progressText.setText(progressText);
        }
        
        // Recalculer la barre de progression
        this.updateProgressBar();
        
        console.log('🔄 ArenaDisplay mis à jour');
    }

    updateProgressBar() {
        if (!this.elements.progressBar) return;
        
        const arena = this.arenaConfig.current;
        const nextArena = this.arenaConfig.next;
        const currentTrophies = this.userData?.playerStats?.trophies || 0;
        
        if (nextArena) {
            const progressInArena = currentTrophies - arena.minTrophies;
            const totalArenaRange = nextArena.minTrophies - arena.minTrophies;
            const progressPercent = Math.min((progressInArena / totalArenaRange) * 100, 100);
            
            // Redessiner la barre
            this.elements.progressBar.fill.clear();
            this.elements.progressBar.fill.fillStyle(0xFFD700, 1);
            const barWidth = this.isMobile ? 140 : 180;
            this.elements.progressBar.fill.fillRoundedRect(
                (this.isMobile ? 142 : 172), 87, 
                Math.max(0, (barWidth - 4) * progressPercent / 100), 
                8, 4
            );
        }
    }

    playArenaUnlockAnimation() {
        // Animation pour débloquer une nouvelle arène
        this.scene.tweens.add({
            targets: this.container,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 300,
            yoyo: true,
            ease: 'Back.easeOut',
            onStart: () => {
                // Effet de particules ou flash doré
                console.log('🎉 Nouvelle arène débloquée !');
            }
        });
    }

    // === GESTION DE L'ANIMATION ===
    show() {
        this.container.setAlpha(0);
        this.container.setScale(0.8);
        this.scene.tweens.add({
            targets: this.container,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 800,
            ease: 'Back.easeOut'
        });
    }

    hide() {
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            scaleX: 0.8,
            scaleY: 0.8,
            duration: 400,
            ease: 'Power2.easeIn'
        });
    }

    // === NETTOYAGE ===
    destroy() {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        console.log('🗑️ ArenaDisplay détruit');
    }

    // === GETTERS ===
    getContainer() {
        return this.container;
    }

    getHeight() {
        return this.height;
    }

    getCurrentArena() {
        return this.arenaConfig.current;
    }

    getNextArena() {
        return this.arenaConfig.next;
    }
}
