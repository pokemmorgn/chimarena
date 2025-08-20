import path from "path";
import fs from "fs";
import dotenv from "dotenv";
console.log("📁 CWD =", process.cwd());

dotenv.config({ path: path.join(__dirname, "../.env") });

console.log("=== CONFIG ENV ===");
console.log("- .env path:", path.join(__dirname, "../.env"));
console.log("- Existe:", fs.existsSync(path.join(__dirname, "../.env")));
console.log("- Mongo:", process.env.MONGODB_URI ? "✅" : "❌");
console.log("- JWT_ACCESS_SECRET:", process.env.JWT_ACCESS_SECRET ? "✅" : "❌");
console.log("- JWT_REFRESH_SECRET:", process.env.JWT_REFRESH_SECRET ? "✅" : "❌");
console.log("- PORT:", process.env.PORT || "2567");

import { listen } from "@colyseus/tools";
import config from "./app.config";

const port = parseInt(process.env.PORT || "2567", 10);

listen(config, port).then(() => {
  console.log(`✅ Serveur Colyseus démarré sur :${port}`);
});
