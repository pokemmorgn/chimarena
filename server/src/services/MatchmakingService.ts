// server/src/services/MatchmakingService.ts - SERVICE DE MATCHMAKING AVANCÉ CORRIGÉ
import { EventEmitter } from 'events';
import { ArenaManager, Arena } from '../config/arenas';

// 🎯 TYPES POUR LE MATCHMAKING
export interface MatchmakingPlayer {
  sessionId: string;
  userId: string;
  username: string;
  level: number;
  trophies: number;
  arenaId: number;
  winRate: number;
  deck: string[];
  preferredGameMode: 'ranked' | 'casual' | 'tournament';
  region: string;
  joinedAt: number;
  estimatedWaitTime: number;
  searchAttempts: number;
}

export interface MatchmakingCriteria {
  maxTrophyDifference: number;
  maxLevelDifference: number;
  maxWaitTime: number;
  preferSameArena: boolean;
  regionPriority: boolean;
}

export interface MatchResult {
  player1: MatchmakingPlayer;
  player2: MatchmakingPlayer;
  matchQuality: number; // 0-100
  estimatedBalance: number; // Probabilité de victoire du player1 (0-100)
  battleRoomId: string;
  arena: Arena;
  timestamp: number;
}

export interface MatchmakingStats {
  totalPlayersInQueue: number;
  averageWaitTime: number;
  matchesPerMinute: number;
  queuesByArena: { [arenaId: number]: number };
  successRate: number;
}

// 🎮 SERVICE DE MATCHMAKING PRINCIPAL
export class MatchmakingService extends EventEmitter {
  private queue: Map<string, MatchmakingPlayer> = new Map();
  private activeMatches: Map<string, MatchResult> = new Map();
  private matchHistory: MatchResult[] = [];
  
  // Configuration dynamique
  private config: MatchmakingCriteria = {
    maxTrophyDifference: 200,
    maxLevelDifference: 3,
    maxWaitTime: 60000, // 60 secondes
    preferSameArena: true,
    regionPriority: true
  };
  
  // Stats en temps réel
  private stats: MatchmakingStats = {
    totalPlayersInQueue: 0,
    averageWaitTime: 0,
    matchesPerMinute: 0,
    queuesByArena: {},
    successRate: 0
  };
  
  // Timers et intervalles
  private matchmakingInterval: NodeJS.Timeout | null = null;
  private statsUpdateInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    this.startMatchmakingLoop();
    this.startStatsTracking();
    
