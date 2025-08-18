// server/src/routes/cryptoRoutes.ts
import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import User from '../models/User';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { antiBotCryptoMiddleware } from '../middleware/antiBotMiddleware';
import { securityManager } from '../config/security';
import { auditLogger } from '../utils/auditLogger';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';

const router = Router();

// 🔐 RATE LIMITS ULTRA-STRICTS POUR CRYPTO
const walletConnectionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 connexions de wallet par heure
  message: { error: 'Trop de tentatives de connexion wallet, réessayez dans 1 heure' },
  standardHeaders: true,
  legacyHeaders: false,
});

const withdrawalLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 heures
  max: 5, // 5 retraits par jour
  message: { error: 'Limite de retraits quotidiens atteinte' },
  standardHeaders: true,
  legacyHeaders: false,
});

const cryptoQueryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requêtes crypto par 15 min
  message: { error: 'Trop de requêtes crypto' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 📝 HELPER POUR L'AUDIT CRYPTO
const getRequestInfo = (req: Request) => ({
  ip: req.ip || 'unknown',
  userAgent: req.headers['user-agent'] || '',
  sessionId: (req as any).sessionID || securityManager.generateSecureToken(16),
});

// 🔐 HELPERS DE VALIDATION CRYPTO
class CryptoValidator {
  static isValidEthereumAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  static async verifySignature(message: string, signature: string, expectedAddress: string): Promise<boolean> {
    try {
      const recoveredAddress = ethers.verifyMessage(message, signature);
      return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
    } catch (error) {
      console.error('❌ Erreur vérification signature:', error);
      return false;
    }
  }

  static validateWithdrawalAmount(amount: number): { isValid: boolean; message?: string } {
    if (amount <= 0) {
      return { isValid: false, message: 'Le montant doit être positif' };
    }
    
    if (amount < 0.001) { // 0.001 ETH minimum
      return { isValid: false, message: 'Montant minimum: 0.001 ETH' };
    }
    
    if (amount > 10) { // 10 ETH maximum par retrait
      return { isValid: false, message: 'Montant maximum: 10 ETH par retrait' };
    }
    
    return { isValid: true };
  }

  static isValidTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const diff = Math.abs(now - timestamp);
    return diff < 5 * 60 * 1000; // 5 minutes de tolérance
  }
}

