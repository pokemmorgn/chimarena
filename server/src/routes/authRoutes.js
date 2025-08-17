const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Helper function pour générer un token JWT
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user._id,
            username: user.username,
            email: user.email
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
};

// Helper function pour les cartes de départ
const getStarterCards = () => {
    return [
        { cardId: 'knight', level: 1, count: 10 },
        { cardId: 'archers', level: 1, count: 10 },
        { cardId: 'giant', level: 1, count: 5 },
        { cardId: 'fireball', level: 1, count: 5 },
        { cardId: 'arrows', level: 1, count: 10 },
        { cardId: 'barbarians', level: 1, count: 8 },
        { cardId: 'minions', level: 1, count: 10 },
        { cardId: 'cannon', level: 1, count: 5 }
    ];
};

// POST /api/auth/register - Inscription
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Validation des données d'entrée
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Tous les champs sont requis'
            });
        }

        // Vérifications supplémentaires
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({
                success: false,
                message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Le mot de passe doit contenir au moins 6 caractères'
            });
        }

        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { username: username }
            ]
        });

        if (existingUser) {
            if (existingUser.email === email.toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    message: 'Cet email est déjà utilisé'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Ce nom d\'utilisateur est déjà pris'
                });
            }
        }

        // Créer le nouvel utilisateur avec des cartes de départ
        const newUser = new User({
            username,
            email: email.toLowerCase(),
            password,
            cards: getStarterCards(),
            deck: ['knight', 'archers', 'giant', 'fireball', 'arrows', 'barbarians', 'minions', 'cannon']
        });

        await newUser.save();

        // Générer le token
        const token = generateToken(newUser);

        // Réponse avec les données utilisateur (sans mot de passe)
        res.status(201).json({
            success: true,
            message: 'Inscription réussie',
            token,
            user: newUser.getPublicProfile()
        });

        console.log(`📝 Nouvel utilisateur inscrit: ${username} (${email})`);

    } catch (error) {
        console.error('Erreur inscription:', error);

        // Gestion des erreurs de validation Mongoose
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Données invalides',
                errors
            });
        }

        // Erreur de duplication (code 11000)
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                message: `Ce ${field} est déjà utilisé`
            });
        }

        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// POST /api/auth/login - Connexion
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation des données d'entrée
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email et mot de passe requis'
            });
        }

        // Trouver l'utilisateur et inclure le mot de passe pour la vérification
        const user = await User.findOne({ 
            email: email.toLowerCase() 
        }).select('+password');

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Email ou mot de passe incorrect'
            });
        }

        // Vérifier si le compte est banni
        if (user.accountInfo.isBanned) {
            const banMessage = user.accountInfo.banExpires && user.accountInfo.banExpires > new Date()
                ? `Compte banni jusqu'au ${user.accountInfo.banExpires.toLocaleDateString()}`
                : 'Compte banni définitivement';
            
            return res.status(403).json({
                success: false,
                message: banMessage,
                reason: user.accountInfo.banReason
            });
        }

        // Vérifier le mot de passe
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(400).json({
                success: false,
                message: 'Email ou mot de passe incorrect'
            });
        }

        // Mettre à jour les informations de connexion
        user.accountInfo.lastLogin = new Date();
        user.accountInfo.loginCount += 1;
        await user.save();

        // Générer le token
        const token = generateToken(user);

        // Réponse avec les données utilisateur
        res.json({
            success: true,
            message: 'Connexion réussie',
            token,
            user: user.getPublicProfile()
        });

        console.log(`🔑 Connexion réussie: ${user.username} (${user.email})`);

    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /api/auth/me - Obtenir le profil utilisateur actuel
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        res.json({
            success: true,
            user: {
                ...user.getPublicProfile(),
                email: user.email,
                resources: user.resources,
                cards: user.cards,
                deck: user.deck,
                accountInfo: {
                    isEmailVerified: user.accountInfo.isEmailVerified,
                    lastLogin: user.accountInfo.lastLogin,
                    loginCount: user.accountInfo.loginCount
                }
            }
        });

    } catch (error) {
        console.error('Erreur récupération profil:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

module.exports = router;
