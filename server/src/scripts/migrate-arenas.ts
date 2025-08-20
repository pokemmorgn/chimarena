// server/src/scripts/migrate-arenas.ts - MIGRATION SIMPLE VERS LES ARÈNES
const mongoose = require('mongoose');
require('dotenv').config();

console.log('🏟️ Migration vers le système d\'arènes ChimArena');
console.log('===============================================');

// Fonction pour calculer l'arène selon les trophées
function getCurrentArenaId(trophies: number): number {
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

async function migrate(): Promise<void> {
  try {
    // Connexion
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena');
    console.log('✅ Connecté à la base de données');

    const User = mongoose.model('User');
    
    // Compter les users à migrer
    const total = await User.countDocuments();
    const needsMigration = await User.countDocuments({ currentArenaId: { $exists: false } });
    
    console.log(`📊 ${total} utilisateurs total, ${needsMigration} à migrer`);
    
    if (needsMigration === 0) {
      console.log('🎉 Aucune migration nécessaire !');
      return;
    }

    // Migrer par batch
    const users = await User.find({ currentArenaId: { $exists: false } });
    
    for (const user of users) {
      const trophies = user.playerStats?.trophies || 0;
      const arenaId = getCurrentArenaId(trophies);
      const now = new Date();
      const seasonId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            currentArenaId: arenaId,
            arenaHistory: [{
              fromArenaId: 0,
              toArenaId: arenaId,
              trophiesChange: trophies,
              timestamp: user.createdAt || now,
              reason: 'manual'
            }],
            seasonStats: {
              seasonId,
              startDate: new Date(now.getFullYear(), now.getMonth(), 1),
              wins: user.gameStats?.wins || 0,
              losses: user.gameStats?.losses || 0,
              draws: user.gameStats?.draws || 0,
              highestTrophies: Math.max(trophies, user.playerStats?.highestTrophies || 0),
              rewards: { gold: 0, gems: 0, cards: 0 }
            }
          }
        }
      );
    }
    
    console.log(`✅ ${users.length} utilisateurs migrés avec succès !`);
    
    // Vérification rapide
    const migrated = await User.countDocuments({ currentArenaId: { $exists: true } });
    console.log(`🎯 ${migrated}/${total} utilisateurs ont maintenant une arène`);
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Déconnecté');
  }
}

migrate();
