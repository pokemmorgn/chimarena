// server/src/server.ts - SERVEUR COMPLET AVEC COLYSEUS INTÉGRÉ
import express, { Request, Response, NextFunction } from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 🎮 COLYSEUS IMPORTS
import { Server as ColyseusServer } from "@colyseus/core";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";

// 🔧 SYSTÈME DE CONFIGURATION
import { configManager } from './config/ConfigManager';
import { logger } from './utils/Logger';

// DB
import { connectDatabase } from './config/database';

// 🌍 COLYSEUS ROOMS
import { WorldRoom } from './rooms/WorldRoom';

const app = express();

// 🎮 VARIABLES GLOBALES COLYSEUS
let httpServer: http.Server;
let httpsServer: https.Server | null = null;
let gameServer: ColyseusServer;

/**
 * 🚀 INITIALISATION COMPLÈTE DU SERVEUR AVEC COLYSEUS
 */
async function initializeServer() {
  try {
    console.log('🎮 Démarrage ChimArena Server avec Colyseus...');

    // 1) CONFIG D'ABORD
    logger.general.info('🔧 Initialisation du système de configuration...');
    await configManager.initialize();

    // 2) ENV
    await validateEnvironment();

    // 3) CONFIG COURANTE
    const config = getServerConfig();
    logger.general.info('⚙️ Configuration serveur chargée', {
      environment: config.environment,
      debug: config.debug,
      maintenance: config.maintenance,
      cryptoEnabled: config.crypto.enabled,
      colyseusEnabled: config.colyseus.enabled, // ✅ NOUVEAU
    });

    // 4) MIDDLEWARES
    logger.general.info('🛡️ Configuration des middlewares de sécurité...');
    await setupSecureMiddlewares(app, config);

    // 5) DB
    logger.database.info('🗄️ Connexion à la base de données...');
    await connectDatabase();
    logger.database.info('✅ Base de données connectée');

    // 6) 🎮 COLYSEUS SETUP (AVANT LES ROUTES)
    if (config.colyseus.enabled) {
      logger.general.info('🎮 Configuration de Colyseus...');
      await setupColyseus(app, config);
    }

    // 7) ROUTES (APRÈS INIT) — imports dynamiques
    logger.general.info('🛣️ Configuration des routes...');
    await setupRoutes(app, config);

    // 8) ERRORS
    setupErrorHandling(app, config);

    // 9) SERVERS
    logger.general.info('🌐 Démarrage des serveurs web...');
    await startWebServers(app, config);

    // 10) HOOKS + MONITORING
    setupConfigurationHooks();
    setupMonitoring(config);

    logger.general.info('🚀 ChimArena Server démarré avec succès !', {
      pid: process.pid,
      memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      nodeVersion: process.version,
      colyseusPort: config.colyseus.port,
    });
  } catch (error: any) {
    logger.general.error('❌ Erreur critique lors de l\'initialisation', {
      error: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
    await gracefulShutdown();
    process.exit(1);
  }
}

/**
 * 🎮 CONFIGURATION COLYSEUS COMPLÈTE
 */
async function setupColyseus(app: express.Application, config: any): Promise<void> {
  try {
    console.log('🎮 Initialisation de Colyseus...');
    
    // Créer le serveur HTTP d'abord (pour Colyseus)
    httpServer = http.createServer(app);
    
    // Créer le serveur Colyseus
    gameServer = new ColyseusServer({
      server: httpServer,
    });

    // 🌍 ENREGISTRER LES ROOMS
    console.log('🌍 Enregistrement de la WorldRoom...');
    gameServer.define("world", WorldRoom);
    
    logger.general.info('🎮 WorldRoom enregistrée', {
      roomName: 'world',
      roomClass: 'WorldRoom'
    });

    // 📊 MONITOR COLYSEUS (en développement)
    if (config.environment !== 'production' && config.colyseus.monitor) {
      app.use("/colyseus", monitor());
      app.use("/playground", playground);
      
      console.log(`📊 Monitor Colyseus: http://localhost:${config.port}/colyseus`);
      console.log(`🎮 Playground Colyseus: http://localhost:${config.port}/playground`);
      
      logger.general.info('📊 Outils de développement Colyseus activés', {
        monitor: `http://localhost:${config.port}/colyseus`,
        playground: `http://localhost:${config.port}/playground`
      });
    }

    // ✅ DÉMARRER LE SERVEUR COLYSEUS
    console.log(`🎮 Démarrage du serveur Colyseus sur le port ${config.colyseus.port}...`);
    
    await new Promise<void>((resolve, reject) => {
      try {
        // Colyseus listen() prend seulement le port, pas de callback ni host
        gameServer.listen(config.colyseus.port);
        
        console.log(`✅ Serveur Colyseus démarré sur ${config.host}:${config.colyseus.port}`);
        logger.general.info('🎮 Serveur Colyseus opérationnel', {
          port: config.colyseus.port,
          host: config.host,
          wsUrl: `ws://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.colyseus.port}`,
          rooms: ['world']
        });
        resolve();
      } catch (error) {
        reject(error);
      }
    });

  } catch (error: any) {
    logger.general.error('❌ Erreur configuration Colyseus', {
      error: (error as Error)?.message,
      stack: (error as Error)?.stack
    });
    throw error;
  }
}

/**
 * 🔍 VALIDATION ENV - AVEC COLYSEUS
 */
async function validateEnvironment(): Promise<void> {
  logger.general.info('🔍 Validation de l\'environnement...');
  
  // ✅ UTILISER LES BONNES VARIABLES JWT
  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Variables d'environnement manquantes: ${missing.join(', ')}`);

  // ✅ VÉRIFIER LA LONGUEUR DES BONS SECRETS
  if (process.env.JWT_ACCESS_SECRET!.length < 32) {
    throw new Error('JWT_ACCESS_SECRET doit contenir au moins 32 caractères');
  }
  
  if (process.env.JWT_REFRESH_SECRET!.length < 32) {
    throw new Error('JWT_REFRESH_SECRET doit contenir au moins 32 caractères');
  }

  const env = configManager.get('app.env');
  if (env === 'production') {
    logger.security.info('🔒 Mode production - Vérifications de sécurité renforcées');
    if (!fs.existsSync('/etc/letsencrypt/live')) {
      logger.security.warn('⚠️ Certificats HTTPS non trouvés en production');
    }
  }
  logger.general.info('✅ Environnement validé');
}

/**
 * ⚙️ CONFIG COURANTE AVEC COLYSEUS
 */
function getServerConfig() {
  return {
    environment: configManager.get('app.env'),
    debug: configManager.isDebug(),
    maintenance: configManager.isMaintenanceMode(),

    // Server
    port: configManager.get('server.port'),
    httpsPort: configManager.get('server.httpsPort'),
    host: configManager.get('server.host'),
    corsOrigins: configManager.get('server.corsOrigins'),

    // 🎮 COLYSEUS CONFIG
    colyseus: {
      enabled: process.env.COLYSEUS_ENABLED !== 'false', // Activé par défaut
      port: Number(process.env.COLYSEUS_PORT) || 2567,
      monitor: process.env.COLYSEUS_MONITOR !== 'false', // Activé en dev
    },

    // Features
    crypto: {
      enabled: configManager.get('crypto.enabled'),
      metamask: configManager.get('crypto.metamask.enabled'),
    },
    features: {
      registration: configManager.isFeatureEnabled('registration'),
      devTools: configManager.isFeatureEnabled('devTools'),
      adminPanel: configManager.isFeatureEnabled('adminPanel'),
    },

    // Perf
    performance: {
      compression: configManager.get('performance.enableCompression'),
      caching: configManager.get('performance.enableCaching'),
      maxRequestSize: configManager.get('performance.maxRequestSize'),
    },
  };
}

/**
 * 🛡️ MIDDLEWARES (inchangé)
 */
async function setupSecureMiddlewares(app: express.Application, config: any): Promise<void> {
  app.set('trust proxy', 1);

  const helmet = require('helmet');
  app.use(
    helmet({
      contentSecurityPolicy: config.debug
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com'],
              imgSrc: ["'self'", 'data:', 'https:'],
              scriptSrc: ["'self'"],
              connectSrc: ["'self'", 'wss:', 'https:'], // ✅ WSS pour Colyseus
            },
          },
      crossOriginEmbedderPolicy: false,
      hsts: config.environment === 'production',
    }),
  );

  const morgan = require('morgan');
  if (configManager.isLogModuleEnabled('api')) {
    const format = config.environment === 'production' ? 'combined' : 'dev';
    app.use(
      morgan(format, {
        stream: {
          write: (message: string) => {
            const trimmed = message.trim();
            if (configManager.get('logging.modules.api.logRequests', false)) {
              logger.api.info('HTTP Request', { request: trimmed });
            }
          },
        },
        skip: (req: Request) => req.path === '/health' || req.path.startsWith('/static') || req.path.startsWith('/colyseus'),
      }),
    );
  }

  if (config.performance.compression) {
    const compression = require('compression');
    app.use(
      compression({
        filter: (req: Request, res: Response) => {
          if (req.headers['x-no-compression']) return false;
          return compression.filter(req, res);
        },
        threshold: 1024,
      }),
    );
  }

  app.use(
    express.json({
      limit: config.performance.maxRequestSize,
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: config.performance.maxRequestSize }));

  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  await setupCORS(app, config);
  await setupRateLimiting(app);

  if (config.environment === 'production') {
    setupHTTPSRedirection(app);
  }
}

