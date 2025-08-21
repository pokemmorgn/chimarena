// server/src/models/Card.ts - MODÈLE DES CARTES CHIMARENA
import mongoose, { Document, Model } from "mongoose";

// 🃏 TYPES DE CARTES CLASH ROYALE
export type CardType = 'troop' | 'spell' | 'building';
export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'champion';
export type TargetType = 'ground' | 'air' | 'both';

// 🎯 INTERFACE POUR LES STATS DE CARTE
export interface CardStats {
  health?: number;        // PV (pour les troupes/bâtiments)
  damage?: number;        // Dégâts par attaque
  attackSpeed?: number;   // Vitesse d'attaque (en secondes)
  range?: number;         // Portée d'attaque
  speed?: 'slow' | 'medium' | 'fast' | 'very_fast'; // Vitesse de déplacement
  targets?: TargetType;   // Ce que l'unité peut cibler
  deployTime?: number;    // Temps de déploiement (en secondes)
  lifetime?: number;      // Durée de vie (pour sorts temporaires)
  radius?: number;        // Rayon d'effet (pour sorts/splash)
  count?: number;         // Nombre d'unités spawned (ex: Skeletons)
}

// 🃏 INTERFACE PRINCIPALE DE CARTE
export interface ICard extends Document {
  // Identifiant et meta
  cardId: string;                    // ID unique (ex: "knight", "fireball")
  name: string;                      // Nom affiché
  description: string;               // Description de la carte
  
  // Classification
  type: CardType;                    // Type de carte
  rarity: CardRarity;               // Rareté
  elixirCost: number;               // Coût en élixir (1-10)
  
  // Progression et arènes
  unlockedAtArena: number;          // Arène de déblocage (0-9)
  maxLevel: number;                 // Niveau maximum (dépend de la rareté)
  
  // Stats de base (niveau 1)
  baseStats: CardStats;
  
  // Progression des stats par niveau
  statsProgression: {
    healthGrowth?: number;          // Croissance PV par niveau (%)
    damageGrowth?: number;          // Croissance dégâts par niveau (%)
  };
  
  // Métadonnées visuelles et audio
  cardImageUrl?: string;            // Image de la carte (UI)
  gameSprite?: string;              // Sprite principal (terrain)
  spriteConfig?: {                  // Config sprites détaillée
    idle?: string;
    walk?: string;
    attack?: string;
    death?: string;
  };
  soundEffects?: {
    deploy?: string;
    attack?: string;
    death?: string;
  };
  
  // Gameplay et scripts
  scriptName?: string;              // Script de comportement (ex: "knight")
  animationDuration?: number;       // Durée animation déploiement (ms)
  
  // Balancing et meta
  isEnabled: boolean;               // Carte activée dans le jeu
  version: string;                  // Version de balancing
  tags: string[];                   // Tags pour filtrage (ex: "splash", "tank")
  
  // Statistiques d'usage (optionnel)
  gameStats?: {
    usageRate?: number;             // Taux d'utilisation (%)
    winRate?: number;               // Taux de victoire (%)
    popularDecks?: string[];        // Decks populaires contenant cette carte
  };

  // Méthodes virtuelles
  getStatsAtLevel(level: number): CardStats;
  isUnlockedAtArena(arenaId: number): boolean;
  getUpgradeCost(fromLevel: number, toLevel: number): { gold: number; cards: number };
}

// 📊 SCHÉMA MONGOOSE
const cardSchema = new mongoose.Schema<ICard>(
  {
    cardId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^[a-z0-9_]+$/,  // Snake case only
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 30
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    
    // Classification
    type: {
      type: String,
      enum: ['troop', 'spell', 'building'],
      required: true,
      index: true
    },
    rarity: {
      type: String,
      enum: ['common', 'rare', 'epic', 'legendary', 'champion'],
      required: true,
      index: true
    },
    elixirCost: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      index: true
    },
    
    // Progression
    unlockedAtArena: {
      type: Number,
      required: true,
      min: 0,
      max: 9,
      index: true
    },
    maxLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 15,
      default: function() {
        // Niveaux max par rareté (comme Clash Royale)
        switch (this.rarity) {
          case 'common': return 14;
          case 'rare': return 11;
          case 'epic': return 8;
          case 'legendary': return 5;
          case 'champion': return 5;
          default: return 14;
        }
      }
    },
    
    // Stats de base
    baseStats: {
      health: { type: Number, min: 0 },
      damage: { type: Number, min: 0 },
      attackSpeed: { type: Number, min: 0.1 },  // En secondes
      range: { type: Number, min: 0 },          // En tiles
      speed: { 
        type: String, 
        enum: ['slow', 'medium', 'fast', 'very_fast'] 
      },
      targets: { 
        type: String, 
        enum: ['ground', 'air', 'both'],
        default: 'ground'
      },
      deployTime: { type: Number, min: 0, default: 1 },
      lifetime: { type: Number, min: 0 },       // Pour sorts temporaires
      radius: { type: Number, min: 0 },         // Rayon d'effet
      count: { type: Number, min: 1, default: 1 } // Nombre d'unités
    },
    
    // Progression des stats
    statsProgression: {
      healthGrowth: { type: Number, min: 0, max: 50, default: 10 },    // % par niveau
      damageGrowth: { type: Number, min: 0, max: 50, default: 10 }     // % par niveau
    },
    
    // Métadonnées
    imageUrl: { type: String, trim: true },
    soundEffects: {
      deploy: { type: String, trim: true },
      attack: { type: String, trim: true },
      death: { type: String, trim: true }
    },
    
    // Balancing
    isEnabled: { type: Boolean, default: true, index: true },
    version: { type: String, default: '1.0.0', trim: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    
    // Stats d'usage
    gameStats: {
      usageRate: { type: Number, min: 0, max: 100 },
      winRate: { type: Number, min: 0, max: 100 },
      popularDecks: [{ type: String }]
    }
  },
  {
    timestamps: true,
    autoIndex: process.env.NODE_ENV !== 'production'
  }
);

