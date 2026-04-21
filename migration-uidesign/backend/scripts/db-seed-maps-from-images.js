const fs = require("fs");
const path = require("path");
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

async function seedMaps({ dryRun }) {
  const mapImagesDir = path.resolve(__dirname, "../../frontend/MapImages");

  if (!fs.existsSync(mapImagesDir)) {
    throw new Error(`MapImages directory not found: ${mapImagesDir}`);
  }

  const imageFiles = fs
    .readdirSync(mapImagesDir)
    .filter((file) => /\.(avif|webp|png|jpe?g)$/i.test(file))
    .sort((a, b) => a.localeCompare(b));

  if (imageFiles.length === 0) {
    throw new Error(`No map image files found in: ${mapImagesDir}`);
  }

  const maps = imageFiles.map(parseMapFromFileName);

  if (dryRun) {
    console.log(`[dry-run] Parsed ${maps.length} map records from ${mapImagesDir}`);
    maps.forEach((map) => {
      console.log(`- ${map.description} | ${map.type} | ${map.imgPath}`);
    });
    return;
  }

  let created = 0;
  let updated = 0;

  for (const map of maps) {
    const existing = await prisma.map.findFirst({
      where: { imgPath: map.imgPath },
      select: { id: true },
    });

    if (existing) {
      await prisma.map.update({
        where: { id: existing.id },
        data: map,
      });
      updated += 1;
      continue;
    }

    await prisma.map.create({ data: map });
    created += 1;
  }

  console.log(`Map seed completed. Parsed: ${maps.length}, created: ${created}, updated: ${updated}.`);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  await seedMaps({ dryRun });
}

main()
  .catch((error) => {
    console.error("Map seed failed:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
