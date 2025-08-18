// server/src/middleware/antiBotMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { securityManager } from '../config/security';
import { auditLogger } from '../utils/auditLogger';

interface ClientFingerprint {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  connection: string;
  contentType?: string;
}

interface ActionPattern {
  ip: string;
  actions: number[];
  lastAction: number;
  totalActions: number;
  suspiciousScore: number;
  fingerprint: string;
}

interface BotDetectionResult {
  isBot: boolean;
  reason?: string;
  confidence: number; // 0-100
  action: 'allow' | 'rate_limit' | 'block' | 'captcha';
}

class AntiBotDetector {
  private patterns: Map<string, ActionPattern> = new Map();
  private blockedIPs: Map<string, { until: number; reason: string }> = new Map();
  private whitelistedIPs: Set<string> = new Set();
  private config = securityManager.getAntiBotConfig();

  constructor() {
    // IPs whitelistées (localhost pour dev, etc.)
    this.whitelistedIPs.add('127.0.0.1');
    this.whitelistedIPs.add('::1');
    
    // Nettoyage périodique des patterns anciens
    setInterval(() => this.cleanupOldPatterns(), 10 * 60 * 1000); // 10 minutes
  }

  private cleanupOldPatterns(): void {
    const now = Date.now();
    const cleanupAge = 30 * 60 * 1000; // 30 minutes

    for (const [key, pattern] of this.patterns.entries()) {
      if (now - pattern.lastAction > cleanupAge) {
        this.patterns.delete(key);
      }
    }

    // Nettoyer les IPs bloquées expirées
    for (const [ip, block] of this.blockedIPs.entries()) {
      if (now > block.until) {
        this.blockedIPs.delete(ip);
      }
    }
  }

  private generateFingerprint(req: Request): string {
    const fp: ClientFingerprint = {
      userAgent: req.headers['user-agent'] || '',
      acceptLanguage: req.headers['accept-language'] || '',
      acceptEncoding: req.headers['accept-encoding'] || '',
      connection: req.headers.connection || '',
      contentType: req.headers['content-type'],
    };

    return Buffer.from(JSON.stringify(fp)).toString('base64');
  }

  private analyzeUserAgent(userAgent: string): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    if (!userAgent) {
      reasons.push('User-Agent manquant');
      return { score: 80, reasons };
    }