// POST /api/crypto/connect-wallet - Connecter un wallet MetaMask
router.post('/connect-wallet', 
  walletConnectionLimiter,
  antiBotCryptoMiddleware,
  authenticateToken, 
  async (req: AuthenticatedRequest, res: Response) => {
    const requestInfo = getRequestInfo(req);
    
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const { address, signature, message } = req.body as {
        address?: string;
        signature?: string;
        message?: string;
      };

      // Validation des données
      if (!address || !signature || !message) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de connexion wallet avec données manquantes',
          {
            ...requestInfo,
            userId: req.user.id,
            username: req.user.username,
            success: false,
            details: { 
              hasAddress: !!address, 
              hasSignature: !!signature, 
              hasMessage: !!message 
            },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Données de connexion wallet incomplètes' 
        });
      }

      // Validation format adresse Ethereum
      if (!CryptoValidator.isValidEthereumAddress(address)) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de connexion avec adresse Ethereum invalide',
          {
            ...requestInfo,
            userId: req.user.id,
            username: req.user.username,
            success: false,
            details: { address },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Adresse Ethereum invalide' 
        });
      }

      // Extraire le timestamp du message pour validation
      const timestampMatch = message.match(/Timestamp: (\d+)/);
      if (!timestampMatch) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Message de signature sans timestamp',
          {
            ...requestInfo,
            userId: req.user.id,
            success: false,
            details: { message },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Message de signature invalide' 
        });
      }

      const timestamp = parseInt(timestampMatch[1]);
      if (!CryptoValidator.isValidTimestamp(timestamp)) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de connexion avec timestamp expiré',
          {
            ...requestInfo,
            userId: req.user.id,
            success: false,
            details: { timestamp, now: Date.now() },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Signature expirée, veuillez réessayer' 
        });
      }

      // Vérification de la signature
      const isValidSignature = await CryptoValidator.verifySignature(message, signature, address);
      if (!isValidSignature) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de connexion avec signature invalide',
          {
            ...requestInfo,
            userId: req.user.id,
            success: false,
            details: { address, message },
            severity: 'CRITICAL',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Signature invalide' 
        });
      }

      // Récupérer l'utilisateur
      const user: any = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      // Vérifier si l'adresse n'est pas déjà utilisée par un autre utilisateur
      const existingWallet = await User.findOne({ 
        'cryptoWallet.address': address,
        _id: { $ne: user._id }
      });

      if (existingWallet) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de connexion avec wallet déjà utilisé',
          {
            ...requestInfo,
            userId: req.user.id,
            success: false,
            details: { 
              address, 
              existingUserId: existingWallet._id.toString() 
            },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Cette adresse wallet est déjà utilisée par un autre compte' 
        });
      }

      // Créer ou mettre à jour le wallet (SANS STOCKER LA CLÉ PRIVÉE)
      if (!user.cryptoWallet) {
        user.cryptoWallet = {};
      }

      const oldAddress = user.cryptoWallet.address;
      user.cryptoWallet.address = address.toLowerCase();
      user.cryptoWallet.balance = user.cryptoWallet.balance || 0;
      user.cryptoWallet.withdrawalCount = user.cryptoWallet.withdrawalCount || 0;
      user.cryptoWallet.kycStatus = user.cryptoWallet.kycStatus || 'NONE';
      user.cryptoWallet.kycLevel = user.cryptoWallet.kycLevel || 0;

      // Marquer la dernière connexion de wallet
      user.cryptoWallet.lastWithdrawal = user.cryptoWallet.lastWithdrawal || new Date();

      await user.save();

      // Mettre à jour le niveau de sécurité
      await user.updateSecurityLevel();

      // 📊 LOG SUCCÈS
      await auditLogger.logEvent(
        'CRYPTO_DEPOSIT', // Utiliser ce type pour connexion wallet
        'Connexion wallet réussie',
        {
          ...requestInfo,
          userId: user._id.toString(),
          username: user.username,
          success: true,
          details: { 
            address: address.toLowerCase(),
            oldAddress,
            newConnection: !oldAddress,
            kycStatus: user.cryptoWallet.kycStatus,
            securityLevel: user.accountInfo.securityLevel
          },
          severity: 'MEDIUM',
        }
      );

      res.json({
        success: true,
        message: 'Wallet connecté avec succès',
        wallet: {
          address: user.cryptoWallet.address,
          balance: user.cryptoWallet.balance,
          kycStatus: user.cryptoWallet.kycStatus,
          kycLevel: user.cryptoWallet.kycLevel
        }
      });

    } catch (error) {
      await auditLogger.logEvent(
        'SYSTEM_ERROR',
        'Erreur lors de la connexion wallet',
        {
          ...requestInfo,
          userId: req.user?.id,
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          severity: 'HIGH',
        }
      );
      console.error('❌ Erreur connexion wallet:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// GET /api/crypto/wallet - Obtenir les infos du wallet
router.get('/wallet',
  cryptoQueryLimiter,
  antiBotCryptoMiddleware,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const user: any = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      if (!user.cryptoWallet || !user.cryptoWallet.address) {
        return res.json({ 
          success: true, 
          wallet: null,
          message: 'Aucun wallet connecté'
        });
      }

      res.json({
        success: true,
        wallet: {
          address: user.cryptoWallet.address,
          balance: user.cryptoWallet.balance,
          kycStatus: user.cryptoWallet.kycStatus,
          kycLevel: user.cryptoWallet.kycLevel,
          withdrawalCount: user.cryptoWallet.withdrawalCount,
          lastWithdrawal: user.cryptoWallet.lastWithdrawal
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération wallet:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// POST /api/crypto/withdraw - Retrait crypto (ultra-sécurisé)
router.post('/withdraw',
  withdrawalLimiter,
  antiBotCryptoMiddleware,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestInfo = getRequestInfo(req);
    
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const { amount, toAddress, password } = req.body as {
        amount?: number;
        toAddress?: string;
        password?: string;
      };

      // Validation des données
      if (!amount || !toAddress || !password) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de retrait avec données manquantes',
          {
            ...requestInfo,
            userId: req.user.id,
            success: false,
            details: { 
              hasAmount: !!amount, 
              hasAddress: !!toAddress, 
              hasPassword: !!password 
            },
            severity: 'CRITICAL',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Données de retrait incomplètes' 
        });
      }

      // Validation du montant
      const amountValidation = CryptoValidator.validateWithdrawalAmount(amount);
      if (!amountValidation.isValid) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de retrait avec montant invalide',
          {
            ...requestInfo,
            userId: req.user.id,
            success: false,
            details: { amount, reason: amountValidation.message },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: amountValidation.message 
        });
      }

      // Validation adresse de destination
      if (!CryptoValidator.isValidEthereumAddress(toAddress)) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de retrait vers adresse invalide',
          {
            ...requestInfo,
            userId: req.user.id,
            success: false,
            details: { toAddress },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Adresse de destination invalide' 
        });
      }

      // Récupérer l'utilisateur avec mot de passe
      const user: any = await User.findById(req.user.id).select('+password');
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      // Vérifier le mot de passe
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de retrait avec mot de passe incorrect',
          {
            ...requestInfo,
            userId: user._id.toString(),
            username: user.username,
            success: false,
            details: { amount, toAddress },
            severity: 'CRITICAL',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Mot de passe incorrect' 
        });
      }

      // Vérifier le wallet et le solde
      if (!user.cryptoWallet || !user.cryptoWallet.address) {
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun wallet connecté' 
        });
      }

      if (user.cryptoWallet.balance < amount) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de retrait avec solde insuffisant',
          {
            ...requestInfo,
            userId: user._id.toString(),
            success: false,
            details: { 
              requestedAmount: amount, 
              availableBalance: user.cryptoWallet.balance 
            },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Solde insuffisant' 
        });
      }

      // Vérifier le statut KYC pour gros montants
      if (amount > 1 && user.cryptoWallet.kycStatus !== 'VERIFIED') {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de gros retrait sans KYC',
          {
            ...requestInfo,
            userId: user._id.toString(),
            success: false,
            details: { 
              amount, 
              kycStatus: user.cryptoWallet.kycStatus 
            },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Vérification KYC requise pour les retraits supérieurs à 1 ETH' 
        });
      }

      // 🚀 TRAITEMENT DU RETRAIT (simulé pour l'instant)
      // TODO: Intégrer avec un vrai service de blockchain
      
      // Décrémenter le solde
      user.cryptoWallet.balance -= amount;
      user.cryptoWallet.withdrawalCount += 1;
      user.cryptoWallet.lastWithdrawal = new Date();
      
      await user.save();

      // 📊 LOG CRITIQUE
      await auditLogger.logEvent(
        'CRYPTO_WITHDRAWAL',
        'Retrait crypto effectué',
        {
          ...requestInfo,
          userId: user._id.toString(),
          username: user.username,
          success: true,
          details: { 
            amount,
            toAddress: toAddress.toLowerCase(),
            fromAddress: user.cryptoWallet.address,
            newBalance: user.cryptoWallet.balance,
            withdrawalCount: user.cryptoWallet.withdrawalCount
          },
          severity: 'CRITICAL',
        }
      );

      res.json({
        success: true,
        message: 'Retrait traité avec succès',
        transaction: {
          amount,
          toAddress: toAddress.toLowerCase(),
          newBalance: user.cryptoWallet.balance,
          // TODO: Ajouter txHash quand intégration blockchain réelle
        }
      });

    } catch (error) {
      await auditLogger.logEvent(
        'SYSTEM_ERROR',
        'Erreur lors du retrait crypto',
        {
          ...requestInfo,
          userId: req.user?.id,
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          severity: 'CRITICAL',
        }
      );
      console.error('❌ Erreur retrait crypto:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// POST /api/crypto/disconnect-wallet - Déconnecter le wallet
router.post('/disconnect-wallet',
  antiBotCryptoMiddleware,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestInfo = getRequestInfo(req);
    
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const user: any = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      if (!user.cryptoWallet || !user.cryptoWallet.address) {
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun wallet connecté' 
        });
      }

      const oldAddress = user.cryptoWallet.address;
      
      // Supprimer les infos wallet (garder l'historique dans les logs)
      user.cryptoWallet = undefined;
      await user.save();

      // Mettre à jour le niveau de sécurité
      await user.updateSecurityLevel();

      // 📊 LOG
      await auditLogger.logEvent(
        'CRYPTO_TRANSFER', // Utiliser ce type pour déconnexion
        'Déconnexion wallet',
        {
          ...requestInfo,
          userId: user._id.toString(),
          username: user.username,
          success: true,
          details: { disconnectedAddress: oldAddress },
          severity: 'MEDIUM',
        }
      );

      res.json({
        success: true,
        message: 'Wallet déconnecté avec succès'
      });

    } catch (error) {
      await auditLogger.logEvent(
        'SYSTEM_ERROR',
        'Erreur lors de la déconnexion wallet',
        {
          ...requestInfo,
          userId: req.user?.id,
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          severity: 'HIGH',
        }
      );
      console.error('❌ Erreur déconnexion wallet:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// GET /api/crypto/transactions - Historique des transactions (futur)
router.get('/transactions',
  cryptoQueryLimiter,
  antiBotCryptoMiddleware,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // TODO: Implémenter quand base de données des transactions sera créée
      res.json({
        success: true,
        transactions: [],
        message: 'Historique des transactions - Bientôt disponible'
      });
    } catch (error) {
      console.error('❌ Erreur récupération transactions:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

export default router;
