function assertPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Announcement content must be an object.");
  }
  return value;
}

function optionalText(value, max) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") throw new Error("Text fields must be plain text.");
  return value.trim().slice(0, max);
}

function requiredText(value, label, max) {
  const text = optionalText(value, max);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

// Operators type these by hand, so a bare `javascript:` URL would be stored XSS.
// Only an internal path or an absolute http(s) URL is allowed through.
function safeLink(value, label) {
  const text = optionalText(value, 500);
  if (!text) return "";
  if (text.startsWith("//")) throw new Error(`${label} must be an internal path or an http(s) URL.`);
  if (text.startsWith("/")) return text;
  if (/^https?:\/\//i.test(text)) return text;
  throw new Error(`${label} must be an internal path or an http(s) URL.`);
}

module.exports = { assertPlainObject, optionalText, requiredText, safeLink };
