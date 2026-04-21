const fs = require("node:fs");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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
  ASHE: "DPS",
  BAPTISTE: "SUPPORT",
  BASTION: "DPS",
  BRIGITTE: "SUPPORT",
  CASSIDY: "DPS",
  DVA: "TANK",
  DOOMFIST: "TANK",
  ECHO: "DPS",
  GENJI: "DPS",
  HANZO: "DPS",
  HAZARD: "TANK",
  ILLARI: "SUPPORT",
  JUNKERQUEEN: "TANK",
  JUNKRAT: "DPS",
  JUNO: "SUPPORT",
  KIRIKO: "SUPPORT",
  LIFEWEAVER: "SUPPORT",
  LUCIO: "SUPPORT",
  MAUGA: "TANK",
  MEI: "DPS",
  MERCY: "SUPPORT",
  MOIRA: "SUPPORT",
  ORISA: "TANK",
  PHARAH: "DPS",
  RAMATTRA: "TANK",
  REAPER: "DPS",
  REINHARDT: "TANK",
  ROADHOG: "TANK",
  SIGMA: "TANK",
  SOJOURN: "DPS",
  SOLDIER76: "DPS",
  SOMBRA: "DPS",
  SYMMETRA: "DPS",
  TORBJORN: "DPS",
  TRACER: "DPS",
  VENTURE: "DPS",
  WIDOWMAKER: "DPS",
  WINSTON: "TANK",
  WRECKINGBALL: "TANK",
  ZARYA: "TANK",
  ZENYATTA: "SUPPORT",
};

const heroDisplayNameByKey = {
  DVA: "D.Va",
  JUNKERQUEEN: "Junker Queen",
  SOLDIER76: "Soldier: 76",
  TORBJORN: "Torbjorn",
  WRECKINGBALL: "Wrecking Ball",
};

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

function parseMapFromFileName(fileName) {
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

  const rawName = parts.slice(0, -1).join("_");
  const description = normalizeMapName(rawName);

  return {
    type,
    description,
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
    .replace(/\.[^.]+$/, "")
    .replace(/%3F/gi, "o")
    .replace(/_/g, " ");
}

function parseHeroFromFileName(fileName) {
  const parsedName = parseHeroName(fileName);
  const key = normalizeHeroKey(parsedName);

  return {
    name: heroDisplayNameByKey[key] || parsedName,
    role: heroRoleByName[key] || "DPS",
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

async function main() {
  const mapsDir = path.resolve(__dirname, "../../frontend/MapImages");
  const heroesDir = path.resolve(__dirname, "../../frontend/HeroImages");

  const mapFiles = readImageFileNames(mapsDir);
  const heroFiles = readImageFileNames(heroesDir);

  if (mapFiles.length === 0) {
    throw new Error(`No map images found in: ${mapsDir}`);
  }

  if (heroFiles.length === 0) {
    throw new Error(`No hero images found in: ${heroesDir}`);
  }

  const maps = mapFiles.map(parseMapFromFileName);
  const heroes = heroFiles.map(parseHeroFromFileName);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('DELETE FROM "_AllowedMaps";');
    await tx.map.deleteMany();
    await tx.hero.deleteMany();

    await tx.map.createMany({ data: maps });
    await tx.hero.createMany({ data: heroes });
  });

  const [mapCount, heroCount] = await Promise.all([
    prisma.map.count(),
    prisma.hero.count(),
  ]);

  console.log(`Refreshed map and hero content successfully.`);
  console.log(`Maps inserted: ${maps.length} (db count: ${mapCount})`);
  console.log(`Heroes inserted: ${heroes.length} (db count: ${heroCount})`);
}

main()
  .catch((error) => {
    console.error("Map/hero refresh failed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });