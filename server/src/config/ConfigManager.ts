// server/src/config/ConfigManager.ts - ÉTAPE 2 : Hot reload ultra-sécurisé
import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { AppConfig, validateConfig, validateSafety } from './ConfigSchema';

interface ConfigChangeEvent {
  timestamp: Date;
  source: 'file' | 'api' | 'manual';
  path?: string;
  oldValue?: any;
  newValue?: any;
  userId?: string;
  ip?: string;
}

interface ConfigBackup {
  timestamp: Date;
  config: AppConfig;
  reason: string;
  version: string;
}

/**
 * 🔒 GESTIONNAIRE DE CONFIGURATION SÉCURISÉ
 * Hot reload avec validation stricte et rollback automatique
 */
class SecureConfigManager extends EventEmitter {
  private config: AppConfig | null = null;
  private configPath: string;
  private backupDir: string;
  private watcher: fs.FSWatcher | null = null;
  private isLoading = false;
  private lastModified = 0;
  private backups: ConfigBackup[] = [];
  private maxBackups = 10;
  private isInitialized = false;

  constructor(configPath?: string) {
    super();
    this.configPath = configPath || path.join(process.cwd(), 'config.json');
    this.backupDir = path.join(path.dirname(this.configPath), 'config', 'backup');
    this.setupErrorHandling();
    this.ensureDirectories();
  }

