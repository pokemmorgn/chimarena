// server/src/config/security.ts
import crypto from 'crypto';

export interface SecurityConfig {
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    encryptionKey: string;
    accessExpiry: string;
    refreshExpiry: string;
  };
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
  };
  validation: {
    minSecretLength: number;
    strongPasswordPattern: RegExp;
  };
  rateLimits: {
    login: { window: number; max: number };
    gaming: { window: number; max: number };
    crypto: { window: number; max: number };
    withdrawal: { window: number; max: number };
  };
  antiBot: {
    minActionInterval: number;
    maxActionsPerSecond: number;
    burstTolerance: number;
    suspiciousThreshold: number;
  };
  audit: {
    enableFullLogging: boolean;
    retentionDays: number;
    alertThresholds: {
      failedLogins: number;
      suspiciousActivity: number;
      cryptoActions: number;
    };
  };
}

class SecurityManager {
  private config: SecurityConfig;

  constructor() {
    this.config = this.loadConfig();
    this.validateSecrets();
  }

  private loadConfig(): SecurityConfig {
    return {
      jwt: {
        accessSecret: process.env.JWT_ACCESS_SECRET || '',
        refreshSecret: process.env.JWT_REFRESH_SECRET || '',
        encryptionKey: process.env.ENCRYPTION_KEY || '',
        accessExpiry: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
        refreshExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32, // 256 bits
        ivLength: 16,  // 128 bits
      },
      validation: {
        minSecretLength: 64,
        strongPasswordPattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      },
      rateLimits: {
        login: { window: 15 * 60 * 1000, max: 5 },         // 5 tentatives/15min
        gaming: { window: 5 * 60 * 1000, max: 500 },       // 500 actions/5min (permissif)
        crypto: { window: 60 * 60 * 1000, max: 20 },       // 20 actions/1h (strict)
        withdrawal: { window: 24 * 60 * 60 * 1000, max: 5 }, // 5 retraits/jour
      },
      antiBot: {
        minActionInterval: 100,        // 100ms minimum entre actions (gaming-friendly)
        maxActionsPerSecond: 10,       // Max 10 actions/sec (autorise combos)
        burstTolerance: 3,             // Tolérance pour burst gaming
        suspiciousThreshold: 50,       // Seuil détection patterns suspects
      },
      audit: {
        enableFullLogging: process.env.NODE_ENV === 'production',
        retentionDays: 90,
        alertThresholds: {
          failedLogins: 10,
          suspiciousActivity: 5,
          cryptoActions: 100,
        },
      },
    };
  }

  private validateSecrets(): void {
    const secrets = [
      { name: 'JWT_ACCESS_SECRET', value: this.config.jwt.accessSecret },
      { name: 'JWT_REFRESH_SECRET', value: this.config.jwt.refreshSecret },
      { name: 'ENCRYPTION_KEY', value: this.config.jwt.encryptionKey },
    ];

    const errors: string[] = [];

    for (const secret of secrets) {
      if (!secret.value) {
        errors.push(`${secret.name} manquant dans les variables d'environnement`);
        continue;
      }

      if (secret.value.length < this.config.validation.minSecretLength) {
        errors.push(`${secret.name} doit contenir au moins ${this.config.validation.minSecretLength} caractères`);
      }

      // Vérifier que les secrets sont différents
      if (secret.name !== 'JWT_ACCESS_SECRET') {
        if (secret.value === this.config.jwt.accessSecret) {
          errors.push(`${secret.name} doit être différent de JWT_ACCESS_SECRET`);
        }
      }
    }

    if (errors.length > 0) {
      console.error('❌ ERREURS DE CONFIGURATION SÉCURITÉ :');
      errors.forEach(err => console.error(`   • ${err}`));
      console.error('\n💡 Générez des secrets forts avec : openssl rand -hex 32\n');
      process.exit(1);
    }

    console.log('✅ Configuration sécurité validée - Secrets crypto-grade OK');
  }

  // Chiffrement de données sensibles
  public encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(this.config.encryption.ivLength);
    const cipher = crypto.createCipher(this.config.encryption.algorithm, this.config.jwt.encryptionKey);
    cipher.setAAD(Buffer.from('chimarena-crypto', 'utf8'));

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = (cipher as any).getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      tag,
    };
  }

  // Déchiffrement de données sensibles
  public decrypt(encrypted: string, iv: string, tag: string): string {
    try {
      const decipher = crypto.createDecipher(this.config.encryption.algorithm, this.config.jwt.encryptionKey);
      decipher.setAAD(Buffer.from('chimarena-crypto', 'utf8'));
      (decipher as any).setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Erreur de déchiffrement - données compromises ?');
    }
  }

  // Hash sécurisé pour IPs et identifiants
  public hashSensitiveData(data: string, salt?: string): string {
    const useSalt = salt || crypto.randomBytes(16).toString('hex');
    return crypto.pbkdf2Sync(data, useSalt, 10000, 64, 'sha512').toString('hex');
  }

  // Génération de tokens sécurisés
  public generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Validation mot de passe fort
  public isStrongPassword(password: string): { isValid: boolean; message?: string } {
    if (password.length < 8) {
      return { isValid: false, message: 'Le mot de passe doit contenir au moins 8 caractères' };
    }

    if (!this.config.validation.strongPasswordPattern.test(password)) {
      return { 
        isValid: false, 
        message: 'Le mot de passe doit contenir : majuscule, minuscule, chiffre et caractère spécial' 
      };
    }

    return { isValid: true };
  }

  // Getters pour la configuration
  public getConfig(): SecurityConfig {
    return { ...this.config }; // Copie pour éviter mutations
  }

  public getRateLimit(type: keyof SecurityConfig['rateLimits']) {
    return this.config.rateLimits[type];
  }

  public getAntiBotConfig() {
    return this.config.antiBot;
  }

  public getAuditConfig() {
    return this.config.audit;
  }

  // Validation IP (détection VPN/Proxy basique)
  public isValidIP(ip: string): boolean {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    const parts = ip.split('.').map(Number);
    return parts.every(part => part >= 0 && part <= 255);
  }

  // Détection IP suspectes (plages communes VPN/bots)
  public isSuspiciousIP(ip: string): boolean {
    if (!this.isValidIP(ip)) return true;

    // Plages IP souvent utilisées par des VPN/proxies/bots
    const suspiciousRanges = [
      /^10\./, // Réseau privé
      /^172\.(1[6-9]|2[0-9]|3[01])\./, // Réseau privé
      /^192\.168\./, // Réseau privé
      /^169\.254\./, // Link-local
      /^127\./, // Loopback
      /^0\./, // Invalid
    ];

    return suspiciousRanges.some(range => range.test(ip));
  }
}

// Singleton pour éviter les reconfigurations
export const securityManager = new SecurityManager();
export default securityManager;
