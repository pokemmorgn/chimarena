import { Schema, type } from "@colyseus/schema";

export class WorldPlayer extends Schema {
  @type("string") userId = "";
  @type("string") username = "";
  @type("number") level = 1;
  @type("number") trophies = 0;
  @type("number") currentArenaId = 0;
  @type("string") status = "idle"; // idle, searching, in_battle
  @type("number") lastSeen = Date.now();
  @type("number") wins = 0;
  @type("number") losses = 0;
  @type("number") winRate = 0;
}
