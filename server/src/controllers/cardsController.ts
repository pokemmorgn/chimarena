// server/src/controllers/cardsController.ts
import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import { auditLogger } from '../utils/auditLogger';

// Types pour les cartes
export interface Card {
  id: string;
  name: string;
  description: string;
  cost: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'troop' | 'spell' | 'building';
  arena: number;
  stats: {
    hitPoints?: number;
    damage?: number;
    speed?: 'slow' | 'medium' | 'fast' | 'very_fast';
    range?: number;
    targets?: 'ground' | 'air' | 'both';
    deployTime?: number;
  };

// GET /api/cards - Obtenir toutes les cartes disponibles
export const getAllCards = async (req: Request, res: Response) => {
  try {
    // Pour l'instant, on retourne juste la carte de test
    // Plus tard: const cards = await Card.find({}).sort({ arena: 1, rarity: 1 });
    
    const cards = [TEST_CARD];
    
    res.json({
      success: true,
      cards: cards.map(card => ({
        ...card,
        // Ne pas exposer les requirements d'upgrade pour économiser la bande passante
        upgradeRequirements: undefined
      }))
    });
  } catch (error) {
    console.error('Erreur récupération cartes:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};

// GET /api/cards/collection - Obtenir la collection de cartes de l'utilisateur
export const getUserCards = async (req: AuthenticatedRequest, res: Response) => {
  const requestInfo = {
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || '',
    userId: req.user?.id,
    username: req.user?.username
  };

  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      await auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Tentative d\'accès à la collection avec utilisateur inexistant',
        {
          ...requestInfo,
          success: false,
          severity: 'HIGH',
        }
      );
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Enrichir les cartes utilisateur avec les infos de la carte de base et calculs
    const enrichedCards = user.cards.map((userCard: any) => {
      // Pour l'instant, on utilise juste TEST_CARD
      const baseCard = TEST_CARD; // Plus tard: CARDS_DATABASE.find(c => c.id === userCard.cardId)
      
      if (!baseCard) return null;

      const stats = calculateCardStats(baseCard, userCard.level);
      const canUpgrade = canUpgradeCard(userCard, baseCard, user.resources.gold);
      const isMaxLevel = userCard.level >= 13;

      return {
        ...userCard.toObject(),
        cardInfo: {
          name: baseCard.name,
          description: baseCard.description,
          cost: baseCard.cost,
          rarity: baseCard.rarity,
          type: baseCard.type,
          arena: baseCard.arena
        },
        stats,
        canUpgrade: canUpgrade && !isMaxLevel,
        maxLevel: isMaxLevel,
        upgradeRequirements: isMaxLevel ? null : baseCard.upgradeRequirements[userCard.level + 1]
      };
    }).filter(Boolean);

    res.json({
      success: true,
      cards: enrichedCards,
      totalCards: enrichedCards.length,
      resources: user.resources
    });

  } catch (error) {
    await auditLogger.logEvent(
      'SYSTEM_ERROR',
      'Erreur lors de la récupération de la collection',
      {
        ...requestInfo,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        severity: 'MEDIUM',
      }
    );
    console.error('Erreur récupération collection:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};

// POST /api/cards/upgrade - Améliorer une carte
export const upgradeCard = async (req: AuthenticatedRequest, res: Response) => {
  const requestInfo = {
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || '',
    userId: req.user?.id,
    username: req.user?.username
  };

  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: 'Authentification requise' });
    }

    const { cardId } = req.body as { cardId: string };
    
    if (!cardId) {
      return res.status(400).json({ success: false, message: 'ID de carte requis' });
    }

    const user: any = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Trouver la carte dans la collection de l'utilisateur
    const userCard = user.cards.find((card: any) => card.cardId === cardId);
    if (!userCard) {
      await auditLogger.logEvent(
        'SECURITY_SUSPICIOUS_ACTIVITY',
        'Tentative d\'amélioration d\'une carte non possédée',
        {
          ...requestInfo,
          success: false,
          details: { cardId },
          severity: 'MEDIUM',
        }
      );
      return res.status(400).json({ success: false, message: 'Carte non trouvée dans votre collection' });
    }

    // Pour l'instant, utiliser TEST_CARD
    const baseCard = TEST_CARD;
    if (!baseCard) {
      return res.status(400).json({ success: false, message: 'Carte invalide' });
    }

    const nextLevel = userCard.level + 1;
    const requirements = baseCard.upgradeRequirements[nextLevel];

    if (!requirements || nextLevel > 13) {
      return res.status(400).json({ success: false, message: 'Carte déjà au niveau maximum' });
    }

    // Vérifier les ressources
    if (userCard.count < requirements.cards) {
      return res.status(400).json({ 
        success: false, 
        message: `Cartes insuffisantes (${userCard.count}/${requirements.cards})` 
      });
    }

    if (user.resources.gold < requirements.gold) {
      return res.status(400).json({ 
        success: false, 
        message: `Or insuffisant (${user.resources.gold}/${requirements.gold})` 
      });
    }

    // Effectuer l'amélioration
    userCard.level = nextLevel;
    userCard.count -= requirements.cards;
    user.resources.gold -= requirements.gold;

    await user.save();

    // Log de l'amélioration
    await auditLogger.logEvent(
      'GAME_DECK_CHANGE',
      'Amélioration de carte réussie',
      {
        ...requestInfo,
        success: true,
        details: { 
          cardId, 
          newLevel: nextLevel, 
          cardsUsed: requirements.cards, 
          goldUsed: requirements.gold 
        },
        severity: 'LOW',
      }
    );

    res.json({
      success: true,
      message: `${baseCard.name} amélioré au niveau ${nextLevel} !`,
      card: {
        ...userCard.toObject(),
        cardInfo: {
          name: baseCard.name,
          description: baseCard.description,
          cost: baseCard.cost,
          rarity: baseCard.rarity,
          type: baseCard.type
        },
        stats: calculateCardStats(baseCard, nextLevel)
      },
      resources: user.resources
    });

  } catch (error) {
    await auditLogger.logEvent(
      'SYSTEM_ERROR',
      'Erreur lors de l\'amélioration de carte',
      {
        ...requestInfo,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
        severity: 'MEDIUM',
      }
    );
    console.error('Erreur amélioration carte:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};

// GET /api/cards/:cardId - Obtenir les détails d'une carte spécifique
export const getCardDetails = async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;
    
    // Pour l'instant, vérifier si c'est notre carte de test
    if (cardId !== 'knight') {
      return res.status(404).json({ success: false, message: 'Carte non trouvée' });
    }

    const card = TEST_CARD;
    
    res.json({
      success: true,
      card: {
        ...card,
        // Inclure les stats pour tous les niveaux
        statsByLevel: Array.from({ length: 13 }, (_, i) => ({
          level: i + 1,
          stats: calculateCardStats(card, i + 1)
        }))
      }
    });
  } catch (error) {
    console.error('Erreur récupération détails carte:', error);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
};
  upgradeRequirements: {
    [level: number]: {
      cards: number;
      gold: number;
    };
  };
}

export interface UserCard {
  cardId: string;
  level: number;
  count: number;
  canUpgrade?: boolean;
  maxLevel?: boolean;
}

// Carte de test (en attendant la vraie DB)
const TEST_CARD: Card = {
  id: 'knight',
  name: 'Chevalier',
  description: 'Un guerrier robuste et loyal. Il défend votre tour avec honneur !',
  cost: 3,
  rarity: 'common',
  type: 'troop',
  arena: 0,
  stats: {
    hitPoints: 1344,
    damage: 167,
    speed: 'medium',
    range: 1,
    targets: 'ground',
    deployTime: 1
  },
  upgradeRequirements: {
    2: { cards: 2, gold: 5 },
    3: { cards: 4, gold: 20 },
    4: { cards: 10, gold: 50 },
    5: { cards: 20, gold: 150 },
    6: { cards: 50, gold: 500 }
  }
};

// Fonction helper pour calculer les stats d'une carte selon son niveau
const calculateCardStats = (card: Card, level: number) => {
  const baseMultiplier = 1 + (level - 1) * 0.1; // +10% par niveau
  return {
    ...card.stats,
    hitPoints: card.stats.hitPoints ? Math.round(card.stats.hitPoints * baseMultiplier) : undefined,
    damage: card.stats.damage ? Math.round(card.stats.damage * baseMultiplier) : undefined
  };
};

// Fonction helper pour vérifier si une carte peut être améliorée
const canUpgradeCard = (userCard: UserCard, card: Card, userGold: number): boolean => {
  const nextLevel = userCard.level + 1;
  const requirements = card.upgradeRequirements[nextLevel];
  
  if (!requirements || nextLevel > 13) return false;
  
  return userCard.count >= requirements.cards && userGold >= requirements.gold;
