const prisma = require("../config/prisma");

const findAll = () =>
  prisma.map.findMany({
    orderBy: [{ type: "asc" }, { id: "asc" }],
  });

const findById = (id) => prisma.map.findUnique({ where: { id } });

const findByDescriptionAndType = (description, type) =>
  prisma.map.findFirst({
    where: {
      type,
      description: {
        equals: description,
        mode: "insensitive",
      },
    },
  });

const create = (data) => prisma.map.create({ data });
const remove = (id) => prisma.map.delete({ where: { id } });

module.exports = {
  findAll,
  findById,
  findByDescriptionAndType,
  create,
  remove,
};
