// server/src/app.config.ts
import { defineConfig } from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";

// 🌍 Tes rooms
import { WorldRoom } from "./rooms/WorldRoom";

// 🔧 Tes routes API
import express from "express";
import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
// (ajoute cryptoRoutes si nécessaire)

export default defineConfig({
  initialize: (app) => {
    // API routes
    app.use("/api/auth", authRoutes);
    app.use("/api/user", userRoutes);
    // app.use("/api/crypto", cryptoRoutes); // si activé

    // Health
    app.get("/health", (req, res) => {
      res.json({
        status: "ok",
        service: "chimarena",
        timestamp: new Date().toISOString(),
      });
    });

    // Monitor Colyseus (dev uniquement)
    if (process.env.NODE_ENV !== "production") {
      app.use("/colyseus", monitor());
    }
  },

  // 🎮 Définition des rooms Colyseus
  options: {
    world: (room) => room.define("world", WorldRoom),
  },
});
