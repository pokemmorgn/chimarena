// server/src/middleware/cryptoMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { ethersHelper } from '../utils/ethersHelper';
import { auditLogger } from '../utils/auditLogger';
import { securityManager } from '../config/security';
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
  maxAge?: number; // en millisecondes
  requireNonce?: boolean;
  allowReuse?: boolean;
}

// 🔐 MIDDLEWARE PRINCIPAL DE VALIDATION CRYPTO
export const validateCryptoSignature = (options: SignatureValidationOptions = {}) => {
  return async (req: CryptoRequest, res: Response, next: NextFunction) => {
    const requestInfo = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || '',
      sessionId: securityManager.generateSecureToken(16),
    };

    try {
      const { address, message, signature, timestamp, nonce } = req.body;

      // Validation des champs requis
      if (!address || !message || !signature) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative crypto avec champs manquants',
          {
            ...requestInfo,
            success: false,
            details: { 
              missingFields: { address: !address, message: !message, signature: !signature },
              providedFields: Object.keys(req.body)
            },
            severity: 'HIGH',
          }
        );
        
        return res.status(400).json({
          error: 'Paramètres de signature requis manquants',
          code: 'MISSING_SIGNATURE_PARAMS'
        });
      }

      // Validation format adresse Ethereum
      if (!ethersHelper.isValidAddress(address)) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative crypto avec adresse invalide',
          {
            ...requestInfo,
            success: false,
            details: { address, format: 'invalid_ethereum_address' },
            severity: 'HIGH',
          }
        );
        
        return res.status(400).json({
          error: 'Adresse Ethereum invalide',
          code: 'INVALID_ETHEREUM_ADDRESS'
        });
      }

      // Validation timestamp si requis
      if (options.requireTimestamp && timestamp) {
        const now = Date.now();
        const maxAge = options.maxAge || 5 * 60 * 1000; // 5 minutes par défaut
        
        if (Math.abs(now - timestamp) > maxAge) {
          await auditLogger.logEvent(
            'SECURITY_SUSPICIOUS_ACTIVITY',
            'Tentative crypto avec timestamp expiré',
            {
              ...requestInfo,
              success: false,
              details: { 
                timestamp, 
                now, 
                age: Math.abs(now - timestamp),
                maxAge 
              },
              severity: 'HIGH',
            }
          );
          
          return res.status(400).json({
            error: 'Signature expirée',
            code: 'SIGNATURE_EXPIRED'
          });
        }
      }

      // Validation signature
      const isValidSignature = await ethersHelper.verifySignature(address, message, signature);
      if (!isValidSignature) {
        await auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Tentative crypto avec signature invalide',
          {
            ...requestInfo,
            success: false,
            details: { 
              address, 
              messageLength: message.length,
              signatureLength: signature.length 
            },
            severity: 'CRITICAL',
          }
        );
        
        return res.status(403).json({
          error: 'Signature cryptographique invalide',
          code: 'INVALID_SIGNATURE'
        });
      }

      // Vérification anti-replay si requis
      if (!options.allowReuse && nonce) {
        const isNonceUsed = await ethersHelper.isNonceUsed(address, nonce);
        if (isNonceUsed) {
          await auditLogger.logEvent(
            'SECURITY_SUSPICIOUS_ACTIVITY',
            'Tentative de réutilisation de nonce',
            {
              ...requestInfo,
              success: false,
              details: { address, nonce },
              severity: 'CRITICAL',
            }
          );
          
          return res.status(403).json({
            error: 'Nonce déjà utilisé',
            code: 'NONCE_REUSED'
          });
        }

        // Marquer le nonce comme utilisé
        await ethersHelper.markNonceAsUsed(address, nonce);
      }

      // Ajouter les infos de validation à la requête
      req.cryptoValidation = {
        isValid: true,
        address,
        message,
        signature,
        timestamp: timestamp || Date.now(),
      };

      // Log succès de validation
      await auditLogger.logEvent(
        'CRYPTO_DEPOSIT', // Utilise ce type pour les validations crypto
        'Signature crypto validée avec succès',
        {
          ...requestInfo,
          success: true,
          details: { 
            address: ethersHelper.formatAddress(address),
            messageType: ethersHelper.detectMessageType(message),
            hasTimestamp: !!timestamp,
            hasNonce: !!nonce
          },
          severity: 'MEDIUM',
        }
      );

      next();

    } catch (error) {
      await auditLogger.logEvent(
        'SYSTEM_ERROR',
        'Erreur lors de la validation crypto',
        {
          ...requestInfo,
          success: false,
          error: error instanceof Error ? error.message : 'Erreur inconnue',
          details: { 
            body: Object.keys(req.body),
            errorType: error instanceof Error ? error.constructor.name : 'unknown'
          },
          severity: 'HIGH',
        }
      );

      console.error('❌ Erreur validation crypto:', error);
      res.status(500).json({
        error: 'Erreur de validation cryptographique',
        code: 'CRYPTO_VALIDATION_ERROR'
      });
    }
  };
};

