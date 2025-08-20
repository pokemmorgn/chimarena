// server/src/config/arenas.ts - CONFIGURATION DES ARÈNES ChimArena
export interface Arena {
  id: number;
  nameId: string; // ID de traduction pour le client
  minTrophies: number;
  maxTrophies?: number; // undefined pour la dernière arène
  icon: string;
  descriptionId: string; // ID de traduction pour le client
  rewards: {
    gold: number;
    gems: number;
    cards: number;
  };
  // Nouvelles cartes débloquées dans cette arène
  unlockedCards?: string[];
}

/**
 * 🏟️ CONFIGURATION DES ARÈNES - Inspiré de Clash Royale
 * Progression logique de 0 à 5000+ trophées
 * Les nameId et descriptionId sont traduits côté client
 */
export const ARENAS: Arena[] = [
  {
    id: 0,
    nameId: "arena.training_center.name",
    minTrophies: 0,
    maxTrophies: 399,
    icon: "🎯",
    descriptionId: "arena.training_center.description",
    rewards: { gold: 50, gems: 1, cards: 1 },
    unlockedCards: ["knight", "archers", "fireball", "arrows"]
  },
  {
    id: 1,
    nameId: "arena.goblin_stadium.name",
    minTrophies: 400,
    maxTrophies: 799,
    icon: "👹",
    descriptionId: "arena.goblin_stadium.description",
    rewards: { gold: 75, gems: 2, cards: 2 },
    unlockedCards: ["barbarians", "minions"]
  },
  {
    id: 2,
    nameId: "arena.bone_pit.name",
    minTrophies: 800,
    maxTrophies: 1199,
    icon: "☠️",
    descriptionId: "arena.bone_pit.description",
    rewards: { gold: 100, gems: 3, cards: 3 },
    unlockedCards: ["giant", "cannon"]
  },
  {
    id: 3,
    nameId: "arena.royal_arena.name",
    minTrophies: 1200,
    maxTrophies: 1599,
    icon: "👑",
    descriptionId: "arena.royal_arena.description",
    rewards: { gold: 150, gems: 4, cards: 4 },
    unlockedCards: ["musketeer", "lightning"]
  },
  {
    id: 4,
    nameId: "arena.spell_valley.name",
    minTrophies: 1600,
    maxTrophies: 1999,
    icon: "🔮",
    descriptionId: "arena.spell_valley.description",
    rewards: { gold: 200, gems: 5, cards: 5 },
    unlockedCards: ["wizard", "dragon"]
  },
  {
    id: 5,
    nameId: "arena.builders_workshop.name",
    minTrophies: 2000,
    maxTrophies: 2399,
    icon: "🏗️",
    descriptionId: "arena.builders_workshop.description",
    rewards: { gold: 250, gems: 6, cards: 6 },
    unlockedCards: ["tesla", "inferno_tower"]
  },
  {
    id: 6,
    nameId: "arena.royal_arena_high.name",
    minTrophies: 2400,
    maxTrophies: 2999,
    icon: "🏰",
    descriptionId: "arena.royal_arena_high.description",
    rewards: { gold: 300, gems: 8, cards: 7 },
    unlockedCards: ["prince", "dark_prince"]
  },
  {
    id: 7,
    nameId: "arena.legendary_arena.name",
    minTrophies: 3000,
    maxTrophies: 3999,
    icon: "⭐",
    descriptionId: "arena.legendary_arena.description",
    rewards: { gold: 400, gems: 10, cards: 8 },
    unlockedCards: ["legendary_card_1", "legendary_card_2"]
  },
  {
    id: 8,
    nameId: "arena.champions_arena.name",
    minTrophies: 4000,
    maxTrophies: 4999,
    icon: "🏆",
    descriptionId: "arena.champions_arena.description",
    rewards: { gold: 500, gems: 15, cards: 10 },
    unlockedCards: ["champion_card"]
  },
  {
    id: 9,
    nameId: "arena.ultimate_arena.name",
    minTrophies: 5000,
    // Pas de maxTrophies = arène finale
    icon: "💎",
    descriptionId: "arena.ultimate_arena.description",
    rewards: { gold: 1000, gems: 25, cards: 15 },
    unlockedCards: ["ultimate_card"]
  }
];

/**
 * 🎯 FONCTIONS UTILITAIRES POUR LES ARÈNES
 */
export class ArenaManager {
  /**
   * Obtenir l'arène actuelle d'un joueur selon ses trophées
   */
  static getCurrentArena(trophies: number): Arena {
    // Chercher la bonne arène
    for (const arena of ARENAS) {
      if (trophies >= arena.minTrophies) {
        // Si pas de maxTrophies (arène finale) ou si dans la range
        if (!arena.maxTrophies || trophies <= arena.maxTrophies) {
          return arena;
        }
      }
    }
    
    // Par défaut, première arène
    return ARENAS[0];
  }

