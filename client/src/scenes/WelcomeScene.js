// client/src/scenes/WelcomeScene.js - VERSION COMPLÈTE AVEC METAMASK (corrigée: un seul appel API)

// NOTE: Cette version supprime l'appel direct à crypto.connectWallet() depuis la scène,
// pour éviter les connexions multiples. Le helper MetaMask gère désormais tout le flow.

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
    }

    create() {
        console.log('🏠 Scène WelcomeScene créée avec support crypto');
        
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
        
        // Créer l'interface
        this.createBackground();
        this.createHeader();
        this.createWelcomePanel();
        this.createSecurityIndicators();
        this.createWalletSection();
        this.createNavigationButtons();
        this.createFooter();
        
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

    createBackground() {
        const { width, height } = this.scale;
        
        // Dégradé de fond
        const background = this.add.graphics();
        background.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x16213e, 0x16213e);
        background.fillRect(0, 0, width, height);
        
        // Particules animées
        this.createWelcomeParticles();
    }

    createWelcomeParticles() {
        const { width, height } = this.scale;
        
        // Orbes plus sophistiqués pour l'accueil
        for (let i = 0; i < 20; i++) {
            const orb = this.add.circle(
                Phaser.Math.Between(0, width),
                Phaser.Math.Between(0, height),
                Phaser.Math.Between(15, 35),
                [0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6][i % 4],
                0.15
            );
            
            this.tweens.add({
                targets: orb,
                x: orb.x + Phaser.Math.Between(-80, 80),
                y: orb.y + Phaser.Math.Between(-80, 80),
                alpha: { from: 0.05, to: 0.25 },
                scale: { from: 0.8, to: 1.2 },
                duration: Phaser.Math.Between(3000, 6000),
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
            });
        }
    }

    createHeader() {
        const { width } = this.scale;
        
        // Logo principal
        this.add.text(width / 2, 50, 'ChimArena', {
            fontSize: '32px',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 'bold',
            fill: '#ffffff',
            stroke: '#2c3e50',
            strokeThickness: 2
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
        .on('pointerover', () => logoutBtn.setTint(0xff6b6b))
        .on('pointerout', () => logoutBtn.clearTint())
        .on('pointerdown', () => this.handleSecureLogout());
    }

    createWelcomePanel() {
        const { width } = this.scale;
        const user = this.currentUser;
        
        if (!user) return;
        
        // Panel principal d'accueil
        const welcomePanel = this.add.graphics();
        welcomePanel.fillStyle(0x2c3e50, 0.9);
        welcomePanel.fillRoundedRect(width / 2 - 250, 90, 500, 120, 15);
        welcomePanel.lineStyle(3, 0x3498db);
        welcomePanel.strokeRoundedRect(width / 2 - 250, 90, 500, 120, 15);
        
        // Message de bienvenue personnalisé
        const timeOfDay = this.getTimeOfDay();
        this.add.text(width / 2, 120, `${timeOfDay}, ${user.username} !`, {
            fontSize: '24px',
            fill: '#f39c12',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        // Sous-titre avec niveau de sécurité
        const securityLevel = user.accountInfo?.securityLevel || 'BASIC';
        const securityIcon = securityLevel === 'CRYPTO_GRADE' ? '💎' : securityLevel === 'ENHANCED' ? '🛡️' : '🔰';
        
        this.add.text(width / 2, 145, `${securityIcon} Niveau sécurité: ${securityLevel}`, {
            fontSize: '14px',
            fill: securityLevel === 'CRYPTO_GRADE' ? '#2ecc71' : securityLevel === 'ENHANCED' ? '#3498db' : '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        // Stats rapides
        const level = user.playerStats?.level || 1;
        const trophies = user.playerStats?.trophies || 0;
        const winRate = user.winRate || 0;
        
        this.add.text(width / 2 - 200, 175, `Niveau ${level}`, {
            fontSize: '16px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        });
        
        this.add.text(width / 2 - 50, 175, `🏆 ${window.GameUtils.formatNumber(trophies)}`, {
            fontSize: '16px',
            fill: '#f1c40f',
            fontFamily: 'Roboto, sans-serif'
        });
        
        this.add.text(width / 2 + 100, 175, `📊 ${winRate}% victoires`, {
            fontSize: '16px',
            fill: '#9b59b6',
            fontFamily: 'Roboto, sans-serif'
        });
    }

    createSecurityIndicators() {
        const { width } = this.scale;
        
        // Panel indicateurs de sécurité
        const securityPanel = this.add.graphics();
        securityPanel.fillStyle(0x34495e, 0.8);
        securityPanel.fillRoundedRect(width / 2 - 200, 230, 400, 60, 10);
        
        this.add.text(width / 2 - 180, 245, '🔐 État de sécurité', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        });
        
        // Indicateur session
        this.securityIndicators.session = this.add.text(width / 2 - 180, 265, '✅ Session active', {
            fontSize: '12px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        });
        
        // Indicateur token
        this.securityIndicators.token = this.add.text(width / 2 - 50, 265, '🔄 Token valide', {
            fontSize: '12px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        });
        
        // Indicateur wallet
        this.securityIndicators.wallet = this.add.text(width / 2 + 80, 265, '💰 Wallet: Non connecté', {
            fontSize: '12px',
            fill: '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        });
    }

    createWalletSection() {
        const { width } = this.scale;
        
        // Section MetaMask
        this.walletSection = this.add.container(width / 2, 350);
        
        // Background wallet section
        const walletBg = this.add.graphics();
        walletBg.fillStyle(0x2c3e50, 0.9);
        walletBg.fillRoundedRect(-250, -40, 500, 120, 12);
        walletBg.lineStyle(2, 0xf39c12);
        walletBg.strokeRoundedRect(-250, -40, 500, 120, 12);
        
        // Titre section
        const walletTitle = this.add.text(0, -20, '💰 Portefeuille Crypto', {
            fontSize: '18px',
            fill: '#f39c12',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        this.walletSection.add([walletBg, walletTitle]);
        
        // Vérifier la disponibilité de MetaMask
        if (window.GameConstants?.CRYPTO?.METAMASK_AVAILABLE) {
            this.createMetaMaskInterface();
        } else {
            this.createNoMetaMaskMessage();
        }
    }

    createMetaMaskInterface() {
        // État initial selon le wallet connecté
        if (this.currentUser?.cryptoWallet?.address) {
            this.createConnectedWalletInterface();
        } else {
            this.createConnectWalletInterface();
        }
    }

    createConnectWalletInterface() {
        // Bouton de connexion MetaMask
        this.connectWalletButton = this.add.text(0, 20, '🦊 Connecter MetaMask', {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold',
            backgroundColor: '#f6851b',
            padding: { x: 20, y: 10 },
            borderRadius: 8
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerover', () => this.connectWalletButton.setTint(0xffa726))
        .on('pointerout', () => this.connectWalletButton.clearTint())
        .on('pointerdown', () => this.connectWallet());
        
        // Message informatif
        const infoText = this.add.text(0, 55, 'Connectez votre wallet pour accéder aux fonctionnalités crypto', {
            fontSize: '12px',
            fill: '#bdc3c7',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        this.walletSection.add([this.connectWalletButton, infoText]);
    }

    createConnectedWalletInterface() {
        const walletData = this.currentUser.cryptoWallet;
        
        // Adresse wallet formatée
        const addressText = this.add.text(-200, 10, `📍 ${window.GameUtils.formatEthereumAddress(walletData.address)}`, {
            fontSize: '14px',
            fill: '#2ecc71',
            fontFamily: 'Roboto, sans-serif'
        });
        
        // Statut de connexion
        const statusText = this.add.text(-200, 30, `✅ Connecté depuis ${this.formatDate(walletData.connectedAt)}`, {
            fontSize: '12px',
            fill: '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        });
        
        // Bouton déconnexion
        const disconnectBtn = this.add.text(150, 20, '🔌 Déconnecter', {
            fontSize: '14px',
            fill: '#e74c3c',
            fontFamily: 'Roboto, sans-serif',
            backgroundColor: '#34495e',
            padding: { x: 10, y: 5 },
            borderRadius: 5
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerover', () => disconnectBtn.setTint(0xff6b6b))
        .on('pointerout', () => disconnectBtn.clearTint())
        .on('pointerdown', () => this.disconnectWallet());
        
        // Actions wallet
        const walletActionsText = this.add.text(0, 55, 'Fonctionnalités crypto disponibles dans le menu principal', {
            fontSize: '12px',
            fill: '#3498db',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        this.walletSection.add([addressText, statusText, disconnectBtn, walletActionsText]);
        
        // Mettre à jour l'indicateur
        this.securityIndicators.wallet.setText('💰 Wallet: Connecté');
        this.securityIndicators.wallet.setFill('#2ecc71');
    }

    createNoMetaMaskMessage() {
        const noMetaMaskText = this.add.text(0, 10, '⚠️ MetaMask non détecté', {
            fontSize: '16px',
            fill: '#e74c3c',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold'
        }).setOrigin(0.5);
        
        const instructionText = this.add.text(0, 35, 'Installez MetaMask pour accéder aux fonctionnalités crypto', {
            fontSize: '12px',
            fill: '#95a5a6',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
        
        const installBtn = this.add.text(0, 60, '📥 Installer MetaMask', {
            fontSize: '14px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            backgroundColor: '#3498db',
            padding: { x: 15, y: 8 },
            borderRadius: 6
        })
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => {
            window.open('https://metamask.io/', '_blank');
        });
        
        this.walletSection.add([noMetaMaskText, instructionText, installBtn]);
    }

    createNavigationButtons() {
        const { width } = this.scale;
        
        // Boutons de navigation
        const navY = 500;
        
        // Bouton vers le jeu
        this.createNavButton(width / 2 - 120, navY, '⚔️ Jouer', '#e74c3c', () => {
            this.scene.start('MenuScene');
        });
        
        // Bouton paramètres
        this.createNavButton(width / 2 + 120, navY, '⚙️ Paramètres', '#7f8c8d', () => {
            window.NotificationManager.show('Paramètres - Bientôt disponible !', 'info');
        });
    }

    createNavButton(x, y, text, color, action) {
        const button = this.add.text(x, y, text, {
            fontSize: '16px',
            fill: '#ffffff',
            fontFamily: 'Roboto, sans-serif',
            fontWeight: 'bold',
            backgroundColor: color,
            padding: { x: 20, y: 12 },
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

    createFooter() {
        const { width, height } = this.scale;
        
        // Dernière connexion
        if (this.currentUser?.accountInfo?.lastLogin) {
            const lastLogin = new Date(this.currentUser.accountInfo.lastLogin);
            this.add.text(width / 2, height - 60, 
                `🕐 Dernière connexion: ${this.formatDateTime(lastLogin)}`, {
                fontSize: '12px',
                fill: '#95a5a6',
                fontFamily: 'Roboto, sans-serif'
            }).setOrigin(0.5);
        }
        
        // Informations de session
        const tokenInfo = auth.getTokenInfo();
        if (tokenInfo) {
            const timeLeft = Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60));
            this.add.text(width / 2, height - 40, 
                `🔐 Session expire dans ${timeLeft} minutes`, {
                fontSize: '11px',
                fill: timeLeft > 5 ? '#2ecc71' : '#e74c3c',
                fontFamily: 'Roboto, sans-serif'
            }).setOrigin(0.5);
        }
        
        // Contrôles
        this.add.text(width / 2, height - 20, 
            'ESC: Déconnexion • ENTRÉE: Jouer • TAB: Wallet', {
            fontSize: '10px',
            fill: '#7f8c8d',
            fontFamily: 'Roboto, sans-serif'
        }).setOrigin(0.5);
    }

    // === MÉTAMASK FUNCTIONS ===

    async connectWallet() {
        if (this.isConnectingWallet) return;
        this.isConnectingWallet = true;

        if (this.connectWalletButton?.setText) {
            this.connectWalletButton.setText('🔄 Connexion...');
        }
        
        try {
            console.log('🦊 Tentative de connexion MetaMask...');
            
            // Utiliser uniquement le helper (il gère: accounts, challenge, signature, POST /connect-wallet)
            const result = await this.metaMaskHelper.connectWallet();
            
           if (result?.success) {
  // 1) Essayer d'utiliser ce que renvoie directement /connect-wallet
  let w = result.walletInfo || result.wallet || result.data?.wallet;

  // 2) Si manquant ou adresse tronquée (ex: "0xf3f6...923c"), rafraîchir depuis /wallet-info
  if (!w || !w.address || w.address.includes('...')) {
    const wiResp = await crypto.getWalletInfo(); // GET /api/crypto/wallet-info
    if (wiResp?.success && wiResp.wallet?.fullAddress) {
      w = {
        address: wiResp.wallet.fullAddress,
        connectedAt: wiResp.wallet.connectedAt,
        connectionCount: wiResp.wallet.connectionCount
      };
    }
  }

  // 3) Dernier garde-fou
  if (!w || !w.address) {
    throw new Error('Réponse serveur invalide (wallet manquant)');
  }

  // 4) Normalisation + mise à jour UI/état
  const wallet = {
    address: (w.fullAddress || w.address).toLowerCase(),
    connectedAt: w.connectedAt || new Date().toISOString(),
    connectionCount: w.connectionCount ?? 1,
  };

  this.updateWalletUI(wallet);
  this.gameInstance?.setCurrentUser(this.currentUser);
  this.registry.set('currentUser', this.currentUser);

  window.NotificationManager?.success('MetaMask connecté avec succès !');
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

    
    async checkWalletStatus() {
        // Vérifier l'état du wallet au chargement
        if (this.currentUser?.cryptoWallet?.address && window.GameConstants?.CRYPTO?.METAMASK_AVAILABLE) {
            try {
                // Vérifier si MetaMask est toujours connecté à la même adresse
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

    // === AUTRES MÉTHODES ===

    updateWalletUI(walletInfo) {
    if (walletInfo) {
        this.currentUser.cryptoWallet = walletInfo;
        this.securityIndicators.wallet.setText('💰 Wallet: Connecté');
        this.securityIndicators.wallet.setFill('#2ecc71');
    } else {
        this.currentUser.cryptoWallet = null;
        this.securityIndicators.wallet.setText('💰 Wallet: Non connecté');
        this.securityIndicators.wallet.setFill('#95a5a6');
    }

    this.walletSection.removeAll(true);
    this.createMetaMaskInterface();
}

    
    setupKeyboardControls() {
        this.input.keyboard.on('keydown-ENTER', () => {
            this.scene.start('MenuScene');
        });
        
        this.input.keyboard.on('keydown-ESC', () => {
            this.handleSecureLogout();
        });
        
        this.input.keyboard.on('keydown-TAB', (event) => {
            event.preventDefault();
            if (this.isConnectingWallet) return; // éviter multi-déclenchements
            if (window.GameConstants?.CRYPTO?.METAMASK_AVAILABLE) {
                if (!this.currentUser?.cryptoWallet?.address) {
                    this.connectWallet();
                }
            }
        });
    }

    setupSecurityHooks() {
        // Hook pour déconnexion automatique
        config.onAuthenticationLost((reason) => {
            console.warn('🚨 Authentification perdue:', reason);
            this.cleanup();
            window.NotificationManager?.error(`Session expirée: ${reason}`);
            this.scene.start('AuthScene');
        });
        
        // Hook pour refresh automatique
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
        // Refresh automatique des données toutes les 2 minutes
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
        // Mettre à jour les indicateurs de sécurité en temps réel
        const tokenInfo = auth.getTokenInfo();
        
        if (tokenInfo) {
            const timeLeft = Math.max(0, Math.floor((tokenInfo.exp * 1000 - Date.now()) / 1000 / 60));
            
            if (timeLeft <= 2) {
                this.securityIndicators.token.setFill('#e74c3c');
                this.securityIndicators.token.setText('⚠️ Token expire');
            } else if (timeLeft <= 5) {
                this.securityIndicators.token.setFill('#f39c12');
                this.securityIndicators.token.setText('🔄 Token valide');
            } else {
                this.securityIndicators.token.setFill('#2ecc71');
                this.securityIndicators.token.setText('✅ Token valide');
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

    // === UTILS ===

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

    update() {
        // Vérification périodique de l'authentification
        if (this.scene.isActive() && !auth.isAuthenticated()) {
            console.warn('⚠️ Perte d\'authentification détectée dans WelcomeScene');
            this.cleanup();
            this.scene.start('AuthScene');
            return;
        }

        // Mise à jour des indicateurs de sécurité
        this.updateSecurityIndicators();
    }

    cleanup() {
        // Nettoyer les timers
        if (this.refreshTimer) {
            this.refreshTimer.destroy();
            this.refreshTimer = null;
        }
        
        if (this.securityTimer) {
            this.securityTimer.destroy();
            this.securityTimer = null;
        }
        
        // Nettoyer les hooks de sécurité
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
