import { Schema, type, MapSchema } from "@colyseus/schema";
import { WorldPlayer } from "./WorldPlayer.js";

export class WorldState extends Schema {
  @type({ map: WorldPlayer }) players = new MapSchema();
  @type("number") totalPlayers = 0;
  @type("number") playersOnline = 0;
  @type("number") playersSearching = 0;
}
