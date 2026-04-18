const newsRepo = require("../repositories/news");

const create = async (data) => {
  if (!data) throw new Error("Body is missing");
  const title = String(data.title || "").trim();
  const content = String(data.content || "").trim();
  const imageUrl = data.imageUrl ? String(data.imageUrl).trim() : null;

  if (!title || !content) {
    throw new Error("title and content are required");
  }

  return newsRepo.create({ title, content, imageUrl });
};

const update = async (id, data) => {
  if (!data) throw new Error("Body is missing");
  const payload = {};

  if (data.title !== undefined) payload.title = String(data.title).trim();
  if (data.content !== undefined) payload.content = String(data.content).trim();
  if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl ? String(data.imageUrl).trim() : null;

  if (Object.keys(payload).length === 0) {
    throw new Error("No valid fields to update");
  }

  return newsRepo.update(id, payload);
};

const remove = async (id) => newsRepo.remove(id);
const getById = async (id) => newsRepo.findById(id);
const getAll = async () => newsRepo.findAll();

module.exports = {
  create,
  update,
  remove,
  getById,
  getAll,
};
