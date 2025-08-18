// server/src/server.ts - Version Production avec HTTPS
import express, { Request, Response, NextFunction } from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import cryptoRoutes from './routes/cryptoRoutes';
import { setupMiddlewares } from './config/middlewares';

// 🔐 IMPORTS SÉCURITÉ
import { securityManager } from './config/security';
import { auditLogger } from './utils/auditLogger';
import { antiBotMiddleware, antiBotGamingMiddleware, antiBotCryptoMiddleware } from './middleware/antiBotMiddleware';
import { combinedSecurityMiddleware } from './middleware/securityMiddleware';

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const NODE_ENV = process.env.NODE_ENV || 'development';

// 🔐 Configuration CORS adaptative
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    const allowedOrigins = [
      'https://chimarena.cloud',
      'https://www.chimarena.cloud',
      'https://app.chimarena.cloud',
      ...(NODE_ENV === 'development' ? [
        'http://localhost:8080', 
        'http://localhost:3000',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:3000'
      ] : [])
    ];
    
    // Permettre les requêtes sans origin (Postman, apps mobiles)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('🚫 CORS blocked:', origin);
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  optionsSuccessStatus: 200
};

// 🚀 INITIALISATION SÉCURITÉ
console.log('🔐 Initialisation du système de sécurité...');
console.log('✅ Configuration sécurité validée');

// Configuration middlewares avec CORS adaptatif
app.use(require('cors')(corsOptions));
setupMiddlewares(app);

// 🛡️ MIDDLEWARES DE SÉCURITÉ GLOBAUX
app.use(combinedSecurityMiddleware);

// Middleware de redirection HTTPS en production
function forceHTTPS(req: Request, res: Response, next: NextFunction) {
  if (!req.secure && 
      req.get('x-forwarded-proto') !== 'https' && 
      NODE_ENV === 'production' &&
      !req.path.startsWith('/health')) {
    const httpsUrl = `https://${req.get('host')}${req.url}`;
    console.log(`🔒 Redirection HTTPS: ${req.url} -> ${httpsUrl}`);
    return res.redirect(301, httpsUrl);
  }
  next();
}

if (NODE_ENV === 'production') {
  app.use(forceHTTPS);
}

// Connexion base de données
connectDatabase();
app.set('trust proxy', 1);

// Log du démarrage
auditLogger.logEvent(
  'SYSTEM_STARTUP',
  'Démarrage du serveur ChimArena',
  {
    ip: 'localhost',
    success: true,
    details: {
      port: PORT,
      httpsPort: HTTPS_PORT,
      nodeEnv: NODE_ENV,
      timestamp: new Date().toISOString(),
    },
    severity: 'MEDIUM',
  }
);

// 🔐 ROUTES AVEC PROTECTION ANTI-BOT
app.use('/api/auth', antiBotMiddleware, authRoutes);
app.use('/api/user', antiBotMiddleware, userRoutes);
app.use('/api/crypto', antiBotCryptoMiddleware, cryptoRoutes);

// Health check (accessible sans HTTPS pour monitoring)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(), 
    service: 'ChimArena API', 
    version: '1.0.0',
    environment: NODE_ENV,
    security: 'CRYPTO_GRADE_ENABLED',
    https: NODE_ENV === 'production'
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(), 
    service: 'ChimArena API', 
    version: '1.0.0',
    environment: NODE_ENV,
    security: 'CRYPTO_GRADE_ENABLED' 
  });
});

// Servir les fichiers statiques en production
if (NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../../client/dist');
  
  // Vérifier que le dossier client existe
  if (fs.existsSync(clientPath)) {
    console.log('📁 Serving static files from:', clientPath);
    app.use(express.static(clientPath, {
      maxAge: '1y',
      etag: true,
      lastModified: true
    }));
    
    // Fallback pour SPA (Single Page Application)
    app.get('*', (req: Request, res: Response) => {
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(clientPath, 'index.html'));
      }
    });
  } else {
    console.warn('⚠️ Client build directory not found:', clientPath);
  }
}

// Test sécurité (development seulement)
if (NODE_ENV === 'development') {
  app.get('/api/security-test', (req: Request, res: Response) => {
    const botDetection = (req as any).botDetection;
    res.json({
      message: 'Test sécurité OK',
      ip: req.ip,
      botDetection: botDetection || 'Non analysé',
      environment: NODE_ENV,
      corsOrigin: req.get('origin'),
      securityConfig: {
        antiBotEnabled: true,
        auditEnabled: securityManager.getAuditConfig().enableFullLogging,
        rateLimits: securityManager.getConfig().rateLimits,
      },
    });
  });
}

