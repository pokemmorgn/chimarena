import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import mongoose from "mongoose";

console.log("📁 CWD =", process.cwd());

dotenv.config({ path: path.join(__dirname, "../.env") });

console.log("=== CONFIG ENV ===");
console.log("- .env path:", path.join(__dirname, "../.env"));
console.log("- Existe:", fs.existsSync(path.join(__dirname, "../.env")));
console.log("- Mongo:", process.env.MONGODB_URI ? "✅" : "❌");
console.log("- JWT_ACCESS_SECRET:", process.env.JWT_ACCESS_SECRET ? "✅" : "❌");
console.log("- JWT_REFRESH_SECRET:", process.env.JWT_REFRESH_SECRET ? "✅" : "❌");
console.log("- PORT:", process.env.PORT || "2567");

// ✅ CONNEXION MONGODB CORRIGÉE
const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena';
    console.log('📡 Connexion à MongoDB:', mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connecté avec succès');
    
    // ✅ Vérification sécurisée de la connexion
    try {
      if (mongoose.connection.db) {
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📊 Collections disponibles:', collections.map(c => c.name));
        
        // Test d'une requête simple
        const stats = await mongoose.connection.db.stats();
        console.log('📊 Base de données:', stats.db);
        console.log('📊 Collections count:', stats.collections);
      } else {
        console.log('⚠️ Connexion établie mais db non disponible immédiatement');
      }
    } catch (dbError) {
      console.warn('⚠️ Erreur vérification DB (connexion OK):', (dbError as Error).message);
    }
    
    // Gestion des événements de connexion
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur MongoDB:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB déconnecté');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnecté');
    });
    
  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error);
    console.error('💡 Solutions possibles :');
    console.error('   1. Démarrer MongoDB: sudo systemctl start mongod');
    console.error('   2. Vérifier MONGODB_URI dans .env');
    console.error('   3. Vérifier que MongoDB est installé');
    console.error('   4. Vérifier les permissions MongoDB');
    
    // Ne pas arrêter le serveur en développement
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️ Mode développement: continuation sans MongoDB');
    }
  }
};

import { listen } from "@colyseus/tools";
import config from "./app.config";

const port = parseInt(process.env.PORT || "2567", 10);

// ✅ DÉMARRAGE SERVEUR AVEC GESTION D'ERREURS
const startServer = async () => {
  try {
    console.log('🚀 Démarrage du serveur ChimArena...');
    
    // Connecter MongoDB en premier
    await connectMongoDB();
    
    // Démarrer le serveur Colyseus
    await listen(config, port);
    console.log(`✅ Serveur Colyseus démarré sur :${port}`);
    console.log(`🌐 API disponible sur http://localhost:${port}/api`);
    console.log(`🎮 Health check: http://localhost:${port}/health`);
    
  } catch (error) {
    console.error('💥 Erreur critique lors du démarrage:', error);
    
    if (error instanceof Error) {
      console.error('📋 Détails:', error.message);
      console.error('📋 Stack:', error.stack?.split('\n').slice(0, 5));
    }
    
    console.error('💡 Vérifications recommandées :');
    console.error('   1. Port disponible:', port);
    console.error('   2. Variables ENV définies');
    console.error('   3. MongoDB démarré');
    console.error('   4. Dépendances installées');
    
    process.exit(1);
  }
};

// ✅ GESTION PROPRE DE L'ARRÊT
const gracefulShutdown = async (signal: string) => {
  console.log(`\n📴 Signal reçu: ${signal}`);
  console.log('🧹 Arrêt propre du serveur...');
  
  try {
    // Fermer la connexion MongoDB
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('📴 MongoDB déconnecté');
    }
    
    console.log('✅ Arrêt propre terminé');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur lors de l\'arrêt:', error);
    process.exit(1);
  }
};

// Écouter les signaux d'arrêt
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Gestion des erreurs non catchées
process.on('uncaughtException', (error) => {
  console.error('💥 Exception non gérée:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesse rejetée non gérée:', reason);
  console.error('💥 Promesse:', promise);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// ✅ DÉMARRER LE SERVEUR
startServer().catch(error => {
  console.error('💥 Échec démarrage serveur:', error);
  process.exit(1);
});