/**
 * 🌐 CORS AVEC COLYSEUS
 */
async function setupCORS(app: express.Application, config: any): Promise<void> {
  const cors = require('cors');

  app.use(
    cors({
      origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.security.warn('CORS bloqué', { origin, allowedOrigins: config.corsOrigins.length });
          callback(new Error('CORS non autorisé'), false);
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
      optionsSuccessStatus: 200,
      maxAge: 86400,
    }),
  );
}

/**
 * 🚫 RATE LIMITING (inchangé)
 */
async function setupRateLimiting(app: express.Application): Promise<void> {
  const rateLimit = require('express-rate-limit');
  const rateLimits = configManager.get('security.rateLimits');
  const limiters: Record<string, any> = {};

  Object.entries(rateLimits).forEach(([name, cfg]: [string, any]) => {
    limiters[name] = rateLimit({
      windowMs: cfg.windowMs,
      max: cfg.max,
      message: {
        error: cfg.message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil(cfg.windowMs / 1000),
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req: Request, res: Response) => {
        const userLogger = logger.withRequest(req.headers['x-request-id'] as string, req.ip, req.get('User-Agent'));
        userLogger.security.warn('Rate limit atteint', {
          limiter: name,
          userId: (req as any).user?.id,
          path: req.path,
          method: req.method,
        });
        res.status(429).json({
          error: cfg.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil(cfg.windowMs / 1000),
        });
      },
      skip: (req: Request) => req.path === '/health',
    });
  });

  app.use('/api/auth/login', limiters.auth);
  app.use('/api/auth/register', limiters.registration);
  app.use('/api/crypto/', limiters.crypto);
  app.use('/api/', limiters.api);
}

