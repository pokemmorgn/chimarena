// server/src/middleware/authMiddleware.ts - VERSION CORRIGÉE
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string; email: string } | null;
}

// ✅ UTILISER LES BONNES VARIABLES D'ENVIRONNEMENT
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || process.env.JWT_ACCESS_SECRET || 'your-secret-key-change-in-production';

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

    // ✅ UTILISER JWT_ACCESS_SECRET
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any;
    
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

    // ✅ UTILISER JWT_ACCESS_SECRET
    const decoded = jwt.verify(token, JWT_ACCESS_SECRET) as any;
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

// ✅ GÉNÉRATION DE TOKENS AVEC LES BONNES VARIABLES
export const generateAccessToken = (user: any): string => {
  return jwt.sign(
    {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
    },
    JWT_ACCESS_SECRET,  // ✅ UTILISER JWT_ACCESS_SECRET
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m' }  // ✅ UTILISER LA BONNE VARIABLE
  );
};

export const generateRefreshToken = (user: any): string => {
  return jwt.sign(
    { id: user._id.toString() },
    JWT_REFRESH_SECRET,  // ✅ UTILISER JWT_REFRESH_SECRET
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }  // ✅ UTILISER LA BONNE VARIABLE
  );
};

// ✅ VÉRIFICATION REFRESH TOKEN AVEC LA BONNE VARIABLE
export const verifyRefreshToken = (token: string): any => {
  return jwt.verify(token, JWT_REFRESH_SECRET);  // ✅ UTILISER JWT_REFRESH_SECRET
};

// ✅ VALIDATION D'UN TOKEN ACCESS (utilitaire)
export const validateAccessToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_ACCESS_SECRET);
  } catch (error) {
    return null;
  }
};

// ✅ EXTRACTION DU TOKEN DEPUIS LES HEADERS
export const extractTokenFromHeader = (authHeader?: string): string | null => {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
};

// ✅ EXTRACTION DU TOKEN DEPUIS LES COOKIES
export const extractTokenFromCookies = (cookies: any): string | null => {
  return cookies?.accessToken || null;
};

// ✅ MIDDLEWARE DE VÉRIFICATION DES RÔLES
export const requireRole = (requiredRole: string) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise'
      });
    }

    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Utilisateur non trouvé'
        });
      }

      // Vérifier le rôle (vous pouvez adapter selon votre modèle)
      const userRole = user.isAdmin ? 'admin' : 'user';
      if (userRole !== requiredRole && requiredRole !== 'user') {
        return res.status(403).json({
          success: false,
          message: 'Permissions insuffisantes'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Erreur de vérification des permissions'
      });
    }
  };
};

// ✅ MIDDLEWARE ADMIN SEULEMENT
export const requireAdmin = requireRole('admin');

// ✅ UTILITAIRE POUR CRÉER UN TOKEN TEMPORAIRE
export const generateTemporaryToken = (payload: any, expiresIn: string = '1h'): string => {
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn });
};

// ✅ UTILITAIRE POUR VÉRIFIER SI UN TOKEN EST EXPIRÉ
export const isTokenExpired = (token: string): boolean => {
  try {
    jwt.verify(token, JWT_ACCESS_SECRET);
    return false;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return true;
    }
    return false; // Autre erreur (token invalide, etc.)
  }
};

// ✅ UTILITAIRE POUR DÉCODER UN TOKEN SANS LE VÉRIFIER
export const decodeTokenPayload = (token: string): any => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

// ✅ MIDDLEWARE POUR RAFRAÎCHIR AUTOMATIQUEMENT LES TOKENS
export const autoRefreshToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const accessToken = extractTokenFromHeader(req.headers.authorization);
  const refreshToken = req.cookies?.rt;

  if (!accessToken && !refreshToken) {
    return next(); // Pas de tokens, continuer (sera géré par authenticateToken si nécessaire)
  }

  // Si access token valide, continuer
  if (accessToken && !isTokenExpired(accessToken)) {
    return next();
  }

  // Si access token expiré mais refresh token présent, essayer de rafraîchir
  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const user = await User.findById(decoded.id);
      
      if (user && !user.accountInfo?.isBanned) {
        const newAccessToken = generateAccessToken(user);
        res.setHeader('X-New-Access-Token', newAccessToken);
        
        // Optionnel : mettre à jour l'authorization header pour la suite du traitement
        req.headers.authorization = `Bearer ${newAccessToken}`;
      }
    } catch (error) {
      // Refresh token invalide, continuer sans token
    }
  }

  next();
};

// ✅ CONFIGURATION DES OPTIONS DE COOKIES POUR LES TOKENS
export const getRefreshTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
});

export const getAccessTokenCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 15 * 60 * 1000 // 15 minutes
});

// ✅ UTILITAIRE POUR NETTOYER TOUS LES TOKENS
export const clearAuthTokens = (res: Response): void => {
  res.clearCookie('rt', getRefreshTokenCookieOptions());
  res.clearCookie('accessToken', getAccessTokenCookieOptions());
};

// ✅ MIDDLEWARE DE LOGGING DES TENTATIVES D'AUTHENTIFICATION
export const logAuthAttempt = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(body: any) {
    // Logger les tentatives d'auth (succès/échec)
    if (req.path.includes('/auth/')) {
      const success = res.statusCode < 400;
      console.log(`🔐 Auth attempt: ${req.method} ${req.path} - ${success ? 'SUCCESS' : 'FAILED'} (${res.statusCode}) - IP: ${req.ip}`);
    }
    
    return originalSend.call(this, body);
  };
  
  next();
};

export default {
  authenticateToken,
  optionalAuth,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  validateAccessToken,
  extractTokenFromHeader,
  extractTokenFromCookies,
  requireRole,
  requireAdmin,
  generateTemporaryToken,
  isTokenExpired,
  decodeTokenPayload,
  autoRefreshToken,
  getRefreshTokenCookieOptions,
  getAccessTokenCookieOptions,
  clearAuthTokens,
  logAuthAttempt
};
