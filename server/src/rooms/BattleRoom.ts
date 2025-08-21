// server/src/rooms/BattleRoom.ts - ROOM DE COMBAT TEMPS RÉEL
import { Room, Client } from "@colyseus/core";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import { cardManager } from '../services/CardManager';
import User from '../models/User';

// 🏰 TOURS DU TERRAIN
export class Tower extends Schema {
  @type("number") health: number = 2534;
  @type("number") maxHealth: number = 2534;
  @type("number") damage: number = 120;
  @type("string") type: string = "crown"; // crown, king
  @type("boolean") isDestroyed: boolean = false;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
}

// 🃏 UNITÉ SUR LE TERRAIN
export class Unit extends Schema {
  @type("string") id: string = "";
  @type("string") cardId: string = "";
  @type("string") playerId: string = "";
  @type("number") health: number = 0;
  @type("number") maxHealth: number = 0;
  @type("number") damage: number = 0;
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") targetX: number = 0;
  @type("number") targetY: number = 0;
  @type("string") state: string = "idle"; // idle, walking, attacking, dying
  @type("string") targetId: string = "";
  @type("number") lastAttack: number = 0;
  @type("number") level: number = 1;
  @type("string") side: string = ""; // "blue" ou "red"
}

// 🎮 JOUEUR DANS LE COMBAT
export class BattlePlayer extends Schema {
  @type("string") sessionId: string = "";
  @type("string") userId: string = "";
  @type("string") username: string = "";
  @type("number") level: number = 1;
  @type("number") trophies: number = 0;
  @type("number") elixir: number = 5; // Élixir actuel
  @type("number") maxElixir: number = 10;
  @type("number") elixirRegenRate: number = 1000; // ms par élixir
  @type("number") lastElixirRegen: number = 0;
  @type(["string"]) deck = new ArraySchema<string>();
  @type("string") side: string = ""; // "blue" ou "red"
  @type("boolean") isReady: boolean = false;
  @type("boolean") hasLeft: boolean = false;
  
  // Tours du joueur
  @type("number") crownTowersDestroyed: number = 0;
  @type("boolean") kingTowerDestroyed: boolean = false;
}

// 🌍 ÉTAT DU COMBAT
export class BattleState extends Schema {
  @type({ map: BattlePlayer }) players = new MapSchema<BattlePlayer>();
  @type({ map: Unit }) units = new MapSchema<Unit>();
  @type({ map: Tower }) towers = new MapSchema<Tower>();
  
  @type("string") gamePhase: string = "waiting"; // waiting, preparation, battle, overtime, finished
  @type("number") battleDuration: number = 180000; // 3 minutes en ms
  @type("number") overtimeDuration: number = 60000; // 1 minute en ms
  @type("number") gameStartTime: number = 0;
  @type("number") gameEndTime: number = 0;
  @type("string") winner: string = ""; // sessionId du gagnant ou "draw"
  @type("string") winCondition: string = ""; // "towers", "time", "forfeit"
  
  @type("number") currentTime: number = 0;
  @type("number") nextUnitId: number = 1;
  @type("boolean") isPaused: boolean = false;
}

// ⚔️ BATTLEROOM PRINCIPALE
export class BattleRoom extends Room<BattleState> {
  maxClients = 2;
  
  private gameLoop: any = null;
  private elixirLoop: any = null;
  private battleTimeout: any = null;
  
  // Configuration du terrain (18x32 comme Clash Royale)
  private readonly FIELD_WIDTH = 18;
  private readonly FIELD_HEIGHT = 32;
  private readonly BRIDGE_Y = 16; // Milieu du terrain
  
  onCreate(options: any) {
    console.log(`⚔️ BattleRoom créée:`, options);
    this.setState(new BattleState());
    
    this.setupMessageHandlers();
    this.setupTowers();
    
    console.log('✅ BattleRoom initialisée');
  }