/**
 * 🔒 REDIRECT HTTPS (inchangé)
 */
function setupHTTPSRedirection(app: express.Application): void {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https' && !req.path.startsWith('/health')) {
      const httpsUrl = `https://${req.get('host')}${req.url}`;
      return res.redirect(301, httpsUrl);
    }
    next();
  });
}

/**
 * 🛣️ ROUTES AVEC INFO COLYSEUS
 */
async function setupRoutes(app: express.Application, config: any): Promise<void> {
  // Request ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = (req.headers['x-request-id'] as string) || Math.random().toString(36).slice(2);
    (req as any).requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Health avec info Colyseus
  const healthPath = configManager.get('monitoring.healthCheck.path', '/health');
  app.get(healthPath, (req, res) => {
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: configManager.get('app.name'),
      version: configManager.get('app.version'),
      environment: config.environment,
      maintenance: config.maintenance,
      uptime: process.uptime(),
      // ✅ INFO COLYSEUS
      colyseus: config.colyseus.enabled ? {
        enabled: true,
        port: config.colyseus.port,
        wsUrl: `ws://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.colyseus.port}`,
        rooms: ['world'],
        monitor: config.environment !== 'production' ? `http://localhost:${config.port}/colyseus` : null
      } : { enabled: false }
    });
  });

  // === Imports dynamiques SÉCURISÉS ===
  try {
    console.log('🛣️ Chargement des routes...');
    
    // Auth routes
    try {
      const authMod = await import('./routes/authRoutes');
      const authRouter = authMod.default;
      
      app.use('/api/auth', (req, res, next) => {
        if (configManager.isLogModuleEnabled('auth')) {
          logger.auth.withRequest((req as any).requestId, req.ip, req.get('User-Agent')).debug('Route auth', {
            method: req.method,
            path: req.path,
          });
        }
        next();
      }, authRouter);
      
      console.log('✅ Routes auth chargées');
    } catch (error) {
      console.error('❌ Erreur chargement routes auth:', (error as Error)?.message);
    }

    // User routes
    try {
      const userMod = await import('./routes/userRoutes');
      const userRouter = userMod.default;      
      app.use('/api/user', (req, res, next) => {
        if (configManager.isLogModuleEnabled('api')) {
          logger.api.withRequest((req as any).requestId, req.ip, req.get('User-Agent')).debug('Route user', {
            method: req.method,
            path: req.path,
          });
        }
        next();
      }, userRouter);
      
      console.log('✅ Routes user chargées');
    } catch (error) {
      console.error('❌ Erreur chargement routes user:', (error as Error)?.message);
    }

    // Crypto routes (conditionnel)
    if (config.crypto.enabled) {
      try {
        const cryptoMod = await import('./routes/cryptoRoutes');
        const cryptoRouter = cryptoMod.default;        
        app.use('/api/crypto', (req, res, next) => {
          if (configManager.isLogModuleEnabled('crypto')) {
            logger.crypto.withRequest((req as any).requestId, req.ip, req.get('User-Agent')).debug('Route crypto', {
              method: req.method,
              path: req.path,
            });
          }
          next();
        }, cryptoRouter);
        
        console.log('✅ Routes crypto chargées');
        logger.crypto.info('✅ Routes crypto activées', { metamask: config.crypto.metamask });
      } catch (error) {
        console.error('❌ Erreur chargement routes crypto:', (error as Error)?.message);
      }
    } else {
      app.use('/api/crypto/*', (req, res) =>
        res.status(503).json({ error: 'Fonctionnalités crypto temporairement désactivées', enabled: false }),
      );
    }

  } catch (error) {
    console.error('❌ Erreur critique lors du chargement des routes:', (error as Error)?.message);
    // Ne pas faire planter le serveur, continuer avec les routes de base
  }

  // Dev tools config API
  if (config.features.devTools) {
    setupConfigAPI(app);
  }

  // Static files
  setupStaticFiles(app, config);

  // 404 API
  app.use('/api/*', (req, res) => {
    logger.api.warn('Route API 404', {
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    res.status(404).json({ error: 'Route API non trouvée', path: req.originalUrl });
  });

  // SPA fallback
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) return;
    const staticPath = path.join(__dirname, configManager.get('server.staticFiles.path', '../../client/dist'));
    const indexPath = path.join(staticPath, 'index.html');
    if (fs.existsSync(indexPath)) res.sendFile(indexPath);
    else res.status(404).json({ error: 'Application non trouvée' });
  });
  
  console.log('✅ Configuration des routes terminée');
}