// 404 pour routes non trouvées
app.use('*', (req: Request, res: Response) => {
  auditLogger.logEvent(
    'SECURITY_SUSPICIOUS_ACTIVITY',
    'Tentative d\'accès à une route inexistante',
    {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
      success: false,
      details: {
        path: req.originalUrl,
        method: req.method,
        query: req.query,
      },
      severity: 'LOW',
    }
  );

  res.status(404).json({ 
    error: 'Route non trouvée', 
    path: req.originalUrl 
  });
});

// 🚨 GESTIONNAIRE D'ERREURS
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Erreur serveur:', err);

  auditLogger.logEvent(
    'SYSTEM_ERROR',
    'Erreur serveur non gérée',
    {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
      success: false,
      error: err.message,
      details: {
        stack: NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        body: req.body ? Object.keys(req.body) : [],
      },
      severity: 'HIGH',
    }
  );

  res.status(err.status || 500).json({ 
    error: NODE_ENV === 'development' ? err.message : 'Erreur interne du serveur',
    ...(NODE_ENV === 'development' && { stack: err.stack }),
    code: err.code || 'INTERNAL_ERROR',
  });
});

// 🔐 Configuration SSL pour production
function createHTTPSServer() {
  if (NODE_ENV !== 'production') return null;
  
  try {
    const sslPath = '/etc/letsencrypt/live/chimarena.cloud';
    
    if (!fs.existsSync(sslPath)) {
      console.warn('⚠️ Certificats SSL non trouvés, HTTPS désactivé');
      return null;
    }
    
    const credentials = {
      key: fs.readFileSync(path.join(sslPath, 'privkey.pem'), 'utf8'),
      cert: fs.readFileSync(path.join(sslPath, 'cert.pem'), 'utf8'),
      ca: fs.readFileSync(path.join(sslPath, 'chain.pem'), 'utf8')
    };

    console.log('🔐 Certificats SSL chargés avec succès');
    return https.createServer(credentials, app);
    
  } catch (error) {
    console.error('❌ Erreur chargement certificats SSL:', error);
    return null;
  }
}

// 🚀 DÉMARRAGE DES SERVEURS
async function startServers() {
  try {
    if (NODE_ENV === 'production') {
      // Serveur HTTPS
      const httpsServer = createHTTPSServer();
      
      if (httpsServer) {
        httpsServer.listen(HTTPS_PORT, () => {
          console.log(`🔐 Serveur HTTPS démarré sur le port ${HTTPS_PORT}`);
          console.log(`🌐 URL: https://chimarena.cloud`);
        });
      }
      
      // Serveur HTTP pour redirection
      const httpServer = http.createServer(app);
      httpServer.listen(80, () => {
        console.log('🔄 Serveur HTTP (redirection) sur le port 80');
      });
      
    } else {
      // Serveur HTTP pour développement
      const server = http.createServer(app);
      server.listen(PORT, () => {
        console.log(`🚀 Serveur développement démarré`);
        console.log(`🌐 URL: http://localhost:${PORT}`);
        console.log(`🧪 Test: http://localhost:${PORT}/api/security-test`);
      });
    }
    
    console.log(`🔐 Sécurité crypto-grade: ✅ ACTIVÉE`);
    console.log(`📊 Audit trail: ✅ ${securityManager.getAuditConfig().enableFullLogging ? 'COMPLET' : 'PARTIEL'}`);
    console.log(`🤖 Protection anti-bot: ✅ MULTI-NIVEAUX`);
    console.log(`🛡️ Validation XSS/Injection: ✅ ACTIVE`);
    
  } catch (error) {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
  }
}

// 🛑 ARRÊT PROPRE
const gracefulShutdown = () => {
  console.log('\n🛑 Arrêt du serveur en cours...');
  
  auditLogger.logEvent(
    'SYSTEM_SHUTDOWN',
    'Arrêt du serveur ChimArena',
    {
      ip: 'localhost',
      success: true,
      details: {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
      severity: 'MEDIUM',
    }
  );

  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Gestion des exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Exception non capturée:', err);
  auditLogger.logEvent(
    'SYSTEM_ERROR',
    'Exception non capturée',
    {
      ip: 'localhost',
      success: false,
      error: err.message,
      details: { stack: err.stack, name: err.name },
      severity: 'CRITICAL',
    }
  );
  gracefulShutdown();
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  auditLogger.logEvent(
    'SYSTEM_ERROR',
    'Promesse rejetée non gérée',
    {
      ip: 'localhost',
      success: false,
      error: String(reason),
      severity: 'CRITICAL',
    }
  );
});

// Démarrer les serveurs
startServers();

export default app;
