// server/src/utils/Logger.ts - ÉTAPE 3 : Logger modulaire ultra-configurable
import { configManager } from '../config/ConfigManager';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';
export type LogModule = 'auth' | 'crypto' | 'security' | 'api' | 'database' | 'game' | 'performance' | 'general';

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  module: LogModule;
  message: string;
  data?: any;
  userId?: string;
  ip?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  action?: string;
}

interface LogContext {
  userId?: string;
  ip?: string;
  sessionId?: string;
  requestId?: string;
  userAgent?: string;
  action?: string;
}

/**
 * 🎯 LOGGER POUR UN MODULE SPÉCIFIQUE
 * S'adapte automatiquement à la configuration
 */
class ModuleLogger {
  private module: LogModule;
  private context: LogContext;

  constructor(module: LogModule, context: LogContext = {}) {
    this.module = module;
    this.context = context;
  }

  /**
   * 🔴 LOG D'ERREUR CRITIQUE
   */
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  /**
   * 🟡 LOG D'AVERTISSEMENT
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * 🔵 LOG D'INFORMATION
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * 🟣 LOG DE DEBUG
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * ⚪ LOG DE TRACE (ultra-détaillé)
   */
  trace(message: string, data?: any): void {
    this.log('trace', message, data);
  }

  /**
   * 🎯 CRÉER UN SOUS-LOGGER AVEC CONTEXTE
   */
  withContext(additionalContext: LogContext): ModuleLogger {
    return new ModuleLogger(this.module, { ...this.context, ...additionalContext });
  }

  /**
   * 🔧 LOGGER AVEC ACTION SPÉCIFIQUE
   */
  withAction(action: string): ModuleLogger {
    return this.withContext({ action });
  }

  /**
   * 👤 LOGGER AVEC UTILISATEUR
   */
  withUser(userId: string, ip?: string): ModuleLogger {
    return this.withContext({ userId, ip });
  }

  /**
   * 🌐 LOGGER AVEC REQUÊTE
   */
  withRequest(requestId: string, ip?: string, userAgent?: string): ModuleLogger {
    return this.withContext({ requestId, ip, userAgent });
  }

  /**
   * 📝 MÉTHODE DE LOG INTERNE
   */
  private log(level: LogLevel, message: string, data?: any): void {
    try {
      // Vérifier si le module est activé
      if (!this.isModuleEnabled()) {
        return;
      }

      // Vérifier le niveau de log
      if (!this.shouldLog(level)) {
        return;
      }

      // Créer l'entrée de log
      const entry: LogEntry = {
        timestamp: new Date(),
        level,
        module: this.module,
        message,
        data: this.sanitizeData(data),
        ...this.context
      };

      // Envoyer au logger principal
      LoggerCore.getInstance().processLogEntry(entry);

    } catch (error) {
      // Fallback vers console en cas d'erreur
      console.error('❌ Erreur dans le logger:', error);
      console.log(`[${level.toUpperCase()}] [${this.module.toUpperCase()}] ${message}`, data);
    }
  }

  /**
   * ✅ VÉRIFIER SI LE MODULE EST ACTIVÉ
   */
  private isModuleEnabled(): boolean {
    try {
      return configManager.isLogModuleEnabled(this.module);
    } catch {
      // Si config pas encore initialisée, autoriser par défaut
      return true;
    }
  }

