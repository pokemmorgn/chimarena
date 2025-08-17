import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
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
        message: 'Token d\'accès requis'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

    // Vérifier que l’utilisateur existe encore
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

    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email
    };

    next();
  } catch (error: any) {
    console.error('Erreur authentification:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Token invalide'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token expiré'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
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

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    const user = await User.findById(decoded.id);

    if (user && !user.accountInfo?.isBanned) {
      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email
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
        message: 'Authentification requise'
      });
    }

    const user = await User.findById(req.user.id);

    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Permissions administrateur requises'
      });
    }

    next();
  } catch (error) {
    console.error('Erreur vérification admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur interne du serveur'
    });
  }
};
