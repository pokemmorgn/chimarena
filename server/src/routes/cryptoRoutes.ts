// server/src/routes/cryptoSimple.ts - ROUTES CRYPTO SIMPLIFIÉES POUR JEU
import { Router, Request, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';
import { ethersHelper } from '../utils/ethersSimple';
import User from '../models/User';
import rateLimit from 'express-rate-limit';

const router = Router();

// 🚫 RATE LIMITS RAISONNABLES
const cryptoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20, // 20 actions crypto par heure (raisonnable pour un jeu)
  message: { error: 'Trop d\'actions crypto, réessayez dans 1 heure' },
  standardHeaders: true,
});

// POST /api/crypto/connect-wallet - Connexion MetaMask simple
router.post('/connect-wallet', 
  cryptoLimiter,
  authenticateToken, 
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, message: 'Authentification requise' });
      }

      const { address, signature, message } = req.body as {
        address?: string;
        signature?: string;
        message?: string;
      };

      // Validation basique
      if (!address || !signature || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Adresse, signature et message requis' 
        });
      }

      // Validation avec helper simplifié
      const validation = await ethersHelper.validateWalletConnection(
        address, 
        message, 
        signature, 
        req.user.id
      );

      if (!validation.isValid) {
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
        return res.status(409).json({ 
          success: false, 
          message: 'Cette adresse wallet est déjà connectée à un autre compte' 
        });
      }

      // Mettre à jour l'utilisateur
      const user: any = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
      }

      user.cryptoWallet = {
        address: address.toLowerCase(),
        connectedAt: new Date(),
        lastActivity: new Date(),
        connectionCount: (user.cryptoWallet?.connectionCount || 0) + 1,
      };

      await user.save();

      console.log(`✅ Wallet connecté: ${ethersHelper.formatAddress(address)} -> ${user.username}`);

      res.json({
        success: true,
        message: 'Wallet connecté avec succès',
        wallet: {
          address: ethersHelper.formatAddress(address),
          connectedAt: user.cryptoWallet.connectedAt,
          connectionCount: user.cryptoWallet.connectionCount,
        }
      });

    } catch (error) {
      console.error('❌ Erreur connexion wallet:', error);
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
        return res.status(400).json({ 
          success: false, 
          message: 'Aucun wallet connecté' 
        });
      }

      const walletAddress = user.cryptoWallet.address;

      // Supprimer le wallet
      user.cryptoWallet = undefined;
      await user.save();

      console.log(`✅ Wallet déconnecté: ${ethersHelper.formatAddress(walletAddress)} -> ${user.username}`);

      res.json({
        success: true,
        message: 'Wallet déconnecté avec succès'
      });

    } catch (error) {
      console.error('❌ Erreur déconnexion wallet:', error);
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

      res.json({
        success: true,
        wallet: {
          address: ethersHelper.formatAddress(user.cryptoWallet.address),
          fullAddress: user.cryptoWallet.address, // Pour le client
          connectedAt: user.cryptoWallet.connectedAt,
          lastActivity: user.cryptoWallet.lastActivity,
          connectionCount: user.cryptoWallet.connectionCount,
        },
        connected: true
      });

    } catch (error) {
      console.error('❌ Erreur récupération wallet info:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

// POST /api/crypto/verify-signature - Vérification signature (utilitaire)
router.post('/verify-signature',
  cryptoLimiter,
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
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

      res.json({
        success: true,
        valid: isValid,
        address: ethersHelper.formatAddress(address),
        message: isValid ? 'Signature valide' : 'Signature invalide'
      });

    } catch (error) {
      console.error('❌ Erreur vérification signature:', error);
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

      res.json({
        success: true,
        message,
        userId: req.user.id,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Erreur génération challenge:', error);
      res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
    }
  }
);

export default router;
