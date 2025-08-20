// server/src/routes/authRoutes.ts - VERSION SIMPLIFIÉE CORRIGÉE
import { Router, Request, Response } from 'express';
import User from '../models/User';
import { 
  authenticateToken, 
  AuthenticatedRequest,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from '../middleware/authMiddleware';

const router = Router();

// Cookie options simples
const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
});

// POST /api/auth/register - Inscription avec logs simples
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body as { 
      username?: string; 
      email?: string; 
      password?: string; 
    };
    
    console.log(`[AUTH] Tentative inscription - Email: ${email?.substring(0, 3)}***, Username: ${username}`);

    // Validation basique
    if (!username || !email || !password) {
      console.log(`[AUTH] Inscription échouée - Champs manquants`);
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis' 
      });
    }

    if (username.length < 3 || username.length > 20) {
      console.log(`[AUTH] Inscription échouée - Username invalide: ${username}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères' 
      });
    }

    if (password.length < 6) {
      console.log(`[AUTH] Inscription échouée - Mot de passe trop court`);
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
      
      console.log(`[AUTH] Inscription échouée - Conflit: ${conflict}`);
      
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

    console.log(`[AUTH] Inscription réussie - User: ${user.username}, ID: ${user._id}`);

    return res.status(201).json({ 
      success: true, 
      message: 'Inscription réussie', 
      token: accessToken, 
      user: user.getPublicProfile() 
    });

  } catch (err: any) {
    console.error(`[AUTH] Erreur inscription:`, err.message);
    
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

// POST /api/auth/login - Connexion avec logs simples
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { 
      email?: string; 
      password?: string; 
    };
    
    console.log(`[AUTH] Tentative connexion - Email: ${email?.substring(0, 3)}***`);

    if (!email || !password) {
      console.log(`[AUTH] Connexion échouée - Champs manquants`);
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
      console.log(`[AUTH] Connexion échouée - Utilisateur non trouvé: ${email?.substring(0, 3)}***`);
      return res.status(400).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    // Vérifier si le compte est verrouillé
    if (user.isAccountLocked) {
      console.log(`[AUTH] Connexion échouée - Compte verrouillé: ${user.username}`);
      return res.status(423).json({ 
        success: false, 
        message: 'Compte temporairement verrouillé en raison de tentatives de connexion répétées',
        lockedUntil: user.accountInfo?.accountLockedUntil
      });
    }

    // Vérifier si banni
    if (user.accountInfo?.isBanned) {
      console.log(`[AUTH] Connexion échouée - Compte banni: ${user.username}`);
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
      
      console.log(`[AUTH] Connexion échouée - Mot de passe incorrect: ${user.username}`);
      
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

    console.log(`[AUTH] Connexion réussie - User: ${user.username}, Logins: ${user.accountInfo.loginCount}`);

    return res.json({ 
      success: true, 
      message: 'Connexion réussie', 
      token: accessToken, 
      user: user.getPublicProfile() 
    });

  } catch (err: any) {
    console.error(`[AUTH] Erreur connexion:`, err.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur' 
    });
  }
});

// POST /api/auth/refresh - Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.rt;
    
    if (!token) {
      console.log(`[AUTH] Refresh échoué - Token manquant`);
      return res.status(401).json({ 
        success: false, 
        message: 'Refresh token manquant' 
      });
    }

    const decoded = verifyRefreshToken(token);
    
    const user = await User.findOne({ _id: decoded.id });
    if (!user) {
      console.log(`[AUTH] Refresh échoué - Utilisateur non trouvé: ${decoded.id}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    if (user.accountInfo?.isBanned) {
      console.log(`[AUTH] Refresh échoué - Compte banni: ${user.username}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Compte banni' 
      });
    }

    const accessToken = generateAccessToken(user);

    console.log(`[AUTH] Token rafraîchi - User: ${user.username}`);

    return res.json({ 
      success: true, 
      token: accessToken 
    });

  } catch (err) {
    console.log(`[AUTH] Refresh échoué - Token invalide:`, (err as Error).message);
    return res.status(403).json({ 
      success: false, 
      message: 'Refresh token invalide ou expiré' 
    });
  }
});

// POST /api/auth/logout - Déconnexion
router.post('/logout', (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  
  // Supprimer le cookie refresh token
  res.clearCookie('rt', { ...getRefreshCookieOptions(), maxAge: 0 });
  
  console.log(`[AUTH] Déconnexion - User ID: ${userId || 'anonymous'}`);
  
  return res.json({ 
    success: true, 
    message: 'Déconnecté avec succès' 
  });
});

// GET /api/auth/me - Profil utilisateur
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user: any = await User.findById(req.user!.id);
    
    if (!user) {
      console.log(`[AUTH] Profil non trouvé - User ID: ${req.user!.id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    console.log(`[AUTH] Profil consulté - User: ${user.username}`);

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
    console.error(`[AUTH] Erreur récupération profil:`, (err as Error).message);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur' 
    });
  }
});

export default router;
