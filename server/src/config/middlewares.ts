// server/src/config/middlewares.ts - VERSION ALLÉGÉE POUR JEU
import type { Application } from 'express';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

export const setupMiddlewares = (app: Application) => {
  // Trust proxy
  app.set('trust proxy', 1);

  // Sécurité basique avec Helmet
  app.use(helmet({
    contentSecurityPolicy: false, // Plus simple pour le jeu
    crossOriginEmbedderPolicy: false,
  }));

  // Logs simples
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  
  // Compression
  app.use(compression());
  
  // Cookies pour refresh tokens
  app.use(cookieParser());
  
  // Body parsing simple
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // CORS simple
  const allowedOrigins = [
    'https://chimarena.cloud',
    'https://www.chimarena.cloud',
    ...(process.env.NODE_ENV === 'development' ? [
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ] : [])
  ];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  // Rate limits basiques
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 tentatives par IP
    message: { error: 'Trop de tentatives de connexion' },
  });

  const cryptoLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 heure
    max: 20, // 20 actions crypto par heure
    message: { error: 'Trop d\'actions crypto' },
  });

  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requêtes par IP (généreux pour un jeu)
    message: { error: 'Trop de requêtes' },
  });

  // Appliquer les limiteurs
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/crypto/', cryptoLimiter);
  app.use('/api/', generalLimiter);

  console.log('✅ Middlewares configurés pour jeu crypto');
};
