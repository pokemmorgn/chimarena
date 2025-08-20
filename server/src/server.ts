// server/src/server.ts - SERVEUR EXPRESS + COLYSEUS (unifié sur 3000)
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 🎮 COLYSEUS
import { Server as ColyseusServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";

// 🔧 CONFIG / LOG
import { configManager } from './config/ConfigManager';
import { logger } from './utils/Logger';

// DB
import { connectDatabase } from './config/database';

// 🌍 ROOMS
import { WorldRoom } from './rooms/WorldRoom';

const app = express();

// GLOBALS
let httpServer: http.Server;
let gameServer: ColyseusServer;

/**
 * 🚀 INITIALISATION SERVEUR
 */
async function initializeServer() {
  try {
    logger.general.info("🎮 Initialisation du serveur ChimArena...");

    await configManager.initialize();
    await validateEnvironment();

    const config = getServerConfig();

    await setupSecureMiddlewares(app, config);

    await connectDatabase();
    logger.database.info("✅ Base de données connectée");

    // Créer le serveur HTTP (un seul port pour API + WS)
    httpServer = http.createServer(app);

    // 🎮 Colyseus
    setupColyseus(httpServer, app, config);

    // API / Routes
    await setupRoutes(app, config);

    // Gestion erreurs
    setupErrorHandling(app, config);

    // Start HTTP
    await new Promise<void>((resolve) => {
      httpServer.listen(config.port, config.host, () => {
        logger.general.info("🚀 Serveur démarré", {
          port: config.port,
          host: config.host,
          url: `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`
        });
        resolve();
      });
    });

  } catch (err: any) {
    logger.general.error("❌ Erreur critique au démarrage", { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

/**
 * 🎮 CONFIG COLYSEUS
 */
function setupColyseus(server: http.Server, app: express.Application, config: any) {
  gameServer = new ColyseusServer({
    transport: new WebSocketTransport({
      server, // même httpServer que Express
      pingInterval: 3000,
      pingMaxRetries: 3
    })
  });

  gameServer.define("world", WorldRoom);

  if (config.environment !== "production" && config.colyseus.monitor) {
    app.use("/colyseus", monitor());
    app.use("/playground", playground);
  }

  logger.general.info("🎮 Colyseus initialisé", { rooms: ["world"] });
}

/**
 * 🔍 VALIDATION ENV
 */
async function validateEnvironment() {
  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) throw new Error(`Variables manquantes: ${missing.join(",")}`);
}

/**
 * ⚙️ CONFIG
 */
function getServerConfig() {
  return {
    environment: configManager.get('app.env'),
    debug: configManager.isDebug(),
    port: Number(process.env.PORT) || 3000,
    host: configManager.get('server.host') || '0.0.0.0',
    colyseus: {
      enabled: true,
      monitor: process.env.COLYSEUS_MONITOR !== 'false'
    }
  };
}

/**
 * 🛡️ SECURITÉ
 */
async function setupSecureMiddlewares(app: express.Application, config: any) {
  app.set("trust proxy", 1);

  const helmet = require("helmet");
  app.use(helmet({
    contentSecurityPolicy: config.debug ? false : {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: [
          "'self'",
          "https://chimarena.cloud",
          "wss://chimarena.cloud"
        ]
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  const compression = require("compression");
  app.use(compression());

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

  const cookieParser = require("cookie-parser");
  app.use(cookieParser());
}

/**
 * 🛣️ ROUTES
 */
async function setupRoutes(app: express.Application, config: any) {
  app.get("/health", (req, res) => {
    res.json({ status: "OK", uptime: process.uptime() });
  });

  // Auth
  try {
    const authMod = await import("./routes/authRoutes");
    app.use("/api/auth", authMod.default);
  } catch {}

  // User
  try {
    const userMod = await import("./routes/userRoutes");
    app.use("/api/user", userMod.default);
  } catch {}

  // Static SPA
  const staticPath = path.join(__dirname, "../../client/dist");
  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });
  }
}

/**
 * 🚨 ERRORS
 */
function setupErrorHandling(app: express.Application, config: any) {
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.general.error("Erreur serveur", { error: err.message, stack: err.stack });
    res.status(500).json({ error: "Erreur interne" });
  });
}

/**
 * 🛑 SHUTDOWN
 */
async function gracefulShutdown() {
  logger.general.info("🛑 Arrêt serveur...");
  if (gameServer) await gameServer.gracefullyShutdown();
  if (httpServer) httpServer.close();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// 🚀 START
if (require.main === module) {
  initializeServer();
}

export default app;
