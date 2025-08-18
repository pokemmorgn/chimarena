// client/src/utils/metamask.js - Helper MetaMask sécurisé côté client
import { crypto } from '../api'; // Import du module crypto de l'API

/**
 * 🦊 HELPER METAMASK SÉCURISÉ
 * Gère toutes les interactions avec MetaMask côté client
 * IMPORTANT: Aucune clé privée n'est jamais stockée côté client
 */

class MetaMaskHelper {
    constructor() {
        this.isMetaMaskAvailable = false;
        this.currentAccount = null;
        this.currentNetwork = null;
        this.isConnected = false;
        
        this.init();
    }

    init() {
        // Vérifier la disponibilité de MetaMask
        if (typeof window.ethereum !== 'undefined') {
            this.isMetaMaskAvailable = true;
            console.log('🦊 MetaMask détecté et disponible');
            
            // Écouter les changements de compte
            window.ethereum.on('accountsChanged', (accounts) => {
                this.handleAccountsChanged(accounts);
            });
            
            // Écouter les changements de réseau
            window.ethereum.on('chainChanged', (chainId) => {
                this.handleChainChanged(chainId);
            });
            
            // Écouter la déconnexion
            window.ethereum.on('disconnect', () => {
                this.handleDisconnect();
            });
            
        } else {
            console.warn('⚠️ MetaMask non détecté');
            this.isMetaMaskAvailable = false;
        }
    }

