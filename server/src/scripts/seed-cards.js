// server/src/scripts/seed-cards.js - SEED DES CARTES CLASH ROYALE
const mongoose = require('mongoose');
require('dotenv').config();

// Schéma Card basique pour le seed
const cardSchema = new mongoose.Schema({
  cardId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { type: String, enum: ['troop', 'spell', 'building'], required: true },
  rarity: { type: String, enum: ['common', 'rare', 'epic', 'legendary', 'champion'], required: true },
  elixirCost: { type: Number, required: true, min: 1, max: 10 },
  unlockedAtArena: { type: Number, required: true, min: 0, max: 9 },
  maxLevel: { type: Number, required: true },
  baseStats: {
    health: { type: Number },
    damage: { type: Number },
    attackSpeed: { type: Number },
    range: { type: Number },
    speed: { type: String, enum: ['slow', 'medium', 'fast', 'very_fast'] },
    targets: { type: String, enum: ['ground', 'air', 'both'], default: 'ground' },
    deployTime: { type: Number, default: 1 },
    lifetime: { type: Number },
    radius: { type: Number },
    count: { type: Number, default: 1 }
  },
  statsProgression: {
    healthGrowth: { type: Number, default: 10 },
    damageGrowth: { type: Number, default: 10 }
  },
  imageUrl: { type: String },
  isEnabled: { type: Boolean, default: true },
  version: { type: String, default: '1.0.0' },
  tags: [{ type: String }]
}, { timestamps: true });

const Card = mongoose.model('Card', cardSchema);

console.log('🃏 Seed des cartes Clash Royale - ChimArena');
console.log('============================================');

