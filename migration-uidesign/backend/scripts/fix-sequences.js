const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TABLES_WITH_IDS = [
  "Tournament",
  "Member",
  "Team",
  "Match",
  "LeaderboardOverlayAsset",
  "News",
  "DraftTable",
  "DraftAction",
  "Map",
  "Hero",
  "PlayerStat",
];

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function resetSequence(tableName) {
  const table = quoteIdent(tableName);
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('${table}', 'id'),
      COALESCE((SELECT MAX("id") FROM ${table}), 1),
      (SELECT COUNT(*) FROM ${table}) > 0
    );
  `);
  console.log(`Sequence reset: ${tableName}`);
}

async function main() {
  console.log("Resetting auto-increment sequences...");
  for (const tableName of TABLES_WITH_IDS) {
    await resetSequence(tableName);
  }
  console.log("All sequences fixed.");
}

main()
  .catch((err) => {
    console.error("Error fixing sequences:", err?.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