    console.log('🎯 MatchmakingService initialisé');
  }

  // === GESTION DE LA FILE D'ATTENTE ===
  
  /**
   * Ajouter un joueur à la file d'attente
   */
  addPlayer(player: MatchmakingPlayer): boolean {
    try {
      // Vérifications de base
      if (this.queue.has(player.sessionId)) {
        console.warn(`⚠️ Joueur ${player.username} déjà en file`);
        return false;
      }
      
      if (!this.isValidPlayer(player)) {
        console.warn(`⚠️ Joueur ${player.username} invalide pour matchmaking`);
        return false;
      }
      
      // Initialiser les données de matchmaking
      player.joinedAt = Date.now();
      player.estimatedWaitTime = this.calculateEstimatedWaitTime(player);
      player.searchAttempts = 0;
      
      // Ajouter à la file
      this.queue.set(player.sessionId, player);
      
      // Mettre à jour les stats
      this.updateQueueStats();
      
      console.log(`✅ ${player.username} ajouté au matchmaking (${player.trophies} trophées, Arène ${player.arenaId})`);
      
      // Événement
      this.emit('playerJoined', player);
      
      return true;
      
    } catch (error) {
      console.error('❌ Erreur ajout joueur au matchmaking:', error);
      return false;
    }
  }
  
  /**
   * Retirer un joueur de la file d'attente
   */
  removePlayer(sessionId: string): boolean {
    try {
      const player = this.queue.get(sessionId);
      if (!player) {
        return false;
      }
      
      // Calculer le temps d'attente pour les stats
      const waitTime = Date.now() - player.joinedAt;
      
      // Retirer de la file
      this.queue.delete(sessionId);
      
      // Mettre à jour les stats
      this.updateQueueStats();
      
      console.log(`❌ ${player.username} retiré du matchmaking (attente: ${Math.round(waitTime/1000)}s)`);
      
      // Événement
      this.emit('playerLeft', { player, waitTime });
      
      return true;
      
    } catch (error) {
      console.error('❌ Erreur retrait joueur du matchmaking:', error);
      return false;
    }
  }
  
  /**
   * Obtenir un joueur de la file
   */
  getPlayer(sessionId: string): MatchmakingPlayer | null {
    return this.queue.get(sessionId) || null;
  }
  
  /**
   * Obtenir tous les joueurs de la file
   */
  getAllPlayers(): MatchmakingPlayer[] {
    return Array.from(this.queue.values());
  }

  // === ALGORITHME DE MATCHMAKING ===
  
  /**
   * Boucle principale de matchmaking
   */
  private startMatchmakingLoop(): void {
    this.matchmakingInterval = setInterval(() => {
      this.processMatchmaking();
    }, 2000); // Toutes les 2 secondes
  }
  
  /**
   * Traiter le matchmaking
   */
  private async processMatchmaking(): Promise<void> {
    if (this.queue.size < 2) {
      return; // Pas assez de joueurs
    }
    
    const players = Array.from(this.queue.values());
    const matches: MatchResult[] = [];
    const usedPlayers = new Set<string>();
    
    // Trier par temps d'attente (priorité aux plus anciens)
    players.sort((a, b) => a.joinedAt - b.joinedAt);
    
    for (const player1 of players) {
      if (usedPlayers.has(player1.sessionId)) {
        continue;
      }
      
      // Chercher le meilleur adversaire
      const opponent = this.findBestOpponent(player1, players, usedPlayers);
      
      if (opponent) {
        // Créer le match
        const match = await this.createMatch(player1, opponent);
        matches.push(match);
        
        // Marquer les joueurs comme utilisés
        usedPlayers.add(player1.sessionId);
        usedPlayers.add(opponent.sessionId);
        
        // Retirer de la file
        this.queue.delete(player1.sessionId);
        this.queue.delete(opponent.sessionId);
        
        console.log(`🎯 Match créé: ${player1.username} vs ${opponent.username} (qualité: ${match.matchQuality}%)`);
      }
    }
    
    // Traiter les matchs créés
    for (const match of matches) {
      this.activeMatches.set(match.battleRoomId, match);
      this.matchHistory.push(match);
      
      // Garder seulement les 1000 derniers matchs en historique
      if (this.matchHistory.length > 1000) {
        this.matchHistory = this.matchHistory.slice(-1000);
      }
      
      // Événement match trouvé
      this.emit('matchFound', match);
    }
    
    // Gérer les joueurs en attente trop longtemps
    this.handleLongWaitingPlayers();
    
    // Mettre à jour les stats
    this.updateQueueStats();
  }
  
  /**
   * Trouver le meilleur adversaire pour un joueur
   */
  private findBestOpponent(
    player: MatchmakingPlayer,
    candidates: MatchmakingPlayer[],
    usedPlayers: Set<string>
  ): MatchmakingPlayer | null {
    
    let bestOpponent: MatchmakingPlayer | null = null;
    let bestScore = -1;
    
    // Critères adaptatifs selon le temps d'attente
    const waitTime = Date.now() - player.joinedAt;
    const relaxedCriteria = this.getRelaxedCriteria(waitTime);
    
    for (const candidate of candidates) {
      // Vérifications de base
      if (usedPlayers.has(candidate.sessionId) || candidate.sessionId === player.sessionId) {
        continue;
      }
      
      // Vérifier les critères de base
      if (!this.matchesCriteria(player, candidate, relaxedCriteria)) {
        continue;
      }
      
      // Calculer le score de compatibilité
      const score = this.calculateMatchScore(player, candidate);
      
      if (score > bestScore) {
        bestScore = score;
        bestOpponent = candidate;
      }
    }
    
    // Accepter le match si le score est suffisant ou si l'attente est longue
    const minScore = waitTime > 30000 ? 50 : 70; // Score minimum plus bas après 30s
    
    if (bestOpponent && bestScore >= minScore) {
      return bestOpponent;
    }
    
    return null;
  }
  
  /**
   * Vérifier si deux joueurs correspondent aux critères
   */
  private matchesCriteria(
    player1: MatchmakingPlayer,
    player2: MatchmakingPlayer,
    criteria: MatchmakingCriteria
  ): boolean {
    
    // Différence de trophées
    const trophyDiff = Math.abs(player1.trophies - player2.trophies);
    if (trophyDiff > criteria.maxTrophyDifference) {
      return false;
    }
    
    // Différence de niveau
    const levelDiff = Math.abs(player1.level - player2.level);
    if (levelDiff > criteria.maxLevelDifference) {
      return false;
    }
    
    // Mode de jeu préféré
    if (player1.preferredGameMode !== player2.preferredGameMode) {
      return false;
    }
    
    // Arène (préférence, pas obligatoire)
    if (criteria.preferSameArena && player1.arenaId !== player2.arenaId) {
      const arenaScore = this.calculateArenaCompatibility(player1.arenaId, player2.arenaId);
      if (arenaScore < 50) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Calculer le score de compatibilité entre deux joueurs
   */
  private calculateMatchScore(player1: MatchmakingPlayer, player2: MatchmakingPlayer): number {
    let score = 100;
    
    // Facteur trophées (plus important)
    const trophyDiff = Math.abs(player1.trophies - player2.trophies);
    const trophyScore = Math.max(0, 100 - (trophyDiff / 10)); // 10 trophées = 1 point
    score = score * 0.4 + trophyScore * 0.4;
    
    // Facteur niveau
    const levelDiff = Math.abs(player1.level - player2.level);
    const levelScore = Math.max(0, 100 - (levelDiff * 20)); // 1 niveau = 20 points
    score = score * 0.8 + levelScore * 0.2;
    
    // Facteur winRate (équilibrage)
    const winRateDiff = Math.abs(player1.winRate - player2.winRate);
    const winRateScore = Math.max(0, 100 - winRateDiff); // 1% = 1 point
    score = score * 0.9 + winRateScore * 0.1;
    
    // Bonus arène identique
    if (player1.arenaId === player2.arenaId) {
      score += 10;
    }
    
    // Bonus région identique
    if (player1.region === player2.region) {
      score += 5;
    }
    
    // Malus temps d'attente (encourage les matchs rapides)
    const avgWaitTime = (Date.now() - player1.joinedAt + Date.now() - player2.joinedAt) / 2;
    if (avgWaitTime > 30000) {
      score += Math.min(20, avgWaitTime / 5000); // Bonus progressif après 30s
    }
    
    return Math.min(100, Math.max(0, score));
  }
  
  /**
   * Créer un match entre deux joueurs
   */
  private async createMatch(player1: MatchmakingPlayer, player2: MatchmakingPlayer): Promise<MatchResult> {
    const battleRoomId = `battle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Choisir l'arène (celle du joueur avec le plus de trophées)
    const arena = player1.trophies >= player2.trophies ? 
      ArenaManager.getArenaById(player1.arenaId) || ArenaManager.getAllArenas()[0] :
      ArenaManager.getArenaById(player2.arenaId) || ArenaManager.getAllArenas()[0];
    
    // Calculer la qualité du match
    const matchQuality = this.calculateMatchScore(player1, player2);
    
    // Calculer l'équilibre estimé
    const estimatedBalance = this.calculateWinProbability(player1, player2);
    
    const match: MatchResult = {
      player1,
      player2,
      matchQuality,
      estimatedBalance,
      battleRoomId,
      arena,
      timestamp: Date.now()
    };
    
    return match;
  }

  // === UTILITAIRES ET CALCULS ===
  
  /**
   * Calculer la probabilité de victoire du joueur 1
   */
  private calculateWinProbability(player1: MatchmakingPlayer, player2: MatchmakingPlayer): number {
    let probability = 50; // Base 50/50
    
    // Facteur trophées (le plus important)
    const trophyDiff = player1.trophies - player2.trophies;
    probability += trophyDiff * 0.05; // 20 trophées = 1% de différence
    
    // Facteur niveau
    const levelDiff = player1.level - player2.level;
    probability += levelDiff * 2; // 1 niveau = 2%
    
    // Facteur winRate
    const winRateDiff = player1.winRate - player2.winRate;
    probability += winRateDiff * 0.2; // 5% winRate = 1%
    
    // Limiter entre 10% et 90%
    return Math.min(90, Math.max(10, probability));
  }
  
  /**
   * Obtenir des critères relaxés selon le temps d'attente
   */
  private getRelaxedCriteria(waitTime: number): MatchmakingCriteria {
    const baseConfig = { ...this.config };
    
    // Après 30 secondes, commencer à relaxer
    if (waitTime > 30000) {
      const multiplier = 1 + (waitTime - 30000) / 60000; // +100% après 90s
      baseConfig.maxTrophyDifference *= Math.min(3, multiplier);
      baseConfig.maxLevelDifference = Math.min(10, Math.ceil(baseConfig.maxLevelDifference * multiplier));
      baseConfig.preferSameArena = false;
    }
    
    // Après 60 secondes, relaxer encore plus
    if (waitTime > 60000) {
      baseConfig.regionPriority = false;
    }
    
    return baseConfig;
  }
  
  /**
   * Calculer la compatibilité entre arènes
   */
  private calculateArenaCompatibility(arena1: number, arena2: number): number {
    const diff = Math.abs(arena1 - arena2);
    return Math.max(0, 100 - (diff * 25)); // 1 arène de différence = 25 points
  }
  
  /**
   * Calculer le temps d'attente estimé
   */
  private calculateEstimatedWaitTime(player: MatchmakingPlayer): number {
    const baseTime = 30000; // 30 secondes de base
    
    // Plus de trophées = plus d'attente (moins de joueurs à ce niveau)
    const trophyFactor = Math.max(1, player.trophies / 1000);
    
    // Heure de pointe vs heure creuse
    const hour = new Date().getHours();
    const peakHours = (hour >= 18 && hour <= 22) || (hour >= 12 && hour <= 14);
    const timeFactor = peakHours ? 0.7 : 1.5;
    
    // Nombre de joueurs dans la même arène
    const arenaQueue = this.stats.queuesByArena[player.arenaId] || 0;
    const queueFactor = arenaQueue > 10 ? 0.8 : 1.2;
    
    return Math.round(baseTime * trophyFactor * timeFactor * queueFactor);
  }
  
  /**
   * Valider qu'un joueur est valide pour le matchmaking
   */
  private isValidPlayer(player: MatchmakingPlayer): boolean {
    // ✅ CORRECTION: Vérifications explicites avec types corrects
    if (!player.sessionId || typeof player.sessionId !== 'string') return false;
    if (!player.userId || typeof player.userId !== 'string') return false;
    if (!player.username || typeof player.username !== 'string') return false;
    if (typeof player.level !== 'number' || player.level < 1) return false;
    if (typeof player.trophies !== 'number' || player.trophies < 0) return false;
    if (typeof player.arenaId !== 'number' || player.arenaId < 0) return false;
    if (typeof player.winRate !== 'number' || player.winRate < 0 || player.winRate > 100) return false;
    if (!Array.isArray(player.deck) || player.deck.length === 0) return false;
    if (!['ranked', 'casual', 'tournament'].includes(player.preferredGameMode)) return false;
    
    return true;
  }
  
  /**
   * Gérer les joueurs en attente trop longtemps
   */
  private handleLongWaitingPlayers(): void {
    const maxWaitTime = this.config.maxWaitTime * 2; // Double du temps normal
    const now = Date.now();
    
    for (const [sessionId, player] of this.queue) {
      const waitTime = now - player.joinedAt;
      
      if (waitTime > maxWaitTime) {
        console.warn(`⏰ Joueur ${player.username} en attente depuis ${Math.round(waitTime/1000)}s`);
        
        // Augmenter le nombre de tentatives
        player.searchAttempts++;
        
        // Si trop de tentatives, proposer un match contre IA
        if (player.searchAttempts >= 3) {
          this.emit('suggestBotMatch', player);
        }
      }
      
      // Mettre à jour le temps d'attente estimé
      if (waitTime > player.estimatedWaitTime) {
        player.estimatedWaitTime = this.calculateEstimatedWaitTime(player);
        this.emit('waitTimeUpdated', player);
      }
    }
  }

  // === GESTION DES STATS ===
  
  /**
   * Démarrer le suivi des statistiques
   */
  private startStatsTracking(): void {
    this.statsUpdateInterval = setInterval(() => {
      this.updateStats();
    }, 10000); // Toutes les 10 secondes
  }
  
  /**
   * Mettre à jour les statistiques globales
   */
  private updateStats(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    // Compter les matchs récents
    const recentMatches = this.matchHistory.filter(m => m.timestamp > oneMinuteAgo);
    
    // Calculer le temps d'attente moyen
    const waitTimes = Array.from(this.queue.values()).map(p => now - p.joinedAt);
    const avgWaitTime = waitTimes.length > 0 ? 
      waitTimes.reduce((sum, time) => sum + time, 0) / waitTimes.length : 0;
    
    // Calculer le taux de succès
    const totalAttempts = this.queue.size + recentMatches.length * 2;
    const successRate = totalAttempts > 0 ? (recentMatches.length * 2) / totalAttempts * 100 : 0;
    
    this.stats = {
      totalPlayersInQueue: this.queue.size,
      averageWaitTime: Math.round(avgWaitTime / 1000), // en secondes
      matchesPerMinute: recentMatches.length,
      queuesByArena: this.getQueuesByArena(),
      successRate: Math.round(successRate)
    };
  }
  
  /**
   * Mettre à jour les stats de file d'attente
   */
  private updateQueueStats(): void {
    this.stats.totalPlayersInQueue = this.queue.size;
    this.stats.queuesByArena = this.getQueuesByArena();
  }
  
  /**
   * Obtenir la répartition des joueurs par arène
   */
  private getQueuesByArena(): { [arenaId: number]: number } {
    const distribution: { [arenaId: number]: number } = {};
    
    for (const player of this.queue.values()) {
      distribution[player.arenaId] = (distribution[player.arenaId] || 0) + 1;
    }
    
    return distribution;
  }

  // === API PUBLIQUE ===
  
  /**
   * Obtenir les statistiques actuelles
   */
  getStats(): MatchmakingStats {
    return { ...this.stats };
  }
  
  /**
   * Obtenir la configuration actuelle
   */
  getConfig(): MatchmakingCriteria {
    return { ...this.config };
  }
  
  /**
   * Mettre à jour la configuration
   */
  updateConfig(newConfig: Partial<MatchmakingCriteria>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Configuration matchmaking mise à jour:', this.config);
  }
  
  /**
   * Obtenir l'historique des matchs récents
   */
  getRecentMatches(count: number = 10): MatchResult[] {
    return this.matchHistory.slice(-count);
  }
  
  /**
   * Marquer un match comme terminé
   */
  completeMatch(battleRoomId: string): void {
    this.activeMatches.delete(battleRoomId);
  }
  
  /**
   * Obtenir un match actif
   */
  getActiveMatch(battleRoomId: string): MatchResult | null {
    return this.activeMatches.get(battleRoomId) || null;
  }
  
  /**
   * Obtenir le nombre de matchs actifs
   */
  getActiveMatchesCount(): number {
    return this.activeMatches.size;
  }

  // === NETTOYAGE ===
  
  /**
   * Arrêter le service de matchmaking
   */
  stop(): void {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
      this.matchmakingInterval = null;
    }
    
    if (this.statsUpdateInterval) {
      clearInterval(this.statsUpdateInterval);
      this.statsUpdateInterval = null;
    }
    
    this.queue.clear();
    this.activeMatches.clear();
    
    console.log('🛑 MatchmakingService arrêté');
  }
  
  /**
   * Diagnostic du service
   */
  getDiagnostic(): object {
    return {
      queueSize: this.queue.size,
      activeMatches: this.activeMatches.size,
      totalMatches: this.matchHistory.length,
      config: this.config,
      stats: this.stats,
      uptime: process.uptime()
    };
  }
}

export default MatchmakingService;
