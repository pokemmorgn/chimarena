import { Schema, type, MapSchema } from "@colyseus/schema";
import { WorldPlayer } from "./WorldPlayer.js";

export class WorldState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.totalPlayers = 0;
    this.playersOnline = 0;
    this.playersSearching = 0;
  }
}

// ⚡ Appliquer les annotations avec la syntaxe fonctionnelle
type({ map: WorldPlayer })(WorldState.prototype, "players");
type("number")(WorldState.prototype, "totalPlayers");
type("number")(WorldState.prototype, "playersOnline");
type("number")(WorldState.prototype, "playersSearching");
