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
    const pattern = this.patterns
