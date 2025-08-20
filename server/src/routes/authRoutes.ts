// server/src/routes/authRoutes.ts - VERSION AVEC LOGS COMPLETS
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

// 🔧 LOG SYSTÈME AU DÉMARRAGE
console.log('=== INIT AUTH ROUTES ===');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- JWT_ACCESS_SECRET:', process.env.JWT_ACCESS_SECRET ? `DÉFINI (${process.env.JWT_ACCESS_SECRET.length} chars)` : 'MANQUANT');
console.log('- JWT_REFRESH_SECRET:', process.env.JWT_REFRESH_SECRET ? `DÉFINI (${process.env.JWT_REFRESH_SECRET.length} chars)` : 'MANQUANT');
console.log('- MONGODB_URI:', process.env.MONGODB_URI ? 'DÉFINI' : 'MANQUANT');
console.log('========================');

// Cookie options simples
const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
});

// 🔧 MIDDLEWARE DE LOG GLOBAL POUR TOUTES LES ROUTES AUTH
router.use((req: Request, res: Response, next) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔵 [${timestamp}] AUTH ${req.method} ${req.path}`);
  console.log('🔵 Headers:', JSON.stringify({
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent']?.substring(0, 50) + '...',
    'origin': req.headers['origin'],
    'referer': req.headers['referer']
  }, null, 2));
  console.log('🔵 Body:', JSON.stringify(req.body, (key, value) => {
    // Masquer le mot de passe dans les logs
    if (key === 'password') return '***MASKED***';
    return value;
  }, 2));
  console.log('🔵 IP:', req.ip);
  console.log('🔵 Cookies:', Object.keys(req.cookies || {}));
  
  // Hook sur la réponse pour logger le résultat
  const originalSend = res.send;
  res.send = function(body: any) {
    console.log(`🔵 Response Status: ${res.statusCode}`);
    console.log(`🔵 Response Body:`, typeof body === 'string' ? body.substring(0, 200) + '...' : body);
    return originalSend.call(this, body);
  };
  
  next();
});

// POST /api/auth/register - Inscription avec logs complets
router.post('/register', async (req: Request, res: Response) => {
  console.log('🟢 === DÉBUT REGISTER ===');
  
  try {
    const { username, email, password } = req.body as { 
      username?: string; 
      email?: string; 
      password?: string; 
    };
    
    console.log(`🟢 [REGISTER] Email: ${email?.substring(0, 3)}***, Username: ${username}, Password length: ${password?.length}`);

    // 🔧 Validation basique avec logs détaillés
    if (!username || !email || !password) {
      console.log(`🔴 [REGISTER] ÉCHEC - Champs manquants:`, {
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
      console.log(`🔴 [REGISTER] ÉCHEC - Username invalide: "${username}" (length: ${username.length})`);
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères' 
      });
    }

    if (password.length < 6) {
      console.log(`🔴 [REGISTER] ÉCHEC - Mot de passe trop court (length: ${password.length})`);
      return res.status(400).json({ 
        success: false, 
        message: 'Le mot de passe doit contenir au moins 6 caractères' 
      });
    }

    // 🔧 Vérifier si l'utilisateur existe avec logs détaillés
    console.log(`🟢 [REGISTER] Vérification utilisateur existant...`);
    const existing = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });
    
    if (existing) {
      const isEmailTaken = existing.email === email.toLowerCase();
      const conflict = isEmailTaken ? 'email' : 'username';
      
      console.log(`🔴 [REGISTER] ÉCHEC - Conflit ${conflict}:`, {
        existingEmail: existing.email,
        existingUsername: existing.username,
        requestedEmail: email.toLowerCase(),
        requestedUsername: username
      });
      
      return res.status(400).json({
        success: false,
        message: isEmailTaken ? 'Cet email est déjà utilisé' : 'Ce nom d\'utilisateur est déjà pris',
      });
    }

    console.log(`🟢 [REGISTER] Aucun conflit détecté, création utilisateur...`);

    // 🔧 Créer l'utilisateur avec logs détaillés
    const userData = {
      username,
      email: email.toLowerCase(),
      password, // Hash automatique via middleware
    };
    
    console.log(`🟢 [REGISTER] Données utilisateur:`, {
      username: userData.username,
      email: userData.email,
      passwordLength: userData.password.length
    });
    
    const user: any = new User(userData);
    
    console.log(`🟢 [REGISTER] Sauvegarde utilisateur...`);
    await user.save();
    console.log(`🟢 [REGISTER] Utilisateur sauvegardé avec ID: ${user._id}`);

    // 🔧 Mettre à jour les infos de sécurité avec logs
    console.log(`🟢 [REGISTER] Mise à jour infos sécurité...`);
    await user.addKnownIP(req.ip || 'unknown');
    await user.addDeviceFingerprint(req.get('User-Agent') || 'unknown');
    console.log(`🟢 [REGISTER] Infos sécurité mises à jour`);

    // 🔧 Générer les tokens avec logs
    console.log(`🟢 [REGISTER] Génération tokens...`);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    console.log(`🟢 [REGISTER] Tokens générés - Access: ${accessToken.substring(0, 20)}..., Refresh: ${refreshToken.substring(0, 20)}...`);
    
    // Cookie pour refresh token
    res.cookie('rt', refreshToken, getRefreshCookieOptions());
    console.log(`🟢 [REGISTER] Cookie refresh token défini`);

    console.log(`🟢 [REGISTER] SUCCÈS - User: ${user.username}, ID: ${user._id}`);

    return res.status(201).json({ 
      success: true, 
      message: 'Inscription réussie', 
      token: accessToken, 
      user: user.getPublicProfile() 
    });

  } catch (err: any) {
    console.error(`🔴 [REGISTER] ERREUR COMPLÈTE:`, {
      message: err.message,
      name: err.name,
      code: err.code,
      stack: err.stack?.split('\n').slice(0, 5), // 5 premières lignes de stack
      mongoError: err.code === 11000 ? err.keyPattern : undefined
    });
    
    if (err?.name === 'ValidationError') {
      const errors = Object.values(err.errors || {}).map((e: any) => e.message);
      console.log(`🔴 [REGISTER] Erreurs de validation:`, errors);
      return res.status(400).json({ 
        success: false, 
        message: 'Données invalides', 
        errors 
      });
    }
    
    if (err?.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'champ';
      console.log(`🔴 [REGISTER] Conflit unique:`, { field, keyPattern: err.keyPattern });
      return res.status(400).json({ 
        success: false, 
        message: `Ce ${field} est déjà utilisé` 
      });
    }
    
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      debug: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  } finally {
    console.log('🟢 === FIN REGISTER ===\n');
  }
});

// POST /api/auth/login - Connexion avec logs complets
router.post('/login', async (req: Request, res: Response) => {
  console.log('🔑 === DÉBUT LOGIN ===');
  
  try {
    const { email, password } = req.body as { 
      email?: string; 
      password?: string; 
    };
    
    console.log(`🔑 [LOGIN] Email: ${email?.substring(0, 3)}***, Password length: ${password?.length}`);
    console.log(`🔑 [LOGIN] Request details:`, {
      hasEmail: !!email,
      hasPassword: !!password,
      emailLength: email?.length,
      passwordLength: password?.length,
      bodyKeys: Object.keys(req.body),
      contentType: req.headers['content-type']
    });

    // 🔧 Validation avec logs détaillés
    if (!email || !password) {
      console.log(`🔴 [LOGIN] ÉCHEC - Champs manquants:`, {
        email: !!email,
        password: !!password,
        body: req.body
      });
      return res.status(400).json({ 
        success: false, 
        message: 'Email et mot de passe requis' 
      });
    }

    // 🔧 Recherche utilisateur avec logs détaillés
    console.log(`🔑 [LOGIN] Recherche utilisateur: ${email.toLowerCase()}`);
    const user: any = await User.findOne({ 
      email: email.toLowerCase() 
    }).select('+password');
    
    if (!user) {
      console.log(`🔴 [LOGIN] ÉCHEC - Utilisateur non trouvé pour email: ${email?.substring(0, 3)}***`);
      // Simuler une vérification de mot de passe pour éviter les attaques timing
      const bcrypt = require('bcrypt');
      await bcrypt.compare('dummy', '$2b$12$dummy.hash.to.prevent.timing.attacks');
      
      return res.status(400).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    console.log(`🔑 [LOGIN] Utilisateur trouvé:`, {
      id: user._id,
      username: user.username,
      email: user.email,
      hasPassword: !!user.password,
      isAccountLocked: user.isAccountLocked,
      isBanned: user.accountInfo?.isBanned,
      failedAttempts: user.accountInfo?.failedLoginAttempts
    });

    // 🔧 Vérifier si le compte est verrouillé
    if (user.isAccountLocked) {
      console.log(`🔴 [LOGIN] ÉCHEC - Compte verrouillé:`, {
        username: user.username,
        lockedUntil: user.accountInfo?.accountLockedUntil,
        failedAttempts: user.accountInfo?.failedLoginAttempts
      });
      return res.status(423).json({ 
        success: false, 
        message: 'Compte temporairement verrouillé en raison de tentatives de connexion répétées',
        lockedUntil: user.accountInfo?.accountLockedUntil
      });
    }

    // 🔧 Vérifier si banni
    if (user.accountInfo?.isBanned) {
      console.log(`🔴 [LOGIN] ÉCHEC - Compte banni:`, {
        username: user.username,
        banReason: user.accountInfo.banReason,
        banExpires: user.accountInfo.banExpires
      });
      return res.status(403).json({ 
        success: false, 
        message: 'Compte banni',
        reason: user.accountInfo.banReason,
        expiresAt: user.accountInfo.banExpires
      });
    }

    // 🔧 Vérifier le mot de passe avec logs détaillés
    console.log(`🔑 [LOGIN] Vérification mot de passe...`);
    const startTime = Date.now();
    const isPasswordValid = await user.comparePassword(password);
    const verificationTime = Date.now() - startTime;
    
    console.log(`🔑 [LOGIN] Résultat vérification:`, {
      isValid: isPasswordValid,
      verificationTime: `${verificationTime}ms`,
      hasCompareMethod: typeof user.comparePassword === 'function'
    });
    
    if (!isPasswordValid) {
      console.log(`🔴 [LOGIN] ÉCHEC - Mot de passe incorrect pour: ${user.username}`);
      
      // Incrémenter les tentatives échouées
      await user.incrementFailedLogins();
      console.log(`🔴 [LOGIN] Tentatives échouées incrémentées pour: ${user.username}`);
      
      return res.status(400).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    console.log(`🔑 [LOGIN] Mot de passe valide pour: ${user.username}`);

    // 🔧 Réinitialiser les tentatives échouées si succès
    if (user.accountInfo?.failedLoginAttempts > 0) {
      console.log(`🔑 [LOGIN] Réinitialisation tentatives échouées: ${user.accountInfo.failedLoginAttempts} -> 0`);
      await user.resetFailedLogins();
    }

    // 🔧 Mettre à jour les infos de connexion avec logs
    console.log(`🔑 [LOGIN] Mise à jour infos connexion...`);
    user.accountInfo = user.accountInfo || {};
    const oldLoginCount = user.accountInfo.loginCount || 0;
    user.accountInfo.lastLogin = new Date();
    user.accountInfo.loginCount = oldLoginCount + 1;
    
    console.log(`🔑 [LOGIN] Infos connexion:`, {
      oldLoginCount,
      newLoginCount: user.accountInfo.loginCount,
      lastLogin: user.accountInfo.lastLogin,
      ip: req.ip
    });
    
    // Ajouter IP et device connus
    await user.addKnownIP(req.ip || 'unknown');
    await user.addDeviceFingerprint(req.get('User-Agent') || 'unknown');
    
    // Mettre à jour le niveau de sécurité
    await user.updateSecurityLevel();
    
    console.log(`🔑 [LOGIN] Sauvegarde utilisateur...`);
    await user.save();
    console.log(`🔑 [LOGIN] Utilisateur sauvegardé`);

    // 🔧 Générer les tokens avec logs
    console.log(`🔑 [LOGIN] Génération tokens...`);
    const tokenStartTime = Date.now();
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    const tokenGenerationTime = Date.now() - tokenStartTime;
    
    console.log(`🔑 [LOGIN] Tokens générés:`, {
      generationTime: `${tokenGenerationTime}ms`,
      accessTokenLength: accessToken.length,
      refreshTokenLength: refreshToken.length,
      accessTokenPrefix: accessToken.substring(0, 20),
      refreshTokenPrefix: refreshToken.substring(0, 20)
    });
    
    // Cookie pour refresh token
    const cookieOptions = getRefreshCookieOptions();
    res.cookie('rt', refreshToken, cookieOptions);
    console.log(`🔑 [LOGIN] Cookie refresh token défini:`, {
      httpOnly: cookieOptions.httpOnly,
      secure: cookieOptions.secure,
      sameSite: cookieOptions.sameSite,
      maxAge: cookieOptions.maxAge
    });

    console.log(`🔑 [LOGIN] SUCCÈS - User: ${user.username}, Logins: ${user.accountInfo.loginCount}`);

    const publicProfile = user.getPublicProfile();
    console.log(`🔑 [LOGIN] Profil public généré:`, {
      id: publicProfile.id,
      username: publicProfile.username,
      level: publicProfile.playerStats?.level,
      trophies: publicProfile.playerStats?.trophies
    });

    return res.json({ 
      success: true, 
      message: 'Connexion réussie', 
      token: accessToken, 
      user: publicProfile
    });

  } catch (err: any) {
    console.error(`🔴 [LOGIN] ERREUR COMPLÈTE:`, {
      message: err.message,
      name: err.name,
      code: err.code,
      stack: err.stack?.split('\n').slice(0, 10), // 10 premières lignes de stack
      mongoError: err.name === 'MongoError' ? {
        code: err.code,
        codeName: err.codeName
      } : undefined,
      validationError: err.name === 'ValidationError' ? err.errors : undefined
    });
    
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur',
      debug: process.env.NODE_ENV === 'development' ? {
        error: err.message,
        name: err.name,
        stack: err.stack?.split('\n').slice(0, 3)
      } : undefined
    });
  } finally {
    console.log('🔑 === FIN LOGIN ===\n');
  }
});

// POST /api/auth/refresh - Refresh token avec logs complets
router.post('/refresh', async (req: Request, res: Response) => {
  console.log('🔄 === DÉBUT REFRESH ===');
  
  try {
    const token = req.cookies?.rt;
    
    console.log(`🔄 [REFRESH] Token présent: ${!!token}, Cookies: ${Object.keys(req.cookies || {})}`);
    
    if (!token) {
      console.log(`🔴 [REFRESH] ÉCHEC - Token manquant`);
      return res.status(401).json({ 
        success: false, 
        message: 'Refresh token manquant' 
      });
    }

    console.log(`🔄 [REFRESH] Vérification token: ${token.substring(0, 20)}...`);
    const decoded = verifyRefreshToken(token);
    console.log(`🔄 [REFRESH] Token décodé:`, {
      id: decoded.id,
      iat: decoded.iat,
      exp: decoded.exp,
      timeToExpiry: (decoded.exp * 1000 - Date.now()) / 1000 / 60 // minutes
    });
    
    const user = await User.findOne({ _id: decoded.id });
    if (!user) {
      console.log(`🔴 [REFRESH] ÉCHEC - Utilisateur non trouvé: ${decoded.id}`);
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    console.log(`🔄 [REFRESH] Utilisateur trouvé: ${user.username}`);

    if (user.accountInfo?.isBanned) {
      console.log(`🔴 [REFRESH] ÉCHEC - Compte banni: ${user.username}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Compte banni' 
      });
    }

    const accessToken = generateAccessToken(user);
    console.log(`🔄 [REFRESH] Nouveau token généré: ${accessToken.substring(0, 20)}...`);

    console.log(`🔄 [REFRESH] SUCCÈS - User: ${user.username}`);

    return res.json({ 
      success: true, 
      token: accessToken 
    });

  } catch (err) {
    console.error(`🔴 [REFRESH] ERREUR:`, {
      message: (err as Error).message,
      name: (err as Error).name,
      stack: (err as Error).stack?.split('\n').slice(0, 5)
    });
    return res.status(403).json({ 
      success: false, 
      message: 'Refresh token invalide ou expiré' 
    });
  } finally {
    console.log('🔄 === FIN REFRESH ===\n');
  }
});

