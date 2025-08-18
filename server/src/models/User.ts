import mongoose, { Document, Model } from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";

// 🔐 CHAMPS SÉCURITÉ AJOUTÉS
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  playerStats: {
    level: number;
    experience: number;
    trophies: number;
    highestTrophies: number;
  };
  resources: {
    gold: number;
    gems: number;
    elixir: number;
  };
  cards: { cardId: string; level: number; count: number }[];
  deck: string[];
  gameStats: {
    totalGames: number;
    wins: number;
    losses: number;
    draws: number;
    winStreak: number;
    bestWinStreak: number;
  };
  accountInfo: {
    isEmailVerified: boolean;
    isBanned: boolean;
    banReason?: string;
    banExpires?: Date;
    lastLogin: Date;
    loginCount: number;
    // 🔐 NOUVEAUX CHAMPS SÉCURITÉ
    failedLoginAttempts: number;
    lastFailedLogin?: Date;
    accountLockedUntil?: Date;
    passwordChangedAt?: Date;
    twoFactorEnabled: boolean;
    twoFactorSecret?: string;
    securityLevel: 'BASIC' | 'ENHANCED' | 'CRYPTO_GRADE';
    suspiciousActivityScore: number;
    lastKnownIPs: string[];
    deviceFingerprints: string[];
  };

  // 💰 NOUVELLES MÉTHODES CRYPTO
connectWallet(address: string, network: number, ip: string): Promise<void>;
disconnectWallet(): Promise<void>;
isWalletConnected(): boolean;
addUsedNonce(nonce: string): Promise<void>;
isNonceUsed(nonce: string): boolean;
incrementCryptoSuspicion(amount?: number): Promise<void>;
banWallet(reason: string): Promise<void>;
  
cryptoWallet: {
  address: { type: String },
  connectedAt: { type: Date },
  lastActivity: { type: Date },
  connectionCount: { type: Number, default: 0, min: 0 },
  network: { type: Number }, // Chain ID
  balance: { type: Number, default: 0, min: 0 },
  lastWithdrawal: { type: Date },
  withdrawalCount: { type: Number, default: 0, min: 0 },
  kycStatus: { 
    type: String, 
    enum: ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'], 
    default: 'NONE' 
  },
  kycLevel: { type: Number, default: 0, min: 0, max: 3 },
  lastSignatureTimestamp: { type: Date },
  usedNonces: { type: [String], default: [], maxlength: 100 },
  suspiciousCryptoActivity: { type: Number, default: 0, min: 0, max: 100 },
  lastKnownIP: { type: String },
  isWalletBanned: { type: Boolean, default: false },
  banReason: { type: String },
},

  isAdmin: boolean;

  // Virtuels
  winRate: number;
  cardsOwned: number;
  isAccountLocked: boolean;
  
  // 🔐 NOUVELLES MÉTHODES SÉCURITÉ
  comparePassword(candidatePassword: string): Promise<boolean>;
  getPublicProfile(): object;
  incrementFailedLogins(): Promise<void>;
  resetFailedLogins(): Promise<void>;
  lockAccount(reason: string, durationMinutes?: number): Promise<void>;
  unlockAccount(): Promise<void>;
  updateSecurityLevel(): Promise<void>;
  addKnownIP(ip: string): Promise<void>;
  addDeviceFingerprint(fingerprint: string): Promise<void>;
  isKnownDevice(fingerprint: string): boolean;
}

