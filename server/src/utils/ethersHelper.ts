// server/src/utils/ethersHelper.ts - HELPER ETHEREUM SÉCURISÉ
import { ethers } from 'ethers';
import crypto from 'crypto';
import { auditLogger } from './auditLogger';

export interface SignatureValidationResult {
  isValid: boolean;
  address?: string;
  error?: string;
  timestamp?: number;
  nonce?: string;
}

export interface WalletConnectionMessage {
  userId: string;
  timestamp: number;
  nonce: string;
  action: 'connect_wallet' | 'disconnect_wallet' | 'verify_ownership';
  chainId?: number;
}

export interface WithdrawalMessage {
  userId: string;
  amount: string;
  token: string;
  recipient: string;
  timestamp: number;
  nonce: string;
  action: 'withdrawal_request';
}

class EthersHelper {
  private readonly SIGNATURE_VALIDITY_MS = 5 * 60 * 1000; // 5 minutes
  private readonly SUPPORTED_CHAIN_IDS = [1, 137, 56]; // Ethereum, Polygon, BSC
  private usedNonces: Set<string> = new Set();
  
  constructor() {
    // Nettoyage périodique des nonces expirés
    setInterval(() => this.cleanupExpiredNonces(), 10 * 60 * 1000); // 10 minutes
  }

  /**
   * Génère un message standardisé pour la signature
   */
  public generateConnectionMessage(userId: string, action: string = 'connect_wallet'): WalletConnectionMessage {
    const timestamp = Date.now();
    const nonce = this.generateSecureNonce();
    
    return {
      userId,
      timestamp,
      nonce,
      action: action as any,
    };
  }

  /**
   * Génère un message pour les retraits crypto
   */
  public generateWithdrawalMessage(
    userId: string, 
    amount: string, 
    token: string, 
    recipient: string
  ): WithdrawalMessage {
    const timestamp = Date.now();
    const nonce = this.generateSecureNonce();
    
    return {
      userId,
      amount,
      token,
      recipient,
      timestamp,
      nonce,
      action: 'withdrawal_request',
    };
  }

  /**
   * Convertit un message en string pour signature
   */
  public messageToString(message: WalletConnectionMessage | WithdrawalMessage): string {
    if (message.action === 'withdrawal_request') {
      const withdrawalMsg = message as WithdrawalMessage;
      return `ChimArena Withdrawal Request\n\n` +
             `User: ${withdrawalMsg.userId}\n` +
             `Amount: ${withdrawalMsg.amount} ${withdrawalMsg.token}\n` +
             `Recipient: ${withdrawalMsg.recipient}\n` +
             `Timestamp: ${withdrawalMsg.timestamp}\n` +
             `Nonce: ${withdrawalMsg.nonce}\n\n` +
             `By signing this message, you authorize the withdrawal from your ChimArena account.`;
    } else {
      const connectionMsg = message as WalletConnectionMessage;
      return `ChimArena Wallet Connection\n\n` +
             `User: ${connectionMsg.userId}\n` +
             `Action: ${connectionMsg.action}\n` +
             `Timestamp: ${connectionMsg.timestamp}\n` +
             `Nonce: ${connectionMsg.nonce}\n\n` +
             `By signing this message, you prove ownership of this wallet address.`;
    }
  }

  /**
   * Valide une signature Ethereum
   */
  public async validateSignature(
    message: string,
    signature: string,
    expectedAddress?: string
  ): Promise<SignatureValidationResult> {
    try {
      // 1. Vérifier le format de la signature
      if (!signature || !signature.startsWith('0x') || signature.length !== 132) {
        return {
          isValid: false,
          error: 'Format de signature invalide'
        };
      }

      // 2. Parser le message pour extraire les données
      const messageData = this.parseMessage(message);
      if (!messageData) {
        return {
          isValid: false,
          error: 'Message invalide ou malformé'
        };
      }

      // 3. Vérifier la validité temporelle
      const now = Date.now();
      if (now - messageData.timestamp > this.SIGNATURE_VALIDITY_MS) {
        return {
          isValid: false,
          error: 'Signature expirée'
        };
      }

      // 4. Vérifier l'unicité du nonce
      if (this.usedNonces.has(messageData.nonce)) {
        return {
          isValid: false,
          error: 'Nonce déjà utilisé (protection anti-replay)'
        };
      }

      // 5. Récupérer l'adresse à partir de la signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      // 6. Vérifier le format de l'adresse
      if (!ethers.isAddress(recoveredAddress)) {
        return {
          isValid: false,
          error: 'Adresse récupérée invalide'
        };
      }

      // 7. Vérifier l'adresse attendue si fournie
      if (expectedAddress && recoveredAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
        return {
          isValid: false,
          error: 'Adresse ne correspond pas à celle attendue'
        };
      }

      // 8. Marquer le nonce comme utilisé
      this.usedNonces.add(messageData.nonce);

      return {
        isValid: true,
        address: recoveredAddress.toLowerCase(),
        timestamp: messageData.timestamp,
        nonce: messageData.nonce
      };

    } catch (error) {
      console.error('❌ Erreur validation signature:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Erreur de validation'
      };
    }
  }

  /**
   * Valide une adresse Ethereum
   */
  public isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Normalise une adresse Ethereum (checksum)
   */
  public normalizeAddress(address: string): string {
    try {
      return ethers.getAddress(address);
    } catch {
      return address.toLowerCase();
    }
  }

