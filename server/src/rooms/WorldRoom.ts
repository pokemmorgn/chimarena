// server/src/rooms/WorldRoom.ts - CORRECTION CONNEXIONS MULTIPLES
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
  status: string = "connecting";
  lastSeen: number = Date.now();
  
  // Stats rapides pour l'affichage
  wins: number = 0;
  losses: number = 0;
  winRate: number = 0;
  
  constructor() {
    super();
    this.userId = "";
    this.username = "";
    this.level = 1;
    this.trophies = 0;
    this.currentArenaId = 0;
    this.status = "connecting";
    this.lastSeen = Date.now();
    this.wins = 0;
    this.losses = 0;
    this.winRate = 0;
  }
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
  
  constructor() {
    super();
    this.players = new MapSchema<WorldPlayer>();
    this.totalPlayers = 0;
    this.playersOnline = 0;
    this.playersSearching = 0;
  }
}

defineTypes(WorldState, {
  players: { map: WorldPlayer },
  totalPlayers: "number",
  playersOnline: "number", 
  playersSearching: "number"
});

// 🌍 WORLD ROOM - avec gestion des connexions multiples
export class WorldRoom extends Room<WorldState> {
  maxClients = 1000;
  
  // Cache des utilisateurs
  private userCache = new Map<string, any>();
  
  // ✅ NOUVEAU: Tracker des utilisateurs par userId pour éviter les doublons
  private userSessions = new Map<string, string>(); // userId -> sessionId actuel
  
  // Configurations JWT
  private JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string;
  
  onCreate(options: any) {
    console.log('🌍 WorldRoom créée avec gestion connexions multiples');
    this.setState(new WorldState());
    
    if (!this.JWT_ACCESS_SECRET) {
      console.error('❌ JWT_ACCESS_SECRET non configuré !');
      throw new Error('Configuration JWT manquante');
    }
    
    // Handler pour client prêt
    this.onMessage("client_ready", (client, message) => {
      this.handleClientReady(client, message);
    });
    
    // HANDLERS DE MESSAGES - AVEC VÉRIFICATION DE STATUT
    this.onMessage("get_arena_info", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (this.isPlayerReady(player)) {
        this.handleGetArenaInfo(client, player!);
      } else {
        console.log(`⏳ ${client.sessionId} pas prêt pour get_arena_info`);
      }
    });
    