// 🛡️ SCHÉMA AVEC SÉCURITÉ RENFORCÉE
const userSchema = new mongoose.Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      maxlength: 20,
      match: /^[a-zA-Z0-9_]+$/,
      trim: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Email invalide"],
      index: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false // Jamais inclus par défaut
    },
    playerStats: {
      level: { type: Number, default: 1, min: 1, max: 50 },
      experience: { type: Number, default: 0, min: 0 },
      trophies: { type: Number, default: 0, min: 0 },
      highestTrophies: { type: Number, default: 0, min: 0 }
    },
    resources: {
      gold: { type: Number, default: 1000, min: 0 },
      gems: { type: Number, default: 50, min: 0 },
      elixir: { type: Number, default: 100, min: 0 }
    },
    cards: [
      {
        cardId: { type: String, required: true },
        level: { type: Number, default: 1, min: 1, max: 14 },
        count: { type: Number, default: 1, min: 0 }
      }
    ],
    deck: {
      type: [String],
      default: [],
      validate: [(deck: string[]) => deck.length <= 8, "Deck max 8 cartes"]
    },
    gameStats: {
      totalGames: { type: Number, default: 0, min: 0 },
      wins: { type: Number, default: 0, min: 0 },
      losses: { type: Number, default: 0, min: 0 },
      draws: { type: Number, default: 0, min: 0 },
      winStreak: { type: Number, default: 0, min: 0 },
      bestWinStreak: { type: Number, default: 0, min: 0 }
    },
    accountInfo: {
      isEmailVerified: { type: Boolean, default: false },
      isBanned: { type: Boolean, default: false },
      banReason: { type: String },
      banExpires: { type: Date },
      lastLogin: { type: Date, default: Date.now },
      loginCount: { type: Number, default: 1 },
      
      // 🔐 NOUVEAUX CHAMPS SÉCURITÉ
      failedLoginAttempts: { type: Number, default: 0, min: 0 },
      lastFailedLogin: { type: Date },
      accountLockedUntil: { type: Date },
      passwordChangedAt: { type: Date, default: Date.now },
      twoFactorEnabled: { type: Boolean, default: false },
      twoFactorSecret: { type: String, select: false },
      securityLevel: { 
        type: String, 
        enum: ['BASIC', 'ENHANCED', 'CRYPTO_GRADE'], 
        default: 'BASIC' 
      },
      suspiciousActivityScore: { type: Number, default: 0, min: 0, max: 100 },
      lastKnownIPs: { type: [String], default: [], maxlength: 10 }, // Garder 10 dernières IPs
      deviceFingerprints: { type: [String], default: [], maxlength: 5 }, // 5 appareils max
    },
    
    // 💰 CHAMPS CRYPTO (optionnels pour l'instant)
    cryptoWallet: {
      address: { type: String },
      encryptedPrivateKey: { type: String, select: false },
      balance: { type: Number, default: 0, min: 0 },
      lastWithdrawal: { type: Date },
      withdrawalCount: { type: Number, default: 0, min: 0 },
      kycStatus: { 
        type: String, 
        enum: ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'], 
        default: 'NONE' 
      },
      kycLevel: { type: Number, default: 0, min: 0, max: 3 },
    },

    isAdmin: { type: Boolean, default: false }
  },
  { 
    timestamps: true,
    // Optimisations
    autoIndex: process.env.NODE_ENV !== 'production',
  }
);

// 📊 INDEX OPTIMISÉS POUR LA SÉCURITÉ
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ "playerStats.trophies": -1 });
userSchema.index({ "accountInfo.lastLogin": -1 });
userSchema.index({ "accountInfo.isBanned": 1 });
userSchema.index({ "accountInfo.failedLoginAttempts": 1 });
userSchema.index({ "accountInfo.accountLockedUntil": 1 });
userSchema.index({ "accountInfo.securityLevel": 1 });
userSchema.index({ "cryptoWallet.address": 1 });
userSchema.index({ "cryptoWallet.isWalletBanned": 1 });
userSchema.index({ "cryptoWallet.suspiciousCryptoActivity": 1 });

// 🔐 MIDDLEWARE HASH MOT DE PASSE (inchangé)
userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// 📏 VIRTUELS ÉTENDUS
userSchema.virtual("winRate").get(function (this: IUser) {
  return this.gameStats.totalGames === 0
    ? 0
    : Math.round((this.gameStats.wins / this.gameStats.totalGames) * 100);
});

userSchema.virtual("cardsOwned").get(function (this: IUser) {
  return this.cards.length;
});

userSchema.virtual("isAccountLocked").get(function (this: IUser) {
  return this.accountInfo.accountLockedUntil ? 
    new Date() < this.accountInfo.accountLockedUntil : false;
});

