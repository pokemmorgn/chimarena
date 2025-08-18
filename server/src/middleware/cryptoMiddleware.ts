// server/src/middleware/cryptoMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { ethersHelper } from '../utils/ethersHelper';
import User from '../models/User';

interface CryptoRequest extends Request {
  cryptoValidation?: {
    isValid: boolean;
    address: string;
    message: string;
    signature: string;
    timestamp: number;
  };
}

interface SignatureValidationOptions {
  requireTimestamp?: boolean;
  maxAge?: number; // ms
}

export const validateCryptoSignature = (options: SignatureValidationOptions = {}) => {
  return async (req: CryptoRequest, res: Response, next: NextFunction) => {
    try {
      const { address, message, signature, timestamp } = req.body;

      if (!address || !message || !signature) {
        return res.status(400).json({
          error: 'Paramètres de signature requis manquants',
          code: 'MISSING_SIGNATURE_PARAMS',
          details: { required: ['address', 'message', 'signature'], provided: Object.keys(req.body) }
        });
      }

      if (!ethersHelper.isValidAddress(address)) {
        return res.status(400).json({ error: 'Adresse Ethereum invalide', code: 'INVALID_ETHEREUM_ADDRESS' });
      }

      if (timestamp && options.requireTimestamp) {
        const now = Date.now();
        const maxAge = options.maxAge || 5 * 60 * 1000;
        if (Math.abs(now - timestamp) > maxAge) {
          return res.status(400).json({ error: 'Signature expirée', code: 'SIGNATURE_EXPIRED' });
        }
      }

      const isValidSignature = await ethersHelper.verifySignature(address, message, signature);
      if (!isValidSignature) {
        return res.status(403).json({ error: 'Signature cryptographique invalide', code: 'INVALID_SIGNATURE' });
      }

      req.cryptoValidation = {
        isValid: true,
        address,
        message,
        signature,
        timestamp: timestamp || Date.now(),
      };

      next();
    } catch (error) {
      console.error('❌ Erreur validation crypto:', error);
      res.status(500).json({ error: 'Erreur de validation cryptographique', code: 'CRYPTO_VALIDATION_ERROR' });
    }
  };
};

// 🛡️ Vérification que le wallet appartient à l’utilisateur authentifié
export const verifyWalletOwnership = async (req: CryptoRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.cryptoValidation?.isValid) {
      return res.status(400).json({ error: 'Validation crypto requise', code: 'CRYPTO_VALIDATION_REQUIRED' });
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentification requise', code: 'AUTH_REQUIRED' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur non trouvé', code: 'USER_NOT_FOUND' });
    }

    const userWalletAddress = user.cryptoWallet?.address as unknown as string | undefined;
    if (userWalletAddress && userWalletAddress.toLowerCase() !== req.cryptoValidation.address.toLowerCase()) {
      return res.status(403).json({
        error: 'Adresse wallet non autorisée pour cet utilisateur',
        code: 'WALLET_NOT_AUTHORIZED'
      });
    }

    (req as any).walletUser = user;
    next();
  } catch (error) {
    console.error('❌ Erreur vérification wallet ownership:', error);
    res.status(500).json({ error: 'Erreur de vérification wallet', code: 'WALLET_VERIFICATION_ERROR' });
  }
};

// 🚫 Rate limiting simple en mémoire
export const cryptoRateLimit = (action: 'connect' | 'disconnect' | 'transaction' | 'withdrawal') => {
  const limits = {
    connect: { window: 60 * 60 * 1000, max: 3 },
    disconnect: { window: 60 * 60 * 1000, max: 10 },
    transaction: { window: 60 * 60 * 1000, max: 5 },
    withdrawal: { window: 24 * 60 * 60 * 1000, max: 5 },
  } as const;

  const limit = limits[action];
  const attempts: Map<string, { count: number; firstAttempt: number }> = new Map();

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${action}-${req.ip}-${(req as any).user?.id || 'anonymous'}`;
    const now = Date.now();
    const attempt = attempts.get(key);

    if (!attempt) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    if (now - attempt.firstAttempt > limit.window) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    if (attempt.count >= limit.max) {
      return res.status(429).json({
        error: `Trop de tentatives ${action}`,
        code: 'CRYPTO_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((attempt.firstAttempt + limit.window - now) / 1000),
      });
    }

    attempt.count++;
    next();
  };
};

// 🔍 Détection simple d’activité suspecte (non bloquante sauf cas cumulatifs)
export const detectSuspiciousCryptoActivity = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return next();

    const user = await User.findById(userId);
    if (!user) return next();

    const indicators: string[] = [];

    const createdAt = (user as any).createdAt ? new Date((user as any).createdAt).getTime() : 0;
    const accountAge = Date.now() - createdAt;
    if (createdAt && accountAge < 24 * 60 * 60 * 1000) indicators.push('account_too_new');

    if ((user as any).accountInfo?.suspiciousActivityScore > 50) indicators.push('high_suspicion_score');

    const lastKnownIPs: string[] = (user as any).accountInfo?.lastKnownIPs || [];
    const currentIP = req.ip || '';
    if (lastKnownIPs.length > 0 && currentIP && !lastKnownIPs.includes(currentIP)) indicators.push('unknown_ip');

    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) indicators.push('unusual_hours');

    // Ici, on ne log plus ; on pourrait poser un header signalétique si besoin
    if (indicators.length >= 3) {
      return ( _res as Response ).status(403).json({
        error: 'Activité suspecte détectée',
        code: 'SUSPICIOUS_CRYPTO_ACTIVITY',
        message: 'Veuillez contacter le support pour vérification'
      });
    }

    next();
  } catch (error) {
    console.error('❌ Erreur détection activité suspecte:', error);
    next();
  }
};

// 📊 Logging retiré (plus d’auditLogger). On garde un wrapper neutre no-op pour compat.
export const logCryptoActivity = (_action: string) => {
  return async (_req: Request, _res: Response, next: NextFunction) => next();
};

// 🎯 Chaînage prêt pour actions critiques (avec validation signature + ownership)
export const secureCryptoAction = (action: 'connect' | 'disconnect' | 'transaction' | 'withdrawal') => {
  const middlewares = [
    cryptoRateLimit(action),
    detectSuspiciousCryptoActivity,
    logCryptoActivity(action),
  ];

  if (['transaction', 'withdrawal'].includes(action)) {
    middlewares.unshift(
      validateCryptoSignature({ requireTimestamp: true, maxAge: 5 * 60 * 1000 })
    );
    middlewares.splice(1, 0, verifyWalletOwnership);
  }

  return middlewares;
};

export default {
  validateCryptoSignature,
  verifyWalletOwnership,
  cryptoRateLimit,
  detectSuspiciousCryptoActivity,
  logCryptoActivity,
  secureCryptoAction,
};

// Middlewares prêts à l’emploi
export const cryptoValidationMiddleware = validateCryptoSignature();
export const cryptoSignatureMiddleware = verifyWalletOwnership;