  /**
   * 📊 VÉRIFIER SI ON DOIT LOGGER SELON LE NIVEAU
   */
  private shouldLog(level: LogLevel): boolean {
    try {
      const globalLevel = configManager.get('logging.level', 'info');
      const moduleLevel = configManager.getLogLevel(this.module);
      
      const levelPriority = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
      
      return levelPriority[level] <= levelPriority[moduleLevel as LogLevel];
    } catch {
      // Si config pas encore initialisée, autoriser info et plus critique
      const levelPriority = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 };
      return levelPriority[level] <= levelPriority['info'];
    }
  }

  /**
   * 🧹 SANITISER LES DONNÉES SENSIBLES
   */
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    try {
      const filters = configManager.get('logging.filters', {
        excludePasswords: true,
        excludeTokens: true,
        excludePrivateKeys: true,
        maxStringLength: 1000
      });

      const sanitized = JSON.parse(JSON.stringify(data));

      if (filters.excludePasswords) {
        this.removeSensitiveFields(sanitized, ['password', 'pwd', 'pass', 'secret']);
      }

      if (filters.excludeTokens) {
        this.removeSensitiveFields(sanitized, ['token', 'jwt', 'authorization', 'auth', 'bearer']);
      }

      if (filters.excludePrivateKeys) {
        this.removeSensitiveFields(sanitized, ['privatekey', 'private_key', 'key', 'signature', 'mnemonic']);
      }

      // Sanitisation spécifique par module
      if (this.module === 'crypto') {
        this.removeSensitiveFields(sanitized, ['address', 'wallet', 'hash']);
        // Garder seulement les 6 premiers et 4 derniers caractères des adresses
        this.truncateAddresses(sanitized);
      }

      if (this.module === 'auth') {
        this.removeSensitiveFields(sanitized, ['email', 'username']);
        // Masquer partiellement les emails
        this.maskEmails(sanitized);
      }

      // Limiter la longueur des chaînes
      if (filters.maxStringLength) {
        this.limitStringLength(sanitized, filters.maxStringLength);
      }

      return sanitized;
    } catch {
      // Si erreur de sanitisation, retourner objet minimal
      return { sanitization_error: true, original_type: typeof data };
    }
  }

  /**
   * 🚫 SUPPRIMER LES CHAMPS SENSIBLES
   */
  private removeSensitiveFields(obj: any, fields: string[]): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
      if (fields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        this.removeSensitiveFields(obj[key], fields);
      }
    }
  }

  /**
   * ✂️ TRONQUER LES ADRESSES CRYPTO
   */
  private truncateAddresses(obj: any): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
      if (typeof obj[key] === 'string' && obj[key].startsWith('0x') && obj[key].length === 42) {
        obj[key] = `${obj[key].slice(0, 6)}...${obj[key].slice(-4)}`;
      } else if (typeof obj[key] === 'object') {
        this.truncateAddresses(obj[key]);
      }
    }
  }

  /**
   * 📧 MASQUER PARTIELLEMENT LES EMAILS
   */
  private maskEmails(obj: any): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
      if (typeof obj[key] === 'string' && obj[key].includes('@')) {
        const [local, domain] = obj[key].split('@');
        if (local.length > 2) {
          obj[key] = `${local.slice(0, 2)}***@${domain}`;
        }
      } else if (typeof obj[key] === 'object') {
        this.maskEmails(obj[key]);
      }
    }
  }

  /**
   * 📏 LIMITER LA LONGUEUR DES CHAÎNES
   */
  private limitStringLength(obj: any, maxLength: number): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const key in obj) {
      if (typeof obj[key] === 'string' && obj[key].length > maxLength) {
        obj[key] = obj[key].substring(0, maxLength) + '...[TRUNCATED]';
      } else if (typeof obj[key] === 'object') {
        this.limitStringLength(obj[key], maxLength);
      }
    }
  }
}

/**
 * 🏭 CŒUR DU SYSTÈME DE LOGGING
 * Gère la sortie vers console, fichiers, etc.
 */
class LoggerCore {
  private static instance: LoggerCore;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  private constructor() {
    this.setupConfigWatcher();
  }

  static getInstance(): LoggerCore {
    if (!LoggerCore.instance) {
      LoggerCore.instance = new LoggerCore();
    }
    return LoggerCore.instance;
  }

  /**
   * 📝 TRAITER UNE ENTRÉE DE LOG
   */
  processLogEntry(entry: LogEntry): void {
    // Ajouter au buffer
    this.addToBuffer(entry);

    // Sortie console
    if (this.isConsoleEnabled()) {
      this.logToConsole(entry);
    }

    // Sortie fichier (si activée)
    if (this.isFileEnabled()) {
      this.logToFile(entry);
    }

    // Sortie JSON (si activée)
    if (this.isJsonEnabled()) {
      this.logToJson(entry);
    }
  }