// 🔐 MÉTHODES DE SÉCURITÉ
userSchema.methods.comparePassword = function (candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getPublicProfile = function () {
  return {
    id: this._id,
    username: this.username,
    playerStats: this.playerStats,
    gameStats: this.gameStats,
    winRate: this.winRate,
    cardsOwned: this.cardsOwned,
    createdAt: this.createdAt,
    securityLevel: this.accountInfo.securityLevel,
  };
};

userSchema.methods.incrementFailedLogins = async function () {
  const maxAttempts = 5;
  const lockDurationMinutes = 30;

  this.accountInfo.failedLoginAttempts += 1;
  this.accountInfo.lastFailedLogin = new Date();

  // Verrouiller le compte après 5 tentatives échouées
  if (this.accountInfo.failedLoginAttempts >= maxAttempts) {
    this.accountInfo.accountLockedUntil = new Date(
      Date.now() + lockDurationMinutes * 60 * 1000
    );
    this.accountInfo.suspiciousActivityScore = Math.min(
      this.accountInfo.suspiciousActivityScore + 20, 
      100
    );
  }

  await this.save();
};

userSchema.methods.resetFailedLogins = async function () {
  this.accountInfo.failedLoginAttempts = 0;
  this.accountInfo.lastFailedLogin = undefined;
  this.accountInfo.accountLockedUntil = undefined;
  await this.save();
};

userSchema.methods.lockAccount = async function (reason: string, durationMinutes: number = 60) {
  this.accountInfo.isBanned = true;
  this.accountInfo.banReason = reason;
  this.accountInfo.banExpires = new Date(Date.now() + durationMinutes * 60 * 1000);
  this.accountInfo.suspiciousActivityScore = 100;
  await this.save();
};

userSchema.methods.unlockAccount = async function () {
  this.accountInfo.isBanned = false;
  this.accountInfo.banReason = undefined;
  this.accountInfo.banExpires = undefined;
  this.accountInfo.accountLockedUntil = undefined;
  this.accountInfo.failedLoginAttempts = 0;
  this.accountInfo.suspiciousActivityScore = Math.max(
    this.accountInfo.suspiciousActivityScore - 50, 
    0
  );
  await this.save();
};

userSchema.methods.updateSecurityLevel = async function () {
  let newLevel: 'BASIC' | 'ENHANCED' | 'CRYPTO_GRADE' = 'BASIC';
  
  // Critères pour ENHANCED
  if (
    this.accountInfo.isEmailVerified &&
    this.accountInfo.loginCount > 10 &&
    this.accountInfo.suspiciousActivityScore < 30
  ) {
    newLevel = 'ENHANCED';
  }
  
  // Critères pour CRYPTO_GRADE
  if (
    newLevel === 'ENHANCED' &&
    this.accountInfo.twoFactorEnabled &&
    this.cryptoWallet?.kycStatus === 'VERIFIED' &&
    this.accountInfo.suspiciousActivityScore < 10
  ) {
    newLevel = 'CRYPTO_GRADE';
  }
  
  if (this.accountInfo.securityLevel !== newLevel) {
    this.accountInfo.securityLevel = newLevel;
    await this.save();
  }
};

userSchema.methods.addKnownIP = async function (ip: string) {
  if (!this.accountInfo.lastKnownIPs.includes(ip)) {
    this.accountInfo.lastKnownIPs.unshift(ip);
    // Garder seulement les 10 dernières IPs
    this.accountInfo.lastKnownIPs = this.accountInfo.lastKnownIPs.slice(0, 10);
    await this.save();
  }
};

userSchema.methods.addDeviceFingerprint = async function (fingerprint: string) {
  if (!this.accountInfo.deviceFingerprints.includes(fingerprint)) {
    this.accountInfo.deviceFingerprints.unshift(fingerprint);
    // Garder seulement 5 appareils
    this.accountInfo.deviceFingerprints = this.accountInfo.deviceFingerprints.slice(0, 5);
    await this.save();
  }
};

userSchema.methods.isKnownDevice = function (fingerprint: string): boolean {
  return this.accountInfo.deviceFingerprints.includes(fingerprint);
};

// 🔍 MÉTHODES STATIQUES POUR ADMIN/ANALYTICS
userSchema.statics.findSuspiciousAccounts = function (threshold: number = 50) {
  return this.find({
    'accountInfo.suspiciousActivityScore': { $gte: threshold },
    'accountInfo.isBanned': false
  }).select('username email accountInfo.suspiciousActivityScore accountInfo.lastLogin');
};

userSchema.statics.findLockedAccounts = function () {
  return this.find({
    'accountInfo.accountLockedUntil': { $gt: new Date() }
  }).select('username email accountInfo.accountLockedUntil accountInfo.failedLoginAttempts');
};

userSchema.statics.getSecurityStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$accountInfo.securityLevel',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const bannedCount = await this.countDocuments({ 'accountInfo.isBanned': true });
  const lockedCount = await this.countDocuments({ 
    'accountInfo.accountLockedUntil': { $gt: new Date() } 
  });
  const twoFactorCount = await this.countDocuments({ 
    'accountInfo.twoFactorEnabled': true 
  });
  
  return {
    securityLevels: stats,
    bannedAccounts: bannedCount,
    lockedAccounts: lockedCount,
    twoFactorEnabled: twoFactorCount,
  };
};

