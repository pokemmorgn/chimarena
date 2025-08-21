// server/src/rooms/WorldRoom.ts - VERSION CORRIGÉE

import { Room, Client, matchMaker } from "@colyseus/core";
import * as jwt from 'jsonwebtoken';
import User from "../models/User";
import MatchmakingService, { MatchmakingPlayer, MatchResult } from "../services/MatchmakingService";
import { cardManager } from '../services/CardManager';
// 🌍 ÉTAT DU JOUEUR DANS LE MONDE - CORRIGÉ
import { Schema, type, MapSchema } from "@colyseus/schema";

export class WorldPlayer extends Schema {
  @type("string") userId: string = "";
  @type("string") username: string = "";
  @type("number") level: number = 1;
  @type("number") trophies: number = 0;
  @type("number") currentArenaId: number = 0;
  @type("string") status: string = "idle"; // idle, searching, in_battle
  @type("number") lastSeen: number = Date.now();

  // Stats rapides pour l'affichage
  @type("number") wins: number = 0;
  @type("number") losses: number = 0;
  @type("number") winRate: number = 0;
}

export class WorldState extends Schema {
  @type({ map: WorldPlayer }) players = new MapSchema<WorldPlayer>();
  @type("number") totalPlayers: number = 0;
  @type("number") playersOnline: number = 0;
  @type("number") playersSearching: number = 0;
}


// 🌍 WORLD ROOM - Hub central de tous les joueurs
export class WorldRoom extends Room<WorldState> {
  maxClients = 1000;
  
  private matchmakingService!: MatchmakingService;
  
  // Cache des utilisateurs
  private userCache = new Map<string, any>();
  
  // Configuration JWT
  private JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
  
  onCreate(options: any) {
    console.log('🌍 WorldRoom créée avec options:', options);
    this.setState(new WorldState());

// Initialiser le service de matchmaking
    this.matchmakingService = new MatchmakingService();
    
    // Événements du matchmaking
    this.matchmakingService.on('matchFound', (match: MatchResult) => {
      this.handleMatchFound(match);
    });
    
    this.matchmakingService.on('playerJoined', (player: MatchmakingPlayer) => {
      console.log(`🎯 ${player.username} rejoint la file de matchmaking`);
    });
    
    this.matchmakingService.on('playerLeft', (data: { player: MatchmakingPlayer; waitTime: number }) => {
      console.log(`🎯 ${data.player.username} quitte la file (attente: ${Math.round(data.waitTime/1000)}s)`);
    });
    
    // Vérifier la configuration JWT
    if (!this.JWT_ACCESS_SECRET) {
      console.error('❌ JWT_ACCESS_SECRET non configuré !');
      throw new Error('Configuration JWT manquante');
    }
    
    // 📨 HANDLERS DE MESSAGES
    this.onMessage("get_arena_info", (client, message) => {
      this.handleGetArenaInfo(client, this.state.players.get(client.sessionId)!);
    });
    
    this.onMessage("search_battle", (client, message) => {
      this.handleSearchBattle(client, this.state.players.get(client.sessionId)!);
    });
    
    this.onMessage("cancel_search", (client, message) => {
      this.handleCancelSearch(client, this.state.players.get(client.sessionId)!);
    });
    
    this.onMessage("get_leaderboard", (client, message) => {
      this.handleGetLeaderboard(client, message);
    });
    
    this.onMessage("update_status", (client, message) => {
      this.handleUpdateStatus(client, this.state.players.get(client.sessionId)!, message);
    });
    
    this.onMessage("heartbeat", (client, message) => {
      this.handleHeartbeat(client, this.state.players.get(client.sessionId)!);
    });
    
    this.onMessage("get_matchmaking_stats", (client, message) => {
      this.handleGetMatchmakingStats(client);
    });

    this.onMessage("get_deck_info", (client, message) => {
    this.handleGetDeckInfo(client, this.state.players.get(client.sessionId)!);
    });
    
    this.onMessage("validate_deck", (client, message) => {
      this.handleValidateDeck(client, this.state.players.get(client.sessionId)!, message);
    });
    // Mise à jour périodique des stats
    this.clock.setInterval(() => {
      this.updateGlobalStats();
    }, 30000);
    
    // Nettoyage des joueurs inactifs
    this.clock.setInterval(() => {
      this.cleanupInactivePlayers();
    }, 60000);
    
    console.log('✅ WorldRoom initialisée avec validation JWT');
  }