  /**
   * 📚 AJOUTER AU BUFFER
   */
  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.unshift(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(0, this.maxBufferSize);
    }
  }

  /**
   * 🖥️ LOG VERS LA CONSOLE
   */
  private logToConsole(entry: LogEntry): void {
    try {
      const colorize = configManager.get('logging.output.console.colorize', true);
      const showTimestamp = configManager.get('logging.output.console.timestamp', true);

      let output = '';

      // Timestamp
      if (showTimestamp) {
        const timestamp = entry.timestamp.toISOString();
        output += colorize ? `\x1b[90m${timestamp}\x1b[0m ` : `${timestamp} `;
      }

      // Niveau avec couleur
      const levelText = entry.level.toUpperCase().padEnd(5);
      if (colorize) {
        const colors = {
          error: '\x1b[31m', // Rouge
          warn: '\x1b[33m',  // Jaune
          info: '\x1b[36m',  // Cyan
          debug: '\x1b[35m', // Magenta
          trace: '\x1b[90m', // Gris
        };
        output += `${colors[entry.level]}${levelText}\x1b[0m `;
      } else {
        output += `${levelText} `;
      }

      // Module avec couleur
      const moduleText = `[${entry.module.toUpperCase()}]`.padEnd(12);
      output += colorize ? `\x1b[32m${moduleText}\x1b[0m ` : `${moduleText} `;

      // Action si présente
      if (entry.action) {
        const actionText = `{${entry.action}}`;
        output += colorize ? `\x1b[33m${actionText}\x1b[0m ` : `${actionText} `;
      }

      // Message principal
      output += entry.message;

      // Contexte utilisateur
      if (entry.userId) {
        output += ` (user: ${entry.userId})`;
      }
      if (entry.ip) {
        output += ` (ip: ${entry.ip})`;
      }
      if (entry.requestId) {
        output += ` (req: ${entry.requestId.slice(0, 8)})`;
      }

      // Log principal
      console.log(output);

      // Données additionnelles (si présentes)
      if (entry.data && Object.keys(entry.data).length > 0) {
        if (colorize) {
          console.log(`\x1b[90m${JSON.stringify(entry.data, null, 2)}\x1b[0m`);
        } else {
          console.log(JSON.stringify(entry.data, null, 2));
        }
      }
    } catch (error) {
      // Fallback minimal
      console.log(`[${entry.level.toUpperCase()}] [${entry.module.toUpperCase()}] ${entry.message}`);
    }
  }

  /**
   * 📄 LOG VERS FICHIER (placeholder)
   */
  private logToFile(entry: LogEntry): void {
    // TODO: Implémenter l'écriture vers fichier avec rotation
    // Nécessitera winston ou équivalent pour la rotation
    try {
      const logLine = `${entry.timestamp.toISOString()} [${entry.level.toUpperCase()}] [${entry.module.toUpperCase()}] ${entry.message}`;
      // fs.appendFileSync(logPath, logLine + '\n');
    } catch {
      // Silencieux si pas encore implémenté
    }
  }

  /**
   * 📋 LOG VERS JSON (placeholder)
   */
  private logToJson(entry: LogEntry): void {
    // TODO: Implémenter l'écriture JSON avec rotation
    try {
      const jsonEntry = {
        timestamp: entry.timestamp.toISOString(),
        level: entry.level,
        module: entry.module,
        message: entry.message,
        ...(entry.data && { data: entry.data }),
        ...(entry.userId && { userId: entry.userId }),
        ...(entry.ip && { ip: entry.ip }),
        ...(entry.sessionId && { sessionId: entry.sessionId }),
        ...(entry.requestId && { requestId: entry.requestId }),
        ...(entry.action && { action: entry.action }),
      };
      // fs.appendFileSync(jsonPath, JSON.stringify(jsonEntry) + '\n');
    } catch {
      // Silencieux si pas encore implémenté
    }
  }

  /**
   * ✅ VÉRIFICATIONS D'ACTIVATION DES SORTIES
   */
  private isConsoleEnabled(): boolean {
    try {
      return configManager.get('logging.output.console.enabled', true);
    } catch {
      return true; // Par défaut activé
    }
  }

  private isFileEnabled(): boolean {
    try {
      return configManager.get('logging.output.file.enabled', false);
    } catch {
      return false;
    }
  }

  private isJsonEnabled(): boolean {
    try {
      return configManager.get('logging.output.json.enabled', false);
    } catch {
      return false;
    }
  }

  /**
   * 🔄 CONFIGURER LE WATCHER DE CONFIGURATION
   */
  private setupConfigWatcher(): void {
    try {
      configManager.on('configChanged', (change) => {
        if (change.path?.startsWith('logging')) {
          console.log('🔄 Configuration de logging mise à jour');
        }
      });
    } catch {
      // Config pas encore initialisée
    }
  }

  /**
   * 📊 OBTENIR LES LOGS RÉCENTS (pour debug/admin)
   */
  getRecentLogs(count = 100): LogEntry[] {
    return this.logBuffer.slice(0, count);
  }

  /**
   * 🧹 NETTOYER LE BUFFER
   */
  clearBuffer(): void {
    this.logBuffer = [];
  }
}

