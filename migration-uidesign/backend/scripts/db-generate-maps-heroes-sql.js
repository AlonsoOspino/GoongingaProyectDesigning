const fs = require("node:fs");
const path = require("node:path");

const TYPE_ALIASES = {
  CONTROL: "CONTROL",
  HYBRID: "HYBRID",
  PAYLOAD: "PAYLOAD",
  PLAYLOAD: "PAYLOAD",
  ESCORT: "PAYLOAD",
  PUSH: "PUSH",
  FLASHPOINT: "FLASHPOINT",
};

const heroRoleByName = {
  ANA: "SUPPORT",
  ANRAN: "DPS",
  ASHE: "DPS",
  BAPTISTE: "SUPPORT",
  BASTION: "DPS",
  BRIGITTE: "SUPPORT",
  CASSIDY: "DPS",
  DOMINA: "TANK",
  DVA: "TANK",
  DOOMFIST: "TANK",
  ECHO: "DPS",
  EMRE: "DPS",
  FREJA: "DPS",
  GENJI: "DPS",
  HANZO: "DPS",
  HAZARD: "TANK",
  ILLARI: "SUPPORT",
  JETPACKCAT: "SUPPORT",
  JUNKERQUEEN: "TANK",
  JUNKRAT: "DPS",
  JUNO: "SUPPORT",
  KIRIKO: "SUPPORT",
  LIFEWEAVER: "SUPPORT",
  LUCIO: "SUPPORT",
  MAUGA: "TANK",
  MEI: "DPS",
  MERCY: "SUPPORT",
  MIZUKI: "SUPPORT",
  MOIRA: "SUPPORT",
  ORISA: "TANK",
  PHARAH: "DPS",
  RAMATTRA: "TANK",
  REAPER: "DPS",
  REINHARDT: "TANK",
  ROADHOG: "TANK",
  SIERRA: "DPS",
  SIGMA: "TANK",
  SOJOURN: "DPS",
  SOLDIER76: "DPS",
  SOMBRA: "DPS",
  SYMMETRA: "DPS",
  TORBJORN: "DPS",
  TRACER: "DPS",
  VENDETTA: "DPS",
  VENTURE: "DPS",
  WIDOWMAKER: "DPS",
  WINSTON: "TANK",
  WRECKINGBALL: "TANK",
  WUYANG: "SUPPORT",
  ZARYA: "TANK",
  ZENYATTA: "SUPPORT",
};

const heroDisplayNameByKey = {
  DVA: "D.Va",
  JETPACKCAT: "Jetpack Cat",
  JUNKERQUEEN: "Junker Queen",
  KIRIKO: "Kiriko",
  SOLDIER76: "Soldier: 76",
  SIERRA: "Sierra",
  TORBJORN: "Torbjorn",
  WRECKINGBALL: "Wrecking Ball",
};

function escapeSql(value) {
  return String(value).replace(/'/g, "''");
}

function toTitleCaseWords(text) {
  return text
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^[0-9]+$/.test(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function normalizeMapName(rawName) {
  const withSpaces = rawName
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])([0-9])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  const compact = withSpaces.replace(/\s+/g, "").toLowerCase();

  if (compact === "kingsrow") return "King's Row";
  if (compact === "route66") return "Route 66";
  if (compact === "eichenwalde") return "Eichenwalde";
  if (compact === "atlis") return "Atlas";
  if (compact === "shambali") return "Shambali Monastery";

  return toTitleCaseWords(withSpaces);
}

function parseMap(fileName, id) {
  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  const parts = baseName.split("_").filter(Boolean);

  if (parts.length < 2) {
    throw new Error(`Cannot infer map type from file name: ${fileName}`);
  }

  const rawType = parts[parts.length - 1].toUpperCase();
  const type = TYPE_ALIASES[rawType];

  if (!type) {
    throw new Error(`Unknown map type "${rawType}" in file name: ${fileName}`);
  }

  return {
    id,
    type,
    description: normalizeMapName(parts.slice(0, -1).join("_")),
    imgPath: `/MapImages/${fileName}`,
  };
}

function normalizeHeroKey(name) {
  return String(name || "")
    .replace(/%3F/gi, "o")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function parseHeroName(fileName) {
  return String(fileName || "")
    .replace(/^Icon-/i, "")
    .replace(/-Icon\.[^.]+$/i, "")
    .replace(/\.[^.]+$/, "")
    .replace(/%3F/gi, "o")
    .replace(/_/g, " ");
}

function parseHero(fileName, id) {
  const parsedName = parseHeroName(fileName);
  const key = normalizeHeroKey(parsedName);
  const role = heroRoleByName[key];

  if (!role) {
    throw new Error(`Unknown hero role for ${fileName} (normalized key: ${key})`);
  }

  return {
    id,
    name: heroDisplayNameByKey[key] || parsedName,
    role,
    imgPath: `/HeroImages/${fileName}`,
  };
}

function readImageFileNames(directory) {
  if (!fs.existsSync(directory)) {
    throw new Error(`Directory not found: ${directory}`);
  }

  return fs
    .readdirSync(directory)
    .filter((file) => /\.(avif|webp|png|jpe?g)$/i.test(file))
    .sort((a, b) => a.localeCompare(b));
}

function insertMapSql(map) {
  return `INSERT INTO "Map" ("id", "type", "description", "imgPath") VALUES (${map.id}, '${map.type}', '${escapeSql(map.description)}', '${escapeSql(map.imgPath)}');`;
}

function insertHeroSql(hero) {
  return `INSERT INTO "Hero" ("id", "name", "role", "imgPath", "heroGift") VALUES (${hero.id}, '${escapeSql(hero.name)}', '${hero.role}', '${escapeSql(hero.imgPath)}', NULL);`;
}

async function main() {
  const outputPath = process.argv[2] || path.resolve(process.cwd(), "backups/seed-maps-heroes-from-assets.sql");
  const mapsDir = path.resolve(__dirname, "../../frontend/MapImages");
  const heroesDir = path.resolve(__dirname, "../../frontend/HeroImages");

  const maps = readImageFileNames(mapsDir).map((fileName, index) => parseMap(fileName, index + 1));
  const heroes = readImageFileNames(heroesDir).map((fileName, index) => parseHero(fileName, index + 1));

  const lines = [
    "-- Generated from frontend/MapImages and frontend/HeroImages.",
    "-- Rebuilds only Map and Hero content.",
    "BEGIN;",
    'DELETE FROM "_AllowedMaps";',
    'DELETE FROM "Map";',
    'DELETE FROM "Hero";',
    "-- Maps",
    ...maps.map(insertMapSql),
    "-- Heroes",
    ...heroes.map(insertHeroSql),
    `SELECT setval(pg_get_serial_sequence('"Map"', 'id'), ${maps.length}, true);`,
    `SELECT setval(pg_get_serial_sequence('"Hero"', 'id'), ${heroes.length}, true);`,
    "COMMIT;",
    "",
  ];

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
  console.log(`Wrote ${maps.length} maps and ${heroes.length} heroes to ${outputPath}`);
}

main();
