import defineConfig from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { Server as ColyseusServer } from "colyseus";
import type express from "express";

// 🌍 Rooms
import { WorldRoom } from "./rooms/WorldRoom";

// 🔧 Routes API
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import cryptoRoutes from "./routes/cryptoRoutes";

export default defineConfig({
  initializeGameServer: (gameServer: ColyseusServer) => {
    gameServer.define("world", WorldRoom);
  },

  initializeExpress: (app: express.Application) => {
    console.log("✅ initializeExpress appelé");

    app.use("/api/auth", authRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/crypto", cryptoRoutes);

    app.get("/health", (_req, res) => {
      res.json({
        status: "ok",
        service: "chimarena",
        timestamp: new Date().toISOString(),
      });
    });

    if (process.env.NODE_ENV !== "production") {
      app.use("/colyseus", monitor());
    }
  },

  beforeListen: () => {
    console.log("🟡 beforeListen appelé");
  },
});
