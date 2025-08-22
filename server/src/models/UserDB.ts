import mongoose, { Document, Model } from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";
import { Arena, ArenaManager } from "../config/arenas";

// 🏟️ NOUVEAUX TYPES POUR LE SYSTÈME D'ARÈNES
export interface ArenaHistoryEntry {
  fromArenaId: number;
  toArenaId: number;
  trophiesChange: number;
  timestamp: Date;
  reason: 'win' | 'loss' | 'season_reset' | 'manual';
}

export interface SeasonStats {
  seasonId: string; // Format: "2024-01" par exemple
  startDate: Date;
  wins: number;
  losses: number;
  draws: number;
  highestTrophies: number;
  finalTrophies?: number; // À la fin de saison
  rewards?: {
    gold: number;
    gems: number;
    cards: number;
  };
}

// 🔐 INTERFACE USER MISE À JOUR AVEC ARÈNES
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
  
  // 🏟️ NOUVEAU : SYSTÈME D'ARÈNES
  currentArenaId: number; // ID de l'arène actuelle
  arenaHistory: ArenaHistoryEntry[]; // Historique des changements
  seasonStats: SeasonStats; // Stats de la saison en cours
  
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
    // 🔐 CHAMPS SÉCURITÉ
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

  // 💰 CRYPTO WALLET
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
  };

  isAdmin: boolean;

  // Virtuels
  winRate: number;
  cardsOwned: number;
  isAccountLocked: boolean;
  
  // 🏟️ NOUVELLES MÉTHODES ARÈNES
  getCurrentArena(): Arena;
  updateArena(newTrophies: number, reason?: 'win' | 'loss'): Promise<{ arenaChanged: boolean; newArena?: Arena; unlockedCards?: string[] }>;
  addArenaHistory(fromArenaId: number, toArenaId: number, trophiesChange: number, reason: ArenaHistoryEntry['reason']): Promise<void>;
  getCurrentSeasonStats(): SeasonStats;
  initializeCurrentSeason(): Promise<void>;
  autoMigrateToArenaSystem(): Promise<void>; // 🔄 NOUVELLE : Auto-migration
  
  // 🔐 MÉTHODES SÉCURITÉ EXISTANTES
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
  
  // 💰 MÉTHODES CRYPTO EXISTANTES
  connectWallet(address: string, network: number, ip: string): Promise<void>;
  disconnectWallet(): Promise<void>;
  isWalletConnected(): boolean;
  addUsedNonce(nonce: string): Promise<void>;
  isNonceUsed(nonce: string): boolean;
  incrementCryptoSuspicion(amount?: number): Promise<void>;
  banWallet(reason: string): Promise<void>;
}

// 🏟️ SCHÉMA AVEC SYSTÈME D'ARÈNES INTÉGRÉ
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
    
    // 🏟️ NOUVEAUX CHAMPS ARÈNES
    currentArenaId: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 9 // ID max des arènes définies
    },
    arenaHistory: [{
      fromArenaId: { type: Number, required: true, min: 0 },
      toArenaId: { type: Number, required: true, min: 0 },
      trophiesChange: { type: Number, required: true },
      timestamp: { type: Date, default: Date.now },
      reason: { 
        type: String, 
        enum: ['win', 'loss', 'season_reset', 'manual'], 
        required: true 
      }
    }],
    seasonStats: {
      seasonId: { type: String, required: true, default: () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      }},
      startDate: { type: Date, default: Date.now },
      wins: { type: Number, default: 0, min: 0 },
      losses: { type: Number, default: 0, min: 0 },
      draws: { type: Number, default: 0, min: 0 },
      highestTrophies: { type: Number, default: 0, min: 0 },
      finalTrophies: { type: Number, min: 0 },
      rewards: {
        gold: { type: Number, default: 0, min: 0 },
        gems: { type: Number, default: 0, min: 0 },
        cards: { type: Number, default: 0, min: 0 }
      }
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
      
      // 🔐 CHAMPS SÉCURITÉ
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
      lastKnownIPs: { type: [String], default: [], maxlength: 10 },
      deviceFingerprints: { type: [String], default: [], maxlength: 5 },
    },
    
    // 💰 CHAMPS CRYPTO
    cryptoWallet: {
      address: { type: String },
      connectedAt: { type: Date },
      lastActivity: { type: Date },
      connectionCount: { type: Number, default: 0, min: 0 },
      network: { type: Number },
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

    isAdmin: { type: Boolean, default: false }
  },
  { 
    timestamps: true,
    autoIndex: process.env.NODE_ENV !== 'production',
  }
);

