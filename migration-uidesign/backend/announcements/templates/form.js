const { assertPlainObject, optionalText, requiredText, safeLink } = require("./shared");

function validateContent(content) {
  const source = assertPlainObject(content);
  return {
    headline: requiredText(source.headline, "Headline", 120),
    body: optionalText(source.body, 600),
    formUrl: requiredText(safeLink(source.formUrl, "Form URL"), "Form URL", 500),
    ctaLabel: optionalText(source.ctaLabel, 40),
  };
}

async function resolvePayload() {
  return null;
}

module.exports = { type: "FORM", validateContent, resolvePayload };
