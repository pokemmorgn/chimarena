// server/src/config/ConfigSchema.ts - ÉTAPE 1 : Validation ultra-sécurisée
import { z } from 'zod';

/**
 * 🔒 SCHEMA DE VALIDATION STRICTE
 * Empêche toute configuration malformée ou dangereuse
 */

// Schéma pour l'application
const AppSchema = z.object({
  name: z.string().min(1).max(50),
  version: z.string().regex(/^\d+\.\d+\.\d+$/), // Format semver
  env: z.enum(['development', 'production', 'test', 'auto']),
  debug: z.boolean(),
  maintenance: z.boolean(),
}).strict();

// Schéma pour le serveur
const ServerSchema = z.object({
  port: z.number().int().min(1000).max(65535),
httpsPort: z.union([z.literal(443), z.number().int().min(1000).max(65535)]),
  host: z.string().ip().or(z.literal('0.0.0.0')).or(z.literal('localhost')),
  corsOrigins: z.array(z.string().url()).max(20),
  staticFiles: z.object({
    enabled: z.boolean(),
    maxAge: z.string().regex(/^\d+[dwmy]?$/), // 1d, 1w, 1m, 1y
    path: z.string().min(1),
  }).strict(),
}).strict();

// Schéma pour la base de données
const DatabaseSchema = z.object({
  uri: z.string().startsWith('mongodb://').or(z.string().startsWith('mongodb+srv://')),
  options: z.object({
    maxPoolSize: z.number().int().min(1).max(100),
    serverSelectionTimeoutMS: z.number().int().min(1000).max(30000),
    socketTimeoutMS: z.number().int().min(5000).max(120000),
    family: z.literal(4).or(z.literal(6)),
    retryWrites: z.boolean(),
    retryReads: z.boolean(),
  }).strict(),
  autoReconnect: z.boolean(),
}).strict();

// Schéma pour l'authentification
const AuthSchema = z.object({
  // jwtSecret devient optionnel (pour compat)
  jwtSecret: z.string().min(32).or(z.literal('ENV_OVERRIDE')).optional(),

  // ⬇️ nouveaux champs, alignés avec ton .env
  accessTokenSecret: z.string().min(32).or(z.literal('ENV_OVERRIDE')),
  refreshTokenSecret: z.string().min(32).or(z.literal('ENV_OVERRIDE')),

  accessTokenExpiry: z.string().regex(/^\d+[smhd]$/), // 15m, 1h, 1d
  refreshTokenExpiry: z.string().regex(/^\d+[smhd]$/),
  maxFailedAttempts: z.number().int().min(3).max(20),
  lockDurationMinutes: z.number().int().min(5).max(1440),
  cookieOptions: z.object({
    httpOnly: z.boolean(),
    secure: z.boolean().or(z.literal('auto')),
    sameSite: z.enum(['strict', 'lax', 'none']),
    maxAge: z.number().int().min(60000),
  }).strict(),
}).strict();

// Schéma pour crypto/MetaMask
const CryptoSchema = z.object({
  enabled: z.boolean(),
  metamask: z.object({
    enabled: z.boolean(),
    supportedNetworks: z.array(z.number().int().positive()).max(10),
    signatureTimeoutSeconds: z.number().int().min(30).max(600), // 30s à 10min
    maxConnectionsPerHour: z.number().int().min(1).max(50),
    maxNoncesStored: z.number().int().min(10).max(1000),
  }).strict(),
  security: z.object({
    requireTimestamp: z.boolean(),
    maxSignatureAge: z.number().int().min(60000).max(3600000), // 1min à 1h
    autoDetectSuspicious: z.boolean(),
    banThreshold: z.number().int().min(50).max(100),
  }).strict(),
}).strict();

// Schéma pour rate limiting
const RateLimitSchema = z.object({
  windowMs: z.number().int().min(60000).max(86400000), // 1min à 24h
  max: z.number().int().min(1).max(10000),
  message: z.string().min(1).max(200),
}).strict();

// Schéma pour la sécurité
const SecuritySchema = z.object({
  rateLimits: z.object({
    auth: RateLimitSchema,
    crypto: RateLimitSchema,
    api: RateLimitSchema,
    registration: RateLimitSchema,
  }).strict(),
  suspicion: z.object({
    threshold: z.number().int().min(10).max(100),
    autobanScore: z.number().int().min(50).max(100),
    accountAgeMinHours: z.number().int().min(1).max(8760), // Max 1 an
    maxUnknownIPs: z.number().int().min(1).max(20),
  }).strict(),
  encryption: z.object({
    algorithm: z.enum(['aes-256-gcm', 'aes-256-cbc']),
    keyDerivation: z.enum(['pbkdf2', 'scrypt']),
  }).strict(),
}).strict();

