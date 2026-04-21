const path = require("node:path");
const mapRepository = require("../repositories/map");
const { saveUploadedImage } = require("../utils/contentImageUpload");

const MAP_TYPES = ["CONTROL", "HYBRID", "PAYLOAD", "PUSH", "FLASHPOINT"];
const MAP_IMAGE_DIRECTORY = path.resolve(__dirname, "../../frontend/MapImages");

const parseMapType = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!MAP_TYPES.includes(normalized)) {
    throw new Error(`type must be one of: ${MAP_TYPES.join(", ")}.`);
  }
  return normalized;
};

const getAll = async () => mapRepository.findAll();

const create = async ({ name, type, image }) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    throw new Error("name is required.");
  }

  const normalizedType = parseMapType(type);
  const existing = await mapRepository.findByDescriptionAndType(normalizedName, normalizedType);
  if (existing) {
    throw new Error("A map with the same name and type already exists.");
  }

  const imgPath = await saveUploadedImage({
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
};
