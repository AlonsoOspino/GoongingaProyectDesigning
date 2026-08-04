/* eslint-disable no-console */
const fs = require("node:fs/promises");
const path = require("node:path");
const prisma = require("../config/prisma");

const MEDIA_DIR = path.resolve(process.env.MEDIA_DIR || path.join(__dirname, "../uploads"));
const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".webp"]);
const TYPE_ALIASES = {
  CONTROL: "CONTROL",
  HYBRID: "HYBRID",
  PAYLOAD: "PAYLOAD",
  PLAYLOAD: "PAYLOAD",
  ESCORT: "PAYLOAD",
  PUSH: "PUSH",
  FLASHPOINT: "FLASHPOINT",
};
const MAP_NAME_ALIASES = {
  ATLIS: "ATLAS",
  SHAMBALI: "SHAMBALIMONASTERY",
};
const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const publicBaseArgument = process.argv.find((arg) => arg.startsWith("--public-api-base="));
const PUBLIC_API_BASE_URL = (
  process.env.ASSET_PUBLIC_BASE_URL ||
  publicBaseArgument?.slice("--public-api-base=".length) ||
  ""
).replace(/\/$/, "");

const summary = {
  heroFilesFound: 0,
  mapFilesFound: 0,
  heroesMatched: 0,
  mapsMatched: 0,
  heroesUpdated: 0,
  mapsUpdated: 0,
  unmatchedFiles: 0,
  ambiguousFiles: 0,
};

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFKD")
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

function parseMapFileName(fileName) {
  const baseName = path.basename(fileName, path.extname(fileName));
  const parts = baseName.split("_").filter(Boolean);
  if (parts.length < 2) return null;

  const type = TYPE_ALIASES[parts.at(-1).toUpperCase()];
  if (!type) return null;
  const rawDescriptionKey = normalizeKey(parts.slice(0, -1).join("_"));
  return {
    type,
    descriptionKey: MAP_NAME_ALIASES[rawDescriptionKey] || rawDescriptionKey,
  };
}

async function imageFilesIn(directory) {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function publicUrl(folder, fileName) {
  return `${PUBLIC_API_BASE_URL}/uploads/${folder}/${encodeURIComponent(fileName)}`;
}

function indexBy(items, getKey) {
  const index = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const list = index.get(key) || [];
    list.push(item);
    index.set(key, list);
  }
  return index;
}

function planFile({ fileName, candidates, target, kind }) {
  if (candidates.length === 0) {
    summary.unmatchedFiles += 1;
    console.warn(`UNMATCHED ${kind}: ${fileName}`);
    return;
  }
  if (candidates.length > 1 || target.has(candidates[0].id)) {
    summary.ambiguousFiles += 1;
    console.warn(`AMBIGUOUS ${kind}: ${fileName}`);
    return;
  }
  target.set(candidates[0].id, { record: candidates[0], fileName });
}

async function main() {
  if (shouldWrite && !PUBLIC_API_BASE_URL) {
    throw new Error("Use --public-api-base=http://YOUR_SERVER_IP:3000 when writing the import.");
  }

  const heroesDirectory = path.join(MEDIA_DIR, "heroes");
  const mapsDirectory = path.join(MEDIA_DIR, "maps");
  const [heroFiles, mapFiles, heroes, maps] = await Promise.all([
    imageFilesIn(heroesDirectory),
    imageFilesIn(mapsDirectory),
    prisma.hero.findMany({ select: { id: true, name: true, imgPath: true } }),
    prisma.map.findMany({ select: { id: true, type: true, description: true, imgPath: true } }),
  ]);

  summary.heroFilesFound = heroFiles.length;
  summary.mapFilesFound = mapFiles.length;
  if (heroFiles.length + mapFiles.length === 0) {
    throw new Error(`No image files found in ${heroesDirectory} or ${mapsDirectory}.`);
  }

  const heroesByName = indexBy(heroes, (hero) => normalizeKey(hero.name));
  const mapsByNameAndType = indexBy(maps, (map) => {
    const rawDescriptionKey = normalizeKey(map.description);
    return `${map.type}:${MAP_NAME_ALIASES[rawDescriptionKey] || rawDescriptionKey}`;
  });
  const plannedHeroes = new Map();
  const plannedMaps = new Map();

  for (const fileName of heroFiles) {
    const key = normalizeKey(parseHeroName(fileName));
    planFile({ fileName, candidates: heroesByName.get(key) || [], target: plannedHeroes, kind: "hero" });
  }

  for (const fileName of mapFiles) {
    const parsed = parseMapFileName(fileName);
    if (!parsed) {
      summary.unmatchedFiles += 1;
      console.warn(`UNMATCHED map (use Name_TYPE.ext): ${fileName}`);
      continue;
    }
    const key = `${parsed.type}:${parsed.descriptionKey}`;
    planFile({ fileName, candidates: mapsByNameAndType.get(key) || [], target: plannedMaps, kind: "map" });
  }

  summary.heroesMatched = plannedHeroes.size;
  summary.mapsMatched = plannedMaps.size;

  console.log(shouldWrite ? "Restoring hero and map images from local VPS storage." : "Dry run: no database values will change.");
  for (const { record, fileName } of plannedHeroes.values()) {
    const imgPath = publicUrl("heroes", fileName);
    if (shouldWrite && record.imgPath !== imgPath) {
      await prisma.hero.update({ where: { id: record.id }, data: { imgPath } });
      summary.heroesUpdated += 1;
    }
    console.log(`${shouldWrite ? "UPDATED" : "WOULD UPDATE"} hero#${record.id}: ${fileName}`);
  }
  for (const { record, fileName } of plannedMaps.values()) {
    const imgPath = publicUrl("maps", fileName);
    if (shouldWrite && record.imgPath !== imgPath) {
      await prisma.map.update({ where: { id: record.id }, data: { imgPath } });
      summary.mapsUpdated += 1;
    }
    console.log(`${shouldWrite ? "UPDATED" : "WOULD UPDATE"} map#${record.id}: ${fileName}`);
  }

  if (shouldWrite) {
    const manifest = {
      heroes: Object.fromEntries([...plannedHeroes.values()].map(({ record, fileName }) => [record.id, publicUrl("heroes", fileName)])),
      maps: Object.fromEntries([...plannedMaps.values()].map(({ record, fileName }) => [record.id, publicUrl("maps", fileName)])),
    };
    await fs.writeFile(path.join(MEDIA_DIR, "core-image-import-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  console.log("\nSummary");
  console.log(JSON.stringify(summary, null, 2));
  if (!shouldWrite) console.log("Run again with --write only after reviewing the matches.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
