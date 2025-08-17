const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { connectDatabase } = require('./src/config/database');
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const { setupMiddlewares } = require('./src/config/middlewares');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup middlewares (CORS, rate limiting, etc.)
setupMiddlewares(app);

// Connect to database
connectDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'ChimArena API',
        version: '0.1.0'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Route non trouvée',
        path: req.originalUrl
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Erreur:', err);
    
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Erreur interne du serveur' 
            : err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Serveur ChimArena démarré sur le port ${PORT}`);
    console.log(`🌐 API: http://localhost:${PORT}/api`);
    console.log(`📊 Health: http://localhost:${PORT}/api/health`);
    console.log(`🎮 Environnement: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
