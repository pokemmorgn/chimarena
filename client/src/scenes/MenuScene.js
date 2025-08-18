import Phaser from 'phaser';
import { auth, user } from '../api'; // Nouveau client sécurisé

export default class MenuScene extends Phaser.Scene {
constructor() {
    super({ key: 'MenuScene' });
    
    this.currentUser = null;
    this.gameInstance = null;
    this.menuItems = [];
    this.selectedIndex = 0;
    this.refreshTimer = null; // AJOUTER CETTE LIGNE
}

    create() {
        console.log('🏠 Scène menu principal créée');
        
        // Références
        this.gameInstance = this.registry.get('gameInstance');
        this.currentUser = this.registry.get('currentUser');
        
        // Vérifier l'authentification
if (!auth.isAuthenticated()) {
    console.warn('❌ Utilisateur non authentifié, redirection vers AuthScene');
    this.scene.start('AuthScene');
    return;
}
        
        // Créer l'interface
        this.createBackground();
        this.createHeader();
        this.createUserInfo();
        this.createMainMenu();
        this.createFooter();
        this.setupSecurityHooks();
        
        // Configuration des événements
        this.setupKeyboardControls();
        
        // Animation d'entrée
        this.playEntranceAnimation();
        
        // Charger les données utilisateur fraîches
        this.refreshUserDataSecurely();
        this.startAutoRefresh();
    }

    createBackground() {
        const { width, height } = this.scale;
        
        // Dégradé de fond différent du menu auth
        const background = this.add.graphics();
        background.fillGradientStyle(0x2c3e50, 0x2c3e50, 0x34495e, 0x34495e);
        background.fillRect(0, 0, width, height);
        
        // Effets de particules plus élaborés
        this.createMenuParticles();
    }

