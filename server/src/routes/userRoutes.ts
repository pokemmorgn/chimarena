// server/src/routes/userRoutes.ts - VERSION MISE À JOUR avec logger intégré
import { Router, Request, Response } from 'express';
import User from '../models/User';
import { authenticateToken } from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/Logger';
import { configManager } from '../config/ConfigManager';

const router = Router();

// 📊 RATE LIMITS DYNAMIQUES depuis la configuration
const createProfileUpdateLimiter = () => {
  const config = configManager.get('security.rateLimits.api');
  return rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure fixe pour profil
    max: 5, // 5 modifications par heure max
    message: { error: 'Trop de modifications de profil' },
    standardHeaders: true,
    handler: (req: Request, res: Response) => {
      const requestLogger = logger.api.withRequest(
        (req as any).requestId, 
        req.ip, 
        req.get('User-Agent')
      );
      
      requestLogger.warn('Rate limit profil atteint', {
        userId: (req as any).user?.id,
        path: req.path
      });
      
      res.status(429).json({ error: 'Trop de modifications de profil, réessayez dans 1 heure' });
    }
  });
};

const createStatsLimiter = () => {
  const config = configManager.get('security.rateLimits.api');
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requêtes de stats par 15 min
    message: { error: 'Trop de requêtes de statistiques' },
    standardHeaders: true,
    handler: (req: Request, res: Response) => {
      const requestLogger = logger.api.withRequest(
        (req as any).requestId, 
        req.ip
      );
      
      requestLogger.warn('Rate limit stats atteint', {
        userId: (req as any).user?.id,
        path: req.path
      });
      
      res.status(429).json({ error: 'Trop de requêtes de statistiques' });
    }
  });
};

