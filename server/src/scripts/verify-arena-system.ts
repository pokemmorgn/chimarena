// server/scripts/verify-arena-system.ts - VÉRIFICATION DU SYSTÈME D'ARÈNES
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { ArenaManager } from '../src/config/arenas';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

/**
 * 🔍 SCRIPT DE VÉRIFICATION DU SYSTÈME D'ARÈNES
 * Teste le bon fonctionnement du système après migration
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
 * 🏟️ VÉRIFIER LA COHÉRENCE DES ARÈNES
 */
async function verifyArenaConsistency(): Promise<void> {
  console.log('🔍 Vérification de la cohérence des arènes...');
  
  const User = mongoose.model('User');
  
  // Récupérer tous les utilisateurs
  const users = await User.find({}, 'username playerStats.trophies currentArenaId').lean();
  
  let consistentUsers = 0;
  let inconsistentUsers = 0;
  const issues: string[] = [];
  
  for (const user of users) {
    const trophies = user.playerStats?.trophies || 0;
    const expectedArena = ArenaManager.getCurrentArena(trophies);
    const actualArenaId = user.currentArenaId;
    
    if (expectedArena.id === actualArenaId) {
      consistentUsers++;
    } else {
      inconsistentUsers++;
      issues.push(`👤 ${user.username}: ${trophies} trophées → Attendu: Arène ${expectedArena.id}, Actuel: Arène ${actualArenaId}`);
    }
  }
  
  console.log(`   ✅ Utilisateurs cohérents: ${consistentUsers}`);
  console.log(`   ❌ Utilisateurs incohérents: ${inconsistentUsers}`);
  
  if (inconsistentUsers > 0) {
    console.log('\n🚨 PROBLÈMES DÉTECTÉS:');
    issues.slice(0, 5).forEach(issue => console.log(`   ${issue}`));
    if (issues.length > 5) {
      console.log(`   ... et ${issues.length - 5} autres`);
    }
  }
}

/**
 * 📊 STATISTIQUES DES ARÈNES
 */