// 🧹 MIDDLEWARE DE NETTOYAGE AUTOMATIQUE
userSchema.pre('save', function(next) {
  // Auto-déblocage des comptes expirés
  if (this.accountInfo.accountLockedUntil && new Date() > this.accountInfo.accountLockedUntil) {
    this.accountInfo.accountLockedUntil = undefined;
    this.accountInfo.failedLoginAttempts = 0;
  }
  
  // Auto-débannissement des comptes expirés
  if (this.accountInfo.banExpires && new Date() > this.accountInfo.banExpires) {
    this.accountInfo.isBanned = false;
    this.accountInfo.banReason = undefined;
    this.accountInfo.banExpires = undefined;
  }
  
  next();
});

// 📊 HOOKS POST-SAVE POUR ANALYTICS
userSchema.post('save', function(doc) {
  // Log des changements de niveau de sécurité
  if (doc.isModified('accountInfo.securityLevel')) {
    console.log(`🔐 Niveau sécurité mis à jour: ${doc.username} -> ${doc.accountInfo.securityLevel}`);
  }
  
  // Log des bannissements
  if (doc.isModified('accountInfo.isBanned') && doc.accountInfo.isBanned) {
    console.log(`🚫 Compte banni: ${doc.username} - ${doc.accountInfo.banReason}`);
  }
});

// Export du modèle
const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
/ 💰 MÉTHODES CRYPTO SÉCURISÉES
userSchema.methods.connectWallet = async function (address: string, network: number, ip: string) {
  this.cryptoWallet = {
    ...this.cryptoWallet,
    address: address.toLowerCase(),
    connectedAt: new Date(),
    lastActivity: new Date(),
    connectionCount: (this.cryptoWallet?.connectionCount || 0) + 1,
    network,
    lastKnownIP: ip,
  };
  await this.save();
};

userSchema.methods.disconnectWallet = async function () {
  if (this.cryptoWallet) {
    this.cryptoWallet.lastActivity = new Date();
  }
  this.cryptoWallet = undefined;
  await this.save();
};

userSchema.methods.isWalletConnected = function (): boolean {
  return !!(this.cryptoWallet?.address && !this.cryptoWallet?.isWalletBanned);
};

userSchema.methods.addUsedNonce = async function (nonce: string) {
  if (!this.cryptoWallet) return;
  
  this.cryptoWallet.usedNonces = this.cryptoWallet.usedNonces || [];
  this.cryptoWallet.usedNonces.unshift(nonce);
  
  // Garder seulement les 100 derniers nonces
  this.cryptoWallet.usedNonces = this.cryptoWallet.usedNonces.slice(0, 100);
  await this.save();
};

userSchema.methods.isNonceUsed = function (nonce: string): boolean {
  return this.cryptoWallet?.usedNonces?.includes(nonce) || false;
};

userSchema.methods.incrementCryptoSuspicion = async function (amount: number = 10) {
  if (!this.cryptoWallet) return;
  
  this.cryptoWallet.suspiciousCryptoActivity = Math.min(
    (this.cryptoWallet.suspiciousCryptoActivity || 0) + amount, 
    100
  );
  
  // Auto-ban si score trop élevé
  if (this.cryptoWallet.suspiciousCryptoActivity >= 80) {
    await this.banWallet('Activité crypto suspecte automatique');
  }
  
  await this.save();
};

userSchema.methods.banWallet = async function (reason: string) {
  if (!this.cryptoWallet) return;
  
  this.cryptoWallet.isWalletBanned = true;
  this.cryptoWallet.banReason = reason;
  this.cryptoWallet.suspiciousCryptoActivity = 100;
  await this.save();
};
export default User;