  /**
   * 🚀 INITIALISATION SÉCURISÉE
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      throw new Error('ConfigManager déjà initialisé');
    }

    try {
      console.log('🔧 Initialisation ConfigManager sécurisé...');
      
      // 1. Créer config par défaut si inexistante
      await this.ensureConfigExists();
      
      // 2. Charger la configuration
      await this.loadConfig('initialization');
      
      // 3. Appliquer les overrides d'environnement
      this.applyEnvironmentOverrides();
      
      // 4. Validation de sécurité
      const safety = validateSafety(this.config!);
      if (!safety.safe) {
        console.warn('⚠️ Avertissements de sécurité:', safety.warnings);
      }
      
      // 5. Créer backup initial
      await this.createBackup('initialization');
      
      // 6. Démarrer le watcher
      this.setupWatcher();
      
      this.isInitialized = true;
      
      console.log('✅ ConfigManager initialisé avec succès');
      console.log(`📁 Fichier: ${this.configPath}`);
      console.log(`🌍 Environnement: ${this.get('app.env')}`);
      console.log(`🔍 Debug: ${this.get('app.debug') ? 'Activé' : 'Désactivé'}`);
      console.log(`🛡️ Sécurité: ${safety.safe ? 'OK' : `${safety.warnings.length} avertissements`}`);
      
      this.emit('initialized', { config: this.config });
      
    } catch (error) {
      console.error('❌ Erreur initialisation ConfigManager:', error);
      throw error;
    }
  }

  /**
   * 📁 S'assurer que les répertoires existent
   */
  private ensureDirectories(): void {
    const configDir = path.dirname(this.configPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * 📄 S'assurer que le fichier config existe
   */
  private async ensureConfigExists(): Promise<void> {
    if (!fs.existsSync(this.configPath)) {
      console.log('📄 Création config par défaut...');
      
      const defaultConfig = this.getDefaultConfig();
      await this.saveConfigToFile(defaultConfig, 'default_creation');
      
      console.log('✅ Configuration par défaut créée');
    }
  }

  /**
   * ⚙️ Configuration par défaut
   */
  private getDefaultConfig(): AppConfig {
    return {
      app: {
        name: "ChimArena",
        version: "1.0.0",
        env: "auto",
        debug: false,
        maintenance: false
      },
      server: {
        port: 3000,
        httpsPort: 443,
        host: "0.0.0.0",
        corsOrigins: [
          "https://chimarena.cloud",
          "http://localhost:8080"
        ],
        staticFiles: {
          enabled: true,
          maxAge: "1y",
          path: "../../client/dist"
        }
      },
      database: {
        uri: "mongodb://localhost:27017/chimarena",
        options: {
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000,
          socketTimeoutMS: 45000,
          family: 4,
          retryWrites: true,
          retryReads: true
        },
        autoReconnect: true
      },
      auth: {
        jwtSecret: "ENV_OVERRIDE",
        accessTokenExpiry: "15m",
        refreshTokenExpiry: "7d",
        maxFailedAttempts: 5,
        lockDurationMinutes: 30,
        cookieOptions: {
          httpOnly: true,
          secure: "auto",
          sameSite: "strict",
          maxAge: 604800000
        }
      },
      crypto: {
        enabled: true,
        metamask: {
          enabled: true,
          supportedNetworks: [1, 137, 56],
          signatureTimeoutSeconds: 300,
          maxConnectionsPerHour: 3,
          maxNoncesStored: 100
        },
        security: {
          requireTimestamp: true,
          maxSignatureAge: 300000,
          autoDetectSuspicious: true,
          banThreshold: 80
        }
      },
      security: {
        rateLimits: {
          auth: { windowMs: 900000, max: 10, message: "Trop de tentatives de connexion" },
          crypto: { windowMs: 3600000, max: 20, message: "Trop d'actions crypto" },
          api: { windowMs: 900000, max: 1000, message: "Trop de requêtes" },
          registration: { windowMs: 3600000, max: 3, message: "Trop d'inscriptions" }
        },
        suspicion: {
          threshold: 50,
          autobanScore: 80,
          accountAgeMinHours: 24,
          maxUnknownIPs: 3
        },
        encryption: {
          algorithm: "aes-256-gcm",
          keyDerivation: "pbkdf2"
        }
      },
      logging: {
        level: "info",
        modules: {
          auth: { enabled: true, level: "info" },
          crypto: { enabled: true, level: "debug" },
          security: { enabled: true, level: "warn" },
          api: { enabled: false, level: "error" },
          database: { enabled: true, level: "info" },
          game: { enabled: true, level: "info" },
          performance: { enabled: false, level: "debug" }
        },
        output: {
          console: { enabled: true, colorize: true, timestamp: true },
          file: { enabled: false, path: "./logs", filename: "chimarena-%DATE%.log", maxSize: "20mb", maxFiles: "14d", datePattern: "YYYY-MM-DD" },
          json: { enabled: false, filename: "chimarena-json-%DATE%.log" }
        },
        filters: {
          excludePasswords: true,
          excludeTokens: true,
          excludePrivateKeys: true,
          maxStringLength: 1000
        }
      },
      features: {
        registration: true,
        login: true,
        guestMode: false,
        leaderboard: true,
        matchmaking: true,
        chatSystem: false,
        tournaments: false,
        devTools: false,
        adminPanel: false,
        analytics: false
      },
      game: {
        maxPlayersOnline: 1000,
        matchmaking: {
          enabled: true,
          timeoutSeconds: 30,
          maxTrophyDifference: 200,
          priorityQueue: true
        },
        session: {
          timeoutMinutes: 60,
          extendOnActivity: true,
          warningBeforeExpiry: 300
        },
        battle: {
          durationSeconds: 180,
          overtimeSeconds: 60,
          maxElixir: 10,
          elixirRegenMs: 1000
        },
        cards: {
          maxLevel: 14,
          maxDeckSize: 8,
          startingCards: ["knight", "archers", "fireball", "arrows"]
        },
        economy: {
          startingGold: 1000,
          startingGems: 50,
          startingElixir: 100,
          dailyRewards: true
        }
      },
      performance: {
        enableCaching: true,
        cacheExpirySeconds: 300,
        enableCompression: true,
        enableGzip: true,
        maxRequestSize: "1mb",
        timeouts: {
          database: 30000,
          crypto: 10000,
          api: 5000
        }
      },
      monitoring: {
        enabled: false,
        healthCheck: {
          enabled: true,
          path: "/health",
          interval: 30000
        },
        metrics: {
          enabled: false,
          collectInterval: 60000
        },
        alerts: {
          enabled: false,
          errorThreshold: 10,
          memoryThreshold: 85
        }
      }
    };
  }

  /**
   * 📖 CHARGEMENT SÉCURISÉ DE LA CONFIGURATION
   */
  private async loadConfig(source: string): Promise<void> {
    if (this.isLoading) {
      console.log('⏳ Chargement déjà en cours, attente...');
      return;
    }

    this.isLoading = true;

    try {
      // Vérifier existence
      if (!fs.existsSync(this.configPath)) {
        throw new Error(`Fichier de configuration non trouvé: ${this.configPath}`);
      }

      // Vérifier date de modification
      const stats = fs.statSync(this.configPath);
      if (stats.mtime.getTime() === this.lastModified && this.config) {
        this.isLoading = false;
        return; // Pas de changement
      }

      console.log(`🔄 Chargement configuration (${source})...`);

      // Lire et parser
      const configData = fs.readFileSync(this.configPath, 'utf8');
      const parsedConfig = JSON.parse(configData);

      // Validation stricte
      const validation = validateConfig(parsedConfig);
      if (!validation.success) {
        const errorMsg = `Configuration invalide:\n${validation.errors?.join('\n')}`;
        console.error('❌ ' + errorMsg);
        
        if (this.config) {
          console.warn('⚠️ Conservation de la configuration précédente');
          this.isLoading = false;
          return;
        } else {
          throw new Error(errorMsg);
        }
      }

      // Validation de sécurité
      const safety = validateSafety(validation.data!);
      if (!safety.safe) {
        console.warn('🛡️ Avertissements de sécurité:', safety.warnings);
      }

      // Appliquer la nouvelle configuration
      const oldConfig = this.config;
      this.config = validation.data!;
      this.lastModified = stats.mtime.getTime();

      // Auto-détecter l'environnement
      if (this.config.app.env === 'auto') {
        this.config.app.env = (process.env.NODE_ENV as any) || 'development';
      }

      console.log('✅ Configuration chargée avec succès');

      // Émettre événement de changement
      if (oldConfig) {
        const changeEvent: ConfigChangeEvent = {
          timestamp: new Date(),
          source: source as any,
          oldValue: oldConfig,
          newValue: this.config
        };
        
        this.emit('configChanged', changeEvent);
        console.log(`🔄 Configuration mise à jour (${source})`);
      }

    } catch (error) {
      console.error('❌ Erreur chargement configuration:', error);
      
      if (!this.config) {
        throw new Error('Impossible de charger la configuration initiale: ' + error.message);
      }
      
      console.warn('⚠️ Configuration précédente conservée');
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 🔐 APPLIQUER LES OVERRIDES D'ENVIRONNEMENT
   */
  private applyEnvironmentOverrides(): void {
    if (!this.config) return;

    console.log('🔧 Application des overrides d\'environnement...');

    // JWT Secret obligatoire depuis env
    if (this.config.auth.jwtSecret === 'ENV_OVERRIDE') {
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET variable d\'environnement requise');
      }
      if (jwtSecret.length < 32) {
        throw new Error('JWT_SECRET doit contenir au moins 32 caractères');
      }
      this.config.auth.jwtSecret = jwtSecret;
    }

    // Database URI
    if (process.env.MONGODB_URI) {
      this.config.database.uri = process.env.MONGODB_URI;
    }

    // Ports
    if (process.env.PORT) {
      const port = parseInt(process.env.PORT, 10);
      if (port > 0 && port < 65536) {
        this.config.server.port = port;
      }
    }

    if (process.env.HTTPS_PORT) {
      const httpsPort = parseInt(process.env.HTTPS_PORT, 10);
      if (httpsPort > 0 && httpsPort < 65536) {
        this.config.server.httpsPort = httpsPort;
      }
    }

    // Sécurité selon environnement
    if (this.config.app.env === 'production') {
      this.config.auth.cookieOptions.secure = true;
      this.config.app.debug = false;
      this.config.features.devTools = false;
      this.config.features.adminPanel = false;
      
      // Forcer certains niveaux de logs en prod
      if (this.config.logging.level === 'debug' || this.config.logging.level === 'trace') {
        console.warn('⚠️ Niveau de log forcé à "info" en production');
        this.config.logging.level = 'info';
      }
    } else {
      this.config.auth.cookieOptions.secure = false;
    }

    console.log('✅ Overrides d\'environnement appliqués');
  }

  /**
   * 👁️ CONFIGURER LE WATCHER POUR HOT RELOAD
   */
  private setupWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    try {
      this.watcher = fs.watch(this.configPath, { persistent: true }, (eventType, filename) => {
        if (eventType === 'change' && filename) {
          console.log('📝 Fichier de configuration modifié, rechargement...');
          
          // Petit délai pour éviter les events multiples
          setTimeout(async () => {
            try {
              await this.createBackup('auto_reload');
              await this.loadConfig('file_watch');
            } catch (error) {
              console.error('❌ Erreur lors du rechargement automatique:', error);
            }
          }, 100);
        }
      });

      console.log('👁️ Watcher de configuration activé');
    } catch (error) {
      console.error('❌ Impossible de créer le watcher:', error);
    }
  }

  /**
   * 💾 CRÉER UN BACKUP
   */
  private async createBackup(reason: string): Promise<void> {
    if (!this.config) return;

    try {
      const backup: ConfigBackup = {
        timestamp: new Date(),
        config: JSON.parse(JSON.stringify(this.config)), // Deep copy
        reason,
        version: this.config.app.version
      };

      // Ajouter au tableau des backups
      this.backups.unshift(backup);

      // Limiter le nombre de backups en mémoire
      if (this.backups.length > this.maxBackups) {
        this.backups = this.backups.slice(0, this.maxBackups);
      }

      // Sauvegarder sur disque
      const backupFilename = `config.backup.${Date.now()}.json`;
      const backupPath = path.join(this.backupDir, backupFilename);
      
      const backupData = {
        meta: {
          timestamp: backup.timestamp.toISOString(),
          reason: backup.reason,
          version: backup.version,
          originalPath: this.configPath
        },
        config: backup.config
      };

      fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

      // Nettoyer les anciens backups (garder 50 derniers)
      this.cleanupOldBackups();

      console.log(`💾 Backup créé: ${backupFilename} (${reason})`);
    } catch (error) {
      console.error('❌ Erreur création backup:', error);
    }
  }

  /**
   * 🧹 NETTOYER LES ANCIENS BACKUPS
   */
  private cleanupOldBackups(): void {
    try {
      const backupFiles = fs.readdirSync(this.backupDir)
        .filter(file => file.startsWith('config.backup.') && file.endsWith('.json'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          timestamp: fs.statSync(path.join(this.backupDir, file)).mtime.getTime()
        }))
        .sort((a, b) => b.timestamp - a.timestamp);

      // Garder les 50 plus récents
      const toDelete = backupFiles.slice(50);
      
      for (const file of toDelete) {
        fs.unlinkSync(file.path);
      }

      if (toDelete.length > 0) {
        console.log(`🧹 ${toDelete.length} anciens backups supprimés`);
      }
    } catch (error) {
      console.error('❌ Erreur nettoyage backups:', error);
    }
  }

