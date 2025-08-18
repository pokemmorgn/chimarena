// server/src/middleware/securityMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { auditLogger } from '../utils/auditLogger';
import { securityManager } from '../config/security';

interface SecurityThreat {
  type: 'XSS' | 'SQL_INJECTION' | 'CSRF' | 'PATH_TRAVERSAL' | 'COMMAND_INJECTION' | 'NOSQL_INJECTION';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  pattern: string;
  description: string;
}

interface ValidationResult {
  isValid: boolean;
  threats: SecurityThreat[];
  sanitizedValue?: any;
}

class SecurityValidator {
  private xssPatterns: RegExp[] = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^>]*>/gi,
    /<object\b[^>]*>/gi,
    /<embed\b[^>]*>/gi,
    /<link\b[^>]*>/gi,
    /<meta\b[^>]*>/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /livescript:/gi,
    /expression\s*\(/gi,
    /@import/gi,
    /document\./gi,
    /window\./gi,
    /eval\s*\(/gi,
    /alert\s*\(/gi,
    /confirm\s*\(/gi,
    /prompt\s*\(/gi,
  ];

  private sqlInjectionPatterns: RegExp[] = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /'[^']*'|\s*OR\s+1\s*=\s*1/gi,
    /--|\#|\/\*|\*\//g,
    /\b(AND|OR)\s+1\s*=\s*1/gi,
    /\b(UNION\s+SELECT|UNION\s+ALL\s+SELECT)/gi,
    /information_schema/gi,
    /\bSLEEP\s*\(/gi,
    /\bWAITFOR\s+DELAY/gi,
    /\bCONCAT\s*\(/gi,
    /\bCHAR\s*\(/gi,
    /0x[0-9a-f]+/gi,
  ];

  private nosqlInjectionPatterns: RegExp[] = [
    /\$where/gi,
    /\$ne/gi,
    /\$gt/gi,
    /\$lt/gi,
    /\$regex/gi,
    /\$in/gi,
    /\$nin/gi,
    /\$exists/gi,
    /function\s*\(/gi,
    /this\./gi,
    /db\./gi,
  ];

  private commandInjectionPatterns: RegExp[] = [
    /[;&|`$()]/g,
    /\b(rm|del|format|shutdown|reboot|kill|ps|ls|dir|cat|type|net|ping|wget|curl|chmod|chown)\b/gi,
    /\.\.\/|\.\.\\/g,
    /\/etc\/passwd/gi,
    /\/proc\//gi,
    /cmd\.exe/gi,
    /powershell/gi,
    /bash/gi,
    /sh\s/gi,
  ];

  private pathTraversalPatterns: RegExp[] = [
    /\.\.[\/\\]/g,
    /[\/\\]\.\.([\/\\]|$)/g,
    /%2e%2e[\/\\]/gi,
    /%252e%252e/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
    /\.\.\//g,
    /\.\.\\/g,
  ];

  public validateInput(value: any, fieldName: string = 'unknown'): ValidationResult {
    if (value === null || value === undefined) {
      return { isValid: true, threats: [] };
    }

    const threats: SecurityThreat[] = [];
    let sanitizedValue = value;

    // Convertir en string pour l'analyse
    const stringValue = String(value);

    // Détection XSS
    for (const pattern of this.xssPatterns) {
      if (pattern.test(stringValue)) {
        threats.push({
          type: 'XSS',
          severity: 'HIGH',
          pattern: pattern.source,
          description: `Tentative XSS détectée dans le champ ${fieldName}`,
        });
      }
    }

    // Détection SQL Injection
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(stringValue)) {
        threats.push({
          type: 'SQL_INJECTION',
          severity: 'CRITICAL',
          pattern: pattern.source,
          description: `Tentative d'injection SQL détectée dans le champ ${fieldName}`,
        });
      }
    }

    // Détection NoSQL Injection
    for (const pattern of this.nosqlInjectionPatterns) {
      if (pattern.test(stringValue)) {
        threats.push({
          type: 'NOSQL_INJECTION',
          severity: 'HIGH',
          pattern: pattern.source,
          description: `Tentative d'injection NoSQL détectée dans le champ ${fieldName}`,
        });
      }
    }

    // Détection Command Injection
    for (const pattern of this.commandInjectionPatterns) {
      if (pattern.test(stringValue)) {
        threats.push({
          type: 'COMMAND_INJECTION',
          severity: 'CRITICAL',
          pattern: pattern.source,
          description: `Tentative d'injection de commande détectée dans le champ ${fieldName}`,
        });
      }
    }

    // Détection Path Traversal
    for (const pattern of this.pathTraversalPatterns) {
      if (pattern.test(stringValue)) {
        threats.push({
          type: 'PATH_TRAVERSAL',
          severity: 'HIGH',
          pattern: pattern.source,
          description: `Tentative de path traversal détectée dans le champ ${fieldName}`,
        });
      }
    }

    // Sanitisation si pas de threats critiques
    if (!threats.some(t => t.severity === 'CRITICAL')) {
      sanitizedValue = this.sanitizeInput(stringValue);
    }

    return {
      isValid: threats.length === 0 || !threats.some(t => t.severity === 'CRITICAL' || t.severity === 'HIGH'),
      threats,
      sanitizedValue,
    };
  }

  private sanitizeInput(input: string): string {
    return input
      // Échapper les caractères HTML dangereux
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      // Supprimer les caractères de contrôle
      .replace(/[\x00-\x1F\x7F]/g, '')
      // Normaliser les espaces
      .trim()
      .replace(/\s+/g, ' ');
  }

  public validateObject(obj: any, prefix: string = ''): ValidationResult {
    const allThreats: SecurityThreat[] = [];
    let isValid = true;
    const sanitizedObj: any = {};

    for (const [key, value] of Object.entries(obj)) {
      const fieldName = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Validation récursive pour les objets
        const result = this.validateObject(value, fieldName);
        allThreats.push(...result.threats);
        if (!result.isValid) isValid = false;
        sanitizedObj[key] = result.sanitizedValue;
      } else if (Array.isArray(value)) {
        // Validation des tableaux
        const sanitizedArray: any[] = [];
        for (let i = 0; i < value.length; i++) {
          const result = this.validateInput(value[i], `${fieldName}[${i}]`);
          allThreats.push(...result.threats);
          if (!result.isValid) isValid = false;
          sanitizedArray.push(result.sanitizedValue);
        }
        sanitizedObj[key] = sanitizedArray;
      } else {
        // Validation des valeurs primitives
        const result = this.validateInput(value, fieldName);
        allThreats.push(...result.threats);
        if (!result.isValid) isValid = false;
        sanitizedObj[key] = result.sanitizedValue;
      }
    }

    return {
      isValid,
      threats: allThreats,
      sanitizedValue: sanitizedObj,
    };
  }
}

// Instance singleton
const securityValidator = new SecurityValidator();

// Middleware de validation principale
export const securityValidationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || '';

  // Valider les paramètres de query
  if (Object.keys(req.query).length > 0) {
    const queryValidation = securityValidator.validateObject(req.query, 'query');
    if (!queryValidation.isValid) {
      logSecurityViolation(req, 'QUERY_VALIDATION_FAILED', queryValidation.threats);
      return res.status(400).json({
        error: 'Paramètres de requête invalides',
        code: 'INVALID_QUERY_PARAMS',
      });
    }
  }

  // Valider le body si présent
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyValidation = securityValidator.validateObject(req.body, 'body');
    if (!bodyValidation.isValid) {
      logSecurityViolation(req, 'BODY_VALIDATION_FAILED', bodyValidation.threats);
      return res.status(400).json({
        error: 'Données de requête invalides',
        code: 'INVALID_REQUEST_DATA',
      });
    }
    
    // Remplacer le body par la version nettoyée
    req.body = bodyValidation.sanitizedValue;
  }

  // Valider les headers critiques
  const suspiciousHeaders = [
    'x-forwarded-host',
    'x-original-url',
    'x-rewrite-url',
  ];

  for (const header of suspiciousHeaders) {
    if (req.headers[header]) {
      const validation = securityValidator.validateInput(req.headers[header], `header.${header}`);
      if (!validation.isValid) {
        logSecurityViolation(req, 'HEADER_VALIDATION_FAILED', validation.threats);
        return res.status(400).json({
          error: 'Headers de requête suspects',
          code: 'SUSPICIOUS_HEADERS',
        });
      }
    }
  }

  next();
};

