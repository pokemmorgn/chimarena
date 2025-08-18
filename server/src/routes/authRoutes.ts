// server/src/routes/authSimple.ts - ROUTES AUTH SIMPLIFIÉES
import { Router, Request, Response } from 'express';
import User from '../models/User';
import { 
  authenticateToken, 
  AuthenticatedRequest,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken
} from '../middleware/authSimple';

const router = Router();

// Cookie options pour refresh token
const refreshCookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
};

// POST /api/auth/register - Inscription
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body as { 
      username?: string; 
      email?: string; 
      password?: string; 
    };
    
    // Validation basique
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tous les champs sont requis' 
      });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ 
        success: false, 
        message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères' 
      });
    }

    if (password.length < 6) {
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

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Cookie pour refresh token
    res.cookie('rt', refreshToken, refreshCookieOpts);

    console.log(`✅ Nouvel utilisateur inscrit: ${username} (${email})`);

    return res.status(201).json({ 
      success: true, 
      message: 'Inscription réussie', 
      token: accessToken, 
      user: user.getPublicProfile() 
    });

  } catch (err: any) {
    console.error('❌ Erreur inscription:', err);
    
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

// POST /api/auth/login - Connexion
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { 
      email?: string; 
      password?: string; 
    };
    
    if (!email || !password) {
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
      return res.status(400).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    // Vérifier si banni
    if (user.accountInfo?.isBanned) {
      return res.status(403).json({ 
        success: false, 
        message: 'Compte banni',
        reason: user.accountInfo.banReason 
      });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    // Mettre à jour les infos de connexion
    user.accountInfo = user.accountInfo || {};
    user.accountInfo.lastLogin = new Date();
    user.accountInfo.loginCount = (user.accountInfo.loginCount || 0) + 1;
    await user.save();

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    
    // Cookie pour refresh token
    res.cookie('rt', refreshToken, refreshCookieOpts);

    console.log(`✅ Connexion réussie: ${user.username} (${user.email})`);

    return res.json({ 
      success: true, 
      message: 'Connexion réussie', 
      token: accessToken, 
      user: user.getPublicProfile() 
    });

  } catch (err: any) {
    console.error('❌ Erreur connexion:', err);
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
      return res.status(401).json({ 
        success: false, 
        message: 'Refresh token manquant' 
      });
    }

    const decoded = verifyRefreshToken(token);
    
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    if (user.accountInfo?.isBanned) {
      return res.status(403).json({ 
        success: false, 
        message: 'Compte banni' 
      });
    }

    const accessToken = generateAccessToken(user);

    return res.json({ 
      success: true, 
      token: accessToken 
    });

  } catch (err) {
    return res.status(403).json({ 
      success: false, 
      message: 'Refresh token invalide ou expiré' 
    });
  }
});

// POST /api/auth/logout - Déconnexion
router.post('/logout', (req: Request, res: Response) => {
  // Supprimer le cookie refresh token
  res.clearCookie('rt', { ...refreshCookieOpts, maxAge: 0 });
  
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
      return res.status(404).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
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
        // Inclure les infos wallet si connecté
        cryptoWallet: user.cryptoWallet ? {
          address: user.cryptoWallet.address,
          connectedAt: user.cryptoWallet.connectedAt,
          connectionCount: user.cryptoWallet.connectionCount,
        } : null,
      },
    });
  } catch (err) {
    console.error('❌ Erreur récupération profil:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne du serveur' 
    });
  }
});

export default router;
