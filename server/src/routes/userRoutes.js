const express = require('express');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/user/profile - Obtenir le profil complet
router.get('/profile', authenticateToken, async (req, res) => {
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

// PUT /api/user/profile - Mettre à jour le profil
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { username } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilisateur non trouvé'
            });
        }

        // Vérifier si le nouveau username est disponible
        if (username && username !== user.username) {
            if (username.length < 3 || username.length > 20) {
                return res.status(400).json({
                    success: false,
                    message: 'Le nom d\'utilisateur doit contenir entre 3 et 20 caractères'
                });
            }

            const existingUser = await User.findOne({ username });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Ce nom d\'utilisateur est déjà pris'
                });
            }
            
            user.username = username;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Profil mis à jour avec succès',
            user: user.getPublicProfile()
        });

    } catch (error) {
        console.error('Erreur mise à jour profil:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /api/user/deck - Obtenir le deck actuel
router.get('/deck', authenticateToken, async (req, res) => {
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
            deck: user.deck,
            cards: user.cards
        });

    } catch (error) {
        console.error('Erreur récupération deck:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /api/user/stats - Obtenir les statistiques détaillées
router.get('/stats', authenticateToken, async (req, res) => {
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
            stats: {
                playerStats: user.playerStats,
                gameStats: user.gameStats,
                winRate: user.winRate,
                resources: user.resources,
                progression: {
                    level: user.playerStats.level,
                    experience: user.playerStats.experience,
                    experienceToNextLevel: Math.max(0, (user.playerStats.level * 100) - user.playerStats.experience)
                }
            }
        });

    } catch (error) {
        console.error('Erreur récupération stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /api/user/leaderboard - Classement des joueurs
router.get('/leaderboard', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        
        const leaderboard = await User.find({
            'accountInfo.isBanned': false
        })
        .sort({ 'playerStats.trophies': -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .select('username playerStats.level playerStats.trophies gameStats.wins gameStats.totalGames');

        const totalPlayers = await User.countDocuments({
            'accountInfo.isBanned': false
        });

        res.json({
            success: true,
            leaderboard: leaderboard.map((player, index) => ({
                rank: parseInt(offset) + index + 1,
                username: player.username,
                level: player.playerStats.level,
                trophies: player.playerStats.trophies,
                wins: player.gameStats.wins,
                totalGames: player.gameStats.totalGames
            })),
            pagination: {
                total: totalPlayers,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasNext: (parseInt(offset) + parseInt(limit)) < totalPlayers
            }
        });

    } catch (error) {
        console.error('Erreur récupération leaderboard:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

// GET /api/user/:username - Obtenir le profil public d'un autre joueur
router.get('/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        const user = await User.findOne({ username })
            .select('-email -accountInfo -cards -resources');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Joueur non trouvé'
            });
        }

        if (user.accountInfo.isBanned) {
            return res.status(404).json({
                success: false,
                message: 'Joueur non trouvé'
            });
        }

        res.json({
            success: true,
            player: user.getPublicProfile()
        });

    } catch (error) {
        console.error('Erreur récupération profil public:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur'
        });
    }
});

module.exports = router;
