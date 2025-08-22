// scripts/addDefaultDeck.js - Ajouter un deck par défaut aux utilisateurs
const mongoose = require('mongoose');

// Schéma User simplifié pour le script
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  deck: [String],
  cards: [{
    cardId: String,
    level: { type: Number, default: 1 },
    count: { type: Number, default: 1 }
  }]
});

const User = mongoose.model('User', userSchema);

// Deck de départ équilibré (8 cartes Clash Royale standards)
const DEFAULT_DECK = [
  'knight',      // Tank léger
  'archers',     // Anti-air
  'goblins',     // DPS rapide
  'giant',       // Tank principal
  'fireball',    // Spell dégâts zone
  'arrows',      // Spell anti-swarm
  'minions',     // Air DPS
  'musketeer'    // Sniper
];

async function addDefaultDecks() {
  try {
    console.log('🔄 Connexion à MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena');
    
    console.log('📊 Recherche des utilisateurs sans deck...');
    
    // Trouver tous les utilisateurs sans deck ou avec deck vide
    const usersWithoutDeck = await User.find({
      $or: [
        { deck: { $exists: false } },
        { deck: null },
        { deck: { $size: 0 } },
        { deck: { $not: { $size: 8 } } } // Deck incomplet
      ]
    });
    
    console.log(`📋 ${usersWithoutDeck.length} utilisateur(s) sans deck valide trouvé(s)`);
    
    if (usersWithoutDeck.length === 0) {
      console.log('✅ Tous les utilisateurs ont déjà un deck valide');
      return;
    }
    
    // Ajouter le deck par défaut et les cartes
    for (const user of usersWithoutDeck) {
      console.log(`🎴 Attribution deck à ${user.username}...`);
      
      // Mettre à jour le deck
      user.deck = [...DEFAULT_DECK];
      
      // S'assurer que l'utilisateur possède ces cartes dans sa collection
      const existingCards = user.cards || [];
      const existingCardIds = existingCards.map(c => c.cardId);
      
      for (const cardId of DEFAULT_DECK) {
        if (!existingCardIds.includes(cardId)) {
          console.log(`  ➕ Ajout carte: ${cardId}`);
          user.cards.push({
            cardId: cardId,
            level: 1,
            count: 10 // Assez de cartes pour jouer
          });
        } else {
          // S'assurer qu'il a assez de cartes
          const existingCard = existingCards.find(c => c.cardId === cardId);
          if (existingCard && existingCard.count < 4) {
            existingCard.count = 10;
            console.log(`  🔄 Mise à jour quantité: ${cardId} -> 10`);
          }
        }
      }
      
      await user.save();
      console.log(`✅ Deck configuré pour ${user.username}: ${DEFAULT_DECK.join(', ')}`);
    }
    
    console.log('🎉 Tous les decks ont été configurés avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la configuration des decks:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnexion MongoDB');
  }
}

// Lancer le script
if (require.main === module) {
  addDefaultDecks();
}

module.exports = { addDefaultDecks, DEFAULT_DECK };
