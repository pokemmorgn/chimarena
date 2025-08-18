// server/src/routes/authRoutes.ts
import { Router, Request, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import User from '../models/User';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';

// 🔐 NOUVEAUX IMPORTS SÉCURITÉ
import { securityManager } from '../config/security';
import { auditLogger } from '../utils/auditLogger';

const router = Router();

// Helpers enc/vars avec nouveaux secrets crypto-grade
const enc = (s: string) => new TextEncoder().encode(s);

const ACCESS_SECRET  = enc(securityManager.getConfig().jwt.accessSecret);
const REFRESH_SECRET = enc(securityManager.getConfig().jwt.refreshSecret);

const ACCESS_EXP   = securityManager.getConfig().jwt.accessExpiry;
const REFRESH_EXP  = securityManager.getConfig().jwt.refreshExpiry;

// Cookie httpOnly pour refresh avec sécurité renforcée
const refreshCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // HTTPS en prod uniquement
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7j
};

// Générateurs de tokens (inchangés mais avec nouveaux secrets)
const generateAccessToken = async (user: any): Promise<string> => {
  return await new SignJWT({
    id: user._id.toString(),
    username: user.username,
    email: user.email,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXP)
    .sign(ACCESS_SECRET);
};

const generateRefreshToken = async (user: any): Promise<string> => {
  return await new SignJWT({ id: user._id.toString() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXP)
    .sign(REFRESH_SECRET);
};

// 📝 HELPER POUR L'AUDIT
const getRequestInfo = (req: Request) => ({
  ip: req.ip || 'unknown',
  userAgent: req.headers['user-agent'] || '',
sessionId: (req as any).sessionID || securityManager.generateSecureToken(16),
});

// --- REGISTER avec audit complet ---
router.post('/register', async (req: Request, res: Response) => {
  const requestInfo = getRequestInfo(req);
  
  try {
    const { username, email, password } = req.body as { username?: string; email?: string; password?: string };
    
    if (!username || !email || !password) {
      await auditLogger.logEvent(
        'AUTH_REGISTER',
        'Tentative d\'inscription avec champs manquants',
        {
          ...requestInfo,
          success: false,
          details: { missingFields: { username: !username, email: !email, password: !password } },
          severity: 'LOW',
        }
      );
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    }

    // Validation mot de passe fort
    const passwordValidation = securityManager.isStrongPassword(password);
    if (!passwordValidation.isValid) {
      await auditLogger.logEvent(
        'AUTH_REGISTER',
        'Tentative d\'inscription avec mot de passe faible',
        {
          ...requestInfo,
          success: false,
          details: { reason: passwordValidation.message },
          severity: 'LOW',
        }
      );
      return res.status(400).json({ success: false, message: passwordValidation.message });
    }

    if (username.length < 3 || username.length > 20) {
      await auditLogger.logEvent(
        'AUTH_REGISTER',
        'Tentative d\'inscription avec nom d\'utilisateur invalide',
        {
          ...requestInfo,
          success: false,
          details: { username, usernameLength: username.length },
          severity: 'LOW',
        }
      );
      return res.status(400).json({ success: false, message: 'Nom d\'utilisateur invalide' });
    }

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existing) {
      const isEmailTaken = existing.email === email.toLowerCase();
      
      await auditLogger.logEvent(
        'AUTH_REGISTER',
        'Tentative d\'inscription avec email/username déjà utilisé',
        {
          ...requestInfo,
          success: false,
          details: { 
            email: email.toLowerCase(), 
            username, 
            conflictType: isEmailTaken ? 'email' : 'username' 
          },
          severity: 'MEDIUM',
        }
      );

      return res.status(400).json({
        success: false,
        message: isEmailTaken ? 'Cet email est déjà utilisé' : 'Ce nom d\'utilisateur est déjà pris',
      });
    }

    const user: any = new User({
      username,
      email: email.toLowerCase(),
      password,
    });
    await user.save();

    const accessToken  = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.cookie('rt', refreshToken, refreshCookieOpts);

    // 📊 LOG SUCCÈS
    await auditLogger.logEvent(
      'AUTH_REGISTER',
      'Inscription réussie',
      {
        ...requestInfo,
userId: (user._id as any).toString(),
        username: user.username,
        success: true,
        details: { email: user.email },
        severity: 'LOW',
      }
    );

    return res.status(201).json({ 
      success: true, 
      message: 'Inscription réussie', 
      token: accessToken, 
      user: user.getPublicProfile() 
    });

  } catch (err: any) {
    // 🚨 LOG ERREUR
    await auditLogger.logEvent(
      'SYSTEM_ERROR',
      'Erreur lors de l\'inscription',
      {
        ...requestInfo,
        success: false,
        error: err.message,
        details: { 
          errorName: err.name,
          stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
        },
        severity: 'HIGH',
      }
    );

    if (err?.name === 'ValidationError') {
      const errors = Object.values(err.errors || {}).map((e: any) => e.message);
      return res.status(400).json({ success: false, message: 'Données invalides', errors });
    }
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'champ';
      return res.status(400).json({ success: false, message: `Ce ${field} est déjà utilisé` });
    }
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// --- LOGIN avec audit et détection d'attaques ---
router.post('/login', async (req: Request, res: Response) => {
  const requestInfo = getRequestInfo(req);
  
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    
    if (!email || !password) {
      await auditLogger.logEvent(
        'AUTH_LOGIN_FAILED',
        'Tentative de connexion avec champs manquants',
        {
          ...requestInfo,
          success: false,
          details: { email: email || 'manquant', passwordProvided: !!password },
          severity: 'MEDIUM',
        }
      );
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }

    const user: any = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      await auditLogger.logEvent(
        'AUTH_LOGIN_FAILED',
        'Tentative de connexion avec email inexistant',
        {
          ...requestInfo,
          success: false,
          details: { email: email.toLowerCase() },
          severity: 'MEDIUM',
        }
      );
      return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    if (user.accountInfo?.isBanned) {
      await auditLogger.logEvent(
        'AUTH_LOGIN_FAILED',
        'Tentative de connexion d\'un compte banni',
        {
          ...requestInfo,
          userId: user._id.toString(),
          username: user.username,
          success: false,
          details: { 
            email: user.email, 
            banReason: user.accountInfo.banReason,
            banExpires: user.accountInfo.banExpires 
          },
          severity: 'HIGH',
        }
      );
      return res.status(403).json({ 
        success: false, 
        message: 'Compte banni', 
        reason: user.accountInfo.banReason 
      });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      await auditLogger.logEvent(
        'AUTH_LOGIN_FAILED',
        'Tentative de connexion avec mot de passe incorrect',
        {
          ...requestInfo,
          userId: user._id.toString(),
          username: user.username,
          success: false,
          details: { email: user.email },
          severity: 'HIGH',
        }
      );
      return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    // Mise à jour des infos de connexion
    user.accountInfo = user.accountInfo || {};
    user.accountInfo.lastLogin = new Date();
    user.accountInfo.loginCount = (user.accountInfo.loginCount || 0) + 1;
    await user.save();

    const accessToken  = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.cookie('rt', refreshToken, refreshCookieOpts);

    // 📊 LOG SUCCÈS
    await auditLogger.logEvent(
      'AUTH_LOGIN_SUCCESS',
      'Connexion réussie',
      {
        ...requestInfo,
        userId: user._id.toString(),
        username: user.username,
        success: true,
        details: { 
          email: user.email, 
          loginCount: user.accountInfo.loginCount,
          lastLogin: user.accountInfo.lastLogin 
        },
        severity: 'LOW',
      }
    );

    return res.json({ 
      success: true, 
      message: 'Connexion réussie', 
      token: accessToken, 
      user: user.getPublicProfile() 
    });

  } catch (err: any) {
    await auditLogger.logEvent(
      'SYSTEM_ERROR',
      'Erreur lors de la connexion',
      {
        ...requestInfo,
        success: false,
        error: err.message,
        severity: 'HIGH',
      }
    );
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// --- REFRESH avec audit ---
router.post('/refresh', async (req: Request, res: Response) => {
  const requestInfo = getRequestInfo(req);
  
  try {
    const token = req.cookies?.rt;
    if (!token) {
      await auditLogger.logEvent(
        'AUTH_TOKEN_REFRESH',
        'Tentative de refresh sans token',
        {
          ...requestInfo,
          success: false,
          severity: 'MEDIUM',
        }
      );
      return res.status(401).json({ success: false, message: 'Refresh token manquant' });
    }

    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    const user = await User.findById(payload.id as string);
    if (!user) {
      await auditLogger.logEvent(
        'AUTH_TOKEN_REFRESH',
        'Tentative de refresh avec utilisateur inexistant',
        {
          ...requestInfo,
          success: false,
          details: { userId: payload.id },
          severity: 'HIGH',
        }
      );
      return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    const accessToken = await generateAccessToken(user);

    // 📊 LOG SUCCÈS (niveau low car fréquent)
    await auditLogger.logEvent(
      'AUTH_TOKEN_REFRESH',
      'Refresh token réussi',
      {
        ...requestInfo,
        userId: user._id.toString(),
        username: user.username,
        success: true,
        severity: 'LOW',
      }
    );

    return res.json({ success: true, token: accessToken });

  } catch (err) {
    await auditLogger.logEvent(
      'AUTH_TOKEN_REFRESH',
      'Tentative de refresh avec token invalide/expiré',
      {
        ...requestInfo,
        success: false,
        error: 'Token invalide ou expiré',
        severity: 'MEDIUM',
      }
    );
    return res.status(403).json({ success: false, message: 'Refresh invalide ou expiré' });
  }
});

// --- LOGOUT avec audit ---
router.post('/logout', (req: Request, res: Response) => {
  const requestInfo = getRequestInfo(req);
  
  // Pas besoin d'authentification pour logout
  auditLogger.logEvent(
    'AUTH_LOGOUT',
    'Déconnexion',
    {
      ...requestInfo,
      success: true,
      severity: 'LOW',
    }
  );

  res.clearCookie('rt', { ...refreshCookieOpts, maxAge: 0 });
  return res.json({ success: true, message: 'Déconnecté' });
});

// --- ME avec audit minimal ---
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user: any = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Pas d'audit pour /me car très fréquent (sauf en dev)
    if (process.env.NODE_ENV === 'development') {
      auditLogger.logEvent(
        'AUTH_LOGIN_SUCCESS',
        'Consultation profil utilisateur',
        {
          ip: req.ip || 'unknown',
          userId: user._id.toString(),
          username: user.username,
          success: true,
          severity: 'LOW',
        }
      );
    }

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
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

export default router;
