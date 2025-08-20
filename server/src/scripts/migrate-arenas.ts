// server/scripts/migrate-arenas.ts - MIGRATION VERS LE SYSTÈME D'ARÈNES
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { ArenaManager } from '../src/config/arenas';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * 🏟️ SCRIPT DE MIGRATION VERS LE SYSTÈME D'ARÈNES
 * Migre tous les utilisateurs existants vers le nouveau système
 */

interface OldUser {
  _id: any;
  username: string;
  playerStats: {
    trophies: number;
    highestTrophies: number;
  };
  gameStats: {
    wins: number;
    losses: number;
    draws: number;
  };
  createdAt: Date;
  // Nouveaux champs (optionnels pour les anciens users)
  currentArenaId?: number;
  arenaHistory?: any[];
  seasonStats?: any;
}

/**
 * 🗄️ CONNEXION À LA BASE DE DONNÉES
 */
async function connectToDatabase(): Promise<void> {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena';
    await mongoose.connect(mongoUri);
    console.log('✅ Connexion à la base de données réussie');
  } catch (error) {
    console.error('❌ Erreur de connexion à la base de données:', error);
    throw error;
  }
}

/**
 * 📊 ANALYSER LES DONNÉES EXISTANTES
 */
async function analyzeExistingUsers(): Promise<{
  total: number;
  needsMigration: number;
  alreadyMigrated: number;
  trophyDistribution: Record<string, number>;
}> {
  console.log('🔍 Analyse des utilisateurs existants...');
  
  const User = mongoose.model('User');
  
  const totalUsers = await User.countDocuments();
  
  // Users sans le nouveau système d'arènes
  const usersNeedingMigration = await User.countDocuments({
    $or: [
      { currentArenaId: { $exists: false } },
      { arenaHistory: { $exists: false } },
      { seasonStats: { $exists: false } }
    ]
  });
  
  // Distribution des trophées pour prévoir les arènes
  const trophyDistribution: Record<string, number> = {};
  const users = await User.find({}, 'playerStats.trophies').lean();
  
  users.forEach((user: any) => {
    const trophies = user.playerStats?.trophies || 0;
    const arena = ArenaManager.getCurrentArena(trophies);
    const key = `Arena ${arena.id} (${arena.nameId})`;
    trophyDistribution[key] = (trophyDistribution[key] || 0) + 1;
  });
  
  return {
    total: totalUsers,
    needsMigration: usersNeedingMigration,
    alreadyMigrated: totalUsers - usersNeedingMigration,
    trophyDistribution
  };
}

/**
 * 🚀 MIGRER UN UTILISATEUR INDIVIDUEL
 */
function migrateUser(user: OldUser): {
  currentArenaId: number;
  arenaHistory: any[];
  seasonStats: any;
} {
  const trophies = user.playerStats?.trophies || 0;
  const highestTrophies = user.playerStats?.highestTrophies || trophies;
  
  // Calculer l'arène actuelle
  const currentArena = ArenaManager.getCurrentArena(trophies);
  
  // Créer une saison actuelle
  const now = new Date();
  const seasonId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  // Estimer la date de début de saison (début du mois)
  const seasonStart = new Date(now.getFullYear(), now.getMonth(), 1);
  
  // Créer un historique initial (migration)
  const initialHistory = [{
    fromArenaId: 0, // On suppose qu'ils ont commencé à l'arène 0
    toArenaId: currentArena.id,
    trophiesChange: trophies,
    timestamp: user.createdAt || seasonStart,
    reason: 'manual' // Migration
  }];
  
  // Créer les stats de saison
  const seasonStats = {
    seasonId,
    startDate: seasonStart,
    wins: user.gameStats?.wins || 0,
    losses: user.gameStats?.losses || 0,
    draws: user.gameStats?.draws || 0,
    highestTrophies: Math.max(trophies, highestTrophies),
    rewards: { gold: 0, gems: 0, cards: 0 }
  };
  
  return {
    currentArenaId: currentArena.id,
    arenaHistory: initialHistory,
    seasonStats
  };
}

/**
 * 🏃‍♂️ EXÉCUTER LA MIGRATION
 */
