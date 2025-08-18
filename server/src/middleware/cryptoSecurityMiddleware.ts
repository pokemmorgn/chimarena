// server/src/middleware/cryptoSecurityMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { auditLogger } from '../utils/auditLogger';

interface CryptoValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedBody?: any;
}

/**
 * Middleware de sécurité spécialisé pour les routes crypto MetaMask
 * Remplace la validation générale par une validation adaptée aux besoins crypto
 */
export const cryptoSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestInfo = {
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || '',
    path: req.path,
    method: req.method,
  };

  try {
    // 1. Validation spécifique au body crypto
    const bodyValidation = validateCryptoBody(req.body);
    if (!bodyValidation.isValid) {
      auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Validation crypto échouée',
        {
          ...requestInfo,
          success: false,
          details: {
            errors: bodyValidation.errors,
            bodyKeys: req.body ? Object.keys(req.body) : []
          },
          severity: 'HIGH',
        }
      );

      return res.status(400).json({
        error: 'Données crypto invalides',
        code: 'INVALID_CRYPTO_DATA',
        details: bodyValidation.errors
      });
    }

    // 2. Remplacer le body par la version nettoyée
    if (bodyValidation.sanitizedBody) {
      req.body = bodyValidation.sanitizedBody;
    }

    // 3. Validation allégée des headers pour crypto
    const headerValidation = validateCryptoHeaders(req);
    if (!headerValidation.isValid) {
      // Log seulement, ne pas bloquer pour les headers normaux
      console.warn('⚠️ Headers crypto suspects détectés:', headerValidation.errors);
      
      // Bloquer seulement les headers vraiment dangereux
      const hasDangerousHeaders = headerValidation.errors.some(error => 
        error.includes('x-forwarded-host') || 
        error.includes('x-original-url') || 
        error.includes('x-rewrite-url')
      );
      
      if (hasDangerousHeaders) {
        auditLogger.logEvent(
          'SECURITY_SUSPICIOUS_ACTIVITY',
          'Headers crypto dangereux',
          {
            ...requestInfo,
            success: false,
            details: { errors: headerValidation.errors },
            severity: 'HIGH',
          }
        );

        return res.status(400).json({
          error: 'Headers de requête dangereux détectés',
          code: 'DANGEROUS_CRYPTO_HEADERS'
        });
      }
    }

    // 4. Validation Content-Type pour crypto
    const contentType = req.headers['content-type'];
    if (req.method === 'POST' && contentType !== 'application/json') {
      return res.status(400).json({
        error: 'Content-Type application/json requis pour les routes crypto',
        code: 'INVALID_CONTENT_TYPE'
      });
    }

    // 5. Limitation de taille pour crypto (plus strict)
    const contentLength = parseInt(req.headers['content-length'] || '0');
    if (contentLength > 10 * 1024) { // 10KB max pour crypto
      auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Requête crypto trop volumineuse',
        {
          ...requestInfo,
          success: false,
          details: { contentLength, maxAllowed: 10240 },
          severity: 'MEDIUM',
        }
      );

      return res.status(413).json({
        error: 'Requête trop volumineuse pour les routes crypto',
        code: 'CRYPTO_REQUEST_TOO_LARGE',
        maxSize: '10KB'
      });
    }

    next();

  } catch (error) {
    auditLogger.logEvent(
      'SYSTEM_ERROR',
      'Erreur middleware sécurité crypto',
      {
        ...requestInfo,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        severity: 'HIGH',
      }
    );

    console.error('❌ Erreur middleware crypto security:', error);
    res.status(500).json({
      error: 'Erreur de validation sécurité crypto',
      code: 'CRYPTO_SECURITY_ERROR'
    });
  }
};

/**
 * Valide le body des requêtes crypto
 */
function validateCryptoBody(body: any): CryptoValidationResult {
  const errors: string[] = [];
  let sanitizedBody: any = {};

  if (!body || typeof body !== 'object') {
    return {
      isValid: true,
      errors: [],
      sanitizedBody: body
    };
  }

  // Champs autorisés selon l'endpoint crypto
  const allowedFields = {
    // Champs pour connexion/déconnexion wallet
    common: ['address', 'signature', 'message', 'timestamp', 'nonce'],
    // Champs additionnels pour transactions futures
    transaction: ['amount', 'token', 'recipient', 'gasLimit', 'gasPrice'],
    // Champs pour vérification
    verification: ['challenge', 'response']
  };

  const allAllowedFields = [
    ...allowedFields.common,
    ...allowedFields.transaction,
    ...allowedFields.verification
  ];

  // 1. Vérifier les champs autorisés
  const bodyKeys = Object.keys(body);
  const invalidFields = bodyKeys.filter(key => !allAllowedFields.includes(key));
  
  if (invalidFields.length > 0) {
    errors.push(`Champs non autorisés: ${invalidFields.join(', ')}`);
  }

  // 2. Validation et nettoyage des champs crypto spécifiques
  for (const [key, value] of Object.entries(body)) {
    if (!allAllowedFields.includes(key)) {
      continue; // Skip les champs non autorisés (déjà signalés)
    }

    let sanitizedValue = value;

    switch (key) {
      case 'address':
        const addressValidation = validateEthereumAddress(value);
        if (!addressValidation.isValid) {
          errors.push(`Adresse invalide: ${addressValidation.error}`);
        } else {
          sanitizedValue = addressValidation.sanitized;
        }
        break;

      case 'signature':
        const signatureValidation = validateSignature(value);
        if (!signatureValidation.isValid) {
          errors.push(`Signature invalide: ${signatureValidation.error}`);
        } else {
          sanitizedValue = signatureValidation.sanitized;
        }
        break;

      case 'message':
        const messageValidation = validateMessage(value);
        if (!messageValidation.isValid) {
          errors.push(`Message invalide: ${messageValidation.error}`);
        } else {
          sanitizedValue = messageValidation.sanitized;
        }
        break;

      case 'timestamp':
        const timestampValidation = validateTimestamp(value);
        if (!timestampValidation.isValid) {
          errors.push(`Timestamp invalide: ${timestampValidation.error}`);
        } else {
          sanitizedValue = timestampValidation.sanitized;
        }
        break;

      case 'nonce':
        const nonceValidation = validateNonce(value);
        if (!nonceValidation.isValid) {
          errors.push(`Nonce invalide: ${nonceValidation.error}`);
        } else {
          sanitizedValue = nonceValidation.sanitized;
        }
        break;

      default:
        // Pour les autres champs, validation basique
        sanitizedValue = sanitizeBasicField(value);
        break;
    }

    sanitizedBody[key] = sanitizedValue;
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedBody
  };
}

