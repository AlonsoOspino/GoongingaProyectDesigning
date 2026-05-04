const path = require("node:path");
const heroRepository = require("../repositories/hero");
const { saveUploadedImage, deleteStoredImage } = require("../utils/contentImageUpload");

const HERO_ROLES = ["TANK", "DPS", "SUPPORT"];
const HERO_IMAGE_DIRECTORY = path.resolve(__dirname, "../../frontend/HeroImages");
const HERO_GIFT_DIRECTORY = path.resolve(__dirname, "../../frontend/HeroGifts");

const normalizeStoredAssetPath = (value, label = "assetUrl") => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }
  if (!/^https?:\/\//i.test(normalized) && !normalized.startsWith("/")) {
    throw new Error(`${label} must be an absolute URL or a public path.`);
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
  await deleteStoredImage({ imgPath: existing.heroGift, targetDirectory: HERO_GIFT_DIRECTORY });
  await heroRepository.remove(parsedId);
  return existing;
};

const create = async ({ name, role, image, imageUrl, gift, heroGift }) => {
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
    ? normalizeStoredAssetPath(imageUrl, "imageUrl")
    : await saveUploadedImage({
        file: image,
        displayName: normalizedName,
        filePrefix: "hero",
        targetDirectory: HERO_IMAGE_DIRECTORY,
        publicPrefix: "/HeroImages",
      });

  const giftPath = heroGift
    ? normalizeStoredAssetPath(heroGift, "heroGift")
    : gift
    ? await saveUploadedImage({
        file: gift,
        displayName: normalizedName,
        filePrefix: "hero-gift",
        targetDirectory: HERO_GIFT_DIRECTORY,
        publicPrefix: "/HeroGifts",
      })
    : null;

  return heroRepository.create({
    name: normalizedName,
    role: normalizedRole,
    imgPath,
    heroGift: giftPath,
  });
};

module.exports = {
  getAll,
  create,
  remove,
};