// 📊 INDEX OPTIMISÉS
cardSchema.index({ type: 1, rarity: 1 });
cardSchema.index({ unlockedAtArena: 1 });
cardSchema.index({ elixirCost: 1 });
cardSchema.index({ isEnabled: 1, unlockedAtArena: 1 });
cardSchema.index({ tags: 1 });

// 🎮 MÉTHODES VIRTUELLES ET INSTANCE

/**
 * Calculer les stats à un niveau donné
 */
cardSchema.methods.getStatsAtLevel = function(level: number): CardStats {
  if (level < 1 || level > this.maxLevel) {
    throw new Error(`Niveau invalide: ${level}. Max: ${this.maxLevel}`);
  }
  
  const stats: CardStats = { ...this.baseStats };
  const levelIncrease = level - 1; // Niveau 1 = stats de base
  
  // Appliquer la croissance selon le niveau
  if (stats.health && this.statsProgression.healthGrowth) {
    stats.health = Math.round(stats.health * (1 + (levelIncrease * this.statsProgression.healthGrowth / 100)));
  }
  
  if (stats.damage && this.statsProgression.damageGrowth) {
    stats.damage = Math.round(stats.damage * (1 + (levelIncrease * this.statsProgression.damageGrowth / 100)));
  }
  
  return stats;
};

/**
 * Vérifier si la carte est débloquée à une arène donnée
 */
cardSchema.methods.isUnlockedAtArena = function(arenaId: number): boolean {
  return arenaId >= this.unlockedAtArena;
};

/**
 * Calculer le coût d'amélioration
 */
cardSchema.methods.getUpgradeCost = function(fromLevel: number, toLevel: number): { gold: number; cards: number } {
  if (fromLevel >= toLevel || toLevel > this.maxLevel) {
    return { gold: 0, cards: 0 };
  }
  
  let totalGold = 0;
  let totalCards = 0;
  
  // Coûts basés sur la rareté (comme Clash Royale)
  const costMultipliers = {
    common: { goldBase: 5, cardBase: 2 },
    rare: { goldBase: 50, cardBase: 4 },
    epic: { goldBase: 500, cardBase: 10 },
    legendary: { goldBase: 5000, cardBase: 20 },
    champion: { goldBase: 10000, cardBase: 20 }
  };
  
  const multiplier = costMultipliers[this.rarity as keyof typeof costMultipliers];
  
  for (let level = fromLevel; level < toLevel; level++) {
    const levelMultiplier = Math.pow(1.5, level - 1); // Coût exponentiel
    totalGold += Math.round(multiplier.goldBase * levelMultiplier);
    totalCards += Math.round(multiplier.cardBase * levelMultiplier);
  }
  
  return { gold: totalGold, cards: totalCards };
};

// 🎯 MÉTHODES STATIQUES DE LA CLASSE

/**
 * Obtenir toutes les cartes débloquées pour une arène
 */
cardSchema.statics.getCardsForArena = function(arenaId: number) {
  return this.find({ 
    unlockedAtArena: { $lte: arenaId }, 
    isEnabled: true 
  }).sort({ elixirCost: 1, rarity: 1 });
};

/**
 * Obtenir les cartes par type
 */
cardSchema.statics.getCardsByType = function(type: CardType) {
  return this.find({ type, isEnabled: true }).sort({ elixirCost: 1 });
};

/**
 * Obtenir les cartes par rareté
 */
cardSchema.statics.getCardsByRarity = function(rarity: CardRarity) {
  return this.find({ rarity, isEnabled: true }).sort({ elixirCost: 1 });
};

/**
 * Rechercher des cartes par tags
 */
cardSchema.statics.searchByTags = function(tags: string[]) {
  return this.find({ 
    tags: { $in: tags }, 
    isEnabled: true 
  }).sort({ elixirCost: 1 });
};

/**
 * Obtenir les cartes populaires
 */
cardSchema.statics.getPopularCards = function(limit: number = 10) {
  return this.find({ isEnabled: true })
    .sort({ 'gameStats.usageRate': -1 })
    .limit(limit);
};

/**
 * Valider un deck (8 cartes, coût moyen raisonnable)
 */
cardSchema.statics.validateDeck = function(cardIds: string[]) {
  if (!Array.isArray(cardIds) || cardIds.length !== 8) {
    return { isValid: false, error: 'Un deck doit contenir exactement 8 cartes' };
  }
  
  // Vérifier les doublons
  const uniqueCards = new Set(cardIds);
  if (uniqueCards.size !== cardIds.length) {
    return { isValid: false, error: 'Cartes dupliquées dans le deck' };
  }
  
  return { isValid: true };
};

// 🎮 MIDDLEWARE DE VALIDATION
cardSchema.pre('save', function(next) {
  // Auto-générer l'URL d'image si manquante
  if (!this.imageUrl) {
    this.imageUrl = `/assets/cards/${this.cardId}.png`;
  }
  
  // Valider la cohérence des stats
  if (this.type === 'spell' && this.baseStats.health) {
    this.baseStats.health = undefined; // Les sorts n'ont pas de PV
  }
  
  if (this.type === 'building' && this.baseStats.speed) {
    this.baseStats.speed = undefined; // Les bâtiments ne bougent pas
  }
  
  next();
});

// Export du modèle
const Card: Model<ICard> = mongoose.model<ICard>("Card", cardSchema);

export default Card;
