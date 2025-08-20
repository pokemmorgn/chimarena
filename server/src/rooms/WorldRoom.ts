// server/src/rooms/WorldRoom.ts - VERSION CORRIGÉE
import { Room, Client } from "@colyseus/core";
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import * as jwt from 'jsonwebtoken';
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
  accountInfo: {
    isBanned?: boolean;
    banReason?: string;
    banExpires?: Date;
  };
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
lastSeen: number = 0;
  
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
  
  // Configurations JWT
  private JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
  
  // Utilitaire mathématique pour remplacer Phaser.Math
  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  onCreate(options: any) {
    console.log('🌍 WorldRoom créée avec options:', options);
    this.setState(new WorldState());
    
    // Vérifier la configuration JWT
    if (!this.JWT_ACCESS_SECRET) {
      console.error('❌ JWT_ACCESS_SECRET non configuré !');
      throw new Error('Configuration JWT manquante');
    }
    
    // 📨 HANDLERS DE MESSAGES
    this.onMessage("get_arena_info", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        this.handleGetArenaInfo(client, player);
      }
    });
    
    this.onMessage("search_battle", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        this.handleSearchBattle(client, player);
      }
    });
    
    this.onMessage("cancel_search", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        this.handleCancelSearch(client, player);
      }
    });
    
    this.onMessage("get_leaderboard", (client, message) => {
      this.handleGetLeaderboard(client, message);
    });
    
    this.onMessage("update_status", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        this.handleUpdateStatus(client, player, message);
      }
    });
    
    this.onMessage("heartbeat", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (player) {
        this.handleHeartbeat(client, player);
      }
    });
    
    // Mise à jour périodique des stats
    this.clock.setInterval(() => {
      this.updateGlobalStats();
    }, 30000); // Toutes les 30 secondes
    
    // Nettoyage des joueurs inactifs
    this.clock.setInterval(() => {
      this.cleanupInactivePlayers();
    }, 60000); // Toutes les minutes
    
    console.log('✅ WorldRoom initialisée avec validation JWT');
  }

  // 🚪 CONNEXION D'UN JOUEUR AVEC VALIDATION JWT
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
        const banExpires = user.accountInfo.banExpires;
        console.log(`🚫 Utilisateur banni: ${user.username} - ${banMessage}`);
        throw new Error(`Compte banni: ${banMessage}${banExpires ? ` (expire le ${banExpires})` : ''}`);
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
      
      // Décoder et valider le JWT
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
    console.log(`🚪 Joueur ${player?.username || client.sessionId} quitte la WorldRoom (consented: ${consented})`);
    
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
    
    // Mettre à jour les stats globales
    this.updateGlobalStats();
    
    client.send("search_started", { 
      message: "Recherche d'adversaire en cours...",
      estimatedTime: 30 
    });
    
    // Simulation d'un match trouvé après quelques secondes
    this.clock.setTimeout(() => {
      if (player.status === "searching") {
        this.simulateMatchFound(client, player);
      }
    }, this.randomBetween(3000, 8000)); // 3-8 secondes aléatoires
  }

  // 🎯 SIMULATION MATCH TROUVÉ
  private simulateMatchFound(client: Client, player: WorldPlayer) {
    console.log(`🎯 Match simulé trouvé pour ${player.username}`);
    
    player.status = "in_battle";
    
    // Créer un adversaire fictif avec des stats similaires
    const opponentTrophies = player.trophies + Math.floor(Math.random() * 200 - 100);
    const opponentLevel = Math.max(1, player.level + Math.floor(Math.random() * 4 - 2));
    
    client.send("match_found", {
      opponent: {
        username: `Bot_${Math.floor(Math.random() * 1000)}`,
        level: opponentLevel,
        trophies: Math.max(0, opponentTrophies),
        arenaId: ArenaManager.getCurrentArena(Math.max(0, opponentTrophies)).id
      },
      battleRoomId: "battle_" + Date.now(),
      countdown: 3
    });
    
    // Simuler fin de combat après 20-40 secondes
    const battleDuration = this.randomBetween(20000, 40000);
    this.clock.setTimeout(() => {
      this.simulateBattleEnd(client, player, Math.max(0, opponentTrophies));
    }, battleDuration);
  }

  // 🏆 SIMULATION FIN DE COMBAT
  private async simulateBattleEnd(client: Client, player: WorldPlayer, opponentTrophies: number) {
    // Calculer les chances de victoire selon la différence de trophées
    const trophyDifference = opponentTrophies - player.trophies;
    let winChance = 0.5; // 50% de base
    
    // Ajuster selon la différence de niveau
    if (trophyDifference > 100) winChance = 0.3; // Adversaire plus fort
    else if (trophyDifference < -100) winChance = 0.7; // Adversaire plus faible
    
    const isWin = Math.random() < winChance;
    const trophyChange = ArenaManager.calculateTrophyChange(player.trophies, opponentTrophies, isWin);
    
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
    
    // Calculer les récompenses
    const baseGold = isWin ? 100 : 25;
    const baseExp = isWin ? 50 : 10;
    const bonusGold = Math.abs(trophyChange) * 2;
    
    // Envoyer le résultat
    client.send("battle_result", {
      victory: isWin,
      trophyChange,
      newTrophies,
      arenaChanged: newArenaId !== oldArenaId,
      newArena: newArenaId !== oldArenaId ? ArenaManager.getArenaById(newArenaId) : null,
      rewards: {
        gold: baseGold + bonusGold,
        experience: baseExp,
        cards: isWin ? 1 : 0
      },
      battleDuration: "2:34",
      opponentTrophies
    });
    
    // Mettre à jour les stats globales
    this.updateGlobalStats();
    
    console.log(`🏆 Combat terminé pour ${player.username}: ${isWin ? 'Victoire' : 'Défaite'} (${trophyChange} trophées) - ${player.trophies} total`);
  }

  // ❌ ANNULER LA RECHERCHE
  private handleCancelSearch(client: Client, player: WorldPlayer) {
    if (player.status === "searching") {
      player.status = "idle";
      this.updateGlobalStats();
      client.send("search_cancelled", { message: "Recherche annulée" });
      console.log(`❌ ${player.username} a annulé sa recherche`);
    } else {
      client.send("error", { message: "Aucune recherche en cours à annuler" });
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
        arenaId: player.currentArenaId,
        isOnline: Date.now() - player.lastSeen < 120000 // En ligne dans les 2 dernières minutes
      }));
    
    client.send("leaderboard", { 
      players: leaderboard,
      total: this.state.players.size,
      timestamp: Date.now()
    });
    
    console.log(`🏆 Leaderboard envoyé à ${client.sessionId} (${leaderboard.length} joueurs)`);
  }

  // 📊 MISE À JOUR DU STATUT
  private handleUpdateStatus(client: Client, player: WorldPlayer, message: any) {
    if (message.status && ['idle', 'away'].includes(message.status)) {
      const oldStatus = player.status;
      player.status = message.status;
      player.lastSeen = Date.now();
      
      if (oldStatus !== player.status) {
        console.log(`📊 ${player.username} status: ${oldStatus} -> ${player.status}`);
      }
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
    const cleaned: string[] = [];
    
    for (const [sessionId, player] of this.state.players.entries()) {
      if (now - player.lastSeen > timeout) {
        console.log(`🧹 Nettoyage joueur inactif: ${player.username} (inactif depuis ${Math.round((now - player.lastSeen) / 60000)}min)`);
        this.state.players.delete(sessionId);
        this.userCache.delete(sessionId);
        cleaned.push(player.username);
      }
    }
    
    if (cleaned.length > 0) {
      console.log(`🧹 ${cleaned.length} joueur(s) inactif(s) nettoyé(s): ${cleaned.join(', ')}`);
      this.updateGlobalStats();
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
        console.log(`🔄 Migration arène pour ${user.username}`);
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
      if (!user) {
        console.warn(`⚠️ Utilisateur ${userId} non trouvé pour mise à jour`);
        return;
      }
      
      // Mettre à jour les trophées
      if (updates.trophies !== undefined) {
        const result = await user.updateArena(updates.trophies, updates.isWin ? 'win' : 'loss');
        if (result.arenaChanged) {
          console.log(`🏟️ ${user.username} a changé d'arène: ${result.newArena?.nameId}`);
        }
      }
      
      // Mettre à jour les stats de jeu
      if (updates.isWin !== undefined) {
        if (updates.isWin) {
          user.gameStats.wins++;
          user.gameStats.winStreak++;
          if (user.gameStats.winStreak > user.gameStats.bestWinStreak) {
            user.gameStats.bestWinStreak = user.gameStats.winStreak;
          }
        } else {
          user.gameStats.losses++;
          user.gameStats.winStreak = 0;
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
      console.log(`💾 Profil mis à jour pour ${user.username} (${user.playerStats.trophies} trophées)`);
      
    } catch (error) {
      console.error(`❌ Erreur mise à jour profil ${userId}:`, error);
    }
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
    console.log('🗑️ WorldRoom fermée - Nettoyage en cours...');
    this.userCache.clear();
    console.log('✅ WorldRoom nettoyée');
  }
}