  // 🎮 HANDLERS DE MESSAGES
  private setupMessageHandlers(): void {
    // Joueur prêt à commencer
    this.onMessage("player_ready", (client, message) => {
      this.handlePlayerReady(client);
    });
    
    // Placement d'une carte
    this.onMessage("place_card", (client, message) => {
      this.handlePlaceCard(client, message);
    });
    
    // Émote/réaction
    this.onMessage("emote", (client, message) => {
      this.handleEmote(client, message);
    });
    
    // Abandonner
    this.onMessage("forfeit", (client, message) => {
      this.handleForfeit(client);
    });
  }

  // 🏰 CONFIGURATION DES TOURS
  private setupTowers(): void {
    // Tours BLUE (joueur du bas)
    const blueCrownLeft = new Tower();
    blueCrownLeft.x = 3;
    blueCrownLeft.y = 2;
    blueCrownLeft.type = "crown";
    this.state.towers.set("blue_crown_left", blueCrownLeft);
    
    const blueCrownRight = new Tower();
    blueCrownRight.x = 15;
    blueCrownRight.y = 2;
    blueCrownRight.type = "crown";
    this.state.towers.set("blue_crown_right", blueCrownRight);
    
    const blueKing = new Tower();
    blueKing.x = 9;
    blueKing.y = 0;
    blueKing.type = "king";
    blueKing.health = 4824;
    blueKing.maxHealth = 4824;
    this.state.towers.set("blue_king", blueKing);
    
    // Tours RED (joueur du haut)
    const redCrownLeft = new Tower();
    redCrownLeft.x = 3;
    redCrownLeft.y = 30;
    redCrownLeft.type = "crown";
    this.state.towers.set("red_crown_left", redCrownLeft);
    
    const redCrownRight = new Tower();
    redCrownRight.x = 15;
    redCrownRight.y = 30;
    redCrownRight.type = "crown";
    this.state.towers.set("red_crown_right", redCrownRight);
    
    const redKing = new Tower();
    redKing.x = 9;
    redKing.y = 32;
    redKing.type = "king";
    redKing.health = 4824;
    redKing.maxHealth = 4824;
    this.state.towers.set("red_king", redKing);
    
    console.log('🏰 Tours configurées (6 tours)');
  }

  // 🚪 CONNEXION JOUEUR
  async onJoin(client: Client, options: any): Promise<void> {
    console.log(`🚪 Joueur ${client.sessionId} rejoint le combat`);
    
    try {
      const { userId, username, level, trophies, deck } = options;
      
      if (!userId || !deck || !Array.isArray(deck) || deck.length !== 8) {
        throw new Error('Données joueur invalides');
      }
      
      // Valider le deck avec CardManager
      const deckValidation = await cardManager.validateDeck(deck);
      if (!deckValidation.isValid) {
        throw new Error(`Deck invalide: ${deckValidation.errors.join(', ')}`);
      }
      
      // Créer le joueur
      const battlePlayer = new BattlePlayer();
      battlePlayer.sessionId = client.sessionId;
      battlePlayer.userId = userId;
      battlePlayer.username = username || 'Joueur';
      battlePlayer.level = level || 1;
      battlePlayer.trophies = trophies || 0;
      battlePlayer.deck.push(...deck);
      battlePlayer.lastElixirRegen = Date.now();
      
      // Assigner un côté
      const playerCount = this.state.players.size;
      if (playerCount === 0) {
        battlePlayer.side = "blue"; // Premier joueur = bleu (bas)
      } else if (playerCount === 1) {
        battlePlayer.side = "red";  // Deuxième joueur = rouge (haut)
      } else {
        throw new Error('Combat déjà plein');
      }
      
      this.state.players.set(client.sessionId, battlePlayer);
      
      console.log(`✅ ${username} rejoint côté ${battlePlayer.side}`);
      
      // Si 2 joueurs, préparer le combat
      if (this.state.players.size === 2) {
        this.prepareBattle();
      }
      
    } catch (error) {
      console.error(`❌ Erreur onJoin:`, error);
      client.leave(4000, (error as Error).message);
    }
  }

