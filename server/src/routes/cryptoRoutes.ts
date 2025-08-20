// server/src/routes/cryptoRoutes.ts - VERSION SIMPLIFIÉE
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { ethersHelper } from '../utils/ethersHelper';
import User from '../models/User';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting simple
const cryptoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // 20 requêtes par heure
  message: { error: 'Trop de requêtes crypto, réessayez plus tard' },
  handler: (req: Request, res: Response) => {
    console.log(`[CRYPTO] Rate limit atteint - IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({ error: 'Trop de requêtes crypto, réessayez plus tard' });
  }
});

// POST /api/crypto/connect-wallet - Connexion MetaMask
router.post('/connect-wallet', 
  cryptoLimiter,
  authenticateToken, 
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        console.log(`[CRYPTO] Connect wallet - Authentification manquante`);
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const { address, signature, message } = req.body as {
        address?: string;
        signature?: string;
        message?: string;
      };

      console.log(`[CRYPTO] Tentative connexion wallet - User: ${req.user.id}, Address: ${address ? ethersHelper.formatAddress(address) : 'undefined'}`);

      // Validation basique
      if (!address || !signature || !message) {
        console.log(`[CRYPTO] Connect wallet échoué - Paramètres manquants`);
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
        console.log(`[CRYPTO] Connect wallet échoué - Validation: ${validation.error}`);
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
        console.log(`[CRYPTO] Connect wallet échoué - Adresse déjà utilisée: ${ethersHelper.formatAddress(address)}`);
        return res.status(409).json({ 
          success: false, 
          message: 'Cette adresse wallet est déjà connectée à un autre compte' 
        });
      }

      // Mettre à jour l'utilisateur
      const user: any = await User.findById(req.user.id);
      if (!user) {
        console.log(`[CRYPTO] Connect wallet échoué - Utilisateur non trouvé: ${req.user.id}`);
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      // Connecter le wallet
      await user.connectWallet(address, 1, req.ip); // Ethereum mainnet par défaut

      console.log(`[CRYPTO] Wallet connecté avec succès - User: ${user.username}, Address: ${ethersHelper.formatAddress(address)}`);

      res.json({
        success: true,
        message: 'Wallet connecté avec succès',
        walletInfo: {
          address: ethersHelper.formatAddress(address),
          fullAddress: address,
          connectedAt: user.cryptoWallet.connectedAt,
          connectionCount: user.cryptoWallet.connectionCount,
        }
      });

    } catch (error) {
      console.error(`[CRYPTO] Erreur connexion wallet:`, (error as Error).message);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// POST /api/crypto/disconnect-wallet - Déconnexion wallet
router.post('/disconnect-wallet',
  cryptoLimiter,
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
        console.log(`[CRYPTO] Disconnect wallet - Aucun wallet connecté: ${user.username}`);
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun wallet connecté' 
        });
      }

      const walletAddress = user.cryptoWallet.address;

      // Déconnecter le wallet
      await user.disconnectWallet();

      console.log(`[CRYPTO] Wallet déconnecté - User: ${user.username}, Address: ${ethersHelper.formatAddress(walletAddress)}`);

      res.json({
        success: true,
        message: 'Wallet déconnecté avec succès'
      });

    } catch (error) {
      console.error(`[CRYPTO] Erreur déconnexion wallet:`, (error as Error).message);
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
        console.log(`[CRYPTO] Wallet info - Aucun wallet: ${user.username}`);
        return res.json({
          success: true,
          wallet: null,
          connected: false
        });
      }

      console.log(`[CRYPTO] Wallet info consulté - User: ${user.username}, Address: ${ethersHelper.formatAddress(user.cryptoWallet.address)}`);

      res.json({
        success: true,
        wallet: {
          address: ethersHelper.formatAddress(user.cryptoWallet.address),
          fullAddress: user.cryptoWallet.address,
          connectedAt: user.cryptoWallet.connectedAt,
          lastActivity: user.cryptoWallet.lastActivity,
          connectionCount: user.cryptoWallet.connectionCount,
          network: user.cryptoWallet.network || 1,
          kycStatus: user.cryptoWallet.kycStatus || 'NONE',
        },
        connected: true
      });

    } catch (error) {
      console.error(`[CRYPTO] Erreur wallet info:`, (error as Error).message);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// GET /api/crypto/challenge - Obtenir un challenge pour signature
router.get('/challenge',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const message = ethersHelper.generateConnectionMessage(req.user.id);
      const timestamp = Date.now();

      console.log(`[CRYPTO] Challenge généré - User: ${req.user.id}`);

      res.json({
        success: true,
        message,
        userId: req.user.id,
        timestamp
      });

    } catch (error) {
      console.error(`[CRYPTO] Erreur génération challenge:`, (error as Error).message);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

export default router;