  /**
   * Vérifie si un chainId est supporté
   */
  public isSupportedChain(chainId: number): boolean {
    return this.SUPPORTED_CHAIN_IDS.includes(chainId);
  }

  /**
   * Génère un nonce sécurisé
   */
  private generateSecureNonce(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Parse un message pour extraire les données structurées
   */
  private parseMessage(message: string): { timestamp: number; nonce: string; userId: string } | null {
    try {
      const timestampMatch = message.match(/Timestamp: (\d+)/);
      const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
      const userMatch = message.match(/User: ([a-f0-9-]+)/);

      if (!timestampMatch || !nonceMatch || !userMatch) {
        return null;
      }

      return {
        timestamp: parseInt(timestampMatch[1]),
        nonce: nonceMatch[1],
        userId: userMatch[1]
      };
    } catch {
      return null;
    }
  }

  /**
   * Nettoie les nonces expirés
   */
  private cleanupExpiredNonces(): void {
    // Pour une implémentation simple, on peut vider périodiquement
    // Dans un environnement de production, il faudrait un système plus sophistiqué
    if (this.usedNonces.size > 10000) {
      this.usedNonces.clear();
      console.log('🧹 Nettoyage des nonces crypto effectué');
    }
  }

  /**
   * Audit d'une action crypto
   */
  public async auditCryptoAction(
    action: string,
    userId: string,
    address: string,
    success: boolean,
    details: any,
    ip: string,
    userAgent?: string
  ): Promise<void> {
    await auditLogger.logEvent(
      success ? 'CRYPTO_DEPOSIT' : 'SECURITY_SUSPICIOUS_ACTIVITY',
      action,
      {
        userId,
        ip,
        userAgent,
        success,
        details: {
          walletAddress: address,
          ...details
        },
        severity: success ? 'MEDIUM' : 'HIGH',
      }
    );
  }

  /**
   * Vérifie si une adresse est potentiellement suspecte
   */
  public async checkSuspiciousAddress(address: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];
    let isSuspicious = false;

    // 1. Vérifier si c'est une adresse de contrat connue malveillante
    const suspiciousPatterns = [
      /^0x0+$/,           // Adresse nulle
      /^0x1+$/,           // Pattern suspect
      /^0xdead/i,         // Adresses "dead"
      /^0x000000000/,     // Trop de zéros
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(address)) {
        isSuspicious = true;
        reasons.push(`Pattern d'adresse suspect: ${pattern.source}`);
      }
    }

    // 2. Vérifier la longueur et le format
    if (address.length !== 42) {
      isSuspicious = true;
      reasons.push('Longueur d\'adresse invalide');
    }

    // 3. TODO: Intégrer avec des API de réputation d'adresses
    // comme Chainalysis, Elliptic, etc. en production

    return { isSuspicious, reasons };
  }

  /**
   * Formate une adresse pour l'affichage
   */
  public formatAddressForDisplay(address: string): string {
    if (!address || address.length < 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  // À ajouter dans la classe EthersHelper dans ethersHelper.ts

/**
 * Vérifie une signature (wrapper pour validateSignature)
 */
public async verifySignature(address: string, message: string, signature: string): Promise<boolean> {
  try {
    const result = await this.validateSignature(message, signature, address);
    return result.isValid;
  } catch (error) {
    console.error('❌ Erreur vérification signature:', error);
    return false;
  }
}

/**
 * Vérifie si un nonce est déjà utilisé
 */
public async isNonceUsed(address: string, nonce: string): Promise<boolean> {
  const nonceKey = `${address.toLowerCase()}-${nonce}`;
  return this.usedNonces.has(nonceKey);
}

/**
 * Marque un nonce comme utilisé
 */
public async markNonceAsUsed(address: string, nonce: string): Promise<void> {
  const nonceKey = `${address.toLowerCase()}-${nonce}`;
  this.usedNonces.add(nonceKey);
}

/**
 * Formate une adresse Ethereum
 */
public formatAddress(address: string): string {
  try {
    return ethers.getAddress(address); // Retourne l'adresse avec checksum
  } catch {
    return address.toLowerCase();
  }
}

/**
 * Détecte le type de message
 */
public detectMessageType(message: string): string {
  if (message.includes('Withdrawal Request')) {
    return 'withdrawal';
  } else if (message.includes('Wallet Connection')) {
    return 'connection';
  } else if (message.includes('verify_ownership')) {
    return 'verification';
  } else {
    return 'unknown';
  }
}
  
  /**
   * Estime les frais de gas (pour information seulement)
   */
  public async estimateGasFees(chainId: number): Promise<{
    slow: string;
    standard: string;
    fast: string;
  }> {
    // Valeurs par défaut - en production, utiliser des API comme EthGasStation
    const defaultFees = {
      1: { slow: '20', standard: '25', fast: '30' }, // Ethereum
      137: { slow: '1', standard: '2', fast: '3' },   // Polygon
      56: { slow: '5', standard: '7', fast: '10' },   // BSC
    };

    return defaultFees[chainId as keyof typeof defaultFees] || defaultFees[1];
  }
}

// Export singleton
export const ethersHelper = new EthersHelper();
export default ethersHelper;