/**
 * 🔧 API CONFIG (dev tools) - AVEC INFO COLYSEUS
 */
function setupConfigAPI(app: express.Application): void {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({
      success: true,
      config: configManager.getAll(),
      meta: {
        debug: configManager.isDebug(),
        maintenance: configManager.isMaintenanceMode(),
        backups: configManager.getBackups().length,
      },
      // ✅ INFO COLYSEUS
      colyseus: gameServer ? {
        enabled: true,
        rooms: ['world'],
        stats: {
          // Vous pouvez ajouter des stats ici
        }
      } : { enabled: false }
    });
  });

  router.post('/reload', async (req, res) => {
    try {
      await configManager.reload();
      res.json({ success: true, message: 'Configuration rechargée avec succès', timestamp: new Date().toISOString() });
    } catch (error: any) {
      res.status(500).json({ success: false, message: (error as Error)?.message });
    }
  });

  router.get('/backups', (req, res) => {
    const backups = configManager.getBackups().map((b) => ({
      timestamp: b.timestamp,
      reason: b.reason,
      version: b.version,
    }));
    res.json({ success: true, backups });
  });

  app.use('/api/config', router);
}

/**
 * 📁 STATIC (inchangé)
 */
function setupStaticFiles(app: express.Application, config: any): void {
  if (config.environment === 'production' && configManager.get('server.staticFiles.enabled', true)) {
    const staticPath = path.join(__dirname, configManager.get('server.staticFiles.path'));
    if (fs.existsSync(staticPath)) {
      app.use(
        express.static(staticPath, {
          maxAge: configManager.get('server.staticFiles.maxAge', '1y'),
          etag: true,
          lastModified: true,
          immutable: true,
          cacheControl: true,
        }),
      );
      logger.general.info('📁 Fichiers statiques configurés', { path: staticPath });
    } else {
      logger.general.warn('⚠️ Répertoire statique non trouvé', { path: staticPath });
    }
  }
}

