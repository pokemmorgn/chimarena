// server/src/config/middlewares.ts
import type { Application, Request } from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

// 🔐 IMPORTS SÉCURITÉ
import { securityManager } from './security';
import { auditLogger } from '../utils/auditLogger';

export const setupMiddlewares = (app: Application) => {
  // Derrière Nginx/HTTPS
  app.set('trust proxy', 1);

  // 🛡️ SÉCURITÉ RENFORCÉE AVEC HELMET
  app.use(helmet({
    // Content Security Policy stricte pour éviter XSS
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'ws:'],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    // Headers de sécurité additionnels
    crossOriginEmbedderPolicy: false, // Peut casser le gaming
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000, // 1 an
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true,
  }));

  // Headers de sécurité custom additionnels
  app.use((req, res, next) => {
    // Anti-fingerprinting
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');
    
    // Headers de sécurité crypto-grade
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Feature-Policy', "geolocation 'none'; microphone 'none'; camera 'none'");
    res.setHeader('Permissions-Policy', "geolocation=(), microphone=(), camera=()");
    
    // Anti-cache pour les données sensibles
    if (req.path.includes('/api/user') || req.path.includes('/api/auth') || req.path.includes('/api/crypto')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    
    next();
  });

  // 📊 LOGS AVEC AUDIT INTÉGRÉ
  if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined', {
      stream: {
        write: (message) => {
          // Log les accès dans l'audit pour les routes sensibles
          const logData = message.trim();
          if (logData.includes('/api/auth') || logData.includes('/api/crypto') || logData.includes('error')) {
            // Parse basique du log Morgan pour extraire l'IP
            const parts = logData.split(' ');
            const ip = parts[0] || 'unknown';
            const method = parts[5]?.replace('"', '') || 'unknown';
            const path = parts[6] || 'unknown';
            const status = parseInt(parts[8]) || 0;
            
            if (status >= 400) {
              auditLogger.logEvent(
                'SECURITY_SUSPICIOUS_ACTIVITY',
                `Accès HTTP ${status}`,
                {
                  ip,
                  success: false,
                  details: { method, path, status, fullLog: logData },
                  severity: status >= 500 ? 'HIGH' : 'MEDIUM',
                }
              );
            }
          }
          console.log(logData);
        }
      }
    }));
  } else {
    app.use(morgan('dev'));
  }

  // Compression
  app.use(compression());

  // Cookies (INDISPENSABLE pour /refresh)
  app.use(cookieParser());

  // Body parsing avec validation de taille
  // Body parsing avec validation allégée
app.use(express.json({ 
  limit: '1mb',
  verify: (req, res, buf) => {
    // Skip validation pour routes spéciales
    const skipRoutes = ['/refresh', '/health'];
    if (skipRoutes.some(route => req.url?.includes(route))) {
      return;
    }
    
    // Validation JSON seulement si il y a du contenu
    if (buf.length > 0) {
      try {
        JSON.parse(buf.toString());
      } catch (e) {
        throw new Error('JSON malformé');
      }
    }
  }
}));
  
  app.use(express.urlencoded({ 
    extended: true, 
    limit: '1mb',
    parameterLimit: 100 // Limite le nombre de paramètres
  }));

  // 🌍 CORS SÉCURISÉ avec validation stricte
  const allowedOrigins = (process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'https://chimarena.cloud',
        'https://www.chimarena.cloud',
        'http://localhost:8080',
        'http://127.0.0.1:8080',
      ]).map(s => s.trim());

  app.use(
    cors({
      origin(origin, cb) {
        // Permettre les requêtes sans origin (ex: mobile apps, curl)
        if (!origin) return cb(null, true);
        
        // Vérifier la whitelist
        const isAllowed = allowedOrigins.includes(origin);
        
        if (!isAllowed) {
          // Log tentative d'accès non autorisée
          auditLogger.logEvent(
            'SECURITY_SUSPICIOUS_ACTIVITY',
            'Tentative CORS non autorisée',
            {
              ip: 'unknown', // Pas d'accès à req ici
              success: false,
              details: { origin, allowedOrigins },
              severity: 'MEDIUM',
            }
          );
        }
        
        return isAllowed ? cb(null, true) : cb(new Error('CORS not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count', 'X-RateLimit-Warning'],
      maxAge: 300, // 5 minutes de cache pour preflight
    })
  );

  // 🚫 RATE LIMITING ADAPTÉ CRYPTO-GRADE
  const rateLimits = securityManager.getConfig().rateLimits;
  
  // Rate limiting intelligent basé sur l'endpoint
 const createLimiter = (windowMs: number, max: number, message: string, skipSuccessful = false) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: message, retryAfter: Math.ceil(windowMs / 1000) },
    keyGenerator: (req: Request) => {
      const ip = req.ip || 'unknown';
      const ua = req.headers['user-agent'] || '';
      return securityManager.hashSensitiveData(ip + ua);
    },
    skip: (req) => req.path === '/api/health',
    skipSuccessfulRequests: skipSuccessful,
  });

