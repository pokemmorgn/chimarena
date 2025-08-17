import { Request, Response, NextFunction } from 'express';
import { jwtVerify, JWTPayload } from 'jose';
import User from '../models/User';

// On étend l'interface Request pour ajouter "user"
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
  } | null;
}

// Vérifier le token JWT
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Token d'accès requis",
      });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET as string);

    const { payload } = await jwtVerify(token, secret);

    const user = await User.findById(payload.id as string);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé',
      });
    }

    if (user.accountInfo?.isBanned) {
      return res.status(403).json({
        success: false,
        message: 'Compte banni',
      });
    }

    req.user = {
      id: payload.id as string,
      username: payload.username as string,
      email: payload.email as string,
    };

    next();
  } catch (error: any) {
    console.error('Erreur authentification:', error);

    if (error.code === 'ERR_JWT_EXPIRED') {
      return res.status(403).json({
        success: false,
        message: 'Token expiré',
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Token invalide',
    });
  }
};

// Auth optionnelle (routes publiques mais peuvent reconnaître un user connecté)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET as string);
    const { payload } = await jwtVerify(token, secret);

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

// Vérifier si admin
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
      });
    }

    const user = await User.findById(req.user.id);

    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Permissions administrateur requises',
      });
    }

    next();
  } catch (error) {
    console.error('Erreur vérification admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur',
    });
  }
};
