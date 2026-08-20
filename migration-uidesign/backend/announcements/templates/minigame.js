const { assertPlainObject, optionalText } = require("./shared");
const prisma = require("../../config/prisma");

function validateContent(content) {
  const source = assertPlainObject(content);
  const minigameSlug = optionalText(source.minigameSlug, 120);

  if (!minigameSlug) throw new Error("Choose which minigame this announcement opens.");
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(minigameSlug)) throw new Error("That minigame route is not valid.");

  return { minigameSlug, ctaLabel: optionalText(source.ctaLabel, 40) };
}

async function resolvePayload(content) {
  // The migration can seed a row with an empty slug; that degrades to idle
  // rather than querying prisma with an empty string.
  if (!content.minigameSlug) return { state: "IDLE", game: null };

  const game = await prisma.miniGame.findUnique({
    where: { slug: content.minigameSlug },
    select: {
      slug: true,
      title: true,
      description: true,
      coverImageUrl: true,
      gameType: true,
      status: true,
      phase: true,
      updatedAt: true,
    },
  });

  if (!game) return { state: "IDLE", game: null };
  return { state: game.status === "LIVE" ? "LIVE" : "IDLE", game };
}

module.exports = { type: "MINIGAME", validateContent, resolvePayload };
