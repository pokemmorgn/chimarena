// server/src/services/BotService.ts - SERVICE DE GESTION DES BOTS IA

import { cardManager } from './CardManager';
import { ArenaManager } from '../config/arenas';

// 🤖 TYPES POUR LES BOTS
export interface BotProfile {
  id: string;
  username: string;
  level: number;
  trophies: number;
  arenaId: number;
  winRate: number;
  deck: string[];
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  personality: 'aggressive' | 'defensive' | 'balanced' | 'rusher';
  avatar?: string;
}

export interface BotDeckStrategy {
  name: string;
  cards: string[];
  strategy: string;
  elixirCost: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
}

// 🎯 SERVICE PRINCIPAL DES BOTS
export class BotService {
  private static instance: BotService;
  
  // Decks prédéfinis par difficulté
  private botDecks: { [difficulty: string]: BotDeckStrategy[] } = {
    easy: [
      {
        name: "Débutant Classique",
        cards: ['knight', 'archers', 'goblins', 'giant', 'fireball', 'arrows', 'minions', 'musketeer'],
        strategy: "Deck équilibré pour débutants",
        elixirCost: 3.5,
        difficulty: 'easy'
      },
      {
        name: "Swarm Basic",
        cards: ['goblins', 'minions', 'archers', 'knight', 'arrows', 'fireball', 'giant', 'musketeer'],
        strategy: "Nombreuses petites unités",
        elixirCost: 3.4,
        difficulty: 'easy'
      }
    ],
    medium: [
      {
        name: "Équilibré Pro",
        cards: ['knight', 'musketeer', 'giant', 'wizard', 'fireball', 'arrows', 'minions', 'goblins'],
        strategy: "Contrôle et push",
        elixirCost: 3.8,
        difficulty: 'medium'
      },
      {
        name: "Beat-down",
        cards: ['giant', 'wizard', 'musketeer', 'knight', 'minions', 'arrows', 'fireball', 'goblins'],
        strategy: "Gros push avec tank",
        elixirCost: 4.1,
        difficulty: 'medium'
      }
    ],
    hard: [
      {
        name: "Cycle Rapide",
        cards: ['knight', 'archers', 'goblins', 'musketeer', 'fireball', 'arrows', 'minions', 'giant'],
        strategy: "Cycle rapide et contrôle",
        elixirCost: 3.3,
        difficulty: 'hard'
      },
      {
        name: "Contrôle Lourd",
        cards: ['giant', 'wizard', 'musketeer', 'knight', 'fireball', 'arrows', 'minions', 'goblins'],
        strategy: "Contrôle puis gros push",
        elixirCost: 4.2,
        difficulty: 'hard'
      }
    ],
    expert: [
      {
        name: "Meta Pro",
        cards: ['knight', 'musketeer', 'giant', 'wizard', 'fireball', 'arrows', 'minions', 'goblins'],
        strategy: "Deck meta optimisé",
        elixirCost: 3.9,
        difficulty: 'expert'
      }
    ]
  };

  // Noms de bots prédéfinis
  private botNames = [
    'BotArcher', 'KnightBot', 'GiantSlayer', 'WizardAI', 'GoblinMaster',
    'FireballExpert', 'MinionsCommander', 'MusketeerPro', 'TowerDefender',
    'ElixirMaster', 'ClashBot', 'ArenaWarrior', 'CrownTaker', 'BattleAI',
    'StrategyBot', 'CycleKing', 'PushMaster', 'DefenseBot', 'RushCommander'
  ];

  private constructor() {}

  static getInstance(): BotService {
    if (!BotService.instance) {
      BotService.instance = new BotService();
    }
    return BotService.instance;
  }

  // === CRÉATION DE BOTS ===

  /**
   * Créer un bot adapté au niveau du joueur
   */
  createBotForPlayer(playerTrophies: number, playerLevel: number): BotProfile {
    const difficulty = this.getDifficultyForTrophies(playerTrophies);
    const botTrophies = this.generateBotTrophies(playerTrophies);
    const botLevel = this.generateBotLevel(playerLevel, difficulty);
    const arenaId = ArenaManager.getArenaByTrophies(botTrophies)?.id || 0;
    
    // Choisir un deck selon la difficulté
    const availableDecks = this.botDecks[difficulty] || this.botDecks.easy;
    const selectedDeck = availableDecks[Math.floor(Math.random() * availableDecks.length)];
    
    // Générer le profil bot
    const bot: BotProfile = {
      id: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      username: this.generateBotName(),
      level: botLevel,
      trophies: botTrophies,
      arenaId: arenaId,
      winRate: this.generateWinRate(difficulty),
      deck: [...selectedDeck.cards],
      difficulty: difficulty,
      personality: this.generatePersonality(difficulty),
      avatar: `bot_avatar_${Math.floor(Math.random() * 10) + 1}`
    };

    console.log(`🤖 Bot créé: ${bot.username} (${bot.trophies} trophées, ${bot.difficulty})`);
    return bot;
  }

