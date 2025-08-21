import { Schema, type } from "@colyseus/schema";

export class WorldPlayer extends Schema {
  constructor() {
    super();
    this.userId = "";
    this.username = "";
    this.level = 1;
    this.trophies = 0;
    this.currentArenaId = 0;
    this.status = "idle"; // idle, searching, in_battle
    this.lastSeen = Date.now();
    this.wins = 0;
    this.losses = 0;
    this.winRate = 0;
  }
}

// ⚡ Appliquer les annotations avec la syntaxe fonctionnelle
type("string")(WorldPlayer.prototype, "userId");
type("string")(WorldPlayer.prototype, "username");
type("number")(WorldPlayer.prototype, "level");
type("number")(WorldPlayer.prototype, "trophies");
type("number")(WorldPlayer.prototype, "currentArenaId");
type("string")(WorldPlayer.prototype, "status");
type("number")(WorldPlayer.prototype, "lastSeen");
type("number")(WorldPlayer.prototype, "wins");
type("number")(WorldPlayer.prototype, "losses");
type("number")(WorldPlayer.prototype, "winRate");
