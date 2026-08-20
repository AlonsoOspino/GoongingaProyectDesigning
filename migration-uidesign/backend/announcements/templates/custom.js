const { assertPlainObject, optionalText, requiredText, safeLink } = require("./shared");

function validateContent(content) {
  const source = assertPlainObject(content);
  return {
    eyebrow: optionalText(source.eyebrow, 60),
    headline: requiredText(source.headline, "Headline", 120),
    body: optionalText(source.body, 600),
    imageUrl: safeLink(source.imageUrl, "Image URL"),
    ctaLabel: optionalText(source.ctaLabel, 40),
    ctaHref: safeLink(source.ctaHref, "Button link"),
  };
}

async function resolvePayload() {
  return null;
}

module.exports = { type: "CUSTOM", validateContent, resolvePayload };
