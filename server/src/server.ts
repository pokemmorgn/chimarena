// server/src/server.ts

import path from "path";
import fs from "fs";
import dotenv from "dotenv";
console.log('CWD =', process.cwd());

// ✅ Charger .env à partir de la racine du projet
dotenv.config({ path: path.join(__dirname, "../.env") });

// Vérif rapide
console.log("=== CONFIG ENV ===");
console.log("- .env path:", path.join(__dirname, "../.env"));
console.log("- Existe:", fs.existsSync(path.join(__dirname, "../.env")));
console.log("- Mongo:", process.env.MONGODB_URI ? "✅" : "❌");
console.log("- JWT_SECRET:", process.env.JWT_SECRET ? "✅" : "❌");
console.log("- PORT:", process.env.PORT || "2567");

// Import Colyseus Tools
import { listen } from "@colyseus/tools";
import appConfig from "./app.config";

// 🚀 Démarrage Colyseus
const port = parseInt(process.env.PORT || "2567");
listen(appConfig, port).then(() => {
  console.log(`✅ Serveur Colyseus démarré sur :${port}`);
});