// Middleware CSRF spécifique
export const csrfProtectionMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip pour les méthodes GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;

  // Vérifier Origin header
  if (origin) {
    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [];
    const isAllowedOrigin = allowedOrigins.some(allowed => {
      try {
        const allowedUrl = new URL(allowed.trim());
        const originUrl = new URL(origin);
        return allowedUrl.host === originUrl.host;
      } catch {
        return false;
      }
    });

    if (!isAllowedOrigin) {
      logSecurityViolation(req, 'CSRF_INVALID_ORIGIN', [{
        type: 'CSRF',
        severity: 'HIGH',
        pattern: origin,
        description: 'Origin non autorisé',
      }]);
      
      return res.status(403).json({
        error: 'Origine non autorisée',
        code: 'INVALID_ORIGIN',
      });
    }
  }

  // Vérifier Referer si Origin manquant
  if (!origin && referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        logSecurityViolation(req, 'CSRF_INVALID_REFERER', [{
          type: 'CSRF',
          severity: 'MEDIUM',
          pattern: referer,
          description: 'Referer suspect',
        }]);
      }
    } catch {
      // Referer malformé
      logSecurityViolation(req, 'CSRF_MALFORMED_REFERER', [{
        type: 'CSRF',
        severity: 'MEDIUM',
        pattern: referer || '',
        description: 'Referer malformé',
      }]);
    }
  }

  next();
};

