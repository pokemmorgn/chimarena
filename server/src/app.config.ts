// server/src/app.config.ts
import defineConfig from "@colyseus/tools";
import { WorldRoom } from "./rooms/WorldRoom";
import express, { Request, Response, Application } from "express";


// 🔧 Routes API
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import cryptoRoutes from "./routes/cryptoRoutes";

export default defineConfig({
  initialize: (app) => {
    // === API ROUTES ===
    app.use("/api/auth", authRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/crypto", cryptoRoutes);

    // Health
    app.get("/health", (req, res) => {
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

  // === ROOMS ===
  options: {
    world: (room) => room.define("world", WorldRoom),
  },
});
