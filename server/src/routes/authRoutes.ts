// server/src/routes/authRoutes.ts - VERSION MISE À JOUR avec logger intégré
import { Router, Request, Response } from 'express';
import User from '../models/User';
import { 
  authenticateToken, 
  AuthenticatedRequest,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from '../middleware/authMiddleware';
import { logger } from '../utils/Logger';
import { configManager } from '../config/ConfigManager';

const router = Router();

// Cookie options dynamiques depuis la configuration
const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: configManager.get('auth.cookieOptions.secure') === 'auto' 
    ? configManager.isProduction() 
    : configManager.get('auth.cookieOptions.secure'),
  sameSite: configManager.get('auth.cookieOptions.sameSite') as 'strict' | 'lax' | 'none',
  path: '/',
  maxAge: configManager.get('auth.cookieOptions.maxAge'),
});

// POST /api/auth/register - Inscription avec logs sécurisés
router.post('/register', async (req: Request, res: Response) => {
  const requestLogger = logger.auth.withRequest(
    (req as any).requestId, 
    req.ip, 
    req.get('User-Agent')
  );

  try {
    const { username, email, password } = req.body as { 
      username?: string; 
      email?: string; 
      password?: string; 
    };
    
    requestLogger.info('Tentative d\'inscription', { 
      email: email ? `${email.substring(0, 3)}***` : undefined,
      username,
      hasPassword: !!password
    });
    
    // Vérifier si l'inscription est activée
    if (!configManager.isFeatureEnabled('registration')) {
      requestLogger.warn('Inscription désactivée', { email });
      return res.status(503).json({ 
        success: false, 
        message: 'Les inscriptions sont temporairement désactivées' 
      });
    }

    // Validation basique
    if (!username || !email || !password) {
      requestLogger.warn('Inscription - Champs manquants', { 
        hasUsername: !!username,
        hasEmail: !!email,
        hasPassword: !!password
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis' 
      });
    }

    if (username.length < 3 || username.length > 20) {
      requestLogger.warn('Inscription - Username invalide', { 
        username,
        length: username.length 
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères' 
      });
    }

    if (password.length < 6) {
      requestLogger.warn('Inscription - Mot de passe trop court', { 
        email: `${email.substring(0, 3)}***`,
        passwordLength: password.length
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Le mot de passe doit contenir au moins 6 caractères' 
      });
    }

    // Vérifier si l'utilisateur existe
    const existing = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });
    
    if (existing) {
      const isEmailTaken = existing.email === email.toLowerCase();
      const conflict = isEmailTaken ? 'email' : 'username';
      
      requestLogger.warn('Inscription - Conflit utilisateur', { 
        conflict,
        email: `${email.substring(0, 3)}***`,
        username
      });
      
      return res.status(400).json({
        success: false,
        message: isEmailTaken ? 'Cet email est déjà utilisé' : 'Ce nom d\'utilisateur est déjà pris',
      });
    }

    // Créer l'utilisateur
    const user: any = new User({
      username,
      email: email.toLowerCase(),
      password, // Hash automatique via middleware
    });
    
    await user.save();

    // Mettre à jour les infos de sécurité
    await user.addKnownIP(req.ip || 'unknown');
    await user.addDeviceFingerprint(req.get('User-Agent') || 'unknown');

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Cookie pour refresh token
    res.cookie('rt', refreshToken, getRefreshCookieOptions());

    requestLogger.info('Inscription réussie', { 
      userId: user._id?.toString(),
      username: user.username,
      email: `${email.substring(0, 3)}***`
    });

    return res.status(201).json({ 
      success: true, 
      message: 'Inscription réussie', 
      token: accessToken, 
      user: user.getPublicProfile() 
    });

  } catch (err: any) {
    requestLogger.error('Erreur inscription', { 
      error: (err as Error)?.message,
      stack: configManager.isDebug() ? err.stack : undefined
    });
    
    if (err?.name === 'ValidationError') {
      const errors = Object.values(err.errors || {}).map((e: any) => e.message);
      return res.status(400).json({ 
        success: false, 
        message: 'Données invalides', 
        errors 
      });
    }
    
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'champ';
      return res.status(400).json({ 
        success: false, 
        message: `Ce ${field} est déjà utilisé` 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur' 
    });
  }
});