// 🎮 CARTES CLASH ROYALE - 10 PREMIÈRES PAR ORDRE D'UNLOCK
const clashRoyaleCards = [
  // === ARÈNE 0 - CENTRE D'ENTRAÎNEMENT ===
  {
    cardId: "knight",
    name: "Knight",
    description: "A tough melee fighter. The Barbarian's handsome, cultured cousin. Rumor has it that he was knighted based on the sheer awesomeness of his mustache alone.",
    type: "troop",
    rarity: "common",
    elixirCost: 3,
    unlockedAtArena: 0,
    maxLevel: 14,
    baseStats: {
      health: 1240,
      damage: 162,
      attackSpeed: 1.2,
      range: 1,
      speed: "medium",
      targets: "ground",
      deployTime: 1,
      count: 1
    },
    statsProgression: {
      healthGrowth: 10,
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/knight.png",
    gameSprite: "/assets/sprites/knight.png",
    scriptName: "knight",
    spriteConfig: {
      idle: "knight_idle.png",
      walk: "knight_walk.png", 
      attack: "knight_attack.png",
      death: "knight_death.png"
    },
    soundEffects: {
      deploy: "knight_deploy.wav",
      attack: "knight_attack.wav",
      death: "knight_death.wav"
    },
    animationDuration: 1000,
    tags: ["melee", "tank", "ground"]
  },
  {
    cardId: "archers",
    name: "Archers",
    description: "A pair of unarmored ranged attackers. They'll help you take down enemies, but you're on your own with coloring your hair.",
    type: "troop",
    rarity: "common",
    elixirCost: 3,
    unlockedAtArena: 0,
    maxLevel: 14,
    baseStats: {
      health: 304,
      damage: 118,
      attackSpeed: 1.2,
      range: 5,
      speed: "medium",
      targets: "both",
      deployTime: 1,
      count: 2
    },
    statsProgression: {
      healthGrowth: 10,
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/archers.png",
    gameSprite: "/assets/sprites/archers.png",
    scriptName: "archers",
    spriteConfig: {
      idle: "archers_idle.png",
      walk: "archers_walk.png",
      attack: "archers_attack.png",
      death: "archers_death.png"
    },
    soundEffects: {
      deploy: "archers_deploy.wav",
      attack: "archers_attack.wav",
      death: "archers_death.wav"
    },
    animationDuration: 1000,
    tags: ["ranged", "air_defense", "duo"]
  },
  {
    cardId: "arrows",
    name: "Arrows",
    description: "Arrows pepper a large area, damaging enemies and reducing them to tears. Don't worry, the tears aren't really made of onions.",
    type: "spell",
    rarity: "common",
    elixirCost: 3,
    unlockedAtArena: 0,
    maxLevel: 14,
    baseStats: {
      damage: 243,
      radius: 4,
      deployTime: 0.5
    },
    statsProgression: {
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/arrows.png",
    gameSprite: "/assets/effects/arrows.png", // Effet visuel
    scriptName: "arrows",
    soundEffects: {
      deploy: "arrows_cast.wav"
    },
    animationDuration: 500,
    tags: ["spell", "area_damage", "instant"]
  },
  {
    cardId: "fireball",
    name: "Fireball",
    description: "Annihilates a medium sized area with explosive damage. Even barbarians' mustaches get singed!",
    type: "spell",
    rarity: "rare",
    elixirCost: 4,
    unlockedAtArena: 0,
    maxLevel: 11,
    baseStats: {
      damage: 572,
      radius: 2.5,
      deployTime: 1
    },
    statsProgression: {
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/fireball.png",
    gameSprite: "/assets/effects/fireball.png", // Effet visuel
    scriptName: "fireball",
    soundEffects: {
      deploy: "fireball_cast.wav",
      attack: "fireball_explosion.wav"
    },
    animationDuration: 1000,
    tags: ["spell", "area_damage", "knockback"]
  },

  // === ARÈNE 1 - ARÈNE DES GOBELINS ===
  {
    cardId: "barbarians",
    name: "Barbarians",
    description: "A horde of melee attackers with mean mustaches and even meaner tempers. They have an appetite for destruction!",
    type: "troop",
    rarity: "common",
    elixirCost: 5,
    unlockedAtArena: 1,
    maxLevel: 14,
    baseStats: {
      health: 636,
      damage: 159,
      attackSpeed: 1.5,
      range: 1,
      speed: "medium",
      targets: "ground",
      deployTime: 1,
      count: 4
    },
    statsProgression: {
      healthGrowth: 10,
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/barbarians.png",
    gameSprite: "/assets/sprites/barbarian.png", // Un seul barbare, x4
    scriptName: "barbarians",
    spriteConfig: {
      idle: "barbarian_idle.png",
      walk: "barbarian_walk.png",
      attack: "barbarian_attack.png",
      death: "barbarian_death.png"
    },
    soundEffects: {
      deploy: "barbarians_deploy.wav",
      attack: "barbarian_attack.wav",
      death: "barbarian_death.wav"
    },
    animationDuration: 1000,
    tags: ["melee", "swarm", "ground"]
  },
  {
    cardId: "minions",
    name: "Minions",
    description: "Three fast, unarmored flying attackers. Roses are red, minions are blue, they can fly, and will crush you!",
    type: "troop",
    rarity: "common",
    elixirCost: 3,
    unlockedAtArena: 1,
    maxLevel: 14,
    baseStats: {
      health: 190,
      damage: 84,
      attackSpeed: 1.1,
      range: 2,
      speed: "fast",
      targets: "both",
      deployTime: 1,
      count: 3
    },
    statsProgression: {
      healthGrowth: 10,
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/minions.png",
    gameSprite: "/assets/sprites/minion.png", // Un seul minion, x3
    scriptName: "minions",
    spriteConfig: {
      idle: "minion_idle.png",
      fly: "minion_fly.png",
      attack: "minion_attack.png",
      death: "minion_death.png"
    },
    soundEffects: {
      deploy: "minions_deploy.wav",
      attack: "minion_attack.wav",
      death: "minion_death.wav"
    },
    animationDuration: 800,
    tags: ["flying", "swarm", "air"]
  },

  // === ARÈNE 2 - FOSSE AUX OS ===
  {
    cardId: "giant",
    name: "Giant",
    description: "Slow but durable, only attacks buildings. A real one-man wrecking crew!",
    type: "troop",
    rarity: "rare",
    elixirCost: 5,
    unlockedAtArena: 2,
    maxLevel: 11,
    baseStats: {
      health: 3275,
      damage: 211,
      attackSpeed: 1.5,
      range: 1,
      speed: "slow",
      targets: "ground", // Buildings only mais simplifié
      deployTime: 1,
      count: 1
    },
    statsProgression: {
      healthGrowth: 10,
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/giant.png",
    gameSprite: "/assets/sprites/giant.png",
    scriptName: "giant",
    spriteConfig: {
      idle: "giant_idle.png",
      walk: "giant_walk.png",
      attack: "giant_attack.png",
      death: "giant_death.png"
    },
    soundEffects: {
      deploy: "giant_deploy.wav",
      attack: "giant_punch.wav",
      death: "giant_death.wav"
    },
    animationDuration: 1500,
    tags: ["tank", "building_targeting", "slow"]
  },
  {
    cardId: "cannon",
    name: "Cannon",
    description: "Defensive building. Shoots cannonballs with deadly effect, but cannot target flying troops.",
    type: "building",
    rarity: "common",
    elixirCost: 3,
    unlockedAtArena: 2,
    maxLevel: 14,
    baseStats: {
      health: 828,
      damage: 96,
      attackSpeed: 0.8,
      range: 5.5,
      targets: "ground",
      deployTime: 1,
      lifetime: 30
    },
    statsProgression: {
      healthGrowth: 10,
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/cannon.png",
    gameSprite: "/assets/sprites/cannon.png",
    scriptName: "cannon",
    spriteConfig: {
      idle: "cannon_idle.png",
      attack: "cannon_fire.png",
      destroyed: "cannon_destroyed.png"
    },
    soundEffects: {
      deploy: "cannon_deploy.wav",
      attack: "cannon_fire.wav",
      death: "cannon_destroyed.wav"
    },
    animationDuration: 1200,
    tags: ["building", "defense", "ground_only"]
  },

  // === ARÈNE 3 - ARÈNE DES BARBARES ===
  {
    cardId: "musketeer",
    name: "Musketeer",
    description: "Don't be fooled by her delicate appearance. This long-range sharpshooter packs a mean punch!",
    type: "troop",
    rarity: "rare",
    elixirCost: 4,
    unlockedAtArena: 3,
    maxLevel: 11,
    baseStats: {
      health: 598,
      damage: 198,
      attackSpeed: 1.1,
      range: 6,
      speed: "medium",
      targets: "both",
      deployTime: 1,
      count: 1
    },
    statsProgression: {
      healthGrowth: 10,
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/musketeer.png",
    gameSprite: "/assets/sprites/musketeer.png",
    scriptName: "musketeer",
    spriteConfig: {
      idle: "musketeer_idle.png",
      walk: "musketeer_walk.png",
      attack: "musketeer_shoot.png",
      death: "musketeer_death.png"
    },
    soundEffects: {
      deploy: "musketeer_deploy.wav",
      attack: "musketeer_shot.wav",
      death: "musketeer_death.wav"
    },
    animationDuration: 1000,
    tags: ["ranged", "air_defense", "sharpshooter"]
  },

  // === ARÈNE 4 - VALLÉE DES SORTILÈGES ===
  {
    cardId: "lightning",
    name: "Lightning",
    description: "Bolts of lightning damage and stun up to three enemy troops or buildings with the highest hitpoints in the target area.",
    type: "spell",
    rarity: "epic",
    elixirCost: 6,
    unlockedAtArena: 4,
    maxLevel: 8,
    baseStats: {
      damage: 864,
      radius: 3.5,
      deployTime: 1,
      count: 3 // Cible 3 ennemis
    },
    statsProgression: {
      damageGrowth: 10
    },
    cardImageUrl: "/assets/cards/lightning.png",
    gameSprite: "/assets/effects/lightning.png", // Effet visuel
    scriptName: "lightning",
    soundEffects: {
      deploy: "lightning_cast.wav",
      attack: "lightning_strike.wav"
    },
    animationDuration: 1000,
    tags: ["spell", "area_damage", "stun", "high_hitpoints"]
  }
];

async function seedCards() {
  try {
    // Connexion à MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chimarena';
    console.log('📡 Connexion à MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connecté à MongoDB');

    // Vérifier les cartes existantes
    const existingCards = await Card.countDocuments();
    console.log(`📊 ${existingCards} cartes existantes en base`);

    if (existingCards > 0) {
      console.log('⚠️ Des cartes existent déjà. Voulez-vous les remplacer ?');
      console.log('💡 Pour forcer le remplacement, supprimez d\'abord: db.cards.deleteMany({})');
      
      // Pour ce seed, on continue et met à jour/ajoute
      console.log('🔄 Mise à jour des cartes existantes...');
    }

    // Insérer/Mettre à jour les cartes
    let created = 0;
    let updated = 0;

    for (const cardData of clashRoyaleCards) {
      try {
        const existingCard = await Card.findOne({ cardId: cardData.cardId });
        
        if (existingCard) {
          await Card.updateOne({ cardId: cardData.cardId }, cardData);
          updated++;
          console.log(`🔄 Mise à jour: ${cardData.name} (${cardData.cardId})`);
        } else {
          await Card.create(cardData);
          created++;
          console.log(`✨ Créée: ${cardData.name} (${cardData.cardId}) - Arène ${cardData.unlockedAtArena}`);
        }
      } catch (error) {
        console.error(`❌ Erreur pour ${cardData.cardId}:`, error.message);
      }
    }

    console.log('\n🎉 SEED TERMINÉ !');
    console.log(`📊 Résultats:`);
    console.log(`   ✨ ${created} cartes créées`);
    console.log(`   🔄 ${updated} cartes mises à jour`);
    console.log(`   📝 ${clashRoyaleCards.length} cartes traitées`);

    // Statistiques finales
    const finalCount = await Card.countDocuments();
    const cardsByArena = await Card.aggregate([
      { $group: { _id: '$unlockedAtArena', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    console.log(`\n📈 Statistiques finales:`);
    console.log(`   🃏 Total cartes: ${finalCount}`);
    console.log(`   🏟️ Répartition par arène:`);
    cardsByArena.forEach(stat => {
      console.log(`      Arène ${stat._id}: ${stat.count} cartes`);
    });

    console.log('\n🎮 Cartes prêtes pour ChimArena !');
    console.log('✅ Vous pouvez maintenant tester les API et le matchmaking');

  } catch (error) {
    console.error('💥 Erreur lors du seed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📴 Déconnecté de MongoDB');
    process.exit(0);
  }
}

// Exécuter le seed si le script est lancé directement
if (require.main === module) {
  console.log('🚀 Lancement du seed des cartes...\n');
  seedCards();
}

module.exports = seedCards;
