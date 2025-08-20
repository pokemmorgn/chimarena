// server/src/server.ts - AJOUTER LA CONNEXION MONGODB
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import mongoose from "mongoose"; // ✅ AJOUTER CETTE LIGNE

console.log("📁 CWD =", process.cwd());

dotenv.config({ path: path.join(__dirname, "../.env") });

console.log("=== CONFIG ENV ===");
console.log("- .env path:", path.join(__dirname, "../.env"));
console.log("- Existe:", fs.existsSync(path.join(__dirname, "../.env")));
console.log("- Mongo:", process.env.MONGODB_URI ? "✅" : "❌");
console.log("- JWT_ACCESS_SECRET:", process.env.JWT_ACCESS_SECRET ? "✅" : "❌");
console.log("- JWT_REFRESH_SECRET:", process.env.JWT_REFRESH_SECRET ? "✅" : "❌");
console.log("- PORT:", process.env.PORT || "2567");

// ✅ AJOUTER LA CONNEXION MONGODB ICI
const connectMongoDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena';
    console.log('📡 Connexion à MongoDB:', mongoUri);
    
    await mongoose.connect(mongoUri);
    console.log('✅ MongoDB connecté avec succès');
    
    // Vérifier la connexion
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📊 Collections disponibles:', collections.map(c => c.name));
    
  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error);
    console.error('💡 Solutions :');
    console.error('   1. Démarrer MongoDB: sudo systemctl start mongod');
    console.error('   2. Vérifier MONGODB_URI dans .env');
    console.error('   3. Installer MongoDB si nécessaire');
    process.exit(1);
  }
};

import { listen } from "@colyseus/tools";
import config from "./app.config";

const port = parseInt(process.env.PORT || "2567", 10);

// ✅ CONNECTER MONGODB AVANT DE DÉMARRER LE SERVEUR
const startServer = async () => {
  await connectMongoDB();
  
  listen(config, port).then(() => {
    console.log(`✅ Serveur Colyseus démarré sur :${port}`);
  });
};

startServer().catch(error => {
  console.error('💥 Erreur démarrage serveur:', error);
  process.exit(1);
});
