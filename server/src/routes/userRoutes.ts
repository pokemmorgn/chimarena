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

    const stats = {
      playerStats: user.playerStats,
      gameStats: user.gameStats,
      winRate: user.winRate,
      resources: user.resources,
      progression: {
        level: user.playerStats.level,
        experience: user.playerStats.experience,
        experienceToNextLevel: Math.max(0, (user.playerStats.level * 100) - user.playerStats.experience)
      }
    };

    const duration = Date.now() - startTime;

    console.log(`[GAME] Stats calculées - User: ${user.username}, Niveau: ${user.playerStats?.level}, Trophées: ${user.playerStats?.trophies}, Durée: ${duration}ms`);

    res.json({
      success: true,
      stats
    });
  } catch (error: any) {
    console.error(`[GAME] Erreur récupération stats:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/leaderboard - Classements publics
router.get('/leaderboard', statsLimiter, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100); // Max 100
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    console.log(`[GAME] Classement demandé - Limit: ${limit}, Offset: ${offset}`);

    const startTime = Date.now();

    const leaderboard: any[] = await User.find({ 'accountInfo.isBanned': false })
      .sort({ 'playerStats.trophies': -1 })
      .limit(limit)
      .skip(offset)
      .select('username playerStats.level playerStats.trophies gameStats.wins gameStats.totalGames createdAt');

    const totalPlayers = await User.countDocuments({ 'accountInfo.isBanned': false });

    const duration = Date.now() - startTime;

    console.log(`[GAME] Classement généré - ${leaderboard.length} joueurs, Total: ${totalPlayers}, Durée: ${duration}ms`);

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
      },
      meta: {
        queryTime: `${duration}ms`,
        cached: false
      }
    });
  } catch (error: any) {
    console.error(`[GAME] Erreur récupération classement:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/:username - Profil public
router.get('/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    // Validation du username
    if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      console.log(`[API] Username invalide pour profil public: ${username}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Nom d\'utilisateur invalide' 
      });
    }

    console.log(`[API] Profil public demandé - Username: ${username}`);

    const user: any = await User.findOne({ username }).select('-email -cards -resources -accountInfo');

    if (!user || user.accountInfo?.isBanned) {
      console.log(`[API] Profil public non trouvé ou banni - Username: ${username}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Joueur non trouvé' 
      });
    }

    console.log(`[API] Profil public retourné - User: ${user.username}, Level: ${user.playerStats?.level}`);

    res.json({ 
      success: true, 
      player: user.getPublicProfile() 
    });
  } catch (error: any) {
    console.error(`[API] Erreur récupération profil public:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

export default router;