// 📊 INDEX OPTIMISÉS (avec arènes)
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ "playerStats.trophies": -1 });
userSchema.index({ currentArenaId: 1 }); // 🏟️ NOUVEAU
userSchema.index({ "seasonStats.seasonId": 1 }); // 🏟️ NOUVEAU
userSchema.index({ "accountInfo.lastLogin": -1 });
userSchema.index({ "accountInfo.isBanned": 1 });
userSchema.index({ "cryptoWallet.address": 1 });

// 🔐 MIDDLEWARE HASH MOT DE PASSE (inchangé)
userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// 🏟️ MIDDLEWARE MIGRATION AUTOMATIQUE + MISE À JOUR ARÈNE
userSchema.pre<IUser>("save", async function (next) {
  // 🔄 FALLBACK: Auto-migration pour les anciens users
  if (!this.currentArenaId && this.currentArenaId !== 0) {
    console.log(`🔄 Auto-migration user ${this.username} vers le système d'arènes`);
    await this.autoMigrateToArenaSystem();
  }
  
  // Vérifier et initialiser la saison si nécessaire
  if (!this.seasonStats?.seasonId) {
    await this.initializeCurrentSeason();
  }
  
  // Mettre à jour l'arène si les trophées ont changé
  if (this.isModified("playerStats.trophies")) {
    const currentArena = ArenaManager.getCurrentArena(this.playerStats.trophies);
    const oldArenaId = this.currentArenaId;
    
    if (currentArena.id !== oldArenaId) {
      this.currentArenaId = currentArena.id;
      
      // Ajouter à l'historique (sera fait via la méthode pour avoir la logique complète)
      // On ne fait que mettre à jour l'ID ici, l'historique sera géré par updateArena()
    }
    
    // Mettre à jour les stats de saison
    if (this.seasonStats && this.playerStats.trophies > this.seasonStats.highestTrophies) {
      this.seasonStats.highestTrophies = this.playerStats.trophies;
    }
  }
  
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

// 🏟️ NOUVELLES MÉTHODES ARÈNES
userSchema.methods.getCurrentArena = function (): Arena {
  return ArenaManager.getCurrentArena(this.playerStats.trophies);
};

userSchema.methods.updateArena = async function (
  newTrophies: number, 
  reason: 'win' | 'loss' = 'win'
): Promise<{ arenaChanged: boolean; newArena?: Arena; unlockedCards?: string[] }> {
  const oldTrophies = this.playerStats.trophies;
  const oldArenaId = this.currentArenaId;
  
  // Mettre à jour les trophées
  this.playerStats.trophies = Math.max(0, newTrophies);
  
  // Mettre à jour highest trophies
  if (this.playerStats.trophies > this.playerStats.highestTrophies) {
    this.playerStats.highestTrophies = this.playerStats.trophies;
  }
  
  // Calculer la nouvelle arène
  const newArena = ArenaManager.getCurrentArena(this.playerStats.trophies);
  const arenaChanged = newArena.id !== oldArenaId;
  
  if (arenaChanged) {
    this.currentArenaId = newArena.id;
    
    // Ajouter à l'historique
    await this.addArenaHistory(
      oldArenaId, 
      newArena.id, 
      this.playerStats.trophies - oldTrophies, 
      reason
    );
    
    // Vérifier les cartes débloquées
    const unlockedCards = ArenaManager.getUnlockedCards(oldTrophies, this.playerStats.trophies);
    
    return { 
      arenaChanged: true, 
      newArena, 
      unlockedCards: unlockedCards.length > 0 ? unlockedCards : undefined 
    };
  }
  
  return { arenaChanged: false };
};

userSchema.methods.addArenaHistory = async function (
  fromArenaId: number, 
  toArenaId: number, 
  trophiesChange: number, 
  reason: ArenaHistoryEntry['reason']
): Promise<void> {
  const historyEntry: ArenaHistoryEntry = {
    fromArenaId,
    toArenaId,
    trophiesChange,
    timestamp: new Date(),
    reason
  };
  
  this.arenaHistory.unshift(historyEntry);
  
  // Garder seulement les 50 dernières entrées
  if (this.arenaHistory.length > 50) {
    this.arenaHistory = this.arenaHistory.slice(0, 50);
  }
};

userSchema.methods.getCurrentSeasonStats = function (): SeasonStats {
  return this.seasonStats;
};

userSchema.methods.initializeCurrentSeason = async function (): Promise<void> {
  const now = new Date();
  const currentSeasonId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  if (!this.seasonStats || this.seasonStats.seasonId !== currentSeasonId) {
    // Nouvelle saison
    this.seasonStats = {
      seasonId: currentSeasonId,
      startDate: now,
      wins: 0,
      losses: 0,
      draws: 0,
      highestTrophies: this.playerStats.trophies,
      rewards: { gold: 0, gems: 0, cards: 0 }
    };
  }
};

// 🔄 MÉTHODE D'AUTO-MIGRATION POUR LES ANCIENS USERS
userSchema.methods.autoMigrateToArenaSystem = async function (): Promise<void> {
  console.log(`🔄 Auto-migration du user ${this.username} vers le système d'arènes`);
  
  const trophies = this.playerStats?.trophies || 0;
  const currentArena = ArenaManager.getCurrentArena(trophies);
  
  // Définir l'arène actuelle
  this.currentArenaId = currentArena.id;
  
  // Créer un historique initial
  if (!this.arenaHistory) {
    this.arenaHistory = [];
  }
  
  // Ajouter une entrée d'historique de migration si pas déjà présente
  const hasMigrationEntry = this.arenaHistory.some((entry: ArenaHistoryEntry) => entry.reason === 'manual');
  
  if (!hasMigrationEntry) {
    const migrationEntry: ArenaHistoryEntry = {
      fromArenaId: 0,
      toArenaId: currentArena.id,
      trophiesChange: trophies,
      timestamp: this.createdAt || new Date(),
      reason: 'manual'
    };
    
    this.arenaHistory.unshift(migrationEntry);
  }
  
  // Initialiser la saison si nécessaire
  await this.initializeCurrentSeason();
  
  console.log(`✅ User ${this.username} migré vers l'arène ${currentArena.id} (${currentArena.nameId})`);
};

// 🔐 MÉTHODES DE SÉCURITÉ (inchangées)
userSchema.methods.comparePassword = function (candidatePassword: string) {
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.getPublicProfile = function () {
  const currentArena = this.getCurrentArena();
  return {
    id: this._id,
    username: this.username,
    playerStats: this.playerStats,
    gameStats: this.gameStats,
    winRate: this.winRate,
    cardsOwned: this.cardsOwned,
    createdAt: this.createdAt,
    securityLevel: this.accountInfo.securityLevel,
    // 🏟️ NOUVEAU : Info arène publique
    arena: {
      id: currentArena.id,
      nameId: currentArena.nameId,
      icon: currentArena.icon,
      progress: ArenaManager.getArenaProgress(this.playerStats.trophies),
      rank: ArenaManager.getArenaRank(this.playerStats.trophies)
    },
    seasonStats: {
      wins: this.seasonStats.wins,
      losses: this.seasonStats.losses,
      highestTrophies: this.seasonStats.highestTrophies
    }
  };
};

// [TOUTES LES AUTRES MÉTHODES EXISTANTES INCHANGÉES]
userSchema.methods.incrementFailedLogins = async function () {
  const maxAttempts = 5;
  const lockDurationMinutes = 30;

  this.accountInfo.failedLoginAttempts += 1;
  this.accountInfo.lastFailedLogin = new Date();

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
  
  if (
    this.accountInfo.isEmailVerified &&
    this.accountInfo.loginCount > 10 &&
    this.accountInfo.suspiciousActivityScore < 30
  ) {
    newLevel = 'ENHANCED';
  }
  
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
    this.accountInfo.lastKnownIPs = this.accountInfo.lastKnownIPs.slice(0, 10);
    await this.save();
  }
};

userSchema.methods.addDeviceFingerprint = async function (fingerprint: string) {
  if (!this.accountInfo.deviceFingerprints.includes(fingerprint)) {
    this.accountInfo.deviceFingerprints.unshift(fingerprint);
    this.accountInfo.deviceFingerprints = this.accountInfo.deviceFingerprints.slice(0, 5);
    await this.save();
  }
};

userSchema.methods.isKnownDevice = function (fingerprint: string): boolean {
  return this.accountInfo.deviceFingerprints.includes(fingerprint);
};

// 💰 MÉTHODES CRYPTO (inchangées)
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

// Export du modèle
const UserDB: Model<IUser> = mongoose.model<IUser>("User", userSchema);

export default UserDB;