  /**
   * Créer un bot avec des paramètres spécifiques
   */
  createCustomBot(options: Partial<BotProfile>): BotProfile {
    const defaults = this.createBotForPlayer(1000, 5); // Bot par défaut
    
    return {
      ...defaults,
      ...options,
      id: options.id || `custom_bot_${Date.now()}`,
      deck: options.deck || defaults.deck
    };
  }

  // === LOGIQUE DE GÉNÉRATION ===

  /**
   * Déterminer la difficulté selon les trophées
   */
  private getDifficultyForTrophies(trophies: number): 'easy' | 'medium' | 'hard' | 'expert' {
    if (trophies < 300) return 'easy';
    if (trophies < 1000) return 'medium';
    if (trophies < 2000) return 'hard';
    return 'expert';
  }

  /**
   * Générer des trophées pour le bot (proche du joueur)
   */
  private generateBotTrophies(playerTrophies: number): number {
    const variation = Math.floor(playerTrophies * 0.2); // ±20%
    const minTrophies = Math.max(0, playerTrophies - variation);
    const maxTrophies = playerTrophies + variation;
    
    return Math.floor(Math.random() * (maxTrophies - minTrophies + 1)) + minTrophies;
  }

  /**
   * Générer un niveau pour le bot
   */
  private generateBotLevel(playerLevel: number, difficulty: string): number {
    let levelVariation = 1;
    
    switch (difficulty) {
      case 'easy': levelVariation = Math.max(1, playerLevel - 1); break;
      case 'medium': levelVariation = playerLevel; break;
      case 'hard': levelVariation = playerLevel + 1; break;
      case 'expert': levelVariation = playerLevel + 2; break;
    }
    
    return Math.max(1, Math.min(14, levelVariation));
  }

  /**
   * Générer un taux de victoire réaliste
   */
  private generateWinRate(difficulty: string): number {
    const baseRates = {
      easy: 35,    // 35-45%
      medium: 45,  // 45-55%
      hard: 55,    // 55-65%
      expert: 65   // 65-75%
    };
    
    const base = baseRates[difficulty] || 50;
    return base + Math.floor(Math.random() * 10);
  }

  /**
   * Générer une personnalité de bot
   */
  private generatePersonality(difficulty: string): 'aggressive' | 'defensive' | 'balanced' | 'rusher' {
    const personalities = {
      easy: ['defensive', 'balanced'],
      medium: ['balanced', 'aggressive', 'defensive'],
      hard: ['aggressive', 'balanced', 'rusher'],
      expert: ['aggressive', 'rusher', 'balanced']
    };
    
    const options = personalities[difficulty] || ['balanced'];
    return options[Math.floor(Math.random() * options.length)] as any;
  }

  /**
   * Générer un nom de bot unique
   */
  private generateBotName(): string {
    const baseName = this.botNames[Math.floor(Math.random() * this.botNames.length)];
    const suffix = Math.floor(Math.random() * 999) + 1;
    return `${baseName}${suffix}`;
  }

  // === GESTION DES DECKS ===

  /**
   * Obtenir tous les decks disponibles pour une difficulté
   */
  getDecksForDifficulty(difficulty: string): BotDeckStrategy[] {
    return this.botDecks[difficulty] || this.botDecks.easy;
  }

  /**
   * Ajouter un nouveau deck de bot
   */
  addBotDeck(difficulty: string, deck: BotDeckStrategy): void {
    if (!this.botDecks[difficulty]) {
      this.botDecks[difficulty] = [];
    }
    this.botDecks[difficulty].push(deck);
  }

  /**
   * Valider qu'un deck de bot est utilisable
   */
  async validateBotDeck(deck: string[], arenaId: number = 0): Promise<boolean> {
    try {
      const validation = await cardManager.validateDeck(deck, arenaId);
      return validation.isValid;
    } catch (error) {
      console.error('❌ Erreur validation deck bot:', error);
      return false;
    }
  }

  // === UTILITAIRES ===

  /**
   * Obtenir les statistiques des bots
   */
  getBotStats(): object {
    const totalDecks = Object.values(this.botDecks).reduce((sum, decks) => sum + decks.length, 0);
    
    return {
      totalBotDecks: totalDecks,
      difficulties: Object.keys(this.botDecks),
      decksByDifficulty: Object.fromEntries(
        Object.entries(this.botDecks).map(([diff, decks]) => [diff, decks.length])
      ),
      availableBotNames: this.botNames.length
    };
  }

  /**
   * Mode debug : créer un bot spécifique pour les tests
   */
  createDebugBot(difficulty: 'easy' | 'medium' | 'hard' | 'expert' = 'medium'): BotProfile {
    return {
      id: 'debug_bot_001',
      username: 'DebugBot',
      level: 8,
      trophies: 500,
      arenaId: 1,
      winRate: 50,
      deck: this.botDecks[difficulty][0]?.cards || this.botDecks.easy[0].cards,
      difficulty: difficulty,
      personality: 'balanced'
    };
  }
}

// Export singleton
export const botService = BotService.getInstance();
