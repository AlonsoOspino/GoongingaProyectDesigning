const fs = require("node:fs/promises");
const path = require("node:path");

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

const saveUploadedImage = async ({
  file,
  displayName,
  filePrefix,
  targetDirectory,
  publicPrefix,
}) => {
  if (!file || !file.buffer) {
    throw new Error("image is required.");
  }

  if (!String(file.mimetype || "").toLowerCase().startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  await fs.mkdir(targetDirectory, { recursive: true });

  const extension = getExtensionFromFile(file);
  const safeBaseName = sanitizeBaseName(displayName, filePrefix);
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
  const fileName = `${filePrefix}-${safeBaseName}-${uniqueSuffix}.${extension}`;

  await fs.writeFile(path.join(targetDirectory, fileName), file.buffer);

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