/**
 * Valide les headers crypto
 */
function validateCryptoHeaders(req: Request): CryptoValidationResult {
  const errors: string[] = [];

  // Headers VRAIMENT dangereux seulement
  const dangerousHeaders = [
    'x-forwarded-host',
    'x-original-url', 
    'x-rewrite-url'
  ];

  for (const header of dangerousHeaders) {
    if (req.headers[header]) {
      errors.push(`Header dangereux détecté: ${header}`);
    }
  }

  // User-Agent : warning seulement, ne pas bloquer
  const userAgent = req.headers['user-agent'];
  if (!userAgent) {
    console.warn('⚠️ User-Agent manquant pour requête crypto');
  }

  // Ne pas vérifier Content-Type ici (géré par Express)

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Fonctions de validation spécialisées

function validateEthereumAddress(value: any): { isValid: boolean; error?: string; sanitized?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, error: 'Doit être une chaîne' };
  }

  const pattern = /^0x[a-fA-F0-9]{40}$/;
  if (!pattern.test(value)) {
    return { isValid: false, error: 'Format d\'adresse Ethereum invalide' };
  }

  return { isValid: true, sanitized: value.toLowerCase() };
}

function validateSignature(value: any): { isValid: boolean; error?: string; sanitized?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, error: 'Doit être une chaîne' };
  }

  if (!value.startsWith('0x') || value.length !== 132) {
    return { isValid: false, error: 'Format de signature invalide' };
  }

  // Vérifier que c'est bien hexadécimal
  const hexPattern = /^0x[a-fA-F0-9]{130}$/;
  if (!hexPattern.test(value)) {
    return { isValid: false, error: 'Signature contient des caractères invalides' };
  }

  return { isValid: true, sanitized: value };
}

function validateMessage(value: any): { isValid: boolean; error?: string; sanitized?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, error: 'Doit être une chaîne' };
  }

  // Longueur raisonnable pour un message crypto
  if (value.length < 10 || value.length > 2000) {
    return { isValid: false, error: 'Longueur de message invalide' };
  }

  // Patterns suspects dans le message
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+=/i,
    /eval\(/i,
    /alert\(/i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(value)) {
      return { isValid: false, error: 'Contenu de message suspect' };
    }
  }

  // Nettoyer le message
  const sanitized = value
    .replace(/[\x00-\x1F\x7F]/g, '') // Supprimer caractères de contrôle
    .trim();

  return { isValid: true, sanitized };
}

function validateTimestamp(value: any): { isValid: boolean; error?: string; sanitized?: number } {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return { isValid: false, error: 'Doit être un nombre' };
  }

  const timestamp = typeof value === 'string' ? parseInt(value) : value;
  
  if (isNaN(timestamp)) {
    return { isValid: false, error: 'Timestamp invalide' };
  }

  // Vérifier que c'est un timestamp raisonnable (entre 2020 et 2030)
  const min = new Date('2020-01-01').getTime();
  const max = new Date('2030-01-01').getTime();
  
  if (timestamp < min || timestamp > max) {
    return { isValid: false, error: 'Timestamp hors limites raisonnables' };
  }

  return { isValid: true, sanitized: timestamp };
}

function validateNonce(value: any): { isValid: boolean; error?: string; sanitized?: string } {
  if (typeof value !== 'string') {
    return { isValid: false, error: 'Doit être une chaîne' };
  }

  // Nonce doit être hexadécimal
  const pattern = /^[a-fA-F0-9]+$/;
  if (!pattern.test(value)) {
    return { isValid: false, error: 'Nonce doit être hexadécimal' };
  }

  // Longueur raisonnable
  if (value.length < 8 || value.length > 128) {
    return { isValid: false, error: 'Longueur de nonce invalide' };
  }

  return { isValid: true, sanitized: value.toLowerCase() };
}

function sanitizeBasicField(value: any): any {
  if (typeof value === 'string') {
    return value
      .replace(/[\x00-\x1F\x7F]/g, '') // Supprimer caractères de contrôle
      .trim()
      .slice(0, 500); // Limiter la longueur
  }
  return value;
}

export default cryptoSecurityMiddleware;
