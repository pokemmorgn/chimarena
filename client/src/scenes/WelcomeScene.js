// client/src/scenes/WelcomeScene.js - VERSION PORTRAIT OPTIMISÉE

import Phaser from 'phaser';
import { auth, user, crypto, config } from '../api';
import metaMaskHelper from '../utils/metamask';

export default class WelcomeScene extends Phaser.Scene {
    constructor() {
        super({ key: 'WelcomeScene' });
        
        this.currentUser = null;
        this.gameInstance = null;
        this.securityTimer = null;
        this.refreshTimer = null;
        
        // 💰 ÉTAT CRYPTO
        this.walletInfo = null;
        this.isConnectingWallet = false;
        this.metaMaskHelper = null;
        
        // UI Elements
        this.walletSection = null;
        this.connectWalletButton = null;
        this.walletInfoPanel = null;
        this.securityIndicators = {};

        // 📱 VARIABLES PORTRAIT
        this.isPortrait = true;
        this.isMobile = window.GameConfig?.MOBILE_OPTIMIZED || false;
    }

    create() {
        console.log('🏠 WelcomeScene créée en mode PORTRAIT');
        
        // Références
        this.gameInstance = this.registry.get('gameInstance');
        this.currentUser = this.registry.get('currentUser');
        
        // Vérifier l'authentification
        if (!auth.isAuthenticated()) {
            console.warn('❌ Utilisateur non authentifié, redirection vers AuthScene');
            this.scene.start('AuthScene');
            return;
        }
        
        // Initialiser MetaMask Helper
        this.metaMaskHelper = metaMaskHelper;
        
        // 📱 CRÉATION UI PORTRAIT
        this.createPortraitBackground();
        this.createPortraitHeader();
        this.createPortraitWelcomePanel();
        this.createPortraitSecurityIndicators();
        this.createPortraitWalletSection();
        this.createPortraitNavigationButtons();
        this.createPortraitFooter();
        
        // Configuration des événements
        this.setupKeyboardControls();
        this.setupSecurityHooks();
        
        // Animation d'entrée
        this.playEntranceAnimation();
        
        // Charger les données
        this.refreshUserData();
        this.startAutoRefresh();
        
        // Vérifier l'état du wallet
        this.checkWalletStatus();
    }

    // 📱 FOND ADAPTÉ AU PORTRAIT
    createPortraitBackground() {
        const { width, height } = this.scale;
        
        // Dégradé vertical pour portrait
        const background = this.add.graphics();
        background.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e, 1);
        background.fillRect(0, 0, width, height);
        
