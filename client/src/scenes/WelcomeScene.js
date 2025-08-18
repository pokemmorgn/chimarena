// client/src/scenes/WelcomeScene.js
import Phaser from 'phaser';
import { auth, user } from '../api';

export default class WelcomeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WelcomeScene' });
        
        this.currentUser = null;
        this.gameInstance = null;
        this.securityTimer = null;
        this.walletConnected = false;
        this.walletAddress = null;
        
        // Éléments UI
        this.welcomePanel = null;
        this.securityPanel = null;
        this.walletPanel = null;
        this.navigationPanel = null;
        this.securityIndicators = {};
    }

    create() {
        console.log('🏠 Scène d\'accueil créée');
        
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
        this.createWelcomePanel();
        this.createSecurityPanel();
        this.createWalletPanel();
        this.createNavigationPanel();
        this.createLogoutButton();
        
        // Configuration des événements
        this.setupKeyboardControls();
        this.setupSecurityMonitoring();
        
        // Animation d'entrée
        this.playEntranceAnimation();
        
        // Charger les données fraîches
        this.refreshUserData();
    }

    createBackground() {
        const { width, height } = this.scale;
        
        // Dégradé futuriste
        const background = this.add.graphics();
        background.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x0f3460);
        background.fillRect(0, 0, width, height);
        
        // Effets de particules high-tech
        this.createTechParticles();
        
        // Grille cyberpunk subtile
        this.createCyberGrid();
    }

    createTechParticles() {
        const { width, height } = this.scale;
        
        // Particules flottantes tech
        for (let i = 0; i < 20; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(1, 3),
                0x00d4aa,
                0.3
            );
            
            this.tweens.add({
                targets: particle,
                x: particle.x + Phaser.Math.Between(-50, 50),
                y: particle.y + Phaser.Math.Between(-50, 50),
                alpha: { from: 0.1, to: 0.6 },
                duration: Phaser.Math.Between(3000, 6000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    createCyberGrid() {
        const { width, height } = this.scale;
        const gridSize = 50;
        
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x00d4aa, 0.1);
        
        // Lignes verticales
        for (let x = 0; x <= width; x += gridSize) {
            grid.moveTo(x, 0);
            grid.lineTo(x, height);
        }
        
        // Lignes horizontales
        for (let y = 0; y <= height; y += gridSize) {
            grid.moveTo(0, y);
            grid.lineTo(width, y);
        }
        
        grid.strokePath();
    }

    createWelcomePanel() {
        const { width } = this.scale;
        const user = this.currentUser;
        
        if (!user) return;
        
        // Panel principal d'accueil
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x1a1a2e, 0.9);
        panelBg.lineStyle(2, 0x00d4aa, 0.8);
        panelBg.fillRoundedRect(width/2 - 300, 80, 600, 120, 15);
        panelBg.strokeRoundedRect(width/2 - 300, 80, 600, 120, 15);
        
        // Message de bienvenue personnalisé
        const welcomeText = this.add.text(width/2, 120, `Bienvenue, ${user.username} !`, {
            fontSize: '32px',
            fill: '#00d4aa',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Sous-titre avec niveau et trophées
        const level = user.playerStats?.level || 1;
        const trophies = user.playerStats?.trophies || 0;
        
        const subtitleText = this.add.text(width/2, 155, 
            `Niveau ${level} • 🏆 ${window.GameUtils.formatNumber(trophies)} trophées`, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        // Stats rapides
        const winRate = user.gameStats ? 
            (user.gameStats.totalGames > 0 ? Math.round((user.gameStats.wins / user.gameStats.totalGames) * 100) : 0) : 0;
        
        const statsText = this.add.text(width/2, 175, 
            `🎮 ${user.gameStats?.totalGames || 0} parties • ✅ ${winRate}% de victoires`, {
            fontSize: '12px',
            fill: '#bdc3c7',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        this.welcomePanel = { panelBg, welcomeText, subtitleText, statsText };
    }

    createSecurityPanel() {
        const { width } = this.scale;
        
        // Panel sécurité
        const securityBg = this.add.graphics();
        securityBg.fillStyle(0x2c3e50, 0.8);
        securityBg.lineStyle(2, 0x3498db, 0.6);
        securityBg.fillRoundedRect(50, 220, 300, 150, 10);
        securityBg.strokeRoundedRect(50, 220, 300, 150, 10);
        
        // Titre sécurité
        const securityTitle = this.add.text(200, 240, '🛡️ État de Sécurité', {
            fontSize: '18px',
            fill: '#3498db',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Niveau de sécurité
        const securityLevel = this.currentUser?.accountInfo?.securityLevel || 'BASIC';
        const levelIcon = securityLevel === 'CRYPTO_GRADE' ? '💎' : 
                         securityLevel === 'ENHANCED' ? '🛡️' : '🔰';
        
        this.securityIndicators.level = this.add.text(200, 265, 
            `${levelIcon} Niveau: ${securityLevel}`, {
            fontSize: '14px',
            fill: securityLevel === 'CRYPTO_GRADE' ? '#2ecc71' : 
                  securityLevel === 'ENHANCED' ? '#3498db' : '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        // Session info
        const tokenInfo = auth.getTokenInfo();
        const timeLeft = tokenInfo ? Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60)) : 0;
        
        this.securityIndicators.session = this.add.text(200, 285, 
            `⏱️ Session: ${timeLeft}min restantes`, {
            fontSize: '12px',
            fill: timeLeft > 10 ? '#2ecc71' : timeLeft > 5 ? '#f39c12' : '#e74c3c',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        // Connexions récentes
        const loginCount = this.currentUser?.accountInfo?.loginCount || 0;
        this.securityIndicators.logins = this.add.text(200, 305, 
            `🔑 ${loginCount} connexions`, {
            fontSize: '12px',
            fill: '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        // Statut 2FA (pour plus tard)
        const twoFactorEnabled = this.currentUser?.accountInfo?.twoFactorEnabled || false;
        this.securityIndicators.twoFactor = this.add.text(200, 325, 
            `📱 2FA: ${twoFactorEnabled ? 'Activé' : 'Inactif'}`, {
            fontSize: '12px',
            fill: twoFactorEnabled ? '#2ecc71' : '#e74c3c',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        this.securityPanel = { securityBg, securityTitle };
    }

    createWalletPanel() {
        const { width } = this.scale;
        
        // Panel wallet crypto
        const walletBg = this.add.graphics();
        walletBg.fillStyle(0x8e44ad, 0.8);
        walletBg.lineStyle(2, 0x9b59b6, 0.6);
        walletBg.fillRoundedRect(width - 350, 220, 300, 150, 10);
        walletBg.strokeRoundedRect(width - 350, 220, 300, 150, 10);
        
        // Titre wallet
        const walletTitle = this.add.text(width - 200, 240, '💰 Portefeuille Crypto', {
            fontSize: '18px',
            fill: '#9b59b6',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Statut MetaMask (placeholder pour l'instant)
        this.walletIndicators = {
            status: this.add.text(width - 200, 265, '🦊 MetaMask: Non connecté', {
                fontSize: '14px',
                fill: '#e74c3c',
                fontFamily: 'Roboto, sans-serif'
            }).setOrigin(0.5),
            
            address: this.add.text(width - 200, 285, 'Adresse: Aucune', {
                fontSize: '12px',
                fill: '#95a5a6',
                fontFamily: 'Roboto, sans-serif'
            }).setOrigin(0.5),
            
            balance: this.add.text(width - 200, 305, 'Balance: -- ETH', {
                fontSize: '12px',
                fill: '#95a5a6',
                fontFamily: 'Roboto, sans-serif'
            }).setOrigin(0.5)
        };
        
        // Bouton connexion MetaMask (placeholder)
        this.connectWalletButton = this.createButton(width - 200, 335, 200, 25, '🔗 Connecter MetaMask', {
            fontSize: '12px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif'
        }, () => {
            this.handleWalletConnection();
        }, 0x9b59b6);
        
        this.walletPanel = { walletBg, walletTitle };
    }

    createNavigationPanel() {
        const { width, height } = this.scale;
        
        // Panel navigation
        const navBg = this.add.graphics();
        navBg.fillStyle(0x2c3e50, 0.9);
        navBg.lineStyle(2, 0x34495e, 0.8);
        navBg.fillRoundedRect(width/2 - 250, height - 180, 500, 120, 15);
        navBg.strokeRoundedRect(width/2 - 250, width/2 - 250, 500, 120, 15);
        
        // Titre navigation
        const navTitle = this.add.text(width/2, height - 160, '🎮 Accès Rapide', {
            fontSize: '20px',
            fill: '#ecf0f1',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Boutons de navigation
        const buttonY = height - 120;
        
        // Bouton vers le jeu
        this.playButton = this.createButton(width/2 - 120, buttonY, 100, 40, '🚀 Jouer', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }, () => {
            this.goToGame();
        }, 0x27ae60);
        
        // Bouton paramètres
        this.settingsButton = this.createButton(width/2 + 20, buttonY, 100, 40, '⚙️ Paramètres', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }, () => {
            this.openSettings();
        }, 0x34495e);
        
        this.navigationPanel = { navBg, navTitle };
    }

    createLogoutButton() {
        const { width } = this.scale;
        
        const logoutBtn = this.add.text(width - 20, 20, '🚪 Déconnexion', {
            fontSize: '14px',
            fill: '#e74c3c',
            fontFamily: 'Roboto, sans-serif',
            padding: { x: 15, y: 8 },
            backgroundColor: '#2c3e50',
            borderRadius: 8
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

    createButton(x, y, width, height, text, textStyle, callback, color = 0x3498db) {
        const container = this.add.container(x, y);
        
        // Background
        const bg = this.add.graphics();
        bg.fillStyle(color, 0.8);
        bg.fillRoundedRect(-width/2, -height/2, width, height, 8);
        
        // Texte
        const buttonText = this.add.text(0, 0, text, textStyle).setOrigin(0.5);
        
        container.add([bg, buttonText]);
        container.setSize(width, height);
        container.setInteractive()
            .on('pointerover', () => {
                bg.clear();
                bg.fillStyle(color, 1);
                bg.fillRoundedRect(-width/2, -height/2, width, height, 8);
                container.setScale(1.05);
            })
            .on('pointerout', () => {
                bg.clear();
                bg.fillStyle(color, 0.8);
                bg.fillRoundedRect(-width/2, -height/2, width, height, 8);
                container.setScale(1);
            })
            .on('pointerdown', () => {
                container.setScale(0.95);
                callback();
            })
            .on('pointerup', () => {
                container.setScale(1.05);
            });
        
        return container;
    }

    setupKeyboardControls() {
        // Navigation clavier
        this.input.keyboard.on('keydown-ENTER', () => {
            this.goToGame();
        });
        
        this.input.keyboard.on('keydown-ESC', () => {
            this.handleSecureLogout();
        });
        
        this.input.keyboard.on('keydown-TAB', (event) => {
            event.preventDefault();
            this.openSettings();
        });
    }

    setupSecurityMonitoring() {
        // Mise à jour des indicateurs de sécurité toutes les 30 secondes
        this.securityTimer = this.time.addEvent({
            delay: 30000,
            callback: () => {
                this.updateSecurityIndicators();
            },
            loop: true
        });
    }

    updateSecurityIndicators() {
        if (!this.securityIndicators.session) return;
        
        const tokenInfo = auth.getTokenInfo();
        if (tokenInfo) {
            const timeLeft = Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60));
            
            this.securityIndicators.session.setText(`⏱️ Session: ${timeLeft}min restantes`);
            
            // Changer couleur selon temps restant
            if (timeLeft <= 2) {
                this.securityIndicators.session.setFill('#e74c3c');
            } else if (timeLeft <= 5) {
                this.securityIndicators.session.setFill('#f39c12');
            } else {
                this.securityIndicators.session.setFill('#2ecc71');
            }
        }
    }

    playEntranceAnimation() {
        // Animation d'entrée fluide
        const elements = [
            this.welcomePanel?.panelBg,
            this.securityPanel?.securityBg,
            this.walletPanel?.walletBg,
            this.navigationPanel?.navBg
        ].filter(Boolean);
        
        elements.forEach((element, index) => {
            element.setAlpha(0);
            element.setScale(0.8);
            
            this.tweens.add({
                targets: element,
                alpha: 1,
                scaleX: 1,
                scaleY: 1,
                duration: 600,
                delay: index * 150,
                ease: 'Back.easeOut'
            });
        });
    }

    async refreshUserData() {
        try {
            console.log('🔄 Refresh des données utilisateur...');
            
            const response = await user.getProfile();
            if (response.success && response.user) {
                this.currentUser = response.user;
                this.gameInstance?.setCurrentUser(response.user);
                this.registry.set('currentUser', response.user);
                
                // Mettre à jour l'affichage
                this.updateWelcomePanel();
            }
        } catch (error) {
            console.error('❌ Erreur refresh utilisateur:', error);
            
            if (error.message.includes('session') || error.message.includes('token')) {
                this.scene.start('AuthScene');
            }
        }
    }

    updateWelcomePanel() {
        if (!this.welcomePanel || !this.currentUser) return;
        
        // Mettre à jour les stats affichées
        const level = this.currentUser.playerStats?.level || 1;
        const trophies = this.currentUser.playerStats?.trophies || 0;
        
        if (this.welcomePanel.subtitleText) {
            this.welcomePanel.subtitleText.setText(
                `Niveau ${level} • 🏆 ${window.GameUtils.formatNumber(trophies)} trophées`
            );
        }
    }

    // Actions des boutons
    handleWalletConnection() {
        // Placeholder pour connexion MetaMask
        window.NotificationManager?.show('Connexion MetaMask - Bientôt disponible !', 'info');
        console.log('🦊 Connexion MetaMask demandée (à implémenter)');
    }

    goToGame() {
        console.log('🎮 Transition vers le jeu...');
        this.scene.start('MenuScene');
    }

    openSettings() {
        console.log('⚙️ Ouverture paramètres...');
        window.NotificationManager?.show('Paramètres - Bientôt disponible !', 'info');
    }

    async handleSecureLogout() {
        const confirmLogout = confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
        if (!confirmLogout) return;

        try {
            console.log('🚪 Déconnexion sécurisée...');
            
            this.cleanup();
            await auth.logout();
            this.gameInstance?.clearAuthData();
            
            window.NotificationManager?.success('Déconnexion sécurisée réussie');
            this.scene.start('AuthScene');
            
        } catch (error) {
            console.error('❌ Erreur lors de la déconnexion:', error);
            
            this.cleanup();
            this.gameInstance?.clearAuthData();
            
            window.NotificationManager?.show('Déconnexion locale effectuée', 'info');
            this.scene.start('AuthScene');
        }
    }

    update() {
        // Vérification d'authentification
        if (this.scene.isActive() && !auth.isAuthenticated()) {
            console.warn('⚠️ Perte d\'authentification détectée dans WelcomeScene');
            this.cleanup();
            this.scene.start('AuthScene');
        }
    }

    cleanup() {
        // Nettoyer les timers
        if (this.securityTimer) {
            this.securityTimer.destroy();
            this.securityTimer = null;
        }
    }

    destroy() {
        this.cleanup();
        super.destroy();
    }
}
