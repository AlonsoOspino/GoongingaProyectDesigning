const { assertPlainObject, optionalText } = require("./shared");

function validateContent(content) {
  const source = assertPlainObject(content);
  const minigameSlug = optionalText(source.minigameSlug, 120);

  if (!minigameSlug) throw new Error("Choose which minigame this announcement opens.");
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(minigameSlug)) throw new Error("That minigame route is not valid.");

  return { minigameSlug, ctaLabel: optionalText(source.ctaLabel, 40) };
}

module.exports = { type: "MINIGAME", validateContent };
