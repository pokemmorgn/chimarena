// server/src/app.config.ts
import defineConfig from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import type express from "express";

// 🌍 Rooms
import { WorldRoom } from "./rooms/WorldRoom";

// 🔧 Routes API
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import cryptoRoutes from "./routes/cryptoRoutes";

export default defineConfig({
  /**
   * Define Colyseus rooms here.
   */
  initializeGameServer: (gameServer) => {
    gameServer.define("world", WorldRoom);
  },

  /**
   * Configure the Express app (middlewares, routes, health, monitor, ...).
   */
  initializeExpress: (app: express.Application) => {
    // === API ROUTES ===
    app.use("/api/auth", authRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/crypto", cryptoRoutes);

    // Health
    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        service: "chimarena",
        timestamp: new Date().toISOString(),
      });
    });

    // Colyseus Monitor (dev only)
    if (process.env.NODE_ENV !== "production") {
      app.use("/colyseus", monitor());
    }
  },

  /**
   * Optional hook before the HTTP server starts listening.
   */
  beforeListen: () => {
    // e.g., warmups, schedule jobs, etc.
  },
});
