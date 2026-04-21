const path = require("node:path");
const heroRepository = require("../repositories/hero");
const { saveUploadedImage } = require("../utils/contentImageUpload");

const HERO_ROLES = ["TANK", "DPS", "SUPPORT"];
const HERO_IMAGE_DIRECTORY = path.resolve(__dirname, "../../frontend/HeroImages");

const parseHeroRole = (value) => {
  const normalized = String(value || "").trim().toUpperCase();
  if (!HERO_ROLES.includes(normalized)) {
    throw new Error(`role must be one of: ${HERO_ROLES.join(", ")}.`);
  }
  return normalized;
};

const getAll = async () => heroRepository.findAll();

const create = async ({ name, role, image }) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    throw new Error("name is required.");
  }

  const normalizedRole = parseHeroRole(role);
  const existing = await heroRepository.findByName(normalizedName);
  if (existing) {
    throw new Error("A hero with the same name already exists.");
  }

  const imgPath = await saveUploadedImage({
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
};
