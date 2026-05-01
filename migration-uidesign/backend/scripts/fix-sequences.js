const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function fixSequences() {
  try {
    console.log("Resetting auto-increment sequences...");

    // Reset DraftAction sequence
    await prisma.$executeRawUnsafe(
      "SELECT setval(pg_get_serial_sequence('\"DraftAction\"', 'id'), (SELECT MAX(id) FROM \"DraftAction\") + 1);"
    );
    console.log("✓ DraftAction sequence reset");

    // Reset DraftTable sequence
    await prisma.$executeRawUnsafe(
      "SELECT setval(pg_get_serial_sequence('\"DraftTable\"', 'id'), (SELECT MAX(id) FROM \"DraftTable\") + 1);"
    );
    console.log("✓ DraftTable sequence reset");

    console.log("All sequences fixed!");
  } catch (err) {
    console.error("Error fixing sequences:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixSequences();
