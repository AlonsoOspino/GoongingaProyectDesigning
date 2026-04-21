const prisma = require("../config/prisma");

const findAll = () =>
  prisma.hero.findMany({
    orderBy: [{ role: "asc" }, { id: "asc" }],
  });

module.exports = {
  findAll,
};
