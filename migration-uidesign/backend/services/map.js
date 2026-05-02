const path = require("node:path");
const mapRepository = require("../repositories/map");
const { saveUploadedImage, deleteStoredImage } = require("../utils/contentImageUpload");

const MAP_TYPES = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];
const MAP_IMAGE_DIRECTORY = path.resolve(__dirname, "../../frontend/MapImages");

const normalizeStoredImagePath = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("imageUrl is required.");
  }
  if (!/^https?:\/\//i.test(normalized) && !normalized.startsWith("/")) {
    throw new Error("imageUrl must be an absolute URL or a public path.");
  }
  return normalized;
};

const parseMapType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!MAP_TYPES.includes(normalized)) {
    throw new Error(`type must be one of: ${MAP_TYPES.join(", ")}.`);
  }
  return normalized;
};

const getAll = async () => mapRepository.findAll();

const remove = async (id) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error("id must be a positive integer.");
  }

  const existing = await mapRepository.findById(parsedId);
  if (!existing) {
    throw new Error("Map not found.");
  }

  await deleteStoredImage({ imgPath: existing.imgPath, targetDirectory: MAP_IMAGE_DIRECTORY });
  await mapRepository.remove(parsedId);
  return existing;
};

const create = async ({ name, type, image, imageUrl }) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    throw new Error("name is required.");
  }

  const normalizedType = parseMapType(type);
  const existing = await mapRepository.findByDescriptionAndType(normalizedName, normalizedType);
  if (existing) {
    throw new Error("A map with the same name and type already exists.");
  }

  const imgPath = imageUrl
    ? normalizeStoredImagePath(imageUrl)
    : await saveUploadedImage({
        file: image,
        displayName: normalizedName,
        filePrefix: "map",
        targetDirectory: MAP_IMAGE_DIRECTORY,
        publicPrefix: "/MapImages",
      });

  return mapRepository.create({
    type: normalizedType,
    description: normalizedName,
    imgPath,
  });
};

module.exports = {
  getAll,
  create,
  remove,
};
