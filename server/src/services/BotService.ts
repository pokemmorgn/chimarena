// server/src/services/BotService.ts - SERVICE DE GESTION DES BOTS
import { MatchmakingPlayer } from './MatchmakingService';

// 🤖 TYPES POUR LES BOTS
export interface BotPlayer extends MatchmakingPlayer {
  botType: 'easy' | 'medium' | 'hard' | 'adaptive';
  difficulty: number; // 1-10
  personality: BotPersonality;
  strategy: BotStrategy;
}

export interface BotPersonality {
  aggression: number;      // 0-100 : Tendance à attaquer
  patience: number;        // 0-100 : Tendance à attendre
  riskTaking: number;      // 0-100 : Prise de risques
  adaptability: number;    // 0-100 : Capacité d'adaptation
  cardPreference: string[]; // Cartes préférées
}

export interface BotStrategy {
  name: string;
  description: string;
  playstyle: 'rush' | 'control' | 'beatdown' | 'cycle' | 'siege';
  preferredElixirCost: number; // Coût élixir moyen préféré
  defensiveRatio: number;      // % de jeu défensif vs offensif
}

// 🎯 STRATÉGIES PRÉDÉFINIES
const BOT_STRATEGIES: BotStrategy[] = [
  {
    name: 'Rusher',
    description: 'Attaque rapide et constante',
    playstyle: 'rush',
    preferredElixirCost: 3.2,
    defensiveRatio: 20
  },
  {
    name: 'Contrôleur',
    description: 'Jeu défensif et contre-attaques',
    playstyle: 'control',
    preferredElixirCost: 3.8,
    defensiveRatio: 70
  },
  {
    name: 'Beatdown',
    description: 'Grosses poussées avec tanks',
    playstyle: 'beatdown',
    preferredElixirCost: 4.2,
    defensiveRatio: 40
  },
  {
    name: 'Cycleur',
    description: 'Cycle rapide de cartes',
    playstyle: 'cycle',
    preferredElixirCost: 2.8,
    defensiveRatio: 30
  }
];

// 🎴 DECKS PRÉDÉFINIS PAR STRATÉGIE
const BOT_DECKS = {
  rush: [
    ['goblin_barrel', 'skeleton_army', 'knight', 'archers', 'goblins', 'spear_goblins', 'arrows', 'fireball'],
    ['hog_rider', 'goblins', 'spear_goblins', 'archers', 'knight', 'cannon', 'arrows', 'fireball'],
    ['prince', 'goblins', 'skeleton_army', 'archers', 'knight', 'baby_dragon', 'arrows', 'lightning']
  ],
  control: [
    ['giant', 'musketeer', 'knight', 'archers', 'minions', 'cannon', 'arrows', 'fireball'],
    ['golem', 'night_witch', 'baby_dragon', 'mega_minion', 'knight', 'tornado', 'lightning', 'pump'],
    ['x_bow', 'knight', 'archers', 'skeletons', 'ice_spirit', 'cannon', 'arrows', 'fireball']
  ],
  beatdown: [
    ['golem', 'baby_dragon', 'night_witch', 'mega_minion', 'knight', 'tornado', 'lightning', 'pump'],
    ['giant', 'wizard', 'musketeer', 'knight', 'minions', 'cannon', 'arrows', 'fireball'],
    ['lava_hound', 'balloon', 'baby_dragon', 'mega_minion', 'knight', 'tornado', 'arrows', 'lightning']
  ],
  cycle: [
    ['hog_rider', 'ice_spirit', 'skeletons', 'cannon', 'musketeer', 'knight', 'arrows', 'fireball'],
    ['miner', 'poison', 'knight', 'archers', 'minions', 'skeletons', 'ice_spirit', 'cannon'],
    ['x_bow', 'knight', 'archers', 'skeletons', 'ice_spirit', 'cannon', 'arrows', 'log']
  ]
};

// 🤖 SERVICE PRINCIPAL DES BOTS
export class BotService {
  private static instance: BotService;
  private bots: Map<string, BotPlayer> = new Map();
  
  constructor() {
    console.log('🤖 BotService initialisé');
  }
  
  static getInstance(): BotService {
    if (!BotService.instance) {
      BotService.instance = new BotService();
    }
    return BotService.instance;
  }
  
