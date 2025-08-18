// server/src/middleware/authSimple.ts - AUTHENTIFICATION SIMPLIFIÉE
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string; email: string } | null;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Auth obligatoire (simplifié)
export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Token d'accès requis" 
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Vérifier que l'utilisateur existe toujours
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur non trouvé' 
      });
    }

    // Vérifier si l'utilisateur est banni
    if (user.accountInfo?.isBanned) {
      return res.status(403).json({ 
        success: false, 
        message: 'Compte banni' 
      });
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
      email: decoded.email,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(403).json({ 
        success: false, 
        message: 'Token expiré' 
      });
    }
    
    return res.status(403).json({ 
      success: false, 
      message: 'Token invalide' 
    });
  }
};

// Auth optionnelle
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await User.findById(decoded.id);
    
    if (user && !user.accountInfo?.isBanned) {
      req.user = {
        id: decoded.id,
        username: decoded.username,
        email: decoded.email,
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

// Génération de tokens simplifiée
export const generateAccessToken = (user: any): string => {
  return jwt.sign(
    {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: '15m' } // 15 minutes
  );
};

export const generateRefreshToken = (user: any): string => {
  return jwt.sign(
    { id: user._id.toString() },
    JWT_SECRET,
    { expiresIn: '7d' } // 7 jours
  );
};

// Vérification refresh token
export const verifyRefreshToken = (token: string): any => {
  return jwt.verify(token, JWT_SECRET);
};
