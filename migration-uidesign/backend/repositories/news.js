const prisma = require("../config/prisma");

const create = (data) => prisma.news.create({ data });
const update = (id, data) => prisma.news.update({ where: { id }, data });
const remove = (id) => prisma.news.delete({ where: { id } });
const findById = (id) => prisma.news.findUnique({ where: { id } });
const findAll = () => prisma.news.findMany({ orderBy: { updatedAt: "desc" } });

module.exports = {
  create,
  update,
  remove,
  findById,
  findAll,
};
