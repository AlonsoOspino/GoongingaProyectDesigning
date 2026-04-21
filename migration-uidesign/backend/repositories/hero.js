const prisma = require("../config/prisma");

const findAll = () =>
  prisma.hero.findMany({
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });

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

module.exports = {
  findAll,
  findByName,
  create,
};
