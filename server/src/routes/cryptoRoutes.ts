// server/src/routes/cryptoRoutes.ts - VERSION COMPLÈTE avec logger intégré
import { Router, Request, Response, NextFunction } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { ethersHelper } from '../utils/ethersHelper';
import User from '../models/User';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/Logger.ts';
import { configManager } from '../config/ConfigManager';

const router = Router();

// 🚫 RATE LIMITS DYNAMIQUES depuis la configuration
const createCryptoLimiter = () => {
  const config = configManager.get('security.rateLimits.crypto');
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    message: { error: config.message },
    standardHeaders: true,
    handler: (req: Request, res: Response) => {
      const requestLogger = logger.crypto.withRequest(
        (req as any).requestId, 
        req.ip, 
        req.get('User-Agent')
      );
      
      requestLogger.warn('Rate limit crypto atteint', {
        userId: (req as any).user?.id,
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({ error: config.message });
    }
  });
};

// POST /api/crypto/connect-wallet - Connexion MetaMask avec logs détaillés
router.post('/connect-wallet', 
  createCryptoLimiter(),
  authenticateToken, 
  async (req: AuthenticatedRequest, res: Response) => {
    const requestLogger = logger.crypto.withUser(
      req.user!.id, 
      req.ip
    ).withRequest((req as any).requestId).withAction('wallet_connect');

    try {
      if (!req.user?.id) {
        requestLogger.error('Authentification manquante');
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      // Vérifier si les fonctionnalités crypto sont activées
      if (!configManager.get('crypto.enabled', true)) {
        requestLogger.warn('Crypto désactivé par configuration');
        return res.status(503).json({ 
          success: false, 
          message: 'Fonctionnalités crypto temporairement désactivées' 
        });
      }

      if (!configManager.get('crypto.metamask.enabled', true)) {
        requestLogger.warn('MetaMask désactivé par configuration');
        return res.status(503).json({ 
          success: false, 
          message: 'Connexion MetaMask temporairement désactivée' 
        });
      }

      const { address, signature, message } = req.body as {
        address?: string;
        signature?: string;
        message?: string;
      };

      requestLogger.info('Tentative connexion wallet', { 
        address: address ? ethersHelper.formatAddress(address) : undefined,
        hasSignature: !!signature,
        hasMessage: !!message
      });

      // Validation basique
      if (!address || !signature || !message) {
        requestLogger.warn('Paramètres manquants', { 
          hasAddress: !!address,
          hasSignature: !!signature,
          hasMessage: !!message
        });
        return res.status(400).json({ 
          success: false, 
          message: 'Adresse, signature et message requis' 
        });
      }

      // Validation avec helper
      const validation = await ethersHelper.validateWalletConnection(
        address, 
        message, 
        signature, 
        req.user.id
      );

      if (!validation.isValid) {
        requestLogger.warn('Validation wallet échouée', { 
          address: ethersHelper.formatAddress(address),
          error: validation.error
        });
        return res.status(400).json({ 
          success: false, 
          message: validation.error 
        });
      }

      // Vérifier si l'adresse est déjà utilisée par un autre compte
      const existingUser = await User.findOne({ 
        'cryptoWallet.address': address.toLowerCase(),
        _id: { $ne: req.user.id }
      });

      if (existingUser) {
        requestLogger.warn('Adresse déjà utilisée', { 
          address: ethersHelper.formatAddress(address),
          conflictUserId: existingUser._id?.toString()
        });
        return res.status(409).json({ 
          success: false, 
          message: 'Cette adresse wallet est déjà connectée à un autre compte' 
        });
      }

      // Mettre à jour l'utilisateur
      const user: any = await User.findById(req.user.id);
      if (!user) {
        requestLogger.error('Utilisateur non trouvé');
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      // Vérifier les limites de connexions par heure
      const maxConnections = configManager.get('crypto.metamask.maxConnectionsPerHour', 3);
      const currentConnections = user.cryptoWallet?.connectionCount || 0;
      const lastConnection = user.cryptoWallet?.connectedAt;
      
      if (lastConnection) {
        const hoursSince = (Date.now() - new Date(lastConnection).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 1 && currentConnections >= maxConnections) {
          requestLogger.warn('Limite connexions atteinte', { 
            currentConnections,
            maxConnections,
            hoursSince: Math.round(hoursSince * 100) / 100
          });
          return res.status(429).json({ 
            success: false, 
            message: `Limite de ${maxConnections} connexions par heure atteinte` 
          });
        }
      }

      // Connecter le wallet
      await user.connectWallet(address, 1, req.ip); // Ethereum mainnet par défaut

      requestLogger.info('Wallet connecté avec succès', { 
        address: ethersHelper.formatAddress(address),
        userId: user._id.toString(),
        username: user.username,
        connectionCount: user.cryptoWallet.connectionCount
      });

      res.json({
        success: true,
        message: 'Wallet connecté avec succès',
        walletInfo: {
          address: ethersHelper.formatAddress(address),
          fullAddress: address, // Pour le client
          connectedAt: user.cryptoWallet.connectedAt,
          connectionCount: user.cryptoWallet.connectionCount,
        }
      });

    } catch (error) {
      requestLogger.error('Erreur connexion wallet', { 
error: (error as Error)?.message,
stack: configManager.isDebug() ? (error as Error)?.stack : undefined
      });
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// POST /api/crypto/disconnect-wallet - Déconnexion wallet avec logs
router.post('/disconnect-wallet',
  createCryptoLimiter(),
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestLogger = logger.crypto.withUser(
      req.user!.id, 
      req.ip
    ).withRequest((req as any).requestId).withAction('wallet_disconnect');

    try {
      if (!req.user?.id) {
        requestLogger.error('Authentification manquante');
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const user: any = await User.findById(req.user.id);
      if (!user) {
        requestLogger.error('Utilisateur non trouvé');
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      if (!user.cryptoWallet?.address) {
        requestLogger.warn('Aucun wallet connecté');
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun wallet connecté' 
        });
      }

      const walletAddress = user.cryptoWallet.address;

      // Déconnecter le wallet
      await user.disconnectWallet();

      requestLogger.info('Wallet déconnecté avec succès', { 
        address: ethersHelper.formatAddress(walletAddress),
        userId: user._id.toString(),
        username: user.username
      });

      res.json({
        success: true,
        message: 'Wallet déconnecté avec succès'
      });

    } catch (error) {
      requestLogger.error('Erreur déconnexion wallet', { 
error: (error as Error)?.message,
stack: configManager.isDebug() ? (error as Error)?.stack : undefined
      });
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// GET /api/crypto/wallet-info - Informations du wallet avec logs
router.get('/wallet-info',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestLogger = logger.crypto.withUser(
      req.user!.id, 
      req.ip
    ).withRequest((req as any).requestId).withAction('wallet_info');

    try {
      if (!req.user?.id) {
        requestLogger.error('Authentification manquante');
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const user: any = await User.findById(req.user.id);
      if (!user) {
        requestLogger.error('Utilisateur non trouvé');
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      if (!user.cryptoWallet?.address) {
        requestLogger.debug('Aucun wallet connecté');
        return res.json({
          success: true,
          wallet: null,
          connected: false
        });
      }

      // Log avec niveau configurable
      if (configManager.get('logging.modules.crypto.logAddresses', true)) {
        requestLogger.debug('Informations wallet consultées', { 
          address: ethersHelper.formatAddress(user.cryptoWallet.address),
          connectionCount: user.cryptoWallet.connectionCount
        });
      }

      res.json({
        success: true,
        wallet: {
          address: ethersHelper.formatAddress(user.cryptoWallet.address),
          fullAddress: user.cryptoWallet.address, // Pour le client
          connectedAt: user.cryptoWallet.connectedAt,
          lastActivity: user.cryptoWallet.lastActivity,
          connectionCount: user.cryptoWallet.connectionCount,
          network: user.cryptoWallet.network || 1,
          kycStatus: user.cryptoWallet.kycStatus || 'NONE',
        },
        connected: true
      });

    } catch (error) {
      requestLogger.error('Erreur récupération wallet info', { 
error: (error as Error)?.message,
stack: configManager.isDebug() ? (error as Error)?.stack : undefined
      });
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// POST /api/crypto/verify-signature - Vérification signature avec logs
router.post('/verify-signature',
  createCryptoLimiter(),
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestLogger = logger.crypto.withUser(
      req.user!.id, 
      req.ip
    ).withRequest((req as any).requestId).withAction('verify_signature');

    try {
      const { address, message, signature } = req.body as {
        address?: string;
        message?: string;
        signature?: string;
      };

      requestLogger.info('Vérification signature', { 
        address: address ? ethersHelper.formatAddress(address) : undefined,
        hasMessage: !!message,
        hasSignature: !!signature
      });

      if (!address || !message || !signature) {
        requestLogger.warn('Paramètres manquants pour vérification', { 
          hasAddress: !!address,
          hasMessage: !!message,
          hasSignature: !!signature
        });
        return res.status(400).json({ 
          success: false, 
          message: 'Adresse, message et signature requis' 
        });
      }

      if (!ethersHelper.isValidAddress(address)) {
        requestLogger.warn('Adresse invalide', { address });
        return res.status(400).json({ 
          success: false, 
          message: 'Adresse Ethereum invalide' 
        });
      }

      const isValid = await ethersHelper.verifySignature(address, message, signature);

      // Log signature seulement si activé (sécurité)
      if (configManager.get('logging.modules.crypto.logSignatures', false)) {
        requestLogger.debug('Résultat vérification signature', { 
          address: ethersHelper.formatAddress(address),
          valid: isValid,
          signature: signature.substring(0, 10) + '...'
        });
      } else {
        requestLogger.debug('Signature vérifiée', { 
          address: ethersHelper.formatAddress(address),
          valid: isValid
        });
      }

      res.json({
        success: true,
        valid: isValid,
        address: ethersHelper.formatAddress(address),
        message: isValid ? 'Signature valide' : 'Signature invalide'
      });

    } catch (error) {
      requestLogger.error('Erreur vérification signature', { 
error: (error as Error)?.message,
stack: configManager.isDebug() ? (error as Error)?.stack : undefined
      });
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// GET /api/crypto/challenge - Obtenir un challenge pour signature avec logs
router.get('/challenge',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestLogger = logger.crypto.withUser(
      req.user!.id, 
      req.ip
    ).withRequest((req as any).requestId).withAction('get_challenge');

    try {
      if (!req.user?.id) {
        requestLogger.error('Authentification manquante');
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const message = ethersHelper.generateConnectionMessage(req.user.id);
      const timestamp = Date.now();

      requestLogger.debug('Challenge généré', { 
        userId: req.user.id,
        timestamp
      });

      res.json({
        success: true,
        message,
        userId: req.user.id,
        timestamp
      });

    } catch (error) {
      requestLogger.error('Erreur génération challenge', { 
error: (error as Error)?.message,
stack: configManager.isDebug() ? (error as Error)?.stack : undefined
      });
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// GET /api/crypto/balance - Balance crypto (placeholder pour futures fonctionnalités)
router.get('/balance',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestLogger = logger.crypto.withUser(
      req.user!.id, 
      req.ip
    ).withRequest((req as any).requestId).withAction('get_balance');

    try {
      if (!req.user?.id) {
        requestLogger.error('Authentification manquante');
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const user: any = await User.findById(req.user.id);
      if (!user) {
        requestLogger.error('Utilisateur non trouvé');
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      if (!user.isWalletConnected()) {
        requestLogger.warn('Wallet non connecté pour balance');
        return res.status(400).json({ 
          success: false, 
          message: 'Wallet non connecté' 
        });
      }

      // Pour l'instant, retourner balance fictive
      const balance = user.cryptoWallet?.balance || 0;

      requestLogger.debug('Balance consultée', { 
        address: ethersHelper.formatAddress(user.cryptoWallet.address),
        balance
      });

      res.json({
        success: true,
        balance,
        currency: 'ETH',
        address: ethersHelper.formatAddress(user.cryptoWallet.address)
      });

    } catch (error) {
      requestLogger.error('Erreur récupération balance', { 
error: (error as Error)?.message,
stack: configManager.isDebug() ? (error as Error)?.stack : undefined
      });
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// POST /api/crypto/withdraw - Retrait crypto (placeholder sécurisé)
router.post('/withdraw',
  createCryptoLimiter(),
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestLogger = logger.crypto.withUser(
      req.user!.id, 
      req.ip
    ).withRequest((req as any).requestId).withAction('withdraw');

    try {
      if (!req.user?.id) {
        requestLogger.error('Authentification manquante');
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const { amount, toAddress, signature } = req.body as {
        amount?: number;
        toAddress?: string;
        signature?: string;
      };

      requestLogger.warn('Tentative de retrait', { 
        amount,
        toAddress: toAddress ? ethersHelper.formatAddress(toAddress) : undefined,
        hasSignature: !!signature
      });

      // Validation de base
      if (!amount || !toAddress || !signature) {
        requestLogger.warn('Paramètres retrait manquants', { 
          hasAmount: !!amount,
          hasToAddress: !!toAddress,
          hasSignature: !!signature
        });
        return res.status(400).json({ 
          success: false, 
          message: 'Montant, adresse de destination et signature requis' 
        });
      }

      if (!ethersHelper.isValidAddress(toAddress)) {
        requestLogger.warn('Adresse destination invalide', { 
          toAddress: toAddress 
        });
        return res.status(400).json({ 
          success: false, 
          message: 'Adresse de destination invalide' 
        });
      }

      if (amount <= 0) {
        requestLogger.warn('Montant retrait invalide', { amount });
        return res.status(400).json({ 
          success: false, 
          message: 'Montant invalide' 
        });
      }

      const user: any = await User.findById(req.user.id);
      if (!user || !user.isWalletConnected()) {
        requestLogger.warn('Retrait sans wallet connecté');
        return res.status(400).json({ 
          success: false, 
          message: 'Wallet non connecté' 
        });
      }

      // Vérifier les limites de retrait
      const maxWithdrawals = configManager.get('crypto.security.maxWithdrawalsPerDay', 5);
      const withdrawalCount = user.cryptoWallet?.withdrawalCount || 0;
      const lastWithdrawal = user.cryptoWallet?.lastWithdrawal;
      
      if (lastWithdrawal) {
        const hoursSince = (Date.now() - new Date(lastWithdrawal).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24 && withdrawalCount >= maxWithdrawals) {
          requestLogger.warn('Limite retraits atteinte', { 
            withdrawalCount,
            maxWithdrawals,
            hoursSince: Math.round(hoursSince * 100) / 100
          });
          return res.status(429).json({ 
            success: false, 
            message: `Limite de ${maxWithdrawals} retraits par 24h atteinte` 
          });
        }
      }

      // Pour l'instant, fonctionnalité non implémentée
      requestLogger.info('Retrait demandé (non implémenté)', { 
        amount,
        toAddress: ethersHelper.formatAddress(toAddress),
        fromAddress: ethersHelper.formatAddress(user.cryptoWallet.address)
      });

      res.status(501).json({
        success: false,
        message: 'Fonctionnalité de retrait en cours de développement',
        code: 'NOT_IMPLEMENTED'
      });

    } catch (error) {
      requestLogger.error('Erreur retrait', { 
error: (error as Error)?.message,
stack: configManager.isDebug() ? (error as Error)?.stack : undefined
      });
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// GET /api/crypto/transactions - Historique des transactions (placeholder)
router.get('/transactions',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    const requestLogger = logger.crypto.withUser(
      req.user!.id, 
      req.ip
    ).withRequest((req as any).requestId).withAction('get_transactions');

    try {
      if (!req.user?.id) {
        requestLogger.error('Authentification manquante');
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const user: any = await User.findById(req.user.id);
      if (!user || !user.isWalletConnected()) {
        requestLogger.warn('Historique sans wallet connecté');
        return res.status(400).json({ 
          success: false, 
          message: 'Wallet non connecté' 
        });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      requestLogger.debug('Historique transactions demandé', { 
        address: ethersHelper.formatAddress(user.cryptoWallet.address),
        limit,
        offset
      });

      // Pour l'instant, retourner historique vide
      res.json({
        success: true,
        transactions: [],
        pagination: {
          limit,
          offset,
          total: 0,
          hasMore: false
        },
        wallet: {
          address: ethersHelper.formatAddress(user.cryptoWallet.address)
        }
      });

    } catch (error) {
      requestLogger.error('Erreur historique transactions', { 
error: (error as Error)?.message,
stack: configManager.isDebug() ? (error as Error)?.stack : undefined
      });
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// Middleware de détection d'activité suspecte pour toutes les routes crypto
router.use('*', (req: Request, res: Response, next: NextFunction) => {
  const requestLogger = logger.security.withRequest(
    (req as any).requestId, 
    req.ip, 
    req.get('User-Agent')
  );

  // Détecter les patterns suspects
  const suspiciousPatterns = [
    req.path.includes('../'),
    req.path.includes('..\\'),
    req.get('User-Agent')?.includes('bot'),
    req.get('User-Agent')?.includes('crawler'),
    req.get('User-Agent')?.includes('scanner'),
  ];

  const triggeredPatterns = suspiciousPatterns.map((p, i) => ({ index: i, triggered: p })).filter(p => p.triggered);

  if (triggeredPatterns.length > 0) {
    requestLogger.warn('Pattern suspect détecté sur route crypto', { 
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      patterns: triggeredPatterns
    });
  }

  // Vérifier si auto-détection activée
  if (configManager.get('crypto.security.autoDetectSuspicious', true)) {
    // Log pour analyse future
    requestLogger.debug('Activité crypto surveillée', { 
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id
    });
  }

  next();
});

export default router;
