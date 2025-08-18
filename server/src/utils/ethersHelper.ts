// server/src/utils/ethersSimple.ts - HELPER ETHEREUM SIMPLIFIÉ POUR JEU
import { ethers } from 'ethers';

class SimpleEthersHelper {
  private usedNonces: Set<string> = new Set();
  
  /**
   * Vérifie une signature MetaMask
   */
  async verifySignature(address: string, message: string, signature: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === address.toLowerCase();
    } catch (error) {
      console.error('❌ Erreur vérification signature:', error);
      return false;
    }
  }

  /**
   * Valide une adresse Ethereum
   */
  isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Formate une adresse pour l'affichage
   */
  formatAddress(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Normalise une adresse (checksum)
   */
  normalizeAddress(address: string): string {
    try {
      return ethers.getAddress(address);
    } catch {
      return address.toLowerCase();
    }
  }

  /**
   * Vérifie si un nonce est déjà utilisé (simple)
   */
  isNonceUsed(nonce: string): boolean {
    return this.usedNonces.has(nonce);
  }

  /**
   * Marque un nonce comme utilisé
   */
  markNonceAsUsed(nonce: string): void {
    this.usedNonces.add(nonce);
    
    // Nettoyage simple : garder max 1000 nonces
    if (this.usedNonces.size > 1000) {
      const nonceArray = Array.from(this.usedNonces);
      this.usedNonces.clear();
      // Garder les 500 derniers
      nonceArray.slice(-500).forEach(n => this.usedNonces.add(n));
    }
  }

  /**
   * Génère un message de connexion simple
   */
  generateConnectionMessage(userId: string): string {
    const timestamp = Date.now();
    return `ChimArena - Connexion Wallet\n\n` +
           `Utilisateur: ${userId}\n` +
           `Timestamp: ${timestamp}\n\n` +
           `En signant ce message, vous confirmez être le propriétaire de ce wallet.`;
  }

  /**
   * Parse un message pour extraire le timestamp
   */
  parseMessageTimestamp(message: string): number | null {
    try {
      const timestampMatch = message.match(/Timestamp: (\d+)/);
      return timestampMatch ? parseInt(timestampMatch[1]) : null;
    } catch {
      return null;
    }
  }

  /**
   * Vérifie si une signature n'est pas trop ancienne (5 minutes)
   */
  isSignatureFresh(message: string): boolean {
    const timestamp = this.parseMessageTimestamp(message);
    if (!timestamp) return false;
    
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    
    return (now - timestamp) <= maxAge;
  }

  /**
   * Validation complète pour connexion wallet
   */
  async validateWalletConnection(
    address: string, 
    message: string, 
    signature: string,
    userId: string
  ): Promise<{ isValid: boolean; error?: string }> {
    
    // 1. Vérifier l'adresse
    if (!this.isValidAddress(address)) {
      return { isValid: false, error: 'Adresse Ethereum invalide' };
    }

    // 2. Vérifier que le message contient l'userId
    if (!message.includes(userId)) {
      return { isValid: false, error: 'Message ne correspond pas à l\'utilisateur' };
    }

    // 3. Vérifier la fraîcheur du message
    if (!this.isSignatureFresh(message)) {
      return { isValid: false, error: 'Signature expirée (max 5 minutes)' };
    }

    // 4. Vérifier la signature
    const isValidSig = await this.verifySignature(address, message, signature);
    if (!isValidSig) {
      return { isValid: false, error: 'Signature invalide' };
    }

    return { isValid: true };
  }
}

// Export singleton
export const ethersHelper = new SimpleEthersHelper();
export default ethersHelper;