/**
 * 🚨 ERRORS (inchangé)
 */
function setupErrorHandling(app: express.Application, config: any): void {
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const isDev = config.debug;
    const requestId = (req as any).requestId;
    logger.general.error('Erreur serveur', {
      error: (err as Error)?.message,
      stack: isDev ? (err as Error)?.stack : undefined,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId,
      userId: (req as any).user?.id,
    });

    res.status(err.status || 500).json({
      error: isDev ? (err as Error)?.message : 'Erreur interne du serveur',
      code: err.code || 'INTERNAL_ERROR',
      requestId,
      timestamp: new Date().toISOString(),
      ...(isDev && { stack: (err as Error)?.stack, details: err.details }),
    });
  });

  process.on('unhandledRejection', (reason: any) => {
    logger.general.error('Promesse rejetée non gérée', {
      reason: (reason as Error)?.message || reason,
      stack: (reason as Error)?.stack,
    });
  });

  process.on('uncaughtException', (err: Error) => {
    logger.general.error('Exception non capturée', {
      error: (err as Error)?.message,
      stack: (err as Error)?.stack,
    });
    gracefulShutdown().then(() => process.exit(1));
  });
}

/**
 * 🌐 SERVEURS MODIFIÉS POUR COLYSEUS
 */
async function startWebServers(app: express.Application, config: any): Promise<void> {
  const tasks: Promise<void>[] = [];
  
  if (config.environment === 'production') {
    const httpsServerInstance = createHTTPSServer(app);
    if (httpsServerInstance) {
      httpsServer = httpsServerInstance;
      tasks.push(
        new Promise((resolve) => {
          httpsServer!.listen(config.httpsPort, () => {
            logger.general.info('🔐 Serveur HTTPS démarré', {
              port: config.httpsPort,
              host: config.host,
              url: `https://chimarena.cloud`,
            });
            resolve();
          });
        }),
      );
    }
    
    // Serveur HTTP pour redirection (séparé de Colyseus)
    tasks.push(
      new Promise((resolve) => {
        const redirectServer = http.createServer(app);
        redirectServer.listen(80, () => {
          logger.general.info('🔄 Serveur HTTP (redirection) démarré', { port: 80 });
          resolve();
        });
      }),
    );
  } else {
    // En développement, le serveur HTTP principal est déjà créé pour Colyseus
    // On démarre juste le serveur Express normal sur un autre port
    tasks.push(
      new Promise((resolve) => {
        const expressServer = http.createServer(app);
        expressServer.listen(config.port, config.host, () => {
          logger.general.info('🚀 Serveur Express démarré', {
            port: config.port,
            host: config.host,
            url: `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`,
            debug: config.debug,
          });
          resolve();
        });
      }),
    );
  }
  
  await Promise.all(tasks);
}

