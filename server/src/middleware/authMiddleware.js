const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware pour vérifier le token JWT
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Token d\'accès requis'
            });
        }

        // Vérifier le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Vérifier que l'utilisateur existe toujours
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Vérifier si le compte est banni
        if (user.accountInfo.isBanned) {
            return res.status(403).json({
                success: false,
                message: 'Compte banni'
            });
        }

        // Ajouter les informations utilisateur à la requête
        req.user = {
            id: decoded.id,
            username: decoded.username,
            email: decoded.email
        };

        next();

    } catch (error) {
        console.error('Erreur authentification:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({
                success: false,
                message: 'Token invalide'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({
                success: false,
                message: 'Token expiré'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
};

// Middleware optionnel pour les routes qui peuvent fonctionner avec ou sans auth
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            req.user = null;
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (user && !user.accountInfo.isBanned) {
            req.user = {
                id: decoded.id,
                username: decoded.username,
                email: decoded.email
            };
        } else {
            req.user = null;
        }

        next();

    } catch (error) {
        // En cas d'erreur, on continue sans utilisateur authentifié
        req.user = null;
        next();
    }
};

// Middleware pour vérifier les permissions admin (pour plus tard)
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentification requise'
            });
        }

        const user = await User.findById(req.user.id);
        
        if (!user || !user.isAdmin) {
            return res.status(403).json({
                success: false,
                message: 'Permissions administrateur requises'
            });
        }

        next();

    } catch (error) {
        console.error('Erreur vérification admin:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
};

module.exports = {
    authenticateToken,
    optionalAuth,
    requireAdmin
};
