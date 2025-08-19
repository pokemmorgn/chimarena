// server/src/server.ts - SERVEUR COMPLET CORRIGÉ (sans erreurs TypeScript)
import express, { Request, Response, NextFunction } from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Configuration système AVANT tout
dotenv.config();

// 🔧 SYSTÈME DE CONFIGURATION
import { configManager } from './config/ConfigManager';
import { logger } from './utils/Logger';

// Routes et middlewares
import { connectDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import cryptoRoutes from './routes/cryptoRoutes';

const app = express();

/**
 * 🚀 INITIALISATION COMPLÈTE DU SERVEUR
 * Ordre d'initialisation critique pour la sécurité
 */
async function initializeServer() {
  try {
    console.log('🎮 Démarrage ChimArena Server...');
    
    // 1️⃣ CONFIGURATION - PRIORITÉ ABSOLUE
    logger.general.info('🔧 Initialisation du système de configuration...');
    await configManager.initialize();
    
    // 2️⃣ VALIDATION ENVIRONNEMENT
    await validateEnvironment();
    
    // 3️⃣ CONFIGURATION ADAPTATIVE
    const config = getServerConfig();
    logger.general.info('⚙️ Configuration serveur chargée', {
      environment: config.environment,
      debug: config.debug,
      maintenance: config.maintenance,
      cryptoEnabled: config.crypto.enabled
    });
    
    // 4️⃣ MIDDLEWARES SÉCURISÉS
    logger.general.info('🛡️ Configuration des middlewares de sécurité...');
    await setupSecureMiddlewares(app, config);
    
    // 5️⃣ BASE DE DONNÉES
    logger.database.info('🗄️ Connexion à la base de données...');
    await connectDatabase();
    logger.database.info('✅ Base de données connectée');
    
    // 6️⃣ ROUTES AVEC LOGS
    logger.general.info('🛣️ Configuration des routes...');
    setupRoutes(app, config);
    
    // 7️⃣ GESTION D'ERREURS
    setupErrorHandling(app, config);
    
    // 8️⃣ SERVEURS HTTP/HTTPS
    logger.general.info('🌐 Démarrage des serveurs web...');
    await startWebServers(app, config);
    
    // 9️⃣ HOOKS ET MONITORING
    setupConfigurationHooks();
    setupMonitoring(config);
    
    // 🔟 FINALISATION
    logger.general.info('🚀 ChimArena Server démarré avec succès !', {
      pid: process.pid,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      nodeVersion: process.version
    });
    
  } catch (error: any) {
    logger.general.error('❌ Erreur critique lors de l\'initialisation', {
      error: (error as Error)?.message,
      stack: (error as Error)?.stack
    });
    
    // Arrêt propre en cas d'erreur critique
    await gracefulShutdown();
    process.exit(1);
  }
}

/**
 * 🔍 VALIDATION DE L'ENVIRONNEMENT
 */
async function validateEnvironment(): Promise<void> {
  logger.general.info('🔍 Validation de l\'environnement...');
  
  // Variables d'environnement critiques
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes: ${missing.join(', ')}`);
  }
  
  // Validation JWT_SECRET
  if (process.env.JWT_SECRET!.length < 32) {
    throw new Error('JWT_SECRET doit contenir au moins 32 caractères');
  }
  
  // Validation selon environnement
  const env = configManager.get('app.env');
  if (env === 'production') {
    logger.security.info('🔒 Mode production - Vérifications de sécurité renforcées');
    
    // En production, vérifier HTTPS
    if (!fs.existsSync('/etc/letsencrypt/live')) {
      logger.security.warn('⚠️ Certificats HTTPS non trouvés en production');
    }
  }
  
  logger.general.info('✅ Environnement validé');
}

/**
 * ⚙️ OBTENIR LA CONFIGURATION SERVEUR
 */
function getServerConfig() {
  return {
    // App
    environment: configManager.get('app.env'),
    debug: configManager.isDebug(),
    maintenance: configManager.isMaintenanceMode(),
    
    // Server
    port: configManager.get('server.port'),
    httpsPort: configManager.get('server.httpsPort'),
    host: configManager.get('server.host'),
    corsOrigins: configManager.get('server.corsOrigins'),
    
    // Features
    crypto: {
      enabled: configManager.get('crypto.enabled'),
      metamask: configManager.get('crypto.metamask.enabled')
    },
    features: {
      registration: configManager.isFeatureEnabled('registration'),
      devTools: configManager.isFeatureEnabled('devTools'),
      adminPanel: configManager.isFeatureEnabled('adminPanel')
    },
    
    // Performance
    performance: {
      compression: configManager.get('performance.enableCompression'),
      caching: configManager.get('performance.enableCaching'),
      maxRequestSize: configManager.get('performance.maxRequestSize')
    }
  };
}

/**
 * 🛡️ MIDDLEWARES SÉCURISÉS CONFIGURABLES
 */
async function setupSecureMiddlewares(app: express.Application, config: any): Promise<void> {
  // Trust proxy (critique pour rate limiting)
  app.set('trust proxy', 1);
  logger.security.debug('🔧 Trust proxy configuré');

  // Helmet - Sécurité de base
  const helmet = require('helmet');
  app.use(helmet({
    contentSecurityPolicy: config.debug ? false : {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "wss:", "https:"]
      }
    },
    crossOriginEmbedderPolicy: false,
    hsts: config.environment === 'production'
  }));
  logger.security.debug('🛡️ Helmet configuré', { 
    environment: config.environment,
    hsts: config.environment === 'production'
  });

  // Morgan - Logs HTTP configurables
  const morgan = require('morgan');
  if (configManager.isLogModuleEnabled('api')) {
    const format = config.environment === 'production' ? 'combined' : 'dev';
    app.use(morgan(format, {
      stream: {
        write: (message: string) => {
          const trimmed = message.trim();
          if (configManager.get('logging.modules.api.logRequests', false)) {
            logger.api.info('HTTP Request', { request: trimmed });
          }
        }
      },
      skip: (req: Request) => {
        // Skip health checks et static files
        return req.path === '/health' || req.path.startsWith('/static');
      }
    }));
    logger.api.debug('📝 Morgan HTTP logging activé');
  }

  // Compression si activée
  if (config.performance.compression) {
    const compression = require('compression');
    app.use(compression({
      filter: (req: Request, res: Response) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
      threshold: 1024 // Compresser seulement si > 1KB
    }));
    logger.performance.debug('🗜️ Compression activée');
  }

  // Body parsing avec limites configurées
  app.use(express.json({ 
    limit: config.performance.maxRequestSize,
    verify: (req: any, res, buf) => {
      req.rawBody = buf; // Garder le body brut pour vérifications crypto
    }
  }));
  app.use(express.urlencoded({ 
    extended: true, 
    limit: config.performance.maxRequestSize 
  }));
  logger.general.debug('📦 Body parsing configuré', { 
    maxSize: config.performance.maxRequestSize 
  });

  // Cookies
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  // CORS intelligent
  await setupCORS(app, config);

  // Rate limiting configuré
  await setupRateLimiting(app);

  // Redirection HTTPS en production
  if (config.environment === 'production') {
    setupHTTPSRedirection(app);
  }

  logger.general.info('✅ Middlewares sécurisés configurés');
}

/**
 * 🌐 CONFIGURATION CORS INTELLIGENTE
 */
async function setupCORS(app: express.Application, config: any): Promise<void> {
  const cors = require('cors');
  
  app.use(cors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Pas d'origin = requête directe (Postman, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Vérifier les origines autorisées
      if (config.corsOrigins.includes(origin)) {
        logger.api.debug('CORS autorisé', { origin });
        callback(null, true);
      } else {
        logger.security.warn('CORS bloqué', { 
          origin, 
          allowedOrigins: config.corsOrigins.length 
        });
        callback(new Error('CORS non autorisé'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With', 
      'X-API-Key',
      'X-Request-ID'
    ],
    exposedHeaders: ['X-Request-ID'],
    optionsSuccessStatus: 200,
    maxAge: 86400 // 24h cache for preflight
  }));

  logger.security.info('🌐 CORS configuré', { 
    originsCount: config.corsOrigins.length,
    environment: config.environment
  });
}

/**
 * 🚫 RATE LIMITING CONFIGURÉ
 */
async function setupRateLimiting(app: express.Application): Promise<void> {
  const rateLimit = require('express-rate-limit');
  
  // Créer les limiteurs depuis la configuration
  const rateLimits = configManager.get('security.rateLimits');
  const limiters: Record<string, any> = {};

  Object.entries(rateLimits).forEach(([name, config]: [string, any]) => {
    limiters[name] = rateLimit({
      windowMs: config.windowMs,
      max: config.max,
      message: { 
        error: config.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(config.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        const userLogger = logger.withRequest(req.headers['x-request-id'] as string, req.ip, req.get('User-Agent'));
        userLogger.security.warn('Rate limit atteint', {
          limiter: name,
          userId: (req as any).user?.id,
          path: req.path,
          method: req.method
        });
        
        res.status(429).json({
          error: config.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(config.windowMs / 1000)
        });
      },
      skip: (req: Request) => {
        // Skip pour les health checks
        return req.path === '/health';
      }
    });
  });

  // Appliquer les limiteurs
  app.use('/api/auth/login', limiters.auth);
  app.use('/api/auth/register', limiters.registration);
  app.use('/api/crypto/', limiters.crypto);
  app.use('/api/', limiters.api);

  logger.security.info('🚫 Rate limiting configuré', { 
    limiters: Object.keys(limiters) 
  });
}

/**
 * 🔒 REDIRECTION HTTPS
 */
function setupHTTPSRedirection(app: express.Application): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.secure && 
        req.get('x-forwarded-proto') !== 'https' && 
        !req.path.startsWith('/health')) {
      
      const httpsUrl = `https://${req.get('host')}${req.url}`;
      logger.security.debug('Redirection HTTPS', { 
        from: req.url, 
        to: httpsUrl,
        ip: req.ip
      });
      
      return res.redirect(301, httpsUrl);
    }
    next();
  });
  
  logger.security.info('🔒 Redirection HTTPS activée');
}