async function generateArenaStatistics(): Promise<void> {
  console.log('📊 Génération des statistiques par arène...');
  
  const User = mongoose.model('User');
  
  // Agrégation par arène
  const arenaStats = await User.aggregate([
    {
      $group: {
        _id: '$currentArenaId',
        count: { $sum: 1 },
        avgTrophies: { $avg: '$playerStats.trophies' },
        maxTrophies: { $max: '$playerStats.trophies' },
        minTrophies: { $min: '$playerStats.trophies' },
        totalWins: { $sum: '$gameStats.wins' },
        totalGames: { $sum: '$gameStats.totalGames' }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  console.log('\n🏟️ DISTRIBUTION PAR ARÈNE:');
  console.log('┌─────────┬─────────────────────────────┬─────────┬──────────────┬─────────────┐');
  console.log('│ Arène   │ Nom                         │ Joueurs │ Trophées Moy │ Taux Victoire│');
  console.log('├─────────┼─────────────────────────────┼─────────┼──────────────┼─────────────┤');
  
  for (const stat of arenaStats) {
    const arena = ArenaManager.getArenaById(stat._id);
    const name = arena ? arena.nameId.split('.')[1].replace(/_/g, ' ') : 'Unknown';
    const winRate = stat.totalGames > 0 ? ((stat.totalWins / stat.totalGames) * 100).toFixed(1) : '0.0';
    
    console.log(
      `│ ${String(stat._id).padEnd(7)} │ ${name.substring(0, 27).padEnd(27)} │ ${String(stat.count).padStart(7)} │ ${String(Math.round(stat.avgTrophies)).padStart(12)} │ ${String(winRate + '%').padStart(11)} │`
    );
  }
  
  console.log('└─────────┴─────────────────────────────┴─────────┴──────────────┴─────────────┘');
}

/**
 * 🎮 TESTER LES MÉTHODES D'ARÈNE
 */
async function testArenaMethods(): Promise<void> {
  console.log('🎮 Test des méthodes d\'arène...');
  
  const User = mongoose.model('User');
  
  // Prendre un utilisateur de test
  const testUser = await User.findOne({}).exec();
  
  if (!testUser) {
    console.log('   ⚠️ Aucun utilisateur trouvé pour les tests');
    return;
  }
  
  console.log(`   👤 Test avec l'utilisateur: ${testUser.username}`);
  
  // Tester getCurrentArena()
  try {
    const currentArena = testUser.getCurrentArena();
    console.log(`   ✅ getCurrentArena(): Arène ${currentArena.id} (${currentArena.nameId})`);
  } catch (error: any) {
    console.log(`   ❌ getCurrentArena() échouée: ${error?.message || 'Erreur inconnue'}`);
  }
  
  // Tester getCurrentSeasonStats()
  try {
    const seasonStats = testUser.getCurrentSeasonStats();
    console.log(`   ✅ getCurrentSeasonStats(): Saison ${seasonStats.seasonId}, ${seasonStats.wins} victoires`);
  } catch (error: any) {
    console.log(`   ❌ getCurrentSeasonStats() échouée: ${error?.message || 'Erreur inconnue'}`);
  }
  
  // Tester le calcul de progression
  try {
    const progress = ArenaManager.getArenaProgress(testUser.playerStats.trophies);
    const rank = ArenaManager.getArenaRank(testUser.playerStats.trophies);
    console.log(`   ✅ Progression: ${progress.toFixed(1)}%, Rang: ${rank}`);
  } catch (error: any) {
    console.log(`   ❌ Calcul progression échoué: ${error?.message || 'Erreur inconnue'}`);
  }
  
  // Tester le calcul de trophées pour prochaine arène
  try {
    const trophiesToNext = ArenaManager.getTrophiesToNextArena(testUser.playerStats.trophies);
    console.log(`   ✅ Trophées pour prochaine arène: ${trophiesToNext}`);
  } catch (error: any) {
    console.log(`   ❌ Calcul trophées prochaine arène échoué: ${error?.message || 'Erreur inconnue'}`);
  }
}

/**
 * 🔧 TESTER LES UTILITAIRES ArenaManager
 */
async function testArenaManagerUtils(): Promise<void> {
  console.log('🔧 Test des utilitaires ArenaManager...');
  
  const testCases = [
    { trophies: 0, expectedArena: 0 },
    { trophies: 350, expectedArena: 0 },
    { trophies: 450, expectedArena: 1 },
    { trophies: 1250, expectedArena: 3 },
    { trophies: 3500, expectedArena: 7 },
    { trophies: 6000, expectedArena: 9 }
  ];
  
  let passedTests = 0;
  let failedTests = 0;
  
  for (const testCase of testCases) {
    const arena = ArenaManager.getCurrentArena(testCase.trophies);
    
    if (arena.id === testCase.expectedArena) {
      console.log(`   ✅ ${testCase.trophies} trophées → Arène ${arena.id} ✓`);
      passedTests++;
    } else {
      console.log(`   ❌ ${testCase.trophies} trophées → Attendu: Arène ${testCase.expectedArena}, Obtenu: Arène ${arena.id}`);
      failedTests++;
    }
  }
  
  // Test du calcul de changement de trophées
  console.log('\n   🏆 Test calcul changement trophées:');
  const trophyTests = [
    { player: 1000, opponent: 1000, win: true, expected: 30 },
    { player: 1000, opponent: 1200, win: true, expected: 32 },
    { player: 1200, opponent: 1000, win: false, expected: -28 }
  ];
  
  for (const test of trophyTests) {
    const change = ArenaManager.calculateTrophyChange(test.player, test.opponent, test.win);
    const result = test.win ? 'Victoire' : 'Défaite';
    console.log(`   ${change === test.expected ? '✅' : '❌'} ${test.player} vs ${test.opponent} (${result}): ${change} (attendu: ${test.expected})`);
    
    if (change === test.expected) {
      passedTests++;
    } else {
      failedTests++;
    }
  }
  
  console.log(`\n   📊 Tests réussis: ${passedTests}, Tests échoués: ${failedTests}`);
}

/**
 * 🔍 VÉRIFIER L'HISTORIQUE DES ARÈNES
 */
async function verifyArenaHistory(): Promise<void> {
  console.log('🔍 Vérification de l\'historique des arènes...');
  
  const User = mongoose.model('User');
  
  const usersWithHistory = await User.countDocuments({
    'arenaHistory.0': { $exists: true }
  });
  
  const usersWithoutHistory = await User.countDocuments({
    $or: [
      { arenaHistory: { $exists: false } },
      { arenaHistory: { $size: 0 } }
    ]
  });
  
  console.log(`   📚 Utilisateurs avec historique: ${usersWithHistory}`);
  console.log(`   📭 Utilisateurs sans historique: ${usersWithoutHistory}`);
  
  // Échantillon d'historique
  const sampleUser = await User.findOne({ 'arenaHistory.0': { $exists: true } })
    .select('username arenaHistory')
    .lean() as any;
  
  if (sampleUser) {
    console.log(`\n   📋 Échantillon d'historique (${sampleUser.username}):`);
    sampleUser.arenaHistory.slice(0, 3).forEach((entry: any, index: number) => {
      const date = new Date(entry.timestamp).toLocaleDateString();
      console.log(`      ${index + 1}. ${date}: Arène ${entry.fromArenaId} → ${entry.toArenaId} (${entry.reason}, ${entry.trophiesChange > 0 ? '+' : ''}${entry.trophiesChange})`);
    });
  }
}

/**
 * 🏥 DÉTECTER ET RÉPARER LES PROBLÈMES
 */
async function detectAndRepairIssues(): Promise<void> {
  console.log('🏥 Détection et réparation des problèmes...');
  
  const User = mongoose.model('User');
  
  // Utilisateurs avec arène incohérente
  const users = await User.find({}).select('username playerStats.trophies currentArenaId').lean();
  
  const usersToFix: any[] = [];
  
  for (const user of users) {
    const trophies = user.playerStats?.trophies || 0;
    const expectedArena = ArenaManager.getCurrentArena(trophies);
    
    if (expectedArena.id !== user.currentArenaId) {
      usersToFix.push({
        _id: user._id,
        username: user.username,
        currentArenaId: user.currentArenaId,
        expectedArenaId: expectedArena.id,
        trophies
      });
    }
  }
  
  console.log(`   🔍 ${usersToFix.length} utilisateurs avec arène incohérente détectés`);
  
  if (usersToFix.length > 0) {
    console.log('   🛠️ Réparation automatique...');
    
    const bulkOps = usersToFix.map(user => ({
      updateOne: {
        filter: { _id: user._id },
        update: { $set: { currentArenaId: user.expectedArenaId } }
      }
    }));
    
    try {
      const result = await User.bulkWrite(bulkOps);
      console.log(`   ✅ ${result.modifiedCount} utilisateurs réparés`);
    } catch (error: any) {
      console.log(`   ❌ Erreur lors de la réparation: ${error?.message || 'Erreur inconnue'}`);
    }
  }
}

/**
 * 📈 RAPPORT FINAL
 */
async function generateFinalReport(): Promise<void> {
  console.log('📈 Génération du rapport final...');
  
  const User = mongoose.model('User');
  
  const totalUsers = await User.countDocuments();
  const usersWithArenas = await User.countDocuments({ currentArenaId: { $exists: true } });
  const usersWithHistory = await User.countDocuments({ 'arenaHistory.0': { $exists: true } });
  const usersWithSeasons = await User.countDocuments({ 'seasonStats.seasonId': { $exists: true } });
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RAPPORT FINAL - SYSTÈME D\'ARÈNES ChimArena');
  console.log('='.repeat(60));
  console.log(`👥 Total utilisateurs: ${totalUsers}`);
  console.log(`🏟️ Utilisateurs avec arène: ${usersWithArenas} (${Math.round(usersWithArenas/totalUsers*100)}%)`);
  console.log(`📚 Utilisateurs avec historique: ${usersWithHistory} (${Math.round(usersWithHistory/totalUsers*100)}%)`);
  console.log(`🗓️ Utilisateurs avec saison: ${usersWithSeasons} (${Math.round(usersWithSeasons/totalUsers*100)}%)`);
  
  if (usersWithArenas === totalUsers && usersWithHistory === totalUsers && usersWithSeasons === totalUsers) {
    console.log('\n🎉 SYSTÈME D\'ARÈNES FONCTIONNEL À 100% !');
  } else {
    console.log('\n⚠️ Des problèmes persistent, veuillez relancer la migration');
  }
  
  console.log('\n📋 Prochaines étapes recommandées:');
  console.log('   1. Testez le système en jeu');
  console.log('   2. Surveillez les logs d\'auto-migration');
  console.log('   3. Créez le système de matchmaking');
  console.log('   4. Implémentez les récompenses de saison');
  console.log('='.repeat(60));
}

/**
 * 🎯 FONCTION PRINCIPALE
 */
async function main(): Promise<void> {
  try {
    console.log('🔍 VÉRIFICATION DU SYSTÈME D\'ARÈNES ChimArena');
    console.log('================================================\n');
    
    await connectToDatabase();
    
    // Vérifications principales
    await verifyArenaConsistency();
    console.log('');
    
    await generateArenaStatistics();
    console.log('');
    
    await testArenaMethods();
    console.log('');
    
    await testArenaManagerUtils();
    console.log('');
    
    await verifyArenaHistory();
    console.log('');
    
    await detectAndRepairIssues();
    console.log('');
    
    await generateFinalReport();
    
  } catch (error) {
    console.error('\n❌ ERREUR LORS DE LA VÉRIFICATION:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n📴 Déconnexion de la base de données');
  }
}

/**
 * 🏃‍♂️ EXÉCUTION DU SCRIPT
 */
if (require.main === module) {
  main()
    .then(() => {
      console.log('✅ Vérification terminée');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Échec de la vérification:', error);
      process.exit(1);
    });
}

export { main as verifyArenaSystem };
