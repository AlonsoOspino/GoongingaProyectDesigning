const path = require("node:path");
const heroRepository = require("../repositories/hero");
const { saveUploadedImage, deleteStoredImage } = require("../utils/contentImageUpload");

const HERO_ROLES = ["TANK", "DPS", "SUPPORT"];
const HERO_IMAGE_DIRECTORY = path.resolve(__dirname, "../../frontend/HeroImages");

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

const parseHeroRole = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!HERO_ROLES.includes(normalized)) {
    throw new Error(`role must be one of: ${HERO_ROLES.join(", ")}.`);
  }
  return normalized;
};

const getAll = async () => heroRepository.findAll();

const remove = async (id) => {
  const parsedId = Number(id);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error("id must be a positive integer.");
  }

  const existing = await heroRepository.findById(parsedId);
  if (!existing) {
    throw new Error("Hero not found.");
  }

  await deleteStoredImage({ imgPath: existing.imgPath, targetDirectory: HERO_IMAGE_DIRECTORY });
  await heroRepository.remove(parsedId);
  return existing;
};

const create = async ({ name, role, image, imageUrl }) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    throw new Error("name is required.");
  }

  const normalizedRole = parseHeroRole(role);
  const existing = await heroRepository.findByName(normalizedName);
  if (existing) {
    throw new Error("A hero with the same name already exists.");
  }

  const imgPath = imageUrl
    ? normalizeStoredImagePath(imageUrl)
    : await saveUploadedImage({
        file: image,
        displayName: normalizedName,
        filePrefix: "hero",
        targetDirectory: HERO_IMAGE_DIRECTORY,
        publicPrefix: "/HeroImages",
      });

  return heroRepository.create({
    name: normalizedName,
    role: normalizedRole,
    imgPath,
  });
};

module.exports = {
  getAll,
  create,
  remove,
};
