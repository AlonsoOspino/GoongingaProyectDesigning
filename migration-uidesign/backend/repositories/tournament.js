const prisma = require("../config/prisma");

const create = (data) => prisma.tournament.create({ data });

const update = (id, data) =>
  prisma.tournament.update({ where: { id }, data });

const remove = (id) =>
  prisma.tournament.delete({ where: { id } });

const findByName = (name) =>
  prisma.tournament.findFirst({ where: { name } });

const findById = (id) =>
  prisma.tournament.findUnique({ where: { id } });

const findAll = () => prisma.tournament.findMany();

module.exports = {
  create,
  update,
  remove,
  findByName,
  findById,
  findAll,
};
