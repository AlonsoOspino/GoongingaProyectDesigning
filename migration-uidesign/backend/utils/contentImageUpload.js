const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const MIME_EXTENSION_MAP = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const sanitizeBaseName = (value, fallback) => {
  const cleaned = String(value || "")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();

  return cleaned || fallback;
};

const getExtensionFromFile = (file) => {
  const fromMime = MIME_EXTENSION_MAP[String(file?.mimetype || "").toLowerCase()];
  if (fromMime) return fromMime;

  const fromName = path
    .extname(String(file?.originalname || ""))
    .replace(".", "")
    .toLowerCase();

  if (fromName) return fromName;
  throw new Error("Could not determine image file extension.");
};

/**
 * Normalizes an uploaded photo so every image renders identically on the site
 * and on the broadcast overlay, regardless of what the manager uploads.
 *
 * Without this, a wide/small/rotated source photo gets cropped arbitrarily by
 * `object-fit: cover`, which is why uploads looked broken or badly framed.
 *
 * - `.rotate()` applies EXIF orientation, so phone photos are not sideways.
 * - `fit: "cover"` + `position: sharp.strategy.attention` crops toward the most
 *   salient region (in practice the player's face) instead of the geometric
 *   center, so heads are not cut off.
 * - `.flatten()` removes transparency, which otherwise shows as black holes
 *   over the dark stream background.
 */
const normalizeImageBuffer = async (buffer, { width, height }) => {
  const output = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width,
      height,
      fit: "cover",
      position: sharp.strategy.attention,
      withoutEnlargement: false,
    })
    .flatten({ background: { r: 10, g: 16, b: 20 } })
    .webp({ quality: 90 })
    .toBuffer();

  return { buffer: output, extension: "webp" };
};

const saveUploadedImage = async ({
  file,
  displayName,
  filePrefix,
  targetDirectory,
  publicPrefix,
  normalize,
}) => {
  if (!file || !file.buffer) {
    throw new Error("image is required.");
  }

  if (!String(file.mimetype || "").toLowerCase().startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  await fs.mkdir(targetDirectory, { recursive: true });

  let buffer = file.buffer;
  let extension = getExtensionFromFile(file);

  if (normalize?.width && normalize?.height) {
    try {
      const normalized = await normalizeImageBuffer(buffer, normalize);
      buffer = normalized.buffer;
      extension = normalized.extension;
    } catch (error) {
      // Never fail the upload because post-processing failed: fall back to the
      // original bytes so the manager still gets an image on screen.
      console.error("[upload] Image normalization failed, storing original:", error);
    }
  }

  const safeBaseName = sanitizeBaseName(displayName, filePrefix);
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const fileName = `${filePrefix}-${safeBaseName}-${uniqueSuffix}.${extension}`;

  await fs.writeFile(path.join(targetDirectory, fileName), buffer);

  return `${publicPrefix}/${fileName}`;
};

const deleteStoredImage = async ({ imgPath, targetDirectory }) => {
  const normalizedPath = String(imgPath || "").trim();
  if (!normalizedPath || /^https?:\/\//i.test(normalizedPath)) {
    return false;
  }

  const fileName = path.basename(normalizedPath);
  if (!fileName) {
    return false;
  }

  try {
    await fs.unlink(path.join(targetDirectory, fileName));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
};

module.exports = {
  saveUploadedImage,
  deleteStoredImage,
};
