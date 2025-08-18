// server/src/routes/userRoutes.ts
import { Router, Request, Response } from 'express';
import User from '../models/User';
import { authenticateToken } from '../middleware/authMiddleware';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

// 🔐 NOUVEAUX IMPORTS SÉCURITÉ
import { auditLogger } from '../utils/auditLogger';
import rateLimit from 'express-rate-limit';
import { securityManager } from '../config/security';

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

// 📝 HELPER POUR L'AUDIT
const getRequestInfo = (req: Request) => ({
  ip: req.ip || 'unknown',
  userAgent: req.headers['user-agent'] || '',
sessionId: (req as any).sessionID || securityManager.generateSecureToken(16),
});

// GET /api/user/profile - Obtenir le profil complet (avec audit léger)
router.get('/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      const requestInfo = getRequestInfo(req);
      await auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Tentative d\'accès au profil avec utilisateur inexistant',
        {
          ...requestInfo,
          userId: req.user.id,
          username: req.user.username,
          success: false,
          details: { requestedUserId: req.user.id },
          severity: 'HIGH',
        }
      );
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
    const requestInfo = getRequestInfo(req);
    await auditLogger.logEvent(
      'SYSTEM_ERROR',
      'Erreur lors de la récupération du profil',
      {
        ...requestInfo,
        userId: req.user?.id,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        severity: 'MEDIUM',
      }
    );
    console.error('Erreur récupération profil:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// PUT /api/user/profile - Mettre à jour le profil (avec rate limit et audit)
router.put('/profile', profileUpdateLimiter, authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const requestInfo = getRequestInfo(req);
  
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const { username } = req.body as { username?: string };
    const user: any = await User.findById(req.user.id);
    if (!user) {
      await auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Tentative de modification de profil avec utilisateur inexistant',
        {
          ...requestInfo,
          userId: req.user.id,
          username: req.user.username,
          success: false,
          details: { requestedUserId: req.user.id },
          severity: 'HIGH',
        }
      );
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const oldData = { username: user.username };

    if (username && username !== user.username) {
      if (username.length < 3 || username.length > 20) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de modification avec nom d\'utilisateur invalide',
          {
            ...requestInfo,
            userId: user._id.toString(),
            username: user.username,
            success: false,
            details: { newUsername: username, length: username.length },
            severity: 'MEDIUM',
          }
        );
        return res.status(400).json({ success: false, message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères' });
      }

      const existingUser = await User.findOne({ username });
      if (existingUser) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative de modification avec nom d\'utilisateur déjà pris',
          {
            ...requestInfo,
            userId: user._id.toString(),
            username: user.username,
            success: false,
            details: { attemptedUsername: username },
            severity: 'MEDIUM',
          }
        );
        return res.status(400).json({ success: false, message: 'Ce nom d\'utilisateur est déjà pris' });
      }
      user.username = username;
    }

    await user.save();

    // 📊 LOG SUCCÈS
    await auditLogger.logEvent(
      'AUTH_EMAIL_CHANGE', // Utilise ce type pour les changements de profil
      'Modification de profil réussie',
      {
        ...requestInfo,
        userId: user._id.toString(),
        username: user.username,
        success: true,
        details: { 
          oldData,
          newData: { username: user.username },
          changes: username !== oldData.username ? ['username'] : []
        },
        severity: 'LOW',
      }
    );

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user: user.getPublicProfile()
    });
  } catch (error) {
    await auditLogger.logEvent(
      'SYSTEM_ERROR',
      'Erreur lors de la modification du profil',
      {
        ...requestInfo,
        userId: req.user?.id,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        severity: 'MEDIUM',
      }
    );
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
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

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
        winRate: player.gameStats.totalGames > 0 ? Math.round((player.gameStats.wins / player.gameStats.totalGames) * 100) : 0,
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

// GET /api/user/:username - Profil public (avec protection contre l'énumération)
router.get('/:username', async (req: Request, res: Response) => {
  const requestInfo = getRequestInfo(req);
  
  try {
    const { username } = req.params;
    
    // Validation basique du username pour éviter les injections
    if (!username || username.length < 3 || username.length > 20 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      await auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Tentative d\'accès au profil avec nom d\'utilisateur invalide',
        {
          ...requestInfo,
          success: false,
          details: { username, length: username?.length },
          severity: 'MEDIUM',
        }
      );
      return res.status(400).json({ success: false, message: 'Nom d\'utilisateur invalide' });
    }

    const user: any = await User.findOne({ username }).select('-email -cards -resources -accountInfo');

    if (!user || user.accountInfo?.isBanned) {
      // Ne pas révéler si l'utilisateur existe mais est banni (protection contre l'énumération)
      return res.status(404).json({ success: false, message: 'Joueur non trouvé' });
    }

    res.json({ success: true, player: user.getPublicProfile() });
  } catch (error) {
    await auditLogger.logEvent(
      'SYSTEM_ERROR',
      'Erreur lors de la récupération du profil public',
      {
        ...requestInfo,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        details: { username: req.params.username },
        severity: 'MEDIUM',
      }
    );
    console.error('Erreur récupération profil public:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// 🎮 ROUTES GAMING FUTURES (avec protection gaming-friendly)
// Ces routes utiliseront antiBotGamingMiddleware quand implémentées

/*
// PUT /api/user/deck - Modifier le deck (gaming action)
router.put('/deck', antiBotGamingMiddleware, authenticateToken, async (req, res) => {
  // TODO: Implémenter modification de deck avec audit léger
});

// POST /api/user/game/match-result - Enregistrer résultat de match
router.post('/game/match-result', antiBotGamingMiddleware, authenticateToken, async (req, res) => {
  // TODO: Implémenter avec audit des résultats
});
*/

// 💰 ROUTES CRYPTO FUTURES (avec protection ultra-stricte)
// Ces routes utiliseront antiBotCryptoMiddleware quand implémentées

/*
// GET /api/user/wallet - Voir portefeuille crypto
router.get('/wallet', antiBotCryptoMiddleware, authenticateToken, async (req, res) => {
  // TODO: Implémenter avec audit critique
});

// POST /api/user/crypto/withdraw - Retrait crypto
router.post('/crypto/withdraw', antiBotCryptoMiddleware, authenticateToken, async (req, res) => {
  // TODO: Implémenter avec délai de 24h et audit critique
});
*/

export default router;
