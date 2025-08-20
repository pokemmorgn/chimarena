import path from "path";
import fs from "fs";
import dotenv from "dotenv";

// 🚨 LOGS FORCÉS PARTOUT - IMPOSSIBLES À RATER
console.log("🚀🚀🚀 DÉMARRAGE CHIMARENA - LOGS FORCÉS 🚀🚀🚀");
console.log("📅 Timestamp:", new Date().toISOString());
console.log("📁 CWD:", process.cwd());
console.log("📁 __dirname:", __dirname);
console.log("🔧 Node version:", process.version);

// Charger .env AVEC LOGS
const envPath = path.join(__dirname, "../.env");
console.log("📋 Tentative chargement .env:", envPath);
console.log("📋 .env existe?", fs.existsSync(envPath));
dotenv.config({ path: envPath });
console.log("✅ .env chargé");

// Vérifier variables critiques
console.log("=== VARIABLES ENVIRONNEMENT ===");
console.log("- MONGODB_URI:", process.env.MONGODB_URI ? "✅ OK" : "❌ MANQUANT");
console.log("- JWT_ACCESS_SECRET:", process.env.JWT_ACCESS_SECRET ? "✅ OK" : "❌ MANQUANT");
console.log("- JWT_REFRESH_SECRET:", process.env.JWT_REFRESH_SECRET ? "✅ OK" : "❌ MANQUANT");
console.log("- NODE_ENV:", process.env.NODE_ENV || "❌ NON DÉFINI");
console.log("- PORT:", process.env.PORT || "❌ NON DÉFINI");

// Vérifier le config.json
const configPath = path.join(process.cwd(), 'config.json');
console.log("🔧 Chemin config.json:", configPath);
console.log("🔧 config.json existe?", fs.existsSync(configPath));

if (fs.existsSync(configPath)) {
  try {
    const configContent = fs.readFileSync(configPath, 'utf8');
    console.log("📄 Taille config.json:", configContent.length, "caractères");
    
    const config = JSON.parse(configContent);
    console.log("📄 Config parsé - logging.level:", config.logging?.level);
    console.log("📄 Config parsé - console.enabled:", config.logging?.output?.console?.enabled);
  } catch (error) {
    console.error("❌ ERREUR LECTURE config.json:", (error as Error).message);
  }
} else {
  console.error("❌ config.json INTROUVABLE!");
}

// Handler d'erreur AVANT tout
process.on('uncaughtException', (error) => {
  console.error('💥💥💥 ERREUR NON GÉRÉE:', error.message);
  console.error('💥💥💥 Stack:', error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥💥💥 PROMESSE REJETÉE:', reason);
});

// Fonction de démarrage avec try/catch partout
async function startServerWithDebug() {
  console.log("🚀 startServerWithDebug() appelée");
  
  try {
    console.log("📦 Import @colyseus/tools...");
    const { listen } = await import("@colyseus/tools");
    console.log("✅ @colyseus/tools importé");

    console.log("📦 Import app.config...");
    const configModule = await import("./app.config");
    const config = configModule.default;
    console.log("✅ app.config importé");

    // Tenter d'initialiser ConfigManager
    console.log("🔧 Tentative import ConfigManager...");
    try {
      const { configManager } = await import('./config/ConfigManager');
      console.log("✅ ConfigManager importé");
      
      console.log("🔧 Tentative initialisation ConfigManager...");
      await configManager.initialize();
      console.log("✅ ConfigManager initialisé avec succès");
      
      // Tester le logger
      console.log("📝 Import Logger...");
      const { logger } = await import('./utils/Logger');
      console.log("✅ Logger importé");
      
      logger.general.info("🎉 LOGGER FONCTIONNE!");
      logger.api.debug("🎉 LOGGER API FONCTIONNE!");
      console.log("✅ Logger testé avec succès");
      
    } catch (configError) {
      console.error("❌ ERREUR ConfigManager/Logger:", (configError as Error).message);
      console.error("❌ Stack ConfigManager:", (configError as Error).stack);
      console.log("⚠️ Continuons sans ConfigManager...");
    }

    // Connecter base de données
    console.log("🔌 Tentative connexion base de données...");
    try {
      const dbModule = await import('./config/database.js');
      await dbModule.connectDatabase();
      console.log("✅ Base de données connectée");
    } catch (dbError) {
      console.error("❌ ERREUR BDD:", (dbError as Error).message);
      console.log("⚠️ Continuons sans BDD...");
    }

    // Démarrer serveur
    const port = parseInt(process.env.PORT || "3000", 10);
    console.log(`🚀 Démarrage serveur Colyseus sur port ${port}...`);
    
    await listen(config, port);
    
    console.log("✅✅✅ SERVEUR DÉMARRÉ AVEC SUCCÈS ✅✅✅");
    console.log(`✅ Port: ${port}`);
    console.log(`✅ PID: ${process.pid}`);
    console.log(`✅ Timestamp: ${new Date().toISOString()}`);

  } catch (error) {
    console.error("💥💥💥 ERREUR FATALE:");
    console.error("💥 Message:", (error as Error)?.message);
    console.error("💥 Stack:", (error as Error)?.stack);
    console.error("💥 Type:", typeof error);
    console.error("💥 Constructor:", (error as Error)?.constructor?.name);
    
    process.exit(1);
  }
}

// Log périodique pour prouver que le serveur tourne
let heartbeatCount = 0;
setInterval(() => {
  heartbeatCount++;
  console.log(`❤️ HEARTBEAT ${heartbeatCount} - ${new Date().toISOString()} - Uptime: ${Math.floor(process.uptime())}s - Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
}, 10000); // Toutes les 10 secondes

console.log("🚀 Appel startServerWithDebug()...");
startServerWithDebug();