  // 🎯 PRÉPARATION DU COMBAT
  private prepareBattle(): void {
    console.log('🎯 Préparation du combat - 2 joueurs connectés');
    
    this.state.gamePhase = "preparation";
    this.state.currentTime = Date.now();
    
    // Envoyer les infos du match aux clients
    this.broadcast("battle_info", {
      players: Array.from(this.state.players.values()).map(p => ({
        sessionId: p.sessionId,
        username: p.username,
        level: p.level,
        trophies: p.trophies,
        side: p.side
      })),
      duration: this.state.battleDuration,
      overtime: this.state.overtimeDuration
    });
    
    // Démarrer la régénération d'élixir
    this.startElixirRegeneration();
    
    console.log('✅ Combat préparé, en attente que les joueurs soient prêts');
  }

  // 🔋 RÉGÉNÉRATION ÉLIXIR
  private startElixirRegeneration(): void {
    this.elixirLoop = this.clock.setInterval(() => {
      const now = Date.now();
      
      for (const [sessionId, player] of this.state.players) {
        if (now - player.lastElixirRegen >= player.elixirRegenRate && player.elixir < player.maxElixir) {
          player.elixir = Math.min(player.maxElixir, player.elixir + 1);
          player.lastElixirRegen = now;
        }
      }
    }, 100); // Check toutes les 100ms
  }

  // ✅ JOUEUR PRÊT
  private handlePlayerReady(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    
    player.isReady = true;
    console.log(`✅ ${player.username} est prêt`);
    
    // Si tous les joueurs sont prêts, démarrer
    const allReady = Array.from(this.state.players.values()).every(p => p.isReady);
    if (allReady && this.state.gamePhase === "preparation") {
      this.startBattle();
    }
  }

  // ⚔️ DÉMARRAGE DU COMBAT
  private startBattle(): void {
    console.log('⚔️ COMBAT DÉMARRÉ !');
    
    this.state.gamePhase = "battle";
    this.state.gameStartTime = Date.now();
    this.state.gameEndTime = this.state.gameStartTime + this.state.battleDuration;
    
    this.broadcast("battle_started", {
      startTime: this.state.gameStartTime,
      endTime: this.state.gameEndTime,
      duration: this.state.battleDuration
    });
    
    // Démarrer la boucle de jeu
    this.startGameLoop();
    
    // Timer de fin de combat
    this.battleTimeout = this.clock.setTimeout(() => {
      this.endBattle("time", null);
    }, this.state.battleDuration);
  }

  // 🎮 BOUCLE DE JEU PRINCIPALE
  private startGameLoop(): void {
    this.gameLoop = this.clock.setInterval(() => {
      this.updateUnits();
      this.checkVictoryConditions();
      this.state.currentTime = Date.now();
    }, 100); // 10 FPS pour la logique
  }

