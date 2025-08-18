// server/src/routes/cryptoRoutes.ts - ROUTES CRYPTO ULTRA-SÉCURISÉES
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { cryptoValidationMiddleware, cryptoSignatureMiddleware } from '../middleware/cryptoMiddleware';
import { ethersHelper } from '../utils/ethersHelper';
import { auditLogger } from '../utils/auditLogger';
import { securityManager } from '../config/security';
import User from '../models/User';
import rateLimit from 'express-rate-limit';

const router = Router();

// 🚫 RATE LIMITS ULTRA-STRICTS POUR CRYPTO
const cryptoConnectionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3, // 3 connexions wallet par heure
  message: { error: 'Trop de connexions wallet, réessayez dans 1 heure' },
  keyGenerator: (req: Request) => {
    const ip = req.ip || 'unknown';
    const userId = (req as AuthenticatedRequest).user?.id || 'anonymous';
    return securityManager.hashSensitiveData(ip + userId);
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const cryptoActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 actions crypto par heure
  message: { error: 'Trop d\'actions crypto, réessayez dans 1 heure' },
  keyGenerator: (req: Request) => {
    const userId = (req as AuthenticatedRequest).user?.id || 'anonymous';
    return securityManager.hashSensitiveData(userId + 'crypto-actions');
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const withdrawalLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 heures
  max: 5, // 5 retraits par jour
  message: { error: 'Limite de retraits journalière atteinte' },
  keyGenerator: (req: Request) => {
    const userId = (req as AuthenticatedRequest).user?.id || 'anonymous';
    return securityManager.hashSensitiveData(userId + 'withdrawals');
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// 📝 HELPER POUR L'AUDIT CRYPTO
const getRequestInfo = (req: Request) => ({
  ip: req.ip || 'unknown',
  userAgent: req.headers['user-agent'] || '',
  sessionId: (req as any).sessionID || securityManager.generateSecureToken(16),
});

// POST /api/crypto/connect-wallet - Connexion MetaMask sécurisée
router.post('/connect-wallet', 
  cryptoConnectionLimiter,
  authenticateToken, 
  cryptoValidationMiddleware,
  cryptoSignatureMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestInfo = getRequestInfo(req);
    
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const { address, signature, message, timestamp } = req.body as {
        address?: string;
        signature?: string;
        message?: string;
        timestamp?: number;
      };

      // Validation présence des champs
      if (!address || !signature || !message || !timestamp) {
        await auditLogger.logEvent(
          'CRYPTO_DEPOSIT',
          'Tentative de connexion wallet avec champs manquants',
          {
            ...requestInfo,
            userId: req.user.id,
            username: req.user.username,
            success: false,
            details: { 
              hasAddress: !!address, 
              hasSignature: !!signature, 
              hasMessage: !!message, 
              hasTimestamp: !!timestamp 
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
      if (!ethersHelper.isValidAddress(address)) {
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

      // Validation timestamp (max 5 minutes)
      const now = Date.now();
      if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de connexion wallet avec timestamp expiré',
          {
            ...requestInfo,
            userId: req.user.id,
            username: req.user.username,
            success: false,
            details: { 
              timestamp, 
              now, 
              diff: Math.abs(now - timestamp),
              maxAge: 5 * 60 * 1000 
            },
            severity: 'HIGH',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Signature expirée, veuillez réessayer' 
        });
      }

      // Vérification de la signature
      const isValidSignature = await ethersHelper.verifySignature(address, message, signature);
      if (!isValidSignature) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de connexion wallet avec signature invalide',
          {
            ...requestInfo,
            userId: req.user.id,
            username: req.user.username,
            success: false,
            details: { address, message: message.substring(0, 100) },
            severity: 'CRITICAL',
          }
        );
        return res.status(400).json({ 
          success: false, 
          message: 'Signature MetaMask invalide' 
        });
      }

      // Récupérer l'utilisateur
      const user: any = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      // Vérifier si l'adresse est déjà utilisée par un autre compte
      const existingUser = await User.findOne({ 
        'cryptoWallet.address': address,
        _id: { $ne: user._id }
      });

      if (existingUser) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de connexion wallet déjà utilisé par un autre compte',
          {
            ...requestInfo,
            userId: req.user.id,
            username: req.user.username,
            success: false,
            details: { 
              address, 
              existingUserId: existingUser._id.toString(),
              existingUsername: existingUser.username 
            },
            severity: 'CRITICAL',
          }
        );
        return res.status(409).json({ 
          success: false, 
          message: 'Cette adresse wallet est déjà connectée à un autre compte' 
        });
      }

      // Mettre à jour les infos wallet de l'utilisateur
      user.cryptoWallet = {
        address,
        connectedAt: new Date(),
        lastActivity: new Date(),
        connectionCount: (user.cryptoWallet?.connectionCount || 0) + 1,
        balance: 0, // À mettre à jour via une API externe
        withdrawalCount: user.cryptoWallet?.withdrawalCount || 0,
        kycStatus: user.cryptoWallet?.kycStatus || 'NONE',
        kycLevel: user.cryptoWallet?.kycLevel || 0,
        lastSignatureTimestamp: new Date(timestamp),
        usedNonces: user.cryptoWallet?.usedNonces || [],
        suspiciousActivityCount: user.cryptoWallet?.suspiciousActivityCount || 0,
        dailyWithdrawalCount: 0, // Reset daily
        lastWithdrawalReset: new Date(),
      };

      await user.save();

      // 📊 LOG SUCCÈS
      await auditLogger.logEvent(
        'CRYPTO_DEPOSIT',
        'Connexion wallet MetaMask réussie',
        {
          ...requestInfo,
          userId: req.user.id,
          username: req.user.username,
          success: true,
          details: { 
            address,
            connectionCount: user.cryptoWallet.connectionCount,
            previouslyConnected: user.cryptoWallet.connectionCount > 1
          },
          severity: 'MEDIUM',
        }
      );

      res.json({
        success: true,
        message: 'Wallet connecté avec succès',
        wallet: {
          address,
          connectedAt: user.cryptoWallet.connectedAt,
          connectionCount: user.cryptoWallet.connectionCount,
          kycStatus: user.cryptoWallet.kycStatus,
          balance: user.cryptoWallet.balance
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
      console.error('Erreur connexion wallet:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// POST /api/crypto/disconnect-wallet - Déconnexion wallet
router.post('/disconnect-wallet',
  cryptoActionLimiter,
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

      if (!user.cryptoWallet?.address) {
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun wallet connecté' 
        });
      }

      const walletAddress = user.cryptoWallet.address;

      // Supprimer les infos wallet (garder historique dans l'audit)
      user.cryptoWallet = undefined;
      await user.save();

      // 📊 LOG DÉCONNEXION
      await auditLogger.logEvent(
        'CRYPTO_WITHDRAWAL',
        'Déconnexion wallet MetaMask',
        {
          ...requestInfo,
          userId: req.user.id,
          username: req.user.username,
          success: true,
          details: { address: walletAddress },
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
      console.error('Erreur déconnexion wallet:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// GET /api/crypto/wallet-info - Informations du wallet
router.get('/wallet-info',
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

      if (!user.cryptoWallet?.address) {
        return res.json({
          success: true,
          wallet: null,
          connected: false
        });
      }

      // Informations wallet (sans données sensibles)
      res.json({
        success: true,
        wallet: {
          address: user.cryptoWallet.address,
          connectedAt: user.cryptoWallet.connectedAt,
          lastActivity: user.cryptoWallet.lastActivity,
          connectionCount: user.cryptoWallet.connectionCount,
          balance: user.cryptoWallet.balance,
          kycStatus: user.cryptoWallet.kycStatus,
          kycLevel: user.cryptoWallet.kycLevel,
          withdrawalCount: user.cryptoWallet.withdrawalCount,
          dailyWithdrawalCount: user.cryptoWallet.dailyWithdrawalCount || 0
        },
        connected: true
      });

    } catch (error) {
      console.error('Erreur récupération wallet info:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// POST /api/crypto/verify-signature - Vérification signature (utilitaire)
router.post('/verify-signature',
  cryptoActionLimiter,
  authenticateToken,
  cryptoValidationMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestInfo = getRequestInfo(req);
    
    try {
      const { address, message, signature } = req.body as {
        address?: string;
        message?: string;
        signature?: string;
      };

      if (!address || !message || !signature) {
        return res.status(400).json({ 
          success: false, 
          message: 'Adresse, message et signature requis' 
        });
      }

      if (!ethersHelper.isValidAddress(address)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Adresse Ethereum invalide' 
        });
      }

      const isValid = await ethersHelper.verifySignature(address, message, signature);

      // Log de vérification
      await auditLogger.logEvent(
        'CRYPTO_TRADE',
        'Vérification de signature',
        {
          ...requestInfo,
          userId: req.user?.id,
          username: req.user?.username,
          success: isValid,
          details: { 
            address, 
            messageLength: message.length,
            signatureValid: isValid 
          },
          severity: 'LOW',
        }
      );

      res.json({
        success: true,
        valid: isValid,
        address,
        message: isValid ? 'Signature valide' : 'Signature invalide'
      });

    } catch (error) {
      await auditLogger.logEvent(
        'SYSTEM_ERROR',
        'Erreur lors de la vérification de signature',
        {
          ...requestInfo,
          userId: req.user?.id,
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          severity: 'MEDIUM',
        }
      );
      console.error('Erreur vérification signature:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// 💰 ROUTES FUTURES POUR RETRAITS (ultra-sécurisées)
/*
// POST /api/crypto/withdraw - Retrait crypto (très strict)
router.post('/withdraw',
  withdrawalLimiter,
  authenticateToken,
  cryptoValidationMiddleware,
  cryptoSignatureMiddleware,
  antiBotCryptoMiddleware, // Sera ajouté au serveur
  async (req: AuthenticatedRequest, res: Response) => {
    // TODO: Implémenter avec :
    // - Validation KYC obligatoire
    // - Délai de 24h pour nouveaux wallets
    // - Double vérification (email + signature)
    // - Seuils de retrait journaliers/mensuels
    // - Audit critique de toutes les transactions
  }
);

// GET /api/crypto/transaction-history - Historique transactions
router.get('/transaction-history',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    // TODO: Historique des transactions crypto avec pagination
  }
);
*/

export default router;