  // 🚪 CONNEXION D'UN JOUEUR AVEC VALIDATION JWT - CORRIGÉE
  async onJoin(client: Client, options: any) {
    console.log(`🚪 Joueur ${client.sessionId} rejoint la WorldRoom`);
    
    try {
      // Vérifier qu'un token est fourni
      if (!options.token) {
        throw new Error('Token JWT requis');
      }
      
      // 🔐 VALIDER LE JWT ET EXTRAIRE L'UTILISATEUR
      const decoded = await this.validateJWT(options.token);
      if (!decoded || !decoded.id) {
        throw new Error('Token JWT invalide');
      }
      
      console.log(`🔐 JWT validé pour l'utilisateur: ${decoded.username} (${decoded.id})`);
      
      // Charger le profil utilisateur avec l'ID du token
      const user = await this.loadUserProfile(decoded.id);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }
      
      // Vérifier si l'utilisateur est banni
      if (user.accountInfo?.isBanned) {
        const banMessage = user.accountInfo.banReason || 'Compte banni';
        console.log(`🚫 Utilisateur banni: ${user.username} - ${banMessage}`);
        throw new Error(`Compte banni: ${banMessage}`);
      }
      
      // ✅ CRÉER LE JOUEUR CORRECTEMENT
      const worldPlayer = new WorldPlayer();
      worldPlayer.userId = user._id.toString();
      worldPlayer.username = user.username;
      worldPlayer.level = user.playerStats.level;
      worldPlayer.trophies = user.playerStats.trophies;
      worldPlayer.currentArenaId = user.currentArenaId || 0;
      worldPlayer.status = "idle";
      worldPlayer.lastSeen = Date.now();
      worldPlayer.wins = user.gameStats.wins;
      worldPlayer.losses = user.gameStats.losses;
      worldPlayer.winRate = user.gameStats.totalGames > 0 
        ? Math.round((user.gameStats.wins / user.gameStats.totalGames) * 100) 
        : 0;
      
      // ✅ AJOUTER À L'ÉTAT CORRECTEMENT
      this.state.players.set(client.sessionId, worldPlayer);
      
      // Mettre en cache
      this.userCache.set(client.sessionId, user);
      
      // Mettre à jour les stats globales
      this.updateGlobalStats();
      
      // Envoyer les données personnelles au client
      client.send("player_profile", {
        profile: {
          userId: user._id.toString(),
          username: user.username,
          level: user.playerStats.level,
          experience: user.playerStats.experience,
          trophies: user.playerStats.trophies,
          highestTrophies: user.playerStats.highestTrophies,
          currentArena: this.getCurrentArenaInfo(user.playerStats.trophies),
          resources: user.resources,
          gameStats: user.gameStats,
          seasonStats: user.seasonStats
        }
      });
      
      console.log(`✅ ${user.username} connecté à la WorldRoom (${user.playerStats.trophies} trophées)`);
      
    } catch (error) {
      console.error(`❌ Erreur connexion WorldRoom:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      client.leave(4000, `Erreur d'authentification: ${errorMessage}`);
    }
  }

