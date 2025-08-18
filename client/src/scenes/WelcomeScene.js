// client/src/scenes/WelcomeScene.js
import Phaser from 'phaser';
import { auth, user, crypto } from '../api';

export default class WelcomeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WelcomeScene' });
        
        this.currentUser = null;
        this.gameInstance = null;
        this.walletStatus = {
            isConnected: false,
            address: null,
            isConnecting: false,
            error: null
        };
        this.elements = {};
        this.animations = [];
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
        this.createHeader();
        this.createWelcomePanel();
        this.createWalletSection();
        this.createNavigationButtons();
        this.createFooter();
        this.setupSecurityHooks();
        
        // Configuration des événements
        this.setupKeyboardControls();
        
        // Animation d'entrée
        this.playEntranceAnimation();
        
        // Vérifier le statut du wallet existant
        this.checkExistingWallet();
    }

    createBackground() {
        const { width, height } = this.scale;
        
        // Dégradé de fond plus doux
        const background = this.add.graphics();
        background.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e);
        background.fillRect(0, 0, width, height);
        
        // Particules d'ambiance
        this.createAmbientParticles();
    }

    createAmbientParticles() {
        const { width, height } = this.scale;
        
        // Étoiles scintillantes
        for (let i = 0; i < 20; i++) {
            const star = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(1, 2),
                0xffffff,
                Phaser.Math.Between(0.2, 0.6)
            );
            
            this.tweens.add({
                targets: star,
                alpha: { from: 0.2, to: 0.8 },
                duration: Phaser.Math.Between(2000, 4000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    createHeader() {
        const { width } = this.scale;
        
        // Logo ChimArena
        this.elements.logo = this.add.text(width / 2, 80, 'ChimArena', {
            fontSize: '42px',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: '#0f3460',
            strokeThickness: 3
        }).setOrigin(0.5);

        // Indicateur de sécurité
        this.elements.securityBadge = this.add.text(width / 2, 110, '🔐 Session Crypto-Grade Sécurisée', {
            fontSize: '14px',
            fontFamily: 'Roboto, sans-serif',
            fill: '#2ecc71',
            backgroundColor: '#1e3a4a',
            padding: { x: 15, y: 5 },
            borderRadius: 15
        }).setOrigin(0.5);

        // Bouton de déconnexion (coin supérieur droit)
        this.createLogoutButton();
    }

    createLogoutButton() {
        const { width } = this.scale;
        
        this.elements.logoutBtn = this.add.text(width - 25, 25, '🚪 Déconnexion', {
            fontSize: '14px',
            fill: '#e74c3c',
            fontFamily: 'Roboto, sans-serif',
            backgroundColor: '#2c3e50',
            padding: { x: 12, y: 8 },
            borderRadius: 8
        })
        .setOrigin(1, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
            this.elements.logoutBtn.setFill('#ff6b6b');
            this.elements.logoutBtn.setScale(1.05);
        })
        .on('pointerout', () => {
            this.elements.logoutBtn.setFill('#e74c3c');
            this.elements.logoutBtn.setScale(1);
        })
        .on('pointerdown', () => {
            this.handleSecureLogout();
        });
    }

    createWelcomePanel() {
        const { width } = this.scale;
        const user = this.currentUser;
        
        if (!user) return;
        
        // Panel principal
        const panelBg = this.add.graphics();
        panelBg.fillStyle(0x2c3e50, 0.9);
        panelBg.lineStyle(2, 0x3498db);
        panelBg.fillRoundedRect(width / 2 - 250, 160, 500, 120, 12);
        panelBg.strokeRoundedRect(width / 2 - 250, 160, 500, 120, 12);
        
        // Message de bienvenue
        this.elements.welcomeTitle = this.add.text(width / 2, 190, `Bienvenue, ${user.username} !`, {
            fontSize: '28px',
            fill: '#f39c12',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Sous-titre avec infos de sécurité
        const securityLevel = user.accountInfo?.securityLevel || 'BASIC';
        const securityIcon = securityLevel === 'CRYPTO_GRADE' ? '💎' : securityLevel === 'ENHANCED' ? '🛡️' : '🔰';
        
        this.elements.securityInfo = this.add.text(width / 2, 220, 
            `${securityIcon} Niveau sécurité: ${securityLevel}`, {
            fontSize: '16px',
            fill: securityLevel === 'CRYPTO_GRADE' ? '#2ecc71' : securityLevel === 'ENHANCED' ? '#3498db' : '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);

        // Stats rapides
        const level = user.playerStats?.level || 1;
        const trophies = user.playerStats?.trophies || 0;
        
        this.elements.playerStats = this.add.text(width / 2, 250, 
            `🏆 ${window.GameUtils.formatNumber(trophies)} trophées • ⭐ Niveau ${level}`, {
            fontSize: '14px',
            fill: '#ecf0f1',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
    }

    createWalletSection() {
        const { width } = this.scale;
        
        // Section wallet
        const walletBg = this.add.graphics();
        walletBg.fillStyle(0x34495e, 0.8);
        walletBg.lineStyle(2, 0x9b59b6);
        walletBg.fillRoundedRect(width / 2 - 300, 300, 600, 150, 12);
        walletBg.strokeRoundedRect(width / 2 - 300, 600, 150, 12);
        
        // Titre section wallet
        this.elements.walletTitle = this.add.text(width / 2, 330, '💰 Wallet Crypto', {
            fontSize: '22px',
            fill: '#9b59b6',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);

        // Status du wallet
        this.elements.walletStatus = this.add.text(width / 2, 365, 'Aucun wallet connecté', {
            fontSize: '16px',
            fill: '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);

        // Bouton de connexion MetaMask
        this.createMetaMaskButton();
        
        // Message d'info sécurité
        this.elements.walletSecurityInfo = this.add.text(width / 2, 425, 
            '🔐 Les clés privées ne transitent JAMAIS par nos serveurs', {
            fontSize: '12px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
    }

    createMetaMaskButton() {
        const { width } = this.scale;
        
        // Détecter si MetaMask est disponible
        const hasMetaMask = typeof window.ethereum !== 'undefined';
        
        this.elements.metaMaskBtn = this.add.text(width / 2, 390, 
            hasMetaMask ? '🦊 Connecter MetaMask' : '🦊 Installer MetaMask', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold',
            backgroundColor: hasMetaMask ? '#f6851b' : '#7f8c8d',
            padding: { x: 20, y: 10 },
            borderRadius: 10
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
            this.elements.metaMaskBtn.setScale(1.05);
        })
        .on('pointerout', () => {
            this.elements.metaMaskBtn.setScale(1);
        })
        .on('pointerdown', () => {
            if (hasMetaMask) {
                this.connectMetaMask();
            } else {
                window.open('https://metamask.io/', '_blank');
            }
        });
    }

    createNavigationButtons() {
        const { width } = this.scale;
        
        // Bouton Jouer
        this.elements.playBtn = this.add.text(width / 2 - 100, 500, '🎮 Jouer', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold',
            backgroundColor: '#2ecc71',
            padding: { x: 25, y: 12 },
            borderRadius: 10
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
            this.elements.playBtn.setScale(1.05);
            this.elements.playBtn.setBackgroundColor('#27ae60');
        })
        .on('pointerout', () => {
            this.elements.playBtn.setScale(1);
            this.elements.playBtn.setBackgroundColor('#2ecc71');
        })
        .on('pointerdown', () => {
            this.startGame();
        });

        // Bouton Paramètres
        this.elements.settingsBtn = this.add.text(width / 2 + 100, 500, '⚙️ Paramètres', {
            fontSize: '20px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold',
            backgroundColor: '#3498db',
            padding: { x: 25, y: 12 },
            borderRadius: 10
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
            this.elements.settingsBtn.setScale(1.05);
            this.elements.settingsBtn.setBackgroundColor('#2980b9');
        })
        .on('pointerout', () => {
            this.elements.settingsBtn.setScale(1);
            this.elements.settingsBtn.setBackgroundColor('#3498db');
        })
        .on('pointerdown', () => {
            this.openSettings();
        });
    }

    createFooter() {
        const { width, height } = this.scale;
        
        // Info session
        const tokenInfo = auth.getTokenInfo();
        if (tokenInfo) {
            const timeLeft = Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60));
            this.elements.sessionInfo = this.add.text(width / 2, height - 60, 
                `🕐 Session active • ${timeLeft} minutes restantes`, {
                fontSize: '12px',
                fill: timeLeft > 10 ? '#2ecc71' : timeLeft > 5 ? '#f39c12' : '#e74c3c',
                fontFamily: 'Roboto, sans-serif'
            }).setOrigin(0.5);
        }

        // Contrôles
        this.elements.controls = this.add.text(width / 2, height - 40, 
            'ESC: Déconnexion • ESPACE: Jouer • TAB: Paramètres', {
            fontSize: '10px',
            fill: '#7f8c8d',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);

        // Version et sécurité
        this.elements.version = this.add.text(width / 2, height - 20, 
            `ChimArena v${window.GameConfig?.VERSION || '0.1.0'} • Sécurité Crypto-Grade`, {
            fontSize: '10px',
            fill: '#7f8c8d',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
    }

    // Connexion MetaMask sécurisée
    async connectMetaMask() {
        if (this.walletStatus.isConnecting) return;
        
        try {
            this.setWalletConnecting(true);
            
            // Vérifier que MetaMask est disponible
            if (typeof window.ethereum === 'undefined') {
                throw new Error('MetaMask non détecté');
            }

            console.log('🦊 Connexion à MetaMask...');
            
            // Demander l'accès aux comptes
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('Aucun compte MetaMask sélectionné');
            }

            const address = accounts[0];
            console.log('✅ Compte MetaMask connecté:', address);

            // Demander signature pour vérification (sécurité)
            const message = `ChimArena - Connexion wallet\nAdresse: ${address}\nTimestamp: ${Date.now()}`;
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, address]
            });

            console.log('✅ Signature obtenue');

            // Envoyer au serveur pour vérification et enregistrement sécurisé
            const response = await crypto.connectWallet({
                address,
                signature,
                message
            });

            if (response.success) {
                this.setWalletConnected(address);
                window.NotificationManager.success('Wallet MetaMask connecté avec succès !');
                
                // Mettre à jour les données utilisateur
                this.refreshUserData();
            } else {
                throw new Error(response.message || 'Erreur de connexion wallet');
            }

        } catch (error) {
            console.error('❌ Erreur connexion MetaMask:', error);
            this.setWalletError(error.message);
            
            if (error.code === 4001) {
                window.NotificationManager.show('Connexion MetaMask annulée', 'info');
            } else {
                window.NotificationManager.error(`Erreur: ${error.message}`);
            }
        } finally {
            this.setWalletConnecting(false);
        }
    }

    setWalletConnecting(isConnecting) {
        this.walletStatus.isConnecting = isConnecting;
        
        if (isConnecting) {
            this.elements.walletStatus.setText('🔄 Connexion en cours...');
            this.elements.walletStatus.setFill('#f39c12');
            this.elements.metaMaskBtn.setText('🔄 Connexion...');
            this.elements.metaMaskBtn.setBackgroundColor('#95a5a6');
        }
    }

    setWalletConnected(address) {
        this.walletStatus.isConnected = true;
        this.walletStatus.address = address;
        this.walletStatus.error = null;
        
        const shortAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
        this.elements.walletStatus.setText(`✅ Connecté: ${shortAddress}`);
        this.elements.walletStatus.setFill('#2ecc71');
        this.elements.metaMaskBtn.setText('🔗 Wallet Connecté');
        this.elements.metaMaskBtn.setBackgroundColor('#2ecc71');
    }

    setWalletError(error) {
        this.walletStatus.error = error;
        this.elements.walletStatus.setText(`❌ Erreur: ${error}`);
        this.elements.walletStatus.setFill('#e74c3c');
        this.elements.metaMaskBtn.setText('🦊 Réessayer');
        this.elements.metaMaskBtn.setBackgroundColor('#f6851b');
    }

    async checkExistingWallet() {
        try {
            const walletInfo = await crypto.getWallet();
            if (walletInfo.success && walletInfo.wallet) {
                this.setWalletConnected(walletInfo.wallet.address);
            }
        } catch (error) {
            console.warn('⚠️ Impossible de récupérer les infos wallet:', error);
        }
    }

    async refreshUserData() {
        try {
            const userData = await user.getProfile();
            if (userData.success && userData.user) {
                this.currentUser = userData.user;
                this.gameInstance?.setCurrentUser(userData.user);
                this.registry.set('currentUser', userData.user);
            }
        } catch (error) {
            console.error('❌ Erreur refresh utilisateur:', error);
        }
    }

    setupSecurityHooks() {
        // Hook pour déconnexion automatique
        if (auth.config && auth.config.onAuthenticationLost) {
            auth.config.onAuthenticationLost((reason) => {
                console.warn('🚨 Authentification perdue:', reason);
                this.cleanup();
                window.NotificationManager.error(`Session expirée: ${reason}`);
                this.scene.start('AuthScene');
            });
        }

        // Hook pour refresh automatique
        if (auth.config && auth.config.onTokenRefreshed) {
            auth.config.onTokenRefreshed(() => {
                console.log('🔄 Token rafraîchi automatiquement');
                this.refreshUserData();
            });
        }
    }

    setupKeyboardControls() {
        // ESC: Déconnexion
        this.input.keyboard.on('keydown-ESC', () => {
            this.handleSecureLogout();
        });
        
        // SPACE: Jouer
        this.input.keyboard.on('keydown-SPACE', () => {
            this.startGame();
        });
        
        // TAB: Paramètres
        this.input.keyboard.on('keydown-TAB', (event) => {
            event.preventDefault();
            this.openSettings();
        });
    }

    playEntranceAnimation() {
        // Animation des éléments principaux
        const elementsToAnimate = [
            this.elements.logo,
            this.elements.securityBadge,
            this.elements.welcomeTitle,
            this.elements.securityInfo,
            this.elements.playerStats,
            this.elements.walletTitle,
            this.elements.walletStatus,
            this.elements.metaMaskBtn,
            this.elements.playBtn,
            this.elements.settingsBtn
        ];

        elementsToAnimate.forEach((element, index) => {
            if (!element) return;
            
            element.setAlpha(0);
            element.setY(element.y + 30);
            
            this.tweens.add({
                targets: element,
                alpha: 1,
                y: element.y - 30,
                duration: 600,
                delay: index * 100,
                ease: 'Back.easeOut'
            });
        });
    }

    // Actions
    startGame() {
        console.log('🎮 Démarrage du jeu...');
        
        // Animation de sortie
        this.tweens.add({
            targets: [this.elements.playBtn],
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 100,
            yoyo: true,
            onComplete: () => {
                // Transition vers MenuScene (ou GameScene selon votre architecture)
                this.scene.start('MenuScene');
            }
        });
    }

    openSettings() {
        console.log('⚙️ Ouverture des paramètres...');
        window.NotificationManager.show('Paramètres - Bientôt disponible !', 'info');
        // TODO: Créer SettingsScene
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
        // Vérification périodique de l'état d'authentification
        if (this.scene.isActive() && auth && !auth.isAuthenticated()) {
            console.warn('⚠️ Perte d\'authentification détectée');
            this.cleanup();
            this.scene.start('AuthScene');
            return;
        }

        // Mise à jour de l'indicateur de session
        if (this.elements.sessionInfo && auth && auth.getTokenInfo) {
            const tokenInfo = auth.getTokenInfo();
            if (tokenInfo) {
                const timeLeft = Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60));
                
                if (timeLeft <= 2) {
                    this.elements.sessionInfo.setFill('#e74c3c');
                    this.elements.sessionInfo.setText('🕐 Session expire dans quelques instants...');
                } else if (timeLeft <= 5) {
                    this.elements.sessionInfo.setFill('#f39c12');
                    this.elements.sessionInfo.setText(`🕐 Session expire dans ${timeLeft}min`);
                } else {
                    this.elements.sessionInfo.setFill('#2ecc71');
                    this.elements.sessionInfo.setText(`🕐 Session active • ${timeLeft}min restantes`);
                }
            }
        }
    }

    cleanup() {
        // Nettoyer les hooks de sécurité
        if (auth && auth.config) {
            if (auth.config.onAuthenticationLost) {
                auth.config.onAuthenticationLost(null);
            }
            if (auth.config.onTokenRefreshed) {
                auth.config.onTokenRefreshed(null);
            }
        }

        // Arrêter toutes les animations
        this.tweens.killAll();
    }

    destroy() {
        this.cleanup();
        super.destroy();
    }
}
