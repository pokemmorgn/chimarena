import { Router, Request, Response } from 'express';
import User from '../models/User';
import { authenticateToken } from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

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

// PUT /api/user/profile - Mettre à jour le profil
router.put('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const { username } = req.body as { username?: string };
    const user: any = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    if (username && username !== user.username) {
      if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ success: false, message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères' });
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

// GET /api/user/stats - Obtenir les stats détaillées
router.get('/stats', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
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

// GET /api/user/leaderboard
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const leaderboard: any[] = await User.find({ 'accountInfo.isBanned': false })
      .sort({ 'playerStats.trophies': -1 })
      .limit(limit)
      .skip(offset)
      .select('username playerStats.level playerStats.trophies gameStats.wins gameStats.totalGames');

    const totalPlayers = await User.countDocuments({ 'accountInfo.isBanned': false });

    res.json({
      success: true,
      leaderboard: leaderboard.map((player, index) => ({
        rank: offset + index + 1,
        username: player.username,
        level: player.playerStats.level,
        trophies: player.playerStats.trophies,
        wins: player.gameStats.wins,
        totalGames: player.gameStats.totalGames
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

// GET /api/user/:username - Profil public
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const user: any = await User.findOne({ username }).select('-email -cards -resources');

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