  // 🃏 PLACEMENT D'UNE CARTE
  private async handlePlaceCard(client: Client, message: any): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.gamePhase !== "battle") return;
    
    const { cardId, x, y } = message;
    
    try {
      // Vérifier que la carte est dans le deck
      if (!player.deck.includes(cardId)) {
        client.send("card_error", { message: "Carte non disponible dans le deck" });
        return;
      }
      
      // Récupérer les stats de la carte
      const cardWithStats = await cardManager.getCardWithStats(cardId, 1);
      if (!cardWithStats) {
        client.send("card_error", { message: "Carte introuvable" });
        return;
      }
      
      const { card, stats } = cardWithStats;
      
      // Vérifier le coût en élixir
      if (player.elixir < card.elixirCost) {
        client.send("card_error", { message: "Pas assez d'élixir" });
        return;
      }
      
      // Vérifier la zone de placement
      if (!this.isValidPlacement(x, y, player.side)) {
        client.send("card_error", { message: "Zone de placement invalide" });
        return;
      }
      
      // Déduire l'élixir
      player.elixir -= card.elixirCost;
      
      // Créer l'unité (ou plusieurs si c'est un groupe)
      const unitCount = stats.count || 1;
      for (let i = 0; i < unitCount; i++) {
        const unit = new Unit();
        unit.id = `unit_${this.state.nextUnitId++}`;
        unit.cardId = cardId;
        unit.playerId = client.sessionId;
        unit.health = stats.health || 100;
        unit.maxHealth = stats.health || 100;
        unit.damage = stats.damage || 50;
        unit.side = player.side;
        
        // Position avec léger décalage pour les groupes
        unit.x = x + (i % 2) * 0.5;
        unit.y = y + Math.floor(i / 2) * 0.5;
        unit.targetX = unit.x;
        unit.targetY = unit.y;
        
        this.state.units.set(unit.id, unit);
      }
      
      console.log(`🃏 ${player.username} place ${cardId} en (${x}, ${y}) - ${unitCount} unité(s)`);
      
      // Notifier tous les clients
      this.broadcast("card_placed", {
        playerId: client.sessionId,
        cardId,
        x, y,
        unitCount,
        remainingElixir: player.elixir
      });
      
    } catch (error) {
      console.error('❌ Erreur placement carte:', error);
      client.send("card_error", { message: "Erreur lors du placement" });
    }
  }

  // 📍 VALIDATION ZONE DE PLACEMENT
  private isValidPlacement(x: number, y: number, side: string): boolean {
    // Vérifier que c'est dans les limites du terrain
    if (x < 0 || x >= this.FIELD_WIDTH || y < 0 || y >= this.FIELD_HEIGHT) {
      return false;
    }
    
    // Zone de placement selon le côté
    if (side === "blue") {
      // Joueur bleu peut placer dans sa moitié + un peu au-delà du pont
      return y <= this.BRIDGE_Y + 2;
    } else {
      // Joueur rouge peut placer dans sa moitié + un peu en-deçà du pont
      return y >= this.BRIDGE_Y - 2;
    }
  }

  // 🤖 MISE À JOUR DES UNITÉS
  private updateUnits(): void {
    for (const [unitId, unit] of this.state.units) {
      if (unit.state === "dying" || unit.health <= 0) {
        this.removeUnit(unitId);
        continue;
      }
      
      // IA basique : aller vers les tours ennemies
      if (unit.state === "idle") {
        const target = this.findNearestEnemyTarget(unit);
        if (target) {
          unit.targetX = target.x;
          unit.targetY = target.y;
          unit.targetId = target.id;
          unit.state = "walking";
        }
      }
      
      // Mouvement vers la cible
      if (unit.state === "walking") {
        const distance = Math.sqrt(
          Math.pow(unit.targetX - unit.x, 2) + Math.pow(unit.targetY - unit.y, 2)
        );
        
        if (distance < 0.1) {
          unit.state = "idle";
        } else {
          // Mouvement simple
          const speed = 0.05; // Vitesse de déplacement
          unit.x += (unit.targetX - unit.x) * speed;
          unit.y += (unit.targetY - unit.y) * speed;
        }
      }
    }
  }

  // 🎯 TROUVER LA CIBLE LA PLUS PROCHE
  private findNearestEnemyTarget(unit: Unit): { x: number; y: number; id: string } | null {
    let nearestTarget = null;
    let nearestDistance = Infinity;
    
    // Chercher les tours ennemies
    for (const [towerId, tower] of this.state.towers) {
      if (tower.isDestroyed) continue;
      
      const isEnemyTower = (unit.side === "blue" && towerId.startsWith("red")) ||
                          (unit.side === "red" && towerId.startsWith("blue"));
      
      if (isEnemyTower) {
        const distance = Math.sqrt(
          Math.pow(tower.x - unit.x, 2) + Math.pow(tower.y - unit.y, 2)
        );
        
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestTarget = { x: tower.x, y: tower.y, id: towerId };
        }
      }
    }
    
    return nearestTarget;
  }

  // 🗑️ SUPPRIMER UNE UNITÉ
  private removeUnit(unitId: string): void {
    this.state.units.delete(unitId);
    this.broadcast("unit_destroyed", { unitId });
  }

  // 🏆 VÉRIFIER CONDITIONS DE VICTOIRE
  private checkVictoryConditions(): void {
    if (this.state.gamePhase !== "battle") return;
    
    let blueScore = 0;
    let redScore = 0;
    
    // Compter les tours détruites
    for (const [towerId, tower] of this.state.towers) {
      if (tower.isDestroyed) {
        if (towerId.startsWith("blue")) {
          redScore += tower.type === "king" ? 3 : 1;
        } else {
          blueScore += tower.type === "king" ? 3 : 1;
        }
      }
    }
    
    // Victoire par destruction de tour du roi
    const blueKingDestroyed = this.state.towers.get("blue_king")?.isDestroyed;
    const redKingDestroyed = this.state.towers.get("red_king")?.isDestroyed;
    
    if (blueKingDestroyed) {
      this.endBattle("towers", "red");
    } else if (redKingDestroyed) {
      this.endBattle("towers", "blue");
    } else if (blueScore > redScore && Date.now() > this.state.gameEndTime) {
      this.endBattle("time", "blue");
    } else if (redScore > blueScore && Date.now() > this.state.gameEndTime) {
      this.endBattle("time", "red");
    }
  }

  // 🏁 FIN DU COMBAT
  private endBattle(condition: string, winningSide: string | null): void {
    console.log(`🏁 Fin de combat - Condition: ${condition}, Gagnant: ${winningSide || 'draw'}`);
    
    this.state.gamePhase = "finished";
    this.state.winCondition = condition;
    
    // Trouver le gagnant
    let winner = null;
    if (winningSide) {
      for (const [sessionId, player] of this.state.players) {
        if (player.side === winningSide) {
          winner = sessionId;
          this.state.winner = sessionId;
          break;
        }
      }
    } else {
      this.state.winner = "draw";
    }
    
    // Arrêter les boucles
    if (this.gameLoop) {
      this.gameLoop.clear();
      this.gameLoop = null;
    }
    if (this.elixirLoop) {
      this.elixirLoop.clear();
      this.elixirLoop = null;
    }
    if (this.battleTimeout) {
      this.battleTimeout.clear();
      this.battleTimeout = null;
    }
    
    // Envoyer le résultat
    this.broadcast("battle_ended", {
      winner: winner,
      winningSide: winningSide,
      condition,
      duration: Date.now() - this.state.gameStartTime
    });
    
    // Fermer la room après 10 secondes
    this.clock.setTimeout(() => {
      this.disconnect();
    }, 10000);
  }

  // 😀 ÉMOTE
  private handleEmote(client: Client, message: any): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    
    this.broadcast("emote", {
      playerId: client.sessionId,
      emote: message.emote,
      username: player.username
    }, { except: client });
  }

  // 🏳️ ABANDON
  private handleForfeit(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    
    console.log(`🏳️ ${player.username} abandonne le combat`);
    
    // L'autre joueur gagne
    const winningSide = player.side === "blue" ? "red" : "blue";
    this.endBattle("forfeit", winningSide);
  }

  // 🚪 DÉCONNEXION
  onLeave(client: Client, consented: boolean): void {
    const player = this.state.players.get(client.sessionId);
    console.log(`🚪 Joueur ${player?.username || client.sessionId} quitte le combat`);
    
    if (player && this.state.gamePhase === "battle") {
      // Abandon automatique en cours de combat
      player.hasLeft = true;
      this.handleForfeit(client);
    }
  }

  // 🗑️ NETTOYAGE
  onDispose(): void {
    console.log('🗑️ BattleRoom fermée');
    
    if (this.gameLoop) this.gameLoop.clear();
    if (this.elixirLoop) this.elixirLoop.clear();
    if (this.battleTimeout) this.battleTimeout.clear();
  }
}