    // 🔌 CONNEXION METAMASK
    async connectWallet() {
        if (!this.isMetaMaskAvailable) {
            throw new Error('MetaMask n\'est pas installé. Veuillez l\'installer depuis https://metamask.io');
        }

        try {
            console.log('🔌 Tentative de connexion MetaMask...');
            
            // Demander l'autorisation de connexion
            const accounts = await window.ethereum.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('Aucun compte MetaMask sélectionné');
            }

            const account = accounts[0];
            console.log('✅ Compte MetaMask connecté:', account);

            // Récupérer les informations du réseau
            const chainId = await window.ethereum.request({
                method: 'eth_chainId'
            });

            this.currentAccount = account;
            this.currentNetwork = chainId;
            this.isConnected = true;

            // Générer et signer un message de vérification
            const verificationData = await this.generateVerificationSignature(account);

            // Envoyer au serveur pour validation
            const result = await crypto.connectWallet(verificationData);

            if (result.success) {
                console.log('✅ Wallet connecté et vérifié côté serveur');
                return {
                    success: true,
                    account: account,
                    network: this.getNetworkInfo(chainId),
                    walletInfo: result.walletInfo
                };
            } else {
                throw new Error(result.message || 'Échec de la vérification côté serveur');
            }

        } catch (error) {
            console.error('❌ Erreur connexion MetaMask:', error);
            this.isConnected = false;
            this.currentAccount = null;
            
            // Messages d'erreur utilisateur-friendly
            if (error.code === 4001) {
                throw new Error('Connexion annulée par l\'utilisateur');
            } else if (error.code === -32002) {
                throw new Error('Requête de connexion déjà en cours. Vérifiez MetaMask.');
            } else {
                throw error;
            }
        }
    }

    // ✍️ GÉNÉRATION SIGNATURE DE VÉRIFICATION
    async generateVerificationSignature(account) {
        try {
            // Générer un nonce unique côté client
            const nonce = this.generateNonce();
            const timestamp = Date.now();
            
            // Message de vérification standardisé
            const message = this.createVerificationMessage(account, nonce, timestamp);
            
            console.log('✍️ Demande de signature pour vérification...');
            
            // Demander la signature à MetaMask
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, account]
            });

            return {
                account: account,
                message: message,
                signature: signature,
                nonce: nonce,
                timestamp: timestamp,
                chainId: this.currentNetwork
            };

        } catch (error) {
            console.error('❌ Erreur génération signature:', error);
            
            if (error.code === 4001) {
                throw new Error('Signature annulée par l\'utilisateur');
            } else {
                throw new Error('Erreur lors de la signature: ' + error.message);
            }
        }
    }

    // 📝 CRÉATION MESSAGE DE VÉRIFICATION
    createVerificationMessage(account, nonce, timestamp) {
        return `ChimArena - Vérification de wallet

Compte: ${account}
Nonce: ${nonce}
Horodatage: ${new Date(timestamp).toISOString()}

En signant ce message, vous confirmez être le propriétaire de ce wallet.
Cette signature est valide pendant 5 minutes uniquement.

⚠️ Ne signez ce message que sur le site officiel ChimArena.`;
    }

    // 🎲 GÉNÉRATION NONCE SÉCURISÉ
    generateNonce() {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    // 🔌 DÉCONNEXION WALLET
    async disconnectWallet() {
        try {
            console.log('🔌 Déconnexion du wallet...');
            
            // Notifier le serveur de la déconnexion
            await crypto.disconnectWallet();
            
            // Nettoyer l'état local
            this.currentAccount = null;
            this.currentNetwork = null;
            this.isConnected = false;
            
            console.log('✅ Wallet déconnecté');
            
            return { success: true };

        } catch (error) {
            console.error('❌ Erreur déconnexion wallet:', error);
            
            // Forcer le nettoyage local même en cas d'erreur serveur
            this.currentAccount = null;
            this.currentNetwork = null;
            this.isConnected = false;
            
            throw error;
        }
    }

    // 📱 CHANGEMENT DE COMPTE METAMASK
    handleAccountsChanged(accounts) {
        console.log('🔄 Changement de compte MetaMask détecté');
        
        if (accounts.length === 0) {
            // Utilisateur a déconnecté MetaMask
            console.log('🔌 MetaMask déconnecté');
            this.handleDisconnect();
        } else if (accounts[0] !== this.currentAccount) {
            // Changement de compte
            console.log('👤 Changement de compte:', accounts[0]);
            this.currentAccount = accounts[0];
            
            // Notifier l'application du changement
            window.NotificationManager?.show(
                'Compte MetaMask changé. Veuillez vous reconnecter.', 
                'info'
            );
            
            // Forcer la déconnexion pour sécurité
            this.disconnectWallet().catch(console.error);
        }
    }

    // 🌐 CHANGEMENT DE RÉSEAU
    handleChainChanged(chainId) {
        console.log('🌐 Changement de réseau détecté:', chainId);
        this.currentNetwork = chainId;
        
        const networkInfo = this.getNetworkInfo(chainId);
        
        if (networkInfo.supported) {
            window.NotificationManager?.show(
                `Réseau changé: ${networkInfo.name}`, 
                'info'
            );
        } else {
            window.NotificationManager?.error(
                `Réseau non supporté: ${networkInfo.name}. Veuillez changer de réseau.`
            );
        }
    }

    // 🔌 GESTION DÉCONNEXION
    handleDisconnect() {
        console.log('🔌 MetaMask déconnecté');
        this.currentAccount = null;
        this.currentNetwork = null;
        this.isConnected = false;
        
        window.NotificationManager?.show('MetaMask déconnecté', 'info');
    }

    // 🌐 INFORMATIONS RÉSEAU
    getNetworkInfo(chainId) {
        const networks = {
            '0x1': { name: 'Ethereum Mainnet', supported: true },
            '0x89': { name: 'Polygon', supported: true },
            '0x38': { name: 'BSC', supported: true },
            '0x3': { name: 'Ropsten Testnet', supported: false },
            '0x4': { name: 'Rinkeby Testnet', supported: false },
            '0x5': { name: 'Goerli Testnet', supported: false },
            '0xa': { name: 'Optimism', supported: false },
            '0xa4b1': { name: 'Arbitrum', supported: false }
        };

        return networks[chainId] || { 
            name: `Réseau inconnu (${chainId})`, 
            supported: false 
        };
    }

    // 💰 DEMANDER CHANGEMENT DE RÉSEAU
    async switchToNetwork(chainId) {
        if (!this.isMetaMaskAvailable) {
            throw new Error('MetaMask non disponible');
        }

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainId }]
            });
            
            console.log('✅ Réseau changé vers:', chainId);
            return true;
            
        } catch (error) {
            console.error('❌ Erreur changement réseau:', error);
            
            if (error.code === 4902) {
                throw new Error('Ce réseau n\'est pas configuré dans MetaMask');
            } else if (error.code === 4001) {
                throw new Error('Changement de réseau annulé par l\'utilisateur');
            } else {
                throw error;
            }
        }
    }

    // 📊 ÉTAT ACTUEL
    getStatus() {
        return {
            isAvailable: this.isMetaMaskAvailable,
            isConnected: this.isConnected,
            currentAccount: this.currentAccount,
            currentNetwork: this.currentNetwork,
            networkInfo: this.currentNetwork ? this.getNetworkInfo(this.currentNetwork) : null
        };
    }

    // 🔍 VÉRIFICATION PRÉALABLE
    checkPrerequisites() {
        const issues = [];

        if (!this.isMetaMaskAvailable) {
            issues.push('MetaMask n\'est pas installé');
        }

        if (this.isMetaMaskAvailable && !this.isConnected) {
            issues.push('MetaMask n\'est pas connecté');
        }

        if (this.currentNetwork) {
            const networkInfo = this.getNetworkInfo(this.currentNetwork);
            if (!networkInfo.supported) {
                issues.push(`Réseau non supporté: ${networkInfo.name}`);
            }
        }

        return {
            ready: issues.length === 0,
            issues: issues
        };
    }
}

// Instance singleton
const metaMaskHelper = new MetaMaskHelper();

// Export des méthodes principales
export const connectWallet = () => metaMaskHelper.connectWallet();
export const disconnectWallet = () => metaMaskHelper.disconnectWallet();
export const getWalletStatus = () => metaMaskHelper.getStatus();
export const checkWalletPrerequisites = () => metaMaskHelper.checkPrerequisites();
export const switchNetwork = (chainId) => metaMaskHelper.switchToNetwork(chainId);

// Export de l'instance pour accès avancé
export default metaMaskHelper;
