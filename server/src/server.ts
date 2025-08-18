// server/src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase } from './config/database';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import { setupMiddlewares } from './config/middlewares';

// 🔐 NOUVEAUX IMPORTS SÉCURITÉ
import { securityManager } from './config/security';
import { auditLogger } from './utils/auditLogger';
import { antiBotMiddleware, antiBotGamingMiddleware, antiBotCryptoMiddleware } from './middleware/antiBotMiddleware';
import { combinedSecurityMiddleware } from './middleware/securityMiddleware';
import cryptoRoutes from './routes/cryptoRoutes'; // AJOUTER CETTE LIGNE

const app = express();
const PORT = process.env.PORT || 3000;

// 🚀 INITIALISATION SÉCURITÉ
console.log('🔐 Initialisation du système de sécurité...');

// Vérification de la configuration sécurité (auto-validé dans securityManager)
console.log('✅ Configuration sécurité validée');

// Log du démarrage du serveur
auditLogger.logEvent(
  'SYSTEM_STARTUP',
  'Démarrage du serveur ChimArena',
  {
    ip: 'localhost',
    success: true,
    details: {
      port: PORT,
      nodeEnv: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    },
    severity: 'MEDIUM',
  }
);

// Configuration middlewares de base
setupMiddlewares(app);

// 🛡️ MIDDLEWARES DE SÉCURITÉ GLOBAUX
app.use(combinedSecurityMiddleware);

// Connexion base de données
connectDatabase();
app.set('trust proxy', 1);

// 🔐 ROUTES AVEC PROTECTION ANTI-BOT ADAPTÉE

// Routes d'authentification (protection standard)
app.use('/api/auth', antiBotMiddleware, authRoutes);

// Routes utilisateur standard (protection standard)  
app.use('/api/user', antiBotMiddleware, userRoutes);

// 🎮 ROUTES GAMING (protection gaming-friendly) - À implémenter
// app.use('/api/game', antiBotGamingMiddleware, gameRoutes);
// app.use('/api/match', antiBotGamingMiddleware, matchRoutes);
// app.use('/api/deck', antiBotGamingMiddleware, deckRoutes);

// 💰 ROUTES CRYPTO (protection ultra-stricte) - ACTIVÉ
app.use('/api/crypto', antiBotCryptoMiddleware, cryptoRoutes);

// app.use('/api/wallet', antiBotCryptoMiddleware, walletRoutes);
// app.use('/api/withdrawal', antiBotCryptoMiddleware, withdrawalRoutes);

// 👑 ROUTES ADMIN (protection renforcée) - À implémenter
// app.use('/api/admin', antiBotMiddleware, adminRoutes);

// Health check (sans protection pour monitoring)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(), 
    service: 'ChimArena API', 
    version: '0.1.0',
    security: 'CRYPTO_GRADE_ENABLED' 
  });
});

// Route de test sécurité (development seulement)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/security-test', (req: Request, res: Response) => {
    const botDetection = (req as any).botDetection;
    res.json({
      message: 'Test sécurité OK',
      ip: req.ip,
      botDetection: botDetection || 'Non analysé',
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
  // Log des tentatives d'accès aux routes inexistantes
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

// 🚨 GESTIONNAIRE D'ERREURS AVEC AUDIT
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Erreur serveur:', err);

  // Log de l'erreur dans l'audit
  auditLogger.logEvent(
    'SYSTEM_ERROR',
    'Erreur serveur non gérée',
    {
      ip: req.ip || 'unknown',
      userAgent: req.headers['user-agent'],
      success: false,
      error: err.message,
      details: {
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        path: req.path,
        method: req.method,
        body: req.body ? Object.keys(req.body) : [],
      },
      severity: 'HIGH',
    }
  );

  const isDev = process.env.NODE_ENV === 'development';
  res.status(err.status || 500).json({ 
    error: isDev ? err.message : 'Erreur interne du serveur',
    ...(isDev && { stack: err.stack }),
    code: err.code || 'INTERNAL_ERROR',
  });
});

// 🚀 DÉMARRAGE SERVEUR
const server = app.listen(PORT, () => {
  console.log(`🚀 Serveur ChimArena démarré sur le port ${PORT}`);
  console.log(`🔐 Sécurité crypto-grade: ✅ ACTIVÉE`);
  console.log(`📊 Audit trail: ✅ ${securityManager.getAuditConfig().enableFullLogging ? 'COMPLET' : 'PARTIEL'}`);
  console.log(`🤖 Protection anti-bot: ✅ MULTI-NIVEAUX`);
  console.log(`🛡️ Validation XSS/Injection: ✅ ACTIVE`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🧪 Test sécurité: http://localhost:${PORT}/api/security-test`);
  }
});

// 🛑 ARRÊT PROPRE DU SERVEUR
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

  server.close(() => {
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });

  // Force l'arrêt après 10 secondes
  setTimeout(() => {
    console.error('❌ Arrêt forcé du serveur');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Gestion des exceptions non capturées
process.on('uncaughtException', (err) => {
  console.error('❌ Exception non capturée:', err);
  
  auditLogger.logEvent(
    'SYSTEM_ERROR',
    'Exception non capturée',
    {
      ip: 'localhost',
      success: false,
      error: err.message,
      details: {
        stack: err.stack,
        name: err.name,
      },
      severity: 'CRITICAL',
    }
  );

  gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée non gérée:', reason);
  
  auditLogger.logEvent(
    'SYSTEM_ERROR',
    'Promesse rejetée non gérée',
    {
      ip: 'localhost',
      success: false,
      error: String(reason),
      details: {
        promise: String(promise),
      },
      severity: 'CRITICAL',
    }
  );
});

export default app;