// Schéma pour les modules de logging
const LogModuleSchema = z.object({
  enabled: z.boolean(),
  level: z.enum(['error', 'warn', 'info', 'debug', 'trace']),
}).catchall(z.union([z.boolean(), z.string(), z.number()])); // Permet champs spécifiques

// Schéma pour le logging
const LoggingSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'trace']),
  modules: z.object({
    auth: LogModuleSchema,
    crypto: LogModuleSchema,
    security: LogModuleSchema,
    api: LogModuleSchema,
    database: LogModuleSchema,
    game: LogModuleSchema,
    performance: LogModuleSchema,
  }).strict(),
  output: z.object({
    console: z.object({
      enabled: z.boolean(),
      colorize: z.boolean(),
      timestamp: z.boolean(),
    }).strict(),
    file: z.object({
      enabled: z.boolean(),
      path: z.string().min(1),
      filename: z.string().min(1),
      maxSize: z.string().regex(/^\d+[kmgt]b?$/i), // 10k, 1mb, 1gb
      maxFiles: z.string().regex(/^\d+[dwmy]?$/), // 7d, 4w, 12m
      datePattern: z.string().min(1),
    }).strict(),
    json: z.object({
      enabled: z.boolean(),
      filename: z.string().min(1),
    }).strict(),
  }).strict(),
  filters: z.object({
    excludePasswords: z.boolean(),
    excludeTokens: z.boolean(),
    excludePrivateKeys: z.boolean(),
    maxStringLength: z.number().int().min(100).max(10000),
  }).strict(),
}).strict();

// Schéma pour les features
const FeaturesSchema = z.object({
  registration: z.boolean(),
  login: z.boolean(),
  guestMode: z.boolean(),
  leaderboard: z.boolean(),
  matchmaking: z.boolean(),
  chatSystem: z.boolean(),
  tournaments: z.boolean(),
  devTools: z.boolean(),
  adminPanel: z.boolean(),
  analytics: z.boolean(),
}).strict();

// Schéma pour le jeu
const GameSchema = z.object({
  maxPlayersOnline: z.number().int().min(1).max(100000),
  matchmaking: z.object({
    enabled: z.boolean(),
    timeoutSeconds: z.number().int().min(10).max(300),
    maxTrophyDifference: z.number().int().min(50).max(1000),
    priorityQueue: z.boolean(),
  }).strict(),
  session: z.object({
    timeoutMinutes: z.number().int().min(5).max(1440), // Max 24h
    extendOnActivity: z.boolean(),
    warningBeforeExpiry: z.number().int().min(30).max(1800), // 30s à 30min
  }).strict(),
  battle: z.object({
    durationSeconds: z.number().int().min(60).max(600), // 1-10 minutes
    overtimeSeconds: z.number().int().min(30).max(180),
    maxElixir: z.number().int().min(5).max(20),
    elixirRegenMs: z.number().int().min(500).max(5000),
  }).strict(),
  cards: z.object({
    maxLevel: z.number().int().min(10).max(20),
    maxDeckSize: z.number().int().min(4).max(12),
    startingCards: z.array(z.string().min(1)).min(1).max(20),
  }).strict(),
  economy: z.object({
    startingGold: z.number().int().min(0).max(1000000),
    startingGems: z.number().int().min(0).max(10000),
    startingElixir: z.number().int().min(0).max(1000),
    dailyRewards: z.boolean(),
  }).strict(),
}).strict();

// Schéma pour les performances
const PerformanceSchema = z.object({
  enableCaching: z.boolean(),
  cacheExpirySeconds: z.number().int().min(60).max(3600), // 1min à 1h
  enableCompression: z.boolean(),
  enableGzip: z.boolean(),
  maxRequestSize: z.string().regex(/^\d+[kmgt]b$/i), // 1kb, 1mb
  timeouts: z.object({
    database: z.number().int().min(1000).max(60000), // 1s à 1min
    crypto: z.number().int().min(1000).max(30000), // 1s à 30s
    api: z.number().int().min(1000).max(30000),
  }).strict(),
}).strict();

