// server/src/rooms/WorldRoom.ts - ROOM MONDIALE ChimArena
import { Room, Client } from "@colyseus/core";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import User from "../models/User";
import { ArenaManager } from "../config/arenas";

// Interface pour typer IUser
interface IUser {
  _id: any;
  username: string;
  playerStats: {
    level: number;
    experience: number;
    trophies: number;
    highestTrophies: number;
  };
  gameStats: {
    wins: number;
    losses: number;
    totalGames: number;
  };
  currentArenaId: number;
  resources: any;
  seasonStats: any;
  autoMigrateToArenaSystem(): Promise<void>;
  updateArena(trophies: number, reason: 'win' | 'loss'): Promise<any>;
  save(): Promise<void>;
}

// 🌍 ÉTAT DU JOUEUR DANS LE MONDE
export class WorldPlayer extends Schema {
  userId: string = "";
  username: string = "";
  level: number = 1;
  trophies: number = 0;
  currentArenaId: number = 0;
  status: string = "idle"; // idle, searching, in_battle
  lastSeen: number = Date.now();
  
  // Stats rapides pour l'affichage
  wins: number = 0;
  losses: number = 0;
  winRate: number = 0;
}

defineTypes(WorldPlayer, {
  userId: "string",
  username: "string", 
  level: "number",
  trophies: "number",
  currentArenaId: "number",
  status: "string",
  lastSeen: "number",
  wins: "number",
  losses: "number",
  winRate: "number"
});

// 🌍 ÉTAT DE LA WORLD ROOM
export class WorldState extends Schema {
  players = new MapSchema<WorldPlayer>();
  totalPlayers: number = 0;
  playersOnline: number = 0;
  playersSearching: number = 0;
}

defineTypes(WorldState, {
  players: { map: WorldPlayer },
  totalPlayers: "number",
  playersOnline: "number", 
  playersSearching: "number"
});

// 🌍 WORLD ROOM - Hub central de tous les joueurs
export class WorldRoom extends Room<WorldState> {
  maxClients = 1000; // Limite de joueurs simultanés
  
  // Cache des utilisateurs pour éviter les requêtes DB répétées
  private userCache = new Map<string, any>();
  
  onCreate(options: any) {
    console.log('🌍 WorldRoom créée avec options:', options);
    this.setState(new WorldState());
    
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
    
    // Mise à jour périodique des stats
    this.clock.setInterval(() => {
      this.updateGlobalStats();
    }, 30000); // Toutes les 30 secondes
    
    // Nettoyage des joueurs inactifs
    this.clock.setInterval(() => {
      this.cleanupInactivePlayers();
    }, 60000); // Toutes les minutes
  }