/**
 * 🛣️ CONFIGURATION DES ROUTES
 */
function setupRoutes(app: express.Application, config: any): void {
  // Middleware de Request ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] as string || 
                      Math.random().toString(36).substring(2, 15);
    (req as any).requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Health check configurable
  const healthPath = configManager.get('monitoring.healthCheck.path', '/health');
  app.get(healthPath, (req: Request, res: Response) => {
    const healthData = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: configManager.get('app.name'),
      version: configManager.get('app.version'),
      environment: config.environment,
      maintenance: config.maintenance,
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      },
      features: {
        crypto: config.crypto.enabled,
        registration: config.features.registration,
        maintenance: config.maintenance
      }
    };
    
    if (configManager.isLogModuleEnabled('api') && 
        configManager.get('logging.modules.api.logRequests', false)) {
      logger.api.debug('Health check', { ip: req.ip });
    }
    
    res.json(healthData);
  });

  // Mode maintenance global
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (config.maintenance && !req.path.startsWith(healthPath) && !req.path.startsWith('/api/admin')) {
      logger.general.info('Requête bloquée - Mode maintenance', { 
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(503).json({
        error: 'Service en maintenance',
        message: 'Le service ChimArena est temporairement indisponible pour maintenance programmée.',
        maintenance: true,
        estimatedDuration: '30 minutes'
      });
    }
    next();
  });

  // Routes API avec logging contextuel
  app.use('/api/auth', (req, res, next) => {
    if (configManager.isLogModuleEnabled('auth')) {
      logger.auth.withRequest((req as any).requestId, req.ip, req.get('User-Agent'))
           .debug('Route auth', { method: req.method, path: req.path });
    }
    next();
  }, authRoutes);

  app.use('/api/user', (req, res, next) => {
    if (configManager.isLogModuleEnabled('api')) {
      logger.api.withRequest((req as any).requestId, req.ip, req.get('User-Agent'))
           .debug('Route user', { method: req.method, path: req.path });
    }
    next();
  }, userRoutes);

  // Routes crypto conditionnelles
  if (config.crypto.enabled) {
    app.use('/api/crypto', (req, res, next) => {
      if (configManager.isLogModuleEnabled('crypto')) {
        logger.crypto.withRequest((req as any).requestId, req.ip, req.get('User-Agent'))
             .debug('Route crypto', { method: req.method, path: req.path });
      }
      next();
    }, cryptoRoutes);
    
    logger.crypto.info('✅ Routes crypto activées', { 
      metamask: config.crypto.metamask 
    });
  } else {
    // Route de fallback si crypto désactivé
    app.use('/api/crypto/*', (req: Request, res: Response) => {
      logger.crypto.warn('Route crypto désactivée', { 
        path: req.path,
        ip: req.ip 
      });
      
      res.status(503).json({
        error: 'Fonctionnalités crypto temporairement désactivées',
        enabled: false
      });
    });
    
    logger.crypto.warn('⚠️ Routes crypto désactivées par configuration');
  }

  // API de configuration pour dev tools
  if (config.features.devTools) {
    setupConfigAPI(app);
  }

  // Fichiers statiques en production
  setupStaticFiles(app, config);

  // 404 pour routes API non trouvées
  app.use('/api/*', (req: Request, res: Response) => {
    logger.api.warn('Route API 404', { 
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.status(404).json({
      error: 'Route API non trouvée',
      path: req.originalUrl,
      suggestion: 'Vérifiez la documentation API'
    });
  });

  // Catch-all pour SPA
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) return; // Déjà géré par le 404 API
    
    const staticPath = path.join(__dirname, configManager.get('server.staticFiles.path', '../../client/dist'));
    const indexPath = path.join(staticPath, 'index.html');
    
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ error: 'Application non trouvée' });
    }
  });

  logger.general.info('✅ Routes configurées', {
    cryptoEnabled: config.crypto.enabled,
    devToolsEnabled: config.features.devTools,
    maintenanceMode: config.maintenance
  });
}