/**
 * 🔐 HTTPS (inchangé)
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
      ca: fs.readFileSync(path.join(sslPath, 'chain.pem'), 'utf8'),
    };
    logger.security.info('🔐 Certificats SSL chargés avec succès');
    return https.createServer(credentials, app);
  } catch (error: any) {
    logger.security.error('❌ Erreur chargement certificats SSL', { error: (error as Error)?.message });
    return null;
  }
}

/**
 * 🔄 HOOKS CONFIG (inchangé)
 */
function setupConfigurationHooks(): void {
  configManager.on('configChanged', (change) => {
    logger.general.info('🔄 Configuration modifiée', {
      source: change.source,
      path: change.path || 'global',
      timestamp: change.timestamp,
      userId: change.userId,
      ip: change.ip,
    });
  });
}

/**
 * 📊 MONITORING (inchangé)
 */
function setupMonitoring(config: any): void {
  if (!configManager.get('monitoring.enabled', false)) return;
  const interval = configManager.get('monitoring.metrics.collectInterval', 60000);
  setInterval(() => {
    const mem = process.memoryUsage();
    const percent = Math.round((mem.heapUsed / mem.heapTotal) * 100);
    logger.performance.debug('Métriques système', {
      memory: {
        used: Math.round(mem.heapUsed / 1024 / 1024),
        total: Math.round(mem.heapTotal / 1024 / 1024),
        percent,
      },
      uptime: Math.round(process.uptime()),
      pid: process.pid,
    });
  }, interval);
}

/**
 * 🛑 ARRÊT PROPRE AVEC COLYSEUS
 */
async function gracefulShutdown(): Promise<void> {
  logger.general.info('🛑 Arrêt propre du serveur en cours...');
  try {
    // Arrêter Colyseus en premier
    if (gameServer) {
      console.log('🎮 Arrêt du serveur Colyseus...');
      await gameServer.gracefullyShutdown();
      logger.general.info('✅ Serveur Colyseus arrêté');
    }
    
    // Arrêter les serveurs HTTP
    if (httpServer) {
      httpServer.close();
      logger.general.info('✅ Serveur HTTP arrêté');
    }
    
    if (httpsServer) {
      httpsServer.close();
      logger.general.info('✅ Serveur HTTPS arrêté');
    }
    
    // Fermer la configuration
    configManager.close();
    logger.general.info('✅ Arrêt propre terminé');
  } catch (error: any) {
    logger.general.error('❌ Erreur lors de l\'arrêt propre', { error: (error as Error)?.message });
  }
}

// 🎯 SIGNAUX
process.on('SIGTERM', () => {
  logger.general.info('📨 Signal SIGTERM reçu');
  gracefulShutdown().then(() => process.exit(0));
});
process.on('SIGINT', () => {
  logger.general.info('📨 Signal SIGINT reçu');
  gracefulShutdown().then(() => process.exit(0));
});

// 🚀 START
if (require.main === module) {
  initializeServer().catch((error: any) => {
    console.error('❌ Erreur fatale lors du démarrage:', (error as Error)?.message);
    process.exit(1);
  });
}

export default app;
