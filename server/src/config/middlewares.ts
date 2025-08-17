// src/config/middlewares.ts
import type { Application, Request } from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

export const setupMiddlewares = (app: Application) => {
  // Derrière Nginx/HTTPS
  app.set('trust proxy', 1);

  // Sécurité (CSP gérée surtout par Nginx ; ici on ne force pas une CSP stricte pour éviter les conflits)
  app.use(helmet());

  // Logs
  app.use(process.env.NODE_ENV === 'production' ? morgan('combined') : morgan('dev'));

  // Compression
  app.use(compression());

  // Cookies (INDISPENSABLE pour /refresh)
  app.use(cookieParser());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS (autorise ton domaine prod et localhost pour dev)
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
        if (!origin) return cb(null, true); // ex: curl
        return allowedOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['X-Total-Count'],
    })
  );

  // Rate limiting (anti-abus)
  const mkLimiter = (windowMs: number, max: number, message: string) =>
    rateLimit({
      windowMs,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: message },
      keyGenerator: (req: Request) => (req.ip || 'unknown'),
    });

  // Connexion: 5 tentatives / 15 min
  app.use('/api/auth/login', mkLimiter(15 * 60 * 1000, 5, 'Trop de tentatives de connexion, réessayez dans 15 minutes'));
  // Inscription: 3 / heure
  app.use('/api/auth/register', mkLimiter(60 * 60 * 1000, 3, 'Trop d’inscriptions, réessayez dans 1 heure'));
  // Par défaut API: 100 / 15 min
  app.use('/api/', mkLimiter(15 * 60 * 1000, 100, 'Trop de requêtes, réessayez plus tard'));

  // Marquage temporel (optionnel)
  app.use((req, _res, next) => {
    (req as any).requestTime = new Date().toISOString();
    next();
  });
};