  // 🔐 VALIDATION DU JWT
  private async validateJWT(token: string): Promise<any> {
    try {
      if (!this.JWT_ACCESS_SECRET) {
        throw new Error('JWT_ACCESS_SECRET non configuré');
      }
      
      const decoded = jwt.verify(token, this.JWT_ACCESS_SECRET);
      return decoded;
    } catch (error) {
      console.error('❌ Erreur validation JWT:', error);
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expiré');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Token JWT malformé');
      }
      throw new Error('Token JWT invalide');
    }
  }

  // 🚪 DÉCONNEXION D'UN JOUEUR  
  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    console.log(`🚪 Joueur ${player?.username || client.sessionId} quitte la WorldRoom`);
    
    // Retirer du matchmaking si en recherche
    if (player?.status === "searching") {
      this.matchmakingService.removePlayer(client.sessionId);
      console.log(`🎯 ${player.username} retiré du matchmaking lors de la déconnexion`);
    }
    
    // Supprimer du cache
    this.userCache.delete(client.sessionId);
    
    // Supprimer de l'état
    this.state.players.delete(client.sessionId);
    
    // Mettre à jour les stats
    this.updateGlobalStats();
  }

  // 🏟️ INFORMATIONS SUR L'ARÈNE - SIMPLIFIÉE
  private handleGetArenaInfo(client: Client, player: WorldPlayer) {
    try {
      const arenaInfo = this.getCurrentArenaInfo(player.trophies);
      
      client.send("arena_info", {
        current: arenaInfo,
        rank: this.getArenaRank(player.trophies)
      });
    } catch (error) {
      console.error('❌ Erreur get_arena_info:', error);
      client.send("error", { message: "Erreur lors de la récupération des infos d'arène" });
    }
  }

  // 🏟️ HELPER POUR ARÈNE (SIMPLIFIÉ)
  private getCurrentArenaInfo(trophies: number) {
    // Système d'arène simplifié
    const arenas = [
      { id: 0, nameId: "training_camp", icon: "🏕️", minTrophies: 0, maxTrophies: 299 },
      { id: 1, nameId: "goblin_stadium", icon: "👹", minTrophies: 300, maxTrophies: 599 },
      { id: 2, nameId: "bone_pit", icon: "💀", minTrophies: 600, maxTrophies: 999 },
      { id: 3, nameId: "barbarian_bowl", icon: "⚔️", minTrophies: 1000, maxTrophies: 1299 },
      { id: 4, nameId: "pekka_playhouse", icon: "🤖", minTrophies: 1300, maxTrophies: 1599 },
      { id: 5, nameId: "royal_arena", icon: "👑", minTrophies: 1600, maxTrophies: 1999 },
      { id: 6, nameId: "frozen_peak", icon: "🏔️", minTrophies: 2000, maxTrophies: 2599 },
      { id: 7, nameId: "jungle_arena", icon: "🌴", minTrophies: 2600, maxTrophies: 3199 },
      { id: 8, nameId: "hog_mountain", icon: "🐗", minTrophies: 3200, maxTrophies: 3999 },
      { id: 9, nameId: "legendary_arena", icon: "🏆", minTrophies: 4000, maxTrophies: 999999 }
    ];

    return arenas.find(arena => trophies >= arena.minTrophies && trophies <= arena.maxTrophies) || arenas[0];
  }

  private getArenaRank(trophies: number): string {
    if (trophies >= 4000) return "Légendaire";
    if (trophies >= 3200) return "Champion";
    if (trophies >= 2600) return "Maître";
    if (trophies >= 2000) return "Expert";
    if (trophies >= 1600) return "Avancé";
    if (trophies >= 1000) return "Confirmé";
    if (trophies >= 600) return "Intermédiaire";
    if (trophies >= 300) return "Débutant";
    return "Apprenti";
  }

    // ⚔️ RECHERCHE DE BATAILLE
   private async handleSearchBattle(client: Client, player: WorldPlayer) {
        console.log(`⚔️ ${player.username} recherche une bataille`);
        
        if (player.status !== "idle") {
          client.send("search_error", { message: "Vous êtes déjà en recherche ou en combat" });
          return;
        }
        
    // Récupérer et valider le deck de l'utilisateur
    const user = await User.findById(player.userId).select('deck currentArenaId');
    if (!user || !user.deck || user.deck.length !== 8) {
      client.send("search_error", { 
        message: "Deck invalide ou incomplet. Configurez votre deck avant de jouer.",
        code: "INVALID_DECK"
      });
      return;
    }
    
    // Valider le deck avec le CardManager
    console.log(`🎮 Validation deck pour ${player.username}: ${user.deck.join(', ')}`);
    const deckValidation = await cardManager.validateDeck(user.deck, user.currentArenaId);
    
    if (!deckValidation.isValid) {
      console.log(`❌ Deck invalide pour ${player.username}: ${deckValidation.errors.join(', ')}`);
      client.send("search_error", { 
        message: `Deck invalide: ${deckValidation.errors.join(', ')}`,
        code: "DECK_VALIDATION_FAILED",
        errors: deckValidation.errors,
        warnings: deckValidation.warnings
      });
      return;
    }
    
    console.log(`✅ Deck valide pour ${player.username} - Coût moyen: ${deckValidation.stats.averageElixirCost}`);
    
    // Créer le joueur pour le matchmaking avec le vrai deck
    const matchmakingPlayer: MatchmakingPlayer = {
      sessionId: client.sessionId,
      userId: player.userId,
      username: player.username,
      level: player.level,
      trophies: player.trophies,
      arenaId: player.currentArenaId,
      winRate: player.winRate,
      deck: user.deck, // ✅ Vrai deck de l'utilisateur
      preferredGameMode: 'ranked',
      region: 'EU',
      joinedAt: 0,
      estimatedWaitTime: 0,
      searchAttempts: 0
    };
    
    // Ajouter au service de matchmaking
    const added = this.matchmakingService.addPlayer(matchmakingPlayer);
    
    if (added) {
      player.status = "searching";
      this.updateGlobalStats();
      
      client.send("search_started", { 
        message: "Recherche d'adversaire en cours...",
        estimatedTime: matchmakingPlayer.estimatedWaitTime / 1000 
      });
    } else {
      client.send("search_error", { message: "Impossible de rejoindre la file de matchmaking" });
    }
  }

  // 🎯 SIMULATION MATCH TROUVÉ
  private simulateMatchFound(client: Client, player: WorldPlayer) {
    console.log(`🎯 Match simulé trouvé pour ${player.username}`);
    
    player.status = "in_battle";
    
    const opponentTrophies = player.trophies + Math.floor(Math.random() * 200 - 100);
    const opponentLevel = Math.max(1, player.level + Math.floor(Math.random() * 4 - 2));
    
    client.send("match_found", {
      opponent: {
        username: `Bot_${Math.floor(Math.random() * 1000)}`,
        level: opponentLevel,
        trophies: Math.max(0, opponentTrophies),
        arenaId: this.getCurrentArenaInfo(Math.max(0, opponentTrophies)).id
      },
      battleRoomId: "battle_" + Date.now(),
      countdown: 3
    });
    
    // Simuler fin de combat
    const battleDuration = this.randomBetween(20000, 40000);
    this.clock.setTimeout(() => {
      this.simulateBattleEnd(client, player, Math.max(0, opponentTrophies));
    }, battleDuration);
  }

  // 🏆 SIMULATION FIN DE COMBAT
  private async simulateBattleEnd(client: Client, player: WorldPlayer, opponentTrophies: number) {
    const trophyDifference = opponentTrophies - player.trophies;
    let winChance = 0.5;
    
    if (trophyDifference > 100) winChance = 0.3;
    else if (trophyDifference < -100) winChance = 0.7;
    
    const isWin = Math.random() < winChance;
    const trophyChange = this.calculateTrophyChange(player.trophies, opponentTrophies, isWin);
    
    const newTrophies = Math.max(0, player.trophies + trophyChange);
    const oldArenaId = player.currentArenaId;
    const newArenaId = this.getCurrentArenaInfo(newTrophies).id;
    
    player.trophies = newTrophies;
    player.currentArenaId = newArenaId;
    player.status = "idle";
    
    if (isWin) {
      player.wins++;
    } else {
      player.losses++;
    }
    
    const totalGames = player.wins + player.losses;
    player.winRate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
    
    // Mettre à jour en base de données
    try {
      await this.updateUserInDatabase(player.userId, {
        trophies: newTrophies,
        arenaId: newArenaId,
        isWin
      });
    } catch (error) {
      console.error('❌ Erreur mise à jour BDD:', error);
    }
    
    const baseGold = isWin ? 100 : 25;
    const baseExp = isWin ? 50 : 10;
    const bonusGold = Math.abs(trophyChange) * 2;
    
    client.send("battle_result", {
      victory: isWin,
      trophyChange,
      newTrophies,
      arenaChanged: newArenaId !== oldArenaId,
      newArena: newArenaId !== oldArenaId ? this.getCurrentArenaInfo(newTrophies) : null,
      rewards: {
        gold: baseGold + bonusGold,
        experience: baseExp,
        cards: isWin ? 1 : 0
      },
      battleDuration: "2:34",
      opponentTrophies
    });
    
    this.updateGlobalStats();
    
    console.log(`🏆 Combat terminé pour ${player.username}: ${isWin ? 'Victoire' : 'Défaite'} (${trophyChange} trophées)`);
  }

    // ❌ ANNULER LA RECHERCHE
      private handleCancelSearch(client: Client, player: WorldPlayer) {
        if (player.status === "searching") {
          // Retirer du service de matchmaking
          const removed = this.matchmakingService.removePlayer(client.sessionId);
          
          if (removed) {
            player.status = "idle";
            this.updateGlobalStats();
            client.send("search_cancelled", { message: "Recherche annulée" });
            console.log(`❌ ${player.username} a annulé sa recherche`);
          } else {
            console.warn(`⚠️ Impossible de retirer ${player.username} du matchmaking`);
            // Forcer le changement de statut quand même
            player.status = "idle";
            this.updateGlobalStats();
            client.send("search_cancelled", { message: "Recherche annulée" });
          }
        }
      }

  // 🏆 CLASSEMENT
  private handleGetLeaderboard(client: Client, message: any) {
    const limit = Math.min(message.limit || 50, 100);
    
    const leaderboard = Array.from(this.state.players.values())
      .sort((a, b) => b.trophies - a.trophies)
      .slice(0, limit)
      .map((player, index) => ({
        rank: index + 1,
        username: player.username,
        level: player.level,
        trophies: player.trophies,
        winRate: player.winRate,
        arenaId: player.currentArenaId,
        isOnline: Date.now() - player.lastSeen < 120000
      }));
    
    client.send("leaderboard", { 
      players: leaderboard,
      total: this.state.players.size,
      timestamp: Date.now()
    });
  }

  // 📊 MISE À JOUR DU STATUT
  private handleUpdateStatus(client: Client, player: WorldPlayer, message: any) {
    if (message.status && ['idle', 'away'].includes(message.status)) {
      player.status = message.status;
      player.lastSeen = Date.now();
    }
  }

  // 💗 HEARTBEAT
  private handleHeartbeat(client: Client, player: WorldPlayer) {
    player.lastSeen = Date.now();
    client.send("heartbeat_ack", { 
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    });
  }

  // 📊 MISE À JOUR DES STATS GLOBALES
  private updateGlobalStats() {
    const now = Date.now();
    const players = Array.from(this.state.players.values());
    
    this.state.totalPlayers = players.length;
    this.state.playersOnline = players.filter(p => now - p.lastSeen < 120000).length;
    this.state.playersSearching = players.filter(p => p.status === "searching").length;
  }

  // 🧹 NETTOYAGE DES JOUEURS INACTIFS
  private cleanupInactivePlayers() {
    const now = Date.now();
    const timeout = 10 * 60 * 1000; // 10 minutes
    
    for (const [sessionId, player] of this.state.players.entries()) {
      if (now - player.lastSeen > timeout) {
        console.log(`🧹 Nettoyage joueur inactif: ${player.username}`);
        this.state.players.delete(sessionId);
        this.userCache.delete(sessionId);
      }
    }
  }

  // 💾 CHARGER LE PROFIL UTILISATEUR
  private async loadUserProfile(userId: string): Promise<any> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`Utilisateur ${userId} non trouvé`);
      }
      
      return user;
    } catch (error) {
      console.error(`❌ Erreur chargement profil ${userId}:`, error);
      return null;
    }
  }

  // 💾 METTRE À JOUR L'UTILISATEUR EN BASE
  private async updateUserInDatabase(userId: string, updates: any): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) return;
      
      if (updates.trophies !== undefined) {
        user.playerStats.trophies = updates.trophies;
        if (updates.trophies > user.playerStats.highestTrophies) {
          user.playerStats.highestTrophies = updates.trophies;
        }
      }
      
      if (updates.isWin !== undefined) {
        if (updates.isWin) {
          user.gameStats.wins++;
        } else {
          user.gameStats.losses++;
        }
        user.gameStats.totalGames++;
      }
      
      await user.save();
      
    } catch (error) {
      console.error(`❌ Erreur mise à jour profil ${userId}:`, error);
    }
  }

  // 🧮 CALCUL CHANGEMENT TROPHÉES
  private calculateTrophyChange(playerTrophies: number, opponentTrophies: number, isWin: boolean): number {
    const trophyDifference = opponentTrophies - playerTrophies;
    let baseTrophies = 30; // Base trophy change
    
    if (isWin) {
      if (trophyDifference > 0) {
        // Victoire contre plus fort
        baseTrophies += Math.min(10, Math.floor(trophyDifference / 100));
      } else {
        // Victoire contre plus faible
        baseTrophies -= Math.min(15, Math.floor(Math.abs(trophyDifference) / 100));
      }
      return Math.max(10, baseTrophies); // Minimum 10 trophées pour une victoire
    } else {
      if (trophyDifference > 0) {
        // Défaite contre plus fort
        baseTrophies -= Math.min(15, Math.floor(trophyDifference / 100));
      } else {
        // Défaite contre plus faible
        baseTrophies += Math.min(10, Math.floor(Math.abs(trophyDifference) / 100));
      }
      return -Math.max(10, baseTrophies); // Minimum 10 trophées perdus
    }
  }

  // 🎲 UTILITAIRE RANDOM
  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 🔧 GESTION DES ERREURS
  onError(client: Client, error: Error) {
    console.error(`🔧 Erreur client ${client.sessionId}:`, error);
    client.send("error", { 
      message: "Erreur serveur", 
      code: "INTERNAL_ERROR",
      timestamp: Date.now()
    });
  }

  // 🗑️ NETTOYAGE À LA FERMETURE
  onDispose() {
    console.log('🗑️ WorldRoom fermée');
    
    // Arrêter le service de matchmaking
    if (this.matchmakingService) {
      this.matchmakingService.stop();
    }
    
    this.userCache.clear();
  }
  // === GESTION DU MATCHMAKING ===
  
  /**
   * Gérer un match trouvé par le service de matchmaking
   */
