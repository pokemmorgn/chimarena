const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const validator = require('validator');

const userSchema = new mongoose.Schema({
    // Informations de base
    username: {
        type: String,
        required: [true, 'Le nom d\'utilisateur est requis'],
        unique: true,
        trim: true,
        minlength: [3, 'Le nom d\'utilisateur doit contenir au moins 3 caractères'],
        maxlength: [20, 'Le nom d\'utilisateur ne peut pas dépasser 20 caractères'],
        match: [/^[a-zA-Z0-9_]+$/, 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscore']
    },
    
    email: {
        type: String,
        required: [true, 'L\'email est requis'],
        unique: true,
        trim: true,
        lowercase: true,
        validate: [validator.isEmail, 'Email invalide']
    },
    
    password: {
        type: String,
        required: [true, 'Le mot de passe est requis'],
        minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
        select: false // N'inclut pas le mot de passe dans les requêtes par défaut
    },

    // Progression du joueur
    playerStats: {
        level: {
            type: Number,
            default: 1,
            min: 1,
            max: 50
        },
        experience: {
            type: Number,
            default: 0,
            min: 0
        },
        trophies: {
            type: Number,
            default: 0,
            min: 0
        },
        highestTrophies: {
            type: Number,
            default: 0,
            min: 0
        }
    },

    // Ressources du joueur
    resources: {
        gold: {
            type: Number,
            default: 1000,
            min: 0
        },
        gems: {
            type: Number,
            default: 50,
            min: 0
        },
        elixir: {
            type: Number,
            default: 100,
            min: 0
        }
    },

    // Collection de cartes
    cards: [{
        cardId: {
            type: String,
            required: true
        },
        level: {
            type: Number,
            default: 1,
            min: 1,
            max: 14
        },
        count: {
            type: Number,
            default: 1,
            min: 0
        }
    }],

    // Deck actuel (8 cartes)
    deck: {
        type: [String],
        default: [],
        validate: {
            validator: function(deck) {
                return deck.length <= 8;
            },
            message: 'Le deck ne peut contenir que 8 cartes maximum'
        }
    },

    // Statistiques de jeu
    gameStats: {
        totalGames: {
            type: Number,
            default: 0,
            min: 0
        },
        wins: {
            type: Number,
            default: 0,
            min: 0
        },
        losses: {
            type: Number,
            default: 0,
            min: 0
        },
        draws: {
            type: Number,
            default: 0,
            min: 0
        },
        winStreak: {
            type: Number,
            default: 0,
            min: 0
        },
        bestWinStreak: {
            type: Number,
            default: 0,
            min: 0
        }
    },

    // Informations de compte
    accountInfo: {
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        isBanned: {
            type: Boolean,
            default: false
        },
        banReason: String,
        banExpires: Date,
        lastLogin: {
            type: Date,
            default: Date.now
        },
        loginCount: {
            type: Number,
            default: 1
        }
    }
}, {
    timestamps: true, // Ajoute createdAt et updatedAt
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.__v;
            return ret;
        }
    }
});

// Index pour les performances
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'playerStats.trophies': -1 });
userSchema.index({ 'accountInfo.lastLogin': -1 });

// Propriétés virtuelles
userSchema.virtual('winRate').get(function() {
    const totalGames = this.gameStats.totalGames;
    if (totalGames === 0) return 0;
    return Math.round((this.gameStats.wins / totalGames) * 100);
});

userSchema.virtual('cardsOwned').get(function() {
    return this.cards.length;
});

// Middleware pre-save pour hasher le mot de passe
userSchema.pre('save', async function(next) {
    // Ne hasher que si le mot de passe a été modifié
    if (!this.isModified('password')) return next();

    try {
        const saltRounds = 12;
        this.password = await bcrypt.hash(this.password, saltRounds);
        next();
    } catch (error) {
        next(error);
    }
});

// Middleware pre-save pour mettre à jour les trophées max
userSchema.pre('save', function(next) {
    if (this.playerStats.trophies > this.playerStats.highestTrophies) {
        this.playerStats.highestTrophies = this.playerStats.trophies;
    }
    next();
});

// Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function(candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
        throw new Error('Erreur lors de la comparaison du mot de passe');
    }
};

// Méthode pour obtenir les données publiques du joueur
userSchema.methods.getPublicProfile = function() {
    return {
        id: this._id,
        username: this.username,
        playerStats: this.playerStats,
        gameStats: this.gameStats,
        winRate: this.winRate,
        cardsOwned: this.cardsOwned,
        createdAt: this.createdAt
    };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
