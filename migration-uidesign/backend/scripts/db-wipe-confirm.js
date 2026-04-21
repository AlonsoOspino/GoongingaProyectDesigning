const { PrismaClient } = require("@prisma/client");
const readline = require("node:readline/promises");
const { stdin: input, stdout: output } = require("node:process");

const prisma = new PrismaClient();
const CONFIRM_TEXT = "DELETE DATABASE";

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

async function askConfirmation() {
  const argValue = getArgValue("--confirm");
  if (argValue) return argValue;

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(
    `This will permanently delete tournament/runtime data (maps and heroes are preserved). Type \"${CONFIRM_TEXT}\" to continue: `
  );
  rl.close();
  return answer.trim();
}

async function main() {
  const answer = await askConfirmation();
  if (answer !== CONFIRM_TEXT) {
    console.error("Confirmation text mismatch. Aborted.");
    process.exitCode = 1;
    return;
  }

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "PlayerStat",
      "DraftAction",
      "DraftTable",
      "News",
      "Match",
      "Member",
      "Team",
      "Tournament",
      "_AllowedMaps"
    RESTART IDENTITY CASCADE;
  `);

  console.log("Database data wiped successfully. Maps and heroes were preserved.");
}

main()
  .catch((error) => {
    console.error("Failed to wipe database:", error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
