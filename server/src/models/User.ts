import mongoose, { Document, Model } from "mongoose";
import bcrypt from "bcrypt";
import validator from "validator";

// Définition des types
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
  };

  // Virtuels
  winRate: number;
  cardsOwned: number;

  // Méthodes
  comparePassword(candidatePassword: string): Promise<boolean>;
  getPublicProfile(): object;
}

// Définition du schéma (presque identique à ton JS)
const userSchema = new mongoose.Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_]+$/,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, "Email invalide"],
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  playerStats: {
    level: { type: Number, default: 1 },
    experience: { type: Number, default: 0 },
    trophies: { type: Number, default: 0 },
    highestTrophies: { type: Number, default: 0 },
  },
  resources: {
    gold: { type: Number, default: 1000 },
    gems: { type: Number, default: 50 },
    elixir: { type: Number, default: 100 },
  },
  cards: [
    {
      cardId: String,
      level: { type: Number, default: 1 },
      count: { type: Number, default: 1 },
    },
  ],
  deck: {
    type: [String],
    default: [],
    validate: [(deck: string[]) => deck.length <= 8, "Deck max 8 cartes"],
  },
  gameStats: {
    totalGames: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    bestWinStreak: { type: Number, default: 0 },
  },
  accountInfo: {
    isEmailVerified: { type: Boolean, default: false },
    isBanned: { type: Boolean, default: false },
    banReason: String,
    banExpires: Date,
    lastLogin: { type: Date, default: Date.now },
    loginCount: { type: Number, default: 1 },
  },
}, { timestamps: true });
 
// Middleware hash mot de passe
userSchema.pre<IUser>("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Méthodes
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
    createdAt: this.createdAt,
  };
};

// Virtuels
userSchema.virtual("winRate").get(function (this: IUser) {
  return this.gameStats.totalGames === 0
    ? 0
    : Math.round((this.gameStats.wins / this.gameStats.totalGames) * 100);
});

userSchema.virtual("cardsOwned").get(function (this: IUser) {
  return this.cards.length;
});

// Export
const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
export default User;