// GET /api/user/profile - Obtenir le profil complet avec logs
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const requestLogger = logger.api.withUser(
    req.user!.id, 
    req.ip
  ).withRequest((req as any).requestId).withAction('get_profile');

  try {
    if (!req.user?.id) {
      requestLogger.error('Authentification manquante');
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      requestLogger.warn('Utilisateur non trouvé pour profil');
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    requestLogger.debug('Profil consulté', { 
      username: user.username,
      level: user.playerStats?.level,
      securityLevel: user.accountInfo?.securityLevel
    });

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
        // Inclure wallet si connecté et logging autorisé
        ...(user.cryptoWallet && configManager.get('logging.modules.crypto.logAddresses', true) && {
          cryptoWallet: {
            address: user.cryptoWallet.address,
            connectedAt: user.cryptoWallet.connectedAt,
            connectionCount: user.cryptoWallet.connectionCount,
            kycStatus: user.cryptoWallet.kycStatus,
          }
        })
      }
    });
  } catch (error) {
    requestLogger.error('Erreur récupération profil', { 
      error: error.message,
      stack: configManager.isDebug() ? error.stack : undefined
    });
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// PUT /api/user/profile - Mettre à jour le profil avec logs et limite
router.put('/profile', createProfileUpdateLimiter(), authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const requestLogger = logger.api.withUser(
    req.user!.id, 
    req.ip
  ).withRequest((req as any).requestId).withAction('update_profile');

  try {
    if (!req.user?.id) {
      requestLogger.error('Authentification manquante');
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const { username } = req.body as { username?: string };
    const user: any = await User.findById(req.user.id);
    if (!user) {
      requestLogger.warn('Utilisateur non trouvé pour mise à jour');
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const oldData = { username: user.username };

    requestLogger.info('Tentative modification profil', { 
      oldUsername: user.username,
      newUsername: username,
      changes: Object.keys(req.body)
    });

    if (username && username !== user.username) {
      if (username.length < 3 || username.length > 20) {
        requestLogger.warn('Username invalide', { 
          username,
          length: username.length
        });
        return res.status(400).json({
          success: false,
          message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères'
        });
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        requestLogger.warn('Username déjà pris', { 
          requestedUsername: username,
          conflictUserId: existingUser._id.toString()
        });
        return res.status(400).json({ 
          success: false, 
          message: 'Ce nom d\'utilisateur est déjà pris' 
        });
      }
      
      user.username = username;
    }

    await user.save();

    requestLogger.info('Profil modifié avec succès', { 
      oldUsername: oldData.username,
      newUsername: user.username,
      userId: user._id.toString()
    });

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user: user.getPublicProfile()
    });
  } catch (error) {
    requestLogger.error('Erreur mise à jour profil', { 
      error: error.message,
      stack: configManager.isDebug() ? error.stack : undefined
    });
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/deck - Obtenir le deck actuel avec logs
router.get('/deck', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const requestLogger = logger.game.withUser(
    req.user!.id, 
    req.ip
  ).withRequest((req as any).requestId).withAction('get_deck');

  try {
    if (!req.user?.id) {
      requestLogger.error('Authentification manquante');
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      requestLogger.warn('Utilisateur non trouvé pour deck');
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    if (configManager.get('logging.modules.game.logCardActions', false)) {
      requestLogger.debug('Deck consulté', { 
        username: user.username,
        deckSize: user.deck?.length || 0,
        cardsOwned: user.cards?.length || 0
      });
    }

    res.json({ 
      success: true, 
      deck: user.deck, 
      cards: user.cards 
    });
  } catch (error) {
    requestLogger.error('Erreur récupération deck', { 
      error: error.message
    });
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/stats - Obtenir les stats détaillées avec limite et logs
router.get('/stats', createStatsLimiter(), authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const requestLogger = logger.game.withUser(
    req.user!.id, 
    req.ip
  ).withRequest((req as any).requestId).withAction('get_stats');

  try {
    if (!req.user?.id) {
      requestLogger.error('Authentification manquante');
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      requestLogger.warn('Utilisateur non trouvé pour stats');
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

    if (configManager.get('logging.modules.performance.enabled', false)) {
      requestLogger.debug('Stats calculées', { 
        username: user.username,
        level: user.playerStats?.level,
        trophies: user.playerStats?.trophies,
        winRate: user.winRate,
        duration: `${duration}ms`
      });
    }

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    requestLogger.error('Erreur récupération stats', { 
      error: error.message,
      stack: configManager.isDebug() ? error.stack : undefined
    });
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/leaderboard - Classements publics avec limite et logs
router.get('/leaderboard', createStatsLimiter(), async (req: Request, res: Response) => {
  const requestLogger = logger.game.withRequest(
    (req as any).requestId, 
    req.ip, 
    req.get('User-Agent')
  ).withAction('get_leaderboard');

  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100); // Max 100
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    requestLogger.debug('Classement demandé', { 
      limit,
      offset,
      userAgent: req.get('User-Agent')?.substring(0, 50)
    });

    const startTime = Date.now();

    const leaderboard: any[] = await User.find({ 'accountInfo.isBanned': false })
      .sort({ 'playerStats.trophies': -1 })
      .limit(limit)
      .skip(offset)
      .select('username playerStats.level playerStats.trophies gameStats.wins gameStats.totalGames createdAt');

    const totalPlayers = await User.countDocuments({ 'accountInfo.isBanned': false });

    const duration = Date.now() - startTime;

    // Log performance si requête lente
    if (duration > configManager.get('logging.modules.performance.slowQueryThresholdMs', 1000)) {
      requestLogger.warn('Requête classement lente', { 
        duration: `${duration}ms`,
        limit,
        offset,
        totalPlayers
      });
    } else if (configManager.get('logging.modules.performance.enabled', false)) {
      requestLogger.debug('Classement généré', { 
        duration: `${duration}ms`,
        playersReturned: leaderboard.length,
        totalPlayers
      });
    }

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
        cached: false // Pour future implémentation cache
      }
    });
  } catch (error) {
    requestLogger.error('Erreur récupération classement', { 
      error: error.message,
      stack: configManager.isDebug() ? error.stack : undefined
    });
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/user/:username - Profil public avec validation et logs
router.get('/:username', async (req: Request, res: Response) => {
  const requestLogger = logger.api.withRequest(
    (req as any).requestId, 
    req.ip, 
    req.get('User-Agent')
  ).withAction('get_public_profile');

  try {
    const { username } = req.params;

    // Validation du username
    if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      requestLogger.warn('Username invalide pour profil public', { 
        username,
        length: username?.length
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Nom d\'utilisateur invalide' 
      });
    }

    requestLogger.debug('Profil public demandé', { 
      requestedUsername: username
    });

    const user: any = await User.findOne({ username }).select('-email -cards -resources -accountInfo');

    if (!user || user.accountInfo?.isBanned) {
      requestLogger.info('Profil public non trouvé ou banni', { 
        username,
        found: !!user,
        banned: user?.accountInfo?.isBanned || false
      });
      return res.status(404).json({ 
        success: false, 
        message: 'Joueur non trouvé' 
      });
    }

    requestLogger.debug('Profil public retourné', { 
      username: user.username,
      level: user.playerStats?.level,
      trophies: user.playerStats?.trophies
    });

    res.json({ 
      success: true, 
      player: user.getPublicProfile() 
    });
  } catch (error) {
    requestLogger.error('Erreur récupération profil public', { 
      error: error.message,
      username: req.params.username
    });
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

export default router;