async function runMigration(dryRun: boolean = false): Promise<void> {
  console.log(dryRun ? '🧪 MODE TEST - Aucune modification ne sera sauvegardée' : '🚀 MIGRATION EN COURS...');
  
  const User = mongoose.model('User');
  
  // Trouver les users à migrer
  const usersToMigrate = await User.find({
    $or: [
      { currentArenaId: { $exists: false } },
      { arenaHistory: { $exists: false } },
      { seasonStats: { $exists: false } }
    ]
  }).lean();
  
  console.log(`📊 ${usersToMigrate.length} utilisateurs à migrer`);
  
  if (usersToMigrate.length === 0) {
    console.log('✅ Aucune migration nécessaire !');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  // Migrer par batch de 50
  const batchSize = 50;
  
  for (let i = 0; i < usersToMigrate.length; i += batchSize) {
    const batch = usersToMigrate.slice(i, i + batchSize);
    
    console.log(`🔄 Traitement du batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(usersToMigrate.length / batchSize)}`);
    
    const bulkOps = batch.map((user: any) => {
      try {
        const migration = migrateUser(user as OldUser);
        
        return {
          updateOne: {
            filter: { _id: user._id },
            update: {
              $set: {
                currentArenaId: migration.currentArenaId,
                arenaHistory: migration.arenaHistory,
                seasonStats: migration.seasonStats
              }
            }
          }
        };
      } catch (error) {
        console.error(`❌ Erreur migration user ${user.username}:`, error);
        errorCount++;
        return null;
      }
    }).filter(op => op !== null);
    
    if (!dryRun && bulkOps.length > 0) {
      try {
        const result = await User.bulkWrite(bulkOps);
        successCount += result.modifiedCount;
        console.log(`   ✅ ${result.modifiedCount} utilisateurs migrés dans ce batch`);
      } catch (error) {
        console.error('❌ Erreur lors de l\'écriture en batch:', error);
        errorCount += bulkOps.length;
      }
    } else if (dryRun) {
      successCount += bulkOps.length;
      console.log(`   🧪 ${bulkOps.length} utilisateurs auraient été migrés (mode test)`);
    }
    
    // Petit délai pour ne pas surcharger la DB
    if (i + batchSize < usersToMigrate.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  console.log('\n📈 RÉSULTATS DE LA MIGRATION:');
  console.log(`   ✅ Succès: ${successCount}`);
  console.log(`   ❌ Erreurs: ${errorCount}`);
  console.log(`   📊 Total traité: ${successCount + errorCount}`);
}

/**
 * 🧹 VÉRIFIER LA MIGRATION
 */
async function verifyMigration(): Promise<void> {
  console.log('🔍 Vérification de la migration...');
  
  const User = mongoose.model('User');
  
  const totalUsers = await User.countDocuments();
  const migratedUsers = await User.countDocuments({
    currentArenaId: { $exists: true },
    arenaHistory: { $exists: true },
    seasonStats: { $exists: true }
  });
  
  const usersWithValidArenas = await User.countDocuments({
    currentArenaId: { $gte: 0, $lte: 9 }
  });
  
  console.log('\n📊 ÉTAT POST-MIGRATION:');
  console.log(`   👥 Total utilisateurs: ${totalUsers}`);
  console.log(`   ✅ Utilisateurs migrés: ${migratedUsers}`);
  console.log(`   🏟️ Utilisateurs avec arène valide: ${usersWithValidArenas}`);
  console.log(`   📈 Taux de réussite: ${Math.round((migratedUsers / totalUsers) * 100)}%`);
  
  if (migratedUsers < totalUsers) {
    console.log(`   ⚠️ ${totalUsers - migratedUsers} utilisateurs nécessitent encore une migration`);
  } else {
    console.log('   🎉 Migration complète !');
  }
  
  // Échantillon d'utilisateurs migrés
  const sampleUsers = await User.find({}).limit(3).select('username currentArenaId playerStats.trophies seasonStats.seasonId');
  console.log('\n📋 ÉCHANTILLON D\'UTILISATEURS MIGRÉS:');
  sampleUsers.forEach((user: any) => {
    const arena = ArenaManager.getArenaById(user.currentArenaId);
    console.log(`   👤 ${user.username}: ${user.playerStats.trophies} trophées → Arène ${user.currentArenaId} (${arena?.nameId || 'Unknown'})`);
  });
}

/**
 * 🎯 FONCTION PRINCIPALE
 */
async function main(): Promise<void> {
  try {
    console.log('🏟️ MIGRATION VERS LE SYSTÈME D\'ARÈNES ChimArena');
    console.log('=====================================================\n');
    
    // Connexion à la DB
    await connectToDatabase();
    
    // Analyse préliminaire
    const analysis = await analyzeExistingUsers();
    console.log('\n📊 ANALYSE PRÉLIMINAIRE:');
    console.log(`   👥 Total utilisateurs: ${analysis.total}`);
    console.log(`   🔄 Nécessitent migration: ${analysis.needsMigration}`);
    console.log(`   ✅ Déjà migrés: ${analysis.alreadyMigrated}`);
    console.log('\n🏟️ DISTRIBUTION PAR ARÈNE:');
    Object.entries(analysis.trophyDistribution).forEach(([arena, count]) => {
      console.log(`   ${arena}: ${count} utilisateurs`);
    });
    
    if (analysis.needsMigration === 0) {
      console.log('\n🎉 Aucune migration nécessaire !');
      await mongoose.disconnect();
      return;
    }
    
    // Demander confirmation (simulation en développement)
    console.log(`\n⚠️ Prêt à migrer ${analysis.needsMigration} utilisateurs`);
    
    // Mode test d'abord
    console.log('\n🧪 TEST DE MIGRATION...');
    await runMigration(true);
    
    // Migration réelle
    console.log('\n🚀 MIGRATION RÉELLE...');
    await runMigration(false);
    
    // Vérification finale
    await verifyMigration();
    
    console.log('\n🎉 Migration terminée avec succès !');
    
  } catch (error) {
    console.error('\n❌ ERREUR FATALE LORS DE LA MIGRATION:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('📴 Déconnexion de la base de données');
  }
}

/**
 * 🏃‍♂️ EXÉCUTION DU SCRIPT
 */
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Migration terminée');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Échec de la migration:', error);
      process.exit(1);
    });
}

export { main as runArenaMigration };
