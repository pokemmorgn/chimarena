const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const express = require('express');

const setupMiddlewares = (app) => {
    // Security headers
    app.use(helmet({
        contentSecurityPolicy: process.env.NODE_ENV === 'production',
        crossOriginEmbedderPolicy: false
    }));

    // Compression
    app.use(compression());

    // Logging
    if (process.env.NODE_ENV === 'production') {
        app.use(morgan('combined'));
    } else {
        app.use(morgan('dev'));
    }

    // Rate limiting
    const createRateLimit = (windowMs, max, message) => {
        return rateLimit({
            windowMs,
            max,
            message: { error: message },
            standardHeaders: true,
            legacyHeaders: false,
        });
    };

    // Rate limits différents selon les routes
    app.use('/api/auth/login', createRateLimit(
        15 * 60 * 1000, // 15 minutes
        5, // 5 tentatives max
        'Trop de tentatives de connexion, réessayez dans 15 minutes'
    ));

    app.use('/api/auth/register', createRateLimit(
        60 * 60 * 1000, // 1 heure
        3, // 3 inscriptions max par heure
        'Trop d\'inscriptions, réessayez dans 1 heure'
    ));

    app.use('/api/', createRateLimit(
        15 * 60 * 1000, // 15 minutes
        100, // 100 requêtes max
        'Trop de requêtes, réessayez plus tard'
    ));

    // CORS
    const corsOptions = {
        origin: (origin, callback) => {
            const allowedOrigins = process.env.CORS_ORIGINS 
                ? process.env.CORS_ORIGINS.split(',')
                : ['http://localhost:8080', 'http://127.0.0.1:8080'];
            
            // Permettre les requêtes sans origine (mobile apps, etc.)
            if (!origin) return callback(null, true);
            
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Non autorisé par CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        exposedHeaders: ['X-Total-Count']
    };

    app.use(cors(corsOptions));

    // Body parsing
    app.use(express.json({ 
        limit: '10mb',
        type: 'application/json'
    }));
    
    app.use(express.urlencoded({ 
        extended: true, 
        limit: '10mb' 
    }));

    // Request info middleware
    app.use((req, res, next) => {
        req.requestTime = new Date().toISOString();
        next();
    });
};

module.exports = {
    setupMiddlewares
};
