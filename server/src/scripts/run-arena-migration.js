// server/scripts/run-arena-migration.js - EXÉCUTEUR DE MIGRATION SIMPLE
const { execSync } = require('child_process');
const path = require('path');

console.log('🏟️ ChimArena - Migration vers le système d\'arènes');
console.log('==================================================\n');

try {
  // Compiler le TypeScript si nécessaire
  console.log('🔧 Compilation du TypeScript...');
  execSync('npm run build', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe' 
  });
  console.log('✅ Compilation réussie\n');
  
  // Exécuter la migration
  console.log('🚀 Lancement de la migration...');
  execSync('node build/scripts/migrate-arenas.js', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit' // Voir la sortie en temps réel
  });
  
  console.log('\n🎉 Migration terminée avec succès !');
  
} catch (error) {
  console.error('\n❌ Erreur lors de la migration:', error.message);
  
  if (error.message.includes('build')) {
    console.log('\n💡 Conseil: Assurez-vous que TypeScript est installé et configuré');
    console.log('   npm install -g typescript');
    console.log('   npm install');
  }
  
  process.exit(1);
}

console.log('\n📋 Prochaines étapes:');
console.log('   1. Vérifiez vos utilisateurs en base');
console.log('   2. Testez le système d\'arènes');
console.log('   3. Redémarrez votre serveur\n');
