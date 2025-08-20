// server/src/scripts/test-arena-system.js - TEST DU SYSTÈME D'ARÈNES
const mongoose = require('mongoose');
require('dotenv').config();

// Définir un schéma User basique pour les tests
const userSchema = new mongoose.Schema({
  username: String,
  playerStats: {
    trophies: { type: Number, default: 0 },
    highestTrophies: { type: Number, default: 0 }
  },
  gameStats: {
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 }
  },
  currentArenaId: Number,
  arenaHistory: [mongoose.Schema.Types.Mixed],
  seasonStats: mongoose.Schema.Types.Mixed
}, { timestamps: true, strict: false });

const User = mongoose.model('User', userSchema);

console.log('🎮 Test du système d\'arènes ChimArena');
console.log('====================================');

// Fonction pour calculer l'arène selon les trophées
function getCurrentArenaId(trophies) {
  if (trophies < 400) return 0;
  if (trophies < 800) return 1;
  if (trophies < 1200) return 2;
  if (trophies < 1600) return 3;
  if (trophies < 2000) return 4;
  if (trophies < 2400) return 5;
  if (trophies < 3000) return 6;
  if (trophies < 4000) return 7;
  if (trophies < 5000) return 8;
  return 9;
}

// Noms des arènes pour l'affichage
const arenaNames = [
  "Centre d'Entraînement",
  "Arène des Gobelins", 
  "Arène des Os",
  "Arène Royale",
  "Vallée des Sortilèges",
  "Pic du Constructeur",
  "Arène Royale Haute",
  "Arène Légendaire",
  "Arène des Champions",
  "Arène Ultime"
];

// Fonction pour ajouter des trophées à un user
async function addTrophiesToUser(userId, trophiesToAdd) {
  const user = await User.findById(userId);
  if (!user) {
    console.log(`❌ Utilisateur ${userId} non trouvé`);
    return null;
  }
  
  const oldTrophies = user.playerStats.trophies;
  const oldArenaId = user.currentArenaId;
  
  // Nouveau nombre de trophées
  const newTrophies = Math.max(0, oldTrophies + trophiesToAdd);
  const newArenaId = getCurrentArenaId(newTrophies);
  
  // Mettre à jour
  user.playerStats.trophies = newTrophies;
  if (newTrophies > user.playerStats.highestTrophies) {
    user.playerStats.highestTrophies = newTrophies;
  }
  
  // Changement d'arène ?
  let arenaChanged = false;
  if (newArenaId !== oldArenaId) {
    arenaChanged = true;
    user.currentArenaId = newArenaId;
    
    // Ajouter à l'historique
    if (!user.arenaHistory) user.arenaHistory = [];
    user.arenaHistory.unshift({
      fromArenaId: oldArenaId,
      toArenaId: newArenaId,
      trophiesChange: trophiesToAdd,
      timestamp: new Date(),
      reason: trophiesToAdd > 0 ? 'win' : 'loss'
    });
    
    // Garder max 10 entrées d'historique
    if (user.arenaHistory.length > 10) {
      user.arenaHistory = user.arenaHistory.slice(0, 10);
    }
  }
  
  await user.save();
  
  return {
    username: user.username,
    oldTrophies,
    newTrophies,
    trophiesChange: trophiesToAdd,
    oldArenaId,
    newArenaId,
    arenaChanged,
    oldArenaName: arenaNames[oldArenaId] || 'Inconnue',
    newArenaName: arenaNames[newArenaId] || 'Inconnue'
  };
}

// Test avec un utilisateur spécifique
async function testSpecificUser(username, trophiesToAdd) {
  console.log(`\n🎯 Test avec ${username} (+${trophiesToAdd} trophées):`);
  
  const user = await User.findOne({ username });
  if (!user) {
    console.log(`❌ Utilisateur ${username} non trouvé`);
    return;
  }
  
  const result = await addTrophiesToUser(user._id, trophiesToAdd);
  if (result) {
    console.log(`   👤 ${result.username}`);
    console.log(`   🏆 Trophées: ${result.oldTrophies} → ${result.newTrophies} (${result.trophiesChange > 0 ? '+' : ''}${result.trophiesChange})`);
    console.log(`   🏟️ Arène: ${result.oldArenaName} (${result.oldArenaId}) → ${result.newArenaName} (${result.newArenaId})`);
    
    if (result.arenaChanged) {
      console.log(`   🎉 CHANGEMENT D'ARÈNE ! ${result.oldArenaId} → ${result.newArenaId}`);
    } else {
      console.log(`   ⚡ Reste dans la même arène`);
    }
  }
}