        // Particules adaptées au format portrait
        this.createPortraitParticles();
    }

    createPortraitParticles() {
        const { width, height } = this.scale;
        
        // Moins de particules sur mobile pour la performance
        const particleCount = this.isMobile ? 10 : 15;
        
        for (let i = 0; i < particleCount; i++) {
            const orb = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(10, 25), // Plus petites sur mobile
                [0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6][i % 4],
                0.15
            );
            
            this.tweens.add({
                targets: orb,
                x: orb.x + Phaser.Math.Between(-50, 50),
                y: orb.y + Phaser.Math.Between(-50, 50),
                alpha: { from: 0.05, to: 0.2 },
                scale: { from: 0.8, to: 1.1 },
                duration: Phaser.Math.Between(4000, 8000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    // 📱 HEADER PORTRAIT
    createPortraitHeader() {
        const { width } = this.scale;
        
        // Logo plus petit en haut
        this.add.text(width / 2, 40, 'ChimArena', {
            fontSize: this.isMobile ? '24px' : '28px',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: '#2c3e50',
            strokeThickness: 1
        }).setOrigin(0.5);

        // Bouton de déconnexion en haut à droite
        this.createPortraitLogoutButton();
    }

    createPortraitLogoutButton() {
        const { width } = this.scale;
        
        const logoutBtn = this.add.text(width - 15, 15, '🚪', {
            fontSize: this.isMobile ? '18px' : '20px',
            fill: '#e74c3c',
            fontFamily: 'Roboto, sans-serif',
            padding: { x: 8, y: 8 },
            backgroundColor: '#2c3e50',
            borderRadius: 5
        })
        .setOrigin(1, 0)
        .setInteractive()
        .on('pointerover', () => logoutBtn.setTint(0xff6b6b))
        .on('pointerout', () => logoutBtn.clearTint())
        .on('pointerdown', () => this.handleSecureLogout());
    }

    // 📱 PANEL DE BIENVENUE PORTRAIT
    createPortraitWelcomePanel() {
        const { width } = this.scale;
        const user = this.currentUser;
        
        if (!user) return;
        
        const panelY = 80;
        const panelHeight = this.isMobile ? 100 : 120;
        
        // Panel principal d'accueil
        const welcomePanel = this.add.graphics();
        welcomePanel.fillStyle(0x2c3e50, 0.9);
        welcomePanel.fillRoundedRect(20, panelY, width - 40, panelHeight, 10);
        welcomePanel.lineStyle(2, 0x3498db);
        welcomePanel.strokeRoundedRect(20, panelY, width - 40, panelHeight, 10);
        
        // Message de bienvenue personnalisé
        const timeOfDay = this.getTimeOfDay();
        const fontSize = this.isMobile ? '18px' : '20px';
        
        this.add.text(width / 2, panelY + 25, `${timeOfDay}, ${user.username} !`, {
            fontSize,
            fill: '#f39c12',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Sous-titre avec niveau de sécurité
        const securityLevel = user.accountInfo?.securityLevel || 'BASIC';
        const securityIcon = securityLevel === 'CRYPTO_GRADE' ? '💎' : securityLevel === 'ENHANCED' ? '🛡️' : '🔰';
        
        this.add.text(width / 2, panelY + 50, `${securityIcon} Sécurité: ${securityLevel}`, {
            fontSize: this.isMobile ? '12px' : '14px',
            fill: securityLevel === 'CRYPTO_GRADE' ? '#2ecc71' : securityLevel === 'ENHANCED' ? '#3498db' : '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        // Stats rapides en ligne pour portrait
        const level = user.playerStats?.level || 1;
        const trophies = user.playerStats?.trophies || 0;
        const winRate = user.winRate || 0;
        
        const statsY = panelY + 75;
        const statsSpacing = width / 4;
        
        this.add.text(statsSpacing, statsY, `Niv. ${level}`, {
            fontSize: this.isMobile ? '12px' : '14px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        this.add.text(statsSpacing * 2, statsY, `🏆 ${window.GameUtils.formatNumber(trophies)}`, {
            fontSize: this.isMobile ? '12px' : '14px',
            fill: '#f1c40f',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        this.add.text(statsSpacing * 3, statsY, `${winRate}% 📊`, {
            fontSize: this.isMobile ? '12px' : '14px',
            fill: '#9b59b6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
    }

    // 📱 INDICATEURS DE SÉCURITÉ PORTRAIT
    createPortraitSecurityIndicators() {
        const { width } = this.scale;
        const indicatorY = this.isMobile ? 200 : 220;
        
        // Panel indicateurs de sécurité plus compact
        const securityPanel = this.add.graphics();
        securityPanel.fillStyle(0x34495e, 0.8);
        securityPanel.fillRoundedRect(20, indicatorY, width - 40, 50, 8);
        
        this.add.text(30, indicatorY + 10, '🔐 État de sécurité', {
            fontSize: this.isMobile ? '12px' : '14px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        });
        
        // Indicateurs en ligne pour économiser l'espace
        const indicatorSpacing = (width - 60) / 3;
        
        this.securityIndicators.session = this.add.text(30, indicatorY + 30, '✅ Session', {
            fontSize: this.isMobile ? '10px' : '11px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        });
        
        this.securityIndicators.token = this.add.text(30 + indicatorSpacing, indicatorY + 30, '🔄 Token', {
            fontSize: this.isMobile ? '10px' : '11px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        });
        
        this.securityIndicators.wallet = this.add.text(30 + indicatorSpacing * 2, indicatorY + 30, '💰 Wallet: Non', {
            fontSize: this.isMobile ? '10px' : '11px',
            fill: '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        });
    }

    // 📱 SECTION WALLET PORTRAIT
    createPortraitWalletSection() {
        const { width } = this.scale;
        const walletY = this.isMobile ? 270 : 290;
        
        // Section MetaMask plus compacte
        this.walletSection = this.add.container(width / 2, walletY + 60);
        
        // Background wallet section
        const walletBg = this.add.graphics();
        walletBg.fillStyle(0x2c3e50, 0.9);
        walletBg.fillRoundedRect(-(width/2 - 20), -50, width - 40, 100, 10);
        walletBg.lineStyle(2, 0xf39c12);
        walletBg.strokeRoundedRect(-(width/2 - 20), -50, width - 40, 100, 10);
        
        // Titre section
        const walletTitle = this.add.text(0, -30, '💰 Portefeuille Crypto', {
            fontSize: this.isMobile ? '14px' : '16px',
            fill: '#f39c12',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        this.walletSection.add([walletBg, walletTitle]);
        
        // Vérifier la disponibilité de MetaMask
        if (window.GameConstants?.CRYPTO?.METAMASK_AVAILABLE) {
            this.createPortraitMetaMaskInterface();
        } else {
            this.createPortraitNoMetaMaskMessage();
        }
    }

    createPortraitMetaMaskInterface() {
        // État initial selon le wallet connecté
        if (this.currentUser?.cryptoWallet?.address) {
            this.createPortraitConnectedWalletInterface();
        } else {
            this.createPortraitConnectWalletInterface();
        }
    }

    createPortraitConnectWalletInterface() {
        // Bouton de connexion MetaMask plus compact
        this.connectWalletButton = this.add.text(0, 0, '🦊 Connecter MetaMask', {
            fontSize: this.isMobile ? '13px' : '15px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold',
            backgroundColor: '#f6851b',
            padding: { x: 15, y: 8 },
            borderRadius: 6
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerover', () => this.connectWalletButton.setTint(0xffa726))
        .on('pointerout', () => this.connectWalletButton.clearTint())
        .on('pointerdown', () => this.connectWallet());
        
        // Message informatif plus court
        const infoText = this.add.text(0, 25, 'Accédez aux fonctionnalités crypto', {
            fontSize: this.isMobile ? '10px' : '11px',
            fill: '#bdc3c7',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        this.walletSection.add([this.connectWalletButton, infoText]);
    }

    createPortraitConnectedWalletInterface() {
        const walletData = this.currentUser.cryptoWallet;
        
        // Adresse wallet formatée - plus compact
        const addressText = this.add.text(0, -10, `📍 ${window.GameUtils.formatEthereumAddress(walletData.address)}`, {
            fontSize: this.isMobile ? '11px' : '12px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        // Statut de connexion
        const statusText = this.add.text(0, 5, `✅ Connecté`, {
            fontSize: this.isMobile ? '10px' : '11px',
            fill: '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        // Bouton déconnexion plus petit
        const disconnectBtn = this.add.text(0, 25, '🔌 Déconnecter', {
            fontSize: this.isMobile ? '11px' : '12px',
            fill: '#e74c3c',
            fontFamily: 'Roboto, sans-serif',
            backgroundColor: '#34495e',
            padding: { x: 8, y: 4 },
            borderRadius: 4
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerover', () => disconnectBtn.setTint(0xff6b6b))
        .on('pointerout', () => disconnectBtn.clearTint())
        .on('pointerdown', () => this.disconnectWallet());
        
        this.walletSection.add([addressText, statusText, disconnectBtn]);
        
        // Mettre à jour l'indicateur
        this.securityIndicators.wallet.setText('💰 Wallet: ✅');
        this.securityIndicators.wallet.setFill('#2ecc71');
    }

    createPortraitNoMetaMaskMessage() {
        const noMetaMaskText = this.add.text(0, -5, '⚠️ MetaMask requis', {
            fontSize: this.isMobile ? '13px' : '15px',
            fill: '#e74c3c',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        const installBtn = this.add.text(0, 20, '📥 Installer', {
            fontSize: this.isMobile ? '12px' : '13px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            backgroundColor: '#3498db',
            padding: { x: 12, y: 6 },
            borderRadius: 5
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => {
            window.open('https://metamask.io/', '_blank');
        });
        
        this.walletSection.add([noMetaMaskText, installBtn]);
    }

    // 📱 BOUTONS DE NAVIGATION PORTRAIT
   createPortraitNavigationButtons() {
    const { width, height } = this.scale;
    
    // Boutons en bas de l'écran
    const navY = height - (this.isMobile ? 100 : 120);
    
    // 🔄 CORRECTION: Rediriger vers ClashMenuScene au lieu de MenuScene
    this.createPortraitNavButton(width / 2, navY, '⚔️ JOUER', '#e74c3c', () => {
        this.scene.start('ClashMenuScene'); // ✅ CORRIGÉ
    }, true);
    
    // Bouton paramètres plus petit à côté
    this.createPortraitNavButton(width / 2, navY + (this.isMobile ? 35 : 40), '⚙️ Paramètres', '#7f8c8d', () => {
        window.NotificationManager.show('Paramètres - Bientôt disponible !', 'info');
    }, false);
}

    createPortraitNavButton(x, y, text, color, action, isPrimary = false) {
        const fontSize = isPrimary ? (this.isMobile ? '16px' : '18px') : (this.isMobile ? '12px' : '14px');
        const padding = isPrimary ? { x: 30, y: 12 } : { x: 15, y: 8 };
        
        const button = this.add.text(x, y, text, {
            fontSize,
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold',
            backgroundColor: color,
            padding,
            borderRadius: 8
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerover', () => button.setScale(1.05))
        .on('pointerout', () => button.setScale(1))
        .on('pointerdown', () => {
            this.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: action
            });
        });
        
        return button;
    }

    // 📱 FOOTER PORTRAIT
    createPortraitFooter() {
        const { width, height } = this.scale;
        
        // Informations de session en bas
        const tokenInfo = auth.getTokenInfo();
        if (tokenInfo) {
            const timeLeft = Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60));
            this.add.text(width / 2, height - 40, 
                `🔐 Session: ${timeLeft}min`, {
                fontSize: this.isMobile ? '9px' : '10px',
                fill: timeLeft > 5 ? '#2ecc71' : '#e74c3c',
                fontFamily: 'Roboto, sans-serif'
            }).setOrigin(0.5);
        }
        
        // Contrôles adaptés au portrait
        const controlsText = this.isMobile ? 
            'Touchez pour naviguer' : 
            'ESC: Déconnexion • ENTRÉE: Jouer';
            
        this.add.text(width / 2, height - 20, controlsText, {
            fontSize: this.isMobile ? '8px' : '9px',
            fill: '#7f8c8d',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
    }

    // === MÉTHODES UTILITAIRES ===

    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bonjour';
        if (hour < 18) return 'Bon après-midi';
        return 'Bonsoir';
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('fr-FR');
    }

    formatDateTime(date) {
        return date.toLocaleDateString('fr-FR') + ' à ' + date.toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    // === MÉTHODES EXISTANTES (MetaMask, etc.) ===
    
    async connectWallet() {
        if (this.isConnectingWallet) return;
        this.isConnectingWallet = true;

        if (this.connectWalletButton?.setText) {
            this.connectWalletButton.setText('🔄 Connexion...');
        }
        
        try {
            console.log('🦊 Tentative de connexion MetaMask...');
            
            const result = await this.metaMaskHelper.connectWallet();
            
            if (result?.success) {
                let w = result.walletInfo || result.wallet || result.data?.wallet;

                if (!w || !w.address || w.address.includes('...')) {
                    const wiResp = await crypto.getWalletInfo();
                    if (wiResp?.success && wiResp.wallet?.fullAddress) {
                        w = {
                            address: wiResp.wallet.fullAddress,
                            connectedAt: wiResp.wallet.connectedAt,
                            connectionCount: wiResp.wallet.connectionCount
                        };
                    }
                }

                if (!w || !w.address) {
                    throw new Error('Réponse serveur invalide (wallet manquant)');
                }

                const wallet = {
                    address: (w.fullAddress || w.address).toLowerCase(),
                    connectedAt: w.connectedAt || new Date().toISOString(),
                    connectionCount: w.connectionCount ?? 1,
                };

                this.updateWalletUI(wallet);
                this.gameInstance?.setCurrentUser(this.currentUser);
                this.registry.set('currentUser', this.currentUser);

                window.NotificationManager?.success('MetaMask connecté !');
                console.log('✅ MetaMask connecté et validé côté serveur');
            } else {
                throw new Error(result?.message || 'Échec validation serveur');
            }

        } catch (error) {
            console.error('❌ Erreur connexion wallet:', error);
            window.NotificationManager?.error(error.message || 'Erreur connexion wallet');
            if (this.connectWalletButton?.setText) {
                this.connectWalletButton.setText('🦊 Connecter MetaMask');
            }
        } finally {
            this.isConnectingWallet = false;
        }
    }

    async disconnectWallet() {
        try {
            console.log('🔌 Déconnexion du wallet...');
            
            const response = await crypto.disconnectWallet();
            
            if (response.success) {
                this.updateWalletUI(null);
                window.NotificationManager.success('Wallet déconnecté');
                console.log('✅ Wallet déconnecté');
            } else {
                throw new Error(response.message || 'Erreur déconnexion');
            }
            
        } catch (error) {
            console.error('❌ Erreur déconnexion wallet:', error);
            window.NotificationManager.error(error.message || 'Erreur déconnexion wallet');
        }
    }

    updateWalletUI(walletInfo) {
        if (walletInfo) {
            this.currentUser.cryptoWallet = walletInfo;
            this.securityIndicators.wallet.setText('💰 Wallet: ✅');
            this.securityIndicators.wallet.setFill('#2ecc71');
        } else {
            this.currentUser.cryptoWallet = null;
            this.securityIndicators.wallet.setText('💰 Wallet: Non');
            this.securityIndicators.wallet.setFill('#95a5a6');
        }

        this.walletSection.removeAll(true);
        this.createPortraitMetaMaskInterface();
    }

    // === MÉTHODES DE GESTION ===

    setupKeyboardControls() {
    if (!this.isMobile) {
        this.input.keyboard.on('keydown-ENTER', () => {
            this.scene.start('ClashMenuScene'); // ✅ CORRIGÉ
        });
        
        this.input.keyboard.on('keydown-ESC', () => {
            this.handleSecureLogout();
        });
    }
}

    setupSecurityHooks() {
        config.onAuthenticationLost((reason) => {
            console.warn('🚨 Authentification perdue:', reason);
            this.cleanup();
            window.NotificationManager?.error(`Session expirée: ${reason}`);
            this.scene.start('AuthScene');
        });
        
        config.onTokenRefreshed(() => {
            console.log('🔄 Token rafraîchi automatiquement');
            this.updateSecurityIndicators();
        });
    }

    playEntranceAnimation() {
        const elements = [this.walletSection];
        elements.forEach((el, i) => {
            if (!el) return;
            el.setAlpha(0);
            el.setY(el.y + 30);
            this.tweens.add({ 
                targets: el, 
                alpha: 1, 
                y: el.y - 30, 
                duration: 600, 
                delay: i * 200, 
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
                
                console.log('✅ Données utilisateur mises à jour');
                this.updateSecurityIndicators();
            }
        } catch (error) {
            console.error('❌ Erreur refresh utilisateur:', error);
            
            if (error.message?.toLowerCase().includes('session') || error.message?.toLowerCase().includes('token')) {
                this.scene.start('AuthScene');
            }
        }
    }

    startAutoRefresh() {
        this.refreshTimer = this.time.addEvent({
            delay: 2 * 60 * 1000,
            callback: () => {
                if (auth.isAuthenticated()) {
                    this.refreshUserData();
                }
            },
            loop: true
        });
    }

    updateSecurityIndicators() {
        const tokenInfo = auth.getTokenInfo();
        
        if (tokenInfo) {
            const timeLeft = Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60));
            
            if (timeLeft <= 2) {
                this.securityIndicators.token.setFill('#e74c3c');
                this.securityIndicators.token.setText('⚠️ Token');
            } else if (timeLeft <= 5) {
                this.securityIndicators.token.setFill('#f39c12');
                this.securityIndicators.token.setText('🔄 Token');
            } else {
                this.securityIndicators.token.setFill('#2ecc71');
                this.securityIndicators.token.setText('✅ Token');
            }
        }
    }

    async checkWalletStatus() {
        if (this.currentUser?.cryptoWallet?.address && window.GameConstants?.CRYPTO?.METAMASK_AVAILABLE) {
            try {
                const status = this.metaMaskHelper.getStatus();
                const accounts = status.isConnected && status.currentAccount ? [status.currentAccount.toLowerCase()] : [];
                const currentAddress = this.currentUser.cryptoWallet.address.toLowerCase();
                
                if (accounts.length && !accounts.includes(currentAddress)) {
                    console.warn('⚠️ Adresse MetaMask changée, déconnexion automatique');
                    await this.disconnectWallet();
                }
            } catch (error) {
                console.warn('⚠️ Impossible de vérifier l\'état MetaMask:', error);
            }
        }
    }

    async handleSecureLogout() {
        const confirmLogout = confirm('Êtes-vous sûr de vouloir vous déconnecter ?');
        if (!confirmLogout) return;

        try {
            console.log('🚪 Déconnexion sécurisée...');
            
            this.cleanup();
            await auth.logout();
            this.gameInstance?.clearAuthData();
            
            window.NotificationManager?.success('Déconnexion réussie');
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
        if (this.scene.isActive() && !auth.isAuthenticated()) {
            console.warn('⚠️ Perte d\'authentification détectée dans WelcomeScene');
            this.cleanup();
            this.scene.start('AuthScene');
            return;
        }

        this.updateSecurityIndicators();
    }

    cleanup() {
        if (this.refreshTimer) {
            this.refreshTimer.destroy();
            this.refreshTimer = null;
        }
        
        if (this.securityTimer) {
            this.securityTimer.destroy();
            this.securityTimer = null;
        }
        
        if (auth?.config) {
            auth.config.onAuthenticationLost?.(null);
            auth.config.onTokenRefreshed?.(null);
        }
    }

    destroy() {
        this.cleanup();
        super.destroy();
    }
}
