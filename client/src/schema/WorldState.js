import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

export class WorldPlayer extends Schema {
  constructor() {
    super();
    this.userId = "";
    this.username = "";
    this.level = 1;
    this.trophies = 0;
    this.currentArenaId = 0;
    this.status = "idle";
    this.lastSeen = 0;

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

export class WorldState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
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
