// server/src/routes/cardRoutes.ts - ROUTES API POUR LES CARTES
import { Router, Request, Response } from 'express';
import Card from '../models/Card';
import { authenticateToken, optionalAuth, AuthenticatedRequest } from '../middleware/authMiddleware';
import User from '../models/User';
import rateLimit from 'express-rate-limit';
import { cardManager } from '../services/CardManager';
const router = Router();

// Rate limiting pour les API cards
const cardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requêtes par 15 min (généreux pour un jeu)
  message: { error: 'Trop de requêtes cartes' }
});

// 📋 GET /api/cards - Lister toutes les cartes
router.get('/', cardLimiter, async (req: Request, res: Response) => {
  try {
    const {
      type,
      rarity,
      arena,
      enabled = 'true',
      sort = 'elixirCost',
      order = 'asc',
      limit = '50',
      offset = '0'
    } = req.query;

    console.log(`[CARDS] Liste demandée - Type: ${type}, Rareté: ${rarity}, Arène: ${arena}`);

    // Construction du filtre
    const filter: any = {};
    
    if (enabled === 'true') filter.isEnabled = true;
    if (type && ['troop', 'spell', 'building'].includes(type as string)) {
      filter.type = type;
    }
    if (rarity && ['common', 'rare', 'epic', 'legendary', 'champion'].includes(rarity as string)) {
      filter.rarity = rarity;
    }
    if (arena) {
      const arenaId = parseInt(arena as string);
      if (!isNaN(arenaId) && arenaId >= 0 && arenaId <= 9) {
        filter.unlockedAtArena = { $lte: arenaId };
      }
    }

    // Construction du tri
    const sortObj: any = {};
    const validSortFields = ['elixirCost', 'name', 'rarity', 'unlockedAtArena', 'createdAt'];
    if (validSortFields.includes(sort as string)) {
      sortObj[sort as string] = order === 'desc' ? -1 : 1;
    } else {
      sortObj.elixirCost = 1; // Tri par défaut
    }

    // Pagination
    const limitNum = Math.min(parseInt(limit as string) || 50, 100); // Max 100
    const offsetNum = Math.max(parseInt(offset as string) || 0, 0);

    // Query
    const cards = await Card.find(filter)
      .sort(sortObj)
      .limit(limitNum)
      .skip(offsetNum)
      .select('-gameStats -__v'); // Exclure les stats internes

    const total = await Card.countDocuments(filter);

    console.log(`[CARDS] ${cards.length} cartes retournées sur ${total} total`);

    res.json({
      success: true,
      cards: cards.map(card => ({
        cardId: card.cardId,
        name: card.name,
        description: card.description,
        type: card.type,
        rarity: card.rarity,
        elixirCost: card.elixirCost,
        unlockedAtArena: card.unlockedAtArena,
        maxLevel: card.maxLevel,
        baseStats: card.baseStats,
        imageUrl: card.imageUrl,
        tags: card.tags
      })),
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasNext: offsetNum + limitNum < total
      },
      filters: {
        type: type || null,
        rarity: rarity || null,
        arena: arena || null
      }
    });

  } catch (error: any) {
    console.error(`[CARDS] Erreur liste cartes:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// 🔍 GET /api/cards/:cardId - Obtenir une carte spécifique
router.get('/:cardId', cardLimiter, async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;
    const { level = '1' } = req.query;

    if (!cardId || !/^[a-z0-9_]+$/.test(cardId)) {
      return res.status(400).json({
        success: false,
        message: 'ID de carte invalide'
      });
    }

    console.log(`[CARDS] Carte demandée: ${cardId}, Niveau: ${level}`);

    const card = await Card.findOne({ cardId, isEnabled: true }).select('-gameStats -__v');
    if (!card) {
      console.log(`[CARDS] Carte non trouvée: ${cardId}`);
      return res.status(404).json({
        success: false,
        message: 'Carte non trouvée'
      });
    }

    // Calculer les stats au niveau demandé
    const levelNum = Math.max(1, Math.min(parseInt(level as string) || 1, card.maxLevel));
    const statsAtLevel = card.getStatsAtLevel(levelNum);

    console.log(`[CARDS] Carte ${cardId} retournée (niveau ${levelNum})`);

    res.json({
      success: true,
      card: {
        cardId: card.cardId,
        name: card.name,
        description: card.description,
        type: card.type,
        rarity: card.rarity,
        elixirCost: card.elixirCost,
        unlockedAtArena: card.unlockedAtArena,
        maxLevel: card.maxLevel,
        baseStats: card.baseStats,
        currentLevel: levelNum,
        statsAtLevel,
        imageUrl: card.imageUrl,
        tags: card.tags,
        version: card.version
      }
    });

  } catch (error: any) {
    console.error(`[CARDS] Erreur récupération carte:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// 🏟️ GET /api/cards/arena/:arenaId - Cartes débloquées pour une arène
router.get('/arena/:arenaId', cardLimiter, async (req: Request, res: Response) => {
  try {
    const { arenaId } = req.params;
    const arenaNum = parseInt(arenaId);

    if (isNaN(arenaNum) || arenaNum < 0 || arenaNum > 9) {
      return res.status(400).json({
        success: false,
        message: 'ID d\'arène invalide (0-9)'
      });
    }

    console.log(`[CARDS] Cartes demandées pour arène ${arenaNum}`);

    const cards = await Card.find({
      unlockedAtArena: { $lte: arenaNum },
      isEnabled: true
    })
    .sort({ unlockedAtArena: 1, elixirCost: 1 })
    .select('-gameStats -__v');

    // Grouper par arène de déblocage
    const cardsByArena: { [arena: number]: any[] } = {};
    cards.forEach(card => {
      const arena = card.unlockedAtArena;
      if (!cardsByArena[arena]) cardsByArena[arena] = [];
      cardsByArena[arena].push({
        cardId: card.cardId,
        name: card.name,
        type: card.type,
        rarity: card.rarity,
        elixirCost: card.elixirCost,
        imageUrl: card.imageUrl
      });
    });

    console.log(`[CARDS] ${cards.length} cartes disponibles jusqu'à l'arène ${arenaNum}`);

    res.json({
      success: true,
      maxArena: arenaNum,
      totalCards: cards.length,
      cardsByArena,
      allCards: cards.map(card => ({
        cardId: card.cardId,
        name: card.name,
        type: card.type,
        rarity: card.rarity,
        elixirCost: card.elixirCost,
        unlockedAtArena: card.unlockedAtArena,
        imageUrl: card.imageUrl
      }))
    });

  } catch (error: any) {
    console.error(`[CARDS] Erreur cartes arène:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// 🔍 GET /api/cards/search - Recherche avancée
router.get('/search', cardLimiter, async (req: Request, res: Response) => {
  try {
    const { 
      q,           // Recherche textuelle
      tags,        // Tags séparés par virgule
      minCost,     // Coût élixir minimum
      maxCost,     // Coût élixir maximum
      hasHealth,   // true/false - a des PV
      hasDamage    // true/false - fait des dégâts
    } = req.query;

    console.log(`[CARDS] Recherche: "${q}", Tags: ${tags}, Coût: ${minCost}-${maxCost}`);

    const filter: any = { isEnabled: true };
    const searchCriteria: string[] = [];

    // Recherche textuelle dans nom et description
    if (q && typeof q === 'string' && q.trim().length > 0) {
      filter.$or = [
        { name: { $regex: q.trim(), $options: 'i' } },
        { description: { $regex: q.trim(), $options: 'i' } },
        { cardId: { $regex: q.trim(), $options: 'i' } }
      ];
      searchCriteria.push(`texte:"${q}"`);
    }

    // Filtrage par tags
    if (tags && typeof tags === 'string') {
      const tagArray = tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
      if (tagArray.length > 0) {
        filter.tags = { $in: tagArray };
        searchCriteria.push(`tags:[${tagArray.join(',')}]`);
      }
    }

    // Coût élixir
    if (minCost || maxCost) {
      filter.elixirCost = {};
      if (minCost) {
        const min = parseInt(minCost as string);
        if (!isNaN(min) && min >= 1) {
          filter.elixirCost.$gte = min;
          searchCriteria.push(`minCoût:${min}`);
        }
      }
      if (maxCost) {
        const max = parseInt(maxCost as string);
        if (!isNaN(max) && max <= 10) {
          filter.elixirCost.$lte = max;
          searchCriteria.push(`maxCoût:${max}`);
        }
      }
    }

    // Filtres sur les stats
    if (hasHealth === 'true') {
      filter['baseStats.health'] = { $exists: true, $gt: 0 };
      searchCriteria.push('avecPV');
    }
    if (hasDamage === 'true') {
      filter['baseStats.damage'] = { $exists: true, $gt: 0 };
      searchCriteria.push('avecDégâts');
    }

    const cards = await Card.find(filter)
      .sort({ elixirCost: 1, name: 1 })
      .limit(50) // Limiter les résultats de recherche
      .select('-gameStats -__v');

    console.log(`[CARDS] Recherche "${searchCriteria.join(', ')}" : ${cards.length} résultats`);

    res.json({
      success: true,
      query: {
        searchText: q || null,
        criteria: searchCriteria,
        resultCount: cards.length
      },
      cards: cards.map(card => ({
        cardId: card.cardId,
        name: card.name,
        description: card.description,
        type: card.type,
        rarity: card.rarity,
        elixirCost: card.elixirCost,
        unlockedAtArena: card.unlockedAtArena,
        baseStats: card.baseStats,
        imageUrl: card.imageUrl,
        tags: card.tags
      }))
    });

  } catch (error: any) {
    console.error(`[CARDS] Erreur recherche:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// 🎮 POST /api/cards/validate-deck - Valider un deck avec CardManager
router.post('/validate-deck', cardLimiter, optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cardIds, checkUnlocked = false } = req.body as {
      cardIds?: string[];
      checkUnlocked?: boolean;
    };

    if (!Array.isArray(cardIds)) {
      return res.status(400).json({
        success: false,
        message: 'cardIds doit être un tableau'
      });
    }

    console.log(`[CARDS] Validation deck: ${cardIds.length} cartes, CheckUnlocked: ${checkUnlocked}`);

    // Validation complète avec CardManager
    const userArena = checkUnlocked && req.user?.id ? 
      (await User.findById(req.user.id).select('currentArenaId'))?.currentArenaId : 
      undefined;
    const validation = await cardManager.validateDeck(cardIds, userArena);

    if (!validation.isValid) {
      console.log(`[CARDS] Deck invalide: ${validation.errors.join(', ')}`);
      return res.status(400).json({
        success: false,
        message: validation.errors.join(', ') || 'Deck invalide',
        errors: validation.errors,
        warnings: validation.warnings
      });
    }

    // Si validation OK, récupérer les détails des cartes pour la réponse
    const cards = await Card.find({
      cardId: { $in: cardIds },
      isEnabled: true
    }).select('cardId name type rarity elixirCost unlockedAtArena baseStats');

    if (cards.length !== cardIds.length) {
      const foundIds = cards.map(c => c.cardId);
      const missingIds = cardIds.filter(id => !foundIds.includes(id));
      console.log(`[CARDS] Cartes manquantes: ${missingIds.join(', ')}`);
      
      return res.status(400).json({
        success: false,
        message: 'Cartes introuvables',
        missingCards: missingIds
      });
    }

    // Vérification des cartes débloquées si utilisateur connecté
    let unlockedStatus = null;
    if (checkUnlocked && req.user?.id) {
      try {
        const user = await User.findById(req.user.id).select('currentArenaId');
        if (user) {
          const userArenaId = user.currentArenaId || 0;
          const unlockedCards = cards.filter(card => card.unlockedAtArena <= userArenaId);
          const lockedCards = cards.filter(card => card.unlockedAtArena > userArenaId);
          
          unlockedStatus = {
            userArena: userArenaId,
            allUnlocked: lockedCards.length === 0,
            unlockedCount: unlockedCards.length,
            lockedCards: lockedCards.map(card => ({
              cardId: card.cardId,
              name: card.name,
              requiredArena: card.unlockedAtArena
            }))
          };
        }
      } catch (error) {
        console.warn(`[CARDS] Erreur vérification unlock pour user ${req.user.id}`);
      }
    }

    console.log(`[CARDS] Deck valide - Coût moyen: ${validation.stats.averageElixirCost}`);

    res.json({
      success: true,
      isValid: true,
      // Utiliser les stats calculées par le CardManager
      deckStats: validation.stats,
      // Ajouter les warnings et recommendations du CardManager
      warnings: validation.warnings,
      recommendations: validation.recommendations,
      unlockedStatus,
      cards: cards.map(card => ({
        cardId: card.cardId,
        name: card.name,
        type: card.type,
        rarity: card.rarity,
        elixirCost: card.elixirCost,
        unlockedAtArena: card.unlockedAtArena
      }))
    });

  } catch (error: any) {
    console.error(`[CARDS] Erreur validation deck:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

// 📊 GET /api/cards/stats/upgrade-cost - Calculer le coût d'amélioration
router.get('/stats/upgrade-cost/:cardId', cardLimiter, async (req: Request, res: Response) => {
  try {
    const { cardId } = req.params;
    const { fromLevel = '1', toLevel } = req.query;

    if (!toLevel) {
      return res.status(400).json({
        success: false,
        message: 'Niveau cible (toLevel) requis'
      });
    }

    const card = await Card.findOne({ cardId, isEnabled: true });
    if (!card) {
      return res.status(404).json({
        success: false,
        message: 'Carte non trouvée'
      });
    }

    const fromLvl = parseInt(fromLevel as string) || 1;
    const toLvl = parseInt(toLevel as string);

    if (fromLvl < 1 || fromLvl >= toLvl || toLvl > card.maxLevel) {
      return res.status(400).json({
        success: false,
        message: `Niveaux invalides (${fromLvl} -> ${toLvl}). Max: ${card.maxLevel}`
      });
    }

    const upgradeCost = card.getUpgradeCost(fromLvl, toLvl);
    const statsFrom = card.getStatsAtLevel(fromLvl);
    const statsTo = card.getStatsAtLevel(toLvl);

    console.log(`[CARDS] Coût upgrade ${cardId}: ${fromLvl}->${toLvl} = ${upgradeCost.gold}g + ${upgradeCost.cards}c`);

    res.json({
      success: true,
      cardId: card.cardId,
      name: card.name,
      rarity: card.rarity,
      upgrade: {
        fromLevel: fromLvl,
        toLevel: toLvl,
        cost: upgradeCost,
        statsComparison: {
          before: statsFrom,
          after: statsTo,
          improvements: {
            health: statsTo.health && statsFrom.health ? 
              `+${statsTo.health - statsFrom.health} (+${Math.round(((statsTo.health - statsFrom.health) / statsFrom.health) * 100)}%)` : null,
            damage: statsTo.damage && statsFrom.damage ? 
              `+${statsTo.damage - statsFrom.damage} (+${Math.round(((statsTo.damage - statsFrom.damage) / statsFrom.damage) * 100)}%)` : null
          }
        }
      }
    });

  } catch (error: any) {
    console.error(`[CARDS] Erreur coût upgrade:`, error.message);
    res.status(500).json({ success: false, message: 'Erreur interne du serveur' });
  }
});

export default router;
