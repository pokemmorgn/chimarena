// server/src/services/CardManager.ts - SERVICE DE GESTION DES CARTES
import Card, { ICard, CardType, CardRarity, CardStats } from '../models/Card';
import User from '../models/User';
import { ArenaManager } from '../config/arenas';

// 🎯 INTERFACES POUR LE CARD MANAGER
export interface DeckValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    averageElixirCost: number;
    totalCost: number;
    typeDistribution: { [key: string]: number };
    rarityDistribution: { [key: string]: number };
  };
  recommendations?: string[];
}

export interface CardCollection {
  cardId: string;
  level: number;
  count: number;
  maxed: boolean;
  upgradeCost?: { gold: number; cards: number };
}

export interface MetaAnalysis {
  topCards: { cardId: string; usageRate: number; winRate: number }[];
  typePopularity: { [type: string]: number };
  rarityDistribution: { [rarity: string]: number };
  averageElixirCost: number;
  trendingCards: string[];
}

// 🃏 CARD MANAGER PRINCIPAL
export class CardManager {
  private cardCache: Map<string, ICard> = new Map();
  private cacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    console.log('🃏 CardManager initialisé');
  }

  // === GESTION DU CACHE ===

  /**
   * Charger toutes les cartes en cache
   */
  private async loadCardsToCache(): Promise<void> {
    const now = Date.now();
    
    if (this.cacheExpiry > now && this.cardCache.size > 0) {
      return; // Cache encore valide
    }

    console.log('🔄 Rechargement cache des cartes...');
    
    try {
      const cards = await Card.find({ isEnabled: true });
      
      this.cardCache.clear();
      cards.forEach(card => {
        this.cardCache.set(card.cardId, card);
      });
      
      this.cacheExpiry = now + this.CACHE_DURATION;
      console.log(`✅ Cache rechargé avec ${cards.length} cartes`);
      
    } catch (error) {
      console.error('❌ Erreur chargement cache cartes:', error);
      throw error;
    }
  }

  /**
   * Obtenir une carte du cache
   */
  private async getCardFromCache(cardId: string): Promise<ICard | null> {
    await this.loadCardsToCache();
    return this.cardCache.get(cardId) || null;
  }

  /**
   * Obtenir toutes les cartes du cache
   */
  private async getAllCardsFromCache(): Promise<ICard[]> {
    await this.loadCardsToCache();
    return Array.from(this.cardCache.values());
  }

  /**
   * Invalider le cache (à appeler après modifications)
   */
  public invalidateCache(): void {
    this.cacheExpiry = 0;
    this.cardCache.clear();
    console.log('🗑️ Cache cartes invalidé');
  }

  // === MÉTHODES PUBLIQUES PRINCIPALES ===

  /**
   * Obtenir une carte avec ses stats à un niveau donné
   */
  async getCardWithStats(cardId: string, level: number = 1): Promise<{ card: ICard; stats: CardStats } | null> {
    try {
      const card = await this.getCardFromCache(cardId);
      if (!card) return null;

      const validLevel = Math.max(1, Math.min(level, card.maxLevel));
      const stats = card.getStatsAtLevel(validLevel);

      return { card, stats };
    } catch (error) {
      console.error(`❌ Erreur getCardWithStats(${cardId}, ${level}):`, error);
      return null;
    }
  }

  /**
   * Obtenir toutes les cartes débloquées pour une arène
   */
  async getCardsForArena(arenaId: number): Promise<ICard[]> {
    try {
      const allCards = await this.getAllCardsFromCache();
      return allCards.filter(card => card.unlockedAtArena <= arenaId);
    } catch (error) {
      console.error(`❌ Erreur getCardsForArena(${arenaId}):`, error);
      return [];
    }
  }

  /**
   * Obtenir les cartes par type
   */
  async getCardsByType(type: CardType): Promise<ICard[]> {
    try {
      const allCards = await this.getAllCardsFromCache();
      return allCards.filter(card => card.type === type);
    } catch (error) {
      console.error(`❌ Erreur getCardsByType(${type}):`, error);
      return [];
    }
  }

  /**
   * Obtenir les cartes par rareté
   */
  async getCardsByRarity(rarity: CardRarity): Promise<ICard[]> {
    try {
      const allCards = await this.getAllCardsFromCache();
      return allCards.filter(card => card.rarity === rarity);
    } catch (error) {
      console.error(`❌ Erreur getCardsByRarity(${rarity}):`, error);
      return [];
    }
  }

  /**
   * Rechercher des cartes par critères multiples
   */
  async searchCards(criteria: {
    text?: string;
    types?: CardType[];
    rarities?: CardRarity[];
    minCost?: number;
    maxCost?: number;
    arena?: number;
    tags?: string[];
  }): Promise<ICard[]> {
    try {
      let cards = await this.getAllCardsFromCache();

      // Filtrage par arène
      if (criteria.arena !== undefined) {
        cards = cards.filter(card => card.unlockedAtArena <= criteria.arena!);
      }

      // Filtrage par types
      if (criteria.types && criteria.types.length > 0) {
        cards = cards.filter(card => criteria.types!.includes(card.type));
      }

      // Filtrage par raretés
      if (criteria.rarities && criteria.rarities.length > 0) {
        cards = cards.filter(card => criteria.rarities!.includes(card.rarity));
      }

      // Filtrage par coût
      if (criteria.minCost !== undefined) {
        cards = cards.filter(card => card.elixirCost >= criteria.minCost!);
      }
      if (criteria.maxCost !== undefined) {
        cards = cards.filter(card => card.elixirCost <= criteria.maxCost!);
      }

      // Recherche textuelle
      if (criteria.text) {
        const searchText = criteria.text.toLowerCase();
        cards = cards.filter(card => 
          card.name.toLowerCase().includes(searchText) ||
          card.description.toLowerCase().includes(searchText) ||
          card.cardId.toLowerCase().includes(searchText)
        );
      }

      // Filtrage par tags
      if (criteria.tags && criteria.tags.length > 0) {
        cards = cards.filter(card => 
          criteria.tags!.some(tag => card.tags.includes(tag.toLowerCase()))
        );
      }

      return cards;
    } catch (error) {
      console.error(`❌ Erreur searchCards:`, error);
      return [];
    }
  }

  // === VALIDATION ET ANALYSE DE DECK ===

  /**
   * Valider un deck de manière complète
   */
  async validateDeck(cardIds: string[], userArenaId?: number): Promise<DeckValidationResult> {
    const result: DeckValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      stats: {
        averageElixirCost: 0,
        totalCost: 0,
        typeDistribution: {},
        rarityDistribution: {}
      },
      recommendations: []
    };

    try {
      // Validation basique
      if (!Array.isArray(cardIds) || cardIds.length !== 8) {
        result.isValid = false;
        result.errors.push('Un deck doit contenir exactement 8 cartes');
        return result;
      }

      // Vérifier les doublons
      const uniqueCards = new Set(cardIds);
      if (uniqueCards.size !== cardIds.length) {
        result.isValid = false;
        result.errors.push('Le deck ne peut pas contenir de cartes en double');
        return result;
      }

      // Charger les cartes
      const cards: ICard[] = [];
      for (const cardId of cardIds) {
        const card = await this.getCardFromCache(cardId);
        if (!card) {
          result.isValid = false;
          result.errors.push(`Carte introuvable: ${cardId}`);
        } else {
          cards.push(card);
        }
      }

      if (!result.isValid) return result;

      // Calculer les statistiques
      result.stats.totalCost = cards.reduce((sum, card) => sum + card.elixirCost, 0);
      result.stats.averageElixirCost = Math.round((result.stats.totalCost / 8) * 10) / 10;

      // Distribution par type
      cards.forEach(card => {
        result.stats.typeDistribution[card.type] = 
          (result.stats.typeDistribution[card.type] || 0) + 1;
      });

      // Distribution par rareté
      cards.forEach(card => {
        result.stats.rarityDistribution[card.rarity] = 
          (result.stats.rarityDistribution[card.rarity] || 0) + 1;
      });

      // Vérifications avancées et recommandations
      await this.analyzedeckBalance(cards, result, userArenaId);

      console.log(`🎮 Deck validé - Coût moyen: ${result.stats.averageElixirCost}, Erreurs: ${result.errors.length}`);

    } catch (error) {
      console.error('❌ Erreur validation deck:', error);
      result.isValid = false;
      result.errors.push('Erreur interne lors de la validation');
    }

    return result;
  }

  /**
   * Analyser l'équilibre d'un deck
   */
  private async analyzedeckBalance(
    cards: ICard[], 
    result: DeckValidationResult, 
    userArenaId?: number
  ): Promise<void> {
    // Vérifier le coût moyen
    if (result.stats.averageElixirCost > 4.5) {
      result.warnings.push('Coût moyen élevé - le deck pourrait être lent à jouer');
    } else if (result.stats.averageElixirCost < 3.0) {
      result.warnings.push('Coût moyen très bas - manque peut-être de cartes puissantes');
    }

    // Vérifier l'équilibre des types
    const troopCount = result.stats.typeDistribution['troop'] || 0;
    const spellCount = result.stats.typeDistribution['spell'] || 0;
    const buildingCount = result.stats.typeDistribution['building'] || 0;

    if (troopCount < 4) {
      result.warnings.push('Peu de troupes - deck vulnérable aux rushes');
    }
    if (spellCount === 0) {
      result.warnings.push('Aucun sort - difficile de finir les tours ennemies');
    }
    if (spellCount > 3) {
      result.warnings.push('Trop de sorts - manque de présence sur le terrain');
    }

    // Vérifier les cartes de défense
    const defensiveCards = cards.filter(card => 
      card.type === 'building' || 
      card.tags.includes('defense') ||
      card.tags.includes('tank')
    );
    
    if (defensiveCards.length < 2) {
      result.warnings.push('Manque de cartes défensives');
    }

    // Vérifier les win conditions
    const winConditions = cards.filter(card => 
      card.tags.includes('win_condition') ||
      card.tags.includes('heavy') ||
      (card.type === 'troop' && (card.baseStats.health || 0) > 2000)
    );
    
    if (winConditions.length === 0) {
      result.warnings.push('Aucune condition de victoire claire');
    }

    // Vérifications spécifiques à l\'arène utilisateur
    if (userArenaId !== undefined) {
      const unlockedCards = cards.filter(card => card.unlockedAtArena <= userArenaId);
      const lockedCards = cards.filter(card => card.unlockedAtArena > userArenaId);
      
      if (lockedCards.length > 0) {
        result.errors.push(`${lockedCards.length} carte(s) non débloquée(s) pour votre arène`);
        result.isValid = false;
      }
    }

    // Recommandations générales
    if (result.stats.averageElixirCost > 4.0 && spellCount < 2) {
      result.recommendations?.push('Ajouter des sorts légers pour plus de versatilité');
    }
    
    if (troopCount > 6) {
      result.recommendations?.push('Considérer ajouter un bâtiment défensif');
    }
  }

  // === GESTION DES COLLECTIONS UTILISATEUR ===

  /**
   * Obtenir la collection de cartes d'un utilisateur
   */
  async getUserCardCollection(userId: string): Promise<CardCollection[]> {
    try {
      const user = await User.findById(userId).select('cards');
      if (!user || !user.cards) return [];

      const collection: CardCollection[] = [];

      for (const userCard of user.cards) {
        const card = await this.getCardFromCache(userCard.cardId);
        if (card) {
          const isMaxed = userCard.level >= card.maxLevel;
          const upgradeCost = !isMaxed ? 
            card.getUpgradeCost(userCard.level, userCard.level + 1) : 
            undefined;

          collection.push({
            cardId: userCard.cardId,
            level: userCard.level,
            count: userCard.count,
            maxed: isMaxed,
            upgradeCost
          });
        }
      }

      return collection.sort((a, b) => a.cardId.localeCompare(b.cardId));
    } catch (error) {
      console.error(`❌ Erreur getUserCardCollection(${userId}):`, error);
      return [];
    }
  }

  /**
   * Vérifier si un utilisateur peut améliorer une carte
   */
  async canUpgradeCard(userId: string, cardId: string): Promise<{
    canUpgrade: boolean;
    reason?: string;
    cost?: { gold: number; cards: number };
    newLevel?: number;
  }> {
    try {
      const user = await User.findById(userId).select('cards resources');
      if (!user) {
        return { canUpgrade: false, reason: 'Utilisateur non trouvé' };
      }

      const userCard = user.cards.find(c => c.cardId === cardId);
      if (!userCard) {
        return { canUpgrade: false, reason: 'Carte non possédée' };
      }

      const card = await this.getCardFromCache(cardId);
      if (!card) {
        return { canUpgrade: false, reason: 'Carte introuvable' };
      }

      if (userCard.level >= card.maxLevel) {
        return { canUpgrade: false, reason: 'Carte déjà au niveau maximum' };
      }

      const upgradeCost = card.getUpgradeCost(userCard.level, userCard.level + 1);
      
      const hasEnoughGold = (user.resources.gold || 0) >= upgradeCost.gold;
      const hasEnoughCards = userCard.count >= upgradeCost.cards;

      if (!hasEnoughGold) {
        return { 
          canUpgrade: false, 
          reason: `Or insuffisant (${upgradeCost.gold} requis, ${user.resources.gold} disponible)`,
          cost: upgradeCost
        };
      }

      if (!hasEnoughCards) {
        return { 
          canUpgrade: false, 
          reason: `Cartes insuffisantes (${upgradeCost.cards} requises, ${userCard.count} disponibles)`,
          cost: upgradeCost
        };
      }

      return {
        canUpgrade: true,
        cost: upgradeCost,
        newLevel: userCard.level + 1
      };
    } catch (error) {
      console.error(`❌ Erreur canUpgradeCard(${userId}, ${cardId}):`, error);
      return { canUpgrade: false, reason: 'Erreur interne' };
    }
  }

  // === ANALYTICS ET MÉTA ===

  /**
   * Analyser le méta actuel (simulation - à implémenter avec vraies données)
   */
  async getMetaAnalysis(): Promise<MetaAnalysis> {
    try {
      const allCards = await this.getAllCardsFromCache();
      
      // Pour l'instant, simulation basée sur les stats des cartes
      // Dans le futur, utiliser les vraies données de matches
      
      const typePopularity: { [type: string]: number } = {};
      const rarityDistribution: { [rarity: string]: number } = {};
      let totalElixirCost = 0;

      allCards.forEach(card => {
        typePopularity[card.type] = (typePopularity[card.type] || 0) + 1;
        rarityDistribution[card.rarity] = (rarityDistribution[card.rarity] || 0) + 1;
        totalElixirCost += card.elixirCost;
      });

      // Simulation des cartes populaires (à remplacer par vraies stats)
      const topCards = allCards
        .filter(card => card.gameStats?.usageRate)
        .sort((a, b) => (b.gameStats?.usageRate || 0) - (a.gameStats?.usageRate || 0))
        .slice(0, 10)
        .map(card => ({
          cardId: card.cardId,
          usageRate: card.gameStats?.usageRate || 0,
          winRate: card.gameStats?.winRate || 0
        }));

      return {
        topCards,
        typePopularity,
        rarityDistribution,
        averageElixirCost: Math.round((totalElixirCost / allCards.length) * 10) / 10,
        trendingCards: allCards.slice(0, 5).map(card => card.cardId) // Simulation
      };
    } catch (error) {
      console.error('❌ Erreur getMetaAnalysis:', error);
      return {
        topCards: [],
        typePopularity: {},
        rarityDistribution: {},
        averageElixirCost: 3.5,
        trendingCards: []
      };
    }
  }

  /**
   * Obtenir des recommandations de deck basées sur l'arène
   */
  async getDeckRecommendations(arenaId: number, userCards?: string[]): Promise<{
    recommendedDecks: { name: string; cards: string[]; description: string }[];
    missingCards: string[];
  }> {
    try {
      const availableCards = await this.getCardsForArena(arenaId);
      
      // Decks recommandés par arène (simulation - à enrichir)
      const deckTemplates = [
        {
          name: "Deck Équilibré",
          cards: ["knight", "archers", "fireball", "arrows", "giant", "musketeer", "cannon", "minions"],
          description: "Un deck polyvalent pour débuter"
        },
        {
          name: "Rush Rapide", 
          cards: ["barbarians", "archers", "arrows", "fireball", "minions", "knight", "giant", "cannon"],
          description: "Attaques rapides et pression constante"
        }
      ];

      // Filtrer les decks réalisables avec les cartes disponibles
      const viableDecks = deckTemplates.filter(deck => 
        deck.cards.every(cardId => 
          availableCards.some(card => card.cardId === cardId)
        )
      );

      // Calculer les cartes manquantes si l'utilisateur a une collection
      let missingCards: string[] = [];
      if (userCards) {
        const allRecommendedCards = new Set(
          viableDecks.flatMap(deck => deck.cards)
        );
        missingCards = Array.from(allRecommendedCards).filter(
          cardId => !userCards.includes(cardId)
        );
      }

      return {
        recommendedDecks: viableDecks,
        missingCards
      };
    } catch (error) {
      console.error(`❌ Erreur getDeckRecommendations(${arenaId}):`, error);
      return { recommendedDecks: [], missingCards: [] };
    }
  }

  // === UTILITAIRES ===

  /**
   * Obtenir les statistiques globales des cartes
   */
  async getGlobalStats(): Promise<{
    totalCards: number;
    cardsByType: { [type: string]: number };
    cardsByRarity: { [rarity: string]: number };
    cardsByArena: { [arena: number]: number };
    averageElixirCost: number;
  }> {
    try {
      const allCards = await this.getAllCardsFromCache();
      
      const stats = {
        totalCards: allCards.length,
        cardsByType: {} as { [type: string]: number },
        cardsByRarity: {} as { [rarity: string]: number },
        cardsByArena: {} as { [arena: number]: number },
        averageElixirCost: 0
      };

      let totalCost = 0;

      allCards.forEach(card => {
        // Par type
        stats.cardsByType[card.type] = (stats.cardsByType[card.type] || 0) + 1;
        
        // Par rareté
        stats.cardsByRarity[card.rarity] = (stats.cardsByRarity[card.rarity] || 0) + 1;
        
        // Par arène
        stats.cardsByArena[card.unlockedAtArena] = (stats.cardsByArena[card.unlockedAtArena] || 0) + 1;
        
        totalCost += card.elixirCost;
      });

      stats.averageElixirCost = allCards.length > 0 ? 
        Math.round((totalCost / allCards.length) * 10) / 10 : 0;

      return stats;
    } catch (error) {
      console.error('❌ Erreur getGlobalStats:', error);
      return {
        totalCards: 0,
        cardsByType: {},
        cardsByRarity: {},
        cardsByArena: {},
        averageElixirCost: 0
      };
    }
  }
}

// Export singleton
export const cardManager = new CardManager();
export default cardManager;
