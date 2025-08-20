// server/src/routes/userRoutes.ts - VERSION SIMPLIFIÉE
import { Router, Request, Response } from 'express';
import User from '../models/User';
import { authenticateToken } from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limits simples
const profileUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 modifications par heure
  message: { error: 'Trop de modifications de profil, réessayez dans 1 heure' }
});

const statsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes de stats par 15 min
  message: { error: 'Trop de requêtes de statistiques' }
});

// GET /api/user/profile - Obtenir le profil complet
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      console.log(`[API] Profil non trouvé - User ID: ${req.user.id}`);
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    console.log(`[API] Profil consulté - User: ${user.username}, Level: ${user.playerStats?.level}`);

    res.json({
      success: true,
      user: {
        ...user.getPublicProfile(),
        email: user.email,
        resources: user.resources,
        cards: user.cards,
        deck: user.deck,
        accountInfo: {
          isEmailVerified: user.accountInfo?.isEmailVerified,
          lastLogin: user.accountInfo?.lastLogin,
          loginCount: user.accountInfo?.loginCount,
          securityLevel: user.accountInfo?.securityLevel,
          twoFactorEnabled: user.accountInfo?.twoFactorEnabled,
        },
        cryptoWallet: user.cryptoWallet ? {
          address: user.cryptoWallet.address,
          connectedAt: user.cryptoWallet.connectedAt,
          connectionCount: user.cryptoWallet.connectionCount,
          kycStatus: user.cryptoWallet.kycStatus,
        } : null
      }
    });
  } catch (error: any) {
    console.error(`[API] Erreur récupération profil:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// PUT /api/user/profile - Mettre à jour le profil
router.put('/profile', profileUpdateLimiter, authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const { username } = req.body as { username?: string };
    const user: any = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    console.log(`[API] Modification profil - User: ${user.username}, Nouveau username: ${username}`);

    if (username && username !== user.username) {
      if (username.length < 3 || username.length > 20) {
        console.log(`[API] Username invalide: ${username}`);
        return res.status(400).json({
          success: false,
          message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères'
        });
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        console.log(`[API] Username déjà pris: ${username}`);
        return res.status(400).json({ 
          success: false, 
          message: 'Ce nom d\'utilisateur est déjà pris' 
        });
      }
      
      user.username = username;
    }

    await user.save();

    console.log(`[API] Profil modifié avec succès - User: ${user.username}`);

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user: user.getPublicProfile()
    });
  } catch (error: any) {
    console.error(`[API] Erreur mise à jour profil:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/deck - Obtenir le deck actuel
router.get('/deck', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    console.log(`[GAME] Deck consulté - User: ${user.username}, Taille: ${user.deck?.length || 0}`);

    res.json({ 
      success: true, 
      deck: user.deck, 
      cards: user.cards 
    });
  } catch (error: any) {
    console.error(`[GAME] Erreur récupération deck:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/stats - Obtenir les stats détaillées
router.get('/stats', statsLimiter, authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const startTime = Date.now();

 user.gameStats,
      winRate: user.winRate,
      resources: user.resources,
      progression: {
        level: user.playerStats.level
