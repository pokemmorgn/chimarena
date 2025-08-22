// server/src/server.ts - VERSION COLYSEUS CORRECTE
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

// ✅ CONNEXION MONGODB
const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena';
    console.log('📡 Connexion à MongoDB:', mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connecté avec succès');
    
    // Gestion des événements de connexion
    mongoose.connection.on('error', (err) => {
      console.error('❌ Erreur MongoDB:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB déconnecté');
    });
    
  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error);
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️ Mode développement: continuation sans MongoDB');
    }
  }
};

// ✅ IMPORT COLYSEUS APRÈS LA CONFIG ENV
import { listen } from "@colyseus/tools";
import config from "./app.config";

// Port Colyseus (par défaut 2567)
const port = parseInt(process.env.PORT || "2567", 10);

// ✅ DÉMARRAGE SERVEUR AVEC COLYSEUS
const startServer = async () => {
  try {
    console.log('🚀 Démarrage ChimArena avec Colyseus...');
    
    // 1. Connecter MongoDB en premier
    await connectMongoDB();
    
    // 2. Démarrer Colyseus (qui inclut Express)
    console.log(`🎮 Démarrage Colyseus sur port ${port}...`);
    await listen(config, port);
    
    console.log(`✅ Serveur ChimArena démarré !`);
    console.log(`🌐 API HTTP: http://localhost:${port}/api`);
    console.log(`🎮 WebSocket: ws://localhost:${port}`);
    console.log(`🔧 Health: http://localhost:${port}/health`);
    
    if (process.env.NODE_ENV !== "production") {
      console.log(`🔧 Monitor: http://localhost:${port}/colyseus`);
    }
    
  } catch (error) {
    console.error('💥 Erreur critique:', error);
    
    if (error instanceof Error) {
      console.error('📋 Message:', error.message);
      console.error('📋 Stack:', error.stack?.split('\n').slice(0, 5));
    }
    
    process.exit(1);
  }
};

// ✅ GESTION ARRÊT PROPRE
const gracefulShutdown = async (signal: string) => {
  console.log(`\n📴 Signal reçu: ${signal}`);
  console.log('🧹 Arrêt propre...');
  
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('📴 MongoDB déconnecté');
    }
    
    console.log('✅ Arrêt propre terminé');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur arrêt:', error);
    process.exit(1);
  }
};

// Signaux d'arrêt
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Erreurs non gérées
process.on('uncaughtException', (error) => {
  console.error('💥 Exception non gérée:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Promesse rejetée:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// ✅ DÉMARRER
startServer().catch(error => {
  console.error('💥 Échec démarrage:', error);
  process.exit(1);
});