// AJOUTER après la déclaration createLimiter :
const logRateLimit = (req: Request, max: number, windowMs: number) => {
  auditLogger.logEvent(
    'SECURITY_RATE_LIMIT',
    'Rate limit dépassé',
    {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
      success: false,
      details: {
        path: req.path,
        method: req.method,
        limit: max,
        window: windowMs,
      },
      severity: 'MEDIUM',
    }
  );
};

  // Auth routes : 5 tentatives / 15 min
  app.use('/api/auth/login', createLimiter(
    rateLimits.login.window, 
    rateLimits.login.max, 
    'Trop de tentatives de connexion, réessayez dans 15 minutes'
  ));
  
  // Register : 3 / heure
  app.use('/api/auth/register', createLimiter(
    60 * 60 * 1000, 
    3, 
    'Trop d\'inscriptions, réessayez dans 1 heure'
  ));

  // Routes crypto futures (très strict)
  app.use('/api/crypto/', createLimiter(
    rateLimits.crypto.window,
    rateLimits.crypto.max,
    'Limite crypto dépassée, réessayez plus tard'
  ));

  // Routes gaming (permissif)
  app.use('/api/game/', createLimiter(
    rateLimits.gaming.window,
    rateLimits.gaming.max,
    'Ralentissez vos actions de jeu',
    true // Skip successful requests pour gaming
  ));

  // API globale : 100 / 15 min
  app.use('/api/', createLimiter(
    15 * 60 * 1000, 
    100, 
    'Trop de requêtes API, réessayez plus tard'
  ));

  // 🕐 MARQUAGE TEMPOREL ET TRACKING
  app.use((req, _res, next) => {
    (req as any).requestTime = new Date().toISOString();
    (req as any).requestId = securityManager.generateSecureToken(8);
    next();
  });

  // 🔍 MIDDLEWARE DE DÉTECTION D'ACTIVITÉ SUSPECTE
  app.use((req, res, next) => {
    // Détecter les tentatives d'accès à des chemins suspects
    const suspiciousPaths = [
      '/admin', '/phpmyadmin', '/wp-admin', '/wp-login',
      '/.env', '/config', '/backup', '/dump',
      '/shell', '/cmd', '/exec', '/eval',
      '../', '..\\', '%2e%2e', '%252e%252e'
    ];

    const path = req.path.toLowerCase();
    const isSuspicious = suspiciousPaths.some(sp => path.includes(sp));

    if (isSuspicious) {
      auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Tentative d\'accès à un chemin suspect',
        {
          ip: req.ip || 'unknown',
          userAgent: req.headers['user-agent'],
          success: false,
          details: {
            path: req.path,
            method: req.method,
            query: req.query,
            suspiciousPattern: suspiciousPaths.find(sp => path.includes(sp)),
          },
          severity: 'HIGH',
        }
      );
      
      return res.status(404).json({ error: 'Not found' });
    }

    next();
  });

  console.log('✅ Middlewares de sécurité crypto-grade configurés');
};