    // Patterns suspects dans User-Agent
    const suspiciousPatterns = [
      /bot|crawler|spider|scraper/i,
      /python|curl|wget|http/i,
      /automation|selenium|puppeteer/i,
      /^Mozilla\/5\.0$/,  // UA trop basique
      /HeadlessChrome/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(userAgent)) {
        score += 30;
        reasons.push(`Pattern suspect dans User-Agent: ${pattern.source}`);
      }
    }

    // UA trop ancien (> 5 ans)
    const versionMatch = userAgent.match(/Chrome\/(\d+)/);
    if (versionMatch) {
      const version = parseInt(versionMatch[1]);
      if (version < 80) { // Chrome < 80 (2020)
        score += 20;
        reasons.push('Navigateur très ancien');
      }
    }

    // UA trop long ou trop court
    if (userAgent.length < 20 || userAgent.length > 500) {
      score += 15;
      reasons.push('User-Agent anormal (taille)');
    }

    return { score, reasons };
  }

  private analyzeRequestHeaders(req: Request): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Headers suspects ou manquants
    const expectedHeaders = ['accept', 'accept-language', 'accept-encoding'];
    for (const header of expectedHeaders) {
      if (!req.headers[header]) {
        score += 10;
        reasons.push(`Header manquant: ${header}`);
      }
    }

    // Ordre des headers suspect (bots ont souvent un ordre différent)
    const headerKeys = Object.keys(req.headers);
    if (headerKeys.length < 5) {
      score += 15;
      reasons.push('Trop peu de headers');
    }

    // Headers de bots connus
    const botHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-crawler',
      'x-bot',
    ];

    for (const header of botHeaders) {
      if (req.headers[header]) {
        score += 25;
        reasons.push(`Header de bot détecté: ${header}`);
      }
    }

    return { score, reasons };
  }

  private analyzeActionPattern(ip: string, fingerprint: string): { score: number; reasons: string[] } {
    const now = Date.now();
    const pattern = this.patterns.get(ip);
    const reasons: string[] = [];
    let score = 0;

    if (!pattern) {
      // Première action pour cette IP
      this.patterns.set(ip, {
        ip,
        actions: [now],
        lastAction: now,
        totalActions: 1,
        suspiciousScore: 0,
        fingerprint,
      });
      return { score: 0, reasons: [] };
    }

    // Mettre à jour le pattern
    pattern.actions.push(now);
    pattern.lastAction = now;
    pattern.totalActions++;

    // Garder seulement les 50 dernières actions pour l'analyse
    if (pattern.actions.length > 50) {
      pattern.actions = pattern.actions.slice(-50);
    }

    // 1. Analyser la fréquence des actions
    const recentActions = pattern.actions.filter(time => now - time < 60000); // 1 minute
    if (recentActions.length > this.config.maxActionsPerSecond * 60) {
      score += 40;
      reasons.push(`Trop d'actions par minute: ${recentActions.length}`);
    }

    // 2. Analyser les intervalles entre actions
    const intervals: number[] = [];
    for (let i = 1; i < pattern.actions.length; i++) {
      intervals.push(pattern.actions[i] - pattern.actions[i - 1]);
    }

    if (intervals.length > 5) {
      // Intervalles trop réguliers (signe de bot)
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const variance = intervals.reduce((sum, interval) => {
        return sum + Math.pow(interval - avgInterval, 2);
      }, 0) / intervals.length;
      
      const standardDeviation = Math.sqrt(variance);
      
      // Si les intervalles sont très réguliers (faible écart-type)
      if (standardDeviation < avgInterval * 0.1 && avgInterval < 5000) {
        score += 35;
        reasons.push('Intervalles d\'actions trop réguliers (bot suspect)');
      }

      // Actions trop rapides (< minimum gaming-friendly)
      const tooFastActions = intervals.filter(i => i < this.config.minActionInterval).length;
      if (tooFastActions > this.config.burstTolerance) {
        score += 30;
        reasons.push(`Actions trop rapides: ${tooFastActions} sous ${this.config.minActionInterval}ms`);
      }
    }

    // 3. Détecter les patterns répétitifs
    if (pattern.totalActions > 20) {
      // Analyser si les actions suivent un pattern exact
      const lastTenIntervals = intervals.slice(-10);
      const firstTenIntervals = intervals.slice(0, 10);
      
      if (lastTenIntervals.length === 10 && firstTenIntervals.length === 10) {
        const similarity = this.calculateSimilarity(lastTenIntervals, firstTenIntervals);
        if (similarity > 0.9) {
          score += 50;
          reasons.push('Pattern d\'actions répétitif détecté');
        }
      }
    }

    // 4. Changement de fingerprint suspect
    if (pattern.fingerprint !== fingerprint) {
      score += 20;
      reasons.push('Changement de fingerprint navigateur');
      pattern.fingerprint = fingerprint; // Mettre à jour
    }

    // 5. Volume d'actions anormal
    if (pattern.totalActions > this.config.suspiciousThreshold) {
      score += 25;
      reasons.push(`Volume d'actions suspect: ${pattern.totalActions}`);
    }

    // Mettre à jour le score de suspicion du pattern
    pattern.suspiciousScore = Math.max(pattern.suspiciousScore, score);

    return { score, reasons };
  }

  private calculateSimilarity(arr1: number[], arr2: number[]): number {
    if (arr1.length !== arr2.length) return 0;
    
    let matches = 0;
    const tolerance = 100; // 100ms de tolérance
    
    for (let i = 0; i < arr1.length; i++) {
      if (Math.abs(arr1[i] - arr2[i]) <= tolerance) {
        matches++;
      }
    }
    
    return matches / arr1.length;
  }

  public detectBot(req: Request): BotDetectionResult {
    const ip = req.ip || 'unknown';
    
    // Vérifier si IP whitelistée
    if (this.whitelistedIPs.has(ip)) {
      return { isBot: false, confidence: 0, action: 'allow' };
    }

    // Vérifier si IP bloquée
    const blocked = this.blockedIPs.get(ip);
    if (blocked && Date.now() < blocked.until) {
      return {
        isBot: true,
        reason: blocked.reason,
        confidence: 100,
        action: 'block',
      };
    }

    const fingerprint = this.generateFingerprint(req);
    
    // Analyser différents aspects
    const uaAnalysis = this.analyzeUserAgent(req.headers['user-agent'] || '');
    const headersAnalysis = this.analyzeRequestHeaders(req);
    const patternAnalysis = this.analyzeActionPattern(ip, fingerprint);

    // Score global
    const totalScore = uaAnalysis.score + headersAnalysis.score + patternAnalysis.score;
    const allReasons = [...uaAnalysis.reasons, ...headersAnalysis.reasons, ...patternAnalysis.reasons];

    // Déterminer l'action basée sur le score
    let action: BotDetectionResult['action'] = 'allow';
    let isBot = false;

    if (totalScore >= 80) {
      isBot = true;
      action = 'block';
      // Bloquer temporairement
      this.blockedIPs.set(ip, {
        until: Date.now() + 60 * 60 * 1000, // 1 heure
        reason: 'Bot détecté - Score: ' + totalScore,
      });
    } else if (totalScore >= 50) {
      isBot = true;
      action = 'rate_limit';
    } else if (totalScore >= 30) {
      action = 'captcha'; // Pour implémenter plus tard
    }

    return {
      isBot,
      reason: allReasons.join('; '),
      confidence: Math.min(totalScore, 100),
      action,
    };
  }

  public addToWhitelist(ip: string): void {
    this.whitelistedIPs.add(ip);
  }

  public removeFromWhitelist(ip: string): void {
    this.whitelistedIPs.delete(ip);
  }

  public unblockIP(ip: string): void {
    this.blockedIPs.delete(ip);
  }

  public getPatternStats(ip: string): ActionPattern | null {
    return this.patterns.get(ip) || null;
  }
}