/**
 * 🔧 API DE CONFIGURATION (dev tools)
 */
function setupConfigAPI(app: express.Application): void {
  const router = express.Router();

  // GET /api/config - Voir la configuration
  router.get('/', (req: Request, res: Response) => {
    logger.general.debug('Configuration consultée', { 
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    res.json({
      success: true,
      config: configManager.getAll(),
      meta: {
        debug: configManager.isDebug(),
        maintenance: configManager.isMaintenanceMode(),
        backups: configManager.getBackups().length
      }
    });
  });

  // POST /api/config/reload - Recharger la configuration
  router.post('/reload', async (req: Request, res: Response) => {
    try {
      await configManager.reload();
      
      logger.general.info('Configuration rechargée manuellement', { 
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({ 
        success: true, 
        message: 'Configuration rechargée avec succès',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      logger.general.error('Erreur rechargement configuration', { 
        error: (error as Error)?.message,
        ip: req.ip
      });
      
      res.status(500).json({ 
        success: false, 
        message: (error as Error)?.message
      });
    }
  });

  // GET /api/config/backups - Liste des backups
  router.get('/backups', (req: Request, res: Response) => {
    const backups = configManager.getBackups().map(backup => ({
      timestamp: backup.timestamp,
      reason: backup.reason,
      version: backup.version
    }));
    
    res.json({ success: true, backups });
  });

  app.use('/api/config', router);
  
  logger.general.info('🔧 API de configuration activée (dev tools)');
}

/**
 * 📁 FICHIERS STATIQUES
 */
function setupStaticFiles(app: express.Application, config: any): void {
  if (config.environment === 'production' && configManager.get('server.staticFiles.enabled', true)) {
    const staticPath = path.join(__dirname, configManager.get('server.staticFiles.path'));
    
    if (fs.existsSync(staticPath)) {
      app.use(express.static(staticPath, {
        maxAge: configManager.get('server.staticFiles.maxAge', '1y'),
        etag: true,
        lastModified: true,
        immutable: true,
        cacheControl: true
      }));
      
      logger.general.info('📁 Fichiers statiques configurés', { 
        path: staticPath,
        maxAge: configManager.get('server.staticFiles.maxAge')
      });
    } else {
      logger.general.warn('⚠️ Répertoire statique non trouvé', { path: staticPath });
    }
  }
}

/**
 * 🚨 GESTION D'ERREURS CONFIGURÉE
 */
function setupErrorHandling(app: express.Application, config: any): void {
  // Middleware de gestion d'erreurs
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const isDev = config.debug;
    const requestId = (req as any).requestId;
    
    // Log de l'erreur
    logger.general.error('Erreur serveur', {
      error: (err as Error)?.message,
      stack: isDev ? (err as Error)?.stack : undefined,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId,
      userId: (req as any).user?.id
    });

    // Réponse selon l'environnement
    const errorResponse = {
      error: isDev ? (err as Error)?.message : 'Erreur interne du serveur',
      code: err.code || 'INTERNAL_ERROR',
      requestId,
      timestamp: new Date().toISOString(),
      ...(isDev && { 
        stack: (err as Error)?.stack,
        details: err.details 
      })
    };

    res.status(err.status || 500).json(errorResponse);
  });

  // Gestion des promesses rejetées
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.general.error('Promesse rejetée non gérée', {
      reason: (reason as Error)?.message || reason,
      stack: (reason as Error)?.stack
    });
  });

  // Gestion des exceptions non capturées
  process.on('uncaughtException', (err: Error) => {
    logger.general.error('Exception non capturée', {
      error: (err as Error)?.message,
      stack: (err as Error)?.stack
    });
    
    // Arrêt propre en cas d'exception critique
    gracefulShutdown().then(() => process.exit(1));
  });

  logger.general.info('✅ Gestion d\'erreurs configurée');
}

/**
 * 🌐 DÉMARRAGE DES SERVEURS WEB
 */
async function startWebServers(app: express.Application, config: any): Promise<void> {
  const promises: Promise<void>[] = [];

  if (config.environment === 'production') {
    // HTTPS en production
    const httpsServer = createHTTPSServer(app);
    if (httpsServer) {
      promises.push(new Promise((resolve) => {
        httpsServer.listen(config.httpsPort, () => {
          logger.general.info('🔐 Serveur HTTPS démarré', {
            port: config.httpsPort,
            host: config.host,
            url: `https://chimarena.cloud`
          });
          resolve();
        });
      }));
    }

    // HTTP pour redirection
    promises.push(new Promise((resolve) => {
      const httpServer = http.createServer(app);
      httpServer.listen(80, () => {
        logger.general.info('🔄 Serveur HTTP (redirection) démarré', { port: 80 });
        resolve();
      });
    }));
  } else {
    // HTTP en développement
    promises.push(new Promise((resolve) => {
      const server = http.createServer(app);
      server.listen(config.port, config.host, () => {
        logger.general.info('🚀 Serveur développement démarré', {
          port: config.port,
          host: config.host,
          url: `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`,
          debug: config.debug
        });
        resolve();
      });
    }));
  }

  await Promise.all(promises);
}

/**
 * 🔐 CRÉATION SERVEUR HTTPS
 */
function createHTTPSServer(app: express.Application) {
  try {
    const sslPath = '/etc/letsencrypt/live/chimarena.cloud';
    
    if (!fs.existsSync(sslPath)) {
      logger.security.warn('⚠️ Certificats SSL non trouvés, HTTPS désactivé');
      return null;
    }
    
    const credentials = {
      key: fs.readFileSync(path.join(sslPath, 'privkey.pem'), 'utf8'),
      cert: fs.readFileSync(path.join(sslPath, 'cert.pem'), 'utf8'),
      ca: fs.readFileSync(path.join(sslPath, 'chain.pem'), 'utf8')
    };

    logger.security.info('🔐 Certificats SSL chargés avec succès');
    return https.createServer(credentials, app);
    
  } catch (error: any) {
    logger.security.error('❌ Erreur chargement certificats SSL', { 
      error: (error as Error)?.message
    });
    return null;
  }
}

/**
 * 🔄 HOOKS DE CONFIGURATION
 */
function setupConfigurationHooks(): void {
  configManager.on('configChanged', (change) => {
    logger.general.info('🔄 Configuration modifiée', {
      source: change.source,
      path: change.path || 'global',
      timestamp: change.timestamp,
      userId: change.userId,
      ip: change.ip
    });

    // Réactions spécifiques aux changements
    if (change.path?.startsWith('logging')) {
      logger.general.info('📝 Configuration logging mise à jour');
    }
    
    if (change.path?.startsWith('security.rateLimits')) {
      logger.security.warn('🚫 Limites de taux modifiées', { change });
    }
    
    if (change.path?.startsWith('features')) {
      logger.general.info('🎯 Features toggles mis à jour');
    }
    
    if (change.path === 'app.maintenance') {
      const isMaintenanceNow = configManager.isMaintenanceMode();
      logger.general.warn(`🔧 Mode maintenance ${isMaintenanceNow ? 'ACTIVÉ' : 'DÉSACTIVÉ'}`);
    }
  });

  logger.general.info('✅ Hooks de configuration configurés');
}

/**
 * 📊 MONITORING
 */
function setupMonitoring(config: any): void {
  if (!configManager.get('monitoring.enabled', false)) {
    return;
  }

  // Monitoring basique
  const interval = configManager.get('monitoring.metrics.collectInterval', 60000);
  
  setInterval(() => {
    const memory = process.memoryUsage();
    const memoryUsagePercent = Math.round((memory.heapUsed / memory.heapTotal) * 100);
    
    logger.performance.debug('Métriques système', {
      memory: {
        used: Math.round(memory.heapUsed / 1024 / 1024),
        total: Math.round(memory.heapTotal / 1024 / 1024),
        percent: memoryUsagePercent
      },
      uptime: Math.round(process.uptime()),
      pid: process.pid
    });
    
    // Alertes si configurées
    if (configManager.get('monitoring.alerts.enabled', false)) {
      const memoryThreshold = configManager.get('monitoring.alerts.memoryThreshold', 85);
      
      if (memoryUsagePercent > memoryThreshold) {
        logger.performance.warn('⚠️ Utilisation mémoire élevée', {
          current: memoryUsagePercent,
          threshold: memoryThreshold
        });
      }
    }
  }, interval);

  logger.general.info('📊 Monitoring activé', { 
    interval: `${interval / 1000}s`,
    alerts: configManager.get('monitoring.alerts.enabled', false)
  });
}

/**
 * 🛑 ARRÊT PROPRE
 */
async function gracefulShutdown(): Promise<void> {
  logger.general.info('🛑 Arrêt propre du serveur en cours...');
  
  try {
    // Fermer le gestionnaire de configuration
    configManager.close();
    
    // Autres nettoyages ici (fermer DB, WebSocket, etc.)
    
    logger.general.info('✅ Arrêt propre terminé');
  } catch (error: any) {
    logger.general.error('❌ Erreur lors de l\'arrêt propre', { 
      error: (error as Error)?.message
    });
  }
}

// 🎯 GESTION DES SIGNAUX SYSTÈME
process.on('SIGTERM', () => {
  logger.general.info('📨 Signal SIGTERM reçu');
  gracefulShutdown().then(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.general.info('📨 Signal SIGINT reçu');
  gracefulShutdown().then(() => process.exit(0));
});

// 🚀 DÉMARRAGE DU SERVEUR
if (require.main === module) {
  initializeServer().catch((error: any) => {
    console.error('❌ Erreur fatale lors du démarrage:', (error as Error)?.message);
    process.exit(1);
  });
}

export default app;
