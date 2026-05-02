const prisma = require("../config/prisma");

const findAll = () =>
  prisma.hero.findMany({
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });

const findById = (id) => prisma.hero.findUnique({ where: { id } });

const findByName = (name) =>
  prisma.hero.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });

const create = (data) => prisma.hero.create({ data });
const remove = (id) => prisma.hero.delete({ where: { id } });

module.exports = {
  findAll,
  findById,
  findByName,
  create,
  remove,
};
