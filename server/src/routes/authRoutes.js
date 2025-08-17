import { Router, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User from '../models/User';
import { authenticateToken } from '../middlewares/auth';
import { AuthenticatedRequest } from '../middlewares/auth';

const router = Router();

type StarterCard = { cardId: string; level: number; count: number };

const generateToken = (user: any): string => {
  const secret = process.env.JWT_SECRET as string;
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: user._id?.toString?.() ?? user.id,
      username: user.username,
      email: user.email
    },
    secret,
    { expiresIn }
  );
};

const getStarterCards = (): StarterCard[] => ([
  { cardId: 'knight',    level: 1, count: 10 },
  { cardId: 'archers',   level: 1, count: 10 },
  { cardId: 'giant',     level: 1, count: 5  },
  { cardId: 'fireball',  level: 1, count: 5  },
  { cardId: 'arrows',    level: 1, count: 10 },
  { cardId: 'barbarians',level: 1, count: 8  },
  { cardId: 'minions',   level: 1, count: 10 },
  { cardId: 'cannon',    level: 1, count: 5  }
]);

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body as {
      username?: string; email?: string; password?: string;
    };

    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
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

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }]
    });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email.toLowerCase()
          ? 'Cet email est déjà utilisé'
          : 'Ce nom d\'utilisateur est déjà pris'
      });
    }

    const newUser: any = new User({
      username,
      email: email.toLowerCase(),
      password,
      cards: getStarterCards(),
      deck: ['knight','archers','giant','fireball','arrows','barbarians','minions','cannon']
    });

    await newUser.save();

    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      token,
      user: newUser.getPublicProfile()
    });
  } catch (error: any) {
    console.error('Erreur inscription:', error);

    if (error?.name === 'ValidationError') {
      const errors = Object.values(error.errors || {}).map((e: any) => e.message);
      return res.status(400).json({ success: false, message: 'Données invalides', errors });
    }
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'champ';
      return res.status(400).json({ success: false, message: `Ce ${field} est déjà utilisé` });
    }
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email et mot de passe requis' });
    }

    const user: any = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    if (user.accountInfo?.isBanned) {
      const banMessage =
        user.accountInfo.banExpires && user.accountInfo.banExpires > new Date()
          ? `Compte banni jusqu'au ${new Date(user.accountInfo.banExpires).toLocaleDateString()}`
          : 'Compte banni définitivement';

      return res.status(403).json({
        success: false,
        message: banMessage,
        reason: user.accountInfo.banReason
      });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(400).json({ success: false, message: 'Email ou mot de passe incorrect' });
    }

    user.accountInfo = user.accountInfo || {};
    user.accountInfo.lastLogin = new Date();
    user.accountInfo.loginCount = (user.accountInfo.loginCount || 0) + 1;
    await user.save();

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Connexion réussie',
      token,
      user: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Erreur connexion:', error);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
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
          loginCount: user.accountInfo?.loginCount ?? 0
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération profil:', error);
    return res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

export default router;