    createMenuParticles() {
        const { width, height } = this.scale;
        
        // Orbes flottants
        for (let i = 0; i < 15; i++) {
            const orb = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(20, 40),
                0x3498db,
                0.1
            );
            
            this.tweens.add({
                targets: orb,
                x: orb.x + Phaser.Math.Between(-100, 100),
                y: orb.y + Phaser.Math.Between(-100, 100),
                alpha: { from: 0.05, to: 0.2 },
                duration: Phaser.Math.Between(4000, 8000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    createHeader() {
        const { width } = this.scale;
        
        // Logo plus petit pour le menu
        this.add.text(width / 2, 60, 'ChimArena', {
            fontSize: '36px',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: '#2c3e50',
            strokeThickness: 2
        }).setOrigin(0.5);

        // Après la création du logo, AJOUTER
this.securityIndicator = this.add.text(width / 2, 85, '🔐 Session sécurisée', {
    fontSize: '12px',
    fontFamily: 'Roboto, sans-serif',
    fill: '#2ecc71'
}).setOrigin(0.5);
        
        // Bouton de déconnexion
        this.createLogoutButton();
    }

    createLogoutButton() {
        const { width } = this.scale;
        
        const logoutBtn = this.add.text(width - 20, 20, '🚪 Déconnexion', {
            fontSize: '14px',
            fill: '#e74c3c',
            fontFamily: 'Roboto, sans-serif',
            padding: { x: 10, y: 5 },
            backgroundColor: '#2c3e50',
            borderRadius: 5
        })
        .setOrigin(1, 0)
        .setInteractive()
        .on('pointerover', () => {
            logoutBtn.setTint(0xff6b6b);
        })
        .on('pointerout', () => {
            logoutBtn.clearTint();
        })
        .on('pointerdown', () => {
            this.handleSecureLogout();
        });
    }

    createUserInfo() {
        const { width } = this.scale;
        const user = this.currentUser;
        
        if (!user) return;
        
        // Panel d'informations utilisateur
        const userPanel = this.add.graphics();
        userPanel.fillStyle(0x34495e, 0.8);
        userPanel.fillRoundedRect(width / 2 - 200, 100, 400, 80, 10);
        userPanel.lineStyle(2, 0x3498db);
        userPanel.strokeRoundedRect(width / 2 - 200, 100, 400, 80, 10);
        
        // Nom d'utilisateur
        this.add.text(width / 2 - 180, 120, `👑 ${user.username}`, {
            fontSize: '18px',
            fill: '#f39c12',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        });

        // Après la création du nom d'utilisateur, AJOUTER
const securityLevel = user.accountInfo?.securityLevel || 'BASIC';
const securityIcon = securityLevel === 'CRYPTO_GRADE' ? '💎' : securityLevel === 'ENHANCED' ? '🛡️' : '🔰';

// MODIFIER la ligne du nom d'utilisateur
this.add.text(width / 2 - 180, 120, `${securityIcon} ${user.username}`, {
    fontSize: '18px',
    fill: '#f39c12',
    fontFamily: 'Roboto, sans-serif',
    fontWeight: 'bold'
});

// AJOUTER après le nom d'utilisateur
this.add.text(width / 2 - 180, 140, `Sécurité: ${securityLevel}`, {
    fontSize: '12px',
    fill: securityLevel === 'CRYPTO_GRADE' ? '#2ecc71' : securityLevel === 'ENHANCED' ? '#3498db' : '#95a5a6',
    fontFamily: 'Roboto, sans-serif'
});
        
        // Niveau et trophées
        const level = user.playerStats?.level || 1;
        const trophies = user.playerStats?.trophies || 0;
        
        this.add.text(width / 2 - 180, 145, `Niveau ${level}`, {
            fontSize: '14px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        });
        
        this.add.text(width / 2 + 50, 145, `🏆 ${window.GameUtils.formatNumber(trophies)}`, {
            fontSize: '14px',
            fill: '#f1c40f',
            fontFamily: 'Roboto, sans-serif'
        });
        
        // Ressources si disponibles
        if (user.resources) {
            this.add.text(width / 2 - 180, 160, `💰 ${window.GameUtils.formatNumber(user.resources.gold)}`, {
                fontSize: '12px',
                fill: '#f39c12',
                fontFamily: 'Roboto, sans-serif'
            });
            
            this.add.text(width / 2 - 80, 160, `💎 ${user.resources.gems}`, {
                fontSize: '12px',
                fill: '#9b59b6',
                fontFamily: 'Roboto, sans-serif'
            });
        }
    }

    createMainMenu() {
        const { width, height } = this.scale;
        const menuY = height / 2;
        
        // Options du menu principal
        const menuOptions = [
            {
                text: '⚔️ Combat',
                description: 'Affronter des joueurs en ligne',
                action: () => this.startBattle(),
                color: '#e74c3c'
            },
            {
                text: '🃏 Mes Cartes',
                description: 'Gérer votre collection',
                action: () => this.openCardCollection(),
                color: '#3498db'
            },
            {
                text: '🛡️ Mon Deck',
                description: 'Modifier votre deck',
                action: () => this.openDeckEditor(),
                color: '#2ecc71'
            },
            {
                text: '🏆 Classements',
                description: 'Voir les meilleurs joueurs',
                action: () => this.openLeaderboard(),
                color: '#f39c12'
            },
            {
                text: '🎯 Entraînement',
                description: 'S\'entraîner contre l\'IA',
                action: () => this.startTraining(),
                color: '#9b59b6'
            },
            {
                text: '⚙️ Paramètres',
                description: 'Options du jeu',
                action: () => this.openSettings(),
                color: '#7f8c8d'
            }
        ];
        
        this.menuItems = [];
        
        menuOptions.forEach((option, index) => {
            const y = menuY + (index - 2.5) * 60;
            
            // Créer l'élément de menu
            const menuItem = this.createMenuItem(width / 2, y, option, index);
            this.menuItems.push(menuItem);
        });
        
        // Sélectionner le premier élément
        this.updateMenuSelection();
    }

    createMenuItem(x, y, option, index) {
        const container = this.add.container(x, y);
        
        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x34495e, 0.6);
        bg.fillRoundedRect(-180, -25, 360, 50, 8);
        
        // Texte principal
        const mainText = this.add.text(-160, -8, option.text, {
            fontSize: '18px',
            fill: option.color,
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        });
        
        // Description
        const descText = this.add.text(-160, 8, option.description, {
            fontSize: '12px',
            fill: '#bdc3c7',
            fontFamily: 'Roboto, sans-serif'
        });
        
        container.add([bg, mainText, descText]);
        
        // Propriétés personnalisées
        container.bg = bg;
        container.mainText = mainText;
        container.descText = descText;
        container.option = option;
        container.index = index;
        container.isSelected = false;
        
        // Interactivité
        container.setSize(360, 50);
        container.setInteractive()
            .on('pointerover', () => {
                this.selectedIndex = index;
                this.updateMenuSelection();
            })
            .on('pointerdown', () => {
                this.selectMenuItem();
            });
        
        return container;
    }

    updateMenuSelection() {
        this.menuItems.forEach((item, index) => {
            const isSelected = index === this.selectedIndex;
            item.isSelected = isSelected;
            
            if (isSelected) {
                // Élément sélectionné
                item.bg.clear();
                item.bg.fillStyle(0x3498db, 0.8);
                item.bg.lineStyle(2, 0x2980b9);
                item.bg.fillRoundedRect(-180, -25, 360, 50, 8);
                item.bg.strokeRoundedRect(-180, -25, 360, 50, 8);
                
                item.setScale(1.05);
            } else {
                // Élément normal
                item.bg.clear();
                item.bg.fillStyle(0x34495e, 0.6);
                item.bg.fillRoundedRect(-180, -25, 360, 50, 8);
                
                item.setScale(1);
            }
        });
    }

    selectMenuItem() {
        const selectedItem = this.menuItems[this.selectedIndex];
        if (selectedItem && selectedItem.option.action) {
            // Animation de sélection
            this.tweens.add({
                targets: selectedItem,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    selectedItem.option.action();
                }
            });
        }
    }

    createFooter() {
        const { width, height } = this.scale;
        
        // Statistiques rapides
        if (this.currentUser.gameStats) {
            const stats = this.currentUser.gameStats;
            const winRate = stats.totalGames > 0 ? Math.round((stats.wins / stats.totalGames) * 100) : 0;
            
            this.add.text(width / 2, height - 60, 
                `🎮 ${stats.totalGames} parties • ✅ ${stats.wins} victoires • 📊 ${winRate}% de réussite`, {
                fontSize: '12px',
                fill: '#95a5a6',
                fontFamily: 'Roboto, sans-serif'
            }).setOrigin(0.5);
        }

        // Après les statistiques, AJOUTER
const tokenInfo = auth.getTokenInfo();
if (tokenInfo) {
    const timeLeft = Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60));
    this.add.text(width / 2, height - 40, 
        `🔐 Session sécurisée • ⏱️ ${timeLeft}min restantes`, {
        fontSize: '10px',
        fill: timeLeft > 5 ? '#2ecc71' : '#e74c3c',
        fontFamily: 'Roboto, sans-serif'
    }).setOrigin(0.5);
}
        
        // Contrôles
        this.add.text(width / 2, height - 30, 
            'Utilisez ↑↓ ou la souris pour naviguer • ENTRÉE ou clic pour sélectionner', {
            fontSize: '10px',
            fill: '#7f8c8d',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
    }

    setupSecurityHooks() {
    // Vérifier que auth et config sont disponibles
    if (!auth || !auth.config) {
        console.warn('⚠️ Client API non encore initialisé dans MenuScene');
        return;
    }

    // Hook pour déconnexion automatique
    if (auth.config.onAuthenticationLost) {
        auth.config.onAuthenticationLost((reason) => {
            console.warn('🚨 Authentification perdue dans MenuScene:', reason);
            this.cleanup();
            window.NotificationManager.error(`Session expirée: ${reason}`);
            this.scene.start('AuthScene');
        });
    }

    // Hook pour refresh automatique transparent
    if (auth.config.onTokenRefreshed) {
        auth.config.onTokenRefreshed(() => {
            console.log('🔄 Token rafraîchi automatiquement dans MenuScene');
            this.refreshUserDataSecurely();
        });
    }
}
    
    setupKeyboardControls() {
        // Navigation clavier
        this.input.keyboard.on('keydown-UP', () => {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateMenuSelection();
        });
        
        this.input.keyboard.on('keydown-DOWN', () => {
            this.selectedIndex = Math.min(this.menuItems.length - 1, this.selectedIndex + 1);
            this.updateMenuSelection();
        });
        
        this.input.keyboard.on('keydown-ENTER', () => {
            this.selectMenuItem();
        });
        
        this.input.keyboard.on('keydown-ESC', () => {
            this.handleSecureLogout();
        });
    }

    playEntranceAnimation() {
        // Animation d'entrée
        this.menuItems.forEach((item, index) => {
            item.setAlpha(0);
            item.setX(item.x - 200);
            
            this.tweens.add({
                targets: item,
                alpha: 1,
                x: item.x + 200,
                duration: 500,
                delay: index * 100,
                ease: 'Back.easeOut'
            });
        });
    }

    // RENOMMER ET REMPLACER
async refreshUserDataSecurely() {
    try {
        console.log('🔄 Refresh des données utilisateur...');
        
        const response = await user.getProfile();
        if (response.success && response.user) {
            this.currentUser = response.user;
            this.gameInstance?.setCurrentUser(response.user);
            this.registry.set('currentUser', response.user);
            
            console.log('✅ Données utilisateur mises à jour');
        }
    } catch (error) {
        console.error('❌ Erreur refresh utilisateur:', error);
        
        if (error.message.includes('session') || error.message.includes('token')) {
            this.scene.start('AuthScene');
        }
    }
}
    
startAutoRefresh() {
    // Refresh automatique des données toutes les 5 minutes
    this.refreshTimer = this.time.addEvent({
        delay: 5 * 60 * 1000, // 5 minutes
        callback: () => {
            if (auth.isAuthenticated()) {
                this.refreshUserDataSecurely();
            }
        },
        loop: true
    });
}
    // Actions du menu
    startBattle() {
        console.log('🚀 Démarrage d\'un combat...');
        window.NotificationManager.show('Recherche d\'un adversaire...', 'info');
        // TODO: Implémenter le matchmaking
    }

    openCardCollection() {
        console.log('🃏 Ouverture collection de cartes...');
        window.NotificationManager.show('Collection de cartes - Bientôt disponible !', 'info');
        // TODO: Créer la scène de collection
    }

    openDeckEditor() {
        console.log('🛡️ Éditeur de deck...');
        window.NotificationManager.show('Éditeur de deck - Bientôt disponible !', 'info');
        // TODO: Créer l'éditeur de deck
    }

    openLeaderboard() {
        console.log('🏆 Classements...');
        window.NotificationManager.show('Classements - Bientôt disponible !', 'info');
        // TODO: Afficher les classements
    }

    startTraining() {
        console.log('🎯 Mode entraînement...');
        window.NotificationManager.show('Mode entraînement - Bientôt disponible !', 'info');
        // TODO: Mode entraînement contre IA
    }

    openSettings() {
        console.log('⚙️ Paramètres...');
        window.NotificationManager.show('Paramètres - Bientôt disponible !', 'info');
        // TODO: Créer l'écran de paramètres
    }

    async handleSecureLogout() {
    const confirmLogout = confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
    if (!confirmLogout) return;

    try {
        console.log('🚪 Déconnexion sécurisée...');
        
        this.cleanup();
        await auth.logout();
        this.gameInstance?.clearAuthData();
        
        window.NotificationManager.success('Déconnexion sécurisée réussie');
        this.scene.start('AuthScene');
        
    } catch (error) {
        console.error('❌ Erreur lors de la déconnexion:', error);
        
        this.cleanup();
        this.gameInstance?.clearAuthData();
        
        window.NotificationManager.show('Déconnexion locale effectuée', 'info');
        this.scene.start('AuthScene');
    }
}

    update() {
    // Vérification périodique de l'état d'authentification (AVEC VÉRIFICATION)
    if (this.scene.isActive() && auth && !auth.isAuthenticated()) {
        console.warn('⚠️ Perte d\'authentification détectée dans MenuScene');
        this.cleanup();
        this.scene.start('AuthScene');
        return; // SORTIR APRÈS CLEANUP
    }

    // Mise à jour de l'indicateur de sécurité (AVEC VÉRIFICATION)
    if (this.securityIndicator && auth && auth.getTokenInfo) {
        const tokenInfo = auth.getTokenInfo();
        if (tokenInfo) {
            const timeLeft = Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60));
            
            if (timeLeft <= 2) {
                this.securityIndicator.setFill('#e74c3c');
                this.securityIndicator.setText('🔐 Session expire bientôt...');
            } else if (timeLeft <= 5) {
                this.securityIndicator.setFill('#f39c12');
                this.securityIndicator.setText('🔐 Session sécurisée');
            } else {
                this.securityIndicator.setFill('#2ecc71');
                this.securityIndicator.setText('🔐 Session sécurisée');
            }
        }
    }
}
    
   cleanup() {
    // Nettoyer les timers
    if (this.refreshTimer) {
        this.refreshTimer.destroy();
        this.refreshTimer = null;
    }
    
    // Nettoyer les hooks de sécurité (AVEC VÉRIFICATION)
    if (auth && auth.config) {
        if (auth.config.onAuthenticationLost) {
            auth.config.onAuthenticationLost(null);
        }
        if (auth.config.onTokenRefreshed) {
            auth.config.onTokenRefreshed(null);
        }
    }
}
    
    destroy() {
    this.cleanup();
    super.destroy();
}
}