// POST /api/auth/logout - Déconnexion avec logs
router.post('/logout', (req: Request, res: Response) => {
  console.log('🚪 === DÉBUT LOGOUT ===');
  
  const userId = (req as any).user?.id;
  
  console.log(`🚪 [LOGOUT] User ID: ${userId || 'anonymous'}`);
  
  // Supprimer le cookie refresh token
  const cookieOptions = { ...getRefreshCookieOptions(), maxAge: 0 };
  res.clearCookie('rt', cookieOptions);
  
  console.log(`🚪 [LOGOUT] Cookie refresh token supprimé`);
  console.log(`🚪 [LOGOUT] SUCCÈS - Déconnexion`);
  
  return res.json({ 
    success: true, 
    message: 'Déconnecté avec succès' 
  });
});

// GET /api/auth/me - Profil utilisateur avec logs
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  console.log('👤 === DÉBUT GET ME ===');
  
  try {
    console.log(`👤 [ME] User ID depuis token: ${req.user?.id}`);
    
    const user: any = await User.findById(req.user!.id);
    
    if (!user) {
      console.log(`🔴 [ME] ÉCHEC - Utilisateur non trouvé: ${req.user!.id}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    console.log(`👤 [ME] Utilisateur trouvé:`, {
      id: user._id,
      username: user.username,
      email: user.email,
      level: user.playerStats?.level,
      trophies: user.playerStats?.trophies
    });

    const publicProfile = user.getPublicProfile();
    const fullProfile = {
      ...publicProfile,
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
      cryptoWallet: user.cryptoWallet ? {
        address: user.cryptoWallet.address,
        connectedAt: user.cryptoWallet.connectedAt,
        connectionCount: user.cryptoWallet.connectionCount,
        kycStatus: user.cryptoWallet.kycStatus,
      } : null,
    };

    console.log(`👤 [ME] SUCCÈS - Profile complet généré pour: ${user.username}`);

    return res.json({
      success: true,
      user: fullProfile
    });
  } catch (err) {
    console.error(`🔴 [ME] ERREUR:`, {
      message: (err as Error).message,
      stack: (err as Error).stack?.split('\n').slice(0, 5)
    });
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur' 
    });
  } finally {
    console.log('👤 === FIN GET ME ===\n');
  }
});

// 🔧 LOG DE FIN D'INITIALISATION
console.log('✅ Auth routes initialisées avec logs complets');

export default router;