private async handleMatchFound(match: MatchResult): Promise<void> {
  console.log(`🎯 Match trouvé: ${match.player1.username} vs ${match.player2.username}`);
  console.log(`   🃏 Deck ${match.player1.username}: ${match.player1.deck.join(', ')}`);
  console.log(`   🃏 Deck ${match.player2.username}: ${match.player2.deck.join(', ')}`);
  console.log(`   ⚖️ Qualité du match: ${match.matchQuality}%, Équilibre: ${match.estimatedBalance}%`);

  try {
    // Créer une BattleRoom
    const battleRoom = await matchMaker.createRoom("battle", {
      matchId: match.battleRoomId,
      arena: match.arena,
      matchQuality: match.matchQuality
    });

    console.log(`⚔️ BattleRoom créée: ${battleRoom.roomId}`);

    // Trouver les clients correspondants
    const client1 = Array.from(this.clients).find(client => client.sessionId === match.player1.sessionId);
    const client2 = Array.from(this.clients).find(client => client.sessionId === match.player2.sessionId);

    // Envoyer les infos de connexion aux joueurs
    if (client1) {
      const player1 = this.state.players.get(client1.sessionId);
      if (player1) player1.status = "in_battle";
      
      client1.send("battle_ready", {
        battleRoomId: battleRoom.roomId,
        opponent: {
          username: match.player2.username,
          level: match.player2.level,
          trophies: match.player2.trophies,
          arenaId: match.player2.arenaId
        },
        playerData: {
          userId: match.player1.userId,
          username: match.player1.username,
          level: match.player1.level,
          trophies: match.player1.trophies,
          deck: match.player1.deck
        },
        arena: match.arena,
        matchQuality: match.matchQuality
      });
    }

    if (client2) {
      const player2 = this.state.players.get(client2.sessionId);
      if (player2) player2.status = "in_battle";
      
      client2.send("battle_ready", {
        battleRoomId: battleRoom.roomId,
        opponent: {
          username: match.player1.username,
          level: match.player1.level,
          trophies: match.player1.trophies,
          arenaId: match.player1.arenaId
        },
        playerData: {
          userId: match.player2.userId,
          username: match.player2.username,
          level: match.player2.level,
          trophies: match.player2.trophies,
          deck: match.player2.deck
        },
        arena: match.arena,
        matchQuality: match.matchQuality
      });
    }

  } catch (error) {
    console.error('❌ Erreur création BattleRoom:', error);
    
    // En cas d'erreur, notifier les joueurs
    const client1 = Array.from(this.clients).find(client => client.sessionId === match.player1.sessionId);
    const client2 = Array.from(this.clients).find(client => client.sessionId === match.player2.sessionId);
    
    if (client1) client1.send("battle_error", { message: "Erreur création du combat" });
    if (client2) client2.send("battle_error", { message: "Erreur création du combat" });
  }
}
  
  /**
   * Envoyer les statistiques du matchmaking au client
   */
  private handleGetMatchmakingStats(client: Client): void {
    const stats = this.matchmakingService.getStats();
    const config = this.matchmakingService.getConfig();
    
    client.send("matchmaking_stats", {
      stats,
      config,
      activeMatches: this.matchmakingService.getActiveMatchesCount(),
      timestamp: Date.now()
    });
  }
  // === GESTION DES DECKS ===