  /**
   * 📖 OBTENIR UNE VALEUR DE CONFIGURATION
   */
  get<T = any>(path: string, defaultValue?: T): T {
    if (!this.config) {
      throw new Error('Configuration non initialisée');
    }

    const value = this.getNestedValue(this.config, path);
    return value !== undefined ? value : defaultValue;
  }

  /**
   * ✏️ DÉFINIR UNE VALEUR DE CONFIGURATION (en mémoire)
   */
  set(path: string, value: any, metadata?: { userId?: string; ip?: string }): void {
    if (!this.config) {
      throw new Error('Configuration non initialisée');
    }

    const oldValue = this.getNestedValue(this.config, path);
    this.setNestedValue(this.config, path, value);

    const changeEvent: ConfigChangeEvent = {
      timestamp: new Date(),
      source: 'api',
      path,
      oldValue,
      newValue: value,
      userId: metadata?.userId,
      ip: metadata?.ip
    };

    this.emit('configChanged', changeEvent);
    console.log(`🔧 Configuration modifiée: ${path} = ${JSON.stringify(value)}`);
  }

  /**
   * 💾 SAUVEGARDER LA CONFIGURATION DANS LE FICHIER
   */
  async saveConfig(reason = 'manual_save', metadata?: { userId?: string; ip?: string }): Promise<void> {
    if (!this.config) {
      throw new Error('Configuration non initialisée');
    }

    try {
      await this.createBackup(reason);
      await this.saveConfigToFile(this.config, reason);
      
      console.log(`💾 Configuration sauvegardée (${reason})`);
      
      if (metadata?.userId) {
        console.log(`👤 Sauvegardé par: ${metadata.userId} (${metadata.ip})`);
      }
    } catch (error) {
      console.error('❌ Erreur sauvegarde configuration:', error);
      throw error;
    }
  }