// POST /api/auth/login - Connexion avec sécurité renforcée
router.post('/login', async (req: Request, res: Response) => {
  const requestLogger = logger.auth.withRequest(
    (req as any).requestId, 
    req.ip, 
    req.get('User-Agent')
  );

  try {
    const { email, password } = req.body as { 
      email?: string; 
      password?: string; 
    };
    
    requestLogger.info('Tentative de connexion', { 
      email: email ? `${email.substring(0, 3)}***` : undefined,
      hasPassword: !!password
    });
    
    // Vérifier si la connexion est activée
    if (!configManager.isFeatureEnabled('login')) {
      requestLogger.warn('Connexion désactivée', { email });
      return res.status(503).json({ 
        success: false, 
        message: 'Les connexions sont temporairement désactivées' 
      });
    }

    if (!email || !password) {
      requestLogger.warn('Connexion - Champs manquants', { 
        hasEmail: !!email,
        hasPassword: !!password
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Email et mot de passe requis' 
      });
    }

    // Trouver l'utilisateur avec le mot de passe
    const user: any = await User.findOne({ 
      email: email.toLowerCase() 
    }).select('+password');
    
    if (!user) {
      requestLogger.warn('Connexion - Utilisateur non trouvé', { 
        email: `${email.substring(0, 3)}***`
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.isAccountLocked) {
      requestLogger.warn('Connexion - Compte verrouillé', { 
        userId: user._id?.toString(),
        email: `${email.substring(0, 3)}***`,
        attempts: user.accountInfo?.failedLoginAttempts || 0
      });
      return res.status(423).json({ 
        success: false, 
        message: 'Compte temporairement verrouillé en raison de tentatives de connexion répétées',
        lockedUntil: user.accountInfo?.accountLockedUntil
      });
    }

    // Vérifier si banni
    if (user.accountInfo?.isBanned) {
      requestLogger.warn('Connexion - Compte banni', {
        userId: user._id?.toString(),
        reason: user.accountInfo.banReason,
        expiresAt: user.accountInfo.banExpires
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Compte banni',
        reason: user.accountInfo.banReason,
        expiresAt: user.accountInfo.banExpires
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Incrémenter les tentatives échouées
      await user.incrementFailedLogins();
      
      requestLogger.warn('Connexion - Mot de passe incorrect', { 
        userId: user._id?.toString(),
        email: `${email.substring(0, 3)}***`,
        attempts: (user.accountInfo?.failedLoginAttempts || 0) + 1
      });
      
      return res.status(400).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    // Réinitialiser les tentatives échouées si succès
    if (user.accountInfo?.failedLoginAttempts > 0) {
      await user.resetFailedLogins();
    }

    // Mettre à jour les infos de connexion et sécurité
    user.accountInfo = user.accountInfo || {};
    user.accountInfo.lastLogin = new Date();
    user.accountInfo.loginCount = (user.accountInfo.loginCount || 0) + 1;
    
    // Ajouter IP et device connus
    await user.addKnownIP(req.ip || 'unknown');
    await user.addDeviceFingerprint(req.get('User-Agent') || 'unknown');
    
    // Mettre à jour le niveau de sécurité
    await user.updateSecurityLevel();
    
    await user.save();

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Cookie pour refresh token
    res.cookie('rt', refreshToken, getRefreshCookieOptions());

    requestLogger.info('Connexion réussie', { 
      userId: user._id?.toString(),
      username: user.username,
      email: `${email.substring(0, 3)}***`,
      loginCount: user.accountInfo.loginCount,
      securityLevel: user.accountInfo.securityLevel
    });

    return res.json({ 
      success: true, 
      message: 'Connexion réussie', 
      token: accessToken, 
      user: user.getPublicProfile() 
    });

  } catch (err: any) {
    requestLogger.error('Erreur connexion', { 
      error: (err as Error)?.message,
      stack: configManager.isDebug() ? err.stack : undefined
    });
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur' 
    });
  }
});

// POST /api/auth/refresh - Refresh token avec logs sécurisés
router.post('/refresh', async (req: Request, res: Response) => {
  const requestLogger = logger.auth.withRequest(
    (req as any).requestId, 
    req.ip, 
    req.get('User-Agent')
  );

  try {
    const token = req.cookies?.rt;
    
    if (!token) {
      requestLogger.warn('Refresh - Token manquant');
      return res.status(401).json({ 
        success: false, 
        message: 'Refresh token manquant' 
      });
    }

    const decoded = verifyRefreshToken(token);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      requestLogger.warn('Refresh - Utilisateur non trouvé', { 
        userId: decoded.id 
      });
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    if (user.accountInfo?.isBanned) {
      requestLogger.warn('Refresh - Compte banni', { 
        userId: user._id?.toString() 
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Compte banni' 
      });
    }

    const accessToken = generateAccessToken(user);

    requestLogger.debug('Token rafraîchi', { 
      userId: user._id?.toString(),
      username: user.username
    });

    return res.json({ 
      success: true, 
      token: accessToken 
    });

  } catch (err) {
    requestLogger.warn('Refresh - Token invalide', { 
      error: (err as Error)?.message 
    });
    return res.status(403).json({ 
      success: false, 
      message: 'Refresh token invalide ou expiré' 
    });
  }
});

// POST /api/auth/logout - Déconnexion avec logs
router.post('/logout', (req: Request, res: Response) => {
  const requestLogger = logger.auth.withRequest(
    (req as any).requestId, 
    req.ip, 
    req.get('User-Agent')
  );

  const userId = (req as any).user?.id;
  
  // Supprimer le cookie refresh token
  res.clearCookie('rt', { ...getRefreshCookieOptions(), maxAge: 0 });
  
  requestLogger.info('Déconnexion', { 
    userId: userId || 'anonymous'
  });
  
  return res.json({ 
    success: true, 
    message: 'Déconnecté avec succès' 
  });
});

// GET /api/auth/me - Profil utilisateur avec logs
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  const requestLogger = logger.auth.withUser(
    req.user!.id, 
    req.ip
  ).withRequest((req as any).requestId);

  try {
    const user: any = await User.findById(req.user!.id);
    
    if (!user) {
      requestLogger.warn('Profil - Utilisateur non trouvé');
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    requestLogger.debug('Profil consulté', { 
      username: user.username 
    });

    return res.json({
      success: true,
      user: {
        ...user.getPublicProfile(),
        email: user.email,
        resources: user.resources,
        cards: user.cards,
        deck: user.deck,
        accountInfo: {
          isEmailVerified: user.accountInfo?.isEmailVerified ?? false,
          lastLogin: user.accountInfo?.lastLogin ?? null,
          loginCount: user.accountInfo?.loginCount ?? 0,
          securityLevel: user.accountInfo?.securityLevel ?? 'BASIC',
          twoFactorEnabled: user.accountInfo?.twoFactorEnabled ?? false,
        },
        // Inclure les infos wallet si connecté
        cryptoWallet: user.cryptoWallet ? {
          address: user.cryptoWallet.address,
          connectedAt: user.cryptoWallet.connectedAt,
          connectionCount: user.cryptoWallet.connectionCount,
          kycStatus: user.cryptoWallet.kycStatus,
        } : null,
      },
    });
  } catch (err) {
    requestLogger.error('Erreur récupération profil', { 
      error: (err as Error)?.message 
    });
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur' 
    });
  }
});

export default router;