    this.onMessage("search_battle", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (this.isPlayerReady(player)) {
        this.handleSearchBattle(client, player!);
      } else {
        console.log(`⏳ ${client.sessionId} pas prêt pour search_battle`);
      }
    });
    
    this.onMessage("cancel_search", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (this.isPlayerReady(player)) {
        this.handleCancelSearch(client, player!);
      } else {
        console.log(`⏳ ${client.sessionId} pas prêt pour cancel_search`);
      }
    });
    
    this.onMessage("get_leaderboard", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (this.isPlayerReady(player)) {
        this.handleGetLeaderboard(client, message);
      } else {
        console.log(`⏳ ${client.sessionId} pas prêt pour get_leaderboard`);
      }
    });
    
    this.onMessage("update_status", (client, message) => {
      const player = this.state.players.get(client.sessionId);
      if (this.isPlayerReady(player)) {
        this.handleUpdateStatus(client, player!, message);
      } else {
        console.log(`⏳ ${client.sessionId} pas prêt pour update_status`);
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
    }, 30000);
    
    // Nettoyage des joueurs inactifs et connexions orphelines
    this.clock.setInterval(() => {
      this.cleanupInactivePlayers();
      this.cleanupOrphanedConnections();
    }, 60000);
    
    console.log('✅ WorldRoom initialisée avec gestion connexions multiples');
  }

  // 🚪 CONNEXION AVEC GESTION DES DOUBLONS
  async onJoin(client: Client, options: any) {
    console.log(`🚪 Joueur ${client.sessionId} tente de rejoindre`);
    
    try {
      // Validation JWT
      if (!options.token) {
        throw new Error('Token JWT requis');
      }
      
      const decoded = await this.validateJWT(options.token);
      if (!decoded || !decoded.id) {
        throw new Error('Token JWT invalide');
      }
      
      const userId = decoded.id;
      console.log(`🔐 JWT validé pour: ${decoded.username} (${userId})`);
      
      // ✅ NOUVEAU: Vérifier s'il y a déjà une session active pour cet utilisateur
      const existingSessionId = this.userSessions.get(userId);
      if (existingSessionId && existingSessionId !== client.sessionId) {
        console.log(`🔄 Utilisateur ${decoded.username} déjà connecté avec session ${existingSessionId}`);
        
        // Déconnecter l'ancienne session
        const existingPlayer = this.state.players.get(existingSessionId);
        if (existingPlayer) {
          console.log(`🚪 Déconnexion ancienne session ${existingSessionId} pour ${existingPlayer.username}`);
          this.state.players.delete(existingSessionId);
          this.userCache.delete(existingSessionId);
          
          // Essayer de fermer proprement l'ancienne connexion
          try {
            const existingClient = this.clients.find(c => c.sessionId === existingSessionId);
            if (existingClient) {
              existingClient.leave(4001, 'Nouvelle connexion détectée');
            }
          } catch (error) {
            console.warn(`⚠️ Erreur fermeture ancienne session:`, error);
          }
        }
        
        // Nettoyer le mapping
        this.userSessions.delete(userId);
      }
      
      // Charger le profil utilisateur
      const user = await this.loadUserProfile(userId);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }
      
      // Vérifier ban
      if (user.accountInfo?.isBanned) {
        const banMessage = user.accountInfo.banReason || 'Compte banni';
        console.log(`🚫 Utilisateur banni: ${user.username}`);
        throw new Error(`Compte banni: ${banMessage}`);
      }
      
      // Créer le joueur avec statut "connecting"
      const worldPlayer = new WorldPlayer();
      worldPlayer.userId = userId;
      worldPlayer.username = user.username;
      worldPlayer.level = user.playerStats.level;
      worldPlayer.trophies = user.playerStats.trophies;
      worldPlayer.currentArenaId = user.currentArenaId || 0;
      worldPlayer.status = "connecting";
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
      
      // ✅ NOUVEAU: Enregistrer le mapping userId -> sessionId
      this.userSessions.set(userId, client.sessionId);
      
      // Mettre à jour les stats
      this.updateGlobalStats();
      
      console.log(`✅ ${user.username} connecté (session: ${client.sessionId})`);
      
    } catch (error) {
      console.error(`❌ Erreur connexion ${client.sessionId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      client.leave(4000, `Erreur d'authentification: ${errorMessage}`);
    }
  }

  // ✅ Gérer le signal client prêt
  private async handleClientReady(client: Client, message: any) {
    const player = this.state.players.get(client.sessionId);
    if (!player) {
      console.error(`❌ Player non trouvé pour client_ready: ${client.sessionId}`);
      return;
    }
    
    console.log(`🤝 CLIENT READY: ${player.username} (${client.sessionId})`);
    
    // ✅ ATTENDRE UN PEU pour s'assurer que l'état est complètement synchronisé
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Changer le statut
    player.status = "ready";
    player.lastSeen = Date.now();
    
    // Confirmer au client
    client.send("server_ready", {
      timestamp: Date.now(),
      message: "Serveur prêt"
    });
    
    // ✅ ATTENDRE ENCORE UN PEU avant d'envoyer les données
    this.clock.setTimeout(async () => {
      await this.sendPlayerData(client, player);
      
      // Passer en idle
      if (player.status === "ready") {
        player.status = "idle";
        console.log(`✅ ${player.username} maintenant en statut "idle"`);
      }
    }, 200); // 200ms pour être sûr
  }
  
  // Envoyer les données du joueur
  private async sendPlayerData(client: Client, player: WorldPlayer) {
    try {
      const user = this.userCache.get(client.sessionId);
      if (!user) {
        console.error(`❌ User cache non trouvé pour ${player.username}`);
        return;
      }
      
      // ✅ VÉRIFIER que le client est toujours connecté avant d'envoyer
      if (!this.state.players.has(client.sessionId)) {
        console.warn(`⚠️ Client ${client.sessionId} plus dans l'état, annulation envoi`);
        return;
      }
      
      // Envoyer le profil complet
      client.send("player_profile", {
        profile: {
          userId: user._id.toString(),
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
      
      console.log(`📨 Profil envoyé à ${user.username}`);
      
    } catch (error) {
      console.error(`❌ Erreur envoi données player:`, error);
    }
  }
  
  // Vérifier si un joueur est prêt
  private isPlayerReady(player: WorldPlayer | undefined): boolean {
    if (!player) return false;
    return player.status !== "connecting";
  }

  // 🔐 VALIDATION JWT
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

  // 🚪 DÉCONNEXION - AVEC NETTOYAGE MAPPING
  onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    console.log(`🚪 Joueur ${player?.username || client.sessionId} quitte (${player?.status})`);
    
    // ✅ NOUVEAU: Nettoyer le mapping userId -> sessionId
    if (player?.userId) {
      const currentSessionForUser = this.userSessions.get(player.userId);
      if (currentSessionForUser === client.sessionId) {
        this.userSessions.delete(player.userId);
        console.log(`🧹 Mapping supprimé pour userId: ${player.userId}`);
      }
    }
    
    // Nettoyer les caches
    this.userCache.delete(client.sessionId);
    
    // Supprimer de l'état
    if (this.state.players.has(client.sessionId)) {
      this.state.players.delete(client.sessionId);
    }
    
    this.updateGlobalStats();
  }

  // ✅ NOUVEAU: Nettoyage des connexions orphelines
  private cleanupOrphanedConnections() {
    const orphanedSessions: string[] = [];
    
    // Vérifier les mappings userId -> sessionId
    for (const [userId, sessionId] of this.userSessions.entries()) {
      const player = this.state.players.get(sessionId);
      if (!player || player.userId !== userId) {
        orphanedSessions.push(sessionId);
        this.userSessions.delete(userId);
      }
    }
    
    if (orphanedSessions.length > 0) {
      console.log(`🧹 Nettoyage ${orphanedSessions.length} connexions orphelines:`, orphanedSessions);
    }
  }

  // HANDLERS DE MESSAGES (inchangés)
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
      client.send("error", { message: "Erreur infos arène" });
    }
  }

  private handleSearchBattle(client: Client, player: WorldPlayer) {
    console.log(`⚔️ ${player.username} recherche bataille`);
    
    if (player.status !== "idle") {
      client.send("search_error", { message: "Déjà en recherche ou en combat" });
      return;
    }
    
    player.status = "searching";
    this.updateGlobalStats();
    
    client.send("search_started", { 
      message: "Recherche adversaire...",
      estimatedTime: 30 
    });
    
    // Simulation match trouvé
    this.clock.setTimeout(() => {
      if (player.status === "searching") {
        this.simulateMatchFound(client, player);
      }
    }, Phaser.Math.Between(3000, 8000));
  }

  private simulateMatchFound(client: Client, player: WorldPlayer) {
    console.log(`🎯 Match trouvé pour ${player.username}`);
    
    player.status = "in_battle";
    
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
    
    // Simuler fin combat
    const battleDuration = Phaser.Math.Between(20000, 40000);
    this.clock.setTimeout(() => {
      this.simulateBattleEnd(client, player, Math.max(0, opponentTrophies));
    }, battleDuration);
  }

  private async simulateBattleEnd(client: Client, player: WorldPlayer, opponentTrophies: number) {
    const trophyDifference = opponentTrophies - player.trophies;
    let winChance = 0.5;
    
    if (trophyDifference > 100) winChance = 0.3;
    else if (trophyDifference < -100) winChance = 0.7;
    
    const isWin = Math.random() < winChance;
    const trophyChange = ArenaManager.calculateTrophyChange(player.trophies, opponentTrophies, isWin);
    
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
    
    const totalGames = player.wins + player.losses;
    player.winRate = totalGames > 0 ? Math.round((player.wins / totalGames) * 100) : 0;
    
    // Mise à jour BDD
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
      newArena: newArenaId !== oldArenaId ? ArenaManager.getArenaById(newArenaId) : null,
      rewards: {
        gold: baseGold + bonusGold,
        experience: baseExp,
        cards: isWin ? 1 : 0
      },
      battleDuration: "2:34",
      opponentTrophies
    });
    
    this.updateGlobalStats();
    
    console.log(`🏆 Combat ${player.username}: ${isWin ? 'Victoire' : 'Défaite'} (${trophyChange}) - ${player.trophies} total`);
  }

  private handleCancelSearch(client: Client, player: WorldPlayer) {
    if (player.status === "searching") {
      player.status = "idle";
      this.updateGlobalStats();
      client.send("search_cancelled", { message: "Recherche annulée" });
      console.log(`❌ ${player.username} recherche annulée`);
    } else {
      client.send("error", { message: "Aucune recherche à annuler" });
    }
  }

  private handleGetLeaderboard(client: Client, message: any) {
    const limit = Math.min(message.limit || 50, 100);
    
    const leaderboard = Array.from(this.state.players.values())
      .filter(p => p.status !== "connecting")
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
    
    console.log(`🏆 Leaderboard envoyé (${leaderboard.length} joueurs)`);
  }

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

  private handleHeartbeat(client: Client, player: WorldPlayer) {
    player.lastSeen = Date.now();
    client.send("heartbeat_ack", { 
      timestamp: Date.now(),
      serverTime: new Date().toISOString()
    });
  }

  // MISE À JOUR STATS GLOBALES
  private updateGlobalStats() {
    const now = Date.now();
    const players = Array.from(this.state.players.values());
    const readyPlayers = players.filter(p => p.status !== "connecting");
    
    this.state.totalPlayers = readyPlayers.length;
    this.state.playersOnline = readyPlayers.filter(p => now - p.lastSeen < 120000).length;
    this.state.playersSearching = readyPlayers.filter(p => p.status === "searching").length;
  }

  // NETTOYAGE
  private cleanupInactivePlayers() {
    const now = Date.now();
    const timeout = 10 * 60 * 1000; // 10 minutes
    const connectingTimeout = 2 * 60 * 1000; // 2 minutes pour connecting
    const cleaned: string[] = [];
    
    for (const [sessionId, player] of this.state.players.entries()) {
      const inactiveTime = now - player.lastSeen;
      const shouldClean = (
        (player.status === "connecting" && inactiveTime > connectingTimeout) ||
        (player.status !== "connecting" && inactiveTime > timeout)
      );
      
      if (shouldClean) {
        console.log(`🧹 Nettoyage ${player.username} (${player.status}, inactif ${Math.round(inactiveTime/60000)}min)`);
        
        // Nettoyer le mapping
        if (player.userId) {
          this.userSessions.delete(player.userId);
        }
        
        this.state.players.delete(sessionId);
        this.userCache.delete(sessionId);
        cleaned.push(player.username);
      }
    }
    
    if (cleaned.length > 0) {
      console.log(`🧹 ${cleaned.length} joueur(s) nettoyé(s): ${cleaned.join(', ')}`);
      this.updateGlobalStats();
    }
  }

  // MÉTHODES UTILITAIRES (inchangées)
  private async loadUserProfile(userId: string): Promise<any> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error(`Utilisateur ${userId} non trouvé`);
      }
      
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

  private async updateUserInDatabase(userId: string, updates: any): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        console.warn(`⚠️ Utilisateur ${userId} non trouvé pour mise à jour`);
        return;
      }
      
      if (updates.trophies !== undefined) {
        const result = await user.updateArena(updates.trophies, updates.isWin ? 'win' : 'loss');
        if (result.arenaChanged) {
          console.log(`🏟️ ${user.username} changement arène: ${result.newArena?.nameId}`);
        }
      }
      
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
        
        if (user.seasonStats) {
          if (updates.isWin) {
            user.seasonStats.wins++;
          } else {
            user.seasonStats.losses++;
          }
        }
      }
      
      await user.save();
      console.log(`💾 Profil mis à jour pour ${user.username}`);
      
    } catch (error) {
      console.error(`❌ Erreur mise à jour profil ${userId}:`, error);
    }
  }

  onError(client: Client, error: Error) {
    console.error(`🔧 Erreur client ${client.sessionId}:`, error);
    client.send("error", { 
      message: "Erreur serveur", 
      code: "INTERNAL_ERROR",
      timestamp: Date.now()
    });
  }

  onDispose() {
    console.log('🗑️ WorldRoom fermée');
    this.userCache.clear();
    this.userSessions.clear(); // ✅ NOUVEAU: Nettoyer le mapping
    console.log('✅ WorldRoom nettoyée');
  }
}

// FALLBACK PHASER.MATH
declare global {
  namespace Phaser {
    namespace Math {
      function Between(min: number, max: number): number;
    }
  }
}

if (typeof Phaser === 'undefined') {
  (global as any).Phaser = {
    Math: {
      Between: (min: number, max: number): number => {
        return Math.floor(Math.random() * (max - min + 1)) + min;
      }
    }
  };
}
