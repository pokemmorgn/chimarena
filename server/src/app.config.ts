// server/src/app.config.ts
import defineConfig from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { Server as ColyseusServer } from "@colyseus/core";
import type express from "express";

// Import des rooms
import { WorldRoom } from "./rooms/WorldRoom";

// Import des middlewares
import { setupMiddlewares } from "./config/middlewares";

// Import des routes
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import cryptoRoutes from "./routes/cryptoRoutes";

export default defineConfig({
  initializeGameServer: (gameServer: ColyseusServer) => {
    console.log("🎮 Initialisation Colyseus GameServer...");
    
    // Définir les rooms
    gameServer.define("world", WorldRoom);
    
    console.log("✅ Rooms Colyseus enregistrées");
  },

  initializeExpress: (app: express.Application) => {
    console.log("🌐 Initialisation Express...");

    // Middlewares
    setupMiddlewares(app);
    
    // Routes API
    app.use("/api/auth", authRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/crypto", cryptoRoutes);

    // Health check
    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        service: "chimarena",
        timestamp: new Date().toISOString(),
        colyseus: "enabled",
        api: "enabled"
      });
    });

    // Monitoring en développement
    if (process.env.NODE_ENV !== "production") {
      app.use("/colyseus", monitor());
      console.log("🔧 Colyseus Monitor activé sur /colyseus");
    }
    
    console.log("✅ Express initialisé");
  },

  beforeListen: () => {
    console.log("🚀 Démarrage serveur Colyseus...");
  },
});
