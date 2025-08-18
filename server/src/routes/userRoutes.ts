// server/src/routes/userRoutes.ts
import { Router, Request, Response } from 'express';
import User from '../models/User';
import { authenticateToken } from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// 📊 Rate limits spécifiques pour les actions utilisateur
const profileUpdateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 modifications de profil par heure
  message: { error: 'Trop de modifications de profil, réessayez dans 1 heure' },
  standardHeaders: true,
  legacyHeaders: false,
});

const statsQueryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes de stats par 15 min
  message: { error: 'Trop de requêtes de statistiques' },
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /api/user/profile - Obtenir le profil complet
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

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
          loginCount: user.accountInfo?.loginCount
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// PUT /api/user/profile - Mettre à jour le profil (avec rate limit)
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

    const oldData = { username: user.username };

    if (username && username !== user.username) {
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({
          success: false,
          message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères'
        });
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Ce nom d\'utilisateur est déjà pris' });
      }
      user.username = username;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Erreur mise à jour profil:', error);
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

    res.json({ success: true, deck: user.deck, cards: user.cards });
  } catch (error) {
    console.error('Erreur récupération deck:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/stats - Obtenir les stats détaillées (avec rate limit)
router.get('/stats', statsQueryLimiter, authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    res.json({
      success: true,
      stats: {
        playerStats: user.playerStats,
        gameStats: user.gameStats,
        winRate: user.winRate,
        resources: user.resources,
        progression: {
          level: user.playerStats.level,
          experience: user.playerStats.experience,
          experienceToNextLevel: Math.max(0, (user.playerStats.level * 100) - user.playerStats.experience)
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération stats:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/leaderboard - Classements publics (pas d'auth requise, mais rate limit)
router.get('/leaderboard', statsQueryLimiter, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100); // Max 100
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const leaderboard: any[] = await User.find({ 'accountInfo.isBanned': false })
      .sort({ 'playerStats.trophies': -1 })
      .limit(limit)
      .skip(offset)
      .select('username playerStats.level playerStats.trophies gameStats.wins gameStats.totalGames createdAt');

    const totalPlayers = await User.countDocuments({ 'accountInfo.isBanned': false });

    res.json({
      success: true,
      leaderboard: leaderboard.map((player, index) => ({
        rank: offset + index + 1,
        username: player.username,
        level: player.playerStats.level,
        trophies: player.playerStats.trophies,
        wins: player.gameStats.wins,
        totalGames: player.gameStats.totalGames,
        winRate: player.gameStats.totalGames > 0
          ? Math.round((player.gameStats.wins / player.gameStats.totalGames) * 100)
          : 0,
        memberSince: player.createdAt
      })),
      pagination: {
        total: totalPlayers,
        limit,
        offset,
        hasNext: offset + limit < totalPlayers
      }
    });
  } catch (error) {
    console.error('Erreur récupération leaderboard:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/:username - Profil public (avec validation entrée)
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, message: 'Nom d\'utilisateur invalide' });
    }

    const user: any = await User.findOne({ username }).select('-email -cards -resources -accountInfo');

    if (!user || user.accountInfo?.isBanned) {
      return res.status(404).json({ success: false, message: 'Joueur non trouvé' });
    }

    res.json({ success: true, player: user.getPublicProfile() });
  } catch (error) {
    console.error('Erreur récupération profil public:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

export default router;