/**
 * 🎯 LOGGERS PRÉ-CONFIGURÉS POUR CHAQUE MODULE
 */
export const logger = {
  // Loggers principaux
  auth: new ModuleLogger('auth'),
  crypto: new ModuleLogger('crypto'),
  security: new ModuleLogger('security'),
  api: new ModuleLogger('api'),
  database: new ModuleLogger('database'),
  game: new ModuleLogger('game'),
  performance: new ModuleLogger('performance'),
  general: new ModuleLogger('general'),

  // Factory avec contexte
  withContext: (context: LogContext) => ({
    auth: new ModuleLogger('auth', context),
    crypto: new ModuleLogger('crypto', context),
    security: new ModuleLogger('security', context),
    api: new ModuleLogger('api', context),
    database: new ModuleLogger('database', context),
    game: new ModuleLogger('game', context),
    performance: new ModuleLogger('performance', context),
    general: new ModuleLogger('general', context),
  }),

  // Factory avec utilisateur
  withUser: (userId: string, ip?: string) => ({
    auth: new ModuleLogger('auth', { userId, ip }),
    crypto: new ModuleLogger('crypto', { userId, ip }),
    security: new ModuleLogger('security', { userId, ip }),
    api: new ModuleLogger('api', { userId, ip }),
    database: new ModuleLogger('database', { userId, ip }),
    game: new ModuleLogger('game', { userId, ip }),
    performance: new ModuleLogger('performance', { userId, ip }),
    general: new ModuleLogger('general', { userId, ip }),
  }),

  // Factory avec requête
  withRequest: (requestId: string, ip?: string, userAgent?: string) => ({
    auth: new ModuleLogger('auth', { requestId, ip, userAgent }),
    crypto: new ModuleLogger('crypto', { requestId, ip, userAgent }),
    security: new ModuleLogger('security', { requestId, ip, userAgent }),
    api: new ModuleLogger('api', { requestId, ip, userAgent }),
    database: new ModuleLogger('database', { requestId, ip, userAgent }),
    game: new ModuleLogger('game', { requestId, ip, userAgent }),
    performance: new ModuleLogger('performance', { requestId, ip, userAgent }),
    general: new ModuleLogger('general', { requestId, ip, userAgent }),
  }),

  // Créer un logger pour un fichier spécifique (auto-détection du module)
  getContextLogger: (filename: string, context?: LogContext): ModuleLogger => {
    const moduleName = filename.includes('auth') ? 'auth' :
                     filename.includes('crypto') ? 'crypto' :
                     filename.includes('security') ? 'security' :
                     filename.includes('game') ? 'game' :
                     filename.includes('database') ? 'database' :
                     filename.includes('api') ? 'api' :
                     'general';
    
    return new ModuleLogger(moduleName as LogModule, context);
  },

  // Accès au core pour admin/debug
  core: LoggerCore.getInstance(),
};

export default logger;