// Middleware pour la validation des uploads
export const fileUploadSecurityMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // TODO: Implémenter si nécessaire pour les avatars, etc.
  next();
};

// Middleware de limitation de taille des requêtes
export const requestSizeLimitMiddleware = (maxSizeKB: number = 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSizeBytes = maxSizeKB * 1024;

    if (contentLength > maxSizeBytes) {
      logSecurityViolation(req, 'REQUEST_SIZE_LIMIT', [{
        type: 'XSS',
        severity: 'MEDIUM',
        pattern: `${contentLength} bytes`,
        description: `Requête trop volumineuse: ${contentLength} > ${maxSizeBytes}`,
      }]);

      return res.status(413).json({
        error: 'Requête trop volumineuse',
        code: 'REQUEST_TOO_LARGE',
        maxSize: maxSizeKB + 'KB',
      });
    }

    next();
  };
};

// Fonction utilitaire pour logger les violations
function logSecurityViolation(req: Request, action: string, threats: SecurityThreat[]) {
  const ip = req.ip || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  
  auditLogger.logEvent(
    'SECURITY_SUSPICIOUS_ACTIVITY',
    action,
    {
      ip,
      userAgent,
      success: false,
      details: {
        path: req.path,
        method: req.method,
        threats: threats.map(t => ({
          type: t.type,
          severity: t.severity,
          description: t.description,
        })),
        body: req.body ? Object.keys(req.body) : [],
        query: Object.keys(req.query),
      },
      severity: threats.some(t => t.severity === 'CRITICAL') ? 'CRITICAL' : 'HIGH',
    }
  );
}

// Middleware combiné pour faciliter l'utilisation
export const combinedSecurityMiddleware = [
  requestSizeLimitMiddleware(1024), // 1MB max
  securityValidationMiddleware,
  csrfProtectionMiddleware,
];

// Export pour utilisation spécifique
export { securityValidator };
export default securityValidationMiddleware;