  // 🚪 CONNEXION D'UN JOUEUR
  async onJoin(client: Client, options: any) {
    console.log(`🚪 Joueur ${client.sessionId} rejoint la WorldRoom`);
    
    try {
      // Vérifier l'authentification
      if (!options.userId || !options.token) {
        throw new Error('Authentification requise');
      }
      
      // Charger le profil utilisateur
      const user = await this.loadUserProfile(options.userId);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }
      
      // Créer le joueur dans l'état
      const worldPlayer = new WorldPlayer();
      worldPlayer.userId = (user._id as any).toString();
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
      
      // Ajouter à l'état
      this.state.players.set(client.sessionId, worldPlayer);
      
      // Mettre en cache
      this.userCache.set(client.sessionId, user);
      
      // Mettre à jour les stats globales
      this.updateGlobalStats();
      
      // Envoyer les données personnelles au client
      client.send("player_profile", {
        profile: {
          userId: (user._id as any).toString(),
          username: user.username,
          level: user.playerStats.level,
          experience: user.playerStats.experience,
          trophies: user.playerStats.trophies,
          highestTrophies: user.playerStats.highestTrophies,
          currentArena: ArenaManager.getCurrentArena(user.playerStats.trophies),
          resources: user.resources,
          gameStats: user.gameStats,
          seasonStats: user.seasonStats
        }
      });
      
      console.log(`✅ ${user.username} connecté à la WorldRoom (${user.playerStats.trophies} trophées)`);
      
    } catch (error) {
      console.error(`❌ Erreur connexion WorldRoom:`, error);
      client.leave(4000, 'Erreur d\'authentification');
    }
  }

  // 🚪 DÉCONNEXION D'UN JOUEUR  
  onLeave(client: Client, consented: boolean) {
    console.log(`🚪 Joueur ${client.sessionId} quitte la WorldRoom`);
    
    // Supprimer du cache
    this.userCache.delete(client.sessionId);
    
    // Supprimer de l'état
    this.state.players.delete(client.sessionId);
    
    // Mettre à jour les stats
    this.updateGlobalStats();
  }

  // 🏟️ INFORMATIONS SUR L'ARÈNE
  private handleGetArenaInfo(client: Client, player: WorldPlayer) {
    try {
      const currentArena = ArenaManager.getCurrentArena(player.trophies);
      const nextArena = ArenaManager.getNextArena(currentArena);
      const progress = ArenaManager.getArenaProgress(player.trophies);
      const trophiesToNext = ArenaManager.getTrophiesToNextArena(player.trophies);
      
      client.send("arena_info", {
        current: {
          id: currentArena.id,
          nameId: currentArena.nameId,
          icon: currentArena.icon,
          minTrophies: currentArena.minTrophies,
          maxTrophies: currentArena.maxTrophies
        },
        next: nextArena ? {
          id: nextArena.id,
          nameId: nextArena.nameId,
          icon: nextArena.icon,
          minTrophies: nextArena.minTrophies
        } : null,
        progress: Math.round(progress),
        trophiesToNext,
        rank: ArenaManager.getArenaRank(player.trophies)
      });
    } catch (error) {
      console.error('❌ Erreur get_arena_info:', error);
      client.send("error", { message: "Erreur lors de la récupération des infos d'arène" });
    }
  }

  // ⚔️ RECHERCHE DE BATAILLE
  private handleSearchBattle(client: Client, player: WorldPlayer) {
    console.log(`⚔️ ${player.username} recherche une bataille`);
    
    if (player.status !== "idle") {
      client.send("search_error", { message: "Vous êtes déjà en recherche ou en combat" });
      return;
    }
    
    // Mettre en recherche
    player.status = "searching";
    
    // TODO: Logique de matchmaking
    // Pour l'instant, on simule juste
    client.send("search_started", { 
      message: "Recherche d'adversaire en cours...",
      estimatedTime: 30 
    });
    
    // Simulation d'un match trouvé après quelques secondes
    this.clock.setTimeout(() => {
      if (player.status === "searching") {
        this.simulateMatchFound(client, player);
      }
    }, 5000);
  }

  // 🎯 SIMULATION MATCH TROUVÉ (temporaire)
  private simulateMatchFound(client: Client, player: WorldPlayer) {
    console.log(`🎯 Match simulé trouvé pour ${player.username}`);
    
    player.status = "in_battle";
    
    client.send("match_found", {
      opponent: {
        username: "Bot_Opponent",
        level: player.level,
        trophies: player.trophies + Math.floor(Math.random() * 200 - 100),
        arenaId: player.currentArenaId
      },
      battleRoomId: "battle_" + Date.now(),
      countdown: 3
    });
    
    // Simuler fin de combat après 30 secondes
    this.clock.setTimeout(() => {
      this.simulateBattleEnd(client, player);
    }, 30000);
  }

  // 🏆 SIMULATION FIN DE COMBAT (temporaire)
  private async simulateBattleEnd(client: Client, player: WorldPlayer) {
    const isWin = Math.random() > 0.4; // 60% de chance de gagner
    const trophyChange = isWin ? 
      Math.floor(Math.random() * 15) + 25 : // +25 à +40
      -(Math.floor(Math.random() * 15) + 20); // -20 à -35
    
    // Mettre à jour les trophées
    const newTrophies = Math.max(0, player.trophies + trophyChange);
    const oldArenaId = player.currentArenaId;
    const newArenaId = ArenaManager.getCurrentArena(newTrophies).id;
    
    player.trophies = newTrophies;
    player.currentArenaId = newArenaId;
    player.status = "idle";
    
    if (isWin) {
      player.wins++;
    } else {
      player.losses++;
    }
    
    // Recalculer le taux de victoire
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
    
    // Envoyer le résultat
    client.send("battle_result", {
      victory: isWin,
      trophyChange,
      newTrophies,
      arenaChanged: newArenaId !== oldArenaId,
      newArena: newArenaId !== oldArenaId ? ArenaManager.getArenaById(newArenaId) : null,
      rewards: {
        gold: isWin ? 100 : 25,
        experience: isWin ? 50 : 10
      }
    });
    
    console.log(`🏆 Combat terminé pour ${player.username}: ${isWin ? 'Victoire' : 'Défaite'} (${trophyChange} trophées)`);
  }

  // ❌ ANNULER LA RECHERCHE
  private handleCancelSearch(client: Client, player: WorldPlayer) {
    if (player.status === "searching") {
      player.status = "idle";
      client.send("search_cancelled", { message: "Recherche annulée" });
      console.log(`❌ ${player.username} a annulé sa recherche`);
    }
  }

  // 🏆 CLASSEMENT
  private handleGetLeaderboard(client: Client, message: any) {
    const limit = Math.min(message.limit || 50, 100);
    
    // Trier les joueurs par trophées
    const leaderboard = Array.from(this.state.players.values())
      .sort((a, b) => b.trophies - a.trophies)
      .slice(0, limit)
      .map((player, index) => ({
        rank: index + 1,
        username: player.username,
        level: player.level,
        trophies: player.trophies,
        winRate: player.winRate,
        arenaId: player.currentArenaId
      }));
    
    client.send("leaderboard", { 
      players: leaderboard,
      total: this.state.players.size 
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
    client.send("heartbeat_ack", { timestamp: Date.now() });
  }

  // 📊 MISE À JOUR DES STATS GLOBALES
  private updateGlobalStats() {
    this.state.totalPlayers = this.state.players.size;
    this.state.playersOnline = Array.from(this.state.players.values())
      .filter(p => Date.now() - p.lastSeen < 120000).length; // Actifs dans les 2 dernières minutes
    this.state.playersSearching = Array.from(this.state.players.values())
      .filter(p => p.status === "searching").length;
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
      
      // S'assurer que le système d'arène est initialisé
      if (!user.currentArenaId && user.currentArenaId !== 0) {
        await user.autoMigrateToArenaSystem();
        await user.save();
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
      
      // Mettre à jour les trophées
      if (updates.trophies !== undefined) {
        await user.updateArena(updates.trophies, updates.isWin ? 'win' : 'loss');
      }
      
      // Mettre à jour les stats de jeu
      if (updates.isWin !== undefined) {
        if (updates.isWin) {
          user.gameStats.wins++;
        } else {
          user.gameStats.losses++;
        }
        user.gameStats.totalGames++;
        
        // Mettre à jour les stats de saison
        if (user.seasonStats) {
          if (updates.isWin) {
            user.seasonStats.wins++;
          } else {
            user.seasonStats.losses++;
          }
        }
      }
      
      await user.save();
      console.log(`💾 Profil mis à jour pour ${userId}`);
      
    } catch (error) {
      console.error(`❌ Erreur mise à jour profil ${userId}:`, error);
    }
  }

  onDispose() {
    console.log('🗑️ WorldRoom fermée');
    this.userCache.clear();
  }
}
