import { Request, Response, NextFunction } from 'express';
import { jwtVerify } from 'jose';
import User from '../models/User';

// Étend la Request pour ajouter user
export interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string; email: string } | null;
}

// Prépare la clé pour vérifier l'ACCESS token
const enc = (s: string) => new TextEncoder().encode(s);
const ACCESS_SECRET = enc(
  (process.env.JWT_ACCESS_SECRET as string)  // nouveau modèle
  || (process.env.JWT_SECRET as string)      // fallback si ancien .env
);

// Auth obligatoire
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';

    if (!token) {
      return res.status(401).json({ success: false, message: "Token d'accès requis" });
    }

    const { payload } = await jwtVerify(token, ACCESS_SECRET);

    const user = await User.findById(payload.id as string);
    if (!user) return res.status(401).json({ success: false, message: 'Utilisateur non trouvé' });
    if (user.accountInfo?.isBanned) return res.status(403).json({ success: false, message: 'Compte banni' });

    req.user = {
      id: payload.id as string,
      username: payload.username as string,
      email: payload.email as string,
    };

    next();
  } catch (e: any) {
    if (e.code === 'ERR_JWT_EXPIRED') {
      return res.status(403).json({ success: false, message: 'Token expiré' });
    }
    return res.status(403).json({ success: false, message: 'Token invalide' });
  }
};

// Auth optionnelle
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) { req.user = null; return next(); }

    const { payload } = await jwtVerify(token, ACCESS_SECRET);

    const user = await User.findById(payload.id as string);
    if (user && !user.accountInfo?.isBanned) {
      req.user = {
        id: payload.id as string,
        username: payload.username as string,
        email: payload.email as string,
      };
    } else {
      req.user = null;
    }
    next();
  } catch {
    req.user = null;
    next();
  }
};

// Vérifier admin (nécessite un champ isAdmin dans le modèle User)
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Authentification requise' });

    const user = await User.findById(req.user.id);
    if (!user || !(user as any).isAdmin) {
      return res.status(403).json({ success: false, message: 'Permissions administrateur requises' });
    }

    next();
  } catch (error) {
    console.error('Erreur vérification admin:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};