  /**
   * 💾 SAUVEGARDER DANS LE FICHIER (méthode interne)
   */
  private async saveConfigToFile(config: AppConfig, reason: string): Promise<void> {
    const configData = JSON.stringify(config, null, 2);
    
    // Temporairement désactiver le watcher pour éviter les boucles
    const wasWatching = !!this.watcher;
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    try {
      fs.writeFileSync(this.configPath, configData, 'utf8');
      this.lastModified = fs.statSync(this.configPath).mtime.getTime();
    } finally {
      // Réactiver le watcher
      if (wasWatching) {
        setTimeout(() => this.setupWatcher(), 100);
      }
    }
  }

  /**
   * 🔄 RECHARGER LA CONFIGURATION
   */
  async reload(): Promise<void> {
    console.log('🔄 Rechargement manuel de la configuration...');
    await this.createBackup('manual_reload');
    await this.loadConfig('manual');
  }

  /**
   * ↩️ RESTAURER DEPUIS UN BACKUP
   */
  async restoreFromBackup(backupIndex = 0, reason = 'manual_restore'): Promise<void> {
    if (backupIndex >= this.backups.length) {
      throw new Error(`Backup ${backupIndex} non trouvé`);
    }

    const backup = this.backups[backupIndex];
    
    console.log(`↩️ Restauration backup du ${backup.timestamp.toISOString()} (${backup.reason})`);
    
    await this.createBackup('pre_restore');
    this.config = JSON.parse(JSON.stringify(backup.config)); // Deep copy
    await this.saveConfigToFile(this.config, reason);
    
    console.log('✅ Backup restauré avec succès');
  }