// 🛡️ MIDDLEWARE DE VÉRIFICATION WALLET OWNERSHIP
export const verifyWalletOwnership = async (req: CryptoRequest, res: Response, next: NextFunction) => {
  const requestInfo = {
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || '',
  };

  try {
    if (!req.cryptoValidation?.isValid) {
      return res.status(400).json({
        error: 'Validation crypto requise',
        code: 'CRYPTO_VALIDATION_REQUIRED'
      });
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        error: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      await auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Tentative crypto avec utilisateur inexistant',
        {
          ...requestInfo,
          userId,
          success: false,
          details: { address: req.cryptoValidation.address },
          severity: 'HIGH',
        }
      );
      
      return res.status(404).json({
        error: 'Utilisateur non trouvé',
        code: 'USER_NOT_FOUND'
      });
    }

    // Vérifier que l'adresse appartient à l'utilisateur
    const userWalletAddress = user.cryptoWallet?.address;
    if (userWalletAddress && userWalletAddress.toLowerCase() !== req.cryptoValidation.address.toLowerCase()) {
      await auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Tentative d\'utilisation d\'adresse wallet non autorisée',
        {
          ...requestInfo,
          userId: user._id.toString(),
          username: user.username,
          success: false,
          details: { 
            userWallet: ethersHelper.formatAddress(userWalletAddress),
            providedAddress: ethersHelper.formatAddress(req.cryptoValidation.address)
          },
          severity: 'CRITICAL',
        }
      );
      
      return res.status(403).json({
        error: 'Adresse wallet non autorisée pour cet utilisateur',
        code: 'WALLET_NOT_AUTHORIZED'
      });
    }

    // Ajouter l'utilisateur à la requête pour les middleware suivants
    (req as any).walletUser = user;

    next();

  } catch (error) {
    await auditLogger.logEvent(
      'SYSTEM_ERROR',
      'Erreur lors de la vérification wallet ownership',
      {
        ...requestInfo,
        userId: (req as any).user?.id,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        severity: 'HIGH',
      }
    );

    console.error('❌ Erreur vérification wallet ownership:', error);
    res.status(500).json({
      error: 'Erreur de vérification wallet',
      code: 'WALLET_VERIFICATION_ERROR'
    });
  }
};

// 🚫 MIDDLEWARE DE RATE LIMITING CRYPTO SPÉCIALISÉ
export const cryptoRateLimit = (action: 'connect' | 'disconnect' | 'transaction' | 'withdrawal') => {
  const limits = {
    connect: { window: 60 * 60 * 1000, max: 3 }, // 3 connexions/heure
    disconnect: { window: 60 * 60 * 1000, max: 10 }, // 10 déconnexions/heure
    transaction: { window: 60 * 60 * 1000, max: 5 }, // 5 transactions/heure
    withdrawal: { window: 24 * 60 * 60 * 1000, max: 5 }, // 5 retraits/jour
  };

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

    // Reset si en dehors de la fenêtre
    if (now - attempt.firstAttempt > limit.window) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    // Vérifier la limite
    if (attempt.count >= limit.max) {
      await auditLogger.logEvent(
        'SECURITY_RATE_LIMIT',
        `Rate limit crypto dépassé: ${action}`,
        {
          ip: req.ip || 'unknown',
          userId: (req as any).user?.id,
          userAgent: req.headers['user-agent'],
          success: false,
          details: { 
            action, 
            count: attempt.count, 
            limit: limit.max,
            window: limit.window 
          },
          severity: 'HIGH',
        }
      );

      return res.status(429).json({
        error: `Trop de tentatives ${action}`,
        code: 'CRYPTO_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((attempt.firstAttempt + limit.window - now) / 1000),
      });
    }

    // Incrémenter le compteur
    attempt.count++;
    next();
  };
};

