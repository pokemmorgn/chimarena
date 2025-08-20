// server/src/app.config.ts
import defineConfig from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";

// 🌍 Rooms
import { WorldRoom } from "./rooms/WorldRoom";

// 🔧 Routes API
import express, { Application, Request, Response } from "express";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import cryptoRoutes from "./routes/cryptoRoutes";

export default defineConfig({
  // Initialise l'app Express (middlewares, routes HTTP, etc.)
  initialize: (app: Application) => {
    // === API ROUTES ===
    app.use("/api/auth", authRoutes);
    app.use("/api/user", userRoutes);
    app.use("/api/crypto", cryptoRoutes);

    // Health
    app.get("/health", (req: Request, res: Response) => {
      res.json({
        status: "ok",
        service: "chimarena",
        timestamp: new Date().toISOString(),
      });
    });

    // Colyseus Monitor (dev uniquement)
    if (process.env.NODE_ENV !== "production") {
      app.use("/colyseus", monitor());
    }
  },

  // Déclaration des rooms Colyseus (API v0.16)
  rooms: (room) => {
    room.define("world", WorldRoom);
  },
});