  /**
   * 📊 OBTENIR LA CONFIGURATION COMPLÈTE
   */
  getAll(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration non initialisée');
    }
    return JSON.parse(JSON.stringify(this.config)); // Deep copy
  }

  /**
   * 🎯 MÉTHODES DE COMMODITÉ
   */
  isFeatureEnabled(feature: string): boolean {
    return this.get(`features.${feature}`, false);
  }

  isLogModuleEnabled(module: string): boolean {
    return this.get(`logging.modules.${module}.enabled`, false);
  }

  getLogLevel(module: string): string {
    return this.get(`logging.modules.${module}.level`, this.get('logging.level', 'info'));
  }

  isDebug(): boolean {
    return this.get('app.debug', false);
  }

  isProduction(): boolean {
    return this.get('app.env') === 'production';
  }

  isMaintenanceMode(): boolean {
    return this.get('app.maintenance', false);
  }

  /**
   * 📋 OBTENIR LES BACKUPS
   */
  getBackups(): ConfigBackup[] {
    return [...this.backups]; // Copy
  }

  /**
   * 🚪 FERMER LE GESTIONNAIRE
   */
  close(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.removeAllListeners();
    console.log('🚪 ConfigManager fermé');
  }

  /**
   * 🔧 MÉTHODES UTILITAIRES PRIVÉES
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * 🚨 GESTION D'ERREURS
   */
  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('❌ Erreur ConfigManager:', error);
    });

    // Nettoyage à la fermeture
    process.on('SIGINT', () => this.close());
    process.on('SIGTERM', () => this.close());
    process.on('exit', () => this.close());
  }
}

// Instance singleton
export const configManager = new SecureConfigManager();

// Export du type pour utilisation
export type { AppConfig, ConfigChangeEvent, ConfigBackup };

export default configManager;