// 🔍 MIDDLEWARE DE DÉTECTION DE COMPORTEMENT SUSPECT CRYPTO
export const detectSuspiciousCryptoActivity = async (req: Request, res: Response, next: NextFunction) => {
  const requestInfo = {
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || '',
  };

  try {
    const userId = (req as any).user?.id;
    if (!userId) return next();

    const user = await User.findById(userId);
    if (!user) return next();

    // Patterns suspects
    const suspiciousIndicators = [];

    // 1. Nouveau compte tentant des actions crypto
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    if (accountAge < 24 * 60 * 60 * 1000) { // Moins de 24h
      suspiciousIndicators.push('account_too_new');
    }

    // 2. Compte avec score de suspicion élevé
    if (user.accountInfo?.suspiciousActivityScore > 50) {
      suspiciousIndicators.push('high_suspicion_score');
    }

    // 3. Tentatives depuis IP/UA différents
    const lastKnownIPs = user.accountInfo?.lastKnownIPs || [];
    const currentIP = req.ip || '';
    if (lastKnownIPs.length > 0 && !lastKnownIPs.includes(currentIP)) {
      suspiciousIndicators.push('unknown_ip');
    }

    // 4. Actions crypto en dehors des heures normales (peut être légitime)
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      suspiciousIndicators.push('unusual_hours');
    }

    // Si plusieurs indicateurs, augmenter la vigilance
    if (suspiciousIndicators.length >= 2) {
      await auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Activité crypto suspecte détectée',
        {
          ...requestInfo,
          userId: user._id.toString(),
          username: user.username,
          success: false,
          details: { 
            indicators: suspiciousIndicators,
            accountAge: Math.floor(accountAge / (60 * 60 * 1000)), // en heures
            suspicionScore: user.accountInfo?.suspiciousActivityScore || 0,
            action: req.path
          },
          severity: suspiciousIndicators.length >= 3 ? 'CRITICAL' : 'HIGH',
        }
      );

      // Si très suspect, bloquer
      if (suspiciousIndicators.length >= 3) {
        return res.status(403).json({
          error: 'Activité suspecte détectée',
          code: 'SUSPICIOUS_CRYPTO_ACTIVITY',
          message: 'Veuillez contacter le support pour vérification'
        });
      }

      // Sinon, ajouter un warning
      res.set('X-Security-Warning', 'Activité surveillée');
    }

    next();

  } catch (error) {
    console.error('❌ Erreur détection activité suspecte:', error);
    // Ne pas bloquer en cas d'erreur, juste logger
    next();
  }
};

// 📊 MIDDLEWARE DE LOGGING CRYPTO DÉTAILLÉ
export const logCryptoActivity = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const requestInfo = {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || '',
    };

    // Capturer la réponse
    const originalSend = res.send;
    let responseData: any = null;
    
    res.send = function(data: any) {
      responseData = data;
      return originalSend.call(this, data);
    };

    res.on('finish', async () => {
      const duration = Date.now() - start;
      const success = res.statusCode < 400;

      await auditLogger.logEvent(
        success ? 'CRYPTO_DEPOSIT' : 'SECURITY_SUSPICIOUS_ACTIVITY',
        `Action crypto: ${action}`,
        {
          ...requestInfo,
          userId: (req as any).user?.id,
          username: (req as any).user?.username,
          success,
          details: {
            action,
            statusCode: res.statusCode,
            duration,
            cryptoValidation: (req as any).cryptoValidation ? {
              address: ethersHelper.formatAddress((req as any).cryptoValidation.address),
              hasTimestamp: !!(req as any).cryptoValidation.timestamp,
            } : null,
            responseSize: typeof responseData === 'string' ? responseData.length : 0,
          },
          severity: success ? 'MEDIUM' : 'HIGH',
        }
      );
    });

    next();
  };
};

// 🎯 MIDDLEWARE COMBINÉ POUR ACTIONS CRYPTO CRITIQUES
export const secureCryptoAction = (action: 'connect' | 'disconnect' | 'transaction' | 'withdrawal') => {
  const middlewares = [
    cryptoRateLimit(action),
    detectSuspiciousCryptoActivity,
    logCryptoActivity(action),
  ];

  // Ajouter validation signature pour certaines actions
  if (['transaction', 'withdrawal'].includes(action)) {
    middlewares.unshift(validateCryptoSignature({ 
      requireTimestamp: true, 
      maxAge: 5 * 60 * 1000, // 5 minutes
      requireNonce: true,
      allowReuse: false
    }));
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