  /**
   * Obtenir l'arène suivante (pour afficher la progression)
   */
  static getNextArena(currentArena: Arena): Arena | null {
    const currentIndex = ARENAS.findIndex(a => a.id === currentArena.id);
    return currentIndex < ARENAS.length - 1 ? ARENAS[currentIndex + 1] : null;
  }

  /**
   * Obtenir l'arène précédente
   */
  static getPreviousArena(currentArena: Arena): Arena | null {
    const currentIndex = ARENAS.findIndex(a => a.id === currentArena.id);
    return currentIndex > 0 ? ARENAS[currentIndex - 1] : null;
  }

  /**
   * Calculer les trophées requis pour la prochaine arène
   */
  static getTrophiesToNextArena(trophies: number): number {
    const currentArena = this.getCurrentArena(trophies);
    const nextArena = this.getNextArena(currentArena);
    
    if (!nextArena) {
      return 0; // Déjà à l'arène maximale
    }
    
    return Math.max(0, nextArena.minTrophies - trophies);
  }

  /**
   * Vérifier si un joueur peut débloquer de nouvelles cartes
   */
  static getUnlockedCards(oldTrophies: number, newTrophies: number): string[] {
    const oldArena = this.getCurrentArena(oldTrophies);
    const newArena = this.getCurrentArena(newTrophies);
    
    const unlockedCards: string[] = [];
    
    // Si changement d'arène vers le haut
    if (newArena.id > oldArena.id) {
      // Parcourir toutes les arènes entre l'ancienne et la nouvelle
      for (let i = oldArena.id + 1; i <= newArena.id; i++) {
        const arena = ARENAS.find(a => a.id === i);
        if (arena?.unlockedCards) {
          unlockedCards.push(...arena.unlockedCards);
        }
      }
    }
    
    return unlockedCards;
  }

  /**
   * Obtenir les récompenses de progression d'arène
   */
  static getArenaReward(arena: Arena): { gold: number; gems: number; cards: number } {
    return { ...arena.rewards };
  }

  /**
   * Obtenir toutes les arènes (pour l'UI)
   */
  static getAllArenas(): Arena[] {
    return [...ARENAS];
  }

  /**
   * Obtenir une arène par ID
   */
  static getArenaById(id: number): Arena | null {
    return ARENAS.find(arena => arena.id === id) || null;
  }

  /**
   * Calculer le pourcentage de progression dans l'arène actuelle
   */
  static getArenaProgress(trophies: number): number {
    const arena = this.getCurrentArena(trophies);
    
    if (!arena.maxTrophies) {
      // Arène finale, progression basée sur trophées bonus
      const bonus = trophies - arena.minTrophies;
      return Math.min(100, (bonus / 1000) * 100); // 1000 trophées = 100%
    }
    
    const range = arena.maxTrophies - arena.minTrophies;
    const progress = trophies - arena.minTrophies;
    
    return Math.max(0, Math.min(100, (progress / range) * 100));
  }

  /**
   * Valider qu'un nombre de trophées est valide
   */
  static isValidTrophyCount(trophies: number): boolean {
    return trophies >= 0 && trophies <= 10000; // Limite raisonnable
  }

  /**
   * Obtenir le rang relatif dans l'arène (pour l'affichage)
   */
  static getArenaRank(trophies: number): string {
    const arena = this.getCurrentArena(trophies);
    const progress = this.getArenaProgress(trophies);
    
    if (progress >= 90) return "★★★ Élite";
    if (progress >= 70) return "★★ Avancé";
    if (progress >= 40) return "★ Intermédiaire";
    return "Débutant";
  }

  /**
   * Simuler un gain/perte de trophées selon le matchmaking
   */
  static calculateTrophyChange(
    playerTrophies: number, 
    opponentTrophies: number, 
    isWin: boolean
  ): number {
    const trophyDifference = opponentTrophies - playerTrophies;
    
    if (isWin) {
      // Victoire : plus de trophées si l'adversaire est plus fort
      if (trophyDifference >= 200) return 35; // Adversaire bien plus fort
      if (trophyDifference >= 100) return 32;
      if (trophyDifference >= 0) return 30;   // Adversaire équivalent
      if (trophyDifference >= -100) return 28;
      return 25; // Adversaire plus faible
    } else {
      // Défaite : moins de perte si l'adversaire est plus fort
      if (trophyDifference >= 200) return -20; // Adversaire bien plus fort
      if (trophyDifference >= 100) return -22;
      if (trophyDifference >= 0) return -25;   // Adversaire équivalent
      if (trophyDifference >= -100) return -28;
      return -30; // Adversaire plus faible
    }
  }
}

export default ArenaManager;
