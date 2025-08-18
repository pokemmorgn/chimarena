// server/src/routes/cardsRoutes.ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticateToken, optionalAuth } from '../middleware/authMiddleware';
import { antiBotGamingMiddleware } from '../middleware/antiBotMiddleware';
import { 
  getAllCards, 
  getUserCards, 
  upgradeCard, 
  getCardDetails 
} from '../controllers/cardsController';

const router = Router();

// 📊 Rate limits spécifiques pour les cartes
const cardsQueryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 200, // 200 requêtes de consultation par 10 min
  message: { error: 'Trop de requêtes de cartes, réessayez dans quelques minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Permettre plus de requêtes pour les utilisateurs authentifiés
    const isAuth = req.headers.authorization;
    return `${req.ip}:${isAuth ? 'auth' : 'guest'}`;
  }
});

const upgradeActionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 améliorations par minute (gaming-friendly)
  message: { error: 'Trop d\'améliorations rapides, ralentissez un peu !' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 🃏 GET /api/cards - Obtenir toutes les cartes disponibles
// Public, mais avec rate limit et protection anti-bot gaming
router.get('/', 
  cardsQueryLimiter,
  antiBotGamingMiddleware,
  optionalAuth, // Auth optionnelle pour personnaliser selon le niveau du joueur
  getAllCards
);

// 📚 GET /api/cards/collection - Collection personnelle de l'utilisateur
// Nécessite authentification + protection gaming
router.get('/collection', 
  cardsQueryLimiter,
  antiBotGamingMiddleware,
  authenticateToken,
  getUserCards
);

// ⬆️ POST /api/cards/upgrade - Améliorer une carte
// Action gaming critique avec rate limit spécifique
router.post('/upgrade', 
  upgradeActionLimiter,
  antiBotGamingMiddleware,
  authenticateToken,
  upgradeCard
);

// 🔍 GET /api/cards/:cardId - Détails d'une carte spécifique
// Public avec rate limit léger
router.get('/:cardId', 
  cardsQueryLimiter,
  antiBotGamingMiddleware,
  optionalAuth,
  getCardDetails
);

// 🛡️ Routes futures pour la gestion avancée des cartes

/*
// 🎁 POST /api/cards/open-chest - Ouvrir un coffre (future)
router.post('/open-chest', 
  antiBotGamingMiddleware,
  authenticateToken,
  openChest
);

// 🔄 POST /api/cards/trade - Échanger des cartes (future)
router.post('/trade', 
  antiBotGamingMiddleware,
  authenticateToken,
  tradeCards
);

// 💰 POST /api/cards/donate - Donner des cartes au clan (future)
router.post('/donate', 
  antiBotGamingMiddleware,
  authenticateToken,
  donateCards
);

// 🛒 POST /api/cards/buy-from-shop - Acheter dans la boutique (future)
router.post('/buy-from-shop', 
  antiBotGamingMiddleware,
  authenticateToken,
  buyFromShop
);
*/

export default router;