// Test de progression automatique
async function testArenaProgression() {
  console.log(`\n🚀 Test de progression d'arènes automatique:`);
  
  // Prendre le premier user trouvé
  const user = await User.findOne({});
  if (!user) {
    console.log(`❌ Aucun utilisateur trouvé pour le test`);
    return;
  }
  
  console.log(`   👤 Test avec: ${user.username} (${user.playerStats.trophies} trophées)`);
  
  // Tester différents gains de trophées
  const tests = [50, 100, 200, 500, -100, 300, 1000];
  
  for (const trophyGain of tests) {
    const result = await addTrophiesToUser(user._id, trophyGain);
    if (result && result.arenaChanged) {
      console.log(`   🎊 +${trophyGain} → MONTÉE ! ${result.oldArenaName} → ${result.newArenaName}`);
    } else if (result) {
      console.log(`   ⚡ +${trophyGain} → ${result.newTrophies} trophées (${result.newArenaName})`);
    }
    
    // Petit délai pour voir la progression
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Statistiques des arènes
async function showArenaStatistics() {
  console.log(`\n📊 Statistiques des arènes:`);
  
  const stats = await User.aggregate([
    {
      $group: {
        _id: '$currentArenaId',
        count: { $sum: 1 },
        avgTrophies: { $avg: '$playerStats.trophies' },
        maxTrophies: { $max: '$playerStats.trophies' },
        minTrophies: { $min: '$playerStats.trophies' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  console.log(`┌────────┬──────────────────────────┬─────────┬──────────────┐`);
  console.log(`│ Arène  │ Nom                      │ Joueurs │ Trophées Moy │`);
  console.log(`├────────┼──────────────────────────┼─────────┼──────────────┤`);
  
  for (const stat of stats) {
    const arenaName = arenaNames[stat._id] || 'Inconnue';
    const nameShort = arenaName.length > 24 ? arenaName.substring(0, 21) + '...' : arenaName;
    
    console.log(
      `│ ${String(stat._id).padStart(6)} │ ${nameShort.padEnd(24)} │ ${String(stat.count).padStart(7)} │ ${String(Math.round(stat.avgTrophies)).padStart(12)} │`
    );
  }
  
  console.log(`└────────┴──────────────────────────┴─────────┴──────────────┘`);
}

// Simuler des combats avec gains/pertes réalistes
async function simulateBattles(username, numBattles = 5) {
  console.log(`\n⚔️ Simulation de ${numBattles} combats pour ${username}:`);
  
  const user = await User.findOne({ username });
  if (!user) {
    console.log(`❌ Utilisateur ${username} non trouvé`);
    return;
  }
  
  for (let i = 1; i <= numBattles; i++) {
    // Simuler victoire (70%) ou défaite (30%)
    const isWin = Math.random() > 0.3;
    
    // Gain/perte de trophées réaliste
    let trophyChange;
    if (isWin) {
      trophyChange = Math.floor(Math.random() * 15) + 25; // 25-40 trophées
    } else {
      trophyChange = -(Math.floor(Math.random() * 15) + 20); // -20 à -35 trophées
    }
    
    const result = await addTrophiesToUser(user._id, trophyChange);
    
    if (result) {
      const outcome = isWin ? '🎉 VICTOIRE' : '💔 DÉFAITE';
      const change = trophyChange > 0 ? `+${trophyChange}` : trophyChange;
      
      console.log(`   Combat ${i}: ${outcome} → ${change} trophées → ${result.newTrophies} total`);
      
      if (result.arenaChanged) {
        console.log(`      🎊 CHANGEMENT D'ARÈNE ! ${result.oldArenaName} → ${result.newArenaName}`);
      }
    }
  }
}

// Afficher l'historique d'un utilisateur
async function showUserHistory(username) {
  console.log(`\n📚 Historique d'arènes de ${username}:`);
  
  const user = await User.findOne({ username }).select('username arenaHistory playerStats.trophies currentArenaId');
  if (!user) {
    console.log(`❌ Utilisateur ${username} non trouvé`);
    return;
  }
  
  console.log(`   👤 ${user.username} - ${user.playerStats.trophies} trophées - Arène ${user.currentArenaId}`);
  
  if (!user.arenaHistory || user.arenaHistory.length === 0) {
    console.log(`   📭 Aucun historique d'arène`);
    return;
  }
  
  console.log(`   📋 Derniers changements d'arène:`);
  user.arenaHistory.slice(0, 5).forEach((entry, index) => {
    const date = new Date(entry.timestamp).toLocaleString();
    const change = entry.trophiesChange > 0 ? `+${entry.trophiesChange}` : entry.trophiesChange;
    console.log(`      ${index + 1}. ${date}: Arène ${entry.fromArenaId} → ${entry.toArenaId} (${change} trophées, ${entry.reason})`);
  });
}

// Fonction principale de test
async function runTests() {
  try {
    // Connexion
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena');
    console.log('✅ Connecté à la base de données');
    
    // Vérifier qu'on a des utilisateurs
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log('❌ Aucun utilisateur en base ! Créez des utilisateurs d\'abord.');
      return;
    }
    
    console.log(`📊 ${userCount} utilisateurs trouvés en base`);
    
    // 1. Statistiques initiales
    await showArenaStatistics();
    
    // 2. Prendre quelques utilisateurs pour les tests
    const users = await User.find({}).limit(3).select('username');
    
    if (users.length > 0) {
      // 3. Test avec premier utilisateur
      await testSpecificUser(users[0].username, 150);
      
      // 4. Simulation de combats
      if (users.length > 1) {
        await simulateBattles(users[1].username, 3);
      }
      
      // 5. Test de progression automatique
      await testArenaProgression();
      
      // 6. Afficher l'historique
      await showUserHistory(users[0].username);
      
      // 7. Statistiques finales
      console.log(`\n📈 Statistiques après tests:`);
      await showArenaStatistics();
    }
    
    console.log(`\n🎉 Tests terminés avec succès !`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Déconnecté');
  }
}

// Lancement des tests
runTests();
