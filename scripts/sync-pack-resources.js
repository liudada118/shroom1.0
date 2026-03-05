const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const sourceInitDb = path.join(projectRoot, "db", "init.db");
const targetDir = path.join(projectRoot, "pack-resources", "db");
const targetInitDb = path.join(targetDir, "init.db");

if (!fs.existsSync(sourceInitDb)) {
  throw new Error(`source init.db not found: ${sourceInitDb}`);
}

fs.mkdirSync(targetDir, { recursive: true });
fs.copyFileSync(sourceInitDb, targetInitDb);

console.log(`[pack] synced init.db -> ${targetInitDb}`);
