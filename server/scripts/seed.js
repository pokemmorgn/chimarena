const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();

const User = require('../src/models/User');

const seedData = async () => {
    try {
        console.log('🌱 Création des données de test...');
        
        // Connexion à la base
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena');
        
        // Supprimer les données existantes
        await User.deleteMany({});
        console.log('🗑️ Données existantes supprimées');
        
        // Créer des utilisateurs de test
        const testUsers = [
            {
                username: 'testplayer1',
                email: 'test1@chimarena.com',
                password: await bcrypt.hash('password123', 12),
                playerStats: {
                    level: 5,
                    experience: 450,
                    trophies: 1250,
                    highestTrophies: 1400
                },
                resources: {
                    gold: 5000,
                    gems: 100,
                    elixir: 150
                },
                gameStats: {
                    totalGames: 25,
                    wins: 18,
                    losses: 6,
                    draws: 1,
                    winStreak: 3,
                    bestWinStreak: 8
                },
                cards: [
                    { cardId: 'knight', level: 3, count: 25 },
                    { cardId: 'archers', level: 2, count: 18 },
                    { cardId: 'giant', level: 2, count: 12 },
                    { cardId: 'fireball', level: 3, count: 15 },
                    { cardId: 'arrows', level: 3, count: 22 },
                    { cardId: 'barbarians', level: 2, count: 14 },
                    { cardId: 'minions', level: 3, count: 20 },
                    { cardId: 'cannon', level: 2, count: 10 }
                ],
                deck: ['knight', 'archers', 'giant', 'fireball', 'arrows', 'barbarians', 'minions', 'cannon']
            },
            {
                username: 'testplayer2',
                email: 'test2@chimarena.com',
                password: await bcrypt.hash('password123', 12),
                playerStats: {
                    level: 3,
                    experience: 180,
                    trophies: 800,
                    highestTrophies: 950
                },
                resources: {
                    gold: 2500,
                    gems: 50,
                    elixir: 100
                },
                gameStats: {
                    totalGames: 15,
                    wins: 8,
                    losses: 6,
                    draws: 1,
                    winStreak: 1,
                    bestWinStreak: 4
                },
                cards: [
                    { cardId: 'knight', level: 2, count: 15 },
                    { cardId: 'archers', level: 2, count: 12 },
                    { cardId: 'giant', level: 1, count: 8 },
                    { cardId: 'fireball', level: 2, count: 10 },
                    { cardId: 'arrows', level: 2, count: 14 },
                    { cardId: 'barbarians', level: 1, count: 9 },
                    { cardId: 'minions', level: 2, count: 12 },
                    { cardId: 'cannon', level: 1, count: 6 }
                ],
                deck: ['knight', 'archers', 'giant', 'fireball', 'arrows', 'barbarians', 'minions', 'cannon']
            },
            {
                username: 'topplayer',
                email: 'top@chimarena.com',
                password: await bcrypt.hash('password123', 12),
                playerStats: {
                    level: 10,
                    experience: 950,
                    trophies: 2500,
                    highestTrophies: 2650
                },
                resources: {
                    gold: 15000,
                    gems: 300,
                    elixir: 200
                },
                gameStats: {
                    totalGames: 100,
                    wins: 75,
                    losses: 23,
                    draws: 2,
                    winStreak: 12,
                    bestWinStreak: 15
                },
                cards: [
                    { cardId: 'knight', level: 5, count: 50 },
                    { cardId: 'archers', level: 4, count: 45 },
                    { cardId: 'giant', level: 4, count: 30 },
                    { cardId: 'fireball', level: 5, count: 35 },
                    { cardId: 'arrows', level: 5, count: 48 },
                    { cardId: 'barbarians', level: 4, count: 32 },
                    { cardId: 'minions', level: 5, count: 42 },
                    { cardId: 'cannon', level: 4, count: 25 }
                ],
                deck: ['knight', 'archers', 'giant', 'fireball', 'arrows', 'barbarians', 'minions', 'cannon']
            }
        ];
        
        await User.insertMany(testUsers);
        
        console.log('✅ Données de test créées avec succès !');
        console.log('');
        console.log('📧 Utilisateurs de test disponibles :');
        console.log('   👤 test1@chimarena.com / password123 (Niveau 5, 1250 trophées)');
        console.log('   👤 test2@chimarena.com / password123 (Niveau 3, 800 trophées)');
        console.log('   👤 top@chimarena.com / password123 (Niveau 10, 2500 trophées)');
        console.log('');
        console.log('🎮 Vous pouvez maintenant tester l\'authentification !');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Erreur lors de la création des données de test:', error);
        process.exit(1);
    }
};

// Vérifier si le script est exécuté directement
if (require.main === module) {
    seedData();
}

module.exports = seedData;