// Schéma pour le monitoring
const MonitoringSchema = z.object({
  enabled: z.boolean(),
  healthCheck: z.object({
    enabled: z.boolean(),
    path: z.string().startsWith('/'),
    interval: z.number().int().min(5000).max(300000), // 5s à 5min
  }).strict(),
  metrics: z.object({
    enabled: z.boolean(),
    collectInterval: z.number().int().min(10000).max(600000), // 10s à 10min
  }).strict(),
  alerts: z.object({
    enabled: z.boolean(),
    errorThreshold: z.number().int().min(1).max(1000),
    memoryThreshold: z.number().int().min(50).max(95), // 50% à 95%
  }).strict(),
}).strict();

// SCHÉMA PRINCIPAL DE CONFIGURATION
export const ConfigSchema = z.object({
  app: AppSchema,
  server: ServerSchema,
  database: DatabaseSchema,
  auth: AuthSchema,
  crypto: CryptoSchema,
  security: SecuritySchema,
  logging: LoggingSchema,
  features: FeaturesSchema,
  game: GameSchema,
  performance: PerformanceSchema,
  monitoring: MonitoringSchema,
}).strip();

// Type TypeScript inféré automatiquement
export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * 🔒 VALIDATION SÉCURISÉE
 * Valide une configuration et retourne les erreurs détaillées
 */
export function validateConfig(config: unknown): {
  success: boolean;
  data?: AppConfig;
  errors?: string[];
} {
  try {
    const result = ConfigSchema.safeParse(config);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
const errors = result.error.issues.map((issue: any) =>
  `${issue.path.join('.')}: ${issue.message}`
      );
      
      return {
        success: false,
        errors,
      };
    }
  } catch (error) {
    return {
      success: false,
errors: [`Erreur de validation: ${(error as Error)?.message || 'Erreur inconnue'}`],
    };
  }
}

/**
 * 🔧 VALIDATION PARTIELLE
 * Valide seulement une section de la configuration
 */
export function validateConfigSection(section: keyof AppConfig, data: unknown): {
  success: boolean;
  data?: any;
  errors?: string[];
} {
  const schemas = {
    app: AppSchema,
    server: ServerSchema,
    database: DatabaseSchema,
    auth: AuthSchema,
    crypto: CryptoSchema,
    security: SecuritySchema,
    logging: LoggingSchema,
    features: FeaturesSchema,
    game: GameSchema,
    performance: PerformanceSchema,
    monitoring: MonitoringSchema,
  };

const schema = schemas[section as keyof typeof schemas];
  if (!schema) {
    return {
      success: false,
      errors: [`Section inconnue: ${section}`],
    };
  }

  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    } else {
const errors = result.error.issues.map((issue: any) =>
        `${issue.path.join('.')}: ${issue.message}`
      );
      
      return {
        success: false,
        errors,
      };
    }
  } catch (error) {
    return {
      success: false,
errors: [`Erreur de validation: ${(error as Error)?.message || 'Erreur inconnue'}`],
    };
  }
}

/**
 * 🛡️ VALIDATION DES TYPES DANGEREUX
 * Vérifie qu'aucune valeur dangereuse n'est présente
 */
export function validateSafety(config: AppConfig): {
  safe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Vérifier les ports
  if (config.server.port === config.server.httpsPort) {
    warnings.push('Port HTTP et HTTPS identiques');
  }

  // Vérifier la sécurité auth
  if (config.auth.jwtSecret !== 'ENV_OVERRIDE' && config.auth.jwtSecret.length < 32) {
    warnings.push('JWT Secret trop court (minimum 32 caractères)');
  }

  // Vérifier les rate limits
  if (config.security.rateLimits.auth.max > 100) {
    warnings.push('Rate limit auth très élevé (risque brute force)');
  }

  // Vérifier les logs en production
  if (config.app.env === 'production' && config.logging.level === 'debug') {
    warnings.push('Niveau debug activé en production (risque performance)');
  }

  // Vérifier les features dangereuses
  if (config.app.env === 'production' && config.features.devTools) {
    warnings.push('Dev tools activés en production (risque sécurité)');
  }

  return {
    safe: warnings.length === 0,
    warnings,
  };
}

export default {
  ConfigSchema,
  validateConfig,
  validateConfigSection,
  validateSafety,
};
