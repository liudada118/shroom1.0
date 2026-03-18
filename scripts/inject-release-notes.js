"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(projectRoot, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = packageJson.version;
const latestYmlPath = path.join(projectRoot, "dist", "latest.yml");
const releaseNotesPath = path.join(
  projectRoot,
  "release-notes",
  "windows",
  `${version}.md`
);

function toYamlLiteralBlock(text) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    throw new Error(`release notes file is empty: ${releaseNotesPath}`);
  }

  return normalized
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function main() {
  if (!fs.existsSync(latestYmlPath)) {
    throw new Error(`latest.yml not found: ${latestYmlPath}`);
  }

  if (!fs.existsSync(releaseNotesPath)) {
    throw new Error(
      `release notes file not found: ${releaseNotesPath}. Create release-notes/windows/${version}.md before building.`
    );
  }

  const latestYml = fs.readFileSync(latestYmlPath, "utf8").replace(/\r\n/g, "\n");
  const releaseNotes = fs.readFileSync(releaseNotesPath, "utf8");
  const releaseNotesBlock = `releaseNotes: |-\n${toYamlLiteralBlock(releaseNotes)}\n`;
  const nextYml = /^releaseNotes:\s*\|-/m.test(latestYml)
    ? latestYml.replace(/^releaseNotes:\s*\|-[\s\S]*$/m, releaseNotesBlock.trimEnd())
    : `${latestYml.trimEnd()}\n${releaseNotesBlock}`;

  fs.writeFileSync(latestYmlPath, nextYml, "utf8");
  console.log(`[pack] injected release notes -> ${latestYmlPath}`);
  console.log(`[pack] release notes source -> ${releaseNotesPath}`);
}

try {
  main();
} catch (error) {
  console.error(`[pack] release notes error: ${error.message}`);
  process.exit(1);
}
