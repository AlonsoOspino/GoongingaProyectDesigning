const prisma = require("../config/prisma");

const findAll = () =>
  prisma.map.findMany({
    orderBy: [{ type: "asc" }, { id: "asc" }],
  });

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

module.exports = {
  findAll,
  findByDescriptionAndType,
  create,
};
