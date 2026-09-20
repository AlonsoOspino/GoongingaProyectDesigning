const MAP_TYPES = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

const normalizeOverlayFocus = (body) => {
  const hasType = hasOwn(body, "focusType");
  const hasMapId = hasOwn(body, "focusMapId");

  if (!hasType && !hasMapId) {
    throw new Error("Provide focusType or focusMapId.");
  }

  const rawType = hasType ? body.focusType : null;
  if (rawType === null || rawType === undefined || rawType === "") {
    if (hasMapId && body.focusMapId !== null && body.focusMapId !== undefined) {
      throw new Error("focusType is required when focusMapId is set.");
    }
    return { overlayFocusType: null, overlayFocusMapId: null };
  }

  const overlayFocusType = String(rawType).trim().toUpperCase();
  if (!MAP_TYPES.includes(overlayFocusType)) {
    throw new Error(`Invalid focusType: ${rawType}`);
  }

  const rawMapId = hasMapId ? body.focusMapId : null;
  if (rawMapId === null || rawMapId === undefined) {
    return { overlayFocusType, overlayFocusMapId: null };
  }

  if (typeof rawMapId !== "number" || !Number.isInteger(rawMapId) || rawMapId <= 0) {
    throw new Error(`Invalid focusMapId: ${rawMapId}`);
  }

  return { overlayFocusType, overlayFocusMapId: rawMapId };
};

module.exports = { MAP_TYPES, normalizeOverlayFocus };
