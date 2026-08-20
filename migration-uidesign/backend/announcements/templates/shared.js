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

// RFC 2606 reserved TLD: can never resolve to a real host.
const INTERNAL_BASE = "http://internal.invalid";

// Operators type these by hand, so this is a security control, not formatting.
// String prefix checks cannot decide this: the WHATWG URL parser treats a
// backslash as a slash and strips tab/CR/LF before resolving, so "/\evil.host"
// and "/<TAB>/evil.host" both reach an external origin while looking internal.
// Resolving against a sentinel origin is the only check that sees what the
// browser will actually do.
function safeLink(value, label) {
  const text = optionalText(value, 500);
  if (!text) return "";

  const invalid = () => new Error(`${label} must be an internal path or an http(s) URL.`);

  if (/^https?:\/\//i.test(text)) {
    try {
      new URL(text);
    } catch {
      throw invalid();
    }
    return text;
  }

  if (!text.startsWith("/")) throw invalid();

  let resolved;
  try {
    resolved = new URL(text, INTERNAL_BASE);
  } catch {
    throw invalid();
  }
  if (resolved.origin !== INTERNAL_BASE) throw invalid();
  return text;
}

module.exports = { assertPlainObject, optionalText, requiredText, safeLink };