  /**
   * Créer un bot adapté au niveau du joueur
   */
  createBotOpponent(humanPlayer: MatchmakingPlayer): BotPlayer {
    console.log(`🤖 Création bot pour ${humanPlayer.username} (${humanPlayer.trophies} trophées)`);
    
    // Déterminer la difficulté basée sur les trophées
    const difficulty = this.calculateDifficulty(humanPlayer.trophies);
    const botType = this.getBotType(difficulty);
    
    // Choisir une stratégie
    const strategy = this.selectStrategy(humanPlayer, difficulty);
    
    // Créer la personnalité
    const personality = this.generatePersonality(difficulty, strategy);
    
    // Choisir un deck adapté
    const deck = this.selectDeck(strategy, difficulty);
    
    // Générer un nom de bot
    const botName = this.generateBotName(strategy.playstyle);
    
    const bot: BotPlayer = {
      sessionId: `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: `bot_user_${Date.now()}`,
      username: botName,
      level: this.calculateBotLevel(humanPlayer.level, difficulty),
      trophies: this.calculateBotTrophies(humanPlayer.trophies, difficulty),
      arenaId: humanPlayer.arenaId,
      winRate: this.calculateBotWinRate(difficulty),
      deck: deck,
      preferredGameMode: 'ranked',
      region: humanPlayer.region,
      joinedAt: Date.now(),
      estimatedWaitTime: 0,
      searchAttempts: 0,
      // Propriétés bot spécifiques
      botType,
      difficulty,
      personality,
      strategy
    };
    
    this.bots.set(bot.sessionId, bot);
    
    console.log(`✅ Bot créé: ${bot.username} (${bot.strategy.name}, difficulté ${difficulty})`);
    console.log(`   Deck: ${bot.deck.join(', ')}`);
    
    return bot;
  }
  
  /**
   * Calculer la difficulté du bot (1-10)
   */
  private calculateDifficulty(playerTrophies: number): number {
    if (playerTrophies < 300) return Math.random() < 0.7 ? 2 : 3;      // Facile pour débutants
    if (playerTrophies < 600) return Math.floor(Math.random() * 2) + 3; // 3-4
    if (playerTrophies < 1000) return Math.floor(Math.random() * 2) + 4; // 4-5
    if (playerTrophies < 2000) return Math.floor(Math.random() * 3) + 5; // 5-7
    if (playerTrophies < 4000) return Math.floor(Math.random() * 2) + 7; // 7-8
    return Math.floor(Math.random() * 2) + 8; // 8-9 pour les pros
  }
  
  /**
   * Déterminer le type de bot
   */
  private getBotType(difficulty: number): 'easy' | 'medium' | 'hard' | 'adaptive' {
    if (difficulty <= 3) return 'easy';
    if (difficulty <= 6) return 'medium';
    if (difficulty <= 8) return 'hard';
    return 'adaptive';
  }
  
  /**
   * Sélectionner une stratégie pour le bot
   */
  private selectStrategy(humanPlayer: MatchmakingPlayer, difficulty: number): BotStrategy {
    // Pour les débutants, stratégies plus simples
    if (difficulty <= 3) {
      return BOT_STRATEGIES.find(s => s.playstyle === 'rush') || BOT_STRATEGIES[0];
    }
    
    // Pour les niveaux moyens, varier
    if (difficulty <= 6) {
      const simpleStrategies = BOT_STRATEGIES.filter(s => 
        ['rush', 'beatdown'].includes(s.playstyle)
      );
      return simpleStrategies[Math.floor(Math.random() * simpleStrategies.length)];
    }
    
    // Pour les niveaux élevés, toutes les stratégies
    return BOT_STRATEGIES[Math.floor(Math.random() * BOT_STRATEGIES.length)];
  }
  
  /**
   * Générer une personnalité pour le bot
   */
  private generatePersonality(difficulty: number, strategy: BotStrategy): BotPersonality {
    const basePersonality = {
      aggression: 50,
      patience: 50,
      riskTaking: 50,
      adaptability: difficulty * 10,
      cardPreference: []
    };
    
    // Ajuster selon la stratégie
    switch (strategy.playstyle) {
      case 'rush':
        basePersonality.aggression = 70 + Math.random() * 20;
        basePersonality.patience = 20 + Math.random() * 20;
        basePersonality.riskTaking = 60 + Math.random() * 30;
        break;
      case 'control':
        basePersonality.aggression = 20 + Math.random() * 30;
        basePersonality.patience = 70 + Math.random() * 20;
        basePersonality.riskTaking = 30 + Math.random() * 20;
        break;
      case 'beatdown':
        basePersonality.aggression = 40 + Math.random() * 30;
        basePersonality.patience = 60 + Math.random() * 20;
        basePersonality.riskTaking = 40 + Math.random() * 30;
        break;
      case 'cycle':
        basePersonality.aggression = 60 + Math.random() * 20;
        basePersonality.patience = 40 + Math.random() * 30;
        basePersonality.riskTaking = 50 + Math.random() * 30;
        break;
    }
    
    return basePersonality;
  }
  
  /**
   * Sélectionner un deck pour le bot
   */
  private selectDeck(strategy: BotStrategy, difficulty: number): string[] {
    const availableDecks = BOT_DECKS[strategy.playstyle] || BOT_DECKS.rush;
    let selectedDeck = availableDecks[Math.floor(Math.random() * availableDecks.length)];
    
    // Pour les bots faciles, utiliser le deck de base
    if (difficulty <= 3) {
      selectedDeck = ['knight', 'archers', 'goblins', 'giant', 'fireball', 'arrows', 'minions', 'musketeer'];
    }
    
    return [...selectedDeck];
  }
  
  /**
   * Calculer le niveau du bot
   */
  private calculateBotLevel(playerLevel: number, difficulty: number): number {
    const variation = difficulty <= 3 ? 1 : 2;
    const minLevel = Math.max(1, playerLevel - variation);
    const maxLevel = playerLevel + variation;
    return Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
  }
  
  /**
   * Calculer les trophées du bot
   */
  private calculateBotTrophies(playerTrophies: number, difficulty: number): number {
    const variation = Math.max(50, playerTrophies * 0.15); // 15% de variation
    const adjustment = (difficulty - 5) * 20; // Ajustement selon difficulté
    
    const minTrophies = Math.max(0, playerTrophies - variation + adjustment);
    const maxTrophies = playerTrophies + variation + adjustment;
    
    return Math.floor(Math.random() * (maxTrophies - minTrophies + 1)) + minTrophies;
  }
  
  /**
   * Calculer le winrate du bot
   */
  private calculateBotWinRate(difficulty: number): number {
    const baseWinRate = 40 + (difficulty * 5); // 45-85%
    const variation = 10;
    return Math.min(95, Math.max(20, baseWinRate + (Math.random() * variation * 2 - variation)));
  }
  
  /**
   * Générer un nom de bot
   */
  private generateBotName(playstyle: string): string {
    const prefixes = {
      rush: ['Swift', 'Fast', 'Quick', 'Rapid', 'Speedy'],
      control: ['Wise', 'Calm', 'Strategic', 'Patient', 'Tactical'],
      beatdown: ['Mighty', 'Strong', 'Heavy', 'Powerful', 'Crushing'],
      cycle: ['Clever', 'Smart', 'Agile', 'Nimble', 'Sharp'],
      siege: ['Steady', 'Fortress', 'Siege', 'Tower', 'Defense']
    };
    
    const suffixes = ['Bot', 'AI', 'Master', 'Player', 'Warrior', 'Champion'];
    
    const stylePrefix = prefixes[playstyle] || prefixes.rush;
    const prefix = stylePrefix[Math.floor(Math.random() * stylePrefix.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    
    return `${prefix}${suffix}${Math.floor(Math.random() * 100)}`;
  }
  
  /**
   * Obtenir un bot par sessionId
   */
  getBot(sessionId: string): BotPlayer | null {
    return this.bots.get(sessionId) || null;
  }
  
  /**
   * Supprimer un bot
   */
  removeBot(sessionId: string): boolean {
    return this.bots.delete(sessionId);
  }
  
  /**
   * Obtenir les statistiques des bots
   */
  getStats() {
    return {
      totalBots: this.bots.size,
      botsByType: this.getBotsByType(),
      botsByDifficulty: this.getBotsByDifficulty()
    };
  }
  
  private getBotsByType() {
    const stats = { easy: 0, medium: 0, hard: 0, adaptive: 0 };
    for (const bot of this.bots.values()) {
      stats[bot.botType]++;
    }
    return stats;
  }
  
  private getBotsByDifficulty() {
    const stats: { [key: number]: number } = {};
    for (const bot of this.bots.values()) {
      stats[bot.difficulty] = (stats[bot.difficulty] || 0) + 1;
    }
    return stats;
  }
}

// Export du service singleton
export const botService = BotService.getInstance();