// Instance singleton
const antiBotDetector = new AntiBotDetector();

// Middleware principal
export const antiBotMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const detection = antiBotDetector.detectBot(req);
  const ip = req.ip || 'unknown';

  // Ajouter les infos de détection à la requête
  (req as any).botDetection = detection;

  // Log si activité suspecte
  if (detection.confidence > 30) {
    auditLogger.logEvent(
      'SECURITY_SUSPICIOUS_ACTIVITY',
      'Activité suspecte détectée',
      {
        ip,
        userAgent: req.headers['user-agent'],
        success: false,
        details: {
          confidence: detection.confidence,
          reason: detection.reason,
          action: detection.action,
          path: req.path,
          method: req.method,
        },
        severity: detection.confidence > 70 ? 'HIGH' : 'MEDIUM',
      }
    );
  }

  // Actions basées sur la détection
  switch (detection.action) {
    case 'block':
      auditLogger.logEvent(
        'SECURITY_BOT_DETECTED',
        'Bot bloqué',
        {
          ip,
          userAgent: req.headers['user-agent'],
          success: false,
          details: {
            confidence: detection.confidence,
            reason: detection.reason,
          },
          severity: 'CRITICAL',
        }
      );
      
      return res.status(429).json({
        error: 'Activité suspecte détectée',
        code: 'BOT_DETECTED',
        retryAfter: 3600, // 1 heure
      });

    case 'rate_limit':
      // Appliquer un rate limit plus strict
      res.set('X-RateLimit-Warning', 'Activité suspecte - Limitation appliquée');
      break;

    case 'captcha':
      // Pour l'instant, juste un warning
      res.set('X-Captcha-Required', 'true');
      break;

    case 'allow':
    default:
      // Continuer normalement
      break;
  }

  next();
};

// Middleware spécifique pour les actions gaming (plus permissif)
export const antiBotGamingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const detection = antiBotDetector.detectBot(req);
  
  // Pour le gaming, on est plus tolérant (seulement bloquer si très suspect)
  if (detection.action === 'block' && detection.confidence > 90) {
    return res.status(429).json({
      error: 'Activité anormale détectée',
      code: 'RATE_LIMITED',
      message: 'Veuillez ralentir vos actions',
    });
  }

  (req as any).botDetection = detection;
  next();
};

// Middleware spécifique pour les actions crypto (très strict)
export const antiBotCryptoMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const detection = antiBotDetector.detectBot(req);
  
  // Pour la crypto, on bloque dès 40% de confiance
  if (detection.confidence > 40) {
    auditLogger.logEvent(
      'SECURITY_BOT_DETECTED',
      'Tentative d\'accès crypto par bot suspect',
      {
        ip: req.ip || 'unknown',
        userAgent: req.headers['user-agent'],
        success: false,
        details: {
          confidence: detection.confidence,
          reason: detection.reason,
          endpoint: req.path,
        },
        severity: 'CRITICAL',
      }
    );

    return res.status(403).json({
      error: 'Accès refusé - Vérification de sécurité requise',
      code: 'SECURITY_CHECK_REQUIRED',
    });
  }

  (req as any).botDetection = detection;
  next();
};

export { antiBotDetector };
export default antiBotMiddleware;