/**
 * Obtenir les informations du deck de l'utilisateur
 */
private async handleGetDeckInfo(client: Client, player: WorldPlayer) {
  try {
    console.log(`🃏 Infos deck demandées pour ${player.username}`);
    
    const user = await User.findById(player.userId).select('deck cards currentArenaId');
    if (!user) {
      return client.send("deck_info_error", { message: "Utilisateur non trouvé" });
    }

    if (!user.deck || user.deck.length === 0) {
      return client.send("deck_info", {
        hasDeck: false,
        message: "Aucun deck configuré"
      });
    }

    // Valider le deck avec le CardManager
    const deckValidation = await cardManager.validateDeck(user.deck, user.currentArenaId);
    
    client.send("deck_info", {
      hasDeck: true,
      deck: user.deck,
      isValid: deckValidation.isValid,
      deckStats: deckValidation.stats,
      errors: deckValidation.errors,
      warnings: deckValidation.warnings,
      recommendations: deckValidation.recommendations
    });
    
  } catch (error) {
    console.error(`❌ Erreur get deck info:`, error);
    client.send("deck_info_error", { message: "Erreur lors de la récupération du deck" });
  }
}

/**
 * Valider un deck proposé par le client
 */
private async handleValidateDeck(client: Client, player: WorldPlayer, message: any) {
  try {
    const { cardIds } = message;
    
    if (!Array.isArray(cardIds)) {
      return client.send("deck_validation_error", { message: "Format de deck invalide" });
    }

    console.log(`🃏 Validation deck pour ${player.username}: ${cardIds.join(', ')}`);
    
    const user = await User.findById(player.userId).select('currentArenaId');
    const userArena = user?.currentArenaId || 0;
    
    const deckValidation = await cardManager.validateDeck(cardIds, userArena);
    
    client.send("deck_validation_result", {
      cardIds,
      isValid: deckValidation.isValid,
      deckStats: deckValidation.stats,
      errors: deckValidation.errors,
      warnings: deckValidation.warnings,
      recommendations: deckValidation.recommendations
    });
    
  } catch (error) {
    console.error(`❌ Erreur validation deck:`, error);
    client.send("deck_validation_error", { message: "Erreur lors de la validation" });
  }
}
}
