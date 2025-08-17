import { Router, Request, Response } from 'express';
import { SignJWT, jwtVerify } from 'jose';
import User from '../models/User';
import { authenticateToken, AuthenticatedRequest } from '../middleware/authMiddleware';

const router = Router();

// Helpers enc/vars
const enc = (s: string) => new TextEncoder().encode(s);

const ACCESS_SECRET  = enc(process.env.JWT_ACCESS_SECRET  as string || process.env.JWT_SECRET as string); // fallback si ancien nom
const REFRESH_SECRET = enc(process.env.JWT_REFRESH_SECRET as string || process.env.REFRESH_TOKEN_SECRET as string);

const ACCESS_EXP   = process.env.JWT_ACCESS_EXPIRES_IN   || process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_EXP  = process.env.JWT_REFRESH_EXPIRES_IN  || process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Cookie httpOnly pour refresh
const refreshCookieOpts = {
  httpOnly: true,
  secure: true,           // nécessite HTTPS en prod
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7j (si tu modifies REFRESH_EXP, ajuste si besoin)
};

// Générateurs de tokens
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
  // payload minimal pour limiter l’exposition
  return await new SignJWT({ id: user._id.toString() })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXP)
    .sign(REFRESH_SECRET);
};

// --- REGISTER ---
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body as { username?: string; email?: string; password?: string };
    if (!username || !email || !password) return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ success: false, message: 'Nom d’utilisateur invalide' });
    if (password.length < 6) return res.status(400).json({ success: false, message: 'Mot de passe trop court' });

    const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: existing.email === email.toLowerCase() ? 'Cet email est déjà utilisé' : 'Ce nom d’utilisateur est déjà pris',
      });
    }

    const user: any = new User({
      username,
      email: email.toLowerCase(),
      password,
      // cards/deck starter si tu en as besoin
    });
    await user.save();

    const accessToken  = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.cookie('rt', refreshToken, refreshCookieOpts);

    return res.status(201).json({ success: true, message: 'Inscription réussie', token: accessToken, user: user.getPublicProfile() });
  } catch (err: any) {
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

// --- LOGIN ---
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });

    const user: any = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect' });

    if (user.accountInfo?.isBanned) {
      return res.status(403).json({ success: false, message: 'Compte banni', reason: user.accountInfo.banReason });
    }

    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect' });

    user.accountInfo = user.accountInfo || {};
    user.accountInfo.lastLogin = new Date();
    user.accountInfo.loginCount = (user.accountInfo.loginCount || 0) + 1;
    await user.save();

    const accessToken  = await generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);
    res.cookie('rt', refreshToken, refreshCookieOpts);

    return res.json({ success: true, message: 'Connexion réussie', token: accessToken, user: user.getPublicProfile() });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// --- REFRESH (renvoie un nouveau Access Token à partir du cookie httpOnly "rt") ---
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.rt;
    if (!token) return res.status(401).json({ success: false, message: 'Refresh token manquant' });

    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    const user = await User.findById(payload.id as string);
    if (!user) return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });

    const accessToken = await generateAccessToken(user);
    return res.json({ success: true, token: accessToken });
  } catch {
    return res.status(403).json({ success: false, message: 'Refresh invalide ou expiré' });
  }
});

// --- LOGOUT (supprime le cookie "rt") ---
router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('rt', { ...refreshCookieOpts, maxAge: 0 });
  return res.json({ success: true, message: 'Déconnecté' });
});

// --- ME ---
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user: any = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });

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
  } catch {
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

export default router;
