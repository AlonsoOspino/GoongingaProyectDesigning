const prisma = require("../config/prisma");

const findAll = () =>
  prisma.map.findMany({
    orderBy: [{ type: "asc" }, { id: "asc" }],
  });

module.exports = {
  findAll,
};
